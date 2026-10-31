// VIBEZCORE — één geluidsmotor voor sessies op de iPhone (19 okt 2026).
//
// Operator: "lockscreen met sessie state control of breathwork is een ramp …
// hartslag moet stabiel klinken … stop met lapmiddelen, desnoods bouw je
// helemaal opnieuw". Oorzaken van het oude ontwerp:
//   1. Elke hartslag werd door een JavaScript-timer aangevraagd. Met het
//      scherm op slot vertraagt iOS die timers → haperend ritme.
//   2. Het geluid liep via expo-audio-spelers. expo-audio zet na het
//      stoppen van ELKE speler de geluidssessie van de hele app uit
//      (AudioModule.deactivateSession) en weer aan bij de volgende — na
//      elke slag en elke stem-zin. Dat geeft haperingen en vreemde klank.
//   3. Het hartslaggeluid ging via Core Haptics, en iOS legt Core Haptics
//      stil zodra de app op de achtergrond staat.
//
// Nu: deze motor (AVAudioEngine) krijgt bij de start het HELE sessieplan
// (tempo, opbouw, duur) en plant elke slag zelf, sample-nauwkeurig, op de
// geluidsklok. De stem-zinnen en (op de voorgrond) de tikken lopen via
// dezelfde motor. De geluidssessie wordt hier één keer goed gezet; zakt ze
// toch weg (een andere speler zette haar uit, een telefoontje), dan zet de
// motor zichzelf binnen 250 ms terug op dezelfde plek in het ritme.
//
// Trillen met vergrendeld scherm laat iOS aan geen enkele app toe; dan
// speelt enkel het geluid (en trilt een gekoppelde Apple Watch).
//
// Geschreven op Windows zonder Xcode: elke regel is met de hand
// nagekeken op de iOS 15+-API's die hier gebruikt worden.

import AVFoundation
import CoreHaptics
import ExpoModulesCore
import Foundation
import UIKit

struct SessionTapRecord: Record {
  /// Milliseconden na het startmoment.
  @Field var t: Double = 0
  @Field var intensity: Double = 0
  @Field var sharpness: Double = 0.5
}

struct BeatPlanRecord: Record {
  /// Wandklok (ms sinds 1970, zoals Date.now()) van de eerste slag.
  @Field var firstBeatAtMs: Double = 0
  /// Plek in de curve (s) van die eerste slag.
  @Field var firstCurveSec: Double = 0
  @Field var startBpm: Double = 70
  @Field var targetBpm: Double = 70
  @Field var holdSec: Double = 0
  @Field var rampSec: Double = 0
  /// Wandklok waarop de slagen stoppen; 0 = tot stopBeats().
  @Field var endAtMs: Double = 0
  @Field var sound: Bool = false
  @Field var speakerVolume: Double = 1
  @Field var headphonesVolume: Double = 0.7
  /// Het geluid start zoveel vóór de tik (inzet van de opname).
  @Field var soundLeadMs: Double = 25
  @Field var haptics: Bool = true
  @Field var lubIntensity: Double = 0.8
  @Field var lubSharpness: Double = 0.5
  @Field var dubIntensity: Double = 0.6
  @Field var dubSharpness: Double = 0.4
}

/// Eigen kopie van het plan (los van de Record-brug).
private struct BeatPlan {
  var firstBeatAtMs: Double
  var firstCurveSec: Double
  var startBpm: Double
  var targetBpm: Double
  var holdSec: Double
  var rampSec: Double
  var endAtMs: Double
  var sound: Bool
  var speakerVolume: Float
  var headphonesVolume: Float
  var soundLeadMs: Double
  var haptics: Bool
  var lubIntensity: Float
  var lubSharpness: Float
  var dubIntensity: Float
  var dubSharpness: Float

  func bpm(atCurve curve: Double) -> Double {
    if curve < holdSec { return startBpm }
    let progress = rampSec <= 0 ? 1 : min(1, (curve - holdSec) / rampSec)
    return startBpm + (targetBpm - startBpm) * progress
  }

  /// Zelfde afronding als bracelet-haptics.ts (Math.round).
  func cycleMs(atCurve curve: Double) -> Double {
    return (60000.0 / max(20, bpm(atCurve: curve))).rounded()
  }

