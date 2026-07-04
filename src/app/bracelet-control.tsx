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

import { BraceletActivationCta } from '@/components/BraceletActivationCta';
import { PreviewBanner } from '@/components/PreviewBanner';
import { Brand, BrandFonts } from '@/constants/theme';
import {
  recordSession,
  useBraceletStats,
} from '@/utils/bracelet-history';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BleCommand,
  BleConnectionState,
  BleStatusPacket,
  BraceletMode,
  MODES,
  ModeMeta,
  clampDuration,
  getModeMeta,
} from '../services/ble-contract';
import { getBracelet, getSimHooks } from '../services/bracelet';
import {
  playBraceletStartCue,
  playBraceletCompletionCue,
  stopBraceletVoice,
} from '@/services/bracelet-voice';
import { claimVoiceSource, playBreathCue, playCompletionCue as playBreathCompletionCue, releaseVoiceSource } from '@/services/breath-voice';
import { useSetting } from '@/utils/settings';
import { Volume2, VolumeX } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import {
  useBraceletOwner,
  useDevBraceletActivated,
} from '@/utils/dev-user-override';

/* MERK_ANKER §2 levert geen "warn"-kleur. Voor de battery-warn drempel
   (5–20%) gebruiken we de Sharp Focus oranje uit CLAUDE.md §5. */
const WARN = '#FF9F0A';

/* App polls status every 5 seconds when connected (spec §8.3/§11.4). */
const POLL_MS = 5000;

/* Per-mode background photo (Bunny CDN). Operator-uploads — 3 van 5 geleverd
   op 2026-05-27, Sharp Focus + Clarity volgen. Modes zonder foto vallen
   visueel terug op een mode-color gradient zodat de grid cohesive blijft.
   Wanneer operator nieuwe foto's uploadt: alleen URL hier toevoegen, geen
   andere wijzigingen nodig. */
