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

import LiquidWave, { breathWaveLook } from '@/components/LiquidWave';
import { BlurView } from 'expo-blur';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import BalancedText from '@/components/BalancedText';
import VibezGlass from '@/components/VibezGlass';
import { isGlassSheetOpen } from '@/components/GlassSheetHost';
import { HapticPulseRings, HeartbeatScale } from '@/components/HapticPulseRings';
import { MODE_GLYPH_ICONS } from '@/components/ModeGlyph';
import { HeartbeatHero } from '@/components/RestingHeartRatePage';
import RhythmSheet, { useRestingPulse } from '@/components/RhythmSheet';
import PressScale from '@/components/PressScale';
import ConfirmCard from '@/components/ConfirmCard';
import { Brand, BrandFonts, TypeScale } from '@/constants/theme';
import { STATE_USAGE } from '@/data/state-usage';
import { BraceletMode, MODES, getModeMeta } from '@/services/ble-contract';
import {
  TASTE_SECONDS,
  playModeTasteHaptic,
  rhythmFor,
  stopModePreviewHaptic,
} from '@/services/bracelet-haptics';
import { isBraceletSessionMonitorActive } from '@/services/bracelet-session-monitor';
import {
  AVERAGE_RESTING_BPM,
  addRestingPulseReading,
  chooseAverageRestingPulse,
  getRestingPulse,
  recordSessionPulse,
  setLiveStartPulse,
} from '@/services/resting-pulse';
import PulseMeter from '@/components/PulseMeter';
import * as Haptics from 'expo-haptics';
import { hapticTap, hapticTick } from '@/utils/haptics';
import { stopHeartbeatSound } from '@/services/heartbeat-sound';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { scheduleOnRN } from 'react-native-worklets';
import {
  BackHandler,
  PanResponder,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  withDelay,
  withRepeat,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedProps,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient as SvgLinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

/* Volgorde van de app: Boost … Sleep. */
const ALL_MODES = MODES.map((m) => m.mode);
/** Hoe lang het water erover doet om de cirkel te vullen vóór de eerste slag. */
const FILL_MS = 800;

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

function getRestingDecided(): boolean {
  return getRestingPulse().decided;
}

type HrChoice = 'measure' | 'manual' | 'average';

/* Inkomend per blok, zelfde rustige reveal als de Breathwork-onboarding
   (operator: "alles is nu weer statisch"). */
const enter = (i: number) => FadeInDown.duration(420).delay(80 + i * 90);
type StepIdx = 0 | 1 | 2 | 3;

export default function StateControlOnboarding({ onDone, onBack, includeRestingHr = false, finalLabel = 'Done' }: Props) {
  const [step, setStepRaw] = useState<StepIdx>(0);
  /* Richting van de paginawissel: Next schuift van rechts in, Back van
     links (iOS-gevoel, operator: "bij veranderen pagina"). */
  const [dir, setDir] = useState<1 | -1>(1);
  const setStep = useCallback(
    (next: StepIdx) => {
      setStepRaw((cur) => {
        setDir(next >= cur ? 1 : -1);
        return next;
      });
    },
    [],
  );
  const pageIn = dir > 0 ? FadeInRight.duration(320) : FadeInLeft.duration(320);
  /* Met hartslag: 4 stappen — 3 kiezen, 4 meten (operator: "stap 3 en 4").
     Kies je niet "meten", dan eindigt de onboarding na stap 3. */
  const lastStep = includeRestingHr ? 2 : 1;
  /* Stap 4: resultaat van de meting. */
  const [measured, setMeasured] = useState<number | null>(null);
  const [elevated, setElevated] = useState(false);
  const [meterKey, setMeterKey] = useState(0);
  /* "Keep my current" weg (operator: "staat dubbel" — wie zijn waarde wil
     houden, tikt Skip). */
  const [hrChoice, setHrChoice] = useState<HrChoice>('measure');
  /* 19 okt 2026 (audit): "OF 4" enkel als er gemeten wordt — wie het gemiddelde
     of een eigen waarde kiest, eindigt na stap 3 en ziet "OF 3". */
  const totalSteps = includeRestingHr ? (step === 3 || hrChoice === 'measure' ? 4 : 3) : 2;
  const [skipAsk, setSkipAsk] = useState(false);
  /* Hartslaggeluid op stap 3, enkel zolang ze echt in beeld is. */
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);
  const [sheet, setSheet] = useState<null | 'measure' | 'manual'>(null);
  /* Pagina 1: welke toestand de grafiek toont. Pagina 2: de keuze. */
  const [chartMode, setChartMode] = useState<BraceletMode>(BraceletMode.Alpha);
  const [chosen, setChosen] = useState<BraceletMode>(BraceletMode.Alpha);

  /* Voorproef: stopt bij elke andere toestand, bij weggaan en bij afsluiten. */
  const [playing, setPlayingState] = useState<BraceletMode | null>(null);
  const playingRef = useRef<BraceletMode | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPlaying = useCallback((m: BraceletMode | null) => {
    playingRef.current = m;
    setPlayingState(m);
  }, []);
  const stopDemo = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = null;
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
    if (startTimer.current) clearTimeout(startTimer.current);
    /* Eerst vult het water de cirkel (±0,7 s), dan pas de eerste slag. */
    setPlaying(m);
    startTimer.current = setTimeout(() => {
      startTimer.current = null;
      playModeTasteHaptic(m);
    }, FILL_MS);
    stopTimer.current = setTimeout(() => setPlaying(null), FILL_MS + TASTE_SECONDS * 1000);
  };
  const choose = useCallback(
    (m: BraceletMode) => {
      setChosen(m);
      if (playingRef.current !== null && playingRef.current !== m) stopDemo();
    },
    [stopDemo],
  );

  /* Na de onboarding valt alle hartslaggeluid stil (operator: "bij
     doorklikken na meting moet hartslag stoppen"). */
  const finish = (m: BraceletMode) => {
    stopHeartbeatSound('page');
    stopHeartbeatSound('measure');
    onDone(m);
  };

  const goNext = () => {
    stopDemo();
    if (step < lastStep) {
      setStep((step + 1) as StepIdx);
      return;
    }
    if (includeRestingHr) {
      if (hrChoice === 'average') {
        chooseAverageRestingPulse();
        finish(chosen);
      } else if (hrChoice === 'measure') {
        setMeasured(null);
        setElevated(false);
        setMeterKey((k) => k + 1);
        setStep(3);
      } else {
        setSheet('manual');
      }
      return;
    }
    finish(chosen);
  };
  const goBack = useCallback(() => {
    stopDemo();
    if (step > 0) setStep((step - 1) as StepIdx);
    else onBack?.();
  }, [step, onBack, stopDemo]);
  /* Skip vraagt eerst, zoals de Breathwork-onboarding (19 okt 2026, audit).
     Nog geen rusthartslag gekozen → het gemiddelde, anders kwam er meteen een
     tweede hartslagscherm; aanpassen kan later in Profile → Your rhythm. */
  const skip = () => {
    stopDemo();
    setSkipAsk(true);
  };
  const confirmSkip = () => {
    setSkipAsk(false);
    if (includeRestingHr && !getRestingPulse().decided) chooseAverageRestingPulse();
    finish(chosen);
  };

  /* iOS-terugveeg (operator, iOS-test build 20: "weggaan uit pagina enkel
     met backknop — is dat correct gedrag?"): zoals overal op de iPhone
     veeg je vanaf de linkerrand terug — hier één stap terug, op stap 1 uit
     de onboarding (= Back). Android heeft dit al via zijn eigen
     terug-gebaar (hardwareBackPress hieronder). De systeemveeg van het
     scherm zelf staat uit, anders sprong je in één keer de hele
     onboarding uit. */
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  const canBackRef = useRef(false);
  canBackRef.current = sheet === null && (step > 0 || !!onBack);
  const edgeSwipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        canBackRef.current && g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 60 || g.vx > 0.5) goBackRef.current();
      },
    }),
  ).current;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      /* Een open onderblad sluit eerst (GlassSheetHost doet dat zelf). */
      if (isGlassSheetOpen()) return false;
      if (sheet) return false;
      if (step === 0 && !onBack) return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [step, onBack, goBack, sheet]);


  /* Lichtflits over de knop op stap 1 — 1-op-1 het recept van
     breath-welcome.tsx (pauze 2,6 s, veeg 1,1 s, rust 1,2 s). */
  const [ctaWidth, setCtaWidth] = useState(300);
  const ctaShimmer = useSharedValue(-1);
  useEffect(() => {
    ctaShimmer.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(2600, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })),
        withDelay(1200, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [ctaShimmer]);
  const ctaShimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(ctaShimmer.value, [-1, 1], [-70, ctaWidth + 40]) },
      { rotate: '18deg' },
    ],
  }));

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
            <Animated.View key="s0" entering={pageIn} style={s.slide}>
              <Animated.View entering={enter(0)} style={s.pad}>
                {/* Wat dit is (operator, 16 okt 2026) — zelfde eyebrow als de
                    State Control-tab. */}
                <Text style={s.onbEyebrow}>STATE CONTROL</Text>
                <Text style={s.header}>How it works</Text>
                {/* Operator, 16 okt 2026 ("start at your heart ook niet goed"): zegt nu
                    precies wat er gebeurt — het RITME begint bij je hartslag en
                    verschuift naar je toestand; geen belofte over je hart. */}
                <BalancedText style={s.lead}>Starts at your heart rate, then shifts to your state</BalancedText>
              </Animated.View>
              {/* Pillen boven de kaart, vlak onder de inleiding (operator, 16 okt
                  2026: "pillen buiten kaart, meer naar boven"); de kaart draagt
                  enkel de grafiek. */}
              <Animated.View entering={enter(1)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}
                style={s.chipsScroll}
              >
                {ALL_MODES.map((m) => (
                  <GlassChip
                    key={m}
                    mode={m}
                    label={getModeMeta(m).name}
                    on={chartMode === m}
                    onPress={() => {
                      hapticTap();
                      setChartMode(m);
                    }}
                  />
                ))}
              </ScrollView>
              </Animated.View>
              <View style={{ flex: 1 }} />
              <Animated.View entering={enter(2)} style={s.chartCard}>
                <RhythmChart mode={chartMode} />
              </Animated.View>
              {/* Operator, 16 okt 2026 ("pagina 1 is veel tekst, heel druk,
                  kan afschrikken"): de drie stappen Match/Glide/Hold zijn weg —
                  de grafiek toont ze al (start bij je hartslag, glijdt, blijft).
                  Eén scherm, één boodschap. */}
              <View style={{ flex: 1 }} />
              <Text style={[s.footnote, s.pad]}>
                {/* Beide richtingen, kloppend met Science A tot Z §3.1 (operator:
                    "Cornell gaat enkel over calmer under pressure"): trager →
                    kalmer (Azevedo 2017; Costa 2019), sneller → alerter
                    (Valente 2024), geleidelijk werkt (Motokawa & Kato 2025). */}
                Inspired by research on heartbeat-like touch: slower helped people stay calm, faster made them more alert.
              </Text>
            </Animated.View>
          ) : step === 1 ? (
            <Animated.View key="s1" entering={pageIn} style={s.slide}>
              <Animated.View entering={enter(0)} style={s.pad}>
                <Text style={s.header}>Choose your state</Text>
                <Text style={s.lead}>Swipe, then tap to feel it</Text>
              </Animated.View>
              <Animated.View entering={enter(1)}>
                <StateCarousel chosen={chosen} playing={playing} onChoose={choose} onPlay={play} />
              </Animated.View>
              {/* Tekst en kaarten zakken (operator): lucht tussen scroll en info. */}
              <View style={{ flex: 1, minHeight: 20 }} />
              <Animated.View entering={enter(2)} style={s.pad}>
                <InfoBlock mode={chosen} />
                {busy && <BalancedText style={s.note}>The preview plays when no session is running.</BalancedText>}
              </Animated.View>
              <View style={{ flex: 0.6 }} />
            </Animated.View>
          ) : step === 3 ? (
            <Animated.View key="s3" entering={pageIn} style={[s.slide, s.pad]}>
              <Animated.View entering={enter(0)}>
                <Text style={s.header}>Measure</Text>
                <Text style={s.lead}>Stay still for 20 seconds</Text>
              </Animated.View>
              <View style={s.meterWrap}>
                <PulseMeter
                  key={meterKey}
                  purpose="baseline"
                  onResult={(bpm) => {
                    setMeasured(bpm);
                    setElevated(false);
                  }}
                  onElevated={(bpm) => {
                    setMeasured(bpm);
                    setElevated(true);
                  }}
                  onManual={() => setSheet('manual')}
                />
              </View>
              <BalancedText style={s.footnote}>For wellness only, not a medical measurement.</BalancedText>
            </Animated.View>
          ) : (
            <Animated.View key="s2" entering={pageIn} style={[s.slide, s.pad]}>
              <Animated.View entering={enter(0)}>
                <Text style={s.header}>Your heart rate</Text>
                <Text style={s.lead}>Your starting point</Text>
              </Animated.View>
              {/* Zelfde kloppende hart + hartlijn + hartslaggeluid als "Your
                  Resting Heart Rate" (operator). */}
              <Animated.View entering={enter(1)} style={s.heroWrap}>
                <HeartbeatHero stage={273} sound={focused && appActive && sheet === null} />
              </Animated.View>
              <Animated.View entering={enter(2)} style={s.optionsTight}>
                <HrOption
                  title="Measure now"
                  sub="20 seconds with your phone's camera"
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
              </Animated.View>
            </Animated.View>
          )}
        </View>

        {step === 3 ? (
          <View style={s.footer}>
            {measured !== null ? (
              <Animated.View entering={FadeInDown.duration(320)}>
                <PressScale
                  haptic
                  scaleTo={0.97}
                  onPress={() => {
                    /* Zelfde regels als het meetblad (RhythmSheet): een
                       rustwaarde wordt je rusthartslag; boven het rustbereik
                       start enkel deze sessie op dit ritme. */
                    if (elevated || !addRestingPulseReading(measured)) {
                      recordSessionPulse(measured);
                      if (!getRestingDecided()) chooseAverageRestingPulse();
                    }
                    setLiveStartPulse(measured);
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    finish(chosen);
                  }}
                  style={s.ctaWrap}
                  accessibilityRole="button"
                >
                  <View style={[s.cta, { backgroundColor: '#ffffff' }]}>
                    <Text style={s.ctaTxtDark}>{elevated ? 'Continue' : 'Save and Continue'}</Text>
                  </View>
                </PressScale>
                <PressScale
                  onPress={() => {
                    setMeasured(null);
                    setElevated(false);
                    setMeterKey((k) => k + 1);
                  }}
                  style={s.secondaryBtn}
                  accessibilityRole="button"
                >
                  <Text style={s.secondaryTxt}>Measure Again</Text>
                </PressScale>
              </Animated.View>
            ) : null}
          </View>
        ) : (
        <View style={s.footer}>
          <PressScale onPress={goNext} haptic scaleTo={0.97} style={s.ctaWrap} accessibilityRole="button">
            {/* Zelfde knop als de Breathwork-onboarding (operator, 16 okt
                2026): stap 1 = matglas met lichtflits, daarna wit. */}
            {step === 0 ? (
              <View style={[s.cta, { overflow: 'hidden' }]} onLayout={(e) => setCtaWidth(e.nativeEvent.layout.width)}>
                <BlurView intensity={40} tint="dark" blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.22)' }]} />
                <Text style={[s.ctaTxtDark, { color: '#ffffff' }]}>{ctaLabel}</Text>
                <Animated.View style={[s.ctaShimmer, ctaShimmerStyle]} pointerEvents="none">
                  <ExpoLinearGradient
                    colors={['#ffffff00', '#ffffff9a', '#ffffff00']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>
            ) : (
              <View style={[s.cta, { backgroundColor: '#ffffff' }]}>
                <Text style={s.ctaTxtDark}>{ctaLabel}</Text>
              </View>
            )}
          </PressScale>
        </View>
        )}
      </SafeAreaView>
      {Platform.OS === 'ios' && <View style={s.edgeSwipe} {...edgeSwipe.panHandlers} />}
      {includeRestingHr && (
        <RhythmSheet
          visible={sheet !== null}
          mode={chosen}
          startAt={sheet ?? 'manual'}
          nextLabel="Let's Go"
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            finish(chosen);
          }}
        />
      )}
      <ConfirmCard
        visible={skipAsk}
        title="Skip the introduction?"
        body="You can watch it again anytime in Settings."
        confirmLabel="Skip"
        cancelLabel="Keep Going"
        onCancel={() => setSkipAsk(false)}
        onConfirm={confirmSkip}
      />
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
  const ref = useRef<Animated.ScrollView>(null);
  const lastIdx = useRef(ALL_MODES.indexOf(chosen));
  /* Schaal en helderheid volgen de vinger vloeiend (operator: "is de
     animatie overal correct, bij scrollen ..."), zoals een iOS-carrousel —
     niet pas springen als een cirkel in het midden staat. */
  const scrollX = useSharedValue(ALL_MODES.indexOf(chosen) * step);
  const pick = useCallback(
    (i: number) => {
      if (i !== lastIdx.current) {
        lastIdx.current = i;
        hapticTick();
        onChoose(ALL_MODES[i]);
      }
    },
    [onChoose],
  );
  const centred = useSharedValue(ALL_MODES.indexOf(chosen));
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
    const i = Math.max(0, Math.min(ALL_MODES.length - 1, Math.round(e.contentOffset.x / step)));
    if (i !== centred.value) {
      centred.value = i;
      scheduleOnRN(pick, i);
    }
  });

  /* Start op de huidige keuze (Calm Control), zonder animatie. */
  useEffect(() => {
    const i = ALL_MODES.indexOf(chosen);
    requestAnimationFrame(() => ref.current?.scrollTo({ x: i * step, animated: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Animated.ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: side, gap: CARD_GAP, paddingVertical: 60 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={s.carousel}
      >
        {ALL_MODES.map((m, i) => (
          <StateCard
            key={m}
            mode={m}
            index={i}
            step={step}
            scrollX={scrollX}
            width={cardW}
            active={chosen === m}
            playing={playing === m}
            onPress={() => {
              if (chosen !== m) ref.current?.scrollTo({ x: i * step, animated: true });
              onPlay(m);
            }}
          />
        ))}
      </Animated.ScrollView>
      <View style={s.dots}>
        {ALL_MODES.map((m) => {
          const on = chosen === m;
          return <View key={m} style={[s.dot, on && s.dotOn]} />;
        })}
      </View>
    </View>
  );
}

function StateCard({
  mode,
  index,
  step,
  scrollX,
  width,
  active,
  playing,
  onPress,
}: {
  mode: BraceletMode;
  index: number;
  step: number;
  scrollX: SharedValue<number>;
  width: number;
  active: boolean;
  playing: boolean;
  onPress: () => void;
}) {
  const meta = getModeMeta(mode);
  const Icon = MODE_GLYPH_ICONS[mode];
  const anim = useAnimatedStyle(() => {
    const dist = Math.min(1, Math.abs(scrollX.value - index * step) / step);
    return {
      opacity: 1 - dist * 0.55,
      transform: [{ scale: 1 - dist * 0.2 }],
    };
  });
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
          overflow: 'hidden',
        },
      ]}
    >
      {/* Golvende vulling (operator, 16 okt 2026: "binnenkant van step 2 ook
          animeren, bovenaan golven") — dezelfde LiquidWave als in
          breath-setup en de duurring; de gekozen cirkel staat iets hoger. */}
      {/* Glas zoals de rest van de app (operator, 16 okt 2026), met een
          vleugje toestandskleur; de gekozen cirkel is lichter glas. */}
      <VibezGlass radius={d / 2} tint={meta.color} level={active ? 'normal' : 'subtle'} style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Bij het tikken vult het water van onderuit tot bovenaan, in de
            seconde voor de eerste slag (operator, 16 okt 2026). */}
        {/* Vervolg (operator: "water moet onderaan staan, bij tik vullen,
            dan begint de tik"): in rust staat het water onderaan; bij een tik
            stijgt het tot bovenaan, en pas dan begint het kloppen. */}
        <LiquidWave size={d} level={playing ? 0.94 : 0.06} riseMs={FILL_MS} {...breathWaveLook(meta.color)} />
      </View>
      {/* Naam en gebruik staan precies in het midden van de cirkel; het
          icoon zweeft erboven (operator, 16 okt 2026: "iconen meer naar
          boven", "tekst gecentreerd"). */}
      <View style={{ position: 'absolute', top: Math.round(d * 0.1), left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
        <Icon size={Math.round(d * 0.24)} color={meta.color} />
      </View>
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
      {/* Bij elke slag een golf naar buiten, zoals rond de cirkel in een
          lopende State Control-sessie (operator, 16 okt 2026). */}
      {playing && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <HapticPulseRings size={d} color={breathWaveLook(meta.color).color} beatSynced />
        </View>
      )}
      {/* Indrukken = PressScale, zoals overal in de app. */}
      {/* Operator, 16 okt 2026 ("eerste tik is fout, gaat naar binnen"): geen
          krimp bij het tikken — het kloppen zelf is het antwoord; enkel een
          lichte dim. En de cirkel staat altijd in hetzelfde vlak, zodat hij
          niet verspringt wanneer het kloppen begint. */}
      <PressScale
        onPress={onPress}
        scaleTo={1}
        style={{ width: d, height: d }}
        accessibilityRole="button"
        accessibilityLabel={`${meta.name}, tap to feel it`}
      >
        {/* Klopt op de echte slagen van de voorproef (zelfde klok als de
            trilmotor), zoals de cirkel tijdens een sessie. */}
        <HeartbeatScale size={d} enabled={playing}>
          {circle}
        </HeartbeatScale>
      </PressScale>
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
      {/* Elke zin op een eigen regel, in blok (operator, 16 okt 2026: "for
          staying moet op volgende rij beginnen, alles mooi in blok"): eerst
          wat het ritme doet, daaronder waarvoor. */}
      {(() => {
        const line = feelLine(mode);
        const cut = line.indexOf('. ');
        const what = cut > 0 ? line.slice(0, cut + 1) : line;
        const why = cut > 0 ? line.slice(cut + 2) : '';
        return (
          <>
            <BalancedText style={s.infoWhat}>{what}</BalancedText>
            {why ? <BalancedText style={s.infoTitle}>{why}</BalancedText> : null}
          </>
        );
      })()}
      <View style={s.facts}>
        <Fact label="Rhythm ends at" value={`${r.targetBpm} bpm`} />
        <Fact label="Recommended" value={`${meta.defaultMinutes} min`} />
      </View>
    </Animated.View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.fact}>
      <Text style={s.factLabel}>{label}</Text>
      <Text style={s.factValue}>{value}</Text>
    </View>
  );
}

