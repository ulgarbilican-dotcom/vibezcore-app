/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Breath session global state

   Iter v149 v3 (2026-06-25): hoist breath sessie-state uit (tabs)/breath.tsx
   naar een global singleton zodat de root-layout een floating mini-control
   kan tonen wanneer user wegnavigeert tijdens een actieve breath-sessie.

   Operator-feedback: 'als ik wegklik uit breath blijft dat doorpraten als
   sessie nog actief is heel goed. alleen is het niet duidelijk wat er
   gebeurt en waar.' — fix is een persistente mini-bar bovenaan met sessie-
   naam + stop-knop, zichtbaar op elke tab BEHALVE de breath-tab zelf.

   Patroon: lightweight pub/sub (geen Zustand/Redux nodig — exact 1 piece
   of state, 1 listener-set). React-component subscribet via useEffect en
   re-rendert bij changes.
   ─────────────────────────────────────────────────────────────────── */

export type BreathSessionInfo = {
  isRunning: boolean;
  patternKey: string | null;
  patternName: string | null;
  patternColor: string | null;
  /** Callback die de mini-control kan aanroepen om de sessie te stoppen.
   *  Set door breath.tsx, gewist bij stop/cleanup. */
  onStop: (() => void) | null;
};

const INITIAL: BreathSessionInfo = {
  isRunning: false,
  patternKey: null,
  patternName: null,
  patternColor: null,
  onStop: null,
};

let state: BreathSessionInfo = { ...INITIAL };
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* één crashende listener mag de rest niet blokkeren */
    }
  });
}

export function getBreathSession(): BreathSessionInfo {
  return state;
}

export function setBreathSessionActive(opts: {
  patternKey: string;
  patternName: string;
  patternColor: string;
  onStop: () => void;
}): void {
  state = {
    isRunning: true,
    patternKey: opts.patternKey,
    patternName: opts.patternName,
    patternColor: opts.patternColor,
    onStop: opts.onStop,
  };
  notify();
}

export function clearBreathSession(): void {
  state = { ...INITIAL };
  notify();
}

export function subscribeBreathSession(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
