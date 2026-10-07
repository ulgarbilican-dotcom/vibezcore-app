/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Set your routine

   Operator, 21 september 2026 ("intensity.tsx en daypart-picker.tsx zijn
   eigenlijk dezelfde stap — cirkel zoals bij build it yourself, met
   Routine/Level/Times erop"): samenvoeging van de vroegere intensity.tsx
   (HOEVEEL sessies/dag) en daypart-picker.tsx (WANNEER) tot ÉÉN stap.
   Later (zelfde dag, "intro-pagina als eigen step 3 na set your state")
   kreeg dit scherm zelf ook een voorportaal (routine-intro.tsx) — het
   AI-pad is dus: Choose path → Set your state → Before we build your
   protocol (routine-intro.tsx) → dit scherm → Your protocol. 5 stappen.

   Operator, vervolg ("die pickers moeten op zelfde manier als build it
   yourself met dropdown en popup met de keuzes" → "waarom doe je niet op
   deze manier?", screenshot van breath-setup.tsx's addToDay-tegels): geen
   kaarten meer los op de pagina — letterlijk hetzelfde patroon: 4 tikbare
   tegels onder de cirkel, elke tegel opent zijn eigen "sheet"-popup (van
   onderuit, inset-grouped lijst, vinkje op de gekozen rij, "Done" sluit
   'm) — MET dezelfde strikte volgorde-vergrendeling en "begin hier"-puls
   als daar: een tegel is pas tikbaar zodra alle vorige al bevestigd zijn,
   een stippenrij + "Next: ..."-tekst onder de cirkel wijst steeds naar
   het ene eerstvolgende veld.

   Vier keuzes, in deze volgorde:
   1. Routine — hoeveel sessies per dag (Essential/Standard/Advanced/
      Complete).
   2. Level — Beginner/Intermediate/Advanced. Bepaalt WELKE techniek EN
      duur `protocol.ts` per toestand kiest (`experienceLevel`-setting) —
      geen aparte Duration-keuze meer (operator: "wij gaan toch
      samenstellen op basis van level", overlapte).
   3. Times — WANNEER. Niets staat vooraf aangevinkt (operator: "times mag
      ook niet ingevuld worden, dat moet gebruiker zelf doen") —
      `bestSlotsForCount(goals, count)` staat wel als tekstuele suggestie
      in de sheet ("Recommended for your goal: ..."), puur informatief,
      vinkt zelf niets aan. Uitzondering: Complete (4 sessies) heeft geen
      echte keuze — alle 4 dagdelen zijn dan de enige geldige combinatie.
   4. Plan length — hoe lang het HELE protocol herhaalt (dag/week/maand/
      voor altijd, `HORIZON_OPTIONS`). Ontbrak hier volledig (Pad A viel
      stilzwijgend terug op 2 weken) — operator: "wij kunnen pas een
      agenda opstellen als wij weten wat gebruiker wil".

   Niets staat vooraf ingevuld (operator: "niet logisch dat wij enkel op
   basis van 1-2 states al een protocol samenstellen") — Continue blijft
   uit tot alle vier expliciet gekozen zijn.

   Bovenaan staat `AddToDayHero` (geëxtraheerd uit breath-setup.tsx) als
   levend overzicht van de 4 keuzes — zelfde cirkel-taal als "Build it
   yourself", nu ook hier. */

import VibezGlass from '@/components/VibezGlass';
import { GlassSheet } from '@/components/GlassSheetHost';
import { rootBlurRef } from '@/utils/root-blur';
import { BrandDark, BrandFonts, CTA, TypeScale } from '@/constants/theme';
import { StepIndicator } from '@/components/StepIndicator';
import AddToDayHero from '@/components/AddToDayHero';
import { showVibezAlert } from '@/components/VibezAlert';
import {
  type ExperienceLevel,
  type Intensity,
  getSetting,
  useSetting,
} from '@/utils/settings';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { useActivePlan } from '@/utils/plan-store';
import type { PlanHorizon, PlanSlot } from '@/utils/plan-store';
import { HORIZON_OPTIONS } from '@/data/plan-horizon-options';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  Layers,
  Gauge,
  CalendarRange,
  Target,
} from 'lucide-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ALL_SLOTS, bestSlotsForCount, SLOT_WINDOW } from '@/utils/day-plan';
import { SLOTS } from '@/services/reminders';
import { generateTemplate, RECOMMENDED_INTENSITY } from '@/utils/protocol';
import { GOALS } from '@/data/goals';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const C = BrandDark;

/* Operator, 21 september 2026 ("zet hier ook die foto in de cirkel zoals
   in de cirkel van build it yourself"): zelfde vaste foto als
   breath-setup.tsx se `ADD_HERO_PHOTO` — geen doel-specifieke foto meer,
   dit is het "protocol samenstellen"-moment zelf, geen doel-illustratie. */
const HERO_PHOTO_FALLBACK =
  'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20choose%20state%20breathwork%202%20png.png';

const fmtTime = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

/* Operator, 21 september 2026 ("level kunnen wij toch niet recommenden?"
   — terecht: geen enkele data zegt iets over iemands ervaring vóór ze het
   zelf opgeven, dus DAAR geen badge. Routine WEL — en beter nog: op basis
   van het net gekozen niveau (zie `recommendedIntensity` verderop), niet
   een vaste "Standard voor iedereen"-gok. Volgorde is nu State → Level →
   Routine → Times → Plan length, zodat Level er al staat tegen de tijd
   dat Routine z'n aanbeveling moet tonen. */
const OPTIONS: {
  key: Intensity;
  name: string;
  hint: string;
  detail: string;
  sessionCount: number;
}[] = [
  {
    key: 'essential',
    name: 'Essential',
    hint: '1 session a day',
    detail: 'A simple daily rhythm.',
    sessionCount: 1,
  },
  {
    key: 'standard',
    name: 'Standard',
    hint: '2 sessions a day',
    detail: 'Timed to fit your goal.',
    sessionCount: 2,
  },
  {
    key: 'advanced',
    name: 'Advanced',
    hint: '3 sessions a day',
    detail: 'Spread through your day.',
    sessionCount: 3,
  },
  {
    key: 'complete',
    name: 'Complete',
    hint: '4 sessions a day',
    detail: 'Every part of your day, covered.',
    sessionCount: 4,
  },
];

/* `RECOMMENDED_INTENSITY` verhuisd naar utils/protocol.ts (22 september
   2026) — zie de toelichting daar. Hier enkel nog geïmporteerd. */

/* Operator, 21 september 2026 ("jij stelt ook altijd 2 weken voor
   waarom? ik zou daar niet perse iets recommenden, waar baseren we ons
   op?"): had eerst hardcoded op '2w' voor iedereen gestaan (fout), toen
   een zelfverzonnen Level-koppeling (ook fout — geen enkele data/
   onderzoek erachter, puur "leek me logisch"). Terecht afgewezen, zelfde
   reden als Level zelf nooit een ★ Recommended-badge kreeg: geen basis =
   geen aanbeveling. Plan length toont nu enkel de eigen hint-tekst per
   optie (`HORIZON_OPTIONS`), geen badge. */

const LEVELS: { key: ExperienceLevel; name: string; detail: string }[] = [
  { key: 'beginner', name: 'Beginner', detail: 'New to breathwork.' },
  { key: 'intermediate', name: 'Intermediate', detail: 'Practiced this before.' },
  { key: 'advanced', name: 'Advanced', detail: 'Comfortable with longer holds.' },
];

/* Operator, 21 september 2026 ("die duration wat is dat? wij gaan toch
   samenstellen op basis van level" — terecht, opgelost naar "weghalen"):
   een aparte Duration-tegel (short/medium/long) overlapte met Level, dat
   via zijn gekozen techniek al een eigen duren-lijst meebrengt. Geen
   losse Duration-keuze meer — de duur volgt automatisch uit de techniek
   die Level al aanwijst (`itemFor`'s aanbevolen duur, `protocol.ts`). */

const INTENSITY_COUNT: Record<Intensity, number> = {
  essential: 1,
  standard: 2,
  advanced: 3,
  complete: 4,
  custom: 1,
};

type PickerKey = 'state' | 'routine' | 'level' | 'times' | 'horizon';

/* Operator, 21 september 2026 ("heb je mijn vraag gezien om de kaarten op
   dezelfde manier weer te geven als op foto? compacter"): terug naar
   breath-setup.tsx's ECHTE `gridTile`-vorm — icoon LINKS in een rond
   badge, label+waarde ernaast gestapeld, vinkje/chevron uiterst rechts,
   één compacte rij (geen hoge, gecentreerde kolom-tegel meer zoals
   goal.tsx). Volgorde-vergrendeling + de "begin hier"-puls blijven
   ongewijzigd — exact dezelfde `startHerePulseStyle`-opzet. */
function SettingTile({
  icon,
  label,
  value,
  done,
  locked,
  isNext,
  onPress,
  full,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  done: boolean;
  locked: boolean;
  isNext: boolean;
  onPress: () => void;
  /** Operator, 21 september 2026 ("plan length kaart mag ook over heel de
     breedte zodat het een mooie blok wordt de kaarten"): 5 tegels in een
     2-koloms grid laat de 5e (Plan length) alleen op de laatste rij staan
     op 48% breedte — oogt onaf. Volle breedte i.p.v. een lege plek
     ernaast open te laten. */
  full?: boolean;
}) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!isNext) {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [isNext, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255,255,255,${0.25 + pulse.value * 0.65})`,
    transform: [{ scale: 1 + pulse.value * 0.03 }],
  }));

  return (
    /* Operator, 21 september 2026 ("de oplichtende omlijning rond de
       kaarten wordt met momenten afgesneden"): de puls-ring zat VOORHEEN
       binnen de Pressable, die `overflow:'hidden'` nodig heeft om de
       BlurView netjes aan de afgeronde hoeken te laten stoppen — de ring
       schaalt tot 103%, en dat stukje "over de rand" werd dus letterlijk
       afgeknipt op de piek van elke puls. Nu een niet-clippende wrapper
       eromheen; de ring zit daar als sibling van de Pressable, buiten
       diens `overflow:'hidden'`. */
    <View style={[s.tileWrap, full && s.tileWrapFull]}>
      <AnimatedPressable
        onPress={onPress}
        disabled={locked}
        onPressIn={() => {
          if (locked) return;
          pressScale.value = withTiming(0.97, { duration: 80 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
        }}
        style={[s.tile, pressStyle, done && s.tileDone, locked && s.tileLocked]}
      >
        <BlurView
          intensity={40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        <View style={s.tileIcon}>{icon}</View>
        <View style={s.tileText}>
          <Text style={s.tileLabel}>{label}</Text>
          <Text style={s.tileValue} numberOfLines={1}>
            {done ? value : '—'}
          </Text>
        </View>
        {done ? (
          <Check size={16} color="#ffffff" strokeWidth={2.6} />
        ) : (
          <ChevronRight size={16} color="rgba(255,255,255,0.4)" strokeWidth={2.2} />
        )}
      </AnimatedPressable>
      {isNext && <Animated.View pointerEvents="none" style={[s.tileNextRing, pulseStyle]} />}
    </View>
  );
}

/* Onderstaande rij-componenten zijn geëxtraheerd uit hun `.map()`-callbacks
   zodat elke rij zijn eigen press-scale hooks mag hebben (hooks zijn niet
   toegestaan binnen een inline callback) — zelfde recept als `StartCard` in
   breath-welcome.tsx. Puur additief: layout/logica/copy ongewijzigd, enkel
   de Pressable werd een AnimatedPressable met een eigen pressScale. */

function GoalRow({
  goal,
  on,
  onPress,
}: {
  goal: (typeof GOALS)[number];
  on: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <View key={goal.key}>
      <AnimatedPressable
        style={[s.sheetRow, on && s.sheetRowOn, pressStyle]}
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withTiming(0.95, { duration: 80 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
        }}
      >
        <BlurView
          intensity={40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        <View style={[s.stateDot, { backgroundColor: goal.accent }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.sheetRowTitle}>{goal.name}</Text>
          <Text style={s.sheetRowSub} numberOfLines={1}>
            {goal.hint}
          </Text>
        </View>
        {on && <Check size={18} color="#ffffff" strokeWidth={2.6} />}
      </AnimatedPressable>
    </View>
  );
}

function RoutineOptionRow({
  option,
  on,
  disabled,
  recommended,
  onPress,
}: {
  option: (typeof OPTIONS)[number];
  on: boolean;
  disabled: boolean;
  recommended: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <View key={option.key}>
      <AnimatedPressable
        style={[s.sheetRow, on && s.sheetRowOn, disabled && { opacity: 0.4 }, pressStyle]}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          if (disabled) return;
          pressScale.value = withTiming(0.95, { duration: 80 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
        }}
      >
        <BlurView
          intensity={40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1 }}>
          {recommended && <Text style={s.sheetRowBadge}>★ RECOMMENDED</Text>}
          <Text style={s.sheetRowTitle}>{option.hint}</Text>
          <Text style={s.sheetRowSub} numberOfLines={2}>
            {disabled ? 'Needs 2 sessions to cover both of your goals.' : option.detail}
          </Text>
        </View>
        {on && <Check size={18} color="#ffffff" strokeWidth={2.6} />}
      </AnimatedPressable>
    </View>
  );
}

function LevelRow({
  level,
  on,
  onPress,
}: {
  level: (typeof LEVELS)[number];
  on: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <View key={level.key}>
      <AnimatedPressable
        style={[s.sheetRow, on && s.sheetRowOn, pressStyle]}
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withTiming(0.95, { duration: 80 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
        }}
      >
        <BlurView
          intensity={40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.sheetRowTitle}>{level.name}</Text>
          <Text style={s.sheetRowSub}>{level.detail}</Text>
        </View>
        {on && <Check size={18} color="#ffffff" strokeWidth={2.6} />}
      </AnimatedPressable>
    </View>
  );
}

function HorizonRow({
  option,
  on,
  onPress,
}: {
  option: (typeof HORIZON_OPTIONS)[number];
  on: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <View key={option.key}>
      <AnimatedPressable
        style={[s.sheetRow, on && s.sheetRowOn, pressStyle]}
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withTiming(0.95, { duration: 80 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
        }}
      >
        <BlurView
          intensity={40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.sheetRowTitle}>{option.name}</Text>
          <Text style={s.sheetRowSub}>{option.hint}</Text>
        </View>
        {on && <Check size={18} color="#ffffff" strokeWidth={2.6} />}
      </AnimatedPressable>
    </View>
  );
}

function SlotRow({
  slot,
  on,
  disabled,
  recommended,
  timeLabel,
  onToggle,
  onPickTime,
}: {
  slot: (typeof SLOTS)[number];
  on: boolean;
  disabled: boolean;
  recommended: boolean;
  timeLabel: string;
  onToggle: () => void;
  onPickTime: () => void;
}) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const timePressScale = useSharedValue(1);
  const timePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timePressScale.value }],
  }));
  return (
    <View key={slot.slot}>
      <AnimatedPressable
        style={[s.sheetRow, on && s.sheetRowOn, disabled && !on && { opacity: 0.4 }, pressStyle]}
        disabled={disabled}
        onPress={onToggle}
        onPressIn={() => {
          if (disabled) return;
          pressScale.value = withTiming(0.95, { duration: 80 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
        }}
      >
        <BlurView
          intensity={40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1 }}>
          {recommended && <Text style={s.sheetRowBadge}>★ RECOMMENDED</Text>}
          <Text style={s.sheetRowTitle}>{slot.label}</Text>
          <Text style={s.sheetRowSub} numberOfLines={1}>
            {slot.body}
          </Text>
          {on && (
            <AnimatedPressable
              onPress={onPickTime}
              onPressIn={() => {
                timePressScale.value = withTiming(0.92, { duration: 80 });
              }}
              onPressOut={() => {
                timePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
              }}
              hitSlop={6}
              style={[s.timePickRow, timePressStyle]}
            >
              <Clock size={12} color="#ffffff" strokeWidth={2.4} />
              <Text style={s.timePickTxt}>at {timeLabel}</Text>
            </AnimatedPressable>
          )}
        </View>
        {on && <Check size={18} color="#ffffff" strokeWidth={2.6} />}
      </AnimatedPressable>
    </View>
  );
}

function TimeChip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        pressScale.value = withTiming(0.93, { duration: 80 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
      }}
      style={[s.pickChip, on && s.pickChipOn, pressStyle]}
    >
      <Text style={[s.pickChipTxt, on && s.pickChipTxtOn]}>{label}</Text>
    </AnimatedPressable>
  );
}

export default function IntensityScreen() {
  const insets = useSafeAreaInsets();
  /* Operator, 21 september 2026 ("waarom blijft dat ingevuld? hoeveel
     keer moet ik dat nog zeggen?"): `intensity`/`experienceLevel` zijn
     PERSISTENTE settings — een eerder gekozen (of getest) waarde bleef
     dus gewoon staan en toonde deze tegels als "al gekozen" bij elke
     nieuwe binnenkomst, ook al had niemand die sessie iets aangetikt.
     Nu, zoals Times/Plan length al deden, pure lokale schermstaat die
     ALTIJD leeg begint — `setIntensity`/`setLevel` (de schrijf-functies
     van de persistente setting, nog steeds nodig voor de rest van de
     app die deze waarde elders leest) worden pas aangeroepen zodra de
     gebruiker DEZE sessie echt iets kiest. */
  const [, setIntensity] = useSetting('intensity');
  const [, setLevel] = useSetting('experienceLevel');
  const [intensity, setIntensityLocal] = useState<Intensity | null>(null);
  const [level, setLevelLocal] = useState<ExperienceLevel | null>(null);
  /* "Plan length" (hoe lang het HELE protocol herhaalt) ontbrak hier
     volledig — Pad A viel stilzwijgend altijd terug op 2 weken (zie
     plan-review.tsx). Lokale schermstaat, exact zoals Pad B dit ook als
     route-param doorgeeft. */
  const [horizon, setHorizon] = useState<PlanHorizon | null>(null);
  const { fromBreathWelcome } = useLocalSearchParams<{
    fromBreathWelcome?: string;
  }>();

  const [goals, setGoals] = useSetting('goals');
  const primaryGoalKey = goals[0] ?? null;
  const secondaryGoalKey = goals[1] ?? null;
  /* Operator, 21 september 2026 ("de state knop onder de cirkel moet ook
     open kunnen... heeft wel de mogelijkheid om hier ook aan te passen,
     moet dus niet perse terug"): zelfde multi-select-logica als goal.tsx
     ("Set your state") zelf — tik een al-gekozen doel weg, tik een 2e
     doel erbij (max 2), of vervang het 2e doel. Schrijft naar dezelfde
     `goals`-setting, dus blijft overal consistent. */
  const tapGoal = (key: string) => {
    Haptics.selectionAsync();
    if (key === primaryGoalKey) {
      void setGoals([]);
      return;
    }
    if (key === secondaryGoalKey) {
      void setGoals(primaryGoalKey ? [primaryGoalKey] : []);
      return;
    }
    if (!primaryGoalKey) {
      void setGoals([key]);
      return;
    }
    void setGoals([primaryGoalKey, key]);
  };
  const needsTwoSessions = goals.length >= 2;
  const { plan } = useActivePlan();

  const [activePicker, setActivePicker] = useState<PickerKey | null>(null);

  useEffect(() => {
    if (needsTwoSessions && intensity === 'essential') {
      setIntensityLocal('standard');
      void setIntensity('standard');
    }
  }, [needsTwoSessions, intensity, setIntensity]);

  const pick = (key: Intensity) => {
    if (key === 'essential' && needsTwoSessions) return;
    Haptics.selectionAsync();
    setIntensityLocal(key);
    void setIntensity(key);
  };

  const count = intensity ? INTENSITY_COUNT[intensity] : 0;

  /* Times: welke dagdelen + welk exact uur. Operator, 21 september 2026
     ("times mag ook niet ingevuld worden, dat moet gebruiker zelf doen"):
     GEEN automatische voorselectie meer — `bestSlotsForCount` blijft
     bestaan als tekstuele suggestie in de sheet hieronder (`recommended`,
     puur informatief), maar vinkt zelf niets meer aan. Enige
     uitzondering: bij Complete (4 sessies) is er geen echte keuze — alle
     4 dagdelen zijn dan de enige geldige combinatie, geen "onze keuze"
     die overschreven kan worden. */
  const [picked, setPicked] = useState<string[]>([]);
  const [times, setTimes] = useState<Partial<Record<PlanSlot, number>>>({});
  const [timePicking, setTimePicking] = useState<PlanSlot | null>(null);

  useEffect(() => {
    if (count >= ALL_SLOTS.length) {
      setPicked([...ALL_SLOTS]);
      setTimes(() => {
        const out: Partial<Record<PlanSlot, number>> = {};
        for (const slot of ALL_SLOTS as readonly PlanSlot[]) {
          out[slot] = SLOTS.find((sl) => sl.slot === slot)!.hour * 60;
        }
        return out;
      });
      return;
    }
    setPicked([]);
    setTimes({});
  }, [count]);

  /* Puur tekstuele suggestie in de Times-sheet — informeert, vinkt niets
     aan. */
  const recommended = count > 0 && count < ALL_SLOTS.length ? bestSlotsForCount(goals, count) : [];

  const locked = count >= ALL_SLOTS.length;

  const tapSlot = (slot: PlanSlot) => {
    if (locked) return;
    setPicked((cur) => {
      if (cur.includes(slot)) return cur.filter((s) => s !== slot);
      if (cur.length >= count) return cur;
      return [...cur, slot];
    });
    setTimes((cur) => {
      if (picked.includes(slot)) {
        const { [slot]: _drop, ...rest } = cur;
        return rest;
      }
      if (picked.length >= count) return cur;
      return { ...cur, [slot]: SLOTS.find((sl) => sl.slot === slot)!.hour * 60 };
    });
  };

  /* Operator, 21 september 2026 ("gebruiker weet niet hoeveel tijden hij
     moet kiezen... done zou een foutmelding moeten geven"): "Done" sluit
     de Times-sheet enkel als het aantal klopt met de gekozen Routine —
     komt het niet overeen, dan een VIBEZCORE-gestileerde melding i.p.v.
     stilzwijgend sluiten met een onvolledige keuze. */
  const closeTimes = () => {
    if (picked.length === count) {
      setActivePicker(null);
      return;
    }
    void showVibezAlert({
      title: 'Choose more times',
      message: `Your routine needs ${count} time${count === 1 ? '' : 's'} a day — you've picked ${picked.length} so far.`,
      buttons: [{ text: 'Got it', style: 'primary' }],
    });
  };

  /* Operator, 21 september 2026 ("your routine bol moet zwarte
     transparante binnenkant hebben, nu krijgt dat kleur van 1 van de 2
     states"): deze cirkel staat voor het HELE protocol (State t/m Plan
     length), niet voor één gekozen doel — kleur/foto van enkel `goals[0]`
     was misleidend zodra er 2 doelen gekozen zijn. Nu neutraal
     (`AddToDayHero`'s `neutral` prop): matglas i.p.v. doelfoto+tint, ring
     kleurt op naar het generieke app-accent i.p.v. een doelkleur. */
  const heroAccent = C.accent;
  const heroPhoto = HERO_PHOTO_FALLBACK;

  /* Operator, 21 september 2026 ("de waarde wordt getoond omdat het in
     de vorige stap al ingevuld is — gebruiker kiest eerst state 1 of 2,
     komt dan pas hier"): GEEN nieuwe gok van dit scherm — dit is echte,
     al bevestigde input uit goal.tsx ("Set your state"), dus mag hier
     wél al als "klaar" staan. Los van de vergrendel-volgorde hieronder
     (die gaat over keuzes die OP dit scherm nog gemaakt moeten worden). */
  const chosenGoals = GOALS.filter((g) => goals.includes(g.key));
  const stateLabel = chosenGoals.map((g) => g.name).join(' + ');

  const routineDone = !!intensity;
  const levelDone = !!level;
  const timesDone = count > 0 && picked.length === count;
  const horizonDone = !!horizon;
  const heroProgress =
    [routineDone, levelDone, timesDone, horizonDone].filter(Boolean).length / 4;

  const canContinue = routineDone && levelDone && timesDone && horizonDone;

  /* Operator, 21 september 2026 ("misschien moeten we na de state knop
     eerst level laten invullen, en op basis daarvan verdere suggesties"):
     Level nu VOOR Routine — Routine's ★ Recommended-badge volgt daardoor
     het gekozen niveau (`RECOMMENDED_INTENSITY`) i.p.v. een losstaande
     gok. Essential (nooit aanbevolen sinds de 2x/3x/4x-mapping) is toch
     al de enige tier die `needsTwoSessions` kan uitsluiten, dus geen
     aparte terugval meer nodig. */
  const recommendedIntensity = level ? RECOMMENDED_INTENSITY[level] : null;

  /* Strikte volgorde, zelfde principe als breath-setup.tsx se
     `NEXT_ORDER`/`nextField` — een tegel is pas tikbaar zodra alle
     vorige al bevestigd zijn, en de eerstvolgende krijgt de "begin
     hier"-puls + de "Next: ..."-tekst onder de cirkel. */
  const doneMap = {
    Level: levelDone,
    Routine: routineDone,
    Times: timesDone,
    'Plan length': horizonDone,
  } as const;
  const NEXT_ORDER: (keyof typeof doneMap)[] = ['Level', 'Routine', 'Times', 'Plan length'];
  const nextField = NEXT_ORDER.find((k) => !doneMap[k]);
  const routineLocked = !levelDone;
  const timesLocked = !levelDone || !routineDone;
  const horizonLocked = !levelDone || !routineDone || !timesDone;

  /* Press-scale voor de vaste knoppen op dit scherm (niet in een .map()) —
     zelfde recept als `SettingTile` hierboven. */
  const backPressScale = useSharedValue(1);
  const backPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backPressScale.value }],
  }));
  const ctaPressScale = useSharedValue(1);
  /* Operator ("kijk alle CTA's na"): opacity(.85) + haptic-tik ontbraken
     (huisstijl §5). */
  const ctaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaPressScale.value }],
    opacity: 1 - (1 - ctaPressScale.value) * 3.75,
  }));
  const stateDonePressScale = useSharedValue(1);
  const stateDonePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: stateDonePressScale.value }],
  }));
  const routineDonePressScale = useSharedValue(1);
  const routineDonePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: routineDonePressScale.value }],
  }));
  const levelDonePressScale = useSharedValue(1);
  const levelDonePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: levelDonePressScale.value }],
  }));
  const horizonDonePressScale = useSharedValue(1);
  const horizonDonePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: horizonDonePressScale.value }],
  }));
  const timesDonePressScale = useSharedValue(1);
  const timesDonePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timesDonePressScale.value }],
  }));

  const next = () => {
    if (!canContinue || !intensity || !level || !horizon) return;
    const ordered = ALL_SLOTS.filter((sl) => picked.includes(sl)) as PlanSlot[];
    const currentGoals = getSetting('goals');
    const generated = generateTemplate(currentGoals, intensity, ordered, level);
    const withTimes = generated.map((it) =>
      typeof times[it.slot] === 'number' ? { ...it, reminderAt: times[it.slot]! } : it,
    );
    router.push({
      pathname: '/plan-review',
      params: {
        path: 'auto',
        template: JSON.stringify(withTimes),
        horizon,
        ...(fromBreathWelcome ? { fromBreathWelcome } : {}),
      },
    } as never);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.bar}>
        <AnimatedPressable
          onPress={() =>
            fromBreathWelcome && !plan
              ? router.navigate({
                  pathname: '/breath-welcome',
                  /* Operator, 22 september 2026: breath-welcome.tsx's
                     slotscherm schoof van index 6 naar 4. */
                  params: { resumeStep: '4' },
                } as never)
              : router.back()
          }
          onPressIn={() => {
            backPressScale.value = withTiming(0.92, { duration: 80 });
          }}
          onPressOut={() => {
            backPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
          }}
          hitSlop={12}
          style={[s.back, backPressStyle]}
        >
          {/* Operator, 1 okt 2026 ("headers overal consistent"): size
             22→20, stroke 2.2→2.8 — de "officiële iOS-chevron.backward"-
             stijl uit build-choice.tsx (18 sept), nu de app-brede
             standaard. */}
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </AnimatedPressable>
        {/* Operator, 21 september 2026 ("balk is storend zo laag, zet 'm
           naast de pijl"): terug in de knoppenrij. */}
        <StepIndicator step={4} total={5} color="#ffffff" />
        <View style={s.back} />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: Math.max(insets.bottom, 12) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Operator, 21 september 2026 ("a few things first moet weg"):
           de intro-tekst zit al op routine-intro.tsx (stap 3) — hier geen
           tweede kop meer nodig, de cirkel spreekt voor zich. */}

        <AddToDayHero
          accent={heroAccent}
          photo={heroPhoto}
          neutral
          progress={heroProgress}
          topLabel="Your routine"
          rows={[
            { label: 'State', value: stateLabel, touched: true },
            {
              label: 'Level',
              value: level ? LEVELS.find((l) => l.key === level)!.name : '',
              touched: levelDone,
            },
            {
              label: 'Routine',
              value: intensity ? OPTIONS.find((o) => o.key === intensity)!.hint : '',
              touched: routineDone,
            },
            {
              label: 'Times',
              value: count > 0 ? `${picked.length}/${count} set` : '',
              touched: timesDone,
            },
            {
              label: 'Plan length',
              value: horizon ? HORIZON_OPTIONS.find((o) => o.key === horizon)!.name : '',
              touched: horizonDone,
            },
          ]}
        />

        {/* Operator, 21 september 2026 ("waarom doe je niet op deze
           manier?" — breath-setup.tsx se stippenrij + "Next: ..."):
           zelfde patroon hier — 4 stippen (gevuld = bevestigd, holle rand
           = eerstvolgende), en de tekst eronder noemt het ÉNE
           eerstvolgende veld i.p.v. alles op te sommen. */}
        <View style={s.stepDots}>
          {NEXT_ORDER.map((k) => (
            <View
              key={k}
              style={[
                s.stepDot,
                doneMap[k] && s.stepDotDone,
                k === nextField && s.stepDotNext,
              ]}
            />
          ))}
        </View>
        <Text style={s.progressTxt}>{nextField ? `Next: ${nextField}` : 'All set'}</Text>

        <View style={s.tiles}>
          {/* Operator, 21 september 2026 ("state-knop moet ook open kunnen,
             gebruiker heeft al gekozen — moet als preselectie staan maar
             mag hier ook aangepast worden, hoeft niet terug"): opent een
             eigen sheet (zelfde multi-select als goal.tsx), i.p.v. terug
             te navigeren. Al bevestigd op goal.tsx, dus altijd `done`,
             geen deel van de vergrendel-volgorde. */}
          <SettingTile
            icon={<Target size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />}
            label="State"
            value={stateLabel}
            done={true}
            locked={false}
            isNext={false}
            onPress={() => setActivePicker('state')}
          />
          <SettingTile
            icon={<Gauge size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />}
            label="Level"
            value={level ? LEVELS.find((l) => l.key === level)!.name : ''}
            done={levelDone}
            locked={false}
            isNext={nextField === 'Level'}
            onPress={() => setActivePicker('level')}
          />
          <SettingTile
            icon={<Layers size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />}
            label="Routine"
            value={intensity ? OPTIONS.find((o) => o.key === intensity)!.hint : ''}
            done={routineDone}
            locked={routineLocked}
            isNext={nextField === 'Routine'}
            onPress={() => {
              if (routineLocked) return;
              setActivePicker('routine');
            }}
          />
          <SettingTile
            icon={<Clock size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />}
            label="Times"
            value={count > 0 ? `${picked.length}/${count} set` : ''}
            done={timesDone}
            locked={timesLocked}
            isNext={nextField === 'Times'}
            onPress={() => {
              if (timesLocked || count === 0) return;
              setActivePicker('times');
            }}
          />
          <SettingTile
            icon={<CalendarRange size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />}
            label="Plan length"
            value={horizon ? HORIZON_OPTIONS.find((o) => o.key === horizon)!.name : ''}
            done={horizonDone}
            locked={horizonLocked}
            isNext={nextField === 'Plan length'}
            onPress={() => setActivePicker('horizon')}
            full
          />
        </View>
      </ScrollView>

      <View
        style={[s.ctaFloat, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}
        pointerEvents="box-none"
      >
        <ExpoGradient
          colors={['transparent', C.bg]}
          locations={[0, 0.4]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <AnimatedPressable
          style={[s.cta, !canContinue && s.ctaDisabled, ctaPressStyle]}
          disabled={!canContinue}
          onPress={next}
          onPressIn={() => {
            if (!canContinue) return;
            ctaPressScale.value = withTiming(0.96, { duration: 80 });
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          onPressOut={() => {
            ctaPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
          }}
        >
          <Text style={s.ctaTxt}>Continue</Text>
        </AnimatedPressable>
      </View>

      {/* ── State-popup ── */}
      {/* Echt glas, ook op Android: in hetzelfde venster als de app
          (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
      <GlassSheet visible={activePicker === 'state'} onClose={() => setActivePicker(null)}>
          <SafeAreaView style={[s.sheetContainer, { backgroundColor: 'transparent', overflow: 'hidden' }]} edges={['bottom']}>
            {/* VIBEZCORE-glas, echt vervaagd (7 okt 2026). */}
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.modalTitle}>State</Text>
              <AnimatedPressable
                onPress={() => setActivePicker(null)}
                onPressIn={() => {
                  stateDonePressScale.value = withTiming(0.94, { duration: 80 });
                }}
                onPressOut={() => {
                  stateDonePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
                }}
                hitSlop={10}
                style={stateDonePressStyle}
              >
                <Text style={s.sheetDoneTxt}>Done</Text>
              </AnimatedPressable>
            </View>
            <ScrollView
              style={{ flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
            >
              <View style={s.sheetList}>
                {GOALS.map((g) => (
                  <GoalRow
                    key={g.key}
                    goal={g}
                    on={goals.includes(g.key)}
                    onPress={() => tapGoal(g.key)}
                  />
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
      </GlassSheet>

      {/* ── Routine-popup ── */}
      {/* Echt glas, ook op Android: in hetzelfde venster als de app
          (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
      <GlassSheet visible={activePicker === 'routine'} onClose={() => setActivePicker(null)}>
          <SafeAreaView style={[s.sheetContainer, { backgroundColor: 'transparent', overflow: 'hidden' }]} edges={['bottom']}>
            {/* VIBEZCORE-glas, echt vervaagd (7 okt 2026). */}
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.modalTitle}>Routine</Text>
              <AnimatedPressable
                onPress={() => setActivePicker(null)}
                onPressIn={() => {
                  routineDonePressScale.value = withTiming(0.94, { duration: 80 });
                }}
                onPressOut={() => {
                  routineDonePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
                }}
                hitSlop={10}
                style={routineDonePressStyle}
              >
                <Text style={s.sheetDoneTxt}>Done</Text>
              </AnimatedPressable>
            </View>
            <ScrollView
              style={{ flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
            >
              <View style={s.sheetList}>
                {OPTIONS.map((o) => (
                  <RoutineOptionRow
                    key={o.key}
                    option={o}
                    on={intensity === o.key}
                    disabled={o.key === 'essential' && needsTwoSessions}
                    recommended={o.key === recommendedIntensity}
                    onPress={() => pick(o.key)}
                  />
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
      </GlassSheet>

      {/* ── Level-popup ── */}
      {/* Echt glas, ook op Android: in hetzelfde venster als de app
          (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
      <GlassSheet visible={activePicker === 'level'} onClose={() => setActivePicker(null)}>
          <SafeAreaView style={[s.sheetContainer, { backgroundColor: 'transparent', overflow: 'hidden' }]} edges={['bottom']}>
            {/* VIBEZCORE-glas, echt vervaagd (7 okt 2026). */}
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.modalTitle}>Level</Text>
              <AnimatedPressable
                onPress={() => setActivePicker(null)}
                onPressIn={() => {
                  levelDonePressScale.value = withTiming(0.94, { duration: 80 });
                }}
                onPressOut={() => {
                  levelDonePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
                }}
                hitSlop={10}
                style={levelDonePressStyle}
              >
                <Text style={s.sheetDoneTxt}>Done</Text>
              </AnimatedPressable>
            </View>
            <View style={s.sheetList}>
              {LEVELS.map((l) => {
                const on = level === l.key;
                return (
                  <View key={l.key}>
                    <Pressable
                      style={[s.sheetRow, on && s.sheetRowOn]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setLevelLocal(l.key);
                        void setLevel(l.key);
                      }}
                    >
                      <BlurView
                        intensity={40}
                        tint="dark"
                        blurMethod="dimezisBlurViewSdk31Plus"
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.sheetRowTitle}>{l.name}</Text>
                        <Text style={s.sheetRowSub}>{l.detail}</Text>
                      </View>
                      {on && <Check size={18} color="#ffffff" strokeWidth={2.6} />}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </SafeAreaView>
      </GlassSheet>

      {/* ── Plan length-popup ── */}
      {/* Echt glas, ook op Android: in hetzelfde venster als de app
          (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
      <GlassSheet visible={activePicker === 'horizon'} onClose={() => setActivePicker(null)}>
          <SafeAreaView style={[s.sheetContainer, { backgroundColor: 'transparent', overflow: 'hidden' }]} edges={['bottom']}>
            {/* VIBEZCORE-glas, echt vervaagd (7 okt 2026). */}
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.modalTitle}>Plan length</Text>
              <AnimatedPressable
                onPress={() => setActivePicker(null)}
                onPressIn={() => {
                  horizonDonePressScale.value = withTiming(0.94, { duration: 80 });
                }}
                onPressOut={() => {
                  horizonDonePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
                }}
                hitSlop={10}
                style={horizonDonePressStyle}
              >
                <Text style={s.sheetDoneTxt}>Done</Text>
              </AnimatedPressable>
            </View>
            <View style={s.sheetList}>
              {HORIZON_OPTIONS.map((o) => {
                const on = horizon === o.key;
                return (
                  <View key={o.key}>
                    <Pressable
                      style={[s.sheetRow, on && s.sheetRowOn]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setHorizon(o.key);
                        setActivePicker(null);
                      }}
                    >
                      <BlurView
                        intensity={40}
                        tint="dark"
                        blurMethod="dimezisBlurViewSdk31Plus"
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={{ flex: 1 }}>
                        {/* Operator, 21 september 2026 ("ik zou daar niet
                           perse iets recommenden, waar baseren we ons
                           op?"): terecht — geen ★ Recommended-badge meer
                           hier, geen basis om er een op te plakken (zelfde
                           reden als Level hierboven nooit een badge
                           kreeg). Enkel de eigen hint-tekst per optie. */}
                        <Text style={s.sheetRowTitle}>{o.name}</Text>
                        <Text style={s.sheetRowSub}>{o.hint}</Text>
                      </View>
                      {on && <Check size={18} color="#ffffff" strokeWidth={2.6} />}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </SafeAreaView>
      </GlassSheet>

      {/* ── Times-popup ── */}
      {/* Echt glas, ook op Android: in hetzelfde venster als de app
          (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
      <GlassSheet visible={activePicker === 'times'} onClose={closeTimes}>
          <SafeAreaView style={[s.sheetContainer, { backgroundColor: 'transparent', overflow: 'hidden' }]} edges={['bottom']}>
            {/* VIBEZCORE-glas, echt vervaagd (7 okt 2026). */}
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.modalTitle}>Times</Text>
              <AnimatedPressable
                onPress={closeTimes}
                onPressIn={() => {
                  timesDonePressScale.value = withTiming(0.94, { duration: 80 });
                }}
                onPressOut={() => {
                  timesDonePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
                }}
                hitSlop={10}
                style={timesDonePressStyle}
              >
                <Text style={s.sheetDoneTxt}>Done</Text>
              </AnimatedPressable>
            </View>
            {/* Operator, 21 september 2026 ("gebruiker weet niet hoeveel
               tijden hij moet kiezen — dat hangt af van de gekozen
               routine, maar die link maken ze niet zelf"): expliciet
               voortgangslabel i.p.v. dat stilzwijgend te veronderstellen. */}
            <Text style={s.timesCountHint}>
              Choose {count} time{count === 1 ? '' : 's'} — {picked.length}/{count} selected
            </Text>
            <ScrollView
              style={{ flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
            >
              <View style={s.sheetList}>
                {SLOTS.map((sl) => {
                  const on = picked.includes(sl.slot);
                  const disabled = locked || (!on && picked.length >= count);
                  return (
                    <View key={sl.slot}>
                      <Pressable
                        style={[s.sheetRow, on && s.sheetRowOn, disabled && !on && { opacity: 0.4 }]}
                        disabled={locked}
                        onPress={() => tapSlot(sl.slot)}
                      >
                        <BlurView
                          intensity={40}
                          tint="dark"
                          blurMethod="dimezisBlurViewSdk31Plus"
                          style={StyleSheet.absoluteFill}
                        />
                        <View style={{ flex: 1 }}>
                          {recommended.includes(sl.slot) && (
                            <Text style={s.sheetRowBadge}>★ RECOMMENDED</Text>
                          )}
                          <Text style={s.sheetRowTitle}>{sl.label}</Text>
                          <Text style={s.sheetRowSub} numberOfLines={1}>
                            {sl.body}
                          </Text>
                          {on && (
                            <Pressable
                              onPress={() => setTimePicking(sl.slot)}
                              hitSlop={6}
                              style={s.timePickRow}
                            >
                              <Clock size={12} color="#ffffff" strokeWidth={2.4} />
                              <Text style={s.timePickTxt}>
                                at {fmtTime(times[sl.slot] ?? sl.hour * 60)}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                        {on && <Check size={18} color="#ffffff" strokeWidth={2.6} />}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </SafeAreaView>
      </GlassSheet>

      {/* Sub-popup voor het exacte uur binnen een gekozen dagdeel — bovenop
         de Times-sheet, zelfde patroon als daarvoor. */}
      <Modal
        visible={timePicking !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePicking(null)}
      >
        <Pressable style={s.pickBackdrop} onPress={() => setTimePicking(null)}>
          <Pressable
            style={[s.pickSheet, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}
            onPress={() => {}}
          >
            <View style={s.pickHandle} />
            {timePicking && (
              <>
                <Text style={s.pickTitle}>
                  {SLOTS.find((sl) => sl.slot === timePicking)?.label} time
                </Text>
                <View style={s.pickGrid}>
                  {(() => {
                    const window = SLOT_WINDOW[timePicking];
                    const out: number[] = [];
                    for (let h = window.from; h < window.to; h += 1) {
                      out.push(h * 60, h * 60 + 30);
                    }
                    return out.map((mins) => {
                      const on = (times[timePicking] ?? -1) === mins;
                      return (
                        <Pressable
                          key={mins}
                          onPress={() => {
                            setTimes((cur) => ({ ...cur, [timePicking]: mins }));
                            setTimePicking(null);
                          }}
                          style={[s.pickChip, on && s.pickChipOn]}
                        >
                          <Text style={[s.pickChipTxt, on && s.pickChipTxtOn]}>
                            {fmtTime(mins)}
                          </Text>
                        </Pressable>
                      );
                    });
                  })()}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
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
  /* Stippenrij + "Next: ..."-tekst, zelfde recept als breath-setup.tsx. */
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  stepDotDone: { backgroundColor: '#ffffff' },
  stepDotNext: { borderWidth: 1.5, borderColor: '#ffffff' },
  progressTxt: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.45)',
  },

  /* Operator, 21 september 2026 ("kaarten op dezelfde manier als op foto,
     compacter"): breath-setup.tsx's ECHTE `gridTile`-vorm — 2 kolommen
     (48% breedte, zelfde grid-opzet), maar de tegel zelf is een compacte
     RIJ (icoon links, tekst ernaast, vinkje/chevron rechts), geen hoge
     gecentreerde kolom meer. Vijf tegels (State/Routine/Level/Times/Plan
     length) vullen 2 volle rijen + 1 alleenstaande, exact als de foto. */
  tiles: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  /* Draagt de 48%-breedte in het grid nu — `tile` zelf clipt (BlurView se
     afgeronde hoeken), `tileWrap` niet, zodat de puls-ring (`tileNextRing`,
     sibling hieronder) ongehinderd tot 103% kan schalen. */
  tileWrap: { width: '48%' },
  tileWrapFull: { width: '100%' },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  /* Operator, 21 september 2026: witte vulling op gekozen tegels
     geprobeerd ("contrast op de pagina") — "draai terug, niet mooi". Terug
     naar de subtiele rand+tint-indicator. */
  tileDone: {
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  tileLocked: { opacity: 0.4 },
  /* Losse randlaag voor de "begin hier"-pulse, zelfde vorm als `tile`
     zelf — een absoluut-gepositioneerde overlay i.p.v. de Pressable's
     eigen rand animeren (zie breath-setup.tsx se `startHereRing`). */
  tileNextRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tileText: { flex: 1 },
  tileLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 10.5,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
  },
  tileValue: {
    marginTop: 1,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    color: '#f4f4f4',
  },

  timePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  timePickTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12,
    color: '#ffffff',
  },

  cta: { ...CTA.container },
  ctaDisabled: CTA.disabled,
  ctaTxt: CTA.label,
  ctaFloat: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 26,
  },

  /* ── Sheet-popups (State/Routine/Level/Times/Plan length) — van
     onderuit, vaste header met titel + "Done"-link.
     Operator, 21 september 2026 ("niet duidelijk dat je kan aantikken,
     kaarten zien er grijs uit i.p.v. zwart transparant blur"): de
     eerdere "inset grouped"-lijst (Apple HIG, breath-setup.tsx-stijl —
     één gedeelde lijst met dunne scheidingslijnen + gedeelde blur) las
     hier niet als los-aantikbaar — matglas op een effen zwarte
     ondergrond oogt gewoon vlak grijs, geen glas. Nu elke optie een
     EIGEN kaart (zelfde recept als de tegels zelf: losse rand, eigen
     BlurView, ruimte ertussen) — leest meteen als individueel
     aantikbaar, zoals de rest van dit scherm al doet. */
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetContainer: {
    maxHeight: '85%',
    backgroundColor: C.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 22,
    paddingTop: 10,
    /* Operator, 21 september 2026 ("onderste kaart raakt de onderkant,
       niet volledig zichtbaar, moet ademruimte hebben"): Level/Plan
       length hadden zelfs HELEMAAL geen bottom-padding (geen ScrollView,
       enkel de safe-area-inset van SafeAreaView zelf, die op veel
       toestellen 0 is) — vaste basisruimte hier dekt alle vijf sheets in
       één keer, ook de niet-scrollende. */
    paddingBottom: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 18,
    color: '#ffffff',
  },
  sheetDoneTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    color: '#ffffff',
  },
  timesCountHint: {
    marginTop: -4,
    marginBottom: 10,
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)',
  },
  /* Operator, 21 september 2026 ("kleur zwart blur transparant beginnen,
     bij aanklikken kleine kleuraanpassing naar grijs"): matglas i.p.v.
     de vorige vlakke witte tint — `BlurView` erin gerenderd (zie JSX),
     zelfde `dimezisBlurViewSdk31Plus`-recept als de rest van de app. */
  /* `sheetList` is nu enkel nog een verticale stapel (`gap`), geen eigen
     rand/vulling/blur meer — dat draagt elke kaart (`sheetRow`) zelf. */
  sheetList: { gap: 10 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  /* Operator, 21 september 2026: eerst helemaal wit gemaakt op "kunnen we
     kaarten die geselecteerd zijn helemaal wit zetten" — bleek een
     misverstand ("ik bedoelde de kaarten State/Level/... zelf, niet deze
     popup-rijen"), teruggedraaid naar de rand-only selectie-indicator.
     Zie `tileDone` (de echte tegels op het scherm) voor de wit-op-
     gekozen-behandeling die WEL bedoeld was. */
  sheetRowOn: {
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  stateDot: { width: 10, height: 10, borderRadius: 5 },
  sheetRowBadge: {
    marginBottom: 3,
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: '#ffffff',
  },
  sheetRowTitle: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    color: '#f4f4f4',
  },
  sheetRowSub: {
    marginTop: 2,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.5)',
  },

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
  },
  pickHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginBottom: 14,
  },
  pickTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 17,
    color: C.text,
    marginBottom: 14,
  },
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 6,
  },
  pickChip: {
    flexGrow: 1,
    minWidth: 70,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
  },
  pickChipOn: {
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  pickChipTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.7)',
  },
  pickChipTxtOn: {
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
  },
});
