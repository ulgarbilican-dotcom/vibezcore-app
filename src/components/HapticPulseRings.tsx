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

const RING_COLOR = BrandDark.accent;
const POOL_SIZE = 6;

type RingLook = { peakOpacity: number; maxScale: number; durationMs: number; stroke: number };

function lookFor(pulse: HapticPulse): RingLook {
  const calm =
    pulse.mode === BraceletMode.Delta ||
    pulse.mode === BraceletMode.Theta ||
    pulse.mode === BraceletMode.Alpha;
  const lub = pulse.kind === 'lub';
  /* Traag tempo = trage, brede ring; snel tempo = korte ring. */
  const durationMs = Math.min(2600, Math.max(500, pulse.cycleMs * 1.5));
  if (calm) {
    return { peakOpacity: lub ? 0.32 : 0.18, maxScale: lub ? 1.32 : 1.2, durationMs, stroke: 1.5 };
  }
  return { peakOpacity: lub ? 0.5 : 0.3, maxScale: lub ? 1.26 : 1.16, durationMs, stroke: 2 };
}

type RingHandle = { fire: (look: RingLook, reduced: boolean) => void };

const Ring = forwardRef<RingHandle, { size: number }>(function Ring({ size }, ref) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const stroke = useSharedValue(1.5);

  useImperativeHandle(ref, () => ({
    fire(look, reduced) {
      stroke.value = look.stroke;
      scale.value = 1;
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

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    borderWidth: stroke.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.ring, { width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
});

export function HapticPulseRings({ size }: { size: number }) {
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
    borderColor: RING_COLOR,
  },
});
