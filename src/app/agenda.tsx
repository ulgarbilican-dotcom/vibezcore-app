/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Your agenda

   Zesde en laatste stap van de protocol-flow (operator, 13 augustus 2026):
   het ECHTE, vastgelegde rooster uit plan-store.ts, met voltooiing per dag.

   Voltooiing wordt NIET apart opgeslagen — afgeleid door PlanDay.items te
   vergelijken met BreathHistoryEntry[] van diezelfde dag (matchen op
   state + dagsleutel). Groen = alles gedaan, oranje = deels, rood = dag
   voorbij en niets gedaan, neutraal = nog te komen. Zelfde kleur-per-
   toestand-logica als (tabs)/activity.tsx — geen nieuwe kleuren verzonnen.
   ───────────────────────────────────────────────────────────────────────── */

import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import { claimFreeSessionParam } from '@/utils/breath-entry';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { calculateStreak, useBreathHistory, useBreathTotals } from '@/utils/breath-history';
import { dayKey } from '@/utils/bracelet-history';
import { saveActivePlan, useActivePlan, type PlanDay } from '@/utils/plan-store';
import { syncPlanReminders } from '@/services/reminders';
import { milestonesReached } from '@/utils/rewards';
import RhythmRing from '@/components/RhythmRing';
import { DurationWheel } from '@/components/DurationWheel';
import { GlassSheet } from '@/components/GlassSheetHost';
import { rootBlurRef } from '@/utils/root-blur';
import { getFirstWeekday, leadingBlanks, weekdayLabels } from '@/utils/locale';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { openBreathSession } from '@/services/breath-session-host';
import { ChevronDown, ChevronLeft, ChevronRight, Flame, Layers, Lock, Pencil, Trophy } from 'lucide-react-native';
import VibezGlass from '@/components/VibezGlass';
import { STATE_GLYPH_ICONS, type GlyphIcon } from '@/components/ModeGlyph';
import { useProtocolLocked, PROTOCOL_LOCKED_SUB } from '@/utils/protocol-gate';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
/* Operator, 19 september 2026 ("apple stijl animaties... pagina te plat
   en dood"): eenmalige, gestaffelde intro-animatie bij het openen van
   het scherm — geen `withRepeat`/oneindige animatie (dat patroon gaf
   eerder de zwart-scherm-crash op plan-success.tsx toen het gelijktijdig
   met een native dialoog + scherm-overgang liep, zie de toelichting
   daar). Hier is er geen dialoog of overgang op hetzelfde moment, enkel
   een gewone mount — veilig. */
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/* Standaard press-scale animatie op elke tikbare knop/rij/kaart in dit
   scherm (operator-patroon, zie StartCard in breath-welcome.tsx). */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Operator, 19 september 2026 ("dit als achtergrond") → 20 september
   ("er staat nu een landschap als achtergrond dat moet weg"): de volle-
   scherm achtergrondfoto (`AGENDA_BG_IMG`) + donkere overlay zijn
   teruggedraaid — gewone effen `Brand.bg` (`s.root`), zelfde zwart als
   de rest van de flow. */

type DayStatus = 'green' | 'orange' | 'red' | 'future' | 'none';

/* Operator, 1 okt 2026 ("EU vs US kalender-formaat"): vaste zondag-eerst
   volgorde vervangen door de echte eerste weekdag van het toestel — zie
   utils/locale.ts. `FIRST_WEEKDAY` wordt één keer per module-load gelezen
   (regio verandert niet tijdens een sessie). */
const FIRST_WEEKDAY = getFirstWeekday();
const WEEKDAY = weekdayLabels(FIRST_WEEKDAY);

const HORIZON_LABEL: Record<string, string> = {
  today: 'Today',
  '1w': '1 week',
  '2w': '2 weeks',
  '1m': '1 month',
  '3m': '3 months',
  ongoing: 'Ongoing',
};

const fmtAgendaTime = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

/* Operator, 19 september 2026 ("Sharp Focus... geen hoofdletters"):
   `BREATH_STATES[...].eyebrow` staat in de brondata in HOOFDLETTERS
   ("SHARP FOCUS", zie data/breath-states.ts) — dat is prima voor de
   kleine, gespatieerde eyebrow-badges elders in de app, maar leest hier
   als geschreeuw op de Rhythm Ring en de lijst eronder. "&" blijft
   ongemoeid (geen woordteken, `\b\w` raakt 'm niet). */
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/* Operator, 1 okt 2026 ("your daily plan principe van bracelet vind ik
   goed, kunnen we dat toepassen met die kaarten onderaan voor breathwork
   agenda"): zelfde kleine-vierkante-kaarten-legende als bracelet-
   agenda.tsx's `StateCard` — kleurbolletje groter linksboven, naam links
   onder, alle 6 (5 states + "Show all") exact even groot. Hier file-
   lokaal herhaald i.p.v. gedeeld. Kiest WELKE uur+duur-
   labels op de ring verschijnen — de bolletjes zelf staan er al altijd,
   ongeacht selectie. Vervangt de vorige "Today"-lijst van platte
   tekstregels volledig (operator: "die kaarten vervangen eigenlijk het
   today blok") — een tik op een ring-stip opent nu het actie-schermpje
   verderop i.p.v. direct te starten, zelfde patroon als bracelet-
   agenda.tsx. */
const STATE_ORDER: BreathStateKey[] = ['boost', 'focus', 'calm', 'clarity', 'rest'];

/* Operator, 1 okt 2026 ("alles beetje naar boven zodat er niet gescrolld
   dient te worden"): 280→240, gelijk aan bracelet-agenda.tsx's ring —
   samen met de krappere marges hieronder past "Your breathwork plan" nu
   zonder scrollen op een gewoon scherm.
   Operator, 2-3 okt 2026: de eigen ring-geometrie-herhaling (RING_CX/CY/
   DOT_RADIUS/angleForMinutes/pointAt) die hier stond voor de losse
   `RingLabel`-laag is weg samen met die laag zelf — RhythmRing.tsx
   berekent nu alles intern (`centerItems`/`selectedKeys`), agenda.tsx
   hoeft de ring-wiskunde niet meer te dupliceren. */
const RING_SIZE = 240;

