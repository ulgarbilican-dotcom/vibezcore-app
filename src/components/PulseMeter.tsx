/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — pols meten met de camera ("Match your rhythm" fase 2,
   operator, 7 okt 2026).

   De achtercamera draait zonder beeld op het scherm (de vinger bedekt de
   lens toch), met de zaklamp aan. Per beeld gaat enkel de gemiddelde rood-
   en groenwaarde van het midden naar JS — geen beelden, niets bewaard.
   De berekening zelf staat in utils/pulse-detect.ts.

   Verloop: vinger erop → 0,5 s stil → 20 s meten (ring loopt vol, het hart
   klopt mee op de gevonden slagen) → uitkomst. Vinger weg = de ring
   begint opnieuw. Lukt het na 25 s niet: eerlijk "opnieuw proberen".
   Tijdens het meten GEEN trillingen: die zouden de vinger doen bewegen. */

import { ECG_SHAPE } from '@/utils/ecg-shape';
import FingerPlacementAnim from '@/components/FingerPlacementAnim';
import { heartbeatTick, startHeartbeatSound, stopHeartbeatSound } from '@/services/heartbeat-sound';
import { hapticTap } from '@/utils/haptics';
import PressScale from '@/components/PressScale';
import * as Haptics from 'expo-haptics';
import { BrandFonts } from '@/constants/theme';
import { analyzePulse, fingerOnLens, robustPulse, timestampScaleToMs, type PulseSample } from '@/utils/pulse-detect';
import { ChevronRight, CircleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Dimensions, Easing, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useCamera, useCameraPermission, useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import Reanimated, {
  Easing as ReEasing,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/* Batterij: zit pas in de build vanaf deze ronde — in een oudere build
   ontbreekt de native kant, dan gewoon geen batterijhint. */
let Battery: typeof import('expo-battery') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Battery = require('expo-battery');
} catch {
  Battery = null;
}
/* Operator, 9 okt 2026 ("bij 7% gaat de zaklamp niet aan en weet ik als
   gebruiker niet waarom"): veel toestellen (o.a. Samsung) blokkeren de
   flitser bij een bijna lege batterij. Onder deze grens zeggen we dat. */
const LOW_BATTERY = 0.2;
/* ── Flits-beslisregel (operator, 10 okt 2026: "een correct werkend systeem,
   denk 10 stappen vooruit") ─────────────────────────────────────────────
   Uit het camerabeeld alleen kun je "flits uit" niet onderscheiden van
   "vinger naast de flits": in beide gevallen is het beeld donker. Daarom
   melden we "Flash unavailable" enkel bij HARD bewijs, en nooit zodra er
   ook maar één keer flitslicht door een vinger gezien is:
   1. Flitslicht gezien (fel rood beeld: r > 120 en duidelijk roder dan
      groen) → de flits werkt; deze poging nooit een flits-melding.
   2. De camera meldt minstens 2× een zaklamp-fout → flits-melding.
   3. Batterij laag (≤ 20 %, toestellen verschillen: Samsung ±15 %, andere
      5–10 %) ÉN het beeld ≥ 8 s aan één stuk pikzwart (r < 35, g < 30) →
      flits-melding. Pikzwart = er komt geen licht door de vinger.
   4. Al het andere (batterij oké, of onbekend) → gewoon de plaats-hint,
      geen foutscherm: dan ligt het bijna altijd aan de vingerpositie.
   Bij een mislukte meting geldt dezelfde regel: enkel de batterij-uitleg
   als de batterij laag is én er nooit flitslicht gezien werd. */
const FLASH_LIGHT_R = 120;
const BLACK_R = 35;
const BLACK_G = 30;
const DARK_HOLD_MS = 8000;
const TORCH_ERRORS_NEEDED = 2;

/* Operator, 9 okt 2026: "desnoods mag de meting langer duren, als ze maar
   correct is" — 20 s meten, tot 35 s als de controle niet klopt. */
/* Vervolg (operator, 9 okt 2026: "de meting moet exact 30 seconden in
   totaal duren, elke keer"): vaste 30 s, geen verlenging. */
const MEASURE_MS = 30_000;
const MAX_MS = 30_000;
const SETTLE_MS = 500; // 9 okt 2026: "bpm begint te laat" (was 1 s)
/** Zo lang mag de vinger even wegglijden voor de meting opnieuw begint. */
const LOST_GRACE_MS = 700;
// Was 240 (9 okt 2026: "cirkel iets groter").
/* Vervolg (operator, 9 okt 2026: "de layout van de Resting Heart Rate-pagina
   is beter, de pieken zijn groter"): de hartlijn loopt nu over de volle
   breedte achter de ring door, met grote pieken links en rechts ervan —
   daarvoor is de ring iets kleiner. */
const RING_LINE = 196;
const HEART = 74;
/* Operator, 9 okt 2026 ("ring dunner, eleganter"). */
const STROKE = 2; // vervolg 9 okt 2026: "groene vullende lijn mag dunner"
const ACCENT = '#4AF0D4';
const IDLE_GREY = 'rgba(255,255,255,0.32)';
/* Het lucide-hart (zelfde vorm als de <Heart>-iconen), herschreven zodat
   het pad BOVENAAN in het midden (de inkeping) begint en daar eindigt —
   omtrek ≈ 59 in 24-eenheden. */
const LUCIDE_HEART_D =
  'M12 6.0015A.56 .56 0 0 0 12.409 5.824A5.49 5.49 0 0 1 22 9.5C22 11.79 20.5 13.5 19 15L13.508 20.313A2 2 0 0 1 10.508 20.332L5 15C3.5 13.5 2 11.8 2 9.5A5.5 5.5 0 0 1 11.591 5.824A.56 .56 0 0 0 12 6.0015';
const HEART_LEN = 59.1;
/** Deel van de meting waarin de omtrek zich tekent; daarna de vulling. */
const OUTLINE_SHARE = 0.25;
/* Vaste objecten: de camera-hooks herconfigureren bij elke nieuwe referentie. */
const FRAME_SIZE = { width: 320, height: 240 };
const CONSTRAINTS = [{ fps: 30 }];
/* Android: Frame.getPixelBuffer() kiest daar de HardwareBuffer-weg, die
   Nitro pas vanaf minSdk 26 ondersteunt (wij: 24) → "requires NDK API 26".
   Het (enige) RGBA-vlak lezen gaat via een gewone ByteBuffer en werkt wel. */
const READ_VIA_PLANE = Platform.OS === 'android';

type Status = 'placing' | 'settling' | 'measuring' | 'failed' | 'denied' | 'camera-error';

type Props = {
  onResult: (bpm: number) => void;
  /** "Enter it myself" vanuit een fout- of weigerstatus. */
  onManual: () => void;
  /** Foutscherm aan/uit — het blad verbergt dan zijn meetuitleg. */
  onErrorChange?: (isError: boolean) => void;
};

/* Operator, 9 okt 2026 ("pieken onderaan zoals op de vorige pagina"):
   bijna schermbreed en hoger, zelfde dikte/verloop als de rustpagina. */
/* Operator, 10 okt 2026 ("vulling zoals nu of dunner — hoe doet Apple
   dat?"): dunner, zelfde lijndikte als de duurring op het State Control-
   scherm (2), zodat alle ringen in de app één familie zijn. */
const PROG_W = 2;
const PROG_CIRC = Math.PI * (RING_LINE - PROG_W);
const ECG_W = Math.round(Dimensions.get('window').width);
const ECG_H = 132;
/* Schrijfpunt rechts van de ring, zoals op de Resting Heart Rate-pagina. */
const ECG_HX = Math.round(ECG_W * 0.86);
/* De lijn verdwijnt achter de ring (niets tekenen binnen deze straal).
   Operator, 10 okt 2026: kort door de ring heen geprobeerd ("nu te druk") —
   terug achter de cirkel. */
const ECG_GAP_R = RING_LINE / 2 + 6;
/* 9 okt 2026: "trager van rechts naar links"; vervolg: "pieken zo kort
   opeen" → ~90 pt per seconde (bij 76 bpm ≈ 70 pt tussen twee slagen). */
const ECG_WINDOW_MS = Math.round(ECG_HX / 0.09);
/* Eén hartslag (P-golf, QRS-piek, T-golf): [ms t.o.v. de piek, hoogte −1…1]. */
/* Vorm van één slag: gedeeld met het andere scherm (utils/ecg-shape). */
const PQRST = ECG_SHAPE;

/* Vervolg (operator: "maak de animatie vloeiend"): de lijn wordt op de
   UI-thread getekend (Reanimated), los van de camera-verwerking op de
   JS-thread. Slagen krijgen hun echte tijdstip en verschijnen met een
   vaste vertraging, zodat elke piek netjes rechts binnenschuift. */
const ECG_DELAY_MS = 700;
const AnimatedPath = Reanimated.createAnimatedComponent(Path);
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

/** Eén slag op de lijn: tijdstip (Date.now-klok) + hoogte (1 = echte slag). */
type EcgBeat = { t: number; a: number; soft?: boolean };
/* Voorlopige, rustige slag zodra de vinger ligt (klein op de lijn). */
const SOFT_BEAT_MS = 1090; // ≈55 bpm
const SOFT_BEAT_AMP = 0.22;
/* Operator, 9 okt 2026 ("zodra de outline rond is, moeten de pieken hoger
   en groter worden — zoals iemand die gereanimeerd wordt: eerst een beetje
   hartslag, dan meer"): elke piek krijgt de hoogte van het moment waarop
   hij komt en houdt die. Tijdens het tekenen van de omtrek klein; daarna
   groeien ze in ~5 s naar volle hoogte. */
function ecgAmpAt(p: number) {
  if (p < OUTLINE_SHARE) return 0.3;
  /* Vervolg ("de hoge pieken mogen sneller verschijnen"): ~2 s i.p.v. ~5 s. */
  return Math.min(1, 0.7 + ((p - OUTLINE_SHARE) / 0.13) * 0.3);
}

function EcgTrace({ beats, running, progress }: { beats: EcgBeat[]; running: boolean; progress: number }) {
  const beatsSv = useSharedValue<EcgBeat[]>([]);
  const now = useSharedValue(0);
  const runningSv = useSharedValue(false);
  useEffect(() => {
    beatsSv.value = beats;
  }, [beats, beatsSv]);
  useEffect(() => {
    runningSv.value = running;
  }, [running, runningSv]);
  useFrameCallback(() => {
    now.value = Date.now();
  });

  /* Hoogte van de lijn op het schrijfpunt (tijd t0). Moet vóór de
     animatedProps staan: de worklet-omzetting hoist geen functies. */
  function headY(t0: number) {
    'worklet';
    const mid = ECG_H / 2;
    const amp = ECG_H / 2 - 4;
    if (runningSv.value) {
      const list = beatsSv.value;
      for (let i = 0; i < list.length; i++) {
        const dt = t0 - list[i].t;
        if (dt < PQRST[0][0] || dt > PQRST[PQRST.length - 1][0]) continue;
        for (let j = 1; j < PQRST.length; j++) {
          if (dt <= PQRST[j][0]) {
            const [ta, a0] = PQRST[j - 1];
            const [tb, a1] = PQRST[j];
            return mid - (a0 + ((a1 - a0) * (dt - ta)) / (tb - ta)) * amp * list[i].a;
          }
        }
      }
    }
    return mid - (0.6 * Math.sin(t0 / 150) + 0.35 * Math.sin(t0 / 63 + 1.3));
  }
  const animatedProps = useAnimatedProps(() => {
    const mid = ECG_H / 2;
    const amp = ECG_H / 2 - 4;
    const t0 = now.value - ECG_DELAY_MS;
    /* Schrijfpunt net binnen de rechterrand (operator: "je moet zien hoe de
       pieken vormen") — niets rechts ervan. */
    const HX = ECG_HX;
    const toX = (t: number) => HX - ((t0 - t) / ECG_WINDOW_MS) * HX;
    /* Operator, 9 okt 2026 ("de lijn mag al lopen van rechts naar links,
       zonder pieken, zolang er geen vinger is"): een heel lichte rimpeling
       in de basislijn, vast aan de tijd — zo zie je de lijn schuiven. */
    const noise = (t: number) => 0.6 * Math.sin(t / 150) + 0.35 * Math.sin(t / 63 + 1.3);
    const pts: number[][] = [];
    const windows: number[][] = [];
    if (runningSv.value) {
      const list = beatsSv.value;
      for (let i = 0; i < list.length; i++) {
        const from = toX(list[i].t + PQRST[0][0]);
        const to = toX(list[i].t + PQRST[PQRST.length - 1][0]);
        if (to < 0 || from > HX) continue;
        windows.push([from, to]);
        for (let j = 0; j < PQRST.length; j++) {
          const px = toX(list[i].t + PQRST[j][0]);
          if (px < 0 || px > HX) continue;
          pts.push([px, mid - PQRST[j][1] * amp * list[i].a]);
        }
      }
    }
    for (let x = 0; x <= HX; x += 3) {
      let inBeat = false;
      for (let k = 0; k < windows.length; k++) {
        if (x >= windows[k][0] && x <= windows[k][1]) {
          inBeat = true;
          break;
        }
      }
      if (!inBeat) pts.push([x, mid - noise(t0 - ((HX - x) / HX) * ECG_WINDOW_MS)]);
    }
    pts.sort((m, n) => m[0] - n[0]);
    /* Achter de ring: niets tekenen, de lijn gaat er "onderdoor". */
    const cx = ECG_W / 2;
    let d = '';
    let pen = false;
    for (let i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i][0] - cx) < ECG_GAP_R) {
        pen = false;
        continue;
      }
      d += `${pen ? ' L' : ' M'}${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
      pen = true;
    }
    d += ` L${HX} ${headY(t0).toFixed(1)}`;
    return { d };
  });
  const dotProps = useAnimatedProps(() => ({ cy: headY(now.value - ECG_DELAY_MS) }));
  const dotGlowProps = useAnimatedProps(() => ({ cy: headY(now.value - ECG_DELAY_MS) }));

  /* Operator, 9 okt 2026: de lijn blijft altijd groen. */
  const lineColor = ACCENT;
  const lineAlpha = 1;
  return (
    <Svg width={ECG_W} height={ECG_H} style={{ position: 'absolute', top: (RING_LINE - ECG_H) / 2 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="ecgFade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={ECG_W} y2="0">
          <Stop offset="0" stopColor={lineColor} stopOpacity={0} />
          <Stop offset="0.3" stopColor={lineColor} stopOpacity={0.8 * lineAlpha} />
          <Stop offset="0.85" stopColor={lineColor} stopOpacity={lineAlpha} />
          <Stop offset="1" stopColor={lineColor} stopOpacity={lineAlpha} />
        </LinearGradient>
      </Defs>
      <AnimatedPath
        animatedProps={animatedProps}
        stroke="url(#ecgFade)"
        strokeWidth={2.2}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <AnimatedCircle cx={ECG_HX} r={6} fill={ACCENT} fillOpacity={0.2} animatedProps={dotGlowProps} />
      <AnimatedCircle cx={ECG_HX} r={2.6} fill="#CFFFF6" animatedProps={dotProps} />
    </Svg>
  );
}

/* Afronding van een geslaagde meting (operator, 10 okt 2026: "de tekst na
   afloop is zo simpel, niet professioneel — iets geanimeerd, een teken"):
   zoals Apple Pay / Face ID één kort, zorgvuldig moment — een vinkje dat
   zichzelf tekent in een rondje, de titel schuift zacht omhoog in beeld, de
   tweede regel volgt. ±1 s, daarna stil. */
const CHECK_C = 2 * Math.PI * 10;
function DoneMessage() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 1000, easing: ReEasing.out(ReEasing.cubic) });
  }, [p]);
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_C * (1 - Math.min(1, p.value / 0.45)),
  }));
  const tickProps = useAnimatedProps(() => ({
    strokeDashoffset: 16 * (1 - Math.max(0, Math.min(1, (p.value - 0.35) / 0.35))),
  }));
  const titleStyle = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (p.value - 0.15) / 0.45));
    return { opacity: t, transform: [{ translateY: 8 * (1 - t) }] };
  });
  const subStyle = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (p.value - 0.5) / 0.45));
    return { opacity: t, transform: [{ translateY: 6 * (1 - t) }] };
  });
  return (
    <View style={s.doneMsg} accessibilityLiveRegion="polite" accessibilityLabel="Measurement complete. This is your baseline for all sessions.">
      <Reanimated.View style={[s.doneRow, titleStyle]}>
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <AnimatedCircle
            cx={12}
            cy={12}
            r={10}
            stroke={ACCENT}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CHECK_C} ${CHECK_C}`}
            animatedProps={ringProps}
            transform="rotate(-90 12 12)"
          />
          <AnimatedPath
            d="M7.5 12.4 L10.6 15.3 L16.6 9.2"
            stroke="#ffffff"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="16 16"
            animatedProps={tickProps}
          />
        </Svg>
        <Text style={s.doneTitle}>Measurement complete</Text>
      </Reanimated.View>
      <Reanimated.Text style={[s.doneSub, subStyle]}>This is your baseline for all sessions</Reanimated.Text>
    </View>
  );
}

