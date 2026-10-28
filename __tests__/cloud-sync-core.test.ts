import {
  mergeAudio,
  mergeStateHistory,
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

describe('mergeStateHistory', () => {
  const rec = (id: string, end: string, updatedAt?: string) => ({ id, mode: 0, startedAt: end, endedAt: end, durationMin: 5, plannedMin: 5, status: 'completed', ...(updatedAt ? { updatedAt } : {}) });
  it('unites by id, newest first, never loses a session', () => {
    const a = { sessions: [rec('1', '2026-10-01T10:00:00Z'), rec('2', '2026-10-02T10:00:00Z')] };
    const b = { sessions: [rec('2', '2026-10-02T10:00:00Z'), rec('3', '2026-10-03T10:00:00Z')] };
    expect(mergeStateHistory(a, b).sessions.map((r) => r.id)).toEqual(['3', '2', '1']);
  });
  it('the last modified version of the same session wins', () => {
    const a = { sessions: [rec('1', '2026-10-01T10:00:00Z', '2026-10-01T10:00:05Z')] };
    const b = { sessions: [{ ...rec('1', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'), durationMin: 9 }] };
    expect(mergeStateHistory(a, b).sessions[0].durationMin).toBe(9);
    expect(mergeStateHistory(b, a).sessions[0].durationMin).toBe(9);
  });
});

describe('mergeAudio', () => {
  const f = (n: number, ts: number) => ({ url: `u${n}`, title: `T${n}`, series: 'S', ts });
  const h = (n: number, ts: number) => ({ url: `u${n}`, title: `T${n}`, series: 'S', ts, dur: 10, full: true, fc: 1 });
  it('unites favorites and listens, and keeps the furthest resume position per session', () => {
    const a = { favorites: [f(1, 5)], history: [h(1, 100)], positions: { u1: 30, u2: 10 } };
    const b = { favorites: [f(1, 9), f(2, 7)], history: [h(1, 100), h(2, 200)], positions: { u1: 20, u3: 5 } };
    const m = mergeAudio(a, b);
    expect(m.favorites.map((x) => x.url).sort()).toEqual(['u1', 'u2']);
    expect(m.favorites.find((x) => x.url === 'u1')!.ts).toBe(9);
    expect(m.history.map((x) => x.ts)).toEqual([200, 100]);
    expect(m.positions).toEqual({ u1: 30, u2: 10, u3: 5 });
  });
});
