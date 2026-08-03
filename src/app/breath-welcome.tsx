/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Breath onboarding

   Drie schermen, elk met één taak. Opzet en teksten komen letterlijk van
   de operator (2026-07-30):

     1  WAT DIT IS      "Breathe. Build. Become."
                        "Control your vibe control your life"
                        Haptisch aangedreven bol + icoonrij
                        (TOUCH · SILENT · PRECISE · HANDS-FREE)

     2  HOE JE BEGELEID  "Experience different modes."
        WORDT            "The choice is yours."
                         Vier modi, standaard INFORMATIEF (allemaal
                         dezelfde neutrale stijl). Pas bij aantikken
                         krijgen ze hun eigen kleur en demonstreren ze
                         zichzelf.

     3  DE BRACELET     "World's first Smart Bead Bracelet with
                         synchronized haptic guidance"
                        Eigen scherm — dit is de USP en verdient meer dan
                        een kaartje onderaan scherm 2. Tegelijk houdt het
                        scherm 2 rustig.

   Daarna: één VOLLEDIGE gratis sessie (Calm Control), niet een uitgeklede
   proefversie. De vijf states leven op de Breath-tab zelf, niet hier —
   anders zeg je hetzelfde twee keer.

   Wordt geopend door (tabs)/breath.tsx bij first-run. Setting-vlag
   `breathOnboardingCompletedAt` voorkomt herhaling; Settings →
   Developer heeft een knop om 'm te resetten.
   ───────────────────────────────────────────────────────────────────────── */

