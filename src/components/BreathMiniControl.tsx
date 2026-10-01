/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Breath session mini-control

   Iter v149 v3 (2026-06-25): floating overlay die verschijnt wanneer een
   breath-sessie loopt EN user is niet op de breath-tab. Operator-feedback:
   user wegklikt uit breath, sessie blijft doorpraten (correct), maar het
   was niet duidelijk waar het vandaan komt of hoe het te stoppen.

   Plaatst zich onder de status-bar als een dunne pill-bar met:
   - Mode-kleurige indicator-stip (kloppt subtiel)
   - 'Breath: [pattern name]' label (tap → naar breath-tab)
   - Stop-knop (X) rechts

   Visibility-logica:
   - global breath-session-state's isRunning = true
   - huidige route is NIET /breath
   ─────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import {
  getBreathSession,
  subscribeBreathSession,
  type BreathSessionInfo,
} from '@/services/breath-session-state';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

export function BreathMiniControl(): React.ReactElement | null {
  const [session, setSession] = useState<BreathSessionInfo>(getBreathSession());
  const pathname = usePathname();

  useEffect(() => {
    const unsub = subscribeBreathSession(() => {
      setSession({ ...getBreathSession() });
    });
    return unsub;
  }, []);

  /* Heartbeat-pulse op de indicator-dot zodat user direct ziet dat er
     iets actief is. Subtiel — animeert tussen 0.5 en 1.0 opacity. */
  const pulseRef = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (!session.isRunning) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRef, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseRef, {
          toValue: 0.5,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [session.isRunning, pulseRef]);

  const barPressScale = useSharedValue(1);
  const onBarPressIn = () => {
    barPressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onBarPressOut = () => {
    barPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const barPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: barPressScale.value }],
  }));

  const stopPressScale = useSharedValue(1);
  const onStopPressIn = () => {
    stopPressScale.value = withTiming(0.92, { duration: 80 });
  };
  const onStopPressOut = () => {
    stopPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const stopPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: stopPressScale.value }],
  }));

  if (!session.isRunning) return null;
  /* Op de breath-tab zelf is mini-control overbodig (dubbele UI). */
  const isOnBreathTab =
    pathname === '/breath' ||
    pathname === '/(tabs)/breath' ||
    pathname?.endsWith('/breath');
  if (isOnBreathTab) return null;

  const color = session.patternColor ?? Brand.accent;

  return (
    <SafeAreaView
      edges={['top']}
      style={s.safe}
      pointerEvents="box-none"
    >
      <AnimatedPressable
        style={[s.bar, { borderColor: color }, barPressStyle]}
        onPress={() => router.navigate('/breath')}
        onPressIn={onBarPressIn}
        onPressOut={onBarPressOut}
        accessibilityLabel="Open active breath session"
      >
        <Animated.View
          style={[s.dot, { backgroundColor: color, opacity: pulseRef }]}
        />
        <Text style={s.label} numberOfLines={1}>
          Breath ·{' '}
          <Text style={[s.labelStrong, { color }]}>
            {session.patternName ?? 'Active'}
          </Text>
        </Text>
        <AnimatedPressable
          hitSlop={12}
          style={[s.stopBtn, stopPressStyle]}
          onPress={() => {
            try {
              session.onStop?.();
            } catch {
              /* swallow */
            }
          }}
          onPressIn={onStopPressIn}
          onPressOut={onStopPressOut}
          accessibilityLabel="Stop breath session"
        >
          <Text style={s.stopBtnX}>✕</Text>
        </AnimatedPressable>
      </AnimatedPressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
  },
  bar: {
    marginTop: 6,
    marginHorizontal: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(10,10,10,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    minWidth: 200,
    maxWidth: 360,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  label: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    flex: 1,
    letterSpacing: 0.1,
  },
  labelStrong: {
    fontFamily: BrandFonts.semibold,
  },
  stopBtn: {
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stopBtnX: {
    color: Brand.textDim,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    lineHeight: 18,
  },
});
