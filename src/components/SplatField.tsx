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
  AlphaType,
  Atlas,
  Canvas,
  ColorType,
  Skia,
  useImage,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRSXformBuffer } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

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
  /* Rechtstreeks uit het geladen beeld lezen, ZONDER offscreen tekenvlak.
     Dat vlak stond hier eerst en is precies wat op een emulator zonder
     werkende GPU-laag stilletjes niets teruggeeft — en dan tekende dit
     onderdeel een leeg scherm zonder iets te melden. Uitlezen en verkleinen
     doen we nu zelf: kost eenmalig wat rekenwerk, maar het kán niet mislukken
     door een grafische laag die er niet is. */
  const iw = img.width();
  const ih = img.height();
  const pixels = img.readPixels(0, 0, {
    width: iw,
    height: ih,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) return null;

  /* Verhouding behouden: het portret is breder dan hoog (1535×1024). Zou het
     in het vierkante veld geperst worden, dan worden de gezichten smal en
     lang. De lege banden boven en onder leveren vanzelf geen punten op. */
  const k = Math.min(1 / iw, 1 / ih);
  const fw = iw * k;
  const fh = ih * k;
  const ox = (1 - fw) / 2;
  const oy = (1 - fh) / 2;

  /* Verkleinen door stapsgewijs te bemonsteren in plaats van te schalen. */
  const stepX = Math.max(1, Math.floor(iw / GRID));
  const stepY = Math.max(1, Math.floor(ih / GRID));

  const cand: { x: number; y: number; w: number }[] = [];
  for (let y = 0; y < ih; y += stepY) {
    for (let x = 0; x < iw; x += stepX) {
      const i = (y * iw + x) * 4;
      const r = (pixels[i] as number) / 255;
      const g = (pixels[i + 1] as number) / 255;
      const b = (pixels[i + 2] as number) / 255;
      const a = (pixels[i + 3] as number) / 255;
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) * a;
      if (luma > LUMA_MIN) {
        cand.push({ x: ox + (x / iw) * fw, y: oy + (y / ih) * fh, w: luma });
      }
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

/* ── Component ────────────────────────────────────────────────────────── */

const TAU = Math.PI * 2;

type Props = {
  /** Waar de punten VANDAAN komen bij t = 0, uit een beeld. */
  restUri?: string;
  /** Zelfde rol, maar berekend. Gaat vóór op `restUri`. */
  restBuilder?: (count: number) => number[];
  /** Waar ze NAARTOE gaan bij t = 1, uit een beeld. */
  endUri?: string;
  /** Zelfde rol, maar berekend. Gaat vóór op `endUri`. */
  endBuilder?: (count: number) => number[];
  /** Draaiing van de EINDvorm, in omwentelingen. Alleen het eindbeeld draait
   *  mee; het beginbeeld blijft staan. Zo is de rozet al aan het draaien
   *  terwijl de punten hem nog aan het vormen zijn, in plaats van pas te
   *  beginnen zodra de getekende versie verschijnt. */
  spin?: SharedValue<number>;
  /** 0 = de beginvorm, 1 = de eindvorm. */
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
  restUri,
  restBuilder,
  endUri,
  endBuilder,
  spin,
  breath,
  size,
  color,
  count = 2600,
}: Props) {
  /* `useImage` is een hook, dus beide aanroepen moeten er altijd staan, ook
     als die kant een berekende vorm gebruikt. Een lege bron levert `null` en
     dat vangt de samenstelling hieronder af. */
  const restImg = useImage(restUri ?? '');
  const endImg = useImage(endUri ?? '');

  /* Altijd een eigen waarde bij de hand, ook als de aanroeper er geen
     meegeeft: een worklet die soms wel en soms geen gedeelde waarde ziet is
     een bron van fouten die pas op een toestel opduiken. */
  const fallbackSpin = useSharedValue(0);
  const turn = spin ?? fallbackSpin;

  /* Eén zacht rond puntje, één keer getekend en daarna duizenden keren
     hergebruikt. Dat is het hele idee achter Atlas.
     De KLEUR zit in de sprite zelf en niet in een `colors`-lijst naast het
     veld: zo'n lijst zou per punt een kleurobject vragen — duizenden keren
     dezelfde waarde doorgeven aan de tekenlaag, met alle risico van dien —
     terwijl elk punt hier toch dezelfde kleur heeft. */
  const sprite = useMemo(() => {
    /* Zelf pixel voor pixel opgebouwd en dan tot beeld gemaakt — ook hier
       geen offscreen tekenvlak, om dezelfde reden als bij het aftasten. Een
       rond verloop van vol naar doorzichtig, 24 bij 24. */
    const S = 24;
    const c = Skia.Color(color);
    const r0 = Math.round((c[0] ?? 1) * 255);
    const g0 = Math.round((c[1] ?? 1) * 255);
    const b0 = Math.round((c[2] ?? 1) * 255);
    const bytes = new Uint8Array(S * S * 4);
    const half = S / 2;
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        const d = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
        /* Kwadratisch uitdovend: een zachte kern in plaats van een schijf. */
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

  const clouds = useMemo(() => {
    const rest = restBuilder
      ? restBuilder(count)
      : restImg
        ? sampleImage(restImg, count)
        : null;
    const end = endBuilder
      ? endBuilder(count)
      : endImg
        ? sampleImage(endImg, count)
        : null;
    if (!rest || !end) return null;
    return { rest: order(rest), end: order(end) };
  }, [restImg, restBuilder, endImg, endBuilder, count]);

  /* Stil falen is hier het ergste wat kan: je kijkt naar zwart en weet niet
     of het laadt, of stuk is, of dat de punten buiten beeld staan. Elke
     mislukking zegt daarom WAAR hij zit. */
  if (!sprite || !clouds) {
    const waiting = (restUri && !restImg) || (endUri && !endImg);
    const why = waiting
      ? 'laden…'
      : !sprite
        ? 'sprite mislukt'
        : 'aftasten mislukt';
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
          {why}
        </Text>
      </View>
    );
  }

  return (
    <PointCloud
      clouds={clouds}
      turn={turn}
      breath={breath}
      size={size}
      sprite={sprite}
      count={count}
    />
  );
}

/* ── De tekenlaag ─────────────────────────────────────────────────────────
   Apart, en dat is geen opsmuk maar de oplossing van een echte fout.

   `useRSXformBuffer` maakt zijn buffer ÉÉN keer aan en houdt de functie vast
   die hij bij die eerste keer meekreeg. Stond die functie hierboven, dan las
   ze de wolken zoals die er op dat moment waren — en de foto's laden later.
   Was de buffer eerder klaar dan de gegevens, dan bleef hij voor altijd naar
   niets wijzen: geen beweging, geen morph, een leeg vlak. En omdat het van
   laadtijden afhing, gebeurde het de ene keer wel en de andere keer niet.
   Precies wat de operator zag.

   Dit onderdeel bestaat pas zodra álles er is. Daarmee kan de functie geen
   half gevulde toestand vastpakken; de vraag komt niet meer voor. ── */

function PointCloud({
  clouds,
  turn,
  breath,
  size,
  sprite,
  count,
}: {
  clouds: { rest: Cloud; end: Cloud };
  turn: SharedValue<number>;
  breath: SharedValue<number>;
  size: number;
  sprite: SkImage;
  count: number;
}) {
  const sprites: SkRect[] = useMemo(
    () => new Array(count).fill(0).map(() => Skia.XYWHRect(0, 0, 24, 24)),
    [count],
  );

  /* Sinus en cosinus ÉÉN keer per beeldje, niet per punt. Per punt zou het
     bij tweeduizend punten ruim tweehonderdduizend berekeningen per seconde
     opleveren op de tekendraad — precies het soort last dat een instapmodel
     laat haperen. */
  const rot = useDerivedValue(() => {
    const a = turn.value * TAU;
    return { c: Math.cos(a), s: Math.sin(a) };
  });

  const transforms = useRSXformBuffer(count, (val, i) => {
    'worklet';
    /* Recht evenredig van begin- naar eindvorm. De ademwaarde draagt de
       versnelling al; een tweede verzachting bovenop maakt de beweging niet
       rustiger maar onregelmatig.

       Er zit geen schaaltruc meer in. Die was er om een keerpunt te maken,
       maar het keerpunt hoort in de ADEM te zitten en niet in dit onderdeel:
       één waarde op en neer, en de heenweg is vanzelf het spiegelbeeld van
       de terugweg. Zolang hier eigen bochten in zaten, kon de getekende rozet
       er nooit precies op passen — en dat was de sprong die de operator zag:
       groot, plof, echte maat. */
    const t = breath.value;
    const ix = i * 2;

    /* Alleen de EINDvorm draait. Het beginbeeld — de gezichten — hoort stil te
       staan; die zouden anders scheef hangen. */
    const ex = clouds.end[ix] - 0.5;
    const ey = clouds.end[ix + 1] - 0.5;
    const c = rot.value.c;
    const sn = rot.value.s;
    const exr = 0.5 + ex * c - ey * sn;
    const eyr = 0.5 + ex * sn + ey * c;

    const x = clouds.rest[ix] + (exr - clouds.rest[ix]) * t;
    const y = clouds.rest[ix + 1] + (eyr - clouds.rest[ix + 1]) * t;

    /* Dichter opeen wanneer ze de rozet vormen, iets ijler in het gezicht. */
    const scale = (0.25 - t * 0.08) * (size / 320);
    val.set(scale, 0, x * size, y * size);
  });

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Atlas image={sprite} sprites={sprites} transforms={transforms} />
    </Canvas>
  );
}
