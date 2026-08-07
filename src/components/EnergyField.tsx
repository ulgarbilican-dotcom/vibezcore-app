/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Energieveld

   Vervangt de foto op het welkomstscherm (operator, 8 augustus 2026). Een
   foto van een gezicht zegt iets over een persoon; dit zegt iets over wat de
   app doet — een veld dat pulseert, met een kern waar het licht vandaan komt.

   ── Waarom zo gebouwd ────────────────────────────────────────────────
   Punten op een cirkelrooster in plaats van een rechthoekig rooster. Een
   rechthoekig rooster leest als een net; ringen lezen als iets dat uitstraalt
   vanuit een midden, en dat is precies het beeld.

   De golf loopt naar BUITEN: elke ring beweegt hetzelfde, maar iets later dan
   de ring erbinnen. Dat is de hele truc — een verschuiving in de tijd per
   straal maakt van een stilstaand rooster een uitdijende puls, zonder dat er
   ook maar iets herberekend wordt.

   Alles draait via Atlas op één sprite: duizend punten kosten dan één
   tekenopdracht in plaats van duizend. Dezelfde aanpak als SplatField, waar
   die keuze zich al bewezen heeft op dit toestel.
   ───────────────────────────────────────────────────────────────────────── */

import {
  AlphaType,
  Atlas,
  Canvas,
  Circle,
  ColorType,
  RadialGradient,
  Skia,
  useRSXformBuffer,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/* Aantal ringen en punten per ring. 26 × 44 ≈ 1150 punten: genoeg om het
   veld dicht te laten lijken, weinig genoeg om op een middenklasse-toestel
   soepel te blijven. */
const RINGS = 26;
const PER_RING = 44;
const COUNT = RINGS * PER_RING;

/* Hoe plat het veld ligt. 1 = een cirkel recht van voren, lager = verder
   weggekanteld. 0.34 geeft de schotel uit de mockup. */
const TILT = 0.34;

/** Het energieveld als PUNTENWOLK, in dezelfde genormaliseerde ruimte als de
 *  andere vormen (gecentreerd op 0, straal tot ongeveer 0,46).
 *
 *  Zo kan SplatField ertussen morphen: het veld is dan niet langer een eigen
 *  tekening maar één van de twee gedaanten die dezelfde punten aannemen.
 *  Precies wat de operator vroeg op 8 augustus 2026 — een draaiend veld in de
 *  ruimte dat in een gezicht overgaat en weer terug. */
export function energyFieldCloud(count: number): number[] {
  const out: number[] = [];
  const rings = Math.max(8, Math.round(Math.sqrt(count / 1.7)));
  const perRing = Math.max(8, Math.round(count / rings));
  for (let r = 0; r < rings && out.length < count * 2; r += 1) {
    /* Kwadratisch oplopend, net als in de tekening hieronder: dicht bij de
       kern staan de ringen op elkaar, naar buiten toe ruimer. */
    const rr = ((r + 1) / rings) ** 1.35 * 0.46;
    for (let k = 0; k < perRing && out.length < count * 2; k += 1) {
      const a = ((k + (r % 2) * 0.5) / perRing) * Math.PI * 2;
      out.push(Math.cos(a) * rr, Math.sin(a) * rr * TILT);
    }
  }
  /* Aanvullen als de deling niet uitkomt: liever een paar punten dubbel op de
     buitenring dan een wolk die korter is dan het veld verwacht. */
  while (out.length < count * 2) {
    const a = (out.length / (count * 2)) * Math.PI * 2;
    out.push(Math.cos(a) * 0.46, Math.sin(a) * 0.46 * TILT);
  }
  return out;
}

type Props = {
  width: number;
  height: number;
  /** Basiskleur van de punten. Standaard het accentblauw van het merk. */
  color?: string;
};

export default function EnergyField({
  width,
  height,
  color = '#3a8fff',
}: Props) {
  /* Eén doorlopende teller van 0 naar 1. Alles hieronder leest hem; er is
     geen tweede animatie die ermee uit de pas kan lopen. */
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 7000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t]);

  /* De sprite: één zacht uitdovend puntje, in kleur gebakken. Atlas kleurt
     niet per punt, dus de kleur zit in de textuur zelf. */
  const sprite = useMemo(() => {
    const S = 16;
    const half = S / 2;
    const bytes = new Uint8Array(S * S * 4);
    const hex = color.replace('#', '');
    const r0 = parseInt(hex.slice(0, 2), 16);
    const g0 = parseInt(hex.slice(2, 4), 16);
    const b0 = parseInt(hex.slice(4, 6), 16);
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        const d = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
        const a = d >= 1 ? 0 : Math.round((1 - d) * (1 - d) * 255);
        const i = (y * S + x) * 4;
        bytes[i] = r0;
        bytes[i + 1] = g0;
        bytes[i + 2] = b0;
        bytes[i + 3] = a;
      }
    }
    return Skia.Image.MakeImage(
      {
        width: S,
        height: S,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      },
      Skia.Data.fromBytes(bytes),
      S * 4,
    );
  }, [color]);

  const sprites = useMemo(
    () => new Array(COUNT).fill(0).map(() => Skia.XYWHRect(0, 0, 16, 16)),
    [],
  );

  /* De vaste eigenschappen van elk punt: op welke ring het zit, waar op die
     ring, en hoe helder het van zichzelf is. Eén keer berekend — wat per
     beeldje verandert staat in de worklet hieronder. */
  const seed = useMemo(() => {
    const ring = new Float32Array(COUNT);
    const ang = new Float32Array(COUNT);
    const bright = new Float32Array(COUNT);
    let i = 0;
    for (let r = 0; r < RINGS; r += 1) {
      /* Kwadratisch oplopend: dicht bij de kern staan de ringen dicht op
         elkaar, naar buiten toe steeds ruimer. Zo krijgt het midden zijn
         dichtheid zonder dat de rand leeg oogt. */
      const rr = ((r + 1) / RINGS) ** 1.35;
      for (let k = 0; k < PER_RING; k += 1) {
        ring[i] = rr;
        /* Een halve stap verspringen per ring, anders ontstaan er radiale
           lijnen die het rooster verraden. */
        ang[i] = ((k + (r % 2) * 0.5) / PER_RING) * Math.PI * 2;
        /* Punten dichter bij de kern zijn helderder; wat ruis erbij zodat
           het veld niet als een verloop leest maar als losse deeltjes. */
        bright[i] = (1 - rr) * 0.75 + 0.25 + ((i * 37) % 17) / 60;
        i += 1;
      }
    }
    return { ring, ang, bright };
  }, []);

  const cx = width / 2;
  /* Hoger dan het midden (operator-controle op het toestel, 8 augustus 2026):
     op 0.52 viel de kern precies achter de kop en zag je alleen de buitenrand.
     Op 0.40 staat het veld in de lege ruimte erboven, waar het op de mockup
     ook staat, en loopt de buitenrand achter de tekst door. */
  const cy = height * 0.4;
  const radius = Math.min(width, height) * 0.92;

  const transforms = useRSXformBuffer(COUNT, (val, i) => {
    'worklet';
    const rr = seed.ring[i];
    const a = seed.ang[i];

    /* De puls. Elke ring doet hetzelfde, maar later naarmate hij verder van
       de kern ligt: dat is wat de golf naar buiten laat lopen. Twee golven
       over elkaar met een ongelijk aantal omwentelingen, zodat het patroon
       zich niet elke ronde herhaalt. */
    const phase = (t.value - rr * 0.55) * Math.PI * 2;
    const wave = Math.sin(phase) * 0.5 + Math.sin(phase * 2.3 + a * 3) * 0.22;

    /* Straal en hoogte. De schotelvorm zit in TILT; de golf tilt de punten
       daar bovenop op en neer, sterker naar buiten toe. */
    const R = rr * radius;
    const lift = wave * radius * 0.055 * (0.35 + rr);
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R * TILT - lift;

    /* Punten die omhoog staan vangen meer licht — daardoor loopt er een
       heldere band met de golf mee naar buiten. */
    /* Forser dan eerst. Op een halve punt waren de deeltjes op het toestel
       nauwelijks te zien; het veld las als ruis in plaats van als vorm. */
    const glow = seed.bright[i] * (0.55 + wave * 0.45);
    const scale = Math.max(0.08, glow * 0.95);

    /* Geen draaiing: een rechtopstaand puntje ziet er van alle kanten
       hetzelfde uit, en een cosinus per beeldje uitsparen scheelt bij
       duizend punten. */
    val.set(scale, 0, x - 8 * scale, y - 8 * scale);
  });

  if (!sprite) return null;

  return (
    <Canvas style={{ width, height }}>
      {/* De kern. Zonder deze is het een veld zonder oorsprong: je ziet de
          golf wel lopen maar niet waar hij vandaan komt. Twee lagen — een
          brede gloed en een fel hart — want één verloop geeft een vlek en
          twee geven diepte. */}
      <Circle cx={cx} cy={cy} r={radius * 0.42}>
        <RadialGradient
          c={vec(cx, cy)}
          r={radius * 0.42}
          colors={[`${color}55`, `${color}18`, 'rgba(0,0,0,0)']}
          positions={[0, 0.45, 1]}
        />
      </Circle>
      <Circle cx={cx} cy={cy} r={radius * 0.1}>
        <RadialGradient
          c={vec(cx, cy)}
          r={radius * 0.1}
          colors={['rgba(255,255,255,0.9)', `${color}90`, 'rgba(0,0,0,0)']}
          positions={[0, 0.35, 1]}
        />
      </Circle>
      <Atlas image={sprite} sprites={sprites} transforms={transforms} />
    </Canvas>
  );
}
