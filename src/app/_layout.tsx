/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Root layout

   Eerste scherm is `welcome` (CLAUDE.md §3 + SPEC DEEL 0, operator-beslissing
   19 mei 2026): NIET-blokkerend welkomstscherm, géén poort. Voor gasten
   tonen we welcome; reeds ingelogde gebruikers slaan het over en komen
   direct in de (tabs)-groep met de 3 gelijkwaardige tabs (Audio · Bracelet
   · Account). bracelet-control blijft een losse stack-screen, gepusht
   vanuit de Bracelet-tab.

   Routering-detail: Expo Router routeert op URL en negeert `initialRouteName`
   wanneer `/` resolvable is (→ `(tabs)/index.tsx`). Daarom doen we de keuze
   "welcome vs tabs" hier in de root via een `router.replace('/welcome')`
   zodra blijkt dat er nog geen sessie-token is. Splash blijft op tot zowel
   Inter geladen is als de token-check klaar is — geen flash van de audio-tab
   vóór de welcome-redirect.

   Inter (MERK_ANKER §1) is loaded ÉÉN keer hier, zodat alle schermen
   beschikken over alle gewichten 400/500/600/700/800/900.
   ─────────────────────────────────────────────────────────────────────────── */

import { BraceletUpsellModal } from '@/components/BraceletUpsellModal';
import { WelcomeBackPopup } from '@/components/WelcomeBackPopup';
import { Brand, BrandFonts } from '@/constants/theme';
import { getToken } from '@/services/auth';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from '@expo-google-fonts/inter';
import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text as RNText, View } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => {});

/* Centrale font-inheritance — zet Inter als default op elke <Text> in de app,
   zodat schermen die geen eigen fontFamily zetten tóch Inter krijgen
   (MERK_ANKER §1, BrandFonts in src/constants/theme.ts). Schermen die een
   ander gewicht willen (bold/extrabold/etc.) blijven via BrandFonts.X
   overschrijven — dat wint van defaultProps. */
const RNTextWithDefault = RNText as unknown as {
  defaultProps?: { style?: unknown };
};
RNTextWithDefault.defaultProps = RNTextWithDefault.defaultProps || {};
RNTextWithDefault.defaultProps.style = [
  { fontFamily: BrandFonts.regular },
  RNTextWithDefault.defaultProps.style,
];

/* `undefined` = nog aan het checken; `null` = gast; string = token. */
type AuthState = undefined | null | string;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  const [auth, setAuth] = useState<AuthState>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await getToken();
      if (!cancelled) setAuth(t ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = fontsLoaded && auth !== undefined;

  useEffect(() => {
    if (!ready) return;
    if (auth === null) {
      router.replace('/welcome');
    }
    SplashScreen.hideAsync().catch(() => {});
  }, [ready, auth]);

  /* ── Deep link handler (operator-keuze 2026-05-27) ───────────
     Webapp wordt uitgefaseerd — alle email-flows (magic link na
     Gumroad-koop, password reset, etc.) moeten in de native app
     openen. Scheme `vibezcoreapp://` (app.json). Wanneer user op
     een email-link tikt:
       vibezcoreapp://auth-callback?token_hash=xxx&type=recovery
       vibezcoreapp://auth-callback?token_hash=xxx&type=invite
       vibezcoreapp://reset-password?token_hash=xxx
     → wordt hier gevangen, gerouted naar de juiste in-app screen
     (die het token uitwisselt tegen Supabase en sessie opzet). */
  useEffect(() => {
    if (!ready) return;

    const handle = (url: string | null) => {
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        const path = parsed.path ?? '';
        const params = parsed.queryParams ?? {};

        /* Route per deep-link-pad. Onbekende paden negeren we
           bewust — voorkomt dat een rogue link de app naar een
           verkeerde route kan dwingen. */
        if (path === 'auth-callback') {
          router.push({
            pathname: '/auth-callback' as never,
            params: params as Record<string, string>,
          });
        } else if (path === 'reset-password') {
          router.push({
            pathname: '/reset-password' as never,
            params: params as Record<string, string>,
          });
        } else if (path === 'forgot-password') {
          router.push('/forgot-password' as never);
        } else if (__DEV__) {
          console.log('[deep-link] unhandled path:', path);
        }
      } catch (e) {
        if (__DEV__) console.warn('[deep-link] parse failed:', e);
      }
    };

    /* Cold-start: app werd geopend via deep-link */
    Linking.getInitialURL().then(handle);

    /* Warm: app draait en deep-link wordt afgevuurd */
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [ready]);

  /* Voorheen stond hier een unmount-cleanup die expliciet audio unloadde,
     als defensie tegen de expo-av "Player accessed on wrong thread"-crash.
     Verwijderd 2026-05-23 met de migratie naar expo-audio — die heeft
     z'n eigen lifecycle-management en het hele PUNT van de migratie is
     dat audio nu in background blijft leven (lock-screen + foreground-
     service). Een unload op root-unmount zou dat doel direct breken. */

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: Brand.bg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: Brand.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Brand.bg },
          headerTintColor: Brand.text,
          headerTitleStyle: { fontFamily: 'Inter_700Bold' },
          contentStyle: { backgroundColor: Brand.bg },
        }}
      >
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="bracelet-control"
          options={{ title: 'Bracelet', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="player"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        {/* `settings` — sub-screen pushed from Account-tab. Toont Playback /
           Privacy / About-secties die de webapp ook heeft. */}
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings', headerBackTitle: 'Account' }}
        />
        {/* ── Auth flow schermen (operator-keuze 2026-05-27: webapp wordt
            uitgefaseerd, alles in native). ──
            `auth-callback`: landing voor magic links + invite-emails
            `forgot-password`: in-app form om reset-email te requesten
            `reset-password`: landing voor recovery-email + nieuwe pw setup */}
        <Stack.Screen
          name="auth-callback"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{ title: 'Forgot password', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="reset-password"
          options={{ title: 'Reset password', headerBackTitle: 'Back' }}
        />
        {/* `legal/[doc]` — dynamic route voor 5 legal/safety-docs
            (terms/privacy/refund/cookies/health). Inhoud in
            `src/data/legal-content.ts`. */}
        <Stack.Screen
          name="legal/[doc]"
          options={{ headerBackTitle: 'Account' }}
        />
        {/* `coming` heeft géén handmatige Stack.Screen-registratie meer —
           expo-router 55 pikte 'm dubbel op (file-based routing + deze
           entry → "Too many screens defined. Route 'coming' is
           extraneous"). headerShown: false wordt nu IN coming.tsx zelf
           gezet via <Stack.Screen options={...} />. */}
      </Stack>

      {/* Bracelet-upsell-modal — gemount aan de ROOT (sibling van Stack)
          zodat 'ie als floating overlay boven player.tsx valt zonder
          native-modal touch-intercept. Visibility wordt door de bracelet-
          upsell singleton-service bepaald, getriggerd vanuit
          (tabs)/index.tsx wanneer playerState.endedPanel toggelt. */}
      <BraceletUpsellModal />

      {/* Welcome-back-popup — verschijnt op cold-start als er een geldige
          last-played-entry is. Operator-besluit 2026-05-25 (vervangt de
          eerdere Continue-card in de library): popup voelt warmer +
          "welkom terug" ipv passieve resume-card. Triggert zichzelf via
          useEffect in de component, beperkt tot (tabs)-segmenten zodat
          'ie nooit over /welcome verschijnt. */}
      <WelcomeBackPopup />
    </View>
  );
}
