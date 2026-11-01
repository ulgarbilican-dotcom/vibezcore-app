import HealthKit
import SwiftUI
import WatchKit

/* 29 okt 2026: de iPhone opent deze app bij het starten van een sessie (HKHealthStore.startWatchApp, zie WatchBreathModule.swift).
   watchOS meldt dat hier; de sessie zelf komt via WatchConnectivity binnen. Sinds 1 nov 2026 start hier een Mind & Body-workoutsessie
   (RuntimeSessionManager) zodat de app ook vergrendeld blijft lopen; er wordt niets opgeslagen of gelezen. */
final class WatchAppDelegate: NSObject, WKApplicationDelegate {
  func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
    PhoneConnector.shared.activate()
    /* 1 nov 2026 (iOS build 68): meteen de workoutsessie starten — die houdt de app wakker en laat haptiek toe, ook vergrendeld. */
    RuntimeSessionManager.shared.startFromPhoneLaunch(workoutConfiguration)
    RuntimeSessionManager.shared.appDidBecomeActive()
  }
}

@main
struct VibezcoreWatchApp: App {
  @WKApplicationDelegateAdaptor(WatchAppDelegate.self) private var appDelegate
  @Environment(\.scenePhase) private var scenePhase

  init() {
    /* Controllers eerst, zodat de runtime-callback (StateSessionController)
       vastligt vóór er berichten binnenkomen. */
    _ = BreathSessionController.shared
    _ = StateSessionController.shared
    _ = WatchCatalog.shared
    PhoneConnector.shared.activate()
  }

  var body: some Scene {
    WindowGroup {
      ContentView()
    }
    .onChange(of: scenePhase) { _, phase in
      /* Een sessie die binnenkwam terwijl de app op de achtergrond stond,
         kon nog geen WKExtendedRuntimeSession starten — nu wel. */
      if phase == .active {
        RuntimeSessionManager.shared.appDidBecomeActive()
      }
    }
  }
}
