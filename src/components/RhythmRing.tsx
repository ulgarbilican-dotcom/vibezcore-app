/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — RhythmRing

   Operator, 19 september 2026 (Apple "Sleep Schedule Ring"-redesign van
   agenda.tsx): de 24 uur van de dag als één cirkel, met een gekleurde
   markering per geplande sessie, i.p.v. een lijst met kaarten. Reageert
   op zowel een tik (opent de sessie) als lang-indrukken + ronddraaien
   (past de tijd van die sessie live aan, magnetisch vastklikkend op de
   dichtstbijzijnde 5 minuten bij loslaten).

   Operator, 19 september 2026 ("waar zijn de kleuren en uren van de
   sessies in de cirkel? Cirkel moet dikker en glaseffect"): elke sessie
   krijgt nu ECHT een gekleurd boogje (SVG-`Path` met een `A`-boog-
   commando, ronde uiteinden) op de ring zelf, niet enkel een klein puntje
   — de vroegere "punten i.p.v. boogjes"-vereenvoudiging is hiermee
   teruggedraaid. De sleep-hitbox blijft wél een los, iets groter puntje
   bovenop het boogje (makkelijker vast te pakken dan een dunne lijn zelf
   aan te raken).

   Operator, 19 september 2026, 2e/3e ronde ("dit werkt duidelijk niet...
   nu begin je te prutsen... kijk naar de foto en maak exact na"): na een
   paar mislukte pogingen (`BlurView` — native module, werkt pas na een
   rebuild; daarna een dikke "glazen band" die niet op de referentie-
   mockup staat) teruggezet naar precies wat de mockup toont: een DUNNE
   ring (geen dikke band, geen gevulde binnenkant), met per sessie een
   kort gekleurd boogje dat EINDIGT op het exacte tijdstip (niet
   gecentreerd erop) en een klein puntje op dat eindpunt, plus een
   zachte, subtiele donkere waas (geen randlijn, geen "kaart"-gevoel)
   achter de middentekst voor leesbaarheid. Geen glas-truc meer nodig —
   de mockup zelf heeft die niet.

   Wiskunde: 0/24u bovenaan, met de klok mee — zelfde conventie als
   Apple's eigen Sleep Schedule-ring (24 boven, 6 rechts, 12 onder,
   18 links). `angleForMinutes` rekent minuten-sinds-middernacht om naar
   een hoek (radialen, 0 = boven, met de klok mee); `pointAt` zet die hoek
   + straal om naar scherm-coördinaten t.o.v. het middelpunt. */

import { BrandFonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
/* Operator, 19 september 2026, 16e ronde ("geen cirkel meer... staat
   muurvast"): de SVG-`ClipPath` + `useAnimatedProps` op een `Rect`
   (vorige poging) bleek op het echte toestel niet betrouwbaar — de clip
   werd niet toegepast (een grote grijze wig stak ver buiten de ring) én
   de `Rect` bewoog niet mee (bleef hangen op zijn beginpositie). Terug
   naar de bewezen RN-techniek van de CTA-shimmer (`overflow:'hidden'`
   + `Animated.View`/`translateX`), MAAR zonder de rotatie van de
   knop-versie — een rotatie-`transform` was net de reden dat een
   eerdere ronde van DEZE zelfde clip niet werkte op Android. Zonder
   rotatie (enkel `translateX`) clipt `overflow:'hidden'` wél correct.
   Het venster is nu ook exact zo groot als de echte, zichtbare ring
   (`RING_R`), niet de hele onzichtbare bounding box. */
import { LinearGradient as ShimmerGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export type RhythmRingItem = {
  /** Stabiele sleutel (bv. `${slot}-${index}`) — niet de tijd zelf, want
   *  die verandert net tijdens het slepen. */
  key: string;
  /** Minuten sinds middernacht. */
  reminderAt: number;
  minutes: number;
  color: string;
  label: string;
};

type Props = {
  size: number;
  items: RhythmRingItem[];
  /** Alleen bij de dag van vandaag is een "Next: ... in X hours"-tekst
   *  zinvol — een andere dag toont gewoon de eerste sessie, zonder
   *  aftellen. */
  isToday: boolean;
  now: Date;
  onTapItem: (key: string) => void;
  onDragEnd: (key: string, newReminderAt: number) => void;
  /** Operator, 22 september 2026 (breath-welcome.tsx se onboarding-
   *  voorproefje: "verander de tijden rond de cirkel naar de state
   *  namen"): standaard `'time'` (agenda.tsx's eigen, ongewijzigde
   *  gedrag — de kloktijd per sessie) — `'name'` toont i.p.v. daarvan
   *  `item.label` (de toestandnaam), voor contexten waar de tijd zelf
   *  geen betekenis heeft (een voorproefje, geen echt dagschema). */
  /** Operator, 23 september 2026 ("namen rond de cirkel weg, kleuren
   *  blijven"): `'none'` toegevoegd — geen tekst naast de stip, de
   *  gekleurde stip zelf blijft gewoon staan/tikbaar. */
  itemLabelMode?: 'time' | 'name' | 'none';
  /** Operator, 22 september 2026 ("text next... allemaal weg in de
   *  cirkel"): de middenzone ("Next"/state/tijd/aftellen) is voor de
   *  onboarding-voorproefje-context overbodig — daar kies je zelf al
   *  WELKE sessie, "Next" belooft dan een tijdstip dat niet klopt met
   *  die keuze. Standaard `true` (agenda.tsx's ongewijzigde gedrag). */
  showCenterInfo?: boolean;
  /** Operator, 23 september 2026 ("de kleur op de cirkel zou moeten
   *  reageren op de klik onderaan"): externe selectie (bv. een tik op de
   *  rij onderaan in breath-welcome.tsx) had geen enkel effect op de
   *  ring — de stip kende enkel zijn EIGEN sleep-state (`isDragging`),
   *  geen van-buitenaf-gekozen item. `selectedKey` laat de aanroeper de
   *  stip dezelfde "actief"-look (groter, witte rand) geven, ongeacht of
   *  je op de ring zelf tikte of op de lijst eronder. Optioneel — zonder
   *  deze prop (agenda.tsx) verandert er niets. */
  selectedKey?: string;
  /** Operator, 2-3 okt 2026 ("staat vaker gekozen, alle tijdstippen tonen
   *  in de cirkel" — agenda.tsx se staat-filter-kaarten): meerdere stips
   *  tegelijk laten pulsen, bv. alle sessies van één gekozen staat op een
   *  dag. Werkt SAMEN met `selectedKey` (beide tellen mee, geen van
   *  tweeën verplicht) — bestaande aanroepers (bracelet-agenda.tsx,
   *  breath-welcome.tsx) gebruiken enkel het enkelvoudige `selectedKey`
   *  en blijven ongewijzigd werken. */
  selectedKeys?: string[];
  /** Operator, 2-3 okt 2026 (agenda.tsx se "tik op een staat-kaart, toon
   *  de tijden in het midden i.p.v. los rond de ring"-redesign): als
   *  gezet (en niet leeg), vervangt dit de standaard "Next"-info in het
   *  midden door deze items — bij één item: staatnaam + tijd, bij
   *  meerdere: staatnaam + een lijstje van alle tijden. `null`/`undefined`
   *  (of leeg) valt terug op het bestaande "Next"-gedrag. */
  centerItems?: RhythmRingItem[] | null;
  /** Operator, 23 september 2026 ("waarom zijn stippen niet meer mooi
   *  rond?"): de gekleurde boogjes (comet-staart terug vanaf elke stip)
   *  gaven op deze kleinere ring een uitgerekte/komeetvorm i.p.v. een
   *  nette ronde stip — vooral zichtbaar bij een felle kleur (groen,
   *  blauw), bijna onzichtbaar bij wit (weinig contrast tegen de grijze
   *  ring), wat het verschil verklaarde. `false` toont enkel de ronde
   *  stip zelf, geen boogje. Standaard `true` (agenda.tsx's ongewijzigde
   *  gedrag). */
  showArcs?: boolean;
  /** Operator, 23 september 2026 ("cirkel moet niet meer ademen en mag op
   *  zijn grootst blijven"): zet de bestaande "ademhaling"-schaalpuls
   *  (`bounce`, 1 → 1.07) stil op zijn MAXIMALE stand i.p.v. te blijven
   *  animeren. Standaard `true` (agenda.tsx's ongewijzigde gedrag). */
  animateBreath?: boolean;
};

const TICKS: { hour: number; label: string }[] = [
  { hour: 0, label: '24' },
  { hour: 6, label: '6' },
  { hour: 12, label: '12' },
  { hour: 18, label: '18' },
];

const angleForMinutes = (mins: number) => ((mins % 1440) / 1440) * Math.PI * 2;

function pointAt(angleRad: number, radius: number) {
  return { x: radius * Math.sin(angleRad), y: -radius * Math.cos(angleRad) };
}

/* Vaste boog-lengte, onafhankelijk van de echte sessieduur — een sessie
   van 5 minuten zou als boog anders onzichtbaar klein zijn op een
   24-uurs cirkel. Op de referentie-mockup EINDIGT elk boogje precies op
   het tijdstip (het puntje zit op de kop, niet in het midden) en loopt
   het boogje terug (tegen de klok in) vanaf daar — dus geen halve-breedte
   aan weerszijden, een volle lengte terugwaarts. */
/* Operator, 19 september 2026, 8e ronde ("kleuren-fade mag iets langer
   op de cirkel"): 32 → 70 "minuten" — de kleur loopt nu over een groter
   stuk van de ring geleidelijk op, in plaats van vrij abrupt vlak voor
   het puntje. */
const ARC_SPAN = (Math.PI * 2) / 1440 * 70; // 70 "minuten" lang, terugwaarts

/** SVG `A`-boogpad die EINDIGT op `angleRad` (waar het puntje komt) en
 *  `ARC_SPAN` terugloopt (tegen de klok in) — t.o.v. middelpunt (0,0), de
 *  aanroeper telt zelf `cx`/`cy` erbij op. */
function arcPath(angleRad: number, r: number, cx: number, cy: number) {
  const p1 = pointAt(angleRad - ARC_SPAN, r);
  const p2 = pointAt(angleRad, r);
  return `M ${cx + p1.x} ${cy + p1.y} A ${r} ${r} 0 0 1 ${cx + p2.x} ${cy + p2.y}`;
}

const fmtHM = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60) % 24, mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

/** Rondt af naar het dichtstbijzijnde 5-minuten-vak — zelfde "magnetisch
 *  vastklikken"-gevoel als de referentie beschrijft. */
const snap5 = (mins: number) => (Math.round(mins / 5) * 5) % 1440;

/* Operator, 19 september 2026, 6e ronde ("uurmelding staan gewoon over
   het scherm verspreid"): de tijd-labels bij elke sessie zitten op
   straal `dotRingRadius + 34`, en de tick-labels op `dotRingRadius + 20`
   — allebei ruim BUITEN de vierkante `size`×`size`-container die deze
   component zelf als root-View gebruikt (`radius` = maar `size / 2`).
   Absoluut gepositioneerde children die buiten hun eigen container
   vallen, worden niet netjes mee-gecentreerd door de buitenste
   `alignItems:'center'`-wrapper in agenda.tsx — die centreert de DOOS,
   niet de overflow — dus leken de labels random over het scherm te
   staan i.p.v. rond de ring. Fix: de root-View krijgt een onzichtbare
   marge (`OUTER_PAD`) zodat alle overflow (ticks, tijd-labels) binnen
   de eigen grenzen blijft; de RING zelf (straal, dikte, proporties)
   verandert hierdoor niet — enkel de bounding box eromheen groeit. */
const OUTER_PAD = 40;

/* Operator, 23 september 2026 ("kleur in de cirkel beweegt"): losse
   component i.p.v. inline in de `.map()` hieronder — hooks (useSharedValue/
   useEffect) mogen niet in een loop staan, en het animeert/stopt vanzelf
   mee met mount/unmount (geselecteerd/niet), geen aparte aan/uit-logica
   nodig. 28×28, gecentreerd op dezelfde plek als de 14×14-stip. */
function PulseRing({ color, style }: { color: string; style: { left: number; top: number } }) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0.9);
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.9, { duration: 1400, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 1400, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [scale, opacity]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.pulseRing, style, { borderColor: color }, animStyle]}
    />
  );
}

