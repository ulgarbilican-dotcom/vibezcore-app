// VIBEZCORE — iOS-kant van de achtergrond-ademsessie.
//
// NIET GETEST OP EEN ECHT TOESTEL. Er is in de ontwikkelomgeving waarin dit
// geschreven is geen Mac/iOS-simulator beschikbaar (Windows-omgeving, geen
// gecommit ios/-map — alleen prebuild/EAS build genereert die). De operator
// moet dit op een fysieke iPhone verifiëren zodra er een iOS-build is.
//
// iOS bevriest de JS-thread NIET zoals Android Doze dat doet: zolang er een
// actief afspelende AVAudioPlayer binnen een achtergrond-audiosessie draait
// (category .playback + UIBackgroundModes: ["audio"] in app.json, zie de
// wijziging daar), houdt iOS het hele proces — inclusief JS-timers — actief.
// Deze module is dus vooral een VANGNET en zorgt voor consistentie met
// Android: dezelfde fase-cyclus/rondes/cue-lead-time-logica als runPhase()
// in breath-session.tsx, zodat cue en haptiek blijven kloppen ook als de
// JS-loop om wat voor reden dan ook een keer hapert.
//
// Haptiek-beperking (zie breath-haptics.ts, dezelfde opmerking daar): iOS
// negeert opgegeven trilduur en maakt van elke stap een vaste puls. Het
// onderscheid tussen fasen staat hier daarom via het AANTAL pulsen, niet de
// duur — een platformgrens, geen bug.

import ExpoModulesCore
import AVFoundation
import UIKit

struct BgPhaseOption: Record {
  @Field var key: String = ""
  @Field var secs: Int = 0
}

struct StartBreathBackgroundOptions: Record {
  @Field var phases: [BgPhaseOption] = []
  @Field var rounds: Int = 0
  @Field var inhaleCueUri: String = ""
  @Field var holdCueUri: String = ""
  @Field var exhaleCueUri: String = ""
  @Field var cueLeadMs: Int = 400
}

public class BreathBackgroundModule: Module {
  private var player: AVAudioPlayer?
  private var cueTimer: Timer?
  private var transitionTimer: Timer?

  private var phases: [BgPhaseOption] = []
  private var rounds: Int = 0
  private var phaseIdx: Int = 0
  private var round: Int = 1
  private var inhaleUri = ""
  private var holdUri = ""
  private var exhaleUri = ""
  private var cueLeadMs: Int = 400

  private let impact = UIImpactFeedbackGenerator(style: .medium)

  public func definition() -> ModuleDefinition {
    Name("BreathBackground")

    Function("startBackgroundBreathSession") { (options: StartBreathBackgroundOptions) in
      self.start(options: options)
    }

    Function("stopBackgroundBreathSession") {
      self.stop()
    }
  }

