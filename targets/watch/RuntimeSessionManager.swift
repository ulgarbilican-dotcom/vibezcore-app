import Foundation
import HealthKit
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
   Control). De sessie loopt zolang minstens één van beide hem vasthoudt.

   1 nov 2026 (iOS build 68, operator: "het horloge neemt pas over na ontgrendelen", "geen haptics tijdens de ademsessie"): een
   mindfulness-sessie kan enkel starten als de app vooraan staat. Opent de iPhone de app terwijl het horloge vergrendeld is
   (startWatchApp), dan startte er niets en sliep de app na de eerste tik. Apple laat haptiek op de achtergrond enkel toe tijdens een
   workout (WKInterfaceDevice.play-documentatie). Daarom nu EERST een "Mind & Body"-workoutsessie: die start ook vanuit startWatchApp met
   het horloge op slot. Er wordt NIETS opgeslagen (geen HKLiveWorkoutBuilder, geen HKWorkout) en niets gelezen. Lukt een workout niet
   (geen toestemming), dan zoals voorheen de mindfulness-sessie. */

enum RuntimeOwner: Hashable {
  case breath
  case state
}

final class RuntimeSessionManager: NSObject, WKExtendedRuntimeSessionDelegate, HKWorkoutSessionDelegate {
  static let shared = RuntimeSessionManager()

  private var session: WKExtendedRuntimeSession?
  private var owners = Set<RuntimeOwner>()
  private let healthStore = HKHealthStore()
  private var workout: HKWorkoutSession?
  /// Workout gestart door de iPhone (startWatchApp) vóór het sessiebericht binnen is: zonder eigenaar na 30 s weer stoppen.
  private var workoutOrphanCheck: DispatchWorkItem?
  /// Na een onverwacht einde/fout niet meteen opnieuw een workout proberen (geen lus): even de mindfulness-sessie.
  private var workoutRetryAfter = Date.distantPast

  /** Wordt (op main) aangeroepen als de runtime echt loopt / verloren gaat. */
  var onRunningChanged: ((Bool) -> Void)?

  var isRunning: Bool {
    workout?.state == .running || session?.state == .running
  }

  /// Wat houdt de app nu wakker? Voor de tijdmeting in Settings (1 nov 2026): "W" = workout, "M" = mindfulness, "-" = niets.
  var modeCode: String {
    if workout?.state == .running { return "W" }
    if session?.state == .running { return "M" }
    return "-"
  }

  // Altijd vanaf de main queue aanroepen.
  func acquire(_ owner: RuntimeOwner) {
    owners.insert(owner)
    workoutOrphanCheck?.cancel()
    startIfPossible()
  }

  func release(_ owner: RuntimeOwner) {
    owners.remove(owner)
    guard owners.isEmpty else { return }
    endWorkout()
    guard let current = session else { return }
    session = nil
    if current.state != .invalid {
      current.invalidate()
    }
  }

  /** Vanuit de App (scenePhase → .active): een uitgestelde start inhalen. */
  func appDidBecomeActive() {
    /* Audit 2 nov 2026 (operator op build 80: na Apple's Health-vraag geen cirkel meer): nooit midden in een sessie vragen — dat blad lag
       over de lopende sessie. De iPhone vraagt het al bij de start; zonder sessie mag het horloge het zelf vragen. */
    if owners.isEmpty { requestWorkoutAuthorizationIfNeeded() }
    startIfPossible()
  }