  func dubAtMs(cycleMs: Double) -> Double {
    return min(cycleMs * 0.3, 350).rounded()
  }
}

final class SessionAudioEngine {
  static let shared = SessionAudioEngine()

  private let q = DispatchQueue(label: "com.vibezcore.sessionaudio", qos: .userInteractive)
  private let loadQ = DispatchQueue(label: "com.vibezcore.sessionaudio.load", qos: .userInitiated)
  /* var: na een mediaServicesWereReset zijn motor en spelers ongeldig en
     moeten ze opnieuw gemaakt worden (Apple). */
  private var engine = AVAudioEngine()
  private let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
  private var beatNodes: [AVAudioPlayerNode] = []
  private var nextBeatNode = 0
  private var voiceNode = AVAudioPlayerNode()
  private var attached = false

  private var buffers: [String: AVAudioPCMBuffer] = [:]
  private var owners = Set<String>()
  private var voiceActiveUntil: Double = 0
  private var timer: DispatchSourceTimer?
  /// JS meldt dat niets anders in de app nog speelt: bij stilstand de
  /// geluidssessie teruggeven aan andere apps (YouTube, muziek).
  private var releaseWhenIdle = false
  /// Rem op herstarten: nooit vaker dan eens per seconde, anders vecht de
  /// motor met een andere app om de geluidssessie (haperend geluid).
  private var lastRecoverMs: Double = 0

  // Slagen
  private var plan: BeatPlan?
  private var nextAtMs: Double = 0
  private var nextCurveSec: Double = 0
  /// Tot hier is alles al bij de motor ingepland.
  private var scheduledUntilMs: Double = 0
  private let lookaheadMs: Double = 1500

  // Tikken
  private var haptic: CHHapticEngine?
  private var hapticRunning = false
  private var beatHapticPlayers: [CHHapticPatternPlayer] = []
  private var tapPlayers: [CHHapticPatternPlayer] = []
  private var appActive = true

