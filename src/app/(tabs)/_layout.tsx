/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Tab navigation skeleton

   Gast-first: the app opens DIRECTLY here. No welcome page, no login wall.
   3 tabs: Audio Library · Bracelet · Account.

   Library is GEEN aparte tab meer; de Library-functionaliteit (zoekbalk,
   filters, Your Journey, FOLLOW per serie, favorites per sessie) wordt
   geïntegreerd ÍN de Audio Library-tab — bron: blauwdruk §3 + besluit
   eigenaar. library.tsx is daarom verwijderd uit deze map.

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

import { MiniPlayer } from '@/components/MiniPlayer';
import { Brand, BrandFonts } from '@/constants/theme';
import { requestLibraryReset } from '@/utils/library-reset-intent';
import { router, Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabPath = '/' | '/bracelet' | '/account';

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
        if (__DEV__) console.log('TABBUTTON tap:', path);
        /* Iter 9dq v98 (2026-06-04): tap op Audio Library-tab reset de
           landing-state in (tabs)/index.tsx zodat bracelet-only users die
           in de free-library waren doorgeklikt, bij hun terugkeer eerst
           de korte bracelet-only landing-page zien (operator-spec). Vuurt
           alleen op echte tab-button-tap — modal-close triggert dit niet
           (geen focus-effect-misuse). */
        if (path === '/') {
          requestLibraryReset();
        }
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
  /* Bottom safe-area inset → tab-bar krijgt extra paddingBottom zodat
     labels niet onder de Android nav-bar / iPhone home-indicator vallen.
     Op Pixel 8 (Android 15) bedroeg de oude vaste 64px tab-bar exact
     de nav-bar zone → labels werden afgesneden. */
  const insets = useSafeAreaInsets();

  /* Wrap Tabs in een View zodat we de MiniPlayer ernaast (absolute,
     boven de tab-bar) kunnen mounten. MiniPlayer rendert zelf null
     wanneer geen sessie actief is en op /player + /welcome. */
  return (
    <View style={{ flex: 1, backgroundColor: Brand.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Brand.bg,
            borderTopColor: Brand.border,
            borderTopWidth: 1,
            /* Basis-hoogte 64 + system-inset onderaan. paddingBottom
               combineert eigen 8px ruimte met de safe-area-inset zodat
               labels boven Android nav-bar / iPhone home-bar blijven. */
            height: 64 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
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
      <MiniPlayer />
    </View>
  );
}
