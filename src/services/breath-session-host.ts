/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — de ademsessie als laag boven de app ("Now Playing")

   Operator, 5 okt 2026 ("breathwork moet ook minimaliseren — nu kan ik
   enkel via de terugpijl weg en dan stopt de sessie"): de sessie leefde
   als gewoon scherm in de navigatie; weggaan = scherm weg = sessie weg.
   Nu leeft ze in één laag boven de hele app (components/BreathSessionHost,
   in de root-layout). Minimaliseren schuift die laag weg maar houdt de
   sessie gemonteerd — stem, haptiek, timing en de ademfiguur lopen door.
   De pill (BreathMiniControl) haalt ze terug.
   ───────────────────────────────────────────────────────────────────────── */

import { getModeMeta } from './ble-contract';
import { endStateControlSession, getBraceletMonitorSession } from './bracelet-session-monitor';

export type BreathSessionParams = Record<string, string | undefined>;

/* 19 okt 2026 (operator: "als ik breathwork en state control na elkaar start,
   lopen beide — dat is niet de bedoeling"): één sessie tegelijk, over beide
   soorten heen. Loopt er State Control, dan dezelfde vraag als bij een
   tweede ademsessie ("End current session?"). */
function runningStateLabel(): string | null {
  const st = getBraceletMonitorSession();
  return st ? getModeMeta(st.mode).name : null;
}

type HostState = {
  /** Nieuwe id per geopende sessie — de host monteert dan een verse sessie. */
  id: number;
  params: BreathSessionParams;
  minimized: boolean;
} | null;

let host: HostState = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* een kapotte luisteraar mag de rest niet blokkeren */
    }
  });
}

/* Audit 12 okt 2026: een nieuwe sessie starten terwijl er een
   (geminimaliseerde) sessie loopt, verving die stil — de geademde minuten
   verdwenen en het horloge bleef de oude sessie begeleiden. Nu vraagt de
   app eerst "End current session?" (zoals State Control "Switch to …?"),
   en sluit hij de lopende sessie netjes af (opslaan + horloge stoppen). */
type RunningSession = {
  isActive: () => boolean;
  label: () => string;
  end: () => void;
  /** Voor de pill (audit 12 okt 2026): gepauzeerd + resterende tijd. */
  status?: () => { paused: boolean; remainingSec: number } | null;
};
let running: RunningSession | null = null;
let pendingOpen: BreathSessionParams | null = null;

/** De gemonteerde sessie meldt zich aan (en af bij het demonteren). */
export function registerRunningBreathSession(r: RunningSession): () => void {
  running = r;
  return () => {
    if (running === r) running = null;
  };
}

/** Opent een ademsessie. Loopt er al een, dan eerst bevestigen. */
export function openBreathSession(params: BreathSessionParams): void {
  if ((host && running?.isActive()) || runningStateLabel() !== null) {
    pendingOpen = params;
    notify();
    return;
  }
  host = { id: Date.now(), params, minimized: false };
  notify();
}

/** Status van de lopende sessie voor de pill (null = niet gestart). */
export function getRunningBreathStatus(): { paused: boolean; remainingSec: number } | null {
  if (!running?.isActive()) return null;
  try {
    return running.status?.() ?? null;
  } catch {
    return null;
  }
}

export function getPendingBreathOpen(): { label: string; kind: 'breath' | 'state' } | null {
  if (!pendingOpen) return null;
  const state = runningStateLabel();
  if (state !== null) return { label: state, kind: 'state' };
  return { label: running?.label() ?? 'Breathwork', kind: 'breath' };
}

/** "End & Start": de lopende sessie afsluiten (bewaart de geademde tijd),
 *  dan de nieuwe openen. */
export function confirmPendingBreathOpen(): void {
  const params = pendingOpen;
  pendingOpen = null;
  if (!params) return;
  if (runningStateLabel() !== null) void endStateControlSession();
  try {
    if (running?.isActive()) running.end();
  } catch {
    /* afsluiten mag het openen van de nieuwe sessie nooit blokkeren */
  }
  host = { id: Date.now(), params, minimized: false };
  notify();
}

export function cancelPendingBreathOpen(): void {
  if (!pendingOpen) return;
  pendingOpen = null;
  notify();
}

/** State Control start terwijl er een ademsessie loopt (19 okt 2026): de
 *  ademsessie netjes afsluiten (geademde tijd bewaard, horloge gestopt) en
 *  de laag sluiten — één sessie tegelijk. */
export function endRunningBreathSession(): void {
  if (!running?.isActive()) return;
  try {
    running.end();
  } catch {
    /* afsluiten mag de nieuwe sessie nooit blokkeren */
  }
  pendingOpen = null;
  host = null;
  notify();
}

/** Sluit de sessie-laag; de sessie zelf ruimt op bij het demonteren. */
export function closeBreathSession(): void {
  host = null;
  notify();
}

export function minimizeBreathSession(): void {
  if (!host || host.minimized) return;
  host = { ...host, minimized: true };
  notify();
}

export function restoreBreathSession(): void {
  if (!host || !host.minimized) return;
  host = { ...host, minimized: false };
  notify();
}

export function getBreathHost(): HostState {
  return host;
}

export function subscribeBreathHost(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
