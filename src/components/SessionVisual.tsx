/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — SessionVisual

   De ademende figuur voor een actieve sessie. Zeven verschijningsvormen,
   één ritme.

   Operator 2026-07-31: "Elke visual ademt op exact hetzelfde ritme, maar
   heeft een eigen karakter. Na verloop van tijd gaan gebruikers zelfs
   onbewust een bepaalde visual associëren met een bepaalde mentale toestand."

   Dat is alleen waar als het ritme écht identiek is. Daarom staat de vorm in
   een apart bestand en zit ALLE beweging hier: één ademwaarde stuurt de
   schaal, de helderheid en de lichtpunten van welke figuur dan ook. Een
   figuur kán dus niet anders gaan ademen dan de rest.

   De ademwaarde komt van buiten mee. Zo loopt het beeld op dezelfde klok als
   de trilling en de stem, in plaats van er toevallig naast — dat is het
   verschil tussen een animatie die meeloopt en een animatie die stuurt.
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
import { useMemo } from 'react';
import { View } from 'react-native';
import {
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { buildFigure, type FigureKey } from './session-figures';

const C_WEB = '#5c9ae8';
const C_RIM = '#cfe4ff';
const C_NODE = '#ffffff';
const C_HALO = '#3f8ce8';

type Props = {
  size: number;
  figure: FigureKey;
  /** 0 = volledig uitgeademd, 1 = volledig ingeademd. */
  breath: SharedValue<number>;
};

/* Eén lichtpunt. Eigen component omdat er hooks in zitten en die niet in een
   .map()-callback mogen. */
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
  const grow = center ? 0.55 : 0.3;
  const radius = useDerivedValue(() => r * (1 + breath.value * grow));
  const opacity = useDerivedValue(() => 0.5 + breath.value * 0.5);
  /* De halo mag niet even hard meelichten als de kern, anders wordt het
     één wazige vlek zodra er twintig van deze punten naast elkaar staan. */
  const haloOpacity = useDerivedValue(() => (0.5 + breath.value * 0.5) * 0.75);

  /* De dekking staat op de cirkels zelf en NIET op een <Group opacity>.
     Een groep met dekking dwingt Skia om een volledig scherm aan
     tussengeheugen te reserveren; op een vorm is het niets meer dan de
     alpha van de verf. Bij twintig knopen scheelt dat twintig
     schermbuffers per frame — dat is het verschil tussen soepel en
     onbruikbaar. */
  return (
    <>
      {/* Halo eromheen, harde kern erbinnen. Zonder halo leest een wit
          puntje als een stofje op het scherm. */}
      <Circle cx={x} cy={y} r={radius} opacity={haloOpacity}>
        <RadialGradient
          c={vec(x, y)}
          r={r * 2.4}
          colors={[C_HALO, C_HALO, '#00000000']}
          positions={[0, 0.12, 1]}
        />
        <BlurMask blur={r * 1.6} style="normal" />
      </Circle>
      <Circle cx={x} cy={y} r={radius} color={C_NODE} opacity={opacity}>
        <BlurMask blur={r * 0.5} style="normal" />
      </Circle>
    </>
  );
}

export default function SessionVisual({ size, figure, breath }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.44;
  const thin = size * 0.0032;

  const geo = useMemo(() => buildFigure(figure, R), [figure, R]);

  /* Alles hangt aan één schaal. Dat maakt het tot één ademende vorm in
     plaats van losse onderdelen die toevallig samen bewegen. */
  const transform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { scale: 0.9 + breath.value * 0.1 },
  ]);

  const webOpacity = useDerivedValue(() => 0.3 + breath.value * 0.22);
  const rimOpacity = useDerivedValue(() => 0.55 + breath.value * 0.35);
  const glowOpacity = useDerivedValue(() => 0.07 + breath.value * 0.09);

  const nodeR = size * 0.009;

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        <Group blendMode="plus">
          {/* Gloed in het hart, zodat de figuur in de ruimte hangt i.p.v. op
              zwart te liggen. Heldere kleur op lage dekking — andersom wordt
              het tegen zwart een grijze waas. */}
          <Circle cx={cx} cy={cy} r={R * 1.2} opacity={glowOpacity}>
            <RadialGradient
              c={vec(cx, cy)}
              r={R * 1.2}
              colors={[C_HALO, C_HALO, '#00000000']}
              positions={[0, 0.06, 1]}
            />
          </Circle>

          <Group transform={transform}>
            <Path
              path={geo.web}
              style="stroke"
              strokeWidth={thin}
              color={C_WEB}
              opacity={webOpacity}
            />
            <Path
              path={geo.rim}
              style="stroke"
              strokeWidth={thin * 1.6}
              color={C_RIM}
              opacity={rimOpacity}
            />

            {geo.nodes.map((n, i) => (
              <Node key={i} x={n.x} y={n.y} r={nodeR} breath={breath} />
            ))}
            {geo.core && (
              <Node x={0} y={0} r={nodeR * 1.6} breath={breath} center />
            )}
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}
