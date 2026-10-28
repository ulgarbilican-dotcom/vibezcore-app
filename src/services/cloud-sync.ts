/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Backup & Sync (26 okt 2026, operator: "ja bouwen backup en sync")

   Wat een ingelogde gebruiker op dit toestel doet, reist mee met zijn account:
   instellingen (doelen, niveau, stem/trilling, onboarding-vlaggen), rusthartslag,
   ademhistoriek, het actieve plan, State Control-sessies en de Audio Library
   (favorieten, beluisterde sessies, hervatposities — 28 okt 2026). Een gast blijft volledig lokaal — niets
   verlaat het toestel zonder account (en niets staat achter een login).

   HOE
   - Tabel `user_data` (docs/backend/user-data-migration.sql), per gebruiker per
     onderdeel één JSON-waarde, beveiligd met RLS (iedereen enkel de eigen rijen).
   - De app praat met Supabase REST met de login-token van de gebruiker (zelfde
     host als de aggregate play-events). Geen eigen backend-functie nodig.
   - De beslissingen (push / toepassen / samenvoegen) staan in cloud-sync-core.ts
     en zijn met unit-tests bewezen; dit bestand koppelt ze aan de opslag.
   - Stil falen: geen netwerk, geen tabel (nog niet aangemaakt) of een fout →
     niets gebeurt, de app werkt gewoon lokaal en probeert later opnieuw.

   GAST → ACCOUNT: de eerste keer dat een account op dit toestel synct, nemen we
   de lokale gastgegevens (ademhistoriek, plan, State Control-sessies, favorieten, beluisterd) over naar dat account, zodat
   "account maken" niets kwijtmaakt.

   WANNEER: kort na het opstarten, bij terugkeren naar de app, bij het verlaten
   van de app (wegschrijven), bij inloggen/uitloggen, en elke 2 minuten terwijl de
   app open is — maar het netwerk wordt enkel gebruikt als er lokaal iets
   veranderd is of de laatste controle langer dan 10 minuten geleden is.
   ─────────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';

import { SUPABASE_KEY, SUPABASE_URL } from '@/constants/supabase';
import { QA_ENABLED } from '@/utils/qa';
import { fetchWithTimeout, getToken } from '@/services/auth';
import {
  SYNCED_SETTING_KEYS,
  SYNC_DOMAINS,
  decide,
  hashValue,
  mergeAudio,
  mergeHistory,
  mergeSettings,
  mergeStateHistory,
  pickPlan,
  pickPulse,
  type AudioPayload,
  type DomainMeta,
  type HistoryPayload,
  type PlanPayload,
  type PulsePayload,
  type SettingsPayload,
  type StatePayload,
  type StateSessionRecord,
  type SyncDomain,
} from '@/services/cloud-sync-core';
import { applyRestingSync, getRestingSyncSnapshot, type RestingSyncStored } from '@/services/resting-pulse';
import { applyBreathSync, getBreathSyncSnapshot, reloadBreathHistory } from '@/utils/breath-history';
import { applyFavoritesSync, getFavoritesSyncSnapshot, reloadFavorites } from '@/hooks/useFavorites';
import { applyStateSync, getStateSyncSnapshot, reloadStateHistory } from '@/utils/bracelet-history';
import { applyAudioHistorySync, getAudioHistorySyncSnapshot, reloadAudioHistory } from '@/utils/history';
import { applyPositionsSync, getPositionsSyncSnapshot, reloadPositions } from '@/utils/vzp';
import { getActivePlanLoaded, clearActivePlan, reloadActivePlan, saveActivePlan, type ActivePlan } from '@/utils/plan-store';
import { getActiveBraceletPlanLoaded, reloadActiveBraceletPlan, saveActiveBraceletPlan, type BraceletActivePlan } from '@/utils/bracelet-plan-store';
import { SETTING_DEFAULTS, ensureSettingsLoaded, getSetting, setSetting } from '@/utils/settings';
import { resolveActiveBucket, subscribeUserBucket } from '@/utils/user-bucket';

/** Onderdelen die de server afwees; tot de volgende start niet opnieuw proberen. */
const rejectedDomains = new Set<SyncDomain>();
const META_KEY = 'vz_cloud_sync_meta_v1';
const CHECK_EVERY_MS = 10 * 60_000;
const POLL_MS = 2 * 60_000;
const FOREGROUND_THROTTLE_MS = 20_000;

type Meta = { users: Record<string, { domains: Partial<Record<SyncDomain, DomainMeta>>; adopted?: boolean; checkedAt?: number }> };

/* ── Opslag per domein ─────────────────────────────────────────────────── */

