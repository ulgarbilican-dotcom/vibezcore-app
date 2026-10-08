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

import GradientText, {
  SUB_COLORS,
  SUB_POSITIONS,
} from '@/components/GradientText';
import {
  claimFreeSessionParam,
  skipBreathOnboardingRedirectOnce,
} from '@/utils/breath-entry';
import {
  GUIDANCE_MODES,
  ModeGlyph,
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
import { useAssetUri } from '@/services/asset-cache';
import {
  BREATH_ONBOARDING_BRACELET_TEASER_IMG,
  FACES_URL,
} from '@/services/offline-assets';
import { Brand, BrandFonts, TypeScale } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';
import {
  claimVoiceSource,
  playBreathCue,
  preloadBreathCues,
  setVoiceEnabled,
  setVoiceGenderOverride,
} from '@/services/breath-voice';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { GOALS, MAX_GOALS, type Goal } from '@/data/goals';
import { bestSlotsForCount, pickStatesForDay, reasonForPick, slotForHour } from '@/utils/day-plan';
import { getSetting, setSetting, type ExperienceLevel } from '@/utils/settings';
import RhythmRing, { type RhythmRingItem } from '@/components/RhythmRing';
import { SLOTS } from '@/services/reminders';
import { INTENSITY_SESSION_COUNT, RECOMMENDED_INTENSITY } from '@/utils/protocol';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  Check,
  ChevronLeft,
  Info,
  Moon,
  MoonStar,
  Rss,
  Sparkles,
  Target,
  Volume2,
  Waves,
  Zap,
} from 'lucide-react-native';
import { STATE_GLYPH_ICONS } from '@/components/ModeGlyph';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
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
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const ORB = Math.min(SCREEN_W * 0.96, 440);
/* Scherm 2 heeft onder de animatie nog een titel, een subtitel en vier
   knoppen nodig; vandaar kleiner dan de bol van scherm 1. */
const HERO = Math.min(SCREEN_W * 0.7, 310);
/* De mandala achter de kop. Ruimer dan de tekst zelf, zodat de figuur er
   omheen valt i.p.v. erachter te klemmen. */
/* 0.43/190 -> 0.34/150 (operator, 10 augustus 2026: "blokken naar boven",
   voor de derde keer gevraagd). De mandala is decor achter de kop, geen
   onderwerp — hij mag kleiner zonder iets te verliezen, en dat scheelt op
   ELK scherm dat een titleBlock heeft (vier van de zes). */
const HEADER_MANDALA = Math.min(SCREEN_W * 0.34, 150);
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
/* Operator, 22 september 2026 ("kaarten mogen beetje kleiner zodat ze
   meer ademruimte hebben"): de foto-tegels van 2026-07-31 wilden zo groot
   mogelijk (geen eigen lucht nodig, de foto droeg alles) — nu het matglas-
   kaarten met een icoon zijn (zie `ModeTile`), passen ruimere kieren en
   een iets kleiner formaat beter bij de rest van de app. `TILE_SHRINK`
   krimpt het berekende formaat, `GRID_GAP`/`ROW_GAP` gingen omhoog. */
const TILE_SHRINK = 0.88;
const GRID_GAP = 14;
const RESERVED = 330;
const TILE = Math.floor(
  Math.min(
    (SCREEN_W - 8 - GRID_GAP) / 2,
    (SCREEN_H - RESERVED - GRID_GAP) / 2,
  ) * TILE_SHRINK,
);
const GRID_W = TILE * 2 + GRID_GAP;
/* Verticale kier tussen de twee rijen. */
const ROW_GAP = 14;

/* Stap 3 (operator, 22 september 2026: "carrousel op stap 3 moet weg, we
   bouwen dat op zoals in de build-breathwork-protocol"): verving de
   horizontale kaarten-carrousel (één grote foto-kaart, doorbladerbaar) —
   die verwarde ("waarom is dat zo moeilijk om te begrijpen") omdat het een
   heel ander patroon was dan de rest van de app. Nu exact hetzelfde
   bento-grid als `goal.tsx`'s "Set your state" (de echte protocol-
   opbouwpagina): 2 kolommen, matglas-tegels, icoon + naam, geselecteerd =
   genummerde badge (1/2) + `Goal.gradient`. Enige verschil met goal.tsx:
   ALLE 8 tegels dezelfde (compacte) maat i.p.v. 2 grote + 6 compacte — dit
   scherm mag niet scrollen (harde regel, zie de `slideArea`-toelichting
   verderop), en 8 gelijke tegels passen daar waar 2 grote tegels dat
   budget al te veel zouden opeisen. */

/* Nieuwe stap 4: drie liggende fotokaarten onder elkaar (operator, 6
   september 2026, mockup: "New to breathwork") — RESERVED-logica zoals
   hierboven, alleen door drie gedeeld i.p.v. één grote kaart. */
const EXP_RESERVED = 420;
const EXP_GAP = 14;
const EXP_CARD_H = Math.floor((SCREEN_H - EXP_RESERVED - EXP_GAP * 2) / 3);

/* Operator, 11 september 2026: nieuwe fotoset (3 losse beelden i.p.v. de
   vorige 3 liggende kaarten) — "eerst 2 vierkanten, laatste (Experienced)
   panoramisch eronder, zodat het een mooi blok vormt", vierkanten exact
   even groot als stap 2's kaarten. Derde correctie: de vorige poging gaf
   de rij een eigen `EXP_GAP` (14px) i.p.v. stap 2's `GRID_GAP` (6px) —
   dat extra verschil, niet `TILE` zelf, duwde de rij buiten de veilige
   zone. Door hier letterlijk `GRID_W`/`GRID_GAP` te hergebruiken (dezelfde
   twee constanten als stap 2) past de rij vanzelf, zonder `TILE` te
   moeten verkleinen. Panoramische kaart: zelfde breedte als de rij samen
   (`GRID_W`) op `TILE`-hoogte — samen even groot als de 2 vierkanten
   samen. */
const EXP_SQUARE = TILE;
const EXP_PANO_H = TILE;
const EXP_BLOCK_W = GRID_W;

/* De signatuur-puls: kort tikje, korte stilte, vollere tik. Twee tikken
   lezen als iets bedoelds; één tik leest als een notificatie. */
const SIGNATURE_PULSE = [0, 18, 62, 46];

/* De woorden lopen sneller dan de adem, maar niet gehaast. Bewust
   losgekoppeld van BREATH_CYCLE_MS: op de ademcyclus duurde één ronde zeven
   seconden en dan ziet een bezoeker die hier even kijkt hooguit één woord
   opkomen. Van 2,7 naar 3,6 seconden gebracht — rustiger, en nog steeds
   alle drie binnen de tijd dat iemand hier is. */
const WORD_CYCLE_MS = 2800;

/* Nieuwe stap 6 (operator, 7 september 2026, vijfde mockup): foto naar
   rechts (58% van de schermbreedte), tekst links in wat overblijft, min
   de standaard scherm-marge (26) en wat lucht voor de foto. */
/* Operator, 7 september 2026: "foto nog steeds veel te klein, moet
   dubbel zo groot" — tekstkolom nog een keer versmald. */
const LIB_TEXT_W = SCREEN_W * 0.24 - 14;

/* Eén maat voor alle koppen en één voor alle subkoppen. Stonden ze los per
   scherm, dan lopen ze bij elke wijziging weer uit elkaar — en dat gebeurde
   ook (operator 2026-07-31: "kop van pagina 2 lijkt groter dan de rest").

   26 punten is de grootste maat waarop óók de langste kop, "SMART BEAD
   BRACELET", nog binnen de tekstbreedte past. Groter zou die regel
   automatisch laten krimpen, en dan is hij alsnog kleiner dan de rest. */
const SUB_SIZE = 12;
const SUB_TRACK = 2.2;

/* Operator, 22 september 2026 ("iconen moeten eigen transparante blur
   kaarten hebben" → Apple HIG-onderbouwing, verticale lijst i.p.v. raster):
   `MODE_CARDS`/`MODE_IMG_ZOOM` (de foto-tegels van 2026-07-31/11 september)
   zijn weg — `ModeRow` toont nu `ModeGlyph` (`@/components/
   GuidanceSelector`) + een korte omschrijving per modus in een
   selecteerbare lijstrij. */
const MODE_DESCRIPTIONS: Record<GuidanceMode, string> = {
  voice: 'Guided cues, spoken aloud.',
  haptic: 'Silent vibration guides your rhythm.',
  both: 'Voice and vibration together.',
  silent: 'Visual guidance only — no sound or vibration.',
};
/* Operator, 22 september 2026 (Apple HIG, "geen vinkjes maar een
   'luister'-status"): vervangt de omschrijving TIJDELIJK terwijl een rij
   speelt, zie `ModeRow`'s `playing`-tak. */
const MODE_PLAYING_LABEL: Record<GuidanceMode, string> = {
  voice: 'Listening…',
  haptic: 'Feeling…',
  both: 'Listening & feeling…',
  silent: 'This is what silence feels like.',
};

/* Nieuwe stap 3, operator 6 september 2026: "What do you want to change?"
   Operator, 22 september 2026 ("de iconen/kaarten die we voor breathwork
   [protocol-opbouw] gebruikt hebben, de 8"): stond hier een aparte,
   handmatige lijst van 5 kaarten (1:1 op de vijf ademtoestanden, niet op
   de acht echte doelen) — dat was exact de bug die de toelichting bij
   `toggleChangeGoal`/`dayPlanPicks` hieronder al beschrijft: deze stap
   beloofde een doel-keuze maar bood er feitelijk maar 5 van de 8 aan, met
   eigen titels die niet overal 1-op-1 matchten met `goalRank`'s echte
   doelen. Nu rechtstreeks `GOALS` (`data/goals.ts`) — dezelfde 8 doelen,
   dezelfde iconen/foto's, als de echte "Let VIBEZCORE build it"-pagina
   (goal.tsx). `CHANGE_CARDS`/`goalKey`-omweg is weg; `Goal.key` IS al de
   echte `GoalKey`. */

/* Nieuwe stap 4, operator 6 september 2026: "How experienced are you?"
   Operator, 22 september 2026 ("ervaring is wel belangrijk, wij gaan op
   basis daarvan een protocol samenstellen — moeten wij dit aanpakken
   zoals in breathwork Let VIBEZCORE build...?"): stond hier op eigen,
   losstaande sleutels ('new'/'some'/'regular') in een eigen `profile.
   experience`-instelling — precies dezelfde soort bug als stap 3 had:
   deze vraag BELOOFDE mee te wegen in het protocol, maar `profile.
   experience` werd nergens door `protocol.ts` gelezen. Het echte
   protocol-systeem (intensity.tsx, "Set your routine" → Level) gebruikt
   `ExperienceLevel` ('beginner'/'intermediate'/'advanced', settings.ts)
   — nu dezelfde sleutels/instelling, dus deze keuze weegt eindelijk ook
   echt mee in `RECOMMENDED_INTENSITY`/`protocol.ts`, niet enkel in de
   eigen duur-logica hieronder. Labels blijven de eigen, vriendelijkere
   kaart-teksten (intensity.tsx's "Beginner"/"Intermediate"/"Advanced"
   passen goed op een formele lijst-rij, minder natuurlijk op een grote
   fotokaart) — enkel de SLEUTELS en de opslagplek zijn nu gelijk. */
/* Operator, 22 september 2026 ("New · Familiar · Experienced, moet
   transparante blur zwarte kaarten zijn zoals overal"): labels
   ingekort (was "New to breathwork"/"Some experience") en de kaarten
   zelf zijn geen fotokaarten meer — dus `trimTop`/`panDown` (foto-crop-
   sturing) zijn weg, die golden enkel voor de oude fotoset.
   Operator, 22 september 2026 (vervolg, "cirkel die 1/3 volloopt met
   wave-animatie, Familiar half vol, Experienced helemaal vol maar
   golfbeweging nog duidelijk"): `fill` = het waterpeil per niveau voor
   `ExperienceWaveFill` — 1/3, 1/2, en NIET letterlijk 1 (dat verstopt de
   golfkam tegen de rand, "golfbeweging nog duidelijk" vraagt om een
   randje lucht erboven). */
const EXPERIENCE_OPTIONS: {
  key: ExperienceLevel;
  label: string;
  hint: string;
  fill: number;
}[] = [
  {
    key: 'beginner',
    label: 'New',
    /* Operator, 22 september 2026 ("subtekst moet korter, mag niet
       afgekapt"): was volledige zinnen ("I'm just getting started.") —
       nu korte labels, zelfde stijl als Apple's eigen voorbeeld
       ("1-3 minutes"), geen ellipsis-risico meer op de smalle kaarten. */
    hint: 'Just getting started',
    /* Operator, 23 september 2026 ("water van New mag iets lager" →
       "nog minder"): 1/3 → 0.22 → 0.14. */
    fill: 0.14,
  },
  {
    key: 'intermediate',
    label: 'Familiar',
    hint: 'Tried it before',
    fill: 1 / 2,
  },
  {
    key: 'advanced',
    label: 'Experienced',
    hint: 'Practice regularly',
    /* Operator, 22 september 2026 ("beetje ruimte boven zodat
       golfbeweging duidelijk is"): 0.92→0.8 — bij bijna vol was er te
       weinig lucht boven de waterlijn voor de golfkam (amp 4-5) om nog
       zichtbaar op en neer te lopen. */
    fill: 0.8,
  },
];

/* De twee gezichten, in TWEE versies — en dat is geen slordigheid.
   AFTASTEN gebeurt op de originele foto: die heeft ruim twee keer zoveel
   detail (1535×1024 tegen 612×408) en zachte overgangen in de schaduw, en
   daar leeft de puntenwolk van.
   TONEN gebeurt op de uitgeknipte versie. De originele draagt een eigen
   zwart vlak dat net niet het zwart van de app is, en dat zie je als een
   rechthoek zodra hij opkomt — een blok op het scherm in plaats van een
   gezicht dat verschijnt. Zonder achtergrond is er geen rand om te verraden.

   `FACES` zelf is GEEN module-constante meer (operator, 13 augustus 2026,
   "foto lijkt niet correct te laden" — de structurele oorzaak van de
   zwarte-scherm-klacht): `useAssetUri(FACES_URL)` wordt binnen `SlideIntro`
   zelf aangeroepen, zodat het scherm her-rendert zodra het bestand lokaal
   staat i.p.v. voor altijd aan de trage remote-URL vast te zitten. */
const FACES_CUTOUT =
  'https://vibezcore-audio.b-cdn.net/images/faces-removebg-preview.png';

/* Het ritme van het welkomstscherm. Opgaan en neergaan duren even lang; de
   stilstanden erna zijn wat het beeld leesbaar maakt.

   Vlotter dan eerst (operator, 3 augustus 2026): de overgang mag sneller,
   als hij maar schoon is. Vijf tellen was traag genoeg om te gaan wachten;
   drie en een half leest als een beweging in plaats van een vertraging.
   De stilstand op vol is juist LANGER geworden — dat is het moment waarop de
   foto scherp staat, en daar hoort het oog even te mogen rusten. */
/* Trager dan de vorige ronde (operator, 3 augustus 2026: "de morph gaat te
   snel"). Sinds de punten in bogen reizen in plaats van in rechte lijnen,
   leggen ze een langere weg af in dezelfde tijd — en dat leest als haast.
   Vijf seconden per beweging geeft de boog de ruimte die hij nodig heeft. */
/* Hoe lang de gezichten blijven staan voor de overgang begint, en hoe lang
   die overgang duurt. Er is geen terugweg meer, dus verder niets.

   Twee seconden kijken (operator, 5 augustus 2026, was 3,6). Sinds dit beeld
   niet meer alleen in de onboarding staat maar bij ELKE keer dat je de
   Breath-tab opent, telt de wachttijd anders: één keer is 3,6 seconden een
   rustig begin, tien keer per dag is het een drempel. Twee seconden is nog
   altijd lang genoeg om de gezichten te zien staan.

   De overgang zelf blijft vijf tellen: die duur gaat over de beweging, en
   die is niet minder mooi geworden omdat je hem vaker ziet. */
/* 2000/5000 → 1000/3500 (operator, 8 augustus 2026: "alles lijkt in
   slowmotion"). Eén tel kijken is genoeg om te zien waar je bent; daarna mag
   de beweging komen. */
const LOOK_MS = 1000;
const RISE_MS = 3500;

/* Operator, 6 september 2026: lichte achtergrondfoto voor stap 1 van de
   onboarding (WELCOME + mandala) — zelfde beeld als op de Breath-tab zelf
   (zie (tabs)/breath.tsx INTRO_BG_IMG), hier los gedefinieerd om geen
   circulaire import te maken (breath.tsx importeert SlideIntro van hier).
   Operator, 22 september 2026 ("gebruik deze foto ook voor step 1 bij
   onboarding, vervang de andere"): was uit de pas gelopen met
   (tabs)/breath.tsx se eigen `INTRO_BG_IMG` (`pic step 1 app.png` hier vs.
   `pic hero breathwork welcome 3.png` daar) ondanks de "zelfde beeld"-
   belofte hierboven — nu weer letterlijk dezelfde URL. */
const INTRO_BG_IMG =
  'https://vibezcore-audio.b-cdn.net/images/pic%20hero%20breathwork%20welcome%203.png';

/* Kaart onder de 4 gidsmodi op stap 2 ("bracelet mag deze achtergrond
   behouden"): eigen Apple-stijl productfoto.
   Operator, 22 september 2026 ("waar is de bracelet in step 2? die mocht
   niet weg, zet dat exact terug zoals het was"): per ongeluk mee verwijderd
   tijdens het opruimen van de bracelet-PAGINA (stap 5) — dat was een
   andere, losse vraag. Deze teaserkaart + infopopup op stap 2 zijn terug. */
const BRACELET_TEASER_IMG = BREATH_ONBOARDING_BRACELET_TEASER_IMG;

/* Icoonrij onder de kop. Drie kanalen, geen overlap, past op één regel.
   Eerder stond hier TOUCH · SILENT · PRECISE · HANDS-FREE — dat brak over
   twee regels en mengde categorieën: TOUCH en HANDS-FREE zeiden hetzelfde,
   PRECISE was een kwaliteitsclaim i.p.v. een manier van begeleiden. Deze
   drie zijn wél de kanalen die je op scherm 2 kunt kiezen. */
/* Subtekst per icoon (operator, 6 september 2026, light-mockup) — alleen
   gebruikt in lichte stand; de donkere, compacte rij blijft tekstloos. */
const TRAITS = [
  { key: 'voice', label: 'VOICE', sub: 'Guidance that grounds', Icon: Volume2 },
  /* Zelfde teken als op de kaarten van scherm 2: een punt met golven die
     eruit lopen (operator 2026-07-31). Het trillende-telefoontje dat hier
     stond zei iets anders — dat toont het apparaat, dit toont wat je voelt. */
  { key: 'haptics', label: 'HAPTICS', sub: 'Feel the shift', Icon: Rss },
  { key: 'silent', label: 'SILENT', sub: 'Your moment anywhere', Icon: Moon },
] as const;

