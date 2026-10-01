/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet tab (ETALAGE)

   Bron: operator-mockup `vibezcore_bracelet_final15.html`, vastgelegd
   2026-05-25. Vervangt de vorige 306-regel pure-tekst etalage. Twee
   modi blijven (STRUCTUUR_en_BLE_contract_v2 §4):
     - ETALAGE  : deze file  — marketing showcase (guest / not activated)
     - BEDIENING: bracelet-control.tsx — control screen (activated)

   Sectie-volgorde (top → bottom):
     1. Hero-tekst (Kickstarter-eyebrow + product-titel + sub)
     2. Bracelet-render met subtiele sonar-rings
     3. How it works — 7 pill-tabs met content-card
     4. 5 Haptic Modes — accordion (1 open default)
     5. Technical Specs — 2-koloms grid
     6. The Collection — 15 gemstone-editions, Pure/Premium/Imperial
     7. Pricing — Bracelet/Bundle/Extra, EUR/USD toggle
     8. Launch banner — Kickstarter Fall 2026 (static, geen countdown)
     9. Join the Waitlist — link naar vibezcore.com via WebBrowser

   Belangrijk:
   - Modi-tabel (namen + duren + kleuren) volgt CLAUDE.md §5, NIET de
     HTML-mockup. Operator-besluit 2026-05-25: namen/duren/kleuren uit
     CLAUDE.md winnen. De HTML had andere namen + duren.
   - Foto's komen van Bunny pull-zone `vibezcore-audio.b-cdn.net` —
     dezelfde host als de audio-library. Zie EDITIONS-tabel hieronder
     voor de exacte file-paden. Operator uploadt 16 plaatjes onder
     die paden; geen code-wijziging nodig wanneer een edition-foto
     ge-update wordt.
   - Waitlist-form bewust NIET in-app gebouwd. Eén knop opent
     https://www.vibezcore.com/ in een WebBrowser (custom-tab op
     Android, SFSafariViewController op iOS, fallback Linking).
     Operator-besluit: form blijft op de website, app is etalage.
   - Prijzen zijn placeholders en worden later door operator
     aangepast (operator-besluit 2026-05-25).
   ─────────────────────────────────────────────────────────────────────── */

import { MINI_PLAYER_HEIGHT } from '@/components/MiniPlayer';
import { PreviewPill } from '@/components/PreviewPill';
import { usePlayerState } from '@/services/audio-player';
import GradientText, {
  SUB_COLORS,
  SUB_POSITIONS,
} from '@/components/GradientText';
import { BrandDark, BrandLight, BrandFonts, TypeScale } from '@/constants/theme';
/* Bron van waarheid voor de 5 haptic-modi (naam + kleur) — CLAUDE.md §5.
   Niet lokaal opnieuw verzinnen (dat gaf eerder precies de drift die de
   verwijderde MODES-array had). Aliased: bracelet.tsx had zelf ooit een
   eigen `MODES`-const. */
import { MODES as BLE_MODES } from '@/services/ble-contract';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '@/hooks/useSubscription';
import { getToken } from '@/services/auth';
import { useBraceletOwner } from '@/utils/dev-user-override';
import BraceletControl from '../bracelet-control';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Dimensions,
  Easing as RNEasing,
  Image,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
/* BUG (operator: "ik krijg error" — "[Worklets] Tried to synchronously
   call a non-worklet anonymous function"): de Reanimated Babel-plugin
   herkent de callbacks die naar `useAnimatedStyle`/`withTiming`/etc.
   gaan aan hun IMPORT-NAAM, om ze automatisch tot worklet te compileren.
   Deze functies hier eerder onder een ALIAS importeren (bv.
   `useAnimatedStyle as useRAnimatedStyle`) brak die herkenning — de
   callbacks bleven gewone JS-functies, en Reanimated probeerde ze
   alsnog synchroon op de UI-thread aan te roepen. Nu de PLAIN
   (bestaande) reanimated-namen, en in plaats daarvan de react-native-
   imports die botsten (`Animated`/`Easing`) hernoemd — die hebben geen
   speciale Babel-herkenning nodig. */
import ReAnimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/* LayoutAnimation moet op Android expliciet aangezet worden voor soepele
   accordion-uitklap. No-op op iOS. Module-level side effect — idempotent. */
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ── Constants ──────────────────────────────────────────────────────────── */

/* Bunny CDN — zelfde pull-zone als audio. Submap /images/ voor bracelet-
   foto's. Pad-namen exact zoals operator ze uploadde, inclusief de
   `vzc (1)`-suffix en spaties (URL-encoded). */
/* Operator, 14 september 2026: "we gaan de Bracelet-pagina nu eerst
   volledig transformeren naar Light mode" — zelfde `light`-toggle-patroon
   als breath-setup/session/Audio Library, alleen hier direct op de al
   vastgelegde `BrandDark`/`BrandLight` (theme.ts) i.p.v. een eigen lokale
   kopie — dit scherm gebruikte al exact dat kleurenschema (`C.bg/
   accent/text/textDim/panel/border/success`), dus de bron hergebruiken
   is minder om uit elkaar te laten lopen dan 'm hier opnieuw te tikken. */
/* Operator, 26 september 2026: dark is de nieuwe app-brede default (was
   light, 14 september) — zelfde hardcoded-schakelaar-patroon, enkel de
   waarde omgezet. */
const light = false;
const C = light ? BrandLight : BrandDark;

const CDN = 'https://vibezcore-audio.b-cdn.net/images';
/* Iter 9cv (2026-05-31): operator-aangeleverde transparante render →
   bracelet kan nu écht "zweven" op de dark UI zonder witte achtergrond.
   Werkt zowel voor de hero-card (witte bg via renderWrap) als voor de
   Audio PRO landing met transparent prop. */
const RENDER_URL = `${CDN}/vzc-bracelet%20no%20bg.png`;
/* Operator ("de bracelet die er eerst stond terug, met zwarte
   achtergrond"): de echte studio-productfoto — dit was topPhotoHero's
   foto vóór de hero-redesign (26 september 2026), nu de hero-achtergrond
   voor de "A closer look"-hotspots i.p.v. de transparante illustratie
   hierboven. 1024×1536, bracelet zit rond het verticale midden. */
const HERO_PHOTO_URL = `${CDN}/pic%20hero%20home%202.png`;

/* ────────────────────────────────────────────────────────────────
   OPERATOR-KNOB — verticale positie van de haptic-ring + center-dot
   op de Audio PRO landing hero-render (SonarRender, transparante
   illustratie). De Free/Bracelet-hero gebruikt sinds 26 september 2026
   HERO_PHOTO_URL i.p.v. SonarRender — HAPTIC_RING_OFFSET_Y_FREE is
   daardoor niet meer nodig en verwijderd.
   - Negatief = ring omhoog (richting bovenkant van de bracelet)
   - Positief = ring omlaag (richting onderkant van de bracelet)
   - 1mm ≈ 4 pixels op standaard density
   ──────────────────────────────────────────────────────────────── */
const HAPTIC_RING_OFFSET_Y_AUDIO_PRO = 8; // pixels — Audio PRO landing tune (2mm onder origineel)

/* Waitlist-pagina op de webapp. Operator-besluit: in-app form is
   overkill, externe link is voldoende. */
/* Waitlist-URLs. Product-specifieke pagina's op de webapp; user kiest
   z'n pakket op de pricing-card en klikt door naar de juiste pagina. */
const WAITLIST_BUNDLE_URL = 'https://www.vibezcore.com/subscribe-bundle';
const WAITLIST_BRACELET_URL = 'https://www.vibezcore.com/subscribe-bracelet';
/* Generic waitlist (zonder pakket-keuze) — niet meer gebruikt sinds
   2026-05-26 iter 3, standalone waitlist-sectie weggehaald. Constant
   blijft voor backwards-compat als operator 'm later wil terugroepen. */
const WAITLIST_URL = 'https://www.vibezcore.com/';

/* ── Layout constants ──────────────────────────────────────────────────────
   SIDE_INSET blijft gebruikt door legacy dode stijlen (moduleCard/
   carouselWrap, zie Styles-sectie).
   Operator, 26 september 2026: de horizontale swipe-carousels (Modes +
   Collection) zijn vervangen door vaste grids ("wil heel die pagina
   anders, nu lijkt dat een slechte website op mobiel") — PEEK/CARD_GAP/
   CARD_WIDTH/CARD_SNAP/SCREEN_WIDTH/de foto-shimmer waren enkel voor die
   carousels/de oude fotoheader en zijn verwijderd. */
const SIDE_INSET = 16;
/* Zelfde subkop-maat als de onboarding (breath-welcome.tsx SUB_SIZE/
   SUB_TRACK) — niet geëxporteerd vanuit GradientText, dus hier herhaald
   i.p.v. geïmporteerd (operator, 10 augustus 2026: "subheader gradient
   doortrekken"). */
const SUB_SIZE = 12;
const SUB_TRACK = 2.2;

/* ── Data: 7-step story (How it works) ──────────────────────────────────── */

type Step = { n: string; title: string; body: string; tags: string[] };

/* Iter 9cj (2026-05-31): Apple-stijl tightening van STORY-copy.
   Operator-keuze: alle info bewaard, ~40% korter, scherpere ritmische
   zinnen. Voor "boeiender + kort en krachtig" ervaring zoals operator
   vroeg. Tags ongewijzigd. */
const STORY: Step[] = [
  {
    n: '01',
    title: 'What it is',
    body:
      'A modular Bead Bracelet built around one intelligent core — the HapticCore. Swap beads to shift your look. One core. Many identities.',
    tags: ['HapticCore', '15 Editions', '8mm Beads'],
  },
  {
    n: '02',
    title: 'How it works',
    body:
      /* Operator ("guide your nervous system towards calm focus and
         more"): "calm or focus" dekte maar 2 van de 5 states. */
      'Calibrated pulses reach your wrist and guide your nervous system toward the state you need — boost, focus, calm, clarity, or sleep. Notice a shift in 15 to 30 minutes — subtle, but felt.',
    tags: ['Haptic Technology', '15–30 min', 'Bottom-up regulation'],
  },
  {
    n: '03',
    title: 'The intelligence inside',
    body:
      'A precision haptic engine grounded in applied neuroscience. Calibrated pulses influence your internal state in real time. No screen. No notification. Just direct, physical regulation — body settles, mind follows.',
    tags: ['Bluetooth 5.0', 'Pogo Pin Charging', 'VIBEZCORE App'],
  },
  {
    n: '04',
    title: 'Materials & build',
    /* Operator ("geen sterling silver, waar haal je dat vandaan?"): stond
       hier al fout vóórdat CLOSER_LOOK ernaar verwees — de echte,
       geverifieerde materiaalclaim staat in faq-content.ts: "high-quality
       stainless steel" (het slotsysteem), geen sterling silver. */
    body:
      'Hand-assembled, one at a time. Premium 8mm natural gemstones, precision-engineered closure. No two stones alike — each carries its own character.',
    tags: ['Hand-assembled', 'Natural Gemstone', 'Stainless Steel'],
  },
  {
    n: '05',
    title: 'Interchangeable',
    body:
      'Bead sets click in and out — no tools, no effort. One HapticCore. Fifteen gemstone editions. Match your stone to your energy, style, or state of mind.',
    tags: ['Click system', '15 Editions', 'No tools needed'],
  },
  {
    n: '06',
    title: 'Made for you',
    body:
      'Sized to your wrist, 16 to 21 cm. You choose the gemstone. Not off a shelf — built around you, from fit to finish.',
    tags: ['16–21 cm', '6.3"–8.3"', 'Personally configured'],
  },
  {
    n: '07',
    title: 'Guide your state',
    body:
      'Five modes calibrated for the moments that matter. Under pressure — toward calm. In motion — deeper focus. A shift you feel in 15 to 30 minutes.',
    tags: ['BOOST', 'FOCUS', 'CALM', 'CLARITY', 'DEEP RECOVERY'],
  },
];

/* Operator, 15 september 2026: één trimmed zin per stap voor de niet-
   getabde "How it works"-lijst — alle 7 punten blijven, enkel de volledige
   alinea + tags per stap vervangen door de kernzin. Niet uit STORY[i].body
   afgeleid (zou de eerste zin afknippen, niet per se de beste), maar
   losstaand geschreven zodat elke regel op zichzelf goed leest. */
const STORY_SHORT: string[] = [
  'One HapticCore, fifteen swappable gemstone editions.',
  'Calibrated pulses on your wrist guide you toward the state you need.',
  'A precision haptic engine, no screen or notification involved.',
  'Hand-assembled with natural 8mm gemstones — no two alike.',
  'Beads click in and out in seconds, no tools needed.',
  'Sized to your wrist and your choice of gemstone.',
  'Five modes, each calibrated for a different moment.',
];

/* Operator, 26 september 2026: MODES/MODE_SHORT (5 haptic-modi, duplicaat
   van services/ble-contract.ts — de comments hierboven noteerden al dat
   deze array "los liep" van die bron van waarheid) verwijderd samen met
   de modi-grid-sectie. ble-contract.ts blijft de enige bron voor
   modusnaam/kleur/duur. */

/* ── Data: "A closer look" — tabs + hotspots op de bracelet ────────────────
   Operator, 26 september 2026 ("tabs boven en onder plaatsen die naar
   specifieke zaken verwijzen, bv haptic core... hoe duidelijk maken waar
   de haptic core is"): 1-op-1 overgenomen uit de echte, operator-
   goedgekeurde webpagina-sectie "A closer look / One Bracelet" (huisstijl
   v5, sectie 7) — zelfde 5 onderwerpen, zelfde copy/tags, niet zelf
   verzonnen. hotspot = punten op de render die aanwijzen WAAR dat
   onderdeel zit (top/left in % van heroStage); meerdere punten voor
   onderwerpen die aan beide kanten van de armband zitten. */
type CloserLookTopic = {
  key: string;
  pill: string;
  title: string;
  body: string;
  tags: string[];
  hotspots: { top: `${number}%`; left: `${number}%` }[];
};
/* Operator ("de bracelet die er eerst stond terug, met zwarte
   achtergrond"): posities herrekend tegen HERO_PHOTO_URL (1024×1536,
   gedownload en bekeken), niet meer tegen de transparante illustratie.
   heroStage is 250px hoog en volle breedte; resizeMode="cover" schaalt
   de foto op de breedte (factor breedte/1024) en snijdt verticaal —
   zichtbaar venster ≈ 26%–74% van de foto-hoogte, gecentreerd. Elk punt
   is de echte plek in de foto (top-arc, de blauwe LED, de stalen
   klik-kralen) omgerekend door die crop, niet een blinde gok. */
