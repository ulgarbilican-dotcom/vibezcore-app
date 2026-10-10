/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet control screen (modernized 2026-05-27)

   Drives the bracelet via the BLE contract (services/ble-contract.ts).
   Today: SimulatedBracelet — same UI when RealBracelet plugs in.

   Spec-compliance (Haptic_Bracelet_Spec_v2_3):
   - §11.3/§11.5: shows ONLY mode name, bounded duration, remaining time,
     battery, BLE status, stop. NO PPS / burst_ms / amplitude / RTP.
   - §8.3/§11.4: app polls status every 5s while connected.
   - §11.2: duration bounds enforced via clampDuration().

   States this screen renders (mutually exclusive):
   - Not connected → searching screen with Retry-CTA
   - Connected + fault → fault screen (reconnect / contact support)
   - Connected + charging + !sessionActive → charging screen (paused state)
   - Connected + sessionActive → big timer + pulsing circle + Stop CTA
   - Connected + idle → mode selection + duration presets + Start CTA

   Visual language matches the modernized bracelet etalage:
   - Tinted background per mode (mode-color @ 12%) for selected card
   - Mode-color accent on duration presets and Start button
   - Pulsing colored circle for active session (similar to sonar on etalage)
   - Sticky bottom action button
   - Glass-chip status indicators
   ─────────────────────────────────────────────────────────────────────── */

import PressScale from '@/components/PressScale';
import { GlassSheet } from '@/components/GlassSheetHost';
import { rootBlurRef } from '@/utils/root-blur';
import { BraceletActivationCta } from '@/components/BraceletActivationCta';
import PodPulse from '@/components/PodPulse';
import { getBraceletSessionSnapshot, subscribeBraceletSession } from '@/services/bracelet-session-state';
import { HapticPulseRings } from '@/components/HapticPulseRings';
import RhythmSheet, { useRestingPulse } from '@/components/RhythmSheet';
import { shouldSuggestRemeasure } from '@/services/resting-pulse';
import { setStateHear, useStateHear } from '@/services/state-sound-pref';
import { QUICK_SESSION_MINUTES, QUICK_SESSIONS } from '@/services/ble-contract';
import {
  PREVIEW_MAX_SECONDS,
  previewCondensedRampMinutes,
  playModeTrialHaptic,
  stopModePreviewHaptic,
  subscribeHapticPulse,
  isWatchPlayingRhythm,
} from '@/services/bracelet-haptics';
import { deviceCanVibrate, dismissCompletionNotice, hasNativeWaveform } from '../../modules/state-haptics';
import { isActiveSessionVisible, setActiveSessionVisible, setChooseScreenVisible } from '@/utils/state-control-ui';
import {
  startSessionKeepAlive,
  stopSessionKeepAlive,
} from '@/services/session-keepalive';
import {
  consumePendingCompletion,
  getBraceletMonitorRemainingSec,
  getBraceletMonitorSession,
  isBraceletSessionMonitorActive,
  subscribeSessionCompletion,
  type SessionCompletion,
  pauseBraceletSessionMonitor,
  resumeBraceletSessionMonitor,
  startBraceletSessionMonitor,
  stopBraceletSessionMonitor,
  subscribeRemoteControl,
  startStateControlNow,
} from '@/services/bracelet-session-monitor';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, HeartPulse, Info, Lock, MoonStar, Pause, Play, Settings, SlidersHorizontal, Sparkles, Target, Vibrate, Volume2, Waves, Zap } from 'lucide-react-native';
import { BrandDark, BrandLight, BrandFonts, TypeScale, AudioAccent } from '@/constants/theme';
/* Operator, 16 september 2026 ("bracelet-control naar light mode"): dit
   bestand gebruikte overal de vaste donkere `Brand`-alias (nooit een
   light/dark-toggle gehad, in tegenstelling tot de rest van de app sinds
   5 september 2026). BrandLight/BrandDark delen exact dezelfde sleutels
   (bg/accent/accentHover/success/error/panel/border/text/textDim), dus
   elke oorspronkelijke `Brand.X`-referentie in dit bestand is
   mechanisch vervangen door `C.X` — zelfde structuur/naamgeving als
   bracelet.tsx. */
/* Operator, 26 september 2026: dark is de nieuwe app-brede default (was
   light, 14 september) — zelfde hardcoded-schakelaar-patroon, enkel de
   waarde omgezet. */
const light = false;
const C = light ? BrandLight : BrandDark;
import {
  recordSession,
  useBraceletStats,
  type BraceletStats,
  type SessionStatus,
} from '@/utils/bracelet-history';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { Redirect, Stack, router, useFocusEffect, useLocalSearchParams, usePathname } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  AppState,
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
  type EdgeInsets,
} from 'react-native-safe-area-context';
import {
  BleCommand,
  BleConnectionState,
  BleStatusPacket,
  BraceletMode,
  MODES,
  ModeMeta,
  clampDuration,
  getModeMeta,
  type BraceletTransport,
} from '../services/ble-contract';
/* Operator, 29 september 2026 ("kan dat volgens onze firmware/pcb"): puur
   app-zijdige voorselectie, geen BLE-impact — zie `suggestBraceletMode`
   (gedeeld met activity.tsx, zie de toelichting daar). */
import { suggestBraceletMode } from '@/utils/bracelet-suggestion';
/* Reanimated, aliased: dit bestand gebruikt RN's eigen `Animated` overal
   (AnimatedCircle/AnimatedPath, DrainingCircle, SearchingPulse, etc.) —
   die code blijft ongewijzigd. PressableScale hieronder is de EERSTE
   Reanimated-gebruiker in dit bestand, dus geïmporteerd onder een eigen
   naam om niet te botsen met RN's `Animated` hierboven. */
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useAnimatedScrollHandler,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
  interpolate,
  Extrapolation,
  Easing as ReanimatedEasing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { MODE_GLYPH_ICONS } from '@/components/ModeGlyph';
import LiquidWave, { breathWaveLook } from '@/components/LiquidWave';
import VibezGlass from '@/components/VibezGlass';
import { ModeGlyph } from '@/components/GuidanceSelector';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { getBracelet, getSimHooks, USE_SIMULATED_BLE } from '../services/bracelet';
import type { SimulatedBracelet } from '../services/bracelet-sim';
import {
  playBraceletStartCue,
  playBraceletCompletionCue,
} from '@/services/bracelet-voice';
import { useSetting } from '@/utils/settings';
import { isLightColor } from '@/utils/color';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumPaywallModal from '@/components/PremiumPaywallModal';
import {
  useBraceletOwner,
  useDevBraceletActivated,
} from '@/utils/dev-user-override';
import { useBraceletNudge, openBraceletWebsite } from '@/services/bracelet-upsell';
import { hapticPress, hapticTap, hapticTick } from '@/utils/haptics';

/* MERK_ANKER §2 levert geen "warn"-kleur. Voor de battery-warn drempel
   (5–20%) gebruiken we de Sharp Focus oranje uit CLAUDE.md §5. */
const WARN = '#FF9F0A';
/* Operator, 16 september 2026 ("de search haptic mag in blauw"): Signal
   Blue is app-breed voorbehouden voor functionele "nu actief"-signalen
   (zie theme.ts) — de radar-puls tijdens het zoeken/verbinden IS
   precies dat, dus dit is de correcte kleur ervoor, niet de algemene
   C.accent (Royal Indigo). */
const SIGNAL_BLUE = '#3A8FFF';

/* App polls status every 5 seconds when connected (spec §8.3/§11.4). */
const POLL_MS = 5000;

/* Operator, 16 september 2026 ("de pagina is te saai, ik wil een pro
   animatie... ik wil armband"): hero-cutout (transparante achtergrond)
   voor bovenaan het Choose-mode-scherm, met een zachte gekleurde gloed
   erachter die van kleur verschuift met de geselecteerde modus. */
const HERO_BRACELET_IMG =
  'https://vibezcore-audio.b-cdn.net/images/Shattudkite_vzc_fiv%20no%20bg.png';

/* Operator, 16 september 2026 ("geen drukke foto's in de selectiekaarten
   — Apple zou kiezen voor een egale kaart met een strak, minimalistisch
   icoontje"): MODE_IMAGES/de foto-cards hieronder zijn vervangen door
   MODE_ICONS. De stockfoto's (mensen in pakken, papieren) sneden de
   naam af ("Calm Contr..") en leidden af van de status-info. Iconen
   gekozen in lijn met de operator's eigen voorbeelden (bliksem voor
   Boost, golf voor Calm Control).
   Vervolg, 23 september 2026 ("SF Symbols zoals target/moon.stars.fill"):
   Crosshair → Target, Moon → MoonStar — ook doorgevoerd in
   breath-welcome.tsx's `STATE_ICONS` zodat beide sets identiek blijven. */
/* Dezelfde vijf tekens als de Breath-tab (operator, 5 okt 2026). */
const MODE_ICONS = MODE_GLYPH_ICONS;

/* Operator, 16 september 2026: min/default blijven de officiële hardware-
   spec-waardes (PPS blijft firmware-only, spec §11.5, NOOIT in de UI).
   Max-waardes bijgesteld na online onderzoek naar effectieve/optimale
   sessieduur per type toestand (powernap-/attentie-/relaxation-/NSDR-
   literatuur) — zie ook `maxMinutes`-comments in services/ble-
   contract.ts voor de onderbouwing per modus. "4 tijdlijnen per state"
   (operator): elke modus heeft nu exact 4 preset-chips, min/default/
   tussenwaarde(s)/max. "Recommended" = de officiële default. */
/** Kort · aanbevolen · lang (operator, 9 okt 2026: "max 3 vooringestelde tijden"). */
function threePresets(mode: BraceletMode): { value: number; recommended?: boolean }[] {
  const all = DURATION_PRESETS[mode];
  const rec = all.find((p) => p.recommended) ?? all[0];
  const longest = all[all.length - 1];
  /* Vervolg (operator, 9 okt 2026: "15 en 18 recommended liggen zo dicht
     bij elkaar"): ligt het minimum minder dan 5 min onder de aanbeveling,
     dan aanbevolen · midden · lang (korter kan nog via de rand). */
  if (rec.value - all[0].value < 5) {
    const target = (rec.value + longest.value) / 2;
    const middle = all
      .filter((p) => p.value > rec.value && p.value < longest.value)
      .sort((x, y) => Math.abs(x.value - target) - Math.abs(y.value - target) || x.value - y.value)[0];
    const picks = middle ? [rec, middle, longest] : [rec, longest];
    return picks.filter((p, i) => picks.findIndex((q) => q.value === p.value) === i);
  }
  const picks = [all[0], rec, longest];
  return picks.filter((p, i) => picks.findIndex((q) => q.value === p.value) === i);
}

const DURATION_PRESETS: Record<BraceletMode, { value: number; recommended?: boolean }[]> = {
  [BraceletMode.Gamma]: [
    { value: 8 },
    { value: 10, recommended: true },
    { value: 15 },
    { value: 20 },
  ],
  [BraceletMode.Beta]: [
    { value: 15, recommended: true },
    { value: 20 },
    { value: 25 },
    { value: 30 },
  ],
  [BraceletMode.Alpha]: [
    { value: 15 },
    { value: 18, recommended: true },
    { value: 20 },
    { value: 25 },
    { value: 30 },
  ],
  [BraceletMode.Theta]: [
    { value: 20 },
    { value: 25, recommended: true },
    { value: 35 },
    { value: 45 },
  ],
  [BraceletMode.Delta]: [
    { value: 30, recommended: true },
    { value: 35 },
    { value: 40 },
    { value: 50 },
  ],
};

/* Per-mode breathwork-tempo voor PulsingCircle + BreathingHint.
   Operator-feedback 2026-05-27: tekst en pulse moeten matchen met
   het beoogde state-tempo per mode. Geen literal brain-wave Hz
   (Gamma 40Hz = onmogelijk om te ademen op) — wel breathwork-onderzoek-
   gebaseerde rythmes die de target-state ondersteunen:
     - Boost (Gamma):       3s/3s = ~10 BPM, energieke ademing
     - Sharp Focus (Beta):  4s/4s = ~7.5 BPM, focused
     - Calm Control (Alpha): 5s/5s = ~6 BPM, coherent breathing (HRV)
     - Clarity (Theta):     6s/6s = ~5 BPM, diepe relaxatie
     - Sleep (Delta):        7s/7s = ~4.3 BPM, slaap-voorbereiding
   Pulse-animatie cycle = inMs + outMs (totaal 6-14s afh. mode). */
const MODE_BREATH: Record<BraceletMode, { inMs: number; outMs: number }> = {
  /* Iter v168 (2026-06-28): Gamma visuele pulse synchroniseren met het
     daadwerkelijke breathwork-protocol (2-2 Bhastrika in BREATH_PROTOCOLS
     hieronder). Voorheen 3000/3000 → visuele animatie liep uit pas met
     de actual breath timing. Operator zag op active-sessie verschillende
     waarden tussen Breath tab (2-2) en Bracelet (3-3). */
  [BraceletMode.Gamma]: { inMs: 2000, outMs: 2000 },
  [BraceletMode.Beta]: { inMs: 4000, outMs: 4000 },
  [BraceletMode.Alpha]: { inMs: 5000, outMs: 5000 },
  [BraceletMode.Theta]: { inMs: 6000, outMs: 6000 },
  [BraceletMode.Delta]: { inMs: 7000, outMs: 7000 },
};

/* ── Breathwork protocols (opt-in) ────────────────────────────────────────
   Operator-keuze 2026-05-27 iter 5: breathwork is een EIGEN feature, niet
   een continue pulse-decoratie van de bracelet-sessie. Bracelet+haptic
   blijft de primaire ervaring; breathwork kan de gebruiker desgewenst
   inschakelen via een toggle onderaan het active-scherm.

   Cycle-counts gebaseerd op breathwork-research-guidance (operator iter 8,
   2026-05-27). Tijden hieronder matchen wetenschappelijke minima voor het
   beoogde effect; verlengen naar maxima kan via toekomstige
   "intensity"-setting (power-user feature).

   Wetenschappelijke onderbouwing:
     - Energizing (Boost):   60 cycli × 3s/3s = 6 min
         Long fast-paced breathing → adrenaline/cortisol mobilisatie.
         Research-target 5-7 min (3 Wim Hof-rondes met retentie). Wij
         doen pure cycles zonder retentie voor safety (geen contra-
         indicaties met rijden/zwemmen). Toekomst: rounds + retention
         als aparte feature met safety-disclaimer.
     - Box breath (Focus):   30 cycli × 4s/4s = 4 min
         CO₂-stabilisatie + prefrontale cortex activatie. Research-
         target 3-5 min. 4 min zit in het midden.
     - Coherent (Calm):      30 cycli × 5s/5s = 5 min
         Hartslag-ademhaling synchronisatie (HRV resonance). Effect
         kicks in na 3-5 min volgens Lehrer & Gevirtz.
     - Slow paced (Clarity): 25 cycli × 6s/6s = 5 min
         Brein-hemisphere synchronisatie / theta-state transitie. Effect
         na 5 min. Power-users kunnen tot 10 min uitbreiden.
     - 4-7-8 (Rest):         4 cycli × (4+7+8) = 1.3 min
         Weil's expliciete protocol voor beginners. Power-users kunnen
         na 1 week uitbreiden naar max 8 cycli (~3 min).

   Geen medische claims (CLAUDE.md §1) — alleen techniek-namen en duur. */
/* Protocol-type system: ondersteunt verschillende ademhaling-structuren.
   - 'simple'  : pure in/out cycli (coherent, slow paced)
   - 'box'     : 4 fasen in-hold-out-hold (box breathing)
   - '478'     : 3 fasen in-hold-out (4-7-8 Weil)
   - 'nadi'    : alternerende neusgaten (Nadi Shodhana) — 4 fasen per cyclus
   - 'rounds'  : Wim Hof style — meerdere rondes met retentie (fase 3, nog
                 niet hier gedefinieerd) */
type SimpleProtocol = {
  kind: 'simple';
  name: string;
  cycles: number;
  inMs: number;
  outMs: number;
};
type BoxProtocol = {
  kind: 'box';
  name: string;
  cycles: number;
  /** Box breathing heeft 4 gelijke fasen — één waarde geldt voor allen. */
  phaseMs: number;
};
type FourSevenEightProtocol = {
  kind: '478';
  name: string;
  cycles: number;
  inMs: number;
  holdMs: number;
  outMs: number;
};
type NadiProtocol = {
  kind: 'nadi';
  name: string;
  /** Eén "cyclus" = volledige 4-fase wissel: L-in → R-out → R-in → L-out. */
  cycles: number;
  phaseMs: number;
};
/* Physiological Sigh — dubbele inademing (deep + top-up) gevolgd door
   lange uitademing. Iter 9e: vervangt 4-7-8 voor Sleep (operator-
   keuze 27 mei 2026). Pure techniek-instructie, geen claims.
   2026-05-27 iter 9h: niet meer in actief gebruik (te complex voor users);
   code blijft staan voor toekomstig gebruik. */
type SighProtocol = {
  kind: 'sigh';
  name: string;
  cycles: number;
  inMs: number;       // eerste diepe inademing
  inTopUpMs: number;  // tweede kleine "top-up" inademing
  outMs: number;      // lange uitademing
};
/* Triangle breathing — 3-fase symmetrisch (in/hold/out, allemaal gelijk).
   Iter 9h: nieuwe protocol voor Sharp Focus. Sama Vritti pranayama-
   traditie, research-backed voor attention/stress reduction. Simpeler
   dan box (1 hold ipv 2) maar behoudt CO2-stabilisatie van de hold. */
type TriangleProtocol = {
  kind: 'triangle';
  name: string;
  cycles: number;
  /** Eén waarde voor alle 3 fasen — symmetrisch */
  phaseMs: number;
};
/* Wim Hof / rounds-protocol — fase 3, nog niet geïmplementeerd. Placeholder
   type. Wordt nu door Boost gebruikt met 'simple' kind als interim. */
type Protocol =
  | SimpleProtocol
  | BoxProtocol
  | FourSevenEightProtocol
  | NadiProtocol
  | SighProtocol
  | TriangleProtocol;

/* Iter v155 (2026-06-25): bracelet breathwork-protocols 1:1 IDENTIEK
   gesynchroniseerd met breath-tab PATTERNS. Operator-feedback: 'in breath
   tab staan de correcte breathwork, bracelet active pagina breathwork
   moet identiek zelfde zijn als in breath tab'. Mapping:
     Gamma (Boost)        → boost: 2-0-2-0 nose/mouth, 45 cycli (Bhastrika)
     Beta  (Sharp Focus)  → focus: 5-0-5-0 nose/nose, 30 cycli (Coherent)
     Alpha (Calm Control) → calm:  4-4-4-4 nose/nose, 19 cycli (Box)
     Theta (Clarity)      → clarity: 4-2-6-0 nose/mouth, 20 cycli (Long exhale)
     Delta (Sleep)        → rest: 4-7-8-0 nose/mouth, 12 cycli (4-7-8) */
const BREATH_PROTOCOLS: Record<BraceletMode, Protocol> = {
  /* Boost = Bhastrika-inspired quick activation, nose-in/mouth-out.
     2s in / 2s out × 45 = 3 min.
     Iter v170 (2026-06-28): naam 'Bhastrika' → 'Boost' voor consistency
     met Breath tab (zelfde techniek, zelfde label). Bhastrika blijft als
     inspiratie in comment + protocolHow van breath.tsx. */
  [BraceletMode.Gamma]: {
    kind: 'simple',
    name: 'Boost',
    cycles: 45,
    inMs: 2000,
    outMs: 2000,
  },
  /* Sharp Focus = Coherent breath 5-5. 30 cycli × 10s = 5 min. */
  [BraceletMode.Beta]: {
    kind: 'simple',
    name: 'Coherent breath',
    cycles: 30,
    inMs: 5000,
    outMs: 5000,
  },
  /* Calm Control = Box breath 4-4-4-4. 19 cycli × 16s = 5 min. */
  [BraceletMode.Alpha]: {
    kind: 'box',
    name: 'Box breath',
    cycles: 19,
    phaseMs: 4000,
  },
  /* Clarity = Long exhale 4-2-6 (4-7-8 family met korte hold). 20 cycli
     × 12s = 4 min. Mond-exhale, neus-inhale. */
  [BraceletMode.Theta]: {
    kind: '478',
    name: 'Long exhale',
    cycles: 20,
    inMs: 4000,
    holdMs: 2000,
    outMs: 6000,
  },
  /* Sleep = 4-7-8. 12 cycli × 19s = ~4 min. Wind-down protocol. */
  [BraceletMode.Delta]: {
    kind: '478',
    name: '4-7-8',
    cycles: 12,
    inMs: 4000,
    holdMs: 7000,
    outMs: 8000,
  },
};

function breathProtocolTotalMs(p: Protocol): number {
  switch (p.kind) {
    case 'simple':
      return p.cycles * (p.inMs + p.outMs);
    case 'box':
      /* 4 fasen × phaseMs per cyclus */
      return p.cycles * p.phaseMs * 4;
    case '478':
      return p.cycles * (p.inMs + p.holdMs + p.outMs);
    case 'nadi':
      /* 4 fasen (L-in, R-out, R-in, L-out) × phaseMs */
      return p.cycles * p.phaseMs * 4;
    case 'sigh':
      /* 3 fasen: in + top-up + out */
      return p.cycles * (p.inMs + p.inTopUpMs + p.outMs);
    case 'triangle':
      /* 3 fasen × phaseMs (in/hold/out, allemaal gelijk) */
      return p.cycles * p.phaseMs * 3;
  }
}


/* Iter 9dq v8 (2026-06-02): per-mode "when to use" copy voor de info-
   popup. State-anchored zodat user precies weet voor welke taak/context
   het bedoeld is. Operator-feedback iter v9: copy moet expliciet de
   activiteit noemen die in die state past (Boost → fysieke arbeid,
   Clarity → introspectie, etc.) niet alleen het gevoel. */
const BREATH_WHEN: Record<BraceletMode, string> = {
  [BraceletMode.Gamma]:
    'Before high-effort work or workouts — when you need to wake up and feel sharp.',
  [BraceletMode.Beta]:
    'At the start of focused work — study blocks, coding, or important tasks that need full attention.',
  [BraceletMode.Alpha]:
    'Before creative or social moments — when you want to feel calm yet engaged.',
  [BraceletMode.Theta]:
    'For introspective work — journaling, meditation, or moments of deep self-reflection.',
  [BraceletMode.Delta]:
    'Before sleep or during recovery — when you need to wind the system down.',
};

/* Iter 9dq v9 (2026-06-02): pace-meta per mode. Concrete rhythm-info
   zonder medische claims (CLAUDE.md §1: geen "verlaagt hartslag" /
   "activeert X system"). Beschrijft alleen het ademritme zelf. */
/* Iter v155 (2026-06-25): pace-strings 1:1 met breath-tab protocols. */
const BREATH_PACE: Record<BraceletMode, string> = {
  [BraceletMode.Gamma]: '2s in · 2s out · 15 breaths/min',
  [BraceletMode.Beta]: '5s in · 5s out · 6 breaths/min',
  [BraceletMode.Alpha]: '4-4-4-4 box · ~4 breaths/min',
  [BraceletMode.Theta]: '4s in · 2s hold · 6s out · ~5 breaths/min',
  [BraceletMode.Delta]: '4-7-8 · ~3 breaths/min',
};

/* "Hoe samen met bracelet" — micro-copy onder de breath-card. Maakt
   duidelijk dat breathwork OPTIONEEL is en de bracelet z'n werk ook
   zonder doet. Vermindert "moet ik dit doen?"-druk op nieuwe users. */
const BREATH_PAIRING_HINT =
  'Optional. The bracelet works on its own — this layers a guided breath on top.';

/* Breath-method per protocol — via neus of mond. Bron: operator-research
   2026-05-27 iter 8 (gedetailleerde breathwork-spec).
     - Boost (Wim Hof style):  neus-in, mond-uit (krachtig in, ontspannen uit)
     - Sharp Focus (Box):      neus-in, neus-uit (volledig nasaal)
     - Calm Control (Coherent): neus-in, neus OF getuite lippen uit
     - Clarity (Nadi):         wisselende neusgaten (zie nadi-prompts)
     - Rest (4-7-8 Weil):      neus-in, mond-uit met whoosh
   'nose-or-mouth' = user mag kiezen (Calm Control's exhale variant). */
/* Iter v155 (2026-06-25): inhaleVia/exhaleVia 1:1 met breath-tab PATTERNS. */
const BREATH_METHOD: Record<
  BraceletMode,
  { inVia: 'nose' | 'mouth'; outVia: 'nose' | 'mouth' | 'nose-or-mouth' }
> = {
  [BraceletMode.Gamma]: { inVia: 'nose', outVia: 'mouth' }, // boost: nose/mouth
  [BraceletMode.Beta]:  { inVia: 'nose', outVia: 'nose' },  // focus: nose/nose
  [BraceletMode.Alpha]: { inVia: 'nose', outVia: 'nose' },  // calm:  nose/nose
  [BraceletMode.Theta]: { inVia: 'nose', outVia: 'mouth' }, // clarity: nose/mouth
  [BraceletMode.Delta]: { inVia: 'nose', outVia: 'mouth' }, // rest: nose/mouth
};

/* Per-mode ambient background tint voor de active-session screen.
   Operator-keuze 2026-05-27: full-screen rood (Boost / Gamma) voelt als
   alarm/aggressief. Vervangen door warm amber/goud — behoudt "energie"-
   vibe zonder de stress-respons. Dot, ring, en timer-glow blijven wel
   rood (kleine UI-elementen, accent ipv massa). */
function getActiveBgTint(mode: BraceletMode): string {
  if (mode === BraceletMode.Gamma) return '#FFB840'; // warm amber
  return getModeMeta(mode).color;
}

/* Per-mode "Best for" tags — operator-aangeleverd 2026-05-27. Wordt
   getoond op de idle-screen onder de duration-sectie, voor de
   geselecteerde mode. Geeft de gebruiker context over WANNEER deze
   modus de juiste keuze is, zonder medische claims (CLAUDE.md §1). */
/* ── Mode descriptions (iter 9k) ──
   Voor de tap-to-detail popup op state-cards. Brand-aligned state-
   language per CLAUDE.md §1: geen medische/wetenschappelijke claims,
   geen brainwave-naamgeving in user-facing copy, geen "wetenschappelijk
   bewezen" — alleen toestand-taal en research-validated techniek-namen.

   Per mode 4 secties:
     - intent      : welke toestand de gebruiker zoekt (1 zin)
     - braceletDoes: wat de haptic-pulse doet (1 zin, state-taal)
     - protocol    : naam + duur + lichte traditie/origine
     - protocolHow : 1 zin hoe de techniek werkt (geen claims)
   `ideals` blijft in aparte constante MODE_IDEALS. */
type ModeDescription = {
  intent: string;
  braceletDoes: string;
  protocol: string;
  protocolHow: string;
};
/* 5 okt 2026 (operator: "klopt 'sharp, brisk haptic…' nog? wij hebben de
   haptics aangepast"): `braceletDoes` herschreven naar het huidige
   hartslag-model (services/bracelet-haptics.ts) — start op rust-tempo,
   dan geleidelijk naar het eindtempo. Toestand-taal, geen claims.
   Iter v155 (2026-06-25): protocol-strings + protocolHow 1:1 IDENTIEK
   met breath-tab PATTERNS. Operator wil exact dezelfde breathwork in
   bracelet active page als in breath tab. */
const MODE_DESCRIPTIONS: Record<BraceletMode, ModeDescription> = {
  [BraceletMode.Gamma]: {
    intent: 'Alert, energized — primed for high-output moments.',
    braceletDoes:
      'Starts at your resting pace, then quickens to a brisk rhythm. Keep it short — a quick reset, not a long session.',
    protocol: 'Energizing breath 2-2 · 3 min',
    protocolHow:
      'Quick rhythmic in-out breathing. Inspired by Bhastrika pranayama — builds alertness through faster pace.',
  },
  [BraceletMode.Beta]: {
    intent: 'Locked-in focus — attention that holds the line.',
    braceletDoes:
      'Settles just below your resting pace — steady and even.',
    protocol: 'Coherent breath 5-5 · 5 min',
    protocolHow:
      'Inhale 5 seconds, exhale 5 seconds. Six breaths per minute — a resonance pace used in focus-research traditions.',
  },
  [BraceletMode.Alpha]: {
    intent: 'Steady and composed — alert but relaxed.',
    braceletDoes:
      'Eases below your resting pace — calm, yet present.',
    protocol: 'Box breath 4-4-4-4 · 5 min',
    protocolHow:
      'Inhale 4, hold 4, exhale 4, hold 4. Used by special forces for stress recovery — the symmetric holds slow the system down.',
  },
  [BraceletMode.Theta]: {
    intent: 'Quieter mind — space for thought, decompression.',
    braceletDoes:
      'Slows gently over two minutes to a soft, quiet rhythm.',
    protocol: 'Long-exhale 4-2-6 · 4 min',
    protocolHow:
      'Inhale 4, brief 2-second hold, exhale 6 through the mouth. Inspired by extended-exhale practices used in reflection traditions.',
  },
  [BraceletMode.Delta]: {
    intent: 'Wind-down — recovery, pre-sleep, after stressful days.',
    braceletDoes:
      'The slowest, softest rhythm — easing down over two minutes.',
    protocol: '4-7-8 breath · 4 min',
    protocolHow:
      'Inhale 4, hold 7, exhale 8 through the mouth. Popularized by Dr. Andrew Weil — the extended exhale signals the body to slow down.',
  },
};

const MODE_IDEALS: Record<BraceletMode, string[]> = {
  [BraceletMode.Gamma]: [
    'Energy',
    'Mental sprints',
    'High-stakes tasks',
    'Speed & precision',
  ],
  [BraceletMode.Beta]: [
    'Deep work',
    'Morning activation',
    'High cognitive load',
    'Precision tasks',
  ],
  [BraceletMode.Alpha]: [
    'Focused work',
    'Midday reset',
    'Social interactions',
    'Problem-solving',
  ],
  [BraceletMode.Theta]: [
    'Reflection',
    'Creative work',
    'Emotional processing',
    'Inward focus',
  ],
  [BraceletMode.Delta]: [
    'Physical recovery',
    'Pre-sleep',
    'Nervous system reset',
    'Tension release',
  ],
};

/* Generate duration-presets binnen de mode's min/max-range. Step = 5 voor
   de meeste modes (≥10min range), step = 2 voor Boost (8-15, kortere
   range). Laatste waarde is altijd exact maxMinutes zodat de bovengrens
   altijd tikbaar is. */
function durationPresets(mode: BraceletMode): number[] {
  const m = getModeMeta(mode);
  const range = m.maxMinutes - m.minMinutes;
  const step = range > 10 ? 5 : 2;
  const out: number[] = [];
  for (let v = m.minMinutes; v <= m.maxMinutes; v += step) out.push(v);
  if (out[out.length - 1] !== m.maxMinutes) out.push(m.maxMinutes);
  return out;
}

/* ── Completion messages per mode ──
   Iter v168 (2026-06-28): EXACT identieke tekst aan breath.tsx
   COMPLETION_MESSAGES. Operator-feedback: 'bij bracelet active pagina
   breathwork op einde sessies heb jij zelf een stem en popup gegenereerd
   dat is niet goed. moet exact hetzelfde einde popup tekst en stem zijn
   zoals in breath tabblad'. Bracelet mode-key → breath pattern-key
   mapping (Gamma=boost, Beta=focus, etc.). Bij aanpassing aan deze
   strings ook breath.tsx:164 mee-updaten. */
const COMPLETION_MESSAGES: Record<BraceletMode, { line1: string; line2: string }> = {
  [BraceletMode.Gamma]: {
    line1: 'Your edge is sharper now.',
    line2: 'Take it into what comes next.',
  },
  [BraceletMode.Beta]: {
    line1: 'Focus locked in.',
    line2: 'The deep work is yours to claim.',
  },
  [BraceletMode.Alpha]: {
    line1: 'Stillness reclaimed.',
    line2: 'Carry it into the next moment.',
  },
  [BraceletMode.Theta]: {
    line1: 'Something opened up.',
    line2: 'Trust what surfaced. Act on it.',
  },
  [BraceletMode.Delta]: {
    line1: 'Your system softened.',
    line2: 'Recovery has already begun.',
  },
};

/* ── SignalBeam — reisend puntje van de radar-puls naar de zwarte pod ──
   Operator, 16 september 2026 ("een animatie die voorstelt dat er vanuit
   de haptic boven een signaal naar de zwarte pod gaat"): een klein
   lichtpuntje dat herhaaldelijk van de radar-puls-cirkel naar beneden
   reist, richting de pod op de armband-foto eronder, met een kort
   "trail"-streepje erachteraan en fade in/uit aan begin en eind.
   `startY`/`endY` zijn een eerste schatting op basis van de vaste
   afmetingen van de puls/tekst/foto hierboven (geen exacte meting via
   onLayout — dat kan later preciezer als de positie nog moet schuiven,
   zelfde iteratieve aanpak als bij foto-posities elders in de app). */
/* Operator, 16 september 2026 ("moet dat niet duidelijk zijn, net een
   constante loop zonder te stoppen?" / "is dat een try-to-connect
   animatie hoe een professionele bouwer dat zou doen? moet achter de
   tekst lopen en eindigen net tegen de zwarte pod"):
   - Continu: geen puntje met een pauze bovenaan, maar 3 gestaggerde
     puntjes (zelfde overlap-techniek als de radar-puls-ringen hierboven)
     — er is altijd minstens één onderweg.
   - "Professioneel": een vaste, subtiele signaal-lijn (het kanaal) i.p.v.
     losse zwevende puntjes, plus een "target lock"-ring die pulseert
     ter hoogte van de pod — zo leest het duidelijk als "verbinding
     zoeken", niet als decoratie.
   - Achter de tekst: dit component wordt als EERSTE kind gerenderd in
     de omringende View (zie call site) — RN tekent siblings in JSX-
     volgorde, dus alles wat erna komt (puls-animatie, titel, subtekst,
     foto) tekent erbovenop. */
