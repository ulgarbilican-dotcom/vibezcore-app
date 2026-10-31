/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "How Breathwork works" / "How State Control works" (31 okt 2026)

   Operator: "als het 'How it works' heet, moet het heel duidelijk met info en beeld laten zien hoe het werkt",
   "visuals moeten high end en boeiend zijn", "er zijn al leuke animaties in de intro, gebruik die mee",
   "maak niets kapot dat al goed staat".

   Daarom een eigen scherm naast de onboarding (die blijft ongewijzigd): zelfde opbouw als de app-intro
   (app/intro.tsx) — beeld bovenaan, tekst die van onderen in cascade binnenkomt, "1 OF 4" met dunne balk,
   tik op Next (geen zijwaartse paginaschuif, UI_EN_BEWEGINGSREGELS). Het beeld is telkens de ECHTE app:
   - foto van het tabblad met een trage zoom (zoals de intro's);
   - de telefoon (+ horloge) met de levende ademfiguur of kloppende cirkel (PhoneMockup uit app/intro.tsx);
   - de vijf toestanden als glazen bollen in hun kleur, die om de beurt oplichten — bij Breathwork ademt de
     gekozen bol, bij State Control klopt hij op het tempo van die toestand; een tik laat het je voelen;
   - je dag als ring met de sessies die één voor één verschijnen en een herinnering die binnenschuift.
   Alles staat stil bij "beweging verminderen". Er wordt enkel getrild als de gebruiker zelf tikt.
   ───────────────────────────────────────────────────────────────────────── */

import BalancedText from '@/components/BalancedText';
import PressScale from '@/components/PressScale';
import Tap from '@/components/Tap';
import VibezGlass from '@/components/VibezGlass';
import StateGlyph from '@/components/StateGlyph';
import { HapticPulseRings, HeartbeatScale } from '@/components/HapticPulseRings';
import { PhoneMockup } from '@/app/intro';
import { HowPhonesDuo } from '@/components/HowPhones';
import { HeartbeatHero } from '@/components/RestingHeartRatePage';
import { Brand, BrandFonts, CTA_GLASS, CTA_GLOW, TypeScale } from '@/constants/theme';
import { SPRING_POP, isReduceMotion, reveal } from '@/constants/motion';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { BraceletMode } from '@/services/ble-contract';
import { FEEL_LINE } from '@/components/StateControlOnboarding';
import { emitVisualPulse, playModeTasteHaptic, rhythmFor, stopModePreviewHaptic } from '@/services/bracelet-haptics';
import { isBraceletSessionMonitorActive } from '@/services/bracelet-session-monitor';
import { imageSource } from '@/utils/image-source';
import { SafeAreaView, useSafeAreaInsets } from '@/utils/safe-area';
import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';

export type HowScene =
  | { kind: 'photo'; uri: string; accent: string }
  | { kind: 'phone'; mock: 'breath' | 'state'; accent: string }
  /* 31 okt 2026 (operator: "gebruik de schermen zoals op de website"): saleskaart + lopende sessie, zie HowPhones.tsx */
  | { kind: 'duo'; mode: 'breath' | 'state'; accent: string }
  /* 31 okt 2026 (operator: "ik mis het hartslagverhaal"): het kloppende hart met de hartlijn van "Your Resting Heart Rate" (zonder geluid/trillen) */
  | { kind: 'heart' }
  | { kind: 'states'; mode: 'breath' | 'state' }
  | { kind: 'day'; mode: 'breath' | 'state' };

export type HowStep = {
  key: string;
  eyebrow: string;
  title: string;
  sub: string;
  body?: string;
  /** Kenmerken als kleine pillen, zoals op de website (vibezcore.com, 31 okt 2026). */
  chips?: string[];
  note?: string;
  scene: HowScene;
};

const enter = (i: number) => reveal(i);
const ORDER: BreathStateKey[] = ['boost', 'focus', 'calm', 'clarity', 'rest'];
const MODE_OF: Record<BreathStateKey, BraceletMode> = {
  boost: BraceletMode.Gamma,
  focus: BraceletMode.Beta,
  calm: BraceletMode.Alpha,
  clarity: BraceletMode.Theta,
  rest: BraceletMode.Delta,
};

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

/* ── Foto met trage zoom (zoals de intro's van de tabbladen) ── */
function PhotoScene({ uri, height }: { uri: string; height: number }) {
  const { width } = useWindowDimensions();
  const zoom = useSharedValue(1);
  useEffect(() => {
    if (isReduceMotion()) return undefined;
    zoom.value = withDelay(300, withTiming(1.08, { duration: 7000, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(zoom);
  }, [zoom]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  /* 31 okt 2026 (operator: "bovenkant hoofd meisje afgesneden, dat mag niet"): de foto hangt aan de BOVENKANT — volle breedte,
     eigen verhouding, enkel onderaan valt iets weg (daar loopt hij toch uit in zwart). De zoom vertrekt ook vanaf de bovenrand. */
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    Image.getSize(uri, (w, h) => alive && w > 0 && setRatio(h / w), () => {});
    return () => {
      alive = false;
    };
  }, [uri]);
  const imgH = ratio ? Math.max(height, Math.round(width * ratio)) : height;
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width, height: imgH, transformOrigin: 'top' }, st]}>
        <Image source={imageSource(uri)} style={{ width, height: imgH }} resizeMode="cover" />
      </Animated.View>
      <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']} locations={[0, 0.55, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 }} />
      <LinearGradient
        colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.75)', Brand.bg]}
        locations={[0, 0.6, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.round(height * 0.45) }}
      />
    </View>
  );
}

