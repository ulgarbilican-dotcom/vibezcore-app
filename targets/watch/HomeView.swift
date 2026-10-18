import SwiftUI

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Startscherm op de Apple Watch (18 okt 2026)

   Operator: "starten via de smartwatch zelf" — zoals de Galaxy Watch. Twee
   lijsten (State Control en Breathwork) met kleurstip, naam en de korte
   "wanneer"-regel. Tik → duur kiezen met de Digital Crown (en bij
   Breathwork eerst de techniek) → Start. De sessie loopt dan op het
   horloge zelf, ook zonder iPhone in de buurt.

   Zonder catalogus (de iPhone-app nog nooit geopend sinds installatie):
   een korte uitleg in plaats van een lege lijst.
   ───────────────────────────────────────────────────────────────────────── */

struct HomeView: View {
  @ObservedObject var catalog = WatchCatalog.shared

  var body: some View {
    NavigationStack {
      if !catalog.hasCatalog {
        VStack(spacing: 8) {
          Text("VIBEZCORE")
            .font(.system(size: 11, weight: .bold))
            .tracking(1.6)
            .foregroundColor(.gray)
          Text("Open VIBEZCORE on your iPhone once to set up your watch")
            .font(.system(size: 14))
            .multilineTextAlignment(.center)
            .foregroundColor(.white)
        }
        .padding(.horizontal, 12)
      } else {
        List {
          if !catalog.states.isEmpty {
            Section(header: SectionTitle(text: "State Control")) {
              ForEach(catalog.states) { st in
                NavigationLink(value: HomeRoute.state(st.mode)) {
                  StateRow(name: st.name, use: st.use, colorHex: st.colorHex, locked: st.locked)
                }
              }
            }
          }
          if !catalog.breath.isEmpty {
            Section(header: SectionTitle(text: "Breathwork")) {
              ForEach(catalog.breath) { b in
                NavigationLink(value: HomeRoute.breath(b.key)) {
                  StateRow(name: b.name, use: b.use, colorHex: b.colorHex, locked: !catalog.breathAllowed(b))
                }
              }
            }
          }
        }
        .navigationTitle("VIBEZCORE")
        .navigationDestination(for: HomeRoute.self) { route in
          switch route {
          case .state(let mode):
            if let st = catalog.states.first(where: { $0.mode == mode }) {
              StateSetupView(entry: st)
            }
          case .breath(let key):
            if let b = catalog.breath.first(where: { $0.key == key }) {
              BreathSetupView(entry: b)
            }
          }
        }
      }
    }
  }
}

enum HomeRoute: Hashable {
  case state(Int)
  case breath(String)
}

private struct SectionTitle: View {
  let text: String
  var body: some View {
    Text(text.uppercased())
      .font(.system(size: 11, weight: .bold))
      .tracking(1.2)
      .foregroundColor(.gray)
  }
}

private struct StateRow: View {
  let name: String
  let use: String
  let colorHex: String
  let locked: Bool

  var body: some View {
    HStack(spacing: 10) {
      Circle()
        .fill(Color(hex: colorHex) ?? .teal)
        .frame(width: 10, height: 10)
      VStack(alignment: .leading, spacing: 2) {
        Text(name)
          .font(.system(size: 16, weight: .semibold))
          .foregroundColor(.white)
          .lineLimit(1)
        if !use.isEmpty {
          Text(use)
            .font(.system(size: 12))
            .foregroundColor(.gray)
            .lineLimit(2)
        }
      }
      Spacer(minLength: 0)
      if locked {
        Image(systemName: "lock.fill")
          .font(.system(size: 12))
          .foregroundColor(.gray)
      }
    }
    .padding(.vertical, 4)
  }
}

/** Premium nodig: geen aankoop op het horloge, enkel de weg wijzen. */
private struct LockedNote: View {
  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "lock.fill").foregroundColor(.gray)
      Text("Unlock with VIBEZCORE Premium in the iPhone app")
        .font(.system(size: 13))
        .multilineTextAlignment(.center)
        .foregroundColor(.white)
    }
    .padding(.horizontal, 8)
  }
}

private struct StartButton: View {
  let colorHex: String
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      Text("Start")
        .font(.system(size: 16, weight: .bold))
        .frame(maxWidth: .infinity)
    }
    .tint(Color(hex: colorHex) ?? .teal)
  }
}

struct StateSetupView: View {
  let entry: CatalogState
  @State private var minutes: Int
  @Environment(\.dismiss) private var dismiss

  init(entry: CatalogState) {
    self.entry = entry
    _minutes = State(initialValue: min(max(entry.defaultMinutes, entry.minMinutes), entry.maxMinutes))
  }

  var body: some View {
    if entry.locked {
      LockedNote().navigationTitle(entry.name)
    } else {
      VStack(spacing: 8) {
        Picker("Duration", selection: $minutes) {
          ForEach(entry.minMinutes...max(entry.minMinutes, entry.maxMinutes), id: \.self) { m in
            Text("\(m) min").tag(m)
          }
        }
        .pickerStyle(.wheel)
        .frame(height: 70)
        StartButton(colorHex: entry.colorHex) {
          StateSessionController.shared.startLocal(entry, minutes: minutes)
          dismiss()
        }
      }
      .navigationTitle(entry.name)
    }
  }
}

struct BreathSetupView: View {
  let entry: CatalogBreath
  @ObservedObject private var catalog = WatchCatalog.shared
  @State private var techIdx: Int
  @State private var durIdx: Int
  @Environment(\.dismiss) private var dismiss

  init(entry: CatalogBreath) {
    self.entry = entry
    let t = min(max(0, entry.selectedIdx), entry.techniques.count - 1)
    _techIdx = State(initialValue: t)
    _durIdx = State(initialValue: entry.techniques[t].defaultIdx)
  }

  private var tech: CatalogTechnique { entry.techniques[min(techIdx, entry.techniques.count - 1)] }

  var body: some View {
    if !catalog.breathAllowed(entry) {
      LockedNote().navigationTitle(entry.name)
    } else {
      ScrollView {
        VStack(spacing: 8) {
          if entry.techniques.count > 1 {
            Picker("Technique", selection: $techIdx) {
              ForEach(entry.techniques) { t in
                Text(t.id == entry.recommendedIdx ? "\(t.name) · For you" : t.name).tag(t.id)
              }
            }
            .frame(height: 56)
            .onChange(of: techIdx) { _, newIdx in
              durIdx = entry.techniques[min(newIdx, entry.techniques.count - 1)].defaultIdx
            }
          } else {
            Text(tech.name)
              .font(.system(size: 14, weight: .semibold))
              .foregroundColor(.white)
          }
          Picker("Duration", selection: $durIdx) {
            ForEach(tech.durations) { d in
              Text(d.label).tag(d.id)
            }
          }
          .pickerStyle(.wheel)
          .frame(height: 64)
          StartButton(colorHex: entry.colorHex) {
            let d = tech.durations[min(durIdx, tech.durations.count - 1)]
            BreathSessionController.shared.startLocal(entry, technique: tech, duration: d, free: entry.locked)
            dismiss()
          }
        }
      }
      .navigationTitle(entry.name)
    }
  }
}
