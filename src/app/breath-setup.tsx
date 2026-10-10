/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Session setup (donker, premium)

   Operator, 7 september 2026, na uitgebreide productkritiek op het
   toestand-keuzescherm ((tabs)/breath.tsx): "je huidige selectiepagina
   heeft te veel informatie... wat moet deze gebruiker daadwerkelijk kiezen
   om te kunnen starten? Antwoord: modus, breathing rhythm, duration. De
   rest kan secundair."

   Operator, 8 september 2026: een nieuwe, volledig DONKERE mockup — met een
   grote gloeiende ademende bol i.p.v. losse kaarten/bolletjes — werd
   expliciet bevestigd als vervanging van de eerdere lichte versie van dit
   scherm ("breath-setup.tsx zelf, van licht naar donker"). Dit keert de
   eerder afgesproken "Discovery/Setup: LICHT, Experience: DONKER"-opbouw
   dus bewust om, op uitdrukkelijk operator-verzoek.

   Dit scherm zit nog altijd tussen (tabs)/breath.tsx (kies een toestand) en
   breath-session.tsx (de echte ademsessie) in. Het verzamelt ritme + duur
   en stuurt daarna door met `autostart=1` — breath-session.tsx start dan
   meteen, zonder zijn EIGEN (uitgebreidere) keuze-UI nog te tonen.

   BEWUST NIET aangepast: breath-session.tsx zelf. Plan.tsx, agenda.tsx, de
   onboarding (breath-welcome.tsx) en de paywall linken nog steeds
   RECHTSTREEKS naar breath-session.tsx — die kennen de duur al (vanuit een
   opgeslagen protocol) en hebben dit tussenscherm niet nodig. Enkel de
   Breath-tab se CONTINUE-knop (na het kiezen van een toestand) wijst naar
   hier. Zo blijft alle bestaande, uitgebreid geteste logica (audio,
   haptiek, batterij-uitzondering, paywall, gratis-sessie-gate) in
   breath-session.tsx volledig intact — dit scherm voegt enkel een rustiger
   voorportaal toe voor die ene ingang.
   ───────────────────────────────────────────────────────────────────────── */

import { GlassSheet } from '@/components/GlassSheetHost';
import { rootBlurRef } from '@/utils/root-blur';
import VibezGlass from '@/components/VibezGlass';
import { BrandFonts, CTA } from '@/constants/theme';
import AddToDayHero from '@/components/AddToDayHero';
/* Operator, 19 september 2026 ("ja doen" — echte glas-blur i.p.v. de
   rgba-truc): `expo-blur` zit al in de huidige native build (welcome.tsx
   gebruikt 'm al voor de pil-knoppen), dus geen nieuwe `expo run:android`
   nodig voor deze ene kaart. */
import { BlurView } from 'expo-blur';
import { STATE_PHOTOS } from '@/services/offline-assets';
import { assetUri } from '@/services/asset-cache';
import DurationSlider from '@/components/DurationSlider';
import { DurationWheel } from '@/components/DurationWheel';
import { confirmVibezAlert } from '@/components/VibezAlert';
import { BREATH_STATES, roundsFor, type BreathStateKey, type TechniqueDef, type DurationDef } from '@/data/breath-states';
import {
  claimFreeSessionParam,
  skipBreathIntroOnce,
} from '@/utils/breath-entry';
import { useSubscription } from '@/hooks/useSubscription';
import { getSetting, setSetting, useSetting } from '@/utils/settings';
import { useBreathHistory } from '@/utils/breath-history';
import {
  levelForTechnique,
  levelSeenKey,
  recommendedForLevel,
  techniqueForLevel,
} from '@/utils/breath-level';
import { isLightColor } from '@/utils/color';
import { DAY_CANDIDATES, SLOT_WINDOW } from '@/utils/day-plan';
import { HORIZON_OPTIONS } from '@/data/plan-horizon-options';
import { setDraftSession } from '@/utils/day-builder-draft';
import type { PlanHorizon, PlanSlot } from '@/utils/plan-store';
import { preloadBreathCues } from '@/services/breath-voice';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { openBreathSession } from '@/services/breath-session-host';
import {
  AlertTriangle,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  RotateCcw,
  Timer,
} from 'lucide-react-native';
import {
  techniqueDecisionLine,
  techniqueHook,
  techniqueIcon,
  techniquePattern,
} from '@/utils/technique-copy';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  Image,
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
/* Operator, 24 september 2026 ("moet meer marge links/rechts... belangrijk
   dat de app op alle schermen correcte weergave heeft"): was een vaste
   30px — op een smal toestel eet dat verhoudingsgewijs weinig ruimte weg
   (nauwelijks zichtbaar verschil, exact de klacht), op een breed toestel
   juist te weinig. Verhouding van `SCREEN_W` i.p.v. een vaste waarde, met
   een ondergrens zodat het op een heel smal toestel niet te krap wordt. */
const CARD_MARGIN_H = Math.max(30, Math.round(SCREEN_W * 0.09));

/* Zelfde sentence-case-transform als (tabs)/breath.tsx — puur weergave, de
   data (`eyebrow`, ALL CAPS) blijft overal elders ongewijzigd. */
const sentenceCase = (v: string) =>
  v
    .toLowerCase()
    .split(' ')
    .map((w) => (w === '&' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

/* Operator, 7 september 2026: twee mockups op rij tonen "Sharp Focus"
   i.p.v. "Focus" — dezelfde naam als de bracelet's Beta-modus in
   CLAUDE.md §5. Puur een WEERGAVE-override op dit scherm (en het
   sessiescherm, waar dezelfde mockup 'm ook toont) — `breath-states.ts`
   se `eyebrow: 'FOCUS'` blijft ongewijzigd voor elke andere plek
   (Agenda, Plan, Activity, paywall...) die dat veld leest. */
const DISPLAY_NAME: Partial<Record<string, string>> = {
  FOCUS: 'Sharp Focus',
};
const displayName = (eyebrow: string) =>
  DISPLAY_NAME[eyebrow] ?? sentenceCase(eyebrow);

/* Zelfde BLE-contract-volgorde als overal elders (ORDER_MODES in
   activity.tsx, STATE_ORDER in build-your-day.tsx) — enkel gebruikt door
   de nieuwe addToDay-staat-kiezer hieronder. */
const STATE_ORDER: BreathStateKey[] = ['boost', 'focus', 'calm', 'clarity', 'rest'];

/* Operator, 18 september 2026 ("alles moet op een standaard uur staan om
   te beginnen bv. morning 7u"): een "typisch" tijdstip per dagdeel (in
   minuten sinds middernacht) als standaardwaarde voor de nieuwe
   Time-kiezer — losstaand van `SLOT_WINDOW` (dat is het TOEGESTANE
   bereik, niet een goed startpunt: het venster begint bv. om 4u voor
   morning, niemand plant daar realistisch een sessie op). */
const SLOT_DEFAULT_TIME: Record<string, number> = {
  morning: 7 * 60,
  midday: 13 * 60,
  afterWork: 18 * 60,
  evening: 21 * 60,
};

/* Operator, 18 september 2026 ("kan je de foto in cirkel vervangen?"): één
   vaste foto voor de ring, ongeacht dagdeel — dit is het "een sessie
   samenstellen"-moment zelf, geen dagdeel-illustratie (die blijven wél
   per-dagdeel op build-your-day.tsx/plan-review.tsx, `DAYPART_PHOTO`). */
/* Operator, 18 september 2026 ("VERVANG JE FOTO" — moest de BESTAANDE
   ring-foto vervangen, niet een nieuwe plek): 2e versie van deze foto. */
const ADD_HERO_PHOTO =
  'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20choose%20state%20breathwork%202%20png.png';

/* Operator, 18 september 2026, herzien ("ik voeg nu morning toe maar tijd
   staat bv 23.30u, dat klopt niet — kunnen we bij tijdsindeling v morning
   ook effectief tijd zetten tussen bv 5u en welk uur nog morning is"):
   TERUG naar het venster van het gekozen dagdeel (`SLOT_WINDOW`) i.p.v.
   de volledige 24u van de vorige ronde — een sessie die je toevoegt onder
   "morning" hoort ook een ochtenduur te tonen/toe te laten, niet 23:30u.
   `slotForTime` (hieronder in `BreathSetupScreen`) bepaalt welk venster. */
/* Operator, 18 september 2026 ("time zou ik per kwartier instellen, niet
   per half uur"): 15 min-stappen i.p.v. 30 — 4 opties per uur i.p.v. 2. */
function timeOptionsForSlot(slot: PlanSlot): number[] {
  const window = SLOT_WINDOW[slot];
  const out: number[] = [];
  for (let h = window.from; h < window.to; h += 1) {
    out.push(h * 60, h * 60 + 15, h * 60 + 30, h * 60 + 45);
  }
  return out;
}

/* Operator, 7 september 2026: "session duration wil ik geanimeerd, iets
   met cirkel" — elke duur-optie is een cirkel. Een dunne ring vult mee met
   hoeveel deze duur weegt t.o.v. de langste optie (bv. 20 min = volle ring,
   3 min = een kwart) en animeert vloeiend in wanneer je 'm selecteert, plus
   een subtiele "pop"-schaal voor tactiele feedback. */
const RING_SIZE = 60;
/* Operator, 9 september 2026: "de cirkels van de minuten zijn nog altijd
   te dik" — was 3.5.
   Operator, 10 september 2026: "moeten ook een smallere lijn hebben" —
   2.5 → 1.5, zelfde verdunningsslag als de grote hero-ring (HERO_STROKE). */
const RING_STROKE = 1.5;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);
/* Standaard druk-vering-recept (zie StartCard in breath-welcome.tsx) — hier
   op module-niveau want dit bestand heeft tientallen Pressables die allemaal
   dezelfde tactiele feedback nodig hebben. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/* Operator, 9 september 2026: "die rechthoekige kaart in cirkel veranderen
   en hoger zetten" — de rechthoekige samenvattingskaart is vervangen door
   deze grote cirkel, hoger op het scherm. Zelfde ring-vul-taal als de
   kleine duur-cirkels hierboven (RING_SIZE/RING_C), nu op schaal van het
   scherm: de ring vult voor de helft zodra techniek OF duur gekozen is, en
   helemaal zodra beide gekozen zijn — een Oura/Whoop-achtige "voortgangs-
   ring", herkenbaar premium taal voor een wellness-app in plaats van een
   platte lijst in een rechthoek. */
/* Operator, 10 okt 2026 (consistentie met State Control: "cirkel groter"):
   zo groot als dit scherm toelaat (was 0,58 × breedte, max 230). */
/* Vervolg: techniekbalk en duurwiel zijn weg → zelfde maat als State
   Control (304), de ruimte is er nu. */
const HERO_SIZE = Math.min(Math.round(SCREEN_W * 0.845), 304);
/* Operator, 9 september 2026: "de glow is niet goed te aanwezig... ik had
   de glow niet gevraagd" — de radiale gloed-cirkel achter de ring is
   weer weg. "Meer subtiele ring, nog dunner, moet elegant": 6 → 4 → 3.
   Operator, 10 september 2026: "cirkellijn nog dunner, moet echt elegant
   tonen" — 3 → 2. */
const HERO_STROKE = 2;
const HERO_R = (HERO_SIZE - HERO_STROKE) / 2;
const HERO_C = 2 * Math.PI * HERO_R;

/* Operator, 9 september 2026: "kan jij bv onderkant binnenkant van de ring
   soort golfbewegingen maken?" — een "vloeistof"-effect ín de ring, zoals
   de referentiemockup: twee golf-lagen (verschillende snelheid/hoogte/
   dekking, voor diepte) die oneindig naar links door de cirkel schuiven,
   geclipt tot een cirkel via een gewone View met `overflow:'hidden'` +
   `borderRadius` (betrouwbaarder cross-platform dan een SVG clipPath).
   `WAVE_D` is de doorsnede van die geclipte cirkel, iets kleiner dan de
   ring zelf zodat de golven niet ONDER de ringlijn uitsteken. Elke laag
   tekent exact twee golfperiodes over een breedte van `2×WAVE_D` en
   schuift precies één periode (`-WAVE_D`) op — daardoor is de lus naadloos:
   op het punt waar hij "terugspringt" naar 0 staat het patroon er al
   identiek bij. */
const WAVE_D = HERO_SIZE - HERO_STROKE * 3;
const WAVE_INSET = (HERO_SIZE - WAVE_D) / 2;
const buildWavePath = (period: number, height: number, baseY: number, amp: number) =>
  `M0 ${baseY}
   C ${period * 0.25} ${baseY - amp}, ${period * 0.25} ${baseY + amp}, ${period * 0.5} ${baseY}
   C ${period * 0.75} ${baseY - amp}, ${period * 0.75} ${baseY + amp}, ${period} ${baseY}
   C ${period * 1.25} ${baseY - amp}, ${period * 1.25} ${baseY + amp}, ${period * 1.5} ${baseY}
   C ${period * 1.75} ${baseY - amp}, ${period * 1.75} ${baseY + amp}, ${period * 2} ${baseY}
   L ${period * 2} ${height} L 0 ${height} Z`;
/* Operator, 9 september 2026: "bij hogere minuten stijgt waterlijn?" — ja:
   de basislijn van de golven (`waterlineY` in de component) schuift mee
   met de gekozen duur t.o.v. de kortst/langst beschikbare optie voor de
   huidige techniek, dus dit is GEEN vaste module-constante meer maar
   wordt per render herberekend. `buildWavePath` blijft wel een pure
   functie op moduleniveau. */

/** "4s inhale · 4s hold · 4s exhale · 4s hold" — leesbare vertaling van
 *  `phases` (secs + label), zoals de referentiemockup ("5s inhale · 5s
 *  exhale") i.p.v. het compacte cijferpatroon (`patternOf`, "4-4-4-4")
 *  dat elders in de app blijft (duur-badges, sessiescherm). */
const readablePattern = (phases: { secs: number; label: string }[]) =>
  phases.map((p) => `${p.secs}s ${p.label.toLowerCase()}`).join(' · ');

const fmtClock = (minutes: number) => {
  const totalSecs = Math.round(minutes * 60);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/* Operator, 2 okt 2026 ("app-breed" bevestigd): de gedeelde `experienceLevel`-
   instelling (ook gelezen door protocol.ts/intensity.tsx/plan-review.tsx,
   en bijgesteld door de "How do you feel?"-feedback in breath-session.tsx)
   bepaalt nu ook de standaard-techniek hier — dit scherm las die instelling
   voorheen nergens, en startte dus altijd op Beginner (index 0), ongeacht
   wat de gebruiker elders al had aangegeven. `null` valt terug op Beginner,
   zelfde conventie als de rest van de app (protocol.ts) — enkel het
   instant-pad (utils/instant-feel.ts) wijkt daar bewust van af. */
function defaultTechIdxFromExperience(maxIdx: number): number {
  const level = getSetting('experienceLevel');
  const idx = level === 'advanced' ? 2 : level === 'intermediate' ? 1 : 0;
  return Math.min(idx, maxIdx);
}

/* Operator, 10 september 2026: "custom is bedoeld om meer min in te kunnen
   stellen dan de max op de bestaande knoppen" — daarna: "kijk eerst overal
   online na wetenschappelijk, breathwork coaches etc, zodat alles wat we
   doen correct is". Onderzocht (bronnen: Cymbiotika/Othership over Box
   Breathing + CO2-tolerantie, Stanford/Balban 2023 cyclic-sighing-dosering,
   yoga-bronnen over Ujjayi-sessieduur, meta-analyses over coherent/
   resonance-breathing-sessielengte — zie chatgeschiedenis 10 september
   2026 voor de volledige bronnenlijst). Uitkomst: bronnen noemen voor
   rustige, hold-vrije technieken 20-30 min als bovengrens voor ervaren
   beoefenaars — nergens hoger, dus 30 min i.p.v. een ongefundeerd hoger
   getal. Voor de vijf hieronder GEEN verruiming: elk heeft een expliciete,
   bronvermelde reden om NIET verder te gaan dan de al bestaande max
   (zie hun eigen `safetyNote`/toelichting in `data/breath-states.ts`). */
/* Operator, 11 september 2026: "session duration ook naar light theme" —
   zelfde patroon als breath-welcome.tsx: één `light`-schakelaar, de
   donkere kleuren blijven gewoon ernaast bewaard (`DARK`) zodat
   terugschakelen later geen herbouw is, enkel deze ene boolean. Lichte
   waarden hergebruiken de al vastgelegde tokens uit de onboarding
   (`#8E8E93`/grijze subtekst, `LIGHT_BLUE` #7FB2E5 accent) i.p.v. iets
   nieuws te verzinnen. */
/* Operator, 26 september 2026: dark is de nieuwe app-brede default (was
   light, 14 september) — zelfde hardcoded-schakelaar-patroon, enkel de
   waarde omgezet. */
const light = false;
const LIGHT_BLUE = '#7FB2E5';
const DARK = {
  bg: '#0a0a0a',
  iconBtnBg: 'rgba(255,255,255,0.1)',
  text: '#ffffff',
  textDim40: 'rgba(255,255,255,0.4)',
  textDim45: 'rgba(255,255,255,0.45)',
  textDim50: 'rgba(255,255,255,0.5)',
  textDim55: 'rgba(255,255,255,0.55)',
  textDim65: 'rgba(255,255,255,0.65)',
  textDim75: 'rgba(255,255,255,0.75)',
  heroRingTrack: 'rgba(255,255,255,0.10)',
  dialRingTrack: 'rgba(255,255,255,0.14)',
  glassBg: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.15)',
  shineMid: '#EAF2FF99',
  ctaBg: '#ffffff',
  ctaBorder: '#D2D2D7',
  ctaText: '#1D1D1F',
  ctaRipple: 'rgba(0,0,0,0.12)',
  modalBg: '#161616',
  modalBackdrop: 'rgba(0,0,0,0.7)',
  techBtnTxtSel: '#0a0a0a',
  heroFill: '#0a0a0a',
};
const LIGHT = {
  bg: '#F5F5F7',
  iconBtnBg: 'rgba(10,10,12,0.06)',
  text: '#0a0a0c',
  textDim40: '#8E8E93',
  textDim45: '#8E8E93',
  textDim50: '#8E8E93',
  textDim55: '#6e6e73',
  textDim65: '#6e6e73',
  textDim75: '#4a4a4e',
  heroRingTrack: 'rgba(10,10,12,0.10)',
  dialRingTrack: 'rgba(10,10,12,0.14)',
  glassBg: '#E5E5EA',
  glassBorder: 'transparent',
  shineMid: '#E5F0FFCC',
  ctaBg: LIGHT_BLUE,
  ctaBorder: LIGHT_BLUE,
  ctaText: '#ffffff',
  ctaRipple: 'rgba(255,255,255,0.18)',
  modalBg: '#ffffff',
  modalBackdrop: 'rgba(10,10,12,0.45)',
  /* Operator, 11 september 2026: "tekst in de pills moet bij aanklikken
     wit worden" — was vast `#0a0a0a` (zwart), correct genoeg op de felle
     kleur-gradients maar te weinig contrast op Clarity's donkergrijze
     neutrale fallback (`accent` #2C2C2E). Wit werkt op alle geselecteerde
     pil-vullingen in light, dus geen aparte per-state uitzondering nodig. */
  techBtnTxtSel: '#ffffff',
  /* Operator, 11 september 2026 (2e correctie): "voor alle andere cirkel
     moet binnenkant gewoon achtergrondkleur zijn, mijn opmerking was
     enkel voor Clarity" — dus WEER gelijk aan `bg` hier (was al zo vóór
     de eerste correctie); de afwijkende grijstint (`heroFillNeutral`,
     verderop bij `accent`) geldt voortaan enkel nog voor de neutrale
     (wit-accent/Clarity) fallback, niet meer voor elke state. */
  heroFill: '#F5F5F7',
};
const C = light ? LIGHT : DARK;

/* Gedeeld met de plannen (utils/duration-options.ts, 8 okt 2026). */
import { CUSTOM_CEILING_MIN, NO_EXTEND_TECHNIQUE_KEYS } from '@/utils/duration-options';
import { hapticPress, hapticTap, hapticTick } from '@/utils/haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

/* Operator, 11 september 2026: "hoe weet gebruiker wat er in de knop staat
   als dat is afgekort met 3 puntjes" — de pil-knop toonde tot nu toe
   gewoon `t.name.split(' ')[0]`, het eerste woord van de volledige
   techniek-naam. Werkt voor de meeste ("Box Breathing" → "Box", "Equal
   Breathing" → "Equal"), maar niet altijd: "Physiological Sigh" → het
   eerste woord ZELF is al te lang voor de pil en wordt met "…" afgekapt
   ("Physiologic…"), en "Alternate Nostril Breathing" → "Alternate" zegt
   niks over welke techniek het is. Expliciete, altijd-passende labels
   voor de uitzonderingen; de rest valt terug op het bestaande eerste-
   woord-gedrag. Volledige naam blijft altijd zichtbaar in de info-modal
   (tik op de knop). */
const TECH_SHORT_LABEL: Record<string, string> = {
  'physiological-sigh': 'Sigh',
  'alternate-nostril': 'Nostril',
  diaphragmatic: 'Diaphragm',
};
function techShortLabel(t: { key: string; name: string }): string {
  return TECH_SHORT_LABEL[t.key] ?? t.name.split(' ')[0];
}

function DurationDial({
  value,
  unit,
  label,
  progress,
  selected,
  accent,
  labelColor,
  invert,
  onPress,
  trackColor,
}: {
  value: number;
  unit: string;
  label: string;
  progress: number;
  selected: boolean;
  accent: string;
  /** Operator, 11 september 2026: "Total Alignment tekst is wit en
     onleesbaar, zet in Muted Grijs" — voor de neutrale (wit-accent)
     fallback moet het label een vaste dempende grijstint zijn, los van
     `accent` (die daar juist donker/zwart is voor de cirkel-vulling
     zelf). Optioneel: valt terug op `accent` voor gewone kleur-states,
     zelfde gedrag als voorheen. */
  labelColor?: string;
  /** Operator, 11 september 2026: "bij aanklikken session duration wordt
     cirkel zwart met witte tekst en witte omlijning" — voor de neutrale
     (wit-accent) fallback moet de geselecteerde cirkel niet de gewone
     zachte 15%-tint krijgen (die was ontworpen voor een KLEUR-accent),
     maar een dekkende zwarte vulling met een witte ring en witte cijfers
     — dezelfde geïnverteerde stijl als de CTA en de techniek-pillen. */
  invert?: boolean;
  onPress: () => void;
  /** Operator, 17 september 2026 (addToDay-dark-modus): deze losse
   *  top-level component leest de module-brede `C` niet meer impliciet —
   *  BreathSetupScreen geeft zijn EIGEN (licht/donker) `C.dialRingTrack`
   *  door, zodat het lege spoor van de ring ook in donker klopt. */
  trackColor: string;
}) {
  const invertSelected = invert && selected;
  const fill = useSharedValue(selected ? progress : 0);
  const scale = useSharedValue(1);
  /* Operator, 9 september 2026: "heel korte popup enkel op de knop zelf"
     — de premium duur-naam (bv. "Deep Release", uit `DurationDef.name`,
     geen nieuw verzonnen tekst) verschijnt als klein label onder de
     geselecteerde cirkel, zacht in-/uitfaded i.p.v. een echte modal/
     popover — past bij "extreem kort, past in een subtiele tooltip". */
  const labelOpacity = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(selected ? progress : 0, { duration: 380 });
    scale.value = withSpring(selected ? 1.08 : 1, { damping: 14, mass: 0.6 });
    labelOpacity.value = withTiming(selected ? 1 : 0, { duration: 220 });
  }, [selected, progress]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - fill.value),
  }));
  /* Operator, 11 september 2026: "zachte paarse vulling ipv enkel rand" —
     hergebruikt `labelOpacity` (al 0/1 op selectie) i.p.v. een nieuwe
     shared value, mag dus gewoon meefaden met het label. */
  const fillProps = useAnimatedProps(() => ({
    fillOpacity: labelOpacity.value * (invert ? 1 : 0.15),
  }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: (1 - labelOpacity.value) * -3 }],
  }));

  const pressScale = useSharedValue(1);
  const onPressIn = () => {
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
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[s.dialWrap, pressStyle]}
      hitSlop={6}
    >
      <Animated.View style={[s.dial, popStyle]}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R - RING_STROKE / 2}
            fill={accent}
            animatedProps={fillProps}
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={trackColor}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={invertSelected ? '#ffffff' : accent}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${RING_C}, ${RING_C}`}
            animatedProps={ringProps}
            fill="none"
            rotation={-90}
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
        <Text
          style={[
            s.durationValue,
            selected && { color: invertSelected ? '#ffffff' : accent },
          ]}
        >
          {value}
        </Text>
        <Text style={[s.durationUnit, invertSelected && { color: '#ffffff' }]}>{unit}</Text>
      </Animated.View>
      <Animated.Text
        style={[s.dialLabel, { color: labelColor ?? accent }, labelStyle]}
        numberOfLines={2}
      >
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}

/* Operator, 17 september 2026 ("niet alleen ik wil wielscroller bovenaan"
   — een carrousel volstond niet, dit moet een echte draai-/wiel-selector
   zijn): verticale snap-scroller, zelfde soort gebaar als een iOS-
   tijdwiel, maar zelf gebouwd (geen nieuwe native dependency, geen risico
   op een niet-mee-gebouwde module) — een gewone ScrollView met
   `snapToInterval` en een vast "selectievenster" in het midden. */
const WHEEL_ITEM_H = 44;
const WHEEL_VISIBLE = 3;
const WHEEL_H = WHEEL_ITEM_H * WHEEL_VISIBLE;

/* Operator (druk-vering op AM/PM-knoppen): eigen component i.p.v. inline in
   de `.map(['AM','PM'])` hieronder — hooks mogen niet in een loop-callback. */
function AmPmButton({
  label,
  on,
  accent,
  textColor,
  onPress,
  btnStyle,
  btnTxtStyle,
}: {
  label: 'AM' | 'PM';
  on: boolean;
  accent: string;
  textColor: string;
  onPress: () => void;
  /* `s` (uit `makeStyles`) leeft enkel binnen `BreathSetupScreen` — deze
     component staat op moduleniveau, dus de betrokken stijlen komen als
     props binnen i.p.v. een `s.xxx`-verwijzing hier. */
  btnStyle: StyleProp<ViewStyle>;
  btnTxtStyle: StyleProp<TextStyle>;
}) {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.93, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <AnimatedPressable
      style={[btnStyle, on && { backgroundColor: accent }, pressStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Text style={[btnTxtStyle, on && { color: textColor }]}>{label}</Text>
    </AnimatedPressable>
  );
}

function TimeWheel({
  options,
  value,
  onChange,
  accent,
  trackColor,
  blocked = [],
}: {
  options: number[];
  value: number;
  onChange: (mins: number) => void;
  accent: string;
  trackColor: string;
  /** Reeds bezette tijdsblokken (van andere sessies) — die opties tonen
   *  zich als "Taken" i.p.v. een gewone tijd. Zie call-site. */
  blocked?: { reminderAt: number; minutes: number }[];
}) {
  const listRef = useRef<ScrollView>(null);
  const settledIndex = Math.max(0, options.indexOf(value));

  /* Bij het openen meteen (zonder animatie) naar de huidige waarde
     springen. */
  useEffect(() => {
    listRef.current?.scrollTo({ y: settledIndex * WHEEL_ITEM_H, animated: false });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);
  /* Operator, 18 september 2026 ("check ook tijd scrollen want blijft
     regelmatig hangen"): gevonden — de sync hieronder vuurde OOK af na de
     wiel se EIGEN commit (`commit()` verderop roept `onChange` aan, wat
     `value` bijwerkt, wat deze `useEffect` opnieuw triggert), en stuurde
     dan een TWEEDE, overbodige `scrollTo` naar exact dezelfde positie
     terwijl Android's eigen fling-animatie nog aan het uitlopen was — die
     botsing tussen twee gelijktijdige scroll-animaties voelde aan als
     "hangen"/haperen. `internalChange` onderscheidt "dit kwam van mezelf"
     (negeren, `commit()` scrollde daar al naartoe) van "dit kwam van
     BUITEN" (digitale invoer/AM-PM-knoppen — die moeten wél syncen). */
  const internalChange = useRef(false);
  const skipFirstValueSync = useRef(true);
  useEffect(() => {
    if (skipFirstValueSync.current) {
      skipFirstValueSync.current = false;
      return;
    }
    if (internalChange.current) {
      internalChange.current = false;
      return;
    }
    listRef.current?.scrollTo({ y: settledIndex * WHEEL_ITEM_H, animated: true });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [value]);

  const commit = (offsetY: number) => {
    const idx = Math.min(options.length - 1, Math.max(0, Math.round(offsetY / WHEEL_ITEM_H)));
    listRef.current?.scrollTo({ y: idx * WHEEL_ITEM_H, animated: true });
    if (options[idx] !== value) {
      hapticTap();
      internalChange.current = true;
      onChange(options[idx]);
    }
  };
  /* Operator, 18 september 2026 ("scroll voor tijd blokkeert"): de echte
     oorzaak was niet de ontbrekende hoogte hierboven (die klopte al) —
     `onScrollEndDrag` vuurt af op het MOMENT dat de vinger loslaat, VÓÓR
     Android's eigen traagheids-scroll ("momentum") ook maar begonnen is.
     Op dat moment stond de offset nog bijna exact waar 'm al was, dus
     `commit()` rondde af naar diezelfde index en `scrollTo` sprong meteen
     terug — dat KILDE de eigenlijke momentum-scroll voor hij kon
     doorlopen, wat aanvoelde als "blokkeert/scrollt niet". Enkel
     `onMomentumScrollEnd` (ná de traagheids-scroll, met de ECHTE
     eindpositie) hoort dit te bevestigen. */

  return (
    <View style={[s.wheelWrap, { height: WHEEL_H }]}>
      <View style={[s.wheelWindow, { borderColor: `${accent}55` }]} pointerEvents="none" />
      <ScrollView
        ref={listRef}
        /* Operator, 18 september 2026 ("time scrollt niet"): zonder een
           EIGEN `style`-hoogte op de ScrollView zelf krijgt hij op Android
           geen begrensde viewport mee (het `height` op `wheelWrap` hierboven
           is de OUDER, niet de ScrollView) — hij groeide dus gewoon mee met
           alle opties (geen clip, dus ook niets om IN te scrollen). Expliciet
           dezelfde `WHEEL_H` als viewport-hoogte. */
        style={{ height: WHEEL_H }}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H }}
        onMomentumScrollEnd={(e) => commit(e.nativeEvent.contentOffset.y)}
      >
        {options.map((mins) => {
          const d = new Date();
          d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
          const label = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const on = mins === value;
          /* Operator, 18 september 2026 ("blokkeren gekozen tijd ook
             ineens bouwen"): deze optie valt binnen een BESTAANDE
             sessie's [start, start+duur) — toon 'm als "Taken" i.p.v.
             een gewone selecteerbare tijd, zodat je het al op het wiel
             zelf ziet i.p.v. pas achteraf via de overlap-melding. */
          const isBlocked = blocked.some(
            (b) => mins >= b.reminderAt && mins < b.reminderAt + b.minutes,
          );
          return (
            <View key={mins} style={[s.wheelRow, { height: WHEEL_ITEM_H }]}>
              <Text
                style={[
                  s.wheelTxt,
                  { color: on ? accent : trackColor },
                  on && s.wheelTxtOn,
                  isBlocked && s.wheelTxtBlocked,
                ]}
              >
                {label}
                {isBlocked ? ' · Taken' : ''}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* DurationWheelRow/DurationWheel verhuisd naar components/DurationWheel.tsx (1 okt 2026, gedeeld met agenda.tsx) — zie de toelichting daar. */

/* Operator, 19 september 2026 ("vervang de drie losse zwevende knoppen
   door één doorlopende Segmented Control... paars selectievlak schuift
   met een vloeiende vering"): één ononderbroken, donkere capsulebalk
   i.p.v. drie losse pillen — de kleur zit nu in ÉÉN gedeeld, gliedend
   vlak áchter de tekst, niet meer in elke knop zijn eigen achtergrond.
   Gelijke breedte per segment (net als Apple's eigen UISegmentedControl)
   — dat maakt de schuifpositie een simpele breedte/index-som, geen
   layout-meting per knop nodig, en blijft dus vrij van de Android-
   compositing-bug die de vorige aanpak (individuele achtergrond per
   knop) eerder al een keer trof (zie de git-geschiedenis hierboven). */
/* Operator (druk-vering voor elk segment): eigen component i.p.v. inline in
   de `.map()` hieronder — hooks mogen niet in een loop-callback staan. */
/* Operator, 24 september 2026 ("native iOS Segmented Control — geen
   icoontjes, tekst-cross-fade terwijl het kussentje schuift"): icoon weg
   (referentie: "minimalistisch, geen icoontjes"). Tekstkleur is nu
   CONTINU afgeleid van de live `indicatorX`/`segW` (zelfde principe als
   `DurationWheelRow`'s live afstand-interpolatie) i.p.v. de discrete
   `isSel`-sprong — kleurt mee TERWIJL het kussentje onderweg is, niet pas
   erna. */
function TechniqueSegmentButton({
  t,
  index,
  techniquePicked,
  indicatorX,
  segW,
  onPress,
  selected,
  onInfo,
}: {
  t: TechniqueDef;
  index: number;
  techniquePicked: boolean;
  indicatorX: SharedValue<number>;
  segW: number;
  onPress: () => void;
  /** Operator, 5 okt 2026: de i enkel bij de gekozen techniek. */
  selected?: boolean;
  onInfo?: () => void;
}) {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  /* Operator, 24 september 2026 (correctie op de vorige beurt: "pill is
     glazen/doorschijnend, geen wit-op-donker meer — geselecteerde tekst
     blijft FEL WIT, niet-geselecteerd matgrijs"): was een kleurverloop
     naar donker (paste bij een effen witte pill, klopt niet meer nu de
     pill zelf semi-transparant is). */
  /* Operator, 24 september 2026 ("gekozen tekst iets groter?" — vergeleken
     met set-your-goal: daar groeit bij selectie niet de TEKST maar de hele
     KAART, via gradiënt-vulling/rand/schaduw; hier is er geen "kaart" per
     segment, enkel tekst in een pil, dus de tekst zelf draagt het accent).
     Zelfde continue cross-fade-mechanisme als de kleur hierboven — geen
     harde sprong bij de indicator-grens, `fontSize` schaalt mee met
     dezelfde `dist`. */
  const textStyle = useAnimatedStyle(() => {
    if (!techniquePicked || segW <= 0) {
      return { color: 'rgba(255,255,255,0.4)', fontSize: 13 };
    }
    const dist = Math.min(1, Math.abs(index - indicatorX.value / segW));
    return {
      /* Operator, 5 okt 2026 ("meer diepte: gekozen komt echt naar voor,
         andere naar de achtergrond"): groter verschil in grootte en
         helderheid, plus de andere twee zakken een fractie weg. */
      color: interpolateColor(dist, [0, 1], ['#ffffff', 'rgba(255,255,255,0.24)']),
      /* 8 okt 2026 ("de D van Diaphragm wordt afgesneden"): 20 + info-
         icoon paste niet in een derde van de rij → 17. */
      fontSize: interpolate(dist, [0, 1], [17, 13.5], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(dist, [0, 1], [0, 1.5], Extrapolation.CLAMP) }],
    };
  });
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[tsc.segment, pressStyle]}
    >
      <View style={tsc.segmentRow}>
        <Animated.Text
          style={[tsc.segmentTxt, selected && tsc.segmentTxtGlow, textStyle]}
          numberOfLines={1}
        >
          {techShortLabel(t)}
        </Animated.Text>
        {selected && onInfo ? (
          <Pressable onPress={onInfo} hitSlop={12} accessibilityLabel={`About ${t.name}`}>
            <Info size={14} color="rgba(255,255,255,0.6)" strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

function TechniqueSegmentedControl({
  techniques,
  techIdx,
  techniquePicked,
  onPick,
  blurTarget,
  onInfo,
}: {
  techniques: TechniqueDef[];
  techIdx: number;
  techniquePicked: boolean;
  onPick: (index: number, t: TechniqueDef) => void;
  /** Achtergrond om echt te vervagen (Android, zie VibezGlass). */
  blurTarget?: React.RefObject<View | null>;
  /** Uitleg van de gekozen techniek (i naast de naam). */
  onInfo?: (t: TechniqueDef) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const segW = techniques.length > 0 ? trackWidth / techniques.length : 0;
  const indicatorX = useSharedValue(0);

  useEffect(() => {
    if (segW <= 0) return;
    /* Operator, 19 september 2026 ("te veel beweging links-rechts en
       andersom, subtieler"): damping 16 (met stiffness 180) zat ver
       onder kritische demping.
       Operator, 24 september 2026 ("harde horizontale bounce, is dat
       Apple-stijl?"): `damping:26/stiffness:200` bleek zélf nog net ONDER
       kritisch (~28,3 zou kritisch zijn bij deze stiffness) — een kleine
       overshoot die bij een grotere verschuiving (bv. naar een pill
       verder weg) hard oogt. Een segmented-control-schuifbalk bounct bij
       Apple nooit (in tegenstelling tot een knop-druk, die WEL een
       mini-bounce krijgt) — nu `dampingRatio: 1`, écht kritisch gedempt,
       een vloeiende schuif zonder enige overshoot. */
    indicatorX.value = withSpring(techIdx * segW, {
      duration: 280,
      dampingRatio: 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [techIdx, segW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: segW,
  }));

  return (
    <View
      style={tsc.track}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {/* VIBEZCORE-glas (5 okt 2026): de balk doorzichtig glas, het
          gekozen kussentje lichter glas dat erboven zweeft — geen randen. */}
      {/* Operator, 5 okt 2026: van rand tot rand, echt vervaagd glas over
         de toestandsfoto (`blurTarget`). De gekozen naam groot en wit, de
         andere gedimd — geen kussentje. */}
      <VibezGlass radius={14} level="subtle" blurTarget={blurTarget} style={StyleSheet.absoluteFill}>
        {/* Even donker als de pagina eromheen (operator, 5 okt 2026: "te
           zware streep") — enkel de vervaging laat de balk zien. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,10,0.7)' }]} />
      </VibezGlass>
      {/* Operator, 24 september 2026 (referentie: "het kussentje is wit/
         lichtgrijs met een zachte schaduw, geen accentkleur"): was
         `accent` — de vulling zelf droeg voorheen de state-kleur; nu
         altijd wit, `isLightColor` was enkel nodig om daarop leesbare
         tekst te kiezen (die tekst is nu sowieso altijd donker, zie
         `TechniqueSegmentButton`), dus die stap valt weg. */}
      {/* Operator, 5 okt 2026 ("transparant blur, aangeduide techniek
         wordt groter en de andere 2 dimmen"): geen kussentje meer — de
         keuze zit in de letter zelf (zie `TechniqueSegmentButton`). */}
      {techniques.map((t, i) => (
        <TechniqueSegmentButton
          key={t.key}
          t={t}
          index={i}
          techniquePicked={techniquePicked}
          indicatorX={indicatorX}
          segW={segW}
          onPress={() => onPick(i, t)}
          selected={i === techIdx}
          onInfo={onInfo ? () => onInfo(t) : undefined}
        />
      ))}
    </View>
  );
}

const tsc = StyleSheet.create({
  /* Operator, 19 september 2026 ("techniek-balk staat kapot/smal —
     verticaal gedraaide tekst"): de omhullende `ContentWrap` heeft
     `alignItems:'center'` (`s.scroll`), dus elk kind zonder EIGEN
     expliciete breedte valt terug op zijn minimale content-breedte
     i.p.v. de volle schermbreedte — precies wat hier gebeurde zodra
     deze track niet meer rechtstreeks, maar via een extra tussen-`View`
     (voor de marge) onder die ouder hing. `alignSelf:'stretch'` maakt
     de breedte ondubbelzinnig, ongeacht hoeveel tussenlagen erboven
     staan. */
  /* Operator, 19 september 2026 ("balk-achtergrond nog iets donkerder
     dan de kaart, actieve vlak moet krachtig fel paars, geen fletse
     gradient/grijs"): balk `#121214` (donkerder dan de `#1C1C1E`-kaart
     eromheen, geeft het de "verzonken" look van een echte iOS-segmented-
     control), indicator een vlakke, volle `accent`-kleur i.p.v. de
     3-stops-`st.gradient` (die aan de randen uitdunt naar een lichtere
     tint, wat als "dof" overkwam). */
  /* Operator, 20 september 2026: enige nieuwe laag t.o.v. `track` hierboven
     — geeft de "RECOMMENDED"-label ruimte om BOVEN de balk te zweven
     (`position:'relative'` + `marginTop`) zonder de balk zelf, die al z'n
     eigen `alignSelf:'stretch'`-fix had, opnieuw te breken. */
  trackWrap: {
    alignSelf: 'stretch',
    position: 'relative',
    marginTop: 16,
  },
  recommendedTag: {
    position: 'absolute',
    top: -16,
    alignItems: 'center',
  },
  recommendedTagTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.5)',
  },
  track: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    /* Zelfde afronding als de Start session-knop. */
    borderRadius: 14,
    overflow: 'hidden',
    padding: 3,
  },
  /* Operator, 24 september 2026 (referentie: "het kussentje is wit/
     lichtgrijs met een zachte schaduw, ligt visueel bovenop de balk"): was
     `accent`-gevuld zonder schaduw.
     Operator, 24 september 2026 (correctie: "geen effen wit, half-
     transparant glazen kussentje — fel wit zou de instellingspagina
     schreeuwerig maken, oog moet naar de minutenweergave bovenin
     blijven"): was even effen wit — nu `rgba(255,255,255,0.13)` +
     een flinterdun wit randje, dezelfde "matglas"-taal als de rest van de
     app. Schaduw blijft (nog steeds "ligt zacht bovenop"). */
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: 17,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    /* Hogere balk (operator, 5 okt 2026). */
    height: 58,
  },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  /* Zachte gloed rond de gekozen naam — komt naar voren. */
  segmentTxtGlow: {
    textShadowColor: 'rgba(255,255,255,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  segmentTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
});

