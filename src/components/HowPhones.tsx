/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — twee telefoons voor "How it works" pagina 2 (31 okt 2026)

   Operator: "gebruik dan tenminste de schermen zoals hier [vibezcore.com], niet exact dezelfde intro-schermen van de
   app". Daarom dezelfde opbouw als de telefoon-demo's op de homepage (vzd-breathwork / vzd-state-control):
   - links de saleskaart: foto, label met stip, kop, kenmerken als pillen, witte knop, korte regel;
   - rechts de lopende sessie: Breathwork = ademfiguur + boog + seconden, State Control = kloppende cirkel + horloge.
   Alles wordt op ontwerpmaat getekend (telefoon 403 × 840, scherm 375 × 812, zoals op de website) en als één geheel
   geschaald naar de beschikbare ruimte, dus het past op elk scherm. Het horloge is bewust generiek (geen kroon, geen
   merkontwerp), zoals in de app-intro. Alles staat stil bij "beweging verminderen"; er wordt nooit getrild.
   ───────────────────────────────────────────────────────────────────────── */

import { HapticPulseRings, HeartbeatScale } from '@/components/HapticPulseRings';
import { BrandFonts } from '@/constants/theme';
import { isReduceMotion } from '@/constants/motion';
import { BraceletMode } from '@/services/ble-contract';
import { emitVisualPulse, rhythmFor } from '@/services/bracelet-haptics';
import { imageSource } from '@/utils/image-source';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Mic, Pause, Play, Settings, SlidersHorizontal, Smartphone, Vibrate, Watch, Zap } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

const PW = 403; // telefoon buitenmaat (website)
const PH = 840;
const SW = 375; // scherm
const SH = 812;
const GAP = 28;
const DUO_W = PW * 2 + GAP;

const BOOST = '#F5A524';
const TEAL = '#00A3A3';

