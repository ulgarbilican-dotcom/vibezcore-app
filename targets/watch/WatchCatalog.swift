import Combine
import Foundation
import WatchKit

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Catalogus op de Apple Watch (18 okt 2026)

   Operator: "starten via de smartwatch zelf" (zoals de Galaxy Watch). De
   iPhone stuurt dezelfde catalogus als naar Wear OS (src/services/
   watch-catalog.ts, `buildWatchCatalog`): per toestand de technieken met
   fasen en duurstappen, State Control met het ritme dat de telefoon nu zou
   spelen, en wat vergrendeld is. Bewaard in UserDefaults, zodat het horloge
   ook zonder iPhone in de buurt kan starten.

   Sessies die hier gestart worden, gaan na afloop terug naar de iPhone
   (`watch_log`) en komen daar in de geschiedenis.
   ───────────────────────────────────────────────────────────────────────── */

struct CatalogDuration: Identifiable {
  let id: Int
  let label: String
  let minutes: Int
  let rounds: Int
}

struct CatalogTechnique: Identifiable {
  let id: Int
  let key: String
  let name: String
  let level: String
  /// [{key, secs, via}] — rechtstreeks bruikbaar voor BreathSessionController.
  let phases: [[String: Any]]
  let durations: [CatalogDuration]
  let defaultIdx: Int
}

struct CatalogBreath: Identifiable {
  var id: String { key }
  let key: String
  let name: String
  let use: String
  let colorHex: String
  let locked: Bool
  let recommendedIdx: Int
  let selectedIdx: Int
  let techniques: [CatalogTechnique]
}

struct CatalogState: Identifiable {
  var id: Int { mode }
  let mode: Int
  let name: String
  let use: String
  let colorHex: String
  let minMinutes: Int
  let maxMinutes: Int
  let defaultMinutes: Int
  let locked: Bool
  /// startBpm, targetBpm, holdSec, rampSec (+ sterkte) — voor state_start.
  let params: [String: Any]
}

final class WatchCatalog: ObservableObject {
  static let shared = WatchCatalog()

  @Published private(set) var states: [CatalogState] = []
  @Published private(set) var breath: [CatalogBreath] = []
  @Published private(set) var breathFreeOnce = false
  /** De gratis ademsessie is op dit horloge al gebruikt (ook zonder iPhone). */
  @Published private(set) var freeUsedHere: Bool

  private let storeKey = "vz_watch_catalog_v1"
  private let freeKey = "vz_watch_free_used_v1"

  init() {
    freeUsedHere = UserDefaults.standard.bool(forKey: freeKey)
    if let json = UserDefaults.standard.string(forKey: storeKey) {
      parse(json)
    }
  }

  var hasCatalog: Bool { !states.isEmpty || !breath.isEmpty }

  /** Nieuwe catalogus van de iPhone (altijd op main). */
  func load(_ json: String) {
    guard parse(json) else { return }
    UserDefaults.standard.set(json, forKey: storeKey)
  }

  /** Mag deze ademtoestand nu gestart worden? */
  func breathAllowed(_ b: CatalogBreath) -> Bool {
    if !b.locked { return true }
    return breathFreeOnce && !freeUsedHere
  }

  func markFreeUsed() {
    freeUsedHere = true
    UserDefaults.standard.set(true, forKey: freeKey)
  }

