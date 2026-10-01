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
   overstemmen (operator 2026-07-31).
   Nog trager gezet op 3 augustus 2026, voor scherm 3 en 4. Deze golven staan
   voor haptiek die je aan je pols voelt, en dat is geen snelle tik maar een
   trage deining — op ruim drie seconden las het als een signaal in plaats van
   als een gevoel. */
const PULSE_MS = 5200;

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
  /** Aantal ringen tegelijk onderweg. Standaard 4 (RINGS) staat garant voor
   *  "er is altijd één onderweg" — precies wat op een klein, druk kaartje
   *  juist als "continu zichtbaar" leest in plaats van als losse klop
   *  (operator, 10 augustus 2026). Lager = duidelijker losse pulsen met
   *  stilte ertussen. */
  ringCount?: number;
  /** Vervaagt de rand van de ring. Standaard 1.2; lager oogt scherper op
   *  een klein vlak (operator, 10 augustus 2026: "blauw moet scherper, nu
   *  heel dof"). */
  blur?: number;
  /** Duur van één klop in ms. Standaard PULSE_MS (5200, "een trage deining
   *  aan de pols"). Overschrijfbaar per instantie (operator, 10 augustus
   *  2026: "haptics moet beetje sneller"). */
  pulseMs?: number;
  /** Vermenigvuldigt de streepdikte van de ringen. Standaard 1 (ongewijzigd
   *  gedrag op alle bestaande schermen). Lager voor een fijnere, ijlere
   *  lijn op een klein vlak (operator, 11 augustus 2026: "haptics moeten
   *  fijner"). */
  strokeScale?: number;
};

function Ring({
  index,
  count,
  pulse,
  cx,
  cy,
  r0,
  r1,
  color,
  strokeWidth,
  intensity,
  blur,
}: {
  index: number;
  count: number;
  pulse: SharedValue<number>;
  cx: number;
  cy: number;
  r0: number;
  r1: number;
  color: string;
  strokeWidth: number;
  intensity: number;
  blur: number;
}) {
  const phase = useDerivedValue(() => {
    'worklet';
    const f = pulse.value - index / count;
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
      <BlurMask blur={blur} style="normal" />
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
  ringCount = RINGS,
  blur = 1.2,
  pulseMs = PULSE_MS,
  strokeScale = 1,
}: Props) {
  const cx = width * originX;
  const cy = height * originY;

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: pulseMs, easing: Easing.linear }),
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
          {Array.from({ length: ringCount }).map((_, i) => (
            <Ring
              key={i}
              index={i}
              count={ringCount}
              pulse={pulse}
              cx={cx}
              cy={cy}
              r0={width * reach * 0.1}
              r1={width * reach}
              color={color}
              strokeWidth={
                Math.max(0.9, width * 0.0028 * intensity) * strokeScale
              }
              intensity={intensity}
              blur={blur}
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
