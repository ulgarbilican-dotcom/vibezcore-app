import SwiftUI

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Startscherm + instellen op de Apple Watch (18 okt 2026)

   Operator: "zie opbouw Android watch, Apple Watch moet professioneel
   zelfde principe zijn". 1-op-1 de opbouw van de Galaxy Watch (wear-app:
   MainActivity.renderHome, ModesActivity, StateControlActivity,
   StateActivity, Technique/Duration/StateDurationActivity):

     Home        V-teken · "Good evening" · "Choose your session" ·
                 pillen "State Control" en "Breathwork"
     Toestanden  één toestand per volledig scherm (verticaal bladeren met
                 de Digital Crown): eyebrow, waterbol (State Control, met de
                 duur) of ademende bol (Breathwork), naam in de kleur, slot
                 als vergrendeld, de "wanneer"-regel. Tik = instellen.
     Instellen   naam · Technique-pil · Duration-pil ("Recommended" in de
                 kleur) · witte Start-knop, of "Unlock with Premium on your
                 phone".
     Kiezers     lijst met afgeronde rijen; de huidige met rand in de
                 kleur, "Recommended" eronder.

   Laatste keuzes (toestand, duur, techniek) worden onthouden en staan klaar.
   ───────────────────────────────────────────────────────────────────────── */

private enum Last {
  static let d = UserDefaults.standard
  static func stateMode() -> Int? { d.object(forKey: "vz_last_state_mode") as? Int }
  static func setStateMode(_ m: Int) { d.set(m, forKey: "vz_last_state_mode") }
  static func breathKey() -> String? { d.string(forKey: "vz_last_breath_key") }
  static func setBreathKey(_ k: String) { d.set(k, forKey: "vz_last_breath_key") }
  static func minutes(_ mode: Int) -> Int? { d.object(forKey: "vz_state_min_\(mode)") as? Int }
  static func setMinutes(_ mode: Int, _ m: Int) { d.set(m, forKey: "vz_state_min_\(mode)") }
  static func tech(_ key: String) -> String? { d.string(forKey: "vz_breath_tech_\(key)") }
  static func setTech(_ key: String, _ t: String) { d.set(t, forKey: "vz_breath_tech_\(key)") }
  static func dur(_ tech: String) -> Int? { d.object(forKey: "vz_breath_dur_\(tech)") as? Int }
  static func setDur(_ tech: String, _ i: Int) { d.set(i, forKey: "vz_breath_dur_\(tech)") }
}

private let pillFill = Color(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1E / 255)
private let rowFill = Color.white.opacity(36 / 255)
private let dim = Color.white.opacity(140 / 255)

private func vzColor(_ hex: String) -> Color { Color(hex: hex) ?? .teal }

enum WatchRoute: Hashable {
  case modes(Bool) // true = State Control, false = Breathwork
  case state(Int)
  case breath(String)
  case stateDuration(Int)
  case technique(String)
  case breathDuration(String)
}

struct HomeView: View {
  @ObservedObject var catalog = WatchCatalog.shared
  @State private var path: [WatchRoute] = []

  /* Expliciet: met een private @State zou de gesynthetiseerde init niet
     zichtbaar zijn vanuit ContentView.swift. */
  init() {}

