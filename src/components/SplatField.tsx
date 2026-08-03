/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Puntenveld ("splat field")

   PROTOTYPE, 3 augustus 2026. Concept van de operator: laat niet de lucht
   zien die in- en uitgaat, maar wat ademen DOET — ordenen. Duizenden losse
   lichtpunten die bij het inademen samentrekken tot een beeld en bij het
   uitademen weer uiteenwaaieren.

   ── Waarom dit geen echte Gaussian splats zijn ────────────────────────
   Echte 3DGS is een eigen renderpipeline met miljoenen geroteerde ellipsen
   en een eigen shaderketen; die draait niet in React Native. Wat hier staat
   is een tweedimensionale puntenwolk met zachte, optellend gemengde
   sprites. Op een telefoonscherm is het verschil niet te zien; in de
   techniek eronder wel, en dat hoort iemand te weten die dit later oppakt.

   ── Drie standen, één waarde ──────────────────────────────────────────
   Elk punt kent drie plekken, en de ademwaarde schuift ertussen:

       0.0   CHAOS      losgeslagen, ver uit het midden
       0.45  DE MODUS   kort de vorm van de gekozen toestand
       1.0   ORDE       het eindbeeld, volledig samengetrokken

   Inademen loopt van chaos naar orde en pásseert onderweg de modusvorm;
   uitademen doet hetzelfde terug. Daarom hoeft die vorm nergens apart
   aangestuurd te worden — hij ligt op de route. Precies wat de operator
   bedoelde: de gebruiker ziet het niet, hij voelt het.

   ── Waarom de punten niet willekeurig door elkaar lopen ───────────────
   Punt 12 van de ene wolk moet bij punt 12 van de andere horen, anders is
   morphen ruis in plaats van beweging. Beide wolken worden daarom gesorteerd
   op hoek rond hun zwaartepunt en daarna op afstand. Dan draait en zwelt de
   figuur als geheel — het magnetische veld waar de operator om vroeg.

   ── Prestatie ─────────────────────────────────────────────────────────
   `useRSXformBuffer` werkt een VOORAF GEALLOCEERDE buffer bij op de
   UI-thread. Zonder dat zou elk frame een paar duizend objecten aanmaken en
   weer weggooien, en dan haalt geen enkel middenklasse-toestel zestig beelden
   per seconde. Het aantal punten staat daarom ook los instelbaar: eerst
   voelen hoeveel er nodig zijn, dan pas ophogen.
   ───────────────────────────────────────────────────────────────────────── */

import {
  Atlas,
  Canvas,
  Skia,
  useImage,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useRSXformBuffer } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

/* Het raster waarop een bronbeeld wordt afgetast. 128×128 is ruim genoeg om
   een gezicht te herkennen en klein genoeg om in één keer uit te lezen. */
const GRID = 128;

/* Onder deze helderheid telt een pixel niet mee. De illustraties staan op
   zwart, dus dit scheidt onderwerp van achtergrond zonder masker. */
const LUMA_MIN = 0.18;

type Cloud = number[]; // [x0, y0, x1, y1, …] genormaliseerd naar 0…1

/* ── Aftasten ─────────────────────────────────────────────────────────── */

/** Verklein het beeld naar GRID×GRID, lees de pixels en kies daaruit
 *  `count` punten. Helderdere pixels maken meer kans, zodat de punten zich
 *  ophopen waar het beeld licht geeft — bij een gezicht dus in de trekken
 *  en niet in de schaduw. */
