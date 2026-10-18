import ExpoModulesCore
import WatchConnectivity

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — De brug tussen telefoon en een gekoppelde Apple Watch.

   Twee richtingen:
   1. Telefoon → Watch: volledige breathwork-sessie (fasen+rondes, ÉÉN
      bericht, Watch draait zelf verder) ÓF periodieke bracelet-status
      (kleur/naam/resterende tijd/paused — de Watch toont enkel, de ECHTE
      sessie draait op de bracelet-hardware via BLE).
   2. Watch → Telefoon (NIEUW, 4 okt 2026): een tik op Pause/Resume/Stop op
      het horloge. Komt hier binnen als `onWatchAction`-event, JS
      (breath-session.tsx / bracelet-control.tsx) beslist wat dat betekent
      voor de eigen sessie (lokaal pauzeren, of een echt BLE-commando naar
      de bracelet sturen).

   3. State Control-ritme (6 okt 2026, docs/WATCH_PROTOCOL.md): state_start
      / state_pause / state_stop naar de Watch, state_ack terug
      (`onStateAck`). Eigen transport, zie sendStateStart hieronder.

   Breathwork/status: `sendMessage` als de Watch-app op dit moment
   bereikbaar is (live, laagste latency); anders `updateApplicationContext`
   als wachtende "laatste stand". Geen van beide paden mag de telefoon-sessie zelf kunnen laten
   crashen — alles hier is stil-falend, net als breath-background/
   wear-breath. */

public class WatchBreathModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WatchBreath")

    Events("onWatchAction", "onStateAck", "onWatchLog")

    OnCreate {
      WatchBridge.shared.activate()
      WatchBridge.shared.onAction = { [weak self] action, kind in
        self?.sendEvent("onWatchAction", ["action": action, "kind": kind])
      }
      WatchBridge.shared.onStateAck = { [weak self] in
        self?.sendEvent("onStateAck", ["playing": true])
      }
      WatchBridge.shared.onLog = { [weak self] record in
        self?.sendEvent("onWatchLog", ["record": record])
      }
    }

    AsyncFunction("isWatchReachable") { () -> Bool in
      WCSession.isSupported() && WCSession.default.isReachable
    }

    /* 14 okt 2026 (audit, iOS = Android): de status voor de "Smartwatch"-
       regel in Audio & Haptics. "none" = geen gekoppelde Apple Watch,
       "noApp" = wel een Watch maar zonder VIBEZCORE, "ready" = alles klaar.
       WatchConnectivity geeft de naam van de Watch niet prijs. */
    AsyncFunction("watchStatus") { () -> [String: String] in
      guard WCSession.isSupported() else { return ["status": "none", "name": ""] }
      let s = WCSession.default
      if s.activationState != .activated || !s.isPaired { return ["status": "none", "name": ""] }
      if !s.isWatchAppInstalled { return ["status": "noApp", "name": "Apple Watch"] }
      return ["status": "ready", "name": "Apple Watch"]
    }

    Function("sendBreathSession") { (session: [String: Any]) in
      WatchBridge.shared.sendSession(session)
    }

    Function("pauseBreathSession") {
      WatchBridge.shared.pauseSession()
    }

    Function("stopBreathSession") {
      WatchBridge.shared.stopSession()
    }

    /** status: { title, colorHex, remainingMinutes, paused, active } —
     *  zie BraceletStatus in bracelet-control.tsx. Licht gewicht, bedoeld
     *  om elke ~5s meegestuurd te worden met de bestaande BLE-statuspoll. */
    Function("sendBraceletStatus") { (status: [String: Any]) in
      WatchBridge.shared.sendBraceletStatus(status)
    }

    Function("stopBraceletRelay") {
      WatchBridge.shared.stopBraceletRelay()
    }

    /* State Control-ritme op de pols (docs/WATCH_PROTOCOL.md). `start` =
       StateSessionStart uit index.ts; de Watch speelt de curve zelf af. */
    Function("sendStateSession") { (start: [String: Any]) in
      WatchBridge.shared.sendStateStart(start)
    }

    Function("pauseStateSession") {
      WatchBridge.shared.sendStatePause()
    }

    Function("stopStateSession") {
      WatchBridge.shared.sendStateStop()
    }

    /* Catalogus voor zelf starten op het horloge (18 okt 2026), zelfde JSON
       als voor Wear OS (watch-catalog.ts). */
    Function("syncCatalog") { (json: String) in
      WatchBridge.shared.sendCatalog(json)
    }
  }
}

