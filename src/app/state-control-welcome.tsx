/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control welcome (eenmalig, vóór de eerste keer dat de
   tab geopend wordt)

   Consistent met welcome.tsx (het hoofd-welkomstscherm): volledige-
   schermfoto, logo, verloop-overlays, één CTA onderaan boven de home-
   indicator. Geen meerstaps-onboarding zoals breath-welcome.tsx — deze
   tab heeft maar één ding uit te leggen ("kies een staat, voel het,
   werkt op je telefoon en horloge, en straks ook op de echte bracelet"),
   geen reeks losse concepten die stap voor stap moeten.

   BG_IMG is een placeholder tot de operator de echte foto aanlevert
   (4 oktober 2026: "ik bezorg nog de foto") — vervang enkel die ene
   constante zodra het bestand er is, verder niets aan dit scherm hoeft
   te veranderen.

   Gate: (tabs)/bracelet.tsx stuurt hierheen bij de EERSTE focus zolang
   `stateControlWelcomeCompletedAt` null is (zelfde patroon als
   breathOnboardingCompletedAt/breath-welcome.tsx). */

import { BrandFonts } from '@/constants/theme';
import { setSetting } from '@/utils/settings';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Placeholder — operator levert de echte foto nog aan. Zelfde Bunny-host
   als de rest van de app se beeldmateriaal (welcome.tsx/bracelet-content). */
const BG_IMG =
  'https://vibezcore-audio.b-cdn.net/images/pic%20welcome%20app%20new.png';

export default function StateControlWelcomeScreen() {
  const bgOpacity = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const ctaProgress = useSharedValue(0);

  bgOpacity.value = withTiming(1, { duration: 800 });
  logoOpacity.value = withTiming(1, { duration: 380 });
  taglineOpacity.value = withDelay(150, withTiming(1, { duration: 380 }));
  ctaProgress.value = withDelay(300, withSpring(1, { damping: 16, stiffness: 120 }));

  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaProgress.value,
    transform: [{ translateY: (1 - ctaProgress.value) * 22 }],
  }));

  const ctaScale = useSharedValue(1);
  const onPressIn = () => {
    ctaScale.value = withTiming(0.96, { duration: 80 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const onPressOut = () => {
    ctaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const ctaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const onStart = () => {
    setSetting('stateControlWelcomeCompletedAt', Date.now());
    router.replace('/bracelet' as never);
  };

  return (
    <View style={s.root}>
      <Animated.Image
        source={{ uri: BG_IMG }}
        style={[StyleSheet.absoluteFill, bgStyle]}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.35)', 'transparent']}
        locations={[0, 0.18, 0.38]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[
          'transparent',
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.88)',
          'rgba(0,0,0,0.98)',
        ]}
        locations={[0.38, 0.62, 0.82, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.top}>
          <Animated.Image
            source={require('../../assets/vibezcore_wordmark.png')}
            style={[s.wordmark, logoStyle]}
            resizeMode="contain"
            tintColor="#ffffff"
            accessibilityLabel="VIBEZCORE"
          />
          <Animated.Text style={[s.tagline, taglineStyle]}>
            State Control
          </Animated.Text>
        </View>

        <View style={{ flex: 1 }} />

        <View style={s.bottom}>
          <Animated.Text style={[s.body, taglineStyle]}>
            Choose how you want to feel. Feel it instantly — on your
            phone, your Apple Watch or Wear OS, and later on the Smart
            Bead Bracelet too.
          </Animated.Text>
          <Animated.View style={ctaStyle}>
            <AnimatedPressable
              accessibilityRole="button"
              onPress={onStart}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              style={[s.cta, ctaPressStyle]}
            >
              <Text style={s.ctaText}>Get started</Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  top: {
    alignItems: 'center',
    paddingTop: 4,
  },
  wordmark: {
    width: 220,
    height: 36,
  },
  tagline: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: BrandFonts.bold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: '#ffffff',
  },
  bottom: {
    gap: 18,
  },
  body: {
    textAlign: 'center',
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 8,
  },
  cta: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    color: '#0a0a0a',
  },
});
