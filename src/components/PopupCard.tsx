/* Kaart van een popup/alert: komt met dezelfde veer in beeld (constants/motion.ts → POPUP_IN).
   `PopupCard` vangt taps op de kaart op (ze mogen de achtergrond niet sluiten); `PopupView` is dezelfde
   beweging voor een gewone kaart zonder tik. */
import { Pressable, type PressableProps, type ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { POPUP_IN } from '@/constants/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PopupCard({ children, ...rest }: PressableProps) {
  return (
    <AnimatedPressable entering={POPUP_IN} onPress={() => {}} {...rest}>
      {children}
    </AnimatedPressable>
  );
}

export function PopupView({ children, ...rest }: ViewProps) {
  return (
    <Animated.View entering={POPUP_IN} {...rest}>
      {children}
    </Animated.View>
  );
}