function SignalBeam({
  startY,
  endY,
  offsetX = 0,
}: {
  startY: number;
  endY: number;
  /* Horizontale fijnafstelling in px t.o.v. het midden van de omringende
     container — operator, 16 september 2026: "staat beetje te veel naar
     rechts, komt niet exact op horizontal center van de pod uit". De pod
     zit niet noodzakelijk exact op het midden van de 320px-brede foto,
     dus hier bijstellen i.p.v. in de layout zelf te knoeien. */
  offsetX?: number;
}) {
  /* Operator, 17 september 2026 ("beeld bracelet blijft trillen wanneer
     ik open, alles moet smooth gaan"): dit + SearchingPulse (de 3
     radar-ringen erboven) liepen allebei tegelijk, onafhankelijk van
     elkaar, op dezelfde 600ms-cadans — 3 reizende puntjes + een apart
     pulserend "target lock"-ringetje + 3 radar-ringen = 7 gelijktijdig
     animerende elementen in één klein blok. Dat leest als drukte/getril
     i.p.v. één rustige, leesbare beweging. De target-ring was zuivere
     herhaling (de 3 puntjes communiceren al "onderweg", de radar-ringen
     erboven al "zoeken") — weg. Van 3 naar 2 puntjes voor minder
     gelijktijdige beweging. */
  const t1 = useRef(new Animated.Value(0)).current;
  const t2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const DURATION = 1800;
    const mkLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: DURATION,
            /* "nog niet zo vlot" — pure linear voelt mechanisch. Ease
               in/uit geeft elk puntje een vloeiender, natuurlijker
               tempo terwijl de stagger toch een constante,
               nooit-stoppende stroom blijft. */
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const l1 = mkLoop(t1, 0);
    const l2 = mkLoop(t2, DURATION / 2);
    l1.start();
    l2.start();
    return () => {
      l1.stop();
      l2.stop();
    };
  }, [t1, t2]);

  const travel = endY - startY;
  const dotStyle = (val: Animated.Value) => ({
    opacity: val.interpolate({
      inputRange: [0, 0.1, 0.8, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      {
        translateY: val.interpolate({
          inputRange: [0, 1],
          outputRange: [0, travel],
        }),
      },
    ],
  });

  return (
    <View
      style={[s.signalBeamWrap, { top: startY, height: travel, marginLeft: -12 + offsetX }]}
      pointerEvents="none"
    >
      <Animated.View style={[s.signalBeamDot, dotStyle(t1)]} />
      <Animated.View style={[s.signalBeamDot, dotStyle(t2)]} />
    </View>
  );
}

/* ── BraceletHeroGlow — armband-cutout, groot, geen gekleurd vlak erachter ──
   Operator, 16 september 2026: "zonder achtergrond de bracelet en
   groter" — de gekleurde gloed-cirkel erachter is weg (voelde dubbel
   op met de al-blauwe radar-puls erboven op het zoek-scherm); alleen
   de transparante cutout zelf, nu groter.
   Operator, 17 september 2026 ("op de pod ook een haptic pulse zetten —
   geeft de SignalBeam-animatie een duidelijk eindpunt i.p.v. in het
   niets uit te doven"): PodPulse teruggehaald — bestond al (verwijderd
   uit welcome.tsx bij de 3-pillar-redesign, bewaard voor hergebruik
   elders, zie CLAUDE.md/memory) en stond nog volledig klaar, ongebruikt.
   Bewust ÉÉN traag, rustig element (PULSE_MS default 5200) i.p.v. het
   snellere/dichtere ringetje dat net weggehaald is voor "te druk" —
   dit is een compleet ander, kalm gebouwd component (Skia, "snel weg,
   dan uitrollen"-physics), geen herhaling van dat probleem.
   Kleur: SIGNAL_BLUE (al gebruikt voor de radar-puls/SignalBeam-puntjes
   hierboven) i.p.v. de losse HAPTIC_BLUE uit de oude welcome-versie —
   één signaalkleur voor de hele zoek-animatie op dit scherm.
   originX/Y zijn een eerste schatting (zelfde "geen exacte onLayout-
   meting, itereren op operator-feedback"-aanpak als SignalBeam's
   startY/endY hierboven) — later fijner af te stellen op de exacte
   pod-positie in HERO_BRACELET_IMG. */
function BraceletHeroGlow() {
  return (
    <View style={s.heroGlowWrap}>
      <Image
        source={{ uri: HERO_BRACELET_IMG }}
        style={s.heroGlowImg}
        resizeMode="contain"
      />
      {/* Operator, 17 september 2026 ("veel te groot en zwaar, staat ook
         iets te laag" / "beetje naar links" / "te veel, terug naar
         rechts" / "nog 1mm naar rechts"): reach 0.11→0.06, intensity
         4.2→1.8, originY 0.66→0.58, originX 0.52→0.46 (te ver) →0.49
         →0.505 (kleinste stap, fijnafstelling). */}
      <PodPulse
        width={380}
        height={238}
        originX={0.505}
        originY={0.58}
        reach={0.06}
        ringCount={2}
        blur={0.5}
        intensity={1.8}
        pulseMs={3400}
        color={SIGNAL_BLUE}
      />
    </View>
  );
}

/* ── PreviewPill — vervangt de oranje volle-breedte PreviewBanner ──
   Operator, 16 september 2026: "preview ook banner weg en gewoon in
   pill neutrale kleur" — de opvallende oranje strip-banner (elders in de
   app nog gewoon in gebruik, dat blijft) is hier vervangen door een
   kleine, neutrale pill die dezelfde info draagt zonder de aandacht op
   te eisen die een volle-breedte gekleurde banner wel trekt. */
/* Operator ("kijk alle CTA's na, daar ook niet overal toegepast"): audit
   vond dat beide `primaryBtn`-instanties (Activate/Reconnect) HELEMAAL
   geen tik-feedback hadden — geen scale, geen opacity, geen haptiek.
   Huisstijl §5. Eén herbruikbare wrapper voor beide call-sites. */
function PrimaryCtaButton({
  style,
  onPress,
  disabled,
  accessibilityLabel,
  children,
}: {
  style?: object | Array<object | false | undefined>;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  accessibilityLabel?: string;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 1 - (1 - scale.value) * 5,
  }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 80 });
        hapticPress();
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
      }}
    >
      <ReanimatedAnimated.View style={[style, pressStyle]}>{children}</ReanimatedAnimated.View>
    </Pressable>
  );
}

/* ── SwitchSessionConfirm — bevestiging bij wisselen van modus ──
   VIBEZCORE-stijl (geen systeem-Alert): donker paneel, witte hoofdknop,
   Cancel als tekst. */
function SwitchSessionConfirm({
  visible,
  fromName,
  toName,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  fromName: string;
  toName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={s.switchBackdrop} onPress={onCancel}>
        <Pressable style={s.switchCard} onPress={() => {}}>
          {/* Operator, 10 okt 2026: alle popupkaarten in glas. */}
          <VibezGlass radius={22} level="sheet" style={StyleSheet.absoluteFill} />
          <Text style={s.switchTitle}>Switch to {toName}?</Text>
          <Text style={s.switchBody}>
            Your {fromName} session will end and {toName} starts in its place.
          </Text>
          <PressScale
            style={[s.primaryBtn, s.switchBtn]} haptic scaleTo={0.97}
            onPress={onConfirm}
            accessibilityLabel={`Switch to ${toName}`}
          >
            <Text style={s.primaryBtnText}>Switch</Text>
          </PressScale>
          <Pressable onPress={onCancel} hitSlop={10} style={s.switchCancel} accessibilityLabel="Cancel">
            <Text style={s.switchCancelTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── RunningSessionBar — "nu bezig" op de moduskeuze ──
   Operator, 5 okt 2026: terug/minimaliseren vanuit de actieve sessie gaat
   altijd naar de moduskeuze (met tabbalk), ook als de sessie loopt. Dan
   vervangt deze balk de Start-knop — zelfde plek, zelfde witte vorm (Apple
   Music's "Now Playing"-balk als voorbeeld): modus + live resterende tijd,
   tik = terug naar de sessie. Een tweede sessie starten kan zo niet. */
function RunningSessionBar({ onPress }: { onPress: () => void }) {
  const [snap, setSnap] = useState(getBraceletSessionSnapshot());
  useEffect(() => subscribeBraceletSession(setSnap), []);
  const rem = Math.max(0, Math.floor(snap.remainingSec));
  const time = `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}`;
  return (
    <PrimaryCtaButton
      style={[s.primaryBtn, s.runningBar]}
      onPress={onPress}
      accessibilityLabel={`Return to your ${snap.modeName} session`}
    >
      <View style={[s.runningDot, { backgroundColor: snap.modeColor }]} />
      <Text style={s.primaryBtnText} numberOfLines={1}>
        {snap.modeName} · {snap.paused ? 'Paused' : `${time} left`}
      </Text>
      <ChevronUp size={20} color="#1D1D1F" strokeWidth={2.4} />
    </PrimaryCtaButton>
  );
}

/* Operator, 4 oktober 2026 ("ik wil nergens nog demo zien staan, ook niet
   bij connect"): de DEMO-badge (voorheen PreviewBadge) is volledig weg —
   van alle 4 schermen die 'm ooit toonden (Searching/Fault/Charging/
   Control). Geen vervanging nodig; de schermen tonen zonder badge gewoon
   hun eigen status. */

/* ── DurationWheel — verticale scroll-picker, zelfde bewezen implementatie
   als breath-setup.tsx's DurationWheel/DurationWheelRow (operator: "dat
   moet meer in deze stijl, breathwork") ──────────────────────────────────
   Vervangt hier de losse preset-chip-rij + aparte slider door één
   doorlopend, gecentreerd wiel: gekozen waarde groot/wit in het midden,
   de rest kleiner/gedimd met een subtiele cilinder-kanteling. Bewust
   1-op-1 overgenomen (cilinder-wiskunde, snap-mechaniek, "Recommended"-
   label) i.p.v. opnieuw uitgevonden — dat exacte gedrag is in
   breath-setup.tsx al door meerdere rondes bugs (padding-offset, clipping
   op Android, platgedrukte cijfers) heen gefinetuned; deze twee bestanden
   delen geen component-laag, dus een letterlijke kopie hier voorkomt dat
   Bracelet dezelfde bugs opnieuw moet doorlopen. */
const WHEEL_ITEM_H = 44;
const WHEEL_VISIBLE = 3;

function DurationWheelRow({
  index,
  label,
  on,
  trackColor,
  scrollY,
  viewportHeight,
  dotColor,
}: {
  index: number;
  label: string;
  on: boolean;
  trackColor: string;
  scrollY: SharedValue<number>;
  viewportHeight: number;
  /** Aanbevolen duur: stipje rechts NAAST de pil (operator, 7 okt 2026). */
  dotColor?: string;
}) {
  const rowStyle = useAnimatedStyle(() => {
    const itemOffsetTop = WHEEL_ITEM_H + index * WHEEL_ITEM_H;
    const viewportCenter = scrollY.value + viewportHeight / 2;
    const distanceToCenter = itemOffsetTop + WHEEL_ITEM_H / 2 - viewportCenter;
    const maxDistance = viewportHeight / 2;
    let normalizedDistance = Math.max(-1, Math.min(1, distanceToCenter / maxDistance));
    if (Math.abs(normalizedDistance) < 0.03) normalizedDistance = 0;
    const angleX = normalizedDistance * 38;
    const opacity = Math.max(0.12, 1 - Math.abs(normalizedDistance) * 0.85);
    const fontSize = interpolate(
      Math.abs(normalizedDistance),
      [0, 1],
      [26, 17],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      fontSize,
      transform: [{ perspective: 800 }, { rotateX: `${angleX}deg` }],
    };
  });
  return (
    <View style={[s.wheelRow, { height: WHEEL_ITEM_H }]}>
      <ReanimatedAnimated.Text
        style={[
          s.wheelTxt,
          { color: on ? '#ffffff' : trackColor },
          on && s.wheelTxtOn,
          rowStyle,
        ]}
      >
        {label}
      </ReanimatedAnimated.Text>
      {dotColor ? <View pointerEvents="none" style={[s.wheelRecDot, { backgroundColor: dotColor }]} /> : null}
    </View>
  );
}

function DurationWheel({
  options,
  value,
  onChange,
  accent,
  trackColor,
  visibleRows = WHEEL_VISIBLE,
  recommendedValue,
  recommendedDot,
}: {
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
  accent: string;
  trackColor: string;
  visibleRows?: number;
  recommendedValue?: number;
  /** Waarde die een stipje rechts naast de pil krijgt. */
  recommendedDot?: number;
}) {
  const viewportHeight = WHEEL_ITEM_H * visibleRows;
  const listRef = useRef<ReanimatedAnimated.ScrollView>(null);
  const settledIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const scrollY = useSharedValue(settledIndex * WHEEL_ITEM_H);

  useEffect(() => {
    listRef.current?.scrollTo({ y: settledIndex * WHEEL_ITEM_H, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (offsetY: number) => {
    const idx = Math.min(options.length - 1, Math.max(0, Math.round(offsetY / WHEEL_ITEM_H)));
    listRef.current?.scrollTo({ y: idx * WHEEL_ITEM_H, animated: true });
    const picked = options[idx];
    if (picked && picked.value !== value) {
      hapticTap();
      internalChange.current = true;
      onChange(picked.value);
    }
  };

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <View style={[s.wheelWrap, { height: viewportHeight }]}>
      <View
        style={[
          s.wheelPill,
          { top: (viewportHeight - WHEEL_ITEM_H) / 2, backgroundColor: `${accent}1F` },
        ]}
        pointerEvents="none"
      />
      {recommendedValue !== undefined && value === recommendedValue && (
        <View
          style={[s.wheelRecommendedTag, { top: (viewportHeight - WHEEL_ITEM_H) / 2 }]}
          pointerEvents="none"
        >
          <Text style={s.wheelRecommendedTagTxt} numberOfLines={1}>
            Recommended
          </Text>
        </View>
      )}
      <ReanimatedAnimated.ScrollView
        ref={listRef}
        style={{ height: viewportHeight, alignSelf: 'stretch' }}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => commit(e.nativeEvent.contentOffset.y)}
      >
        {options.map((o, i) => (
          <DurationWheelRow
            key={o.value}
            index={i}
            label={o.label}
            on={o.value === value}
            trackColor={trackColor}
            scrollY={scrollY}
            viewportHeight={viewportHeight}
            dotColor={o.value === recommendedDot ? accent : undefined}
          />
        ))}
      </ReanimatedAnimated.ScrollView>
    </View>
  );
}

/* ── SearchingPulse — radar-style animatie tijdens scanning/connecting ──
   Iter 8b operator-feedback: "anilmatie toevoegen voor geval het aan het
   zoeken is zodat men weet dat het aan het zoeken is". Drie concentrische
   ringen die om de beurt expanderen + fade-out (1.5s elk, staggered 0.5s),
   plus een centrale bracelet-icoon-dot. Geeft het radar-zoek-gevoel:
   pulse, pulse, pulse, naar buiten. Pure SVG + Animated, geen externe lib. */
function SearchingPulse({ color = SIGNAL_BLUE }: { color?: string }) {
  const v1 = useRef(new Animated.Value(0)).current;
  const v2 = useRef(new Animated.Value(0)).current;
  const v3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mkLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
    const l1 = mkLoop(v1, 0);
    const l2 = mkLoop(v2, 600);
    const l3 = mkLoop(v3, 1200);
    l1.start();
    l2.start();
    l3.start();
    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [v1, v2, v3]);

  /* Operator, 16 september 2026 ("zet haptic groter"): 140→190px. */
  const ringStyle = (val: Animated.Value) => ({
    position: 'absolute' as const,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1.5,
    borderColor: color,
    opacity: val.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0, 0.6, 0],
    }),
    transform: [
      {
        scale: val.interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1],
        }),
      },
    ],
  });

  return (
    /* Operator, 16 september 2026: de marginTop:-24 van hiervoor ("zet
       animatie iets hoger") is teruggedraaid — het blok kreeg er sindsdien
       de grotere armband-cutout onder bij, dus de puls hoefde niet meer
       apart omhoog geduwd te worden. marginBottom blijft (ademruimte tot
       de tekst eronder). */
    <View
      style={{
        width: 190,
        height: 190,
        alignItems: 'center',
        justifyContent: 'center',
        /* Operator, 16 september 2026: "0.5 cm lager" (20px), daarna nog
           "1 cm lager" (+38px) — te dicht tegen de PreviewPill boven. */
        marginTop: 58,
        marginBottom: 44,
      }}
      pointerEvents="none"
    >
      <Animated.View style={ringStyle(v1)} />
      <Animated.View style={ringStyle(v2)} />
      <Animated.View style={ringStyle(v3)} />
      {/* Centrale dot in mode-accent kleur. Operator, 16 september 2026
         ("de dot van de haptic is veel te groot"): 24→14px — de ringen
         zelf blijven 190px, enkel de kern verkleint. */}
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/* ── CompletionModal — felicitatie na natural completion ──
   Floating overlay, dim backdrop, mode-color icon. Operator-keuze
   2026-05-27: geeft user een "afgerond"-gevoel na een sessie.
   Eenvoudige tap-anywhere-to-dismiss. Mode-specifiek bericht uit
   COMPLETION_MESSAGES. */
/* ── ModeDetailModal — bottom-sheet popup voor mode-info (iter 9c) ──
   Operator-feedback: tap op mode-card = preview/info, niet directe
   selectie. Geeft de gebruiker een ontdek-moment zonder commitment.
   Apple-style bottom sheet met slide-up animatie.

   Inhoud:
     - Mode-naam + dot + range/protocol
     - "What it does" beschrijving (state-language, no claims)
     - "Use this for" ✓ checklist (MODE_IDEALS)
     - "Breathwork (optional)" protocol-naam
     - "Choose [mode]" CTA = selecteer + sluit
     - Tap buiten / ✕ = sluit zonder selecteren */
function ModeDetailModal({
  mode,
  onClose,
}: {
  mode: BraceletMode;
  onClose: () => void;
}) {
  const meta = getModeMeta(mode);
  const desc = MODE_DESCRIPTIONS[mode];
  const ideals = MODE_IDEALS[mode];
  /* Iter 9m: respecteer bottom safe-area (home-indicator iOS, nav-bar
     Android) zodat de CTA niet onder system-UI valt. */
  const insets = useSafeAreaInsets();

  /* "Feel it" is weg uit dit paneel (operator, 7 okt 2026): de voorproef
     zit nu op de grote knop van het keuzescherm ("Try 30 seconds free"),
     dit paneel is enkel uitleg — zoals bij Breathwork. */
  const handleClose = () => {
    onClose();
  };

  /* Operator, 7 okt 2026 ("de i opent een volledige pagina, ook niet glas"):
     zelfde glazen paneel dat van onderen opschuift als de info bij
     Breathwork — grip, naam met kleurstip, "Done" rechtsboven. */
  return (
    <GlassSheet visible onClose={handleClose}>
      <View style={[s.modeModalSheet, { paddingBottom: Math.max(insets.bottom, 12) + 20 }]}>
        <VibezGlass
          radius={24}
          level="sheet"
          blurTarget={rootBlurRef}
          style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
        />
        <Pressable onPress={handleClose} hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }} accessibilityLabel="Close">
          <View style={s.modeModalHandle} />
        </Pressable>
        <View style={s.modeModalHeader}>
          <View style={[s.modeModalDot, { backgroundColor: meta.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.modeModalName}>{meta.name}</Text>
            <Text style={s.modeModalSub}>
              {meta.minMinutes}–{meta.maxMinutes} min session
            </Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={s.modeModalDone}>Done</Text>
          </Pressable>
        </View>

          {/* Intent — what state this mode is for */}
          <Text style={s.modeModalIntent}>{desc.intent}</Text>

          {/* Operator, 5 okt 2026 ("intent behouden, kleiner kort eronder;
             'How the bracelet helps' klopt niet meer — is geen bracelet"):
             geen sectiekop meer, enkel één korte regel over het ritme. */}
          <Text style={s.modeModalRhythm}>{desc.braceletDoes}</Text>

          {/* Use this for — ideals checklist */}
          <Text style={s.modeModalSectionLbl}>Use this for</Text>
          <View style={s.modeModalIdeals}>
            {ideals.map((item, i) => (
              <View key={i} style={s.modeModalIdealRow}>
                <Text
                  style={[s.modeModalIdealCheck, { color: meta.color }]}
                >
                  ✓
                </Text>
                <Text style={s.modeModalIdealText}>{item}</Text>
              </View>
            ))}
          </View>
      </View>
    </GlassSheet>
  );
}

/* ── TrialSheet — gratis voorproef: uitleg + Start preview / Unlock / Back
   (operator, 7 okt 2026: "de tekst 'Feel it on your phone…' in een popup
   bij aantikken van de CTA, nu staat alles opgepropt"). */
function TrialSheet({
  visible,
  mode,
  onClose,
  onStartPreview,
  onUnlock,
}: {
  visible: boolean;
  mode: BraceletMode;
  onClose: () => void;
  onStartPreview: () => void;
  onUnlock: () => void;
}) {
  const insets = useSafeAreaInsets();
  const meta = getModeMeta(mode);
  const Icon = MODE_ICONS[mode];
  return (
    <GlassSheet visible={visible} onClose={onClose}>
      <View style={[s.modeModalSheet, { paddingBottom: Math.max(insets.bottom, 12) + 20 }]}>
        <VibezGlass
          radius={24}
          level="sheet"
          blurTarget={rootBlurRef}
          style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
        />
        <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }} accessibilityLabel="Close">
          <View style={s.modeModalHandle} />
        </Pressable>
        <View style={s.quickSheetHead}>
          <View style={s.quickSheetIcon}>
            <Icon size={mode === BraceletMode.Theta ? 30 : 24} color={meta.color} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.trialSheetEyebrow}>FREE PREVIEW</Text>
            <Text style={s.modeModalName}>{meta.name}</Text>
          </View>
        </View>
        <Text style={s.quickSheetLine}>30 seconds of this rhythm on your phone and paired watch.</Text>
        <Text style={s.quickSheetNote}>Starts at your resting heart rate, like a real session.</Text>
        <PressScale style={s.quickSheetCta} haptic scaleTo={0.97} onPress={onStartPreview} accessibilityRole="button">
          <Text style={s.quickSheetCtaTxt}>Start preview</Text>
        </PressScale>
        <PressScale onPress={onUnlock} style={s.quickSheetBack} accessibilityRole="button">
          <Text style={s.quickSheetBackTxt}>Unlock all sessions</Text>
        </PressScale>
        {/* Operator, 9 okt 2026 (onderblad-protocol): actieblad → geen
            "Back"; sluiten = naast tikken / grijpstreepje / terugknop. */}
      </View>
    </GlassSheet>
  );
}

/* ── QuickSessionSheet — korte uitleg + Start/Back (operator, 7 okt 2026) ── */
const QUICK_COPY: Record<'chill' | 'boost', { line: string; note: string }> = {
  chill: {
    line: 'Five minutes. Your rhythm starts at your heart rate and settles gently below it.',
    note: 'A short version of Clarity & Relax.',
  },
  boost: {
    line: 'Five minutes. A quick, lively heartbeat rhythm to lift your energy.',
    note: 'Keep it short — a reset, not a long session.',
  },
};

function QuickSessionSheet({
  which,
  onClose,
  onStart,
}: {
  which: 'chill' | 'boost' | null;
  onClose: () => void;
  onStart: (q: (typeof QUICK_SESSIONS)[number]) => void;
}) {
  const insets = useSafeAreaInsets();
  /* Laatste inhoud vasthouden tijdens de uitschuif-animatie. */
  const lastRef = useRef<'chill' | 'boost'>('chill');
  if (which) lastRef.current = which;
  const key = which ?? lastRef.current;
  const q = QUICK_SESSIONS.find((x) => x.key === key)!;
  const meta = getModeMeta(q.mode);
  /* Zelfde teken als de toestand erachter (Chill = Clarity & Relax). */
  const QIcon = MODE_ICONS[q.mode];
  return (
    <GlassSheet visible={which !== null} onClose={onClose}>
      <View style={[s.modeModalSheet, { paddingBottom: Math.max(insets.bottom, 12) + 20 }]}>
        <VibezGlass
          radius={24}
          level="sheet"
          blurTarget={rootBlurRef}
          style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
        />
        <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }} accessibilityLabel="Close">
          <View style={s.modeModalHandle} />
        </Pressable>
        <View style={s.quickSheetHead}>
          <View style={s.quickSheetIcon}>
            <QIcon size={key === 'chill' ? 30 : 24} color={meta.color} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.modeModalName}>{q.label}</Text>
            <Text style={s.modeModalSub}>{QUICK_SESSION_MINUTES} min · starts right away</Text>
          </View>
        </View>
        <Text style={s.quickSheetLine}>{QUICK_COPY[key].line}</Text>
        <Text style={s.quickSheetNote}>{QUICK_COPY[key].note}</Text>
        <PressScale
          style={[s.quickSheetCta]} haptic scaleTo={0.97}
          onPress={() => onStart(q)}
          accessibilityRole="button"
          accessibilityLabel={`Start ${q.label}`}
        >
          <Text style={s.quickSheetCtaTxt}>Start</Text>
        </PressScale>
        {/* Actieblad → geen "Back" (protocol, 9 okt 2026). */}
      </View>
    </GlassSheet>
  );
}

/* ── ModeSwipeRing — modus kiezen door over de cirkel te vegen ─────────
   Operator, 5 okt 2026 ("het idee van één cirkel die je kan
   doorswipen"): zoals wijzerplaten wisselen op een Apple Watch. Links/
   rechts vegen = volgende/vorige modus (de cirkel volgt je vinger, schuift
   weg en de nieuwe schuift binnen); tikken = het info-popup van die modus
   (uitleg + Feel it). Aan de uiteinden rekt hij even mee en veert terug —
   geen rondloop. ENKEL op het keuzescherm: op een lopende sessie zou één
   veeg de sessie stoppen. */
const SWIPE_DISTANCE = 320;

/* Vervolg (operator, 5 okt 2026: "hapert / schokt"): de veeg liep via
   PanResponder op de JS-thread, dezelfde thread waarop de golfanimatie in
   de cirkel zich ~15-60× per seconde hertekent — elke vingerbeweging
   moest daartussen wachten. Nu Gesture Handler + Reanimated: volgen,
   loslaten en terugveren gebeuren volledig op de UI-thread, los van JS.
   Enkel de modus-wissel zelf gaat naar JS. */
function ModeSwipeRing({
  mode,
  onChange,
  onTap,
  dial,
  children,
}: {
  mode: BraceletMode;
  onChange: (next: BraceletMode) => void;
  onTap: () => void;
  /** Operator, 9 okt 2026 ("met je vinger over de rand van de cirkel
      slepen om de tijd te veranderen", zoals de iOS-wekker): een aanraking
      op de rand bedient de duur per minuut; in het midden blijft links/
      rechts vegen de toestand wisselen. */
  dial?: { size: number; min: number; max: number; value: number; onChange: (minutes: number) => void };
  children: ReactNode;
}) {
  const last = MODES.length - 1;
  const index = MODES.findIndex((m) => m.mode === mode);
  const x = useSharedValue(0);
  const indexSV = useSharedValue(index);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  /* Richting van de lopende wissel: de nieuwe modus schuift pas binnen
     NADAT React hem getekend heeft (anders zie je de oude even terugkomen). */
  const pendingDirRef = useRef(0);

  useEffect(() => {
    indexSV.value = index;
    const dir = pendingDirRef.current;
    if (dir !== 0) {
      pendingDirRef.current = 0;
      x.value = dir * SWIPE_DISTANCE;
      x.value = withSpring(0, { damping: 22, stiffness: 190, mass: 0.9 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const commit = (nextIndex: number, dir: number) => {
    pendingDirRef.current = dir;
    onChangeRef.current(MODES[nextIndex].mode);
  };
  const tapJS = () => onTapRef.current();

  const dialOn = !!dial;
  const dialSize = dial?.size ?? 0;
  const dialMinSV = useSharedValue(dial?.min ?? 0);
  const dialMaxSV = useSharedValue(dial?.max ?? 1);
  const dialFracSV = useSharedValue(dial && dial.max > 0 ? dial.value / dial.max : 0);
  const dialValSV = useSharedValue(dial?.value ?? 0);
  useEffect(() => {
    if (!dial) return;
    dialMinSV.value = dial.min;
    dialMaxSV.value = dial.max;
    dialValSV.value = dial.value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dial?.min, dial?.max, dial?.value]);
  const onDialRef = useRef(dial?.onChange);
  onDialRef.current = dial?.onChange;
  const setDialJS = (minutes: number) => {
    /* Operator, 9 okt 2026 ("de tikjes voelen hard/stroef"): de fijne
       schuifregelaar-tik uit utils/haptics, gedempt bij snel slepen. */
    hapticTick();
    onDialRef.current?.(minutes);
  };
  /* Enkel een aanraking op de rand (buitenste ~30%) pakt de greep. */
  const edge = Gesture.Pan()
    .enabled(dialOn)
    .manualActivation(true)
    .onTouchesDown((e, manager) => {
      const t = e.allTouches[0];
      const c = dialSize / 2;
      const d = Math.hypot(t.x - c, t.y - c);
      if (d > c * 0.7 && d < c * 1.25) manager.activate();
      else manager.fail();
    })
    .onStart(() => {
      dialFracSV.value = dialMaxSV.value > 0 ? dialValSV.value / dialMaxSV.value : 0;
    })
    .onUpdate((e) => {
      const c = dialSize / 2;
      /* Hoek vanaf 12 uur, met de klok mee, 0…1. */
      let f = Math.atan2(e.x - c, -(e.y - c)) / (2 * Math.PI);
      if (f < 0) f += 1;
      /* Over 12 uur heen geen sprong van vol naar leeg: vasthouden. */
      let delta = f - dialFracSV.value;
      if (delta > 0.5) delta -= 1;
      if (delta < -0.5) delta += 1;
      const nf = Math.min(1, Math.max(0, dialFracSV.value + delta));
      dialFracSV.value = nf;
      const v = Math.min(dialMaxSV.value, Math.max(dialMinSV.value, Math.round(nf * dialMaxSV.value)));
      if (v !== dialValSV.value) {
        dialValSV.value = v;
        runOnJS(setDialJS)(v);
      }
    });

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      const i = indexSV.value;
      const atEdge = (e.translationX > 0 && i === 0) || (e.translationX < 0 && i === last);
      x.value = atEdge ? e.translationX * 0.25 : e.translationX;
    })
    .onEnd((e) => {
      const i = indexSV.value;
      const dir =
        e.translationX < -40 || e.velocityX < -500 ? 1 : e.translationX > 40 || e.velocityX > 500 ? -1 : 0;
      const next = i + dir;
      if (dir === 0 || next < 0 || next > last) {
        x.value = withSpring(0, { damping: 18, stiffness: 240 });
        return;
      }
      x.value = withTiming(-dir * SWIPE_DISTANCE, { duration: 130 }, (finished) => {
        if (finished) runOnJS(commit)(next, dir);
      });
    });
  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd((_e, success) => {
      if (success) runOnJS(tapJS)();
    });
  const gesture = Gesture.Exclusive(edge, pan, tap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    opacity: interpolate(Math.abs(x.value), [0, SWIPE_DISTANCE], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    /* flex: 0 — standaard rekt de root zich uit (flex: 1) en lag de
       cirkel over de stipjes en de duurkiezer. */
    <GestureHandlerRootView style={{ flex: 0 }}>
      <GestureDetector gesture={gesture}>
        <ReanimatedAnimated.View
          style={style}
          accessibilityRole="adjustable"
          accessibilityLabel={`${getModeMeta(mode).name}. Swipe left or right to change mode, tap for details.`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'activate') onTap();
            else if (e.nativeEvent.actionName === 'increment' && index < last) onChange(MODES[index + 1].mode);
            else if (e.nativeEvent.actionName === 'decrement' && index > 0) onChange(MODES[index - 1].mode);
          }}
        >
          {children}
        </ReanimatedAnimated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

/* ── StateControlCompletion — afsluiting van een State Control-sessie ──
   Operator, 5 okt 2026: "op einde moet er een felicitatie komen — hoe zou
   Apple dit doen" + "die felicitatie (boeddha / Congratulations) is voor
   breathwork". Eigen afsluiting, naar de samenvatting die de Apple Watch na
   een sessie toont: volledig zwart scherm, een ring in de moduskleur die
   zich sluit, een vinkje, modus + "Session complete" + de duur, één witte
   Done-knop (huisstijl: CTA wit, donkere tekst). Geen geluid — het eind-
   signaal zit in de trilling (services/bracelet-haptics.ts). */
/* Groter (operator, 6 okt 2026: "cirkel te klein"): 56 → 84. */
const RING_R = 84;
const RING_STROKE = 4;
const RING_SIZE = (RING_R + RING_STROKE) * 2;
/* Operator, 9 okt 2026 ("cirkel groter"): 230 → 270. */
const RING_DIAL = 270; // past met de duurkeuze + hartslagkaart eronder
const RING_CIRC = 2 * Math.PI * RING_R;
const AnimatedRingCircle = ReanimatedAnimated.createAnimatedComponent(Circle);

function CompletionModal({
  mode,
  minutes,
  onDismiss,
}: {
  mode: BraceletMode;
  minutes: number | null;
  onDismiss: () => void;
}) {
  const meta = getModeMeta(mode);
  const insets = useSafeAreaInsets();
  /* Bracelet als upgrade (operator, 7 okt 2026): je voelde net het ritme
     dat de bracelet ook geeft — één rustige link naar de bracelet-pagina. */
  /* Er zijn nog geen bracelet-eigenaars (operator, 7 okt 2026): iedereen
     ziet de link, ook Premium. */
  const showBraceletLink = useBraceletNudge('state-control', true);
  const fade = useSharedValue(0);
  const ring = useSharedValue(0);
  const check = useSharedValue(0);
  const textIn = useSharedValue(0);
  const pulse = useSharedValue(0);

  /* Operator, 5 okt 2026 ("het einde is statisch, hoe zou Apple dat
     doen?"): de animatie speelde bij het AANMAKEN van dit scherm — kwam
     je via de "Session complete"-melding binnen, dan gebeurde dat nog vóór
     de app zichtbaar was en zag je enkel het eindbeeld. Nu start ze pas
     als de app echt in beeld is (net als Apple's ring die zich sluit
     terwijl je kijkt), met na het vinkje één zachte golf naar buiten. */
  useEffect(() => {
    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      fade.value = withTiming(1, { duration: 300 });
      ring.value = withDelay(
        250,
        withTiming(1, { duration: 1000, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) }),
      );
      check.value = withDelay(1150, withSpring(1, { damping: 12, stiffness: 160 }));
      /* Operator, 6 okt 2026 ("zachte puls" — en daarna: "de ring zelf moet
         pulseren, geen extra pulsring"): na het vinkje ademt de ring zelf
         rustig groter en kleiner tot je op Done tikt. */
      pulse.value = withDelay(
        1200,
        withRepeat(
          withTiming(1, { duration: 1800, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
          -1,
          true,
        ),
      );
      textIn.value = withDelay(1300, withTiming(1, { duration: 500 }));
    };
    if (AppState.currentState === 'active') run();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') run();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.3 * pulse.value,
    transform: [{ scale: 1 + 0.045 * pulse.value }],
  }));

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_CIRC * (1 - ring.value) }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: check.value,
    transform: [{ scale: 0.6 + 0.4 * check.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textIn.value,
    transform: [{ translateY: 8 * (1 - textIn.value) }],
  }));
  const checkColor = isLightColor(meta.color) ? '#ffffff' : meta.color;

  return (
    /* Meteen volledig zwart (operator, 7 okt 2026: "bij eindigen heel even
       het selectiescherm van Sharp Focus"): enkel de inhoud animeert in,
       anders schemert het keuzescherm 300 ms door de fade heen. */
    <ReanimatedAnimated.View style={[s.completionOverlay, s.completionFull]}>
      <ReanimatedAnimated.View style={[{ alignItems: 'center' }, fadeStyle]}>
      <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <ReanimatedAnimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, pulseStyle]}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <AnimatedRingCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={meta.color}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
            animatedProps={ringProps}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        </ReanimatedAnimated.View>
        <ReanimatedAnimated.View style={checkStyle}>
          <Check size={64} color={checkColor} strokeWidth={2.4} />
        </ReanimatedAnimated.View>
      </View>

      <ReanimatedAnimated.View style={[{ alignItems: 'center', marginTop: 32 }, textStyle]}>
        <Text style={[s.completionEyebrow, { color: meta.color }]}>{meta.name}</Text>
        <Text style={s.completionTitleLarge}>Session complete</Text>
        {minutes !== null && minutes > 0 && (
          <Text style={s.completionDuration}>{minutes} min</Text>
        )}
      </ReanimatedAnimated.View>
      </ReanimatedAnimated.View>

      {/* Op dezelfde hoogte en breedte als "Start session" (6 okt 2026: "knop
          zit te laag") — boven de systeembalk, niet erop. */}
      <ReanimatedAnimated.View
        style={[s.completionDoneWrap, { bottom: Math.max(insets.bottom, 12) + 26 }, textStyle]}
      >
        {showBraceletLink ? (
          <PressScale
            style={s.completionBraceletLink}
            scaleTo={0.96}
            onPress={() => {
              onDismiss();
              void openBraceletWebsite();
            }}
            accessibilityRole="link"
            accessibilityLabel="Feel this without your phone. Smart Bead Bracelet"
          >
            <Text style={s.completionBraceletLinkTxt}>
              Feel this without your phone · <Text style={s.completionBraceletLinkStrong}>Smart Bead Bracelet ›</Text>
            </Text>
          </PressScale>
        ) : null}
        <PressScale
          style={[s.completionBtn, s.completionBtnWide]} haptic scaleTo={0.97}
          onPress={onDismiss}
          accessibilityLabel="Done"
        >
          <Text style={[s.completionBtnText, { color: '#0a0a0a' }]}>Done</Text>
        </PressScale>
      </ReanimatedAnimated.View>
    </ReanimatedAnimated.View>
  );
}

/* ── ConnectedPopup — korte bevestiging na een geslaagde connectie ──
   Operator, 16 september 2026: "bij connected wil ik een popupanimatie
   met cirkel, vinkje en tekst Yes connected". Geen actieve dismiss-knop
   nodig — het is een bevestiging, geen beslissing — dus: bounce-in, kort
   zichtbaar, fade-out, zelf-dismissend. Zelfde brand-styling als de
   andere in-app popups (C.panel-kaart, geen kale Alert.alert). */
