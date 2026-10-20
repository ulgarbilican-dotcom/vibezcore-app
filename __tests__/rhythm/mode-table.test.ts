/* De vijf State Control-/bracelet-modi — tabel uit CLAUDE.md §5 (bindend),
   bron van waarheid in code: services/ble-contract.ts ModeMeta. Kleuren
   volgen src/data/breath-states.ts (zelfde toestand = zelfde kleur). */
import {
  BleCommand,
  BraceletMode,
  MODES,
  QUICK_SESSIONS,
  QUICK_SESSION_MINUTES,
  clampDuration,
  getModeMeta,
} from '@/services/ble-contract';
import { BREATH_STATES } from '@/data/breath-states';
import { BREATH_STATE_MODE } from '@/data/state-usage';
import { STATE_ZONES, ZONE_ORDER, zoneFor } from '@/data/state-zones';
import { BREATHWORK_CHOOSER } from '@/data/breathwork-modes';

/* CLAUDE.md §5 — Idx | App-naam | Kleur | min – max | default */
const CLAUDE_MD_TABLE: [BraceletMode, string, string, number, number, number][] = [
  [BraceletMode.Gamma, 'Boost', '#F5A524', 5, 20, 10],
  [BraceletMode.Beta, 'Sharp Focus', '#3E9BFF', 5, 30, 15],
  [BraceletMode.Alpha, 'Calm Control', '#B478FF', 5, 30, 18],
  [BraceletMode.Theta, 'Clarity & Relax', '#FFFFFF', 10, 45, 25],
  [BraceletMode.Delta, 'Sleep', '#00A3A3', 10, 50, 30],
];

describe('ModeMeta = CLAUDE.md §5', () => {
  test('index-volgorde 0..4 = Gamma, Beta, Alpha, Theta, Delta', () => {
    expect([BraceletMode.Gamma, BraceletMode.Beta, BraceletMode.Alpha, BraceletMode.Theta, BraceletMode.Delta]).toEqual([0, 1, 2, 3, 4]);
    expect(MODES).toHaveLength(5);
    MODES.forEach((m, i) => expect(m.mode).toBe(i));
  });

  test.each(CLAUDE_MD_TABLE)('modus %i: %s %s %i–%i min, default %i', (mode, name, color, min, max, def) => {
    const m = getModeMeta(mode);
    expect(m.name).toBe(name);
    expect(m.color.toUpperCase()).toBe(color);
    expect(m.minMinutes).toBe(min);
    expect(m.maxMinutes).toBe(max);
    expect(m.defaultMinutes).toBe(def);
  });

  test('min < default < max voor elke modus', () => {
    for (const m of MODES) {
      expect(m.minMinutes).toBeLessThan(m.defaultMinutes);
      expect(m.defaultMinutes).toBeLessThan(m.maxMinutes);
    }
  });

  test('elke modus heeft een eigen aanbevolen duur', () => {
    expect(new Set(MODES.map((m) => m.defaultMinutes)).size).toBe(MODES.length);
  });

  test('BLE-commando-bytes (spec §8.1)', () => {
    expect(BleCommand.Start).toBe(0x01);
    expect(BleCommand.Stop).toBe(0x02);
    expect(BleCommand.StatusRequest).toBe(0x03);
  });

  test('blurbs gebruiken geen verboden wetenschapstaal', () => {
    const banned = /brain ?wave|hersengolf|synchroni|clinically|klinisch|entrainment/i;
    for (const m of MODES) expect(m.blurb).not.toMatch(banned);
  });
});

describe('clampDuration', () => {
  test('klemt op min/max en rondt binnen het bereik af', () => {
    for (const m of MODES) {
      expect(clampDuration(m.mode, 0)).toBe(m.minMinutes);
      expect(clampDuration(m.mode, m.minMinutes - 1)).toBe(m.minMinutes);
      expect(clampDuration(m.mode, m.maxMinutes + 1)).toBe(m.maxMinutes);
      expect(clampDuration(m.mode, 999)).toBe(m.maxMinutes);
      expect(clampDuration(m.mode, m.defaultMinutes)).toBe(m.defaultMinutes);
      expect(clampDuration(m.mode, m.defaultMinutes + 0.4)).toBe(m.defaultMinutes);
    }
  });

  test('resultaat ligt altijd binnen [min, max] en is een geheel getal', () => {
    for (const m of MODES) {
      for (let v = -5; v <= 60; v += 0.5) {
        const c = clampDuration(m.mode, v);
        expect(c).toBeGreaterThanOrEqual(m.minMinutes);
        expect(c).toBeLessThanOrEqual(m.maxMinutes);
        expect(Number.isInteger(c)).toBe(true);
      }
    }
  });
});

