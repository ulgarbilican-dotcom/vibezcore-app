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
  useFrameCallback,
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
/* ── Vaste slagklok (14 okt 2026) ─────────────────────────────────────
   Operator: "de ring op de smartwatch gaat sneller t.o.v. de telefoon — ik
   wil het juiste ritme, beide ringen exact hetzelfde pulsritme". Gemeten
   ([sync]-logs): de JS-timer die elk slag-event afvuurt, liep tot ±150 ms
   vóór of na de slag; elke animatie die bij dát event startte, haperde mee.
   Het horloge rekent elk beeld uit vanaf het geplande slagmoment op de
   klok. Nu ook de telefoon: het event levert enkel het geplande moment
   (atMs) en de slagduur; een beeld-per-beeld-callback op de UI-thread rekent
   cirkel en golf uit vanaf dat moment. Te laat event = de curve staat al op
   de juiste plek; te vroeg = hij wacht tot het moment er is. */
/** Hartslagcurve (telefoon = horloge): lub-top, dip, dub-top. — vóór de worklets die ze gebruiken (worklets worden niet gehoist). */
const BEAT_LUB = 1.07;
const BEAT_VALLEY = 1.015;
const BEAT_DUB = 1.04;
const easeOutQuad = (k: number): number => {
  'worklet';
  return 1 - (1 - k) * (1 - k);
};
const easeInOutSine = (k: number): number => {
  'worklet';
  return 0.5 - 0.5 * Math.cos(Math.PI * k);
};
/** Schaal van de kloppende cirkel, `el` ms na de lub — = SessionRingView.beatScale. */
const beatCurve = (el: number, c: number): number => {
  'worklet';
  if (el < 0) return 1;
  const dubAt = Math.round(Math.min(c * 0.3, 350));
  const rise = 80;
  const back = Math.max(160, Math.min(520, c * 0.45, c - dubAt - rise - 40));
  if (el < rise) return 1 + (BEAT_LUB - 1) * easeOutQuad(el / rise);
  if (el < dubAt) return BEAT_LUB + (BEAT_VALLEY - BEAT_LUB) * easeInOutSine((el - rise) / Math.max(40, dubAt - rise));
  if (el < dubAt + rise) return BEAT_VALLEY + (BEAT_DUB - BEAT_VALLEY) * easeOutQuad((el - dubAt) / rise);
  if (el < dubAt + rise + back) return BEAT_DUB + (1 - BEAT_DUB) * easeInOutSine((el - dubAt - rise) / back);
  return 1;
};
/** Voortgang 0…1 van de drukgolf `el` ms na de lub (ease-out cubic), of -1 als er geen golf is. */
const waveProgress = (el: number, c: number): number => {
  'worklet';
  const dur = Math.min(1300, Math.max(450, c * 0.8));
  if (el < 0 || el >= dur) return -1;
  const k = el / dur;
  return 1 - (1 - k) * (1 - k) * (1 - k);
};

/* ── Drukgolf (sessiescherm) ──────────────────────────────────────────
   14 okt 2026 (operator: "binnenring is al goed, enkel de buitenring moet
   een soort drukgolf worden"; vervolg: "blijft raar, kijk na hoe dit
   professioneel moet"). Het gangbare sonar-/ripple-patroon:
     · vertrekt vanuit het element zelf (achter de rand van de kloppende
       cirkel, dus geen "plop" bij het verschijnen) en groeit naar buiten;
     · ease-out cubic (cubic-bezier(0.33, 1, 0.68, 1)): snel weg,
       vertraagt — een signaal dat uitwaaiert;
     · doorzichtigheid ~0,5 → 0, geleidelijk tot nul, geen harde stop;
     · gelijkmatige lijn (enkel straal en doorzichtigheid bewegen);
     · ÉÉN golffront per slag: weg vóór de volgende slag (schermopname
       14 okt 16:52: met 2 slagen levensduur stonden er steeds 2–3 dunne
       ringen tegelijk die zich buiten opstapelden — een schietschijf, geen
       drukgolf); het front is een lichtende lijn: een scherpe kern met
       een brede, zwakke halo (twee lijnen — een BlurMask was te zwaar
       voor de A16: schermopname 17:10 toonde nog ~10 beelden/s).
   Identiek aan SessionRingView op het horloge.
   Bronnen: travis.media/blog/css-pulse-effect, educative "Pulsating CTA",
   Material motion (decelerate easing). Getekend met Skia (UI-thread). */
