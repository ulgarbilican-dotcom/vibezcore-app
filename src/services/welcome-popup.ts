/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Welcome-back popup visibility state

   Eenmalige "welkom terug — verder waar je gebleven was?"-popup. Verschijnt
   ALLEEN op een cold-start van de app (= JS-bundle vers gestart, na een
   echte app-close). Backgrounded → foregrounded telt NIET als terugkomst:
   binnen dezelfde JS-process levenscyclus blijft `coldStartShown` true en
   triggert de popup niet opnieuw. Operator-keuze 2026-05-25.

   Trigger-flow:
     1. App start → JS-bundle laadt → coldStartShown = false (module init)
     2. Root-layout mount, auth check, navigatie naar tabs
     3. WelcomeBackPopup-component mount in tabs-context, checkt
        lastPlayed → roept showWelcomePopup() aan als geldig
     4. User tikt "Continue listening" of "Not now" → dismissWelcomePopup
        → coldStartShown = true → popup verschijnt niet meer tot volgende
        cold-start

   Pattern identiek aan bracelet-upsell.ts (module-state + listener-set),
   met één extra veld voor "al getoond in deze process-lifetime".
   ─────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';

/** Module-level flag — true zodra de popup deze app-process-lifetime al
 *  een keer is getoond (zelfs als 'ie inmiddels dicht is). Reset uitsluitend
 *  bij een verse JS-bundle-load (= cold-start). Backgrounded→foregrounded
 *  triggert geen reset. */
let coldStartShown = false;
let visible = false;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

/** Toon de popup. No-op als 'ie al open is OF al getoond is deze
 *  cold-start. */
export function showWelcomePopup(): void {
  if (visible || coldStartShown) return;
  visible = true;
  notify();
}

/** Verberg de popup + markeer als getoond voor deze process-lifetime.
 *  Aangeroepen door zowel "Continue listening" als "Not now" als ✕. */
export function dismissWelcomePopup(): void {
  if (!visible) return;
  visible = false;
  coldStartShown = true;
  notify();
}

/** Forceer "al getoond"-vlag zonder de popup ooit te tonen. Gebruikt
 *  wanneer er geen lastPlayed-entry is — voorkomt dat een latere
 *  setLastPlayed (bv. user start z'n eerste sessie deze session) de
 *  popup alsnog triggert. */
export function markWelcomePopupSkipped(): void {
  coldStartShown = true;
}

/** Read-only voor non-React consumers / debug. */
export function isWelcomePopupVisible(): boolean {
  return visible;
}

/** Read-only — true zodra coldStartShown gezet is. */
export function hasWelcomePopupBeenShown(): boolean {
  return coldStartShown;
}

/** Hook voor componenten. Re-rendert bij show/dismiss. */
export function useWelcomePopupVisible(): boolean {
  const [v, setV] = useState(visible);
  useEffect(() => {
    const listener = () => setV(visible);
    listeners.add(listener);
    setV(visible);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return v;
}
