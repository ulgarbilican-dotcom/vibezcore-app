/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Teksten voor Free-gebruikers vóór de start van een sessie
   (19 okt 2026, operator: "free sessies kondigen ALTIJD de preview aan vóór
   de start, overal").

   Eén bron, zodat Breathwork, State Control, Instant Sessions en de plannen
   exact hetzelfde zeggen:
   - gewone free start → 30 s preview, daarna de paywall;
   - de ENE gratis volledige sessie (Breathwork-onboarding / State Control-
     onboarding) → eigen tekst.
   Premium (of bracelet) ziet niets hiervan.
   ───────────────────────────────────────────────────────────────────── */

export const FREE_COPY = {
  previewCta: 'Start 30-Second Preview',
  previewLine: 'Full session with Premium',
  freeCta: 'Start Your Free Session',
  freeLine: 'Your one free full session',
  /* "How do you feel?" (feel-now.tsx): één regel onder de keuzes. */
  feelNowLine: 'Free 30-second preview · Full session with Premium',
} as const;
