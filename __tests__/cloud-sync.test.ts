/* Backup & Sync, van begin tot eind: twee "toestellen" (eigen opslag, eigen modules) en één nagebootste server.
   Bewijst dat gegevens van het ene toestel op het andere aankomen, dat een gast zijn gegevens meeneemt naar
   een nieuw account, en dat een ontbrekende tabel stil genegeerd wordt. */

type Row = { key: string; value: any; updated_at: string };
const server: { rows: Row[]; tableExists: boolean; clock: number; calls: number } = { rows: [], tableExists: true, clock: 0, calls: 0 };

jest.mock('@/services/auth', () => ({
  getToken: async () => 'token',
  fetchWithTimeout: async (url: string, init: any = {}) => {
    server.calls++;
    if (!server.tableExists) return { status: 404, ok: false, json: async () => ({}) };
    if (init.method === 'POST') {
      const [{ key, value }] = JSON.parse(init.body);
      server.clock++;
      const row = { key, value, updated_at: `2026-10-26T10:00:${String(server.clock).padStart(2, '0')}Z` };
      server.rows = [...server.rows.filter((r) => r.key !== key), row];
      return { status: 201, ok: true, json: async () => [row] };
    }
    return { status: 200, ok: true, json: async () => server.rows };
  },
}));
jest.mock('@/utils/user-bucket', () => ({
  resolveActiveBucket: async () => (globalThis as any).__bucket,
  subscribeUserBucket: () => () => {},
}));

type Device = {
  sync: typeof import('../src/services/cloud-sync');
  settings: typeof import('../src/utils/settings');
  history: typeof import('../src/utils/breath-history');
  pulse: typeof import('../src/services/resting-pulse');
  plan: typeof import('../src/utils/plan-store');
  storage: Record<string, string>;
};

/** Start een "toestel": lege opslag en verse modules. */
function newDevice(bucket: string, storage: Record<string, string> = {}): Device {
  let d!: Device;
  jest.isolateModules(() => {
    (globalThis as any).__bucket = bucket;
    const as = require('@react-native-async-storage/async-storage');
    as.__INTERNAL_MOCK_STORAGE__ = storage;
    d = {
      sync: require('../src/services/cloud-sync'),
      settings: require('../src/utils/settings'),
      history: require('../src/utils/breath-history'),
      pulse: require('../src/services/resting-pulse'),
      plan: require('../src/utils/plan-store'),
      storage,
    };
  });
  return d;
}

beforeEach(() => {
  server.rows = [];
  server.tableExists = true;
  server.clock = 0;
  server.calls = 0;
});

const session = (ts: number) => ({ key: 'calm', name: 'Calm Control', ts, durSec: 600, rounds: 5, completed: true });

describe('Backup & Sync', () => {
  it('a guest stays fully local: nothing is sent without an account', async () => {
    const a = newDevice('anon');
    await a.settings.setSetting('experienceLevel', 'advanced');
    expect(await a.sync.syncNow(true)).toBe('skipped');
    expect(server.calls).toBe(0);
  });

  it('settings, resting pulse and breath history travel to a second device', async () => {
    const a = newDevice('u-abc');
    await a.settings.setSetting('experienceLevel', 'advanced');
    await a.settings.setSetting('goals', ['sleep'] as any);
    await a.settings.setSetting('breathOnboardingCompletedAt', 1234);
    await a.history.addBreathSession(session(1000));
    await a.history.addBreathSession(session(2000));
    a.pulse.setManualRestingPulse(58);
    expect(await a.sync.syncNow(true)).toBe('ok');
    expect(server.rows.map((r) => r.key).sort()).toEqual(['breath_history', 'resting_pulse', 'settings']);

    const b = newDevice('u-abc');
    /* Toestel B is echt apart: vóór het synchroniseren weet het niets. */
    expect((await b.history.getBreathSyncSnapshot()).entries).toHaveLength(0);
    await b.settings.ensureSettingsLoaded();
    expect(b.settings.getSetting('experienceLevel')).toBeNull();
    expect(await b.sync.syncNow(true)).toBe('ok');
    await b.settings.ensureSettingsLoaded();
    expect(b.settings.getSetting('experienceLevel')).toBe('advanced');
    expect(b.settings.getSetting('breathOnboardingCompletedAt')).toBe(1234);
    expect((await b.history.getBreathSyncSnapshot()).entries.map((e) => e.ts)).toEqual([2000, 1000]);
    expect((await b.pulse.getRestingSyncSnapshot()).manual?.bpm).toBe(58);
  });

  it('a change on device B reaches device A, and both histories end up equal', async () => {
    const a = newDevice('u-abc');
    await a.history.addBreathSession(session(1000));
    await a.sync.syncNow(true);
    const b = newDevice('u-abc');
    await b.sync.syncNow(true);
    await b.history.addBreathSession(session(3000)); // op B
    await a.history.addBreathSession(session(2000)); // tegelijk op A
    await b.sync.syncNow(true);
    await a.sync.syncNow(true);
    await b.sync.syncNow(true);
    const ea = (await a.history.getBreathSyncSnapshot()).entries.map((e) => e.ts);
    const eb = (await b.history.getBreathSyncSnapshot()).entries.map((e) => e.ts);
    expect(ea).toEqual([3000, 2000, 1000]);
    expect(eb).toEqual([3000, 2000, 1000]);
  });

  it('never un-sets "onboarding done" or "free session used" from another device', async () => {
    const a = newDevice('u-abc');
    await a.settings.setSetting('stateFreeSessionUsedAt', 500);
    await a.sync.syncNow(true);
    const b = newDevice('u-abc');
    await b.settings.setSetting('stateFreeSessionUsedAt', 900); // ook al "gebruikt" op B, later
    await b.sync.syncNow(true);
    await b.settings.ensureSettingsLoaded();
    expect(b.settings.getSetting('stateFreeSessionUsedAt')).toBe(500);
  });

  it('a guest who creates an account keeps the local breath history', async () => {
    const storage: Record<string, string> = {};
    const guest = newDevice('anon', storage);
    await guest.history.addBreathSession(session(1000));
    await guest.history.addBreathSession(session(2000));
    // dezelfde opslag, nu ingelogd
    const loggedIn = newDevice('u-new', storage);
    expect(await loggedIn.sync.syncNow(true)).toBe('ok');
    expect((await loggedIn.history.getBreathSyncSnapshot()).entries).toHaveLength(2);
    expect(server.rows.find((r) => r.key === 'breath_history')?.value.entries).toHaveLength(2);
  });

  it('a missing table is ignored silently and not retried in a loop', async () => {
    server.tableExists = false;
    const a = newDevice('u-abc');
    await a.settings.setSetting('experienceLevel', 'advanced');
    expect(await a.sync.syncNow(true)).toBe('offline-or-no-table');
    const calls = server.calls;
    expect(await a.sync.syncNow(true)).toBe('skipped');
    expect(server.calls).toBe(calls);
  });

  it('does not touch the network when nothing changed locally (poll)', async () => {
    const a = newDevice('u-abc');
    await a.settings.setSetting('experienceLevel', 'advanced');
    await a.sync.syncNow(true);
    const calls = server.calls;
    expect(await a.sync.syncNow(false)).toBe('skipped');
    expect(server.calls).toBe(calls);
  });
});