  var body: some View {
    NavigationStack(path: $path) {
      Group {
        if !catalog.hasCatalog {
          VStack(spacing: 8) {
            Text("Open VIBEZCORE on your phone once to set up your watch")
              .font(.system(size: 15))
              .foregroundColor(Color(white: 0xF4 / 255))
              .multilineTextAlignment(.center)
            /* Diagnose (18 okt 2026): wat het horloge van de iPhone ziet. */
            Text(PhoneConnector.shared.diagnostics())
              .font(.system(size: 9))
              .foregroundColor(.gray)
              .multilineTextAlignment(.center)
            Button("Retry") { PhoneConnector.shared.requestCatalog() }
              .font(.system(size: 13, weight: .semibold))
          }
          .padding(.horizontal, 14)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
          ScrollView {
            VStack(spacing: 0) {
              VMark().frame(width: 17, height: 16).padding(.bottom, 4)
              Text(greeting())
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.white)
              Text("Choose your session")
                .font(.system(size: 10))
                .foregroundColor(dim)
                .padding(.bottom, 9)
              VStack(spacing: 6) {
                if !catalog.states.isEmpty {
                  HomePill(icon: "dot.radiowaves.left.and.right", label: "State Control") { path.append(.modes(true)) }
                }
                if !catalog.breath.isEmpty {
                  HomePill(icon: "wind", label: "Breathwork") { path.append(.modes(false)) }
                }
              }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 18)
          }
        }
      }
      .background(Color.black)
      .navigationDestination(for: WatchRoute.self) { route in
        destination(route)
      }
    }
  }

  @ViewBuilder
  private func destination(_ route: WatchRoute) -> some View {
    switch route {
    case .modes(let isState):
      ModesView(isState: isState, path: $path)
    case .state(let mode):
      if let st = catalog.states.first(where: { $0.mode == mode }) {
        StateSetupView(entry: st, path: $path)
      }
    case .breath(let key):
      if let b = catalog.breath.first(where: { $0.key == key }) {
        BreathSetupView(entry: b, path: $path)
      }
    case .stateDuration(let mode):
      if let st = catalog.states.first(where: { $0.mode == mode }) {
        StateDurationView(entry: st)
      }
    case .technique(let key):
      if let b = catalog.breath.first(where: { $0.key == key }) {
        TechniqueView(entry: b)
      }
    case .breathDuration(let key):
      if let b = catalog.breath.first(where: { $0.key == key }) {
        BreathDurationView(entry: b)
      }
    }
  }

  private func greeting() -> String {
    let h = Calendar.current.component(.hour, from: Date())
    if h >= 5 && h <= 11 { return "Good morning" }
    if h >= 12 && h <= 17 { return "Good afternoon" }
    return "Good evening"
  }
}

/** Het V-teken (vereenvoudigd, zoals vz_vmark op de Galaxy Watch). */
private struct VMark: View {
  var body: some View {
    GeometryReader { g in
      Path { p in
        let w = g.size.width, h = g.size.height
        p.move(to: CGPoint(x: 0, y: 0))
        p.addLine(to: CGPoint(x: w * 0.30, y: 0))
        p.addLine(to: CGPoint(x: w * 0.55, y: h * 0.62))
        p.addLine(to: CGPoint(x: w * 0.78, y: 0))
        p.addLine(to: CGPoint(x: w, y: 0))
        p.addLine(to: CGPoint(x: w * 0.62, y: h))
        p.addLine(to: CGPoint(x: w * 0.42, y: h))
        p.closeSubpath()
      }
      .fill(Color.white)
    }
  }
}

private struct HomePill: View {
  let icon: String
  let label: String
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      HStack(spacing: 8) {
        Image(systemName: icon)
          .font(.system(size: 15))
          .foregroundColor(.white)
          .frame(width: 24, height: 24)
        Text(label)
          .font(.system(size: 12.5, weight: .bold))
          .foregroundColor(.white)
          .lineLimit(1)
        Spacer(minLength: 0)
        Image(systemName: "chevron.right")
          .font(.system(size: 11, weight: .semibold))
          .foregroundColor(.white.opacity(0.55))
      }
      .padding(.leading, 12)
      .padding(.trailing, 10)
      .frame(height: 44)
      .background(RoundedRectangle(cornerRadius: 28).fill(pillFill))
    }
    .buttonStyle(.plain)
  }
}

private struct Eyebrow: View {
  let text: String
  var body: some View {
    Text(text.uppercased())
      .font(.system(size: 10, weight: .bold))
      .tracking(1.4)
      .foregroundColor(dim)
  }
}

/** Waterbol zoals WaterCircleView: rand + golf in de kleur, tekst erin. */
private struct WaterBall: View {
  let color: Color
  let text: String?
  let size: CGFloat
  var body: some View {
    TimelineView(.animation) { tl in
      let t = tl.date.timeIntervalSinceReferenceDate
      Canvas { ctx, sz in
        let r = min(sz.width, sz.height) / 2
        let c = CGPoint(x: sz.width / 2, y: sz.height / 2)
        let circle = Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r))
        ctx.fill(circle, with: .color(Color(white: 0.04)))
        var wave = Path()
        let level = 0.55
        let baseY = c.y + r - CGFloat(level) * 2 * r
        wave.move(to: CGPoint(x: c.x - r, y: c.y + r))
        var x = c.x - r
        while x <= c.x + r {
          let y = baseY + sin((x / r) * .pi + CGFloat(t) * 2 * .pi / 6) * r * 0.06
          wave.addLine(to: CGPoint(x: x, y: y))
          x += 2
        }
        wave.addLine(to: CGPoint(x: c.x + r, y: c.y + r))
        wave.closeSubpath()
        ctx.clip(to: circle)
        ctx.fill(wave, with: .color(color.opacity(110 / 255)))
      }
      .overlay(Circle().stroke(color, lineWidth: 1.6))
      .overlay(
        Group {
          if let text = text {
            Text(text)
              .font(.system(size: size * 0.21, weight: .bold).monospacedDigit())
              .foregroundColor(.white)
          }
        }
      )
    }
    .frame(width: size, height: size)
  }
}

