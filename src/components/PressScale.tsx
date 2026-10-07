/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — één tik-gevoel voor alle knoppen (operator, 7 okt 2026:
   "de overgangen bij aantikken van de knoppen en CTA's moeten heel smooth,
   Apple-niveau").

   Exact de curve van de Start-knop en PressableScale (bracelet-control),
   zodat elke knop hetzelfde aanvoelt: indrukken = in 80 ms licht krimpen
   en dimmen, loslaten = terugveren (spring 220 ms, damping 0,73). Op de
   UI-thread (Reanimated), dus vloeiend ook als JS druk is. Geen abrupte
   opacity-sprong meer zoals bij een kale `pressed && { opacity }`.

   `haptic`: een lichte tik bij indrukken — voor hoofdknoppen (Start,
   Continue), niet voor elke kleine knop. */

import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Hoe ver de knop krimpt. Grote knoppen 0,97, kleine 0,92. */
  scaleTo?: number;
  haptic?: boolean;
};

export default function PressScale({ style, children, scaleTo = 0.96, haptic = false, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: dim.value,
  }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animated]}
      onPressIn={(e) => {
        scale.value = withTiming(scaleTo, { duration: 80 });
        dim.value = withTiming(0.85, { duration: 90 });
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
        dim.value = withTiming(1, { duration: 150 });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
