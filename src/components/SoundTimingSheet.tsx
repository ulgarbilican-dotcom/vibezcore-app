/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Sound timing (31 okt 2026, operator: "ja" — per Bluetooth-
   toestel het hartslaggeluid gelijk zetten met de trilling).

   Eén stap (operator: "moet gebruiker dat zelf doen?" → enkel meetikken):
     · uitleg + Start → meetikken op de proefslag (70 bpm, enkel geluid — een
       trilling zou het tikken sturen), via exact dezelfde weg als een
       sessie; na 12 tikken (de eerste 4 tellen niet) zet de mediaan + de
       gemiddelde voorsprong van tikken de correctie → bewaard, klaar.
     · Fijnregelen (Earlier/Later per 10 ms, geluid + trilling samen) is
       optioneel en enkel te openen vanuit Audio & Haptics (`fineTune`),
       nooit in de eerste keer / de tip.
   Onderblad-protocol: Done rechtsboven. Nooit tijdens een spelend State
   Control-ritme (twee slagen door elkaar).
   Berekening en bronnen: docs/VIBEZCORE_SCIENCE_A_TOT_Z.md §3.11.
   ───────────────────────────────────────────────────────────────────────── */

import BalancedText from '@/components/BalancedText';
import { GlassSheet } from '@/components/GlassSheetHost';
import Reveal from '@/components/Reveal';
import Tap from '@/components/Tap';
import VibezGlass from '@/components/VibezGlass';
import { SPRING_SETTLE, isReduceMotion } from '@/constants/motion';
import { BrandFonts, CTA } from '@/constants/theme';
import { isStateRhythmPlaying } from '@/services/bracelet-haptics';
import {
  CALIBRATION_PERIOD_MS,
  TAPS_NEEDED,
  clampCorrection,
  estimateLateMs,
  setSoundCorrection,
  startCalibrationBeat,
  stopCalibrationBeat,
  type SoundOutput,
} from '@/services/sound-timing';
import { hapticTap } from '@/utils/haptics';
import { rootBlurRef } from '@/utils/root-blur';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 'intro' | 'tap' | 'retry' | 'done' | 'fine';
const NUDGE_MS = 10;
/* Fine-tune-schaal: het puntje staat in het midden bij de ingestelde waarde
   en schuift per tik; de rand = zoveel ms verschoven. */
const TRACK_RANGE_MS = 150;
const DOT = 14;

/** "20 ms earlier" / "20 ms later" / "In sync" (t.o.v. de ingestelde waarde). */
function fineLabel(deltaMs: number): string {
  if (deltaMs === 0) return 'In sync';
  return `${Math.abs(deltaMs)} ms ${deltaMs > 0 ? 'earlier' : 'later'}`;
}