function ConnectedPopup({ onDismiss }: { onDismiss: () => void }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  /* Operator, 27 september 2026 ("opnieuw zelfde probleem" — na de
     Modal→plain-View-fix hierboven, die het probleem niet was): de
     ECHTE oorzaak zat in deze animatie zelf. `opacity` liep van 0→1 over
     200ms — op frame 1 stond de achtergrond dus zelf nog op 0 (volledig
     doorzichtig), wat het onderliggende scherm (Control) een fractie van
     een seconde ONVERBLOEMD toonde, vóór de fade-in ooit op gang kwam.
     Dat gold evengoed met of zonder Modal — de vorige fix loste dus het
     verkeerde probleem op.
     Fix: de zwarte achtergrond (`backdropOpacity`) NIET meer laten
     fade'n bij het verschijnen — die staat vanaf frame 1 al op volle
     opaciteit (1), dus het scherm erachter is nooit zichtbaar. Enkel de
     content (vinkje + tekst, `contentOpacity`) fade't/bounce't nog in
     bovenop die al-solide achtergrond. Bij het verdwijnen faden beide
     WEL samen uit (250ms) — dat onthult correct het al-gewisselde
     scherm erachter, en dat IS de gewenste, professionele reveal. */
  const backdropOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(1300),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      if (finished) onDismiss();
    });
  }, [scale, contentOpacity, backdropOpacity, onDismiss]);

  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFillObject, s.connectedPopupOverlay, { opacity: backdropOpacity }]}
    >
      {/* Operator, 27 september 2026 ("en niet met kaart erachter"): geen
         `connectedPopupCard`-paneel meer — enkel de gedimde overlay
         erachter, cirkel + tekst los erop.
         Operator, zelfde dag ("yes connected mag niet groter"): de
         64→128/30→60/17→28-vergroting hierboven werd teruggedraaid —
         terug naar de oorspronkelijke maten (64/30/17). */}
      <Animated.View style={{ alignItems: 'center', opacity: contentOpacity, transform: [{ scale }] }}>
        <View style={s.connectedPopupCircle}>
          {/* Operator, 27 september 2026 ("icoon moet 400% groter"):
             enkel het vinkje zelf, 30→150 (cirkel/tekst blijven op hun
             eigen, net teruggedraaide maat — "yes connected mag niet
             groter" ging over de cirkel/tekst, niet het icoon). */}
          {/* Operator, 27 september 2026 ("vinkje mag dunner"): 3→2. */}
          <Check size={75} color="#ffffff" strokeWidth={2} />
        </View>
        <Text style={s.connectedPopupText}>Yes, connected!</Text>
      </Animated.View>
    </Animated.View>
  );
}

/* ── PressableScale — micro-interactie voor knoppen ──
   Operator, 16 september 2026 ("knoppen veranderen vloeiend van vorm
   zodra je vinger het scherm raakt, de app moet 'leven'"): generieke
   wrapper die een zachte schaal- + opacity-dip toepast op press-in/-out
   via Animated.spring (geen instant snap). Native-driver, dus goedkoop
   — veilig te gebruiken op elke knop in dit bestand. Vervangt géén
   bestaande onPress-logica; wrapt 'm gewoon. */
function PressableScale({
  children,
  onPress,
  style,
  disabled,
  accessibilityLabel,
  hitSlop,
  android_ripple,
  scaleTo = 0.96,
}: {
  children: ReactNode;
  onPress?: () => void;
  /* Zowel een statische style als Pressable's eigen ({pressed}) => style
     render-prop-vorm (voor knoppen die daarnaast nog een instant
     pressed-tint willen, zoals Pause/End). */
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  disabled?: boolean;
  accessibilityLabel?: string;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  android_ripple?: { color?: string; borderless?: boolean };
  /** Hoever de knop krimpt bij press-in. Kleinere knoppen → dichter bij 1. */
  scaleTo?: number;
}) {
  /* Iter (2026-09-23, operator: standaardiseer press-scale app-breed):
     gemigreerd van RN's `Animated.spring(speed/bounciness)` naar
     Reanimated's `withTiming`/`withSpring({duration,dampingRatio})` —
     zelfde curve als StartCard (breath-welcome.tsx). Enkel de interne
     animatie-engine verandert; props/API/call sites (~55x in dit
     bestand) blijven exact zoals ze waren. */
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const onPressIn = () => {
    scale.value = withTiming(scaleTo, { duration: 80 });
    opacity.value = withTiming(0.85, { duration: 90 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
    opacity.value = withTiming(1, { duration: 150 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      android_ripple={android_ripple}
      style={style}
    >
      {/* flex:1 + zelfde center-alignment als een standaard knop-body:
         zonder dit zou deze Animated.View shrink-wrappen naar de content
         (bv. enkel de tekst), en zou een absoluteFill-gradient binnenin
         (zoals op de Start-knop) alleen dát kleine vlak vullen i.p.v.
         de volledige knop. */}
      <ReanimatedAnimated.View
        style={[
          {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
          animatedStyle,
        ]}
      >
        {children}
      </ReanimatedAnimated.View>
    </Pressable>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/* ── DrainingCircle — water-fill die "opdroogt" naarmate de sessie
   vordert ── Heropgebouwd (16 september 2026, revert naar pre-Dribbble-
   redesign): zelfde sine-wave-techniek als de latere WaveFillCircle
   (Idle-scherm) — die is er destijds JUIST van afgeleid. Hier drijft
   `progress` (0..1, verstreken fractie van de sessie) het waterniveau
   direct aan (geen extra smoothing-laag, want progress zelf tikt al
   elke seconde rustig door): 0 = volledig vol, 1 = leeg. */
function DrainingCircle({
  progress,
  color,
  size,
}: {
  progress: number;
  color: string;
  size: number;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  /* Operator, 6 okt 2026 ("wave overal hetzelfde, supersmooth, mag niet
     onderbroken worden of blijven hangen"): dezelfde golf als de
     breath-setup (components/LiquidWave) — op de UI-thread, het peil glijdt
     elke seconde vloeiend verder.
     Vervolg, zelfde dag ("weergave glas en andere full color?"): ook
     dezelfde LOOK als de breath-setup-ring — donker binnenvlak, transparante
     golf (10/15%, Sleep licht teal) en een dunne rand in de kleur van de
     toestand, i.p.v. een bijna volle kleurvulling. Het zakkende peil blijft
     zichtbaar door de twee lagen en de rand. */
  const look = breathWaveLook(color);
  return (
    <View style={[s.drainOuter, { width: size, height: size, borderRadius: size / 2 }]}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: '#0a0a0a' }]}
      />
      <LiquidWave size={size} level={1 - clamped} motion="drain" {...look} />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 1}
          stroke={look.color}
          strokeWidth={2}
          fill="none"
        />
      </Svg>
    </View>
  );
}

/* ── RingAmbientGlow — zachte, brede gloed achter de ring ──
   Operator, 16 september 2026 ("laat de ring een heel zachte, brede
   neon-gloed afgeven op de gitzwarte achtergrond — voelt anders aan als
   een platte lege website, oogt premium"): grotere, laag-opacity gevulde
   cirkel met een brede shadow-blur (RN heeft geen radial-gradient, dus
   de "gloed" komt van shadowRadius/Opacity i.p.v. een echte blur-laag),
   positioned achter DrainingCircle.
   Operator, 27 september 2026 ("doe die draaiende buitenlijn weg"):
   SlowAmbientPulse (de losse ronddraaiende boog om de ring) is volledig
   verwijderd — DrainingCircle's eigen outline-stroke (zie die component)
   markeert de rand nu, geen tweede, roterend element meer nodig. */
function RingAmbientGlow({ color, size }: { color: string; size: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: 0.28,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 50,
        elevation: 14,
      }}
    />
  );
}

/* ── ModeColorRing — ring die wit begint en met de klok mee inkleurt ──
   Operator, 16 september 2026 ("de cirkel begint altijd wit en vult dan
   met de klok mee bij aanklikken state, in een vlotte beweging"): een
   witte basis-ring (altijd volledig zichtbaar) met daarboven een
   gekleurde ring die bij elke modus-wissel van 0% naar 100% animeert —
   zelfde -90°-start-boven/klokwaarts-conventie als ActivityRing, maar nu
   met een Animated.Value i.p.v. een vaste progress, zodat de inkleur-
   beweging zichtbaar "veegt" i.p.v. instant om te slaan. */
function ModeColorRing({
  color,
  size,
}: {
  color: string;
  size: number;
}) {
  /* Operator, 16 september 2026 ("buitencirkel moet de helft dunner"):
     14→7. Operator, 27 september 2026 ("ring moet nog dunner, meer in
     breathwork-stijl"): 7→3, in lijn met breath-setup's HERO_STROKE.
     Operator, zelfde dag ("nog dunner de cirkel"): 3→2, exact gelijk aan
     breath-setup's HERO_STROKE. */
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      /* strokeDashoffset is geen transform/opacity → geen native driver. */
      useNativeDriver: false,
    }).start();
  }, [color, reveal]);

  const dashOffset = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: [{ rotate: '-90deg' }],
        }}
        pointerEvents="none"
      >
        {/* Basis-spoor zoals de breath-setup-ring (10% wit, operator 6 okt
           2026: "de kleuren van de cirkels zijn anders") — was volledig wit. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Gekleurde overlay — veegt klokwaarts in bij elke modus-wissel. */}
        {/* Sleep in het lichte teal, zoals de breath-setup-ring. */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={breathWaveLook(color).color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>
    </View>
  );
}

/* ── WaveFillCircle — golf-vulling binnenin de ring ──
   Operator, 16 september 2026 ("animatie is zelfde als bij breathwork
   golven en stijgt mee naargelang meer minuten"): herbouwde versie van
   de eerder verwijderde DrainingCircle — exact dezelfde sine-wave-
   techniek (twee golven over elkaar, verschillende snelheid/amplitude
   voor een natuurlijk water-gevoel), nu als "hoeveel duur is ingesteld"
   i.p.v. "hoeveel sessie-tijd is verstreken". `fraction` 0 = leeg,
   1 = vol (bij max-duur). */
function WaveFillCircle({
  fraction,
  color,
  size,
  fillOnMount,
}: {
  fillOnMount?: boolean;
  /** 0..1 — hoe vol (aandeel van de langste duur). */
  fraction: number;
  color: string;
  size: number;
}) {
  /* Operator, 6 okt 2026 ("wave overal hetzelfde, supersmooth, mag niet
     haperen"): dezelfde golf als de breath-setup (components/LiquidWave,
     UI-thread). Was hier een eigen JS-golf die ±15× per seconde opnieuw
     getekend werd. Kleursterkte blijft 22/35% zoals op 27 sept gekozen. */
  return (
    <LiquidWave
      size={size}
      level={Math.max(0.08, Math.min(1, fraction))}
      {...breathWaveLook(color)}
      fillOnMount={fillOnMount}
    />
  );
}

/* ── DurationRing — ring + golf-vulling voor "Choose duration" ──
   Operator, 16 september 2026: "we gaan het anders aanpakken" — de
   ring zelf is niet langer draaibaar/interactief (dat deed 'ie via
   angle-drag in eerdere versies); de duur wordt nu bediend door een
   losse schuifregelaar ONDER de ring (zie call site: DurationSlider),
   en deze component toont enkel het resultaat: vaste gekleurde ring-
   rand + golf-vulling die met de duur meestijgt + modus-naam/getal in
   het midden. */
function DurationRing({
  min,
  max,
  value,
  color,
  label,
  size = 180,
  dark,
  fillOnMount,
  recommended,
  clockOverride,
  subOverride,
  dialHandle,
}: {
  /** Operator, 9 okt 2026: boog + witte greep op de rand — sleep de greep
      om de tijd per minuut te kiezen (zie ModeSwipeRing `dial`). */
  dialHandle?: boolean;
  /** Voorproef (7 okt 2026): de teller i.p.v. de gekozen duur. */
  clockOverride?: string;
  /** Voorproef: "Preview" i.p.v. "Recommended". */
  subOverride?: string;
  /** Leeg binnenkomen en pas na aankomst vullen (modus-wissel). */
  fillOnMount?: boolean;
  /** De gekozen duur is de aanbevolen duur → "● Recommended" onder de tijd. */
  recommended?: boolean;
  min: number;
  max: number;
  value: number;
  color: string;
  /* Operator, 16 september 2026 ("tijd verschijnt groot in de cirkel
     samen met de naam van de state"): modus-naam als klein label boven
     het getal — zelfde opbouw als de active-session ActivityRing. */
  label: string;
  size?: number;
  /* Operator, 16 september 2026 ("hybride Dark voor dit ene scherm —
     donkergrijze basislijn, wit dikgedrukt getal, zachte neon-gloed
     achter de paarse lijn"): schakelt de dark-specifieke kleuren + de
     ambient RingGlow in, onafhankelijk van de module-brede `light`. */
  dark?: boolean;
}) {
  /* Operator, 27 september 2026 ("als 30 min max is en 15 min minimum,
     moet de cirkel dan niet al halfvol staan?"): was (value-min)/(max-min)
     — dat toont hoever je binnen de EIGEN regelrange zit, dus staat de
     cirkel bij elke modus z'n minimum altijd (bijna) leeg, ook al is dat
     minimum zelf al de helft van het max. De vulling hoort "hoeveel duur
     is ingesteld" te tonen als absoluut aandeel van het max — dus
     value/max, niet (value-min)/(max-min). */
  const fillFraction = max > 0 ? value / max : 0;
  /* Operator, 16 september 2026 ("binnenkant cirkel zwart ipv wit... tekst
     in de cirkel wit", daarna "Calm Control etc ook wit"): alle tekst in
     de ring — label, getal, unit — is standaard wit, geen mode-kleur meer
     op het label. Contrast-fix ("binnenkant van cirkel als dat gevuld is
     is tekst daarin niet goed zichtbaar"): de golf-vulling zelf draagt
     de mode-kleur (niet de zwarte achtergrond erachter) — bij een lichte
     mode-kleur (Clarity, wit) verdween witte tekst waar de golf 'm
     overlapt. isLightColor-patroon zoals overal elders in dit bestand. */
  /* Operator, 27 september 2026 ("tekst in cirkel bij Clarity & Relax met
     zwarte achtergrond niet goed leesbaar"): de golf-vulling is intussen
     transparant (zie WaveFillCircle, 22/35% i.p.v. 60/92%) — de binnenkant
     blijft dus bij ELKE modus-kleur overwegend zwart, ook bij een lichte
     kleur zoals Clarity's wit. De oude colorIsLight-omschakeling naar
     donkere `fg`-tekst ging uit van een bijna-opake witte golf-vulling die
     niet meer bestaat, en gaf zo onzichtbare donkere tekst op zwart.
     Label/unit/getal zijn daarom nu allemaal gewoon altijd wit, met de
     standaard donkere halo (leest prima tegen zowel de zwarte achtergrond
     als de dunne, transparante gekleurde golf erboven). */
  const fg = '#ffffff';
  const numColor = '#ffffff';
  const textShadow = s.durationRingTextShadow;
  /* Operator, 16 september 2026 ("buitencirkel moet de helft dunner"):
     matcht ModeColorRing's stroke (14→7) zodat de golf-vulling weer
     precies binnen de ring-rand past.
     Operator, 27 september 2026 ("nog dunner de cirkel"): ModeColorRing's
     stroke ging 7→2 — hier meegetrokken zodat deze berekening (enkel voor
     innerSize, tekent zelf geen lijn) niet stil uit sync raakt. */
  const stroke = 2;
  const innerSize = size - stroke * 2 - 4;

  /* Operator, 29 september 2026 ("de cirkel buitenlijn ook een zelfde
     animatie geven zoals in breathwork? de 2 witte travelling lines?",
     bevestigd als breath-setup.tsx's heroShineStrip op de "choose your
     duration"-pagina): zelfde flits-sweep, 1-op-1 overgenomen — enige
     verschil is dat HERO_SIZE/HERO_STROKE daar module-constanten zijn,
     hier de `size`/`stroke`-props van deze herbruikbare component. */
  const shimmer = useSharedValue(-1);
  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(7000, withTiming(1, { duration: 950, easing: ReanimatedEasing.inOut(ReanimatedEasing.quad) })),
        withDelay(600, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(shimmer);
  }, []);
  const shineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [-1, -0.85, 0.55, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: shimmer.value * size * 0.75 }, { rotate: '45deg' }],
  }));
  const shineMaskStyle = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden' as const,
  };
  const shineStripStyle = {
    position: 'absolute' as const,
    top: -size,
    bottom: -size,
    width: 70,
  };
  const shinePunchStyle = {
    position: 'absolute' as const,
    top: stroke,
    left: stroke,
    width: size - stroke * 2,
    height: size - stroke * 2,
    borderRadius: (size - stroke * 2) / 2,
    backgroundColor: dark ? '#000000' : 'rgba(10,10,12,0.85)',
  };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Operator, 16 september 2026 ("verwijder gloed rond de cirkel"):
         RingGlow hier weg — blijft wel nog aanwezig op de active-session-
         ring (ander scherm, andere, niet-betwiste feature). */}
      {/* Operator, 16 september 2026 ("de cirkel begint altijd wit en
         vult dan met de klok mee bij aanklikken state, in een vlotte
         beweging"): ModeColorRing i.p.v. een statische ActivityRing —
         witte basis, gekleurde ring veegt klokwaarts in bij elke modus-
         wissel (key={color} forceert een remount + nieuwe reveal-
         animatie per kleur-wissel). */}
      <ModeColorRing key={color} color={color} size={size} />
      {/* Shine-sweep over de buitenring — zie de operator-comment hierboven
         bij `shimmer`. MOET vóór de golf-vulling komen: anders tekent de
         effen punch-cirkel bovenop de golven en verdwijnen die. */}
      <View style={shineMaskStyle} pointerEvents="none">
        <ReanimatedAnimated.View style={[shineStripStyle, shineStyle]}>
          <LinearGradient
            colors={['#ffffff00', dark ? '#EAF2FF99' : '#E5F0FFCC', '#ffffff00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </ReanimatedAnimated.View>
        <View style={shinePunchStyle} />
      </View>
      {/* Golf-vulling — los van de ring-rand, binnenin, altijd rond
         geclipt. Operator, 16 september 2026 ("binnenkant cirkel zwart
         ipv wit"): teruggedraaid naar een donkere/zwarte achtergrond
         (i.p.v. de lichte tussenversie) achter de golven. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          overflow: 'hidden',
          backgroundColor: dark ? '#000000' : 'rgba(10,10,12,0.85)',
        }}
      >
        <WaveFillCircle fraction={fillFraction} color={color} size={innerSize} fillOnMount={fillOnMount} />
      </View>
      {/* Operator, 6 okt 2026 ("kijk of de look zelfde is als bij
         breathwork"): dezelfde opbouw en maten als de breath-setup-ring —
         tijd 54 bold, naam 14 gedimd, "● Recommended" 12. Hier: de naam
         met de i erbij BOVEN de tijd (tik op de ring opent de uitleg), en
         Recommended ONDER de tijd. De rij blijft staan als hij leeg is,
         zodat de tijd niet verspringt. */}
      <View pointerEvents="none" style={s.durationRingCenter}>
        {/* Tijdens de voorproef enkel de teller — rust (operator, 7 okt
            2026: "de gebruiker weet al dat het een preview is en welke
            sessie"). Rijen blijven staan (opacity), zodat niets verspringt. */}
        <View style={[s.ringNameRow, clockOverride ? { opacity: 0 } : null]}>
          <Text style={[s.ringName, textShadow]} numberOfLines={1}>
            {label}
          </Text>
          <Info size={13} color="rgba(255,255,255,0.6)" strokeWidth={2.2} />
        </View>
        <Text style={[s.ringClock, { color: numColor }, textShadow]}>
          {clockOverride ?? `${value}:00`}
        </Text>
        <View style={[s.ringRecRow, { opacity: !clockOverride && (subOverride || recommended) ? 1 : 0 }]}>
          <View style={[s.ringRecDot, { backgroundColor: color }]} />
          <Text style={s.ringRecTxt}>{subOverride ?? 'Recommended'}</Text>
        </View>
      </View>
      {/* Boog + greep BOVENOP alles (de zwarte binnenkant en de golf
         bedekten de greep anders half). */}
      {dialHandle && !clockOverride ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: -16, top: -16 }}>
          {/* 16 pt marge rondom: de greep steekt buiten de ring en mag op
              Android niet afgeknipt worden. */}
          <Svg width={size + 32} height={size + 32}>
            {(() => {
              const r = size / 2 - 1;
              const c = size / 2 + 16;
              const f = Math.min(0.9999, Math.max(0, fillFraction));
              const ang = f * 2 * Math.PI;
              const ex = c + r * Math.sin(ang);
              const ey = c - r * Math.cos(ang);
              const large = f > 0.5 ? 1 : 0;
              return (
                <>
                  {/* Vervolg ("de lijn en de stip moeten op hetzelfde punt
                      eindigen"): de volle dunne ring eronder verbergen en als
                      gedimd spoor tekenen — enkel de boog tot de greep is fel. */}
                  <Circle cx={c} cy={c} r={r + 1} stroke="#000000" strokeWidth={4} fill="none" />
                  <Circle cx={c} cy={c} r={r} stroke={color} strokeOpacity={0.22} strokeWidth={1.5} fill="none" />
                  {/* Boog = gekozen duur, van 12 uur met de klok mee. */}
                  <Path
                    d={`M ${c} ${c - r} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`}
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    fill="none"
                  />
                  {/* Greep: wit bolletje met een rand in de toestandskleur. */}
                  <Circle cx={ex} cy={ey} r={7} fill="#ffffff" stroke={color} strokeWidth={1.5} />
                </>
              );
            })()}
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

/* ── BreathingHint — synced ademhalings-tekst ──
   Toggle elke 3s tussen "Breathe in" en "Breathe out" — matched de
   PulsingCircle's 3s heen + 3s terug cyclus. CLAUDE.md §6 bottom-up
   regulation: lichaam volgt ademhaling, brein volgt lichaam.
   Subtle fade via Animated.Value zodat tekst niet "ploft". */
function BreathingHint({
  inMs = 3000,
  outMs = 3000,
}: {
  inMs?: number;
  outMs?: number;
}) {
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /* Initial fade-in */
    Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    /* Asymmetrische in/out timing wanneer modes anders inMs/outMs
       hebben. Werkt nu met gelijke timings (inMs == outMs) maar
       voorbereid op verschillende fases (bv. 4-7-8 ademing later). */
    let active = true;
    const tick = (nextPhase: 'in' | 'out') => {
      if (!active) return;
      setPhase(nextPhase);
      const duration = nextPhase === 'in' ? inMs : outMs;
      setTimeout(() => tick(nextPhase === 'in' ? 'out' : 'in'), duration);
    };
    /* Eerste tick na inMs: kondigt de eerste "Breathe out…" aan
       (huidige phase = 'in' is al gezet). */
    const handle = setTimeout(() => tick('out'), inMs);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [opacity, inMs, outMs]);

  return (
    <Animated.Text style={[s.breatheHint, { opacity }]}>
      {/* Iter v170 (2026-06-28): terug naar 'through your nose' — deze
          BreathingHint is een algemene fallback zonder protocol-context,
          dus matcht de oorspronkelijke (lange) audio cues. Boost-specifieke
          kort vorm wordt elders gehandeld (zie promptText met isBoost). */}
      {phase === 'in' ? 'Inhale through your nose' : 'Exhale through your nose'}
    </Animated.Text>
  );
}

/* ── PulsingCircle — visuele puls voor active session ──
   Zelfde principe als de sonar-rings op de etalage: continue scale +
   opacity loop met useNativeDriver, geen JS-thread belasting tijdens
   andere animaties of scroll. */