export default function RhythmRing({
  size,
  items,
  isToday,
  now,
  onTapItem,
  onDragEnd,
  itemLabelMode = 'time',
  showCenterInfo = true,
  selectedKey,
  selectedKeys,
  centerItems,
  showArcs = true,
  animateBreath = true,
}: Props) {
  const outerSize = size + OUTER_PAD * 2;
  const radius = size / 2;
  const dotRingRadius = radius - 14;
  const cx = outerSize / 2;
  const cy = outerSize / 2;

  /* Operator, 1 okt 2026 ("tikken op het achterste bolletje lukt niet
     omdat ze te dicht opeenstaan, hoe lossen we dat op"): bij sessies die
     amper een paar minuten uit elkaar liggen vallen de bolletjes op deze
     kleine ring letterlijk over elkaar — de bovenste vangt dan elke tik
     op, de onderste is onbereikbaar. Oplossing: bolletjes die binnen
     `CLUSTER_MIN` van elkaar liggen worden een stukje naar binnen/buiten
     verschoven (afwisselend) t.o.v. de ring — de WERKELIJKE tijd/hoek
     blijft exact ongewijzigd (enkel de teken-straal van het bolletje zelf
     wijkt af), dus elk bolletje krijgt zijn eigen, niet-overlappende
     tikgebied. `CLUSTER_STAGGER_PX` is ruim boven de gecombineerde
     hitSlop-tikzone (bolletje ±7-9px + hitSlop 10px) zodat twee
     verschoven bolletjes nooit opnieuw overlappen. */
  const CLUSTER_MIN = 20;
  /* Operator, 1 okt 2026 ("nog altijd dicht op elkaar, oog rommelig"):
     18→30px — duidelijk zichtbare afstand tussen geclusterde bolletjes
     i.p.v. een net-niet-overlappende marge. */
  const CLUSTER_STAGGER_PX = 30;
  const clusterRadiusOffset = useMemo(() => {
    const offsets: Record<string, number> = {};
    const sorted = [...items].sort((a, b) => a.reminderAt - b.reminderAt);
    let clusterStart = 0;
    for (let i = 1; i <= sorted.length; i += 1) {
      const atEnd =
        i === sorted.length ||
        sorted[i].reminderAt - sorted[i - 1].reminderAt > CLUSTER_MIN;
      if (atEnd) {
        const cluster = sorted.slice(clusterStart, i);
        if (cluster.length > 1) {
          const mid = (cluster.length - 1) / 2;
          cluster.forEach((it, idx) => {
            offsets[it.key] = (idx - mid) * CLUSTER_STAGGER_PX;
          });
        }
        clusterStart = i;
      }
    }
    return offsets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  /* Operator, 19 september 2026, 6e ronde ("kijk belachelijk dit"): de
     eerdere "ademende gloed" was een vlak-gevulde, ondoorzichtige
     cirkel achter de middentekst — dát was de harde "binnenring niet
     transparant"-klacht, niet de zachte SVG-vignet (die al wél naar
     volledig doorzichtig uitloopt, zie de `RadialGradient` hierboven).
     Weggehaald i.p.v. verder te verzachten: een vlakke kleur op een
     cirkel heeft altijd een zichtbare rand, ongeacht de dekking. */

  /* Operator, 19 september 2026, 18e ronde: `RING_R` is de straal van de
     ring ZELF (net buiten zijn eigen dikte), niet de hele onzichtbare
     bounding box — het clip-venster en de strook gebruiken deze maat,
     dus geen overschot meer naar de marge met de tijd-labels. Zelfde
     2600/1100/1200ms-cadans als de CTA-shimmer; bij progress 0 staat de
     strook volledig links van het venster, bij 1 volledig rechts erván. */
  const RING_R = dotRingRadius + 8;
  const SHIMMER_BAR_W = RING_R * 1.7;
  /* Operator, 19 september 2026, 19e ronde ("van linksonder naar
     rechtsboven" geprobeerd, daarna "klopt helemaal niet, draai maar
     terug"): de diagonale versie (extra `translateY`) is teruggedraaid
     — terug naar de rechte links→rechts-sweep die hiervoor al bevestigd
     goed was ("veel beter, maak shimmer breder"). */
  /* Operator, 24 september 2026 ("shimmer mag iets meer tussentijd"):
     2600/1200 → 3400/1800 — meer rust tussen de sweeps, zelfde 1100ms
     sweep zelf (die was al bevestigd goed). */
  const shimmerProgress = useSharedValue(0);
  useEffect(() => {
    shimmerProgress.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(3400, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })),
        withDelay(1800, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -SHIMMER_BAR_W + shimmerProgress.value * (RING_R * 2 + SHIMMER_BAR_W) },
    ],
  }));

  /* Operator, 19 september 2026, 16e ronde ("laat de cirkel ook lichtjes
     bouncen"): trage, zachte schaal-ademhaling (2.4s per fase, net als de
     bestaande ademhalings-animaties elders in de app) — subtiel genoeg
     (1 → 1.018) om als "leeft" te voelen zonder de sessie-tijden zelf
     onleesbaar te laten trillen. */
  /* Operator, 19 september 2026, 20e ronde ("rustig maar constanter en
     duidelijker"): trager per fase (2.4s → 3.2s, kalmer) maar met een
     duidelijk grotere uitslag (0.018 → 0.035) zodat 'm merkbaar blijft
     zonder gejaagd te ogen — `withRepeat(..., -1, true)` (het
     ingebouwde "reverse"-mechanisme i.p.v. een eigen heen-en-weer-
     `withSequence`) geeft bovendien een wiskundig perfect gelijkmatige
     op-en-neer-cyclus, geen twee losse getimede stappen die licht uit
     de pas kunnen lopen. */
  const bounce = useSharedValue(animateBreath ? 0 : 1);
  useEffect(() => {
    if (!animateBreath) return;
    bounce.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateBreath]);
  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + bounce.value * 0.07 }],
  }));

  /* Absolute schermpositie van het middelpunt — nodig om de vinger-
     coördinaten uit PanResponder (die ALTIJD scherm-absoluut zijn) om te
     zetten naar een hoek t.o.v. het middelpunt. Gevuld via `onLayout` +
     `measureInWindow` op de container hieronder. */
  const containerRef = useRef<View>(null);
  const centerPage = useRef({ x: 0, y: 0 });
  const measureCenter = () => {
    containerRef.current?.measureInWindow((x, y) => {
      centerPage.current = { x: x + cx, y: y + cy };
    });
  };

  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [previewMinutes, setPreviewMinutes] = useState<number | null>(null);
  /* Operator, 4 okt 2026 (drag-snap-haptic hieronder): top-level hook i.p.v.
     in de `.map()`-loop bij `PanResponder.create` zelf — hooks mogen niet
     in een loop staan (zie de toelichting bij `clusterRadiusOffset`
     hierboven). Een gewone closure-variabele zou dit ook niet overleven:
     `setPreviewMinutes` laat `RhythmRing` bij ELKE move-event opnieuw
     renderen, wat een nieuwe `PanResponder`/closure per item aanmaakt —
     een lokale variabele zou dan elke keer terugvallen op zijn
     startwaarde. Eén gedeelde ref (net als `draggingKey`/`previewMinutes`
     hierboven kan er toch maar één tegelijk slepen). */
  const lastSnapRef = useRef<number | null>(null);
  /* Throttle, 4 okt 2026 (niet gebouwd op een vermoeden, maar op de
     mechanica: snel ronddraaien kan meerdere 5-min-stappen binnen
     enkele milliseconden passeren, en een trage ERM-motor — gangbaar
     op budget-Android — kan opeenvolgende korte pulsen niet "afmaken"
     voor de volgende binnenkomt, wat als één zompige trilling aanvoelt
     i.p.v. losse tikken). Alleen de haptic-puls wordt overgeslagen bij
     te snelle opvolging; `lastSnapRef`/`previewMinutes` blijven elke
     move-event bijwerken, dus de ring zelf blijft 1:1 met de vinger. */
  const lastHapticAtRef = useRef<number>(0);
  const MIN_HAPTIC_INTERVAL_MS = 70;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  /* "Next" — de eerstvolgende sessie vanaf nu, met wrap-around naar
     morgen als alles vandaag al voorbij is (het protocol herhaalt zich
     toch identiek elke dag, dus "morgen 07:00" is een geldig "next"). */
  const nextItem = useMemo(() => {
    if (items.length === 0) return null;
    const sorted = [...items].sort((a, b) => a.reminderAt - b.reminderAt);
    const upcoming = sorted.find((it) => it.reminderAt >= nowMinutes);
    return upcoming ?? sorted[0];
  }, [items, nowMinutes]);

  const minutesUntilNext = useMemo(() => {
    if (!nextItem) return 0;
    const diff = nextItem.reminderAt - nowMinutes;
    return diff >= 0 ? diff : diff + 1440;
  }, [nextItem, nowMinutes]);

  const countdownTxt = useMemo(() => {
    if (minutesUntilNext < 1) return 'now';
    const h = Math.floor(minutesUntilNext / 60);
    const m = minutesUntilNext % 60;
    if (h === 0) return `in ${m} min`;
    if (m === 0) return `in ${h} hour${h === 1 ? '' : 's'}`;
    return `in ${h}h ${m}m`;
  }, [minutesUntilNext]);

  return (
    <View
      ref={containerRef}
      style={{ width: outerSize, height: outerSize }}
      onLayout={measureCenter}
    >
    {/* Operator, 19 september 2026, 16e ronde ("laat de cirkel ook
       lichtjes bouncen"): een zachte, continue schaal-puls op de HELE
       ring — een gewone, oneindige `withRepeat` is hier wél veilig (in
       tegenstelling tot de eerdere zwart-scherm-crash op plan-success.tsx)
       want er is hier geen native dialoog of scherm-overgang die er
       gelijktijdig mee start; dit is een rustig idle-effect terwijl het
       scherm al klaar staat. De buitenste `View` (met `containerRef`)
       blijft zelf ongeanimeerd, want die dient voor de `measureInWindow`-
       positie t.b.v. het sleep-gebaar — enkel deze BINNENSTE laag
       schaalt. */}
    <Animated.View style={bounceStyle}>
      {/* Operator, 19 september 2026 ("enkel ring moet transparant,
         binnenkant niet — nu begin je te prutsen" → "kijk naar de foto en
         maak exact na"): geen bordered "kaart"-vulling meer over de
         binnenkant (eerst BlurView, toen een rgba-laag met rand) — de
         mockup toont enkel een héél zachte, randloze donkere waas achter
         de middentekst (een vignet, geen paneel). Een `RadialGradient`
         (van zwart in het midden naar volledig doorzichtig) benadert dat
         precies, zonder ergens een harde rand te tonen. */}
      <Svg width={outerSize} height={outerSize} viewBox={`0 0 ${outerSize} ${outerSize}`}>
        <Defs>
          <RadialGradient id="centerVignette" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
          {/* Operator, 19 september 2026, 7e ronde ("cirkel dikker en
             glaseffect"): een glazen band krijgt geen platte kleur maar
             een diagonale glans — lichter bovenaan-links (waar licht op
             glas zou vallen), doffer onderaan-rechts. `objectBoundingBox`
             (het SVG-default) volstaat hier, want dit is geen boog met
             een eigen richting zoals de sessie-gradiënten, gewoon een
             vaste diagonaal over de volledige ring-cirkel. */}
          <LinearGradient id="ringGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.5} />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0.28} />
          </LinearGradient>
          {/* Operator, 19 september 2026 ("kleuren moeten lijken alsof de
             cirkel zelf overloopt in die kleur, soort gradiënt, geen
             pilvorm"): één lineaire gradiënt per sessie, op de ring-
             richting zelf (`userSpaceOnUse`, x1/y1→x2/y2 = het boogje se
             eigen start-/eindpunt) — transparant aan het begin, volle
             kleur aan het eind (waar het puntje zit). Zo "vloeit" de
             grijze ring geleidelijk over in de kleur i.p.v. een vlak
             gekleurd blokje met ronde uiteinden (een pil) erbovenop te
             plakken. */}
          {showArcs && items.map((it) => {
            const isDragging = draggingKey === it.key;
            const liveMinutes = isDragging && previewMinutes !== null ? previewMinutes : it.reminderAt;
            const angle = angleForMinutes(liveMinutes);
            const from = pointAt(angle - ARC_SPAN, dotRingRadius);
            const to = pointAt(angle, dotRingRadius);
            return (
              <LinearGradient
                key={it.key}
                id={`arc-grad-${it.key}`}
                gradientUnits="userSpaceOnUse"
                x1={cx + from.x}
                y1={cy + from.y}
                x2={cx + to.x}
                y2={cy + to.y}
              >
                <Stop offset="0" stopColor={it.color} stopOpacity={0} />
                <Stop offset="1" stopColor={it.color} stopOpacity={1} />
              </LinearGradient>
            );
          })}
        </Defs>
        {/* Operator, 19 september 2026, 5e ronde ("binnenring moet ook
           transparant"): de vignet-waas achter de middentekst dekte
           bijna de hele binnenkant af — op de mockup blijft de foto er
           gewoon doorheen zichtbaar, enkel een héél lichte donkere waas
           vlak achter de tekst zelf. Straal en dekking allebei fors
           verkleind. */}
        <Circle cx={cx} cy={cy} r={dotRingRadius * 0.5} fill="url(#centerVignette)" />
        {/* Operator, 19 september 2026, 7e ronde ("cirkel dikker en
           glaseffect" — vervangt de vorige "dunne ring exact als de
           mockup"-beslissing): dikkere band, glans-gradiënt i.p.v.
           platte grijze kleur. */}
        <Circle
          cx={cx}
          cy={cy}
          r={dotRingRadius}
          stroke="url(#ringGlass)"
          strokeWidth={9}
          fill="none"
        />
        {/* Operator, 19 september 2026, 7e ronde ("doe die strepen op de
           cirkel weg, lijnen en strepen dienen om tijdslots aan te
           geven"): de 24 generieke uur-streepjes gaven GEEN tijdslot
           aan (gewoon elk uur) — weggehaald. Elke sessie markeert zijn
           eigen tijdslot al met zijn gekleurde boogje + stip, dat is nu
           de enige "streep" op de ring. */}
        {/* Elk boogje eindigt op het exacte tijdstip (puntje op de kop) —
           kleur komt nu uit de bijhorende gradiënt hierboven, geen platte
           kleur meer. */}
        {showArcs && items.map((it) => {
          const isDragging = draggingKey === it.key;
          const liveMinutes = isDragging && previewMinutes !== null ? previewMinutes : it.reminderAt;
          return (
            <Path
              key={it.key}
              d={arcPath(angleForMinutes(liveMinutes), dotRingRadius, cx, cy)}
              stroke={`url(#arc-grad-${it.key})`}
              strokeWidth={isDragging ? 11 : 9}
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
        {/* Huidige-tijd-markering — een kort streepje op de ring, zodat
           "waar sta ik nu op de klok" ook zonder de middentekst duidelijk
           is. Enkel op de dag van vandaag zinvol. */}
        {isToday && (() => {
          const a = angleForMinutes(nowMinutes);
          const p1 = pointAt(a, dotRingRadius - 6);
          const p2 = pointAt(a, dotRingRadius + 6);
          return (
            <Line
              x1={cx + p1.x}
              y1={cy + p1.y}
              x2={cx + p2.x}
              y2={cy + p2.y}
              stroke="#ffffff"
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })()}
      </Svg>

      {/* Operator, 19 september 2026, 18e ronde ("van links naar rechts,
         binnenkant van de cirkel"): rond geknipt venster, exact ter
         grootte van de echte ring (`RING_R`, niet de hele bounding box)
         — `overflow:'hidden'` clipt hier wél betrouwbaar, want de
         strook erin heeft GEEN rotatie (enkel `translateX`), en dat
         onderscheid (rotatie wel/niet) bleek de knop tussen "werkt niet"
         en "werkt wel" op dit toestel. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: cx - RING_R,
          top: cy - RING_R,
          width: RING_R * 2,
          height: RING_R * 2,
          borderRadius: RING_R,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: 0, bottom: 0, width: SHIMMER_BAR_W }, shimmerStyle]}
        >
          <ShimmerGradient
            colors={['#ffffff00', '#ffffff8a', '#ffffff00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      {/* Tick-labels (24/6/12/18) — buiten de ring, zelfde 24u-conventie
         als Apple's Sleep Schedule-ring. */}
      {TICKS.map((t) => {
        const p = pointAt(angleForMinutes(t.hour * 60), dotRingRadius + 20);
        return (
          <Text
            key={t.hour}
            style={[
              s.tick,
              { left: cx + p.x - 10, top: cy + p.y - 7 },
            ]}
          >
            {t.label}
          </Text>
        );
      })}

      {/* Middenzone — Operator, 2-3 okt 2026 ("tik op kaart, toon tijden in
         het midden i.p.v. los rond de ring — bij meerdere sessies van
         dezelfde staat alle tijdstippen tonen"): `centerItems` (gezet
         vanuit agenda.tsx se staat-filter) vervangt hier de standaard
         "Next"-info met de tijden van de GEKOZEN staat — één tijd bij één
         sessie, een lijstje bij meerdere. Niet gezet (of leeg) → gewoon
         het bestaande "Next: state om tijd, over X"-gedrag, ongewijzigd.
         Overslaan wanneer `showCenterInfo` false is. */}
      {showCenterInfo && (
      <View style={[s.center, { width: outerSize * 0.6, left: (outerSize - outerSize * 0.6) / 2 }]} pointerEvents="none">
        {centerItems ? (
          centerItems.length > 0 ? (
            <>
              <Text style={s.centerLabel}>{centerItems[0].label}</Text>
              {/* Operator, 2-3 okt 2026 ("meer info nodig in de bol, alle
                 instellingen weergeven"): enkel de tijd tonen liet de duur
                 weg — de oude `RingLabel` toonde altijd allebei samen
                 ("19:00 · 15 min"). Hier hersteld, nu gebundeld per
                 sessie i.p.v. los op de ring. */}
              {[...centerItems]
                .sort((a, b) => a.reminderAt - b.reminderAt)
                .map((it) => (
                  <Text key={it.key} style={s.centerTime}>
                    {fmtHM(it.reminderAt)} · {it.minutes} min
                  </Text>
                ))}
            </>
          ) : (
            <Text style={s.centerLabel}>Nothing planned</Text>
          )
        ) : nextItem ? (
          <>
            <Text style={s.centerLabel}>{isToday ? 'Next' : 'First today'}</Text>
            <Text style={s.centerState} numberOfLines={1}>
              {nextItem.label}
            </Text>
            <Text style={s.centerTime}>
              {fmtHM(draggingKey === nextItem.key && previewMinutes !== null ? previewMinutes : nextItem.reminderAt)}
            </Text>
            {isToday && <Text style={s.centerCountdown}>{countdownTxt}</Text>}
          </>
        ) : (
          <Text style={s.centerLabel}>Nothing planned</Text>
        )}
      </View>
      )}

      {/* Eén gekleurde markering per sessie, gepositioneerd op de ring.
         Elke markering is zijn EIGEN PanResponder-drager i.p.v. één
         responder over de hele ring die moet uitzoeken welk boogje
         gepakt is — eenvoudiger en een betrouwbaardere hitbox. */}
      {items.map((it) => {
        const isDragging = draggingKey === it.key;
        const isSelected =
          (selectedKey !== undefined && selectedKey === it.key) ||
          (selectedKeys?.includes(it.key) ?? false);
        const liveMinutes = isDragging && previewMinutes !== null ? previewMinutes : it.reminderAt;
        /* Clustering-offset (zie toelichting hierboven) valt weg zodra je
           sleept — tijdens het slepen wil je de echte ringstraal, geen
           verschoven positie die met de vinger meeloopt. */
        const radiusOffset = isDragging ? 0 : (clusterRadiusOffset[it.key] ?? 0);
        const p = pointAt(angleForMinutes(liveMinutes), dotRingRadius + radiusOffset);
        const labelP = pointAt(angleForMinutes(liveMinutes), dotRingRadius + radiusOffset + 34);

        const responder = PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            lastSnapRef.current = it.reminderAt;
            setDraggingKey(it.key);
            setPreviewMinutes(it.reminderAt);
          },
          onPanResponderMove: (_evt, gesture) => {
            const dx = gesture.moveX - centerPage.current.x;
            const dy = gesture.moveY - centerPage.current.y;
            /* Onze conventie is x=sin(hoek), y=-cos(hoek) — de inverse
               daarvan is atan2(dx, -dy), genormaliseerd naar [0, 2π). */
            let angle = Math.atan2(dx, -dy);
            if (angle < 0) angle += Math.PI * 2;
            const mins = snap5(Math.round((angle / (Math.PI * 2)) * 1440));
            /* Operator, 4 okt 2026 (gedeelde haptics-blueprint, drag-and-
               drop-sectie: "bij het passeren van een zone — selectionAsync,
               licht, puur een tik per stap"): ontbrak hier — grab (Medium)
               en release (Light) stonden er al, maar tijdens het slepen
               zelf was er geen enkele terugkoppeling per 5-minuten-stap.
               Een `ref` i.p.v. de vorige `prev`-check in de functionele
               setter: Haptics mag niet IN een React-state-updater draaien
               (kan in bepaalde gevallen dubbel aangeroepen worden), een
               losse synchrone vergelijking vooraf is hier betrouwbaarder. */
            if (lastSnapRef.current !== mins) {
              lastSnapRef.current = mins;
              const now = Date.now();
              if (now - lastHapticAtRef.current >= MIN_HAPTIC_INTERVAL_MS) {
                lastHapticAtRef.current = now;
                Haptics.selectionAsync();
              }
            }
            setPreviewMinutes(mins);
          },
          onPanResponderRelease: () => {
            const finalMinutes = previewMinutes ?? it.reminderAt;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setDraggingKey(null);
            setPreviewMinutes(null);
            if (finalMinutes !== it.reminderAt) onDragEnd(it.key, finalMinutes);
          },
          onPanResponderTerminate: () => {
            setDraggingKey(null);
            setPreviewMinutes(null);
          },
        });

        return (
          <View key={it.key} style={s.itemLayer} pointerEvents="box-none">
            {/* Operator, 23 september 2026 ("kan de kleur in de cirkel
               bewegen ipv enkel statisch groter?"): een continu
               pulserende ring in de eigen kleur van de state, gemount
               (dus meteen animerend) zolang deze stip geselecteerd is —
               verdwijnt/verschijnt vanzelf mee met een nieuwe selectie,
               of dat nu een tik op de ring zelf is of op de rij eronder
               (`selectedKey`). */}
            {isSelected && (
              <PulseRing
                color={it.color}
                style={{ left: cx + p.x - 14, top: cy + p.y - 14 }}
              />
            )}
            <Pressable
              {...responder.panHandlers}
              onPress={() => onTapItem(it.key)}
              hitSlop={10}
              style={[
                s.dot,
                {
                  /* Operator, 23 september 2026 ("pulse is goed maar hoeft
                     geen witte cirkel rond"): de stip zelf reageert weer
                     enkel op ECHT slepen (`isDragging`), niet meer op
                     `isSelected` — de pulserende ring hierboven draagt de
                     selectie al, de stip hoeft dat niet nog eens te doen. */
                  left: cx + p.x - (isDragging ? 9 : 7),
                  top: cy + p.y - (isDragging ? 9 : 7),
                  width: isDragging ? 18 : 14,
                  height: isDragging ? 18 : 14,
                  borderRadius: isDragging ? 9 : 7,
                  backgroundColor: it.color,
                  borderColor: isDragging ? '#ffffff' : 'rgba(0,0,0,0.3)',
                },
              ]}
            />
            {itemLabelMode !== 'none' && (
              <Text
                pointerEvents="none"
                style={[
                  s.dotLabel,
                  { left: cx + labelP.x - 24, top: cy + labelP.y - 7, color: isDragging ? '#ffffff' : it.color },
                ]}
              >
                {itemLabelMode === 'name' ? it.label : fmtHM(liveMinutes)}
              </Text>
            )}
          </View>
        );
      })}
    </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  tick: {
    position: 'absolute',
    width: 20,
    textAlign: 'center',
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  /* Operator, 19 september 2026, 6e ronde: elk item stond in een
     ongepositioneerde `View` — die viel terug op de normale document-
     flow van React Native i.p.v. gekoppeld te blijven aan het
     middelpunt van de ring, vandaar de "tijd-labels staan verspreid
     over het scherm"-bug. Deze laag dekt exact de hele ringcontainer
     (`...StyleSheet.absoluteFillObject`) zodat `left`/`top` van de
     Pressable/Text erin altijd relatief zijn t.o.v. hetzelfde
     middelpunt (`cx`/`cy`) als de SVG. `box-none` laat de laag zelf
     geen aanrakingen opvangen — enkel de Pressable/Text binnenin. */
  itemLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    position: 'absolute',
    top: '38%',
    alignItems: 'center',
  },
  centerLabel: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.45)',
  },
  /* Operator, 19 september 2026 ("Sharp Focus niet bold" → vervolg:
     "kleiner, niet bold"): extrabold → regular, 22 → 19. */
  centerState: {
    marginTop: 4,
    fontFamily: BrandFonts.regular,
    fontSize: 19,
    color: '#ffffff',
    textAlign: 'center',
  },
  centerTime: {
    marginTop: 4,
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  centerCountdown: {
    marginTop: 6,
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.4)',
  },
  dot: {
    position: 'absolute',
    borderWidth: 2,
  },
  /* Operator, 23 september 2026: pulserende selectie-ring — 28×28,
     gecentreerd op dezelfde plek als de 14×14-stip (dus 7px marge rondom
     bij scale 1, groeit daarna naar buiten toe uit). */
  pulseRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  dotLabel: {
    position: 'absolute',
    width: 48,
    textAlign: 'center',
    fontFamily: BrandFonts.bold,
    fontSize: 12,
  },
});
