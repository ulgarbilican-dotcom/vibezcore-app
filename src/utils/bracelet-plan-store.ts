/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Actief bracelet-plan (per-user, bucketed)

   Operator, 29 september 2026 ("een echte pagina... na connect, soort
   onboarding... state, duur, timing en horizon (1 dag/week/2 weken...)
   kunnen kiezen... per dag individueel kunnen invullen... zolang je wil
   laten doorlopen"): letterlijk hetzelfde architectuur-patroon als
   `plan-store.ts` (breathwork), hier voor de bracelet — module-state +
   listener-Set + notify(), per-gebruiker gebucket via
   resolveActiveBucket(), directe persist zonder debounce. EIGEN bestand
   i.p.v. `plan-store.ts` hergebruiken: `PlannedItem` is daar breathwork-
   specifiek (`state`/`techniqueKey`), en dit blijft zo een pure data-laag
   zonder `services/ble-contract`-afhankelijkheid in de opslag zelf
   (`mode` is een kale `number`, spec §8.1).

   Operator, vervolg ("het enige verschil is dat WIJ hier niet bouwen,
   gebruiker beslist zelf"): geen Pad A/Pad B-vork, geen algoritme zoals
   breathwork's `protocol.ts` — de gebruiker bouwt de dag-template zelf
   (bracelet-set-day.tsx), en die herhaalt over de gekozen horizon, exact
   zoals `buildPlanFromTemplate` dat voor breathwork doet. Per-dag-
   afwijking ("1 ochtend Boost, volgende dag Calm Control") kan
   nadien via agenda.tsx — zelfde mechanisme waarmee breathwork's
   `updatePlanDay` een individuele dag al laat afwijken van zijn eigen
   template, ook al herhaalt de GENERATIE zelf uniform (bewuste keuze,
   zie protocol.ts's eigen toelichting "geen dag-tot-dag-variatie bij
   generatie"). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { subscribeUserBucket } from '@/utils/user-bucket';
import { resolveActiveBucket, dayKey } from '@/utils/bracelet-history';

const KEY_PREFIX = 'vzbpc_';
const KEY_SUFFIX = '_v1';
const planKey = (bucket: string) => `${KEY_PREFIX}${bucket}${KEY_SUFFIX}`;

export type BraceletPlanHorizon = 'today' | '1w' | '2w' | '1m' | '3m' | 'ongoing';

export type BraceletPlannedItem = {
  /** BraceletMode 0-4 (spec §8.1) — kale `number`, zie de toelichting
   *  hierboven over waarom dit bestand `ble-contract` niet importeert. */
  mode: number;
  durationMinutes: number;
  /** Minuten na middernacht. */
  reminderAt: number;
};

export type BraceletPlanDay = {
  dayKey: string;
  items: BraceletPlannedItem[];
};

export type BraceletActivePlan = {
  id: string;
  createdAt: number;
  horizon: BraceletPlanHorizon;
  startDayKey: string;
  days: Record<string, BraceletPlanDay>;
};

/* Zelfde tabel als protocol.ts's HORIZON_DAYS — 'ongoing' rolt lazy
   verder (30 dagen nu), agenda.tsx kan later bijvullen zodra het einde
   nadert, exact zoals bij breathwork voorzien (plan-document §Fase A). */
const HORIZON_DAYS: Record<BraceletPlanHorizon, number> = {
  today: 1,
  '1w': 7,
  '2w': 14,
  '1m': 30,
  '3m': 90,
  ongoing: 30,
};

/** Herhaal een door de gebruiker zelf gebouwde dag-template over de hele
 *  horizon — zelfde functie als protocol.ts's `buildPlanFromTemplate`,
 *  hier zonder goals/intensity (die bestaan niet voor de bracelet). */
export function buildBraceletPlanFromTemplate(
  horizon: BraceletPlanHorizon,
  startDate: Date,
  template: BraceletPlannedItem[],
): BraceletActivePlan {
  const dayCount = HORIZON_DAYS[horizon];
  const days: Record<string, BraceletPlanDay> = {};
  for (let i = 0; i < dayCount; i += 1) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dk = dayKey(d);
    days[dk] = { dayKey: dk, items: template.map((it) => ({ ...it })) };
  }
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
    horizon,
    startDayKey: dayKey(startDate),
    days,
  };
}

let state: BraceletActivePlan | null = null;
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

function isValidItem(x: any): x is BraceletPlannedItem {
  return (
    !!x &&
    typeof x.mode === 'number' &&
    typeof x.durationMinutes === 'number' &&
    typeof x.reminderAt === 'number'
  );
}

function isValidPlan(x: any): x is BraceletActivePlan {
  if (
    !x ||
    typeof x.id !== 'string' ||
    typeof x.createdAt !== 'number' ||
    typeof x.horizon !== 'string' ||
    typeof x.startDayKey !== 'string' ||
    !x.days ||
    typeof x.days !== 'object'
  ) {
    return false;
  }
  return Object.values(x.days).every(
    (d: any) =>
      d && typeof d.dayKey === 'string' && Array.isArray(d.items) && d.items.every(isValidItem),
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
export async function reloadActiveBraceletPlan(): Promise<void> {
  initialized = false;
  loadPromise = null;
  state = null;
  await load();
  notify();
}

/** Vervangt het volledige actieve plan (na "Save your day"). */
export async function saveActiveBraceletPlan(plan: BraceletActivePlan | null): Promise<void> {
  await load();
  state = plan;
  notify();
  await persist();
}

/** Werk één dag in het actieve plan bij (per-dag-afwijking in agenda.tsx). */
export async function updateBraceletPlanDay(day: BraceletPlanDay): Promise<void> {
  await load();
  if (!state) return;
  state = { ...state, days: { ...state.days, [day.dayKey]: day } };
  notify();
  await persist();
}

export function getActiveBraceletPlan(): BraceletActivePlan | null {
  return state;
}

/** Operator, 30 september 2026 ("mag nooit aparte states en 2 zelfde
 *  momenten kunnen kiezen, ook rekening houden met de duur"): een sessie
 *  bezet `[start, start+duur)`, ongeacht modus — gedeeld tussen
 *  bracelet-set-day.tsx (nieuwe sessie toevoegen) en bracelet-agenda.tsx
 *  (een bestaande sessie slepen naar een nieuw tijdstip), zodat beide
 *  plekken dezelfde regel toepassen i.p.v. een eigen kopie te laten
 *  uiteenlopen. */
export function rangesOverlap(aStart: number, aDur: number, bStart: number, bDur: number): boolean {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

export { dayKey };

export function useActiveBraceletPlan(): {
  plan: BraceletActivePlan | null;
  loaded: boolean;
} {
  const [plan, setPlan] = useState<BraceletActivePlan | null>(state);
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

/* Auto-load zodra dit bestand geïmporteerd wordt. */
load();

/* Operator, 8 okt 2026 ("na opnieuw opstarten in premium maar geschiedenis
   is leeg"): `reloadActiveBraceletPlan` werd nergens aangeroepen — na in-/uitloggen (of een
   dev-gebruikerswissel) bleef deze module in de VORIGE emmer lezen én
   schrijven, en na een herstart stond alles in een andere emmer. Nu volgt
   hij elke emmerwissel, net als history.ts/vzp.ts/useFavorites. */
subscribeUserBucket(() => {
  reloadActiveBraceletPlan().catch(() => {});
});
