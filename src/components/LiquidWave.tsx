/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — de golf in een ronde vorm, overal dezelfde

   Operator, 6 okt 2026: "zorg dat de wave overal hetzelfde is, en heel
   belangrijk: supersmooth, mag niet onderbroken worden of blijven hangen."

   Exact de techniek van de breath-setup-ring (bevestigd vloeiend):
     · twee golflagen als ÉÉN vast pad van twee breedtes, dat enkel
       horizontaal verschuift (translateX, lineair, eindeloos) — dat loopt
       volledig op de UI-thread (Reanimated), dus geen hapering als
       JavaScript even bezig is, en geen 15-fps-hertekenen;
     · het pad heeft een periode van size/2, dus een verschuiving van één
       volle breedte sluit naadloos aan (geen sprong bij het herhalen);
     · het waterpeil is een gedeelde waarde; alleen de hoogte van het pad
       wordt per frame op de UI-thread herberekend.

   Vroeger rekenden State Control (keuzescherm, actieve sessie, plan) de
   golf in JavaScript opnieuw uit en tekenden hem ±15× per seconde — dat
   schokte en stokte.
   ───────────────────────────────────────────────────────────────────────── */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  /** Diameter van de ronde vorm. */
  size: number;
  /** Hoe vol, 0..1. */
  level: number;
  color: string;
  backOpacity?: number;
  frontOpacity?: number;
  /** 'choice' = een keuze (duur): het peil veert zacht na, zoals de
   *  breath-setup. 'drain' = een lopende sessie: het peil glijdt
   *  gelijkmatig tussen de updates, en leeg is echt leeg. */
  motion?: 'choice' | 'drain';
  /** Leeg binnenkomen en daarna vullen (bv. bij een modus-wissel). */
  fillOnMount?: boolean;
};

/* Tempo's en verhoudingen 1-op-1 uit breath-setup.tsx (WAVE_D ≈ 224:
   amplitude 9/7, 5200/3600 ms per breedte). */
const BACK_MS = 5200;
const FRONT_MS = 3600;

export default function LiquidWave({
  size,
  level,
  color,
  backOpacity = 0.1,
  frontOpacity = 0.15,
  motion = 'choice',
  fillOnMount,
}: Props) {
  const clamped = Math.max(0, Math.min(1, level));
  /* Peil → y van de waterlijn. Bij een keuze blijft er onderaan altijd wat
     water staan (breath-setup: 0.86); in een sessie loopt hij echt leeg. */
  const emptyY = motion === 'drain' ? size + size * 0.05 : size * 0.86;
  const fullY = size * 0.04;
  const yFor = (l: number) => emptyY - (emptyY - fullY) * l;

  const waterY = useSharedValue(fillOnMount ? emptyY : yFor(clamped));
  useEffect(() => {
    const target = yFor(clamped);
    if (motion === 'drain') {
      /* Updates komen ±1× per seconde: lineair glijden over die seconde
         geeft één doorlopende beweging, geen trapjes. */
      waterY.value = withTiming(target, { duration: 1000, easing: Easing.linear });
    } else {
      waterY.value = withSpring(target, { damping: 8, stiffness: 90, mass: 1 });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [clamped, motion, size]);
  useEffect(() => {
    if (!fillOnMount) return;
    waterY.value = withDelay(260, withSpring(yFor(clamped), { damping: 8, stiffness: 90, mass: 1 }));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const backX = useSharedValue(0);
  const frontX = useSharedValue(0);
  useEffect(() => {
    backX.value = 0;
    frontX.value = 0;
    backX.value = withRepeat(withTiming(-size, { duration: BACK_MS, easing: Easing.linear }), -1, false);
    frontX.value = withRepeat(withTiming(-size, { duration: FRONT_MS, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(backX);
      cancelAnimation(frontX);
    };
  }, [size, backX, frontX]);
  const backStyle = useAnimatedStyle(() => ({ transform: [{ translateX: backX.value }] }));
  const frontStyle = useAnimatedStyle(() => ({ transform: [{ translateX: frontX.value }] }));

  const ampBack = size * 0.04;
  const ampFront = size * 0.031;
  const backProps = useAnimatedProps(() => {
    const y = waterY.value + size * 0.027;
    return { d: wavePath(size, y, ampBack) };
  });
  const frontProps = useAnimatedProps(() => {
    const y = waterY.value - size * 0.018;
    return { d: wavePath(size, y, ampFront) };
  });

  return (
    <View
      pointerEvents="none"
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
        <Svg width={size * 2} height={size}>
          <AnimatedPath animatedProps={backProps} fill={color} fillOpacity={backOpacity} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
        <Svg width={size * 2} height={size}>
          <AnimatedPath animatedProps={frontProps} fill={color} fillOpacity={frontOpacity} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** De kleur en doorschijnendheid van de breath-setup-golf (operator, 6 okt
 *  2026: "visueel niet hetzelfde — breathwork heeft nog een transparante
 *  laag"): 10/15%, zodat beide lagen apart te zien zijn. Sleep (Bio-Teal)
 *  gebruikt daar de lichte #4AF0D4 op 20/30%, anders verdwijnt hij op zwart. */
export function breathWaveLook(color: string): { color: string; backOpacity: number; frontOpacity: number } {
  /* Operator, 10 okt 2026 ("de State Control-cirkel is fout groen"): het
     lichte #4AF0D4 op 20/30% werd op zwart dof grijsgroen. Nu het echte
     Bio-Teal #00A3A3 met meer dekking — leest als de huisstijl, zoals de
     ring en de pillen. Geldt ook voor de Sleep-cirkel van breathwork. */
  if (color.toUpperCase() === '#00A3A3') return { color: '#00A3A3', backOpacity: 0.4, frontOpacity: 0.55 };
  return { color, backOpacity: 0.1, frontOpacity: 0.15 };
}

/** Zelfde pad als breath-setup.tsx: vier S-bochten over twee breedtes
 *  (periode = size/2), onderaan dichtgemaakt. */
function wavePath(size: number, y: number, amp: number): string {
  'worklet';
  const p = size;
  const bottom = Math.max(size, y + amp) + 2;
  return (
    `M0 ${y} ` +
    `C ${p * 0.25} ${y - amp}, ${p * 0.25} ${y + amp}, ${p * 0.5} ${y} ` +
    `C ${p * 0.75} ${y - amp}, ${p * 0.75} ${y + amp}, ${p} ${y} ` +
    `C ${p * 1.25} ${y - amp}, ${p * 1.25} ${y + amp}, ${p * 1.5} ${y} ` +
    `C ${p * 1.75} ${y - amp}, ${p * 1.75} ${y + amp}, ${p * 2} ${y} ` +
    `L ${p * 2} ${bottom} L 0 ${bottom} Z`
  );
}