type Handler<T> = {
  empty: T;
  read: () => Promise<T>;
  apply: (v: T) => Promise<void>;
  merge: (local: T, remote: T) => T;
  valid: (v: unknown) => v is T;
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const settingsHandler: Handler<SettingsPayload> = {
  empty: Object.fromEntries(SYNCED_SETTING_KEYS.map((k) => [k, SETTING_DEFAULTS[k] as never])) as SettingsPayload,
  read: async () => {
    await ensureSettingsLoaded();
    return Object.fromEntries(SYNCED_SETTING_KEYS.map((k) => [k, getSetting(k) as never])) as SettingsPayload;
  },
  apply: async (v) => {
    await ensureSettingsLoaded();
    for (const k of SYNCED_SETTING_KEYS) {
      if (!(k in v)) continue;
      /* De stem pas overnemen als de gebruiker ze zelf ooit koos; `setSetting` zet dan ook de "gekozen"-vlag. */
      if (k === 'voiceCues' && v.voiceCuesChosen !== true) continue;
      if (k === 'voiceCuesChosen') continue;
      await setSetting(k, v[k] as never);
    }
    if (v.voiceCuesChosen === true && !getSetting('voiceCuesChosen')) await setSetting('voiceCuesChosen', true);
  },
  merge: mergeSettings,
  valid: (v): v is SettingsPayload => isObj(v),
};

const EMPTY_PULSE: PulsePayload = { readings: [], manual: null, average: false, decided: false };
const pulseHandler: Handler<PulsePayload> = {
  empty: EMPTY_PULSE,
  read: async () => {
    const s = await getRestingSyncSnapshot();
    return { readings: s.readings, manual: s.manual, average: s.average, decided: s.decided, ...(s.clearedAt ? { clearedAt: s.clearedAt } : {}) } as PulsePayload;
  },
  apply: async (v) => applyRestingSync(v as unknown as RestingSyncStored),
  merge: pickPulse,
  valid: (v): v is PulsePayload => isObj(v) && Array.isArray(v.readings) && typeof v.decided === 'boolean',
};

const EMPTY_HISTORY: HistoryPayload = { entries: [], totals: { sessions: 0, sec: 0, bestStreak: 0 } };
const historyHandler: Handler<HistoryPayload> = {
  empty: EMPTY_HISTORY,
  read: async () => (await getBreathSyncSnapshot()) as unknown as HistoryPayload,
  apply: async (v) => applyBreathSync(v as never),
  merge: mergeHistory,
  valid: (v): v is HistoryPayload => isObj(v) && Array.isArray(v.entries) && isObj(v.totals),
};

/* 28 okt 2026 (operator: "dat had standaard moeten gebeuren"): het State Control-plan reist mee in hetzelfde onderdeel als het
   Breathwork-plan (`statePlan` naast `plan`) — geen nieuwe rij, dus geen databasewijziging. Een rij van een oudere app-versie heeft
   geen `statePlan`: dan blijft het plan op dit toestel ongemoeid. */
type PlanWrap = { plan: PlanPayload | null; statePlan?: PlanPayload | null };
const planHandler: Handler<PlanWrap> = {
  empty: { plan: null, statePlan: null },
  read: async () => ({
    plan: (await getActivePlanLoaded()) as unknown as PlanPayload | null,
    statePlan: (await getActiveBraceletPlanLoaded()) as unknown as PlanPayload | null,
  }),
  apply: async (v) => {
    if (v.plan) await saveActivePlan(v.plan as unknown as ActivePlan);
    else await clearActivePlan();
    if ('statePlan' in v) await saveActiveBraceletPlan((v.statePlan ?? null) as unknown as BraceletActivePlan | null);
  },
  merge: (l, r) => ({ plan: pickPlan(l.plan, r.plan), statePlan: pickPlan(l.statePlan ?? null, r.statePlan ?? null) }),
  valid: (v): v is PlanWrap => isObj(v) && 'plan' in v,
};

const EMPTY_STATE: StatePayload = { sessions: [] };
const stateHandler: Handler<StatePayload> = {
  empty: EMPTY_STATE,
  read: async () => ({ sessions: (await getStateSyncSnapshot()) as unknown as StateSessionRecord[] }),
  apply: async (v) => applyStateSync(v.sessions as never),
  merge: mergeStateHistory,
  valid: (v): v is StatePayload => isObj(v) && Array.isArray(v.sessions),
};

const EMPTY_AUDIO: AudioPayload = { favorites: [], history: [], positions: {} };
const audioHandler: Handler<AudioPayload> = {
  empty: EMPTY_AUDIO,
  read: async () => ({
    favorites: await getFavoritesSyncSnapshot(),
    history: await getAudioHistorySyncSnapshot(),
    positions: await getPositionsSyncSnapshot(),
  }),
  apply: async (v) => {
    await applyFavoritesSync(v.favorites);
    await applyAudioHistorySync(v.history as never);
    await applyPositionsSync(v.positions);
  },
  merge: mergeAudio,
  valid: (v): v is AudioPayload => isObj(v) && Array.isArray(v.favorites) && Array.isArray(v.history) && isObj(v.positions),
};

const HANDLERS: Record<SyncDomain, Handler<any>> = {
  settings: settingsHandler,
  resting_pulse: pulseHandler,
  breath_history: historyHandler,
  plan: planHandler,
  state_history: stateHandler,
  audio: audioHandler,
};

/* ── Netwerk ───────────────────────────────────────────────────────────── */

type Row = { key: SyncDomain; value: unknown; updated_at: string };

function headers(token: string): Record<string, string> {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** `null` = niet gelukt of tabel bestaat nog niet. */
async function fetchRows(token: string): Promise<Row[] | null> {
  try {
    const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/user_data?select=key,value,updated_at`, { headers: headers(token) });
    if (res.status === 404) {
      tableMissing = true;
      return null;
    }
    if (!res.ok) return null;
    const rows = (await res.json()) as Row[];
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

async function upsertRow(token: string, key: SyncDomain, value: unknown): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/user_data?on_conflict=user_id,key`, {
      method: 'POST',
      headers: { ...headers(token), Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{ key, value }]),
    });
    if (res.status === 404) tableMissing = true;
    /* De server wijst dit onderdeel af (bv. de lijst toegestane onderdelen kent het nog niet): niet bij elke ronde opnieuw proberen, enkel
       tot de volgende start van de app. De andere onderdelen synchroniseren gewoon door. */
    if (res.status >= 400 && res.status < 500 && ![401, 404, 408, 429].includes(res.status)) rejectedDomains.add(key);
    if (!res.ok) return null;
    const rows = (await res.json()) as Row[];
    return rows?.[0]?.updated_at ?? null;
  } catch {
    return null;
  }
}

