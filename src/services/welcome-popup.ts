/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Welcome-back popup visibility state

   Operator ("haal die popup gewoon weg... als gebruiker op 'Last
   Listened' klikt gaat de popup open"): dit was een AUTO-getriggerde
   cold-start-popup (zie git-historie voor de vorige throttle-aanpak, die
   het te-vaak-verschijnen-probleem probeerde te temperen). Nu volledig
   handmatig — de popup toont ALLEEN nog wanneer de gebruiker zelf op de
   "Last Listened"-snelkoppeling tikt in de Audio Library
   ((tabs)/index.tsx), geen enkele automatische trigger meer. Daardoor is
   er ook geen throttle/cold-start-boekhouding meer nodig: een bewuste
   tap mag altijd meteen de popup openen.

   Pattern identiek aan bracelet-upsell.ts (module-state + listener-set).
   ─────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';

let visible = false;
const listeners = new Set<() => void>();

function notify(): void {
  setTimeout(() => { listeners.forEach((l) => l()); }, 0);
}

/** Toon de popup. Enige aanroeper: de "Last Listened"-snelkoppeling. */
export function showWelcomePopup(): void {
  if (visible) return;
  visible = true;
  notify();
}

/** Verberg de popup — aangeroepen door zowel "Continue listening" als
 *  "Not now" als ✕. */
export function dismissWelcomePopup(): void {
  if (!visible) return;
  visible = false;
  notify();
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
