import Foundation
import WatchKit

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Houdt de Watch-app wakker met de pols omlaag (6 okt 2026).

   Zonder dit schorst watchOS de app zodra de pols zakt: Timers stoppen en
   de tikken vallen weg. Een `WKExtendedRuntimeSession` laat de app op de
   achtergrond doorlopen. Het sessietype komt NIET uit code maar uit
   Info.plist: `WKBackgroundModes = [mindfulness]` (targets/watch/
   Info.plist) — Apple's type voor adem-/stilte-sessies: max. 1 uur, de app
   mag tijdens die sessie haptiek spelen met het scherm uit.

   Regels van Apple waar dit rekening mee houdt:
   - Starten kan ENKEL terwijl de app actief (voorgrond) is. Komt een
     sessie binnen terwijl de app op de achtergrond staat (bv. via de
     userInfo-wachtrij bij het openen), dan wordt het starten uitgesteld
     tot `appDidBecomeActive()`. Tot dan speelt de app enkel zolang hij
     zelf wakker is.
   - Een sessie-object is eenmalig: na invalidate altijd een nieuw maken.
   - Max. 1 uur: de langste State Control-modus (Sleep, 50 min) past.

   Twee eigenaars kunnen de runtime nodig hebben (breathwork en State
   Control). De sessie loopt zolang minstens één van beide hem vasthoudt. */

enum RuntimeOwner: Hashable {
  case breath
  case state
}

final class RuntimeSessionManager: NSObject, WKExtendedRuntimeSessionDelegate {
  static let shared = RuntimeSessionManager()

  private var session: WKExtendedRuntimeSession?
  private var owners = Set<RuntimeOwner>()

  /** Wordt (op main) aangeroepen als de runtime echt loopt / verloren gaat. */
  var onRunningChanged: ((Bool) -> Void)?

  var isRunning: Bool {
    session?.state == .running
  }

  // Altijd vanaf de main queue aanroepen.
  func acquire(_ owner: RuntimeOwner) {
    owners.insert(owner)
    startIfPossible()
  }

  func release(_ owner: RuntimeOwner) {
    owners.remove(owner)
    guard owners.isEmpty, let current = session else { return }
    session = nil
    if current.state != .invalid {
      current.invalidate()
    }
  }

  /** Vanuit de App (scenePhase → .active): een uitgestelde start inhalen. */
  func appDidBecomeActive() {
    startIfPossible()
  }

  private func startIfPossible() {
    guard !owners.isEmpty else { return }
    /* Ook `.notStarted` telt als levend: start() is al gevraagd, de
       bevestiging (didStart) kan nog onderweg zijn. */
    if let current = session, current.state != .invalid {
      return
    }
    guard WKApplication.shared().applicationState == .active else {
      /* Achtergrond: Apple weigert hier een start. Inhalen bij activatie. */
      return
    }
    let fresh = WKExtendedRuntimeSession()
    fresh.delegate = self
    session = fresh
    fresh.start()
  }

  // MARK: WKExtendedRuntimeSessionDelegate (callbacks → main)

  func extendedRuntimeSessionDidStart(_ extendedRuntimeSession: WKExtendedRuntimeSession) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self, extendedRuntimeSession === self.session else { return }
      self.onRunningChanged?(true)
    }
  }

  func extendedRuntimeSessionWillExpire(_ extendedRuntimeSession: WKExtendedRuntimeSession) {
    /* Het uur is bijna om. Niets te doen: de langste sessie past erin; bij
       een overschrijding valt de app gewoon terug op voorgrond-gedrag. */
  }

  func extendedRuntimeSession(
    _ extendedRuntimeSession: WKExtendedRuntimeSession,
    didInvalidateWith reason: WKExtendedRuntimeSessionInvalidationReason,
    error: Error?
  ) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self, extendedRuntimeSession === self.session else { return }
      self.session = nil
      /* Onverwacht kwijt (verlopen, systeem, fout) terwijl iemand hem nog
         nodig heeft. Niet meteen herstarten: bij `.error` (bv. ontbrekende
         WKBackgroundModes) zou dat een lus geven. Wel opnieuw proberen bij
         de volgende activatie van de app. */
      self.onRunningChanged?(false)
    }
  }
}
