/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Backup & Sync, de kern (zuivere functies, geen opslag/netwerk)

   26 okt 2026 (operator: "ja bouwen backup en sync"). Alles wat beslist WAT er
   gebeurt (push, toepassen, samenvoegen) staat hier, los van AsyncStorage en
   fetch, zodat het met unit-tests te bewijzen is. `cloud-sync.ts` koppelt dit
   aan de echte opslag en aan Supabase.

   MODEL
   Vier onderdelen ("domeinen"), elk één JSON-waarde per gebruiker op de server:
     settings · resting_pulse · breath_history · plan
   Per domein houdt het toestel bij: de hash van wat het laatst gesynct is
   (`syncedHash`) en de serverstempel van de laatste keer dat het de server zag
   (`remoteAt`). Daaruit volgt de beslissing:

     lokaal veranderd?  = hash(nu) ≠ syncedHash
     server veranderd?  = serverstempel ≠ remoteAt

     geen serverrij  + lokaal iets        → push
     server veranderd + lokaal veranderd  → samenvoegen, toepassen én pushen
     server veranderd                     → toepassen
     lokaal veranderd                     → push
     verder                               → niets

   Samenvoegen is per domein verschillend en verliest nooit iets wat de
   gebruiker deed: ademhistoriek = vereniging; vlaggen ("onboarding afgerond",
   "gratis sessie gebruikt") = ooit gezet blijft gezet; de rest = de nieuwste.
   ─────────────────────────────────────────────────────────────────────────── */

export type SyncDomain = 'settings' | 'resting_pulse' | 'breath_history' | 'plan';
export const SYNC_DOMAINS: SyncDomain[] = ['settings', 'resting_pulse', 'breath_history', 'plan'];

/** Instellingen die mee reizen met het account. Bewust NIET: herinneringen en
 *  meldingen (per toestel), thema, audiokwaliteit, introductie-gezien (een nieuw
 *  toestel mag de uitleg opnieuw zien), testvlaggen en alle uitstel-tellers. */
export const SYNCED_SETTING_KEYS = [
  'voiceCues',
  'voiceCuesChosen',
  'voiceGender',
  'hapticsPhone',
  'watchHaptics',
  'goals',
  'intensity',
  'experienceLevel',
  'breathTechByState',
  'breathPrefs',
  'soundscapeByState',
  'profile',
  'hasBuiltProtocol',
  'breathLevelSeen',
  'instantDurationBias',
  'breathOnboardingCompletedAt',
  'stateOnboardingCompletedAt',
  'braceletOnboardingCompletedAt',
  'breathFreeSessionUsedAt',
  'stateFreeSessionUsedAt',
  'stateFreeMode',
] as const;

/** "Ooit gezet blijft gezet": een tijdstempel of vlag die op één toestel gezet is
 *  (onboarding afgerond, gratis sessie gebruikt) mag een ander toestel nooit
 *  terugzetten. Bij twee waarden wint de vroegste tijdstempel. */