/* ── Meta (per gebruiker, per domein) ──────────────────────────────────── */

async function loadMeta(): Promise<Meta> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && isObj(p) && isObj(p.users)) return p as Meta;
  } catch {
    /* corrupt → opnieuw beginnen is veilig: er wordt dan samengevoegd, niets gewist */
  }
  return { users: {} };
}
async function saveMeta(m: Meta): Promise<void> {
  try {
    await AsyncStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* volgende ronde opnieuw */
  }
}

/* ── Gast → account ────────────────────────────────────────────────────── */

/** Kopieert de lokale gastgegevens naar de emmer van dit account, als die daar nog niets heeft. Verwijdert niets. */
async function adoptGuestData(bucket: string): Promise<boolean> {
  const pairs: [string, string][] = [
    [`vbh_anon_v2`, `vbh_${bucket}_v2`],
    [`vbh_totals_anon_v2`, `vbh_totals_${bucket}_v2`],
    [`vzpc_anon_v1`, `vzpc_${bucket}_v1`],
    /* 28 okt 2026: State Control-sessies en de Audio Library gaan ook mee. */
    [`vzbc_sessions_anon_v1`, `vzbc_sessions_${bucket}_v1`],
    [`vzbpc_anon_v1`, `vzbpc_${bucket}_v1`],
    [`vzf_anon_v1`, `vzf_${bucket}_v1`],
    [`vzh_anon_v1`, `vzh_${bucket}_v1`],
    [`vzp_anon_v1`, `vzp_${bucket}_v1`],
  ];
  let copied = false;
  for (const [from, to] of pairs) {
    try {
      const [src, dst] = await Promise.all([AsyncStorage.getItem(from), AsyncStorage.getItem(to)]);
      if (src && !dst) {
        await AsyncStorage.setItem(to, src);
        copied = true;
      }
    } catch {
      /* best effort */
    }
  }
  return copied;
}

/* ── De synchronisatie zelf ────────────────────────────────────────────── */


let inflight: Promise<void> | null = null;
let tableMissing = false;
let lastForegroundAt = 0;

export type SyncResult = 'ok' | 'skipped' | 'offline-or-no-table';

/** Alleen in een testbuild: één regel per ronde in logcat, zodat de synchronisatie meetbaar is. */
function qaLog(info: Record<string, unknown>): void {
  if (QA_ENABLED) console.log(`[QA-SYNC] ${JSON.stringify(info)}`);
}

