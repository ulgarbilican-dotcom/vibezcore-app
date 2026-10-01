/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet session history (per-user, sync-ready)

   Iter 9dn (2026-05-31): refactor naar per-user-buckets en sync-ready
   schema. Local-first architectuur, klaar voor toekomstige backend-sync
   zonder breaking changes aan UI of recording-laag.

   STORAGE-KEYS (per bucket):
     - Real signed-in user  : vzbc_sessions_u-{supabase-user-id}_v1
     - Dev override (audio) : vzbc_sessions_dev-audio_v1
     - Dev override (bracelet): vzbc_sessions_dev-bracelet_v1
     - Dev override (pro)   : vzbc_sessions_dev-pro_v1
     - Dev override (guest) : vzbc_sessions_dev-guest_v1
     - No user / fallback   : vzbc_sessions_anon_v1
     - LEGACY (migrated)    : vzbc_sessions_v1 (old global key, auto-
                              migrated to current bucket on first run)

   SCHEMA (per sessie):
     {
       id          : UUID-like (Date.now + random base36)
       mode        : BraceletMode index (0-4)
       startedAt   : ISO-timestamp van Start
       endedAt     : ISO-timestamp van End/Stop
       durationMin : werkelijk doorgebrachte minuten
       plannedMin  : door user gekozen duration
       status      : 'completed' | 'stopped'
       breathwork? : optionele breath-stats (iter 9ca)
       // sync-ready velden (iter 9dn):
       updatedAt   : ISO-timestamp van laatste mutatie (conflict-resolution)
       syncedAt    : ISO-timestamp van laatste backend-sync, OR null
                     (null = pending sync; gevuld = on backend)
     }

   FUTURE BACKEND-SYNC (planned, not yet built):
     - POST /api/bracelet/sessions  → push records waar syncedAt=null
     - GET  /api/bracelet/sessions?since={ts} → pull updates from backend
     - DELETE /api/bracelet/sessions/{id} → cascade clear
     - Sync layer hoeft alleen syncedAt te muteren — UI/recording-laag
       zijn al sync-onafhankelijk.

   CAP op 500 records (~1 jaar bij 1-2/dag).
   ─────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { getToken } from '@/services/auth';
import {
  awaitDevUserOverrideLoaded,
  getDevUserOverride,
  subscribeDevUserOverride,
} from '@/utils/dev-user-override';

const LEGACY_KEY = 'vzbc_sessions_v1';
const KEY_PREFIX = 'vzbc_sessions_';
const KEY_SUFFIX = '_v1';
const MAX_RECORDS = 500;

export type SessionStatus = 'completed' | 'stopped';

/* Iter 9ca (2026-05-31): breathwork-tracking per sessie.
   - protocol = kind van breathwork (box/478/simple/nadi/sigh/triangle)
   - name     = display-naam ("Triangle breath", "Box breathing", etc.)
   - cyclesCompleted = aantal voltooide cycli (kan cumulatief zijn als
     user breathwork meerdere keren in/uit deed binnen 1 sessie)
   - cyclesTarget = bedoeld aantal cycli van laatste protocol-run
   - durationSec = totale ademhalings-tijd (cumulatief) */
export type SessionBreathwork = {
  protocol: string;
  name: string;
  cyclesCompleted: number;
  cyclesTarget: number;
  durationSec: number;
};

export type SessionRecord = {
  id: string;
  mode: number;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  plannedMin: number;
  status: SessionStatus;
  /* Iter 9ca: optioneel — alleen aanwezig als user breathwork toggled
     activeerde tijdens deze sessie. Oude records blijven valide. */
  breathwork?: SessionBreathwork;
  /* Iter 9dn (2026-05-31): sync-ready velden voor toekomstige backend.
     - updatedAt: ISO-timestamp van laatste mutatie (conflict-resolution
       voor "last-write-wins" sync-strategie).
     - syncedAt: null = record nog niet op backend, ISO = wel gesynct.
     Beide optioneel zodat oude records (zonder deze velden) gewoon
     blijven werken — sync-laag negeert ze of vult ze later in. */
  updatedAt?: string;
  syncedAt?: string | null;
};

