/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Sessiescherm (CALM · Lotus)

   Namen, teksten en kleur volgens de operator, 1 augustus 2026; de
   modusnamen op 2 augustus gelijkgetrokken met de keuzepagina:

     BOOST         Radiating Sun    Amber / goud
     FOCUS         Flower of Life   Electric blue
     CALM CONTROL  Lotus            Violet          ← dit scherm
     CLARITY       Crystal          Wit
     REST & RESET  Tree of Life     Groen

   "Crystal Grid" verving "Hexagonal Grid" — dat laatste klonk als een
   wiskundeterm en niet als een toestand.

   Vier dingen die deze versie anders doet dan de vorige:

     GEEN VOICE/HAPTICS VOORAF
       Die stonden op de startpagina terwijl er nog niets liep. Ze horen
       bij het luisteren, niet bij het kiezen. Op de startpagina staat nu
       het ademritme zelf — inclusief door welke opening je ademt, want dat
       was nergens af te lezen

     GEEN BRACELET TIJDENS DE SESSIE
       Wie ademt moet niet naar een product kijken. De kaart staat alleen
       vooraf

     DUUR MET UITLEG
       Elke lengte heeft een naam en een reden. Tikken op een keuze
       selecteert hem; tikken op de gekozen keuze opent waarom die lengte
       bestaat. Geen enkele duur is "de juiste" — dat staat er ook

     ADEMRITME ZICHTBAAR
       Vier fasen naast elkaar met hun seconden en hun opening. Tijdens de
       sessie licht de fase op waar je in zit

   Rondes zijn leidend, minuten zijn het label: een cyclus van zestien
   seconden past niet in zestig, dus alleen twintig minuten landt precies.
   Daarom staat de exacte tijd erbij.
   ───────────────────────────────────────────────────────────────────────── */

import SessionArt, { prefetchSessionArt } from '@/components/SessionArt';
import Starfield from '@/components/Starfield';
import { Brand, BrandFonts } from '@/constants/theme';
import {
  BREATH_STATES,
  cycleSeconds,
  roundsFor,
  nextPhase,
  phaseAt,
  type BreathState,
  type BreathStateKey,
  type PhaseKey,
  patternOf,
} from '@/data/breath-states';
import { useSubscription } from '@/hooks/useSubscription';
import { useIAP } from '@/hooks/useIAP';
import { PRICING } from '@/app/(tabs)/bracelet';
import { useKeepAwake } from 'expo-keep-awake';
import { playPhaseHaptic } from '@/services/breath-haptics';
import { addBreathSession } from '@/utils/breath-history';
import { useSetting } from '@/utils/settings';
import { skipBreathIntroOnce } from '@/utils/breath-entry';
import {
  GROUP_ORDER,
  GROUP_TINT,
  SOUNDSCAPES,
  soundscapeByKey,
} from '@/data/soundscapes';
import {
  playScape,
  setScapeLevel,
  stopScape,
  type ScapeLevel,
} from '@/services/soundscape';
import {
  claimVoiceSource,
  playBreathCue,
  playCompletionCue,
  releaseVoiceSource,
  setVoiceEnabled,
  stopVoice,
  type BreathKey,
} from '@/services/breath-voice';
import {
  BlurMask,
  Canvas,
  Circle,
  LinearGradient,
  Path,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Settings,
  Smartphone,
  Volume2,
  VolumeX,
  Watch,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const SCREEN_W = Dimensions.get('window').width;

/* De kleur van een toestand als losse getallen, zodat een worklet ermee kan
   rekenen. Reanimated draait op de UI-draad en kan daar geen hex omzetten. */
function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n =
    h.length === 3
      ? h.split('').map((c) => parseInt(c + c, 16))
      : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return [n[0], n[1], n[2]];
}

/* Vaste maten van het uitlegvlak. Los van makeStyles, want die hangt aan de
   toestand en hier komen de kleuren uit de animatie. */
const staticStyles = StyleSheet.create({
  /* Ook zonder rand — zie de toelichting bij `patternCard`. De kleur van de
     toestand zit al in de achtergrond, en dat is genoeg om te tonen dat deze
     tekst bij de keuze erboven hoort. */
  explainWrap: {
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
});

/* ── De uitleg onder het ritme ───────────────────────────────────────────
   Wie op "Power 5-3" tikt ziet de tekst eronder veranderen, maar niet DAT hij
   verandert — het is grijze tekst op zwart, twintig punten onder je vinger
   (operator, 7 augustus 2026).

   Eerst probeerde ik een kort oplichten. Te vlak: "het beweegt een beetje en
   dat is het". Wat ontbrak is DIEPTE — het gevoel dat de tekst van het scherm
   loskomt en naar je toe schuift.

   Drie dingen tegelijk, en juist de combinatie maakt het:
   · hij begint kleiner en verder weg (0.9) en veert naar zijn plek, met een
     lichte doorschieter voorbij 1 — dat doorschieten IS het naar-voren-komen;
     een beweging die netjes op 1 stopt leest als schuiven, niet als komen;
   · het vlak eronder kleurt op in de toestandskleur en zakt terug naar een
     rustige verhoging, zodat de tekst ook daarna niet meer plat op de pagina
     ligt maar op iets staat;
   · de tekst zelf wordt witter op het hoogtepunt, want dat is wat je leest.

   Bij het openen van het scherm gebeurt er niets: dan heb je niets aangetikt
   en hoort er dus ook niets te bewegen. */
function TechniqueExplain({
  text,
  accent,
  step,
  style,
}: {
  text: string;
  accent: string;
  /** Verandert bij elke keuze; dat is het startsein. */
  step: number;
  style: object;
}) {
  const flash = useSharedValue(0);
  const enter = useSharedValue(1);
  const first = useRef(true);
  const [r, g, b] = useMemo(() => rgbOf(accent), [accent]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    enter.value = 0;
    /* Een veer en geen tijdlijn. Een veer heeft massa, en dat is precies het
       verschil tussen "iets verschuift" en "iets komt naar voren". */
    enter.value = withSpring(1, {
      damping: 11,
      stiffness: 170,
      mass: 0.75,
      overshootClamping: false,
    });
    flash.value = withSequence(
      withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 340 }),
      withTiming(0, { duration: 820, easing: Easing.inOut(Easing.quad) }),
    );
  }, [step, enter, flash]);

  const wrap = useAnimatedStyle(() => {
    const f = flash.value;
    /* Van een rustige verhoging (wit, nauwelijks zichtbaar) naar de kleur van
       de toestand. Handmatig mengen: een worklet kent geen kleurnamen. */
    const mix = (base: number) => Math.round(255 + (base - 255) * f);
    return {
      backgroundColor: `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${0.05 + 0.17 * f})`,
      borderColor: `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${0.1 + 0.7 * f})`,
      transform: [
        { translateY: (1 - enter.value) * 18 },
        { scale: 0.9 + enter.value * 0.1 },
      ],
      opacity: 0.45 + Math.min(1, enter.value) * 0.55,
    };
  });

  const txt = useAnimatedStyle(() => ({
    color: `rgba(255, 255, 255, ${0.58 + 0.4 * flash.value})`,
  }));

  return (
    <Animated.View style={[staticStyles.explainWrap, wrap]}>
      <Animated.Text style={[style, txt]}>{text}</Animated.Text>
    </Animated.View>
  );
}
const SCREEN_H = Dimensions.get('window').height;

/* Het BEELD is breder dan het scherm. De aangeleverde PNG's hebben een
   royale lege rand — bij de lotus vult de bloem maar zo'n tweederde van de
   breedte en veertig procent van de hoogte. Door het beeld ruim over de
   schermbreedte heen te schalen en het zichtbare vlak eromheen smal te
   houden, vult het ONDERWERP het scherm in plaats van de rand.
   Tijdens de sessie mag hij groter: de titeltekst is dan weg. */
/* Vooraf kleiner dan tijdens de sessie: daar staan nog de duurkeuze,
   het ritmeblok en de bracelet-kaart onder. */
const ART_IDLE = SCREEN_W * 0.8;
const ART_RUN = SCREEN_W * 0.98;

/* VASTE hoogte van het beeldvak, gelijk voor alle vijf de toestanden.
   Hing die aan de beeldbreedte, dan verschoof alles eronder zodra een
   illustratie groter of kleiner stond — en dan staat geen enkele pagina op
   dezelfde plek. Nu ligt de indeling vast en regelt `artScale` per toestand
   alleen hoe groot de illustratie BINNEN dat vak is. */
/* 208 → 176 (operator, 7 augustus 2026: "er moet nog een beetje gescrold
   worden"). Het beeldvak was de grootste post op een scherm waar de inhoud
   eronder juist compleet moet zijn; de illustratie heeft die twee-endertig
   punten niet nodig om te dragen. */
const BOX_IDLE = 164;
const BOX_RUN = 268;

/* Hoogte van de knop onderaan. De scroll houdt precies dit plus de
   toestel-inzet vrij, zodat de laatste kaart nooit onder de knop verdwijnt
   en er ook geen willekeurig gat overblijft. */
const BTN_H = 50;
const FOOTER_H = BTN_H + 6;
/* Waar de bloem verticaal in haar eigen bestand staat. Niet in het midden. */


/* ── Kleur van deze toestand ─────────────────────────────────────────────
   Let op: CLAUDE.md §5 geeft de bracelet-modus Calm Control blauw
   (#0A84FF). De ademsessie draait vanaf nu violet, op verzoek van de
   operator. Die twee lopen dus uiteen terwijl ze dezelfde naam dragen —
   bewust, en te herzien als de bracelet mee moet. */
/* Kleuren, teksten en patronen komen uit breath-states.ts. Dit scherm kent
   zijn eigen inhoud niet — het krijgt `?state=` mee en tekent wat daar
   staat. Zonder sleutel valt het terug op CALM, want dat is de toestand
   die de onboarding en de gratis sessie gebruiken. */

