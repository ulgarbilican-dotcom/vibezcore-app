import Foundation
import WatchConnectivity

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — De ENIGE WCSessionDelegate op de Watch (6 okt 2026).

   Er mag maar één delegate zijn; voorheen was dat BreathSessionController.
   Nu er ook State Control binnenkomt, routeert deze klasse op `type`
   (docs/WATCH_PROTOCOL.md):
     "start" | "stop" | "pause"             → BreathSessionController
     "state_start" | "state_pause" | "state_stop" → StateSessionController
     "bracelet_status" | "bracelet_stop"    → genegeerd (enkel weergave-
                                              relay, hier niet getoond)

   WCSession-callbacks komen op een achtergrond-queue binnen: alles wordt
   naar de main queue gezet, de controllers raken enkel daar hun
   @Published-state en Timers aan.

   Drie binnenkomende paden, allemaal hetzelfde behandeld:
     - sendMessage (live, Watch-app open)
     - applicationContext (breathwork-terugval, enkel de laatste stand)
     - userInfo (state-terugval, FIFO — zie WatchBreathModule.swift) */

final class PhoneConnector: NSObject, WCSessionDelegate {
  static let shared = PhoneConnector()

  func activate() {
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  // MARK: Watch → telefoon

  /** Live als de iPhone bereikbaar is, anders (of bij een fout) via de
   *  FIFO-wachtrij transferUserInfo, die later alsnog aflevert. */
  func send(_ message: [String: Any], onUndeliverable: (() -> Void)? = nil) {
    guard WCSession.isSupported() else {
      onUndeliverable?()
      return
    }
    let session = WCSession.default
    guard session.activationState == .activated else {
      onUndeliverable?()
      return
    }
    if session.isReachable {
      session.sendMessage(message, replyHandler: nil) { _ in
        session.transferUserInfo(message)
        if let onUndeliverable = onUndeliverable {
          DispatchQueue.main.async { onUndeliverable() }
        }
      }
    } else {
      session.transferUserInfo(message)
      onUndeliverable?()
    }
  }

  // MARK: WCSessionDelegate

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {}

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    route(message)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    route(applicationContext)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    route(userInfo)
  }

  private func route(_ message: [String: Any]) {
    DispatchQueue.main.async {
      let type = message["type"] as? String ?? "start"
      switch type {
      case "state_start", "state_pause", "state_stop":
        StateSessionController.shared.apply(type: type, message: message)
      case "start", "stop", "pause":
        BreathSessionController.shared.apply(message)
      default:
        break
      }
    }
  }
}
