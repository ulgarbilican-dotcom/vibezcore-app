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
  /** Waar dat hart zit. Bij een lotus is dat niet het middelpunt maar de
   *  voet waar alle blaadjes samenkomen. Weglaten = de oorsprong. */
  coreY?: number;
  /** De rand is decor in plaats van begrenzing, en hoort dus veel flauwer
   *  getekend te worden. Geldt voor figuren zonder omsluitende cirkel. */
  rimSoft?: boolean;
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
   Operator 2026-08-01: "de mandala is niet echt heel mooi" — en terecht.
   Hier stond een radiaal rozet: twintig blaadjes gelijkmatig rond een
   middelpunt. Dat is een mandala, geen lotus.

   Een lotus zie je van VOREN. De blaadjes waaieren omhoog vanuit één punt
   onderaan, in lagen: de achterste rij breed en laag uitgespreid, de
   voorste rij smal en rechtop. Dat overlappen ís de bloem — een bloem
   waarvan alle blaadjes even ver van het hart liggen bestaat niet.

   Vandaar ook geen omsluitende cirkel. De referentie heeft er geen; een
   lotus hangt in de ruimte, hij zit niet in een wiel. Wat ervoor in de
   plaats komt zijn een paar heel platte ellipsen erachter, die geven
   diepte zonder de vorm te begrenzen. */
function lotus(R: number): Figure {
  const web = Skia.Path.Make();

  /* Eén blad: van de voet naar buiten, met twee zijden die uitbollen. De
     bolling zit op tweederde en niet op de helft — dat maakt het verschil
     tussen een blaadje en een ruit. */
  const petal = (
    p: SkPath,
    bx: number,
    by: number,
    angle: number,
    len: number,
    halfW: number,
  ) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const tx = bx + dx * len;
    const ty = by + dy * len;
    /* Loodrecht op de lengterichting — daar is het blad breed. */
    const px = -dy * halfW;
    const py = dx * halfW;
    const mx = bx + dx * len * 0.62;
    const my = by + dy * len * 0.62;

    p.moveTo(bx, by);
    p.quadTo(mx + px, my + py, tx, ty);
    p.quadTo(mx - px, my - py, bx, by);
    p.close();
  };

  /* De voet ligt onder het midden: daar komen alle blaadjes samen. */
  const bx = 0;
  const by = R * 0.58;

  /* Drie lagen. Naar voren toe: minder blaadjes, korter, rechter op. De
     hoeken zijn gespiegeld rond recht-omhoog (−90°). */
  const rows = [
    { n: 9, spread: 168, len: 0.94, w: 0.15 },
    { n: 7, spread: 126, len: 0.74, w: 0.14 },
    { n: 5, spread: 84, len: 0.52, w: 0.125 },
  ];

  const tips: { x: number; y: number }[] = [];

  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const t = row.n === 1 ? 0.5 : i / (row.n - 1);
      const deg = -90 - row.spread / 2 + t * row.spread;
      const a = (deg * Math.PI) / 180;
      petal(web, bx, by, a, R * row.len, R * row.w);
      tips.push({
        x: bx + Math.cos(a) * R * row.len,
        y: by + Math.sin(a) * R * row.len,
      });
    }
  }

  /* Diepte erachter: platte ellipsen, geen cirkel. Ze moeten de bloem
     omvatten en niet eronder liggen — twee smalle ellipsen ónder de voet
     lazen als een schoteltje, alsof de lotus op een bordje stond. Nu drie
     ruime ringen rond het hart, die met `rimSoft` heel flauw getekend
     worden. Ze mogen de blaadjes kruisen; op die dekking leest dat als
     ruimte erachter in plaats van als een lijn eroverheen. */
  const rim = Skia.Path.Make();
  const ringY = by - R * 0.06;
  for (const w of [1.16, 0.88, 0.6]) {
    rim.addOval(
      Skia.XYWHRect(-R * w, ringY - R * w * 0.3, R * w * 2, R * w * 0.6),
    );
  }

  /* Licht op de punten van de voorste twee lagen — de achterste rij ligt
     visueel het verst weg en hoort niet even hard mee te schitteren. */
  const nodes = tips.slice(rows[0].n);

  /* Het hart zit in de voet, niet in het midden van het doek. */
  return { web, rim, nodes, core: true, coreY: by, rimSoft: true };
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
