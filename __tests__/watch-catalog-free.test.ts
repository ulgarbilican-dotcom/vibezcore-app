/* De catalogus die de telefoon naar het horloge stuurt: de ene gratis State Control-sessie moet State Control ontgrendelen
   (locked: false) zolang ze niet gebruikt is, en daarna weer op slot. Zelfde regel als op de telefoon (useStateFreeStart). */
jest.mock('@/services/resting-pulse', () => ({ getRestingPulse: () => ({ bpm: 70, source: 'average', decided: true, at: null, liveBpm: null }), subscribeRestingPulse: () => () => {} }));
jest.mock('../modules/wear-breath', () => new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : () => () => {}) }));

import { buildWatchCatalog, watchEntitledUntil } from '../src/services/watch-catalog';

const states = (json: string) => JSON.parse(json).state as { key: number; locked: boolean }[];

describe('watch catalog: free State Control session', () => {
  it('Premium: nothing locked', () => {
    expect(states(buildWatchCatalog(false, false, false, false)).every((s) => !s.locked)).toBe(true);
  });
  it('free guest, free session still available: State Control is UNLOCKED on the watch', () => {
    const j = buildWatchCatalog(true, true, true, true);
    expect(states(j).every((s) => s.locked === false)).toBe(true);
    expect(JSON.parse(j).stateFreeOnce).toBe(true);
  });
  it('free guest, free session used: State Control is locked (30 s preview)', () => {
    const j = buildWatchCatalog(true, true, false, false);
    expect(states(j).every((s) => s.locked === true)).toBe(true);
    expect(JSON.parse(j).stateFreeOnce).toBe(false);
  });
});

/* 27 okt 2026 (operator: bij een verlopen abonnement moet Premium op telefoon ÉN horloge eindigen): het horloge werkt zelfstandig met een
   bewaarde catalogus, dus die draagt zelf het einde van het recht. */
describe('watch catalog: Premium end date', () => {
  const H = 3600 * 1000;
  const end = '2026-11-27T10:00:00.000Z';
  const endMs = Date.parse(end);
  it('day pass / cancelled subscription: ends exactly on the end date', () => {
    expect(watchEntitledUntil(true, end, false)).toBe(endMs);
  });
  it('auto-renewing subscription: 48 h grace (the store renews around the end date)', () => {
    expect(watchEntitledUntil(true, end, true)).toBe(endMs + 48 * H);
  });
  it('not Premium, no date or an invalid date: 0 (nothing to expire)', () => {
    expect(watchEntitledUntil(false, end, true)).toBe(0);
    expect(watchEntitledUntil(true, undefined, true)).toBe(0);
    expect(watchEntitledUntil(true, 'nope', true)).toBe(0);
  });
  it('the catalog carries the end date and the bracelet flag to the watch', () => {
    const j = JSON.parse(buildWatchCatalog(false, false, false, false, endMs, true));
    expect(j.entitledUntil).toBe(endMs);
    expect(j.ownsBracelet).toBe(true);
    const k = JSON.parse(buildWatchCatalog(false, false, false, false));
    expect(k.entitledUntil).toBe(0);
    expect(k.ownsBracelet).toBe(false);
  });
});
