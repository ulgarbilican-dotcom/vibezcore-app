/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Hoe lang loopt dit protocol

   Operator, 18 september 2026: eerst een eigen scherm (plan-duration.tsx),
   daarna kort geïntegreerd op "Your protocol" (plan-review.tsx), nu
   verplaatst naar build-your-day.tsx zelf ("aantal dagen moet in pagina
   ... build your day"). Losgetrokken naar een gedeelde bron zodat de
   keuze-lijst zelf (en de korte hint-tekst per optie) maar op één plek
   hoeft te kloppen, ongeacht welk scherm 'm toont. */

import type { PlanHorizon } from '@/utils/plan-store';

export const HORIZON_OPTIONS: { key: PlanHorizon; name: string; hint: string }[] = [
  { key: 'today', name: 'Today', hint: 'Try it once' },
  { key: '1w', name: '1 Week', hint: 'A short run' },
  { key: '2w', name: '2 Weeks', hint: 'Enough to feel a pattern' },
  { key: '1m', name: '1 Month', hint: 'A real habit' },
  { key: '3m', name: '3 Months', hint: 'A season' },
  { key: 'ongoing', name: 'Ongoing', hint: 'Keeps rolling forward' },
];
