/* De catalogus die de telefoon naar het horloge stuurt: de ene gratis State Control-sessie moet State Control ontgrendelen
   (locked: false) zolang ze niet gebruikt is, en daarna weer op slot. Zelfde regel als op de telefoon (useStateFreeStart). */
jest.mock('@/services/resting-pulse', () => ({ getRestingPulse: () => ({ bpm: 70, source: 'average', decided: true, at: null, liveBpm: null }), subscribeRestingPulse: () => () => {} }));
jest.mock('../modules/wear-breath', () => new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : () => () => {}) }));

import { buildWatchCatalog } from '../src/services/watch-catalog';

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
