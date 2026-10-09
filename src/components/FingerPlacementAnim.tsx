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
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

const W = 160;
const H = 176;
/* Telefoon in echte iPhone-verhouding (~1 : 2,05). */
const PX = 44;
const PY = 10;
const PW = 74;
const PH = 152;
/* Cameramodule linksboven, lenzen diagonaal + flits. */
const MX = PX + 7;
const MY = PY + 7;
const MS = 31;
const L1 = { x: MX + 9, y: MY + 9 };
const L2 = { x: MX + 22, y: MY + 22 };
const FL = { x: MX + 22.5, y: MY + 8.5 };
/* Waar de vingertop landt: midden van de module. */
const TIP = { x: MX + MS / 2, y: MY + MS / 2 - 3 };
const TILT = -24; // vinger komt schuin van rechtsonder
const LINE = 'rgba(255,255,255,0.42)';
const LINE_SOFT = 'rgba(255,255,255,0.22)';
const ACCENT = '#4AF0D4';

/* Wijsvinger van achteren gezien, top op (15,2), lengte ~150. */
const FINGER = 'M1 152 C2 104 3.5 64 3.5 26 C3.5 11 8.5 2 15 2 C21.5 2 26.5 11 26.5 26 C26.5 64 28 104 29 152';
const NAIL = 'M8.6 22 C8.6 13.5 11.2 8.5 15 8.5 C18.8 8.5 21.4 13.5 21.4 22 L21 33 C17.6 35 12.4 35 9 33 Z';

export default function FingerPlacementAnim() {
  const t = useRef(new Animated.Value(0)).current; // 0 = weg, 1 = op de lens
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.bezier(0.4, 0, 0.2, 1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(t, { toValue: 1, duration: 1150, easing: ease, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(glow, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(t, { toValue: 0, duration: 950, easing: ease, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, glow]);

  /* Vinger schuift langs zijn eigen as (schuin van rechtsonder) naar de lens. */
  const rad = (TILT * Math.PI) / 180;
  const slide = 64;
  const fingerStyle = {
    opacity: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-Math.sin(rad) * slide, 0] }) },
      { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [Math.cos(rad) * slide, 0] }) },
    ],
  };

  return (
    <View style={{ width: W, height: H }} accessible={false}>
      {/* Achterkant telefoon + cameramodule */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Rect x={PX} y={PY} width={PW} height={PH} rx={15} stroke={LINE} strokeWidth={1.3} fill="rgba(255,255,255,0.025)" />
        <Rect x={MX} y={MY} width={MS} height={MS} rx={9} stroke={LINE_SOFT} strokeWidth={1.1} fill="rgba(255,255,255,0.03)" />
        <Circle cx={L1.x} cy={L1.y} r={5.2} stroke={LINE} strokeWidth={1.1} fill="none" />
        <Circle cx={L1.x} cy={L1.y} r={2.2} stroke={LINE_SOFT} strokeWidth={0.8} fill="none" />
        <Circle cx={L2.x} cy={L2.y} r={5.2} stroke={LINE} strokeWidth={1.1} fill="none" />
        <Circle cx={L2.x} cy={L2.y} r={2.2} stroke={LINE_SOFT} strokeWidth={0.8} fill="none" />
        <Circle cx={FL.x} cy={FL.y} r={2.3} fill="rgba(255,255,255,0.5)" />
      </Svg>

      {/* Flits die teal door de vinger gloeit */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glow }]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="fpGlow" cx={TIP.x} cy={TIP.y + 4} r={34} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={ACCENT} stopOpacity={0.6} />
              <Stop offset="1" stopColor={ACCENT} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={TIP.x} cy={TIP.y + 4} r={34} fill="url(#fpGlow)" />
        </Svg>
      </Animated.View>

      {/* Wijsvinger: glas-wit, nagel, fijne kreukels bij het gewricht */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fingerStyle]}>
        <Svg width={W} height={H}>
          <Defs>
            <LinearGradient id="fpFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity={0.2} />
              <Stop offset="1" stopColor="#ffffff" stopOpacity={0.03} />
            </LinearGradient>
          </Defs>
          <G transform={`translate(${TIP.x - 15} ${TIP.y - 2}) rotate(${TILT} 15 2)`}>
            <Path d={FINGER} fill="url(#fpFill)" stroke="rgba(255,255,255,0.62)" strokeWidth={1.2} strokeLinejoin="round" />
            <Path d={NAIL} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.38)" strokeWidth={0.9} />
            <Path d="M7 60 Q15 63 23 60" stroke={LINE_SOFT} strokeWidth={0.9} fill="none" strokeLinecap="round" />
            <Path d="M9 65 Q15 67 21 65" stroke="rgba(255,255,255,0.14)" strokeWidth={0.9} fill="none" strokeLinecap="round" />
            <Path d="M6 104 Q15 107 24 104" stroke="rgba(255,255,255,0.14)" strokeWidth={0.9} fill="none" strokeLinecap="round" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
