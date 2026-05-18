/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Root layout

   Gast-first: the (tabs) group is the entry. No welcome/login route in front.
   bracelet-control is a stack screen pushed from the Bracelet tab preview.
   ─────────────────────────────────────────────────────────────────────────── */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0a0a0a' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="bracelet-control"
          options={{ title: 'Bracelet', headerBackTitle: 'Back' }}
        />
      </Stack>
    </>
  );
}