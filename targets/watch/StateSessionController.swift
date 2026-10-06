import Combine
import Foundation
import SwiftUI
import WatchKit

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control-ritme op de Apple Watch (6 okt 2026).

   docs/WATCH_PROTOCOL.md is bindend; de formule hieronder is een letterlijke
   vertaling van bpmAt/beatAt/buildWaveform in src/services/bracelet-
   haptics.ts:

     bpmAt(t)  = t < hold ? 75 : 75 + (target − 75) · min(1, (t − hold)/ramp)
                 (ramp 0 → meteen het eindtempo)
     cycleMs   = round(60000 / bpmAt(t))
     dubAt     = round(min(cycleMs · 0.3, 350))
     t schuift per slag op met cycleMs/1000 s.
     Einde: zodra de volgende slag op of na remainingSec zou vallen —
     600 ms stilte, dan drie oplopende tikken (0 · +190 · +400 ms).

   Geen drift: elke tik wordt gepland op een absolute datum
   (`anchor + (t − offset)`), niet "x ms na de vorige". Liep de app achter
   (scherm aan/uit, systeem druk), dan springt hij stil naar de slag van NU
   in plaats van de gemiste tikken als salvo af te spelen — zelfde gedrag
   als scheduleVisual() op de telefoon.

   watchOS-beperking: geen amplitude- of duursturing, enkel de vaste
   WKHapticType-set. lubAmp/dubAmp/lubMsNoAmp/dubMsNoAmp worden daarom
   genegeerd; lub en dub zijn allebei `.click`, het zachtste type.

   Lub-dub-keuze: twee `.click`s dichter dan ~200 ms bij elkaar worden op
   watchOS niet betrouwbaar als twee tikken gevoeld (de Taptic Engine
   versmelt of laat de tweede vallen). dubAt ligt tussen 164 ms (Boost,
   110 bpm) en 350 ms (de trage modi). Per SESSIE wordt beslist: als dubAt
   ergens in de curve onder MIN_DUB_GAP_MS zakt, speelt de hele sessie enkel
   de lub (nooit halverwege wisselen). In de praktijk: Boost = enkel lub,
   Sharp Focus (dubAt 200 ms) en de trage modi = lub-dub. Op een echt
   horloge na te voelen; de drempel is één constante. */

private enum Rhythm {
  static let restingBpm = 75.0
  static let lubDubFraction = 0.3
  static let lubDubMaxMs = 350.0
  /** Onder deze afstand speelt de sessie enkel de lub (zie boven). */
  static let minDubGapMs = 200.0
  static let endSilenceMs = 600.0
  /** Protocol: 70 ms tik · 120 ms stilte · 90 ms tik · 120 ms stilte · 160 ms tik. */
  static let endTapOffsetsMs: [Double] = [0, 190, 400]
  static let endTapTypes: [WKHapticType] = [.click, .directionUp, .success]
  /** Na de laatste eind-tik even laten uitklinken voor het opruimen. */
  static let endTailMs = 700.0
  /** Lokaal hervatten (telefoon onbereikbaar): binnen 2 min loopt de curve
   *  door, daarna opnieuw vanaf de basislijn — zelfde regel als de telefoon. */
  static let resumeWindowSec = 120.0
}

private struct StateParams {
  let title: String
  let colorHex: String
  let targetBpm: Double
  let holdSec: Double
  let rampSec: Double

  func bpmAt(_ t: Double) -> Double {
    if t < holdSec { return Rhythm.restingBpm }
    let progress = rampSec <= 0 ? 1 : min(1, (t - holdSec) / rampSec)
    return Rhythm.restingBpm + (targetBpm - Rhythm.restingBpm) * progress
  }

  /** (cycleMs, dubAtMs) — afgerond zoals Math.round in JS (positieve
   *  getallen: .toNearestOrAwayFromZero = half naar boven). */
  func beatAt(_ t: Double) -> (cycleMs: Double, dubAt: Double) {
    let cycleMs = (60000 / bpmAt(t)).rounded()
    let dubAt = min(cycleMs * Rhythm.lubDubFraction, Rhythm.lubDubMaxMs).rounded()
    return (cycleMs, dubAt)
  }

