/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Set your plan (bracelet)

   Operator, 29 september 2026 ("de bracelet set your goal is eigenlijk
   niets momenteel, had evengoed 'go to bracelet' kunnen heten... set your
   day beter denk ik. user moet state kunnen kiezen en tijd en dit zoveel
   per dag hij of zij wil"). Eigen pagina, zelfde PRINCIPE als goal.tsx
   (een tegel per toestand aantikken kiest 'm) vertaald naar de bracelet:
   hier is een tegel geen éénmalige doel-keuze maar een SESSIE die je
   toevoegt aan je plan — tik een toestand aan, kies duur + tijdstip, en
   herhaal zo vaak als je wil. Geen primair/secundair-limiet zoals
   goal.tsx (dat is doelen-taal, niet van toepassing hier).

   Operator, 30 september 2026 ("set your day is niet juiste benaming,
   iemand maakt een planning voor misschien 1 dag/week/maand"): "Set your
   day" hernoemd naar "Set your plan" — je stelt hier geen los dagje in,
   je bouwt een dag-TEMPLATE die over een zelfgekozen horizon (1 dag tot
   doorlopend) herhaalt. Zelfde reden waarom de instap-tekst nu kort is
   i.p.v. een uitlegparagraaf (operator: "dat lijkt eerder een info
   sectie, hoe doet apple dit" — Apple's eigen instelschermen (Focus,
   Shortcuts) geven 1 korte regel, geen alinea).

   Operator, vervolg ("ook horizon (1 dag/week/2 weken/zolang je wil)
   kunnen kiezen, het enige verschil is dat WIJ hier niet bouwen,
   gebruiker beslist zelf"): geen Pad A/Pad B-vork, geen algoritme — de
   gebruiker bouwt de dag-template hieronder zelf, kiest daarna hoe lang
   die moet doorlopen, en dat wordt herhaald over de hele horizon
   (`buildBraceletPlanFromTemplate`, letterlijk protocol.ts's
   `buildPlanFromTemplate` maar dan hier). Individuele dagen nadien laten
   afwijken kan via agenda.tsx, zelfde mechanisme als breathwork.

   Operator, 30 september 2026 (bugs op het "add session"-scherm: "pill te
   breed", "recommended in de pill", "scrollen minuten lukt niet"): de
   duur-wheel zat voorheen in een RN `<Modal>` zonder de vaste 266px-
   breedte die bracelet-control.tsx er altijd omheen zet (`wheelPill`'s
   links/rechts-inzet is op die 266px afgestemd, niet op een volle-breedte
   sheet) — vandaar de te brede pil met "Recommended" erin geplet. Een
   ScrollView diep genest in Modal-Pressable-Pressable bleek bovendien
   onbetrouwbaar voor pan-gestures op Android. Beide opgelost door de
   "add session"-stap GEEN Modal meer te laten zijn maar een eigen volledig
   scherm (in-page state-wissel, zelfde SafeAreaView) — geen geneste
   Pressables, en de wheel krijgt nu wél zijn vaste 266px-wrapper.

   Opslag: `bracelet-plan-store.ts`'s `BraceletActivePlan` — EIGEN bestand,
   zelfde architectuur als breathwork's `plan-store.ts` (zie de
   toelichting daar). Meldingen via `syncBraceletPlanReminder`
   (services/reminders.ts) — zelfde hoofd+herinnering-15-min-later-patroon
   als breathwork's dagplan, leest VANDAAG's items uit het plan.
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts, TypeScale } from '@/constants/theme';
import { MODES, getModeMeta, BraceletMode } from '@/services/ble-contract';
import { syncBraceletPlanReminder, MAX_BRACELET_SESSIONS } from '@/services/reminders';
import { DurationRing, DurationWheel } from '@/components/DurationRingPicker';
import {
  buildBraceletPlanFromTemplate,
  saveActiveBraceletPlan,
  useActiveBraceletPlan,
  rangesOverlap,
  type BraceletPlanHorizon,
} from '@/utils/bracelet-plan-store';
import { setSetting } from '@/utils/settings';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Info,
  MoonStar,
  Sparkles,
  Target,
  Waves,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { ModeMeta } from '@/services/ble-contract';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Operator, 30 september 2026 ("welke iconen hebben wij gebruikt voor de
   states, zet die in het wit ipv de gekleurde bollen"): dit IS al het
   bindende icoon-per-modus-protocol — zelfde `MODE_ICONS`-map als
   bracelet-control.tsx (23 september 2026, "SF Symbols zoals
   target/moon.stars.fill"), daar ook al 1-op-1 doorgevoerd naar
   breath-welcome.tsx's `STATE_ICONS`. Bewuste duplicatie i.p.v. een
   gedeeld bestand — zelfde patroon als die twee bestanden al hanteren,
   geen nieuwe afwijking. Wit i.p.v. de modus-kleur is hier de juiste
   keuze (i.t.t. bracelet-control.tsx's mode-color-icoon): de tegel-
   badge draagt de kleur al via zijn tint-achtergrond, dus het icoon zelf
   hoeft geen tweede kleurdrager te zijn — exact hoe Apple een gekleurd
   SF-Symbol-vlak behandelt (System Settings: wit glyph, gekleurde tegel). */
const MODE_ICONS: Record<BraceletMode, typeof Zap> = {
  [BraceletMode.Gamma]: Zap,
  [BraceletMode.Beta]: Target,
  [BraceletMode.Alpha]: Waves,
  [BraceletMode.Theta]: Sparkles,
  [BraceletMode.Delta]: MoonStar,
};

const fmtTime = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};


/* Operator, 30 september 2026 ("de i in de kaarten moet terug, iconen en
   tekst groter, iconen wit, kijk naar protocol hoe alles geanimeerd moet
   worden en pas dat exact toe"): dit bestand citeert zelf al goal.tsx's
   `GoalTile` als het te volgen PRINCIPE (zie de toelichting bovenaan dit
   bestand) — dus is dat ook de bron voor de animatie/i-knop-protocol,
   1-op-1 overgenomen, niet een eigen variant verzonnen:
   - Tegel-tik: pressScale 1→0.97 (withTiming, 80ms) → terug via
     withSpring(1, {duration:220, dampingRatio:0.73}).
   - "i"-knop: vaste plek (hier rechtsboven — dit bestand legt de
     icoon+naam al linksonder, dus rechtsboven botst nergens mee),
     eigen kleinere pressScale (0.92, zelfde in/uit-timing), eigen
     geneste Pressable (RN geeft de tik aan de binnenste handler, de
     tegel-selectie zelf reageert niet mee — geen stopPropagation nodig).
   Operator, vervolg ("de i moet ook popup en volledige uitleg inclusief
   de kleurencode van de sessie tonen"): de inline uitklap-tekst (`m.blurb`
   afgekapt op 3 regels in zo'n kleine tegel) is vervangen door
   `onInfo`, die het VOLLEDIGE uitleg-scherm opent — zelfde
   infoBackdrop/infoCard-protocol als breath.tsx's "wat is deze
   toestand"-popup (eyebrow/titel/body/"Got it", accentkleur-rand). */
function ModeTile({
  m,
  Icon,
  onPress,
  onInfo,
}: {
  m: ModeMeta;
  Icon: LucideIcon;
  onPress: () => void;
  onInfo: () => void;
}) {
  const pressScale = useSharedValue(1);
  const tileStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const infoPressScale = useSharedValue(1);
  const infoPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: infoPressScale.value }],
  }));
  return (
    <AnimatedPressable
      style={[s.tile, tileStyle]}
      onPress={onPress}
      onPressIn={() => {
        pressScale.value = withTiming(0.97, { duration: 80 });
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
      <Pressable
        hitSlop={10}
        onPress={onInfo}
        onPressIn={() => {
          infoPressScale.value = withTiming(0.92, { duration: 80 });
        }}
        onPressOut={() => {
          infoPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
        }}
        style={s.tileInfoBtn}
      >
        <Animated.View style={infoPressStyle}>
          <Info size={13} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
        </Animated.View>
      </Pressable>
      <View style={s.tileIconBadge}>
        <Icon size={22} color="#ffffff" strokeWidth={2} />
      </View>
      <Text style={s.tileName} numberOfLines={2}>
        {m.name}
      </Text>
    </AnimatedPressable>
  );
}

/* Zelfde Pill-persrecept als (tabs)/bracelet.tsx's `PillPress` (de
   states-pil daar) — 1-op-1 hergebruikt i.p.v. een eigen variant, dit IS
   letterlijk een pill-keuzerij. */
function HorizonChip({
  label,
  on,
  onPress,
}: {
  label: string;
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
        scale.value = withTiming(0.97, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120 });
      }}
    >
      <Animated.View style={[s.horizonChip, on && s.horizonChipOn, pressStyle]}>
        <Text style={[s.horizonChipTxt, on && s.horizonChipTxtOn]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/* Zelfde CTA-persrecept als goal.tsx's `CtaButton` (`0.96`/80ms,
   spring-terug 220/0.73, haptic-tik op de indruk) — beide primaire
   knoppen hier ("Add to your plan"/"Save your plan") hadden nog HELEMAAL
   geen animatie, i.t.t. de rest van de app. */
function PrimaryCta({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: 1 - (1 - pressScale.value) * 2.5,
  }));
  return (
    <AnimatedPressable
      style={[s.saveBtn, disabled && s.saveBtnOff, style]}
      onPress={onPress}
      onPressIn={() => {
        pressScale.value = withTiming(0.96, { duration: 80 });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
      }}
    >
      <Text style={[s.saveBtnTxt, disabled && s.saveBtnTxtOff]}>{label}</Text>
    </AnimatedPressable>
  );
}

