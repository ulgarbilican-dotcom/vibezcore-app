import Combine
import SwiftUI
import WatchKit

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE op de Apple Watch — één scherm voor State Control en
   breathwork, in de look van de app en de website-mockup (6 okt 2026):
   naam met kleurstip, de sessiecirkel (donkere schijf, golf in twee lagen,
   dunne rand in de kleur van de toestand, een ring per tik), een ronde
   pauzeknop met END eronder.

   Pols omlaag (always-on, `isLuminanceReduced`): enkel rand en tijd,
   gedimd — geen golf, geen ringen, geen knoppen (Apple's regel: het scherm
   mag dan bijna niet bewegen).

   Eén sessie, twee bedieningen: de knoppen vragen het de iPhone (bron van
   waarheid); pauze en stop gebeuren hier meteen ook al. */

struct ContentView: View {
  @ObservedObject var controller = BreathSessionController.shared
  @ObservedObject var state = StateSessionController.shared

  var body: some View {
    Group {
      if state.active {
        SessionScreen(
          title: state.title,
          colorHex: nil,
          color: state.color,
          paused: state.paused,
          center: { now in
            let sec = state.paused ? state.pausedRemainingSec : max(0, state.endDate?.timeIntervalSince(now) ?? 0)
            return clock(sec)
          },
          sub: "",
          level: { now in
            let sec = state.paused ? state.pausedRemainingSec : max(0, state.endDate?.timeIntervalSince(now) ?? 0)
            return state.totalSec > 0 ? sec / state.totalSec : 0.5
          },
          pausedLabel: state.paused,
          beatClock: { (state.lastLubDate, state.lastCycleMs) },
          beats: state.beats.eraseToAnyPublisher(),
          onPause: { state.requestPauseOrResume() },
          onEnd: { state.requestStop() }
        )
      } else if controller.running || controller.paused {
        SessionScreen(
          title: controller.modeName,
          colorHex: controller.colorHex,
          color: nil,
          paused: controller.paused,
          center: { _ in controller.phaseLabel },
          sub: [controller.paused ? "" : controller.via, controller.totalRounds > 0 ? "\(controller.round) / \(controller.totalRounds)" : ""]
            .filter { !$0.isEmpty }.joined(separator: " · "),
          level: { now in
            let span = max(0.001, controller.phaseEnd.timeIntervalSince(controller.phaseStart))
            let k = min(1, max(0, now.timeIntervalSince(controller.phaseStart) / span))
            let e = k * k * (3 - 2 * k) // zacht in en uit, zoals een adem
            return controller.levelFrom + (controller.levelTo - controller.levelFrom) * e
          },
          pausedLabel: false,
          beatClock: nil,
          beats: controller.beats.eraseToAnyPublisher(),
          onPause: { controller.requestPauseOrResume() },
          onEnd: { controller.requestStop() }
        )
      } else {
        /* Zelf starten op het horloge (18 okt 2026) — zie HomeView.swift. */
        HomeView()
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black)
  }

  private func clock(_ sec: Double) -> String {
    let s = max(0, Int(sec.rounded(.up)))
    return String(format: "%d:%02d", s / 60, s % 60)
  }
}

private struct SessionScreen: View {
  let title: String
  let colorHex: String?
  let color: Color?
  let paused: Bool
  let center: (Date) -> String
  let sub: String
  let level: (Date) -> Double
  /** State Control: "PAUSED" boven de naam (zoals de Galaxy Watch). */
  let pausedLabel: Bool
  /** State Control: laatste lub + slagduur, voor kloppende cirkel en ring. */
  let beatClock: (() -> (Date?, Double))?
  let beats: AnyPublisher<Bool, Never>
  let onPause: () -> Void
  let onEnd: () -> Void

  @Environment(\.isLuminanceReduced) private var ambient
  @State private var pulses: [RingPulse] = []

  /// Sleep (#00A3A3) in het lichte teal, met sterkere golf — zoals de app.
  private var sleepLike: Bool {
    guard let hex = colorHex?.uppercased() else { return false }
    return hex == "#00A3A3" || hex == "#4AF0D4"
  }

  private var tint: Color {
    if let color = color { return color }
    if sleepLike { return Color(hex: "#4AF0D4") ?? .teal }
    return Color(hex: colorHex ?? "#00A3A3") ?? .teal
  }

  private var dotColor: Color {
    if let color = color { return color }
    return Color(hex: colorHex ?? "#00A3A3") ?? .teal
  }

