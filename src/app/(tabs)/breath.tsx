/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Breath tab

   Directe ingang naar guided breathwork. Bestaande breathwork onder
   Bracelet/Audio CTA's blijft ongewijzigd.

   Vijf patterns, 1-op-1 met de 5 bracelet-states (CLAUDE.md §5).
   Default = Calm Control.

   Animatie: cirkel groeit tijdens INHALE, blijft GROOT tijdens HOLD-IN,
   krimpt tijdens EXHALE, blijft KLEIN tijdens HOLD-OUT.

   Cues: Vibration (built-in RN) op fase-overgangen, controleerbaar via
   📳 VIBE ON/OFF toggle. Geen medical / scientific claims — alleen
   state-taal.

   Modal-structuur 1-op-1 met ModeDetailModal in bracelet-control.tsx:
   intent / wat de breath doet / Use this for (ideals) / protocol /
   protocolHow. Modal opent NIET op card-tap (snel selecteren) maar
   via "Read protocol details" tekst onder de cards.

   Countdown: tijd loopt actief af tijdens sessie, gesynced met round
   + phase + secsLeft. Format "M:SS left" op de info-regel.
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import {
  setBreathSessionActive,
  clearBreathSession,
} from '@/services/breath-session-state';
import { useSetting } from '@/utils/settings';
import {
  addBreathSession,
  calculateStreak,
  useBreathHistory,
} from '@/utils/breath-history';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Vibrate, VibrateOff, Volume2, VolumeX } from 'lucide-react-native';
/* Iter 9dq v185 (operator 2026-06-18): pre-recorded voice cues via
   expo-audio (al in dev-build, geen rebuild nodig). Vervangt de
   expo-speech TTS-stub. Service in src/services/breath-voice.ts
   beheert 4 phase-cue files + 5 completion-files op Bunny CDN. */
import {
  playBreathCue,
  playCompletionCue,
  setVoiceEnabled,
  stopVoice,
  type BreathKey,
} from '@/services/breath-voice';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* ── Pattern config ──────────────────────────────────────────────── */
type BreathPattern = {
  key: 'boost' | 'focus' | 'calm' | 'clarity' | 'rest';
  name: string;
  tech: string;
  color: string;
  colorSoft: string;
  inhale: number;
  hold1: number;
  exhale: number;
  hold2: number;
  rounds: number;
  inhaleVia: 'nose' | 'mouth';
  exhaleVia: 'nose' | 'mouth';
  /* Modal sections — match bracelet-control.tsx ModeDescription structure */
  intent: string;
  breathDoes: string;
  protocol: string;
  protocolHow: string;
  ideals: string[];
};

const PATTERNS: BreathPattern[] = [
  {
    key: 'boost', name: 'Boost', tech: 'Quick activation',
    color: '#FFFFFF', colorSoft: 'rgba(255,255,255,0.25)',
    inhale: 2, hold1: 0, exhale: 2, hold2: 0, rounds: 45,
    /* Iter v168 (2026-06-28): Bhastrika is nose-breathing in én uit.
       Voorheen 'mouth' exhale → mismatch met de bedoeling van het pattern. */
    inhaleVia: 'nose', exhaleVia: 'nose',
    intent: 'Alert, energized — primed for high-output moments.',
    breathDoes:
      'Short even nose breaths wake the system up and break through fatigue.',
    protocol: 'Energizing breath 2-2 · 3 min',
    protocolHow:
      'Quick rhythmic in-out breathing. Inspired by Bhastrika pranayama — builds alertness through faster pace.',
    ideals: ['Energy', 'Mental sprints', 'Pre-workout', 'Speed & precision'],
  },
  {
    key: 'focus', name: 'Sharp Focus', tech: 'Coherent breath',
    color: '#FF9F0A', colorSoft: 'rgba(255,159,10,0.30)',
    inhale: 5, hold1: 0, exhale: 5, hold2: 0, rounds: 30,
    inhaleVia: 'nose', exhaleVia: 'nose',
    intent: 'Locked-in focus — attention that holds the line.',
    breathDoes:
      'Equal 5-second inhales and exhales through the nose anchor your attention to one task at a time.',
    protocol: 'Coherent breath 5-5 · 5 min',
    protocolHow:
      'Inhale 5 seconds, exhale 5 seconds. Six breaths per minute — a resonance pace used in focus-research traditions.',
    ideals: ['Deep work', 'Morning activation', 'High cognitive load', 'Precision tasks'],
  },
  {
    key: 'calm', name: 'Calm Control', tech: 'Box breathing',
    color: '#0A84FF', colorSoft: 'rgba(10,132,255,0.30)',
    inhale: 4, hold1: 4, exhale: 4, hold2: 4, rounds: 19,
    inhaleVia: 'nose', exhaleVia: 'nose',
    intent: 'Steady and composed — alert but relaxed.',
    breathDoes:
      'Four equal phases — inhale, hold, exhale, hold — guide the system toward calm without dulling alertness.',
    protocol: 'Box breath 4-4-4-4 · 5 min',
    protocolHow:
      'Inhale 4, hold 4, exhale 4, hold 4. Used by special forces for stress recovery — the symmetric holds slow the system down.',
    ideals: ['Focused work', 'Midday reset', 'Social interactions', 'Problem-solving'],
  },
  {
    key: 'clarity', name: 'Clarity', tech: 'Long exhale',
    color: '#BF5AF2', colorSoft: 'rgba(191,90,242,0.30)',
    inhale: 4, hold1: 2, exhale: 6, hold2: 0, rounds: 20,
    inhaleVia: 'nose', exhaleVia: 'mouth',
    intent: 'Quieter mind — space for thought, decompression.',
    breathDoes:
      'A slightly longer exhale through the mouth invites an inward turn and lets mental noise settle.',
    protocol: 'Long-exhale 4-2-6 · 4 min',
    protocolHow:
      'Inhale 4, brief 2-second hold, exhale 6 through the mouth. Inspired by extended-exhale practices used in reflection traditions.',
    ideals: ['Reflection', 'Creative work', 'Emotional processing', 'Inward focus'],
  },
  {
    key: 'rest', name: 'Rest & Reset', tech: '4-7-8',
    color: '#4FA46B', colorSoft: 'rgba(79,164,107,0.30)',
    inhale: 4, hold1: 7, exhale: 8, hold2: 0, rounds: 12,
    inhaleVia: 'nose', exhaleVia: 'mouth',
    intent: 'Wind-down — recovery, pre-sleep, after stressful days.',
    breathDoes:
      'The longest exhale of the five patterns eases the system toward recovery mode.',
    protocol: '4-7-8 breath · 4 min',
    protocolHow:
      'Inhale 4, hold 7, exhale 8 through the mouth. Popularized by Dr. Andrew Weil — the extended exhale signals the body to slow down.',
    ideals: ['Physical recovery', 'Pre-sleep', 'Nervous system reset', 'Tension release'],
  },
];

