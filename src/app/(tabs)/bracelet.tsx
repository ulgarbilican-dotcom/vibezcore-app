/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet tab ("State Control")

   GEWIJZIGD 4 oktober 2026: deze tab toonde voorheen twee dingen, afhankelijk
   van `isBraceletOwner` (@/utils/dev-user-override):
     - owner      → <BraceletControl /> (bracelet-control.tsx)
     - non-owner  → een ~3800-regel marketing/showcase-pagina (hero, "How it
                    works", 5 Haptic Modes, Technical Specs, The Collection,
                    Pricing, Kickstarter launch banner, Join the Waitlist).

   Reden van de wijziging: Session Control (bracelet-control.tsx) is nu een
   zelfstandige feature die werkt zónder de fysieke Smart Bead Bracelet (via
   telefoon/smartwatch-haptiek) — het is geen "preview van een toekomstig
   product" meer, maar een echte, vandaag werkende functie. De hardware zelf
   (Kickstarter Fall 2026) lanceert nog steeds later.

   Deze tab rendert daarom nu ALTIJD <BraceletControl /> — voor iedereen,
   owner of niet. De volledige marketing/showcase-content van hierboven is
   1-op-1 (zelfde JSX/state/stijlen/comments, geen herontwerp) verhuisd naar
   `src/app/smart-bead-bracelet.tsx`, een losse route (`/smart-bead-bracelet`)
   bereikbaar via een link binnen Session Control ("Also works with the
   Smart Bead Bracelet — launching Fall 2026"). Zie CLAUDE.md §3 voor de
   volledige historie van de etalage-content.

   `isBraceletOwner` wordt hier niet meer gebruikt — BraceletControl.tsx
   bepaalt zelf (via dezelfde hook) wat een owner vs. niet-owner ziet
   (bv. PreviewBadge). Tab-bar blijft zichtbaar want dit is nog steeds een
   tab-screen, geen Stack-push.

   HERZIEN 4 oktober 2026 (operator: "dat scherm is zo fout al maar kan, kijk
   naar format van breathwork/audio library welcome"): de eerste poging was
   een apart, GEPUSHED scherm (/state-control-welcome) — dat verloor de
   tab-balk en kreeg per ongeluk een kale native header-balk, compleet
   inconsistent met hoe de rest van de app een eerste-keer-intro toont.
   De ECHTE referentie, bevestigd door het draaiende toestel te bekijken
   ((tabs)/breath.tsx se "Breathe / Build / Become"-intro): een intro-
   overlay die IN de tab zelf leeft — foto vult het scherm, tab-balk blijft
   zichtbaar, geen native header, geen wordmark, gestapelde titel (3
   graduele regels) + tagline + één CTA. Exact dezelfde stijl-tokens
   (`stackWord1/2/3`/`introSub`/`introCtaMatch`/shimmer-animatie) als
   breath.tsx, 1-op-1 gekopieerd — niet opnieuw verzonnen. */

import { BrandFonts } from '@/constants/theme';
import { useSetting, setSetting } from '@/utils/settings';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import BraceletControl from '../bracelet-control';

/* Zelfde placeholder-foto als eerder — operator levert de echte foto nog
   aan (4 okt 2026: "ik bezorg nog de foto"). Enkel deze constante moet dan
   vervangen worden. */
const BG_IMG = 'https://vibezcore-audio.b-cdn.net/images/pic%20welcome%20app%20new.png';

function StateControlIntro({ onDone }: { onDone: () => void }) {
  const ctaScale = useSharedValue(1);
  const ctaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));
  const shimmer = useSharedValue(-1);
  shimmer.value = withRepeat(
    withSequence(
      withTiming(-1, { duration: 0 }),
      withDelay(2600, withTiming(1, { duration: 1100 })),
      withDelay(1200, withTiming(1, { duration: 0 })),
    ),
    -1,
    false,
  );
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * 220 }, { rotate: '18deg' }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri: BG_IMG }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(10,10,10,0.15)', 'rgba(10,10,10,0.6)', '#0a0a0a']}
        locations={[0.3, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={s.introWrap} edges={['bottom']}>
        <View style={s.stackTitle}>
          <Text style={s.stackWord1}>Feel</Text>
          <Text style={s.stackWord2}>State</Text>
          <Text style={s.stackWord3}>Control</Text>
        </View>
        <Text style={s.introSub}>Choose your state. Feel it instantly.</Text>
        <Animated.View style={[{ marginTop: 28, alignSelf: 'stretch' }, ctaPressStyle]}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onDone();
            }}
            onPressIn={() => {
              ctaScale.value = withTiming(0.96, { duration: 80 });
            }}
            onPressOut={() => {
              ctaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
            }}
            style={s.introCtaMatch}
            android_ripple={{ color: 'rgba(0,0,0,0.12)' }}
          >
            <Text style={[s.ctaTxt, { color: '#1D1D1F' }]}>Explore State Control</Text>
            <Animated.View style={[s.ctaShimmer, shimmerStyle]} pointerEvents="none">
              <LinearGradient
                colors={['#ffffff00', '#ffffff9a', '#ffffff00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

export default function BraceletScreen() {
  const [welcomeDoneAt] = useSetting('stateControlWelcomeCompletedAt');

  if (welcomeDoneAt === null) {
    return (
      <StateControlIntro
        onDone={() => setSetting('stateControlWelcomeCompletedAt', Date.now())}
      />
    );
  }

  return <BraceletControl />;
}

const s = StyleSheet.create({
  introWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 26,
    paddingBottom: 34,
  },
  stackTitle: { alignItems: 'center' },
  introSub: {
    marginTop: 4,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.65)',
    fontFamily: BrandFonts.regular,
    fontSize: 16,
  },
  stackWord1: {
    fontFamily: BrandFonts.medium,
    fontSize: 28,
    letterSpacing: -0.2,
    lineHeight: 32,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
  },
  stackWord2: {
    fontFamily: BrandFonts.medium,
    fontSize: 48,
    letterSpacing: 0,
    lineHeight: 52,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 2,
  },
  stackWord3: {
    fontFamily: BrandFonts.bold,
    fontSize: 50,
    letterSpacing: -1.2,
    lineHeight: 52,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 2,
  },
  introCtaMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    marginHorizontal: 26,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D2D2D7',
    overflow: 'hidden',
  },
  ctaTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    letterSpacing: 0.1,
  },
  ctaShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
  },
});
