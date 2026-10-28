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
import { whenAppVisible } from '@/components/LaunchReveal';
import { qaFlag } from '@/utils/qa-probe';
import { setSetting } from '@/utils/settings';
import { HapticPulseRings, HeartbeatScale } from '@/components/HapticPulseRings';
import SessionArt from '@/components/SessionArt';
import { BREATH_STATES } from '@/data/breath-states';
import { BraceletMode, getModeMeta } from '@/services/ble-contract';
import { breathWaveLook } from '@/components/LiquidWave';
import { emitVisualPulse, rhythmFor } from '@/services/bracelet-haptics';
import { SafeAreaView, useSafeAreaInsets } from '@/utils/safe-area';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AudioLines, ChevronLeft, Radio, Wind } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, type ImageSourcePropType, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { imageSource } from '@/utils/image-source';
import Animated, { cancelAnimation, Easing, FadeIn, interpolate, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Canvas, Circle, Group, Path, RadialGradient, Skia, vec } from '@shopify/react-native-skia';

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
  /** Foto lager zetten: afstand vanaf de bovenkant als deel van de schermhoogte (de bovenrand vloeit over in zwart). */
  photoTop?: number;
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
    title: 'Stop being a passenger\nin your own life',
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
    title: 'Feel the pulse.\nFeel the shift',
    sub: 'Research-based, bottom-up haptic pulse patterns deliver vibrations through your phone or smartwatch, guiding your nervous system from stress toward calm or focus, or toward energy or sleep.',
    body: '', // (26 okt, operator) "Choose the state you want to move toward." weg: de tekst moet kunnen ademen en niet scrollen
    note: 'Smart bead bracelet support coming soon.',
    mock: { kind: 'state', accent: '#B478FF' }, // State Control · Calm Control: pulseert meteen en stopt niet (Boost is hier te heftig)
    Icon: Radio,
  },
  {
    key: 'breath',
    eyebrow: 'GUIDED BREATHWORK',
    title: 'Follow the cues.\nLet your breathing lead',
    sub: 'Clear spoken guidance and haptic cues help you follow each breath through your phone or smartwatch.',
    body: 'Use established breathing techniques to guide your state toward calm, focus, energy or sleep.',
    note: 'Smart bead bracelet support coming soon.',
    mock: { kind: 'breath', accent: '#FFFFFF' }, // Breathwork · Clarity & Relax: ademt (levend)
    Icon: Wind,
  },
  {
    key: 'audio',
    eyebrow: 'AUDIO LIBRARY',
    title: 'Learn from the minds\nthat changed how we see the world',
    sub: 'We turn the enduring ideas of history’s greatest minds into clear, structured audio sessions you can understand, apply and return to.',
    body: 'So insight can become lasting personal growth.',
    mock: { kind: 'audio', accent: '#00A3A3', steps: [{ src: require('../../assets/intro/audio3.jpg'), ms: 1 }] }, // The Inner Child (Carl Jung) met audio & haptics
    Icon: AudioLines,
  },
  {
    /* 28 okt 2026 (operator): nieuwe tekst en foto voor het slotscherm. Kop zonder punt op het einde (regel voor koppen). De foto is
       liggend (1536 x 1024); hier vierkant getoond (cover) zodat beide personen in beeld blijven en de tekst eronder ademt. */
    key: 'start',
    eyebrow: 'YOUR LIFE. YOUR NEXT MOVE',
    title: 'Growth starts\nwith one moment',
    sub: 'Take a breath. Find your balance. Understand yourself. Begin where you are.',
    body: '',
    photo: 'https://vibezcore-audio.b-cdn.net/images/pic%20your%20move%20.png',
    photoRatio: 1,
    photoTop: 0.07, // operator 28 okt: "foto mag lager" — het hoofd viel achter "5 OF 5"
  },
];

