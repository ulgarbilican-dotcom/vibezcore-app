/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — AuroraGlow

   Operator, 21 september 2026 ("glassmorphic achtergronden... een zachte
   bewegende kleuren-gloed achter je kaarten, zodat die kleur high-tech en
   premium door het matglas heen schijnt"): schermvullende versie van
   AmbientGlow.tsx (zelfde bewezen Skia-techniek: additief licht,
   RadialGradient + BlurMask, niet-deelbare drift-periodes zodat het beeld
   nooit exact herhaalt) — twee verschillen bewust:

   1. Schermvullend i.p.v. een klein vast vierkant, zodat de gloed ECHT
      achter een volledige kaarten-grid kan zitten, niet enkel een centraal
      beeld.
   2. ÉÉN kleur (`color`-prop) i.p.v. AmbientGlow's vaste koele blauw-wit —
      hier de accentkleur van het geselecteerde doel, of een neutrale
      terugval.

   Bewust GEEN kleurrijke multi-hue "regenboog"-aurora: de vastgelegde
   art-direction (`ambient-tokens.ts`, operator 30 juli 2026) verbiedt felle
   kleuren expliciet — "NIET: Calm, Headspace, Meditopia, die zijn te
   wellness". Eén gedempte, sterk getemperde kleur per keer geeft het
   premium "doorschijnend licht"-effect zonder die associatie. */

import { useEffect } from 'react';
import { View } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const BREATH_CYCLE_MS = 9000;
/* Niet-deelbaar op elkaar (zelfde principe als DRIFT in ambient-tokens.ts)
   zodat de twee lagen nooit synchroon lopen. */
const DRIFT_A_MS = 26000;
const DRIFT_B_MS = 19000;

/** Hex + alpha-suffix (2 hex-cijfers) — zelfde patroon als elders in de app
 *  (`${accent}55` etc.), hier voor de Skia-kleurstops. */
const withAlpha = (hex: string, alpha: string) => `${hex}${alpha}`;

export default function AuroraGlow({
  color,
  width,
  height,
}: {
  /** Volle hex-kleur (bv. het doel-accent) — draagt de hele gloed. */
  color: string;
  width: number;
  height: number;
}) {
  const cx = width / 2;
  const cy = height * 0.32;

  const breath = useSharedValue(0);
  const driftA = useSharedValue(0);
  const driftB = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: BREATH_CYCLE_MS / 2, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    driftA.value = withRepeat(
      withTiming(1, { duration: DRIFT_A_MS, easing: Easing.linear }),
      -1,
      false,
    );
    driftB.value = withRepeat(
      withTiming(1, { duration: DRIFT_B_MS, easing: Easing.linear }),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Laag 1 — buitenste haze, groot en gedempt, geeft diepte. */
  const hazeR = useDerivedValue(() => width * (0.55 + breath.value * 0.08));
  const hazeOpacity = useDerivedValue(() => 0.16 + breath.value * 0.08);

  /* Laag 2 — volume, drift traag rond, asymmetrisch zodat het als licht
     leest i.p.v. als een keurige cirkel. */
  const volCx = useDerivedValue(() => cx + Math.cos(driftA.value * Math.PI * 2) * width * 0.08);
  const volCy = useDerivedValue(() => cy + Math.sin(driftB.value * Math.PI * 2) * height * 0.05);
  const volR = useDerivedValue(() => width * (0.4 + breath.value * 0.1));
  const volOpacity = useDerivedValue(() => 0.18 + breath.value * 0.14);

  /* Laag 3 — kern, klein en helder wit, draagt de "ademhaling". */
  const coreCx = useDerivedValue(() => cx - Math.cos(driftB.value * Math.PI * 2) * width * 0.05);
  const coreR = useDerivedValue(() => width * (0.14 + breath.value * 0.06));
  const coreOpacity = useDerivedValue(() => 0.14 + breath.value * 0.18);

  return (
    <View style={{ width, height }} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        <Group blendMode="plus">
          <Group opacity={hazeOpacity}>
            <Circle cx={cx} cy={cy} r={hazeR}>
              <RadialGradient
                c={vec(cx, cy)}
                r={width * 0.6}
                colors={[withAlpha(color, 'ff'), withAlpha(color, '00')]}
              />
              <BlurMask blur={70} style="normal" />
            </Circle>
          </Group>

          <Group opacity={volOpacity}>
            <Circle cx={volCx} cy={volCy} r={volR}>
              <RadialGradient
                c={vec(cx, cy)}
                r={width * 0.4}
                colors={[withAlpha(color, 'ff'), withAlpha(color, '00')]}
              />
              <BlurMask blur={54} style="normal" />
            </Circle>
          </Group>

          <Group opacity={coreOpacity}>
            <Circle cx={coreCx} cy={cy} r={coreR}>
              <RadialGradient
                c={vec(cx, cy)}
                r={width * 0.2}
                colors={['#ffffffff', '#ffffff00']}
              />
              <BlurMask blur={40} style="normal" />
            </Circle>
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}
