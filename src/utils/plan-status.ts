/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — status van geplande ademsessies (gedaan / gedeeltelijk)

   Test 10 okt 2026: de agenda en "Your protocol" bepaalden dit elk op hun
   eigen manier (per toestand vs. per dagdeel), en één sessie vinkte twee
   geplande momenten van dezelfde toestand af. Eén regel voor beide:
   per toestand worden de sessies van die dag in volgorde aan de geplande
   momenten (op tijd gesorteerd) toegewezen. Het n-de moment is
   "done" als er minstens n volledig afgeronde sessies zijn, "partial" als
   er minstens n pogingen zijn, anders "none".
   ───────────────────────────────────────────────────────────────────────── */

export type ItemStatus = 'done' | 'partial' | 'none';

type Entry = { key: string; ts: number; completed?: boolean };
type Item = { state: string; reminderAt: number };

/** Status per item (zelfde volgorde als `items`). `entries` = de sessies van
 *  die ene dag (al gefilterd op dag en op "sinds het plan bestaat"). */
export function planItemStatuses(items: Item[], entries: Entry[]): ItemStatus[] {
  const counts = new Map<string, { attempted: number; completed: number }>();
  for (const e of entries) {
    const c = counts.get(e.key) ?? { attempted: 0, completed: 0 };
    c.attempted += 1;
    if (e.completed ?? true) c.completed += 1;
    counts.set(e.key, c);
  }
  const order = items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => a.it.reminderAt - b.it.reminderAt);
  const seen = new Map<string, number>();
  const out: ItemStatus[] = items.map(() => 'none');
  for (const { it, i } of order) {
    const k = seen.get(it.state) ?? 0;
    seen.set(it.state, k + 1);
    const c = counts.get(it.state);
    if (!c) continue;
    out[i] = k < c.completed ? 'done' : k < c.attempted ? 'partial' : 'none';
  }
  return out;
}
