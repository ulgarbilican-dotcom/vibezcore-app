/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control-onboarding

   Operator, 15 okt 2026: "voor State Control is het heel belangrijk dat
   gebruiker het principe echt begrijpt". Protocol = breath-welcome.tsx:
   bovenbalk Back / "STEP X OF N" + dunne lijn / Skip, kop LINKS
   (TypeScale.pageHeader + pageSubhead, geen punt), witte CTA.

   HERZIEN (4) 15 okt 2026 (operator: "step 1 is niet mooi, maak horizontale
   scroll van de states met telkens bij scroll de info eronder; volgende
   pagina ook namen states naast elkaar ter info en bij aanklikken laat
   grafiek juiste rate zien — misschien daar pagina 1 van maken en de keuze
   state pagina 2; headers in blok, geen lange zin; volgende stap measure
   heart rate met meten / zelf ingeven / gemiddeld en dan naar de sessie om
   te starten; andere sessies blijven op 30 sec lock"):

     1  HOW IT WORKS   De namen van de vijf toestanden als chips naast
                       elkaar; aantikken = de grafiek toont het echte tempo
                       (jouw hartslag → tempo van die toestand, rhythmFor).
                       Match / Glide / Hold kort eronder.
     2  CHOOSE         Horizontale scroll met de vijf toestanden als glazen
                       kaarten in hun eigen kleur; de kaart in het midden is
                       de keuze, de info staat eronder en wisselt mee.
                       Aantikken = het ritme voelen (playModePreviewHaptic,
                       30 s, zelfde curve als een sessie).
     3  HEART RATE     (enkel als de rusthartslag nog niet gekozen is)
                       Measure now / Enter it yourself / Use an average;
                       meten en invullen openen het bestaande meetblad.

   Daarna (in de route): State Control opent op de gekozen toestand, met
   voor DIE toestand één volledige sessie gratis (`stateFreeMode` +
   `stateFreeSessionUsedAt`); de andere blijven op de voorproef van 30 s.

   Woordkeuze: Science A tot Z §6.
   ───────────────────────────────────────────────────────────────────────── */

import { HeartbeatScale } from '@/components/HapticPulseRings';
import { MODE_GLYPH_ICONS } from '@/components/ModeGlyph';
import { HeartbeatHero } from '@/components/RestingHeartRatePage';
import RhythmSheet, { useRestingPulse } from '@/components/RhythmSheet';
import { Brand, BrandFonts, TypeScale } from '@/constants/theme';
import { STATE_USAGE } from '@/data/state-usage';
import { BraceletMode, MODES, getModeMeta } from '@/services/ble-contract';
import {
  PREVIEW_MAX_SECONDS,
  playModePreviewHaptic,
  rhythmFor,
  stopModePreviewHaptic,
} from '@/services/bracelet-haptics';
import { isBraceletSessionMonitorActive } from '@/services/bracelet-session-monitor';
import { AVERAGE_RESTING_BPM, chooseAverageRestingPulse } from '@/services/resting-pulse';
import { hapticTap, hapticTick } from '@/utils/haptics';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

/* Volgorde van de app: Boost … Sleep. */
const ALL_MODES = MODES.map((m) => m.mode);

/* Per toestand een eigen regel (operator: "je gaat niet alles zelfde
   uitleg geven he"), kloppend met het echte eindtempo (Science A tot Z
   §3.4: Focus 90 %, Calm 80 %, Clarity 70 %, Sleep 55 % van je rust,
   Boost 110 bpm). Welzijnstaal, geen claim. */
const FEEL_LINE: Record<BraceletMode, string> = {
  [BraceletMode.Gamma]: 'Faster than your heart. For a lift when your energy is low.',
  [BraceletMode.Beta]: 'Just under your heart. For steady attention and deep work.',
  [BraceletMode.Alpha]: 'Clearly slower than your heart. For staying composed under pressure.',
  [BraceletMode.Theta]: 'Slow and spacious. For unwinding and clearing your head.',
  [BraceletMode.Delta]: 'The slowest rhythm. For winding down before bed.',
};
function feelLine(mode: BraceletMode): string {
  return FEEL_LINE[mode];
}

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

type Props = {
  /** Na het laatste scherm, of na Skip — met de gekozen toestand. */
  onDone: (mode: BraceletMode) => void;
  /** Back op stap 1 (bv. terug naar de foto-intro). */
  onBack?: () => void;
  /** Stap 3: de rusthartslag kiezen (enkel als dat nog niet gebeurde). */
  includeRestingHr?: boolean;
  /** Knoptekst op het laatste scherm. */
  finalLabel?: string;
};

type HrChoice = 'measure' | 'manual' | 'average';
type StepIdx = 0 | 1 | 2;

export default function StateControlOnboarding({ onDone, onBack, includeRestingHr = false, finalLabel = 'Done' }: Props) {
  const [step, setStep] = useState<StepIdx>(0);
  const totalSteps = includeRestingHr ? 3 : 2;
  const lastStep = totalSteps - 1;
  const [hrChoice, setHrChoice] = useState<HrChoice>('measure');
  const [sheet, setSheet] = useState<null | 'measure' | 'manual'>(null);
  /* Pagina 1: welke toestand de grafiek toont. Pagina 2: de keuze. */
  const [chartMode, setChartMode] = useState<BraceletMode>(BraceletMode.Alpha);
  const [chosen, setChosen] = useState<BraceletMode>(BraceletMode.Alpha);

  /* Voorproef: stopt bij elke andere toestand, bij weggaan en bij afsluiten. */
  const [playing, setPlayingState] = useState<BraceletMode | null>(null);
  const playingRef = useRef<BraceletMode | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPlaying = useCallback((m: BraceletMode | null) => {
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

  /* Een lopende sessie nooit onderbreken (intro opnieuw via Settings). */
  const busy = isBraceletSessionMonitorActive();
  const play = (m: BraceletMode) => {
    hapticTap();
    if (busy) return;
    if (playingRef.current === m) {
      stopDemo();
      return;
    }
    if (stopTimer.current) clearTimeout(stopTimer.current);
    playModePreviewHaptic(m);
    setPlaying(m);
    stopTimer.current = setTimeout(() => setPlaying(null), PREVIEW_MAX_SECONDS * 1000);
  };
  const choose = useCallback(
    (m: BraceletMode) => {
      setChosen(m);
      if (playingRef.current !== null && playingRef.current !== m) stopDemo();
    },
    [stopDemo],
  );

  const goNext = () => {
    stopDemo();
    if (step < lastStep) {
      setStep((step + 1) as StepIdx);
      return;
    }
    if (includeRestingHr) {
      if (hrChoice === 'average') {
        chooseAverageRestingPulse();
        onDone(chosen);
      } else {
        setSheet(hrChoice);
      }
      return;
    }
    onDone(chosen);
  };
  const goBack = useCallback(() => {
    stopDemo();
    if (step > 0) setStep((step - 1) as StepIdx);
    else onBack?.();
  }, [step, onBack, stopDemo]);
  const skip = () => {
    stopDemo();
    onDone(chosen);
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

  const ctaScale = useSharedValue(1);
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  const ctaLabel =
    step < lastStep
      ? 'Next'
      : includeRestingHr
        ? hrChoice === 'measure'
          ? 'Measure Now'
          : hrChoice === 'manual'
            ? 'Enter Heart Rate'
            : 'Continue'
        : finalLabel;

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
              <View style={s.pad}>
                <Text style={s.header}>How it works</Text>
                <Text style={s.lead}>A rhythm that starts at your heart</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}
                style={s.chipsScroll}
              >
                {ALL_MODES.map((m) => {
                  const meta = getModeMeta(m);
                  const on = chartMode === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => {
                        hapticTap();
                        setChartMode(m);
                      }}
                      style={[
                        s.chip,
                        { borderColor: rgba(meta.color, on ? 0.9 : 0.3), backgroundColor: rgba(meta.color, on ? 0.18 : 0.06) },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[s.chipTxt, on && { color: '#ffffff' }]}>{meta.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={[s.pad, { flex: 1 }]}>
                <RhythmChart mode={chartMode} />
                <View style={s.steps}>
                  <Step n="1" title="Match" text="Starts at your own heart rate" />
                  <Step n="2" title="Glide" text="Moves to the tempo of your state" />
                  <Step n="3" title="Hold" text="Stays there until the end" />
                </View>
                <View style={{ flex: 1 }} />
              </View>
              <Text style={[s.footnote, s.pad]}>
                In a Cornell study, a slow heartbeat rhythm from a smartwatch helped people stay calmer under pressure.
              </Text>
            </Animated.View>
          ) : step === 1 ? (
            <Animated.View key="s1" entering={FadeIn.duration(240)} style={s.slide}>
              <View style={s.pad}>
                <Text style={s.header}>Choose your state</Text>
                <Text style={s.lead}>Swipe, then tap to feel it</Text>
              </View>
              <StateCarousel chosen={chosen} playing={playing} onChoose={choose} onPlay={play} />
              <View style={[s.pad, s.info]}>
                <InfoBlock mode={chosen} />
                {busy && <Text style={s.note}>The preview plays when no session is running.</Text>}
              </View>
            </Animated.View>
          ) : (
            <Animated.View key="s2" entering={FadeIn.duration(240)} style={[s.slide, s.pad]}>
              <Text style={s.header}>Your heart rate</Text>
              <Text style={s.lead}>Your starting point</Text>
              {/* Zelfde kloppende hart + hartlijn als "Your Resting Heart
                  Rate" (operator: "zelfde animatie als de hartslag"). */}
              <View style={s.heroWrap}>
                <HeartbeatHero stage={150} />
              </View>
              <View style={s.optionsTight}>
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
                <Text style={s.ctaTxtDark}>{ctaLabel}</Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
      {includeRestingHr && (
        <RhythmSheet
          visible={sheet !== null}
          mode={chosen}
          startAt={sheet ?? 'measure'}
          nextLabel="Let's Go"
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            onDone(chosen);
          }}
        />
      )}
    </View>
  );
}

/* ── Pagina 2: horizontale scroll met de vijf toestanden ───────────────── */

const CARD_GAP = 12;

function StateCarousel({
  chosen,
  playing,
  onChoose,
  onPlay,
}: {
  chosen: BraceletMode;
  playing: BraceletMode | null;
  onChoose: (m: BraceletMode) => void;
  onPlay: (m: BraceletMode) => void;
}) {
  const { width } = useWindowDimensions();
  /* Cirkels (operator: "wel in cirkel werken"), zoals de cirkel in State
     Control zelf; de buren piepen links en rechts in beeld. */
  const cardW = Math.round(width * 0.6);
  const side = Math.round((width - cardW) / 2);
  const step = cardW + CARD_GAP;
  const ref = useRef<ScrollView>(null);
  const lastIdx = useRef(ALL_MODES.indexOf(chosen));

  /* Start op de huidige keuze (Calm Control), zonder animatie. */
  useEffect(() => {
    const i = ALL_MODES.indexOf(chosen);
    requestAnimationFrame(() => ref.current?.scrollTo({ x: i * step, animated: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Tijdens het scrollen wisselt de info al mee (met een fijne tik), zodat
     de tekst eronder altijd bij de kaart in het midden hoort. */
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(ALL_MODES.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
    if (i !== lastIdx.current) {
      lastIdx.current = i;
      hapticTick();
      onChoose(ALL_MODES[i]);
    }
  };

  return (
    <View>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: side, gap: CARD_GAP }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={s.carousel}
      >
        {ALL_MODES.map((m, i) => (
          <StateCard
            key={m}
            mode={m}
            width={cardW}
            active={chosen === m}
            playing={playing === m}
            onPress={() => {
              if (chosen !== m) ref.current?.scrollTo({ x: i * step, animated: true });
              onPlay(m);
            }}
          />
        ))}
      </ScrollView>
      <View style={s.dots}>
        {ALL_MODES.map((m) => {
          const on = chosen === m;
          return <View key={m} style={[s.dot, on && { width: 18, backgroundColor: getModeMeta(m).color }]} />;
        })}
      </View>
    </View>
  );
}

function StateCard({
  mode,
  width,
  active,
  playing,
  onPress,
}: {
  mode: BraceletMode;
  width: number;
  active: boolean;
  playing: boolean;
  onPress: () => void;
}) {
  const meta = getModeMeta(mode);
  const Icon = MODE_GLYPH_ICONS[mode];
  const k = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    k.value = withTiming(active ? 1 : 0, { duration: 220 });
  }, [active, k]);
  const anim = useAnimatedStyle(() => ({
    opacity: 0.45 + k.value * 0.55,
    transform: [{ scale: 0.8 + k.value * 0.2 }],
  }));
  const d = width;
  const circle = (
    <View
      style={[
        s.stateCircle,
        {
          width: d,
          height: d,
          borderRadius: d / 2,
          borderColor: rgba(meta.color, active ? 0.9 : 0.4),
          backgroundColor: rgba(meta.color, active ? 0.16 : 0.08),
        },
      ]}
    >
      <Icon size={Math.round(d * 0.24)} color={meta.color} />
      <Text style={s.stateName} numberOfLines={1}>
        {meta.name}
      </Text>
      <Text style={s.stateUse} numberOfLines={1}>
        {playing ? 'Feel it now' : STATE_USAGE[mode]}
      </Text>
    </View>
  );
  return (
    <Animated.View style={[{ width, height: d }, anim]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${meta.name}, tap to feel it`}>
        {/* Klopt op de echte slagen van de voorproef (zelfde klok als de
            trilmotor), zoals de cirkel tijdens een sessie. */}
        {playing ? <HeartbeatScale size={d}>{circle}</HeartbeatScale> : circle}
      </Pressable>
    </Animated.View>
  );
}

/* Info onder de scroll — wisselt mee met de kaart in het midden. */
function InfoBlock({ mode }: { mode: BraceletMode }) {
  const pulse = useRestingPulse();
  const meta = getModeMeta(mode);
  const r = rhythmFor(mode, pulse.bpm);
  return (
    <Animated.View key={mode} entering={FadeIn.duration(180)}>
      <Text style={s.infoTitle}>{feelLine(mode)}</Text>
      <View style={s.facts}>
        <Fact label="Ends near" value={`${r.targetBpm} bpm`} color={meta.color} />
        <Fact label="Recommended" value={`${meta.defaultMinutes} min`} color={meta.color} />
      </View>
    </Animated.View>
  );
}

function Fact({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.fact}>
      <Text style={s.factLabel}>{label}</Text>
      <Text style={[s.factValue, { color }]}>{value}</Text>
    </View>
  );
}

/* ── Pagina 3: keuze-rij ───────────────────────────────────────────────── */

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

/* ── Pagina 1: grafiek ─────────────────────────────────────────────────── */

function RhythmChart({ mode }: { mode: BraceletMode }) {
  const pulse = useRestingPulse();
  const { width } = useWindowDimensions();
  const r = rhythmFor(mode, pulse.bpm);
  const meta = getModeMeta(mode);
  const W = width - 52;
  const H = 150;
  /* Hoogte = tempo (sneller = hoger): Boost stijgt, de kalme toestanden
     dalen — met de echte getallen van deze gebruiker. */
  const yOf = (bpm: number) => 104 - ((Math.min(115, Math.max(40, bpm)) - 40) / 75) * 76;
  const yA = yOf(r.startBpm);
  const yB = yOf(r.targetBpm);
  const rising = yB < yA;
  const x0 = 6;
  const x1 = W * 0.3;
  const x2 = W * 0.64;
  const xe = W - 6;
  const mid = (x1 + x2) / 2;
  const d = `M${x0} ${yA} L${x1} ${yA} C${mid} ${yA} ${mid} ${yB} ${x2} ${yB} L${xe} ${yB}`;
  const lbl = { fill: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: BrandFonts.medium } as const;
  return (
    <View style={s.chart}>
      <Svg width={W} height={H}>
        <Line x1={x1} y1={14} x2={x1} y2={H - 22} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <Line x1={x2} y1={14} x2={x2} y2={H - 22} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <Path d={d} stroke={meta.color} strokeWidth={3} fill="none" strokeLinecap="round" />
        <Circle cx={x0} cy={yA} r={5} fill="#ffffff" />
        <Circle cx={xe} cy={yB} r={5} fill={meta.color} />
        <SvgText x={x0} y={rising ? yA + 24 : yA - 14} fill="#ffffff" fontSize={13} fontFamily={BrandFonts.semibold}>
          {`Your heart rate · ${r.startBpm} bpm`}
        </SvgText>
        <SvgText x={xe} y={rising ? yB - 14 : yB + 24} fill={meta.color} fontSize={13} fontFamily={BrandFonts.semibold} textAnchor="end">
          {`${meta.name} · ${r.targetBpm} bpm`}
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
      <Text style={s.stepTitle}>{title}</Text>
      <Text style={s.stepTxt} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/* Maten/kleuren 1-op-1 uit breath-welcome.tsx (topbar, step*, skip*,
   header/lead, footer, cta*). */
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
  slideArea: { flex: 1, paddingTop: 4 },
  slide: { flex: 1, width: '100%' },
  pad: { paddingHorizontal: 26 },
  header: { marginTop: 4, ...TypeScale.pageHeader, textAlign: 'left', color: Brand.text },
  lead: { marginTop: 6, ...TypeScale.pageSubhead, textAlign: 'left', color: 'rgba(255,255,255,0.55)' },
  chipsScroll: { flexGrow: 0, marginTop: 22 },
  chips: { paddingHorizontal: 26, gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 14 },
  chipTxt: { fontFamily: BrandFonts.semibold, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  chart: { marginTop: 18, marginBottom: 14 },
  steps: { gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumTxt: { fontFamily: BrandFonts.semibold, fontSize: 12.5, color: '#ffffff' },
  stepTitle: { width: 52, fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff' },
  stepTxt: { flex: 1, fontFamily: BrandFonts.regular, fontSize: 14.5, color: 'rgba(255,255,255,0.66)' },
  carousel: { flexGrow: 0, marginTop: 24 },
  stateCircle: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 18 },
  stateName: { marginTop: 6, fontFamily: BrandFonts.bold, fontSize: 21, color: '#ffffff' },
  stateUse: { fontFamily: BrandFonts.regular, fontSize: 14.5, color: 'rgba(255,255,255,0.62)' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  info: { marginTop: 22 },
  /* Tekst over twee regels in blok (operator, 15 okt 2026). */
  infoTitle: { fontFamily: BrandFonts.regular, fontSize: 16, lineHeight: 23, color: 'rgba(255,255,255,0.8)', textAlign: 'justify' },
  facts: { flexDirection: 'row', gap: 10, marginTop: 14 },
  fact: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  factLabel: { fontFamily: BrandFonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  factValue: { marginTop: 2, fontFamily: BrandFonts.semibold, fontSize: 17 },
  note: { marginTop: 10, fontFamily: BrandFonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  footnote: {
    marginBottom: 6,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'justify',
  },
  options: { marginTop: 22, gap: 10 },
  optionsTight: { marginTop: 4, gap: 10 },
  heroWrap: { alignItems: 'center', justifyContent: 'center', height: 170 },
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
  footer: { paddingHorizontal: 26, paddingBottom: 32, paddingTop: 12, gap: 18 },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 16 },
  ctaTxtDark: { color: '#0a0a0c', fontFamily: BrandFonts.semibold, fontSize: 17 },
});
