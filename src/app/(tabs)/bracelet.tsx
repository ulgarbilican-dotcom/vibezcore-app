/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet tab ("State Control")

   GEWIJZIGD 4 oktober 2026: deze tab toonde voorheen twee dingen, afhankelijk
   van `isBraceletOwner` (@/utils/dev-user-override):
     - owner      → <BraceletControl /> (bracelet-control.tsx)
     - non-owner  → een ~3800-regel marketing/showcase-pagina (hero, "How it
                    works", 5 Haptic Modes, Technical Specs, The Collection,
                    Pricing, Kickstarter launch banner, Join the Waitlist).

   Reden van de wijziging: Session Control (bracelet-control.tsx) is nu een
   zelfstandige feature die werkt zónder de fysieke Smart Bead Bracelet (via
   telefoon/smartwatch-haptiek) — het is geen "preview van een toekomstig
   product" meer, maar een echte, vandaag werkende functie. De hardware zelf
   (Kickstarter Fall 2026) lanceert nog steeds later.

   Deze tab rendert daarom nu ALTIJD <BraceletControl /> — voor iedereen,
   owner of niet. De volledige marketing/showcase-content van hierboven is
   1-op-1 (zelfde JSX/state/stijlen/comments, geen herontwerp) verhuisd naar
   `src/app/smart-bead-bracelet.tsx`, een losse route (`/smart-bead-bracelet`)
   bereikbaar via een link binnen Session Control ("Also works with the
   Smart Bead Bracelet — launching Fall 2026"). Zie CLAUDE.md §3 voor de
   volledige historie van de etalage-content.

   `isBraceletOwner` wordt hier niet meer gebruikt — BraceletControl.tsx
   bepaalt zelf (via dezelfde hook) wat een owner vs. niet-owner ziet
   (bv. PreviewBadge). Tab-bar blijft zichtbaar want dit is nog steeds een
   tab-screen, geen Stack-push.

   TOEGEVOEGD 4 oktober 2026: eenmalige welcome-gate, zelfde patroon als
   (tabs)/breath.tsx gebruikt voor breath-welcome.tsx. `stateControlWelcome
   CompletedAt` null = nog nooit gezien → eerste focus stuurt naar
   /state-control-welcome. De 700ms-vertraging geeft AsyncStorage de tijd
   om de setting te laden vóór er beslist wordt (zelfde reden als
   breath.tsx's eigen commentaar daarbij). */

import { useSetting } from '@/utils/settings';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import BraceletControl from '../bracelet-control';

export default function BraceletScreen() {
  const [welcomeDoneAt] = useSetting('stateControlWelcomeCompletedAt');
  const flagRef = useRef(welcomeDoneAt);
  flagRef.current = welcomeDoneAt;

  useFocusEffect(
    useCallback(() => {
      const id = setTimeout(() => {
        if (flagRef.current !== null) return;
        router.replace('/state-control-welcome' as never);
      }, 700);
      return () => clearTimeout(id);
    }, []),
  );

  return <BraceletControl />;
}
