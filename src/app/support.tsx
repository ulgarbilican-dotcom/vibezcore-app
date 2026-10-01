/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Support redirect screen
   Iter v159 (2026-06-26)

   Operator-spec: alle 'Contact support' knoppen en links moeten naar het
   webformulier op https://www.vibezcore.com/support gaan. Geen email-app
   open meer, geen in-app form. User vult support-aanvraag in op de
   centrale webpage (Zoho-Desk of vergelijkbare ticketing).

   Deze /support route opent de webpage in de browser en sluit zichzelf.
   Behoud van de route zorgt dat bestaande deep-links + interne navigatie
   nog werken zonder breakage. Voor users die expliciet hier landen toont
   de page een korte verwijzing + een handmatige 'Open Support' knop voor
   het geval de auto-redirect faalt.
   ─────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { HeaderBackButton } from '@/components/HeaderBackButton';
/* Operator, 26 september 2026 (Huisstijl & Design Handboek v4.4):
   Brand.accent (#3a8fff, Signal Blue) is enkel voor haptic-pulse/"nu
   actief" — nooit voor CTA's. CTA-regel v4.4 op donker: witte knop-bg +
   donkere tekst (die donkere tekst stond hier al goed). */
import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

/* Press-scale recipe (zie breath-welcome.tsx `StartCard`) — de "Open
   Support page"-knop had nog geen enkele press-feedback. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SUPPORT_URL = 'https://www.vibezcore.com/support';

export default function SupportScreen() {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  useEffect(() => {
    /* Open de centrale support-webpage in de browser. Direct na openen
       gaan we terug zodat de user op z'n oorspronkelijke scherm terugkomt
       wanneer hij de browser sluit. Linking.openURL is fire-and-forget;
       falen wordt door de OS afgehandeld. */
    void Linking.openURL(SUPPORT_URL).catch(() => {
      /* swallow — user kan de manual knop hieronder gebruiken */
    });
    /* Kleine vertraging zodat de browser kan openen voordat we de
       app-stack terugrollen. */
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }, 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen
        options={{
          title: 'Support',
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <View style={s.center}>
        <Text style={s.title}>Opening Support…</Text>
        <Text style={s.body}>
          We&apos;re taking you to the VIBEZCORE Support page where you can
          submit your request.
        </Text>
        <AnimatedPressable
          style={[s.btn, pressStyle]}
          onPress={() => {
            void Linking.openURL(SUPPORT_URL);
          }}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
        >
          <Text style={s.btnText}>Open Support page</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: Brand.text,
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    marginBottom: 12,
  },
  body: {
    color: Brand.textDim,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  btnText: {
    color: '#0a0a0a',
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
