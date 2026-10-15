/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control-intro opnieuw bekijken (Settings)

   Operator, 15 okt 2026: "zorg ook voor herbekijken onboarding knop in
   settings". Zelfde twee schermen als de eerste keer in de State Control-
   tab (components/StateControlOnboarding.tsx); "Done" gaat terug naar
   Settings. Het rusthartslag-scherm hoort hier niet bij — dat wijzig je
   via het label bovenaan State Control of in Profile.
   ───────────────────────────────────────────────────────────────────────── */

import StateControlOnboarding from '@/components/StateControlOnboarding';
import { Stack, router } from 'expo-router';

export default function StateOnboardingReplay() {
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/bracelet' as never);
  };
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StateControlOnboarding totalSteps={2} finalLabel="Done" onDone={close} onBack={close} />
    </>
  );
}
