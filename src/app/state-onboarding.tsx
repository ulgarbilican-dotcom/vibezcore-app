/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control-onboarding als volledig scherm

   Twee ingangen:
   - `?first=1` — de eerste keer, na "Explore State Control" in de State
     Control-tab ((tabs)/bracelet.tsx). Volledig scherm bovenop de tabs,
     zoals breath-welcome: geen tabbalk, geen zwevend Premium-knopje
     (operator, 15 okt 2026: "bekijk dat als bezoeker" — dat knopje lag
     over "STEP 1 OF 3"). `hr=1`: het rusthartslag-scherm volgt nog als
     stap 3 (in de tab). Na afloop of Skip: gezien, en de tab opent zonder
     intro (`open`-token).
   - zonder parameters — Settings → "Watch the intro again" (operator: "zorg
     ook voor herbekijken onboarding knop in settings"). "Done" gaat terug.
   ───────────────────────────────────────────────────────────────────────── */

import StateControlOnboarding from '@/components/StateControlOnboarding';
import { setSetting } from '@/utils/settings';
import { Stack, router, useLocalSearchParams } from 'expo-router';

export default function StateOnboardingScreen() {
  const { first, hr } = useLocalSearchParams<{ first?: string; hr?: string }>();
  const isFirst = first === '1';
  /* Stap 3 (hartslag) ook bij "Watch the intro again" (operator: "waar
     zijn 2 pagina's voor heartrate?"); wie al een waarde heeft, krijgt daar
     "Keep my current" als standaard. */
  const hrNext = isFirst ? hr === '1' : true;

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/bracelet' as never);
  };
  const done = (mode: number) => {
    if (!isFirst) {
      back();
      return;
    }
    void setSetting('stateOnboardingCompletedAt', Date.now());
    void setSetting('stateFreeMode', mode);
    /* De gekozen toestand staat klaar in State Control (en daar is één
       volledige sessie gratis, zie bracelet-control.tsx). */
    router.navigate({ pathname: '/(tabs)/bracelet', params: { open: String(Date.now()), mode: String(mode) } } as never);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: !isFirst }} />
      <StateControlOnboarding
        includeRestingHr={hrNext}
        finalLabel={isFirst ? 'Continue' : 'Done'}
        onDone={done}
        onBack={back}
      />
    </>
  );
}
