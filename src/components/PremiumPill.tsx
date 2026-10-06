/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — vaste "Premium"-ingang bovenaan de hoofdtabs (6 okt 2026).

   Operator: "nu is dat bijna onmogelijk om in één opslag te zien of te
   vinden, het is bijna overal via popup". Apple (HIG, Auto-renewable
   subscriptions): "make it easy for people to subscribe at any time" — de
   pop-ups bij vergrendelde inhoud blijven, maar wie wil kopen zonder eerst
   ergens op vast te lopen, vindt het hier in één tik.

   Enkel op Breath, Library en State Control, enkel voor wie nog geen
   Premium heeft. Opent het bestaande abonnementsscherm (/subscribe).
   Wijkt voor de geminimaliseerde sessie-pil (zelfde plek bovenaan) en voor
   schermen zonder tabbalk (lopende sessie, State Control-keuzescherm).
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';
import { getBraceletSessionSnapshot, subscribeBraceletSession } from '@/services/bracelet-session-state';
import { getBreathHost, subscribeBreathHost } from '@/services/breath-session-host';
import { router, usePathname } from 'expo-router';
import { Crown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VibezGlass from './VibezGlass';

const AnimatedPressable = ReanimatedAnimated.createAnimatedComponent(Pressable);

/** De tabs waar de knop staat: Breath, Library ("/") en State Control. */
const TAB_PATHS = new Set(['/breath', '/', '/bracelet']);

export function PremiumPill({ hidden }: { hidden: boolean }) {
  const { isPro, isLoading } = useSubscription();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [bracelet, setBracelet] = useState(getBraceletSessionSnapshot());
  useEffect(() => subscribeBraceletSession(setBracelet), []);
  const [breathHost, setBreathHost] = useState(getBreathHost());
  useEffect(() => subscribeBreathHost(() => setBreathHost(getBreathHost())), []);

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (hidden || isLoading || isPro) return null;
  if (!TAB_PATHS.has(pathname)) return null;
  /* De sessie-pil (State Control of ademsessie) staat op dezelfde plek. */
  if (bracelet.active || breathHost?.minimized) return null;

  return (
    <View style={[s.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <AnimatedPressable
        style={pressStyle}
        onPress={() => router.push('/subscribe' as never)}
        onPressIn={() => {
          scale.value = withTiming(0.95, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go Premium — Breathwork, State Control and the Audio Library"
      >
        <VibezGlass radius={999} style={s.pill}>
          <Crown size={14} color={Brand.text} strokeWidth={2.2} />
          <Text style={s.label}>Premium</Text>
        </VibezGlass>
      </AnimatedPressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
    elevation: 30,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  label: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
