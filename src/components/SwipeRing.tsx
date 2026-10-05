/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — een cirkel die je doorveegt

   Zelfde gebaar als de modus-cirkel van State Control (bracelet-control.tsx,
   `ModeSwipeRing`), nu algemeen: links/rechts vegen = volgende/vorige keuze
   (de cirkel volgt je vinger, schuift weg en de nieuwe schuift binnen),
   tikken = info. Aan de uiteinden rekt hij even mee en veert terug — geen
   rondloop. Gesture Handler + Reanimated: volgen, loslaten en terugveren
   gebeuren op de UI-thread; enkel de wissel zelf gaat naar JS.
   Operator, 5 okt 2026: de drie technieken op de ademsessie-setup.
   ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SWIPE_DISTANCE = 320;

export function SwipeRing({
  count,
  index,
  onChange,
  onTap,
  accessibilityLabel,
  still = false,
  children,
}: {
  count: number;
  index: number;
  /** `dir`: 1 = naar de volgende geveegd (naar links), -1 = naar de vorige. */
  onChange: (next: number, dir: number) => void;
  /** Operator, 5 okt 2026 ("de cirkel moet één cirkel blijven, enkel de
   *  technieken scrollbaar"): de cirkel zelf blijft staan; enkel de
   *  inhoud die de ouder per keuze wisselt beweegt (zie `dir`). */
  still?: boolean;
  onTap: () => void;
  accessibilityLabel: string;
  children: ReactNode;
}) {
  const last = count - 1;
  const x = useSharedValue(0);
  const indexSV = useSharedValue(index);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  /* De nieuwe keuze schuift pas binnen NADAT React hem getekend heeft. */
  const pendingDirRef = useRef(0);

  useEffect(() => {
    indexSV.value = index;
    const dir = pendingDirRef.current;
    if (dir !== 0 && still) {
      pendingDirRef.current = 0;
    } else if (dir !== 0) {
      pendingDirRef.current = 0;
      x.value = dir * SWIPE_DISTANCE;
      x.value = withSpring(0, { damping: 22, stiffness: 190, mass: 0.9 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const commit = (next: number, dir: number) => {
    pendingDirRef.current = dir;
    onChangeRef.current(next, dir);
  };
  const tapJS = () => onTapRef.current();

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      const i = indexSV.value;
      const atEdge = (e.translationX > 0 && i === 0) || (e.translationX < 0 && i === last);
      const t = still ? 0 : e.translationX;
      x.value = atEdge ? t * 0.25 : t;
    })
    .onEnd((e) => {
      const i = indexSV.value;
      const dir =
        e.translationX < -40 || e.velocityX < -500 ? 1 : e.translationX > 40 || e.velocityX > 500 ? -1 : 0;
      const next = i + dir;
      if (dir === 0 || next < 0 || next > last) {
        x.value = withSpring(0, { damping: 18, stiffness: 240 });
        return;
      }
      if (still) {
        /* Cirkel veert terug op zijn plek; de wissel zelf meteen. */
        x.value = withSpring(0, { damping: 20, stiffness: 260 });
        runOnJS(commit)(next, dir);
        return;
      }
      x.value = withTiming(-dir * SWIPE_DISTANCE, { duration: 130 }, (finished) => {
        if (finished) runOnJS(commit)(next, dir);
      });
    });
  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd((_e, success) => {
      if (success) runOnJS(tapJS)();
    });
  const gesture = Gesture.Exclusive(pan, tap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    opacity: still ? 1 : interpolate(Math.abs(x.value), [0, SWIPE_DISTANCE], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    /* flex: 0 — standaard rekt de root zich uit (flex: 1). */
    <GestureHandlerRootView style={{ flex: 0 }}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={style}
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'activate') onTap();
            else if (e.nativeEvent.actionName === 'increment' && index < last) onChange(index + 1, 1);
            else if (e.nativeEvent.actionName === 'decrement' && index > 0) onChange(index - 1, -1);
          }}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

/** Witte stipjes onder de cirkel: welke van de N je bekijkt. */
export function SwipeDots({ count, index }: { count: number; index: number }) {
  if (count < 2) return null;
  return (
    <View style={s.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[s.dot, i === index && s.dotOn]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginTop: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotOn: { backgroundColor: '#ffffff' },
});