const CLOSER_LOOK: CloserLookTopic[] = [
  {
    key: 'what',
    pill: 'What is it',
    /* Operator (Apple-stijl-feedback): "Mind follows body." — sluit aan
       op de al bestaande bottom-up-positionering ("Body first, mind
       follows" hieronder / STORY n03 "body settles, mind follows"). */
    title: 'Mind follows body.',
    /* Operator (27 september 2026, "eigenlijk moet een lezer na openen van
       deze 3 punten perfect weten: wat is het? waarvoor dient het? hoe
       werkt het? wat krijg ik?"): volledige herverdeling van de content
       over what/core/how — zie de comments bij elk van de drie.
       Operator (vervolg): "hier moet je niet fifteen editions/materialen
       beschrijven" — dat is productbeschrijving, hoort niet in "what is
       it". Puur het effect + het gemak: shift binnen 15-30 min, geen
       moeite, gewoon dragen. Edities/materialen staan al in Materials/
       Bead set & fit. */
    /* Operator (vervolg, 27 september): concrete before→after-paren
       toevoegen + "neuroscience based" + "effortless, the bracelet does
       the work" terug. Paren gekozen uit de echte 5 states (niet
       verzonnen): stressed→calm (Calm Control), tired→alert (Boost),
       restless→asleep (Sleep) — dekt 3 van de 5 concreet i.p.v. alle 5
       op te sommen (te druk voor 1 zin). */
    /* Operator ("body first, mind follows principe in what is it"): de
       bottom-up-positionering (al gebruikt in STORY n03) hoort hier ook —
       dat IS het antwoord op "hoe kan dit effortless zijn". */
    body: 'A neuroscience-based haptic bracelet. Shifts your state — stressed to calm, tired to alert, restless to asleep — within 15 to 30 minutes. Body first, mind follows: effortless, the bracelet does the work.',
    tags: ['Neuroscience-based', '15–30 min', 'Effortless'],
    hotspots: [{ top: '23%', left: '50%' }], // top van de kralenboog
  },
  {
    key: 'core',
    pill: 'HapticCore',
    /* Operator (Apple-stijl-feedback: "korter, ritmischer, nadruk op
       voordeel i.p.v. techniek"): "The intelligence inside" zegt niks
       over de ervaring — nu het directe resultaat. "Instantly" uit de
       operator-suggestie NIET overgenomen: spreekt de al vastgelegde
       15-30 min-timing tegen ("What is it" hierboven). */
    title: 'Feel the shift.',
    /* Operator ("haptic core is gebaseerd op neuroscience based haptic
       pulses bottom up regulation. idee shift van state"): dit is nu het
       "hoe werkt het"-mechanisme — verplaatst uit de oude "How it
       works"-tekst, die zelf nu de gebruiksflow (dragen + app) beschrijft.
       Bluetooth/Pogo/App-tags zijn mee verhuisd naar "How it works",
       want die horen bij het ACTIVEREN via de app, niet bij het
       mechanisme zelf. */
    /* Operator ("haptic core mag je meer technische kant beschrijven. de
       pulsen, bottom-up, neuroscience effect"): dieper op het mechanisme
       — pulsritme + intensiteit per state, en wat "bottom-up" precies
       betekent (lichaam-naar-brein, niet andersom). Geen firmware-
       parameters (PPS/burst_ms/amplitude) — die blijven spec §11.5,
       nooit in de UI. */
    /* Operator (vervolg): korter, ritmischer, minder "handleiding"-toon.
       "Calming your mind" uit de operator-suggestie NIET overgenomen:
       HapticCore bedient alle 5 states, niet enkel kalmte — zelfde fout
       als de eerder gecorrigeerde "calm or focus" in How it works. */
    body: 'A high-precision haptic engine delivers subtle, rhythmic pulses to your wrist — tuned to your active state. Your nervous system responds to the signal directly. No conscious effort needed.',
    tags: ['Calibrated Pulses', 'Bottom-up Regulation', 'Neuroscience-backed'],
    hotspots: [{ top: '54%', left: '32%' }], // exact op de blauwe LED
  },
  {
    key: 'how',
    pill: 'How it works',
    /* Operator (Apple-stijl-feedback): "Set it. Wear it. Forget it." */
    title: 'Set it. Wear it. Forget it.',
    /* Operator ("how it works moet gerelateerd zijn aan het dragen en
       instellen van de bracelet via de app — wear it, dan activeren,
       vooringesteld of op het moment zelf"): dit was het mechanisme
       (nu verhuisd naar HapticCore) — hier staat nu de gebruiksflow:
       dragen → app → preset of live starten. Bluetooth/Pogo verhuisd
       hierheen vanuit de oude HapticCore-tekst, want pairen/laden hoort
       bij het gebruiksproces, niet bij de wetenschap erachter. */
    /* Operator ("niet 'run a preset' — als de preset gezet is moet hij
       vanzelf starten, geen actie nodig. Of user kiest zelf op het
       moment zelf wanneer nodig"): "run a preset routine" impliceerde
       een handeling per keer — een geplande routine start zelf, alleen
       de op-het-moment-keuze is een actieve tik. */
    /* Operator (Apple-stijl-feedback, vervolg): ritmischer — "magnetic
       dock" bewust NIET overgenomen uit de suggestie, niet geverifieerd
       (zie [[feedback-bracelet-material-stainless-steel]]-achtige les:
       geen ongeverifieerde specs). */
    body: 'Slip it on, then connect to the VIBEZCORE app. Routines launch on their own, throughout the day — or switch states instantly, whenever you choose. Pairs over Bluetooth, charges on a pogo dock.',
    tags: ['Wear it', 'Starts on its own', 'Bluetooth'],
    hotspots: [{ top: '26%', left: '65%' }], // kraal op de boog, naast "what"
  },
  {
    key: 'materials',
    /* Operator ("bead set en fit en materials mag je samenvoegen"): 2
       topics → 1. Materiaalfeiten (hand-assembled, stainless steel) +
       de interchangeable/edities/maat-uitleg samen — het zijn allebei
       "wat zit erin en past het" vragen, geen aparte onderwerpen. */
    pill: 'Materials & Fit',
    /* Operator (Apple-stijl-feedback): "Crafted for your wrist." */
    title: 'Crafted for your wrist.',
    /* Operator ("stainless steel weg, premium gemstones"): geen
       materiaal-spec meer voor het slotsysteem — focus op de edelstenen
       zelf als het premium-verkoopargument. */
    body: 'Hand-assembled, one at a time — premium 8mm natural gemstones. Choose from 15 gemstone editions, sized 16–21 cm to your wrist.',
    tags: ['Premium Gemstones', 'Interchangeable', '15 Editions'],
    hotspots: [
      { top: '33%', left: '25%' }, // edelsteen-kralen links
      { top: '33%', left: '75%' }, // edelsteen-kralen rechts
      { top: '50%', left: '20%' }, // stalen klik-kraal links, naast de core
      { top: '50%', left: '83%' }, // stalen klik-kraal rechts
    ],
  },
];

/* Operator, 26 september 2026: EDITIONS/Series/Edition-type (15 gemstone
   edities) verwijderd samen met de gemstone-collectie-sectie — was
   uitsluitend data voor die grid + de detail-popup, beide weg. */

/* ── Data: Pricing (placeholders — operator past later aan) ──────────────── */

/* USD-only sinds 2026-05-26 (operator-keuze: EUR-toggle weg, alleen
   USD tonen — eenvoudiger, Kickstarter is USD-first). Match't de
   canonical values uit assets/website-content/kickstarter-page.html +
   shop-bundle-bracelet-compact.html — zie PRICING-object hieronder
   voor de actuele, geldende bedragen (laatst gecorrigeerd v244). */
/* Iter v218 (2026-07-04): eur toegevoegd als secundaire hint onder USD.
   Kickstarter is USD-native (KS-pagina zelf toont USD), EUR is contextuele
   conversie voor EU-users. Rate ~0.92 (juli 2026 gemiddeld). */
type PriceRow = {
  main: string;
  old: string;
  save: string;
  eur?: string;
  eurOld?: string;
  gbp?: string;
};
type PriceSet = {
  bracelet: PriceRow;
  bundle: PriceRow;
  extra: PriceRow;
};
/* GEËXPORTEERD (8 augustus 2026): de premium-popup belooft leden de
   early-bird-prijs, en een belofte hoort uit dezelfde bron te komen als de
   prijs op deze pagina — anders lopen ze uiteen zodra er één verandert. */
export const PRICING: PriceSet = {
  /* Iter v244 (2026-07-20, operator-correctie): audio-jaarwaarde was
     nog $130 (foutieve conversie-inschatting) — operator bevestigde
     rechtstreeks uit Play Console dat de echte regular yearly-prijs
     $119.88 is (pariteit met EUR, geen losse USD-conversie).
     Nieuwe totaal: $299 bracelet + $32 extra + $119.88 audio = $450.88.
     Save $235.88 = 52% korting t.o.v. gecombineerde retail waarde. */
  /* eur/eurOld (operator, 11 augustus 2026, correctie op de €129 van
     10 augustus: "als dat de prijs in EU moet voorstellen is dat 149
     euro?" — terecht, €129 was een verspreking, geen echt bedrag. Dit
     zijn nu de EXACTE cijfers die al live op de Kickstarter-website staan
     (crowdfunding-pagina, gezien 10 augustus 2026: "€299 → €149" bracelet,
     "€448,88 → €199" bundle) — geen valuta-conversie, geen "≈" meer op
     bundle (dat was een losse geschatte 0,92-omrekening van de USD-prijs,
     inconsistent met hoe bracelet.eur al werkte). Dit is de bron voor de
     EUR-abonnementscontext (breath-session.tsx paywall, EUR-only naast de
     EUR-store-prijzen); de Kickstarter-pagina in de app zelf blijft
     USD-first (operator-keuze 2026-05-26, "Kickstarter is USD-first"). */
  /* gbp (operator, 11 augustus 2026: "ook de prijs in pound erbij
     zetten?"): GEEN live bron zoals eur (dat kwam recht van de
     Kickstarter-website) — dit volgt hetzelfde patroon als de bestaande
     audio-abonnementsprijzen (zie project-audio-pricing memory: €9.99 →
     £8.99, €14.99 → £12.99, €69.99 → £59.99: GBP staat steeds een rond
     bedrag onder EUR). Toegepast op bracelet (€149→£129, -20) en bundle
     (€199→£179, -20, zelfde vaste stap als bracelet). Operator-bevestiging
     nodig vóór dit een echte prijs wordt, niet alleen een schatting. */
  bracelet: {
    main: '$169',
    old: '$299',
    save: 'Save $130',
    eur: '€149',
    eurOld: '€299',
    gbp: '£129',
  },
  bundle: {
    main: '$215',
    old: '$450.88',
    save: 'Save $235.88 · 52% off',
    eur: '€199',
    eurOld: '€448.88',
    gbp: '£179',
  },
  extra: { main: '$32', old: '', save: '', eur: '≈ €30', gbp: '≈ £26' },
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

/* External link — primair via WebBrowser (Custom Tab op Android,
   SFSafariViewController op iOS), fallback naar Linking. Zelfde
   patroon als de Gumroad-checkout in (tabs)/index.tsx — bewust
   gedupliceerd ipv shared util omdat de fout-paden subtiel anders
   reageren per call-site (logging). */
async function openExternal(url: string): Promise<void> {
  if (__DEV__) console.log('[VIBEZCORE] bracelet openExternal →', url);
  try {
    const result = await WebBrowser.openBrowserAsync(url);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      if (__DEV__) console.log('[VIBEZCORE] WebBrowser cancelled — fallback Linking');
      await Linking.openURL(url);
    }
  } catch (e) {
    if (__DEV__) console.log('[VIBEZCORE] WebBrowser threw — fallback Linking:', e);
    await Linking.openURL(url);
  }
}

/* ── Bracelet-render with sonar rings ───────────────────────────────────── */

/* Drie pulsende ringen, gefaseerd met 1s delay. Elke ring fade-out
   tegelijk met scale-up — geeft de "uitstralende energie"-look uit
   de HTML-mockup zonder GIF. useNativeDriver=true zodat de JS-thread
   vrij blijft tijdens scroll. */
function SonarRender({
  transparent = false,
  ringOffsetY = 0,
}: {
  transparent?: boolean;
  /* Iter 9dd (2026-05-31): per-context offset om de haptic-ring +
     center-dot kleine pixel-tuning te geven, zonder de globale styles
     aan te raken. Free hero gebruikt +8 (2mm drop), Audio PRO landing
     blijft 0 (origineel). */
  ringOffsetY?: number;
} = {}) {
  /* Twee rings + één centrale glow — exact 1:1 met de webapp-hero
     (operator-referentie 2026-05-26 iter 4: HTML keyframes
     `haptic-ring` + `haptic-pulse`). Cyclus 3000ms, 700ms offset
     tussen ring1 en ring2 — dat matched het ritme dat de operator
     "echte pulse" noemt (lange dead-time per ring → tussen-puls-
     ruimte ipv constante wave). */
  const ring1 = useRef(new RNAnimated.Value(0)).current;
  const ring2 = useRef(new RNAnimated.Value(0)).current;
  const glow = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    /* Offset alleen aan de START (setTimeout), niet in de loop —
       anders wordt elke ring's cyclus-lengte verschillend en lopen
       ze uit fase. */
    const startLoop = (val: RNAnimated.Value, delay: number) => {
      const loop = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(val, {
            toValue: 1,
            duration: 3000,
            easing: RNEasing.out(RNEasing.cubic),
            useNativeDriver: true,
          }),
          /* Instant reset — bij val=1 is opacity al 0, dus geen
             zichtbare flicker. */
          RNAnimated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      const handle = setTimeout(() => loop.start(), delay);
      return () => {
        clearTimeout(handle);
        loop.stop();
      };
    };
    /* Glow gebruikt LINEAR easing zodat de multi-key opacity-curve
       z'n eigen ritme bepaalt (cubic zou de keyframes vervormen). */
    const startGlowLoop = () => {
      const loop = RNAnimated.loop(
        RNAnimated.timing(glow, {
          toValue: 1,
          duration: 3000,
          easing: RNEasing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    };
    const c1 = startLoop(ring1, 0);
    const c2 = startLoop(ring2, 700);
    const cG = startGlowLoop();
    return () => {
      c1();
      c2();
      cG();
    };
  }, [ring1, ring2, glow]);

  /* RING-curve = HTML `haptic-ring` keyframes vertaald:
       0%   opacity 0,   scale 1
       12%  opacity 0.7  (POP — sharp attack)
       60%  opacity 0,   scale 3.5  (uitgedeinde, onzichtbaar)
       100% (dead-time, scale terug naar 1 onzichtbaar)
     De dead-time tussen 60% en 100% (= 1.2s rust per ring) is wat
     het pulse-gevoel geeft — tussen pulses een stilte. */
  const ringStyle = (val: RNAnimated.Value) => ({
    opacity: val.interpolate({
      inputRange: [0, 0.12, 0.6, 1],
      outputRange: [0, 0.7, 0, 0],
    }),
    transform: [
      {
        scale: val.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [1, 3.5, 1],
        }),
      },
    ],
  });

  /* GLOW-curve = HTML `haptic-pulse` keyframes vertaald (dubbele-beat):
       0%   opacity 0.3  scale 1     (baseline)
       12%  opacity 1.0  scale 1.8   (eerste peak — kraak)
       25%  opacity 0.2  scale 0.9   (dip)
       38%  opacity 0.8  scale 1.4   (tweede peak — echo)
       50%  opacity 0.1  scale 0.9   (dip)
       100% opacity 0.3  scale 1     (terug naar baseline)
     Double-beat pattern is wat het oog leest als "pulserend hart" —
     één peak alleen voelt mechanisch, twee peaks met dip ertussen
     voelt organisch. */
  const glowOpacity = glow.interpolate({
    inputRange: [0, 0.12, 0.25, 0.38, 0.5, 1],
    outputRange: [0.3, 1, 0.2, 0.8, 0.1, 0.3],
  });
  const glowScale = glow.interpolate({
    inputRange: [0, 0.12, 0.25, 0.38, 0.5, 1],
    outputRange: [1, 1.8, 0.9, 1.4, 0.9, 1],
  });

  /* Iter 9cn (2026-05-31): shadow-shell rond de witte render-card →
     subtiel "elevated"-gevoel, voorkomt de harde wit-tegen-zwart sprong.
     Outer view doet de shadow (geen overflow), inner doet de clip.
     Iter 9cs (2026-05-31): transparent prop voor Audio PRO landing —
     witte bg + shadow worden uitgezet zodat de bracelet "zweeft" op
     de dark UI. */
  return (
    <View style={[s.renderShell, transparent && s.renderShellTransparent]}>
      <View style={[s.renderWrap, transparent && s.renderWrapTransparent]}>
        {/* Z-order via JSX-volgorde: image eerst (achtergrond), rings
            + dot ná (= bovenop). */}
        <Image
          source={{ uri: RENDER_URL }}
          style={s.renderImg}
          resizeMode="contain"
          resizeMethod="resize"
          fadeDuration={0}
        />
        {/* Iter 9dd: ringOffsetY shift voor per-context tuning. */}
        <RNAnimated.View
          style={[
            s.sonarRing,
            ringOffsetY ? { marginTop: 5 + ringOffsetY } : null,
            ringStyle(ring1),
          ]}
        />
        <RNAnimated.View
          style={[
            s.sonarRing,
            ringOffsetY ? { marginTop: 5 + ringOffsetY } : null,
            ringStyle(ring2),
          ]}
        />
        <RNAnimated.View
          style={[
            s.coreDot,
            ringOffsetY ? { marginTop: 18 + ringOffsetY } : null,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />
      </View>
    </View>
  );
}

/* ── Edition detail-panel helper ─────────────────────────────────────────
   Verschijnt direct onder de series-grid waarin de tap viel. Gescheiden
   uit BraceletScreen omdat 'ie binnen de collection .map() callback wordt
   aangeroepen — als inline-JSX zou de hele detail-block 3× in de tree
   verschijnen (één keer per series), wat 't onleesbaar maakt. */
/* Iter 8b: renderDetailPanel → DetailPanel component met zoom-state.
   Operator-feedback: "bij aanklikken van bracelets en grote card moet
   user kunnen inzoomen, max 50%". Tap op de image toggelt tussen
   1× (default) en 1.5× zoom. Subtiele animatie + zoom-icoon-hint. */
/* Iter 9cr (2026-05-31): bullet-component voor Audio PRO landing-page.
   Apple-stijl small bullet + crisp tekst, mode-color accent dot. */
function LandingBullet({ text }: { text: string }) {
  return (
    <View style={s.landingBulletRow}>
      <View style={s.landingBulletDot} />
      <Text style={s.landingBulletText}>{text}</Text>
    </View>
  );
}

/* Operator ("pills in Smart Bead Bracelet hebben geen animatie" + "kijk
   ons protocol na, pas overal toe"): huisstijl §5 knop-formule
   (scale .97 + opacity .85) + §5 "CTA-tik → haptiek" — de pillen hier
   gebruikten tot nu toe RN's statische `pressed &&`-stijlwissel (een
   instant snap, geen echte animatie/duur) en geen haptiek. Eén
   herbruikbare Reanimated-wrapper, analoog aan CardBounce in
   (tabs)/index.tsx maar met de PLATTE knop-easing (geen spring-
   overshoot — dit zijn segmented-control-tabs/pillen, geen kaarten). */
function PillPress({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: object;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 1 - (1 - scale.value) * 5,
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 80 });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120 });
      }}
      accessibilityLabel={accessibilityLabel}
    >
      <ReAnimated.View style={[style, pressStyle]}>{children}</ReAnimated.View>
    </Pressable>
  );
}

