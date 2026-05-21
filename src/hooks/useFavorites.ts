/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — useFavorites

   Sessie-favorieten, webapp-parity schema `vzf_v1`:
     [{ url, title, series, ts }, ...]

   Migratie (operator-besluit 2026-05-20): we LATEN de oude key
   `vibezcore:favorites` (Set<url>) staan. Bij de eerste load lezen we
   eerst vzf_v1; als die niet bestaat, importeren we de oude key éénmaal
   en resolven URLs naar volledige entries via SESSIONS. De oude key
   wordt NIET gewist (bewust — operator wil oude data behouden voor
   eventuele rollback).

   API (breaking vs. vorige versie):
     - `favorites: Map<url, FavEntry>`  (i.p.v. Set<url>)
       Map.has(url) blijft werken; iteratie via .values().
     - `toggle(session)` accepteert nu het session-object zodat we
       title/series kunnen opslaan voor de webapp-cross-sync later.
     - `has(url)`           — ongewijzigd.

   Pattern: module-state + listener-set (zelfde als history.ts, vzp.ts).
   ─────────────────────────────────────────────────────────────────────── */

import { SESSIONS } from '@/data/audio-library-data';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export const FAV_KEY = 'vzf_v1';
const LEGACY_KEY = 'vibezcore:favorites';

export type FavEntry = {
  url: string;
  title: string;
  series: string;
  ts: number;
};

/** Subset van Session die we nodig hebben voor toggle() — voorkomt
 *  tight coupling met de hele Session-type, makkelijker te testen. */
export type FavInput = Pick<FavEntry, 'url' | 'title' | 'series'>;

let favoritesState = new Map<string, FavEntry>();
let initialized = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function loadOnce(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(FAV_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const next = new Map<string, FavEntry>();
          for (const e of arr) {
            if (
              e &&
              typeof e.url === 'string' &&
              typeof e.title === 'string' &&
              typeof e.series === 'string' &&
              typeof e.ts === 'number'
            ) {
              next.set(e.url, e);
            }
          }
          favoritesState = next;
          initialized = true;
          notify();
          return;
        }
      }

      /* Geen vzf_v1 → migratie-check op de oude Set<url>-key. */
      const legacyRaw = await AsyncStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        const urls = JSON.parse(legacyRaw);
        if (Array.isArray(urls)) {
          const now = Date.now();
          const migrated = new Map<string, FavEntry>();
          for (const u of urls) {
            if (typeof u !== 'string') continue;
            const sess = SESSIONS.find((s) => s.url === u);
            migrated.set(u, {
              url: u,
              title: sess?.title ?? '',
              series: sess?.series ?? '',
              ts: now,
            });
          }
          favoritesState = migrated;
          /* Schrijf naar nieuwe key, maar laat de oude staan (operator-besluit). */
          await AsyncStorage.setItem(
            FAV_KEY,
            JSON.stringify([...favoritesState.values()])
          );
        }
      }
    } catch {
      /* corrupt / missing — start met lege Map */
    }
    initialized = true;
    notify();
  })();
  return loadPromise;
}

async function save(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      FAV_KEY,
      JSON.stringify([...favoritesState.values()])
    );
  } catch {
    /* schrijf-fout — runtime-state blijft staan, volgende mutation probeert opnieuw */
  }
}

export function useFavorites() {
  const [snapshot, setSnapshot] = useState<Map<string, FavEntry>>(favoritesState);

  useEffect(() => {
    loadOnce();
    const listener = () => setSnapshot(new Map(favoritesState));
    listeners.add(listener);
    setSnapshot(new Map(favoritesState));
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const toggle = useCallback((input: FavInput) => {
    if (!input?.url) return;
    const next = new Map(favoritesState);
    if (next.has(input.url)) {
      next.delete(input.url);
    } else {
      next.set(input.url, {
        url: input.url,
        title: input.title,
        series: input.series,
        ts: Date.now(),
      });
    }
    favoritesState = next;
    notify();
    save();
  }, []);

  const has = useCallback((url: string) => snapshot.has(url), [snapshot]);

  return { favorites: snapshot, toggle, has };
}
