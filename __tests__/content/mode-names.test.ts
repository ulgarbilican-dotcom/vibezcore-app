/* CLAUDE.md §5: de vijf modi/toestanden — namen (Rest & Reset → Sleep,
   Clarity → Clarity & Relax, 22 sept 2026), kleuren (5 aug / 5 okt 2026)
   en duren (16 sept / 7 okt / 11 okt 2026). Bron van waarheid:
   services/ble-contract.ts (MODES) en data/breath-states.ts. */
import { BraceletMode, MODES } from '@/services/ble-contract';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { findInDisplayText, fmt, stringFields } from './source-strings';

const TABLE = [
  { mode: BraceletMode.Gamma, name: 'Boost', color: '#F5A524', min: 5, max: 20, def: 10 },
  { mode: BraceletMode.Beta, name: 'Sharp Focus', color: '#3E9BFF', min: 5, max: 30, def: 15 },
  { mode: BraceletMode.Alpha, name: 'Calm Control', color: '#B478FF', min: 5, max: 30, def: 18 },
  { mode: BraceletMode.Theta, name: 'Clarity & Relax', color: '#FFFFFF', min: 10, max: 45, def: 25 },
  { mode: BraceletMode.Delta, name: 'Sleep', color: '#00A3A3', min: 10, max: 50, def: 30 },
];
const STATE_ORDER: BreathStateKey[] = ['boost', 'focus', 'calm', 'clarity', 'rest'];

describe('de vijf modi', () => {
  test('MODES: indices en namen in de bindende volgorde', () => {
    expect(MODES.map((m) => [m.mode, m.name])).toEqual(TABLE.map((t) => [t.mode, t.name]));
    expect(TABLE.map((t) => t.mode)).toEqual([0, 1, 2, 3, 4]);
  });

  test('MODES: kleuren en duur (min/max/aanbevolen) volgen de tabel', () => {
    expect(
      MODES.map((m) => ({ c: m.color.toUpperCase(), min: m.minMinutes, max: m.maxMinutes, def: m.defaultMinutes })),
    ).toEqual(TABLE.map((t) => ({ c: t.color, min: t.min, max: t.max, def: t.def })));
  });

  test('ademtoestanden: eyebrow = modusnaam in hoofdletters, zelfde volgorde', () => {
    expect(Object.keys(BREATH_STATES)).toEqual(STATE_ORDER);
    expect(STATE_ORDER.map((k) => BREATH_STATES[k].eyebrow)).toEqual(TABLE.map((t) => t.name.toUpperCase()));
  });

  test('bracelet-kleur = kleur van de ademtoestand (één product, één kleur)', () => {
    STATE_ORDER.forEach((k, i) => {
      expect(BREATH_STATES[k].accent.toUpperCase()).toBe(MODES[i].color.toUpperCase());
    });
  });

  test('de oude naam "Rest & Reset" komt nergens meer voor', () => {
    expect(fmt(findInDisplayText(/\brest\s*(&|&amp;|and|en)\s*reset\b/i))).toEqual([]);
  });

  test('geen modus-label "Clarity" zonder "& Relax" of "Rest" als modusnaam', () => {
    const labels = stringFields(['name', 'eyebrow', 'modeName', 'stateName', 'mode', 'label']).filter((f) =>
      /^(clarity|rest|rest & reset)$/i.test(f.text.trim()),
    );
    expect(fmt(labels)).toEqual([]);
  });
});
