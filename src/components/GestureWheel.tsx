/* Draaiwiel op Gesture Handler + Reanimated (30 okt 2026, operator: "de scroll werkt gewoon niet, maak opnieuw").

   Waarom niet meer de ScrollView-versie (DurationWheel) in een blad: het blad (GlassSheetHost) sluit door naar
   beneden te vegen met een JS-PanResponder, en een ScrollView-wiel daarin moest de aanraking "claimen" om dat te
   voorkomen. Bij een snelle veeg won het wiel, bij een rustige vinger blokkeerde diezelfde claim het scrollen — het
   wiel bevroor. Dit wiel heeft geen ScrollView: een Pan-gebaar op de UI-thread (zoals de duurcirkel, die in hetzelfde
   blad wél goed werkt) volgt de vinger, loopt uit met momentum en klikt vast op de dichtstbijzijnde rij. Het
   native gebaar wint altijd van de JS-PanResponder van het blad, dus vegen om te sluiten werkt nog naast het wiel.

   Zelfde look als DurationWheel (UIPickerView-gevoel): gevulde pil in de toestandskleur, rijen die naar de rand
   kleiner worden, vervagen en wegdraaien; een tik per rij die voorbijkomt. */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { BrandFonts } from '@/constants/theme';
import { hapticTick } from '@/utils/haptics';

export const GESTURE_WHEEL_ITEM_H = 44;
const SNAP = { damping: 26, stiffness: 260, mass: 0.6 } as const;