import BreathMandala from '@/components/BreathMandala';
import GradientText, {
  SUB_COLORS,
  SUB_POSITIONS,
} from '@/components/GradientText';
import MandalaBackdrop from '@/components/MandalaBackdrop';
import PodPulse from '@/components/PodPulse';
import SelectionGlow from '@/components/SelectionGlow';
import {
  GUIDANCE_MODES,
  type GuidanceMode,
} from '@/components/GuidanceSelector';
import {
  Canvas,
  Group,
  Image as SkiaImage,
  LinearGradient as SkGradient,
  Rect,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import HapticOrb, { BREATH_CYCLE_MS } from '@/components/HapticOrb';
import SplatField from '@/components/SplatField';
import { mandalaCloud } from '@/components/mandala-geometry';
import Starfield from '@/components/Starfield';
import { Brand, BrandFonts } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';
import {
  claimVoiceSource,
  playBreathCue,
  preloadBreathCues,
  setVoiceEnabled,
} from '@/services/breath-voice';
import { setSetting } from '@/utils/settings';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import {
  Clock,
  Gem,
  Leaf,
  Moon,
  Repeat,
  Rss,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Volume2,
  Watch,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const ORB = Math.min(SCREEN_W * 0.96, 440);
/* Scherm 2 heeft onder de animatie nog een titel, een subtitel en vier
   knoppen nodig; vandaar kleiner dan de bol van scherm 1. */
const HERO = Math.min(SCREEN_W * 0.7, 310);
/* De mandala achter de kop. Ruimer dan de tekst zelf, zodat de figuur er
   omheen valt i.p.v. erachter te klemmen. */
const HEADER_MANDALA = Math.min(SCREEN_W * 0.43, 190);
/* De mandala op het slotscherm. Kleiner dan op scherm 1, want daar is ze
   het onderwerp en hier een voorproefje. */
const START_ORB = Math.min(SCREEN_W * 0.52, 230);
/* De bracelet mag buiten de tekstmarge treden — het product is hier het
   onderwerp en formaat telt zwaarder dan uitlijning. */
const BRACELET_W = SCREEN_W + 40;
/* Tekstbreedte binnen `slideArea` (paddingHorizontal 26). Skia-tekst
   centreert zichzelf niet, dus die breedte moet expliciet mee. */
const CONTENT_W = SCREEN_W - 52;

/* Twee tegels naast elkaar binnen de tekstbreedte, met een kier ertussen. */
/* Het raster treedt buiten de tekstmarge: bij deze kaarten telt formaat
   zwaarder dan uitlijning met de kop, want de omschrijving staat ín het
   beeld en is anders niet te lezen. */
/* Kaarten zo groot mogelijk (operator 2026-07-31). Bij twee kolommen is de
   breedte de bindende beperking, dus marge en kier zijn tot het minimum
   teruggebracht. De hoogte wordt óók getoetst, zodat het raster op een klein
   scherm niet onder de knop verdwijnt: wat er na kop, balk en voettekst
   overblijft, gedeeld door twee rijen.

   RESERVED is een ruime schatting van alles wat níét raster is — statusbalk
   en veilige zones bovenaan, de kop met subtitel, en onderaan de puntjes en
   de knop. Liever iets te ruim: een kaart die tien punten kleiner is valt
   niemand op, een kaart die half achter de knop zit wel. */
const GRID_GAP = 6;
const RESERVED = 330;
const TILE = Math.floor(
  Math.min(
    (SCREEN_W - 8 - GRID_GAP) / 2,
    (SCREEN_H - RESERVED - GRID_GAP) / 2,
  ),
);
const GRID_W = TILE * 2 + GRID_GAP;
/* Waar de gloed moet staan, in de coördinaten van het raster. */
const GLOW_CELLS = [0, 1, 2, 3].map((i) => ({
  x: i % 2 === 0 ? 0 : TILE + GRID_GAP,
  y: i < 2 ? 0 : TILE + ROW_GAP,
  w: TILE,
  h: TILE,
}));
/* Bijna de volle tegelbreedte: de animatie IS de kaart, dus lucht eromheen
   gaat ten koste van waar het om draait. */
const TILE_HERO = TILE - 8;
/* Verticale kier tussen de twee rijen. Wordt ook gebruikt om uit te rekenen
   waar de gloed moet staan, dus één plek. */
const ROW_GAP = 6;

/* De signatuur-puls: kort tikje, korte stilte, vollere tik. Twee tikken
   lezen als iets bedoelds; één tik leest als een notificatie. */
const SIGNATURE_PULSE = [0, 18, 62, 46];

/* De woorden lopen sneller dan de adem, maar niet gehaast. Bewust
   losgekoppeld van BREATH_CYCLE_MS: op de ademcyclus duurde één ronde zeven
   seconden en dan ziet een bezoeker die hier even kijkt hooguit één woord
   opkomen. Van 2,7 naar 3,6 seconden gebracht — rustiger, en nog steeds
   alle drie binnen de tijd dat iemand hier is. */
const WORD_CYCLE_MS = 2800;

/* Eén maat voor alle koppen en één voor alle subkoppen. Stonden ze los per
   scherm, dan lopen ze bij elke wijziging weer uit elkaar — en dat gebeurde
   ook (operator 2026-07-31: "kop van pagina 2 lijkt groter dan de rest").

   26 punten is de grootste maat waarop óók de langste kop, "SMART BEAD
   BRACELET", nog binnen de tekstbreedte past. Groter zou die regel
   automatisch laten krimpen, en dan is hij alsnog kleiner dan de rest. */
const HEADER_SIZE = 26;
const HEADER_TRACK = 3.2;
const SUB_SIZE = 12;
const SUB_TRACK = 2.2;

/* Operator-geleverde modus-kaarten (2026-07-31). Dit zijn VOLLEDIGE kaarten:
   foto, kader, label en omschrijving zitten er al in. Ze vervangen dus niet
   de animatie binnen een tegel maar de tegel zelf — daarom staat er in het
   raster geen apart label meer onder.

   Alle vier vierkant sinds 2026-07-31, dus ze vullen hun tegel gelijk. Toch
   `contain` en geen `cover`: mocht er ooit een beeld met een andere
   verhouding tussen komen, dan wordt het geschaald i.p.v. bijgesneden — en
   bijsnijden zou de omschrijving eraf halen. */
const MODE_CARDS: Record<GuidanceMode, string> = {
  voice: 'https://vibezcore-audio.b-cdn.net/images/voice%202.png',
  haptic:
    'https://vibezcore-audio.b-cdn.net/images/smartphone%20haptics.%202png.png',
  both: 'https://vibezcore-audio.b-cdn.net/images/voice%20%2B%20haptics%201.png',
  silent: 'https://vibezcore-audio.b-cdn.net/images/silent%20mode%204png.png',
};

/* Wat de bracelet is, in vijf regels (operator 2026-07-31). Elk met een
   eigen teken, in dezelfde taal als de rest van de onboarding: klein,
   gedempt, op één regel.

   VIBEZCORE in hoofdletters — merkregel, overal en altijd. */
const BRACELET_FEATURES = [
  { key: 'wrist', Icon: Watch, text: 'Haptic guidance through your wrist' },
  { key: 'stone', Icon: Gem, text: 'Premium natural stone design' },
  { key: 'app', Icon: Smartphone, text: 'Powered by the VIBEZCORE app' },
  {
    key: 'personal',
    Icon: SlidersHorizontal,
    text: 'Personalized haptic experiences',
  },
  { key: 'wear', Icon: Clock, text: 'Comfortable all-day wear' },
  { key: 'core', Icon: Sparkles, text: 'Neuroscience based haptic core' },
  { key: 'beads', Icon: Repeat, text: 'Interchangeable bead bracelet' },
] as const;

/* Draagfoto voor scherm 4 (operator 2026-07-31). Staand beeld van 2:3, en
   dat past niet als geheel — op volle breedte zou het anderhalf keer de
   schermhoogte innemen. Het wordt daarom bijgesneden tot een brede band.

   Dat kan hier omdat de pols precies op halve hoogte zit: een gecentreerde
   uitsnede laat de bracelet in beeld en snijdt alleen lucht boven en pols
   onder weg. Dat is ook waar de foto over gaat — hem dragen terwijl je iets
   anders doet. */
const WEAR_H = 176;
const WEAR_IMG =
  'https://vibezcore-audio.b-cdn.net/images/bracelet%20new%20correct.png';

/* De twee gezichten, in TWEE versies — en dat is geen slordigheid.
   AFTASTEN gebeurt op de originele foto: die heeft ruim twee keer zoveel
   detail (1535×1024 tegen 612×408) en zachte overgangen in de schaduw, en
   daar leeft de puntenwolk van.
   TONEN gebeurt op de uitgeknipte versie. De originele draagt een eigen
   zwart vlak dat net niet het zwart van de app is, en dat zie je als een
   rechthoek zodra hij opkomt — een blok op het scherm in plaats van een
   gezicht dat verschijnt. Zonder achtergrond is er geen rand om te verraden. */
const FACES = 'https://vibezcore-audio.b-cdn.net/images/faces.png';
const FACES_CUTOUT =
  'https://vibezcore-audio.b-cdn.net/images/faces-removebg-preview.png';

/* Het ritme van het welkomstscherm. Opgaan en neergaan duren even lang; de
   stilstanden erna zijn wat het beeld leesbaar maakt.

   Vlotter dan eerst (operator, 3 augustus 2026): de overgang mag sneller,
   als hij maar schoon is. Vijf tellen was traag genoeg om te gaan wachten;
   drie en een half leest als een beweging in plaats van een vertraging.
   De stilstand op vol is juist LANGER geworden — dat is het moment waarop de
   foto scherp staat, en daar hoort het oog even te mogen rusten. */
const RISE_MS = 3400;
const FULL_MS = 1900;
const EMPTY_MS = 1100;
const CYCLE_MS = RISE_MS * 2 + FULL_MS + EMPTY_MS;

/* Operator-geleverd productbeeld (transparante achtergrond). */
const BRACELET_IMG =
  'https://vibezcore-audio.b-cdn.net/images/Shattudkite_vzc_fiv%20no%20bg.png';

/* Icoonrij onder de kop. Drie kanalen, geen overlap, past op één regel.
   Eerder stond hier TOUCH · SILENT · PRECISE · HANDS-FREE — dat brak over
   twee regels en mengde categorieën: TOUCH en HANDS-FREE zeiden hetzelfde,
   PRECISE was een kwaliteitsclaim i.p.v. een manier van begeleiden. Deze
   drie zijn wél de kanalen die je op scherm 2 kunt kiezen. */
const TRAITS = [
  { key: 'voice', label: 'VOICE', Icon: Volume2 },
  /* Zelfde teken als op de kaarten van scherm 2: een punt met golven die
     eruit lopen (operator 2026-07-31). Het trillende-telefoontje dat hier
     stond zei iets anders — dat toont het apparaat, dit toont wat je voelt. */
  { key: 'haptics', label: 'HAPTICS', Icon: Rss },
  { key: 'silent', label: 'SILENT', Icon: Moon },
] as const;

export default function BreathWelcomeScreen() {
  const sub = useSubscription();
  const isPro = sub.isPro || sub.hasBracelet;

  const TOTAL = 5;
  const [slide, setSlide] = useState(0);
  const isLast = slide === TOTAL - 1;

  /* Scherm 2 — gekozen modus. Standaard geen enkele actief, zodat de
     knoppen puur informatief ogen tot de gebruiker kiest. */
  const [demoMode, setDemoMode] = useState<GuidanceMode | null>(null);
  const [braceletNote, setBraceletNote] = useState(false);

  /* De stemcues alvast inladen. Op dit scherm speelt één losse cue per tik,
     en een speler die het bestand nog niet heeft blijft stil — in een sessie
     merk je dat niet omdat de tweede cue het wél doet. */
  useEffect(() => {
    preloadBreathCues();
  }, []);

  const finish = () => {
    setSetting('breathOnboardingCompletedAt', Date.now());
  };

  const goNext = () => {
    if (!isLast) {
      setSlide((n) => n + 1);
      return;
    }
    finish();
    if (isPro) {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } else {
      /* Volledige gratis sessie — geen 2-min proefje.
         Sinds 1 augustus 2026 is dat het nieuwe sessiescherm (CALM · Lotus)
         i.p.v. breath-sample: zelfde sessie, maar met duurkeuze, het
         ademritme in beeld en de echte illustratie. */
      router.replace('/breath-session');
    }
  };

  /* Skip zet de vlag BEWUST NIET (operator 2026-07-31: "iedereen die skipt
     of uitlogt en later terugkomt moet altijd terug naar intro"). Alleen wie
     de drie schermen uitloopt is klaar; wegklikken is uitstel, geen keuze.
     Anders raakt iemand die per ongeluk op Skip tikt de intro voorgoed
     kwijt — en die intro is het enige moment waarop we uitleggen wat dit
     product is. */
  const onSkip = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  /* Elke modus demonstreert zichzelf bij het aantikken: je hoort en voelt
     wat je kiest, in plaats van het alleen te lezen. */
  const onPickMode = (m: GuidanceMode) => {
    setDemoMode(m);
    const wantsHaptic = m === 'haptic' || m === 'both';
    const wantsVoice = m === 'voice' || m === 'both';

    if (wantsHaptic) {
      Vibration.vibrate(
        [0, 60, 90, 90, 90, 130, 90, 180, 90, 230, 90, 180, 90, 130],
        false,
      );
    }

    /* De keuze wordt nu BEWAARD, niet alleen toegepast (3 augustus 2026).
       Hier stond enkel `setVoiceEnabled`, en dat is een vlag in het geheugen:
       wie "Silent" of "Smartphone Haptics" koos, kreeg bij de eerstvolgende
       start van de app alsnog een pratende sessie. Het scherm heet "CHOOSE
       YOUR GUIDANCE" en belooft "The choice is yours" — dan moet die keuze
       de app ook overleven.
       `setVoiceEnabled` blijft ernaast staan omdat de demo-cue hieronder
       ONMIDDELLIJK moet klinken; de bewaarde waarde bereikt de dienst pas
       een render later via de root-layout. Beide zetten dezelfde waarde,
       dus er valt niets te winnen of te verliezen. */
    setSetting('voiceCues', wantsVoice);
    setVoiceEnabled(wantsVoice);
    if (wantsVoice) {
      /* De stemdienst geeft het woord aan één scherm tegelijk; wie niet
         geclaimd heeft wordt stilzwijgend genegeerd. Zonder deze regel bleef
         de demo stil zodra de Breath-tab of de bracelet het woord nog had —
         precies wat de operator zag (2026-07-31: "bij aanklikken cards
         gebeurt niets"). */
      claimVoiceSource('breath');
      /* Zonder `force`. Die was nodig zolang de tik alleen een vlag in het
         geheugen zette die de root-layout even later terugdraaide. Nu wordt
         de keuze bewaard en zet de regel hierboven de dienst meteen aan, dus
         er is niets meer om langs te gaan. */
      playBreathCue('inhale', 'nose', 'calm', 'breath');
    }
  };

  /* Hier stond eerder één trilling bij de eerste puls, daarna stilte —
     "anders wordt een intro die blijft trillen irritant". Dat was de
     verkeerde afweging: de haptiek IS het kenmerk (operator 2026-07-31),
     en één keer trillen en dan zwijgen verkoopt geen haptisch product.
     Vuurt nu bij elke ronde van het licht, gelijk met de kop. */
  const onOrbPulse = useCallback(() => {
    Vibration.vibrate(SIGNATURE_PULSE, false);
  }, []);

  const feelOrb = () => {
    Vibration.vibrate(SIGNATURE_PULSE, false);
  };

  /* De knop kondigt aan wat er komt. Na de bracelet volgt het uitleg-scherm,
     dus daar staat niet "Next" maar waar je heen gaat (operator
     2026-07-31). */
  const ctaLabel = isLast
    ? isPro
      ? 'Enter Breath  →'
      : 'Start your first session  →'
    : slide === 2
      ? 'How it works  →'
      : 'Next';

  /* "Maybe later" staat alleen op het slotscherm. Elders zou het naast de
     Skip rechtsboven een tweede uitgang zijn, en twee manieren om hetzelfde
     te doen maken een scherm rommelig. */
  const showMaybeLater = isLast && !isPro;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Ruimte-gevoel: stil sterrenveld achter alles. Eén kleur, lage
         dichtheid, traag individueel fonkelen — diepte, geen decor. */}
      <Starfield width={SCREEN_W} height={SCREEN_H} />

      <View style={s.topbar}>
        <View style={{ flex: 1 }} />
        {/* Waar je bent, op élk scherm. Alleen op het laatste tonen leest als
           een nagedachte; hier weet je vanaf het begin hoe lang het duurt
           (operator 2026-07-31). De puntjes onderaan konden daarmee weg —
           twee voortgangsmeters op één scherm is er één te veel. */}
        <Text style={s.stepEyebrow}>{`STEP ${slide + 1} OF ${TOTAL}`}</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onSkip} hitSlop={14} style={s.skipWrap}>
          <Text style={s.skipTxt}>Skip</Text>
        </Pressable>
      </View>

      <View style={[s.slideArea, slide === 1 && s.slideAreaTop]}>
        {slide === 0 ? (
          <SlideIntro onPulse={onOrbPulse} onTapOrb={feelOrb} />
        ) : slide === 1 ? (
          <SlideGuidance mode={demoMode} onPick={onPickMode} />
        ) : slide === 2 ? (
          <SlideBracelet
            noteVisible={braceletNote}
            onTap={() => setBraceletNote(true)}
          />
        ) : slide === 3 ? (
          <SlideHowItWorks />
        ) : (
          <SlideStart />
        )}
      </View>

      <View style={s.footer}>
        <Pressable
          onPress={goNext}
          android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
          style={s.ctaWrap}
        >
          {/* Een verloop i.p.v. één vlakke kleur (operator 2026-07-31).
             Diagonaal, van een helder hemelsblauw naar een dieper koningsblauw
             — dat geeft de knop volume; één egale vlakke kleur oogt plat. */}
          <LinearGradient
            colors={['#5AA9FF', '#2F6BFF', '#1E4FE0']}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.cta}
          >
            <Text style={s.ctaTxt}>{ctaLabel}</Text>
          </LinearGradient>
        </Pressable>

        {showMaybeLater && (
          <Pressable onPress={onSkip} hitSlop={12} style={s.laterWrap}>
            <Text style={s.laterTxt}>MAYBE LATER</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ── Scherm 1 — wat dit is ────────────────────────────────────────────── */

function SlideIntro({
  onPulse,
  onTapOrb,
}: {
  onPulse: () => void;
  onTapOrb: () => void;
}) {
  /* Eén klok voor het beeld én de kop eronder — daarom staat hij hier en
     niet in het beeldonderdeel. De regel ademt mét de wolk in plaats van
     ernaast, inclusief de stilstanden.

     Rustiger, en met twee STILSTANDEN (operator, 3 augustus 2026). Hiervoor
     gleed de waarde in één beweging op en neer, dus stond het beeld nooit
     vol: je zag de gezichten zich vormen en meteen weer uiteenvallen. Nu
     blijft hij anderhalve seconde boven staan — dát is het moment waarop je
     het gezicht compleet ziet — en een seconde onder, waarin de wolk
     helemaal uiteen is. */
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: RISE_MS, easing: Easing.inOut(Easing.sin) }),
        /* Een ECHTE vertraging, geen beweging naar dezelfde waarde: die laatste
           heeft niets te doen en eindigt meteen, waardoor de stilstand wegviel
           en het gezicht nooit compleet in beeld kwam. */
        withDelay(FULL_MS, withTiming(1, { duration: 1 })),
        withTiming(0, { duration: RISE_MS, easing: Easing.inOut(Easing.sin) }),
        withDelay(EMPTY_MS, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
  }, [breath]);

  /* ── De overgave ────────────────────────────────────────────────────────
     De mandala mag niet verloren gaan, dus hij blijft staan zoals hij is —
     mét zijn lopende lichtje, zijn sterren en zijn eigen adem. De punten
     nemen het van hem over in plaats van zijn plaats in te nemen.

     Dat kan ongemerkt, omdat de wolk halverwege exact ZIJN vorm aanneemt: de
     rozet in punten, op dezelfde straal en op dezelfde plek. Tussen 0.15 en
     0.45 vervaagt de getekende figuur terwijl de puntenversie opkomt, en op
     het moment dat de wissel klaar is staan ze allebei op precies dezelfde
     vorm. Pas daarna morphen de punten door naar de gezichten.

     Omlaag gebeurt hetzelfde in omgekeerde volgorde, dus je eindigt weer bij
     de mandala waar je begon. */
  const orbFade = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.max(0, (breath.value - 0.06) / 0.22)),
  }));
  /* De punten dragen het middenstuk. Ze komen op zodra de rozet wegvalt en
     gaan zelf weg zodra de foto het overneemt — nooit alle drie tegelijk in
     beeld, want dan zie je lagen in plaats van één beweging. */
  const dustFade = useAnimatedStyle(() => {
    const inn = Math.min(1, Math.max(0, (breath.value - 0.06) / 0.22));
    const out = Math.min(1, Math.max(0, (breath.value - 0.72) / 0.2));
    return { opacity: inn * (1 - out) };
  });
  /* En op het hoogtepunt de FOTO zelf. Punten alleen blijven een schets;
     de operator wil aan het eind het echte beeld zien. Hij komt op precies
     wanneer de wolk al in de vorm van de gezichten staat, dus je ziet geen
     tweede beeld verschijnen maar dezelfde vorm scherp worden. */
  const photoFade = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, (breath.value - 0.72) / 0.2)),
  }));

  /* Dezelfde foto die het puntenveld heeft afgetast, nu om te tónen. Skia
     laadt hem één keer en deelt hem; er staat dus geen tweede kopie in het
     geheugen. */
  const facesImg = useImage(FACES);

  /* De regel ademt als GEHEEL. Dat is één beweging op de laag eromheen —
     het besturingssysteem verzet die view, er wordt geen letter opnieuw
     getekend. De vorige beurt-animatie deed het omgekeerde en moest elk
     frame elke letter aanraken; die is eruit, dit blijft.

     Ruimer gezet dan eerst, want naast de lichtband die eroverheen loopt
     mag de ademhaling zelf ook voelbaar zijn. */
  const headBreath = useAnimatedStyle(() => ({
    opacity: 0.78 + breath.value * 0.22,
    transform: [{ scale: 0.985 + breath.value * 0.022 }],
  }));

  return (
    /* Extra ruimte ONDER het blok. Omdat `slideArea` zijn kind centreert,
       schuift het zichtbare deel daardoor omhoog — en dat was nodig, want
       met deze hoge bol bleef er bovenaan merkbaar meer lucht over dan
       onderaan (operator 2026-07-31). */
    <View style={[s.slide, s.slideIntro]}>
      {/* Klein en gedempt: een begroeting hoort niet te concurreren met de
         kop eronder. Die kop draagt de belofte, dit alleen de toon. */}
      <Text style={s.welcome}>WELCOME</Text>

      {/* De twee gezichten in plaats van de bol (operator, 3 augustus 2026).
          Ze ademen op dezelfde klok als de kop eronder — één gedeelde waarde,
          dus de regel en de wolk lopen exact gelijk. De klop die je voelt
          blijft: die hing aan de bol en wordt nu apart aangeslagen, één keer
          per ademcyclus. */}
      {/* Twee lagen op elkaar, even groot en op dezelfde plek: de mandala
          zoals hij was, en de puntenwolk die hem overneemt. */}
      <Pressable onPress={onTapOrb} style={{ width: ORB, height: ORB }}>
        <Animated.View style={[StyleSheet.absoluteFill, orbFade]}>
          {/* Op ONZE ademwaarde, niet op zijn eigen. Anders zet de rozet uit
              terwijl de punten al krimpen en klopt de beweging niet meer. */}
          <HapticOrb size={ORB} breath={breath} onPulse={onPulse} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, dustFade]}>
          <SplatField
            orderedUris={[FACES]}
            /* De mandala is waar de punten VANDAAN komen. Als meetkunde en
               niet als afbeelding — zie mandalaCloud. */
            midBuilder={mandalaCloud}
            modeUri={FACES}
            breath={breath}
            size={ORB}
            color="#7FB2FF"
          />
        </Animated.View>
        {/* De foto zelf, op het hoogtepunt.

            Niet als gewone afbeelding maar OPTELLEND gemengd. De originele
            foto draagt een eigen zwart vlak dat net niet het zwart van de app
            is; als gewone afbeelding zie je dus een rechthoek opkomen in
            plaats van een gezicht. Optellend gemengd voegt zwart niets toe —
            het vlak verdwijnt volledig en alleen de gezichten lichten op.

            Daarmee kan de ORIGINELE gebruikt worden en niet de uitgeknipte:
            die laatste is 612×408 en wordt zacht zodra hij op bijna duizend
            beeldpunten breed staat, precies op het moment dat het beeld
            scherp hóórt te zijn. De originele heeft 1535×1024 en houdt zijn
            detail, zonder uitknipranden.

            `fit="contain"` is exact dezelfde inpassing als waarmee het
            puntenveld is afgetast, dus de gezichten van de foto vallen
            samen met die van de wolk. */}
        <Animated.View style={[StyleSheet.absoluteFill, photoFade]}>
          <Canvas style={{ width: ORB, height: ORB }}>
            {facesImg && (
              <Group>
                <SkiaImage
                  image={facesImg}
                  x={0}
                  y={0}
                  width={ORB}
                  height={ORB}
                  fit="contain"
                  blendMode="plus"
                />
                {/* De hals loopt uit in zwart.

                    De foto houdt onderaan gewoon op: schouders, dan een
                    rechte rand. Op een zwart scherm leest dat als een
                    afgesneden beeld en niet als een gezicht dat uit het
                    donker komt — en het maakt het geheel hard, precies zoals
                    de operator zei.

                    Dit is geen zwart vlak eroverheen: `dstIn` gumt weg wat
                    hier doorzichtig is, dus de foto zelf lóst op. Een vlak
                    zou de sterren erachter meedoven; nu blijft alles
                    eromheen intact.

                    De grenzen volgen de foto: bij verhouding 1535×1024 in een
                    vierkant vak staat het beeld tussen 0.17 en 0.83, en de
                    hals begint rond driekwart. Vandaar 0.66 tot 0.86. */}
                <Rect
                  x={0}
                  y={0}
                  width={ORB}
                  height={ORB}
                  blendMode="dstIn"
                >
                  <SkGradient
                    start={vec(0, 0)}
                    end={vec(0, ORB)}
                    colors={['white', 'white', 'transparent']}
                    positions={[0, 0.66, 0.86]}
                  />
                </Rect>
              </Group>
            )}
          </Canvas>
        </Animated.View>
      </Pressable>

      {/* Wit, met één schuine blauwe lichtband erdoorheen die naar rechts
         volledig blauw wordt. Niet losse woorden blauw kleuren — het blauw
         hoort bij het licht, niet bij de letters. De drie woorden komen om
         de beurt naar voren, één ronde per ademcyclus, dus de golf door de
         regel loopt gelijk met de golf door de ring. */}
      <Animated.View style={[s.headlineWrap, headBreath]}>
        <GradientText
          text="BREATHE. BUILD. BECOME"
          size={23}
          width={CONTENT_W}
          weight="regular"
          tracking={3.6}
          stagger
          cycleMs={WORD_CYCLE_MS}
        />
      </Animated.View>

      {/* Tagline draagt de merkbelofte: één regel, wit, dezelfde schuine
         band eroverheen. */}
      {/* Twee regels i.p.v. één. Op één regel met kapitalen en ruime
         letterafstand valt de punt in het midden weg en lees je het als één
         lange zin; zo staan de twee beloftes duidelijk náást elkaar. Geen
         punt aan het eind — koppen zijn labels, geen zinnen. */}
      <GradientText
        text="CONTROL YOUR VIBE"
        size={SUB_SIZE}
        width={CONTENT_W * 0.94}
        weight="regular"
        colors={SUB_COLORS}
        positions={SUB_POSITIONS}
        tracking={SUB_TRACK}
        style={s.taglineWrap}
      />
      <GradientText
        text="CONTROL YOUR LIFE"
        size={SUB_SIZE}
        width={CONTENT_W * 0.94}
        weight="regular"
        colors={SUB_COLORS}
        positions={SUB_POSITIONS}
        tracking={SUB_TRACK}
        style={s.taglineLine2}
      />

      <View style={s.traits}>
        {TRAITS.map(({ key, label, Icon }, i) => (
          <View key={key} style={s.traitItem}>
            {i > 0 && <View style={s.traitDivider} />}
            <Icon size={13} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
            <Text style={s.traitTxt}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── Scherm 2 — hoe je begeleid wordt ─────────────────────────────────── */

function SlideGuidance({
  mode,
  onPick,
}: {
  mode: GuidanceMode | null;
  onPick: (m: GuidanceMode) => void;
}) {
  const activeIndex = GUIDANCE_MODES.findIndex((m) => m.key === mode);
  const activeCfg = GUIDANCE_MODES[activeIndex];

  /* Zelfde ademhaling als op scherm 1, op dezelfde klok. Eén beweging op de
     laag eromheen; de letters blijven onaangeroerd. */
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, {
        duration: BREATH_CYCLE_MS / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [breath]);

  const titleBreath = useAnimatedStyle(() => ({
    opacity: 0.82 + breath.value * 0.18,
    transform: [{ scale: 0.99 + breath.value * 0.016 }],
  }));

  return (
    <View style={s.slide}>
      {/* Kapitalen op LICHT gewicht met ruime letterafstand, naar de
         referentie van de operator (2026-07-31). Dat is een andere school
         dan zwaar-en-strak: het gewicht doet niets, de ruimte doet alles.
         Twee regels, want zo blijven de letters groot genoeg om dat te
         dragen — op één regel zou hij tot ruim de helft moeten krimpen.

         De mandala staat erachter als decor: haarlijnen op lage dekking,
         traag draaiend, zonder de gevulde maanvorm — die zou precies achter
         de tekst komen en die onleesbaar maken. */}
      <View style={s.titleBlock}>
        <MandalaBackdrop size={HEADER_MANDALA} />
        <Animated.View style={[s.titleLines, titleBreath]}>
          <GradientText
            text="CHOOSE YOUR"
            size={HEADER_SIZE}
            width={CONTENT_W}
            weight="regular"
            tracking={HEADER_TRACK}
            sweep
            cycleMs={WORD_CYCLE_MS}
          />
          <GradientText
            text="GUIDANCE"
            size={HEADER_SIZE}
            width={CONTENT_W}
            weight="regular"
            tracking={HEADER_TRACK}
            sweep
            cycleMs={WORD_CYCLE_MS}
            style={s.titleLine2}
          />
        </Animated.View>
      </View>
      {/* Smaller meegegeven dan de kop, zodat de subtitel er nooit breder
         uit kan komen — ook niet als de tekst ooit verandert. */}
      <GradientText
        text="YOUR BREATH. YOUR RHYTHM. YOUR CHOICE"
        size={SUB_SIZE}
        width={CONTENT_W * 0.94}
        weight="regular"
        colors={SUB_COLORS}
        positions={SUB_POSITIONS}
        tracking={SUB_TRACK}
        style={s.subWrap}
      />

      {/* Geen uitvergroting meer: de omschrijving staat nu groot genoeg in
         de beelden zelf, dus een tweede scherm voegde niets toe behalve een
         extra tik (operator 2026-07-31). Aantikken kiest en licht op. */}
      <View style={s.grid}>
        {/* Eén gloed die naar de gekozen kaart toe schuift, in de kleur van
           die kaart zelf. Dat maakt de keuze zichtbaar i.p.v. hem alleen aan
           te wijzen — en het scheelt drie vervaagde vlakken die toch
           onzichtbaar zouden zijn. */}
        <SelectionGlow
          cells={GLOW_CELLS}
          activeIndex={activeIndex}
          color={activeCfg?.color ?? '#ffffff'}
        />
        {GUIDANCE_MODES.map((m) => (
          <ModeTile
            key={m.key}
            cfg={m}
            active={m.key === mode}
            onPress={() => onPick(m.key)}
          />
        ))}
      </View>
    </View>
  );
}

/* Eén kaart. Eigen component omdat de selectie hooks vraagt.

   De selectie is bewust méér dan een randje: een WITTE halo achter de kaart,
   de kaart zelf op volle helderheid terwijl de andere drie wegzakken, en een
   zachte opschaling. Wit en niet de moduskleur — de kaarten zijn al blauw,
   en nóg meer blauw laat de selectie juist verdwijnen (operator 2026-07-31).

   React Native kent geen echte gloed op Android; twee gestapelde afgeronde
   vlakken die iets buiten de kaart uitsteken geven dezelfde zachte rand voor
   vrijwel niets. */
function ModeTile({
  cfg,
  active,
  onPress,
}: {
  cfg: (typeof GUIDANCE_MODES)[number];
  active: boolean;
  onPress: () => void;
}) {
  const sel = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    sel.value = withTiming(active ? 1 : 0, {
      duration: 340,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, sel]);

  /* Welke kaart actief is moet in één oogopslag duidelijk zijn (operator
     2026-07-31). Drie signalen die samenwerken, want de beelden hebben zélf
     al een gekleurd kader en één enkel signaal verdrinkt daarin:
       - de kaart schaalt op en komt naar voren
       - een dunne rand in de kleur van de modus, ÓVER het beeld heen
       - de corona erachter, die naar deze kaart toe schuift
     Het vinkje is eruit: met drie signalen was dat er één te veel, en een
     badge is nu eenmaal een sticker op een foto (operator 2026-07-31).

     De rand is bewust dun en niet vol: subtiel en elegant, geen keuzevakje.
     De niet-gekozen kaarten zakken licht terug — niet ver, want op 55% werd
     het hele scherm te donker. */
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.982 + sel.value * 0.038 }],
    opacity: 0.8 + sel.value * 0.2,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: sel.value * 0.8,
    borderColor: cfg.color,
  }));


  return (
    <Pressable onPress={onPress} style={s.tileWrap}>
      <Animated.View style={cardStyle}>
        <Image
          source={{ uri: MODE_CARDS[cfg.key] }}
          style={s.tileImg}
          resizeMode="contain"
        />
        <Animated.View style={[s.tileRing, ringStyle]} pointerEvents="none" />
      </Animated.View>
    </Pressable>
  );
}