  /** Kleinste dubAt over de hele curve: het snelste tempo (het hoogste van
   *  75 en het eindtempo) geeft de kortste cyclus. */
  var minDubAtMs: Double {
    let fastest = max(Rhythm.restingBpm, targetBpm)
    let cycleMs = (60000 / fastest).rounded()
    return min(cycleMs * Rhythm.lubDubFraction, Rhythm.lubDubMaxMs).rounded()
  }
}

final class StateSessionController: ObservableObject {
  static let shared = StateSessionController()

  /// Elke echte tik op de pols, voor het scherm (true = lub, false = dub).
  let beats = PassthroughSubject<Bool, Never>()
  /// Totale duur van deze sessie (langste resterende tijd), voor het waterpeil.
  @Published private(set) var totalSec: Double = 0

  /** Een State Control-sessie is bekend (spelend of gepauzeerd). */
  @Published private(set) var active = false
  @Published private(set) var paused = false
  @Published private(set) var title = ""
  @Published private(set) var color = Color(red: 0, green: 0.64, blue: 0.64)
  /** Natuurlijk einde (enkel geldig als spelend). */
  @Published private(set) var endDate: Date?
  /** Resterende tijd, bevroren tijdens pauze. */
  @Published private(set) var pausedRemainingSec: Double = 0

  private var params: StateParams?
  /** Wandklok-moment waarop de curve op `offsetSec` stond. */
  private var anchor = Date()
  private var offsetSec: Double = 0
  /** Curve-tijd van de volgende lub. */
  private var nextBeatT: Double = 0
  private var remainingSec: Double = 0
  private var playDub = true
  private var pausedAt: Date?
  private var pausedCurveSec: Double = 0

  private var beatTimer: Timer?
  private var dubTimer: Timer?
  private var endTimers: [Timer] = []
  private var generation = 0
  /** Laatst toegepaste `sentAtMs` van de telefoon (volgorde-bewaking). */
  private var lastAppliedStamp: Double = 0
  /** Ack al verstuurd voor de huidige start? */
  private var ackedCurrentStart = false

  init() {
    RuntimeSessionManager.shared.onRunningChanged = { [weak self] running in
      self?.runtimeChanged(running)
    }
  }

  // MARK: Berichten van de telefoon (altijd op main)

  func apply(type: String, message: [String: Any]) {
    /* Volgorde: sendMessage en een later afgeleverde userInfo kunnen elkaar
       inhalen. Een ouder (of dubbel) bericht dan het laatst toegepaste
       wordt genegeerd. */
    let stamp = number(message["sentAtMs"])
    if let stamp = stamp {
      if stamp <= lastAppliedStamp { return }
      lastAppliedStamp = stamp
    }
    switch type {
    case "state_start":
      start(message, sentAtMs: stamp)
    case "state_pause":
      pause()
    case "state_stop":
      stop()
    default:
      break
    }
  }

  private func start(_ message: [String: Any], sentAtMs: Double?) {
    guard
      let targetBpm = number(message["targetBpm"]), targetBpm > 0,
      let remaining = number(message["remainingSec"])
    else { return }
    let holdSec = max(0, number(message["holdSec"]) ?? 10)
    let rampSec = max(0, number(message["rampSec"]) ?? 0)
    var curveOffset = max(0, number(message["curveOffsetSec"]) ?? 0)
    var remainingSec = remaining

    /* Laat afgeleverd (userInfo-wachtrij): de sessie liep op de telefoon
       intussen door. Negatieve vertraging = klokverschil → negeren. */
    if let sentAtMs = sentAtMs {
      let delaySec = max(0, Date().timeIntervalSince1970 - sentAtMs / 1000)
      curveOffset += delaySec
      remainingSec -= delaySec
    }
    guard remainingSec > 0.5 else {
      /* Al voorbij tegen de tijd dat het hier aankwam. */
      stop()
      return
    }

    let p = StateParams(
      title: message["title"] as? String ?? "State Control",
      colorHex: message["colorHex"] as? String ?? "#00A3A3",
      targetBpm: targetBpm,
      holdSec: holdSec,
      rampSec: rampSec
    )
    play(p, curveOffsetSec: curveOffset, remainingSec: remainingSec)
  }

