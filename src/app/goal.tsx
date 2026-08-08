/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Your goal

   Eigen pagina in plaats van een uitschuifvenster (operator, 6 augustus
   2026). Een doel stuurt wat de app voorstelt en hoe je dagplan eruitziet;
   dat verdient een scherm waar ook uitgelegd staat wát het doet, niet een
   lijstje dat over je scherm schuift.

   Waarom vier en niet meer: alle vier zijn TOESTANDEN waar één sessie iets
   aan kan doen. Zelfvertrouwen en zelfbeheersing staan er bewust niet bij —
   dat zijn eigenschappen, en die verander je niet in vijf minuten. Ze als
   doel aanbieden belooft iets wat de app niet waarmaakt.
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { BREATH_STATES } from '@/data/breath-states';
import { GOALS, MAX_GOALS } from '@/data/goals';
import { useSetting } from '@/utils/settings';
import { router, Stack } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

export default function GoalScreen() {
  /* De navigatiebalk van het toestel hoort NIET over de laatste knop te
     vallen (operator, 7 augustus 2026: "see your plan staat half zichtbaar").
     Een vaste marge onderaan werkt niet — die is op het ene toestel te klein
     en op het andere een gat. */
  const insets = useSafeAreaInsets();

  const [goals, setGoals] = useSetting('goals');

  /* Aan- of uitzetten, vrij. Alle vier mogen (operator, 8 augustus 2026 —
     Headspace-onderzoek: meerdere doelen toestaan geeft hogere conversie).
     De volgorde van aantikken blijft bewaard: de eerste twee sturen de
     suggestie, zie goalRank. */
  const toggle = (key: string) => {
    const has = goals.includes(key);
    const next = has
      ? goals.filter((g) => g !== key)
      : [...goals, key].slice(-MAX_GOALS);
    void setGoals(next);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <ChevronLeft size={22} color="rgba(255,255,255,0.75)" strokeWidth={2.2} />
        </Pressable>
        <Text style={s.title}>Your goal</Text>
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
          Choose all that apply. What you pick first matters most for what
          gets suggested, and when — all five modes stay open.
        </Text>

        {GOALS.map((g) => {
          const on = goals.includes(g.key);
          return (
            <Pressable
              key={g.key}
              onPress={() => toggle(g.key)}
              style={[
                s.card,
                on && {
                  borderColor: g.accent,
                  backgroundColor: `${g.accent}12`,
                },
              ]}
            >
              <View style={s.head}>
                <View
                  style={[
                    s.iconWrap,
                    { backgroundColor: `${g.accent}1F`, borderColor: `${g.accent}55` },
                  ]}
                >
                  <g.Icon size={18} color={g.accent} strokeWidth={2.2} />
                </View>
                <Text style={[s.name, on && { color: g.accent }]}>
                  {g.name}
                </Text>
                {on && (
                  <View style={[s.tick, { backgroundColor: g.accent }]}>
                    <Check size={12} color="#0a0a0a" strokeWidth={3} />
                  </View>
                )}
              </View>

              <Text style={s.hint}>{g.hint}</Text>

              {/* Wat het CONCREET betekent. Zonder dit is een doel een woord
                  waar je op tikt zonder te weten wat er verandert. */}
              <Text style={s.leans}>
                Leans on{' '}
                {g.states
                  .slice(0, 2)
                  .map((k) => BREATH_STATES[k].eyebrow)
                  .join(' and ')}
              </Text>
            </Pressable>
          );
        })}

        <Text style={s.foot}>
          Tap a goal again to clear it. Without one, suggestions follow the
          time of day and what you actually do.
        </Text>

        <Pressable style={s.planCta} onPress={() => router.push('/plan' as never)}>
          <Text style={s.planCtaTxt}>SEE YOUR PLAN</Text>
        </Pressable>
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
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.6)',
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 18,
    marginBottom: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    fontFamily: BrandFonts.bold,
    fontSize: 17,
    color: Brand.text,
    letterSpacing: -0.2,
  },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 6,
    fontFamily: BrandFonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.62)',
  },
  leans: {
    marginTop: 8,
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.38)',
  },

  foot: {
    marginTop: 14,
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.35)',
  },
  planCta: {
    marginTop: 22,
    alignSelf: 'center',
    paddingHorizontal: 26,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCtaTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 11.5,
    letterSpacing: 2,
    color: '#ffffff',
  },
});
