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

    Events("onWatchAction", "onStateAck")

    OnCreate {
      WatchBridge.shared.activate()
      WatchBridge.shared.onAction = { [weak self] action, kind in
        self?.sendEvent("onWatchAction", ["action": action, "kind": kind])
      }
      WatchBridge.shared.onStateAck = { [weak self] in
        self?.sendEvent("onStateAck", ["playing": true])
      }
    }

    AsyncFunction("isWatchReachable") { () -> Bool in
      WCSession.isSupported() && WCSession.default.isReachable
    }

    Function("sendBreathSession") { (session: [String: Any]) in
      WatchBridge.shared.sendSession(session)
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
  }
}

final class WatchBridge: NSObject, WCSessionDelegate {
  static let shared = WatchBridge()

  /** (action: "pause"|"resume"|"stop", kind: "breath"|"bracelet") */
  var onAction: ((String, String) -> Void)?
  /** De Watch speelt het State Control-ritme echt (`state_ack`). */
  var onStateAck: (() -> Void)?

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
  ) {}

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
