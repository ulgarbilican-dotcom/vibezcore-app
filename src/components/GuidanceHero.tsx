/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — GuidanceHero (onboarding scherm 2)

   Operator 2026-07-31: "Grote hero-animatie die automatisch wisselt tussen
   Voice / Smartphone Haptics / Voice + Haptics / Silent. Laat de animatie
   tonen wat elk type begeleiding doet." En daarna: "ook de silent mode mag
   de mandala worden — die gaan we gebruiken voor alle haptic modes."

   ── De opzet ──────────────────────────────────────────────────────────
   Alle vier delen dezelfde ademende buitencirkel. Wat de modus toont is wat
   er bij die cirkel gebeurt, en dat is wat de vier meteen leesbaar maakt
   zonder bijschrift:

     VOICE     Boogjes links en rechts, zoals de golven bij een
               luidsprekertje, met een helderheid die naar buiten wegloopt.
               Geluid dat de ruimte in gaat
     HAPTICS   Volle ringen die met een schok wegschieten en uitdoven. Geen
               golf maar een klop — precies het verschil tussen horen en
               voelen
     BEIDE     Allebei tegelijk, in één kleur
     SILENT    Niets komt naar buiten. In plaats daarvan vult de cirkel zich
               van binnenuit met de mandala. De mandala hoort HIER bij de
               stille functie (operator 2026-07-31), niet bij alle vier

   Doordat de buitencirkel altijd staat, springt er nooit een vorm om. Bij
   Silent verschijnt de rozet erbinnen; bij de andere drie komt er iets
   omheen. Dat maakt de vier vergelijkbaar in plaats van vier losse
   plaatjes.

   ── Hoe de overgang werkt ─────────────────────────────────────────────
   Eén gedeelde waarde `t` houdt de modus-index vast en loopt met een
   animatie naar de nieuwe waarde. Elke laag leest daar een driehoekige
   weging uit af: vol op zijn eigen index, nul één index verderop. Halverwege
   een overgang staan er dus twee lagen op de helft — een echte cross-fade,
   geen harde wissel. De kleur interpoleert over dezelfde as mee.
   ───────────────────────────────────────────────────────────────────────── */

import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BrandFonts } from '@/constants/theme';
import type { GuidanceMode } from './GuidanceSelector';
import { buildMandala } from './mandala-geometry';

const TAU = Math.PI * 2;

/* Volgorde bepaalt de as waarover kleur en lagen interpoleren. Gelijk aan
   de volgorde van de knoppen eronder, zodat een tik geen sprong in de
   kleurvolgorde geeft. */
export const GUIDANCE_ORDER: GuidanceMode[] = [
  'voice',
  'haptic',
  'both',
  'silent',
];
const COLORS = ['#0A84FF', '#FF9F0A', '#BF5AF2', '#E8ECF2'];

/* Ritme van de uitstraling: golven én kloppen lopen hierop. */
const PULSE_MS = 1900;
const BREATH_MS = 5200;
const SPIN_MS = 22000;

/* Ademcues in het hart van de mandala (operator 2026-07-31: "tekst inhale
   hold exhale en dat in loop ter illustratie"). Box breathing heeft vier
   even lange fasen — dat is de sessie die hierna volgt.

   Twee seconden per fase i.p.v. de echte vier: een volle box-cyclus duurt
   zestien seconden en dan ziet iemand die hier even kijkt hooguit één cue. */
const CUES = ['Inhale', 'Hold', 'Exhale', 'Hold'];
const CUE_MS = 2000;

/* Drie boogjes per kant, drie ringen per uitbarsting. */
const RINGS = 3;
/* Halve openingshoek van de spraakboogjes, in graden. */
const ARC_HALF = 32;

const C_GLASS = '#1a4a8a';
const C_GLASS_LIT = '#4485d8';
const C_SPEC = '#dceaff';
const C_STAR = '#9ec5ff';