  @discardableResult
  private func parse(_ json: String) -> Bool {
    guard
      let data = json.data(using: .utf8),
      let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    else { return false }

    let rawStates = root["state"] as? [[String: Any]] ?? []
    let parsedStates: [CatalogState] = rawStates.compactMap { s in
      guard let mode = int(s["key"]), let name = s["name"] as? String else { return nil }
      return CatalogState(
        mode: mode,
        name: name,
        use: s["use"] as? String ?? "",
        colorHex: s["colorHex"] as? String ?? "#00A3A3",
        minMinutes: int(s["minMinutes"]) ?? 5,
        maxMinutes: int(s["maxMinutes"]) ?? 30,
        defaultMinutes: int(s["defaultMinutes"]) ?? 10,
        locked: s["locked"] as? Bool ?? false,
        params: s["params"] as? [String: Any] ?? [:]
      )
    }

    let rawBreath = root["breath"] as? [[String: Any]] ?? []
    let parsedBreath: [CatalogBreath] = rawBreath.compactMap { b in
      guard let key = b["key"] as? String, let name = b["name"] as? String else { return nil }
      let techs = (b["techniques"] as? [[String: Any]] ?? []).enumerated().compactMap { (i, t) -> CatalogTechnique? in
        guard let tkey = t["key"] as? String, let tname = t["name"] as? String else { return nil }
        let phases = (t["phases"] as? [[String: Any]] ?? []).map { p -> [String: Any] in
          ["key": p["key"] as? String ?? "inhale", "secs": int(p["secs"]) ?? 4, "via": p["via"] as? String ?? ""]
        }
        let durs = (t["durations"] as? [[String: Any]] ?? []).enumerated().map { (j, d) in
          CatalogDuration(
            id: j,
            label: d["label"] as? String ?? "\(int(d["minutes"]) ?? 5) min",
            minutes: int(d["minutes"]) ?? 5,
            rounds: max(1, int(d["rounds"]) ?? 1)
          )
        }
        guard !phases.isEmpty, !durs.isEmpty else { return nil }
        return CatalogTechnique(
          id: i, key: tkey, name: tname, level: t["level"] as? String ?? "",
          phases: phases, durations: durs,
          defaultIdx: min(max(0, int(t["defaultIdx"]) ?? 0), durs.count - 1)
        )
      }
      guard !techs.isEmpty else { return nil }
      return CatalogBreath(
        key: key,
        name: name,
        use: b["use"] as? String ?? "",
        colorHex: b["colorHex"] as? String ?? "#00A3A3",
        locked: b["locked"] as? Bool ?? false,
        recommendedIdx: min(max(0, int(b["recommendedIdx"]) ?? 0), techs.count - 1),
        selectedIdx: min(max(0, int(b["selectedIdx"]) ?? 0), techs.count - 1),
        techniques: techs
      )
    }

    guard !parsedStates.isEmpty || !parsedBreath.isEmpty else { return false }
    states = parsedStates
    breath = parsedBreath
    breathFreeOnce = root["breathFreeOnce"] as? Bool ?? false
    if let st = root["strength"] as? String { WatchSettings.shared.adoptFromPhone(st) }
    return true
  }

  private func int(_ v: Any?) -> Int? {
    if let i = v as? Int { return i }
    if let d = v as? Double { return Int(d) }
    if let n = v as? NSNumber { return n.intValue }
    return nil
  }
}

/* Een sessie die op het horloge zelf liep, naar de iPhone (geschiedenis).
   Zelfde vorm als de Galaxy Watch-records (watch-catalog.ts importeert ze). */
enum WatchSessionLog {
  static func send(_ record: [String: Any]) {
    var r = record
    r["id"] = UUID().uuidString
    guard
      let data = try? JSONSerialization.data(withJSONObject: r),
      let json = String(data: data, encoding: .utf8)
    else { return }
    PhoneConnector.shared.send(["type": "watch_log", "record": json])
  }
}

/* Trilsterkte op het horloge (19 okt 2026, operator: "wat als iemand enkel de
   watch wil gebruiken? … sterkste stand moet echt het maximum zijn").
   Eén waarde voor telefoon en horloge: de telefoon stuurt ze mee (catalogus,
   sessiestart); wijzig je ze hier, dan gaat ze naar de telefoon en geldt ze
   daar ook. watchOS laat geen vrije sterkte toe, enkel vaste trilsoorten:
     Soft   = zachte tik, enkel de eerste slag van de hartslag
     Medium = zachte tik, beide slagen
     Soft 1 · Medium 2 · Strong 4 stille tikken per slag (geen toon; .start gaf een bel)
     */
final class WatchSettings: ObservableObject {
  static let shared = WatchSettings()
  static let levels = ["soft", "medium", "strong"]

  @Published private(set) var strength: String
  private let key = "vz_watch_strength_v1"

  init() {
    strength = UserDefaults.standard.string(forKey: key) ?? "medium"
  }

  func adoptFromPhone(_ s: String) {
    guard WatchSettings.levels.contains(s), s != strength else { return }
    strength = s
    UserDefaults.standard.set(s, forKey: key)
  }

  func setFromWatch(_ s: String) {
    guard WatchSettings.levels.contains(s) else { return }
    adoptFromPhone(s)
    PhoneConnector.shared.send(["type": "watch_action", "action": "strength:\(s)", "kind": "settings"])
  }

  /// Eén tik op de pols. Soft/Medium: één stille tik. Strong: drie stille
  /// tikken vlak na elkaar — voelt duidelijk sterker en speelt GEEN toon
  /// (operator, build 50: ".start gaf een bel bij elke slag").
  /// 19 okt 2026 (operator, build 52: "stijl is goed, kan het nog harder
  /// voor maximum?"): Soft 1 tik · Medium 2 · Strong 4 stille tikken vlak na
  /// elkaar (40 ms) — de sterkste stille puls die watchOS toelaat.
  func tap() {
    let d = WKInterfaceDevice.current()
    d.play(.click)
    let extra = strength == "strong" ? 3 : (strength == "medium" ? 1 : 0)
    guard extra > 0 else { return }
    for i in 1...extra {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.04 * Double(i)) { d.play(.click) }
    }
  }
  /// Tweede slag van de hartslag (Soft: geen).
  var playsDub: Bool { strength != "soft" }
}
