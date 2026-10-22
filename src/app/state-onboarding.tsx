/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control-onboarding als volledig scherm

   Twee ingangen:
   - `?first=1` — de eerste keer, na "Explore State Control" in de State
     Control-tab ((tabs)/bracelet.tsx). Volledig scherm bovenop de tabs,
     zoals breath-welcome: geen tabbalk, geen zwevend Premium-knopje
     (operator, 15 okt 2026: "bekijk dat als bezoeker" — dat knopje lag
     over "STEP 1 OF 3"). `hr=1`: het rusthartslag-scherm volgt nog als
     stap 3 (in de tab). Na afloop of Skip: gezien, en de tab opent zonder
     intro (`open`-token). Terug op stap 1 = "Not Now" (19 okt 2026, zie
     utils/onboarding-gate.ts).
   - zonder parameters — Settings → "Watch the intro again" (operator: "zorg
     ook voor herbekijken onboarding knop in settings"). "Done" gaat terug.
   ───────────────────────────────────────────────────────────────────────── */

import StateControlOnboarding from '@/components/StateControlOnboarding';
import { deferOnboarding } from '@/utils/onboarding-gate';
import { setSetting } from '@/utils/settings';
import { setStateIntroSkip } from '@/utils/state-intro-skip';
import { Stack, router, useLocalSearchParams } from 'expo-router';

export default function StateOnboardingScreen() {
  const { first, hr } = useLocalSearchParams<{ first?: string; hr?: string }>();
  const isFirst = first === '1';
  /* Stap 3 (hartslag) ook bij "Watch the intro again" (operator: "waar
     zijn 2 pagina's voor heartrate?"); wie al een waarde heeft, krijgt daar
     "Keep my current" als standaard. */
  /* Operator, 16 okt 2026 ("onboarding voor breathwork betekent niet dat
     onboarding voor state control ook moet verdwijnen"): elke onboarding is
     volledig op zichzelf — de hartslagstap hoort er altijd bij, ook als er
     elders (Breathwork, Profile) al een keuze gemaakt is. */
  const hrNext = true;
  void hr;

  const back = () => {
    /* 19 okt 2026 (operator, punt 24): de eerste keer zonder af te ronden
       weggaan (Back / Android-terug / terugvegen op stap 1) = "Not Now":
       deze app-run niet meer, bij een volgende start nog één keer, daarna
       nooit meer vanzelf. Skip blijft "nooit meer" (zie done). */
    if (isFirst) deferOnboarding('state');
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/bracelet' as never);
  };
  /* Elke keuze (meten, zelf invullen, gemiddelde) eindigt op dezelfde
     plek: State Control met de gekozen toestand klaar — ook bij "Watch the
     intro again" (operator, 16 okt 2026: "alle keuzes moeten naar dezelfde
     volgende stap"; vroeger ging herbekijken terug naar Settings). */
  const done = (mode: number) => {
    if (!isFirst) {
      /* Terug naar de tabs i.p.v. er een tweede bovenop te zetten: zo verdwijnt
       de onboarding (en haar camera/zaklamp) echt (19 okt 2026). */
    setStateIntroSkip(true);
    router.dismissTo({ pathname: '/(tabs)/bracelet', params: { open: String(Date.now()), mode: String(mode) } } as never);
      return;
    }
    void setSetting('stateOnboardingCompletedAt', Date.now());
    /* Na de onboarding: één volledige sessie gratis voor ELKE toestand
       (operator: "na hartrate-meting alle sessies 1-malig unlocken, zo kan
       de gebruiker zelf kiezen") — de gekozen toestand staat klaar. -1 =
       elke toestand; na die ene sessie alles terug op 30 s. */
    void setSetting('stateFreeMode', -1);
    /* De gekozen toestand staat klaar in State Control (en daar is één
       volledige sessie gratis, zie bracelet-control.tsx). */
    /* Terug naar de tabs i.p.v. er een tweede bovenop te zetten: zo verdwijnt
       de onboarding (en haar camera/zaklamp) echt (19 okt 2026). */
    setStateIntroSkip(true);
    router.dismissTo({ pathname: '/(tabs)/bracelet', params: { open: String(Date.now()), mode: String(mode) } } as never);
  };

  return (
    <>
      {/* Terugvegen doet de onboarding zelf (stap per stap), niet de stack. */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <StateControlOnboarding
        includeRestingHr={hrNext}
        finalLabel={isFirst ? 'Continue' : 'Done'}
        onDone={done}
        onBack={back}
      />
    </>
  );
}
