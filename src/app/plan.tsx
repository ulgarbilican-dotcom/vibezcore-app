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

import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import {
  BREATH_STATES,
  cycleSeconds,
  roundsFor,
  type BreathState,
  type BreathStateKey,
  type TechniqueDef,
} from '@/data/breath-states';
import { goalsByKeys } from '@/data/goals';
import { DurationWheel } from '@/components/DurationWheel';
import { GlassSheet } from '@/components/GlassSheetHost';
import VibezGlass from '@/components/VibezGlass';
import { rootBlurRef } from '@/utils/root-blur';
import { durationOptionsFor } from '@/utils/duration-options';
import { useBreathHistory } from '@/utils/breath-history';
import { personalOrderForSlot } from '@/utils/behavior-patterns';
import { pickStatesForDay } from '@/utils/day-plan';
import { useSetting } from '@/utils/settings';
import { dayKey } from '@/utils/bracelet-history';
import { saveActivePlan, useActivePlan } from '@/utils/plan-store';
import {
  ensurePermission,
  nextFireText,
  reminderKey,
  syncPlanReminders,
  syncReminders,
} from '@/services/reminders';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { openBreathSession } from '@/services/breath-session-host';
import { claimFreeSessionParam, skipBreathIntroOnce } from '@/utils/breath-entry';
import { BlurView } from 'expo-blur';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
} from 'lucide-react-native';
import { STATE_GLYPH_ICONS } from '@/components/ModeGlyph';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInUp,
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

/* Operator, 3 okt 2026 ("Level, routine en plan length" boven het
   protocol-overzicht): drie APARTE begrippen, niet verwisselbaar — zie
   intensity.tsx ("Set your routine", de brondefinitie):
   - Level = `experienceLevel` (globale setting, Beginner/Intermediate/
     Advanced — bepaalt WELKE techniek/duur per sessie).
   - Routine = `plan.intensity` (Essential/Standard/Advanced/Complete —
     HOEVEEL sessies per dag). Was hier eerst verkeerd "Level" genoemd
     (plan-summary.tsx noemt deze zelfde variabele `INTENSITY_LABEL`, wat
     de verwarring opleverde) — nu correct als Routine gelabeld.
   - Plan length = `plan.horizon` (1 week/2 weken/...). */
const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};
const ROUTINE_LABEL: Record<string, string> = {
  essential: 'Essential',
  standard: 'Standard',
  advanced: 'Advanced',
  complete: 'Complete',
  custom: 'Custom',
};
const HORIZON_LABEL: Record<string, string> = {
  today: 'Today',
  '1w': '1 week',
  '2w': '2 weeks',
  '1m': '1 month',
  '3m': '3 months',
  ongoing: 'Ongoing',
};

/* Operator, 3 okt 2026 ("2 moments a day maar protocol heeft 4 moments"):
   was een vast array van 3 woorden, geïndexeerd met `visible.length - 1`
   — kon het werkelijke aantal sessies (`items.length`, kan >3 zijn sinds
   "Bouw je dag" meerdere sessies per dagdeel toelaat) niet dekken. Woorden
   tot en met 6, daarna gewoon het cijfer. */
const MOMENT_WORDS = ['', 'One moment', 'Two moments', 'Three moments', 'Four moments', 'Five moments', 'Six moments'];
const momentsWord = (n: number) => MOMENT_WORDS[n] ?? `${n} moments`;

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
  /* Operator, 11 september 2026: nieuw vierde moment, "after work / on
     the way home" — enkel zichtbaar via een ECHT protocol (goal.tsx →
     intensity.tsx) dat dit moment koos, nooit als standaard hier (zie
     `visible` hieronder: "twee momenten, niet vijf" blijft de regel voor
     de live, protocol-loze preview). Zonder dit erbij zou `MOMENTS.find()`
     voor een protocol-item met slot 'afterWork' niets vinden, en dus geen
     label/tijdvenster kunnen tonen (zie `items` hieronder). */
  { key: 'afterWork', label: 'AFTER WORK', hour: 18, from: 17, to: 20 },
  /* to: 24 -> 28 (operator, 10 augustus 2026: "voor sommige users is
     evening misschien 2u, 3u — wij beperken dit toch?"). 24 t/m 27 zijn
     0:00 t/m 3:45 de volgende ochtend — JS' eigen Date-rekenkunde rolt dat
     correct om (zie fmtTime en nextFireText), dus dit is geen aparte
     nacht-categorie maar gewoon een langere avond. `from: 17` -> `20`
     (11 september 2026): dat bereik overlapte met het nieuwe `afterWork`
     hierboven — evening dekt nu enkel nog vanaf 20u, samen met morning
     vanaf 4 blijft de volle 24 uur gedekt. */
  { key: 'evening', label: 'EVENING', hour: 21, from: 20, to: 28 },
] as const;

type SlotKey = (typeof MOMENTS)[number]['key'];

