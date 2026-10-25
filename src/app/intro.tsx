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
import { SafeAreaView, useSafeAreaInsets } from '@/utils/safe-area';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AudioLines, ChevronLeft, Radio, Wind } from 'lucide-react-native';
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
  mock?: { screens: ImageSourcePropType[]; accent: string; kind: 'pulse' | 'breath' | 'sound' };
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
    mock: { screens: [require('../../assets/intro/state1.jpg'), require('../../assets/intro/state2.jpg')], accent: '#F5A524', kind: 'pulse' }, // State Control · Boost
    Icon: Radio,
  },
  {
    key: 'breath',
    eyebrow: 'GUIDED BREATHWORK',
    title: 'Follow the cues.\nLet your breathing lead.',
    sub: 'Clear spoken guidance and haptic cues help you follow each breath through your phone or smartwatch.',
    body: 'Use established breathing techniques to guide your state toward calm, focus, energy or sleep.',
    note: 'Smart bead bracelet support coming soon.',
    mock: { screens: [require('../../assets/intro/breath1.jpg'), require('../../assets/intro/breath2.jpg')], accent: '#FFFFFF', kind: 'breath' }, // Breathwork · Clarity & Relax
    Icon: Wind,
  },
  {
    key: 'audio',
    eyebrow: 'AUDIO LIBRARY',
    title: 'Learn from the minds\nthat changed how we see the world.',
    sub: 'We turn the enduring ideas of history’s greatest minds into clear, structured audio sessions you can understand, apply and return to.',
    body: 'So insight can become lasting personal growth.',
    mock: { screens: [require('../../assets/intro/audio1.jpg'), require('../../assets/intro/audio2.jpg'), require('../../assets/intro/audio3.jpg')], accent: '#00A3A3', kind: 'sound' }, // vier pilaren, dan The Inner Child (Carl Jung)
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

/* Telefoon met echte schermen van de app: staat stil en wisselt zacht tussen de schermen. Het frame is bewust neutraal (geen Dynamic Island of ander
   Apple-ontwerp) en toont uitsluitend echte schermen van de app. Erachter een duidelijke maar rustige animatie (pulsen / ademhaling / geluid);
   alles staat stil bij "beweging verminderen". */
function PhoneMockup({ screens, accent, height, kind }: { screens: ImageSourcePropType[]; accent: string; height: number; kind: 'pulse' | 'breath' | 'sound' }) {
  const width = Math.round(height * (540 / 1047) + 14);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (isReduceMotion() || screens.length < 2) return undefined;
    const id = setInterval(() => setIdx((i) => (i + 1) % screens.length), 3400);
    return () => clearInterval(id);
  }, [screens.length]);
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      {kind === 'sound' ? <SoundBars color={accent} width={width} /> : <PulseRings color={accent} size={width} period={kind === 'breath' ? 4600 : 1700} />}
      <View style={[s.phone, { width, height }]}>
        <View style={s.phoneScreen}>
          {screens.map((src, i) => (
            <PhoneLayer key={i} src={src} active={idx === i} w={width - 17} h={height - 17} />
          ))}
        </View>
      </View>
    </View>
  );
}

/* Pulsen: drie ringen die uit de telefoon golven (State Control: ±0,6 Hz; Breathwork: traag, als een ademhaling). Nooit sneller dan 1 Hz. */
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
  return <Animated.View style={[{ position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -d / 2, width: d, height: d, borderRadius: d / 2, borderWidth: 2, borderColor: color }, style]} />;
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
  const h = useSharedValue(0.25);
  const mid = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2); // hoogste in het midden
  useEffect(() => {
    if (isReduceMotion()) {
      h.value = 0.25 + mid * 0.4;
      return;
    }
    const lo = 0.12 + mid * 0.1;
    const hi = 0.35 + mid * 0.65;
    h.value = withDelay((i * 97) % 600, withRepeat(withSequence(withTiming(hi, { duration: 380 + ((i * 53) % 320), easing: Easing.inOut(Easing.quad) }), withTiming(lo, { duration: 420 + ((i * 71) % 300), easing: Easing.inOut(Easing.quad) })), -1, false));
  }, [h, i, mid]);
  const style = useAnimatedStyle(() => ({ height: Math.max(6, h.value * max) }));
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
            <PhoneMockup screens={cur.mock.screens} accent={cur.mock.accent} height={phoneH} kind={cur.mock.kind} />
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
          <Animated.View key={step} entering={enter(4)}>
          <PressScale onPress={next} scaleTo={0.97} style={s.ctaWrap} accessibilityRole="button" accessibilityLabel={`CTA ${ctaLabel}`}>
            <View style={[s.cta, { overflow: 'hidden' }]} onLayout={(e) => setCtaWidth(e.nativeEvent.layout.width)}>
              <Text style={s.ctaTxt}>{ctaLabel}</Text>
              {step === 0 ? (<Animated.View style={[s.ctaShimmer, ctaShimmerStyle]} pointerEvents="none"><LinearGradient colors={['#ffffff00', '#ffffff5c', '#ffffff00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>) : null}
            </View>
          </PressScale>
          </Animated.View>
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
  ctaTxt: { color: '#0a0a0a', fontFamily: BrandFonts.semibold, fontSize: 15, letterSpacing: 0.1 },
});