/* Telefoon met schermen van de app: staat stil. State Control en Breathwork zijn LEVENDE nabootsingen van de echte schermen (tijd instellen, dan pulseren /
   ademen); de Audio Library toont echte schermen met een tik op The Inner Child. Het frame is bewust neutraal (geen Dynamic Island of ander Apple-ontwerp) en er
   staat niets in dat de app niet echt doet. Alles blijft onder 1 Hz en staat stil bij "beweging verminderen". */
function PhoneMockup({ mock, height: heightIn }: { mock: NonNullable<Step['mock']>; height: number }) {
  const { width: winW } = useWindowDimensions();
  /* Telefoon + smartwatch vormen één groep die altijd binnen de veilige zone (28 dp links en rechts) past, op elk scherm. */
  const SAFE = 28;
  const groupRatio = mock.kind === 'state' ? 1.7 : 1;
  const maxW = (winW - SAFE * 2) / groupRatio;
  const height = Math.min(heightIn, Math.round((maxW - 14) * (1047 / 540)));
  const width = Math.round(height * (540 / 1047) + 14);
  const groupW = mock.kind === 'state' ? Math.round(width * 1.66 + 8) : width;
  const w = width - 17;
  const h = height - 17;
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: mock.kind === 'state' ? -Math.round((groupW - width) / 2) : 0 }] }}>
      <View style={{ width, height, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}>
        {/* zijknoppen zoals op de website: actieknop + twee volumeknoppen links, aan/uit rechts */}
        <View style={[s.phoneBtn, { left: -2.5, top: height * 0.15, height: height * 0.04 }]} />
        <View style={[s.phoneBtn, { left: -2.5, top: height * 0.23, height: height * 0.08 }]} />
        <View style={[s.phoneBtn, { left: -2.5, top: height * 0.33, height: height * 0.08 }]} />
        <View style={[s.phoneBtn, { right: -2.5, top: height * 0.27, height: height * 0.13 }]} />
        <LinearGradient colors={['#a3a299', '#4d4c46', '#2c2b28', '#74736c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 38, padding: 4.5 }}>
          <View style={{ flex: 1, borderRadius: 34, backgroundColor: '#000', padding: 4, overflow: 'hidden' }}>
            <View style={s.phoneScreen}>
              {mock.kind === 'state' ? <StateScene w={w} h={h} accent={mock.accent} /> : null}
              {mock.kind === 'breath' ? <BreathScene w={w} h={h} /> : null}
              {mock.kind === 'audio' && mock.steps ? <AudioScene w={w} h={h} steps={mock.steps} /> : null}
              <PhoneStatusBar w={w} />
            </View>
          </View>
        </LinearGradient>
      </View>
      {mock.kind === 'state' ? <SmartWatchMock phoneW={width} phoneH={height} /> : null}
    </View>
  );
}

/* Smartwatch bij "Feel the pulse", zoals op de website: grafiet vierkant-rond behuizing met dikke donkere rand, zwart scherm met modusnaam, cirkel + tijd,
   pauzeknop en END, één zijknop, brede donkere bandjes met gaatjes die ONDER de behuizing doorlopen en uitlopen. Generiek (geen Apple Watch-ontwerp, geen kroon). */
function SmartWatchMock({ phoneW, phoneH }: { phoneW: number; phoneH: number }) {
  const meta = getModeMeta(BraceletMode.Alpha);
  const color = breathWaveLook(meta.color).color;
  const cw = Math.round(phoneW * 0.6);
  const ch = Math.round(cw * 1.2);
  const rim = Math.max(4, Math.round(cw * 0.035));
  const screenW = cw - rim * 2;
  const screenH = ch - rim * 2;
  const inner = Math.round(screenW * 0.42);
  const n = useTick(250);
  const left = 18 * 60 - Math.floor(n * 0.25);
  const strapW = Math.round(cw * 0.7);
  const strapH = Math.round(ch * 0.62);
  const tuck = Math.round(ch * 0.14); // bandje loopt onder de behuizing door
  /* bandje: loopt onder de behuizing door en loopt zacht uit naar niets (alpha-verloop, geen harde rechthoek) */
  const strap = (top: boolean) => (
    <View style={{ width: strapW, height: strapH, marginTop: top ? 0 : -tuck, marginBottom: top ? -tuck : 0, alignItems: 'center' }}>
      <LinearGradient colors={top ? ['rgba(58,58,66,0)', '#3a3a42', '#3a3a42'] : ['#3a3a42', '#3a3a42', 'rgba(58,58,66,0)']} locations={[0, 0.55, 1]} style={{ flex: 1, width: '100%', borderTopLeftRadius: top ? 12 : 0, borderTopRightRadius: top ? 12 : 0, borderBottomLeftRadius: top ? 0 : 16, borderBottomRightRadius: top ? 0 : 16 }} />
      {!top ? (
        <View style={{ position: 'absolute', top: tuck + 16, alignItems: 'center', gap: 20 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#060607', opacity: 1 - i * 0.3 }} />
          ))}
        </View>
      ) : null}
    </View>
  );
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: phoneW * 1.06, top: phoneH * 0.1, width: cw + 8, alignItems: 'center' }}>
      {strap(true)}
      <View style={{ width: cw, height: ch, zIndex: 3, shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 }}>
        <View style={{ position: 'absolute', right: -3.5, top: ch * 0.34, width: 4, height: ch * 0.2, borderRadius: 2, backgroundColor: '#3b3b40' }} />
        <LinearGradient colors={['#4b4b50', '#17171a', '#0e0e10', '#3a3a3f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: cw * 0.25, padding: rim }}>
          <View style={{ flex: 1, borderRadius: cw * 0.22, backgroundColor: '#000', alignItems: 'center', overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: screenH * 0.06, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.color }} />
              <Text style={{ color: '#fff', fontFamily: BrandFonts.bold, fontSize: Math.round(cw * 0.085) }}>{meta.name}</Text>
            </View>
            <View style={{ position: 'absolute', top: screenH * 0.27, width: inner, height: inner, alignItems: 'center', justifyContent: 'center' }}>
              <HapticPulseRings size={inner} color={color} beatSynced />
              <HeartbeatScale size={inner}>
                <View style={{ width: inner, height: inner, borderRadius: inner / 2, borderWidth: 1.5, borderColor: color, backgroundColor: 'rgba(180,120,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontFamily: BrandFonts.extrabold, fontSize: Math.round(inner * 0.3), letterSpacing: -0.5 }}>{mmss(left)}</Text>
                </View>
              </HeartbeatScale>
            </View>
            <View style={{ position: 'absolute', bottom: screenH * 0.05, alignItems: 'center', gap: 2 }}>
              <View style={{ width: screenH * 0.15, height: screenH * 0.15, borderRadius: screenH * 0.075, backgroundColor: 'rgba(180,120,255,0.3)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 }}>
                <View style={{ width: 2.5, height: screenH * 0.06, backgroundColor: '#fff', borderRadius: 1 }} />
                <View style={{ width: 2.5, height: screenH * 0.06, backgroundColor: '#fff', borderRadius: 1 }} />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontFamily: BrandFonts.bold, fontSize: Math.round(cw * 0.06), letterSpacing: 1.2 }}>END</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
      {strap(false)}
    </View>
  );
}

/* Statusbalk bovenin de telefoon, zoals op de website: tijd links, signaal en batterij rechts. */
function PhoneStatusBar({ w }: { w: number }) {
  const f = Math.round(w * 0.05);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: Math.round(w * 0.045), left: Math.round(w * 0.09), right: Math.round(w * 0.09), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontFamily: BrandFonts.bold, fontSize: f }}>9:41</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 }}>
          {[0.4, 0.6, 0.8, 1].map((k, i) => (
            <View key={i} style={{ width: 2.5, height: f * k, borderRadius: 1, backgroundColor: '#fff' }} />
          ))}
        </View>
        <View style={{ width: f * 1.9, height: f * 0.9, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', padding: 1 }}>
          <View style={{ flex: 1, borderRadius: 1.5, backgroundColor: '#fff' }} />
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
function StateScene({ w, h }: { w: number; h: number; accent: string }) {
  /* State Control · Calm Control, met de ECHTE pulsgolf en kloppende cirkel van de app (HapticPulseRings + HeartbeatScale), aangestuurd op het echte tempo
     van de toestand (start = rusthartslag 70, daarna rustig trager). Enkel het beeld: er wordt niets getrild of gespeeld. */
  const meta = getModeMeta(BraceletMode.Alpha);
  const color = breathWaveLook(meta.color).color;
  const n = useTick(250);
  const left = 18 * 60 - Math.floor(n * 0.25);
  useEffect(() => {
    if (isReduceMotion()) return undefined;
    const { targetBpm } = rhythmFor(BraceletMode.Alpha, 70);
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const beat = () => {
      if (!alive) return;
      const bpm = targetBpm; // meteen het eindtempo (na de vertraging), niet de eerste seconden op rusthartslag
      const cycleMs = Math.round(60000 / bpm);
      emitVisualPulse({ kind: 'lub', mode: BraceletMode.Alpha, cycleMs, atMs: Date.now() });
      setTimeout(() => {
        if (alive) emitVisualPulse({ kind: 'dub', mode: BraceletMode.Alpha, cycleMs, atMs: Date.now() });
      }, Math.round(Math.min(cycleMs * 0.3, 350)));
      timer = setTimeout(beat, cycleMs);
    };
    beat();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);
  const d = Math.round(w * 0.74);
  return (
    <View style={{ width: w, height: h, backgroundColor: '#0e0a14' }}>
      <View style={{ position: 'absolute', top: h * 0.075, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: meta.color }} />
        <Text style={{ color: '#fff', fontFamily: BrandFonts.bold, fontSize: Math.round(w * 0.075) }}>{meta.name}</Text>
      </View>
      <View style={{ position: 'absolute', top: h * 0.17, left: (w - d) / 2, width: d, height: d, alignItems: 'center', justifyContent: 'center' }}>
        <HapticPulseRings size={d} color={color} beatSynced />
        <HeartbeatScale size={d}>
          <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: 2, borderColor: color, backgroundColor: 'rgba(180,120,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontFamily: BrandFonts.extrabold, fontSize: Math.round(d * 0.25), letterSpacing: -1 }}>{mmss(left)}</Text>
          </View>
        </HeartbeatScale>
      </View>
    </View>
  );
}

/* Breathwork · Clarity & Relax: de figuur ademt in en uit (4 s / 4 s) met de teller en de tekst zoals in de sessie. */
function BreathScene({ w, h }: { w: number; h: number }) {
  /* Breathwork · Clarity & Relax: de echte ademfiguur van de sessie (SessionArt), met de glow er zelf achter getekend (zelfde kleur en grootte als in de sessie),
     de boog boven de teller en de tekst zoals in de lopende sessie. 4 s in / 4 s uit. */
  const st = BREATH_STATES.clarity;
  const n = useTick(100);
  const t = (n * 0.1) % 8;
  const inhale = t < 4;
  const phaseT = inhale ? t : t - 4;
  const value = Math.max(0, 4 - phaseT).toFixed(1);
  const breath = useSharedValue(0);
  useEffect(() => {
    if (isReduceMotion()) {
      breath.value = 0.7;
      return;
    }
    breath.value = 0;
    breath.value = withRepeat(
      withSequence(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) })),
      -1,
      false,
    );
  }, [breath]);
  const k = w / 411;
  const boxH = Math.round(268 * k);
  const gR = boxH * 0.62;
  const gOpacity = useDerivedValue(() => 0.35 + breath.value * 0.55);
  const gScale = useDerivedValue(() => [{ scale: 0.7 + breath.value * 0.5 }]);
  /* boog boven de teller: loopt van links over de bovenkant naar rechts naarmate de seconden aflopen */
  const ar = w * 0.34;
  const acx = w / 2;
  const acy = h * 0.71;
  const track = Skia.Path.Make();
  track.addArc({ x: acx - ar, y: acy - ar, width: ar * 2, height: ar * 2 }, 180, 180);
  const prog = Skia.Path.Make();
  const sweep = Math.max(1, 180 * (phaseT / 4));
  prog.addArc({ x: acx - ar, y: acy - ar, width: ar * 2, height: ar * 2 }, 180, sweep);
  const ang = ((180 + sweep) * Math.PI) / 180;
  const dx = acx + ar * Math.cos(ang);
  const dy = acy + ar * Math.sin(ang);
  return (
    <View style={{ width: w, height: h, backgroundColor: '#08080a' }}>
      <View style={{ position: 'absolute', top: h * 0.075, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontFamily: BrandFonts.extrabold, fontSize: Math.round(w * 0.07), letterSpacing: 1 }}>CLARITY &amp; RELAX</Text>
      </View>
      <View style={{ position: 'absolute', top: h * 0.15, left: 0, width: w, height: boxH, alignItems: 'center', justifyContent: 'center' }}>
        <Canvas style={{ position: 'absolute', left: 0, top: -boxH * 0.35, width: w, height: boxH * 1.7 }} pointerEvents="none">
          <Group origin={vec(w / 2, boxH * 0.85)} transform={gScale} opacity={gOpacity}>
            <Circle cx={w / 2} cy={boxH * 0.85} r={w * 0.62}>
              <RadialGradient c={vec(w / 2, boxH * 0.85)} r={w * 0.62} colors={['#9db2d6', st.glow, '#00000000']} positions={[0, 0.3, 1]} />
            </Circle>
          </Group>
        </Canvas>
        <SessionArt size={Math.round(w * 0.98 * (st.artScale ?? 1))} art={st.art} breath={breath} glow={'#00000000'} boxHeight={boxH} focusY={st.focusY} rings={false} />
      </View>
      <Canvas style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} pointerEvents="none">
        <Path path={track} style="stroke" strokeWidth={3} color="rgba(255,255,255,0.14)" strokeCap="round" />
        <Path path={prog} style="stroke" strokeWidth={3} color="#b9c6dc" strokeCap="round" />
        <Circle cx={dx} cy={dy} r={4.5} color="#ffffff" />
      </Canvas>
      <View style={{ position: 'absolute', top: acy - ar * 0.62, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontFamily: BrandFonts.extrabold, fontSize: Math.round(w * 0.2), letterSpacing: -1 }}>{value}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: BrandFonts.medium, fontSize: Math.round(w * 0.04) }}>SEC</Text>
        
      </View>
    </View>
  );
}

