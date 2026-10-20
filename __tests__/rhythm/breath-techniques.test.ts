/* Ademwerk — fasen, duren en rondes per techniek (src/data/breath-states.ts). */
import {
  BREATH_SESSION_COUNT,
  BREATH_STATES,
  cycleSeconds,
  nextPhase,
  patternOf,
  roundsFor,
  type BreathState,
  type DurationDef,
  type PhaseDef,
  type TechniqueDef,
} from '@/data/breath-states';
import { phaseHapticPattern } from '@/services/breath-haptics';
import { setHapticStrength, type HapticStrength } from '@/services/haptic-strength-pref';

const STATES = Object.values(BREATH_STATES) as BreathState[];
const TECHS: [string, BreathState, TechniqueDef][] = STATES.flatMap((st) =>
  st.techniques.map((t) => [`${st.key}:${t.key}`, st, t] as [string, BreathState, TechniqueDef]),
);
const presetsOf = (st: BreathState, t: TechniqueDef): DurationDef[] => t.durations ?? st.durations;

function expectValidPhases(phases: PhaseDef[]) {
  expect(phases.length).toBeGreaterThanOrEqual(2);
  for (const p of phases) {
    expect(p.secs).toBeGreaterThan(0);
    expect(Number.isFinite(p.secs)).toBe(true);
    if (p.key === 'hold-in' || p.key === 'hold-out') {
      expect(p.via).toBeNull();
      expect(p.label).toBe('HOLD');
    } else {
      expect(p.via).not.toBeNull();
      expect(p.label).toBe(p.key.startsWith('inhale') ? 'INHALE' : 'EXHALE');
    }
  }
  const keys = phases.map((p) => p.key);
  expect(keys).toContain('inhale');
  expect(keys).toContain('exhale');
  // Een cyclus begint altijd met inademen.
  expect(keys[0]).toBe('inhale');
  // Geen dubbele fase-sleutels (phaseAt/nextPhase zoeken op sleutel).
  expect(new Set(keys).size).toBe(keys.length);
}

/** Past het aantal rondes bij de gekozen minuten (of cycli)? */
function expectRoundsMatch(d: DurationDef, cycle: number) {
  expect(d.minutes).toBeGreaterThan(0);
  expect(d.rounds).toBeGreaterThanOrEqual(1);
  expect(Number.isInteger(d.rounds)).toBe(true);
  if (d.cycles != null) {
    // Vaste ademhalingen (4-7-8): rondes = cycli, minuten = afgeronde weergave.
    expect(d.rounds).toBe(d.cycles);
    expect(Math.abs(d.cycles * cycle - d.minutes * 60)).toBeLessThanOrEqual(60);
  } else {
    // rounds × cyclus ≈ gekozen duur, op hoogstens één cyclus na.
    expect(Math.abs(d.rounds * cycle - d.minutes * 60)).toBeLessThanOrEqual(cycle);
  }
}

describe('ademtoestanden', () => {
  test('vijf toestanden: boost, focus, calm, clarity, rest', () => {
    expect(Object.keys(BREATH_STATES)).toEqual(['boost', 'focus', 'calm', 'clarity', 'rest']);
    for (const [k, st] of Object.entries(BREATH_STATES)) expect(st.key).toBe(k);
  });

  test.each(STATES.map((s) => [s.key, s] as const))('%s: fallback-fasen geldig', (_k, st) => {
    expectValidPhases(st.phases);
  });

  test.each(STATES.map((s) => [s.key, s] as const))('%s: drie technieken, Beginner → Intermediate → Advanced', (_k, st) => {
    expect(st.techniques.map((t) => t.level)).toEqual(['Beginner', 'Intermediate', 'Advanced']);
    expect(new Set(st.techniques.map((t) => t.key)).size).toBe(3);
  });

  test.each(STATES.map((s) => [s.key, s] as const))('%s: defaultDuration is een geldige index', (_k, st) => {
    expect(Number.isInteger(st.defaultDuration)).toBe(true);
    expect(st.durations[st.defaultDuration]).toBeDefined();
  });

  test.each(STATES.map((s) => [s.key, s] as const))('%s: fallback-duren passen bij de fallback-fasen', (_k, st) => {
    for (const d of st.durations) expectRoundsMatch(d, cycleSeconds(st));
  });

  /* Type-doc TechniqueDef/BreathState.techniques (breath-states.ts ~r. 250):
     "De eerste is de standaard en draagt dezelfde fasen als `phases`".
     Faalt voor `rest`: sinds de herordening van 6 okt 2026 is de eerste
     techniek Slow Extended Exhale (5-7), maar `phases` is nog 5-10 (Slow,
     nu de Advanced-techniek). Zie rapport. */
  const firstMatches = STATES.filter((s) => s.key !== 'rest');
  test.each(firstMatches.map((s) => [s.key, s] as const))('%s: eerste techniek = fallback-fasen', (_k, st) => {
    expect(patternOf(st.techniques[0])).toBe(patternOf(st));
  });
  test.failing('rest: eerste techniek = fallback-fasen (VERMOEDELIJKE BUG: 5-10 vs 5-7)', () => {
    const st = BREATH_STATES.rest;
    expect(patternOf(st.techniques[0])).toBe(patternOf(st));
  });

  test('aantal begeleide ademsessies = 49 (operator 17 okt 2026)', () => {
    expect(BREATH_SESSION_COUNT).toBe(49);
  });
});

