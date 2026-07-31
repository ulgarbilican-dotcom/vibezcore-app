/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Starfield

   Operator 2026-07-30: "rondom moet het lijken alsof je in de ruimte zit
   zonder te overdrijven. De stippen (of sterren) moeten telkens in dezelfde
   kleur."

   Daarom:
     - ÉÉN kleur voor alle sterren. Geen variatie in tint, alleen in
       grootte en helderheid. Kleurvariatie leest meteen als kermis
     - Posities zijn DETERMINISTISCH (eigen kleine PRNG i.p.v. Math.random)
       zodat de sterrenhemel niet verspringt bij elke re-render
     - Traag, individueel fonkelen: elke ster heeft een eigen periode en
       faseverschuiving, dus je ziet nooit een collectieve knippering
     - Dichtheid bewust laag en helderheid laag — het is diepte, geen
       decor. "Zonder te overdrijven"

   Vult de hele achtergrond, ligt onder alle andere content.
   ───────────────────────────────────────────────────────────────────────── */

import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  width: number;
  height: number;
  /** Aantal sterren. Laag houden — dit is diepte, geen decor. */
  count?: number;
  /** Eén kleur voor alle sterren (operator-eis). */
  color?: string;
};

/* Deterministische PRNG (mulberry32). Zelfde seed → zelfde hemel, elke
   render. Voorkomt dat sterren verspringen bij een state-update. */
function makeStars(count: number, w: number, h: number) {
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: count }, () => ({
    x: rnd() * w,
    y: rnd() * h,
    /* Grootte varieert wél — dat geeft diepte zonder kleurvariatie. */
    r: 0.5 + rnd() * 1.3,
    /* Basisheldertheid; de meeste sterren blijven zwak. */
    base: 0.12 + rnd() * 0.34,
    /* Eigen fonkel-periode en fase → nooit collectief knipperen. */
    period: 0.6 + rnd() * 1.8,
    phase: rnd() * Math.PI * 2,
    /* Ongeveer een derde dooft echt uit en komt weer op, de rest blijft
       zachtjes ademen. Zouden ze allemaal uitgaan dan flikkert de hele hemel;
       zou geen enkele uitgaan dan gebeurt er niets (operator 2026-07-31:
       "hier en daar glimmen en uitgaan"). */
    blinks: rnd() < 0.34,
  }));
}

/* Eén ster. Eigen component omdat er een hook in zit (fonkel-opacity). */
function Star({
  star,
  t,
  color,
}: {
  star: ReturnType<typeof makeStars>[number];
  t: { value: number };
  color: string;
}) {
  const opacity = useDerivedValue(() => {
    'worklet';
    const wave = Math.sin(t.value * Math.PI * 2 * star.period + star.phase);
    if (!star.blinks) {
      /* Zacht ademen tussen ~78% en 100% van de basisheldertheid. */
      return star.base * (0.78 + 0.22 * wave);
    }
    /* Deze doven echt weg en komen weer op. De macht houdt hem het grootste
       deel van de tijd donker, zodat het opkomen opvalt i.p.v. dat hij staat
       te knipperen. */
    const k = Math.pow(Math.max(0, 0.5 + 0.5 * wave), 2.2);
    return star.base * 1.5 * k;
  });

  /* Dekking op de STER en niet op een groep eromheen. Een groep met eigen
     dekking dwingt Skia tot een volledige scherm-buffer — per ster. Met
     honderddertig sterren zijn dat er honderddertig per frame. */
  return (
    <Circle
      cx={star.x}
      cy={star.y}
      r={star.r}
      color={color}
      opacity={opacity}
    />
  );
}

export default function Starfield({
  width,
  height,
  count = 130,
  color = '#9ec5ff',
}: Props) {
  const stars = useMemo(
    () => makeStars(count, width, height),
    [count, width, height],
  );

  /* Eén trage klok voor alle sterren; het onderlinge verschil zit in hun
     eigen periode en fase. */
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 14000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [t]);

  return (
    <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        <Group blendMode="plus">
          {stars.map((star, i) => (
            <Star key={i} star={star} t={t} color={color} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}
