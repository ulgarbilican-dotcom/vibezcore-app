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

  private var lastError = "none"
  private var lastReceived = "none"

  func diagnostics() -> String {
    guard WCSession.isSupported() else { return "unsupported" }
    let s = WCSession.default
    return "act=\(s.activationState.rawValue) iphoneApp=\(s.isCompanionAppInstalled) reach=\(s.isReachable) last=\(lastReceived) err=\(lastError)"
  }

  // MARK: Klokverschil (20 okt 2026)

  /* Operator: "het moet voor ELKE gebruiker correct lopen". De iPhone stuurt
     zijn klok mee (sentAtMs); een Apple Watch loopt meestal gelijk, maar
     niet gegarandeerd. Gemeten zoals NTP: een paar pings, de iPhone
     antwoordt met zijn klok, de kortste rondreis is de nauwkeurigste. */
  private let clockAheadKey = "vz_clock_ahead_ms"
  private let clockAtKey = "vz_clock_measured_at"
  private var measuringClock = false
  private var lastClockStart: TimeInterval = 0

  /** Klokverschil Watch − iPhone in ms (0 zolang er geen recente meting is). */
  func clockAheadMs() -> Double {
    let d = UserDefaults.standard
    let at = d.double(forKey: clockAtKey)
    guard at > 0, Date().timeIntervalSince1970 - at < 6 * 3600 else { return 0 }
    return d.double(forKey: clockAheadKey)
  }

  func measureClock() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    let now = Date().timeIntervalSince1970
    guard session.activationState == .activated, session.isReachable,
      !measuringClock, now - lastClockStart > 20
    else { return }
    measuringClock = true
    lastClockStart = now
    var bestRtt = Double.greatestFiniteMagnitude
    var bestAhead: Double?
    for i in 0..<5 {
      DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.12) {
        let t0 = Date().timeIntervalSince1970 * 1000
        session.sendMessage(["type": "clock_ping"], replyHandler: { reply in
          let t1 = Date().timeIntervalSince1970 * 1000
          guard let phone = reply["phoneMs"] as? Double else { return }
          DispatchQueue.main.async {
            let rtt = t1 - t0
            guard rtt >= 0, rtt < 400, rtt < bestRtt else { return }
            bestRtt = rtt
            bestAhead = (t0 + t1) / 2 - phone
          }
        }, errorHandler: nil)
      }
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
      if let ahead = bestAhead {
        UserDefaults.standard.set(ahead, forKey: self.clockAheadKey)
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: self.clockAtKey)
      }
      self.measuringClock = false
    }
  }

  func requestCatalog() {
    if WCSession.default.activationState != .activated { WCSession.default.activate() }
    send(["type": "catalog_request"])
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
  ) {
    lastError = error.map { "\($0.localizedDescription)" } ?? "none"
    /* Bij het openen de catalogus vragen (18 okt 2026): zo krijgt het
       horloge de lijst ook als de iPhone hem nog niet kon sturen. */
    guard activationState == .activated else { return }
    DispatchQueue.main.async {
      self.send(["type": "catalog_request"])
      self.measureClock()
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    route(message)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    route(applicationContext)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    route(userInfo)
  }

  /* Catalogus als bestand (18 okt 2026): te groot voor een bericht. Het
     bestand verdwijnt na deze functie — dus hier meteen lezen. */
  func session(_ session: WCSession, didReceive file: WCSessionFile) {
    guard (file.metadata?["type"] as? String) == "catalog",
      let json = try? String(contentsOf: file.fileURL, encoding: .utf8)
    else { return }
    lastReceived = "catalog-file"
    DispatchQueue.main.async {
      WatchCatalog.shared.load(json)
    }
  }

  private func route(_ message: [String: Any]) {
    lastReceived = message["type"] as? String ?? "start"
    DispatchQueue.main.async {
      /* elk bericht = de iPhone-app draait → klok (opnieuw) meten, voor de
         volgende start (begrensd tot 1× per 20 s; niets wacht erop) */
      defer { self.measureClock() }
      let type = message["type"] as? String ?? "start"
      switch type {
      case "state_start", "state_pause", "state_stop":
        StateSessionController.shared.apply(type: type, message: message)
      case "start", "stop", "pause":
        BreathSessionController.shared.apply(message)
      case "catalog":
        /* Catalogus voor zelf starten op het horloge (18 okt 2026). */
        if let json = message["json"] as? String { WatchCatalog.shared.load(json) }
      default:
        break
      }
    }
  }
}
