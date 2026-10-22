/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — wanneer verschijnt een onboarding vanzelf?

   19 okt 2026 (operator, punt 24): één set regels voor BEIDE onboardings
   (Breathwork = breath-welcome.tsx, State Control = state-onboarding.tsx):

   1. Wanneer: de eerste keer dat de gebruiker de tab ZELF opent (tik op het
      tabblad / een knop op het welkomstscherm / "Explore State Control") —
      niet bij het opstarten van de app (laatst gebruikte tab terugzetten).
   2. Eén keer. Afgerond of "Skip" → nooit meer. "Not Now" (of zonder af te
      ronden weggaan: terugknop / terugvegen op stap 1) → nog ÉÉN keer, bij
      een volgende app-start, daarna nooit meer vanzelf. Binnen dezelfde
      app-run komt ze na "Not Now" niet terug (`deferredThisRun` hieronder,
      enkel in het geheugen — een nieuwe start = een nieuw proces).
   3. Nooit onderbreken: deeplinks, meldingen, planlinks, de geminimaliseerde
      pill, na een aankoop, of terwijl er een sessie loopt → meteen naar de
      bestemming. Ze verschijnt dan de volgende keer dat de gebruiker de tab
      zelf opent (nog altijd onder regel 2).
   4. "Watch the intro again" in Settings staat hier los van en werkt altijd.

   Waarom een tijdstempel voor "zelf geopend" en geen route-parameter: de
   tabbladknoppen ((tabs)/_layout.tsx) navigeren met een kale
   `router.navigate('/breath')`, en een tab die al gemonteerd is krijgt
   enkel een focus — dezelfde reden als in utils/breath-entry.ts.
   ───────────────────────────────────────────────────────────────────────── */

import { getBraceletSessionSnapshot } from '@/services/bracelet-session-state';
import { getBreathHost, getRunningBreathStatus } from '@/services/breath-session-host';
import { getSetting, setSetting } from '@/utils/settings';

export type OnboardingKind = 'breath' | 'state';

const DONE_KEY = {
  breath: 'breathOnboardingCompletedAt',
  state: 'stateOnboardingCompletedAt',
} as const;
const DEFER_KEY = {
  breath: 'breathOnboardingDeferredCount',
  state: 'stateOnboardingDeferredCount',
} as const;

/** De eerste keer + één keer opnieuw na "Not Now" = hoogstens 2 keer vanzelf. */
const MAX_AUTO_SHOWS = 2;

/* In het geheugen, dus per app-run: na "Not Now" niet opnieuw tot de
   volgende start. */
const deferredThisRun: Record<OnboardingKind, boolean> = { breath: false, state: false };

/** Loopt er nu een sessie (ademsessie-laag of State Control)? Dan nooit een
 *  onboarding ertussen (regel 3). */
/* 22 okt 2026 (operator: bij een geminimaliseerde sessie kon ik de State Control-onboarding niet
   zien): een GEPAUZEERDE sessie telt niet als "lopend" — er wordt dan niets onderbroken. */
export function isAnySessionRunning(): boolean {
  const breath = getBreathHost() !== null && getRunningBreathStatus()?.paused !== true;
  const bracelet = getBraceletSessionSnapshot();
  return breath || (bracelet.active && !bracelet.paused);
}

/** Mag de onboarding NU vanzelf verschijnen (regels 2 en 3)? Zegt niets over
 *  HOE de gebruiker binnenkwam — dat checkt de tab zelf (regel 1). */
export function mayAutoShowOnboarding(kind: OnboardingKind): boolean {
  if (getSetting(DONE_KEY[kind]) !== null) return false;
  if (deferredThisRun[kind]) return false;
  if (getSetting(DEFER_KEY[kind]) >= MAX_AUTO_SHOWS) return false;
  return !isAnySessionRunning();
}

/** "Not Now" / zonder afronden weggaan: telt één uitstel, en niet opnieuw in
 *  deze app-run. Meerdere keren in dezelfde run tellen als één. */
export function deferOnboarding(kind: OnboardingKind): void {
  if (deferredThisRun[kind]) return;
  deferredThisRun[kind] = true;
  void setSetting(DEFER_KEY[kind], getSetting(DEFER_KEY[kind]) + 1);
}

/* ── "De gebruiker opende de tab zelf" ────────────────────────────────────
   Gezet door de tabbladknop vlak vóór de navigatie; de tab leest het bij
   zijn focus. Twee seconden geldig: een tik op een tab die al in beeld
   stond geeft geen focus, en mag niet blijven hangen tot een latere focus
   via een deeplink of de pill. */
const USER_OPEN_WINDOW_MS = 2000;
const userOpenAt: Record<OnboardingKind, number> = { breath: 0, state: 0 };
type Listener = () => void;
const userOpenListeners: Record<OnboardingKind, Set<Listener>> = {
  breath: new Set(),
  state: new Set(),
};

/** Tabbladknop / welkomstknop: de gebruiker opent deze tab zelf. */
export function markTabOpenedByUser(kind: OnboardingKind): void {
  userOpenAt[kind] = Date.now();
  /* Stond de tab al in beeld (geen nieuwe focus), dan beslist hij via deze
     luisteraar. */
  userOpenListeners[kind].forEach((l) => l());
}

/** Opvragen én meteen opruimen. */
export function consumeTabOpenedByUser(kind: OnboardingKind): boolean {
  const t = userOpenAt[kind];
  userOpenAt[kind] = 0;
  return t > 0 && Date.now() - t < USER_OPEN_WINDOW_MS;
}

export function subscribeTabOpenedByUser(kind: OnboardingKind, l: Listener): () => void {
  userOpenListeners[kind].add(l);
  return () => {
    userOpenListeners[kind].delete(l);
  };
}