  private func play(_ p: StateParams, curveOffsetSec: Double, remainingSec: Double) {
    cancelTimers()
    generation += 1
    if !active || title != p.title { totalSec = 0 }
    totalSec = max(totalSec, remainingSec)
    params = p
    title = p.title
    color = Color(hex: p.colorHex) ?? color
    playDub = p.minDubAtMs >= Rhythm.minDubGapMs
    anchor = Date()
    offsetSec = curveOffsetSec
    nextBeatT = curveOffsetSec
    self.remainingSec = remainingSec
    endDate = anchor.addingTimeInterval(remainingSec)
    pausedAt = nil
    paused = false
    active = true
    ackedCurrentStart = false

    RuntimeSessionManager.shared.acquire(.state)
    scheduleNextBeat(gen: generation)
    ackIfRuntimeRunning()
  }

  /** Telefoon zegt pauze (of lokale terugval): tikken stoppen, sessie
   *  vasthouden. De runtime-sessie BLIJFT lopen, zodat de app wakker blijft
   *  en een hervat-bericht (nieuwe state_start) live kan binnenkomen. */
  func pause() {
    guard active, !paused else { return }
    let now = Date()
    pausedCurveSec = offsetSec + now.timeIntervalSince(anchor)
    pausedRemainingSec = max(0, endDate?.timeIntervalSince(now) ?? 0)
    cancelTimers()
    generation += 1
    endDate = nil
    pausedAt = now
    paused = true
  }

  func stop() {
    cancelTimers()
    generation += 1
    params = nil
    active = false
    paused = false
    endDate = nil
    pausedAt = nil
    pausedRemainingSec = 0
    title = ""
    ackedCurrentStart = false
    RuntimeSessionManager.shared.release(.state)
  }

  // MARK: Knoppen op het horloge — telefoon is de bron van waarheid

  func requestPauseOrResume() {
    let action = paused ? "resume" : "pause"
    PhoneConnector.shared.send(
      ["type": "watch_action", "action": action, "kind": "bracelet"],
      onUndeliverable: { [weak self] in
        /* Telefoon nu niet bereikbaar: lokaal toepassen, zodat de pols
           niet blijft tikken (of stil blijft) tot de wachtrij aankomt. De
           telefoon stuurt daarna zelf de juiste state-berichten. */
        guard let self = self else { return }
        if action == "pause" { self.pause() } else { self.resumeLocally() }
      }
    )
  }

  func requestStop() {
    PhoneConnector.shared.send(
      ["type": "watch_action", "action": "stop", "kind": "bracelet"],
      onUndeliverable: { [weak self] in self?.stop() }
    )
  }

  private func resumeLocally() {
    guard active, paused, let p = params, let pausedAt = pausedAt else { return }
    let pausedFor = Date().timeIntervalSince(pausedAt)
    let curve = pausedFor > Rhythm.resumeWindowSec ? 0 : pausedCurveSec
    play(p, curveOffsetSec: curve, remainingSec: pausedRemainingSec)
  }

  // MARK: Ritme

  private func wallDate(forCurve t: Double) -> Date {
    anchor.addingTimeInterval(t - offsetSec)
  }

  private func scheduleNextBeat(gen: Int) {
    guard gen == generation, let p = params else { return }
    /* Valt de volgende slag op of na het einde → eind-signaal. */
    if nextBeatT - offsetSec >= remainingSec {
      scheduleEndSignal(at: wallDate(forCurve: nextBeatT), gen: gen)
      return
    }
    beatTimer = schedule(at: wallDate(forCurve: nextBeatT)) { [weak self] in
      self?.fireBeat(gen: gen, params: p)
    }
  }