/* ── De vijf toestanden ── */
function StateOrb({
  stateKey,
  active,
  mode,
  size,
  onPress,
}: {
  stateKey: BreathStateKey;
  active: boolean;
  mode: 'breath' | 'state';
  size: number;
  onPress: () => void;
}) {
  const st = BREATH_STATES[stateKey];
  const pop = useSharedValue(active ? 1 : 0);
  const breath = useSharedValue(0);
  useEffect(() => {
    pop.value = withSpring(active ? 1 : 0, SPRING_POP);
    if (active && mode === 'breath' && !isReduceMotion()) {
      breath.value = 0;
      breath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(breath);
      breath.value = withTiming(0, { duration: 300 });
    }
  }, [active, mode, pop, breath]);
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.86 + pop.value * 0.22 + breath.value * 0.08 }],
    opacity: 0.45 + pop.value * 0.55,
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: pop.value * (0.55 + breath.value * 0.35) }));
  const inner = (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <VibezGlass radius={size / 2} tint={st.accent} style={StyleSheet.absoluteFill} />
      <StateGlyph stateKey={stateKey} size={Math.round(size * 0.46)} color={stateKey === 'clarity' ? '#ffffff' : st.accent} strokeWidth={1.8} />
    </View>
  );
  return (
    <Tap onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={st.eyebrow}>
      <View style={{ width: size * 1.5, height: size * 1.5, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', width: size * 1.45, height: size * 1.45, borderRadius: size, backgroundColor: rgba(st.glow, 0.35) },
            glowStyle,
          ]}
        />
        {active && mode === 'state' ? <HapticPulseRings size={Math.round(size * 1.4)} color={st.accent} beatSynced /> : null}
        {/* Vaste maat: HeartbeatScale is absoluut, zonder maat zakte de bol naar de hoek (31 okt 2026). */}
        <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, orbStyle]}>
          {active && mode === 'state' ? <HeartbeatScale size={size}>{inner}</HeartbeatScale> : inner}
        </Animated.View>
      </View>
    </Tap>
  );
}

/* ── State Control: horizontale tempo-grafiek (operator 31 okt: "horizontaal grafiekachtig, enkel als het professioneel kan").
   Eén as van 40 tot 120 bpm. Je rusthartslag (voorbeeld 70) is de verticale lijn; elke toestand is een stip op zijn eigen
   eindtempo (rhythmFor, zelfde berekening als de sessie). De gekozen toestand licht op en een lijn glijdt van je hartslag
   naar zijn tempo — zoals de sessie zelf: start op je hartslag, glijdt dan naar het tempo van de toestand. ── */