function PulsingCircle({
  color,
  size = 220,
  inMs = 3000,
  outMs = 3000,
}: {
  color: string;
  size?: number;
  /** Inhale-fase duur in ms. Default 3000 (~10 BPM). */
  inMs?: number;
  /** Exhale-fase duur in ms. Default 3000. */
  outMs?: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    /* Adem-ritme — varieert per mode via MODE_BREATH (operator-keuze
       2026-05-27 iter 3). Energiek (3s/3s) voor Boost, traag (7s/7s)
       voor Sleep. Cyclus = inMs + outMs. */
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: inMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: outMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, inMs, outMs]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.65],
  });

  return (
    <View style={[s.pulseWrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          s.pulseCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          s.pulseCircleInner,
          {
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: (size * 0.7) / 2,
            backgroundColor: color,
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.08, 0.15],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

/* Iter 9bq → 9bu (2026-05-31): preview-header helper voor non-owners.
   Pattern C (Calm/Headspace-stijl): alleen ← pijl links + gecentreerde
   titel. Vermijdt de "← Bracelet"-verwarring.
   - title = wat in het midden gerenderd wordt
   - onBack = optionele custom back-action. Default: router.back() (popt
     de stack). Voor het ACTIVE screen passen we een onStop-callback mee
     zodat de back-pijl de sessie eindigt en op de Bracelet control
     preview blijft (bracelet-control rendert dan automatisch idle ipv
     pop-naar-/bracelet). */
function previewHeaderOptions(title: string, onBack?: () => void) {
  return {
    title,
    headerShown: true,
    headerTitleAlign: 'center' as const,
    headerBackVisible: false,
    headerLeft: () => (
      <Pressable
        onPress={() => {
          if (onBack) {
            onBack();
            return;
          }
          if (router.canGoBack()) router.back();
          else router.replace('/bracelet');
        }}
        hitSlop={12}
        accessibilityLabel="Back"
        style={{ paddingHorizontal: 8, paddingVertical: 6 }}
      >
        <Text
          style={{
            color: C.text,
            fontSize: 24,
            fontFamily: BrandFonts.regular,
            lineHeight: 26,
          }}
        >
          ←
        </Text>
      </Pressable>
    ),
  };
}

/* Iter 9dq v109 (2026-06-04): unified in-screen header voor ALLE accounts.
   Operator-mandate: bracelet control, active en connect moet voor Audio
   PRO, Bracelet PRO en Full PRO identiek ogen.
   - Audio PRO accessed via Stack push (router.push('/bracelet-control')).
   - Owners (Bracelet/Full PRO) accessed inline (rendered binnen (tabs)/
     bracelet.tsx) — geen Stack-header.
   Voor beide flows zetten we Stack.Screen options op headerShown:false
   en renderen we deze in-page header zodat 't visueel hetzelfde is.
   Back-arrow logica per state komt uit de aanroepende branch. */
function BraceletHeader({
  title,
  onBack,
  showBack = true,
  backLabel,
  right,
  dark,
  badge,
}: {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  /* Iter 2026-06-05: optionele label naast back-arrow. Wanneer gezet:
     "← Audio Library" of "← Bracelet". Default: alleen "←". Op die manier
     wordt het bestaande gedrag voor non-CTA screens niet aangeraakt. */
  backLabel?: string;
  /* Operator, 16 september 2026 ("Disconnect verplaats je naar de
     instellingen, het tandwiel-icoon rechtsboven"): optionele rechter-
     slot-content, i.p.v. altijd een lege spacer. */
  right?: ReactNode;
  /* Operator, 16 september 2026 ("hybride: app blijft Light, dit
     bedieningsscherm wordt Dark"): dit ene scherm's header moet zwart
     met witte tekst zijn terwijl de rest van de app licht blijft — de
     module-brede `light`-constante omzetten zou alle andere schermen in
     dit bestand meeslepen. Losse override hier i.p.v. dat. */
  dark?: boolean;
  /* Operator ("preview mag achter bracelet staan"): optioneel, klein
     label direct ná de titel-tekst i.p.v. een los gecentreerd blok
     eronder (zie PreviewPill/SearchingScreen) — bespaart een hele rij
     en leest als één samenhangende titel "Bracelet PREVIEW". */
  badge?: ReactNode;
}) {
  return (
    <View style={[s.customHeader, dark && { backgroundColor: '#000000' }]}>
      {showBack && onBack ? (
        <Pressable
          onPress={onBack}
          style={[s.headerSide, backLabel ? s.headerSideWithLabel : null]}
          hitSlop={12}
          accessibilityLabel={backLabel ? `Back to ${backLabel}` : 'Back'}
        >
          {/* Operator ("een chevron pijl geen gewone pijl"): plain "←"
             tekst-glyph vervangen door dezelfde ChevronLeft-icoon-stijl
             als elders in de app (bv. het pillar-detailscherm). Operator,
             1 okt 2026 ("headers overal consistent"): maat 24→20, stroke
             2.4→2.8 — de "officiële iOS-chevron.backward"-stijl uit
             build-choice.tsx (18 sept), nu de app-brede standaard. */}
          <ChevronLeft size={20} color={dark ? '#ffffff' : C.text} strokeWidth={2.8} />
          {backLabel ? (
            <Text
              style={[s.headerBackLabel, dark && { color: '#ffffff' }]}
              numberOfLines={1}
            >
              {backLabel}
            </Text>
          ) : null}
        </Pressable>
      ) : (
        <View style={s.headerSide} />
      )}
      <View style={s.headerTitleRow}>
        <Text
          style={[s.headerTitle, { flex: undefined, marginLeft: 0 }, dark && { color: '#ffffff' }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {badge}
      </View>
      {right ?? <View style={s.headerSide} />}
    </View>
  );
}

/* Iter v194 (2026-07-04): InlineBraceletTabBar volledig verwijderd.
   Bracelet-control wordt inline gerenderd binnen de (tabs) navigator
   via bracelet-tab owner-view — de systeem tab bar (uit (tabs)/_layout)
   was daar dus AL zichtbaar. Mijn v193-toevoeging veroorzaakte een
   dubbele tab bar op operator-scherm en verdrong de Start-knop uit
   beeld. Verwijderd om aan het echte gedrag terug te komen. */

/* ── Extracted render-branch components (mechanical refactor, no behavior
   change) ──────────────────────────────────────────────────────────────
   BraceletControl renders 5 mutually-exclusive "screens" via a sequence
   of early-return if-blocks. Pulling each branch's JSX into its own named
   component keeps BraceletControl's ~1900-line body from being one giant
   function while leaving every prop-value, style, and comment exactly as
   it was. All state/refs/handlers stay declared in BraceletControl and
   are threaded down as props; module-scope constants (Brand, s, MODES,
   getModeMeta, etc.) are referenced directly, same as every other helper
   component already in this file (DurationFillCircle, BreathworkStrip, …). */

/* Operator, 1 okt 2026 ("vanuit bracelet plan tik ik → eerst bracelet
   connect pagina, dat moet niet"): lichte, merk-eigen loader voor de
   ~1.5s auto-connect-wachttijd tijdens een auto-start (breathwork-CTA
   / "Start session" vanuit Your bracelet plan) — i.p.v. het volledige
   zoek-scherm met Retry-knop/activatie-prompt kort te laten opflitsen. */
function AutoStartLoader({ text = 'Starting your session…' }: { text?: string }) {
  return (
    <View style={[s.root, s.autoStartLoader]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator color="#ffffff" />
      <Text style={s.autoStartLoaderTxt}>{text}</Text>
    </View>
  );
}

type SearchingScreenProps = {
  conn: BleConnectionState;
  isBraceletOwner: boolean;
  showActivationPrompt: boolean;
  busy: boolean;
  fromContext: 'audio' | 'bracelet' | 'plan' | null;
  ctaBackLabel: string | undefined;
  navigateBackToSource: () => void;
  onConnect: () => Promise<void>;
};

/* SCREEN 3: Not connected */
function SearchingScreen({
  conn,
  isBraceletOwner,
  showActivationPrompt,
  busy,
  fromContext,
  ctaBackLabel,
  navigateBackToSource,
  onConnect,
}: SearchingScreenProps) {
  /* Operator, 16 september 2026 ("bracelet connect pagina moet ook dark
     mode"): zelfde hybride-dark-patroon als Idle/Active — dit ene scherm
     zwart, de rest van de app blijft licht. */
  const searchingDark = true;
  /* Operator ("ook back knop toevoegen... niet zomaar, zoals op de
     andere pagina's, zoals apple het zou doen"): Iter v227 verstopte de
     back-knop volledig zodra `fromContext` ontbrak, om de inline-owner-
     render-bug hierboven te vermijden — maar dat verstopte 'm OOK op de
     "Preview the Bracelet App"/"Open your bracelet control screen"-CTA's
     vanuit de Bracelet-tab, die WEL een echte stack-push zijn (gewoon
     zonder query-param). `fromContext` (query-param-afhankelijk) en
     `canGoBack()` (bijna altijd true, ook inline) kunnen dat onderscheid
     geen van beide betrouwbaar maken — het huidige PAD wel: dit scherm
     heeft alleen zichzelf als URL wanneer het écht gepusht is; in de
     inline-owner-render blijft het pad gewoon "/bracelet". Consistent
     met hoe de andere 3 schermen (Fault/Charging/Control) hun terug-pijl
     altijd tonen. */
  const isPushedRoute = usePathname() === '/bracelet-control';
  return (
    <SafeAreaView
      style={[s.root, searchingDark && { backgroundColor: '#000000' }]}
      edges={['top', 'bottom']}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <BraceletHeader
        title="Connect Device"
        showBack={isPushedRoute}
        onBack={fromContext ? navigateBackToSource : () => router.back()}
        backLabel={ctaBackLabel}
        dark={searchingDark}
      />
      {/* Iter 9dq v93 (2026-06-03): top-banner CTA NIET tonen op
          disconnected-screen wanneer al activation-required is —
          de hele screen wordt dan al de activate-flow (titel +
          sub + primary CTA onderaan). Anders 3× "activate your
          bracelet" op één scherm. Wel zichtbaar op connected/
          idle als constant reminder tijdens preview. */}
      <View style={s.searchingWrap}>
        {/* Iter 8b: statische 3-dot replaced door radar-pulse animatie.
            Visualiseert actief zoeken — 3 ringen die expanderen en
            fade-out, staggered, met centrale dot.
            Iter 9dq v93 (2026-06-03): bij niet-geactiveerde owners
            vervangen we "Searching" door een eerlijker "Not linked yet"
            messaging — er VALT niets te zoeken want er is geen bracelet
            aan dit account gekoppeld. */}
        {showActivationPrompt ? (
          <>
            <Text style={[s.searchingTitle, searchingDark && { color: '#ffffff' }]}>
              Bracelet not linked
            </Text>
            <Text
              style={[
                s.searchingSub,
                searchingDark && { color: 'rgba(255,255,255,0.5)' },
              ]}
            >
              Activate your bracelet with your 12-character code to
              connect it to this account.
            </Text>
          </>
        ) : (
          <View style={{ alignItems: 'center' }}>
            {/* Operator ("moet premium apple stijl, doe maar hoe jij denkt
               dat beste is" — n.a.v. Apple-HIG-feedback op dit scherm):
               de abstracte radar-cirkel (SearchingPulse) en de reizende
               chevrons ertussen (SignalBeam) waren een apart, los "zoek-
               signaal" dat naar de armband-foto "reisde" — precies het
               soort losse pijl-motion dat de feedback als onrustig
               omschrijft. BraceletHeroGlow hieronder pulseert al ECHT op
               de pod van de armband zelf (PodPulse) — dat IS de radar-op-
               de-hardware die de feedback vraagt, dus de aparte cirkel +
               brug ertussen was pure duplicatie. Beide weg; de armband-
               foto (nu groter, zie heroGlowImg) is het enige, centrale
               pulserende element. */}
            {/* Operator, 16 september 2026 ("popup yes connected moet
               enige melding van connect zijn, ik zie eronder ook iets
               staan van connected"): zodra conn 'connected' is, is de
               ConnectedPopup de ENIGE bevestiging — geen "Connected" /
               "Your bracelet is ready." tekst er nog los naast/onder,
               dat las als een dubbele melding. */}
            {conn !== 'connected' && (
              <>
                <Text style={[s.searchingTitle, searchingDark && { color: '#ffffff' }]}>
                  {conn === 'scanning' ? 'Searching' : conn === 'connecting' ? 'Connecting' : 'Looking for your bracelet'}
                </Text>
                <Text
                  style={[
                    s.searchingSub,
                    searchingDark && { color: 'rgba(255,255,255,0.5)' },
                  ]}
                >
                  Make sure your bracelet is nearby and powered on.
                </Text>
              </>
            )}
            {/* Operator, 16 september 2026 ("die bracelet had ik eigenlijk
               voor deze pagina doorgegeven — onder Looking for.. en weg
               uit select"): de armband-hero-gloed hoort hier, niet op het
               mode-selectiescherm. Geen mode geselecteerd tijdens het
               zoeken, dus Signal Blue i.p.v. een mode-kleur — zelfde
               kleur als de radar-puls erboven. */}
            <BraceletHeroGlow />
          </View>
        )}
      </View>
      {/* conn 'connected' + popup nog zichtbaar: geen Connect/Retry-knop
         meer nodig (en geen activate-CTA, want geactiveerd is 'ie al
         zodra hij connect) — dit scherm wacht alleen nog even tot de
         popup verdwijnt. */}
      {conn !== 'connected' && (
        <View style={[s.bottomBar, searchingDark && { backgroundColor: '#000000' }]}>
          {/* Iter 9dq v93 (2026-06-03): wanneer de bracelet nog NIET
              geactiveerd is, vervangen we de Connect/Retry-knop door
              een primaire "Activate your bracelet"-CTA. Connect heeft
              geen zin zolang er geen bracelet aan dit account hangt.
              Operator-rationale: "connect knop zou misschien niet actief
              moeten zijn in pro zolang bracelet niet geactiveerd is". */}
          {showActivationPrompt ? (
            <PrimaryCtaButton
              style={s.primaryBtn}
              onPress={() => router.navigate('/activate-bracelet' as never)}
              accessibilityLabel="Activate your bracelet with a code"
            >
              <Text style={s.primaryBtnText}>Activate your bracelet</Text>
            </PrimaryCtaButton>
          ) : (
            /* Operator ("premium apple stijl, doe wat jij denkt dat beste
               is"): dit is de enige actie op dit scherm, dus de primaire
               witte CTA-stijl (§3) i.p.v. de outline-secundaire stijl —
               en had t.o.v. de andere knoppen hier nog geen tik-
               feedback/haptiek.
               Operator ("wat kan er beter — Retry-knop tijdens actief
               zoeken is verwarrend"): `busy` dekte alleen de HANDMATIGE
               connect-tap (onConnect hierboven) — de losse auto-connect
               voor de Free-Breathwork-deeplink (regel ~4170,
               `bracelet.connect()` zonder setBusy) liet dus een actieve,
               inschakelbare "Retry"-knop zien terwijl er allang een
               verbinding bezig was. `isWorking` dekt nu BEIDE paden via
               `conn` zelf — geen actie tonen zolang het systeem al bezig
               is, exact Apple's patroon. */
            (() => {
              const isWorking = busy || conn === 'scanning' || conn === 'connecting';
              return (
                <PrimaryCtaButton
                  style={[s.primaryBtn, isWorking && s.btnDisabled]}
                  onPress={onConnect}
                  disabled={isWorking}
                  accessibilityLabel="Retry searching for bracelet"
                >
                  {isWorking ? (
                    <ActivityIndicator color="#1D1D1F" />
                  ) : (
                    <Text style={s.primaryBtnText}>
                      {conn === 'disconnected' ? 'Connect' : 'Retry'}
                    </Text>
                  )}
                </PrimaryCtaButton>
              );
            })()
          )}
        </View>
      )}
      {/* Iter v194 (2026-07-04): InlineBraceletTabBar toevoeging weer
          teruggedraaid. Bracelet-control render is intern in de
          (tabs) navigator (via BraceletControl-inline in bracelet-tab
          owner-view) → systeem tab bar was al zichtbaar → mijn stub
          gaf DUBBELE tab bar. Systeem tab bar is genoeg. */}
      {/* Operator, 27 september 2026 ("na yes connected zie ik eerst nog
         bracelet, moet direct naar bracelet control"): ConnectedPopup
         rendert niet meer hier, gegate achter dit scherm blijven staan —
         zie BraceletControl's return onderaan dit bestand, waar de popup
         nu als losstaande overlay BOVENOP het al-gewisselde scherm
         (Control/Fault/Charging/Active) rendert i.p.v. het wisselen zelf
         tegen te houden. Zo onthult de fade-out van de popup meteen het
         juiste scherm, niet nog even "Bracelet". */}
    </SafeAreaView>
  );
}

type FaultScreenProps = {
  isBraceletOwner: boolean;
  showActivationPrompt: boolean;
  busy: boolean;
  bracelet: BraceletTransport;
  sim: SimulatedBracelet | null;
  onDisconnect: () => Promise<void>;
  onConnect: () => Promise<void>;
  setStatus: Dispatch<SetStateAction<BleStatusPacket | null>>;
};

/* SCREEN 6: Fault state (firmware reported error) */
function FaultScreen({
  isBraceletOwner,
  showActivationPrompt,
  busy,
  bracelet,
  sim,
  onDisconnect,
  onConnect,
  setStatus,
}: FaultScreenProps) {
  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <BraceletHeader
        title="Bracelet error"
        onBack={onDisconnect}
      />
      {showActivationPrompt && <BraceletActivationCta />}
      <View style={s.faultWrap}>
        <View style={s.faultIcon}>
          <Text style={s.faultIconText}>!</Text>
        </View>
        <Text style={s.faultTitle}>Something went wrong</Text>
        <Text style={s.faultSub}>
          Your bracelet reported an error. Disconnect and reconnect, or
          contact support if it continues.
        </Text>
      </View>
      <View style={s.bottomBar}>
        <PrimaryCtaButton
          style={[s.primaryBtn, busy && s.btnDisabled]}
          onPress={async () => {
            await onDisconnect();
            await onConnect();
            /* Sim-mode: clear fault zodat user uit deze screen kan
               navigeren. Op echte hardware blijft fault staan tot
               Start-command (spec §9 rule 4) — daar is sim==null
               dus deze line is een no-op. */
            sim?.simClearFault();
            const st = await bracelet.requestStatus();
            setStatus(st);
          }}
          disabled={busy}
          accessibilityLabel="Reconnect bracelet"
        >
          <Text style={s.primaryBtnText}>Reconnect</Text>
        </PrimaryCtaButton>
      </View>
    </SafeAreaView>
  );
}

type ChargingScreenProps = {
  isBraceletOwner: boolean;
  showActivationPrompt: boolean;
  onDisconnect: () => Promise<void>;
  battery: number | null;
  batteryColor: string;
  sim: SimulatedBracelet | null;
};

/* SCREEN 4: Charging — sessions paused (spec §11.5) */
function ChargingScreen({
  isBraceletOwner,
  showActivationPrompt,
  onDisconnect,
  battery,
  batteryColor,
  sim,
}: ChargingScreenProps) {
  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <BraceletHeader
        title="Bracelet charging"
        onBack={onDisconnect}
      />
      {showActivationPrompt && <BraceletActivationCta />}
      <View style={s.chargingWrap}>
        <View style={s.chargingIcon}>
          <Text style={s.chargingIconText}>⚡</Text>
        </View>
        <Text style={s.chargingTitle}>Charging</Text>
        <Text style={s.chargingSub}>
          Sessions are paused while the bracelet charges.
        </Text>
        <View style={s.chargingStats}>
          <View style={s.chargingStatRow}>
            <Text style={s.chargingStatLabel}>Battery</Text>
            <Text style={[s.chargingStatVal, { color: batteryColor }]}>
              {battery == null ? '—' : `${battery}%`}
            </Text>
          </View>
        </View>
      </View>
      {__DEV__ && sim && <SimDemoBar sim={sim} />}
      {/* Iter v194 (2026-07-04): InlineBraceletTabBar op charging weg —
          duplicated systeem tab bar. */}
    </SafeAreaView>
  );
}

type ActiveSessionScreenProps = {
  status: BleStatusPacket;
  isPaused: boolean;
  pausedAt: number | null;
  activeMeta: ModeMeta;
  duration: number;
  selectedMode: BraceletMode;
  sessionPlannedRef: MutableRefObject<number>;
  sessionStartedAtRef: MutableRefObject<number | null>;
  pausedAtElapsedMsRef: MutableRefObject<number>;
  nowMs: number;
  safeInsets: EdgeInsets;
  isBraceletOwner: boolean;
  onResume: () => Promise<void>;
  onPause: () => Promise<void>;
  busy: boolean;
  setEndedLocally: Dispatch<SetStateAction<boolean>>;
  onStop: () => Promise<void>;
  /** Inline in de tab: terug naar het State Control-intro. */
  onMinimize?: () => void;
};

/* SCREEN 2: Active session — kalm, één focuspunt.
   Operator-feedback 2026-05-27 iter 3:
     - End button moest rustiger (neutraal, geen rode CTA)
     - Pause + Resume + Restart toegevoegd
     - Wanneer paused: timer toont pausedAt, eyebrow "PAUSED",
       Resume-button (mode-color filled) ipv Pause
   UI-stay-condition: sessionActive OF isPaused — anders zou de
   transitie naar idle de pause-state direct breken. */
function ActiveSessionScreen({
  status,
  isPaused,
  pausedAt,
  activeMeta,
  duration,
  selectedMode,
  sessionPlannedRef,
  sessionStartedAtRef,
  pausedAtElapsedMsRef,
  nowMs,
  safeInsets,
  isBraceletOwner,
  onResume,
  onPause,
  busy,
  setEndedLocally,
  onStop,
  onMinimize,
}: ActiveSessionScreenProps) {
  const [avOpen, setAvOpen] = useState(false);
  const isPushedRoute = usePathname() === '/bracelet-control';
  /* Volledig scherm, geen tabbalk (operator, 5 okt 2026) — de tab-indeling
     leest dit via utils/state-control-ui.ts. */
  useFocusEffect(
    useCallback(() => {
      setActiveSessionVisible(true);
      /* Operator, 5 okt 2026: de terugknop van de telefoon doet hier
         hetzelfde als de chevron — sessie minimaliseren naar het State
         Control-intro, de sessie loopt door. */
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!onMinimize) return false;
        onMinimize();
        return true;
      });
      return () => {
        sub.remove();
        setActiveSessionVisible(false);
      };
    }, [onMinimize]),
  );
  /* Operator, 4 okt 2026 ("er is letterlijk geen haptic" tijdens een
     echte sessie): playModePreviewHaptic/stopModePreviewHaptic zaten tot
     nu toe ENKEL achter de "Feel it"-testknop in ModeDetailModal — een
     gestarte sessie (dit scherm) dreef zelf geen enkele telefoon-trilling
     aan. Er bestaat nog geen echte bracelet-hardware (CLAUDE.md), dus de
     telefoon moet tijdens een actieve sessie zelf de rol van de pols-
     haptiek spelen, niet enkel in een losse preview-popup. Start/stopt
     met de echte sessie, pauzeert mee met isPaused (hervatten binnen 2
     min gaat verder waar de curve was — zie services/bracelet-haptics.ts). */
  /* GEWIJZIGD 5 okt 2026: de haptiek start/pauzeert/stopt niet meer hier
     (aan dit scherm gekoppeld → minimaliseren en terugkomen herstartte de
     curve), maar in services/bracelet-session-monitor.ts, die de sessie
     zelf volgt los van welk scherm open staat. */

  /* Tijdens pause is sessionActive false maar pausedAt heeft de
     remaining. Tijdens running zit 't in status.remainingMinutes. */
  const displayRemaining = isPaused ? pausedAt! : status.remainingMinutes;
  /* Ambient tint-kleur voor de hele active-session bg. Voor Boost
     (Gamma) wordt rood vervangen door warm amber via getActiveBgTint. */
  const ambientTint = getActiveBgTint(activeMeta.mode);
  /* Progress 0..1 voor de circulaire arc rond de timer. Planned
     komt uit sessionPlannedRef (gezet bij Start/Restart); fallback
     op huidige UI-duration voor edge-cases. */
  const planned =
    sessionPlannedRef.current > 0
      ? sessionPlannedRef.current
      : clampDuration(activeMeta.mode, duration);
  /* Iter 9be → 9bi (2026-05-31): progress baseerd op de LOKALE timer
     (sessionStartedAtRef), niet op BLE status.
     - Bij pause: gebruik pausedAtElapsedMsRef (exact-elapsed-bij-press).
     - Bij active: gebruik (nowMs - sessionStartedAtRef) / planned.
     Door dezelfde bron als mm:ss-display blijft het water-niveau
     consistent. Vroeger gebruikte progress BLE remainingMinutes — die
     resette na resume naar de verse N-min countdown van de bracelet,
     waardoor de drain-cirkel TERUGVULDE in plaats van door te lopen
     vanaf de pause-positie. BLE-status blijft fallback voor hot-reload. */
  const progress = (() => {
    if (planned <= 0) return 0;
    /* Zelfde bron als de mm:ss-tekst hieronder — geen eigen som meer,
       zie de uitleg daar ("niet ongeveer, moet exact zijn"). */
    const liveMonitorRemainingSec = getBraceletMonitorRemainingSec();
    if (liveMonitorRemainingSec !== null) {
      const remainingMin = liveMonitorRemainingSec / 60;
      return Math.min(1, Math.max(0, (planned - remainingMin) / planned));
    }
    if (isPaused) {
      const elapsedMin = pausedAtElapsedMsRef.current / 60000;
      return Math.min(1, Math.max(0, elapsedMin / planned));
    }
    const startedAt = sessionStartedAtRef.current;
    if (startedAt !== null) {
      const elapsedMin = (Date.now() - startedAt) / 60000;
      return Math.min(1, Math.max(0, elapsedMin / planned));
    }
    /* Fallback: BLE-status als startedAt onbekend (hot-reload edge). */
    return Math.min(
      1,
      Math.max(0, (planned - displayRemaining) / planned),
    );
  })();
  /* Operator, 16 september 2026 ("dit is helemaal fout, we gaan opnieuw
     opbouwen: donkere achtergrond"): zelfde hybride-dark-patroon als het
     Idle-scherm (idleDark) — dit ene scherm zwart terwijl de rest van de
     app licht blijft. Losse const i.p.v. de module-brede `light` omzetten,
     zodat andere schermen in dit bestand ongemoeid blijven. */
  const activeDark = true;
  return (
    <SafeAreaView
      style={[s.root, activeDark && { backgroundColor: '#000000' }]}
      edges={['top', 'bottom']}
    >
      {/* Active session blijft immersief voor ALLE accounts.
          Iter 9dq v109 (2026-06-04): voorheen had non-owner een preview-
          header met back-arrow tijdens active session. Voor unified
          UX nu ook hidden — eind-knop is de juiste exit (consistent
          met spec §11 "één focuspunt").
          Iter 2026-06-05: ALLEEN voor Free Breathwork CTA-flow voegen
          we tóch een back-header toe zodat user naar bronpagina terug
          kan. Non-CTA users zien geen header (bestaand immersief gedrag). */}
      <Stack.Screen options={{ headerShown: false }} />
      {/* Ambient tint-overlay — 8% opacity full-screen mood layer.
          pointerEvents="none" zodat touches doorgaan naar onderliggende
          UI. Zit BOVEN C.bg maar onder alle content (eerste child). */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: hexToTint(ambientTint, 0.08) },
        ]}
      />
      {/* Iter 9w: ScrollView vervangen door View — operator-feedback
          "active pagina mag niet scrollen". Content fit op één scherm
          door compactere elementen (iter 9j BreathworkStrip + smaller
          timer-font). Kortere telefoons: BreathworkStrip kan iets
          samengedrukt worden, maar geen scroll. */}
      {/* Iter 9bt → 9bv (2026-05-31): paddingBottom genormaliseerd op
          safeInsets+16 (min 32). De echte fix voor "card afgesneden"
          zit in compactere breathwork-card hieronder (iter 9bv shrink:
          -46px verticaal). Te veel paddingBottom maakt 't juist erger
          want het comprimeert de content nog meer. */}
      <View
        style={[
          s.activeScreen,
          /* Iter 9dq v77 (2026-06-03): floor bumped van 48 → 72.
             48 was nog te krap voor Samsung 3-button nav waar de
             inset-API onderrapporteert. 72px = consistent met
             player.tsx en andere bottom-CTAs.
             Iter v235 (2026-07-09): owner-inline mode zit binnen de
             (tabs) group → tab-bar (60-72px) overlappt de Voice
             guidance card. Fix: extra ~80px bottom padding voor
             owner-inline. Non-owner mode (Stack push) heeft geen tab-
             bar → normale padding. */
          {
            /* Inline in de tab (tab-balk eronder) vs. geduwd scherm —
               gekoppeld aan de route, niet aan isBraceletOwner (zie
               Minimize hieronder, 5 okt 2026). */
            /* Operator, 5 okt 2026 ("onderste blok 2 cm laten zakken,
               ademruimte"): geduwd scherm tot net boven de systeem-
               navigatiebalk — meer kan niet zonder eronder te vallen. */
            /* 5 okt 2026: het actieve sessiescherm toont nooit een tabbalk
               meer (volledig scherm) en staat altijd in de tab — één vaste
               ademruimte boven de systeemnavigatie (de SafeAreaView telt de
               systeemrand zelf al mee). 12 bleek "te laag". */
            paddingBottom: 44,
          },
        ]}
      >
        {/* Iter 9bg (2026-05-31): "Resuming will extend"-notice weg.
            Reden: sinds iter 9bf gebruikt het lokale display de exact-
            elapsed-ref voor pause én voor resume. De gebruiker ziet de
            countdown gewoon doortikken vanaf de pause-tijd — de BLE-
            minimum-extensie speelt zich onder water af en is voor de
            user onzichtbaar. Notice was alleen verwarrend (operator-
            feedback: "wat bedoel je met resuming will extend"). */}

        {/* Operator, 16 september 2026 ("timer en info moet in de bol"):
           mode-naam/dot + PAUSED-label verhuisd van boven de ring naar
           IN de ring (timerCenter), boven de mm:ss — alle info zit nu
           samen binnen de cirkel i.p.v. verspreid over het scherm.
           Operator, 27 september 2026 ("tekst calm control moet boven de
           cirkel komen"): mode-naam/dot terug verhuisd naar BOVEN de
           ring — enkel dat ene element, PAUSED-label blijft binnenin
           (niet expliciet gevraagd om ook te verplaatsen). */}
        <View style={s.activeHeaderRow}>
          {/* Operator, 5 okt 2026 ("geen tabbalk onderaan — chevron gebruiken
             zoals Apple"): neerwaartse chevron linksboven, zoals Now Playing
             in Apple Music — vervangt de Minimize-knop. De sessie loopt door;
             het pilletje op de andere schermen brengt je terug. */}
          <Pressable
            style={s.minimizeChevron}
            /* Operator, 5 okt 2026: "minimize moet naar welcome state
               control gaan" — het intro-scherm van de State Control-tab. */
            onPress={() => {
              if (onMinimize) onMinimize();
              else router.navigate('/bracelet' as never);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Minimize — session keeps running"
          >
            <ChevronDown size={30} color="#ffffff" strokeWidth={2.2} />
          </Pressable>
          <View style={s.activeModeRow}>
            <View style={[s.activeDot, { backgroundColor: activeMeta.color }]} />
            <Text style={[s.activeName, activeDark && { color: '#ffffff' }]}>
              {activeMeta.name}
            </Text>
          </View>
        </View>
        <View style={s.timerWrap}>
          {/* Operator, 16 september 2026 ("ambient glow, voelt anders aan
             als een platte lege website"): zachte gloed ACHTER alles,
             iets kleiner dan de ring zodat 'ie er vanachter uitpiept
             i.p.v. los ernaast te zweven. */}
          {/* Operator, 27 september 2026 ("grootte en dikte lijn van de
             cirkel en kleur moet hetzelfde zijn als in bracelet
             control"): DrainingCircle (deze pagina, loopt LEEG) hoort er
             even groot uit te zien als DurationRing (Bracelet control,
             loopt VOL) — 220→240, exact DurationRing's `size={240}`.
             RingAmbientGlow/SlowAmbientPulse proportioneel meegeschaald
             (dezelfde onderlinge afstand als voorheen). */}
          <RingAmbientGlow color={activeMeta.color} size={214} />
          {/* Operator, 5 okt 2026: de haptiek zichtbaar maken — één ring
             per tik, exact uit dezelfde curve als de motor (zie
             components/HapticPulseRings.tsx). Achter de cirkel, zodat de
             ringen vanaf de rand naar buiten uitzetten. */}
          {/* In de kleur van de toestand (operator, 6 okt 2026), zelfde tint
             als de rand — Sleep dus licht teal. */}
          <HapticPulseRings size={240} color={breathWaveLook(activeMeta.color).color} />
          <DrainingCircle progress={progress} color={activeMeta.color} size={240} />
          {/* Operator, 27 september 2026 ("doe die draaiende buitenlijn
             weg"): SlowAmbientPulse-render verwijderd — DrainingCircle's
             eigen outline (zie de component zelf) markeert de rand nu
             al voldoende. */}
          <View style={s.timerCenter} pointerEvents="none">
            {isPaused && (
              /* Zelfde contrastregel als de cijfers eronder: de cirkel IS de
                 moduskleur, dus het label in die kleur was onzichtbaar
                 (5 okt 2026). */
              <Text
                style={[
                  s.pausedLabel,
                  {
                    /* Altijd wit: het binnenvlak is donker glas, ook bij
                       Clarity (6 okt 2026). */
                    color: 'rgba(255,255,255,0.85)',
                  },
                ]}
              >
                PAUSED
              </Text>
            )}
            {/* Timer-display in mm:ss-formaat (iter 7). Lokaal berekend
                vanuit sessionStartedAtRef + sessionPlannedRef → tikt
                elke seconde.
                Iter 9be (2026-05-31): tijdens pause gebruikt 't nu de
                EXACT-elapsed-ms ref (gevangen op press-moment in
                onPause) → display blijft op de werkelijke pause-tijd
                zoals 14:23 ipv terug te springen naar 14:00. */}
            {(() => {
              const startedAt = sessionStartedAtRef.current;
              const plannedSec = planned * 60;
              /* Operator, 17 september 2026 ("niet ongeveer, moet exact
                 zijn — kan de echte teller niet gewoon geminimaliseerd
                 worden?"): dit scherm had zijn EIGEN, aparte berekening
                 (sessionStartedAtRef + Date.now()) die toevallig meestal
                 overeenkwam met bracelet-session-monitor.ts's berekening
                 (de bron die ook de pill voedt) — twee aparte sommen die
                 op floor-grenzen een seconde konden verschillen, ook al
                 waren beide op zich correct. Dat "toevallig gelijk" is
                 nu weg: dit scherm leest voortaan RECHTSTREEKS dezelfde
                 live waarde die de monitor intern gebruikt — dezelfde
                 functie, geen eigen som meer. De pill en dit scherm
                 kunnen nu per constructie nooit meer uit elkaar lopen.
                 De oude berekening blijft alleen nog als vangnet voor
                 het (zeldzame) geval dat de monitor zelf niet draait. */
              const liveMonitorRemainingSec = getBraceletMonitorRemainingSec();
              let remSec: number;
              if (liveMonitorRemainingSec !== null) {
                remSec = Math.max(0, Math.floor(liveMonitorRemainingSec));
              } else if (isPaused) {
                /* Vangnet: exact-ms uit ref → mm:ss precisie behouden
                   tijdens pause. Floor om half-seconde-flicker te
                   voorkomen. */
                const elapsedSec = Math.floor(
                  pausedAtElapsedMsRef.current / 1000,
                );
                remSec = Math.max(0, plannedSec - elapsedSec);
              } else if (startedAt) {
                /* Vangnet: Date.now() vers, niet de mogelijk-verouderde
                   getikte `nowMs`-state. */
                const elapsedSec = Math.max(
                  0,
                  Math.floor((Date.now() - startedAt) / 1000),
                );
                remSec = Math.max(0, plannedSec - elapsedSec);
              } else {
                /* Vangnet: gebruik BLE-minutes als startedAt onbekend
                   (edge case bij hot-reload mid-session). */
                remSec = displayRemaining * 60;
              }
              const mm = Math.floor(remSec / 60);
              const ss = remSec % 60;
              /* De ring-achtergrond wisselt van kleur/vulling (Draining-
                 Circle) — dus de cijfers hebben nog altijd een minimale
                 contrast-vangnet nodig, maar operator-feedback ("harde
                 slagschaduw aan de onderkant") klopte: radius 8/opacity
                 0.6 rendert op Android niet als een zachte gloed maar als
                 een zichtbare dubbele rand. Sterk getemperd (radius 3,
                 opacity 0.3) — net genoeg om tegen een lichte modus-kleur
                 (Clarity) leesbaar te blijven, zonder zelf op te vallen.
                 Licht-versus-donker mode-kleur (isLightColor) bepaalt of
                 de cijfers zelf donker-met-licht-vangnet of wit-met-
                 donker-vangnet zijn. */
              /* Altijd wit: het binnenvlak is donker glas, ook bij Clarity
                 (6 okt 2026 — was donkere tekst op een witte vulling). */
              const timerColorOverride = {
                color: '#ffffff',
                textShadowColor: 'rgba(0,0,0,0.3)',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 3,
              };
              return (
                <>
                  <Text style={[s.timerNum, timerColorOverride]}>
                    {mm}:{ss.toString().padStart(2, '0')}
                  </Text>
                  {/* "left" en "of 30:00" weg (operator, 6 okt 2026: "de
                      countdown is goed, de tekst eronder is overbodig") —
                      een aftellende klok spreekt voor zich. */}
                </>
              );
            })()}
          </View>
        </View>

        {/* Operator, 16 september 2026 ("ik vind de pils niet mooi, maak
           1 ronde pauze-knop en eronder end session, niet in pil"): terug
           naar een enkele ronde Play/Pause-knop, gecentreerd — "End
           session" nu als tekst-link ERONDER (i.p.v. ernaast) i.p.v. een
           tweede capsule. */}
        {/* Operator, 6 okt 2026 ("de vorm van onze knop is hier anders, is
           dat bewust?" — nee): dezelfde bediening als de ademsessie. Een
           ronde glazen knop met een lichte tint van de toestand, en END
           SESSION als rustige tekst eronder (een stop is onomkeerbaar, dus
           niet de knop die opvalt). Wat de knoppen doen is ongewijzigd. */}
        <View style={s.sessionControlColumn}>
          {/* Operator, 10 okt 2026: zelfde protocol als de ademsessie — één
              pil boven de play-knop, opent een glazen blad met de keuze
              Haptic / Haptic + Audio. */}
          <BlurView intensity={40} tint="dark" blurMethod="dimezisBlurViewSdk31Plus" style={s.avBar}>
            <Pressable
              onPress={() => {
                hapticTap();
                setAvOpen(true);
              }}
              style={({ pressed }) => [s.avBarInner, pressed && { opacity: 0.7 }]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Audio and haptics"
            >
              <SlidersHorizontal size={16} color="rgba(255,255,255,0.75)" strokeWidth={2} />
              <Text style={s.avBarTxt}>Audio & Haptics</Text>
            </Pressable>
          </BlurView>
          <Pressable
            style={({ pressed }) => [
              s.pauseMain,
              pressed && { transform: [{ scale: 0.95 }] },
              busy && s.btnDisabled,
            ]}
            onPress={isPaused ? onResume : onPause}
            disabled={busy}
            accessibilityLabel={isPaused ? 'Resume session' : 'Pause session'}
          >
            <BlurView
              intensity={40}
              tint="dark"
              blurMethod="dimezisBlurViewSdk31Plus"
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[StyleSheet.absoluteFill, s.pauseMainTint, { backgroundColor: activeMeta.color }]}
            />
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : isPaused ? (
              <Play size={24} color="#ffffff" strokeWidth={2.2} />
            ) : (
              <Pause size={24} color="#ffffff" strokeWidth={2.2} />
            )}
          </Pressable>
          {/* Iter v214 (2026-07-04): End = GEEN navigate — enkel
              setEndedLocally + onStop; de render valt vanzelf terug naar
              Choose Mode van dezelfde instance. */}
          <Pressable
            style={({ pressed }) => [s.endTxtWrap, pressed && { opacity: 0.6 }]}
            hitSlop={10}
            onPress={() => {
              setEndedLocally(true);
              void onStop();
            }}
            disabled={busy}
            accessibilityLabel="End session"
          >
            <Text style={s.endTxt}>END SESSION</Text>
          </Pressable>
          {/* iPhone trilt enkel zolang de app in beeld is (Apple staat geen
              haptiek op de achtergrond toe). Eerlijk zeggen, tenzij een
              Apple Watch het ritme al overneemt (6 okt 2026). */}
          {Platform.OS === 'ios' && !isWatchPlayingRhythm() && (
            <Text style={s.iosKeepOpen}>Keep VIBEZCORE open to feel the rhythm</Text>
          )}
        </View>

        {/* Operator, 13 augustus 2026: "alles op de pagina active weg
           buiten wat ik heb gezegd" — het actieve scherm toont nu alleen
           nog modusnaam, cirkel, en Pause/Resume + End. Minimize, battery-
           /charging-waarschuwingen, de rondlopende quote, de Free-
           Breathwork-contextchip en Voice guidance zijn allemaal
           verwijderd. */}
      </View>

      {/* Sim demo bar verhuisd naar idle-screen (operator-feedback:
          tijdens een actieve sessie hoort er geen dev-noise te zijn).
          Indien dev nog wil testen tijdens active: zelf wisselen
          naar idle, knoppen daar bedienen, dan terug naar active. */}

      {/* Action bar — ronde Play/Pause-knop (primaire actie) + End als
          tekst-link ernaast, zie sessionControlRow hierboven in JSX. */}
      <AudioHapticsSheet visible={avOpen} onClose={() => setAvOpen(false)} />
    </SafeAreaView>
  );
}

/* ── Audio & Haptics voor State Control (operator, 10 okt 2026) ──────────
   Zelfde protocol als de ademsessie: één pil boven de play-knop, een echt
   glazen blad, Done rechtsboven (kiezer). Twee kaarten: Haptic en
   Haptic + Audio, telkens met één zin uitleg. Geen claims — enkel wat je
   voelt of hoort. Wisselen kan tijdens de sessie (de trilmotor-service leest
   de keuze bij elke tik). */
function AudioHapticsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const hear = useStateHear();
  if (!visible) return null;
  const options = [
    {
      v: false,
      title: 'Haptic',
      body: 'Feel the rhythm on your smartphone or smartwatch.',
    },
    {
      v: true,
      title: 'Haptic + Audio',
      body: 'Feel and hear the rhythm. A soft heartbeat plays with every pulse.',
    },
  ] as const;
  return (
    <GlassSheet visible={visible} onClose={onClose}>
      <View style={[s.avSheet, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
        <VibezGlass
          radius={24}
          level="sheet"
          blurTarget={rootBlurRef}
          style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
        />
        <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }} accessibilityLabel="Close">
          <View style={s.avGrip} />
        </Pressable>
        <View style={s.avHead}>
          <Text style={s.avTitle}>Audio & Haptics</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={s.avDone}>Done</Text>
          </Pressable>
        </View>
        {options.map((o) => {
          const on = o.v === hear;
          return (
            <Pressable
              key={o.title}
              onPress={() => {
                if (on) return;
                hapticTap();
                setStateHear(o.v);
              }}
              style={({ pressed }) => [s.avCard, on && s.avCardOn, pressed && { opacity: 0.85 }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              {/* Vaste VIBEZCORE-iconen (zelfde als de keuze Voice / Haptics /
                  Voice + Haptics bij breathwork). */}
              <View style={s.avCardIcons}>
                <ModeGlyph mode={o.v ? 'both' : 'haptic'} color={on ? '#ffffff' : 'rgba(255,255,255,0.6)'} scale={1.25} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.avCardTitle, on && { color: '#ffffff' }]}>{o.title}</Text>
                <Text style={s.avCardBody}>{o.body}</Text>
              </View>
              <View style={[s.avRadio, on && s.avRadioOn]}>{on ? <Check size={13} color="#0a0a0a" strokeWidth={3} /> : null}</View>
            </Pressable>
          );
        })}
      </View>
    </GlassSheet>
  );
}

type IdleScreenProps = {
  onMinimize?: () => void;
  /** Er loopt (of pauzeert) een sessie terwijl de moduskeuze getoond wordt. */
  sessionRunning: boolean;
  onReturnToSession: () => void;
  /** Lopende sessie beëindigen en de geselecteerde modus starten. */
  onSwitchMode: () => Promise<void>;
  fromContext: 'audio' | 'bracelet' | 'plan' | null;
  disconnectAndBackToSource: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  ctaBackLabel: string | undefined;
  isBraceletOwner: boolean;
  showActivationPrompt: boolean;
  safeInsets: EdgeInsets;
  criticalBattery: boolean;
  lowBattery: boolean;
  battery: number | null;
  batteryColor: string;
  selectedMode: BraceletMode;
  setSelectedMode: Dispatch<SetStateAction<BraceletMode>>;
  meta: ModeMeta;
  duration: number;
  setDuration: Dispatch<SetStateAction<number>>;
  onStart: () => void | Promise<void>;
  /** Sessies zitten in het VIBEZCORE-pakket; zonder abonnement opent Start
   *  de paywall (Feel it blijft vrij als voorproef). */
  startLocked: boolean;
  /** Einde van de gratis voorproef → paywall. */
  onTrialEnd: () => void;
  busy: boolean;
  stats: BraceletStats;
  completedModeForModal: BraceletMode | null;
  completedMinutes: number | null;
  setCompletedModeForModal: Dispatch<SetStateAction<BraceletMode | null>>;
  detailModeForModal: BraceletMode | null;
  setDetailModeForModal: Dispatch<SetStateAction<BraceletMode | null>>;
  sim: SimulatedBracelet | null;
};

/* SCREEN 1: Idle — mode selection + duration + Start CTA.
   Iter 9 (operator-feedback): herschreven naar single-screen layout
   zonder scroll. Mode bovenaan als horizontale chip-picker, duration
   kort eronder, Start CTA prominent, mini-footer met stats+history.
   Doel: alles in één blik zichtbaar zonder scrollen, Apple-style
   hiërarchie met eyebrow-headers. */