  private init() {
    for _ in 0..<6 { beatNodes.append(AVAudioPlayerNode()) }
    let nc = NotificationCenter.default
    nc.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: nil) { [weak self] _ in
      self?.q.async { [weak self] in self?.appActive = true }
    }
    nc.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: nil) { [weak self] _ in
      self?.q.async { [weak self] in self?.appActive = false }
    }
    /* object: nil — de motor kan na een reset een nieuw object zijn; op q
       nagaan of de melding van de huidige motor komt. */
    nc.addObserver(forName: .AVAudioEngineConfigurationChange, object: nil, queue: nil) { [weak self] note in
      let sender = (note.object as? AVAudioEngine).map { ObjectIdentifier($0) }
      self?.q.async { [weak self] in
        guard let self = self, sender == ObjectIdentifier(self.engine) else { return }
        self.recover()
      }
    }
    nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: nil) { [weak self] note in
      guard
        let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        let type = AVAudioSession.InterruptionType(rawValue: raw),
        type == .ended
      else { return }
      self?.q.async { [weak self] in self?.recover() }
    }
    nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: nil) { [weak self] _ in
      self?.q.async { [weak self] in self?.rebuildAfterReset() }
    }
    DispatchQueue.main.async { [weak self] in
      /* 19 okt 2026 (operator, build 38: "onboarding stap 2 geen haptics"):
         bij het opstarten is de app nog "inactive" en de didBecomeActive-
         melding kan al voorbij zijn — dan bleef appActive voor altijd false
         en speelde geen enkele tik. Enkel "background" telt als niet in beeld. */
      let active = UIApplication.shared.applicationState != .background
      self?.q.async { [weak self] in self?.appActive = active }
    }
  }

  // MARK: - Klok

  private func nowMs() -> Double {
    return Date().timeIntervalSince1970 * 1000
  }

  /// Wandklok (ms) → hostTime voor AVAudioTime.
  private func hostTime(atMs: Double, now: Double) -> UInt64 {
    let delaySec = max(0, (atMs - now) / 1000)
    return mach_absolute_time() + AVAudioTime.hostTime(forSeconds: delaySec)
  }

  // MARK: - Motor en geluidssessie (enkel op q)

  private var needsEngine: Bool {
    return !owners.isEmpty || plan != nil || nowMs() < voiceActiveUntil
  }

  /// Moet er echt geluid (en dus een draaiende motor + geluidssessie) zijn?
  /// Een plan met enkel tikken (onboarding-proef, geluid uit) heeft enkel de
  /// klok nodig: Core Haptics speelt zonder geluidssessie (playsHapticsOnly).
  /// 19 okt 2026: nooit andermans muziek storen voor enkel trillingen.
  private var wantsAudio: Bool {
    return !owners.isEmpty || (plan?.sound ?? false) || nowMs() < voiceActiveUntil
  }
  /// Heeft deze motor de geluidssessie aangezet? Enkel dan teruggeven.
  private var sessionActivated = false

  private func configureSession() {
    let s = AVAudioSession.sharedInstance()
    /* Afspelen, ook met de stille-schakelaar aan en op de achtergrond;
       mengt met muziek van de gebruiker (nooit iemands muziek stoppen). */
    if s.category != .playback || !s.categoryOptions.contains(.mixWithOthers) {
      try? s.setCategory(.playback, mode: .default, options: [.mixWithOthers])
    }
    try? s.setActive(true)
    sessionActivated = true
  }

  @discardableResult
  private func ensureEngine() -> Bool {
    if !attached {
      engine.attach(voiceNode)
      engine.connect(voiceNode, to: engine.mainMixerNode, format: format)
      for n in beatNodes {
        engine.attach(n)
        engine.connect(n, to: engine.mainMixerNode, format: format)
      }
      attached = true
    }
    /* Waakhond eerst: mislukt de start (bv. tijdens een telefoontje), dan
       probeert tick() het elke 250 ms opnieuw. */
    startTimer()
    if engine.isRunning { return true }
    configureSession()
    engine.prepare()
    do {
      try engine.start()
    } catch {
      return false
    }
    for n in beatNodes { n.play() }
    return true
  }

  private func stopEngineIfIdle() {
    guard !needsEngine else { return }
    stopTimer()
    if attached {
      voiceNode.stop()
      for n in beatNodes { n.stop() }
    }
    if engine.isRunning { engine.stop() }
    /* Enkel uitzetten als JS meldde dat niets anders in de app speelt
       (audiobibliotheek/soundscape gebruiken dezelfde geluidssessie).
       Operator 19 okt 2026: YouTube haperde na een sessie. */
    if releaseWhenIdle {
      releaseWhenIdle = false
      if sessionActivated {
        sessionActivated = false
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
      }
    }
  }

  /// Motor viel weg (sessie uitgezet, telefoontje, routewissel): herstarten
  /// en de slagen opnieuw inplannen vanaf de slag van nu.
  private func recover() {
    guard wantsAudio else { return }
    if engine.isRunning, !beatNodes.isEmpty, beatNodes[0].isPlaying { return }
    let now = nowMs()
    if now - lastRecoverMs < 1000 { return }
    lastRecoverMs = now
    if attached {
      for n in beatNodes { n.stop() }
      voiceNode.stop()
    }
    if engine.isRunning { engine.stop() }
    /* Ook de al ingeplande tikken vergeten, anders tikt elke slag dubbel
       zodra resetIteration() ze opnieuw inplant. */
    for p in beatHapticPlayers {
      try? p.stop(atTime: CHHapticTimeImmediate)
    }
    beatHapticPlayers = []
    guard ensureEngine() else { return }
    if plan != nil {
      resetIteration()
      pump()
    }
  }

  /// Na mediaServicesWereReset: motor en spelers zijn ongeldig → nieuwe maken.
  private func rebuildAfterReset() {
    stopTimer()
    engine = AVAudioEngine()
    voiceNode = AVAudioPlayerNode()
    beatNodes = (0..<6).map { _ in AVAudioPlayerNode() }
    nextBeatNode = 0
    attached = false
    beatHapticPlayers = []
    if !needsEngine { return }
    if wantsAudio {
      guard ensureEngine() else { return }
    } else {
      startTimer()
    }
    if plan != nil {
      resetIteration()
      pump()
    }
  }

  private func startTimer() {
    if timer != nil { return }
    let t = DispatchSource.makeTimerSource(queue: q)
    t.schedule(deadline: .now() + .milliseconds(250), repeating: .milliseconds(250), leeway: .milliseconds(20))
    t.setEventHandler { [weak self] in
      self?.tick()
    }
    t.resume()
    timer = t
  }

  private func stopTimer() {
    timer?.cancel()
    timer = nil
  }

  private func tick() {
    if !needsEngine {
      stopEngineIfIdle()
      return
    }
    /* Waakhond: een andere speler kan de geluidssessie uitgezet hebben. */
    if wantsAudio && (!engine.isRunning || (!beatNodes.isEmpty && !beatNodes[0].isPlaying)) {
      recover()
      return
    }
    pump()
  }

  // MARK: - Eigenaars (houdt de app levend tijdens een sessie)

  func begin(_ owner: String) {
    q.async {
      self.releaseWhenIdle = false
      self.owners.insert(owner)
      self.ensureEngine()
    }
  }

  func end(_ owner: String) {
    q.async {
      self.owners.remove(owner)
      self.stopEngineIfIdle()
    }
  }

  /// Geef de geluidssessie terug zodra de motor stilvalt (nu, of na de
  /// laatste stem-cue via tick()).
  func releaseSession() {
    q.async {
      self.releaseWhenIdle = true
      if self.needsEngine { self.startTimer() } else { self.stopEngineIfIdle() }
    }
  }

  // MARK: - Geluiden laden

  func hasSound(_ key: String) -> Bool {
    return q.sync { buffers[key] != nil }
  }

  func loadSound(key: String, uri: String, done: @escaping (Bool) -> Void) {
    if hasSound(key) {
      done(true)
      return
    }
    guard let url = URL(string: uri) else {
      done(false)
      return
    }
    if url.isFileURL {
      loadQ.async {
        let buf = self.decode(url)
        /* 19 okt 2026 (operator, build 38: "hartslaggeluid op max is zacht"):
           de luidsprekerversie zachtjes verzadigd luider (geen hard clippen). */
        if key.hasPrefix("speaker"), let b = buf { self.loudenSoftly(b, drive: 2.2) }
        self.q.async {
          if let b = buf { self.buffers[key] = b }
          done(buf != nil)
        }
      }
      return
    }
    let cached = cacheURL(for: uri, ext: url.pathExtension)
    if FileManager.default.fileExists(atPath: cached.path) {
      loadSound(key: key, uri: cached.absoluteString, done: done)
      return
    }
    let task = URLSession.shared.downloadTask(with: url) { tmp, response, _ in
      guard
        let tmp = tmp,
        let http = response as? HTTPURLResponse,
        (200..<300).contains(http.statusCode)
      else {
        done(false)
        return
      }
      try? FileManager.default.removeItem(at: cached)
      do {
        try FileManager.default.moveItem(at: tmp, to: cached)
      } catch {
        done(false)
        return
      }
      self.loadSound(key: key, uri: cached.absoluteString, done: done)
    }
    task.resume()
  }

  private func cacheURL(for uri: String, ext: String) -> URL {
    let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("vz-session-audio", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    var h: UInt64 = 5381
    for b in uri.utf8 { h = (h &* 33) &+ UInt64(b) }
    let name = String(h, radix: 36) + (ext.isEmpty ? "" : "." + ext)
    return dir.appendingPathComponent(name)
  }

  /// Luider zonder hard te clippen: y = tanh(d·x) / tanh(d). Pieken blijven
  /// onder 0 dBFS, de klank zelf wordt voller op de luidspreker.
  private func loudenSoftly(_ buf: AVAudioPCMBuffer, drive: Float) {
    guard let data = buf.floatChannelData else { return }
    let norm = tanhf(drive)
    let n = Int(buf.frameLength)
    for ch in 0..<Int(buf.format.channelCount) {
      let p = data[ch]
      for i in 0..<n {
        p[i] = tanhf(drive * p[i]) / norm
      }
    }
  }

  /// Bestand → buffer in het vaste formaat van de motor (44,1 kHz mono).
  private func decode(_ url: URL) -> AVAudioPCMBuffer? {
    guard let file = try? AVAudioFile(forReading: url) else { return nil }
    let srcFormat = file.processingFormat
    let frames = AVAudioFrameCount(file.length)
    guard frames > 0, let src = AVAudioPCMBuffer(pcmFormat: srcFormat, frameCapacity: frames) else { return nil }
    do {
      try file.read(into: src)
    } catch {
      return nil
    }
    if srcFormat.sampleRate == format.sampleRate && srcFormat.channelCount == format.channelCount
      && srcFormat.commonFormat == format.commonFormat && !srcFormat.isInterleaved
    {
      return src
    }
    guard let conv = AVAudioConverter(from: srcFormat, to: format) else { return nil }
    conv.downmix = true
    let ratio = format.sampleRate / srcFormat.sampleRate
    let capacity = AVAudioFrameCount(Double(src.frameLength) * ratio) + 4096
    guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else { return nil }
    var fed = false
    var error: NSError?
    let status = conv.convert(to: out, error: &error) { _, inputStatus in
      if fed {
        inputStatus.pointee = .endOfStream
        return nil
      }
      fed = true
      inputStatus.pointee = .haveData
      return src
    }
    if status == .error || out.frameLength == 0 { return nil }
    return out
  }

  // MARK: - Stem

  func playVoice(key: String, volume: Float, offsetSec: Double = 0) -> Bool {
    return q.sync { () -> Bool in
      guard let full = buffers[key] else { return false }
      /* Vooraan stilte overslaan als de zin anders niet in een korte fase
         past (19 okt 2026, zie src/data/voice-cue-timing.ts). */
      let buf = tail(of: full, fromSec: offsetSec) ?? full
      let durMs = Double(buf.frameLength) / format.sampleRate * 1000
      voiceActiveUntil = nowMs() + durMs + 500
      guard ensureEngine() else { return false }
      voiceNode.stop()
      voiceNode.volume = max(0, min(1, volume))
      voiceNode.scheduleBuffer(buf, at: nil, options: [], completionHandler: nil)
      voiceNode.play()
      return true
    }
  }

  /// Het stuk van de buffer vanaf fromSec (nil = vanaf het begin houden).
  private func tail(of buf: AVAudioPCMBuffer, fromSec: Double) -> AVAudioPCMBuffer? {
    guard fromSec > 0.01 else { return nil }
    let start = AVAudioFrameCount(fromSec * format.sampleRate)
    guard start < buf.frameLength else { return nil }
    let count = buf.frameLength - start
    guard
      let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: count),
      let src = buf.floatChannelData,
      let dst = out.floatChannelData
    else { return nil }
    for ch in 0..<Int(format.channelCount) {
      dst[ch].update(from: src[ch].advanced(by: Int(start)), count: Int(count))
    }
    out.frameLength = count
    return out
  }

  func stopVoice() {
    q.async {
      self.voiceActiveUntil = 0
      self.voiceNode.stop()
      if self.attached && self.engine.isRunning { self.voiceNode.play() }
      self.stopEngineIfIdle()
    }
  }

  // MARK: - Hartslag

  func startBeats(_ r: BeatPlanRecord) {
    let p = BeatPlan(
      firstBeatAtMs: r.firstBeatAtMs,
      firstCurveSec: r.firstCurveSec,
      startBpm: r.startBpm,
      targetBpm: r.targetBpm,
      holdSec: r.holdSec,
      rampSec: r.rampSec,
      endAtMs: r.endAtMs,
      sound: r.sound,
      speakerVolume: Float(r.speakerVolume),
      headphonesVolume: Float(r.headphonesVolume),
      soundLeadMs: r.soundLeadMs,
      haptics: r.haptics,
      lubIntensity: Float(r.lubIntensity),
      lubSharpness: Float(r.lubSharpness),
      dubIntensity: Float(r.dubIntensity),
      dubSharpness: Float(r.dubSharpness)
    )
    q.async {
      self.clearBeats()
      self.plan = p
      self.resetIteration()
      if self.wantsAudio {
        guard self.ensureEngine() else { return }
      } else {
        self.startTimer()
      }
      if p.haptics { _ = self.ensureHaptic() }
      self.pump()
    }
  }

  /// 31 okt 2026: het horloge neemt de trilling over — de tikken van dit
  /// plan stoppen, het geluid loopt ongestoord door op hetzelfde rooster
  /// (opnieuw inplannen brak de lopende slag af: lub zonder dub).
  func setBeatHaptics(_ on: Bool) {
    q.async {
      guard var p = self.plan else { return }
      p.haptics = on
      self.plan = p
      if !on {
        for pl in self.beatHapticPlayers {
          try? pl.stop(atTime: CHHapticTimeImmediate)
        }
        self.beatHapticPlayers = []
      }
    }
  }

  func stopBeats() {
    q.async {
      self.clearBeats()
      self.plan = nil
      self.stopEngineIfIdle()
    }
  }

  /// Vergeet alles wat al ingepland stond (geluid en tikken).
  private func clearBeats() {
    if attached {
      for n in beatNodes { n.stop() }
    }
    if attached && engine.isRunning {
      for n in beatNodes { n.play() }
    }
    for p in beatHapticPlayers {
      try? p.stop(atTime: CHHapticTimeImmediate)
    }
    beatHapticPlayers = []
    scheduledUntilMs = 0
  }

  /// Zet de teller op de eerste slag die nog moet komen (vanaf het begin van
  /// het plan doorgerekend — exact hetzelfde rooster als het beeld in JS).
  private func resetIteration() {
    guard let p = plan else { return }
    nextAtMs = p.firstBeatAtMs
    nextCurveSec = p.firstCurveSec
    scheduledUntilMs = 0
    let now = nowMs()
    var guardCount = 0
    while nextAtMs < now - 30 && guardCount < 200_000 {
      let c = p.cycleMs(atCurve: nextCurveSec)
      nextAtMs += c
      nextCurveSec += c / 1000
      guardCount += 1
    }
  }

  private func isHeadphones() -> Bool {
    let types: Set<AVAudioSession.Port> = [.headphones, .bluetoothA2DP, .bluetoothLE, .bluetoothHFP, .usbAudio]
    return AVAudioSession.sharedInstance().currentRoute.outputs.contains { types.contains($0.portType) }
  }

  /// Plant de slagen tot `lookaheadMs` vooruit.
  private func pump() {
    guard let p = plan else { return }
    let now = nowMs()
    /* Plan pas vergeten als ook de laatste ingeplande slag gespeeld is;
       anders kan stopEngineIfIdle() de laatste ~1,5 s afkappen. */
    if p.endAtMs > 0 && now >= p.endAtMs + 1000 {
      plan = nil
      return
    }
    let horizon = now + lookaheadMs
    let hp = isHeadphones()
    let lubBuf = p.sound ? buffers[hp ? "headphonesLub" : "speakerLub"] : nil
    let dubBuf = p.sound ? buffers[hp ? "headphonesDub" : "speakerDub"] : nil
    let volume = hp ? p.headphonesVolume : p.speakerVolume
    /* Uitvoervertraging van de luidspreker/oortjes: het geluid zoveel
       vroeger inplannen, zodat het samen met de tik en de cirkel valt. */
    /* 31 okt 2026: plus de Sound timing-correctie van het huidige
       Bluetooth-toestel (oortjes melden hun vertraging niet altijd juist). */
    let outLatencyMs = AVAudioSession.sharedInstance().outputLatency * 1000 + SoundTiming.correctionMs()
    let withHaptics = p.haptics && appActive && ensureHaptic()

    while nextAtMs < horizon {
      if p.endAtMs > 0 && nextAtMs >= p.endAtMs { break }
      let cycle = p.cycleMs(atCurve: nextCurveSec)
      let dubAt = p.dubAtMs(cycleMs: cycle)
      let beatAt = nextAtMs
      if beatAt > scheduledUntilMs && beatAt >= now - 30 {
        let lead = p.soundLeadMs + outLatencyMs
        if let b = lubBuf { scheduleSound(b, atMs: beatAt - lead, volume: volume, now: now) }
        if let b = dubBuf { scheduleSound(b, atMs: beatAt + dubAt - lead, volume: volume, now: now) }
        if withHaptics { scheduleBeatHaptic(atMs: beatAt, dubAtMs: dubAt, plan: p, now: now) }
        scheduledUntilMs = beatAt
      }
      nextAtMs += cycle
      nextCurveSec += cycle / 1000
    }
  }

  private func scheduleSound(_ buf: AVAudioPCMBuffer, atMs: Double, volume: Float, now: Double) {
    guard !beatNodes.isEmpty, attached, engine.isRunning else { return }
    let node = beatNodes[nextBeatNode % beatNodes.count]
    nextBeatNode = (nextBeatNode + 1) % beatNodes.count
    node.volume = max(0, min(1, volume))
    let when = AVAudioTime(hostTime: hostTime(atMs: atMs, now: now))
    node.scheduleBuffer(buf, at: when, options: [], completionHandler: nil)
    if !node.isPlaying { node.play() }
  }

  // MARK: - Tikken (Core Haptics, enkel met de app in beeld)

  private func ensureHaptic() -> Bool {
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return false }
    if haptic == nil {
      do {
        let e = try CHHapticEngine()
        /* Enkel tikken: de geluidssessie blijft van de motor hierboven. */
        e.playsHapticsOnly = true
        e.isAutoShutdownEnabled = true
        e.stoppedHandler = { [weak self] _ in
          self?.q.async { [weak self] in self?.hapticRunning = false }
        }
        e.resetHandler = { [weak self] in
          self?.q.async { [weak self] in
            self?.hapticRunning = false
            self?.beatHapticPlayers = []
            self?.tapPlayers = []
          }
        }
        haptic = e
      } catch {
        return false
      }
    }
    guard let e = haptic else { return false }
    if !hapticRunning {
      do {
        try e.start()
        hapticRunning = true
      } catch {
        return false
      }
    }
    return true
  }

  private func transient(_ intensity: Float, _ sharpness: Float, at rel: Double) -> CHHapticEvent {
    return CHHapticEvent(
      eventType: .hapticTransient,
      parameters: [
        CHHapticEventParameter(parameterID: .hapticIntensity, value: max(0, min(1, intensity))),
        CHHapticEventParameter(parameterID: .hapticSharpness, value: max(0, min(1, sharpness))),
      ],
      relativeTime: max(0, rel)
    )
  }

  private func scheduleBeatHaptic(atMs: Double, dubAtMs: Double, plan p: BeatPlan, now: Double) {
    guard let e = haptic else { return }
    var events: [CHHapticEvent] = []
    if p.lubIntensity > 0 { events.append(transient(p.lubIntensity, p.lubSharpness, at: 0)) }
    if p.dubIntensity > 0 { events.append(transient(p.dubIntensity, p.dubSharpness, at: dubAtMs / 1000)) }
    if events.isEmpty { return }
    do {
      let pattern = try CHHapticPattern(events: events, parameters: [])
      let player = try e.makePlayer(with: pattern)
      try player.start(atTime: e.currentTime + max(0, (atMs - now) / 1000))
      beatHapticPlayers.append(player)
      if beatHapticPlayers.count > 12 {
        beatHapticPlayers.removeFirst(beatHapticPlayers.count - 12)
      }
    } catch {
      hapticRunning = false
    }
  }

  /// Losse tikken (ademfasen, onboarding): ms na `startAtMs`.
  func playTaps(startAtMs: Double, taps: [SessionTapRecord]) {
    let list = taps.map { ($0.t, Float($0.intensity), Float($0.sharpness)) }
    q.async {
      self.stopTapsNow()
      guard self.appActive, self.ensureHaptic(), let e = self.haptic else { return }
      let events = list.filter { $0.1 > 0 }.map { self.transient($0.1, $0.2, at: $0.0 / 1000) }
      if events.isEmpty { return }
      do {
        let pattern = try CHHapticPattern(events: events, parameters: [])
        let player = try e.makePlayer(with: pattern)
        let delay = max(0, (startAtMs - self.nowMs()) / 1000)
        try player.start(atTime: e.currentTime + delay)
        self.tapPlayers.append(player)
      } catch {
        self.hapticRunning = false
      }
    }
  }

  func stopTaps() {
    q.async { self.stopTapsNow() }
  }

  private func stopTapsNow() {
    for p in tapPlayers {
      try? p.stop(atTime: CHHapticTimeImmediate)
    }
    tapPlayers = []
  }

  func hapticsSupported() -> Bool {
    return CHHapticEngine.capabilitiesForHardware().supportsHaptics
  }
}