const BPM_MIN = 40;
const BPM_MAX = 120;
const REST_EX = 70;
function TempoChart({ active }: { active: BreathStateKey }) {
  const { width } = useWindowDimensions();
  const W = Math.min(width - 60, 360);
  const x = (bpm: number) => ((bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * W;
  const target = (k: BreathStateKey) => rhythmFor(MODE_OF[k], REST_EX).targetBpm;
  const t = target(active);
  const from = useSharedValue(x(REST_EX));
  const to = useSharedValue(x(t));
  useEffect(() => {
    to.value = isReduceMotion() ? x(t) : withTiming(x(t), { duration: 700, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, W]);
  const seg = useAnimatedStyle(() => ({ left: Math.min(from.value, to.value), width: Math.abs(to.value - from.value) }));
  const col = active === 'clarity' ? '#ffffff' : BREATH_STATES[active].accent;
  return (
    <View style={{ width: W, marginTop: 22 }}>
      <View style={{ height: 34 }}>
        <Animated.Text key={active} entering={FadeIn.duration(300)} style={[s.chartVal, { left: Math.max(0, Math.min(W - 120, x(t) - 60)), color: col }]}>
          {`Rhythm ${Math.round(t)} bpm`}
        </Animated.Text>
      </View>
      <View style={{ height: 22, justifyContent: 'center' }}>
        <View style={s.chartTrack} />
        <Animated.View style={[s.chartSeg, { backgroundColor: col }, seg]} />
        <View style={[s.chartRest, { left: x(REST_EX) - 1 }]} />
        {ORDER.map((k) => {
          const on = k === active;
          const c = k === 'clarity' ? '#ffffff' : BREATH_STATES[k].accent;
          const d = on ? 14 : 8;
          return <View key={k} style={{ position: 'absolute', left: x(target(k)) - d / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: c, opacity: on ? 1 : 0.55, borderWidth: on ? 2 : 0, borderColor: '#0a0a0a' }} />;
        })}
      </View>
      <View style={{ height: 18, marginTop: 6 }}>
        {[40, 60, 80, 100, 120].map((b) => (
          <Text key={b} style={[s.chartTick, { left: x(b) - 16 }]}>{b}</Text>
        ))}
      </View>
      <Text style={s.chartCap}>{`Tempo of the haptic rhythm, shown for a resting heart rate of ${REST_EX} (white line). In the app, it starts from your own`}</Text>
    </View>
  );
}

function StatesScene({ mode, height }: { mode: 'breath' | 'state'; height: number }) {
  const { width } = useWindowDimensions();
  const [idx, setIdx] = useState(2);
  const [touched, setTouched] = useState(false);
  /* Om de beurt oplichten tot de gebruiker zelf kiest. */
  useEffect(() => {
    if (touched || isReduceMotion()) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % ORDER.length), 3200);
    return () => clearInterval(t);
  }, [touched]);
  /* State Control: de gekozen bol klopt op het tempo van die toestand (enkel beeld). */
  const key = ORDER[idx];
  useEffect(() => {
    if (mode !== 'state' || isReduceMotion()) return undefined;
    const m = MODE_OF[key];
    const { targetBpm } = rhythmFor(m, 70);
    const cycleMs = Math.round(60000 / targetBpm);
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const beat = () => {
      if (!alive) return;
      emitVisualPulse({ kind: 'lub', mode: m, cycleMs, atMs: Date.now() });
      setTimeout(() => {
        if (alive) emitVisualPulse({ kind: 'dub', mode: m, cycleMs, atMs: Date.now() });
      }, Math.round(Math.min(cycleMs * 0.3, 350)));
      timer = setTimeout(beat, cycleMs);
    };
    beat();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [mode, key]);
  /* "Ademende" rij (bewaarde welkomst-animatie, 5 sept 2026): 1 → 1,03 → 1 op 3,4 s. */
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (isReduceMotion()) return undefined;
    breathe.value = withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breathe);
  }, [breathe]);
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.03 }] }));
  const st = BREATH_STATES[key];
  const size = Math.round(Math.min(64, (width - 52) / 7.2));
  const line = mode === 'state' ? FEEL_LINE[MODE_OF[key]] : st.description;
  const pick = (i: number) => {
    setTouched(true);
    setIdx(i);
    /* Een tik = voelen (enkel State Control, enkel als er geen sessie loopt). */
    if (mode === 'state' && !isBraceletSessionMonitorActive()) playModeTasteHaptic(MODE_OF[ORDER[i]]);
  };
  useEffect(() => () => {
    if (mode === 'state' && !isBraceletSessionMonitorActive()) stopModePreviewHaptic();
  }, [mode]);
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, rowStyle]}>
        {ORDER.map((k, i) => (
          <StateOrb key={k} stateKey={k} active={i === idx} mode={mode} size={size} onPress={() => pick(i)} />
        ))}
      </Animated.View>
      <Animated.View key={key} entering={FadeInDown.springify().damping(18).stiffness(170)} style={{ marginTop: 18, alignItems: 'center', paddingHorizontal: 30 }}>
        <Text style={[s.orbName, { color: key === 'clarity' ? '#ffffff' : st.accent }]}>{st.eyebrow}</Text>
        <BalancedText style={s.orbLine}>{line}</BalancedText>
      </Animated.View>
      {mode === 'state' ? <TempoChart active={key} /> : null}
    </View>
  );
}

