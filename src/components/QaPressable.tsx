/* Pressable die in een testbuild zijn uitweg-label en positie meldt aan het QA-meetpunt (utils/qa-probe.ts). Buiten testmodus is
   dit exact een gewone Pressable. Alle knop-componenten die een uitweg (Back/Close/Cancel/…) kunnen dragen lopen hierdoor. */
import { forwardRef, useEffect, useRef } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { qaExit } from '@/utils/qa-probe';

export const QaPressable = forwardRef<View, PressableProps>(function QaPressable(props, ref) {
  const inner = useRef<View | null>(null);
  const label = props.accessibilityLabel;
  useEffect(() => {
    qaExit(label, 1, inner);
    return () => qaExit(label, -1);
  }, [label]);
  return (
    <Pressable
      {...props}
      ref={(n) => {
        inner.current = n;
        if (typeof ref === 'function') ref(n);
        else if (ref) (ref as { current: View | null }).current = n;
      }}
    />
  );
});

export const QaAnimatedPressable = Animated.createAnimatedComponent(QaPressable);
