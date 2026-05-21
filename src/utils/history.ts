/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Your Journey (history) tracking + helpers

   Bron: webapp history.html (gedrag) + AsyncStorage-key 'vzh_v1' zodat
   cross-sync via Drive later 1:1 werkt.

   SCHEMA (exact 7 velden — NIET uitbreiden):
     { url, title, series, ts, dur, full, fc }

   GEDRAG:
     - startListen(url,title,series) bij play() → curUrl/tStart gezet
     - pauseListen() bij pause / track-switch / unmount → flush(false)
     - endListen() bij volledige afspelen (didJustFinish) → flush(true)
     - flushListen filtert listened > 1s en alleen wanneer tStart > 0
     - Per spec: nieuwe play op een entry die al `full === true` is
       bumpt `fc++` (telt herluisteringen na volledige afspeling)

   PATTERN: module-state + listener-set (identiek aan useFavorites.ts) zodat
   Your Journey-screen meteen re-rendert bij elke flush.
   ─────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export const HISTORY_KEY = 'vzh_v1';

export type HistoryEntry = {
  url: string;
  title: string;
  series: string;
  ts: number;
  dur: number;
  full: boolean;
  fc: number;
};

let historyState: HistoryEntry[] = [];
let initialized = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

/* Actieve sessie — module-scope, GEEN React-state. Eén player tegelijk. */
let curUrl = '';
let curTitle = '';
let curSeries = '';
let tStart = 0;

function notify() {
  listeners.forEach((l) => l());
}

async function loadOnce(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          historyState = arr.filter(
            (e: any) =>
              e &&
              typeof e.url === 'string' &&
              typeof e.title === 'string' &&
              typeof e.series === 'string' &&
              typeof e.ts === 'number' &&
              typeof e.dur === 'number'
          );
        }
      }
    } catch {
      /* corrupt/missing — start leeg */
    }
    initialized = true;
    notify();
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(historyState));
  } catch {
    /* schrijven faalde — runtime blijft staan, volgende keer opnieuw */
  }
}

/* ── Tracking API ───────────────────────────────────────────────────────── */

export function startListen(url: string, title: string, series: string): void {
  if (!url) return;
  curUrl = url;
  curTitle = title;
  curSeries = series;
  tStart = Date.now();
}

/* Schrijft de afgelopen luisterperiode weg en stopt de timer (tStart=0).
   Bij `full=true` wordt de entry als volledig afgespeeld gemarkeerd en `fc`
   verhoogd. Bij een nieuwe play op een al-full entry verhoogt flushListen
   `fc` óók (volgens spec: "fc = hoe vaak fully listened").

   tStart=0 betekent dat pauseListen al eerder vuurde in dezelfde event-cycle
   (typisch volgorde: status isPlaying:false  →  didJustFinish:true). We
   honoreren dan nog steeds `full` — markeren entry full + fc++ — zonder
   nogmaals dur op te tellen. */
function flushListen(full: boolean): void {
  if (!curUrl) {
    tStart = 0;
    return;
  }
  let listenedSec = 0;
  if (tStart > 0) {
    listenedSec = (Date.now() - tStart) / 1000;
    tStart = 0;
  }

  /* Niet-full flushes negeren we onder de 1s (filter ongelukkige kliks).
     Full flushes mogen wél door bij 0s (didJustFinish na een pauseListen). */
  if (!full && listenedSec < 1) return;

  loadOnce().then(() => {
    const idx = historyState.findIndex((e) => e.url === curUrl);
    if (idx === -1) {
      historyState = [
        ...historyState,
        {
          url: curUrl,
          title: curTitle,
          series: curSeries,
          ts: Date.now(),
          dur: Math.max(0, Math.round(listenedSec)),
          full,
          fc: full ? 1 : 0,
        },
      ];
    } else {
      const prev = historyState[idx];
      const wasFull = prev.full;
      const next: HistoryEntry = {
        ...prev,
        title: curTitle || prev.title,
        series: curSeries || prev.series,
        ts: Date.now(),
        dur: prev.dur + Math.max(0, Math.round(listenedSec)),
        full: prev.full || full,
        /* fc++ wanneer deze flush een full-event is, OF wanneer dit een
           nieuwe play is op een eerder volledig afgespeelde entry (her-luister) */
        fc: prev.fc + (full ? 1 : wasFull ? 1 : 0),
      };
      historyState = [
        ...historyState.slice(0, idx),
        next,
        ...historyState.slice(idx + 1),
      ];
    }
    notify();
    persist();
  });
}

export function pauseListen(): void {
  flushListen(false);
}

export function endListen(): void {
  flushListen(true);
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {
    /* swallow */
  }
  historyState = [];
  initialized = true;
  notify();
}

/* ── Helpers (1:1 uit history.html) ─────────────────────────────────────── */

export function fmtDur(s: number): string {
  if (s < 1) return '';
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return r ? `${m}m ${r}s` : `${m} min`;
}

export function relTime(ts: number): string {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function dayLabel(ts: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) {
    return new Date(ts).toLocaleDateString('en-GB', { weekday: 'long' });
  }
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function computeStreak(raw: HistoryEntry[]): number {
  if (raw.length === 0) return 0;
  const days = new Set<string>();
  for (const e of raw) {
    const d = new Date(e.ts);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    days.add(key);
  }
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const keyOf = (dt: Date) =>
    `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
  if (!days.has(keyOf(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(keyOf(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export type HistoryStats = {
  uniqueUrls: number;
  totalMin: number;
  longestMin: number;
};

export function computeStats(raw: HistoryEntry[]): HistoryStats {
  let totalSecs = 0;
  let longestSec = 0;
  const urls = new Set<string>();
  for (const e of raw) {
    totalSecs += e.dur;
    if (e.dur > longestSec) longestSec = e.dur;
    urls.add(e.url);
  }
  return {
    uniqueUrls: urls.size,
    totalMin: Math.floor(totalSecs / 60),
    longestMin: Math.floor(longestSec / 60),
  };
}

/* ── Lookup ─────────────────────────────────────────────────────────────── */

/**
 * Snel-opzoek voor de player: bestaat er een history-entry voor deze URL?
 * Gebruikt voor de state-pill ("Partly listened" / "Fully listened").
 *
 * Geen Map-cache: lijsten zijn klein (10-tallen, niet duizenden) en de
 * lookup gebeurt per render-cycle van één scherm.
 */
export function getEntryByUrl(url: string): HistoryEntry | undefined {
  return historyState.find((e) => e.url === url);
}

/* ── React hook ─────────────────────────────────────────────────────────── */

export function useHistory() {
  const [snapshot, setSnapshot] = useState<HistoryEntry[]>(historyState);
  const [ready, setReady] = useState<boolean>(initialized);

  useEffect(() => {
    loadOnce().then(() => setReady(true));
    const listener = () => {
      setSnapshot([...historyState]);
      setReady(initialized);
    };
    listeners.add(listener);
    setSnapshot([...historyState]);
    setReady(initialized);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const clear = useCallback(async () => {
    await clearHistory();
  }, []);

  return { history: snapshot, ready, clear };
}
