import SwiftUI

@main
struct VibezcoreWatchApp: App {
  @Environment(\.scenePhase) private var scenePhase

  init() {
    /* Controllers eerst, zodat de runtime-callback (StateSessionController)
       vastligt vóór er berichten binnenkomen. */
    _ = BreathSessionController.shared
    _ = StateSessionController.shared
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
