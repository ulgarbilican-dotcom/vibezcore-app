/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Sound timing (31 okt 2026, operator: "ja" — per Bluetooth-
   toestel het hartslaggeluid gelijk zetten met de trilling).

   Eén stap (operator: "moet gebruiker dat zelf doen?" → enkel meetikken):
     · uitleg + Start → meetikken op de proefslag (70 bpm, enkel geluid — een
       trilling zou het tikken sturen), via exact dezelfde weg als een
       sessie; na 10 tikken (de eerste 2 tellen niet) zet de mediaan + de
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
import { BrandFonts, CTA } from '@/constants/theme';
import { isStateRhythmPlaying } from '@/services/bracelet-haptics';
import {
  TAPS_NEEDED,
  clampCorrection,
  estimateLateMs,
  setSoundCorrection,
  startCalibrationBeat,
  stopCalibrationBeat,
  type SoundOutput,
} from '@/services/sound-timing';
import { rootBlurRef } from '@/utils/root-blur';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 'intro' | 'tap' | 'retry' | 'done' | 'fine';
const NUDGE_MS = 10;

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
    setStep('fine');
    await startCalibrationBeat(true);
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
  };

  const nudge = (deltaMs: number) => {
    correction.current = clampCorrection(correction.current + deltaMs);
    setSoundCorrection(output.key, correction.current);
    saved.current = true;
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
              <Text style={st.heading}>Sound timing set</Text>
            </Reveal>
            <Reveal i={1}>
              <BalancedText style={[st.body, st.bodyCenter]}>
                The heartbeat now lands with every pulse on these headphones.
              </BalancedText>
            </Reveal>
            <Reveal i={2}>
              <Tap onPress={close} style={[CTA.container, st.cta]} accessibilityRole="button">
                <Text style={CTA.label}>Done</Text>
              </Tap>
            </Reveal>
            {fineTune ? (
              <Reveal i={3}>
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
              <Text style={st.heading}>Feel and listen</Text>
            </Reveal>
            <Reveal i={1}>
              <BalancedText style={st.body}>
                If the sound still comes before or after the pulse, move it until both land together.
              </BalancedText>
            </Reveal>
            <Reveal i={2}>
              <View style={st.nudgeRow}>
                <Tap onPress={() => nudge(NUDGE_MS)} style={[st.glassPill, st.flex]} accessibilityRole="button">
                  <Text style={st.glassPillTxt}>Earlier</Text>
                </Tap>
                <Tap onPress={() => nudge(-NUDGE_MS)} style={[st.glassPill, st.flex]} accessibilityRole="button">
                  <Text style={st.glassPillTxt}>Later</Text>
                </Tap>
              </View>
            </Reveal>
            <Reveal i={3}>
              <Tap onPress={close} style={[CTA.container, st.cta]} accessibilityRole="button">
                <Text style={CTA.label}>Done</Text>
              </Tap>
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
