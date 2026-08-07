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

import DateTimePicker from '@react-native-community/datetimepicker';
import { Brand, BrandFonts } from '@/constants/theme';
import { BREATH_STATES, cycleSeconds, roundsFor } from '@/data/breath-states';
import { goalsByKeys } from '@/data/goals';
import { useBreathHistory } from '@/utils/breath-history';
import { suggestBreath } from '@/utils/breath-suggestion';
import { useSetting } from '@/utils/settings';
import {
  ensurePermission,
  reminderKey,
  syncReminders,
} from '@/services/reminders';
import { router, Stack } from 'expo-router';
import { Bell, Check, ChevronLeft, Clock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

/* De twee momenten van een dag. Ochtend zet de toon, avond bouwt af — dat
   zijn de twee waar bijna iedereen ruimte voor heeft, en ze staan het verst
   uit elkaar. Wie er drie wil, kiest zelf een extra sessie; het plan hoeft
   niet je hele dag te vullen. */
const MOMENTS = [
  { key: 'morning', label: 'MORNING', hour: 8, from: 4, to: 12 },
  { key: 'evening', label: 'EVENING', hour: 21, from: 17, to: 24 },
] as const;

export default function PlanScreen() {
  /* De navigatiebalk van het toestel hoort NIET over de laatste knop te
     vallen (operator, 7 augustus 2026: "see your plan staat half zichtbaar").
     Een vaste marge onderaan werkt niet — die is op het ene toestel te klein
     en op het andere een gat. */
  const insets = useSafeAreaInsets();

  const history = useBreathHistory();
  const [goalKeys] = useSetting('goals');
  const [reminders, setReminders] = useSetting('reminders');
  const [hours] = useSetting('reminderHours');
  const [at, setAt] = useSetting('reminderAt');

  const [picking, setPicking] = useState<'morning' | 'evening' | null>(null);

  const minsFor = (slot: 'morning' | 'evening') => {
    const key = reminderKey('breath', slot);
    /* Nieuwe sleutel eerst, dan de oude met hele uren, dan de standaard van
       dit moment. Zo raakt niemand zijn instelling kwijt. */
    if (typeof at[key] === 'number') return at[key];
    if (typeof hours[key] === 'number') return hours[key] * 60;
    return MOMENTS.find((m) => m.key === slot)!.hour * 60;
  };

  /* De notatie van het TOESTEL: 12- of 24-uurs, zonder dat de app daar een
     eigen instelling voor nodig heeft. */
  const fmtTime = (mins: number) => {
    const d = new Date();
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };
  /* Gepland als BEIDE momenten aanstaan. Half aan is geen plan, dus dan blijft
     de knop uitnodigen in plaats van te doen alsof het geregeld is. */
  const planned = MOMENTS.every(
    (m) => reminders[reminderKey('breath', m.key)] === true,
  );
  const chosen = goalsByKeys(goalKeys);

  const items = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    return MOMENTS.map((m) => {
      /* De suggestie voor DAT uur, niet voor nu. Zo staat er 's ochtends al
         wat je vanavond gaat doen, in plaats van twee keer hetzelfde. */
      const at = new Date(now);
      at.setHours(m.hour, 0, 0, 0);
      const sug = suggestBreath(history, at, goalKeys);
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

      const h = now.getHours();
      return {
        /* Zit je NU in dit dagdeel? Dan mag je hem hiervandaan starten. */
        now: h >= m.from && h < m.to,
        moment: m,
        state: st,
        techName: tech.name,
        minutes: dur.minutes,
        exact: roundsFor(tech, dur.minutes) * cycleSeconds(tech),
        done,
      };
    });
  }, [history, goalKeys]);

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
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: Math.max(insets.bottom, 12) + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.lead}>
          {chosen.length > 0
            ? `Two moments a day, shaped around ${chosen
                .map((g) => g.name.toLowerCase())
                .join(' and ')}.`
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

            {/* ── De tijd ────────────────────────────────────────────
                Een echte tijdkiezer van het toestel (operator, 6 augustus
                2026), met uren én minuten. De rij vaste uren die hier stond
                was mijn oplossing, niet die van de gebruiker: wie om 7:15
                opstaat hoort niet te moeten kiezen tussen 7 en 8.

                De notatie volgt het TOESTEL — 8:00 AM of 08:00, afhankelijk
                van wat daar is ingesteld. Een eigen 12/24-schakelaar in de
                app zou een tweede plek zijn die hetzelfde regelt, en dat is
                vandaag al twee keer misgegaan. */}
            <Pressable
              style={s.timeRow}
              onPress={() => setPicking(it.moment.key)}
            >
              <Clock size={15} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
              <Text style={s.timeLbl}>Reminder</Text>
              <Text style={[s.timeVal, { color: it.state.accent }]}>
                {fmtTime(minsFor(it.moment.key))}
              </Text>
            </Pressable>

            {it.done ? (
              <Text style={s.doneTxt}>Done today</Text>
            ) : !it.now ? (
              /* Geen startknop voor een moment dat nog niet aan de beurt is.
                 's Ochtends een avondsessie starten vanaf een PLANNINGSscherm
                 is verwarrend: je bent hier tijden aan het zetten, niet aan
                 het ademen. */
              <Text style={s.laterTxt}>
                Starts here when it&apos;s time
              </Text>
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

        {/* ── Van voorstel naar afspraak ─────────────────────────────────
             Een plan dat niets plant is een lijstje (operator, 6 augustus
             2026). Deze knop zet de herinneringen voor precies deze twee
             momenten aan — dezelfde die in Settings staan, want twee plekken
             die hetzelfde regelen lopen altijd uit elkaar.

             De melding IS de vraag: tikken opent de sessie, wegvegen is nee.
             Geen tweede bevestiging in de app. */}
        <Pressable
          style={[s.remind, planned && s.remindOn]}
          onPress={async () => {
            const next = { ...reminders };
            for (const m of MOMENTS) {
              next[reminderKey('breath', m.key)] = !planned;
            }
            if (!planned && !(await ensurePermission())) return;
            await setReminders(next);
            void syncReminders(next, at);
          }}
        >
          <Bell
            size={17}
            color={planned ? '#0a0a0a' : 'rgba(255,255,255,0.8)'}
            strokeWidth={2.2}
          />
          <Text style={[s.remindTxt, planned && { color: '#0a0a0a' }]}>
            {planned
              ? `REMINDERS ON · ${fmtTime(minsFor('morning'))} · ${fmtTime(
                  minsFor('evening'),
                )}`
              : 'REMIND ME AT THESE TIMES'}
          </Text>
        </Pressable>

        {chosen.length === 0 && (
          <Pressable style={s.goalCta} onPress={() => router.push('/goal' as never)}>
            <Text style={s.goalCtaTxt}>CHOOSE A GOAL</Text>
          </Pressable>
        )}

        <Text style={s.foot}>
          Nothing to tick off. What you do is saved as you go, and shows up
          here on its own.
        </Text>
      </ScrollView>

      {picking !== null && (
        <DateTimePicker
          value={(() => {
            const d = new Date();
            const m = minsFor(picking);
            d.setHours(Math.floor(m / 60), m % 60, 0, 0);
            return d;
          })()}
          mode="time"
          display="spinner"
          onChange={async (_e, date) => {
            const slot = picking;
            setPicking(null);
            if (!date || !slot) return;
            const next = {
              ...at,
              [reminderKey('breath', slot)]:
                date.getHours() * 60 + date.getMinutes(),
            };
            await setAt(next);
            if (planned) void syncReminders(reminders, next);
          }}
        />
      )}
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

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  timeLbl: {
    flex: 1,
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  timeVal: { fontFamily: BrandFonts.bold, fontSize: 15, letterSpacing: -0.2 },
  laterTxt: {
    marginTop: 12,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.38)',
  },

  remind: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginTop: 4,
    marginBottom: 16,
  },
  remindOn: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  remindTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 11.5,
    letterSpacing: 1.6,
    color: '#ffffff',
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
