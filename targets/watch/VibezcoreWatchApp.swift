import SwiftUI

@main
struct VibezcoreWatchApp: App {
  init() {
    BreathSessionController.shared.activate()
  }

  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}
