/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Breath history tracking

   Lichte AsyncStorage-tracker voor afgeronde breathwork sessies vanuit de
   Breath-tab. Apart van audio-history (vzh_v1) zodat schema vrij kan
   evolueren en de twee niet vermengd worden.

   SCHEMA (6 velden — completed is optional voor backward compat):
     { key, name, ts, durSec, rounds, completed? }

   GEDRAG:
     - addBreathSession() bij natural completion van een sessie
     - useBreathHistory() React-hook voor reactive UI (zoals useFavorites)
     - clearBreathHistory() voor optioneel wissen (operator-tool)

   ── Waarom dit bestand op 7 augustus 2026 herzien is ──────────────────
   Twee gebreken, allebei stil:

   1. De historiek stond op ÉÉN sleutel voor het hele toestel. Wie uitlogde
      en met een ander account inlogde, zag de sessies van de vorige. De
      bracelet deed dit al goed (een emmer per gebruiker); breathwork niet.

   2. De cap stond op 100 sessies. Wie twee keer per dag ademt is na zeven
      weken zijn oudste sessies kwijt — en omdat "days in a row" en "best"
      UIT die lijst gerekend worden, gingen die getallen dan omlaag zonder
      dat er iets gebeurd was. De app sprak zichzelf tegen.

   Nu: een emmer per gebruiker (dezelfde die de bracelet gebruikt, dus
   uitloggen scheidt de twee), 2000 sessies in plaats van 100, en een
   totalenrecord dat NOOIT afgekapt wordt. Dat laatste is het vangnet: ook
   als de lijst ooit inkort, blijft je beste reeks je beste reeks.

   De oude sleutel wordt eenmalig overgezet, dus niemand raakt iets kwijt.
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { resolveActiveBucket } from '@/utils/bracelet-history';

const LEGACY_KEY = 'vbh_v1';
const KEY_PREFIX = 'vbh_';
const KEY_SUFFIX = '_v2';
/* 2000 sessies ≈ drie jaar bij twee per dag. Ruim genoeg om nooit te
   knellen, klein genoeg om niet te vervuilen. */
const MAX_ENTRIES = 2000;

const entriesKey = (bucket: string) => `${KEY_PREFIX}${bucket}${KEY_SUFFIX}`;
const totalsKey = (bucket: string) => `${KEY_PREFIX}totals_${bucket}${KEY_SUFFIX}`;

/** Wat er bewaard blijft ook als de lijst inkort. */
export type BreathTotals = {
  /** Alle sessies ooit, ook de weggevallen. */
  sessions: number;
  /** Alle seconden ooit. */
  sec: number;
  /** Langste reeks ooit. Gaat alleen omhoog. */
  bestStreak: number;
};

const EMPTY_TOTALS: BreathTotals = { sessions: 0, sec: 0, bestStreak: 0 };

export type BreathHistoryEntry = {
  /** Pattern-key — 'boost' / 'focus' / 'calm' / 'clarity' / 'rest' */
  key: string;
  /** Display-naam — 'Calm Control' etc. */
  name: string;
  /** Completion timestamp (Date.now()) */
  ts: number;
  /** Sessie-duur in seconden (actual elapsed, niet planned) */
  durSec: number;
  /** Aantal afgeronde rounds (of partial round-nummer bij interrupt) */
  rounds: number;
  /** True = alle planned rounds afgerond. False = manual stop / partial.
      Optional voor backward compat met oudere entries (default = true). */
  completed?: boolean;
};

let state: BreathHistoryEntry[] = [];
let totals: BreathTotals = { ...EMPTY_TOTALS };
let activeBucket = 'anon';
let initialized = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

/** Zet de oude gedeelde sleutel eenmalig over naar de emmer van deze
 *  gebruiker. Overschrijft nooit: staat er al iets, dan wordt de oude alleen
 *  opgeruimd. Zelfde aanpak als bij de bracelet. */
async function migrateLegacy(bucket: string): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const target = entriesKey(bucket);
    if (!(await AsyncStorage.getItem(target))) {
      await AsyncStorage.setItem(target, legacy);
    }
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    /* mislukt — volgende start opnieuw */
  }
}

