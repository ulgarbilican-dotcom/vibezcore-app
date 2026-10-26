import {
  decide,
  hashValue,
  mergeHistory,
  mergeSettings,
  pickPlan,
  pickPulse,
  stableStringify,
  type HistoryPayload,
  type PulsePayload,
} from '../src/services/cloud-sync-core';

describe('hashValue', () => {
  it('is independent of key order', () => {
    expect(hashValue({ a: 1, b: [1, 2] })).toBe(hashValue({ b: [1, 2], a: 1 }));
    expect(stableStringify({ b: undefined, a: 1 })).toBe('{"a":1}');
  });
  it('changes when a value changes', () => {
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
  });
});

describe('decide', () => {
  const E = hashValue({ x: 0 });
  const L = hashValue({ x: 1 });
  it('does nothing for a fresh device with defaults and no server row', () => {
    expect(decide({}, E, E, null).type).toBe('none');
  });
  it('pushes guest data to a new account (no server row)', () => {
    expect(decide({}, L, E, null).type).toBe('push');
  });
  it('applies the server value on a fresh second device', () => {
    expect(decide({}, E, E, { value: {}, updated_at: 't1' }).type).toBe('apply');
  });
  it('pushes a local change when the server did not change', () => {
    expect(decide({ syncedHash: E, remoteAt: 't1' }, L, E, { value: {}, updated_at: 't1' }).type).toBe('push');
  });
  it('merges when both changed', () => {
    expect(decide({ syncedHash: E, remoteAt: 't1' }, L, E, { value: {}, updated_at: 't2' }).type).toBe('merge');
  });
  it('does nothing when nothing changed', () => {
    expect(decide({ syncedHash: L, remoteAt: 't1' }, L, E, { value: {}, updated_at: 't1' }).type).toBe('none');
  });
  it('pushes again when the server row was deleted but the device still has data', () => {
    expect(decide({ syncedHash: L, remoteAt: 't1' }, L, E, null).type).toBe('push');
  });
});

describe('mergeSettings', () => {
  it('never un-sets onboarding or free-session stamps; earliest wins', () => {
    const m = mergeSettings(
      { breathOnboardingCompletedAt: null, stateFreeSessionUsedAt: 200 },
      { breathOnboardingCompletedAt: 100, stateFreeSessionUsedAt: 150 },
    );
    expect(m.breathOnboardingCompletedAt).toBe(100);
    expect(m.stateFreeSessionUsedAt).toBe(150);
  });
  it('keeps sticky flags once true', () => {
    expect(mergeSettings({ hasBuiltProtocol: true }, { hasBuiltProtocol: false }).hasBuiltProtocol).toBe(true);
    expect(mergeSettings({ voiceCuesChosen: false }, { voiceCuesChosen: true }).voiceCuesChosen).toBe(true);
  });
  it('prefers the account value for preferences, falls back to local when the account is empty', () => {
    const m = mergeSettings({ goals: ['a'], voiceGender: 'male' }, { goals: [], voiceGender: 'female' });
    expect(m.goals).toEqual(['a']);
    expect(m.voiceGender).toBe('female');
  });
  it('ignores keys that are not synced', () => {
    expect(mergeSettings({ reminders: { a: true } } as any, {} as any).reminders).toBeUndefined();
  });
});

describe('mergeHistory', () => {
  const e = (ts: number, key = 'calm', durSec = 600) => ({ key, name: 'Calm Control', ts, durSec, rounds: 5 });
  const T = { sessions: 0, sec: 0, bestStreak: 0 };
  it('unions by session identity and keeps newest first', () => {
    const a: HistoryPayload = { entries: [e(3), e(1)], totals: { sessions: 2, sec: 1200, bestStreak: 1 } };
    const b: HistoryPayload = { entries: [e(2), e(1)], totals: { sessions: 5, sec: 900, bestStreak: 3 } };
    const m = mergeHistory(a, b);
    expect(m.entries.map((x) => x.ts)).toEqual([3, 2, 1]);
    expect(m.totals).toEqual({ sessions: 5, sec: 1200, bestStreak: 3 });
  });
  it('totals never fall below the number of entries', () => {
    expect(mergeHistory({ entries: [e(1), e(2), e(3)], totals: T }, { entries: [], totals: T }).totals.sessions).toBe(3);
  });
});

describe('pickPulse / pickPlan', () => {
  const p = (bpm: number, at: number, decided = true): PulsePayload => ({ readings: [], manual: { bpm, at }, average: false, decided });
  it('takes the most recently set resting pulse', () => {
    expect(pickPulse(p(60, 100), p(70, 200)).manual?.bpm).toBe(70);
    expect(pickPulse(p(60, 300), p(70, 200)).manual?.bpm).toBe(60);
  });
  it('an undecided side never overrides a decided one', () => {
    expect(pickPulse(p(60, 100), p(70, 200, false)).manual?.bpm).toBe(60);
    expect(pickPulse(p(60, 100, false), p(70, 50)).manual?.bpm).toBe(70);
  });
  it('picks the newest plan and handles missing sides', () => {
    expect(pickPlan({ id: 'a', createdAt: 1 }, { id: 'b', createdAt: 2 })?.id).toBe('b');
    expect(pickPlan(null, { id: 'b', createdAt: 2 })?.id).toBe('b');
    expect(pickPlan({ id: 'a', createdAt: 1 }, null)?.id).toBe('a');
  });
});