/* Audio Library: pilaren -> pilaar -> scrollen naar The Inner Child -> aantikken -> de sessie speelt. Echte schermen, met een tik-aanwijzer. */
function AudioScene({ w, h, steps }: { w: number; h: number; steps: NonNullable<Step['mock']>['steps'] }) {
  const first = (steps ?? [])[0];
  return (
    <View style={{ width: w, height: h }}>
      {first ? <Image source={first.src} style={{ width: w, height: h }} resizeMode="cover" /> : null}
      {/* Audio & haptics: de geluidsfrequentie als een dichte golfvorm onder de titel (zoals op de website), in het scherm zelf. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: w * 0.06, right: w * 0.06, top: h * 0.566, height: h * 0.06, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {Array.from({ length: 56 }).map((_, i) => (
          <HBar key={i} i={i} n={56} max={h * 0.06} />
        ))}
      </View>
    </View>
  );
}
function HBar({ i, n, max }: { i: number; n: number; max: number }) {
  const hh = useSharedValue(0.2);
  const mid = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
  useEffect(() => {
    if (isReduceMotion()) {
      hh.value = 0.2 + mid * 0.5;
      return;
    }
    const lo = 0.1 + mid * 0.1;
    const hi = 0.3 + mid * 0.7;
    hh.value = withDelay((i * 83) % 500, withRepeat(withSequence(withTiming(hi, { duration: 320 + ((i * 47) % 280), easing: Easing.inOut(Easing.quad) }), withTiming(lo, { duration: 360 + ((i * 61) % 260), easing: Easing.inOut(Easing.quad) })), -1, false));
  }, [hh, i, mid]);
  const style = useAnimatedStyle(() => ({ height: Math.max(3, hh.value * max) }));
  return <Animated.View style={[{ width: 2, borderRadius: 1, backgroundColor: '#12C4C4', opacity: 0.95 }, style]} />;
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
    /* Ook bij opnieuw bekijken (Settings): het einde is het welkomstscherm met de drie keuzes (operator, 25 okt 2026), niet terug naar Settings. */
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
  const photoTopPx = cur.photo && !cur.pan ? Math.round(winH * (cur.photoTop ?? 0)) : 0;
  /* Eerste scherm: de brede foto begint volledig (de buitenste mensen = het begin: drifting) en zoomt langzaam naar binnen op de twee in het midden (directing). */
  /* 28 okt 2026 (operator, iPhone): 'de foto gaat te snel, de mensen mogen even zichtbaar zijn (niet te traag, niet te snel)': rust 450 → 650 ms,
     zoom 2,6 → 3,4 s (was 4,5 s inOut, toen te traag bevonden). */
  const zoom = useSharedValue(1);
  const stripH = Math.round(winW * (cur.photoRatio ?? 0.43));
  const zoomTo = Math.min(3, Math.max(1, (photoH / Math.max(1, stripH)) * 0.92));
  /* 27 okt 2026 (operator, iOS): "foto begint niet uitgezoomd; de beginpose van de mensen aan de buitenkant zie ik niet; inzoomen moet vlot en snel".
     De beginwaarde 1 staat nu vóór de eerste tekenbeurt vast (cancelAnimation + set), en de zoom start na korte rust (450 ms, zodat de beginpose
     zichtbaar is) met een vlotte, sneller uitlopende curve van 2,6 s i.p.v. 4,5 s inOut. */
  useEffect(() => {
    cancelAnimation(zoom);
    zoom.value = 1;
    if (!cur.pan) return () => cancelAnimation(zoom);
    if (isReduceMotion()) {
      zoom.value = zoomTo;
      return () => cancelAnimation(zoom);
    }
    /* Pas inzoomen als de opstart-animatie de app vrijgeeft (zie whenAppVisible), anders speelt de zoom af achter het logo. */
    const stop = whenAppVisible(() => {
      zoom.value = withDelay(650, withTiming(zoomTo, { duration: 3400, easing: Easing.out(Easing.cubic) }));
    });
    return () => {
      stop();
      cancelAnimation(zoom);
    };
  }, [cur.pan, zoomTo, zoom]);
  const panStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  /* Telefoon: 54% van de schermhoogte, onderaan zacht naar zwart onder de tekst. */
  const insets = useSafeAreaInsets();
  const phoneH = Math.round(winH * 0.46); // groot; de onderste helft verdwijnt achter de tekstkaart (alleen de bovenste helft is zichtbaar)
  const phoneTop = Math.round(insets.top + 50); // onder de bovenbalk (Back / stap / Skip)
  const ctaLabel = step === 0 ? 'Get started' : last ? 'Take your first step' : 'Next'; // slotknop: operator-tekst 28 okt 2026

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      {cur.mock ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {<LinearGradient colors={[cur.mock.accent + (cur.mock.kind === 'audio' ? '12' : '30'), 'rgba(10,10,10,0)']} locations={[0, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(winH * 0.7) }} />}
          <Animated.View key={cur.key} entering={FadeIn.duration(450)} style={{ position: 'absolute', top: phoneTop, left: 0, right: 0, alignItems: 'center' }}>
            <PhoneMockup mock={cur.mock} height={phoneH} />
          </Animated.View>
        </View>
      ) : null}
      {cur.photo ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* De foto op volle breedte in zijn eigen verhouding (2:3, 4:5, 9:16), onderaan zacht naar zwart waar de tekst staat. */}
          <Animated.View key={cur.key} entering={FadeIn.duration(450)} style={StyleSheet.absoluteFill}><Animated.View style={cur.pan ? [panStyle, { position: 'absolute', top: Math.round((photoH - stripH) / 2), left: 0, width: winW, height: stripH }] : undefined}><Image source={imageSource(cur.photo)} style={[cur.pan ? undefined : s.photo, { width: photoW, height: cur.pan ? stripH : photoH }, !cur.pan && photoTopPx ? { top: photoTopPx } : null]} resizeMode="cover" /></Animated.View></Animated.View>
          {/* Lager gezette foto: de bovenrand vloeit zacht over in de zwarte achtergrond (geen harde lijn). */}
          {!cur.pan && photoTopPx ? (
            <LinearGradient colors={['#0a0a0a', 'rgba(10,10,10,0)']} locations={[0, 1]} style={{ position: 'absolute', left: 0, right: 0, top: photoTopPx, height: Math.round(photoH * 0.18) }} />
          ) : null}
          <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']} locations={[0, 1]} style={s.topFade} />
          <LinearGradient
            colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.7)', 'rgba(10,10,10,0.96)', '#0a0a0a']}
            locations={[0, 0.45, 0.8, 1]}
            style={{ position: 'absolute', left: 0, right: 0, top: photoTopPx + Math.round(photoH * 0.3), height: Math.round(photoH * 0.7) + 2 }}
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

        <View style={{ flex: 1 }} />
        {/* Tekstkaart (alleen bij de telefoon-schermen): effen donker vlak met ronde bovenhoeken; de telefoon verdwijnt er netjes achter, geen doorlopende tekst over beeld. */}
        <View style={cur.mock ? [s.card, { height: Math.round(winH * 0.57) }] : undefined}>
        {cur.mock ? <LinearGradient pointerEvents="none" colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.35)', 'rgba(10,10,10,0.8)', '#0a0a0a']} locations={[0, 0.07, 0.13, 0.19]} style={StyleSheet.absoluteFill} /> : null}
        <ScrollView
          key={step}
          /* 28 okt 2026 (operator, iPhone): de zwarte overgang hoger (kaart 52 → 57%) zodat de onderkant van de telefoon niet zichtbaar is; de tekst blijft waar hij stond. */
          style={cur.mock ? { flex: 1, marginTop: Math.round(winH * 0.05) } : { flexGrow: 0, flexShrink: 1 }}
          contentContainerStyle={[s.content, cur.mock ? { justifyContent: 'flex-start' } : cur.photo && s.contentBottom]}
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
            {cur.body ? <BalancedText style={s.body}>{cur.body}</BalancedText> : null}
            {cur.note ? <Text style={s.note}>{cur.note}</Text> : null}
          </Animated.View>
        </ScrollView>

        <View style={s.footer}>
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
        </View>
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
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingBottom: 12, gap: 10 },
  photo: { position: 'absolute', top: 0, left: 0, right: 0 },
  phone: { borderRadius: 34, backgroundColor: '#0c0c0e', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', padding: 7, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 12 },
  phoneBtn: { position: 'absolute', width: 3, borderRadius: 2, backgroundColor: '#55544e' },
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
  card: { paddingTop: 30 }, // geen effen vlak: het donker loopt zacht in via het verloop (operator: geen zwarte achtergrond achter de kop)
  footer: { paddingHorizontal: 26, paddingBottom: 22, paddingTop: 8 },
  ctaWrap: { borderRadius: 999, backgroundColor: CTA_GLASS, ...CTA_GLOW },
  cta: { alignItems: 'center', justifyContent: 'center', borderRadius: 999, height: 52 },
  ctaShimmer: { position: 'absolute', top: -20, bottom: -20, left: 0, width: 72 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 52, paddingHorizontal: 20, borderRadius: 999, overflow: 'hidden' },
  choiceTxt: { flex: 1, color: '#ffffff', fontFamily: BrandFonts.medium, fontSize: 16, letterSpacing: -0.2 },
  ctaTxt: { color: '#0a0a0a', fontFamily: BrandFonts.semibold, fontSize: 15, letterSpacing: 0.1 },
});
