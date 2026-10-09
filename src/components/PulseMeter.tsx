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
import { BrandFonts } from '@/constants/theme';
import { analyzePulse, fingerOnLens, latestBeat, timestampScaleToMs, type PulseSample } from '@/utils/pulse-detect';
import { Heart } from 'lucide-react-native';
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
   het pad ONDERAAN in de punt begint en daar ook eindigt — omtrek ≈ 59 in
   24-eenheden. Operator, 9 okt 2026: "de outline moet onderaan beginnen". */
const LUCIDE_HEART_D =
  'M12 21A2 2 0 0 1 10.508 20.332L5 15C3.5 13.5 2 11.8 2 9.5A5.5 5.5 0 0 1 11.591 5.824A.56 .56 0 0 0 12.409 5.824A5.49 5.49 0 0 1 22 9.5C22 11.79 20.5 13.5 19 15L13.508 20.313A2 2 0 0 1 12 21';
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
type EcgBeat = { t: number; a: number };
/* Voorlopige, rustige slag zodra de vinger ligt (klein op de lijn). */
const SOFT_BEAT_MS = 1090; // ≈55 bpm
const SOFT_BEAT_AMP = 0.35;

function EcgTrace({ beats, running, progress }: { beats: EcgBeat[]; running: boolean; progress: number }) {
  const beatsSv = useSharedValue<EcgBeat[]>([]);
  const ampSv = useSharedValue(0.55);
  const now = useSharedValue(0);
  const runningSv = useSharedValue(false);
  useEffect(() => {
    beatsSv.value = beats;
  }, [beats, beatsSv]);
  useEffect(() => {
    /* De pieken groeien mee met de meting: het signaal "komt binnen". */
    ampSv.value = 0.55 + 0.45 * progress;
  }, [progress, ampSv]);
  useEffect(() => {
    runningSv.value = running;
  }, [running, runningSv]);
  useFrameCallback(() => {
    now.value = Date.now();
  });

  const animatedProps = useAnimatedProps(() => {
    const mid = ECG_H / 2;
    const amp = (ECG_H / 2 - 4) * ampSv.value;
    const t0 = now.value - ECG_DELAY_MS;
    let d = `M0 ${mid}`;
    if (runningSv.value) {
      const list = beatsSv.value;
      for (let i = 0; i < list.length; i++) {
        for (let j = 0; j < PQRST.length; j++) {
          const px = ECG_W - ((t0 - (list[i].t + PQRST[j][0])) / ECG_WINDOW_MS) * ECG_W;
          if (px < 0 || px > ECG_W) continue;
          d += ` L${px.toFixed(1)} ${(mid - PQRST[j][1] * amp * list[i].a).toFixed(1)}`;
        }
      }
    }
    d += ` L${ECG_W} ${mid}`;
    return { d };
  });

  /* Operator, 9 okt 2026: de lijn blijft altijd groen. */
  const lineColor = ACCENT;
  const lineAlpha = 1;
  return (
    <Svg width={ECG_W} height={ECG_H} style={{ marginBottom: 18 }}>
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

export default function PulseMeter({ onResult, onManual }: Props) {
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
  const [hasRealBeat, setHasRealBeat] = useState(false);
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
        setHasRealBeat(false);
        setStatus('placing');
        setProgress(0);
        setPlacingLong(Date.now() - placingSince.current > 6000);
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
      const b = recent.length > 120 ? latestBeat(recent) : null;
      if (b !== null && b > lastShownBeat.current + 250) {
        lastShownBeat.current = b;
        /* Echt tijdstip van de slag (niet het moment van opmerken). */
        const wall = Date.now() - (last.t - b);
        /* Voorlopige zachte slagen die met deze echte slag overlappen,
           wijken (anders kruist de lijn zichzelf). */
        setBeatLog((prev) =>
          [
            ...prev.filter(
              (x) => wall - x.t < ECG_WINDOW_MS + ECG_DELAY_MS + 1000 && (x.a === 1 || x.t < wall - 500),
            ),
            { t: wall, a: 1 },
          ].sort((m, n) => m.t - n.t),
        );
        /* Het hart klopt op het echte ritme, tegelijk met de piek die op
           de lijn binnenschuift (zelfde vaste vertraging) — niet op het
           toevallige moment dat de controle hem opmerkt. */
        const at = Math.max(0, wall + ECG_DELAY_MS - Date.now());
        const tid = setTimeout(() => {
          beatTimers.current.delete(tid);
          setHasRealBeat(true);
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
          onResult(res.bpm);
        } else if (elapsed >= MAX_MS) {
          finished.current = true;
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
    if (!placing && !(fingerOn && !hasRealBeat)) {
      idle.stopAnimation();
      Animated.timing(idle, { toValue: 1, duration: 300, easing: Easing.out(Easing.sin), useNativeDriver: true }).start();
      return;
    }
    if (fingerOn) {
      /* Vervolg ("zodra er een hartslag is, moet op de lijn ook een kleine
         rustige hartslag beginnen"): hart en lijn uit dezelfde tik. */
      const softBeat = () => {
        Animated.sequence([
          Animated.timing(idle, { toValue: 1.045, duration: 240, easing: Easing.out(Easing.sin), useNativeDriver: true }),
          Animated.timing(idle, { toValue: 1, duration: 560, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]).start();
        const t = Date.now() - ECG_DELAY_MS; // piek verschijnt nu rechts op de lijn
        setBeatLog((prev) => [...prev.filter((x) => t - x.t < ECG_WINDOW_MS + 1000), { t, a: SOFT_BEAT_AMP }]);
      };
      softBeat();
      const id = setInterval(softBeat, SOFT_BEAT_MS);
      return () => clearInterval(id);
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1.04, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(idle, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fingerOn, placing, idle, hasRealBeat]);

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
    finished.current = false;
    samples.current = [];
    fingerSince.current = null;
    measureStart.current = null;
    lastShownBeat.current = 0;
    setBeatLog([]);
    setHasRealBeat(false);
    setProgress(0);
    placingSince.current = Date.now();
    setPlacingLong(false);
    setStatus('placing');
    setAttempt((a) => a + 1);
  };

  /* Vervolg ("de outline van het hart moet rondom groeien en dan het hart
     zelf"): eerste kwart van de meting tekent de omtrek zich rond, daarna
     vult het hart van onder naar boven. */
  /* Beide kanten groeien tegelijk vanuit de punt omhoog en raken elkaar
     bovenaan: streep v aan het begin + streep v aan het einde van het pad. */
  const outlineProps = useAnimatedProps(() => {
    const v = (HEART_LEN / 2) * Math.min(1, ringP.value / OUTLINE_SHARE);
    const gap = Math.max(0, HEART_LEN - 2 * v);
    return { strokeDasharray: [Math.max(0.001, v), gap + 0.001, v, 0.001] };
  });
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
            : progress < 1
            ? 'Reading your heart rate — breathe normally'
            : 'Almost there…'
          : status === 'denied'
            ? 'Camera access is off for VIBEZCORE.'
            : status === 'camera-error'
              ? "Your camera couldn't start on this device."
              : failReason;

  return (
    <View style={s.wrap}>
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
      <EcgTrace beats={beatLog} running={fingerOn} progress={progress} />

      <Text style={s.msg} accessibilityLiveRegion="polite">
        {message}
      </Text>

      {status === 'failed' || status === 'camera-error' ? (
        <View style={s.actions}>
          {status === 'failed' ? (
            <PressScale style={[s.cta]} haptic scaleTo={0.97} onPress={retry} accessibilityRole="button">
              <Text style={s.ctaTxt}>Try again</Text>
            </PressScale>
          ) : null}
          <PressScale onPress={onManual} hitSlop={8} style={s.link} accessibilityRole="button">
            <Text style={s.linkTxt}>Enter it myself</Text>
          </PressScale>
        </View>
      ) : status === 'denied' ? (
        <View style={s.actions}>
          <PressScale
            style={[s.cta]} haptic scaleTo={0.97}
            onPress={() => void Linking.openSettings()}
            accessibilityRole="button"
          >
            <Text style={s.ctaTxt}>Open Settings</Text>
          </PressScale>
          <PressScale onPress={onManual} hitSlop={8} style={s.link} accessibilityRole="button">
            <Text style={s.linkTxt}>Enter it myself</Text>
          </PressScale>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 4 },
  heartFill: { position: 'absolute', left: 0, top: 0, width: HEART, height: HEART, overflow: 'hidden' },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
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
