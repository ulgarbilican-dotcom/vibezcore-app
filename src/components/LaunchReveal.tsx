/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — opstart-animatie (operator, 10 okt 2026: "de V-logo animeren,
   Apple-niveau"; voorstel goedgekeurd: "ok").

   Het systeem-opstartscherm is enkel zwart (geen V), zodat de V echt kan
   verschijnen. Zodra de app klaar is neemt dit het over (±1,3 s, enkel bij
   een koude start):
     1. het linkerbeen tekent zich van boven naar beneden, langs zijn eigen
        schuinte; een fractie later groeit het rechterbeen vanuit de punt
        omhoog (vloeiend vertragend);
     2. één lichtstreep glijdt over de V — het teken "staat";
     3. de V vervaagt en zakt licht weg terwijl de app eronder verschijnt.

   GEWIJZIGD 16 okt 2026 (operator: "zoals WHOOP — de V laten zien die
   overloopt naar VIBEZCORE"): na de lichtstreep schuift de V naar links en
   krimpt tot de eerste letter van het woordmerk; I B E Z C O R E vouwen er
   één voor één achter open (uit hetzelfde woordmerk-beeld als het
   welkomstscherm, per letter uitgesneden). Kort vasthouden, dan vervaagt
   het geheel en verschijnt de app. ±2 s, enkel bij een koude start.
   Geen gloed of kleur (operator: "die Bio-Teal bij opstart moet weg").
   De V = het VIBEZCORE-merkteken (keuze B, memory project-brand-v-mark).
   ───────────────────────────────────────────────────────────────────────── */

import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Reanimated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

export const LAUNCH_V_WIDTH = 84;
const VB_W = 71.4;
const VB_H = 68.85;
const V_H = (LAUNCH_V_WIDTH * VB_H) / VB_W;
const LEFT: number[][] = [[0, 0], [16.8, 0], [42.8, 68.85], [26, 68.85]];
const RIGHT: number[][] = [[54.6, 0], [71.4, 0], [49.89, 56.95], [41.49, 34.71]];
const TIP_Y = 56.95;

/* Tijdlijn in ms (één klok, t = 0…TOTAL). */
const L0 = 0, L1 = 480; // linkerbeen
const R0 = 140, R1 = 640; // rechterbeen
const S0 = 640, S1 = 1000; // lichtstreep
const U0 = 1000, U1 = 1420; // V schuift naar zijn plek in het woordmerk
const LETTER0 = 1260, LETTER_STEP = 35, LETTER_DUR = 260; // I B E Z C O R E — pas als de V bijna op zijn plek is
const O0 = 2450, O1 = 2850; // onthulling — VIBEZCORE staat ±0,7 s volledig in beeld (operator 16 okt: "iets langer in beeld")
const TOTAL = O1;

/* Het woordmerk (zelfde beeld als het welkomstscherm): 1175 × 83 px, de
   negen letters staan op deze kolommen (gemeten op de alfa). */
const WM_SRC = require('../../assets/vibezcore_wordmark_spaced.png');
const WM_PX_W = 1175;
const WM_PX_H = 83;
const LETTERS: [number, number][] = [
  [0, 87], // V
  [151, 161], // I
  [234, 303], // B
  [377, 446], // E
  [520, 588], // Z
  [662, 733], // C
  [807, 890], // O
  [964, 1033], // R
  [1107, 1175], // E
];
const WM_W = 240;
const K = WM_W / WM_PX_W;
const WM_H = WM_PX_H * K;
/* De V landt op de plaats en grootte van de V in het woordmerk. */
const V_TARGET_X = -WM_W / 2 + ((LETTERS[0][0] + LETTERS[0][1]) / 2) * K;
const V_TARGET_SCALE = ((LETTERS[0][1] - LETTERS[0][0]) * K) / LAUNCH_V_WIDTH;

/* Polygoon knippen tegen het halfvlak a·x + b·y + c ≥ 0 (Sutherland–Hodgman). */
function clip(poly: number[][], a: number, b: number, c: number): number[][] {
  'worklet';
  const out: number[][] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] + c;
    const dq = a * q[0] + b * q[1] + c;
    if (dp >= 0) out.push(p);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

function toPath(poly: number[][]): string {
  'worklet';
  if (poly.length < 3) return 'M0 0';
  let d = `M${poly[0][0].toFixed(2)} ${poly[0][1].toFixed(2)}`;
  for (let i = 1; i < poly.length; i++) d += ` L${poly[i][0].toFixed(2)} ${poly[i][1].toFixed(2)}`;
  return d + ' Z';
}

function phase(t: number, a: number, b: number): number {
  'worklet';
  return Math.max(0, Math.min(1, (t - a) / (b - a)));
}

function easeOutCubic(x: number): number {
  'worklet';
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(x: number): number {
  'worklet';
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Eén letter uit het woordmerk, uitgesneden met overflow:hidden. */
function Letter({ index, t }: { index: number; t: SharedValue<number> }) {
  const [x0, x1] = LETTERS[index];
  const a = LETTER0 + (index - 1) * LETTER_STEP;
  const st = useAnimatedStyle(() => {
    const e = easeOutCubic(phase(t.value, a, a + LETTER_DUR));
    return { opacity: e, transform: [{ translateX: -10 * (1 - e) }] };
  });
  return (
    <Reanimated.View
      style={[
        { position: 'absolute', left: x0 * K, top: 0, width: (x1 - x0) * K, height: WM_H, overflow: 'hidden' },
        st,
      ]}
    >
      <Image
        source={WM_SRC}
        style={{ position: 'absolute', left: -x0 * K, top: 0, width: WM_W, height: WM_H, tintColor: '#ffffff' }}
        resizeMode="stretch"
      />
    </Reanimated.View>
  );
}

let trigger: (() => void) | null = null;
let pending = false;

/* 28 okt 2026 (operator: "de eerste foto van de intro zoomt niet in", Android): het intro-scherm wordt onder de opstart-animatie
   gemonteerd en zijn inzoom (650 ms + 3,4 s) liep al terwijl die animatie er nog overheen lag — bij het zichtbaar worden was de zoom bijna af.
   Schermen die op de opening willen wachten melden zich hier; ze krijgen het sein zodra de app begint door te schemeren (O0). Bij een
   warme navigatie (opnieuw bekijken via Instellingen) is de app al zichtbaar en gebeurt het meteen. Vangnet: na 5 s sowieso. */
let appVisible = false;
const visibleWaiters = new Set<() => void>();
function markAppVisible(): void {
  if (appVisible) return;
  appVisible = true;
  visibleWaiters.forEach((w) => w());
  visibleWaiters.clear();
}
export function whenAppVisible(cb: () => void): () => void {
  if (appVisible) {
    cb();
    return () => {};
  }
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    cb();
  };
  visibleWaiters.add(fire);
  const safety = setTimeout(() => {
    visibleWaiters.delete(fire);
    fire();
  }, 5000);
  return () => {
    visibleWaiters.delete(fire);
    clearTimeout(safety);
    fired = true;
  };
}

/** In plaats van SplashScreen.hideAsync(): systeembeeld weg, animatie start. */
export function revealApp(): void {
  if (trigger) trigger();
  else pending = true;
}

export default function LaunchReveal() {
  const [done, setDone] = useState(false);
  const t = useSharedValue(0);

  useEffect(() => {
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      SplashScreen.hideAsync().catch(() => {});
      setTimeout(markAppVisible, O0);
      t.value = withTiming(TOTAL, { duration: TOTAL, easing: Easing.linear }, (fin) => {
        if (fin) scheduleOnRN(setDone, true);
      });
    };
    trigger = start;
    if (pending) start();
    return () => {
      trigger = null;
    };
  }, [t]);

  const leftProps = useAnimatedProps(() => {
    const e = easeOutCubic(phase(t.value, L0, L1));
    const sp = phase(t.value, S0, S1);
    return { d: toPath(clip(LEFT, 0, -1, VB_H * e)), fillOpacity: sp > 0 && sp < 1 ? 0.82 : 1 };
  });
  const rightProps = useAnimatedProps(() => {
    const e = easeOutCubic(phase(t.value, R0, R1));
    const sp = phase(t.value, S0, S1);
    return { d: toPath(clip(RIGHT, 0, 1, -TIP_Y * (1 - e))), fillOpacity: sp > 0 && sp < 1 ? 0.82 : 1 };
  });
  /* Lichtstreep: schuine band (zelfde richting als de benen) van links naar
     rechts, enkel binnen de V. Tijdens de streep staat de V op 82% wit, de
     streep zelf op 100% — daarna is de hele V weer volledig wit. */
  const sheen = (poly: number[][], x: number) => {
    'worklet';
    const w = 7;
    const a = clip(poly, 1, -0.38, -(x - w));
    return toPath(clip(a, -1, 0.38, x + w));
  };
  const sheenLProps = useAnimatedProps(() => {
    const p = phase(t.value, S0, S1);
    const x = -15 + p * 115;
    return { d: p > 0 && p < 1 ? sheen(LEFT, x) : 'M0 0' };
  });
  const sheenRProps = useAnimatedProps(() => {
    const p = phase(t.value, S0, S1);
    const x = -15 + p * 115;
    return { d: p > 0 && p < 1 ? sheen(RIGHT, x) : 'M0 0' };
  });
  const vStyle = useAnimatedStyle(() => {
    const u = easeInOutCubic(phase(t.value, U0, U1));
    return {
      transform: [
        { translateX: V_TARGET_X * u },
        { scale: 1 - (1 - V_TARGET_SCALE) * u },
      ],
    };
  });
  const groupStyle = useAnimatedStyle(() => {
    const o = easeInOutCubic(phase(t.value, O0, O1));
    return { opacity: 1 - o, transform: [{ scale: 1 - 0.06 * o }] };
  });
  const bgStyle = useAnimatedStyle(() => {
    const o = phase(t.value, O0 + 80, O1);
    return { opacity: 1 - o };
  });

  if (done) return null;
  return (
    <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.bg, bgStyle]}>
      <Reanimated.View style={[s.center, groupStyle]}>
        {/* I B E Z C O R E, rechts van de plek waar de V landt. */}
        <View style={s.word}>
          {LETTERS.slice(1).map((_, i) => (
            <Letter key={i + 1} index={i + 1} t={t} />
          ))}
        </View>
        <Reanimated.View style={vStyle}>
          <Svg width={LAUNCH_V_WIDTH} height={V_H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <AnimatedPath animatedProps={leftProps} fill="#ffffff" />
            <AnimatedPath animatedProps={rightProps} fill="#ffffff" />
            <AnimatedPath animatedProps={sheenLProps} fill="#ffffff" />
            <AnimatedPath animatedProps={sheenRProps} fill="#ffffff" />
          </Svg>
        </Reanimated.View>
      </Reanimated.View>
    </Reanimated.View>
  );
}

const s = StyleSheet.create({
  bg: { backgroundColor: '#0a0a0a', zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  word: { position: 'absolute', width: WM_W, height: WM_H },
});