function StateCard({
  label,
  color,
  Icon,
  on,
  onPress,
}: {
  label: string;
  color?: string;
  /** Teken van de toestand i.p.v. het bolletje (5 okt 2026). */
  Icon?: GlyphIcon;
  on: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 1 - (1 - scale.value) * 5,
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120 });
      }}
      style={s.cardSlot}
    >
      <Animated.View style={[s.card, on && s.cardOn, pressStyle]}>
        {/* Operator, 5 okt 2026: de "i"-hint in de hoek is weg — geen
           meerwaarde. */}
        <View style={s.cardTopRow}>
          {Icon && color ? (
            /* Zelfde glazen badge als "Set your plan" (operator, 5 okt 2026). */
            <View style={s.cardBadge}>
              <VibezGlass radius={16} tint={color} level="raised" style={StyleSheet.absoluteFill} />
              <Icon size={17} color="#ffffff" strokeWidth={1.9} />
            </View>
          ) : color ? (
            <View style={[s.cardDot, { backgroundColor: color }]} />
          ) : (
            <Layers size={15} color="rgba(255,255,255,0.6)" strokeWidth={2.4} />
          )}
        </View>
        <Text style={[s.cardTxt, on && s.cardTxtOn]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** `null` = geen stip, punt. Operator, 13 augustus 2026: "moeten de dagen
 *  dat er activiteiten zijn niet groen of aangeduid zijn zoals bij een
 *  agenda op de telefoon?" — 'future' en 'none' droegen voorheen dezelfde
 *  dofgrijze stip, dus een maand vol protocol zag er niet anders uit dan
 *  een lege maand. Nu: een geplande dag draagt altijd een stip (merkblauw
 *  zolang hij nog moet komen, dan groen/oranje/rood na afloop), en een dag
 *  buiten het protocol draagt HELEMAAL GEEN stip. */
function statusColor(status: DayStatus): string | null {
  switch (status) {
    case 'green':
      return '#4ade80';
    case 'orange':
      return '#F5A524';
    case 'red':
      return '#ef4444';
    case 'future':
      /* Operator, 20 september 2026 ("het blauw moet indigo zijn"):
         `Brand.accent` (Signal Blue) is voortaan enkel voor haptic-pulse/
         "nu actief" — dit is een gewone dag-statusstip, algemene UI. */
      return AudioAccent;
    default:
      return null;
  }
}

/* Eén dag-cirkel in de uitklapbare maand-kalender. Eigen component omdat
   hij binnen `monthCells.map(...)` gerenderd wordt — hooks mogen niet in
   een inline .map()-callback staan. */
function MonthCell({
  date,
  isSelected,
  status,
  onPress,
}: {
  date: Date;
  isSelected: boolean;
  status: DayStatus;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));

  return (
    <AnimatedPressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[s.monthCell, pressStyle]}>
      <View style={[s.monthCircle, isSelected && s.monthCircleSel]}>
        <Text style={[s.monthNum, isSelected && { color: '#ffffff' }]}>{date.getDate()}</Text>
      </View>
      <View style={[s.monthDot, { backgroundColor: statusColor(status) ?? 'transparent' }]} />
    </AnimatedPressable>
  );
}

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const { onboarding, fromBreathWelcome } = useLocalSearchParams<{
    onboarding?: string;
    fromBreathWelcome?: string;
  }>();
  const { plan, loaded } = useActivePlan();
  const history = useBreathHistory();
  const totals = useBreathTotals();
  /* Operator, 17 september 2026: zelfde vooraf-signaal als op Activity/
     Breath — zie utils/protocol-gate.ts. Relevant op DIT scherm specifiek
     in de lege staat hieronder (geen plan meer, bv. na een verlopen
     protocol) — wie al gebouwd heeft ziet hier meteen waarom "BUILD MY
     PROTOCOL" nu premium vraagt, i.p.v. het pas te ontdekken na 3 stappen. */
  const protocolLocked = useProtocolLocked();

  /* Operator, 19 september 2026 ("apple stijl animaties... pagina te
     plat en dood"): eenmalige, gestaffelde intro bij het openen van het
     scherm — datumregel eerst, dan de ring (met een kleine veer-schaal),
     dan de "Today"-lijst, dan de knoppen onderaan. Bovenaan de component
     gezet, VOOR de vroege returns hieronder (lege staat/laad-staat) —
     hooks moeten altijd in dezelfde volgorde aangeroepen worden, ook al
     gebruiken die vroege returns de resulterende stijlen niet. Geen
     `withRepeat`/oneindige animatie hier (dat patroon veroorzaakte de
     eerdere zwart-scherm-crash op plan-success.tsx toen het gelijktijdig
     met een native dialoog + scherm-overgang liep) — dit is een gewone
     mount zonder dialoog erbij, dus veilig. */
  const heroOpacity = useSharedValue(0);
  const heroY = useSharedValue(14);
  const ringOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.92);
  const listOpacity = useSharedValue(0);
  const listY = useSharedValue(14);
  const actionsOpacity = useSharedValue(0);

  useEffect(() => {
    heroOpacity.value = withTiming(1, { duration: 380 });
    heroY.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) });
    ringOpacity.value = withDelay(120, withTiming(1, { duration: 420 }));
    ringScale.value = withDelay(120, withSpring(1, { damping: 15, stiffness: 120 }));
    listOpacity.value = withDelay(260, withTiming(1, { duration: 380 }));
    listY.value = withDelay(260, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
    actionsOpacity.value = withDelay(420, withTiming(1, { duration: 320 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateY: heroY.value }],
  }));
  const ringAnimStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const listStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
    transform: [{ translateY: listY.value }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({ opacity: actionsOpacity.value }));

  /* Press-scale voor elke losstaande (niet-lijst) tikbare knop op dit
     scherm — zelfde patroon als StartCard in breath-welcome.tsx, elk zijn
     eigen gedeelde waarde. */
  const backScale = useSharedValue(1);
  const onBackPressIn = () => {
    backScale.value = withTiming(0.92, { duration: 80 });
  };
  const onBackPressOut = () => {
    backScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const backStyle = useAnimatedStyle(() => ({ transform: [{ scale: backScale.value }] }));

  const ctaScale = useSharedValue(1);
  const onCtaPressIn = () => {
    ctaScale.value = withTiming(0.96, { duration: 80 });
  };
  const onCtaPressOut = () => {
    ctaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  const dateRowScale = useSharedValue(1);
  const onDateRowPressIn = () => {
    dateRowScale.value = withTiming(0.95, { duration: 80 });
  };
  const onDateRowPressOut = () => {
    dateRowScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const dateRowPressStyle = useAnimatedStyle(() => ({ transform: [{ scale: dateRowScale.value }] }));

  const monthPrevScale = useSharedValue(1);
  const onMonthPrevPressIn = () => {
    monthPrevScale.value = withTiming(0.92, { duration: 80 });
  };
  const onMonthPrevPressOut = () => {
    monthPrevScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const monthPrevStyle = useAnimatedStyle(() => ({ transform: [{ scale: monthPrevScale.value }] }));

  const monthNextScale = useSharedValue(1);
  const onMonthNextPressIn = () => {
    monthNextScale.value = withTiming(0.92, { duration: 80 });
  };
  const onMonthNextPressOut = () => {
    monthNextScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const monthNextStyle = useAnimatedStyle(() => ({ transform: [{ scale: monthNextScale.value }] }));

  const editBtnScale = useSharedValue(1);
  const onEditBtnPressIn = () => {
    editBtnScale.value = withTiming(0.95, { duration: 80 });
  };
  const onEditBtnPressOut = () => {
    editBtnScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const editBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: editBtnScale.value }] }));

  const changeProtocolScale = useSharedValue(1);
  const onChangeProtocolPressIn = () => {
    changeProtocolScale.value = withTiming(0.95, { duration: 80 });
  };
  const onChangeProtocolPressOut = () => {
    changeProtocolScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const changeProtocolStyle = useAnimatedStyle(() => ({ transform: [{ scale: changeProtocolScale.value }] }));

  /* Operator, 19 september 2026 (Apple "Sleep Schedule Ring"-redesign):
     Day/Week/Month-tabs + aparte datum-navigatie zijn vervangen door één
     regel ("September 19 ▾") die een compacte kalender laat uitklappen —
     de bestaande maand-grid-rendering hieronder (`monthCells`) hergebruikt
     als inhoud van die kalender, i.p.v. een eigen Week/Dag-weergave. */
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Date());
  /* Operator, 1 okt 2026 ("kaarten-principe van bracelet toepassen"):
     welke state (of 'all') momenteel zijn uur+duur-labels rond de ring
     toont — zie StateCard/RingLabel hierboven. */
  /* Operator, 2-3 okt 2026 ("show all vervangen door your next session"):
     `'all'` bestaat niet meer — de nulle staat (null) IS nu "Your next
     session" (de standaard "Next"-weergave in het midden van de ring,
     geen staat geselecteerd). */
  const [filterMode, setFilterMode] = useState<BreathStateKey | null>(null);
  /* Operator, 1 okt 2026 ("bij aanklikken van sessie op de cirkel eerst
     popup met vraag om naar deze sessie te gaan, hoe zou apple dat
     doen"): tikken op een stip opende tot nu toe DIRECT /breath-session —
     nu eerst een actie-schermpje, zelfde `pickBackdrop`/`pickSheet`-
     patroon als de duur-kiezer hieronder en identiek aan bracelet-
     agenda.tsx's popup. Index in `selectedDay.items` waarvan het
     actie-schermpje open staat. */
  const [actionItemIndex, setActionItemIndex] = useState<number | null>(null);

  const streak = useMemo(() => calculateStreak(history), [history]);
  const milestones = useMemo(
    () => milestonesReached(streak, totals),
    [streak, totals],
  );

  /* Welke toestanden op welke dag echt gedaan zijn — matcht Plan tegen
     Geschiedenis. Operator, 21 september 2026 ("clarity en boost niet
     volledig uitgedaan, staat er dan Done of iets anders?"): stond enkel
     een Set (aanwezig/afwezig), dus een 10-seconden-afgebroken sessie
     (die WEL in de historiek belandt, zie `addBreathSession`'s eigen
     toelichting — "een afgebroken sessie telt mee, anders is dat cijfer
     een beloning voor doorzetten i.p.v. een verslag van wat er gebeurd
     is") kleurde hier exact hetzelfde groene "Done" als een volledig
     afgeronde sessie. De TOTALEN/streak mogen dat inderdaad blijven
     belonen (bewuste, eerdere beslissing) — maar het per-sessie label in
     de agenda hoort eerlijk te zijn over wat er ECHT gebeurde. Nu een Map
     naar boolean (`ooit volledig afgerond?`) i.p.v. een kale Set. */
  const historyByDay = useMemo(() => {
    const map = new Map<string, Map<string, boolean>>();
    /* Alleen sessies NA het aanmaken van dit protocol tellen mee (operator,
       13 augustus 2026: "ik heb net protocol veranderd... dat kan nooit
       done zijn"). Zonder deze grens claimde een vers, nog niet uitgevoerd
       protocol krediet voor een sessie die je toevallig eerder vandaag —
       onder een ANDER, inmiddels vervangen protocol — al had gedaan. */
    const since = plan?.createdAt ?? 0;
    for (const e of history) {
      if (e.ts < since) continue;
      const k = dayKey(new Date(e.ts));
      if (!map.has(k)) map.set(k, new Map());
      const day = map.get(k)!;
      /* `completed` is optional — oudere entries zonder het veld tellen
         als volledig afgerond (zie het `?? true`-commentaar bij het
         type). Eén keer volledig afgerond die dag is genoeg, ook als een
         ANDERE sessie van dezelfde toestand die dag wel afgebroken was. */
      const wasCompleted = e.completed ?? true;
      day.set(e.key, (day.get(e.key) ?? false) || wasCompleted);
    }
    return map;
  }, [history, plan?.createdAt]);

  const todayKey = dayKey(new Date());

  const statusFor = (dk: string): DayStatus => {
    const day = plan?.days[dk];
    if (!day || day.items.length === 0) return 'none';
    if (dk > todayKey) return 'future';
    const done = historyByDay.get(dk) ?? new Map<string, boolean>();
    const matched = day.items.filter((it) => done.has(it.state)).length;
    if (matched === 0) return dk === todayKey ? 'future' : 'red';
    if (matched === day.items.length) return 'green';
    return 'orange';
  };

  const selectedKey = dayKey(selected);
  const selectedDay: PlanDay | null = plan?.days[selectedKey] ?? null;
  const selectedDone = historyByDay.get(selectedKey) ?? new Map<string, boolean>();

  /* Index in `selectedDay.items` waarvan de duur-kiezer openstaat. */
  const [durationPicking, setDurationPicking] = useState<number | null>(null);

  /* Operator, 30 september 2026 ("de agenda planning van breathwork en
     bracelet moet compleet apart"): de bracelet-sectie die hier stond
     (met een eigen kalender-gedeelde weergave) is verhuisd naar een
     volledig eigen scherm, `/bracelet-agenda` — geen gedeelde kalender/
     `selectedKey` meer met breathwork. Zie dat bestand voor de
     bracelet-kant van dit verhaal. */

  /* Zelfde regel als plan.tsx: de duur geldt voor het HELE protocol (elke
     dag herhaalt dezelfde template), dus de wijziging raakt dezelfde
     POSITIE in elke dag, niet alleen de geselecteerde. Sync meteen de
     meldingen.
     Operator, 17 september 2026 ("Bouw je dag" — meerdere sessies per
     dagdeel toegestaan): matchte voorheen op `slot`, wat twee items in
     hetzelfde dagdeel allebei zou raken i.p.v. enkel het aangetikte. Elke
     dag is via `template.map(...)` opgebouwd (protocol.ts), dus de
     array-POSITIE is stabiel over alle dagen — dezelfde garantie als
     `slot` bood, maar ondubbelzinnig ook met meerdere items per dagdeel. */
  const setMinutesForIndex = async (index: number, minutes: number) => {
    if (!plan) return;
    setDurationPicking(null);
    const days = Object.fromEntries(
      Object.entries(plan.days).map(([dk, day]) => [
        dk,
        {
          ...day,
          items: day.items.map((it, i) => (i === index ? { ...it, minutes } : it)),
        },
      ]),
    );
    const updated = { ...plan, days };
    await saveActivePlan(updated);
    void syncPlanReminders(updated);
  };

  /* Operator, 19 september 2026 ("boogje ronddraaien om de tijd te
     wijzigen"): zelfde aanpak/garantie als `setMinutesForIndex` hierboven
     (elke dag herhaalt dezelfde template, dus de wijziging raakt dezelfde
     ARRAY-POSITIE op elke dag) — enkel voor `reminderAt` i.p.v.
     `minutes`. Aangeroepen vanuit `RhythmRing`'s `onDragEnd`. */
  const setTimeForIndex = async (index: number, reminderAt: number) => {
    if (!plan) return;
    const days = Object.fromEntries(
      Object.entries(plan.days).map(([dk, day]) => [
        dk,
        {
          ...day,
          items: day.items.map((it, i) => (i === index ? { ...it, reminderAt } : it)),
        },
      ]),
    );
    const updated = { ...plan, days };
    await saveActivePlan(updated);
    void syncPlanReminders(updated);
  };

  const monthCells = useMemo(() => {
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const lead = leadingBlanks(first, FIRST_WEEKDAY);
    const daysInMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push(new Date(selected.getFullYear(), selected.getMonth(), d));
    }
    return cells;
  }, [selected]);

  /* ÉÉN herkenbare uitgang i.p.v. twee (operator, 13 augustus 2026: "ik ken
     dat knopje niet, weten gebruikers dat dit dient om direct uit de pagina
     te gaan?" — een los windje-icoon naast de gewone pijl is een tweede,
     onduidelijke uitgang). De gewone terug-pijl gaat rechtstreeks naar
     Activity, met `navigate` i.p.v. `back()` — Agenda is vaak het eindpunt
     van een lange keten (Goal → Intensity → Review → Duration → Set
     timing → Summary → Success), en herhaald terugklikken liep daar stap
     voor stap doorheen i.p.v. in 1 tik naar een bekend scherm.

     Operator, 7 september 2026, twee rondes:
     1) "als user de hele agenda flow doorloopt moet hij toch altijd terug
        naar die step 7 kunnen gaan, wat heeft dat anders zin die
        onboarding" — die Activity-snelkoppeling was er nog niet toen
        Agenda ook via de onboarding-brug bereikbaar werd.
     2) "user moet 5x op de terugpijl klikken... kan dat telkens met 1
        klik?" — eerst opgelost met gewone `router.back()` (wandelt terug
        door de keten), maar dat was nog steeds stap-voor-stap. Nu:
        `fromBreathWelcome` springt in ÉÉN tik naar de bestaande
        stap-7-instantie, net als op elk ander scherm in deze keten. */
  /* Operator, 11 september 2026: "ik kom terug in agenda en dan de
     terugpijl terug naar start your first session pagina bij onboarding"
     — een echte navigatie-lus. `fromBreathWelcome` is een URL-param die
     ELK scherm in de keten braaf doorgeeft, ook nog lang NADAT het
     protocol al bevestigd en opgebouwd is (`plan` bestaat dan al). Zodra
     er een echt actief plan is, is onboarding klaar — terug hoort dan
     NOOIT meer naar de onboarding-stap te springen, wat `fromBreathWelcome`
     ook nog zegt. */
  /* Operator, 20 september 2026 ("naar welke pagina mag user vanuit agenda
     navigeren? nu gaat back terug naar Your protocol, lijkt me niet
     correct"): exact hetzelfde lek als hierboven bij `fromBreathWelcome`,
     nu bij `onboarding` — die param bleef ook NA het bouwen van het
     protocol nog meegesleept, dus `router.back()` popte terug naar
     plan-review.tsx ("Your protocol"), een eenmalige bevestigingsstap die
     je net al hebt afgerond, niet iets om heen-en-weer naartoe te
     navigeren. Zelfde principe als hierboven, nu consequent toegepast:
     bestaat er al een `plan`, dan is onboarding sowieso voorbij — de
     `onboarding`-tak (die WEL zinvol is tijdens de allereerste, nog-geen-
     protocol onboarding) komt dus na de `plan`-check, niet ervoor. */
  const goHome = () =>
    fromBreathWelcome && !plan
      ? router.navigate({
          pathname: '/breath-welcome',
          /* Operator, 22 september 2026: breath-welcome.tsx's slotscherm
             schoof van index 6 naar 4 (bracelet- en Audio Library-stap
             uit de onboarding). */
          params: { resumeStep: '4' },
        } as never)
      : plan
        ? router.dismissTo('/activity' as never)
        : onboarding
          ? router.canGoBack()
            ? router.back()
            : router.replace('/breath' as never)
          : router.dismissTo('/activity' as never);

  if (!loaded) {
    return <SafeAreaView style={s.root} edges={['top']} />;
  }

  if (!plan) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.bar}>
          <AnimatedPressable
            onPress={goHome}
            hitSlop={12}
            style={[s.back, backStyle]}
            onPressIn={onBackPressIn}
            onPressOut={onBackPressOut}
          >
            {/* Operator, 1 okt 2026 ("headers overal consistent"): size
               22→20, stroke 2.2→2.8 — de "officiële iOS-chevron.backward"-
               stijl uit build-choice.tsx (18 sept), nu de app-brede
               standaard. */}
            <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
          </AnimatedPressable>
          <Text style={s.title}>Your breathwork plan</Text>
          <View style={s.back} />
        </View>
        <View style={s.emptyWrap}>
          {/* Operator, 17 september 2026: wie zijn gratis proefronde al
             verbruikt heeft (`protocolLocked`) ziet dat HIER, met dezelfde
             "je doel verschuift"-taal als de teaser-popup verderop — niet
             pas na 3 stappen ontdekken dat "BUILD MY PROTOCOL" nu premium
             vraagt. De knop blijft naar /goal gaan (nog niet hard
             geblokkeerd); dit is enkel het vooraf-signaal. */}
          <Text style={s.emptyT}>
            {protocolLocked ? 'Ready for your next protocol?' : 'No protocol yet'}
          </Text>
          <Text style={s.emptyB}>
            {protocolLocked
              ? `${PROTOCOL_LOCKED_SUB}. Premium unlocks a new one anytime.`
              : 'Choose a goal and an intensity to build a daily protocol you can track here.'}
          </Text>
          <AnimatedPressable
            style={[s.cta, ctaStyle]}
            onPress={() => router.push('/build-choice' as never)}
            onPressIn={onCtaPressIn}
            onPressOut={onCtaPressOut}
          >
            {protocolLocked && (
              <Lock size={14} color="#0a0a0a" strokeWidth={2.4} />
            )}
            <Text style={s.ctaTxt}>
              {protocolLocked ? 'BUILD ANOTHER PROTOCOL' : 'BUILD MY PROTOCOL'}
            </Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.bar}>
        <AnimatedPressable
          onPress={goHome}
          hitSlop={12}
          style={[s.back, backStyle]}
          onPressIn={onBackPressIn}
          onPressOut={onBackPressOut}
        >
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </AnimatedPressable>
        <Text style={s.title}>Your breathwork plan</Text>
        <View style={s.back} />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: Math.max(insets.bottom, 12) + 10 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Operator, 19 september 2026 ("bovenste kaart 'your current
           plan' moet weg, dat is nu dubbel" → vervolg: "alle rommel boven
           de ring weg, staat toch niet op de mockup"): de plan-kaart en
           de streak/mijlpaal-badges zijn weg — de mockup toont boven de
           ring enkel de datumregel. "Change protocol" is verplaatst naar
           onderaan, naast "Edit times" (zie daar) i.p.v. hier verwijderd
           — het is geen visuele rommel maar de enige plek om het protocol
           te wijzigen, dus die actie blijft bestaan, alleen niet meer
           bovenaan. */}

        {/* Operator, 19 september 2026 (Apple "Sleep Schedule Ring"-
           redesign, "de datumkiezer wordt nóg cleaner... inline
           calendar-menu"): was een Day/Week/Month-tabbalk + eigen
           datum-navigatie per modus — vervangen door één regel die een
           compacte kalender laat uitklappen. Hergebruikt de bestaande
           maand-grid hieronder i.p.v. een aparte Week/Dag-weergave. */}
        <Animated.View style={heroStyle}>
        <AnimatedPressable
          onPress={() => setCalendarOpen((o) => !o)}
          style={[s.dateRow, dateRowPressStyle]}
          hitSlop={8}
          onPressIn={onDateRowPressIn}
          onPressOut={onDateRowPressOut}
        >
          <Text style={s.dateRowTxt}>
            {selected.toLocaleDateString([], { month: 'long', day: 'numeric' })}
          </Text>
          <ChevronDown
            size={16}
            color="rgba(255,255,255,0.7)"
            strokeWidth={2.6}
            style={calendarOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
        </AnimatedPressable>
        </Animated.View>

        {calendarOpen && (
          <View style={s.calendarDropdown}>
            {/* Operator, 3 okt 2026 ("bij agenda dropdown moet ook done
               rechtsboven komen, past dat gaat dat dicht als iemand
               daarop klikt"): expliciete sluit-knop — een dag kiezen
               sluit de kalender al (`setCalendarOpen(false)` hierboven
               bij `MonthCell.onPress`), maar wie enkel wil sluiten zonder
               een andere dag te kiezen had daarvoor geen directe knop,
               enkel nogmaals op de datumrij zelf tikken. */}
            <View style={s.calendarDoneRow}>
              <Pressable onPress={() => setCalendarOpen(false)} hitSlop={10}>
                <Text style={s.calendarDoneTxt}>Done</Text>
              </Pressable>
            </View>
            <View style={s.monthNav}>
              <AnimatedPressable
                onPress={() => {
                  const d = new Date(selected);
                  d.setMonth(d.getMonth() - 1);
                  setSelected(d);
                }}
                hitSlop={10}
                style={monthPrevStyle}
                onPressIn={onMonthPrevPressIn}
                onPressOut={onMonthPrevPressOut}
              >
                <ChevronLeft size={18} color="rgba(255,255,255,0.6)" strokeWidth={2.2} />
              </AnimatedPressable>
              <Text style={s.dayNavTxt}>
                {selected.toLocaleDateString([], { month: 'long', year: 'numeric' })}
              </Text>
              <AnimatedPressable
                onPress={() => {
                  const d = new Date(selected);
                  d.setMonth(d.getMonth() + 1);
                  setSelected(d);
                }}
                hitSlop={10}
                style={monthNextStyle}
                onPressIn={onMonthNextPressIn}
                onPressOut={onMonthNextPressOut}
              >
                <ChevronRight size={18} color="rgba(255,255,255,0.6)" strokeWidth={2.2} />
              </AnimatedPressable>
            </View>
            <View style={s.monthGrid}>
              {WEEKDAY.map((w, i) => (
                <Text key={`h-${i}`} style={s.monthHeadTxt}>{w}</Text>
              ))}
              {monthCells.map((d, i) => {
                if (!d) return <View key={i} style={s.monthCell} />;
                const dk = dayKey(d);
                const status = statusFor(dk);
                const isSel = dk === selectedKey;
                return (
                  <MonthCell
                    key={i}
                    date={d}
                    isSelected={isSel}
                    status={status}
                    onPress={() => {
                      setSelected(d);
                      setCalendarOpen(false);
                    }}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* ── De Rhythm Ring — de 24 uur van de dag als één cirkel i.p.v.
           een lijst kaarten, zie components/RhythmRing.tsx voor de
           toelichting (wiskunde, sleep-interactie, beperkingen). */}
        <Animated.View style={[s.ringWrap, ringAnimStyle]}>
          {(() => {
            /* Operator, 2-3 okt 2026 ("i op de kaarten, info rond de ring
               ademt niet, tik op kaart toont info in het midden, bij
               meerdere sessies van dezelfde staat alle tijden tonen —
               wat is betere UX?"): de losse `RingLabel`-tekst per bolletje
               (hieronder tot voor kort) botste onvermijdelijk bij
               sessies die dicht bij elkaar op de klok staan (bv. Boost
               vroeg op de dag) — geen stijl-fix lost dat op, het zit in
               het idee zelf. In de plaats: tik een staat-kaart aan →
               ALLE bolletjes van die staat pulsen samen (`selectedKeys`)
               én hun tijden verschijnen gebundeld in het midden
               (`centerItems`) — geen collision meer mogelijk, en bij
               meerdere sessies van dezelfde staat staat dat nu gewoon
               netjes onder elkaar i.p.v. onleesbaar overlappend op de
               ring-rand. */
            const ringItems = (selectedDay?.items ?? []).map((it, i) => ({
              key: String(i),
              reminderAt: it.reminderAt,
              minutes: it.minutes,
              color: BREATH_STATES[it.state].accent,
              label: titleCase(BREATH_STATES[it.state].eyebrow),
            }));
            const filteredItems =
              filterMode !== null
                ? ringItems.filter((_, i) => (selectedDay?.items ?? [])[i]?.state === filterMode)
                : null;
            return (
              <RhythmRing
                size={RING_SIZE}
                items={ringItems}
                isToday={selectedKey === todayKey}
                now={new Date()}
                onTapItem={(key) => {
                  Haptics.selectionAsync();
                  setActionItemIndex(Number(key));
                }}
                onDragEnd={(key, newReminderAt) => {
                  void setTimeForIndex(Number(key), newReminderAt);
                }}
                /* Operator, 1 okt 2026: de ingebouwde, altijd-aan
                   tijd-labels (`itemLabelMode`'s default 'time') zijn
                   uit — de kaarten hieronder sturen nu welke info waar
                   verschijnt (midden i.p.v. rond de ring). */
                itemLabelMode="none"
                selectedKey={actionItemIndex !== null ? `${actionItemIndex}` : undefined}
                selectedKeys={filteredItems?.map((it) => it.key)}
                centerItems={filteredItems}
              />
            );
          })()}
          {/* Operator, 5 okt 2026: "Tap to start" in de ring voor de
              aangetikte toestand — start de EERSTVOLGENDE sessie van die
              toestand vandaag (anders de eerste). Meerdere momenten: het uur
              staat erbij; een ander moment start je via zijn bolletje. */}
          {filterMode !== null && (() => {
            const items = (selectedDay?.items ?? [])
              .filter((it) => it.state === filterMode)
              .sort((a, b) => a.reminderAt - b.reminderAt);
            if (items.length === 0) return null;
            const nowM = new Date().getHours() * 60 + new Date().getMinutes();
            const next =
              selectedKey === todayKey
                ? (items.find((it) => it.reminderAt >= nowM) ?? items[0])
                : items[0];
            return (
              <Pressable
                style={s.tapStartZone}
                onPress={() =>
                  openBreathSession({
                      ...claimFreeSessionParam(),
                      state: next.state,
                      technique: next.techniqueKey,
                      minutes: String(next.minutes),
                      autostart: '1',
                      fromPlan: '1',
                    })
                }
                accessibilityLabel={`Start ${titleCase(BREATH_STATES[next.state].eyebrow)} now`}
              >
                <Text style={s.tapStartTxt}>
                  {items.length > 1 ? `Tap to start · ${fmtAgendaTime(next.reminderAt)}` : 'Tap to start'}
                </Text>
              </Pressable>
            );
          })()}
        </Animated.View>

        {/* Operator, 1 okt 2026 ("your daily plan principe van bracelet
           vind ik goed"): dezelfde kaarten-legende als bracelet-
           agenda.tsx — 5 states + "Your next session", kiest welke tijden
           in het midden van de ring verschijnen (zie `centerItems`
           hierboven).
           Operator, 2-3 okt 2026 ("show all vervangen door your next
           session"): "Show all" (alle labels tegelijk — net de drukste,
           meest botsingsgevoelige stand) is vervangen door "Your next
           session", die simpelweg terugkeert naar de standaard
           "Next"-weergave (`filterMode = null`) i.p.v. alles tegelijk op
           te stapelen. */}
        <Animated.View style={listStyle}>
          <View style={s.cardGrid}>
            {STATE_ORDER.map((key) => (
              <StateCard
                key={key}
                label={titleCase(BREATH_STATES[key].eyebrow)}
                color={BREATH_STATES[key].accent}
                Icon={STATE_GLYPH_ICONS[key]}
                on={filterMode === key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilterMode((prev) => (prev === key ? null : key));
                }}
              />
            ))}
            <StateCard
              label="Your next session"
              on={filterMode === null}
              onPress={() => {
                Haptics.selectionAsync();
                setFilterMode(null);
              }}
            />
          </View>

          {(!selectedDay || selectedDay.items.length === 0) && (
            <Text style={[s.emptyB, { marginTop: -8 }]}>Nothing planned this day.</Text>
          )}
        </Animated.View>

        <Animated.View style={[s.bottomActions, actionsStyle]}>
          {/* Operator, 3 okt 2026 ("onderaan ipv edit times check your
             protocol?"): zelfde bestemming (/plan — tijden+techniek per
             moment, met de potlood-iconen als bewerk-affordance), maar nu
             geframed als "bekijk je protocol" i.p.v. enkel "tijden
             bewerken" — past beter bij de vraag "hoe ziet mijn opgebouwde
             protocol er eigenlijk uit", niet enkel een wijzig-actie. */}
          <AnimatedPressable
            style={[s.editBtn, editBtnStyle]}
            onPress={() => router.push('/plan' as never)}
            onPressIn={onEditBtnPressIn}
            onPressOut={onEditBtnPressOut}
          >
            <VibezGlass radius={18} style={StyleSheet.absoluteFill} />
            <Text style={s.editBtnTxt}>Check your protocol</Text>
          </AnimatedPressable>
          {plan && (
            <AnimatedPressable
              style={[s.changeProtocolBtn, changeProtocolStyle]}
              /* Operator, 17 september 2026: naar build-choice.tsx — een
                 bestaand protocol kan ook via Pad B (Build your day)
                 gebouwd zijn, dan slaat "Change protocol" nu correct
                 opnieuw de vork voor, i.p.v. rechtstreeks naar Goal te
                 gaan (wat voor een Pad B-protocol geen zinnige stap is). */
              onPress={() => router.push('/build-choice' as never)}
              onPressIn={onChangeProtocolPressIn}
              onPressOut={onChangeProtocolPressOut}
            >
              <VibezGlass radius={18} style={StyleSheet.absoluteFill} />
              <Pencil size={13} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />
              <Text style={s.changeProtocolTxt}>Change protocol</Text>
            </AnimatedPressable>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Duur-kiezer ── zelfde patroon als plan.tsx/plan-review.tsx. */}
      {/* Operator, 8 okt 2026 ("popup is niet glaslook"): echt glas-onderblad. */}
      <GlassSheet visible={durationPicking !== null} onClose={() => setDurationPicking(null)}>
          <View style={[s.pickSheet, s.pickSheetGlass, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}>
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <View style={s.pickHandle} />
            {durationPicking !== null && selectedDay && (() => {
              const it = selectedDay.items[durationPicking];
              if (!it) return null;
              const st = BREATH_STATES[it.state];
              /* Operator, 1 okt 2026 ("edit duration... lijkt mij nog oud
                 systeem"): klopte — dit was nog de discrete `DurationChip`-
                 grid van vóór breath-setup.tsx's wheel-redesign (24 sept
                 2026). Nu dezelfde, gedeelde `DurationWheel` (verhuisd naar
                 components/DurationWheel.tsx zodat beide schermen letterlijk
                 dezelfde component gebruiken). Geen custom-extend hier — de
                 STATE-brede `durations` (niet een techniek-specifieke lijst
                 met eigen veiligheidsplafond) blijven de vaste, vooraf
                 bepaalde stops op het wiel. */
              return (
                <>
                  <View style={s.pickHeader}>
                    <Text style={[s.pickTitle, s.pickTitleInRow]}>{titleCase(st.eyebrow)} duration</Text>
                    <Pressable onPress={() => setDurationPicking(null)} hitSlop={10} accessibilityRole="button">
                      <Text style={s.pickDoneTxt}>Done</Text>
                    </Pressable>
                  </View>
                  <DurationWheel
                    options={st.durations.map((d) => ({ value: d.minutes, label: `${d.minutes} min` }))}
                    value={it.minutes}
                    accent={st.accent}
                    trackColor="rgba(255,255,255,0.4)"
                    recommendedValue={st.defaultDuration}
                    onChange={(v) => {
                      void setMinutesForIndex(durationPicking, v);
                    }}
                  />
                </>
              );
            })()}
          </View>
      </GlassSheet>

      {/* Operator, 1 okt 2026 ("eerst popup met vraag om naar deze sessie
         te gaan, hoe zou apple dat doen"): een actiesheet i.p.v. een
         native Yes/No-alert — Apple's eigen conventie is de knop de
         exacte actie laten zeggen ("Start session"), niet "OK". Zelfde
         `pickBackdrop`/`pickSheet`/`pickHandle`-opzet als de duur-kiezer
         hierboven en 1-op-1 bracelet-agenda.tsx's identieke popup. */}
      <GlassSheet visible={actionItemIndex !== null} onClose={() => setActionItemIndex(null)}>
          <View style={[s.pickSheet, s.pickSheetGlass, { paddingBottom: Math.max(insets.bottom, 14) + 14, alignItems: 'stretch' }]}>
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <View style={s.pickHandle} />
            {actionItemIndex !== null && selectedDay && (() => {
              const it = selectedDay.items[actionItemIndex];
              if (!it) return null;
              const st = BREATH_STATES[it.state];
              /* Zelfde done/partial/missed-afleiding als voorheen op de
                 (nu verwijderde) lijstrij — het statuslabel dat daar
                 verdween, staat nu hier in de popup. */
              const attempted = selectedDone.has(it.state);
              const done = selectedDone.get(it.state) === true;
              const partial = attempted && !done;
              const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
              const isPastDay = selectedKey < todayKey;
              const isPastTime = selectedKey === todayKey && it.reminderAt < nowMins;
              const missed = !attempted && (isPastDay || isPastTime);
              return (
                <>
                  <View style={s.actionHead}>
                    <View style={[s.actionDot, { backgroundColor: st.accent }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.actionTitle}>{titleCase(st.eyebrow)}</Text>
                      <Text style={s.actionSub}>
                        {fmtAgendaTime(it.reminderAt)} · {it.minutes} min
                        {done ? ' · Done' : partial ? ' · Partial' : missed ? ' · Missed' : ''}
                      </Text>
                    </View>
                  </View>
                  <AnimatedPressable
                    style={s.actionPlayBtn}
                    onPress={() => {
                      setActionItemIndex(null);
                      openBreathSession({
                          ...claimFreeSessionParam(),
                          state: it.state,
                          technique: it.techniqueKey,
                          minutes: String(it.minutes),
                          autostart: '1',
                          fromPlan: '1',
                        });
                    }}
                  >
                    <Text style={s.actionPlayTxt}>Start session</Text>
                  </AnimatedPressable>
                  <Pressable
                    style={s.actionEditBtn}
                    onPress={() => {
                      const idx = actionItemIndex;
                      setActionItemIndex(null);
                      setDurationPicking(idx);
                    }}
                  >
                    <Text style={s.actionEditTxt}>Edit duration</Text>
                  </Pressable>
                </>
              );
            })()}
          </View>
      </GlassSheet>

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
    paddingVertical: 4,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: BrandFonts.bold,
    fontSize: 18,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  scroll: { paddingHorizontal: 16 },

  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  changeProtocolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    /* VIBEZCORE-glas i.p.v. omlijning (5 okt 2026). */
    overflow: 'hidden',
  },
  changeProtocolTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyT: {
    fontFamily: BrandFonts.bold,
    fontSize: 17,
    color: '#ffffff',
    marginBottom: 6,
  },
  emptyB: {
    fontFamily: BrandFonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 18,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#ffffff',
  },
  ctaTxt: { fontFamily: BrandFonts.bold, fontSize: 12.5, letterSpacing: 1.4, color: '#0a0a0a' },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 16 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  badgeTxt: { fontFamily: BrandFonts.semibold, fontSize: 12, color: 'rgba(255,255,255,0.85)' },

  /* Operator, 19 september 2026 ("datumkiezer nóg cleaner — inline
     calendar-menu"): vervangt de vorige Day/Week/Month-tabbalk. */
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  /* Operator, 20 september 2026: terug naar wit — de geselecteerde datum
     krijgt in de kalenderstrip al een cirkel + stip, dus gekleurde tekst
     hier was overbodige nadruk. */
  dateRowTxt: { fontFamily: BrandFonts.semibold, fontSize: 17, color: '#ffffff' },
  /* Operator, 20 september 2026 ("bij uitklappen agenda staat onderkant
     ring niet in safe zone, moet ~1cm naar boven, kaart bij uitklappen
     ook korter maken"): opengeklapt duwt deze kaart (maandnavigatie + hele
     maandrooster) de Rhythm Ring een heel stuk naar onder — compacter
     hier (en in `monthGrid`/`monthCell` hieronder) geeft die ruimte
     terug. */
  calendarDropdown: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dayNavTxt: { fontFamily: BrandFonts.semibold, fontSize: 14.5, color: '#ffffff' },
  calendarDoneRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 },
  calendarDoneTxt: { fontFamily: BrandFonts.semibold, fontSize: 13.5, color: AudioAccent },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  monthHeadTxt: {
    width: `${100 / 7}%` as const,
    textAlign: 'center',
    fontFamily: BrandFonts.semibold,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 4,
  },
  monthCell: { width: `${100 / 7}%` as const, alignItems: 'center', marginBottom: 4, gap: 2 },
  monthCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCircleSel: { backgroundColor: 'rgba(255,255,255,0.14)' },
  monthNum: { fontFamily: BrandFonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  monthDot: { width: 5, height: 5, borderRadius: 2.5 },

  ringWrap: { alignItems: 'center', marginBottom: 8, position: 'relative' },
  /* "Tap to start" — onderaan het middenvlak van de ring (zelfde als
     bracelet-agenda.tsx). */
  tapStartZone: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -75,
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  tapStartTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.75)',
  },

  /* Operator, 1 okt 2026 ("kaarten-principe van bracelet toepassen"):
     1-op-1 bracelet-agenda.tsx's `cardGrid`/`cardSlot`/`card`/`cardOn`/
     `cardDot`/`cardTxt`/`cardTxtOn` — vierkant, bolletje groter
     linksboven, naam links onder, alle 6 kaarten even groot. */
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  cardSlot: { width: '31.5%' },
  card: {
    aspectRatio: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  /* Gekozen = zacht lichter vlak, geen harde rand — zelfde als het State
     Control-plan (operator, 5 okt 2026). */
  cardOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  cardDot: { width: 15, height: 15, borderRadius: 7.5 },
  cardBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTxt: { fontFamily: BrandFonts.medium, fontSize: 12.5, lineHeight: 15, color: 'rgba(255,255,255,0.65)' },
  cardTxtOn: { color: '#ffffff', fontFamily: BrandFonts.semibold },

  pickSheetGlass: { backgroundColor: 'transparent', overflow: 'hidden', borderWidth: 0 },
  pickBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
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
  pickHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 14 },
  pickAccent: { width: 30, height: 3, borderRadius: 2, marginBottom: 8 },
  pickTitle: { alignSelf: 'flex-start', marginBottom: 14, fontFamily: BrandFonts.bold, fontSize: 17, color: '#ffffff' },
  /* Actie-schermpje (tik op een ring-stip) — zie de toelichting erbij
     verderop, 1-op-1 bracelet-agenda.tsx's `actionHead`/`actionDot`/
     `actionTitle`/`actionSub`/`actionPlayBtn`/`actionPlayTxt`-recept. */
  actionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  actionDot: { width: 14, height: 14, borderRadius: 7 },
  actionTitle: { fontFamily: BrandFonts.extrabold, fontSize: 17, letterSpacing: -0.2, color: '#ffffff' },
  actionSub: { marginTop: 2, fontFamily: BrandFonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' },
  actionPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
  },
  actionPlayTxt: { fontFamily: BrandFonts.bold, fontSize: 15, color: '#1D1D1F' },
  actionEditBtn: { alignItems: 'center', paddingVertical: 16 },
  actionEditTxt: { fontFamily: BrandFonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.55)' },

  /* Operator, 20 september 2026 ("grootte pills Edit times en Change
     protocol hetzelfde, Edit times niet allemaal hoofdletters, lijn mooi
     uit tov center"): `editBtn` had zijn eigen, grotere maat (42/22/21,
     nog uit de tijd dat dit een losstaande, gecentreerde knop was) en een
     zwaardere, MET-HOOFDLETTERS tekststijl — nu letterlijk dezelfde
     afmetingen/rand/tekststijl als `changeProtocolBtn` hiernaast, enkel de
     tekst verschilt. `marginTop`/`alignSelf:'center'` weg — die stamden
     uit vóór de knop een child van `bottomActions` (`flexDirection:'row',
     alignItems:'center'`) was, en trokken 'm nu net ietsje uit lijn met
     zijn buur. */
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    /* VIBEZCORE-glas i.p.v. omlijning (5 okt 2026). */
    overflow: 'hidden',
  },
  editBtnTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
});