function useTick(ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (isReduceMotion()) return undefined;
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}
const mss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/* Titanium toestel zoals op de website: lichte titaniumrand, zwarte binnenrand, zijknoppen, eiland, statusbalk. */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.phoneWrap}>
      <View style={[s.btn, { left: -4, top: 120, height: 28 }]} />
      <View style={[s.btn, { left: -4, top: 168, height: 52 }]} />
      <View style={[s.btn, { left: -4, top: 230, height: 52 }]} />
      <View style={[s.btn, { right: -4, top: 190, height: 80 }]} />
      <LinearGradient
        colors={['#cfc6b8', '#9e9587', '#6b645a', '#7f776c', '#a89f91', '#c7bdae']}
        locations={[0, 0.16, 0.42, 0.62, 0.84, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.phone}
      >
        <View style={s.bezel}>
          <View style={s.screen}>
            {children}
            <View pointerEvents="none" style={s.statusbar}>
              <Text style={s.time}>9:41</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 }}>
                  {[5, 7, 9, 11].map((h) => (
                    <View key={h} style={{ width: 3, height: h, borderRadius: 0.6, backgroundColor: '#fff' }} />
                  ))}
                </View>
                <View style={{ width: 22, height: 11, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', padding: 1.5 }}>
                  <View style={{ flex: 1, borderRadius: 1.5, backgroundColor: '#fff' }} />
                </View>
              </View>
            </View>
            <View pointerEvents="none" style={s.island} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

type Card = { uri: string; accent: string; eyebrow: string; title: string; chips: { label: string; icon: 'phone' | 'watch' | 'voice' | 'haptics' }[]; cta: string; ctaIcon: 'play' | 'bolt'; sub: string; imgTop: number; imgH: number };

/* De saleskaart (linker telefoon): foto bovenaan die uitloopt in zwart, tekst eronder op het zwart. */
function HeroCard({ c }: { c: Card }) {
  const Icon = { phone: Smartphone, watch: Watch, voice: Mic, haptics: Vibrate };
  return (
    <View style={{ width: SW, height: SH, backgroundColor: '#000' }}>
      <Image source={imageSource(c.uri)} style={{ position: 'absolute', left: 0, top: SH * c.imgTop, width: SW, height: SH * c.imgH }} resizeMode="cover" />
      {/* foto loopt zacht uit in zwart (website: mask 72% → transparant), geen harde onderrand */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', '#000']}
        style={{ position: 'absolute', left: 0, right: 0, top: SH * (c.imgTop + c.imgH * 0.6), height: SH * c.imgH * 0.4 + 2 }}
      />
      <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 120 }} />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)', '#000']}
        locations={[0, 0.38, 0.78, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: SH * 0.62 }}
      />
      <View style={{ position: 'absolute', left: 28, right: 28, bottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent, shadowColor: c.accent, shadowOpacity: 1, shadowRadius: 6 }} />
          <Text style={s.eye}>{c.eyebrow}</Text>
        </View>
        <Text style={s.cardTitle}>{c.title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
          {c.chips.map((ch) => {
            const I = Icon[ch.icon];
            return (
              <View key={ch.label} style={s.chip}>
                <I size={16} color="#fff" strokeWidth={1.8} />
                <Text style={s.chipTxt}>{ch.label}</Text>
              </View>
            );
          })}
        </View>
        <View style={s.cta}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            {c.ctaIcon === 'bolt' ? <Zap size={14} color="#fff" fill="#fff" /> : <Play size={13} color="#fff" fill="#fff" />}
          </View>
          <Text style={s.ctaTxt}>{c.cta}</Text>
        </View>
        <Text style={s.cardSub}>{c.sub}</Text>
      </View>
    </View>
  );
}

/* State Control · Boost: kloppende cirkel met de echte pulsgolf (zelfde componenten als de sessie), tijd telt af. */
function StateSession({ left }: { left: number }) {
  const D = 264;
  return (
    <View style={{ width: SW, height: SH, backgroundColor: '#000' }}>
      <View style={{ position: 'absolute', left: 18, top: 64 }}>
        <ChevronDown size={30} color="#fff" strokeWidth={2.2} />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 62, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BOOST }} />
        <Text style={{ color: '#fff', fontFamily: BrandFonts.bold, fontSize: 15, letterSpacing: 0.2 }}>Boost</Text>
      </View>
      <View style={{ position: 'absolute', left: (SW - D) / 2, top: 184, width: D, height: D, alignItems: 'center', justifyContent: 'center' }}>
        <HapticPulseRings size={D} color={BOOST} beatSynced />
        <HeartbeatScale size={D}>
          <View style={{ width: D, height: D, borderRadius: D / 2, overflow: 'hidden', borderWidth: 3, borderColor: BOOST }}>
            <LinearGradient colors={['#6e4a12', '#4a300a', '#3d2708']} locations={[0, 0.7, 1]} style={StyleSheet.absoluteFill} />
          </View>
        </HeartbeatScale>
        <Text style={{ position: 'absolute', color: '#fff', fontFamily: BrandFonts.extrabold, fontSize: 68, letterSpacing: -2.5 }}>{mss(left)}</Text>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 44, alignItems: 'center' }}>
        <View style={s.av}>
          <SlidersHorizontal size={16} color="rgba(255,255,255,0.75)" />
          <Text style={s.avTxt}>Audio &amp; Haptics</Text>
        </View>
        <View style={[s.pause, { width: 72, height: 72, borderRadius: 36, backgroundColor: '#3a2a10' }]}>
          <Pause size={24} color="#fff" fill="#fff" />
        </View>
        <Text style={[s.end, { marginTop: 22 }]}>END SESSION</Text>
      </View>
    </View>
  );
}

