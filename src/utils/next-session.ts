/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Next-session lookup

   Bepaalt de "volgende" sessie in dezelfde serie voor auto-play en de
   "Play next?"-prompt aan het einde van een sessie.

   Beslisregels (operator Q4/Q5 TAAK MINI-PLAYER + iter 9nn):
     - Soundscapes: BINNEN de subseries blijven (Calm Clarity / Rest &
       Reset / Zen Flow / Harmonic). Bij laatste van subseries → null
       (UI toont "Series complete").
     - Niet-Soundscapes: doorlopen over de hele serie.
     - Volgorde = array-volgorde van SESSIONS.filter(...). Het num-veld
       is niet betrouwbaar (free vs PRO hebben overlappende nums).

   Iter 9nn (operator-keuze 2026-05-29): voor guests / free-tier users
   slaat de lookup automatisch PRO-sessies over. Geen valse Play-next-
   belofte op vergrendelde content. Wanneer er geen volgende FREE
   sessie in de serie is → null → UI toont "Series complete" + upsell.
   PRO users zien gewoon alle next-sessies (huidig gedrag).
   ─────────────────────────────────────────────────────────────────── */

import { SERIES_ORDER, SESSIONS, type Session } from '@/data/audio-library-data';

export function getNextSession(
  currentUrl: string,
  opts: { freeOnly?: boolean } = {},
): Session | null {
  const current = SESSIONS.find((s) => s.url === currentUrl);
  if (!current) return null;

  const isSoundscapes = current.series === 'Soundscapes';
  const pool = SESSIONS.filter(
    (s) =>
      s.series === current.series &&
      (!isSoundscapes || s.subseries === current.subseries),
  );

  const idx = pool.findIndex((s) => s.url === currentUrl);
  if (idx < 0) return null;

  /* Free-only flow (iter 9oo): voor guests/free-tier eerst free sessie
     in huidige pool zoeken; geen → cross-series-jump naar volgende
     serie in SERIES_ORDER en zoek daar eerste free sessie. Herhaal
     tot iets gevonden of alle series uitgeput. Voorkomt "Series
     complete" zolang er ergens nog free content is. */
  if (opts.freeOnly) {
    /* Stap 1: rest van huidige pool */
    for (let i = idx + 1; i < pool.length; i++) {
      if (pool[i].free) return pool[i];
    }
    /* Stap 2: volgende series in SERIES_ORDER (cross-series jump) */
    const currentSeriesIdx = SERIES_ORDER.indexOf(current.series);
    if (currentSeriesIdx < 0) return null;
    for (let si = currentSeriesIdx + 1; si < SERIES_ORDER.length; si++) {
      const nextSeries = SERIES_ORDER[si];
      const candidate = SESSIONS.find(
        (s) => s.series === nextSeries && s.free,
      );
      if (candidate) return candidate;
    }
    /* Geen vrije content meer → echte einde van free flow */
    return null;
  }

  if (idx === pool.length - 1) return null;
  return pool[idx + 1];
}
