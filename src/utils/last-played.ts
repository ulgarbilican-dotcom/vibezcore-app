/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Last-played tracker (Continue-listening UI)

   ÉÉN entry: welke sessie de gebruiker als laatste niet-voltooid heeft
   verlaten + voldoende metadata om er een Audible-stijl Continue-card mee
   te bouwen (cover via SERIES_PHOTO, titel, progress-bar).

   Waarom een aparte module ipv vzp.ts uitbreiden:
     - vzp_v1 is web-app shared (zelfde key, zelfde schema). Operator-regel
       "backend/webapp niet wijzigen" → vzp-schema laten staan.
     - history.ts heeft "exact 7 velden — NIET uitbreiden" als spec.
     - Deze tracker hoeft alleen de MOST-RECENT-IN-PROGRESS te kennen — één
       record met alles wat de UI nodig heeft. Veel simpeler dan een Map.

   Schema (AsyncStorage `vz_last_played_v1`):
     { url, title, series, isFree, positionSec, durationSec, savedAt }

   Lifecycle:
     - audio-player.saveCurrentPositionIfWorthwhile() schrijft naast vzp
       ook deze entry → bij pauze, track-switch, unload.
     - didJustFinish → clearLastPlayed() (sessie voltooid = niet meer "in
       progress").
     - Continue-card op de library leest via useShowableLastPlayed() →
       filter op: <7 dagen oud, <95% voltooid, ≥4s positie.

   "Showable" criteria zitten in deze module ipv in de UI: 1 plek om te
   tweaken (bv. operator wil later "<3 dagen" → één const aanpassen).
   ─────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export const LAST_PLAYED_KEY = 'vz_last_played_v1';

/** Hoe lang na laatste-play tonen we de Continue-card nog? Daarna voelt
 *  het meer als "stale" dan als "where you left off". 7 dagen is industry-
 *  standard (Audible / Spotify recently-played-window). */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** > dit % afgeluisterd = effectief klaar, geen Continue tonen (anders
 *  zou de card 'm na de laatste minuut blijven aanbieden tot vervaldatum). */
const COMPLETION_THRESHOLD = 0.95;

/** < dit aantal sec positie = te kort om "where you left off" te claimen. */
const MIN_POSITION_SEC = 4;

export type LastPlayed = {
  url: string;
  title: string;
  series: string;
  isFree: boolean;
  positionSec: number;
  durationSec: number;
  savedAt: number; // ms epoch
};

let state: LastPlayed | null = null;
let initialized = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

async function loadOnce(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(LAST_PLAYED_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (
          obj &&
          typeof obj.url === 'string' &&
          typeof obj.title === 'string' &&
          typeof obj.series === 'string' &&
          typeof obj.positionSec === 'number' &&
          typeof obj.durationSec === 'number' &&
          typeof obj.savedAt === 'number'
        ) {
          state = {
            url: obj.url,
            title: obj.title,
            series: obj.series,
            isFree: !!obj.isFree,
            positionSec: obj.positionSec,
            durationSec: obj.durationSec,
            savedAt: obj.savedAt,
          };
        }
      }
    } catch {
      /* corrupt / leeg → state blijft null */
    }
    initialized = true;
    notify();
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  try {
    if (state) {
      await AsyncStorage.setItem(LAST_PLAYED_KEY, JSON.stringify(state));
    } else {
      await AsyncStorage.removeItem(LAST_PLAYED_KEY);
    }
  } catch {
    /* schrijf-fout — runtime-state behoudt, volgende save probeert weer */
  }
}

/* ── Public mutaties ────────────────────────────────────────────────────── */

export async function setLastPlayed(
  info: Omit<LastPlayed, 'savedAt'>
): Promise<void> {
  await loadOnce();
  state = { ...info, savedAt: Date.now() };
  notify();
  persist();
}

export async function clearLastPlayed(): Promise<void> {
  await loadOnce();
  if (!state) return;
  state = null;
  notify();
  persist();
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** Sync read voor non-React consumers (debug / one-off lookups). */
export function getLastPlayedSync(): LastPlayed | null {
  return state;
}

/** Filter: alleen entries die LICHTLIJK genoeg + niet voltooid + lang
 *  genoeg gespeeld zijn om als "Continue" aan te bieden. */
function filterShowable(lp: LastPlayed | null): LastPlayed | null {
  if (!lp) return null;
  if (Date.now() - lp.savedAt > STALE_AFTER_MS) return null;
  if (lp.positionSec < MIN_POSITION_SEC) return null;
  if (lp.durationSec > 0) {
    const pct = lp.positionSec / lp.durationSec;
    if (pct >= COMPLETION_THRESHOLD) return null;
  }
  return lp;
}

/* ── React hook ─────────────────────────────────────────────────────────── */

/**
 * Verbindt de Continue-card met de tracker. Returnt:
 *   - null wanneer er geen showable entry is (geen recente sessie OF
 *     sessie was effectief klaar OF >7d oud).
 *   - LastPlayed-object wanneer de card getoond moet worden.
 *
 * Re-rendert wanneer audio-player z'n state save'd / cleared.
 */
export function useShowableLastPlayed(): LastPlayed | null {
  const [snap, setSnap] = useState<LastPlayed | null>(filterShowable(state));
  useEffect(() => {
    let cancelled = false;
    loadOnce().then(() => {
      if (cancelled) return;
      setSnap(filterShowable(state));
    });
    const listener = () => {
      if (!cancelled) setSnap(filterShowable(state));
    };
    listeners.add(listener);
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, []);
  return snap;
}

/**
 * Iter 2026-06-05: laadbaar-vlag voor consumers die moeten WACHTEN tot
 * de AsyncStorage-load voltooid is voordat ze besluiten "geen entry
 * aanwezig" (bv. WelcomeBackPopup die anders te vroeg markSkipped
 * aanriep tijdens cold-start race).
 *
 * Returnt:
 *   - false zolang de eerste loadOnce nog niet klaar is
 *   - true zodra `initialized` op true staat
 *
 * Wijzigt niets aan bestaande state / save-logic — puur read-side helper.
 */
export function useLastPlayedReady(): boolean {
  const [ready, setReady] = useState(initialized);
  useEffect(() => {
    if (initialized) {
      setReady(true);
      return;
    }
    let cancelled = false;
    loadOnce().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}
