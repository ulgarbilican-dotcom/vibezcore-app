/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — pols meten met de camera ("Match your rhythm" fase 2,
   operator, 7 okt 2026).

   De achtercamera draait zonder beeld op het scherm (de vinger bedekt de
   lens toch), met de zaklamp aan. Per beeld gaat enkel de gemiddelde rood-
   en groenwaarde van het midden naar JS — geen beelden, niets bewaard.
   De berekening zelf staat in utils/pulse-detect.ts.

   Verloop: vinger erop → 1 s stil → 15 s meten (ring loopt vol, het hart
   klopt mee op de gevonden slagen) → uitkomst. Vinger weg = de ring
   begint opnieuw. Lukt het na 25 s niet: eerlijk "opnieuw proberen".
   Tijdens het meten GEEN trillingen: die zouden de vinger doen bewegen. */

import PressScale from '@/components/PressScale';
import * as Haptics from 'expo-haptics';
import { BrandFonts } from '@/constants/theme';
import { analyzePulse, fingerOnLens, timestampScaleToMs, type PulseSample } from '@/utils/pulse-detect';
import { CircleAlert, Heart } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useCamera, useCameraPermission, useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import Reanimated, {
  Easing as ReEasing,
  useAnimatedProps,
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
const LOW_BATTERY = 0.15;

const MEASURE_MS = 15_000;
const MAX_MS = 25_000;
const SETTLE_MS = 1_000;
/** Zo lang mag de vinger even wegglijden voor de meting opnieuw begint. */
const LOST_GRACE_MS = 700;
const RING = 240; // 9 okt 2026: "cirkel iets groter"
const HEART = 84;
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

const ECG_W = 240;
const ECG_H = 56;
const ECG_WINDOW_MS = 4000;
/* Eén hartslag (P-golf, QRS-piek, T-golf): [ms t.o.v. de piek, hoogte −1…1]. */
const PQRST: [number, number][] = [
  [-200, 0], [-170, 0.07], [-140, 0], [-45, 0], [-28, -0.12], [0, 1], [24, -0.32],
  [44, 0], [150, 0], [200, 0.16], [250, 0],
];

/* Vervolg (operator: "maak de animatie vloeiend"): de lijn wordt op de
   UI-thread getekend (Reanimated), los van de camera-verwerking op de
   JS-thread. Slagen krijgen hun echte tijdstip en verschijnen met een
   vaste vertraging, zodat elke piek netjes rechts binnenschuift. */
const ECG_DELAY_MS = 700;
const AnimatedPath = Reanimated.createAnimatedComponent(Path);

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

  const animatedProps = useAnimatedProps(() => {
    const mid = ECG_H / 2;
    const amp = ECG_H / 2 - 4;
    const t0 = now.value - ECG_DELAY_MS;
    const toX = (t: number) => ECG_W - ((t0 - t) / ECG_WINDOW_MS) * ECG_W;
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
        if (to < 0 || from > ECG_W) continue;
        windows.push([from, to]);
        for (let j = 0; j < PQRST.length; j++) {
          const px = toX(list[i].t + PQRST[j][0]);
          if (px < 0 || px > ECG_W) continue;
          pts.push([px, mid - PQRST[j][1] * amp * list[i].a]);
        }
      }
    }
    for (let x = 0; x <= ECG_W; x += 3) {
      let inBeat = false;
      for (let k = 0; k < windows.length; k++) {
        if (x >= windows[k][0] && x <= windows[k][1]) {
          inBeat = true;
          break;
        }
      }
      if (!inBeat) pts.push([x, mid - noise(t0 - ((ECG_W - x) / ECG_W) * ECG_WINDOW_MS)]);
    }
    pts.sort((m, n) => m[0] - n[0]);
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      d += `${i === 0 ? 'M' : ' L'}${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
    }
    return { d };
  });

  /* Operator, 9 okt 2026: de lijn blijft altijd groen. */
  const lineColor = ACCENT;
  const lineAlpha = 1;
  return (
    <Svg width={ECG_W} height={ECG_H} style={{ marginBottom: 34 }}>
      <Defs>
        <LinearGradient id="ecgFade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={ECG_W} y2="0">
          <Stop offset="0" stopColor={lineColor} stopOpacity={0} />
          <Stop offset="0.35" stopColor={lineColor} stopOpacity={0.55 * lineAlpha} />
          <Stop offset="1" stopColor={lineColor} stopOpacity={lineAlpha} />
        </LinearGradient>
      </Defs>
      <AnimatedPath
        animatedProps={animatedProps}
        stroke="url(#ecgFade)"
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
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
  const [looksDark, setLooksDark] = useState(false);
  const [flashWasOff, setFlashWasOff] = useState(false);
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
  const [finalBpm, setFinalBpm] = useState<number | null>(null);
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
     doorlopende beweging op de UI-thread zodra het meten start (15 s),
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
        setLiveBpm(null);
        setStatus('placing');
        setProgress(0);
        setPlacingLong(Date.now() - placingSince.current > 6000);
        /* Donker beeld = geen flitslicht (vinger op een lens zonder licht,
           of de flits staat uit). Met de flits aan is het beeld helder. */
        const raw = lastRaw.current;
        setLooksDark(!!raw && raw.r < 60 && raw.g < 45);
        setJustLost(Date.now() - lostAt.current < 3000);
        return;
      }
      setJustLost(false);
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
      const est = recent.length > 120 ? analyzePulse(recent, 3) : null;
      const b = est ? est.beats[est.beats.length - 1] : null;
      /* Operator, 9 okt 2026 ("boven de meting in grote cijfers live te zien"):
         een rustig, afgevlakt getal — pas zodra de omtrek van het hart rond
         is (eerste seconden zijn onrustig) en enkel bij een geloofwaardige
         schatting. */
      /* Vervolg (operator: "bpm onmiddellijk mee tonen"): vanaf de eerste
         bruikbare schatting (~4 s signaal), niet pas na de omtrek. */
      if (est && est.bpm >= 40 && est.bpm <= 140 && est.confidence >= 0.2) {
        liveEma.current = liveEma.current === null ? est.bpm : liveEma.current * 0.7 + est.bpm * 0.3;
        setLiveBpm(Math.round(liveEma.current));
      }
      if (b !== null && b > lastShownBeat.current + 250) {
        lastShownBeat.current = b;
        /* Echt tijdstip van de slag (niet het moment van opmerken). */
        const wall = Date.now() - (last.t - b);
        /* Voorlopige zachte slagen die met deze echte slag overlappen,
           wijken (anders kruist de lijn zichzelf). */
        setBeatLog((prev) =>
          [
            ...prev.filter(
              (x) => wall - x.t < ECG_WINDOW_MS + ECG_DELAY_MS + 1000 && (!x.soft || x.t < wall - 500),
            ),
            { t: wall, a: ecgAmpAt(Math.min(1, elapsed / MEASURE_MS)) },
          ].sort((m, n) => m.t - n.t),
        );
        /* Het hart klopt op het echte ritme, tegelijk met de piek die op
           de lijn binnenschuift (zelfde vaste vertraging) — niet op het
           toevallige moment dat de controle hem opmerkt. */
        const at = Math.max(0, wall + ECG_DELAY_MS - Date.now());
        const tid = setTimeout(() => {
          beatTimers.current.delete(tid);
          lastRealAt.current = Date.now();
          Animated.sequence([
            /* Operator, 9 okt 2026: "rustiger en smoother" — kleinere, zachtere slag. */
            Animated.timing(beat, { toValue: 1.07, duration: 220, easing: Easing.out(Easing.sin), useNativeDriver: true }),
            Animated.timing(beat, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]).start();
        }, at);
        beatTimers.current.add(tid);
      }

      if (elapsed >= MEASURE_MS) {
        const window = samples.current.filter((p) => p.t >= last.t - MEASURE_MS);
        const res = analyzePulse(window);
        /* Operator, 9 okt 2026 ("40 kan niet" + "try again moet ook niet
           zomaar gebeuren, efficiënt, niet bij elke vermoedelijke fout"):
           een twijfelachtige uitkomst na 15 s → stil doormeten tot 25 s op
           een schuivend venster van de laatste 15 s (een beweging in het
           begin valt er dan vanzelf uit). Pas als het dan nog niet lukt:
           één eerlijke melding met de meest waarschijnlijke reden. */
        const ok = !!res && res.bpm >= 45 && res.bpm <= 100 && res.confidence >= 0.35;
        if (ok && res) {
          finished.current = true;
          /* Operator, 9 okt 2026 ("de pagina springt direct verder"): eerst
             even het eindgetal tonen, met een tik, dan pas door. */
          setFinalBpm(res.bpm);
          setLiveBpm(res.bpm);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          resultTimer.current = setTimeout(() => onResult(res.bpm), 1600);
        } else if (elapsed >= MAX_MS) {
          finished.current = true;
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
      const softBeat = () => {
        if (Date.now() - lastRealAt.current < 1600) return; // echte slagen lopen
        Animated.sequence([
          Animated.timing(idle, { toValue: 1.045, duration: 240, easing: Easing.out(Easing.sin), useNativeDriver: true }),
          Animated.timing(idle, { toValue: 1, duration: 560, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]).start();
        const t = Date.now() - ECG_DELAY_MS; // piek verschijnt nu rechts op de lijn
        const p = progressRef.current;
        const a = p > 0 ? ecgAmpAt(p) : SOFT_BEAT_AMP;
        setBeatLog((prev) => {
          /* Niet over een echte slag heen tekenen (lijn mag zichzelf niet kruisen). */
          if (prev.some((x) => !x.soft && Math.abs(x.t - t) < 500)) return prev;
          return [...prev.filter((x) => t - x.t < ECG_WINDOW_MS + 1000), { t, a, soft: true }].sort((m, n) => m.t - n.t);
        });
      };
      softBeat();
      const id = setInterval(softBeat, SOFT_BEAT_MS);
      return () => clearInterval(id);
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
  }, [fingerOn, placing, idle]);

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
    failures.current = 0;
    finished.current = false;
    samples.current = [];
    fingerSince.current = null;
    measureStart.current = null;
    lastShownBeat.current = 0;
    setBeatLog([]);
    lastRealAt.current = 0;
    liveEma.current = null;
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
  const outlineProps = useAnimatedProps(() => {
    const v = (HEART_LEN / 2) * Math.min(1, ringP.value / OUTLINE_SHARE);
    const gap = Math.max(0, HEART_LEN - 2 * v);
    return { strokeDasharray: [Math.max(0.001, v), gap + 0.001, v, 0.001] };
  });
  /* Operator, 9 okt 2026: "als de flits aanstaat nooit die meldingen" —
     de batterij krijgt enkel de schuld als de flits er echt niet was. */
  const lowBatteryFail = status === 'failed' && batteryLow && flashWasOff;
  /* Operator, 9 okt 2026 ("en als de flits op 12% wél aangaat?"): enkel
     "Flash unavailable" als de batterij laag is ÉN het beeld donker blijft —
     anders gewoon de normale plaats-hint. */
  const flashOff = batteryLow && looksDark;
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
            ? 'Done'
            : progress < 1
            ? 'Reading your heart rate — breathe normally'
            : 'Almost there…'
          : '';

  /* Operator, 9 okt 2026 (ontwerp "Error State"): elke fout als één rustig
     scherm — teal uitroepteken, titel, korte uitleg, witte knop en een
     onderlijnde "Enter Manually". */
  const errorView: { title: string; body: string; cta: string; onCta: () => void } | null =
    status === 'placing' && placingLong && flashOff && !justLost
      ? { title: 'Flash unavailable', body: 'Low battery. Charge your phone and try again.', cta: 'Try Again', onCta: retry }
      : status === 'camera-error'
        ? batteryLow
          ? { title: 'Flash unavailable', body: 'Low battery. Charge your phone and try again.', cta: 'Try Again', onCta: retry }
          : { title: 'Camera unavailable', body: "Your camera couldn't start on this device.", cta: 'Try Again', onCta: retry }
        : status === 'failed'
          ? {
              title: 'Measurement failed',
              body: lowBatteryFail ? 'Low battery may affect the flash. Charge your phone and try again.' : failReason,
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
          <Text style={s.errLinkTxt}>Enter Manually</Text>
        </PressScale>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      {/* Live hartslag in grote cijfers boven de meting (zoals Apple). */}
      <View style={s.liveRow} accessibilityLiveRegion="polite">
        <Text style={[s.liveNum, liveBpm === null ? s.liveNumIdle : null, finalBpm !== null ? { color: ACCENT } : null]}>
          {liveBpm ?? '--'}
        </Text>
        <Text style={s.liveUnit}>bpm</Text>
      </View>
      <View style={s.ringWrap}>
        {/* Operator, 9 okt 2026: buitencirkel = vaste omlijning in dezelfde
            kleurstijl als de hartlijn (teal dat zacht uitvloeit). De
            voortgang zit nu in het hart zelf. */}
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="ringFade" gradientUnits="userSpaceOnUse" x1="0" y1={RING} x2={RING} y2="0">
              <Stop offset="0" stopColor={ACCENT} stopOpacity={0.08} />
              <Stop offset="0.5" stopColor={ACCENT} stopOpacity={0.45} />
              <Stop offset="1" stopColor={ACCENT} stopOpacity={0.9} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={(RING - STROKE) / 2}
            stroke="url(#ringFade)"
            strokeWidth={1.5}
            fill="none"
          />
        </Svg>
        <Animated.View style={{ transform: [{ scale: Animated.multiply(beat, idle) }] }}>
          {/* Operator, 9 okt 2026 ("hart begint leeg en vult naarmate de
              meting vordert, en groter"): witte omtrek + Bio-Teal vulling die
              van onder naar boven stijgt met de voortgang. */}
          <View style={{ width: HEART, height: HEART }}>
            {/* Operator, 9 okt 2026: omlijning in exact dezelfde kleur als de vulling. */}
            {/* Vervolg ("begint grijs, eerst de buitenlijn groen, dan van
                onder naar boven vullen"): grijze omtrek tot de meting start,
                dan vloeit de teal omtrek erin en begint de vulling. */}
            <Heart size={HEART} color={IDLE_GREY} fill="transparent" strokeWidth={0.7} />
<Svg width={HEART} height={HEART} viewBox="0 0 24 24" style={StyleSheet.absoluteFill} pointerEvents="none">
              <AnimatedPath
                d={LUCIDE_HEART_D}
                stroke={ACCENT}
                strokeWidth={0.7}
                strokeLinecap="butt"
                strokeLinejoin="round"
                fill="none"
                animatedProps={outlineProps}
              />
            </Svg>
            <Animated.View
              pointerEvents="none"
              style={[
                s.heartFill,
                /* Clip schuift omhoog, het hart erin tegengesteld omlaag:
                   enkel transforms → vloeiend op de UI-thread. */
                { transform: [{ translateY: fill.interpolate({ inputRange: [0, OUTLINE_SHARE, 1], outputRange: [HEART, HEART, 0] }) }] },
              ]}
            >
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: HEART,
                  height: HEART,
                  transform: [{ translateY: fill.interpolate({ inputRange: [0, OUTLINE_SHARE, 1], outputRange: [-HEART, -HEART, 0] }) }],
                }}
              >
                <Heart size={HEART} color={ACCENT} fill={ACCENT} strokeWidth={0.7} />
              </Animated.View>
            </Animated.View>
          </View>
        </Animated.View>
      </View>

      {/* Operator, 9 okt 2026: hartlijn — begint vlak, elke gevonden slag
          tekent een piek die naar links wegschuift. */}
      {/* Bij een fout of geweigerde camera geen lijn: er wordt niet gemeten,
          en de knoppen hebben die ruimte nodig. */}
      <EcgTrace beats={beatLog} running={fingerOn} progress={progress} />

      <Text style={s.msg} accessibilityLiveRegion="polite">
        {message}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  liveRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 22 },
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
    color: ACCENT,
    fontSize: 16,
    fontFamily: BrandFonts.semibold,
    textDecorationLine: 'underline',
  },
  wrap: { alignItems: 'center', paddingTop: 4 },
  heartFill: { position: 'absolute', left: 0, top: 0, width: HEART, height: HEART, overflow: 'hidden' },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
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
