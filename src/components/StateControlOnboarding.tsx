/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control-onboarding

   Operator, 15 okt 2026: "voor State Control is het heel belangrijk dat
   gebruiker het principe echt begrijpt" — en: "die heartbeat is niet de
   kern, de onderzochte haptics wel. Start idd op uw eigen hartslag, dan
   ... uitleg".

   HERZIEN 15 okt 2026 (operator: "heel slecht en niet consistent met de
   app — kijk onboarding breathwork of protocol, headers staan links"):
   exact het protocol van breath-welcome.tsx — bovenbalk met Back / "STEP X
   OF N" + dunne voortgangslijn / Skip, kop LINKS (TypeScale.pageHeader +
   pageSubhead, geen punt), matglazen kaarten (`ModeCard`-recept: rand
   0.14→0.40, press 0.95 + spring, niet-gekozen kaart dimt naar 0.45), witte
   CTA (radius 14, padding 16, 17 pt). Geen eigen stijl verzonnen.

     1  DE KERN   Haptiek gebaseerd op onderzoek. Twee kaarten (Calm Control
                  / Boost): aantikken = de echte voorproef voelen
                  (playModePreviewHaptic, 30 s, zelfde curve als een
                  sessie); het icoon klopt op dezelfde slagklok.
     2  HOE       Het ritme sluit aan bij je eigen hartslag, glijdt naar het
                  tempo van de toestand en blijft daar — met jouw eigen
                  getallen (rhythmFor). ENKEL hier de hartslag-uitleg.

     3  START     (enkel als de rusthartslag nog niet gekozen is) — in
                  hetzelfde patroon, niet meer het losse scherm met
                  gecentreerde titel + tabbalk + Premium-knopje erover
                  (operator, 15 okt 2026, als bezoeker getest). Meten /
                  invullen opent het bestaande meetblad (RhythmSheet).

   Woordkeuze: Science A tot Z §6.
   ───────────────────────────────────────────────────────────────────────── */

import { HeartbeatScale } from '@/components/HapticPulseRings';
import { MODE_GLYPH_ICONS } from '@/components/ModeGlyph';
import RhythmSheet, { useRestingPulse } from '@/components/RhythmSheet';
import { Brand, BrandFonts, TypeScale } from '@/constants/theme';
import { BraceletMode, getModeMeta } from '@/services/ble-contract';
import {
  PREVIEW_MAX_SECONDS,
  playModePreviewHaptic,
  rhythmFor,
  stopModePreviewHaptic,
} from '@/services/bracelet-haptics';
import { isBraceletSessionMonitorActive } from '@/services/bracelet-session-monitor';
import { AVERAGE_RESTING_BPM, chooseAverageRestingPulse } from '@/services/resting-pulse';
import { hapticTap } from '@/utils/haptics';
import { BlurView } from 'expo-blur';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DEMO_MODES = [BraceletMode.Alpha, BraceletMode.Gamma] as const;
type DemoMode = (typeof DEMO_MODES)[number];

/* Wat je voelt, per kaart (welzijnstaal). */
const DEMO_FEEL: Record<DemoMode, string> = {
  [BraceletMode.Alpha]: 'Slower than your heart',
  [BraceletMode.Gamma]: 'Faster than your heart',
};

type Props = {
  /** Na het laatste scherm, of na Skip. */
  onDone: () => void;
  /** Back op stap 1 (bv. terug naar de foto-intro). */
  onBack?: () => void;
  /** Stap 3: de rusthartslag kiezen (enkel als dat nog niet gebeurde). */
  includeRestingHr?: boolean;
  /** Knoptekst op het laatste scherm. */
  finalLabel?: string;
};

type HrChoice = 'measure' | 'manual' | 'average';

