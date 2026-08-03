/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — HapticOrb (onboarding scherm 1)

   Operator 2026-07-31, met referentiebeeld: "Vervang dat eens door dit en
   animeer het dan mooi met lichtworm."

   De organische lijn is vervangen door de figuur uit dat beeld — een Seed
   of Life met een zware O in het hart:

     BUITENCIRKEL   straal R
     ZES CIRKELS    straal R/2, met hun middelpunt op afstand R/2. Doordat
                    ze alle zes door de oorsprong gaan ontstaat de
                    zesbladige rozet in het midden vanzelf; die hoeft niet
                    apart getekend te worden
     DE SIKKELS     twee zware sikkels over het hart, samen leesbaar als een
                    O. Ze lopen spits toe aan kop en voet en zijn in het
                    midden het dikst. Dit is het enige zware element; het
                    gewichtsverschil met de haarlijnen eromheen is wat de
                    figuur leesbaar houdt

   ── De beweging ───────────────────────────────────────────────────────
   Frontaal, met een trage draaiing met de klok mee (operator 2026-07-31).
   Hier zat eerst een kanteling met precessie in; die drukte de figuur tot
   een ovaal en juist daar verloor ze haar kracht — heilige geometrie leeft
   van symmetrie, en die zie je alleen frontaal.

   De rozet ziet er na elke 60° identiek uit, dus het zijn de sikkels die de
   draaiing zichtbaar maken. Daarnaast loopt de meteoor over de BINNENSTE
   cirkels, niet over de buitenrand: elke ademcyclus één cirkel, dus na zes
   ademhalingen heeft hij de hele rozet gehad. Omdat alle zes cirkels door
   de oorsprong gaan, scheert hij elke ronde dwars door het hart.

   De ringen zelf pulseren op de ademhaling en houden een hoge bodem, zodat
   ze nooit wegvallen; de cirkel die aan de beurt is licht vol op.

   ── Waarom dit goedkoop is ────────────────────────────────────────────
   De vorige vorm werd elk frame opnieuw uitgerekend: honderden punten door
   een 3D-projectie. Deze figuur VERANDERT NIET van vorm — alleen haar
   draaiing en schaal, en dat is één transformatie.

   Dus: de geometrie wordt ÉÉN keer opgebouwd, en per frame gaat er alleen
   een matrix overheen. Wat er nog wél per frame gebeurt zijn vier bogen
   voor de meteoor, en dat zijn vier addArc-aanroepen. Vrijwel gratis.

   Er staat nu ook geen enkele Group met een eigen dekking meer in beeld.
   Zo'n Group dwingt Skia tot een volledige scherm-buffer per stuk; dekking
   op de vorm zelf schaalt alleen de verf en kost niets.

   ── Kleurregel ────────────────────────────────────────────────────────
   Alles wat moet gloeien is een HELDERE kleur op LAGE dekking. Andersom
   ligt tegen zwart zo dicht bij de achtergrond dat je geen licht ziet maar
   grijze waas.
   ───────────────────────────────────────────────────────────────────────── */

import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo } from 'react';
import { buildMandala, SEEDS } from './mandala-geometry';
import { View } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Duur van één ademcyclus. Geëxporteerd zodat tekst en figuur op dezelfde
 *  klok kunnen ademen. */
export const BREATH_CYCLE_MS = 7000;

type Props = {
  size?: number;
  /** Adem van buitenaf, 0 = samengetrokken, 1 = uitgezet. Meegeven wanneer
   *  dit beeld samen met iets anders moet bewegen; zonder dit houdt de figuur
   *  zijn eigen klok aan. */
  breath?: SharedValue<number>;
  /** Draaiing van buitenaf, in omwentelingen. Meegeven wanneer een andere
   *  laag dezelfde figuur tekent en mee moet draaien; zonder dit houdt de
   *  figuur zijn eigen klok aan. */
  spin?: SharedValue<number>;
  /** De meteoor doet er precies één ronde over, zodat beeld en adem
   *  synchroon lopen. */
  breathCycleMs?: number;
  /** Aangeroepen telkens wanneer de meteoor het startpunt passeert — zodat
   *  de parent de telefoon kan laten meetrillen. */
  onPulse?: () => void;
};