export default function SoundTimingSheet({
  visible,
  output,
  fineTune = false,
  onClose,
}: {
  visible: boolean;
  output: SoundOutput;
  /** Vanuit Audio & Haptics: ook "Fine-tune" aanbieden. */
  fineTune?: boolean;
  /** `saved`: er is een correctie bewaard voor dit toestel. */
  onClose: (saved: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('intro');
  const [tapCount, setTapCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const taps = useRef<number[]>([]);
  const firstBeat = useRef(0);
  const correction = useRef(output.correctionMs);
  const saved = useRef(false);
  /* Fine-tune: verschuiving t.o.v. de waarde bij het openen (zichtbaar op de
     schaal), en het moment van slag 0 voor het meekloppende puntje. */
  const [fineDelta, setFineDelta] = useState(0);
  const [fineFirst, setFineFirst] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const dotX = useSharedValue(0);
  const dotScale = useSharedValue(1);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dotX.value }, { scale: dotScale.value }] }));

  /* Het puntje schuift met een veer naar de nieuwe waarde: Earlier = naar
     links (zelfde kant als de knop), Later = naar rechts. */
  useEffect(() => {
    const half = Math.max(0, (trackW - DOT) / 2);
    const k = Math.max(-1, Math.min(1, fineDelta / TRACK_RANGE_MS));
    const x = half - k * half;
    /* eerste plaatsing (net gemeten) zonder schuiven vanaf de linkerrand */
    dotX.value = isReduceMotion() || fineDelta === 0 ? x : withSpring(x, SPRING_SETTLE);
  }, [fineDelta, trackW, dotX]);

  /* Het puntje klopt zacht mee op elke slag (op het moment van de trilling),
     zodat het ritme ook zichtbaar is. */
  useEffect(() => {
    if (step !== 'fine' || fineFirst <= 0 || isReduceMotion()) return;
    const pulse = () => {
      dotScale.value = withSequence(withTiming(1.45, { duration: 90 }), withSpring(1, SPRING_SETTLE));
    };
    let interval: ReturnType<typeof setInterval> | null = null;
    const now = Date.now();
    const k = Math.max(0, Math.ceil((now - fineFirst) / CALIBRATION_PERIOD_MS));
    const first = setTimeout(() => {
      pulse();
      interval = setInterval(pulse, CALIBRATION_PERIOD_MS);
    }, Math.max(0, fineFirst + k * CALIBRATION_PERIOD_MS - now));
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, [step, fineFirst, dotScale]);

  /* Bij openen: vers beginnen; bij sluiten of weggaan: de proefslag stoppen. */
  useEffect(() => {
    if (!visible) return;
    setStep('intro');
    setTapCount(0);
    correction.current = output.correctionMs;
    saved.current = false;
    setBusy(isStateRhythmPlaying());
    return () => stopCalibrationBeat();
    /* enkel bij openen of een ander toestel — niet bij elke nieuwe correctie */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, output.key]);

  if (!visible) return null;

  const close = () => {
    stopCalibrationBeat();
    onClose(saved.current || output.calibrated);
  };

  const guardBusy = () => {
    const b = isStateRhythmPlaying();
    setBusy(b);
    return b;
  };

  const startTapping = async () => {
    if (guardBusy()) return;
    stopCalibrationBeat();
    taps.current = [];
    setTapCount(0);
    setStep('tap');
    firstBeat.current = await startCalibrationBeat(false);
  };

  const startFineTune = async () => {
    if (guardBusy()) return;
    stopCalibrationBeat();
    setFineDelta(0);
    setFineFirst(0);
    setStep('fine');
    setFineFirst(await startCalibrationBeat(true));
  };

  const onTap = () => {
    if (step !== 'tap' || firstBeat.current <= 0) return;
    const now = Date.now();
    /* Tikken vóór de eerste slag tellen niet. */
    if (now < firstBeat.current - 300) return;
    taps.current.push(now);
    const n = taps.current.length;
    setTapCount(n);
    if (n < TAPS_NEEDED) return;
    stopCalibrationBeat();
    const late = estimateLateMs(taps.current, firstBeat.current);
    if (late === null) {
      setStep('retry');
      return;
    }
    correction.current = clampCorrection(correction.current + late);
    setSoundCorrection(output.key, correction.current);
    saved.current = true;
    setStep('done');
    /* Operator, 31 okt 2026: aan het einde VRAGEN of het klopt — de slag
       loopt door met geluid + trilling, zodat je het meteen voelt en hoort. */
    void startCalibrationBeat(true);
  };

  const nudge = (deltaMs: number) => {
    hapticTap();
    const next = clampCorrection(correction.current + deltaMs);
    const moved = next - correction.current;
    if (moved === 0) return;
    correction.current = next;
    setSoundCorrection(output.key, next);
    saved.current = true;
    setFineDelta((d) => d + moved);
  };

  const already = output.calibrated && !saved.current;

  return (
    <GlassSheet visible={visible} onClose={close}>
      <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
        <VibezGlass
          radius={24}
          level="sheet"
          blurTarget={rootBlurRef}
          style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
        />
        <Tap onPress={close} hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }} accessibilityLabel="Close">
          <View style={st.grip} />
        </Tap>
        <View style={st.head}>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>Sound timing</Text>
            <Text style={st.device} numberOfLines={1}>
              {output.name}
            </Text>
          </View>
          <Tap onPress={close} hitSlop={12} accessibilityRole="button" style={st.doneTouch}>
            <Text style={st.done}>Done</Text>
          </Tap>
        </View>

        {step === 'intro' ? (
          <View key="intro">
            <Reveal i={0}>
              <BalancedText style={st.body}>
                {already
                  ? 'The sound timing is set for these headphones. Tap along again if the heartbeat and the pulse drift apart.'
                  : 'Bluetooth headphones play sound slightly late, and each pair is different. Tap along with the heartbeat for about ten seconds and every pulse and sound will land together.'}
              </BalancedText>
            </Reveal>
            {busy ? (
              <Reveal i={1}>
                <Text style={st.note}>Pause your session to set the sound timing</Text>
              </Reveal>
            ) : null}
            <Reveal i={2}>
              <Tap
                onPress={startTapping}
                disabled={busy}
                style={[CTA.container, st.cta, busy && CTA.disabled]}
                accessibilityRole="button"
              >
                <Text style={[CTA.label, busy && CTA.labelDisabled]}>{already ? 'Tap along again' : 'Start'}</Text>
              </Tap>
            </Reveal>
            {fineTune && already && !busy ? (
              <Reveal i={3}>
                <Tap onPress={startFineTune} style={[st.glassPill, st.cta]} accessibilityRole="button">
                  <Text style={st.glassPillTxt}>Fine-tune</Text>
                </Tap>
              </Reveal>
            ) : null}
          </View>
        ) : null}

        {step === 'tap' ? (
          <View key="tap" style={st.center}>
            <Reveal i={0}>
              <Text style={st.heading}>Tap with every beat you hear</Text>
            </Reveal>
            <Reveal i={1}>
              <Tap
                onPressIn={onTap}
                scaleTo={0.92}
                style={st.pad}
                accessibilityRole="button"
                accessibilityLabel="Tap with the beat"
              >
                <Text style={st.padTxt}>Tap</Text>
              </Tap>
            </Reveal>
            <Reveal i={2}>
              <View style={st.dots}>
                {Array.from({ length: TAPS_NEEDED }, (_, i) => (
                  <View key={i} style={[st.dot, i < tapCount && st.dotOn]} />
                ))}
              </View>
            </Reveal>
          </View>
        ) : null}

        {step === 'retry' ? (
          <View key="retry">
            <Reveal i={0}>
              <BalancedText style={st.body}>
                Those taps were a little uneven. Tap on the first, stronger sound of each heartbeat.
              </BalancedText>
            </Reveal>
            <Reveal i={1}>
              <Tap onPress={startTapping} style={[CTA.container, st.cta]} accessibilityRole="button">
                <Text style={CTA.label}>Try again</Text>
              </Tap>
            </Reveal>
          </View>
        ) : null}

        {step === 'done' ? (
          <View key="done">
            <Reveal i={0}>
              <Text style={st.heading}>Do the sound and the pulse land together?</Text>
            </Reveal>
            <Reveal i={1}>
              <BalancedText style={[st.body, st.bodyCenter]}>
                Listen and feel for a few beats.
              </BalancedText>
            </Reveal>
            <Reveal i={2}>
              <Tap onPress={close} style={[CTA.container, st.cta]} accessibilityRole="button">
                <Text style={CTA.label}>Yes, done</Text>
              </Tap>
            </Reveal>
            <Reveal i={3}>
              <Tap onPress={startTapping} style={[st.glassPill, st.cta]} accessibilityRole="button">
                <Text style={st.glassPillTxt}>Tap along again</Text>
              </Tap>
            </Reveal>
            {fineTune ? (
              <Reveal i={4}>
                <Tap onPress={startFineTune} hitSlop={10} accessibilityRole="button" style={st.linkTouch}>
                  <Text style={st.link}>Fine-tune</Text>
                </Tap>
              </Reveal>
            ) : null}
          </View>
        ) : null}

        {step === 'fine' ? (
          <View key="fine">
            <Reveal i={0}>
              <Text style={st.heading}>Fine-tune</Text>
            </Reveal>
            <Reveal i={1}>
              <BalancedText style={[st.body, st.bodyCenter]}>
                Sound after the pulse? Tap Earlier. Before the pulse? Tap Later.
              </BalancedText>
            </Reveal>
            <Reveal i={2}>
              <View style={st.scale}>
                <View style={st.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
                  <View style={st.trackLine} />
                  <View style={st.trackMid} />
                  <Animated.View style={[st.trackDot, dotStyle]} />
                </View>
                <Text style={st.scaleLabel} accessibilityLiveRegion="polite">
                  {fineLabel(fineDelta)}
                </Text>
              </View>
            </Reveal>
            <Reveal i={3}>
              <View style={st.nudgeRow}>
                <Tap onPress={() => nudge(NUDGE_MS)} style={[st.glassPill, st.flex]} accessibilityRole="button">
                  <Text style={st.glassPillTxt}>Earlier</Text>
                </Tap>
                <Tap onPress={() => nudge(-NUDGE_MS)} style={[st.glassPill, st.flex]} accessibilityRole="button">
                  <Text style={st.glassPillTxt}>Later</Text>
                </Tap>
              </View>
            </Reveal>
          </View>
        ) : null}
      </View>
    </GlassSheet>
  );
}