type Phase = PhaseKey;

const BRACELET_IMG =
  'https://vibezcore-audio.b-cdn.net/images/Shattudkite_vzc_fiv%20no%20bg.png';

/* Dezelfde figuur die de bracelet-sessie afsluit. Eén beeld voor beide, want
   het is hetzelfde moment. */
const BUDDHA_IMG = 'https://vibezcore-audio.b-cdn.net/images/buddha%20.png';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ── De boog in het ritmeblok ────────────────────────────────────────── */
const ARC_H = 104;

function PhaseArc({
  width,
  progress,
  accent,
  gradient,
}: {
  width: number;
  progress: SharedValue<number>;
  accent: string;
  gradient: [string, string, string];
}) {
  const cx = width / 2;
  /* Ruim genoeg zodat het getal ERIN past en niet erover. */
  const r = Math.min(width * 0.46, 96);
  const cy = ARC_H - 6;

  const track = useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2), 180, 180);
    return p;
  }, [cx, cy, r]);

  const dotX = useDerivedValue(() => {
    const a = ((180 + 180 * progress.value) * Math.PI) / 180;
    return cx + Math.cos(a) * r;
  });
  const dotY = useDerivedValue(() => {
    const a = ((180 + 180 * progress.value) * Math.PI) / 180;
    return cy + Math.sin(a) * r;
  });
  const end = useDerivedValue(() => Math.max(0.0001, progress.value));

  return (
    <Canvas style={{ width, height: ARC_H }} pointerEvents="none">
      <Path
        path={track}
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
        color="rgba(255,255,255,0.09)"
      />
      <Path
        path={track}
        style="stroke"
        strokeWidth={2.6}
        strokeCap="round"
        start={0}
        end={end}
      >
        <LinearGradient
          start={vec(cx - r, cy)}
          end={vec(cx + r, cy)}
          colors={gradient}
        />
      </Path>
      <Circle cx={dotX} cy={dotY} r={7} color={accent} opacity={0.5}>
        <BlurMask blur={7} style="normal" />
      </Circle>
      <Circle cx={dotX} cy={dotY} r={3.6} color="#ffffff" />
    </Canvas>
  );
}

/* ── Scherm ──────────────────────────────────────────────────────────── */

