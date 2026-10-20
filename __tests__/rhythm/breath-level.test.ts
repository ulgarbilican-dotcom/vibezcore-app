/* Aanbevolen duur en ritme per techniek × ervaring (src/utils/breath-level.ts)
   en de duurkeuzes die daaruit volgen (src/utils/duration-options.ts). */
import { BREATH_STATES, cycleSeconds, type BreathStateKey } from '@/data/breath-states';
import {
  SESSIONS_PER_STEP,
  levelForTechnique,
  personalRecommendedMinutes,
  recommendedForLevel,
  techniqueForLevel,
  type UserLevel,
} from '@/utils/breath-level';
import { CUSTOM_CEILING_MIN, NO_EXTEND_TECHNIQUE_KEYS, durationOptionsFor } from '@/utils/duration-options';
import type { BreathHistoryEntry } from '@/utils/breath-history';

const LEVELS: UserLevel[] = ['beginner', 'intermediate', 'advanced'];
const PAIRS: [string, BreathStateKey, string][] = (Object.keys(BREATH_STATES) as BreathStateKey[]).flatMap((sk) =>
  BREATH_STATES[sk].techniques.map((t) => [`${sk}:${t.key}`, sk, t.key] as [string, BreathStateKey, string]),
);
const techOf = (sk: BreathStateKey, tk: string) => BREATH_STATES[sk].techniques.find((t) => t.key === tk)!;
const presetsOf = (sk: BreathStateKey, tk: string) => techOf(sk, tk).durations ?? BREATH_STATES[sk].durations;

const DAY = 864e5;
function history(sk: BreathStateKey, tk: string, n: number, firstAgoDays = 0): BreathHistoryEntry[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => ({
    key: sk,
    name: sk,
    ts: now - firstAgoDays * DAY + i * 1000,
    durSec: 300,
    rounds: 10,
    completed: true,
    techniqueKey: tk,
  })) as BreathHistoryEntry[];
}

describe.each(PAIRS)('%s', (_id, sk, tk) => {
  test('elke techniek heeft een plan (aanbeveling per niveau)', () => {
    for (const l of LEVELS) expect(recommendedForLevel(sk, tk, l)).not.toBeNull();
  });

  test('aanbeveling daalt nooit bij meer ervaring', () => {
    const recs = LEVELS.map((l) => recommendedForLevel(sk, tk, l)!);
    expect(recs[1]).toBeGreaterThanOrEqual(recs[0]);
    expect(recs[2]).toBeGreaterThanOrEqual(recs[1]);
  });

  test('ritme per niveau: zelfde fasen, positieve seconden, cyclus daalt nooit', () => {
    const tech = techOf(sk, tk);
    const cycles = LEVELS.map((l) => {
      const t = techniqueForLevel(sk, tech, l);
      expect(t.phases.map((p) => p.key)).toEqual(tech.phases.map((p) => p.key));
      for (const p of t.phases) expect(p.secs).toBeGreaterThan(0);
      return cycleSeconds(t);
    });
    expect(cycles[1]).toBeGreaterThanOrEqual(cycles[0]);
    expect(cycles[2]).toBeGreaterThanOrEqual(cycles[1]);
  });

  test('persoonlijke aanbeveling per niveau is een kiesbare duur', () => {
    const presets = presetsOf(sk, tk);
    const { options } = durationOptionsFor(sk, tk);
    const values = options.map((o) => o.value);
    for (const l of LEVELS) {
      const rec = personalRecommendedMinutes(sk, tk, presets, l);
      expect(rec).not.toBeNull();
      expect(values).toContain(rec);
    }
  });

  test('duurkeuzes: oplopende hele minuten, vanaf de kleinste preset, tot plafond of grootste preset', () => {
    const presets = presetsOf(sk, tk);
    const { options, recommended } = durationOptionsFor(sk, tk);
    const values = options.map((o) => o.value);
    expect(values.length).toBeGreaterThan(0);
    expect(values[0]).toBe(Math.min(...presets.map((d) => d.minutes)));
    for (let i = 1; i < values.length; i += 1) expect(values[i]).toBeGreaterThan(values[i - 1]);
    for (const o of options) expect(o.label).toBe(`${o.value} min`);
    const isCycles = presets.some((d) => d.cycles != null);
    if (isCycles) {
      expect(values).toEqual(presets.map((d) => d.minutes));
    } else if (NO_EXTEND_TECHNIQUE_KEYS.has(tk)) {
      expect(values[values.length - 1]).toBe(Math.max(...presets.map((d) => d.minutes)));
    } else {
      expect(values[values.length - 1]).toBe(CUSTOM_CEILING_MIN);
    }
    // Elke preset ligt onder het plafond van 30 min.
    for (const d of presets) expect(d.minutes).toBeLessThanOrEqual(CUSTOM_CEILING_MIN);
    expect(values).toContain(recommended);
  });
});