function sampleImage(img: SkImage, count: number): Cloud | null {
  const surface = Skia.Surface.MakeOffscreen(GRID, GRID);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('#000000'));
  /* Verhouding behouden. Het portret is breder dan hoog (1535×1024); zou het
     in het vierkante raster geperst worden, dan worden de gezichten smal en
     lang. De zwarte banden die daardoor boven en onder overblijven leveren
     vanzelf geen punten op — die halen de helderheidsdrempel niet. */
  const iw = img.width();
  const ih = img.height();
  const k = Math.min(GRID / iw, GRID / ih);
  const dw = iw * k;
  const dh = ih * k;
  canvas.drawImageRect(
    img,
    Skia.XYWHRect(0, 0, iw, ih),
    Skia.XYWHRect((GRID - dw) / 2, (GRID - dh) / 2, dw, dh),
    Skia.Paint(),
  );
  const snapshot = surface.makeImageSnapshot();
  const pixels = snapshot.readPixels(0, 0, {
    width: GRID,
    height: GRID,
    colorType: snapshot.getImageInfo().colorType,
    alphaType: snapshot.getImageInfo().alphaType,
  });
  if (!pixels) return null;

  /* Kandidaten verzamelen met hun helderheid als gewicht. */
  const cand: { x: number; y: number; w: number }[] = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const i = (y * GRID + x) * 4;
      const r = (pixels[i] as number) / 255;
      const g = (pixels[i + 1] as number) / 255;
      const b = (pixels[i + 2] as number) / 255;
      const a = (pixels[i + 3] as number) / 255;
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) * a;
      if (luma > LUMA_MIN) cand.push({ x: x / GRID, y: y / GRID, w: luma });
    }
  }
  if (cand.length === 0) return null;

  /* Op helderheid sorteren en dan gelijkmatig doorlopen. Dat geeft meer
     punten in de lichte delen zonder dat de donkere helemaal wegvallen —
     puur willekeurig trekken laat een gezicht juist vlekkerig worden. */
  cand.sort((p, q) => q.w - p.w);
  const out: Cloud = [];
  for (let i = 0; i < count; i += 1) {
    /* Kwadratische verdeling: de eerste helft van de lijst (de lichtste
       pixels) krijgt het leeuwendeel van de punten. */
    const t = i / count;
    const idx = Math.min(cand.length - 1, Math.floor(t * t * cand.length));
    const p = cand[idx];
    out.push(p.x, p.y);
  }
  return out;
}

/** Sorteer een wolk op hoek rond het zwaartepunt en daarna op afstand.
 *  Alleen zo hoort punt n van de ene wolk bij punt n van de andere. */
function order(cloud: Cloud): Cloud {
  const n = cloud.length / 2;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i += 1) {
    cx += cloud[i * 2];
    cy += cloud[i * 2 + 1];
  }
  cx /= n;
  cy /= n;

  const idx = Array.from({ length: n }, (_, i) => i);
  const ang = new Float64Array(n);
  const rad = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const dx = cloud[i * 2] - cx;
    const dy = cloud[i * 2 + 1] - cy;
    ang[i] = Math.atan2(dy, dx);
    rad[i] = Math.hypot(dx, dy);
  }
  idx.sort((a, b) => (ang[a] === ang[b] ? rad[a] - rad[b] : ang[a] - ang[b]));

  const out: Cloud = [];
  for (const i of idx) out.push(cloud[i * 2], cloud[i * 2 + 1]);
  return out;
}

/** De chaos-stand. Afgeleid VAN de geordende stand, niet willekeurig
 *  gestrooid: elk punt vliegt naar buiten langs zijn eigen hoek. Daardoor
 *  ziet uiteenvallen eruit als loslaten en niet als sneeuw. */
function scatter(ordered: Cloud): Cloud {
  const n = ordered.length / 2;
  const out: Cloud = [];
  for (let i = 0; i < n; i += 1) {
    const dx = ordered[i * 2] - 0.5;
    const dy = ordered[i * 2 + 1] - 0.5;
    const a = Math.atan2(dy, dx);
    /* Vaste pseudo-toevalligheid op de index: elke start ziet er hetzelfde
       uit, en er is geen Math.random in beeld die per frame verspringt. */
    const h = Math.sin(i * 12.9898) * 43758.5453;
    const jitter = h - Math.floor(h);
    const reach = 0.55 + jitter * 0.75;
    out.push(0.5 + Math.cos(a) * reach, 0.5 + Math.sin(a) * reach);
  }
  return out;
}

/* ── Component ────────────────────────────────────────────────────────── */

