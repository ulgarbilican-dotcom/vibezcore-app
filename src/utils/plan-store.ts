/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Actief protocol (per-user, bucketed)

   Operator, 13 augustus 2026: doel + intensiteit genereren een ECHT
   vastgelegd rooster (geen live-herberekende preview) zodat de agenda
   groen/oranje/rood per specifieke dag kan tonen. Volgt bewust hetzelfde
   patroon als breath-history.ts — module-state + listener-Set + notify(),
   per-gebruiker gebucket via resolveActiveBucket(), directe persist zonder
   debounce — NIET het settings.ts-patroon (één ongebucket blob), want dit
   groeit per dag en mag nooit tussen gebruikers op hetzelfde toestel lekken.

   Eén actief plan per gebruiker in deze fase ("meerdere opgeslagen
   plannen" is bewust uitgesteld — zie het plan-document, Fase D).
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { rollDaysForward } from '@/utils/plan-roll';
import { subscribeUserBucket } from '@/utils/user-bucket';
import { resolveActiveBucket, dayKey } from '@/utils/bracelet-history';
import type { BreathStateKey } from '@/data/breath-states';
import type { Intensity } from '@/utils/settings';

const KEY_PREFIX = 'vzpc_';
const KEY_SUFFIX = '_v1';
const planKey = (bucket: string) => `${KEY_PREFIX}${bucket}${KEY_SUFFIX}`;

/* Operator, 11 september 2026: "after work on the way home" toegevoegd
   als eigen, expliciet benoemd vierde moment — zie utils/day-plan.ts se
   `DAY_CANDIDATES`/`ALL_SLOTS` voor de volledige toelichting. */
export type PlanSlot = 'morning' | 'midday' | 'afterWork' | 'evening';

export type PlanHorizon = 'today' | '1w' | '2w' | '1m' | '3m' | 'ongoing';

export type PlannedItem = {
  slot: PlanSlot;
  state: BreathStateKey;
  techniqueKey: string;
  minutes: number;
  /** Waarom deze toestand hier staat — reasonForPick()-resultaat. */
  reason: string;
  /** Minuten na middernacht — per moment instelbaar, zelf ingesteld of
   *  overgenomen van het aanbevolen venster bij generatie. */
  reminderAt: number;
};

export type PlanDay = {
  dayKey: string;
  items: PlannedItem[];
};

export type ActivePlan = {
  id: string;
  createdAt: number;
  /** [primair, secundair?] — zelfde vorm als Settings.goals. */
  goals: string[];
  intensity: Intensity;
  horizon: PlanHorizon;
  startDayKey: string;
  days: Record<string, PlanDay>;
};

let state: ActivePlan | null = null;
let activeBucket = 'anon';
let initialized = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  setTimeout(() => {
    listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }, 0);
}

function isValidItem(x: any): x is PlannedItem {
  return (
    !!x &&
    /* BUG (gevonden 17 september 2026): 'afterWork' ontbrak hier — elk
       item op dat dagdeel werd bij het laden van opslag afgekeurd als
       ongeldig, ook al werd het correct aangemaakt. Nooit bijgewerkt toen
       'afterWork' als vierde dagdeel werd toegevoegd (11 september). */
    (x.slot === 'morning' ||
      x.slot === 'midday' ||
      x.slot === 'afterWork' ||
      x.slot === 'evening') &&
    typeof x.state === 'string' &&
    typeof x.techniqueKey === 'string' &&
    typeof x.minutes === 'number' &&
    typeof x.reason === 'string' &&
    typeof x.reminderAt === 'number'
  );
}

function isValidPlan(x: any): x is ActivePlan {
  if (
    !x ||
    typeof x.id !== 'string' ||
    typeof x.createdAt !== 'number' ||
    !Array.isArray(x.goals) ||
    typeof x.intensity !== 'string' ||
    typeof x.horizon !== 'string' ||
    typeof x.startDayKey !== 'string' ||
    !x.days ||
    typeof x.days !== 'object'
  ) {
    return false;
  }
  return Object.values(x.days).every(
    (d: any) =>
      d &&
      typeof d.dayKey === 'string' &&
      Array.isArray(d.items) &&
      d.items.every(isValidItem),
  );
}

