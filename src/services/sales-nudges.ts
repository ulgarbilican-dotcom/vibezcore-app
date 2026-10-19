/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — verkoopkaarten: Day Pass-kaart en Welcome Back (19 okt 2026).

   Operator, 19 okt 2026 (punten 22 en 23): "een dagpas-kaart na een minuut
   rondkijken, en een rustige welkom-terug voor wie Premium had — nooit
   tijdens een sessie, nooit opdringerig". Dit bestand houdt enkel de
   boekhouding bij (wat is wanneer getoond, hoeveel actieve seconden,
   hoe vaak de plannen weggetikt zijn); WANNEER een kaart verschijnt
   beslist components/SalesNudgeHost.tsx.

   Regels (bindend, operator-goedgekeurd):
   - Day Pass-kaart: eerste keer na 60 s ACTIEF rondkijken (voorgrond, geen
     onboarding, geen sessie/preview, Audio Library speelt niet). Later
     opnieuw na twee keer de plannen/paywall wegtikken zonder kopen, bij
     de volgende app-opening. Max 1 keer per 7 dagen, max 3 keer in totaal.
   - Nooit binnen ~2 min na een andere paywall/saleskaart, nooit vlak na
     een aankoop.
   - Welcome Back: één keer per verlopen abonnement (einddatum bewaard).

   Eén AsyncStorage-sleutel, zelfde patroon als settings.ts (module-state,
   synchrone getters, één keer laden). Bewust NIET gewist bij uitloggen:
   de frequentiegrens hoort bij dit toestel, niet bij het account.
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vz_sales_nudges_v1';

/** Actieve seconden vóór de eerste Day Pass-kaart. */
export const DAY_PASS_FIRST_AFTER_SEC = 60;
/** Max één Day Pass-kaart per 7 dagen. */
const DAY_PASS_MIN_GAP_MS = 7 * 24 * 60 * 60 * 1000;
/** Max 3 Day Pass-kaarten in totaal (inclusief de eerste). */
const DAY_PASS_MAX_SHOWS = 3;
/** Twee keer de plannen weggetikt zonder kopen = opnieuw aanbieden. */
const DISMISSALS_FOR_RESHOW = 2;
/** Geen kaart binnen ~2 min na een andere paywall/saleskaart. */
const SALES_GAP_MS = 2 * 60 * 1000;
/** "Nooit vlak na een aankoop": twee uur rust. */
const AFTER_PURCHASE_MS = 2 * 60 * 60 * 1000;

type State = {
  activeSec: number;
  dayPassShows: number;
  dayPassLastShownAt: number;
  /** Plannen/paywall weggetikt zonder kopen, sinds de laatste Day Pass-kaart. */
  planDismissals: number;
  lastSalesShownAt: number;
  lastPurchaseAt: number;
  /** Einddatum van het verlopen abonnement waarvoor Welcome Back al kwam. */
  winBackShownFor: string | null;
  /** Laatst geziene abonnement (maand/jaar) — vangnet naast RevenueCat. */
  wasPro: { until: string; email?: string } | null;
};

const DEFAULTS: State = {
  activeSec: 0,
  dayPassShows: 0,
  dayPassLastShownAt: 0,
  planDismissals: 0,
  lastSalesShownAt: 0,
  lastPurchaseAt: 0,
  winBackShownFor: null,
  wasPro: null,
};

let state: State = { ...DEFAULTS };
let loaded = false;
let loadPromise: Promise<void> | null = null;

export function ensureSalesNudgesLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const obj = JSON.parse(raw) as Partial<State>;
        state = { ...DEFAULTS, ...state, ...obj };
      }
    } catch {
      /* corrupt → standaardwaarden */
    }
    loaded = true;
  })();
  return loadPromise;
}

function save(): void {
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

function patch(next: Partial<State>): void {
  state = { ...state, ...next };
  /* Wat vóór het laden binnenkwam, mag het laden niet overschrijven. */
  if (loaded) save();
  else void ensureSalesNudgesLoaded().then(() => {
    state = { ...state, ...next };
    save();
  });
}

/* ── Gebeurtenissen van buitenaf ────────────────────────────────────── */

/** Een paywall/saleskaart verscheen (PremiumPaywallModal, AccountWall,
 *  /subscribe, bracelet-upsell, of één van onze eigen kaarten). */
export function markSalesCardShown(): void {
  patch({ lastSalesShownAt: Date.now() });
}

/** De plannen/paywall dicht zonder te kopen. */
export function recordPlansDismissed(): void {
  patch({ planDismissals: state.planDismissals + 1 });
}

/** Een aankoop is net gelukt. */
export function recordPurchase(): void {
  patch({ lastPurchaseAt: Date.now() });
}

/* ── Voor de host ───────────────────────────────────────────────────── */

export function addActiveSeconds(sec: number): void {
  if (state.activeSec >= DAY_PASS_FIRST_AFTER_SEC) return;
  patch({ activeSec: Math.min(DAY_PASS_FIRST_AFTER_SEC, state.activeSec + sec) });
}

export function getActiveSeconds(): number {
  return state.activeSec;
}

/** Twee keer weggetikt — bij de volgende app-opening opnieuw aanbieden. */
export function hasDismissedPlansEnough(): boolean {
  return state.planDismissals >= DISMISSALS_FOR_RESHOW;
}

export function hasShownDayPass(): boolean {
  return state.dayPassShows > 0;
}

/** Frequentiegrens van de Day Pass-kaart (7 dagen, max 3). */
export function dayPassCapAllows(now = Date.now()): boolean {
  if (state.dayPassShows >= DAY_PASS_MAX_SHOWS) return false;
  return now - state.dayPassLastShownAt >= DAY_PASS_MIN_GAP_MS;
}

/** Algemene rust: geen andere saleskaart net getoond, geen verse aankoop. */
export function salesQuietAllows(now = Date.now()): boolean {
  if (now - state.lastSalesShownAt < SALES_GAP_MS) return false;
  return now - state.lastPurchaseAt >= AFTER_PURCHASE_MS;
}

export function markDayPassShown(): void {
  const now = Date.now();
  patch({
    dayPassShows: state.dayPassShows + 1,
    dayPassLastShownAt: now,
    planDismissals: 0,
    lastSalesShownAt: now,
  });
}

export function getWinBackShownFor(): string | null {
  return state.winBackShownFor;
}

export function markWinBackShown(expiry: string): void {
  patch({ winBackShownFor: expiry, lastSalesShownAt: Date.now() });
}

export function getWasPro(): State['wasPro'] {
  return state.wasPro;
}

export function setWasPro(until: string, email?: string): void {
  const cur = state.wasPro;
  if (cur && cur.until === until && cur.email === email) return;
  patch({ wasPro: { until, email } });
}

void ensureSalesNudgesLoaded();
