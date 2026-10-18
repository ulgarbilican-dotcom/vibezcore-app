// VIBEZCORE — iPhone-hartslag voor State Control: tik én geluid samen, op
// exact geplande momenten (operator, 18 okt 2026: "de synchroniteit van
// heartbeat en haptic animatie moet perfect").
//
// Waarom: op de iPhone vuurde een JavaScript-timer elke slag af en vroeg dan
// apart een tik (UIImpactFeedbackGenerator) en een geluid (AVPlayer: terug-
// spoelen + spelen) aan — beide via de hoofdthread, die ook het beeld tekent.
// Gevolg: geluid telkens wat later dan de tik, en bij een drukke hoofdthread
// haperde alles. Hier plant JavaScript elke slag ~250 ms VOORAF met het
// geplande wandklok-moment; Core Haptics speelt tik en geluid als één
// patroon op dat moment af (Apple synchroniseert ze zelf), los van JS en
// van de hoofdthread. De cirkel krijgt hetzelfde moment (HapticPulse.atMs).
//
// Op de achtergrond (vergrendeld) speelt een iPhone geen tikken; dan neemt de
// JS-weg het over met geluid via de achtergrondaudio (bracelet-haptics.ts).
//
// NIET GETEST OP EEN TOESTEL: geschreven op Windows, zonder Xcode. De eerste
// iOS-build bevestigt het. Faalt iets, dan valt de app terug op de JS-weg.

import AVFoundation
import CoreHaptics
import ExpoModulesCore
import Foundation

struct BeatSoundsRecord: Record {
  @Field var speakerLub: String = ""
  @Field var speakerDub: String = ""
  @Field var headphonesLub: String = ""
  @Field var headphonesDub: String = ""
}

struct BeatEventRecord: Record {
  /// Milliseconden na het slagmoment.
  @Field var t: Double = 0
  /// 0 = geen tik.
  @Field var intensity: Double = 0
  @Field var sharpness: Double = 0.5
  /// "" = geen geluid; anders een sleutel uit BeatSoundsRecord.
  @Field var sound: String = ""
  @Field var volume: Double = 1
}

struct BeatRecord: Record {
  /// Wandklok (ms sinds 1970) van het slagmoment — zelfde klok als Date.now() in JS.
  @Field var atMs: Double = 0
  @Field var events: [BeatEventRecord] = []
}

public class BeatEngineModule: Module {
  private let queue = DispatchQueue(label: "com.vibezcore.beatengine", qos: .userInteractive)
  private var engine: CHHapticEngine?
  private var running = false
  private var soundURLs: [String: URL] = [:]
  private var resources: [String: CHHapticAudioResourceID] = [:]
  /// Spelers bewaren tot ze klaar zijn (en om ze bij een stop te kunnen stoppen).
  private var players: [CHHapticPatternPlayer] = []

  public func definition() -> ModuleDefinition {
    Name("BeatEngine")

    Function("isSupported") { () -> Bool in
      return CHHapticEngine.capabilitiesForHardware().supportsHaptics
    }

    AsyncFunction("prepare") { (sounds: BeatSoundsRecord) -> Bool in
      return self.queue.sync { () -> Bool in
        var urls: [String: URL] = [:]
        let pairs: [(String, String)] = [
          ("speakerLub", sounds.speakerLub),
          ("speakerDub", sounds.speakerDub),
          ("headphonesLub", sounds.headphonesLub),
          ("headphonesDub", sounds.headphonesDub),
        ]
        for (key, uri) in pairs {
          if let url = URL(string: uri), url.isFileURL {
            urls[key] = url
          }
        }
        if urls != self.soundURLs {
          self.soundURLs = urls
          self.resources = [:]
        }
        return self.ensureEngine()
      }
    }

    Function("schedule") { (beat: BeatRecord) in
      self.queue.async {
        self.play(beat)
      }
    }

    Function("stop") { () in
      self.queue.async {
        self.stopAll()
      }
    }
  }

  // MARK: - Motor

  /// Maakt (indien nodig) de motor aan, start hem en registreert de geluiden.
  /// Enkel aanroepen op `queue`.
  @discardableResult
  private func ensureEngine() -> Bool {
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return false }
    if engine == nil {
      do {
        let e = try CHHapticEngine(audioSession: AVAudioSession.sharedInstance())
        e.playsHapticsOnly = false
        // Zelf uit als hij niets speelt, en vanzelf weer aan bij een volgend
        // patroon: de motor mag de gewone Apple-tikken in de rest van de app
        // nooit blokkeren (operator, build 26: onboarding-tikken weg).
        e.isAutoShutdownEnabled = true
        e.stoppedHandler = { [weak self] _ in
          self?.queue.async {
            self?.running = false
          }
        }
        e.resetHandler = { [weak self] in
          self?.queue.async {
            guard let strong = self else { return }
            strong.running = false
            strong.resources = [:]
            strong.players = []
            _ = strong.startEngine()
          }
        }
        engine = e
      } catch {
        return false
      }
    }
    return startEngine()
  }

  /// Enkel aanroepen op `queue`.
  private func startEngine() -> Bool {
    guard let e = engine else { return false }
    if !running {
      do {
        try e.start()
        running = true
      } catch {
        return false
      }
    }
    if resources.isEmpty {
      for (key, url) in soundURLs {
        if let id = try? e.registerAudioResource(url, options: [:]) {
          resources[key] = id
        }
      }
    }
    return true
  }

  // MARK: - Slagen

  /// Enkel aanroepen op `queue`.
  private func play(_ beat: BeatRecord) {
    guard ensureEngine(), let e = engine else { return }
    var events: [CHHapticEvent] = []
    for ev in beat.events {
      let rel = max(0, ev.t / 1000.0)
      if ev.intensity > 0 {
        events.append(
          CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
              CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(min(1, ev.intensity))),
              CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(min(1, max(0, ev.sharpness)))),
            ],
            relativeTime: rel
          )
        )
      }
      if !ev.sound.isEmpty, let id = resources[ev.sound] {
        events.append(
          CHHapticEvent(
            audioResourceID: id,
            parameters: [
              CHHapticEventParameter(parameterID: .audioVolume, value: Float(min(1, max(0, ev.volume)))),
            ],
            relativeTime: rel
          )
        )
      }
    }
    if events.isEmpty { return }
    do {
      let pattern = try CHHapticPattern(events: events, parameters: [])
      let player = try e.makePlayer(with: pattern)
      let nowMs = Date().timeIntervalSince1970 * 1000
      // Te laat (JS of de motor haperde): de slag overslaan i.p.v. naast het
      // ritme spelen (operator, build 26: "hartslag volgt soms het ritme niet").
      if beat.atMs < nowMs - 30 { return }
      let delay = max(0, (beat.atMs - nowMs) / 1000)
      try player.start(atTime: e.currentTime + delay)
      players.append(player)
      if players.count > 12 {
        players.removeFirst(players.count - 12)
      }
    } catch {
      // Volgende slag probeert de motor opnieuw te starten.
      running = false
    }
  }

  /// Enkel aanroepen op `queue`.
  private func stopAll() {
    for p in players {
      try? p.stop(atTime: CHHapticTimeImmediate)
    }
    players = []
  }
}