function IdleScreen({
  onMinimize,
  sessionRunning,
  onReturnToSession,
  onSwitchMode,
  fromContext,
  disconnectAndBackToSource,
  onDisconnect,
  ctaBackLabel,
  isBraceletOwner,
  showActivationPrompt,
  safeInsets,
  criticalBattery,
  lowBattery,
  battery,
  batteryColor,
  selectedMode,
  setSelectedMode,
  meta,
  duration,
  setDuration,
  onStart,
  startLocked,
  onTrialEnd,
  busy,
  stats,
  completedModeForModal,
  completedMinutes,
  setCompletedModeForModal,
  detailModeForModal,
  setDetailModeForModal,
  sim,
}: IdleScreenProps) {
  /* Operator, 16 september 2026 ("Optie 1 Hybride: de app blijft Light,
     maar dit specifieke bedieningsscherm maken we Dark — de felle
     modus-kleur knalt dan maximaal, 2026-luxe-vibe"): alleen déze ene
     screen-component (Idle: mode + duration + Start) gaat dark, de rest
     van bracelet-control.tsx (Searching/Active/Charging/Fault) en de
     rest van de app blijven op de bestaande `light`-module-instelling.
     Eén boolean hier i.p.v. de module-brede `light` omzetten. */
  const idleDark = true;

  const idleInTab = usePathname() === '/bracelet';
  /* Geen tabbalk op dit keuzescherm, zoals de breathwork-setup (operator,
     6 okt 2026: "zo krijgt de pagina meer ademruimte"). */
  useFocusEffect(
    useCallback(() => {
      if (!idleInTab) return undefined;
      setChooseScreenVisible(true);
      return () => setChooseScreenVisible(false);
    }, [idleInTab]),
  );
  const [runSnap, setRunSnap] = useState(getBraceletSessionSnapshot());
  useEffect(() => subscribeBraceletSession(setRunSnap), []);
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  /* ── "Try 30 seconds free" (operator, 7 okt 2026) ──
     Zonder abonnement was alles op slot en zat de gratis voorproef ver-
     stopt achter de i. Nu is de grote knop zelf de voorproef: het ritme
     van deze toestand op de telefoon (en een gekoppeld horloge), de ring
     telt af, daarna de paywall — zoals de Breathwork-proef. */
  const [trialLeft, setTrialLeft] = useState<number | null>(null);
  const trialTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTrial = useCallback((ended: boolean) => {
    /* Enkel opruimen als er echt een voorproef liep — anders zou een
       moduswissel tijdens een lopende sessie haar haptiek stilleggen. */
    if (!trialTimer.current) return;
    clearInterval(trialTimer.current);
    trialTimer.current = null;
    setTrialLeft(null);
    if (!ended) stopModePreviewHaptic();
  }, []);
  const startTrial = () => {
    hapticPress();
    playModeTrialHaptic(selectedMode);
    const started = Date.now();
    setTrialLeft(PREVIEW_MAX_SECONDS);
    trialTimer.current = setInterval(() => {
      const left = Math.max(0, PREVIEW_MAX_SECONDS - Math.floor((Date.now() - started) / 1000));
      setTrialLeft(left);
      if (left <= 0) {
        stopTrial(true);
        onTrialEnd();
      }
    }, 250);
  };
  /* Andere toestand, ander scherm of weg: voorproef stopt. */
  useEffect(() => () => stopTrial(false), [selectedMode, stopTrial]);
  const trialRunning = trialLeft !== null;
  const condensedMinutes = previewCondensedRampMinutes(selectedMode);

  /* "Match your rhythm" (operator, 7 okt 2026): de eerste keer Start of
     de voorproef → eerst de rusthartslag (of bewust het gemiddelde). Daarna
     loopt de gekozen actie meteen verder — één tik, geen tweede keer. */
  const pulse = useRestingPulse();
  const [rhythmOpen, setRhythmOpen] = useState(false);
  const pendingAfterRhythm = useRef<(() => void) | null>(null);
  const [quickOpen, setQuickOpen] = useState<'chill' | 'boost' | null>(null);
  const [trialSheetOpen, setTrialSheetOpen] = useState(false);
  const withRhythm = (action: () => void) => () => {
    if (pulse.decided) {
      action();
      return;
    }
    pendingAfterRhythm.current = action;
    setRhythmOpen(true);
  };
  /* Modus én zijn standaardduur in één render zetten: anders tekende de
     cirkel eerst de nieuwe modus met de duur van de vorige, en sprong de
     vulling pas een frame later naar de juiste hoogte. */
  /* Pas na een eerste wissel leeg-en-vullen; bij het openen van het scherm
     staat de cirkel meteen gevuld. */
  const modeChangedRef = useRef(false);
  const pickMode = (next: BraceletMode) => {
    modeChangedRef.current = true;
    setSelectedMode(next);
    setDuration(getModeMeta(next).defaultMinutes);
  };

  return (
    /* Iter 9bb (2026-05-31): SafeAreaView edges conditional op owner-status.
       Voor OWNERS (inline render in /bracelet tab, geen native header) =
       ['top','bottom'] zodat status-bar niet over de content valt.
       Voor NON-OWNERS (preview met native Stack header) = ['bottom'] only,
       want de native header consumeert al de top safe-area. Dubbele 'top'
       inset gaf een grote leegte tussen header en content. */
    <SafeAreaView
      style={[s.root, idleDark && { backgroundColor: '#000000' }]}
      /* In de tab neemt de tabbalk de onderste systeemrand al voor zijn
         rekening — hier nogmaals reserveren duwde de Start-knop onder de
         balk (operator, 5 okt 2026). */
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <BraceletHeader
        title="Session Control"
        /* In de State Control-tab: terug naar het intro (zelfde als de
           chevron/terugknop elders, 5 okt 2026). `onDisconnect` liet de tab
           anders op "Connecting…" hangen (stil verbinden gebeurt één keer). */
        /* Audit 5 okt 2026: met een lopende sessie stopt de terugpijl NOOIT
           de sessie (disconnectAndBackToSource roept onStop aan). */
        onBack={
          sessionRunning
            ? onMinimize ?? (() => router.navigate('/bracelet' as never))
            : fromContext
              ? disconnectAndBackToSource
              : onMinimize ?? onDisconnect
        }
        backLabel={ctaBackLabel}
        dark={idleDark}
        /* Operator, 4 okt 2026 ("waarom heb je demo gezet op session
           control?"): DEMO-badge hier weggehaald — dit scherm is sinds
           de Session Control-herstructurering een ECHTE, volwaardige
           feature voor iedereen (telefoon + horloge-haptiek werkt zonder
           bracelet), geen demo van iets dat nog niet bestaat. Enkel de
           bracelet-HARDWARE zelf (batterij/verbinding) is nog gesimuleerd
           voor niet-eigenaars — dat blijft zichtbaar via de Searching/
           Fault/Charging-schermen, niet via dit hoofdscherm. */
        right={
          /* Operator, 16 september 2026 ("die connected en batterij mag
             rechtsboven naast preview"): de status-regel verhuist van een
             eigen volle-breedte rij onder de titel naar hier, naast het
             tandwiel. Disconnect blijft op het tandwiel-icoon (Operator,
             zelfde dag eerder: "Disconnect hoeft niet prominent, naar
             tandwiel"), niet tonen tijdens de pre-activation banner-flow
             (banner is daar al de primary action). */
          !showActivationPrompt ? (
            <View style={s.headerRightGroup}>
              {/* Operator, 27 september 2026 ("verwijder ook de
                 batterij icoon"): de statusDot (kleur naar batterij-
                 gezondheid) is weg.
                 Operator, zelfde dag ("die 87% moet weg"): het
                 percentage-tekstje ernaast is nu ook weg — enkel het
                 tandwiel-icoon blijft in deze rechter-slot over. */}
              <Pressable
                onPress={onDisconnect}
                hitSlop={12}
                accessibilityLabel="Bracelet settings — disconnect"
              >
                <Settings
                  size={20}
                  color={idleDark ? 'rgba(255,255,255,0.55)' : C.textDim}
                  strokeWidth={2}
                />
              </Pressable>
            </View>
          ) : undefined
        }
      />
      {showActivationPrompt && <BraceletActivationCta />}
      {/* Iter 9ae (2026-05-31): expliciete paddingBottom voor safe-zone.
          Start-button stond op Audio PRO (non-owner standalone) te dicht
          tegen home-indicator. Math.max zorgt voor minimum 28px buffer
          ook op Android zonder gesture-bar.
          Iter 9dq v77 (2026-06-03): floor bumped van 48 → 72.
          Consistent met player.tsx en andere bottom-CTAs.
          Iter 9dq v105 (2026-06-04, REVERT): vorige iteraties (v100/v102/
          v104 — paddingBottom 100/140 + ScrollView-wrapper) hebben
          owner-inline-render verpest (Start-knop afgesneden, layout
          stuk). Operator-mandate: terug naar 2 dagen geleden, niet
          scrollbaar, alles moet in scherm passen. */}
      <View
        style={[
          s.idleSingleScreen,
          /* Zonder tabbalk: de knop op dezelfde hoogte als "Start session"
             in de breathwork-setup (6 okt 2026). */
          { paddingBottom: Math.max(safeInsets.bottom, 12) + 26 },
        ]}
      >
        {/* Iter 9bb (2026-05-31): preview-exit pill verwijderd. De native
            Stack header toont al "Bracelet preview" + back-arrow voor
            non-owners → de in-screen pill was dubbele duplicate. Levert
            ~60px verticale ruimte op, content schuift omhoog (operator
            wilde hele pagina hoger). PREVIEW-signal blijft in de native
            header-titel. */}
        {/* Status-regel is verhuisd naar de header (right-slot, naast het
           tandwiel) — zie BraceletHeader's `right` hierboven. */}

        {/* Operator, 16 september 2026: de armband-hero-gloed is verhuisd
           naar SearchingScreen ("Looking for your bracelet") — dat was
           de bedoeling voor die foto, niet dit scherm. */}

        {/* Operator, 16 september 2026 ("we gaan het anders aanpakken —
           cirkel groter, wit/modus-kleur op donkere achtergrond; user
           tikt een state aan, cirkel-rand krijgt de kleur, info in de
           cirkel; een schuifregelaar onderaan vult de binnenkant met een
           golf-animatie (zelfde als breathwork), stijgend met de
           minuten"): ring toont enkel het resultaat (rand-kleur + golf-
           vulling + modus-naam/tijd), de DurationSlider eronder bedient
           de waarde. */}
        {/* Je rusthartslag BOVEN de cirkel (operator, 7 okt 2026: "in de cirkel
            opgekropt, en blijft staan bij het vegen") — een gegeven over jou,
            niet over de toestand. Eerder: in de cirkel (operator, 7 okt
            2026: "68 bpm met een icoon in de cirkel zelf … van daar
            aanklikken om opnieuw in te stellen; bij play verdwijnt dat mee").
            Los van de veeg-cirkel gelegd, zodat een tik hier niet ook het
            i-paneel opent. */}
        {/* Operator, 9 okt 2026: cirkel lager — net boven het midden. */}
        <View style={{ height: 0 }} />
        <View style={s.durationRingWrap}>
          {/* Vage pijltjes links/rechts: er valt hier te vegen (verdwijnen
              aan het uiteinde). */}
          {MODES.findIndex((m) => m.mode === selectedMode) > 0 && (
            <View pointerEvents="none" style={[s.swipeHint, { left: 6 }]}>
              <ChevronLeft size={22} color="rgba(255,255,255,0.22)" strokeWidth={2} />
            </View>
          )}
          {MODES.findIndex((m) => m.mode === selectedMode) < MODES.length - 1 && (
            <View pointerEvents="none" style={[s.swipeHint, { right: 6 }]}>
              <ChevronRight size={22} color="rgba(255,255,255,0.22)" strokeWidth={2} />
            </View>
          )}
          <ModeSwipeRing
            mode={selectedMode}
            onChange={(next) => {
              hapticTap();
              pickMode(next);
            }}
            onTap={() => setDetailModeForModal(selectedMode)}
            dial={
              trialRunning
                ? undefined
                : { size: RING_DIAL, min: meta.minMinutes, max: meta.maxMinutes, value: duration, onChange: setDuration }
            }
          >
            {/* key = modus: elke modus is een eigen "wijzerplaat" die meteen
                met zijn eigen vulling binnenkomt, niet klotsend vanaf het
                niveau van de vorige (operator, 5 okt 2026: "de vulling
                verandert telkens"). */}
            {trialRunning ? (
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <HapticPulseRings size={RING_DIAL} color={breathWaveLook(meta.color).color} />
              </View>
            ) : null}
            <DurationRing
              key={selectedMode}
              clockOverride={trialRunning ? `0:${String(trialLeft).padStart(2, '0')}` : undefined}
              fillOnMount={modeChangedRef.current}
              min={meta.minMinutes}
              max={meta.maxMinutes}
              value={duration}
              color={meta.color}
              label={meta.name}
              size={RING_DIAL}
              dialHandle={!trialRunning}
              dark={idleDark}
              recommended={
                duration === DURATION_PRESETS[selectedMode].find((p) => p.recommended)?.value
              }
            />
          </ModeSwipeRing>
          {/* Operator, 9 okt 2026: je hartslag als klein pilletje onder de
              vaste tijden — enkel hart, bpm en pijltje (in de ring was het
              verwarrend onder "Recommended"). Tik = hartslag-blad. */}
          {!trialRunning && !sessionRunning ? (
            <PressScale
              onPress={() => {
                hapticTap();
                pendingAfterRhythm.current = null;
                setRhythmOpen(true);
              }}
              hitSlop={12}
              scaleTo={0.94}
              style={[s.ringHr, s.ringHrTop]}
              accessibilityRole="button"
              accessibilityLabel={`Your heart rate, ${pulse.liveBpm ?? pulse.bpm} beats per minute. Tap to measure your heart right now.`}
            >
              <HeartPulse size={16} color="#ffffff" strokeWidth={2} />
              <Text style={s.ringHrTxt}>{pulse.liveBpm ?? pulse.bpm} bpm</Text>
              {shouldSuggestRemeasure(pulse) ? <View style={s.ringPulseDot} /> : null}
              <ChevronRight size={14} color="rgba(255,255,255,0.55)" strokeWidth={2.4} />
            </PressScale>
          ) : null}
        </View>

        {/* Paginabolletjes zoals iOS (wit): waar je zit, hoeveel modi er
            zijn, en een tik springt meteen naar die modus (5 okt 2026 —
            vervangt de rij met vijf knoppen). */}
        <View style={s.modeDots}>
          {MODES.map((m: ModeMeta) => {
            const active = m.mode === selectedMode;
            return (
              <Pressable
                key={m.mode}
                hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
                onPress={() => {
                  hapticTap();
                  pickMode(m.mode);
                }}
                accessibilityLabel={`Select ${m.name} mode`}
                accessibilityState={{ selected: active }}
              >
                <View
                  style={[
                    s.modeDot,
                    /* Wit, zoals iOS-paginabolletjes (operator, 5 okt 2026). */
                    /* Operator, 9 okt 2026 ("zoals Apple, subtiel"): rond,
                       de actieve iets groter en in de toestandskleur. */
                    {
                      backgroundColor: active ? m.color : '#ffffff',
                      opacity: active ? 1 : 0.25,
                      width: active ? 8 : 6,
                      height: active ? 8 : 6,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        {/* De losse i-knop hier is weg: de i staat nu in de ring, naast de
            naam van de toestand (6 okt 2026). */}

        {/* Operator ("dat moet meer in deze stijl, breathwork"): de losse
           preset-chip-rij + aparte slider vervangen door dezelfde
           verticale DurationWheel als breath-setup.tsx — gekozen waarde
           groot/wit gecentreerd, "Recommended" ernaast wanneer van
           toepassing, geen los sterretje/legend-regel meer nodig. */}
        {/* Lager, met meer lucht onder de bolletjes (operator, 6 okt 2026). */}
        {/* 90 → 38: de hartslag-pil boven de cirkel neemt die ruimte nu in
            (7 okt 2026), anders zakt de Start-knop onder de systeembalk. */}
        {/* Operator, 9 okt 2026 (Apple-stijl): de duur als segmented control
            onder de cirkel — alle keuzes in één oogopslag. Gekozen = volle
            toestandskleur, de rest dezelfde kleur transparant. */}
        {!trialRunning ? (
          <View style={s.durSeg} accessibilityRole="radiogroup">
            {/* Operator, 9 okt 2026: max. drie — kort, aanbevolen, lang.
                Alles daartussen kies je op de rand van de cirkel. */}
            {threePresets(selectedMode).map((p) => {
              const on = p.value === duration;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => {
                    if (on) return;
                    hapticTap();
                    setDuration(p.value);
                  }}
                  style={[
                    s.durSegItem,
                    { backgroundColor: on ? meta.color : `${meta.color}26` },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${p.value} minutes${p.recommended ? ', recommended' : ''}`}
                >
                  <Text style={[s.durSegTxt, { color: on ? '#0a0a0a' : 'rgba(255,255,255,0.85)' }]}>
                    {p.value} min
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Spacer — pushes Start-CTA naar onderkant. */}
        <View style={{ flex: 1, minHeight: 2 }} />


        {/* Quick Chill / Quick Boost: twee icoontjes naast elkaar boven de
            Start-knop (operator, 7 okt 2026: "enkel iconen, bij aantikken
            popup met korte info en start of back" + "boven de cta naast
            elkaar"). Zelfde tekens als de toestand erachter. */}
        {!sessionRunning && !trialRunning ? (
          <View style={s.quickBlock}>
            {/* Operator, 9 okt 2026 (Apple-stijl "Quick Start Cards"): twee
                liggende kaartjes met tekst i.p.v. losse icoontjes — je ziet
                meteen wat ze doen. Tik = kort infoblad met Start. */}
            <View style={s.quickCardRow}>
              {QUICK_SESSIONS.map((q) => {
                const QIcon = MODE_ICONS[q.mode];
                return (
                  <PressScale
                    key={q.key}
                    onPress={() => {
                      hapticTap();
                      setQuickOpen(q.key);
                    }}
                    style={[s.quickCard]} scaleTo={0.97}
                    accessibilityRole="button"
                    accessibilityLabel={`${q.label}, ${QUICK_SESSION_MINUTES} minutes`}
                  >
                    <QIcon size={q.key === 'chill' ? 22 : 18} color={getModeMeta(q.mode).color} strokeWidth={2} />
                    {/* Operator: geen "5 min" — dat staat in het infoblad. */}
                    <Text style={s.quickCardTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                      {q.label}
                    </Text>
                  </PressScale>
                );
              })}
            </View>
          </View>
        ) : null}


        {/* Operator ("dat moet meer in deze stijl, breathwork" — screenshot
           van breath-setup.tsx se footer-CTA): de losse gekleurde "GO"-
           cirkel vervangen door dezelfde volle-breedte, effen witte CTA-
           pil met duidelijke tekst als breathwork/de rest van de app
           (huisstijl §3 — CTA-achtergrond is nooit de accent-/modus-
           kleur). `PrimaryCtaButton` = dezelfde haptiek+press-scale-
           wrapper als het Connect/Retry-scherm hierboven in dit bestand,
           voor consistentie binnen bracelet-control.tsx zelf. */}
        {sessionRunning && runSnap.mode === selectedMode ? (
          <RunningSessionBar onPress={onReturnToSession} />
        ) : sessionRunning ? (
          /* Operator, 5 okt 2026: andere modus bekijken tijdens een lopende
             sessie mag; wisselen vraagt één bevestiging (een sessie stoppen
             is onomkeerbaar). */
          <PrimaryCtaButton
            style={[s.primaryBtn, s.chooseCta, busy && s.btnDisabled]}
            onPress={() => setConfirmSwitch(true)}
            disabled={busy}
            accessibilityLabel={`Switch to ${meta.name}`}
          >
            <Text style={[s.primaryBtnText, s.chooseCtaTxt]}>Switch to {meta.name}</Text>
          </PrimaryCtaButton>
        ) : (
          <PrimaryCtaButton
            style={[s.primaryBtn, s.chooseCta, (busy || criticalBattery) && s.btnDisabled]}
            onPress={
              startLocked ? (trialRunning ? () => stopTrial(false) : () => setTrialSheetOpen(true)) : withRhythm(onStart)
            }
            disabled={busy || criticalBattery}
            accessibilityLabel={
              startLocked
                ? trialRunning
                  ? 'Stop the preview'
                  : `Try ${meta.name} free for 30 seconds`
                : `Start ${meta.name} session`
            }
          >
            {busy ? (
              <ActivityIndicator color="#1D1D1F" />
            ) : startLocked ? (
              <Text style={[s.primaryBtnText, s.chooseCtaTxt]}>
                {trialRunning ? 'Stop preview' : 'Try 30 seconds free'}
              </Text>
            ) : (
              <Text style={[s.primaryBtnText, s.chooseCtaTxt]}>Start {meta.name}</Text>
            )}
          </PrimaryCtaButton>
        )}
        {/* Gratis (operator, 7 okt 2026: "alles opgepropt"): de uitleg en
            "Unlock all sessions" staan nu in het paneel bij het aantikken.
            Onder de knop enkel nog de melding tijdens een versnelde voor-
            proef — in een vaste ruimte, zodat de knop nooit verspringt. */}
        {startLocked && !sessionRunning ? (
          <View style={s.trialInfo}>
            {trialRunning && condensedMinutes !== null ? (
              <Text style={s.trialInfoTxt}>{'Sped up for the preview.\nA full session slows down gradually.'}</Text>
            ) : null}
          </View>
        ) : null}
        <SwitchSessionConfirm
          visible={confirmSwitch}
          fromName={runSnap.modeName}
          toName={meta.name}
          onCancel={() => setConfirmSwitch(false)}
          onConfirm={() => {
            setConfirmSwitch(false);
            void onSwitchMode();
          }}
        />

        {/* Toestel zonder trilmotor (veel tablets): eerlijk zeggen dat je
            hier niets voelt, i.p.v. een sessie die enkel lijkt te lopen
            (audit 5 okt 2026). */}
        {!deviceCanVibrate() && (
          <View style={s.warnChip}>
            <Text style={s.warnChipIcon}>⚠</Text>
            <Text style={s.warnChipText}>
              This device has no vibration motor, so sessions can&apos;t be felt here
            </Text>
          </View>
        )}

        {/* Low battery warning (compact, alleen als nodig) */}
        {lowBattery && (
          <View style={s.warnChip}>
            <Text style={s.warnChipIcon}>⚠</Text>
            <Text style={s.warnChipText}>
              Battery may not last the full session
            </Text>
          </View>
        )}

        {/* Operator, 16 september 2026 ("History moet apart bij activity
           komen" / "3 today, 19 min etc moet hier weg, statistieken komen
           in activity"): de hele mini-footer (stats-regel + history-link)
           is weg. History zat al dubbel met de "All bracelet sessions"
           rij in de Activity-tab (activity.tsx); de stats-samenvatting
           hoort daar nu ook thuis i.p.v. hier herhaald te worden. */}

        {/* Iter 9dq v105 (2026-06-04): "Complete the system" Audio
            Library upsell verwijderd op operator-verzoek
            ("upsell complete the system is hier niet nodig"). Audio
            upsell-pad blijft beschikbaar via Account-tab subscription-
            card. Hier op bracelet-control hoorde 't niet thuis —
            content moet in scherm passen, geen extra cards. */}

        {/* Operator, 5 okt 2026: "verwijder tekst 'Also works with…' onder
           de CTA" — de link naar /smart-bead-bracelet is hier weg; de
           bracelet-pagina blijft bereikbaar via de rest van de app. */}

        {/* Sim demo-balk weg van dit scherm (operator, 6 okt 2026: "wil niet
            meer zien") — ook in de testversie het scherm zoals gebruikers
            het krijgen. */}
      </View>

      {/* CompletionModal — toont na natural completion (timer hits 0).
          Rendert hier omdat na completion de UI vanzelf naar idle gaat. */}
      {completedModeForModal !== null && (
        <CompletionModal
          mode={completedModeForModal}
          minutes={completedMinutes}
          onDismiss={() => setCompletedModeForModal(null)}
        />
      )}

      <TrialSheet
        visible={trialSheetOpen}
        mode={selectedMode}
        onClose={() => setTrialSheetOpen(false)}
        onStartPreview={() => {
          setTrialSheetOpen(false);
          withRhythm(startTrial)();
        }}
        onUnlock={() => {
          setTrialSheetOpen(false);
          onStart();
        }}
      />

      <QuickSessionSheet
        which={quickOpen}
        onClose={() => setQuickOpen(null)}
        onStart={(q) => {
          setQuickOpen(null);
          if (startLocked) {
            onStart();
            return;
          }
          withRhythm(() => {
            void startStateControlNow(q.mode, QUICK_SESSION_MINUTES, { quick: true });
          })();
        }}
      />

      <RhythmSheet
        visible={rhythmOpen}
        mode={selectedMode}
        /* Nog geen rusthartslag gekozen → eerst die (gewone blad); daarna
           gaat dit blad enkel over je hartslag van nu. */
        now={pulse.decided}
        /* Geopend vanuit Start → de sessie begint meteen na de meting. */
        nextLabel={pendingAfterRhythm.current ? 'Start' : 'Back to State Control'}
        onClose={() => {
          pendingAfterRhythm.current = null;
          setRhythmOpen(false);
        }}
        onDone={() => {
          setRhythmOpen(false);
          const next = pendingAfterRhythm.current;
          pendingAfterRhythm.current = null;
          next?.();
        }}
      />

      {/* ModeDetailModal — bottom-sheet popup op tap mode-card (iter 9k).
          Operator, 16 september 2026 ("in de popup choose cta moet
          weg"): geen Choose-CTA meer — enkel info, sluiten via backdrop
          of X. Modus kiezen gebeurt al via de pill-rij buiten de popup. */}
      {detailModeForModal !== null && (
        <ModeDetailModal
          mode={detailModeForModal}
          onClose={() => setDetailModeForModal(null)}
        />
      )}

      {/* Iter v209 (2026-07-04): End-session modal VOLLEDIG VERWIJDERD.
          6 iteraties (v87, v193, v195, v197, v201-202) faalden in
          productie. Nu directe End-knop actie zonder modal — navigate
          weg + fire-and-forget Stop. Simpelheid > confirmatie. */}
      {/* Iter v194 (2026-07-04): InlineBraceletTabBar op idle Choose Mode
          verwijderd. Bracelet-control zit binnen (tabs) navigator (via
          bracelet-tab inline-render) → systeem tab bar was er al →
          mijn stub gaf DUBBELE bar op operator-scherm en verdrong
          zelfs de Start-knop uit beeld. */}
    </SafeAreaView>
  );
}

/* Operator, 5 okt 2026 ("foto 2 is andere UI dan foto 1 — zorg voor
   professionele consistentie, niet vanalles door elkaar"): er bestond een
   tweede, GEDUWDE versie van dit scherm (/bracelet-control, via de pill,
   de bracelet-pagina, meldingen en het plan) met een eigen opmaak. Er is
   nu één plek: de State Control-tab. Elke weg naar /bracelet-control
   wordt doorgestuurd, met dezelfde parameters (modus/duur/plan/…) — de tab
   slaat dan het intro over (zie (tabs)/bracelet.tsx). */
/** `open`-tokens van links die al afgehandeld zijn (zie `freshLink`). */
const handledLinkTokens = new Set<string>();

export default function BraceletControl(props: { autoConnect?: boolean; onMinimize?: () => void } = {}) {
  const pathname = usePathname();
  const params = useLocalSearchParams();
  if (pathname === '/bracelet-control') {
    return (
      <Redirect
        href={{ pathname: '/bracelet', params: { ...params, open: String(Date.now()) } } as never}
      />
    );
  }
  return <BraceletControlScreen {...props} />;
}

function BraceletControlScreen({
  autoConnect = false,
  onMinimize,
}: { autoConnect?: boolean; onMinimize?: () => void } = {}) {
  const bracelet = getBracelet();
  const sim = getSimHooks(); // null on real hardware
  /* Iter 9x: safe-area insets voor bottomBarDual padding. Wanneer
     bracelet-control inline gerenderd wordt binnen (tabs)/bracelet,
     zit een tab-bar onder ons; insets.bottom kan dan 0 of klein zijn.
     Bij standalone /bracelet-control geeft de OS de echte bottom-inset
     (iPhone home-indicator). useSafeAreaInsets vangt beide. */
  const safeInsets = useSafeAreaInsets();

  /* User-state — bepaalt of we Audio Library upsell tonen onderaan.
     Alleen voor bracelet-only owners (isBraceletOwner && !isPro).
     Full PRO (beide producten) heeft niets nodig; Audio PRO (zonder
     bracelet) komt hier sowieso niet (geen access). */
  const isBraceletOwner = useBraceletOwner();
  const { isPro } = useSubscription();
  const showAudioUpsell = isBraceletOwner && !isPro;

  /* Operator, 16 september 2026 ("er klopt vanalles niet als ik terug ga
     na minimizen, is sessie gestopt en als ik terug wil starten begint
     een andere timing"): root cause — sessionPlannedRef/sessionStartedAtRef
     /pausedAt zijn PUUR lokale component-state (useRef/useState), die bij
     een fresh mount (na minimize → terug via de pill) altijd op hun
     lege startwaarde beginnen. De hardware/sim-status geeft alleen
     current_mode + remaining_minutes terug (spec §8.2) — GEEN "totaal
     gepland"-veld — dus zonder deze rehydratie viel `planned` altijd
     terug op `duration` (de LOKALE, verse default-waarde voor de
     GEGOKTE mode), niet de echte gestarte duur. Vandaar "andere timing".
     Erger nog: een GEPAUZEERDE sessie is BLE-technisch al gestopt
     (spec §8.1 kent geen Pause-opcode — pause = een echte Stop +
     lokale pausedAt-boekhouding); zonder rehydratie van pausedAt zag
     een fresh mount dus een écht gestopte sessie en viel terug op Idle.

     Fix: bij mount ÉÉN keer de module-level bracelet-session-state
     snapshot lezen (dezelfde store die de BraceletMiniIndicator-pill
     voedt) — die overleeft een unmount, in tegenstelling tot refs/state
     hierin. Is er een actieve/gepauzeerde sessie bekend, dan hydrateren
     we selectedMode/duration/pausedAt + de refs hieruit i.p.v. vanaf
     nul/URL-defaults te starten. Puur-lezende call, geen effect nodig —
     wordt verderop gebruikt in de useState/useRef-initializers (die toch
     maar exact éénmaal, bij de eerste render, hun argument gebruiken) én
     in de preview-reset-effect direct hieronder. Bewust HIER gedeclareerd
     (vóór die effect) i.p.v. verderop bij initialMode — een const die pas
     later in de functie gedeclareerd wordt, is hier nog niet leesbaar. */
  const resumeSnapshot = (() => {
    const snap = getBraceletSessionSnapshot();
    return snap.active ? snap : null;
  })();
  /* Operator, 17 september 2026 ("2 à 3 seconden minder bij minimize"):
     resumeSnapshot.remainingSec komt uit de laatst-GEPUBLICEERDE
     snapshot, die pas bij elke monitor-tick (1x/seconde) ververst — dus
     tot een volle seconde verouderd, bovenop de echte tijd die de
     navigatie zelf kostte. getBraceletMonitorRemainingSec() rekent LIVE,
     exact op dit moment — sluit dat extra gat. Fallback op de snapshot
     zelf voor de (zeldzame) edge-case dat de monitor z'n eigen state om
     wat voor reden dan ook kwijt is maar de snapshot nog wel bestaat. */
  const resumeRemainingSec = resumeSnapshot
    ? (getBraceletMonitorRemainingSec() ?? resumeSnapshot.remainingSec)
    : 0;

  /* Iter 9dq v92 (2026-06-03): activation-state. Bracelet-owners die hun
     12-char code nog niet hebben ingevoerd zien op ELKE screen-variant
     (idle, searching, fault, charging) bovenaan een prominente
     "Activate your bracelet" CTA. Operator-rationale: "klant moet zelf
     activeren na sign-up — zolang bracelet niet gelinkt is, knop/link
     op de control-page". Tot activation is er geen echte bracelet aan
     het account gekoppeld; de preview-content blijft zichtbaar zodat
     user kan rondkijken vóór activatie. */
  const isActivated = useDevBraceletActivated();
  const showActivationPrompt = isBraceletOwner && !isActivated;

  /* Iter 9br → 9bx (2026-05-31): non-owner preview-entry komt altijd op
     idle binnen MET een gezonde sim-state. Was alleen Stop-sessie;
     uitgebreid omdat over meerdere test-sessies de simulated battery
     onder 5% kon zakken → spec §9 rule 3 → sim eindigt sessies premature
     na 1-2 min (= de "Boost 8 min werd 1-2 min completed" bug).
     Reset alles wat een sessie zou kunnen blokkeren:
       - Stop eventuele lopende sessie (sim state schoon)
       - Battery → 87% (verse start)
       - Fault → cleared
       - Charging → false
     Owners (echte sessies) NIET aanraken; voor hen is sim==null op
     real hardware sowieso, en in dev willen ze state-continuïteit.

     Operator, 16 september 2026 ("de sessie mag niet stoppen, u stopt
     dat knop"): deze reset vuurde ONVOORWAARDELIJK bij elke mount — ook
     wanneer een preview-gebruiker via de BraceletMiniIndicator-pill of
     Minimize terugkeerde naar een sessie die ze zelf net gestart hadden.
     Elke keer BraceletControl remountte (nieuwe push van /bracelet-
     control) stuurde dit dus meteen een Stop naar de nog lopende sessie
     — precies het "terugkeren = sessie sterft"-gedrag dat net gefixt
     moest worden.
     Eerste fix probeerde dit met een async requestStatus()-check op
     `sessionActive` — werkte niet voor een GEPAUZEERDE sessie: pause IS
     al een echte BLE Stop (spec §8.1 kent geen Pause-opcode), dus
     `sessionActive` staat dan al op false en de check zag "geen sessie"
     terwijl er wél een gepauzeerde sessie was. Nu de synchrone
     `resumeSnapshot` (hierboven, dezelfde bron die selectedMode/
     duration/pausedAt/refs hydrateert) — die dekt zowel actief als
     gepauzeerd correct, en heeft geen async-race met de eerste render. */
  useEffect(() => {
    if (isBraceletOwner) return;
    if (resumeSnapshot) return; // sessie (actief of gepauzeerd) — niet aankomen
    bracelet
      .sendCommand({
        mode: BraceletMode.Alpha,
        duration: 0,
        command: BleCommand.Stop,
      })
      .catch(() => {
        /* swallow — sim Stop is no-op als er geen sessie loopt */
      });
    /* Reset sim health zodat sessies hun volle ingestelde tijd
       uitdoen (geen battery-cut, geen fault-cut). */
    sim?.simSetBattery(87);
    sim?.simSetCharging(false);
    sim?.simClearFault();
    // Only fire once on mount per preview-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [conn, setConn] = useState<BleConnectionState>(
    bracelet.getConnectionState(),
  );
  /* Operator, 16 september 2026: "bij connected wil ik een popup-
     animatie met cirkel, vinkje en tekst 'Yes connected'" — korte,
     zelf-dismissende bevestiging bij een geslaagde connectie. */
  const [showConnectedPopup, setShowConnectedPopup] = useState(false);

  /* Query-params support — Free Breathwork CTA's op Audio/Bracelet tabs
     openen een chooser en navigeren hier met ?mode=0-4&breathwork=1.
     - mode      : initiële BraceletMode (0=Gamma/Boost t/m 4=Delta/Rest)
     - breathwork: indien "1" triggert de auto-connect + auto-start van de
                   bracelet-sessie zodat user direct op het Active-scherm
                   landt (i.p.v. eerst Connect → Start). De breathwork-
                   toggle blijft FALSE — user tapt zelf "Start" op de
                   breathwork-strip wanneer hij klaar is. Operator-feedback
                   2026-06-05: breathwork mag niet vanzelf beginnen.
     - plan      : Operator, 29 september 2026 ("set daily plan"): zelfde
                   auto-connect/auto-start/auto-pauze-sequentie als
                   `breathwork=1`, maar getriggerd door een bracelet-
                   dagplan-melding (reminders.ts's `reminderParams`) i.p.v.
                   de breathwork-strip. `duration` erbij — anders gebruikt
                   de auto-start altijd de modus-default, wat de duur uit
                   het dagplan zou negeren. */
  const params = useLocalSearchParams<{
    mode?: string;
    breathwork?: string;
    plan?: string;
    duration?: string;
    from?: string;
    open?: string;
  }>();
  /* Audit 5 okt 2026: parameters van een link (plan / Audio Library /
     melding) blijven op de tab-route hangen. Ze gelden enkel voor de ÉÉN
     opening die ze meebracht (uniek `open`-token, zie openStateControl) —
     anders startte elke latere intro→Explore opnieuw een sessie, en bleef
     de terugpijl naar het plan/de bibliotheek wijzen. */
  const [freshLink] = useState(() => {
    const token = typeof params.open === 'string' ? params.open : undefined;
    if (!token || handledLinkTokens.has(token)) return false;
    handledLinkTokens.add(token);
    return true;
  });

  const initialMode: BraceletMode = (() => {
    if (resumeSnapshot) return resumeSnapshot.mode as BraceletMode;
    const raw = freshLink ? params.mode : undefined;
    if (typeof raw === 'string') {
      const n = parseInt(raw, 10);
      if (n >= 0 && n <= 4) return n as BraceletMode;
    }
    return suggestBraceletMode(new Date());
  })();
  /* Plan-starts (melding, plan-link) lopen nu via de link-effect verderop
     (startStateControlNow) — die werkt ook als dit scherm al open stond
     (audit 5 okt 2026). Enkel de breathwork-strip gebruikt nog dit pad. */
  const autoStartBracelet =
    freshLink && !resumeSnapshot && params.breathwork === '1';
  /* Enkel gezet bij een dagplan-tik — auto-start gebruikt anders gewoon de
     modus-default (zie de auto-start-effect verderop). */
  const planDurationMinutes: number | null = (() => {
    if (!freshLink || params.plan !== '1' || typeof params.duration !== 'string') return null;
    const n = parseInt(params.duration, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  /* Operator-feedback 2026-06-05: bij CTA-flow vanuit Audio of Bracelet
     tab is het onduidelijk waarheen de back-knop terug gaat. Met `from`
     param maken we de back-knop context-aware: "Audio Library" of
     "Bracelet" als label + navigatie naar de juiste tab. */
  /* Operator, 1 okt 2026 ("back vanuit bracelet control komt op de
     connect-pagina, niet ok"): de "Try it"-deeplink vanuit bracelet-
     agenda.tsx (`?plan=1&mode=X&duration=Y`) zette nooit een `from`,
     dus de back-knop viel terug op het owner/inline-gedrag (disconnect
     + terugvallen naar het zoek/connect-scherm van DEZELFDE instance —
     geen echte navigatie). `plan` is een derde context: user kwam hier
     via een pushed route vanuit "Your bracelet plan" en hoort daar met
     router.back() op terug te landen, niet op het connect-scherm. */
  /* Audit 5 okt 2026: één terug-regel in State Control — terug = sessie
     minimaliseren / naar het intro, ongeacht vanwaar je kwam. De link-
     afhankelijke terugknoppen ("Audio Library", "Bracelet") stuurden naar
     het scherm waar je al was of naar een andere plek dan hun label; ze
     zijn uitgeschakeld (altijd null). */
  const fromContext = null as 'audio' | 'bracelet' | 'plan' | null;

  const [selectedMode, setSelectedMode] = useState<BraceletMode>(initialMode);
  const meta = getModeMeta(selectedMode);
  const [duration, setDuration] = useState<number>(
    resumeSnapshot
      ? Math.max(1, Math.round(resumeSnapshot.totalSec / 60))
      : meta.defaultMinutes,
  );
  /* Operator, 17 september 2026 ("zie ik eerst heel kort choose mode,
     mag niet"): `status` bleef `null` bij een fresh mount TOTDAT de
     eerste BLE-poll terugkwam (tientallen ms) — de render-branch die
     ActiveSessionScreen kiest vereist EXPLICIET `... && status` (zie de
     render-branches onderaan), dus die ene null-frame viel altijd terug
     op IdleScreen ("Choose mode"), zichtbaar als een korte flits vóór
     Active alsnog verscheen. Zelfde soort gat als eerder bij
     sessionPlannedRef/sessionStartedAtRef — nu ook `status` synchroon
     hydrateren uit resumeSnapshot, zodat de allereerste render al
     rechtstreeks naar ActiveSessionScreen gaat. battery/charging/fault
     zijn niet in de snapshot bewaard (niet relevant voor deze render-
     beslissing) — onschuldige defaults, de eerste echte poll (die
     hierna nog steeds meteen vuurt) corrigeert ze binnen milliseconden. */
  const [status, setStatus] = useState<BleStatusPacket | null>(() =>
    resumeSnapshot
      ? {
          sessionActive: !resumeSnapshot.paused,
          /* v2.4-veld — deze hydratie-snapshot gebruikt nog de oude
             pause-is-een-Stop-semantiek (zie ble-contract.ts-toelichting),
             dus altijd false hier; de eerste echte poll erna corrigeert
             dit zodra bracelet-control.tsx zelf naar CMD_PAUSE/RESUME
             omgebouwd wordt. */
          sessionPaused: false,
          currentMode: resumeSnapshot.mode as BraceletMode,
          remainingMinutes: Math.max(0, Math.ceil(resumeRemainingSec / 60)),
          batteryPercent: 100,
          charging: false,
          fault: false,
        }
      : null,
  );
  const [busy, setBusy] = useState(false);
  /* Iter v149 v4 (2026-06-25): voice-cues toggle direct op de active-
     session view zodat user 'm ter plekke kan dimmen (operator-feedback:
     'in het blok heel duidelijk' — niet verstopt in Settings). Sync via
     useSetting → globale single source of truth, ook respected door
     breath-tab en Settings menu. */
  const [voiceCues, setVoiceCues] = useSetting('voiceCues');
  /* Operator, 29 september 2026 ("een echte pagina... na connect, bij
     eerste connectie door klant, soort onboarding"): zie de
     connection-change-listener verderop. */
  const [braceletOnboardedAt] = useSetting('braceletOnboardingCompletedAt');

  /* Iter v209 (2026-07-04): endSessionVisible state weg — geen modal meer. */

  /* Pause-state — BLE-contract kent geen native Pause (spec §8.1: alleen
     Start/Stop). Pseudo-pause werkt zo:
       - onPause()  : BLE Stop verzonden, `pausedAt` opslaan met
                      `status.remainingMinutes`. UI blijft op active-
                      view via de `isPaused || sessionActive`-check.
       - onResume() : BLE Start verzonden met clamped `pausedAt` als
                      nieuwe duration; pausedAt op null gezet.
       - onEnd()    : BLE Stop + pausedAt op null → idle-screen.
     De gebruiker ervaart 't als pause; fysiek is 't een korte stop +
     restart op de resterende minuten. Operator-keuze 2026-05-27.
     Gehydrateerd uit resumeSnapshot als de sessie al gepauzeerd was
     vóór deze mount (zie hierboven) — anders zou terugkeren na minimize
     tijdens een pauze op Idle belanden (BLE-status toont sessionActive
     false, want pause IS al een echte Stop). */
  const [pausedAt, setPausedAt] = useState<number | null>(
    resumeSnapshot?.paused
      ? Math.max(1, Math.ceil(resumeRemainingSec / 60))
      : null,
  );
  /* BRON VAN WAARHEID = de sessie-monitor (audit 5 okt 2026). Dit scherm
     leidde "loopt er een sessie / is ze gepauzeerd" af uit zijn eigen
     staat en de (gesimuleerde) bracelet-status. Na een herstel van de
     monitor (app herladen of door Android opgeruimd) liep de sessie wel —
     pill, vergrendelscherm, trillingen — maar toonde dit scherm "Start
     Boost" en opende de pill de moduskeuze. Nu volgt het scherm de monitor;
     de bracelet-status levert enkel nog batterij/fout/laden. */
  const [monitorSnap, setMonitorSnap] = useState(getBraceletSessionSnapshot());
  useEffect(() => subscribeBraceletSession(setMonitorSnap), []);
  const isPaused = USE_SIMULATED_BLE
    ? monitorSnap.active && monitorSnap.paused
    : pausedAt !== null;

  /* Herstelde (of elders gestarte) sessie: de eigen refs van dit scherm
     — duur, start, pauzepositie — gelijkzetten met de monitor, zodat de
     teller, voortgang en pauze/hervat kloppen. */
  useEffect(() => {
    if (!monitorSnap.active) return;
    const plannedMin = Math.round(monitorSnap.totalSec / 60);
    const elapsedMs = Math.max(0, monitorSnap.totalSec - monitorSnap.remainingSec) * 1000;
    if (sessionPlannedRef.current !== plannedMin || sessionStartedAtRef.current === null) {
      sessionPlannedRef.current = plannedMin;
      sessionStartedAtRef.current = Date.now() - elapsedMs;
      const startedIso = getBraceletMonitorSession()?.startedAtIso;
      sessionRealStartedAtRef.current = startedIso ? Date.parse(startedIso) : Date.now() - elapsedMs;
    }
    if (monitorSnap.paused) {
      if (pausedAt === null) {
        pausedAtElapsedMsRef.current = elapsedMs;
        setPausedAt(Math.max(1, Math.ceil(monitorSnap.remainingSec / 60)));
      }
    } else if (pausedAt !== null && USE_SIMULATED_BLE) {
      setPausedAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitorSnap.active, monitorSnap.paused, monitorSnap.totalSec]);

  /* Eén plek voor "sluit de lopende sessie af en registreer 'm" (operator-
     audit, 13 augustus 2026) — deze logica stond bijna identiek 3x
     uitgeschreven: bij natuurlijk aflopen, bij manual End, en bij Restart.
     Drie kopieën van dezelfde berekening is drie plekken die uit de pas
     kunnen lopen zodra er ooit een veld of regel bijkomt. `isPaused` dekt
     ook het natural-completion-geval correct: die pad loopt alleen als
     `pausedAt === null`, dus `isPaused` is daar toch al `false`. Refs op
     null zetten is voor Restart onschadelijk — die overschrijft ze meteen
     erna met de nieuwe sessie. Geeft `null` terug als er niets liep. */
  const finishSession = useCallback(
    (finalStatus: SessionStatus) => {
      const startedAt = sessionStartedAtRef.current;
      if (startedAt === null) return null;
      const realStartedAt = sessionRealStartedAtRef.current ?? startedAt;
      sessionStartedAtRef.current = null;
      sessionRealStartedAtRef.current = null;
      const elapsedMs = isPaused
        ? pausedAtElapsedMsRef.current
        : Date.now() - startedAt;
      const elapsedMin = Math.max(1, Math.round(elapsedMs / 60000));
      /* De modus die ECHT liep (monitor), niet wat er nu op de moduskeuze
         aangetikt staat — audit 5 okt 2026 (bv. bij "Switch to …"). */
      const running = getBraceletMonitorSession();
      const runMode = (running?.mode ?? selectedMode) as BraceletMode;
      recordSession({
        mode: runMode,
        startedAt: running?.startedAtIso ?? new Date(realStartedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationMin: elapsedMin,
        plannedMin: running
          ? Math.max(1, Math.round(running.totalSec / 60))
          : clampDuration(runMode, duration),
        status: finalStatus,
      });
      return elapsedMin;
    },
    [isPaused, selectedMode, duration],
  );

  /* Completion-modal — toont mode-specifieke felicitatie zodra een
     sessie natuurlijk afloopt (timer hits 0). Niet bij manual End,
     niet bij Restart. Bewaart welke mode 'voltooid' werd zodat de
     juiste copy + kleur uit COMPLETION_MESSAGES wordt gerendered. */
  const [completedModeForModal, setCompletedModeForModal] =
    useState<BraceletMode | null>(null);
  /* Duur van de voltooide sessie, voor de afsluiting (5 okt 2026). */
  const [completedMinutes, setCompletedMinutes] = useState<number | null>(null);
  /* Operator, 5 okt 2026 ("back-knop van telefoon vanuit session active —
     ook als de sessie loopt — moet ALTIJD naar choose mode van state
     control, ook bij minimize; van daaruit kiest de gebruiker via de tabs
     onderaan"): geminimaliseerd = de moduskeuze tonen terwijl de sessie
     doorloopt, met een "nu bezig"-balk om terug te keren. */
  const [minimized, setMinimized] = useState(false);
  /* Een nieuwe opening van buitenaf (melding, pill, "Session complete")
     toont de lopende sessie, ook als ze eerder geminimaliseerd werd — dit
     scherm blijft daarbij gemount, dus de minimaliseerstand bleef anders
     staan (audit 5 okt 2026). */
  useEffect(() => {
    if (params.open) setMinimized(false);
  }, [params.open]);
  /* Stabiele referentie (audit): een nieuwe functie per render liet het
     sessiescherm z'n terugknop-koppeling en de tabbalk-vlag elke seconde
     opnieuw zetten. */
  const minimizeSession = useCallback(() => setMinimized(true), []);

  /* Iter 9k: mode-detail popup terug op state-cards. Tap card opent
     bottom-sheet met "intent / bracelet / breath / use this for"
     en expliciete Choose-CTA om te selecteren. Geen schuif-panel
     meer onder de cards. */
  const [detailModeForModal, setDetailModeForModal] =
    useState<BraceletMode | null>(null);

  /* Track wanneer de huidige sessie begon (lokaal in component, niet
     persistent). Wordt gezet bij eerste onStart, gewist bij onStop.
     Bij pause/resume blijft de waarde staan zodat de totale doorlopen
     tijd correct geboekt wordt bij eind. Voor stats.
     Gehydrateerd uit resumeSnapshot (zie hierboven) wanneer we een AL
     lopende (niet-gepauzeerde) sessie herontdekken na een fresh mount —
     reconstrueert de wall-clock start uit total/remaining zodat de
     lokale seconden-tik meteen weer klopt i.p.v. null te blijven. */
  /* Audit 5 okt 2026: ook bij een GEPAUZEERDE sessie hydrateren — anders
     sloeg finishSession (null-check) het opslaan in de geschiedenis over
     als je een gepauzeerde sessie na wegnavigeren beëindigde. */
  const sessionStartedAtRef = useRef<number | null>(
    resumeSnapshot
      ? Date.now() - (resumeSnapshot.totalSec - resumeRemainingSec) * 1000
      : null,
  );

  /* Geplande duration van de huidige sessie — gebruikt voor de
     progress-arc rond de timer en de "of X total"-context-regel.
     Gezet bij onStart/onRestart, niet relevant op idle.
     Gehydrateerd uit resumeSnapshot.totalSec — dit is EXACT de bug uit
     "als ik terug wil starten begint een andere timing": zonder deze
     hydratie bleef deze ref op 0 staan na een fresh mount, en viel
     ActiveSessionScreen's `planned`-berekening terug op de LOKALE
     `duration`-default (de default van de GEGOKTE mode) i.p.v. de
     werkelijk gestarte duur. */
  const sessionPlannedRef = useRef<number>(
    resumeSnapshot ? Math.max(1, Math.round(resumeSnapshot.totalSec / 60)) : 0,
  );

  /* Iter 9be (2026-05-31): exact-elapsed-bij-pause ref. BLE-status geeft
     alleen minuten — display van pausedAt liep daardoor mm:00 ipv mm:ss
     en gaf een visuele backwards-jump op press. Hier vangen we de exact
     elapsed-ms vóór de async BLE Stop, zodat het tijdens pauze op
     EXACT het press-moment blijft hangen (geen jump, geen rounding).
     Gehydrateerd uit resumeSnapshot zodat een herontdekte gepauzeerde
     sessie ook meteen het juiste "elapsed op pauze-moment" heeft. */
  const pausedAtElapsedMsRef = useRef<number>(
    resumeSnapshot
      ? (resumeSnapshot.totalSec - resumeRemainingSec) * 1000
      : 0,
  );

  /* Iter 9bj (2026-05-31): ECHTE wall-clock start (onaangetast door
     re-anchor op resume). sessionStartedAtRef wordt op resume virtueel
     gemaakt (Date.now() - exactElapsedMs) zodat de lokale display-timer
     vanaf de pause-tijd doortikt. Maar voor history's startedAt-ISO
     willen we de echte tijd dat de user de sessie startte.
     Bij een hydratie uit resumeSnapshot kennen we de ECHTE originele
     starttijd niet meer (die ging verloren met de vorige instance) —
     de gereconstrueerde tijd is het beste beschikbare alternatief, dus
     zelfde waarde als sessionStartedAtRef hierboven. */
  const sessionRealStartedAtRef = useRef<number | null>(
    resumeSnapshot
      ? Date.now() - (resumeSnapshot.totalSec - resumeRemainingSec) * 1000
      : null,
  );

  /* Live stats voor de strip — refresht zichzelf via listener-set in
     bracelet-history.ts wanneer een nieuwe sessie wordt vastgelegd. */
  const stats = useBraceletStats();
  /* Mode-gefilterde stats voor de active-screen: tijdens een Boost-
     sessie zie je je Boost-track-record, niet totaal-alle-modes. Hook
     wordt altijd aangeroepen (rules of hooks), gebruikt selectedMode
     als filter — de getoonde waarden zijn alleen relevant op active. */
  const modeStats = useBraceletStats(selectedMode);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /* Stale-status detection — wanneer de poll meer dan STALE_FAIL_TICKS
     opeenvolgende keren faalt (= STALE_FAIL_TICKS × POLL_MS / 1000 sec
     geen status-update), tonen we een indicator dat de getoonde data
     mogelijk niet meer accuraat is. Zonder dit weet user niet of de
     battery/remaining die op het scherm staat nog klopt of bevroren is. */
  const pollFailsRef = useRef(0);
  const [staleStatus, setStaleStatus] = useState(false);

  /* Connection state subscription. Detecteert ook de transitie NAAR
     'connected' (vanuit een andere state) om de bevestigings-popup te
     triggeren — niet bij een render die toevallig al 'connected' was. */
  const prevConnRef = useRef<BleConnectionState>(conn);
  useEffect(() => {
    const off = bracelet.onConnectionChange((next) => {
      if (next === 'connected' && prevConnRef.current !== 'connected') {
        /* Operator, 29 september 2026 ("een echte pagina die voor de
           bracelet-control pagina komt, na connect, bij eerste connectie
           door klant, soort onboarding"): de EERSTE keer ooit dat deze
           gebruiker verbindt, gaat 'ie naar /bracelet-set-day i.p.v. de
           gewone "Yes, connected!"-popup + idle-scherm. Nadien (tweede
           connectie en verder) gewoon het bestaande gedrag. */
        /* Audit 5 okt 2026: het STILLE verbinden van de State Control-tab
           (autoConnect) is geen "eerste bracelet-koppeling" — geen
           onboarding-doorverwijzing en geen "Yes, connected!"-popup; anders
           belandde elke nieuwe gebruiker bij zijn eerste bezoek in het
           bracelet-plan, en verscheen de popup na het stille verbinden. */
        if (autoConnect) {
          /* niets — stil verbonden */
        } else if (braceletOnboardedAt === null) {
          /* Operator, 30 september 2026 ("na Set your plan land ik op de
             Bracelet-tab se welkomstscherm, is dat correct?"): nee — deze
             route verving bracelet-control al via `replace` (geen
             geschiedenis-entry meer), dus Set your plan se `router.back()`
             sprong door naar de Bracelet-TAB, waar `useFocusEffect` de
             volledige "Smart Bead Bracelet"-intro-overlay elke keer opnieuw
             toont bij focus — een gebruiker die zonet zijn eerste plan
             opsloeg zag zo weer het allereerste marketing-scherm, alsof er
             niets gebeurd was.
             Vervolg ("teruggaan naar connected ook niet juist, ik heb al
             connect gedaan vóór de instelling van planning"): eerste
             oplossing stuurde terug naar DIT scherm — ook fout, de
             gebruiker zag dit verbind-scherm al vóór Set your plan, dus
             nog eens tonen voelt als terugspoelen. `?onboarding=1` laat
             Set your plan zelf naar `/bracelet-agenda` navigeren (het
             net-opgeslagen plan bekijken — de échte volgende stap na
             "verbinden + plan bouwen"), zie de toelichting daar. */
          router.replace('/bracelet-set-day?onboarding=1' as never);
        } else if (fromContext !== 'plan') {
          /* Operator, 1 okt 2026 ("vanuit de agenda sessie starten komt
             nu in yes you are connected, dat mag niet"): "Try it"/"Start
             session" vanuit Your bracelet plan (`from=plan`) is een snel,
             herhaald actie-moment, geen eerste-verbinding-mijlpaal — de
             marketing-bevestigingspopup hoort daar niet thuis, enkel bij
             een echte, bewuste Connect-tik. */
          setShowConnectedPopup(true);
        }
      }
      prevConnRef.current = next;
      setConn(next);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bracelet, braceletOnboardedAt, autoConnect]);

  /* When mode changes, reset duration to that mode's default (spec §11.2
     — operator, 16 september 2026: officiële tabel, default is niet meer
     altijd gelijk aan het minimum). */
  /* Niet bij de eerste render: dan staat de duur al juist (bv. hersteld uit
     een lopende sessie) en zou deze effect hem overschrijven (audit 5 okt
     2026). Enkel bij een echte moduswissel. */
  const modeEffectMountedRef = useRef(false);
  useEffect(() => {
    if (!modeEffectMountedRef.current) {
      modeEffectMountedRef.current = true;
      return;
    }
    setDuration(getModeMeta(selectedMode).defaultMinutes);
  }, [selectedMode]);

  /* Detecteer natural completion — sessionActive transitie true → false
     ZONDER dat user End/Pause/Restart heeft gedrukt. In die gevallen
     wordt sessionStartedAtRef expliciet door de handler gewist; bij
     natural completion blijft 'ie staan en deze useEffect record 'm. */
  const prevSessionActiveRef = useRef<boolean>(false);
  /* Iter v197 (2026-07-04): endedLocally — lokale flag die derived
     sessionActive overrulet als user End tikte. Zonder deze flag bleef de
     5s-poll status.sessionActive=true zetten als de sim niet meteen Stop
     verwerkte. Reset bij nieuwe Start/Restart.

     VERPLAATST naar boven het effect dat hem leest (audit, 8 augustus
     2026): hij stond er 400 regels ONDER, dus de deps-lijst las hem op het
     eerste render vóór zijn declaratie — TypeScript meldde het terecht, en
     dat het toch werkte was transpiler-geluk, geen correctheid. */
  const [endedLocally, setEndedLocally] = useState(false);

  /* Pauze/hervat vanaf het vergrendelscherm (5 okt 2026): de monitor en de
     bracelet zijn al bijgewerkt; dit scherm zet enkel zijn eigen weergave
     gelijk, met dezelfde refs als onPause/onResume. */
  useEffect(
    () =>
      subscribeRemoteControl((c) => {
        /* Stop vanaf het horloge (6 okt 2026): exact de End-knop. */
        if (c.action === 'stop') {
          void onStopRef.current?.();
          return;
        }
        const elapsedMs = Math.max(0, sessionPlannedRef.current * 60 - c.remainingSec) * 1000;
        if (c.action === 'pause') {
          pausedAtElapsedMsRef.current = elapsedMs;
          setPausedAt(Math.max(1, Math.ceil(c.remainingSec / 60)));
        } else {
          sessionStartedAtRef.current = Date.now() - elapsedMs;
          pausedAtElapsedMsRef.current = 0;
          setEndedLocally(false);
          setPausedAt(null);
        }
        void bracelet.requestStatus().then(setStatus).catch(() => {});
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* GEWIJZIGD 5 okt 2026 (audit): het natuurlijke einde wordt niet meer
     HIER afgeleid uit de bracelet-status (die bij hervatten tot het modus-
     minimum doorloopt, en die enkel werkt zolang dit scherm gemount is).
     De sessie-monitor beslist, bewaart de geschiedenis en meldt het einde;
     dit scherm toont enkel de afsluiting — meteen, of bij de eerstvolgende
     mount als het einde viel terwijl State Control niet in beeld was.
     Geen geluid (operator, juli 2026: vergaderingen); het eind-signaal zit
     in de trilling. Zonder native module (iOS) geeft expo-haptics de tik. */
  useEffect(() => {
    const show = (c: SessionCompletion) => {
      dismissCompletionNotice();
      sessionStartedAtRef.current = null;
      sessionRealStartedAtRef.current = null;
      setMinimized(false);
      setCompletedMinutes(c.minutes);
      setCompletedModeForModal(c.mode);
      /* Na Done staat het keuzescherm op de toestand die je net deed
         (ook na Quick Chill/Boost), niet op een eerdere keuze. */
      setSelectedMode(c.mode);
      setDuration(getModeMeta(c.mode).defaultMinutes);
      if (!hasNativeWaveform()) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      void bracelet.requestStatus().then(setStatus).catch(() => {});
    };
    const pending = consumePendingCompletion();
    if (pending) show(pending);
    return subscribeSessionCompletion((c) => {
      consumePendingCompletion();
      show(c);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Poll status every 5s while connected (spec §8.3/§11.4).
     Tracking opeenvolgende fouten → na 3× falen (15s) markeren we de
     status als 'stale' zodat de UI dat kan tonen ipv stille rot. */
  const STALE_FAIL_TICKS = 3;
  useEffect(() => {
    if (conn !== 'connected') {
      if (pollRef.current) clearInterval(pollRef.current);
      pollFailsRef.current = 0;
      setStaleStatus(false);
      return;
    }
    let alive = true;
    const tick = async () => {
      try {
        const st = await bracelet.requestStatus();
        if (!alive) return;
        setStatus(st);
        pollFailsRef.current = 0;
        setStaleStatus(false);
      } catch {
        if (!alive) return;
        pollFailsRef.current += 1;
        if (pollFailsRef.current >= STALE_FAIL_TICKS) {
          setStaleStatus(true);
        }
      }
    };
    tick();
    pollRef.current = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [conn, bracelet]);

  /* ── Action handlers ────────────────────────────────────────────── */
  const onConnect = async () => {
    setBusy(true);
    try {
      await bracelet.connect();
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    try {
      await bracelet.disconnect();
    } finally {
      setBusy(false);
    }
  };

  /* Context-aware back voor Free Breathwork CTA-flow (operator-feedback
     2026-06-05). Bij `from=audio` of `from=bracelet` willen we de user
     terugleiden naar de bronpagina i.p.v. naar de connect-state of een
     willekeurige plek in de history.
     - navigateBackToSource: alleen navigeren (voor Connect-screen, geen
       bracelet om te disconnecten).
     - disconnectAndBackToSource: eerst disconnect (clean stop) → daarna
       navigeren (voor Active-screen).
     Bij geen fromContext gedraagt alles zich exact zoals voorheen. */
  /* Operator, 1 okt 2026 ("liever tab root, user komt vanuit plan. als
     die wil kan die vanuit tab terug naar zijn plan"): eerste versie
     liet 'plan' terug-navigeren naar bracelet-agenda zelf (router.back()
     — zie de git-geschiedenis van deze toelichting). Operator koos
     bewust voor de tab-root i.p.v. de pushende pagina: na Start
     session/End session is de gebruiker "klaar" met dat uitstapje en
     mag 'ie meteen verder door de tabbar (Audio/Account) — terug naar
     "Your bracelet plan" blijft gewoon één tik verder bereikbaar vanuit
     de Bracelet-tab zelf. 'plan' gedraagt zich dus nu identiek aan
     'bracelet'. */
  const navigateBackToSource = () => {
    if (fromContext === 'audio') router.navigate('/(tabs)/' as never);
    else if (fromContext === 'bracelet' || fromContext === 'plan') router.navigate('/(tabs)/bracelet' as never);
  };
  const disconnectAndBackToSource = async () => {
    /* Iter 2026-06-05 v2: per BLE spec §8 stopt disconnect alleen de
       BLE-verbinding — niet de bracelet-sessie zelf (die loopt autonoom
       op hardware-timer door). Voor CTA-flow willen we dat user terug
       gaat ÉN de bracelet stopt. Dus eerst Stop-command (via onStop)
       die de hardware-timer afbreekt, daarna disconnect. */
    try {
      await onStop();
    } catch (_e) { /* ignore: connect may already have failed */ }
    await onDisconnect();
    if (fromContext === 'audio') router.navigate('/(tabs)/' as never);
    else if (fromContext === 'bracelet' || fromContext === 'plan') router.navigate('/(tabs)/bracelet' as never);
  };

  /* Iter 2026-06-05: label naast back-arrow afgeleid uit fromContext.
     Undefined → BraceletHeader toont alleen "←" (bestaand gedrag). */
  const ctaBackLabel = fromContext === 'audio' ? 'Audio Library'
                     : fromContext === 'bracelet' || fromContext === 'plan' ? 'Bracelet'
                     : undefined;

  /* Auto-connect + auto-start voor Free Breathwork CTA-flow.
     Wanneer user landt met ?breathwork=1 willen we niet dat hij eerst
     het "Bracelet connect" zoek-scherm moet doorlopen + handmatig Start
     moet tappen. Vuur op mount één keer: connect (indien nodig) →
     sendCommand Start. Daarna gaat de render-branch automatisch naar
     het Active-scherm. De breathwork-strip toont onderaan in idle-state
     met een "Start"-knop — user start breathwork zelf wanneer klaar. */
  /* Operator, 5 okt 2026: State Control-sessies zitten achter de paywall,
     samen met breathwork en audio als één pakket. Ontgrendeld met het
     abonnement (ook tijdens de trial) of een geactiveerde bracelet. Tijdens
     het laden niet op slot, anders flitst de paywall bij een betalende
     gebruiker. Feel it (30 s) blijft voor iedereen. */
  const subscription = useSubscription();
  /* useBraceletOwner volgt ook de dev-override (Settings → Developer →
     Simulate user type), net als isPro — zo is elk gebruikerstype testbaar. */
  const ownsBracelet = useBraceletOwner();
  const [testFullSessions] = useSetting('testFullSessions');
  const sessionsLocked =
    !subscription.isLoading &&
    !subscription.isPro &&
    !ownsBracelet &&
    !(__DEV__ && testFullSessions);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const autoStartFiredRef = useRef(false);
  /* De link-intentie bij mount vasthouden: de effect kan later pas lopen
     (abonnementsstatus laadt nog) wanneer de link al als verwerkt telt. */
  const autoStartWantedRef = useRef(autoStartBracelet);
  const [autoStartFailed, setAutoStartFailed] = useState(false);
  useEffect(() => {
    if (autoStartFiredRef.current) return;
    if (!autoStartWantedRef.current) return;
    /* Abonnementsstatus nog aan het laden: wachten, niet gokken. */
    if (subscription.isLoading) return;
    autoStartFiredRef.current = true;
    if (sessionsLocked) {
      /* Plan/breathwork-link zonder abonnement: niet stil starten, de
         paywall tonen (operator, 5 okt 2026). */
      setPaywallOpen(true);
      return;
    }

    (async () => {
      try {
        if (bracelet.getConnectionState() !== 'connected') {
          await bracelet.connect();
        }
        const dur = clampDuration(
          initialMode,
          planDurationMinutes ?? getModeMeta(initialMode).defaultMinutes,
        );
        /* Iter v200: endedLocally reset op autoStart. */
        setEndedLocally(false);
        await bracelet.sendCommand({
          mode: initialMode,
          duration: dur,
          command: BleCommand.Start,
        });
        const startMs = Date.now();
        sessionStartedAtRef.current = startMs;
        sessionRealStartedAtRef.current = startMs;
        sessionPlannedRef.current = dur;
        /* Iter 2026-06-05: auto-pause direct na auto-start (operator-
           feedback: in free/CTA-flow mag de bracelet-timer niet vanzelf
           aftellen — user kwam voor breathwork, niet voor een bracelet-
           sessie). Sessie wordt geladen op 8:00, klaar om Resume te
           tappen wanneer user wil. Mimics onPause: Stop-command +
           setPausedAt = volledige geplande duration (niets verstreken). */
        pausedAtElapsedMsRef.current = 0;
        await bracelet.sendCommand({
          mode: initialMode,
          duration: 0,
          command: BleCommand.Stop,
        });
        setPausedAt(dur);
        startBraceletSessionMonitor({ mode: initialMode, totalSec: dur * 60 });
        pauseBraceletSessionMonitor();
        const st = await bracelet.requestStatus();
        setStatus(st);
      } catch (e) {
        console.warn('[bracelet-control] auto-start failed:', e);
        /* Operator, 1 okt 2026 ("verschijnt eerst bracelet connect
           pagina"): bij een falende auto-connect NIET eindeloos op de
           lichte loader blijven hangen — terugvallen op het normale
           zoek-scherm (met eigen Retry-knop) i.p.v. een dode lege loader. */
        setAutoStartFailed(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription.isLoading]);

  /* Elke NIEUWE link (uniek `open`-token) — ook als dit scherm al open
     stond, waar de eenmalige `freshLink`-logica hierboven niets meer doet
     (audit 5 okt 2026: een plan-melding toonde dan enkel de moduskeuze).
     - plan-start (melding/plan): sessie meteen starten via de monitor,
       of de paywall zonder toegang — exact zoals "Tap to start";
     - enkel een modus: die modus (en zijn standaardduur) klaarzetten. */
  const lastLinkTokenRef = useRef<string | null>(null);
  useEffect(() => {
    const token = typeof params.open === 'string' ? params.open : null;
    if (!token || lastLinkTokenRef.current === token) return;
    const rawMode = typeof params.mode === 'string' ? Number(params.mode) : NaN;
    /* Audit 8 okt 2026: enkel een geldige toestand 0–4 — mode=7 in een link
       liet het scherm crashen (getModeMeta(7) bestaat niet). */
    const modeNum = Number.isInteger(rawMode) && rawMode >= 0 && rawMode <= 4 ? rawMode : NaN;
    if (params.plan === '1' && Number.isFinite(modeNum)) {
      if (subscription.isLoading) return; // wachten, de effect loopt opnieuw
      lastLinkTokenRef.current = token;
      if (sessionsLocked) {
        setPaywallOpen(true);
        return;
      }
      const m = modeNum as BraceletMode;
      const d = Number(params.duration) || getModeMeta(m).defaultMinutes;
      void startStateControlNow(m, d);
      return;
    }
    lastLinkTokenRef.current = token;
    if (Number.isFinite(modeNum) && !isBraceletSessionMonitorActive() && params.breathwork !== '1') {
      const m = modeNum as BraceletMode;
      setSelectedMode(m);
      setDuration(getModeMeta(m).defaultMinutes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.open, subscription.isLoading]);

  /* Stil auto-connect voor `autoConnect` (4 okt 2026, State Control-
     intro) — enkel VERBINDEN, geen sessie starten zoals autoStartBracelet
     hierboven doet. Landt op Idle met een lege modus-keuze, niet op een
     vooraf-geladen gepauzeerde sessie. */
  /* 5 okt 2026: niet meer één keer per mount — telkens de verbinding
     'disconnected' is opnieuw verbinden. Eén poging liet het scherm na een
     herlaad of een verbroken verbinding eindeloos op "Connecting…" hangen. */
  useEffect(() => {
    if (!autoConnect) return;
    if (conn === 'disconnected') {
      void bracelet.connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, conn]);

  const onStartGated = () => {
    /* Toegang nog onbekend (koude start, traag netwerk): niets doen i.p.v.
       een sessie te starten die achteraf niet toegestaan blijkt. */
    if (subscription.isLoading) return;
    if (sessionsLocked) {
      setPaywallOpen(true);
      return;
    }
    void onStart();
  };

  const onStart = async () => {
    setBusy(true);
    /* Iter v197 (2026-07-04): endedLocally reset — nieuwe sessie mag niet
       geblokkeerd worden door de flag van een vorige End. */
    setEndedLocally(false);
    try {
      const dur = clampDuration(selectedMode, duration);
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: dur,
        command: BleCommand.Start,
      });
      /* Track wanneer de sessie begon — gebruikt voor stats-recording
         bij eind. Wordt over pauses heen behouden zodat de hele
         sessie als 1 entry wordt vastgelegd.
         Iter 9bj (2026-05-31): zowel sessionStartedAtRef (display, kan
         re-anchoren op resume) als sessionRealStartedAtRef (echte
         wall-clock, voor history-ISO) op nu zetten. */
      const startMs = Date.now();
      sessionStartedAtRef.current = startMs;
      sessionRealStartedAtRef.current = startMs;
      sessionPlannedRef.current = dur;
      /* Iter v147 (2026-06-25): voice-cue bij sessie-start. SessionKey
         = mode-duration-startMs zodat opeenvolgende sessies elk hun
         eigen cue krijgen (idempotent voor poll-renders binnen 1
         sessie). */
      playBraceletStartCue(selectedMode, `${selectedMode}-${dur}-${startMs}`);
      /* Operator, 27 september 2026 ("de sessie moet pas starten nadat
         gebruiker op play drukt"): Start liet de hardware-timer tot nu
         toe meteen actief aftellen — de gebruiker kwam op het Active-
         scherm terecht met de sessie al lopend, zonder ooit zelf op
         Play/Resume te hebben gedrukt. Zelfde patroon als de bestaande
         Free-Breathwork-auto-start hierboven: direct na Start een Stop-
         command sturen (pausedAtElapsedMsRef=0, dus NIETS verstreken) en
         `pausedAt` op de volle geplande duur zetten — de gebruiker landt
         zo op een GEPAUZEERD Active-scherm en moet zelf op Resume/Play
         tikken om de aftelling echt te starten. */
      pausedAtElapsedMsRef.current = 0;
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: 0,
        command: BleCommand.Stop,
      });
      setPausedAt(dur);
      /* Operator, 17 september 2026: start de mount-onafhankelijke
         achtergrond-monitor (lockscreen-melding + live pill-updates,
         blijft draaien ongeacht welk scherm/tab zichtbaar is). */
      startBraceletSessionMonitor({ mode: selectedMode, totalSec: dur * 60 });
      pauseBraceletSessionMonitor();
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  /* Zodat de stopknop van het horloge (remote 'stop') de End-knop kan
     aanroepen, ook al is de luisteraar al bij de eerste render gemaakt. */
  const onStopRef = useRef<(() => Promise<void>) | null>(null);
  const onStop = async () => {
    setBusy(true);
    /* Iter v197 (2026-07-04): endedLocally flag DIRECT true. Overruled
       de 5s poll die anders na 5s status.sessionActive=true kan zetten
       (sim race, spec §8.3). setStatus force blijft als fallback voor
       de eerste render voordat de effect propagert. */
    setEndedLocally(true);
    setStatus((prev) =>
      prev ? { ...prev, sessionActive: false, remainingMinutes: 0 } : prev,
    );
    try {
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: 0,
        command: BleCommand.Stop,
      });
      /* Manual end — record als 'stopped'.
         Iter 9bl (2026-05-31): duration = ACTIEVE tijd (pauzes uitgesloten).
         Operator-spec: 1 min run + 10 min pause + 3 min run = 4 min duration.
         - End-during-pause → pausedAtElapsedMsRef (exact-elapsed-bij-pause).
         - End-during-active → (now - sessionStartedAtRef) waar startedAt
           re-anchored is op resume → cumulatieve actieve tijd over
           meerdere pause/resume cycli heen.
         startedAt-ISO blijft de echte wall-clock Start-druk. */
      finishSession('stopped');
      void stopBraceletSessionMonitor();
      pausedAtElapsedMsRef.current = 0;
      setPausedAt(null);
      /* Iter v195 (2026-07-04): setStatus na Stop-command moet ALTIJD
         sessionActive=false erin overschrijven. Vroeger vertrouwden we op
         sim.requestStatus() → maar de sim kan (a) niet direct reageren op
         Stop of (b) stale sessionActive=true teruggeven → force blijft
         waar activation was toen operator End tikte. Nu: neem sim's
         status als basis, dwing sessionActive=false + remainingMinutes=0. */
      try {
        const st = await bracelet.requestStatus();
        setStatus(st ? { ...st, sessionActive: false, remainingMinutes: 0 } : st);
      } catch {
        /* swallow — v193 force setStatus vóór de try/catch heeft al gezet */
      }
    } finally {
      setBusy(false);
    }
  };
  onStopRef.current = onStop;

  /* Pause — sla resterende tijd op en zet de bracelet stop. UI blijft
     op active-screen via de isPaused-check.
     Iter 9be (2026-05-31): exacte elapsed-ms vangen VÓÓR de async BLE
     Stop, zodat de pauze-tijd op het press-moment vastligt (geen
     14:23 → 14:00 sprong meer). pausedAt blijft in minuten voor het
     Resume-BLE-command (BLE accepteert geen sub-minute). */
  const onPause = async () => {
    if (!status) return;
    /* Capture exact ms-elapsed NU, vóór de async BLE-roundtrip. */
    const startedAt = sessionStartedAtRef.current;
    const plannedSec = sessionPlannedRef.current * 60;
    const exactElapsedMs =
      startedAt !== null
        ? Math.max(0, Date.now() - startedAt)
        : (sessionPlannedRef.current - status.remainingMinutes) * 60_000;
    pausedAtElapsedMsRef.current = exactElapsedMs;
    /* Voor BLE Resume: ceil naar minuten zodat we niet onderschrijden.
       Display gebruikt de exact-ms ref onafhankelijk hiervan. */
    const exactRemSec = Math.max(0, plannedSec - exactElapsedMs / 1000);
    const remMinForBle = Math.max(1, Math.ceil(exactRemSec / 60));
    setBusy(true);
    try {
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: 0,
        command: BleCommand.Stop,
      });
      setPausedAt(remMinForBle);
      pauseBraceletSessionMonitor();
      /* Refresh status zodat sessionActive=false meekomt in state. UI
         blijft active dankzij isPaused. */
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  /* Resume — start opnieuw met clamped pausedAt als duration. Bracelet
     start een verse haptiek-loop; voor de gebruiker voelt 't als
     "doorgaan waar ik gepauzeerd was".
     Iter 9bf (2026-05-31): correcte re-anchor strategie.
     - sessionPlannedRef BLIJFT op de oorspronkelijke planned. Anders
       sprong het display naar de ge-cell-de BLE-minuten (bv. 15:00) ipv
       door te lopen vanaf de exacte pause-tijd (bv. 14:23).
     - sessionStartedAtRef wordt gezet op (Date.now() - exactElapsedMs)
       zodat (now - startedAt) precies gelijk is aan de elapsed-bij-pause
       → het display picks up vanaf de exacte pause-tijd.
     - requestStatus VÓÓR de state-updates → setPausedAt en setStatus in
       één synchrone batch → één render i.p.v. twee → geen glitch. */
  const onResume = async () => {
    if (!isPaused) return;
    /* Audit 5 okt 2026: de ECHT lopende modus (niet de aangetikte) en de
       echte resterende minuten — geen clamp naar het modus-minimum meer
       hier; het einde bewaakt de monitor (die de bracelet zelf stopt). */
    const runMode = (getBraceletMonitorSession()?.mode ?? selectedMode) as BraceletMode;
    const remainingSecNow = getBraceletMonitorRemainingSec() ?? (pausedAt ?? 1) * 60;
    const resumeDuration = Math.max(1, Math.ceil(remainingSecNow / 60));
    const exactElapsedMs = pausedAtElapsedMsRef.current;
    setBusy(true);
    /* Iter v200 (2026-07-04): endedLocally reset op Resume. Anders zou
       een Resume na een Pause + End cycle (edge case) de UI in idle
       houden ondanks nieuwe actieve sessie. Defensive reset. */
    setEndedLocally(false);
    try {
      await bracelet.sendCommand({
        mode: runMode,
        duration: resumeDuration,
        command: BleCommand.Start,
      });
      /* Status eerst ophalen — daarna alle state-updates batchen zodat
         React maar één keer rendert (geen tussentijdse flicker). */
      const st = await bracelet.requestStatus();
      /* Re-anchor startedAt: (now - startedAt) = exactElapsedMs → het
         lokale display continueert van precies de pause-tijd. Planned
         blijft de oorspronkelijke (niet vervangen door BLE-ceil). */
      sessionStartedAtRef.current = Date.now() - exactElapsedMs;
      pausedAtElapsedMsRef.current = 0;
      setPausedAt(null);
      resumeBraceletSessionMonitor();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  /* Restart — record huidige als 'stopped', start verse sessie met
     min-duration van mode. Tertiaire actie tijdens active/paused. */
  const onRestart = async () => {
    setBusy(true);
    /* Iter v197: reset endedLocally net als onStart. */
    setEndedLocally(false);
    try {
      const fullDuration = getModeMeta(selectedMode).minMinutes;
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: 0,
        command: BleCommand.Stop,
      });
      /* Eerst de huidige sessie afsluiten in history (als er één liep).
         Iter 9bl (2026-05-31): actieve tijd, consistent met onStop. */
      finishSession('stopped');
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: fullDuration,
        command: BleCommand.Start,
      });
      /* Nieuwe sessie: zowel display-anchor als real wall-clock op nu. */
      const newStartMs = Date.now();
      sessionStartedAtRef.current = newStartMs;
      sessionRealStartedAtRef.current = newStartMs;
      sessionPlannedRef.current = fullDuration;
      pausedAtElapsedMsRef.current = 0;
      setPausedAt(null);
      startBraceletSessionMonitor({
        mode: selectedMode,
        totalSec: fullDuration * 60,
      });
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };


  /* ── Derived state ─────────────────────────────────────────────── */
  const sessionActive = USE_SIMULATED_BLE
    ? monitorSnap.active && !monitorSnap.paused
    : !endedLocally && (status?.sessionActive ?? false);
  /* Geen sessie meer → niets om "geminimaliseerd" te houden. */
  useEffect(() => {
    if (!sessionActive && !isPaused) setMinimized(false);
  }, [sessionActive, isPaused]);
  const battery = status?.batteryPercent ?? null;
  const charging = status?.charging ?? false;
  const fault = status?.fault ?? false;
  const lowBattery = battery != null && battery >= 5 && battery < 20;
  const criticalBattery = battery != null && battery < 5;

  /* Lokale seconden-tick voor de timer-display. BLE-status rapporteert
     alleen minuten (spec §11.4), maar gebruikers willen ook seconden zien
     (operator-feedback iter 7). We berekenen lokaal vanuit
     sessionStartedAtRef + sessionPlannedRef: elapsed = now - startedAt,
     remaining = planned - elapsed. BLE-status blijft de bron-van-waarheid
     voor sessionActive / battery / etc., maar voor de visuele countdown
     gebruiken we de lokale clock. Tikt 1× per seconde tijdens actieve
     sessie (en stopt zodra sessieActive=false of paused). */
  const [nowMs, setNowMs] = useState<number>(Date.now());
  useEffect(() => {
    if (!sessionActive) return;
    /* Iter 9bg (2026-05-31): instant sync vóór de interval start. Zonder
       dit: na een pause/resume cycle bleef nowMs ~3 sec stale (interval
       tickt pas 1s NA mount) → de eerste render na resume las verouderde
       elapsed → remaining werd 2–3 sec te hoog getoond → "11:00 → 11:03"
       sprong. Nu: setNowMs(Date.now()) op het moment dat sessionActive
       true wordt → eerste post-resume render is in sync. */
    setNowMs(Date.now());
    /* Operator, 5 okt 2026 ("de sessie slaat soms seconden over"): een
       interval van "ongeveer" 1 s die net te laat vuurt, sprong van 3:10
       naar 3:08. Nu ververst het scherm net NA de omslag van elke seconde
       van de resterende tijd (zoals Apple's timers aan de klok gekoppeld
       zijn) — elke seconde precies één keer. */
    let id: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const rem = getBraceletMonitorRemainingSec();
      const frac = rem === null ? 0 : rem - Math.floor(rem);
      id = setTimeout(() => {
        setNowMs(Date.now());
        schedule();
      }, Math.max(20, Math.round(frac * 1000) + 20));
    };
    schedule();
    return () => clearTimeout(id);
  }, [sessionActive]);

  /* Operator, 17 september 2026: de losse "publish naar bracelet-session-
     state"-effect die hier stond is VERWIJDERD — bracelet-session-
     monitor.ts (gestart vanuit onStart/onResume/onRestart hieronder) is
     nu de ENIGE bron die naar die store schrijft. Twee systemen die
     hetzelfde deden (dit effect + de monitor) was precies de verwarring
     achter "seconden kloppen niet": een sessie die vóór de monitor-
     wiring gestart was, leunde stilzwijgend op dit effect (dat stopt
     zodra het scherm unmount — exact de oorspronkelijke bug), terwijl de
     monitor voor DIE sessie nooit geactiveerd was. Nu is er nog maar één
     waarheid, en die overleeft een unmount echt. */

  /* JS-proces levend houden tijdens lock/achtergrond — het silent-audio-
     anker dat breath-session.tsx ook gebruikt. Puur voor CONTINUÏTEIT
     (audio-focus voorkomt dat iOS/Android het JS-proces bevriezen); de
     ZICHTBARE lockscreen-info komt uit bracelet-session-monitor.ts (zie
     de start/pause/resume/stop-aanroepen in onStart/onPause/onResume/
     onStop hieronder) — vandaar `showLockScreenInfo: false`, geen twee
     gelijktijdige widgets met dezelfde info.
     Operator, 16-17 september 2026 ("ook bij lockscreen moet de lopende
     sessie te zien zijn... teller stopt bij minimize/andere pagina's"):
     eerdere versie was iOS-only (zelfde voorbehoud als breath-session
     tegen Android's media-notification-voortgangsbalk-verwarring) — maar
     die verwarring kwam van `setActiveForLockScreen`'s EIGEN title/
     artist-widget, niet van de audio-focus zelf. Met die widget nu
     uitgeschakeld (showLockScreenInfo=false) is er geen reden meer om
     Android hiervan uit te sluiten — juist Android had de zichtbare
     "niets te zien"-klacht het hardst. */
  useEffect(() => {
    /* Android met de native service: die houdt de sessie zelf levend en
       toont ze op het vergrendelscherm. Het stille audio-anker is daar niet
       nodig en stopte bovendien de muziek van de gebruiker (Spotify) bij
       Start, en ving de knoppen van oordopjes op (audit 5 okt 2026). */
    if (Platform.OS === 'android' && hasNativeWaveform()) return;
    if (!sessionActive && !isPaused) {
      stopSessionKeepAlive();
      return;
    }
    startSessionKeepAlive(undefined, false);
  }, [sessionActive, isPaused]);

  /* Operator, 17 september 2026 ("als iemand uit de sessie is en
     terugkomt via het tabblad moet het in preview altijd dezelfde flow
     zijn"): de BLE-verbinding (`conn`) is een module-level singleton die
     bewust NIET meer verbreekt bij het verlaten van dit scherm — dat was
     precies de fix voor "sessie mag niet stoppen bij minimize". Maar
     voor een preview-bezoeker die GEEN sessie (meer) heeft lopen, wil
     de operator bij een nieuw bezoek (via de tab, niet via de
     BraceletMiniIndicator-pill terug de sessie in) steeds opnieuw de
     volledige "Looking for your bracelet"-flow zien, niet stilzwijgend
     al verbonden binnenkomen. Disconnect daarom hier bij unmount —
     MAAR alleen als er op dat exacte moment geen sessie (actief of
     gepauzeerd) loopt: `isBraceletSessionMonitorActive()` leest de
     monitor's LIVE state, niet een mogelijk-verouderde closure-waarde,
     dus dit blijft correct ongeacht wanneer de unmount gebeurt. Alleen
     voor niet-eigenaars — een echte owner blijft gewoon verbonden. */
  useEffect(() => {
    if (isBraceletOwner) return;
    return () => {
      if (!isBraceletSessionMonitorActive()) {
        void bracelet.disconnect();
      }
    };
  }, [isBraceletOwner, bracelet]);

  /* BackHandler.
     Operator, 16 september 2026 ("nu kan user van hieruit enkel weg
     door end session... gebruiker moet de mogelijkheid hebben om uit
     deze pagina te gaan en sessie laten doordoen — gsm moet in de zak
     kunnen, doordoen als gebruiker andere sites/apps bekijkt"): de
     vorige versie liet system-back de sessie STOPPEN (zelfde als de
     End-knop) — dat was fout. Spec §6: de bracelet draait autonoom op
     hardware-timers zodra gestart; BLE-verbindingsverlies of de app
     verlaten stopt de sessie NIET.
     Operator, 16 september 2026 (vervolg — bugreport "kom dan op
     welcome scherm van smart bead bracelet, dan moet ik opnieuw
     beginnen"): een eerste fix riep router.back() op, maar owners
     krijgen BraceletControl INLINE binnen de Bracelet-tab
     ((tabs)/bracelet.tsx: `return <BraceletControl />`) — géén eigen
     gepushte route. router.canGoBack() zag dan gewoon `welcome` onderin
     de root-stack staan en popte helemaal daar naartoe: user uit de
     hele tab-flow, geen zichtbare weg terug naar de lopende sessie.
     Voor eigenaars is er dus NIETS om naartoe terug te navigeren — back
     moet hier het systeem-default doen (app minimaliseren, net als
     "gsm in de zak"), niet ergens naartoe poppen.
     Alleen bij een écht gepushte /bracelet-control (niet-eigenaar CTA-
     flows met fromContext, zie router.push hierboven in dit bestand)
     is router.back() de juiste keuze — dat popt exact één scherm terug
     naar de bronpagina, niet helemaal naar welcome.
     Operator, 17 september 2026 ("ik kan vanuit bracelet connect enkel
     via de telefoon-back-pijl weg, is dat correct?"): deze handler
     stond alleen AAN tijdens een actieve/gepauzeerde sessie
     (`!sessionActive && !isPausedRef.current` early-return) — op het
     Connect/Idle-scherm gold dus gewoon het React Navigation-default,
     en voor een eigenaar (ook daar inline, geen pushed screen) is dat
     PRECIES dezelfde welcome-sprong-bug die hierboven al voor de active
     sessie gefixt is, alleen dan op het connect-scherm. Guard nu
     onvoorwaardelijk — dezelfde eigenaar-bewuste logica geldt overal
     binnen bracelet-control, niet enkel tijdens een sessie.
     Iter 9bm (2026-05-31): useFocusEffect ipv useEffect → handler is
     ALLEEN actief wanneer bracelet-control het focused scherm is. */
  useFocusEffect(
    useCallback(() => {
      /* Audit 5 okt 2026: het geduwde /bracelet-control-scherm bestaat niet
         meer (alles opent de tab). Eén consistente regel:
         - actief sessiescherm in beeld → dat scherm handelt het af
           (minimaliseren naar de moduskeuze);
         - moduskeuze in de tab → terug naar het State Control-intro, net
           als de "<"-pijl. Nooit meer router.back() naar een ander scherm. */
      const handler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isActiveSessionVisible()) return false;
        if (onMinimize) {
          onMinimize();
          return true;
        }
        return false;
      });
      return () => handler.remove();
    }, [onMinimize]),
  );
  /* isPausedRef voor BackHandler — vangt ook tijdens pause. */
  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = pausedAt !== null;
  }, [pausedAt]);
  const batteryColor =
    battery == null
      ? C.textDim
      : criticalBattery
        ? C.error
        : lowBattery
          ? WARN
          : C.success;

  /* Active mode shown in session view — uses status.currentMode (what the
     bracelet is actually running), niet selectedMode (user's last UI pick). */
  const activeMeta = monitorSnap.active
    ? getModeMeta(monitorSnap.mode as BraceletMode)
    : status
      ? getModeMeta(status.currentMode)
      : meta;
  const presets = useMemo(() => durationPresets(selectedMode), [selectedMode]);

  /* ── Render branches ────────────────────────────────────────────────
     Determine which "screen" to show based on connection + status. Each
     branch returns its own complete layout; this keeps the JSX flat and
     avoids deep conditional nesting. The sticky bottom-button content
     is computed per branch and rendered below the ScrollView. */

  /* SCREEN 3: Not connected.
     Operator, 16 september 2026 ("yes connected moet op de pagina
     connect zelf gebeuren, pas na verdwijnen en connecten naar volgende
     pagina"): blijft ook staan zolang showConnectedPopup nog aan is,
     ook al is conn dan al 'connected' — anders is de switch naar Idle
     al gebeurd VOORDAT de popup ooit zichtbaar wordt op het juiste
     scherm. De popup dismisst zichzelf (setShowConnectedPopup(false)),
     waarna deze conditie alsnog doorvalt naar Idle. */
  /* Operator, 27 september 2026 ("na yes connected zie ik eerst nog
     bracelet, moet direct naar bracelet control"): `showConnectedPopup`
     hoort niet meer bij deze gate — zodra `conn` echt 'connected' is,
     wisselt het scherm nu meteen door naar de juiste vervolg-branch
     (Fault/Charging/Active/Idle). De popup rendert zelf verderop als
     losstaande overlay (`connectedPopupOverlay` in elke branch), dus zijn
     fade-out onthult voortaan meteen het juiste scherm i.p.v. deze. */
  /* Operator, 1 okt 2026 ("vanuit bracelet plan tik ik → eerst bracelet
     connect pagina, dat moet niet"): auto-start (breathwork-CTA én nu
     ook "Start session" vanuit Your bracelet plan) verbindt zelf op de
     achtergrond, maar de simulator laat `connect()` altijd ~1.5s door
     scanning/connecting lopen (spec-getrouw) — zonder deze branch flitst
     het VOLLEDIGE zoek-scherm (met Retry-knop, activatie-prompt, etc.)
     zichtbaar op vóórdat de sessie start. Tijdens een auto-start tonen
     we i.p.v. daarvan een simpele, merk-eigen loader; bij een falende
     auto-connect (`autoStartFailed`) valt het alsnog terug op het echte
     zoek-scherm, zodat de gebruiker niet op een dode loader blijft hangen. */
  if (conn !== 'connected') {
    if (autoStartBracelet && !autoStartFailed) {
      return <AutoStartLoader />;
    }
    if (autoConnect) {
      return <AutoStartLoader text="Connecting…" />;
    }
    return (
      <SearchingScreen
        conn={conn}
        isBraceletOwner={isBraceletOwner}
        showActivationPrompt={showActivationPrompt}
        busy={busy}
        fromContext={fromContext}
        ctaBackLabel={ctaBackLabel}
        navigateBackToSource={navigateBackToSource}
        onConnect={onConnect}
      />
    );
  }

  const connectedPopupOverlay = showConnectedPopup ? (
    <ConnectedPopup onDismiss={() => setShowConnectedPopup(false)} />
  ) : null;

  /* SCREEN 6: Fault state (firmware reported error) */
  if (fault) {
    return (
      <>
        <FaultScreen
          isBraceletOwner={isBraceletOwner}
          showActivationPrompt={showActivationPrompt}
          busy={busy}
          bracelet={bracelet}
          sim={sim}
          onDisconnect={onDisconnect}
          onConnect={onConnect}
          setStatus={setStatus}
        />
        {connectedPopupOverlay}
      </>
    );
  }

  /* SCREEN 4: Charging — sessions paused (spec §11.5) */
  if (charging && !sessionActive) {
    return (
      <>
        <ChargingScreen
          isBraceletOwner={isBraceletOwner}
          showActivationPrompt={showActivationPrompt}
          onDisconnect={onDisconnect}
          battery={battery}
          batteryColor={batteryColor}
          sim={sim}
        />
        {connectedPopupOverlay}
      </>
    );
  }

  /* SCREEN 2: Active session — kalm, één focuspunt.
     Operator-feedback 2026-05-27 iter 3:
       - End button moest rustiger (neutraal, geen rode CTA)
       - Pause + Resume + Restart toegevoegd
       - Wanneer paused: timer toont pausedAt, eyebrow "PAUSED",
         Resume-button (mode-color filled) ipv Pause
     UI-stay-condition: sessionActive OF isPaused — anders zou de
     transitie naar idle de pause-state direct breken. */
  if ((sessionActive || isPaused) && status && !minimized) {
    return (
      <>
        <ActiveSessionScreen
          onMinimize={minimizeSession}
          status={status}
          isPaused={isPaused}
          pausedAt={pausedAt}
          activeMeta={activeMeta}
          duration={duration}
          selectedMode={selectedMode}
          sessionPlannedRef={sessionPlannedRef}
          sessionStartedAtRef={sessionStartedAtRef}
          pausedAtElapsedMsRef={pausedAtElapsedMsRef}
          nowMs={nowMs}
          safeInsets={safeInsets}
          isBraceletOwner={isBraceletOwner}
          onResume={onResume}
          onPause={onPause}
          busy={busy}
          setEndedLocally={setEndedLocally}
          onStop={onStop}
        />
        {connectedPopupOverlay}
      </>
    );
  }

  /* SCREEN 1: Idle — mode selection + duration + Start CTA.
     Iter 9 (operator-feedback): herschreven naar single-screen layout
     zonder scroll. Mode bovenaan als horizontale chip-picker, duration
     kort eronder, Start CTA prominent, mini-footer met stats+history.
     Doel: alles in één blik zichtbaar zonder scrollen, Apple-style
     hiërarchie met eyebrow-headers. */
  return (
    <>
      <IdleScreen
        onMinimize={onMinimize}
        sessionRunning={sessionActive || isPaused}
        onReturnToSession={() => setMinimized(false)}
        onSwitchMode={async () => {
          setEndedLocally(true);
          await onStop();
          /* Audit 8 okt 2026: een nieuwe sessie starten valt onder dezelfde
             Premium-regel als de gewone Start-knop. */
          if (sessionsLocked) {
            setPaywallOpen(true);
            return;
          }
          await onStart();
        }}
        fromContext={fromContext}
        disconnectAndBackToSource={disconnectAndBackToSource}
        onDisconnect={onDisconnect}
        ctaBackLabel={ctaBackLabel}
        isBraceletOwner={isBraceletOwner}
        showActivationPrompt={showActivationPrompt}
        safeInsets={safeInsets}
        criticalBattery={criticalBattery}
        lowBattery={lowBattery}
        battery={battery}
        batteryColor={batteryColor}
        selectedMode={selectedMode}
        setSelectedMode={setSelectedMode}
        meta={meta}
        duration={duration}
        setDuration={setDuration}
        onStart={onStartGated}
        startLocked={sessionsLocked}
        onTrialEnd={() => setPaywallOpen(true)}
        busy={busy}
        stats={stats}
        completedModeForModal={completedModeForModal}
        completedMinutes={completedMinutes}
        setCompletedModeForModal={setCompletedModeForModal}
        detailModeForModal={detailModeForModal}
        setDetailModeForModal={setDetailModeForModal}
        sim={sim}
      />
      <PremiumPaywallModal
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        context="state-control"
      />
      {connectedPopupOverlay}
    </>
  );
}

/* ── Stats-strip ─────────────────────────────────────────────────────
   Rustige 3-koloms display: Today (sessies vandaag) · Min today
   (cumulatief vandaag) · Streak (opeenvolgende dagen). Vervangt de
   sessionMetaCard die te dashboard-y voelde. Motivatie zonder data-
   overload. */
function StatsStrip({
  todaySessions,
  todayMinutes,
  totalMinutes,
  modeName,
}: {
  todaySessions: number;
  todayMinutes: number;
  totalMinutes: number;
  /** Wanneer gepasseerd: stats zijn voor specifiek deze mode (active-
   *  session context). Eyebrow boven de cijfers laat 't zien. */
  modeName?: string;
}) {
  return (
    <View>
      {modeName && (
        <Text style={s.statsEyebrow}>{modeName.toUpperCase()} STATS</Text>
      )}
      <View style={s.statsStrip}>
        <View style={s.statsCell}>
          <Text style={s.statsNum}>{todaySessions}</Text>
          <Text style={s.statsLbl}>today</Text>
        </View>
        <View style={s.statsDivider} />
        <View style={s.statsCell}>
          <Text style={s.statsNum}>{todayMinutes}</Text>
          <Text style={s.statsLbl}>min today</Text>
        </View>
        <View style={s.statsDivider} />
        <View style={s.statsCell}>
          <Text style={s.statsNum}>{totalMinutes}</Text>
          <Text style={s.statsLbl}>min total</Text>
        </View>
      </View>
    </View>
  );
}

/* ── Sim demo bar ─────────────────────────────────────────────────────
   Alleen zichtbaar wanneer SimulatedBracelet draait (sim != null). Geeft
   ontwikkelaar / operator een snelle manier om edge-states te triggeren
   zonder echte hardware. Verdwijnt automatisch wanneer USE_SIMULATED_BLE
   = false en RealBracelet actief is. */
function SimDemoBar({ sim }: { sim: NonNullable<ReturnType<typeof getSimHooks>> }) {
  return (
    <View style={s.demoBox}>
      <Text style={s.demoTitle}>SIM · DEV ONLY</Text>
      <View style={s.demoLinkRow}>
        <Pressable
          style={s.demoLink}
          onPress={() => sim.simSetBattery(18)}
          accessibilityLabel="Trigger low battery in simulation"
        >
          <Text style={s.demoLinkText}>Low battery</Text>
        </Pressable>
        <Text style={s.demoSep}>·</Text>
        <Pressable
          style={s.demoLink}
          onPress={() => sim.simSetCharging(true)}
          accessibilityLabel="Trigger charging in simulation"
        >
          <Text style={s.demoLinkText}>Charging</Text>
        </Pressable>
        <Text style={s.demoSep}>·</Text>
        <Pressable
          style={s.demoLink}
          onPress={() => sim.simTriggerFault()}
          accessibilityLabel="Trigger fault in simulation"
        >
          <Text style={s.demoLinkText}>Fault</Text>
        </Pressable>
        <Text style={s.demoSep}>·</Text>
        <Pressable
          style={s.demoLink}
          onPress={() => {
            sim.simSetCharging(false);
            sim.simSetBattery(87);
            sim.simClearFault();
          }}
          accessibilityLabel="Reset simulation to healthy state"
        >
          <Text style={s.demoLinkText}>Reset</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/* Convert a #RRGGBB hex color to a `rgba()` with given alpha. Used voor
   tinted backgrounds in mode-cards en duration-presets. */
function hexToTint(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* Operator, 16 september 2026 ("subtiel kleurverloop toevoegen aan alle
   actieve groene elementen — van lichtgroen naar dieper groen"): mengt
   een hex-kleur richting wit (percent > 0, lichter) of zwart (percent < 0,
   donkerder). Gebruikt voor de gradient-stops van de actieve mode-kaart
   en de duration-slider fill. */
function shadeHex(hex: string, percent: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  const mix = (channel: number) =>
    percent >= 0
      ? Math.round(channel + (255 - channel) * percent)
      : Math.round(channel * (1 + percent));
  const rr = Math.max(0, Math.min(255, mix(r)));
  const gg = Math.max(0, Math.min(255, mix(g)));
  const bb = Math.max(0, Math.min(255, mix(b)));
  return `#${[rr, gg, bb].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/* `isLightColor` verhuisde naar `@/utils/color.ts` (operator, 20 september
   2026) — breath-setup.tsx had exact hetzelfde witte-tekst-op-witte-bg-
   probleem (Clarity's #FFFFFF-accent) en verdiende geen tweede kopie. */

/* ── Styles ──────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  autoStartLoader: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  autoStartLoaderTxt: { fontFamily: BrandFonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.6)' },

  /* BraceletHeroGlow — nu op SearchingScreen (flexibele gecentreerde
     layout, niet de vaste single-screen-budget van IdleScreen), dus mag
     groter: 92→200px. Geen achtergrondvlak meer, enkel de cutout. */
  /* Operator ("premium apple stijl, doe wat jij denkt dat beste is"):
     220→238 — de armband-foto is nu het enige pulserende element op dit
     scherm (SearchingPulse/SignalBeam weg), dus groter/centraler zoals
     de feedback vroeg ("armband staat niet klein onderin, maar groot en
     centraal"). heroGlowImg mee opgeschaald, PodPulse-afmetingen mee. */
  heroGlowWrap: {
    height: 238,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    /* Operator, 16 september 2026 ("haptic sectie moet lager, nu te dicht
       tegen preview button"): het hele blok (puls+tekst+armband) groeide
       met de grotere armband-afbeelding, en kwam te dicht bij de Connect-
       knop onderaan te staan. Extra ruimte eronder. */
    marginBottom: 28,
  },
  heroGlowImg: {
    width: 380,
    height: 238,
  },
  /* SignalBeam — signaal-kanaal van de radar-puls naar de zwarte pod op
     de armband-foto. `top`/`height` per-instance gezet (startY/travel);
     horizontaal gecentreerd t.o.v. de omringende container (24px breed,
     alle kinderen zelf ook gecentreerd via left:50%+marginLeft). */
  signalBeamWrap: {
    position: 'absolute',
    left: '50%',
    width: 24,
    marginLeft: -12,
  },
  /* Chevron i.p.v. cirkel — een driehoekje wijst duidelijk een richting
     aan ("naar beneden"), een bolletje communiceert geen richting
     (operator: "zijn dots de juiste vorm om connection weer te geven?"). */
  signalBeamDot: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -5,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: SIGNAL_BLUE,
  },

  /* ── Idle screen ─────────────────────────────────────────────────── */
  idleScroll: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  /* Iter 9: single-screen no-scroll layout. flex:1 + padding zorgen
     dat alle elementen verticaal verdeeld worden binnen het scherm.
     Spacer-View met flex:1 elders pusht de footer naar de bodem. */
  idleSingleScreen: {
    flex: 1,
    padding: 16,
    paddingTop: 12,
  },
  /* Iter 9dq v109 (2026-06-04): custom in-screen header voor unified
     control-flow across Audio PRO / Bracelet PRO / Full PRO. */
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    /* Operator, 27 september 2026 ("bracelet connect moet ook zakken en
       in safe zone"): title+badge staan nu gestapeld (kolom) i.p.v.
       naast elkaar, en de badge kreeg een extra marginTop (19) om lager
       te zakken — dat paste niet meer in de oude vaste 48px hoogte,
       waardoor de titel bovenaan tegen/buiten de header-rand kwam.
       48→88 geeft de hele gestapelde titel+badge-kolom genoeg ruimte om
       volledig binnen de header (en dus binnen de safe area) te blijven. */
    height: 88,
    paddingHorizontal: 8,
    backgroundColor: C.bg,
  },
  headerSide: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Iter 2026-06-05: bredere headerSide-variant wanneer er een back-label
     naast de "←" wordt getoond (CTA-flow: "Audio Library" of "Bracelet").
     Behoudt verticaal centreren maar groeit horizontaal mee. */
  headerSideWithLabel: {
    width: 'auto',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
  },
  /* Status (dot + battery%) + settings-tandwiel samen rechts in de
     header (operator, 16 september 2026: "connected en batterij mag
     rechtsboven naast preview"). */
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
  },
  headerStatusText: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    marginRight: 4,
  },
  /* Iter 2026-06-05: label tekst naast back-arrow. Subtiel, dim, regular.
     Alleen zichtbaar wanneer backLabel prop is gezet (CTA-flow). */
  headerBackLabel: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
    opacity: 0.85,
  },
  /* Operator, 16 september 2026 ("ook header moet consistent zijn"): was
     een kleine (17px), gecentreerde iOS-navbar-titel — de rest van de
     app (Audio Library, Bracelet-tab) gebruikt sinds deze sessie
     `TypeScale.pageHeader` (30px Bold, links) als grote paginatitel.
     Zelfde rol, nu dezelfde bron.
     Operator, 27 september 2026 ("bovenaan mag ook in hoofdletters en
     kleiner en centraal", daarna "zelfde voor bracelet preview" —
     bevestigd voor alle 4 bracelet-headers): terug naar klein +
     gecentreerd, nu als uppercase eyebrow i.p.v. de grote 30px
     paginatitel. */
  headerTitle: {
    flex: 1,
    color: C.text,
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginLeft: 4,
  },
  /* Operator ("preview mag achter bracelet staan"): rij die titel +
     optioneel badge samen draagt, i.p.v. de titel alleen — flex:1 zit
     hier (niet meer los op headerTitle) zodat de rij de resterende
     ruimte pakt en het badge er direct na kan volgen.
     Operator, 27 september 2026 ("en preview onder bracelet connect"):
     row → column — badge (PreviewBadge) stapelt nu ONDER de titel i.p.v.
     ernaast, beide gecentreerd. */
  headerTitleRow: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    /* Operator, 27 september 2026 ("preview beetje lager mag niet
       plakken"): 2→6 — badge zat te dicht tegen de titel aan. */
    gap: 6,
    marginLeft: 4,
  },
  /* Section-eyebrow (Apple iOS-style section header — small caps, dim) */
  sectionEyebrow: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 10,
  },
  /* Operator, 16 september 2026 ("hoe hebben wij de choose...-teksten
     fontstijl in breathwork, dat moet hier ook consistent zijn"): was
     een 20px title-case header (iter 9b) — breath.tsx's "CHOOSE YOUR
     STATE" is een kleine uppercase eyebrow (13px bold, letterSpacing
     1.5, gedimd). Zelfde behandeling hier, voor dezelfde rol ("Choose
     mode" / "Choose duration"). */
  /* Margins altijd via de call site gezet (0/8 voor "Choose mode",
     durationHeaderRow's 66/8 voor "Choose duration") — geen zinvolle
     default hier. */
  idleH2: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  /* DurationRing — Dribbble-referentie toegepast op Choose duration
     i.p.v. active-session (operator-correctie, 16 september 2026:
     "wij zijn aan de choose mode sectie bezig"). */
  swipeHint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  quickIconRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginBottom: 16 },
  quickBlock: { alignSelf: 'stretch', marginBottom: 16, marginHorizontal: 10 },
  quickHead: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: BrandFonts.bold,
    fontSize: 11.5,
    letterSpacing: 1.4,
    marginBottom: 10,
    marginLeft: 4,
  },
  quickCardRow: { flexDirection: 'row', gap: 10 },
  quickCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#1c1c1e',
  },
  quickCardTitle: { color: '#ffffff', fontFamily: BrandFonts.semibold, fontSize: 14 },

  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  quickSheetHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, marginBottom: 18 },
  quickSheetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  quickSheetLine: { color: '#ffffff', fontSize: 17, fontFamily: BrandFonts.semibold, lineHeight: 24 },
  quickSheetNote: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 22,
  },
  quickSheetCta: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSheetCtaTxt: { color: '#1D1D1F', fontSize: 17, fontFamily: BrandFonts.bold },
  quickSheetBack: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  quickSheetBackTxt: { color: '#ffffff', fontSize: 16, fontFamily: BrandFonts.semibold },
  modeDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    /* 9 okt 2026: ruimte voor de greep op de rand van de cirkel. */
    marginTop: 26,
  },
  modeDot: {
    borderRadius: 4,
  },
  trialInfo: { alignItems: 'center', gap: 10, marginTop: 14 },
  /* Duidelijk leesbaar en gecentreerd (operator, 7 okt 2026). */
  trialInfoTxt: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 28,
    /* Altijd plaats voor twee regels: anders verspringt de knop als de
       uitleg tijdens de voorproef van één naar twee regels gaat. */
    minHeight: 40,
  },
  trialSheetEyebrow: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  /* Boven de cirkel, gecentreerd onder de titel. */
  /* Zelfde breedte als de Start-knop (marginHorizontal 10). */
  avBar: {
    alignSelf: 'center',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 22,
  },
  avBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  avBarTxt: { fontFamily: BrandFonts.semibold, fontSize: 13.5, color: 'rgba(255,255,255,0.75)' },
  avSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingTop: 10,
    paddingHorizontal: 24,
  },
  avGrip: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 14 },
  avHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  avTitle: { fontFamily: BrandFonts.bold, fontSize: 20, color: '#ffffff' },
  avDone: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff' },
  avCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
  },
  avCardOn: { borderColor: '#ffffff', backgroundColor: 'rgba(255,255,255,0.08)' },
  avCardIcons: { width: 52, alignItems: 'center', justifyContent: 'center' },
  avCardTitle: { fontFamily: BrandFonts.bold, fontSize: 17, color: 'rgba(255,255,255,0.85)', marginBottom: 6 },
  avCardBody: { fontFamily: BrandFonts.medium, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.6)' },
  avRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avRadioOn: { borderColor: '#ffffff', backgroundColor: '#ffffff' },
  hearSeg: { flexDirection: 'row', alignSelf: 'stretch', gap: 8, marginTop: 12, marginHorizontal: 10 },
  hearSegItem: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  hearSegItemOn: { borderColor: '#ffffff', backgroundColor: 'rgba(255,255,255,0.12)' },
  hearSegTxt: { fontFamily: BrandFonts.semibold, fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  durSeg: { flexDirection: 'row', alignSelf: 'stretch', gap: 8, marginTop: 40, marginHorizontal: 10 },
  durSegItem: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  durSegTxt: { fontFamily: BrandFonts.semibold, fontSize: 14.5 },
  ringHrTop: { position: 'absolute', top: 26 },
  ringHr: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ringHrTxt: { color: '#ffffff', fontFamily: BrandFonts.semibold, fontSize: 14 },
  hrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 60,
    marginBottom: 16,
  },
  hrCardTitle: { color: '#ffffff', fontFamily: BrandFonts.semibold, fontSize: 15.5 },
  hrCardValue: { color: 'rgba(255,255,255,0.85)', fontFamily: BrandFonts.semibold, fontSize: 15.5 },
  ringPulsePill: {
    alignSelf: 'center',
    marginTop: -6,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    /* Apple-stijl (operator, 7 okt 2026: "in een pill of zonder?"): zoals
       Health/Workout een aantikbare waarde tonen — tekst + icoon + pijltje,
       geen capsule. Raakvlak ≥ 44 via hoogte + hitSlop. */
    gap: 6,
    height: 36,
    paddingHorizontal: 10,
    /* Optisch centreren: het hartje is breder dan het pijltje, de groep
       stond 2 pt links van het midden (gemeten op de A16, 7 okt 2026). */
    marginLeft: 4,
  },
  ringPulseTxt: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  /* Na 30 dagen: zacht voorstellen opnieuw te meten. */
  ringPulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4AF0D4', marginLeft: 1 },
  durationRingWrap: {
    alignItems: 'center',
    alignSelf: 'stretch',
    /* Operator, 27 september 2026 ("geef alles voldoende ademruimte"):
       8→16. 5 okt 2026: 16→8 (paste anders niet boven de tabbalk). */
    marginBottom: 8,
  },
  /* Wrapper rond de DurationWheel, direct onder de ring — de ring zelf
     toont enkel het resultaat (operator: "dat moet meer in deze stijl,
     breathwork" — vervangt de vorige preset-chips + losse slider). */
  durationSliderWrap: {
    width: 266,
    alignSelf: 'center',
    /* Operator, 27 september 2026 ("geef alles voldoende ademruimte"):
       4/4 → 8/10. 5 okt 2026: → 4/6 (zie durationRingWrap). */
    marginBottom: 6,
    marginTop: 4,
  },
  /* DurationWheel — 1-op-1 overgenomen uit breath-setup.tsx (zie de
     toelichting bij de component zelf). */
  wheelWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  /* Operator, 29 september 2026 ("pill moet correct gecentreerd staan en
     recommended moet naar rechts"): de vorige pogingen maakten de pil zelf
     asymmetrisch (links/rechts ongelijk ingesprongen) om ruimte te maken
     voor het label — dat zag er scheef uit. Nu weer symmetrisch (40/40,
     echt gecentreerd rond het getal), en het "Recommended"-label schuift
     in plaats daarvan naar BUITEN de 266px-wrapper (via `left` i.p.v.
     `right`, geen overflow:hidden op deze wrapper) — start net voorbij de
     pil-rand (266-40=226, +8px lucht) en mag vrij verder naar rechts
     lopen in de bestaande witruimte naast de wheel. */
  /* Operator, 29 september 2026 ("pill kan beetje smaller"): 40/40 → 56/56
     — nog steeds symmetrisch/gecentreerd, gewoon een smallere pil. */
  wheelPill: {
    position: 'absolute',
    left: 56,
    right: 56,
    top: WHEEL_ITEM_H,
    height: WHEEL_ITEM_H + 6,
    marginTop: -3,
    borderRadius: (WHEEL_ITEM_H + 6) / 2,
  },
  /* Operator, 29 september 2026 ("recommended kan beetje meer naar
     links"): pil is intussen smaller (56/56, rand nu bij 266-56=210) —
     label mee opgeschoven (234→216, ~6px lucht t.o.v. de pil-rand). */
  wheelRecommendedTag: {
    position: 'absolute',
    left: 216,
    height: WHEEL_ITEM_H,
    justifyContent: 'center',
  },
  wheelRecommendedTagTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
  },
  wheelRow: { alignItems: 'center', justifyContent: 'center' },
  /* Stip voor de aanbevolen duur, rechts naast de pil (pil eindigt 56 van
     de rand → stip 10 px daarbuiten). Scrolt mee met zijn rij. */
  wheelRecDot: { position: 'absolute', right: 40, width: 7, height: 7, borderRadius: 3.5 },
  wheelTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
  },
  wheelTxtOn: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 20,
  },
  /* Zelfde maten als de breath-setup-ring (heroClock/heroTech/heroRec*). */
  ringNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 180 },
  ringName: {
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.75)',
  },
  ringClock: {
    fontFamily: BrandFonts.bold,
    fontSize: 54,
    letterSpacing: -1,
  },
  ringRecRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  ringRecDot: { width: 6, height: 6, borderRadius: 3 },
  ringRecTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.6)',
  },
  /* De CTA zoals "Start session" in de breathwork-setup: 56 hoog, zelfde
     zijmarge (16 + 10 = 26), semibold. */
  chooseCta: {
    height: 56,
    paddingVertical: 0,
    marginHorizontal: 10,
  },
  chooseCtaTxt: { fontFamily: BrandFonts.semibold, letterSpacing: 0.1 },
  durationRingCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Modus-naam boven het getal — klein, gekleurd, uppercase. */
  durationRingLabel: {
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  /* Zelfde "geen schaduw, gitzwart/wit, extra dik" behandeling als de
     active-session-timer — nu geen contrast-probleem meer nodig want de
     ring staat op de pagina-achtergrond, niet op een wisselende fill. */
  /* Operator, 16 september 2026 ("minuten moeten veel groter"): 60→88. */
  durationRingNum: {
    color: C.text,
    fontSize: 88,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -2,
    lineHeight: 92,
  },
  durationRingUnit: {
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  /* Zachte leesbaarheids-shadow voor de ring-center-tekst wanneer die
     over de bewegende golf-vulling staat (dark mode) — subtiel, geen
     harde offset-schaduw. */
  /* Lichte halo i.p.v. donkere — de tekst is nu donker en staat op de
     lichte golf-vulling (operator: "binnenkant cirkel moet lichte kleur
     zijn"), dus een lichte gloed helpt tegen de vollere/gekleurde delen
     van de golf i.p.v. een donkere schaduw die daar juist zou botsen. */
  /* Operator, 16 september 2026 ("binnenkant cirkel zwart ipv wit"):
     donkere halo terug i.p.v. de lichte tussenversie — witte tekst op
     een zwarte/gekleurde golf-achtergrond. */
  durationRingTextShadow: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  /* ── Segmented pill-switcher (operator, 16 september 2026 — "modus-
     kleur mag ergens een accent worden i.p.v. overal gevuld"): geen
     gevulde achtergrond meer op de actieve pill, enkel een gekleurde
     rand + icoon. De hero-kaart is weg — ring bovenaan is nu het ene
     focuspunt (zie durationRingWrap hieronder). */
  modeSegmentRow: {
    flexDirection: 'row',
    /* Operator, 27 september 2026 ("geef alles voldoende ademruimte"):
       8→10. */
    gap: 10,
    marginBottom: 12,
  },
  modeSegment: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10,10,12,0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /* ── Inline detail-panel onder de cards (iter 9d) ─────────────────
     Iter 9d v2: gestylt als proper card met bg/border + close-X.
     Voelt als popup, blokkeert niet. */
  modeInlinePanel: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  modeInlinePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modeInlinePanelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  modeInlinePanelName: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.2,
  },
  modeInlinePanelClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeInlinePanelCloseText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    lineHeight: 14,
  },
  modeInlineDesc: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    lineHeight: 20,
    letterSpacing: -0.1,
    marginBottom: 10,
  },
  modeInlineIdeals: {
    gap: 4,
    marginBottom: 10,
  },
  modeInlineIdealRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeInlineIdealCheck: {
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    marginRight: 8,
    width: 14,
  },
  modeInlineIdealText: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  modeInlineProtocol: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
  },
  /* ── Breathwork animaties (iter 9f/g) ──────────────────────────────
     Container voor alle protocol-specifieke animaties. */
  boxBreathContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    minHeight: 110, // ruimte voor labels en padding
  },
  boxBreathWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxBreathBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 8,
  },
  boxBreathDot: {
    position: 'absolute',
  },
  boxBreathLabel: {
    position: 'absolute',
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
  },
  boxBreathLabelTop: {
    top: -16,
    alignSelf: 'center',
  },
  boxBreathLabelBottom: {
    bottom: -16,
    alignSelf: 'center',
  },
  boxBreathLabelLeft: {
    left: -32,
    /* Centreer verticaal — top: 50% min half-line-height */
    top: '50%',
    marginTop: -6,
  },
  boxBreathLabelRight: {
    right: -36,
    top: '50%',
    marginTop: -6,
  },
  /* Triangle (iter 9h — Sharp Focus) — equilateral driehoek + dot */
  triangleWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triangleDot: {
    position: 'absolute',
  },
  triangleLabel: {
    position: 'absolute',
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
  },
  triangleLabelTop: {
    top: -16,
    alignSelf: 'center',
  },
  triangleLabelLeft: {
    bottom: -2,
    left: -8,
  },
  triangleLabelRight: {
    bottom: -2,
    right: -16,
  },
  /* PulsingCircle (simple + sigh fallback) — ring + pulserende core */
  pulsingCircleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulsingCircleRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  pulsingCircleCore: {
    position: 'absolute',
  },
  /* Nadi (alternate nostril) — twee cirkels naast elkaar */
  nadiWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nadiSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  nadiRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  nadiCore: {
    position: 'absolute',
  },
  /* ── ModeDetailModal (iter 9c) ─────────────────────────────────────
     Bottom-sheet popup voor mode-info. Apple-style: slide-up uit
     onder, ronde top-corners op de sheet.
     Operator, 16 september 2026 ("achterkant moet helemaal zwart, zo
     ligt focus op de kaart zelf; kaart schermhoog"): volledig ondoor-
     zichtig zwarte backdrop (was 55% transparant) + de sheet vult nu de
     volledige schermhoogte i.p.v. maxHeight 85%. */
  modeModalRoot: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'flex-end',
  },
  modeModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingTop: 10,
    paddingHorizontal: 22,
  },
  modeModalDone: { color: '#ffffff', fontFamily: BrandFonts.semibold, fontSize: 15, marginLeft: 12 },
  modeModalHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginBottom: 14,
  },
  /* Operator, 16 september 2026 ("x mag misschien groter of iets
     lager"): 30→36 (top wordt dynamisch via insets.top op de call
     site). */
  modeModalClose: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeModalCloseText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontFamily: BrandFonts.semibold,
    lineHeight: 18,
  },
  modeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingRight: 40, // ruimte voor close-X
  },
  modeModalDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 14,
  },
  /* Operator, 16 september 2026 ("popupkaarten nakijken op fontstijl,
     clarity deels niet leesbaar"): deze modal is een eigen, altijd-donker
     paneel (#141414) — los van de module-brede `light`-instelling die
     de rest van bracelet-control.tsx sinds de light-mode-conversie
     gebruikt. `C.text` resolveert daar naar bijna-zwart (BrandLight),
     wat op dit donkere paneel vrijwel onzichtbaar was. Expliciet wit
     i.p.v. de token, voor elke modus gelijk (niet Clarity-specifiek —
     trof alle vijf, viel bij Clarity's al-witte content het meest op). */
  /* Operator, 16 september 2026 ("schermhoog... font groter, en meer
     ademruimte"): nu de sheet schermhoog is, mag de tekst forser en
     losser — alle fontSize/lineHeight/margins een stap opgeschaald,
     dichter bij CompletionModal's maatvoering (titel 22, boodschap 17). */
  modeModalName: {
    color: '#ffffff',
    fontSize: 26,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
  },
  modeModalSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    marginTop: 4,
  },
  /* Intent — de "wat is dit voor"-zin onder de header. Iets groter en
     levendiger dan body-text. */
  modeModalIntent: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: BrandFonts.semibold,
    lineHeight: 26,
    letterSpacing: -0.2,
    marginTop: 8,
    marginBottom: 8,
  },
  modeModalSectionLbl: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },
  modeModalDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontFamily: BrandFonts.medium,
    lineHeight: 25,
    letterSpacing: -0.1,
  },
  /* "Feel it" — zelfde ghost-button-chrome als elders (rand in meta.color,
     geen gevulde achtergrond — CTA-chrome blijft voorbehouden aan de
     echte Start/Choose-knoppen, dit is een secundaire testactie). */
  /* Operator, 5 okt 2026 ("feel it groter en laten zakken, alles moet
     ademen") — sinds het ademblok weg is, is er ruimte. */
  feelWrap: {
    alignItems: 'center',
    marginTop: 44,
    marginBottom: 40,
  },
  /* Korte ritme-regel onder de intentiezin (5 okt 2026). */
  modeModalRhythm: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    lineHeight: 20,
    marginTop: -4,
  },
  feelCircleTxt: {
    fontSize: 17,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  feelProgressWrap: {
    alignItems: 'center',
    marginTop: 18,
  },
  feelTrack: {
    width: 160,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  feelBar: {
    height: 4,
    borderRadius: 2,
  },
  feelTimer: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    fontVariant: ['tabular-nums'],
  },
  feelCondensed: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 17,
  },
  feelHint: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    color: 'rgba(255,255,255,0.45)',
  },
  feelItBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  feelItBtnTxt: {
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
  },
  modeModalIdeals: {
    gap: 10,
    marginBottom: 8,
  },
  modeModalIdealRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeModalIdealCheck: {
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    marginRight: 12,
    width: 18,
  },
  modeModalIdealText: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  modeModalProtocol: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  modeModalProtocolHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 19,
    marginTop: 6,
  },
  /* Kaartje rond de "Optional breath layer"-sectie — zet 'm visueel
     apart als secundaire, optionele toevoeging (operator, 16 september
     2026: "optional layer in kaart zetten?"). */
  modeModalProtocolCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 16,
  },
  /* "i"-info-knop — was op de ring-hoek, toen onder de GO-knop, nu onder
     de Choose mode-pillen (operator, 16 september 2026: "i onder de
     choose mode buttons"). */
  /* Operator, 16 september 2026 ("i moet iets hoger staan"): 8→3. */
  startInfoBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(10,10,12,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 3,
  },
  /* ── Mode chip-strip (horizontal scrollable picker) ── */
  modeChipStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16, // matched root padding zodat laatste chip niet plakt
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  modeChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  modeChipText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  /* Selected-mode-info: 1 regel "Name · range · ideal-tag" */
  modeInfoLine: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
  },
  modeInfoName: {
    color: C.text,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  modeInfoMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: BrandFonts.regular,
  },
  /* Duration: getal-display ipv fill-circle */
  durBigNumWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
  },
  durBigNum: {
    color: C.text,
    fontSize: 56,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -2,
    lineHeight: 60,
  },
  durBigUnit: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 16,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.2,
  },
  durRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  durRangeText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.3,
  },
  /* Audio Library upsell — alleen zichtbaar voor bracelet-only owners.
     Subtiele accent-tinted card onderaan het idle-screen, voor de
     SimDemoBar. Niet opdringerig (geen full bg-fill), wel zichtbaar
     genoeg om te tappen. Operator-toevoeging 2026-05-30. */
  /* Huisstijl v4.4: decoratieve upsell-kaart, niet haptic/status — Royal Indigo. */
  audioUpsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(30,42,74,0.08)',
    borderColor: 'rgba(30,42,74,0.28)',
    borderWidth: 1,
    borderRadius: 14,
  },
  audioUpsellEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  audioUpsellTitle: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  audioUpsellSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 17,
  },
  audioUpsellArrow: {
    color: C.accent,
    fontSize: 22,
    fontFamily: BrandFonts.bold,
    marginLeft: 4,
  },
  /* Status row — minimal text-only met groene live-dot. Status-pill
     verwijderd 2026-05-27 (operator-feedback "pillen ouderwets"). */
  /* Operator, 16 september 2026 ("statusbalk strak trekken — klein, chic
     element direct onder de hoofdtitel, i.p.v. rommelig tegen de
     zijkanten geperst"): geen space-between-rij met losse Disconnect-
     link meer — één subtiele regel, dot + dunne tekst. Disconnect zit nu
     in het tandwiel-icoon in de header. */
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.success,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginTop: 8,
    marginBottom: 12,
  },

  /* Mode grid — 2-col vierkante cards met foto-achtergrond + gradient.
     flexBasis '48%' zonder flexGrow (anders strekt lone card op
     laatste rij zich uit). aspectRatio 1 = perfect vierkant.
     overflow:hidden essentieel zodat de absolute photo/gradient layers
     binnen de afgeronde tile-shape gecliped worden. */
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeTile: {
    flexBasis: '48%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.panel,
  },
  /* Background layer — photo OR mode-color gradient. Vult de hele
     tile via absoluteFillObject; resizeMode cover op de Image schaalt
     'm tot het kleinste passende formaat. */
  modeTilePhoto: {
    ...StyleSheet.absoluteFillObject,
  },
  /* Dark gradient overlay (alleen voor foto-cards) zodat de witte
     mode-naam onderaan altijd leesbaar is, ook bij lichte foto's. */
  modeTileOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  /* Content-layer: padding + spacing-distribution. Bovenop alle
     achtergrond-layers (zIndex impliciet door volgorde in JSX). */
  modeTileContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  modeTileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modeTileDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    /* Subtle white outline rond de dot zodat 'ie zichtbaar blijft tegen
       een foto die toevallig dezelfde kleur heeft (bv. blauwe dot op
       blauwe achtergrond). */
    borderColor: 'rgba(255,255,255,0.40)',
    borderWidth: 1,
  },
  /* Check-badge top-right bij selectie — gevulde kleur cirkel met
     witte ✓, hoog contrast tegen elke foto-achtergrond. */
  modeTileCheckWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTileCheckText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 14,
  },
  modeTileName: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    marginBottom: 4,
    /* Subtle text-shadow voor extra leesbaarheid op foto-achtergrond
       met variabele helderheid. */
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  modeTileDur: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* Operator, 16 september 2026 ("Apple Track" — brede, dikke capsule
     i.p.v. dun streepje + los stipje, zo dik als de Start-knop).
     sliderTouch IS nu zelf de track (bg + overflow:hidden + volle
     capsule-radius), geen apart dun trackje meer erbinnen. Horizontale
     margin van 20 blijft nodig zodat de balk bij waarde=min (x=0) NIET
     in Android's back-gesture-zone valt (eerste ~24dp vanaf links). */
  sliderTouch: {
    /* Operator, 16 september 2026: 52→44, daarna "schuifregelaar ook
       helft smaller" → 44→22. marginHorizontal:20 (Android-gesture-
       zone-marge) weg — durationSliderWrap is nu al een gecentreerde
       266px-breedte, ver van de schermrand, dus die marge is overbodig
       en zou de balk smaller maken dan de minuten-knoppen erboven. */
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(10,10,12,0.06)',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  /* Gevulde portie — een LinearGradient (lichter → dieper) i.p.v. een
     vlakke kleur, voor het "lichte bolling en glans"-effect. Radius
     matcht sliderTouch zodat de linkerkant netjes rond blijft nu
     overflow:hidden van de track af is (nodig voor de thumb hieronder). */
  sliderFilled: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 11,
  },
  /* Zichtbare witte thumb op het einde van de fill — operator: "niet
     duidelijk dat de minutebar scrollbaar is". Maakt in één oogopslag
     duidelijk dat dit een sleepbare regelaar is, niet enkel een balk.
     Blijft iets groter dan de (nu dunnere) track zelf — steekt er licht
     buiten uit, dat is juist wat 'm als grip leesbaar houdt. */
  sliderThumbHandle: {
    position: 'absolute',
    top: '50%',
    marginTop: -12,
    marginLeft: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  /* Warning chip (low battery in idle) */
  warnChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,159,10,0.10)',
    borderColor: 'rgba(255,159,10,0.30)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  warnChipIcon: {
    color: WARN,
    fontSize: 16,
  },
  warnChipText: {
    color: C.text,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    flex: 1,
  },

  /* GEWIJZIGD 4 oktober 2026: kleine, ondergeschikte vindbaarheids-link
     naar de Smart Bead Bracelet marketing-pagina (smart-bead-bracelet.tsx)
     — zelfde dimtekst-conventie als warnChipText/stateInfoDuration elders
     in dit bestand, bewust GEEN CTA-chrome (geen achtergrond/rand), dit
     scherm (Session Control) blijft de hoofdzaak. */
  braceletUpsellLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 10,
  },
  braceletUpsellLinkText: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
  },

  /* ── Active session screen (kalm, één focuspunt) ──────────────────── */
  /* activeScroll kept for legacy reference. Niet meer gebruikt sinds 9w. */
  activeScroll: {
    padding: 16,
    paddingTop: 14,
    paddingBottom: 16,
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  /* Iter 9w/9x/9y: vervangt ScrollView door fixed View. flex:1 =
     volledig beschikbaar scherm. paddingBottom RESERVEERT ruimte voor
     de absolute-positioned bottomBarDual zodat content er NOOIT
     onder kan vallen. space-around verdeelt content evenredig in de
     beschikbare ruimte erboven. */
  activeScreen: {
    flex: 1,
    padding: 16,
    paddingTop: 18,
    /* Iter 9bb: paddingBottom 24 voor ademruimte tussen breathwork-
       card en safe-zone / tab-bar. */
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  /* Timer-cirkel — 300px, omvat de ActivityRing (264) met ruimte over. */
  /* Iter 9bw: marginBottom 14 → 6 (–8px) zodat Pause/End buttons
     dichter onder de timer-cirkel komen en de breathwork-card meer
     bodem-ruimte heeft. */
  timerWrap: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    /* Operator, 5 okt 2026 ("cirkel mag ook een klein beetje zakken"). */
    marginTop: 28,
  },
  /* DrainingCircle's eigen SVG-doos — rond zodat de clip-path niet
     buiten de cirkel-vorm kan "lekken" op Android. Position absolute
     (zelfde "auto-centreren via de flex align/justify van timerWrap"-
     truc als pulseWrap) — anders duwt timerCenter er als normale flow-
     sibling onder, en schuift de bol uit het midden van de 300px-doos
     t.o.v. de wél-al-absolute SlowAmbientPulse. */
  drainOuter: {
    position: 'absolute',
    borderRadius: 110,
    overflow: 'hidden',
  },
  pulseWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  pulseCircleInner: {
    position: 'absolute',
  },
  /* ── CompletionModal ─────────────────────────────────────────── */
  completionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  /* State Control-afsluiting: volledig zwart scherm, gecentreerd (5 okt 2026). */
  completionFull: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
  },
  completionTitleLarge: {
    color: '#ffffff',
    fontSize: 30,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  completionDuration: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
    marginTop: 10,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  completionDoneWrap: {
    position: 'absolute',
    left: 26,
    right: 26,
  },
  completionBraceletLink: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  completionBraceletLinkTxt: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    textAlign: 'center',
  },
  completionBraceletLinkStrong: {
    color: '#ffffff',
    fontFamily: BrandFonts.semibold,
  },
  completionBtnWide: {
    backgroundColor: '#ffffff',
    width: '100%',
    height: 56,
    paddingVertical: 0,
    justifyContent: 'center',
  },
  completionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  /* ConnectedPopup — geen backdrop-press-to-dismiss (het is een
     zelf-dismissende bevestiging, geen keuze), lichte dim erachter zodat
     de kaart los van de pagina leest. */
  connectedPopupOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    /* Operator, 27 september 2026 ("yes connected staat bracelet onder,
       die bracelet moet weg"): zonder kaart erachter (zie
       ConnectedPopup) scheen de header-titel ("Bracelet") van het
       onderliggende scherm door de dunne 25%-dim heen. 0.25→0.94 —
       dekt het scherm er effectief achter af, zonder een zichtbaar
       kaart-paneel terug te introduceren.
       Operator, zelfde dag ("bracelet control blijft zichtbaar op
       achtergrond"): de popup rendert nu als overlay bovenop het al-
       omgewisselde scherm (Control/Active/etc.) i.p.v. bovenop het
       oude, effen-donkere Connect-scherm — de resterende 6% liet
       Control's veel fellere content (witte CTA, gekleurde ring)
       duidelijk doorschemeren. 0.94→1 (volledig opaak): niets van het
       onderliggende scherm is nog zichtbaar zolang de popup toont. */
    backgroundColor: '#000000',
  },
  connectedPopupCircle: {
    /* Operator, 27 september 2026 ("nu veel te groot, halveer"): 190→95,
       vinkje mee gehalveerd (zie render, 150→75).
       Operator, zelfde dag ("connected cirkel 40% groter"): 95→133,
       enkel de cirkel (vinkje blijft op 75). */
    width: 133,
    height: 133,
    borderRadius: 66.5,
    /* Operator, 27 september 2026 ("yes connected mag ook in onze
       accentkleur" → daarna correctie "kom jij weer met dat blauw af"):
       Signal Blue was fout — dat kanaal is strikt de haptic-puls/"nu
       actief"-rol (zie huisstijl-memory). Bio-Teal (`AudioAccent`) is
       de echte, enige accentkleur van de app. */
    backgroundColor: AudioAccent,
    alignItems: 'center',
    justifyContent: 'center',
    /* Nu de cirkel zelf groot genoeg is om het vinkje te bevatten, is de
       extra marge van hierboven niet meer nodig — normale afstand tot
       de tekst eronder. */
    marginBottom: 18,
  },
  connectedPopupText: {
    /* Operator, 27 september 2026: geen kaart-achtergrond meer (zie
       ConnectedPopup) — tekst rendert nu los op de (nu bijna-opake)
       overlay, dus wit i.p.v. C.text. Grootte teruggedraaid naar 17
       ("yes connected mag niet groter"). */
    color: '#ffffff',
    fontSize: 17,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.2,
  },
  completionCard: {
    width: '85%',
    maxWidth: 380,
    backgroundColor: C.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 28,
    alignItems: 'center',
  },
  /* Iter v181 (2026-07-02): Buddha-figuur boven eyebrow (consistent met
     Breath tab completion). Statische Image, geen animatie — kleiner
     complexity, geen unmount-issues in modal. */
  completionBuddha: {
    width: 84,
    height: 84,
    marginBottom: 12,
  },
  completionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  completionIconText: {
    fontSize: 30,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 34,
  },
  completionTitle: {
    color: C.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  completionMode: {
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  completionMsg: {
    color: C.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  /* Iter v168 (2026-06-28): styling identiek aan breath.tsx completion. */
  completionEyebrow: {
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.4,
    textAlign: 'center',
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  completionSubtitle: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    textAlign: 'center',
    marginBottom: 18,
  },
  completionMsgLine1: {
    color: C.text,
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  completionMsgLine2: {
    color: C.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  completionBtn: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    minWidth: 160,
    alignItems: 'center',
  },
  completionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  /* Position absolute — overlapt de (ook absolute) DrainingCircle/
     SlowAmbientPulse i.p.v. eronder te stapelen als normale flow-
     sibling in timerWrap's kolom. */
  timerCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* PAUSED-eyebrow, alleen zichtbaar tijdens pauze — nu IN de ring,
     boven de mode-naam-rij (operator, 16 september 2026: "timer en info
     moet in de bol"). */
  pausedLabel: {
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
  },
  /* Mode-dot + naam-rij — nu IN de ring, boven de mm:ss. */
  /* Volle breedte zodat de chevron links kan staan terwijl de modusnaam
     gecentreerd blijft. */
  activeHeaderRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizeChevron: {
    position: 'absolute',
    left: 4,
    top: -4,
    padding: 4,
  },
  activeModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    /* Operator, 27 september 2026 ("tekst calm control moet boven de
       cirkel komen"): stond hier al op 6 toen dit nog INSIDE de ring
       stond (kort onder PAUSED-label); nu als los element BOVEN de
       240px-ring iets meer ademruimte. */
    marginBottom: 16,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeName: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  /* Cijfers krijgen een zachte, gecentreerde glow-schaduw (via
     timerColorOverride op de call site) i.p.v. platte tekst — de
     DrainingCircle-vulling erachter wisselt van niveau, dus platte
     tekst zonder contrast-truc zou tegen bepaalde vulniveaus
     onleesbaar worden.
     Operator, 16 september 2026 ("bij aftellen zit er veel beweging in
     de cijfers"): Inter's cijfers zijn niet standaard proportioneel-
     gelijk breed — "1" is smaller dan "8" — dus elke seconde-tik
     veranderde de tekstbreedte en schoof het gecentreerde blok zichtbaar
     heen en weer. fontVariant tabular-nums dwingt vaste cijferbreedte af
     (zelfde als CSS font-variant-numeric: tabular-nums), zodat de
     positie stabiel blijft. */
  timerNum: {
    fontSize: 68,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -2.5,
    lineHeight: 72,
    fontVariant: ['tabular-nums'],
  },
  timerUnit: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  /* "of X:XX" — context-regel onder de timer-unit. */
  timerTotal: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.4,
    marginTop: 6,
  },
  /* BreathingHint — synced met PulsingCircle's 6s cyclus. Smaller +
     dimmer 2026-05-27 (operator-feedback "tekst te druk"). Heeft minder
     visueel gewicht zodat het de timer niet beconcurreert. */
  breatheHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.3,
    marginTop: 0,
    marginBottom: 10,
  },
  /* Inline notice direct onder PAUSED-label — verschijnt alleen als
     resume de duration zal verhogen (BLE-spec minimum). Kleine, gedimde
     tekst — informatief, niet alarmerend. */
  pausedNote: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 22,
    paddingHorizontal: 24,
    maxWidth: 320,
  },
  /* Restart-link — kleine tertiaire actie tijdens active/paused. Geen
     button-look, gewoon een tappable tekstlink met icoon. */
  restartLink: {
    marginTop: 28,
    paddingVertical: 10,
  },
  restartLinkText: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  /* Bottom-bar variant met 2 knoppen naast elkaar (Pause+End of
     Resume+End). flex:1 op de buttons via de actionBtn-styles. */
  /* bottomBarDual deprecated — verwijderd iter 9aa. Inline action-row
     vervangt 'm direct onder de pulse-ring. */
  bottomBarDual: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  /* Operator, 16 september 2026 ("ik vind de pils niet mooi, maak 1
     ronde pauze-knop en eronder end session, niet in pil"): terug naar
     kolom-layout — enkele ronde Play/Pause-knop, "End session" als
     tekst-link eronder. */
  /* Operator, 5 okt 2026 ("play en end session minstens 3 cm laten
     zakken"): marginTop 'auto' duwt Play + End session naar de onderkant
     van het scherm (net boven de tab-balk) i.p.v. vlak onder de cirkel —
     werkt op elke schermhoogte, geen vaste afstand. */
  /* Zelfde maten als breath-session.tsx (pauseMain/pauseMainTint/endTxt). */
  /* 64 → 72, en meer lucht tot END SESSION (operator, 6 okt 2026) —
     ademsessie en State Control blijven gelijk. */
  pauseMain: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  pauseMainTint: { opacity: 0.2 },
  endTxtWrap: { marginTop: 22 },
  iosKeepOpen: {
    marginTop: 14,
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  endTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: 'rgba(255,255,255,0.72)',
  },
  sessionControlColumn: {
    alignItems: 'center',
    marginTop: 'auto',
    width: '100%',
  },
  roundActionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundActionBtnOutline: {
    borderWidth: 1.5,
  },
  /* Operator, 17 september 2026 ("twee gelijke capsules, Minimize
     zachtgrijs, End transparant met rood randje"): twee even-brede
     capsule-knoppen naast elkaar, direct onder de pauzeknop.
     Operator, 27 september 2026 ("de pills moeten ook onder elkaar"):
     row → column — Minimize en End session staan nu gestapeld i.p.v.
     naast elkaar. */
  secondaryActionsRow: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 18,
    paddingHorizontal: 24,
    width: '100%',
  },
  capsuleBtnSecondary: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Minimize — de "veilige" standaardactie: zachtgrijze vulling, zoals
     het vlak achter het tandwiel-icoon elders op dit scherm. */
  capsuleBtnMinimize: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  /* Operator, 17 september 2026 ("deze pagina moet altijd rustig zijn,
     geen negatieve kleuren"): rood randje weg — dit scherm gebruikt
     bewust nooit een waarschuwings-/gevaar-kleur, ook niet voor End.
     Transparant + neutraal wit/grijs randje, onderscheiden van Minimize
     puur door de afwezigheid van een gevuld vlak (nog altijd de
     "voorzichtiger" van de twee, zonder een kleur die onrust suggereert). */
  capsuleBtnEnd: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  capsuleBtnSecondaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
  /* Iter 9ac (2026-05-31): preview-mode header voor non-owners. Row met
     left "← Exit preview" pill + right "PREVIEW" badge zodat user direct
     ziet (a) waar 'ie is en (b) hoe 'ie eruit komt. Pill = subtiel maar
     tap-target groot genoeg; badge = compacte status-text. */
  previewExitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  /* Operator, 16 september 2026: witte rgba-vlak/rand → onzichtbaar op
     de nu lichte achtergrond. */
  previewExitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,12,0.04)',
    borderColor: 'rgba(10,10,12,0.14)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  previewExitArrow: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    lineHeight: 17,
  },
  previewExitText: {
    color: C.text,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.3,
  },
  previewExitBadge: {
    color: C.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.4,
  },
  /* Iter v149 v5 (2026-06-25): VIBEZCORE-style End session modal. */
  endModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  endModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0f0f0f',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 22,
  },
  endModalTitle: {
    color: C.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  endModalBody: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
    marginBottom: 20,
  },
  endModalBtnPrimary: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  endModalBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  endModalBtnDestructive: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.45)',
    backgroundColor: 'rgba(239,68,68,0.10)',
    marginBottom: 10,
  },
  endModalBtnDestructiveText: {
    color: C.error,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
  endModalBtnCancel: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  endModalBtnCancelText: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  /* Outlined neutrale action button — voor End/Pause. Iter 8b refinement
     voor professioneler gevoel: stevigere padding, hogere border-
     contrast, grotere min-height = forse touch-target. */
  actionBtnOutlined: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  actionBtnOutlinedText: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  /* Filled action button — Resume in paused state. Mode-color fill,
     matched height met outlined zodat ze visueel uitgelijnd zijn. */
  actionBtnFilled: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  actionBtnFilledText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  /* Iter 8b — bullet-list voor "Use this for". Mode-color dot per item,
     nette regelruimte. Vervangt vorige inline-dot-separators. */
  idealsList: {
    marginBottom: 14,
    gap: 8,
  },
  idealsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  idealsBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  idealsText: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  /* Sim demo bar tijdens active session — kleinere padding, onderin
     tussen scroll-content en stop-button. Niet langer "in your face". */
  activeDemoBar: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 0,
    opacity: 0.6,
  },

  /* Stats-strip — 3-koloms rustig display met hairline dividers tussen
     cells. Geen card-box; alleen typografie + dividers zoals Apple
     Health-stats. Werkt op zowel idle (boven mode-grid) als active
     (onder de timer). */

  /* History-link onder de stats-strip op idle screen. Subtle, tertiair. */
  historyLink: {
    marginTop: 14,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  historyLinkText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
  statsStripWrap: {
    marginTop: 22,
    marginBottom: 0,
    /* Op de active-screen heeft de parent ScrollView alignItems:'center'
       waardoor children krimpen tot content-breedte. width:'100%' dwingt
       de strip full-width zodat de labels niet meer wrappen. Werkt ook
       op idle-screen waar er geen alignItems:'center' is. */
    width: '100%',
  },
  /* Eyebrow boven de stats wanneer mode-specifiek — bv. "CALM CONTROL
     STATS". Klein, dim, geeft context dat deze cijfers alleen voor
     deze mode tellen. */
  statsEyebrow: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
  },
  statsCell: {
    flex: 1,
    alignItems: 'center',
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statsNum: {
    color: C.text,
    fontSize: 20,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 3,
  },
  /* Stats-label gestileerd als uppercase eyebrow 2026-05-27 — geeft
     meer visuele hiërarchie (groot getal > klein label) zodat de strip
     minder als "drie even-zware woorden" leest. */
  statsLbl: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  /* ── Searching / Not connected screen ──────────────────────────────── */
  searchingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  searchingDots: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  searchingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  searchingDotActive: {
    backgroundColor: C.accent,
  },
  /* Operator, 16 september 2026 ("schuif de teksten dichter bij elkaar,
     als één blok — uitleg mag fractie kleiner en iets lichter"): titel
     en subtekst lazen los van elkaar. marginBottom 10→4 groepeert ze
     visueel; subtekst 14→13px en een lichtere grijstint dan de gewone
     C.textDim geeft meer rust/hiërarchie onderin het scherm. */
  searchingTitle: {
    color: C.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  searchingSub: {
    color: 'rgba(10,10,12,0.38)',
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  /* ── Charging screen ───────────────────────────────────────────────── */
  chargingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  chargingIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(74,222,128,0.10)',
    borderColor: 'rgba(74,222,128,0.30)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  chargingIconText: {
    fontSize: 38,
  },
  chargingTitle: {
    color: C.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  chargingSub: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: 30,
  },
  chargingStats: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  chargingStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  chargingStatLabel: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
  },
  chargingStatVal: {
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },

  /* ── Fault screen ──────────────────────────────────────────────────── */
  faultWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  faultIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.30)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  faultIconText: {
    color: C.error,
    fontSize: 40,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 44,
  },
  faultTitle: {
    color: C.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  faultSub: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },

  /* ── Bottom action bar (sticky) ──────────────────────────────────── */
  /* Operator v14 (2026-05-31): paddingBottom verhoogd van 12 → 76
     (= tab-bar height 64 + 12 buffer). BraceletControl wordt nu
     primair inline in de Bracelet TAB gerendert (voor owners), waar
     de tab-bar onderaan overlay is. Zonder extra padding zit de
     "Connect"-knop achter de tab-bar. */
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 76,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: C.bg,
  },
  /* Operator ("premium apple stijl"): achtergrond was C.accent (Signal
     Blue/Royal Indigo) — een CTA-achtergrond is NOOIT de accentkleur
     (huisstijl §3, "altijd wit + donkere tekst"). Tekstkleur mee
     aangepast van wit naar donker. */
  runningBar: {
    gap: 10,
  },
  switchBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  switchCard: {
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
  },
  switchTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  switchBody: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  switchBtn: {
    width: '100%',
  },
  switchCancel: {
    alignSelf: 'center',
    marginTop: 14,
    paddingVertical: 4,
  },
  switchCancelTxt: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
  },
  runningDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  primaryBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#1D1D1F',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  /* Operator, 16 september 2026: witte rgba-vlak/rand waren afgestemd op
     een donkere achtergrond — bijna onzichtbaar geworden op de nu
     lichte pagina (dit is de Connect/Retry-knop op het zoek-scherm). */
  outlinedBtn: {
    backgroundColor: 'rgba(10,10,12,0.03)',
    borderColor: 'rgba(10,10,12,0.16)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  outlinedBtnText: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  startBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  startBtnArrow: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: BrandFonts.bold,
  },
  /* Iter 8b: inline Start-knop direct onder de slider. Niet meer sticky
     bottom — voelt natuurlijker als follow-up op de duration-keuze.
     Volledige rij-breedte, mode-color fill, prominent CTA. */
  startBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    marginTop: 18,
    marginBottom: 4,
  },
  stopBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.40)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stopBtnText: {
    color: C.error,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  btnDisabled: { opacity: 0.5 },

  /* ── Sim demo bar — minimal text-only met dot separators ────────── */
  demoBox: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    opacity: 0.65,
  },
  demoTitle: {
    color: C.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  demoLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  demoLink: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  demoLinkText: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
  },
  demoSep: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    marginHorizontal: 4,
  },
});