/* Eén lichtgolf rond de ring op het moment van succes. */
function SuccessGlow() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.glow,
        {
          opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
        },
      ]}
    />
  );
}

/* Eén hartslag als "lub-dub": stevige S1, ~300 ms later een kleinere S2,
   dan rust — vloeiend, op de native driver. Bij een snelle hartslag wordt
   de beweging evenredig korter zodat ze nooit over de volgende slag loopt. */
function lubDub(v: Animated.Value, big: number, bpm: number | null) {
  const k = bpm ? Math.min(1, 60000 / bpm / 900) : 1;
  const ease = Easing.bezier(0.2, 0.9, 0.3, 1);
  const back = Easing.bezier(0.4, 0, 0.6, 1);
  return Animated.sequence([
    Animated.timing(v, { toValue: 1 + big, duration: 120 * k, easing: ease, useNativeDriver: true }),
    Animated.timing(v, { toValue: 1, duration: 200 * k, easing: back, useNativeDriver: true }),
    Animated.delay(90 * k),
    Animated.timing(v, { toValue: 1 + big * 0.5, duration: 110 * k, easing: ease, useNativeDriver: true }),
    Animated.timing(v, { toValue: 1, duration: 240 * k, easing: back, useNativeDriver: true }),
  ]);
}

/* Rekenboog: dunne teal boog die rond het hart draait terwijl het resultaat
   wordt uitgerekend (operator, 9 okt 2026). */