type Props = {
  size: number;
  /** Welke modus getoond wordt. `null` toont alleen de rustende mandala. */
  mode: GuidanceMode | null;
  /** Tegel-variant: geen sterren, geen blur-lagen, geen ademcue. Vier van
   *  deze naast elkaar moeten samen niet duurder zijn dan één grote, en
   *  blur is veruit de duurste laag. Op tegelformaat is een sterretje van
   *  anderhalve pixel of een gloed van zes toch niet te onderscheiden. */
  compact?: boolean;
};

/* Sterren rondom, net als op scherm 1: statische paden, alleen de dekking
   beweegt. Drie groepen met een eigen ritme zodat ze niet samen knipperen. */
function makeStars(size: number, cx: number, cy: number) {
  let seed = 0x7f4a7c15;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: 3 }, () => {
    const p = Skia.Path.Make();
    for (let i = 0; i < 12; i++) {
      const a = rnd() * TAU;
      const rr = size * (0.4 + Math.sqrt(rnd()) * 0.22);
      p.addCircle(
        cx + Math.cos(a) * rr,
        cy + Math.sin(a) * rr,
        size * (0.0016 + rnd() * 0.0028),
      );
    }
    return p;
  });
}

/* Eén spraakgolf. Hier stond eerst een vast pad waarvan alleen de helderheid
   op en neer ging — en dat leest niet als beweging maar als knipperen. Nu
   reist de boog zelf naar buiten en dooft daarbij uit, zoals geluid dat de
   ruimte in gaat. Drie golven onderling verschoven, dus er is er altijd één
   onderweg. */
function VoiceArc({
  index,
  pulse,
  weight,
  color,
  cx,
  cy,
  r0,
  r1,
  strokeWidth,
}: {
  index: number;
  pulse: SharedValue<number>;
  weight: SharedValue<number>;
  color: SharedValue<string>;
  cx: number;
  cy: number;
  r0: number;
  r1: number;
  strokeWidth: number;
}) {
  const phase = useDerivedValue(() => {
    'worklet';
    const f = pulse.value - index / RINGS;
    return f - Math.floor(f);
  });

  const path = useDerivedValue(() => {
    'worklet';
    /* Afremmend naar buiten: een golf verliest snelheid naarmate hij
       verzwakt. Gelijkmatig zou mechanisch ogen. */
    const e = 1 - Math.pow(1 - phase.value, 1.8);
    const rr = r0 + (r1 - r0) * e;
    const p = Skia.Path.Make();
    const rect = Skia.XYWHRect(cx - rr, cy - rr, rr * 2, rr * 2);
    p.addArc(rect, -ARC_HALF, ARC_HALF * 2);
    p.addArc(rect, 180 - ARC_HALF, ARC_HALF * 2);
    return p;
  });

  const opacity = useDerivedValue(() => {
    'worklet';
    const f = phase.value;
    const rise = Math.min(1, f / 0.12);
    return weight.value * rise * Math.pow(1 - f, 1.3);
  });

  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={strokeWidth}
      strokeCap="round"
      color={color}
      opacity={opacity}
    />
  );
}

/* De lichtpuls die bij Haptics over de ring loopt (operator 2026-07-31).
   Zelfde taal als de meteoor op scherm 1: één ronde per klop, en de staart
   rolt uit en trekt zich weer in zodat er geen sprong is bij het omklappen. */
function HapticSweep({
  pulse,
  weight,
  color,
  r,
  strokeWidth,
}: {
  pulse: SharedValue<number>;
  weight: SharedValue<number>;
  color: SharedValue<string>;
  r: number;
  strokeWidth: number;
}) {
  const path = useDerivedValue(() => {
    'worklet';
    const t = pulse.value - Math.floor(pulse.value);
    const ease = Math.min(1, Math.min(t, 1 - t) / 0.2);
    const span = Math.max(0.004, 0.2 * ease);
    const p = Skia.Path.Make();
    p.addArc(
      Skia.XYWHRect(-r, -r, r * 2, r * 2),
      (t - span) * 360 - 90,
      span * 360,
    );
    return p;
  });

  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={strokeWidth}
      strokeCap="round"
      color={color}
      opacity={weight}
    />
  );
}