export default function PlanScreen() {
  /* De navigatiebalk van het toestel hoort NIET over de laatste knop te
     vallen (operator, 7 augustus 2026: "see your plan staat half zichtbaar").
     Een vaste marge onderaan werkt niet — die is op het ene toestel te klein
     en op het andere een gat. */
  const insets = useSafeAreaInsets();
  const { onboarding, fromBreathWelcome } = useLocalSearchParams<{
    onboarding?: string;
    fromBreathWelcome?: string;
  }>();

  const history = useBreathHistory();
  const [goalKeys] = useSetting('goals');
  const [reminders, setReminders] = useSetting('reminders');
  /* Voor de "Level"-regel in het protocol-overzicht hieronder — zie de
     toelichting bij LEVEL_LABEL/ROUTINE_LABEL hierboven. */
  const [experienceLevel] = useSetting('experienceLevel');
  const [hours] = useSetting('reminderHours');
  const [at, setAt] = useSetting('reminderAt');

  /* Een ACTIEF protocol (goal.tsx → intensity.tsx → plan-review.tsx →
     plan-duration.tsx) maakt dit scherm het tijden-instelscherm voor een
     ECHT vastgelegd rooster i.p.v. de live-herberekende twee-momenten-
     preview hieronder (operator, 13 augustus 2026, protocol-systeem). Geen
     protocol? Dan blijft het oude gedrag ongewijzigd — wie via de oude
     vragenlijst (breath-quiz.tsx) hier binnenkomt, ziet nog steeds zijn
     twee momenten op basis van de klok en zijn doelen. */
  const { plan } = useActivePlan();
  const todayKey = dayKey(new Date());
  const planDay = plan?.days[todayKey] ?? null;

  useEffect(() => {
    if (plan) void syncPlanReminders(plan);
  }, [plan]);

  /* Operator, 17 september 2026 ("Bouw je dag" — meerdere sessies per
     dagdeel toegestaan): `picking`/`durationPicking` waren SlotKey — dat
     ging fout zodra twee items hetzelfde dagdeel delen (welke van de twee
     bedoel je?). Nu een index in de gerenderde `items`-lijst zelf, altijd
     ondubbelzinnig, in beide standen (met of zonder actief protocol). */
  const [picking, setPicking] = useState<number | null>(null);
  /* Wat er net is ingesteld, in mensentaal. Blijft staan tot je het scherm
     verlaat — lang genoeg om gelezen te worden, kort genoeg om niet in de
     weg te zitten. */
  const [justSet, setJustSet] = useState<string | null>(null);

  /* Welk item zijn duur-kiezer openstaat (operator, 13 augustus 2026:
     "user mag de mogelijkheid hebben om langere sessies te doen" — ook NA
     het opzetten, niet alleen tijdens plan-review). Alleen relevant met een
     actief protocol; de oude live-suggestie kent geen bewaarde duur. */
  const [durationPicking, setDurationPicking] = useState<number | null>(null);

  /* Press-animatie voor de vaste CTA's onderaan het scherm (niet in een
     loop, dus hooks hier gewoon op componentniveau — zelfde recept als
     `PlanItemCard` hierboven/`StartCard` in breath-welcome.tsx). */
  /* Operator, 4 okt 2026 (smoothness-audit: "geen enkele haptic in dit
     bestand"): alle 5 hoofdknoppen hieronder hadden wel de schaal-
     animatie maar geen haptic — `Haptics.selectionAsync()` toegevoegd aan
     elke `onPressIn` (zo vroeg mogelijk voelbaar, zelfde moment als de
     animatie al start). De twee backdrop-sluit-handlers (tik ernaast om
     een vel te sluiten) blijven bewust zonder haptic — geen primaire
     actie, enkel "annuleren". */
  const allModesScale = useSharedValue(1);
  const onAllModesPressIn = () => {
    Haptics.selectionAsync();
    allModesScale.value = withTiming(0.95, { duration: 80 });
  };
  const onAllModesPressOut = () => {
    allModesScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const allModesStyle = useAnimatedStyle(() => ({
    transform: [{ scale: allModesScale.value }],
  }));

  const primaryCtaScale = useSharedValue(1);
  const onPrimaryCtaPressIn = () => {
    Haptics.selectionAsync();
    primaryCtaScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPrimaryCtaPressOut = () => {
    primaryCtaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const primaryCtaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: primaryCtaScale.value }],
  }));

  const remindScale = useSharedValue(1);
  const onRemindPressIn = () => {
    Haptics.selectionAsync();
    remindScale.value = withTiming(0.95, { duration: 80 });
  };
  const onRemindPressOut = () => {
    remindScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const remindStyle = useAnimatedStyle(() => ({
    transform: [{ scale: remindScale.value }],
  }));

  const goalCtaScale = useSharedValue(1);
  const onGoalCtaPressIn = () => {
    Haptics.selectionAsync();
    goalCtaScale.value = withTiming(0.95, { duration: 80 });
  };
  const onGoalCtaPressOut = () => {
    goalCtaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const goalCtaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: goalCtaScale.value }],
  }));

  /* Terugknop bovenaan — klein icoon-knopje, dus 0.93 i.p.v. de 0.95 van
     kaarten/rijen (zelfde schaalregel als de rest van dit bestand). */
  const backScale = useSharedValue(1);
  const onBackPressIn = () => {
    Haptics.selectionAsync();
    backScale.value = withTiming(0.93, { duration: 80 });
  };
  const onBackPressOut = () => {
    backScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  /* De twee backdrops (tijd- en duur-kiezer) sluiten bij een tik ernaast —
     zelfde recept als de rest, ook al ziet de animatie zelf weinig licht
     omdat de modal meteen dichtgaat. */
  const pickBackdropScale = useSharedValue(1);
  const onPickBackdropPressIn = () => {
    pickBackdropScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPickBackdropPressOut = () => {
    pickBackdropScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pickBackdropStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pickBackdropScale.value }],
  }));

  const durationBackdropScale = useSharedValue(1);
  const onDurationBackdropPressIn = () => {
    durationBackdropScale.value = withTiming(0.95, { duration: 80 });
  };
  const onDurationBackdropPressOut = () => {
    durationBackdropScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const durationBackdropStyle = useAnimatedStyle(() => ({
    transform: [{ scale: durationBackdropScale.value }],
  }));

  /* Zet de duur op ELKE dag van het protocol op dezelfde POSITIE in
     `planDay.items` — dezelfde regel als bij tijd (de template herhaalt
     zich toch identiek over alle dagen, en elke dag is via
     `template.map(...)` opgebouwd in protocol.ts, dus de array-positie is
     stabiel). Matchte voorheen op `slot`, wat twee items in hetzelfde
     dagdeel allebei zou raken i.p.v. enkel het aangetikte. */
  const setMinutesForPlanIndex = async (planIndex: number, minutes: number) => {
    if (!plan) return;
    setDurationPicking(null);
    const days = Object.fromEntries(
      Object.entries(plan.days).map(([dk, day]) => [
        dk,
        {
          ...day,
          items: day.items.map((it, i) => (i === planIndex ? { ...it, minutes } : it)),
        },
      ]),
    );
    const updated = { ...plan, days };
    await saveActivePlan(updated);
    void syncPlanReminders(updated);
  };

  const minsFor = (slot: SlotKey) => {
    const planItem = planDay?.items.find((pi) => pi.slot === slot);
    if (planItem) return planItem.reminderAt;
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
  /* 'afterWork' is nooit een keuze in de vragenlijst (breath-quiz.tsx kent
     enkel morning/midday/evening) en hoort dus ook niet ongevraagd in de
     standaard-van-twee te verschijnen — enkel 'midday' uitsluiten was hier
     niet meer genoeg zodra MOMENTS een vierde entry kreeg. */
  const visible =
    chosenSlots.length > 0
      ? MOMENTS.filter((m) => chosenSlots.includes(m.key))
      : MOMENTS.filter((m) => m.key === 'morning' || m.key === 'evening');
  const planned = visible.every(
    (m) => reminders[reminderKey('breath', m.key)] === true,
  );
  const chosen = goalsByKeys(goalKeys);

  const items = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const h = now.getHours();

    const doneInWindow = (from: number, to: number) =>
      history.some((e) => {
        if (e.ts < startOfDay.getTime()) return false;
        const eh = new Date(e.ts).getHours();
        return eh >= from && eh < to;
      });

    /* MET actief protocol: één rij per ECHT item uit `planDay.items`, niet
       één per dagdeel — operator, 17 september 2026 ("Bouw je dag"): een
       dagdeel kan nu meerdere sessies dragen, dus "één rij per MOMENTS-
       entry" liet elk extra item in datzelfde dagdeel stilzwijgend
       verdwijnen (de oude `.find()` pakte altijd enkel de eerste). Elk item
       onthoudt zijn eigen `planIndex` (positie in `planDay.items`) — nodig
       om latere edits (duur/tijd) ondubbelzinnig op ÉÉN item toe te passen,
       niet per ongeluk op alle items in hetzelfde dagdeel. */
    if (planDay) {
      return planDay.items.map((planItem, planIndex) => {
        const m = MOMENTS.find((mm) => mm.key === planItem.slot) ?? MOMENTS[0];
        const st = BREATH_STATES[planItem.state];
        const tech =
          st.techniques.find((t) => t.key === planItem.techniqueKey) ?? st.techniques[0];
        return {
          now: h >= m.from && h < m.to,
          moment: m,
          state: st,
          techName: tech.name,
          techKey: tech.key,
          minutes: planItem.minutes,
          exact: roundsFor(tech, planItem.minutes) * cycleSeconds(tech),
          done: doneInWindow(m.from, m.to),
          planIndex,
          reminderAt: planItem.reminderAt,
        };
      });
    }

    /* ZONDER protocol: ongewijzigd, de live twee/drie-momenten-preview.
       DEZELFDE motor als het plan uit de vragenlijst (utils/day-plan.ts).
       Hier draaide suggestBreath per uur, en die kent geen variatie tussen
       momenten — dus stond er twee keer FOCUS en week de dag af van wat de
       vragenlijst net beloofd had (operator, 8 augustus 2026). Eén formule,
       één dag. */
    const livePicks = pickStatesForDay(
      visible.map((m) => m.key),
      goalKeys,
      (slot) => personalOrderForSlot(history, slot),
    );
    return visible.map((m) => {
      const picked = livePicks[m.key];
      const st = BREATH_STATES[picked];
      const tech = st.techniques[0];
      const minutes = st.durations[st.defaultDuration].minutes;
      return {
        now: h >= m.from && h < m.to,
        moment: m,
        state: st,
        techName: tech.name,
        techKey: tech.key,
        minutes,
        exact: roundsFor(tech, minutes) * cycleSeconds(tech),
        done: doneInWindow(m.from, m.to),
        planIndex: null as number | null,
        reminderAt: minsFor(m.key),
      };
    });
  }, [history, goalKeys, visible, planDay]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.bar}>
        <AnimatedPressable
          /* Operator, 7 september 2026: eerst opgelost via `push` i.p.v.
             `replace` in breath-welcome.tsx (zodat stap 7 op de stack
             bleef staan), maar dat betekende nog steeds stap-voor-stap
             terugbladeren door de hele keten — "kan dat telkens met 1
             klik [naar stap 7]?" Nu: `fromBreathWelcome` (zie
             intensity.tsx) springt in 1 tik naar de bestaande
             stap-7-instantie. Buiten die context (bv. vanuit Activity)
             blijft gewone stack-navigatie. */
          onPress={() =>
            /* Operator, 11 september 2026: "eens je een echt actief plan
               hebt, hoort terug NOOIT meer naar onboarding te gaan" — dit
               scherm is precies de stap NA plan-duration.tsx's `confirm()`
               (die het plan al opslaat vóór hierheen te navigeren), dus
               `plan` bestaat hier altijd al zodra je via de protocol-flow
               binnenkomt. Zonder de `!plan`-check sprong terug hier altijd
               naar onboarding-stap 6, ook al was het protocol al klaar —
               exact de gerapporteerde eindeloze lus. */
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
          hitSlop={12}
          onPressIn={onBackPressIn}
          onPressOut={onBackPressOut}
          style={[s.back, backStyle]}
        >
          {/* Operator, 1 okt 2026 ("headers overal consistent"): size
             22→20, stroke 2.2→2.8 — de "officiële iOS-chevron.backward"-
             stijl uit build-choice.tsx (18 sept), nu de app-brede
             standaard. */}
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </AnimatedPressable>
        {/* Operator, 3 okt 2026 ("set timing moet your protocol heten"):
           was "Set timing" zodra er een actief protocol is (13 augustus
           2026, stap 5 van de protocol-flow) — dit scherm is nu ook de
           bestemming van agenda.tsx se "Check your protocol"-knop, dus
           "Your protocol" past beter bij die binnenkomst. Zonder protocol
           blijft de oude, generieke naam. */}
        <Text style={s.title}>{plan ? 'Your protocol' : 'Your plan'}</Text>
        <View style={s.back} />
      </View>

      {/* Operator, 3 okt 2026 ("welke kleur krijgen de kaarten als je erop
         tikt, die kleur moet in Your protocol gebruikt worden"): het
         screenshot van "Set your state" toont de tegels ONGESELECTEERD —
         dat laat nooit de geklikte kleur zien. De ECHTE geselecteerde
         stijl staat in goal.tsx se `GoalTile` zelf: bij `on` krijgt de
         VOLLE tegel een diagonale `g.gradient` (2 kleuren, bv. "diep
         koningsblauw naar paars" voor Sleep better) over de matglas-basis,
         plus een witte rand (`rgba(255,255,255,0.4)`) — geen bolletje,
         geen subtiele randtint. Hier 1:1 overgenomen (deze kaarten zijn
         altijd "gekozen", dus de gradiënt staat hier permanent aan, niet
         conditioneel op een tik). */}
      {plan && (
        <View style={s.protocolMetaWrap}>
          {/* Operator, 3 okt 2026 ("wat als er maar 1 state gekozen
             wordt?"): bij 1 doel liet een vaste `width:'48%'` de kaart
             links staan met lege ruimte rechts ernaast. Geen nieuwe
             breedte/hoogte-waarde verzinnen — de kaart zelf blijft exact
             48% (zelfde formaat als altijd), enkel de RIJ centreert 'm
             als er maar één is, i.p.v. links te laten hangen. */}
          {/* Operator, 3 okt 2026 ("juiste animatie bij vernieuwingen?"):
             stond volledig statisch — zelfde gestaffelde entry-protocol
             als elders deze sessie (feel-now.tsx se kaarten-grid): rechte
             `FadeInUp`, GEEN `.springify()` (die gaf daar eerder al
             "te veel bounce"-klachten op een vergelijkbare kaarten-grid). */}
          <View style={[s.goalCardRow, chosen.length === 1 && s.goalCardRowCenter]}>
            {chosen.map((g, idx) => (
              <Animated.View
                key={g.key}
                entering={FadeInUp.delay(150 + idx * 40).duration(280)}
                style={[s.goalCard, s.protoCardSelected]}
              >
                <BlurView
                  intensity={40}
                  tint="dark"
                  blurMethod="dimezisBlurViewSdk31Plus"
                  style={StyleSheet.absoluteFill}
                />
                <ExpoGradient
                  colors={g.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                {/* Operator, 3 okt 2026 ("iconen ook groter"): 28→44
                   (image) / 22→34 (lucide-fallback) — dichter bij
                   goal.tsx se eigen compacte-tegel-maat (46 voor de
                   meeste doelen). */}
                {g.image ? (
                  <Image
                    source={{ uri: g.image }}
                    style={{ width: 44, height: 44, tintColor: '#ffffff' }}
                    resizeMode="contain"
                  />
                ) : (
                  <g.Icon size={34} color="#ffffff" strokeWidth={1.8} />
                )}
                <Text style={s.goalCardTxt}>{g.name}</Text>
              </Animated.View>
            ))}
          </View>

          {/* Operator, 3 okt 2026 ("level en tijd ook in kaarten
             weergeven"): was één doorlopende tekstregel — nu drie eigen
             kaarten, zelfde neutrale chrome als de doel-kaarten hierboven
             (geen accentkleur hier, deze drie horen niet bij een
             specifiek doel). Entry-stagger vervolgt vanaf waar de
             doel-kaarten eindigden (`chosen.length`), zodat het hele blok
             als één doorlopende reveal voelt. */}
          <View style={s.goalCardRow}>
            <Animated.View
              entering={FadeInUp.delay(150 + chosen.length * 40).duration(280)}
              style={s.metaCard}
            >
              <Text style={s.metaCardLabel}>LEVEL</Text>
              <Text style={s.metaCardTxt}>
                {LEVEL_LABEL[experienceLevel ?? ''] ?? 'Not set'}
              </Text>
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(150 + (chosen.length + 1) * 40).duration(280)}
              style={s.metaCard}
            >
              <Text style={s.metaCardLabel}>ROUTINE</Text>
              <Text style={s.metaCardTxt}>
                {ROUTINE_LABEL[plan.intensity] ?? plan.intensity}
              </Text>
              {/* Operator, 3 okt 2026 ("Routine Complete, is dat duidelijk
                 voor lezer?"): terecht — "Complete" alleen kan lezen als
                 "voltooid/afgerond" i.p.v. "de volledige routine". Zelfde
                 verduidelijking als intensity.tsx se eigen `hint`-tekst
                 ("4 sessions a day"), hier met het al gefixte ECHTE
                 aantal (`items.length`, zie de toelichting bij
                 `momentsWord` hierboven) i.p.v. een los, mogelijk
                 verouderd getal. */}
              <Text style={s.metaCardHint}>{items.length} sessions a day</Text>
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(150 + (chosen.length + 2) * 40).duration(280)}
              style={s.metaCard}
            >
              <Text style={s.metaCardLabel}>PLAN LENGTH</Text>
              <Text style={s.metaCardTxt}>
                {HORIZON_LABEL[plan.horizon] ?? plan.horizon}
              </Text>
            </Animated.View>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: Math.max(insets.bottom, 12) + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Het AANTAL telt mee (operator, 8 augustus 2026): wie in de
            vragenlijst ook de middag koos, ziet drie momenten — dan hoort
            hier geen "two" te staan.
            Operator, 3 okt 2026 ("jij zegt 2 moments a day maar protocol
            heeft 4 moments"): was `visible.length` — dat is het aantal
            DAGDELEN uit het sjabloon (max 3: morning/midday/evening), niet
            het werkelijke aantal sessies. Sinds "Bouw je dag" (17
            september 2026) kan één dagdeel meerdere sessies dragen (zie
            `items` hierboven, "één rij per ECHT item uit planDay.items,
            niet één per dagdeel") — bij een echt protocol moet dus
            `items.length` tellen, niet `visible.length`. Woorden tot 6,
            daarna het cijfer zelf (geen zin om tien woorden te verzinnen
            voor een edge case). */}
        <Text style={s.lead}>
          {chosen.length > 0
            ? `${momentsWord(items.length)} a day, shaped around ${chosen
                .slice(0, 2)
                .map((g) => g.name.toLowerCase())
                .join(' and ')}.`
            : `${momentsWord(items.length)} a day. Pick a goal to shape them around what you want.`}
        </Text>

        {justSet && (
          <View style={s.confirm}>
            <Bell size={14} color={AudioAccent} strokeWidth={2.4} />
            <Text style={s.confirmTxt}>{justSet}</Text>
          </View>
        )}

        {/* De hele kaart opent de sessie (operator, 8 augustus 2026). De
            START-knop stond alleen op het moment dat "aan de beurt" was —
            een regel die niemand kon raden. Wie 's ochtends zijn avondsessie
            wil doen, mag dat; het plan is een uitnodiging, geen slagboom. */}
        {items.map((it, index) => (
          <PlanItemCard
            /* Index i.p.v. slot als key/identiteit — een dagdeel kan nu
               meerdere items dragen, zie de toelichting bij `items`. */
            key={it.planIndex ?? `live-${it.moment.key}`}
            it={it}
            plan={plan}
            onOpenSession={() =>
              openBreathSession({
                  ...claimFreeSessionParam(),
                  state: it.state.key,
                  /* De geplande techniek, niet de standaard (6 okt 2026). */
                  technique: it.techKey,
                  minutes: String(it.minutes),
                  /* Operator, 11 september 2026: "check alles overal, de
                     oude selectiepagina op breath-session.tsx mag nooit
                     meer verschijnen" — deze kaart geeft mode+duur al
                     mee, dus er valt niets te kiezen; zonder `autostart`
                     toonde het scherm zijn eigen, overbodige kies-UI. */
                  autostart: '1',
                  /* terug naar het protocol na de sessie (audit 5 okt 2026) */
                  fromPlan: '1',
})
            }
            onOpenDuration={() => setDurationPicking(index)}
            onOpenTime={() => setPicking(index)}
            fmtTime={fmtTime}
          />
        ))}

        {/* "Explore all modes" alleen buiten de protocol-flow (operator, 13
            augustus 2026: "op deze pagina hoeft er geen knop met alle modes
            te staan... hij is nu zijn planning aan het instellen" — een
            weg-knop tijdens het configureren leidt af/verwart). Zonder
            actief protocol blijft dit gewoon de bladerknop van vroeger. */}
        {!plan && (
          <AnimatedPressable
            style={[s.allModes, allModesStyle]}
            /* `navigate` en niet `push` (operator, 9 augustus 2026: "gaat naar
               verkeerde pagina"). Deze pagina staat BUITEN de tab-groep, en
               een `push` van daar zet een hele nieuwe tab-navigator boven op
               de bestaande — de bestemming klopt dan wel, maar de weg ernaartoe
               niet. `navigate` schakelt gewoon om naar de bestaande tab, zoals
               overal elders vanuit een root-scherm (zie BreathMiniControl). */
            onPress={() => {
              skipBreathIntroOnce();
              router.navigate('/breath' as never);
            }}
            onPressIn={onAllModesPressIn}
            onPressOut={onAllModesPressOut}
            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
          >
            <Text style={s.allModesTxt}>Explore all modes</Text>
            <ChevronRight
              size={16}
              color="rgba(255,255,255,0.6)"
              strokeWidth={2.2}
            />
          </AnimatedPressable>
        )}

        {/* ── Van voorstel naar afspraak ─────────────────────────────────
             Met een actief protocol staan reminders altijd aan voor de
             tijden hierboven (de useEffect bovenaan roept syncPlanReminders
             bij elke wijziging) — deze knop is dan overbodig. Zonder
             protocol blijft het oude gedrag: een plan dat niets plant is
             een lijstje (operator, 6 augustus 2026).

             PROMINENTER dan voorheen (operator, 13 augustus 2026): stond op
             dezelfde, omlijnde stijl als "Explore all modes" — voor de
             hoofdactie van dit scherm ("Review & confirm" tijdens
             onboarding) hoort er geen twijfel te zijn welke knop de
             belangrijkste is. */}
        {plan ? (
          <AnimatedPressable
            style={[s.primaryCta, primaryCtaStyle]}
            onPressIn={onPrimaryCtaPressIn}
            onPressOut={onPrimaryCtaPressOut}
            onPress={() =>
              /* Operator, 7 september 2026: "als user de hele agenda flow
                 doorloopt moet hij toch altijd terug naar die step 7
                 kunnen gaan" — `onboarding` moet dus WÉL meegegeven worden
                 aan elke volgende stap, anders raakt de context onderweg
                 kwijt en weet Agenda niet meer dat terug naar stap 7 moet
                 i.p.v. naar Activity. */
              onboarding
                ? router.push({
                    pathname: '/plan-summary',
                    params: {
                      onboarding: '1',
                      ...(fromBreathWelcome ? { fromBreathWelcome } : {}),
                    },
                  } as never)
                : router.push('/agenda' as never)
            }
          >
            <Text style={s.primaryCtaTxt}>
              {onboarding ? 'REVIEW & CONFIRM' : 'OPEN YOUR AGENDA'}
            </Text>
            <ChevronRight size={18} color="#0a0a0a" strokeWidth={2.4} />
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            style={[s.remind, planned && s.remindOn, remindStyle]}
            onPressIn={onRemindPressIn}
            onPressOut={onRemindPressOut}
            onPress={async () => {
              const next = { ...reminders };
              for (const m of visible) {
                next[reminderKey('breath', m.key)] = !planned;
              }
              if (!planned && !(await ensurePermission())) return;
              await setReminders(next);
              void syncReminders(next, at, goalKeys);
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
          </AnimatedPressable>
        )}

        {!plan && chosen.length === 0 && (
          <AnimatedPressable
            style={[s.goalCta, goalCtaStyle]}
            onPress={() => router.push('/build-choice' as never)}
            onPressIn={onGoalCtaPressIn}
            onPressOut={onGoalCtaPressOut}
          >
            <Text style={s.goalCtaTxt}>CHOOSE A GOAL</Text>
          </AnimatedPressable>
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
      {/* Operator, 8 okt 2026: echt glas-onderblad i.p.v. los venster. */}
      <GlassSheet visible={picking !== null} onClose={() => setPicking(null)}>
          <View
            style={[
              s.pickSheet,
              s.pickSheetGlass,
              { paddingBottom: Math.max(insets.bottom, 14) + 14 },
            ]}
          >
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            {/* Handvat, zoals elk ander onderpaneel op het toestel — dat is
                het verschil tussen "hier is een lijst geplakt" en "dit
                schuift open" (operator, 10 augustus 2026: "zo onderaan
                gepropt en saai"). */}
            <View style={s.pickHandle} />
            {(() => {
              const item = picking !== null ? items[picking] : null;
              if (!item) return null;
              return (
                <>
                  <Text style={s.pickTitle}>
                    {item.moment.label.charAt(0) +
                      item.moment.label.slice(1).toLowerCase() +
                      ' time'}
                  </Text>
                  {/* De reden erbij — dit IS de toestand die er nu staat,
                      niet zomaar een uur (operator, dezelfde regel: "saai" —
                      een sheet die alleen cijfers toont vertelt niets over
                      WAT er om die tijd gebeurt). */}
                  <Text style={s.pickSub}>
                    {item.state.eyebrow} · {item.techName}
                  </Text>
                </>
              );
            })()}
            <ScrollView
              style={s.pickScroll}
              showsVerticalScrollIndicator={false}
            >
            <View style={s.pickGrid}>
              {picking !== null && items[picking] &&
                (() => {
                  const item = items[picking!];
                  const m = item.moment;
                  const out: number[] = [];
                  for (let h = m.from; h < m.to; h += 1) {
                    out.push(h * 60, h * 60 + 15, h * 60 + 30, h * 60 + 45);
                  }
                  const cur = item.reminderAt;
                  const accent = item.state.accent;
                  return out.map((mins) => {
                    const on = mins === cur;
                    return (
                      <Pressable
                        key={mins}
                        onPress={async () => {
                          const slot = item.moment.key;
                          setPicking(null);

                          if (plan && item.planIndex !== null) {
                            /* Zet de tijd voor DIT item (positie
                               `item.planIndex`) op ELKE dag van het
                               protocol — de template herhaalt zich toch al
                               identiek over de hele horizon (protocol.ts),
                               dus een tijd hoort dat ook te doen. Operator,
                               17 september 2026: matchte voorheen op
                               `slot`, wat twee items in hetzelfde dagdeel
                               allebei zou raken. */
                            const planIndex = item.planIndex;
                            const days = Object.fromEntries(
                              Object.entries(plan.days).map(([dk, day]) => [
                                dk,
                                {
                                  ...day,
                                  items: day.items.map((it, i) =>
                                    i === planIndex
                                      ? { ...it, reminderAt: mins }
                                      : it,
                                  ),
                                },
                              ]),
                            );
                            const updated = { ...plan, days };
                            await saveActivePlan(updated);
                            void syncPlanReminders(updated);
                            const lbl =
                              slot.charAt(0).toUpperCase() + slot.slice(1);
                            setJustSet(lbl + ' — ' + nextFireText(mins));
                            return;
                          }

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
                            goalKeys,
                          );
                          /* Met het moment erbij: "First reminder today
                             at 13:00" zónder context las alsof het hele plan
                             om 13:00 begon (operator, 8 augustus 2026). */
                          const lbl =
                            slot.charAt(0).toUpperCase() + slot.slice(1);
                          setJustSet(lbl + ' — ' + nextFireText(mins));
                        }}
                        style={[
                          s.pickChip,
                          on && {
                            borderColor: accent,
                            backgroundColor: `${accent}1F`,
                          },
                        ]}
                        android_ripple={{
                          color: 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <Text
                          style={[
                            s.pickChipTxt,
                            on && { color: '#ffffff', fontFamily: BrandFonts.bold },
                          ]}
                        >
                          {fmtTime(mins)}
                        </Text>
                      </Pressable>
                    );
                  });
                })()}
            </View>
            </ScrollView>
          </View>
      </GlassSheet>

      {/* ── Duur-kiezer ── zelfde als op plan-review.tsx, nu ook bereikbaar
          NA het opzetten: een protocol is geen contract (operator, 13
          augustus 2026). */}
      <GlassSheet visible={durationPicking !== null} onClose={() => setDurationPicking(null)}>
          <View style={[s.pickSheet, s.pickSheetGlass, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}>
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <View style={s.pickHandle} />
            {durationPicking !== null && (() => {
              const item = durationPicking !== null ? items[durationPicking] : null;
              if (!item || item.planIndex === null) return null;
              const planIndex = item.planIndex;
              /* Operator, 1 okt 2026 ("edit duration... lijkt mij nog oud
                 systeem"): zelfde discrete `pickChip`-grid als agenda.tsx
                 had vóór breath-setup.tsx's wheel-redesign (24 sept 2026)
                 — nu de gedeelde `DurationWheel` (components/
                 DurationWheel.tsx), identiek aan agenda.tsx's eigen
                 duur-editor. */
              return (
                <>
                  <View style={s.pickHeader}>
                    <Text style={[s.pickTitle, s.pickTitleInRow]}>{item.state.eyebrow} duration</Text>
                    <Pressable onPress={() => setDurationPicking(null)} hitSlop={10} accessibilityRole="button">
                      <Text style={s.pickDoneTxt}>Done</Text>
                    </Pressable>
                  </View>
                  <DurationWheel
                    options={durationOptionsFor(item.state.key, item.techKey).options}
                    value={item.minutes}
                    accent={item.state.accent}
                    trackColor="rgba(255,255,255,0.4)"
                    recommendedValue={durationOptionsFor(item.state.key, item.techKey).recommended ?? undefined}
                    onChange={(v) => void setMinutesForPlanIndex(planIndex, v)}
                  />
                </>
              );
            })()}
          </View>
      </GlassSheet>
    </SafeAreaView>
  );
}

/* Eigen component i.p.v. inline in `items.map()` — hooks (press-animatie)
   mogen niet in een loop/callback staan, dus elke kaart krijgt haar eigen
   componentinstantie. Zelfde recept als `StartCard` in breath-welcome.tsx. */
function PlanItemCard({
  it,
  plan,
  onOpenSession,
  onOpenDuration,
  onOpenTime,
  fmtTime,
}: {
  it: {
    done: boolean;
    state: { accent: string; eyebrow: string; key: BreathStateKey };
    moment: { label: string };
    techName: string;
    minutes: number;
    reminderAt: number;
  };
  plan: unknown;
  onOpenSession: () => void;
  onOpenDuration: () => void;
  onOpenTime: () => void;
  fmtTime: (mins: number) => string;
}) {
  const pressScale = useSharedValue(1);
  /* Operator, 4 okt 2026 (smoothness-audit: "geen enkele haptic in dit
     bestand"): `PlanItemCard` is het meest-aangetikte element op dit
     scherm (één per sessie-rij) en had, net als de rest van plan.tsx,
     geen enkele haptic — enkel de schaal-animatie. Op `onPressIn` i.p.v.
     `onPress`, zelfde "zo vroeg mogelijk voelbaar"-redenering als
     settings.tsx se `PressFeedback`-fix. */
  const onPressIn = () => {
    Haptics.selectionAsync();
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onOpenSession}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        s.card,
        { borderColor: it.done ? `${it.state.accent}55` : 'rgba(255,255,255,0.09)' },
        pressStyle,
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

      {/* Teken van de toestand naast de naam, zelfde als de Breath-tab
          (operator, 5 okt 2026). */}
      <View style={s.stateRow}>
        {(() => {
          const Glyph = STATE_GLYPH_ICONS[it.state.key];
          return <Glyph size={17} color={it.state.accent} strokeWidth={2} />;
        })()}
        <Text style={[s.state, s.stateInRow]}>{it.state.eyebrow}</Text>
      </View>
      {plan ? (
        <Pressable
          style={s.detailBtn}
          onPress={() => {
            Haptics.selectionAsync();
            onOpenDuration();
          }}
          hitSlop={8}
        >
          <Text style={s.detail}>
            {it.techName} · {it.minutes} min
          </Text>
          <Pencil size={12} color="rgba(255,255,255,0.4)" strokeWidth={2.2} />
        </Pressable>
      ) : (
        <Text style={s.detail}>
          {it.techName} · {it.minutes} min
        </Text>
      )}

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
        onPress={() => {
          Haptics.selectionAsync();
          onOpenTime();
        }}
      >
        <Clock size={15} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
        {/* Operator, 3 okt 2026 ("reminder zou ik veranderen naar start of
           begins, wat is professioneel"): "Start" — directer, zelfde taal
           als "Start session" elders in de app, i.p.v. "Reminder" dat
           suggereert dat dit enkel een notificatie-tijdstip is en niet
           letterlijk WANNEER de sessie begint. */}
        <Text style={s.timeLbl}>Start</Text>
        <Text style={[s.timeVal, { color: it.state.accent }]}>
          {fmtTime(it.reminderAt)}
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
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },

  /* ── Tijdkiezer ── */
  pickSheetGlass: { backgroundColor: 'transparent', overflow: 'hidden', borderWidth: 0 },
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
    paddingTop: 10,
    alignItems: 'center',
  },
  /* Operator, 8 okt 2026 ("done rechtsboven volgens ons protocol"):
     zelfde kiezer-kop als breath-setup.tsx — titel links, Done rechts. */
  pickHeader: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pickTitleInRow: { marginBottom: 0, alignSelf: 'auto' },
  pickDoneTxt: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff' },
  pickHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  pickAccent: {
    width: 30,
    height: 3,
    borderRadius: 2,
    marginBottom: 8,
  },
  pickTitle: {
    alignSelf: 'flex-start',
    fontFamily: BrandFonts.bold,
    fontSize: 17,
    color: '#ffffff',
  },
  pickSub: {
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 14,
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)',
  },
  /* Nooit hoger dan iets meer dan een half scherm: het venster van de
     ochtend telt 32 tijden en dat paste niet overal (operator, 8 augustus
     2026: "moet voor eender welke sessie volledig in beeld staan"). */
  /* Zes volledige rijen, en de zevende piept er half onderuit — dat halve
     rijtje is geen slordigheid maar het teken dat er meer is. De onderrand
     van het paneel volgt de veilige zone, dus de navigatiebalk snijdt nooit
     meer door een tijd heen (operator, 8 augustus 2026). */
  pickScroll: { maxHeight: 322, width: '100%' },
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
  /* Huisstijl v4.4: Brand.accent (#3a8fff, Signal Blue) is enkel voor
     haptic-pulse/"nu actief" — nooit voor selectie-chips. */
  pickChipOn: {
    borderColor: AudioAccent,
    backgroundColor: 'rgba(110,133,196,0.12)',
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
  protocolMetaWrap: { paddingHorizontal: 16, marginTop: 10, gap: 12 },
  /* Operator, 3 okt 2026 ("kaarten geen pills"): echte verticale kaart —
     icoon boven, label eronder — zelfde chrome/verhouding als goal.tsx se
     `tile` (borderRadius 20, rand rgba(255,255,255,0.14), 48% breed) en
     breath-welcome.tsx se modeCard, niet een horizontale pil-rij. */
  goalCardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  /* Enkel toegepast bij precies 1 doel (zie JSX) — centreert de ene kaart
     i.p.v. links te laten hangen met lege ruimte ernaast. */
  goalCardRowCenter: { justifyContent: 'center' },
  /* Operator, 3 okt 2026 ("welke kleur krijgen de kaarten als je erop
     tikt, die kleur moet in Your protocol gebruikt worden"): 1:1
     overgenomen van goal.tsx se `GoalTile` IN GESELECTEERDE staat (`on`)
     — volle tegel, `overflow:'hidden'` zodat de BlurView/gradiënt-
     absoluteFill binnen de ronde hoeken blijft, witte rand. Inhoud
     gecentreerd (icoon boven, naam eronder) — exact `tileCompact`/
     `tileCompactCol`'s `alignItems:'center'`/`justifyContent:'center'`,
     niet onderaan verankerd. De gradiënt zelf (`g.gradient`) staat los op
     de JSX, dit is enkel de kaart-schil. */
  goalCard: {
    width: '48%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 20,
    overflow: 'hidden',
  },
  protoCardSelected: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  goalCardTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    color: '#ffffff',
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  /* Operator, 3 okt 2026 ("level en tijd ook in kaarten weergeven"): drie
     smallere kaarten naast elkaar i.p.v. de losse tekstregel — zelfde
     neutrale chrome als `goalCard`, geen accentkleur (horen niet bij een
     specifiek doel). */
  metaCard: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  metaCardLabel: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.4)',
  },
  metaCardTxt: { fontFamily: BrandFonts.semibold, fontSize: 13, color: '#ffffff' },
  metaCardHint: { fontFamily: BrandFonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  scroll: { paddingHorizontal: 16 },
  /* Operator, 3 okt 2026 ("four moments... moet lager, meer
     ademruimte"): 6 → 20 — stond te dicht tegen de nieuwe doel-/meta-
     kaarten hierboven aangeplakt. */
  lead: {
    marginTop: 20,
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
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  stateInRow: { marginTop: 0 },
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
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
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
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',
  },
  primaryCtaTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: '#0a0a0a',
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
    borderColor: 'rgba(110,133,196,0.35)',
    backgroundColor: 'rgba(110,133,196,0.10)',
    marginBottom: 14,
  },
  confirmTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    /* Huisstijl v4.4: dit is een tijdelijke bevestigingsbanner, geen
       haptic-pulse/"nu actief"-status, dus geen Signal Blue (Brand.accent)
       meer — AudioAccent is de merkkleur voor tekst op donker. */
    color: AudioAccent,
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