async function load(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      activeBucket = await resolveActiveBucket();
      const raw = await AsyncStorage.getItem(planKey(activeBucket));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidPlan(parsed)) {
          state = parsed;
        }
      }
    } catch {
      /* corrupt → geen actief plan */
    }
    initialized = true;
    await rollForwardIfOngoing(false);
    notify();
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  try {
    if (state) {
      await AsyncStorage.setItem(planKey(activeBucket), JSON.stringify(state));
    } else {
      await AsyncStorage.removeItem(planKey(activeBucket));
    }
  } catch {
    /* schrijf-fout — volgende write probeert opnieuw */
  }
}

/** Opnieuw inlezen na in-/uitloggen — de emmer verandert dan. */
export async function reloadActivePlan(): Promise<void> {
  initialized = false;
  loadPromise = null;
  state = null;
  await load();
  notify();
}

/** Vervangt het volledige actieve plan (na generatie of een edit-ronde). */
export async function saveActivePlan(plan: ActivePlan): Promise<void> {
  await load();
  state = plan;
  notify();
  await persist();
}

/** Werk één dag in het actieve plan bij (bv. tijden aanpassen op
 *  het tijden-instelscherm). No-op als er geen actief plan is. */
export async function updatePlanDay(day: PlanDay): Promise<void> {
  await load();
  if (!state) return;
  state = { ...state, days: { ...state.days, [day.dayKey]: day } };
  notify();
  await persist();
}

/** Wist het actieve plan volledig (bv. bij "Start a new protocol"). */
export async function clearActivePlan(): Promise<void> {
  await load();
  state = null;
  notify();
  await persist();
}

/** Synchrone lezing — gebruik na loadOnce()/binnen een hook. */
export function getActivePlan(): ActivePlan | null {
  return state;
}

/** Vandaag's PlanDay uit het actieve plan, of null als er geen dag voor
 *  vandaag ingepland is (plan afgelopen, of nog niet begonnen). */
export function getPlanDay(key: string): PlanDay | null {
  return state?.days[key] ?? null;
}

export { dayKey };

export function useActivePlan(): {
  plan: ActivePlan | null;
  loaded: boolean;
} {
  const [plan, setPlan] = useState<ActivePlan | null>(state);
  const [loaded, setLoaded] = useState(initialized);

  const refresh = useCallback(() => {
    setPlan(state);
    setLoaded(true);
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

  return { plan, loaded };
}

/** Audit 10 okt 2026: een 'ongoing'-plan altijd 30 dagen vooruit gevuld
 *  houden (bij laden en telkens de app weer naar voren komt). */
async function rollForwardIfOngoing(withNotify = true): Promise<void> {
  if (!state || state.horizon !== 'ongoing') return;
  const days = rollDaysForward(state.days);
  if (!days) return;
  state = { ...state, days } as ActivePlan;
  if (withNotify) notify();
  await persist();
}

/* Auto-load zodra dit bestand geïmporteerd wordt. */
load();

AppState.addEventListener('change', (s) => {
  if (s === 'active' && initialized) rollForwardIfOngoing().catch(() => {});
});

/* Operator, 8 okt 2026 ("na opnieuw opstarten in premium maar geschiedenis
   is leeg"): `reloadActivePlan` werd nergens aangeroepen — na in-/uitloggen (of een
   dev-gebruikerswissel) bleef deze module in de VORIGE emmer lezen én
   schrijven, en na een herstart stond alles in een andere emmer. Nu volgt
   hij elke emmerwissel, net als history.ts/vzp.ts/useFavorites. */
subscribeUserBucket(() => {
  reloadActivePlan().catch(() => {});
});
