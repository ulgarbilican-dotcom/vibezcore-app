/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "Ongoing"-plannen echt laten doorlopen

   Audit 10 okt 2026 (operator: "akkoord"): "Ongoing — Keeps rolling
   forward" had geen code; elk plan stopte na 30 dagen. Gedeeld door
   plan-store.ts (breathwork) en bracelet-plan-store.ts (State Control):
   houdt altijd `ROLL_DAYS` dagen vooruit gevuld, telkens met de items van
   de laatst bekende dag ervoor. Aanpassingen gelden voor elke dag vanaf
   vandaag, dus die laatste dag is de actuele planning.
   ───────────────────────────────────────────────────────────────────────── */

import { dayKey } from '@/utils/bracelet-history';

const ROLL_DAYS = 30;

type DayLike<T> = { dayKey: string; items: T[] };

/** Nieuwe `days` met minstens `ROLL_DAYS` dagen vanaf vandaag, of `null`
 *  als er niets bij moest. Dagen in het verleden blijven onaangeroerd. */
export function rollDaysForward<T extends object>(
  days: Record<string, DayLike<T>>,
): Record<string, DayLike<T>> | null {
  const keys = Object.keys(days).sort();
  if (keys.length === 0) return null;
  const tk = dayKey(new Date());
  const before = keys.filter((k) => k <= tk);
  let last = days[before.length ? before[before.length - 1] : keys[0]].items;
  let changed = false;
  const next = { ...days };
  for (let i = 0; i < ROLL_DAYS; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const k = dayKey(d);
    if (next[k]) {
      last = next[k].items;
    } else {
      next[k] = { dayKey: k, items: last.map((it) => ({ ...it })) };
      changed = true;
    }
  }
  return changed ? next : null;
}