  var body: some View {
    VStack(spacing: 4) {
      if pausedLabel && !ambient {
        Text("PAUSED")
          .font(.system(size: 10, weight: .semibold))
          .tracking(1.8)
          .foregroundColor(Color.white.opacity(0.65))
      }
      HStack(spacing: 6) {
        Circle().fill(dotColor).frame(width: 7, height: 7)
        Text(title)
          .font(.system(size: 13, weight: .semibold))
          .foregroundColor(.white)
          .lineLimit(1)
      }
      .opacity(ambient ? 0.6 : 1)

      TimelineView(.animation(minimumInterval: 1.0 / 30, paused: ambient || (paused && pulses.isEmpty))) { ctx in
        ZStack {
          RingCanvas(
            date: ctx.date,
            tint: tint,
            back: sleepLike ? 0.20 : 0.10,
            front: sleepLike ? 0.30 : 0.15,
            level: level(ctx.date),
            flowing: !paused && !ambient,
            pulses: ambient ? [] : pulses,
            ambient: ambient,
            beat: beatClock?()
          )
          VStack(spacing: 2) {
            Text(center(ctx.date))
              .font(.system(size: center(ctx.date).count > 6 ? 18 : 30, weight: ambient ? .medium : .bold).monospacedDigit())
              .foregroundColor(ambient ? Color(white: 0.74) : .white)
              .shadow(color: .black.opacity(0.5), radius: 3)
              .lineLimit(1)
              .minimumScaleFactor(0.6)
            if !sub.isEmpty && !ambient {
              Text(sub)
                .font(.system(size: 10))
                .foregroundColor(Color.white.opacity(0.65))
            }
          }
          .padding(.horizontal, 22)
        }
      }

      if !ambient {
        Button(action: onPause) {
          ZStack {
            Circle().fill(dotColor.opacity(0.2))
            Circle().stroke(Color.white.opacity(0.15), lineWidth: 1.5)
            Image(systemName: paused ? "play.fill" : "pause.fill")
              .font(.system(size: 14, weight: .semibold))
              .foregroundColor(.white)
          }
          .frame(width: 38, height: 38)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(paused ? "Resume" : "Pause")

        HoldToEndButton(onEnd: onEnd)
      }
    }
    .onReceive(beats) { strong in
      let now = Date()
      pulses.removeAll { now.timeIntervalSince($0.start) > 3 }
      if beatClock != nil {
        /* State Control: een ring per hartslag, 80 ms na de lub (waar de
           kloppende cirkel op zijn grootst is), zoals de Galaxy Watch. */
        if strong { pulses.append(RingPulse(start: now.addingTimeInterval(0.08), strong: true)) }
      } else {
        pulses.append(RingPulse(start: now, strong: strong))
      }
    }
  }
}

/// END vasthouden in plaats van tikken (15 okt 2026, zoals HoldToEnd.kt op de
/// Galaxy Watch): een losse aanraking stopte daar een sessie. 0,8 s vasthouden,
/// het vlak loopt van links naar rechts vol; loslaten vóór het vol is = niets,
/// een korte tik toont "HOLD TO END". VoiceOver: dubbeltik beëindigt meteen.
private struct HoldToEndButton: View {
  let onEnd: () -> Void
  @State private var progress: CGFloat = 0
  @State private var pressStart: Date?
  @State private var hint = false

  var body: some View {
    Text(hint ? "HOLD TO END" : "END")
      .font(.system(size: 10, weight: .semibold))
      .tracking(1.6)
      .foregroundColor(Color.white.opacity(0.72))
      .padding(.vertical, 4)
      .padding(.horizontal, 14)
      .background(
        GeometryReader { geo in
          ZStack(alignment: .leading) {
            Capsule().fill(Color.white.opacity(progress > 0 ? 0.12 : 0))
            Capsule().fill(Color.white.opacity(0.35))
              .frame(width: geo.size.width * progress)
          }
          .clipShape(Capsule())
        }
      )
      .contentShape(Capsule())
      .onLongPressGesture(minimumDuration: 0.8, perform: {
        WKInterfaceDevice.current().play(.click)
        progress = 0
        onEnd()
      }, onPressingChanged: { pressing in
        if pressing {
          hint = false
          pressStart = Date()
          withAnimation(.linear(duration: 0.8)) { progress = 1 }
        } else {
          let short = pressStart.map { Date().timeIntervalSince($0) < 0.3 } ?? false
          pressStart = nil
          withAnimation(.easeOut(duration: 0.18)) { progress = 0 }
          if short {
            hint = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { hint = false }
          }
        }
      })
      .accessibilityLabel("End session")
      .accessibilityAddTraits(.isButton)
      .accessibilityAction { onEnd() }
  }
}

private struct RingPulse: Identifiable {
  let id = UUID()
  let start: Date
  let strong: Bool
}

/// De cirkel zelf — zelfde vorm en tempo's als components/LiquidWave.tsx.
private struct RingCanvas: View {
  let date: Date
  let tint: Color
  let back: Double
  let front: Double
  let level: Double
  let flowing: Bool
  let pulses: [RingPulse]
  let ambient: Bool
  /** State Control: (laatste lub, slagduur ms); nil = Breathwork. */
  let beat: (Date?, Double)?

