/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — pill van een geminimaliseerde ademsessie

   Operator, 5 okt 2026 (breathwork minimaliseren): verschijnt zodra de
   ademsessie-laag geminimaliseerd is (services/breath-session-host.ts).
   Een tik schuift de sessie terug omhoog, precies waar ze was. Geen stop-
   knop hier — stoppen gebeurt bewust enkel via "End session" in de sessie
   zelf (zelfde regel als State Control). Zelfde VIBEZCORE-glas en plek als
   de State Control-pill; lopen beide, dan staat deze er net onder.

   Vervangt de vorige versie, die aan `breath-session-state` hing — die werd
   nergens meer gevuld, dus de pill verscheen nooit (audit 5 okt 2026).
   ─────────────────────────────────────────────────────────────────────── */

import { BrandFonts, Brand } from '@/constants/theme';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { getBraceletSessionSnapshot, subscribeBraceletSession } from '@/services/bracelet-session-state';
import { getBreathHost, restoreBreathSession, subscribeBreathHost } from '@/services/breath-session-host';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StateGlyph from './StateGlyph';
import VibezGlass from './VibezGlass';

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

export function BreathMiniControl(): React.ReactElement | null {
  const [host, setHost] = useState(getBreathHost());
  useEffect(() => subscribeBreathHost(() => setHost(getBreathHost())), []);
  const [bracelet, setBracelet] = useState(getBraceletSessionSnapshot());
  useEffect(() => subscribeBraceletSession(setBracelet), []);
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!host || !host.minimized) return null;

  const key = (host.params.state ?? host.params.mode ?? 'calm') as BreathStateKey;
  const st = BREATH_STATES[key] ?? BREATH_STATES.calm;
  const top = insets.top + 8 + (bracelet.active ? 46 : 0);

  return (
    <View style={[s.wrap, { top }]} pointerEvents="box-none">
      <AnimatedPressable
        style={pressStyle}
        onPress={restoreBreathSession}
        onPressIn={() => {
          scale.value = withTiming(0.96, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
        }}
        accessibilityLabel={`Open your ${st.eyebrow} breathing session`}
      >
        <VibezGlass radius={999} tint={st.accent} style={s.pill}>
          <StateGlyph stateKey={st.key} size={15} color="#ffffff" strokeWidth={2} />
          <Text style={s.label} numberOfLines={1}>
            {/* Zelfde schrijfwijze als overal ("Clarity & Relax", niet "Clarity & relax"). */}
            Breathwork · {st.eyebrow.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
        </VibezGlass>
      </AnimatedPressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 41,
    elevation: 41,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '90%',
  },
  label: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
