/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — algemene uitleg (vóór het welkomstscherm, enkel de eerste keer)

   Operator, 25 okt 2026: "een onboarding voor de algemene app zodat gebruikers begrijpen wat de app
   en de onderdelen doen, en daarna naar het welkomstscherm". Vijf korte schermen (belofte, State Control,
   Breathwork, Audio Library, start). Teksten zijn van de operator (letterlijk overgenomen).
   Skip staat altijd boven; De laatste knop ("Continue") opent het welkomstscherm. Geen poort: niets wordt gevraagd.

   Regels: UI_EN_BEWEGINGSREGELS.md — cascade van onderen (`reveal(i)`), geen zijwaartse paginaschuif, ronde
   glazen knop van 52 dp. Eenmaal gezien = `appIntroSeenAt` (settings); de root-layout (_layout.tsx) beslist
   op een koude start: intro (nog niet gezien) of welkomstscherm.
   ───────────────────────────────────────────────────────────────────────── */

import BalancedText from '@/components/BalancedText';
import PressScale from '@/components/PressScale';
import Tap from '@/components/Tap';
import VibezGlass from '@/components/VibezGlass';
import { Brand, BrandFonts, CTA_GLASS, CTA_GLOW, TypeScale } from '@/constants/theme';
import { isReduceMotion, reveal } from '@/constants/motion';
import { qaFlag } from '@/utils/qa-probe';
import { setSetting } from '@/utils/settings';
import { getBreathHistory } from '@/utils/breath-history';
import { mayAutoShowOnboarding } from '@/utils/onboarding-gate';
import { SafeAreaView, useSafeAreaInsets } from '@/utils/safe-area';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AudioLines, ChevronLeft, ChevronRight, Radio, Wind } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, type ImageSourcePropType, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { imageSource } from '@/utils/image-source';
import Animated, { Easing, FadeIn, interpolate, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

type Step = {
  key: string;
  eyebrow: string;
  title: string;
  /** Subkop: de eerste, lichtere regel onder de kop. */
  sub: string;
  body: string;
  note?: string;
  /** Achtergrondfoto (dezelfde als de intro van het tabblad). */
  photo?: string;
  /** hoogte / breedte van de foto (gemeten). */
  photoRatio?: number;
  /** Liggende foto: vult 55% van de schermhoogte en glijdt traag van links naar rechts (drifting → directing). */
  pan?: boolean;
  /** Telefoon-mockup met echte schermen van de app (wisselt elke paar seconden) in plaats van een foto. */
  mock?: { kind: 'state' | 'breath' | 'audio'; accent: string; steps?: { src: ImageSourcePropType; ms: number; tap?: { x: number; y: number } }[] };
  Icon?: typeof Radio;
};

/* [OPERATOR]-teksten (25 okt 2026, tweede versie), in drie niveaus: kop (twee regels), subkop, body. Scherm 5 sluit de uitleg af.
   De verdeling in subkop/body is van de operator voor scherm 1 en 2; bij 3, 4 en 5 is ze een voorstel (tekst zelf ongewijzigd,
   behalve het streepje op scherm 4). */
const STEPS: Step[] = [
  {
    key: 'promise',
    eyebrow: 'WELCOME',
    title: 'Stop being a passenger\nin your own life.',
    sub: 'Take an active role in how you feel, think and respond.',
    photo: 'https://vibezcore-audio.b-cdn.net/images/pic%20origin%20stop%20drifting%20start%20directing.png',
    photoRatio: 819 / 1920,
    pan: true,
    body:
      'VIBEZCORE brings together haptic State Control, Guided Breathwork and powerful ideas from history’s greatest minds to help you guide your state each day, find inner balance and grow over time.',
  },
  {
    key: 'state',
    eyebrow: 'STATE CONTROL',
    title: 'Feel the pulse.\nFeel the shift.',
    sub: 'Choose the state you want to move toward.',
    body:
      'Research-based, bottom-up haptic pulse patterns deliver vibrations through your phone or smartwatch, guiding your nervous system from stress toward calm or focus, or toward energy or sleep.',
    note: 'Smart bead bracelet support coming soon.',
    mock: { kind: 'state', accent: '#F5A524' }, // State Control · Boost: tijd instellen, dan pulseren (levend)
    Icon: Radio,
  },
  {
    key: 'breath',
    eyebrow: 'GUIDED BREATHWORK',
    title: 'Follow the cues.\nLet your breathing lead.',
    sub: 'Clear spoken guidance and haptic cues help you follow each breath through your phone or smartwatch.',
    body: 'Use established breathing techniques to guide your state toward calm, focus, energy or sleep.',
    note: 'Smart bead bracelet support coming soon.',
    mock: { kind: 'breath', accent: '#FFFFFF' }, // Breathwork · Clarity & Relax: ademt (levend)
    Icon: Wind,
  },
  {
    key: 'audio',
    eyebrow: 'AUDIO LIBRARY',
    title: 'Learn from the minds\nthat changed how we see the world.',
    sub: 'We turn the enduring ideas of history’s greatest minds into clear, structured audio sessions you can understand, apply and return to.',
    body: 'So insight can become lasting personal growth.',
    mock: {
      kind: 'audio',
      accent: '#00A3A3',
      // pilaren -> pilaar 1 -> scrollen naar The Inner Child (Carl Jung) -> aantikken -> speler
      steps: [
        { src: require('../../assets/intro/audio1.jpg'), ms: 3000, tap: { x: 0.249, y: 0.4217 } },
        { src: require('../../assets/intro/audio_p1.jpg'), ms: 2200 },
        { src: require('../../assets/intro/audio_p2.jpg'), ms: 3200, tap: { x: 0.357, y: 0.8426 } },
        { src: require('../../assets/intro/audio3.jpg'), ms: 3600 },
      ],
    },
    Icon: AudioLines,
  },
  {
    key: 'start',
    eyebrow: 'START',
    title: 'Your life.\nYour next move.',
    sub: 'Choose what you need right now.',
    body: 'State Control, Guided Breathwork or the Audio Library.',
    note: 'All in one app.', // [TEKST] concept — "alles inbegrepen": bewust niet "all included" (een gratis bezoeker krijgt per onderdeel één gratis sessie)
    photo: 'https://vibezcore-audio.b-cdn.net/images/pic%20your%20plan%20app.png',
    photoRatio: 1670 / 942,
  },
];

/* Telefoon met schermen van de app: staat stil. State Control en Breathwork zijn LEVENDE nabootsingen van de echte schermen (tijd instellen, dan pulseren /
   ademen); de Audio Library toont echte schermen met een tik op The Inner Child. Het frame is bewust neutraal (geen Dynamic Island of ander Apple-ontwerp) en er
   staat niets in dat de app niet echt doet. Alles blijft onder 1 Hz en staat stil bij "beweging verminderen". */
function PhoneMockup({ mock, height }: { mock: NonNullable<Step['mock']>; height: number }) {
  const width = Math.round(height * (540 / 1047) + 14);
  const w = width - 17;
  const h = height - 17;
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      {mock.kind === 'audio' ? <SoundBars color={mock.accent} width={width} /> : null}
      {mock.kind === 'state' ? <PulseRings color={mock.accent} size={width} period={1700} /> : null}
      <View style={[s.phone, { width, height }]}>
        <View style={s.phoneScreen}>
          {mock.kind === 'state' ? <StateScene w={w} h={h} accent={mock.accent} /> : null}
          {mock.kind === 'breath' ? <BreathScene w={w} h={h} /> : null}
          {mock.kind === 'audio' && mock.steps ? <AudioScene w={w} h={h} steps={mock.steps} /> : null}
        </View>
      </View>
    </View>
  );
}