describe('levelForTechnique', () => {
  test('zonder geschiedenis: beginner/intermediate blijven, advanced begint één stap lager', () => {
    expect(levelForTechnique('calm', 'box', [], 'beginner')).toBe('beginner');
    expect(levelForTechnique('calm', 'box', [], 'intermediate')).toBe('intermediate');
    expect(levelForTechnique('calm', 'box', [], 'advanced')).toBe('intermediate');
    expect(levelForTechnique('calm', 'box', [], null)).toBe('beginner');
  });

  test('één stap omhoog per SESSIONS_PER_STEP (12) afgemaakte sessies met díe techniek', () => {
    expect(SESSIONS_PER_STEP).toBe(12);
    expect(levelForTechnique('calm', 'box', history('calm', 'box', 11), 'beginner')).toBe('beginner');
    expect(levelForTechnique('calm', 'box', history('calm', 'box', 12), 'beginner')).toBe('intermediate');
    expect(levelForTechnique('calm', 'box', history('calm', 'box', 24), 'beginner')).toBe('advanced');
    expect(levelForTechnique('calm', 'box', history('calm', 'box', 100), 'beginner')).toBe('advanced');
  });

  test('sessies van een andere techniek of onafgemaakte sessies tellen niet', () => {
    const other = history('calm', 'triangle', 30);
    expect(levelForTechnique('calm', 'box', other, 'beginner')).toBe('beginner');
    const partial = history('calm', 'box', 30).map((e) => ({ ...e, completed: false }));
    expect(levelForTechnique('calm', 'box', partial, 'beginner')).toBe('beginner');
    // Zelfde techniek-sleutel in een andere toestand ('equal' bestaat in boost én clarity).
    expect(levelForTechnique('clarity', 'equal', history('boost', 'equal', 30), 'beginner')).toBe('beginner');
  });

  test('ervaren gebruiker: terug naar advanced na een volle stap met deze techniek', () => {
    expect(levelForTechnique('calm', 'box', history('calm', 'box', 11), 'advanced')).toBe('intermediate');
    expect(levelForTechnique('calm', 'box', history('calm', 'box', 12), 'advanced')).toBe('advanced');
  });

  test('4-7-8 pas advanced (8 cycli) na 28 dagen met die techniek (Weil)', () => {
    expect(levelForTechnique('rest', '478', history('rest', '478', 30, 10), 'beginner')).toBe('intermediate');
    expect(levelForTechnique('rest', '478', history('rest', '478', 30, 29), 'beginner')).toBe('advanced');
  });

  test('4-7-8: aanbevolen cycli 4 → 4 → 8, als minuten 1 → 1 → 3', () => {
    const presets = presetsOf('rest', '478');
    expect(LEVELS.map((l) => recommendedForLevel('rest', '478', l))).toEqual([4, 4, 8]);
    expect(LEVELS.map((l) => personalRecommendedMinutes('rest', '478', presets, l))).toEqual([1, 1, 3]);
  });
});