  private func activateAudioSession() {
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, options: [.mixWithOthers])
      try session.setActive(true)
    } catch {
      // stil — een falende achtergrond-sessie mag de rest van de app niet breken
    }
  }

  /* Hold-in en hold-out delen hun bestand — zelfde regel als cueUriFor()
     aan de Android-kant en playBreathCue() in breath-voice.ts. */
  private func cueUri(forKey key: String) -> String? {
    switch key {
    case "inhale": return inhaleUri
    case "hold-in", "hold-out": return holdUri
    case "exhale": return exhaleUri
    default: return nil
    }
  }

  private func start(options: StartBreathBackgroundOptions) {
    stop()
    guard !options.phases.isEmpty else { return }
    activateAudioSession()

    phases = options.phases
    rounds = options.rounds
    inhaleUri = options.inhaleCueUri
    holdUri = options.holdCueUri
    exhaleUri = options.exhaleCueUri
    cueLeadMs = options.cueLeadMs
    phaseIdx = 0
    round = 1

    // De allereerste cue loopt niet vooruit — er is geen vorige fase.
    // Zelfde uitzondering als in breath-session.tsx: speak(phases[0]) vóór
    // de eerste runPhase()-aanroep.
    playCue(forKey: phases[0].key)
    playHaptic(forKey: phases[0].key, secs: phases[0].secs)
    scheduleTimers(forSecs: phases[0].secs)
  }

  private func stop() {
    cueTimer?.invalidate()
    transitionTimer?.invalidate()
    cueTimer = nil
    transitionTimer = nil
    player?.stop()
    player = nil
    phases = []
    do {
      try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    } catch {
      // stil
    }
  }

  private func scheduleTimers(forSecs secs: Int) {
    cueTimer?.invalidate()
    transitionTimer?.invalidate()

    let leadSec = Double(cueLeadMs) / 1000.0
    let cueDelay = max(0.0, Double(secs) - leadSec)
    let transitionDelay = Double(secs)

    let cue = Timer(timeInterval: cueDelay, repeats: false) { [weak self] _ in
      self?.handleCue()
    }
    let transition = Timer(timeInterval: transitionDelay, repeats: false) { [weak self] _ in
      self?.handleTransition()
    }
    cueTimer = cue
    transitionTimer = transition
    // `.common` i.p.v. `.default`: blijft ook doorlopen tijdens scroll/UI-
    // interactie op het scherm zelf, mocht dat ooit relevant worden.
    RunLoop.main.add(cue, forMode: .common)
    RunLoop.main.add(transition, forMode: .common)
  }

  /** Speelt de cue voor de fase NA de huidige — zelfde `nextOf(k)`-relatie
   *  als runPhase() in breath-session.tsx. */
  private func handleCue() {
    guard !phases.isEmpty else { return }
    let nextIdx = (phaseIdx + 1) % phases.count
    playCue(forKey: phases[nextIdx].key)
  }

  /** Ronde-einde-regel letterlijk overgenomen uit runPhase(): een ronde is
   *  voorbij zodra de LAATSTE fase van de fasenlijst afloopt, niet een
   *  vaste sleutel — dat gold maar voor één van de vijf toestanden. */
  private func handleTransition() {
    guard !phases.isEmpty else { return }
    let isLastOfRound = phaseIdx == phases.count - 1

    if isLastOfRound {
      let newRound = round + 1
      if newRound > rounds {
        stop()
        return
      }
      round = newRound
      phaseIdx = 0
    } else {
      phaseIdx += 1
    }

    let phase = phases[phaseIdx]
    playHaptic(forKey: phase.key, secs: phase.secs)
    scheduleTimers(forSecs: phase.secs)
  }

  private func playCue(forKey key: String) {
    guard let uriStr = cueUri(forKey: key), !uriStr.isEmpty else { return }
    let url: URL?
    if uriStr.hasPrefix("file://") || uriStr.hasPrefix("http://") || uriStr.hasPrefix("https://") {
      url = URL(string: uriStr)
    } else {
      url = URL(fileURLWithPath: uriStr)
    }
    guard let resolvedUrl = url else { return }
    do {
      let p = try AVAudioPlayer(contentsOf: resolvedUrl)
      p.prepareToPlay()
      p.play()
      player = p
    } catch {
      // stil — een haperende cue mag de sessie niet breken
    }
  }

  private func playHaptic(forKey key: String, secs: Int) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      switch key {
      case "inhale":
        // Inademen: één puls, zelfde onderscheid-door-aantal als op Android
        // (daar: doorlopend gladde trilling — hier het dichtstbijzijnde
        // wat UIKit toelaat, één duidelijke tik bij het begin).
        self.impact.impactOccurred()
      case "exhale":
        // Uitademen: een dichte reeks pulsen, verspreid over de fase —
        // zelfde bedoeling als de "korrel" van ripple() in breath-haptics.ts.
        let count = max(2, secs)
        for i in 0..<count {
          let delay = Double(i) * (Double(secs) / Double(count))
          DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            self?.impact.impactOccurred()
          }
        }
      default:
        // Vasthouden: één tik per seconde, zelfde als tickPerSecond().
        let count = max(1, secs)
        for i in 0..<count {
          DispatchQueue.main.asyncAfter(deadline: .now() + Double(i)) { [weak self] in
            self?.impact.impactOccurred()
          }
        }
      }
    }
  }
}