/* Operator, 24 september 2026 ("cijferweergave + losse knoppen + slider
   vervangen door één wheel picker"): `DurationSegmentButton` +
   `DurationSegmentedControl` (de horizontale segmented control uit de
   19 september-ronde) zijn vervangen door `DurationWheel`, zie
   `TimeWheel` hierboven — verwijderd i.p.v. dood te laten liggen. */

/* Operator (druk-vering op elke selecteerbare rij in de 4 volle-scherm-
   kiezers hieronder): eigen componenten i.p.v. inline in hun `.map()`s —
   hooks mogen niet in een loop-callback staan. `s` (uit `makeStyles`) komt
   als prop mee, want deze componenten staan op moduleniveau. */
function StateSheetRow({
  s,
  opt,
  eyebrowLabel,
  on,
  accent,
  onPress,
}: {
  s: ReturnType<typeof makeStyles>;
  opt: (typeof BREATH_STATES)[BreathStateKey];
  eyebrowLabel: string;
  on: boolean;
  accent: string;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
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
      style={[s.sheetRow, pressStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <View style={[s.stateChipDot, { backgroundColor: opt.accent, marginTop: 3 }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.sheetRowTitle}>{eyebrowLabel}</Text>
        <Text style={[s.sheetRowSub, { color: opt.accent }]} numberOfLines={1}>
          {opt.subtitle}
        </Text>
        <Text style={s.sheetRowSub} numberOfLines={3}>
          {opt.description}
        </Text>
      </View>
      {on && <Check size={18} color={accent} strokeWidth={2.6} />}
    </AnimatedPressable>
  );
}

function TechniqueSheetRow({
  s,
  t,
  isSel,
  accent,
  dimColor,
  onPress,
}: {
  s: ReturnType<typeof makeStyles>;
  t: TechniqueDef;
  isSel: boolean;
  accent: string;
  dimColor: string;
  onPress: () => void;
}) {
  const Icon = techniqueIcon(t.key);
  const { primary } = techniqueDecisionLine(t);
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <AnimatedPressable style={[s.sheetRow, pressStyle]} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Icon
        size={16}
        color={isSel ? accent : dimColor}
        strokeWidth={2.2}
        style={{ marginTop: 3 }}
      />
      <View style={{ flex: 1 }}>
        <View style={s.pickerRowHead}>
          <Text style={s.sheetRowTitle}>{t.name}</Text>
          <Text style={s.sheetLevelTxt}>{t.level}</Text>
        </View>
        <Text style={s.sheetRowSub} numberOfLines={2}>
          {techniqueHook(t.explain)}
        </Text>
        {primary ? (
          <Text style={s.sheetRowSub} numberOfLines={2}>
            {primary}
          </Text>
        ) : null}
      </View>
      {isSel && <Check size={18} color={accent} strokeWidth={2.6} />}
    </AnimatedPressable>
  );
}

function DurationSheetRow({
  s,
  d,
  isSel,
  accent,
  onPress,
}: {
  s: ReturnType<typeof makeStyles>;
  d: DurationDef;
  isSel: boolean;
  accent: string;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <AnimatedPressable style={[s.sheetRow, pressStyle]} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Text style={[s.sheetRowTitle, { flex: 1 }]}>
        {d.name} · {d.cycles ? `${d.cycles} cycles` : `${d.minutes} min`}
      </Text>
      {d.recommended && (
        <Text style={[s.sheetLevelTxt, { marginRight: isSel ? 8 : 0 }]}>
          Recommended
        </Text>
      )}
      {isSel && <Check size={18} color={accent} strokeWidth={2.6} />}
    </AnimatedPressable>
  );
}

function HorizonSheetRow({
  s,
  name,
  hint,
  isSel,
  accent,
  onPress,
}: {
  s: ReturnType<typeof makeStyles>;
  name: string;
  hint: string;
  isSel: boolean;
  accent: string;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <AnimatedPressable style={[s.sheetRow, pressStyle]} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <View style={{ flex: 1 }}>
        <Text style={s.sheetRowTitle}>{name}</Text>
        <Text style={s.sheetRowSub}>{hint}</Text>
      </View>
      {isSel && <Check size={18} color={accent} strokeWidth={2.6} />}
    </AnimatedPressable>
  );
}

export default function BreathSetupScreen() {
  if (__DEV__) console.log('[breath-setup] render start at', Date.now());
  const insets = useSafeAreaInsets();
  /* Operator, 24 september 2026 ("nog altijd geen voice ronde 1, begint pas
     bij ronde 2" — de eerdere fix in breath-session.tsx hielp dus niet
     genoeg): geroot-causet in `breath-voice.ts`'s `playUrl()` — die start
     bij een nog niet geladen bestand een reeks herpogingen (120–2000ms),
     MAAR elke volgende fase-cue (`playUrl` voor de volgende phase) wisselt
     `activePlayer` om en annuleert daarmee de lopende herpogingen van de
     VORIGE cue (`if (activePlayer !== player) return`, bewust zo — anders
     zou een oude cue alsnog over een nieuwe heen starten). Ronde 1's
     inhale/hold/exhale volgen elkaar sneller op dan het bestand laadt, dus
     wordt ELKE cue van ronde 1 stilgemaakt vóór z'n eigen herpogingen ooit
     konden lukken — het bestand IS dan intussen wel degelijk gedownload
     (vandaar dat ronde 2 gewoon werkt), enkel de afspeel-POGING kwam nooit
     op tijd. `breath-session.tsx` preload(t) al bij het MOUNTEN van dat
     scherm, maar dat scherm start de sessie zelf ook meteen bij mount
     (autostart) — vrijwel geen tijdsverschil. Hier op breath-setup.tsx,
     waar de gebruiker wél realistisch een paar seconden doorbrengt met
     techniek/duur kiezen vóór die op "Start session" tikt, is er WEL
     echte tijd om de 3 bestanden op voorhand te laten laden. */
  /* Operator, 25 september 2026 ("cta in choose your session reageert traag,
     paar seconden voor volgende pagina"): `preloadBreathCues()` doorloopt
     11 bestanden en roept per stuk `createAudioPlayer()` aan — een native
     bridge-call, synchroon genoeg om de JS-thread merkbaar te belasten als
     hij vuurt PRECIES tijdens de scherm-overgang zelf. `InteractionManager.
     runAfterInteractions()` stelt 'm uit tot de overgangsanimatie klaar is
     — de gebruiker kiest hierna sowieso nog techniek/duur, dus er blijft
     ruim voldoende tijd over voor de bestanden om te laden vóór "Start
     session". */
  useEffect(() => {
    if (__DEV__) console.log('[breath-setup] mounted (useEffect fired) at', Date.now());
    const task = InteractionManager.runAfterInteractions(() => {
      if (__DEV__) console.log('[breath-setup] preload starting at', Date.now());
      preloadBreathCues();
    });
    return () => task.cancel();
  }, []);
  const params = useLocalSearchParams<{
    state?: string;
    mode?: string;
    from?: string;
    quick?: string;
    minutes?: string;
    /* Operator, 17 september 2026 ("Bouw je dag" — alles op 1 kaart i.p.v.
       een los invulscherm): "addToDay" hergebruikt dit hele scherm vanuit
       build-your-day.tsx. `slot` bepaalt het tijdvenster voor de nieuwe
       tijd-kiezer hieronder, `editIndex` staat er enkel bij als een
       BESTAANDE sessie bewerkt wordt (i.p.v. een nieuwe toegevoegd),
       `technique`/`time` geven dan de eerder gekozen waarden mee zodat de
       editor niet weer bij het begin start. Zie day-builder-draft.ts voor
       hoe de keuze teruggaat naar build-your-day.tsx. */
    context?: string;
    slot?: string;
    editIndex?: string;
    technique?: string;
    time?: string;
    /* Operator, 17 september 2026 ("als gebruiker overlappende tijden
       kiezen mag dat niet, moet melding komen"): JSON van de andere
       sessies in ditzelfde dagdeel ({reminderAt, minutes}[]) — build-
       your-day.tsx geeft ze mee zodat hier vóór "Add to day" geblokkeerd
       kan worden i.p.v. pas achteraf een dubbele/overlappende sessie te
       laten ontstaan. */
    existing?: string;
    /* Operator, 18 september 2026 ("aantal dagen moet in add to day
       komen"): horizon geldt voor het HELE protocol, niet voor deze ene
       sessie — build-your-day.tsx geeft de op dat moment gekozen waarde
       mee zodat de 5e tegel hieronder 'm kan tonen/wijzigen, en geeft 'm
       via day-builder-draft.ts ook weer terug (zie `addToDay()`). */
    horizon?: string;
    /* Operator, 18 september 2026 ("Update Protocol Length?"-bevestiging
       vóór een protocol-brede wijziging): totaal aantal sessies in het
       HELE protocol (alle dagdelen samen), niet enkel dit dagdeel —
       build-your-day.tsx geeft `sessions.length` mee. Bepaalt de tekst
       in die bevestiging ("apply to all N sessions") en of hij überhaupt
       moet tonen (bij de eerste/enige sessie is er niets anders om te
       raken). */
    totalSessions?: string;
  }>();
  const isAddToDay = params.context === 'addToDay';
  const protocolSessionCount = params.totalSessions ? Number(params.totalSessions) : 1;
  /* Operator, 19 september 2026, 2e ronde ("het scherm is ONGEACHT light
     of dark altijd enkel dark mode — light mode bestaat hier niet"):
     mijn vorige fix liet dit scherm de app-brede thema-instelling volgen
     — verkeerd. Dit scherm heeft geen lichte variant, punt: vast op
     `false`, geen `useAppTheme()`, geen `isAddToDay`-onderscheid meer.
     Deze `light`/`C`/`s` SCHADUWEN de module-brede constanten van
     hierboven voor de rest van DEZE component — alle honderden
     `light`/`C.xxx`/`s.xxx`-verwijzingen verderop in dit bestand lezen nu
     automatisch de juiste versie, zonder dat elke aanroep zelf hoeft te
     wijzigen (gewone JS-scoping). */
  const light = false;
  const C = light ? LIGHT : DARK;
  const s = useMemo(() => makeStyles(C, light), [C, light]);
  /* Operator, 17 september 2026 (addToDay): welk dagdeel dit is — vroeger
     pas veel later gedeclareerd, nu naar boven gehaald zodat de slimme
     standaardstaat hieronder ('m nodig heeft. */
  const slotForTime = (params.slot as PlanSlot) ?? 'morning';
  /* Operator, vervolg: in de normale flow (Breath-tab → dit scherm) blijft
     de staat vast, exact zoals voorheen — alleen "addToDay" mag hem
     achteraf via de nieuwe staat-kiezer hieronder wijzigen.
     Operator, 18 september 2026 ("alles moet in principe op een standaard
     uur/staat staan om te beginnen... morning routine → Boost"): addToDay
     zonder expliciete `params.state` (dus een NIEUWE sessie, geen edit)
     start niet langer altijd op 'calm', maar op de eerste, voor dit
     dagdeel logische staat uit `DAY_CANDIDATES` (dezelfde bron als het
     automatische Pad A-protocol) — 's ochtends dus Boost, 's avonds Rest,
     enz. Bewerken van een bestaande sessie (`params.state` aanwezig) of de
     normale flow (die komt altijd MET een staat binnen) blijven
     ongewijzigd. */
  const smartDefaultState = (DAY_CANDIDATES[slotForTime]?.[0] ??
    'calm') as BreathStateKey;
  const initialStateKey = (
    (params.state ?? params.mode) as BreathStateKey
  ) as BreathStateKey;
  const [selState, setSelState] = useState<BreathStateKey>(() => {
    if (BREATH_STATES[initialStateKey]) return initialStateKey;
    return isAddToDay ? smartDefaultState : 'calm';
  });
  const st = BREATH_STATES[selState];
  /* Operator, 11 september 2026: "wit op wit, alles moet logisch" —
     Clarity/Theta's `accent` is letterlijk `#FFFFFF` (bindend, spec §5 in
     CLAUDE.md, dezelfde kleur als de bracelet-LED). Dat is correct voor
     de databron/BLE, maar onbruikbaar als UI-kleur op een lichte
     achtergrond: ring, geselecteerde pil, CTA en labels werden allemaal
     onzichtbaar wit-op-wit. `accent` hieronder is enkel een render-laag-
     fallback voor DIT scherm (en straks breath-session.tsx) — `st.accent`
     zelf blijft ongewijzigd overal waar de echte statekleur nodig is
     (bracelet, data).
     Operator, 11 september 2026 (2e correctie, exacte specificatie): één
     enkele donkere vervangkleur bleek niet genoeg — een donkere cirkel-
     rand oogde zwaar, een donkere achtergrond-gloed vloekte met de lichte
     pagina, en zwarte tekst op de (ook donkere) modal-knop was zelf weer
     onleesbaar. Losse tokens per rol i.p.v. één `accent` voor alles. */
  const isNeutralAccent = light && st.accent.toUpperCase() === '#FFFFFF';
  const accent = isNeutralAccent ? '#2C2C2E' : st.accent; // vulling: geselecteerde pil/cirkel, CTA-basis
  const ringAccent = isNeutralAccent ? '#AEAEB2' : st.key === 'rest' ? '#4AF0D4' : st.accent; // dunne ring/shine-lijn om de timer-cirkel
  const glowAccent = isNeutralAccent ? '#E9ECEF' : st.accent; // achtergrond-gloed bovenin
  const labelAccent = isNeutralAccent ? '#8E8E93' : st.accent;
  /* Operator, 5 okt 2026 ("groen veel te donker"): Sleep's #00A3A3 op lage
     dekking werd op zwart een modderig donkergroen. Golven en boog gebruiken
     daar het lichte Bio-Teal (zelfde keuze als de terugkeer-gloed op
     Activity); de andere toestanden blijven ongewijzigd. */
  /* Operator, 10 okt 2026: Sleep-golf in echt Bio-Teal #00A3A3 (40/55%), gelijk aan State Control. */
  const waveAccent = accent; // subtekst onder de duur-cirkel ("Total Alignment")
  const ctaBg = isNeutralAccent ? '#1C1C1E' : accent;
  const ctaTextColor = isNeutralAccent ? '#ffffff' : '#0a0a0a';
  const modalBtnTextColor = isNeutralAccent ? '#ffffff' : '#0a0a0a';
  /* Operator, 11 september 2026 (2e correctie): "enkel voor Clarity was de
     binnenkant onzichtbaar, draai terug voor alle andere states" — voor
     elke gekleurde state blijft de cirkel-binnenkant gewoon `C.bg`
     (=`C.heroFill`, identiek); enkel de neutrale (wit-accent) fallback
     krijgt de afwijkende, iets donkerdere grijstint. */
  const heroFillColor = isNeutralAccent ? '#E2E2E6' : C.heroFill;

  /* Operator, 8 september 2026: "na eindigen eerste free 30 sec session
     staat cta gewoon terug als start session maar je kan maar 30 sec
     afspelen" — de CTA hier wist niets van de gratis-sessie/premium-status
     en zei dus altijd "Start session", ook wanneer de sessie die volgt in
     werkelijkheid een 30-seconden-preview zou zijn. Zelfde `locked`-formule
     als `breath-session.tsx` (isPro / gratis-sessie-vlag al verbruikt /
     dev-testvlag), enkel hier een LEZING — dit scherm claimt de gratis
     sessie niet, dat gebeurt pas in `startSession` hieronder. */
  const sub = useSubscription();
  const [freeSessionUsedAt] = useSetting('breathFreeSessionUsedAt');
  const [testFullSessions] = useSetting('testFullSessions');
  const locked = !sub.isPro && !!freeSessionUsedAt && !(__DEV__ && testFullSessions);

  const [techIdx, setTechIdx] = useState(() => {
    if (params.technique) {
      const i = st.techniques.findIndex((t) => t.key === params.technique);
      if (i !== -1) return i;
    }
    return defaultTechIdxFromExperience(st.techniques.length - 1);
  });
  /* Operator, 17 september 2026 (addToDay, vervolg: "de techniques moet
     ook niets aangeduid staan als user toekomt"): `techIdx` blijft intern
     altijd een geldige index (de ring/duur-berekeningen hieronder hebben
     toch een basiswaarde nodig) — dit is enkel de WEERGAVE-vlag: geen tab
     toont als geselecteerd en Duration blijft verborgen tot de gebruiker
     er zelf één aantikt. Start al "gekozen" in de normale flow (die kwam
     al MET een techniek binnen) en bij het bewerken van een bestaande
     sessie (die had er al één). */
  const [techniquePicked, setTechniquePicked] = useState(
    !isAddToDay || !!params.technique,
  );
  /* Operator, 28 september 2026 ("blokkade weg"): herroept de 24 september-
     beslissing hierboven (de tekst bleef staan als geschiedenis, maar
     `techniqueTouchedByUser`/`normalCtaBlocked`/`onCtaBlockedTap` zijn
     verwijderd) — het scherm toont al vanaf het eerste moment een geldige,
     zichtbare standaardkeuze (techniek + aanbevolen duur), dus een
     VERPLICHTE extra tik op de techniek-balk vóór Start werkt, voegde
     alleen verwarring toe: de gebruiker ziet een complete keuze maar de
     knop deed niets (enkel een stille schud-animatie, geen uitleg). De
     CTA werkt nu meteen met de getoonde standaard, exact zoals elk ander
     instelscherm — wijzigen kan nog steeds, gewoon niet verplicht. */
  /* Operator, 18 september 2026 ("het aantal stappen moet duidelijk zijn...
     hoeveel gedaan, welke, of hoeveel nog te gaan"): elk van de 4 kaartjes
     (Time/State/Technique/Duration) krijgt een eigen "al bevestigd"-vlag,
     zodat de kaartjes zelf (vinkje i.p.v. pijltje) én een tellertekst erboven
     kunnen tonen wat al gekozen is. Bij het BEWERKEN van een bestaande
     sessie (`editIndex` aanwezig) staat alles al vast — dan meteen alle 4
     als "gedaan" starten i.p.v. de gebruiker te laten denken dat er nog iets
     ontbreekt. `techniquePicked` hierboven dekt Technique al. */
  const isEditingSession = !!params.editIndex;
  const [timeTouched, setTimeTouched] = useState(isEditingSession);
  const [stateTouched, setStateTouched] = useState(isEditingSession);
  const [durationTouched, setDurationTouched] = useState(
    !isAddToDay || isEditingSession,
  );
  /* Operator, 18 september 2026 ("aantal dagen moet in add to day komen...
     onderaan als lange card" → later "plan length moet ook in de cirkel
     komen, cirkel pas vol als alles aangeduid is, 5 stappen dus"): 5e,
     brede tegel naast Time/State/Technique/Duration — HOELANG het hele
     protocol loopt, geen sessie-veld (vandaar geen `PlannedItem`-koppeling,
     enkel meegegeven/teruggegeven via `params.horizon`/`setDraftSession`).
     Komt altijd al gevuld binnen (build-your-day.tsx geeft zijn huidige
     waarde altijd mee), maar telt nu WEL mee in `pickerDoneCount`/de "All
     set"-viering — 5 van de 5, net als de andere 4 pas telt zodra de
     gebruiker 'm zelf bevestigt, niet enkel omdat er al een waarde
     klaarstaat. */
  const [horizon, setHorizon] = useState<PlanHorizon>(
    (params.horizon as PlanHorizon) || '2w',
  );
  const [horizonTouched, setHorizonTouched] = useState(isEditingSession);

  /* Operator, 18 september 2026 ("het aantal stappen moet duidelijk zijn" →
     later "cirkel pas vol als alles aangeduid is, 5 stappen dus"): één plek
     voor "hoeveel van de 5 kaartjes staan al vast" (inclusief Plan length
     sinds die keer meetelt) — gebruikt zowel door de ring (vult zich mee,
     zie `AddToDayHero` hieronder) als door het telletje/vinkjes boven de
     kaartjes. Hier (i.p.v. verderop bij de rest van de afgeleide state)
     gedeclareerd omdat de "begin hier"-pulse hieronder 'm ook nodig heeft. */
  const pickerDoneMap = {
    Time: timeTouched,
    State: stateTouched,
    Technique: techniquePicked,
    Duration: durationTouched,
    'Plan length': horizonTouched,
  } as const;
  const pickerDoneCount = Object.values(pickerDoneMap).filter(Boolean).length;
  /* Operator, 18 september 2026 ("witte omlijning moet na kiezen telkens
     verspringen naar de volgende te maken keuze"): zelfde volgorde als de
     rijen in de cirkel hierboven (State→Time→Technique→Duration→Plan
     length) — welk veld nog niet bevestigd is, wordt zowel de "begin
     hier"-pulse hieronder als (verderop) de "Next: ..."-tekst boven de
     grid. */
  const NEXT_ORDER: (keyof typeof pickerDoneMap)[] = [
    'State',
    'Time',
    'Technique',
    'Duration',
    'Plan length',
  ];
  const nextField = NEXT_ORDER.find((k) => !pickerDoneMap[k]);

  /* Operator, 18 september 2026 ("user weet niet onmiddellijk wat te
     doen bij openen build-pagina met cirkel... state card wit omlijnen
     en laten vibreren zodat bezoeker onmiddellijk ziet daar te
     beginnen" → vervolg: "witte omlijning moet na kiezen telkens
     verspringen naar de volgende te maken keuze"): een zachte, herhalende
     "ademende" witte gloed/rand — volgt nu `nextField` i.p.v. enkel
     `stateTouched`, dus hij springt na elke bevestigde keuze door naar de
     volgende nog-niet-ingevulde tegel (State→Time→Technique→Duration→
     Plan length), en stopt pas helemaal als alle 5 klaar zijn
     (`nextField === undefined`, "All set"). `withRepeat(..., -1, true)` =
     oneindig heen-en-weer (yoyo), dezelfde soort zachte in/uit-animatie
     als de bestaande `breath`-share elders in de app, hier lokaal
     opnieuw opgebouwd omdat dit scherm geen sessie-brede shared value
     heeft om te herbruiken. */
  const startHerePulse = useSharedValue(0);
  useEffect(() => {
    if (!nextField) {
      cancelAnimation(startHerePulse);
      startHerePulse.value = withTiming(0, { duration: 200 });
      return;
    }
    startHerePulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(startHerePulse);
  }, [nextField, startHerePulse]);
  const startHerePulseStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255,255,255,${0.25 + startHerePulse.value * 0.65})`,
    transform: [{ scale: 1 + startHerePulse.value * 0.03 }],
  }));
  /* Operator, 17 september 2026 (addToDay): tikken op een andere staat in
     de nieuwe staat-kiezer hieronder moet techniek/duur net zo resetten
     als tikken op een technieken-tab al doet (zie de onPress daar) — een
     techniek-index die toevallig ook bij de nieuwe staat bestaat is puur
     toeval, geen bewuste keuze. `skipFirst` want de EERSTE render moet de
     hierboven al berekende, eventueel voorgevulde (bewerken) waarden
     laten staan, niet meteen overschrijven. */
  const skipFirstStateReset = useRef(true);
  useEffect(() => {
    if (skipFirstStateReset.current) {
      skipFirstStateReset.current = false;
      return;
    }
    setTechIdx(defaultTechIdxFromExperience(st.techniques.length - 1));
    setTechniquePicked(!isAddToDay);
    setDurationIdx(0);
    setCustomSelected(false);
    setDurationTouched(!isAddToDay);
    /* Operator, 18 september 2026 ("als gebruiker state time... ingevuld
       heeft maar dan beslist state te veranderen, moet de rest ook terug
       blanco"): Technique/Duration resetten hierboven al zo — Time en Plan
       length deden dat nog niet. De ONDERLIGGENDE waarden (`time`/
       `horizon`) blijven staan (nog steeds prima startpunten), enkel de
       "bevestigd"-vlag gaat weer uit — zelfde patroon als de rest, en
       consistent met de strikte State→Time→Technique→Duration→Plan
       length-volgorde hierboven bij de kaartjes. */
    setTimeTouched(false);
    setHorizonTouched(false);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [selState]);
  /* Operator, 6 okt 2026 (onderzoek + "ok go"): het ritme en de aanbevolen
     duur volgen de ervaring van de gebruiker met DEZE techniek — zie
     utils/breath-level.ts. `baseTech` is de techniek uit de data, `tech`
     dezelfde met het ritme van zijn niveau. */
  const baseTech = st.techniques[techIdx] ?? st.techniques[0];
  const breathHistory = useBreathHistory();
  const userLevel = useMemo(
    () => levelForTechnique(st.key, baseTech.key, breathHistory),
    [st.key, baseTech.key, breathHistory],
  );
  const tech = useMemo(
    () => techniqueForLevel(st.key, baseTech, userLevel),
    [st.key, baseTech, userLevel],
  );
  const DURATIONS = tech.durations ?? st.durations;
  const [durationIdx, setDurationIdx] = useState(() => {
    if (params.quick === '1') return 0;
    const wanted = params.minutes ? Number(params.minutes) : null;
    if (wanted && !Number.isNaN(wanted)) {
      return DURATIONS.reduce(
        (bestIdx, d, i) =>
          Math.abs(d.minutes - wanted) < Math.abs(DURATIONS[bestIdx].minutes - wanted)
            ? i
            : bestIdx,
        0,
      );
    }
    /* Operator, 20 september 2026 ("bij toekomen ook standaard op
       recommended minuten staan"): `st.defaultDuration` is een losse,
       state-brede terugval-index — die valt niet per se samen met de
       TECHNIEK-specifieke `recommended`-duur (zie de technique-picker
       hierboven, die bij het wisselen van techniek al wél naar de
       recommended-duur van DIE techniek springt). Zonder expliciete
       params (quick/minutes) hoort de eerste weergave dus ook op die
       aanbevolen duur te starten, niet op de losse state-terugval. */
    const recIdx = DURATIONS.findIndex((d) => d.recommended);
    const base = recIdx !== -1 ? recIdx : st.defaultDuration;
    /* Operator, 5 okt 2026 ("bij toekomen moet dat op recommended per
       techniek staan"): geen "Too long/Too short"-bijsturing meer op dit
       scherm (die van 2 okt) — die liet je naast de aanbevolen duur landen.
       De bijsturing blijft wel gelden voor de instant-sessies zelf. */
    return Math.max(0, Math.min(DURATIONS.length - 1, base));
  });
  /* Operator, 10 september 2026: "custom is bedoeld om meer min in te
     kunnen instellen dan de max op de bestaande knoppen" — een vrij
     instelbare duur naast de vaste presets. `isCyclesBased` (4-7-8, dat
     `cycles` i.p.v. `minutes` gebruikt) krijgt GEEN custom-optie: dat volgt
     Weil's exacte opbouwschema (4 → 8 cycli), niet iets om vrij te kiezen.
     Voor de rest: begrensd tussen de kleinste bestaande preset en ofwel de
     grootste bestaande preset (technieken in `NO_EXTEND_TECHNIQUE_KEYS`,
     zie toelichting daar) ofwel `CUSTOM_CEILING_MIN` (de andere, op
     onderzoek gebaseerde bovengrens). */
  const isCyclesBased = DURATIONS.some((d) => d.cycles != null);
  /** Aanbevolen waarde (minuten, of cycli bij 4-7-8) voor dit niveau. */
  const recValue =
    recommendedForLevel(st.key, baseTech.key, userLevel) ??
    (() => {
      const d = DURATIONS.find((x) => x.recommended);
      return d ? (d.cycles ?? d.minutes) : null;
    })();
  const presetMinutes = DURATIONS.map((d) => d.minutes);
  const presetMinMinutes = Math.min(...presetMinutes);
  const presetMaxMinutes = Math.max(...presetMinutes);
  const customMaxMinutes = NO_EXTEND_TECHNIQUE_KEYS.has(tech.key)
    ? presetMaxMinutes
    : CUSTOM_CEILING_MIN;

  const [customSelected, setCustomSelected] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(presetMinMinutes);

  /* Operator, 24 september 2026 ("cijferweergave + losse knoppen + slider
     vervangen door één wheel picker"): voedt `DurationWheel` hieronder —
     cyclus-gebaseerde technieken (4-7-8) krijgen enkel hun vaste presets
     (geen vrije tussenwaarden, zelfde grens als voorheen bij
     `DurationSegmentedControl`); de rest krijgt elke hele minuut tussen de
     kleinste preset en `customMaxMinutes`, exact het bereik dat
     `DurationSlider` hiervoor al gebruikte. */
  const durationWheelOptions = isCyclesBased
    ? DURATIONS.map((d) => ({ value: d.minutes, label: fmtClock(d.minutes) }))
    : Array.from({ length: customMaxMinutes - presetMinMinutes + 1 }, (_, i) => {
        const v = presetMinMinutes + i;
        return { value: v, label: fmtClock(v) };
      });

  /* Operator, 24 september 2026 ("je begrijpt het niet — eerder had jij
     toch per tijdzone ingedeeld, bv 2 tot 5 min is Quick, 10 tot 15 is
     ..."): niet exacte-waarde-matching (enkel het letterlijke preset-getal
     toont een naam), maar echte ZONES — elke DURATIONS-preset "bezit" het
     bereik van halverwege de vorige preset tot halverwege de volgende, en
     ELKE minuut daarbinnen toont die naam, niet enkel het exacte punt. De
     eerste zone start bij `presetMinMinutes`, de laatste loopt door tot
     `customMaxMinutes`. Puur een WEERGAVE-laag — welke minuut je exact
     kiest (`chosen.minutes`) blijft ongewijzigd, enkel welke naam/
     "Recommended" ernaast getoond wordt verandert. */
  const durationZones = isCyclesBased
    ? DURATIONS.map((d) => ({ ...d, start: d.minutes, end: d.minutes }))
    : [...DURATIONS]
        .sort((a, b) => a.minutes - b.minutes)
        .map((d, i, sorted) => ({
          ...d,
          start: i === 0 ? presetMinMinutes : Math.ceil((sorted[i - 1].minutes + d.minutes) / 2),
          end:
            i === sorted.length - 1
              ? customMaxMinutes
              : Math.ceil((d.minutes + sorted[i + 1].minutes) / 2) - 1,
        }));
  const zoneFor = (minutes: number) =>
    durationZones.find((z) => minutes >= z.start && minutes <= z.end);
  const recommendedZone = durationZones.find((z) => z.recommended);

  const chosen = customSelected
    ? {
        minutes: customMinutes,
        rounds: roundsFor(tech, customMinutes),
        name: 'Custom',
        why: '',
      }
    : DURATIONS[Math.min(durationIdx, DURATIONS.length - 1)];
  const maxDurationVal = isCyclesBased
    ? Math.max(...DURATIONS.map((d) => d.cycles ?? d.minutes))
    : Math.max(presetMaxMinutes, customMaxMinutes);
  const chosenVal = chosen.cycles ?? chosen.minutes;
  const isRecommendedChoice = recValue != null && chosenVal === recValue;
  const [levelSeen] = useSetting('breathLevelSeen');
  const prevSeen = levelSeen[levelSeenKey(st.key, baseTech.key)];
  const steppedUp =
    !!prevSeen &&
    ['beginner', 'intermediate', 'advanced'].indexOf(userLevel) >
      ['beginner', 'intermediate', 'advanced'].indexOf(prevSeen);
  /* Operator, 5 okt 2026 ("als 5 een volle cirkel is, mag 2 min niet leeg
     zijn"): gevuld vanaf nul, niet vanaf de kortste keuze — de cirkel toont
     het deel van de langste duur van deze techniek. */
  const fillRatio = maxDurationVal > 0 ? Math.min(1, chosenVal / maxDurationVal) : 0.5;
  const waterlineY = useMemo(() => {
    const EMPTY_Y = WAVE_D * 0.86;
    /* Operator, 10 september 2026: "bij max minuten moet de cirkel
       helemaal vol zijn" — stond op 0.32 (dus altijd zo'n 68% gevuld op
       zijn hoogst, nooit echt "vol"). Naar 0.04: bij fillRatio 1 staat de
       waterlijn vlak onder de bovenkant van de cirkel, wat wél als
       "helemaal vol" leest. De golfpieken zelf steken er nog een klein
       beetje bovenuit, maar de ring clipt dat sowieso af
       (`overflow:'hidden'`), dus geen zichtbaar lek. */
    const FULL_Y = WAVE_D * 0.04;
    return EMPTY_Y - (EMPTY_Y - FULL_Y) * fillRatio;
  }, [fillRatio]);
  /* Operator, 19 september 2026 ("golven moeten vloeiend stijgen/dalen
     met een licht 'slosh'-effect na") — `waterlineY` hierboven was een
     kale React-waarde: elke wissel van duur liet de golven instant naar
     hun nieuwe positie SPRINGEN, geen beweging. Een `withSpring` met een
     lage demping laat het niveau natuurkundig licht doorschieten en
     terugveren voor het stabiliseert — exact het gevraagde na-golven —
     zonder een aparte, losse "slosh"-animatie te hoeven bouwen. De
     path-string zelf wordt nu per frame op de UI-thread herberekend
     (`useAnimatedProps`, worklet) i.p.v. één keer per React-render. */
  const waterlineYSV = useSharedValue(waterlineY);
  useEffect(() => {
    waterlineYSV.value = withSpring(waterlineY, {
      damping: 8,
      stiffness: 90,
      mass: 1,
    });
  }, [waterlineY, waterlineYSV]);
  const wavePathBackProps = useAnimatedProps(() => {
    const baseY = waterlineYSV.value + 6;
    const amp = 9;
    const period = WAVE_D;
    return {
      d: `M0 ${baseY}
       C ${period * 0.25} ${baseY - amp}, ${period * 0.25} ${baseY + amp}, ${period * 0.5} ${baseY}
       C ${period * 0.75} ${baseY - amp}, ${period * 0.75} ${baseY + amp}, ${period} ${baseY}
       C ${period * 1.25} ${baseY - amp}, ${period * 1.25} ${baseY + amp}, ${period * 1.5} ${baseY}
       C ${period * 1.75} ${baseY - amp}, ${period * 1.75} ${baseY + amp}, ${period * 2} ${baseY}
       L ${period * 2} ${WAVE_D} L 0 ${WAVE_D} Z`,
    };
  });
  const wavePathFrontProps = useAnimatedProps(() => {
    const baseY = waterlineYSV.value - 4;
    const amp = 7;
    const period = WAVE_D;
    return {
      d: `M0 ${baseY}
       C ${period * 0.25} ${baseY - amp}, ${period * 0.25} ${baseY + amp}, ${period * 0.5} ${baseY}
       C ${period * 0.75} ${baseY - amp}, ${period * 0.75} ${baseY + amp}, ${period} ${baseY}
       C ${period * 1.25} ${baseY - amp}, ${period * 1.25} ${baseY + amp}, ${period * 1.5} ${baseY}
       C ${period * 1.75} ${baseY - amp}, ${period * 1.75} ${baseY + amp}, ${period * 2} ${baseY}
       L ${period * 2} ${WAVE_D} L 0 ${WAVE_D} Z`,
    };
  });

  /* Operator, 9 september 2026: "nu staat er al iets in kleur wanneer user
     op pagina komt, dit kan verwarrend zijn... anderzijds zou het saai zijn
     als alles donker staat" — opgelost door de eerdere "pas kleur zodra
     aangeraakt"-gating (`techTouched`/`durationTouched`) volledig te laten
     vallen. In plaats daarvan: een SLIMME standaardkeuze (techniek 0, de
     aanbevolen duur) staat vanaf het eerste moment gewoon zichtbaar
     ingevuld — precies zoals de referentiemockup het toont, en zoals elk
     instelscherm werkt ("de app stelde iets voor, tik om te wijzigen" is
     een bekend, ondubbelzinnig patroon — een halfgevuld "wel/niet gekozen"
     scherm was de eigenlijke bron van verwarring, niet de kleur zelf). De
     ring blijft wel iets "opbouwen": ze vult zichzelf één keer van leeg
     naar vol bij het openen van het scherm, als rustige entree-animatie. */
  const heroProgress = useSharedValue(0);
  useEffect(() => {
    /* Operator, 18 september 2026 ("de cirkel dient om de gekozen
       informatie weer te geven, is geen actieve cirkel"): in addToDay is
       dit geen sessie die "start" of "loopt" — de ring toont enkel wat al
       gekozen is, dus meteen stil op zijn eindwaarde i.p.v. de
       entree-animatie van de echte flow hieronder. */
    if (isAddToDay) {
      heroProgress.value = 1;
      return;
    }
    /* Operator, 24 september 2026 (referentiescreenshot, "moet niet blauw
       zijn maar idee"): de boog liep voorheen altijd naar EEN volledige
       cirkel (vaste `1`) als pure intro-animatie, los van de gekozen duur.
       Nu naar `fillRatio` — dezelfde verhouding die de golfvulling al
       gebruikt — zodat de boog zelf ook meteen de gekozen duur toont. */
    heroProgress.value = withTiming(fillRatio, { duration: 650 });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  /* Operator, 24 september 2026 (vervolg): houdt de boog gesynchroniseerd
     bij elke LATERE duur-wijziging (wheel-picker, techniek-wissel, ...) —
     de effect hierboven dekt enkel de allereerste render (intro). Skip de
     eerste keer, want dat IS al die intro-animatie; zonder deze wacht zou
     hij dubbel afvuren en een ongewenste tweede sprong geven. */
  const skipFirstFillSync = useRef(true);
  useEffect(() => {
    if (skipFirstFillSync.current) {
      skipFirstFillSync.current = false;
      return;
    }
    heroProgress.value = withTiming(fillRatio, { duration: 400 });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [fillRatio]);

  const heroRingProps = useAnimatedProps(() => ({
    strokeDashoffset: HERO_C * (1 - heroProgress.value),
  }));
  /* Operator, 10 okt 2026 ("kunnen we de tijd ook via de cirkel zelf
     doen?"): zelfde greep en gebaar als State Control — sleep over de rand,
     de greep springt naar de dichtstbijzijnde toegelaten duur (bij ademrondes
     zijn dat vaste stappen), met een fijne tik per stap. */
  const heroKnobProps = useAnimatedProps(() => {
    const a = -Math.PI / 2 + heroProgress.value * 2 * Math.PI;
    return { cx: 16 + HERO_SIZE / 2 + HERO_R * Math.cos(a), cy: 16 + HERO_SIZE / 2 + HERO_R * Math.sin(a) };
  });
  const dialStops = durationWheelOptions.map((o) => {
    const d = DURATIONS.find((x) => x.minutes === o.value);
    const v = isCyclesBased ? (d?.cycles ?? d?.minutes ?? o.value) : o.value;
    return { value: o.value, ratio: maxDurationVal > 0 ? v / maxDurationVal : 0 };
  });
  const dialStopsRef = useRef(dialStops);
  dialStopsRef.current = dialStops;
  const lastDialValue = useRef(chosen.minutes);
  lastDialValue.current = chosen.minutes;
  const onDialFrac = (f: number) => {
    const stops = dialStopsRef.current;
    if (!stops.length) return;
    let best = stops[0];
    for (const st0 of stops) if (Math.abs(st0.ratio - f) < Math.abs(best.ratio - f)) best = st0;
    if (best.value === lastDialValue.current) return;
    lastDialValue.current = best.value;
    hapticTick();
    const presetIdx = DURATIONS.findIndex((d) => d.minutes === best.value);
    if (presetIdx !== -1) {
      setCustomSelected(false);
      setDurationIdx(presetIdx);
    } else {
      setCustomMinutes(best.value);
      setCustomSelected(true);
    }
  };
  const dialFracSV = useSharedValue(0);
  const openTechInfo = () => setInfoModal({ title: tech.name, techniqueKey: tech.key });
  const heroTap = Gesture.Tap()
    .maxDistance(10)
    .onEnd((_e, ok) => {
      if (ok) scheduleOnRN(openTechInfo);
    });
  const heroDialPan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e, manager) => {
      const t = e.allTouches[0];
      const c = HERO_SIZE / 2;
      const d = Math.hypot(t.x - c, t.y - c);
      if (d > c * 0.7 && d < c * 1.3) manager.activate();
      else manager.fail();
    })
    .onStart(() => {
      dialFracSV.value = heroProgress.value;
    })
    .onUpdate((e) => {
      const c = HERO_SIZE / 2;
      let f = Math.atan2(e.x - c, -(e.y - c)) / (2 * Math.PI);
      if (f < 0) f += 1;
      let delta = f - dialFracSV.value;
      if (delta > 0.5) delta -= 1;
      if (delta < -0.5) delta += 1;
      const nf = Math.min(1, Math.max(0, dialFracSV.value + delta));
      dialFracSV.value = nf;
      scheduleOnRN(onDialFrac, nf);
    });
  const heroDial = Gesture.Exclusive(heroDialPan, heroTap);


  /* Operator, 24 september 2026 ("bolletje op het uiteinde van de boog" →
     "moet niet cirkel zijn, mag ook rechthoek met afgeronde hoeken"):
     zelfde hoek-wiskunde als de boog zelf — `rotation={-90}` op de Circle
     hieronder betekent progress 0 start bovenaan (12u), en de boog loopt
     met de klok mee naarmate `heroProgress` stijgt. Nu een klein afgerond
     vierkantje (`Rect`, `x`/`y` = linkerbovenhoek) i.p.v. een `Circle`. */
  const HERO_DOT_SIZE = 12;
  const heroDotProps = useAnimatedProps(() => {
    const angle = (-90 + heroProgress.value * 360) * (Math.PI / 180);
    return {
      x: HERO_SIZE / 2 + HERO_R * Math.cos(angle) - HERO_DOT_SIZE / 2,
      y: HERO_SIZE / 2 + HERO_R * Math.sin(angle) - HERO_DOT_SIZE / 2,
    };
  });

  /* Operator, 9 september 2026: "enkel over de lijn van de cirkel zelf...
     moet doorlopen en uitfaden, niet terugtrekken telkens" — twee fixes:
     (1) ÉÉN richting (linksonder → rechtsboven), geen heen-en-terug meer.
     Na de sweep springt de waarde onzichtbaar terug naar het beginpunt
     (buiten beeld, dus geen zichtbare "snap") — exact hetzelfde patroon
     als de bestaande CTA-shimmer in (tabs)/breath.tsx.
     (2) Geclipt tot ENKEL de ringlijn via een goedkope "donut"-truc:
     twee gewone cirkel-Views (`heroShineMask` = buitenrand, een
     effen-achtergrond "punch"-cirkel erbovenop = binnenrand geponst),
     geen SVG-`<Mask>` (dat rasterde elke frame opnieuw en deed de golven
     haperen). */
  const shimmer = useSharedValue(-1);
  useEffect(() => {
    /* Operator, 18 september 2026 ("geen actieve cirkel"): de flits-sweep
       hoort bij de echte, lopende sessie-ervaring — in addToDay blijft
       `shimmer` gewoon op -1 staan, wat `shineStyle` hieronder al
       onzichtbaar maakt (zie de interpolate-curve), dus geen doorlopende
       loop nodig/gewenst. */
    if (isAddToDay) return;
    shimmer.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(7000, withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) })),
        withDelay(600, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
    /* Zie eerdere toelichting: cleanup voorkomt dat oude, "verweesde"
       loops (bij Fast Refresh) blijven meedraaien naast nieuwe. */
    return () => cancelAnimation(shimmer);
  }, []);
  /* Operator, 9 september 2026: "op het einde blijft de flits hangen,
     moet al beginnen verdwijnen voor het eindpunt" — de positie liep tot
     shimmer=1 en bleef daar even ZICHTBAAR staan tijdens de pauze
     (`withDelay(600, ...)` hierboven). Losgekoppelde opacity-curve: al
     volledig uitgefaded ruim vóór shimmer de eindwaarde bereikt (0.55),
     dus tegen de tijd dat de positie "aankomt" is er niets meer te zien
     — geen hangend eindpunt, wat overblijft van de pauze is onzichtbaar. */
  const shineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      shimmer.value,
      [-1, -0.85, 0.55, 1],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [{ translateX: shimmer.value * HERO_SIZE * 0.75 }, { rotate: '45deg' }],
  }));

  /* Twee golf-lagen, continu naar links schuivend — zie de uitleg bij
     `WAVE_D`/`buildWavePath` hierboven. Verschillende duur per laag geeft
     een rustig, niet-synchroon "vloeistof"-gevoel i.p.v. één vlak patroon
     dat als geheel op-en-neer beweegt. */
  const wave1X = useSharedValue(0);
  const wave2X = useSharedValue(0);
  useEffect(() => {
    /* Operator, 18 september 2026 ("geen actieve cirkel, dient om gekozen
       info weer te geven"): het doorlopend schuivende "vloeistof"-effect
       hoort bij een ECHTE, lopende sessie — in addToDay blijft het
       waterpeil (zie `waterlineY`/`fillRatio` hierboven, die tonen wél nog
       gewoon de gekozen duur) gewoon stilstaan i.p.v. continu bewegen. */
    if (isAddToDay) return;
    wave1X.value = withRepeat(
      withTiming(-WAVE_D, { duration: 5200, easing: Easing.linear }),
      -1,
      false,
    );
    wave2X.value = withRepeat(
      withTiming(-WAVE_D, { duration: 3600, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(wave1X);
      cancelAnimation(wave2X);
    };
  }, []);
  const wave1Style = useAnimatedStyle(() => ({ transform: [{ translateX: wave1X.value }] }));
  const wave2Style = useAnimatedStyle(() => ({ transform: [{ translateX: wave2X.value }] }));

  /* Operator, 7 september 2026: "te veel info en tekst in de breathing
     rhythm [kaarten]" — de volledige `explain`-zin (een echte, langere
     legitieme zin, geen mockup-tekst) staat achter een (i)-icoon i.p.v.
     los op het scherm.
     Operator, 9 september 2026 (2e ronde): "nu ook lange uitleg" — dezelfde
     klacht als bij de RHYTHMS-popup op de Breath-tab. Zelfde fix: de popup
     toont niet langer de volle `explain`-alinea, enkel het cijferpatroon +
     de korte "hook"-zin (`utils/technique-copy.ts`, gedeeld met die andere
     popup). Vandaar `techniqueKey` i.p.v. losse title/body-strings — de
     modal haalt zelf icoon/patroon/hook op uit de techniek. */
  const [infoModal, setInfoModal] = useState<null | {
    title: string;
    techniqueKey: string;
  }>(null);
  /* Operator, 24 september 2026 ("gaan gebruikers weten waar dat voor is,
     die sessies?" → "of i icoon"): een zone-naam als "Flow Entry" legt
     zichzelf niet uit — de data heeft al een `why`-zin per duur (precies
     hiervoor bedoeld), maar die stond nergens in de wheel-UI. Zelfde
     "i"-icoon-naar-modal-patroon als de techniek-info hierboven, i.p.v.
     de tekst er altijd bij te proppen (te veel voor de kleine kaart). */
  const [durationInfoOpen, setDurationInfoOpen] = useState(false);
  /* Keuzelijst van de drie technieken (5 okt 2026). */


  /* Operator, 17 september 2026 (addToDay, "gewoon alles wat nodig is op
     1 kaart"): tijdstip erbij, enkel relevant in deze modus — de normale
     flow start meteen, die heeft geen "wanneer" nodig.
     Operator, 18 september 2026 ("alles moet op een standaard uur staan om
     te beginnen bv. morning 7u"): het vroegste uur van het venster
     (`SLOT_WINDOW[...].from`, bv. 4u voor morning) is geen realistisch
     standaarduur — een "typisch" moment per dagdeel i.p.v. het venster se
     eigen randwaarde. */
  const [time, setTime] = useState<number>(() => {
    if (params.time) {
      const t = Number(params.time);
      if (!Number.isNaN(t)) return t;
    }
    return SLOT_DEFAULT_TIME[slotForTime] ?? SLOT_WINDOW[slotForTime].from * 60;
  });
  const fmtTimeOfDay = (mins: number) => {
    const d = new Date();
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };
  /* Operator, 18 september 2026 ("kunnen we deze richting gaan" — nieuwe
     mockup: ring bovenaan, daaronder 4 kaartjes Time/State/Technique/
     Duration die elk een eigen kiezer openen i.p.v. het wiel/carrousel/
     techniek-rij/duur-dials los op de pagina): welk kiezer-scherm open
     staat, of geen. Vervangt `stateInfoModal` (die was enkel een info-
     popup bij tikken op de oude carrousel, die carrousel bestaat niet
     meer). */
  const [activePicker, setActivePicker] = useState<
    'time' | 'state' | 'technique' | 'duration' | 'horizon' | null
  >(null);
  /* Operator, 18 september 2026 ("tijd moet gebruiker boven de scroll ook
     digitaal kunnen invoeren... us en eu tijdsnotering?"): 12u (AM/PM) of
     24u volgt automatisch het toestel se eigen locale — zelfde detectie
     als `toLocaleTimeString` elders al impliciet doet, hier expliciet
     nodig om te weten of er een AM/PM-schakelaar bij moet. */
  const uses12hClock = /AM|PM/i.test(
    new Date(2020, 0, 1, 13, 0, 0).toLocaleTimeString(),
  );
  const timeWindow = SLOT_WINDOW[slotForTime];
  const timeWindowMin = timeWindow.from * 60;
  const timeWindowMax = timeWindow.to * 60 - 1;
  /* Lokale tekst-buffers voor de HH/MM-velden — een gecontroleerd veld dat
     rechtstreeks aan `time` gekoppeld is herformatteert bij elke toets
     (bv. "1" wordt meteen "01"), wat halverwege typen van "12" al terug
     naar "1" springt. Deze buffers volgen `time` enkel wanneer het van
     BUITENAF verandert (het wiel hierboven, of het openen van deze
     kiezer) en committen zelf pas bij het verlaten van het veld. */
  const [hourText, setHourText] = useState('');
  const [minuteText, setMinuteText] = useState('');
  useEffect(() => {
    if (activePicker !== 'time') return;
    const h24 = Math.floor(time / 60);
    const h12 = ((h24 + 11) % 12) + 1;
    setHourText(String(uses12hClock ? h12 : h24));
    setMinuteText(String(time % 60).padStart(2, '0'));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [activePicker]);
  const commitDigitalTime = (nextHourText: string, nextMinuteText: string, pm: boolean) => {
    const hRaw = parseInt(nextHourText, 10);
    const mRaw = parseInt(nextMinuteText, 10);
    if (Number.isNaN(hRaw) || Number.isNaN(mRaw)) return;
    let h24 = uses12hClock ? (hRaw % 12) + (pm ? 12 : 0) : hRaw;
    h24 = Math.max(0, Math.min(23, h24));
    /* Operator, 18 september 2026 ("we hebben nu scroll per 15 min EN
       digitaal vrij in te vullen, dat lijkt me niet te kloppen"): terecht —
       vrije minuten zouden een waarde kunnen opleveren die op het wiel
       (kwartier-stappen) niet bestaat. Rond af naar het dichtstbijzijnde
       kwartier, zelfde 15-min-raster als `timeOptionsForSlot`. */
    const mSnapped = Math.round(Math.max(0, Math.min(59, mRaw)) / 15) * 15;
    const mFinal = mSnapped === 60 ? 45 : mSnapped;
    /* Operator, vervolg ("maar dat tussen vooropgesteld tijdzone... tussen
       welke tijd bijzetten"): de vrije invoer mag het venster van dit
       dagdeel niet verlaten (`SLOT_WINDOW`, dezelfde grens als het wiel) —
       geklemd i.p.v. genegeerd, zodat een net-buiten-bereik tik toch het
       dichtstbijzijnde geldige moment oplevert i.p.v. niets te doen. */
    const clamped = Math.max(timeWindowMin, Math.min(timeWindowMax, h24 * 60 + mFinal));
    hapticTap();
    setTime(clamped);
    /* Operator, 18 september 2026 ("pas na aanklikken Done is handeling
       klaar"): `timeTouched` gaat pas aan bij "Done" (zie de sheet-header
       hierboven), niet meer bij elke los HH/MM-tikje. */
    /* Operator, vervolg ("bij setten past dat niet aan in scherm"): de
       velden moeten na een klem/afronding ook zelf de ECHTE, toegepaste
       waarde tonen — anders blijft bv "07:22" op het scherm staan terwijl
       de effectieve tijd (kwartier-geklemd, binnen het venster) iets
       anders is. */
    const finalH24 = Math.floor(clamped / 60);
    const finalH12 = ((finalH24 + 11) % 12) + 1;
    setHourText(String(uses12hClock ? finalH12 : finalH24));
    setMinuteText(String(clamped % 60).padStart(2, '0'));
  };
  /* Leesbare dagdeel-naam voor de CTA-tekst ("Add to morning") — kleine
     lokale kopie i.p.v. een import van `SLOTS` uit reminders.ts, want
     enkel de weergavetekst is hier nodig, niet de rest van die SlotDef. */
  const SLOT_LABEL: Record<PlanSlot, string> = {
    morning: 'morning',
    midday: 'midday',
    afterWork: 'after work',
    evening: 'evening',
  };

  /* Operator, 17 september 2026 ("als gebruiker overlappende tijden
     kiezen mag dat niet, moet melding komen"): interval-overlap tegen de
     andere sessies in ditzelfde dagdeel (meegegeven door build-your-
     day.tsx) — [tijd, tijd+duur) mag nooit een bestaand [start, start+
     duur) van dat dagdeel raken. Herberekend bij elke wijziging van tijd
     ÉN duur, dus je ziet het meteen, niet pas na "Add to day". */
  const existingSessions = useMemo<{ reminderAt: number; minutes: number }[]>(() => {
    if (!params.existing) return [];
    try {
      return JSON.parse(params.existing);
    } catch {
      return [];
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);
  /* Operator, 18 september 2026 ("als ik nieuwe sessie wil adden krijg ik
     na plus onmiddellijk de melding overlap... zonder dat ik iets
     ingevuld heb"): `time` staat intern al op een slimme standaard vóór
     de gebruiker Time ooit aanraakt (zelfde patroon als `selState` — zie
     de toelichting bij de State-tegel hierboven), enkel de TEGEL zelf
     toont "—" tot een echte tik. Deze check keek naar die interne
     standaardwaarde zonder `timeTouched` mee te wegen, dus als de
     standaardtijd toevallig samenviel met een bestaande sessie verscheen
     de waarschuwing al bij het openen van het scherm — vóór de gebruiker
     ook maar iets gekozen had. Nu pas relevant zodra Time ook echt
     bevestigd is. */
  const overlapError = useMemo(() => {
    if (!isAddToDay || !timeTouched || existingSessions.length === 0) return null;
    const start = time;
    const end = time + chosen.minutes;
    const hit = existingSessions.find(
      (s2) => start < s2.reminderAt + s2.minutes && s2.reminderAt < end,
    );
    return hit ? `Overlaps with your ${fmtTimeOfDay(hit.reminderAt)} session` : null;
  }, [isAddToDay, timeTouched, existingSessions, time, chosen.minutes]);

  /* Operator, 18 september 2026 ("add knop mag niet werken alvorens alles
     gekozen is... die moeten zelf op knop state time technique en duration
     tikken om te kiezen" → later herzien: "cta wordt nu actief na duration
     maar mag pas na plan length en vinkje actief zijn"): alle 5 velden,
     Plan length nu ook expliciet vereist — de eerdere uitzondering
     ("protocol-breed, heeft al een werkende standaard") gold niet meer
     zodra de operator zag dat de knop al vóór die 5e stap aanklikbaar
     werd. */
  const addToDayReady =
    stateTouched && timeTouched && techniquePicked && durationTouched && horizonTouched;

  /* Operator, 18 september 2026 ("ook een kleine reset knop als gebruiker
     opnieuw wil beginnen hier"): zet alles terug naar de lege, "nog niets
     bevestigd"-staat (zie `AddToDayHero`'s neutrale cirkel hierboven) —
     zelfde slimme standaardwaarden als bij een gloednieuwe sessie, niet
     zomaar cijfers op 0. Werkt ook tijdens het bewerken van een bestaande
     sessie (`isEditingSession`) — "opnieuw beginnen" mag daar ook. */
  const resetAll = () => {
    hapticPress();
    setSelState(smartDefaultState);
    setTechIdx(defaultTechIdxFromExperience(BREATH_STATES[smartDefaultState].techniques.length - 1));
    setTechniquePicked(false);
    setDurationIdx(0);
    setCustomSelected(false);
    setTime(SLOT_DEFAULT_TIME[slotForTime] ?? SLOT_WINDOW[slotForTime].from * 60);
    setHorizon((params.horizon as PlanHorizon) || '2w');
    setTimeTouched(false);
    setStateTouched(false);
    setDurationTouched(false);
    setHorizonTouched(false);
  };

  const addToDay = () => {
    if (overlapError || !addToDayReady) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const editIndex = params.editIndex ? Number(params.editIndex) : null;
    setDraftSession(
      {
        slot: slotForTime,
        state: selState,
        techniqueKey: tech.key,
        minutes: chosen.minutes,
        reason: 'Your pick',
        reminderAt: time,
      },
      editIndex !== null && !Number.isNaN(editIndex) ? editIndex : null,
      horizon,
    );
    router.back();
  };

  const startSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    /* Operator, 7 september 2026: elke plek die een sessie START claimt de
       ene gratis kennismakingssessie indien nog niet verbruikt — zelfde
       patroon als (tabs)/breath.tsx, plan.tsx en agenda.tsx, zodat het
       niet uitmaakt via welk scherm de user zijn eerste sessie start. */
    const freeParam = claimFreeSessionParam();
    setSetting('breathLevelSeen', { ...levelSeen, [levelSeenKey(st.key, baseTech.key)]: userLevel });
    openBreathSession({
        ...freeParam,
        mode: st.key,
        technique: tech.key,
        /* Zelfde ritme als hier getoond (utils/breath-level.ts). */
        level: userLevel,
        minutes: String(chosen.minutes),
        autostart: '1',
        /* Operator, 10 september 2026: custom-duur — zonder deze vlag zou
           breath-session.tsx `minutes` naar de DICHTSTBIJZIJNDE preset
           afronden (zijn bestaande gedrag voor een technique-gebonden
           duur-param) en de custom-waarde stilletjes negeren. */
        ...(customSelected ? { customDuration: '1' } : {}),
        /* Operator, 11 september 2026: "bij stoppen zie ik enkele
           seconden het oude set session pagina" — dit scherm zit als
           `router.push` op de stack ONDER breath-session.tsx, dus een
           plein `router.back()` daar popt terug hierheen (echt, geen
           bug op zich) vóór breath-session.tsx zelf verder navigeert.
           Deze vlag laat breath-session.tsx weten dat 'm overslaan
           moet — zie de `fromSetup`-check daar. */
        fromSetup: '1',
      });
  };

  /* Operator, 7 september 2026: "back buttons gaan naar welcome
     breathwork, is niet goed, moet terug naar choose your session" — de
     Breath-tab reset zichzelf bij ELKE terugkeer naar zijn eigen
     intro-scherm (`useFocusEffect`, `(tabs)/breath.tsx`), tenzij deze
     bestaande vlag vooraf iets anders zegt. Zonder deze aanroep landde je
     dus altijd op de intro, ook al kwam je van de states-picker.
     Operator, 10 september 2026: "de backknoppen van de telefoon moeten
     enkel 1 pagina terug gaan" — deze fix zat ENKEL op de on-screen pijl.
     De harde/gebaar-terugknop van Android gebruikte de standaard
     stack-pop, die deze aanroep oversloeg — dus kwam je via de telefoon-
     knop niet op het keuzescherm uit maar (omdat breath.tsx zichzelf zonder
     de vlag terugzet) op zijn intro, twee schermen ver ogend i.p.v. één.
     Zelfde functie nu op BEIDE gekoppeld: de knop-tik én de hardware-
     terugknop (`BackHandler`) roepen exact dezelfde `goBack` aan. */
  const goBack = () => {
    skipBreathIntroOnce();
    router.canGoBack() ? router.back() : router.replace('/breath');
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  /* Operator, 17 september 2026: addToDay kreeg twee secties MEER (tijd +
     staat) dan de normale flow, die bewust "alles op 1 scherm zonder
     scroll" is (zie de toelichting hieronder) — daardoor viel de
     duur-slider onderaan achter de vaste footer. Enkel in addToDay wordt
     dit dus een echte ScrollView; de normale flow blijft de kale, vaste
     `View` van voorheen, ongewijzigd. */
  const ContentWrap: typeof View | typeof ScrollView = isAddToDay ? ScrollView : View;

  /* Techniek kiezen (veeg over de cirkel). Springt naar de eigen aanbevolen
     duur van die techniek (operator, 17 september 2026), en een custom-
     waarde van de vorige techniek vervalt — elke techniek heeft eigen
     grenzen (`NO_EXTEND_TECHNIQUE_KEYS`/`CUSTOM_CEILING_MIN`). */
  const pickTechnique = (i: number) => {
    const t = st.techniques[i];
    if (!t) return;
    /* Geen eigen tik-trilling: het wiel geeft die al bij elke stap. */
    setTechIdx(i);
    setTechniquePicked(true);
    const durs = t.durations ?? st.durations;
    const lvl = levelForTechnique(st.key, t.key, breathHistory);
    applyRecommended(durs, recommendedForLevel(st.key, t.key, lvl));
  };

  /* Zet het wiel op de aanbevolen waarde voor het niveau van de gebruiker:
     een preset als die bestaat, anders als vrije duur (bv. Coherent 15). */
  function applyRecommended(durs: DurationDef[], rec: number | null) {
    const presetIdx =
      rec == null ? -1 : durs.findIndex((d) => (d.cycles ?? d.minutes) === rec);
    if (presetIdx !== -1) {
      setDurationIdx(presetIdx);
      setCustomSelected(false);
      return;
    }
    if (rec != null && !durs.some((d) => d.cycles != null)) {
      setCustomMinutes(rec);
      setCustomSelected(true);
      return;
    }
    const dataRec = durs.findIndex((d) => d.recommended);
    setDurationIdx(dataRec !== -1 ? dataRec : 0);
    setCustomSelected(false);
  }

  /* Bij binnenkomst (zonder duur uit een plan of snelkoppeling): op de
     aanbevolen duur van dit niveau. Pas na de eerste render, want de
     geschiedenis en het niveau moeten er zijn. */
  useEffect(() => {
    if (params.quick === '1' || params.minutes || isAddToDay) return;
    applyRecommended(DURATIONS, recValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLevel]);

  /* Operator (druk-vering op elke tikbare knop van dit scherm — cards, CTA
     én icoon-only knoppen, geen uitzonderingen): losse gedeelde waarde per
     knop zodat overlappende drukstaten (die hier niet voorkomen, maar toch)
     elkaar nooit kunnen beïnvloeden. Icoon-only knoppen (terug/reset) krijgen
     een iets subtielere 0.92, kaarten/rijen 0.95, de enkele volle-breedte CTA
     0.96 — zelfde receptuur als `StartCard` in breath-welcome.tsx. */
  const backPressScale = useSharedValue(1);
  const backPressIn = () => { backPressScale.value = withTiming(0.92, { duration: 80 }); };
  const backPressOut = () => { backPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const backPressStyle = useAnimatedStyle(() => ({ transform: [{ scale: backPressScale.value }] }));

  const resetPressScale = useSharedValue(1);
  const resetPressIn = () => { resetPressScale.value = withTiming(0.92, { duration: 80 }); };
  const resetPressOut = () => { resetPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const resetPressStyle = useAnimatedStyle(() => ({ transform: [{ scale: resetPressScale.value }] }));

  const stateTilePressScale = useSharedValue(1);
  const stateTilePressIn = () => { stateTilePressScale.value = withTiming(0.95, { duration: 80 }); };
  const stateTilePressOut = () => { stateTilePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const stateTilePressStyle = useAnimatedStyle(() => ({ transform: [{ scale: stateTilePressScale.value }] }));

  const timeTilePressScale = useSharedValue(1);
  const timeTilePressIn = () => { timeTilePressScale.value = withTiming(0.95, { duration: 80 }); };
  const timeTilePressOut = () => { timeTilePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const timeTilePressStyle = useAnimatedStyle(() => ({ transform: [{ scale: timeTilePressScale.value }] }));

  const techTilePressScale = useSharedValue(1);
  const techTilePressIn = () => { techTilePressScale.value = withTiming(0.95, { duration: 80 }); };
  const techTilePressOut = () => { techTilePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const techTilePressStyle = useAnimatedStyle(() => ({ transform: [{ scale: techTilePressScale.value }] }));

  const durationTilePressScale = useSharedValue(1);
  const durationTilePressIn = () => { durationTilePressScale.value = withTiming(0.95, { duration: 80 }); };
  const durationTilePressOut = () => { durationTilePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const durationTilePressStyle = useAnimatedStyle(() => ({ transform: [{ scale: durationTilePressScale.value }] }));

  const horizonTilePressScale = useSharedValue(1);
  const horizonTilePressIn = () => { horizonTilePressScale.value = withTiming(0.95, { duration: 80 }); };
  const horizonTilePressOut = () => { horizonTilePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const horizonTilePressStyle = useAnimatedStyle(() => ({ transform: [{ scale: horizonTilePressScale.value }] }));

  const changeTimeBtnPressScale = useSharedValue(1);
  const changeTimeBtnPressIn = () => { changeTimeBtnPressScale.value = withTiming(0.94, { duration: 80 }); };
  const changeTimeBtnPressOut = () => { changeTimeBtnPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const changeTimeBtnPressStyle = useAnimatedStyle(() => ({ transform: [{ scale: changeTimeBtnPressScale.value }] }));

  const ctaPressScale = useSharedValue(1);
  /* Operator ("kijk alle CTA's na"): haptiek zat enkel in startSession()
     (Medium, op onPress) — dat blijft staan als apart "sessie is echt
     gestart"-signaal, maar de standaard lichte tik-feedback (huisstijl
     §5, op onPressIn) ontbrak hier volledig. */
  const ctaPressIn = () => {
    ctaPressScale.value = withTiming(0.96, { duration: 80 });
    hapticPress();
  };
  const ctaPressOut = () => { ctaPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const ctaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaPressScale.value }],
    opacity: 1 - (1 - ctaPressScale.value) * 3.75,
  }));

  const modalGotItPressScale = useSharedValue(1);
  const modalGotItPressIn = () => { modalGotItPressScale.value = withTiming(0.95, { duration: 80 }); };
  const modalGotItPressOut = () => { modalGotItPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const modalGotItPressStyle = useAnimatedStyle(() => ({ transform: [{ scale: modalGotItPressScale.value }] }));

  const timeDonePressScale = useSharedValue(1);
  const timeDonePressIn = () => { timeDonePressScale.value = withTiming(0.92, { duration: 80 }); };
  const timeDonePressOut = () => { timeDonePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const timeDonePressStyle = useAnimatedStyle(() => ({ transform: [{ scale: timeDonePressScale.value }] }));

  const stateDonePressScale = useSharedValue(1);
  const stateDonePressIn = () => { stateDonePressScale.value = withTiming(0.92, { duration: 80 }); };
  const stateDonePressOut = () => { stateDonePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const stateDonePressStyle = useAnimatedStyle(() => ({ transform: [{ scale: stateDonePressScale.value }] }));

  const techDonePressScale = useSharedValue(1);
  const techDonePressIn = () => { techDonePressScale.value = withTiming(0.92, { duration: 80 }); };
  const techDonePressOut = () => { techDonePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const techDonePressStyle = useAnimatedStyle(() => ({ transform: [{ scale: techDonePressScale.value }] }));

  const durationDonePressScale = useSharedValue(1);
  const durationDonePressIn = () => { durationDonePressScale.value = withTiming(0.92, { duration: 80 }); };
  const durationDonePressOut = () => { durationDonePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const durationDonePressStyle = useAnimatedStyle(() => ({ transform: [{ scale: durationDonePressScale.value }] }));

  const horizonDonePressScale = useSharedValue(1);
  const horizonDonePressIn = () => { horizonDonePressScale.value = withTiming(0.92, { duration: 80 }); };
  const horizonDonePressOut = () => { horizonDonePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const horizonDonePressStyle = useAnimatedStyle(() => ({ transform: [{ scale: horizonDonePressScale.value }] }));

  /* Operator, 24 september 2026 ("Apple-sheet i.p.v. gecentreerde popup
     voor de duration-info"): los van `durationDonePressScale` hierboven —
     die hoort al bij de WAARDE-kiezer-sheet (de scroll-wheel), dit is de
     losse INFO-sheet (i-icoon). Zelfde druk-animatie-recept, eigen
     SharedValue zodat de twee onafhankelijk blijven. */
  const durationInfoDonePressScale = useSharedValue(1);
  const durationInfoDonePressIn = () => { durationInfoDonePressScale.value = withTiming(0.92, { duration: 80 }); };
  const durationInfoDonePressOut = () => { durationInfoDonePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const durationInfoDonePressStyle = useAnimatedStyle(() => ({ transform: [{ scale: durationInfoDonePressScale.value }] }));

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Operator, 5 okt 2026 ("het scherm is zeer onoverzichtelijk, overal
         staat iets"): de toestandsfoto als achtergrond is weer weg — de
         gezichten waren ruis achter alles. De sfeer komt uit de kleur van de
         toestand in de cirkel. */}

      {/* Operator, 11 september 2026: "weg met saai wit, een zachte
         paarse gloed bovenin achter de cirkel" — anders dan de eerder
         VERWIJDERDE glow rond de ring zelf (zie de toelichting bij
         `heroWrap` hieronder, "ik had de glow niet gevraagd"): dit is geen
         gloed OP de ring, maar een extreem vage achtergrond-gloed die de
         off-white achtergrond wat leven geeft, enkel in light. */}
      {light && (
        <LinearGradient
          pointerEvents="none"
          colors={[glowAccent, 'transparent']}
          style={s.bgGlow}
        />
      )}

      <View style={[s.bar, { top: insets.top }]}>
        <AnimatedPressable
          onPress={goBack}
          onPressIn={backPressIn}
          onPressOut={backPressOut}
          hitSlop={14}
          style={[s.iconBtn, backPressStyle]}
          accessibilityLabel="Back"
        >
          {/* Operator, 1 okt 2026 ("headers overal consistent"): size
             22→20, stroke 2.2→2.8 — de "officiële iOS-chevron.backward"-
             stijl uit build-choice.tsx (18 sept), nu de app-brede
             standaard. */}
          <ChevronLeft size={20} color={C.text} strokeWidth={2.8} />
        </AnimatedPressable>
        {/* Operator, 18 september 2026 ("een kleine reset knop als
           gebruiker opnieuw wil beginnen hier"): vervangt de Settings-knop
           enkel voor addToDay — "instellingen" is hier geen zinvolle
           bestemming (dit is een sessie-editor, geen app-instelscherm),
           "opnieuw beginnen" wel. De normale flow (Breath-tab → dit
           scherm) behoudt de bestaande Settings-link ongewijzigd. */}
        {isAddToDay ? (
          <AnimatedPressable
            onPress={resetAll}
            onPressIn={resetPressIn}
            onPressOut={resetPressOut}
            hitSlop={14}
            style={[s.iconBtn, resetPressStyle]}
            accessibilityLabel="Start over"
          >
            <RotateCcw size={18} color={C.text} strokeWidth={2.2} />
          </AnimatedPressable>
        ) : (
          /* Operator, 19 september 2026 ("het grijze instellingen-
             tandwiel rechtsboven definitief verwijderen — radicale rust"):
             herroept de 13 september-terugplaatsing hierboven. Een lege
             spacer i.p.v. gewoon niets renderen, zodat de titel ertussen
             (elders op dit scherm) symmetrisch gecentreerd blijft t.o.v.
             de terug-knop links. */
          <View style={s.iconBtn} />
        )}
      </View>

      {/* Operator, 7 september 2026: "alles op 1 scherm zonder scroll" —
         zelfde harde regel als de onboarding-schermen. Geen ScrollView,
         vaste compacte maten.
         Operator, 9 september 2026: "de bol hoger, alles moet meer
         ademen" — terug top-uitgelijnd (niet verticaal gecentreerd) zodat
         de ring vlak onder de statenaam staat i.p.v. halverwege het
         scherm, met ruimere marges tussen elk blok eronder in plaats van
         één leeg gat op het einde. */}
      <ContentWrap
        style={isAddToDay ? s.scrollGrow : [s.scroll, { flex: 1 }]}
        contentContainerStyle={isAddToDay ? s.scrollContent : undefined}
        showsVerticalScrollIndicator={false}
      >
        {/* Operator, 17 september 2026 (addToDay, herzien: "de cirkel moet
           bovenaan en de instellingen beginnen eronder... tijd van de dag
           instellen via wielscroller, mooi in eigen card, erronder states
           daaronder techniek daaronder session duration") — de ring is nu
           het openingsanker, Tijd/Staat/Techniek/Duur volgen eronder in
           die volgorde. Enkel de JSX-volgorde is aangepast; elk blok zelf
           (en de normale, niet-addToDay volgorde stateHeader→ring→
           technieken→duur direct erna) is ongewijzigd. */}

        {/* Operator, 18 september 2026 ("bovenaan calm control moet weg,
           daar misschien het dagdeel"): in addToDay komt geen statenaam
           meer bovenaan — `AddToDayHero` hieronder toont het dagdeel
           bovenin de ring zelf i.p.v. hier los erboven. De normale flow
           (Breath-tab → dit scherm) blijft ONGEWIJZIGD: enkel die toont dit
           kopje nog. */}
        {!isAddToDay && (
        <View style={s.stateHeader}>
          {/* Operator, 10 okt 2026 (zelfde opbouw als State Control, daar
              "SESSION CONTROL"): algemene titel bovenaan, de toestand staat
              nu in de cirkel. */}
          <Text style={s.stateHeaderTxt} numberOfLines={1}>
            BREATHWORK
          </Text>
          {/* Operator, 5 okt 2026 ("heel druk — de 'From high activation…'-
             tekst mag weg"): enkel nog de naam van de toestand. */}
        </View>
        )}

        {/* Operator, 18 september 2026 ("cirkel mag groter en in het
           midden, binnenkant gevuld met kleur van state, geen golven dus,
           lijn dikker en wit, vult zich per gekozen functie, opsomming
           Time/State/Technique/Duration in de cirkel"): een volledig
           eigen, eenvoudiger ring voor addToDay — geen golven/shine/
           donut-mask-trucs nodig (dat hoorde bij de "levende" sessie-ring
           hieronder), zie `AddToDayHero` verderop in dit bestand. */}
        {isAddToDay && (
          <AddToDayHero
            accent={st.accent}
            photo={ADD_HERO_PHOTO}
            progress={pickerDoneCount / 5}
            topLabel={`${SLOT_LABEL[slotForTime]} session`}
            /* Operator, 18 september 2026: Plan length staat er toch weer
               in (telde al mee voor de 5-stappen-vulling, nu ook weer als
               tekstregel) — en State/Time omgewisseld: State eerst, dan
               Time, Technique, Duration, Plan length. */
            rows={[
              { label: 'State', value: displayName(st.eyebrow), touched: stateTouched },
              { label: 'Time', value: fmtTimeOfDay(time), touched: timeTouched },
              { label: 'Technique', value: tech.name, touched: techniquePicked },
              { label: 'Duration', value: fmtClock(chosen.minutes), touched: durationTouched },
              {
                label: 'Plan length',
                value: HORIZON_OPTIONS.find((o) => o.key === horizon)?.name ?? horizon,
                touched: horizonTouched,
              },
            ]}
          />
        )}

        {/* Operator, 9 september 2026: "die rechthoekige kaart in cirkel
           veranderen en hoger zetten" — de rechthoekige kaart is nu een
           grote ring, direct onder de statenaam. Toont altijd de huidige
           (aanvankelijk slimme standaard-)keuze — zie de uitleg bij
           `heroProgress` hierboven waarom er geen "leeg totdat
           aangeraakt"-gating meer is.
           "de glow is niet goed te aanwezig... ik had de glow niet
           gevraagd" — de gloed-cirkel is weg; in de plaats twee golf-lagen
           ÍN de ring (zie `WAVE_D`/`wave1Style` hierboven) voor het
           "professioneel geanimeerd" gevoel uit de referentiemockup.
           Operator, 18 september 2026: enkel nog de NORMALE flow — addToDay
           gebruikt `AddToDayHero` hierboven. */}
        {/* Operator, 10 okt 2026: boven de cirkel de toestand; de techniek
            staat in de cirkel. */}
        {!isAddToDay && (
        <Text style={[s.techTitle, s.techTitleTxt]} numberOfLines={1}>
          {displayName(st.eyebrow)}
        </Text>
        )}
        {!isAddToDay && (
        <GestureHandlerRootView style={{ flex: 0 }}>
        <GestureDetector gesture={heroDial}>
        <View style={s.heroWrap}>
          {/* Operator, 11 september 2026: "binnenkant van de cirkel moet
             duidelijker grijs" — de ring had zelf geen vulling (`fill=
             "none"` op de SVG-cirkels), dus de binnenkant was gewoon de
             kale paginakleur, nauwelijks te onderscheiden van de rest van
             het scherm. Een effen grijze schijf erachter, licht ingezet
             t.o.v. de ringlijn zelf. */}
          <View style={[s.heroFill, { backgroundColor: heroFillColor }]} />
          <Svg width={HERO_SIZE} height={HERO_SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={HERO_SIZE / 2}
              cy={HERO_SIZE / 2}
              r={HERO_R}
              stroke={C.heroRingTrack}
              strokeWidth={HERO_STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={HERO_SIZE / 2}
              cy={HERO_SIZE / 2}
              r={HERO_R}
              stroke={ringAccent}
              strokeWidth={HERO_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${HERO_C}, ${HERO_C}`}
              animatedProps={heroRingProps}
              fill="none"
              rotation={-90}
              origin={`${HERO_SIZE / 2}, ${HERO_SIZE / 2}`}
            />
            {/* Operator, 24 september 2026: markeert het uiteinde van de
               boog — volgt `heroProgress` rond de ring, dezelfde duur die
               de boog zelf ook tekent. */}
          </Svg>

          {/* Operator, 9 september 2026: "enkel over de lijn van de cirkel
             zelf" — de flits zelf blijft simpel (geclipt tot de volle
             buitencirkel), maar een effen "punch"-cirkel er bovenop
             (`heroShinePunch`, effen achtergrondkleur, iets kleiner) ponst
             het midden eruit — wat overblijft is enkel de dunne rand ter
             breedte van de ring. Twee gewone cirkel-Views, geen SVG-mask.
             MOET vóór de golven komen: anders tekent de effen punch-
             cirkel bovenop de golven en verdwijnen die (gebeurde eerder —
             golven leken toen "verdwenen", maar lagen gewoon onder een
             ondoorzichtige cirkel). */}
          {/* De glans-flits over de ring is weg (5 okt 2026): hij ponste zijn
             midden uit met een effen vlak in de vulkleur, en dat kan niet
             meer nu de cirkel van glas is. */}

          <View style={s.heroLiquidMask} pointerEvents="none">
            {/* Operator, 11 september 2026 (2e correctie): "bijna
               onzichtbaar" — de eerste 0.03 was tegen de kale paginakleur
               getest; tegen de nieuwe `heroFill`-grijs (zie `heroFill`
               hierboven) verdween het verschil bijna volledig. Iets
               steviger, nog steeds duidelijk subtieler dan de gekleurde
               golven bij een echte accentkleur. */}
            <Animated.View style={[StyleSheet.absoluteFill, wave1Style]}>
              <Svg width={WAVE_D * 2} height={WAVE_D}>
                <AnimatedPath
                  animatedProps={wavePathBackProps}
                  fill={isNeutralAccent ? '#000000' : waveAccent}
                  fillOpacity={isNeutralAccent ? 0.07 : st.key === 'rest' ? 0.4 : 0.1}
                />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, wave2Style]}>
              <Svg width={WAVE_D * 2} height={WAVE_D}>
                <AnimatedPath
                  animatedProps={wavePathFrontProps}
                  fill={isNeutralAccent ? '#000000' : waveAccent}
                  fillOpacity={isNeutralAccent ? 0.1 : st.key === 'rest' ? 0.55 : 0.15}
                />
              </Svg>
            </Animated.View>
          </View>

          {/* Operator, 9 september 2026: "in de cirkel zou ik alles zelfde
             kleur wit of grijs houden zodat het mooi contrasteert met de
             golven" — was accentkleur, contrasteerde te weinig met de
             eveneens accentkleurige golven eronder. */}
          <View style={s.heroInner}>
            {/* Operator, 24 september 2026 ("de minutenpicker komt onderaan,
               niet in de bestaande cirkel — de cirkel is voor weergave en
               moest onveranderd blijven"): terug naar het originele,
               ongewijzigde statische cijfer. De wheel picker staat als los
               blok ONDER de ring — zie verderop. */}
            {/* Operator, 5 okt 2026 ("in de ring de gekozen technieknaam
               en tijd tonen, de rest onder i — 'Session length' mag weg,
               dat zien gebruikers wel"). Het ademritme staat in de info. */}
            {/* Operator, 5 okt 2026 ("de cirkel laat gewoon een samenvatting
               zien van gekozen minuten en techniek, alvorens iemand op Start
               session tikt"): enkel weergave, geen gebaar. Naam en tijd
               vloeien zacht over bij een andere keuze. */}
            {/* Operator, 5 okt 2026 ("recommended in de cirkel boven de
               minuten, met een dotje ervoor"): enkel zichtbaar op de
               aanbevolen duur; de ruimte blijft, zodat de tijd niet springt. */}
            {/* Operator, 10 okt 2026 (Apple-consistentie met State Control):
               zelfde volgorde in de cirkel — bovenaan WAT (de techniek), in
               het midden de tijd, onderaan "● Recommended" (was omgekeerd). */}
            <View style={s.heroTechRow}>
              {/* Operator, 10 okt 2026: lange namen over twee regels, de i
                  direct achter het laatste woord ("naast Breathing"). */}
              {(() => {
                const words = tech.name.split(' ');
                const split = tech.name.length > 20 && words.length > 1;
                const first = split ? words.slice(0, -1).join(' ') : null;
                const last = split ? words[words.length - 1] : tech.name;
                return (
                  <>
                    {first ? (
                      <Text style={s.heroTech} numberOfLines={1}>
                        {first}
                      </Text>
                    ) : null}
                    <View style={s.heroTechLine}>
                      <Text style={s.heroTech} numberOfLines={1}>
                        {last}
                      </Text>
                      <Info size={13} color="rgba(255,255,255,0.6)" strokeWidth={2.2} />
                    </View>
                  </>
                );
              })()}
            </View>
            <Animated.Text
              key={`clock-${tech.key}`}
              entering={FadeIn.duration(240)}
              style={s.heroClock}
            >
              {fmtClock(chosen.minutes)}
            </Animated.Text>
            {/* Operator, 10 okt 2026 ("ook hier info over de tijdsduren —
                Recommended is goed"): op de aanbevolen duur "Recommended",
                anders de naam van de duur (bv. Deep Release), zoals de zones
                in State Control. */}
            {(() => {
              const z = zoneFor(chosen.minutes);
              const label = isRecommendedChoice || z?.recommended
                ? steppedUp
                  ? 'Recommended · built up'
                  : 'Recommended'
                : z?.name;
              return (
                <View style={[s.heroRecRow, { opacity: label ? 1 : 0 }]} accessibilityElementsHidden={!label}>
                  <View style={[s.heroRecDot, { backgroundColor: waveAccent }]} />
                  <Text style={s.heroRecTxt}>{label ?? ''}</Text>
                </View>
              );
            })()}
          </View>
          {/* Greep op de rand (zoals State Control): slepen = tijd kiezen. */}
          <View pointerEvents="none" style={{ position: 'absolute', left: -16, top: -16 }}>
            <Svg width={HERO_SIZE + 32} height={HERO_SIZE + 32}>
              <AnimatedCircle animatedProps={heroKnobProps} r={7} fill="#ffffff" />
            </Svg>
          </View>
        </View>
        </GestureDetector>
        </GestureHandlerRootView>
        )}


        {/* Operator, 18 september 2026 ("kunnen we deze richting gaan" —
           nieuwe mockup): Time/State/Technique/Duration los-op-de-pagina
           (wielscroller, carrousel, techniek-rij, duur-dials) vervangen
           door 4 tikbare kaartjes die elk hun eigen kiezer openen
           (`activePicker` hierboven, de 4 modals staan onderaan bij de
           andere popups) — compacter, past de bedoeling van het scherm
           ("alles op 1 kaart") beter dan alles tegelijk uitgeklapt tonen. */}
        {isAddToDay && (() => {
          /* Operator, 18 september 2026 ("het aantal stappen moet duidelijk
             zijn... hoeveel gedaan, welke, of hoeveel nog te gaan"): zelfde
             `pickerDoneMap`/`pickerDoneCount` als de ring hierboven (die
             vult zich er ook mee) — hier enkel het vinkje i.p.v. pijltje op
             elk al-bevestigd kaartje, zodat je in één oogopslag ziet wat
             klaar is en wat nog moet. */
          /* Operator, 18 september 2026 ("info moet zijn next en dan wat
             user next moet kiezen"): i.p.v. de hele resterende lijst op te
             sommen, gewoon het ÉÉN eerstvolgende veld noemen — `nextField`
             (component-scope, zie hierboven bij `pickerDoneMap`) i.p.v.
             een eigen lokale kopie hier. */
          /* Operator, 18 september 2026 ("de 5 instellingen als uniforme
             controls met chevrons, niet met dropdown-pijltjes"): `›`
             i.p.v. `▾` — dit opent een volledig-scherm-kiezer, geen
             inline-uitklappende lijst, dus de "disclosure"-pijl (rechts)
             past het gedrag beter dan een dropdown-pijl (omlaag). */
          const tileMark = (done: boolean) =>
            done ? (
              <Check size={15} color={accent} strokeWidth={2.6} />
            ) : (
              <ChevronRight size={15} color={C.textDim40} strokeWidth={2.2} />
            );
          /* Operator, 18 september 2026 ("de stappen moeten vanaf 1 lopen,
             niet eerst bv Time invullen en alles door elkaar — beginnen
             bij State, dan Time enz."): STRIKTE volgorde i.p.v. enkel
             Technique/Duration achter State te vergrendelen — elke tegel
             is nu pas tikbaar zodra ALLE vorige (in `NEXT_ORDER`) al
             bevestigd zijn. */
          const timeLocked = !stateTouched;
          /* Operator, 18 september 2026 ("ik krijg wel de melding
             overlaps with... maar de cirkel vult aan en ik kan technique
             invullen — dit mag niet, user moet tijd aanpassen alvorens
             hij verder kan"): `timeTouched` alleen zegt enkel dat de
             gebruiker OOIT op Done tikte in de tijd-kiezer — niet dat die
             tijd nog geldig is. Zolang `overlapError` bestaat blijft
             Technique (en daarmee alles erna) vergrendeld, ook al staat
             Time zelf al op "aangevinkt". */
          const techniqueLocked = !stateTouched || !timeTouched || !!overlapError;
          const durationLocked = techniqueLocked || !techniquePicked;
          const horizonLocked = durationLocked || !durationTouched;
          return (
            <>
              {/* Operator, 18 september 2026 (ChatGPT-mockup, "1 of 4 +
                 subtiele navigatie onder de cirkel" — moet "1 of 5" zijn
                 hier): kleine stippenrij i.p.v. de tekst-teller die er
                 eerder stond — 5 stippen, gevuld = bevestigd, hol =
                 nog niet, huidige/eerstvolgende stip iets groter
                 uitgelicht in de accentkleur. */}
              <View style={s.stepDots}>
                {(
                  ['State', 'Time', 'Technique', 'Duration', 'Plan length'] as const
                ).map((k) => {
                  const done = pickerDoneMap[k];
                  const isNext = k === nextField;
                  return (
                    <View
                      key={k}
                      style={[
                        s.stepDot,
                        done && { backgroundColor: accent },
                        isNext && { borderColor: accent, borderWidth: 1.5 },
                      ]}
                    />
                  );
                })}
              </View>
              <Text style={s.progressTxt}>
                {nextField ? `Next: ${nextField}` : 'All set'}
              </Text>
              <View style={s.grid}>
                <AnimatedPressable
                  style={[s.gridTile, stateTilePressStyle]}
                  onPress={() => setActivePicker('state')}
                  onPressIn={stateTilePressIn}
                  onPressOut={stateTilePressOut}
                >
                  <View style={s.gridTileBlurClip}>
                    <BlurView
                      intensity={40}
                      tint="dark"
                      blurMethod="dimezisBlurViewSdk31Plus"
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                  {/* Operator, 18 september 2026 ("state card wit
                     omlijnen en laten vibreren zodat bezoeker
                     onmiddellijk ziet daar te beginnen"): losse
                     absoluut-gepositioneerde randlaag i.p.v. de
                     Pressable's EIGEN rand animeren — dat laatste zou een
                     `Animated.Pressable` vereisen (niet elders in dit
                     bestand gebruikt/geverifieerd); een losse overlay
                     erbovenop, zelfde `borderRadius`, is een kleinere,
                     zekerdere wijziging. `pointerEvents="none"` zodat hij
                     de tap op de tegel niet in de weg zit. Voortaan op
                     ELK van de 5 tegels mogelijk (niet enkel State) —
                     welke er toont volgt `nextField`, dus hij springt na
                     elke bevestigde keuze door naar de volgende. */}
                  {nextField === 'State' && (
                    <Animated.View
                      pointerEvents="none"
                      style={[s.startHereRing, startHerePulseStyle]}
                    />
                  )}
                  <View style={[s.gridTileIcon, { backgroundColor: `${st.accent}22` }]}>
                    <View style={[s.stateChipDot, { backgroundColor: st.accent }]} />
                  </View>
                  <View style={s.gridTileText}>
                    <Text style={s.gridTileLabel}>State</Text>
                    {/* Operator, 18 september 2026 ("de kaarten mogen ook
                       niet vanzelf aanvullen... gebruiker moet zelf op
                       knop tikken om te kiezen"): geen slimme standaard
                       meer LATEN ZIEN vóór de gebruiker 'm zelf bevestigt
                       — intern blijft `selState` wel al op iets logisch
                       staan (nodig zodra de picker opent), maar de tegel
                       zelf toont pas een waarde na een echte tik. */}
                    <Text style={s.gridTileValue} numberOfLines={1}>
                      {stateTouched ? displayName(st.eyebrow) : '—'}
                    </Text>
                  </View>
                  {tileMark(stateTouched)}
                </AnimatedPressable>

                <AnimatedPressable
                  style={[s.gridTile, timeLocked && s.gridTileLocked, timeTilePressStyle]}
                  disabled={timeLocked}
                  onPress={() => setActivePicker('time')}
                  onPressIn={timeTilePressIn}
                  onPressOut={timeTilePressOut}
                >
                  <View style={s.gridTileBlurClip}>
                    <BlurView
                      intensity={40}
                      tint="dark"
                      blurMethod="dimezisBlurViewSdk31Plus"
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                  {nextField === 'Time' && (
                    <Animated.View
                      pointerEvents="none"
                      style={[s.startHereRing, startHerePulseStyle]}
                    />
                  )}
                  <View style={s.gridTileIcon}>
                    <Clock size={16} color={C.textDim55} strokeWidth={2.2} />
                  </View>
                  <View style={s.gridTileText}>
                    <Text style={s.gridTileLabel}>Time</Text>
                    <Text style={s.gridTileValue} numberOfLines={1}>
                      {timeTouched ? fmtTimeOfDay(time) : '—'}
                    </Text>
                  </View>
                  {/* `&& !overlapError` — een aangevinkte Time-tegel met
                     een niet-opgeloste overlap moet gewoon de chevron
                     tonen (nog actie vereist), geen vinkje dat een
                     ongeldige tijd als "klaar" voorstelt. */}
                  {!timeLocked && tileMark(timeTouched && !overlapError)}
                </AnimatedPressable>

                <AnimatedPressable
                  style={[s.gridTile, techniqueLocked && s.gridTileLocked, techTilePressStyle]}
                  disabled={techniqueLocked}
                  onPress={() => setActivePicker('technique')}
                  onPressIn={techTilePressIn}
                  onPressOut={techTilePressOut}
                >
                  <View style={s.gridTileBlurClip}>
                    <BlurView
                      intensity={40}
                      tint="dark"
                      blurMethod="dimezisBlurViewSdk31Plus"
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                  {nextField === 'Technique' && (
                    <Animated.View
                      pointerEvents="none"
                      style={[s.startHereRing, startHerePulseStyle]}
                    />
                  )}
                  <View style={s.gridTileIcon}>
                    {(() => {
                      const Icon = techniqueIcon(tech.key);
                      return <Icon size={16} color={C.textDim55} strokeWidth={2.2} />;
                    })()}
                  </View>
                  <View style={s.gridTileText}>
                    <Text style={s.gridTileLabel}>Technique</Text>
                    {/* Operator, 18 september 2026 ("subtekst duration klopt
                       niet toch? pick a state"): terecht — "Duration: Pick
                       a state" las als een fout label i.p.v. een
                       vergrendel-hint. Neutrale plaatshouder i.p.v.
                       instructie-tekst, zelfde "—"-patroon als de rijen in
                       de cirkel; de gedimde tegel + de "Next: ..."-tekst
                       bovenaan de grid leggen al uit waarom. */}
                    <Text style={s.gridTileValue} numberOfLines={1}>
                      {!techniqueLocked && techniquePicked ? tech.name : '—'}
                    </Text>
                  </View>
                  {!techniqueLocked && tileMark(techniquePicked)}
                </AnimatedPressable>

                <AnimatedPressable
                  style={[s.gridTile, durationLocked && s.gridTileLocked, durationTilePressStyle]}
                  disabled={durationLocked}
                  onPress={() => setActivePicker('duration')}
                  onPressIn={durationTilePressIn}
                  onPressOut={durationTilePressOut}
                >
                  <View style={s.gridTileBlurClip}>
                    <BlurView
                      intensity={40}
                      tint="dark"
                      blurMethod="dimezisBlurViewSdk31Plus"
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                  {nextField === 'Duration' && (
                    <Animated.View
                      pointerEvents="none"
                      style={[s.startHereRing, startHerePulseStyle]}
                    />
                  )}
                  <View style={s.gridTileIcon}>
                    <Timer size={16} color={C.textDim55} strokeWidth={2.2} />
                  </View>
                  <View style={s.gridTileText}>
                    <Text style={s.gridTileLabel}>Duration</Text>
                    <Text style={s.gridTileValue} numberOfLines={1}>
                      {!durationLocked && durationTouched ? fmtClock(chosen.minutes) : '—'}
                    </Text>
                  </View>
                  {!durationLocked && tileMark(durationTouched)}
                </AnimatedPressable>
              </View>

              {/* Operator, 18 september 2026 ("aantal dagen moet in add to
                 day komen... onderaan als lange card zodat het mooi is" →
                 later "plan length moet ook in de cirkel komen, cirkel pas
                 vol als alles aangeduid is, 5 stappen dus" → "stappen
                 moeten vanaf 1 lopen"): 5e, VOLLE-BREEDTE tegel, nu ook
                 vergrendeld tot de 4 sessie-velden ervoor gedaan zijn. */}
              <AnimatedPressable
                style={[s.gridTileWide, horizonLocked && s.gridTileLocked, horizonTilePressStyle]}
                disabled={horizonLocked}
                onPress={() => setActivePicker('horizon')}
                onPressIn={horizonTilePressIn}
                onPressOut={horizonTilePressOut}
              >
                <View style={s.gridTileBlurClip}>
                  <BlurView
                    intensity={40}
                    tint="dark"
                    blurMethod="dimezisBlurViewSdk31Plus"
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                {nextField === 'Plan length' && (
                  <Animated.View
                    pointerEvents="none"
                    style={[s.startHereRing, startHerePulseStyle]}
                  />
                )}
                <View style={s.gridTileIcon}>
                  <CalendarRange size={16} color={C.textDim55} strokeWidth={2.2} />
                </View>
                <View style={s.gridTileText}>
                  <Text style={s.gridTileLabel}>Plan length</Text>
                  {/* Operator, 18 september 2026 ("Whole protocol · X, in
                     blauwe themakleur — user moet altijd zien dat dit
                     protocol-breed geldt, niet enkel voor deze sessie"):
                     was gewoon de naam alleen ("2 weeks"), wat op elke
                     losse sessie leek alsof het een eigen keuze was. */}
                  <Text
                    style={[s.gridTileValue, { color: accent }]}
                    numberOfLines={1}
                  >
                    {!horizonLocked && horizonTouched
                      ? `Whole protocol · ${HORIZON_OPTIONS.find((o) => o.key === horizon)?.name ?? horizon}`
                      : '—'}
                  </Text>
                </View>
                {!horizonLocked && tileMark(horizonTouched)}
              </AnimatedPressable>
            </>
          );
        })()}

        {/* Operator, 18 september 2026 ("onderste kaart moet weg"): de
           blijvende techniek-uitleg-kaart die hier stond is verwijderd —
           die info zit nu IN de Technique-kiezer-modal (level-badge +
           uitleg per rij, zie de `activePicker === 'technique'`-modal
           hieronder), niet meer los eronder. */}

        {/* Operator, 9 september 2026: "sessie namen in pills vind ik heel
           lelijk en ouderwets, wat is moderne techniek daarvoor anno 2026"
           — vervangen door iconen-knoppen (zelfde idee als de mockup): de
           gekozen techniek is een volle pil in de accentkleur, de andere
           blijven dunne omrande knoppen. Tikken selecteert de techniek (de
           ring/inhoud hierboven update).
           Operator, 18 september 2026: enkel nog de NORMALE flow — addToDay
           gebruikt de kaartjes+kiezers hierboven.
           Operator, 24 september 2026 ("bij aantikken van de technieken
           elke keer popup — storend voor een terugkerende gebruiker die
           gewoon zelf een sessie wil kiezen? i-knop?"): de popup ging tot
           nu toe ELKE tik automatisch open, ook voor iemand die de
           techniek al lang kent en gewoon snel wil kiezen. Tikken selecteert
           nu enkel nog (geen popup); een apart, klein "i"-knopje eronder
           (zelfde patroon als de duur-infoknop hierboven) toont de uitleg
           enkel wie er zelf naar vraagt. */}

        {/* Operator, 24 september 2026 ("minutenpicker komt onderaan, niet
           in de bestaande cirkel — die is voor weergave en moest
           onveranderd blijven"): `DurationWheel` (met de live
           cilinder-fade/schaal, `DurationWheelRow`) als los blok, de ring
           hierboven raakt dit niet aan. Vervangt `DurationSegmentedControl`
           + `DurationSlider` samen. Eén handler dekt beide gevallen: landt
           de waarde exact op een bestaande preset, dan gedraagt 'm zich als
           vroeger de segmented control (naam verschijnt); anders als
           vroeger de slider (Custom). */}
        {!isAddToDay && (
        <>
        {/* Operator, 24 september 2026 ("choose your duration mag buiten
           de kaart komen, maak de kaart kleiner"): label verhuisd VÓÓR de
           BlurView i.p.v. erbinnen — eigen marge i.p.v. de kaart se
           `padding`. */}
        {/* Operator, 5 okt 2026 ("tijd en techniek kiezen is saai en
           lelijk"): de keuzes laten zelf iets zien. Techniek = drie tegels
           naast elkaar (icoon, naam, ritme) — verschillen in één oogopslag.
           Duur = een liniaal zoals de zoomknop van de camera; de cirkel
           erboven telt live mee. */}
        {/* Operator, 5 okt 2026 ("i.p.v. 3 losse kaarten een doorlopende
           balk, transparant blur — hebben we elders al"): de glazen
           segmented control met het schuivende kussentje. De i rechts op de
           labelregel opent de uitleg van de gekozen techniek. */}
        {/* Operator, 10 okt 2026: duurwiel weg (tijd via de rand van de
            cirkel); de technieken als draaiwiel ONDER de cirkel. */}
        <View style={s.techWheelWrap}>
          <DurationWheel
            options={st.techniques.map((t, i) => ({ value: i, label: techShortLabel(t) }))}
            textMode
            value={techIdx}
            accent={accent}
            trackColor="rgba(255,255,255,0.4)"
            onChange={(i) => {
              if (i === techIdx) return;
              pickTechnique(i);
            }}
          />
        </View>
        </>
        )}

      </ContentWrap>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 26 }]}>
        {/* Operator, 9 september 2026: "cta knop moet in ons wit" — zelfde
           vaste, enkele witte CTA-kleur als (tabs)/breath.tsx (niet meer de
           toestand-accentkleur als vulling); de accentkleur blijft elders
           op dit scherm het accent (ring-label, patroon, geselecteerde
           techniek), niet de CTA. */}
        {/* Operator, 10 september 2026: "die how it works onder cta moet
           weg, info staat al in popup" — terecht, tikken op een techniek
           hierboven opent al dezelfde info-modal (`setInfoModal`); een
           tweede knop die naar exact dezelfde popup leidt was overbodig. */}
        {/* Operator, 11 september 2026: "cta mag ook in de kleur van de
           state" — herroept de 9 september-regel hierboven, enkel voor dit
           scherm: light-CTA vult nu met de state-kleur i.p.v. het vaste
           LIGHT_BLUE. Tekstkleur volgt de vulling i.p.v. altijd wit of
           altijd zwart — voor Clarity's neutrale, bijna-zwarte `ctaBg`
           moet dat wit zijn, anders is de tekst zelf weer onleesbaar. */}
        {/* Operator, 17 september 2026: "als gebruiker overlappende tijden
           kiezen mag dat niet, moet melding komen" — meteen zichtbaar
           zodra het gebeurt.
           Operator, 18 september 2026 (nieuwe mockup) → later herzien
           ("tekst moet boven de cta staan, nu niet duidelijk leesbaar"):
           IN de ring (`AddToDayHero`'s `warning`-prop) was te krap —
           kleine cirkelruimte, tekst kon amper 2 regels kwijt. Nu een
           eigen, volle-breedte regel boven de CTA i.p.v. binnenin de
           ring gepropt. */}
        {isAddToDay && overlapError && (
          <View style={s.overlapWarningRow}>
            <Text style={s.overlapWarning} numberOfLines={2}>
              {overlapError}
            </Text>
            {/* Operator, 18 september 2026 ("in waarschuwing change time
               als aanvulling"): directe weg naar de Time-kiezer i.p.v. de
               gebruiker zelf terug de (nu vergrendelde) Time-tegel te
               laten opzoeken. */}
            <AnimatedPressable
              onPress={() => setActivePicker('time')}
              onPressIn={changeTimeBtnPressIn}
              onPressOut={changeTimeBtnPressOut}
              hitSlop={8}
              style={[s.overlapChangeTimeBtn, changeTimeBtnPressStyle]}
            >
              <Text style={s.overlapChangeTimeTxt}>Change time</Text>
            </AnimatedPressable>
          </View>
        )}
        <AnimatedPressable
          disabled={isAddToDay && (!addToDayReady || !!overlapError)}
          onPress={isAddToDay ? addToDay : startSession}
          onPressIn={ctaPressIn}
          onPressOut={ctaPressOut}
          style={[
            s.cta,
            light && { backgroundColor: ctaBg, borderColor: ctaBg },
            isAddToDay && (!addToDayReady || !!overlapError) && s.ctaDisabled,
            ctaPressStyle,
          ]}
          android_ripple={{ color: C.ctaRipple }}
        >
          <Text style={[s.ctaTxt, light && { color: ctaTextColor }]}>
            {isAddToDay
              ? `Add to ${SLOT_LABEL[slotForTime]}`
              : locked
                ? 'Try 30 seconds free'
                : 'Start session'}
          </Text>
        </AnimatedPressable>
      </View>

      {/* Operator, 24 september 2026 (pasted Apple sheets-referentie, zelfde
         behandeling als de duur-infopopup hieronder): geen gecentreerde
         kaart + "Got it"-knop onderaan meer — nu dezelfde ECHTE bottom-sheet
         (`sheetRoot`/`sheetContainer`/`sheetHandle`/`sheetHeader`, "Done" in
         de header, altijd wit) als de andere sheets in dit bestand. */}
      {/* Echt glas, ook op Android: in hetzelfde venster als de app
          (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
      <GlassSheet visible={infoModal !== null} onClose={() => setInfoModal(null)}>
          <SafeAreaView style={[s.sheetContainer, s.sheetGlass]} edges={['bottom']}>
            {/* Operator, 5 okt 2026 ("popup hetzelfde als in Choose your
               state"): VIBEZCORE-glas, witte tekst, kleur enkel in het icoon. */}
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <View style={s.sheetHandle} />
            {(() => {
              const modalTech = st.techniques.find(
                (t) => t.key === infoModal?.techniqueKey,
              );
              if (!modalTech) return null;
              const Icon = techniqueIcon(modalTech.key);
              return (
                <>
                  <View style={s.sheetHeader}>
                    <View style={s.sheetTitleRow}>
                      <View style={s.sheetBadge}>
                        <VibezGlass radius={18} tint={st.accent} level="raised" style={StyleSheet.absoluteFill} />
                        <Icon size={18} color="#ffffff" strokeWidth={2.2} />
                      </View>
                      <Text style={[s.modalTitle, s.sheetTitleTxt]} numberOfLines={1}>
                        {infoModal?.title}
                      </Text>
                    </View>
                    <AnimatedPressable
                      onPress={() => setInfoModal(null)}
                      onPressIn={modalGotItPressIn}
                      onPressOut={modalGotItPressOut}
                      style={modalGotItPressStyle}
                      hitSlop={10}
                    >
                      <Text style={[s.sheetDoneTxt, { color: '#ffffff' }]}>Done</Text>
                    </AnimatedPressable>
                  </View>
                  {/* Operator, 24 september 2026 ("Best for" + 2 losse
                     sectiekopjes + evt. een safetyNote-vlak maken dit
                     merkbaar langer dan voorheen): body in een ScrollView,
                     anders loopt de inhoud op een kleiner toestel gewoon
                     buiten de sheet — enkel `sheetHandle`/`sheetHeader`
                     blijven vast. */}
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
                  >
                  {/* Operator, 10 okt 2026 ("de popup moet overzichtelijker, ik
                      raak overweldigd"): eerst het belangrijkste — één zin,
                      één rij labels, de momenten, dan compact de duren.
                      "What it changes" is weg (technisch; het ritme staat in
                      de labels). Veiligheid blijft altijd staan. */}
                  <Text style={s.infoLead}>{modalTech.effect}</Text>
                  <View style={s.infoChips}>
                    <View style={[s.infoChip, { backgroundColor: `${st.accent}38`, borderColor: 'transparent' }]}>
                      <Text style={s.infoChipTxt}>{modalTech.level}</Text>
                    </View>
                    <View style={s.infoChip}>
                      <Text style={s.infoChipTxt}>{techniquePattern(modalTech.phases)}</Text>
                    </View>
                    <View style={s.infoChip}>
                      <Text style={s.infoChipTxt}>{modalTech.bestFor}</Text>
                    </View>
                  </View>
                  {modalTech.safetyNote ? (
                    <View style={s.modalCautionBox}>
                      <AlertTriangle size={14} color="#F0B86E" strokeWidth={2.2} style={{ marginTop: 1 }} />
                      <Text style={s.modalCaution}>{modalTech.safetyNote}</Text>
                    </View>
                  ) : null}
                  {modalTech.moments && modalTech.moments.length > 0 && (
                    <>
                      <Text style={s.sheetSectionLabel}>USE THIS WHEN</Text>
                      <View style={s.momentsList}>
                        {modalTech.moments.map((m) => (
                          <View key={m} style={s.momentRow}>
                            <View style={[s.momentDot, { backgroundColor: 'rgba(255,255,255,0.55)' }]} />
                            <Text style={s.momentTxt}>{m}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                  {modalTech.key === tech.key && durationZones.length > 0 ? (
                    <>
                      <Text style={s.sheetSectionLabel}>SESSION LENGTH</Text>
                      <View style={s.zoneList}>
                        {durationZones.map((z) => {
                          const on = zoneFor(chosen.minutes) === z;
                          const range = z.start === z.end ? `${z.minutes} min` : `${z.start}–${z.end} min`;
                          return (
                            <View key={z.name + z.minutes} style={s.zoneRow}>
                              <View style={s.zoneHead}>
                                <View style={s.zoneNameRow}>
                                  <View style={[s.zoneDot, { backgroundColor: on ? waveAccent : 'transparent' }]} />
                                  <Text style={[s.zoneName, !on && { color: 'rgba(255,255,255,0.6)', fontFamily: BrandFonts.medium }]}>
                                    {z.name}
                                    {z.recommended ? '  ·  Recommended' : ''}
                                  </Text>
                                </View>
                                <Text style={s.zoneRange}>{range}</Text>
                              </View>
                              {on && z.why ? <Text style={[s.zoneText, { marginLeft: 16 }]}>{z.why}</Text> : null}
                            </View>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  </ScrollView>
                </>
              );
            })()}
          </SafeAreaView>
      </GlassSheet>

      {/* Operator, 24 september 2026 ("gaan gebruikers weten waar die
         sessies voor zijn?" → "of i icoon"), zelfde dag (vervolg, pasted
         Apple sheets-referentie): geen gecentreerde kaart meer — nu een
         ECHTE bottom-sheet, dezelfde `sheetRoot`/`sheetContainer`/
         `sheetHandle`/`sheetHeader`-stijlen als de 5 kiezer-sheets verderop
         in dit bestand (Time/State/Technique/Duration/Plan length), dus
         consistent met de rest van de app i.p.v. een eigen modal-vorm.
         Geen bulletpoints meer (weer teruggedraaid — "Apple vermijdt
         bulletpoints, gebruikt royale witruimte + duidelijke hiërarchie"):
         `tech.effect` (wat het doet) + de duur se `why` (waarom deze
         lengte) worden hier samengevoegd tot één doorlopende alinea i.p.v.
         twee losse punten — nog steeds geen nieuwe copy, enkel anders
         geschreven. */}
      {/* Echt glas, ook op Android: in hetzelfde venster als de app
          (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
      <GlassSheet visible={durationInfoOpen} onClose={() => setDurationInfoOpen(false)}>
          <SafeAreaView style={[s.sheetContainer, s.sheetGlass]} edges={['bottom']}>
            {/* Operator, 5 okt 2026 ("popup hetzelfde als in Choose your
               state"): VIBEZCORE-glas, witte tekst, kleur enkel in het icoon. */}
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={[s.modalTitle, s.sheetTitleTxt]}>
                {zoneFor(chosen.minutes)?.name ?? 'This duration'}
              </Text>
              <AnimatedPressable
                onPress={() => setDurationInfoOpen(false)}
                onPressIn={durationInfoDonePressIn}
                onPressOut={durationInfoDonePressOut}
                style={durationInfoDonePressStyle}
                hitSlop={10}
              >
                <Text style={[s.sheetDoneTxt, { color: '#ffffff' }]}>Done</Text>
              </AnimatedPressable>
            </View>
            {/* Operator, 24 september 2026, vier correcties na elkaar:
               1) effect herhaalde zich identiek per tijdframe → eruit.
               2) daardoor te kaal → effect + moments terug.
               3) "de techniek-i en de duur-i tonen nu dezelfde info,
               overlapt — wat is de bedoeling?": terecht — BEST FOR/USE
               THIS WHEN/WHY THIS TECHNIQUE stonden hier LETTERLIJK
               hetzelfde als in de techniek-infosheet. De techniek staat op
               dit punt al gekozen en zichtbaar in de balk erboven; die
               popup legt al volledig uit WAT/WANNEER/WAAROM deze techniek.
               Deze popup heeft nu een eigen, unieke taak: enkel WAAROM
               DEZE LENGTE — geen dubbele uitleg meer. */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
            >
              {/* Operator, 24 september 2026 (pasted analyse, sectie 14:
                 "Recommended range: 13–20 min" — het bereik van de hele
                 tijdzone, niet enkel het exacte getal): stond al in de
                 data (`durationZones`, `zoneFor(...).start/.end`), enkel
                 nog nooit als tekst getoond — voelbaar via het wiel maar
                 niet leesbaar. Enkel getoond bij een ECHT bereik (niet bij
                 cyclus-gebaseerde technieken zoals 4-7-8, waar elke stap
                 een vast, exact getal is, geen zone-breedte). */}
              {(() => {
                const z = zoneFor(chosen.minutes);
                if (!z || z.start === z.end) return null;
                return (
                  <Text style={[s.modalPattern, s.sheetEyebrow, { marginBottom: 10 }]}>
                    RANGE · {fmtClock(z.start)}–{fmtClock(z.end)}
                  </Text>
                );
              })()}
              <Text style={s.sheetInfoBody}>{zoneFor(chosen.minutes)?.why}</Text>
              {/* Operator, 24 september 2026 (pasted analyse, sectie 13:
                 "5 min ★ = VIBEZCORE recommended, niet 'scientifically
                 optimal'" — het bewijs verschilt sterk per techniek/
                 protocol, dus VIBEZCORE kiest een default op basis van
                 gebruiksgemak + onderzoek, doet niet alsof de wetenschap
                 één exact getal voorschrijft): enkel getoond op de
                 aanbevolen duur zelf. */}
              {zoneFor(chosen.minutes)?.recommended && (
                <Text style={s.sheetRecommendedNote}>
                  {zoneFor(chosen.minutes)?.researchProtocol
                    ? 'VIBEZCORE recommended · research protocol — the exact dose used in the cited study.'
                    : 'VIBEZCORE recommended — not the only right length, just the one that works for most people, most days.'}
                </Text>
              )}
            </ScrollView>
          </SafeAreaView>
      </GlassSheet>

      {/* Operator, 18 september 2026 ("popupkaarten mogen over volledig
         scherm of achterkant moet donker worden bij popup... achterkant
         mag niet zichtbaar zijn"): de 4 kiezer-modals zijn nu ECHTE volle-
         scherm-pagina's (`pickerFullScreen`, ondoorzichtig) met een eigen
         sluitknop i.p.v. een kleine kaart over een donkere achtergrond —
         en dus ook geen "tik ernaast om te sluiten"-Pressable meer om de
         inhoud heen. Operator, zelfde ronde ("time scrollt niet... schuif-
         regelaar doet niets"): DIE omringende Pressable-in-Pressable was
         vermoedelijk precies de oorzaak — een `Pressable` als DIRECTE
         ouder van een `ScrollView`/`PanResponder`-slider kan de
         scroll/drag-gebaren wegkapen vóór ze de child bereiken. Een platte
         `View` errond (geen eigen touch-responder) lost dat op. */}
      {isAddToDay && (
        <>
          {/* Echt glas, ook op Android: in hetzelfde venster als de app
              (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
          <GlassSheet visible={activePicker === 'time'} onClose={() => setActivePicker(null)}>
              <SafeAreaView style={[s.sheetContainer, s.sheetGlass]} edges={['bottom']}>
                <VibezGlass
                  radius={24}
                  level="sheet"
                  blurTarget={rootBlurRef}
                  style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
                />
                <View style={s.sheetHandle} />
                <View style={s.sheetHeader}>
                  <Text style={[s.modalTitle, { color: accent }]}>Time</Text>
                  {/* Operator, 18 september 2026 ("bij kiezen plan length
                     pas ok na done... vinkje moet pas komen als de laatste
                     popup weg is"): geldt voor alle 5 sheets, niet enkel
                     Plan length — `timeTouched` (en dus het vinkje op de
                     Time-tegel) gaat nu pas aan bij het sluiten via "Done",
                     niet meer bij elke los wiel-/invoer-tikje. */}
                  <AnimatedPressable
                    onPress={() => {
                      setTimeTouched(true);
                      setActivePicker(null);
                    }}
                    onPressIn={timeDonePressIn}
                    onPressOut={timeDonePressOut}
                    style={timeDonePressStyle}
                    hitSlop={10}
                  >
                    <Text style={[s.sheetDoneTxt, { color: accent }]}>Done</Text>
                  </AnimatedPressable>
                </View>
              <View style={s.pickerBody}>
                {/* Operator, 18 september 2026 ("tijd moet gebruiker boven
                   de scroll ook digitaal kunnen invoeren... us en eu
                   tijdsnotering?"): HH/MM-invoer boven het wiel, met
                   AM/PM-knoppen enkel op toestellen met een 12u-locale
                   (`uses12hClock`) — hetzelfde `time` blijft de bron van
                   waarheid, het wiel hieronder springt automatisch mee
                   zodra hier iets bevestigd wordt. */}
                <View style={s.digitalTimeRow}>
                  <TextInput
                    style={s.digitalTimeInput}
                    value={hourText}
                    onChangeText={setHourText}
                    onEndEditing={() =>
                      commitDigitalTime(hourText, minuteText, Math.floor(time / 60) >= 12)
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                  <Text style={s.digitalTimeColon}>:</Text>
                  <TextInput
                    style={s.digitalTimeInput}
                    value={minuteText}
                    onChangeText={setMinuteText}
                    onEndEditing={() =>
                      commitDigitalTime(hourText, minuteText, Math.floor(time / 60) >= 12)
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                  {uses12hClock && (
                    <View style={s.ampmGroup}>
                      {(['AM', 'PM'] as const).map((label) => {
                        const on = (label === 'PM') === (Math.floor(time / 60) >= 12);
                        return (
                          <AmPmButton
                            key={label}
                            label={label}
                            on={on}
                            accent={accent}
                            textColor={modalBtnTextColor}
                            btnStyle={s.ampmBtn}
                            btnTxtStyle={s.ampmBtnTxt}
                            onPress={() =>
                              commitDigitalTime(hourText, minuteText, label === 'PM')
                            }
                          />
                        );
                      })}
                    </View>
                  )}
                </View>
                <Text style={s.digitalTimeHint}>
                  Between {fmtTimeOfDay(timeWindowMin)} and {fmtTimeOfDay(timeWindowMax)}
                </Text>
                <TimeWheel
                  options={timeOptionsForSlot(slotForTime)}
                  value={time}
                  onChange={setTime}
                  accent={accent}
                  trackColor={C.textDim55}
                  /* Operator, 18 september 2026 ("blokkeren gekozen tijd
                     ook ineens bouwen"): welke tijden al bezet zijn door
                     andere sessies in ditzelfde dagdeel — enkel relevant
                     in addToDay (normale flow kent geen "andere
                     sessies"). De duur van DEZE nieuwe sessie staat op
                     dit punt nog niet vast (Duration komt pas na Time in
                     de vaste volgorde), dus dit markeert enkel tijden die
                     al BINNEN een bestaande sessie vallen — de definitieve
                     controle met de uiteindelijke duur blijft `overlapError`
                     hieronder, die de flow al hard blokkeert. */
                  blocked={isAddToDay ? existingSessions : []}
                />
              </View>
              </SafeAreaView>
          </GlassSheet>

          {/* Echt glas, ook op Android: in hetzelfde venster als de app
              (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
          <GlassSheet visible={activePicker === 'state'} onClose={() => setActivePicker(null)}>
              <SafeAreaView style={[s.sheetContainer, s.sheetGlass]} edges={['bottom']}>
                <VibezGlass
                  radius={24}
                  level="sheet"
                  blurTarget={rootBlurRef}
                  style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
                />
                <View style={s.sheetHandle} />
                <View style={s.sheetHeader}>
                  <Text style={[s.modalTitle, { color: accent }]}>State</Text>
                  {/* Operator, 18 september 2026 ("vinkje moet pas komen als
                     de laatste popup weg is"): `stateTouched` (het vinkje op
                     de State-tegel) gaat nu pas aan bij "Done", niet meer
                     bij elke rij-tik. */}
                  <AnimatedPressable
                    onPress={() => {
                      setStateTouched(true);
                      setActivePicker(null);
                    }}
                    onPressIn={stateDonePressIn}
                    onPressOut={stateDonePressOut}
                    style={stateDonePressStyle}
                    hitSlop={10}
                  >
                    <Text style={[s.sheetDoneTxt, { color: accent }]}>Done</Text>
                  </AnimatedPressable>
                </View>
              {/* Operator, 18 september 2026 ("elke state moet info geven
                 over de state, niet enkel bv energy and drive, maar ook use
                 when"): naast `subtitle` (de korte tagline) nu ook de
                 volledige `description` per rij — dezelfde twee velden als
                 de oude losse state-infopopup, nu meteen in de kiezer.
                 Operator, vervolg (Apple HIG): "inset grouped"-lijst i.p.v.
                 elke rij als eigen omrande kaart — één afgeronde
                 `sheetList` met dunne scheidingslijnen, selectie via een
                 vinkje rechts i.p.v. een gekleurde rand/achtergrond. */}
              <ScrollView
                style={{ flexShrink: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
              >
                <View style={s.sheetList}>
                  {STATE_ORDER.map((key, i) => {
                    const opt = BREATH_STATES[key];
                    const on = key === selState;
                    return (
                      <View key={key}>
                        {i > 0 && <View style={s.sheetSeparator} />}
                        <Pressable
                          style={s.sheetRow}
                          /* Operator, 18 september 2026 ("pas na aanklikken
                             Done is handeling klaar... nu bij aanvinken
                             verdwijnt kaart al"): tikken kiest enkel (vinkje
                             springt naar deze rij, sheet blijft open) — de
                             "Done"-tekstlink hierboven sluit 'm pas echt EN
                             zet pas dan `stateTouched`. */
                          onPress={() => {
                            hapticTap();
                            setSelState(key);
                          }}
                        >
                          <View style={[s.stateChipDot, { backgroundColor: opt.accent, marginTop: 3 }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.sheetRowTitle}>{displayName(opt.eyebrow)}</Text>
                            <Text style={[s.sheetRowSub, { color: opt.accent }]} numberOfLines={1}>
                              {opt.subtitle}
                            </Text>
                            <Text style={s.sheetRowSub} numberOfLines={3}>
                              {opt.description}
                            </Text>
                          </View>
                          {on && <Check size={18} color={accent} strokeWidth={2.6} />}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
              </SafeAreaView>
          </GlassSheet>

          {/* Echt glas, ook op Android: in hetzelfde venster als de app
              (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
          <GlassSheet visible={activePicker === 'technique'} onClose={() => setActivePicker(null)}>
              <SafeAreaView style={[s.sheetContainer, s.sheetGlass]} edges={['bottom']}>
                <VibezGlass
                  radius={24}
                  level="sheet"
                  blurTarget={rootBlurRef}
                  style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
                />
                <View style={s.sheetHandle} />
                <View style={s.sheetHeader}>
                  <Text style={[s.modalTitle, { color: accent }]}>Technique</Text>
                  {/* Operator, 18 september 2026 ("vinkje moet pas komen als
                     de laatste popup weg is"): `techniquePicked` (het vinkje
                     op de Technique-tegel) gaat pas aan bij "Done". */}
                  <Pressable
                    onPress={() => {
                      setTechniquePicked(true);
                      setActivePicker(null);
                    }}
                    hitSlop={10}
                  >
                    <Text style={[s.sheetDoneTxt, { color: accent }]}>Done</Text>
                  </Pressable>
                </View>
              {/* Operator, 18 september 2026 ("technique popup ook iets meer
                 info suggestief"): niveau-badge (`t.level`) + de hook-zin
                 (wat het ritme doet) + de bestaande niveau-/detailzin
                 (`techniqueDecisionLine`, dezelfde bron als de oude
                 techniek-infopopup) per rij, i.p.v. enkel de naam. */}
              <ScrollView
                style={{ flexShrink: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
              >
                <View style={s.sheetList}>
                  {st.techniques.map((t, i) => {
                    const isSel = i === techIdx;
                    const Icon = techniqueIcon(t.key);
                    const { primary } = techniqueDecisionLine(t);
                    return (
                      <View key={t.key}>
                        {i > 0 && <View style={s.sheetSeparator} />}
                        <Pressable
                          style={s.sheetRow}
                          onPress={() => {
                            hapticTap();
                            setTechIdx(i);
                            /* Zelfde "spring naar aanbevolen duur"-logica als
                               de oude techniek-pillen hierboven (normale
                               flow) — VULT `durationIdx` alvast slim in, maar
                               telt Duration NIET automatisch als "gedaan":
                               operator, 18 september 2026 ("all set mag pas
                               verschijnen na invullen duration") — Duration
                               moet zijn EIGEN kiezer expliciet gepasseerd
                               hebben, anders zou "All set" al verschijnen
                               zonder dat de gebruiker Duration ooit zelf
                               bevestigde. */
                            const durs = t.durations ?? st.durations;
                            const recIdx = durs.findIndex((d) => d.recommended);
                            setDurationIdx(
                              recIdx !== -1 ? recIdx : Math.min(durationIdx, durs.length - 1),
                            );
                            setCustomSelected(false);
                            /* Operator, 18 september 2026 ("pas na
                               aanklikken Done is handeling klaar"): niet
                               meer meteen sluiten — de "Done"-tekstlink
                               bovenaan doet dat. */
                          }}
                        >
                          <Icon
                            size={16}
                            color={isSel ? accent : C.textDim55}
                            strokeWidth={2.2}
                            style={{ marginTop: 3 }}
                          />
                          <View style={{ flex: 1 }}>
                            {/* Operator, 18 september 2026 (Apple HIG:
                               "niveautags subtieler, focus blijft op de
                               naam"): geen omrande pil meer, gewoon een
                               kleine gedimde tekst naast de naam. */}
                            <View style={s.pickerRowHead}>
                              <Text style={s.sheetRowTitle}>{t.name}</Text>
                              <Text style={s.sheetLevelTxt}>{t.level}</Text>
                            </View>
                            <Text style={s.sheetRowSub} numberOfLines={2}>
                              {techniqueHook(t.explain)}
                            </Text>
                            {primary ? (
                              <Text style={s.sheetRowSub} numberOfLines={2}>
                                {primary}
                              </Text>
                            ) : null}
                          </View>
                          {isSel && <Check size={18} color={accent} strokeWidth={2.6} />}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
              </SafeAreaView>
          </GlassSheet>

          {/* Echt glas, ook op Android: in hetzelfde venster als de app
              (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
          <GlassSheet visible={activePicker === 'duration'} onClose={() => setActivePicker(null)}>
              <SafeAreaView style={[s.sheetContainer, s.sheetGlass]} edges={['bottom']}>
                <VibezGlass
                  radius={24}
                  level="sheet"
                  blurTarget={rootBlurRef}
                  style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
                />
                <View style={s.sheetHandle} />
                <View style={s.sheetHeader}>
                  <Text style={[s.modalTitle, { color: accent }]}>Duration</Text>
                  {/* Operator, 18 september 2026 ("vinkje moet pas komen als
                     de laatste popup weg is"): `durationTouched` (het
                     vinkje op de Duration-tegel) gaat pas aan bij "Done". */}
                  <Pressable
                    onPress={() => {
                      setDurationTouched(true);
                      setActivePicker(null);
                    }}
                    hitSlop={10}
                  >
                    <Text style={[s.sheetDoneTxt, { color: accent }]}>Done</Text>
                  </Pressable>
                </View>
              {/* Operator, 18 september 2026 ("de cta's in bv choose
                 duration popup staat nog te laag"): de echte oorzaak — een
                 `ScrollView` zonder `flex`/`flexShrink` groeit gewoon mee
                 met zijn eigen inhoud i.p.v. de resterende ruimte te
                 vullen. */}
              <ScrollView
                style={{ flexShrink: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) }}
              >
                <View style={s.sheetList}>
                  {DURATIONS.map((d, i) => {
                    const isSel = i === durationIdx && !customSelected;
                    return (
                      <View key={d.name}>
                        {i > 0 && <View style={s.sheetSeparator} />}
                        <Pressable
                          style={s.sheetRow}
                          /* Operator, 18 september 2026 ("pas na aanklikken
                             Done is handeling klaar"): kiest enkel, "Done"
                             hierboven sluit + zet `durationTouched`. */
                          onPress={() => {
                            hapticTap();
                            setCustomSelected(false);
                            setDurationIdx(i);
                          }}
                        >
                          <Text style={[s.sheetRowTitle, { flex: 1 }]}>
                            {d.name} · {d.cycles ? `${d.cycles} cycles` : `${d.minutes} min`}
                          </Text>
                          {/* Operator, 18 september 2026 ("sterretje weet
                             gebruiker niet wat dat betekent"): woord i.p.v.
                             symbool. */}
                          {d.recommended && (
                            <Text style={[s.sheetLevelTxt, { marginRight: isSel ? 8 : 0 }]}>
                              Recommended
                            </Text>
                          )}
                          {isSel && <Check size={18} color={accent} strokeWidth={2.6} />}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
                {!isCyclesBased && (
                  <View style={[s.customRow, { marginTop: 16 }]}>
                    {/* Operator, 18 september 2026 ("ik zie er komt geen
                       teller in de popup"): het label toont nu de HUIDIGE
                       waarde zodra custom actief is, i.p.v. altijd enkel het
                       vaste maximum — en de slider krijgt zijn eigen
                       min/max-onderschriften (`minLabel`/`maxLabel`, bestond
                       al als prop maar werd hier nooit meegegeven). */}
                    <Text
                      style={[s.customLabel, customSelected && { color: accent }]}
                    >
                      {customSelected
                        ? `Custom · ${customMinutes} min`
                        : `Custom · up to ${customMaxMinutes} min`}
                    </Text>
                    <DurationSlider
                      min={presetMinMinutes}
                      max={customMaxMinutes}
                      value={customSelected ? customMinutes : presetMinMinutes}
                      minLabel={`${presetMinMinutes} min`}
                      maxLabel={`${customMaxMinutes} min`}
                      onChange={(v) => {
                        setCustomMinutes(v);
                        if (!customSelected) setCustomSelected(true);
                      }}
                      accent={accent}
                      light={light}
                      thick
                    />
                  </View>
                )}
              </ScrollView>
              </SafeAreaView>
          </GlassSheet>

          {/* Operator, 18 september 2026 ("aantal dagen moet in add to day
             komen"): 5e kiezer, zelfde vormtaal als de andere 4 — lijst van
             `HORIZON_OPTIONS` (dezelfde bron als voorheen op
             plan-review.tsx). Geen "Done"-knop nodig, tikken op een rij
             kiest en sluit meteen, zelfde patroon als State/Technique. */}
          {/* Echt glas, ook op Android: in hetzelfde venster als de app
              (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
          <GlassSheet visible={activePicker === 'horizon'} onClose={() => setActivePicker(null)}>
              <SafeAreaView style={[s.sheetContainer, s.sheetGlass]} edges={['bottom']}>
                <VibezGlass
                  radius={24}
                  level="sheet"
                  blurTarget={rootBlurRef}
                  style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
                />
                <View style={s.sheetHandle} />
                <View style={s.sheetHeader}>
                  <Text style={[s.modalTitle, { color: accent }]}>Plan length</Text>
                  {/* Operator, 18 september 2026 ("bij kiezen plan length
                     pas ok na done... vinkje moet pas komen als de laatste
                     popup weg is"): `horizonTouched` gaat pas aan bij
                     "Done". */}
                  <Pressable
                    onPress={() => {
                      setHorizonTouched(true);
                      setActivePicker(null);
                    }}
                    hitSlop={10}
                  >
                    <Text style={[s.sheetDoneTxt, { color: accent }]}>Done</Text>
                  </Pressable>
                </View>
                {/* Operator, 18 september 2026 ("ik zag pas achteraf dat
                   alle sessies naar 1 week gereset zijn — niet duidelijk
                   voor gebruiker"): Plan length is protocol-breed, niet
                   per sessie (build-your-day.tsx houdt 'm als gedeelde
                   staat) — elke wijziging hier verandert 'm stilzwijgend
                   voor ALLE sessies in dit protocol. Dat stond nergens,
                   dus wie 'm op sessie 2 anders zette dacht een eigen
                   waarde voor die ene sessie te kiezen. Nu expliciet. */}
                <Text style={s.horizonHint}>
                  Applies to your whole protocol, not just this session
                </Text>
                <ScrollView
                  style={{ flexShrink: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
                >
                  <View style={s.sheetList}>
                    {HORIZON_OPTIONS.map((o, i) => {
                      const isSel = o.key === horizon;
                      return (
                        <View key={o.key}>
                          {i > 0 && <View style={s.sheetSeparator} />}
                          <Pressable
                            style={s.sheetRow}
                            onPress={async () => {
                              /* Operator, 18 september 2026 ("Apple
                                 Contextual Alert i.p.v. een toast
                                 achteraf"): een wijziging die ECHT iets
                                 verandert (`o.key !== horizon`) EN andere
                                 sessies in het protocol raakt
                                 (`protocolSessionCount > 1`) blokkeert
                                 even met een bevestiging VOORDAT hij
                                 doorgevoerd wordt — geen "toast" die pas
                                 na de feiten repareert. Bij de eerste/
                                 enige sessie (niets anders om te raken)
                                 of dezelfde waarde opnieuw tikken: gewoon
                                 direct doorzetten, geen onnodige vraag. */
                              if (o.key === horizon) return;
                              if (protocolSessionCount > 1) {
                                const ok = await confirmVibezAlert({
                                  title: 'Update Protocol Length?',
                                  message: `This change will apply to all ${protocolSessionCount} sessions in your current protocol.`,
                                  confirmText: 'Update All',
                                });
                                if (!ok) return;
                              }
                              hapticTap();
                              setHorizon(o.key);
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={s.sheetRowTitle}>{o.name}</Text>
                              <Text style={s.sheetRowSub}>{o.hint}</Text>
                            </View>
                            {isSel && <Check size={18} color={accent} strokeWidth={2.6} />}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </SafeAreaView>
          </GlassSheet>
        </>
      )}
    </SafeAreaView>
  );
}

/* Operator, 17 september 2026: in een functie gewikkeld i.p.v. één keer op
   moduleniveau berekend — nodig zodat `BreathSetupScreen` 'm hierboven met
   het juiste (licht/donker) palet opnieuw kan opbouwen voor addToDay,
   zonder dat elke stijl-eigenschap zelf hoeft te veranderen. Verder
   volledig ONGEWIJZIGD, dezelfde stijlen als voorheen. */
const makeStyles = (C: typeof DARK, light: boolean) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  /* Operator, 11 september 2026 (2e correctie): "harde rand zichtbaar,
     geen vage gloed" — een vlakke cirkel met lage opacity heeft nog
     steeds een harde rand, alleen minder fel. Een top-naar-onder
     `LinearGradient` (accent → transparant) heeft GEEN rand, enkel een
     vloeiende overgang — geen radial-gradient-library nodig voor een
     gloed die toch alleen bovenin het scherm hoeft te zitten. Lage
     `opacity` op de laag zelf i.p.v. alpha-in-de-kleur, want `st.accent`
     komt soms als hex en soms als rgb(a) binnen. */
  bgGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_H * 0.55,
    opacity: 0.22,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    /* Operator, 5 okt 2026 ("grijze bol rechtsboven moet weg — moet de
       terugpijl in een cirkel?"): nee, app-breed is het een kale chevron
       (components/HeaderBackButton). Geen vlak meer achter pijl of spacer. */
    backgroundColor: 'transparent',
  },
  scroll: { alignItems: 'center' },
  /* Operator, 9 september 2026: titel/tagline/beschrijving weg — enkel de
     statenaam blijft, klein en direct onder de iconenbalk (die absoluut
     erboven zweeft, vandaar de paddingTop). */
  stateHeader: {
    width: SCREEN_W,
    paddingHorizontal: 24,
    /* Operator, 10 september 2026: "cirkel en tekst erboven iets hoger
       zetten, cta onderaan staat nu te laag" — de Custom-stepper voegde een
       extra rij toe onder de duur-cirkels, waardoor de footer verder
       omlaag kwam te staan dan bedoeld. Ruimte teruggewonnen bovenaan
       (56 → 36) i.p.v. alles onderaan samen te persen.
       Operator, 24 september 2026 ("choose your duration-kaart staat nu
       onder de cta"): zelfde probleem, zelfde truc — `need` (nieuwe regel
       onder de staat-naam) voegde weer een rij hoogte toe, dus nog eens
       ingekort (36 → 24) om de duur-kaart weer boven de vaste footer te
       krijgen. Deze normale flow is bewust een vaste `View` zonder scroll
       ("alles op 1 scherm") — zie `ContentWrap` hierboven — dus groeit de
       inhoud, dan moet hier ruimte vandaan komen, niet via scrollen. */
    paddingTop: 24,
    alignItems: 'center',
  },
  /* Operator, 11 september 2026: exacte specificatie — 14px Bold,
     letterSpacing +1.5. Was semibold/13px/1.6. */
  stateHeaderTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: C.textDim50,
    textAlign: 'center',
  },
  stateNeedTxt: {
    marginTop: 3,
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    color: C.textDim65,
    textAlign: 'center',
  },
  /* Operator, 9 september 2026: de rechthoekige kaart is nu een grote
     voortgangsring, hoger op het scherm. */
  zoneList: { gap: 12, marginTop: 4, marginBottom: 8 },
  zoneNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  zoneDot: { width: 6, height: 6, borderRadius: 3 },
  infoLead: { fontFamily: BrandFonts.medium, fontSize: 17, lineHeight: 24, color: '#ffffff', marginTop: 8 },
  infoChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  infoChip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
  },
  infoChipTxt: { fontFamily: BrandFonts.semibold, fontSize: 12.5, color: '#ffffff' },
  zoneRow: { gap: 3 },
  zoneHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  zoneName: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff', flexShrink: 1 },
  zoneRange: { fontFamily: BrandFonts.medium, fontSize: 13.5, color: 'rgba(255,255,255,0.6)', fontVariant: ['tabular-nums'] },
  zoneText: { fontFamily: BrandFonts.medium, fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.6)' },
  techTitle: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 40 },
  techTitleTxt: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#ffffff' },
  /* Operator: "de pil van de carrousel korter" — op maat van de korte namen. */
  techWheelWrap: { alignSelf: 'center', width: 190, marginTop: 48 },
  heroWrap: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFill: {
    position: 'absolute',
    top: HERO_STROKE * 2,
    left: HERO_STROKE * 2,
    width: HERO_SIZE - HERO_STROKE * 4,
    height: HERO_SIZE - HERO_STROKE * 4,
    borderRadius: (HERO_SIZE - HERO_STROKE * 4) / 2,
    backgroundColor: C.heroFill,
  },
  /* Golf-laag, geclipt tot een cirkel via `overflow:'hidden'` + volle
     `borderRadius` — zie de uitleg bij `WAVE_D` hierboven. Gecentreerd op
     hetzelfde middelpunt als de ring (`WAVE_INSET` naar boven/links t.o.v.
     `heroWrap`, want `WAVE_D` < `HERO_SIZE`). */
  heroLiquidMask: {
    position: 'absolute',
    top: WAVE_INSET,
    left: WAVE_INSET,
    width: WAVE_D,
    height: WAVE_D,
    borderRadius: WAVE_D / 2,
    overflow: 'hidden',
  },
  /* Glans-flits, geclipt tot de VOLLE cirkel — zelfde goedkope
     View-clip-techniek als `heroLiquidMask` hierboven, geen SVG-mask. */
  heroShineMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderRadius: HERO_SIZE / 2,
    overflow: 'hidden',
  },
  heroShineStrip: {
    position: 'absolute',
    top: -HERO_SIZE,
    bottom: -HERO_SIZE,
    width: 70,
  },
  /* Ponst het midden van de flits eruit — wat overblijft is enkel een
     dunne rand exact zo breed als de ring zelf (`HERO_STROKE`). Effen
     schermachtergrond, geen transparantie nodig: alles binnen deze
     cirkel (golven, tekst) tekent er toch gewoon overheen. */
  heroShinePunch: {
    position: 'absolute',
    top: HERO_STROKE,
    left: HERO_STROKE,
    width: HERO_SIZE - HERO_STROKE * 2,
    height: HERO_SIZE - HERO_STROKE * 2,
    borderRadius: (HERO_SIZE - HERO_STROKE * 2) / 2,
    backgroundColor: C.heroFill,
  },
  heroInner: { alignItems: 'center', paddingHorizontal: 22 },
  /* Operator, 11 september 2026: exacte specificatie — 11px Medium,
     letterSpacing +0.5. Was semibold/10.5px/1.4. */
  heroLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.textDim40,
  },
  /* Operator, 11 september 2026: exacte specificatie — 54px Bold,
     letterSpacing -1.0. Was 42px, geen letterSpacing. */
  heroClock: {
    marginTop: 0,
    fontFamily: BrandFonts.bold,
    fontSize: 54,
    letterSpacing: -1,
    color: C.text,
  },
  /* Operator, 9 september 2026: "tekst in de bol raakt de randen niet
     goed" — kleiner lettertype, ruimere paddingHorizontal (`heroInner`
     hierboven) en een expliciete lineHeight, zodat een lang patroon (bv.
     Box' "4s inhale · 4s hold · 4s exhale · 4s hold") over twee regels
     netjes binnen de cirkel blijft i.p.v. de kromming te raken. */
  /* Operator, 11 september 2026: exacte specificatie — 14px Regular,
     geen letterSpacing. Was medium/11.5px/0.2. */
  /* Operator, 8 okt 2026 ("extended exhale breathing mag op 2 lijnen, nu te
     dicht tegen de cirkel"): smaller vak zodat lange namen netjes breken,
     ruim binnen de rand. */
  /* Operator, 10 okt 2026: de tijd staat altijd op dezelfde plek — vaste
     hoogte van twee regels, de naam onderaan uitgelijnd. */
  heroTechRow: { alignItems: 'center', justifyContent: 'flex-end', height: 38, marginBottom: 14 },
  /* Operator: "Extended Exhale Breathing mag op 2 lijnen" — smaller blok. */
  heroTechLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroTech: {
    flexShrink: 1,
    alignSelf: 'center',
    marginTop: 0,
    /* Ademruimte zit op heroTechRow. */
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    color: C.textDim75,
  },
  /* Iconen-knoppen i.p.v. platte tekst-pills — de gekozen techniek is een
     volle pil in de accentkleur, de rest blijft dun omrand. */
  /* Operator, 11 september 2026: "3 knoppen staan in asymmetrische
     driehoek, zet ze netjes op 1 horizontale lijn (segmented control)" —
     `flexWrap` weg (dat veroorzaakte de driehoek: 2 pasten, de 3e
     wrapte naar een eigen regel), elke knop krijgt nu `flex:1` zodat ze
     de breedte eerlijk verdelen op één rij, ongeacht naamlengte. */
  techRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 30,
    paddingHorizontal: 26,
  },
  techBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 20,
  },
  /* Operator, 11 september 2026 (2e correctie): "glas voor inactief,
     gradient voor actief" — glas-LOOK voor de niet-gekozen pillen (geen
     echte blur, zie de toelichting bij de aanroep hierboven). */
  techBtnGlass: {
    backgroundColor: C.glassBg,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  /* De 3-kleuren-`st.gradient`-vulling voor de gekozen pil. Eigen
     `borderRadius` — de ouder (`techBtn`) heeft bewust GEEN
     `overflow:'hidden'` meer (zie de 4e correctie hierboven, dat was de
     bug), dus deze laag moet zichzelf afronden i.p.v. op de ouder te
     leunen om af te klemmen. */
  techBtnSheen: { ...StyleSheet.absoluteFillObject, borderRadius: 20 },
  /* Operator, 11 september 2026: exacte specificatie — 14px SemiBold
     voor beide (was medium/13px niet-geselecteerd, semibold zonder
     eigen fontSize geselecteerd). */
  techBtnTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 14,
    color: C.textDim55,
  },
  techBtnTxtSel: {
    color: C.techBtnTxtSel,
  },
  /* Operator, 19 september 2026 ("groepeer deze sectie in één
     overzichtelijke, donkere kaart om de interface 'body' te geven"):
     was een kale, ongekaderde sectie — nu een echte kaart (zachte
     afgeronde hoeken, subtiele rand/vulling, eigen padding i.p.v. enkel
     horizontale marge). */
  /* Operator, 19 september 2026 ("op puur zwart mag de kaart gewoon
     donkergrijs zijn — geen doorschemer-glas nodig, dat geeft pas echt
     gelaagdheid"): `#1C1C1E`, Apple's eigen OLED-kaartkleur, i.p.v. een
     bijna-onzichtbare 4%-witte tint. */
  /* Operator, 19 september 2026, 2e ronde ("moet echt glas doorschijnend
     aanvoelen"): de kaart-marges verhuisd naar deze buitenste wrapper
     (positioneert ook de gloed-lagen erachter), zie `section` zelf
     hieronder voor de kaart-vulling die nu semi-transparant is i.p.v.
     dekkend. */
  /* Operator, 19 september 2026 ("ja doen" — echte BlurView i.p.v. een
     platte kleur): `overflow:'hidden'` is hier VERPLICHT, anders
     negeert de blur de afgeronde hoeken. Geen dekkende `backgroundColor`
     meer — `tint="dark"` op de `BlurView` zelf levert de donkere
     glas-tint, een kleur hier erbovenop zou de blur juist camoufleren. */
  /* Operator, 24 september 2026 ("marge letterlijk hetzelfde gebleven, al
     3x aangepast"): de echte oorzaak — `width:'100%'` EN `marginHorizontal`
     tegelijk. In Yoga wordt de breedte-100% eerst berekend, de marge komt
     er DAARNA nog eens bovenop (niet ervan afgetrokken), dus de kaart werd
     breder dan het scherm en liep gewoon door tot voorbij de randen — de
     marge-waarde zelf veranderde niets aan wat zichtbaar bleef. `alignSelf:
     'stretch'` i.p.v. `width:'100%'` laat Yoga de breedte WEL correct
     berekenen als "beschikbare breedte min marge". */
  /* Operator, 24 september 2026 (vervolg, "pill van minuten mocht niet mee
     verkleinen"): de duur-kaart kreeg dezelfde grotere `CARD_MARGIN_H` als
     de techniek-balk — voor de balk geen probleem (enkel tekst, geen
     interne breedte-afhankelijke elementen), maar hierbinnen zit de
     minuten-wheel met een op deze kaart se breedte AFGESTEMDE pil
     (`wheelPill`, vaste `left/right:92`) + "RECOMMENDED"-label ernaast. Een
     smallere kaart duwt de pil dus mee smaller — exact de klacht. Duur-
     kaart blijft daarom op zijn eigen, kleinere marge (26, ongewijzigd
     t.o.v. vóór deze ronde) i.p.v. mee te schalen met de techniek-balk. */
  section: {
    alignSelf: 'stretch',
    marginTop: 32,
    marginHorizontal: 26,
    padding: 18,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  /* Operator, 24 september 2026 ("maak de pill en kaart kleiner, choose
     your duration mag buiten de kaart komen"): losse overrides bovenop
     `section`/`sectionLabel` — enkel de duur-kaart, niet de andere
     `s.section`-gebruikers (die zijn er trouwens niet, maar blijft zo
     expliciet lokaal i.p.v. de gedeelde stijl zelf te wijzigen). */
  durationSectionSmall: {
    /* Operator, 24 september 2026 ("kaart staat te dicht tegen de cta" →
       "heb jij de cta mee naar boven gezet?"): een `marginBottom` hier
       hielp niet — deze kaart zit in de vaste, niet-scrollende
       `ContentWrap` (zie `stateHeader` se paddingTop-toelichting) die al
       exact de beschikbare hoogte opvult. Marge ONDER een element dat al
       krap past duwt de CTA niet weg, het duwt de kaart verder over de
       rand. De juiste fix: minder marge BOVEN (`marginTop` 14 → 6), zodat
       de kaart zelf hoger komt te staan en er een echt zichtbaar gaatje
       ontstaat vóór de vaste footer/CTA. */
    marginTop: 6,
    /* Operator, 24 september 2026 ("cijfer is rechts nog altijd
       afgesneden"): het grotere geselecteerde cijfer (nu 24pt × tot 1,3×
       schaal) heeft meer horizontale lucht nodig dan de verticale
       compactheid vraagt — vandaar apart i.p.v. één platte `padding`. */
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  durationLabelOutside: {
    marginHorizontal: 26,
    marginTop: 32,
    marginBottom: 0,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  /* Operator, 11 september 2026: exacte specificatie — 18px (was 13px). */
  /* Operator, 19 september 2026 ("kleiner, Semibold i.p.v. Heavy Bold,
     mag niet concurreren met de '2:00' bovenin, flink meer ademruimte
     boven"): was 22px Bold — te zwaar naast de grote klok-cijfers. */
  sectionLabel: {
    marginTop: 6,
    marginBottom: 14,
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    letterSpacing: -0.1,
    color: '#ffffff',
  },
  /* Operator, 24 september 2026 ("of i icoon"): rij rondom de naam + het
     info-knopje, i.p.v. de naam los — `marginTop` verhuisde hierheen. */
  durationPresetRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  /* Naam van de gekozen duur-preset (bv. "Quick Reset"), gecentreerd
     onder de segmented control. */
  durationPresetName: {
    /* Vaste regelhoogte i.p.v. enkel `fontSize` — anders blijft de
       gereserveerde ruimte afhankelijk van of er die render-tick al
       tekst in staat, en zakt de slider eronder alsnog een fractie. */
    lineHeight: 16,
    textAlign: 'center',
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.6)',
  },
  durationInfoBtn: {
    padding: 2,
  },
  /* Operator, 5 okt 2026 — i onder de stipjes, label + zone boven het wiel. */
  techInfoBtn: {
    alignSelf: 'center',
    marginTop: 10,
    padding: 4,
  },
  durationHead: {
    alignSelf: 'stretch',
    marginHorizontal: 30,
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durationHeadLbl: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)',
  },
  durationZoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  durationZoneTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.6)',
  },
  techPickRow: {
    alignSelf: 'stretch',
    marginHorizontal: 26,
    marginTop: 22,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  techRowLbl: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    color: '#ffffff',
  },
  techRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  techRowValue: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  techList: { gap: 10, marginTop: 6, marginBottom: 12 },
  /* Tegels + liniaal onder de cirkel (5 okt 2026). */
  pickHead: {
    alignSelf: 'stretch',
    marginHorizontal: 30,
    marginTop: 28,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /* Operator, 5 okt 2026: eerst van rand tot rand; daarna ("is dat
     premium?") terug binnen de marges, even breed als Start session. */
  /* Operator, 5 okt 2026 ("ruimte tussen alles, minuten ver naar
     beneden"). */
  segWrap: { alignSelf: 'stretch', marginHorizontal: 26, marginTop: 44 },
  /* Zelfde hoogte als het naamvak erboven (38 + 14), zodat de tijd exact
     in het midden van de cirkel staat (operator: "minuten mooi in center"). */
  heroRecRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 6, marginTop: 14, height: 38, paddingTop: 2 },
  heroRecDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  heroRecTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.6)',
  },
  ringInfo: { alignSelf: 'center', marginTop: 12, padding: 4 },
  tileRow: {
    alignSelf: 'stretch',
    marginHorizontal: 26,
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 20,
    paddingHorizontal: 8,
    justifyContent: 'center',
    /* Operator, 5 okt 2026: icoon + naam, gecentreerd; het ritme staat in
       de uitleg onder de i, niet op de tegel. */
    alignItems: 'center',
  },
  tileName: {
    fontFamily: BrandFonts.semibold,
    fontSize: 14,
    color: '#ffffff',
  },
  tileNameOff: { color: 'rgba(255,255,255,0.6)' },
  tileInfo: { position: 'absolute', top: 8, right: 8, zIndex: 2 },
  tilePattern: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.45)',
    fontVariant: ['tabular-nums'],
  },
  rulerWrap: { alignSelf: 'stretch', marginHorizontal: 10, marginTop: 64 },
  settingsCard: {
    alignSelf: 'stretch',
    marginHorizontal: 26,
    marginTop: 30,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsRow: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsRowPressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
  settingsSep: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  settingsLbl: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    color: '#ffffff',
  },
  settingsRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  settingsValue: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },
  sheetZoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  sheetWheel: { marginTop: 4, marginBottom: 16 },
  techListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sheetBadgeSm: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  techListTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  techListName: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    color: '#ffffff',
    flexShrink: 1,
  },
  techListLevel: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  techListLevelTxt: { fontFamily: BrandFonts.semibold, fontSize: 10.5, color: '#ffffff' },
  techListSub: {
    marginTop: 3,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.55)',
  },
  heroLevelRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroLevel: {
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  durationPlain: {
    alignSelf: 'stretch',
    marginHorizontal: 26,
    marginTop: 4,
  },
  /* ── addToDay (18 september 2026, mockup "kunnen we deze richting
     gaan"): ring bovenaan + 4 tikbare kaartjes (Time/State/Technique/
     Duration) die elk hun eigen kiezer-modal openen, plus een blijvend
     zichtbare techniek-infokaart. Vervangt de vorige ronde (los
     wielscroller + carrousel + techniek-rij + duur-dials allemaal
     tegelijk op de pagina). ── */
  scrollGrow: { flex: 1 },
  scrollContent: { paddingBottom: 12 },
  /* Stippenrij ("1 of 5") onder de cirkel — zie `pickerDoneMap`/`next`
     bij de kaartjes hierboven. */
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
    backgroundColor: C.dialRingTrack,
  },
  /* "Next: ..." onder de stippenrij. */
  progressTxt: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    letterSpacing: 0.2,
    color: C.textDim45,
  },
  /* 2×2 grid van tikbare kaartjes — elk opent zijn eigen kiezer-modal
     (`activePicker`). Zelfde glas-look als de niet-gekozen
     techniek-knoppen (`techBtnGlass`), consistent met de rest van dit
     scherm i.p.v. een nieuwe kaartstijl te verzinnen.
     Operator, 18 september 2026 ("zet setting cards ook lager, ruimte moet
     ademen"): meer lucht boven de rij (`marginTop`) en tussen de kaartjes
     onderling (`gap`) én binnenin elk kaartje (`gridTile.paddingVertical`)
     i.p.v. de vorige, krappere maten. */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 18,
    paddingHorizontal: 26,
  },
  /* Operator, 20 september 2026 ("kunnen we hier ook dezelfde blur
     techniek toepassen als bij breathwork"): `backgroundColor: C.glassBg`
     (rgba fake-glas) vervangen door een echte `BlurView` (zie de JSX).
     Operator, zelfde dag (vervolg, "witte omlijning bij aanklikken kaart
     zijkanten niet goed zichtbaar na blur"): `overflow:'hidden'` stond
     eerst HIER, op de tegel zelf — dat clipte ook de "volgende stap"-ring
     (`startHereRing`, een child-laag) mee aan de randen, precies waar hij
     zichtbaar moest zijn. `overflow:'hidden'` verhuisde naar een eigen
     binnenste laag (`gridTileBlurClip`, enkel om de BlurView) — de ring
     is nu een latere sibling BUITEN die geclipte laag en volgt overal
     onaangetast de volledige, ronde vorm van de tegel. */
  gridTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: (SCREEN_W - 26 * 2 - 14) / 2,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  /* Enkel om de BlurView — houdt de clip weg van de tegel zelf (en dus
     weg van de `startHereRing`-selectiering, zie de toelichting hierboven
     bij `gridTile`). */
  gridTileBlurClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    overflow: 'hidden',
  },
  /* Operator, 18 september 2026 ("visueel beter als gebruiker eerst state
     kiest"): Technique/Duration zijn vergrendeld totdat State bevestigd
     is. */
  gridTileLocked: { opacity: 0.4 },
  /* Losse randlaag voor de "begin hier"-pulse op de State-tegel, zie de
     toelichting bij de JSX hierboven. Zelfde vorm als `gridTile` zelf. */
  startHereRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  /* Operator, 18 september 2026 ("onderaan als lange card zodat het mooi
     is"): de protocol-brede "Plan length"-tegel, volle breedte i.p.v. de
     helft zoals de 4 sessie-tegels hierboven. */
  gridTileWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginHorizontal: 26,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  gridTileIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.dialRingTrack,
  },
  gridTileText: { flex: 1 },
  gridTileLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 10.5,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: C.textDim45,
  },
  gridTileValue: {
    marginTop: 1,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    color: C.text,
  },
  /* Operator, 18 september 2026 ("gebruiker moet weten wat de state/
     techniek dient... niveaus"): kopregel die naam+niveau-tekst naast
     elkaar zet voor Technique — de rest van de vorige, per-rij-kaart
     styling (`pickerRow`/`pickerRowTxt`/`pickerRowSub`) is vervangen door
     `sheetRow`/`sheetRowTitle`/`sheetRowSub` (Apple-HIG bottom-sheet). */
  pickerRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  wheelWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  /* Het "venster" om de middelste rij — een vaste rand die niet meescrollt,
     zodat het altijd duidelijk is welke rij "gekozen" is ongeacht waar je
     net bent aan het slepen. */
  wheelWindow: {
    position: 'absolute',
    left: 40,
    right: 40,
    top: WHEEL_ITEM_H,
    height: WHEEL_ITEM_H,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderRadius: 10,
  },
  /* wheelPill/wheelRecommendedTag(Txt) — DurationWheel-specifiek, verhuisd
     naar components/DurationWheel.tsx (1 okt 2026) samen met de component
     zelf. wheelRow/wheelTxt/wheelTxtOn hieronder blijven HIER staan, want
     TimeWheel (reminder-tijd, niet duur) gebruikt die nog steeds. */
  wheelRow: { alignItems: 'center', justifyContent: 'center' },
  wheelTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
  },
  wheelTxtOn: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 20,
  },
  wheelTxtBlocked: {
    fontStyle: 'italic',
    textDecorationLine: 'line-through',
    opacity: 0.55,
  },
  stateChipDot: { width: 7, height: 7, borderRadius: 3.5 },
  recommendedBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  recommendedBadgeLight: {
    backgroundColor: '#1C1C1E',
  },
  recommendedTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 10.5,
  },
  recommendedTxtLight: {
    color: '#ffffff',
  },
  durationRow: { flexDirection: 'row', gap: 16 },
  /* Operator, 10 september 2026 (3e ronde): "kan je enkel dunne elegante
     slider? hoe zou apple dat doen?" — geen omrande/gevulde pil meer, enkel
     een dun label boven een kale slider. */
  customRow: { marginTop: 14 },
  customLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    letterSpacing: 0.2,
    color: C.textDim45,
    marginBottom: 6,
  },
  dialWrap: { flex: 1, alignItems: 'center' },
  dial: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Klein label onder de geselecteerde duur-cirkel — de premium naam uit
     `DurationDef.name`, geen nieuwe copy. */
  dialLabel: {
    marginTop: 6,
    minHeight: 26,
    width: 76,
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  durationValue: {
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    color: C.text,
  },
  durationUnit: {
    marginTop: 1,
    fontFamily: BrandFonts.regular,
    fontSize: 10.5,
    color: C.textDim45,
  },
  footer: {
    paddingHorizontal: 26,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  /* Operator, 9 september 2026: "cta knop moet in ons wit" — vaste enkele
     witte kleur, zelfde als (tabs)/breath.tsx, i.p.v. de toestand-
     accentkleur als vulling. Zelfde `BTN_H`/pil-radius (50/25) als
     breath-session.tsx, voor een consistent gevoel tussen dit scherm en
     de sessie die erna komt. */
  /* Operator, 10 september 2026: "de knoppen na choose your state zijn
     anders dan onze andere CTA's" — terecht, en exact dezelfde fout als
     eerder al gefixt bij (tabs)/breath.tsx (7 september 2026, "vorm van de
     cta is anders dan onboarding"): die fix stond enkel dáár, dit scherm
     bleef achter met de oude volle-pil-vorm (borderRadius 25 = height/2,
     geen rand, 16px tekst). Nu exact dezelfde chrome als (tabs)/breath.tsx
     en het welkomstscherm: borderRadius 14, dunne rand, 14px tekst — één
     herkenbare primaire-knop-stijl door de hele app, niet per scherm een
     eigen variant. */
  /* Operator, 18 september 2026 ("overlap-tekst moet boven de cta staan,
     nu niet duidelijk leesbaar" → vervolg: "in waarschuwing change time
     als aanvulling"): volle breedte, geen krappe ring-ruimte meer, plus
     een directe "Change time"-link — zie toelichting bij de call-site. */
  overlapWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  overlapWarning: {
    flexShrink: 1,
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    color: '#ffb4b4',
  },
  overlapChangeTimeBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,180,180,0.4)',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  overlapChangeTimeTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 11.5,
    color: '#ffb4b4',
  },
  /* Operator, 19 september 2026 ("iets meer verticale padding, luxueuzer
     gevoel onder de duim"): 50→56. */
  cta: {
    height: 56,
    borderRadius: 14,
    backgroundColor: C.ctaBg,
    borderWidth: 1,
    borderColor: C.ctaBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: CTA.disabled,
  /* Operator, 11 september 2026: exacte specificatie — 16px (was 14px). */
  ctaTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    letterSpacing: 0.1,
    color: C.ctaText,
  },
  /* Operator, 18 september 2026 ("bij Apple is Dark Mode geen kwestie van
     simpelweg de kleuren omdraaien... we gaan naar dark mode, geen light
     mode voor deze pagina" — specifiek over DEZE techniek-infopopup):
     losgekoppeld van `C`/`light` (de rest van de normale flow — ring,
     techniek-knoppen, hoofd-CTA — blijft licht, ONGEWIJZIGD) en vast op
     Apple se semantische donkere lagen gezet: `#000` (achtergrond, hier de
     gedimde backdrop) vs `#1C1C1E` (Secondary/Tertiary — de kaart "zweeft"
     zichtbaar erboven), plus de 3 tekstniveaus (primary/secondary/tertiary
     label-opacities) verderop bij `modalBody`/`modalPattern`. */
  /* Operator, 24 september 2026 ("pagina achter de kaart moet helemaal
     zwart bij popup, is nu niet zo"): was `rgba(0,0,0,0.6)` — semi-
     transparant, de pagina erachter scheemerde nog door. Volledig
     ondoorzichtig `#0a0a0a` (MERK_ANKER se achtergrondkleur), niets van de
     onderliggende pagina meer zichtbaar. */
  /* Operator, 18 september 2026 ("popupkaarten mogen over volledig scherm
     of achterkant moet donker worden bij popup... achterkant mag niet
     zichtbaar zijn"): de 4 kiezer-modals (Time/State/Technique/Duration)
     zijn nu ECHTE volle-schermpagina's — ondoorzichtig, geen backdrop
     erachter zichtbaar, eigen sluitknop i.p.v. tik-ernaast. Vervangt de
     eerdere (te kleine) `modalCard`-variant. */
  pickerBody: { flexShrink: 1, justifyContent: 'center' },
  /* Operator, 18 september 2026 ("pas alle popups aan op basis van Apple
     HIG — bottom sheet i.p.v. volledig scherm"): de 5 kiezer-modals zijn nu
     een echte iOS-stijl bottom sheet — schuift van onderen op, laat de
     achterliggende pagina gedimd zichtbaar, ronde bovenhoeken, een
     sleepgreep, en een subtiele "Done"-tekstlink i.p.v. een ronde
     kruisknop. `sheetBackdrop` is een LOS kind (niet de sheet omwikkelend)
     — dezelfde reden als eerder bij `pickerFullScreen`: een `Pressable`
     als DIRECTE ouder van de ScrollView/wiel/schuifregelaar erin kaapte
     eerder hun scroll-/drag-gebaren weg. Tikken naast de sheet (op de
     `sheetBackdrop`-laag erachter) sluit 'm, tikken IN de sheet niet. */
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetContainer: {
    maxHeight: SCREEN_H * 0.85,
    backgroundColor: C.modalBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 10,
    /* Operator, 24 september 2026 ("bij box breathing onderste kaart — de
       two holds — staat pal tegen de onderkant"): had enkel `paddingTop`,
       geen `paddingBottom` — bij de 5 kiezer-sheets ving hun eigen
       `ScrollView`-`contentContainerStyle` (`paddingBottom:
       Math.max(insets.bottom,16)`) dit al op, maar de 2 statische
       infosheets (techniek-info/duur-info, geen ScrollView) hadden niets
       eronder — hun laatste regel (bv. Box Breathing se cautionBox) liep zo
       recht door tot de veilige-zone-rand. Op de gedeelde stijl, dus overal
       tegelijk gefixt (ook de 5 sheets krijgen simpelweg iets extra lucht
       ONDER hun eigen scroll-padding, geen probleem). */
    paddingBottom: 24,
  },
  /* Glazen variant voor de twee info-sheets (5 okt 2026). */
  sheetGlass: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  sheetBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitleTxt: {
    color: '#ffffff',
    textAlign: 'left',
    flexShrink: 1,
  },
  sheetEyebrow: {
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.6,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.textDim40,
    opacity: 0.4,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetDoneTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
  },
  horizonHint: {
    paddingHorizontal: 20,
    marginBottom: 10,
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    color: C.textDim55,
  },
  /* "Inset grouped"-lijst: alle rijen in ÉÉN afgeronde kaart met dunne
     scheidingslijnen ertussen, i.p.v. elke optie als eigen omrande kaart. */
  sheetList: {
    borderRadius: 14,
    backgroundColor: C.glassBg,
    overflow: 'hidden',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  sheetSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.glassBorder,
    marginLeft: 14,
  },
  sheetRowTitle: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    color: C.text,
  },
  sheetRowSub: {
    marginTop: 2,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: C.textDim55,
  },
  /* Subtiele niveau-tekst i.p.v. de omrande pil — Apple-HIG-feedback:
     "focus moet op de naam van de techniek blijven liggen". */
  sheetLevelTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    color: C.textDim45,
  },
  /* Operator, 18 september 2026 ("tijd moet gebruiker boven de scroll ook
     digitaal kunnen invoeren"): HH:MM-invoer + AM/PM boven het wiel. */
  digitalTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  digitalTimeInput: {
    width: 56,
    textAlign: 'center',
    fontFamily: BrandFonts.bold,
    fontSize: 28,
    color: C.text,
    backgroundColor: C.glassBg,
    borderRadius: 12,
    paddingVertical: 6,
  },
  digitalTimeColon: {
    fontFamily: BrandFonts.bold,
    fontSize: 28,
    color: C.textDim55,
  },
  ampmGroup: { flexDirection: 'row', marginLeft: 10, borderRadius: 10, overflow: 'hidden' },
  ampmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.glassBg,
  },
  ampmBtnTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    color: C.textDim65,
  },
  digitalTimeHint: {
    textAlign: 'center',
    marginBottom: 14,
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    color: C.textDim45,
  },
  /* Operator, 9 september 2026 (2e ronde): "nu ook lange uitleg" — icoon +
     cijferpatroon + één korte zin i.p.v. de volle `explain`-alinea, zelfde
     aanpak als de RHYTHMS-popup op de Breath-tab. */
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 18,
    textAlign: 'center',
  },
  modalMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalLevelBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modalLevelTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  /* Tertiary Label — de "4-4-4-4"-metadata, vast wit-op-donker (niet
     `C.textDim40`, dat is de LICHTE variant en zou hier bijna onzichtbaar
     zijn op de nu donkere kaart). */
  modalPattern: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.4)',
  },
  /* Secondary Label — de uitlegzinnen. */
  /* Operator, 24 september 2026 (vervolg, pasted Apple-sheets-referentie
     "geen bulletpoints, royale witruimte"): bulletpoints verlaten voor een
     links uitgelijnde doorlopende alinea in een echte bottom-sheet
     (`sheetRoot`) — geldt nu voor zowel de duur- als de techniek-infosheet
     (de oude gecentreerde `modalBody` is met de gecentreerde kaart mee
     verdwenen, dit vervangt hem overal). */
  /* Operator, 24 september 2026 (pasted analyse: "Use this when / Why
     this technique" als losse, benoemde secties i.p.v. ongemarkeerde
     alinea's achter elkaar): kleine, gedimde sectiekop — zelfde patroon
     als iOS-instellingenlijsten, geen extra "kaart" nodig om de secties
     visueel te scheiden. */
  sheetRecommendedNote: {
    marginTop: -8,
    marginBottom: 16,
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
    color: 'rgba(255,255,255,0.4)',
  },
  sheetSectionLabel: {
    marginTop: 14,
    marginBottom: 6,
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.4)',
  },
  sheetInfoBody: {
    marginTop: 4,
    marginBottom: 20,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'left',
    color: 'rgba(255,255,255,0.7)',
  },
  /* Operator, 24 september 2026 (pasted Apple-referentie "Contextual
     Triggers" — korte, brede momentlabels i.p.v. een letterlijk scenario
     in de lopende tekst): eigen, scanbaar blokje met veel witruimte, elk
     label voorafgegaan door een subtiel puntje in de accentkleur (de
     "zacht pulserend cirkeltje/kalm klokje"-suggestie uit de referentie,
     vertaald naar een simpel, rustig stipje i.p.v. een letterlijk
     icoontje per moment). */
  momentsList: {
    marginTop: -8,
    marginBottom: 4,
    gap: 10,
  },
  momentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  momentDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  momentTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.85)',
  },
  /* Operator, vervolg ("de oranje waarschuwing... in dark mode worden
     kleuren aangepast naar lagere verzadiging... callout-box met donkere,
     transparante oranje achtergrond"): geen felle tekst los op de kaart
     meer, maar een eigen vlak — zachtere amberkleur i.p.v. de volle
     `#F5A524`, die is te fel/verzadigd op een donkere ondergrond. */
  modalCautionBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(245,165,36,0.14)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modalCaution: {
    flex: 1,
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#F0B86E',
  },
});

/* Module-brede standaard (licht, de normale flow se kleuren) — enkel nog
   gebruikt door `DurationDial`/`TimeWheel` hierboven, die als losse
   top-level componenten niet aan `BreathSetupScreen` se lokale, per-modus
   `s` kunnen — zie de toelichting daar. Hun EIGEN stijlen dragen sowieso
   geen kleur (die komt altijd als prop binnen), dus welke variant van `s`
   zij lezen maakt voor de vormgeving niets uit. */
const s = makeStyles(C, light);
