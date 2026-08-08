/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — De vragenlijst na de onboarding

   Drie vragen en dan het ANTWOORD terug (operator, 8 augustus 2026: "gewoon
   laten invullen heeft voor niemand zin — wat bieden wij na die vragenlijst
   aan?"). Elke vraag verdient zijn plek doordat er iets mee gebeurt, en de
   laatste stap laat dat zien:

     1. Doelen     → wegen mee in welke toestand de app voorstelt (goalRank).
     2. Ervaring   → bepaalt de toon van de begeleiding.
     3. Momenten   → worden je dagplan.
     R. JOUW PLAN  → de beloning: je startmodus, je momenten, je begeleiding.
        Dit is wat Headspace en Calm na hun vragen doen — de vragenlijst
        eindigt niet in een dank-je-wel maar in een plan.

   Geslacht en leeftijd zijn GESCHRAPT (zelfde operator-beslissing): de app
   deed er niets mee, en een vraag zonder gevolg is tijd van de gebruiker
   nemen zonder iets terug te geven. Komt er ooit een reden, dan komt de
   vraag terug mét die reden.

   Alles blijft op het toestel — geen account, geen upload; dat staat op de
   eerste stap. Geen medische vragen, geen claims (CLAUDE.md §1).

   Na afloop: premium terug de app in, ieder ander naar de volledige gratis
   kennismakingssessie.
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { GOALS } from '@/data/goals';
import {
  pickForSlot,
  reasonForPick,
  slotForHour,
} from '@/utils/day-plan';
import { useSubscription } from '@/hooks/useSubscription';
import { SLOTS } from '@/services/reminders';
import { useSetting } from '@/utils/settings';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { Check, ChevronLeft, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

/* Drie vragen plus het plan. */
const STEPS = 4;

const EXPERIENCE = [
  { key: 'new', name: 'New to breathwork', hint: 'Never done this before' },
  { key: 'some', name: 'Tried it a few times', hint: 'Know the basics' },
  { key: 'regular', name: 'Regular practice', hint: 'Part of my routine' },
];

/* Wat de ervaring OPLEVERT, zichtbaar in het plan. Dezelfde drie sleutels. */
const GUIDANCE_LINE: Record<string, string> = {
  new: 'Voice and visuals guide every breath — nothing to memorise.',
  some: 'The rhythm stays on screen; the voice steps back as you settle in.',
  regular: 'Guidance stays out of your way — tune voice and haptics per state.',
};

const MOMENTS = [
  { key: 'morning', name: 'Morning', hint: 'Before the day takes over' },
  { key: 'midday', name: 'Midday', hint: 'A reset halfway through' },
  { key: 'evening', name: 'Evening', hint: 'Winding down' },
];


export default function BreathQuizScreen() {
  const insets = useSafeAreaInsets();
  const sub = useSubscription();
  const isPro = sub.isPro || sub.hasBracelet;

  const [step, setStep] = useState(0);
  const [profile, setProfile] = useSetting('profile');
  const [, setGoals] = useSetting('goals');

  /* ── LOKALE antwoorden ────────────────────────────────────────────────
     Niets staat vooraf aangevinkt (operator, 8 augustus 2026): de lijst las
     eerst rechtstreeks uit de opslag, dus wie de vragenlijst opnieuw opende
     zag oude keuzes al aangetikt staan — en een keuze die er al staat is
     geen keuze. De antwoorden leven hier tijdens het invullen en gaan pas
     bij het afronden naar de opslag. */
  const [selGoals, setSelGoals] = useState<string[]>([]);
  const [selExp, setSelExp] = useState<string | null>(null);
  const [selMoments, setSelMoments] = useState<string[]>([]);

  const toggleGoal = (key: string) => {
    Haptics.selectionAsync();
    setSelGoals((cur) =>
      cur.includes(key) ? cur.filter((g) => g !== key) : [...cur, key],
    );
  };

  /* ── Het plan: jouw dag ───────────────────────────────────────────────
     Eén toestand als "plan" tonen was fout (operator, 8 augustus 2026: wie
     beter slapen én minder stress kiest, kreeg CLARITY — "dit lijkt mij niet
     echt een plan"). Een plan is een DAG: per gekozen moment de toestand die
     bij dat uur én die doelen past, met de reden erbij.

     Dezelfde grondwet als utils/breath-suggestion.ts: de klok is leidend
     (nooit BOOST voor het slapen), het doel weegt binnen wat bij het moment
     past, en alles is na te vertellen. Beter slapen + minder stress wordt zo:
     ochtend CALM (minder stress), middag CLARITY (variatie op hetzelfde
     doel), avond REST (beter slapen) — en dat klopt, want dat is precies wat
     de dagelijkse suggestie later ook gaat doen. */
  const plan = useMemo(() => {
    let prev: BreathStateKey | null = null;
    const schedule = SLOTS.filter((sl) => selMoments.includes(sl.slot)).map(
      (sl) => {
        const pick = pickForSlot(sl.slot, selGoals, prev);
        prev = pick;
        return {
          slot: sl.slot,
          label: sl.label,
          state: BREATH_STATES[pick],
          reason: reasonForPick(pick, selGoals, sl.label),
        };
      },
    );
    return {
      schedule,
      guidance: GUIDANCE_LINE[selExp ?? 'new'],
    };
  }, [selGoals, selMoments, selExp]);

  const isResult = step === STEPS - 1;

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isResult) {
      setStep((n) => n + 1);
      return;
    }
    persist();
    /* Premium heeft de sessies al; ieder ander proeft er meteen één — de
       vragenlijst mag nooit het einde van de reis zijn. En die eerste sessie
       is de toestand die het plan voor DIT dagdeel zegt (operator, 8
       augustus 2026: de knop opende een vaste standaard die niet eens in het
       plan stond). Plan en knop komen nu uit dezelfde formule. */
    if (isPro) {
      router.replace('/breath' as never);
    } else {
      const first = pickForSlot(
        slotForHour(new Date().getHours()),
        selGoals,
        null,
      );
      /* `mode`, niet `state`: state wordt door de URL-parser van de router
         opgegeten (zie de toelichting in breath-session.tsx). */
      router.replace(
        ('/breath-session?from=onboarding&mode=' + first) as never,
      );
    }
  };

  /* NU pas naar de opslag, en alleen wat er werkelijk gekozen is. Wie niets
     aantikte, overschrijft niets. */
  const persist = () => {
    if (selGoals.length > 0) void setGoals(selGoals);
    void setProfile({
      ...profile,
      ...(selExp ? { experience: selExp } : {}),
      ...(selMoments.length > 0 ? { preferredSlots: selMoments } : {}),
    });
  };

  const back = () => {
    if (step > 0) setStep((n) => n - 1);
    else if (router.canGoBack()) router.back();
  };

  /* Eén bouwsteen voor alle keuzerijen: aangetikt = accentrand + vinkje.
     Zelfde vormtaal als de Goal-pagina, zodat dit als één app leest. */
  const Choice = ({
    label,
    hint,
    on,
    onPress,
  }: {
    label: string;
    hint?: string;
    on: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={[s.choice, on && s.choiceOn]}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.choiceTxt, on && s.choiceTxtOn]}>{label}</Text>
        {hint ? <Text style={s.choiceHint}>{hint}</Text> : null}
      </View>
      {on && (
        <View style={s.tick}>
          <Check size={12} color="#0a0a0a" strokeWidth={3} />
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.bar}>
        <Pressable onPress={back} hitSlop={12} style={s.back}>
          <ChevronLeft
            size={22}
            color="rgba(255,255,255,0.75)"
            strokeWidth={2.2}
          />
        </Pressable>
        {/* Voortgang als stipjes: je ziet dat het kort is. Een vragenlijst
            zonder einde in zicht wordt afgebroken, niet ingevuld. */}
        <View style={s.dots}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotOn]} />
          ))}
        </View>
        <View style={s.back} />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: Math.max(insets.bottom, 12) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <>
            <Text style={s.title}>What brings you here?</Text>
            <Text style={s.lead}>
              Choose all that apply. What you pick first matters most for
              what gets suggested — all five states stay open.
            </Text>
            {/* WAAR de antwoorden blijven hoort hier te staan, niet in een
                voorwaardenpagina: dit is het moment waarop iemand het zich
                afvraagt. Het antwoord is: nergens heen. */}
            <Text style={s.privacy}>
              Your answers stay on this device. No account, no upload.
            </Text>
            {GOALS.map((g) => (
              <Choice
                key={g.key}
                label={g.name}
                hint={g.hint}
                on={selGoals.includes(g.key)}
                onPress={() => toggleGoal(g.key)}
              />
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <Text style={s.title}>Your experience</Text>
            <Text style={s.lead}>
              This sets how much the app guides you — you see it back in
              your plan.
            </Text>
            {EXPERIENCE.map((e) => (
              <Choice
                key={e.key}
                label={e.name}
                hint={e.hint}
                on={selExp === e.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelExp(e.key);
                }}
              />
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={s.title}>When would you practice?</Text>
            <Text style={s.lead}>
              Pick as many as you like — these become your daily plan.
            </Text>
            {MOMENTS.map((m) => {
              const on = selMoments.includes(m.key);
              return (
                <Choice
                  key={m.key}
                  label={m.name}
                  hint={m.hint}
                  on={on}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelMoments((cur) =>
                      on ? cur.filter((k) => k !== m.key) : [...cur, m.key],
                    );
                  }}
                />
              );
            })}
          </>
        )}

        {/* ── HET PLAN — wat de antwoorden opleveren ──────────────────
            Geen dank-je-wel maar een resultaat: startmodus, momenten en
            begeleiding, elk herleidbaar tot een antwoord van net. */}
        {isResult && (
          <>
            <View style={s.planBadge}>
              <Sparkles size={13} color={Brand.accent} strokeWidth={2.2} />
              <Text style={s.planBadgeTxt}>Built from your answers</Text>
            </View>
            <Text style={s.title}>Your plan</Text>
            <Text style={s.lead}>
              This shapes what gets suggested from here on — change any of
              it any time.
            </Text>

            {/* JOUW DAG. Elk moment zijn eigen toestand, met de reden
                ernaast. Geen verzonnen kloktijden — het moment is de
                afspraak, de exacte tijd zet je in Daily plan. */}
            {plan.schedule.length > 0 ? (
              <View style={s.planCard}>
                <Text style={s.planLbl}>Your day</Text>
                {plan.schedule.map((row) => (
                  <View key={row.slot} style={s.planDayRow}>
                    <Text style={s.planSlotWhen}>{row.label}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={s.planStateRow}>
                        <View
                          style={[
                            s.planDot,
                            { backgroundColor: row.state.accent },
                          ]}
                        />
                        <Text
                          style={[s.planState, { color: row.state.accent }]}
                        >
                          {row.state.eyebrow}
                        </Text>
                      </View>
                      <Text style={s.planReason}>{row.reason}</Text>
                    </View>
                  </View>
                ))}
                {/* De tijden zet je HIER, niet via een verwijzing naar een
                    ander scherm (operator, 8 augustus 2026). De knop bewaart
                    de antwoorden en opent Daily plan, dat dezelfde momenten
                    toont. */}
                <Pressable
                  onPress={() => {
                    persist();
                    router.replace('/plan' as never);
                  }}
                  style={s.planTimesBtn}
                  android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                >
                  <Text style={s.planTimesTxt}>Set times and reminders</Text>
                </Pressable>
                <Text style={s.planHint}>
                  Nothing is scheduled until you set it.
                </Text>
              </View>
            ) : (
              <View style={s.planCard}>
                <Text style={s.planLbl}>Your day</Text>
                <Text style={s.planBody}>
                  No fixed moments chosen — suggestions simply follow your
                  clock: energise in the morning, settle in the afternoon,
                  wind down at night.
                </Text>
              </View>
            )}

            <View style={s.planCard}>
              <Text style={s.planLbl}>Your guidance</Text>
              <Text style={s.planBody}>{plan.guidance}</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Altijd door te komen — ook zonder antwoord. Een verplichte vraag
          levert geen eerlijker antwoord op, alleen een verzonnen antwoord. */}
      <View
        style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) + 14 }]}
      >
        <Pressable
          onPress={next}
          style={s.cta}
          android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
        >
          <Text style={s.ctaTxt}>
            {isResult ? 'START YOUR FIRST SESSION' : 'CONTINUE'}
          </Text>
        </Pressable>
      </View>
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
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 7 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotOn: { backgroundColor: Brand.accent },

  scroll: { paddingHorizontal: 18 },
  title: {
    marginTop: 10,
    fontFamily: BrandFonts.extrabold,
    fontSize: 26,
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  lead: {
    marginTop: 8,
    marginBottom: 18,
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.6)',
  },
  privacy: {
    marginTop: -8,
    marginBottom: 16,
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    /* Gedempt wit, geen fluogroen (operator, 8 augustus 2026): dit is een
       geruststelling, geen succesmelding. */
    color: 'rgba(255,255,255,0.55)',
  },

  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 9,
  },
  choiceOn: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(58,143,255,0.1)',
  },
  choiceTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    color: Brand.text,
  },
  choiceTxtOn: { color: '#ffffff' },
  choiceHint: {
    marginTop: 2,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)',
  },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Het plan ── */
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.4)',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  planBadgeTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11.5,
    color: Brand.accent,
  },
  planCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
    marginBottom: 10,
  },
  planLbl: {
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  planDayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 7,
  },
  planReason: {
    marginTop: 2,
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  planStateRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  planDot: { width: 10, height: 10, borderRadius: 5 },
  planState: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  planBody: {
    marginTop: 6,
    fontFamily: BrandFonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.72)',
  },
  planSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  planSlotWhen: {
    fontFamily: BrandFonts.bold,
    fontSize: 13.5,
    color: '#ffffff',
    /* Breed genoeg voor "Morning" op één regel — op 52 brak hij af. */
    width: 78,
  },
  planSlotName: {
    fontFamily: BrandFonts.regular,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.72)',
  },
  planTimesBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  planTimesTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    color: Brand.accent,
  },
  planHint: {
    marginTop: 8,
    fontFamily: BrandFonts.regular,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.38)',
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: Brand.bg,
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
