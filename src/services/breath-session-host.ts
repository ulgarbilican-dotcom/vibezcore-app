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

export type BreathSessionParams = Record<string, string | undefined>;

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

/** Opent een ademsessie (vervangt een eventuele vorige). */
export function openBreathSession(params: BreathSessionParams): void {
  host = { id: Date.now(), params, minimized: false };
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