let cache: SessionRecord[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;
let activeBucket: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  setTimeout(() => { listeners.forEach((l) => l()); }, 0);
}

/* ── User bucket resolution ────────────────────────────────────────
   Bepaalt onder welke key history wordt opgeslagen voor de huidige
   gebruiker. Hierarchy:
     1. Dev-override actief → 'dev-{override}' bucket
     2. Echte token aanwezig → 'u-{jwt-sub}' bucket
     3. Niemand → 'anon' bucket
   Iter 9dn (2026-05-31). */

/** Decode het JWT-payload veilig zonder library. Returnt de `sub` claim
 *  (Supabase user-id) of null bij parse-fouten. */
function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    /* JWT gebruikt URL-safe base64 (- en _ ipv + en /). */
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json =
      typeof atob === 'function'
        ? atob(b64)
        : /* Fallback voor environments zonder atob — base64-decode via
             Buffer als die beschikbaar is. */
          (globalThis as any).Buffer
          ? (globalThis as any).Buffer.from(b64, 'base64').toString('utf8')
          : '';
    if (!json) return null;
    const payload = JSON.parse(json);
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Bepaal de actieve bucket-naam voor history-storage. Async want het
 *  resolvet zowel de dev-override-cache als de token uit AsyncStorage. */
export async function resolveActiveBucket(): Promise<string> {
  await awaitDevUserOverrideLoaded();
  const override = getDevUserOverride();
  if (override) {
    return `dev-${override}`;
  }
  try {
    const token = await getToken();
    if (token) {
      const sub = decodeJwtSub(token);
      if (sub) return `u-${sub}`;
    }
  } catch {
    /* token-fetch faalt → val terug op anon */
  }
  return 'anon';
}

function bucketKey(bucket: string): string {
  return `${KEY_PREFIX}${bucket}${KEY_SUFFIX}`;
}

/** Migreer eenmalig de oude global key (vzbc_sessions_v1) naar de
 *  current-user bucket. Doel: bestaande gebruikers behouden hun
 *  history na deze refactor. Wordt alleen uitgevoerd als:
 *    1. Oude key bestaat
 *    2. Nieuwe bucket-key NOG NIET bestaat (geen overschrijven)
 *  Na succes wordt de oude key gewist. */
async function migrateLegacyIfNeeded(bucket: string): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const newKey = bucketKey(bucket);
    const existing = await AsyncStorage.getItem(newKey);
    if (existing) {
      /* Nieuwe key heeft al data → geen migration, alleen legacy wissen
         zodat 'ie niet bij volgende refresh opnieuw migreert. */
      await AsyncStorage.removeItem(LEGACY_KEY);
      return;
    }
    await AsyncStorage.setItem(newKey, legacy);
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    /* migration mislukt — proberen we volgende keer opnieuw */
  }
}

async function loadOnce(): Promise<void> {
  if (loaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      activeBucket = await resolveActiveBucket();
      await migrateLegacyIfNeeded(activeBucket);
      const raw = await AsyncStorage.getItem(bucketKey(activeBucket));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          /* Defensieve filter — alleen records met alle vereiste velden
             behouden. Voorkomt crashes wanneer schema later evolueert.
             Iter 9ca: breathwork is optioneel — geen filter-fail als
             afwezig of incompleet (gewoon strippen). */
          cache = parsed.filter(
            (r): r is SessionRecord =>
              !!r &&
              typeof r.id === 'string' &&
              typeof r.mode === 'number' &&
              typeof r.startedAt === 'string' &&
              typeof r.endedAt === 'string' &&
              typeof r.durationMin === 'number' &&
              typeof r.plannedMin === 'number' &&
              (r.status === 'completed' || r.status === 'stopped'),
          ).map((r) => {
            /* Validate optionele breathwork; strip als incomplete. */
            const bw = (r as SessionRecord).breathwork;
            if (
              bw &&
              typeof bw.protocol === 'string' &&
              typeof bw.name === 'string' &&
              typeof bw.cyclesCompleted === 'number' &&
              typeof bw.cyclesTarget === 'number' &&
              typeof bw.durationSec === 'number'
            ) {
              return r;
            }
            const { breathwork: _strip, ...rest } = r as SessionRecord;
            return rest as SessionRecord;
          });
        }
      }
    } catch {
      /* corrupt → start uncached */
    }
    loaded = true;
    notify();
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  if (!activeBucket) return;
  try {
    await AsyncStorage.setItem(
      bucketKey(activeBucket),
      JSON.stringify(cache),
    );
  } catch {
    /* schrijf-fout — runtime cache blijft, volgende write probeert weer */
  }
}

