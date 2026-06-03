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
import {
  ensureBucketLoaded,
  getCurrentBucket,
  subscribeUserBucket,
} from '@/utils/user-bucket';

/* Iter 9dq v44 (2026-06-03): per-user bucketed storage.
   FAV_KEY blijft als legacy / migratie-key. Echte storage onder
   vzf_{bucket}_v1 zodat elke user-type z'n eigen favorites heeft. */
export const FAV_KEY = 'vzf_v1';
const LEGACY_KEY = 'vibezcore:favorites';
const KEY_PREFIX = 'vzf_';
const KEY_SUFFIX = '_v1';
/* Iter 9dq v54 (2026-06-03, audit-finding C4): device-scope flag die
   markeert dat de pre-vzf_v1 Set<url>-key éénmalig naar EEN bucket is
   gemigreerd. Voorheen werd de LEGACY_KEY bij iedere bucket-switch
   opnieuw geïmporteerd zolang die nog bestond (operator wilde 'm laten
   staan voor rollback). Gevolg: user A migreert legacy → bucket A,
   signed out; user B signs in, bucket B is leeg → legacy gemigreerd
   naar bucket B = cross-user data-leak op dezelfde device. Met deze
   flag: éérste bucket die de migratie doet wint, alle volgende buckets
   slaan de legacy-import over en starten met een ECHT lege Map. */
const LEGACY_MIGRATED_FLAG = 'vzf_legacy_migrated_v1';
function favBucketKey(bucket: string): string {
  return `${KEY_PREFIX}${bucket}${KEY_SUFFIX}`;
}

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

/* Iter 9dq v44: migreer vzf_v1 (oude global key) naar de current-bucket
   key zodat per-user buckets bestaande favorites behouden. */
async function migrateLegacyFavKey(bucket: string): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(FAV_KEY);
    if (!legacy) return;
    const newKey = favBucketKey(bucket);
    const existing = await AsyncStorage.getItem(newKey);
    if (existing) {
      await AsyncStorage.removeItem(FAV_KEY);
      return;
    }
    await AsyncStorage.setItem(newKey, legacy);
    await AsyncStorage.removeItem(FAV_KEY);
  } catch {
    /* migration mislukt — proberen we volgende keer opnieuw */
  }
}

async function loadOnce(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const bucket = await ensureBucketLoaded();
      /* Eerst migreer vzf_v1 → bucket-key (eenmalig per device). */
      await migrateLegacyFavKey(bucket);
      const raw = await AsyncStorage.getItem(favBucketKey(bucket));
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

      /* Geen data in de bucket → migratie-check op de pre-vzf_v1 Set<url>-key.
         Iter 9dq v54 (2026-06-03, audit-finding C4): éérst checken of de
         legacy-migratie op deze device al gedaan is. Zo ja → skip, zodat
         de tweede user op dit toestel niet de favorites van de eerste
         user (uit de legacy-key) krijgt. */
      const alreadyMigrated = await AsyncStorage.getItem(LEGACY_MIGRATED_FLAG);
      if (!alreadyMigrated) {
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
            /* Schrijf naar nieuwe bucket-key, oude pre-vzf_v1 key laat staan
               (operator-keuze 2026-05-20: behouden voor rollback). */
            await AsyncStorage.setItem(
              favBucketKey(bucket),
              JSON.stringify([...favoritesState.values()])
            );
          }
        }
        /* Markeer migratie als gedaan, ongeacht of de LEGACY_KEY data
           had — anders blijven we elke load opnieuw de check doen op
           een lege legacy-key (idempotent maar zonde van de AsyncStorage-
           read). */
        await AsyncStorage.setItem(LEGACY_MIGRATED_FLAG, '1');
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
    const bucket = getCurrentBucket();
    await AsyncStorage.setItem(
      favBucketKey(bucket),
      JSON.stringify([...favoritesState.values()])
    );
  } catch {
    /* schrijf-fout — runtime-state blijft staan, volgende mutation probeert opnieuw */
  }
}

/* Iter 9dq v44: bij bucket-switch (sign-in/out, override change), wis
   in-memory cache en laad uit nieuwe bucket-key. */
subscribeUserBucket(() => {
  favoritesState = new Map();
  initialized = false;
  loadPromise = null;
  notify();
  loadOnce().catch(() => {
    /* swallow */
  });
});

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
