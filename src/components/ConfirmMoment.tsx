/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — ConfirmMoment (punt 25)

   Operator, 19 okt 2026 ("een moment dat zegt: het is gelukt — kort,
   rustig, en de tweede keer dezelfde dag korter"): één herbruikbaar
   bevestigingsmoment, schermvullend in de donkere huisstijl.

     1. "thinking" (optioneel, ~1,1 s): een Bio-Teal boog draait rond met
        één korte statusregel die één keer wisselt (bv. "Building your
        plan…" → "Matching your rhythm…").
     2. "done": de ring tekent zich dicht in Bio-Teal, het vinkje springt
        erin (zelfde beeldtaal als AddToDayHero's viering: Check + spring),
        titel + optionele ondertitel, de ring "ademt" één keer.
        Tegelijk: Haptics Success + een zacht ping (services/confirm-ping —
        mengt met muziek, iOS stil bij de stille-schakelaar, nooit tijdens
        een sessie of audiobibliotheek).

   Max ~2,5 s, daarna vanzelf onDone; een tik waar ook = meteen onDone.
   Reduce motion → geen draaiende boog en geen ademhaling.
   `quick` slaat de thinking-fase over — showConfirmMoment() zet dat zelf
   als de lange versie vandaag al getoond is voor dezelfde soort.
   Aanroepen: showConfirmMoment({...}) — één ConfirmMomentHost in de
   root-layout toont het.

   Navigatie gebeurt ALTIJD in onDone, ná het sluiten van de Modal (iOS:
   pas na onDismiss), zodat een volgende route of blad niet botst met een
   Modal die nog aan het verdwijnen is. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Tap from '@/components/Tap';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import { playConfirmPing } from '@/services/confirm-ping';
import { getRestingPulse } from '@/services/resting-pulse';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING = 132;
const STROKE = 6;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;

const THINK_MS = 1100;
const LINE_SWITCH_MS = 550;
const RING_CLOSE_MS = 450;
const CHECK_AT_MS = 320;
const DONE_HOLD_MS = 1400;

export type ConfirmMomentKind = 'heart-rate' | 'breath-plan' | 'routine' | 'state-plan';

export type ConfirmMomentProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Statusregels van de thinking-fase (max 2; de tweede komt halverwege). */
  thinking?: [string] | [string, string];
  /** Thinking-fase overslaan (2de keer dezelfde dag, of enkel "done"). */
  quick?: boolean;
  onDone: () => void;
};

export default function ConfirmMoment({
  visible,
  title,
  subtitle,
  thinking,
  quick,
  onDone,
}: ConfirmMomentProps) {
  const reduced = useReducedMotion();
  const withThinking = !!thinking && !quick && !reduced;
  const [phase, setPhase] = useState<'thinking' | 'done'>(withThinking ? 'thinking' : 'done');
  const [line, setLine] = useState(0);
  const [shown, setShown] = useState(visible);
  const finished = useRef(false);
  const pendingDone = useRef<(() => void) | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const spin = useSharedValue(0);
  const close = useSharedValue(0);
  const checkScale = useSharedValue(0.4);
  const checkOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const breathe = useSharedValue(1);

  /* Sluiten: eerst de Modal weg, dan pas onDone (iOS na onDismiss). */
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const cb = () => onDoneRef.current();
    if (Platform.OS === 'ios') {
      pendingDone.current = cb;
      setShown(false);
      /* Vangnet als onDismiss niet komt. */
      setTimeout(() => {
        const p = pendingDone.current;
        pendingDone.current = null;
        p?.();
      }, 450);
    } else {
      setShown(false);
      cb();
    }
  }, []);

  const handleDismiss = useCallback(() => {
    const p = pendingDone.current;
    pendingDone.current = null;
    p?.();
  }, []);

  /* Nieuwe opening → alles terug naar het begin. */
  useEffect(() => {
    if (!visible) return;
    finished.current = false;
    pendingDone.current = null;
    setShown(true);
    setLine(0);
    setPhase(withThinking ? 'thinking' : 'done');
    spin.value = 0;
    close.value = 0;
    checkScale.value = 0.4;
    checkOpacity.value = 0;
    textOpacity.value = 0;
    breathe.value = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /* Thinking-fase: draaiende boog + één wissel van de statusregel. */
  useEffect(() => {
    if (!visible || !shown || phase !== 'thinking') return;
    spin.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    const t1 = thinking && thinking.length > 1 ? setTimeout(() => setLine(1), LINE_SWITCH_MS) : null;
    const t2 = setTimeout(() => setPhase('done'), THINK_MS);
    return () => {
      if (t1) clearTimeout(t1);
      clearTimeout(t2);
      cancelAnimation(spin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, shown, phase]);

  /* Done-fase: ring dicht, vinkje + feedback, één ademhaling, dan klaar. */
  useEffect(() => {
    if (!visible || !shown || phase !== 'done') return;
    cancelAnimation(spin);
    close.value = withTiming(1, {
      duration: reduced ? 0 : RING_CLOSE_MS,
      easing: Easing.out(Easing.cubic),
    });
    const checkAt = reduced ? 0 : CHECK_AT_MS;
    const tCheck = setTimeout(() => {
      checkOpacity.value = withTiming(1, { duration: 160 });
      checkScale.value = reduced ? 1 : withSpring(1, { damping: 7, stiffness: 140 });
      textOpacity.value = withTiming(1, { duration: 260 });
      if (!reduced) {
        breathe.value = withDelay(
          180,
          withSequence(
            withTiming(1.06, { duration: 380, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }),
          ),
        );
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      playConfirmPing();
    }, checkAt);
    const tDone = setTimeout(finish, DONE_HOLD_MS);
    return () => {
      clearTimeout(tCheck);
      clearTimeout(tDone);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, shown, phase]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const closeProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - close.value),
  }));
  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  const statusLine = thinking ? thinking[Math.min(line, thinking.length - 1)] : '';

  return (
    <Modal
      visible={visible && shown}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={finish}
      onDismiss={handleDismiss}
    >
      <Pressable
        style={styles.root}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        accessibilityHint="Tap to continue"
      >
        <Animated.View style={[styles.ringWrap, breatheStyle]}>
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={STROKE}
              fill="none"
            />
          </Svg>
          {phase === 'thinking' ? (
            <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
              <Svg width={RING} height={RING}>
                <Circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={R}
                  stroke={AudioAccent}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${C * 0.26}, ${C}`}
                  fill="none"
                />
              </Svg>
            </Animated.View>
          ) : (
            <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
              <AnimatedCircle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                stroke={AudioAccent}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${C}, ${C}`}
                animatedProps={closeProps}
                fill="none"
                rotation={-90}
                origin={`${RING / 2}, ${RING / 2}`}
              />
            </Svg>
          )}
          <Animated.View style={checkStyle}>
            <Check size={54} color="#ffffff" strokeWidth={3} />
          </Animated.View>
        </Animated.View>

        <View style={styles.textBlock}>
          {phase === 'thinking' ? (
            <Text style={styles.status} numberOfLines={1}>
              {statusLine}
            </Text>
          ) : (
            <Animated.View style={[styles.doneText, textStyle]}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              {!!subtitle && (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {subtitle}
                </Text>
              )}
            </Animated.View>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

/* ── "Korter de 2de keer dezelfde dag" ─────────────────────────────────── */

const STORE_KEY = 'vz_confirm_moment_v1';
let lastLong: Partial<Record<ConfirmMomentKind, string>> = {};
let loaded = false;
const loadPromise: Promise<void> = AsyncStorage.getItem(STORE_KEY)
  .then((raw) => {
    if (raw) lastLong = { ...JSON.parse(raw), ...lastLong };
  })
  .catch(() => {})
  .finally(() => {
    loaded = true;
  });

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Is de lange versie (met thinking) vandaag al getoond voor deze soort? */
export function isConfirmQuick(kind: ConfirmMomentKind): boolean {
  return lastLong[kind] === todayKey();
}

/** Onthoud dat de lange versie vandaag getoond is. */
export function markConfirmLongShown(kind: ConfirmMomentKind): void {
  lastLong = { ...lastLong, [kind]: todayKey() };
  const save = () => AsyncStorage.setItem(STORE_KEY, JSON.stringify(lastLong)).catch(() => {});
  if (loaded) void save();
  else void loadPromise.then(save);
}

export type ConfirmMomentRequest = {
  kind: ConfirmMomentKind;
  title: string;
  subtitle?: string;
  /** Zonder thinking-regels = enkel de done-fase. */
  thinking?: [string] | [string, string];
  onDone: () => void;
};

/* ── Host + oproep van overal ─────────────────────────────────────────────
   Eén host in de root-layout (naast VibezAlertHost): zo overleeft het
   moment het verdwijnen van het scherm dat het opriep (bv. de Resting
   Heart Rate-pagina verdwijnt vanzelf zodra de hartslag gekozen is, of
   een onboarding die zichzelf sluit). */

type ActiveRequest = ConfirmMomentRequest & { quick: boolean; id: number };
let current: ActiveRequest | null = null;
let nextId = 1;
const hostListeners = new Set<(r: ActiveRequest | null) => void>();
function emit(): void {
  hostListeners.forEach((l) => l(current));
}

/** Toon het bevestigingsmoment; navigatie hoort in `onDone`. Beslist zelf
 *  over `quick` (lange versie vandaag al getoond voor deze soort?). Staat
 *  er al een moment open, dan loopt dat eerst af (zijn onDone komt nog). */
export function showConfirmMoment(r: ConfirmMomentRequest): void {
  if (current) {
    const prev = current;
    current = null;
    emit();
    prev.onDone();
  }
  const quick = !!r.thinking && isConfirmQuick(r.kind);
  if (r.thinking && !quick) markConfirmLongShown(r.kind);
  current = { ...r, quick, id: nextId++ };
  if (hostListeners.size === 0) {
    /* Geen host (zou niet mogen) — nooit de flow blokkeren. */
    const cb = current.onDone;
    current = null;
    cb();
    return;
  }
  emit();
}

/** Staat er nu een bevestigingsmoment open? */
export function isConfirmMomentOpen(): boolean {
  return current !== null;
}

export function ConfirmMomentHost() {
  const [req, setReq] = useState<ActiveRequest | null>(current);
  useEffect(() => {
    hostListeners.add(setReq);
    setReq(current);
    return () => {
      hostListeners.delete(setReq);
    };
  }, []);
  if (!req) return null;
  return (
    <ConfirmMoment
      key={req.id}
      visible
      title={req.title}
      subtitle={req.subtitle}
      thinking={req.thinking}
      quick={req.quick}
      onDone={() => {
        if (current?.id !== req.id) return;
        const cb = req.onDone;
        current = null;
        emit();
        cb();
      }}
    />
  );
}

/** Hartslag gekozen → verder naar State Control (punt 25, plaats 1).
 *  Enkel de done-fase; de ondertitel volgt de bewaarde keuze. */
export function confirmRhythmSet(onDone: () => void): void {
  const p = getRestingPulse();
  showConfirmMoment({
    kind: 'heart-rate',
    title: 'All set!',
    subtitle: p.source === 'average' ? `Average rhythm: ${p.bpm} bpm` : `Your rhythm: ${p.bpm} bpm`,
    onDone,
  });
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    marginTop: 28,
    minHeight: 72,
    alignItems: 'center',
  },
  status: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  doneText: { alignItems: 'center' },
  title: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 26,
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
});