/* Apple-glas-pil: neutraal glas; aangetikt = fijne lichte rand + korte pop
   (operator: "pills apple stijl glass, bij aantikken heel licht omlijning
   en poppen"). */
function GlassChip({ mode, label, on, onPress }: { mode: BraceletMode; label: string; on: boolean; onPress: () => void }) {
  const Icon = MODE_GLYPH_ICONS[mode];
  /* Indrukken = PressScale (zelfde als de rest van de app: krimpen + dimmen,
     terugveren). Gekozen = lichte witte rand + korte pop. */
  const pop = useSharedValue(1);
  const k = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    k.value = withTiming(on ? 1 : 0, { duration: 220 });
    if (on) pop.value = withSequence(withTiming(1.07, { duration: 120 }), withSpring(1, { duration: 360, dampingRatio: 0.55 }));
  }, [on, k, pop]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    borderColor: `rgba(255,255,255,${0.1 + k.value * 0.5})`,
    backgroundColor: `rgba(255,255,255,${0.06 + k.value * 0.08})`,
  }));
  return (
    <PressScale onPress={onPress} scaleTo={0.92} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Animated.View style={[s.chip, style]}>
        <Icon size={17} color={on ? getModeMeta(mode).color : 'rgba(255,255,255,0.7)'} />
        <Text style={[s.chipTxt, on && { color: '#ffffff' }]}>{label}</Text>
      </Animated.View>
    </PressScale>
  );
}

