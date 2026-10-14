/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — zichtbare hartslag van de State Control-haptiek.

   Elke tik die de trilmotor geeft, zet hier een ring uit vanaf de rand
   van de sessie-cirkel: lub = duidelijke ring, dub = zachtere tweede ring.
   Het tempo komt NIET uit dit bestand maar uit subscribeHapticPulse()
   (services/bracelet-haptics.ts) — dezelfde curve en hetzelfde startpunt
   als de motor, dus beeld en gevoel vallen per constructie samen.

   Vertragen/versnellen is zichtbaar zonder getallen (spec §11.5: geen
   technische parameters tonen): bij een trager tempo zetten de ringen
   trager en breder uit en komen ze verder uit elkaar.

   Kleur: Signal Blue — in de huisstijl uitsluitend voor haptic-pulsen.
   Kalme modi bewust laag contrast; "beweging verminderen" → enkel een
   zachte gloed, geen uitzettende ringen. */

import { BrandDark } from '@/constants/theme';
import { BraceletMode } from '@/services/ble-contract';
import { subscribeHapticPulse, type HapticPulse } from '@/services/bracelet-haptics';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/* Standaard Signal Blue. In een lopende sessie krijgen de ringen de kleur
   van de toestand (operator, 6 okt 2026: "per toestand de kleur van de
   state — de huisstijl geldt voor de haptics op bracelet-foto's e.d."). */
const RING_COLOR = BrandDark.accent;
const POOL_SIZE = 6;

type RingLook = { peakOpacity: number; maxScale: number; durationMs: number };

function lookFor(pulse: HapticPulse): RingLook {
  const calm =
    pulse.mode === BraceletMode.Delta ||
    pulse.mode === BraceletMode.Theta ||
    pulse.mode === BraceletMode.Alpha;
  const lub = pulse.kind === 'lub';
  /* Traag tempo = trage, brede ring; snel tempo = korte ring. */
  const durationMs = Math.min(2600, Math.max(500, pulse.cycleMs * 1.5));
  if (calm) {
    return { peakOpacity: lub ? 0.32 : 0.18, maxScale: lub ? 1.32 : 1.2, durationMs };
  }
  return { peakOpacity: lub ? 0.5 : 0.3, maxScale: lub ? 1.26 : 1.16, durationMs };
}

type RingHandle = { fire: (look: RingLook, reduced: boolean, startScale?: number) => void };

const Ring = forwardRef<RingHandle, { size: number; color: string }>(function Ring({ size, color }, ref) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    fire(look, reduced, startScale = 1) {
      scale.value = startScale;
      if (!reduced) {
        scale.value = withTiming(look.maxScale, {
          duration: look.durationMs,
          easing: Easing.out(Easing.cubic),
        });
      }
      const peak = reduced ? look.peakOpacity * 0.6 : look.peakOpacity;
      opacity.value = withSequence(
        withTiming(peak, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: look.durationMs - 90, easing: Easing.in(Easing.quad) }),
      );
    },
  }));

  /* Enkel schaal + doorzichtigheid (7 okt 2026, "Apple-niveau smooth"):
     die speelt de GPU af zonder de lay-out opnieuw te berekenen. De
     lijndikte stond hier eerst ook in, en die moest Android elk beeld
     opnieuw opmeten — dat kon haperen. */
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
        style,
      ]}
    />
  );
});

/* 12 okt 2026 (operator: "te druk"): met `beatSynced` (sessiescherm, waar
   de cirkel zelf meeklopt via HeartbeatScale) één ring per HARTSLAG — enkel
   bij lub, niet bij dub — die vertrekt waar de kloppende cirkel op zijn
   grootst is (+7 %, na 80 ms). Eén duidelijk effect per slag. */
/* ── Drukgolf (sessiescherm) ──────────────────────────────────────────
   14 okt 2026 (operator: "binnenring is al goed, enkel de buitenring moet
   een soort drukgolf worden"; vervolg: "blijft raar, kijk na hoe dit
   professioneel moet"). Het gangbare sonar-/ripple-patroon:
     · vertrekt vanuit het element zelf (achter de rand van de kloppende
       cirkel, dus geen "plop" bij het verschijnen) en groeit naar buiten;
     · ease-out (Material "decelerate", cubic-bezier(0, 0, 0.2, 1)): snel
       weg, vertraagt — een signaal dat uitwaaiert;
     · doorzichtigheid ~0,5 → 0, geleidelijk tot nul, geen harde stop;
     · gelijkmatige lijn (enkel straal en doorzichtigheid bewegen);
     · rustig: elke golf leeft ~2 slagen, zodat er steeds twee elkaar
       gelijkmatig opvolgen (gestaffeld, doorlopend).
   Bronnen: travis.media/blog/css-pulse-effect, educative "Pulsating CTA",
   Material motion (decelerate easing). Getekend met Skia (UI-thread). */
const WAVE_POOL = 4;
const WAVE_START = 1.0; // vanuit de rand van de cirkel (verborgen erachter)
const WAVE_END = 1.5;
const WAVE_STROKE = 2.5;
const WAVE_PEAK_OPACITY = 0.55;

type WaveHandle = { fire: (durationMs: number) => void };