const st = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingTop: 10,
    paddingHorizontal: 26,
  },
  grip: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  title: { fontFamily: BrandFonts.bold, fontSize: 20, color: '#ffffff' },
  device: { fontFamily: BrandFonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  doneTouch: { minHeight: 48, minWidth: 48, paddingHorizontal: 8, marginRight: -8, justifyContent: 'center', alignItems: 'flex-end' },
  done: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff' },
  body: { fontFamily: BrandFonts.regular, fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.8)', marginBottom: 24 },
  bodyCenter: { textAlign: 'center' },
  note: { fontFamily: BrandFonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 14 },
  heading: { fontFamily: BrandFonts.semibold, fontSize: 17, color: '#ffffff', textAlign: 'center', marginBottom: 22 },
  cta: { marginTop: 4, marginBottom: 8 },
  center: { alignItems: 'center' },
  flex: { flex: 1 },
  pad: {
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  padTxt: { fontFamily: BrandFonts.semibold, fontSize: 17, color: '#ffffff' },
  dots: { flexDirection: 'row', gap: 8, marginTop: 26, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { backgroundColor: '#ffffff' },
  nudgeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  scale: { alignItems: 'center', marginBottom: 22 },
  track: { alignSelf: 'stretch', height: DOT, justifyContent: 'center' },
  trackLine: { position: 'absolute', left: DOT / 2, right: DOT / 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  trackMid: { position: 'absolute', left: '50%', marginLeft: -1, width: 2, height: 10, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  trackDot: { position: 'absolute', left: 0, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: '#ffffff' },
  scaleLabel: { fontFamily: BrandFonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 12 },
  glassPill: {
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  glassPillTxt: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff' },
  linkTouch: { alignSelf: 'center', paddingVertical: 14 },
  link: { fontFamily: BrandFonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.6)' },
});