export default function StateControlOnboarding({ onDone, onBack, includeRestingHr = false, finalLabel = 'Done' }: Props) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const totalSteps = includeRestingHr ? 3 : 2;
  const lastStep = totalSteps - 1;
  const [hrChoice, setHrChoice] = useState<HrChoice>('measure');
  const [sheet, setSheet] = useState<null | 'measure' | 'manual'>(null);

  /* De voorproef stopt altijd bij weggaan van stap 1 of de onboarding. */
  const [playing, setPlayingState] = useState<DemoMode | null>(null);
  const playingRef = useRef<DemoMode | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPlaying = useCallback((m: DemoMode | null) => {
    playingRef.current = m;
    setPlayingState(m);
  }, []);
  const stopDemo = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    if (playingRef.current !== null) stopModePreviewHaptic();
    setPlaying(null);
  }, [setPlaying]);
  useEffect(() => stopDemo, [stopDemo]);

  /* Een lopende sessie nooit onderbreken (intro opnieuw via Settings
     tijdens een sessie): dan enkel de uitleg, geen voorproef. */
  const busy = isBraceletSessionMonitorActive();
  const play = (m: DemoMode) => {
    hapticTap();
    if (busy) {
      setPlaying(m);
      return;
    }
    if (stopTimer.current) clearTimeout(stopTimer.current);
    playModePreviewHaptic(m);
    setPlaying(m);
    stopTimer.current = setTimeout(() => setPlaying(null), PREVIEW_MAX_SECONDS * 1000);
  };

  const goNext = () => {
    stopDemo();
    if (step < lastStep) {
      setStep((step + 1) as 0 | 1 | 2);
      return;
    }
    if (includeRestingHr) {
      if (hrChoice === 'average') {
        chooseAverageRestingPulse();
        onDone();
      } else {
        setSheet(hrChoice);
      }
      return;
    }
    onDone();
  };
  const goBack = useCallback(() => {
    stopDemo();
    if (step > 0) setStep((step - 1) as 0 | 1 | 2);
    else onBack?.();
  }, [step, onBack, stopDemo]);
  const skip = () => {
    stopDemo();
    onDone();
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) return false;
      if (step === 0 && !onBack) return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [step, onBack, goBack, sheet]);

  /* CTA-druk: zelfde recept als breath-welcome (0.96 in 80 ms, veer terug). */
  const ctaScale = useSharedValue(1);
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safeContent} edges={['top', 'bottom']}>
        <View style={s.topbar}>
          <View style={s.backWrap}>
            {(step > 0 || onBack) && (
              <Pressable onPress={goBack} hitSlop={14} style={s.backBtn} accessibilityRole="button">
                <ChevronLeft size={18} color={Brand.textDim} strokeWidth={2.2} />
                <Text style={s.skipTxt}>Back</Text>
              </Pressable>
            )}
          </View>
          <View style={s.stepCenter} pointerEvents="none">
            <Text style={s.stepEyebrow}>{`STEP ${step + 1} OF ${totalSteps}`}</Text>
            <View style={s.stepTrack}>
              <View style={[s.stepFill, { width: `${((step + 1) / totalSteps) * 100}%` }]} />
            </View>
          </View>
          <View style={[s.backWrap, { alignItems: 'flex-end' }]}>
            <Pressable onPress={skip} hitSlop={14} style={s.skipWrap} accessibilityRole="button">
              <Text style={s.skipTxtSecondary}>Skip</Text>
            </Pressable>
          </View>
        </View>

        <View style={s.slideArea}>
          {step === 0 ? (
            <Animated.View key="s0" entering={FadeIn.duration(240)} style={s.slide}>
              <Text style={s.header}>Haptics built on research</Text>
              <Text style={s.lead}>Tap a state and feel it on your phone</Text>
              <View style={s.cardRow}>
                {DEMO_MODES.map((m) => (
                  <DemoCard
                    key={m}
                    mode={m}
                    playing={playing === m}
                    dimmed={playing !== null && playing !== m}
                    onPress={() => play(m)}
                  />
                ))}
              </View>
              <Text style={s.body}>
                A rhythm you feel on your skin can shift how you feel. Slower helps you settle, faster helps you get going.
              </Text>
              {busy && <Text style={s.note}>The preview plays when no session is running.</Text>}
              <View style={{ flex: 1 }} />
              <Text style={s.footnote}>
                In a Cornell study, a slow heartbeat rhythm from a smartwatch helped people stay calmer under pressure.
              </Text>
            </Animated.View>
          ) : step === 1 ? (
            <Animated.View key="s1" entering={FadeIn.duration(240)} style={s.slide}>
              <Text style={s.header}>It meets you where you are</Text>
              <Text style={s.lead}>Every session follows the same three steps</Text>
              <RhythmChart />
              <View style={s.steps}>
                <Step n="1" title="Match" text="The rhythm starts at your own heart rate, so it feels familiar." />
                <Step n="2" title="Glide" text="It slowly moves to the tempo of the state you chose." />
                <Step n="3" title="Hold" text="It stays there until your session ends." />
              </View>
            </Animated.View>
          ) : (
            <Animated.View key="s2" entering={FadeIn.duration(240)} style={s.slide}>
              <Text style={s.header}>Set your starting point</Text>
              <Text style={s.lead}>Your resting heart rate, set once</Text>
              <View style={s.options}>
                <HrOption
                  title="Measure now"
                  sub="30 seconds with your phone's camera"
                  on={hrChoice === 'measure'}
                  onPress={() => setHrChoice('measure')}
                />
                <HrOption
                  title="Enter it yourself"
                  sub="If you already know it"
                  on={hrChoice === 'manual'}
                  onPress={() => setHrChoice('manual')}
                />
                <HrOption
                  title="Use an average"
                  sub={`${AVERAGE_RESTING_BPM} bpm for now, change it anytime`}
                  on={hrChoice === 'average'}
                  onPress={() => setHrChoice('average')}
                />
              </View>
              <View style={{ flex: 1 }} />
              <Text style={s.footnote}>For wellness only, not a medical measurement.</Text>
            </Animated.View>
          )}
        </View>

        <View style={s.footer}>
          <Animated.View style={ctaStyle}>
            <Pressable
              onPress={goNext}
              onPressIn={() => {
                ctaScale.value = withTiming(0.96, { duration: 80 });
              }}
              onPressOut={() => {
                ctaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
              }}
              android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
              style={s.ctaWrap}
              accessibilityRole="button"
            >
              <View style={[s.cta, { backgroundColor: '#ffffff' }]}>
                <Text style={s.ctaTxtDark}>
                  {step < lastStep
                    ? 'Next'
                    : includeRestingHr
                      ? hrChoice === 'measure'
                        ? 'Measure Now'
                        : hrChoice === 'manual'
                          ? 'Enter Heart Rate'
                          : 'Continue'
                      : finalLabel}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
      {includeRestingHr && (
        <RhythmSheet
          visible={sheet !== null}
          mode={BraceletMode.Alpha}
          startAt={sheet ?? 'measure'}
          nextLabel="Let's Go"
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            onDone();
          }}
        />
      )}
    </View>
  );
}

