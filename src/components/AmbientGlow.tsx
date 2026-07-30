/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — AmbientGlow (onboarding slide 1)

   "Zwarte achtergrond. Een zeer zachte ademende lichtgloed. De gloed zet
   langzaam uit... en trekt weer samen. Alles beweegt extreem langzaam."

   Geen cirkel-outline, geen deeltjes, geen arcs. Alleen volumetrisch
   licht: vier zwaar geblurde radial gradients die additief over elkaar
   liggen. Elke laag drift op een eigen, niet-deelbare periode zodat het
   beeld nooit exact herhaalt — dat is het verschil tussen "levend" en
   "geanimeerd".

   Ademcyclus: 22s (11s uit, 11s samen). Bewust trager dan een echte
   ademhaling — dit is sfeer, geen instructie.
   ───────────────────────────────────────────────────────────────────────── */

import { AMBIENT, DRIFT } from '@/components/ambient-tokens';
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { View } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** Canvas-formaat in dp. Default 320. Op een 411dp-scherm oogt 300 te
   *  klein — gebruik minstens ~0.9 × schermbreedte voor de intro. */
  size?: number;
};

/* Volledige adem-cyclus. Eerder stond hier 22s — dat was te letterlijk
   genomen uit "extreem traag": wie drie seconden kijkt ziet dan niets
   bewegen en swipet weg. 7s leest als rustig én laat binnen één blik
   zien dat het beeld leeft. */
const BREATH_CYCLE_MS = 7000;

export default function AmbientGlow({ size = 320 }: Props) {
  const cx = size / 2;
  const cy = size / 2;

  /* `breath` pendelt 0→1→0 over de volledige cyclus. Eén bron voor alle
     lagen zodat ze per definitie samen ademen. */
  const breath = useSharedValue(0);
  /* Drie onafhankelijke drift-fasen. Niet-deelbare periodes → geen
     zichtbare herhaling in het samengestelde beeld. */
  const driftA = useSharedValue(0);
  const driftB = useSharedValue(0);
  const driftC = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, {
        duration: BREATH_CYCLE_MS / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true, // reverse → zacht uit- en samentrekken zonder harde reset
    );
    driftA.value = withRepeat(
      withTiming(1, { duration: DRIFT.slow, easing: Easing.linear }),
      -1,
      false,
    );
    driftB.value = withRepeat(
      withTiming(1, { duration: DRIFT.mid, easing: Easing.linear }),
      -1,
      false,
    );
    driftC.value = withRepeat(
      withTiming(1, { duration: DRIFT.fast, easing: Easing.linear }),
      -1,
      false,
    );
  }, [breath, driftA, driftB, driftC]);

  /* ── Laag 1 — buitenste haze. Groot, zeer donker, nauwelijks bewegend.
     Geeft het beeld diepte zonder zelf op te vallen. ── */
  const hazeR = useDerivedValue(() => size * (0.42 + breath.value * 0.1));
  const hazeOpacity = useDerivedValue(() => 0.28 + breath.value * 0.14);

  /* ── Laag 2 — volumelaag. Drift langzaam weg van het midden zodat het
     licht asymmetrisch wordt; dat leest als volume i.p.v. als bol. ── */
  const volCx = useDerivedValue(
    () => cx + Math.cos(driftA.value * Math.PI * 2) * size * 0.045,
  );
  const volCy = useDerivedValue(
    () => cy + Math.sin(driftB.value * Math.PI * 2) * size * 0.038,
  );
  const volR = useDerivedValue(() => size * (0.26 + breath.value * 0.13));
  const volOpacity = useDerivedValue(() => 0.3 + breath.value * 0.26);

  /* ── Laag 3 — tegenlicht. Drift de andere kant op; waar hij de
     volumelaag overlapt ontstaat de heldere zone. ── */
  const counterCx = useDerivedValue(
    () => cx - Math.cos(driftC.value * Math.PI * 2) * size * 0.055,
  );
  const counterCy = useDerivedValue(
    () => cy - Math.sin(driftA.value * Math.PI * 2) * size * 0.042,
  );
  const counterR = useDerivedValue(() => size * (0.2 + breath.value * 0.1));
  const counterOpacity = useDerivedValue(() => 0.22 + breath.value * 0.24);

  /* ── Laag 4 — kern. Klein, bijna wit, zacht. Draagt de "ademhaling":
     het enige element dat duidelijk meegroeit. ── */
  const coreR = useDerivedValue(() => size * (0.055 + breath.value * 0.075));
  const coreOpacity = useDerivedValue(() => 0.34 + breath.value * 0.4);

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ flex: 1 }}>
        {/* Additief licht — overlappende lagen tellen op i.p.v. elkaar te
           bedekken. Dit is wat het volumetrisch maakt. */}
        <Group blendMode="plus">
          {/* 1 — haze */}
          <Group opacity={hazeOpacity}>
            <Circle cx={cx} cy={cy} r={hazeR}>
              <RadialGradient
                c={vec(cx, cy)}
                r={size * 0.52}
                colors={[AMBIENT.haze, AMBIENT.fade]}
              />
              <BlurMask blur={52} style="normal" />
            </Circle>
          </Group>

          {/* 2 — volume */}
          <Group opacity={volOpacity}>
            <Circle cx={volCx} cy={volCy} r={volR}>
              <RadialGradient
                c={vec(cx, cy)}
                r={size * 0.34}
                colors={[AMBIENT.volume, AMBIENT.fade]}
              />
              <BlurMask blur={40} style="normal" />
            </Circle>
          </Group>

          {/* 3 — tegenlicht */}
          <Group opacity={counterOpacity}>
            <Circle cx={counterCx} cy={counterCy} r={counterR}>
              <RadialGradient
                c={vec(cx, cy)}
                r={size * 0.28}
                colors={[AMBIENT.volume, AMBIENT.fade]}
              />
              <BlurMask blur={34} style="normal" />
            </Circle>
          </Group>

          {/* 4 — kern */}
          <Group opacity={coreOpacity}>
            <Circle cx={cx} cy={cy} r={coreR}>
              <RadialGradient
                c={vec(cx, cy)}
                r={size * 0.14}
                colors={[AMBIENT.core, AMBIENT.fade]}
              />
              <BlurMask blur={26} style="normal" />
            </Circle>
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}
