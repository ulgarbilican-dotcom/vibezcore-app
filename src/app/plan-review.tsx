/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Your protocol

   Laatste stap van de Protocol-flow (operator, 13 augustus 2026,
   protocol-systeem): toont wat Pad A (Goal+Intensity, incl. Times sinds
   21 september) of Pad B (Build your day) opleveren, per item
   replace/remove.

   Operator, 18 september 2026 (grote samenvoeging — "de twee/drie schermen
   die we nu hebben zijn eigenlijk dezelfde stap"): TWEE eerdere aparte
   schermen zijn weg:
   1. building-protocol.tsx (het "building"-tussenscherm) — de aanroepers
      (intensity.tsx/build-your-day.tsx) berekenen de template nu zelf en
      geven 'm direct door, precies zoals dit scherm 'm al kon lezen.
   2. plan-duration.tsx ("How long does this run?") — die horizon-keuze
      verhuisde eerst hierheen als chip-rij, daarna (op verzoek, "aantal
      dagen moet in add to day komen") naar de addToDay-ringeditor zelf
      (breath-setup.tsx, Pad B) — dit scherm LEEST 'm enkel nog uit via de
      `horizon`-param (Pad A kent 'm niet, valt terug op '2w', zie
      hieronder). `confirm()` bouwt en bewaart meteen het echte plan i.p.v.
      naar een vierde/zesde scherm door te sturen.

   Operator, 21 september 2026: daypart-picker.tsx ("Set your times", het
   vroegere 4e scherm van Pad A) bestaat niet meer apart — samengevoegd in
   intensity.tsx ("Set your routine" doet nu Routine+Level+Times in één
   stap). Pad A is daardoor 4 stappen i.p.v. 5 (zie `totalSteps`
   hieronder). */

import { BrandDark, BrandLight, BrandFonts, CTA, TypeScale } from '@/constants/theme';
import { StepIndicator } from '@/components/StepIndicator';
import { ProtocolFlowCancel } from '@/components/ProtocolFlowCancel';
import { Check } from 'lucide-react-native';
import { BREATH_STATES } from '@/data/breath-states';
import { DurationWheel } from '@/components/DurationWheel';
import { DAYPART_PHOTO } from '@/data/daypart-photos';
import { SLOTS } from '@/services/reminders';
import StateGlyph from '@/components/StateGlyph';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { saveActivePlan, useActivePlan } from '@/utils/plan-store';
import {
  buildPlanFromTemplate,
  generateCustomTemplate,
  generateTemplate,
  removeTemplateItem,
  setTemplateItemState,
} from '@/utils/protocol';
import { explainProtocol } from '@/utils/protocol-explainer';
import type { BreathStateKey } from '@/data/breath-states';
import type { PlannedItem, PlanHorizon, PlanSlot } from '@/utils/plan-store';
import { getSetting } from '@/utils/settings';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Info, Pencil, RefreshCw, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const fmtTime = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

/* Operator, 18 september 2026 ("Apple-redesign van 'Your protocol':
   Deference/Clarity, gegroepeerd per dagdeel i.p.v. losse kaarten"): was
   `true` (licht) — dit scherm blijft nu ALTIJD donker, zelfde aanpak als
   build-choice.tsx/build-your-day.tsx eerder deze sessie kregen. */
const light = false;
const C = light ? BrandLight : BrandDark;

/* Eén sessie-rij binnen een dagdeel-kaart — eigen component omdat dit
   binnen een `.map()` gerenderd wordt (hooks per iteratie zijn niet
   toegestaan in de render-body zelf). */
function GroupRow({
  it,
  i,
  onPickTime,
  onPickState,
  onRemove,
}: {
  it: PlannedItem;
  i: number;
  onPickTime: (i: number) => void;
  onPickState: (i: number) => void;
  onRemove: (i: number) => void;
}) {
  const st = BREATH_STATES[it.state];

  const timeScale = useSharedValue(1);
  const onTimePressIn = () => {
    timeScale.value = withTiming(0.95, { duration: 80 });
  };
  const onTimePressOut = () => {
    timeScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const timeStyle = useAnimatedStyle(() => ({ transform: [{ scale: timeScale.value }] }));

  const refreshScale = useSharedValue(1);
  const onRefreshPressIn = () => {
    refreshScale.value = withTiming(0.92, { duration: 80 });
  };
  const onRefreshPressOut = () => {
    refreshScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const refreshStyle = useAnimatedStyle(() => ({ transform: [{ scale: refreshScale.value }] }));

  const removeScale = useSharedValue(1);
  const onRemovePressIn = () => {
    removeScale.value = withTiming(0.92, { duration: 80 });
  };
  const onRemovePressOut = () => {
    removeScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const removeStyle = useAnimatedStyle(() => ({ transform: [{ scale: removeScale.value }] }));

  return (
    <View style={s.groupRow}>
      <View
        style={[
          s.groupIconWrap,
          { backgroundColor: `${st.accent}0A` },
        ]}
      >
        <StateGlyph
          stateKey={it.state}
          size={18}
          color={st.accent}
          strokeWidth={1.8}
        />
      </View>
      <View style={s.groupRowText}>
        <AnimatedPressable
          style={[s.groupTimeRow, timeStyle]}
          onPress={() => {
            Haptics.selectionAsync();
            onPickTime(i);
          }}
          onPressIn={onTimePressIn}
          onPressOut={onTimePressOut}
          hitSlop={6}
        >
          <Text style={s.groupTime}>
            {fmtTime(it.reminderAt)} · {it.minutes} min
          </Text>
          <Pencil size={11} color="rgba(255,255,255,0.35)" strokeWidth={2.2} />
        </AnimatedPressable>
        <Text style={s.groupStateName} numberOfLines={1}>
          {st.eyebrow.toUpperCase()}
        </Text>
      </View>
      <AnimatedPressable
        onPress={() => {
          Haptics.selectionAsync();
          onPickState(i);
        }}
        onPressIn={onRefreshPressIn}
        onPressOut={onRefreshPressOut}
        hitSlop={8}
        style={[s.groupActionBtn, refreshStyle]}
      >
        <RefreshCw size={14} color="rgba(255,255,255,0.4)" strokeWidth={2.2} />
      </AnimatedPressable>
      <AnimatedPressable
        onPress={() => onRemove(i)}
        onPressIn={onRemovePressIn}
        onPressOut={onRemovePressOut}
        hitSlop={8}
        style={[s.groupActionBtn, removeStyle]}
      >
        <X size={15} color="rgba(255,255,255,0.4)" strokeWidth={2.4} />
      </AnimatedPressable>
      <View style={[s.checkBadge, { backgroundColor: st.accent }]}>
        <Check size={12} color="#ffffff" strokeWidth={3} />
      </View>
    </View>
  );
}

/* Eén staat-chip in de staat-kiezer — eigen component, zelfde reden als
   `GroupRow` hierboven. */
function StateChip({
  stateKey,
  active,
  onPress,
}: {
  stateKey: BreathStateKey;
  active: boolean;
  onPress: () => void;
}) {
  const st = BREATH_STATES[stateKey];
  const scale = useSharedValue(1);
  const onPressIn = () => {
    scale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        s.pickStateChip,
        active && { borderColor: st.accent, backgroundColor: `${st.accent}1F` },
        pressStyle,
      ]}
    >
      <StateGlyph
        stateKey={stateKey}
        size={18}
        color={active ? st.accent : 'rgba(255,255,255,0.5)'}
        strokeWidth={1.8}
      />
      <Text style={[s.pickChipTxt, active && { color: st.accent }]}>
        {st.eyebrow}
      </Text>
    </AnimatedPressable>
  );
}

export default function PlanReviewScreen() {
  const insets = useSafeAreaInsets();
  /* Operator, 7 september 2026: zie intensity.tsx voor de toelichting —
     dit signaal loopt door de hele keten zodat terug altijd in 1 tik naar
     stap 7 springt. */
  const { fromBreathWelcome, path, slotCounts, template, horizon: horizonParam } =
    useLocalSearchParams<{
      fromBreathWelcome?: string;
      /* Operator, 17 september 2026: dit scherm is nu het gedeelde eindpunt
         van BEIDE paden (build-choice.tsx) — 'auto' komt via intensity.tsx
         (4 stappen totaal), 'custom' via "Build your day" (3 stappen).
         Ontbreekt het (rechtstreekse link, oude staat), dan valt dit terug
         op 'auto' — de langere, dus veiligere aanname. */
      path?: 'auto' | 'custom';
      /* Enkel bij `path === 'custom'` — JSON van build-your-day.tsx's
         `Record<PlanSlot, number>`. */
      slotCounts?: string;
      /* Komt van intensity.tsx/build-your-day.tsx: zij berekenen de
         template al zelf en geven 'm hier door — voorkomt dat dit scherm
         het werk een tweede keer doet en per ongeluk iets anders uitrekent
         dan wat net getoond werd. */
      template?: string;
      /* Operator, 18 september 2026 ("aantal dagen moet in add to day
         komen"): op Pad B kiest de gebruiker dit uiteindelijk op de
         addToDay-ringeditor (breath-setup.tsx), doorgegeven via
         build-your-day.tsx. Pad A kent deze param niet — valt terug op de
         standaard hieronder. */
      horizon?: string;
    }>();
  /* Operator, 17 september 2026: build-choice.tsx verhuisde naar stap 1
     (vóór Goal) en Pad B slaat Goal helemaal over — dus 5 stappen voor
     Pad A (Build-choice → Goal → Intensity → Set your times → hier), 3
     voor Pad B (Build-choice → Build your day → hier). */
  const totalSteps = path === 'custom' ? 3 : 5;
  /* Operator, 11 september 2026: "eens je een echt actief plan hebt,
     hoort terug NOOIT meer naar onboarding te gaan" — zie intensity.tsx
     voor de volledige toelichting. */
  const { plan } = useActivePlan();
  const goals = getSetting('goals');
  const intensity = getSetting('intensity') ?? 'standard';
  /* Operator, 21 september 2026: bepaalt WELKE techniek per toestand
     gekozen wordt (`protocol.ts`, `techniqueKeyForLevel`) — was altijd
     hardcoded Beginner ongeacht wie de gebruiker is. */
  const level = getSetting('experienceLevel') ?? 'beginner';
  /* Operator, 17 september 2026: de dagdeel-kiezer (Pad A) schreef de
     gekozen dagdelen al naar `profile.preferredSlots` — die neemt
     `generateTemplate` nu over i.p.v. zelf te gokken via
     `bestSlotsForCount`. Komt het aantal niet overeen (bv. Pad B, of een
     oude voorkeur van een ander protocol), dan valt die functie zelf terug
     op de schatting. */
  const preferredSlots = getSetting('profile').preferredSlots as
    | PlannedItem['slot'][]
    | undefined;

  const [items, setItems] = useState<PlannedItem[]>(() => {
    if (template) {
      try {
        return JSON.parse(template) as PlannedItem[];
      } catch {
        /* Val door naar de normale generatie hieronder. */
      }
    }
    /* Pad B ("Build it yourself"): eigen generator, geen intensiteit-tier
       — `generateTemplate`/`bestSlotsForCount` gaan uit van hoogstens 1
       item per dagdeel en passen hier niet. Zie protocol.ts. */
    if (path === 'custom' && slotCounts) {
      try {
        const counts = JSON.parse(slotCounts) as Partial<Record<PlanSlot, number>>;
        return generateCustomTemplate(goals, counts, level);
      } catch {
        /* Kapotte/ontbrekende param — val terug op het automatische pad
           i.p.v. een leeg scherm te tonen. */
      }
    }
    return generateTemplate(goals, intensity, preferredSlots, level);
  });
  /* Welk item zijn duur-kiezer openstaat, of null. */
  const [picking, setPicking] = useState<number | null>(null);
  /* Welk item zijn staat-kiezer openstaat, of null (operator, 21 september
     2026: "als gebruiker niet akkoord is met een state, kan die dan uit
     alle andere kiezen"). */
  const [statePicking, setStatePicking] = useState<number | null>(null);
  /* Operator, 21 september 2026 ("why this protocol moet een popup
     worden"). */
  const [whyOpen, setWhyOpen] = useState(false);

  const pickState = (i: number, state: BreathStateKey) => {
    Haptics.selectionAsync();
    setStatePicking(null);
    setItems((cur) => setTemplateItemState(cur, i, state, goals, level));
  };
  const remove = (i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((cur) => removeTemplateItem(cur, i));
  };
  const setMinutes = (i: number, minutes: number) => {
    Haptics.selectionAsync();
    setPicking(null);
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, minutes } : it)));
  };

  const totalMinutes = useMemo(
    () => items.reduce((sum, it) => sum + it.minutes, 0),
    [items],
  );

  /* Operator, 21 september 2026 ("kort en duidelijk uitleggen waarom deze
     keuzes, gepersonaliseerd voor eender welk protocol"): leest dezelfde
     `items`/`goals` die de kaarten hieronder al tonen — nooit een eigen,
     tweede gok. Zie utils/protocol-explainer.ts. */
  const explanation = useMemo(() => explainProtocol(items, goals), [items, goals]);

  /* Operator, 18 september 2026 ("sessies voor zelfde tijdsperiode staan
     apart — Apple groepeert per dagdeel"): was één platte lijst kaarten,
     ook als 2 sessies in dezelfde Morning zaten — twee bijna-identieke
     kaarten onder elkaar. Nu één kaart PER DAGDEEL met de sessies als
     rijen erbinnen, chronologisch (`reminderAt`) gesorteerd — leest als
     een tijdlijn van die dagperiode i.p.v. herhaalde blokken. `SLOTS`
     (services/reminders.ts) geeft de vaste volgorde/labels, dezelfde bron
     als build-your-day.tsx. `i` (index in `items`) blijft bewaard, want
     replace/remove/setPicking werken op die originele index. */
  const groupedSlots = useMemo(() => {
    return SLOTS.map((sl) => ({
      slot: sl.slot,
      label: sl.label,
      rows: items
        .map((it, i) => ({ it, i }))
        .filter((x) => x.it.slot === sl.slot)
        .sort((a, b) => a.it.reminderAt - b.it.reminderAt),
    })).filter((g) => g.rows.length > 0);
  }, [items]);

  /* Operator, 18 september 2026: horizon-keuze (eerst een eigen scherm,
     kort een chip-rij hier) woont uiteindelijk op de addToDay-ringeditor
     (breath-setup.tsx, Pad B) resp. de standaard hieronder (Pad A, kent
     de param niet). Dit scherm leest 'm enkel nog uit — zie `confirm()`. */
  const horizon: PlanHorizon = (horizonParam as PlanHorizon) || '2w';
  const [saving, setSaving] = useState(false);

  /* Press-scale state voor de vaste (niet-gemapte) knoppen van dit scherm.
     Rijen/chips die binnen een `.map()` leven hebben hun eigen componenten
     hierboven (`GroupRow`/`StateChip`) met eigen state. */
  const backScale = useSharedValue(1);
  const onBackPressIn = () => {
    backScale.value = withTiming(0.92, { duration: 80 });
  };
  const onBackPressOut = () => {
    backScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const backStyle = useAnimatedStyle(() => ({ transform: [{ scale: backScale.value }] }));

  const whyTriggerScale = useSharedValue(1);
  const onWhyTriggerPressIn = () => {
    whyTriggerScale.value = withTiming(0.95, { duration: 80 });
  };
  const onWhyTriggerPressOut = () => {
    whyTriggerScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const whyTriggerStyle = useAnimatedStyle(() => ({ transform: [{ scale: whyTriggerScale.value }] }));

  const ctaScale = useSharedValue(1);
  const onCtaPressIn = () => {
    ctaScale.value = withTiming(0.96, { duration: 80 });
    /* Operator ("kijk alle CTA's na"): haptiek stond in confirm() zelf
       (op onPress) i.p.v. hier op onPressIn — huisstijl §5 wil de tik
       op het moment van INdrukken, los van de save-logica. Verwijderd
       daar, toegevoegd hier. */
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const onCtaPressOut = () => {
    ctaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
    opacity: 1 - (1 - ctaScale.value) * 3.75,
  }));

  const pickBackdropScale = useSharedValue(1);
  const onPickBackdropPressIn = () => {
    pickBackdropScale.value = withTiming(0.97, { duration: 80 });
  };
  const onPickBackdropPressOut = () => {
    pickBackdropScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pickBackdropStyle = useAnimatedStyle(() => ({ transform: [{ scale: pickBackdropScale.value }] }));

  const statePickBackdropScale = useSharedValue(1);
  const onStatePickBackdropPressIn = () => {
    statePickBackdropScale.value = withTiming(0.97, { duration: 80 });
  };
  const onStatePickBackdropPressOut = () => {
    statePickBackdropScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const statePickBackdropStyle = useAnimatedStyle(() => ({
    transform: [{ scale: statePickBackdropScale.value }],
  }));

  const whyBackdropScale = useSharedValue(1);
  const onWhyBackdropPressIn = () => {
    whyBackdropScale.value = withTiming(0.97, { duration: 80 });
  };
  const onWhyBackdropPressOut = () => {
    whyBackdropScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const whyBackdropStyle = useAnimatedStyle(() => ({ transform: [{ scale: whyBackdropScale.value }] }));

  const whyDoneScale = useSharedValue(1);
  const onWhyDonePressIn = () => {
    whyDoneScale.value = withTiming(0.95, { duration: 80 });
  };
  const onWhyDonePressOut = () => {
    whyDoneScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const whyDoneStyle = useAnimatedStyle(() => ({ transform: [{ scale: whyDoneScale.value }] }));

  const confirm = async () => {
    if (items.length === 0 || saving) return;
    setSaving(true);
    const plan = buildPlanFromTemplate(goals, intensity, horizon, new Date(), items);
    await saveActivePlan(plan);
    /* Operator, 18 september 2026 ("review and confirm na stap 3 is
       overbodig, dat is al bekend"): ging hiervoor naar `/plan`, dat zich
       tijdens onboarding als "Set timing" presenteerde MET een eigen 2e
       "REVIEW & CONFIRM"-knop (→ plan-summary.tsx → plan-success.tsx) —
       een dubbele bevestiging van wat hier al net bevestigd is.
       `syncPlanReminders` (normaal gewekt door plan.tsx's eigen
       `useEffect`) regelt zelf de notificatie-permissie + plant de
       herinneringen in — die technische stap blijft nodig, enkel niet
       meer als apart, zichtbaar "confirm"-scherm. Rechtstreeks naar
       plan-success.tsx (het al bestaande vinkje-"Your protocol is
       live"-scherm) i.p.v. via plan.tsx/plan-summary.tsx. Buiten
       onboarding (bv. een sessie vanuit Activity vervangen) blijft
       plan.tsx apart bereikbaar als "Your plan"-overzicht — dat pad
       wijzigt hier niet.

       Operator, 19 september 2026 ("crash — zwart scherm meteen bij
       tikken op Continue"): de aanroep stond hier eerst, in dezelfde
       synchrone flow als de `router.push` erna. `syncPlanReminders` vraagt
       via `ensurePermission()` de notificatie-permissie aan — die native
       systeem-dialoog opende dus TEGELIJK met de schermovergang, en die
       twee botsten kennelijk (zwart scherm op Android). Verplaatst naar
       plan-success.tsx se eigen `useEffect`, ná de overgang, zodat de
       permissie-vraag rustig op een al gemount scherm gebeurt — zelfde
       moment als waarop plan.tsx 'm origineel ook pas deed. */
    router.push({
      pathname: '/plan-success' as never,
      params: {
        onboarding: '1',
        ...(fromBreathWelcome ? { fromBreathWelcome } : {}),
      },
    });
    /* Dit scherm blijft ONDER in de stack bestaan (zelfde reden als
       voorheen op plan-duration.tsx: per ongeluk teruggeklikt mag niet
       voor altijd "vastzitten" met een uitgeschakelde knop). */
    setSaving(false);
  };

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
          style={[s.back, backStyle]}
        >
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </AnimatedPressable>
        {/* Operator, 17 september 2026: gedeeld eindpunt van Pad A (5
           stappen) en Pad B (3 stappen) — zie `totalSteps` hierboven.
           Operator, 21 september 2026 ("balk is storend zo laag, zet 'm
           naast de pijl"): terug in de knoppenrij. */}
        <StepIndicator step={totalSteps} total={totalSteps} color="#ffffff" />
        <ProtocolFlowCancel />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          /* Ruimte houden voor de nu vaste, zwevende CTA-laag hieronder —
             anders schuift de laatste kaart er half achter weg. */
          { paddingBottom: Math.max(insets.bottom, 12) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Operator, 18 september 2026 (Apple-redesign, Deference/
           Clarity): links uitgelijnd i.p.v. gecentreerd — zelfde richting
           als build-choice.tsx/build-your-day.tsx. Subheader vervangt de
           herhaling "Your moments, your sessions, your day" door een
           kortere Apple-achtige zin; het aantal/duur staat niet meer in
           een zware capsule maar als subtiele tekstregel eronder. */}
        <Text style={s.header}>Your protocol</Text>
        <Text style={s.lead}>Review your daily breathing rhythm</Text>
        <Text style={s.countLine}>
          {items.length > 0
            ? `${items.length} session${items.length > 1 ? 's' : ''} · ${totalMinutes} minutes total`
            : 'No sessions left — go back and pick at least one'}
        </Text>

        {/* Operator, 21 september 2026 ("kort en duidelijk uitleggen
           waarom deze keuzes, gepersonaliseerd voor eender welk
           protocol... moet een popup worden"): eerst een vaste kaart in de
           lijst, nu een korte tekstlink die een popup opent — dezelfde
           `pickSheet`-bottom-sheet-taal als de duur-kiezer verderop in dit
           bestand, i.p.v. een tweede vast blok boven de sessiekaarten. */}
        {/* Operator, 21 september 2026 ("kan dat transparant blur?"):
           matglazen pil i.p.v. een kale tekstlink — zelfde
           `dimezisBlurViewSdk31Plus`-recept als de rest van de app. */}
        {items.length > 0 && (
          <AnimatedPressable
            style={[s.whyTrigger, whyTriggerStyle]}
            onPress={() => {
              Haptics.selectionAsync();
              setWhyOpen(true);
            }}
            onPressIn={onWhyTriggerPressIn}
            onPressOut={onWhyTriggerPressOut}
            hitSlop={6}
          >
            <BlurView
              intensity={40}
              tint="dark"
              blurMethod="dimezisBlurViewSdk31Plus"
              style={StyleSheet.absoluteFill}
            />
            <Info size={13} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
            <Text style={s.whyTriggerTxt}>Why this protocol</Text>
          </AnimatedPressable>
        )}

        {/* Operator, 18 september 2026 ("sessies voor zelfde tijdsperiode
           staan apart — groepeer per dagdeel"): was één platte lijst met
           een kaart PER SESSIE (ook bij 2 sessies in dezelfde Morning) —
           nu één kaart per dagdeel (`groupedSlots`, zie hierboven), de
           foto maar één keer, sessies als rijen erbinnen. */}
        {groupedSlots.map((g) => (
          <View key={g.slot} style={s.groupSection}>
            <Text style={s.groupLabel}>{g.label.toUpperCase()}</Text>
            <View style={s.groupCard}>
              <Image source={{ uri: DAYPART_PHOTO[g.slot] }} style={s.groupPhoto} />
              <View style={s.groupRows}>
                {g.rows.map(({ it, i }, rowIndex) => (
                  <View key={i}>
                    {rowIndex > 0 && <View style={s.groupDivider} />}
                    {/* Operator, 18 september 2026 ("potlood+vinkje
                       dubbele indicatie is overbodig, potlood mag weg...
                       Replace/Remove-knoppen maken kaart hoog en
                       rommelig"): geen aparte actions-rij met tekst-pillen
                       meer — Replace/Remove zijn nu kleine icoon-only
                       knoppen inline in de rij (voorlopig nog een tik,
                       geen swipe/contextmenu — zie sessie-toelichting).
                       Het vinkje bevestigt al dat de sessie actief is. */}
                    <GroupRow
                      it={it}
                      i={i}
                      onPickTime={setPicking}
                      onPickState={setStatePicking}
                      onRemove={remove}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Operator, 18 september 2026 ("Open your agenda-cta staat te
         laag — met lange, scrollbare kaarten wordt de hoofdknop helemaal
         naar de bodem gedrukt, op kleinere toestellen moet je scrollen om
         'm te zien"): Apple's "sticky/floating button panel" — de CTA
         staat nu BUITEN de ScrollView, als een vaste laag onderaan het
         scherm. De lijst scrolt erachter langs; een gradient (transparant
         → C.bg) zorgt dat tekst die onder de knop doorscrolt zacht
         wegvloeit i.p.v. hard afgesneden te worden tegen een plots vlak. */}
      <View
        style={[s.ctaFloat, { paddingBottom: Math.max(insets.bottom, 12) + 40 }]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={['transparent', C.bg]}
          locations={[0, 0.4]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <AnimatedPressable
          style={[s.cta, (items.length === 0 || saving) && s.ctaDisabled, ctaStyle]}
          disabled={items.length === 0 || saving}
          onPress={confirm}
          onPressIn={onCtaPressIn}
          onPressOut={onCtaPressOut}
        >
          <Text style={s.ctaTxt}>{saving ? 'Building…' : 'Continue'}</Text>
        </AnimatedPressable>
      </View>

      {/* ── Duur-kiezer ── de bestaande duren van die toestand, niets
          verzonnen. Standaard kort (protocol.ts), maar wie meer tijd wil
          mag altijd langer (operator, 13 augustus 2026: "user mag de
          mogelijkheid hebben om langere sessies te doen"). */}
      <Modal
        visible={picking !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicking(null)}
      >
        <AnimatedPressable
          style={[s.pickBackdrop, pickBackdropStyle]}
          onPress={() => setPicking(null)}
          onPressIn={onPickBackdropPressIn}
          onPressOut={onPickBackdropPressOut}
        >
          <Pressable
            style={[s.pickSheet, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}
            onPress={() => {}}
          >
            <View style={s.pickHandle} />
            {picking !== null && (() => {
              const it = items[picking];
              const st = BREATH_STATES[it.state];
              /* Operator, 1 okt 2026 ("edit duration... lijkt mij nog oud
                 systeem"): zelfde discrete chip-grid als agenda.tsx/
                 plan.tsx hadden vóór breath-setup.tsx's wheel-redesign
                 (24 sept 2026) — nu de gedeelde `DurationWheel`
                 (components/DurationWheel.tsx). */
              return (
                <>
                  <View
                    style={[s.pickAccent, { backgroundColor: st.accent }]}
                  />
                  <Text style={s.pickTitle}>{st.eyebrow} duration</Text>
                  <DurationWheel
                    options={st.durations.map((d) => ({ value: d.minutes, label: `${d.minutes} min` }))}
                    value={it.minutes}
                    accent={st.accent}
                    trackColor="rgba(255,255,255,0.4)"
                    recommendedValue={st.defaultDuration}
                    onChange={(v) => setMinutes(picking, v)}
                  />
                </>
              );
            })()}
          </Pressable>
        </AnimatedPressable>
      </Modal>

      {/* ── Staat-kiezer ── operator, 21 september 2026 ("als gebruiker
          niet akkoord is met een state, kan die dan uit alle andere
          kiezen — zelf vervangen?"): alle 5 toestanden, geen
          `DAY_CANDIDATES`-filter — de engine bewaakt de fysiologische
          regels bij het VOORSTEL, maar de gebruiker mag hier altijd
          overrulen (zelfde "nooit hard blokkeren"-principe als elders in
          de flow). */}
      <Modal
        visible={statePicking !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setStatePicking(null)}
      >
        <AnimatedPressable
          style={[s.pickBackdrop, statePickBackdropStyle]}
          onPress={() => setStatePicking(null)}
          onPressIn={onStatePickBackdropPressIn}
          onPressOut={onStatePickBackdropPressOut}
        >
          <Pressable
            style={[s.pickSheet, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}
            onPress={() => {}}
          >
            <View style={s.pickHandle} />
            {statePicking !== null && (() => {
              const it = items[statePicking];
              return (
                <>
                  <Text style={s.pickTitle}>
                    {SLOTS.find((sl) => sl.slot === it.slot)?.label ?? 'Session'} state
                  </Text>
                  <View style={s.pickGrid}>
                    {(Object.keys(BREATH_STATES) as BreathStateKey[]).map((key) => (
                      <StateChip
                        key={key}
                        stateKey={key}
                        active={key === it.state}
                        onPress={() => pickState(statePicking, key)}
                      />
                    ))}
                  </View>
                </>
              );
            })()}
          </Pressable>
        </AnimatedPressable>
      </Modal>

      {/* ── "Why this protocol" ── operator, 21 september 2026: popup i.p.v.
          een vaste kaart, zelfde bottom-sheet-taal als hierboven. */}
      <Modal
        visible={whyOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWhyOpen(false)}
      >
        <AnimatedPressable
          style={[s.pickBackdrop, whyBackdropStyle]}
          onPress={() => setWhyOpen(false)}
          onPressIn={onWhyBackdropPressIn}
          onPressOut={onWhyBackdropPressOut}
        >
          <Pressable
            style={[s.pickSheet, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}
            onPress={() => {}}
          >
            <View style={s.pickHandle} />
            {/* Operator, 21 september 2026: eerst een expliciet kruisje
               naast de titel ("ik krijg 'm niet dicht") — nu weer weg
               ("kruisje moet weg"), de "Got it"-knop onderaan is de enige
               sluitknop, naast tikken op de achtergrond. */}
            <Text style={s.pickTitle}>Why this protocol</Text>
            <Text style={s.whyIntro}>{explanation.intro}</Text>
            <View style={s.whyLines}>
              {explanation.lines.map((l) => (
                <Text key={l.key} style={s.whyLine}>
                  {l.text}
                </Text>
              ))}
            </View>
            <AnimatedPressable
              style={[s.whyDoneBtn, whyDoneStyle]}
              onPress={() => setWhyOpen(false)}
              onPressIn={onWhyDonePressIn}
              onPressOut={onWhyDonePressOut}
            >
              <Text style={s.whyDoneTxt}>Got it</Text>
            </AnimatedPressable>
          </Pressable>
        </AnimatedPressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16 },

  /* Operator, 18 september 2026 (Apple-redesign): links uitgelijnd, en
     `pageSubhead` i.p.v. `pageLead` voor de subheader-rol — zelfde
     font-blueprint-fix als build-choice.tsx/build-your-day.tsx eerder
     kregen ("direct onder een pageHeader" is `pageSubhead`, niet
     `pageLead`, zie constants/theme.ts). */
  header: {
    marginTop: 4,
    ...TypeScale.pageHeader,
    textAlign: 'left',
    color: C.text,
  },
  lead: {
    marginTop: 6,
    ...TypeScale.pageSubhead,
    textAlign: 'left',
    color: 'rgba(255,255,255,0.55)',
  },
  /* Vervangt de vorige zware capsule (`badge`/`badgeTxt`, rand + pil-
     vorm) — subtiele tekstregel, geen omlijning, zoals de operator
     vroeg. */
  countLine: {
    marginTop: 4,
    marginBottom: 20,
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.4)',
  },

  /* Operator, 21 september 2026 ("why this protocol moet een popup
     worden"): korte tekstlink i.p.v. een vaste kaart — opent de sheet
     onderaan dit bestand. Vervolg ("kan dat transparant blur?"): matglazen
     pil — `overflow:'hidden'` + afgeronde randen zodat de BlurView (zie
     JSX) netjes clipt, zelfde recept als elke andere matglas-kaart. */
  whyTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  whyTriggerTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)',
  },
  whyIntro: {
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 16,
    fontFamily: BrandFonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
    color: C.text,
  },
  whyLines: { alignSelf: 'stretch', gap: 8 },
  whyLine: {
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'left',
    color: 'rgba(255,255,255,0.6)',
  },
  whyDoneBtn: {
    alignSelf: 'stretch',
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  whyDoneTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 14.5,
    color: C.text,
  },

  /* Sectie per dagdeel — vervangt de vorige "1 kaart per sessie"-opzet.
     Zelfde `dayCard`-aanpak als build-your-day.tsx: rand/achtergrond/
     afronding zitten op de GEDEELDE buitenste kaart, niet meer los op
     elke sessie-rij. */
  groupSection: { marginBottom: 22 },
  groupLabel: {
    ...TypeScale.sectionLabel,
    marginBottom: 8,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  /* Geen expliciete `height` — met `alignItems:'stretch'` op `groupCard`
     rekt deze foto zich automatisch uit tot de hoogte van `groupRows`
     ernaast (RN flexbox: een rij-kind zonder eigen hoogte volgt de
     cross-axis van zijn rij-ouder). Eén foto voor de hele sectie i.p.v.
     herhaald per sessie. */
  groupPhoto: { width: 64 },
  groupRows: { flex: 1 },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 12,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  /* Operator, 18 september 2026 ("kermis-effect vermijden — kleur enkel
     op het icoontje + 3% gloed"): kleine cirkel met het state-icoon
     (`StateGlyph`, dezelfde flinterdunne lijnstijl als de Breath-tab) in
     de state-kleur, op een zeer subtiele achtergrondgloed in diezelfde
     tint — de enige kleur op deze rij. */
  groupIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupRowText: { flex: 1 },
  groupTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  groupTime: {
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  /* Operator, 18 september 2026 ("staatnaam groot en wit"): geen
     state-kleur meer op de tekst zelf — enkel het icoon ernaast draagt
     die nog, zie toelichting bij `groupIconWrap`. */
  groupStateName: {
    marginTop: 2,
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    letterSpacing: 0.2,
    color: C.text,
  },
  groupActionBtn: { padding: 4 },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Operator, 11 september 2026 (7e ronde): "CTA altijd dezelfde CONTINUE"
     — uit `CTA` i.p.v. een eigen volle-pil-vorm met ALL-CAPS label. */
  /* Operator, 18 september 2026 ("sticky/floating button panel"): vaste
     laag onderaan, los van de ScrollView — zie toelichting bij de
     call-site. `paddingTop` geeft de gradient-vervaging hierboven genoeg
     hoogte om zacht te laten wegvloeien i.p.v. een harde rand. */
  ctaFloat: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 26,
  },
  cta: { ...CTA.container },
  ctaDisabled: CTA.disabled,
  ctaTxt: CTA.label,

  pickBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  pickSheet: {
    backgroundColor: C.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 18,
    paddingTop: 10,
    alignItems: 'center',
  },
  pickHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 14,
  },
  pickAccent: { width: 30, height: 3, borderRadius: 2, marginBottom: 8 },
  pickTitle: {
    alignSelf: 'flex-start',
    marginBottom: 14,
    fontFamily: BrandFonts.bold,
    fontSize: 17,
    color: C.text,
  },
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    paddingBottom: 6,
  },
  pickChip: {
    flexGrow: 1,
    minWidth: 70,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  pickChipTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.7)',
  },
  /* Operator, 21 september 2026 (staat-kiezer): zelfde grid als de
     duur-kiezer hierboven, maar met een icoontje boven het label — 5
     chips i.p.v. 2-4 duren, dus iets smaller/vierkanter. */
  pickStateChip: {
    flexGrow: 1,
    minWidth: 80,
    paddingVertical: 14,
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
});
