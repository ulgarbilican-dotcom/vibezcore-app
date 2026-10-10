/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — opstart-onthulling (operator, 10 okt 2026: "bij opstart de V
   veranderen, beetje groter, en kan dat geanimeerd worden — Apple-niveau").

   Het systeem-opstartbeeld (Android SplashScreen / iOS launch screen) kan
   zelf niet bewegen. Daarom ligt hieronder een identiek beeld (zelfde V,
   zelfde maat, zelfde plek, #0a0a0a). Op het moment dat de app klaar is,
   verdwijnt het systeembeeld onzichtbaar en neemt dit het over:
     1. een zachte Bio-Teal-gloed licht kort op achter de V;
     2. de V zwelt licht aan en vervaagt, de achtergrond vloeit weg —
        de app komt tevoorschijn (±0,6 s).
   De V = het VIBEZCORE-merkteken (keuze B, zie memory project-brand-v-mark).
   ───────────────────────────────────────────────────────────────────────── */

import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Breedte van de V op het opstartbeeld, in dp — gelijk aan de PNG in
 *  android/app/src/main/res/drawable-*dpi/splashscreen_logo.png. */
export const LAUNCH_V_WIDTH = 76;
const V_H = (LAUNCH_V_WIDTH * 68.85) / 71.4;

let trigger: (() => void) | null = null;
let pending = false;

/** In plaats van SplashScreen.hideAsync(): systeembeeld weg, animatie start. */
export function revealApp(): void {
  if (trigger) trigger();
  else pending = true;
}

export default function LaunchReveal() {
  const [done, setDone] = useState(false);
  const glow = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  useEffect(() => {
    const start = () => {
      if (started.current) return;
      started.current = true;
      SplashScreen.hideAsync().catch(() => {});
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(glow, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(out, { toValue: 1, duration: 520, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
        ]),
      ]).start(() => setDone(true));
    };
    trigger = start;
    if (pending) start();
    return () => {
      trigger = null;
    };
  }, [glow, out]);

  if (done) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, s.bg, { opacity: out.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1, 0] }) }]}
    >
      <View style={s.center}>
        <Animated.View style={[s.glow, { opacity: glow }]}>
          <Svg width={260} height={260}>
            <Defs>
              <RadialGradient id="lg" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#00A3A3" stopOpacity={0.45} />
                <Stop offset="1" stopColor="#00A3A3" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={260} height={260} fill="url(#lg)" />
          </Svg>
        </Animated.View>
        <Animated.View
          style={{
            opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
          }}
        >
          <Svg width={LAUNCH_V_WIDTH} height={V_H} viewBox="0 0 71.4 68.85">
            <Polygon points="0,0 16.8,0 42.8,68.85 26,68.85" fill="#ffffff" />
            <Polygon points="54.6,0 71.4,0 49.89,56.95 41.49,34.71" fill="#ffffff" />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  bg: { backgroundColor: '#0a0a0a', zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 260, height: 260 },
});