type DraftSession = { mode: BraceletMode; timeAt: number; durationMinutes: number };

const HORIZONS: { key: BraceletPlanHorizon; label: string }[] = [
  { key: 'today', label: 'Today only' },
  { key: '1w', label: '1 week' },
  { key: '2w', label: '2 weeks' },
  { key: '1m', label: '1 month' },
  { key: 'ongoing', label: 'Ongoing' },
];

export default function BraceletSetDayScreen() {
  const insets = useSafeAreaInsets();
  /* Operator, 30 september 2026: `?onboarding=1` (zie bracelet-control.tsx's
     redirect hierheen) — bepaalt waar `save()` hieronder naartoe navigeert
     na opslaan. Zie de toelichting daar. */
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const fromOnboarding = onboarding === '1';
  const { plan: existingPlan } = useActiveBraceletPlan();
  const [sessions, setSessions] = useState<DraftSession[]>(() => {
    const today = existingPlan?.days[existingPlan.startDayKey];
    return (
      today?.items.map((it) => ({
        mode: it.mode as BraceletMode,
        timeAt: it.reminderAt,
        durationMinutes: it.durationMinutes,
      })) ?? []
    );
  });
  const [horizon, setHorizon] = useState<BraceletPlanHorizon>(existingPlan?.horizon ?? '1w');

  /* Nieuwe sessie in opbouw — `null` = geen "add session"-scherm actief. */
  const [addingMode, setAddingMode] = useState<BraceletMode | null>(null);
  const [draftTime, setDraftTime] = useState(9 * 60);
  const [draftDuration, setDraftDuration] = useState(15);
  const [showTimePicker, setShowTimePicker] = useState(false);
  /* Operator, 30 september 2026 ("your plan mag geen opsomming worden
     maar een popup"): de groeiende lijst stond eerst altijd volledig
     uitgeklapt op de pagina — nu een korte samenvatting-rij die een
     overzicht-popup opent, zodat de pagina zelf compact blijft ook met
     veel sessies. */
  const [planPopupOpen, setPlanPopupOpen] = useState(false);
  /* "i"-knop op elke tegel — zie de toelichting bij `ModeTile`'s `onInfo`. */
  const [infoMode, setInfoMode] = useState<BraceletMode | null>(null);

  const openAdd = (mode: BraceletMode) => {
    Haptics.selectionAsync();
    setAddingMode(mode);
    setDraftTime(9 * 60);
    setDraftDuration(getModeMeta(mode).defaultMinutes);
  };

  /* Wheel-opties in stappen van 5 min over de volledige min-max-range van
     de modus — zelfde soort reeks als breath-setup.tsx's `durations`. */
  const durationOptions = useMemo(() => {
    if (addingMode === null) return [];
    const meta = getModeMeta(addingMode);
    const values: number[] = [];
    for (let m = meta.minMinutes; m <= meta.maxMinutes; m += 5) values.push(m);
    if (!values.includes(meta.defaultMinutes)) values.push(meta.defaultMinutes);
    return values.sort((a, b) => a - b).map((v) => ({ value: v, label: `${v} min` }));
  }, [addingMode]);

  /* Operator, 30 september 2026 ("mag nooit... 2 zelfde momenten kunnen
     kiezen, ook rekening houden met de duur"): het bezette blok van de
     sessie in opbouw is [draftTime, draftTime+draftDuration) — welke
     bestaande sessie (ongeacht modus) daarmee overlapt, indien geen. */
  const conflictSession = useMemo(() => {
    return sessions.find((sess) =>
      rangesOverlap(draftTime, draftDuration, sess.timeAt, sess.durationMinutes),
    );
  }, [sessions, draftTime, draftDuration]);

  const confirmAdd = () => {
    if (addingMode === null || conflictSession) return;
    if (sessions.length >= MAX_BRACELET_SESSIONS) {
      setAddingMode(null);
      return;
    }
    setSessions((prev) =>
      [...prev, { mode: addingMode, timeAt: draftTime, durationMinutes: draftDuration }].sort(
        (a, b) => a.timeAt - b.timeAt,
      ),
    );
    setAddingMode(null);
  };

  const removeSession = (index: number) => {
    Haptics.selectionAsync();
    setSessions((prev) => prev.filter((_, i) => i !== index));
  };

  /* Operator, 30 september 2026 ("na Set your plan land ik op de
     Bracelet-tab se welkomstscherm, is dat correct gedrag?"): nee —
     bracelet-control.tsx bereikte dit scherm via `router.replace`, dus
     zonder `fromOnboarding` zou `router.back()` hier door die lege plek
     heen springen naar de Bracelet-TAB, waar de intro-overlay bij elke
     focus terugkomt (zie de toelichting bij bracelet-control.tsx's
     redirect).
     Operator, vervolg ("teruggaan naar connected ook niet juist, ik heb
     al connect gedaan vóór de instelling van planning"): eerste poging
     stuurde VOORUIT naar `/bracelet-control` — ook fout, want de
     gebruiker had dat verbind-scherm al gezien en afgehandeld vóórdat
     hij hier binnenkwam; nog eens tonen voelt als een stap terugzetten,
     niet vooruit. De echte "volgende stap" na "verbinden + plan bouwen"
     is het net-opgeslagen PLAN zelf bekijken — dus naar
     `/bracelet-agenda`. Buiten onboarding (Activity/agenda-edit) blijft
     `back()` correct: dan kwam de gebruiker via een gewone push. */
  const finish = () => {
    if (fromOnboarding) router.replace('/bracelet-agenda' as never);
    else router.back();
  };

  const save = async () => {
    if (sessions.length === 0) {
      await saveActiveBraceletPlan(null);
      await syncBraceletPlanReminder(null);
      /* Ook bij "geen sessies" (skip) telt dit als de onboarding-stap
         doorlopen — anders blijft de gebruiker bij elke volgende
         connectie hierheen teruggestuurd. */
      await setSetting('braceletOnboardingCompletedAt', Date.now());
      finish();
      return;
    }
    const template = sessions.map((s) => ({
      mode: s.mode as number,
      durationMinutes: s.durationMinutes,
      reminderAt: s.timeAt,
    }));
    const plan = buildBraceletPlanFromTemplate(horizon, new Date(), template);
    await saveActiveBraceletPlan(plan);
    await syncBraceletPlanReminder(plan);
    /* Operator, 29 september 2026 ("na connect, soort onboarding"): pas
       hier als echt opgeslagen is — niet al bij het openen van dit
       scherm — anders zou terugnavigeren zonder op te slaan de
       onboarding-stap stilzwijgend als "gedaan" markeren. */
    await setSetting('braceletOnboardingCompletedAt', Date.now());
    finish();
  };

  const addingMeta = addingMode !== null ? getModeMeta(addingMode) : null;
  const infoModeMeta = infoMode !== null ? getModeMeta(infoMode) : null;

  /* ── "Add session"-scherm — eigen volledig scherm i.p.v. Modal, zie de
     toelichting bovenaan dit bestand. ────────────────────────────────── */
  if (addingMeta) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.bar}>
          <Pressable onPress={() => setAddingMode(null)} hitSlop={12} style={s.back}>
            {/* Operator, 1 okt 2026 ("headers overal consistent"): pijl-
               specificatie (size 20, strokeWidth 2.8) — de "officiële
               iOS-chevron.backward"-stijl uit build-choice.tsx (18 sept),
               nu de app-brede standaard. */}
            <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: Math.max(insets.bottom, 14) + 96 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[s.sectionLabel, { textAlign: 'center' }]}>DURATION</Text>
          <View style={s.ringWrap}>
            <DurationRing
              min={addingMeta.minMinutes}
              max={addingMeta.maxMinutes}
              value={draftDuration}
              color={addingMeta.color}
              label={addingMeta.name}
              size={190}
              dark
            />
          </View>
          {/* Vaste 266px-breedte — exact zoals bracelet-control.tsx, de
             pil/"Recommended"-positionering binnen DurationWheel is
             daarop afgestemd. Buiten die breedte (bv. de volle-breedte
             sheet van hiervoor) staat de pil te breed en overlapt het
             label. */}
          <View style={s.wheelOuter}>
            <DurationWheel
              options={durationOptions}
              value={draftDuration}
              onChange={setDraftDuration}
              accent={addingMeta.color}
              trackColor="rgba(255,255,255,0.4)"
              recommendedValue={addingMeta.defaultMinutes}
            />
          </View>

          <Text style={[s.sectionLabel, { marginTop: 28 }]}>STARTS AT</Text>
          <Pressable style={s.timeRow} onPress={() => setShowTimePicker(true)}>
            <Text style={s.timeValue}>{fmtTime(draftTime)}</Text>
          </Pressable>
          {showTimePicker && (
            <DateTimePicker
              value={(() => {
                const d = new Date();
                d.setHours(Math.floor(draftTime / 60), draftTime % 60, 0, 0);
                return d;
              })()}
              mode="time"
              display="spinner"
              onChange={(_, date) => {
                if (Platform.OS === 'android') setShowTimePicker(false);
                if (date) setDraftTime(date.getHours() * 60 + date.getMinutes());
              }}
            />
          )}

          {/* Operator, 30 september 2026 ("mag nooit aparte states en 2
             zelfde momenten kunnen kiezen, ook rekening houden met de
             duur"): zichtbaar zodra het gekozen tijdstip+duur een
             bestaande sessie raakt — de "Add to your plan"-knop hieronder
             is dan uitgeschakeld, dus dit IS de enige plek waar het kan
             stuklopen; huisstijl `Brand.error` (#ef4444), niet zelf een
             kleur verzonnen. */}
          {conflictSession && (
            <Text style={s.conflictTxt}>
              Overlaps with {getModeMeta(conflictSession.mode).name} at{' '}
              {fmtTime(conflictSession.timeAt)}–
              {fmtTime(conflictSession.timeAt + conflictSession.durationMinutes)}. Choose a
              different time.
            </Text>
          )}
        </ScrollView>

        <View style={[s.ctaFloat, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
          {/* Operator, huisstijl (theme.ts, CTA v4.4): op een donkere
             achtergrond is de CTA altijd wit + donkere tekst — nooit de
             accentkleur als knop-achtergrond (dat was hier de bug, zie
             `feedback-signal-blue-never-cta`-regel). */}
          <PrimaryCta
            label="Add to your plan"
            disabled={!!conflictSession}
            onPress={confirmAdd}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Operator, 1 okt 2026 ("headers overal consistent, zoals Apple"):
         3-zone gecentreerde balk i.p.v. inline-links titel — zelfde
         opzet + pijl-specificatie (size 22, strokeWidth 2.4) als overal
         elders in de app. */}
      <View style={s.bar}>
        <Pressable onPress={finish} hitSlop={12} style={s.back}>
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </Pressable>
        <Text style={s.barTitle} numberOfLines={1}>
          Set your plan
        </Text>
        <View style={s.back} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: Math.max(insets.bottom, 14) + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Operator, 30 september 2026 ("tekst is te lang, lijkt een info
           sectie, hoe doet apple dit"): 1 korte regel i.p.v. een alinea. */}
        <Text style={s.lead}>Choose your states, then how often.</Text>

        {/* Operator, 30 september 2026 ("5 verikante kaarten transparant
           blur tekst en iconen links"): echte `BlurView`-matglas-tegels
           i.p.v. gekleurde-tint-vlakken — zelfde recept als (tabs)/
           activity.tsx's `SquareCard`/goal.tsx's `GoalTile`, icoon+naam
           links-onder i.p.v. gecentreerd. */}
        <View style={s.grid}>
          {MODES.map((m) => (
            <ModeTile
              key={m.mode}
              m={m}
              Icon={MODE_ICONS[m.mode]}
              onPress={() => openAdd(m.mode)}
              onInfo={() => setInfoMode(m.mode)}
            />
          ))}
        </View>

        {/* Operator: "recommended aantal sessies" — puur informatief, geen
           berekend cijfer (bracelet heeft geen doelen-systeem zoals
           breathwork om dat op te baseren). */}
        <Text style={s.recommended}>Most people do 1–3 sessions a day.</Text>

        {/* Operator, 30 september 2026 ("how long moet direct onder de
           kaarten komen"): horizon nu meteen na de tegels — herhaalt de
           dag-template hierboven over de gekozen periode (zelfde principe
           als protocol.ts's `buildPlanFromTemplate` voor breathwork). */}
        <Text style={s.sectionLabel}>HOW LONG</Text>
        <View style={s.horizonRow}>
          {HORIZONS.map((h) => (
            <HorizonChip
              key={h.key}
              label={h.label}
              on={h.key === horizon}
              onPress={() => {
                Haptics.selectionAsync();
                setHorizon(h.key);
              }}
            />
          ))}
        </View>

        {/* Operator: "your plan mag geen opsomming worden maar een
           popup" — samenvattingsrij i.p.v. de volledige lijst altijd
           uitgeklapt; tikken opent het overzicht hieronder. */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>YOUR PLAN</Text>
        <Pressable
          style={s.planSummaryRow}
          onPress={() => sessions.length > 0 && setPlanPopupOpen(true)}
        >
          <Text style={s.planSummaryTxt}>
            {sessions.length === 0
              ? 'No sessions yet — tap a state above to add one.'
              : `${sessions.length} session${sessions.length === 1 ? '' : 's'} planned`}
          </Text>
          {sessions.length > 0 && (
            <ChevronRight size={16} color="rgba(255,255,255,0.4)" strokeWidth={2.4} />
          )}
        </Pressable>
      </ScrollView>

      <View style={[s.ctaFloat, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
        <PrimaryCta
          label="Save your plan"
          disabled={sessions.length === 0}
          onPress={() => void save()}
        />
      </View>

      {/* "Your plan"-popup — overzicht + verwijderen, zie de toelichting
         hierboven bij `planPopupOpen`. */}
      <Modal
        visible={planPopupOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPlanPopupOpen(false)}
      >
        <Pressable style={s.pickBackdrop} onPress={() => setPlanPopupOpen(false)}>
          <Pressable
            style={[s.pickSheet, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}
            onPress={() => {}}
          >
            <View style={s.pickHandle} />
            <Text style={s.pickTitle}>Your plan</Text>
            <ScrollView style={{ width: '100%', maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {sessions.map((sess, i) => {
                const meta = getModeMeta(sess.mode);
                const ModeIcon = MODE_ICONS[sess.mode];
                return (
                  <View key={i} style={s.sessionRow}>
                    <View style={s.sessionIconBadge}>
                      <ModeIcon size={18} color="#ffffff" strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.sessionTitle}>{meta.name}</Text>
                      <Text style={s.sessionSub}>
                        {fmtTime(sess.timeAt)} · {sess.durationMinutes} min
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        removeSession(i);
                        if (sessions.length <= 1) setPlanPopupOpen(false);
                      }}
                      hitSlop={10}
                    >
                      <X size={16} color="rgba(255,255,255,0.4)" strokeWidth={2.4} />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Operator, 30 september 2026 ("de i moet ook popup en volledige
         uitleg inclusief de kleurencode van de sessie tonen"): zelfde
         infoBackdrop/infoCard-protocol als breath.tsx's "wat is deze
         toestand"-popup (eyebrow/titel/body/accentkleur-rand/"Got it") —
         hier zonder de RHYTHMS-lijst (die bestaat niet voor de bracelet),
         met een kleurcode-rij erbij i.p.v. Voor de dit bestand nog geen
         voluit-uitgeklapte modus-uitleg had. */}
      {infoModeMeta && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setInfoMode(null)}
        >
          <Pressable style={s.infoBackdrop} onPress={() => setInfoMode(null)}>
            <Pressable style={s.infoCard} onPress={() => {}}>
              <View style={[s.infoIconBadge, { backgroundColor: `${infoModeMeta.color}22` }]}>
                {(() => {
                  const InfoIcon = MODE_ICONS[infoModeMeta.mode];
                  return <InfoIcon size={22} color="#ffffff" strokeWidth={2} />;
                })()}
              </View>
              <Text style={s.infoTitle}>{infoModeMeta.name}</Text>
              <Text style={s.infoBody}>{infoModeMeta.blurb}</Text>

              <View style={s.infoColorRow}>
                <View style={[s.infoColorSwatch, { backgroundColor: infoModeMeta.color }]} />
                <Text style={s.infoColorTxt}>{infoModeMeta.color.toUpperCase()}</Text>
              </View>

              <Pressable
                style={[s.infoBtn, { borderColor: infoModeMeta.color }]}
                onPress={() => setInfoMode(null)}
              >
                <Text style={[s.infoBtnTxt, { color: infoModeMeta.color }]}>Got it</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  /* Operator, 30 september 2026 ("set your plan mag naast de bovenste
     pijl beginnen zodat er meer ruimte is voor grotere kaarten"): de
     paginatitel stond hieronder als losse `pageHeader` (30px) met eigen
     marge — nu inline in de terug-balk, zelfde plek/rol als `history.tsx`'s
     `topbarTitle` (bold/22/-0.3, flex:1, marginLeft:4 naast de chevron).
     Scheelt een hele kop + z'n marge-ruimte, direct ten gunste van de
     tegel-grid eronder. */
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  barTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: '#ffffff',
  },
  scroll: { paddingHorizontal: 20 },
  lead: { marginTop: 4, marginBottom: 20, ...TypeScale.pageSubhead, color: 'rgba(255,255,255,0.5)' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  /* Operator, 30 september 2026 ("5 verikante kaarten transparant blur
     tekst en iconen links"): echte `BlurView`-matglas i.p.v. een
     gekleurde-tint-vlak — zelfde recept als (tabs)/activity.tsx's
     `SquareCard`/goal.tsx's `GoalTile`.
     Vervolg, zelfde dag ("meer ruimte voor grotere kaarten" — na de
     titel-verhuis naar de balk hierboven — "tekst mooi links uitgelijnd"):
     `alignItems:'flex-start'` expliciet i.p.v. op de impliciete
     stretch-default te vertrouwen, en de tegel zelf iets hoger
     (`aspectRatio` losgelaten voor een vaste `minHeight`) nu er meer
     verticale ruimte is. */
  /* Operator, 30 september 2026 ("boost en sharp focus moeten op
     dezelfde hoogte beginnen als de andere kaarten"): `flex-end` liet
     het icoon+naam-blok BINNEN de tegel zakken/stijgen afhankelijk van
     hoeveel regels de naam nodig had — "Boost"/"Sleep" (1 regel) begonnen
     zo lager dan "Sharp Focus"/"Calm Control"/"Clarity & Relax" (2
     regels). `flex-start` zet het icoon altijd op dezelfde starthoogte;
     een langere naam duwt nu enkel de ONDERkant van de tegel verder uit
     (binnen `minHeight`), niet de startpositie. */
  tile: {
    width: '31%',
    minHeight: 128,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    padding: 12,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  /* Operator, 30 september 2026 ("geen kleur in iconen, alles wit" — de
     per-modus kleur-tint achter elke badge oogde "rommelig" met 5
     verschillende kleuren + een wit icoon + een i-knop in zo'n kleine
     tegel): geen gekleurde vulling meer. Zelfde stap als goal.tsx's
     `tileIconBadge` uiteindelijk zette ("geen rand/vulling meer... het
     icoon staat nu kaal op de kaart") — hier een héél lichte neutrale
     achtergrond (niet volledig kaal, dit grid heeft geen matglas-vrije
     ondergrond zoals goal.tsx's aurora-achtergrond) i.p.v. 5 losse
     kleuren, dus één rustig, consistent beeld over alle tegels. */
  tileIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  /* `cardHeadline` i.p.v. het eerdere `cardEyebrow` (10.5px, bedoeld voor
     een klein bijschrift, niet een tegel-titel) — exact de rol die
     TypeScale's eigen toelichting aanwijst voor "het enige tekstlabel op
     een kleinere tegel", en wat goal.tsx's `tileName` ook gebruikt.
     `textAlign:'left'` + `alignSelf:'stretch'` (i.p.v. impliciet op de
     tegel se stretch-default vertrouwen) houdt de tekst links uitgelijnd
     ook zodra hij naar 2 regels wrapt. */
  tileName: {
    ...TypeScale.cardHeadline,
    fontSize: 15.5,
    lineHeight: 18,
    color: '#ffffff',
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  /* "i"-knop + info-tekst — 1-op-1 goal.tsx's `tileInfoBtn`/`tileHint`,
     enkel rechtsboven i.p.v. linksboven (dit grid legt icoon+naam al
     linksonder, dus links zou tegen de naam aan botsen zodra die naar
     2 regels wrapt). */
  tileInfoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 1,
  },
  recommended: {
    marginTop: 14,
    marginBottom: 26,
    ...TypeScale.cardDetail,
    color: 'rgba(255,255,255,0.4)',
  },

  sectionLabel: {
    ...TypeScale.cardEyebrow,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 10,
  },
  emptyTxt: {
    ...TypeScale.cardDetail,
    color: 'rgba(255,255,255,0.4)',
  },
  /* Operator, 30 september 2026 ("kaarten moeten ook apple stijl"): zelfde
     icoon-badge + `compactCardTitle`/`cardDetail`-taal als (tabs)/
     activity.tsx's `Row` (large-variant) — niet zomaar dunne randjes. */
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  /* Zelfde "geen kleur, alles wit"-keuze als `tileIconBadge` hierboven —
     dit is dezelfde modus-iconen-set, dus dezelfde neutrale behandeling. */
  sessionIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sessionTitle: { ...TypeScale.compactCardTitle, color: '#ffffff' },
  sessionSub: { marginTop: 2, ...TypeScale.cardDetail, color: 'rgba(255,255,255,0.5)' },

  horizonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  horizonChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  /* Operator, 30 september 2026 ("de gemaakte selectie een lichte
     omlijning geven, gebroken wit of grijs, wat we bij breathwork ook al
     gebruiken"): eerste poging hield de Bio-Teal-tint als achtergrond —
     terecht afgekeurd, de breathwork-referentie (breath-setup.tsx's
     `indicator`) is zelf ook volledig neutraal: `rgba(255,255,255,0.13)`
     vulling + `rgba(255,255,255,0.3)`-rand, geen accentkleur. 1-op-1
     overgenomen, geen eigen kleur-variant. */
  horizonChipOn: { borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.13)' },
  horizonChipTxt: { fontFamily: BrandFonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  horizonChipTxtOn: { color: '#ffffff', fontFamily: BrandFonts.semibold },

  ctaFloat: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10 },
  /* Huisstijl CTA v4.4 (theme.ts): donkere achtergrond → witte knop +
     donkere tekst. Nooit de accentkleur als knop-achtergrond. */
  saveBtn: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  saveBtnOff: { backgroundColor: 'rgba(255,255,255,0.15)' },
  saveBtnTxt: { fontFamily: BrandFonts.bold, fontSize: 15, color: '#1D1D1F' },
  saveBtnTxtOff: { color: 'rgba(255,255,255,0.4)' },

  ringWrap: { alignItems: 'center', marginTop: 8, marginBottom: 22 },
  wheelOuter: { width: 266, alignSelf: 'center', marginBottom: 8 },

  timeRow: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  timeValue: { fontFamily: BrandFonts.bold, fontSize: 20, color: '#ffffff' },
  /* Huisstijl `Brand.error` (#ef4444, CLAUDE.md §7) — geen eigen kleur. */
  conflictTxt: {
    marginTop: 12,
    ...TypeScale.cardDetail,
    fontSize: 13,
    lineHeight: 18,
    color: Brand.error,
  },

  /* "Your plan"-samenvattingsrij + popup — zie de toelichting bij
     `planPopupOpen`. */
  planSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  planSummaryTxt: { ...TypeScale.cardDetail, color: 'rgba(255,255,255,0.75)' },

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
  pickHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  pickTitle: {
    alignSelf: 'flex-start',
    marginBottom: 14,
    fontFamily: BrandFonts.bold,
    fontSize: 17,
    color: '#ffffff',
  },

  /* "i"-uitleg-popup — 1-op-1 breath.tsx's infoBackdrop/infoCard-protocol
     (rgba(0,0,0,0.8) backdrop, kaart #161616, rand rgba(255,255,255,0.12),
     radius 22, padding 22, accentkleur-rand op "Got it"). Zonder de
     RHYTHMS-lijst (bestaat niet voor de bracelet); met een kleurcode-rij
     i.p.v. — operator: "volledige uitleg inclusief de kleurencode". */
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  infoCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 22,
  },
  infoIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  infoTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: '#ffffff',
  },
  infoBody: {
    marginTop: 10,
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.6)',
  },
  infoColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  infoColorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  infoColorTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.6)',
  },
  infoBtn: {
    marginTop: 22,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnTxt: { fontFamily: BrandFonts.semibold, fontSize: 13, letterSpacing: 0.8 },
});
