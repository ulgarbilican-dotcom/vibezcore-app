/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "leg je vinger op de camera"-animatie (hartslagmeting)

   Operator, 9 okt 2026: "een animatie met vinger en Touch ID — professioneel,
   Apple-niveau, niet kinderlijk". Beeldtaal van Apple's Touch ID/Face ID-
   instructies: fijne witte lijntekening, geen illustratie; teal enkel als
   licht. De achterkant van een telefoon met cameramodule; een vingertop
   (glas-wit, met een paar vingerafdruklijnen) glijdt rustig over de lenzen,
   blijft liggen terwijl de flits teal door de vinger gloeit, glijdt terug.
   Enkel transform/opacity met de native driver.
   ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

const W = 150;
const H = 160;
/* Middelpunt van de cameramodule (waar de vingertop landt). */
const CX = 62;
const CY = 44;
const FINGER_W = 40;
const FINGER_H = 86;
const LINE = 'rgba(255,255,255,0.42)';
const LINE_SOFT = 'rgba(255,255,255,0.22)';
const ACCENT = '#4AF0D4';

export default function FingerPlacementAnim() {
  const t = useRef(new Animated.Value(0)).current; // 0 = weg, 1 = op de lens
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.bezier(0.4, 0, 0.2, 1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(t, { toValue: 1, duration: 1100, easing: ease, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(glow, { toValue: 0, duration: 350, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(t, { toValue: 0, duration: 900, easing: ease, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, glow]);

  /* Vinger komt van rechtsonder en landt met de top op de lenzen. */
  const fingerStyle = {
    opacity: t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
      { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [70, 0] }) },
      { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['14deg', '0deg'] }) },
    ],
  };

  return (
    <View style={{ width: W, height: H }} accessible={false}>
      {/* Achterkant telefoon + cameramodule */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Rect x={30} y={8} width={90} height={146} rx={18} stroke={LINE} strokeWidth={1.4} fill="rgba(255,255,255,0.025)" />
        <Rect x={41} y={20} width={42} height={50} rx={12} stroke={LINE_SOFT} strokeWidth={1.2} fill="none" />
        <Circle cx={54} cy={34} r={7} stroke={LINE} strokeWidth={1.2} fill="none" />
        <Circle cx={54} cy={56} r={7} stroke={LINE} strokeWidth={1.2} fill="none" />
        <Circle cx={72} cy={34} r={3} fill="rgba(255,255,255,0.55)" />
      </Svg>

      {/* Flits die teal door de vinger gloeit */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glow }]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="fpGlow" cx={CX} cy={CY} r={40} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={ACCENT} stopOpacity={0.55} />
              <Stop offset="1" stopColor={ACCENT} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={CX} cy={CY} r={40} fill="url(#fpGlow)" />
        </Svg>
      </Animated.View>

      {/* Vingertop: glas-wit, dunne omlijning, fijne afdruklijnen */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', left: CX - FINGER_W / 2, top: CY - 16, width: FINGER_W, height: FINGER_H },
          fingerStyle,
        ]}
      >
        <Svg width={FINGER_W} height={FINGER_H}>
          <Defs>
            <LinearGradient id="fpFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity={0.2} />
              <Stop offset="1" stopColor="#ffffff" stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          <Path
            d={`M1 ${FINGER_H} V20 A19 19 0 0 1 39 20 V${FINGER_H}`}
            fill="url(#fpFill)"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={1.3}
          />
          {/* Vingerafdruk: concentrische bogen, zoals het Touch ID-symbool */}
          <Path d="M12 26 A8 8 0 0 1 28 26" stroke={LINE} strokeWidth={1} fill="none" strokeLinecap="round" />
          <Path d="M8 30 A12 12 0 0 1 32 30" stroke={LINE_SOFT} strokeWidth={1} fill="none" strokeLinecap="round" />
          <Path d="M16 25 A4 4 0 0 1 24 25 V31" stroke={LINE_SOFT} strokeWidth={1} fill="none" strokeLinecap="round" />
          <Path d="M5 36 A15 15 0 0 1 35 36" stroke="rgba(255,255,255,0.14)" strokeWidth={1} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}