export default function BreathWelcomeScreen() {
  const sub = useSubscription();
  /* Audit 8 okt 2026: de bracelet ontgrendelt geen Breathwork (operator, 9 aug); zo houdt een eigenaar zijn gratis kennismakingssessie. */
  const isPro = sub.isPro;

  /* Zeven stappen, niet acht (operator, 7 september 2026): Bracelet-intro
     en "How it works" zijn samengevoegd tot ÉÉN lichte pagina (mockup) —
     dat scheelt weer een stap t.o.v. de vorige telling. De bibliotheek
     behoudt daarnaast haar EIGEN scherm (operator, 9 augustus 2026), geen
     bijzin op het slotscherm. */
  /* Operator, 22 september 2026 ("de hele pagina moet gewoon weg"): stap
     5 ("Smart bead bracelet") is uit de flow — 7→6 stappen. Alle
     `resumeStep`-links (agenda.tsx, plan.tsx, plan-summary.tsx,
     intensity.tsx, plan-review.tsx) wezen naar index 6 (het toenmalige
     slotscherm), toen 5 (na het schrappen van de bracelet-stap); die zijn
     nu meeverhuisd naar 4, de nieuwe index van hetzelfde slotscherm na
     ALSO het schrappen van de Audio Library-stap ("audio library ook
     helemaal weg, wel onthouden misschien voor andere pagina" — de
     inhoud staat niet meer in dit bestand, enkel nog in de git-historie
     van deze sessie). */
  const TOTAL = 5;
  /* Operator, 7 september 2026: "nu gaat alles naar step 1... alles moet
     naar stap 7" — `router.navigate('/breath-welcome')` vanuit de
     plan-keten bleek GEEN bestaande instantie te hergebruiken (die begon
     gewoon opnieuw op slide 0), dus vertrouwen op stack-hergebruik was de
     verkeerde aanname. Robuuste, expliciete oplossing: elke terugknop in
     die keten geeft nu `?resumeStep=4` mee, en een verse (of hergebruikte)
     instantie start dan altijd meteen op die stap — geen giswerk meer over
     wat React Navigation intern wel/niet hergebruikt. */
  const { resumeStep } = useLocalSearchParams<{ resumeStep?: string }>();
  const [slide, setSlide] = useState(() => {
    const n = Number(resumeStep);
    return Number.isInteger(n) && n >= 0 && n < TOTAL ? n : 0;
  });
  const isLast = slide === TOTAL - 1;

  /* Scherm 2 — gekozen modus. Standaard geen enkele actief, zodat de
     knoppen puur informatief ogen tot de gebruiker kiest. */
  const [demoMode, setDemoMode] = useState<GuidanceMode | null>(null);
  /* Operator, 11 september 2026: "wanneer gebruiker uit die pagina gaat
     moet alles terug ongeselecteerd staan" — dit scherm is ÉÉN component
     voor alle 7 stappen (enkel `slide` wisselt), dus `demoMode` overleefde
     tot nu toe een bezoek aan andere stappen. Zodra de gebruiker van stap
     2 (index 1) weg navigeert, reset de selectie meteen — dus staat ze al
     leeg klaar tegen de tijd dat iemand terugkeert. */
  useEffect(() => {
    if (slide !== 1) setDemoMode(null);
  }, [slide]);
  /* Operator, 23 september 2026 ("recap-chip op stap 5 toont enkel
     ervaring, niet de begeleiding"): `demoMode` is met opzet hierboven al
     leeg tegen de tijd dat je stap 5 bereikt (voor de reset-op-stap-2-
     verlaten-logica) — de recap-chip op het slotscherm heeft dus een
     EIGEN, niet-resettende kopie nodig van dezelfde keuze, puur voor
     weergave. */
  const [chosenMode, setChosenMode] = useState<GuidanceMode | null>(null);

  /* Scherm 3 — "wat wil je veranderen": tot twee doelen, zelfde opslag
     (`goals`-setting) als de latere breath-quiz, dus deze keuze weegt
     meteen mee in welke toestand de app overal voorstelt. Start vanuit
     wat al opgeslagen staat, zodat terugbladeren de keuze niet wist. */
  const [changeGoals, setChangeGoals] = useState<string[]>(() =>
    getSetting('goals'),
  );
  const toggleChangeGoal = (goalKey: string) => {
    Haptics.selectionAsync();
    setChangeGoals((cur) => {
      const next = cur.includes(goalKey)
        ? cur.filter((g) => g !== goalKey)
        : cur.length >= MAX_GOALS
          ? [cur[1], goalKey]
          : [...cur, goalKey];
      setSetting('goals', next);
      return next;
    });
  };

  /* Scherm 4 — "hoe ervaren ben je": nu de ECHTE `experienceLevel`-
     instelling (settings.ts) i.p.v. het losstaande `profile.experience`
     — zie de toelichting bij `EXPERIENCE_OPTIONS`. Zelfde instelling die
     intensity.tsx ("Set your routine" → Level) leest/schrijft, dus deze
     keuze bepaalt nu ook echt de techniek/duur die `protocol.ts` kiest. */
  const [experience, setExperience] = useState<ExperienceLevel | null>(
    () => getSetting('experienceLevel'),
  );
  const pickExperience = (key: ExperienceLevel) => {
    Haptics.selectionAsync();
    setExperience(key);
    setSetting('experienceLevel', key);
  };
  /* Operator, 22 september 2026 ("bij aankomst op stap 4 moet next niet
     actief zijn, user moet altijd eerst opnieuw selectie maken"): zonder
     dit bleef een eerder gekozen niveau (deze sessie, of zelfs een oude
     opgeslagen `experienceLevel`) aangevinkt staan zodra je hier
     terugkwam — de CTA was dan al meteen wit/actief, zonder dat er echt
     iets bevestigd werd bij DIT bezoek. Reset enkel het lokale scherm-
     antwoord bij het BETREDEN van stap 4 (niet bij elke render terwijl
     je er al op staat, anders wist een tik op een kaart zichzelf weer
     uit) — een nieuwe tik schrijft de instelling meteen opnieuw weg. */
  useEffect(() => {
    if (slide === 3) setExperience(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide]);

  /* Operator, 22 september 2026 ("veiligheid van gebruiker en ons"):
     korte, niet-medische veiligheidsdisclaimer vlak vóór de eerste sessie
     (stap 7) — GEEN opgeslagen antwoord (geen gezondheidsdata, geen
     vertakking), enkel een bevestiging die de "Start"-knop vrijgeeft.
     Puur lokale state, bewust niet in `settings` — dit hoeft nergens
     buiten deze ene sessie te overleven. */
  const [safetyAck, setSafetyAck] = useState(false);
  /* Operator, 23 september 2026 ("bij teruggaan mag het niet aangevinkt
     blijven staan, bezoeker moet telkens zelf aanvinken"): zelfde
     reset-op-verlaten-patroon als `demoMode` hierboven — zodra de
     gebruiker van stap 4 (index 3, de veiligheidsdisclaimer) weg
     navigeert, reset meteen, dus staat het al leeg klaar bij een volgend
     bezoek, ongeacht of dat via terug- of vooruitbladeren gaat. */
  useEffect(() => {
    if (slide !== 3) setSafetyAck(false);
  }, [slide]);

  /* Operator, 23 september 2026 ("als gebruiker op next klikt zonder
     blokje aan te vinken moet het duidelijk zijn waarom het niet gaat"):
     `disabled={ctaBlocked}` op een Pressable vuurt in React Native GEEN
     enkele touch-event — een tik op de gedimde knop deed dus letterlijk
     niets, geen feedback, niets. De knop blijft nu altijd tikbaar; bij een
     tik terwijl `ctaBlocked` schudt de knop zelf (algemene "dit kan nog
     niet"-feedback), en specifiek op stap 4 — wanneer enkel de
     veiligheidsbevestiging nog ontbreekt — schudt ALSO het checkbox-rijtje
     zelf, zodat je meteen ziet WAAR het aan ligt. */
  const ctaShakeX = useSharedValue(0);
  /* Operator, 23 september 2026 ("heb je de CTA's ook op zelfde manier
     aangepast?"): zelfde druk-vering als de kaarten hierboven — press-in
     zonder bounce, press-out MET de critically-damped spring. Gecombineerd
     in DEZELFDE animated style als de bestaande shake (translateX), dat
     scheelt een extra wrapper. */
  const ctaPressScale = useSharedValue(1);
  /* Operator ("kijk alle CTA's na"): de Start-CTA zelf had geen haptic-tik
     — het `Haptics.selectionAsync()` verderop in dit bestand hoort bij
     plan-KEUZE (een ander element), niet bij deze knop. Huisstijl §5
     wil hier de standaard lichte tik op onPressIn + opacity(.85). */
  const onCtaPressIn = () => {
    ctaPressScale.value = withTiming(0.96, { duration: 80 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const onCtaPressOut = () => {
    ctaPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const ctaShakeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ctaShakeX.value },
      { scale: ctaPressScale.value },
    ],
    opacity: 1 - (1 - ctaPressScale.value) * 3.75,
  }));
  const safetyShakeX = useSharedValue(0);
  const shake = (sv: typeof ctaShakeX) => {
    sv.value = withSequence(
      withTiming(-8, { duration: 55 }),
      withTiming(8, { duration: 55 }),
      withTiming(-6, { duration: 55 }),
      withTiming(6, { duration: 55 }),
      withTiming(0, { duration: 55 }),
    );
  };
  const onBlockedTap = () => {
    Vibration.vibrate(20);
    shake(ctaShakeX);
    if (slide === 3 && experience !== null && !safetyAck) {
      shake(safetyShakeX);
    }
  };

  /* Scherm 7 — "your first session": vier rondes operator-feedback, 7
     september 2026, die hier allemaal samenkomen:
     1) "1 adem protocol lijkt mij niet correct... user moet zelf kiezen"
        → meerdere kaarten, user selecteert er één.
     2) "MORNING/EVENING... dat is nergens uitgelegd" → opgelost via de
        subtekst hierboven ("Built around your goals"), niet door de
        tijdstip-labels zelf weg te halen.
     3) "boost op beide kaarten klopt niet — als er 1 statekaart gevraagd
        is, moeten we dan geen 1 gepast protocol aanbieden?" → 1 gekozen
        doel = 1 kaart, 2 doelen = 2 kaarten (ochtend + avond).
     4) "de daily plan klopt nu niet met het ingestelde" — DIT was de bug:
        tussenstap 3 gebruikte een losse, RECHTSTREEKSE koppeling
        (CHANGE_CARDS) i.p.v. dezelfde `pickForSlot`/`goalRank`-motor die
        plan.tsx gebruikt. Voor 2 van de 5 doelen (Stress→Calm, Mental
        Clarity→Clarity) koos die directe koppeling een ANDERE toestand
        dan `goalRank` voor datzelfde doel zou kiezen — twee schermen die
        hetzelfde beloven maar iets anders tonen (exact het probleem dat
        day-plan.ts's eigen openingscommentaar al noemde: "een plan dat
        zichzelf tegenspreekt is geen plan").
     Oplossing: terug naar `pickForSlot` — de ENIGE motor, ook hier. Bij 2
     gekozen doelen tonen we de 2 ECHTE dagmomenten (ochtend/avond, exact
     zoals plan.tsx). Bij 1 doel (of 0, bij overslaan stap 3) tonen we
     enkel het moment van NU — 1 kaart, geen tweede verzonnen optie, maar
     wel dezelfde `pickForSlot`-uitkomst die plan.tsx voor dat moment ook
     zou tonen. */
  const currentSlot = slotForHour(new Date().getHours());
  /* Operator, 7 september 2026: "we hadden ook gezegd dat op de kaarten
     geen morning of evening of welk moment ook zouden komen" — de
     MOMENTEN blijven wel de motor achter de keuze (zie hierboven, voor
     consistentie met plan.tsx), maar het label op de kaart zelf toont dat
     tijdstip nooit. De toestand-naam (`cfg.eyebrow`, bv. "BOOST") maakt de
     kaarten al van elkaar te onderscheiden. */
  /* Operator, 22 september 2026 ("wij hebben een logica voor niveau
     gekoppeld aan aantal sessies al uitgewerkt, toch?"): klopt — dat
     bestond al via `RECOMMENDED_INTENSITY` (intensity.tsx) +
     `INTENSITY_SESSION_COUNT` (protocol.ts), dezelfde beginner→2/
     intermediate→3/advanced→4-keten die de echte Routine-aanbeveling
     draagt. Hergebruikt i.p.v. een eigen dubbele tabel — enkel het
     AANTAL kaarten/ring-items op dit slotscherm volgt hieruit, niet de
     dagplan-generator zelf (die blijft ongemoeid, scope = onboarding-
     preview). `SLOTS` (services/reminders.ts) heeft precies 4 vaste
     dagmomenten, dus "advanced" (Complete) gebruikt ze alle 4.
     `experience` staat op dit punt altijd vast (stap 4 blokkeert "Next"
     tot een niveau gekozen is) — de `currentSlot`-fallback is enkel een
     typesafe vangnet.

     Operator, 22 september 2026, vervolg ("waarom stel jij 3x zelfde voor?
     savonds kunnen we toch wel sleep voorstellen? er moet pure logica
     zijn"): bug — een simpele `slice(0, N)` op de vaste dagorde
     (morning/midday/afterWork/evening) pakt bij N=2/3 altijd de EERSTE
     N momenten, en sluit "evening" (het enige moment waar Rest/Sleep
     thuishoort, zie `DAY_CANDIDATES` in day-plan.ts) daardoor bijna
     altijd uit — ongeacht het gekozen doel. `bestSlotsForCount` (ook
     day-plan.ts, al de motor achter de echte protocol-generator,
     protocol.ts) bestond al precies hiervoor: het kiest de N dagdelen die
     het BESTE bij het gekozen doel passen (dus evening TELT mee zodra
     een doel daar iets te zoeken heeft), i.p.v. altijd de eerste N in
     vaste volgorde. */
  const momentSlots: string[] = experience
    ? bestSlotsForCount(
        changeGoals,
        INTENSITY_SESSION_COUNT[RECOMMENDED_INTENSITY[experience]],
      )
    : [currentSlot];

  /* Operator, 11 september 2026: "het gaat over heel systeem" — was
     slot-voor-slot met `prevPick` als enige variatieregel, zelfde
     constructiefout als de protocol-generator (utils/protocol.ts). Nu via
     `pickStatesForDay`, dezelfde motor als plan.tsx/breath-quiz.tsx. */
  const dayPlanPicks = pickStatesForDay(momentSlots, changeGoals);
  const dayPlan = momentSlots.map((slot) => {
    const state = dayPlanPicks[slot];
    const durations = BREATH_STATES[state].durations;
    /* Zelfde ervaring-naar-duur-logica als voorheen (operator: "wat heeft
       het voor zin om ervaring in te vullen als de duur toch altijd
       hetzelfde is") — nu per kaart, niet enkel voor één toestand. */
    const minutes =
      experience === 'beginner'
        ? durations[0].minutes
        : experience === 'advanced'
          ? durations[durations.length - 1].minutes
          : (durations.find((d) => d.recommended) ??
            durations[BREATH_STATES[state].defaultDuration] ??
            durations[0]).minutes;
    /* Operator, 22 september 2026 ("bouw super logisch": Recover & relax
       naast een avond-Sleep-sessie zonder context leek verwarrend — enkel
       met een gekozen doel is er iets om naar te verwijzen; zonder doel
       (stap 3 overgeslagen) blijft de oude generieke tekst staan, geen
       dagdeel-woord tonen (operator, 7 september 2026: nooit "morning"/
       "evening" los op een kaart). */
    const label =
      changeGoals.length > 0
        ? reasonForPick(state, changeGoals, slot).toUpperCase()
        : 'RECOMMENDED FOR YOU';
    return { slot, label, state, minutes };
  });
  /* Standaard alvast het moment van NU geselecteerd — de rest kies je zelf.
     Blijft nodig zodat "Start your first session" altijd een concreet
     plan-item heeft, ook als de gebruiker nooit zelf tikt. */
  const [selectedPlanIdx, setSelectedPlanIdx] = useState(() =>
    Math.max(
      0,
      dayPlan.findIndex((p) => p.slot === currentSlot),
    ),
  );
  /* Operator, 24 september 2026 ("bij teruggaan van stap 5 moet binnenkant
     ring terug leeg tot er weer getikt wordt"): puur visuele vlag, los van
     `selectedPlanIdx` hierboven — die moet een zinnig default HOUDEN (voor
     de CTA), maar de ring-MIDDEN-weergave hoort pas te verschijnen na een
     ECHTE tik op DIT bezoek aan stap 5, niet automatisch vanaf het
     standaard-item. Reset-op-betreden-patroon, zelfde als `experience`
     hierboven (stap 4). */
  const [planTapped, setPlanTapped] = useState(false);
  useEffect(() => {
    if (isLast) setPlanTapped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLast]);
  /* Operator, 23 september 2026 (Apple citeert: "selectionChanged-puls vóór
     de animatie, dan pas krimpt de knop"): dezelfde `Haptics.selectionAsync`
     die overal elders al bij keuzes hoort (agenda.tsx, breath.tsx's eigen
     `StateThumb`, breath-quiz.tsx, ...) — hier ontbrak 'm nog. Guard tegen
     opnieuw tikken op de AL geselecteerde kaart, anders trilt 'm zonder dat
     er iets verandert. */
  const onSelectPlan = useCallback((idx: number) => {
    setPlanTapped(true);
    setSelectedPlanIdx((prev) => {
      if (prev === idx) return prev;
      Haptics.selectionAsync();
      return idx;
    });
  }, []);
  const selectedPlan = dayPlan[selectedPlanIdx] ?? dayPlan[0];
  const recommendedState = selectedPlan.state;
  const recommendedMinutes = selectedPlan.minutes;

  /* De stemcues alvast inladen. Op dit scherm speelt één losse cue per tik,
     en een speler die het bestand nog niet heeft blijft stil — in een sessie
     merk je dat niet omdat de tweede cue het wél doet. */
  useEffect(() => {
    preloadBreathCues();
  }, []);

  const finish = () => setSetting('breathOnboardingCompletedAt', Date.now());

  /* Licht i.p.v. donker — stap 1-5 zijn nu gemigreerd (operator, 7
     september 2026: Bracelet erbij), de rest volgt later. */
  /* Operator, 22 september 2026 ("de eerste foto blijft dark vanaf step
     2" — d.w.z. stap 1 blijft zoals nu, stap 2+ wordt donker, zelfde
     stijl als de protocolflow): gedeeltelijke terugkeer naar het
     slide-afhankelijke `light` van vóór 7 september. Enkel stap 1
     (SlideIntro, de fotopagina) blijft licht. */
  const light = slide === 0;

  /* Operator, 22 september 2026 ("kijk op van welcome in breathwork, dat
     heeft een animatie lichtflits, dat moet ook bij onboarding eerste
     stap" → "werkt heel slecht, links zichtbaar in wacht en gaat te
     traag, moet al verdwenen zijn alvorens aan te komen"): de vaste
     `CTA_SHIMMER_RANGE`-aanpak van (tabs)/breath.tsx (translateX ±170,
     geen expliciete `left`) bleek hier niet hetzelfde resultaat te geven
     — vermoedelijk een subtiel layout-verschil in hoe de absoluut-
     gepositioneerde strook zonder `left` rust t.o.v. de knop. In plaats
     van te blijven gokken naar DAT verschil: de echte knopbreedte meten
     (`onLayout`) en de strook-beweging daar expliciet op berekenen —
     `left:0` vastgezet (zie `ctaShimmer`-stijl), start ruim links VAN de
     knop (-70) en eindigt ruim rechts ERVAN (breedte+40), dus gegarandeerd
     volledig verdwenen aan beide kanten, ongeacht knopbreedte. */
  const [ctaWidth, setCtaWidth] = useState(SCREEN_W - 52);
  const ctaShimmer = useSharedValue(-1);
  useEffect(() => {
    ctaShimmer.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(2600, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })),
        withDelay(1200, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [ctaShimmer]);
  const ctaShimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(ctaShimmer.value, [-1, 1], [-70, ctaWidth + 40]) },
      { rotate: '18deg' },
    ],
  }));

  const goBack = () => setSlide((n) => Math.max(0, n - 1));

  const goNext = () => {
    if (!isLast) {
      setSlide((n) => n + 1);
      return;
    }
    finish();
    /* Operator, 7 september 2026: "start your session moet direct naar
       geselecteerde sessie gaan" — de vragenlijst (breath-quiz.tsx)
       vroeg hier niet meer opnieuw doel/ervaring (die komen al uit stap
       3/4), enkel nog "voorkeursmomenten" voor herinneringen, en rekende
       daarna met DEZELFDE `pickForSlot`-formule dezelfde toestand uit die
       de kaart hierboven al toont. Die tussenstop voelde als "nog een
       stap bouwen" i.p.v. direct beginnen — nu rechtstreeks naar precies
       de sessie die beloofd werd. Zelfde isPro-vertakking als
       breath-quiz.tsx had. */
    if (isPro) {
      router.replace('/breath' as never);
    } else {
      /* Operator, 7 september 2026: "mag maar 1 keer werken" — check EN
         markering gebeuren op het moment van de knop-tik zelf (gewone
         functie-aanroep), niet in breath-session.tsx's eigen mount-timing
         (`useState`/`useEffect`), die bleek onbetrouwbaar zodra Expo
         Router een scherm hermonteert. `claimFreeSessionParam()` is de
         GEDEELDE versie van die check (zelfde dag: "wat als user naar
         'Customize your full plan' doorklikt, is hij de trial dan kwijt?"
         — plan.tsx claimt 'm nu ook via dezelfde functie), dus deze knop
         is niet meer de enige plek die de vlag kan claimen. */
      const freeParam = claimFreeSessionParam();
      router.replace(
        `/breath-session?${new URLSearchParams({
          ...freeParam,
          mode: recommendedState,
          minutes: String(recommendedMinutes),
          /* Operator, 11 september 2026: "check alles overal, de oude
             selectiepagina mag nooit meer verschijnen" — mode+duur staan
             hier al vast (aanbevolen door de onboarding zelf). */
          autostart: '1',
          /* `from: 'onboarding'` komt UITSLUITEND uit claimFreeSessionParam()
             hierboven (operator, 8 okt 2026, audit): hier hard zetten gaf via
             Settings → "Watch the intro again" onbeperkt gratis Premium-
             sessies. Wie zijn gratis sessie al gebruikte, krijgt nu de
             gewone sessie met voorproef. */
        }).toString()}` as never,
      );
    }
  };

  /* [VERVANGEN 8 okt 2026 — Skip zet de vlag nu WEL, zie onSkip.]
     Skip zet de vlag BEWUST NIET (operator 2026-07-31: "iedereen die skipt
     of uitlogt en later terugkomt moet altijd terug naar intro"). Alleen wie
     de drie schermen uitloopt is klaar; wegklikken is uitstel, geen keuze.
     Anders raakt iemand die per ongeluk op Skip tikt de intro voorgoed
     kwijt — en die intro is het enige moment waarop we uitleggen wat dit
     product is.

     BUG (operator, 13 augustus 2026, "al 10 keer eerder doorgegeven"): de
     `else`-tak stuurde naar `/` — de ROOT, die via _layout.tsx altijd naar
     het trage welcome.tsx-scherm leidt (hetzelfde puntenwolk-canvas dat een
     paar seconden zwart opstart, zie SplatField.tsx). Wie Skip tikte kwam
     dus op een scherm terecht dat leek "vast te hangen". De bedoeling was
     altijd select mode (de Breath-tab), niet terug naar het merkbeeld.
     `skipBreathOnboardingRedirectOnce()` voorkomt dat de Breath-tab meteen
     weer terugstuurt naar de intro — dezelfde vlag die `onMaybeLater`
     hieronder gebruikt. */
  const onSkip = (markSeen = true) => {
    /* Operator, 8 okt 2026 (vervangt de regel van 31 juli): Skip telt als
       gezien, Apple-stijl — de onboarding komt maar één keer. Terugzien kan
       via Settings. Terugvegen op stap 1 (markSeen=false) is "nu even niet":
       rondkijken mag, terug op de Breath-tab staat de onboarding er weer
       ("bezoeker zal benieuwd zijn om andere tabs te bekijken en dan
       terugkomen"). */
    /* Geopend vanuit een ander scherm (Settings → intro herbekijken) = al
       eerder gezien: terugvegen telt dan wel als gezien, anders kwam hij op
       de Breath-tab meteen terug. */
    if (markSeen || router.canGoBack()) void finish();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    skipBreathOnboardingRedirectOnce();
    /* BUG (operator, 13 augustus 2026, tweede helft van dezelfde klacht):
       zonder deze regel landt de Breath-tab wél, maar toont zijn EIGEN
       welkomstbeeld (SlideIntro — dezelfde mandala/gezichten-animatie,
       met dezelfde trage eerste-tekening) opnieuw. Wie net de hele intro
       heeft gezien hoeft 'm geen tweede keer, meteen achter elkaar, te
       zien — dat las als "gaat niet naar select mode" terwijl de
       navigatie zelf al goed stond. */
    /* Operator, 8 okt 2026 ("moet gebruiker dan niet op welcome pagina
       breathwork komen ipv select state?"): wie Skip tikt heeft de uitleg
       NIET gezien → landt op het Breath-welkomstbeeld (de drempel), niet
       meteen op select state. skipBreathIntroOnce() hier dus weg. */
    router.replace('/breath' as never);
  };

  /* Operator, 7 september 2026: "alles moet perfect werken" — de Android
     hardware-terugknop/-gebaar werd nergens opgevangen. Standaard popt die
     dan gewoon het HELE scherm van de stack (React Navigation's eigen
     gedrag), wat de zorgvuldige stap-voor-stap `goBack` EN de skip-vlaggen
     van `onSkip` volledig omzeilt — en kon zo, afhankelijk van de exacte
     stack-positie, zomaar op welcome.tsx uitkomen i.p.v. netjes terug te
     bladeren. Nu: op stap 2+ gewoon één stap terug (zelfde als de
     Back-knop), op stap 1 hetzelfde pad als Skip — nooit het onvoorspelbare
     standaardgedrag. `useFocusEffect` i.p.v. een kale `useEffect`: de
     listener moet weg zodra dit scherm niet meer focust, anders vangt hij
     ook de terugknop op een scherm ERBOVEN nog op. */
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (slide > 0) {
          goBack();
        } else {
          onSkip(false);
        }
        return true;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slide]),
  );

  /* "Maybe later" is geen vroegtijdig wegklikken zoals Skip — dit staat
     pas op het LAATSTE scherm, wie hier komt heeft de hele intro al
     gezien. De vlag mag dus wél gezet worden (operator, 11 augustus
     2026: "moet naar de breathe free environment gaan, zodat hij kan
     testen") — anders stuurt de Breath-tab hem meteen weer terug naar
     deze intro, en "later" wordt dan nooit "nu even rondkijken".

     `await finish()` alléén bleek niet genoeg (operator, 11 augustus
     2026, tweede melding: "maybe fucking later opnieuw naar die welcome
     pagina"): de Breath-tab blijft doorgaans al gemonteerd (zie
     breath-entry.ts) en zijn redirect-timer hangt aan `useSetting`-state
     die via een luisteraar bijwerkt — een extra laag die nog steeds
     ruimte voor een race gaf. `skipBreathOnboardingRedirectOnce()` is
     dezelfde synchrone, race-vrije vlag-truc die dit bestand al gebruikt
     voor het intro-beeld: geen enkele afhankelijkheid van async state,
     dus geen enkele race meer mogelijk. */
  /* Operator, 7 september 2026: "info over zelf protocol aanmaken komt
     nergens terug in onboarding, lijkt mij belangrijk" — terecht: plan.tsx
     laat je al PER MOMENT een ander protocol/duur kiezen, maar daar werd
     nooit naar verwezen.

     EERSTE versie linkte rechtstreeks naar `/plan?onboarding=1` — bleek
     fout: die pagina is het EINDPUNT van de echte protocol-keten
     (`/goal → /intensity → /plan-review → /plan-duration`, die pas écht
     een protocol OPSLAAT via `saveActivePlan`). Rechtstreeks binnenkomen
     betekende dat er nog geen protocol bestond, dus toonde `/plan` de
     losse live-herberekende twee-momenten-preview — die klopte, maar
     "REVIEW & CONFIRM" verderop bevestigde dan NIETS (leeg `useActivePlan()`)
     of, erger, een oud protocol van eerder testen. Operator: "ingesteld via
     onboarding komt niet overeen... heeft dan geen zin om dat preview te
     noemen. Moeten we niet de hele flow laten zien?" — terecht: als we
     "REVIEW & CONFIRM" beloven, moet er ook echt iets zijn om te bevestigen.

     Nu: binnenkomen bij `/intensity`, niet bij `/plan`. `/goal` slaan we
     over — de doelen staan al vast via stap 3 (`changeGoals`, dezelfde
     `goals`-setting die `/goal` ook gebruikt), die vraag hoeft niet
     dubbel. Vanaf `/intensity` loopt de ECHTE keten verder
     (intensity → review → duration, die daarna zelf naar
     `/plan?onboarding=1` pusht, nu MET een opgeslagen protocol) tot en met
     Agenda — dezelfde flow als de bestaande protocol-opbouw, nu ook
     bereikbaar vanuit breathwork-onboarding i.p.v. enkel via Activity.

     BEWUST `push`, niet `replace` (operator, na 5 keer mis geraden: "de
     back moet uitkomen op die laatste onboarding pagina") — `replace`
     verwijderde stap 7 uit de stack, dus terug had nergens heen te gaan;
     `push` laat stap 7 staan, dus terug-knoppen door de hele keten komen
     er vanzelf weer op uit.

     Operator, zelfde dag, ná dat het technisch klopte: "user moet nu
     telkens op back en nog eens back klikken... op het einde bij Agenda
     moet die 5x op de terugpijl klikken om terug te gaan naar stap 7. Kan
     dat telkens met 1 klik?" — terecht, stap-voor-stap terugbladeren door
     6 tussenschermen is geen "in 1 klik". `fromBreathWelcome` is een apart
     signaal (los van `onboarding`, dat al een andere rol heeft: de
     CTA-tekst "REVIEW & CONFIRM" i.p.v. "OPEN YOUR AGENDA") dat door de
     hele keten meegaat, zodat ELKE terugknop daar `router.navigate`
     gebruikt i.p.v. `back()` — dat springt in ÉÉN stap naar de BESTAANDE
     stap-7-instantie (nog steeds op slide 6, want die was nooit
     ge-`replace`t), ongeacht hoe diep je in de keten zit. */
  /* Operator, 22 september 2026 ("gesproken volledige cyclus inhale hold
     exhale"): geplande vervolg-cues (hold/exhale) van de demo — opgeruimd
     bij een volgende tik of bij het verlaten van dit scherm, zie
     `onPickMode`/de cleanup hieronder. */
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => demoTimers.current.forEach(clearTimeout), []);

  /* Elke modus demonstreert zichzelf bij het aantikken: je hoort en voelt
     wat je kiest, in plaats van het alleen te lezen. */
  const onPickMode = (m: GuidanceMode) => {
    Haptics.selectionAsync();
    setDemoMode(m);
    setChosenMode(m);
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
    /* Operator, 23 september 2026 ("gekozen guidance moet ook echt naar
       de sessie doorgezet worden"): `hapticsPhone` ontbrak hier — de
       instelling die `breath-session.tsx` (`useSetting('hapticsPhone')`)
       ECHT leest om phone-haptics aan/uit te zetten. Zonder deze regel
       bleef `hapticsPhone` op zijn default (`true`) staan ongeacht de
       keuze hier — "Voice" en vooral "Silent Mode" waren daardoor in de
       echte sessie niet stil, de telefoon trilde gewoon door. */
    setSetting('voiceCues', wantsVoice);
    setSetting('hapticsPhone', wantsHaptic);
    setVoiceEnabled(wantsVoice);
    if (wantsVoice) {
      /* De stemdienst geeft het woord aan één scherm tegelijk; wie niet
         geclaimd heeft wordt stilzwijgend genegeerd. Zonder deze regel bleef
         de demo stil zodra de Breath-tab of de bracelet het woord nog had —
         precies wat de operator zag (2026-07-31: "bij aanklikken cards
         gebeurt niets"). */
      claimVoiceSource('breath');
      /* Operator, 11 september 2026 (definitieve opzet): "Voice"-kaart
         demonstreert de vrouwenstem, "Voice + Haptics" de mannenstem — vast
         per kaart, geen aparte toggle. De override is enkel voor deze ene
         demo-cue, meteen daarna weer op `null`: de eigenlijke, persistente
         `voiceGender`-instelling (elders gekozen, bv. Settings) blijft
         ongemoeid. */
      const gender = m === 'voice' ? 'female' : m === 'both' ? 'male' : null;
      setVoiceGenderOverride(gender);
      /* Zonder `force`. Die was nodig zolang de tik alleen een vlag in het
         geheugen zette die de root-layout even later terugdraaide. Nu wordt
         de keuze bewaard en zet de regel hierboven de dienst meteen aan, dus
         er is niets meer om langs te gaan. */
      /* Operator, 22 september 2026 ("gesproken volledige cyclus inhale
         hold exhale"): was enkel de inhale-cue — nu een volledige
         demo-cyclus (inhale → hold → exhale), met pauzes ertussen die de
         echte fase-duur van een sessie nabootsen i.p.v. de 3 cues
         achter elkaar af te vuren. `demoTimers` ruimt eerdere, nog
         lopende demo's op als iemand snel een andere kaart aantikt —
         anders speelt een oude "exhale" nog na terwijl je al een andere
         modus koos. */
      demoTimers.current.forEach(clearTimeout);
      demoTimers.current = [];
      playBreathCue('inhale', 'nose', 'calm', 'breath');
      demoTimers.current.push(
        setTimeout(() => playBreathCue('hold-in', 'nose', 'calm', 'breath'), 3000),
        setTimeout(() => {
          playBreathCue('exhale', 'nose', 'calm', 'breath');
          setVoiceGenderOverride(null);
        }, 5000),
      );
    }
  };

  /* De automatische klop is eruit (operator, 3 augustus 2026): de overgang
     naar de rozet is alleen visueel. Hier stond eerst één trilling per ronde
     van het licht — het argument was dat de haptiek hét kenmerk is en dat een
     stille intro dat niet verkoopt. Dat klopt, maar niet tijdens deze
     overgang: een telefoon die uit zichzelf begint te trillen terwijl je nog
     kijkt, onderbreekt precies het moment dat het beeld moet dragen.

     Wat blijft is de trilling op AANRAKING hieronder. Die vraagt de bezoeker
     zelf, en dan is het een antwoord in plaats van een onderbreking. */
  const feelOrb = () => {
    Vibration.vibrate(SIGNATURE_PULSE, false);
  };

  /* Operator, 11 september 2026: "Audio Library →" op de bracelet-stap was
     verwarrend — teruggezet naar het gewone "Next"-patroon, net als elke
     andere tussenstap.
     Operator, 22 september 2026 ("ook geen pijlen in cta's, dat is een
     harde regel geworden"): "→" overal weg.
     Operator, 24 september 2026 ("next is ook niet goed hier, begin your
     journey ofzo"): scherm 1 heeft nog geen keuze/opbouw om op voort te
     bouwen (endowment/IKEA-effect gaan hier niet op, zie toelichting in
     memory), maar "Next" is ook te administratief voor een sfeer-opener —
     past niet bij de poëtische toon ("Breathe. Build. Become."). "Start"
     i.p.v. "Begin" (operator, vervolg, "begin of start?"): zelfde
     werkwoord als het slotscherm ("Start your first session") — begin en
     einde van de onboarding spiegelen elkaar nu. Alleen scherm 1 krijgt
     dit eigen label; stap 2/3 blijven "Next". */
  const ctaLabel = isLast
    ? isPro
      ? 'Enter Breath'
      : 'Start your first session'
    : slide === 0
      ? 'Start Your Journey'
      : 'Next';

  /* Operator, 22 september 2026 ("next cta moet hier pas actief en wit
     worden bij keuze gemaakt"): stap 3 ("What's the end game") is de
     enige stap met een VERPLICHTE keuze om verder te gaan — tot dan is
     de knop inert (geen tap-reactie) en gedimd i.p.v. de gewone
     blur/tint- of witte stijl.
     Operator, 22 september 2026 (vervolg, "veiligheid van gebruiker en
     ons"): zelfde inerte/gedimde behandeling op het slotscherm (`isLast`)
     zolang de veiligheidsdisclaimer niet bevestigd is — "Start your first
     session" mag pas ECHT starten na die bevestiging.
     Operator, 22 september 2026 (vervolg, "cta moet identiek zelfde als
     in stap 3"): stap 4 ("Your breathwork experience") krijgt exact
     dezelfde behandeling — pas wit/actief zodra `experience` gekozen is.
     Operator, 22 september 2026 (vervolg, "ook bij stap 2 echte keuze
     laten maken, dan kunnen we dat zo laten starten bij free trial"): was
     "elke kaart is maar een demo, geen verplichte keuze" — maar `onPick`
     schrijft de echte `voiceCues`-instelling al meteen weg (zie
     `onPickMode`), dus dit was al een echte keuze, enkel de knop deed nog
     niet mee. `demoMode` reset al naar `null` zodra je van stap 2 weg
     navigeert (zie de `useEffect` erboven), dus je moet ook hier telkens
     opnieuw tikken. */
  /* Operator, 23 september 2026 ("breathwork can affect... tekst in de
     stap hiervoor onderaan zetten"): de veiligheidsbevestiging verhuisde
     van het slotscherm naar stap 4 (SlideExperience) — blokkeert nu
     "Next" op stap 4 i.p.v. "Start" op stap 5, samen met de al bestaande
     ervaring-keuze-eis daar. */
  const ctaBlocked =
    (slide === 1 && demoMode === null) ||
    (slide === 2 && changeGoals.length === 0) ||
    (slide === 3 && (experience === null || !safetyAck));

  return (
    /* Operator, 22 september 2026 ("foto onderkant moet doorlopen — zie
       je niet dat het niet leesbaar is"): de achtergrondfoto zat VOORHEEN
       als kind BINNEN de `SafeAreaView` (`edges={['top','bottom']}`), dus
       werd ook de foto zelf ingesprongen door de top/bottom-veilige-zone
       — onderaan (en bovenaan) bleef een reep van de effen `root`/
       `rootLight`-kleur zichtbaar i.p.v. dat de foto echt tot de
       schermrand doorloopt. Nu een niet-inspringende buitenste `View` die
       de ECHTE achtergrond draagt (foto of `Starfield`/effen kleur), met
       de `SafeAreaView` er transparant OVERHEEN — enkel nog voor de
       inspringing van de INHOUD (tekst/knoppen), niet meer voor de
       achtergrond zelf. */
    <View style={[s.root, light && s.rootLight, { flex: 1 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Operator, 6 september 2026: stap 1-3 krijgen de lichte
         achtergrond i.p.v. het sterrenveld — de rest blijft voorlopig
         donker (gefaseerde light/dark-migratie). Stap 3 heeft geen eigen
         achtergrondfoto nodig: de 5 kaarten zijn zelf al foto's, op het
         effen lichte `rootLight`-vlak. */}
      {slide === 0 ? (
        /* Operator, 22 september 2026 ("de foto moet doorlopen"): volle
           schermbreedte+hoogte i.p.v. de eigen beeldverhouding met
           ademruimte erboven — zelfde `StyleSheet.absoluteFill`+`cover`
           als de andere fotostappen (1/4/6) hieronder. */
        <Image
          source={{ uri: INTRO_BG_IMG }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : slide === 1 || slide === 2 || slide === 3 ? (
        /* Operator, 22 september 2026 ("waarom is dat zo moeilijk, dat
           staat nog altijd wit?" → "de zwarte achtergronden moeten zonder
           de stippen, effen zwart"): stap 2 had een aparte, volledig-
           scherm `STEP2_BG_IMG` ("een neutrale LICHTE wassing", 6
           september) die nog onvoorwaardelijk stond — dat was de echte
           reden dat de pagina wit bleef ogen. Eerst vervangen door
           `Starfield` (sterrenveld-stippen), maar dat mocht weg — enkel
           de effen `root`-achtergrond (`Brand.bg`, zie de buitenste
           `View`) blijft, geen decor.
           Operator, 22 september 2026 (vervolg, "de hele pagina moet
           gewoon weg" / "audio library ook helemaal weg"): zowel de
           bracelet-stap (met `BraceletBgPhoto`) als de Audio Library-stap
           zijn uit de flow — index 4 is nu het slotscherm, zie de tak
           hieronder. */
        null
      ) : (
        /* Operator, 22 september 2026 ("achtergrond moet zwart om te
           beginnen"): de foto-achtergrond (was hier) weg — slot-scherm
           volgt nu dezelfde effen-zwarte `s.root`-achtergrond als stap
           2/3/4 hierboven, geen aparte foto meer nodig nu de RhythmRing
           en kaarten zelf al genoeg beeld geven. */
        null
      )}

      <SafeAreaView style={s.safeContent} edges={['top', 'bottom']}>
      {/* De stapregel staat ABSOLUUT in het midden van de balk, niet tussen
          twee rekbare vlakken in. Zo lag hij namelijk nooit echt in het
          midden: "Skip" neemt rechts ruimte in, en de tekst schoof dus een
          halve knopbreedte naar links. Op elk scherm even scheef, en precies
          zichtbaar omdat de kop eronder wél gecentreerd staat. */}
      <View style={s.topbar}>
        {/* Operator, 6 september 2026 (mockup): pijl terug i.p.v. enkel
           Skip — wie per ongeluk doorklikt kan nu ook terug, niet enkel
           opnieuw beginnen. Onzichtbaar (niet enkel disabled) op stap 1:
           er is nergens naartoe terug. */}
        <View style={s.backWrap}>
          {slide > 0 && (
            <Pressable onPress={goBack} hitSlop={14} style={s.backBtn}>
              <ChevronLeft size={18} color={Brand.textDim} strokeWidth={2.2} />
              <Text style={s.skipTxt}>Back</Text>
            </Pressable>
          )}
        </View>
        <View style={s.stepCenter} pointerEvents="none">
          <Text style={s.stepEyebrow}>
            {`STEP ${slide + 1} OF ${TOTAL}`}
          </Text>
          {/* Operator, 22 september 2026 ("stippen vervangen door lijn
             zoals bij breathwork setting protocol"): vervangt de losse
             puntjes-rij door dezelfde dunne, doorlopende voortgangsbalk
             als `StepIndicator` (goal.tsx/intensity.tsx/plan-review.tsx)
             — zelfde `track`/`fill`-opbouw, hier los nagebouwd i.p.v. het
             gedeelde component zelf omdat dit scherm zijn stap-blok
             absoluut gecentreerd houdt (niet in een flex-rij tussen twee
             knoppen), wat `StepIndicator`'s eigen `flex:1` niet toelaat.
             Vervolg ("waarom is de kleur blauw?" toen "foto onderkant moet
             doorlopen, tekstkleur wit, zie je niet dat het onleesbaar
             is?"): eerst nog een `light`-donker-variant voor stap 1, maar
             de foto daar is dezelfde donkere/sfeervolle hero-foto als
             elders in de app (niet een lichte achtergrond) — dus altijd
             wit, geen `light`-uitzondering meer nodig, ongeacht stap. */}
          <View style={s.stepTrack} pointerEvents="none">
            <View
              style={[s.stepFill, { width: `${((slide + 1) / TOTAL) * 100}%` }]}
            />
          </View>
        </View>
        <View style={s.backWrap}>
          <Pressable onPress={() => onSkip()} hitSlop={14} style={s.skipWrap}>
            <Text style={s.skipTxtSecondary}>Skip</Text>
          </Pressable>
        </View>
      </View>

      {/* GEEN scroll op stap 1-4 (operator, 10 augustus 2026, voor de derde
          keer: "paginas moeten volledig in beeld staan zonder te moeten
          scrollen") — RESERVED/vaste maten daar zijn ruim genoeg ingeschat
          zodat kop, inhoud en knop altijd zonder scrollen samen passen.
          Operator, 22 september 2026 ("maak de pagina ook eens
          scrollbaar"): het SLOTSCHERM (stap 5) is de uitzondering — de
          ring + tot 4 kaarten (afhankelijk van ervaringsniveau) hebben
          geen vaste, voorspelbare hoogte meer zoals de andere stappen, dus
          daar geldt de oude regel niet langer. Enkel dít scherm krijgt een
          ScrollView; de andere 4 blijven ongewijzigd zonder scroll. */}
      {isLast ? (
        <ScrollView
          style={s.startScroll}
          contentContainerStyle={s.startScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SlideStart
            plan={dayPlan}
            selectedIdx={selectedPlanIdx}
            onSelect={onSelectPlan}
            goals={changeGoals}
            experience={experience}
            showRingCenter={planTapped}
          />
        </ScrollView>
      ) : (
        <View
          style={[
            s.slideArea,
            slide >= 1 && slide <= 4 && s.slideAreaTop,
          ]}
        >
          {slide === 0 ? (
            <SlideIntro onTapOrb={feelOrb} light />
          ) : slide === 1 ? (
            <SlideGuidance onPick={onPickMode} chosenMode={chosenMode} light={light} />
          ) : slide === 2 ? (
            <SlideChangeGoals selected={changeGoals} onToggle={toggleChangeGoal} />
          ) : (
            <SlideExperience
              selected={experience}
              onPick={pickExperience}
              safetyAck={safetyAck}
              onToggleSafetyAck={() => setSafetyAck((v) => !v)}
              safetyShakeX={safetyShakeX}
            />
          )}
        </View>
      )}

      {/* Operator, 7 september 2026: "foto moet doorlopen tot onderkant
         scherm" — op de Library-stap mag de foto onder de knop blijven
         doorlopen (de knop is zelf al een effen blauwe pil, heeft geen
         witte balk erachter nodig). Elders (bracelet/laatste stap) blijft
         de witte achtergrond, die loste daar juist een ander probleem op
         (blauwe waas rond de knop). */}
      <View
        style={s.footer}
      >
        {/* Operator, 22 september 2026 ("cta daily plan weg"): de
           secundaire "Daily plan with Premium"-knop op het slotscherm is
           weg — droeg bij aan de overlap/te-lange-scherm-problemen
           hiervoor en is geen essentiële stap in de onboarding-flow. */}

        {/* Operator, 23 september 2026 ("verwijder die bal met voice en
           haptics"): de tikbare instellingenstrook is weer weg — de
           begeleiding staat nu terug (enkel als icoon, niet tikbaar) in de
           ring zelf, zie `SlideStart`. Aanpassen kan straks via de echte
           breathwork-sessie/actieve kaart, niet hier in de preview. */}

        <Animated.View style={ctaShakeStyle}>
        <Pressable
          onPress={ctaBlocked ? onBlockedTap : goNext}
          onPressIn={ctaBlocked ? undefined : onCtaPressIn}
          onPressOut={ctaBlocked ? undefined : onCtaPressOut}
          android_ripple={ctaBlocked ? undefined : { color: 'rgba(255,255,255,0.12)' }}
          style={s.ctaWrap}
        >
          {(isLast || slide === 1 || slide === 2 || slide === 3) && !ctaBlocked ? (
            /* Operator, 7 september 2026 (mockup): witte knop op de foto
               i.p.v. blauw of het donkere verloop — dit slotscherm is
               donker met een foto, geen van beide andere stijlen past.
               Operator, 22 september 2026 ("next cta moet hier pas actief
               en wit worden bij keuze gemaakt"): stap 3 (`slide === 2`)
               krijgt dezelfde witte knop, maar pas ZODRA `changeGoals`
               niet meer leeg is (`!ctaBlocked`) — zie de gedimde tak
               hieronder voor de toestand ervoor.
               Operator, 22 september 2026 (vervolg, "cta moet identiek
               zelfde als in stap 3"): stap 4 (`slide === 3`) volgt exact
               dezelfde regel, gezelfde `ctaBlocked`.
               Operator, 22 september 2026 (vervolg, veiligheidsdisclaimer):
               `isLast` volgt nu dezelfde regel — pas wit zodra
               `safetyAck` waar is (ook via `ctaBlocked`).
               Operator, 22 september 2026 (vervolg, "ook bij stap 2 echte
               keuze laten maken"): was ONVOORWAARDELIJK wit op `slide ===
               1` ("geen keuze wordt gemaakt") — nu ook via `ctaBlocked`,
               dus pas wit zodra `demoMode` gezet is. */
            <View style={[s.cta, { backgroundColor: '#ffffff' }]}>
              <Text style={s.ctaTxtDark}>{ctaLabel}</Text>
            </View>
          ) : ctaBlocked ? (
            /* Gedimde, inerte staat — geen keuze gemaakt op stap 2/3/4, of
               veiligheidsdisclaimer nog niet bevestigd op het slotscherm.
               Zelfde blur-basis als de standaardknop, maar zonder de
               witte tint en met gedempte tekst, zodat het verschil met de
               "klaar om te tikken"-witte knop hierboven meteen duidelijk
               is. */
            <View style={[s.cta, s.ctaBlurWrap]}>
              <BlurView
                intensity={40}
                tint="dark"
                blurMethod="dimezisBlurViewSdk31Plus"
                style={StyleSheet.absoluteFill}
              />
              <Text style={s.ctaTxtBlocked}>{ctaLabel}</Text>
            </View>
          ) : (
            /* Operator, 22 september 2026 ("next knop ook transparant...
               exact de stijl van breathwork protocolflow doortrekken"):
               vervangt het effen blauw (lichte stappen) en het blauwe
               verloop (donkere stappen) door dezelfde matglas-knop als de
               rest van de app — echte `BlurView`
               (`dimezisBlurViewSdk31Plus`) + een doorschijnende blauwe
               tint, i.p.v. een vol vlak. Zelfde recept ongeacht `light`,
               want de knop staat altijd op een foto/donkere achtergrond,
               nooit op een effen vlak dat om een eigen kleur vraagt. */
            <View
              style={[s.cta, s.ctaBlurWrap]}
              onLayout={(e) => setCtaWidth(e.nativeEvent.layout.width)}
            >
              <BlurView
                intensity={40}
                tint="dark"
                blurMethod="dimezisBlurViewSdk31Plus"
                style={StyleSheet.absoluteFill}
              />
              {/* Operator, 22 september 2026: eerst een blauwe tint, toen
                 "blur zwart transparant" (geen tint) — maar op de donkere
                 foto viel de knop zo bijna weg, geen randcontrast. "Geef
                 dat een witte transparante kleur": een lichte, doorschijnende
                 witte tint bovenop de blur, zodat de knop weer een eigen
                 vorm heeft i.p.v. te versmelten met de achtergrond. */}
              <View style={[StyleSheet.absoluteFill, s.ctaTintWhite]} />
              <Text style={s.ctaTxt}>{ctaLabel}</Text>
              {/* Operator, 22 september 2026 ("lichtflits zoals bij welcome
                 in breathwork, ook bij onboarding eerste stap"): enkel op
                 stap 1 — "eerste stap" letterlijk, niet elke stap die deze
                 knopstijl deelt. */}
              {slide === 0 && (
                <Animated.View style={[s.ctaShimmer, ctaShimmerStyle]} pointerEvents="none">
                  <LinearGradient
                    colors={['#ffffff00', '#ffffff9a', '#ffffff00']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              )}
            </View>
          )}
        </Pressable>
        </Animated.View>
      </View>
      </SafeAreaView>
    </View>
  );
}

/* ── Scherm 1 — wat dit is ────────────────────────────────────────────── */

/* Ook gebruikt door de Breath-tab, die hem als welkomstbeeld toont voordat
   je bij de vijf toestanden komt (operator, 5 augustus 2026). Daarom
   geëxporteerd in plaats van gekopieerd: één beeld, één plek waar het
   verandert. */
/* Hetzelfde lichtere/warmere blauw als op welcome.tsx (HAPTIC_BLUE
   daar, letterlijk dezelfde hex) — operator, 6 september 2026: "hou
   rekening met ons nieuwe blauw dat we ook op de welcome page gebruikt
   hebben". Alle blauwtinten in de LICHTE stand van dit scherm gaan via
   deze ene constante, niet los verzonnen per plek. */
const LIGHT_BLUE = '#7FB2E5';

/* Lichte variant van de GradientText-kleurstops (operator, 6 september
   2026, light-thema Breath-tab) — donker links → blauw rechts, het
   spiegelbeeld van de witte-naar-blauw stops die op donkere achtergrond
   staan. Zelfde aantal stops als de originelen zodat de posities-array
   (DEFAULT_POSITIONS/SUB_POSITIONS) herbruikt kan worden. */
const LIGHT_HEAD_COLORS = ['#0a0a0c', '#0a0a0c', '#3d5f8a', '#5f92c4', LIGHT_BLUE];
const LIGHT_SUB_COLORS = [
  '#0a0a0c',
  '#0a0a0c',
  '#3d5f8a',
  '#5f92c4',
  LIGHT_BLUE,
  LIGHT_BLUE,
];

export function SlideIntro({
  onTapOrb,
  light = false,
}: {
  onTapOrb: () => void;
  light?: boolean;
}) {
  /* Reactief, niet bevroren — zie de toelichting bij `FACES_CUTOUT`
     hierboven. */
  const FACES = useAssetUri(FACES_URL);

  /* Eén klok voor het beeld én de kop eronder — daarom staat hij hier en
     niet in het beeldonderdeel. De regel ademt mét de wolk in plaats van
     ernaast, inclusief de stilstanden.

     Rustiger, en met twee STILSTANDEN (operator, 3 augustus 2026). Hiervoor
     gleed de waarde in één beweging op en neer, dus stond het beeld nooit
     vol: je zag de gezichten zich vormen en meteen weer uiteenvallen. Nu
     blijft hij anderhalve seconde boven staan — dát is het moment waarop je
     het gezicht compleet ziet — en een seconde onder, waarin de wolk
     helemaal uiteen is. */
  /* ── Continu ademen, niet één keer aankomen ──────────────────────────────
     De vorige versie ("Eén keer, en dan blijft het staan") hoorde bij de
     foto→rozet-overgang die hier stond: een aankomst die maar één keer
     gebeurt. Nu de foto weg is (operator, 13 augustus 2026 — herhaalde
     black-screen-klachten) ÍS de mandala het hele scherm, en die hoort dan
     ook net zo te blijven ademen als overal elders in de app: in en uit,
     doorlopend. Zonder deze cyclus bevroor `breath` na de eerste (voorheen
     eenmalige) stijging permanent op 1, en daarmee ook de "in en uit"-schaal
     van de mandala (operator: "moet ook in en uit ademen"). */
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withDelay(
      LOOK_MS,
      withRepeat(
        withTiming(1, { duration: RISE_MS, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
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
  /* Eén draaiing voor beide lagen. De getekende rozet draaide op zijn eigen
     klok en de puntenversie draaide helemaal niet — dus zag je de draaiing
     "beginnen" op het moment dat de getekende erin kwam. Nu draait de wolk al
     mee terwijl hij de rozet nog aan het vormen is, en neemt de getekende
     versie die beweging over.

     Dezelfde omlooptijd van twintig seconden als HapticOrb aanhoudt, en
     allebei beginnen ze bij het openen van het scherm — dus lopen ze gelijk.
     Bewust GEEN gedeelde waarde: die had ik erin gezet en daarmee de
     draaiing van de getekende rozet stukgemaakt, terwijl die het prima deed. */
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(
      /* 20 → 13 seconden per omwenteling (operator: de mandala draaide in
         slowmotion). MOET gelijk blijven aan HapticOrb — zelfde getal daar. */
      withTiming(1, { duration: 13000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [spin]);

  /* Stijgt de adem of daalt hij? Nodig omdat de foto omhoog meteen moet wijken
     en omlaag juist zo lang mogelijk moet opbouwen — één formule kan die twee
     niet allebei.

     AFGELEZEN aan de ademwaarde zelf, niet apart geanimeerd. Dat stond hier
     eerst als een eigen reeks met dezelfde tijden, en die liep niet betrouwbaar
     gelijk; het gevolg was dat beide richtingen zich als "dalend" gedroegen en
     de morph omhoog daardoor onzichtbaar bleef. Wat de waarde werkelijk doet
     is de enige bron die niet uit de pas kan lopen. */
  const flow = useSharedValue(0);
  useAnimatedReaction(
    () => breath.value,
    (cur, prev) => {
      if (prev === null || cur === prev) return;
      flow.value = cur < prev ? 1 : 0;
    },
  );

  /* ── Waar de lagen elkaar aflossen ──────────────────────────────────────
     Alle drie de vensters lopen tot HELEMAAL aan het einde door (operator,
     3 augustus 2026: "de foto en mandala verschijnen te snel volledig
     waardoor de morph niet afgemaakt lijkt").

     Dat was precies wat er gebeurde. De rozet stond al vol op 0.94 en de
     foto al vol op 0.30, terwijl de punten nog tot 1.0 respectievelijk 0.0
     doorreisden. Het laatste stuk van de reis speelde zich dus af achter een
     beeld dat er al helemaal stond — de beweging werd afgedekt in plaats van
     afgemaakt.

     Nu bereikt elke laag zijn volle sterkte pas op het uiterste punt, waar de
     adem toch al stilstaat. Wat je ziet is dan het einde van de beweging, en
     niet het begin van de stilstand. */
  /* ALTIJD zichtbaar (operator, 13 augustus 2026: "als je het niet kan met
     de foto moet de foto gewoon weg" — na herhaalde black-screen-klachten,
     tot een minuut lang, op de foto hieronder). De mandala is zuiver Skia-
     vectorwerk zonder netwerkbeeld erin en tekent daarom altijd meteen —
     dat bewees zich in elke test dit hele traject. Ze draagt nu het scherm
     in plaats van pas op te komen ná een beeld dat soms niet komt. */
  const orbFade = useAnimatedStyle(() => ({ opacity: 1 }));
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

  /* Operator, 22 september 2026 ("onboarding step 1 de breathe build...
     zelfde als in de breathwork tab welcome scherm"): zelfde gestapelde
     "Breathe / Build / Become"-behandeling en dezelfde eenmalige
     staggered-entrance-animatie als (tabs)/breath.tsx se eigen intro-
     scherm (`wordReveal`/`WORD_STAGGER_MS`/`WORD_RISE_MS` daar) — exact
     dezelfde fonts/maten, enkel donkere tekst i.p.v. wit (dit scherm
     staat op een lichte foto-achtergrond, niet op zwart). */
  const WORD_STAGGER_MS = 220;
  const WORD_RISE_MS = 620;
  const wordReveal = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  useEffect(() => {
    wordReveal.forEach((v, i) => {
      v.value = withDelay(
        300 + i * WORD_STAGGER_MS,
        withTiming(1, { duration: WORD_RISE_MS, easing: Easing.out(Easing.cubic) }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Operator, 22 september 2026 ("breathe build become moet om de beurt
     even vergroten net zoals bij welcome breath pagina"): elk woord popt
     nu ook kort iets groter op tijdens zijn eigen reveal (overshoot naar
     1.08, dan terug naar 1) i.p.v. enkel op te schuiven — hergebruikt
     dezelfde `wordReveal`-waarde, geen nieuwe shared values nodig. */
  const wordStyle1 = useAnimatedStyle(() => ({
    opacity: wordReveal[0].value,
    transform: [
      { translateY: 10 * (1 - wordReveal[0].value) },
      { scale: interpolate(wordReveal[0].value, [0, 0.7, 1], [0.85, 1.08, 1]) },
    ],
  }));
  const wordStyle2 = useAnimatedStyle(() => ({
    opacity: wordReveal[1].value,
    transform: [
      { translateY: 10 * (1 - wordReveal[1].value) },
      { scale: interpolate(wordReveal[1].value, [0, 0.7, 1], [0.85, 1.08, 1]) },
    ],
  }));
  const wordStyle3 = useAnimatedStyle(() => ({
    opacity: wordReveal[2].value,
    transform: [
      { translateY: 10 * (1 - wordReveal[2].value) },
      { scale: interpolate(wordReveal[2].value, [0, 0.7, 1], [0.85, 1.08, 1]) },
    ],
  }));

  return (
    /* Extra ruimte ONDER het blok. Omdat `slideArea` zijn kind centreert,
       schuift het zichtbare deel daardoor omhoog — en dat was nodig, want
       met deze hoge bol bleef er bovenaan merkbaar meer lucht over dan
       onderaan (operator 2026-07-31). */
    <View style={[s.slide, light ? s.slideIntroLight : s.slideIntro]}>
      {light ? (
        /* Operator, 6 september 2026 (mockup): geen WELCOME/wordmark/mandala
           meer op deze stap — enkel de foto, daaronder rechtstreeks de kop.
           `slideIntroLight` zet kop+subtekst nu zelf onderaan
           (justifyContent: flex-end), geen aparte spacer meer nodig. */
        <View />
      ) : (
        <>
          {/* Klein en gedempt: een begroeting hoort niet te concurreren met
             de kop eronder. Die kop draagt de belofte, dit alleen de toon. */}
          <Text style={s.welcome}>WELCOME</Text>

          {/* De twee gezichten in plaats van de bol (operator, 3 augustus
              2026). Ze ademen op dezelfde klok als de kop eronder — één
              gedeelde waarde, dus de regel en de wolk lopen exact gelijk. De
              klop die je voelt blijft: die hing aan de bol en wordt nu apart
              aangeslagen, één keer per ademcyclus. */}
          {/* Twee lagen op elkaar, even groot en op dezelfde plek: de
              mandala zoals hij was, en de puntenwolk die hem overneemt. */}
          <Pressable onPress={onTapOrb} style={{ width: ORB, height: ORB }}>
            <Animated.View style={[StyleSheet.absoluteFill, orbFade]}>
              {/* Op ONZE ademwaarde, niet op zijn eigen. Anders zet de rozet
                  uit terwijl de punten al krimpen en klopt de beweging niet
                  meer. */}
              {/* Op onze ADEM, maar op zijn EIGEN draaiing.

                  Ik had hem ook van zijn draaiing afgehaald, en dat was fout:
                  die werkte al en heeft niets te maken met het probleem dat
                  ik wilde oplossen. Hier hoort alleen de adem gedeeld te
                  worden, want die bepaalt of de figuur uitzet of krimpt — en
                  dáár liep hij tegen de puntenwolk in.

                  De draaiing van de wolk staat los en heeft dezelfde
                  omlooptijd, zodat er al beweging in zit voordat deze laag
                  verschijnt. */}
              {/* GEEN `onPulse` meer (operator, 3 augustus 2026): de overgang
                  is alleen visueel. Een telefoon die uit zichzelf begint te
                  trillen terwijl je nog aan het kijken bent, onderbreekt
                  precies het moment dat het beeld moet dragen.
                  Tikken op de figuur trilt nog wél — dat vraagt de bezoeker
                  zelf, en dan is het antwoord op een handeling in plaats van
                  een onderbreking. */}
              <HapticOrb size={ORB} breath={breath} />
            </Animated.View>
          </Pressable>
        </>
      )}

      {/* Wit, met één schuine blauwe lichtband erdoorheen die naar rechts
         volledig blauw wordt. Niet losse woorden blauw kleuren — het blauw
         hoort bij het licht, niet bij de letters. De drie woorden komen om
         de beurt naar voren, één ronde per ademcyclus, dus de golf door de
         regel loopt gelijk met de golf door de ring. */}
      <Animated.View style={[s.headlineWrap, headBreath]}>
        {/* Operator, 6 september 2026: "geen gradient, gewoon 1 kleur
           zwart" — in lichte stand gewone effen tekst i.p.v. GradientText
           (dat draagt hier geen enkele animatie meer, dus geen reden meer
           voor de Skia-omweg). */}
        {light ? (
          <View style={s.stackTitle}>
            <Animated.Text style={[s.stackWord1Light, wordStyle1]}>Breathe</Animated.Text>
            <Animated.Text style={[s.stackWord2Light, wordStyle2]}>Build</Animated.Text>
            <Animated.Text style={[s.stackWord3Light, wordStyle3]}>Become</Animated.Text>
          </View>
        ) : (
          <GradientText
            text="BREATHE. BUILD. BECOME"
            size={23}
            width={CONTENT_W}
            weight="regular"
            tracking={3.6}
            stagger
            cycleMs={WORD_CYCLE_MS}
          />
        )}
      </Animated.View>

      {/* Tagline draagt de merkbelofte: één regel, wit, dezelfde schuine
         band eroverheen. */}
      {/* Twee regels i.p.v. één. Op één regel met kapitalen en ruime
         letterafstand valt de punt in het midden weg en lees je het als één
         lange zin; zo staan de twee beloftes duidelijk náást elkaar. Geen
         punt aan het eind — koppen zijn labels, geen zinnen. */}
      {/* "CONTROL YOUR VIBE / LIFE" weg (operator, 10 augustus 2026): dat
          staat al als de kop van het app-welkomstscherm (welcome.tsx), een
          paar tikken hiervoor — hier nogmaals is dubbel. De oude
          welcome.tsx-subregel ("CHANGE THE GAME · UNLOCK YOUR FULL
          POTENTIAL", daar zelf weggehaald toen de kop het al zei) hoort
          hier thuis: deze onboarding-slide heeft geen eigen kop-tekst die
          het al zegt. */}
      {/* Operator, 6 september 2026: in lichte stand weg (mockup gaat direct
         van de kop naar de iconenrij, geen aparte taglineregel — dat stond
         hier enkel als vulling op donker). */}
      {!light && (
        <>
          <GradientText
            text="CHANGE THE GAME"
            size={SUB_SIZE}
            width={CONTENT_W * 0.94}
            weight="regular"
            colors={SUB_COLORS}
            positions={SUB_POSITIONS}
            tracking={SUB_TRACK}
            style={s.taglineWrap}
          />
          <GradientText
            text="UNLOCK YOUR FULL POTENTIAL"
            size={SUB_SIZE}
            width={CONTENT_W * 0.94}
            weight="regular"
            colors={SUB_COLORS}
            positions={SUB_POSITIONS}
            tracking={SUB_TRACK}
            style={s.taglineLine2}
          />
        </>
      )}

      {light ? (
        /* Operator, 6 september 2026 (mockup): geen iconenrij meer — één
           rustige subtekstregel onder de kop, "moet rustiger".
           Operator, 22 september 2026 ("weet gebruiker nu wat er aan het
           gebeuren is?" → "verwijder hier control the input, laat alles
           op dezelfde plaats staan"): de merk-tagline is hier weg — enkel
           de functionele oriëntatie-regel blijft, met een groter eigen
           `marginTop` (was 10 t.o.v. de tagline erboven) zodat hij op
           ongeveer dezelfde plek landt als voorheen i.p.v. omhoog te
           springen naar waar de tagline stond. */
        <Text style={[s.introOrientLight, { marginTop: 34 }]}>
          A few quick steps, then your first session
        </Text>
      ) : (
        <View style={s.traits}>
          {TRAITS.map(({ key, label, Icon }, i) => (
            <View key={key} style={s.traitItem}>
              {i > 0 && <View style={s.traitDivider} />}
              <Icon size={13} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
              <Text style={s.traitTxt}>{label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ── Scherm 2 — hoe je begeleid wordt ─────────────────────────────────── */

/* Dekt de volledige demo-cyclus in `onPickMode` (inhale meteen, hold-in op
   3000ms, exhale op 5000ms) + de exhale-cue zelf, zodat de puls niet dooft
   terwijl de stem nog spreekt. */
const VOICE_DEMO_MS = 7500;

function SlideGuidance({
  onPick,
  chosenMode,
  light = false,
}: {
  onPick: (m: GuidanceMode) => void;
  chosenMode: GuidanceMode | null;
  light?: boolean;
}) {
  /* Operator, 22 september 2026 (Apple HIG, "geen vinkjes maar een
     'luister'-status, tijdelijke dynamische animaties"): `playing` is
     lokaal en TRANSIENT — enkel voor de "nu speelt dit"-puls in `ModeRow`,
     los van de echte, bewaarde instelling (die loopt nog steeds via
     `onPick` → `onPickMode` in de aanroeper, ongewijzigd — zie de
     toelichting daar).
     Operator, 22 september 2026 (vervolg, "de cirkel moet wel blijven
     zolang spraak niet is geëindigd"): geen vaste 1,8s meer voor élke
     modus. Voice/Voice+Haptics spelen sinds de vorige wijziging een
     volledige inhale→hold→exhale-cyclus (`onPickMode` hierboven: exhale
     start pas op 5000ms) — bij een vaste 1,8s doofde de puls dus allang
     terwijl de stem nog aan het inhalen/vasthouden was. `VOICE_DEMO_MS`
     dekt die hele cyclus + de exhale-cue zelf; Haptics/Silent (geen
     spraak) houden de kortere, oorspronkelijke duur. */
  const [playing, setPlaying] = useState<GuidanceMode | null>(null);
  const playingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (playingTimer.current) clearTimeout(playingTimer.current);
  }, []);
  /* Operator, 22 september 2026 ("bij aantikken popup met info... ze mogen
     niet uit de flow geraken"): een in-scherm `Modal` i.p.v. `router.push`
     naar de Bracelet-tab — de onboarding-flow blijft actief eronder. */
  const [braceletInfo, setBraceletInfo] = useState(false);
  const handlePress = (key: GuidanceMode) => {
    onPick(key);
    setPlaying(key);
    const wantsVoice = key === 'voice' || key === 'both';
    if (playingTimer.current) clearTimeout(playingTimer.current);
    playingTimer.current = setTimeout(() => setPlaying(null), wantsVoice ? VOICE_DEMO_MS : 1800);
  };

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
      {/* Operator, 23 september 2026 ("de lichtbron op de achtergrond mag
         weg in onboarding"): de `AuroraGlow`-achtergrondgloed (kleurde mee
         met de gekozen modus zolang die speelde) is weg — de rand-gloed +
         icoonpuls op de kaart zelf geven al genoeg selectiesignaal. */}
      {/* Operator, 22 september 2026 ("ook de fontstijl en layout moet
         zelfde als in de app protocol settings"): vervangt de gecentreerde,
         grote-kapitalen "titleBlock" (uitgelegd in de vorige versie van
         deze comment) door exact dezelfde kop/subkop-taal als goal.tsx/
         intensity.tsx — links uitgelijnd, `TypeScale.pageHeader` (bold/30)
         + `TypeScale.pageSubhead` (regular/16), geen aparte Skia-tekst of
         gestapelde twee-regel-kop meer. De adem-animatie op de kop blijft
         (`titleBreath`), enkel de vorm/uitlijning verandert. */}
      <Animated.View style={[{ alignSelf: 'stretch' }, titleBreath]}>
        {/* Operator, 22 september 2026 ("choose your rhythm misschien
           beter zo krijgen we meer ruimte"): was een geforceerde 2-regel
           kop ("Your rhythm\nYour choice") — deze ene regel geeft dezelfde
           boodschap terug en maakt de verticale ruimte vrij die de
           bracelet-teaserkaart eronder nodig heeft. */}
        <Text style={s.header}>Choose your rhythm</Text>
        <Text style={s.lead}>Tap. See. Hear. Feel</Text>
      </Animated.View>

      {/* Operator, 22 september 2026 ("ik vind het niet goed, ik wil
         verschillende transparante kaarten in verschillende groottes en
         de iconen wit"): de verticale lijst (Apple HIG-poging, ronde 2)
         is terug een kaarten-grid — nu een bento-opzet zoals goal.tsx's
         eigen grid (2 grote tegels boven, kleinere eronder), echte
         matglas-kaarten (`BlurView`), en witte iconen i.p.v. de moduskleur
         (die kleur zat al op de rand/gloed, geen dubbel signaal meer). De
         "speelt nu"-puls (geen blijvend vinkje, wel tijdelijke feedback —
         dat deel bleef ongemoeid, enkel het uiterlijk veranderde) blijft
         hetzelfde `playing`-mechanisme. */}
      <View style={s.modeGrid}>
        {GUIDANCE_MODES.map((m, i) => (
          <ModeCard
            key={m.key}
            cfg={m}
            desc={MODE_DESCRIPTIONS[m.key]}
            big={i < 2}
            playing={m.key === playing}
            selected={m.key === chosenMode}
            dimmed={chosenMode !== null && m.key !== chosenMode}
            onPress={() => handlePress(m.key)}
          />
        ))}
      </View>

      {/* Operator, 22 september 2026 ("zet je onder de kaarten een
         vertical kaart met de bracelet in"): 5e, volle-breedte kaart onder
         het 2×2-raster — geen 5e "modus" (dat blijft de 4 hierboven), maar
         een teaser die naar een infopopup leidt i.p.v. een keuze te zijn. */}
      <BraceletTeaserCard onPress={() => setBraceletInfo(true)} />
      <BraceletInfoModal
        visible={braceletInfo}
        onClose={() => setBraceletInfo(false)}
      />
    </View>
  );
}

/* Volle-breedte teaser-kaart onder de 4 gidsmodi-kaarten — zelfde
   matglas-rand-taal als `ModeCard`, maar met de operator-aangeleverde
   productfoto als achtergrond i.p.v. een icoon. Geen selectiestatus (geen
   `active`/`playing`): dit is geen keuze, enkel een aankondiging die je
   meer info geeft. Bronbeeld 1024×1536, effen zwarte achtergrond,
   dramatisch belicht. */
const BRACELET_TEASER_SRC_W = 1024;
const BRACELET_TEASER_SRC_H = 1536;
/* Operator, 23 september 2026 ("onderkant van de kaart is beetje te kort
   afgesneden"): 150 → 164, iets meer verticale ruimte zodat de armband
   onderaan niet zo krap wordt afgesneden. */
const BRACELET_TEASER_CARD_H = 164;

function BraceletTeaserCard({ onPress }: { onPress: () => void }) {
  const IMG = useAssetUri(BRACELET_TEASER_IMG);
  const [w, setW] = useState(0);
  /* Handmatige crop: kader-brede "cover"-schaal met een extra
     `ZOOM`-factor eronder (kleiner beeld, dus de armband zelf ook
     kleiner) en een `V_OFFSET` naar beneden (schuift de zichtbare
     cropvenster omlaag, dus meer van de lege zwarte ruimte bovenaan
     blijft zichtbaar, de armband zakt lager in de kaart). De rand rond
     het beeld blijft naadloos zwart — de kaart zelf heeft geen eigen
     achtergrondkleur, dus de donkere schermachtergrond schijnt er gewoon
     doorheen. */
  const ZOOM = 0.8;
  const V_OFFSET = 22;
  const coverScale = w > 0
    ? Math.max(w / BRACELET_TEASER_SRC_W, BRACELET_TEASER_CARD_H / BRACELET_TEASER_SRC_H)
    : 0;
  const scale = coverScale * ZOOM;
  const dispW = BRACELET_TEASER_SRC_W * scale;
  const dispH = BRACELET_TEASER_SRC_H * scale;
  return (
    <Pressable
      onPress={onPress}
      style={s.braceletTeaser}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {w > 0 && (
        <Image
          source={{ uri: IMG }}
          resizeMode="stretch"
          style={{
            position: 'absolute',
            left: (w - dispW) / 2,
            top: (BRACELET_TEASER_CARD_H - dispH) / 2 + V_OFFSET,
            width: dispW,
            height: dispH,
          }}
        />
      )}
      <View style={s.braceletTeaserBadge}>
        <Text style={s.braceletTeaserBadgeTxt}>Launching Fall 2026</Text>
      </View>
    </Pressable>
  );
}

/* In-flow infopopup — houdt de bezoeker op dit onboarding-scherm i.p.v.
   'm naar de Bracelet-tab te sturen (operator: "ze mogen niet uit de flow
   geraken"). Functie hier is haptic guidance through the wrist voor
   breathwork — dezelfde begeleide ademsessie doorgezet als haptiek op de
   pols, NIET de losse "Instant State Control"-pitch. Tekst is de
   goedgekeurde FAQ-zin geherformuleerd, geen nieuwe claim. */
function BraceletInfoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const IMG = useAssetUri(BRACELET_TEASER_IMG);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.braceletModalScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.braceletModalCard}>
          <Image source={{ uri: IMG }} style={s.braceletModalImg} resizeMode="cover" />
          <View style={s.braceletModalBody}>
            <Text style={s.braceletModalEyebrow}>SMART BEAD BRACELET</Text>
            <Text style={s.braceletModalTitle}>Wear the rhythm</Text>
            <Text style={s.braceletModalSubhead}>
              {'Haptic guidance, designed\nas a statement piece'}
            </Text>
            <View style={s.braceletModalFeatures}>
              <View style={s.braceletModalFeatureRow}>
                <View style={s.braceletModalBullet} />
                <Text style={s.braceletModalFeature}>Feel the pulse</Text>
              </View>
              <View style={s.braceletModalFeatureRow}>
                <View style={s.braceletModalBullet} />
                <Text style={s.braceletModalFeature}>Follow the rhythm</Text>
              </View>
              <View style={s.braceletModalFeatureRow}>
                <View style={s.braceletModalBullet} />
                <Text style={s.braceletModalFeature}>Stay present</Text>
              </View>
            </View>
            <Text style={s.braceletModalText}>Use discreetly. Anytime. Anywhere.</Text>
            <View style={s.braceletModalHintRow}>
              <Info size={13} color="rgba(255,255,255,0.45)" strokeWidth={2.2} />
              <Text style={s.braceletModalHint}>Full details in the Bracelet tab in the app</Text>
            </View>
            <Pressable onPress={onClose} style={s.braceletModalClose}>
              <Text style={s.braceletModalCloseTxt}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* Matglas-kaart, twee groottes (`big` = de eerste 2 modi, groter; de
   overige 2 compacter) — zelfde bento-principe als goal.tsx se GoalTile.
   `playing` is TRANSIENT (zie `handlePress` in `SlideGuidance`, zet 'm even
   en veegt na ~1.8s weer weg) — enkel voor de tijdelijke "dit speelt nu"-
   iconpuls. De rand-gloed zelf volgt sinds "aangeduide kaart moet
   aangeduid BLIJVEN zolang er geen andere keuze gemaakt wordt" (operator,
   23 september 2026) niet meer `playing` maar het nieuwe, WEL persistente
   `selected` (= `chosenMode`, resetzich niet na de demo). */
function ModeCard({
  cfg,
  desc,
  big,
  playing,
  selected,
  dimmed,
  onPress,
}: {
  cfg: (typeof GUIDANCE_MODES)[number];
  desc: string;
  big: boolean;
  playing: boolean;
  selected: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const sel = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    sel.value = withTiming(selected ? 1 : 0, {
      duration: selected ? 200 : 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [selected, sel]);

  /* Operator, 24 september 2026 ("rand moet niet te wit"): eindwaarde was
     0.64 (0.14 + 0.5) — merkbaar feller dan goal.tsx's vaste 0.4 bij
     selectie. Animatie zelf blijft (vloeiender dan goal.tsx's instant-
     snap, dat is een verbetering), enkel de eindwaarde nu gelijkgetrokken:
     0.14 + 1×0.26 = 0.4. */
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255,255,255,${0.14 + sel.value * 0.26})`,
  }));

  /* Puls op het icoon-rondje zolang de demo loopt. Operator, 22 september
     2026 ("mogen rustiger pulseren, mensen moeten tot rust komen"): was
     450ms per richting (~1,3 puls/sec) — voelde gejaagd voor een app die
     net kalmte belooft. 950ms is dichter bij een rustige ademhalings-
     cadans, zelfde soort tempo als `titleBreath` elders op dit scherm. */
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (playing) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 950, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [playing, pulse]);
  const iconPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.05 }],
  }));
  /* Operator, 22 september 2026 ("als de cirkels animeren moeten die mooi
     binnen het kader blijven"): schaalde tot 1,3× de iconcirkel op — bij de
     grotere iconen (nu 2,2×) groeide de ring dan voorbij het icoonvak en
     leek hij tegen/over de kaartrand te schuiven. Kleinere groei (1,14×
     max) houdt 'm ruim binnen `modeCardIconWrap`.
     Operator, 22 september 2026 (vervolg, "puls mag subtieler"): amplitude
     verder getemperd (0.3+0.4/1.14 → 0.18+0.2/1.08) — de kaartrand-gloed
     hierboven draagt nu het grootste deel van het "dit speelt nu"-signaal,
     de ring hoeft niet meer zo te schreeuwen. */
  const ringStyle = useAnimatedStyle(() => ({
    opacity: sel.value * (0.18 + pulse.value * 0.2),
    transform: [{ scale: 1 + pulse.value * 0.08 }],
  }));

  /* Operator, 23 september 2026 ("pas de volledige kaart-animatie toe op
     heel de onboarding, moet consistent zijn"): zelfde recept als
     `StartCard` (stap 5) — press-in zonder bounce, press-out MET de
     critically-damped spring, en de niet-actieve kaarten dimmen naar 0.45
     zodra er een andere kaart "speelt". */
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const cardOpacity = useSharedValue(dimmed ? 0.45 : 1);
  useEffect(() => {
    cardOpacity.value = withTiming(dimmed ? 0.45 : 1, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [dimmed, cardOpacity]);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: cardOpacity.value,
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[s.modeCardWrap, big ? s.modeCardBig : s.modeCardCompact, pressStyle]}
    >
      {/* Operator, 22 september 2026 ("alle tekst even groot en icoon
         boven de tekst"): geen rij-lay-out (icoon links) meer op de
         compacte kaarten — alle 4 kaarten zijn nu kolommen, icoon boven
         gecentreerd, tekst eronder, enkel `big` bepaalt nog de hoogte. */}
      {/* Operator, 22 september 2026 ("binnenkant van de kaarten hebben nu
         een rare vierkante gloed"): de `shadowColor`/`elevation`-gloed
         (goal.tsx se recept) teruggedraaid — rendert hier lelijk (een
         vierkante gloed BINNEN de afgeronde kaart, door `overflow:
         'hidden'` op `modeCard`). Terug naar enkel de rand-animatie. */}
      <Animated.View style={[s.modeCard, s.modeCardColumn, borderStyle]}
      >
        <BlurView
          intensity={40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        <View style={s.modeCardIconWrap}>
          {/* Operator, 22 september 2026 ("bij aantikken mag de cirkel
             wit zijn, niet gekleurd"): was `cfg.color` (de moduskleur) —
             nu wit, zelfde kleur als het icoon zelf. */}
          <Animated.View
            style={[s.modeCardRing, { borderColor: '#ffffff' }, ringStyle]}
            pointerEvents="none"
          />
          <Animated.View style={[s.modeCardIcon, iconPulseStyle]}>
            <ModeGlyph mode={cfg.key} color="#ffffff" scale={1.9} />
          </Animated.View>
        </View>
        {/* Operator, 22 september 2026 ("alle tekst headers en body tekst
           zelfde grootte, verwijder subtekst, enkel voice ... behouden"):
           geen aparte omschrijving/"Listening…"-regel meer — enkel het
           label, dezelfde tekstgrootte op elke kaart. */}
        <Text style={s.modeCardLabel} numberOfLines={2}>
          {cfg.label}
        </Text>
      </Animated.View>
    </AnimatedPressable>
  );
}

/* ── Scherm 3 — "wat wil je veranderen" ────────────────────────────────
   Nieuwe stap (operator, 6 september 2026), 1:1 op onze vijf echte
   ademtoestanden — geen zesde kaart die de app niet waarmaakt. Tot twee
   kaarten aan te vinken, zelfde opslag als de latere breath-quiz. */
function SlideChangeGoals({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (goalKey: string) => void;
}) {
  return (
    <View style={s.slide}>
      {/* Operator, 23 september 2026 ("de lichtbron op de achtergrond mag
         weg in onboarding"): de `AuroraGlow`-achtergrondgloed (kleurde mee
         met het eerste gekozen doel) is weg — de badge/rank-nummer op de
         tegel zelf geeft al genoeg selectiesignaal. */}
      <View style={s.changeHeader}>
        {/* Operator, 22 september 2026: "What's the end game?" / "Choose
           up to two, adjust anytime" — vervangt "What do you want to
           change?" / "Choose up to two. You can always adjust this
           later." Subheader zonder punt (huisstijl voor headers/
           subheaders, geen doorlopende zin meer maar één korte regel). */}
        <Text style={s.changeTitle}>What&apos;s the end game</Text>
        <Text style={s.changeSub}>Choose up to two, adjust anytime</Text>
      </View>

      {/* Operator, 22 september 2026 ("carrousel moet weg, bouwen zoals in
         build breathwork protocol"): zelfde bento-grid als `goal.tsx`'s
         "Set your state" — `selected[0]`/`selected[1]` bepalen de
         genummerde badge (1/2), exact zoals `primary`/`secondary` daar. */}
      <View style={s.changeGrid}>
        {GOALS.map((g) => {
          const rank = selected[0] === g.key ? 1 : selected[1] === g.key ? 2 : 0;
          return (
            <ChangeTile
              key={g.key}
              g={g}
              rank={rank}
              dimmed={selected.length > 0 && rank === 0}
              onPress={() => onToggle(g.key)}
            />
          );
        })}
      </View>
    </View>
  );
}

/* Bento-tegel voor stap 3 — 1-op-1 het `GoalTile`-recept van goal.tsx
   (matglas-kaart, icoon-badge, genummerde selectie, `Goal.gradient` bij
   selectie), maar met ÉÉN vaste (compacte) maat voor alle 8 tegels i.p.v.
   2 grote + 6 compacte — dit scherm mag niet scrollen, dat budget is er
   hier niet. */
function ChangeTile({
  g,
  rank,
  dimmed,
  onPress,
}: {
  g: Goal;
  rank: number;
  dimmed: boolean;
  onPress: () => void;
}) {
  const on = rank > 0;
  const Icon = g.Icon;
  /* Operator, 23 september 2026 ("pas de volledige kaart-animatie toe op
     heel de onboarding, moet consistent zijn"): zelfde recept als
     `StartCard`/`ModeCard` — press-in zonder bounce, press-out MET de
     critically-damped spring, niet-gekozen tegels dimmen naar 0.45 zodra
     er minstens 1 doel getikt is. */
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const cardOpacity = useSharedValue(dimmed ? 0.45 : 1);
  useEffect(() => {
    cardOpacity.value = withTiming(dimmed ? 0.45 : 1, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [dimmed, cardOpacity]);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: cardOpacity.value,
  }));
  /* Operator, 22 september 2026 ("enkel icoon 1 sleep better lijkt kleiner
     dan de rest"): niet de doos is anders, de brontekening zelf heeft
     minder "inkt" binnen hetzelfde canvas — exact hetzelfde kalibratie-
     probleem dat goal.tsx's eigen `GoalTile` al oploste (`iconSize = g.key
     === 'sleep' ? 62 : g.key === 'recovery' ? 53 : 46`, tegenover een
     basis van 46). Zelfde verhoudingen hier, op onze basis van 56. */
  const iconSize = g.key === 'sleep' ? 76 : g.key === 'recovery' ? 65 : 56;
  const iconNode = g.image ? (
    <Image
      source={{ uri: g.image }}
      style={{ width: iconSize, height: iconSize, tintColor: '#ffffff' }}
      resizeMode="contain"
    />
  ) : (
    <Icon size={iconSize} color="#ffffff" strokeWidth={2} />
  );

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[s.changeTile, on && s.changeTileOn, pressStyle]}
    >
      <BlurView
        intensity={40}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      {on && (
        <LinearGradient
          colors={g.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {on && (
        <View style={s.changeTileRank}>
          <Text style={[s.changeTileRankTxt, { color: g.gradient[0] }]}>
            {rank}
          </Text>
        </View>
      )}
      <View
        style={[s.changeTileContent, g.key === 'sleep' && { marginTop: -4 }]}
      >
        {iconNode}
        {/* Operator, 22 september 2026 ("tekst sleep better moet hoger
           zonder icoon te verplaatsen"): het grotere icoon (76px, zie
           `iconSize` hierboven) duwt het label via de vaste `gap:10` van
           `changeTileContent` verder omlaag dan bij de andere kaarten —
           het icoon zelf blijft precies waar het stond, enkel het label
           schuift dichterbij via een negatieve marginTop op DIT ene
           label.
           Operator, 22 september 2026 (vervolg, "icoon en tekst 1mm
           hoger"): het HELE blok (icoon + label samen) schuift nu ook nog
           1mm (~4px) omhoog, via een negatieve marginTop op de
           buitenste content-wrap hierboven — enkel voor deze kaart. */}
        <Text
          style={[s.changeTileName, g.key === 'sleep' && { marginTop: -14 }]}
          numberOfLines={2}
        >
          {g.name}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

/* ── Scherm 4 — "hoe ervaren ben je" ──────────────────────────────────
   Nieuwe stap (operator, 6 september 2026), zelfde 3 keuzes/sleutels als
   `profile.experience` in de latere breath-quiz — die vraag verdwijnt
   daar, dit is m'n enige plek. */
function SlideExperience({
  selected,
  onPick,
  safetyAck,
  onToggleSafetyAck,
  safetyShakeX,
}: {
  selected: ExperienceLevel | null;
  onPick: (key: ExperienceLevel) => void;
  safetyAck: boolean;
  onToggleSafetyAck: () => void;
  safetyShakeX: SharedValue<number>;
}) {
  const safetyShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: safetyShakeX.value }],
  }));
  return (
    <View style={s.slide}>
      <View style={s.changeHeader}>
        {/* Operator, 23 september 2026 ("verander header naar your
           experience, zo creëren we meer ademruimte"): "Your breathwork
           experience" → "Your experience" — korter, meer ruimte. */}
        <Text style={s.changeTitle}>Your experience</Text>
        <Text style={s.changeSub}>
          Select your current level{'\n'}You can always adjust this later
        </Text>
      </View>

      {/* Operator, 11 september 2026: "eerst 2 vierkanten, laatste
         (Experienced) panoramisch eronder, mooi blok" — i.p.v. 3 gelijke
         liggende kaarten onder elkaar. Blijft ongewijzigd; enkel de
         kaarten zelf zijn nu matglas i.p.v. foto's (zie ExperienceCard). */}
      <View style={s.expBlock}>
        <View style={s.expSquareRow}>
          {EXPERIENCE_OPTIONS.slice(0, 2).map((o) => (
            <ExperienceCard
              key={o.key}
              option={o}
              active={o.key === selected}
              dimmed={selected !== null && o.key !== selected}
              onPress={() => onPick(o.key)}
              width={EXP_SQUARE}
              height={EXP_SQUARE}
            />
          ))}
        </View>
        <ExperienceCard
          option={EXPERIENCE_OPTIONS[2]}
          active={EXPERIENCE_OPTIONS[2].key === selected}
          dimmed={selected !== null && EXPERIENCE_OPTIONS[2].key !== selected}
          onPress={() => onPick(EXPERIENCE_OPTIONS[2].key)}
          width={EXP_BLOCK_W}
          height={EXP_PANO_H}
        />
      </View>

      {/* Operator, 23 september 2026 ("breathwork can affect... tekst in
         de stap hiervoor onderaan zetten"): verhuisd van het slotscherm
         (stap 5) naar hier (stap 4) — zelfde niet-medische disclaimer,
         zelfde `ctaBlocked`-koppeling (nu op `slide === 3` i.p.v.
         `isLast`), enkel de plek in de flow veranderde.
         Vervolg ("tekst staat te dicht tegen de kaart" + "moet duidelijk
         zijn waarom next niet gaat"): `s.safetyRow` kreeg een eigen
         `marginTop` (zie de stijl) voor ademruimte t.o.v. de panoramische
         kaart erboven, en dit hele rijtje schudt nu (`safetyShakeStyle`,
         aangestuurd vanuit het hoofdcomponent) wanneer je op de gedimde
         CTA tikt terwijl dit de enige ontbrekende stap is. */}
      <Animated.View style={safetyShakeStyle}>
      <Pressable
        onPress={onToggleSafetyAck}
        style={s.safetyRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: safetyAck }}
      >
        <View style={[s.safetyCheck, safetyAck && s.safetyCheckOn]}>
          {safetyAck && <Check size={12} color="#0a0a0c" strokeWidth={3} />}
        </View>
        <Text style={s.safetyTxt}>
          Breathwork can affect your body quickly. If you&apos;re pregnant,
          or have epilepsy, a heart or respiratory condition, check with
          your doctor first.
        </Text>
      </Pressable>
      </Animated.View>
    </View>
  );
}

/* Eén ervaring-kaart: enkel de foto, geen overlay/tekst (operator, 7
   september 2026) — gewoon aanklikbaar.
   Operator, 22 september 2026 ("moet transparante blur zwarte kaarten
   zijn zoals overal"): de fotokaart (+ scrim, dim-overlay, ring/vinkje)
   is weg — nu hetzelfde matglas-recept als `ModeCard`/`ChangeTile`: een
   echte `BlurView`, transparante rand die oplicht bij selectie, gecentreerd
   label. Geen foto's meer nodig (`BREATH_ONBOARDING_EXPERIENCE_IMAGES` is
   sindsdien ongebruikt). */
function ExperienceCard({
  option,
  active,
  dimmed,
  onPress,
  width,
  height,
}: {
  option: (typeof EXPERIENCE_OPTIONS)[number];
  active: boolean;
  dimmed: boolean;
  onPress: () => void;
  width: number;
  height: number;
}) {
  /* Operator, 23 september 2026 ("pas de volledige kaart-animatie toe op
     heel de onboarding, moet consistent zijn"): zelfde recept als
     `StartCard`/`ModeCard`/`ChangeTile` — press-in zonder bounce,
     press-out MET de critically-damped spring, niet-gekozen kaarten
     dimmen naar 0.45 zodra er een niveau gekozen is. */
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const cardOpacity = useSharedValue(dimmed ? 0.45 : 1);
  useEffect(() => {
    cardOpacity.value = withTiming(dimmed ? 0.45 : 1, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [dimmed, cardOpacity]);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: cardOpacity.value,
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        s.expCardWrap,
        { width, height },
        active && s.expCardWrapActive,
        pressStyle,
      ]}
    >
      <BlurView
        intensity={40}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      <ExperienceWaveFill level={option.fill} active={active} />
      {/* Operator, 22 september 2026 (Apple HIG-citaat, "links-uitgelijnde
         variant voor functionele selecties"): titel + subtekst horen
         samen linksonder — `option.hint` bestond al in de data maar werd
         nooit getoond, precies de ontbrekende subtekst-regel. */}
      <View style={s.expCardTextWrap}>
        <Text style={s.expCardLabel} numberOfLines={1}>
          {option.label}
        </Text>
        <Text style={s.expCardHint} numberOfLines={1}>
          {option.hint}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

/* Operator, 22 september 2026 ("niet mooi, cirkels groter en dikkere
   randen moeten echt ringen zijn"): 44→64, ring 1.5→3. */
const EXP_WAVE_SIZE = 64;
/* Operator, 22 september 2026 ("water mag de ring niet raken, heel
   minimaal van de cirkel blijven"): het water clipt nu binnen een
   kleinere cirkel dan de ring zelf — `EXP_WAVE_INSET` is de resterende
   lucht tussen ring en waterrand. */
const EXP_WAVE_INSET = 7;
const EXP_WAVE_INNER = EXP_WAVE_SIZE - EXP_WAVE_INSET * 2;

/* "Vloeistof"-rondje per ervaringsniveau — zelfde golf-techniek als
   `AddToDayHero` (twee golf-lagen die continu naar links schuiven, geclipt
   tot een cirkel).
   Operator, 22 september 2026 ("moet vollopen bij aantikken"): was een
   vast waterpeil, altijd zichtbaar — nu leeg (`level` 0) tot de kaart
   `active` is, dan veert 'm op naar zijn niveau (New 1/3, Familiar 1/2,
   Experienced bijna vol) en zakt weer leeg zodra een ANDERE kaart gekozen
   wordt (enkelvoudige keuze, dus nooit twee tegelijk vol). */
function ExperienceWaveFill({ level, active }: { level: number; active: boolean }) {
  const target = active ? level : 0;
  const waterlineY = EXP_WAVE_INNER * (1 - target);
  const waterlineYSV = useSharedValue(waterlineY);
  useEffect(() => {
    waterlineYSV.value = withSpring(waterlineY, { damping: 9, stiffness: 100, mass: 1 });
  }, [waterlineY, waterlineYSV]);

  /* Operator, 22 september 2026 ("in principe moet enkel de bovenkant de
     golfbeweging maken, nu bounced dat heel de tijd"): de verticale `bob`
     liet het HELE gevulde vlak op-en-neer deinen — weg. Enkel de
     horizontale schuifbeweging blijft, die raakt alleen de BOVENRAND van
     het water (de curve zelf), de vulling eronder staat stil.
     Operator, 22 september 2026 ("plots is er een fout, lijkt te
     verschuiven" → "animatie is nu weg" → "moet 1 richting uitgaan, niet
     heen en weer"): de échte periode van dit pad is EXP_WAVE_INNER/2 (elk
     van de 4 identieke C-segmenten is er één, niet EXP_WAVE_INNER) — de
     eerdere schuifafstand van een volledige EXP_WAVE_INNER klopte dus
     niet exact, vandaar de zichtbare sprong bij hoog tempo. Terug naar
     één richting (`reverse:false`) met de juiste periode ÉN een rustig
     tempo (6200/4400ms, zoals `AddToDayHero`) — de eerdere "animatie is
     weg"-melding kwam van de VERKEERDE periode gecombineerd met een trage
     duur, niet van de duur op zich. */
  const wave1X = useSharedValue(0);
  const wave2X = useSharedValue(0);
  useEffect(() => {
    wave1X.value = withRepeat(
      withTiming(-EXP_WAVE_INNER / 2, { duration: 6200, easing: Easing.linear }),
      -1,
      false,
    );
    wave2X.value = withRepeat(
      withTiming(-EXP_WAVE_INNER / 2, { duration: 4400, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(wave1X);
      cancelAnimation(wave2X);
    };
  }, [wave1X, wave2X]);
  const wave1Style = useAnimatedStyle(() => ({ transform: [{ translateX: wave1X.value }] }));
  const wave2Style = useAnimatedStyle(() => ({ transform: [{ translateX: wave2X.value }] }));

  const wavePathBackProps = useAnimatedProps(() => {
    const baseY = waterlineYSV.value + 4;
    const amp = 5;
    return {
      d: `M0 ${baseY}
       C ${EXP_WAVE_INNER * 0.25} ${baseY - amp}, ${EXP_WAVE_INNER * 0.25} ${baseY + amp}, ${EXP_WAVE_INNER * 0.5} ${baseY}
       C ${EXP_WAVE_INNER * 0.75} ${baseY - amp}, ${EXP_WAVE_INNER * 0.75} ${baseY + amp}, ${EXP_WAVE_INNER} ${baseY}
       C ${EXP_WAVE_INNER * 1.25} ${baseY - amp}, ${EXP_WAVE_INNER * 1.25} ${baseY + amp}, ${EXP_WAVE_INNER * 1.5} ${baseY}
       C ${EXP_WAVE_INNER * 1.75} ${baseY - amp}, ${EXP_WAVE_INNER * 1.75} ${baseY + amp}, ${EXP_WAVE_INNER * 2} ${baseY}
       L ${EXP_WAVE_INNER * 2} ${EXP_WAVE_INNER} L 0 ${EXP_WAVE_INNER} Z`,
    };
  });
  const wavePathFrontProps = useAnimatedProps(() => {
    const baseY = waterlineYSV.value - 4;
    const amp = 4;
    return {
      d: `M0 ${baseY}
       C ${EXP_WAVE_INNER * 0.25} ${baseY - amp}, ${EXP_WAVE_INNER * 0.25} ${baseY + amp}, ${EXP_WAVE_INNER * 0.5} ${baseY}
       C ${EXP_WAVE_INNER * 0.75} ${baseY - amp}, ${EXP_WAVE_INNER * 0.75} ${baseY + amp}, ${EXP_WAVE_INNER} ${baseY}
       C ${EXP_WAVE_INNER * 1.25} ${baseY - amp}, ${EXP_WAVE_INNER * 1.25} ${baseY + amp}, ${EXP_WAVE_INNER * 1.5} ${baseY}
       C ${EXP_WAVE_INNER * 1.75} ${baseY - amp}, ${EXP_WAVE_INNER * 1.75} ${baseY + amp}, ${EXP_WAVE_INNER * 2} ${baseY}
       L ${EXP_WAVE_INNER * 2} ${EXP_WAVE_INNER} L 0 ${EXP_WAVE_INNER} Z`,
    };
  });

  return (
    <View style={s.expWaveWrap} pointerEvents="none">
      {/* Eigen, kleinere geclipte cirkel dan de ring (`EXP_WAVE_INSET`
         lucht rondom) — het water raakt de ring nooit meer. */}
      <View style={s.expWaveInner}>
        {/* Operator, 22 september 2026 ("onderaan binnen de cirkels een
           streep, dat mag niet"): bij `target === 0` (niet aangetikt) is
           er geen enkele reden om ook maar een sliver water te tekenen —
           eerst renderden de golf-lagen altijd, en bij een waterpeil
           tegen de bodem bleef er een dun lijntje water zichtbaar/
           geklipt tegen de onderrand. Nu helemaal geen golf-laag als er
           niks te vullen valt. */}
        {target > 0 && (
          <>
            {/* Operator, 22 september 2026 ("bovenrand van het water mag
               een lichter kleur voor contrast en beweging"): de achterste
               laag (het waterlichaam) getemperd naar 45% — de voorste/
               bovenste laag (de golfkam, duidelijk hoger via een grotere
               `baseY`-offset) blijft effen wit, dus leest als een lichter
               "schuim"-strookje boven op het water. */}
            <Animated.View style={[StyleSheet.absoluteFill, wave1Style]}>
              <Svg width={EXP_WAVE_INNER * 2} height={EXP_WAVE_INNER}>
                <AnimatedPath animatedProps={wavePathBackProps} fill="rgba(255,255,255,0.45)" />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, wave2Style]}>
              <Svg width={EXP_WAVE_INNER * 2} height={EXP_WAVE_INNER}>
                <AnimatedPath animatedProps={wavePathFrontProps} fill="#ffffff" />
              </Svg>
            </Animated.View>
          </>
        )}
      </View>
      <View style={s.expWaveRing} />
    </View>
  );
}

/* ── Scherm 5 — de eerste sessie ──────────────────────────────────────── */

/* Operator, 23 september 2026 ("hebben wij iconen voor boost sharp
   focus..." → "kan je die vooraan de states zetten"): zelfde iconen als
   bracelet-control.tsx se `MODE_ICONS` (Gamma/Beta/Alpha/Theta/Delta =
   boost/focus/calm/clarity/rest, exact dezelfde 5 toestanden) — geen
   nieuwe iconenset verzinnen.
   Vervolg, zelfde dag ("SF Symbols zoals target/moon.stars.fill"): Crosshair
   → Target, Moon → MoonStar — dichter bij de officiële SF Symbols-vormen,
   ook doorgevoerd in bracelet-control.tsx's MODE_ICONS zodat beide sets
   identiek blijven. */
/* Dezelfde vijf tekens als de Breath-tab (operator, 5 okt 2026). */
const STATE_ICONS = STATE_GLYPH_ICONS;

/* Sleutels van `experienceLevel` (stap 4) naar een leesbaar niveau —
   zelfde labels als `protocol.ts`'s eigen (module-lokale) `LEVEL_LABEL`. */
const EXPERIENCE_LEVEL_LABEL: Record<ExperienceLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/* Sleutels van de gekozen begeleiding (stap 2) naar een leesbaar label. */
const GUIDANCE_MODE_LABEL: Record<GuidanceMode, string> = {
  voice: 'Voice',
  haptic: 'Haptics',
  both: 'Voice + Haptics',
  silent: 'Silent',
};

/* Zelfde lokale helper als agenda.tsx (niet geëxporteerd door
   services/reminders.ts) — enkel voor het RhythmRing-label. */
const titleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/* De hero-foto van de ECHTE bibliotheek (tabs)/index.tsx — dezelfde foto,
   niet een nieuwe. Wat hier staat moet kloppen met wat je zo meteen ziet
   als je erop tikt; een ander beeld beloven dan je toont is het snelste
   om vertrouwen te verliezen. */

/* Drie regels, elk één ding (operator, 9 augustus 2026: "header en tekst
   wil ik dat jij mooi en duidelijk opsomt"). Wat het IS, wat het NU al
   kost, en wat er verandert met Premium — in die volgorde, want dat is de
   volgorde waarin iemand de vraag stelt. */
/* Twee punten, niet drie (operator, 9 augustus 2026: "de free sessions
   moeten weg, user krijgt dit samen met de breathwork 7 days free trial").
   "Free to sample" beloofde iets APARTS naast de proefperiode van
   breathwork zelf — en dat zijn er dan twee gratis-beloftes op één scherm,
   die elkaar tegenspreken zodra de trial ingaat. De bibliotheek hoort NU
   gewoon bij diezelfde proefperiode, dus die belofte staat al bij Premium;
   hier hoeft ze niet nog eens apart. */


type DayPlanItem = {
  slot: string;
  label: string;
  state: BreathStateKey;
  minutes: number;
};

/* Operator, 23 september 2026 ("op de kaarten zelf moet een i komen en
   daar de info over de state, officiële info volgens VIBEZCORE"): toont
   de ECHTE, bestaande omschrijving uit `BREATH_STATES[key]` — `eyebrow`,
   `title`, `description` (en `tagline`) — geen nieuwe copy verzinnen,
   zelfde scrim/kaart-opzet als `BraceletInfoModal` hierboven, enkel
   zonder foto (deze states hebben er hier geen bij de hand). */
function StateInfoModal({
  stateKey,
  onClose,
}: {
  stateKey: BreathStateKey | null;
  onClose: () => void;
}) {
  const cfg = stateKey ? BREATH_STATES[stateKey] : null;
  return (
    <Modal visible={!!cfg} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.braceletModalScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {cfg && (
          <View style={s.stateInfoCard}>
            <Text style={[s.stateInfoEyebrow, { color: cfg.accent }]}>{cfg.eyebrow}</Text>
            {/* Niet de figuurnaam ("Lotus") en ook niet de tagline erbij
                ("Stillness in motion") — dat hoort bij de vorm van de
                animatie, geen info voor de gebruiker (operator, 6 okt 2026). */}
            <Text style={s.stateInfoTitle}>{cfg.subtitle}</Text>
            <Text style={s.stateInfoDesc}>{cfg.description}</Text>
            <Pressable onPress={onClose} style={s.braceletModalClose}>
              <Text style={s.braceletModalCloseTxt}>Got it</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

/* Operator, 7 september 2026 (mockup, later uitgebreid naar een echt
   dagplan): "Your first session — built around your goals". Toont het
   ECHTE dagplan (zelfde `pickForSlot`-motor als plan.tsx, zie `dayPlan` in
   BreathWelcomeScreen) als 2 selecteerbare kaarten i.p.v. 1 vaste
   aanbeveling — user kiest zelf welk moment hij nu wil proeven, en die
   keuze IS de sessie die zo meteen start (`goNext` gebruikt
   `selectedPlan`). */
function SlideStart({
  plan,
  selectedIdx,
  onSelect,
  goals,
  experience,
  showRingCenter,
}: {
  plan: DayPlanItem[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  goals: string[];
  experience: ExperienceLevel | null;
  /** Operator, 24 september 2026 ("bij teruggaan moet binnenkant ring
   *  leeg tot opnieuw getikt"): puur weergave-gate, los van `selectedIdx`
   *  (die blijft een zinnig default dragen voor de CTA). */
  showRingCenter: boolean;
}) {
  const levelLabel = experience ? EXPERIENCE_LEVEL_LABEL[experience] : null;

  /* Operator, 22 september 2026 ("ik wil de agenda stijl aan linken... cirkel
     met de states langs, geen dropdown met datum, enkel vandaag"): de echte
     RhythmRing (components/RhythmRing.tsx, ook gebruikt in agenda.tsx) i.p.v.
     enkel de kaartenlijst — zo "proeft" de gebruiker meteen de echte app-UI.
     `DayPlanItem` heeft (anders dan agenda.tsx se dagplan) geen eigen
     kloktijd, enkel een `slot`-sleutel — die mappen we hier op SLOTS' vaste
     representatieve uur. `onDragEnd` krijgt een lokale override (niet naar
     de parent) zodat het ringetje na loslaten niet terugspringt — dit is
     enkel een voorproefje, geen echte herinnering die ergens opgeslagen
     wordt. */
  const [dragOverrides, setDragOverrides] = useState<Record<string, number>>({});
  /* Operator, 23 september 2026 ("op de kaarten zelf moet een i komen met
     de officiële VIBEZCORE-info, tekst in de cirkel moet weg"): het
     midden van de ring toonde tot nu toe "Voice + Haptics"/"Advanced" —
     die info verhuist naar de actieve kaart zelf (zie de kaart-render
     hieronder), en de "i" opent de ECHTE, bestaande omschrijving uit
     `BREATH_STATES[key].description` — geen nieuwe marketingtekst
     verzinnen. */
  const [infoState, setInfoState] = useState<BreathStateKey | null>(null);
  const selectedItem = plan[selectedIdx] ?? null;
  const ringItems: RhythmRingItem[] = plan.map((item, idx) => {
    const key = String(idx);
    const baseHour =
      SLOTS.find((sl) => sl.slot === item.slot)?.hour ?? new Date().getHours();
    return {
      key,
      reminderAt: dragOverrides[key] ?? baseHour * 60,
      minutes: item.minutes,
      color: BREATH_STATES[item.state].accent,
      label: titleCase(BREATH_STATES[item.state].eyebrow),
    };
  });
  /* Operator (n.a.v. "hou jij rekening met weergave van uur US en EU?"):
     JA — `toLocaleTimeString([], ...)` volgt het toestel-land, dus 12u
     AM/PM in de VS en 24u elders, automatisch. Zelfde patroon als
     `RhythmRing`'s eigen `fmtHM` (agenda.tsx se echte kloktijden) en
     `reminders.ts`'s `nextFireText` — nooit het harde 24u-string uit
     `SLOTS.when` rechtstreeks tonen. Neemt ook de `dragOverrides` mee,
     dus het uur blijft kloppen als de user het puntje versleept.
     Operator, 23 september 2026 ("20:00 correct?" — Evening hoort
     `SLOTS.evening.hour = 21` te tonen, dus 21:00/9 PM, niet 20:00): bug
     zat in `new Date(0, 0, 0, h, m)` — jaar 0 (→ 1900) heeft op sommige
     toestellen (Hermes/Android, historische tijdzone-tabellen) een
     afwijkende UTC-offset dan vandaag, wat `toLocaleTimeString` een fout
     uur laat tonen. `RhythmRing`'s eigen `fmtHM` omzeilt dit al correct
     door van VANDAAG te vertrekken (`new Date()` + `setHours`) i.p.v. een
     jaar-0-datum te bouwen — exact dat patroon hier overgenomen. */
  const selectedWhen = ringItems[selectedIdx]
    ? (() => {
        const d = new Date();
        d.setHours(
          Math.floor(ringItems[selectedIdx].reminderAt / 60),
          ringItems[selectedIdx].reminderAt % 60,
          0,
          0,
        );
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      })()
    : undefined;

  return (
    <View style={[s.slide, s.startSlideFill]}>
      {/* Operator, 11 september 2026: mandala weg — zelfde beslissing als
         stap 2/3/4/5/6. */}
      <View style={s.startHeaderWrap}>
        {/* Operator, 24 september 2026 ("Experience your session wordt
           enige header, gecentreerd"): kop+sub (23 september) vervangen
           door één gecentreerde titel — geen aparte subkop meer.
           Operator, vervolg ("Header Choose one session"): tekst
           aangepast. */}
        <Text style={[s.startTitleDark, s.startTitleCentered]}>
          Choose one session
        </Text>
        {/* Operator, 22 september 2026 ("we laten ook zijn selectie zien:
           rhythm/voice, gekozen state, experience"): korte recap-chips van
           wat op stap 2/4 gekozen werd — de gekozen STATE zelf staat al op
           elke kaart (`cfg.eyebrow`) en nu ook als kleur/label op de ring
           zelf, dus hier enkel begeleiding + ervaring. */}
      </View>

      <View style={s.startRingWrap}>
        {/* Operator, 24 september 2026 ("foto in ring step 5, gewoon
           decoratief" → "man en vrouw dichter bij elkaar"): operator-
           aangeleverde cirkelvormige foto — het lege midden is er lokaal
           uitgesneden (linker- en rechterhelft tegen elkaar geplakt), dus
           de bron is nu staand (903×1254) i.p.v. vierkant. `cover` op de
           vierkante weergave-maat snijdt boven/onder gelijk af, gezichten
           blijven gecentreerd. Puur sfeer, geen interactie. */}
        <Image
          source={require('../../assets/ring_couple.png')}
          style={s.startRingPhoto}
          resizeMode="cover"
        />
        {/* Operator, vervolg ("mag een donkere overlay"): temperen zodat de
           foto puur sfeer blijft en de ring/tekst erboven leesbaar blijft. */}
        <View style={s.startRingPhotoOverlay} pointerEvents="none" />
        <RhythmRing
          /* Operator, 24 september 2026 ("cirkel groter"): 224 → 260. */
          size={260}
          items={ringItems}
          isToday
          now={new Date()}
          itemLabelMode="none"
          showCenterInfo={false}
          animateBreath={false}
          selectedKey={String(selectedIdx)}
          onTapItem={(key) => onSelect(Number(key))}
          onDragEnd={(key, newReminderAt) =>
            setDragOverrides((prev) => ({ ...prev, [key]: newReminderAt }))
          }
        />
        {/* Operator, 23 september 2026 ("verwijder de tikbare strook, zet
           enkel icoon/iconen mee in de cirkel — minuten grootste, daaronder
           uur, daaronder de begeleidingsiconen" → "in de cirkel misschien
           gekozen state(s) weergeven i.p.v. de sound" → "de gekozen states
           in step 3 weergeven"): duur is de dominante regel, uur eronder
           kleiner, en onderaan nu de iconen van de op stap 3 gekozen
           doelen (`GOALS`, tot 2) i.p.v. het begeleidingsicoon — puur
           illustratief, NIET tikbaar (`pointerEvents="none"` op de hele
           overlay). Niveau blijft op de actieve kaart zelf
           (`startCardBadge`). */}
        {/* Operator, 23 september 2026 ("het uur in de cirkel onderaan in
           de cirkel zetten"): niet meer in de gecentreerde stapel — een
           eigen, los tekstje onderin de ring zelf (6-uur-positie), zodat
           het midden enkel nog duur + doelen toont. */}
        {selectedWhen && showRingCenter && (
          <Text style={s.startRingTimeBottom} pointerEvents="none">
            {selectedWhen}
          </Text>
        )}
        {selectedItem && showRingCenter && (
          <View style={s.startRingCenter} pointerEvents="none">
            <Text style={s.startRingDuration}>{selectedItem.minutes} min</Text>
            {/* Operator, 25 september 2026 ("level mag ook in de cirkel
               komen"): terug van de kaart (23 september) naar de ring —
               tweede omkering van dezelfde beslissing, ditmaal om
               ademruimte op de kaarten te winnen. */}
            {levelLabel && (
              <Text style={s.startRingLevel} numberOfLines={1}>
                {levelLabel.toUpperCase()} LEVEL
              </Text>
            )}
            {goals.length > 0 && (
              <View style={s.startRingGoalList}>
                {goals.map((gKey) => {
                  const g = GOALS.find((gg) => gg.key === gKey);
                  if (!g) return null;
                  const GoalIcon = g.Icon;
                  return (
                    <View key={gKey} style={s.startRingGoalRow}>
                      <GoalIcon size={17} color="rgba(255,255,255,0.75)" strokeWidth={2} />
                      <Text style={s.startRingGoalNames} numberOfLines={1}>
                        {g.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Operator, 23 september 2026 ("elke state een eigen kaart, 2
         naast elkaar" → "op de kaarten icoon en naam state, de rest komt
         in de cirkel"): kaart-grid, 2 per rij (`startCardGrid`). Elke
         kaart heeft nu een "i"-knop (opent `StateInfoModal`, de ECHTE
         `description` uit `BREATH_STATES`) — enkel icoon + naam, geen
         duur/begeleiding meer op de kaart zelf (zie ring-overlay
         hierboven). */}
      <View style={s.startCardGrid}>
        {plan.map((item, idx) => {
          /* Operator, 24 september 2026 ("bij toekomen ook geen sessie
             aangeduid"): `showRingCenter` (dezelfde vlag als de ring-
             midden-gate hierboven) bepaalt ook hier — geen kaart oogt
             actief tot een ECHTE tik op dit bezoek. */
          const active = showRingCenter && idx === selectedIdx;
          return (
            <StartCard
              key={item.slot}
              item={item}
              active={active}
              onSelect={() => onSelect(idx)}
              onInfo={() => setInfoState(item.state)}
            />
          );
        })}
      </View>
      <StateInfoModal stateKey={infoState} onClose={() => setInfoState(null)} />

      {/* Operator, 7 september 2026: "includes-tekst weg" — die boodschap
         staat al op stap 6 (Audio Library), hier niet nog eens nodig. */}

    </View>
  );
}

/* Operator, 23 september 2026 ("de kaarten moet ook onze animatie" →
   "wij hebben de andere kaarten toch een soort VERENDE animatie bij
   aanklikken" → "bounce te stroef, Apple's critically damped spring:
   response 0.22, dampingFraction 0.73"): druk-vering + rand-glow gebruiken
   `withSpring`'s `{ duration, dampingRatio }`-vorm (SwiftUI's
   `.spring(response:dampingFraction:)`-equivalent), niet de `StateThumb`-
   protocolkaart-waardes (`(tabs)/breath.tsx`) of `PressableScale`
   (bracelet-control.tsx) — zie de uitleg bij `sel`/`pressScale` hieronder.
   Eigen component (i.p.v. inline in de `.map()`) omdat hooks niet in een
   loop mogen. */
function StartCard({
  item,
  active,
  onSelect,
  onInfo,
}: {
  item: DayPlanItem;
  active: boolean;
  onSelect: () => void;
  onInfo: () => void;
}) {
  const cfg = BREATH_STATES[item.state];
  const StateIcon = STATE_ICONS[item.state];

  /* Operator, 23 september 2026 ("Apple bouwt deze animaties op basis van
     fysica i.p.v. vaste tijden" → "bounce te stroef" → "Apple's knoppen
     stuiteren nooit meerdere keren, critically damped spring: response
     0.22, dampingFraction 0.73"): eerst `mass`/`damping`-tuning geprobeerd,
     maar dat is niet hoe Apple het zelf specificeert. Reanimated heeft een
     letterlijk equivalent van SwiftUI's `.spring(response:dampingFraction:)`
     — de `{ duration, dampingRatio }`-vorm van `withSpring` (i.p.v.
     mass/stiffness/damping), waarbij `duration` ≈ Apple's `response` in ms
     en `dampingRatio` ≈ `dampingFraction` (1 = geen bounce, <1 = precies
     één mini-overshoot). Apple's exacte cijfers overgenomen: 220ms/0.73,
     op zowel de druk-vering als de rand-glow. */
  const sel = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    sel.value = withSpring(active ? 1 : 0, { duration: 220, dampingRatio: 0.73 });
  }, [active, sel]);
  /* Operator, 24 september 2026 ("rand gelijktrekken"): was een licht
     blauw-grijze tint (225,225,232) met eindwaarde 0.45 — nu zuiver wit,
     eindwaarde 0.4, zelfde als goal.tsx en stap 4's ExperienceCard. */
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255,255,255,${0.1 + sel.value * 0.3})`,
  }));

  const pressScale = useSharedValue(1);
  /* Operator ("press-in mag niet bouncen — een fysieke knop stuitert niet
     tegen de bodem"): `withTiming` (geen spring) op de indruk-fase, de
     `withSpring`-bounce is enkel voor de release hieronder. */
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  /* Operator ("focus verlagen op de niet-actieve kaarten, faden naar
     0.4-0.5 opacity, lineair/ease — mag niet mee-stuiteren met de
     rand-glow"): op dit scherm is er altijd precies één actieve kaart
     (`selectedPlanIdx` start al op een waarde), dus "geen kaart gekozen"
     bestaat hier niet — enkel `!active` bepaalt of deze kaart dimt.
     `withTiming` (geen spring), Apple's 0.45-cijfer. */
  const cardOpacity = useSharedValue(active ? 1 : 0.45);
  useEffect(() => {
    cardOpacity.value = withTiming(active ? 1 : 0.45, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [active, cardOpacity]);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: cardOpacity.value,
  }));

  return (
    <AnimatedPressable
      onPress={onSelect}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[s.startCard, pressStyle]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${item.label}: ${cfg.eyebrow}`}
    >
      <Animated.View style={[s.startCardInner, borderStyle]}>
        {/* Operator, 23 september 2026 ("kaarten moeten transparant
           blur"): echte `BlurView` — zelfde matglas-recept als
           `ExperienceCard`/`ModeCard`/`ChangeTile`, geen rgba-
           nepglas (memory: "altijd echte expo-blur BlurView"). */}
        <BlurView
          intensity={40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        {/* Operator, 23 september 2026 ("ik wil vergelijken"): TIJDELIJK
           terug — de vlakke SystemGray6-tint bovenop de blur (had 'm
           net verwijderd op "moet transparant blur"). Enkel om op het
           toestel A/B te bekijken naast de pure-blur-versie; zeg welke
           moet blijven, dan verwijder ik de andere weer. */}
        <View style={s.startCardTint} pointerEvents="none" />
        {/* Operator, 23 september 2026 ("ik zie geen tekst in de
           kaarten"): gewone flex-flow tekst NAAST de BlurView bleek
           onzichtbaar — `dimezisBlurViewSdk31Plus` rendert op Android
           via een eigen native compositing-laag die soms bóven
           gewone flow-content komt te liggen ondanks de JSX-volgorde.
           `ExperienceCard` (bevestigd zichtbaar) omzeilt dat door de
           tekst ABSOLUUT te positioneren i.p.v. gewone flow — zelfde
           aanpak hier. */}
        <View style={s.startCardContent}>
          {/* Operator, 23 september 2026 ("tekst ademruimte, verticaal
             centreren i.p.v. tegen de onderrand"): icoon + naam nu
             samen gecentreerd in de kaart, de "i"-knop staat los in de
             hoek zodat centreren het niet verstoort. */}
          <StateIcon
            size={22}
            color={active ? cfg.accent : '#ffffff'}
            strokeWidth={2.2}
          />
          <Text style={s.startCardName} numberOfLines={1}>
            {titleCase(cfg.eyebrow)}
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onInfo();
          }}
          hitSlop={10}
          style={s.startCardInfoBtn}
        >
          <Info size={15} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
        </Pressable>
      </Animated.View>
    </AnimatedPressable>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  /* Operator, 6 september 2026: stap 1 licht i.p.v. donker — de
     achtergrondfoto dekt bijna alles af, maar de rand erboven (status-
     balk-zone) moet ook al licht zijn, niet even opflitsen zwart. */
  /* Operator, 7 september 2026: "nog blauw over" — de lichtblauwe tint
     schemerde overal door waar geen foto/knop overheen lag (bv. tussen de
     "coming fall"-badge en de footer). Puur wit lost dat overal op. */
  rootLight: { backgroundColor: '#ffffff' },
  /* Operator, 22 september 2026 ("foto moet doorlopen"): de echte
     achtergrond (foto/Starfield/`rootLight`) zit nu op de buitenste
     `View` (`root`/`rootLight` hierboven) — deze `SafeAreaView` ligt daar
     transparant overheen en zorgt enkel nog voor de inspringing van de
     INHOUD, geen eigen kleur meer die de achtergrond in de inspring-zones
     zou verbergen. */
  safeContent: { flex: 1 },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  /* Over de volle breedte van de balk en gecentreerd — daardoor ligt de
     stapregel in het midden van het SCHERM en niet in het midden van wat er
     naast "Skip" overblijft. `pointerEvents` staat uit, dus hij vangt geen
     tikken weg van de knop eronder. */
  stepCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipWrap: { paddingVertical: 6, paddingHorizontal: 8 },
  skipTxt: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 14,
  },
  /* Operator, 22 september 2026 ("foto onderkant moet doorlopen, tekst-
     kleur wit"): geen aparte `light`-tekstkleur meer op deze topbar — de
     foto op stap 1 is dezelfde donkere hero-foto als elders in de app,
     dus wit/lichtgrijs overal, geen dark-op-licht-uitzondering meer.
     "Skip" blijft de secundaire actie (Apple-onboarding-tip, 11 sep):
     lichter/gedimder dan "Back", nu in de witte familie i.p.v. het
     `#8a8a8e` dat voor een lichte achtergrond gekalibreerd was. */
  /* Operator, 8 okt 2026 ("bij breath step staat geen skip of wel?"): 45%
     wit verdween op de lichte betonmuur van stap 1. Ondergeschikt maar
     altijd leesbaar: helderder + zachte schaduw, werkt op elke foto. */
  skipTxtSecondary: {
    color: 'rgba(255,255,255,0.92)',
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  /* Even breed als skipWrap (bij benadering), zodat de gecentreerde
     STEP-tekst ook echt in het midden van het SCHERM blijft staan, niet
     scheeftrekt doordat links nu ook iets staat. */
  backWrap: { minWidth: 64 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  /* Operator, 22 september 2026: vervangt `dotsRow`/`dot*` — zelfde
     `track`/`fill`-maten als de gedeelde `StepIndicator` (height 3,
     borderRadius 1.5), enkel breedte vast (niet `flex:1`) omdat dit
     scherm geen flex-rij is. Kleur nu ook altijd wit, geen `light`-
     variant meer (zie toelichting bij `skipTxtSecondary`). */
  /* Operator, 22 september 2026, vervolg ("mag dikker, moet elegant zijn"):
     3 → 5px. `shadow*` (iOS) i.p.v. Android-only `elevation` zou hier toch
     door `overflow:'hidden'` afgeknipt worden — elegant blijft dus gewoon
     dunner/subtieler dan "dik", niet een geforceerde glow-hack. */
  /* Operator, 23 september 2026 ("moet ook veel dunner"): 5 → 1.5, na de
     eerdere "mag dikker"-ronde nu net andersom — terug naar een subtiele
     lijn. */
  stepTrack: {
    width: 120,
    height: 1.5,
    borderRadius: 0.75,
    marginTop: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stepFill: { height: '100%', borderRadius: 0.75, backgroundColor: '#ffffff' },

  /* Operator, 22 september 2026 ("maak de pagina ook eens scrollbaar"):
     `contentContainerStyle` voor het slotscherm se ScrollView — zelfde
     zijmarge als `slideArea` (die hier enkel nog de VASTE `style`,
     buitenkant, van de ScrollView is), plus `flexGrow:1` zodat korte
     content (weinig kaarten) nog steeds het scherm vult i.p.v. bovenaan
     te blijven hangen; lange content (veel kaarten) scrollt gewoon. */
  startScroll: { flex: 1 },
  startScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 4,
    paddingBottom: 8,
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
  /* Operator, 22 september 2026 ("fontstijl en layout moet zelfde als in
     de app protocol settings"): exact `goal.tsx`/`intensity.tsx`'s eigen
     `header`/`lead`-paar — links uitgelijnd, `TypeScale.pageHeader`/
     `pageSubhead`, dezelfde marges/kleuren. */
  header: {
    marginTop: 4,
    ...TypeScale.pageHeader,
    textAlign: 'left',
    color: Brand.text,
  },
  lead: {
    marginTop: 6,
    ...TypeScale.pageSubhead,
    textAlign: 'left',
    color: 'rgba(255,255,255,0.55)',
  },
  /* Geen extra hoogte meer: het blok wordt gecentreerd, dus boven en onder
     valt evenveel ruimte. Dat is wat de figuur laat zweven — hem omhoog
     duwen liet een lege band onderaan achter. */
  slideIntro: {},
  /* Operator, 6 september 2026: zonder de grote ORB (die vulde voorheen het
     midden) klontert de inhoud anders samen in het midden van het scherm,
     met een groot leeg gat eronder — `slideArea` centreert zijn kind, en
     dat kind is nu veel korter. `flex:1` + `space-between` verspreidt
     header/kop/iconenrij zelf over de volledige beschikbare hoogte i.p.v.
     te vertrouwen op de centrering van de ouder. */
  slideIntroLight: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 60,
  },
  welcome: {
    marginTop: -26,
    marginBottom: 16,
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    letterSpacing: 5,
  },
  welcomeLight: { color: 'rgba(10,10,12,0.75)', marginTop: 0, marginBottom: 2 },
  welcomeSub: {
    marginBottom: 0,
    color: 'rgba(10,10,12,0.45)',
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 4,
  },
  welcomeWordmark: { width: 108, height: 18 },
  /* Operator, 6 september 2026: kleine mandala ACHTER de header i.p.v. de
     grote HapticOrb — zelfde opzet als titleBlock elders in dit bestand. */
  headerBlockLight: {
    width: CONTENT_W,
    minHeight: HEADER_MANDALA,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    marginBottom: 10,
  },
  /* Operator, 22 september 2026: het 2×2-raster met foto's werd eerst een
     verticale lijst (Apple HIG-poging), toen weer teruggedraaid ("ik wil
     verschillende transparante kaarten in verschillende groottes en de
     iconen wit") — nu een bento-grid zoals goal.tsx se eigen GoalTile: de
     eerste 2 modi groot, de overige 2 compacter, echte matglas-kaarten. */
  modeGrid: {
    alignSelf: 'stretch',
    marginTop: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeCardWrap: { width: '48%' },
  /* Operator, 22 september 2026 ("onderste kaarten moeten groter en
     iconen ook groter, alle tekst zelfde grootte, verwijder subtekst"):
     compact ging van 84 → 150 (dichter bij `modeCardBig`'s 168, niet
     langer een half zo hoge tegel), iconen en labeltekst zijn nu overal
     dezelfde maat (geen aparte "Big"-tekstvariant meer), en de omschrijving
     onder het label is helemaal weg — enkel `cfg.label` blijft.
     Operator, 22 september 2026 (vervolg, "zet je onder de kaarten een
     verticale kaart met de bracelet in... huidige kaarten mogen iets
     kleiner"): 168/150 → 144/126 om ruimte te maken voor
     `braceletTeaser` eronder, zonder te hoeven scrollen.
     Operator, 22 september 2026 (vervolg, "4 kaarten even groot maken,
     kan dat"): beide op 136 — de `big`-prop (`ModeCard`, `i < 2`) blijft
     bestaan voor eventueel later gebruik, maar heeft nu geen visueel
     effect meer. */
  modeCardBig: { minHeight: 136 },
  modeCardCompact: { minHeight: 136 },
  modeCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 14,
  },
  /* Operator, 22 september 2026 ("je mag links uitlijnen", Apple-HIG-
     mockup): label lijnt links uit, icoon linksboven.
     Operator, 22 september 2026 (vervolg, "iconen centreren en tekst
     links, alles in balans"): het icoon zelf is teruggezet naar
     gecentreerd over de volle kaartbreedte (`modeCardIconWrap`'s eigen
     `alignSelf:'center'` hieronder) — enkel het LABEL blijft links, dat
     bleek een betere balans dan beide links. */
  modeCardColumn: { justifyContent: 'flex-end', alignItems: 'flex-start' },
  /* Operator, 22 september 2026 ("icoon boven de tekst"): alle 4 kaarten
     zijn nu kolommen — geen aparte rij-vorm (icoon links) voor de
     compacte kaarten meer, dus ook maar één icoon-maat.
     Operator, 22 september 2026 ("iconen groter", toen "beetje kleiner",
     toen weer kleiner om plaats te maken voor de bracelet-teaserkaart):
     72→96→84→72, `scale` op de aanroep volgde dezelfde weg (1,8→2,6→2,2→
     1,9). `alignSelf:'center'` haalt 'm los van `modeCardColumn`'s links
     uitlijning, zodat enkel de tekst eronder links blijft. */
  modeCardIconWrap: {
    width: 72,
    height: 72,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modeCardRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  modeCardIcon: { alignItems: 'center', justifyContent: 'center' },
  /* Operator, 22 september 2026 ("Smartphone Haptics mag op 2 rijen"):
     `numberOfLines={2}` i.p.v. 1+`adjustsFontSizeToFit` — het langste
     label ("Smartphone Haptics") mag nu gewoon breken i.p.v. te krimpen.
     Eigen `lineHeight` nodig zodra een label écht 2 regels wordt. */
  modeCardLabel: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    lineHeight: 19,
    color: '#ffffff',
    textAlign: 'left',
  },

  /* 5e kaart onder het 2×2-raster — teaser, geen keuze. Vaste hoogte
     zodat het totaal voorspelbaar binnen `slideArea` past zonder scroll. */
  braceletTeaser: {
    alignSelf: 'stretch',
    /* Operator, 23 september 2026 ("op step 2 mag de bracelet kaart
       lager"): 18 → 30. */
    marginTop: 30,
    /* Moet gelijk blijven aan `BRACELET_TEASER_CARD_H` hierboven (operator,
       23 september 2026, "onderkant beetje te kort afgesneden": 150 →
       164). */
    height: 164,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  braceletTeaserBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  braceletTeaserBadgeTxt: {
    color: '#ffffff',
    fontFamily: BrandFonts.semibold,
    fontSize: 10.5,
  },

  /* Infopopup — houdt de bezoeker op dit scherm i.p.v. naar de Bracelet-tab
     te navigeren (zie `BraceletInfoModal`). Effen zwarte achtergrond. */
  braceletModalScrim: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 26,
  },
  braceletModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: Brand.panel,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  braceletModalImg: { width: '100%', height: 170 },
  braceletModalBody: { padding: 20 },
  braceletModalEyebrow: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.6,
  },
  braceletModalTitle: {
    marginTop: 5,
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
    fontSize: 20,
    lineHeight: 25,
  },
  braceletModalSubhead: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: BrandFonts.medium,
    fontSize: 13.5,
    lineHeight: 18,
  },
  braceletModalFeatures: { marginTop: 14, gap: 6 },
  braceletModalFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  braceletModalBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  braceletModalFeature: {
    color: '#ffffff',
    fontFamily: BrandFonts.semibold,
    fontSize: 14.5,
    lineHeight: 19,
  },
  braceletModalText: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.72)',
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  braceletModalHintRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  braceletModalHint: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: BrandFonts.medium,
    fontSize: 12,
  },
  braceletModalClose: {
    marginTop: 18,
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  braceletModalCloseTxt: {
    color: '#0a0a0a',
    fontFamily: BrandFonts.bold,
    fontSize: 15,
  },
  /* Operator, 23 september 2026 — "i"-info-kaart per state, zelfde
     scrim/kaart-schaal als `braceletModal*` hierboven, enkel zonder foto
     (geen padding-loze image-bovenkant, dus eigen `padding` op het vak
     zelf i.p.v. een losse `*Body`-wrapper). */
  stateInfoCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    backgroundColor: Brand.panel,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 22,
  },
  stateInfoEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  stateInfoTitle: {
    marginTop: 6,
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
    fontSize: 21,
    lineHeight: 26,
  },
  stateInfoTagline: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: BrandFonts.medium,
    fontSize: 14,
  },
  stateInfoDesc: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    lineHeight: 21,
  },

  /* Scherm 3 — "wat wil je veranderen" (en gedeeld door stap 4: "How
     experienced are you?").
     Operator, 22 september 2026 ("plaatsing en font zoals het hoort"):
     was een gecentreerde kop op donkere tekst (`#0a0a0c`) — een overblijfsel
     van toen deze stappen nog licht waren (`light = slide === 0` maakt ze
     intussen allemaal donker). Nu exact hetzelfde `header`/`lead`-recept
     als stap 1/2 hierboven: links uitgelijnd, wit, `TypeScale.pageHeader`/
     `pageSubhead`. */
  changeHeader: { alignSelf: 'stretch', marginTop: 4, marginBottom: 22 },
  changeMandalaWrap: {
    position: 'absolute',
    top: -26,
    left: 0,
    right: 0,
    bottom: 0,
  },
  changeTitle: {
    ...TypeScale.pageHeader,
    textAlign: 'left',
    color: Brand.text,
  },
  changeSub: {
    marginTop: 6,
    ...TypeScale.pageSubhead,
    textAlign: 'left',
    color: 'rgba(255,255,255,0.55)',
  },
  /* Operator, 22 september 2026 ("carrousel moet weg, bouwen zoals in
     build breathwork protocol"): vervangt de hele carrousel/ChangeCard-
     stijlengroep (`carousel`, `changeCardWrap/Img/Scrim/TextWrap/Title/
     Body/Check`, `carouselDots/Dot/DotActive`) door hetzelfde bento-grid-
     recept als `goal.tsx`'s `grid`/`tile`/`tileIconBadge`/`tileRank`/
     `tileName` — 2 kolommen, matglas-tegel, icoon-badge, genummerde
     selectie. Enige verschil: alle 8 tegels dezelfde (compacte) maat,
     geen aparte grote variant — dit scherm mag niet scrollen. */
  changeGrid: {
    alignSelf: 'stretch',
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  /* Operator, 22 september 2026 ("kaarten mogen groter en inhoud ook"):
     92→108, icoon 26→34, tekst 13→15.
     Operator, 22 september 2026 (vervolg, na het schrappen van Peak
     performance/Calm the mind, "kunnen de kaarten en iconen groter"):
     6 doelen i.p.v. 8 = 3 rijen i.p.v. 4, dus extra budget — 108→140,
     icoon 34→46, tekst 15→17, rangbadge 20→22. */
  changeTile: {
    width: '48%',
    minHeight: 140,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'center',
  },
  changeTileOn: { borderColor: 'rgba(255,255,255,0.4)' },
  changeTileRank: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeTileRankTxt: { fontFamily: BrandFonts.bold, fontSize: 11 },
  changeTileContent: { alignItems: 'center', gap: 10 },
  changeTileName: {
    ...TypeScale.cardHeadline,
    fontSize: 17,
    lineHeight: 20,
    color: '#ffffff',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  titleWrap: { marginTop: 16 },
  /* De mandala vult dit blok en ligt eronder; de hoogte volgt de tekst. */
  /* Operator, 22 september 2026 ("fontstijl en layout moet zelfde als in
     de app protocol settings"): `titleBlock`/`titleBlockLight`/
     `titleLines`/`titleLine2`/`subWrap`/`titleLineLight`/`titleLineDark`/
     `subLineLight`/`subLineDark` (de gecentreerde, grote-kapitalen kop-
     opzet van stap 2) zijn weg — vervangen door `header`/`lead` hieronder,
     exact zoals goal.tsx/intensity.tsx. */
  /* Operator, 22 september 2026 ("moet groter en wit duidelijk staan"):
     was klein en gedimd (12.5px, 45% wit) — nu zelfde grootte/kleur als
     de merk-tagline die hier eerst stond ("Control the input. Change the
     output.", intussen verwijderd op deze stap). */
  introOrientLight: {
    marginTop: 10,
    width: SCREEN_W - 64,
    textAlign: 'center',
    color: '#ffffff',
    fontFamily: BrandFonts.medium,
    fontSize: 16,
  },

  /* Scherm 1 — kop en tagline zijn Skia-tekst (GradientText); die brengen
     hun eigen hoogte mee, hier alleen de ruimte ertussen. */
  headlineWrap: { marginTop: 14 },
  /* Operator, 22 september 2026 ("onboarding step 1 de breathe build...
     zelfde als in de breathwork tab welcome scherm, check ook de
     fonts"): vervangt de vorige effen ÉÉN-regel kop (BrandFonts.bold/28,
     6 september) door exact dezelfde gestapelde 3-regel-opbouw en fonts
     als (tabs)/breath.tsx se `stackWord1`/`stackWord2`/`stackWord3` —
     zelfde `fontFamily`/`fontSize`/`letterSpacing`/`lineHeight` per
     woord. Vervolg ("foto onderkant moet doorlopen, tekstkleur wit, zie
     je niet dat het onleesbaar is"): kleur was nog donker (uitging van
     een lichte achtergrondfoto) — de echte foto hier is dezelfde donkere
     hero-foto als op de Breath-tab, dus nu ook wit, exact als daar. */
  stackTitle: { alignItems: 'center' },
  stackWord1Light: {
    fontFamily: BrandFonts.medium,
    fontSize: 28,
    letterSpacing: -0.2,
    lineHeight: 32,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
  },
  stackWord2Light: {
    fontFamily: BrandFonts.medium,
    fontSize: 48,
    letterSpacing: 0,
    lineHeight: 52,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 2,
  },
  stackWord3Light: {
    fontFamily: BrandFonts.bold,
    fontSize: 50,
    letterSpacing: -1.2,
    lineHeight: 52,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 2,
  },
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
  traitDividerLight: { backgroundColor: 'rgba(10,10,12,0.18)' },
  traitTxt: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  traitTxtLight: { color: 'rgba(10,10,12,0.6)' },

  /* Lichte iconenrij (mockup, 6 september 2026) — drie kolommen, elk een
     cirkel-icoon + label + subtekst, i.p.v. de compacte donkere rij met
     verdeelstreepjes. */
  traitsLight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: CONTENT_W,
    marginTop: 30,
  },
  traitColLight: { alignItems: 'center', width: CONTENT_W / 3.3 },
  traitIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(127,178,229,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  traitLabelLight: {
    color: '#0a0a0c',
    fontFamily: BrandFonts.bold,
    fontSize: 11.5,
    letterSpacing: 1,
  },
  traitSubLight: {
    marginTop: 3,
    color: 'rgba(10,10,12,0.5)',
    fontFamily: BrandFonts.regular,
    fontSize: 10,
    textAlign: 'center',
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

  /* Scherm 4 */

  /* Scherm 4 — "hoe ervaren ben je". Lichte fotokaarten, zelfde stijl als
     welcome.tsx en scherm 3 (operator, 6 september 2026: "premium en
     pro"). */
  /* Operator, 11 september 2026: 2 vierkanten naast elkaar + 1 panoramische
     kaart eronder, i.p.v. 3 gelijke liggende kaarten onder elkaar. */
  /* Operator, 23 september 2026 ("de 3 kaarten mogen ook beetje
     zakken"): marginTop toegevoegd t.o.v. de kop/sub erboven. */
  expBlock: { gap: ROW_GAP, width: EXP_BLOCK_W, alignSelf: 'center', marginTop: 16 },
  expSquareRow: { flexDirection: 'row', gap: GRID_GAP },
  /* Operator, 11 september 2026: "zwart blijft buiten de kaarten" —
     bleek een schaduw te zijn, geen overlay-lek: `Pressable` krijgt op
     Android standaard een elevation-schaduw zodra hij een eigen
     `backgroundColor` heeft. Expliciet uitgezet. */
  /* Operator, 22 september 2026 ("moet transparante blur zwarte kaarten
     zijn zoals overal"): zelfde matglas-recept als `ModeCard`/`ChangeTile`
     — transparante rand die oplicht bij selectie, geen witte vulling/foto
     meer. */
  /* Operator, 22 september 2026 ("niet mooi, tekst moet links" → "tekst
     links onderaan" → Apple HIG-citaat "links-uitgelijnde variant voor
     functionele selecties"): rondje linksboven, titel+subtekst samen
     linksonder — beide op de Apple-minimum marge van 16pt (was 14). */
  expCardWrap: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  expCardWrapActive: { borderColor: 'rgba(255,255,255,0.4)' },
  expCardTextWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  expCardLabel: {
    color: '#ffffff',
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    textAlign: 'left',
  },
  /* Subtekst — kleiner, gedimd (Apple's `secondaryLabel`-equivalent),
     `option.hint` uit de data. */
  expCardHint: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    textAlign: 'left',
  },
  /* "Vloeistof"-rondje linksboven — zie `ExperienceWaveFill`. Zelf geen
     clip/achtergrond meer (dat zit nu op `expWaveInner`, kleiner dan de
     ring) — enkel de positionering t.o.v. de kaart. */
  expWaveWrap: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: EXP_WAVE_SIZE,
    height: EXP_WAVE_SIZE,
  },
  /* Operator, 22 september 2026 ("water mag de ring niet raken, heel
     minimaal van de cirkel blijven"): eigen, kleinere cirkel dan de ring
     hieronder — `EXP_WAVE_INSET` lucht rondom. */
  expWaveInner: {
    position: 'absolute',
    top: EXP_WAVE_INSET,
    left: EXP_WAVE_INSET,
    width: EXP_WAVE_INNER,
    height: EXP_WAVE_INNER,
    borderRadius: EXP_WAVE_INNER / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  expWaveRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: EXP_WAVE_SIZE,
    height: EXP_WAVE_SIZE,
    borderRadius: EXP_WAVE_SIZE / 2,
    /* Operator, 22 september 2026 ("dubbel zo dik en echt wit, nu is dat
       grijs"): 3→6, en effen wit (was 40% dekkend, dat las als grijs). */
    borderWidth: 6,
    borderColor: '#ffffff',
  },

  /* Scherm 5.
     Operator, 22 september 2026 ("font vervangen zoals bij breathwork
     setting protocol" → "waarom is de kleur blauw?"): fontSize/
     letterSpacing nu exact gelijk aan de gedeelde `StepIndicator` (9/2,
     was 10/2.6) — en kleur wit i.p.v. blauw, want elke echte aanroeper
     van dat component geeft `color="#ffffff"` mee; het blauw was enkel
     de nooit-gebruikte default. */
  stepEyebrow: {
    marginTop: 2,
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 2,
  },
  /* Scherm 6 — "your first session" (operator, 7 september 2026, mockup):
     donkere foto-achtergrond, dus WITTE tekst — dit is de uitzondering op
     de lichte stappen hiervoor, geen `light`-variant nodig. */
  /* Operator, 22 september 2026 ("achtergrond moet zwart om te beginnen"):
     geen fotoachtergrond meer op dit scherm — namen (`startTitleDark`/
     `startSubDark`) ongewijzigd gelaten, kleuren nu wit-op-zwart, exact
     `changeTitle`/`changeSub`'s conventie (stap 2/3/4). */
  /* Begrensd vak voor de mandala erachter — zonder dit centreerde
     `changeMandalaWrap` (die zich naar zijn OUDER richt) zich over de
     hele pagina i.p.v. enkel achter deze kop (operator, 7 september
     2026: "mandala moet onder header komen"). */
  /* Operator, 22 september 2026 ("staat dat op zelfde hoogte als de andere
     headers?"): de oude `minHeight: HEADER_MANDALA`+gecentreerde box was
     restant van de intussen verwijderde mandala-achtergrond (11 september
     2026) — nu exact `changeHeader`'s eigen, simpele top-uitlijning
     (stap 2/3/4), zodat de kop op precies dezelfde hoogte begint. */
  startHeaderWrap: { alignSelf: 'stretch', marginTop: 4, marginBottom: 12 },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): "Your
     first session"-stap, zelfde fix als `changeTitle`/`headlineLight`. */
  startTitleDark: {
    textAlign: 'left',
    color: Brand.text,
    ...TypeScale.pageHeader,
  },
  /* Operator, 24 september 2026 ("Experience your session wordt enige
     header, gecentreerd"): vervangt `startSubDark` (subkop is weg). */
  startTitleCentered: { textAlign: 'center' },
  /* De RhythmRing — zelfde component als agenda.tsx, hier compacter
     (`size`) zodat ze samen met kop, recap-chips, kaarten en de vaste
     veiligheidsregel nog zonder scrollen past (harde regel voor dit
     scherm, zie `startPlanList`-toelichting hieronder). */
  startRingWrap: {
    alignItems: 'center',
    marginTop: -8,
    position: 'relative',
  },
  /* Operator, 24 september 2026 ("foto zit niet mooi in de cirkel"):
     `RhythmRing`'s `size`-prop is NIET de werkelijke containermaat — die
     is `size + OUTER_PAD*2` (OUTER_PAD=40, zie RhythmRing.tsx), en de
     ZICHTBARE dunne ring zelf zit daarbinnen op straal `size/2 - 6`. Het
     top-offset `(outerSize - diameter)/2` komt daardoor altijd uit op een
     vaste 46, ongeacht `size` (OUTER_PAD*2 - 12, gehalveerd) — enkel de
     diameter zelf schaalt mee met `size` (= size - 12).
     Operator, vervolg ("cirkel groter"): size 224→260, dus diameter
     212→248; offset blijft 46. */
  startRingPhoto: {
    position: 'absolute',
    top: 46,
    alignSelf: 'center',
    width: 248,
    height: 248,
    borderRadius: 124,
  },
  startRingPhotoOverlay: {
    position: 'absolute',
    top: 46,
    alignSelf: 'center',
    width: 248,
    height: 248,
    borderRadius: 124,
    /* Operator, 24 september 2026 ("mag echt donkerder"): 0.45 → 0.68. */
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  /* Operator, 23 september 2026: illustratieve info voor de geselecteerde
     sessie, gecentreerd in de lege ruimte middenin de ring.
     Vervolg ("info mag beetje hoger beginnen"): een kleine negatieve
     `translateY` i.p.v. de exacte middenlijn, zodat er meer lucht overblijft
     t.o.v. het uur onderin de ring (`startRingTimeBottom`). */
  startRingCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -14 }],
  },
  /* Operator, 23 september 2026 ("aantal min moet grootste, daaronder hoe
     laat, daaronder iconen"): duur is nu de dominante regel — was eerst het
     uur dat het grootst stond, omgedraaid. */
  startRingDuration: {
    fontFamily: BrandFonts.bold,
    fontSize: 28,
    color: '#ffffff',
  },
  /* Operator, 25 september 2026 ("level mag ook in de cirkel komen"):
     hernoemd van `startCardBadge` — zelfde "ADVANCED LEVEL"-stijl label,
     nu in de ring i.p.v. op de kaart. */
  startRingLevel: {
    marginTop: -2,
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.5)',
  },
  /* Operator, 23 september 2026 ("het uur onderaan in de cirkel zetten"):
     los van de gecentreerde stapel — een eigen tekstje onderin de ring
     zelf (6-uur-positie), i.p.v. mee in het midden. */
  startRingTimeBottom: {
    position: 'absolute',
    bottom: 76,
    alignSelf: 'center',
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  /* Op stap 3 gekozen doelen (tot 2) — puur illustratief, niet tikbaar.
     Operator ("onder elkaar de states met de iconen ervoor"): kolom i.p.v.
     een rij iconen + losse naam-regel — elk doel zijn eigen icoon+naam op
     één lijn, doelen onder elkaar. */
  startRingGoalList: {
    marginTop: 9,
    gap: 4,
  },
  startRingGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  startRingGoalNames: {
    maxWidth: 130,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  /* Operator, 7 september 2026: eerst een vaste `marginTop`, getuned voor
     2 kaarten — maar bij 1 kaart (1 gekozen doel) liet dat een leeg gat
     onder de kaart en kwam hij te ver van de CTA af te staan ("bij 1 kaart
     komt die boven de cta"). `marginTop: 'auto'` binnen de nu flex:1
     gemaakte `slide` (zie `startSlideFill`) duwt de lijst altijd tot vlak
     boven de CTA, ongeacht of het 1 of 2 kaarten zijn — geen aparte
     berekening per aantal kaarten meer nodig. Scrollt bewust nooit
     (operator, 10 augustus 2026: "moet zonder scrollen passen"). */
  startSlideFill: { flex: 1 },
  /* Operator, 23 september 2026 ("elke state een eigen kaart, 2 naast
     elkaar"): grid i.p.v. een verticale lijst — `flexWrap` + `48%`-breedte
     per kaart, zelfde truc als `changeTile` op stap 3. Dit scherm zit in
     een `ScrollView` (zie hierboven), dus `marginTop:'auto'` (duwen tot
     tegen een bekende onderkant) is niet meer nodig — vaste marge. */
  startCardGrid: {
    marginTop: 10,
    /* Operator, 25 september 2026 ("kaarten en cta staan te dicht bij
       elkaar"): 14 → 24 — `footer` zelf heeft geen eigen paddingTop, dus
       deze marge was de enige ruimte tussen de kaarten en de CTA. */
    marginBottom: 24,
    width: CONTENT_W,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  /* Operator, 23 september 2026 ("Apple Inset Grouped-kaarten: iets hoger" →
     "de kaarten moet wel transparant blur" → "omlijning subtieler en
     witgrijs, enkel iconen mogen van kleur veranderen" → "onze animatie bij
     aanklikken, zoals de andere kaarten"): sizing (`startCard`, de
     Pressable) losgetrokken van de animatie/rand (`startCardInner`, een
     Animated.View) — exact `modeCardWrap`/`modeCard`'s opzet (stap 2),
     nodig omdat een animated borderColor op een plain Pressable niet
     kan. */
  /* Operator, 25 september 2026 ("te weinig ademruimte op de pagina"):
     88 → 72 — het niveau-label verhuisde naar de ring, dus de kaart
     hoeft die extra regel niet meer te dragen. */
  startCard: {
    width: '48%',
    height: 72,
  },
  /* `borderColor` hier is ANIMATED (`borderStyle` in `StartCard`) — de
     statische basiswaarde staat enkel in de `useSharedValue`-init. */
  startCardInner: {
    flex: 1,
    /* Operator, 23 september 2026: content hierbinnen is nu ABSOLUUT
       gepositioneerd (`startCardContent`, zie de "ik zie geen tekst"-fix)
       en telt dus niet meer mee voor de eigen hoogte — vaste hoogte
       nodig, anders klapt de kaart samen tot enkel de rand. */
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  /* TIJDELIJK terug (operator, "ik wil vergelijken") — iOS' SystemGray6,
     vlak boven de blur. Voor A/B-vergelijking op het toestel met de
     pure-blur-versie; verwijderen zodra de keuze gemaakt is. */
  startCardTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(120,120,128,0.16)',
  },
  /* Operator, 25 september 2026 ("iconen en tekst mogen links"): was
     `alignItems:'center'` — icoon en naam nu beide links, met wat
     binnenmarge zodat ze niet tegen de kaartrand plakken. */
  startCardContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 14,
    gap: 8,
  },
  startCardName: {
    fontFamily: BrandFonts.semibold,
    fontSize: 14.5,
    letterSpacing: 0.1,
    color: '#ffffff',
  },
  /* "i"-knop los in de hoek (niet meer in de content-rij) zodat icoon +
     naam er ongestoord door kunnen centreren. */
  startCardInfoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  /* Veiligheidsdisclaimer, vlak boven de CTA (buiten dit component, in de
     vaste footer) — zelfde `CONTENT_W`/centrering als `startPlanList`
     erboven, zodat beide blokken visueel op één lijn staan. */
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: CONTENT_W,
    alignSelf: 'center',
    /* Operator, 23 september 2026 ("tekst staat te dicht tegen de
       kaart" → "kan het blok nog beetje zakken?"): nu op stap 4 vlak na
       `expBlock` (de kaarten) i.p.v. in de vaste footer waar de knop er
       al genoeg afstand van gaf — eigen `marginTop` voor dezelfde
       ademruimte, 20 → 36 → 52. */
    marginTop: 52,
    marginBottom: 4,
  },
  safetyCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  safetyCheckOn: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  safetyTxt: {
    flex: 1,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  /* Scherm 6 — Audio Library (operator, 7 september 2026): kopblok is nu
     gewoon `changeHeader`, hetzelfde bewezen patroon als elke andere
     stap. Alleen dit ene rustige blok blijft eigen aan deze pagina — het
     staat in het witte vlak links van de foto, dus smaller dan CONTENT_W. */
  /* Rij i.p.v. losse spacer + blok onderaan (operator, 7 september 2026:
     "foto te groot, overlapt tekst" + "groot wit gat in het midden") —
     vult zelf de overgebleven hoogte, tekst en foto naast elkaar, kunnen
     dus niet meer overlappen. */
  /* Operator, 7 september 2026: groot wit gat tussen subkop en dit blok
     — `alignItems:'center'` centreerde het verticaal over de HELE
     overgebleven ruimte, wat te ver naar beneden viel. Nu vast bovenaan
     met wat lucht, i.p.v. zwevend in het midden. */
  /* Gewone rij i.p.v. absolute achtergrond (operator, 7 september 2026:
     "bouw de hele pagina opnieuw op") — `flex:1` vult de resterende
     hoogte tot vlak boven de knop, dus de foto raakt vanzelf bijna de
     onderkant zonder dat er iets kan overlappen. */
  /* Operator, 7 september 2026: "back knop werkt niet" — de foto (H =
     80% van het scherm, `bottom`-verankerd) stak met haar ONZICHTBARE
     (transparante) randen ver boven dit vak uit, tot in de topbalk, en
     onderschepte daar de tik op Back (zelfde soort Android-stapelbug als
     eerder met de tekst). `overflow:'hidden'` knipt alles — zichtbaar
     én tikbaar — af op de grenzen van dit vak. */
  /* Geen `overflow:hidden` meer — de echte fix voor het Back-knop-
     probleem is `pointerEvents="none"` op de foto zelf (zie
     LibraryPhoto), niet het vak kunstmatig laten afsnijden. */
  libBodyRow: {
    flex: 1,
    flexDirection: 'row',
    marginTop: 24,
    marginBottom: 8,
    width: SCREEN_W,
    paddingLeft: 26,
  },
  /* Vaste breedte, GEEN flex — dit is de kolom die altijd zichtbaar moet
     blijven; de foto (flex:1) krijgt daarnaast al het overige. Links
     uitgelijnd i.p.v. gecentreerd — leest beter als lijst, en zo lijnen
     de pijler-iconen netjes onder elkaar uit (operator, 7 september
     2026). */
  libCountBlock: { width: LIB_TEXT_W, alignItems: 'flex-start' },
  /* Operator, 11 september 2026: "140+" 32px ExtraBold/-0.5, "SESSIONS"
     10px Bold/+1.0, lijst-items 14px Medium — enkel de fonts aangepast,
     verder niets aan deze layout gewijzigd. */
  libCount: {
    color: '#0a0a0c',
    fontFamily: BrandFonts.extrabold,
    fontSize: 32,
    letterSpacing: -0.5,
  },
  libPillarList: { marginTop: 18, gap: 10 },
  libPillarRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  libPillarLabel: {
    color: '#0a0a0c',
    fontFamily: BrandFonts.medium,
    fontSize: 14,
  },
  libCountLbl: {
    marginTop: -2,
    color: 'rgba(10,10,12,0.5)',
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 1,
  },
  /* Operator, 7 september 2026: "moet Apple-stijl" — geen felle kleur,
     gewoon effen zwart zoals de rest van de pagina. Blijft prominenter
     dan de dunne bijschriften eromheen via gewicht/grootte, niet via
     kleur. */
  /* Operator, 7 september 2026 (mockup): breder dan de tekstkolom, loopt
     over de foto heen — maar NIET de volle schermbreedte. Positie valt
     samen met de witte gradient-band onderaan de foto, dus blijft
     leesbaar zonder eigen kaart. */
  /* Operator, 7 september 2026: "kaart moet centreren" — volle breedte
     als positioneervak, `alignItems:'center'` centreert de kaart erin
     i.p.v. links uitgelijnd te staan. */
  libIncludedFull: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 50,
    alignItems: 'center',
  },
  /* Operator, 7 september 2026: "hoe zou Apple dat doen" — een echte
     kaart i.p.v. een gradient-wassing: effen wit, subtiele schaduw,
     leesbaar ongeacht wat op de foto eronder staat. */
  /* Operator, 7 september 2026: "back knop werkt niet" — `elevation`
     (Android) bleek de tap voor de Back-knop in de topbalk te
     onderscheppen, hetzelfde soort stapel-eigenaardigheid als eerder met
     de foto. Geen `elevation`/`shadow*` meer — effen kaart met een dunne
     rand i.p.v. een schaduw. */
  libIncludedCard: {
    width: SCREEN_W * 0.66,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(10,10,12,0.08)',
    /* Anders steekt libIncludedAccent (hieronder) met haar rechte hoeken
       buiten de afgeronde kaartrand uit. */
    overflow: 'hidden',
  },
  /* Blauwe accentbalk links i.p.v. een schaduw of zwarte rand (operator,
     7 september 2026) — bakent de kaart af tegen elke achtergrond, wit
     of foto, zonder Android-`elevation` (die gaf eerder de tik-bug). */
  libIncludedAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  libIncludedDivider: {
    marginBottom: 12,
    width: 40,
    height: 1,
    backgroundColor: 'rgba(10,10,12,0.18)',
  },
  libIncludedRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  libIncludedEyebrow: {
    color: 'rgba(10,10,12,0.55)',
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 1,
  },
  libIncludedTitle: {
    marginTop: 2,
    color: '#0a0a0c',
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  libIncludedDesc: {
    marginTop: 6,
    color: 'rgba(10,10,12,0.6)',
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },

  /* Footer */
  /* De veilige zone wordt al door SafeAreaView afgetrokken; dit is de marge
     dáárbovenop. Twintig punten was krap: op een toestel met een gebaarbalk
     komt de knop dan vlak tegen die balk aan te liggen en tikt je duim er
     net naast (operator 2026-07-31). */
  footer: { paddingHorizontal: 26, paddingBottom: 32, gap: 18 },
  /* Operator, 22 september 2026 ("verwijder die witte band onderaan"):
     `footerLight` (effen wit achter de CTA op stap 1) hoorde bij het
     oude lichte-achtergrond-thema — nu de foto donker en full-bleed is,
     gaf die band juist een storende witte streep. Weg. */
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  /* Operator, 22 september 2026 ("shimmer werkt slecht, kijk naar welcome
     in breathwork, exact hetzelfde doen"): miste `flexDirection: 'row'`
     (RN's default is 'column') — dat verschil met (tabs)/breath.tsx se
     eigen `cta` bepaalt waar een absoluut-gepositioneerde kind-laag
     (de shimmer-strook) standaard rust, en verklaart precies waarom die
     hier zichtbaar "vastzat" i.p.v. volledig off-screen te starten. Nu
     1-op-1 dezelfde eigenschappen als daar. */
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
  },
  /* Operator, 22 september 2026 ("next knop ook transparant"): eigen
     `overflow:'hidden'` op de `cta`-laag zelf — de BlurView is nu een
     kind hiervan (i.p.v. de knop zelf een vlakke `backgroundColor` te
     geven), dus moet hier al clippen, niet enkel op `ctaWrap`. */
  ctaBlurWrap: { overflow: 'hidden' },
  /* Operator, 22 september 2026 ("cta niet meer zichtbaar, geef witte
     transparante kleur"): doorschijnende witte tint boven de blur. */
  ctaTintWhite: { backgroundColor: 'rgba(255,255,255,0.22)' },
  /* Operator, 22 september 2026: zelfde vorm als (tabs)/breath.tsx se
     `ctaShimmer` — een schuine strook, ruim hoger dan de knop zelf zodat
     de rotatie geen hoeken leeg laat. */
  ctaShimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    /* Expliciet vastgepind (was impliciet/ongezet) — de animatie berekent
       de horizontale beweging nu zelf via `translateX` t.o.v. deze vaste
       linkerrand, zie `ctaShimmerStyle`. */
    left: 0,
    width: 72,
  },
  ctaTxt: {
    color: '#ffffff',
    fontFamily: BrandFonts.semibold,
    fontSize: 17,
  },
  ctaTxtDark: {
    color: '#0a0a0c',
    fontFamily: BrandFonts.semibold,
    fontSize: 17,
  },
  /* Gedempte tekst voor de "nog geen keuze gemaakt"-staat op stap 3. */
  ctaTxtBlocked: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: BrandFonts.semibold,
    fontSize: 17,
  },
});
