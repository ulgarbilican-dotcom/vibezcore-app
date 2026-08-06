/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Your plan

   Eigen pagina, gepusht vanuit Activity (operator, 6 augustus 2026). Een
   tabblad is een PLEK; alles wat een eigen pagina verdient hoort een gepusht
   scherm te zijn, anders krijg je een balk vol functies.

   ── Wat een dagplan hier is ───────────────────────────────────────────
   Twee momenten per dag. Niet vijf. Vijf voorstellen is een takenlijst, en
   die haalt niemand — en wie hem niet haalt opent de app morgen niet meer.

   Welke twee, dat volgt uit het DOEL en de klok, met dezelfde regels als de
   suggestie op de Breath-tab (utils/breath-suggestion.ts). Eén bron, twee
   plekken die hem lezen: zou het plan zijn eigen logica krijgen, dan stelt
   het scherm iets anders voor dan de tab en klopt geen van beide meer.

   ── Afgevinkt komt uit de historiek ───────────────────────────────────
   Niets aan te tikken. Wat je gedaan hebt staat al opgeslagen, en dat is
   waar het vinkje vandaan komt. Een plan waarin je zelf moet aangeven dat je
   iets gedaan hebt, is een tweede administratie naast de echte.
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { BREATH_STATES, cycleSeconds, roundsFor } from '@/data/breath-states';
import { goalByKey, type Goal } from '@/data/goals';
import { useBreathHistory } from '@/utils/breath-history';
import { suggestBreath } from '@/utils/breath-suggestion';
import { useSetting } from '@/utils/settings';
import { router, Stack } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* De twee momenten van een dag. Ochtend zet de toon, avond bouwt af — dat
   zijn de twee waar bijna iedereen ruimte voor heeft, en ze staan het verst
   uit elkaar. Wie er drie wil, kiest zelf een extra sessie; het plan hoeft
   niet je hele dag te vullen. */
const MOMENTS = [
  { key: 'morning', label: 'MORNING', hour: 8, from: 4, to: 12 },
  { key: 'evening', label: 'EVENING', hour: 21, from: 17, to: 24 },
] as const;

export default function PlanScreen() {
  const history = useBreathHistory();
  const [goalKey] = useSetting('goal');
  const goal = goalByKey(goalKey);

  const items = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    return MOMENTS.map((m) => {
      /* De suggestie voor DAT uur, niet voor nu. Zo staat er 's ochtends al
         wat je vanavond gaat doen, in plaats van twee keer hetzelfde. */
      const at = new Date(now);
      at.setHours(m.hour, 0, 0, 0);
      const sug = suggestBreath(history, at, goalKey);
      const st = BREATH_STATES[sug.state];
      const tech = st.techniques[0];
      const dur = st.durations[sug.durationIdx];

      /* Gedaan? Alles wat vandaag binnen dit dagdeel valt telt, ongeacht
         welke toestand — wie 's ochtends iets anders koos heeft zijn moment
         gehad. Het plan is een uitnodiging, geen voorschrift. */
      const done = history.some((e) => {
        if (e.ts < startOfDay.getTime()) return false;
        const h = new Date(e.ts).getHours();
        return h >= m.from && h < m.to;
      });

      return {
        moment: m,
        state: st,
        techName: tech.name,
        minutes: dur.minutes,
        exact: roundsFor(tech, dur.minutes) * cycleSeconds(tech),
        done,
      };
    });
  }, [history, goalKey]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <ChevronLeft size={22} color="rgba(255,255,255,0.75)" strokeWidth={2.2} />
        </Pressable>
        <Text style={s.title}>Your plan</Text>
        <View style={s.back} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.lead}>
          {goal
            ? `Two moments a day, shaped around ${goal.name.toLowerCase()}.`
            : 'Two moments a day. Pick a goal to shape them around what you want.'}
        </Text>

        {items.map((it) => (
          <View
            key={it.moment.key}
            style={[
              s.card,
              { borderColor: it.done ? `${it.state.accent}55` : 'rgba(255,255,255,0.09)' },
            ]}
          >
            <View style={s.cardTop}>
              <Text style={[s.moment, { color: it.state.accent }]}>
                {it.moment.label}
              </Text>
              {it.done && (
                <View style={[s.tick, { backgroundColor: it.state.accent }]}>
                  <Check size={12} color="#0a0a0a" strokeWidth={3} />
                </View>
              )}
            </View>

            <Text style={s.state}>{it.state.eyebrow}</Text>
            <Text style={s.detail}>
              {it.techName} · {it.minutes} min
            </Text>

            {it.done ? (
              <Text style={s.doneTxt}>Done today</Text>
            ) : (
              <Pressable
                style={[s.cta, { borderColor: it.state.accent }]}
                onPress={() =>
                  router.push({
                    pathname: '/breath-session',
                    params: { state: it.state.key },
                  })
                }
              >
                <Text style={[s.ctaTxt, { color: it.state.accent }]}>
                  START
                </Text>
              </Pressable>
            )}
          </View>
        ))}

        {!goal && (
          <Pressable style={s.goalCta} onPress={() => router.push('/goal' as never)}>
            <Text style={s.goalCtaTxt}>CHOOSE A GOAL</Text>
          </Pressable>
        )}

        <Text style={s.foot}>
          Nothing to tick off. What you do is saved as you go, and shows up
          here on its own.
        </Text>
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
  scroll: { paddingHorizontal: 16, paddingBottom: 30 },
  lead: {
    marginTop: 6,
    marginBottom: 18,
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.6)',
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moment: {
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 2.2,
  },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  state: {
    marginTop: 10,
    fontFamily: BrandFonts.bold,
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  detail: {
    marginTop: 3,
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
  cta: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 22,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { fontFamily: BrandFonts.bold, fontSize: 11.5, letterSpacing: 1.8 },
  doneTxt: {
    marginTop: 12,
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.45)',
  },

  goalCta: {
    marginTop: 6,
    alignSelf: 'center',
    paddingHorizontal: 26,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCtaTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 11.5,
    letterSpacing: 2,
    color: '#ffffff',
  },

  foot: {
    marginTop: 22,
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
});
