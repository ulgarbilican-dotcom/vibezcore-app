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

import { BrandFonts } from '@/constants/theme';
import { analyzePulse, fingerOnLens, latestBeat, timestampScaleToMs, type PulseSample } from '@/utils/pulse-detect';
import { Heart } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useCamera, useCameraPermission, useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

const MEASURE_MS = 15_000;
const MAX_MS = 25_000;
const SETTLE_MS = 1_000;
/** Zo lang mag de vinger even wegglijden voor de meting opnieuw begint. */
const LOST_GRACE_MS = 700;
const RING = 210;
const STROKE = 6;
const ACCENT = '#4AF0D4';
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
  const finished = useRef(false);
  const beat = useRef(new Animated.Value(1)).current;

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
        setStatus('placing');
        setProgress(0);
        setPlacingLong(Date.now() - placingSince.current > 6000);
        return;
      }
      placingSince.current = Date.now();
      setPlacingLong(false);
      if (start === null || !last) {
        setStatus('settling');
        setProgress(0);
        return;
      }
      setStatus('measuring');
      const elapsed = last.t - start;
      setProgress(Math.min(1, elapsed / MEASURE_MS));

      const recent = samples.current.filter((p) => p.t >= last.t - 6000);
      const b = recent.length > 120 ? latestBeat(recent) : null;
      if (b !== null && b > lastShownBeat.current + 250) {
        lastShownBeat.current = b;
        Animated.sequence([
          Animated.timing(beat, { toValue: 1.18, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(beat, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]).start();
      }

      if (elapsed >= MEASURE_MS) {
        const window = samples.current.filter((p) => p.t >= last.t - MEASURE_MS);
        const res = analyzePulse(window);
        if (res) {
          finished.current = true;
          if (res.bpm > 100) {
            setFailReason("That's higher than a resting heart rate. Sit still for a minute, then try again.");
            setStatus('failed');
          } else {
            onResult(res.bpm);
          }
        } else if (elapsed >= MAX_MS) {
          finished.current = true;
          setFailReason("We couldn't read a steady heart rate. Rest your fingertip lightly — pressing hard blocks the signal.");
          setStatus('failed');
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [status, beat, onResult, attempt]);

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
    setProgress(0);
    placingSince.current = Date.now();
    setPlacingLong(false);
    setStatus('placing');
    setAttempt((a) => a + 1);
  };

  const circ = Math.PI * (RING - STROKE);
  const message =
    status === 'placing'
      ? placingLong
        ? 'Not quite — try the camera closest to the flash'
        : 'Cover the top camera and the flash with your fingertip'
      : status === 'settling'
        ? 'Got it — hold still'
        : status === 'measuring'
          ? progress < 1
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
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={(RING - STROKE) / 2}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={(RING - STROKE) / 2}
            stroke={ACCENT}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - progress)}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <Animated.View style={{ transform: [{ scale: beat }] }}>
          <Heart
            size={58}
            color={status === 'measuring' ? ACCENT : 'rgba(255,255,255,0.8)'}
            fill={status === 'measuring' ? ACCENT : 'transparent'}
            strokeWidth={1.6}
          />
        </Animated.View>
      </View>

      <Text style={s.msg} accessibilityLiveRegion="polite">
        {message}
      </Text>

      {status === 'failed' || status === 'camera-error' ? (
        <View style={s.actions}>
          {status === 'failed' ? (
            <Pressable style={({ pressed }) => [s.cta, pressed && s.pressed]} onPress={retry} accessibilityRole="button">
              <Text style={s.ctaTxt}>Try again</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onManual} hitSlop={8} style={s.link} accessibilityRole="button">
            <Text style={s.linkTxt}>Enter it myself</Text>
          </Pressable>
        </View>
      ) : status === 'denied' ? (
        <View style={s.actions}>
          <Pressable
            style={({ pressed }) => [s.cta, pressed && s.pressed]}
            onPress={() => void Linking.openSettings()}
            accessibilityRole="button"
          >
            <Text style={s.ctaTxt}>Open Settings</Text>
          </Pressable>
          <Pressable onPress={onManual} hitSlop={8} style={s.link} accessibilityRole="button">
            <Text style={s.linkTxt}>Enter it myself</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={s.sub}>Takes about 15 seconds. Rest your fingertip lightly — don&apos;t press.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 4 },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  msg: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
    textAlign: 'center',
    lineHeight: 24,
    minHeight: 48,
    paddingHorizontal: 8,
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