const TAU = Math.PI * 2;

/* Lengtes van de bogen waaruit de meteoorstaart bestaat, als fractie van de
   omtrek. Ze eindigen alle vier op dezelfde kop; samen doven ze naar
   achteren uit. Skia kent geen verloop LÁNGS een pad — dit is de manier.
   De laatste is kort: dat is de kop. */
const SPANS = [0.5, 0.3, 0.15, 0.035];

/* Mist rond de figuur. Vaste waarden i.p.v. random, anders verspringt de
   mist bij elke re-render. `spd` is heel zodat de baan naadloos rondloopt. */
const WISPS = [
  { a: 0.4, rr: 1.04, sz: 0.66, spd: 1, f: 2, p: 0.0, op: 0.07 },
  { a: 1.7, rr: 0.84, sz: 0.5, spd: -1, f: 3, p: 1.1, op: 0.05 },
  { a: 2.9, rr: 1.14, sz: 0.74, spd: 1, f: 2, p: 2.4, op: 0.06 },
  { a: 4.1, rr: 0.94, sz: 0.58, spd: 2, f: 4, p: 3.3, op: 0.065 },
];

/* Glas is koel en gedempt; de meteoor is wit. Die twee families gescheiden
   houden is wat de figuur van het licht onderscheidt. */
const C_GLASS = '#1a4a8a';
const C_GLASS_LIT = '#4485d8';
const C_SPEC = '#dceaff';
const C_GLOW = '#5aa0ff';
const C_HOT = '#bcdcff';
const C_CORE = '#eaf4ff';
const C_WHITE = '#ffffff';
const C_MIST = '#78adff';
const C_STAR = '#9ec5ff';
/* De O wordt normaal gemengd i.p.v. additief, dus deze kleur is precies wat
   je ziet — niet iets dat bij de achtergrond wordt opgeteld. */
const C_SOLID = '#3d7fd8';

/* Sterren rondom de figuur (operator 2026-07-31: "de mandala zweeft ook
   door het heelal dus rondom sterachtige dots"). Ze liggen in een ring
   BUITEN de mandala en draaien niet mee — het is de ruimte eromheen, niet
   een onderdeel van de figuur.

   Drie groepen, elk één statisch pad dat maar één keer wordt opgebouwd.
   Alleen de dekking beweegt, en elke groep heeft een eigen ritme zodat je
   nooit alle sterren tegelijk ziet knipperen. Zestig sterren voor de prijs
   van drie tekenopdrachten. */
function makeStarGroups(size: number, cx: number, cy: number) {
  let seed = 0x3b9aca07;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: 3 }, () => {
    const p = Skia.Path.Make();
    for (let i = 0; i < 20; i++) {
      const a = rnd() * TAU;
      /* Wortel-verdeling: anders klonteren ze tegen de binnenrand. Begint
         net buiten de buitencirkel van de figuur. */
      const rr = size * (0.4 + Math.sqrt(rnd()) * 0.26);
      p.addCircle(
        cx + Math.cos(a) * rr,
        cy + Math.sin(a) * rr,
        size * (0.0014 + rnd() * 0.0026),
      );
    }
    return p;
  });
}

/* Eén mistwolkje. Eigen component omdat er hooks in zitten. Dekking staat op
   de vorm en niet op de Group: een Group met eigen dekking dwingt Skia tot
   een volledige scherm-buffer, dekking op de vorm schaalt alleen de verf. */
function Wisp({
  w,
  mt,
  cx,
  cy,
  baseR,
}: {
  w: (typeof WISPS)[number];
  mt: SharedValue<number>;
  cx: number;
  cy: number;
  baseR: number;
}) {
  const transform = useDerivedValue(() => {
    'worklet';
    const k = mt.value * TAU;
    const ang = w.a + k * w.spd;
    const rr = w.rr + 0.07 * Math.sin(k * w.f + w.p);
    return [
      { translateX: cx + Math.cos(ang) * baseR * rr },
      { translateY: cy + Math.sin(ang) * baseR * rr },
      /* Tangentieel aan de figuur en platgedrukt: dat maakt er een sliert
         van i.p.v. een bol. */
      { rotate: ang + Math.PI / 2 },
      { scaleY: 0.4 },
    ];
  });

  const opacity = useDerivedValue(() => {
    'worklet';
    const k = mt.value * TAU;
    return w.op * (0.7 + 0.3 * Math.sin(k * w.f + w.p * 2));
  });

  const r = baseR * w.sz;

  return (
    <Group transform={transform}>
      <Circle cx={0} cy={0} r={r} opacity={opacity}>
        <RadialGradient
          c={vec(0, 0)}
          r={r}
          colors={[C_MIST, C_MIST, '#00000000']}
          positions={[0, 0.18, 1]}
        />
      </Circle>
    </Group>
  );
}