/* Eén haptische klop: een ring die naar buiten schiet en uitdooft. */
function HapticRing({
  index,
  pulse,
  weight,
  color,
  cx,
  cy,
  r0,
  r1,
  strokeWidth,
}: {
  index: number;
  pulse: SharedValue<number>;
  weight: SharedValue<number>;
  color: SharedValue<string>;
  cx: number;
  cy: number;
  r0: number;
  r1: number;
  strokeWidth: number;
}) {
  /* Fase 0→1 per ring, onderling verschoven zodat er altijd één onderweg is. */
  const phase = useDerivedValue(() => {
    'worklet';
    const f = pulse.value - index / RINGS;
    return f - Math.floor(f);
  });

  const radius = useDerivedValue(() => {
    'worklet';
    /* Snel weg, dan uitrollen: een klop plant zich niet gelijkmatig voort. */
    const e = 1 - Math.pow(1 - phase.value, 2.4);
    return r0 + (r1 - r0) * e;
  });

  const opacity = useDerivedValue(() => {
    'worklet';
    /* Kort aanzwellen, lang uitdoven. */
    const p = phase.value;
    const rise = Math.min(1, p / 0.08);
    return weight.value * rise * Math.pow(1 - p, 1.6);
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
    />
  );
}

export default function GuidanceHero({ size, mode, compact = false }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  /* Straal van de cirkel. In een tegel mag de figuur groter, want daar telt
     herkenbaarheid zwaarder dan lucht eromheen; de uitstraling reikt dan
     navenant minder ver zodat er niets buiten het doek valt. */
  const R = size * (compact ? 0.3 : 0.26);
  const reach = compact ? 1.5 : 1.82;
  const thin = size * (compact ? 0.0072 : 0.0055);

  /* `t` = positie op de modus-as. Loopt met een animatie naar de nieuwe
     index, waardoor alle lagen én de kleur samen overvloeien. */
  const t = useSharedValue(mode ? GUIDANCE_ORDER.indexOf(mode) : 0);
  /* `active` = 0 zolang er niets getoond wordt; dempt alleen de uitstraling,
     nooit de mandala zelf. */
  const active = useSharedValue(mode ? 1 : 0);
  const pulse = useSharedValue(0);
  const breath = useSharedValue(0);
  const spin = useSharedValue(0);
  const twinkle = useSharedValue(0);
  /* Loopt 0→4 en begint opnieuw: het gehele deel zegt welke cue, het cijfer
     erachter waar we in die fase zitten. */
  const cueClock = useSharedValue(0);
  const [cue, setCue] = useState(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.linear }),
      -1,
      false,
    );
    breath.value = withRepeat(
      withTiming(1, {
        duration: BREATH_MS / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    spin.value = withRepeat(
      withTiming(1, { duration: SPIN_MS, easing: Easing.linear }),
      -1,
      false,
    );
    twinkle.value = withRepeat(
      withTiming(1, { duration: 17000, easing: Easing.linear }),
      -1,
      false,
    );
    cueClock.value = withRepeat(
      withTiming(CUES.length, {
        duration: CUE_MS * CUES.length,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [pulse, breath, spin, twinkle, cueClock]);

  /* De tekst wisselt op dezelfde klok als de vervaging. Zou een losse timer
     de tekst omzetten, dan zou die na een paar minuten wegdrijven en zag je
     het woord midden in beeld verspringen. Nu valt de wissel altijd op het
     moment dat de dekking nul is. */
  useAnimatedReaction(
    () => Math.floor(cueClock.value) % CUES.length,
    (cur, prev) => {
      'worklet';
      if (prev === null || cur === prev) return;
      runOnJS(setCue)(cur);
    },
  );

  const cueStyle = useAnimatedStyle(() => {
    const f = cueClock.value - Math.floor(cueClock.value);
    /* Sinus is nul aan beide uiteinden van een fase; de macht houdt hem
       langer vol en laat hem alleen vlak vóór de wissel wegvallen. */
    const k = Math.pow(Math.sin(f * Math.PI), 0.5);
    return { opacity: k, transform: [{ scale: 0.95 + 0.05 * k }] };
  });

  useEffect(() => {
    const idx = mode ? GUIDANCE_ORDER.indexOf(mode) : -1;
    active.value = withTiming(idx < 0 ? 0 : 1, { duration: 320 });
    if (idx >= 0) {
      t.value = withTiming(idx, {
        duration: 480,
        easing: Easing.inOut(Easing.cubic),
      });
    }
  }, [mode, t, active]);

  const color = useDerivedValue(() =>
    interpolateColor(t.value, [0, 1, 2, 3], COLORS),
  );

  /* Driehoekige weging: vol op de eigen index, nul één index verderop.
     Voice en haptics tellen ook mee op index 2 ("beide"). Silent heeft geen
     eigen laag — daar is de mandala alléén het antwoord. */
  const wVoice = useDerivedValue(() => {
    'worklet';
    const a = Math.max(0, 1 - Math.abs(t.value - 0));
    const b = Math.max(0, 1 - Math.abs(t.value - 2));
    return active.value * Math.max(a, b);
  });
  const wHaptic = useDerivedValue(() => {
    'worklet';
    const a = Math.max(0, 1 - Math.abs(t.value - 1));
    const b = Math.max(0, 1 - Math.abs(t.value - 2));
    return active.value * Math.max(a, b);
  });
  /* Silent heeft geen uitstraling maar een INVULLING: de rozet en de
     maanvorm vloeien binnen de buitencirkel op. */
  const wSilent = useDerivedValue(() => {
    'worklet';
    return active.value * Math.max(0, 1 - Math.abs(t.value - 3));
  });

  /* ── Statische geometrie ── */
  const geo = useMemo(() => {
    const stars = makeStars(size, cx, cy);
    const mandala = buildMandala(R);

    return { stars, mandala };
  }, [size, cx, cy, R]);

  const starOp0 = useDerivedValue(
    () => 0.34 + 0.24 * Math.sin(twinkle.value * TAU),
  );
  const starOp1 = useDerivedValue(
    () => 0.34 + 0.24 * Math.sin(twinkle.value * TAU * 2 + 2.2),
  );
  const starOp2 = useDerivedValue(
    () => 0.34 + 0.24 * Math.sin(twinkle.value * TAU * 3 + 4.4),
  );
  const starOps = [starOp0, starOp1, starOp2];

  /* De mandala ademt en draait, en klopt kort mee bij elke haptische puls. */
  const mandalaTransform = useDerivedValue(() => {
    'worklet';
    const p = pulse.value - Math.floor(pulse.value);
    const kick = wHaptic.value * Math.pow(1 - p, 6) * 0.045;
    return [
      { translateX: cx },
      { translateY: cy },
      { rotate: spin.value * TAU },
      { scale: 0.9 + breath.value * 0.1 + kick },
    ];
  });

  const ringOpacity = useDerivedValue(() => 0.42 + breath.value * 0.16);
  /* De rozet en de maanvorm bestaan alleen in Silent. */
  const seedGlowOpacity = useDerivedValue(() => wSilent.value * 0.24);
  const seedLineOpacity = useDerivedValue(
    () => wSilent.value * (0.42 + breath.value * 0.16),
  );
  const oRingOpacity = useDerivedValue(() => wSilent.value * 0.55);
  const glowOpacity = useDerivedValue(() => 0.08 + breath.value * 0.06);
  const glowR = useDerivedValue(() => R * (0.85 + breath.value * 0.1));

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ flex: 1 }}>
        <Group blendMode="plus">
          {!compact &&
            geo.stars.map((sp, i) => (
              <Path key={i} path={sp} color={C_STAR} opacity={starOps[i]} />
            ))}

          {/* ── Zachte gloed in het hart ── heldere kleur op lage dekking;
             donker op hoge dekking geeft tegen zwart geen licht maar waas. */}
          <Circle cx={cx} cy={cy} r={glowR} opacity={glowOpacity}>
            <RadialGradient
              c={vec(cx, cy)}
              r={R * 0.9}
              colors={['#5aa0ff', '#5aa0ff', '#00000000']}
              positions={[0, 0.08, 1]}
            />
          </Circle>

          {/* ── Haptiek: ringen die naar buiten schieten ── */}
          {Array.from({ length: RINGS }).map((_, i) => (
            <HapticRing
              key={i}
              index={i}
              pulse={pulse}
              weight={wHaptic}
              color={color}
              cx={cx}
              cy={cy}
              r0={R * 1.02}
              r1={R * reach}
              strokeWidth={thin * 1.8}
            />
          ))}

          {/* ── Stem: golven die naar buiten reizen ── */}
          {Array.from({ length: RINGS }).map((_, i) => (
            <VoiceArc
              key={i}
              index={i}
              pulse={pulse}
              weight={wVoice}
              color={color}
              cx={cx}
              cy={cy}
              r0={R * 1.06}
              r1={R * reach}
              strokeWidth={thin * 2.2}
            />
          ))}

          {/* ── De cirkel, en bij Silent de mandala erbinnen ── de
             buitencirkel staat er altijd; de rozet vloeit alleen op wanneer
             Silent aan de beurt is. */}
          <Group transform={mandalaTransform}>
            {!compact && (
              <Path
                path={geo.mandala.seedsAll}
                style="stroke"
                strokeWidth={thin * 2.4}
                color={C_GLASS}
                opacity={seedGlowOpacity}
              >
                <BlurMask blur={5} style="normal" />
              </Path>
            )}
            <Path
              path={geo.mandala.seedsAll}
              style="stroke"
              strokeWidth={thin}
              color={C_GLASS_LIT}
              opacity={seedLineOpacity}
            />
            {!compact && (
              <Path
                path={geo.mandala.outer}
                style="stroke"
                strokeWidth={thin * 2.6}
                color={C_GLASS}
                opacity={0.3}
              >
                <BlurMask blur={6} style="normal" />
              </Path>
            )}
            <Path
              path={geo.mandala.outer}
              style="stroke"
              strokeWidth={thin}
              color={C_GLASS_LIT}
              opacity={ringOpacity}
            />

            {/* Haptiek: de lichtpuls die over de ring loopt. Staat in
                dezelfde groep als de ring, dus hij ademt en draait mee. */}
            <HapticSweep
              pulse={pulse}
              weight={wHaptic}
              color={color}
              r={R}
              strokeWidth={thin * 1.9}
            />
          </Group>
        </Group>

        {/* ── De maanvorm in het hart ── hoort bij Silent, dus vervaagt hij
            mee met die modus. Staat buiten de additieve groep, want
            daarbinnen telt alles bij elkaar op en is dus álles
            doorschijnend; hier wordt normaal gemengd zodat de vulling de
            rozet erachter écht afdekt. */}
        <Group transform={mandalaTransform}>
          <Path path={geo.mandala.oFill} color={color} opacity={wSilent} />
          <Path
            path={geo.mandala.oRing}
            style="stroke"
            strokeWidth={thin * 1.1}
            color={C_SPEC}
            opacity={oRingOpacity}
          />
        </Group>
      </Canvas>

      {/* ── Ademcue ── als gewone tekst óver het doek, niet erin. Twee
          redenen: Skia-tekst vraagt een apart geladen lettertype, en deze
          cue mag NIET meedraaien met de mandala — een kantelend woord leest
          verkeerd. */}
      {!compact && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View style={[cueStyles.wrap, cueStyle]}>
            <Text style={cueStyles.text}>{CUES[cue].toUpperCase()}</Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const cueStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: {
    color: 'rgba(255,255,255,0.94)',
    fontFamily: BrandFonts.bold,
    fontSize: 12,
    letterSpacing: 2.6,
  },
});