const STAMP_KEYS = new Set([
  'breathOnboardingCompletedAt',
  'stateOnboardingCompletedAt',
  'braceletOnboardingCompletedAt',
  'breathFreeSessionUsedAt',
  'stateFreeSessionUsedAt',
]);
const STICKY_TRUE_KEYS = new Set(['voiceCuesChosen', 'hasBuiltProtocol']);

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Stabiele tekstvorm (sleutels gesorteerd) — dezelfde waarde geeft altijd dezelfde hash. */
export function stableStringify(v: unknown): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`;
}

/** Kleine, snelle hash (djb2 over de stabiele tekst) — enkel om "veranderd?" te zien. */
export function hashValue(v: unknown): string {
  const s = stableStringify(v);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

/* ── Instellingen ─────────────────────────────────────────────────────── */

export type SettingsPayload = Record<string, Json>;

function isEmptyish(v: unknown): boolean {
  return v === null || v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);
}

/** Voegt twee instellingen-sets samen. `local` is wat dit toestel heeft, `remote` wat het account heeft. */
export function mergeSettings(local: SettingsPayload, remote: SettingsPayload): SettingsPayload {
  const out: SettingsPayload = {};
  for (const key of SYNCED_SETTING_KEYS) {
    const l = local[key];
    const r = remote[key];
    if (STAMP_KEYS.has(key)) {
      const nums = [l, r].filter((x): x is number => typeof x === 'number');
      out[key] = nums.length ? Math.min(...nums) : null;
    } else if (STICKY_TRUE_KEYS.has(key)) {
      out[key] = l === true || r === true;
    } else if (key === 'stateFreeMode') {
      out[key] = (typeof r === 'number' ? r : typeof l === 'number' ? l : null) as Json;
    } else if (r !== undefined && !isEmptyish(r)) {
      out[key] = r;
    } else if (l !== undefined) {
      out[key] = l;
    }
  }
  return out;
}

/* ── Ademhistoriek ────────────────────────────────────────────────────── */

export type HistoryEntry = {
  key: string;
  name: string;
  ts: number;
  durSec: number;
  rounds: number;
  completed?: boolean;
  techniqueKey?: string;
};
export type HistoryTotals = { sessions: number; sec: number; bestStreak: number };
export type HistoryPayload = { entries: HistoryEntry[]; totals: HistoryTotals };

export const MAX_HISTORY_ENTRIES = 2000;

/** Vereniging op (tijdstip + toestand + duur): een sessie telt één keer, ook als twee toestellen haar kennen. */
export function mergeHistory(a: HistoryPayload, b: HistoryPayload): HistoryPayload {
  const seen = new Map<string, HistoryEntry>();
  for (const e of [...a.entries, ...b.entries]) {
    const id = `${e.ts}|${e.key}|${e.durSec}`;
    if (!seen.has(id)) seen.set(id, e);
  }
  const entries = [...seen.values()].sort((x, y) => y.ts - x.ts).slice(0, MAX_HISTORY_ENTRIES);
  return {
    entries,
    totals: {
      sessions: Math.max(a.totals.sessions, b.totals.sessions, entries.length),
      sec: Math.max(a.totals.sec, b.totals.sec),
      bestStreak: Math.max(a.totals.bestStreak, b.totals.bestStreak),
    },
  };
}

/* ── Rusthartslag en plan: de nieuwste wint ───────────────────────────── */

export type PulsePayload = {
  readings: { bpm: number; at: number; src?: string }[];
  manual: { bpm: number; at: number } | null;
  average: boolean;
  decided: boolean;
  clearedAt?: number;
};

/** Het jongste moment waarop de gebruiker iets met zijn rusthartslag deed. */
export function pulseStamp(p: PulsePayload): number {
  return Math.max(0, p.manual?.at ?? 0, p.clearedAt ?? 0, ...p.readings.map((r) => r.at));
}

export function pickPulse(local: PulsePayload, remote: PulsePayload): PulsePayload {
  if (!local.decided) return remote;
  if (!remote.decided) return local;
  return pulseStamp(remote) > pulseStamp(local) ? remote : local;
}

export type PlanPayload = { id: string; createdAt: number } & Record<string, Json>;

export function pickPlan(local: PlanPayload | null, remote: PlanPayload | null): PlanPayload | null {
  if (!local) return remote;
  if (!remote) return local;
  return remote.createdAt > local.createdAt ? remote : local;
}

/* ── De beslissing per domein ─────────────────────────────────────────── */

export type DomainMeta = { syncedHash?: string; remoteAt?: string };
export type RemoteRow = { value: unknown; updated_at: string } | null;

export type SyncAction =
  | { type: 'none' }
  | { type: 'push' }
  | { type: 'apply' }
  | { type: 'merge' };

/**
 * @param localHash   hash van de huidige lokale waarde
 * @param emptyHash   hash van "niets gedaan" (standaardwaarden) — dat telt nooit als een wijziging
 */
export function decide(meta: DomainMeta, localHash: string, emptyHash: string, remote: RemoteRow): SyncAction {
  const localChanged = localHash !== (meta.syncedHash ?? emptyHash);
  /* Geen serverrij: alles wat het toestel heeft moet er heen (ook als de rij ooit gewist is). */
  if (!remote) return localHash !== emptyHash ? { type: 'push' } : { type: 'none' };
  const remoteChanged = remote.updated_at !== meta.remoteAt;
  if (remoteChanged && localChanged) return { type: 'merge' };
  if (remoteChanged) return { type: 'apply' };
  if (localChanged) return { type: 'push' };
  return { type: 'none' };
}
