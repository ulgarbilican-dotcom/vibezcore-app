/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Tab navigation skeleton

   Gast-first: the app opens DIRECTLY here. No welcome page, no login wall.
   4 tabs: Audio (landing/merk) · Library (sessies) · Bracelet · Account.

   ─── Waarom een custom tabBarButton ───
   Vastgesteld via console.log-diagnostiek: de default tab-button uit
   @react-navigation/bottom-tabs (PlatformPressable) ving de press niet
   door op deze stack (RN 0.83 + expo-router 55 + react 19 + reactCompiler).
   Tikken op een tab triggerde geen onPress en dus ook geen tabPress-listener
   — vandaar dat Library "dood" leek. We vervangen de button daarom door een
   gewone `Pressable` uit react-native met directe `router.navigate(path)`.
   Daarmee gaat de navigatie buiten het navigator-event-systeem om en is ze
   onafhankelijk van welke optimalisatie er ook bovenop ligt.

   Uiterlijk: MERK_ANKER — Brand-palet, Inter via _layout.
   ─────────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { router, Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

type TabPath = '/' | '/library' | '/bracelet' | '/account';

/* Eigen tab-button. Wraps de bestaande icon+label-children van de navigator
   in een gewone Pressable; onPress doet één ding: navigeer naar path. */
function TabButton({
  path,
  children,
  accessibilityLabel,
  accessibilityState,
  testID,
}: {
  path: TabPath;
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  testID?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        console.log('TABBUTTON tap:', path);
        router.navigate(path);
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      android_ripple={{ color: 'rgba(255,255,255,0.06)', borderless: true }}
    >
      {children}
    </Pressable>
  );
}

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
          title: 'Audio Library',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabGlyph label="♪" focused={focused} />
          ),
          tabBarButton: (props) => <TabButton path="/" {...props} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabGlyph label="≡" focused={focused} />
          ),
          tabBarButton: (props) => <TabButton path="/library" {...props} />,
        }}
      />
      <Tabs.Screen
        name="bracelet"
        options={{
          title: 'Bracelet',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabGlyph label="◎" focused={focused} />
          ),
          tabBarButton: (props) => <TabButton path="/bracelet" {...props} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabGlyph label="○" focused={focused} />
          ),
          tabBarButton: (props) => <TabButton path="/account" {...props} />,
        }}
      />
    </Tabs>
  );
}
