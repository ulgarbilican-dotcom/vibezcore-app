/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — BreathPacer preview (__DEV__ only)

   Operator, 8 september 2026: tijdelijk testscherm voor de eerste bouwsteen
   van de "Deep Tech"-visie (zie src/components/BreathPacer.tsx). Enkel
   bereikbaar via de dev-only rij in settings.tsx — geen echte route in het
   product, puur om het component op een toestel te kunnen bekijken vóór
   het ergens echt verbonden wordt. Mag weg zodra BreathPacer een vaste
   plek in de app heeft (of definitief verworpen wordt).
   ───────────────────────────────────────────────────────────────────────── */

import BreathPacer from '@/components/BreathPacer';
import LotusPacer from '@/components/LotusPacer';
import { BrandFonts } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const STATES = [
  { key: 'calm', name: 'Calm Control', accent: '#B478FF' },
  { key: 'boost', name: 'Boost', accent: '#F5A524' },
  { key: 'focus', name: 'Sharp Focus', accent: '#3E9BFF' },
  { key: 'rest', name: 'Sleep', accent: '#25D366' },
] as const;

export default function BreathPacerPreview() {
  const backScale = useSharedValue(1);
  const onBackPressIn = () => {
    backScale.value = withTiming(0.92, { duration: 80 });
  };
  const onBackPressOut = () => {
    backScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const backPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#161022', '#0a0a0a', '#050505']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <AnimatedPressable
          onPress={() => router.back()}
          onPressIn={onBackPressIn}
          onPressOut={onBackPressOut}
          style={[s.back, backPressStyle]}
          hitSlop={14}
        >
          {/* Operator, 1 okt 2026 ("headers overal consistent"): size
             22→20, stroke 2.2→2.8 — de "officiële iOS-chevron.backward"-
             stijl uit build-choice.tsx (18 sept), nu de app-brede
             standaard (kleur hier bewust vol wit, staat op een foto). */}
          <ChevronLeft size={20} color="#ffffff" strokeWidth={2.8} />
        </AnimatedPressable>

        <View style={s.center}>
          <Text style={s.eyebrow}>BreathPacer · Bouwsteen 1</Text>
          <BreathPacer size={260} accent={STATES[0].accent} />
        </View>

        <View style={s.swatchRow}>
          {STATES.map((st) => (
            <View key={st.key} style={s.swatchCol}>
              <BreathPacer size={92} accent={st.accent} />
              <Text style={s.swatchLabel}>{st.name}</Text>
            </View>
          ))}
        </View>

        {/* Operator, 9 september 2026: proef of de platte SessionArt-vormen
            (sun/flower/lotus/crystal/tree) ook procedureel in 3D kunnen —
            hieronder alleen de Lotus (Calm Control), losstaand van de
            BreathPacer-rij hierboven. Mag weg zodra de operator besliste of
            dit traject wordt voortgezet voor de andere 4 vormen. */}
        <View style={s.lotusSection}>
          <Text style={s.eyebrow}>LotusPacer · Vormproef (Calm Control)</Text>
          {/* Operator, 9 september 2026 (6e ronde): "kunnen we eerst 2
              proberen dan beslis ik" — beide varianten naast elkaar zodat
              vergelijken niet steeds heen-en-weer navigeren vraagt. */}
          <View style={s.lotusRow}>
            <View style={s.lotusCol}>
              <LotusPacer size={170} accent={STATES[0].accent} variant="sway" />
              <Text style={s.lotusLabel}>1 · Foto, wiegel</Text>
            </View>
            <View style={s.lotusCol}>
              <LotusPacer size={170} accent={STATES[0].accent} variant="volumetric" />
              <Text style={s.lotusLabel}>2 · 3D-blaadjes, volle rotatie</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  safe: { flex: 1 },
  back: {
    width: 40,
    height: 40,
    marginLeft: 10,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 20,
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 24,
    paddingHorizontal: 10,
  },
  swatchCol: { alignItems: 'center', gap: 6 },
  swatchLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.5)',
  },
  lotusSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  lotusRow: {
    flexDirection: 'row',
    gap: 18,
  },
  lotusCol: { alignItems: 'center', gap: 8 },
  lotusLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
});