async function runOnce(force: boolean): Promise<SyncResult> {
  if (tableMissing) {
    qaLog({ result: 'skipped', why: 'table-missing' });
    return 'skipped';
  }
  const bucket = await resolveActiveBucket();
  if (!bucket.startsWith('u-')) {
    qaLog({ result: 'skipped', why: 'not-a-real-user', bucket: bucket.slice(0, 6) });
    return 'skipped'; // gast of testbuild-override: blijft lokaal
  }
  const token = await getToken();
  if (!token) {
    qaLog({ result: 'skipped', why: 'no-token' });
    return 'skipped';
  }
  const actions: Record<string, string> = {};

  const meta = await loadMeta();
  const user = (meta.users[bucket] ??= { domains: {} });

  if (!user.adopted) {
    if (await adoptGuestData(bucket)) {
      await Promise.all([reloadBreathHistory(), reloadActivePlan(), reloadActiveBraceletPlan(), reloadStateHistory(), reloadFavorites(), reloadAudioHistory(), reloadPositions()]);
    }
    user.adopted = true;
  }

  /* Lokaal lezen + hashen is goedkoop; het netwerk enkel als er iets veranderd is of het lang geleden is. */
  const locals: Partial<Record<SyncDomain, { value: unknown; hash: string }>> = {};
  let anyChanged = false;
  for (const d of SYNC_DOMAINS) {
    const h = HANDLERS[d];
    const value = await h.read();
    const hash = hashValue(value);
    locals[d] = { value, hash };
    if (hash !== (user.domains[d]?.syncedHash ?? hashValue(h.empty))) anyChanged = true;
  }
  if (!force && !anyChanged && Date.now() - (user.checkedAt ?? 0) < CHECK_EVERY_MS) {
    await saveMeta(meta);
    qaLog({ result: 'skipped', why: 'nothing-changed' });
    return 'skipped';
  }

  const rows = await fetchRows(token);
  if (!rows) {
    await saveMeta(meta);
    qaLog({ result: 'offline-or-no-table', tableMissing });
    return 'offline-or-no-table';
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));

  for (const d of SYNC_DOMAINS) {
    if (rejectedDomains.has(d)) {
      actions[d] = 'rejected-by-server';
      continue;
    }
    const h = HANDLERS[d];
    const local = locals[d]!;
    const row = byKey.get(d) ?? null;
    const dm: DomainMeta = user.domains[d] ?? {};
    const remote = row && h.valid(row.value) ? { value: row.value, updated_at: row.updated_at } : null;
    if (row && !remote) continue; // onbekende vorm op de server: nooit blind overschrijven
    const action = decide(dm, local.hash, hashValue(h.empty), remote);
    actions[d] = `${action.type}${row ? '' : '(no-row)'}`;

    if (action.type === 'push') {
      const at = await upsertRow(token, d, local.value);
      if (at) user.domains[d] = { syncedHash: local.hash, remoteAt: at };
    } else if (action.type === 'apply' && remote) {
      await h.apply(remote.value);
      user.domains[d] = { syncedHash: hashValue(await h.read()), remoteAt: remote.updated_at };
    } else if (action.type === 'merge' && remote) {
      const merged = h.merge(local.value, remote.value);
      await h.apply(merged);
      const now = await h.read();
      const at = await upsertRow(token, d, now);
      user.domains[d] = at ? { syncedHash: hashValue(now), remoteAt: at } : { syncedHash: dm.syncedHash, remoteAt: dm.remoteAt };
    }
  }
  user.checkedAt = Date.now();
  await saveMeta(meta);
  qaLog({ result: 'ok', rows: rows.length, actions });
  return 'ok';
}

/** Eén synchronisatie tegelijk; stil bij elke fout. `force` slaat de "niets veranderd"-kortsluiting over. */
export function syncNow(force = false): Promise<SyncResult> {
  if (inflight) return inflight.then(() => 'skipped' as SyncResult);
  const p = runOnce(force)
    .catch(() => 'offline-or-no-table' as SyncResult)
    .finally(() => {
      inflight = null;
    });
  inflight = p.then(() => undefined);
  return p;
}

/* ── Opstarten ─────────────────────────────────────────────────────────── */

let started = false;

/** Eén keer aanroepen bij het opstarten van de app. */
export function startCloudSync(): void {
  if (started) return;
  started = true;
  setTimeout(() => void syncNow(true), 4000);
  AppState.addEventListener('change', (st: AppStateStatus) => {
    if (st === 'active') {
      if (Date.now() - lastForegroundAt < FOREGROUND_THROTTLE_MS) return;
      lastForegroundAt = Date.now();
      void syncNow(true);
    } else {
      void syncNow(false); // wegschrijven voordat de app naar de achtergrond gaat
    }
  });
  subscribeUserBucket(() => void syncNow(true)); // inloggen/uitloggen
  setInterval(() => {
    if (AppState.currentState === 'active') void syncNow(false);
  }, POLL_MS);
}

/** Alleen voor tests/QA: alles opnieuw beginnen. */
export function __resetCloudSyncForTests(): void {
  inflight = null;
  tableMissing = false;
  rejectedDomains.clear();
  lastForegroundAt = 0;
}