/** Ademende bol voor Breathwork (de Galaxy Watch toont daar de ademfiguur). */
private struct BreathingOrb: View {
  let color: Color
  let size: CGFloat
  @State private var grow = false
  var body: some View {
    ZStack {
      Circle()
        .fill(RadialGradient(colors: [color.opacity(0.35), .clear], center: .center, startRadius: 0, endRadius: size * 0.7))
        .frame(width: size * 1.3, height: size * 1.3)
      Circle()
        .fill(color.opacity(0.22))
        .overlay(Circle().stroke(color, lineWidth: 1.6))
        .frame(width: size * 0.8, height: size * 0.8)
        .scaleEffect(grow ? 1 : 0.9)
        .opacity(grow ? 1 : 0.8)
    }
    .frame(width: size, height: size)
    .onAppear {
      withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) { grow = true }
    }
  }
}

private struct ModePage: View {
  let eyebrow: String
  let name: String
  let use: String
  let color: Color
  let locked: Bool
  let visual: AnyView
  var body: some View {
    VStack(spacing: 0) {
      Eyebrow(text: eyebrow).padding(.bottom, 6)
      visual
      HStack(spacing: 6) {
        Text(name)
          .font(.system(size: 17, weight: .bold))
          .foregroundColor(color)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        if locked {
          Image(systemName: "lock.fill").font(.system(size: 12)).foregroundColor(dim)
        }
      }
      .padding(.top, 8)
      if !use.isEmpty {
        Text(use)
          .font(.system(size: 12))
          .foregroundColor(.white.opacity(150 / 255))
          .multilineTextAlignment(.center)
          .lineLimit(2)
          .padding(.horizontal, 14)
          .padding(.top, 2)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .contentShape(Rectangle())
  }
}

struct ModesView: View {
  let isState: Bool
  @Binding var path: [WatchRoute]
  @ObservedObject private var catalog = WatchCatalog.shared
  @State private var selection: String = ""

  static func minutesText(_ st: CatalogState) -> String {
    "\(Last.minutes(st.mode) ?? st.defaultMinutes):00"
  }

  var body: some View {
    TabView(selection: $selection) {
      if isState {
        ForEach(catalog.states) { (st: CatalogState) in
          ModePage(
            eyebrow: "State Control", name: st.name, use: st.use, color: vzColor(st.colorHex), locked: st.locked,
            visual: AnyView(WaterBall(color: vzColor(st.colorHex), text: Self.minutesText(st), size: 104))
          )
          .tag("s\(st.mode)")
          .onTapGesture { path.append(.state(st.mode)) }
        }
      } else {
        ForEach(catalog.breath) { (b: CatalogBreath) in
          ModePage(
            eyebrow: "Breathwork", name: b.name, use: b.use, color: vzColor(b.colorHex), locked: !catalog.breathAllowed(b),
            visual: AnyView(BreathingOrb(color: vzColor(b.colorHex), size: 100))
          )
          .tag("b\(b.key)")
          .onTapGesture { path.append(.breath(b.key)) }
        }
      }
    }
    .tabViewStyle(.verticalPage)
    .background(Color.black)
    .onAppear {
      if selection.isEmpty {
        if isState {
          let m = Last.stateMode() ?? catalog.states.first?.mode ?? 0
          selection = "s\(m)"
        } else {
          selection = "b\(Last.breathKey() ?? catalog.breath.first?.key ?? "")"
        }
      }
    }
  }
}

/** Afgeronde keuzeknop met label en waarde (Duration / Technique). */
private struct ChoicePill: View {
  let top: String
  let topColor: Color
  let value: String
  let tappable: Bool
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      VStack(alignment: .leading, spacing: 1) {
        Text(top).font(.system(size: 10)).foregroundColor(topColor)
        Text(tappable ? "\(value)  ›" : value)
          .font(.system(size: 14, weight: .bold))
          .foregroundColor(.white)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
      .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
      .padding(.leading, 16)
      .padding(.trailing, 14)
      .background(RoundedRectangle(cornerRadius: 20).fill(rowFill))
    }
    .buttonStyle(.plain)
    .disabled(!tappable)
  }
}

private struct StartPill: View {
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      Text("Start")
        .font(.system(size: 15, weight: .bold))
        .foregroundColor(Color(white: 0x0A / 255))
        .frame(maxWidth: .infinity, minHeight: 44)
        .background(RoundedRectangle(cornerRadius: 22).fill(Color.white))
    }
    .buttonStyle(.plain)
    .padding(.top, 6)
  }
}

