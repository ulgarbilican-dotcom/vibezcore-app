/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Foto per dagdeel

   Operator, 18 september 2026: 4 echte foto's aangeleverd (build-your-day.tsx,
   "kan je opbouwen zoals in bijlage... fotos hier"). Losgetrokken uit dat
   scherm zodat plan-review.tsx (de samengevoegde "Your protocol"-stap,
   zelfde dag: "die twee schermen zijn eigenlijk dezelfde stap") dezelfde
   thumbnails kan hergebruiken per sessie i.p.v. een eigen kopie te
   verzinnen. */

import type { PlanSlot } from '@/utils/plan-store';

export const DAYPART_PHOTO: Record<PlanSlot, string> = {
  /* Operator, 20 september 2026: vervanging morning-foto ("pic morning
     app" → "pic morning app 2"). */
  morning: 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20morning%20app%202.png',
  /* Operator, 20 september 2026: vervanging midday-foto ("pic noon app" →
     "pic midday app 2" → "pic midday app 3") — zelfde lijnicoon-stijl
     (transparante achtergrond) als de morning-vervanging, dus dezelfde
     weergave nodig (zie `isIconDaypart` in build-your-day.tsx). */
  midday: 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20midday%20app%203.png',
  afterWork: 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20after%20work%20app%202.png',
  /* Operator, 20 september 2026: vervanging evening ("pic app evening" →
     "pic evening app 2"). */
  evening: 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20evening%20app%202.png',
};
