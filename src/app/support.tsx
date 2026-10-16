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

import BalancedText from '@/components/BalancedText';
import { Brand, BrandFonts } from '@/constants/theme';
import { HeaderBackButton } from '@/components/HeaderBackButton';
/* Operator, 26 september 2026 (Huisstijl & Design Handboek v4.4):
   Brand.accent (#3a8fff, Signal Blue) is enkel voor haptic-pulse/"nu
   actief" — nooit voor CTA's. CTA-regel v4.4 op donker: witte knop-bg +
   donkere tekst (die donkere tekst stond hier al goed). */
import { Stack, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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

/* Operator, 16 okt 2026 (iOS-test build 20: "contact support gaat naar
   website maar dan ben je weg vanuit app"): zoals Apple's eigen apps opent
   de pagina in een browservenster BINNEN de app (Safari-weergave op iOS,
   Chrome Custom Tab op Android) met "Done"/sluiten terug naar waar je was.
   Lukt dat niet, dan de gewone browser als terugval. */
async function openSupport(): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(SUPPORT_URL, {
      controlsColor: '#ffffff',
      toolbarColor: Brand.bg,
      dismissButtonStyle: 'done',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  } catch {
    await Linking.openURL(SUPPORT_URL).catch(() => {});
  }
}

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
    /* Open de support-pagina in het browservenster binnen de app. Op iOS
       wacht dit tot "Done"; op Android loopt het meteen door terwijl de
       Custom Tab bovenop blijft. Daarna rollen we dit tussenscherm terug,
       zodat sluiten je terugbrengt waar je was. */
    let alive = true;
    void openSupport().then(() => {
      if (!alive) return;
      if (router.canGoBack()) router.back();
      else router.replace('/');
    });
    return () => {
      alive = false;
    };
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
        <BalancedText style={s.body}>
          We&apos;re taking you to the VIBEZCORE Support page where you can
          submit your request.
        </BalancedText>
        <AnimatedPressable
          style={[s.btn, pressStyle]}
          onPress={() => {
            void openSupport();
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
    /* Vaste hoogte (16 okt 2026): iOS tekent tekst zonder Android's extra regelruimte; enkel padding gaf daar lagere knoppen. */
    minHeight: 52, justifyContent: 'center',
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