function Row({
  index,
  label,
  offset,
  rows,
  fontSize,
}: {
  index: number;
  label: string;
  offset: SharedValue<number>;
  rows: number;
  fontSize: number;
}) {
  const style = useAnimatedStyle(() => {
    /* offset = scrollpositie in px (index × hoogte = die rij in het midden). */
    const d = (index * GESTURE_WHEEL_ITEM_H - offset.value) / (GESTURE_WHEEL_ITEM_H * ((rows + 1) / 2));
    const n = Math.max(-1, Math.min(1, d));
    return {
      opacity: Math.max(0.12, 1 - Math.abs(n) * 0.85),
      transform: [
        { translateY: index * GESTURE_WHEEL_ITEM_H - offset.value },
        { perspective: 800 },
        { rotateX: `${n * 38}deg` },
        { scale: interpolate(Math.abs(n), [0, 1], [1, 0.68], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <Animated.View style={[gs.row, style]} pointerEvents="none">
      <Text style={[gs.rowTxt, { fontSize }]}>{label}</Text>
    </Animated.View>
  );
}

export default function GestureWheel({
  options,
  value,
  onChange,
  accent,
  rows = 3,
  fontSize = 22,
}: {
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
  accent: string;
  /** Zichtbare rijen (oneven). */
  rows?: number;
  fontSize?: number;
}) {
  const maxIndex = Math.max(0, options.length - 1);
  const indexOf = (v: number) => Math.max(0, options.findIndex((o) => o.value === v));
  const offset = useSharedValue(indexOf(value) * GESTURE_WHEEL_ITEM_H);
  const start = useSharedValue(0);
  const lastTick = useSharedValue(indexOf(value));
  const maxOffset = maxIndex * GESTURE_WHEEL_ITEM_H;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const commit = (idx: number) => {
    const o = optionsRef.current[idx];
    if (o) onChangeRef.current(o.value);
  };

  /* Waarde van buiten (bv. ander dagdeel) → wiel springt mee. */
  const valueIdx = indexOf(value);
  useEffect(() => {
    const target = valueIdx * GESTURE_WHEEL_ITEM_H;
    if (Math.abs(offset.value - target) > 1) offset.value = withSpring(target, SNAP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueIdx, options.length]);

  /* Enkel de rijen rond het midden tekenen (State Control: 288 tijden per dag). */
  const [center, setCenter] = useState(indexOf(value));
  /* Een tik per rij die het midden passeert, en het venster schuift mee. */
  useAnimatedReaction(
    () => Math.round(offset.value / GESTURE_WHEEL_ITEM_H),
    (idx) => {
      if (idx !== lastTick.value && idx >= 0 && idx <= maxIndex) {
        lastTick.value = idx;
        scheduleOnRN(hapticTick);
        scheduleOnRN(setCenter, idx);
      }
    },
    [maxIndex],
  );
  const span = rows + 4;
  const from = Math.max(0, center - span);
  const to = Math.min(maxIndex, center + span);

  const settle = (fromOffset: number) => {
    'worklet';
    const idx = Math.max(0, Math.min(maxIndex, Math.round(fromOffset / GESTURE_WHEEL_ITEM_H)));
    offset.value = withSpring(idx * GESTURE_WHEEL_ITEM_H, SNAP);
    scheduleOnRN(commit, idx);
  };

  const pan = Gesture.Pan()
    /* Enkel verticaal; een horizontale veeg gaat door naar de rest. */
    .activeOffsetY([-6, 6])
    .failOffsetX([-24, 24])
    .onBegin(() => {
      start.value = offset.value;
    })
    .onUpdate((e) => {
      const next = start.value - e.translationY;
      /* Rubberband voorbij het begin/einde. */
      offset.value =
        next < 0 ? next / 3 : next > maxOffset ? maxOffset + (next - maxOffset) / 3 : next;
    })
    .onEnd((e) => {
      const v = -e.velocityY;
      if (Math.abs(v) < 60) {
        settle(offset.value);
        return;
      }
      offset.value = withDecay(
        { velocity: v, deceleration: 0.996, clamp: [0, maxOffset] },
        (finished) => {
          if (finished) settle(offset.value);
        },
      );
    });

  /* Tik boven of onder het midden = één rij verder. */
  const tap = Gesture.Tap().onEnd((e) => {
    const mid = (GESTURE_WHEEL_ITEM_H * rows) / 2;
    const steps = Math.round((e.y - mid) / GESTURE_WHEEL_ITEM_H);
    if (steps === 0) return;
    const cur = Math.round(offset.value / GESTURE_WHEEL_ITEM_H);
    settle((cur + steps) * GESTURE_WHEEL_ITEM_H);
  });

  const height = GESTURE_WHEEL_ITEM_H * rows;
  return (
    <GestureHandlerRootView style={{ flex: 0 }}>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View style={[gs.wrap, { height }]} accessibilityRole="adjustable" accessibilityValue={{ text: options[valueIdx]?.label }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const next = valueIdx + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
            if (next >= 0 && next <= maxIndex) commit(next);
          }}
        >
          <View
            pointerEvents="none"
            style={[
              gs.pill,
              {
                top: (height - GESTURE_WHEEL_ITEM_H) / 2 - 3,
                /* 31 okt 2026 (operator: "omlijning van de pil van tijd moet weg"): enkel de tint. */
                backgroundColor: `${accent}3D` /* lichtste glas, gelijk aan de vulling van de duurcirkel (31 okt 2026) */,
              },
            ]}
          />
          <View style={[gs.track, { top: (height - GESTURE_WHEEL_ITEM_H) / 2 }]} pointerEvents="none">
            {options.slice(from, to + 1).map((o, k) => (
              <Row key={o.value} index={from + k} label={o.label} offset={offset} rows={rows} fontSize={fontSize} />
            ))}
          </View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const gs = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden' },
  pill: {
    position: 'absolute',
    left: 92,
    right: 92,
    height: GESTURE_WHEEL_ITEM_H + 6,
    borderRadius: (GESTURE_WHEEL_ITEM_H + 6) / 2,
  },
  track: { position: 'absolute', left: 0, right: 0, height: GESTURE_WHEEL_ITEM_H },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: GESTURE_WHEEL_ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTxt: { fontFamily: BrandFonts.semibold, color: '#ffffff' },
});