  var body: some View {
    Canvas { context, size in
      let s = min(size.width, size.height)
      let synced = beat != nil
      /* State Control (15 okt 2026): zelfde beweging als de telefoon en de
         Galaxy Watch. De schijf klopt (lub op, dip, dub op, uitzakken) en de
         ring blijft vlak rond de rand (1,07 tot 1,11). Breathwork houdt de
         bredere ringen. */
      let base = synced ? s / 2 / 1.14 : s / 2 / 1.36
      var scale = 1.0
      if let b = beat, let lub = b.0, !ambient {
        scale = beatCurve(el: date.timeIntervalSince(lub) * 1000, c: max(300, b.1))
      }
      let r = base * CGFloat(scale)
      let c = CGPoint(x: size.width / 2, y: size.height / 2)
      let disc = CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)
      let d = 2 * r

      context.fill(Path(ellipseIn: disc), with: .color(Color(white: 0.04)))

      if !ambient {
        let lv = min(1, max(0.08, level))
        let emptyY = disc.minY + d * 0.86
        let fullY = disc.minY + d * 0.04
        let waterY = emptyY - (emptyY - fullY) * lv
        let t = flowing ? date.timeIntervalSinceReferenceDate : 0
        context.drawLayer { layer in
          layer.clip(to: Path(ellipseIn: disc))
          layer.fill(wave(left: disc.minX, size: d, baseY: waterY + d * 0.027, amp: d * 0.040, t: t, dur: 5.2),
                     with: .color(tint.opacity(back)))
          layer.fill(wave(left: disc.minX, size: d, baseY: waterY - d * 0.018, amp: d * 0.031, t: t, dur: 3.6),
                     with: .color(tint.opacity(front)))
        }
      }

      context.stroke(Path(ellipseIn: disc), with: .color(tint.opacity(ambient ? 0.45 : 1)), lineWidth: 2)

      for p in pulses {
        if synced, let b = beat {
          /* duur = 1,5 slag (0,5 tot 2,6 s), ease-out cubic, in 90 ms op
             volle sterkte en dan uitdoven: = SessionRingView op de Galaxy Watch */
          let el = date.timeIntervalSince(p.start) * 1000
          let dur = min(2600, max(500, b.1 * 1.5))
          guard el >= 0, el < dur else { continue }
          let k = el / dur
          let ease = 1 - (1 - k) * (1 - k) * (1 - k)
          let alpha = el < 90
            ? 0.95 * (1 - (1 - el / 90) * (1 - el / 90))
            : 0.95 * (1 - ((el - 90) / (dur - 90)) * ((el - 90) / (dur - 90)))
          let rr = base * CGFloat(1.07 + 0.04 * ease)
          let rect = CGRect(x: c.x - rr, y: c.y - rr, width: 2 * rr, height: 2 * rr)
          context.stroke(Path(ellipseIn: rect), with: .color(tint.opacity(alpha)), lineWidth: 3)
          continue
        }
        let dur = p.strong ? 1.4 : 0.9
        let k = date.timeIntervalSince(p.start) / dur
        guard k >= 0, k < 1 else { continue }
        let ease = 1 - (1 - k) * (1 - k)
        let rr = r * (1 + (p.strong ? 0.32 : 0.14) * ease)
        let alpha = (p.strong ? 0.7 : 0.32) * (1 - k)
        let rect = CGRect(x: c.x - rr, y: c.y - rr, width: 2 * rr, height: 2 * rr)
        context.stroke(Path(ellipseIn: rect), with: .color(tint.opacity(alpha)), lineWidth: 2.2)
      }
    }
  }

  /// Hartslagcurve = HeartbeatScale (telefoon) = SessionRingView (Galaxy Watch):
  /// in 80 ms op naar 1,07, dip naar 1,015, dub op naar 1,04, zacht terug.
  private func beatCurve(el: Double, c: Double) -> Double {
    if el < 0 { return 1 }
    let dubAt = min(c * 0.3, 350).rounded()
    let rise = 80.0
    let back = max(160, min(520, c * 0.45, c - dubAt - rise - 40))
    func outQuad(_ k: Double) -> Double { 1 - (1 - k) * (1 - k) }
    func inOutSine(_ k: Double) -> Double { 0.5 - 0.5 * cos(Double.pi * k) }
    if el < rise { return 1 + 0.07 * outQuad(el / rise) }
    if el < dubAt { return 1.07 + (1.015 - 1.07) * inOutSine((el - rise) / max(40, dubAt - rise)) }
    if el < dubAt + rise { return 1.015 + (1.04 - 1.015) * outQuad((el - dubAt) / rise) }
    if el < dubAt + rise + back { return 1.04 + (1 - 1.04) * inOutSine((el - dubAt - rise) / back) }
    return 1
  }

  /// Periode = halve breedte; schuift één breedte per `dur` seconden.
  private func wave(left: CGFloat, size: CGFloat, baseY: CGFloat, amp: CGFloat, t: TimeInterval, dur: Double) -> Path {
    let shift = CGFloat(t.truncatingRemainder(dividingBy: dur) / dur) * size
    let period = size / 2
    var path = Path()
    path.move(to: CGPoint(x: left, y: baseY + size))
    var x: CGFloat = 0
    let step = max(2, size / 50)
    while x <= size + step {
      let y = baseY + amp * CGFloat(sin(2 * Double.pi * Double((x + shift) / period)))
      path.addLine(to: CGPoint(x: left + x, y: y))
      x += step
    }
    path.addLine(to: CGPoint(x: left + size + step, y: baseY + size))
    path.closeSubpath()
    return path
  }
}