/* ── Je dag: ring van 24 u, sessies verschijnen één voor één, een herinnering schuift binnen ── */
const DAY_BREATH: { at: number; key: BreathStateKey; label: string }[] = [
  { at: 7 * 60 + 30, key: 'boost', label: 'Boost' },
  { at: 13 * 60, key: 'focus', label: 'Sharp Focus' },
  { at: 22 * 60, key: 'rest', label: 'Sleep' },
];
const DAY_STATE: { at: number; key: BreathStateKey; label: string }[] = [
  { at: 8 * 60, key: 'focus', label: 'Sharp Focus' },
  { at: 15 * 60 + 30, key: 'calm', label: 'Calm Control' },
  { at: 22 * 60 + 30, key: 'rest', label: 'Sleep' },
];
/* Tijden volgen het toestel: 24 u in Europa, AM/PM waar dat de gewoonte is (operator 31 okt: "enkel EU-tijd of ook AM/PM?"). */
const USES_12H = /[AaPp]\.?\s?[Mm]/.test(new Date(2000, 0, 1, 13, 0).toLocaleTimeString([], { hour: 'numeric' }));
const hhmm = (m: number) => {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function DayDot({ x, y, color, i }: { x: number; y: number; color: string; i: number }) {
  const v = useSharedValue(isReduceMotion() ? 1 : 0);
  useEffect(() => {
    if (isReduceMotion()) return;
    v.value = withDelay(500 + i * 650, withSpring(1, SPRING_POP));
  }, [v, i]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: v.value }], opacity: v.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: x - 9, top: y - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: color, borderWidth: 2, borderColor: '#0a0a0a', shadowColor: color, shadowOpacity: 0.9, shadowRadius: 10, elevation: 6 },
        st,
      ]}
    />
  );
}