/* ── Keuze-rij (zelfde glazen kaart-taal als de demo-kaarten) ──────────── */

function HrOption({ title, sub, on, onPress }: { title: string; sub: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [s.option, on && s.optionOn, pressed && { opacity: 0.85 }]}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle}>{title}</Text>
        <Text style={s.optionSub}>{sub}</Text>
      </View>
      <View style={[s.radio, on && s.radioOn]}>{on && <Check size={14} color="#0a0a0c" strokeWidth={3} />}</View>
    </Pressable>
  );
}

/* ── Kaart: zelfde recept als ModeCard in breath-welcome.tsx ───────────── */

function DemoCard({
  mode,
  playing,
  dimmed,
  onPress,
}: {
  mode: DemoMode;
  playing: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const meta = getModeMeta(mode);
  const Icon = MODE_GLYPH_ICONS[mode];
  const sel = useSharedValue(playing ? 1 : 0);
  useEffect(() => {
    sel.value = withTiming(playing ? 1 : 0, { duration: playing ? 200 : 500, easing: Easing.out(Easing.cubic) });
  }, [playing, sel]);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255,255,255,${0.14 + sel.value * 0.26})`,
  }));
  const pressScale = useSharedValue(1);
  const cardOpacity = useSharedValue(dimmed ? 0.45 : 1);
  useEffect(() => {
    cardOpacity.value = withTiming(dimmed ? 0.45 : 1, { duration: 200, easing: Easing.out(Easing.quad) });
  }, [dimmed, cardOpacity]);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: cardOpacity.value,
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        pressScale.value = withTiming(0.95, { duration: 80 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
      }}
      style={[s.cardWrap, pressStyle]}
      accessibilityRole="button"
      accessibilityLabel={`Feel ${meta.name}`}
    >
      <Animated.View style={[s.card, borderStyle]}>
        <BlurView intensity={40} tint="dark" blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
        <View style={s.cardIconWrap}>
          {/* Klopt op de echte slagen van de voorproef (zelfde klok als de
              trilmotor) — enkel zolang deze kaart speelt. */}
          {playing ? (
            <HeartbeatScale size={56}>
              <Icon size={44} color="#ffffff" />
            </HeartbeatScale>
          ) : (
            <Icon size={44} color="#ffffff" />
          )}
        </View>
        <Text style={s.cardLabel}>{meta.name}</Text>
        <Text style={s.cardSub}>{playing ? 'Feel it now' : DEMO_FEEL[mode]}</Text>
      </Animated.View>
    </AnimatedPressable>
  );
}

/* ── Grafiek: begin bij jouw hartslag → glijden → aanhouden ────────────── */

function RhythmChart() {
  const pulse = useRestingPulse();
  const { width } = useWindowDimensions();
  const calm = rhythmFor(BraceletMode.Alpha, pulse.bpm);
  const calmColor = getModeMeta(BraceletMode.Alpha).color;
  const W = width - 52;
  const H = 150;
  const yTop = 40;
  const yLow = 96;
  const x0 = 6;
  const x1 = W * 0.3;
  const x2 = W * 0.64;
  const xe = W - 6;
  const mid = (x1 + x2) / 2;
  const d = `M${x0} ${yTop} L${x1} ${yTop} C${mid} ${yTop} ${mid} ${yLow} ${x2} ${yLow} L${xe} ${yLow}`;
  const lbl = { fill: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: BrandFonts.medium } as const;
  return (
    <View style={s.chart}>
      <Svg width={W} height={H}>
        <Line x1={x1} y1={14} x2={x1} y2={H - 22} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <Line x1={x2} y1={14} x2={x2} y2={H - 22} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <Path d={d} stroke={calmColor} strokeWidth={3} fill="none" strokeLinecap="round" />
        <Circle cx={x0} cy={yTop} r={5} fill="#ffffff" />
        <Circle cx={xe} cy={yLow} r={5} fill={calmColor} />
        <SvgText x={x0} y={yTop - 14} fill="#ffffff" fontSize={13} fontFamily={BrandFonts.semibold}>
          {`Your heart rate · ${calm.startBpm} bpm`}
        </SvgText>
        <SvgText x={xe} y={yLow + 24} fill={calmColor} fontSize={13} fontFamily={BrandFonts.semibold} textAnchor="end">
          {`Calm Control · ${calm.targetBpm} bpm`}
        </SvgText>
        <SvgText x={(x0 + x1) / 2} y={H - 4} textAnchor="middle" {...lbl}>Match</SvgText>
        <SvgText x={mid} y={H - 4} textAnchor="middle" {...lbl}>Glide</SvgText>
        <SvgText x={(x2 + xe) / 2} y={H - 4} textAnchor="middle" {...lbl}>Hold</SvgText>
      </Svg>
    </View>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <View style={s.step}>
      <View style={s.stepNum}>
        <Text style={s.stepNumTxt}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepTxt}>{text}</Text>
      </View>
    </View>
  );
}

/* Maten/kleuren 1-op-1 uit breath-welcome.tsx (topbar, step*, skip*,
   slideArea, header/lead, modeCard*, footer, cta*). */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  safeContent: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  backWrap: { minWidth: 64 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 4, alignSelf: 'flex-start' },
  stepCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  stepEyebrow: { marginTop: 2, color: '#ffffff', fontFamily: BrandFonts.bold, fontSize: 9, letterSpacing: 2 },
  stepTrack: {
    width: 120,
    height: 1.5,
    borderRadius: 0.75,
    marginTop: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stepFill: { height: '100%', borderRadius: 0.75, backgroundColor: '#ffffff' },
  skipWrap: { paddingVertical: 6, paddingHorizontal: 8 },
  skipTxt: { color: Brand.textDim, fontFamily: BrandFonts.medium, fontSize: 14 },
  skipTxtSecondary: { color: 'rgba(255,255,255,0.92)', fontFamily: BrandFonts.semibold, fontSize: 15 },
  slideArea: { flex: 1, paddingHorizontal: 26, paddingTop: 4 },
  slide: { flex: 1, width: '100%' },
  header: { marginTop: 4, ...TypeScale.pageHeader, textAlign: 'left', color: Brand.text },
  lead: { marginTop: 6, ...TypeScale.pageSubhead, textAlign: 'left', color: 'rgba(255,255,255,0.55)' },
  cardRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cardWrap: { flex: 1, minHeight: 156 },
  card: { flex: 1, borderRadius: 18, borderWidth: 1, overflow: 'hidden', padding: 14, justifyContent: 'flex-end' },
  cardIconWrap: { width: 72, height: 72, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  cardLabel: { fontFamily: BrandFonts.semibold, fontSize: 15, lineHeight: 19, color: '#ffffff' },
  /* vaste hoogte (2 regels): anders verspringt de kaart bij "Feel it now" */
  cardSub: { marginTop: 2, minHeight: 34, fontFamily: BrandFonts.regular, fontSize: 13, lineHeight: 17, color: 'rgba(255,255,255,0.55)' },
  body: {
    marginTop: 22,
    fontFamily: BrandFonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.72)',
  },
  note: { marginTop: 10, fontFamily: BrandFonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  footnote: {
    marginBottom: 6,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.42)',
  },
  chart: { marginTop: 26, marginBottom: 22 },
  steps: { gap: 18 },
  step: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumTxt: { fontFamily: BrandFonts.semibold, fontSize: 13, color: '#ffffff' },
  stepTitle: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#ffffff' },
  stepTxt: { marginTop: 2, fontFamily: BrandFonts.regular, fontSize: 14.5, lineHeight: 20, color: 'rgba(255,255,255,0.66)' },
  options: { marginTop: 22, gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionOn: { borderColor: 'rgba(255,255,255,0.4)' },
  optionTitle: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#ffffff' },
  optionSub: { marginTop: 2, fontFamily: BrandFonts.regular, fontSize: 13.5, lineHeight: 18, color: 'rgba(255,255,255,0.55)' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  footer: { paddingHorizontal: 26, paddingBottom: 32, gap: 18 },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 16 },
  ctaTxtDark: { color: '#0a0a0c', fontFamily: BrandFonts.semibold, fontSize: 17 },
});