function useTick(ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (isReduceMotion()) return undefined;
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}
const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/* State Control · Boost: eerst de tijd in de cirkel instellen (05:00 -> 10:00), dan Start: de cirkel klopt (hartslag-patroon) met ringen en de tijd telt af. */
function StateScene({ w, h, accent }: { w: number; h: number; accent: string }) {
  const n = useTick(100);
  const t = (n * 0.1) % 12.5;
  const running = t >= 3.6;
  const left = running ? 600 - Math.floor(t - 3.6) : Math.min(10, 5 + Math.floor(t / 0.6)) * 60;
  const beat = useSharedValue(1);
  useEffect(() => {
    if (!running || isReduceMotion()) {
      beat.value = withTiming(1, { duration: 200 });
      return;
    }
    beat.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 110 }),
        withTiming(1, { duration: 130 }),
        withTiming(1.05, { duration: 110 }),
        withTiming(1, { duration: 150 }),
        withDelay(400, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [running, beat]);
  const beatStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  const d = Math.round(w * 0.74);
  return (
    <View style={{ width: w, height: h, backgroundColor: '#120d04' }}>
      <View style={{ position: 'absolute', top: h * 0.045, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: accent }} />
        <Text style={{ color: '#fff', fontFamily: BrandFonts.bold, fontSize: Math.round(w * 0.075) }}>Boost</Text>
      </View>
      <View style={{ position: 'absolute', top: h * 0.14, left: (w - d) / 2, width: d, height: d }}>
        {running ? <PulseRings color={accent} size={d * 0.9} period={900} /> : null}
        <Animated.View
          style={[{ width: d, height: d, borderRadius: d / 2, borderWidth: 2, borderColor: accent, backgroundColor: 'rgba(245,165,36,0.2)', alignItems: 'center', justifyContent: 'center' }, beatStyle]}
        >
          <Text style={{ color: '#fff', fontFamily: BrandFonts.extrabold, fontSize: Math.round(d * 0.25), letterSpacing: -1 }}>{mmss(left)}</Text>
          {!running ? <Text style={{ color: 'rgba(245,165,36,0.9)', fontFamily: BrandFonts.medium, fontSize: Math.round(w * 0.06), marginTop: 4 }}>Recommended</Text> : null}
        </Animated.View>
      </View>
      {running ? (
        <View style={{ position: 'absolute', bottom: h * 0.07, left: 0, right: 0, alignItems: 'center', gap: 10 }}>
          <View style={{ width: h * 0.1, height: h * 0.1, borderRadius: h * 0.05, backgroundColor: 'rgba(245,165,36,0.6)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
            <View style={{ width: 4, height: h * 0.035, backgroundColor: '#fff', borderRadius: 2 }} />
            <View style={{ width: 4, height: h * 0.035, backgroundColor: '#fff', borderRadius: 2 }} />
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: BrandFonts.bold, fontSize: Math.round(w * 0.05), letterSpacing: 1.5 }}>END SESSION</Text>
        </View>
      ) : (
        <View style={{ position: 'absolute', bottom: h * 0.07, left: w * 0.08, right: w * 0.08, height: h * 0.075, borderRadius: 999, backgroundColor: 'rgba(245,165,36,0.28)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontFamily: BrandFonts.bold, fontSize: Math.round(w * 0.075) }}>Start Boost</Text>
        </View>
      )}
    </View>
  );
}

/* Breathwork · Clarity & Relax: de figuur ademt in en uit (4 s / 4 s) met de teller en de tekst zoals in de sessie. */
function BreathScene({ w, h }: { w: number; h: number }) {
  const n = useTick(100);
  const t = (n * 0.1) % 8;
  const inhale = t < 4;
  const value = Math.max(0, inhale ? 4 - t : 4 - (t - 4)).toFixed(1);
  const k = useSharedValue(0.78);
  useEffect(() => {
    if (isReduceMotion()) {
      k.value = 0.95;
      return;
    }
    k.value = 0.78;
    k.value = withRepeat(
      withSequence(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }), withTiming(0.78, { duration: 4000, easing: Easing.inOut(Easing.sin) })),
      -1,
      false,
    );
  }, [k]);
  const figStyle = useAnimatedStyle(() => ({ transform: [{ scale: k.value }], opacity: 0.6 + (k.value - 0.78) * 1.8 }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.1 + (k.value - 0.78) * 0.9, transform: [{ scale: 0.8 + (k.value - 0.78) * 1.1 }] }));
  const fig = Math.round(w * 0.82);
  return (
    <View style={{ width: w, height: h, backgroundColor: '#08080a' }}>
      <View style={{ position: 'absolute', top: h * 0.04, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontFamily: BrandFonts.extrabold, fontSize: Math.round(w * 0.07), letterSpacing: 1 }}>CLARITY &amp; RELAX</Text>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontFamily: BrandFonts.medium, fontSize: Math.round(w * 0.055), marginTop: 2 }}>Equal Breathing</Text>
      </View>
      <View style={{ position: 'absolute', top: h * 0.12, left: (w - fig) / 2, width: fig, height: fig, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', width: fig, height: fig, borderRadius: fig / 2, backgroundColor: 'rgba(190,200,220,0.35)' }, glowStyle]} />
        <Animated.Image
          source={imageSource('https://vibezcore-audio.b-cdn.net/images/pic%20calm%20relax%202.png')}
          style={[{ width: fig * 0.9, height: fig * 0.9 }, figStyle]}
          resizeMode="contain"
        />
      </View>
      <View style={{ position: 'absolute', top: h * 0.56, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontFamily: BrandFonts.extrabold, fontSize: Math.round(w * 0.2), letterSpacing: -1 }}>{value}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: BrandFonts.medium, fontSize: Math.round(w * 0.04) }}>SEC</Text>
        <Text style={{ color: '#fff', fontFamily: BrandFonts.bold, fontSize: Math.round(w * 0.065), letterSpacing: 0.8, marginTop: 6 }}>{inhale ? 'INHALE · NOSE' : 'EXHALE · NOSE'}</Text>
      </View>
      <View style={{ position: 'absolute', bottom: h * 0.06, left: 0, right: 0, alignItems: 'center', gap: 8 }}>
        <View style={{ width: h * 0.09, height: h * 0.09, borderRadius: h * 0.045, backgroundColor: 'rgba(120,135,160,0.7)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
          <View style={{ width: 4, height: h * 0.032, backgroundColor: '#fff', borderRadius: 2 }} />
          <View style={{ width: 4, height: h * 0.032, backgroundColor: '#fff', borderRadius: 2 }} />
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: BrandFonts.bold, fontSize: Math.round(w * 0.045), letterSpacing: 1.5 }}>END SESSION</Text>
      </View>
    </View>
  );
}

