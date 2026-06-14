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
import { addBreathSession, useBreathHistory } from '@/utils/breath-history';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Vibrate, VibrateOff } from 'lucide-react-native';
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
    inhaleVia: 'nose', exhaleVia: 'mouth',
    intent: 'Alert, energized — primed for high-output moments.',
    breathDoes:
      'Short even breaths through nose and mouth wake the system up and break through fatigue.',
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
   geen medical claims. Matched met COMPLETION_MESSAGES in
   bracelet-control.tsx voor consistentie tussen tabs. */
const COMPLETION_MESSAGES: Record<BreathPattern['key'], string> = {
  boost:   'You showed up. The edge is sharper.',
  focus:   'Focus done. The deep work counts.',
  calm:    'Stillness reclaimed. Carry it with you.',
  clarity: 'Insight earned. Trust what came up.',
  rest:    'Recovery accomplished. Your system thanks you.',
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
  const [roundNum, setRoundNum] = useState(0);
  const [secsLeft, setSecsLeft] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
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
  /* Scroll ref voor on-mount demo scroll (visuele hint dat horizontale
     scroll mogelijk is). */
  const patternsScrollRef = useRef<ScrollView | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);
  const roundRef = useRef(0);
  const vibeOnRef = useRef(true);

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

  const vibCue = useCallback((ms: number) => {
    if (!vibeOnRef.current) return;
    try { Vibration.vibrate(ms); } catch {}
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
        runInhaleAnim(p.inhale);
        startCountdown(p.inhale, () => {
          if (p.hold1 > 0) runPhase(p, 'hold-in');
          else runPhase(p, 'exhale');
        });
      } else if (ph === 'hold-in') {
        vibCue(VIB_HOLD);
        startCountdown(p.hold1, () => runPhase(p, 'exhale'));
      } else if (ph === 'exhale') {
        vibCue(VIB_EXHALE);
        runExhaleAnim(p.exhale);
        startCountdown(p.exhale, () => {
          if (p.hold2 > 0) runPhase(p, 'hold-out');
          else nextRound(p);
        });
      } else if (ph === 'hold-out') {
        vibCue(VIB_HOLD);
        startCountdown(p.hold2, () => nextRound(p));
      }
    },
    [clearTimers, runInhaleAnim, runExhaleAnim, startCountdown, vibCue],
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

  const startSession = useCallback(() => {
    runningRef.current = true;
    setRunning(true);
    roundRef.current = 1;
    setRoundNum(1);
    runPhase(current, 'inhale');
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
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: CIRCLE_MIN, duration: 500, useNativeDriver: true }),
      Animated.timing(haloAnim, { toValue: HALO_MIN, duration: 500, useNativeDriver: true }),
    ]).start();
    setPhase('idle');
    setSecsLeft(0);
    setRoundNum(0);
    roundRef.current = 0;
  }, [clearTimers, scaleAnim, haloAnim]);

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

  const onDismissCompletion = useCallback(() => {
    setCompletion(null);
  }, []);

  /* Card-tap: enkel selecteren, geen modal. Modal opent via "Read details". */
  const onCardPress = useCallback(
    (key: BreathPattern['key']) => {
      if (running) return;
      setCurrentKey(key);
    },
    [running],
  );

  const onOpenModal = useCallback(() => {
    if (running) return;
    setModalOpen(true);
  }, [running]);

  const onCloseModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const toggleVibe = useCallback(() => {
    setVibeOn((v) => !v);
  }, []);

  /* ── Render ──────────────────────────────────────────────────── */
  const phaseLabel =
    phase === 'inhale' ? 'Inhale'
    : phase === 'hold-in' || phase === 'hold-out' ? 'Hold'
    : phase === 'exhale' ? 'Exhale'
    : 'Ready';

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

        {/* ── Read details + History links — onder de cards ── */}
        <View style={styles.linksRow}>
          <Pressable
            onPress={onOpenModal}
            style={styles.linkBtn}
            android_ripple={{ color: 'rgba(255,255,255,0.05)' }}
            hitSlop={6}
          >
            <Text style={styles.linkTxt}>
              Read protocol details ›
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/breath-history')}
            style={styles.linkBtn}
            android_ripple={{ color: 'rgba(255,255,255,0.05)' }}
            hitSlop={6}
          >
            <Text style={styles.linkTxt}>
              Your Practice {history.length > 0 ? `(${history.length}) ` : ''}›
            </Text>
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

        {/* ── Controls (Start + Vibe toggle) ── */}
        <View style={styles.controls}>
          <Pressable
            style={[
              styles.startBtn,
              { backgroundColor: startBtnBg, borderColor: startBtnBorder },
            ]}
            onPress={running ? onStopPressed : startSession}
            android_ripple={{ color: 'rgba(0,0,0,0.10)' }}
          >
            <Text style={[styles.startBtnTxt, { color: startBtnFg }]}>
              {running ? 'STOP' : 'START SESSION'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.soundBtn, !vibeOn && { opacity: 0.6 }]}
            onPress={toggleVibe}
            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
          >
            {vibeOn ? (
              <Vibrate size={14} color={Brand.text} strokeWidth={2.2} />
            ) : (
              <VibrateOff size={14} color={Brand.textDim} strokeWidth={2.2} />
            )}
            <Text style={styles.soundTxt}>{`VIBE ${vibeOn ? 'ON' : 'OFF'}`}</Text>
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
            style={[
              styles.completionSheet,
              completion && { borderColor: completion.pattern.color },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {completion && (
              <>
                {/* Pulsing dot — glow + scale animatie */}
                <View style={styles.completionDotWrap}>
                  <Animated.View
                    style={[
                      styles.completionDot,
                      {
                        backgroundColor: completion.pattern.color,
                        shadowColor: completion.pattern.color,
                        transform: [{ scale: completionPulse }],
                      },
                    ]}
                  />
                </View>

                <Text style={styles.completionEyebrow}>SESSION COMPLETE</Text>
                <Text style={styles.completionTitle}>
                  {completion.pattern.name}
                </Text>
                <Text style={styles.completionMsg}>
                  {COMPLETION_MESSAGES[completion.pattern.key]}
                </Text>

                <View style={styles.completionStatsRow}>
                  <View style={styles.completionStatCol}>
                    <Text style={styles.completionStatNum}>
                      {completion.rounds}
                    </Text>
                    <Text style={styles.completionStatLbl}>ROUNDS</Text>
                  </View>
                  <View style={styles.completionStatDivider} />
                  <View style={styles.completionStatCol}>
                    <Text style={styles.completionStatNum}>
                      {formatMMSS(completion.durSec)}
                    </Text>
                    <Text style={styles.completionStatLbl}>DURATION</Text>
                  </View>
                </View>

                <Pressable
                  style={[
                    styles.completionDone,
                    { backgroundColor: completion.pattern.color },
                  ]}
                  onPress={onDismissCompletion}
                  android_ripple={{ color: 'rgba(0,0,0,0.10)' }}
                >
                  <Text style={[styles.completionDoneTxt, { color: '#000' }]}>
                    DONE
                  </Text>
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
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },

  /* Header */
  header: { alignItems: 'center', marginBottom: 14 },
  title: {
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    lineHeight: 26,
    color: Brand.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  /* Pattern selector */
  patternsWrap: { position: 'relative', marginBottom: 6 },
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

  /* Links onder de cards: Protocol details + Your Practice */
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    marginBottom: 4,
  },
  linkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11.5,
    letterSpacing: 0.8,
    color: Brand.accent,
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
  viz: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, minHeight: 220,
  },
  halo: {
    position: 'absolute',
    width: 260, height: 260, borderRadius: 130,
    opacity: 0.55,
  },
  circle: {
    width: 190, height: 190, borderRadius: 95,
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

  /* Controls */
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
  },
  startBtn: {
    paddingHorizontal: 32, paddingVertical: 14,
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
  completionSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Brand.panel,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
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
  completionEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: Brand.accent,
    marginBottom: 6,
  },
  completionTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 26,
    letterSpacing: -0.4,
    color: Brand.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  completionMsg: {
    fontFamily: BrandFonts.medium,
    fontSize: 14, lineHeight: 20,
    color: Brand.textDim,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  completionStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginBottom: 22,
  },
  completionStatCol: {
    alignItems: 'center',
  },
  completionStatNum: {
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: Brand.text,
    marginBottom: 2,
  },
  completionStatLbl: {
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: Brand.textDim,
  },
  completionStatDivider: {
    width: 1, height: 32,
    backgroundColor: Brand.border,
  },
  completionDone: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 999,
    minWidth: 180,
    alignItems: 'center',
  },
  completionDoneTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 12.5,
    letterSpacing: 1.5,
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
