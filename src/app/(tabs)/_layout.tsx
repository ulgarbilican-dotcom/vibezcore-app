/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Tab navigation skeleton

   Gast-first: the app opens DIRECTLY here. No welcome page, no login wall.
   3 tabs (STRUCTUUR_en_BLE_contract_v2 §4): Audio (largest content section),
   Bracelet (full-fledged own section), Account (optional sign-in).
   ─────────────────────────────────────────────────────────────────────────── */

import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

const COLORS = {
  bg: '#0a0a0a',
  bar: '#0d0d0d',
  border: '#1a1a1a',
  active: '#ffffff',
  inactive: 'rgba(255,255,255,0.38)',
};

/* Minimal text-glyph icons — keeps the skeleton dependency-free.
   Swappable for vector icons later without touching navigation. */
function TabGlyph({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text
        style={{
          fontSize: 18,
          color: focused ? COLORS.active : COLORS.inactive,
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
          backgroundColor: COLORS.bar,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
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