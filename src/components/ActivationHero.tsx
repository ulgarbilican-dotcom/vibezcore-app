/* "Your protocol is live": een rustige, levende bevestiging dat er iets is geactiveerd.
   Drie Bio-Teal ringen die langzaam naar buiten ademen rond een glazen kern met een opkomende
   zon, en eronder "OWN YOUR DAY". 22 okt 2026 (operator: het scherm voelde dood).
   Bewust de kern-`Animated` (native driver) en niet Reanimated: op dit scherm gaf een oneindige
   worklet-animatie die tegelijk met de intro startte eerder een crash (zie plan-success.tsx). */
import { Sunrise } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import VibezGlass from '@/components/VibezGlass';
import { AudioAccent, BrandFonts } from '@/constants/theme';

const CORE = 124;
const RING = 124;

export default function ActivationHero() {
  const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    /* Pas starten na de intro (zelfde reden als hierboven). */
    const t = setTimeout(() => {
      rings.forEach((v, i) => {
        const loop = Animated.loop(
          Animated.timing(v, { toValue: 1, duration: 3600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        );
        setTimeout(() => loop.start(), i * 1200);
      });
    }, 900);
    return () => clearTimeout(t);
  }, [enter, rings]);

  return (
    <Animated.View style={[s.wrap, { opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
      <View style={s.stage}>
        {rings.map((v, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              s.ring,
              {
                opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
                transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
              },
            ]}
          />
        ))}
        <View style={s.core}>
          <VibezGlass radius={CORE / 2} level="raised" tint={AudioAccent} style={StyleSheet.absoluteFill} />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(74,240,212,0.32)', 'rgba(0,163,163,0.06)']}
            style={StyleSheet.absoluteFill}
          />
          <Sunrise size={46} color="#ffffff" strokeWidth={1.6} />
        </View>
      </View>
      <Text style={s.label}>OWN YOUR DAY</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  stage: { width: RING * 2.6, height: RING * 2.6, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.5,
    borderColor: '#4AF0D4',
  },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 6,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.78)',
  },
});
