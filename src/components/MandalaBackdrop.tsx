/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — MandalaBackdrop

   Operator 2026-07-31: "op de achtergrond van de header mag je de mandala
   zetten, mooi en subtiel."

   Dezelfde figuur als op scherm 1, maar hier is het decor en geen onderwerp.
   Dat verandert wat je weglaat, niet wat je toevoegt:

     GEEN VERVAGING   De gloedlagen van de grote versie kosten het meest en
                      zijn op deze dekking toch onzichtbaar. Alleen haarlijnen
     GEEN MAANVORM    De gevulde vorm in het hart zou precies achter de tekst
                      komen te zitten en die onleesbaar maken
     TRAAG            Een halve minuut per omwenteling. Achtergrond die je
                      ziet bewegen is geen achtergrond meer

   Wel de ademhaling, want daar draait de app om — en die is op deze schaal
   nauwelijks te zien maar wel te voelen.
   ───────────────────────────────────────────────────────────────────────── */

import {
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { buildMandala } from './mandala-geometry';

const TAU = Math.PI * 2;

type Props = {
  size: number;
  /** Hoe sterk de lijnen doorkomen. Bewust laag: dit mag de tekst nooit
   *  beconcurreren. */
  intensity?: number;
  color?: string;
};

export default function MandalaBackdrop({
  size,
  intensity = 1,
  color = '#ffffff',
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34;
  const thin = size * 0.0045;

  const geo = useMemo(() => buildMandala(R), [R]);

  const spin = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: 34000, easing: Easing.linear }),
      -1,
      false,
    );
    breath.value = withRepeat(
      withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [spin, breath]);

  const transform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { rotate: spin.value * TAU },
    { scale: 0.94 + breath.value * 0.06 },
  ]);

  const lineOpacity = useDerivedValue(
    () => intensity * (0.3 + breath.value * 0.14),
  );
  const glowOpacity = useDerivedValue(
    () => intensity * (0.11 + breath.value * 0.06),
  );

  return (
    /* Ook VERTICAAL centreren. Zonder dat zakt de figuur naar beneden weg:
       het omhullende vak is maar zo hoog als de tekst, terwijl de mandala
       veel groter is — die hangt dan ónder de kop i.p.v. erachter. */
    <View
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center' },
      ]}
      pointerEvents="none"
    >
      <View style={{ width: size, height: size }}>
        <Canvas style={{ flex: 1 }}>
          <Group blendMode="plus">
            {/* Zachte lichtbron in het hart — heldere kleur op lage dekking,
                anders wordt het tegen zwart een grijze waas. */}
            <Circle cx={cx} cy={cy} r={R} opacity={glowOpacity}>
              <RadialGradient
                c={vec(cx, cy)}
                r={R}
                colors={[color, color, '#00000000']}
                positions={[0, 0.08, 1]}
              />
            </Circle>

            <Group transform={transform}>
              <Path
                path={geo.seedsAll}
                style="stroke"
                strokeWidth={thin}
                color={color}
                opacity={lineOpacity}
              />
              <Path
                path={geo.outer}
                style="stroke"
                strokeWidth={thin}
                color={color}
                opacity={lineOpacity}
              />
            </Group>
          </Group>
        </Canvas>
      </View>
    </View>
  );
}