  private func fireBeat(gen: Int, params p: StateParams) {
    guard gen == generation else { return }
    let now = Date()
    /* Zo ver achter dat de sessie intussen voorbij is: geen verloren slag
       meer, meteen het eind-signaal. */
    if now >= anchor.addingTimeInterval(remainingSec) {
      scheduleEndSignal(at: now, gen: gen)
      return
    }
    /* Achterstand (app was even niet aan de beurt): stil doorspringen naar
       de slag van nu i.p.v. een salvo. */
    var beat = p.beatAt(nextBeatT)
    while wallDate(forCurve: nextBeatT + beat.cycleMs / 1000) < now,
      nextBeatT + beat.cycleMs / 1000 - offsetSec < remainingSec {
      nextBeatT += beat.cycleMs / 1000
      beat = p.beatAt(nextBeatT)
    }
    let beatDate = wallDate(forCurve: nextBeatT)
    WKInterfaceDevice.current().play(.click)
    beats.send(true)
    if playDub {
      dubTimer = schedule(at: beatDate.addingTimeInterval(beat.dubAt / 1000)) { [weak self] in
        guard let self = self, gen == self.generation else { return }
        WKInterfaceDevice.current().play(.click)
        self.beats.send(false)
      }
    }
    nextBeatT += beat.cycleMs / 1000
    scheduleNextBeat(gen: gen)
  }

  private func scheduleEndSignal(at lastBeatEnd: Date, gen: Int) {
    /* Nooit in het verleden: anders vuren de drie tikken (na een
       achterstand) tegelijk als één klont. */
    let start = max(lastBeatEnd.addingTimeInterval(Rhythm.endSilenceMs / 1000), Date())
    for (i, offsetMs) in Rhythm.endTapOffsetsMs.enumerated() {
      let type = Rhythm.endTapTypes[i]
      endTimers.append(schedule(at: start.addingTimeInterval(offsetMs / 1000)) { [weak self] in
        guard let self = self, gen == self.generation else { return }
        WKInterfaceDevice.current().play(type)
      })
    }
    let doneAt = start.addingTimeInterval(((Rhythm.endTapOffsetsMs.last ?? 0) + Rhythm.endTailMs) / 1000)
    endTimers.append(schedule(at: doneAt) { [weak self] in
      guard let self = self, gen == self.generation else { return }
      /* Natuurlijk einde: de telefoon stuurt geen stop (protocol). */
      self.stop()
    })
  }

  /** Eenmalige Timer op een absolute datum, in de main run loop (ook
   *  tijdens scrollen/tracking: .common). */
  private func schedule(at date: Date, _ block: @escaping () -> Void) -> Timer {
    let timer = Timer(fire: max(date, Date()), interval: 0, repeats: false) { _ in block() }
    timer.tolerance = 0.005
    RunLoop.main.add(timer, forMode: .common)
    return timer
  }

  private func cancelTimers() {
    beatTimer?.invalidate()
    beatTimer = nil
    dubTimer?.invalidate()
    dubTimer = nil
    endTimers.forEach { $0.invalidate() }
    endTimers.removeAll()
  }

  // MARK: Ack naar de telefoon

  /** Enkel ack'en als de runtime-sessie ECHT loopt: anders zou de telefoon
   *  zijn eigen trilling stilleggen terwijl het horloge bij de eerste
   *  pols-omlaag geschorst wordt — en dan voelt niemand nog iets. */
  private func ackIfRuntimeRunning() {
    guard active, !paused, !ackedCurrentStart, RuntimeSessionManager.shared.isRunning else { return }
    ackedCurrentStart = true
    PhoneConnector.shared.send(["type": "state_ack", "playing": true])
  }

  private func runtimeChanged(_ running: Bool) {
    if running {
      ackIfRuntimeRunning()
    } else if active && ackedCurrentStart {
      /* Runtime kwijt (bv. na een uur): het protocol heeft nog geen
         telefoon-reactie hierop; de brug negeert `false`. Wel al melden,
         zodat de telefoon dit later kan oppakken. */
      ackedCurrentStart = false
      PhoneConnector.shared.send(["type": "state_ack", "playing": false])
    }
  }

  private func number(_ value: Any?) -> Double? {
    (value as? NSNumber)?.doubleValue
  }
}

extension Color {
  /** "#RRGGBB" of "RRGGBB". */
  init?(hex: String) {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
    self.init(
      red: Double((v >> 16) & 0xFF) / 255,
      green: Double((v >> 8) & 0xFF) / 255,
      blue: Double(v & 0xFF) / 255
    )
  }
}
