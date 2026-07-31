/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — PodPulse

   Operator 2026-07-31: "ook haptic puls animeren op de zwarte pod."

   Ringen die uit het zwarte kastje van de bracelet naar buiten schieten.
   Zelfde taal als de haptische ringen op scherm 2, maar hier bovenop een
   foto in plaats van in een eigen figuur.

   Waarom een klop en geen golf: haptiek plant zich niet gelijkmatig voort.
   De ringen schieten snel weg en rollen daarna uit — dat is het verschil
   tussen iets horen en iets voelen. Ze doven ook lang uit, zodat er altijd
   één onderweg is zonder dat het roffelt.
   ───────────────────────────────────────────────────────────────────────── */

import { BlurMask, Canvas, Circle, Group } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const RINGS = 4;
/* Rustiger dan de ringen op scherm 2: dit ligt over een foto en mag die niet
   overstemmen (operator 2026-07-31). */
const PULSE_MS = 3400;

type Props = {
  /** Maat van het vlak waarop de foto ligt. */
  width: number;
  height: number;
  /** Waar het kastje zit, als fractie van dat vlak. */
  originX?: number;
  originY?: number;
  /** Hoe ver de ringen reiken, als fractie van de breedte. Kleiner houden
   *  wanneer het beeld eronder groter wordt — anders overstemt de klop het
   *  product. */
  reach?: number;
  /** Hoe sterk de klop doorkomt. Boven een foto moet hij harder aanzetten
   *  dan boven zwart — daar concurreert hij met alles wat eronder ligt. */
  intensity?: number;
  color?: string;
};

function Ring({
  index,
  pulse,
  cx,
  cy,
  r0,
  r1,
  color,
  strokeWidth,
  intensity,
}: {
  index: number;
  pulse: SharedValue<number>;
  cx: number;
  cy: number;
  r0: number;
  r1: number;
  color: string;
  strokeWidth: number;
  intensity: number;
}) {
  const phase = useDerivedValue(() => {
    'worklet';
    const f = pulse.value - index / RINGS;
    return f - Math.floor(f);
  });

  const radius = useDerivedValue(() => {
    'worklet';
    /* Snel weg, dan uitrollen. Gelijkmatig zou mechanisch ogen. */
    const e = 1 - Math.pow(1 - phase.value, 2.6);
    return r0 + (r1 - r0) * e;
  });

  const opacity = useDerivedValue(() => {
    'worklet';
    const p = phase.value;
    const rise = Math.min(1, p / 0.07);
    return Math.min(1, rise * Math.pow(1 - p, 1.5) * 0.8 * intensity);
  });

  return (
    <Circle
      cx={cx}
      cy={cy}
      r={radius}
      style="stroke"
      strokeWidth={strokeWidth}
      color={color}
      opacity={opacity}
    >
      <BlurMask blur={1.2} style="normal" />
    </Circle>
  );
}

export default function PodPulse({
  width,
  height,
  originX = 0.5,
  originY = 0.58,
  reach = 0.24,
  intensity = 1,
  /* Diep blauw i.p.v. lichtblauw: fijner van lijn en dieper van kleur leest
     als precisie, lichtblauw en dik leest als waarschuwing (operator
     2026-07-31). */
  color = '#2E6BD8',
}: Props) {
  const cx = width * originX;
  const cy = height * originY;

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [pulse]);

  /* Het lampje op het kastje ademt mee met de klop. */
  const coreOpacity = useDerivedValue(() => {
    'worklet';
    const p = pulse.value - Math.floor(pulse.value);
    return 0.4 + 0.6 * Math.pow(1 - p, 4);
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        <Group blendMode="plus">
          {Array.from({ length: RINGS }).map((_, i) => (
            <Ring
              key={i}
              index={i}
              pulse={pulse}
              cx={cx}
              cy={cy}
              r0={width * reach * 0.1}
              r1={width * reach}
              color={color}
              strokeWidth={Math.max(0.9, width * 0.0028 * intensity)}
              intensity={intensity}
            />
          ))}

          <Circle
            cx={cx}
            cy={cy}
            r={width * 0.008}
            color={color}
            opacity={coreOpacity}
          >
            <BlurMask blur={6} style="normal" />
          </Circle>
        </Group>
      </Canvas>
    </View>
  );
}
