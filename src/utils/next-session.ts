/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Next-session lookup

   Bepaalt de "volgende" sessie in dezelfde serie voor auto-play en de
   "Play next?"-prompt aan het einde van een sessie.

   Beslisregels (operator Q4/Q5 TAAK MINI-PLAYER):
     - Soundscapes: BINNEN de subseries blijven (Calm Clarity / Rest &
       Reset / Zen Flow / Harmonic). Bij laatste van subseries → null
       (UI toont "Series complete").
     - Niet-Soundscapes: doorlopen over de hele serie.
     - Volgorde = array-volgorde van SESSIONS.filter(...). Het num-veld
       is niet betrouwbaar (free vs PRO hebben overlappende nums).
   ─────────────────────────────────────────────────────────────────────── */

import { SESSIONS, type Session } from '@/data/audio-library-data';

export function getNextSession(currentUrl: string): Session | null {
  const current = SESSIONS.find((s) => s.url === currentUrl);
  if (!current) return null;

  const isSoundscapes = current.series === 'Soundscapes';
  const pool = SESSIONS.filter(
    (s) =>
      s.series === current.series &&
      (!isSoundscapes || s.subseries === current.subseries)
  );

  const idx = pool.findIndex((s) => s.url === currentUrl);
  if (idx < 0 || idx === pool.length - 1) return null;
  return pool[idx + 1];
}
