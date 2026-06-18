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

   Schaal: cap op laatste 100 sessies (oudste vallen eraf). Zonder cap
   groeit AsyncStorage onbeperkt; 100 is ruim voor een MVP.
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'vbh_v1';
const MAX_ENTRIES = 100;

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
let initialized = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

async function load(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
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
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/* Voeg een afgeronde sessie toe aan de historiek. Wordt aangeroepen door
   de Breath-tab vlak na natural completion. */
export async function addBreathSession(
  entry: Omit<BreathHistoryEntry, 'ts'>,
): Promise<void> {
  await load();
  const newEntry: BreathHistoryEntry = { ...entry, ts: Date.now() };
  state = [newEntry, ...state].slice(0, MAX_ENTRIES);
  notify();
  await persist();
}

/* Wis alle historiek. Voorlopig geen UI ervoor; operator-tool. */
export async function clearBreathHistory(): Promise<void> {
  await load();
  state = [];
  notify();
  await persist();
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
