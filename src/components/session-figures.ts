/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Sessie-figuren

   Operator 2026-07-31: zeven visuals, één per mentale toestand.

     Focus          → Flower of Life
     Calm           → Lotus Mandala
     Sleep          → Concentric Ripples
     Energy         → Radiating Sun
     Balance        → Hexagonal Sacred Geometry
     Deep Relax     → Soft Orb
     Anxiety Relief → Gentle Ripple

   "Elke visual ademt op exact hetzelfde ritme, maar heeft een eigen
   karakter." Dat is precies waarom de geometrie hier los staat van de
   animatie: dit bestand kent alleen VORM. Het ritme zit in de component die
   ze tekent, en is voor alle zeven identiek. Zo kan een figuur er nooit
   anders gaan ademen dan de rest.

   Alles in lokale coördinaten rond de oorsprong, met de buitenstraal als
   enige maat. Draaien, schalen en verplaatsen doet de aanroeper met één
   transformatie; de geometrie zelf verandert nooit en wordt dus maar één
   keer opgebouwd.
   ───────────────────────────────────────────────────────────────────────── */

import { Skia, type SkPath } from '@shopify/react-native-skia';

const TAU = Math.PI * 2;

export type FigureKey =
  | 'flower'
  | 'lotus'
  | 'ripples'
  | 'sun'
  | 'hex'
  | 'orb'
  | 'gentle';

export type Figure = {
  /** De fijne binnenstructuur. Haarlijn, gedempt. */
  web: SkPath;
  /** De buitenrand. Helderder — dit is wat de vorm begrenst. */
  rim: SkPath;
  /** Lichtpunten op markante snijpunten. Leeg als de figuur er geen heeft. */
  nodes: { x: number; y: number }[];
  /** Of het hart een eigen lichtpunt krijgt. */
  core: boolean;
};

/* ── Flower of Life ────────────────────────────────────────────────────
   Negentien cirkels op een driehoeksrooster. De straal van elke cirkel is
   een derde van de buitenstraal; punten tot op tweederde daarvan. Zo raken
   de buitenste cirkels precies de rand — dat is wat de figuur haar sluiting
   geeft. */
function flower(R: number): Figure {
  const r = R / 3;
  const web = Skia.Path.Make();
  const pts: { x: number; y: number }[] = [];

  const v1 = { x: r, y: 0 };
  const v2 = { x: r / 2, y: (r * Math.sqrt(3)) / 2 };

  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const x = i * v1.x + j * v2.x;
      const y = i * v1.y + j * v2.y;
      if (Math.hypot(x, y) > 2 * r + 0.001) continue;
      web.addCircle(x, y, r);
      pts.push({ x, y });
    }
  }

  const rim = Skia.Path.Make();
  rim.addCircle(0, 0, R);

  /* Knopen op de zes punten waar de buitenste cirkels de rand raken. */
  const nodes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * TAU - Math.PI / 2;
    return { x: Math.cos(a) * R, y: Math.sin(a) * R };
  });

  return { web, rim, nodes, core: true };
}

/* ── Lotus ─────────────────────────────────────────────────────────────
   Twee kransen bloembladen, de buitenste een halve stap verdraaid. Elk blad
   is een amandel van twee bogen — dat is de vorm die een lotusblad maakt en
   die je met twee kwadratische curven exact kunt leggen. */
function lotus(R: number): Figure {
  const web = Skia.Path.Make();

  const petal = (
    p: SkPath,
    angle: number,
    inner: number,
    outer: number,
    width: number,
  ) => {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    /* Punt aan de binnenkant, punt aan de buitenkant, en twee zijden die
       daartussen uitbollen. */
    const ix = ca * inner;
    const iy = sa * inner;
    const ox = ca * outer;
    const oy = sa * outer;
    const mx = ca * (inner + outer) * 0.5;
    const my = sa * (inner + outer) * 0.5;
    /* Loodrecht op de straal, want daar moet het blad breed zijn. */
    const px = -sa * width;
    const py = ca * width;

    p.moveTo(ix, iy);
    p.quadTo(mx + px * 2, my + py * 2, ox, oy);
    p.quadTo(mx - px * 2, my - py * 2, ix, iy);
    p.close();
  };

  const outerPetals = 12;
  for (let i = 0; i < outerPetals; i++) {
    petal(web, (i / outerPetals) * TAU, R * 0.3, R * 0.94, R * 0.1);
  }
  const innerPetals = 8;
  for (let i = 0; i < innerPetals; i++) {
    petal(
      web,
      (i / innerPetals) * TAU + TAU / (innerPetals * 2),
      R * 0.08,
      R * 0.5,
      R * 0.075,
    );
  }

  const rim = Skia.Path.Make();
  rim.addCircle(0, 0, R);

  const nodes = Array.from({ length: outerPetals }, (_, i) => {
    const a = (i / outerPetals) * TAU;
    return { x: Math.cos(a) * R * 0.94, y: Math.sin(a) * R * 0.94 };
  });

  return { web, rim, nodes, core: true };
}

