/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control-onboarding

   Operator, 15 okt 2026: "voor State Control is het heel belangrijk dat
   gebruiker het principe echt begrijpt" — en: "die heartbeat is niet de
   kern, de onderzochte haptics wel. Start idd op uw eigen hartslag, dan
   ... uitleg". Twee schermen, elk met één taak (zelfde opzet als de
   Breathwork-onboarding, breath-welcome.tsx):

     1  DE KERN     Haptiek gebaseerd op onderzoek: een ritme dat je voelt.
                    Trager → tot rust komen, sneller → op gang komen.
                    Meteen VOELEN (Calm Control / Boost) via de bestaande
                    voorproef (playModePreviewHaptic, 30 s, zelfde curve
                    als een sessie) — het beeld klopt op dezelfde klok.
     2  HOE         Het ritme sluit aan bij je eigen hartslag, glijdt naar
                    het tempo van de toestand, en blijft daar. Met jouw
                    eigen getallen (rhythmFor). ENKEL hier staat de
                    hartslag-uitleg (operator: "ik zie 2x ... uitleg").

   Daarna (in de tab) het bestaande "Your Resting Heart Rate"-scherm als
   derde stap, zolang er nog geen keuze is. Woordkeuze: Science A tot Z §6
   (welzijnstaal, de Cornell-zin letterlijk zoals daar goedgekeurd).
   ───────────────────────────────────────────────────────────────────────── */

import { HapticPulseRings, HeartbeatScale } from '@/components/HapticPulseRings';
import { breathWaveLook } from '@/components/LiquidWave';
import PressScale from '@/components/PressScale';
import { BrandFonts } from '@/constants/theme';
import { BraceletMode, getModeMeta } from '@/services/ble-contract';
import {
  PREVIEW_MAX_SECONDS,
  playModePreviewHaptic,
  rhythmFor,
  stopModePreviewHaptic,
} from '@/services/bracelet-haptics';
import { isBraceletSessionMonitorActive } from '@/services/bracelet-session-monitor';
import { useRestingPulse } from '@/components/RhythmSheet';
import { hapticTap } from '@/utils/haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

const DEMO_MODES = [BraceletMode.Alpha, BraceletMode.Gamma] as const;

const CAPTION: Record<(typeof DEMO_MODES)[number], string> = {
  [BraceletMode.Alpha]: 'Slower than your heart. Designed to help you settle',
  [BraceletMode.Gamma]: 'Faster than your heart. Designed to help you get going',
};

type Props = {
  /** Na het laatste scherm. */
  onDone: () => void;
  /** Android-terug op het eerste scherm (bv. terug naar de foto-intro). */
  onBack?: () => void;
  /** Totaal aantal stappen voor de puntjes (3 als het rusthartslag-scherm
   *  nog volgt, anders 2). */
  totalSteps?: number;
  /** Knoptekst op het laatste scherm. */
  finalLabel?: string;
};

export default function StateControlOnboarding({ onDone, onBack, totalSteps = 2, finalLabel = 'Continue' }: Props) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<0 | 1>(0);

  /* Voorproef altijd stoppen bij weggaan van scherm 1 of de onboarding. */
  const [playing, setPlayingState] = useState<BraceletMode | null>(null);
  const playingRef = useRef<BraceletMode | null>(null);
  const setPlaying = useCallback((m: BraceletMode | null) => {
    playingRef.current = m;
    setPlayingState(m);
  }, []);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopDemo = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    if (playingRef.current !== null) stopModePreviewHaptic();
    setPlaying(null);
  }, [setPlaying]);
  useEffect(() => stopDemo, [stopDemo]);

  const goNext = useCallback(() => {
    stopDemo();
    if (page === 0) setPage(1);
    else onDone();
  }, [page, onDone, stopDemo]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 1) {
        setPage(0);
        return true;
      }
      if (onBack) {
        stopDemo();
        onBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [page, onBack, stopDemo]);

  return (
    <View style={s.root}>
      <View style={[s.content, { paddingTop: insets.top + 28 }]}>
        {page === 0 ? (
          <Animated.View key="p0" entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)} style={s.page}>
            <FeelPage playing={playing} setPlaying={setPlaying} stopTimer={stopTimer} />
          </Animated.View>
        ) : (
          <Animated.View key="p1" entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)} style={s.page}>
            <HowPage />
          </Animated.View>
        )}
      </View>
      <View style={[s.actions, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <Dots total={totalSteps} index={page} />
        <PressScale style={s.cta} haptic scaleTo={0.97} onPress={goNext} accessibilityRole="button">
          <Text style={s.ctaTxt}>{page === 0 ? 'Continue' : finalLabel}</Text>
        </PressScale>
      </View>
    </View>
  );
}