const Wave = forwardRef<WaveHandle, { r0: number; c: number; color: string }>(function Wave({ r0, c, color }, ref) {
  const p = useSharedValue(1);
  useImperativeHandle(ref, () => ({
    fire(durationMs) {
      p.value = 0;
      p.value = withTiming(1, { duration: durationMs, easing: Easing.bezier(0, 0, 0.2, 1) });
    },
  }));
  const r = useDerivedValue(() => r0 * (WAVE_START + (WAVE_END - WAVE_START) * p.value));
  const o = useDerivedValue(() => WAVE_PEAK_OPACITY * (1 - p.value));
  return (
    <Group opacity={o}>
      <Circle cx={c} cy={c} r={r} color={color} style="stroke" strokeWidth={WAVE_STROKE} />
    </Group>
  );
});

function PressureWaves({ size, color }: { size: number; color: string }) {
  const reduced = useReducedMotion();
  const waves = useRef<(WaveHandle | null)[]>([]);
  const next = useRef(0);
  const box = Math.ceil(size * (WAVE_END + 0.06));
  useEffect(() => {
    if (reduced) return;
    return subscribeHapticPulse((pulse) => {
      if (pulse.kind !== 'lub') return;
      /* Op de slag zelf; de golf zit eerst achter de cirkel en komt naar
         buiten terwijl die opzwelt. Leeft ~2 slagen (1,2–2,6 s). */
      const w = waves.current[next.current];
      next.current = (next.current + 1) % WAVE_POOL;
      w?.fire(Math.min(2600, Math.max(1200, pulse.cycleMs * 2)));
    });
  }, [reduced]);
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={[s.wrap, { width: size, height: size }]}>
      <Canvas style={{ position: 'absolute', width: box, height: box, left: (size - box) / 2, top: (size - box) / 2 }}>
        {Array.from({ length: WAVE_POOL }, (_, i) => (
          <Wave
            key={i}
            r0={size / 2}
            c={box / 2}
            color={color}
            ref={(h) => {
              waves.current[i] = h;
            }}
          />
        ))}
      </Canvas>
    </View>
  );
}

export function HapticPulseRings({
  size,
  color = RING_COLOR,
  beatSynced = false,
}: {
  size: number;
  color?: string;
  beatSynced?: boolean;
}) {
  if (beatSynced) return <PressureWaves size={size} color={color} />;
  return <ClassicRings size={size} color={color} />;
}

function ClassicRings({ size, color }: { size: number; color: string }) {
  const reduced = useReducedMotion();
  const rings = useRef<(RingHandle | null)[]>([]);
  const next = useRef(0);

  useEffect(() => {
    return subscribeHapticPulse((pulse) => {
      const ring = rings.current[next.current];
      next.current = (next.current + 1) % POOL_SIZE;
      ring?.fire(lookFor(pulse), reduced);
    });
  }, [reduced]);

  return (
    <View pointerEvents="none" style={[s.wrap, { width: size, height: size }]}>
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        <Ring
          key={i}
          size={size}
          color={color}
          ref={(r) => {
            rings.current[i] = r;
          }}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.75,
  },
});

/* 12 okt 2026 (operator: "meekloppen ook op de telefoon"): de cirkel zelf
   zwelt bij elke slag heel licht op — lub sterker, dub zachter — en zakt
   zacht terug. Zelfde bron als de ringen (subscribeHapticPulse), dus exact
   op de trilling; zelfde gedrag als de ring op het horloge. Uit bij
   "Beweging beperken". */
/** Hartslagcurve (telefoon = horloge): lub-top, dip, dub-top. */
const BEAT_LUB = 1.07;
const BEAT_VALLEY = 1.015;
const BEAT_DUB = 1.04;

export function HeartbeatScale({ size, children }: { size: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    return subscribeHapticPulse((pulse) => {
      /* Vervolg (operator: "niet sterk genoeg"): 3,5 % was ~8 px. */
      /* 14 okt 2026 (operator: "oogt amateuristisch en stroef — zoek op hoe
         professionals dit doen"): één doorlopende curve per hartslag, zoals
         een keyframe-hartslag (lub op, kleine dip, dub op, uitzakken, rust)
         — geen twee losse animaties die elkaar onderbreken of terugspringen
         (Apple "Designing Fluid Interfaces": nooit springen, altijd verder
         vanaf de huidige stand). De dub-gebeurtenis stuurt de schaal niet;
         de curve legt de dub op exact hetzelfde moment als de trilling.
         Identiek aan SessionRingView.beatScale op het horloge. */
      if (pulse.kind !== 'lub') return;
      const c = pulse.cycleMs;
      const dubAt = Math.round(Math.min(c * 0.3, 350));
      const rise = 80;
      const back = Math.max(160, Math.min(520, c * 0.45, c - dubAt - rise - 40));
      scale.value = withSequence(
        withTiming(BEAT_LUB, { duration: rise, easing: Easing.out(Easing.quad) }),
        withTiming(BEAT_VALLEY, { duration: Math.max(40, dubAt - rise), easing: Easing.inOut(Easing.sin) }),
        withTiming(BEAT_DUB, { duration: rise, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: back, easing: Easing.inOut(Easing.sin) }),
      );
    });
  }, [reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  /* Eigen vlak van exact de cirkelgrootte, absoluut en gecentreerd zoals
     de cirkel zelf (die is position:absolute) — anders schaalde een vlak
     van 0×0 en bewoog er niets (test 12 okt 2026). */
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      {children}
    </Animated.View>
  );
}