/** Genereer een unieke ID. Math.random + base36 is genoeg voor lokale
 *  records (geen collision-kans bij 500 entries). */
function newId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

/** Voeg een nieuwe sessie toe aan de history. Cache is in chronologische
 *  reverse-order (nieuwste eerst) zodat recent-views snel zijn.
 *  Iter 9dn (2026-05-31): voegt updatedAt + syncedAt:null toe voor
 *  toekomstige backend-sync.
 *  Iter 9do (2026-05-31): triggert ook een async sync-attempt na schrijven
 *  — push de nieuwe record naar backend zodra netwerk/token beschikbaar. */
export async function recordSession(
  data: Omit<SessionRecord, 'id' | 'updatedAt' | 'syncedAt'>,
): Promise<void> {
  await loadOnce();
  const now = new Date().toISOString();
  const record: SessionRecord = {
    id: newId(),
    ...data,
    updatedAt: now,
    syncedAt: null,
  };
  cache = [record, ...cache].slice(0, MAX_RECORDS);
  notify();
  persist();
  /* Best-effort sync — silent fail bij netwerk/auth probleem. Dynamic
     import om circular dependency te vermijden (sync-module importeert
     deze module). */
  import('./bracelet-history-sync')
    .then((m) => m.syncAll())
    .catch(() => {
      /* swallow */
    });
}

/** Lees alle records — sorted nieuwste eerst. */
export function getAllSessions(): SessionRecord[] {
  return [...cache];
}

/** Wis alle records van de huidige user. */
export async function clearHistory(): Promise<void> {
  if (!activeBucket) {
    await loadOnce();
  }
  cache = [];
  notify();
  try {
    if (activeBucket) {
      await AsyncStorage.removeItem(bucketKey(activeBucket));
    }
  } catch {
    /* swallow */
  }
}

/** Iter 9do (2026-05-31): sync-service interne API.
 *  Niet voor publiek gebruik — alleen bracelet-history-sync.ts mag deze
 *  aanroepen. Met underscore-prefix gemarkeerd om dat duidelijk te maken.
 *  Markeer pushed records als gesynct (set syncedAt). */
export async function _internalMarkSynced(
  ids: string[],
  syncedAt: string,
): Promise<void> {
  await loadOnce();
  const idSet = new Set(ids);
  let changed = false;
  cache = cache.map((r) => {
    if (idSet.has(r.id) && r.syncedAt !== syncedAt) {
      changed = true;
      return { ...r, syncedAt };
    }
    return r;
  });
  if (changed) {
    notify();
    persist();
  }
}

/** Sync-service interne API: merge server-records in lokale cache.
 *  Last-write-wins op updatedAt. Records die lokaal niet bestaan worden
 *  toegevoegd; bestaande worden alleen overschreven als server-versie
 *  nieuwer is. */
export async function _internalMergeFromServer(
  serverRecords: SessionRecord[],
): Promise<void> {
  await loadOnce();
  const localById = new Map(cache.map((r) => [r.id, r]));
  let changed = false;
  for (const server of serverRecords) {
    const local = localById.get(server.id);
    if (!local) {
      localById.set(server.id, server);
      changed = true;
      continue;
    }
    const localTs = new Date(local.updatedAt || local.endedAt).getTime();
    const serverTs = new Date(server.updatedAt || server.endedAt).getTime();
    if (serverTs > localTs) {
      localById.set(server.id, server);
      changed = true;
    }
  }
  if (changed) {
    /* Re-sort newest first (op endedAt) en cap op MAX_RECORDS. */
    cache = Array.from(localById.values())
      .sort(
        (a, b) =>
          new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
      )
      .slice(0, MAX_RECORDS);
    notify();
    persist();
  }
}