/// Sound timing (31 okt 2026, operator: "het moet voor alle toestellen met
/// bluetooth connectie werken"): per Bluetooth-uitgang een correctie in ms
/// bovenop wat het toestel meldt, ingesteld door meetikken op de slag.
enum SoundTiming {
  private static let defaultsKey = "vz.audioCorrections"
  private static let btPorts: Set<AVAudioSession.Port> = [.bluetoothA2DP, .bluetoothLE, .bluetoothHFP]

  static func currentBluetooth() -> AVAudioSessionPortDescription? {
    return AVAudioSession.sharedInstance().currentRoute.outputs.first { btPorts.contains($0.portType) }
  }

  static func key(for port: AVAudioSessionPortDescription) -> String {
    return "bt:" + port.uid
  }

  private static func all() -> [String: Double] {
    return (UserDefaults.standard.dictionary(forKey: defaultsKey) as? [String: Double]) ?? [:]
  }

  /// Correctie van de huidige uitgang (0 op luidspreker/bedraad of zonder instelling).
  static func correctionMs() -> Double {
    guard let port = currentBluetooth() else { return 0 }
    return all()[key(for: port)] ?? 0
  }

  static func device() -> [String: Any]? {
    guard let port = currentBluetooth() else { return nil }
    let k = key(for: port)
    let stored = all()[k]
    return [
      "key": k,
      "name": port.portName,
      "reportedMs": max(0, min(450, AVAudioSession.sharedInstance().outputLatency * 1000)),
      "correctionMs": stored ?? 0,
      "calibrated": stored != nil,
    ]
  }