/* Horloge zoals op de website (operator 31 okt: "de armband van de smartwatch is echt niet goed"): de gefotografeerde
   smartwatch van vibezcore.com (assets/how/watch.png, kroon weggewerkt — geen merkontwerp), met het app-scherm erachter
   door het transparante venster. Zelfde plek en maten als op de website (230 × 361, scherm 12,86 % / 21,8 % / 74,1 % / 56,25 %). */
const WATCH_IMG = require('../../assets/how/watch.png');
function WatchMock({ left }: { left: number }) {
  const W = 230;
  const H = 361;
  const ring = 104;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 312, top: 269, width: W, height: H }}>
      <View
        style={{
          position: 'absolute',
          left: W * 0.1286,
          top: H * 0.218,
          width: W * 0.741,
          height: H * 0.5625,
          borderRadius: 30,
          backgroundColor: '#000',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BOOST }} />
          <Text style={{ color: '#fff', fontFamily: BrandFonts.semibold, fontSize: 14 }}>Boost</Text>
        </View>
        <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
          <HeartbeatScale size={ring}>
            <View style={{ width: ring, height: ring, borderRadius: ring / 2, borderWidth: 6, borderColor: BOOST, backgroundColor: 'rgba(245,165,36,0.14)' }} />
          </HeartbeatScale>
          <Text style={{ position: 'absolute', color: '#fff', fontFamily: BrandFonts.bold, fontSize: 28, letterSpacing: -1 }}>{mss(left)}</Text>
        </View>
      </View>
      <Image source={WATCH_IMG} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} resizeMode="contain" />
    </View>
  );
}

