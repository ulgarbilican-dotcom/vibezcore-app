/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — AddToDayHero

   Geëxtraheerd uit breath-setup.tsx (21 september 2026, "die cirkel ook op
   Set your routine gebruiken") — was daar module-level gedefinieerd voor de
   addToDay-modus (Time/State/Technique/Duration/Plan length), nu gedeeld
   zodat intensity.tsx ("Set your routine") 'm ook kan gebruiken voor zijn
   eigen rijen (Routine/Level/Times).

   Een ring die progressief opvult (`progress`, 0–1) met de opgegeven
   accentkleur, rijen (`{label, value, touched}`) die pas hun waarde tonen
   zodra ze echt aangeraakt zijn, en een korte viering (vinkje + "All set!")
   bij de overgang naar volledig. Geen eigen navigatie/state — puur
   weergave, de aanroeper bepaalt wat "voortgang" betekent. */

import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { Dimensions } from 'react-native';
import { BrandFonts } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const SCREEN_W = Dimensions.get('window').width;
const ADD_HERO_SIZE = Math.min(Math.round(SCREEN_W * 0.72), 280);
const ADD_HERO_STROKE = 10;
const ADD_HERO_R = (ADD_HERO_SIZE - ADD_HERO_STROKE) / 2;
const ADD_HERO_C = 2 * Math.PI * ADD_HERO_R;
const ADD_HERO_FILL_SIZE = ADD_HERO_SIZE - ADD_HERO_STROKE * 3;
const ADD_HERO_FILL_INSET = ADD_HERO_STROKE * 1.5;

/* Operator, 21 september 2026 ("de cirkel ook met golvend water vullen per
   gekozen kaart"): zelfde "vloeistof"-techniek als breath-setup.tsx se
   NORMALE (niet-addToDay) hero — twee golf-lagen die een waterlijn
   tekenen, geclipt tot een cirkel. Hier gebruikt als het waterpeil hoeveel
   van de 5 tegels (State/Level/Routine/Times/Plan length) al zijn
   ingevuld, i.p.v. een gekozen duur. Enkel actief op `neutral` (dus enkel
   intensity.tsx) — breath-setup.tsx se eigen hero heeft al zijn eigen,
   ongewijzigde golf-implementatie. */
const WAVE_D = ADD_HERO_FILL_SIZE;

export default function AddToDayHero({
  accent,
  photo,
  progress,
  topLabel,
  rows,
  neutral,
}: {
  accent: string;
  photo: string;
  progress: number;
  /** Bv. "Morning session" (breath-setup) of "Your routine" (intensity.tsx). */
  topLabel: string;
  rows: { label: string; value: string; touched: boolean }[];
  /** Operator, 21 september 2026 — meerdere ronden op intensity.tsx se
     cirkel (die voor het HELE protocol staat, niet één doel): eerst een
     zwart-transparante matglas-vulling zonder foto ("kleur van 1 van de 2
     states was misleidend"), nu WEL de foto terug ("zoals de cirkel van
     build it yourself"), maar met een witte i.p.v. per-doel-gekleurde
     tint + witte ring (i.p.v. mee-interpolerend naar het accent), en geen
     tekstregels meer erin. `neutral` schakelt dat hele pakket in. */
  neutral?: boolean;
}) {
  const revealColor = accent;
  const progressShared = useSharedValue(progress);
  const wasComplete = useRef(progress >= 1);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    progressShared.value = withTiming(progress, { duration: 450 });
    /* Enkel de OVERGANG naar volledig (niet elke render terwijl het al vol
       staat) triggert de korte viering. */
    if (progress >= 1 && !wasComplete.current) {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 1400);
      wasComplete.current = true;
      return () => clearTimeout(t);
    }
    if (progress < 1) wasComplete.current = false;
  }, [progress]);

  /* Ringlijn kleurt mee van wit (0/N ingevuld) naar de statekleur (N/N) —
     `neutral` houdt 'm altijd wit (zie toelichting bij de `neutral`-prop). */
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: ADD_HERO_C * (1 - progressShared.value),
    stroke: neutral
      ? '#ffffff'
      : interpolateColor(progressShared.value, [0, 1], ['#ffffff', revealColor]),
  }));

  /* Waterlijn: 0/N → bijna leeg (onderaan), N/N → bijna vol (net onder de
     bovenkant) — zelfde curve als breath-setup.tsx se `waterlineY`, nu op
     `progress` i.p.v. een gekozen duur. `withSpring` geeft het lichte
     "slosh"-natrillen wanneer een tegel wordt afgevinkt. */
  const waterlineY = neutral ? WAVE_D * 0.86 - (WAVE_D * 0.86 - WAVE_D * 0.04) * progress : 0;
  const waterlineYSV = useSharedValue(waterlineY);
  useEffect(() => {
    if (!neutral) return;
    waterlineYSV.value = withSpring(waterlineY, { damping: 8, stiffness: 90, mass: 1 });
  }, [waterlineY, neutral]);

  /* Twee golf-lagen, continu naar links schuivend voor een rustig
     "vloeistof"-gevoel — zelfde opzet als breath-setup.tsx, andere duur
     per laag zodat ze niet synchroon lopen. */
  const wave1X = useSharedValue(0);
  const wave2X = useSharedValue(0);
  useEffect(() => {
    if (!neutral) return;
    wave1X.value = withRepeat(withTiming(-WAVE_D, { duration: 6200, easing: Easing.linear }), -1, false);
    wave2X.value = withRepeat(withTiming(-WAVE_D, { duration: 4400, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(wave1X);
      cancelAnimation(wave2X);
    };
  }, [neutral]);
  const wave1Style = useAnimatedStyle(() => ({ transform: [{ translateX: wave1X.value }] }));
  const wave2Style = useAnimatedStyle(() => ({ transform: [{ translateX: wave2X.value }] }));
  /* Operator, 21 september 2026 ("zelfde foutmelding, iets anders doen"):
     de `'worklet'`-directive op de losse `buildWavePath`-functie loste het
     niet op — de path-string nu, zoals breath-setup.tsx dat al deed,
     rechtstreeks INLINE opgebouwd binnen elke worklet zelf, geen aparte
     functie-aanroep meer over de worklet-grens heen. */
  const wavePathBackProps = useAnimatedProps(() => {
    const baseY = waterlineYSV.value + 6;
    const amp = 9;
    return {
      d: `M0 ${baseY}
       C ${WAVE_D * 0.25} ${baseY - amp}, ${WAVE_D * 0.25} ${baseY + amp}, ${WAVE_D * 0.5} ${baseY}
       C ${WAVE_D * 0.75} ${baseY - amp}, ${WAVE_D * 0.75} ${baseY + amp}, ${WAVE_D} ${baseY}
       C ${WAVE_D * 1.25} ${baseY - amp}, ${WAVE_D * 1.25} ${baseY + amp}, ${WAVE_D * 1.5} ${baseY}
       C ${WAVE_D * 1.75} ${baseY - amp}, ${WAVE_D * 1.75} ${baseY + amp}, ${WAVE_D * 2} ${baseY}
       L ${WAVE_D * 2} ${WAVE_D} L 0 ${WAVE_D} Z`,
    };
  });
  const wavePathFrontProps = useAnimatedProps(() => {
    const baseY = waterlineYSV.value - 4;
    const amp = 7;
    return {
      d: `M0 ${baseY}
       C ${WAVE_D * 0.25} ${baseY - amp}, ${WAVE_D * 0.25} ${baseY + amp}, ${WAVE_D * 0.5} ${baseY}
       C ${WAVE_D * 0.75} ${baseY - amp}, ${WAVE_D * 0.75} ${baseY + amp}, ${WAVE_D} ${baseY}
       C ${WAVE_D * 1.25} ${baseY - amp}, ${WAVE_D * 1.25} ${baseY + amp}, ${WAVE_D * 1.5} ${baseY}
       C ${WAVE_D * 1.75} ${baseY - amp}, ${WAVE_D * 1.75} ${baseY + amp}, ${WAVE_D * 2} ${baseY}
       L ${WAVE_D * 2} ${WAVE_D} L 0 ${WAVE_D} Z`,
    };
  });

  const celebrateScale = useSharedValue(0.5);
  useEffect(() => {
    if (celebrating) {
      celebrateScale.value = 0.5;
      celebrateScale.value = withSpring(1, { damping: 7, stiffness: 140 });
    }
  }, [celebrating]);
  const celebrateStyle = useAnimatedStyle(() => ({
    transform: [{ scale: celebrateScale.value }],
  }));

  return (
    <>
      <Text style={addHeroStyles.outerLabel} numberOfLines={1}>
        {topLabel}
      </Text>
      <View style={addHeroStyles.wrap}>
        <Image source={{ uri: photo }} style={addHeroStyles.fill} resizeMode="cover" />
        <View
          style={[
            addHeroStyles.fill,
            addHeroStyles.fillTint,
            neutral && addHeroStyles.fillTintNeutral,
            { backgroundColor: neutral ? '#ffffff' : revealColor },
          ]}
        />
        {/* Operator, 21 september 2026 ("de bol moet eerst lage golf hebben
           en met keuzes maken stijgen"): de volle-cirkel witte tint
           hierboven stond op dezelfde 55% voor iedereen — daardoor oogde
           de cirkel bij progress 0 al net zo "wit"/vol als bij progress 1,
           het golf-verschil viel niet op. Nu bij `neutral` een veel
           lichtere basistint (`fillTintNeutral`, de foto blijft zichtbaar
           BOVEN de waterlijn). Vervolg ("water moet meer doorschijnend
           zijn", twee rondes): 0.55/0.75 → 0.3/0.45 → 0.2/0.32, steeds
           transparanter tot het echt als licht water aanvoelt i.p.v. een
           vlakke witte vorm. */}
        {neutral && (
          <View style={addHeroStyles.fill}>
            <Animated.View style={[StyleSheet.absoluteFill, wave1Style]}>
              <Svg width={WAVE_D * 2} height={WAVE_D}>
                <AnimatedPath animatedProps={wavePathBackProps} fill="rgba(255,255,255,0.2)" />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, wave2Style]}>
              <Svg width={WAVE_D * 2} height={WAVE_D}>
                <AnimatedPath animatedProps={wavePathFrontProps} fill="rgba(255,255,255,0.32)" />
              </Svg>
            </Animated.View>
          </View>
        )}
        <View style={[addHeroStyles.fill, addHeroStyles.fillOverlay]} />
        <Svg width={ADD_HERO_SIZE} height={ADD_HERO_SIZE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={ADD_HERO_SIZE / 2}
            cy={ADD_HERO_SIZE / 2}
            r={ADD_HERO_R}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={ADD_HERO_STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={ADD_HERO_SIZE / 2}
            cy={ADD_HERO_SIZE / 2}
            r={ADD_HERO_R}
            strokeWidth={ADD_HERO_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${ADD_HERO_C}, ${ADD_HERO_C}`}
            animatedProps={ringProps}
            fill="none"
            rotation={-90}
            origin={`${ADD_HERO_SIZE / 2}, ${ADD_HERO_SIZE / 2}`}
          />
        </Svg>

        {/* Operator, 21 september 2026 ("de grote cirkel ook geen tekst
           meer in"): `neutral` toont geen rijen meer — de cirkel is nu
           zuiver visueel (foto + witte tint + ring), de kaarten eronder
           dragen de eigenlijke State/Level/Routine/Times/Plan length-
           waarden al. Vervolg ("All set vinkje moet blijven staan na
           popup"): `celebrating` was een TIJDELIJKE viering (1.4s, zelfde
           timeout als de rest van de app) — bij `neutral` blijft het
           vinkje nu gewoon staan zolang `progress` vol is, ook nadat die
           timer afloopt en ook na het sluiten van een sheet. */}
        {(celebrating || !neutral || (neutral && progress >= 1)) && (
          <View style={addHeroStyles.content}>
            {celebrating || (neutral && progress >= 1) ? (
              <Animated.View style={[addHeroStyles.celebrate, celebrateStyle]}>
                <Check size={54} color="#ffffff" strokeWidth={3} />
                <Text style={addHeroStyles.celebrateTxt}>All set!</Text>
              </Animated.View>
            ) : (
              <View style={addHeroStyles.rows}>
                {rows.map((r) => (
                  <View key={r.label} style={addHeroStyles.row}>
                    <Text style={addHeroStyles.rowLabel}>{r.label}</Text>
                    <Text
                      style={[
                        addHeroStyles.rowValue,
                        !r.touched && addHeroStyles.rowValuePending,
                      ]}
                      numberOfLines={1}
                    >
                      {r.touched ? r.value : '—'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </>
  );
}

const addHeroStyles = StyleSheet.create({
  outerLabel: {
    marginTop: 20,
    alignSelf: 'center',
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
  },
  wrap: {
    width: ADD_HERO_SIZE,
    height: ADD_HERO_SIZE,
    alignSelf: 'center',
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    width: ADD_HERO_FILL_SIZE,
    height: ADD_HERO_FILL_SIZE,
    borderRadius: ADD_HERO_FILL_SIZE / 2,
    top: ADD_HERO_FILL_INSET,
    left: ADD_HERO_FILL_INSET,
    overflow: 'hidden',
  },
  fillTint: { opacity: 0.55 },
  fillTintNeutral: { opacity: 0.15 },
  fillOverlay: { backgroundColor: 'rgba(0,0,0,0.32)' },
  content: { alignItems: 'center', paddingHorizontal: 20 },
  rows: { marginTop: 12, gap: 9 },
  row: { alignItems: 'center' },
  rowLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  rowValue: {
    marginTop: 1,
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    color: '#ffffff',
  },
  rowValuePending: { color: 'rgba(255,255,255,0.3)' },
  celebrate: { alignItems: 'center' },
  celebrateTxt: {
    marginTop: 12,
    fontFamily: BrandFonts.bold,
    fontSize: 21,
    color: '#ffffff',
  },
});
