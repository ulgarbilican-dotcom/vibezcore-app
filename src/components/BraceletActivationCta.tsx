/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — BraceletActivationCta

   Iter 9dq v92 (2026-06-03): activatie-prompt strip die bovenaan de
   bracelet-control page verschijnt zolang een bracelet-owner zijn
   12-char activation-code nog niet heeft ingevoerd.

   Operator-rationale: "klant moet zelf activeren na sign-up. zolang de
   bracelet niet gelinkt is, ook een knop of link met 'activate your
   bracelet' op de control-page". De CTA is duidelijk maar onderbreekt
   de preview niet — gebruiker kan rondkijken vóór activatie.

   Visueel:
     - AccentTextOnDark-tint (Huisstijl v4.4: Signal Blue is voorbehouden
       voor haptic-pulse/BLE-status, niet voor deze CTA-strip)
     - "Activate your bracelet" + 1-regel sub-uitleg + chevron
     - Volledige row pressable → /activate-bracelet

   Render alleen wanneer (isBraceletOwner && !isActivated). De parent
   doet die check; deze component is "dom".
   ─────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts, AudioAccent } from '@/constants/theme';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { hapticPress } from '@/utils/haptics';

/* Standaardiseerde press-scale (2026-09-23) — zelfde curve als StartCard
   in breath-welcome.tsx. */
const AnimatedPressable = ReanimatedAnimated.createAnimatedComponent(Pressable);

export function BraceletActivationCta() {
  const scale = useSharedValue(1);
  const onPressIn = () => {
    scale.value = withTiming(0.97, { duration: 80 });
    hapticPress();
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 1 - (1 - scale.value) * 5,
  }));

  return (
    <AnimatedPressable
      style={[s.row, pressStyle]}
      onPress={() => router.navigate('/activate-bracelet' as never)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityLabel="Activate your bracelet with a code"
      android_ripple={{ color: 'rgba(110,133,196,0.10)' }}
    >
      <View style={s.left}>
        <Text style={s.title}>Activate your bracelet</Text>
        <Text style={s.sub}>
          Enter your 12-character code to link your bracelet
        </Text>
      </View>
      <Text style={s.arrow}>→</Text>
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(110, 133, 196, 0.10)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(110, 133, 196, 0.40)',
  },
  left: {
    flex: 1,
  },
  title: {
    color: AudioAccent,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  sub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  arrow: {
    color: AudioAccent,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
  },
});
