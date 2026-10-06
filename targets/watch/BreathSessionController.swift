import Foundation
import WatchKit

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Draait de ademsessie volledig LOKAAL op de Apple Watch.

   Zelfde architectuur als WearBreathSessionService.kt op Wear OS: de
   telefoon stuurt bij START de volledige fase-lijst + rondes in ÉÉN
   bericht, de Watch draait de lus daarna op zijn eigen klok — geen tik per
   fase over WatchConnectivity, dat gaf precies de latency/jitter die dit
   project overal elders als bug behandelt.

   BELANGRIJK, bevestigd tegen Apple's eigen forums (okt 2026): watchOS
   heeft GEEN Core Haptics (CHHapticEngine) — enkel `WKInterfaceDevice.
   play()` met een vaste set van 9 types, geen vrije duur/golfvorm. Dit is
   dus GEEN kopie van de telefoon-textuur (breath-haptics.ts' gladde/
   korrelige trilling), maar een metronoom-vertaling: inademen = snelle
   .directionUp-tikken, uitademen = tragere .directionDown-tikken. Enkel
   "vasthouden" is 1-op-1 hetzelfde (1 tik per seconde) — dat was op de
   telefoon al discreet, niet continu. */

private struct WatchPhase {
  let key: String
  let secs: Int
}

/* 6 okt 2026: geen WCSessionDelegate meer — PhoneConnector.swift is de
   enige delegate en routeert "start"/"stop" hierheen (op main). Tijdens een
   sessie houdt RuntimeSessionManager de app wakker met de pols omlaag. */
final class BreathSessionController: NSObject, ObservableObject {
  static let shared = BreathSessionController()

  @Published var phaseLabel: String = "Waiting for phone…"
  @Published var modeName: String = ""
  @Published var round: Int = 0
  @Published var totalRounds: Int = 0
  @Published var running: Bool = false

  private var phases: [WatchPhase] = []
  private var phaseTimer: Timer?
  private var tickTimer: Timer?
  private var generation = 0

  /** Altijd op main aanroepen (PhoneConnector doet dat). */
  func apply(_ message: [String: Any]) {
    let type = message["type"] as? String ?? "start"
    if type == "stop" {
      stop()
      return
    }
    guard let phasesRaw = message["phases"] as? [[String: Any]] else { return }
    let parsed: [WatchPhase] = phasesRaw.compactMap { p in
      guard let key = p["key"] as? String, let secs = p["secs"] as? Int, secs > 0 else { return nil }
      return WatchPhase(key: key, secs: secs)
    }
    guard !parsed.isEmpty else { return }

    phases = parsed
    totalRounds = max(1, message["rounds"] as? Int ?? 1)
    modeName = message["modeName"] as? String ?? "Breathwork"
    running = true
    RuntimeSessionManager.shared.acquire(.breath)

    generation += 1
    runPhase(gen: generation, round: 1, idx: 0)
  }

  private func runPhase(gen: Int, round: Int, idx: Int) {
    guard gen == generation else { return }
    guard round <= totalRounds else {
      stop()
      return
    }
    let phase = phases[idx]
    phaseLabel = displayLabel(for: phase.key)
    self.round = round
    playHaptics(for: phase.key, secs: phase.secs)

    let nextIdx = (idx + 1) % phases.count
    let nextRound = nextIdx == 0 ? round + 1 : round

    phaseTimer?.invalidate()
    phaseTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(phase.secs), repeats: false) { [weak self] _ in
      self?.runPhase(gen: gen, round: nextRound, idx: nextIdx)
    }
  }

  private func displayLabel(for key: String) -> String {
    switch key {
    case "inhale", "inhale-2": return "Breathe in"
    case "exhale", "exhale-2": return "Breathe out"
    default: return "Hold"
    }
  }

  private func playHaptics(for key: String, secs: Int) {
    switch key {
    case "inhale", "inhale-2":
      scheduleTicks(type: .directionUp, interval: 0.3, duration: secs)
    case "exhale", "exhale-2":
      scheduleTicks(type: .directionDown, interval: 0.45, duration: secs)
    default:
      /* Exact dezelfde telling als TICK_PERIOD in breath-haptics.ts — hier
         wél 1-op-1 reproduceerbaar, want "vasthouden" was op de telefoon al
         een losse tik per seconde, geen continue textuur. */
      scheduleTicks(type: .click, interval: 1.0, duration: secs)
    }
  }

  private func scheduleTicks(type: WKHapticType, interval: TimeInterval, duration: Int) {
    tickTimer?.invalidate()
    let device = WKInterfaceDevice.current()
    device.play(type)
    var elapsed: TimeInterval = 0
    tickTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { timer in
      elapsed += interval
      guard elapsed < TimeInterval(duration) else {
        timer.invalidate()
        return
      }
      device.play(type)
    }
  }

  func stop() {
    generation += 1
    phaseTimer?.invalidate()
    tickTimer?.invalidate()
    running = false
    phaseLabel = "Waiting for phone…"
    modeName = ""
    round = 0
    totalRounds = 0
    RuntimeSessionManager.shared.release(.breath)
  }
}
