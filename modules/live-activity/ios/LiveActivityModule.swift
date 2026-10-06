// VIBEZCORE — start / bijwerken / beëindigen van de Live Activity (iPhone).
// De weergave zelf staat in targets/live-activity/VibezLiveActivity.swift.
//
// NIET GETEST OP EEN TOESTEL: geschreven op Windows, zonder Xcode. De eerste
// iOS-build bevestigt het.

import ActivityKit
import AppIntents
import ExpoModulesCore
import Foundation

/// MOET identiek zijn aan targets/live-activity/VibezLiveActivity.swift.
struct VibezSessionAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String
    var colorHex: String
    var endDate: Date
    var paused: Bool
    var remainingSec: Int
    var totalSec: Int
  }

  var kind: String
}

struct LiveSessionRecord: Record {
  @Field var kind: String = "state"
  @Field var title: String = ""
  @Field var subtitle: String = ""
  @Field var colorHex: String = "#00A3A3"
  @Field var endMs: Double = 0
  @Field var paused: Bool = false
  @Field var remainingSec: Int = 0
  @Field var totalSec: Int = 0
}

/// Darwin-signaal van de pauze/hervat-knop in de Live Activity.
let vibezLiveToggleName = "com.ubili.vibezcoreapp.live.toggle"

/// Zelfde intent als in targets/live-activity. Voert iOS hem in het
/// app-proces uit, dan gaat het signaal hier meteen naar JS; voert iOS hem
/// in de widget-extensie uit, dan komt het via het Darwin-signaal binnen.
@available(iOS 17.0, *)
struct VibezToggleSessionIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Pause or resume session"
  static var isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    LiveActivityModule.current?.emitToggle()
    return .result()
  }
}

public class LiveActivityModule: Module {
  static weak var current: LiveActivityModule?

  func emitToggle() {
    sendEvent("onLiveAction", ["action": "toggle"])
  }

  private func observeToggle() {
    let center = CFNotificationCenterGetDarwinNotifyCenter()
    let observer = Unmanaged.passUnretained(self).toOpaque()
    CFNotificationCenterAddObserver(
      center, observer,
      { _, observer, _, _, _ in
        guard let observer = observer else { return }
        let module = Unmanaged<LiveActivityModule>.fromOpaque(observer).takeUnretainedValue()
        DispatchQueue.main.async { module.emitToggle() }
      },
      vibezLiveToggleName as CFString, nil, .deliverImmediately
    )
  }

  private func stopObserving() {
    let center = CFNotificationCenterGetDarwinNotifyCenter()
    CFNotificationCenterRemoveEveryObserver(center, Unmanaged.passUnretained(self).toOpaque())
  }

  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    Events("onLiveAction")

    OnCreate {
      LiveActivityModule.current = self
      self.observeToggle()
    }

    OnDestroy {
      self.stopObserving()
      if LiveActivityModule.current === self { LiveActivityModule.current = nil }
    }

    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    AsyncFunction("show") { (record: LiveSessionRecord) in
      if #available(iOS 16.2, *) {
        await LiveSessionController.show(record)
      }
    }

    AsyncFunction("end") { () in
      if #available(iOS 16.2, *) {
        await LiveSessionController.endAll()
      }
    }
  }
}

@available(iOS 16.2, *)
enum LiveSessionController {
  static func show(_ r: LiveSessionRecord) async {
    let state = VibezSessionAttributes.ContentState(
      title: r.title,
      subtitle: r.subtitle,
      colorHex: r.colorHex,
      endDate: Date(timeIntervalSince1970: r.endMs / 1000),
      paused: r.paused,
      remainingSec: r.remainingSec,
      totalSec: r.totalSec
    )
    // Een minuut na het geplande einde is de weergave verouderd (de app
    // beëindigt hem normaal zelf; dit is enkel het vangnet).
    let content = ActivityContent(
      state: state,
      staleDate: r.paused ? nil : state.endDate.addingTimeInterval(60)
    )

    // Eén sessie tegelijk: een lopende activity van dezelfde soort bijwerken,
    // een van een andere soort eerst afsluiten.
    if let current = Activity<VibezSessionAttributes>.activities.first {
      if current.attributes.kind == r.kind {
        await current.update(content)
        return
      }
      await current.end(nil, dismissalPolicy: .immediate)
    }

    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    do {
      _ = try Activity.request(
        attributes: VibezSessionAttributes(kind: r.kind),
        content: content,
        pushType: nil
      )
    } catch {
      // Geen toestemming of limiet bereikt — de sessie zelf loopt gewoon door.
    }
  }

  static func endAll() async {
    for activity in Activity<VibezSessionAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}
