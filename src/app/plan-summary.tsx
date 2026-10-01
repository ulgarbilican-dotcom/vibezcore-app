/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Confirm your protocol

   Laatste stap vóór de viering (operator, 13 augustus 2026): een
   samenvatting van wat er net is opgebouwd — doel, sessies, tijden — zodat
   een gebruiker bevestigt WAT hij aanzet, niet alleen dat hij een knop
   heeft ingedrukt. Het protocol staat al opgeslagen (plan-duration.tsx);
   dit scherm wijzigt niets, het rondt af.
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { BREATH_STATES } from '@/data/breath-states';
import { goalsByKeys } from '@/data/goals';
import { dayKey } from '@/utils/bracelet-history';
import { useActivePlan } from '@/utils/plan-store';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const INTENSITY_LABEL: Record<string, string> = {
  essential: 'Essential',
  standard: 'Standard',
  advanced: 'Advanced',
};

const HORIZON_LABEL: Record<string, string> = {
  today: 'Today',
  '1w': '1 week',
  '2w': '2 weeks',
  '1m': '1 month',
  '3m': '3 months',
  ongoing: 'Ongoing',
};

const fmtTime = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export default function PlanSummaryScreen() {
  const insets = useSafeAreaInsets();
  const { plan } = useActivePlan();
  /* Operator, 7 september 2026: "als user de hele agenda flow doorloopt
     moet hij toch altijd terug naar die step 7 kunnen gaan" — deze param
     moet dus doorgegeven blijven tot en met agenda.tsx, anders weet die
     niet meer dat terug naar de onboarding-stap moet i.p.v. naar Activity. */
  const { onboarding, fromBreathWelcome } = useLocalSearchParams<{
    onboarding?: string;
    fromBreathWelcome?: string;
  }>();

  const goalNames = plan ? goalsByKeys(plan.goals).map((g) => g.name) : [];
  const today = plan?.days[dayKey(new Date())] ?? null;

  const backScale = useSharedValue(1);
  const onBackPressIn = () => {
    backScale.value = withTiming(0.92, { duration: 80 });
  };
  const onBackPressOut = () => {
    backScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const backPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  const ctaScale = useSharedValue(1);
  const onCtaPressIn = () => {
    ctaScale.value = withTiming(0.96, { duration: 80 });
  };
  const onCtaPressOut = () => {
    ctaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const ctaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const confirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(
      onboarding
        ? ({
            pathname: '/plan-success',
            params: {
              onboarding: '1',
              ...(fromBreathWelcome ? { fromBreathWelcome } : {}),
            },
          } as never)
        : ('/plan-success' as never),
    );
  };

  if (!plan || !today) {
    return <SafeAreaView style={s.root} edges={['top']} />;
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.bar}>
        <AnimatedPressable
          /* Operator, 7 september 2026: "kan dat telkens met 1 klik [naar
             stap 7]?" — kwam je via breathwork-onboarding, dan rechtstreeks
             naar de bestaande stap-7-instantie. Anders de oude terugval
             (kaal `router.back()` kan niets doen als er niets op de
             back-stack staat). */
          onPress={() =>
            /* Operator, 11 september 2026: "eens je een echt actief plan
               hebt, hoort terug NOOIT meer naar onboarding te gaan" —
               `plan` bestaat hier altijd al (zie de `if (!plan...)` guard
               hierboven), dus zonder deze check sprong terug hier altijd
               naar onboarding-stap 6, exact de gerapporteerde lus. */
            fromBreathWelcome && !plan
              ? router.navigate({
                  pathname: '/breath-welcome',
                  /* Operator, 22 september 2026: breath-welcome.tsx's
                     slotscherm schoof van index 6 naar 4. */
                  params: { resumeStep: '4' },
                } as never)
              : router.canGoBack()
                ? router.back()
                : router.replace('/breath')
          }
          onPressIn={onBackPressIn}
          onPressOut={onBackPressOut}
          hitSlop={12}
          style={[s.back, backPressStyle]}
        >
          {/* Operator, 1 okt 2026 ("headers overal consistent"): size
             22→20, stroke 2.2→2.8 — de "officiële iOS-chevron.backward"-
             stijl uit build-choice.tsx (18 sept), nu de app-brede
             standaard. */}
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </AnimatedPressable>
        <Text style={s.title}>Confirm your protocol</Text>
        <View style={s.back} />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: Math.max(insets.bottom, 12) + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.lead}>
          {goalNames.length > 0 ? goalNames.join(' + ') : 'No goal set'} ·{' '}
          {INTENSITY_LABEL[plan.intensity]} · {HORIZON_LABEL[plan.horizon]}
        </Text>

        {today.items.map((it, i) => {
          const st = BREATH_STATES[it.state];
          return (
            <View key={`${it.slot}-${i}`} style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.slotLabel}>{it.slot.toUpperCase()}</Text>
                <Text style={s.time}>{fmtTime(it.reminderAt)}</Text>
              </View>
              <View style={s.stateRow}>
                <View style={[s.dot, { backgroundColor: st.accent }]} />
                <Text style={[s.stateName, { color: st.accent }]}>{st.eyebrow}</Text>
              </View>
              <Text style={[s.reason, { color: `${st.accent}B0` }]}>
                {it.reason} · {it.minutes} min
              </Text>
            </View>
          );
        })}

        <Text style={s.foot}>
          This repeats every day for the length of your plan. You can
          reshape it any time from your agenda.
        </Text>

        <AnimatedPressable
          style={[s.cta, ctaPressStyle]}
          onPress={confirm}
          onPressIn={onCtaPressIn}
          onPressOut={onCtaPressOut}
        >
          <Text style={s.ctaTxt}>CONFIRM MY PROTOCOL</Text>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: BrandFonts.bold,
    fontSize: 18,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  scroll: { paddingHorizontal: 16 },
  lead: {
    marginTop: 6,
    marginBottom: 18,
    fontFamily: BrandFonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(244,244,244,0.75)',
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  slotLabel: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.4)',
  },
  time: { fontFamily: BrandFonts.bold, fontSize: 14, color: '#ffffff' },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stateName: { fontFamily: BrandFonts.extrabold, fontSize: 16, letterSpacing: 0.5 },
  reason: { marginTop: 4, fontFamily: BrandFonts.regular, fontSize: 12.5 },

  foot: {
    marginTop: 6,
    marginBottom: 20,
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },

  cta: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: '#0a0a0a',
  },
});
