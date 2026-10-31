/* Sound timing (31 okt 2026, operator: "ja"): per Bluetooth-toestel corrigeren we hoeveel later het geluid echt aankomt.
   De gebruiker tikt mee op de proefslag; de mediaan (eerste 2 tikken niet) + de gemiddelde voorsprong van tikken (30 ms)
   is de extra vertraging. Ongelijk tikken → opnieuw vragen. */
import {
  CALIBRATION_PERIOD_MS,
  CORRECTION_MAX_MS,
  CORRECTION_MIN_MS,
  DISCARD_FIRST_TAPS,
  TAP_ANTICIPATION_MS,
  TAPS_NEEDED,
  clampCorrection,
  estimateLateMs,
} from '../src/services/sound-timing';

const FIRST = 1_000_000;
const P = CALIBRATION_PERIOD_MS;
/** Tikken op elke slag, `lateMs` na het geplande moment, met kleine spreiding. */
const taps = (lateMs: number, jitter: number[] = []) =>
  Array.from({ length: TAPS_NEEDED }, (_, k) => FIRST + k * P + lateMs + (jitter[k] ?? 0));

describe('estimateLateMs', () => {
  it('70 bpm proefslag', () => {
    expect(P).toBe(857);
  });
  it('sound arrives 120 ms late, user taps ~30 ms ahead of what they hear → 120', () => {
    expect(estimateLateMs(taps(120 - TAP_ANTICIPATION_MS), FIRST)).toBe(120);
  });
  it('sound on time → 0 (only the tapping anticipation is compensated)', () => {
    expect(estimateLateMs(taps(-TAP_ANTICIPATION_MS), FIRST)).toBe(0);
  });
  it('sound too early (earbuds report too much) → negative', () => {
    expect(estimateLateMs(taps(-80 - TAP_ANTICIPATION_MS), FIRST)).toBe(-80);
  });
  it('median: ignores the first taps and a single stray tap', () => {
    const jitter = [400, -300, 220, -180, 5, -8, 3, 0, 250, -4, 6, 2];
    expect(estimateLateMs(taps(60, jitter), FIRST)).toBe(60 + 2 + TAP_ANTICIPATION_MS);
  });
  it('taps late in the cycle are assigned to the nearest beat', () => {
    /* 400 ms na de slag is dichter bij deze dan bij de volgende (857) */
    expect(estimateLateMs(taps(400), FIRST)).toBe(400 + TAP_ANTICIPATION_MS);
  });
  it('uneven tapping → null (ask again)', () => {
    const jitter = [0, 0, 0, 0, 300, -250, 200, -180, 260, -220, 190, -150];
    expect(estimateLateMs(taps(0, jitter), FIRST)).toBeNull();
  });
  it('too few taps → null', () => {
    expect(estimateLateMs(taps(50).slice(0, DISCARD_FIRST_TAPS + 3), FIRST)).toBeNull();
  });
});

describe('clampCorrection', () => {
  it('stays within the native limits', () => {
    expect(clampCorrection(900)).toBe(CORRECTION_MAX_MS);
    expect(clampCorrection(-900)).toBe(CORRECTION_MIN_MS);
    expect(clampCorrection(42.4)).toBe(42);
  });
});