/* Audio Library: pilaren -> pilaar -> scrollen naar The Inner Child -> aantikken -> de sessie speelt. Echte schermen, met een tik-aanwijzer. */
function AudioScene({ w, h, steps }: { w: number; h: number; steps: NonNullable<Step['mock']>['steps'] }) {
  const list = steps ?? [];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (isReduceMotion() || list.length < 2) return undefined;
    const id = setTimeout(() => setIdx((i) => (i + 1) % list.length), list[idx].ms);
    return () => clearTimeout(id);
  }, [idx, list]);
  return (
    <View style={{ width: w, height: h }}>
      {list.map((st, i) => (
        <PhoneLayer key={i} src={st.src} active={idx === i} w={w} h={h} />
      ))}
      {list[idx]?.tap ? <TapHint key={idx} x={list[idx].tap!.x * w} y={list[idx].tap!.y * h} /> : null}
    </View>
  );
}
function TapHint({ x, y }: { x: number; y: number }) {
  const k = useSharedValue(0);
  useEffect(() => {
    k.value = withDelay(900, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [k]);
  const style = useAnimatedStyle(() => ({ opacity: k.value === 0 ? 0 : 0.85 * (1 - k.value), transform: [{ scale: 0.5 + k.value * 1.1 }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x - 17, top: y - 17, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 2, borderColor: '#fff' }, style]}
    />
  );
}

/* Pulsen: drie ringen die uit het midden golven. Nooit sneller dan 1 Hz per ring. */
function PulseRings({ color, size, period }: { color: string; size: number; period: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[0, 1, 2].map((i) => (
        <PulseRing key={i} color={color} size={size} period={period} delay={(period / 3) * i} />
      ))}
    </View>
  );
}
function PulseRing({ color, size, period, delay }: { color: string; size: number; period: number; delay: number }) {
  const k = useSharedValue(0);
  useEffect(() => {
    if (isReduceMotion()) {
      k.value = 0.35;
      return;
    }
    k.value = withDelay(delay, withRepeat(withTiming(1, { duration: period, easing: Easing.out(Easing.quad) }), -1, false));
  }, [k, period, delay]);
  const style = useAnimatedStyle(() => ({ opacity: (1 - k.value) * 0.55, transform: [{ scale: 0.85 + k.value * 0.95 }] }));
  const d = Math.round(size * 1.15);
  return (
    <Animated.View
      style={[{ position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -d / 2, width: d, height: d, borderRadius: d / 2, borderWidth: 2, borderColor: color }, style]}
    />
  );
}

/* Geluidsfrequentie: staafjes die op en neer gaan, vanuit het midden, achter de telefoon. */
function SoundBars({ color, width }: { color: string; width: number }) {
  const n = 21;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -60, right: -60, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {Array.from({ length: n }).map((_, i) => (
        <SoundBar key={i} color={color} i={i} n={n} max={Math.round(width * 1.1)} />
      ))}
    </View>
  );
}
function SoundBar({ color, i, n, max }: { color: string; i: number; n: number; max: number }) {
  const hh = useSharedValue(0.25);
  const mid = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
  useEffect(() => {
    if (isReduceMotion()) {
      hh.value = 0.25 + mid * 0.4;
      return;
    }
    const lo = 0.12 + mid * 0.1;
    const hi = 0.35 + mid * 0.65;
    hh.value = withDelay(
      (i * 97) % 600,
      withRepeat(
        withSequence(
          withTiming(hi, { duration: 380 + ((i * 53) % 320), easing: Easing.inOut(Easing.quad) }),
          withTiming(lo, { duration: 420 + ((i * 71) % 300), easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [hh, i, mid]);
  const style = useAnimatedStyle(() => ({ height: Math.max(6, hh.value * max) }));
  return <Animated.View style={[{ width: 6, borderRadius: 3, backgroundColor: color, opacity: 0.55 }, style]} />;
}

function PhoneLayer({ src, active, w, h }: { src: ImageSourcePropType; active: boolean; w: number; h: number }) {
  const o = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    o.value = withTiming(active ? 1 : 0, { duration: 600, easing: Easing.inOut(Easing.quad) });
  }, [active, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image source={src} style={{ width: w, height: h }} resizeMode="cover" />
    </Animated.View>
  );
}

const enter = (i: number) => reveal(i);

export default function IntroScreen() {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const cur = STEPS[step];
  qaFlag('intro', { step, last: STEPS.length - 1 });

  /* Gezien (ook bij Skip) → nooit meer vanzelf; daarna het welkomstscherm. */
  /* replay=1 (Settings → Introduction): opnieuw bekijken en terug naar Settings, niet naar het welkomstscherm. */
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const finish = () => {
    if (replay === '1') {
      if (router.canGoBack()) router.back();
      else router.replace('/settings' as never);
      return;
    }
    void setSetting('appIntroSeenAt', Date.now());
    router.replace('/welcome' as never);
  };
  /* Laatste scherm = de keuze (operator, 25 okt 2026): wie kiest komt meteen in het tabblad waar de onboarding van dat onderdeel begint
     (dezelfde regels als het welkomstscherm). Bij opnieuw bekijken (Settings) gaat elke keuze gewoon terug. */
  const choose = (key: 'state' | 'breath' | 'audio') => {
    if (replay === '1') {
      finish();
      return;
    }
    void setSetting('appIntroSeenAt', Date.now());
    const showBreathOnboarding = mayAutoShowOnboarding('breath') && getBreathHistory().length === 0;
    router.replace((key === 'state' ? '/bracelet' : key === 'breath' ? (showBreathOnboarding ? '/breath-welcome' : '/breath') : '/') as never);
  };
  const next = () => (last ? finish() : setStep(step + 1));
  const back = () => setStep(Math.max(0, step - 1));
  const Icon = cur.Icon;
  /* Lichtflits over de knop op het eerste scherm — hetzelfde recept als de onboardings (pauze 2,6 s, veeg 1,1 s, rust 1,2 s). */
  const [ctaWidth, setCtaWidth] = useState(300);
  const ctaShimmer = useSharedValue(-1);
  useEffect(() => {
    ctaShimmer.value = withRepeat(withSequence(withTiming(-1, { duration: 0 }), withDelay(2600, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })), withDelay(1200, withTiming(1, { duration: 0 }))), -1, false);
  }, [ctaShimmer]);
  const ctaShimmerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(ctaShimmer.value, [-1, 1], [-70, ctaWidth + 40]) }, { rotate: '18deg' }] }));
  /* Foto op volle schermbreedte met een vaste breedte en hoogte (zoals de Audio Library-tab); de verhouding is per foto gemeten. */
  const { width: winW } = useWindowDimensions();
  const { height: winH } = useWindowDimensions();
  /* Liggende foto (pan): 55% van de schermhoogte, breedte volgt de verhouding; glijdt één keer van links naar rechts. */
  const photoH = cur.photo ? (cur.pan ? Math.round(winH * 0.55) : Math.round(winW * (cur.photoRatio ?? 1.5))) : 0;
  const photoW = winW;
  /* Eerste scherm: de brede foto begint volledig (de buitenste mensen = het begin: drifting) en zoomt langzaam naar binnen op de twee in het midden (directing). */
  const zoom = useSharedValue(1);
  const stripH = Math.round(winW * (cur.photoRatio ?? 0.43));
  const zoomTo = Math.min(3, Math.max(1, (photoH / Math.max(1, stripH)) * 0.92));
  useEffect(() => {
    zoom.value = 1;
    if (cur.pan) zoom.value = isReduceMotion() ? zoomTo : withDelay(900, withTiming(zoomTo, { duration: 8000, easing: Easing.inOut(Easing.cubic) }));
  }, [cur.pan, zoomTo, zoom]);
  const panStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  /* Telefoon: 54% van de schermhoogte, onderaan zacht naar zwart onder de tekst. */
  const insets = useSafeAreaInsets();
  const phoneH = Math.round(winH * 0.5);
  const phoneTop = Math.round(insets.top + 58); // onder de bovenbalk (Back / stap / Skip)
  const ctaLabel = step === 0 ? 'Get started' : last ? 'Start exploring' : 'Next'; // [TEKST] concept: slotknop belooft iets (was 'Continue')

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      {cur.mock ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient colors={[cur.mock.accent + '30', 'rgba(10,10,10,0)']} locations={[0, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(winH * 0.7) }} />
          <Animated.View key={cur.key} entering={FadeIn.duration(450)} style={{ position: 'absolute', top: phoneTop, left: 0, right: 0, alignItems: 'center' }}>
            <PhoneMockup mock={cur.mock} height={phoneH} />
          </Animated.View>
          <LinearGradient
            colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.75)', 'rgba(10,10,10,0.97)', '#0a0a0a']}
            locations={[0, 0.4, 0.75, 1]}
            style={{ position: 'absolute', left: 0, right: 0, top: Math.round(phoneTop + phoneH * 0.35), height: Math.round(phoneH * 0.75) }}
          />
        </View>
      ) : null}
      {cur.photo ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* De foto op volle breedte in zijn eigen verhouding (2:3, 4:5, 9:16), onderaan zacht naar zwart waar de tekst staat. */}
          <Animated.View key={cur.key} entering={FadeIn.duration(450)} style={StyleSheet.absoluteFill}><Animated.View style={cur.pan ? [panStyle, { position: 'absolute', top: Math.round((photoH - stripH) / 2), left: 0, width: winW, height: stripH }] : undefined}><Image source={imageSource(cur.photo)} style={[cur.pan ? undefined : s.photo, { width: photoW, height: cur.pan ? stripH : photoH }]} resizeMode="cover" /></Animated.View></Animated.View>
          <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']} locations={[0, 1]} style={s.topFade} />
          <LinearGradient
            colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.7)', 'rgba(10,10,10,0.96)', '#0a0a0a']}
            locations={[0, 0.45, 0.8, 1]}
            style={{ position: 'absolute', left: 0, right: 0, top: Math.round(photoH * 0.3), height: Math.round(photoH * 0.7) + 2 }}
          />
        </View>
      ) : null}
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.topbar}>
          <View style={s.side}>
            {step > 0 ? (
              <Tap onPress={back} hitSlop={14} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
                <ChevronLeft size={18} color={Brand.textDim} strokeWidth={2.2} />
                <Text style={s.backTxt}>Back</Text>
              </Tap>
            ) : null}
          </View>
          <View style={s.center} pointerEvents="none">
            <Text style={s.stepEyebrow}>{`${step + 1} OF ${STEPS.length}`}</Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
            </View>
          </View>
          <View style={[s.side, { alignItems: 'flex-end' }]}>
            <Tap onPress={finish} hitSlop={14} style={s.skipWrap} accessibilityRole="button" accessibilityLabel="Skip introduction">
              <Text style={s.skipTxt}>Skip</Text>
            </Tap>
          </View>
        </View>

        <ScrollView
          key={step}
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, (cur.photo || cur.mock) && s.contentBottom]}
          alwaysBounceVertical={false}
          showsVerticalScrollIndicator={false}
        >
          {Icon && !cur.photo && !cur.mock ? (
            <Animated.View entering={enter(0)} style={s.iconWrap}>
              <VibezGlass radius={44} level="normal" style={StyleSheet.absoluteFill} />
              <Icon size={34} color="#ffffff" strokeWidth={1.8} />
            </Animated.View>
          ) : null}
          <Animated.View entering={enter(1)}>
            <Text style={s.eyebrow}>{cur.eyebrow}</Text>
            <Text style={[s.title, !Icon && s.titleBig]}>{cur.title}</Text>
          </Animated.View>
          <Animated.View entering={enter(2)}>
            <BalancedText style={s.sub}>{cur.sub}</BalancedText>
          </Animated.View>
          <Animated.View entering={enter(3)}>
            <BalancedText style={s.body}>{cur.body}</BalancedText>
            {cur.note ? <Text style={s.note}>{cur.note}</Text> : null}
          </Animated.View>
        </ScrollView>

        <View style={s.footer}>
          {last ? (
            <Animated.View key="choices" entering={enter(4)} style={{ gap: 10 }}>
              {([
                { key: 'state', label: 'State Control', Icon: Radio },
                { key: 'breath', label: 'Guided Breathwork', Icon: Wind },
                { key: 'audio', label: 'Audio Library', Icon: AudioLines },
              ] as const).map((c) => (
                <PressScale key={c.key} onPress={() => choose(c.key)} scaleTo={0.97} style={s.choice} accessibilityRole="button" accessibilityLabel={`CTA ${c.label}`}>
                  <VibezGlass radius={999} level="normal" style={StyleSheet.absoluteFill} />
                  <c.Icon size={20} color="#ffffff" strokeWidth={1.6} />
                  <Text style={s.choiceTxt}>{c.label}</Text>
                  <ChevronRight size={19} color="rgba(255,255,255,0.85)" strokeWidth={1.6} />
                </PressScale>
              ))}
            </Animated.View>
          ) : (
            <Animated.View key={step} entering={enter(4)}>
              <PressScale onPress={next} scaleTo={0.97} style={s.ctaWrap} accessibilityRole="button" accessibilityLabel={`CTA ${ctaLabel}`}>
                <View style={[s.cta, { overflow: 'hidden' }]} onLayout={(e) => setCtaWidth(e.nativeEvent.layout.width)}>
                  <Text style={s.ctaTxt}>{ctaLabel}</Text>
                  {step === 0 ? (
                    <Animated.View style={[s.ctaShimmer, ctaShimmerStyle]} pointerEvents="none">
                      <LinearGradient colors={['#ffffff00', '#ffffff5c', '#ffffff00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                    </Animated.View>
                  ) : null}
                </View>
              </PressScale>
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  safe: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  side: { minWidth: 64 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 4, alignSelf: 'flex-start' },
  backTxt: { color: Brand.textDim, fontFamily: BrandFonts.medium, fontSize: 14 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  stepEyebrow: { marginTop: 2, color: '#ffffff', fontFamily: BrandFonts.bold, fontSize: 9, letterSpacing: 2 },
  track: { width: 120, height: 1.5, borderRadius: 0.75, marginTop: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.15)' },
  fill: { height: '100%', borderRadius: 0.75, backgroundColor: '#ffffff' },
  skipWrap: { paddingVertical: 6, paddingHorizontal: 8 },
  skipTxt: { color: 'rgba(255,255,255,0.92)', fontFamily: BrandFonts.semibold, fontSize: 15 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingBottom: 24, gap: 18 },
  photo: { position: 'absolute', top: 0, left: 0, right: 0 },
  phone: { borderRadius: 34, backgroundColor: '#0c0c0e', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', padding: 7, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 12 },
  phoneScreen: { flex: 1, borderRadius: 27, overflow: 'hidden', backgroundColor: '#0a0a0a' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  contentBottom: { justifyContent: 'flex-end' },
  iconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 },
  eyebrow: { fontFamily: BrandFonts.bold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)', marginBottom: 6 },
  title: { ...TypeScale.pageHeader, fontFamily: BrandFonts.bold, fontSize: 25, lineHeight: 31, textAlign: 'left', color: Brand.text },
  titleBig: { fontFamily: BrandFonts.bold, fontSize: 27, lineHeight: 33 },
  note: { marginTop: 14, fontFamily: BrandFonts.medium, fontSize: 13, letterSpacing: 0.2, color: 'rgba(255,255,255,0.5)' },
  sub: { marginTop: 2, fontFamily: BrandFonts.semibold, fontSize: 17, lineHeight: 24, textAlign: 'left', color: 'rgba(255,255,255,0.92)' },
  body: { marginTop: 10, fontFamily: BrandFonts.regular, fontSize: 14.5, lineHeight: 21, textAlign: 'left', color: 'rgba(255,255,255,0.6)' },
  footer: { paddingHorizontal: 26, paddingBottom: 32, paddingTop: 12 },
  ctaWrap: { borderRadius: 999, backgroundColor: CTA_GLASS, ...CTA_GLOW },
  cta: { alignItems: 'center', justifyContent: 'center', borderRadius: 999, height: 52 },
  ctaShimmer: { position: 'absolute', top: -20, bottom: -20, left: 0, width: 72 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 52, paddingHorizontal: 20, borderRadius: 999, overflow: 'hidden' },
  choiceTxt: { flex: 1, color: '#ffffff', fontFamily: BrandFonts.medium, fontSize: 16, letterSpacing: -0.2 },
  ctaTxt: { color: '#0a0a0a', fontFamily: BrandFonts.semibold, fontSize: 15, letterSpacing: 0.1 },
});