type Phase = 'idle' | 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

/* Mode-specifieke felicitatie na natural completion. State-taal,
   geen medical claims.
   Iter 9dq v167 (operator-fix 2026-06-18): twee-regelige copy ipv één.
   Eerste regel = vivid statement (wat zojuist gebeurde), tweede regel =
   "wat nu"-hint. Levendiger dan de single-line die "saai" voelde. */
const COMPLETION_MESSAGES: Record<
  BreathPattern['key'],
  { line1: string; line2: string }
> = {
  boost: {
    line1: 'Your edge is sharper now.',
    line2: 'Take it into what comes next.',
  },
  focus: {
    line1: 'Focus locked in.',
    line2: 'The deep work is yours to claim.',
  },
  calm: {
    line1: 'Stillness reclaimed.',
    line2: 'Carry it into the next moment.',
  },
  clarity: {
    line1: 'Something opened up.',
    line2: 'Trust what surfaced. Act on it.',
  },
  rest: {
    line1: 'Your system softened.',
    line2: 'Recovery has already begun.',
  },
};

const CIRCLE_MIN = 0.55;
const CIRCLE_MAX = 1.0;
const HALO_MIN = 0.50;
const HALO_MAX = 1.15;

const VIB_INHALE = 60;
const VIB_HOLD = 30;
const VIB_EXHALE = 80;

