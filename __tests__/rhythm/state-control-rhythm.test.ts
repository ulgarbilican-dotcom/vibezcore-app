/* State Control — hartslagcurves ("Match your rhythm").
   Regels uit de kop van src/services/bracelet-haptics.ts en resolveSpec():
   - elke kalme modus eindigt ONDER de rusthartslag, nooit onder 40 bpm;
   - Boost heeft een vast doel van 110 bpm;
   - het doel volgt de rust maar nooit hoger dan bij rust = 80;
   - volgorde op de arousal-as: Sleep <= Clarity <= Calm <= Sharp Focus < Boost. */
import {
  PREVIEW_MAX_SECONDS,
  TASTE_SECONDS,
  previewCondensedRampMinutes,
  rhythmFor,
  tasteDurationMs,
  watchStateParams,
} from '@/services/bracelet-haptics';
import { BraceletMode } from '@/services/ble-contract';
import {
  AVERAGE_RESTING_BPM,
  MAX_RESTING_BPM,
  MIN_RESTING_BPM,
  getRestingPulse,
  setManualRestingPulse,
} from '@/services/resting-pulse';

const CALM_MODES = [BraceletMode.Beta, BraceletMode.Alpha, BraceletMode.Theta, BraceletMode.Delta];
const ALL_MODES = [BraceletMode.Gamma, ...CALM_MODES];
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const target = (m: BraceletMode, r: number) => rhythmFor(m, r).targetBpm;