/* Eén cirkel uit de rozet. Het pad is statisch; alleen de dekking beweegt.

   Drie dingen tegelijk (operator 2026-07-31: "de ringen moeten ook pulseren
   maar altijd heel goed zichtbaar blijven"):
     - een hoge bodem, zodat de ring nooit wegvalt
     - een zachte puls op de ademhaling, zodat de hele rozet leeft
     - vol oplichten zolang de meteoor déze cirkel rondgaat

   Dat laatste is een plateau, geen piek: de meteoor doet er een volle
   ademcyclus over, dus de cirkel blijft die hele ronde helder en vervaagt
   alleen aan de randen. Een piek zou midden in de ronde alweer dimmen. */
function Seed({
  path,
  index,
  orbit,
  breath,
  strokeWidth,
}: {
  path: SkPath;
  index: number;
  orbit: SharedValue<number>;
  breath: SharedValue<number>;
  strokeWidth: number;
}) {
  const opacity = useDerivedValue(() => {
    'worklet';
    /* Afstand tot de lopende ronde, kortste weg langs de zes. */
    let d = (((orbit.value - index) % SEEDS) + SEEDS) % SEEDS;
    if (d > SEEDS / 2) d -= SEEDS;
    /* Nul zolang de meteoor op deze cirkel zit (d tussen 0 en 1). */
    const outside = d < 0 ? -d : d > 1 ? d - 1 : 0;
    const k = Math.max(0, 1 - outside / 0.55);
    return 0.42 + breath.value * 0.12 + 0.44 * k;
  });

  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={strokeWidth}
      color={C_GLASS_LIT}
      opacity={opacity}
    />
  );
}