/* ── Scherm 3 — de bracelet ───────────────────────────────────────────── */

function SlideBracelet({
  noteVisible,
  onTap,
}: {
  noteVisible: boolean;
  onTap: () => void;
}) {
  return (
    <View style={s.slide}>
      {/* Zelfde opzet als scherm 2: kapitalen op licht gewicht met ruime
         letterafstand, met de mandala als decor erachter. */}
      {/* Omgedraaid (operator, 3 augustus 2026): de PRODUCTNAAM staat boven,
          de belofte eronder. Zo stond het als enige scherm andersom — de
          overige vier zetten hun kop eerst. En belangrijker: dit scherm gaat
          over een product dat nog niemand kent. Dan moet eerst vaststaan
          waar je naar kijkt, en pas daarna wat het voor je doet. */}
      <View style={s.titleBlock}>
        <MandalaBackdrop size={HEADER_MANDALA} />
        <GradientText
          text="SMART BEAD BRACELET"
          size={HEADER_SIZE}
          width={CONTENT_W}
          weight="regular"
          tracking={HEADER_TRACK}
        />
        <GradientText
          text="QUIET GUIDANCE THROUGH THE WRIST"
          size={SUB_SIZE}
          width={CONTENT_W}
          weight="regular"
          colors={SUB_COLORS}
          positions={SUB_POSITIONS}
          tracking={SUB_TRACK}
          style={s.braceletSubLine}
        />
      </View>

      {/* Geen gouden gloed meer erachter: die maakte er een vlak van waarop
         het product LAG. Zonder dat vlak zweeft het in dezelfde ruimte als
         de rest van de onboarding (operator 2026-07-31). */}
      <Pressable onPress={onTap} style={s.braceletImgWrap}>
        {/* `cover` en niet `contain`. Het bestand is VIERKANT met veel lege
           ruimte boven en onder de bracelet, en bij `contain` bepaalt in een
           breed vak de hoogte hoe groot het beeld wordt — die lege ruimte
           telt dan mee en drukt het product klein. `cover` schaalt op de
           breedte en snijdt boven en onder weg; dat is precies de lege
           ruimte. Het product wordt daardoor ruim 40% groter zonder dat het
           vak groeit (operator 2026-07-31). */}
        <Image
          source={{ uri: BRACELET_IMG }}
          style={s.braceletImg}
          resizeMode="cover"
        />
        {/* De haptische klop komt uit het zwarte kastje, iets onder het
           midden van het beeld. */}
        <PodPulse
          width={BRACELET_W}
          height={BRACELET_W * 0.7}
          originY={0.605}
          reach={0.085}
          intensity={2.4}
        />
      </Pressable>

      <View style={s.features}>
        {BRACELET_FEATURES.map(({ key, Icon, text }) => (
          <View key={key} style={s.featureRow}>
            <Icon size={15} color="#7FB2FF" strokeWidth={2} />
            <Text style={s.featureTxt}>{text}</Text>
          </View>
        ))}
      </View>

      <View style={s.comingPill}>
        <Text style={s.comingTxt}>COMING FALL 2026</Text>
      </View>

      {noteVisible && (
        <Text style={s.braceletNote}>
          The rhythm moves from your screen to your wrist. Silent,
          invisible, hands-free.
        </Text>
      )}
    </View>
  );
}