private struct LockedLine: View {
  var body: some View {
    Text("Unlock with Premium on your phone")
      .font(.system(size: 11))
      .foregroundColor(.white.opacity(170 / 255))
      .multilineTextAlignment(.center)
      .padding(.top, 8)
  }
}

private func glow(_ c: Color) -> some View {
  RadialGradient(
    colors: [c.opacity(70 / 255), c.opacity(22 / 255), .black],
    center: UnitPoint(x: 0.5, y: 0.3), startRadius: 0, endRadius: 180
  )
  .ignoresSafeArea()
}

struct StateSetupView: View {
  let entry: CatalogState
  @Binding var path: [WatchRoute]

  var body: some View {
    let c = vzColor(entry.colorHex)
    let minutes = min(max(Last.minutes(entry.mode) ?? entry.defaultMinutes, entry.minMinutes), entry.maxMinutes)
    ScrollView {
      VStack(spacing: 0) {
        Eyebrow(text: "State Control")
        Text(entry.name)
          .font(.system(size: 18, weight: .bold))
          .foregroundColor(c)
          .padding(.top, 2)
          .padding(.bottom, 10)
        ChoicePill(
          top: minutes == entry.defaultMinutes ? "Recommended" : "Duration",
          topColor: minutes == entry.defaultMinutes ? c : dim,
          value: "\(minutes) min",
          tappable: true
        ) { path.append(.stateDuration(entry.mode)) }
        if entry.locked {
          LockedLine()
        } else {
          StartPill {
            Last.setStateMode(entry.mode)
            path.removeAll()
            StateSessionController.shared.startLocal(entry, minutes: minutes)
          }
        }
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 8)
    }
    .background(glow(c))
  }
}

struct BreathSetupView: View {
  let entry: CatalogBreath
  @Binding var path: [WatchRoute]
  @ObservedObject private var catalog = WatchCatalog.shared

  private func techIdx() -> Int {
    if let k = Last.tech(entry.key), let i = entry.techniques.firstIndex(where: { $0.key == k }) { return i }
    return min(max(0, entry.selectedIdx), entry.techniques.count - 1)
  }

  var body: some View {
    let c = vzColor(entry.colorHex)
    let ti = techIdx()
    let tech = entry.techniques[ti]
    let di = min(max(0, Last.dur(tech.key) ?? tech.defaultIdx), tech.durations.count - 1)
    let many = entry.techniques.count > 1
    ScrollView {
      VStack(spacing: 6) {
        Text(entry.name)
          .font(.system(size: 18, weight: .bold))
          .foregroundColor(.white)
          .padding(.bottom, 4)
        ChoicePill(
          top: many ? (ti == entry.recommendedIdx ? "Recommended" : "Last used") : "Technique",
          topColor: many ? c : dim,
          value: tech.name,
          tappable: many
        ) { path.append(.technique(entry.key)) }
        ChoicePill(top: "Duration", topColor: dim, value: tech.durations[di].label, tappable: true) {
          path.append(.breathDuration(entry.key))
        }
        if !catalog.breathAllowed(entry) {
          LockedLine()
        } else {
          StartPill {
            Last.setBreathKey(entry.key)
            Last.setTech(entry.key, tech.key)
            path.removeAll()
            BreathSessionController.shared.startLocal(entry, technique: tech, duration: tech.durations[di], free: entry.locked)
          }
        }
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 8)
    }
    .background(glow(c))
  }
}

