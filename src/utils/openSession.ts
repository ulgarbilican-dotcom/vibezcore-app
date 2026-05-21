/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — openSession util

   Centrale helper voor het openen van een sessie in de player. Wordt gedeeld
   tussen de Audio Library-tab en de sub-pages onder /library/. Param-shape
   identiek aan wat player.tsx leest, dus de player blijft ongewijzigd.
   ─────────────────────────────────────────────────────────────────────── */

import type { Session } from '@/data/audio-library-data';
import { router } from 'expo-router';

export function openSession(sess: Session) {
  router.push({
    pathname: '/player',
    params: {
      title: sess.title,
      series: sess.series,
      url: sess.url,
      free: sess.free ? 'true' : 'false',
      desc: sess.desc,
    },
  });
}
