/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — BreathCloud (onboarding slide 3 + echte sessies)

   "Geen cirkel. Gebruik een zachte volumetrische luchtwolk. Bij inademen:
   de wolk groeit. Bij uitademen: ze lost weer op."

   Zes zwaar geblurde lobben die additief over elkaar liggen. Elke lob
   heeft een eigen positie op een ellips, een eigen driftfrequentie en een
   eigen schaalrespons. Samen lezen ze als één diffuse massa — nergens is
   een rand te zien.

   Bij INHALE  → lobben zetten uit ÉN spreiden verder uit elkaar (de wolk
                 groeit, wordt voller, licht neemt toe)
   Bij EXHALE  → lobben krimpen ÉN schuiven naar elkaar toe, opacity zakt
                 (de wolk lost op)
   Bij HOLD    → de bereikte staat blijft; alleen de drift loopt door,
                 zodat het beeld ademt zonder te "zakken"

   Aansturing identiek aan de sessie-engine: de parent geeft `phase` +
   `phaseDurationMs`, de wolk animeert exact over die duur. Beeld en
   timing zijn daardoor altijd synchroon, ongeacht welk pattern draait.
   ───────────────────────────────────────────────────────────────────────── */

import { AMBIENT } from '@/components/ambient-tokens';
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
  type SharedValue,
} from 'react-native-reanimated';

export type CloudPhase =
  | 'idle'
  | 'inhale'
  | 'hold-in'
  | 'exhale'
  | 'hold-out';

type Props = {
  phase: CloudPhase;
  /** Duur van de huidige fase in ms — de wolk animeert exact hierover. */
  phaseDurationMs: number;
  size?: number;
};

/* Zes lobben op een ellips. `a` = hoek, `rad` = afstand tot midden als
   fractie van de basisradius, `scale` = eigen grootte, `drift` = eigen
   bewegingsfrequentie (niet-deelbaar t.o.v. elkaar). */
const LOBES = [
  { a: 0.0,  rad: 0.00, scale: 1.15, drift: 1.00 },
  { a: 0.9,  rad: 0.46, scale: 0.86, drift: 1.37 },
  { a: 2.1,  rad: 0.52, scale: 0.78, drift: 0.83 },
  { a: 3.3,  rad: 0.44, scale: 0.9,  drift: 1.61 },
  { a: 4.4,  rad: 0.55, scale: 0.72, drift: 1.19 },
  { a: 5.5,  rad: 0.48, scale: 0.82, drift: 0.71 },
];

/* Hoe compact de wolk is bij volledige uitademing vs volledige inademing.
   Het verschil tussen deze twee is wat "groeien" en "oplossen" leest. */
const SPREAD_MIN = 0.55;
const SPREAD_MAX = 1.0;

/* Eén lob van de wolk. Eigen component (geen inline map-body) omdat hier
   hooks in zitten — hooks mogen niet in een .map()-callback staan. */
function CloudLobe({
  lobe,
  isCore,
  cx,
  cy,
  baseR,
  size,
  breath,
  t,
}: {
  lobe: (typeof LOBES)[number];
  isCore: boolean;
  cx: number;
  cy: number;
  baseR: number;
  size: number;
  breath: SharedValue<number>;
  t: SharedValue<number>;
}) {
  /* Positie drift op een eigen frequentie; `spread` duwt de lobben uit
     elkaar bij inademing en trekt ze samen bij uitademing. */
  const lx = useDerivedValue(() => {
    const spread = SPREAD_MIN + breath.value * (SPREAD_MAX - SPREAD_MIN);
    const wobble =
      Math.sin(t.value * Math.PI * 2 * lobe.drift + lobe.a) * 0.09;
    return (
      cx +
      Math.cos(lobe.a + t.value * Math.PI * 2 * 0.12) *
        baseR *
        (lobe.rad + wobble) *
        spread *
        1.9
    );
  });
  const ly = useDerivedValue(() => {
    const spread = SPREAD_MIN + breath.value * (SPREAD_MAX - SPREAD_MIN);
    const wobble =
      Math.cos(t.value * Math.PI * 2 * lobe.drift * 0.87 + lobe.a) * 0.09;
    return (
      cy +
      Math.sin(lobe.a + t.value * Math.PI * 2 * 0.12) *
        baseR *
        (lobe.rad + wobble) *
        spread *
        1.6
    );
  });
  const lr = useDerivedValue(
    () => baseR * lobe.scale * (0.62 + breath.value * 0.55),
  );

  return (
    <Circle cx={lx} cy={ly} r={lr}>
      <RadialGradient
        c={vec(cx, cy)}
        r={size * 0.4}
        colors={[isCore ? AMBIENT.core : AMBIENT.volume, AMBIENT.fade]}
      />
      {/* Zware blur per lob — laat de randen verdwijnen zodat de losse
         cirkels als één diffuse massa lezen. */}
      <BlurMask blur={isCore ? 30 : 44} style="normal" />
    </Circle>
  );
}

export default function BreathCloud({
  phase,
  phaseDurationMs,
  size = 320,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const baseR = size * 0.2;

  /* `breath` 0 = opgelost, 1 = volle wolk. */
  const breath = useSharedValue(0.15);
  /* Continue drift — loopt ALTIJD door, ook tijdens holds. Dit is wat de
     wolk levend houdt zonder dat er iets "gebeurt". */
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 26000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [t]);

  useEffect(() => {
    const dur = Math.max(200, phaseDurationMs);
    if (phase === 'inhale') {
      breath.value = withTiming(1, {
        duration: dur,
        easing: Easing.inOut(Easing.sin),
      });
    } else if (phase === 'exhale') {
      breath.value = withTiming(0.1, {
        duration: dur,
        easing: Easing.inOut(Easing.sin),
      });
    } else if (phase === 'idle') {
      /* Idle ademt zelfstandig door op een trage cyclus — het scherm staat
         nooit stil, ook als er geen sessie loopt. */
      breath.value = withRepeat(
        withTiming(0.6, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }
    /* holds: bewust geen animatie — de bereikte staat blijft staan. */
  }, [phase, phaseDurationMs, breath]);

  /* Globale opacity van de wolk: bij uitademing zakt het licht duidelijk
     weg zodat het écht "oplost" i.p.v. alleen krimpt. */
  const cloudOpacity = useDerivedValue(() => 0.2 + breath.value * 0.6);

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ flex: 1 }}>
        <Group blendMode="plus" opacity={cloudOpacity}>
          {LOBES.map((lobe, i) => (
            <CloudLobe
              key={i}
              lobe={lobe}
              isCore={i === 0}
              cx={cx}
              cy={cy}
              baseR={baseR}
              size={size}
              breath={breath}
              t={t}
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}
