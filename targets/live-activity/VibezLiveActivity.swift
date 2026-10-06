// VIBEZCORE — Live Activity: lopende sessie op het vergrendelscherm en in
// het Dynamic Island. Zie expo-target.config.js voor de achtergrond.
//
// Huisstijl: zwart vlak, witte tekst, de kleur van de toestand enkel als
// stip en voortgangslijn (geen gekleurde vlakken). Aftellen gebeurt door
// het systeem zelf (Text(_, style: .timer) / ProgressView(timerInterval:)),
// dus de app hoeft niets elke seconde bij te werken — ook niet als iOS de
// app op de achtergrond stillegt.

import ActivityKit
import SwiftUI
import WidgetKit

/// MOET identiek zijn aan modules/live-activity/ios/LiveActivityModule.swift.
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

  /// "state" (State Control) of "breath".
  var kind: String
}

extension Color {
  init(vzHex: String) {
    var s = vzHex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    var v: UInt64 = 0
    Scanner(string: s).scanHexInt64(&v)
    self.init(
      red: Double((v >> 16) & 0xFF) / 255,
      green: Double((v >> 8) & 0xFF) / 255,
      blue: Double(v & 0xFF) / 255
    )
  }
}

private func fmt(_ sec: Int) -> String {
  let s = max(0, sec)
  return String(format: "%d:%02d", s / 60, s % 60)
}

private func deepLink(_ kind: String, _ state: VibezSessionAttributes.ContentState) -> URL? {
  // State Control: rechtstreeks naar de lopende sessie (geen intro). De
  // State Control-tab handelt elke `open`-token één keer af, dus uniek per
  // stand van de sessie. Ademsessie: de app openen — de sessielaag ligt daar
  // al bovenop.
  let token = Int(state.endDate.timeIntervalSince1970)
  return URL(string: kind == "state" ? "vibezcoreapp://bracelet?open=live\(token)" : "vibezcoreapp://")
}

private struct TimerLabel: View {
  let state: VibezSessionAttributes.ContentState
  var body: some View {
    if state.paused {
      Text(fmt(state.remainingSec))
    } else {
      Text(state.endDate, style: .timer)
    }
  }
}

private struct ProgressLine: View {
  let state: VibezSessionAttributes.ContentState
  var body: some View {
    let tint = Color(vzHex: state.colorHex)
    if state.paused || state.totalSec <= 0 {
      ProgressView(value: Double(max(0, state.totalSec - state.remainingSec)), total: Double(max(1, state.totalSec)))
        .tint(tint)
    } else {
      ProgressView(
        timerInterval: state.endDate.addingTimeInterval(-Double(state.totalSec))...state.endDate,
        countsDown: false,
        label: { EmptyView() },
        currentValueLabel: { EmptyView() }
      )
      .tint(tint)
    }
  }
}

private struct LockScreenView: View {
  let state: VibezSessionAttributes.ContentState
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .center) {
        VStack(alignment: .leading, spacing: 3) {
          Text("VIBEZCORE")
            .font(.system(size: 11, weight: .bold))
            .tracking(1.5)
            .foregroundColor(Color.white.opacity(0.55))
          HStack(spacing: 7) {
            Circle().fill(Color(vzHex: state.colorHex)).frame(width: 8, height: 8)
            Text(state.title)
              .font(.system(size: 17, weight: .semibold))
              .foregroundColor(.white)
          }
          Text(state.paused ? "Paused" : state.subtitle)
            .font(.system(size: 13))
            .foregroundColor(Color.white.opacity(0.6))
        }
        Spacer()
        TimerLabel(state: state)
          .font(.system(size: 34, weight: .bold).monospacedDigit())
          .foregroundColor(state.paused ? Color.white.opacity(0.6) : .white)
          .multilineTextAlignment(.trailing)
          .frame(maxWidth: 120, alignment: .trailing)
      }
      ProgressLine(state: state)
    }
    .padding(16)
  }
}

struct VibezSessionLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: VibezSessionAttributes.self) { context in
      LockScreenView(state: context.state)
        .activityBackgroundTint(Color.black)
        .activitySystemActionForegroundColor(Color.white)
        .widgetURL(deepLink(context.attributes.kind, context.state))
    } dynamicIsland: { context in
      let tint = Color(vzHex: context.state.colorHex)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          HStack(spacing: 6) {
            Circle().fill(tint).frame(width: 8, height: 8)
            Text(context.state.title)
              .font(.system(size: 15, weight: .semibold))
              .foregroundColor(.white)
              .lineLimit(1)
          }
          .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          TimerLabel(state: context.state)
            .font(.system(size: 22, weight: .bold).monospacedDigit())
            .foregroundColor(.white)
            .frame(maxWidth: 90, alignment: .trailing)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            Text(context.state.paused ? "Paused" : context.state.subtitle)
              .font(.system(size: 13))
              .foregroundColor(Color.white.opacity(0.6))
            ProgressLine(state: context.state)
          }
          .padding(.horizontal, 4)
        }
      } compactLeading: {
        Circle().fill(tint).frame(width: 10, height: 10)
      } compactTrailing: {
        TimerLabel(state: context.state)
          .font(.system(size: 14, weight: .semibold).monospacedDigit())
          .foregroundColor(.white)
          .frame(maxWidth: 46)
      } minimal: {
        Circle().fill(tint).frame(width: 10, height: 10)
      }
      .widgetURL(deepLink(context.attributes.kind, context.state))
    }
  }
}

@main
struct VibezLiveBundle: WidgetBundle {
  var body: some Widget {
    VibezSessionLiveActivity()
  }
}
