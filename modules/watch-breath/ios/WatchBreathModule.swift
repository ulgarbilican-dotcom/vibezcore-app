import ExpoModulesCore
import WatchConnectivity

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — De brug van de telefoon naar een gekoppelde Apple Watch.

   Stuurt de VOLLEDIGE sessie (fasen + rondes + modusnaam) in ÉÉN bericht —
   zelfde principe als WearBreathModule.kt voor Wear OS. `sendMessage` als
   de Watch-app op dit moment bereikbaar is (live, laagste latency);
   anders `updateApplicationContext` als wachtende "laatste stand" die de
   Watch-app bij zijn volgende activatie alsnog ophaalt. Geen van beide
   paden mag de telefoon-sessie zelf kunnen laten crashen — alles hier is
   stil-falend, net als breath-background/wear-breath. */

public class WatchBreathModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WatchBreath")

    OnCreate {
      WatchBridge.shared.activate()
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
  }
}

final class WatchBridge: NSObject, WCSessionDelegate {
  static let shared = WatchBridge()

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
}