/** Rij in een kiezer: afgerond, huidige met rand in de kleur. */
private struct PickRow: View {
  let title: String
  let sub: String?
  let subColor: Color
  let current: Bool
  let color: Color
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      VStack(spacing: 1) {
        Text(title)
          .font(.system(size: 16, weight: .bold))
          .foregroundColor(.white)
          .multilineTextAlignment(.center)
          .lineLimit(2)
        if let sub = sub {
          Text(sub).font(.system(size: 10)).foregroundColor(subColor)
        }
      }
      .frame(maxWidth: .infinity, minHeight: 50)
      .padding(.horizontal, 10)
      .background(
        RoundedRectangle(cornerRadius: 24).fill(rowFill)
          .overlay(RoundedRectangle(cornerRadius: 24).stroke(current ? color.opacity(170 / 255) : .clear, lineWidth: 1.5))
      )
    }
    .buttonStyle(.plain)
  }
}

struct StateDurationView: View {
  let entry: CatalogState
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    let c = vzColor(entry.colorHex)
    let cur = Last.minutes(entry.mode) ?? entry.defaultMinutes
    ScrollViewReader { proxy in
      ScrollView {
        VStack(spacing: 6) {
          Text(entry.name).font(.system(size: 13, weight: .bold)).foregroundColor(c)
          ForEach(entry.minMinutes...max(entry.minMinutes, entry.maxMinutes), id: \.self) { (m: Int) in
            PickRow(
              title: "\(m) min", sub: m == entry.defaultMinutes ? "Recommended" : nil, subColor: c,
              current: m == cur, color: c
            ) {
              Last.setMinutes(entry.mode, m)
              dismiss()
            }
            .id(m)
          }
        }
        .padding(.horizontal, 8)
      }
      .onAppear { proxy.scrollTo(cur, anchor: .center) }
    }
    .background(Color.black)
  }
}

struct TechniqueView: View {
  let entry: CatalogBreath
  @Environment(\.dismiss) private var dismiss

  private func tag(for t: CatalogTechnique, curKey: String) -> String? {
    if t.id == entry.recommendedIdx { return "Recommended" }
    return t.key == curKey ? "Last used" : nil
  }

  private func sub(for t: CatalogTechnique, curKey: String) -> String? {
    if let tag = tag(for: t, curKey: curKey) { return tag }
    return t.level.isEmpty ? nil : t.level.capitalized
  }
  var body: some View {
    let c = vzColor(entry.colorHex)
    let curKey = Last.tech(entry.key) ?? entry.techniques[min(entry.selectedIdx, entry.techniques.count - 1)].key
    ScrollView {
      VStack(spacing: 6) {
        Text(entry.name).font(.system(size: 13, weight: .bold)).foregroundColor(c)
        ForEach(entry.techniques) { (t: CatalogTechnique) in
          PickRow(
            title: t.name, sub: sub(for: t, curKey: curKey),
            subColor: tag(for: t, curKey: curKey) != nil ? c : dim, current: t.key == curKey, color: c
          ) {
            Last.setTech(entry.key, t.key)
            dismiss()
          }
        }
      }
      .padding(.horizontal, 8)
    }
    .background(Color.black)
  }
}

struct BreathDurationView: View {
  let entry: CatalogBreath
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    let c = vzColor(entry.colorHex)
    let techKey = Last.tech(entry.key) ?? entry.techniques[min(entry.selectedIdx, entry.techniques.count - 1)].key
    let tech = entry.techniques.first(where: { $0.key == techKey }) ?? entry.techniques[0]
    let cur = min(max(0, Last.dur(tech.key) ?? tech.defaultIdx), tech.durations.count - 1)
    ScrollViewReader { proxy in
      ScrollView {
        VStack(spacing: 6) {
          Text(tech.name).font(.system(size: 12, weight: .bold)).foregroundColor(c).multilineTextAlignment(.center)
          ForEach(tech.durations) { (d: CatalogDuration) in
            PickRow(
              title: d.label, sub: d.id == tech.defaultIdx ? "Recommended" : nil, subColor: c,
              current: d.id == cur, color: c
            ) {
              Last.setDur(tech.key, d.id)
              dismiss()
            }
            .id(d.id)
          }
        }
        .padding(.horizontal, 8)
      }
      .onAppear { proxy.scrollTo(cur, anchor: .center) }
    }
    .background(Color.black)
  }
}