  static func set(_ k: String, _ ms: Double) {
    var d = all()
    d[k] = max(-200, min(400, ms))
    UserDefaults.standard.set(d, forKey: defaultsKey)
  }

  static func clear(_ k: String) {
    var d = all()
    d.removeValue(forKey: k)
    UserDefaults.standard.set(d, forKey: defaultsKey)
  }
}

public class SessionAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SessionAudio")

    /* 20 okt 2026 (operator: "voor elke gebruiker correct"): extra
       geluidsvertraging van de huidige uitgang t.o.v. de ingebouwde
       luidspreker/bedrade oortjes — Bluetooth/AirPlay (AirPods ~150–250 ms,
       per toestel anders). 0 op de ingebouwde uitgangen: daarop is alles
       afgestemd. */
    Function("outputExtraMs") { () -> Double in
      let s = AVAudioSession.sharedInstance()
      let builtIn: Set<AVAudioSession.Port> = [.builtInSpeaker, .builtInReceiver, .headphones, .lineOut, .usbAudio]
      let outs = s.currentRoute.outputs
      if outs.isEmpty || outs.allSatisfy({ builtIn.contains($0.portType) }) { return 0 }
      return max(0, min(600, min(450, s.outputLatency * 1000) + SoundTiming.correctionMs()))
    }

    Function("audioOutputDevice") { () -> [String: Any]? in
      return SoundTiming.device()
    }

    Function("setAudioCorrection") { (key: String, ms: Double) in
      SoundTiming.set(key, ms)
    }

    Function("clearAudioCorrection") { (key: String) in
      SoundTiming.clear(key)
    }

    Function("hapticsSupported") { () -> Bool in
      return SessionAudioEngine.shared.hapticsSupported()
    }

    Function("begin") { (owner: String) in
      SessionAudioEngine.shared.begin(owner)
    }

    Function("end") { (owner: String) in
      SessionAudioEngine.shared.end(owner)
    }

    Function("releaseSession") { () in
      SessionAudioEngine.shared.releaseSession()
    }

    Function("hasSound") { (key: String) -> Bool in
      return SessionAudioEngine.shared.hasSound(key)
    }

    AsyncFunction("loadSound") { (key: String, uri: String, promise: Promise) in
      SessionAudioEngine.shared.loadSound(key: key, uri: uri) { ok in
        promise.resolve(ok)
      }
    }

    Function("playVoice") { (key: String, volume: Double, offsetSec: Double) -> Bool in
      return SessionAudioEngine.shared.playVoice(key: key, volume: Float(volume), offsetSec: offsetSec)
    }

    Function("stopVoice") { () in
      SessionAudioEngine.shared.stopVoice()
    }

    Function("startBeats") { (plan: BeatPlanRecord) in
      SessionAudioEngine.shared.startBeats(plan)
    }

    Function("stopBeats") { () in
      SessionAudioEngine.shared.stopBeats()
    }

    Function("setBeatHaptics") { (on: Bool) in
      SessionAudioEngine.shared.setBeatHaptics(on)
    }

    Function("playTaps") { (startAtMs: Double, taps: [SessionTapRecord]) in
      SessionAudioEngine.shared.playTaps(startAtMs: startAtMs, taps: taps)
    }

    Function("stopTaps") { () in
      SessionAudioEngine.shared.stopTaps()
    }
  }
}
