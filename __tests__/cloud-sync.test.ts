/* Backup & Sync, van begin tot eind: twee "toestellen" (eigen opslag, eigen modules) en één nagebootste server.
   Bewijst dat gegevens van het ene toestel op het andere aankomen, dat een gast zijn gegevens meeneemt naar
   een nieuw account, en dat een ontbrekende tabel stil genegeerd wordt. */

type Row = { key: string; value: any; updated_at: string };
const server: { rows: Row[]; tableExists: boolean; clock: number; calls: number; reject: string[]; rejected: number } = { rows: [], tableExists: true, clock: 0, calls: 0, reject: [], rejected: 0 };

/* Een token met een `sub` (zoals Supabase), zodat de State Control-geschiedenis dezelfde emmer kiest als de rest. Gast = geen herkenbare sub. */
const fakeJwt = () => {
  const b = (globalThis as any).__bucket as string;
  if (!b || !b.startsWith('u-')) return 'token';
  const payload = Buffer.from(JSON.stringify({ sub: b.slice(2) })).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `h.${payload}.s`;
};
jest.mock('@/services/auth', () => ({
  getToken: async () => fakeJwt(),
  fetchWithTimeout: async (url: string, init: any = {}) => {
    server.calls++;
    if (!server.tableExists) return { status: 404, ok: false, json: async () => ({}) };
    if (init.method === 'POST') {
      const [{ key, value }] = JSON.parse(init.body);
      if (server.reject.includes(key)) {
        server.rejected++;
        return { status: 400, ok: false, json: async () => ({}) };
      }
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
  ensureBucketLoaded: async () => (globalThis as any).__bucket,
  getCurrentBucket: () => (globalThis as any).__appBucket ?? (globalThis as any).__bucket,
  refreshUserBucket: async () => {},
  subscribeUserBucket: () => () => {},
}));

type Device = {
  sync: typeof import('../src/services/cloud-sync');
  settings: typeof import('../src/utils/settings');
  history: typeof import('../src/utils/breath-history');
  pulse: typeof import('../src/services/resting-pulse');
  plan: typeof import('../src/utils/plan-store');
  splan: typeof import('../src/utils/bracelet-plan-store');
  state: typeof import('../src/utils/bracelet-history');
  fav: typeof import('../src/hooks/useFavorites');
  listen: typeof import('../src/utils/history');
  vzp: typeof import('../src/utils/vzp');
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
      splan: require('../src/utils/bracelet-plan-store'),
      state: require('../src/utils/bracelet-history'),
      fav: require('../src/hooks/useFavorites'),
      listen: require('../src/utils/history'),
      vzp: require('../src/utils/vzp'),
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
  server.reject = [];
  server.rejected = 0;
});

const session = (ts: number) => ({ key: 'calm', name: 'Calm Control', ts, durSec: 600, rounds: 5, completed: true });

describe('Backup & Sync', () => {

  it('the State Control plan travels to a second device; an old row without it leaves the local plan alone', async () => {
    const a = newDevice('u-abc');
    const plan = { id: 'sp1', createdAt: 5000, horizon: '1w', startDayKey: '2026-10-28', days: {} } as any;
    await a.splan.saveActiveBraceletPlan(plan);
    expect(await a.sync.syncNow(true)).toBe('ok');
    const row = server.rows.find((r) => r.key === 'plan');
    expect(row?.value.statePlan?.id).toBe('sp1');

    const b = newDevice('u-abc');
    expect(await b.sync.syncNow(true)).toBe('ok');
    expect((await b.splan.getActiveBraceletPlanLoaded())?.id).toBe('sp1');

    /* Een rij zoals een oudere app-versie hem schreef (enkel het Breathwork-plan): het State Control-plan op dit toestel blijft. */
    server.rows = [{ key: 'plan', value: { plan: null }, updated_at: '2026-10-28T12:00:00Z' }];
    const c = newDevice('u-abc');
    await c.splan.saveActiveBraceletPlan({ ...plan, id: 'local' });
    await c.sync.syncNow(true);
    expect((await c.splan.getActiveBraceletPlanLoaded())?.id).toBe('local');
  });
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

  it('waits while the app is still on another bucket (just signed in): nothing applied, nothing sent', async () => {
    const a = newDevice('u-abc');
    await a.history.addBreathSession(session(1000));
    await a.sync.syncNow(true);
    const calls = server.calls;
    const b = newDevice('u-abc');
    (globalThis as any).__appBucket = 'anon'; // token says u-abc, the app's own storage is still on the guest bucket
    try {
      expect(await b.sync.syncNow(true)).toBe('skipped');
      expect(server.calls).toBe(calls);
      expect((await b.history.getBreathSyncSnapshot()).entries).toHaveLength(0);
    } finally {
      delete (globalThis as any).__appBucket;
    }
    expect(await b.sync.syncNow(true)).toBe('ok');
    expect((await b.history.getBreathSyncSnapshot()).entries.map((e) => e.ts)).toEqual([1000]);
  });

  it('a local change goes out on the next quiet poll (no forced sync needed)', async () => {
    const a = newDevice('u-abc');
    await a.settings.setSetting('experienceLevel', 'advanced');
    await a.sync.syncNow(true);
    await a.history.addBreathSession(session(4000)); // bv. net een sessie afgerond
    expect(await a.sync.syncNow(false)).toBe('ok');
    const row = server.rows.find((r) => r.key === 'breath_history');
    expect(row?.value.entries.map((e: { ts: number }) => e.ts)).toContain(4000);
  });

  /* ── 28 okt 2026: State Control-sessies en de Audio Library ───────────────────────────────────────────────────────────── */
  const stateRec = (n: number) => ({
    mode: n % 5,
    startedAt: new Date(2026, 9, n, 8, 0).toISOString(),
    endedAt: new Date(2026, 9, n, 8, 10).toISOString(),
    durationMin: 10,
    plannedMin: 10,
    status: 'completed' as const,
  });

  it('State Control sessions travel to a second device (and a session is never counted twice)', async () => {
    const a = newDevice('u-abc');
    await a.state.recordSession(stateRec(1));
    await a.state.recordSession(stateRec(2));
    expect(await a.sync.syncNow(true)).toBe('ok');
    expect(server.rows.map((r) => r.key)).toContain('state_history');

    const b = newDevice('u-abc');
    expect(await b.state.getStateSyncSnapshot()).toHaveLength(0);
    expect(await b.sync.syncNow(true)).toBe('ok');
    const onB = await b.state.getStateSyncSnapshot();
    expect(onB).toHaveLength(2);
    expect(onB.every((r) => !('syncedAt' in r))).toBe(true); // `syncedAt` hoort bij de oudere wachtrij en gaat niet mee

    /* Beide toestellen doen daarna een sessie: samenvoegen geeft er 4, geen dubbele. */
    await a.state.recordSession(stateRec(3));
    await b.state.recordSession(stateRec(4));
    await a.sync.syncNow(true);
    await b.sync.syncNow(true);
    await a.sync.syncNow(true);
    expect((await a.state.getStateSyncSnapshot()).map((r) => r.startedAt).sort()).toEqual((await b.state.getStateSyncSnapshot()).map((r) => r.startedAt).sort());
    expect(await a.state.getStateSyncSnapshot()).toHaveLength(4);
  });

  it('favorites, listening history and resume positions travel — and a removed favorite stays removed on the other device', async () => {
    const fav = (n: number) => ({ url: `https://x/${n}.mp3`, title: `T${n}`, series: 'S', ts: 1000 + n });
    const a = newDevice('u-abc');
    await a.fav.applyFavoritesSync([fav(1), fav(2)]);
    await a.listen.applyAudioHistorySync([{ url: fav(1).url, title: 'T1', series: 'S', ts: 5000, dur: 300, full: true, fc: 1 }]);
    await a.vzp.applyPositionsSync({ [fav(2).url]: 123 });
    expect(await a.sync.syncNow(true)).toBe('ok');
    expect(server.rows.map((r) => r.key)).toContain('audio');

    const b = newDevice('u-abc');
    expect(await b.sync.syncNow(true)).toBe('ok');
    expect((await b.fav.getFavoritesSyncSnapshot()).map((f) => f.url).sort()).toEqual([fav(1).url, fav(2).url]);
    expect((await b.listen.getAudioHistorySyncSnapshot()).map((h) => h.ts)).toEqual([5000]);
    expect(await b.vzp.getPositionsSyncSnapshot()).toEqual({ [fav(2).url]: 123 });

    /* A haalt favoriet 2 weg: dat moet ook op B gebeuren (niet terugkomen). */
    await a.fav.applyFavoritesSync([fav(1)]);
    await a.sync.syncNow(true);
    await b.sync.syncNow(true);
    expect((await b.fav.getFavoritesSyncSnapshot()).map((f) => f.url)).toEqual([fav(1).url]);
  });

  it('a guest who creates an account keeps State Control sessions, favorites and listening history', async () => {
    const guest = newDevice('anon');
    await guest.state.recordSession(stateRec(5));
    await guest.fav.applyFavoritesSync([{ url: 'https://x/g.mp3', title: 'G', series: 'S', ts: 1 }]);
    await guest.listen.applyAudioHistorySync([{ url: 'https://x/g.mp3', title: 'G', series: 'S', ts: 9, dur: 60, full: false, fc: 0 }]);
    const account = newDevice('u-new', guest.storage); // dezelfde opslag, nu met een account
    expect(await account.sync.syncNow(true)).toBe('ok');
    expect(await account.state.getStateSyncSnapshot()).toHaveLength(1);
    expect((await account.fav.getFavoritesSyncSnapshot()).map((f) => f.url)).toEqual(['https://x/g.mp3']);
    expect(await account.listen.getAudioHistorySyncSnapshot()).toHaveLength(1);
  });

  it('a server that rejects a new part (list of allowed parts not updated yet) does not stop the other parts, and is not retried in a loop', async () => {
    const a = newDevice('u-abc');
    await a.settings.setSetting('experienceLevel', 'advanced');
    await a.state.recordSession(stateRec(6));
    /* Nagebootst: de tabel weigert 'state_history' met een 400. */
    server.reject = ['state_history'];
    expect(await a.sync.syncNow(true)).toBe('ok');
    expect(server.rows.map((r) => r.key)).toContain('settings'); // de rest werkt gewoon
    expect(server.rows.map((r) => r.key)).not.toContain('state_history');
    const afterFirst = server.rejected;
    expect(afterFirst).toBeGreaterThan(0);
    await a.sync.syncNow(true);
    await a.sync.syncNow(true);
    expect(server.rejected).toBe(afterFirst); // niet opnieuw geprobeerd
  });
});