/* ── Pagina 3: keuze-rij ───────────────────────────────────────────────── */

function HrOption({ title, sub, on, onPress }: { title: string; sub: string; on: boolean; onPress: () => void }) {
  return (
    <PressScale
      onPress={() => {
        hapticTap();
        onPress();
      }}
      scaleTo={0.97}
      style={[s.option, on && s.optionOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle}>{title}</Text>
        <Text style={s.optionSub}>{sub}</Text>
      </View>
      <View style={[s.radio, on && s.radioOn]}>{on && <Check size={14} color="#0a0a0c" strokeWidth={3} />}</View>
    </PressScale>
  );
}

/* ── Pagina 1: grafiek ─────────────────────────────────────────────────── */

/* Grafiek in de stijl van de referentie van de operator (15 okt 2026,
   "flow van grafiek meer zoals in bijlage"): één vloeiende S-lijn over de
   volle breedte met een zachte gloed, van wit (jouw hartslag) naar de kleur
   van de toestand; stippellijnen tussen de fasen; labels met een regel
   eronder. De lijn tekent zich telkens opnieuw bij het wisselen van toestand. */
const AnimatedPath = Animated.createAnimatedComponent(Path);

function RhythmChart({ mode }: { mode: BraceletMode }) {
  const pulse = useRestingPulse();
  /* Nog geen eigen waarde: eerlijk "Average" (operator: "die is niet 70
     standaard he") — stap 3 zet de eigen. */
  const own = pulse.decided && pulse.source !== 'average';
  const { width } = useWindowDimensions();
  const r = rhythmFor(mode, pulse.bpm);
  const meta = getModeMeta(mode);
  const W = width - 80;
  const H = 200;
  /* Hoogte = tempo (sneller = hoger): Boost stijgt, de kalme toestanden
     dalen — met de echte getallen van deze gebruiker.
     Operator, 16 okt 2026 ("zelfde waarde maar visueel diepere curve"): op
     een vaste bpm-schaal was 70 → 56 maar 12 px — bijna vlak. Nu krijgt
     elke overgang een duidelijke diepte (55–100 % van de grafiek, groter
     naarmate het verschil groter is); de getallen in de labels blijven de
     echte. */
  const top = 56;
  const bottom = 150;
  /* Vervolg (operator: "clarity, calm en sleep maken exact dezelfde curve,
     dat mag niet"): diepte recht evenredig met het verschil in bpm — één
     vaste schaal (2,35 px per bpm), zodat Sleep zichtbaar dieper zakt dan
     Clarity en Clarity dieper dan Calm. Dalende toestanden starten altijd
     bovenaan, stijgende onderaan: zo zijn ze onderling te vergelijken. */
  const delta = r.targetBpm - r.startBpm;
  const PX_PER_BPM = (bottom - top) / 40;
  const depth = Math.min(bottom - top, Math.abs(delta) * PX_PER_BPM);
  const yA = delta < 0 ? top : delta > 0 ? bottom : (top + bottom) / 2;
  const yB = delta < 0 ? top + depth : delta > 0 ? bottom - depth : yA;
  const rising = yB < yA;
  const x0 = 10;
  const xe = W - 10;
  const x1 = W / 3;
  const x2 = (2 * W) / 3;
  /* Match (vlak) → Glide (zachte S) → Hold (vlak uitlopend). */
  const d = `M${x0} ${yA} C${x1 * 0.7} ${yA} ${x1 * 0.9} ${yA} ${x1} ${yA + (yB - yA) * 0.08} S${x2 - (x2 - x1) * 0.25} ${yB} ${x2} ${yB - (yB - yA) * 0.04} S${xe - 40} ${yB} ${xe} ${yB}`;
  const LEN = W * 1.25;
  const draw = useSharedValue(0);
  useEffect(() => {
    draw.value = 0;
    draw.value = withTiming(1, { duration: 900 });
  }, [mode, draw]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: LEN * (1 - draw.value) }));
  const startLabelY = rising ? yA + 26 : yA - 30;
  const endLabelY = rising ? yB - 30 : yB + 26;
  return (
    <View style={s.chart}>
      <Svg width={W} height={H}>
        <Defs>
          <SvgLinearGradient id="flow" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.95} />
            <Stop offset="0.45" stopColor={meta.color} stopOpacity={0.9} />
            <Stop offset="1" stopColor={meta.color} stopOpacity={1} />
          </SvgLinearGradient>
        </Defs>
        <Line x1={x1} y1={20} x2={x1} y2={H - 6} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3 5" />
        <Line x1={x2} y1={20} x2={x2} y2={H - 6} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3 5" />
        {/* gloed */}
        <AnimatedPath d={d} stroke={meta.color} strokeOpacity={0.18} strokeWidth={12} fill="none" strokeLinecap="round" strokeDasharray={`${LEN} ${LEN}`} animatedProps={lineProps} />
        <AnimatedPath d={d} stroke="url(#flow)" strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={`${LEN} ${LEN}`} animatedProps={lineProps} />
        <Circle cx={x0} cy={yA} r={8} fill="#ffffff" fillOpacity={0.15} />
        <Circle cx={x0} cy={yA} r={5} fill="#ffffff" />
        <Circle cx={xe} cy={yB} r={9} fill={meta.color} fillOpacity={0.2} />
        <Circle cx={xe} cy={yB} r={5} fill={meta.color} />
        <SvgText x={x0} y={startLabelY} fill="#ffffff" fontSize={14} fontFamily={BrandFonts.semibold}>
          {own ? 'Your heart rate' : 'Average'}
        </SvgText>
        <SvgText x={x0} y={startLabelY + 17} fill="rgba(255,255,255,0.55)" fontSize={12.5} fontFamily={BrandFonts.regular}>
          {`Rhythm starts at ${r.startBpm} bpm`}
        </SvgText>
        <SvgText x={xe} y={endLabelY} fill={meta.color} fontSize={14} fontFamily={BrandFonts.semibold} textAnchor="end">
          {meta.name}
        </SvgText>
        <SvgText x={xe} y={endLabelY + 17} fill="rgba(255,255,255,0.55)" fontSize={12.5} fontFamily={BrandFonts.regular} textAnchor="end">
          {`Rhythm settles at ${r.targetBpm} bpm`}
        </SvgText>
      </Svg>
    </View>
  );
}