/* Breathwork · Clarity & Relax: de ademfiguur zwelt aan en slinkt (4 s in / 6 s uit, zoals de website-demo), boog + seconden lopen mee. */
function BreathSession() {
  const IN = 4;
  const OUT = 6;
  const C = IN + OUT;
  const n = useTick(100);
  const t = (n * 0.1) % C;
  const inhale = t < IN;
  const lt = inhale ? t / IN : (t - IN) / OUT;
  const value = Math.max(0, (inhale ? IN : OUT) * (1 - lt)).toFixed(1);
  const sec = Math.floor(n * 0.1);
  const leftSec = Math.max(0, 300 - sec);
  const round = Math.min(30, 1 + Math.floor(sec / C));
  const sc = useSharedValue(0.65);
  useEffect(() => {
    if (isReduceMotion()) {
      sc.value = 0.85;
      return;
    }
    sc.value = withRepeat(
      withSequence(withTiming(1, { duration: IN * 1000, easing: Easing.out(Easing.sin) }), withTiming(0.65, { duration: OUT * 1000, easing: Easing.out(Easing.sin) })),
      -1,
      false,
    );
  }, [sc]);
  const fig = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  const glow = useAnimatedStyle(() => {
    const g = Math.max(0, Math.min(1, (sc.value - 0.65) / 0.35));
    return { opacity: 0.08 + g * 0.47, transform: [{ scale: 0.3 + g * 0.85 }] };
  });
  const stars = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ x: (i * 73.13) % 100, y: (i * 37.71 + (i % 7) * 11) % 100, o: 0.25 + ((i * 17) % 55) / 100 })), []);
  const dash = 320;
  return (
    <View style={{ width: SW, height: SH, backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
      {stars.map((st, i) => (
        <View key={i} style={{ position: 'absolute', left: `${st.x}%`, top: `${st.y}%`, width: 1.6, height: 1.6, borderRadius: 1, backgroundColor: '#E9E9EE', opacity: st.o }} />
      ))}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 62, height: 34, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontFamily: BrandFonts.bold, fontSize: 12, letterSpacing: 1.4 }}>CLARITY &amp; RELAX</Text>
      </View>
      <View style={{ position: 'absolute', right: 18, top: 70 }}>
        <Settings size={17} color="rgba(255,255,255,0.72)" />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 114, height: 250, alignItems: 'center', justifyContent: 'center' }}>
        {/* gloed als radiaal verloop (geen afgeknipte grote View: die liet de emulator-GPU vastlopen) */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 509, height: 509 }, glow]}>
          <Svg width={509} height={509}>
            <Defs>
              <RadialGradient id="g" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={0.5} />
                <Stop offset="0.68" stopColor="#ffffff" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={254.5} cy={254.5} r={254.5} fill="url(#g)" />
          </Svg>
        </Animated.View>
        <Animated.View style={fig}>
          <Image source={imageSource('https://vibezcore-audio.b-cdn.net/images/pic%20calm%20relax%202.png')} style={{ width: 250, height: 250 }} resizeMode="contain" />
        </Animated.View>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 374, alignItems: 'center' }}>
        <View style={{ width: 216, height: 112 }}>
          <Svg width={216} height={112} style={StyleSheet.absoluteFill}>
            <Path d="M 6 106 A 102 102 0 0 1 210 106" stroke="rgba(255,255,255,0.10)" strokeWidth={3} fill="none" strokeLinecap="round" />
            <Path d="M 6 106 A 102 102 0 0 1 210 106" stroke="#FFFFFF" strokeWidth={3.6} fill="none" strokeLinecap="round" strokeDasharray={`${dash}`} strokeDashoffset={dash * (1 - lt)} />
          </Svg>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 2, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontFamily: BrandFonts.extrabold, fontSize: 42, letterSpacing: -1 }}>{value}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontFamily: BrandFonts.bold, fontSize: 10, letterSpacing: 1, marginTop: -4 }}>SEC</Text>
          </View>
        </View>
        <Text style={{ color: '#fff', fontFamily: BrandFonts.bold, fontSize: 14, letterSpacing: 0.6, marginTop: 16 }}>{inhale ? 'INHALE · NOSE' : 'EXHALE · NOSE'}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontFamily: BrandFonts.medium, fontSize: 12, marginTop: 6 }}>{`ROUND ${round}/30 · ${mss(leftSec)} left`}</Text>
        <View style={[s.av, { marginTop: 28, marginBottom: 0, backgroundColor: 'rgba(255,255,255,0.04)' }]}>
          <SlidersHorizontal size={14} color="rgba(255,255,255,0.75)" />
          <Text style={[s.avTxt, { fontSize: 12 }]}>Voice &amp; Haptics</Text>
        </View>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 44, alignItems: 'center' }}>
        <View style={[s.pause, { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Pause size={24} color="#fff" fill="#fff" />
        </View>
        <Text style={[s.end, { marginTop: 14 }]}>END SESSION</Text>
      </View>
    </View>
  );
}

const CARD_BREATH: Card = {
  uri: 'https://vibezcore-audio.b-cdn.net/images/pic%20hero%20breathwork%20welcome%203.png',
  accent: TEAL,
  eyebrow: 'GUIDED BREATHWORK',
  title: 'Breathe with\nintention',
  chips: [
    { label: 'Voice', icon: 'voice' },
    { label: 'Haptics', icon: 'haptics' },
  ],
  cta: 'Start Clarity & Relax',
  ctaIcon: 'play',
  sub: '15 techniques · 5 states',
  imgTop: 0,
  imgH: 0.8,
};
const CARD_STATE: Card = {
  /* operator 31 okt: dezelfde foto als pagina 1 (Pic hero state control app) */
  uri: 'https://vibezcore-audio.b-cdn.net/images/Pic%20hero%20state%20control%20app%20.png',
  accent: BOOST,
  eyebrow: 'STATE CONTROL',
  title: 'Boost\non demand',
  chips: [
    { label: 'Phone', icon: 'phone' },
    { label: 'Smartwatch', icon: 'watch' },
  ],
  cta: 'Start Boost',
  ctaIcon: 'bolt',
  sub: 'Research-based haptic rhythm',
  imgTop: 0,
  imgH: 0.8,
};

/* Het hele tafereel op ontwerpmaat (834 × 840) en als één geheel geschaald naar de ruimte. */
export function HowPhonesDuo({ mode, height }: { mode: 'breath' | 'state'; height: number }) {
  const { width } = useWindowDimensions();
  const k = Math.min((width - 40) / DUO_W, height / PH);
  const n = useTick(1000);
  const left = 8 * 60 + 37 - n;
  /* Boost-tempo voor de kloppende cirkel en het horloge (enkel beeld; er wordt niets getrild). */
  useEffect(() => {
    if (mode !== 'state' || isReduceMotion()) return undefined;
    const { targetBpm } = rhythmFor(BraceletMode.Gamma, 70);
    const cycleMs = Math.round(60000 / targetBpm);
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const beat = () => {
      if (!alive) return;
      emitVisualPulse({ kind: 'lub', mode: BraceletMode.Gamma, cycleMs, atMs: Date.now() });
      setTimeout(() => {
        if (alive) emitVisualPulse({ kind: 'dub', mode: BraceletMode.Gamma, cycleMs, atMs: Date.now() });
      }, Math.round(Math.min(cycleMs * 0.3, 350)));
      timer = setTimeout(beat, cycleMs);
    };
    beat();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [mode]);
  return (
    <View style={{ width, height, overflow: 'visible' }}>
      <View style={{ position: 'absolute', left: (width - DUO_W) / 2, top: (height - PH) / 2, width: DUO_W, height: PH, transform: [{ scale: k }] }}>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <Phone>
            <HeroCard c={mode === 'state' ? CARD_STATE : CARD_BREATH} />
          </Phone>
          <Phone>{mode === 'state' ? <StateSession left={Math.max(0, left)} /> : <BreathSession />}</Phone>
        </View>
        {mode === 'state' ? <WatchMock left={Math.max(0, left)} /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  phoneWrap: { width: PW, height: PH, shadowColor: '#000', shadowOpacity: 0.75, shadowRadius: 30, shadowOffset: { width: 0, height: 24 }, elevation: 18 },
  btn: { position: 'absolute', width: 4, borderRadius: 2, backgroundColor: '#8f877b' },
  phone: { flex: 1, borderRadius: 62, padding: 6 },
  bezel: { flex: 1, borderRadius: 56, backgroundColor: '#000', padding: 8 },
  screen: { width: SW, height: SH, borderRadius: 48, overflow: 'hidden', backgroundColor: '#000' },
  statusbar: { position: 'absolute', top: 0, left: 0, right: 0, height: 50, paddingHorizontal: 30, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  time: { color: '#fff', fontFamily: BrandFonts.semibold, fontSize: 15 },
  island: { position: 'absolute', top: 14, alignSelf: 'center', left: (SW - 100) / 2, width: 100, height: 29, borderRadius: 16, backgroundColor: '#000' },
  eye: { color: 'rgba(255,255,255,0.85)', fontFamily: BrandFonts.bold, fontSize: 12, letterSpacing: 2.6 },
  cardTitle: { marginTop: 12, color: '#fff', fontFamily: BrandFonts.bold, fontSize: 38, lineHeight: 40, letterSpacing: -1.1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  chipTxt: { color: '#fff', fontFamily: BrandFonts.semibold, fontSize: 14 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, marginTop: 22, borderRadius: 999, backgroundColor: '#fff' },
  ctaTxt: { color: '#1D1D1F', fontFamily: BrandFonts.semibold, fontSize: 17 },
  cardSub: { marginTop: 12, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontFamily: BrandFonts.regular, fontSize: 13 },
  av: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 20, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#1b1b1f', marginBottom: 22 },
  avTxt: { color: 'rgba(255,255,255,0.75)', fontFamily: BrandFonts.semibold, fontSize: 13.5 },
  pause: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  end: { color: 'rgba(255,255,255,0.72)', fontFamily: BrandFonts.semibold, fontSize: 11, letterSpacing: 1.8 },
});
