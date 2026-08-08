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

/* Hoeveel extra draaiing de reis zelf meekrijgt, in radialen. Ruim een
   achtste slag: genoeg om de beweging de draaiing in te laten krullen, te
   weinig om op de terugweg als terugdraaien te lezen. */
const SWIRL = 0.85;

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
  /** 0 = de adem stijgt, 1 = hij daalt.
   *
   *  Nodig omdat een menging die heen loopt, terug automatisch de andere kant
   *  op gaat — en dan draait de morph op de terugweg tegen de klok in. Met
   *  deze vlag neemt de terugweg de ANDERE helft van de cirkel: heen loopt het
   *  punt de boog naar zijn eindhoek, terug loopt het diezelfde cirkel verder
   *  uit tot het weer bij zijn beginhoek is. Beide keren met de klok mee, en
   *  samen precies één volledige omwenteling per ademcyclus. */
  flow?: SharedValue<number>;
  /** 0 = de beginvorm, 1 = de eindvorm. */
  breath: SharedValue<number>;
  size: number;
  /** Kleur van de punten — de accentkleur van de toestand. */
  color: string;
  /** Hoe sterk de wolk HALVERWEGE uiteenvalt. 0 = uit, en dat is de stand
   *  waarop de Breath-tab draait — daar mag niets aan veranderen.
   *
   *  Waarom dit bestaat (operator, 8 augustus 2026: "nu draait alles gewoon
   *  rond as, is niet supermooi"): een morph in poolcoördinaten loopt van de
   *  ene hoek naar de andere en leest daardoor altijd als een schijf die
   *  kantelt. Er zit geen moment in waarop de wolk écht veld ís.
   *
   *  Met deze waarde duwen de punten op de helft van de reis naar buiten en
   *  raken ze hun ordening kwijt — dat is het energieveld — en trekken daarna
   *  samen tot de volgende vorm. De draaiing blijft, maar wordt bijzaak.
   *
   *  Het is één belcurve: nul aan beide uiteinden, maximaal in het midden.
   *  Daardoor kan hij de eindvormen per definitie niet vervuilen. */
  disperse?: number;
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
  flow,
  breath,
  size,
  color,
  disperse = 0,
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
  const fallbackFlow = useSharedValue(0);
  const dir = flow ?? fallbackFlow;

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
      dir={dir}
      breath={breath}
      size={size}
      sprite={sprite}
      disperse={disperse}
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
  dir,
  breath,
  size,
  sprite,
  disperse,
  count,
}: {
  clouds: { rest: Cloud; end: Cloud };
  turn: SharedValue<number>;
  dir: SharedValue<number>;
  breath: SharedValue<number>;
  size: number;
  sprite: SkImage;
  disperse: number;
  count: number;
}) {
  const sprites: SkRect[] = useMemo(
    () => new Array(count).fill(0).map(() => Skia.XYWHRect(0, 0, 24, 24)),
    [count],
  );

  /* ── Hoek en straal, niet x en y ──────────────────────────────────────
     De reis zelf moet een DRAAIING zijn (operator, 3 augustus 2026). Reken je
     in x en y, dan schuift elk punt langs een rechte lijn van de ene vorm
     naar de andere; een draaiing die je daaroverheen legt beweegt het hele
     veld, maar de reis blijft recht. Dat is wat er niet klopte.

     In poolcoördinaten is de reis vanzelf een boog: de straal krimpt of groeit
     terwijl de hoek meedraait, en dan krult het punt naar binnen in plaats van
     ernaartoe te schuiven.

     Eén keer uitrekenen bij het opbouwen, niet per beeldje — het zijn vaste
     vormen. ── */
  const polar = useMemo(() => {
    const n = count;
    const rr = new Array<number>(n);
    const ra = new Array<number>(n);
    const er = new Array<number>(n);
    const ea = new Array<number>(n);
    for (let i = 0; i < n; i += 1) {
      const rx = clouds.rest[i * 2] - 0.5;
      const ry = clouds.rest[i * 2 + 1] - 0.5;
      const ex = clouds.end[i * 2] - 0.5;
      const ey = clouds.end[i * 2 + 1] - 0.5;
      rr[i] = Math.hypot(rx, ry);
      ra[i] = Math.atan2(ry, rx);
      er[i] = Math.hypot(ex, ey);
      /* De EINDhoek altijd MET DE KLOK MEE vanaf de beginhoek benaderen: het
         verschil wordt naar het bereik 0…2π gebracht, dus de kortste weg
         tegen de klok in bestaat niet meer als optie. Heen krult het punt
         daarmee met de klok mee naar de rozet, en terug loopt hij dezelfde
         boog verder uit in dezelfde richting. */
      /* De KORTSTE weg tussen begin- en eindhoek, dus tussen −π en π.
         Hier stond eerst de gedwongen route met de klok mee (0…2π). Dat gaf
         punten die bijna een volledige omwenteling moesten maken om een paar
         graden op te schuiven — en dat is wat de operator zag: een rozet die
         eindeloos ronddraait voordat er iets van een vorm ontstaat.
         De draaiing zit nu in de losse term hieronder, niet in de route. */
      let d = Math.atan2(ey, ex) - ra[i];
      while (d < -Math.PI) d += TAU;
      while (d > Math.PI) d -= TAU;
      ea[i] = d;
    }
    /* Per punt een eigen afwijking voor het uiteenvallen. Vast bij het
       opbouwen en niet per beeldje: een wolk die elk frame opnieuw dobbelt
       flikkert, een wolk met vaste afwijkingen ademt. */
    const jr = new Float64Array(count);
    const ja = new Float64Array(count);
    for (let i = 0; i < count; i += 1) {
      /* Deterministisch, geen Math.random: dezelfde wolk moet er bij elke
         start hetzelfde uitzien. */
      const h = Math.sin(i * 12.9898) * 43758.5453;
      const u = h - Math.floor(h);
      const h2 = Math.sin(i * 78.233) * 21791.1234;
      const v = h2 - Math.floor(h2);
      jr[i] = 0.25 + u * 1.15;
      ja[i] = (v - 0.5) * 1.5;
    }
    return { rr, ra, er, ea, jr, ja };
  }, [clouds, count]);

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

    /* ── De reis IS de draaiing ──────────────────────────────────────────
       De straal loopt recht van de ene vorm naar de andere; de hoek loopt de
       volle boog MET DE KLOK MEE. Daar bovenop komt de doorlopende draaiing
       van de figuur zelf, zodat de rozet blijft tollen ook wanneer er niets
       morpht.

       Beide tellen OP bij de hoek — er wordt nergens iets afgetrokken, en
       daarom kan geen enkele beweging tegen de klok in gaan, in welke
       richting de adem ook loopt. */
    /* Heen loopt het punt de boog naar zijn eindhoek. Terug loopt het NIET
       diezelfde boog terug — dan zou het tegen de klok in gaan — maar het
       resterende stuk van dezelfde cirkel verder uit, tot het weer bij zijn
       beginhoek is. Heen en terug samen: precies één omwenteling, en beide
       keren met de klok mee. */
    /* ── Recht en vloeiend, met een krul erin ───────────────────────────
       De vorige opzet dwong beide richtingen met de klok mee door de terugweg
       de lange kant van de cirkel te laten nemen. Dat werkte op papier en
       niet in het echt: punten die een paar graden moesten opschuiven legden
       een bijna volledige omwenteling af, en dus zag je een rozet die lang
       ronddraaide voordat er een vorm ontstond.

       Nu neemt elk punt de KORTSTE weg naar zijn eindhoek — dat is de rechte,
       vloeiende overgang waar de operator om vroeg. De draaiing zit in een
       APARTE term die met de reis meegroeit: op de heenweg krult het punt
       daarmee de draaiing in, op de terugweg lost dat weer op. Klein genoeg
       om nergens als terugdraaien te lezen, groot genoeg om te voelen.

       Daar bovenop loopt de doorlopende draaiing van de figuur zelf, die
       altijd vooruit gaat. */
    /* De belcurve van het uiteenvallen: nul bij t = 0 en t = 1, vol in het
       midden. Kwadratisch zodat het uiteenvallen traag inzet en het
       samenkomen beslist eindigt in plaats van uit te doven. */
    const bell = disperse === 0 ? 0 : Math.sin(t * Math.PI) ** 1.6 * disperse;

    const r =
      (polar.rr[i] + (polar.er[i] - polar.rr[i]) * t) * (1 + bell * polar.jr[i]);
    const a =
      polar.ra[i] +
      polar.ea[i] * t +
      SWIRL * t +
      turn.value * TAU +
      bell * polar.ja[i];
    const x = 0.5 + Math.cos(a) * r;
    const y = 0.5 + Math.sin(a) * r;

    /* Dichter opeen wanneer ze de rozet vormen, iets ijler in het gezicht. */
    /* Puntgrootte.

       Zonder `disperse` krimpen de punten met de reis mee (0,25 → 0,17): dat
       hoort bij de Breath-tab, waar de wolk van een dichte rozet naar een
       ijler gezicht gaat. Maar op het welkomstscherm zijn BEIDE uiteinden een
       gezicht, en dan maakt diezelfde krimp de ene kop grover dan de andere —
       precies wat de operator zag op 8 augustus 2026 ("die van de vrouw zijn
       fijner en man groffer"). Eén vaste maat lost dat op: dezelfde korrel
       aan allebei de kanten.

       IJler zolang de wolk uit elkaar staat blijft wel: punten die verder uit
       elkaar liggen mogen kleiner zijn, anders wordt het veld een vlek. */
    const base = disperse === 0 ? 0.25 - t * 0.08 : 0.2;
    const scale = base * (1 - bell * 0.35) * (size / 320);
    val.set(scale, 0, x * size, y * size);
  });

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Atlas image={sprite} sprites={sprites} transforms={transforms} />
    </Canvas>
  );
}