/* ── 1 · De kern: haptiek die je voelt ─────────────────────────────────── */

function FeelPage({
  playing,
  setPlaying,
  stopTimer,
}: {
  playing: BraceletMode | null;
  setPlaying: (m: BraceletMode | null) => void;
  stopTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const { height } = useWindowDimensions();
  const size = Math.round(Math.max(130, Math.min(190, height * 0.21)));
  const [selected, setSelected] = useState<(typeof DEMO_MODES)[number]>(BraceletMode.Alpha);
  /* Een lopende sessie nooit onderbreken (Settings → intro opnieuw tijdens
     een sessie): dan enkel de uitleg, geen voorproef. */
  const busy = isBraceletSessionMonitorActive();
  const meta = getModeMeta(selected);
  const tint = breathWaveLook(meta.color).color;

  const play = (mode: (typeof DEMO_MODES)[number]) => {
    hapticTap();
    setSelected(mode);
    if (busy) return;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    playModePreviewHaptic(mode);
    setPlaying(mode);
    stopTimer.current = setTimeout(() => setPlaying(null), PREVIEW_MAX_SECONDS * 1000);
  };

  return (
    <>
      <Text style={s.title}>Haptics Built{'\n'}on Research</Text>
      <Text style={s.body}>
        A rhythm you feel on your skin can shift how you feel. Slower helps you settle. Faster helps you get going.
      </Text>
      <View style={s.stageArea}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <HapticPulseRings size={size} color={tint} beatSynced />
          <HeartbeatScale size={size}>
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: `${meta.color}22`,
                borderWidth: 2,
                borderColor: tint,
              }}
            />
          </HeartbeatScale>
        </View>
        <Text style={s.caption}>
          {busy
            ? 'Available when no session is running'
            : playing !== null
              ? CAPTION[selected]
              : 'Tap a state and feel it on your phone'}
        </Text>
      </View>
      <View style={s.seg}>
        {DEMO_MODES.map((m) => {
          const mm = getModeMeta(m);
          const on = selected === m && (playing !== null || busy);
          return (
            <Pressable
              key={m}
              onPress={() => play(m)}
              style={({ pressed }) => [
                s.segBtn,
                on && { backgroundColor: mm.color, borderColor: mm.color },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Feel ${mm.name}`}
            >
              <Text style={[s.segTxt, on && { color: '#0a0a0a' }]}>{mm.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.footnote}>
        In a Cornell study, a slow heartbeat rhythm from a smartwatch helped people stay calmer under pressure.
      </Text>
    </>
  );
}

/* ── 2 · Hoe een sessie verloopt ───────────────────────────────────────── */

function HowPage() {
  const pulse = useRestingPulse();
  const { width } = useWindowDimensions();
  const calm = rhythmFor(BraceletMode.Alpha, pulse.bpm);
  const calmColor = getModeMeta(BraceletMode.Alpha).color;
  const W = Math.min(width - 56, 340);
  const H = 132;
  const yTop = 34;
  const yLow = 88;
  const x0 = 8;
  const x1 = W * 0.3;
  const x2 = W * 0.62;
  const xe = W - 8;
  const d = `M${x0} ${yTop} L${x1} ${yTop} C${x1 + (x2 - x1) * 0.5} ${yTop} ${x1 + (x2 - x1) * 0.5} ${yLow} ${x2} ${yLow} L${xe} ${yLow}`;

  return (
    <>
      <Text style={s.title}>It Meets You{'\n'}Where You Are</Text>
      <View style={[s.stageArea, { flex: 0, marginTop: 26, marginBottom: 18 }]}>
        <Svg width={W} height={H}>
          <Line x1={x0} y1={H - 18} x2={xe} y2={H - 18} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          <Path d={d} stroke={calmColor} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Circle cx={x0} cy={yTop} r={5} fill="#ffffff" />
          <Circle cx={xe} cy={yLow} r={5} fill={calmColor} />
          <SvgText x={x0} y={yTop - 14} fill="#ffffff" fontSize={12.5} fontFamily={BrandFonts.semibold}>
            {`Your heart rate · ${calm.startBpm} bpm`}
          </SvgText>
          <SvgText x={xe} y={yLow + 22} fill={calmColor} fontSize={12.5} fontFamily={BrandFonts.semibold} textAnchor="end">
            {`Calm Control · ${calm.targetBpm} bpm`}
          </SvgText>
          <SvgText x={(x0 + x1) / 2} y={H - 3} fill="rgba(255,255,255,0.45)" fontSize={11} fontFamily={BrandFonts.medium} textAnchor="middle">
            1
          </SvgText>
          <SvgText x={(x1 + x2) / 2} y={H - 3} fill="rgba(255,255,255,0.45)" fontSize={11} fontFamily={BrandFonts.medium} textAnchor="middle">
            2
          </SvgText>
          <SvgText x={(x2 + xe) / 2} y={H - 3} fill="rgba(255,255,255,0.45)" fontSize={11} fontFamily={BrandFonts.medium} textAnchor="middle">
            3
          </SvgText>
        </Svg>
      </View>
      <View style={s.steps}>
        <Step n="1" title="Match" text="The rhythm starts at your own heart rate, so it feels familiar." />
        <Step n="2" title="Glide" text="It slowly moves to the tempo of the state you chose." />
        <Step n="3" title="Hold" text="It stays there until your session ends." />
      </View>
    </>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <View style={s.step}>
      <Text style={s.stepN}>{n}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepTxt}>{text}</Text>
      </View>
    </View>
  );
}

function Dots({ total, index }: { total: number; index: number }) {
  return (
    <View style={s.dots} accessibilityLabel={`Step ${index + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[s.dot, i === index && s.dotOn]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { flex: 1, paddingHorizontal: 28 },
  page: { flex: 1, alignItems: 'center' },
  title: {
    marginTop: 8,
    fontFamily: BrandFonts.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
    color: '#ffffff',
    textAlign: 'center',
  },
  body: {
    marginTop: 16,
    maxWidth: 330,
    fontFamily: BrandFonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
  },
  stageArea: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 170 },
  caption: {
    marginTop: 22,
    minHeight: 40,
    maxWidth: 300,
    fontFamily: BrandFonts.medium,
    fontSize: 14.5,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  seg: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  segBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segTxt: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff' },
  footnote: {
    marginTop: 14,
    maxWidth: 320,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'center',
  },
  steps: { alignSelf: 'stretch', gap: 16 },
  step: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepN: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 28,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  stepTitle: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#ffffff' },
  stepTxt: { marginTop: 2, fontFamily: BrandFonts.regular, fontSize: 14.5, lineHeight: 20, color: 'rgba(255,255,255,0.66)' },
  actions: { paddingHorizontal: 24, paddingTop: 18 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { width: 18, backgroundColor: '#ffffff' },
  cta: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#1D1D1F' },
});