/* ── Scherm 4 — hoe het werkt ─────────────────────────────────────────── */

/* Drie stappen, in de volgorde waarin een gebruiker ze doorloopt. Labels in
   kapitalen zonder punt (het zijn labels), de uitleg eronder als gewone zin
   mét punt. VIBEZCORE in hoofdletters — merkregel. */
const HOW_STEPS = [
  { key: 'connect', label: 'CONNECT', text: 'Pair your bracelet once.' },
  {
    key: 'choose',
    label: 'CHOOSE',
    text: 'Select any breathing session in the VIBEZCORE app.',
  },
  {
    key: 'feel',
    label: 'FEEL',
    text: 'Every inhale, hold and exhale is delivered through precise haptic guidance.',
  },
] as const;

function SlideHowItWorks() {
  return (
    <View style={s.slide}>
      <View style={s.titleBlock}>
        <MandalaBackdrop size={HEADER_MANDALA} />
        <GradientText
          text="HOW IT WORKS"
          size={HEADER_SIZE}
          width={CONTENT_W}
          weight="regular"
          tracking={HEADER_TRACK}
        />
        {/* De twee regels horen bij elkaar en bij de kop: strak eronder,
           met nauwelijks lucht ertussen. Stonden ze verder uit elkaar, dan
           lazen ze als twee losse mededelingen (operator 2026-07-31). */}
        <GradientText
          text="ALWAYS WITH YOU. NEVER IN THE WAY"
          size={SUB_SIZE}
          width={CONTENT_W * 0.94}
          weight="regular"
          colors={SUB_COLORS}
          positions={SUB_POSITIONS}
          tracking={SUB_TRACK}
          style={s.howSub1}
        />
      </View>

      <View style={s.wearWrap}>
        {/* Groter dan de kaart en naar links geschoven: zo komt de pols meer
           naar het midden i.p.v. rechts weg te vallen. Zonder die overmaat
           valt er niets te schuiven — een precies passende uitsnede heeft
           geen speling. */}
        <Image
          source={{ uri: WEAR_IMG }}
          style={s.wearImg}
          resizeMode="cover"
        />
        <PodPulse
          width={CONTENT_W}
          height={WEAR_H}
          originX={0.4}
          originY={0.49}
          reach={0.11}
          intensity={2.4}
        />
      </View>

      {/* Onder de foto eerst de belofte, dan pas waar je hem draagt. Die
         volgorde werkt beter: wat het je oplevert weegt zwaarder dan waar
         het kan, en de kapitalen maken er een uitspraak van in plaats van
         een zin (operator 2026-07-31). */}
      <Text style={s.howClaim}>ALWAYS AVAILABLE. PRIVATE. PERSONAL.</Text>
      <Text style={s.howWhen}>
        Work. Travel. Walk. Commute. Study. Pause.
      </Text>

      <View style={s.howSteps}>
        {HOW_STEPS.map(({ key, label, text }, i) => (
          <View key={key} style={s.howStep}>
            <View style={s.howNumWrap}>
              <Text style={s.howNum}>{i + 1}</Text>
            </View>
            <View style={s.howStepText}>
              <Text style={s.howLabel}>{label}</Text>
              <Text style={s.howDesc}>{text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── Scherm 5 — de eerste sessie ──────────────────────────────────────── */

/* Wat de gratis sessie inhoudt, in drie regels. Volgorde uit de referentie
   van de operator: eerst wat je krijgt, dan hoe het voelt, dan wat het
   kost — dat laatste is niets, en dat hoort als laatste indruk te blijven
   hangen. */
const START_POINTS = [
  {
    key: 'full',
    Icon: Clock,
    label: 'FULL SESSION',
    text: 'Experience a complete breathing journey.',
  },
  {
    key: 'haptic',
    Icon: Rss,
    label: 'HAPTIC GUIDANCE',
    text: 'Feel every breath with subtle vibrations.',
  },
  {
    key: 'free',
    Icon: Leaf,
    label: 'NO COMMITMENT',
    text: "Explore freely. Upgrade when you're ready.",
  },
] as const;

function SlideStart() {
  return (
    <View style={s.slide}>
      {/* Geen mandala achter deze kop: er staat er al een groot exemplaar
         onder, en twee keer dezelfde figuur op één scherm vecht met zichzelf
         (operator 2026-07-31). */}
      <View style={s.titleBlockPlain}>
        <GradientText
          text="START YOUR"
          size={HEADER_SIZE}
          width={CONTENT_W}
          weight="regular"
          tracking={HEADER_TRACK}
        />
        <GradientText
          text="FIRST SESSION"
          size={HEADER_SIZE}
          width={CONTENT_W}
          weight="regular"
          tracking={HEADER_TRACK}
          style={s.titleLine2}
        />
      </View>

      <Text style={s.startLead}>
        Begin your journey with a free trial session.
      </Text>
      <Text style={s.startLead2}>
        Feel the rhythm. Experience the shift.
      </Text>

      {/* De mandala uit scherm 1, klein. Hier is ze geen decor maar een
         belofte: dit is wat er straks op je scherm staat. */}
      <View style={s.startOrb}>
        <BreathMandala size={START_ORB} />
      </View>

      <View style={s.startPoints}>
        {START_POINTS.map(({ key, Icon, label, text }) => (
          <View key={key} style={s.startPoint}>
            <View style={s.startIconWrap}>
              <Icon size={16} color="#7FB2FF" strokeWidth={2} />
            </View>
            <View style={s.startPointText}>
              <Text style={s.startLabel}>{label}</Text>
              <Text style={s.startDesc}>{text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  skipWrap: { paddingVertical: 6, paddingHorizontal: 8 },
  skipTxt: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 15,
  },

  slideArea: {
    flex: 1,
    paddingHorizontal: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: { alignItems: 'center', width: '100%' },
  /* Scherm 2 begint bovenaan i.p.v. gecentreerd: met vier grote kaarten is
     er onderaan toch geen ruimte over, en de kop hoort bovenaan te staan. */
  slideAreaTop: { justifyContent: 'flex-start', paddingTop: 4 },
  /* Geen extra hoogte meer: het blok wordt gecentreerd, dus boven en onder
     valt evenveel ruimte. Dat is wat de figuur laat zweven — hem omhoog
     duwen liet een lege band onderaan achter. */
  slideIntro: {},
  welcome: {
    marginTop: -26,
    marginBottom: 16,
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    letterSpacing: 5,
  },
  grid: {
    marginTop: 42,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: GRID_W,
  },
  tileWrap: { width: TILE, marginBottom: ROW_GAP },
  tileImg: { width: TILE, height: TILE, borderRadius: 22 },
  tileRing: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  titleWrap: { marginTop: 16 },
  /* De mandala vult dit blok en ligt eronder; de hoogte volgt de tekst. */
  titleBlock: {
    marginTop: 10,
    width: CONTENT_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleLines: { alignItems: 'center' },
  titleLine2: { marginTop: -2 },
  subWrap: { marginTop: 16 },

  /* Scherm 1 — kop en tagline zijn Skia-tekst (GradientText); die brengen
     hun eigen hoogte mee, hier alleen de ruimte ertussen. */
  headlineWrap: { marginTop: 14 },
  taglineWrap: { marginTop: 12 },
  taglineLine2: { marginTop: 3 },
  traits: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    flexWrap: 'wrap',
  },
  traitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
  },
  traitDivider: {
    width: 1,
    height: 11,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginRight: 9,
  },
  traitTxt: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 1.4,
  },

  /* Scherm 2 */
  title: {
    marginTop: 14,
    color: Brand.text,
    fontFamily: BrandFonts.bold,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  selectorWrap: {
    marginTop: 20,
    alignSelf: 'stretch',
    marginHorizontal: -26,
  },

  /* Scherm 3 */
  /* Strak onder de kop, zoals de subtitels op de andere schermen. */
  braceletSubLine: { marginTop: 4 },
  braceletImgWrap: {
    marginTop: -6,
    width: BRACELET_W,
    height: BRACELET_W * 0.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  features: { marginTop: 2, gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureTxt: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: BrandFonts.medium,
    fontSize: 13.5,
    letterSpacing: 0.1,
  },
  braceletImg: { width: '100%', height: '100%' },
  comingPill: {
    marginTop: 16,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(224,179,65,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(224,179,65,0.36)',
  },
  comingTxt: {
    color: '#E0B341',
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 1.6,
  },
  braceletTitle: {
    marginTop: 16,
    color: Brand.text,
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  braceletNote: {
    marginTop: 12,
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 300,
  },

  /* Scherm 4 */
  howSub1: { marginTop: 6 },
  wearWrap: {
    marginTop: 66,
    width: CONTENT_W,
    height: WEAR_H,
    borderRadius: 18,
    overflow: 'hidden',
  },
  wearImg: {
    width: CONTENT_W * 1.3,
    height: '100%',
    marginLeft: -CONTENT_W * 0.18,
  },
  howWhen: {
    marginTop: 12,
    maxWidth: CONTENT_W,
    color: 'rgba(255,255,255,0.82)',
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  /* Groter, strakker en dunner dan de regel erboven: dat is wat een claim
     laat staan zonder te schreeuwen. Licht gewicht met wat letterafstand
     leest als rust; vet zou het een reclamekreet maken. */
  howClaim: {
    marginTop: 26,
    maxWidth: CONTENT_W,
    color: '#ffffff',
    fontFamily: BrandFonts.regular,
    fontSize: 16,
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  howSteps: { marginTop: 32, gap: 17, width: CONTENT_W },
  howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  howNumWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(127,178,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNum: {
    color: '#7FB2FF',
    fontFamily: BrandFonts.bold,
    fontSize: 11,
  },
  howStepText: { flex: 1 },
  howLabel: {
    color: '#7FB2FF',
    fontFamily: BrandFonts.bold,
    fontSize: 11.5,
    letterSpacing: 2,
  },
  howDesc: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.78)',
    fontFamily: BrandFonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
  },

  /* Scherm 5 */
  stepEyebrow: {
    marginTop: 2,
    color: '#7FB2FF',
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 2.6,
  },
  startLead: {
    marginTop: 12,
    maxWidth: CONTENT_W,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: BrandFonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  startLead2: {
    marginTop: 2,
    maxWidth: CONTENT_W,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: BrandFonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  titleBlockPlain: { width: CONTENT_W, alignItems: 'center' },
  startOrb: { marginTop: 10, marginBottom: 10 },
  startPoints: { width: CONTENT_W, gap: 14 },
  startPoint: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  startIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(127,178,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startPointText: { flex: 1 },
  startLabel: {
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
    fontSize: 11.5,
    letterSpacing: 1.8,
  },
  startDesc: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.66)',
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  laterWrap: { alignSelf: 'center', paddingVertical: 4 },
  laterTxt: {
    color: '#7FB2FF',
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 2,
  },

  /* Footer */
  /* De veilige zone wordt al door SafeAreaView afgetrokken; dit is de marge
     dáárbovenop. Twintig punten was krap: op een toestel met een gebaarbalk
     komt de knop dan vlak tegen die balk aan te liggen en tikt je duim er
     net naast (operator 2026-07-31). */
  footer: { paddingHorizontal: 26, paddingBottom: 32, gap: 18 },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  cta: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
