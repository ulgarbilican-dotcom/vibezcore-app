/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Eerste gratis sessie (volledige Calm Control)

   Gepushed vanuit breath-welcome.tsx (slide 4, gast-flow). Draait de VOLLEDIGE
   Calm Control (box breath 4-4-4-4, 19 rondes = 5:04).

   Operator-besluit 2026-07-30: de proefsessie moet de ECHTE ervaring
   tonen, niet een uitgeklede versie. Daarom:
     - Zelfde cirkel-met-halo visualizer als (tabs)/breath.tsx
     - Alle vijf begeleidingsmodi zichtbaar en bedienbaar
     - Bracelet-modus zichtbaar maar VERGRENDELD (slotje). Tap toont één
       regel uitleg. Bewust geen opdringerige upsell — de zichtbaarheid
       alleen maakt al nieuwsgierig.

   Begeleidingsmodi (drie onafhankelijke kanalen onder de motorkap):
     Silent   — alleen beeld
     Haptic   — beeld + telefoon-trilling
     Voice    — beeld + gesproken cues
     Full     — beeld + trilling + stem
     Bracelet — beeld + bracelet-haptiek (vergrendeld zonder bracelet)

   Na afloop: soft-paywall met "Continue with Premium" of "Not yet".
   ───────────────────────────────────────────────────────────────────────── */

import GuidanceSelector, {
  GUIDANCE_MODES,
  type GuidanceMode,
} from '@/components/GuidanceSelector';
import { BREATH_STATES } from '@/data/breath-states';
import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';
import {
  claimVoiceSource,
  playBreathCue,
  releaseVoiceSource,
  setVoiceEnabled,
  stopVoice,
} from '@/services/breath-voice';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReanimatedView, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = ReanimatedView.createAnimatedComponent(Pressable);

const SCREEN_W = Dimensions.get('window').width;

/* Calm Control — box breath 4-4-4-4, 19 rondes = 304 sec (5:04).
   Operator 2026-07-30: geen uitgekleed proefje maar de VOLLEDIGE sessie.
   Operator, 28 september 2026 ("alle breathwork moet kloppen" — audit na
   fouten op de website): deze 5 getallen stonden hier als losse,
   hertypte constanten, zonder link naar breath-states.ts — vandaag nog
   toevallig correct, maar bij een volgende retuning van Calm's Box
   Breathing in de bron zou dit scherm stilzwijgend stale worden, exact
   dezelfde fout als op de website. Nu rechtstreeks afgeleid uit de echte
   `box`-techniek, geen eigen kopie meer. */
const CALM_BOX = BREATH_STATES.calm.techniques.find((t) => t.key === 'box')!;
const CALM_BOX_DURATIONS = CALM_BOX.durations ?? BREATH_STATES.calm.durations;
const CALM_BOX_DURATION =
  CALM_BOX_DURATIONS.find((d) => d.recommended) ?? CALM_BOX_DURATIONS[0];
const INHALE_S = CALM_BOX.phases[0].secs;
const HOLD_IN_S = CALM_BOX.phases[1].secs;
const EXHALE_S = CALM_BOX.phases[2].secs;
const HOLD_OUT_S = CALM_BOX.phases[3].secs;
const ROUNDS = CALM_BOX_DURATION.rounds;

type Phase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

const PHASE_LABEL: Record<Phase, string> = {
  'inhale': 'Inhale',
  'hold-in': 'Hold',
  'exhale': 'Exhale',
  'hold-out': 'Hold',
};


/* Trillingsduur per fase — 1:1 met (tabs)/breath.tsx. */
const VIB_INHALE = 60;
const VIB_HOLD = 30;
const VIB_EXHALE = 80;

/* Visualizer-schalen — LETTERLIJK overgenomen uit (tabs)/breath.tsx zodat
   de proefsessie exact dezelfde animatie toont als de echte Breath-tab.
   Niet aanpassen zonder breath.tsx mee te wijzigen. */
const CIRCLE_MIN = 0.55;
const CIRCLE_MAX = 1.0;
const HALO_MIN = 0.50;
const HALO_MAX = 1.15;

/* CALM CONTROL, in de kleur die de modus overal draagt: het violet uit
   BREATH_STATES.calm. Stond hier op het blauw van de bracelet-modus met
   dezelfde naam — twee producten, twee tabellen, en die van de bracelet
   hoort niet in een ademsessie. */
const CALM_COLOR = '#B478FF';
const CALM_COLOR_SOFT = 'rgba(180,120,255,0.30)';