/* ── Concentric Ripples ────────────────────────────────────────────────
   Ringen die naar buiten toe dichter op elkaar komen te liggen. Gelijke
   afstanden zouden als een schietschijf lezen; deze verdeling leest als
   water dat uitdempt. */
function ripples(R: number): Figure {
  const web = Skia.Path.Make();
  const rings = 9;
  for (let i = 1; i <= rings; i++) {
    const t = i / rings;
    web.addCircle(0, 0, R * Math.pow(t, 0.72));
  }

  const rim = Skia.Path.Make();
  rim.addCircle(0, 0, R);

  return { web, rim, nodes: [], core: true };
}

/* ── Radiating Sun ─────────────────────────────────────────────────────
   Stralen vanuit een kern, afwisselend lang en kort. Alleen lange stralen
   ogen als een ster; de afwisseling maakt er een zon van. */
function sun(R: number): Figure {
  const web = Skia.Path.Make();
  const rays = 24;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * TAU;
    const long = i % 2 === 0;
    const r0 = R * 0.26;
    const r1 = R * (long ? 0.95 : 0.66);
    web.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    web.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
  }
  web.addCircle(0, 0, R * 0.26);
  web.addCircle(0, 0, R * 0.44);

  const rim = Skia.Path.Make();
  rim.addCircle(0, 0, R);

  const nodes = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * TAU;
    return { x: Math.cos(a) * R * 0.95, y: Math.sin(a) * R * 0.95 };
  });

  return { web, rim, nodes, core: true };
}

/* ── Hexagonal Sacred Geometry ─────────────────────────────────────────
   Geneste zeshoeken met de verbindingen naar het midden. Een zeshoek is de
   enige regelmatige vorm die het vlak sluitend vult; dat is waarom hij als
   evenwicht leest. */
function hex(R: number): Figure {
  const web = Skia.Path.Make();

  const ring = (p: SkPath, rad: number, rot: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * TAU + rot;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
  };

  ring(web, R * 0.3, 0);
  ring(web, R * 0.58, Math.PI / 6);
  ring(web, R * 0.86, 0);

  /* Speken naar het midden, op de hoekpunten van de buitenste zeshoek. */
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    web.moveTo(0, 0);
    web.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86);
  }

  const rim = Skia.Path.Make();
  rim.addCircle(0, 0, R);

  const nodes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * TAU;
    return { x: Math.cos(a) * R * 0.86, y: Math.sin(a) * R * 0.86 };
  });

  return { web, rim, nodes, core: true };
}

/* ── Soft Orb ──────────────────────────────────────────────────────────
   Geen structuur, alleen een bol. Bij diepe ontspanning is elk patroon iets
   om naar te kijken, en dat is precies wat je dan niet wilt. Een paar zeer
   ruime ringen geven hem volume zonder iets te vertellen. */
function orb(R: number): Figure {
  const web = Skia.Path.Make();
  web.addCircle(0, 0, R * 0.42);
  web.addCircle(0, 0, R * 0.68);

  const rim = Skia.Path.Make();
  rim.addCircle(0, 0, R);

  return { web, rim, nodes: [], core: true };
}

/* ── Gentle Ripple ─────────────────────────────────────────────────────
   Drie ruim uit elkaar liggende ringen. Bij spanning helpt weinig prikkel;
   dit is de rustigste van de zeven, met opzet bijna leeg. */
function gentle(R: number): Figure {
  const web = Skia.Path.Make();
  web.addCircle(0, 0, R * 0.38);
  web.addCircle(0, 0, R * 0.62);
  web.addCircle(0, 0, R * 0.82);

  const rim = Skia.Path.Make();
  rim.addCircle(0, 0, R);

  return { web, rim, nodes: [], core: true };
}

const BUILDERS: Record<FigureKey, (R: number) => Figure> = {
  flower,
  lotus,
  ripples,
  sun,
  hex,
  orb,
  gentle,
};

export function buildFigure(key: FigureKey, R: number): Figure {
  return BUILDERS[key](R);
}
