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

const C_NODE = '#ffffff';

/* Operator 2026-08-01: elke toestand krijgt een eigen kleur, zodat je aan
   het beeld al ziet waar je bent voordat je de titel leest. De kleur komt
   van buiten mee — de figuur kent zijn eigen betekenis niet. */
export type Tint = {
  /** De lijnen. */
  line: string;
  /** De rand en de accenten; lichter dan de lijn. */
  rim: string;
  /** Gloed en halo's. Verzadigd, want hij wordt op lage dekking gebruikt. */
  halo: string;
};

export const TINT_CALM: Tint = {
  line: '#B478FF',
  rim: '#E7D4FF',
  halo: '#8B3DF0',
};

type Props = {
  size: number;
  figure: FigureKey;
  /** 0 = volledig uitgeademd, 1 = volledig ingeademd. */
  breath: SharedValue<number>;
  tint?: Tint;
};

/* Eén lichtpunt. Eigen component omdat er hooks in zitten en die niet in een
   .map()-callback mogen. */
function Node({
  x,
  y,
  r,
  breath,
  halo,
  center = false,
}: {
  x: number;
  y: number;
  r: number;
  breath: SharedValue<number>;
  halo: string;
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
          puntje als een stofje op het scherm.

          De halo heeft BEWUST geen BlurMask. Een radiale verloop dooft al
          uit naar de rand — daar nog een vervaging overheen leggen doet
          hetzelfde werk twee keer, en vervaging is de duurste tekening die
          er is. Met eenentwintig knopen scheelde dat eenentwintig
          filterpassages per frame; genoeg om de tekenlaag te laten
          vastlopen. Het verschil is met het blote oog niet te zien. */}
      <Circle cx={x} cy={y} r={r * 2.2} opacity={haloOpacity}>
        <RadialGradient
          c={vec(x, y)}
          r={r * 2.2}
          colors={[halo, halo, '#00000000']}
          positions={[0, 0.28, 1]}
        />
      </Circle>
      <Circle cx={x} cy={y} r={radius} color={C_NODE} opacity={opacity}>
        <BlurMask blur={r * 0.5} style="normal" />
      </Circle>
    </>
  );
}

export default function SessionVisual({
  size,
  figure,
  breath,
  tint = TINT_CALM,
}: Props) {
  const { line: C_WEB, rim: C_RIM, halo: C_HALO } = tint;
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.44;
  const thin = size * 0.0042;

  const geo = useMemo(() => buildFigure(figure, R), [figure, R]);

  /* Alles hangt aan één schaal. Dat maakt het tot één ademende vorm in
     plaats van losse onderdelen die toevallig samen bewegen. */
  const transform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { scale: 0.9 + breath.value * 0.1 },
  ]);

  /* Bij een figuur zonder omsluitende cirkel is de rand decor. Op volle
     sterkte werd hij het luidste element op het scherm. */
  const rimScale = geo.rimSoft ? 0.3 : 1;
  const webOpacity = useDerivedValue(() => 0.62 + breath.value * 0.3);
  const rimOpacity = useDerivedValue(
    () => (0.7 + breath.value * 0.28) * rimScale,
  );
  const glowOpacity = useDerivedValue(() => 0.09 + breath.value * 0.1);
  /* De bloem eromheen. Zie de opmerking bij de tekening zelf. */
  const bloomOpacity = useDerivedValue(() => 0.16 + breath.value * 0.16);
  const rimBloom = useDerivedValue(
    () => (0.16 + breath.value * 0.16) * rimScale,
  );

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
            {/* Bloem: dezelfde lijnen nog eens, breed en vervaagd, eronder.
                Zo lijkt het licht ván de lijn te komen in plaats van dat
                de lijn getekend is. Twee vervagingspassages voor de hele
                figuur — dat is de goedkope plek om ze te betalen, want
                per lichtpunt zou het er eenentwintig zijn. */}
            <Path
              path={geo.web}
              style="stroke"
              strokeWidth={thin * 3.4}
              color={C_WEB}
              opacity={bloomOpacity}
            >
              <BlurMask blur={size * 0.014} style="normal" />
            </Path>
            <Path
              path={geo.rim}
              style="stroke"
              strokeWidth={thin * 4}
              color={C_WEB}
              opacity={rimBloom}
            >
              <BlurMask blur={size * 0.016} style="normal" />
            </Path>

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
              strokeWidth={thin * 1.5}
              color={C_RIM}
              opacity={rimOpacity}
            />

            {geo.nodes.map((n, i) => (
              <Node
                key={i}
                x={n.x}
                y={n.y}
                r={nodeR}
                breath={breath}
                halo={C_HALO}
              />
            ))}
            {geo.core && (
              <Node
                x={0}
                y={geo.coreY ?? 0}
                r={nodeR * 1.6}
                breath={breath}
                halo={C_HALO}
                center
              />
            )}
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}