export default function BreathSessionScreen() {
  /* De onderrand komt van het TOESTEL, niet van een gok. SafeAreaView deed
     de onderkant eerder zelf, maar een vastgezette voet valt buiten die
     opvulling — vandaar dat de knop tegen de home-balk aan lag. Nu rekenen
     we de inzet expliciet mee, op de enige plek waar hij telt. */
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    state?: string;
    /** Zelfde rol als `state`, maar URL-VEILIG. `state` is intern een
        gereserveerd woord in de router: bij navigatie via een URL —
        deeplink, snelkoppeling, de startknop na de vragenlijst — werd
        ?state=boost stilletjes weggegooid terwijl ?quick=1 gewoon doorkwam,
        en viel elke sessie terug op CALM (audit, 8 augustus 2026). Dit was
        de bug die de operator zag als "start opent een willekeurige modus".
        Object-pushes binnen de app geven `state` wél door; die blijven. */
    mode?: string;
    from?: string;
    /** '1' = binnengekomen via de snelkoppeling op het beginscherm. Dan de
        KORTSTE duur, niet de gebruikelijke: wie van buiten de app binnenvalt
        heeft geen twintig minuten, die heeft nu iets nodig. */
    quick?: string;
  }>();
  const st: BreathState =
    BREATH_STATES[
      ((params.state ?? params.mode) as BreathStateKey) ?? 'calm'
    ] ?? BREATH_STATES.calm;
  const s = useMemo(() => makeStyles(st), [st]);
  /* Welk ritme binnen deze toestand. De eerste is de standaard; wie niets
     kiest merkt van deze laag niets. Alles hieronder rekent vanaf `tech` en
     niet meer vanaf `st` — dat is het hele verschil tussen "een toestand
     heeft een ritme" en "een toestand heeft ritmes". */
  const [techIdx, setTechIdx] = useState(0);
  const tech = st.techniques[techIdx] ?? st.techniques[0];

  /* ── Het gekozen ritme, ook nog tijdens de sessie ────────────────────────
     De fase-loop is bewust ÉÉN keer opgebouwd: hij roept zichzelf aan vanuit
     een timer, dus hij mag niet opnieuw gemaakt worden terwijl hij draait —
     anders praten er twee lussen door elkaar. De prijs daarvan is dat alles
     wat hij aanraakt bevroren is op het moment van opbouwen, en dat was het
     eerste ritme.

     Gevolg (operator, 7 augustus 2026): je koos Power 3-3, het scherm toonde
     keurig 3-3, en de sessie ademde 2-2. Bij CLARITY draaide Extended 4-8 als
     4-2-6. De keuze werd wél getoond en nooit gebruikt — in alle vijf de
     toestanden.

     Een ref lost precies dit op: de lus leest hem op het moment dat hij hem
     nodig heeft, in plaats van een kopie mee te dragen uit het verleden. */
  const techRef = useRef(tech);
  useEffect(() => {
    techRef.current = tech;
  }, [tech]);

  /* Het achtergrondgeluid. Per TOESTAND onthouden: wie voor slapen Deep wil
     en voor focus Rain, hoort dat niet elke keer opnieuw te kiezen. */
  /* Soundscape wordt NIET onthouden (operator, 4 augustus 2026). Anders dan
     stem en begeleiding is dit geen instelling maar een keuze van het moment:
     elke sessie begint stil, en wie iets wil zet het aan. Daarom ook geen
     vraag om het als standaard te bewaren. */
  /* Geen `??` met een standaard: ontbreekt de sleutel, dan is er bewust GEEN
     geluid. Een achtergrondgeluid dat vanzelf begint is een verrassing, en
     een sessie hoort niet te verrassen. */
  const [scapeKey, setScapeKey] = useState<string | null>(null);
  const scape = soundscapeByKey(scapeKey);
  const [scapeOpen, setScapeOpen] = useState(false);
  const [scapeLevel, setScapeLevelLocal] = useState<ScapeLevel>('medium');

  /* ── Waar de begeleiding vandaan komt ───────────────────────────────
     De haptiek die er stond is die van de TELEFOON. De bracelet is een ander
     kanaal, en privé is dat kanaal zonder scherm en zonder geluid.
     Zolang er geen bracelet verbonden is, valt alles terug op de telefoon —
     stil falen zou hier betekenen dat iemand een sessie start die niets doet. */
  /* Geen kanaal-KEUZE meer maar twee losse schakelaars (operator, 5 augustus
     2026). Een keuzemenu achter één knop verstopte wat er te kiezen valt; nu
     staat alles wat aan of uit kan in dezelfde rij. Privé is daarmee geen
     aparte stand meer maar wat je krijgt als je de bracelet aanzet en de stem
     uit — precies zoals het in het echt werkt. */
  const [braceletOn, setBraceletOn] = useState(false);
  const braceletReady = false; /* [HARDWARE] Fall 2026 — nog geen verbinding. */

  /* Wat er gevraagd wordt zodra iets afwijkt van de opgeslagen stand. */
  const [askDefault, setAskDefault] = useState<null | {
    apply: () => void;
    what: string;
  }>(null);


  const pickScape = useCallback(
    (k: string | null) => {
      Haptics.selectionAsync();
      setScapeKey(k);
      /* Meteen laten horen wat je kiest — ook vóór de sessie. Anders kies je
         blind en merk je pas halverwege dat het niet is wat je wilde. */
      void playScape(k);
    },
    [],
  );

  const CYCLE_S = useMemo(() => cycleSeconds(tech), [tech]);
  /* Via de ref, en dus zonder afhankelijkheden: deze twee worden vanuit de
     fase-loop aangeroepen en moeten daarom stabiel zijn én actueel. */
  const byKey = useCallback((k: Phase) => phaseAt(techRef.current, k), []);
  const nextOf = useCallback((k: Phase) => nextPhase(techRef.current, k), []);
  /* Het ritme mag zijn eigen duren dragen; anders die van de toestand. */
  const DURATIONS = tech.durations ?? st.durations;

  const [durationIdx, setDurationIdx] = useState<number>(
    params.quick === '1' ? 0 : st.defaultDuration,
  );
  const [infoIdx, setInfoIdx] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  /* Het scherm mag niet in slaap vallen zolang dit scherm open staat.
     Een ademsessie is het enige moment waarop iemand mínutenlang naar een
     telefoon kijkt zonder hem aan te raken — precies wat een toestel als
     "niet in gebruik" leest. Zonder dit dooft het beeld midden in een
     inademing, en dan moet je hem wakker tikken terwijl je juist niets
     hoort te doen. Het is de meest zichtbare fout in een sessie en hij kost
     één regel. Wordt automatisch opgeheven zodra je het scherm verlaat. */
  /* Het scherm blijft aan tijdens élke sessie, ook in privé.
     Ik had privé eerst als "scherm uit" gebouwd en dat was fout (operator,
     4 augustus 2026): het beeld blijft gewoon meelopen. Het verschil is dat
     je er niet naar hóéft te kijken en de telefoon niet hoeft vast te houden
     — kijk je toch, dan staat het er. Een scherm dat halverwege uitvalt zou
     dat juist onmogelijk maken. */
  useKeepAwake('breath-session');

  const sub = useSubscription();
  const isPro = sub.isPro || sub.hasBracelet;
  /* Alleen voor de prijzen in de premium-popup. */
  const { getProduct } = useIAP();
  /* Alleen na de gratis kennismakingssessie, en alleen als er nog iets te
     kopen valt. */
  const askPremium = params.from === 'onboarding' && !isPro;

  /* De Voice-knop op dit scherm ÍS de instelling, niet een tweede knop die
     er toevallig op lijkt (3 augustus 2026). Hier stond een eigen
     useState(true), en dat was de bron van alle ellende: het scherm zei
     "Voice ON" terwijl de app op stil stond, de cues moesten met een
     force-vlag langs die instelling heen, en de root-layout zette 'm
     ondertussen weer terug. Twee waarheden over één ding leveren altijd een
     verliezer op, en dat was de gebruiker.
     bracelet-control.tsx doet dit al zo; nu de ademkant ook. */
  /* ── De autostoel ───────────────────────────────────────────────────
     Stem en begeleiding hebben een OPGESLAGEN stand en een stand voor DEZE
     sessie. Je stapt in met je eigen instelling; verzet je iets, dan vraagt
     de app één keer of dat voortaan zo moet. Zeg je nee, dan geldt het alleen
     nu — en pas als je het ooit wéér verzet komt de vraag opnieuw.

     Vandaar twee waarden naast elkaar. Schreef een tik meteen door naar de
     instelling, dan was elke tijdelijke aanpassing meteen permanent en had de
     vraag geen betekenis meer. */
  /* ── Voorkeur per toestand ──────────────────────────────────────────
     Iemand wil bij CALM CONTROL de stem aan en bij REST & RESET alleen
     trilling (operator, 5 augustus 2026). De opgeslagen stand is daarom niet
     één waarde voor de hele app maar één per toestand, met de algemene stand
     als terugval. Wie nooit iets per toestand instelt merkt van deze laag
     niets. */
  const [prefs, setPrefs] = useSetting('breathPrefs');
  const [voiceGlobal] = useSetting('voiceCues');
  const [hapticGlobal] = useSetting('hapticsPhone');
  const pref = prefs[st.key] ?? {};
  const voiceDefault = pref.voice ?? voiceGlobal;
  const hapticDefault = pref.haptics ?? hapticGlobal;
  const remember = useCallback(
    (patch: { voice?: boolean; haptics?: boolean }) => {
      void setPrefs({ ...prefs, [st.key]: { ...pref, ...patch } });
    },
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [prefs, st.key],
  );
  const [voiceOn, setVoiceOnLocal] = useState(voiceDefault);
  /* Één keer overnemen zodra de opgeslagen waarde binnen is; daarna niet meer,
     anders overschrijft een late lading je keuze van dit moment. */
  const tookVoice = useRef(false);
  useEffect(() => {
    if (tookVoice.current) return;
    tookVoice.current = true;
    setVoiceOnLocal(voiceDefault);
  }, [voiceDefault]);
  /* Telefoon-trilling: opgeslagen stand plus die van deze sessie, net als de
     stem. Zelfde autostoel-regel. */
  const [hapticsOn, setHapticsOn] = useState(hapticDefault);
  const tookHaptic = useRef(false);
  useEffect(() => {
    if (tookHaptic.current) return;
    tookHaptic.current = true;
    setHapticsOn(hapticDefault);
  }, [hapticDefault]);

  const [phase, setPhase] = useState<Phase>('inhale');
  const [secsLeft, setSecsLeft] = useState(st.techniques[0].phases[0].secs);
  const [round, setRound] = useState(1);

  /* Binnen de grenzen blijven. 4-7-8 heeft twee duren, de andere ritmes drie
     of vier. Stond je op de derde en wisselde je van ritme, dan wees de index
     naar niets en viel de app om op de eerstvolgende regel. Terugvallen op de
     laatste die er WEL is, is hier het juiste antwoord: je koos de langste, en
     dat blijft de langste. */
  const chosen =
    DURATIONS[Math.min(durationIdx, DURATIONS.length - 1)] ?? DURATIONS[0];
  /* Berekend uit het gekozen ritme, niet meer uit een vast getal per
     toestand: twintig minuten van een cyclus van tien seconden is nu eenmaal
     een ander aantal rondes dan van een cyclus van zestien. */
  /* Een vast aantal ademhalingen gaat vóór een aantal minuten. */
  const rounds = chosen.cycles ?? roundsFor(tech, chosen.minutes);
  const totalSec = rounds * CYCLE_S;

  /* De fase-loop draait buiten React om, dus de actuele instellingen komen
     uit refs. Anders leest een lopende sessie de waarden van de render
     waarin hij begon. */
  const voiceRef = useRef(voiceOn);
  const hapticRef = useRef(hapticsOn);
  const roundsRef = useRef(rounds);
  /* De knop schrijft nu wél door naar de voorkeur — dat is het punt van één
     waarheid. Zet je hier de stem uit, dan is hij ook uit in de onboarding,
     bij de bracelet en in Settings. Dat is geen bijwerking maar precies wat
     iemand bedoelt die op een luidsprekertje met een streep tikt.
     De root-layout dient diezelfde waarde uit; die twee vechten dus niet
     meer, en de force-vlag die dat gevecht moest omzeilen is weg. */
  useEffect(() => {
    voiceRef.current = voiceOn;
    /* De dienst volgt de stand van DEZE toestand, niet de algemene. Anders
       zou "stem uit bij REST" ook de stem bij CALM blokkeren, want de poort
       in breath-voice.ts kent maar één vlag. Bij het verlaten van het scherm
       gaat hij terug naar de algemene stand — zie de opruiming hieronder. */
    setVoiceEnabled(voiceOn);
    if (!voiceOn) stopVoice();
  }, [voiceOn]);
  useEffect(() => {
    hapticRef.current = hapticsOn;
  }, [hapticsOn]);
  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);

  /* Hoeveel seconden er ECHT geademd is. Bijgehouden in de fase-lus zelf en
     niet afgeleid uit de render-waarden: die zijn in een callback verouderd,
     en dan schrijf je de duur van een paar tellen geleden weg. */
  const elapsedRef = useRef(0);
  const roundRef = useRef(1);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* De vooruitlopende stemcue heeft een eigen wekker: hij vuurt vóór het
     einde van de lopende fase en mag dus niet aan de fase-wissel hangen. */
  const preRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Hoeveel eerder het geluidsbestand start dan de fase waar het bij hoort.
     Ruim genoeg om de trage aanzet van de opnames op te vangen, kort genoeg
     om niet vóór de vorige fase uit te lopen. */
  const CUE_LEAD_MS = 400;

  const speak = useCallback(
    (p: { key: PhaseKey; via: 'Nose' | 'Mouth' | null }) => {
      if (!voiceRef.current) return;
      playBreathCue(
        p.key,
        p.via === 'Mouth' ? 'mouth' : 'nose',
        st.key === 'boost' ? 'boost' : 'calm',
        'breath',
      );
    },
    [st.key],
  );

  /* Eén ademwaarde stuurt de hele figuur. Vóór de start loopt hij rustig
     rond zodat het scherm leeft; bij de start neemt het echte patroon het
     over. Dat is dezelfde waarde, dus de overgang is naadloos. */
  const breath = useSharedValue(0);
  const arc = useSharedValue(0);

  const idleBreathing = useCallback(() => {
    cancelAnimation(breath);
    breath.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath]);

  useEffect(() => {
    idleBreathing();
    prefetchSessionArt();
  }, [idleBreathing]);

  const clearTimers = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (nextRef.current) clearTimeout(nextRef.current);
    if (preRef.current) clearTimeout(preRef.current);
    tickRef.current = null;
    nextRef.current = null;
    preRef.current = null;
  }, []);

  const stopAll = useCallback(() => {
    clearTimers();
    Vibration.cancel();
    stopVoice();
    cancelAnimation(arc);
    arc.value = 0;
  }, [arc, clearTimers]);

  /* Staat bewust vóór runPhase: de laatste ronde roept dit aan.
     `completed` onderscheidt uitgelopen van afgebroken — alleen een
     afgemaakte sessie verdient een afsluitscherm. */
  const finish = useCallback((completed = false) => {
    stopAll();
    stopScape();

    /* ── De sessie WEGSCHRIJVEN ──────────────────────────────────────────
       Dit ontbrak volledig (hersteld 6 augustus 2026). De oude inline-sessie
       op de Breath-tab schreef elke sessie weg; die tab is op 2 augustus
       vervangen door het keuzescherm, en de aanroep verhuisde niet mee. Sinds
       die dag is er geen enkele ademsessie opgeslagen — en alles wat daarna op
       die historiek gebouwd is (de suggestie, de praktijkregel, het hele
       Activity-tabblad) las dus een lege lijst.

       Ook een afgebroken sessie telt mee, met de tijd die je wél gedaan hebt.
       Wie na drie van de tien minuten stopt heeft drie minuten geademd, en die
       niet meetellen maakt de cijfers een beloning voor doorzetten in plaats
       van een verslag van wat er gebeurd is. Onder de tien seconden slaan we
       niets op: dat is een vergissing, geen sessie. */
    const doneSec = Math.round(elapsedRef.current);
    if (doneSec >= 10) {
      void addBreathSession({
        key: st.key,
        name: st.eyebrow,
        durSec: doneSec,
        rounds: completed ? roundsRef.current : Math.max(1, roundRef.current),
        completed,
      });
    }
    elapsedRef.current = 0;

    if (completed) setDone(true);
    setRunning(false);
    setRound(1);
    setPhase('inhale');
    setSecsLeft(techRef.current.phases[0].secs);
    idleBreathing();
    releaseVoiceSource('breath');
  }, [idleBreathing, stopAll]);

  /* ── De fase-loop ──────────────────────────────────────────────────── */
  const runPhase = useCallback(
    (k: Phase, r: number) => {
      const def = byKey(k);
      setPhase(k);
      setSecsLeft(def.secs);

      /* Bij bracelet en privé zwijgt de telefoon: het ritme zit dan op de
         pols en twee bronnen tegelijk is geen begeleiding maar ruis. */
      if (hapticRef.current) {
        /* De trilling draagt de HELE fase, niet alleen de overgang: een tik
           aan het begin zegt niets over de vier seconden erna. In- en
           uitademen krijgen een reeks die respectievelijk aanzwelt en
           uitdooft, vasthouden drie tikjes en dan stilte. Zie
           breath-haptics.ts — de duur bepaalt de vorm, dus die gaat mee. */
        playPhaseHaptic(k, def.secs);
      }
      /* ── De stem loopt vóór ─────────────────────────────────────────────
         De cue van de VOLGENDE fase wordt een fractie vóór de overgang
         ingezet, niet op het moment zelf.

         Reden (operator, 3 augustus 2026): de opnames zetten traag in. Startte
         het bestand precies op de overgang, dan was er al bijna een seconde
         voorbij voordat het eerste woord klonk — en dan loopt de instructie
         achter de beweging aan in plaats van hem aan te kondigen. Er zit geen
         stilte in de bestanden die weggeknipt kan worden; het is de aanzet
         van de stem zelf.

         Vandaar de voorsprong: het bestand begint eerder, zodat het eerste
         WOORD op de overgang valt. Dat is waar de gebruiker op reageert. */
      const upcoming = nextOf(k);
      if (preRef.current) clearTimeout(preRef.current);
      preRef.current = setTimeout(
        () => speak(upcoming),
        Math.max(0, def.secs * 1000 - CUE_LEAD_MS),
      );

      /* Beeld: alleen in- en uitademen bewegen. Tijdens het vasthouden
         blijft de vorm staan waar hij staat — dat is wat vasthouden ís. */
      if (k === 'inhale' || k === 'exhale') {
        breath.value = withTiming(k === 'inhale' ? 1 : 0, {
          duration: def.secs * 1000,
          easing: Easing.inOut(Easing.sin),
        });
      }

      arc.value = 0;
      arc.value = withTiming(1, {
        duration: def.secs * 1000,
        easing: Easing.linear,
      });

      let left = def.secs;
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        left -= 1;
        elapsedRef.current += 1;
        setSecsLeft(left);
        if (left <= 0) {
          if (tickRef.current) clearInterval(tickRef.current);
          tickRef.current = null;
          /* Nul laten renderen vóór de fase wisselt, anders blijft "1"
             even hangen op de overgang. */
          nextRef.current = setTimeout(() => {
            /* Een ronde is voorbij zodra de LAATSTE fase van deze toestand
               is afgelopen — welke fase dat ook is.

               Hier stond `k === 'hold-out'`, en dat gold maar voor één van de
               vijf: alleen CALM heeft een tweede vasthoudmoment. BOOST, FOCUS,
               CLARITY en REST eindigen op uitademen, dus daar telde de ronde
               NOOIT op. Die sessies bleven eeuwig in ronde één hangen: de
               teller sprong elke paar seconden terug naar het begin, de tijd
               liep niet door en de sessie kon niet aflopen. Precies wat de
               operator zag.

               Nu wordt het einde van de ronde afgeleid uit de fasenlijst
               zelf, dus het klopt ook voor een toestand die er later bijkomt
               met een heel ander ritme. */
            const phases = techRef.current.phases;
            const idx = phases.findIndex((p) => p.key === k);
            const lastOfRound = idx === phases.length - 1;
            if (lastOfRound) {
              const n = r + 1;
              if (n > roundsRef.current) {
                finish(true);
                return;
              }
              setRound(n);
              roundRef.current = n;
              runPhase(techRef.current.phases[0].key, n);
            } else {
              runPhase(nextOf(k).key, r);
            }
          }, 0);
        }
      }, 1000);
    },
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [arc, breath, finish],
  );

  /* ── De poort ──────────────────────────────────────────────────────
     Sessies zijn premium (operator, 8 augustus 2026: "de breathe in de app
     pas unlocked na premium"). Premium = abonnement óf bracelet — de
     bracelet-koper heeft de sessies gratis, dat is de afspraak.

     De poort staat op STARTEN, niet op kijken: iedereen mag alle vijf de
     toestanden en ritmes zien, dat is de etalage. En de popup is WEGKLIKBAAR
     (operator wees naar Breathwrk): een muur die je niet kunt sluiten voelt
     als gijzeling, eentje mét kruisje als een aanbod.

     Eén uitzondering: de kennismakingssessie uit de onboarding
     (`from=onboarding`) — wie de intro uitloopt, verdient één echte sessie
     voor er ooit om geld gevraagd wordt. */
  const [paywall, setPaywall] = useState(false);
  const locked = !isPro && params.from !== 'onboarding';

  const start = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    claimVoiceSource('breath');
    /* Het achtergrondgeluid hoort bij de sessie, niet bij het scherm: het komt
       op met START en gaat weg met END. */
    void playScape(scapeKey);
    setRunning(true);
    setRound(1);
    roundRef.current = 1;
    elapsedRef.current = 0;
    cancelAnimation(breath);
    breath.value = 0;
    /* De allereerste cue kan per definitie niet vooruitlopen — er is geen
       fase vóór deze. Die klinkt dus gelijk met de start. */
    speak(techRef.current.phases[0]);
    runPhase(techRef.current.phases[0].key, 1);
  }, [breath, runPhase]);

  const stop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    finish();
  }, [finish]);

  useEffect(
    () => () => {
      stopAll();
      stopScape();
      setVoiceEnabled(voiceGlobal);
      releaseVoiceSource('breath');
    },
    [stopAll],
  );

  /* ── De afsluitende monoloog ────────────────────────────────────────
     Eén opname per toestand, ingesproken door de operator. Die hoorde bij
     het afsluitscherm van de oude Breath-tab, en die tab is op 2 augustus
     2026 vervangen door de keuzepagina — daarmee riep niemand hem nog aan
     en eindigde een afgemaakte sessie in stilte. De bestanden zijn nooit
     weg geweest; de aanroep wel.

     Volgt exact dezelfde schakelaar als de fasecues (operator, 3 augustus
     2026): staat de stem uit — hier, in Settings, of doordat de onboarding
     op trillingen of stil is gezet — dan blijft ook de afsluiting stil. Eén
     schakelaar voor alles wat geluid maakt; er is geen pad meer dat er
     omheen loopt.

     Bij het wegtikken van het scherm stopt de opname, anders praat hij door
     over een scherm dat er niet meer is. */
  useEffect(() => {
    if (!done) return;
    if (!voiceRef.current) return;
    try {
      playCompletionCue(st.key as BreathKey);
    } catch {
      /* een haperende afsluiting mag de sessie niet alsnog laten stuklopen */
    }
  }, [done, st.key]);

  const dismissDone = useCallback(() => {
    stopVoice();
    setDone(false);
  }, []);

  /* Eerste tik kiest, tweede tik legt uit. Zo hoeft er geen extra
     info-knopje naast te staan. */
  const pickDuration = (i: number) => {
    if (running) return;
    Haptics.selectionAsync();
    if (i === durationIdx) setInfoIdx(i);
    else setDurationIdx(i);
  };

  /* Verstreken tijd wordt AFGELEID uit de fase-lus, niet apart geteld. Een
     tweede timer naast de eerste loopt onvermijdelijk uit de pas. */
  const idx = tech.phases.findIndex((p) => p.key === phase);
  const elapsed =
    (round - 1) * CYCLE_S +
    tech.phases.slice(0, idx).reduce((s, p) => s + p.secs, 0) +
    (byKey(phase).secs - secsLeft);
  const leftSec = Math.max(0, totalSec - elapsed);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Ruimte achter alles. Eén kleur, lage dichtheid, traag fonkelen —
          het geeft diepte zodat de figuur ergens IN hangt in plaats van
          op een zwart vlak te liggen. Ligt onder alle content. */}
      <View style={s.stars} pointerEvents="none">
        <Starfield
          width={SCREEN_W}
          height={SCREEN_H}
          count={70}
          color="#C9A7FF"
        />
      </View>

      <View style={s.topbar}>
        <Pressable
          /* De onboarding komt hier binnen met `replace`, dus er is geen
             geschiedenis om naar terug te keren — `back()` deed dan niets
             en je zat vast op dit scherm. Vandaar de val naar de Breath-tab. */
          onPress={() => {
            if (running) {
              stop();
              return;
            }
            /* Terug naar de vijf toestanden, NIET naar het welkomstbeeld
               (operator, 7 augustus 2026). Je hebt die drempel al genomen; er
               weer op uitkomen leest als eruit gezet worden. */
            skipBreathIntroOnce();
            if (router.canGoBack()) router.back();
            else router.replace('/breath');
          }}
          hitSlop={12}
          style={s.iconBtn}
        >
          <X size={18} color="rgba(255,255,255,0.72)" strokeWidth={2.2} />
        </Pressable>
        <Text style={s.eyebrow}>{st.eyebrow}</Text>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          style={s.iconBtn}
        >
          <Settings size={17} color="rgba(255,255,255,0.72)" strokeWidth={2} />
        </Pressable>
      </View>

      {/* `flex: 1` is hier niet cosmetisch. Zonder dat krimpt een ScrollView
          in React Native niet mee — hij groeit met zijn inhoud en duwt de
          voet onder de schermrand. Dat was precies waarom START SESSION
          soms verdween en er geen manier meer was om opnieuw te beginnen. */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={[
          s.scroll,
          running && s.scrollRunning,
          { paddingBottom: FOOTER_H + Math.max(insets.bottom, 10) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* De figuurnaam ("Lotus") en de tagline zijn weg (operator, 4
            augustus 2026). Ze stonden bovenaan en duwden de illustratie zo ver
            omlaag dat je moest scrollen om de knop te zien. De naam van de
            TOESTAND staat al in de balk erboven; dat is wat iemand hier nodig
            heeft. Alles wat je niet leest kost hier hoogte, en hoogte is het
            schaarse goed op dit scherm. */}

        {/* Weg zodra de sessie loopt. Wie ademt leest niet. */}
        {/* De beschrijving is eruit (operator 2 augustus 2026): drie regels
            kostten zoveel hoogte dat alles eronder opgekropt raakte en het
            scherm moest scrollen. De tagline blijft — die is één regel en
            zegt waar de toestand over gaat. */}


        {/* Het beeld is vierkant, maar een lotus is breder dan hoog: de
            bovenste en onderste marge blijven leeg. Die snijden we weg,
            zodat de bloem groot blijft zonder een vijfde van het scherm
            aan niets te besteden. */}
        <View style={s.visualWrap}>
          <SessionArt
            size={(running ? ART_RUN : ART_IDLE) * (st.artScale ?? 1)}
            art={st.art}
            breath={breath}
            glow={st.glow}
            boxHeight={running ? BOX_RUN : BOX_IDLE}
            focusY={st.focusY}
            rings={running}
          />
        </View>

        {/* Voortgang: ÉÉN regel in plaats van vier blokken boven elkaar.
            Stond hier eerder als ROUND / tijd / LEFT / balk onder elkaar,
            samen bijna negentig punten hoog — dat drukte tegen de figuur
            aan. Een rondeteller is bijzaak tijdens het ademen; hij hoort
            leesbaar te zijn, niet groot. */}
        {running ? (
          <View style={s.progressWrap}>
            <Text style={s.progressRound}>
              ROUND {round} / {rounds}
            </Text>
            <Text style={s.progressLeft}>{fmt(leftSec)} left</Text>
            <View style={s.bar}>
              <View
                style={[
                  s.barFill,
                  { width: `${Math.min(100, (elapsed / totalSec) * 100)}%` },
                ]}
              />
            </View>
          </View>
        ) : (
          <View style={s.durationWrap}>
            {st.techniques.length > 1 && (
              <>
                <Text style={s.sectionEyebrow}>Breathing rhythm</Text>
                <View style={s.chips}>
                  {st.techniques.map((t, i) => {
                    const on = i === techIdx;
                    return (
                      <Pressable
                        key={t.key}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setTechIdx(i);
                        }}
                        style={[s.techChip, on && s.chipActive]}
                      >
                        {/* Naam boven, patroon eronder (operator, 7 augustus
                            2026). De officiele term hoort er te staan — een
                            app die ook door mensen uit het vak gelezen wordt,
                            kan niet "Energize" zeggen waar de literatuur
                            "Equal Breathing" zegt. Maar bij BOOST heten
                            allebei de ritmes zo; dan is het patroon het enige
                            dat ze uit elkaar houdt, en dus moet dat er los
                            onder. Het patroon komt uit de fases zelf. */}
                        <Text style={[s.techTxt, on && s.chipTxtActive]}>
                          {t.name}
                        </Text>
                        <Text
                          style={[
                            s.techPattern,
                            on && { color: st.accent, opacity: 0.9 },
                          ]}
                        >
                          {patternOf(t)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {/* Wat het VERSCHIL is, meteen zichtbaar (operator, 6 augustus
                    2026). "Box 4-4-4-4" en "Triangle 4-4-4" zeggen niets tegen
                    wie de termen niet kent — en dat is vrijwel iedereen. De
                    uitleg stond wel geschreven, maar alleen in een venster op
                    een ander scherm; hier moet hij staan, want hier kies je.
                    Geen tik nodig: een keuze die je eerst moet openen om te
                    snappen, is geen keuze. */}
                <TechniqueExplain
                  text={tech.explain}
                  accent={st.accent}
                  step={techIdx}
                  style={s.techExplain}
                />
              </>
            )}
            <Text style={s.sectionEyebrow}>Session duration</Text>
            <View style={s.chips}>
              {DURATIONS.map((d, i) => {
                const active = i === Math.min(durationIdx, DURATIONS.length - 1);
                return (
                  <Pressable
                    key={d.name}
                    onPress={() => pickDuration(i)}
                    style={[s.chip, active && s.chipActive]}
                  >
                    <Text style={[s.chipTxt, active && s.chipTxtActive]}>
                      {d.cycles ?? d.minutes}
                      <Text style={s.chipUnit}>
                        {d.cycles ? ' CYCLES' : ' MIN'}
                      </Text>
                    </Text>
                    <Text style={[s.chipName, active && s.chipNameActive]}>
                      {d.name.split(' ')[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.exact}>
              {fmt(totalSec)} · {rounds} rounds
              {chosen.recommended ? ' · recommended' : ''}
            </Text>
            <Text style={s.hint}>Double tap for more info</Text>
          </View>
        )}

        {/* ── Ademritme. Vooraf stil en volledig; tijdens de sessie licht
             de fase op waar je in zit. ── */}
        {!running ? (
          <View style={s.patternCard}>
            <Text style={s.cardEyebrow}>Breathing pattern</Text>
            <View style={s.phaseRow}>
              {tech.phases.map((p, i) => (
                <View key={i} style={s.phaseCol}>
                  <Text style={s.phaseSecsSmall}>{p.secs}s</Text>
                  <Text style={s.phaseName}>
                    {p.label[0] + p.label.slice(1).toLowerCase()}
                  </Text>
                  {/* Dit ontbrak: nergens was af te lezen of je door de
                      neus of door de mond ademt. */}
                  <Text style={p.via ? s.phaseVia : s.phaseViaNone}>
                    {p.via ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={s.patternFoot}>{tech.name}</Text>
          </View>
        ) : null}

        {/* Alleen tijdens de sessie (operator, 4 augustus 2026). Vooraf
            stond dit blok er ook, maar daar hoort het niet: op de
            startpagina kies je je ritme en je duur, en de kanalen zitten een
            tik verder. Twee keer hetzelfde blok op twee schermen maakt geen
            van beide duidelijker.

            De opbouw is nu VERTICAAL. De knoppen stonden links en rechts van
            de boog en liepen er zichtbaar tegenaan; nu staat de boog boven en
            staan de drie er netjes onder, naast elkaar. Alles krijgt lucht,
            en niets overlapt meer. */}
        {running && (
          <View style={s.rhythmCard}>
                        <View style={s.rhythmCenter}>
              <PhaseArc
                  width={SCREEN_W * 0.44}
                  progress={arc}
                  accent={st.accent}
                  gradient={st.gradient}
                />
              {/* In de boog staat alleen nog de tijd. De naam van de fase
                  paste er niet meer bij zodra de opening erbij kwam —
                  "EXHALE · NOSE" liep dwars door de boog heen, en een
                  instructie die over zijn eigen meter valt is geen
                  instructie. */}
              <View style={s.arcOverlay}>
                <Text style={s.phaseBig}>
                  {Math.max(0, secsLeft).toFixed(1)}
                </Text>
                <Text style={s.phaseUnit}>SEC</Text>
              </View>
              {/* Onder de boog, over de volle breedte, in de kleur van de
                  toestand: wat je NU doet en waar de lucht langs gaat. Hier
                  stond "Next: …", en die is eruit — de sessie stuurt elke
                  fase live aan met stem en trilling, dus vooruitlezen wat er
                  zo komt voegt niets toe en trekt de aandacht juist weg van
                  wat er op dit moment moet gebeuren. */}
              <Text style={s.phaseLine}>
                {byKey(phase).label}
                {byKey(phase).via
                  ? ` · ${byKey(phase).via!.toUpperCase()}`
                  : ''}
              </Text>
            </View>

            {/* Wat je hoort ONDER de stem. Eén regel — icoon plus naam —
                want dertien namen horen niet op het scherm te staan waarop
                je ademt. Tikken opent het vel. */}
            <View style={s.channelRow}>
            <Pressable
              /* Directe waarde, geen updater-functie: de setter van
                 useSetting neemt een waarde aan. Deze regel staat in de JSX,
                 dus `voiceOn` is die van de huidige render — vers per tik. */
              onPress={() => {
                const v = !voiceOn;
                setVoiceOnLocal(v);
                /* Alleen vragen als je AFWIJKT van je eigen stand. Zet je hem
                   terug naar de standaard, dan is er niets veranderd. */
                if (v !== voiceDefault) {
                  setAskDefault({
                    what: `${st.eyebrow} · Voice ${v ? 'on' : 'off'}`,
                    apply: () => remember({ voice: v }),
                  });
                }
              }}
              style={s.channel}
              hitSlop={8}
            >
              <Volume2
                size={19}
                color={voiceOn ? st.accent : 'rgba(255,255,255,0.3)'}
                strokeWidth={2.2}
              />
              <Text style={[s.channelLabel, !voiceOn && s.channelOff]}>
                Voice
              </Text>
              <Text style={[s.channelState, !voiceOn && s.channelOff]}>
                {voiceOn ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setScapeOpen(true)}
              style={s.channel}
              hitSlop={8}
            >
              {scape ? (
                <scape.Icon size={19} color={st.accent} strokeWidth={2.2} />
              ) : (
                <VolumeX size={19} color="rgba(255,255,255,0.3)" strokeWidth={2.2} />
              )}
              <Text style={[s.channelLabel, !scape && s.channelOff]}>
                Soundscape
              </Text>
              <Text
                style={[s.channelState, !scape && s.channelOff]}
                numberOfLines={1}
              >
                {scape ? scape.name.toUpperCase() : 'OFF'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const v = !hapticsOn;
                setHapticsOn(v);
                if (v !== hapticDefault) {
                  setAskDefault({
                    what: `${st.eyebrow} · Phone ${v ? 'on' : 'off'}`,
                    apply: () => remember({ haptics: v }),
                  });
                }
              }}
              style={s.channel}
              hitSlop={8}
            >
              <Smartphone
                size={19}
                color={hapticsOn ? st.accent : 'rgba(255,255,255,0.3)'}
                strokeWidth={2.2}
              />
              <Text style={[s.channelLabel, !hapticsOn && s.channelOff]}>
                Phone
              </Text>
              <Text style={[s.channelState, !hapticsOn && s.channelOff]}>
                {hapticsOn ? 'ON' : 'OFF'}
              </Text>
            </Pressable>

            {/* De bracelet staat er AL, gedimd, met zijn datum. Dit is het
                moment waarop iemand merkt dat zijn telefoon in zijn hand moet
                blijven trillen — en dan is het eerlijk om te tonen dat daar
                iets voor komt. Aanzetten kan pas als er hardware is. */}
            <Pressable
              disabled={!braceletReady}
              onPress={() => setBraceletOn((b) => !b)}
              style={s.channel}
              hitSlop={8}
            >
              <Watch
                size={19}
                color={
                  braceletOn && braceletReady
                    ? st.accent
                    : 'rgba(255,255,255,0.22)'
                }
                strokeWidth={2.2}
              />
              <Text style={[s.channelLabel, s.channelLocked]}>Bracelet</Text>
              <Text style={[s.channelState, s.channelLocked]}>
                {braceletReady ? (braceletOn ? 'ON' : 'OFF') : 'FALL 2026'}
              </Text>
            </Pressable>
            </View>
          </View>
        )}

        {/* Hier stond een kaart die de Smart Bead Bracelet aanprees. Weg
            (operator, 7 augustus 2026): de pagina hoort te ademen en niet
            gescrold te worden, en dat blok was het enige dat er niet in paste.
            De bracelet staat trouwens al op dit scherm — als vierde kanaal
            naast stem, geluid en telefoon, met zijn datum erbij. Twee keer
            hetzelfde aankondigen op één scherm is geen aandacht vragen maar
            aandacht verliezen. Hij blijft bereikbaar via zijn eigen tab. */}
      </ScrollView>

      {/* Verloop onder de knop. Zonder dit lijkt de laatste kaart door de
          knop doorgesneden; nu vervaagt de inhoud eronder en leest de knop
          als iets dat ervóór zweeft. Dat verschil is het hele verschil
          tussen "afgekapt" en "afgewerkt". */}
      <ExpoGradient
        colors={['rgba(10,10,10,0)', Brand.bg, Brand.bg]}
        locations={[0, 0.55, 1]}
        pointerEvents="none"
        style={[s.footerScrim, { height: FOOTER_H + Math.max(insets.bottom, 10) + 88 }]}
      />

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) + 24 }]}>
        {running ? (
          /* END SESSION blijft BEWUST stil en omlijnd (operator vroeg om wit
             en vol, 7 augustus 2026 — dit is de ene plek waar ik het afraad).
             Tijdens een sessie is er geen handeling die je hoort te doen; het
             hele punt is dat je niets doet. Een volle witte balk is dan het
             felste op het scherm en nodigt uit tot stoppen, precies wat de
             sessie niet moet. Hij blijft vindbaar, niet luid. */
          <Pressable onPress={stop} style={s.endBtn}>
            <Text style={s.endTxt}>END SESSION</Text>
          </Pressable>
        ) : (
          /* VOL in de kleur van de toestand (operator, 7 augustus 2026).
             Vervangt de keuze van 4 augustus om hem te omlijnen. Dit is de
             enige handeling op het scherm en hoort ook de enige te zijn die
             opvalt. De vorm blijft gelijk aan SELECT MODE op de keuzepagina,
             dus de twee schermen lezen nog steeds als een product — nu
             allebei gevuld in plaats van allebei omlijnd.
             OUD: omlijnd, niet gevuld — dezelfde vorm als SELECT MODE op de
             keuzepagina (operator, 4 augustus 2026: "start session is ook
             niet mooi"). Een volle balk van vijftig punten is het zwaarste
             element op een scherm dat verder uit één lichtgevende figuur op
             zwart bestaat, en dat hoort de figuur te zijn. Twee schermen na
             elkaar met dezelfde knopvorm lezen bovendien als één product. */
          <Pressable
            onPress={() => {
              if (locked) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPaywall(true);
                return;
              }
              start();
            }}
            style={[
              s.startBtn,
              { backgroundColor: st.accent, borderColor: st.accent },
            ]}
            android_ripple={{ color: 'rgba(0,0,0,0.12)' }}
          >
            <Text style={[s.startTxt, { color: '#0a0a0a' }]}>START SESSION</Text>
            <ArrowRight size={17} color="#0a0a0a" strokeWidth={2.4} />
          </Pressable>
        )}
      </View>

      {/* ── Premium-popup ─────────────────────────────────────────────────
           In VIBEZCORE-stijl, nooit een systeem-alert. Wegklikbaar via het
           kruisje of de achtergrond; wie sluit, staat gewoon weer op het
           instelscherm. De prijzen komen uit de store zelf (getProduct), dus
           er staat exact wat iemand gaat betalen — of niets, zolang de store
           ze nog niet gegeven heeft. */}
      <Modal
        visible={paywall}
        transparent
        animationType="fade"
        onRequestClose={() => setPaywall(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setPaywall(false)}>
          <Pressable style={s.payCard} onPress={() => {}}>
            {/* Blauw verloop bovenlangs — het merk, niet de toestand. De
                popup stond eerst in de accentkleur van de toestand en dat
                klopte niet: dit is geen onderdeel van de sessie maar een
                aanbod van VIBEZCORE, en dat spreekt in merkblauw (operator,
                8 augustus 2026: "niet paars, en interessanter"). */}
            <ExpoGradient
              colors={['rgba(58,143,255,0.22)', 'rgba(58,143,255,0)']}
              style={s.payGlow}
              pointerEvents="none"
            />
            <Pressable
              onPress={() => setPaywall(false)}
              hitSlop={12}
              style={s.payClose}
            >
              <X size={20} color="rgba(255,255,255,0.6)" strokeWidth={2.2} />
            </Pressable>
            <Text style={s.payEyebrow}>VIBEZCORE PREMIUM</Text>
            <Text style={s.payTitle}>Unlock every session</Text>
            <View style={s.payList}>
              {[
                'All five states, every rhythm and duration',
                'Voice, haptic and visual guidance',
                'Soundscapes, goals and your daily plan',
                /* De prijsbelofte (operator, 8 augustus 2026): wie nu lid
                   wordt, houdt de early-bird-prijs van de bracelet vast tot
                   de lancering. Het bedrag komt uit dezelfde PRICING als de
                   bracelet-pagina — één bron, dus altijd hetzelfde getal. */
                `Bracelet price locked: ${PRICING.bracelet.main} at launch (not ${PRICING.bracelet.old})`,
              ].map((line) => (
                <View key={line} style={s.payRow}>
                  <View style={s.payCheck}>
                    <Check size={11} color="#0a0a0a" strokeWidth={3.2} />
                  </View>
                  <Text style={s.payRowTxt}>{line}</Text>
                </View>
              ))}
            </View>
            {(['yearly', 'monthly'] as const).map((tier) => {
              const prod = getProduct(tier);
              /* De besparing wordt UITGEREKEND uit de echte store-prijzen,
                 nooit hard gezet: dan klopt hij in elke valuta en bij elke
                 prijswijziging (WYSIWYG — er staat wat je betaalt). */
              const yr = getProduct('yearly')?.priceAmountMicros;
              const mo = getProduct('monthly')?.priceAmountMicros;
              const savePct =
                tier === 'yearly' && yr && mo
                  ? Math.round((1 - yr / (mo * 12)) * 100)
                  : 0;
              return (
                <Pressable
                  key={tier}
                  onPress={() => {
                    setPaywall(false);
                    router.push(`/subscribe?tier=${tier}` as never);
                  }}
                  style={[s.payTier, tier === 'yearly' && s.payTierMain]}
                  android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                >
                  <View style={s.payTierLeft}>
                    <Text style={s.payTierName}>
                      {tier === 'yearly' ? 'Yearly' : 'Monthly'}
                    </Text>
                    {savePct > 0 && (
                      <View style={s.paySave}>
                        <Text style={s.paySaveTxt}>SAVE {savePct}%</Text>
                      </View>
                    )}
                  </View>
                  {prod ? (
                    <Text style={s.payTierPrice}>
                      {prod.localizedPrice}
                      {tier === 'yearly' ? '/yr' : '/mo'}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
            {/* Geen kleine lettertjes maar het eerlijke alternatief: wie de
                bracelet koopt, heeft dit al. */}
            <Pressable
              onPress={() => {
                setPaywall(false);
                router.push('/bracelet' as never);
              }}
              hitSlop={8}
            >
              <Text style={s.payBracelet}>
                Included free with the Smart Bead Bracelet
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Zal ik dit onthouden? ─────────────────────────────────────────
           Verschijnt alleen als je iets verzet dat AFWIJKT van je opgeslagen
           stand. Zeg je nee, dan geldt de wijziging alleen deze sessie en
           zwijgt de app tot je het ooit weer verzet.

           Bewust niet na afloop van de sessie: dan is het moment voorbij en
           weet je niet meer waar de vraag over gaat. En bewust niet bij
           soundscapes — die zijn per sessie en hebben geen standaard. */}
      <Modal
        visible={askDefault !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAskDefault(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setAskDefault(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalEyebrow}>{askDefault?.what.toUpperCase()}</Text>
            <Text style={s.modalTitle}>Make this your default?</Text>
            <Text style={s.modalBody}>
              Every {st.eyebrow} session will start this way. Other modes keep
              their own settings.
            </Text>
            <Pressable
              style={s.modalBtn}
              onPress={() => {
                askDefault?.apply();
                setAskDefault(null);
              }}
            >
              <Text style={s.modalBtnTxt}>Yes, remember it</Text>
            </Pressable>
            <Pressable
              style={s.modalSecondary}
              onPress={() => setAskDefault(null)}
              hitSlop={8}
            >
              <Text style={s.modalSecondaryTxt}>Just this time</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Welk geluid eronder ──────────────────────────────────────────
           Dertien opties passen niet in een rij, dus een vel met de vier
           groepen als kopjes. Off staat bovenaan en los: dat is geen geluid
           maar een keuze. Tikken speelt meteen, zodat je hoort wat je pakt
           in plaats van dertien namen te moeten raden. */}
      <Modal
        visible={scapeOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setScapeOpen(false)}
      >
        <Pressable style={s.sheetBackdrop} onPress={() => setScapeOpen(false)}>
          <Pressable
            style={[
              s.sheet,
              /* De navigatiebalk van het toestel hoort er NIET overheen te
                 vallen. Zonder deze inzet stond Done half onder de balk en was
                 niet te lezen wat er stond. */
              { paddingBottom: Math.max(insets.bottom, 12) + 12 },
            ]}
            onPress={() => {}}
          >
            <View style={s.sheetGrip} />
            <Text style={s.sheetTitle}>Background sound</Text>
            {/* Drie standen, geen schuifregelaar. Die vraagt een extra pakket,
                is lastig te raken terwijl je ademt, en het verschil tussen
                0,30 en 0,35 hoort niemand. De stem blijft ongeregeld: die is
                de instructie, en wie die zachter zet mist cues en wijt dat aan
                de app. Het volume van het toestel regelt het geheel al. */}
            <View style={s.levelRow}>
              {(['soft', 'medium', 'loud'] as const).map((l) => {
                const on = l === scapeLevel;
                return (
                  <Pressable
                    key={l}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setScapeLevelLocal(l);
                      setScapeLevel(l);
                    }}
                    style={[
                      s.levelChip,
                      on && { borderColor: st.accent, backgroundColor: st.accentSoft },
                    ]}
                  >
                    <Text
                      style={[
                        s.levelTxt,
                        on && { color: st.accent },
                      ]}
                    >
                      {l.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView style={s.sheetList} showsVerticalScrollIndicator={false}>
            <Pressable
              style={[s.scapeRow, !scape && s.scapeRowOn]}
              onPress={() => pickScape(null)}
            >
              <VolumeX
                size={19}
                color={!scape ? st.accent : 'rgba(255,255,255,0.45)'}
                strokeWidth={2.2}
              />
              <View style={s.scapeText}>
                <Text style={[s.scapeName, !scape && { color: st.accent }]}>
                  Off
                </Text>
                <Text style={s.scapeHint}>Voice and haptics only</Text>
              </View>
            </Pressable>

              {GROUP_ORDER.map((g) => (
                <View key={g}>
                  <Text style={s.scapeGroup}>{g}</Text>
                  {SOUNDSCAPES.filter((x) => x.group === g).map((x) => {
                    const on = x.key === scapeKey;
                    return (
                      <Pressable
                        key={x.key}
                        style={[s.scapeRow, on && s.scapeRowOn]}
                        onPress={() => pickScape(x.key)}
                      >
                        <x.Icon
                          size={19}
                          color={on ? st.accent : 'rgba(255,255,255,0.45)'}
                          strokeWidth={2.2}
                        />
                        <View style={s.scapeText}>
                          <Text
                            style={[s.scapeName, on && { color: st.accent }]}
                          >
                            {x.name}
                          </Text>
                          <Text style={s.scapeHint}>{x.hint}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              <View style={{ height: 18 }} />
            </ScrollView>

            <Pressable
              style={s.modalBtn}
              onPress={() => {
                /* Voorbeluisteren stopt bij het sluiten; hij komt terug bij
                   START. Anders speelt er geluid op een scherm waar niets
                   loopt. */
                if (!running) stopScape();
                setScapeOpen(false);
              }}
            >
              <Text style={s.modalBtnTxt}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Waarom deze lengte ── */}
      <Modal
        visible={infoIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoIdx(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setInfoIdx(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            {infoIdx !== null && (
              <>
                <Text style={s.modalEyebrow}>
                  {DURATIONS[infoIdx].minutes} MIN ·{' '}
                  {fmt(DURATIONS[infoIdx].rounds * CYCLE_S)} ·{' '}
                  {DURATIONS[infoIdx].rounds} ROUNDS
                </Text>
                <Text style={s.modalTitle}>{DURATIONS[infoIdx].name}</Text>
                <Text style={s.modalBody}>{DURATIONS[infoIdx].why}</Text>
                <Text style={s.modalFoot}>
                  There is no single correct length. Pick what fits the
                  moment — a short session you actually do beats a long one
                  you skip.
                </Text>
                <Pressable
                  style={s.modalBtn}
                  onPress={() => setInfoIdx(null)}
                  android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
                >
                  <Text style={s.modalBtnTxt}>Got it</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Sessie afgerond ──────────────────────────────────────────────
          De Buddha is terug (operator, 3 augustus 2026). Hij hoorde bij het
          afsluitscherm van de oude Breath-tab en verdween met dat scherm;
          nu sluit ELKE afgemaakte sessie er weer mee af, net als bij de
          bracelet — dezelfde figuur, dezelfde woorden.

          De vraag om Premium staat er ALLEEN bij de eerste sessie uit de
          onboarding. Binnen de app zelf is dat verkeerd getimed: iemand die
          net vijf minuten heeft geademd verdient een afsluiting, geen
          verkooppraatje. In de onboarding is het wél op zijn plaats, want
          daar is de gratis sessie het aanbod.

          Herkend aan `from=onboarding` in de route, niet aan de toestand:
          welke toestand de onboarding gebruikt kan veranderen, waar de
          gebruiker vandaan komt niet. */}
      <Modal visible={done} transparent animationType="fade">
        <View style={s.modalBackdrop}>
          <View style={s.doneCard}>
            <View style={s.doneStrip} />
            <Image
              source={{ uri: BUDDHA_IMG }}
              resizeMode="contain"
              style={s.doneBuddha}
            />
            <Text style={s.modalEyebrow}>✦ CONGRATULATIONS ✦</Text>
            <Text style={s.modalTitle}>Well done.</Text>
            <Text style={s.modalBody}>
              You completed {rounds} rounds of {st.title}. Carry the
              breath with you.
            </Text>

            {askPremium ? (
              <>
                <Pressable
                  style={s.modalBtn}
                  onPress={() => {
                    dismissDone();
                    router.replace('/subscribe');
                  }}
                  android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
                >
                  <Text style={s.modalBtnTxt}>Continue with Premium</Text>
                </Pressable>
                <Pressable
                  style={s.modalSecondary}
                  onPress={dismissDone}
                  hitSlop={8}
                >
                  <Text style={s.modalSecondaryTxt}>Not yet</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={s.modalBtn}
                onPress={dismissDone}
                android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
              >
                <Text style={s.modalBtnTxt}>I'M DONE</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(st: BreathState) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  stars: { ...StyleSheet.absoluteFillObject },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 12,
    letterSpacing: 3.6,
    color: st.accent,
  },

  scrollView: { flex: 1 },
  /* De ruimte onderaan wordt bij het renderen gezet: FOOTER_H plus de
     toestel-inzet. Een vast getal zou op het ene toestel een gat geven en
     op het andere de laatste kaart afsnijden. */
  scroll: { alignItems: 'center' },
  /* Tijdens de sessie staat het blok GECENTREERD. Bovenaan pakken liet een
     kwart scherm leeg onderaan; gelijk verdelen trok de onderdelen uit
     elkaar. Centreren zet de overgebleven ruimte gelijk boven en onder, en
     omdat het beeldvak een vaste hoogte heeft staat dat blok op elke
     toestand op precies dezelfde plek. */
  /* Tijdens de sessie begint het blok BOVENAAN in plaats van gecentreerd
     (operator, 4 augustus 2026: "de animatie kan nog naar boven"). Met het
     kanalenblok eronder werd het geheel zo hoog dat centreren de figuur naar
     beneden duwde; nu staat hij waar je hem het eerst ziet en valt de
     overgebleven ruimte onderaan. */
  scrollRunning: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 4 },

  /* Eén ritme voor het hele scherm: 6 binnen een blok, 18 tussen blokken,
     26 rond de figuur. Afstanden die per onderdeel apart gekozen zijn
     lezen als rommel, ook als geen enkele afzonderlijk fout is. */
  title: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 27,
    letterSpacing: -0.6,
    color: '#ffffff',
    marginTop: 6,
  },
  tagline: {
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    color: st.accent,
    marginTop: 6,
  },
  desc: {
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.58)',
    textAlign: 'center',
    marginTop: 12,
  },

  /* Het beeld is breder dan het scherm; hier wordt het bijgesneden.
     De marges zijn niet optioneel: zonder ademruimte plakte "SESSION
     DURATION" tegen de onderste blaadjes. Een figuur die het moet hebben
     van rust kan geen tekst tegen zich aan hebben staan. */
  visualWrap: {
    width: SCREEN_W,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 16,
  },

  /* ── Sectielabels ──────────────────────────────────────────────────
     Geen gespatieerde kapitalen meer (operator, 8 augustus 2026). Vette caps
     met 2,6 punt spatiëring waren rond 2019 de standaard voor "premium" en
     lezen nu als sjabloon. Ze schreeuwen bovendien: een label dat vertelt
     WAT er onder staat hoort het stilste element op het scherm te zijn, niet
     het luidste.
     Nu gewone tekst in een licht gewicht en een lager contrast. Hetzelfde
     woord, half zo veel aandacht. */
  sectionEyebrow: {
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    letterSpacing: 0,
    color: 'rgba(255,255,255,0.38)',
  },

  /* ── Voorkeuzes ── */
  durationWrap: { alignItems: 'center', gap: 7 },
  chips: { flexDirection: 'row', gap: 7 },
  chip: {
    width: (SCREEN_W - 28 - 21) / 4,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  chipActive: { borderColor: st.accent, backgroundColor: st.accentSoft },
  /* Breder dan de duurknoppen: hier staat een naam met een ritme erin
     ("Long Exhale 4-2-6"), geen getal van twee tekens. */
  techChip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  techExplain: {
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    /* Randen en marges zitten nu op het omhullende vlak (staticStyles.
       explainWrap), anders licht er straks een strook op die niet om de tekst
       heen valt maar ernaast. */
  },
  techTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
  },
  techPattern: {
    marginTop: 2,
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    letterSpacing: 1.1,
    color: 'rgba(255,255,255,0.5)',
  },
  chipTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 18,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 22,
  },
  chipTxtActive: { color: '#ffffff' },
  chipUnit: {
    fontFamily: BrandFonts.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  chipName: {
    fontFamily: BrandFonts.medium,
    fontSize: 9.5,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.38)',
    marginTop: 1,
  },
  chipNameActive: { color: st.accent },
  exact: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    letterSpacing: 0.1,
    color: 'rgba(255,255,255,0.9)',
  },
  hint: {
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: st.accent,
    marginTop: -2,
  },

  /* ── Voortgang tijdens de sessie ── */
  /* Gecentreerd, zoals het hoort onder een symmetrische figuur — maar op
     twee regels in plaats van de oude vier. De hoogte was nooit de
     boosdoener; dat was de uitsnede van het beeld. */
  progressWrap: { width: SCREEN_W - 28, alignItems: 'center' },
  progressRound: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.46)',
  },
  progressLeft: {
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.2,
    color: '#ffffff',
    marginTop: 3,
  },
  bar: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 9,
    overflow: 'hidden',
  },
  barFill: { height: 3, borderRadius: 2, backgroundColor: st.accent },

  /* ── Ademritme vooraf ── */
  /* Geen rand meer (operator, 8 augustus 2026). Op dit scherm stonden vier
     omkaderde blokken onder elkaar — ritmeknoppen, uitlegvak, duurknoppen,
     patroonkaart. Randen om alles maakt van een rustig scherm een formulier.
     De knoppen HOUDEN hun rand, want die kun je indrukken; wat je alleen
     leest, hoeft geen doos. Afstand doet daar het werk. */
  /* Strakker gezet (8 augustus 2026). De grotere labels van de
     typografieronde maakten de pagina langer en toen viel de onderkant van
     deze kaart weer achter de knop. De ruimte komt hiervandaan en niet uit de
     lettergrootte: leesbaarheid was juist het punt. */
  patternCard: {
    width: SCREEN_W - 28,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    gap: 6,
  },
  cardEyebrow: {
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    letterSpacing: 0,
    color: st.accent,
  },
  phaseRow: { flexDirection: 'row', width: '100%' },
  phaseCol: { flex: 1, alignItems: 'center', gap: 1 },
  phaseSecsSmall: {
    fontFamily: BrandFonts.bold,
    fontSize: 19,
    color: '#ffffff',
    lineHeight: 23,
  },
  phaseName: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    letterSpacing: 0,
    color: 'rgba(255,255,255,0.72)',
  },
  /* Door welke opening je ademt. Stond eerst klein en violet en was
     daardoor niet af te lezen — juist dít is de instructie. */
  phaseVia: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: '#ffffff',
    marginTop: 2,
  },
  phaseViaNone: {
    fontFamily: BrandFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.26)',
    marginTop: 2,
  },
  patternFoot: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.55)',
  },

  /* ── Ritmeblok tijdens de sessie ── */
  rhythmCard: {
    alignItems: 'center',
    /* Ruimer dan eerst: hier staan nu een boog én drie kanalen onder elkaar,
       en alles moet lucht hebben. */
    paddingTop: 16,
    width: SCREEN_W - 28,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  channel: { alignItems: 'center', gap: 3, flex: 1 },
  /* De drie kanalen onder de boog, gelijk verdeeld over de breedte. */
  channelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    marginTop: 14,
  },
  channelLabel: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12,
    color: st.accent,
    marginTop: 2,
  },
  channelState: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: st.accent,
  },
  channelOff: { color: 'rgba(255,255,255,0.3)' },
  /* Nog niet te bedienen: dieper weggezet dan gewoon UIT, zodat het verschil
     tussen "staat uit" en "kan nog niet" zichtbaar is. */
  channelLocked: { color: 'rgba(255,255,255,0.22)' },
  hapticGlyph: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    letterSpacing: -0.5,
  },

  rhythmCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /* Vóór de sessie hoeft dit blok niet zo hoog: er staat geen boog in. */
  rhythmCardIdle: { paddingVertical: 12 },
  idleHint: {
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 4,
  },
  /* Lager dan eerst: in de boog staat nu alleen de tijd, dus die hoort in
     het midden van de boog te hangen en niet tegen de bovenrand. */
  arcOverlay: { position: 'absolute', top: 34, alignItems: 'center' },
  /* De fase-regel onder de boog. Krijgt de volle breedte van het blok, dus
     "EXHALE · MOUTH" past zonder ergens tegenaan te lopen. */
  phaseLine: {
    fontFamily: BrandFonts.bold,
    fontSize: 14,
    letterSpacing: 1.8,
    color: st.accent,
    textAlign: 'center',
    marginTop: 2,
  },
  phaseBig: {
    fontFamily: BrandFonts.bold,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1,
    color: '#ffffff',
  },
  phaseUnit: {
    fontFamily: BrandFonts.semibold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.5)',
  },

  /* ── Bracelet ── */

  /* ── Voet ── */
  footerScrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  /* Vast onderaan, NIET als derde blok in de kolom. Als sibling van de
     ScrollView werd de knop bij tijd en wijle onder de schermrand geduwd —
     dan stond er geen enkele manier meer op het scherm om te beginnen of te
     stoppen. Een vastgezette voet kan niet weggedrukt worden, wat de inhoud
     ook doet. */
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
  },
  /* Bewust lager dan eerst. Een knop van bijna zestig punten hoog domineert
     een scherm dat over rust gaat; vijftig is ruim genoeg om te raken.

     De hoogte staat EXPLICIET, niet via de padding van de tekst erin. Dit
     was de oorzaak van de verdwijnende knop: een LinearGradient die zijn
     hoogte alleen uit een kind haalt, meet met tussenpozen nul en verdwijnt
     dan volledig. Dat verklaart ook waarom END SESSION nooit wegviel — dat
     is een gewone View met rand, geen verloop. */
  /* GEEN `overflow: hidden` met borderRadius eromheen. Dat was de echte
     oorzaak van de verdwijnende knop: een verloop dat door een afgeronde
     ouder geclipt moet worden, komt er op deze renderer soms helemaal niet
     uit. De scrim — hetzelfde verloop, maar zonder clip — verscheen altijd
     wél, en dat verschil wees de weg. De ronding zit nu op het verloop
     zelf, dus er valt niets te clippen. */
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'center',
    paddingHorizontal: 30,
    height: BTN_H,
    borderRadius: BTN_H / 2,
    borderWidth: 1,
  },
  startTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13.5,
    letterSpacing: 2.2,
  },
  endBtn: {
    height: BTN_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  endTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.72)',
  },

  /* ── Uitleg-popup. Eigen vormgeving, geen systeem-alert. ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  modalCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: st.accentSoft,
    backgroundColor: '#141018',
    paddingVertical: 22,
    paddingHorizontal: 22,
    gap: 9,
  },
  modalEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: st.accent,
  },
  modalTitle: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: '#ffffff',
  },
  modalBody: {
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.78)',
  },
  modalFoot: {
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.44)',
    marginTop: 2,
  },
  modalBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: st.accentSoft,
    borderWidth: 1,
    borderColor: st.accent,
  },
  modalBtnTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 13.5,
    letterSpacing: 1.4,
    color: st.accent,
  },
  /* ── Het afsluitscherm ── */
  doneCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: st.accentSoft,
    backgroundColor: '#141018',
    paddingTop: 26,
    paddingBottom: 22,
    paddingHorizontal: 22,
    gap: 9,
    alignItems: 'center',
    overflow: 'hidden',
  },
  /* Een streep in de kleur van de toestand, zoals bij de bracelet. Geeft het
     scherm zijn identiteit terug zonder er een gekleurd vlak van te maken. */
  doneStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: st.accent,
  },
  doneBuddha: { width: 132, height: 132, marginBottom: 2 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '84%',
    backgroundColor: '#141018',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: st.accentSoft,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: '#ffffff',
    marginBottom: 10,
  },
  /* `flexShrink` in plaats van een vrije hoogte. Zonder dit groeit de lijst
     met dertien regels tot voorbij het vel en duwt hij de Done-knop onder de
     navigatiebalk van het toestel — precies wat de operator zag: een knop die
     half onzichtbaar onderaan bleef hangen. Nu krimpt de lijst en houdt de
     knop zijn plek. */
  sheetList: { flexShrink: 1 },
  levelRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  levelChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  levelTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.5)',
  },
  scapeGroup: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.38)',
    marginTop: 16,
    marginBottom: 4,
  },
  scapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scapeRowOn: { borderColor: st.accent, backgroundColor: st.accentSoft },
  scapeText: { flex: 1 },
  scapeName: {
    fontFamily: BrandFonts.semibold,
    fontSize: 14.5,
    color: '#ffffff',
  },
  scapeHint: {
    fontFamily: BrandFonts.regular,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.42)',
    marginTop: 1,
  },
  modalSecondary: { paddingVertical: 12, alignItems: 'center' },
  modalSecondaryTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },

  /* ── Premium-popup ── */
  payCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.28)',
    padding: 22,
    paddingTop: 24,
    overflow: 'hidden',
  },
  payGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 130,
  },
  payEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 2,
    color: Brand.accent,
    marginBottom: 6,
  },
  payClose: { position: 'absolute', top: 12, right: 12, zIndex: 2 },
  payTitle: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 14,
    paddingRight: 26,
  },
  payList: { gap: 9, marginBottom: 18 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payRowTxt: {
    flex: 1,
    fontFamily: BrandFonts.regular,
    fontSize: 13.5,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.78)',
  },
  payTier: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 9,
  },
  payTierMain: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(58,143,255,0.1)',
  },
  payTierLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  paySave: {
    borderRadius: 999,
    backgroundColor: Brand.accent,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  paySaveTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: '#0a0a0a',
  },
  payTierName: {
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    color: '#ffffff',
  },
  payTierPrice: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.7)',
  },
  payBracelet: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    color: Brand.accent,
  },
  });
}
