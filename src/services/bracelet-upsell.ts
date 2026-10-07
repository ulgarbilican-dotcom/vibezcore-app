/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet upsell visibility state

   Tiny module-level singleton voor "is de bracelet-upsell-modal nu open".
   Pattern identiek aan audio-player.ts listener-set / vzp.ts.

   Waarom een singleton ipv lokale React-state in één component:
   de TRIGGER zit in (tabs)/index.tsx (watcht playerState.endedPanel), maar
   de MOUNT moet aan de root van de app (app/_layout.tsx) zodat hij over
   player.tsx (modal-presentation-route) heen valt. Singleton ontkoppelt
   die twee posities zonder prop-drilling.

   Waarom geen React Context: Context vereist een Provider boom-wrap.
   Onze root-layout heeft al complexe init-flow (font-load + auth-check);
   een extra Context-laag toevoegen is overkill voor één boolean. Module-
   state + listener-set is de bestaande conventie in deze codebase.
   ─────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';

/* ── Afsluit-link naar de bracelet-pagina (operator, 7 okt 2026) ──────────
   Strategie: app + horloge = kern, de bracelet = premium upgrade. Op het
   afsluitscherm van State Control en Breathwork staat één rustige tekst-
   link naar /smart-bead-bracelet, nooit voor wie al een bracelet heeft.
   GEWIJZIGD zelfde dag (operator: "het is de bedoeling de bracelet al te
   promoten, nu bijna nergens vindbaar"): geen limiet van 1×/dag meer —
   de regel staat er bij elke afgeronde sessie. */
export type BraceletNudgePlace = 'state-control' | 'breathwork';

/** Hook voor een afsluitscherm: true als de link hier mag staan. */
export function useBraceletNudge(_place: BraceletNudgePlace, enabled: boolean): boolean {
  return enabled;
}

let visible = false;
const listeners = new Set<() => void>();

function notify(): void {
  setTimeout(() => { listeners.forEach((l) => l()); }, 0);
}

/** Toon de modal. No-op als 'ie al open is. */
export function showBraceletUpsell(): void {
  if (visible) return;
  visible = true;
  notify();
}

/** Verberg de modal. No-op als 'ie al dicht is. */
export function hideBraceletUpsell(): void {
  if (!visible) return;
  visible = false;
  notify();
}

/** Read-only snapshot voor non-React consumers. */
export function isBraceletUpsellVisible(): boolean {
  return visible;
}

/**
 * Hook om de visibility te consumeren in een component. Re-rendert
 * wanneer show/hide wordt aangeroepen.
 */
export function useBraceletUpsellVisible(): boolean {
  const [v, setV] = useState(visible);
  useEffect(() => {
    const listener = () => setV(visible);
    listeners.add(listener);
    setV(visible); // sync na mount voor het geval state veranderde
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return v;
}
