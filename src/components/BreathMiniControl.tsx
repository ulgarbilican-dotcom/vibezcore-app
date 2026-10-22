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
import {
  getBreathHost,
  getRunningBreathStatus,
  restoreBreathSession,
  subscribeBreathHost,
} from '@/services/breath-session-host';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from '@/utils/safe-area';
import { usePathname } from 'expo-router';
import StateGlyph from './StateGlyph';
import VibezGlass from './VibezGlass';

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

function fmtMMSS(sec: number): string {
  const t = Math.max(0, Math.round(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/* Operator, 10 okt 2026 ("pill over de paginatitel" → "balk onderaan"):
   op tabbladen gedockt net boven de tabbalk (zie (tabs)/_layout.tsx), op
   schermen zonder tabbalk zwevend onderaan — nooit meer over een titel. */
const TAB_ROUTES = new Set(['/', '/breath', '/bracelet', '/activity', '/account']);

export function BreathMiniControl({ docked = false }: { docked?: boolean } = {}): React.ReactElement | null {
  const pathname = usePathname();
  const [host, setHost] = useState(getBreathHost());
  useEffect(() => subscribeBreathHost(() => setHost(getBreathHost())), []);
  const insets = useSafeAreaInsets();
  /* Audit 12 okt 2026: zoals de State Control-pill — "Paused" en de
     resterende tijd, elke seconde bijgewerkt zolang de pill zichtbaar is. */
  const minimized = !!host?.minimized;
  const [status, setStatus] = useState(getRunningBreathStatus());
  useEffect(() => {
    if (!minimized) return;
    setStatus(getRunningBreathStatus());
    const id = setInterval(() => setStatus(getRunningBreathStatus()), 1000);
    return () => clearInterval(id);
  }, [minimized]);

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!host || !host.minimized) return null;
  /* De zwevende variant enkel waar geen tabbalk is; op tabbladen doet de dock het. */
  if (!docked && TAB_ROUTES.has(pathname)) return null;

  const key = (host.params.state ?? host.params.mode ?? 'calm') as BreathStateKey;
  const st = BREATH_STATES[key] ?? BREATH_STATES.calm;
  return (
    <View
      /* Zonder tabbalk: net BOVEN de vaste hoofdknop-zone onderaan (knop
         56 hoog, 26 boven de veilige rand, overal in de app dezelfde) —
         nooit over "Start session" of een andere CTA. */
      style={docked ? s.dockWrap : [s.wrap, { bottom: insets.bottom + 26 + 56 + 14 }]}
      pointerEvents="box-none"
    >
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
          {status ? (
            <Text style={s.time}>
              {status.paused ? `Paused · ${fmtMMSS(status.remainingSec)}` : fmtMMSS(status.remainingSec)}
            </Text>
          ) : null}
        </VibezGlass>
      </AnimatedPressable>
    </View>
  );
}

const s = StyleSheet.create({
  dockWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 14 },
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
  time: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    opacity: 0.85,
  },
  label: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