/* Operator, 26 september 2026: DetailPanel (gemstone-edition-detailpaneel
   met zoom) verwijderd samen met de collectie-sectie. */

/* ── Main screen ───────────────────────────────────────────────────────── */

export default function BraceletScreen() {
  /* ── Access-model state (CLAUDE.md §3 gast-first) ───────────────────────
     De Bracelet-tab is voor IEDEREEN zichtbaar — gast, free, pro, owner.
     Wat varieert is de top-banner + sign-in-link, niet de pagina-content.
     Operator-besluit 2026-05-25: users-first, easy, modern, pro — geen
     hidden routes, geen verbergen voor pro-audio.

     Drie banner-types op deze pagina:
       1. Pro-audio member  → "Reserved for VIBEZCORE members" (subtiel)
       2. Bracelet activated → "Your bracelet is active" + Open Control CTA
                              (STUB — wacht op activation-endpoint backend)
       3. Niet ingelogd     → "Have an activation code? Sign in" onder de
                              waitlist-knop (kleine link, niet dominant)
     Alle 3 zijn additief; je ziet er max 1 tegelijk per zone. */
  const { isPro } = useSubscription();
  /* Operator, 26 september 2026 ("cta niet bereikbaar, mini-player staat
     erover op de welcome-pagina van bracelet"): nodig om de intro-overlay
     hieronder ruimte te laten reserveren voor de mini-player. */
  const playerState = usePlayerState();
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  /* Operator, 15 september 2026: "dit is welcome voor bracelet, in de
     app" — zelfde `intro`-overlay als de Audio Library-tab: foto + Ken
     Burns-ademing + staggered eyebrow/titel + shimmer-CTA, ALTIJD
     getoond, zelfde "intro mag zich elke keer tonen"-besluit als bij
     Audio Library. Vervangt de eerdere kale `topPhotoHero` (foto zonder
     tekst/CTA).

     BUG (operator: "bracelet welcome is weg nu"): `useState(true)`
     evalueert maar ÉÉN keer per keer dat dit component daadwerkelijk
     MONTEERT — en React Navigation's Tabs-navigator monteert een tab
     maar één keer en houdt 'm daarna gewoon in leven bij elke tab-
     wissel (geen remount). Wie 'm dus één keer wegtikte (CTA →
     `finishBraceletIntro`) zag 'm bij terugkeer naar de tab nooit meer
     — exact "weg". `useFocusEffect` zet de vlag terug op `true` bij
     ELKE keer dat deze tab focus krijgt, ongeacht of 'ie al gemount
     was. */
  const [braceletIntro, setBraceletIntro] = useState(true);
  const finishBraceletIntro = useCallback(() => setBraceletIntro(false), []);
  useFocusEffect(
    useCallback(() => {
      setBraceletIntro(true);
    }, []),
  );
  /* Operator, 15 september 2026: "foto meer naar rechts zodat de baard
     niet zichtbaar is, dat is te veel ai" — een basiszoom bovenop de
     Ken Burns-ademing geeft overhang om te kunnen schuiven; de schuif
     zelf is een veilig-berekend maximum (zelfde aanpak als de Audio
     Library-intro) zodat er nooit een lege rand ontstaat, ongeacht
     schermbreedte.
     Operator, 30 september 2026 ("de bracelet zelf mag focus krijgen,
     nu lijkt dat beetje blur"): de bron-foto (`pic hero bracelet app.png`,
     941×1670) is zelf scherp — de armband staat er haarscherp op (VZC-
     gesp, blauwe steentjes). Het "blur"-gevoel kwam niet van de foto maar
     van STAPELING van vergroting: `resizeMode="cover"` op een portret-
     foto in een volledig-scherm-vlak schaalt 'm al met ~1.4×, en daar
     bovenop kwam nog een 1.3× basiszoom + Ken Burns-ademing tot 1.06× —
     samen bijna 2× de eigen resolutie, ver voorbij wat de foto aankan.
     Vervolg, zelfde dag ("haar/baard van de man ogen een beetje AI-
     achtig, hoe lossen we dat op"): eerste poging ging naar 1.12, maar
     `BRACELET_INTRO_MAX_SHIFT_X` schaalt MEE met deze zoom (zie de
     formule hieronder) — bij 1.12 bleef er nog maar ~10px schuifruimte
     over, veel te weinig om het gezicht/haar nog weg te schuiven zoals
     de oorspronkelijke 1.3 deed. Er zit een harde afruil in DEZE foto
     (arm opgetrokken tot naast het gezicht — pols en hoofd staan op
     bijna dezelfde hoogte, dus geen crop kan het ene tonen zonder het
     andere dichtbij te houden): meer schuifruimte = meer zoom = meer
     blur. 1.2 is het gekozen midden — houdt ~56% van de oorspronkelijke
     schuifruimte (genoeg om het gezicht grotendeels uit beeld te
     schuiven) terwijl de totale vergroting toch een flink stuk onder de
     oude ~2× blijft. ECHTE oplossing als dit nog niet ver genoeg gaat:
     een nieuwe, dichtere close-up-foto van enkel pols+armband (geen
     gezicht in the frame) — dat maakt deze hele afruil overbodig. */
  const BRACELET_INTRO_ZOOM = 1.2;
  const BRACELET_INTRO_MAX_SHIFT_X = Math.max(
    0,
    ((BRACELET_INTRO_ZOOM - 1) * Dimensions.get('window').width) / 2 - 15,
  );
  const BRACELET_INTRO_SHIFT_X = BRACELET_INTRO_MAX_SHIFT_X;
  /* "Foto beetje laten zakken" — positieve translateY schuift de foto
     naar beneden. Zelfde veiligheidsberekening als de horizontale
     schuif hierboven, nu op schermhoogte. */
  const BRACELET_INTRO_MAX_SHIFT_Y = Math.max(
    0,
    ((BRACELET_INTRO_ZOOM - 1) * Dimensions.get('window').height) / 2 - 15,
  );
  const BRACELET_INTRO_SHIFT_Y = Math.min(40, BRACELET_INTRO_MAX_SHIFT_Y);
  const introKenBurns = useSharedValue(1);
  useEffect(() => {
    if (!braceletIntro) return;
    introKenBurns.value = withRepeat(
      /* 1.06 → 1.04 (30 september 2026, zelfde blur-fix als
         BRACELET_INTRO_ZOOM hierboven): de ademing zelf stapelt boven op
         de basiszoom, dus telt volledig mee in de totale vergroting. */
      withTiming(1.04, { duration: 18000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [braceletIntro, introKenBurns]);
  const introKenBurnsStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: introKenBurns.value * BRACELET_INTRO_ZOOM },
      { translateX: BRACELET_INTRO_SHIFT_X },
      { translateY: BRACELET_INTRO_SHIFT_Y },
    ],
  }));
  const introEyebrowReveal = useSharedValue(0);
  const introTitleReveal = useSharedValue(0);
  useEffect(() => {
    if (!braceletIntro) return;
    introEyebrowReveal.value = withDelay(
      300,
      withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }),
    );
    introTitleReveal.value = withDelay(
      520,
      withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [braceletIntro]);
  const introEyebrowStyle = useAnimatedStyle(() => ({
    opacity: introEyebrowReveal.value,
    transform: [{ translateY: 10 * (1 - introEyebrowReveal.value) }],
  }));
  const introTitleStyle = useAnimatedStyle(() => ({
    opacity: introTitleReveal.value,
    transform: [{ translateY: 10 * (1 - introTitleReveal.value) }],
  }));
  const introCtaScale = useSharedValue(1);
  const introCtaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: introCtaScale.value }],
  }));
  const introShimmer = useSharedValue(-1);
  useEffect(() => {
    if (!braceletIntro) return;
    introShimmer.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(2600, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })),
        withDelay(1200, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [braceletIntro, introShimmer]);
  const introShimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: introShimmer.value * 170 }, { rotate: '18deg' }],
  }));
  /* Operator, 16 september 2026 ("de flow hoe dat stopt is amateuristisch
     — moet verdwijnen, niet plots stoppen"): de root cause was dat de
     streak bij value=+1 nog GEWOON zichtbaar in beeld stond (translateX
     260 is te weinig reisafstand voor een schermbrede foto) — 'm dus
     1800ms zichtbaar liet "plakken" voor 'ie ineens terugsprong. Fix:
     reisafstand nu SCREEN_WIDTH, zodat de streak bij BEIDE uitersten
     (-1 én +1) volledig buiten de geclipte fotobox valt — de instant
     reset (duration:0) gebeurt daardoor altijd onzichtbaar, en de pauze
     valt terwijl de streak al verdwenen is i.p.v. nog zichtbaar te
     hangen. */
  /* Iter 9cr (2026-05-31): Audio PRO landing-state. False = toont
     teaser-landing, true = toont volledige marketing-pagina. Resets
     elke tab-focus zodat user bij terugkomst weer op de landing belandt. */
  const [exploreUnlocked, setExploreUnlocked] = useState(false);
  /* Iter 9dq v101 (2026-06-04): ScrollView-refs voor scroll-to-top bij
     tab-focus. React Navigation unmount tabs niet — de ScrollView houdt
     z'n eigen scroll-positie vast tussen tab-switches. Operator-
     screenshot toonde dat de Audio PRO landing-content soms "buiten
     scherm" stond: alleen "Check it out" + "Back to Audio Library"
     onder de PREVIEW-banner, met de bracelet-render half off-screen.
     Oorzaak: user was vorige keer naar de bottom gescrolld, kwam terug,
     ScrollView nog op die positie. Fix: scrollTo({y:0}) bij elke focus.
     2 refs nodig omdat de Audio PRO landing-branch een eigen ScrollView
     heeft (early-return), apart van de hoofd-etalage ScrollView. */
  const landingScrollRef = useRef<ScrollView>(null);
  const mainScrollRef = useRef<ScrollView>(null);
  /* Iter v177 (2026-07-02): image prefetch verplaatst hierheen vanaf root
     _layout.tsx. Trigger alleen wanneer user daadwerkelijk deze tab opent —
     bracelet-mode fotos zijn niet nodig op cold-start van Audio-only users.
     `once`-flag voorkomt herhaalde prefetch bij elk focus-event. */
  const prefetchedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!prefetchedRef.current) {
        prefetchedRef.current = true;
        const PREFETCH_URLS = [
          'https://vibezcore-audio.b-cdn.net/images/gamma%20pic.jpg',
          'https://vibezcore-audio.b-cdn.net/images/welcome%20new.png',
          'https://vibezcore-audio.b-cdn.net/images/Social%20mastery.jpg',
          'https://vibezcore-audio.b-cdn.net/images/confident-man-with-beard-mustache-smiling-generated-by-ai.jpg',
          'https://vibezcore-audio.b-cdn.net/images/Rest%20%26%20Reset%20Delta.jpg',
        ];
        PREFETCH_URLS.forEach((url) => {
          Image.prefetch(url).catch(() => { /* stil falen */ });
        });
      }
      setExploreUnlocked(false);
      /* Scroll beide views naar top — alleen één is in DOM op een gegeven
         moment (op basis van showAudioProLanding && !exploreUnlocked),
         maar setExploreUnlocked-reset hierboven kan de andere zo direct
         mounten. requestAnimationFrame zorgt dat scroll firet NA de
         re-render zodat de juiste ref een geldige .current heeft. */
      requestAnimationFrame(() => {
        landingScrollRef.current?.scrollTo({ y: 0, animated: false });
        mainScrollRef.current?.scrollTo({ y: 0, animated: false });
      });
      return undefined;
    }, []),
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await getToken();
      if (!cancelled) setIsSignedIn(!!t);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  /* Bracelet-activation: PLACEHOLDER. Wanneer backend een endpoint heeft
     voor "is deze user's bracelet geactiveerd", komt hier een hook
     vergelijkbaar met useSubscription. Tot dan: niemand is bracelet-
     owner, dus de owner-banner toont nooit. Veilige default.
     Iter 9p: gebruikt nu useBraceletOwner() hook met dev-override
     support — laat dev/operator schakelen tussen states zonder code
     edit. Productie blijft op false tot endpoint klaar is. */
  const isBraceletOwner = useBraceletOwner();

  /* Iter 9aw (2026-05-31): safe-area insets voor de detail-popup overlay
     onderaan — voorkomt dat de Close-knop / specs achter de home-
     indicator (iPhone) of gesture-bar (Android) zakken. */
  const safeInsets = useSafeAreaInsets();

  /* Operator, 26 september 2026 ("op volledige scherm zonder scroll
     premium weergegeven"): de nieuwe zwarte hero moet exact het
     zichtbare scherm vullen zodat 'ie zonder scrollen helemaal te zien
     is.
     Operator ("cta staat deels onder de tabbladen"): TAB_BAR_HEIGHT was
     een vaste 64 — maar de échte tabBarStyle.height in (tabs)/_layout.tsx
     is `62 + insets.bottom` (gebaren-navigatie-balk komt daar nog eens
     bovenop). Zonder die insets.bottom mee te rekenen was heroFullHeight
     stelselmatig te groot, en schoof de CTA precies dat stuk onder de
     tab bar. Nu 62 + safeInsets.bottom, exact zoals _layout.tsx. */
  const TAB_BAR_HEIGHT = 62 + safeInsets.bottom;
  const PREVIEW_PILL_HEIGHT = 36; // PreviewPill wrap+pill, approx
  const heroFullHeight = Math.max(
    440,
    Dimensions.get('window').height -
      safeInsets.top -
      TAB_BAR_HEIGHT -
      (isBraceletOwner ? 0 : PREVIEW_PILL_HEIGHT),
  );

  /* Iter 9v: owners zien BraceletControl INLINE in deze tab. Voorheen
     deden we router.replace('/bracelet-control'), maar dat is een
     Stack-route buiten de (tabs) groep → tab-bar verdween. Door
     <BraceletControl /> direct te renderen blijft de tab-bar zichtbaar
     en kan user makkelijk naar Audio of Account switchen. */

  /* Operator, 15 september 2026 ("een app is om te doen, niet om te
     lezen — gooi de 7 tekststappen van het hoofdscherm af"): "How it
     works" leeft niet langer als vaste sectie op de pagina. De 7 stappen
     (STORY, zie boven) blijven wel bereikbaar — via een klein "i"-knopje
     rechtsboven — voor de twijfelende koper die de details wél wil
     lezen, zonder dat het hoofdscherm ermee volgeplakt staat. */
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  /* Operator, 26 september 2026 ("tabs boven en onder plaatsen die naar
     specifieke zaken verwijzen ... hoe duidelijk maken waar de haptic
     core is"): welk "A closer look"-onderwerp actief is. `null` = geen
     popup open (pills/hotspots zijn dan allemaal neutraal). */
  const [closerLookIndex, setCloserLookIndex] = useState<number | null>(null);

  /* Operator ("verwijder die 5 losse pillen, maak 1 nieuwe pill met 5
     states, zet de 5 states in de popup met kleur en info"): geen 5
     losse tikbare pillen meer — 1 pill die de 5 modi samenvat, tik erop
     opent 1 sheet met alle 5 (elk met kleur-stip + naam + duur/blurb). */
  const [statesInfoOpen, setStatesInfoOpen] = useState(false);

  /* Operator, 26 september 2026 (Apple-app-feedback: "subtiel pulserende,
     semitransparante stipjes op de hardware"): zelfde "ademende puls,
     2.4s cyclus" als een status-stip (huisstijl §5) — één shared value,
     continu lopend, gebruikt door de actieve hotspot(s) als expanding
     ring. */
  const hotspotPulse = useSharedValue(0);
  useEffect(() => {
    hotspotPulse.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [hotspotPulse]);
  const hotspotPulseStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - hotspotPulse.value),
    transform: [{ scale: 1 + hotspotPulse.value * 1.2 }],
  }));

  /* Operator ("heb je ook met de animaties rekening gehouden? kijk
     document protocol na"): huisstijl §5 — "bij het openen van een
     pagina/scherm: staggered fade-up, titel 0ms → subkop 200ms →
     beeld 400ms → CTA 600ms". De nieuwe hero (header/pillen/foto/CTA)
     verscheen tot nu toe instant, zonder die stagger. Vier shared
     values, één per blok, elk fade+translateY(20→0). */
  const heroHeaderIn = useSharedValue(0);
  const heroPillsIn = useSharedValue(0);
  const heroPhotoIn = useSharedValue(0);
  const heroCtaIn = useSharedValue(0);
  useEffect(() => {
    const cfg = { duration: 500, easing: Easing.out(Easing.cubic) };
    heroHeaderIn.value = withDelay(0, withTiming(1, cfg));
    heroPillsIn.value = withDelay(200, withTiming(1, cfg));
    heroPhotoIn.value = withDelay(400, withTiming(1, cfg));
    heroCtaIn.value = withDelay(600, withTiming(1, cfg));
  }, [heroHeaderIn, heroPillsIn, heroPhotoIn, heroCtaIn]);
  const fadeUpStyle = (v: typeof heroHeaderIn) =>
    useAnimatedStyle(() => ({
      opacity: v.value,
      transform: [{ translateY: (1 - v.value) * 20 }],
    }));
  const heroHeaderInStyle = fadeUpStyle(heroHeaderIn);
  const heroPillsInStyle = fadeUpStyle(heroPillsIn);
  const heroPhotoInStyle = fadeUpStyle(heroPhotoIn);
  const heroCtaInStyle = fadeUpStyle(heroCtaIn);

  /* Huisstijl §5: "Indrukken: scale(.97) + opacity: .85" — CTA-tik-
     feedback (zelfde formule als introCta hierboven) + "CTA-tik →
     haptiek: een tik op de primaire CTA geeft een lichte haptic-
     selection-tik". */
  const heroCtaScale = useSharedValue(1);
  const heroCtaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroCtaScale.value }],
    opacity: 0.85 + 0.15 * (heroCtaScale.value - 0.97) / 0.03,
  }));

  /* Currency-toggle weggehaald 2026-05-26: alleen USD tonen. */

  /* Iter 9v: owners krijgen BraceletControl inline binnen de tab.
     Tab-bar blijft zichtbaar, geen marketing-flash. */
  if (isBraceletOwner) {
    return <BraceletControl />;
  }

  /* Iter 9cr (2026-05-31): Audio PRO landing pattern.
     - Audio PRO (isPro && !isBraceletOwner) krijgt op /bracelet tab een
       subtiele landingspagina (animated render + kort bullet-overzicht
       + Kickstarter datum + CTA) i.p.v. direct de volledige free
       marketing.
     - CTA "Explore the Bracelet →" toont de volledige free-pagina
       voor wie verder wil ontdekken.
     - Bij terugkeer naar de tab (focus regain) resetten we naar de
       landing — zo blijft het niet op de marketing hangen.
     - Voor echte free/guest users blijft de volledige marketing direct
       de default (geen landing-step ertussen). */
  const showAudioProLanding = isPro && !isBraceletOwner;

  /* Iter 9cr: Audio PRO landing-render. Compact teaser zodat de tab
     niet meteen marketing-flash voelt voor wie al PRO is. */
  if (showAudioProLanding && !exploreUnlocked) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={s.root}>
        {/* Operator, 15 september 2026: "de bracelet welcome page moet
           ook altijd standaard in staan" — deze Audio-PRO-landing was
           een APARTE early return, dus miste de intro-overlay hierboven
           volledig (die leefde alleen in de hoofd-return eronder). Zelfde
           blok hier, met dezelfde shared values (dit is nog steeds
           hetzelfde component, geen aparte hook-scope). */}
        {braceletIntro && (
          <View style={[StyleSheet.absoluteFill, s.introOverlay]}>
            <ReAnimated.View style={[StyleSheet.absoluteFill, introKenBurnsStyle]}>
              <Image
                source={{ uri: `${CDN}/pic%20hero%20bracelet%20app.png` }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </ReAnimated.View>
            <View
              style={[
                s.introTextWrap,
                playerState.session && { paddingBottom: 34 + MINI_PLAYER_HEIGHT + 12 },
              ]}
            >
              <ReAnimated.Text style={[s.introEyebrow, introEyebrowStyle]}>
                KICKSTARTER · FALL 2026
              </ReAnimated.Text>
              <ReAnimated.Text style={[s.introTitle, introTitleStyle]}>
                Smart Bead Bracelet
              </ReAnimated.Text>
              <ReAnimated.View
                style={[{ marginTop: 28, alignSelf: 'stretch' }, introCtaPressStyle]}
              >
                <Pressable
                  onPress={finishBraceletIntro}
                  onPressIn={() => {
                    introCtaScale.value = withTiming(0.96, { duration: 80 });
                  }}
                  onPressOut={() => {
                    introCtaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
                  }}
                  style={s.introCtaWrap}
                  android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
                  accessibilityLabel="Explore the Smart Bead Bracelet"
                >
                  <View style={s.introCta}>
                    <Text style={s.introCtaTxt}>Explore Bracelet</Text>
                    <ReAnimated.View
                      style={[s.introCtaShimmer, introShimmerStyle]}
                      pointerEvents="none"
                    >
                      <LinearGradient
                        colors={['#ffffff00', '#ffffff9a', '#ffffff00']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </ReAnimated.View>
                  </View>
                </Pressable>
              </ReAnimated.View>
            </View>
          </View>
        )}
        {/* Iter 9dq v79: zelfde preview-indicator als de main bracelet-tab
            route — Audio PRO landing is ook bracelet-content.
            Operator, 17 september 2026: volle-breedte oranje
            PreviewBanner → neutrale PreviewPill, zelfde als
            bracelet-control.tsx. */}
        <PreviewPill />
        <ScrollView
          ref={landingScrollRef}
          contentContainerStyle={s.landingScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Operator, 15 september 2026: "daar staat te veel, wat doen
             we" — "KICKSTARTER · FALL 2026" + "Smart Bead Bracelet"
             stond hier NOG een keer, direct na de nieuwe volledige-
             scherm-intro die exact diezelfde boodschap al bracht. Weg —
             na de intro gaat de pagina nu direct door met de bullets. */}

          {/* 2×3 bullet-grid — 6 core features horizontaal. */}
          <View style={s.landingBulletGrid}>
            <LandingBullet text="Bottom-up regulation" />
            <LandingBullet text="Calibrated pulses" />
            <LandingBullet text="Instant state control" />
            <LandingBullet text="5 haptic modes" />
            <LandingBullet text="Interchangeable beadband" />
            <LandingBullet text="15 gemstone editions" />
          </View>

          {/* Transparante bracelet-render — geen witte card meer.
              Iter 9df (2026-05-31): eigen operator-knob voor Audio PRO
              landing → HAPTIC_RING_OFFSET_Y_AUDIO_PRO bovenaan dit
              bestand. Independent van de Free hero. */}
          <SonarRender
            transparent
            ringOffsetY={HAPTIC_RING_OFFSET_Y_AUDIO_PRO}
          />

          {/* Iter 9dg (2026-05-31): CTA hoger door reductie van de
              marginTop op de CTA. Daaronder een subtiele "Back to
              Audio Library" link die de PRO-user direct terug brengt
              naar zijn primary tab (de audio library) zonder dat 'ie
              eerst tab-bar moet zoeken. */}
          <Pressable
            style={s.landingCtaTight}
            onPress={() => setExploreUnlocked(true)}
            android_ripple={{ color: 'rgba(10,10,12,0.15)' }}
            accessibilityLabel="Explore the full bracelet page"
          >
            <Text style={s.landingCtaText}>Check it out</Text>
            <Text style={s.landingCtaArrow}>→</Text>
          </Pressable>
          <Pressable
            style={s.landingBackLink}
            onPress={() => router.navigate('/')}
            hitSlop={12}
            accessibilityLabel="Back to Audio Library"
          >
            <Text style={s.landingBackLinkText}>← Back to Audio Library</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.root}>
      {/* Operator, 15 september 2026: "dit is welcome voor bracelet, in
         de app" — overlay-laag, zelfde opzet als de Audio Library-intro
         (zie de toelichting bij `braceletIntro` hierboven): foto + Ken
         Burns + staggered tekst + shimmer-CTA, boven al de rest in
         gerenderd zodat 'ie sowieso bovenop ligt ongeacht waar in de
         boom, en toont zich bij ELKE montage van deze tab. */}
      {braceletIntro && (
        <View style={[StyleSheet.absoluteFill, s.introOverlay]}>
          <ReAnimated.View style={[StyleSheet.absoluteFill, introKenBurnsStyle]}>
            <Image
              source={{ uri: `${CDN}/pic%20hero%20bracelet%20app.png` }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </ReAnimated.View>
          {/* Operator, 15 september 2026: "heel goed, geen gradient
             onderaan" — verwijderd (zelfde soort uitdoving als bij
             Audio Library, hier bleek de foto zelf al genoeg contrast
             te geven voor de tekst eronder). */}
          <View
            style={[
              s.introTextWrap,
              playerState.session && { paddingBottom: 34 + MINI_PLAYER_HEIGHT + 12 },
            ]}
          >
            <ReAnimated.Text style={[s.introEyebrow, introEyebrowStyle]}>
              KICKSTARTER · FALL 2026
            </ReAnimated.Text>
            <ReAnimated.Text style={[s.introTitle, introTitleStyle]}>
              Smart Bead Bracelet
            </ReAnimated.Text>
            <ReAnimated.View
              style={[{ marginTop: 28, alignSelf: 'stretch' }, introCtaPressStyle]}
            >
              <Pressable
                onPress={finishBraceletIntro}
                onPressIn={() => {
                  introCtaScale.value = withTiming(0.96, { duration: 80 });
                }}
                onPressOut={() => {
                  introCtaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
                }}
                style={s.introCtaWrap}
                android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
                accessibilityLabel="Explore the Smart Bead Bracelet"
              >
                <View style={s.introCta}>
                  <Text style={s.introCtaTxt}>Explore Bracelet</Text>
                  <ReAnimated.View
                    style={[s.introCtaShimmer, introShimmerStyle]}
                    pointerEvents="none"
                  >
                    <LinearGradient
                      colors={['#ffffff00', '#ffffff9a', '#ffffff00']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </ReAnimated.View>
                </View>
              </Pressable>
            </ReAnimated.View>
          </View>
        </View>
      )}

      {/* Iter v194 (2026-07-04): preview-indicator alleen voor NIET-owners.
          Echte bracelet-owners (die betaald hebben + code hebben ingevoerd)
          zien deze niet — voor hen is de bracelet een echt product, niet
          een preview.
          Operator, 17 september 2026 ("bovenaan ook tekst preview zoals in
          bracelet control, niet in gele strip"): volle-breedte oranje
          PreviewBanner → neutrale PreviewPill. */}
      {!isBraceletOwner && <PreviewPill />}
      <ScrollView
        ref={mainScrollRef}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Operator, 26 september 2026: volledige-scherm hero (geen scroll
           nodig om 'm heel te zien) — header + sub + 5-states-pil-rij, de
           echte productfoto (HERO_PHOTO_URL, cover + gradient naar zwart)
           met "A closer look"-pills + hotspots (1-op-1 de echte
           webpagina-sectie), en onderaan Preview Control Center + Reserve
           on Kickstarter. Vervangt de vorige "Launching / Fall 2026"-tekst
           + foto van een arm, én de modi-grid/collectie/pricing-card/
           breathwork-kaart die hieronder stonden (operator: "wil heel die
           pagina anders ... alles onderaan verwijderen"). */}
        <View style={[s.productHero, { height: heroFullHeight }]}>
          <ReAnimated.View style={[s.heroTopGroup, heroHeaderInStyle]}>
            {/* Operator, 26 september 2026 ("header links subheader
               grijs"): de intro-stijlen (introEyebrow/introTitle) zijn
               gecentreerd — correct voor de modale volledige-scherm-intro
               hierboven, maar dit is een gewone pagina-header en die is
               overal elders in de app links uitgelijnd (zie sectionHead-
               instanties verderop in dit bestand). Subheader is gewone
               gedimde tekst (C.textDim), geen accentkleur. */}
            {/* Operator (Apple-HIG-feedback: "twee grote acties vechten om
               aandacht — Kickstarter-promotie verplaatsen naar een
               subtiele banner bovenaan"): de eyebrow is nu zelf de
               Kickstarter-ingang (tikbaar → waitlist) i.p.v. een losse
               tekstlink onderaan naast de primaire CTA. Zie
               heroBottomGroup: nog maar 1 actie daar. */}
            <Pressable
              onPress={() => openExternal(WAITLIST_BRACELET_URL)}
              hitSlop={8}
              accessibilityLabel="Kickstarter — Fall 2026, reserve nu"
            >
              <Text style={s.heroEyebrowTop}>LAUNCHING · FALL 2026 →</Text>
            </Pressable>
            <Text style={s.heroTitleTop}>Smart Bead Bracelet</Text>
            <Text style={s.heroSubTop}>Instant State Control</Text>
          </ReAnimated.View>

          {/* Operator ("1 nieuwe pill met 5 states, zet de 5 states in de
             popup"): maakt "Instant State Control" hierboven concreet —
             1 pill met de 5 echte modus-kleuren (ble-contract.ts, bron
             van waarheid) als stippen; tik opent 1 sheet met alle 5. */}
          {/* Operator ("kunnen dat transparante blur pills worden"): echte
             BlurView (niet rgba-fake-glass, zie [[feedback-real-blurview-
             not-fake-glass]]) i.p.v. een effen donker paneel. */}
          <ReAnimated.View style={heroPillsInStyle}>
          <PillPress
            style={{ alignSelf: 'flex-start' }}
            onPress={() => setStatesInfoOpen(true)}
            accessibilityLabel="5 haptic states — meer info"
          >
            <BlurView intensity={40} tint="dark" style={s.statesSummaryPill}>
              {BLE_MODES.map((m) => (
                <View
                  key={m.mode}
                  style={[
                    s.statesSummaryDot,
                    { backgroundColor: m.color },
                    m.color === '#FFFFFF' && s.modeSwipeDotOutline,
                  ]}
                />
              ))}
              <Text style={s.statesSummaryText}>5 States</Text>
            </BlurView>
          </PillPress>

          {/* Operator, 26 september 2026 ("tabs boven en onder plaatsen die
             naar specifieke zaken verwijzen"): pill-tabs boven de render —
             tikken selecteert een onderwerp, licht het bijbehorende punt
             op de bracelet op, en opent de detail-popup onderaan. */}
          {/* Operator, 26 september 2026 (Apple-app-feedback: "knoppenwolk
             vervangen door horizontaal segmented control, met je duim
             doorheen swipen"): losse rij die wrapte naar 2-3 regels →
             één horizontale swipe-strip, zoals een echte iOS tab-strip. */}
          {/* Operator ("nog altijd heel hoog", 4de poging): de vorige
             fixes gaven de hoogte aan de ScrollView zelf (style prop) —
             blijkbaar onbetrouwbaar op dit toestel. Nu een gewone `View`
             met een HARDE `height:44` + `overflow:'hidden'` als
             buitenste laag (kan niet uitrekken, is geen ScrollView-
             quirk), met de ScrollView zelf op `flex:1` daarbinnen —
             bekend robuust patroon (vaste-hoogte-clip-container +
             flex:1-scrollview), geen giswerk meer over wat de hoogte
             bepaalt. */}
          {/* Operator ("kunnen dat transparante blur pills worden"): echte
             BlurView i.p.v. het effen donkere paneel. */}
          <BlurView intensity={40} tint="dark" style={s.closerPillsRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={s.closerPillsRowContent}
            >
              {CLOSER_LOOK.map((t, i) => {
                const on = closerLookIndex === i;
                return (
                  /* Operator ("pills hebben geen animatie, pas protocol
                     overal toe"): PillPress i.p.v. de statische
                     `pressed &&`-snap — echte Reanimated-tijdlijn +
                     haptic-tik, zelfde knop-formule (§5). */
                  <PillPress
                    key={t.key}
                    style={[s.closerPill, on && s.closerPillOn]}
                    onPress={() => setCloserLookIndex(i)}
                    accessibilityLabel={t.pill}
                  >
                    <Text
                      style={[s.closerPillText, on && s.closerPillTextOn]}
                      numberOfLines={1}
                    >
                      {t.pill}
                    </Text>
                  </PillPress>
                );
              })}
            </ScrollView>
          </BlurView>
          </ReAnimated.View>

          <ReAnimated.View style={[s.heroStage, heroPhotoInStyle]}>
            {/* Operator ("kan de bracelet die er eerst stond terug
               gebruiken met zwarte achtergrond"): de echte productfoto
               (was topPhotoHero vóór de redesign) i.p.v. de transparante
               SonarRender-illustratie — cover-crop + gradient-fade naar
               zwart onderaan zodat de foto's eigen wit-verloop (studio-
               achtergrond) nooit doorschijnt. */}
            <Image
              source={{ uri: HERO_PHOTO_URL }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', '#000000']}
              locations={[0.72, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* Operator ("dots weg, enkel pulserende dot bij aantikken
               pill"): geen permanent zichtbare punten meer op de bracelet
               — alleen het GESELECTEERDE onderwerp toont zijn punt(en),
               pulserend, op de juiste plek. Selectie gaat voortaan enkel
               via de pillen (geen tik-op-punt meer, want er is niets
               zichtbaars om op te tikken vóór selectie). */}
            {closerLookIndex !== null &&
              CLOSER_LOOK[closerLookIndex].hotspots.map((pos, hi) => (
                <View
                  key={hi}
                  style={{ position: 'absolute', top: pos.top, left: pos.left }}
                  pointerEvents="none"
                >
                  <ReAnimated.View
                    style={[s.closerHotspotPulse, hotspotPulseStyle]}
                  />
                  <View style={[s.closerHotspot, s.closerHotspotOn]} />
                </View>
              ))}
          </ReAnimated.View>

          <ReAnimated.View style={[s.heroBottomGroup, heroCtaInStyle]}>
            {/* Operator (Apple-HIG-feedback): nog maar 1 primaire actie
               hier — Kickstarter zit nu in de tikbare eyebrow bovenaan.
               Operator ("kijk document protocol na"): huisstijl §5
               "Indrukken: scale(.97) + opacity: .85" + "CTA-tik →
               haptiek" ontbraken — nu wel, zelfde formule als introCta
               hierboven. */}
            {/* Operator ("tekst staat niet gecentreerd, te veel naar
               rechts"): deze wrapper miste `width:'100%'` — zonder dat
               resolveert de Pressable's eigen `width:'100%'` tegen een
               ouder zonder vaste breedte (heroBottomGroup rekt niet uit,
               alignItems:'center'), en krimpt/verschuift de knop. */}
            <ReAnimated.View style={[{ width: '100%' }, heroCtaPressStyle]}>
              <Pressable
                style={s.heroCta}
                onPress={() => router.push('/bracelet-control')}
                onPressIn={() => {
                  heroCtaScale.value = withTiming(0.97, { duration: 80 });
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                onPressOut={() => {
                  heroCtaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
                }}
                android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                accessibilityLabel="Preview the bracelet app"
              >
                {/* Operator ("geen pijl in cta, dat is een regel bij
                   ons"): huisstijl §2 — geen tekst-pijltjes als
                   navigatie-indicator op een primaire CTA-knop.
                   Operator ("is dat correct control center?"): "Control
                   Center" bestond nergens anders in de app — de echte
                   navigatietitel van dit scherm is gewoon "Bracelet"
                   (zie (tabs)/_layout.tsx). Terug naar de al vastgelegde
                   tekst van vóór deze redesign: "Preview the bracelet
                   app". */}
                <Text style={s.heroCtaText}>Preview the Bracelet App</Text>
              </Pressable>
            </ReAnimated.View>
          </ReAnimated.View>
        </View>

        {/* ── "A closer look"-detailpopup ─────────────────────────────────
           Zelfde bottom-sheet-patroon als de andere sheets in dit bestand
           (howItWorksOpen/breathChooserOpen). */}
        {closerLookIndex !== null && (
          <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={() => setCloserLookIndex(null)}
            statusBarTranslucent
          >
            <View style={s.breathChooserModalRoot}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setCloserLookIndex(null)}
                accessibilityLabel="Close"
              />
              <View
                style={[
                  s.breathChooserSheet,
                  { paddingBottom: Math.max(safeInsets.bottom + 24, 72) },
                ]}
              >
                <View style={s.breathChooserHandle} />
                <Pressable
                  style={s.breathChooserClose}
                  onPress={() => setCloserLookIndex(null)}
                  hitSlop={10}
                  accessibilityLabel="Close"
                >
                  <Text style={s.breathChooserCloseText}>✕</Text>
                </Pressable>
                <Text style={s.storyRowNum}>
                  {String(closerLookIndex + 1).padStart(2, '0')}
                </Text>
                <Text style={s.breathChooserTitle}>
                  {CLOSER_LOOK[closerLookIndex].title}
                </Text>
                <Text style={s.breathChooserSub}>
                  {CLOSER_LOOK[closerLookIndex].body}
                </Text>
                <View style={s.tagRow}>
                  {CLOSER_LOOK[closerLookIndex].tags.map((tag) => (
                    <View key={tag} style={s.tag}>
                      <Text style={s.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* ── State-infopopup (1 sheet, alle 5 haptic-modi) ────────────────
           Operator ("verwijder die 5 losse pillen, maak 1 nieuwe pill met
           5 states, zet de 5 states in de popup met kleur en info"): 1
           pill hierboven, tik toont hier alle 5 in één sheet — elk zijn
           eigen kleur-stip + naam + blurb + echte duur (BLE_MODES, bron
           van waarheid ble-contract.ts). */}
        {statesInfoOpen && (
          <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={() => setStatesInfoOpen(false)}
            statusBarTranslucent
          >
            <View style={s.breathChooserModalRoot}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setStatesInfoOpen(false)}
                accessibilityLabel="Close"
              />
              <View
                style={[
                  s.breathChooserSheet,
                  { paddingBottom: Math.max(safeInsets.bottom + 24, 72) },
                ]}
              >
                <View style={s.breathChooserHandle} />
                <Pressable
                  style={s.breathChooserClose}
                  onPress={() => setStatesInfoOpen(false)}
                  hitSlop={10}
                  accessibilityLabel="Close"
                >
                  <Text style={s.breathChooserCloseText}>✕</Text>
                </Pressable>
                <Text style={s.breathChooserEyebrow}>5 HAPTIC STATES</Text>
                <Text style={s.breathChooserTitle}>Instant State Control</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={s.stateInfoList}>
                    {BLE_MODES.map((m, i) => (
                      <View
                        key={m.mode}
                        style={[
                          s.stateInfoRow,
                          i === BLE_MODES.length - 1 && s.storyRowLast,
                        ]}
                      >
                        <View
                          style={[
                            s.stateInfoDot,
                            { backgroundColor: m.color },
                            m.color === '#FFFFFF' && s.modeSwipeDotOutline,
                          ]}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={s.storyRowTitle}>{m.name}</Text>
                          <Text style={s.storyRowBody}>{m.blurb}</Text>
                          <Text style={s.stateInfoDuration}>
                            {m.minMinutes}–{m.maxMinutes} min · default{' '}
                            {m.defaultMinutes} min
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* ── PERSONALISATIE-BANNER ─────────────────────────────────────
            Bracelet-owner krijgt de prominente "Your bracelet is active"
            + Open Control CTA. Pro-audio (zonder bracelet) krijgt een
            subtielere "Reserved for VIBEZCORE members"-banner. Gast en
            free-user zien geen banner — die zien direct de hero zoals
            beoogd voor cold-discovery. Volgorde van checks is dwingend:
            owner wint van pro (een pro met bracelet ziet de owner-CTA,
            niet de pro-banner — anders dubbele boodschap). */}
        {isBraceletOwner ? (
          <Pressable
            style={s.ownerBanner}
            onPress={() => router.push('/bracelet-control')}
            android_ripple={{ color: 'rgba(10,10,12,0.10)' }}
            accessibilityLabel="Open your bracelet control screen"
          >
            <View style={s.ownerBannerLeft}>
              <View style={s.ownerDot} />
              <View>
                <Text style={s.ownerTitle}>Your bracelet is active</Text>
                <Text style={s.ownerSub}>Tap to open Bracelet Control</Text>
              </View>
            </View>
            <Text style={s.ownerArrow}>›</Text>
          </Pressable>
        ) : isPro ? (
          <View style={s.proBanner}>
            <Text style={s.proBannerText}>
              ✨  Member price locked: {PRICING.bracelet.main} at launch
              (not {PRICING.bracelet.old}) — with priority access
            </Text>
          </View>
        ) : null}

        {/* Operator, 26 september 2026 ("wil heel die pagina anders ...
           alles onderaan verwijderen"): de modi-grid, gemstone-collectie,
           Kickstarter-pricingkaart en de breathwork-discovery-kaart die
           hier stonden zijn weg. De hero hierboven is nu de hele pagina
           (feature-tabs + Preview Control Center + Reserve on Kickstarter
           dekken wat deze secties deden). PRICING/EDITIONS-data blijft
           bestaan (PRICING wordt elders geïmporteerd, zie
           PremiumPaywallModal.tsx) maar wordt hier niet meer getoond. */}

        {/* Owner-eyebrow ipv hero (iter 9t): geeft owners een korte
            "you are here"-context zonder marketing-vibes. */}
        {isBraceletOwner && (
          <Text style={s.ownerEyebrow}>YOUR BRACELET</Text>
        )}
      </ScrollView>

      {/* Operator, 15 september 2026: klein, elegant "i"-knopje vast
         rechtsboven in de hoek (blijft staan tijdens scrollen — sibling
         van de ScrollView, niet erbinnen). Opent de "How it works"-sheet
         hieronder. Vervangt de losse tekst-sectie die eerder op het
         hoofdscherm stond. */}
      <Pressable
        style={[s.infoBtn, { top: safeInsets.top + 10 }]}
        onPress={() => setHowItWorksOpen(true)}
        hitSlop={10}
        accessibilityLabel="How the bracelet works"
      >
        <Text style={s.infoBtnText}>i</Text>
      </Pressable>

      {/* ── "How it works"-infoblad ────────────────────────────────────
         Zelfde bottom-sheet-patroon als de breathChooser-modal verderop
         (RN <Modal>, transparent, slide-in). De 7 STORY-stappen (data
         bovenaan dit bestand) staan hier nog steeds volledig — enkel niet
         meer standaard zichtbaar op het hoofdscherm. */}
      {howItWorksOpen && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setHowItWorksOpen(false)}
          statusBarTranslucent
        >
          <View style={s.breathChooserModalRoot}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setHowItWorksOpen(false)}
              accessibilityLabel="Close"
            />
            <View
              style={[
                s.breathChooserSheet,
                { maxHeight: '80%', paddingBottom: Math.max(safeInsets.bottom + 24, 72) },
              ]}
            >
              <View style={s.breathChooserHandle} />
              <Pressable
                style={s.breathChooserClose}
                onPress={() => setHowItWorksOpen(false)}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <Text style={s.breathChooserCloseText}>✕</Text>
              </Pressable>
              <Text style={s.breathChooserEyebrow}>HOW IT WORKS</Text>
              <Text style={s.breathChooserTitle}>The full picture.</Text>
              <Text style={s.breathChooserSub}>
                Everything the bracelet does, in seven short points.
              </Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.storyList}>
                  {STORY.map((step, i) => (
                    <View
                      key={step.n}
                      style={[s.storyRow, i === STORY.length - 1 && s.storyRowLast]}
                    >
                      <Text style={s.storyRowNum}>{step.n}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.storyRowTitle}>{step.title}</Text>
                        <Text style={s.storyRowBody}>{STORY_SHORT[i]}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Operator, 26 september 2026: edition-detail-overlay verwijderd
         samen met de gemstone-collectie (er is geen grid meer om op te
         tikken). DetailPanel/splitDesc/EDITIONS-selectiestate zijn ook
         weg — zie verderop. */}

    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
  },
  scroll: { padding: 16, paddingBottom: 48 },

  /* Operator, 26 september 2026 ("bracelet centraal op zwarte achtergrond
     op volledige scherm zonder scroll, premium, cta naar preview control
     center"): vervangt topPhotoHero + darkHeaderBlock (foto van een arm +
     los tekstvlak). `height` komt inline mee (heroFullHeight, berekend in
     BraceletScreen uit window-hoogte minus safe-area/tab-bar/PreviewPill)
     zodat de hele hero — header, bracelet-render, CTA — precies het
     zichtbare scherm vult en niemand hoeft te scrollen om 'm heel te zien.
     Negative margin = zelfde full-bleed-truc als de oude stijlen. */
  /* Operator ("pils iets lager meer ademruimte, bracelet + cta's naar
     boven, moet zonder scroll zijn"): `justifyContent:'space-between'`
     rekte alle 4 kinderen gelijkmatig uit over de volle heroFullHeight —
     dat duwde stage/CTA juist te ver naar onder. `flex-start` pakt alles
     bovenaan samen (expliciete marginTop per blok hieronder bepaalt de
     ademruimte); wat overblijft is lege ruimte onderaan, niet uitgerekt. */
  /* Operator ("opnieuw past niet alles, waarom fix jij dat niet"): elke
     vorige poging gokte een vaste `heroStage`-hoogte + handmatige marges
     tegen een berekende `heroFullHeight` — bij elke content-toevoeging
     (states-pil-rij) klopte die optelsom niet meer en overflowde de box
     alsnog. Robuuste fix: `heroStage` krijgt `flex:1` (zie hieronder) en
     absorbeert ALTIJD precies de resterende ruimte na de andere,
     vast-hoge blokken — geen handmatige optelsom meer nodig, kan dus
     nooit meer overflowen. `overflow:'hidden'` als extra vangnet. */
  /* Operator ("waarom zit er een scroll op de pagina? alles staat toch
     mooi op het scherm"): marginTop/marginHorizontal heffen de top/zij-
     padding van `scroll` (de ScrollView-contentContainerStyle) al op,
     maar niemand hief de `paddingBottom:48` daarvan op — die 48px lege,
     scrollbare ruimte onderaan was onzichtbaar (zwart-op-zwart) maar wél
     nog scrollbaar. marginBottom -40 heft 'm op (netto 8px gat blijft
     over, zelfde als de oorspronkelijke bedoeling). */
  productHero: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: -40,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#000000',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroTopGroup: {
    width: '100%',
    alignItems: 'flex-start',
  },
  /* Operator, 26 september 2026: exact op de huisstijl-tabel (§2B mobiel +
     §1 kleuren) — geen zelfverzonnen waardes, geen Royal Indigo (bestaat
     niet meer, volledig vervangen door Bio-Teal), geen decoratieve
     leestekens. Eyebrow 11px Bold +1.5, H1 vaste 32px Bold -0.4px
     ("de native app gebruikt een vaste 32px"), subheader/muted 15px
     Regular #8a8a8a — links uitgelijnd, niet de gecentreerde intro-stijl. */
  heroEyebrowTop: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitleTop: {
    color: '#ffffff',
    fontSize: 32,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
  },
  heroSubTop: {
    color: C.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    marginTop: 4,
  },
  /* Stage rond de SonarRender — relative zodat de hotspot-punten absoluut
     kunnen positioneren t.o.v. de render, niet t.o.v. de hele hero. */
  /* Operator ("ik zie geen bracelet"): `alignItems:'center'` liet
     SonarRender's buitenste View (die zelf geen width zet, enkel
     renderWrap's vaste `height:280`) shrinken naar 0 breedte — de
     Image erin is width:'100%' van een ouder zonder breedte = 0px,
     dus onzichtbaar. Vaste width+height op heroStage (geen alignItems-
     override, dus default stretch) laat SonarRender de volle breedte
     innemen; hotspot top/left-percentages resolven nu ook tegen een
     echte 280px-hoogte i.p.v. tegen 0. */
  /* Operator ("alles mooi binnen het scherm laten passen" + nieuwe
     states-pil-rij erbij): 280→250 en de marges hieronder verkleind om
     ruimte te maken zonder dat de hero moet scrollen. */
  heroStage: {
    width: '100%',
    flex: 1,
    minHeight: 140,
    marginTop: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  /* Operator ("1 nieuwe pill met 5 states"): 1 pill met de 5 kleur-
     stippen + label, i.p.v. 5 losse pillen. */
  /* Operator ("transparante blur pills"): echte BlurView (zie JSX) i.p.v.
     effen '#1e1e1e' — overflow:hidden zodat de blur zelf ook de
     borderRadius respecteert, dunne witte rand voor definitie op glas. */
  statesSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  statesSummaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statesSummaryText: {
    color: '#f4f4f4',
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
    marginLeft: 2,
  },
  /* Huisstijl v5.1/5.2 (monochroom, "Apple zou dat nooit in kleur doen"):
     geselecteerde pill = lichte vulling + donkere tekst, niet-geselecteerd
     = donker paneel + rand, geen accentkleur. Zelfde regel als de echte
     webpagina-sectie "A closer look". */
  /* Operator ("nog altijd heel hoog"): height op de ScrollView's eigen
     `style` bleek niet te helpen — nu een harde `height:44` +
     `overflow:'hidden'` op een gewone `View` die de ScrollView omvat
     (zie JSX). Kan niet meer uitrekken: een plain View met expliciete
     hoogte + overflow:hidden is geen ScrollView-edge-case. */
  closerPillsRow: {
    width: '100%',
    height: 44,
    marginTop: 28,
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  /* Operator (Apple-HIG-feedback: "knoppenwolk vervangen door een
     Segmented Control ... één strakke, doorlopende horizontale
     menustrip"): losse chips (elk eigen bg+rand) → één doorlopende balk
     (bg+radius zit nu op de content-container zelf), segmenten hebben
     geen eigen rand meer — enkel het actieve segment krijgt een lichte
     vulling. Blijft horizontaal scrollbaar (5 items, sommige labels te
     lang voor een niet-scrollende flex:1-verdeling zonder afknippen). */
  closerPillsRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  closerPill: {
    flexShrink: 0,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  closerPillOn: {
    backgroundColor: '#f4f4f4',
  },
  closerPillText: {
    color: '#f4f4f4',
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  closerPillTextOn: {
    color: '#1D1D1F',
  },
  /* Punten op de render — wijzen aan WAAR een onderdeel zit. */
  /* Operator ("dots zijn slordig en te groot"): 22px met dikke rand las
     als een blob bovenop de kralen — nu 14px, dunne rand, zelfde subtiele
     gewicht als de `.hs`-punten op de echte webpagina (12px). Hit-area
     blijft groot via `hitSlop` op de Pressable, niet via de visuele maat. */
  /* Operator ("kleine dot"): 14px → 10px, nu enkel zichtbaar op het
     actieve onderwerp (zie JSX), dus geen eigen inactieve variant meer
     nodig — altijd de "on"-kleur (wit). */
  closerHotspot: {
    position: 'absolute',
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  closerHotspotOn: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  /* Expanding ring op de actieve hotspot — zelfde "ademende puls, 2.4s
     cyclus" als een status-stip (huisstijl §5), niet de Signal-Blue
     haptic-puls (die blijft uitsluitend voor de player/BLE-status). */
  closerHotspotPulse: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    marginTop: -11,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  /* Operator ("blijf van de bracelet af, cta staat onder de tabbladen"):
     terug naar de originele waarde — het echte probleem was de
     TAB_BAR_HEIGHT-berekening (zie heroFullHeight hierboven), niet deze
     marge. Die nu apart oplossen i.p.v. hier te blijven compenseren. */
  heroBottomGroup: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  /* Huisstijl §3: CTA altijd wit + donkere tekst (#1D1D1F), radius 14px,
     knoptekst 17px SemiBold. */
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  /* Operator ("tekst staat niet goed na verwijderen pijl"): Android voegt
     op custom fonts extra verticale font-padding toe die de tekst binnen
     een gecentreerde flex-box laag/hoog laat ogen — includeFontPadding
     false + expliciete lineHeight (zelfde fix als player.tsx/
     PlayPauseGlyph.tsx elders in de app) lost dat op. */
  heroCtaText: {
    color: '#1D1D1F',
    fontSize: 17,
    lineHeight: 20,
    fontFamily: BrandFonts.semibold,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  /* Huisstijl §3: tekstlink, wit, 15px Medium — voor de secundaire actie
     (reserveren) onder de primaire witte CTA. */
  /* Operator, 15 september 2026: bracelet-intro (`braceletIntro`) —
     zelfde stijlen als de Audio Library-intro in (tabs)/index.tsx. */
  introOverlay: { zIndex: 50, elevation: 50, backgroundColor: C.bg, overflow: 'hidden' },
  introTextWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 26,
    paddingBottom: 34,
  },
  introEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 8,
  },
  introTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
    lineHeight: 36,
    textAlign: 'center',
  },
  /* Operator, 24 september 2026 ("ctas moeten langer, Apple gebruikt een
     vaste zijmarge voor een primaire hero-cta"): `marginHorizontal` op de
     buitenste wrapper i.p.v. `paddingHorizontal` op de binnenste — de
     knop rekt nu uit tot een vaste zijmarge i.p.v. rond de tekst te
     plooien (default `alignItems:'stretch'` laat `introCta` vanzelf de
     volle breedte van `introCtaWrap` vullen). Zelfde wijziging in
     breath.tsx/(tabs)/index.tsx. */
  introCtaWrap: { borderRadius: 16, overflow: 'hidden', marginHorizontal: 26 },
  introCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D2D2D7',
  },
  introCtaTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    letterSpacing: 0.1,
    color: '#1D1D1F',
  },
  introCtaShimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 46,
  },

  /* ── Personalisatie-banners (top van pagina, conditional) ──
     Apple-style: fill-only (geen borders), grotere radius, ruimere
     padding. Pro-banner subtiel, owner-banner prominenter. */
  /* Iter v180 (2026-07-02): pro-banner opgeschoond — gecentreerde tekst,
     ruimere padding, subtiele border voor definitie. Operator-feedback:
     "Reserved for VIBEZCORE members" mag mooier + gecentreerd. */
  /* Huisstijl v4.4: decoratieve banner-tint, niet haptic/status — Royal Indigo. */
  proBanner: {
    backgroundColor: 'rgba(30,42,74,0.10)',
    borderColor: 'rgba(30,42,74,0.28)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Operator ("accentkleur is niet meer blauw"): was C.accent. */
  proBannerText: {
    color: C.textDim,
    fontSize: 13.5,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  /* Owner-eyebrow (iter 9t) — vervangt hero voor owners. Klein,
     "you are here"-style, geen marketing-vibe. */
  /* Operator, 14 september 2026: was wit-gebaseerd (0.45 alpha) —
     onzichtbaar op licht. */
  ownerEyebrow: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    marginTop: 18,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  ownerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(74,222,128,0.14)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  ownerBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  ownerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.success,
  },
  ownerTitle: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
  },
  ownerSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  ownerArrow: {
    color: C.success,
    fontSize: 24,
    fontFamily: BrandFonts.medium,
  },
  signInLink: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  signInLinkText: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
  },
  signInLinkAccent: {
    color: C.accent,
    fontFamily: BrandFonts.semibold,
  },
  /* Iter v190 (2026-07-02): Learn-more upgraded van inline text-link naar
     volwaardige card (parallel aan Activate card boven). Border-tint iets
     lichter dan Activate zodat hiërarchie duidelijk blijft (Activate =
     primair, Learn more = secundair). */
  learnMoreCard: {
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: 'rgba(10,10,12,0.04)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(10,10,12,0.14)',
  },
  learnMoreCardInner: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  learnMoreCardTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  learnMoreCardEyebrow: {
    color: C.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  learnMoreCardLabel: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.15,
    marginBottom: 4,
    lineHeight: 20,
  },
  learnMoreCardSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    lineHeight: 17,
  },
  learnMoreCardArrow: {
    color: 'rgba(10,10,12,0.60)',
    fontSize: 22,
    fontFamily: BrandFonts.regular,
  },

  /* Free Breathwork discovery card — v4 (2026-06-05): full-bleed hero
     met foto die hele card vult. Alle content overlaid onderaan met
     sterke gradient. Identiek aan Audio tab.
     v4.3 (2026-06-05): meer shift naar rechts (32L/8R) en lichtere
     gradient — operator-feedback. */
  breathDiscoverCard: {
    marginLeft: 32,
    marginRight: 8,
    marginTop: 28,
    marginBottom: 12,
    aspectRatio: 4 / 5,
    backgroundColor: '#000',
    borderColor: 'rgba(10,10,12,0.10)',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  breathDiscoverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  /* v4.3 (2026-06-05): lichter gradient (60% hoogte). */
  breathDiscoverHeroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  /* v4.1 (2026-06-05): paddingBottom 24 → 42 voor ademruimte onderaan. */
  breathDiscoverHeroText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 42,
  },
  /* v4 2026-06-05: sterkere shadow + pure wit voor leesbaarheid op
     willekeurige image content (ook lichte gebieden). */
  breathDiscoverLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  breathDiscoverStates: {
    color: '#ffffff',
    fontSize: 22,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  breathDiscoverMeta: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    marginBottom: 18,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  /* Operator, 14 september 2026: radius 100 (volle pil) → 12, conform
     de vastgelegde knop-chrome (zelfde fix als deze kaart al kreeg op
     Audio Library). */
  breathDiscoverCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: C.accent,
    borderRadius: 12,
    gap: 8,
  },
  breathDiscoverCtaText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.5,
  },
  breathDiscoverCtaArrow: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    lineHeight: 16,
  },

  /* ── 1. Hero (Apple-style: tightere headline-letterspacing, ruimere
        sub, eyebrow in semibold ipv bold caps) ── */
  /* ── Audio PRO landing-page (iter 9cr 2026-05-31) ──────────────────
     Subtiele teaser-pagina voor Audio PRO users op /bracelet tab.
     Geen marketing-overload — gewoon: hier is het product, dit zijn
     de hoogtepunten, klik door als je verder wilt. */
  landingScroll: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 40,
  },
  landingEyebrow: {
    color: C.accent,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.0,
    marginBottom: 14,
  },
  /* Iter 9ct (2026-05-31): Kickstarter row als eyebrow. Tighter
     marginBottom (10) want het zit nu direct boven de titel. */
  /* Iter 9dh (2026-05-31): eyebrow-row + titel gecentreerd op de
     Audio PRO landing — voelt premium en in balans met de bracelet-
     render eronder (die ook gecentreerd is). */
  landingKsEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  landingSub: {
    color: C.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    lineHeight: 22,
    marginBottom: 18,
  },
  /* Iter 9cs (2026-05-31): 2×2 bullet-grid voor compactere landing.
     Elke bullet neemt 48% breedte, gap 12 zorgt voor uniforme spacing.
     Bullets stack twee per rij dankzij flexWrap. */
  landingBulletGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 22,
    marginBottom: 18,
  },
  landingBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexBasis: '46%',
    flexGrow: 1,
  },
  /* Operator ("accentkleur is niet meer blauw"): was C.accent — een
     decoratief lijst-bulletje is geen haptic-pulse, dus geen Signal Blue. */
  landingBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.textDim,
  },
  landingBulletText: {
    color: C.text,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    lineHeight: 18,
    flex: 1,
  },
  /* Iter 9cs: transparante variant van renderShell/Wrap voor de landing
     waar de bracelet "zweeft" op de dark UI. Verwijdert witte bg +
     shadow zodat alleen het render-PNG zichtbaar is. */
  renderShellTransparent: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  renderWrapTransparent: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  landingKsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  landingKsDate: {
    color: C.accent,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
  },
  landingKsBadge: {
    backgroundColor: 'rgba(255,159,10,0.14)',
    borderColor: 'rgba(255,159,10,0.45)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  landingKsBadgeText: {
    color: '#FF9F0A',
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.4,
  },
  landingCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  /* Operator ("accentkleur is niet meer blauw"): landingCtaTight is nu
     wit — tekst mee van wit naar donker (#1D1D1F), anders wit-op-wit. */
  landingCtaText: {
    color: '#1D1D1F',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  landingCtaArrow: {
    color: '#1D1D1F',
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    lineHeight: 20,
  },
  /* Iter 9dg (2026-05-31): tightere CTA-variant — kleinere marginTop
     zodat 'ie hoger op het scherm landt, dichter tegen de bracelet.
     Operator ("accentkleur is niet meer blauw"): backgroundColor was
     C.accent — een CTA-vulling is nooit de accentkleur (huisstijl §3,
     altijd wit + donkere tekst). landingCtaText/Arrow hieronder mee
     aangepast van wit naar donker. */
  landingCtaTight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 0,
  },
  /* Subtiele "back to Audio Library" link onder de CTA — secundaire
     navigatie voor de PRO-user die snel terug wil. */
  landingBackLink: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  landingBackLinkText: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },

  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    /* Gecentreerd, niet meer links (operator, 10 augustus 2026): de titel
       eronder is nu ook gecentreerd (GradientText), en een linkse rij
       boven een gecentreerde kop stond scheef. */
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  heroEarlyBird: {
    backgroundColor: 'rgba(255,159,10,0.14)',
    borderColor: 'rgba(255,159,10,0.45)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  heroEarlyBirdText: {
    color: '#FF9F0A',
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.4,
  },
  heroMicroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    /* Huisstijl v4.4: decoratieve pill-CTA, niet haptic/status — Royal Indigo. */
    backgroundColor: 'rgba(30,42,74,0.12)',
    borderColor: 'rgba(30,42,74,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 16,
  },
  heroMicroCtaText: {
    color: C.text,
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  heroMicroCtaArrow: {
    color: C.accent,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    lineHeight: 16,
  },
  /* Operator, 11 september 2026: was 11px/letterSpacing 1.2, los van
     dezelfde eyebrow-rol op index.tsx (10.5px/1.4) — nu identiek. */
  heroEyebrow: {
    color: C.accent,
    ...TypeScale.cardEyebrow,
    marginBottom: 14,
    textTransform: 'uppercase',
  },

  /* ── 2. Render + sonar ──
     Operator-feedback 2026-05-26 (iter 2): donkere card-bg weghalen.
     De witte achtergrond van de bracelet-PNG vormt nu zélf de card —
     full-bleed binnen de afgeronde wrapper. Sonar-ringen kleuren mee
     met de witte achtergrond (subtiel accent, op wit nog steeds
     zichtbaar). */
  /* Iter 9cp → 9cq (2026-05-31): card en "How it works" mogen juist
     SAMENHANGEN — operator-correctie. Tightere marginBottom (8 → 4) +
     verkleinde sectionTitle marginTop hieronder, zodat de hero-foto
     visueel doorvloeit naar de uitleg-sectie. */
  renderShell: {
    /* Iter 9cz (2026-05-31): marges 0 → bracelet plakt tegen titel
       boven en How it works onder. */
    marginTop: 0,
    marginBottom: 0,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 14,
  },
  /* Iter 9cy → 9db (2026-05-31): height 360 → 280 → minder lege ruimte
     boven/onder de bracelet binnen de wrapper. Bracelet zit visueel
     hoger en "How it works" komt dichter bij. */
  renderWrap: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(10,10,12,0.08)',
    overflow: 'hidden',
  },
  sonarRing: {
    position: 'absolute',
    /* Base 30px → max ~105px na scale 3.5 — matched HTML-referentie
       (8% van container) en blijft binnen wrapper-frame. Border 1.5
       zoals HTML.
       Iter 9da → 9dc (2026-05-31): marginTop 17 → 5 terug. De 3mm-drop
       was getuned voor wrap-height 360 en raakt nu (280) niet meer
       precies de HapticCore-positie op het kleinere render → het
       center-dot verdween achter de zwarte module. Origineel 5 is in
       lijn met de bracelet's HapticCore positie in de nieuwe layout. */
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: C.accent,
    top: '50%',
    left: '50%',
    /* center y = 50% + 5 + 15 = 50% + 20 */
    marginTop: 5,
    marginLeft: -15,
  },
  /* HapticCore-dot — kleine gevulde cirkel + soft glow midden in de
     pulserende rings. 4px base, scale-animated naar 1.8× op piek
     (= 7.2px visueel), met double-beat opacity-pulse. Glow blijft
     op 6px shadowRadius zodat 'ie ook bij baseline-opacity 0.3 nog
     leesbaar is.

     Centrering: marginLeft -2 (= -halfWidth) doet de X-centrering;
     transform bevat ALLEEN scale (geen translate, anders dubbele
     offset). marginTop 18 + halfHeight 2 = 50% + 20, matched ring. */
  coreDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.accent,
    top: '50%',
    left: '50%',
    /* Iter 9da → 9dc: marginTop 30 → 18 terug, samen met de sonar-ring
       (zelfde reden: 3mm-drop hoorde bij wrap 360, met wrap 280 valt
       'ie buiten de HapticCore positie). */
    marginTop: 18,
    marginLeft: -2,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
  },
  /* Iter 9cz (2026-05-31): scale 1.3 → bracelet vult de wrapper veel
     meer, minder lege ruimte rondom. Overflow op renderWrap clipt
     eventuele uiteinden netjes binnen de afgeronde hoeken. */
  renderImg: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.3 }],
  },

  /* ── Section headers (unified, Apple-style) ──
     Vervangt het oude secLabel + secTitle + secSub patroon. Nu alleen
     één grote titel + optionele subtitle. Geen ALL CAPS eyebrows meer
     — die voelden ouderwets. */
  /* Operator, 14 september 2026: "checke tekst headers/subheaders, want
     kloppen zaken niet" — `GradientText`'s standaardverloop is wit →
     lichtblauw, gebouwd voor een donkere achtergrond ("Alleen zinvol op
     een donkere achtergrond", zie GradientText.tsx). Op deze nu lichte
     pagina was dat vrijwel onzichtbaar wit-op-wit. Vervangen door gewone
     tekst in de H2-rol (22px Bold, -0.3, sentence case) — zelfde token
     als de rest van de app, en gegarandeerd leesbaar ongeacht thema. De
     edelsteen-sectie (regel ~1751/1759) is bewust NIET meegenomen: die
     blijft in zijn geheel dark, inclusief zijn eigen kop. */
  sectionHead: {
    color: C.text,
    fontSize: 22,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  /* Operator, 14 september 2026: "Smart Bead Bracelet mag als hero
     header" — H1-rol (32px Bold, -0.4), voor de paginatitel zelf,
     zwaarder dan de gewone H2 sectiekoppen (`sectionHead`, 22px). */
  heroHead: {
    color: C.text,
    fontSize: 32,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  sectionSub: {
    color: C.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 23,
    marginBottom: 20,
    paddingHorizontal: 4,
  },

  /* ── Universal content-card (story-card + future use) ──
     Eén card-style voor body-content na een pill/tab-selectie. */
  uCard: {
    backgroundColor: 'rgba(10,10,12,0.05)',
    borderRadius: 20,
    padding: 22,
  },
  uCardEyebrow: {
    color: C.accent,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  /* Operator, 17 september 2026 ("in 1 kaart, alles duidelijk gegroepeerd
     incl de headers"): gedeelde module-kaart voor secties die kop +
     carousel + CTA/tabs samen omvatten (modi, collectie) — zelfde
     kaart-taal als learnMoreCard (rgba(10,10,12,0.04) bg, subtiele rand),
     nu op de "grote kaart"-radius (20) uit de radius-opschoning.
     paddingHorizontal is BEWUST exact SIDE_INSET: carouselWrap's eigen
     marginHorizontal:-SIDE_INSET-truc cancelt dan precies deze padding
     (i.p.v. de pagina-padding), waardoor de carousel binnen de kaart
     volledig breed kan bleeden zonder verdere aanpassingen. */
  moduleCard: {
    backgroundColor: 'rgba(10,10,12,0.04)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(10,10,12,0.14)',
    paddingHorizontal: SIDE_INSET,
    paddingTop: 20,
    paddingBottom: 4,
    marginBottom: 24,
  },
  /* ── Carousel (Collection) ──
     Apple iPhone-page-style swipe-carousel. carouselWrap brikt uit de
     page-padding (marginHorizontal -16) zodat de ScrollView de hele
     scherm-breedte krijgt. Cards binnenin hebben hun eigen width
     (CARD_WIDTH constant) zodat snapToInterval per card werkt. Dot-
     row eronder als positie-indicator + tappable jump-target.

     Apple Photos / iPhone-pages doen dit zo: peek van de volgende
     card (~26px zichtbaar) is signal voor "er is meer". Was voorheen
     voor de Modes-sectie (nu 5 vaste rijen, zie modeList) — hergebruikt
     voor de Collection, die andersom van grid naar carousel ging. */
  carouselWrap: {
    marginHorizontal: -SIDE_INSET,
    marginBottom: 18,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(10,10,12,0.20)',
  },
  dotOn: {
    backgroundColor: C.text,
    width: 22,  /* active dot iets breder = Apple-style indicator */
  },

  /* Vast "i"-knopje rechtsboven — sibling van de ScrollView, dus blijft
     staan tijdens scrollen. Subtiel glas-effect, geen zware fill, past
     op zowel de fotoheader (owner) als de lichte pagina (non-owner). */
  infoBtn: {
    position: 'absolute',
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(10,10,12,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 20,
  },
  infoBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    fontStyle: 'italic',
  },

  /* ── Story pills (How it works, HTML-mockup style) ──
     Capsule-pills met witte fill als actief (hoog contrast, voelt
     "click-y"), subtiele grijs als inactief. Flex-wrap zodat alle 7
     pills passen op 2-3 rijen ipv horizontale scroll. */
  /* Operator, 15 september 2026 ("te veel tekst, hoe zou Apple dat
     aanpakken?"): tab-bar + dots + single-story-card vervangen door een
     korte, in-één-oogopslag scanbare verticale lijst — alle 7 punten
     tegelijk zichtbaar, geen tik-doorheen-tabs meer nodig. */
  storyList: {
    gap: 4,
  },
  storyRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  storyRowLast: {
    borderBottomWidth: 0,
  },
  /* Operator ("accentkleur blauw bestaat niet meer in ons protocool"):
     was C.accent (Signal Blue, #3a8fff) — die kleur is uitsluitend voor
     de haptic-pulse, nooit tekst/labels. Monochroom grijs label i.p.v. */
  storyRowNum: {
    ...TypeScale.cardEyebrow,
    color: C.textDim,
    width: 22,
    paddingTop: 2,
  },
  storyRowTitle: {
    ...TypeScale.compactCardTitle,
    color: C.text,
  },
  storyRowBody: {
    ...TypeScale.cardDetail,
    color: C.textDim,
    marginTop: 3,
    lineHeight: 19,
  },

  /* ── Modi — swipe-carousel (terug van de verticale-rijen-tussenstap) ──
     Operator, 15 september 2026: "mensen skippen lange paragrafen, zet
     ze weer op een swipe-balk" — elke kaart draagt alleen de kleur-dot,
     de naam, en één korte zin (MODE_SHORT). Gebruikt dezelfde
     carouselWrap/dotRow/dot/dotOn als de Collection-carousel. */
  modeSwipeCard: {
    backgroundColor: C.panel,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  /* Operator, 26 september 2026: bento-grid ipv horizontale swipe-
     carousel — eerste tile (Boost) full-width "big", de overige 4 in
     2-koloms rijen. Zelfde tile-taal als goal.tsx's Set Your State. */
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeTile: {
    width: '48%',
    backgroundColor: C.panel,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  modeTileBig: {
    width: '100%',
  },
  modeTileDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: 12,
  },
  modeTileTitle: {
    ...TypeScale.compactCardTitle,
    fontSize: 18,
    color: C.text,
    marginBottom: 4,
  },
  modeTileBody: {
    ...TypeScale.cardDetail,
    color: C.textDim,
    lineHeight: 19,
  },
  modeSwipeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: 12,
  },
  /* Dunne zwarte outline, alleen voor Clarity's witte stip — anders
     onzichtbaar tegen de witte kaart-achtergrond. */
  modeSwipeDotOutline: {
    borderWidth: 1,
    borderColor: '#000000',
  },
  /* State-infopopup: grotere kleur-stip bovenaan de sheet (Clarity's wit
     krijgt via modeSwipeDotOutline dezelfde zwarte outline-uitzondering
     als elders). */
  /* State-infopopup: 1 sheet met een rij per modus (kleur-stip + naam +
     blurb + duur), zelfde storyRow-opbouw als de "How it works"-sheet. */
  stateInfoList: {
    gap: 4,
    marginTop: 16,
  },
  stateInfoRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  stateInfoDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 4,
  },
  stateInfoDuration: {
    ...TypeScale.cardEyebrow,
    color: C.textDim,
    marginTop: 4,
  },
  modeSwipeTitle: {
    ...TypeScale.compactCardTitle,
    fontSize: 20,
    color: C.text,
    marginBottom: 6,
  },
  modeSwipeBody: {
    ...TypeScale.cardDetail,
    color: C.textDim,
    lineHeight: 20,
  },

  /* ── Tab-row (collection series, Pure/Premium/Imperial) ──
     Zelfde underline-pattern als pills, maar binnen rij ipv scroll.
     Selected tab krijgt z'n series-kleur als onderlijning. */
  tabRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },

  /* ── Preview-knop ───────────────────────────────────────────────
     CTA naar /bracelet-control vanaf de etalage. Zichtbaar voor
     iedereen — voor visitors een demo, voor owners de echte bediening.
     Subtiele outline-stijl (geen dominante CTA — de waitlist-knoppen
     blijven primary), zelfde radius/typografie als de pricing-cards. */
  /* Iter 9ci (2026-05-31): nieuwe prominent preview-CTA. Behoud van
     oude previewBtn styles ongebruikt (verwijderbaar later) — niet
     gerefereerd in JSX. */
  previewCta: {
    marginTop: 20,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    /* Huisstijl v4.4: decoratieve CTA-tint, niet haptic/status — Royal Indigo. */
    backgroundColor: 'rgba(30,42,74,0.14)',
    borderColor: 'rgba(30,42,74,0.40)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  previewCtaContent: {
    flex: 1,
  },
  previewCtaEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.0,
    marginBottom: 6,
  },
  previewCtaTitle: {
    color: C.text,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  previewCtaArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCtaArrowText: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: BrandFonts.bold,
    lineHeight: 22,
  },
  /* Legacy previewBtn (iter 9o) — niet meer in JSX gebruikt, behouden
     voor referentie/rollback. */
  previewBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(10,10,12,0.04)',
    borderColor: 'rgba(10,10,12,0.15)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  previewBtnText: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  previewBtnArrow: {
    color: C.accent,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },

  /* ── Tags (unified across page, glass-chip style anno 2026) ──
     Operator-feedback 2026-05-26: vorige fill-only chips voelden nog
     ouder. Nu: subtiele witte fill + hairline border + witte tekst →
     "glass-chip" look (iOS 18 / Vision OS / Linear). Voorkomt blue-
     on-blue verzadiging in mode-cards en geeft het systeem één
     consistent tag-taal door de hele pagina. */
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: 'rgba(10,10,12,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(10,10,12,0.10)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  tagText: {
    color: C.text,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },

  /* ── 5. Specs (hero + 2x2 grid) ──
     Operator-feedback 2026-05-26 iter 2: typografische lijst was te
     saai. Nu: hero-card met 5 mode-kleur-dots (visuele callback
     naar Modes-sectie) + 2x2 grid van overige specs. */

  /* Hero spec — featured met blauwe tint, 5 colored dots als visueel
     anker. Maakt connectie met de Modes-sectie eerder (zelfde kleuren). */
  /* Huisstijl v4.4: decoratieve kaart-tint, niet haptic/status — Royal Indigo. */
  specHero: {
    backgroundColor: 'rgba(30,42,74,0.08)',
    borderRadius: 20,
    padding: 26,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(30,42,74,0.20)',
  },
  specHeroDots: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  specHeroDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  specHeroVal: {
    color: C.text,
    fontSize: 28,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.7,
    marginBottom: 8,
  },
  specHeroLbl: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
  },

  /* Grid 2x2 voor de overige 4 specs (wrist, bead, bt, usb). Werkt
     via explicit row-pairing: specsGrid is verticaal (rows stacken),
     specRow horizontaal (2 cards per row, flex:1 elk → exact 50/50). */
  /* ── 6. Collection ──
     Series-tabs als Apple-style segmented control: outer container met
     subtiele fill, selected pill krijgt een eigen fill (geen borders).
     Net iOS' UISegmentedControl. */
  serTabsWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10,10,12,0.06)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  serTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  serTabText: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  /* Edition-cards: tonale bg, geen border, grotere radius, subtle
     accent-glow op selected ipv harde border. */
  /* Operator, 26 september 2026: vaste 2-koloms grid ipv horizontale
     swipe-carousel — edities liggen nu naast elkaar zoals elke andere
     lijst-sectie in de app. */
  collGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  collCard: {
    width: '48%',
    /* Operator, 15 september 2026 ("laat de armbanden zweven op de witte
       achtergrond, geen harde zwarte vlakken"): de dark-panel fill die
       hier stond (bewuste keuze van 26 mei) is vervangen door dezelfde
       lichte kaart-behandeling als de rest van de pagina — de foto blijft
       het enige "zware" element, de kaart zelf voelt luchtig, juweliers-
       stijl. Zachte schaduw i.p.v. witte rand geeft 'm nog net genoeg
       scheiding van de eveneens lichte pagina-achtergrond. */
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  collCardClip: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: C.panel,
  },
  /* Selected-state op grid-card: subtiel, geen ugly blue tint meer.
     Sinds 2026-05-26 verschijnt de detail-popup als overlay; de
     onderliggende card is dus toch niet zichtbaar tijdens selectie.
     We laten alleen een fijne accent-rand achter zodat user — nadat
     popup gesloten is — herkent welke 'ie tapped had. */
  /* Huisstijl v4.4: geselecteerde-staat border, niet haptic/status — Royal Indigo. */
  collCardOn: {
    borderWidth: 1,
    borderColor: 'rgba(30,42,74,0.6)',
  },

  /* ── Edition-detail overlay (floating popup) ──
     Absolute-positioned over de hele Bracelet-tab. Backdrop dim de
     achtergrond, popup-wrap centreert het detail-panel. Zelfde
     pattern als WelcomeBackPopup / BraceletUpsellModal (zie comments
     daar). zIndex/elevation 1000 om boven alles te liggen. */
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  detailBackdrop: {
    /* Iter 9az (2026-05-31): backdrop volledig opaque (was 70% zwart).
       Operator wil dat de pagina achter de popup volledig verdwijnt —
       voelt meer als een echte fullscreen-modal en niet als een
       overlay. C.bg matched de rest van de app. */
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BrandDark.bg,
  },
  detailWrap: {
    /* Iter 9at (2026-05-31): width 88→92%, maxHeight 85→95% zodat de
       hele detail-card past op standaard phone-schermen zonder dat
       user binnen de popup hoeft te scrollen. Operator-feedback. */
    width: '92%',
    maxWidth: 440,
    maxHeight: '95%',
  },
  collImgWrap: {
    /* Image full-bleed in de top van de card. Geen eigen borderRadius
       — card's overflow:hidden + radius:20 clipt de bovenkant
       automatisch in de juiste shape. Onderkant blijft square zodat
       'ie naadloos aan het tekst-blok eronder vastsluit. */
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#ffffff',
  },
  collImg: { width: '100%', height: '100%' },
  collInfo: {
    /* Tekst-area binnen de card, ruime padding aan alle kanten. */
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  /* Operator, 15 september 2026: naam in dun zwart lettertype, steensoort
     zachtgrijs eronder — "juweliers"-uitstraling i.p.v. de eerdere witte
     tekst op donker paneel. */
  collName: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  collNat: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginBottom: 10,
  },
  /* Badge: capsule-style, kleinere fontSize, geen heavy letter-spacing. */
  collBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  collBadgeText: {
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  /* Detail-panel: tonale bg ipv panel + accent-border, grotere radius,
     soft accent-glow voor depth ipv harde border. */
  detail: {
    /* Sinds 2026-05-26 (overlay-refactor) is dit een floating card —
       moet OPAQUE zijn anders zie je de pagina + backdrop erdoorheen.
       C.panel #1e1e1e is de standaard card-kleur op dark mode.
       Iter 9ay (2026-05-31): shadow van C.accent (blauw) → #000.
       De blauwe glow rondom voelde gimmicky. Nu een neutrale subtiele
       drop-shadow met lichte downward offset = standaard modal-depth
       zonder kleur-afleiding. */
    backgroundColor: BrandDark.panel,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  detailImgWrap: {
    width: '100%',
    aspectRatio: 1.6,
    backgroundColor: '#0d0d0d',
    /* Iter 8c: overflow hidden zodat transform:scale(1.5) op de Image
       binnen het container-frame blijft (clip aan de randen ipv layout
       breken). */
    overflow: 'hidden',
  },
  detailImg: { width: '100%', height: '100%' },
  /* Iter 8b: zoom-hint chip in rechteronderhoek van detail-image.
     Visible alleen wanneer !zoomed; verdwijnt zodra user heeft
     ingezoomd. Subtle, semi-transparant. */
  zoomHint: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  zoomHintText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.5,
  },
  detailBody: { padding: 22 },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): 26px was
     al toevallig gelijk aan `TypeScale.tabHeader`, enkel gewicht
     (extrabold i.p.v. bold) en letterSpacing (-0.6 i.p.v. -0.3) weken af. */
  detailName: {
    color: BrandDark.text,
    ...TypeScale.tabHeader,
    marginTop: 12,
  },
  detailNat: {
    color: BrandDark.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    marginTop: 4,
    marginBottom: 16,
  },
  detailOrigin: {
    color: '#f97316',
    fontFamily: BrandFonts.semibold,
  },
  detailDescWrap: { marginBottom: 14 },
  detailDescHead: {
    color: BrandDark.text,
    fontSize: 16,
    fontFamily: BrandFonts.semibold,
    fontStyle: 'italic',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  detailDescBody: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    marginTop: 6,
  },
  detailNote: {
    color: BrandDark.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  detailSpecs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  detailSpec: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 12,
  },
  detailSpecLbl: {
    color: BrandDark.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  detailSpecVal: {
    color: BrandDark.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
  },
  detailClose: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailCloseText: {
    color: BrandDark.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  /* Iter 9ax (2026-05-31): floating × rechtsboven. Bespaart ~60px tov
     bottom-button + voelt modern (iOS/Material standaard pattern).
     Tegen de witte image-zone: zwarte semi-transparent fill voor
     contrast + lichte border. */
  detailCloseX: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  detailCloseXText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    lineHeight: 18,
  },

  /* ── 7. Kickstarter Early Bird (anno 2026, world-class hierarchy) ──
        Eén outer card houdt alles bij elkaar; binnen die card 3
        duidelijk gegroepeerde secties: Featured Bundle (genest met
        eigen tint), OR-divider, Bracelet Only (text section), hairline,
        Extra add-on (compact horizontal), footer disclaimer. */

  /* Outer container — subtiel panel-bg + border, generous padding. */
  ksCard: {
    backgroundColor: C.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(10,10,12,0.08)',
    padding: 20,
    paddingTop: 24,
  },

  /* Featured Bundle — nested card binnen ksCard, blue tint + accent
     border om visueel meest prominent te zijn. */
  /* Huisstijl v4.4: decoratieve "featured" kaart-tint, niet haptic/status — Royal Indigo. */
  ksFeatured: {
    backgroundColor: 'rgba(30,42,74,0.10)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(30,42,74,0.40)',
    padding: 20,
    paddingTop: 24,
  },
  /* Iter 9: ksFeatBadge solid-pill weggehaald, vervangen door text-only
     eyebrow met dashes ("— BEST VALUE —"). Past bij Apple Wallet / Tips-
     pattern (caption labels zonder bg-fill). */
  ksFeatBadgeOld: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: C.accent,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  ksFeatBadgeText: {
    color: C.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  /* "OR"-divider tussen featured en alternative options. Twee hairline
     segmenten met "OR" tekst centraal — duidelijke visuele scheiding. */
  /* "OR" divider styles weggehaald 2026-05-26 iter 2: Bracelet Only en
     Add-on krijgen nu eigen nested card-styling, geen text-section met
     OR-scheiding meer. */

  /* Standalone option (Bracelet Only) — als text-section binnen ksCard,
     geen eigen background. Onderscheidt zich subtieler dan featured. */
  /* BRACELET ONLY — eigen nested card binnen de outer Kickstarter
     container. Tonale white-tint (subtiel) onderscheidt 'm van de blue
     featured card EN van de outer card-bg. Zelfde radius/padding-
     conventie als ksFeatured zodat ze visueel bij elkaar horen. */
  ksOption: {
    backgroundColor: 'rgba(10,10,12,0.05)',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(10,10,12,0.10)',
    marginTop: 14,
  },

  /* EXTRA BRACELET — compact add-on, eigen nested card met horizontale
     layout (tekst links, prijs rechts). Net iets compactere padding
     dan de full options zodat 'ie visueel "tussendoor"-gewicht heeft. */
  ksAddon: {
    backgroundColor: 'rgba(10,10,12,0.05)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(10,10,12,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 14,
  },
  ksAddonName: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  ksAddonSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
  },
  ksAddonPrice: {
    alignItems: 'flex-end',
    gap: 4,
  },
  ksAddonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  /* Shared eyebrow + name styles voor de option-secties. */
  ksEyebrow: {
    color: C.accent,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  ksName: {
    color: C.text,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
    marginBottom: 14,
  },

  /* Price row (shared across all 3 options). */
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    flexWrap: 'wrap',
  },
  priceMain: {
    color: C.text,
    fontSize: 34,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.9,
    lineHeight: 38,
  },
  priceMainSmall: {
    color: C.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  priceOld: {
    color: 'rgba(10,10,12,0.35)',
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    textDecorationLine: 'line-through',
  },
  /* Iter v218 (2026-07-04): EUR-conversie hint onder USD-hoofdprijs.
     Subtiel, gedimd, klein — communiceert "voor EU-context, niet
     de betaalprijs op KS". */
  /* Duidelijker dan voorheen (operator, 11 augustus 2026: "kunnen we
     duidelijk maken wat die prijs in eu is") — 0.45 opacity/12pt las als
     kleine lettertjes; dit is een echt prijsgetal, geen disclaimer. */
  priceEur: {
    color: 'rgba(10,10,12,0.68)',
    fontSize: 13.5,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.2,
    marginTop: 4,
  },
  /* Iter 9: priceSave-pill weggehaald, vervangen door inline
     "was $X · save $Y" tekst met success-kleur op het save-deel.
     iOS-style inline-pricing-pattern, geen pill meer. */
  priceSaveInline: {
    color: C.success,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.1,
  },

  /* ── Reserve CTA buttons binnen pricing-cards ──
     Primary (Bundle): solid accent-blue fill, witte tekst — hoogste
     contrast, matched de "featured" status.
     Secondary (Bracelet Only): outlined accent — minder schreeuwerig
     dan een tweede primary, behoudt visuele hiërarchie waar Bundle
     dominant blijft. Beide met pijltje rechts voor "this opens
     something elsewhere"-affordance. */
  ksBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 15,
  },
  ksBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  ksBtnPrimaryArrow: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: BrandFonts.bold,
    lineHeight: 17,
  },
  ksBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.accent,
  },
  ksBtnSecondaryText: {
    color: C.accent,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  ksBtnSecondaryArrow: {
    color: C.accent,
    fontSize: 17,
    fontFamily: BrandFonts.bold,
    lineHeight: 17,
  },

  /* Footer binnen de ksCard — disclaimer + datum. */
  ksFooter: {
    marginTop: 22,
    paddingTop: 18,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,12,0.10)',
    alignItems: 'center',
  },
  /* Iter 9ba (2026-05-31): textAlign center voor multi-line breaks.
     alignItems center op de parent centreert het Text-element als blok,
     maar lange regels die wrappen vielen alsnog naar links. textAlign
     center zorgt dat elke gewrapte regel zelf óók centered staat. */
  ksFooterText: {
    color: C.text,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    textAlign: 'center',
    marginBottom: 6,
  },
  ksFooterMeta: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  /* Iter v149 v2 (2026-06-25): bracelet-code activatie entry-point.
     Operator-feedback: was te dim en bijna onzichtbaar. Bracelet wordt
     het main product, deze entry MOET prominent. Upgrade naar:
     - Donker panel met accent-glow border (matched merk-anker)
     - Eyebrow label, grote titel + sub, pijl-icoon rechts
     - Visueel gelijkwaardig aan Reserve-CTA's bovenaan zodat het
       2e gelijkwaardige pad voelt (Reserve vs Activate). */
  /* Huisstijl v4.4: decoratieve glow-kaart, niet haptic/status — Royal Indigo. */
  activateBraceletEntry: {
    marginTop: 22,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(30,42,74,0.55)',
    backgroundColor: 'rgba(30,42,74,0.10)',
    shadowColor: C.accent,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  activateBraceletEntryInner: {
    paddingVertical: 22,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activateBraceletEntryTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  activateBraceletEntryEyebrow: {
    color: C.accent,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): zelfde rol
     als `activateBraceletCardLabel` op account.tsx (was daar 17px, hier
     18px) — nu allebei uit `TypeScale.compactCardTitle`. */
  activateBraceletEntryLabel: {
    color: C.text,
    ...TypeScale.compactCardTitle,
    marginBottom: 4,
    lineHeight: 22,
  },
  activateBraceletEntryTitle: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  activateBraceletEntryArrow: {
    color: C.accent,
    fontSize: 28,
    fontFamily: BrandFonts.regular,
    lineHeight: 28,
  },
  /* Iter v149 v3: 'See how it works' preview-link. Discreter dan
     activate-card omdat het info-only is. */
  previewBraceletEntry: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  previewBraceletEntryText: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
  },
  previewBraceletEntryLink: {
    color: C.accent,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
  },

  /* ── 9. Waitlist (Apple-card + softere CTA met subtle shadow) ── */
  wlCard: {
    marginTop: 20,
    backgroundColor: 'rgba(10,10,12,0.04)',
    borderRadius: 20,
    padding: 24,
  },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): was 24px
     extrabold, los van `detailName` hierboven (26px) — zelfde grote-
     titel-rol, nu uit dezelfde bron. */
  wlTitle: {
    color: C.text,
    ...TypeScale.tabHeader,
    marginBottom: 8,
  },
  wlSub: {
    color: C.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    marginBottom: 18,
  },
  wlChecklist: { gap: 10, marginBottom: 20 },
  wlCheck: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
  },
  wlBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  wlBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
  wlDisc: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    lineHeight: 17,
  },

  /* Free Breathwork chooser modal — Apple-stijl bottom sheet. Volledige
     stijl-set hier (geen pillarModal-hergebruik beschikbaar in dit
     bestand). Donker oppervlak, handle bovenaan, close ✕ rechtsboven,
     5 rows. Identiek visueel aan de Audio tab versie. */
  /* Operator ("draai dat gewoon terug, geen blur of transparant"): terug
     naar <Modal> (regelt zelf de full-screen overlay + Android-terugknop)
     en een effen paneel — de BlurView/plain-View-overlay-poging bleek op
     dit toestel niet naar wens. */
  breathChooserModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  /* Operator, 14 september 2026: was hardcoded '#141414' (gemist door de
     eerdere rgba-sweep, want geen rgba-literal) — de rand/subtekst
     eromheen was al wél naar licht geconverteerd, dus dit blad was
     inmiddels een donkere achtergrond met bijna-onzichtbare donkere
     randen. C.panel maakt het weer consistent. */
  breathChooserSheet: {
    backgroundColor: C.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10,10,12,0.08)',
  },
  breathChooserHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(10,10,12,0.18)',
    marginBottom: 14,
  },
  breathChooserClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(10,10,12,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathChooserCloseText: {
    color: C.text,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    lineHeight: 16,
  },
  /* Operator ("accentkleur is niet meer blauw"): was C.accent (Signal
     Blue) — die kleur is uitsluitend voor de haptic-pulse, nooit tekst.
     Monochroom grijs label i.p.v. (gebruikt door zowel de "5 HAPTIC
     STATES"- als de "HOW IT WORKS"-sheet-eyebrow). */
  breathChooserEyebrow: {
    color: C.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  breathChooserTitle: {
    color: C.text,
    fontSize: 26,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.6,
    lineHeight: 30,
    marginBottom: 6,
  },
  /* Operator ("popup niet alles leesbaar"): rgba(10,10,12,.55) is
     near-zwart — onleesbaar op de donkere breathChooserSheet
     (backgroundColor: C.panel, #1e1e1e). Was blijkbaar altijd al fout,
     nu C.textDim (leesbaar grijs op donker). */
  breathChooserSub: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    marginBottom: 22,
  },
  breathChooserList: {
    flexDirection: 'column',
    gap: 2,
  },
  breathChooserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10,10,12,0.10)',
  },
  breathChooserDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  breathChooserRowText: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    gap: 2,
  },
  breathChooserRowPurpose: {
    color: C.text,
    fontSize: 17,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  breathChooserRowMeta: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0,
    lineHeight: 18,
  },
  breathChooserRowArrow: {
    color: 'rgba(10,10,12,0.45)',
    fontSize: 18,
    fontFamily: BrandFonts.semibold,
    lineHeight: 20,
    flexShrink: 0,
  },
});