/** Sync-service interne API: lees de actieve bucket. Alleen real-user
 *  buckets ('u-…') worden gesynct — dev-overrides en anon blijven lokaal. */
export function _internalGetActiveBucket(): string | null {
  return activeBucket;
}

/** Iter 9dn (2026-05-31): forceer re-evaluatie van de actieve bucket.
 *  Aan te roepen na:
 *    - Sign in / Sign out (auth-state-verandering)
 *    - Dev-override switch (testing)
 *  Wanneer de bucket wijzigt, wordt de cache opnieuw geladen uit de
 *  nieuwe key zodat de UI direct de juiste user's history toont.
 *  Iter 9do (2026-05-31): triggert ook een sync zodra de nieuwe bucket
 *  geladen is — voor real-user buckets pullt 'ie hun server-records. */
export async function refreshUserBucket(): Promise<void> {
  const newBucket = await resolveActiveBucket();
  if (newBucket === activeBucket) return;
  /* Bucket-switch — reload cache from new key. */
  loaded = false;
  loadPromise = null;
  activeBucket = null;
  cache = [];
  notify();
  await loadOnce();
  /* Best-effort sync na bucket-load — pullt server-records van deze user
     (alleen voor real-user buckets, dev/anon blijven puur lokaal). */
  import('./bracelet-history-sync')
    .then((m) => m.syncAll())
    .catch(() => {
      /* swallow */
    });
}

/* ── Stats-berekening ───────────────────────────────────────────────── */

export type BraceletStats = {
  /** Aantal sessies vandaag (lokale tijd). */
  todaySessions: number;
  /** Cumulatieve minuten vandaag. */
  todayMinutes: number;
  /** Aantal sessies in laatste 7 dagen. */
  weekSessions: number;
  /** Cumulatieve minuten in laatste 7 dagen. */
  weekMinutes: number;
  /** Streak = aantal opeenvolgende dagen tot vandaag met ≥1 sessie.
   *  Vandaag is 0 sessies = streak = 0, anders telt door tot eerste
   *  gat in de keten. */
  streak: number;
  /** Iter 9dq v6 (2026-06-02): hoogste streak ooit bereikt (lifetime).
   *  Gebruikt voor permanent-unlock van streak-milestones — eenmaal
   *  bereikt blijft een streak-badge unlocked, ook na een gebroken
   *  streak. (Apple/Strava/Whoop achievement-model: je verliest je
   *  current streak maar behoudt de prestatie.) */
  bestStreak: number;
  /** Totaal sessies all-time. */
  totalSessions: number;
  /** Lifetime cumulatieve minuten — alle sessies samengeteld. */
  totalMinutes: number;
  /** Iter 9ca: totaal voltooide breathwork-cycli all-time. */
  totalBreathCycles: number;
  /** Iter 9ca: totaal breathwork-minuten all-time. */
  totalBreathMinutes: number;
  /** Iter 9ca: minuten per mode (mode-index → totaal minuten). Voor
   *  mode-breakdown card op de history-page. */
  minutesByMode: Record<number, number>;
  /** Iter 9ca: laatste 7 dagen minuten per dag (oudste → nieuwste).
   *  Voor de mini bar-chart bovenaan history-page. */
  last7Days: { dayKey: string; dayLabel: string; minutes: number }[];
  /** Iter 9dl (2026-05-31): breakdown per breath-protocol — voor de
   *  Breath Protocols card op history.
   *  Iter 9dq (2026-06-02): key = protocol NAME (uniek per protocol:
   *  'Energizing', 'Triangle breath', 'Coherent', 'Nadi Shodhana',
   *  'Box breath') ipv `kind` — die laatste laat Boost+Energizing en
   *  Calm Control+Coherent collidaten op 'simple'. */
  breathByProtocol: Record<
    string,
    {
      name: string;
      cycles: number;
      durationSec: number;
      sessions: number;
    }
  >;
};

