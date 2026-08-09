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
import { goalsByKeys } from '@/data/goals';
import { useBreathHistory } from '@/utils/breath-history';
import { pickForSlot } from '@/utils/day-plan';
import { useSetting } from '@/utils/settings';
import {
  ensurePermission,
  nextFireText,
  reminderKey,
  syncReminders,
} from '@/services/reminders';
import { router, Stack } from 'expo-router';
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  /* MIDDAY verschijnt alleen voor wie hem in de vragenlijst koos (operator,
     8 augustus 2026). Twee momenten blijft de standaard — ochtend zet de
     toon, avond bouwt af — maar wie zei dat hij 's middags wil oefenen,
     hoort dat moment hier terug te zien. Dit is waar de voorkeuren uit de
     vragenlijst zichtbaar worden. */
  { key: 'midday', label: 'MIDDAY', hour: 13, from: 12, to: 17 },
  { key: 'evening', label: 'EVENING', hour: 21, from: 17, to: 24 },
] as const;

type SlotKey = (typeof MOMENTS)[number]['key'];

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

  const [picking, setPicking] = useState<SlotKey | null>(null);
  /* Wat er net is ingesteld, in mensentaal. Blijft staan tot je het scherm
     verlaat — lang genoeg om gelezen te worden, kort genoeg om niet in de
     weg te zitten. */
  const [justSet, setJustSet] = useState<string | null>(null);

  const minsFor = (slot: SlotKey) => {
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
  const [profile] = useSetting('profile');
  /* PRECIES de momenten die de gebruiker koos — niet meer, niet minder
     (operator, 8 augustus 2026: wie alleen de middag koos, kreeg hier
     ongevraagd ochtend en avond bij, en daardoor verschoof zelfs zijn
     middag-toestand: de variatieregel zag de ochtend als 'al gebruikt').
     Wie in de vragenlijst niets koos, krijgt de standaard van twee —
     ochtend zet de toon, avond bouwt af. */
  const chosenSlots = profile.preferredSlots ?? [];
  const visible =
    chosenSlots.length > 0
      ? MOMENTS.filter((m) => chosenSlots.includes(m.key))
      : MOMENTS.filter((m) => m.key !== 'midday');
  const planned = visible.every(
    (m) => reminders[reminderKey('breath', m.key)] === true,
  );
  const chosen = goalsByKeys(goalKeys);

  const items = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    /* DEZELFDE motor als het plan uit de vragenlijst (utils/day-plan.ts).
       Hier draaide suggestBreath per uur, en die kent geen variatie tussen
       momenten — dus stond er twee keer FOCUS en week de dag af van wat de
       vragenlijst net beloofd had (operator, 8 augustus 2026). Eén formule,
       één dag. */
    let prevPick: ReturnType<typeof pickForSlot> | null = null;
    return visible.map((m) => {
      const picked = pickForSlot(m.key, goalKeys, prevPick);
      prevPick = picked;
      const st = BREATH_STATES[picked];
      const tech = st.techniques[0];
      const dur = st.durations[st.defaultDuration];

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
  }, [history, goalKeys, visible.length]);

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
        {/* Het AANTAL telt mee (operator, 8 augustus 2026): wie in de
            vragenlijst ook de middag koos, ziet drie momenten — dan hoort
            hier geen "two" te staan. */}
        <Text style={s.lead}>
          {chosen.length > 0
            ? `${['One moment', 'Two moments', 'Three moments'][visible.length - 1]} a day, shaped around ${chosen
                .slice(0, 2)
                .map((g) => g.name.toLowerCase())
                .join(' and ')}.`
            : `${['One moment', 'Two moments', 'Three moments'][visible.length - 1]} a day. Pick a goal to shape them around what you want.`}
        </Text>

        {justSet && (
          <View style={s.confirm}>
            <Bell size={14} color={Brand.accent} strokeWidth={2.4} />
            <Text style={s.confirmTxt}>{justSet}</Text>
          </View>
        )}

        {/* De hele kaart opent de sessie (operator, 8 augustus 2026). De
            START-knop stond alleen op het moment dat "aan de beurt" was —
            een regel die niemand kon raden. Wie 's ochtends zijn avondsessie
            wil doen, mag dat; het plan is een uitnodiging, geen slagboom. */}
        {items.map((it) => (
          <Pressable
            key={it.moment.key}
            onPress={() =>
              router.push({
                pathname: '/breath-session',
                params: { state: it.state.key },
              })
            }
            style={[
              s.card,
              { borderColor: it.done ? `${it.state.accent}55` : 'rgba(255,255,255,0.09)' },
            ]}
            android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
          >
            <View style={s.cardTop}>
              <Text style={[s.moment, { color: it.state.accent }]}>
                {it.moment.label}
              </Text>
              {it.done ? (
                <View style={[s.tick, { backgroundColor: it.state.accent }]}>
                  <Check size={12} color="#0a0a0a" strokeWidth={3} />
                </View>
              ) : (
                <ChevronRight
                  size={17}
                  color="rgba(255,255,255,0.35)"
                  strokeWidth={2.2}
                />
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
              {/* Zichtbaar bewerkbaar (operator, 8 augustus 2026): zonder
                  het potlood was de tijd een mededeling waar je toevallig
                  op moest tikken om te ontdekken dat hij een knop was. */}
              <Pencil
                size={13}
                color="rgba(255,255,255,0.4)"
                strokeWidth={2.2}
              />
            </Pressable>

            {it.done && <Text style={s.doneTxt}>Done today</Text>}
          </Pressable>
        ))}

        {/* Naast het plan blijven alle vijf de deuren open — en dat mag
            hier gewoon staan (operator, 8 augustus 2026). */}
        <Pressable
          style={s.allModes}
          /* `navigate` en niet `push` (operator, 9 augustus 2026: "gaat naar
             verkeerde pagina"). Deze pagina staat BUITEN de tab-groep, en
             een `push` van daar zet een hele nieuwe tab-navigator boven op
             de bestaande — de bestemming klopt dan wel, maar de weg ernaartoe
             niet. `navigate` schakelt gewoon om naar de bestaande tab, zoals
             overal elders vanuit een root-scherm (zie BreathMiniControl). */
          onPress={() => router.navigate('/breath' as never)}
          android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
        >
          <Text style={s.allModesTxt}>Explore all modes</Text>
          <ChevronRight
            size={16}
            color="rgba(255,255,255,0.6)"
            strokeWidth={2.2}
          />
        </Pressable>

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
            for (const m of visible) {
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
              ? `REMINDERS ON · ${visible
                  .map((m) => fmtTime(minsFor(m.key)))
                  .join(' · ')}`
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

      {/* ── Eigen tijdkiezer ──────────────────────────────────────────
          De systeem-spinner was een grijze popup uit een andere wereld
          (operator, 8 augustus 2026: "redelijk simpel en ouderwets"). Dit is
          onze eigen: donker paneel onderaan, uren binnen het venster van het
          moment, minuten per kwartier. Kwartieren zijn een keuze, geen
          beperking — een herinnering op 7:38 bestaat alleen in apps die de
          keuze niet durfden te maken. */}
      <Modal
        visible={picking !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicking(null)}
      >
        <Pressable style={s.pickBackdrop} onPress={() => setPicking(null)}>
          <Pressable
            style={[
              s.pickSheet,
              { paddingBottom: Math.max(insets.bottom, 14) + 14 },
            ]}
            onPress={() => {}}
          >
            <Text style={s.pickTitle}>
              {picking
                ? MOMENTS.find((m) => m.key === picking)!.label.charAt(0) +
                  MOMENTS.find((m) => m.key === picking)!
                    .label.slice(1)
                    .toLowerCase() +
                  ' time'
                : ''}
            </Text>
            <ScrollView
              style={s.pickScroll}
              showsVerticalScrollIndicator={false}
            >
            <View style={s.pickGrid}>
              {picking !== null &&
                (() => {
                  const m = MOMENTS.find((x) => x.key === picking)!;
                  const out: number[] = [];
                  for (let h = m.from; h < m.to; h += 1) {
                    out.push(h * 60, h * 60 + 15, h * 60 + 30, h * 60 + 45);
                  }
                  const cur = minsFor(picking);
                  return out.map((mins) => {
                    const on = mins === cur;
                    return (
                      <Pressable
                        key={mins}
                        onPress={async () => {
                          const slot = picking!;
                          setPicking(null);
                          const next = {
                            ...at,
                            [reminderKey('breath', slot)]: mins,
                          };
                          await setAt(next);
                          /* De tijd zetten schakelt de herinnering METEEN in
                             (operator, 7 augustus 2026): een losse tweede
                             stap miste iedereen. Wie geen herinnering wil,
                             zet hem daarna uit — dat is één tik. */
                          const key = reminderKey('breath', slot);
                          const on2 = { ...reminders, [key]: true };
                          if (!reminders[key]) {
                            if (await ensurePermission())
                              await setReminders(on2);
                          }
                          void syncReminders(
                            reminders[key] ? reminders : on2,
                            next,
                          );
                          /* Met het moment erbij: "First reminder today
                             at 13:00" zónder context las alsof het hele plan
                             om 13:00 begon (operator, 8 augustus 2026). */
                          const lbl =
                            slot.charAt(0).toUpperCase() + slot.slice(1);
                          setJustSet(lbl + ' — ' + nextFireText(mins));
                        }}
                        style={[s.pickChip, on && s.pickChipOn]}
                        android_ripple={{
                          color: 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <Text style={[s.pickChipTxt, on && s.pickChipTxtOn]}>
                          {fmtTime(mins)}
                        </Text>
                      </Pressable>
                    );
                  });
                })()}
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },

  /* ── Tijdkiezer ── */
  pickBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  pickSheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  pickTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 17,
    color: '#ffffff',
    marginBottom: 14,
  },
  /* Nooit hoger dan iets meer dan een half scherm: het venster van de
     ochtend telt 32 tijden en dat paste niet overal (operator, 8 augustus
     2026: "moet voor eender welke sessie volledig in beeld staan"). */
  /* Zes volledige rijen, en de zevende piept er half onderuit — dat halve
     rijtje is geen slordigheid maar het teken dat er meer is. De onderrand
     van het paneel volgt de veilige zone, dus de navigatiebalk snijdt nooit
     meer door een tijd heen (operator, 8 augustus 2026). */
  pickScroll: { maxHeight: 322 },
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 6,
  },
  pickChip: {
    width: '22.7%',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  pickChipOn: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(58,143,255,0.12)',
  },
  pickChipTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.82)',
  },
  pickChipTxtOn: { color: '#ffffff' },
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  allModes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 10,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  allModesTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.85)',
  },
  timeLbl: {
    flex: 1,
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.35)',
    backgroundColor: 'rgba(58,143,255,0.10)',
    marginBottom: 14,
  },
  confirmTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    /* Merkblauw, geen fluogroen (operator, 8 augustus 2026). Groen als
       signaalkleur is voor succes na een handeling met risico; dit is een
       rustige bevestiging en hoort in de kleur van het merk te spreken. */
    color: Brand.accent,
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