describe('rhythmFor — eindtempo per modus', () => {
  test('resting-pulse grenzen zijn 40..100, gemiddelde 70', () => {
    expect(MIN_RESTING_BPM).toBe(40);
    expect(MAX_RESTING_BPM).toBe(100);
    expect(AVERAGE_RESTING_BPM).toBe(70);
  });

  test.each(range(50, 100))('rust %i: elke kalme modus eindigt onder rust en >= 40', (r) => {
    for (const m of CALM_MODES) {
      const t = target(m, r);
      expect(t).toBeLessThan(r);
      expect(t).toBeGreaterThanOrEqual(40);
      expect(Number.isInteger(t)).toBe(true);
    }
  });

  test('ook bij lage rust (42..49) eindigen kalme modi minstens 2 bpm onder rust', () => {
    for (const r of range(42, 49)) {
      for (const m of CALM_MODES) {
        expect(target(m, r)).toBeLessThanOrEqual(r - 2);
        expect(target(m, r)).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('nooit onder 40 bpm, ook niet aan de ondergrens van de rust', () => {
    for (const r of range(MIN_RESTING_BPM, MAX_RESTING_BPM)) {
      for (const m of CALM_MODES) expect(target(m, r)).toBeGreaterThanOrEqual(40);
    }
  });

  test('Boost = vast 110 bpm, ongeacht rust', () => {
    for (const r of range(MIN_RESTING_BPM, MAX_RESTING_BPM)) {
      expect(target(BraceletMode.Gamma, r)).toBe(110);
    }
  });

  test('volgorde Sleep <= Clarity <= Calm <= Sharp Focus < Boost voor elke rust 40..100', () => {
    for (const r of range(MIN_RESTING_BPM, MAX_RESTING_BPM)) {
      const sleep = target(BraceletMode.Delta, r);
      const clarity = target(BraceletMode.Theta, r);
      const calm = target(BraceletMode.Alpha, r);
      const focus = target(BraceletMode.Beta, r);
      expect(sleep).toBeLessThanOrEqual(clarity);
      expect(clarity).toBeLessThanOrEqual(calm);
      expect(calm).toBeLessThanOrEqual(focus);
      expect(focus).toBeLessThan(target(BraceletMode.Gamma, r));
    }
  });

  test('strikte volgorde Sleep < Clarity < Calm < Sharp Focus bij gangbare rust 60..100', () => {
    for (const r of range(60, 100)) {
      expect(target(BraceletMode.Delta, r)).toBeLessThan(target(BraceletMode.Theta, r));
      expect(target(BraceletMode.Theta, r)).toBeLessThan(target(BraceletMode.Alpha, r));
      expect(target(BraceletMode.Alpha, r)).toBeLessThan(target(BraceletMode.Beta, r));
    }
  });

  test('gedocumenteerd voorbeeld bij R = 70: 56 / 49 / 40 / 63 / 110', () => {
    expect(target(BraceletMode.Alpha, 70)).toBe(56);
    expect(target(BraceletMode.Theta, 70)).toBe(49);
    expect(target(BraceletMode.Delta, 70)).toBe(40);
    expect(target(BraceletMode.Beta, 70)).toBe(63);
    expect(target(BraceletMode.Gamma, 70)).toBe(110);
  });

  test('doel begrensd alsof rust 80 was: rust > 80 geeft hetzelfde doel als 80', () => {
    for (const m of ALL_MODES) {
      const at80 = target(m, 80);
      for (const r of range(81, 100)) expect(target(m, r)).toBe(at80);
    }
  });

  test('doel daalt nooit wanneer de rust stijgt (monotoon niet-dalend)', () => {
    for (const m of ALL_MODES) {
      for (const r of range(MIN_RESTING_BPM + 1, MAX_RESTING_BPM)) {
        expect(target(m, r)).toBeGreaterThanOrEqual(target(m, r - 1));
      }
    }
  });

  test('procentuele regels (Calm 80%, Clarity 70%, Sleep 55%, Focus 90%) met hun minima', () => {
    for (const r of range(60, 80)) {
      expect(target(BraceletMode.Alpha, r)).toBe(Math.max(50, Math.round(r * 0.8)));
      expect(target(BraceletMode.Theta, r)).toBe(Math.max(45, Math.round(r * 0.7)));
      expect(target(BraceletMode.Delta, r)).toBe(Math.max(40, Math.round(r * 0.55)));
      expect(target(BraceletMode.Beta, r)).toBe(Math.max(53, Math.round(r * 0.9)));
    }
  });

  test('startBpm = rust tenzij een (live) start-hartslag is meegegeven', () => {
    expect(rhythmFor(BraceletMode.Alpha, 66).startBpm).toBe(66);
    const r = rhythmFor(BraceletMode.Alpha, 66, 92);
    expect(r.startBpm).toBe(92);
    // Het einde volgt de RUST, niet de start-hartslag.
    expect(r.targetBpm).toBe(target(BraceletMode.Alpha, 66));
  });
});

describe('voorproef en proeven', () => {
  test('voorproef duurt 30 s, proeven 5 s', () => {
    expect(PREVIEW_MAX_SECONDS).toBe(30);
    expect(TASTE_SECONDS).toBe(5);
  });

  test('enkel de trage modi (Sleep, Clarity: 2 min glijden) hebben een ingekorte voorproef', () => {
    expect(previewCondensedRampMinutes(BraceletMode.Delta)).toBe(2);
    expect(previewCondensedRampMinutes(BraceletMode.Theta)).toBe(2);
    expect(previewCondensedRampMinutes(BraceletMode.Alpha)).toBeNull();
    expect(previewCondensedRampMinutes(BraceletMode.Beta)).toBeNull();
    expect(previewCondensedRampMinutes(BraceletMode.Gamma)).toBeNull();
  });

  test.each([45, 55, 70, 80, 95])('tasteDurationMs is een geheel aantal slagen van het eindtempo (rust %i)', (r) => {
    setManualRestingPulse(r);
    const resting = getRestingPulse().bpm;
    expect(resting).toBe(r);
    for (const m of ALL_MODES) {
      const cycle = Math.round(60000 / rhythmFor(m, resting).targetBpm);
      for (const secs of [1, 3, TASTE_SECONDS, 10]) {
        const ms = tasteDurationMs(m, secs);
        expect(ms % cycle).toBe(0);
        expect(ms / cycle).toBeGreaterThanOrEqual(1);
        // afgerond op de dichtstbijzijnde hele slag: hoogstens een halve slag naast de vraag
        expect(Math.abs(ms - secs * 1000)).toBeLessThanOrEqual(cycle / 2 + 1);
      }
    }
  });

  test('tasteDurationMs geeft minstens één slag, ook voor een heel korte proef', () => {
    for (const m of ALL_MODES) expect(tasteDurationMs(m, 0.1)).toBeGreaterThan(0);
  });
});

describe('watchStateParams — horloge krijgt dezelfde curve', () => {
  test.each([55, 70, 90])('rust %i: zelfde start/eind als rhythmFor, 10 s basislijn', (r) => {
    setManualRestingPulse(r);
    const resting = getRestingPulse().bpm;
    for (const m of ALL_MODES) {
      const p = watchStateParams(m);
      const exp = rhythmFor(m, resting);
      expect(p.startBpm).toBe(resting);
      expect(p.targetBpm).toBe(exp.targetBpm);
      expect(p.holdSec).toBe(10);
      expect(p.rampSec).toBe(m === BraceletMode.Delta || m === BraceletMode.Theta ? 120 : 10);
      expect(p.lubAmp).toBeGreaterThan(0);
      expect(p.lubAmp).toBeLessThanOrEqual(255);
      expect(p.dubAmp).toBeLessThanOrEqual(p.lubAmp);
    }
  });

  test('horloge-sterkte: Sleep nooit sterker dan Boost', () => {
    expect(watchStateParams(BraceletMode.Delta).lubAmp).toBeLessThanOrEqual(
      watchStateParams(BraceletMode.Gamma).lubAmp,
    );
    expect(watchStateParams(BraceletMode.Delta).lubMsNoAmp).toBeLessThanOrEqual(
      watchStateParams(BraceletMode.Gamma).lubMsNoAmp,
    );
  });
});