describe('modus ↔ ademtoestand', () => {
  test('mapping boost/focus/calm/clarity/rest → Gamma/Beta/Alpha/Theta/Delta', () => {
    expect(BREATH_STATE_MODE).toEqual({
      boost: BraceletMode.Gamma,
      focus: BraceletMode.Beta,
      calm: BraceletMode.Alpha,
      clarity: BraceletMode.Theta,
      rest: BraceletMode.Delta,
    });
  });

  test('bracelet-kleur = accent van de ademtoestand (één product, één kleur)', () => {
    for (const [key, mode] of Object.entries(BREATH_STATE_MODE)) {
      const st = BREATH_STATES[key as keyof typeof BREATH_STATES];
      expect(getModeMeta(mode).color.toUpperCase()).toBe(st.accent.toUpperCase());
    }
  });

  test('ademtoestand-eyebrow volgt de app-naam (SLEEP, SHARP FOCUS, …)', () => {
    expect(BREATH_STATES.rest.eyebrow).toBe('SLEEP');
    expect(BREATH_STATES.boost.eyebrow).toBe('BOOST');
    expect(BREATH_STATES.focus.eyebrow).toBe('SHARP FOCUS');
  });

  test('breathwork-chooser: één optie per modus, in volgorde 0..4, positieve duur', () => {
    expect(BREATHWORK_CHOOSER.map((o) => o.mode)).toEqual([0, 1, 2, 3, 4]);
    for (const o of BREATHWORK_CHOOSER) expect(o.minutes).toBeGreaterThan(0);
  });
});

describe('snelle sessies', () => {
  test('5 min, Quick Chill = Clarity & Relax, Quick Boost = Boost', () => {
    expect(QUICK_SESSION_MINUTES).toBe(5);
    expect(QUICK_SESSIONS.find((q) => q.key === 'chill')?.mode).toBe(BraceletMode.Theta);
    expect(QUICK_SESSIONS.find((q) => q.key === 'boost')?.mode).toBe(BraceletMode.Gamma);
  });
});

describe('duurzones (state-zones.ts) volgen ModeMeta', () => {
  test.each(MODES.map((m) => [m.name, m] as const))('%s: zones dekken min..max aaneengesloten', (_n, m) => {
    const z = STATE_ZONES[m.mode];
    const ranges = ZONE_ORDER.map((k) => z[k]).filter(Boolean) as [number, number][];
    expect(ranges[0][0]).toBe(m.minMinutes);
    expect(ranges[ranges.length - 1][1]).toBe(m.maxMinutes);
    for (let i = 1; i < ranges.length; i += 1) expect(ranges[i][0]).toBe(ranges[i - 1][1] + 1);
    for (const [a, b] of ranges) expect(a).toBeLessThanOrEqual(b);
  });

  test('Recommended begint op de aanbevolen duur', () => {
    for (const m of MODES) expect(STATE_ZONES[m.mode].recommended?.[0]).toBe(m.defaultMinutes);
  });

  test('zoneFor: default = recommended, min = short, max = long; elke minuut heeft een zone', () => {
    for (const m of MODES) {
      expect(zoneFor(m.mode, m.defaultMinutes)).toBe('recommended');
      expect(zoneFor(m.mode, m.minMinutes)).toBe('short');
      expect(zoneFor(m.mode, m.maxMinutes)).toBe('long');
      for (let v = m.minMinutes; v <= m.maxMinutes; v += 1) {
        expect(ZONE_ORDER).toContain(zoneFor(m.mode, v));
      }
    }
  });
});