const MODE_IMAGES: Partial<Record<BraceletMode, string>> = {
  [BraceletMode.Gamma]:
    'https://vibezcore-audio.b-cdn.net/images/gamma%20pic.jpg',
  /* Iter 9ak (2026-05-31): Beta/Sharp Focus foto gewisseld naar
     operator-bewerkte "welcome new.png". Dezelfde foto wordt nu ook
     op het welkomstscherm gebruikt → visuele consistentie tussen
     entry-point en bracelet mode-card. */
  [BraceletMode.Beta]:
    'https://vibezcore-audio.b-cdn.net/images/welcome%20new.png',
  [BraceletMode.Alpha]:
    'https://vibezcore-audio.b-cdn.net/images/Social%20mastery.jpg',
  [BraceletMode.Theta]:
    'https://vibezcore-audio.b-cdn.net/images/confident-man-with-beard-mustache-smiling-generated-by-ai.jpg',
  [BraceletMode.Delta]:
    'https://vibezcore-audio.b-cdn.net/images/Rest%20%26%20Reset%20Delta.jpg',
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
     - Rest & Reset (Delta): 7s/7s = ~4.3 BPM, slaap-voorbereiding
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
   lange uitademing. Iter 9e: vervangt 4-7-8 voor Rest & Reset (operator-
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
     Delta (Rest & Reset) → rest: 4-7-8-0 nose/mouth, 12 cycli (4-7-8) */
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
  /* Rest & Reset = 4-7-8. 12 cycli × 19s = ~4 min. Wind-down protocol. */
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

/* Aantal fasen per cyclus per protocol-kind — gebruikt door
   BreathworkStrip om correct te tellen en juiste prompts te tonen. */
function breathPhasesPerCycle(p: Protocol): number {
  switch (p.kind) {
    case 'simple':
      return 2;
    case 'box':
      return 4;
    case '478':
      return 3;
    case 'nadi':
      return 4;
    case 'sigh':
      return 3;
    case 'triangle':
      return 3;
  }
}

/* Per-mode benefit-copy voor de BreathworkStrip. State-language only
   (CLAUDE.md §1) — geen medische claims, geen "activates X system" of
   "lowers cortisol". Communiceert wat de gebruiker beoogt zonder
   pseudo-wetenschap. Wordt getoond in zowel OFF (als uitnodiging) als
   ON (als context-anker tijdens de oefening). */
const BREATH_BENEFIT: Record<BraceletMode, string> = {
  [BraceletMode.Gamma]: 'Channel the energy into precise action.',
  [BraceletMode.Beta]: 'Anchor your attention through pacing.',
  [BraceletMode.Alpha]: 'Pace your breath to deepen calm.',
  [BraceletMode.Theta]: 'Slow your breath to widen perception.',
  [BraceletMode.Delta]: 'Lengthen your breath to unwind.',
};

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
/* Per-mode quotes — rusten op de bodem van de active-session screen,
   roteren elke 22s met soft fade. Stoïsche / brand-aligned korte
   zinnen die de mode-intentie versterken zonder pushy te zijn. */
const MODE_QUOTES: Record<BraceletMode, string[]> = {
  [BraceletMode.Gamma]: [
    'Channel the surge.',
    'Speed serves precision.',
    'Sharpen the edge.',
  ],
  [BraceletMode.Beta]: [
    'One task. Full presence.',
    'Depth over speed.',
    'The work, not the noise.',
  ],
  [BraceletMode.Alpha]: [
    'Calm is the new sharp.',
    'Steady mind, clear path.',
    'Pressure passes through you.',
  ],
  [BraceletMode.Theta]: [
    'Slow the mind, find the answer.',
    'Insight arrives in stillness.',
    'Let the thought come to you.',
  ],
  [BraceletMode.Delta]: [
    'Recovery is part of the work.',
    'Let it all settle.',
    'Sleep is where growth happens.',
  ],
};

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
/* Iter v155 (2026-06-25): protocol-strings + protocolHow 1:1 IDENTIEK
   met breath-tab PATTERNS. Operator wil exact dezelfde breathwork in
   bracelet active page als in breath tab. */
const MODE_DESCRIPTIONS: Record<BraceletMode, ModeDescription> = {
  [BraceletMode.Gamma]: {
    intent: 'Alert, energized — primed for high-output moments.',
    braceletDoes:
      'Sharp, brisk haptic pulses wake the system up and break through fatigue.',
    protocol: 'Energizing breath 2-2 · 3 min',
    protocolHow:
      'Quick rhythmic in-out breathing. Inspired by Bhastrika pranayama — builds alertness through faster pace.',
  },
  [BraceletMode.Beta]: {
    intent: 'Locked-in focus — attention that holds the line.',
    braceletDoes:
      'Steady rhythmic haptic anchors your attention to one task at a time.',
    protocol: 'Coherent breath 5-5 · 5 min',
    protocolHow:
      'Inhale 5 seconds, exhale 5 seconds. Six breaths per minute — a resonance pace used in focus-research traditions.',
  },
  [BraceletMode.Alpha]: {
    intent: 'Steady and composed — alert but relaxed.',
    braceletDoes:
      'Slow gentle pulses guide the system toward calm without dulling alertness.',
    protocol: 'Box breath 4-4-4-4 · 5 min',
    protocolHow:
      'Inhale 4, hold 4, exhale 4, hold 4. Used by special forces for stress recovery — the symmetric holds slow the system down.',
  },
  [BraceletMode.Theta]: {
    intent: 'Quieter mind — space for thought, decompression.',
    braceletDoes:
      'Soft undulating haptic invites an inward turn and lets mental noise settle.',
    protocol: 'Long-exhale 4-2-6 · 4 min',
    protocolHow:
      'Inhale 4, brief 2-second hold, exhale 6 through the mouth. Inspired by extended-exhale practices used in reflection traditions.',
  },
  [BraceletMode.Delta]: {
    intent: 'Wind-down — recovery, pre-sleep, after stressful days.',
    braceletDoes:
      'Slow restful haptic pattern eases the system toward recovery mode.',
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

/* ── DurationFillCircle — cirkel met water-fill voor idle screen ──
   Vervangt het platte getal-onder-titel. Cirkel-shape vult zich van
   onderen op met mode-color naarmate de slider-waarde dichter bij
   max komt. Op min: cirkel bijna leeg. Op max: cirkel volledig
   gevuld in mode-color. Number stays centraal in wit (rust). */
function DurationFillCircle({
  value,
  min,
  max,
  color,
  size,
}: {
  value: number;
  min: number;
  max: number;
  color: string;
  /** Optional diameter override. Default 180. Iter 9b: 92 voor de
   *  compactere idle-screen layout. */
  size?: number;
}) {
  const fillPct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const dim = size ?? 180;
  const numFont = size ? size * 0.36 : 50;
  const unitFont = size ? Math.max(8, size * 0.10) : 11;
  /* Iter 9m: contrast-fix voor lichte mode-colors (Boost wit). Bij
     hoge fillPct (>50%) staat tekst grotendeels op de witte fill →
     gebruik donkere tekst. Bij lage fillPct staat tekst op donkere bg
     → witte tekst werkt. */
  const light = isLightColor(color);
  const textColor = light && fillPct > 40 ? '#0a0a0a' : Brand.text;
  return (
    <View
      style={[
        s.durFillOuter,
        { width: dim, height: dim, borderRadius: dim / 2 },
      ]}
    >
      <View style={s.durFillTrack}>
        <View
          style={[
            s.durFillBar,
            { height: `${fillPct}%`, backgroundColor: color },
          ]}
        />
      </View>
      <View style={s.durFillContent}>
        <Text
          style={[
            s.durFillNum,
            {
              fontSize: numFont,
              lineHeight: numFont * 1.05,
              color: textColor,
            },
          ]}
        >
          {value}
        </Text>
        <Text
          style={[s.durFillUnit, { fontSize: unitFont, color: textColor }]}
        >
          min
        </Text>
      </View>
    </View>
  );
}

/* ── DrainingCircle — fill die leegloopt tijdens active session ──
   Tegenovergesteld aan ProgressArc: arc vult clockwise als time
   verloopt; deze drain leegt als time verloopt. Geeft user gevoel
   "time leaks out of me". Bij sessie-start: vol mode-color. Bij
   einde: empty. Klein subtiel, zit achter de PulsingCircle's
   breathing-border voor mooie depth-layering. */
/* DrainingCircle — water-fill metaphor voor sessie-progress. Iter 7
   (2026-05-27): SVG-based ipv View-clipping zodat het wateroppervlak
   een animerende sine-wave kan hebben ("zakken alsof het waves zijn",
   operator-feedback). Twee golven over elkaar (verschillende
   amplitudes/snelheden) → realistischer water-feel zonder zwaar te
   worden. */
const AnimatedPath = Animated.createAnimatedComponent(Path);

function DrainingCircle({
  progress,
  color,
  size,
}: {
  /** 0..1 — fractie van de sessie die voorbij is */
  progress: number;
  color: string;
  size: number;
}) {
  const remainingFrac = Math.max(0, Math.min(1, 1 - progress));
  const waterTopY = size * (1 - remainingFrac); // hoger getal = lager water

  /* Twee phase-trackers voor de twee golven — verschillende periodes
     zodat ze van elkaar wegdrijven (looks natural, niet symmetrisch). */
  const wave1Phase = useRef(new Animated.Value(0)).current;
  const wave2Phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop1 = Animated.loop(
      Animated.timing(wave1Phase, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: false, // path 'd' attribute kan niet via native driver
      }),
    );
    const loop2 = Animated.loop(
      Animated.timing(wave2Phase, {
        toValue: 1,
        duration: 6200,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop1.start();
    loop2.start();
    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [wave1Phase, wave2Phase]);

  /* Genereer een sine-wave path string op basis van phase ∈ [0, 1].
     amp = amplitude (max ±pixels), periode = aantal golven over de breedte.
     topOffset = verschuif de baseline X px naar beneden (positief).
     Iter 9cf (2026-05-31): M startpunt op de EERSTE wave-y i.p.v. op
     waterTopY → geen vertical M→L1 sliver meer.
     Iter 9cg (2026-05-31): topOffset toegevoegd zodat back-wave een
     lagere baseline kan krijgen dan front-wave → back nooit meer boven
     front uit, geen kleur-bleed door 55%-opacity over de waterlijn. */
  const buildWavePath = (
    phase: number,
    amp: number,
    periods: number,
    topOffset: number = 0,
  ): string => {
    const steps = 24;
    const baseline = waterTopY + topOffset;
    const firstY = baseline + Math.sin(phase * Math.PI * 2) * amp;
    let d = `M 0 ${firstY.toFixed(2)}`;
    for (let i = 1; i <= steps; i++) {
      const x = (i / steps) * size;
      const y =
        baseline +
        Math.sin((i / steps) * Math.PI * 2 * periods + phase * Math.PI * 2) *
          amp;
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    /* Sluit het pad af naar onderkant zodat de hele water-area kleurt. */
    d += ` L ${size} ${size} L 0 ${size} Z`;
    return d;
  };

  /* Interpoleer phase-strings reactief — RN Animated kan geen strings
     interpoleren, dus we gebruiken een listener-pattern: phase-value
     trigger setState die path regenereert. Twee state-getalwaardes voor
     de twee golven. */
  const [phase1Val, setPhase1Val] = useState(0);
  const [phase2Val, setPhase2Val] = useState(0);
  useEffect(() => {
    const id1 = wave1Phase.addListener(({ value }) => setPhase1Val(value));
    const id2 = wave2Phase.addListener(({ value }) => setPhase2Val(value));
    return () => {
      wave1Phase.removeListener(id1);
      wave2Phase.removeListener(id2);
    };
  }, [wave1Phase, wave2Phase]);

  /* Iter 9cg (2026-05-31): back-wave (path2) krijgt baseline-offset +6
     en kleinere amplitude (1). Front-wave max-up = waterTopY - 3, back-
     wave max-up = (waterTopY+6) - 1 = waterTopY + 5 → back ZIT ALTIJD
     onder front-trough → geen zichtbare bleed boven de waterlijn meer.
     Visueel houden we wel het diepte-effect want back is nog zichtbaar
     in het body van de water-mass (donkerder ondertoon). */
  const path1 = buildWavePath(phase1Val, 3, 2, 0);
  const path2 = buildWavePath(phase2Val, 1, 3, 6);

  return (
    <View
      style={[
        s.drainOuter,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <ClipPath id="circleClip">
            <Circle cx={size / 2} cy={size / 2} r={size / 2} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#circleClip)">
          {/* Achter-golf — iets dimmer, andere snelheid, verschoven. */}
          <Path d={path2} fill={color} opacity={0.55} />
          {/* Voor-golf — vol-kleur, primaire wateroppervlak. */}
          <Path d={path1} fill={color} opacity={0.95} />
        </G>
      </Svg>
    </View>
  );
}

/* RotatingArc verwijderd 2026-05-27 iter 8: operator-feedback "geen aparte
   draaiende boog, de cirkel zelf moet draaien". Rotatie zit nu in
   SlowAmbientPulse. */

/* ── SearchingPulse — radar-style animatie tijdens scanning/connecting ──
   Iter 8b operator-feedback: "anilmatie toevoegen voor geval het aan het
   zoeken is zodat men weet dat het aan het zoeken is". Drie concentrische
   ringen die om de beurt expanderen + fade-out (1.5s elk, staggered 0.5s),
   plus een centrale bracelet-icoon-dot. Geeft het radar-zoek-gevoel:
   pulse, pulse, pulse, naar buiten. Pure SVG + Animated, geen externe lib. */
function SearchingPulse({ color = Brand.accent }: { color?: string }) {
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

  const ringStyle = (val: Animated.Value) => ({
    position: 'absolute' as const,
    width: 140,
    height: 140,
    borderRadius: 70,
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
    <View
      style={{
        width: 140,
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 36,
      }}
      pointerEvents="none"
    >
      <Animated.View style={ringStyle(v1)} />
      <Animated.View style={ringStyle(v2)} />
      <Animated.View style={ringStyle(v3)} />
      {/* Centrale dot in mode-accent kleur */}
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
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
  onChoose,
  onClose,
}: {
  mode: BraceletMode;
  onChoose: () => void;
  onClose: () => void;
}) {
  const meta = getModeMeta(mode);
  const desc = MODE_DESCRIPTIONS[mode];
  const ideals = MODE_IDEALS[mode];
  const light = isLightColor(meta.color);
  const ctaTextColor = light ? '#0a0a0a' : '#ffffff';
  /* Iter 9m: respecteer bottom safe-area (home-indicator iOS, nav-bar
     Android) zodat de CTA niet onder system-UI valt. */
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.modeModalRoot}>
        {/* Backdrop — tap-anywhere-to-close */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close mode details"
        />
        {/* Bottom sheet card */}
        <View
          style={[
            s.modeModalSheet,
            /* Iter 9dq v77 (2026-06-03): geharmoniseerde formule met
               floor 72 → consistent met alle andere bottom-CTAs. */
            { paddingBottom: Math.max(insets.bottom + 24, 72) },
          ]}
        >
          <View style={s.modeModalHandle} />

          {/* Close ✕ top-right */}
          <Pressable
            style={s.modeModalClose}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close"
          >
            <Text style={s.modeModalCloseText}>✕</Text>
          </Pressable>

          {/* Header — dot + naam + intent-zin */}
          <View style={s.modeModalHeader}>
            <View
              style={[s.modeModalDot, { backgroundColor: meta.color }]}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.modeModalName}>{meta.name}</Text>
              <Text style={s.modeModalSub}>
                {meta.minMinutes}–{meta.maxMinutes} min session
              </Text>
            </View>
          </View>

          {/* Intent — what state this mode is for */}
          <Text style={s.modeModalIntent}>{desc.intent}</Text>

          {/* How the bracelet helps — state-language description */}
          <Text style={s.modeModalSectionLbl}>How the bracelet helps</Text>
          <Text style={s.modeModalDesc}>{desc.braceletDoes}</Text>

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

          {/* Optional breath layer — verhuisd naar onderaan (iter 9l):
              bracelet is hoofd-ervaring, breath is een aparte laag. */}
          <Text style={s.modeModalSectionLbl}>Optional breath layer</Text>
          <Text style={[s.modeModalProtocol, { color: meta.color }]}>
            {desc.protocol}
          </Text>
          <Text style={s.modeModalProtocolHint}>{desc.protocolHow}</Text>

          {/* Choose CTA — selects + closes */}
          <Pressable
            style={[
              s.modeModalCta,
              { backgroundColor: meta.color },
              light && {
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.20)',
              },
            ]}
            onPress={onChoose}
            accessibilityLabel={`Choose ${meta.name}`}
          >
            <Text style={[s.modeModalCtaText, { color: ctaTextColor }]}>
              Choose {meta.name}
            </Text>
            <Text style={[s.modeModalCtaArrow, { color: ctaTextColor }]}>
              →
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CompletionModal({
  mode,
  onDismiss,
}: {
  mode: BraceletMode;
  onDismiss: () => void;
}) {
  const meta = getModeMeta(mode);
  const msg = COMPLETION_MESSAGES[mode];

  /* Subtle fade-in voor het hele paneel */
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View style={[s.completionOverlay, { opacity }]}>
      <Pressable
        style={s.completionBackdrop}
        onPress={onDismiss}
        accessibilityLabel="Dismiss completion"
      />
      <View style={s.completionCard}>
        {/* Iter v181 (2026-07-02): Buddha-figuur toegevoegd voor visuele
            parity met Breath tab en breathwork completion in deze zelfde
            file (§2926+). Operator: "popup breathwork mist budha in bracelet
            active" — deze CompletionModal (natural completion) had 'm nog
            niet. Nu wel: exact zelfde Bunny-URL asset als breath.tsx. */}
        <Image
          source={{ uri: 'https://vibezcore-audio.b-cdn.net/images/buddha%20.png' }}
          resizeMode="contain"
          style={s.completionBuddha}
        />
        {/* Iter v168 (2026-06-28): popup-layout uitgelijnd met Breath tab
            completion. Eyebrow + 'Well done.' + 'You completed X' subtitle
            + line1/line2 messages — exact dezelfde structuur en copy als
            (tabs)/breath.tsx. Voorheen had bracelet een eigen check-icon
            + 'Session complete' + één-regelige msg → operator wees dit
            af als 'zelf gegenereerd'. */}
        <Text style={[s.completionEyebrow, { color: meta.color }]}>
          ✦ CONGRATULATIONS ✦
        </Text>
        <Text style={s.completionTitle}>Well done.</Text>
        <Text style={s.completionSubtitle}>
          You completed {meta.name}
        </Text>
        <Text style={s.completionMsgLine1}>{msg.line1}</Text>
        <Text style={s.completionMsgLine2}>{msg.line2}</Text>
        <Pressable
          style={[s.completionBtn, { backgroundColor: meta.color }]}
          onPress={onDismiss}
          accessibilityLabel="Done"
        >
          {/* Iter 2026-06-05: contrast-fix voor light modes (Boost = wit).
              Witte tekst op witte achtergrond = onzichtbaar. Voor light
              mode-colors switchen we naar zwarte tekst, anders houden we
              wit (bestaand gedrag voor dark modes). */}
          <Text
            style={[
              s.completionBtnText,
              isLightColor(meta.color) && { color: '#0a0a0a' },
            ]}
          >
            Done
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/* ── DurationSlider — horizontale snap-to-int slider ──
   Vervangt de oude +/- stepper. Drag of tap om duration te wijzigen.
   Snap op hele minuten binnen de mode's [min, max] range. Track
   neutraal grijs, gevulde portion + thumb-border in mode-color voor
   visuele mode-identiteit. Pure JS via PanResponder — geen native
   dependency.

   Iter 9bc → 9bd (2026-05-31) — pageX-based coordinate fix:
   - locationX uit nativeEvent is op Android berucht: bij capture door
     een parent geeft 'ie soms positie relatief tot ORIGINEEL aangeraakte
     child (de thumb) i.p.v. tot de responder. Daar danst de thumb dan
     op tijdens drag.
   - Nu: pageX (absolute screen-coord) + measured slider-pageX → echte
     relatieve positie tov de slider. Robuust over iOS én Android.
   - PanResponder + setFromX blijven stabiel via refs (1 keer aangemaakt). */
function DurationSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  /* Refs voor PanResponder-closure stabiliteit. */
  const widthRef = useRef(0);
  const sliderPageXRef = useRef(0);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  minRef.current = min;
  maxRef.current = max;
  valueRef.current = value;
  onChangeRef.current = onChange;

  /* Slider-view ref voor measure() in onLayout (geeft pageX = absolute
     screen-positie van de slider's left edge). */
  const sliderViewRef = useRef<View | null>(null);

  /* setFromPageX leest alle inputs uit refs → stabiele identity. */
  const setFromPageX = useCallback((pageX: number) => {
    const w = widthRef.current;
    const sliderX = sliderPageXRef.current;
    const mn = minRef.current;
    const mx = maxRef.current;
    const range = mx - mn;
    if (w < 8 || range <= 0) return;
    const localX = pageX - sliderX;
    const pct = Math.max(0, Math.min(1, localX / w));
    const snapped = Math.round(mn + pct * range);
    if (
      snapped !== valueRef.current &&
      snapped >= mn &&
      snapped <= mx
    ) {
      onChangeRef.current(snapped);
    }
  }, []);

  /* PanResponder ÉÉN keer aangemaakt. Aggressief de gesture claimen om
     Android's edge back-swipe te beheersen wanneer user vanaf links
     slidet. Gebruikt pageX voor robuuste cross-platform tracking. */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => setFromPageX(e.nativeEvent.pageX),
        onPanResponderMove: (e) => setFromPageX(e.nativeEvent.pageX),
      }),
    [setFromPageX],
  );

  /* Re-measure helper — onLayout én bij iedere mount van de view.
     measure() is async maar fire-and-forget hier OK; eerst zonder geldige
     pageX returnen we 0 in setFromPageX (w < 8 of localX negatief). */
  const remeasure = useCallback(() => {
    const v = sliderViewRef.current;
    if (!v) return;
    v.measure((_x, _y, w, _h, pageX) => {
      if (typeof w === 'number' && w > 0) widthRef.current = w;
      if (typeof pageX === 'number') sliderPageXRef.current = pageX;
    });
  }, []);

  const range = max - min;
  const filledPct = range > 0 ? ((value - min) / range) * 100 : 0;

  return (
    <View>
      <View
        ref={sliderViewRef}
        style={s.sliderTouch}
        onLayout={(e) => {
          /* onLayout geeft width direct; pageX vereist measure(). */
          widthRef.current = e.nativeEvent.layout.width;
          remeasure();
        }}
        {...panResponder.panHandlers}
      >
        <View style={s.sliderTrack} />
        <View style={[s.sliderFilled, { width: `${filledPct}%` }]} />
        <View style={[s.sliderThumb, { left: `${filledPct}%` }]} />
      </View>
      <View style={s.sliderLabels}>
        <Text style={s.sliderLabel}>{min}</Text>
        <Text style={s.sliderLabel}>{max} min</Text>
      </View>
    </View>
  );
}

/* ── ProgressArc — circulaire progress-ring rond de timer ──
   Vult klokwaarts naarmate de sessie vordert (0% → 100%). Mode-color,
   dunne stroke, ronde caps. Geeft user visueel gevoel van "ik kom
   ergens" zonder de pulserende cirkel te verstoren. */
function ProgressArc({
  progress,
  color,
  size,
}: {
  /** 0..1 — fractie van de sessie die voorbij is */
  progress: number;
  color: string;
  size: number;
}) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = circumference * (1 - clamped);

  return (
    <Svg
      width={size}
      height={size}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        /* -90° rotation start = bovenaan, klokwaarts vullen */
        transform: [{ rotate: '-90deg' }],
      }}
      pointerEvents="none"
    >
      {/* Track — heel subtle, geeft cirkel-shape aan bij 0% progress */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
        fill="none"
      />
      {/* Progress — gevulde portion in mode-color */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
      />
    </Svg>
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

/* ── RotatingQuote — mode-specifieke quote, roteert elke 22s ──
   Soft cross-fade tussen quotes. Quotes per mode in MODE_QUOTES.
   Rusten aan de bodem van de active-session screen, vlak boven de
   stats-strip. */
function RotatingQuote({ quotes }: { quotes: string[] }) {
  const [idx, setIdx] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /* Initial fade-in */
    Animated.timing(opacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    /* Roteer elke 22s — kort genoeg om variatie, lang genoeg om te
       lezen + niet afleidend te zijn. Fade-out, swap, fade-in. */
    const iv = setInterval(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        setIdx((i) => (i + 1) % quotes.length);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      });
    }, 22_000);
    return () => clearInterval(iv);
  }, [opacity, quotes.length]);

  return (
    <Animated.Text style={[s.rotatingQuote, { opacity }]}>
      "{quotes[idx]}"
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
       voor Rest & Reset. Cyclus = inMs + outMs. */
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

/* ── SlowAmbientPulse — pulserende + roterende cirkel (iter 8) ──
   Operator-feedback "de cirkel zelf moet draaien, geen aparte boog
   eromheen". Voorheen was er een aparte RotatingArc — die is verwijderd.
   Nu doet de SlowAmbientPulse zelf beide bewegingen tegelijk:
     - Pulse: 8s/8s scale 1 → 1.05 (subtle "apparaat is aan")
     - Rotate: 14s per volle rotatie (langzaam, niet duizelig-makend)
   De ring is partieel zichtbaar (~35% arc, rest gap via SVG dasharray)
   zodat de rotatie ook visueel waarneembaar is — een volledige ring
   zou symmetrisch zijn en de rotatie niet tonen. */
function SlowAmbientPulse({
  color,
  size = 280,
}: {
  color: string;
  size?: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const rotLoop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    pulseLoop.start();
    rotLoop.start();
    return () => {
      pulseLoop.stop();
      rotLoop.stop();
    };
  }, [pulse, rotation]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.30, 0.55],
  });
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  /* Partial-arc via SVG strokeDasharray — ~35% van de cirkel zichtbaar. */
  const strokeWidth = 2;
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.35;
  const gapLength = circumference - arcLength;

  /* Iter 8b: full ring (lichter) als achtergrond, roterende boog
     erbovenop. Operator-feedback "buitenste ring moet een volledige
     ring zijn, lichtere kleur dan ronddraaiende boog".
     Iter 9bh (2026-05-31): achtergrond-ring krijgt nu DEZELFDE scale
     als de roterende boog. Vroeger pulste alleen de boog (1.0 → 1.05),
     waardoor de boog 5% gróter werd dan de statische ring tijdens piek-
     pulse → boog liep niet exact meer op de ring. Door beide samen te
     scalen blijven ze concentrisch over de hele pulse-cyclus. */
  return (
    <View
      style={[s.pulseWrap, { width: size, height: size }]}
      pointerEvents="none"
    >
      {/* Statische full ring (achtergrond) — pulst nu mee met de boog
         zodat ze altijd op exact dezelfde radius zitten. */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          transform: [{ scale }],
        }}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={0.18}
          />
        </Svg>
      </Animated.View>
      {/* Roterende + pulserende boog (voorgrond) */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          opacity,
          transform: [{ scale }, { rotate }],
        }}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${gapLength}`}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

/* ── BreathworkStrip — opt-in geleide breathwork tijdens active session ──
   2026-05-27 iter 5: breathwork is een eigen feature, OPTIONEEL gebruik
   tijdens een bracelet-sessie. Bracelet+haptic blijven primair, dit is
   een laagje bovenop dat de gebruiker kan in-/uitschakelen.

   Wanneer disabled: toont subtiele CTA-pill om te starten ("+ Add coherent
   breathwork (5 min)"). Eén tap = enable.

   Wanneer enabled: voert het mode-specifieke protocol (uit BREATH_PROTOCOLS)
   uit. Toont progress-balk (cyclus / totaal), resterende tijd, en huidige
   phase ('Breathe in…' / 'Hold' / 'Breathe out…'). Eén tap op ✕ = disable
   (state reset, bij volgende enable begint protocol weer vanaf cyclus 0).

   Onafhankelijk van bracelet-pause/resume — als user de bracelet-sessie
   pauzeert, blijft breathwork-protocol intern doorgaan (het is een
   visuele/cognitieve oefening, niet hardware-aangestuurd). User kan
   handmatig uitschakelen indien gewenst. */
/* ── BoxBreathAnimation — vierkant met dot die clockwise rond loopt ──
   Iter 9f (operator-feedback): klassiek box-breathing visualisatie.
   Eén loop = 16s (4 phases × 4s). Dot trace t volgens phase:
     - Top edge L→R     : Inhale (0-4s)
     - Right edge T→B   : Hold full (4-8s)
     - Bottom edge R→L  : Exhale (8-12s)
     - Left edge B→T    : Hold empty (12-16s)
   useNativeDriver:true voor smooth 60fps animatie. Een Animated.Value
   van 0→1 met linear easing wordt geïnterpoleerd naar translateX/Y. */
function BoxBreathAnimation({
  color,
  enabled,
  size = 100,
}: {
  color: string;
  enabled: boolean;
  size?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      t.setValue(0);
      return;
    }
    t.setValue(0);
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 16000, // 4 × 4s = volledige box-cyclus
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, t]);

  const dotSize = 14;
  const inset = 4; // ruimte zodat dot niet buiten box clipt
  const trackPath = size - dotSize - inset * 2;

  /* Position interpolation. inputRange [0, 0.25, 0.5, 0.75, 1] maps
     elke 25% naar één edge van de box. */
  const translateX = t.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, trackPath, trackPath, 0, 0],
  });
  const translateY = t.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 0, trackPath, trackPath, 0],
  });

  return (
    <View style={[s.boxBreathWrap, { width: size, height: size }]}>
      {/* Box outline — subtle */}
      <View
        style={[
          s.boxBreathBox,
          { width: size, height: size, borderColor: 'rgba(255,255,255,0.18)' },
        ]}
      />
      {/* Phase labels — uit de mockup. Subtle, mode-color toon. */}
      <Text
        style={[s.boxBreathLabel, s.boxBreathLabelTop, { color: hexToTint(color, 0.55) }]}
      >
        IN
      </Text>
      <Text
        style={[s.boxBreathLabel, s.boxBreathLabelRight, { color: 'rgba(255,255,255,0.40)' }]}
      >
        HOLD
      </Text>
      <Text
        style={[s.boxBreathLabel, s.boxBreathLabelBottom, { color: hexToTint(color, 0.55) }]}
      >
        OUT
      </Text>
      <Text
        style={[s.boxBreathLabel, s.boxBreathLabelLeft, { color: 'rgba(255,255,255,0.40)' }]}
      >
        HOLD
      </Text>
      {/* Tracing dot met mode-color glow */}
      <Animated.View
        style={[
          s.boxBreathDot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            top: inset,
            left: inset,
            transform: [{ translateX }, { translateY }],
            shadowColor: color,
            shadowOpacity: 0.6,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      />
    </View>
  );
}

/* ── UniversalPulseAnimation — unified modern pulse voor alle protocols ──
   Iter 9i (operator-keuze 27 mei): "alles pulse, modern unified".
   Een phase-aware pulse die werkt voor:
     - simple (Boost, Calm)     : in expand → out contract
     - box (Rest & Reset)       : in → hold-in stays → out → hold-out stays
     - triangle (Sharp Focus)   : in → hold-in stays → out
     - nadi (Clarity)           : in-left/right → out-right/left (single pulse;
                                   nostril aangegeven via prompt-tekst)
     - 478 (fallback)           : in → hold-in stays → out

   Sigh (Phys Sigh) gebruikt eigen SighAnimation vanwege double-bump.

   Hoe holds zichtbaar zijn zonder geometric shape:
     - hold-in: cirkel blijft op max scale (1.0), opacity blijft hoog
     - hold-out: cirkel blijft op min scale (0.45), opacity laag
     Visueel verschil tussen "actief bewegen" vs "stilstaan" maakt de
     hold-fase zichtbaar. Prompt-text "Hold (lungs full)" reinforced. */
function UniversalPulseAnimation({
  color,
  phase,
  phaseDurationMs,
  enabled,
  size = 100,
}: {
  color: string;
  phase: string;
  phaseDurationMs: number;
  enabled: boolean;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(0.45)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!enabled) {
      scale.setValue(0.45);
      opacity.setValue(0.5);
      return;
    }

    /* Target scale + opacity per phase-categorie. */
    const isExpand =
      phase === 'in' ||
      phase === 'in-left' ||
      phase === 'in-right' ||
      phase === 'in-topup';
    const isContract =
      phase === 'out' || phase === 'out-left' || phase === 'out-right';
    const isHoldFull = phase === 'hold-in';
    const isHoldEmpty = phase === 'hold-out';

    let targetScale = 0.45;
    let targetOpacity = 0.5;

    if (isExpand || isHoldFull) {
      targetScale = 1.0;
      targetOpacity = 0.85;
    } else if (isContract || isHoldEmpty) {
      targetScale = 0.45;
      targetOpacity = 0.5;
    } else {
      return; // idle / done — geen animatie
    }

    Animated.parallel([
      Animated.timing(scale, {
        toValue: targetScale,
        duration: phaseDurationMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: targetOpacity,
        duration: phaseDurationMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [phase, phaseDurationMs, enabled, scale, opacity]);

  return (
    <View style={[s.pulsingCircleWrap, { width: size, height: size }]}>
      {/* Outer ring — statisch, subtle */}
      <View
        style={[
          s.pulsingCircleRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: hexToTint(color, 0.20),
          },
        ]}
      />
      {/* Pulserende kern met shadow-glow */}
      <Animated.View
        style={[
          s.pulsingCircleCore,
          {
            width: size * 0.85,
            height: size * 0.85,
            borderRadius: (size * 0.85) / 2,
            backgroundColor: color,
            transform: [{ scale }],
            opacity,
            shadowColor: color,
            shadowOpacity: 0.55,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      />
    </View>
  );
}

/* ── TriangleBreathAnimation — voor 'triangle' protocol (Sharp Focus) ──
   Iter 9h: equilateral driehoek met dot die 3 hoeken aftikt clockwise.
   Sama Vritti pranayama-stijl: in (top → bottom-right), hold (bottom
   edge L→R reversed), out (left edge up). 12s loop = 3×4s.

   Geometrie equilateral triangle:
     - Top vertex: (size/2, padding)
     - Bottom-right: (size-padding, triH)
     - Bottom-left: (padding, triH)
   triH ≈ size * 0.866 voor echte equilateral. */
function TriangleBreathAnimation({
  color,
  enabled,
  size = 100,
  cycleMs = 12000,
}: {
  color: string;
  enabled: boolean;
  size?: number;
  cycleMs?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      t.setValue(0);
      return;
    }
    t.setValue(0);
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: cycleMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, cycleMs, t]);

  const dotSize = 14;
  const padding = 6;
  const triH = (size - padding * 2) * 0.866;
  /* Vertex coordinates (relative to container top-left) */
  const topX = size / 2;
  const topY = padding;
  const brX = size - padding;
  const brY = padding + triH;
  const blX = padding;
  const blY = padding + triH;

  /* Dot start position: top vertex. Animeer translateX/Y vanuit daar.
     Phase 1 (0..1/3): top → bottom-right
     Phase 2 (1/3..2/3): bottom-right → bottom-left
     Phase 3 (2/3..1): bottom-left → top */
  const translateX = t.interpolate({
    inputRange: [0, 1 / 3, 2 / 3, 1],
    outputRange: [0, brX - topX, blX - topX, 0],
  });
  const translateY = t.interpolate({
    inputRange: [0, 1 / 3, 2 / 3, 1],
    outputRange: [0, brY - topY, blY - topY, 0],
  });

  /* SVG path voor de driehoek-outline */
  const pathD = `M ${topX} ${topY} L ${brX} ${brY} L ${blX} ${blY} Z`;

  return (
    <View style={[s.triangleWrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path
          d={pathD}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1.5}
          fill="none"
          strokeLinejoin="round"
        />
      </Svg>
      {/* Phase labels — subtle */}
      <Text
        style={[
          s.triangleLabel,
          s.triangleLabelTop,
          { color: hexToTint(color, 0.55) },
        ]}
      >
        IN
      </Text>
      <Text
        style={[
          s.triangleLabel,
          s.triangleLabelRight,
          { color: 'rgba(255,255,255,0.40)' },
        ]}
      >
        HOLD
      </Text>
      <Text
        style={[
          s.triangleLabel,
          s.triangleLabelLeft,
          { color: hexToTint(color, 0.55) },
        ]}
      >
        OUT
      </Text>
      {/* Tracing dot */}
      <Animated.View
        style={[
          s.triangleDot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            top: topY - dotSize / 2,
            left: topX - dotSize / 2,
            transform: [{ translateX }, { translateY }],
            shadowColor: color,
            shadowOpacity: 0.6,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      />
    </View>
  );
}

/* ── PulsingCircleAnimation — voor 'simple' protocols (Boost, Calm) ──
   Cirkel die expand/contract in sync met in/out fasen. Voor Boost
   (3s/3s) loopt 'ie sneller dan voor Calm Control (5s/5s). Geen
   holds → continue beweging zonder pauze.
   Scale 0.45 (uitgeademd) → 1.0 (ingeademd). */
function PulsingCircleAnimation({
  color,
  enabled,
  inMs,
  outMs,
  size = 90,
}: {
  color: string;
  enabled: boolean;
  inMs: number;
  outMs: number;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(0.45)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!enabled) {
      scale.setValue(0.45);
      opacity.setValue(0.4);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.0,
            duration: inMs,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.85,
            duration: inMs,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0.45,
            duration: outMs,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: outMs,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, inMs, outMs, scale, opacity]);

  return (
    <View
      style={[s.pulsingCircleWrap, { width: size, height: size }]}
    >
      {/* Outer ring (statisch, subtle) */}
      <View
        style={[
          s.pulsingCircleRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: hexToTint(color, 0.20),
          },
        ]}
      />
      {/* Pulserende kern */}
      <Animated.View
        style={[
          s.pulsingCircleCore,
          {
            width: size * 0.85,
            height: size * 0.85,
            borderRadius: (size * 0.85) / 2,
            backgroundColor: color,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
    </View>
  );
}

/* ── NadiAnimation — voor 'nadi' protocol (Clarity) ──
   Twee cirkels naast elkaar (links/rechts neusgat). Actieve neusgat
   licht op met mode-color tijdens in/out van die kant. Cycle:
     L-in (4s)  → linker glow + grow
     R-out (4s) → rechter glow + shrink
     R-in (4s)  → rechter glow + grow
     L-out (4s) → linker glow + shrink */
function NadiAnimation({
  color,
  phase,
  size = 100,
}: {
  color: string;
  phase: string;
  size?: number;
}) {
  const leftActive = phase === 'in-left' || phase === 'out-left';
  const rightActive = phase === 'in-right' || phase === 'out-right';
  const leftGrowing = phase === 'in-left';
  const rightGrowing = phase === 'in-right';

  const leftScale = useRef(new Animated.Value(0.5)).current;
  const rightScale = useRef(new Animated.Value(0.5)).current;

  /* Per phase: target scale 1.0 als growing, 0.5 als shrinking. Geen
     verdere animatie voor inactive kant — die blijft op huidige waarde. */
  useEffect(() => {
    if (leftActive) {
      Animated.timing(leftScale, {
        toValue: leftGrowing ? 1.0 : 0.5,
        duration: 4000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
    if (rightActive) {
      Animated.timing(rightScale, {
        toValue: rightGrowing ? 1.0 : 0.5,
        duration: 4000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [phase, leftActive, rightActive, leftGrowing, rightGrowing, leftScale, rightScale]);

  const circleSize = size * 0.40;

  return (
    <View
      style={[s.nadiWrap, { width: size, height: size * 0.6 }]}
    >
      {/* Left nostril */}
      <View
        style={[
          s.nadiSlot,
          { width: circleSize, height: circleSize },
        ]}
      >
        <View
          style={[
            s.nadiRing,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              borderColor: leftActive
                ? hexToTint(color, 0.6)
                : 'rgba(255,255,255,0.15)',
            },
          ]}
        />
        <Animated.View
          style={[
            s.nadiCore,
            {
              width: circleSize * 0.7,
              height: circleSize * 0.7,
              borderRadius: (circleSize * 0.7) / 2,
              backgroundColor: leftActive ? color : 'rgba(255,255,255,0.10)',
              transform: [{ scale: leftScale }],
              opacity: leftActive ? 0.85 : 0.2,
            },
          ]}
        />
      </View>
      {/* Right nostril */}
      <View
        style={[
          s.nadiSlot,
          { width: circleSize, height: circleSize },
        ]}
      >
        <View
          style={[
            s.nadiRing,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              borderColor: rightActive
                ? hexToTint(color, 0.6)
                : 'rgba(255,255,255,0.15)',
            },
          ]}
        />
        <Animated.View
          style={[
            s.nadiCore,
            {
              width: circleSize * 0.7,
              height: circleSize * 0.7,
              borderRadius: (circleSize * 0.7) / 2,
              backgroundColor: rightActive ? color : 'rgba(255,255,255,0.10)',
              transform: [{ scale: rightScale }],
              opacity: rightActive ? 0.85 : 0.2,
            },
          ]}
        />
      </View>
    </View>
  );
}

/* ── SighAnimation — voor 'sigh' protocol (Rest & Reset) ──
   Cirkel met "dubbele pulse" tijdens inhale-fase, dan lange drain.
   Visualiseert de unieke Physiological Sigh-structuur:
     in (1.5s)      : grow naar 0.85
     in-topup (0.5s): mini-jump naar 1.0 (de "extra slokje")
     out (5s)       : trage drain naar 0.35
   useNativeDriver:true voor smooth 60fps. */
function SighAnimation({
  color,
  enabled,
  inMs,
  inTopUpMs,
  outMs,
  size = 90,
}: {
  color: string;
  enabled: boolean;
  inMs: number;
  inTopUpMs: number;
  outMs: number;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!enabled) {
      scale.setValue(0.35);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.85,
          duration: inMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.0,
          duration: inTopUpMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.35,
          duration: outMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, inMs, inTopUpMs, outMs, scale]);

  return (
    <View
      style={[s.pulsingCircleWrap, { width: size, height: size }]}
    >
      <View
        style={[
          s.pulsingCircleRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: hexToTint(color, 0.20),
          },
        ]}
      />
      <Animated.View
        style={[
          s.pulsingCircleCore,
          {
            width: size * 0.85,
            height: size * 0.85,
            borderRadius: (size * 0.85) / 2,
            backgroundColor: color,
            transform: [{ scale }],
            opacity: 0.75,
          },
        ]}
      />
    </View>
  );
}

/* Iter 9dd: subtle sub-regel onder protocol-naam — toont ritme +
   adem-route + cycles. Voor nieuwe users die niet meteen weten wat
   "Box breath" of "Triangle" inhoudt. */
function getProtocolSubline(
  protocol: Protocol,
  method: { inVia: 'nose' | 'mouth'; outVia: 'nose' | 'mouth' | 'nose-or-mouth' },
): string {
  /* Pattern (ritme in seconden) */
  let pattern: string;
  switch (protocol.kind) {
    case 'simple': {
      const inS = Math.round(protocol.inMs / 1000);
      const outS = Math.round(protocol.outMs / 1000);
      pattern = `${inS}-${outS}`;
      break;
    }
    case 'box': {
      const p = Math.round(protocol.phaseMs / 1000);
      pattern = `${p}-${p}-${p}-${p}`;
      break;
    }
    case 'triangle': {
      const p = Math.round(protocol.phaseMs / 1000);
      pattern = `${p}-${p}-${p}`;
      break;
    }
    case '478': {
      pattern = `${Math.round(protocol.inMs / 1000)}-${Math.round(
        protocol.holdMs / 1000,
      )}-${Math.round(protocol.outMs / 1000)}`;
      break;
    }
    case 'nadi': {
      const p = Math.round(protocol.phaseMs / 1000);
      pattern = `${p}s alternating`;
      break;
    }
    case 'sigh': {
      pattern = 'double inhale · long exhale';
      break;
    }
  }
  /* Route */
  let route: string;
  if (protocol.kind === 'nadi') {
    route = 'nostrils';
  } else if (method.inVia === 'nose' && method.outVia === 'nose') {
    route = 'nose only';
  } else if (method.outVia === 'nose-or-mouth') {
    route = 'nose only';
  } else {
    route = `${method.inVia} in, ${method.outVia} out`;
  }
  /* Cycles */
  const cycles = `${protocol.cycles} cycles`;
  return `${pattern} · ${route} · ${cycles}`;
}

function BreathworkStrip({
  mode,
  enabled,
  onToggle,
  onProgress,
}: {
  mode: BraceletMode;
  enabled: boolean;
  onToggle: () => void;
  /* Iter 9ca (2026-05-31): callback voor breathwork-tracking in
     bracelet-history. Wordt aangeroepen telkens als cycle of phase
     wijzigt, met cumulatieve stats van DEZE enable-run. BraceletControl
     accumuleert over meerdere enable-runs binnen één bracelet-sessie. */
  onProgress?: (data: {
    protocolKind: string;
    protocolName: string;
    cyclesCompleted: number;
    cyclesTarget: number;
    durationSec: number;
  }) => void;
}) {
  const protocol = BREATH_PROTOCOLS[mode];
  const totalMs = breathProtocolTotalMs(protocol);
  const benefit = BREATH_BENEFIT[mode];

  /* Phase-types per protocol-kind:
     - simple: 'in' / 'out'
     - box:    'in' / 'hold-in' / 'out' / 'hold-out'
     - 478:    'in' / 'hold-in' / 'out'
     - nadi:   'in-left' / 'out-right' / 'in-right' / 'out-left'
     'idle' = nog niet gestart, 'done' = klaar. */
  type Phase =
    | 'idle'
    | 'done'
    | 'in'
    | 'out'
    | 'hold-in'
    | 'hold-out'
    | 'in-left'
    | 'in-right'
    | 'out-left'
    | 'out-right'
    | 'in-topup'; // Physiological Sigh: tweede mini-inademing

  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  /* Iter v150 (2026-06-25): completion-popup parity met breath-tab.
     Operator-feedback: audio speelt wel maar Buddha-popup ontbrak. */
  const [completionVisible, setCompletionVisible] = useState(false);
  /* Iter 9dq v8 (2026-06-02): info-popup. Lokale state — opent vanaf
     de ⓘ icon in de eyebrow, sluit via backdrop tap of Close knop.
     Bevat WHAT/WHEN/HOW + pairing-hint. */
  const [infoOpen, setInfoOpen] = useState(false);
  const onShowInfo = () => setInfoOpen(true);
  const onCloseInfo = () => setInfoOpen(false);
  const meta = getModeMeta(mode);

  /* Phase-sequence per protocol-kind. Eén cyclus = deze sequence één keer
     doorlopen. Cycle-counter wordt opgehoogd na de laatste phase van de
     sequence. Phase-duur per element wordt apart bepaald door
     phaseDurationMs() omdat 4-7-8 asymmetrisch is. */
  const phaseSequence: Phase[] = (() => {
    switch (protocol.kind) {
      case 'simple':
        return ['in', 'out'];
      case 'box':
        return ['in', 'hold-in', 'out', 'hold-out'];
      case '478':
        return ['in', 'hold-in', 'out'];
      case 'nadi':
        return ['in-left', 'out-right', 'in-right', 'out-left'];
      case 'sigh':
        return ['in', 'in-topup', 'out'];
      case 'triangle':
        return ['in', 'hold-in', 'out'];
    }
  })();

  const phaseDurationMs = (ph: Phase): number => {
    switch (protocol.kind) {
      case 'simple':
        return ph === 'in' ? protocol.inMs : protocol.outMs;
      case 'box':
        return protocol.phaseMs; // alle 4 fasen gelijk
      case '478':
        return ph === 'in'
          ? protocol.inMs
          : ph === 'hold-in'
            ? protocol.holdMs
            : protocol.outMs;
      case 'nadi':
        return protocol.phaseMs; // alle 4 fasen gelijk
      case 'sigh':
        return ph === 'in'
          ? protocol.inMs
          : ph === 'in-topup'
            ? protocol.inTopUpMs
            : protocol.outMs;
      case 'triangle':
        return protocol.phaseMs; // alle 3 fasen gelijk
    }
  };

  /* Phase-classificatie voor animatie + prompt. 'expanding' = adem-in
     (dot vergroten), 'contracting' = adem-uit (dot kleiner), 'holding' =
     vasthouden (dot blijft staan). */
  const phaseType = (
    ph: Phase,
  ): 'expanding' | 'contracting' | 'holding' | 'none' => {
    if (
      ph === 'in' ||
      ph === 'in-left' ||
      ph === 'in-right' ||
      ph === 'in-topup'
    )
      return 'expanding';
    if (ph === 'out' || ph === 'out-left' || ph === 'out-right')
      return 'contracting';
    if (ph === 'hold-in' || ph === 'hold-out') return 'holding';
    return 'none';
  };

  /* Animated breath-dot — schaalt met phase. Expanding = groeit naar max,
     contracting = schrinkt naar min, holding = blijft op huidige scale. */
  const dotScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) {
      dotScale.setValue(0);
      return;
    }
    const ptype = phaseType(phase);
    if (ptype === 'expanding') {
      Animated.timing(dotScale, {
        toValue: 1,
        duration: phaseDurationMs(phase),
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else if (ptype === 'contracting') {
      Animated.timing(dotScale, {
        toValue: 0,
        duration: phaseDurationMs(phase),
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
    /* holding / done / idle: geen herstart; dotScale blijft op current. */
  }, [phase, enabled, dotScale]);

  /* Protocol-loop: bij enable=true start ie, bij enable=false reset hij.
     Gebruikt phaseSequence (per protocol-kind) om door de fasen te
     stappen. Na laatste phase van de sequence: cycle++ en terug naar
     fase 0. Wanneer cycle == protocol.cycles → done. */
  useEffect(() => {
    if (!enabled) {
      setCycle(0);
      setPhase('idle');
      setStartedAt(null);
      return;
    }
    const firstPhase = phaseSequence[0];
    setCycle(0);
    setPhase(firstPhase);
    setStartedAt(Date.now());

    let active = true;
    let currentCycle = 0;
    let phaseIdx = 0;

    /* Iter v170 (2026-06-28): voice-cue per phase, identiek aan breath tab.
       Boost (Gamma) krijgt korte protocol-specifieke MP3's via key='boost' +
       mouth exhale (matcht breath tab Boost pattern). Andere modes gebruiken
       generieke 'your nose/mouth' cues (geen Boost-specifieke takes).
       Claim voice-source='bracelet' zodat een tegelijk-lopende breath-tab
       sessie automatisch wordt overstemd (operator-feedback: dubbele cues
       waren verwarrend). */
    claimVoiceSource('bracelet');
    const isBoost = mode === BraceletMode.Gamma;
    const exhaleVia: 'nose' | 'mouth' = isBoost
      ? 'mouth'
      : protocol.kind === '478' || protocol.kind === 'sigh' ? 'mouth' : 'nose';
    const protocolKey = isBoost ? ('boost' as const) : undefined;

    const playPhaseCue = (ph: Phase) => {
      if (ph === 'in' || ph === 'in-left' || ph === 'in-right' || ph === 'in-topup') {
        playBreathCue('inhale', exhaleVia, protocolKey, 'bracelet');
      } else if (ph === 'hold-in') {
        playBreathCue('hold-in', exhaleVia, protocolKey, 'bracelet');
      } else if (ph === 'hold-out') {
        playBreathCue('hold-out', exhaleVia, protocolKey, 'bracelet');
      } else if (ph === 'out' || ph === 'out-left' || ph === 'out-right') {
        playBreathCue('exhale', exhaleVia, protocolKey, 'bracelet');
      }
    };

    /* Initial cue voor eerste phase. */
    playPhaseCue(firstPhase);

    const advance = () => {
      if (!active) return;
      phaseIdx += 1;
      if (phaseIdx >= phaseSequence.length) {
        /* Einde van een cyclus */
        currentCycle += 1;
        if (currentCycle >= protocol.cycles) {
          setPhase('done');
          /* Iter v149 v3: completion-cue mapped op bracelet-mode (zelfde
             5 modes als bracelet-voice maar via breath-voice's eigen
             completion files). BraceletMode-index = BreathKey-index in
             practice — Boost=0=boost, Beta=1=focus, Alpha=2=calm,
             Theta=3=clarity, Delta=4=rest. */
          const breathKey: 'boost' | 'focus' | 'calm' | 'clarity' | 'rest' =
            mode === 0 ? 'boost'
            : mode === 1 ? 'focus'
            : mode === 2 ? 'calm'
            : mode === 3 ? 'clarity'
            : 'rest';
          playBreathCompletionCue(breathKey);
          /* Iter v150: trigger Buddha-popup voor visuele parity met
             breath-tab completion (operator-feedback). */
          setCompletionVisible(true);
          return;
        }
        phaseIdx = 0;
        setCycle(currentCycle);
      }
      const nextPhase = phaseSequence[phaseIdx];
      setPhase(nextPhase);
      playPhaseCue(nextPhase);
      setTimeout(advance, phaseDurationMs(nextPhase));
    };

    /* Eerste timeout = einde van de eerste fase. */
    const handle = setTimeout(advance, phaseDurationMs(firstPhase));
    return () => {
      active = false;
      clearTimeout(handle);
      /* Iter v170: release voice-source bij cleanup zodat een latere
         breath-tab solo-sessie weer kan claimen. */
      try { releaseVoiceSource('bracelet'); } catch {}
    };
    /* Deps: enable, mode (protocol verandert) — phaseSequence en
       phaseDurationMs zijn afgeleid van protocol/mode, dus impliciet
       included. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mode]);

  /* Real-time clock voor "time left"-display. Tikt 1× per seconde
     wanneer de strip actief is; gestopt wanneer disabled of done. */
  useEffect(() => {
    if (!enabled || phase === 'done' || phase === 'idle') return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled, phase]);

  /* Iter 9ca (2026-05-31): rapporteer breathwork-stats naar parent voor
     history-tracking. Per enable-run: cumulatieve cycles + sec sinds
     enable. BraceletControl accumuleert deze waarden over meerdere
     enable/disable cycli binnen één bracelet-sessie. */
  useEffect(() => {
    if (!onProgress) return;
    if (!enabled) return;
    const cyclesDone = phase === 'done' ? protocol.cycles : cycle;
    const durationSec = startedAt
      ? Math.floor((nowMs - startedAt) / 1000)
      : 0;
    onProgress({
      protocolKind: protocol.kind,
      protocolName: protocol.name,
      cyclesCompleted: cyclesDone,
      cyclesTarget: protocol.cycles,
      durationSec,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cycle, phase, nowMs]);

  if (!enabled) {
    const minutes = Math.round(totalMs / 60000);
    /* Iter 8: tap-anywhere weggehaald (operator-feedback "ademwerk mag
       niet automatisch starten — knop nodig"). Card is nu informatie-
       only; alleen de expliciete "Start" knop onderaan triggert de
       protocol. */
    /* Operator v14 (2026-05-31): alle modes gebruiken nu DARK card +
       mode-color border accent (was: white card voor light modes).
       Reden: witte card stond te veel uit, voelde generiek/boring. Nu
       uniform donker met mode-color als accent → premium, on-brand.
       Operator v15 (2026-05-31): voor LIGHT modes (Boost wit) bg = PURE
       Brand.bg ipv 8% mode-tint. Reden: 8% wit op #0a0a0a leest als
       grijze card, niet "echt zwart". Witte tekst+border heeft daardoor
       ook minder pop. Voor dark modes blijft de 8% tint = subtiele
       mode-color warmte per modus. */
    const light = isLightColor(meta.color);
    /* Start-chip blijft mode-color als bg met contrasterende tekst. */
    const textColor = light ? '#0a0a0a' : '#ffffff';
    return (
      <View
        style={[
          s.breathOffCard,
          /* Border: light modes (Boost) krijgen sterk wit; dark modes
             krijgen mode-color tint zodat de eigen kleur subtiel
             accent geeft zonder te schreeuwen. */
          {
            borderColor: light
              ? 'rgba(255,255,255,0.55)'
              : hexToTint(meta.color, 0.32),
          },
          /* Bg: light modes = pure Brand.bg (echt zwart). Dark modes =
             subtiele mode-color tint. */
          {
            backgroundColor: light ? Brand.bg : hexToTint(meta.color, 0.08),
          },
        ]}
      >
        <View style={s.breathOffTopRow}>
          {/* Info-blok links — iter 9ff: tekst-kleuren conditional op
              card-bg (wit voor light modes, mode-tint voor rest). */}
          <View style={s.breathOffInfo}>
            <View style={s.breathOffHeader}>
              <View
                style={[s.breathOffDot, { backgroundColor: meta.color }]}
              />
              {/* Operator v14: tekst altijd licht (was: conditional op
                  light/dark card-bg). Card is nu altijd dark. */}
              <Text
                style={[
                  s.breathOffEyebrow,
                  { color: 'rgba(255,255,255,0.55)' },
                ]}
              >
                BREATHWORK
              </Text>
            </View>
            <Text style={[s.breathOffTitle, { color: Brand.text }]}>
              {protocol.name} · {minutes} min
            </Text>
            <Text
              style={[
                s.breathOffSubline,
                { color: 'rgba(255,255,255,0.50)' },
              ]}
            >
              {getProtocolSubline(protocol, BREATH_METHOD[mode])}
            </Text>
            {/* Iter 9dq v8 (2026-06-02): duidelijke "Learn more" link
                ipv de eerder geprobeerde ⓘ icon. Operator-feedback: icon
                niet onmiddelijk discoverable als tap-target. Accent-blue
                text + arrow = universeel link-pattern. */}
            <Pressable
              onPress={onShowInfo}
              hitSlop={8}
              accessibilityLabel="Learn more about this breathwork protocol"
              style={s.breathLearnMore}
            >
              <Text style={s.breathLearnMoreText}>Learn more →</Text>
            </Pressable>
          </View>
          {/* Start-knop rechts — compact action chip */}
          <Pressable
            style={[
              s.breathStartChip,
              { backgroundColor: meta.color },
              light && {
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
              },
            ]}
            onPress={onToggle}
            accessibilityLabel="Start breathwork session"
          >
            <Text style={[s.breathStartChipText, { color: textColor }]}>
              Start
            </Text>
            <Text style={[s.breathStartChipArrow, { color: textColor }]}>
              →
            </Text>
          </Pressable>
        </View>
        {/* Iter 9dq v8 (2026-06-02): benefit-text verhuisd naar popup
            (operator-feedback: te veel tekst op card overschaduwt de
            bracelet als primaire feature). Card houdt nu enkel
            titel + subline + Learn more link. */}

        {/* Info-popup met WHEN/WHY/HOW. Backdrop-tap sluit, of de
            expliciete "Close" knop onderaan. */}
        <Modal
          visible={infoOpen}
          transparent
          animationType="fade"
          onRequestClose={onCloseInfo}
        >
          <Pressable style={s.breathInfoBackdrop} onPress={onCloseInfo}>
            <Pressable
              style={s.breathInfoCard}
              onPress={(e) => e.stopPropagation()}
            >
              <View
                style={[s.breathInfoDot, { backgroundColor: meta.color }]}
              />
              <Text style={s.breathInfoEyebrow}>BREATHWORK</Text>
              <Text style={s.breathInfoTitle}>
                {protocol.name}
              </Text>
              {/* Iter 9dq v9: rhythm-meta (pacing-info, geen claims).
                  Concreet maar feitelijk — protocol-data, niet "doet X
                  met je systeem". */}
              <Text style={s.breathInfoMeta}>
                {minutes} min · {protocol.cycles} cycles · {BREATH_PACE[mode]}
              </Text>

              <Text style={s.breathInfoSectionLabel}>When to use</Text>
              <Text style={s.breathInfoBody}>{BREATH_WHEN[mode]}</Text>

              <Text style={s.breathInfoSectionLabel}>
                What it gives you
              </Text>
              <Text style={s.breathInfoBody}>{benefit}</Text>

              <Text style={s.breathInfoSectionLabel}>
                How it pairs with the bracelet
              </Text>
              <Text style={s.breathInfoBody}>{BREATH_PAIRING_HINT}</Text>

              <Pressable
                style={s.breathInfoClose}
                onPress={onCloseInfo}
                accessibilityLabel="Close info"
              >
                <Text style={s.breathInfoCloseText}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  const elapsedMs = startedAt ? Math.max(0, nowMs - startedAt) : 0;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const remainingMin = Math.floor(remainingMs / 60000);
  const remainingSec = Math.floor((remainingMs % 60000) / 1000);
  const progress = phase === 'done' ? 1 : cycle / protocol.cycles;

  /* Iter v170 (2026-06-28): verkorte vorm ('through X' zonder 'your') ALLEEN
     voor Boost mode (BraceletMode.Gamma) — diens 2-2 cyclus is te snel voor
     lange audio cues. Andere modes gebruiken oorspronkelijke 'through your X'
     audio takes en moeten dezelfde UI tekst tonen. Operator-instructie 2026-
     06-28: "niet aan de andere states komen enkel boost aanpassen". */
  const method = BREATH_METHOD[mode];
  const isBoost = mode === BraceletMode.Gamma;
  const promptText = (() => {
    switch (phase) {
      case 'in':
        if (protocol.kind === 'sigh') return 'Inhale deeply through your nose';
        if (isBoost) {
          return method.inVia === 'mouth' ? 'Inhale through mouth' : 'Inhale through nose';
        }
        return method.inVia === 'mouth'
          ? 'Inhale through your mouth'
          : 'Inhale through your nose';
      case 'in-topup':
        return 'Top up — small breath in';
      case 'out':
        if (protocol.kind === 'sigh') return 'Long exhale through your mouth';
        if (isBoost) {
          return method.outVia === 'mouth' ? 'Exhale through mouth' : 'Exhale through nose';
        }
        return method.outVia === 'mouth'
          ? 'Exhale through your mouth'
          : 'Exhale through your nose';
      case 'hold-in':
        return 'Hold';
      case 'hold-out':
        return 'Hold';
      case 'in-left':
        return 'Inhale through your left nostril';
      case 'out-right':
        return 'Exhale through your right nostril';
      case 'in-right':
        return 'Inhale through your right nostril';
      case 'out-left':
        return 'Exhale through your left nostril';
      case 'done':
        return 'Complete';
      case 'idle':
      default:
        return '';
    }
  })();

  /* Dot-grootte interpoleert van 6 (klein) naar 24 (groot), past binnen
     de container. Geeft visuele in/out-cue zonder de centrale bracelet-
     cirkel te concurreren. */
  const dotAnimatedScale = dotScale.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1.6],
  });
  const dotAnimatedOpacity = dotScale.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.85],
  });

  /* Operator v14 (2026-05-31): ON-card altijd dark (was: wit voor light
     modes zoals Boost). Uniforme dark stijl met mode-color border en
     witte tekst — past in de algemene UI en ondersteunt animatie-
     leesbaarheid.
     Operator v15 (2026-05-31): voor LIGHT modes (Boost wit) bg = PURE
     Brand.bg. 8% wit op #0a0a0a leest als grijs — niet "echt zwart". */
  const onCardLight = isLightColor(meta.color);
  return (
    <View
      style={[
        s.breathOnCard,
        /* Border: light modes (Boost) krijgen sterk wit; dark modes
           houden mode-color tint. */
        {
          borderColor: onCardLight
            ? 'rgba(255,255,255,0.55)'
            : hexToTint(meta.color, 0.32),
        },
        /* Bg: light modes = pure Brand.bg; dark modes = subtiele tint. */
        {
          backgroundColor: onCardLight ? Brand.bg : hexToTint(meta.color, 0.08),
        },
      ]}
    >
      <View style={s.breathOnHeader}>
        <View style={s.breathOnHeaderLeft}>
          <View style={[s.breathOffDot, { backgroundColor: meta.color }]} />
          <Text style={[s.breathOnTitle, { color: meta.color }]}>
            {protocol.name.toUpperCase()}
          </Text>
        </View>
        <Pressable
          onPress={onToggle}
          hitSlop={12}
          accessibilityLabel="Disable breathwork"
        >
          {/* Dismiss ✕ altijd licht (was: conditional). */}
          <Text
            style={[
              s.breathOnDismiss,
              { color: 'rgba(255,255,255,0.50)' },
            ]}
          >
            ✕
          </Text>
        </Pressable>
      </View>

      {/* Iter 9j: compact ON-state — animatie 70pt, prompt+meta in één
          rij onderaan. Doel: card-hoogte matches OFF-state zodat tijdens
          activeren geen extra ruimte nodig (geen scroll). */}
      {/* Iter 9bv (2026-05-31): animatie 70 → 56 om in nieuwe 64-height
          container te passen, –14px verticaal. */}
      <View style={s.boxBreathContainerCompact}>
        {protocol.kind === 'sigh' ? (
          <SighAnimation
            color={meta.color}
            enabled={enabled && phase !== 'done' && phase !== 'idle'}
            inMs={protocol.inMs}
            inTopUpMs={protocol.inTopUpMs}
            outMs={protocol.outMs}
            size={56}
          />
        ) : (
          <UniversalPulseAnimation
            color={meta.color}
            phase={phase}
            phaseDurationMs={phaseDurationMs(phase)}
            enabled={enabled && phase !== 'done' && phase !== 'idle'}
            size={56}
          />
        )}
      </View>

      {/* Compact prompt — altijd licht (operator v14, dark card). */}
      <Text
        style={[
          s.breathOnPromptCompact,
          (() => {
            const t = phaseType(phase);
            if (t === 'expanding') return { color: meta.color };
            if (t === 'contracting')
              return { color: 'rgba(255,255,255,0.78)' };
            if (t === 'holding')
              return { color: 'rgba(255,255,255,0.55)' };
            return undefined;
          })(),
        ]}
      >
        {promptText}
      </Text>

      {/* Compact meta — count + time inline, altijd licht. */}
      <Text
        style={[
          s.breathOnMetaCompact,
          { color: 'rgba(255,255,255,0.50)' },
        ]}
      >
        {phase === 'done'
          ? `${protocol.cycles} / ${protocol.cycles} cycles · Complete`
          : `${Math.min(cycle + 1, protocol.cycles)} / ${protocol.cycles} · ${remainingMin}:${remainingSec.toString().padStart(2, '0')} left`}
      </Text>

      {/* Iter v150 (2026-06-25): Buddha-popup voor breathwork completion,
          parity met breath-tab modal. Operator-feedback: 'audio speelt
          maar geen popup met budha'. Simpele variant van breath-tab
          completionSheet — Buddha image, congratulations, dismiss. */}
      <Modal
        visible={completionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCompletionVisible(false)}
      >
        <Pressable
          style={s.bwCompletionBackdrop}
          onPress={() => setCompletionVisible(false)}
        >
          <Pressable
            style={s.bwCompletionSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[
                s.bwCompletionAccentStrip,
                { backgroundColor: meta.color },
              ]}
            />
            <Image
              source={{
                uri: 'https://vibezcore-audio.b-cdn.net/images/buddha%20.png',
              }}
              resizeMode="contain"
              style={s.bwCompletionBuddha}
            />
            {/* Iter v152 (2026-06-25): consistency met breath-tab popup.
                Operator-feedback: 'tekst bij pop up met buddha moet ook
                consistent zijn met breathe, knop moet i'm done zeggen'. */}
            <Text style={[s.bwCompletionEyebrow, { color: meta.color }]}>
              ✦ CONGRATULATIONS ✦
            </Text>
            <Text style={s.bwCompletionTitle}>Well done.</Text>
            <Text style={s.bwCompletionBody}>
              You completed {protocol.cycles} cycles of {protocol.name}.
              Carry the breath with you.
            </Text>
            <Pressable
              style={[s.bwCompletionBtn, { backgroundColor: meta.color }]}
              onPress={() => setCompletionVisible(false)}
            >
              {/* Iter v159 (2026-06-26): luminance-aware text color. Voor
                  lichte mode-colors (Boost = wit #FFFFFF) was de hardcoded
                  witte tekst onzichtbaar. Nu zwarte tekst op lichte
                  backgrounds, witte tekst op donkere. */}
              <Text
                style={[
                  s.bwCompletionBtnText,
                  isLightColor(meta.color) && { color: '#0a0a0a' },
                ]}
              >
                ✓ I&apos;M DONE
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
            color: Brand.text,
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
}: {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  /* Iter 2026-06-05: optionele label naast back-arrow. Wanneer gezet:
     "← Audio Library" of "← Bracelet". Default: alleen "←". Op die manier
     wordt het bestaande gedrag voor non-CTA screens niet aangeraakt. */
  backLabel?: string;
}) {
  return (
    <View style={s.customHeader}>
      {showBack && onBack ? (
        <Pressable
          onPress={onBack}
          style={[s.headerSide, backLabel ? s.headerSideWithLabel : null]}
          hitSlop={12}
          accessibilityLabel={backLabel ? `Back to ${backLabel}` : 'Back'}
        >
          <Text style={s.headerBackArrow}>←</Text>
          {backLabel ? (
            <Text style={s.headerBackLabel} numberOfLines={1}>
              {backLabel}
            </Text>
          ) : null}
        </Pressable>
      ) : (
        <View style={s.headerSide} />
      )}
      <Text style={s.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={s.headerSide} />
    </View>
  );
}

/* Iter v194 (2026-07-04): InlineBraceletTabBar volledig verwijderd.
   Bracelet-control wordt inline gerenderd binnen de (tabs) navigator
   via bracelet-tab owner-view — de systeem tab bar (uit (tabs)/_layout)
   was daar dus AL zichtbaar. Mijn v193-toevoeging veroorzaakte een
   dubbele tab bar op operator-scherm en verdrong de Start-knop uit
   beeld. Verwijderd om aan het echte gedrag terug te komen. */

export default function BraceletControl() {
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
     real hardware sowieso, en in dev willen ze state-continuïteit. */
  useEffect(() => {
    if (!isBraceletOwner) {
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
    }
    // Only fire once on mount per preview-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [conn, setConn] = useState<BleConnectionState>(
    bracelet.getConnectionState(),
  );

  /* Query-params support — Free Breathwork CTA's op Audio/Bracelet tabs
     openen een chooser en navigeren hier met ?mode=0-4&breathwork=1.
     - mode      : initiële BraceletMode (0=Gamma/Boost t/m 4=Delta/Rest)
     - breathwork: indien "1" triggert de auto-connect + auto-start van de
                   bracelet-sessie zodat user direct op het Active-scherm
                   landt (i.p.v. eerst Connect → Start). De breathwork-
                   toggle blijft FALSE — user tapt zelf "Start" op de
                   breathwork-strip wanneer hij klaar is. Operator-feedback
                   2026-06-05: breathwork mag niet vanzelf beginnen. */
  const params = useLocalSearchParams<{ mode?: string; breathwork?: string; from?: string }>();
  const initialMode: BraceletMode = (() => {
    const raw = params.mode;
    if (typeof raw === 'string') {
      const n = parseInt(raw, 10);
      if (n >= 0 && n <= 4) return n as BraceletMode;
    }
    return BraceletMode.Alpha;
  })();
  const autoStartBracelet = params.breathwork === '1';
  /* Operator-feedback 2026-06-05: bij CTA-flow vanuit Audio of Bracelet
     tab is het onduidelijk waarheen de back-knop terug gaat. Met `from`
     param maken we de back-knop context-aware: "Audio Library" of
     "Bracelet" als label + navigatie naar de juiste tab. */
  const fromContext: 'audio' | 'bracelet' | null = (() => {
    if (params.from === 'audio') return 'audio';
    if (params.from === 'bracelet') return 'bracelet';
    return null;
  })();

  const [selectedMode, setSelectedMode] = useState<BraceletMode>(initialMode);
  const meta = getModeMeta(selectedMode);
  const [duration, setDuration] = useState<number>(meta.minMinutes);
  const [status, setStatus] = useState<BleStatusPacket | null>(null);
  const [busy, setBusy] = useState(false);
  /* Iter v149 v4 (2026-06-25): voice-cues toggle direct op de active-
     session view zodat user 'm ter plekke kan dimmen (operator-feedback:
     'in het blok heel duidelijk' — niet verstopt in Settings). Sync via
     useSetting → globale single source of truth, ook respected door
     breath-tab en Settings menu. */
  const [voiceCues, setVoiceCues] = useSetting('voiceCues');

  /* Iter v149 v5 (2026-06-25): custom End-session modal ipv Alert.alert.
     Operator-feedback: 'ui moet vibezcore stijl niet statisch lelijk zoals
     nu'. System Alert voelt vreemd op een dark-themed app. */
  const [endSessionVisible, setEndSessionVisible] = useState(false);
  /* Breathwork toggle — opt-in tijdens active session. False per default
     ("bracelet+haptic is main, breathwork is optioneel" — operator-keuze
     2026-05-27 iter 5). Reset bij sessie-eind via natural-completion
     useEffect zodat volgende sessie weer schoon start.
     Ook bij CTA-flow blijft dit FALSE — user tapt zelf Start op de strip. */
  const [breathworkEnabled, setBreathworkEnabled] = useState(false);

  /* Iter 9ca (2026-05-31): bij transition breathworkEnabled true → false
     committen we de huidige enable-run naar de cumulative ref. Daarna
     reset BreathworkStrip cycle/duration naar 0, dus dit is de ENIGE
     plek om die run vast te leggen. */
  useEffect(() => {
    if (breathworkEnabled) return; // alleen acteren op disable
    const run = breathCurrentRunRef.current;
    if (!run || run.cyclesCompleted === 0) {
      breathCurrentRunRef.current = null;
      return;
    }
    const cum = breathCumulativeRef.current;
    breathCumulativeRef.current = {
      protocolKind: run.protocolKind,
      protocolName: run.protocolName,
      cyclesCompleted: (cum?.cyclesCompleted ?? 0) + run.cyclesCompleted,
      cyclesTarget: run.cyclesTarget,
      durationSec: (cum?.durationSec ?? 0) + run.durationSec,
    };
    breathCurrentRunRef.current = null;
  }, [breathworkEnabled]);

  /* Helper: bouw de finale breathwork-snapshot voor recordSession.
     Combineert cumulative + (huidige run als nog enabled). */
  const buildBreathworkRecord = useCallback(() => {
    const cum = breathCumulativeRef.current;
    const cur = breathworkEnabled ? breathCurrentRunRef.current : null;
    if (!cum && !cur) return undefined;
    const base = cum ?? {
      protocolKind: '',
      protocolName: '',
      cyclesCompleted: 0,
      cyclesTarget: 0,
      durationSec: 0,
    };
    const total = cur
      ? {
          protocolKind: cur.protocolKind,
          protocolName: cur.protocolName,
          cyclesCompleted: base.cyclesCompleted + cur.cyclesCompleted,
          cyclesTarget: cur.cyclesTarget,
          durationSec: base.durationSec + cur.durationSec,
        }
      : base;
    if (total.cyclesCompleted === 0 && total.durationSec === 0) return undefined;
    return {
      protocol: total.protocolKind,
      name: total.protocolName,
      cyclesCompleted: total.cyclesCompleted,
      cyclesTarget: total.cyclesTarget,
      durationSec: total.durationSec,
    };
  }, [breathworkEnabled]);

  /* Reset cumulative breathwork bij nieuwe sessie. */
  const resetBreathworkTracking = useCallback(() => {
    breathCurrentRunRef.current = null;
    breathCumulativeRef.current = null;
  }, []);

  /* Pause-state — BLE-contract kent geen native Pause (spec §8.1: alleen
     Start/Stop). Pseudo-pause werkt zo:
       - onPause()  : BLE Stop verzonden, `pausedAt` opslaan met
                      `status.remainingMinutes`. UI blijft op active-
                      view via de `isPaused || sessionActive`-check.
       - onResume() : BLE Start verzonden met clamped `pausedAt` als
                      nieuwe duration; pausedAt op null gezet.
       - onEnd()    : BLE Stop + pausedAt op null → idle-screen.
     De gebruiker ervaart 't als pause; fysiek is 't een korte stop +
     restart op de resterende minuten. Operator-keuze 2026-05-27. */
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const isPaused = pausedAt !== null;

  /* Completion-modal — toont mode-specifieke felicitatie zodra een
     sessie natuurlijk afloopt (timer hits 0). Niet bij manual End,
     niet bij Restart. Bewaart welke mode 'voltooid' werd zodat de
     juiste copy + kleur uit COMPLETION_MESSAGES wordt gerendered. */
  const [completedModeForModal, setCompletedModeForModal] =
    useState<BraceletMode | null>(null);

  /* Iter 9k: mode-detail popup terug op state-cards. Tap card opent
     bottom-sheet met "intent / bracelet / breath / use this for"
     en expliciete Choose-CTA om te selecteren. Geen schuif-panel
     meer onder de cards. */
  const [detailModeForModal, setDetailModeForModal] =
    useState<BraceletMode | null>(null);

  /* Track wanneer de huidige sessie begon (lokaal in component, niet
     persistent). Wordt gezet bij eerste onStart, gewist bij onStop.
     Bij pause/resume blijft de waarde staan zodat de totale doorlopen
     tijd correct geboekt wordt bij eind. Voor stats. */
  const sessionStartedAtRef = useRef<number | null>(null);

  /* Geplande duration van de huidige sessie — gebruikt voor de
     progress-arc rond de timer en de "of X total"-context-regel.
     Gezet bij onStart/onRestart, niet relevant op idle. */
  const sessionPlannedRef = useRef<number>(0);

  /* Iter 9be (2026-05-31): exact-elapsed-bij-pause ref. BLE-status geeft
     alleen minuten — display van pausedAt liep daardoor mm:00 ipv mm:ss
     en gaf een visuele backwards-jump op press. Hier vangen we de exact
     elapsed-ms vóór de async BLE Stop, zodat het tijdens pauze op
     EXACT het press-moment blijft hangen (geen jump, geen rounding). */
  const pausedAtElapsedMsRef = useRef<number>(0);

  /* Iter 9bj (2026-05-31): ECHTE wall-clock start (onaangetast door
     re-anchor op resume). sessionStartedAtRef wordt op resume virtueel
     gemaakt (Date.now() - exactElapsedMs) zodat de lokale display-timer
     vanaf de pause-tijd doortikt. Maar voor history's startedAt-ISO
     willen we de echte tijd dat de user de sessie startte. */
  const sessionRealStartedAtRef = useRef<number | null>(null);

  /* Iter 9ca (2026-05-31): breathwork-stats voor history.
     - currentRunRef: snapshot van de huidige enable-run (BreathworkStrip
       reset cycle/duration zodra disabled → vóór die reset moeten we
       deze run "vastpinnen" in cumulative).
     - cumulativeRef: cumulatief over alle enable/disable cycli binnen
       deze bracelet-sessie. Bij recordSession: cumulative + current. */
  const breathCurrentRunRef = useRef<{
    protocolKind: string;
    protocolName: string;
    cyclesCompleted: number;
    cyclesTarget: number;
    durationSec: number;
  } | null>(null);
  const breathCumulativeRef = useRef<{
    protocolKind: string;
    protocolName: string;
    cyclesCompleted: number;
    cyclesTarget: number;
    durationSec: number;
  } | null>(null);

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

  /* Connection state subscription. */
  useEffect(() => {
    const off = bracelet.onConnectionChange(setConn);
    return off;
  }, [bracelet]);

  /* When mode changes, reset duration to that mode's minimum (spec §11.2:
     default = minimum). Keep it clamped to the new mode's bounds. */
  useEffect(() => {
    setDuration(getModeMeta(selectedMode).minMinutes);
  }, [selectedMode]);

  /* Detecteer natural completion — sessionActive transitie true → false
     ZONDER dat user End/Pause/Restart heeft gedrukt. In die gevallen
     wordt sessionStartedAtRef expliciet door de handler gewist; bij
     natural completion blijft 'ie staan en deze useEffect record 'm. */
  const prevSessionActiveRef = useRef<boolean>(false);
  useEffect(() => {
    if (!status) return;
    const wasActive = prevSessionActiveRef.current;
    prevSessionActiveRef.current = status.sessionActive;

    /* Conditie voor natural-completion recording:
       - sessie was actief, is nu niet meer (transitie)
       - we hebben nog een startedAt-timestamp (= niet expliciet gewist)
       - we zijn niet in paused state (anders is dit een pause-stop) */
    if (
      wasActive &&
      !status.sessionActive &&
      sessionStartedAtRef.current !== null &&
      pausedAt === null
    ) {
      /* Iter 9bl (2026-05-31): duration = ACTIEVE tijd, consistent met
         onStop/onRestart. Voor natural completion (bracelet timer auto-
         eindigt) is dit (now - sessionStartedAtRef) waar startedAt
         re-anchored is op iedere resume — dus cumulatieve actieve tijd
         ≈ planned (zonder pauzes). pausedAt === null (natural completion
         conditie), dus altijd active-branch. */
      const realStartedAt =
        sessionRealStartedAtRef.current ?? sessionStartedAtRef.current;
      const startedAt = sessionStartedAtRef.current;
      sessionStartedAtRef.current = null;
      sessionRealStartedAtRef.current = null;
      const elapsedMin = Math.max(
        1,
        Math.round((Date.now() - startedAt) / 60000),
      );
      const planned = clampDuration(selectedMode, duration);
      recordSession({
        mode: selectedMode,
        startedAt: new Date(realStartedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationMin: elapsedMin,
        plannedMin: planned,
        status: 'completed',
        breathwork: buildBreathworkRecord(),
      });
      /* Trigger felicitatie-modal — alleen bij natural completion,
         niet bij manual End of Restart (die clearen
         sessionStartedAtRef expliciet en raken deze branch niet). */
      setCompletedModeForModal(selectedMode);
      /* Iter v147 (2026-06-25): voice-cue bij natural completion.
         Mirror van breath-voice's playCompletionCue: niet gegate'd
         op voiceEnabled — sessie is afgewerkt, closing-reward verdiend. */
      playBraceletCompletionCue(selectedMode);
      /* Reset breathwork toggle bij natural completion zodat volgende
         sessie weer met breathwork=uit start (opt-in default). */
      setBreathworkEnabled(false);
      resetBreathworkTracking();
    }
  }, [status, pausedAt, selectedMode, duration, buildBreathworkRecord, resetBreathworkTracking]);

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
  const navigateBackToSource = () => {
    if (fromContext === 'audio') router.navigate('/(tabs)/' as never);
    else if (fromContext === 'bracelet') router.navigate('/(tabs)/bracelet' as never);
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
    else if (fromContext === 'bracelet') router.navigate('/(tabs)/bracelet' as never);
  };

  /* Iter 2026-06-05: label naast back-arrow afgeleid uit fromContext.
     Undefined → BraceletHeader toont alleen "←" (bestaand gedrag). */
  const ctaBackLabel = fromContext === 'audio' ? 'Audio Library'
                     : fromContext === 'bracelet' ? 'Bracelet'
                     : undefined;

  /* Auto-connect + auto-start voor Free Breathwork CTA-flow.
     Wanneer user landt met ?breathwork=1 willen we niet dat hij eerst
     het "Bracelet connect" zoek-scherm moet doorlopen + handmatig Start
     moet tappen. Vuur op mount één keer: connect (indien nodig) →
     sendCommand Start. Daarna gaat de render-branch automatisch naar
     het Active-scherm. De breathwork-strip toont onderaan in idle-state
     met een "Start"-knop — user start breathwork zelf wanneer klaar. */
  const autoStartFiredRef = useRef(false);
  useEffect(() => {
    if (autoStartFiredRef.current) return;
    if (!autoStartBracelet) return;
    autoStartFiredRef.current = true;

    (async () => {
      try {
        if (bracelet.getConnectionState() !== 'connected') {
          await bracelet.connect();
        }
        const dur = clampDuration(initialMode, getModeMeta(initialMode).minMinutes);
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
        resetBreathworkTracking();
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
        const st = await bracelet.requestStatus();
        setStatus(st);
      } catch (e) {
        console.warn('[bracelet-control] auto-start failed:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStart = async () => {
    setBusy(true);
    /* Iter v197 (2026-07-04): endedLocally reset — nieuwe sessie mag niet
       geblokkeerd worden door de flag van een vorige End. */
    setEndedLocally(false);
    try {
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: clampDuration(selectedMode, duration),
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
      sessionPlannedRef.current = clampDuration(selectedMode, duration);
      /* Iter 9ca: schone start voor breathwork-tracking. */
      resetBreathworkTracking();
      /* Iter v147 (2026-06-25): voice-cue bij sessie-start. SessionKey
         = mode-duration-startMs zodat opeenvolgende sessies elk hun
         eigen cue krijgen (idempotent voor poll-renders binnen 1
         sessie). */
      playBraceletStartCue(
        selectedMode,
        `${selectedMode}-${sessionPlannedRef.current}-${startMs}`,
      );
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

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
      if (sessionStartedAtRef.current !== null) {
        const realStartedAt =
          sessionRealStartedAtRef.current ?? sessionStartedAtRef.current;
        const startedAt = sessionStartedAtRef.current;
        sessionStartedAtRef.current = null;
        sessionRealStartedAtRef.current = null;
        const elapsedMs = isPaused
          ? pausedAtElapsedMsRef.current
          : Date.now() - startedAt;
        const elapsedMin = Math.max(1, Math.round(elapsedMs / 60000));
        recordSession({
          mode: selectedMode,
          startedAt: new Date(realStartedAt).toISOString(),
          endedAt: new Date().toISOString(),
          durationMin: elapsedMin,
          plannedMin: clampDuration(selectedMode, duration),
          status: 'stopped',
          breathwork: buildBreathworkRecord(),
        });
      }
      pausedAtElapsedMsRef.current = 0;
      resetBreathworkTracking();
      setPausedAt(null);
      /* Reset breathwork toggle bij manual End (opt-in begint weer schoon
         volgende sessie). Bij natural completion gebeurt dit in de
         useEffect die de modal triggert. */
      setBreathworkEnabled(false);
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
    if (pausedAt === null) return;
    const resumeDuration = clampDuration(selectedMode, pausedAt);
    const exactElapsedMs = pausedAtElapsedMsRef.current;
    setBusy(true);
    /* Iter v200 (2026-07-04): endedLocally reset op Resume. Anders zou
       een Resume na een Pause + End cycle (edge case) de UI in idle
       houden ondanks nieuwe actieve sessie. Defensive reset. */
    setEndedLocally(false);
    try {
      await bracelet.sendCommand({
        mode: selectedMode,
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
      if (sessionStartedAtRef.current !== null) {
        const realStartedAt =
          sessionRealStartedAtRef.current ?? sessionStartedAtRef.current;
        const startedAt = sessionStartedAtRef.current;
        const elapsedMs = isPaused
          ? pausedAtElapsedMsRef.current
          : Date.now() - startedAt;
        const elapsedMin = Math.max(1, Math.round(elapsedMs / 60000));
        recordSession({
          mode: selectedMode,
          startedAt: new Date(realStartedAt).toISOString(),
          endedAt: new Date().toISOString(),
          durationMin: elapsedMin,
          plannedMin: clampDuration(selectedMode, duration),
          status: 'stopped',
          breathwork: buildBreathworkRecord(),
        });
      }
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
      resetBreathworkTracking();
      setPausedAt(null);
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  /* Iter v197 (2026-07-04): endedLocally — lokale flag die derived
     sessionActive overrulen als user End tikte. Zonder deze flag
     bleef de 5s-poll (line 3448+) status.sessionActive=true zetten
     als de sim niet meteen Stop verwerkte → user zat 3 builds lang
     vast op active-screen. Reset bij nieuwe Start/Restart. */
  const [endedLocally, setEndedLocally] = useState(false);

  /* ── Derived state ─────────────────────────────────────────────── */
  const sessionActive = !endedLocally && (status?.sessionActive ?? false);
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
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sessionActive]);

  /* BackHandler op active session (iter 8). Bij pressing system-back
     vanaf de actieve sessie tonen we "End session?"-confirmatie.
     Iter 9bm (2026-05-31): useFocusEffect ipv useEffect → handler is
     ALLEEN actief wanneer bracelet-control geactueerd het focused scherm
     is. Wanneer user naar /bracelet-history pusht: history wordt focused,
     bracelet-control unfocused → handler wordt gedeactiveerd → back vanaf
     history fired GEEN End-session popup meer. Bij terugkomst krijgt
     bracelet-control focus terug en wordt de handler heractiveerd. */
  useFocusEffect(
    useCallback(() => {
      if (!sessionActive && !isPausedRef.current) return;
      const handler = BackHandler.addEventListener('hardwareBackPress', () => {
        setEndSessionVisible(true);
        return true; // prevent default until user picks an option
      });
      return () => handler.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionActive]),
  );
  /* isPausedRef voor BackHandler — vangt ook tijdens pause. */
  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = pausedAt !== null;
  }, [pausedAt]);
  const batteryColor =
    battery == null
      ? Brand.textDim
      : criticalBattery
        ? Brand.error
        : lowBattery
          ? WARN
          : Brand.success;

  /* Active mode shown in session view — uses status.currentMode (what the
     bracelet is actually running), niet selectedMode (user's last UI pick). */
  const activeMeta = status ? getModeMeta(status.currentMode) : meta;
  const presets = useMemo(() => durationPresets(selectedMode), [selectedMode]);

  /* ── Render branches ────────────────────────────────────────────────
     Determine which "screen" to show based on connection + status. Each
     branch returns its own complete layout; this keeps the JSX flat and
     avoids deep conditional nesting. The sticky bottom-button content
     is computed per branch and rendered below the ScrollView. */

  /* SCREEN 3: Not connected */
  if (conn !== 'connected') {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <BraceletHeader
          title="Bracelet connect"
          showBack={fromContext !== null || router.canGoBack()}
          onBack={fromContext ? navigateBackToSource : () => router.back()}
          backLabel={ctaBackLabel}
        />
        {!isBraceletOwner && <PreviewBanner />}
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
              <Text style={s.searchingTitle}>Bracelet not linked</Text>
              <Text style={s.searchingSub}>
                Activate your bracelet with your 12-character code to
                connect it to this account.
              </Text>
            </>
          ) : (
            <>
              <SearchingPulse color={Brand.accent} />
              <Text style={s.searchingTitle}>
                {conn === 'scanning'
                  ? 'Searching'
                  : conn === 'connecting'
                    ? 'Connecting'
                    : 'Looking for your bracelet'}
              </Text>
              <Text style={s.searchingSub}>
                Make sure your bracelet is nearby and powered on.
              </Text>
            </>
          )}
        </View>
        <View style={s.bottomBar}>
          {/* Iter 9dq v93 (2026-06-03): wanneer de bracelet nog NIET
              geactiveerd is, vervangen we de Connect/Retry-knop door
              een primaire "Activate your bracelet"-CTA. Connect heeft
              geen zin zolang er geen bracelet aan dit account hangt.
              Operator-rationale: "connect knop zou misschien niet actief
              moeten zijn in pro zolang bracelet niet geactiveerd is". */}
          {showActivationPrompt ? (
            <Pressable
              style={s.primaryBtn}
              onPress={() => router.navigate('/activate-bracelet' as never)}
              accessibilityLabel="Activate your bracelet with a code"
            >
              <Text style={s.primaryBtnText}>Activate your bracelet</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[s.outlinedBtn, busy && s.btnDisabled]}
              onPress={onConnect}
              disabled={busy}
              accessibilityLabel="Retry searching for bracelet"
            >
              {busy ? (
                <ActivityIndicator color={Brand.text} />
              ) : (
                <Text style={s.outlinedBtnText}>
                  {conn === 'disconnected' ? 'Connect' : 'Retry'}
                </Text>
              )}
            </Pressable>
          )}
        </View>
        {/* Iter v194 (2026-07-04): InlineBraceletTabBar toevoeging weer
            teruggedraaid. Bracelet-control render is intern in de
            (tabs) navigator (via BraceletControl-inline in bracelet-tab
            owner-view) → systeem tab bar was al zichtbaar → mijn stub
            gaf DUBBELE tab bar. Systeem tab bar is genoeg. */}
      </SafeAreaView>
    );
  }

  /* SCREEN 6: Fault state (firmware reported error) */
  if (fault) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <BraceletHeader
          title="Bracelet error"
          onBack={onDisconnect}
        />
        {!isBraceletOwner && <PreviewBanner />}
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
          <Pressable
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
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* SCREEN 4: Charging — sessions paused (spec §11.5) */
  if (charging && !sessionActive) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <BraceletHeader
          title="Bracelet charging"
          onBack={onDisconnect}
        />
        {!isBraceletOwner && <PreviewBanner />}
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

  /* SCREEN 2: Active session — kalm, één focuspunt.
     Operator-feedback 2026-05-27 iter 3:
       - End button moest rustiger (neutraal, geen rode CTA)
       - Pause + Resume + Restart toegevoegd
       - Wanneer paused: timer toont pausedAt, eyebrow "PAUSED",
         Resume-button (mode-color filled) ipv Pause
     UI-stay-condition: sessionActive OF isPaused — anders zou de
     transitie naar idle de pause-state direct breken. */
  if ((sessionActive || isPaused) && status) {
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
      if (isPaused) {
        const elapsedMin = pausedAtElapsedMsRef.current / 60000;
        return Math.min(1, Math.max(0, elapsedMin / planned));
      }
      const startedAt = sessionStartedAtRef.current;
      if (startedAt !== null) {
        const elapsedMin = (nowMs - startedAt) / 60000;
        return Math.min(1, Math.max(0, elapsedMin / planned));
      }
      /* Fallback: BLE-status als startedAt onbekend (hot-reload edge). */
      return Math.min(
        1,
        Math.max(0, (planned - displayRemaining) / planned),
      );
    })();
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        {/* Active session blijft immersief voor ALLE accounts.
            Iter 9dq v109 (2026-06-04): voorheen had non-owner een preview-
            header met back-arrow tijdens active session. Voor unified
            UX nu ook hidden — eind-knop is de juiste exit (consistent
            met spec §11 "één focuspunt").
            Iter 2026-06-05: ALLEEN voor Free Breathwork CTA-flow voegen
            we tóch een back-header toe zodat user naar bronpagina terug
            kan. Non-CTA users zien geen header (bestaand immersief gedrag). */}
        <Stack.Screen options={{ headerShown: false }} />
        {fromContext && (
          <BraceletHeader
            title=""
            onBack={disconnectAndBackToSource}
            backLabel={ctaBackLabel}
          />
        )}
        {/* Ambient tint-overlay — 8% opacity full-screen mood layer.
            pointerEvents="none" zodat touches doorgaan naar onderliggende
            UI. Zit BOVEN Brand.bg maar onder alle content (eerste child). */}
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
               player.tsx en andere bottom-CTAs. */
            { paddingBottom: Math.max(safeInsets.bottom + 24, 72) },
          ]}
        >
          {/* Iter 9bz (2026-05-31): PAUSED-eyebrow staat nu BOVEN de
              mode-naam (was eronder). Voelt natuurlijker — eerst de
              state, daarna wat-voor-mode. Centered, mode-color, klein. */}
          {isPaused && (
            <Text
              style={[s.pausedLabel, { color: activeMeta.color }]}
            >
              PAUSED
            </Text>
          )}
          {/* Mode label */}
          <View style={s.activeModeRow}>
            <View
              style={[s.activeDot, { backgroundColor: activeMeta.color }]}
            />
            <Text style={s.activeName}>{activeMeta.name}</Text>
          </View>
          {/* Stale-status banner — verschijnt na 3 mislukte polls (15s)
              zodat user weet dat battery/remaining mogelijk verouderd is.
              Geen rood/alarm — gedimde tekst, informatief. Bracelet
              draait autonoom door (BLE §8 design), dus geen paniek. */}
          {staleStatus && (
            <Text style={s.staleNote}>
              Connection unstable — values may be out of date
            </Text>
          )}
          {/* Iter 9bg (2026-05-31): "Resuming will extend"-notice weg.
              Reden: sinds iter 9bf gebruikt het lokale display de exact-
              elapsed-ref voor pause én voor resume. De gebruiker ziet de
              countdown gewoon doortikken vanaf de pause-tijd — de BLE-
              minimum-extensie speelt zich onder water af en is voor de
              user onzichtbaar. Notice was alleen verwarrend (operator-
              feedback: "wat bedoel je met resuming will extend"). */}

          {/* Adem-cirkel + timer + progress-arc.
              Layering: ProgressArc buitenste laag (300px), PulsingCircle
              (280) in, timer-tekst center. Klokwaarts vullen van -90°
              (top) naar +270° (terug bovenaan). */}
          {/* DrainingCircle = primaire progress-visual (water-metafoor).
              ProgressArc weggehaald 2026-05-27 iter 3: was redundant
              met de drain. Drain alleen is duidelijker en kalmer. */}
          <View style={s.timerWrap}>
            <DrainingCircle
              progress={progress}
              color={activeMeta.color}
              size={220}
            />
            {/* Ambient pulse (vaste 8s/8s, niet breath-paced).
                2026-05-27 iter 5: breath-pacing is verhuisd naar de
                opt-in BreathworkStrip onderaan. Centrale cirkel pulseert
                nu alleen subtiel als "apparaat is aan"-signaal. */}
            <SlowAmbientPulse color={activeMeta.color} size={280} />
            <View style={s.timerCenter} pointerEvents="none">
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
                let remSec: number;
                if (isPaused) {
                  /* Exact-ms uit ref → mm:ss precisie behouden tijdens
                     pause. Floor om half-seconde-flicker te voorkomen. */
                  const elapsedSec = Math.floor(
                    pausedAtElapsedMsRef.current / 1000,
                  );
                  remSec = Math.max(0, plannedSec - elapsedSec);
                } else if (startedAt) {
                  const elapsedSec = Math.max(
                    0,
                    Math.floor((nowMs - startedAt) / 1000),
                  );
                  remSec = Math.max(0, plannedSec - elapsedSec);
                } else {
                  /* Fallback: gebruik BLE-minutes als startedAt onbekend
                     (edge case bij hot-reload mid-session). */
                  remSec = displayRemaining * 60;
                }
                const mm = Math.floor(remSec / 60);
                const ss = remSec % 60;
                const totalMM = Math.floor(plannedSec / 60);
                const totalSS = plannedSec % 60;
                /* Iter 9ee: contrast-fix voor alle mode-colors. Tijdens
                   drain wisselt achtergrond per tekst-positie tussen
                   mode-color (water) en dark-bg (lucht). Voor light
                   modes (Boost wit): donkere tekst + witte glow.
                   Voor dark modes (overige): witte tekst + zwarte glow
                   zodat 't leesbaar blijft op zowel mode-color als de
                   dark-bg uitloop. */
                const lightActive = isLightColor(activeMeta.color);
                const timerColorOverride = lightActive
                  ? {
                      color: '#0a0a0a',
                      textShadowColor: 'rgba(255,255,255,0.45)',
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 5,
                    }
                  : {
                      color: '#ffffff',
                      textShadowColor: 'rgba(0,0,0,0.65)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 6,
                    };
                return (
                  <>
                    {/* Iter 2026-06-05: kleine "BRACELET" caption boven de
                        timer wanneer user via Free Breathwork CTA komt.
                        Operator-feedback: anders denkt de breathwork-user
                        dat de countdown voor breathwork is. */}
                    {fromContext && (
                      <Text style={[s.timerContextLabel, timerColorOverride]}>
                        BRACELET
                      </Text>
                    )}
                    <Text style={[s.timerNum, timerColorOverride]}>
                      {mm}:{ss.toString().padStart(2, '0')}
                    </Text>
                    <Text
                      style={[
                        s.timerUnit,
                        lightActive
                          ? { color: '#0a0a0a' }
                          : {
                              textShadowColor: 'rgba(0,0,0,0.55)',
                              textShadowOffset: { width: 0, height: 1 },
                              textShadowRadius: 3,
                            },
                      ]}
                    >
                      {/* Iter 9by (2026-05-31): tijdens pause altijd
                          "left" tonen i.p.v. "paused". De PAUSED-eyebrow
                          boven de mode-naam communiceert de state al;
                          dubbele "paused" voelde redundant. De tijd is
                          nog steeds wat over is. */}
                      left
                    </Text>
                    <Text
                      style={[
                        s.timerTotal,
                        lightActive
                          ? { color: 'rgba(0,0,0,0.55)' }
                          : {
                              textShadowColor: 'rgba(0,0,0,0.50)',
                              textShadowOffset: { width: 0, height: 1 },
                              textShadowRadius: 3,
                            },
                      ]}
                    >
                      of {totalMM}:{totalSS.toString().padStart(2, '0')}
                    </Text>
                  </>
                );
              })()}
            </View>
          </View>

          {/* Iter 9aa: Pause + End knoppen DIRECT onder de pulse-ring.
              Operator-feedback: vroeger waren ze in een bottom-bar maar
              dat staat te hoog voelt los van de session. Nu fysiek
              gekoppeld aan timer-cluster, met thumb-friendly afstand. */}
          {/* Iter 9ab (2026-05-31): expliciete pressed-state styling.
              Vroeger geen press-callback → platform-default ripple/highlight
              maakte de bg licht/wit en de witte tekst werd onleesbaar.
              Nu: pressed = subtiel donkerder bg + iets minder opacity op
              tekst, zodat contrast altijd gegarandeerd is. */}
          <View style={s.inlineActionRow}>
            {isPaused ? (
              (() => {
                /* Iter 9ad (2026-05-31): Resume-button contrast-fix. Voor
                   LIGHT modes (Boost wit) was tekst hardcoded wit op witte
                   mode-color bg → onleesbaar. Nu: isLightColor() bepaalt
                   text+spinner. Boost → zwarte tekst, anderen → wit. */
                const resumeLight = isLightColor(activeMeta.color);
                const resumeFg = resumeLight ? '#0a0a0a' : '#ffffff';
                return (
                  <Pressable
                    style={({ pressed }) => [
                      s.inlineActionFilled,
                      { backgroundColor: activeMeta.color },
                      /* Light modes krijgen een subtiele witte border zodat
                         de knop niet "verdwijnt" tegen lichte ambient tint. */
                      resumeLight && {
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.25)',
                      },
                      pressed && { opacity: 0.75 },
                      busy && s.btnDisabled,
                    ]}
                    android_ripple={{
                      color: resumeLight
                        ? 'rgba(0,0,0,0.18)'
                        : 'rgba(255,255,255,0.18)',
                      borderless: false,
                    }}
                    onPress={onResume}
                    disabled={busy}
                    accessibilityLabel="Resume session"
                  >
                    {busy ? (
                      <ActivityIndicator color={resumeFg} />
                    ) : (
                      <Text
                        style={[
                          s.inlineActionFilledText,
                          { color: resumeFg },
                        ]}
                      >
                        Resume
                      </Text>
                    )}
                  </Pressable>
                );
              })()
            ) : (
              <Pressable
                style={({ pressed }) => [
                  s.inlineActionOutlined,
                  pressed && s.inlineActionOutlinedPressed,
                  busy && s.btnDisabled,
                ]}
                android_ripple={{ color: 'rgba(255,255,255,0.10)', borderless: false }}
                onPress={onPause}
                disabled={busy}
                accessibilityLabel="Pause session"
              >
                {busy ? (
                  <ActivityIndicator color={Brand.text} />
                ) : (
                  <Text style={s.inlineActionOutlinedText}>Pause</Text>
                )}
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                s.inlineActionOutlined,
                pressed && s.inlineActionOutlinedPressed,
                busy && s.btnDisabled,
              ]}
              android_ripple={{ color: 'rgba(255,255,255,0.10)', borderless: false }}
              /* Iter v193 (2026-07-03): End-knop opent nu de bestaande
                 end-session modal ipv direct onStop. Voorkomt per-ongeluk-
                 stoppen; consistent met back-pijl-gedrag. */
              onPress={() => setEndSessionVisible(true)}
              disabled={busy}
              accessibilityLabel="End session"
            >
              {busy ? (
                <ActivityIndicator color={Brand.text} />
              ) : (
                <Text style={s.inlineActionOutlinedText}>End</Text>
              )}
            </Pressable>
          </View>

          {/* Iter v201 (2026-07-04): Close-knop toegevoegd. Verlaat het
              scherm ZONDER de sessie te stoppen — hardware draait autonoom
              door op de bracelet (spec §6). User kan Audio Library, Breath
              of Account openen; sessie loopt gewoon door. Bij terugkomst
              in Bracelet Control ziet 'ie de sessie nog draaien. */}
          <Pressable
            style={({ pressed }) => [
              s.closeSessionBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => router.replace('/(tabs)/bracelet' as never)}
            accessibilityLabel="Close screen — session keeps running"
          >
            <Text style={s.closeSessionBtnText}>
              Close · Session keeps running
            </Text>
          </Pressable>

          {/* Iter v149 v4 (2026-06-25): Voice toggle prominent op active
              session view. Operator-feedback: dimmer-knop moet hier
              zichtbaar zijn, niet verstopt in Settings (bv. user begint
              sessie tijdens vergadering en wil meteen kunnen stillen). */}
          <Pressable
            style={[
              s.voiceToggleRow,
              voiceCues && {
                borderColor: activeMeta.color + '55',
                backgroundColor: activeMeta.color + '14',
              },
            ]}
            onPress={() => setVoiceCues(!voiceCues)}
            accessibilityLabel={`Voice guidance ${voiceCues ? 'on — tap to mute' : 'off — tap to enable'}`}
          >
            {voiceCues ? (
              <Volume2 size={18} color={activeMeta.color} />
            ) : (
              <VolumeX size={18} color={Brand.textDim} />
            )}
            <Text
              style={[
                s.voiceToggleLabel,
                voiceCues && { color: Brand.text },
              ]}
            >
              Voice guidance
            </Text>
            <Text
              style={[
                s.voiceToggleState,
                voiceCues && { color: activeMeta.color },
              ]}
            >
              {voiceCues ? 'ON' : 'OFF'}
            </Text>
          </Pressable>

          {/* BreathingHint weggehaald 2026-05-27 iter 5: ademgids leeft
              nu in de opt-in BreathworkStrip onderaan, niet meer hier. */}

          {/* Conditional warnings — only when something needs attention. */}
          {(lowBattery || criticalBattery) && (
            <View style={s.activeWarn}>
              <Text style={[s.activeWarnIcon, { color: batteryColor }]}>
                {criticalBattery ? '⚠' : '🪫'}
              </Text>
              <Text style={s.activeWarnText}>
                {criticalBattery
                  ? `Critical battery (${battery}%) — session may end early`
                  : `Low battery (${battery}%)`}
              </Text>
            </View>
          )}
          {charging && (
            <View style={s.activeWarn}>
              <Text style={[s.activeWarnIcon, { color: Brand.success }]}>
                ⚡
              </Text>
              <Text style={s.activeWarnText}>Charging</Text>
            </View>
          )}

          {/* Restart-link weggehaald 2026-05-27 (operator-feedback "active
              scherm moet op één view passen, geen scroll"). User die wil
              herstarten doet End → opnieuw Start vanaf idle-scherm. */}

          {/* Rotating quote per mode — fade-cross-over om de 22s.
              Brand-aligned Stoic / direction-georiënteerd. Subtle,
              niet pushy.
              Iter 9z: verbergen wanneer breathwork actief — dan is de
              breathwork-card al de focus en geeft de quote distractie
              + content-overflow. */}
          {!breathworkEnabled && (
            <RotatingQuote quotes={MODE_QUOTES[activeMeta.mode]} />
          )}

          {/* Stats-strip weggehaald van active screen 2026-05-27 iter 5
              (operator-keuze): "bracelet+haptic is main, breathwork
              optioneel". De plek onderaan is nu voor de opt-in
              BreathworkStrip. Stats blijven zichtbaar op het idle-screen
              en in de completion-modal (na sessie-eind), dus geen
              info-verlies. */}
          {/* Iter 2026-06-05 v2: Context-chip vlak boven de breathwork-card
              wanneer user via Free Breathwork CTA komt (operator-feedback:
              eerder bovenaan scherm geplaatst maar moet visueel gekoppeld
              zijn aan de breathwork-strip). Apple-stijl pill in brand-blauw,
              zichtbaar maar subtiel. */}
          {fromContext && (
            <View style={s.breathContextChip}>
              <Text style={s.breathContextChipText}>
                FREE BREATHWORK · {activeMeta.name} mode
              </Text>
            </View>
          )}
          {/* Iter 8c: mode={selectedMode} ipv activeMeta.mode. Reden:
              activeMeta wordt uit BLE-status afgeleid, en `currentMode`
              kan tijdens pauze terugvallen naar 0 (sim/fw resets). Dat
              triggerde BreathworkStrip's useEffect [enabled, mode] →
              protocol-loop reset → cyclus weer naar 0. selectedMode is
              stabiel gedurende de hele sessie (gezet bij idle-pick,
              niet veranderd tot sessie eindigt). */}
          <BreathworkStrip
            mode={selectedMode}
            enabled={breathworkEnabled}
            onToggle={() => setBreathworkEnabled((v) => !v)}
            onProgress={(data) => {
              breathCurrentRunRef.current = data;
            }}
          />
        </View>

        {/* Sim demo bar verhuisd naar idle-screen (operator-feedback:
            tijdens een actieve sessie hoort er geen dev-noise te zijn).
            Indien dev nog wil testen tijdens active: zelf wisselen
            naar idle, knoppen daar bedienen, dan terug naar active. */}

        {/* Action bar — Pause+End (running) of Resume+End (paused).
            Beide neutrale outlined buttons; Resume krijgt mode-color
            fill als primary action want user wil door.
            Iter 9aa: bottom-bar verwijderd. Pause/End nu inline onder
            de pulse-ring (zie inlineActionRow hierboven in JSX). */}
      </SafeAreaView>
    );
  }

  /* SCREEN 1: Idle — mode selection + duration + Start CTA.
     Iter 9 (operator-feedback): herschreven naar single-screen layout
     zonder scroll. Mode bovenaan als horizontale chip-picker, duration
     kort eronder, Start CTA prominent, mini-footer met stats+history.
     Doel: alles in één blik zichtbaar zonder scrollen, Apple-style
     hiërarchie met eyebrow-headers. */
  return (
    /* Iter 9bb (2026-05-31): SafeAreaView edges conditional op owner-status.
       Voor OWNERS (inline render in /bracelet tab, geen native header) =
       ['top','bottom'] zodat status-bar niet over de content valt.
       Voor NON-OWNERS (preview met native Stack header) = ['bottom'] only,
       want de native header consumeert al de top safe-area. Dubbele 'top'
       inset gaf een grote leegte tussen header en content. */
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <BraceletHeader
        title="Bracelet control"
        onBack={fromContext ? disconnectAndBackToSource : onDisconnect}
        backLabel={ctaBackLabel}
      />
      {!isBraceletOwner && <PreviewBanner />}
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
          { paddingBottom: Math.max(safeInsets.bottom + 24, 72) },
        ]}
      >
        {/* Iter 9bb (2026-05-31): preview-exit pill verwijderd. De native
            Stack header toont al "Bracelet preview" + back-arrow voor
            non-owners → de in-screen pill was dubbele duplicate. Levert
            ~60px verticale ruimte op, content schuift omhoog (operator
            wilde hele pagina hoger). PREVIEW-signal blijft in de native
            header-titel. */}
        {/* Status row — compact, één regel */}
        <View style={s.statusRow}>
          <View style={s.statusDotRow}>
            <View style={s.statusDot} />
            <Text style={s.statusInline}>
              CONNECTED  ·{'  '}
              {criticalBattery
                ? 'Critical battery'
                : lowBattery
                  ? 'Low battery'
                  : 'Ready'}
            </Text>
          </View>
          {/* Iter 9dq v106 (2026-06-04): Disconnect-link IN status-row.
              Iter 9dq v108 (2026-06-04): isBraceletOwner-conditie weg.
              Operator-mandate: bracelet connect/control/active moet
              voor alle 3 accounts (Audio PRO, Bracelet PRO, Full PRO)
              EXACT hetzelfde zijn. Toon Disconnect altijd in connected
              state behalve tijdens pre-activation banner-flow (waar
              de banner bovenaan al de primary action is). */}
          <View style={s.statusRightGroup}>
            <Text style={[s.statusBattery, { color: batteryColor }]}>
              {battery == null ? '—' : `${battery}%`}
            </Text>
            {!showActivationPrompt && (
              <Pressable
                onPress={onDisconnect}
                hitSlop={10}
                accessibilityLabel="Disconnect bracelet"
              >
                <Text style={s.statusDisconnect}>Disconnect</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Choose mode — horizontale scroll van foto-cards (iter 9b)
            Operator-feedback: equal-size cards, foto's terug, elegant.
            Vaste 110pt breed × 140pt hoog per card, foto full-bleed met
            dark gradient onder voor tekst-legibility. */}
        <View style={s.modeH2Row}>
          <Text style={[s.idleH2, { marginTop: 0, marginBottom: 0 }]}>
            Choose mode
          </Text>
          {/* Iter 9m: scroll-affordance hint — vertelt user dat er
              meer modes zijn dan zichtbaar in viewport. */}
          <Text style={s.modeScrollHint}>Swipe →</Text>
        </View>
        {/* Iter 9d v3: wrapper View met expliciete height. Een
            horizontal ScrollView in een flex:1 column parent kreeg
            soms 0px height ondanks `style.height`. Fixed parent
            forceert correcte allocation. */}
        <View style={s.modeCardScrollWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.modeCardStrip}
          >
          {MODES.map((m: ModeMeta) => {
            const active = m.mode === selectedMode;
            const photo = MODE_IMAGES[m.mode];
            return (
              <View key={m.mode} style={s.modeCardGroup}>
              <Pressable
                style={[
                  s.modeCardSmall,
                  active && {
                    borderColor: m.color,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => setSelectedMode(m.mode)}
                accessibilityLabel={`Select ${m.name} mode`}
              >
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    style={s.modeCardSmallPhoto}
                    resizeMode="cover"
                    resizeMethod="resize"
                    fadeDuration={0}
                  />
                ) : (
                  <LinearGradient
                    colors={[hexToTint(m.color, 0.5), 'rgba(20,20,20,0.95)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.modeCardSmallPhoto}
                  />
                )}
                {photo && (
                  <LinearGradient
                    colors={[
                      'rgba(0,0,0,0.05)',
                      'rgba(0,0,0,0.88)',
                    ]}
                    style={s.modeCardSmallOverlay}
                  />
                )}
                <View style={s.modeCardSmallContent}>
                  <View
                    style={[s.modeCardSmallDot, { backgroundColor: m.color }]}
                  />
                  <View>
                    <Text style={s.modeCardSmallName} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={s.modeCardSmallDur}>
                      {m.minMinutes}–{m.maxMinutes} min
                    </Text>
                  </View>
                </View>
              </Pressable>
              {/* Iter 9l v2: info-button alleen visueel actief onder de
                  GESELECTEERDE card. Andere cards behouden ruimte voor
                  layout-consistentie (geen jump), maar button is
                  onzichtbaar + disabled → user weet meteen dat info
                  hoort bij de card waar 'ie op staat. */}
              <Pressable
                style={[
                  s.modeInfoBtn,
                  active && {
                    backgroundColor: hexToTint(m.color, 0.12),
                    borderColor: hexToTint(m.color, 0.40),
                  },
                  !active && { opacity: 0 },
                ]}
                onPress={
                  active ? () => setDetailModeForModal(m.mode) : undefined
                }
                disabled={!active}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel={`Learn about ${m.name}`}
                accessibilityElementsHidden={!active}
              >
                <Text
                  style={[
                    s.modeInfoBtnText,
                    active && { color: m.color },
                  ]}
                >
                  ⓘ  More info
                </Text>
              </Pressable>
              </View>
            );
          })}
          </ScrollView>
          {/* Fade-gradient op rechter-rand — visuele hint dat er meer
              content is om naar te scrollen. pointerEvents:none zodat
              touch-events de ScrollView blijven bereiken. */}
          <LinearGradient
            colors={['rgba(10,10,10,0)', Brand.bg]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={s.modeCardScrollFade}
            pointerEvents="none"
          />
        </View>

        {/* Iter 9e: inline detail-panel volledig verwijderd. Operator-
            feedback: "werkt niet, schuift gewoon, voelt niet als popup".
            Mode-info komt later via aparte i-knop of na sessie-start. */}

        {/* ── Duration — kleine fill-cirkel + slider (iter 9b)
            Fill-circle terug op verzoek, maar 90pt ipv 200pt zodat 't
            past in single-screen layout. Getal staat in de cirkel,
            water-fill geeft visuele context van waar in range. */}
        <Text style={s.idleH2}>Choose duration</Text>
        <View style={s.durCircleSmallWrap}>
          <DurationFillCircle
            value={duration}
            min={meta.minMinutes}
            max={meta.maxMinutes}
            color={meta.color}
            size={76}
          />
        </View>
        <DurationSlider
          min={meta.minMinutes}
          max={meta.maxMinutes}
          value={duration}
          onChange={(v) => setDuration(v)}
        />
        {/* Iter 9d: durRangeRow weggehaald — DurationSlider heeft zelf
            al min/max labels onder de track (sliderLabels-style). Was
            visuele duplicatie. */}

        {/* Spacer — pushes Start-CTA + footer naar onderkant. Geeft de
            pagina meer breathing room (operator-feedback iter 9b). */}
        <View style={{ flex: 1, minHeight: 12 }} />

        {/* Start CTA — kleiner, lager geplaatst (operator-feedback iter 9b).
            Iter 9d: contrast-fix voor Boost (witte mode-color) — bij
            light bg-kleur tonen we zwarte text + zwarte arrow. */}
        {(() => {
          const light = isLightColor(meta.color);
          const textColor = light ? '#0a0a0a' : '#ffffff';
          return (
            <Pressable
              style={[
                s.startBtnSmall,
                { backgroundColor: meta.color },
                light && {
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.20)',
                },
                busy && s.btnDisabled,
              ]}
              onPress={onStart}
              disabled={busy || criticalBattery}
              accessibilityLabel={`Start ${meta.name} session`}
            >
              {busy ? (
                <ActivityIndicator color={textColor} />
              ) : (
                <>
                  <Text style={[s.startBtnSmallText, { color: textColor }]}>
                    Start {meta.name}
                  </Text>
                  <Text style={[s.startBtnSmallArrow, { color: textColor }]}>
                    →
                  </Text>
                </>
              )}
            </Pressable>
          );
        })()}

        {/* Low battery warning (compact, alleen als nodig) */}
        {lowBattery && (
          <View style={s.warnChip}>
            <Text style={s.warnChipIcon}>⚠</Text>
            <Text style={s.warnChipText}>
              Battery may not last the full session
            </Text>
          </View>
        )}

        {/* Mini-footer: stats samengevat in 1 regel + history-link.
            Iter 9bm (2026-05-31): footer is ALTIJD zichtbaar (was alleen
            bij totalSessions > 0). Operator-feedback: na terugkomst van
            /bracelet-history kon de link visueel verdwijnen (transient
            stats-state). Door 'm altijd te tonen kan user altijd terug
            naar history. Bij 0 sessies: vriendelijke "No sessions yet"
            i.p.v. de stats-regel. */}
        <View style={s.idleFooter}>
          <Text style={s.idleFooterText}>
            {stats.totalSessions > 0
              ? `${stats.todaySessions} today  ·  ${stats.totalMinutes} min total`
              : 'No sessions yet'}
          </Text>
          <Pressable
            onPress={() => router.push('/bracelet-history' as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="View session history"
          >
            <Text style={s.idleFooterLink}>History →</Text>
          </Pressable>
        </View>

        {/* Iter 9dq v105 (2026-06-04): "Complete the system" Audio
            Library upsell verwijderd op operator-verzoek
            ("upsell complete the system is hier niet nodig"). Audio
            upsell-pad blijft beschikbaar via Account-tab subscription-
            card. Hier op bracelet-control hoorde 't niet thuis —
            content moet in scherm passen, geen extra cards. */}

        {/* Sim demo controls — alleen in sim-mode, helemaal onderaan */}
        {__DEV__ && sim && <SimDemoBar sim={sim} />}
      </View>

      {/* CompletionModal — toont na natural completion (timer hits 0).
          Rendert hier omdat na completion de UI vanzelf naar idle gaat. */}
      {completedModeForModal !== null && (
        <CompletionModal
          mode={completedModeForModal}
          onDismiss={() => setCompletedModeForModal(null)}
        />
      )}

      {/* ModeDetailModal — bottom-sheet popup op tap mode-card (iter 9k).
          Selectie via "Choose [mode]" CTA binnenin; backdrop/X = sluit
          zonder selecteren. */}
      {detailModeForModal !== null && (
        <ModeDetailModal
          mode={detailModeForModal}
          onChoose={() => {
            setSelectedMode(detailModeForModal);
            setDetailModeForModal(null);
          }}
          onClose={() => setDetailModeForModal(null)}
        />
      )}

      {/* Iter v149 v5 (2026-06-25): End-session confirm modal in VIBEZCORE
          stijl ipv system Alert.alert. Dark panel + mode-accent border,
          3 duidelijke CTAs (Cancel / Keep running / End session). */}
      <Modal
        visible={endSessionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEndSessionVisible(false)}
        statusBarTranslucent
      >
        <Pressable
          style={s.endModalBackdrop}
          onPress={() => setEndSessionVisible(false)}
        >
          <Pressable
            style={[
              s.endModalCard,
              { borderColor: getModeMeta(selectedMode).color + '55' },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={s.endModalTitle}>End session?</Text>
            <Text style={s.endModalBody}>
              The bracelet will stop and you&apos;ll return to the previous
              screen. To keep the session running in the background, tap
              &ldquo;Keep running&rdquo;.
            </Text>

            <Pressable
              style={[
                s.endModalBtnPrimary,
                { backgroundColor: getModeMeta(selectedMode).color },
              ]}
              onPress={() => setEndSessionVisible(false)}
            >
              <Text
                style={[
                  s.endModalBtnPrimaryText,
                  isLightColor(getModeMeta(selectedMode).color) && {
                    color: '#0a0a0a',
                  },
                ]}
              >
                Keep running
              </Text>
            </Pressable>

            <Pressable
              style={s.endModalBtnDestructive}
              onPress={async () => {
                setEndSessionVisible(false);
                await onStop();
                /* Iter v201 (2026-07-04): hard-navigate weg van active
                   screen naar Bracelet-tab owner-view. Vertrouwen op
                   derived state (endedLocally) faalde volgens operator
                   op vC 53 → force navigation is 100% betrouwbaar. */
                router.replace('/(tabs)/bracelet' as never);
              }}
            >
              <Text style={s.endModalBtnDestructiveText}>End session</Text>
            </Pressable>

            <Pressable
              style={s.endModalBtnCancel}
              onPress={() => setEndSessionVisible(false)}
            >
              <Text style={s.endModalBtnCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Iter v194 (2026-07-04): InlineBraceletTabBar op idle Choose Mode
          verwijderd. Bracelet-control zit binnen (tabs) navigator (via
          bracelet-tab inline-render) → systeem tab bar was er al →
          mijn stub gaf DUBBELE bar op operator-scherm en verdrong
          zelfs de Start-knop uit beeld. */}
    </SafeAreaView>
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

/* Bepaal of een hex-kleur "licht" is — gebruikt voor button-text-contrast.
   Boost-mode is #FFFFFF (operator iter 8): witte tekst op witte bg =
   onleesbaar. Met deze helper kunnen we automatisch zwart op licht
   tonen en wit op donker. ITU-R BT.601 luminance formule. */
function isLightColor(hex: string): boolean {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return luma > 180;
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },

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
    height: 48,
    paddingHorizontal: 8,
    backgroundColor: Brand.bg,
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
  headerBackArrow: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.regular,
    lineHeight: 28,
  },
  /* Iter 2026-06-05: label tekst naast back-arrow. Subtiel, dim, regular.
     Alleen zichtbaar wanneer backLabel prop is gezet (CTA-flow). */
  headerBackLabel: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
    opacity: 0.85,
  },
  headerTitle: {
    flex: 1,
    color: Brand.text,
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
    textAlign: 'center',
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
  /* Iter 9b: section titles vervangen eyebrows op idle screen
     (operator-feedback "header moet choose mode en duration zijn").
     Title-case, proper hierarchy, meer breathing room.
     Iter 9m: margins zitten nu op modeH2Row wrapper (voor scroll-hint
     naast title), maar idleH2 wordt ook elders gebruikt (Duration). */
  idleH2: {
    color: Brand.text,
    fontSize: 20,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
    /* Iter 9dq v107 (2026-06-04): margins gecomprimeerd zodat
       History-footer in scherm past zonder scrollen. Was 22/14. */
    marginTop: 12,
    marginBottom: 8,
  },
  /* ── Mode card strip (horizontal scroll) ─────────────────────────── */
  /* Iter 9d: expliciete flex-grow op de ScrollView om te voorkomen dat
     hij gecomprimeerd wordt door flex-layout. flexGrow:0 + height
     match met card-hoogte (138) + extra ruimte voor border. */
  /* Iter 9l: scroll-wrapper hoger om de info-button onder elke card
     te accommoderen. 148 (alleen card) → 180 (card + button + gap).
     position:relative zodat de fade-gradient absoluut kan positioneren. */
  modeCardScrollWrap: {
    /* Iter 9dq v107: 180 → 156. Card 138 → 116 saves 22. */
    height: 156,
    position: 'relative',
  },
  /* Iter 9m: fade-gradient over rechter-rand om scroll-affordance te
     geven. Subtle hint: "er is meer naar rechts". */
  modeCardScrollFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
  },
  /* Iter 9m: h2-row met titel + "Swipe →" hint. */
  modeH2Row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    /* Iter 9dq v107: margins gecomprimeerd. */
    marginTop: 12,
    marginBottom: 8,
  },
  modeScrollHint: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.5,
  },
  modeCardScroll: {
    flexGrow: 0,
    height: 180,
  },
  /* Group = card + info-button verticaal gestapeld (iter 9l). */
  modeCardGroup: {
    alignItems: 'center',
  },
  /* Iter 9l v2: info-button als capsule onder de geselecteerde card.
     Mode-color tint maakt visueel duidelijk welke card 'm hoort. */
  modeInfoBtn: {
    /* Iter 9dq v107: 8 → 4. */
    marginTop: 4,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeInfoBtnText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
  modeCardStrip: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 16, // matched root padding zodat laatste card niet plakt
    paddingVertical: 2, // ruimte voor selected border
  },
  modeCardSmall: {
    /* Iter 9dq v107: 138 → 116, saves 22px verticaal. */
    width: 110,
    height: 116,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeCardSmallPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  modeCardSmallOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modeCardSmallContent: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    justifyContent: 'space-between',
  },
  modeCardSmallDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modeCardSmallName: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modeCardSmallDur: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    marginTop: 2,
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
    color: Brand.text,
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
    color: Brand.text,
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
  /* Duration kleine fill-circle wrap */
  durCircleSmallWrap: {
    alignItems: 'center',
    /* Iter 9dq v107: 16 → 8. */
    marginBottom: 8,
  },
  /* ── Breathwork animaties (iter 9f/g) ──────────────────────────────
     Container voor alle protocol-specifieke animaties. */
  boxBreathContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    minHeight: 110, // ruimte voor labels en padding
  },
  /* Iter 9j: compact container voor unified pulse (70pt anim).
     Doel: card-hoogte ON-state matches OFF-state. */
  /* Iter 9bv (2026-05-31): compacter ON-state breath container voor
     cross-platform fit. 78 → 64, marginVertical 4 → 2 (–18px). */
  boxBreathContainerCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
    marginVertical: 2,
  },
  /* Compact prompt — iter 9bv: marginTop 4→2, marginBottom 6→4 (–4px). */
  breathOnPromptCompact: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
    marginTop: 2,
    marginBottom: 4,
  },
  /* Compact meta (count + time inline). */
  /* Iter 9ee: dark-gray op witte bg */
  breathOnMetaCompact: {
    textAlign: 'center',
    color: 'rgba(0,0,0,0.50)',
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.2,
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
     onder, donker backdrop, ronde top-corners op de sheet. */
  modeModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modeModalSheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 22,
    /* paddingBottom wordt dynamisch toegevoegd vanuit useSafeAreaInsets
       in de component (iter 9m) — base 24 + insets.bottom. */
    maxHeight: '85%',
  },
  modeModalHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginBottom: 14,
  },
  modeModalClose: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeModalCloseText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    lineHeight: 16,
  },
  modeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 18,
    paddingRight: 40, // ruimte voor close-X
  },
  modeModalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  modeModalName: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
  },
  modeModalSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    marginTop: 2,
  },
  /* Intent — de "wat is dit voor"-zin onder de header. Iets groter en
     levendiger dan body-text. */
  modeModalIntent: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    lineHeight: 22,
    letterSpacing: -0.2,
    marginTop: 4,
    marginBottom: 4,
  },
  modeModalSectionLbl: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  modeModalDesc: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  modeModalIdeals: {
    gap: 6,
    marginBottom: 4,
  },
  modeModalIdealRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeModalIdealCheck: {
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    marginRight: 10,
    width: 16,
  },
  modeModalIdealText: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  modeModalProtocol: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  modeModalProtocolHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    lineHeight: 16,
    marginTop: 4,
  },
  modeModalCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 22,
  },
  modeModalCtaText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  modeModalCtaArrow: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },
  /* Smaller / lower start button (iter 9b).
     Iter 9dq v107: marginBottom 14 → 6, padding 14 → 12. */
  startBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 6,
    marginBottom: 6,
    alignSelf: 'center',
    minWidth: '70%',
  },
  startBtnSmallText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  startBtnSmallArrow: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
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
    color: Brand.text,
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
    color: Brand.text,
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
  /* Idle footer: stats + history-link op één compacte regel */
  idleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  idleFooterText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
  },
  idleFooterLink: {
    color: Brand.text,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.1,
  },
  /* Audio Library upsell — alleen zichtbaar voor bracelet-only owners.
     Subtiele accent-tinted card onderaan het idle-screen, voor de
     SimDemoBar. Niet opdringerig (geen full bg-fill), wel zichtbaar
     genoeg om te tappen. Operator-toevoeging 2026-05-30. */
  audioUpsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(58,143,255,0.08)',
    borderColor: 'rgba(58,143,255,0.28)',
    borderWidth: 1,
    borderRadius: 14,
  },
  audioUpsellEyebrow: {
    color: Brand.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  audioUpsellTitle: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  audioUpsellSub: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 17,
  },
  audioUpsellArrow: {
    color: Brand.accent,
    fontSize: 22,
    fontFamily: BrandFonts.bold,
    marginLeft: 4,
  },
  /* Status row — minimal text-only met groene live-dot. Status-pill
     verwijderd 2026-05-27 (operator-feedback "pillen ouderwets"). */
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    /* Iter 9dq v107: 20 → 10. */
    marginBottom: 10,
  },
  /* Iter 9dq v106 (2026-06-04): Disconnect inline in status-row.
     statusRightGroup houdt battery% + Disconnect samen rechts. */
  statusRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDisconnect: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(138,138,138,0.40)',
    paddingVertical: 4,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Brand.success,
  },
  statusInline: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  statusBattery: {
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  sectionTitle: {
    color: Brand.text,
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
    backgroundColor: Brand.panel,
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

  /* Duration fill-cirkel (water-fill, mode-color stijgt met slider). */
  durCircleWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  durFillOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Track is een container; bar is de gevulde portion die van onder
     omhoog groeit. position:absolute + bottom:0 zorgt voor de "water-
     fill" effect. */
  durFillTrack: {
    ...StyleSheet.absoluteFillObject,
  },
  durFillBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.45,
  },
  durFillContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  durFillNum: {
    color: Brand.text,
    fontSize: 52,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -2,
    lineHeight: 56,
    /* Text-shadow voor leesbaarheid wanneer de fill achter het getal
       komt (vooral bij hoge slider-waarden). */
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  durFillUnit: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.5,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  /* Slider — touch-area is hoger dan visible track voor betere
     hit-area. Horizontale padding van 20 zodat de thumb bij min-
     waarde (x=0) NIET in Android's back-gesture-zone valt (eerste
     ~24dp vanaf links). Zonder deze padding sleurt elke drag-from-
     left de gebruiker terug naar de vorige pagina. */
  sliderTouch: {
    height: 44,
    justifyContent: 'center',
    marginVertical: 8,
    marginHorizontal: 20,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  sliderFilled: {
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -3,
    /* Neutrale fill (operator-keuze 2026-05-27): mode-color zit nu
       in de fill-cirkel boven de slider, slider zelf blijft grijs. */
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  sliderThumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    /* Neutrale border kleur (was mode-color). */
    borderColor: 'rgba(255,255,255,0.40)',
    /* Subtle shadow voor "tactile" feel — thumb voelt fysiek. */
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    /* Matched de marginHorizontal van sliderTouch zodat labels netjes
       onder de slider-uiteinden uitlijnen. */
    marginHorizontal: 22,
    marginTop: 6,
  },
  sliderLabel: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.3,
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
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    flex: 1,
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
  /* Iter 9bw (2026-05-31): marginBottom 26 → 14 om de hele timer-
     cluster omhoog te brengen → breathwork-card krijgt zo onderaan
     meer ruimte zonder dat 't tegen de safe-zone plakt. */
  activeModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeName: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
  },
  /* Timer-cirkel — 300px om de ProgressArc (300) volledig te
     omvatten. PulsingCircle (280) zit center-positioned binnenin. */
  /* Iter 9bw: marginBottom 14 → 6 (–8px) zodat Pause/End buttons
     dichter onder de timer-cirkel komen en de breathwork-card meer
     bodem-ruimte heeft. */
  timerWrap: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
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
  /* DrainingCircle — vol bij start, leegt naarmate session vordert.
     overflow:hidden + borderRadius zorgt voor de cirkel-shape clipping
     van de fill-bar die van onder omhoog groeit. */
  drainOuter: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  /* drainFill weggehaald iter 7: water-fill wordt nu door SVG path
     gerenderd binnen DrainingCircle (wave-animatie). */
  /* rotatingArcWrap verwijderd iter 8 — RotatingArc weggehaald, rotatie
     leeft nu in SlowAmbientPulse zelf. */
  /* Start-knop op OFF-card. Mode-color filled, full-width, prominent. */
  breathStartBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  breathStartBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.3,
  },
  /* Iter 9cc — top-row van OFF-card: info links + action-chip rechts */
  breathOffTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breathOffInfo: {
    flex: 1,
  },
  /* Compact action-chip rechtsboven — Apple-style (afgerond, prominent) */
  breathStartChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  breathStartChipText: {
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  breathStartChipArrow: {
    fontSize: 14,
    fontFamily: BrandFonts.bold,
  },
  /* ── CompletionModal ─────────────────────────────────────────── */
  completionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  completionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  completionCard: {
    width: '85%',
    maxWidth: 380,
    backgroundColor: Brand.panel,
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
    color: Brand.text,
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
    color: Brand.textDim,
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
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    textAlign: 'center',
    marginBottom: 18,
  },
  completionMsgLine1: {
    color: Brand.text,
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  completionMsgLine2: {
    color: Brand.textDim,
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
  timerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Timer-getal mm:ss formaat. Iter 8c: pure wit (#FFFFFF) ipv
     Brand.text (#f4f4f4) voor max contrast op gevulde mode-color
     achtergrond. Operator-feedback: "tekst in de cirkel blijft bijna
     onleesbaar" — bij Delta groen was 't met off-white te zwak. */
  /* Iter 2026-06-05: kleine BRACELET-caption boven de timer (alleen
     zichtbaar wanneer user via Free Breathwork CTA komt). Erft kleur
     van timerColorOverride zodat het leesbaar blijft op light + dark
     mode-achtergronden. */
  timerContextLabel: {
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.4,
    marginBottom: 6,
    textAlign: 'center',
    opacity: 0.7,
  },
  /* Iter 2026-06-05: Context-chip bovenaan active screen wanneer user
     via Free Breathwork CTA komt. Apple-stijl pill in brand-blauw,
     subtiel maar duidelijk — communiceert: "dit scherm draait nu in
     breathwork-context, de bracelet onderaan is de motor".
     v2 (2026-06-05): marginTop 16 toegevoegd zodat chip ademruimte
     heeft tov de Resume/End action-row erboven. Voorheen geen marginTop
     waardoor chip tegen de knoppen aan kleefde wanneer breathwork-card
     uitklapte. */
  breathContextChip: {
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(58,143,255,0.10)',
    borderColor: 'rgba(58,143,255,0.30)',
    borderWidth: 1,
  },
  breathContextChipText: {
    color: Brand.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.6,
  },
  timerNum: {
    color: '#FFFFFF',
    fontSize: 52,
    fontFamily: BrandFonts.bold,
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  timerUnit: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  /* "of X:XX" — context-regel onder de timer-unit. Bumped van 30% naar
     55% opacity (iter 7) — operator-feedback "tekst onder minuten is
     niet zichtbaar". Nu duidelijk leesbaar. */
  timerTotal: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.4,
    marginTop: 8,
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
  /* RotatingQuote — onderaan, italic, cross-fade om de 22s. Tightened
     2026-05-27: smaller + iets dimmer zodat 't ondersteunend voelt, niet
     concurrent met de timer. Smallere lijn (paddingHorizontal 44) maakt
     'm meer "pull-quote"-achtig dan een gewone alinea. */
  rotatingQuote: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    fontStyle: 'italic',
    letterSpacing: 0.1,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 22,
    marginBottom: 0,
    paddingHorizontal: 44,
  },
  /* "PAUSED"-eyebrow nu BOVEN de mode-naam (iter 9bz). Centered, mode-
     color, ALL CAPS met spacing — duidelijk visueel statement zonder
     schreeuwerig te zijn. Margins zo dat 't strak boven de mode-naam
     hangt zonder visuele gap. */
  pausedLabel: {
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.5,
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 4,
  },
  /* Stale-poll banner — verschijnt onder mode-row als BLE-status oud
     is. Geen alarm-rood; subtiele waarschuwing. */
  staleNote: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 18,
    paddingHorizontal: 24,
    maxWidth: 320,
  },
  /* Inline notice direct onder PAUSED-label — verschijnt alleen als
     resume de duration zal verhogen (BLE-spec minimum). Kleine, gedimde
     tekst — informatief, niet alarmerend. */
  pausedNote: {
    color: Brand.textDim,
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
    color: Brand.textDim,
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
  /* Iter 9aa: Pause + End inline onder pulse-ring. Twee gelijke
     knoppen naast elkaar, thumb-friendly afstand, niet tegen rand. */
  /* Iter 9bw: marginTop 18 → 4 (–14px). Pause/End direct onder timer
     verschuift de breathwork-card omhoog → meer ademruimte naar
     bottom safe-zone. */
  inlineActionRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 4,
    paddingHorizontal: 24,
    width: '100%',
  },
  inlineActionFilled: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActionFilledText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.3,
  },
  inlineActionOutlined: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Iter 9ab (2026-05-31): pressed-state. Iets DONKERDER bg ipv lichter,
     zodat witte tekst altijd contrast houdt (bug: vroeger werd bg licht
     en tekst onzichtbaar). Border-color blijft gelijk = duidelijke
     visuele tap-feedback zonder leesbaarheid op te offeren. */
  inlineActionOutlinedPressed: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderColor: 'rgba(255,255,255,0.30)',
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
  previewExitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  previewExitArrow: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    lineHeight: 17,
  },
  previewExitText: {
    color: Brand.text,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.3,
  },
  previewExitBadge: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.4,
  },
  inlineActionOutlinedText: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
  /* Iter v201 (2026-07-04): Close-knop op active session. Discreet,
     onder Pause+End rij. Verlaat scherm zonder hardware Stop → sessie
     draait autonoom door op de bracelet. */
  closeSessionBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeSessionBtnText: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.3,
  },
  /* Iter v149 v4 (2026-06-25): Voice toggle row op active session.
     Prominent zichtbaar, niet verstopt — tap-target met label + state.
     Border + bg veranderen bij ON state om duidelijk visueel feedback
     te geven. */
  voiceToggleRow: {
    marginTop: 12,
    marginHorizontal: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceToggleLabel: {
    flex: 1,
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    marginLeft: 10,
    letterSpacing: 0.1,
  },
  voiceToggleState: {
    color: Brand.textDim,
    fontSize: 11,
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
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  endModalBody: {
    color: Brand.textDim,
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
    color: Brand.error,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
  endModalBtnCancel: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  endModalBtnCancelText: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  /* Iter v150: BreathworkStrip completion modal styles (Buddha popup). */
  bwCompletionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bwCompletionSheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0f0f0f',
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  bwCompletionAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
  },
  bwCompletionBuddha: {
    width: 96,
    height: 96,
    marginTop: 6,
    marginBottom: 18,
  },
  bwCompletionEyebrow: {
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  bwCompletionTitle: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  bwCompletionBody: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
    marginBottom: 22,
    textAlign: 'center',
  },
  bwCompletionBtn: {
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  bwCompletionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.3,
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
    color: Brand.text,
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
  /* Warning-chip — alleen tijdens active session, en alleen wanneer
     condition daadwerkelijk geldt (low battery, charging). Subtiel,
     niet schreeuwerig — moet de zen niet breken. */
  activeWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  activeWarnIcon: {
    fontSize: 16,
  },
  activeWarnText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
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
  /* ── BreathworkStrip ────────────────────────────────────────────────
     Twee staten: OFF (uitnodigende card met benefit + duur) en ON
     (actieve card met geanimeerde breath-dot, progress, meta, context).
     Beide gebruiken mode-color als subtiele tint zodat 't visueel
     gekoppeld is aan de huidige sessie. Iter 6 (2026-05-27): meer
     "aanwezig" zonder de bracelet als primair element te verdringen. */

  /* OFF-state card — uitnodiging om breathwork in te schakelen. Mode-
     color border + 6% fill, vol-breedte. Korte hierarchie: eyebrow → titel
     → benefit → reassurance-hint. Tap-target = hele card. */
  /* Iter 9bb: compacter card op active screen — ambient pulse staat
     terug op 280, dus minder ruimte over. marginTop kleiner, padding
     dichter. */
  breathOffCard: {
    width: '100%',
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  /* Iter 9cc: marginBottom 8 → 4 (tightere stack info-blok links) */
  breathOffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  breathOffDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  /* Iter 9ee: text-kleuren voor wit card-bg */
  breathOffEyebrow: {
    flex: 1,
    color: 'rgba(0,0,0,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
  },
  breathOffPlus: {
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    lineHeight: 18,
  },
  /* Iter 9dq v8 (2026-06-02): "Learn more →" link onder de subline.
     Accent-blauw + arrow = duidelijk tap-target. Vervangt ⓘ icoon dat
     niet onmiddellijk discoverable was. */
  breathLearnMore: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  breathLearnMoreText: {
    color: Brand.accent,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
  /* ── Info-popup ─────────────────────────────────────────────────── */
  breathInfoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  breathInfoCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: Brand.panel,
    borderColor: 'rgba(58, 143, 255, 0.28)',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 22,
  },
  breathInfoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 12,
  },
  breathInfoEyebrow: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  breathInfoTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  breathInfoMeta: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    marginBottom: 18,
  },
  breathInfoSectionLabel: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  breathInfoBody: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
  },
  breathInfoClose: {
    marginTop: 22,
    paddingVertical: 12,
    alignItems: 'center',
  },
  breathInfoCloseText: {
    color: Brand.accent,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.3,
  },
  /* Iter 9ee: zwart op witte card-bg */
  breathOffTitle: {
    color: '#0a0a0a',
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
  },
  /* Iter 9ee: micro-info regel — dim-zwart voor wit bg */
  breathOffSubline: {
    color: 'rgba(0,0,0,0.50)',
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    marginTop: 2,
  },
  /* Iter 9ee: dark-gray op witte card-bg */
  breathOffBenefit: {
    color: 'rgba(0,0,0,0.70)',
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
    marginTop: 10,
  },
  breathOffHint: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  /* ON-state card — actieve breathwork. Mode-color border + 8% fill
     (iets sterker dan OFF om "aan"-staat te markeren). Layout:
       1. Header — mode-dot + protocol-naam (mode-color) + ✕
       2. Prompt + geanimeerde breath-dot (centraal, primair)
       3. Progress-balk
       4. Meta — counter + tijd resterend
       5. Benefit — context-footer
     */
  /* Iter 9bb: zelfde krimp als off-card */
  /* Iter 9bv → 9bw: marginTop 8 → 14, paddingVertical blijft 10.
     De buttons sitten nu hoger (iter 9bw), dus we kunnen iets meer
     visuele scheiding (marginTop) geven boven de card zonder dat 't
     onderaan tegen de safe-zone komt. */
  breathOnCard: {
    width: '100%',
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  /* Iter 9bv: header marginBottom 12→4 (–8px). */
  breathOnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  breathOnHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breathOnTitle: {
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
  },
  /* Iter 9ee: dim-zwart X-knop op wit bg */
  breathOnDismiss: {
    color: 'rgba(0,0,0,0.50)',
    fontSize: 16,
    fontFamily: BrandFonts.medium,
    paddingHorizontal: 4,
  },
  /* Prompt-row — prompt-text (left) + breath-dot animation (right). */
  breathOnPromptWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 14,
  },
  breathOnPrompt: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
  },
  /* Animated dot — schaalt met phase (0.4 → 1.6) en fade (0.35 → 0.85).
     Base size 14×14 zodat na 1.6× scale = 22px (still subtle). */
  breathOnDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  breathOnProgressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  breathOnProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  breathOnMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  breathOnCount: {
    color: Brand.text,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
  breathOnTime: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.2,
  },
  breathOnBenefit: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    fontStyle: 'italic',
    lineHeight: 16,
    textAlign: 'left',
  },
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
    color: Brand.text,
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
    backgroundColor: Brand.accent,
  },
  searchingTitle: {
    color: Brand.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  searchingSub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    lineHeight: 20,
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
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  chargingSub: {
    color: Brand.textDim,
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
    color: Brand.textDim,
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
    color: Brand.error,
    fontSize: 40,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 44,
  },
  faultTitle: {
    color: Brand.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  faultSub: {
    color: Brand.textDim,
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
    backgroundColor: Brand.bg,
  },
  primaryBtn: {
    backgroundColor: Brand.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  outlinedBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  outlinedBtnText: {
    color: Brand.text,
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
    color: Brand.error,
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
    color: Brand.textDim,
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
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
  },
  demoSep: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    marginHorizontal: 4,
  },
});
