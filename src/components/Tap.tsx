/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Tap: de standaard knop (23 okt 2026, operator: "ultra premium, consistentie is key").

   Drop-in voor `Pressable`, met overal dezelfde tikbeweging (zie constants/motion.ts): indrukken = krimpen met een
   strakke veer, loslaten = terugveren met een kleine nasprong. Eigenschappen van Pressable blijven werken
   (hitSlop, android_ripple, disabled, accessibility…). Een `style`-functie ({pressed}) wordt vastgezet op
   "niet ingedrukt": de beweging doet nu het indrukken-effect, overal gelijk.

   Veiligheid: popups sluiten vaak op dezelfde tik. De veer wordt bij het verdwijnen van de knop direct gestopt,
   anders loopt Reanimated tegen een al afgebroken view aan (eerder de "Should not already be working"-crash).
   ───────────────────────────────────────────────────────────────────────── */

import { useEffect } from 'react';
import { Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SPRING_PRESS_IN, SPRING_PRESS_OUT } from '@/constants/motion';
import { hapticTap } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  /** Hoe ver de knop krimpt: grote knoppen/kaarten 0,97, gewone 0,95, kleine iconen 0,9. */
  scaleTo?: number;
  /** Lichte tik bij de tik zelf (standaard aan, overal gelijk). Uit enkel voor iets dat geen knop is. */
  haptic?: boolean;
};

export default function Tap({ style, scaleTo = 0.95, haptic = true, onPress, onPressIn, onPressOut, children, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => () => cancelAnimation(scale), [scale]);
  const resolved = typeof style === 'function' ? style({ pressed: false, hovered: false } as PressableStateCallbackType) : style;
  return (
    <AnimatedPressable
      {...rest}
      style={[resolved, animated]}
      onPress={
        onPress
          ? (e) => {
              if (haptic) hapticTap();
              onPress(e);
            }
          : undefined
      }
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, SPRING_PRESS_IN);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING_PRESS_OUT);
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
