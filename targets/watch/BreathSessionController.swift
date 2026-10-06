import Combine
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
  /// Gepauzeerd (op iPhone of Watch): het ritme staat stil, de knop toont Resume.
  @Published var paused: Bool = false
  /// Kleur van de toestand (6 okt 2026, zelfde look als de app).
  @Published var colorHex: String = "#00A3A3"
  /// Waterpeil van..tot over de lopende fase: inademen stijgt, uitademen
  /// zakt, vasthouden blijft.
  @Published var levelFrom: Double = 0.3
  @Published var levelTo: Double = 0.3
  @Published var phaseStart = Date()
  @Published var phaseEnd = Date()
  /// Elke fasewissel = een tik op de pols, voor het scherm.
  let beats = PassthroughSubject<Bool, Never>()
  private var level: Double = 0.3

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
    if type == "pause" {
      pauseLocally()
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
    colorHex = message["colorHex"] as? String ?? "#00A3A3"
    running = true
    paused = false
    RuntimeSessionManager.shared.acquire(.breath)

    /* Hervatten (6 okt 2026): verder op exact de plek waar de iPhone
       pauzeerde — ronde, fase en wat er van die fase nog over was. */
    let startRound = min(max(1, message["startRound"] as? Int ?? 1), totalRounds)
    let startPhase = min(max(0, message["startPhase"] as? Int ?? 0), phases.count - 1)
    let remainingMs = message["phaseRemainingMs"] as? Int ?? -1
    let midPhase = remainingMs >= 0 && remainingMs < phases[startPhase].secs * 1000

    generation += 1
    runPhase(
      gen: generation, round: startRound, idx: startPhase,
      firstDelay: midPhase ? TimeInterval(remainingMs) / 1000 : nil
    )
  }

  /// `firstDelay`: hervatten midden in een fase — die fase is al getrild,
  /// dus enkel de resterende tijd afwachten.
  private func runPhase(gen: Int, round: Int, idx: Int, firstDelay: TimeInterval? = nil) {
    guard gen == generation else { return }
    guard round <= totalRounds else {
      stop()
      return
    }
    let phase = phases[idx]
    phaseLabel = displayLabel(for: phase.key)
    self.round = round
    if firstDelay == nil {
      playHaptics(for: phase.key, secs: phase.secs)
      beats.send(true)
    }
    let duration = firstDelay ?? TimeInterval(phase.secs)
    let target: Double
    if phase.key.hasPrefix("inhale") {
      target = 0.85
    } else if phase.key.hasPrefix("exhale") {
      target = 0.18
    } else {
      target = level
    }
    levelFrom = level
    levelTo = target
    phaseStart = Date()
    phaseEnd = phaseStart.addingTimeInterval(duration)
    level = target

    let nextIdx = (idx + 1) % phases.count
    let nextRound = nextIdx == 0 ? round + 1 : round

    phaseTimer?.invalidate()
    phaseTimer = Timer.scheduledTimer(withTimeInterval: firstDelay ?? TimeInterval(phase.secs), repeats: false) { [weak self] _ in
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

  // MARK: Eén sessie, twee bedieningen (6 okt 2026) — de iPhone is de bron
  // van waarheid. Pauze en stop gebeuren hier meteen ook al (de pols mag
  // niet blijven tikken als de iPhone even onbereikbaar is); de iPhone
  // bevestigt daarna. Hervatten kan enkel via de iPhone: die stuurt de
  // sessie terug vanaf de juiste plek.

  func requestPauseOrResume() {
    let action = paused ? "resume" : "pause"
    PhoneConnector.shared.send(["type": "watch_action", "action": action, "kind": "breath"])
    if action == "pause" { pauseLocally() }
  }

  func requestStop() {
    PhoneConnector.shared.send(["type": "watch_action", "action": "stop", "kind": "breath"])
    stop()
  }

  func pauseLocally() {
    guard running else { return }
    generation += 1
    phaseTimer?.invalidate()
    tickTimer?.invalidate()
    running = false
    paused = true
    phaseLabel = "Paused"
    /* Het water blijft staan waar het nu is. */
    let span = max(0.001, phaseEnd.timeIntervalSince(phaseStart))
    let k = min(1, max(0, Date().timeIntervalSince(phaseStart) / span))
    level = levelFrom + (levelTo - levelFrom) * k
    levelFrom = level
    levelTo = level
    RuntimeSessionManager.shared.release(.breath)
  }

  func stop() {
    generation += 1
    phaseTimer?.invalidate()
    tickTimer?.invalidate()
    running = false
    paused = false
    phaseLabel = "Waiting for phone…"
    modeName = ""
    round = 0
    totalRounds = 0
    RuntimeSessionManager.shared.release(.breath)
  }
}
