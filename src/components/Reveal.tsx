/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Reveal: dé instroom-animatie van de hele app (24 okt 2026, operator: "dezelfde animatie
   als choose your mode in breathwork, op ALLE schermen, en opnieuw bij terugkomen").

   - <Reveal i={n}>     : speelt één keer bij het monteren (stackschermen, popups, lijsten).
   - <TabReveal i={n}>  : speelt OPNIEUW elke keer dat de tab de focus krijgt (tabs blijven gemonteerd, dus
                          een gewone `entering` speelt maar één keer en liet terugkomen statisch).

   Zelfde bewegingstaal als de Breath-kiezer: blok veert 25 dp van ONDER omhoog naar zijn plek (exact Reanimated's FadeInDown: translateY 25 → 0) en vervaagt in, veer
   stiffness 170 / damping 18, staffel 70 ms per blok (i = volgorde van boven naar onder, max. 8).
   Draait op de UI-thread; "beweging verminderen" slaat de animatie over.
   Zet `style` op de Reveal ZELF enkel voor layout (breedte, marges); een eigen animated transform/opacity hoort
   op een kind-view, anders overschrijven ze elkaar.
   ───────────────────────────────────────────────────────────────────────── */

import { useIsFocused } from '@react-navigation/native';
import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { isReduceMotion } from '@/constants/motion';

const SPRING = { stiffness: 170, damping: 18, mass: 1 } as const;
const RISE = 25;

type Props = {
  /** Volgorde van boven naar onder (0 = eerst). */
  i?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

function useReveal(i: number, play: boolean) {
  const k = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(k);
    if (!play) {
      k.value = 0;
      return;
    }
    if (isReduceMotion()) {
      k.value = 1;
      return;
    }
    k.value = 0;
    k.value = withDelay(40 + Math.min(i, 8) * 70, withSpring(1, SPRING));
    return () => cancelAnimation(k);
  }, [play, i, k]);
  return useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, k.value)),
    transform: [{ translateY: RISE * (1 - k.value) }],
  }));
}

export function Reveal({ i = 0, style, children }: Props) {
  const anim = useReveal(i, true);
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

export function TabReveal({ i = 0, style, children }: Props) {
  const focused = useIsFocused();
  const anim = useReveal(i, focused);
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

export default Reveal;
