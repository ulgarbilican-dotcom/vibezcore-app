/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — BreathMandala

   Operator 2026-07-31: "dit is een andere soort mandala, dit zal een
   ademritme bepalen."

   Verschil met de mandala op scherm 1: daar REIST er licht rond de figuur —
   een meteoor op een baan. Hier gebeurt niets rond; de hele figuur zet uit
   en krimpt. Dat is precies het verschil tussen "kijk hoe mooi" en "adem
   met mij mee": een ronddraaiend licht trekt je blik mee, een uitzettende
   vorm trekt je ademhaling mee.

   Wat de vorm doet:
     ADEMEN     De hele bloem groeit bij het inademen en krimpt bij het
                uitademen, met een sinus-versnelling zodat het nergens
                schokt. Dit is het enige wat beweegt
     KNOPEN     Zeven lichtpunten: zes waar de bloembladen de buitencirkel
                raken, en één in het hart. Ze zwellen mee. In het
                referentiebeeld zijn die punten wat de figuur laat leven —
                zonder hen is het een technische tekening
     LIJNEN     Haarlijnen, helder maar dun. Het licht moet uit de knopen
                komen, niet uit de lijnen zelf

   Geen vervaging op de lijnen, alleen op de knopen. Vervaging is de duurste
   tekening die er is, en op een haarlijn levert ze niets op.
   ───────────────────────────────────────────────────────────────────────── */

import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { buildMandala, SEEDS } from './mandala-geometry';

const TAU = Math.PI * 2;

const C_LINE = '#4d92e8';
const C_RIM = '#bcd9ff';
const C_NODE = '#ffffff';
const C_HALO = '#3f8ce8';

type Props = {
  size?: number;
  /** Duur van één volledige ademcyclus: uitzetten én weer krimpen. */
  breathCycleMs?: number;
};

/* Eén lichtpunt. Eigen component omdat er hooks in zitten. */
function Node({
  x,
  y,
  r,
  breath,
  center = false,
}: {
  x: number;
  y: number;
  r: number;
  breath: SharedValue<number>;
  center?: boolean;
}) {
  /* Het hart zwelt sterker dan de buitenknopen — daar begint de adem. */
  const scale = center ? 0.55 : 0.32;
  const radius = useDerivedValue(() => r * (1 + breath.value * scale));
  const opacity = useDerivedValue(() => 0.55 + breath.value * 0.45);

  return (
    <Group opacity={opacity}>
      {/* Zachte halo eromheen, en daarbinnen een harde kern. Alleen de kern
          is echt wit; zonder die halo leest een wit puntje als een stofje. */}
      <Circle cx={x} cy={y} r={radius}>
        <RadialGradient
          c={vec(x, y)}
          r={r * 2.2}
          colors={[C_HALO, C_HALO, '#00000000']}
          positions={[0, 0.12, 1]}
        />
        <BlurMask blur={r * 1.6} style="normal" />
      </Circle>
      <Circle cx={x} cy={y} r={radius} color={C_NODE}>
        <BlurMask blur={r * 0.5} style="normal" />
      </Circle>
    </Group>
  );
}

export default function BreathMandala({
  size = 240,
  breathCycleMs = 7000,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.42;
  const thin = size * 0.0045;

  const geo = useMemo(() => buildMandala(R), [R]);

  /* De knopen liggen waar de bloembladen de buitencirkel raken. Omdat straal
     en middelpuntsafstand allebei R/2 zijn, is dat precies op hoek i·60°,
     op afstand R. Één punt per blad, plus het hart. */
  const nodes = useMemo(
    () =>
      Array.from({ length: SEEDS }, (_, i) => {
        const a = (i / SEEDS) * TAU;
        /* LOKALE coördinaten, net als de paden uit buildMandala: rond de
           oorsprong. Ze staan in dezelfde groep, dus ze moeten in hetzelfde
           stelsel liggen — anders hangt het ene deel gecentreerd en het
           andere linksboven. */
        return { x: Math.cos(a) * R, y: Math.sin(a) * R };
      }),
    [R],
  );

  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, {
        duration: breathCycleMs / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [breath, breathCycleMs]);

  /* Alles hangt aan één schaal. Dat is wat de figuur tot één ademende vorm
     maakt in plaats van losse onderdelen die toevallig samen bewegen. */
  /* Verschuiven naar het midden van het doek en dáár schalen. De geometrie
     ligt om de oorsprong, dus dit is de enige plek waar het middelpunt
     binnenkomt. */
  const transform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { scale: 0.9 + breath.value * 0.1 },
  ]);

  const lineOpacity = useDerivedValue(() => 0.42 + breath.value * 0.2);
  const rimOpacity = useDerivedValue(() => 0.6 + breath.value * 0.3);
  const glowOpacity = useDerivedValue(() => 0.06 + breath.value * 0.07);

  const nodeR = size * 0.011;

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ flex: 1 }}>
        <Group blendMode="plus">
          {/* Zachte gloed in het hart, zodat de figuur niet op zwart ligt
              maar erin hangt. Heldere kleur op lage dekking — andersom wordt
              het tegen zwart een grijze waas. */}
          <Circle cx={cx} cy={cy} r={R * 1.15} opacity={glowOpacity}>
            <RadialGradient
              c={vec(cx, cy)}
              r={R * 1.15}
              colors={[C_HALO, C_HALO, '#00000000']}
              positions={[0, 0.08, 1]}
            />
          </Circle>

          <Group transform={transform}>
            <Path
              path={geo.seedsAll}
              style="stroke"
              strokeWidth={thin}
              color={C_LINE}
              opacity={lineOpacity}
            />
            <Path
              path={geo.outer}
              style="stroke"
              strokeWidth={thin * 1.15}
              color={C_RIM}
              opacity={rimOpacity}
            />

            {nodes.map((n, i) => (
              <Node key={i} x={n.x} y={n.y} r={nodeR} breath={breath} />
            ))}
            <Node x={0} y={0} r={nodeR * 1.5} breath={breath} center />
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}