describe.each(TECHS)('techniek %s', (_id, st, t) => {
  test('fasen geldig', () => expectValidPhases(t.phases));

  test('elke duur: rondes × cyclus ≈ minuten', () => {
    const presets = presetsOf(st, t);
    expect(presets.length).toBeGreaterThanOrEqual(2);
    for (const d of presets) expectRoundsMatch(d, cycleSeconds(t));
  });

  test('duren oplopend en precies één aanbevolen', () => {
    const presets = presetsOf(st, t);
    const mins = presets.map((d) => d.minutes);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
    expect(new Set(mins).size).toBe(mins.length);
    expect(presets.filter((d) => d.recommended)).toHaveLength(1);
  });

  test('roundsFor stemt overeen met de rondes in de data (minuten-duren)', () => {
    for (const d of presetsOf(st, t)) {
      if (d.cycles != null) continue;
      expect(Math.abs(roundsFor(t, d.minutes) - d.rounds)).toBeLessThanOrEqual(1);
    }
  });

  test('nextPhase loopt de cyclus rond', () => {
    let k = t.phases[0].key;
    for (let i = 0; i < t.phases.length; i += 1) k = nextPhase(t, k).key;
    expect(k).toBe(t.phases[0].key);
  });

  test('amber/red-protocollen hebben een veiligheidsnotitie', () => {
    if (t.safetyTier !== 'green') expect(t.safetyNote?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('roundsFor', () => {
  test('minstens één ronde, ook bij 0 minuten', () => {
    for (const [, , t] of TECHS) expect(roundsFor(t, 0)).toBe(1);
  });
});

describe('fase-trilpatronen (breath-haptics)', () => {
  const allPhases = TECHS.flatMap(([, , t]) => t.phases);
  const strengths: HapticStrength[] = ['soft', 'medium', 'strong'];

  afterAll(() => setHapticStrength('medium'));

  test.each(strengths)('sterkte %s: patroon past binnen de fase', (s) => {
    setHapticStrength(s);
    for (const p of allPhases) {
      const pat = phaseHapticPattern(p.key, p.secs);
      const total = pat.reduce((a, b) => a + b, 0);
      expect(pat[0]).toBe(0);
      expect(pat.length).toBeGreaterThanOrEqual(2); // [wacht, aan, uit, aan, …]
      for (const v of pat) expect(v).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(p.secs * 1000);
    }
  });

  test('vasthouden: één tik per seconde', () => {
    setHapticStrength('medium');
    for (const secs of [3, 4, 7]) {
      const pat = phaseHapticPattern('hold-in', secs);
      const taps = pat.filter((_, i) => i % 2 === 1).length;
      expect(taps).toBe(secs);
    }
  });

  /** Begintijden (ms) van elke "aan"-puls: dat is het ritme dat je voelt. */
  const onsets = (pat: number[]) => {
    const out: number[] = [];
    let t = 0;
    pat.forEach((v, i) => {
      if (i % 2 === 1) out.push(t);
      t += v;
    });
    return out;
  };

  test('sterkte verandert het ritme niet (begintijd van elke puls gelijk)', () => {
    for (const p of allPhases) {
      setHapticStrength('medium');
      const base = onsets(phaseHapticPattern(p.key, p.secs));
      for (const s of strengths) {
        setHapticStrength(s);
        expect(onsets(phaseHapticPattern(p.key, p.secs))).toEqual(base);
      }
    }
  });
});