function Step({ n, title, text, last = false }: { n: string; title: string; text: string; last?: boolean }) {
  return (
    <View style={s.step}>
      <View style={s.stepRail}>
        <View style={s.stepNum}>
          <Text style={s.stepNumTxt}>{n}</Text>
        </View>
        {!last && <View style={s.stepLine} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 10 }}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepTxt}>{text}</Text>
      </View>
    </View>
  );
}

/* Maten/kleuren 1-op-1 uit breath-welcome.tsx (topbar, step*, skip*,
   header/lead, footer, cta*). */
const s = StyleSheet.create({
  onbEyebrow: { fontFamily: BrandFonts.bold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)', marginTop: 4, marginBottom: 6 },
  /* Smalle strook langs de linkerrand voor de iOS-terugveeg. */
  edgeSwipe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 22 },
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
  chartCard: {
    marginHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  chipsScroll: { flexGrow: 0, marginTop: 22 },
  chips: { paddingHorizontal: 26, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  chipTxt: { fontFamily: BrandFonts.semibold, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  chart: { marginTop: 8, marginBottom: 4, alignItems: 'center' },
  steps: {},
  step: { flexDirection: 'row', gap: 16 },
  stepRail: { alignItems: 'center', width: 28 },
  stepLine: { flex: 1, width: 0, marginVertical: 4, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)' },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumTxt: { fontFamily: BrandFonts.semibold, fontSize: 12.5, color: '#ffffff' },
  stepTitle: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#ffffff', marginTop: 3 },
  stepTxt: { marginTop: 1, fontFamily: BrandFonts.regular, fontSize: 14.5, lineHeight: 20, color: 'rgba(255,255,255,0.62)' },
  /* Ruimte boven en onder (paddingVertical 60) voor de kloppende cirkel én
     de golven die naar buiten lopen (tot 1,45× de cirkel) — die werden
     boven/onder afgesneden. Negatieve marges houden de opmaak gelijk. */
  carousel: { flexGrow: 0, marginTop: -36, marginBottom: -60 },
  stateCircle: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 18 },
  stateName: { fontFamily: BrandFonts.bold, fontSize: 21, color: '#ffffff' },
  stateUse: { fontFamily: BrandFonts.regular, fontSize: 14.5, color: 'rgba(255,255,255,0.62)' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 16 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.25)' },
  /* Protocol: ook het actieve blijft een rond puntje, enkel vol wit (operator). */
  dotOn: { backgroundColor: '#ffffff' },
  info: { marginTop: 22 },
  /* Tekst over twee regels in blok (operator, 15 okt 2026). */
  infoWhat: { fontFamily: BrandFonts.semibold, fontSize: 16, lineHeight: 23, color: '#ffffff', textAlign: 'center' },
  infoTitle: { fontFamily: BrandFonts.regular, fontSize: 16, lineHeight: 23, color: 'rgba(255,255,255,0.7)', marginTop: 2, textAlign: 'center' },
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
  factValue: { marginTop: 2, fontFamily: BrandFonts.semibold, fontSize: 17, color: '#ffffff' },
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
  optionsTight: { marginTop: 4, marginBottom: 28, gap: 10 },
  meterWrap: { flex: 1, justifyContent: 'center' },
  secondaryBtn: { height: 44, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  secondaryTxt: { fontFamily: BrandFonts.semibold, fontSize: 16, color: 'rgba(255,255,255,0.85)' },
  heroWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 14,
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
  ctaShimmer: { position: 'absolute', top: -20, bottom: -20, left: 0, width: 72 },
});