/* Modi-definities leven in GuidanceSelector zodat de Breath-tab straks
   exact dezelfde set gebruikt (één bron van waarheid). */
type ModeKey = GuidanceMode;
const MODES = GUIDANCE_MODES;

export default function BreathSampleScreen() {
  const sub = useSubscription();
  const isPro = sub.isPro || sub.hasBracelet;

  const [mode, setMode] = useState<ModeKey>('both');
  const [lockNote, setLockNote] = useState(false);

  const [phase, setPhase] = useState<Phase>('inhale');
  const [round, setRound] = useState(1);
  const [secsLeft, setSecsLeft] = useState(INHALE_S);
  const [finished, setFinished] = useState(false);

  /* Actieve modus in een ref zodat de fase-loop (die buiten React's render
     draait) altijd de laatste keuze leest, ook als de user mid-sessie
     switcht. */
  const modeRef = useRef<ModeKey>('both');
  useEffect(() => {
    modeRef.current = mode;
    const cfg = MODES.find((m) => m.key === mode)!;
    /* Voice-service globaal aan/uit zetten volgens de gekozen modus. */
    setVoiceEnabled(cfg.voice);
  }, [mode]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Visualizer — 1:1 met (tabs)/breath.tsx: cirkel schaalt van CIRCLE_MIN
     naar CIRCLE_MAX tijdens inhale, halo loopt parallel maar verder door.
     Zelfde easing-curve, zelfde useNativeDriver. */
  const scaleAnim = useRef(new Animated.Value(CIRCLE_MIN)).current;
  const haloAnim = useRef(new Animated.Value(HALO_MIN)).current;

  const runInhaleAnim = (secs: number) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: CIRCLE_MAX,
        duration: secs * 1000,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(haloAnim, {
        toValue: HALO_MAX,
        duration: secs * 1000,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const runExhaleAnim = (secs: number) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: CIRCLE_MIN,
        duration: secs * 1000,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(haloAnim, {
        toValue: HALO_MIN,
        duration: secs * 1000,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const clearAll = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
    Vibration.cancel();
    stopVoice();
  };

  /* Cue-helpers lezen de ACTUELE modus uit de ref. */
  const cueHaptic = (ms: number) => {
    const cfg = MODES.find((m) => m.key === modeRef.current)!;
    if (!cfg.haptic) return;
    /* Bracelet-routing komt hier zodra BREATH_PATTERN_START in de
       firmware zit. */
    try {
      Vibration.vibrate(ms);
    } catch {}
  };

  const cueVoice = (p: Phase) => {
    const cfg = MODES.find((m) => m.key === modeRef.current)!;
    if (!cfg.voice) return;
    /* Calm Control ademt in en uit door de neus (zie PATTERNS in breath.tsx). */
    playBreathCue(p, 'nose', 'calm', 'breath');
  };

  const runPhase = (p: Phase, r: number) => {
    setPhase(p);

    if (p === 'inhale') {
      cueHaptic(VIB_INHALE);
      cueVoice('inhale');
      runInhaleAnim(INHALE_S);
      startCountdown(INHALE_S, () => runPhase('hold-in', r));
    } else if (p === 'hold-in') {
      cueHaptic(VIB_HOLD);
      cueVoice('hold-in');
      startCountdown(HOLD_IN_S, () => runPhase('exhale', r));
    } else if (p === 'exhale') {
      cueHaptic(VIB_EXHALE);
      cueVoice('exhale');
      runExhaleAnim(EXHALE_S);
      startCountdown(EXHALE_S, () => runPhase('hold-out', r));
    } else {
      cueHaptic(VIB_HOLD);
      cueVoice('hold-out');
      startCountdown(HOLD_OUT_S, () => {
        const nextRound = r + 1;
        if (nextRound > ROUNDS) {
          finish();
        } else {
          setRound(nextRound);
          runPhase('inhale', nextRound);
        }
      });
    }
  };

  const startCountdown = (from: number, onDone: () => void) => {
    setSecsLeft(from);
    if (timerRef.current) clearInterval(timerRef.current);
    let remaining = from;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setSecsLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        /* setTimeout(0) zodat secsLeft=0 rendert vóór de fase wisselt —
           anders blijft "1" zichtbaar hangen bij de overgang. */
        phaseTimeoutRef.current = setTimeout(onDone, 0);
      }
    }, 1000);
  };

  const finish = () => {
    clearAll();
    setFinished(true);
  };

  const stopEarly = () => {
    clearAll();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  /* Autostart op mount. Claim de voice-source zodat een parallelle
     bracelet-sessie niet doorheen praat (patroon uit breath.tsx). */
  useEffect(() => {
    claimVoiceSource('breath');
    runPhase('inhale', 1);
    return () => {
      clearAll();
      releaseVoiceSource('breath');
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  /* Operator, 10 september 2026: "hoe weten wij of user audio of
     breathwork wil" — dit scherm is breathwork-context, dus meegeven
     zodat subscribe.tsx na aankoop naar breathwork kan terugsturen i.p.v.
     altijd naar de Audio Library-root. */
  const goSubscribe = () => router.replace('/subscribe?returnTo=breathwork' as never);
  const goBreathTab = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const stopPressScale = useSharedValue(1);
  const onStopPressIn = () => {
    stopPressScale.value = withTiming(0.92, { duration: 80 });
  };
  const onStopPressOut = () => {
    stopPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const stopPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: stopPressScale.value }],
  }));

  /* Enter Breath / Continue with Premium delen één waarde — nooit
     tegelijk zichtbaar (isPro-branch is of/of). */
  const modalPrimaryPressScale = useSharedValue(1);
  const onModalPrimaryPressIn = () => {
    modalPrimaryPressScale.value = withTiming(0.96, { duration: 80 });
  };
  const onModalPrimaryPressOut = () => {
    modalPrimaryPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const modalPrimaryPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalPrimaryPressScale.value }],
  }));

  const modalSecondaryPressScale = useSharedValue(1);
  const onModalSecondaryPressIn = () => {
    modalSecondaryPressScale.value = withTiming(0.94, { duration: 80 });
  };
  const onModalSecondaryPressOut = () => {
    modalSecondaryPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const modalSecondaryPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalSecondaryPressScale.value }],
  }));

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.topbar}>
        <Text style={s.topbarTitle}>Calm Control · 5:04</Text>
        {!finished && (
          <AnimatedPressable
            onPress={stopEarly}
            onPressIn={onStopPressIn}
            onPressOut={onStopPressOut}
            hitSlop={14}
            style={[s.stopWrap, stopPressStyle]}
          >
            <Text style={s.stopTxt}>Stop</Text>
          </AnimatedPressable>
        )}
      </View>

      {/* ── Achtergrond-lichtbron (operator-vraag 2026-07-30). Één grote
         zachte gloed achter de hele sessie zodat het scherm niet plat
         zwart is. Ademt mee met de cirkel via dezelfde haloAnim, maar veel
         subtieler en veel groter — het is sfeer, geen tweede visualizer.
         Ligt absoluut achter alles en vangt geen taps. ── */}
      <Animated.View
        style={[
          s.roomLight,
          { transform: [{ scale: haloAnim }] },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            'rgba(10,132,255,0.20)',
            'rgba(10,132,255,0.07)',
            'rgba(10,132,255,0)',
          ]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 1 }}
          style={s.roomLightFill}
        />
      </Animated.View>

      {/* ── Visualizer — identiek aan (tabs)/breath.tsx: halo achter,
         cirkel met gekleurde rand ervoor, fase-tekst in het midden. Bij
         de holds wordt de rand wit, net als in de Breath-tab. ── */}
      <View style={s.viz}>
        <Animated.View
          style={[
            s.halo,
            {
              backgroundColor: CALM_COLOR_SOFT,
              transform: [{ scale: haloAnim }],
            },
          ]}
        />
        <Animated.View
          style={[
            s.circle,
            {
              borderColor: CALM_COLOR,
              transform: [{ scale: scaleAnim }],
            },
            (phase === 'hold-in' || phase === 'hold-out') && {
              borderColor: 'rgba(255,255,255,0.55)',
            },
          ]}
        >
          <View style={s.phaseWrap}>
            <Text style={s.phaseLabel}>{PHASE_LABEL[phase]}</Text>
            <Text style={s.phaseSec}>{secsLeft}s</Text>
          </View>
        </Animated.View>
      </View>

      <View style={s.counterRow}>
        <Text style={s.counterTxt}>Round</Text>
        <Text style={[s.counterTxt, s.counterNum, { color: CALM_COLOR }]}>
          {round}
        </Text>
        <Text style={s.counterTxt}>/ {ROUNDS}</Text>
      </View>

      {/* ── Begeleidingsmodi — glass segmented control met morphende
         selectie-indicator. Bracelet zichtbaar maar vergrendeld zonder
         hardware. ── */}
      <View style={s.modesWrap}>
        <GuidanceSelector
          value={mode}
          onChange={setMode}
          onBraceletPress={() => setLockNote(true)}
          showBracelet={false}
        />
        {lockNote && (
          <Text style={s.lockNote}>
            Bracelet guidance moves the rhythm to your wrist — silent and
            hands-free.
          </Text>
        )}
      </View>

      <Modal visible={finished} transparent animationType="fade">
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalEyebrow}>SESSION COMPLETE</Text>
            <Text style={s.modalTitle}>{isPro ? 'Nice.' : 'Loved it?'}</Text>
            <Text style={s.modalBody}>
              {/* Operator, 1 okt 2026: "49" was fout — correct: 64 (15
                 technieken × hun benoemde duur-varianten). */}
              {isPro
                ? 'That was a taste. All 64 guided sessions and bracelet guidance are already unlocked in your account.'
                : 'That was a taste. Continue with VIBEZCORE Premium to unlock all 64 guided sessions and the complete audio library.'}
            </Text>

            {isPro ? (
              <AnimatedPressable
                style={[s.modalPrimary, modalPrimaryPressStyle]}
                onPress={goBreathTab}
                onPressIn={onModalPrimaryPressIn}
                onPressOut={onModalPrimaryPressOut}
                android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
              >
                <Text style={s.modalPrimaryTxt}>Enter Breath  →</Text>
              </AnimatedPressable>
            ) : (
              <>
                <AnimatedPressable
                  style={[s.modalPrimary, modalPrimaryPressStyle]}
                  onPress={goSubscribe}
                  onPressIn={onModalPrimaryPressIn}
                  onPressOut={onModalPrimaryPressOut}
                  android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
                >
                  <Text style={s.modalPrimaryTxt}>Continue with Premium</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={[s.modalSecondary, modalSecondaryPressStyle]}
                  onPress={goBreathTab}
                  onPressIn={onModalSecondaryPressIn}
                  onPressOut={onModalSecondaryPressOut}
                  hitSlop={8}
                >
                  <Text style={s.modalSecondaryTxt}>Not yet</Text>
                </AnimatedPressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
  },
  topbarTitle: {
    flex: 1,
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  stopWrap: { paddingVertical: 6, paddingHorizontal: 8 },
  stopTxt: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 15,
  },

  /* Achtergrond-lichtbron: groot, zacht, absoluut gepositioneerd achter
     de hele sessie. Breedte > scherm zodat de randen buiten beeld
     vervagen en er nergens een cirkelrand zichtbaar is. */
  roomLight: {
    position: 'absolute',
    alignSelf: 'center',
    top: '12%',
    width: SCREEN_W * 1.6,
    height: SCREEN_W * 1.6,
    borderRadius: SCREEN_W * 0.8,
    overflow: 'hidden',
  },
  roomLightFill: { flex: 1 },

  /* ── Visualizer — waarden 1:1 uit (tabs)/breath.tsx. Bewust GEEN
     shadow/elevation op de cirkel: dat rendert op Android als octagon
     bij ronde elementen (dat was de hoekige vorm in de eerdere versie).
     De gloed komt volledig van de halo. ── */
  viz: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    minHeight: 260,
  },
  halo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.55,
  },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseWrap: { alignItems: 'center', justifyContent: 'center' },
  phaseLabel: {
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: Brand.text,
    marginBottom: 4,
  },
  phaseSec: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.3,
    color: Brand.textDim,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  counterTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    color: Brand.textDim,
  },
  counterNum: {
    fontFamily: BrandFonts.bold,
    fontSize: 15,
  },

  /* Modi-balk */
  modesWrap: {
    paddingBottom: 18,
    gap: 10,
  },
  lockNote: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Brand.panel,
    borderRadius: 20,
    padding: 26,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 12,
  },
  /* Huisstijl v4.4: Brand.accent (#3a8fff, Signal Blue) is enkel voor
     haptic-pulse/"nu actief" — nooit tekst/knoppen. AudioAccent is
     de eyebrow-kleur op donker. */
  modalEyebrow: {
    color: AudioAccent,
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  modalTitle: {
    color: Brand.text,
    fontFamily: BrandFonts.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  modalBody: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  /* v4.4 CTA-regel: donkere ondergrond -> witte knop, donkere tekst
     (geen Signal Blue, geen Royal Indigo op knoppen). */
  modalPrimary: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalPrimaryTxt: {
    color: '#0a0a0a',
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  modalSecondary: { paddingVertical: 12, alignItems: 'center' },
  modalSecondaryTxt: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 14,
  },
});