final class WatchBridge: NSObject, WCSessionDelegate {
  static let shared = WatchBridge()

  /** (action: "pause"|"resume"|"stop", kind: "breath"|"bracelet") */
  var onAction: ((String, String) -> Void)?
  /** De Watch speelt het State Control-ritme echt (`state_ack`). */
  var onStateAck: (() -> Void)?
  /** Een sessie die op het horloge zelf liep (JSON-record). */
  var onLog: ((String) -> Void)?
  private var lastCatalog = ""
  /** Laatst verstuurde catalogus (om dubbels te vermijden). */
  private var sentCatalog = ""

  /* Catalogus: live als bereikbaar, anders via de FIFO-wachtrij; een
     nieuwere catalogus annuleert een nog niet afgeleverde oudere. Niet via
     de application context — die is van breathwork.
     18 okt 2026 (operator: "app geopend maar watch gebeurt niets"): de JS
     stuurt de catalogus bij het opstarten, vóór WCSession geactiveerd is.
     Die werd toen enkel onthouden en nooit verstuurd — nu opnieuw zodra de
     sessie actief wordt, de Watch-app geïnstalleerd raakt of bereikbaar is. */
  func sendCatalog(_ json: String) {
    lastCatalog = json
    flushCatalog(force: false)
  }

  func flushCatalog(force: Bool) {
    guard WCSession.isSupported(), !lastCatalog.isEmpty else { return }
    let json = lastCatalog
    let session = WCSession.default
    guard session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else { return }
    if !force && json == sentCatalog { return }
    sentCatalog = json
    /* 18 okt 2026 (operator: "werkt niet"): de catalogus is groter dan wat
       WatchConnectivity per bericht toelaat (±64 KB) en werd stil geweigerd.
       Nu als BESTAND (geen grootte-limiet, ook op de achtergrond afgeleverd),
       en enkel als hij klein genoeg is ook live als bericht. */
    for transfer in session.outstandingUserInfoTransfers {
      if (transfer.userInfo["type"] as? String) == "catalog" { transfer.cancel() }
    }
    for transfer in session.outstandingFileTransfers {
      if (transfer.file.metadata?["type"] as? String) == "catalog" { transfer.cancel() }
    }
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("vz-catalog-\(Int(Date().timeIntervalSince1970 * 1000)).json")
    if (try? json.write(to: url, atomically: true, encoding: .utf8)) != nil {
      session.transferFile(url, metadata: ["type": "catalog"])
    }
    if session.isReachable, json.utf8.count < 50_000 {
      session.sendMessage(["type": "catalog", "json": json], replyHandler: nil, errorHandler: nil)
    }
  }

  private let stampLock = NSLock()
  private var lastStateStampMs: Double = 0

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func sendSession(_ payload: [String: Any]) {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
    var message = payload
    message["type"] = "start"
    deliver(message)
  }

  /* Pauze (6 okt 2026): de Watch stopt het ritme en toont Resume. Hervatten
     = een nieuwe "start" met de plek in de sessie (startRound/startPhase/
     phaseRemainingMs), die gaan vanzelf mee in `sendSession`. */
  func pauseSession() {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
    deliver(["type": "pause"])
  }

  func stopSession() {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
    deliver(["type": "stop"])
  }

  func sendBraceletStatus(_ status: [String: Any]) {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
    var message = status
    message["type"] = "bracelet_status"
    deliver(message)
  }

  func stopBraceletRelay() {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
    deliver(["type": "bracelet_stop"])
  }

  /* ── State Control (6 okt 2026) ──────────────────────────────────────
     Waarom NIET via updateApplicationContext: die bewaart enkel de LAATSTE
     context. Breathwork en de bracelet-statuspoll schrijven daar al in, dus
     een state_pause/stop kon daar achter een breath-bericht verdwijnen (en
     omgekeerd). State-berichten gaan daarom live via `sendMessage`, en als
     terugval via `transferUserInfo`: een FIFO-wachtrij die elk bericht
     apart en in volgorde aflevert, ook als de Watch-app pas later opent.
     De application context blijft zo exclusief voor breathwork.

     Elk state-bericht krijgt `sentAtMs` (telefoonklok, strikt stijgend):
     - de Watch negeert een bericht dat ouder is dan het laatst toegepaste
       (sendMessage en een later afgeleverde userInfo kunnen elkaar
       inhalen);
     - een laat afgeleverde start wordt bijgesteld (remainingSec en
       curveOffsetSec schuiven op met de vertraging), of genegeerd als de
       sessie intussen al voorbij is.
     Een nieuwe start of stop annuleert nog niet afgeleverde state-
     berichten: die zijn achterhaald. */

