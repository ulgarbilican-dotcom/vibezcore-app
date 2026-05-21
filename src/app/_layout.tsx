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

import { Brand, BrandFonts } from '@/constants/theme';
import { unload as unloadAudio } from '@/services/audio-player';
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

  /* Extra defensie tegen expo-av's "Player accessed on wrong thread"-crash
     tijdens JS-reload (zie audio-player.ts AppState-listener voor de
     andere helft van het verhaal). Wanneer de root-layout unmount —
     ReactHostImpl.destroy of dev-reload — krijgt JS nog een laatste tick.
     We gebruiken die om eventueel geladen audio via JS-bridge netjes te
     unloaden. Tegen de tijd dat de native onHostDestroy fired, is de
     player al weg → geen ExoPlayer.release op worker-thread meer mogelijk. */
  useEffect(() => {
    return () => {
      unloadAudio().catch(() => {
        /* swallow — defensieve cleanup mag nooit zelf crashen */
      });
    };
  }, []);

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
        {/* `coming` heeft géén handmatige Stack.Screen-registratie meer —
           expo-router 55 pikte 'm dubbel op (file-based routing + deze
           entry → "Too many screens defined. Route 'coming' is
           extraneous"). headerShown: false wordt nu IN coming.tsx zelf
           gezet via <Stack.Screen options={...} />. */}
      </Stack>
    </View>
  );
}
