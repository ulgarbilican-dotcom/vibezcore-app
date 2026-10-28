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
  /// Nose / Mouth / … zoals in de app; leeg bij vasthouden (12 okt 2026).
  let via: String
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
  @Published var via: String = ""
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
  /// Gepland einde van de hele sessie ("10:08 left" onder de figuur).
  @Published var sessionEnd = Date()
  /// Bij pauze: hoe ver de fase was (boog) en wat er nog over was.
  @Published var pausedPhaseProgress: Double = 0
  @Published var pausedPhaseLeftSec: Double = 0
  @Published var pausedSessionLeftSec: Double = 0
  /// Elke fasewissel = een tik op de pols, voor het scherm.
  let beats = PassthroughSubject<Bool, Never>()
  private var level: Double = 0.3

  private var phases: [WatchPhase] = []
  private var phaseTimer: Timer?
  private var tickTimer: Timer?
  private var generation = 0
  /** Huidige fase-index (voor hervatten van een lokale sessie). */
  private var currentIdx = 0

  /* ── Op het horloge zelf gestart (18 okt 2026) ─────────────────────────
     Het horloge is dan de bron van waarheid: pauze, hervatten en stop
     gebeuren hier; "pause"/"stop" van de iPhone raken zo'n sessie niet. Na
     afloop een `watch_log` naar de iPhone (geschiedenis). */
  private var localKey: String?
  private var localTechKey = ""
  private var localStarted = Date()
  private var localActiveSec: Double = 0
  private var localSegmentStart: Date?
  private var localCompleted = false
  private var localWasFree = false
  private var pausedRound = 1
  private var pausedIdx = 0
  private var pausedRemainingMs = 0
  var isLocal: Bool { localKey != nil }

  /** Altijd op main aanroepen (PhoneConnector doet dat). */
  func apply(_ message: [String: Any]) {
    let type = message["type"] as? String ?? "start"
    let fromPhone = message["local"] as? Bool != true
    if fromPhone && isLocal {
      /* De iPhone start zelf een sessie: die wint, de lokale wordt gelogd. */
      if type != "start" { return }
      finishLocal(completed: false)
    }
    if type == "stop" {
      stop()
      return
    }
    if type == "pause" {
      pauseLocally()
      return
    }
    if let st = message["strength"] as? String { WatchSettings.shared.adoptFromPhone(st) }
    guard let phasesRaw = message["phases"] as? [[String: Any]] else { return }
    let parsed: [WatchPhase] = phasesRaw.compactMap { p in
      guard let key = p["key"] as? String, let secs = p["secs"] as? Int, secs > 0 else { return nil }
      return WatchPhase(key: key, secs: secs, via: p["via"] as? String ?? "")
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

    /* 13 okt 2026: de iPhone zegt wanneer hij dit verstuurde; die vertraging
       gaat van de eerste fase af, zodat de pols tegelijk met de iPhone overgaat.
       28 okt 2026: NIET meer afgekapt op 1,5 s. Opent de gebruiker de Watch-app pas later (de iPhone kan hem niet openen, het bericht
       wacht in applicationContext), dan sprong de Watch terug naar het begin van de fase en liep hij scheef. Nu loopt hij de verstreken tijd
       door fasen en rondes heen, precies naar de plek waar de iPhone nu is; is de sessie al voorbij, dan start er niets. */
    var elapsed: TimeInterval = 0
    if let sentAt = message["sentAtMs"] as? Double, sentAt > 0 {
      /* iPhone-klok → Watch-klok (20 okt 2026, PhoneConnector.measureClock) */
      let sentAtWatch = sentAt + PhoneConnector.shared.clockAheadMs()
      elapsed = max(0, Date().timeIntervalSince1970 - sentAtWatch / 1000)
      /* Tot 4 s = gewone bezorgvertraging: zoals voorheen maximaal 1,5 s (een kleine klokafwijking mag geen fasen laten springen). Pas een
         duidelijk late start (Watch-app later geopend) haalt volledig in. */
      if elapsed <= 4 { elapsed = min(1.5, elapsed) }
    }
    var joinRound = startRound
    var joinIdx = startPhase
    var joinDur = midPhase ? TimeInterval(remainingMs) / 1000 : TimeInterval(phases[startPhase].secs)
    var joinSilent = midPhase
    var joinRemaining = joinDur - elapsed
    while joinRemaining <= 0.15 {
      joinIdx = (joinIdx + 1) % phases.count
      if joinIdx == 0 { joinRound += 1 }
      if joinRound > totalRounds {
        stop()
        return
      }
      joinDur = TimeInterval(phases[joinIdx].secs)
      joinRemaining += joinDur
      joinSilent = false
    }
    let joinElapsedInPhase = joinDur - joinRemaining
    generation += 1
    runPhase(
      gen: generation, round: joinRound, idx: joinIdx,
      start: Date().addingTimeInterval(-joinElapsedInPhase),
      duration: joinDur,
      silentStart: joinSilent
    )
  }

  /// `start`/`duration`: gepland begin en duur — elke fase begint op het
  /// geplande EINDE van de vorige, zodat er over een sessie niets oploopt
  /// (13 okt 2026). `silentStart`: hervatten midden in een fase — die fase
  /// is al getrild, dus enkel de resterende tijd afwachten.
  private func runPhase(gen: Int, round: Int, idx: Int, start: Date, duration: TimeInterval, silentStart: Bool = false) {
    guard gen == generation else { return }
    guard round <= totalRounds else {
      if isLocal { localCompleted = true }
      stop()
      return
    }
    let phase = phases[idx]
    currentIdx = idx
    phaseLabel = displayLabel(for: phase.key)
    via = phase.via
    self.round = round
    if !silentStart {
      /* Een inhaalstart (ver in het verleden) hoort niet in de timingstatistiek. */
      if abs(Date().timeIntervalSince(start)) < 2 { WatchTiming.shared.record(planned: start) }
      playHaptics(for: phase.key, secs: phase.secs)
      beats.send(true)
    }
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
    phaseStart = start
    phaseEnd = start.addingTimeInterval(duration)
    level = target
    /* Rest van deze ronde na deze fase + de volgende rondes. */
    let cycle = phases.reduce(0) { $0 + $1.secs }
    let restOfRound = phases.suffix(from: idx + 1).reduce(0) { $0 + $1.secs }
    sessionEnd = phaseEnd.addingTimeInterval(TimeInterval(restOfRound + max(0, totalRounds - round) * cycle))

    let nextIdx = (idx + 1) % phases.count
    let nextRound = nextIdx == 0 ? round + 1 : round

    phaseTimer?.invalidate()
    let end = phaseEnd
    let nextDur = TimeInterval(phases[nextIdx].secs)
    let t = Timer(fire: end, interval: 0, repeats: false) { [weak self] _ in
      self?.runPhase(gen: gen, round: nextRound, idx: nextIdx, start: end, duration: nextDur)
    }
    t.tolerance = 0
    RunLoop.main.add(t, forMode: .common)
    phaseTimer = t
  }

  private func displayLabel(for key: String) -> String {
    switch key {
    case "inhale", "inhale-2": return "Inhale"
    case "exhale", "exhale-2": return "Exhale"
    default: return "Hold"
    }
  }

  /* 19 okt 2026 (operator: "in, uit en hold moeten elk een eigen tik hebben —
     de gebruiker moet zonder kijken weten wat hij doet"). Elke fase een eigen,
     herkenbaar patroon, enkel stille tikken (geen toon):
       inademen  = doorlopend tikken zolang je inademt
       vasthouden = één tik bij de start, dan stilte
       uitademen = dubbele tik bij de start, dan stilte
     Strong maakt elke tik sterker (WatchSettings.tap). */
  /* Elke fase een eigen, voelbaar patroon (zie WatchSettings.play). Tikken
     minstens 0,5 s uit elkaar (watchOS laat snellere vallen) en timers
     zonder speling in .common, zodat het ritme ook met gedimd scherm klopt. */
  private func playHaptics(for key: String, secs: Int) {
    tickTimer?.invalidate()
    let s = WatchSettings.shared
    /* 27 okt 2026 (operator, TestFlight: "de haptics bij inhale, exhale en hold lijken niet logisch opgebouwd; zonder kijken weet ik niet wat ik moet doen",
       "bij uitademen amper iets, bij inademen niets"): drie texturen die je op je pols kunt onderscheiden, binnen wat watchOS toestaat
       (geen Core Haptics, tikken minstens 0,5 s uit elkaar):
         inademen   = DICHTE tikken, elke 0,5 s, zolang je inademt (het "opbouwen")
         uitademen  = TRAGE tikken, elke 1,2 s, zolang je uitademt (het "wegstromen")
         vasthouden = één tik bij de start, dan STILTE (je houdt stil)
       Elke fase begint met haar eigen marker (.directionUp / .directionDown / .start). De toon die Apple bij die types meespeelt valt weg als het
       horloge op stille modus staat — de trilling blijft dan volledig. De tikken ertussen zijn altijd het stille .click. */
    func repeating(every interval: TimeInterval) {
      var elapsed: TimeInterval = 0
      let t = Timer(timeInterval: interval, repeats: true) { timer in
        elapsed += interval
        guard elapsed < TimeInterval(secs) - 0.6 else {
          timer.invalidate()
          return
        }
        s.play(.tick)
      }
      t.tolerance = 0
      RunLoop.main.add(t, forMode: .common)
      tickTimer = t
    }
    if key.hasPrefix("inhale") {
      s.play(.inhale)
      repeating(every: 0.5)
    } else if key.hasPrefix("exhale") {
      s.play(.exhale)
      repeating(every: 1.2)
    } else {
      s.play(.hold)
    }
  }

  // MARK: Eén sessie, twee bedieningen (6 okt 2026) — de iPhone is de bron
  // van waarheid. Pauze en stop gebeuren hier meteen ook al (de pols mag
  // niet blijven tikken als de iPhone even onbereikbaar is); de iPhone
  // bevestigt daarna. Hervatten kan enkel via de iPhone: die stuurt de
  // sessie terug vanaf de juiste plek.

  /** Start een ademsessie op het horloge zelf (catalogus). */
  /// Voorproef van 30 s (19 okt 2026): telt niet mee in de geschiedenis.
  private var localIsPreview = false

  /** Voorproef: dezelfde techniek, zoveel rondes als in ~30 s passen. */
  func startPreview(_ entry: CatalogBreath, technique: CatalogTechnique) {
    let cycle = technique.phases.reduce(0) { $0 + ((($1["secs"] as? Int) ?? 4)) }
    let rounds = max(1, Int((30.0 / Double(max(1, cycle))).rounded(.up)))
    startLocal(entry, technique: technique, duration: CatalogDuration(id: -1, label: "Preview", minutes: 0, rounds: rounds), free: false)
    localIsPreview = true
  }

  func startLocal(_ entry: CatalogBreath, technique: CatalogTechnique, duration: CatalogDuration, free: Bool) {
    if isLocal { finishLocal(completed: false) }
    localIsPreview = false
    localKey = entry.key
    localTechKey = technique.key
    localStarted = Date()
    localActiveSec = 0
    localSegmentStart = Date()
    localCompleted = false
    localWasFree = free
    apply([
      "type": "start",
      "local": true,
      "phases": technique.phases,
      "rounds": duration.rounds,
      "modeName": entry.name,
      "colorHex": entry.colorHex,
    ])
  }

  private func closeSegment() {
    if let seg = localSegmentStart {
      localActiveSec += Date().timeIntervalSince(seg)
      localSegmentStart = nil
    }
  }

  private func finishLocal(completed: Bool) {
    guard let key = localKey else { return }
    closeSegment()
    localKey = nil
    if localIsPreview {
      localIsPreview = false
      return
    }
    if localWasFree && localActiveSec >= 10 { WatchCatalog.shared.markFreeUsed() }
    WatchSessionLog.send([
      "state": key,
      "techniqueKey": localTechKey,
      "durSec": localActiveSec.rounded(),
      "rounds": max(1, completed ? totalRounds : max(1, round - 1)),
      "completed": completed,
      "endedAt": Date().timeIntervalSince1970 * 1000,
    ])
  }

  func requestPauseOrResume() {
    if isLocal {
      if paused {
        localSegmentStart = Date()
        resumeLocal()
      } else {
        closeSegment()
        let remaining = max(0, phaseEnd.timeIntervalSinceNow)
        pausedRound = max(1, round)
        pausedIdx = currentIdx
        pausedRemainingMs = Int(remaining * 1000)
        pauseLocally()
      }
      return
    }
    let action = paused ? "resume" : "pause"
    PhoneConnector.shared.send(["type": "watch_action", "action": action, "kind": "breath"])
    if action == "pause" { pauseLocally() }
  }

  func requestStop() {
    if isLocal {
      stop()
      return
    }
    PhoneConnector.shared.send(["type": "watch_action", "action": "stop", "kind": "breath"])
    stop()
  }

  private func resumeLocal() {
    guard paused, !phases.isEmpty else { return }
    apply([
      "type": "start",
      "local": true,
      "phases": phases.map { p -> [String: Any] in ["key": p.key, "secs": p.secs, "via": p.via] },
      "rounds": totalRounds,
      "modeName": modeName,
      "colorHex": colorHex,
      "startRound": pausedRound,
      "startPhase": pausedIdx,
      "phaseRemainingMs": pausedRemainingMs,
    ])
  }

  func pauseLocally() {
    guard running else { return }
    generation += 1
    phaseTimer?.invalidate()
    tickTimer?.invalidate()
    let now = Date()
    let span0 = max(0.001, phaseEnd.timeIntervalSince(phaseStart))
    pausedPhaseProgress = min(1, max(0, now.timeIntervalSince(phaseStart) / span0))
    pausedPhaseLeftSec = max(0, phaseEnd.timeIntervalSince(now))
    pausedSessionLeftSec = max(0, sessionEnd.timeIntervalSince(now))
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
    WatchTiming.shared.commit()
    if isLocal { finishLocal(completed: localCompleted) }
    localCompleted = false
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
