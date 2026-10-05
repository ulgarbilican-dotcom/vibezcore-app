/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Your protocol (State Control)

   Operator, 5 okt 2026 ("bij State Control heeft iemand ook gekozen welke
   states, zoveel per dag, timing en duur — zou op dezelfde manier een
   protocol samenstellen voor overzicht"): de tegenhanger van breathwork's
   "Check your protocol" (/plan). Eén rustig overzicht van wat je zelf
   samenstelde: welke modi, hoeveel sessies per dag, hoeveel tijd, hoe lang
   het plan loopt, en per sessie het uur, de modus en de duur. Een tik op
   een sessie start ze; wijzigen gebeurt in "Change protocol"
   (/bracelet-set-day), zoals bij breathwork.
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { BraceletMode, MODES, getModeMeta } from '@/services/ble-contract';
import { dayKey, useActiveBraceletPlan } from '@/utils/bracelet-plan-store';
import { openStateControl } from '@/utils/state-control-ui';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const HORIZON_LABEL: Record<string, string> = {
  today: 'Today only',
  '1w': '1 week',
  '2w': '2 weeks',
  '1m': '1 month',
  '3m': '3 months',
  ongoing: 'Ongoing',
};

function fmtTime(minutes: number): string {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60) % 24, minutes % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function BraceletProtocol() {
  const { plan } = useActiveBraceletPlan();
  const insets = useSafeAreaInsets();

  /* Vandaag, of — als vandaag leeg is — de eerste dag van het plan met
     sessies: het protocol is een sjabloon dat zich herhaalt. */
  const items = useMemo(() => {
    if (!plan) return [];
    const today = plan.days[dayKey(new Date())];
    const day =
      today && today.items.length > 0
        ? today
        : Object.values(plan.days).find((d) => d.items.length > 0);
    return [...(day?.items ?? [])].sort((a, b) => a.reminderAt - b.reminderAt);
  }, [plan]);

  const modesUsed = MODES.filter((m) => items.some((it) => it.mode === m.mode));
  const dailyMinutes = items.reduce((sum, it) => sum + it.durationMinutes, 0);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </Pressable>
        <Text style={s.barTitle}>Your protocol</Text>
        <View style={s.back} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: Math.max(insets.bottom, 12) + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {!plan || items.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyT}>No protocol yet</Text>
            <Text style={s.emptyB}>Choose your states, times and durations to build one.</Text>
            <Pressable style={s.primary} onPress={() => router.push('/bracelet-set-day' as never)}>
              <Text style={s.primaryTxt}>Set your plan</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* De gekozen modi, in hun eigen kleur. */}
            <View style={s.modeRow}>
              {modesUsed.map((m, i) => (
                <Animated.View
                  key={m.mode}
                  entering={FadeInUp.delay(120 + i * 40).duration(280)}
                  style={[s.modeChip, { backgroundColor: `${m.color}22`, borderColor: `${m.color}55` }]}
                >
                  <View style={[s.modeDot, { backgroundColor: m.color }]} />
                  <Text style={s.modeChipTxt}>{m.name}</Text>
                </Animated.View>
              ))}
            </View>

            {/* Kerncijfers — elk één keer, zoals breathwork's protocol. */}
            <View style={s.metaRow}>
              {[
                { label: 'A DAY', value: `${items.length} ${items.length === 1 ? 'session' : 'sessions'}` },
                { label: 'DAILY TIME', value: `${dailyMinutes} min` },
                { label: 'PLAN LENGTH', value: HORIZON_LABEL[plan.horizon] ?? plan.horizon },
              ].map((m, i) => (
                <Animated.View
                  key={m.label}
                  entering={FadeInUp.delay(120 + (modesUsed.length + i) * 40).duration(280)}
                  style={s.metaCard}
                >
                  <Text style={s.metaLabel}>{m.label}</Text>
                  <Text style={s.metaValue}>{m.value}</Text>
                </Animated.View>
              ))}
            </View>

            <Text style={s.section}>YOUR DAY</Text>
            {items.map((it, i) => {
              const meta = getModeMeta(it.mode as BraceletMode);
              return (
                <Pressable
                  key={`${it.reminderAt}-${i}`}
                  style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    openStateControl({
                      plan: 1,
                      mode: it.mode,
                      duration: it.durationMinutes,
                      from: 'plan',
                    });
                  }}
                  accessibilityLabel={`Start ${meta.name} at ${fmtTime(it.reminderAt)}, ${it.durationMinutes} minutes`}
                >
                  <View style={[s.cardAccent, { backgroundColor: meta.color }]} />
                  <Text style={s.cardTime}>{fmtTime(it.reminderAt)}</Text>
                  <View style={s.cardMain}>
                    <Text style={s.cardMode}>{meta.name}</Text>
                    <Text style={s.cardSub} numberOfLines={1}>
                      {it.durationMinutes} min · {meta.blurb}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.35)" strokeWidth={2.2} />
                </Pressable>
              );
            })}

            <Pressable
              style={s.change}
              onPress={() => router.push('/bracelet-set-day' as never)}
            >
              <Pencil size={13} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
              <Text style={s.changeTxt}>Change protocol</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  barTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: BrandFonts.semibold,
    fontSize: 17,
    color: '#ffffff',
  },
  scroll: { paddingHorizontal: 20, paddingTop: 12 },

  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
  modeDot: { width: 8, height: 8, borderRadius: 4 },
  modeChipTxt: { fontFamily: BrandFonts.semibold, fontSize: 13.5, color: '#ffffff' },

  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 26 },
  metaCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Brand.panel,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metaLabel: {
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.45)',
  },
  metaValue: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff', marginTop: 6 },

  section: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 14,
    marginBottom: 10,
    backgroundColor: Brand.panel,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  cardTime: {
    fontFamily: BrandFonts.bold,
    fontSize: 20,
    color: '#ffffff',
    minWidth: 64,
    fontVariant: ['tabular-nums'],
  },
  cardMain: { flex: 1 },
  cardMode: { fontFamily: BrandFonts.semibold, fontSize: 15.5, color: '#ffffff' },
  cardSub: { fontFamily: BrandFonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 },

  change: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginTop: 14,
  },
  changeTxt: { fontFamily: BrandFonts.semibold, fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyT: { fontFamily: BrandFonts.bold, fontSize: 17, color: '#ffffff' },
  emptyB: {
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  primary: {
    marginTop: 18,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryTxt: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#0a0a0a' },
});