export default function HapticOrb({
  size = 320,
  breath: externalBreath,
  spin: externalSpin,
  breathCycleMs = BREATH_CYCLE_MS,
  onPulse,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const baseR = size * 0.36;
  /* Eén haarlijn voor de hele figuur. Was bijna twee keer zo dik plus een
     aparte zware lijn voor de O; het gewicht van de O zit nu in zijn
     vulling, niet in een dikke rand. Alles hieronder is een veelvoud
     hiervan, zodat de verhoudingen kloppen op elk formaat. */
  const thin = size * 0.0052;

  /* ── De geometrie ──────────────────────────────────────────────────────
     Eén keer opgebouwd, in lokale coördinaten rond de oorsprong. De
     kanteling gaat er per frame als transformatie overheen. ── */
  const geo = useMemo(() => buildMandala(baseR), [baseR]);

  /* `breath` 0→1→0 — de figuur zet uit bij inademen, krimpt bij uitademen.
     Van BUITEN als de aanroeper er een meegeeft (3 augustus 2026). Op het
     welkomstscherm gaat de rozet over in een puntenwolk, en die wolk loopt op
     de ademwaarde van dat scherm. Bleef de rozet ondertussen op zijn eigen
     klok ademen, dan zetten de twee tegen elkaar in: de getekende figuur nog
     aan het uitzetten terwijl de punten al krimpen. Dat is niet als schok te
     zien maar wél te voelen — de beweging klopt niet. Eén waarde voor alles
     wat beweegt is het enige wat dat oplost. */
  const ownBreath = useSharedValue(0);
  const breath = externalBreath ?? ownBreath;
  /* `spin` = richting van de kanteling. Laat de figuur om haar as tollen.
     Ook deze mag van buiten komen, om dezelfde reden als de adem: tekent een
     tweede laag dezelfde figuur, dan moeten ze op één hoek staan. */
  const ownSpin = useSharedValue(0);
  const spin = externalSpin ?? ownSpin;
  /* `orbit` 0→6 = de meteoor legt zes ronden af, één per ademcyclus, elke
     ronde op een volgende cirkel van de rozet. Het gehele deel zegt welke
     cirkel, het cijfer erachter waar op die cirkel. */
  const orbit = useSharedValue(0);
  /* `mist` = eigen, veel tragere klok voor de wolkjes en de sterren. */
  const mist = useSharedValue(0);
  /* `flash` = korte oplichting wanneer de meteoor het startpunt passeert. */
  const flash = useSharedValue(0);

  useEffect(() => {
    /* Alleen de eigen klok opwinden. Krijgt de figuur zijn adem van buiten,
       dan zou dit die waarde overschrijven — en dan stuurt hij zichzelf weer,
       precies wat we willen voorkomen. */
    if (!externalBreath) {
      ownBreath.value = withRepeat(
        withTiming(1, {
          duration: breathCycleMs / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      );
    }
    if (!externalSpin) {
      ownSpin.value = withRepeat(
        withTiming(1, { duration: 20000, easing: Easing.linear }),
        -1,
        false,
      );
    }
    orbit.value = withRepeat(
      withTiming(SEEDS, {
        duration: breathCycleMs * SEEDS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    mist.value = withRepeat(
      withTiming(1, { duration: 46000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [ownBreath, externalBreath, ownSpin, externalSpin, orbit, mist, breathCycleMs]);

  const notify = useCallback(() => {
    onPulse?.();
  }, [onPulse]);

  /* Oplichting én trilling precies wanneer de meteoor omklapt. Dit hing
     eerder aan een setInterval, die na een paar minuten wegdrijft van de
     animatieklok — dan trilt de telefoon op een moment dat er niets
     gebeurt. Nu leest het rechtstreeks de positie van de meteoor, dus beeld
     en haptiek kúnnen niet uit de pas lopen. */
  useAnimatedReaction(
    () => Math.floor(orbit.value),
    (cur, prev) => {
      'worklet';
      if (prev === null || cur === prev) return;
      flash.value = withSequence(
        withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 620, easing: Easing.out(Easing.cubic) }),
      );
      runOnJS(notify)();
    },
  );

  /* Eén keer aan het begin, anders duurt het een volle cyclus voordat de
     bezoeker de eerste puls voelt — en die zit hier maar enkele seconden. */
  useEffect(() => {
    const kick = setTimeout(() => {
      flash.value = withSequence(
        withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 620, easing: Easing.out(Easing.cubic) }),
      );
      notify();
    }, 400);
    return () => clearTimeout(kick);
  }, [flash, notify]);

  /* ── De beweging ───────────────────────────────────────────────────────
     Frontaal, met een trage draaiing met de klok mee. Hier stond eerst een
     kanteling met precessie; die drukte de figuur tot een ovaal en juist
     daar verloor ze haar kracht — heilige geometrie leeft van symmetrie, en
     die zie je alleen frontaal.

     Op het scherm loopt de y-as naar beneden, dus een positieve hoek draait
     met de klok mee.

     De zesvoudige rozet ziet er na elke 60° hetzelfde uit; het is de O die
     de draaiing zichtbaar maakt. ── */
  const figureTransform = useDerivedValue(() => {
    'worklet';
    return [
      { translateX: cx },
      { translateY: cy },
      { rotate: spin.value * TAU },
      /* 17% uitzetten: naast het draaien moet de adembeweging duidelijk
         herkenbaar blijven. */
      { scale: 0.87 + breath.value * 0.17 },
    ];
  });

  /* ── De meteoorstaart ──────────────────────────────────────────────────
     Vier bogen op de cirkel die nú aan de beurt is (operator 2026-07-31:
     "kan er door die binnenste ringen een witte worm lopen en niet rond
     buitenring?"). Elke ademcyclus schuift hij een cirkel op, dus na zes
     ademhalingen heeft hij de hele rozet doorlopen.

     Mooie bijvangst van deze meetkunde: alle zes cirkels gaan door de
     oorsprong, dus de worm scheert elke ronde dwars door het hart van de
     figuur.

     Omdat de cirkels niet vervormen is dit één addArc per boog — geen
     puntenwolk, geen trigonometrie. ── */
  const makeArc = (span: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- vaste volgorde
    useDerivedValue(() => {
      'worklet';
      const p = Skia.Path.Make();
      const lap = Math.floor(orbit.value);
      const idx = lap % SEEDS;
      const t = orbit.value - lap;
      const c = geo.seeds[idx];
      const r = baseR / 2;

      /* Startpunt: de hoek waaronder de OORSPRONG op deze cirkel ligt. Elke
         cirkel van de rozet gaat door het middelpunt van de figuur, dus dit
         punt is voor alle zes hetzelfde. Daardoor eindigt elke ronde precies
         waar de volgende begint en is er geen sprong meer. */
      const start = idx * (360 / SEEDS) + 180;

      /* De staart rolt uit vanaf het hart en trekt zich er weer in terug.
         Zonder dit zou hij bij het begin van een ronde vóór de kop uit
         steken, op een stuk cirkel waar het licht nog niet is geweest. */
      const ease = Math.min(1, Math.min(t, 1 - t) / 0.25);
      const sp = Math.max(0.002, span * ease);

      p.addArc(
        Skia.XYWHRect(c.cx - r, c.cy - r, r * 2, r * 2),
        start + (t - sp) * 360,
        sp * 360,
      );
      return p;
    });

  /* Sterrenveld rondom de figuur. Paden zijn statisch; alleen de dekking
     beweegt, elke groep op een eigen ritme. De factoren 1, 2 en 3 zijn heel,
     zodat het knipperen naadloos doorloopt als de klok omklapt. */
  const starPaths = useMemo(
    () => makeStarGroups(size, cx, cy),
    [size, cx, cy],
  );
  const starOp0 = useDerivedValue(
    () => 0.38 + 0.26 * Math.sin(mist.value * TAU + 0.0),
  );
  const starOp1 = useDerivedValue(
    () => 0.38 + 0.26 * Math.sin(mist.value * TAU * 2 + 1.9),
  );
  const starOp2 = useDerivedValue(
    () => 0.38 + 0.26 * Math.sin(mist.value * TAU * 3 + 4.1),
  );
  const starOps = [starOp0, starOp1, starOp2];

  const arcTail = makeArc(SPANS[0]);
  const arcMid = makeArc(SPANS[1]);
  const arcNear = makeArc(SPANS[2]);
  const arcHead = makeArc(SPANS[3]);

  /* Het glas licht kort mee op wanneer de puls langskomt. */
  const glassOpacity = useDerivedValue(() => 0.5 + flash.value * 0.22);

  /* Lichtbron in het hart. Ademt mee — dit is naast de schaal de tweede,
     duidelijkere aanwijzing dat de figuur ademt. */
  const glowOpacity = useDerivedValue(
    () => 0.07 + breath.value * 0.07 + flash.value * 0.05,
  );
  const coreOpacity = useDerivedValue(
    () => 0.12 + breath.value * 0.14 + flash.value * 0.2,
  );
  const coreR = useDerivedValue(() => baseR * (0.13 + breath.value * 0.05));

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ flex: 1 }}>
        <Group blendMode="plus">
          {/* ── Mist — hangt om de figuur, drijft er traag omheen ── */}
          {WISPS.map((w, i) => (
            <Wisp key={i} w={w} mt={mist} cx={cx} cy={cy} baseR={baseR} />
          ))}

          {/* ── Sterren rondom ── draaien niet mee: dit is de ruimte om de
             figuur heen, geen onderdeel ervan. */}
          {starPaths.map((sp, i) => (
            <Path key={i} path={sp} color={C_STAR} opacity={starOps[i]} />
          ))}

          {/* ── Licht in het hart: brede gloed ── */}
          <Circle cx={cx} cy={cy} r={baseR * 0.8} opacity={glowOpacity}>
            <RadialGradient
              c={vec(cx, cy)}
              r={baseR * 0.8}
              colors={[C_GLOW, C_GLOW, '#00000000']}
              positions={[0, 0.1, 1]}
            />
          </Circle>

          {/* ── De figuur ── alles hieronder staat in lokale coördinaten en
             wordt door één transformatie gekanteld. */}
          <Group transform={figureTransform}>
            {/* Rozet: gloed. Eén geblurde pas over alle zes samen — zes
                aparte geblurde passen zou zes keer zo duur zijn. */}
            <Path
              path={geo.seedsAll}
              style="stroke"
              strokeWidth={thin * 2.2}
              color={C_GLASS}
              opacity={0.26}
            >
              <BlurMask blur={6} style="normal" />
            </Path>

            {/* Rozet: de zes cirkels, elk met een eigen dekking zodat ze
                oplichten wanneer de meteoor langskomt. */}
            {geo.seeds.map((sd, i) => (
              <Seed
                key={i}
                path={sd.path}
                index={i}
                orbit={orbit}
                breath={breath}
                strokeWidth={thin}
              />
            ))}

            {/* Buitencirkel: gloed */}
            <Path
              path={geo.outer}
              style="stroke"
              strokeWidth={thin * 2.4}
              color={C_GLASS}
              opacity={0.34}
            >
              <BlurMask blur={7} style="normal" />
            </Path>

            {/* Buitencirkel: de lijn */}
            <Path
              path={geo.outer}
              style="stroke"
              strokeWidth={thin}
              color={C_GLASS_LIT}
              opacity={0.55}
            />

          </Group>
        </Group>

        {/* ── De O ── buiten de additieve groep. Bij additief mengen telt
            alles bij elkaar op, dus daarbinnen is álles per definitie
            doorschijnend: je ziet de rozet er altijd doorheen. Hier wordt
            normaal gemengd, waardoor de vulling de lijnen erachter écht
            afdekt. De haarlijn eroverheen sluit de cirkel boven en onder,
            waar de vulling tot nul afloopt. */}
        <Group transform={figureTransform}>
          <Path path={geo.oFill} color={C_SOLID} />
          <Path
            path={geo.oRing}
            style="stroke"
            strokeWidth={thin * 1.1}
            color={C_SPEC}
            opacity={glassOpacity}
          />
        </Group>

        <Group blendMode="plus">
          <Group transform={figureTransform}>
            {/* ── De meteoor ── vier bogen op de buitencirkel, van lang en
              zwak naar een compacte felle kop. De gloed is ongeveer zo
              breed als de lijn zelf; wordt die veel breder, dan zit het
              licht niet meer ín het glas maar eromheen. */}
            <Path
              path={arcTail}
              style="stroke"
              strokeWidth={thin * 0.8}
              strokeCap="round"
              color={C_HOT}
              opacity={0.3}
            />
            <Path
              path={arcMid}
              style="stroke"
              strokeWidth={thin}
              strokeCap="round"
              color={C_CORE}
              opacity={0.5}
            />
            <Path
              path={arcNear}
              style="stroke"
              strokeWidth={thin * 2.6}
              strokeCap="round"
              color={C_WHITE}
              opacity={0.2}
            >
              <BlurMask blur={5} style="normal" />
            </Path>
            <Path
              path={arcNear}
              style="stroke"
              strokeWidth={thin * 1.1}
              strokeCap="round"
              color={C_WHITE}
              opacity={0.85}
            />
            <Path
              path={arcHead}
              style="stroke"
              strokeWidth={thin * 4.4}
              strokeCap="round"
              color={C_WHITE}
              opacity={0.3}
            >
              <BlurMask blur={6} style="normal" />
            </Path>
            <Path
              path={arcHead}
              style="stroke"
              strokeWidth={thin * 1.7}
              strokeCap="round"
              color={C_WHITE}
              opacity={1}
            />
          </Group>

          {/* ── Licht in het hart: kern ── buiten de draaiende groep, want
             een gloed heeft geen richting en hoeft dus niet mee te draaien. */}
          <Circle cx={cx} cy={cy} r={coreR} opacity={coreOpacity}>
            <RadialGradient
              c={vec(cx, cy)}
              r={baseR * 0.18}
              colors={[C_SPEC, C_SPEC, '#00000000']}
              positions={[0, 0.08, 1]}
            />
          </Circle>
        </Group>
      </Canvas>
    </View>
  );
}