  func sendStateStart(_ start: [String: Any]) {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
    cancelPendingStateTransfers()
    var message = start
    message["type"] = "state_start"
    deliverState(message)
  }

  func sendStatePause() {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
    deliverState(["type": "state_pause"])
  }

  func sendStateStop() {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
    cancelPendingStateTransfers()
    deliverState(["type": "state_stop"])
  }

  private func nextStateStamp() -> Double {
    stampLock.lock()
    defer { stampLock.unlock() }
    let now = (Date().timeIntervalSince1970 * 1000).rounded()
    lastStateStampMs = max(now, lastStateStampMs + 1)
    return lastStateStampMs
  }

  private func deliverState(_ payload: [String: Any]) {
    var message = payload
    message["sentAtMs"] = nextStateStamp()
    let session = WCSession.default
    if session.isReachable {
      session.sendMessage(message, replyHandler: nil) { [weak self] _ in
        self?.transferState(message)
      }
    } else {
      transferState(message)
    }
  }

  private func transferState(_ message: [String: Any]) {
    let session = WCSession.default
    /* Zonder gekoppelde Watch met de app erop groeit de wachtrij anders
       eindeloos aan. */
    guard session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else {
      return
    }
    session.transferUserInfo(message)
  }

  private func cancelPendingStateTransfers() {
    for transfer in WCSession.default.outstandingUserInfoTransfers {
      if let type = transfer.userInfo["type"] as? String, type.hasPrefix("state_") {
        transfer.cancel()
      }
    }
  }

  private func deliver(_ message: [String: Any]) {
    let session = WCSession.default
    if session.isReachable {
      session.sendMessage(message, replyHandler: nil) { [weak self] _ in
        self?.queue(message)
      }
    } else {
      queue(message)
    }
  }

  /* Wachtrij van ÉÉN: de laatst bekende stand. Een "stop" die een nog niet
     opgehaalde "start" overschrijft is een bewuste, acceptabele grens —
     dit pad is voor de uitzondering (Watch-app niet actief), niet de
     hoofdflow (allebei open tijdens sessiestart). */
  private func queue(_ message: [String: Any]) {
    guard WCSession.default.activationState == .activated else { return }
    try? WCSession.default.updateApplicationContext(message)
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if activationState == .activated {
      DispatchQueue.main.async { [weak self] in self?.flushCatalog(force: true) }
    }
  }

  /* Watch-app net geïnstalleerd / gekoppeld, of het horloge opent de app. */
  func sessionWatchStateDidChange(_ session: WCSession) {
    DispatchQueue.main.async { [weak self] in self?.flushCatalog(force: true) }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    guard session.isReachable else { return }
    DispatchQueue.main.async { [weak self] in self?.flushCatalog(force: true) }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  /* NIEUW: Watch → Telefoon. Verwacht { action: "pause"|"resume"|"stop",
     kind: "breath"|"bracelet" } — zie BreathSessionController.swift
     (Watch-kant) voor de verzendende helft. */
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handleFromWatch(message)
  }

  /* Terugval-pad van de Watch (transferUserInfo) als de telefoon op het
     moment van de tik niet bereikbaar was. */
  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    handleFromWatch(userInfo)
  }

  private func handleFromWatch(_ message: [String: Any]) {
    if (message["type"] as? String) == "catalog_request" {
      DispatchQueue.main.async { [weak self] in self?.flushCatalog(force: true) }
      return
    }
    if (message["type"] as? String) == "watch_log", let record = message["record"] as? String {
      DispatchQueue.main.async { [weak self] in
        self?.onLog?(record)
      }
      return
    }
    if (message["type"] as? String) == "state_ack" {
      /* Enkel `playing: true` telt (protocol). De Watch stuurt `false` als
         hij het ritme onverwacht kwijt is (runtime-sessie verlopen); daar
         heeft het protocol nog geen telefoon-reactie voor. */
      guard (message["playing"] as? Bool) ?? true else { return }
      DispatchQueue.main.async { [weak self] in
        self?.onStateAck?()
      }
      return
    }
    guard
      let action = message["action"] as? String,
      let kind = message["kind"] as? String
    else { return }
    DispatchQueue.main.async { [weak self] in
      self?.onAction?(action, kind)
    }
  }
}
