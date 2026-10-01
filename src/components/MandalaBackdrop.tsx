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

   ── Fix 6 september 2026 ──────────────────────────────────────────────
   De rotatie/adem stonden origineel als Reanimated `useDerivedValue` op
   Skia's eigen `transform`/`opacity`-props. Getest op toestel (2x, ook op
   3s per omwenteling i.p.v. de bedoelde 30s): geen enkele beweging, zelfs
   niet na 10 seconden — de Canvas herschilderde niet op de klok. In plaats
   van verder te zoeken naar waarom Skia's eigen reactiviteit hier niet
   aansloeg, tekent de Canvas nu STATISCH (één keer, geen per-frame Skia-
   updates) en gebeurt de rotatie/adem op de OMRINGENDE View via gewoon
   Reanimated — hetzelfde bewezen-werkende patroon als de rest van de app
   (headBreath, orbFade, enz.). Lost het betrouwbaarheidsprobleem op zonder
   te hoeven uitzoeken WAT er precies mis was met de Skia-kant.
   ───────────────────────────────────────────────────────────────────────── */

import { Canvas, Circle, Group, Path, RadialGradient, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { buildMandala } from './mandala-geometry';

type Props = {
  size: number;
  /** Hoe sterk de lijnen doorkomen. Bewust laag: dit mag de tekst nooit
   *  beconcurreren. */
  intensity?: number;
  color?: string;
  /** Lichte achtergrond i.p.v. donker (operator, 6 september 2026). Additief
   *  mengen ('plus') telt op tot wit tegen wit — dus onzichtbaar; in lichte
   *  stand valt dat weg en gaat de dekking iets omhoog zodat de haarlijnen
   *  zelfstandig zichtbaar blijven. */
  light?: boolean;
};

export default function MandalaBackdrop({
  size,
  intensity = 1,
  color = '#ffffff',
  light = false,
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

  /* Rotatie + adem-schaal nu op de View, niet meer op Skia's eigen
     transform-prop (zie toelichting bovenaan). */
  const spinStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${spin.value * 360}deg` },
      { scale: 0.94 + breath.value * 0.06 },
    ],
  }));
  /* Adem-opacity ook op de View — geldt dan voor lijnen én gloed samen
     i.p.v. apart, een kleine vereenvoudiging t.o.v. de vorige twee losse
     Skia-opacities, niet zichtbaar op deze schaal/dekking. */
  const breathOpacityStyle = useAnimatedStyle(() => ({
    opacity: 0.85 + breath.value * 0.15,
  }));

  const lineOpacity = light ? intensity * 0.67 : intensity * 0.37;
  const glowOpacity = intensity * 0.14;
  const plusBlend = light ? undefined : 'plus';

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
      <Animated.View style={[{ width: size, height: size }, breathOpacityStyle]}>
        {/* Statische gloed in het hart, buiten de rotatie (een gloed heeft
           geen richting). */}
        <Canvas style={StyleSheet.absoluteFill}>
          <Group blendMode={plusBlend}>
            <Circle cx={cx} cy={cy} r={R} opacity={glowOpacity}>
              <RadialGradient
                c={vec(cx, cy)}
                r={R}
                colors={[color, color, '#00000000']}
                positions={[0, 0.08, 1]}
              />
            </Circle>
          </Group>
        </Canvas>

        {/* De rozet zelf: statisch getekend, ROTEERT via de omringende
           Animated.View hieronder. */}
        <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Group blendMode={plusBlend}>
              <Group transform={[{ translateX: cx }, { translateY: cy }]}>
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
        </Animated.View>
      </Animated.View>
    </View>
  );
}
