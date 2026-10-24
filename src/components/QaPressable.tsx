/* Pressable die in een testbuild zijn uitweg-label en positie meldt aan het QA-meetpunt (utils/qa-probe.ts). Buiten testmodus is
   dit exact een gewone Pressable. Alle knop-componenten die een uitweg (Back/Close/Cancel/…) kunnen dragen lopen hierdoor. */
import { forwardRef, useEffect, useRef } from 'react';
import { PixelRatio, Pressable, StatusBar, View, type PressableProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { QA_ENABLED } from '@/utils/qa';
import { QA_EXIT_RE, qaExit, qaPos } from '@/utils/qa-probe';

export const QaPressable = forwardRef<View, PressableProps>(function QaPressable(props, ref) {
  const inner = useRef<View | null>(null);
  const label = props.accessibilityLabel;
  useEffect(() => {
    qaExit(label, 1);
    return () => qaExit(label, -1);
  }, [label]);
  const track = QA_ENABLED && !!label && QA_EXIT_RE.test(label);
  return (
    <Pressable
      {...props}
      ref={(n) => {
        inner.current = n;
        if (typeof ref === 'function') ref(n);
        else if (ref) (ref as { current: View | null }).current = n;
      }}
      onLayout={(e) => {
        if (track) {
          inner.current?.measureInWindow((x, y, w, h) => {
            const r = PixelRatio.get();
            qaPos(label!, (x + w / 2) * r, (y + h / 2 + (StatusBar.currentHeight ?? 0)) * r);
          });
        }
        props.onLayout?.(e);
      }}
    />
  );
});

export const QaAnimatedPressable = Animated.createAnimatedComponent(QaPressable);