async function load(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      activeBucket = await resolveActiveBucket();
      await migrateLegacy(activeBucket);
      const rawTotals = await AsyncStorage.getItem(totalsKey(activeBucket));
      if (rawTotals) {
        const t = JSON.parse(rawTotals);
        if (t && typeof t === 'object') {
          totals = {
            sessions: typeof t.sessions === 'number' ? t.sessions : 0,
            sec: typeof t.sec === 'number' ? t.sec : 0,
            bestStreak: typeof t.bestStreak === 'number' ? t.bestStreak : 0,
          };
        }
      }
      const raw = await AsyncStorage.getItem(entriesKey(activeBucket));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          state = parsed.filter(
            (e): e is BreathHistoryEntry =>
              !!e &&
              typeof e.key === 'string' &&
              typeof e.name === 'string' &&
              typeof e.ts === 'number' &&
              typeof e.durSec === 'number' &&
              typeof e.rounds === 'number' &&
              (e.completed === undefined || typeof e.completed === 'boolean'),
          );
        }
      }
    } catch {}
    initialized = true;
    notify();
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(entriesKey(activeBucket), JSON.stringify(state));
    await AsyncStorage.setItem(totalsKey(activeBucket), JSON.stringify(totals));
  } catch {}
}

/** Opnieuw inlezen na in- of uitloggen. De emmer verandert dan, en zonder
 *  dit blijft de vorige gebruiker in beeld tot de app herstart. */
export async function reloadBreathHistory(): Promise<void> {
  initialized = false;
  loadPromise = null;
  state = [];
  totals = { ...EMPTY_TOTALS };
  await load();
  notify();
}

/* Voeg een afgeronde sessie toe aan de historiek. Wordt aangeroepen door
   de Breath-tab vlak na natural completion. */
export async function addBreathSession(
  entry: Omit<BreathHistoryEntry, 'ts'>,
): Promise<void> {
  await load();
  const newEntry: BreathHistoryEntry = { ...entry, ts: Date.now() };
  state = [newEntry, ...state].slice(0, MAX_ENTRIES);
  /* De totalen bij, VOOR het afkappen telt — daarom staan ze los van de
     lijst. Dit is het enige getal dat nooit kan zakken. */
  totals = {
    sessions: totals.sessions + 1,
    sec: totals.sec + Math.max(0, Math.round(entry.durSec)),
    bestStreak: Math.max(totals.bestStreak, calculateStreak(state)),
  };
  notify();
  await persist();
}

/* Wis alle historiek. Voorlopig geen UI ervoor; operator-tool. */
export async function clearBreathHistory(): Promise<void> {
  await load();
  state = [];
  totals = { ...EMPTY_TOTALS };
  notify();
  await persist();
}

/** De totalen die een afgekapte lijst overleven. */
export function useBreathTotals(): BreathTotals {
  const [t, setT] = useState<BreathTotals>(totals);
  const refresh = useCallback(() => setT({ ...totals }), []);
  useEffect(() => {
    let cancelled = false;
    load().then(() => {
      if (!cancelled) refresh();
    });
    listeners.add(refresh);
    return () => {
      cancelled = true;
      listeners.delete(refresh);
    };
  }, [refresh]);
  return t;
}

/* ── Streak-berekening (iter 9dq v172, operator-fix 2026-06-18) ───────
   Aantal consecutive dagen waarop de gebruiker minstens één breath-sessie
   afgerond heeft, terugkijkend vanaf vandaag. Dag-grens = lokale midder-
   nacht (Date.toDateString). Eén sessie/dag telt als dag-aanwezig.
   Voorbeelden:
     - sessies vandaag + gisteren + eergisteren → streak = 3
     - sessies vandaag + 2 dagen terug → streak = 1 (gap gisteren)
     - geen sessies vandaag, wel gisteren → streak = 0 (streak vervalt
       als vandaag nog niets gedaan is)
   Operator-keuze "vandaag-anker": streak = 0 wanneer er vandaag niets
   gedaan is. Voorkomt "yesterday's streak"-illusie. */
export function calculateStreak(
  entries: BreathHistoryEntry[],
): number {
  if (entries.length === 0) return 0;
  /* Set van dag-strings waarop minstens één sessie staat. */
  const days = new Set<string>();
  for (const e of entries) {
    days.add(new Date(e.ts).toDateString());
  }
  /* Loop terug vanaf vandaag tot de eerste dag zonder sessie. */
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* React-hook — gebruik in components voor reactive history-rendering. */
export function useBreathHistory(): BreathHistoryEntry[] {
  const [entries, setEntries] = useState<BreathHistoryEntry[]>(state);

  const refresh = useCallback(() => {
    setEntries([...state]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().then(() => {
      if (!cancelled) refresh();
    });
    listeners.add(refresh);
    return () => {
      cancelled = true;
      listeners.delete(refresh);
    };
  }, [refresh]);

  return entries;
}