/** Bereken stats uit de huidige cache. Synchroon — gebruik na loadOnce().
 *  Optionele forMode filtert records: alleen sessies van die mode tellen
 *  mee. Voor mode-specifieke "today/min today/min total" tijdens een
 *  actieve sessie (context van die specifieke mode). */
export function computeStats(forMode?: number): BraceletStats {
  const source =
    forMode === undefined ? cache : cache.filter((r) => r.mode === forMode);
  const now = new Date();
  const todayKey = dayKey(now);

  /* Build last-7-days zelfs als source leeg is (alle 0). */
  const last7Days = buildLast7Days(now, source);

  if (source.length === 0) {
    return {
      todaySessions: 0,
      todayMinutes: 0,
      weekSessions: 0,
      weekMinutes: 0,
      streak: 0,
      bestStreak: 0,
      totalSessions: 0,
      totalMinutes: 0,
      totalBreathCycles: 0,
      totalBreathMinutes: 0,
      minutesByMode: {},
      last7Days,
      breathByProtocol: {},
    };
  }

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let todaySessions = 0;
  let todayMinutes = 0;
  let weekSessions = 0;
  let weekMinutes = 0;
  let totalMinutes = 0;
  let totalBreathCycles = 0;
  let totalBreathSec = 0;
  const minutesByMode: Record<number, number> = {};
  const breathByProtocol: BraceletStats['breathByProtocol'] = {};
  const daysWithSession = new Set<string>();

  for (const r of source) {
    const endedAt = new Date(r.endedAt);
    const k = dayKey(endedAt);
    daysWithSession.add(k);

    totalMinutes += r.durationMin;
    minutesByMode[r.mode] = (minutesByMode[r.mode] ?? 0) + r.durationMin;

    if (r.breathwork) {
      totalBreathCycles += r.breathwork.cyclesCompleted;
      totalBreathSec += r.breathwork.durationSec;
      /* Iter 9dl: aggregate per breath-protocol voor breakdown card.
         Iter 9dq (2026-06-02): bug-fix — key was `protocol` (= kind:
         'simple' | 'box' | 'triangle' | 'nadi'), maar Boost's
         'Energizing' EN Calm Control's 'Coherent' delen beide
         kind='simple'. Met de oude key werden ze samengevoegd onder
         één 'simple' entry, met de naam van de laatst-geschreven
         sessie als label — niet wat de user verwacht.
         Fix: key op `name` (uniek per protocol: 'Energizing',
         'Triangle breath', 'Coherent', 'Nadi Shodhana', 'Box breath'). */
      const key = r.breathwork.name || r.breathwork.protocol;
      const existing = breathByProtocol[key];
      if (existing) {
        existing.cycles += r.breathwork.cyclesCompleted;
        existing.durationSec += r.breathwork.durationSec;
        existing.sessions += 1;
      } else {
        breathByProtocol[key] = {
          name: r.breathwork.name,
          cycles: r.breathwork.cyclesCompleted,
          durationSec: r.breathwork.durationSec,
          sessions: 1,
        };
      }
    }

    if (k === todayKey) {
      todaySessions += 1;
      todayMinutes += r.durationMin;
    }
    if (endedAt >= weekAgo) {
      weekSessions += 1;
      weekMinutes += r.durationMin;
    }
  }

  /* Streak — count back day by day from today. */
  let streak = 0;
  if (daysWithSession.has(todayKey)) {
    let cursor = new Date(now);
    while (daysWithSession.has(dayKey(cursor))) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  /* Iter 9dq v6: hoogste streak ooit. Itereert door alle dagen met
     sessies in chronologische volgorde en telt de langste opeenvolgende
     reeks. dayKeys zijn YYYY-MM-DD, dus alphabetische sort == chrono. */
  const bestStreak = computeBestStreak(daysWithSession);

  return {
    todaySessions,
    todayMinutes: Math.round(todayMinutes),
    weekSessions,
    weekMinutes: Math.round(weekMinutes),
    streak,
    bestStreak,
    totalSessions: source.length,
    totalMinutes: Math.round(totalMinutes),
    totalBreathCycles,
    totalBreathMinutes: Math.round(totalBreathSec / 60),
    minutesByMode,
    last7Days,
    breathByProtocol,
  };
}

/* Iter 9dq v6 (2026-06-02): hoogste opeenvolgende streak ooit bereikt.
   Gebruikt voor permanent-unlock van streak-milestones. dayKey-format
   YYYY-MM-DD garandeert dat alphabetische sort = chronologische sort.
   `T00:00:00` zorgt voor consistente lokale parse (geen UTC-drift). */
function computeBestStreak(daysWithSession: Set<string>): number {
  if (daysWithSession.size === 0) return 0;
  const sorted = Array.from(daysWithSession).sort();
  let best = 1;
  let current = 1;
  const DAY_MS = 24 * 60 * 60 * 1000;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00');
    const curr = new Date(sorted[i] + 'T00:00:00');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / DAY_MS);
    if (diffDays === 1) {
      current += 1;
      if (current > best) best = current;
    } else if (diffDays > 1) {
      current = 1;
    }
  }
  return best;
}

