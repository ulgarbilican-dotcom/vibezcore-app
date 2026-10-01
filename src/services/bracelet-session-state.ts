/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet session state (module-level pub/sub)

   Globale bracelet-sessie snapshot voor UI-componenten die BUITEN
   bracelet-control staan (bv. BraceletMiniIndicator in (tabs)/_layout).
   bracelet-control blijft de bron-van-waarheid en publish't updates
   hierin bij elke poll-tick.

   Operator, 16 september 2026 ("wij hadden hier die functie eerder al
   toegevoegd, kan dat?"): dit bestand bestond al op `master` (iter v238b,
   9 juli 2026) maar niet op deze rollback-branch (`rollback-vc76-take2`,
   die teruggaat tot vóór v238). Hier 1:1 teruggehaald — dit stukje zelf
   was nooit de crash-oorzaak (zie bracelet-control.tsx en
   BraceletMiniIndicator.tsx voor de context van wat WEL verdacht was).

   Pattern gelijk aan history.ts / vzp.ts — Set<subscriber> + notifyAll.
   ─────────────────────────────────────────────────────────────────────── */

export type BraceletSessionSnapshot = {
  active: boolean;
  mode: number; // 0-4, index in MODES-array uit CLAUDE.md §5
  modeName: string; // display-naam ("Boost", "Sharp Focus", ...)
  modeColor: string; // hex
  remainingSec: number; // lokaal berekend (minuten resolution vanaf BLE)
  totalSec: number; // gepland totaal (minuten * 60)
  paused: boolean;
};

const INITIAL: BraceletSessionSnapshot = {
  active: false,
  mode: 0,
  modeName: '',
  modeColor: '#0A84FF',
  remainingSec: 0,
  totalSec: 0,
  paused: false,
};

let snapshot: BraceletSessionSnapshot = { ...INITIAL };
const subscribers = new Set<(s: BraceletSessionSnapshot) => void>();

export function getBraceletSessionSnapshot(): BraceletSessionSnapshot {
  return snapshot;
}

export function setBraceletSessionSnapshot(
  next: Partial<BraceletSessionSnapshot>,
): void {
  snapshot = { ...snapshot, ...next };
  setTimeout(() => {
    subscribers.forEach((cb) => {
      try {
        cb(snapshot);
      } catch {
        /* swallow */
      }
    });
  }, 0);
}

export function clearBraceletSession(): void {
  setBraceletSessionSnapshot({ ...INITIAL });
}

export function subscribeBraceletSession(
  cb: (s: BraceletSessionSnapshot) => void,
): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}