type Props = {
  /** Het eindbeeld: waar de punten naartoe trekken bij volledig inademen. */
  orderedUri: string;
  /** De vorm van de gekozen modus, waar de wolk onderweg doorheen gaat. */
  modeUri: string;
  /** 0 = volledig uitgeademd (chaos), 1 = volledig ingeademd (orde). */
  breath: SharedValue<number>;
  size: number;
  /** Kleur van de punten — de accentkleur van de toestand. */
  color: string;
  /** Meer punten is rijker en zwaarder. Bewust laag begonnen: eerst voelen
   *  of het werkt en of het toestel het trekt, dan pas ophogen richting de
   *  vijf- à tienduizend uit het oorspronkelijke idee. */
  count?: number;
};

export default function SplatField({
  orderedUri,
  modeUri,
  breath,
  size,
  color,
  count = 1200,
}: Props) {
  const orderedImg = useImage(orderedUri);
  const modeImg = useImage(modeUri);

  /* Eén zacht rond puntje, één keer getekend en daarna duizenden keren
     hergebruikt. Dat is het hele idee achter Atlas.
     De KLEUR zit in de sprite zelf en niet in een `colors`-lijst naast het
     veld: zo'n lijst zou per punt een kleurobject vragen — duizenden keren
     dezelfde waarde doorgeven aan de tekenlaag, met alle risico van dien —
     terwijl elk punt hier toch dezelfde kleur heeft. */
  const sprite = useMemo(() => {
    const S = 24;
    const surface = Skia.Surface.MakeOffscreen(S, S);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('#00000000'));
    const paint = Skia.Paint();
    paint.setShader(
      Skia.Shader.MakeRadialGradient(
        { x: S / 2, y: S / 2 },
        S / 2,
        [Skia.Color(color), Skia.Color('#00000000')],
        [0, 1],
        0,
      ),
    );
    canvas.drawCircle(S / 2, S / 2, S / 2, paint);
    return surface.makeImageSnapshot();
  }, [color]);

  const clouds = useMemo(() => {
    if (!orderedImg || !modeImg) return null;
    const ord = sampleImage(orderedImg, count);
    const mod = sampleImage(modeImg, count);
    if (!ord || !mod) return null;
    const o = order(ord);
    return { ordered: o, mode: order(mod), chaos: scatter(o) };
  }, [orderedImg, modeImg, count]);

  const sprites: SkRect[] = useMemo(
    () => new Array(count).fill(0).map(() => Skia.XYWHRect(0, 0, 24, 24)),
    [count],
  );

  const transforms = useRSXformBuffer(count, (val, i) => {
    'worklet';
    if (!clouds) {
      val.set(0, 0, -100, -100);
      return;
    }
    const t = breath.value;
    const ix = i * 2;

    /* Twee etappes: chaos → modusvorm → orde. De modusvorm ligt op 0.45,
       zodat hij dicht bij het uitgeademde einde zit en je hem passeert
       zonder dat hij ooit het eindbeeld verdringt. */
    const MID = 0.45;
    let x: number;
    let y: number;
    if (t <= MID) {
      const k = t / MID;
      x = clouds.chaos[ix] + (clouds.mode[ix] - clouds.chaos[ix]) * k;
      y = clouds.chaos[ix + 1] + (clouds.mode[ix + 1] - clouds.chaos[ix + 1]) * k;
    } else {
      const k = (t - MID) / (1 - MID);
      x = clouds.mode[ix] + (clouds.ordered[ix] - clouds.mode[ix]) * k;
      y = clouds.mode[ix + 1] + (clouds.ordered[ix + 1] - clouds.mode[ix + 1]) * k;
    }

    /* Punten worden kleiner naarmate ze verder uit elkaar staan. Zonder dat
       lijkt uiteenvallen op uitvergroten in plaats van vervliegen. */
    const scale = (0.14 + t * 0.16) * (size / 320);
    val.set(scale, 0, x * size, y * size);
  });

  if (!sprite || !clouds) {
    return <Canvas style={{ width: size, height: size }} />;
  }

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Atlas image={sprite} sprites={sprites} transforms={transforms} />
    </Canvas>
  );
}
