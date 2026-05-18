/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Tab navigation skeleton

   Gast-first: the app opens DIRECTLY here. No welcome page, no login wall.
   3 tabs (STRUCTUUR_en_BLE_contract_v2 §4): Audio (largest content section),
   Bracelet (full-fledged own section), Account (optional sign-in).

   Uiterlijk: MERK_ANKER — Brand-palet, Inter via _layout.
   ─────────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

/* Minimal text-glyph icons — keeps the skeleton dependency-free.
   Swappable for vector icons later without touching navigation. */
function TabGlyph({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text
        style={{
          fontSize: 18,
          color: focused ? Brand.text : Brand.textDim,
          fontFamily: BrandFonts.regular,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Brand.bg,
          borderTopColor: Brand.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Brand.text,
        tabBarInactiveTintColor: Brand.textDim,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: BrandFonts.semibold,
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Audio',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabGlyph label="♪" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bracelet"
        options={{
          title: 'Bracelet',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabGlyph label="◎" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabGlyph label="○" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
