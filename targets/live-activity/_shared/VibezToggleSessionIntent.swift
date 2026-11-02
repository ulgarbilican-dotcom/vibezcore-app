// VIBEZCORE — pauze / hervatten vanaf het vergrendelscherm (iOS 17+).
//
// 2 nov 2026 (operator op build 80: "ik zie de sessies lopen op het lockscreen maar kan niet pauzeren"): deze intent stond enkel in
// de widget-extensie (en als kopie in de pod, waar iOS hem niet vindt). Een LiveActivityIntent hoort in de APP te staan: dan voert iOS
// hem uit in het proces van de app, ook als die op de achtergrond loopt. `_shared` = apple-targets zet dit bestand in de extensie én
// in de app. In beide gevallen gaat hetzelfde Darwin-signaal uit; modules/live-activity luistert ernaar en pauzeert of hervat de
// sessie zoals de knop in de app.

import ActivityKit
import AppIntents
import Foundation

@available(iOS 17.0, *)
struct VibezToggleSessionIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Pause or resume session"
  static let isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    /* 2 nov 2026 (build 82: de knop deed niets): binnen het app-proces ook rechtstreeks melden (NotificationCenter, hoofdthread) —
       het Darwin-signaal hieronder blijft voor het geval iOS de intent in de extensie uitvoert. De module negeert een dubbele melding. */
    await MainActor.run {
      NotificationCenter.default.post(name: Notification.Name("com.ubili.vibezcoreapp.live.toggle.local"), object: nil)
    }
    CFNotificationCenterPostNotification(
      CFNotificationCenterGetDarwinNotifyCenter(),
      CFNotificationName("com.ubili.vibezcoreapp.live.toggle" as CFString),
      nil, nil, true
    )
    /* Audit 2 nov 2026: de app even wakker houden zodat ze het signaal ook echt verwerkt (pauzeren/hervatten en de kaart bijwerken)
       voor iOS haar weer stillegt. */
    try? await Task.sleep(nanoseconds: 1_000_000_000)
    return .result()
  }
}