function DayScene({ mode, height }: { mode: 'breath' | 'state'; height: number }) {
  const { width } = useWindowDimensions();
  const items = mode === 'breath' ? DAY_BREATH : DAY_STATE;
  const d = Math.round(Math.min(width * 0.62, height * 0.66));
  const r = d / 2 - 10;
  const cx = width / 2;
  const cy = height * 0.6; // operator 31 okt: "te hoog, laten zakken"
  const ring = Skia.Path.Make();
  ring.addCircle(cx, cy, r);
  /* 24 u bovenaan (zoals de agenda), met de klok mee. */
  const pos = (m: number) => {
    const a = (m / 1440) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const last = items[items.length - 1];
  const lastSt = BREATH_STATES[last.key];
  /* Herinnering schuift binnen nadat de bolletjes er staan. */
  const bannerY = useSharedValue(isReduceMotion() ? 0 : -30);
  const bannerO = useSharedValue(isReduceMotion() ? 1 : 0);
  useEffect(() => {
    if (isReduceMotion()) return;
    bannerY.value = withDelay(500 + items.length * 650 + 300, withSpring(0, SPRING_POP));
    bannerO.value = withDelay(500 + items.length * 650 + 300, withTiming(1, { duration: 350 }));
  }, [bannerY, bannerO, items.length]);
  const bannerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bannerY.value }], opacity: bannerO.value }));
  return (
    <View style={{ width, height }}>
      <Canvas style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
        <Path path={ring} style="stroke" strokeWidth={8} color="rgba(255,255,255,0.09)" />
        <Circle cx={cx} cy={cy} r={r - 22} color="rgba(255,255,255,0.025)" />
      </Canvas>
      {(USES_12H ? ['12 AM', '6 AM', '12 PM', '6 PM'] : ['24', '6', '12', '18']).map((lbl, i) => {
        const p = pos(i * 360);
        const dx = (p.x - cx) * 0.78;
        const dy = (p.y - cy) * 0.78;
        return (
          <Text key={lbl} style={[s.dayHour, { left: cx + dx - 22, top: cy + dy - 9 }]}>
            {lbl}
          </Text>
        );
      })}
      {items.map((it, i) => {
        const p = pos(it.at);
        return <DayDot key={it.at} x={p.x} y={p.y} color={BREATH_STATES[it.key].accent} i={i} />;
      })}
      <View style={{ position: 'absolute', left: cx - r * 0.6, width: r * 1.2, top: cy - 26, alignItems: 'center' }} pointerEvents="none">
        <Text style={s.dayNext}>Next</Text>
        <Text style={s.dayName}>{last.label}</Text>
        <Text style={s.dayTime}>{hhmm(last.at)}</Text>
      </View>
      <Animated.View style={[s.banner, { top: Math.round(cy - r - 74) }, bannerStyle]} pointerEvents="none">
        <VibezGlass radius={18} level="normal" style={StyleSheet.absoluteFill} />
        <View style={[s.bannerDot, { backgroundColor: lastSt.accent }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.bannerTitle}>VIBEZCORE</Text>
          <Text style={s.bannerTxt} numberOfLines={1}>
            {`Time for ${last.label} · ${hhmm(last.at)}`}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

/* 31 okt 2026: het beeld loopt door tot bovenaan het scherm (achter de bovenbalk), zoals de intro's — geen harde rand
   onder "1 OF 4". `top` = waar de eigenlijke inhoud begint (onder de bovenbalk). */
function SceneView({ scene, height, top }: { scene: HowScene; height: number; top: number }) {
  if (scene.kind === 'photo') return <PhotoScene uri={scene.uri} height={height + top} />;
  const body =
    scene.kind === 'states' ? (
      <StatesScene mode={scene.mode} height={height} />
    ) : scene.kind === 'day' ? (
      <DayScene mode={scene.mode} height={height} />
    ) : null;
  const glow =
    scene.kind === 'phone' || scene.kind === 'duo'
      ? scene.accent
      : scene.kind === 'states'
        ? '#6E86AB'
        : scene.kind === 'day'
          ? BREATH_STATES[(scene.mode === 'breath' ? DAY_BREATH : DAY_STATE).slice(-1)[0].key].glow
          : '#E85252';
  if (body) {
    return (
      <View style={{ height: height + top }}>
        <LinearGradient colors={[rgba(glow, 0.3), 'rgba(10,10,10,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.round((height + top) * 0.8) }} />
        <View style={{ position: 'absolute', top, left: 0, right: 0 }}>{body}</View>
      </View>
    );
  }
  if (scene.kind === 'heart') {
    const stage = Math.round(Math.min(height * 0.62, 260));
    return (
      <View style={{ height: height + top, overflow: 'hidden' }}>
        <LinearGradient colors={['rgba(232,82,82,0.18)', 'rgba(10,10,10,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height + top }} />
        <View style={{ position: 'absolute', top, left: 0, right: 0, height, alignItems: 'center', justifyContent: 'center' }}>
          <HeartbeatHero stage={stage} />
        </View>
      </View>
    );
  }
  if (scene.kind === 'duo') {
    return (
      <View style={{ height: height + top, overflow: 'hidden' }}>
        <LinearGradient colors={[rgba(scene.accent, 0.22), 'rgba(10,10,10,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height + top }} />
        <View style={{ position: 'absolute', top: top + 4, left: 0, right: 0 }}>
          <HowPhonesDuo mode={scene.mode} height={height - 8} />
        </View>
      </View>
    );
  }
  if (scene.kind !== 'phone') return null;
  return (
    <View style={{ height: height + top, alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' }}>
      <LinearGradient colors={[scene.accent + '30', 'rgba(10,10,10,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height + top }} />
      <View style={{ marginTop: top + 6 }}>
        <PhoneMockup mock={{ kind: scene.mock, accent: scene.accent }} height={Math.round(height * 1.25)} />
      </View>
      <LinearGradient
        colors={['rgba(10,10,10,0)', Brand.bg]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.round(height * 0.35) }}
      />
    </View>
  );
}

export default function HowItWorks({ steps, a11yName }: { steps: HowStep[]; a11yName: string }) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const cur = steps[step];
  const last = step === steps.length - 1;
  const leaving = useRef(false);
  const close = () => {
    if (leaving.current) return;
    leaving.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/settings' as never);
  };
  const next = () => (last ? close() : setStep((s0) => s0 + 1));
  const back = () => (step === 0 ? close() : setStep((s0) => s0 - 1));
  /* Beeld: ruim de helft van het scherm onder de bovenbalk; de tekst staat eronder op de achtergrond. */
  /* Beeld: 46% van het scherm; enkel kleiner als de tekst anders niet past (operator 31 okt: "alle teksten op alle schermen
     zonder scroll direct leesbaar; foto mag kleiner als het moet"). De tekst wordt per pagina gemeten; minimum 28%. */
  const [textH, setTextH] = useState<Record<string, number>>({});
  const sceneTop = insets.top + 44;
  const avail = winH - sceneTop - insets.bottom - 82;
  const measured = textH[cur.key];
  const sceneH = Math.round(measured ? Math.max(winH * 0.28, Math.min(winH * 0.46, avail - measured + 8)) : winH * 0.46);
  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <Animated.View key={cur.key} entering={FadeIn.duration(450)} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <SceneView scene={cur.scene} height={sceneH} top={sceneTop} />
      </Animated.View>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.topbar}>
          <View style={s.side}>
            <Tap onPress={back} hitSlop={14} style={s.backBtn} accessibilityRole="button" accessibilityLabel={step === 0 ? 'Close' : 'Back'}>
              <ChevronLeft size={18} color={Brand.textDim} strokeWidth={2.2} />
              <Text style={s.backTxt}>{step === 0 ? 'Close' : 'Back'}</Text>
            </Tap>
          </View>
          <View style={s.center} pointerEvents="none">
            <Text style={s.stepEyebrow}>{`${step + 1} OF ${steps.length}`}</Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${((step + 1) / steps.length) * 100}%` }]} />
            </View>
          </View>
          <View style={[s.side, { alignItems: 'flex-end' }]}>
            {!last ? (
              <Tap onPress={close} hitSlop={14} style={s.skipWrap} accessibilityRole="button" accessibilityLabel={`Close ${a11yName}`}>
                <Text style={s.skipTxt}>Done</Text>
              </Tap>
            ) : null}
          </View>
        </View>
        <View style={{ height: sceneH - 8 }} pointerEvents="box-none" />
        <ScrollView key={step} style={{ flex: 1 }} contentContainerStyle={s.content} alwaysBounceVertical={false} showsVerticalScrollIndicator={false}>
          <View
            style={{ gap: 10 }}
            onLayout={(e) => {
              const h = Math.ceil(e.nativeEvent.layout.height) + 12;
              const k = cur.key;
              setTextH((m) => (m[k] === h ? m : { ...m, [k]: h }));
            }}
          >
          <Animated.View entering={enter(1)}>
            <Text style={s.eyebrow}>{cur.eyebrow}</Text>
            <Text style={s.title}>{cur.title}</Text>
          </Animated.View>
          <Animated.View entering={enter(2)}>
            <BalancedText style={s.sub}>{cur.sub}</BalancedText>
          </Animated.View>
          {cur.body || cur.note || cur.chips ? (
            <Animated.View entering={enter(3)}>
              {cur.body ? <BalancedText style={s.body}>{cur.body}</BalancedText> : null}
              {cur.chips ? (
                <View style={s.chips}>
                  {cur.chips.map((c) => (
                    <View key={c} style={s.chip}>
                      <Text style={s.chipTxt}>{c}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {cur.note ? <Text style={s.note}>{cur.note}</Text> : null}
            </Animated.View>
          ) : null}
          </View>
        </ScrollView>
        <View style={s.footer}>
          <Animated.View key={step} entering={enter(4)}>
            <PressScale onPress={next} scaleTo={0.97} style={s.ctaWrap} accessibilityRole="button" accessibilityLabel={last ? 'Done' : 'Next'}>
              <View style={s.cta}>
                <Text style={s.ctaTxt}>{last ? 'Done' : 'Next'}</Text>
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
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10, zIndex: 2 },
  side: { minWidth: 64 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 4, alignSelf: 'flex-start' },
  backTxt: { color: Brand.textDim, fontFamily: BrandFonts.medium, fontSize: 14 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  stepEyebrow: { marginTop: 2, color: '#ffffff', fontFamily: BrandFonts.bold, fontSize: 9, letterSpacing: 2 },
  track: { width: 120, height: 1.5, borderRadius: 0.75, marginTop: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.15)' },
  fill: { height: '100%', borderRadius: 0.75, backgroundColor: '#ffffff' },
  skipWrap: { paddingVertical: 6, paddingHorizontal: 8 },
  skipTxt: { color: 'rgba(255,255,255,0.92)', fontFamily: BrandFonts.semibold, fontSize: 15 },
  content: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: 26, paddingBottom: 12 },
  eyebrow: { fontFamily: BrandFonts.bold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)', marginBottom: 6 },
  title: { ...TypeScale.pageHeader, fontFamily: BrandFonts.bold, fontSize: 25, lineHeight: 31, textAlign: 'left', color: Brand.text },
  sub: { marginTop: 2, fontFamily: BrandFonts.semibold, fontSize: 17, lineHeight: 24, textAlign: 'left', color: 'rgba(255,255,255,0.92)' },
  body: { marginTop: 4, fontFamily: BrandFonts.regular, fontSize: 14.5, lineHeight: 21, textAlign: 'left', color: 'rgba(255,255,255,0.6)' },
  note: { marginTop: 12, fontFamily: BrandFonts.medium, fontSize: 13, letterSpacing: 0.2, color: 'rgba(255,255,255,0.5)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { height: 32, paddingHorizontal: 13, borderRadius: 999, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  chipTxt: { fontFamily: BrandFonts.semibold, fontSize: 13, color: 'rgba(255,255,255,0.88)' },
  footer: { paddingHorizontal: 26, paddingBottom: 22, paddingTop: 8 },
  ctaWrap: { borderRadius: 999, backgroundColor: CTA_GLASS, ...CTA_GLOW },
  cta: { alignItems: 'center', justifyContent: 'center', borderRadius: 999, height: 52 },
  ctaTxt: { color: '#0a0a0a', fontFamily: BrandFonts.semibold, fontSize: 15, letterSpacing: 0.1 },
  orbName: { fontFamily: BrandFonts.bold, fontSize: 13, letterSpacing: 1.6 },
  orbLine: { marginTop: 6, fontFamily: BrandFonts.medium, fontSize: 14, lineHeight: 20, textAlign: 'center', color: 'rgba(255,255,255,0.7)' },
  chartTrack: { height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  chartSeg: { position: 'absolute', height: 2, borderRadius: 1, opacity: 0.85 },
  chartRest: { position: 'absolute', top: 1, width: 2, height: 20, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.8)' },
  chartVal: { position: 'absolute', bottom: 2, width: 120, textAlign: 'center', fontFamily: BrandFonts.bold, fontSize: 15 },
  chartTick: { position: 'absolute', width: 32, textAlign: 'center', fontFamily: BrandFonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  chartCap: { marginTop: 8, textAlign: 'center', fontFamily: BrandFonts.regular, fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.45)' },
  dayHour: { position: 'absolute', width: 44, textAlign: 'center', fontFamily: BrandFonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  dayNext: { fontFamily: BrandFonts.semibold, fontSize: 11, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)' },
  dayName: { marginTop: 4, fontFamily: BrandFonts.bold, fontSize: 20, color: '#ffffff' },
  dayTime: { marginTop: 2, fontFamily: BrandFonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.65)' },
  banner: { position: 'absolute', left: 26, right: 26, height: 56, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  bannerDot: { width: 10, height: 10, borderRadius: 5 },
  bannerTitle: { fontFamily: BrandFonts.bold, fontSize: 11, letterSpacing: 1.2, color: 'rgba(255,255,255,0.6)' },
  bannerTxt: { marginTop: 2, fontFamily: BrandFonts.semibold, fontSize: 14, color: '#ffffff' },
});