/* Totale sessie-duur in seconden */
function patternDurationSec(p: BreathPattern): number {
  const cycle = p.inhale + p.hold1 + p.exhale + p.hold2;
  return cycle * p.rounds;
}
function formatMin(sec: number): string {
  return `${Math.round(sec / 60)} min`;
}
function formatMMSS(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* Bereken hoeveel seconden zijn verstreken in de huidige sessie, gesynced
   met round + phase + secsLeft. Bij idle = 0. */
function getElapsedSec(
  p: BreathPattern,
  roundNum: number,
  phase: Phase,
  secsLeft: number,
): number {
  if (roundNum === 0 || phase === 'idle') return 0;
  const completedRounds = roundNum - 1;
  const cycle = p.inhale + p.hold1 + p.exhale + p.hold2;
  let partial = 0;
  if (phase === 'inhale') partial = p.inhale - secsLeft;
  else if (phase === 'hold-in') partial = p.inhale + (p.hold1 - secsLeft);
  else if (phase === 'exhale') partial = p.inhale + p.hold1 + (p.exhale - secsLeft);
  else if (phase === 'hold-out') partial = p.inhale + p.hold1 + p.exhale + (p.hold2 - secsLeft);
  return completedRounds * cycle + partial;
}

export default function BreathScreen() {
  const [currentKey, setCurrentKey] = useState<BreathPattern['key']>('calm');
  const [phase, setPhase] = useState<Phase>('idle');
  const [running, setRunning] = useState(false);
  const [vibeOn, setVibeOn] = useState(true);
  /* v174: voice guidance default ON (operator wil "wereldklasse" feel —
     voice is de single biggest missing piece volgens jouw eigen audit). */
  /* Iter v150 (2026-06-25): voice toggle = Settings → voiceCues (single
     source of truth). Voorheen had breath.tsx een lokale voiceOn state die
     conflicteerde met Settings — operator zag 'voice cues' off in Settings
     terwijl in een session de breath voice nog aanstond. Nu wijzen alle
     toggles (Settings, breath-tab pill, bracelet active session) naar
     dezelfde useSetting('voiceCues'). */
  const [voiceOn, setVoiceOn] = useSetting('voiceCues');
  const [roundNum, setRoundNum] = useState(0);
  const [secsLeft, setSecsLeft] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  /* Iter 9dq v161 (operator-fix 2026-06-18): inline switch-confirm banner.
     Wanneer user mid-session op een andere pattern-card tapt, slaan we de
     gewenste switch op en tonen we een banner met [STOP & SWITCH]-knop.
     Voorheen: silent no-op = user denkt dat de app stuk is. */
  const [pendingSwitchKey, setPendingSwitchKey] =
    useState<BreathPattern['key'] | null>(null);
  /* Completion-state — gevuld bij natural completion (niet bij manual stop) */
  const [completion, setCompletion] = useState<{
    pattern: BreathPattern;
    durSec: number;
    rounds: number;
  } | null>(null);

  const scaleAnim = useRef(new Animated.Value(CIRCLE_MIN)).current;
  const haloAnim = useRef(new Animated.Value(HALO_MIN)).current;
  /* Completion-dot pulse animatie */
  const completionPulse = useRef(new Animated.Value(1)).current;
  /* Iter 9dq v162 (operator-fix 2026-06-18): hover-animatie voor de
     meditator-silhouette in de completion modal. Subtiel oscillerend
     translateY zodat het figuurtje "drijft" — voelt actiever dan een
     stilstaand icoon. */
  const silhouetteHover = useRef(new Animated.Value(0)).current;
  /* Scroll ref voor on-mount demo scroll (visuele hint dat horizontale
     scroll mogelijk is). */
  const patternsScrollRef = useRef<ScrollView | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);
  const roundRef = useRef(0);
  const vibeOnRef = useRef(true);
  const voiceOnRef = useRef(true);

  const history = useBreathHistory();

  /* On-mount demo-scroll: cards bewegen 70px naar rechts en daarna terug.
     Maakt onmiskenbaar zichtbaar dat de cards scrollbaar zijn. Alleen
     bij eerste mount, niet bij re-renders. */
  useEffect(() => {
    const t1 = setTimeout(() => {
      patternsScrollRef.current?.scrollTo({ x: 70, animated: true });
    }, 700);
    const t2 = setTimeout(() => {
      patternsScrollRef.current?.scrollTo({ x: 0, animated: true });
    }, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const current = PATTERNS.find((p) => p.key === currentKey) ?? PATTERNS[2];
  const totalSec = patternDurationSec(current);
  const elapsedSec = getElapsedSec(current, roundNum, phase, secsLeft);
  const remainingSec = Math.max(0, totalSec - elapsedSec);

  const clearTimers = useCallback(() => {
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      scaleAnim.stopAnimation();
      haloAnim.stopAnimation();
      Vibration.cancel();
    };
  }, [clearTimers, scaleAnim, haloAnim]);

  useEffect(() => {
    vibeOnRef.current = vibeOn;
  }, [vibeOn]);
  useEffect(() => {
    voiceOnRef.current = voiceOn;
    /* Sync de service-state met de UI-toggle. Bij toggle-off stopt de
       service zelf elke lopende cue. */
    setVoiceEnabled(voiceOn);
  }, [voiceOn]);

  const vibCue = useCallback((ms: number) => {
    if (!vibeOnRef.current) return;
    try { Vibration.vibrate(ms); } catch {}
  }, []);

  /* v185: voice cue via pre-recorded Bunny-CDN files (expo-audio).
     Per phase + protocol exhaleVia pickt de service de juiste URL en
     speelt 'm af. Stopt automatisch een eventueel lopende cue zodat
     ze niet overlappen bij snelle phase-transitions. */
  const voiceCue = useCallback((phase: 'inhale' | 'hold-in' | 'exhale' | 'hold-out', p: BreathPattern) => {
    if (!voiceOnRef.current) return;
    try {
      playBreathCue(phase, p.exhaleVia);
    } catch {
      /* swallow — audio-failure mag de sessie niet breken */
    }
  }, []);

  const runInhaleAnim = useCallback(
    (secs: number) => {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: CIRCLE_MAX, duration: secs * 1000, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
        Animated.timing(haloAnim, { toValue: HALO_MAX, duration: secs * 1000, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
      ]).start();
    },
    [scaleAnim, haloAnim],
  );

  const runExhaleAnim = useCallback(
    (secs: number) => {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: CIRCLE_MIN, duration: secs * 1000, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
        Animated.timing(haloAnim, { toValue: HALO_MIN, duration: secs * 1000, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
      ]).start();
    },
    [scaleAnim, haloAnim],
  );

  const startCountdown = useCallback((from: number, onDone: () => void) => {
    setSecsLeft(from);
    let remaining = from;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        setSecsLeft(0);
        onDone();
        return;
      }
      setSecsLeft(remaining);
    }, 1000);
  }, []);

  const runPhase = useCallback(
    (p: BreathPattern, ph: Phase) => {
      if (!runningRef.current) return;
      clearTimers();
      setPhase(ph);

      if (ph === 'inhale') {
        vibCue(VIB_INHALE);
        voiceCue('inhale', p);
        runInhaleAnim(p.inhale);
        startCountdown(p.inhale, () => {
          if (p.hold1 > 0) runPhase(p, 'hold-in');
          else runPhase(p, 'exhale');
        });
      } else if (ph === 'hold-in') {
        vibCue(VIB_HOLD);
        voiceCue('hold-in', p);
        startCountdown(p.hold1, () => runPhase(p, 'exhale'));
      } else if (ph === 'exhale') {
        vibCue(VIB_EXHALE);
        voiceCue('exhale', p);
        runExhaleAnim(p.exhale);
        startCountdown(p.exhale, () => {
          if (p.hold2 > 0) runPhase(p, 'hold-out');
          else nextRound(p);
        });
      } else if (ph === 'hold-out') {
        vibCue(VIB_HOLD);
        voiceCue('hold-out', p);
        startCountdown(p.hold2, () => nextRound(p));
      }
    },
    [clearTimers, runInhaleAnim, runExhaleAnim, startCountdown, vibCue, voiceCue],
  );

  /* Forward-ref naar endSession (declared verderop). Voorkomt TDZ-error
     én houdt nextRound zelf stabiel (geen re-create bij endSession-rerender). */
  const endSessionRef = useRef<((p: BreathPattern) => void) | null>(null);

  const nextRound = useCallback(
    (p: BreathPattern) => {
      const next = roundRef.current + 1;
      if (next > p.rounds) {
        endSessionRef.current?.(p); /* pattern doorgeven — geen closure */
        return;
      }
      roundRef.current = next;
      setRoundNum(next);
      runPhase(p, 'inhale');
    },
    [runPhase],
  );

  /* Iter v149 v3 (2026-06-25): ref naar cleanupSession zodat startSession
     een stable onStop callback aan de global breath-session state kan
     geven die latere re-renders overleeft. */
  const cleanupSessionRef = useRef<() => void>(() => {});

  const startSession = useCallback(() => {
    runningRef.current = true;
    setRunning(true);
    roundRef.current = 1;
    setRoundNum(1);
    runPhase(current, 'inhale');
    /* Registreer sessie in global state — root-layout toont mini-control
       wanneer user wegnavigeert. */
    setBreathSessionActive({
      patternKey: current.key,
      patternName: current.name,
      patternColor: current.color,
      onStop: () => cleanupSessionRef.current(),
    });
  }, [current, runPhase]);

  /* Interne cleanup — geen save, geen modal. Wordt gedeeld door manual
     stop (onStopPressed) en natural completion (endSession). */
  const cleanupSession = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    clearTimers();
    scaleAnim.stopAnimation();
    haloAnim.stopAnimation();
    Vibration.cancel();
    /* v185: stop ongoing voice-cue bij elke vorm van session-einde. */
    try { stopVoice(); } catch {}
    /* Iter v149 v3 (2026-06-25): wis de global session zodat de mini-
       control verdwijnt. Veilig om hier te doen — cleanupSession wordt
       altijd aangeroepen bij sessie-einde (manual, natural, unmount). */
    clearBreathSession();
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: CIRCLE_MIN, duration: 500, useNativeDriver: true }),
      Animated.timing(haloAnim, { toValue: HALO_MIN, duration: 500, useNativeDriver: true }),
    ]).start();
    setPhase('idle');
    setSecsLeft(0);
    setRoundNum(0);
    roundRef.current = 0;
  }, [clearTimers, scaleAnim, haloAnim]);

  /* Iter 9dq v161: pendingSwitchKey opruimen zodra de sessie eindigt
     (natural completion, manual stop, of welke andere reden). Voorkomt
     dat een stale banner blijft hangen. */
  useEffect(() => {
    if (!running) setPendingSwitchKey(null);
  }, [running]);

  /* Iter v149 v3: houdt cleanupSessionRef in sync met de huidige
     cleanupSession-closure zodat de stable onStop-callback (gebruikt
     door global breath-session-state's mini-control) altijd de meest
     recente cleanup uitvoert. */
  useEffect(() => {
    cleanupSessionRef.current = cleanupSession;
  }, [cleanupSession]);

  /* Iter 9dq v161: confirm-handler voor de switch-banner. Stopt huidige
     sessie (zelfde flow als onStopPressed → partial in history), switcht
     daarna naar de pending pattern, en wist de pending state. */
  const onConfirmSwitch = useCallback(() => {
    if (!pendingSwitchKey) return;
    const partialDur = getElapsedSec(current, roundNum, phase, secsLeft);
    if (partialDur >= 1) {
      void addBreathSession({
        key: current.key,
        name: current.name,
        durSec: partialDur,
        rounds: Math.max(1, roundNum),
        completed: false,
      });
    }
    cleanupSession();
    setCurrentKey(pendingSwitchKey);
    setPendingSwitchKey(null);
  }, [pendingSwitchKey, current, roundNum, phase, secsLeft, cleanupSession]);

  /* Manual STOP — gebruiker drukt knop. Slaat partial op in historiek
     mits er minstens 1 seconde gespeeld is. Geen completion modal. */
  const onStopPressed = useCallback(() => {
    const partialDur = getElapsedSec(current, roundNum, phase, secsLeft);
    if (partialDur >= 1) {
      void addBreathSession({
        key: current.key,
        name: current.name,
        durSec: partialDur,
        /* Hoeveelste round was gebruiker mee bezig — incl. de partiele */
        rounds: Math.max(1, roundNum),
        completed: false,
      });
    }
    cleanupSession();
  }, [cleanupSession, current, roundNum, phase, secsLeft]);

  /* Natural completion — pattern wordt EXPLICIET meegegeven door
     nextRound. Voorheen gebruikte deze de closure-variabele `current`,
     maar via nextRound (die zelf via runPhase opgeroepen wordt) was
     dat de pattern uit de FIRST render i.p.v. de actief draaiende sessie
     → alle completions toonden Calm Control (de default). */
  const endSession = useCallback((p: BreathPattern) => {
    const completedDur = patternDurationSec(p);

    cleanupSession();

    void addBreathSession({
      key: p.key,
      name: p.name,
      durSec: completedDur,
      rounds: p.rounds,
      completed: true,
    });

    setCompletion({
      pattern: p,
      durSec: completedDur,
      rounds: p.rounds,
    });
  }, [cleanupSession]);

  /* Sync ref met laatste endSession zodat nextRound de juiste versie aanroept. */
  useEffect(() => {
    endSessionRef.current = endSession;
  }, [endSession]);

  /* Pulse animatie op de completion-dot zolang modal open is */
  useEffect(() => {
    if (!completion) {
      completionPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(completionPulse, {
          toValue: 1.18,
          duration: 1100,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(completionPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [completion, completionPulse]);

  /* Iter 9dq v162: silhouette hover-loop. 3.2s cyclus (langzamer dan de
     dot-pulse) zodat de twee bewegingen niet synchroon lopen — voelt
     natuurlijker.
     v185: trigger ook de completion voice-cue wanneer de modal opent. */
  useEffect(() => {
    if (!completion) {
      silhouetteHover.setValue(0);
      return;
    }
    /* v185: speel de motiverende completion-monoloog parallel aan de
       visuele animatie. Voice draagt het lange verhaal; modal-tekst
       blijft kort en neutraal (zie JSX). */
    try {
      playCompletionCue(completion.pattern.key as BreathKey);
    } catch {
      /* swallow */
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(silhouetteHover, {
          toValue: 1,
          duration: 1600,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(silhouetteHover, {
          toValue: 0,
          duration: 1600,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [completion, silhouetteHover]);

  const onDismissCompletion = useCallback(() => {
    /* v185: stop voice ook bij dismiss zodat 'm niet doorpraat als de
       gebruiker DONE tikt vóór 't einde van de monoloog. */
    try { stopVoice(); } catch {}
    setCompletion(null);
  }, []);

  /* Card-tap: enkel selecteren, geen modal. Modal opent via "Read details".
     Iter 9dq v161 (operator-fix 2026-06-18): bij actieve sessie + tap op
     andere pattern → toon switch-confirm banner ipv silent no-op. Tap op
     dezelfde card als de huidige doet niets (al actief). */
  const onCardPress = useCallback(
    (key: BreathPattern['key']) => {
      if (running) {
        if (key !== currentKey) setPendingSwitchKey(key);
        return;
      }
      setCurrentKey(key);
    },
    [running, currentKey],
  );

  const onOpenModal = useCallback(() => {
    if (running) return;
    setModalOpen(true);
  }, [running]);

  const onCloseModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  /* Iter v168 (2026-06-28): functional setter form. Voorheen `setVoiceOn(!voiceOn)`
     met empty deps → stale closure: eerste tap toggle't, daarna blijft 'ie hangen
     op de initial-render waarde. Operator-melding 'voice on kan niet bediend
     worden'. Mirror van toggleVibe direct hieronder die wel functional form
     gebruikt. */
  const toggleVoice = useCallback(() => {
    setVoiceOn((v) => !v);
  }, [setVoiceOn]);

  const toggleVibe = useCallback(() => {
    setVibeOn((v) => !v);
  }, []);

  /* ── Render ──────────────────────────────────────────────────── */
  /* Iter v154 (2026-06-25): tekst 1:1 met voice cue. Operator-feedback:
     'in alle cards alles nakijken en aanpassen — Inhale Exhale, Hold'.
     Voice zegt 'Inhale through your nose', 'Exhale through your mouth',
     'Hold' — UI moet exact dit tonen.

     Twee aparte Texts (label + via) zodat de label groter blijft staan
     visueel, maar samen ze ÉÉN exact-dezelfde-string vormen als de voice:
     bv 'Inhale' + 'through your nose' = 'Inhale through your nose'. */
  const phaseLabel =
    phase === 'inhale' ? 'Inhale'
    : phase === 'hold-in' || phase === 'hold-out' ? 'Hold'
    : phase === 'exhale' ? 'Exhale'
    : 'Ready';

  /* Iter v168 (2026-06-28): consistent verkorte vorm ZONDER 'your' voor
     alle modes. Operator-feedback: korte snelle cycli (Boost 2-2) hebben
     geen tijd voor lange labels, en consistency is belangrijker dan
     formele beleefdheid. */
  const phaseVia =
    phase === 'inhale' ? `through ${current.inhaleVia}`
    : phase === 'exhale' ? `through ${current.exhaleVia}`
    : '';

  const startBtnBg = running ? 'rgba(255,255,255,0.06)' : current.color;
  const startBtnBorder = running ? Brand.border : current.color;
  const startBtnFg = running ? Brand.text : '#000';

  /* Duur-tekst onder visualizer — altijd MM:SS zodat het overal matcht
     (idle, running, completion modal). Idle toont totaal, running toont
     overgebleven tijd. */
  const durationDisplay = running
    ? `${formatMMSS(remainingSec)} left`
    : `${formatMMSS(totalSec)} total`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Breathe with intention.</Text>
        </View>

        {/* Iter 9dq v184 (operator-fix 2026-06-18): onboarding-card weg
            — "duwde alles naar beneden". Visualizer-ruimte gaat voor. */}

        {/* ── Pattern selector — horizontal scroll met right-edge fade ── */}
        <View style={styles.patternsWrap}>
          <ScrollView
            ref={patternsScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.patternsRow}
            style={styles.patternsScroll}
          >
            {PATTERNS.map((p) => {
              const active = p.key === currentKey;
              return (
                <Pressable
                  key={p.key}
                  style={[
                    styles.patternCard,
                    active && {
                      borderColor: p.color,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                    },
                  ]}
                  onPress={() => onCardPress(p.key)}
                  android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
                >
                  <View style={[styles.patternBar, { backgroundColor: p.color }]} />
                  <View style={[styles.patternDot, { backgroundColor: p.color, shadowColor: p.color }]} />
                  <Text style={styles.patternName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.patternTech} numberOfLines={1}>{p.tech}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <LinearGradient
            colors={['transparent', Brand.bg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.patternsFade}
            pointerEvents="none"
          />
          {/* Swipe-hint badge in de rechterhoek van de pattern-row */}
          <View style={styles.swipeHint} pointerEvents="none">
            <Text style={styles.swipeHintTxt}>SWIPE</Text>
            <Text style={styles.swipeHintArrow}>→</Text>
          </View>
        </View>

        {/* ── Switch-confirm banner ── verschijnt wanneer user mid-sessie
            op een andere pattern-card tapt. Iter 9dq v161 (operator 2026-
            06-18). */}
        {pendingSwitchKey && (() => {
          const pendingPattern = PATTERNS.find(
            (pp) => pp.key === pendingSwitchKey,
          );
          if (!pendingPattern) return null;
          return (
            <View
              style={[
                styles.switchBanner,
                { borderColor: pendingPattern.color },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.switchBannerEyebrow}>
                  CURRENTLY IN {current.name.toUpperCase()}
                </Text>
                <Text style={styles.switchBannerTitle}>
                  Switch to {pendingPattern.name}?
                </Text>
              </View>
              <Pressable
                onPress={() => setPendingSwitchKey(null)}
                style={styles.switchBannerCancel}
                hitSlop={8}
                accessibilityLabel="Cancel switch"
              >
                <Text style={styles.switchBannerCancelTxt}>✕</Text>
              </Pressable>
              <Pressable
                onPress={onConfirmSwitch}
                style={[
                  styles.switchBannerCta,
                  { backgroundColor: pendingPattern.color },
                ]}
                android_ripple={{ color: 'rgba(0,0,0,0.10)' }}
                accessibilityLabel="Stop current and switch"
              >
                <Text style={styles.switchBannerCtaTxt}>STOP &amp; SWITCH</Text>
              </Pressable>
            </View>
          );
        })()}

        {/* ── Details + History — outlined pill buttons (iter 9dq v161) ──
            Voorheen platte text-links die er onaf uitzagen. Nu twee
            compact-pill knoppen met icoon + label. Details-knop toont
            dynamisch welk protocol je opent (was "Read protocol details"
            = vaag). */}
        <View style={styles.linksRow}>
          <Pressable
            onPress={onOpenModal}
            style={styles.linkPill}
            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
            hitSlop={6}
            accessibilityLabel={`Read protocol details for ${current.name}`}
          >
            <Text style={[styles.linkPillIcon, { color: current.color }]}>ⓘ</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.linkPillLabel} numberOfLines={1}>
                Details
              </Text>
              <Text style={styles.linkPillSub} numberOfLines={1}>
                {current.name}
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push('/breath-history')}
            style={styles.linkPill}
            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
            hitSlop={6}
            accessibilityLabel="View your breath history"
          >
            <Text style={[styles.linkPillIcon, { color: Brand.accent }]}>⟳</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.linkPillLabel} numberOfLines={1}>
                History
              </Text>
              <Text style={styles.linkPillSub} numberOfLines={1}>
                {history.length > 0
                  ? `${history.length} session${history.length === 1 ? '' : 's'}`
                  : 'No sessions yet'}
              </Text>
            </View>
          </Pressable>
        </View>


        {/* ── Visualizer ── */}
        <View style={styles.viz}>
          <Animated.View
            style={[
              styles.halo,
              { backgroundColor: current.colorSoft, transform: [{ scale: haloAnim }] },
            ]}
          />
          <Animated.View
            style={[
              styles.circle,
              {
                borderColor: current.color,
                shadowColor: current.color,
                transform: [{ scale: scaleAnim }],
              },
              (phase === 'hold-in' || phase === 'hold-out') && {
                borderColor: 'rgba(255,255,255,0.55)',
              },
            ]}
          >
            <View style={styles.phaseWrap}>
              <Text style={styles.phaseLabel}>{phaseLabel}</Text>
              {phase !== 'idle' && (
                <>
                  {phaseVia.length > 0 && <Text style={styles.phaseVia}>{phaseVia}</Text>}
                  <Text style={styles.phaseSec}>{secsLeft}s</Text>
                </>
              )}
            </View>
          </Animated.View>
        </View>

        {/* ── Pattern info + duur/countdown ── */}
        <Text style={styles.info}>
          <Text style={styles.infoStrong}>{current.name}</Text>
          <Text> · {current.tech} · </Text>
          <Text style={[styles.infoStrong, { color: running ? current.color : Brand.text }]}>
            {durationDisplay}
          </Text>
        </Text>

        {/* ── Round counter ── */}
        <View style={styles.counterRow}>
          <Text style={styles.counterTxt}>Round</Text>
          <Text
            style={[
              styles.counterTxt, styles.counterNum,
              { color: current.color === '#FFFFFF' ? Brand.text : current.color },
            ]}
          >
            {roundNum}
          </Text>
          <Text style={styles.counterTxt}>/ {current.rounds}</Text>
        </View>

        {/* ── Controls — VIBE · START · VOICE (iter 9dq v181, operator-
            fix 2026-06-18). START/STOP staat nu centraal tussen de twee
            toggles voor symmetrie en primaire-actie-prominence. */}
        <View style={styles.controls}>
          <Pressable
            style={[styles.soundBtn, !vibeOn && { opacity: 0.6 }]}
            onPress={toggleVibe}
            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
            accessibilityLabel={`Vibration ${vibeOn ? 'on' : 'off'}`}
          >
            {vibeOn ? (
              <Vibrate size={14} color={Brand.text} strokeWidth={2.2} />
            ) : (
              <VibrateOff size={14} color={Brand.textDim} strokeWidth={2.2} />
            )}
            <Text style={styles.soundTxt}>{`VIBE ${vibeOn ? 'ON' : 'OFF'}`}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.startBtn,
              { backgroundColor: startBtnBg, borderColor: startBtnBorder },
            ]}
            onPress={running ? onStopPressed : startSession}
            android_ripple={{ color: 'rgba(0,0,0,0.10)' }}
          >
            <Text style={[styles.startBtnTxt, { color: startBtnFg }]}>
              {running ? 'STOP' : 'START'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.soundBtn, !voiceOn && { opacity: 0.6 }]}
            onPress={toggleVoice}
            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
            accessibilityLabel={`Voice guidance ${voiceOn ? 'on' : 'off'}`}
          >
            {voiceOn ? (
              <Volume2 size={14} color={Brand.text} strokeWidth={2.2} />
            ) : (
              <VolumeX size={14} color={Brand.textDim} strokeWidth={2.2} />
            )}
            <Text style={styles.soundTxt}>{`VOICE ${voiceOn ? 'ON' : 'OFF'}`}</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Info Modal — exact zelfde structuur als bracelet ModeDetailModal ── */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={onCloseModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={onCloseModal}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.modalHead}>
              <View
                style={[
                  styles.modalDot,
                  { backgroundColor: current.color, shadowColor: current.color },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalName}>{current.name}</Text>
                <Text style={styles.modalSub}>{current.tech}</Text>
              </View>
              <Pressable
                style={styles.modalClose}
                onPress={onCloseModal}
                hitSlop={10}
              >
                <Text style={styles.modalCloseTxt}>✕</Text>
              </Pressable>
            </View>

            {/* Intent — wat de gebruiker zoekt */}
            <Text style={styles.modalIntent}>{current.intent}</Text>

            {/* How this breath helps */}
            <Text style={styles.modalSectionLbl}>How this breath helps</Text>
            <Text style={styles.modalDesc}>{current.breathDoes}</Text>

            {/* Use this for — ideals checklist */}
            <Text style={styles.modalSectionLbl}>Use this for</Text>
            <View style={styles.modalIdeals}>
              {current.ideals.map((item, i) => (
                <View key={i} style={styles.modalIdealRow}>
                  <Text style={[styles.modalIdealCheck, { color: current.color }]}>
                    ✓
                  </Text>
                  <Text style={styles.modalIdealText}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Breath protocol */}
            <Text style={styles.modalSectionLbl}>The breath protocol</Text>
            <Text style={[styles.modalProtocol, { color: current.color }]}>
              {current.protocol}
            </Text>
            <Text style={styles.modalProtocolHint}>{current.protocolHow}</Text>

            {/* Tracking — informeer dat sessies automatisch worden opgeslagen.
                Klein, subtiel onderaan zodat het niet overschreeuwt, maar wel
                helder zichtbaar zodat user weet wat er gebeurt. */}
            <Text style={styles.modalSectionLbl}>Tracked automatically</Text>
            <Text style={styles.modalDesc}>
              Every session — completed or partial — is saved to Your Practice with streak, completion rate, and per-pattern stats.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Completion Modal — natural completion celebration ── */}
      <Modal
        visible={!!completion}
        transparent
        animationType="fade"
        onRequestClose={onDismissCompletion}
      >
        <Pressable style={styles.modalBackdrop} onPress={onDismissCompletion}>
          <Pressable
            style={styles.completionSheet}
            onPress={(e) => e.stopPropagation()}
          >
            {completion && (
              <>
                {/* Iter 9dq v170 (operator-fix 2026-06-18): dynamische/
                    moderne touches.
                    1. Accent-strip (5px ribbon) in pattern-kleur bovenaan
                       — geeft per protocol een unieke visuele identiteit.
                    2. Subtiele background-tint (LinearGradient van 8%
                       pattern-kleur → wit) ipv plat wit. Voelt diepvol
                       en modern, niet steriel.
                    Beide elementen absoluut gepositioneerd zodat ze de
                    layout van de bestaande content niet verstoren. */}
                <LinearGradient
                  colors={[
                    `${completion.pattern.color}14`, // ~8% opacity
                    `${completion.pattern.color}00`, // 0% (fade-out)
                  ]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.55 }}
                  style={styles.completionTint}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.completionAccentStrip,
                    { backgroundColor: completion.pattern.color },
                  ]}
                  pointerEvents="none"
                />
                {/* Iter 9dq v162 (operator-fix 2026-06-18): hoverende
                    meditator-silhouette ipv kleine pulsing dot. Voelt
                    actiever en past beter bij de meditatieve afsluiting.
                    🧘 emoji is placeholder — kan vervangen worden door
                    een custom CDN-silhouette (1 regel onder bij {emoji}). */}
                <View style={styles.silhouetteWrap}>
                  {/* Iter 9dq v164 (operator 2026-06-18): emoji vervangen
                      door custom Buddha-asset op Bunny CDN. Behoud van
                      hover-animatie via Animated.Image (zelfde transform-
                      pattern als emoji). */}
                  <Animated.Image
                    source={{
                      uri: 'https://vibezcore-audio.b-cdn.net/images/buddha%20.png',
                    }}
                    resizeMode="contain"
                    style={[
                      styles.silhouetteFigure,
                      {
                        transform: [
                          {
                            translateY: silhouetteHover.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -8],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </View>

                {/* Iter 9dq v168 (operator-fix 2026-06-18): visuele
                    hiërarchie omgegooid. Voorheen: kleine eyebrow + grote
                    pattern-name. Nu: prominent "Well done." als
                    congratulations-statement + kleinere "You completed X"
                    als context. Voelt warmer en celebratoir. */}
                <Text style={styles.completionEyebrow}>
                  ✦ CONGRATULATIONS ✦
                </Text>
                <Text style={styles.completionTitle}>Well done.</Text>
                <Text style={styles.completionSubtitle}>
                  You completed {completion.pattern.name}
                </Text>

                {/* Iter 9dq v172 (operator-fix 2026-06-18): streak-badge.
                    Toont een dynamisch "🔥 X-day streak"-label gebaseerd
                    op de bestaande breath-history. Geeft emotionele return
                    voor recurring users zonder dat we gamification-overdoen. */}
                {(() => {
                  const streak = calculateStreak(history);
                  if (streak < 1) return null;
                  return (
                    <View
                      style={[
                        styles.completionStreak,
                        {
                          borderColor: `${completion.pattern.color}55`,
                          backgroundColor: `${completion.pattern.color}10`,
                        },
                      ]}
                    >
                      <Text style={styles.completionStreakIcon}>🔥</Text>
                      <Text
                        style={[
                          styles.completionStreakTxt,
                          { color: completion.pattern.color },
                        ]}
                      >
                        {streak === 1
                          ? 'Day 1 — streak started'
                          : `${streak}-day streak`}
                      </Text>
                    </View>
                  );
                })()}
                {/* Iter 9dq v185 (operator-fix 2026-06-18): visuele copy
                    nu kort en neutraal. De motiverende monoloog komt
                    via voice-cue (playCompletionCue). Twee-regelige
                    geschreven copy concurreerde te veel met de gesproken
                    versie — gedropt. */}

                {/* Iter 9dq v170: stats nu als twee pill-cards naast elkaar
                    met subtle bg-tint + iconen ipv het oude divider-pattern.
                    Voelt moderner en geeft visueel gewicht aan de stats. */}
                <View style={styles.completionStatsRow}>
                  <View
                    style={[
                      styles.completionStatPill,
                      { borderColor: `${completion.pattern.color}40` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.completionStatIcon,
                        { color: completion.pattern.color },
                      ]}
                    >
                      ↻
                    </Text>
                    <View>
                      <Text style={styles.completionStatNum}>
                        {completion.rounds}
                      </Text>
                      <Text style={styles.completionStatLbl}>ROUNDS</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.completionStatPill,
                      { borderColor: `${completion.pattern.color}40` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.completionStatIcon,
                        { color: completion.pattern.color },
                      ]}
                    >
                      ◴
                    </Text>
                    <View>
                      <Text style={styles.completionStatNum}>
                        {formatMMSS(completion.durSec)}
                      </Text>
                      <Text style={styles.completionStatLbl}>DURATION</Text>
                    </View>
                  </View>
                </View>

                {/* Iter 9dq v169 (operator-fix 2026-06-18): DONE-knop
                    duidelijker als button maken. Voorheen kleine pill met
                    12.5px tekst → leek niet op een actie-element. Nu
                    full-width CTA met grotere tekst, ✓ icoon en duidelijke
                    "close" intent label "I'M DONE". */}
                <Pressable
                  style={[
                    styles.completionDone,
                    { backgroundColor: completion.pattern.color },
                  ]}
                  onPress={onDismissCompletion}
                  android_ripple={{ color: 'rgba(0,0,0,0.12)' }}
                  accessibilityRole="button"
                  accessibilityLabel="Close completion screen"
                >
                  <Text style={styles.completionDoneIcon}>✓</Text>
                  <Text style={styles.completionDoneTxt}>I'M DONE</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  /* v177: meer top-padding zodat de header niet op de status-bar / notch
     plakt. Operator-feedback: "bovenaan heel druk, alles op elkaar". */
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },

  /* Header */
  /* v177: meer marge onder de header voor visuele rust. */
  header: { alignItems: 'center', marginBottom: 22 },

  /* Iter 9dq v173: onboarding-card voor first-time users (geen history). */
  onboardingCard: {
    backgroundColor: 'rgba(58,143,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.18)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  onboardingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  onboardingStepBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingStepNum: {
    color: Brand.accent,
    fontFamily: BrandFonts.bold,
    fontSize: 12,
    lineHeight: 14,
  },
  onboardingStepTxt: {
    flex: 1,
    color: Brand.text,
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    letterSpacing: -0.1,
    lineHeight: 18,
  },
  title: {
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    lineHeight: 26,
    color: Brand.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  /* Pattern selector */
  /* v177: meer marge onder de pattern-carousel ervoor (en eronder voor de
     pill-buttons / visualizer). 6 was te krap. */
  patternsWrap: { position: 'relative', marginBottom: 14 },
  patternsScroll: { flexGrow: 0 },
  patternsRow: { paddingRight: 28, gap: 8 },
  patternsFade: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    width: 30,
  },
  patternCard: {
    width: 116,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  patternBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2.5, opacity: 0.85,
  },
  patternDot: {
    width: 8, height: 8, borderRadius: 4,
    marginTop: 2, marginBottom: 6,
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 5, elevation: 3,
  },
  patternName: {
    fontFamily: BrandFonts.bold,
    fontSize: 12, color: Brand.text,
    marginBottom: 2, textAlign: 'center',
  },
  patternTech: {
    fontFamily: BrandFonts.semibold,
    fontSize: 9.5, letterSpacing: 0.4,
    color: Brand.textDim, textAlign: 'center',
  },

  /* Iter 9dq v161: Details + History — outlined pills naast elkaar.
     Voorheen waren dit text-only links. */
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    marginTop: 4,
  },
  linkPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  linkPillIcon: {
    fontFamily: BrandFonts.bold,
    fontSize: 18,
    lineHeight: 20,
  },
  linkPillLabel: {
    fontFamily: BrandFonts.bold,
    fontSize: 12.5,
    letterSpacing: 0.4,
    color: Brand.text,
    marginBottom: 1,
  },
  linkPillSub: {
    fontFamily: BrandFonts.regular,
    fontSize: 10.5,
    color: Brand.textDim,
  },

  /* Iter 9dq v161: switch-confirm banner — mid-sessie pattern-switch. */
  switchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  switchBannerEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: Brand.textDim,
    marginBottom: 2,
  },
  switchBannerTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    color: Brand.text,
    letterSpacing: -0.1,
  },
  switchBannerCancel: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBannerCancelTxt: {
    color: Brand.textDim,
    fontSize: 16,
    fontFamily: BrandFonts.semibold,
  },
  switchBannerCta: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  switchBannerCtaTxt: {
    color: '#000',
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },

  /* Swipe-hint badge — float boven rechterhoek pattern row */
  swipeHint: {
    position: 'absolute',
    top: 6,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: Brand.accent,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 6,
  },
  swipeHintTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: '#000',
  },
  swipeHintArrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    color: '#000',
    marginTop: -1,
  },

  /* Modal eyebrow voor section-title boven naam */
  modalEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: Brand.accent,
    marginBottom: 4,
  },

  /* History row uitbreidingen */
  historyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  historyPartialTag: {
    fontFamily: BrandFonts.bold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: '#FF9F0A',
    backgroundColor: 'rgba(255,159,10,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },

  /* Visualizer */
  /* v179 (operator-fix 2026-06-18): halo botst tegen pills boven en
     tekst onder bij uitdeinen. Twee fixes:
     1. Halo + circle iets kleiner zodat de max-scaled halo binnen het
        reserved venster blijft.
     2. Viz minHeight verhoogd + extra vertical margin zodat het reserved
        venster echt ademruimte heeft voor de uitdeinende halo. */
  viz: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    marginVertical: 18, minHeight: 260,
  },
  halo: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    opacity: 0.55,
  },
  circle: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    /* GEEN shadow/elevation — die rendert op Android als hexagon/octagon
       bij circulaire elementen. Glow komt nu volledig van de halo. */
  },
  phaseWrap: { alignItems: 'center', justifyContent: 'center' },
  phaseLabel: {
    fontFamily: BrandFonts.bold,
    fontSize: 22, letterSpacing: -0.3,
    color: Brand.text, marginBottom: 4,
  },
  phaseVia: {
    fontFamily: BrandFonts.semibold,
    fontSize: 9.5, letterSpacing: 1.3,
    color: Brand.textDim, textTransform: 'uppercase',
    marginBottom: 3,
  },
  phaseSec: {
    fontFamily: BrandFonts.bold,
    fontSize: 11, letterSpacing: 1.3,
    color: Brand.textDim,
  },

  /* Pattern info onder visualizer */
  info: {
    fontFamily: BrandFonts.medium,
    fontSize: 12.5, color: Brand.textDim,
    textAlign: 'center', letterSpacing: 0.2,
    marginBottom: 6,
  },
  infoStrong: {
    fontFamily: BrandFonts.bold, color: Brand.text,
  },

  /* Counter */
  counterRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 5, marginBottom: 14,
  },
  counterTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11.5, color: Brand.textDim,
    letterSpacing: 0.5,
  },
  counterNum: { fontFamily: BrandFonts.bold, fontSize: 13 },

  /* Controls — v180 (operator-fix 2026-06-18): alle drie naast elkaar
     op één rij. START compact zodat 't past. */
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startBtn: {
    paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 999, borderWidth: 1,
  },
  startBtnTxt: {
    fontFamily: BrandFonts.bold, fontSize: 12.5, letterSpacing: 1.5,
  },
  soundBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: Brand.border,
    borderRadius: 999,
  },
  soundIcon: { fontSize: 14 },
  soundTxt: {
    fontFamily: BrandFonts.bold, fontSize: 11,
    letterSpacing: 1.2, color: Brand.textDim,
  },

  /* ── Modal — matched met bracelet ModeDetailModal structuur ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Brand.panel,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 20,
    padding: 22,
  },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 14,
  },
  modalDot: {
    width: 14, height: 14, borderRadius: 7,
    shadowOpacity: 0.85,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 9, elevation: 4,
  },
  modalName: {
    fontFamily: BrandFonts.bold,
    fontSize: 22, color: Brand.text,
    letterSpacing: -0.3,
  },
  modalSub: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11, letterSpacing: 0.6,
    color: Brand.textDim,
    marginTop: 2,
  },
  modalClose: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
  },
  modalCloseTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 14, color: Brand.textDim,
  },
  modalIntent: {
    fontFamily: BrandFonts.semibold,
    fontSize: 14.5, lineHeight: 20,
    color: Brand.text,
    marginBottom: 18,
  },
  modalSectionLbl: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5, letterSpacing: 1.6,
    color: Brand.accent,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modalDesc: {
    fontFamily: BrandFonts.regular,
    fontSize: 13, lineHeight: 19,
    color: Brand.textDim,
    marginBottom: 16,
  },
  modalIdeals: { marginBottom: 16 },
  modalIdealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  modalIdealCheck: {
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    width: 14,
  },
  modalIdealText: {
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    color: Brand.text,
  },
  modalProtocol: {
    fontFamily: BrandFonts.bold,
    fontSize: 14,
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  modalProtocolHint: {
    fontFamily: BrandFonts.regular,
    fontSize: 12.5, lineHeight: 18,
    color: Brand.textDim,
  },

  /* ── Completion Modal ── */
  /* Iter 9dq v166+v168+v170: white card met dynamische touches:
     overflow:hidden klipt de accent-strip + background-tint binnen
     de border-radius. */
  completionSheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderWidth: 0,
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.40,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 40,
    elevation: 18,
  },
  /* v170: accent-strip ribbon bovenaan, gevuld met pattern-kleur. */
  completionAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
  },
  /* v170: subtiele background-tint die afzakt naar wit. */
  completionTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  completionDotWrap: {
    width: 64, height: 64,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  completionDot: {
    width: 24, height: 24, borderRadius: 12,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 22, elevation: 14,
  },
  /* Iter 9dq v162+v165+v171: meer ademruimte onder de Buddha zodat het
     bovenste blok niet ingedrukt voelt. */
  silhouetteWrap: {
    width: 200,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    position: 'relative',
  },
  silhouetteFigure: {
    width: 170,
    height: 170,
  },
  /* v168+v171: meer marges tussen eyebrow → title → subtitle voor
     "luchtigere" verticale ritme in het bovenste blok. */
  completionEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: Brand.accent,
    marginBottom: 16,
  },
  completionTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 32,
    letterSpacing: -0.6,
    color: '#0a0a0a',
    marginBottom: 10,
    textAlign: 'center',
  },
  completionSubtitle: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 0.2,
    color: 'rgba(0,0,0,0.45)',
    marginBottom: 18,
    textAlign: 'center',
  },
  /* v172: streak-badge — outlined pill in pattern-kleur. */
  completionStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 24,
  },
  completionStreakIcon: {
    fontSize: 14,
    lineHeight: 16,
  },
  completionStreakTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  completionMsg: {
    fontFamily: BrandFonts.medium,
    fontSize: 14, lineHeight: 20,
    color: 'rgba(0,0,0,0.55)',
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  /* v167+v171: meer marges voor luchtigere ritme. */
  completionMsgPrimary: {
    fontFamily: BrandFonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: '#0a0a0a',
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 8,
    letterSpacing: -0.2,
  },
  completionMsgSecondary: {
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.55)',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  /* v170: stats nu als twee pill-cards. */
  completionStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: 24,
  },
  completionStatPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.025)',
  },
  completionStatIcon: {
    fontSize: 22,
    fontFamily: BrandFonts.bold,
    lineHeight: 24,
  },
  completionStatNum: {
    fontFamily: BrandFonts.bold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: '#0a0a0a',
    marginBottom: 1,
  },
  completionStatLbl: {
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: 'rgba(0,0,0,0.50)',
  },
  /* Iter 9dq v169: full-width CTA-knop met sterker contrast + ✓ icoon.
     Voorheen smal pill met klein tekst → leek niet op een knop. */
  completionDone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'stretch',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  completionDoneIcon: {
    color: '#000',
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    lineHeight: 18,
  },
  completionDoneTxt: {
    color: '#000',
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    letterSpacing: 1.2,
  },

  /* ── History Modal ── */
  historyList: {
    maxHeight: 420,
  },
  historyEmpty: {
    fontFamily: BrandFonts.regular,
    fontSize: 13.5,
    color: Brand.textDim,
    textAlign: 'center',
    paddingVertical: 24,
    lineHeight: 20,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  historyDot: {
    width: 10, height: 10, borderRadius: 5,
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6, elevation: 3,
  },
  historyName: {
    fontFamily: BrandFonts.bold,
    fontSize: 14,
    color: Brand.text,
    marginBottom: 2,
  },
  historyMeta: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    color: Brand.textDim,
    letterSpacing: 0.3,
  },
});