/* Bouw last-7-days dataset voor de mini bar-chart. Output volgorde =
   oudste → nieuwste (zodat de chart links→rechts loopt zoals een tijdlijn).
   Iter 9cb (2026-05-31): 3-letter weekday-afkortingen ('Mon', 'Tue', ...)
   i.p.v. narrow ('M', 'T', 'W', 'T', 'F', 'S', 'S') want narrow geeft
   dubbele T's en S'en — onleesbaar. */
function buildLast7Days(
  now: Date,
  records: SessionRecord[],
): { dayKey: string; dayLabel: string; minutes: number }[] {
  const days: { dayKey: string; dayLabel: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const k = dayKey(d);
    const label =
      i === 0
        ? 'Today'
        : d.toLocaleDateString('en-US', { weekday: 'short' });
    days.push({ dayKey: k, dayLabel: label, minutes: 0 });
  }
  for (const r of records) {
    const k = dayKey(new Date(r.endedAt));
    const day = days.find((d) => d.dayKey === k);
    if (day) day.minutes += r.durationMin;
  }
  return days.map((d) => ({ ...d, minutes: Math.round(d.minutes) }));
}

/** Genereer YYYY-MM-DD voor een Date in LOKALE tijd (niet UTC) — zodat
 *  een sessie om 23:55 niet "in de dag van morgen" valt.
 *
 *  Geëxporteerd (was module-privé) zodat `plan-store.ts`/`agenda.tsx` dezelfde,
 *  correct-gepadde en dus sorteerbare sleutel gebruiken i.p.v. een van de
 *  andere, inconsistente varianten elders in de app (operator, 13 augustus
 *  2026, protocol-systeem). */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ── React hook ─────────────────────────────────────────────────────── */

export function useBraceletStats(forMode?: number): BraceletStats {
  const [stats, setStats] = useState<BraceletStats>(() =>
    computeStats(forMode),
  );
  useEffect(() => {
    const refresh = () => setStats(computeStats(forMode));
    loadOnce().then(refresh);
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [forMode]);
  return stats;
}

/* Auto-load: zodra een module dit bestand importeert wordt de cache
   alvast gelezen. Tegen de tijd dat een hook of recordSession()
   getriggerd wordt, zit de data in memory. */
loadOnce();

/* Iter 9dn (2026-05-31): auto-refresh bij dev-override wijziging.
   Wanneer operator in Settings van Free → Audio PRO → Bracelet schakelt,
   moeten de history-records meeswitchen naar de juiste user-bucket
   zodat elke override-state z'n eigen sessie-data toont. In productie
   doet subscribeDevUserOverride niets (override altijd null). */
subscribeDevUserOverride(() => {
  refreshUserBucket().catch(() => {
    /* swallow — volgende loadOnce probeert opnieuw */
  });
});
