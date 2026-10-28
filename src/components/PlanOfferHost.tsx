/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "Set your plan" / "Set your goal" als glasblad (28 okt 2026, operator)

   Zelfde protocol als het Day Pass-blad (SalesNudgeHost): echt glas (GlassSheet + blurTarget), grijpstreepje, klein label, titel, één
   zin, witte hoofdknop, "Not now" als rustige tekstregel, onderdelen na elkaar in beeld, naar beneden vegen = sluiten. Eigen
   iconenstijl: de vijf toestanden als StateGlyph in een glazen cirkel met de toestandskleur (zoals op "Set your plan"), en de drie
   regels met een wit lijn-icoon in een glazen cirkel. Wanneer het blad verschijnt beslist utils/plan-offer.ts. Teksten goedgekeurd door de operator (28 okt 2026).
   ───────────────────────────────────────────────────────────────────────── */

import BalancedText from '@/components/BalancedText';
import { GlassSheet, afterGlassSheetClosed } from '@/components/GlassSheetHost';
import PressScale from '@/components/PressScale';
import StateGlyph from '@/components/StateGlyph';
import Tap from '@/components/Tap';
import VibezGlass from '@/components/VibezGlass';
import { BrandFonts, CTA_GLASS, CTA_GLOW } from '@/constants/theme';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { subscribePlanOfferSheet, type PlanOfferKind } from '@/utils/plan-offer';
import { rootBlurRef } from '@/utils/root-blur';
import { useSafeAreaInsets } from '@/utils/safe-area';
import { router } from 'expo-router';
import { Bell, Clock, SlidersHorizontal, Target, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const STATE_ORDER: BreathStateKey[] = ['boost', 'focus', 'calm', 'clarity', 'rest'];

const COPY: Record<PlanOfferKind, { eyebrow: string; title: string; body: string; rows: [LucideIcon, string][]; yes: string; href: string }> = {
  state: {
    eyebrow: 'STATE CONTROL',
    title: 'Set your plan',
    body: 'Plan the moments that matter in your day.',
    rows: [
      [Target, 'Pick a state for each moment'],
      [Clock, 'Choose your times and how long'],
      [Bell, "Get a reminder when it's time"],
    ],
    yes: 'Set my plan',
    href: '/bracelet-set-day',
  },
  breath: {
    eyebrow: 'BREATHWORK',
    title: 'Set your goal',
    body: 'Tell VIBEZCORE what you want to work on. You get a daily plan built around it.',
    rows: [
      [Target, 'Choose your goal'],
      [SlidersHorizontal, 'Set your level and routine'],
      [Clock, 'Choose your times and plan length'],
      [Bell, "Get a reminder when it's time"],
    ],
    yes: 'Set my goal',
    href: '/build-choice',
  },
};

/** Eén keer in de root-layout. */
export function PlanOfferHost() {
  const [kind, setKind] = useState<PlanOfferKind | null>(null);
  useEffect(() => subscribePlanOfferSheet(setKind), []);
  const close = () => setKind(null);
  const yes = () => {
    if (!kind) return;
    const href = COPY[kind].href;
    setKind(null);
    afterGlassSheetClosed(() => router.push(href as never));
  };
  return (
    <GlassSheet visible={kind !== null} onClose={close}>
      {kind ? <PlanOfferCard kind={kind} onYes={yes} onNotNow={close} /> : null}
    </GlassSheet>
  );
}

function PlanOfferCard({ kind, onYes, onNotNow }: { kind: PlanOfferKind; onYes: () => void; onNotNow: () => void }) {
  const c = COPY[kind];
  const insets = useSafeAreaInsets();
  /* Staggered reveal (UI-protocol): toestanden, titel, regels, knoppen na elkaar. */
  const parts = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      70,
      parts.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 380, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ),
    ).start();
  }, [parts]);
  const reveal = (i: number) => ({
    opacity: parts[i],
    transform: [{ translateY: parts[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  });

  return (
    <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
      <VibezGlass
        radius={24}
        level="sheet"
        blurTarget={rootBlurRef}
        style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
      />
      <Tap onPress={onNotNow} hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }} accessibilityLabel="Close">
        <View style={s.grip} />
      </Tap>
      <Animated.View style={[s.states, reveal(0)]}>
        {STATE_ORDER.map((k) => (
          <View key={k} style={s.stateBadge}>
            <VibezGlass radius={20} tint={BREATH_STATES[k].accent} level="raised" style={StyleSheet.absoluteFill} />
            <StateGlyph stateKey={k} size={19} color="#ffffff" strokeWidth={1.9} />
          </View>
        ))}
      </Animated.View>
      <Animated.View style={reveal(1)}>
        <Text style={s.eyebrow}>{c.eyebrow}</Text>
        <BalancedText style={s.title} accessibilityRole="header">
          {c.title}
        </BalancedText>
        <BalancedText style={s.body}>{c.body}</BalancedText>
      </Animated.View>
      <Animated.View style={[s.rows, reveal(2)]}>
        {c.rows.map(([Icon, label]) => (
          <View key={label} style={s.row}>
            <View style={s.rowBadge}>
              <VibezGlass radius={18} level="raised" style={StyleSheet.absoluteFill} />
              <Icon size={18} color="#ffffff" strokeWidth={1.9} />
            </View>
            <Text style={s.rowTxt}>{label}</Text>
          </View>
        ))}
      </Animated.View>
      <Animated.View style={reveal(3)}>
        <PressScale style={s.primary} onPress={onYes} scaleTo={0.97} haptic accessibilityRole="button" accessibilityLabel={c.yes}>
          <Text style={s.primaryTxt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {c.yes}
          </Text>
        </PressScale>
        <PressScale style={s.notNow} onPress={onNotNow} scaleTo={0.94} accessibilityRole="button" accessibilityLabel="Not now">
          <Text style={s.notNowTxt}>Not now</Text>
        </PressScale>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  grip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 18,
  },
  states: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  stateBadge: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: BrandFonts.semibold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)' },
  title: { fontFamily: BrandFonts.bold, fontSize: 26, letterSpacing: -0.4, color: '#ffffff', marginTop: 8 },
  body: { fontFamily: BrandFonts.medium, fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.75)', marginTop: 8 },
  rows: { marginTop: 18, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBadge: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  rowTxt: { flex: 1, fontFamily: BrandFonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.9)' },
  primary: {
    marginTop: 24,
    height: 52,
    borderRadius: 999,
    backgroundColor: CTA_GLASS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    ...CTA_GLOW,
  },
  primaryTxt: { color: '#0a0a0a', fontSize: 17, fontFamily: BrandFonts.semibold },
  notNow: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20, marginTop: 6 },
  notNowTxt: { color: 'rgba(255,255,255,0.75)', fontFamily: BrandFonts.medium, fontSize: 15 },
});