  /* 1 nov 2026: zonder toestemming voor Workouts geen workoutsessie, en zonder workout geen haptiek met de pols omlaag (Apple). Bij het
     openen van de horloge-app één keer vragen als het nog niet beslist is; daarna de lopende sessie alsnog naar een workout tillen. */
  private var askedWorkoutAuth = false
  func requestWorkoutAuthorizationIfNeeded() {
    guard HKHealthStore.isHealthDataAvailable(), !askedWorkoutAuth,
      healthStore.authorizationStatus(for: HKObjectType.workoutType()) == .notDetermined
    else { return }
    askedWorkoutAuth = true
    healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: nil) { [weak self] granted, _ in
      guard granted else { return }
      DispatchQueue.main.async { self?.upgradeToWorkout() }
    }
  }

  /** Loopt er al een sessie op de mindfulness-runtime, dan alsnog een workout erbij (die laat haptiek toe met de pols omlaag). */
  private func upgradeToWorkout() {
    guard !owners.isEmpty, workout == nil else { return }
    if startWorkout(), workout?.state == .running { onRunningChanged?(true) }
  }

  /// Workout mag (toestemming gegeven)? Voor de melding op het horloge.
  var workoutPermissionMissing: Bool {
    HKHealthStore.isHealthDataAvailable() && healthStore.authorizationStatus(for: HKObjectType.workoutType()) != .sharingAuthorized
  }

  /** De iPhone opende deze app via startWatchApp (WKApplicationDelegate.handle): de workout meteen starten, ook met het horloge op
   *  slot en de app op de achtergrond. Het sessiebericht volgt via WatchConnectivity. */
  func startFromPhoneLaunch(_ configuration: HKWorkoutConfiguration) {
    guard startWorkout(configuration) else { return }
    if owners.isEmpty {
      let check = DispatchWorkItem { [weak self] in
        guard let self = self, self.owners.isEmpty else { return }
        self.endWorkout()
      }
      workoutOrphanCheck = check
      DispatchQueue.main.asyncAfter(deadline: .now() + 30, execute: check)
    }
  }

  private var workoutAllowed: Bool {
    HKHealthStore.isHealthDataAvailable() && healthStore.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized
  }

  @discardableResult
  private func startWorkout(_ configuration: HKWorkoutConfiguration? = nil) -> Bool {
    if let w = workout, w.state == .running || w.state == .prepared || w.state == .notStarted { return true }
    guard workoutAllowed, Date() >= workoutRetryAfter else { return false }
    let config = configuration ?? {
      let c = HKWorkoutConfiguration()
      c.activityType = .mindAndBody
      c.locationType = .unknown
      return c
    }()
    do {
      let w = try HKWorkoutSession(healthStore: healthStore, configuration: config)
      w.delegate = self
      workout = w
      w.startActivity(with: Date())
      return true
    } catch {
      workout = nil
      return false
    }
  }

  private func endWorkout() {
    workoutOrphanCheck?.cancel()
    guard let w = workout else { return }
    workout = nil
    if w.state == .running || w.state == .paused || w.state == .prepared { w.end() }
  }

  private func startIfPossible() {
    guard !owners.isEmpty else { return }
    /* Workout eerst (werkt ook op de achtergrond/vergrendeld); de mindfulness-sessie enkel als terugval. */
    if startWorkout() {
      if workout?.state == .running { DispatchQueue.main.async { [weak self] in self?.onRunningChanged?(true) } }
      return
    }
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
      if self.workout?.state == .running { return }
      /* Onverwacht kwijt (verlopen, systeem, fout) terwijl iemand hem nog
         nodig heeft. Niet meteen herstarten: bij `.error` (bv. ontbrekende
         WKBackgroundModes) zou dat een lus geven. Wel opnieuw proberen bij
         de volgende activatie van de app. */
      self.onRunningChanged?(false)
    }
  }

  // MARK: HKWorkoutSessionDelegate (callbacks → main)

  func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self, workoutSession === self.workout else { return }
      if toState == .running {
        self.onRunningChanged?(true)
      } else if toState == .ended || toState == .stopped {
        self.workout = nil
        self.workoutRetryAfter = Date().addingTimeInterval(60)
        if !self.owners.isEmpty {
          /* Onverwacht gestopt (bv. een andere workout-app): terugvallen op de mindfulness-sessie als de app vooraan staat. */
          self.onRunningChanged?(self.session?.state == .running)
          self.startIfPossible()
        }
      }
    }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self, workoutSession === self.workout else { return }
      self.workout = nil
      self.workoutRetryAfter = Date().addingTimeInterval(60)
      if !self.owners.isEmpty {
        self.onRunningChanged?(self.session?.state == .running)
        self.startIfPossible()
      }
    }
  }
}
