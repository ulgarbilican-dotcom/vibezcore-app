/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Root layout

   Gast-first: the (tabs) group is the entry. No welcome/login route in front.
   bracelet-control is a stack screen pushed from the Bracelet tab preview.

   Inter (MERK_ANKER §1) is loaded ÉÉN keer hier, zodat alle schermen
   beschikken over alle gewichten 400/500/600/700/800/900. Splash blijft tot
   de fonts gereed zijn — geen flash van systeemfont.
   ─────────────────────────────────────────────────────────────────────────── */

import { Brand } from '@/constants/theme';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  const onReady = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: Brand.bg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: Brand.bg }} onLayout={onReady}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Brand.bg },
          headerTintColor: Brand.text,
          headerTitleStyle: { fontFamily: 'Inter_700Bold' },
          contentStyle: { backgroundColor: Brand.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="bracelet-control"
          options={{ title: 'Bracelet', headerBackTitle: 'Back' }}
        />
      </Stack>
    </View>
  );
}
