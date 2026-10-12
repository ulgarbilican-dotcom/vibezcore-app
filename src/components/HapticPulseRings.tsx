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
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
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
      style={[s.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }, style]}
    />
  );
});

/* 12 okt 2026 (operator: "te druk"): met `beatSynced` (sessiescherm, waar
   de cirkel zelf meeklopt via HeartbeatScale) één ring per HARTSLAG — enkel
   bij lub, niet bij dub — die vertrekt waar de kloppende cirkel op zijn
   grootst is (+7 %, na 80 ms). Eén duidelijk effect per slag. */
export function HapticPulseRings({
  size,
  color = RING_COLOR,
  beatSynced = false,
}: {
  size: number;
  color?: string;
  beatSynced?: boolean;
}) {
  const reduced = useReducedMotion();
  const rings = useRef<(RingHandle | null)[]>([]);
  const next = useRef(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const off = subscribeHapticPulse((pulse) => {
      if (beatSynced && pulse.kind === 'dub') return;
      const fire = () => {
        const ring = rings.current[next.current];
        next.current = (next.current + 1) % POOL_SIZE;
        ring?.fire(lookFor(pulse), reduced, beatSynced && !reduced ? 1.07 : 1);
      };
      if (beatSynced && !reduced) timers.push(setTimeout(fire, 80));
      else fire();
    });
    return () => {
      off();
      timers.forEach(clearTimeout);
    };
  }, [reduced, beatSynced]);

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
export function HeartbeatScale({ size, children }: { size: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    return subscribeHapticPulse((pulse) => {
      /* Vervolg (operator: "niet sterk genoeg"): 3,5 % was ~8 px. */
      const peak = pulse.kind === 'lub' ? 1.07 : 1.035;
      const back = Math.min(520, Math.max(220, pulse.cycleMs * 0.5));
      scale.value = withSequence(
        withTiming(peak, { duration: 80, easing: Easing.out(Easing.quad) }),
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
