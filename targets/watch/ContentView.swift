import Combine
import SwiftUI
import WatchKit

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE op de Apple Watch — de sessieschermen, opgebouwd zoals de
   Galaxy Watch (wear-app MainActivity + SessionRingView). 19 okt 2026,
   operator: "interface klopt niet … bij breathwork moeten we de figuren
   krijgen, niet de cirkels".

   State Control: de cirkel VULT het scherm (zoals Apple's Workout), met de
   naam bovenaan en pauze + END onderaan BINNEN de cirkel; de schijf klopt
   mee met elke slag, een ring per lub, water dat zakt met de resterende tijd.

   Breathwork: geen cirkel — de ademfiguur van de toestand (zon, bloem,
   lotus, oog, boom) ademt mee (schaal 0,70 → 1,00, gloed erachter), een
   halve boog bovenaan telt de fase af, links de seconden, onder de figuur
   "Inhale  Nose" en "m:ss left". Tik op de figuur = pauze/hervatten.

   Pols omlaag (always-on, `isLuminanceReduced`): enkel tijd/fase, gedimd,
   niets beweegt (Apple's regel). END = vasthouden (HoldToEnd). */

struct ContentView: View {
  @ObservedObject var controller = BreathSessionController.shared
  @ObservedObject var state = StateSessionController.shared

  var body: some View {
    Group {
      if state.active {
        StateSessionScreen(state: state)
      } else if controller.running || controller.paused {
        BreathSessionScreen(controller: controller)
      } else {
        /* Zelf starten op het horloge (18 okt 2026) — zie HomeView.swift. */
        HomeView()
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black)
  }
}

// MARK: - Gedeeld

/// 19 okt 2026 (operator, build 38: "de telefoon loopt ~1 s voor"): State
/// Control op de telefoon (bracelet-control.tsx) en de Galaxy Watch tonen
/// de resterende tijd AFGEROND NAAR BENEDEN; hier rondde alles naar boven
/// af → het horloge stond bijna altijd één seconde hoger. `roundUp: false`
/// voor State Control. Breathwork blijft naar boven: de telefoon toont daar
/// totaal − verstreken hele seconden (breath-session.tsx), = naar boven.
func clockText(_ sec: Double, roundUp: Bool = true) -> String {
  let v: Double = roundUp ? sec.rounded(.up) : sec.rounded(.down)
  let s = max(0, Int(v))
  return String(format: "%d:%02d", s / 60, s % 60)
}

/// Sleep (#00A3A3) in het lichte teal, zoals de ring in de app.
func sessionTint(_ hex: String) -> Color {
  let up = hex.uppercased()
  if up == "#00A3A3" { return Color(hex: "#4AF0D4") ?? .teal }
  return Color(hex: hex) ?? .teal
}

/// Ademfiguur per toestand (breath-states.ts `art`), zelfde als de Galaxy Watch.
func breathArtName(_ hex: String) -> String {
  switch hex.uppercased() {
  case "#F5A524": return "vzArtSun"
  case "#3E9BFF": return "vzArtFlower"
  case "#B478FF": return "vzArtLotus"
  case "#FFFFFF": return "vzArtClarity"
  case "#00A3A3", "#4AF0D4": return "vzArtTree"
  default: return "vzArtLotus"
  }
}

/// Optische correctie: de bloem oogt groter, de zon en het oog kleiner
/// (artOpticalScale in wear-app/CatalogStore.kt).
func breathArtOptical(_ hex: String) -> CGFloat {
  switch hex.uppercased() {
  case "#3E9BFF": return 0.86
  case "#F5A524": return 1.12
  case "#FFFFFF": return 1.18
  default: return 1
  }
}

/// Naam met kleurstip (bovenaan beide sessieschermen).
private struct NameRow: View {
  let title: String
  let dot: Color
  let size: CGFloat
  var body: some View {
    HStack(spacing: 5) {
      Circle().fill(dot).frame(width: 6, height: 6)
      Text(title)
        .font(.system(size: size, weight: .bold))
        .foregroundColor(Color(white: 0.96))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
  }
}

/// Ronde pauze/play-knop (State Control), zoals de Galaxy Watch.
private struct PauseButton: View {
  let paused: Bool
  let tint: Color
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      ZStack {
        Circle().fill(tint.opacity(0.2))
        Circle().stroke(Color.white.opacity(0.15), lineWidth: 1.5)
        Image(systemName: paused ? "play.fill" : "pause.fill")
          .font(.system(size: 14, weight: .semibold))
          .foregroundColor(.white)
      }
      .frame(width: 36, height: 36)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(paused ? "Resume" : "Pause")
  }
}

// MARK: - State Control

private struct StateSessionScreen: View {
  @ObservedObject var state: StateSessionController
  @Environment(\.isLuminanceReduced) private var ambient
  @State private var pulses: [RingPulse] = []

  var body: some View {
    GeometryReader { geo in
      StateSessionLayout(state: state, size: geo.size, pulses: pulses, ambient: ambient)
    }
    /* 19 okt 2026 (operator, build 38: "de cirkel staat niet in het midden,
       bovenaan afgesneden"): enkel de onderkant negeerde de veilige zone,
       dus het midden lag een halve statusbalk te laag op het scherm. Nu
       het VOLLEDIGE scherm (alle randen) — midden en straal komen zo op
       elke maat (40–49 mm) uit hetzelfde volle scherm; naam, pauze en END
       staan relatief tot de cirkel, dus altijd erbinnen. */
    .ignoresSafeArea()
    .onReceive(state.beats) { strong in
      let now = Date()
      pulses.removeAll { now.timeIntervalSince($0.start) > 3 }
      /* Eén ring per hartslag, 80 ms na de lub (waar de kloppende schijf op
         zijn grootst is), zoals de Galaxy Watch. */
      if strong { pulses.append(RingPulse(start: now.addingTimeInterval(0.08))) }
    }
  }
}

private struct StateSessionLayout: View {
  @ObservedObject var state: StateSessionController
  let size: CGSize
  let pulses: [RingPulse]
  let ambient: Bool

  private var w: CGFloat { size.width }
  private var h: CGFloat { size.height }
  /// De cirkel zo groot als de breedte toelaat (ringen dijen uit tot 1,11×).
  /* 19 okt 2026 (operator, build 42: "ring mag beetje kleiner"): kleiner, zodat
     de pulsring naar buiten kan uitdijen zoals op de telefoon (tot 1,26×). */
  private var r: CGFloat { min(w, h) / 2 / 1.32 }
  private var cy: CGFloat { h / 2 }

  var body: some View {
    ZStack {
      TimelineView(.animation(minimumInterval: 1.0 / 30, paused: ambient || (state.paused && pulses.isEmpty))) { ctx in
        StateFace(state: state, now: ctx.date, size: size, r: r, pulses: pulses, ambient: ambient)
      }

      /* Naam bovenaan, binnen de cirkel; PAUSED erboven. */
      VStack(spacing: 2) {
        if state.paused && !ambient {
          Text("PAUSED")
            .font(.system(size: 9, weight: .semibold))
            .tracking(1.6)
            .foregroundColor(Color.white.opacity(0.65))
        }
        NameRow(title: state.title, dot: state.color, size: 13)
      }
      .opacity(ambient ? 0.6 : 1)
      .frame(maxWidth: r * 1.3)
      .position(x: w / 2, y: cy - r * 0.56)

      /* Pauze + END onderaan, binnen de cirkel. */
      if !ambient {
        VStack(spacing: 2) {
          PauseButton(paused: state.paused, tint: state.color) { state.requestPauseOrResume() }
          HoldToEndButton { state.requestStop() }
        }
        .position(x: w / 2, y: cy + r * 0.58)
      }
    }
    .frame(width: w, height: h)
  }
}

private struct StateFace: View {
  @ObservedObject var state: StateSessionController
  let now: Date
  let size: CGSize
  let r: CGFloat
  let pulses: [RingPulse]
  let ambient: Bool

  /* 19 okt 2026 (operator: "pols omlaag: de tijd blijft staan"): in Always On
     tekent watchOS zelf een aftellende teller — onze eigen klok staat dan stil. */
  private var timerText: Text {
    if ambient, !state.paused, let end = state.endDate, end > now {
      return Text(timerInterval: now...end, countsDown: true)
    }
    return Text(clockText(remaining, roundUp: false))
  }

  private var remaining: Double {
    state.paused ? state.pausedRemainingSec : max(0, state.endDate?.timeIntervalSince(now) ?? 0)
  }

  var body: some View {
    ZStack {
      StateRingCanvas(
        date: now,
        tint: state.color,
        level: state.totalSec > 0 ? remaining / state.totalSec : 0.5,
        flowing: !state.paused && !ambient,
        pulses: ambient ? [] : pulses,
        ambient: ambient,
        lub: state.lastLubDate,
        cycleMs: state.lastCycleMs,
        baseR: r
      )
      /* 19 okt 2026 (operator, build 38): teller iets groter (0,42 → 0,47 r)
         en iets hoger, zodat hij vrij blijft van de pauzeknop; naar beneden
         afgerond, zoals de telefoon. */
      timerText
        .font(.system(size: r * 0.47, weight: ambient ? .medium : .bold).monospacedDigit())
        .foregroundColor(ambient ? Color(white: 0.74) : .white)
        .shadow(color: .black.opacity(0.5), radius: 3)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .position(x: size.width / 2, y: size.height / 2 - r * 0.08)
    }
    .frame(width: size.width, height: size.height)
  }
}

private struct RingPulse: Identifiable {
  let id = UUID()
  let start: Date
}

/// De cirkel — zelfde vorm en tempo's als SessionRingView (Galaxy Watch) en
/// components/LiquidWave.tsx (telefoon).
private struct StateRingCanvas: View {
  let date: Date
  let tint: Color
  let level: Double
  let flowing: Bool
  let pulses: [RingPulse]
  let ambient: Bool
  let lub: Date?
  let cycleMs: Double
  let baseR: CGFloat

  var body: some View {
    Canvas { context, size in
      var scale = 1.0
      if let l = lub, !ambient {
        scale = beatCurve(el: date.timeIntervalSince(l) * 1000, c: max(300, cycleMs))
      }
      let r = baseR * CGFloat(scale)
      let c = CGPoint(x: size.width / 2, y: size.height / 2)
      let disc = CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)
      let d = 2 * r

      context.fill(Path(ellipseIn: disc), with: .color(Color(white: 0.04)))

      if !ambient {
        let lv = min(1, max(0.08, level))
        let emptyY = disc.minY + d * 0.86
        let fullY = disc.minY + d * 0.04
        let waterY = emptyY - (emptyY - fullY) * CGFloat(lv)
        let t = flowing ? date.timeIntervalSinceReferenceDate : 0
        context.drawLayer { layer in
          layer.clip(to: Path(ellipseIn: disc))
          layer.fill(wave(left: disc.minX, size: d, baseY: waterY + d * 0.027, amp: d * 0.040, t: t, dur: 5.2),
                     with: .color(tint.opacity(0.07)))
          layer.fill(wave(left: disc.minX, size: d, baseY: waterY - d * 0.018, amp: d * 0.031, t: t, dur: 3.6),
                     with: .color(tint.opacity(0.10)))
        }
      }

      context.stroke(Path(ellipseIn: disc), with: .color(tint.opacity(ambient ? 0.45 : 1)), lineWidth: 2)

      /* Ring per hartslag: duur = 1,5 slag (0,5–2,6 s), ease-out cubic, in
         90 ms op volle sterkte en dan uitdoven (= SessionRingView). */
      for p in pulses {
        let el = date.timeIntervalSince(p.start) * 1000
        let dur = min(2200, max(500, cycleMs * 1.2))
        guard el >= 0, el < dur else { continue }
        let k = el / dur
        let ease = 1 - (1 - k) * (1 - k) * (1 - k)
        let q = (el - 90) / (dur - 90)
        /* zoals HapticPulseRings op de telefoon: uitdijen tot 1,26× en uitdoven
           (operator: "het moet een buitenwaartse puls geven") */
        let alpha = el < 90 ? 0.6 * (el / 90) : 0.6 * (1 - q) * (1 - q)
        let rr = baseR * CGFloat(1.02 + 0.24 * ease)
        let rect = CGRect(x: c.x - rr, y: c.y - rr, width: 2 * rr, height: 2 * rr)
        context.stroke(Path(ellipseIn: rect), with: .color(tint.opacity(alpha)), lineWidth: 2.5)
      }
    }
  }

  /// Hartslagcurve = HeartbeatScale (telefoon) = SessionRingView (Galaxy Watch).
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

  /// Zelfde pad als de telefoon (LiquidWave.tsx): vier S-bochten (kubisch)
  /// over twee breedtes, schuift één breedte per `dur` seconden.
  private func wave(left: CGFloat, size: CGFloat, baseY: CGFloat, amp: CGFloat, t: TimeInterval, dur: Double) -> Path {
    let shift = CGFloat(t.truncatingRemainder(dividingBy: dur) / dur) * size
    let p = size
    let x0 = left - shift
    var path = Path()
    path.move(to: CGPoint(x: x0, y: baseY))
    for i in 0..<4 {
      let sx = x0 + p * 0.5 * CGFloat(i)
      path.addCurve(
        to: CGPoint(x: sx + p * 0.5, y: baseY),
        control1: CGPoint(x: sx + p * 0.25, y: baseY - amp),
        control2: CGPoint(x: sx + p * 0.25, y: baseY + amp)
      )
    }
    path.addLine(to: CGPoint(x: x0 + p * 2, y: baseY + size + 2))
    path.addLine(to: CGPoint(x: x0, y: baseY + size + 2))
    path.closeSubpath()
    return path
  }
}

// MARK: - Breathwork

private struct BreathSessionScreen: View {
  @ObservedObject var controller: BreathSessionController
  @Environment(\.isLuminanceReduced) private var ambient

  var body: some View {
    GeometryReader { geo in
      BreathSessionLayout(controller: controller, size: geo.size, ambient: ambient)
    }
    /* 19 okt 2026 (operator, build 38): volledig scherm, zoals State
       Control — figuur en boog gecentreerd op het hele scherm. */
    .ignoresSafeArea()
  }
}

private struct BreathSessionLayout: View {
  @ObservedObject var controller: BreathSessionController
  let size: CGSize
  let ambient: Bool

  private var w: CGFloat { size.width }
  private var h: CGFloat { size.height }
  private var r: CGFloat { min(w, h) / 2 / 1.10 }
  private var cy: CGFloat { h / 2 }
  private var paused: Bool { controller.paused }
  private var tint: Color { sessionTint(controller.colorHex) }
  /// Figuur groot en centraal, iets hoger dan het midden (tekst eronder).
  /// 19 okt 2026 (operator, build 38: "figuur is het middelpunt, groter en
  /// hoger"): 0,16 → 0,22 r boven het midden (gepauzeerd 0,02 → 0,10).
  private var acy: CGFloat { cy - r * (paused ? 0.10 : 0.22) }

  var body: some View {
    ZStack {
      TimelineView(.animation(minimumInterval: 1.0 / 30, paused: ambient || paused)) { ctx in
        BreathFace(controller: controller, now: ctx.date, size: size, r: r, acy: acy, ambient: ambient)
      }

      /* gepauzeerd: wit rondje met donker play-teken (CTA-stijl) en de naam */
      if paused && !ambient {
        ZStack {
          Circle().fill(Color.white)
          Image(systemName: "play.fill")
            .font(.system(size: r * 0.14, weight: .bold))
            .foregroundColor(Color(white: 0.04))
            .offset(x: r * 0.012)
        }
        .frame(width: r * 0.34, height: r * 0.34)
        .position(x: w / 2, y: acy)
        .allowsHitTesting(false)

        /* 19 okt 2026 (operator, build 38): naam boven de (grotere) figuur
           en binnen de boog, zodat niets over de figuur ligt. */
        NameRow(title: controller.modeName, dot: Color(hex: controller.colorHex) ?? tint, size: 12)
          .frame(maxWidth: r * 1.1)
          .position(x: w / 2, y: cy - r * 0.66)
      }

      /* Tik op de figuur = pauze / hervatten (het grootste doel op een
         horlogescherm, zoals de Galaxy Watch). */
      Color.clear
        .contentShape(Rectangle())
        .frame(width: r * 1.4, height: r * 1.25) // 19 okt 2026 (operator, build 38): mee met de grotere figuur
        .position(x: w / 2, y: acy)
        .onTapGesture { controller.requestPauseOrResume() }
        .accessibilityLabel(paused ? "Resume" : "Pause")
        .accessibilityAddTraits(.isButton)

      if !ambient {
        HoldToEndButton { controller.requestStop() }
          .position(x: w / 2, y: h - 30)
      }
    }
    .frame(width: w, height: h)
  }
}

private struct BreathFace: View {
  @ObservedObject var controller: BreathSessionController
  let now: Date
  let size: CGSize
  let r: CGFloat
  let acy: CGFloat
  let ambient: Bool

  private var w: CGFloat { size.width }
  private var cy: CGFloat { size.height / 2 }
  private var paused: Bool { controller.paused }
  private var hex: String { controller.colorHex }
  private var tint: Color { sessionTint(hex) }

  /// Adem-niveau 0…1 (0,18 uitgeademd … 0,85 ingeademd).
  private var b: Double {
    if ambient { return 0.5 }
    let span = max(0.001, controller.phaseEnd.timeIntervalSince(controller.phaseStart))
    let k = min(1, max(0, now.timeIntervalSince(controller.phaseStart) / span))
    let e = k * k * (3 - 2 * k) // zacht in en uit, zoals een adem
    let level = controller.levelFrom + (controller.levelTo - controller.levelFrom) * e
    return min(1, max(0, (level - 0.18) / 0.67))
  }

  private var phaseProgress: Double {
    if paused { return controller.pausedPhaseProgress }
    let span = max(0.001, controller.phaseEnd.timeIntervalSince(controller.phaseStart))
    return min(1, max(0, now.timeIntervalSince(controller.phaseStart) / span))
  }

  /// Nooit "0": bij de overgang staat de volgende fase al klaar.
  private var phaseSecondsLeft: Int {
    let left = paused ? controller.pausedPhaseLeftSec : controller.phaseEnd.timeIntervalSince(now)
    return max(1, Int(left.rounded(.up)))
  }

  private var sessionLeft: Double {
    paused ? controller.pausedSessionLeftSec : max(0, controller.sessionEnd.timeIntervalSince(now))
  }

  /// 19 okt 2026 (operator, build 38): figuur ~17 % groter (0,53 → 0,62),
  /// de gloed groeit mee in straal maar wordt zachter (zie body).
  private var glowR: CGFloat { r * 0.60 * CGFloat(0.7 + 0.44 * b) }
  private var figureSide: CGFloat { r * 1.8 * 0.62 * breathArtOptical(hex) * CGFloat(0.7 + 0.3 * b) }
  /// Middelpunt van de faseboog, iets boven het schermmidden (19 okt 2026,
  /// operator, build 38: "boog iets hoger").
  /* 19 okt 2026 (operator, build 42: "boog te hoog, minder breed zodat er
     links en rechts ademruimte is"): smaller (0,86 r) en lager. */
  private var arcR: CGFloat { r * 0.86 }
  private var arcCy: CGFloat { cy + r * 0.02 }
  /// Los uitgeschreven (type-checker): ademend, gedimd bij pauze en pols omlaag.
  private var figureOpacity: Double {
    let base: Double = 0.74 + 0.26 * b
    let pauseDim: Double = paused ? 0.4 : 1
    let ambientDim: Double = ambient ? 0.6 : 1
    return base * pauseDim * ambientDim
  }

  var body: some View {
    ZStack {
      /* gloed in de kleur van de toestand, zwelt mee.
         19 okt 2026 (operator, build 38: "gloed te sterk"): zachter verloop
         (0,85 → 0,45 halfweg) en minder dekking (0,10 + 0,34 b → 0,06 + 0,20 b). */
      Circle()
        .fill(RadialGradient(
          colors: [tint.opacity(0.9), tint.opacity(0.45), tint.opacity(0)],
          center: .center, startRadius: 0, endRadius: glowR
        ))
        .frame(width: 2 * glowR, height: 2 * glowR)
        .opacity(ambient ? 0.05 : 0.06 + 0.20 * b)
        .position(x: w / 2, y: acy)

      /* de figuur */
      Image(breathArtName(hex))
        .resizable()
        .scaledToFit()
        .frame(width: figureSide, height: figureSide)
        .opacity(figureOpacity)
        .position(x: w / 2, y: acy)

      if !ambient {
        /* halve boog bovenaan: de fase telt af, van links naar rechts */
        PhaseArc(progress: phaseProgress, tint: tint, dim: paused)
          .frame(width: 2 * arcR, height: 2 * arcR)
          .position(x: w / 2, y: arcCy)

        /* seconden van de fase, links (19 okt 2026, operator, build 38:
           "teller mag iets groter": 17 → 20, mee met de boog omhoog) */
        Text("\(phaseSecondsLeft)")
          .font(.system(size: 20, weight: .bold).monospacedDigit())
          .foregroundColor(Color.white.opacity(paused ? 0.5 : 0.94))
          .position(x: w / 2 - arcR + r * 0.02, y: arcCy + r * 0.12)
      }

      /* "Inhale  Nose" + "4:12 left" */
      VStack(spacing: 1) {
        HStack(spacing: 5) {
          /* pols omlaag: de fase zou stil blijven staan — dan de naam */
          Text(ambient && !paused ? controller.modeName : controller.phaseLabel)
            .font(.system(size: paused ? 16 : 15, weight: .bold))
            .foregroundColor(ambient ? Color(white: 0.74) : .white)
          if !paused && !ambient && !controller.via.isEmpty {
            Text(controller.via)
              .font(.system(size: 13))
              .foregroundColor(Color.white.opacity(0.65))
          }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        if !paused && ambient && controller.sessionEnd > now {
          /* Always On: aftellen door watchOS zelf (19 okt 2026) */
          Text(timerInterval: now...controller.sessionEnd, countsDown: true)
            .font(.system(size: 13, weight: .medium).monospacedDigit())
            .foregroundColor(Color.white.opacity(0.59))
        }
        if !paused && !ambient {
          /* 19 okt 2026 (operator, build 38): 11 → 13 pt */
          Text(clockText(sessionLeft) + " left")
            .font(.system(size: 13, weight: .medium).monospacedDigit())
            .foregroundColor(Color.white.opacity(0.59))
        }
      }
      /* 19 okt 2026 (operator, build 38): iets lager, vrij van de grotere figuur */
      .position(x: w / 2, y: cy + r * (paused ? 0.58 : 0.62))
    }
    .frame(width: size.width, height: size.height)
  }
}

/// Halve boog langs de bovenkant: dun spoor, de kleur loopt over de fase vol.
private struct PhaseArc: View {
  let progress: Double
  let tint: Color
  let dim: Bool
  var body: some View {
    ZStack {
      /* 19 okt 2026 (operator, build 38: "boog iets dunner"): 3,5 → 2,5 pt */
      Circle()
        .trim(from: 0.5, to: 1)
        .stroke(Color.white.opacity(0.14), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
      Circle()
        .trim(from: 0.5, to: 0.5 + 0.5 * min(1, max(0, progress)))
        .stroke(tint.opacity(dim ? 0.45 : 1), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
    }
  }
}

// MARK: - END vasthouden

/// END vasthouden in plaats van tikken (zoals HoldToEnd.kt op de Galaxy
/// Watch): 0,8 s, het vlak loopt van links naar rechts vol; loslaten vóór
/// het vol is = niets; een korte tik toont "HOLD TO END".
/// 19 okt 2026 (operator: "hold to end werkt niet altijd"): onLongPressGesture
/// brak af zodra de vinger een paar punten verschoof. Nu een eigen
/// aanraking die beweging verdraagt (tot 40 pt) en een vaste timer.
struct HoldToEndButton: View {
  let onEnd: () -> Void
  @State private var progress: CGFloat = 0
  @State private var pressStart: Date?
  @State private var hint = false
  @State private var fireWork: DispatchWorkItem?

  private static let holdSec = 0.8

  var body: some View {
    Text(hint ? "HOLD TO END" : "END")
      .font(.system(size: 11, weight: .bold))
      .tracking(1.8)
      .foregroundColor(Color.white.opacity(0.85))
      .lineLimit(1)
      .fixedSize()
      .padding(.vertical, 6)
      .padding(.horizontal, 20)
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
      .contentShape(Rectangle().inset(by: -8))
      .gesture(
        DragGesture(minimumDistance: 0)
          .onChanged { value in
            if pressStart == nil {
              begin()
            } else if abs(value.translation.width) > 40 || abs(value.translation.height) > 40 {
              cancel(short: false)
            }
          }
          .onEnded { _ in
            if pressStart != nil {
              let short = pressStart.map { Date().timeIntervalSince($0) < 0.3 } ?? false
              cancel(short: short)
            }
          }
      )
      .accessibilityLabel("End session")
      .accessibilityAddTraits(.isButton)
      .accessibilityAction { onEnd() }
  }

  private func begin() {
    hint = false
    pressStart = Date()
    withAnimation(.linear(duration: Self.holdSec)) { progress = 1 }
    let work = DispatchWorkItem {
      guard pressStart != nil else { return }
      pressStart = nil
      fireWork = nil
      WKInterfaceDevice.current().play(.click)
      progress = 0
      onEnd()
    }
    fireWork = work
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.holdSec, execute: work)
  }

  private func cancel(short: Bool) {
    fireWork?.cancel()
    fireWork = nil
    pressStart = nil
    withAnimation(.easeOut(duration: 0.18)) { progress = 0 }
    if short {
      hint = true
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { hint = false }
    }
  }
}