function CalcArc() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const size = RING_LINE - 30;
  const r = size / 2 - 2;
  const c = size / 2;
  const a1 = -Math.PI / 2;
  const a2 = a1 + (Math.PI * 2) / 3.2;
  const d = `M ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${c + r * Math.cos(a2)} ${c + r * Math.sin(a2)}`;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="calcArc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ACCENT} stopOpacity={0} />
            <Stop offset="1" stopColor={ACCENT} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Path d={d} stroke="url(#calcArc)" strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

export default function PulseMeter({ onResult, onManual, onErrorChange }: Props) {
  const permission = useCameraPermission();
  const [status, setStatus] = useState<Status>('placing');
  const [progress, setProgress] = useState(0);
  const [failReason, setFailReason] = useState('');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [attempt, setAttempt] = useState(0);
  /* Meerdere lenzen (operator, 7 okt 2026: "ik heb 3 camera's"): wie na 6 s
     nog niet op de juiste lens zit, krijgt een tweede hint. */
  const placingSince = useRef(Date.now());
  const [placingLong, setPlacingLong] = useState(false);
  const [pressingHard, setPressingHard] = useState(false);
  const [justLost, setJustLost] = useState(false);
  const [batteryLow, setBatteryLow] = useState(false);
  /* Laatste beeldwaarde (ook zonder vinger), om te zien of de flits brandt. */
  const lastRaw = useRef<PulseSample | null>(null);
  const [flashWasOff, setFlashWasOff] = useState(false);
  /* Zie de flits-beslisregel bovenaan dit bestand. */
  const flashSeen = useRef(false);
  const darkSince = useRef<number | null>(null);
  const torchErrors = useRef(0);
  const [darkLong, setDarkLong] = useState(false);
  const [torchFailed, setTorchFailed] = useState(false);
  useEffect(() => {
    if (!Battery) return;
    const check = () =>
      void Battery!.getBatteryLevelAsync()
        .then((l) => setBatteryLow(l >= 0 && l < LOW_BATTERY))
        .catch(() => {});
    try {
      check();
      const sub = Battery.addBatteryLevelListener(({ batteryLevel }) =>
        setBatteryLow(batteryLevel >= 0 && batteryLevel < LOW_BATTERY),
      );
      return () => sub.remove();
    } catch {
      return undefined;
    }
  }, []);

  /* Toestemming vragen zodra dit scherm verschijnt (de gebruiker koos net
     "Measure my heart rate"). */
  useEffect(() => {
    if (permission.hasPermission) return;
    if (permission.canRequestPermission) {
      void permission.requestPermission().then((ok) => {
        if (!ok) setStatus('denied');
      });
    } else {
      setStatus('denied');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (permission.hasPermission && status === 'denied') setStatus('placing');
  }, [permission.hasPermission, status]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  /* ── Samples (refs: 30× per seconde, geen re-render per beeld) ── */
  const samples = useRef<PulseSample[]>([]);
  const rawStamps = useRef<number[]>([]);
  const scale = useRef<number | null>(null);
  const raw0 = useRef(0);
  const fingerSince = useRef<number | null>(null);
  const lastFingerAt = useRef(0);
  const measureStart = useRef<number | null>(null);
  const lastShownBeat = useRef(0);
  const lostAt = useRef(0);
  const finished = useRef(false);
  /* Tijdstippen (Date.now) van de getoonde slagen, voor de hartlijn. */
  const [beatLog, setBeatLog] = useState<EcgBeat[]>([]);
  /** Moment (Date.now) van de laatst getoonde ECHTE slag. */
  const lastRealAt = useRef(0);
  /* Live getal tijdens het meten + het eindgetal vlak voor het resultaat. */
  const [liveBpm, setLiveBpm] = useState<number | null>(null);
  const liveEma = useRef<number | null>(null);
  const liveHist = useRef<number[]>([]);
  const liveTarget = useRef<number | null>(null);
  const liveStepAt = useRef(0);
  const [finalBpm, setFinalBpm] = useState<number | null>(null);
  const finalRef = useRef(false);
  useEffect(() => {
    if (finalBpm === null) {
      if (finalRef.current) stopHeartbeatSound();
      finalRef.current = false;
    }
  }, [finalBpm]);
  useEffect(() => () => stopHeartbeatSound(), []);
  const [calculating, setCalculating] = useState(false);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
  }, []);
  const beat = useRef(new Animated.Value(1)).current;
  /* Rustig "ademen" zolang de vinger nog niet ligt. Operator, 9 okt 2026:
     de golfringen rond het hart zijn weggehaald (hart, ring en lijn tonen
     de slag al). */
  const beatTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = beatTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);
  const idle = useRef(new Animated.Value(1)).current;
  /* Vulling van het hart + ring = voortgang van de meting.
     Vervolg (operator, 9 okt 2026: "de animatie lijkt bibberig"): niet
     meer elke 250 ms een stapje vanaf de drukke JS-thread, maar één
     doorlopende beweging op de UI-thread zodra het meten start (20 s),
     terug naar 0 als de vinger wegglijdt. */
  const fill = useRef(new Animated.Value(0)).current;
  const ringP = useSharedValue(0);
  const progressRef = useRef(0);
  progressRef.current = progress;
  useEffect(() => {
    const measuring = status === 'measuring';
    const remaining = Math.max(200, MEASURE_MS * (1 - progressRef.current));
    Animated.timing(fill, {
      toValue: measuring ? 1 : 0,
      duration: measuring ? remaining : 250,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    ringP.value = withTiming(measuring ? 1 : 0, {
      duration: measuring ? remaining : 250,
      easing: measuring ? ReEasing.linear : ReEasing.out(ReEasing.quad),
    });
  }, [status, fill, ringP]);


  /* Stabiel (enkel refs): de camera-worklet krijgt deze functie één keer mee. */
  const onSample = useCallback((rawTs: number, r: number, g: number) => {
    if (finished.current) return;
    if (scale.current === null) {
      rawStamps.current.push(rawTs);
      if (rawStamps.current.length < 8) return;
      scale.current = timestampScaleToMs(rawStamps.current);
      raw0.current = rawStamps.current[0];
    }
    const t = (rawTs - raw0.current) * scale.current;
    const s = { t, r, g };
    lastRaw.current = s;
    if (s.r > FLASH_LIGHT_R && s.r > s.g * 1.6) flashSeen.current = true;
    if (fingerOnLens(s)) {
      lastFingerAt.current = t;
      if (fingerSince.current === null) fingerSince.current = t;
      if (measureStart.current === null && t - fingerSince.current >= SETTLE_MS) {
        measureStart.current = t;
        samples.current = [];
      }
      if (measureStart.current !== null) samples.current.push(s);
    } else if (t - lastFingerAt.current > LOST_GRACE_MS) {
      /* Operator, 9 okt 2026: vinger weg tijdens het meten → zeggen WAAROM
         de ring opnieuw begint (nooit een getal uit een halve meting). */
      if (measureStart.current !== null) lostAt.current = Date.now();
      fingerSince.current = null;
      measureStart.current = null;
      samples.current = [];
    }
  }, []);

  /* Eén keer per ~250 ms: status, ring, levend hart, eindcontrole. */
  useEffect(() => {
    if (status === 'failed' || status === 'denied' || status === 'camera-error') return;
    const id = setInterval(() => {
      if (finished.current) return;
      const last = samples.current[samples.current.length - 1];
      const start = measureStart.current;
      if (fingerSince.current === null) {
        setBeatLog((prev) => (prev.length ? [] : prev));
        lastRealAt.current = 0;
        liveEma.current = null;
        liveHist.current = [];
        liveTarget.current = null;
        setCalculating(false);
        setLiveBpm(null);
        setStatus('placing');
        setProgress(0);
        setPlacingLong(Date.now() - placingSince.current > 6000);
        /* Donker beeld = geen flitslicht (vinger op een lens zonder licht,
           of de flits staat uit). Met de flits aan is het beeld helder. */
        const raw = lastRaw.current;
        const black = !!raw && raw.r < BLACK_R && raw.g < BLACK_G;
        const nowMs = Date.now();
        if (!black) darkSince.current = null;
        else if (darkSince.current === null) darkSince.current = nowMs;
        setDarkLong(
          !flashSeen.current && darkSince.current !== null && nowMs - darkSince.current >= DARK_HOLD_MS,
        );
        setJustLost(Date.now() - lostAt.current < 3000);
        return;
      }
      setJustLost(false);
      darkSince.current = null;
      setDarkLong(false);
      placingSince.current = Date.now();
      setPlacingLong(false);
      if (start === null || !last) {
        setStatus('settling');
        setProgress(0);
        return;
      }
      setStatus('measuring');
      /* Te hard drukken: het beeld wordt egaal fel rood (verzadigd) en de
         polsgolf verdwijnt. */
      setPressingHard(last.r > 250 && last.g > 180);
      const elapsed = last.t - start;
      setProgress(Math.min(1, elapsed / MEASURE_MS));

      const recent = samples.current.filter((p) => p.t >= last.t - 6000);
      /* Live: snelle schatting (strenger afgesteld), maar pas getoond na
         akkoord van 4 opeenvolgende schattingen (operator: "telling begint
         laat" én "moet correct zijn"). Eindresultaat blijft streng. */
      const est = recent.length > 72 ? analyzePulse(recent, 2, true) : null;
      /* Operator, 9 okt 2026 ("van 81 naar 53 en terug, niet accuraat" en
         later "het getal moet gewoon stabiel staan, niet haperen"): zoals een
         horloge — mediaan van de laatste 5 schattingen, pas tonen als 4
         opeenvolgende schattingen binnen 8% liggen, en daarna enkel nog
         bijsturen bij een blijvend verschil van ≥ 2 bpm, met 1 bpm per
         1,5 s. Valt het signaal even weg, dan blijft het getal gewoon staan. */
      if (est && est.bpm >= 40 && est.bpm <= 140) {
        const hist = [...liveHist.current, est.bpm].slice(-5);
        liveHist.current = hist;
        const sorted = [...hist].sort((x, y) => x - y);
        const median = sorted[Math.floor(sorted.length / 2)];
        if (liveEma.current === null && hist.length >= 4) {
          const last4 = hist.slice(-4);
          const agree = last4.every((x) => Math.abs(x - median) / median <= 0.08);
          if (agree) {
            liveEma.current = Math.round(median);
            liveStepAt.current = Date.now();
            setLiveBpm(liveEma.current);
          }
        }
        liveTarget.current = median;
      }
      if (
        liveEma.current !== null &&
        liveTarget.current !== null &&
        Math.abs(liveTarget.current - liveEma.current) >= 2 &&
        Date.now() - liveStepAt.current >= 1500
      ) {
        liveEma.current += Math.sign(liveTarget.current - liveEma.current);
        liveStepAt.current = Date.now();
        setLiveBpm(liveEma.current);
      }

      if (elapsed >= MEASURE_MS) {
        /* Meettijd om: rekenen (en zo nodig stil doormeten voor de controle). */
        setCalculating(true);
        const window = samples.current.filter((p) => p.t >= last.t - MEASURE_MS);
        const res = robustPulse(window);
        /* Operator, 9 okt 2026 ("40 kan niet" + "try again moet ook niet
           zomaar gebeuren, efficiënt, niet bij elke vermoedelijke fout"):
           een twijfelachtige uitkomst na 15 s → stil doormeten tot 25 s op
           een schuivend venster van de laatste 15 s (een beweging in het
           begin valt er dan vanzelf uit). Pas als het dan nog niet lukt:
           één eerlijke melding met de meest waarschijnlijke reden. */
        /* Controle zit in robustPulse: enkel schone stukken tellen, en die
           moeten samen ~12 s dekken en het eens zijn. */
        const ok = !!res && res.bpm >= 45 && res.bpm <= 100 && res.confidence >= 0.35;
        if (ok && res) {
          finished.current = true;
          /* Operator, 9 okt 2026 ("de pagina springt direct verder"): eerst
             even het eindgetal tonen, met een tik, dan pas door. */
          /* Vervolg (operator: "op het einde een wachtsymbool terwijl het
             effectief wordt uitgerekend"): eerst ~1,2 s de rekenboog, dan
             het eindgetal in teal + tik, dan het resultaat. */
          setCalculating(true);
          resultTimer.current = setTimeout(() => {
            setCalculating(false);
            setFinalBpm(res.bpm);
            setLiveBpm(res.bpm);
            /* Het hart klopt verder op precies dit getal, met geluid. */
            liveEma.current = res.bpm;
            finalRef.current = true;
            startHeartbeatSound();
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onResult(res.bpm);
          }, 1200);
        } else if (elapsed >= MAX_MS) {
          finished.current = true;
          setCalculating(false);
          /* Brandde de flits? Met flits is het beeld door de vinger fel rood
             (r ≈ 200+); zonder flits, op omgevingslicht, veel zwakker. */
          const meanR = window.reduce((sum, p) => sum + p.r, 0) / Math.max(1, window.length);
          setFlashWasOff(meanR < 140);
          setFailReason(
            !res
              ? "We couldn't read a steady heart rate. Rest your fingertip lightly — pressing hard blocks the signal."
              : res.bpm > 100
                ? "That's higher than a resting heart rate. Sit still for a minute, then try again."
                : res.bpm < 45
                  ? 'That reading looks too low. Rest your fingertip lightly over the camera and flash, keep still, and try again.'
                  : "The signal wasn't clear enough. Keep your hand still and your fingertip relaxed, then try again.",
          );
          setStatus('failed');
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [status, beat, onResult, attempt]);

  /* Zonder vinger: rustig ademen. Vinger erop (operator, 9 okt 2026:
     "hartslag mag beginnen bij vinger op de camera, maar rustig"): een
     zachte, trage hartslag (≈55 bpm) tot de eerste echte slag gevonden is;
     vanaf dan klopt het hart op het echte ritme. */
  const fingerOn = status === 'settling' || status === 'measuring';
  const placing = status === 'placing';
  useEffect(() => {
    if (fingerOn) {
      /* Vervolg ("zodra er een hartslag is, moet op de lijn ook een kleine
         rustige hartslag beginnen"): hart en lijn uit dezelfde tik.
         Vervolg ("de hoge pieken moeten altijd beginnen bij het vullen van
         het hart — ook na een onderbroken meting"): deze slag vult elk gat
         op zolang er geen echte slag is (ook als het signaal even wegvalt),
         en zijn hoogte volgt de voortgang — dus groot zodra het hart vult,
         los van wanneer de echte slagen gevonden worden. */
      /* Vervolg (operator, 9 okt 2026: "de hartslag hapert"): het hart en
         de lijn kloppen op een regelmatige maat, niet op het onregelmatige
         moment dat de analyse een slag opmerkt. Eerst de zachte ≈55 bpm;
         zodra het getal staat, op precies dat getal. */
      let tid: ReturnType<typeof setTimeout>;
      const softBeat = () => {
        const bpm = liveEma.current;
        if (finalRef.current) {
          heartbeatTick();
          hapticTap();
        }
        if (bpm !== null) lubDub(beat, 0.07, bpm).start();
        else lubDub(idle, 0.045, null).start();
        const t = Date.now() - ECG_DELAY_MS; // piek verschijnt nu rechts op de lijn
        const p = progressRef.current;
        const a = p > 0 ? ecgAmpAt(p) : SOFT_BEAT_AMP;
        setBeatLog((prev) =>
          [...prev.filter((x) => t - x.t < ECG_WINDOW_MS + 1000), { t, a, soft: bpm === null }].sort((m, n) => m.t - n.t),
        );
        tid = setTimeout(softBeat, bpm !== null ? 60000 / bpm : SOFT_BEAT_MS);
      };
      softBeat();
      return () => clearTimeout(tid);
    }
    if (!placing) {
      idle.stopAnimation();
      Animated.timing(idle, { toValue: 1, duration: 300, easing: Easing.out(Easing.sin), useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1.04, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(idle, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fingerOn, placing, idle, beat]);

  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      const plane = READ_VIA_PLANE ? frame.getPlanes()[0] : null;
      if (plane || frame.hasPixelBuffer) {
        const px = new Uint8Array(plane ? plane.getPixelBuffer() : frame.getPixelBuffer());
        const w = plane ? plane.width : frame.width;
        const h = plane ? plane.height : frame.height;
        const row = plane ? plane.bytesPerRow : frame.bytesPerRow;
        const fmt = frame.pixelFormat;
        const bpp = fmt === 'rgb-rgb-8-bit' ? 3 : 4;
        const ri = fmt === 'rgb-bgra-8-bit' ? 2 : 0;
        let r = 0;
        let g = 0;
        let n = 0;
        for (let y = Math.floor(h / 4); y < (3 * h) / 4; y += 6) {
          const base = y * row;
          for (let x = Math.floor(w / 4); x < (3 * w) / 4; x += 6) {
            const i = base + x * bpp;
            r += px[i + ri];
            g += px[i + 1];
            n++;
          }
        }
        if (n > 0) scheduleOnRN(onSample, frame.timestamp, r / n, g / n);
      }
      frame.dispose();
    },
    [onSample],
  );
  const frameOutput = useFrameOutput({ pixelFormat: 'rgb', targetResolution: FRAME_SIZE, onFrame });
  const outputs = useMemo(() => [frameOutput], [frameOutput]);

  const cameraOn =
    permission.hasPermission && appActive && (status === 'placing' || status === 'settling' || status === 'measuring');
  /* Zaklamp pas aan als de camera echt draait: eerder vraagt Android hem
     aan een sessie die nog niet bestaat (7 okt 2026, A16: "camera kon niet
     starten" terwijl de camera zelf prima opende). */
  const [started, setStarted] = useState(false);
  const failures = useRef(0);
  useCamera({
    isActive: cameraOn,
    device: 'back',
    outputs,
    torchMode: cameraOn && started ? 'on' : 'off',
    constraints: CONSTRAINTS,
    onStarted: () => setStarted(true),
    onStopped: () => setStarted(false),
    onError: (e) => {
      console.warn('[PulseMeter] camera error:', String(e), e?.name, e?.message);
      if (/torch|flash/i.test(`${String(e)} ${e?.name ?? ''} ${e?.message ?? ''}`)) {
        torchErrors.current += 1;
        if (torchErrors.current >= TORCH_ERRORS_NEEDED) setTorchFailed(true);
      }
      /* Eén losse fout (bv. de zaklamp) is geen reden om op te geven;
         pas bij herhaling eerlijk melden dat de camera niet wil. */
      failures.current += 1;
      if (failures.current >= 3) {
        finished.current = true;
        setStatus('camera-error');
      }
    },
  });

  const retry = () => {
    setFlashWasOff(false);
    setTorchFailed(false);
    setDarkLong(false);
    flashSeen.current = false;
    darkSince.current = null;
    torchErrors.current = 0;
    failures.current = 0;
    finished.current = false;
    samples.current = [];
    fingerSince.current = null;
    measureStart.current = null;
    lastShownBeat.current = 0;
    setBeatLog([]);
    lastRealAt.current = 0;
    liveEma.current = null;
    liveHist.current = [];
    liveTarget.current = null;
    setCalculating(false);
    setLiveBpm(null);
    setFinalBpm(null);
    setProgress(0);
    placingSince.current = Date.now();
    setPlacingLong(false);
    setStatus('placing');
    setAttempt((a) => a + 1);
  };

  /* Vervolg ("de outline van het hart moet rondom groeien en dan het hart
     zelf"): eerste kwart van de meting tekent de omtrek zich rond, daarna
     vult het hart van onder naar boven. */
  /* Operator, 9 okt 2026 ("zelfde animatie maar van boven naar beneden"):
     beide kanten vertrekken samen bovenaan in het midden, lopen langs de
     zijkanten omlaag en raken elkaar in de onderste punt — daar begint
     de vulling. Streep v aan het begin + streep v aan het einde van het pad. */
  const progressRingProps = useAnimatedProps(() => ({ strokeDashoffset: PROG_CIRC * (1 - ringP.value) }));
  const outlineProps = useAnimatedProps(() => {
    const v = (HEART_LEN / 2) * Math.min(1, ringP.value / OUTLINE_SHARE);
    const gap = Math.max(0, HEART_LEN - 2 * v);
    return { strokeDasharray: [Math.max(0.001, v), gap + 0.001, v, 0.001] };
  });
  /* Operator, 9 okt 2026: "als de flits aanstaat nooit die meldingen" —
     de batterij krijgt enkel de schuld als de flits er echt niet was. */
  /* Operator, 10 okt 2026 ("op 15% lukte het niet en ik kreeg de melding
     niet — die % is misschien overal anders; als de zaklamp niet aangaat is
     het een batterijprobleem"): niet meer afhankelijk van een vast
     batterijpercentage. Het beeld zelf zegt of de flits brandt: met flits
     en vinger is het fel rood, zonder flits donker. Blijft het donker, dan
     melden we dat de flits niet aanging (met de batterij als waarschijnlijke
     oorzaak); brandt de flits, dan nooit deze melding. */
  const flashWorks = flashSeen.current;
  const flashUnavailable =
    !flashWorks && (torchFailed || (batteryLow && darkLong));
  const lowBatteryFail = status === 'failed' && batteryLow && flashWasOff && !flashWorks;
  const flashBody = batteryLow
    ? 'Your battery is low, so the flash can’t turn on. Charge your phone and try again.'
    : "Your flash couldn't turn on. Restart the measurement, or charge your phone if the battery is low.";
  const message =
    status === 'placing'
      ? justLost
        ? 'Finger moved — starting over'
        : placingLong
        ? 'Not quite — try the camera closest to the flash'
        : 'Cover the top camera and the flash with your fingertip'
      : status === 'settling'
        ? 'Got it — hold still'
        : status === 'measuring'
          ? pressingHard
            ? 'Lift a little — pressing blocks the signal'
            : finalBpm !== null
            ? ''
            : calculating
            ? 'Calculating your heart rate…'
            : progress < 1
            ? 'Reading your heart rate — breathe normally'
            : 'Almost there…'
          : '';

  /* Operator, 9 okt 2026 (ontwerp "Error State"): elke fout als één rustig
     scherm — teal uitroepteken, titel, korte uitleg, witte knop en een
     onderlijnde "Enter Manually". */
  const errorView: { title: string; body: string; cta: string; onCta: () => void } | null =
    status === 'placing' && flashUnavailable && !justLost
      ? { title: 'Flash unavailable', body: flashBody, cta: 'Try Again', onCta: retry }
      : status === 'camera-error'
        ? torchFailed || (batteryLow && !flashWorks)
          ? { title: 'Flash unavailable', body: flashBody, cta: 'Try Again', onCta: retry }
          : { title: 'Camera unavailable', body: "Your camera couldn't start on this device.", cta: 'Try Again', onCta: retry }
        : status === 'failed'
          ? {
              title: 'Measurement failed',
              body: lowBatteryFail ? flashBody : failReason,
              cta: 'Try Again',
              onCta: retry,
            }
          : status === 'denied'
            ? {
                title: 'Camera access is off',
                body: 'Allow camera access for VIBEZCORE in Settings to measure your heart rate.',
                cta: 'Open Settings',
                onCta: () => void Linking.openSettings(),
              }
            : null;
  const isError = errorView !== null;
  useEffect(() => {
    onErrorChange?.(isError);
  }, [isError, onErrorChange]);

  if (errorView) {
    return (
      <View style={s.errWrap}>
        <CircleAlert size={76} color={ACCENT} strokeWidth={1.4} />
        <Text style={s.errTitle} accessibilityRole="header">
          {errorView.title}
        </Text>
        <Text style={s.errBody} accessibilityLiveRegion="polite">
          {errorView.body}
        </Text>
        <PressScale style={[s.cta, s.errCta]} haptic scaleTo={0.97} onPress={errorView.onCta} accessibilityRole="button">
          <Text style={s.ctaTxt}>{errorView.cta}</Text>
        </PressScale>
        <PressScale onPress={onManual} hitSlop={8} style={s.link} accessibilityRole="button">
          {/* Operator, 9 okt 2026: wit, geen onderlijning, subtiel pijltje
              — zelfde als op de Resting Heart Rate-pagina. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={s.errLinkTxt}>Enter Manually</Text>
            <ChevronRight size={17} color="rgba(255,255,255,0.55)" strokeWidth={2.4} />
          </View>
        </PressScale>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      {/* Live hartslag in grote cijfers boven de meting (zoals Apple). */}
      <View style={s.liveRow} accessibilityLiveRegion="polite">
        <Animated.Text
          style={[
            s.liveNum,
            liveBpm === null ? s.liveNumIdle : null,
            calculating ? { opacity: 0.45 } : null,
          ]}
        >
          {liveBpm ?? '--'}
        </Animated.Text>
        <Text style={s.liveUnit}>bpm</Text>
      </View>
      <View style={s.stage}>
        {/* Operator, 10 okt 2026 ("de pieken vóór de cirkel maar achter het
            hart doorlopen"): drie lagen — ring onderaan, dan de hartlijn over
            de volle breedte, het hart bovenaan. */}
        <View pointerEvents="none" style={[s.ringWrap, s.ringLayer]}>
          {/* Operator, 9 okt 2026 ("de cirkel is redelijk dun — hoe doet Apple
              dat?"): een echte voortgangsring zoals de Activity-ringen — zacht
              spoor + felle teal boog met ronde uiteinden die in de meettijd
              rondloopt. De ring toont de tijd, het hart de hartslag. */}
          <Svg width={RING_LINE} height={RING_LINE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={RING_LINE / 2}
              cy={RING_LINE / 2}
              r={(RING_LINE - PROG_W) / 2}
              stroke={ACCENT}
              strokeOpacity={0.16}
              strokeWidth={PROG_W}
              fill="none"
            />
            <AnimatedCircle
              cx={RING_LINE / 2}
              cy={RING_LINE / 2}
              r={(RING_LINE - PROG_W) / 2}
              stroke={ACCENT}
              strokeWidth={PROG_W}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${PROG_CIRC} ${PROG_CIRC}`}
              animatedProps={progressRingProps}
              transform={`rotate(-90 ${RING_LINE / 2} ${RING_LINE / 2})`}
            />
          </Svg>
          {calculating ? <CalcArc /> : null}
          {finalBpm !== null ? <SuccessGlow /> : null}
        </View>
        <EcgTrace beats={beatLog} running={fingerOn} progress={progress} />
        <Animated.View
          style={[
            s.ringWrap,
            /* Operator, 10 okt 2026: "we laten enkel het hart kloppen, de
               cirkel blijft stil" — het ademen van de ring is weg. */
          ]}
        >
          {/* Operator, 9 okt 2026: zolang de vinger nog niet ligt, toont een
              Touch ID-achtige lijnanimatie hoe je je vinger legt; daarna het
              hart dat zich vult. */}
          {status === 'placing' ? (
            <FingerPlacementAnim />
          ) : (
            /* Operator, 10 okt 2026: geen vinkje meer — het hart blijft en
               klopt na de meting door op je gemeten hartslag, met zacht
               hartslaggeluid; de hele cirkel ademt mee ("nu is het kaal"). */
            (
              <Animated.View style={{ transform: [{ scale: Animated.multiply(beat, idle) }] }}>
                {/* Vervolg: het hart klopt gewoon mee in vol teal glas (zelfde
                    stijl als de Resting Heart Rate-pagina); de voortgang zit in
                    de ring. */}
                {/* Operator, 10 okt 2026 ("het hartje in glas"): doorschijnend
                    teal (licht boven, dieper onder), een glans bovenaan en een
                    zachte lichtrand die naar onder uitdooft — geen harde lijn. */}
                <Svg width={HEART} height={HEART} viewBox="0 0 24 24">
                  <Defs>
                    <LinearGradient id="pmHeartGlass" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#4AF0D4" stopOpacity={0.62} />
                      <Stop offset="1" stopColor="#00A3A3" stopOpacity={0.34} />
                    </LinearGradient>
                    <LinearGradient id="pmHeartShine" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#ffffff" stopOpacity={0.45} />
                      <Stop offset="0.45" stopColor="#ffffff" stopOpacity={0} />
                    </LinearGradient>
                    <LinearGradient id="pmHeartEdge" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#ffffff" stopOpacity={0.55} />
                      <Stop offset="0.7" stopColor="#ffffff" stopOpacity={0} />
                    </LinearGradient>
                  </Defs>
                  {/* Donkere onderlaag: de hartlijn loopt achter het hart door
                      en schijnt niet door het glas heen. */}
                  <Path d={LUCIDE_HEART_D} fill="#0b0b0d" />
                  <Path d={LUCIDE_HEART_D} fill="url(#pmHeartGlass)" />
                  <Path d={LUCIDE_HEART_D} fill="url(#pmHeartShine)" />
                  <Path d={LUCIDE_HEART_D} fill="none" stroke="url(#pmHeartEdge)" strokeWidth={0.35} />
                </Svg>
              </Animated.View>
            )
          )}
        </Animated.View>
      </View>

      {finalBpm !== null ? (
        /* Operator, 10 okt 2026 ("op het einde moet er een melding komen
           dat de meting ok is — nu stopt het gewoon"): wat er gebeurd is +
           wat je nu doet. */
        <DoneMessage />
      ) : (
        <Text style={s.msg} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  /* Operator, 9 okt 2026: "het bpm-getal mag hoger" — de ring blijft staan. */
  liveRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 66 },
  liveNum: {
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
    fontSize: 56,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
    minWidth: 76,
    textAlign: 'center',
  },
  liveNumIdle: { color: 'rgba(255,255,255,0.25)' },
  liveUnit: { color: 'rgba(255,255,255,0.55)', fontFamily: BrandFonts.semibold, fontSize: 18 },
  errWrap: { alignItems: 'center', paddingTop: 8, paddingHorizontal: 8 },
  errTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 14,
  },
  errBody: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16.5,
    fontFamily: BrandFonts.medium,
    lineHeight: 25,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 40,
  },
  errCta: { alignSelf: 'stretch' },
  errLinkTxt: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.semibold,
  },
  wrap: { alignItems: 'center', paddingTop: 4 },
  heartFill: { position: 'absolute', left: 0, top: 0, width: HEART, height: HEART, overflow: 'hidden' },
  stage: { width: ECG_W, height: RING_LINE, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  ringWrap: { width: RING_LINE, height: RING_LINE, alignItems: 'center', justifyContent: 'center' },
  ringLayer: { position: 'absolute', top: 0, left: (ECG_W - RING_LINE) / 2 },
  doneMsg: { alignItems: 'center', minHeight: 48, marginBottom: 18, gap: 6 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneTitle: { color: '#ffffff', fontSize: 19, fontFamily: BrandFonts.bold, textAlign: 'center' },
  glow: {
    position: 'absolute',
    width: RING_LINE,
    height: RING_LINE,
    borderRadius: RING_LINE / 2,
    borderWidth: 3,
    borderColor: ACCENT,
  },
  doneSub: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: BrandFonts.medium, textAlign: 'center' },
  msg: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
    textAlign: 'center',
    lineHeight: 24,
    minHeight: 48,
    paddingHorizontal: 8,
    marginBottom: 18,
  },
  sub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13.5,
    fontFamily: BrandFonts.medium,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 6,
  },
  actions: { alignSelf: 'stretch', marginTop: 10 },
  cta: { backgroundColor: '#ffffff', borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center' },
  ctaTxt: { color: '#1D1D1F', fontSize: 17, fontFamily: BrandFonts.bold },
  pressed: { opacity: 0.7 },
  link: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  linkTxt: { color: '#ffffff', fontSize: 16, fontFamily: BrandFonts.semibold },
});
