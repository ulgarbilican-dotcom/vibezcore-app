/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — gedeelde UI-staat van de State Control-tab.

   Operator, 5 okt 2026 ("na minimaliseren en teruggaan naar de actieve
   sessie zie ik soms het tabblad onderaan, dat mag niet"): de actieve
   sessie is een volledig scherm, zoals Now Playing bij Apple — geen
   tabbalk. Het sessiescherm meldt hier dat het zichtbaar is; de tab-
   indeling ((tabs)/_layout.tsx) verbergt dan de balk voor deze tab.
   ───────────────────────────────────────────────────────────────────────── */

type Listener = (visible: boolean) => void;

let activeSessionVisible = false;
const listeners = new Set<Listener>();

export function setActiveSessionVisible(visible: boolean): void {
  if (activeSessionVisible === visible) return;
  activeSessionVisible = visible;
  listeners.forEach((l) => l(visible));
}

export function isActiveSessionVisible(): boolean {
  return activeSessionVisible;
}

export function subscribeActiveSessionVisible(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