const WAVE_START = 1.0; // vanuit de rand van de cirkel (verborgen erachter)
const WAVE_END = 1.45;
const WAVE_STROKE = 3;
const WAVE_HALO_STROKE = 10;
const WAVE_HALO_OPACITY = 0.22;
const WAVE_PEAK_OPACITY = 0.8;

function PressureWaves({ size, color }: { size: number; color: string }) {
  const reduced = useReducedMotion();
  const lubAt = useSharedValue(-1);
  const cycle = useSharedValue(800);
  const p = useSharedValue(-1);
  const box = Math.ceil(size * (WAVE_END + 0.06));
  useEffect(() => {
    if (reduced) return;
    return subscribeHapticPulse((pulse) => {
      if (pulse.kind !== 'lub') return;
      lubAt.value = pulse.atMs;
      cycle.value = pulse.cycleMs;
    });
  }, [reduced, lubAt, cycle]);
  useFrameCallback(() => {
    p.value = lubAt.value < 0 ? -1 : waveProgress(Date.now() - lubAt.value, cycle.value);
  }, !reduced);
  const r0 = size / 2;
  const r = useDerivedValue(() => r0 * (WAVE_START + (WAVE_END - WAVE_START) * Math.max(0, p.value)));
  /* Kwadratisch uitdoven: de energie zit vooraan, buiten is hij weg. */
  const o = useDerivedValue(() => (p.value < 0 ? 0 : WAVE_PEAK_OPACITY * (1 - p.value) * (1 - p.value)));
  if (reduced) return null;
  const c = box / 2;
  return (
    <View pointerEvents="none" style={[s.wrap, { width: size, height: size }]}>
      <Canvas style={{ position: 'absolute', width: box, height: box, left: (size - box) / 2, top: (size - box) / 2 }}>
        <Group opacity={o}>
          <Circle cx={c} cy={c} r={r} color={color} style="stroke" strokeWidth={WAVE_HALO_STROKE} opacity={WAVE_HALO_OPACITY} />
          <Circle cx={c} cy={c} r={r} color={color} style="stroke" strokeWidth={WAVE_STROKE} />
        </Group>
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

export function HeartbeatScale({
  size,
  children,
  enabled = true,
}: {
  size: number;
  children: React.ReactNode;
  /** Uit = staat stil op ware grootte; het vlak (en wat erin staat) blijft
   *  hetzelfde, zodat aan/uit niets opnieuw opbouwt. */
  enabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const lubAt = useSharedValue(-1);
  const cycle = useSharedValue(800);
  useEffect(() => {
    if (!enabled) lubAt.value = -1;
  }, [enabled, lubAt]);
  useEffect(() => {
    if (reduced || !enabled) return;
    /* Eén doorlopende curve per hartslag (lub op, dip, dub op, uitzakken,
       rust) — vanaf het GEPLANDE slagmoment (zie "Vaste slagklok"). */
    return subscribeHapticPulse((pulse) => {
      if (pulse.kind !== 'lub') return;
      lubAt.value = pulse.atMs;
      cycle.value = pulse.cycleMs;
    });
  }, [reduced, enabled, lubAt, cycle]);
  useFrameCallback(() => {
    scale.value = lubAt.value < 0 ? 1 : beatCurve(Date.now() - lubAt.value, cycle.value);
  }, !reduced);
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
