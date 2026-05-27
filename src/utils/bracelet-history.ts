/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet session history (vzbc_sessions_v1)

   Persistente lijst van afgeronde/afgebroken bracelet-sessies. Gebruikt
   voor:
     - Stats-strip op idle + active screen (today / minutes / streak)
     - Toekomstige History-pagina (lijst recente sessies + week-overzicht)

   Schema (per sessie):
     {
       id          : unieke string (random-id)
       mode        : BraceletMode index (0-4)
       startedAt   : ISO-timestamp van Start
       endedAt     : ISO-timestamp van End/Stop
       durationMin : werkelijk doorgebrachte minuten (afgerond)
       plannedMin  : door user gekozen duration (voor reference)
       status      : 'completed' (timer afgelopen) | 'stopped' (user End)
     }

   Patroon = module-state + listener-set (zelfde als history.ts,
   settings.ts, vzp.ts). useBraceletStats() berekent on-demand uit cache;
   geen pre-computed stats opgeslagen — single source of truth blijft de
   ruwe records.

   Cap op 500 records (afgeronde sessies van ~1 jaar bij 1-2/dag). Bij
   500+ wordt oudste record gedropt.
   ─────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export const HISTORY_KEY = 'vzbc_sessions_v1';
const MAX_RECORDS = 500;

export type SessionStatus = 'completed' | 'stopped';

export type SessionRecord = {
  id: string;
  mode: number;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  plannedMin: number;
  status: SessionStatus;
};

let cache: SessionRecord[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

async function loadOnce(): Promise<void> {
  if (loaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          /* Defensieve filter — alleen records met alle vereiste velden
             behouden. Voorkomt crashes wanneer schema later evolueert. */
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
          );
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
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(cache));
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
 *  reverse-order (nieuwste eerst) zodat recent-views snel zijn. */
export async function recordSession(
  data: Omit<SessionRecord, 'id'>,
): Promise<void> {
  await loadOnce();
  const record: SessionRecord = { id: newId(), ...data };
  cache = [record, ...cache].slice(0, MAX_RECORDS);
  notify();
  persist();
}

/** Lees alle records — sorted nieuwste eerst. */
export function getAllSessions(): SessionRecord[] {
  return [...cache];
}

/** Wis alle records. Voor Clear-data-flow op Settings. */
export async function clearHistory(): Promise<void> {
  cache = [];
  notify();
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {
    /* swallow */
  }
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
  /** Totaal sessies all-time. */
  totalSessions: number;
  /** Lifetime cumulatieve minuten — alle sessies samengeteld. Voor de
   *  "total"-stat op de active/idle screen: geeft de gebruiker een
   *  achievement-moment ("ik heb X min in deze praktijk geïnvesteerd"). */
  totalMinutes: number;
};

/** Bereken stats uit de huidige cache. Synchroon — gebruik na loadOnce().
 *  Optionele forMode filtert records: alleen sessies van die mode tellen
 *  mee. Voor mode-specifieke "today/min today/min total" tijdens een
 *  actieve sessie (context van die specifieke mode). */
export function computeStats(forMode?: number): BraceletStats {
  const source =
    forMode === undefined ? cache : cache.filter((r) => r.mode === forMode);
  if (source.length === 0) {
    return {
      todaySessions: 0,
      todayMinutes: 0,
      weekSessions: 0,
      weekMinutes: 0,
      streak: 0,
      totalSessions: 0,
      totalMinutes: 0,
    };
  }

  const now = new Date();
  const todayKey = dayKey(now);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let todaySessions = 0;
  let todayMinutes = 0;
  let weekSessions = 0;
  let weekMinutes = 0;
  let totalMinutes = 0;
  const daysWithSession = new Set<string>();

  for (const r of source) {
    const endedAt = new Date(r.endedAt);
    const k = dayKey(endedAt);
    daysWithSession.add(k);

    totalMinutes += r.durationMin;

    if (k === todayKey) {
      todaySessions += 1;
      todayMinutes += r.durationMin;
    }
    if (endedAt >= weekAgo) {
      weekSessions += 1;
      weekMinutes += r.durationMin;
    }
  }

  /* Streak — count back day by day from today. Wanneer er vandaag geen
     sessie is, streak = 0. Anders tel dagen terug zolang er ≥1 sessie
     was die dag, stop bij eerste gat. */
  let streak = 0;
  if (daysWithSession.has(todayKey)) {
    let cursor = new Date(now);
    while (daysWithSession.has(dayKey(cursor))) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  return {
    todaySessions,
    todayMinutes: Math.round(todayMinutes),
    weekSessions,
    weekMinutes: Math.round(weekMinutes),
    streak,
    totalSessions: source.length,
    totalMinutes: Math.round(totalMinutes),
  };
}

/** Genereer YYYY-MM-DD voor een Date in LOKALE tijd (niet UTC) — zodat
 *  een sessie om 23:55 niet "in de dag van morgen" valt. */
function dayKey(d: Date): string {
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
