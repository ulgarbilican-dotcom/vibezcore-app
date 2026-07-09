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
     8. Countdown — naar Kickstarter 1 september 2026
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

import { PreviewBanner } from '@/components/PreviewBanner';
import { Brand, BrandFonts } from '@/constants/theme';
import { BREATHWORK_CHOOSER } from '@/data/breathwork-modes';
import { getModeMeta } from '@/services/ble-contract';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '@/hooks/useSubscription';
import { getToken } from '@/services/auth';
import { useBraceletOwner } from '@/utils/dev-user-override';
import BraceletControl from '../bracelet-control';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Image,
  LayoutAnimation,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
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
const CDN = 'https://vibezcore-audio.b-cdn.net/images';
/* Iter 9cv (2026-05-31): operator-aangeleverde transparante render →
   bracelet kan nu écht "zweven" op de dark UI zonder witte achtergrond.
   Werkt zowel voor de hero-card (witte bg via renderWrap) als voor de
   Audio PRO landing met transparent prop. */
const RENDER_URL = `${CDN}/vzc-bracelet%20no%20bg.png`;

/* ────────────────────────────────────────────────────────────────
   OPERATOR-KNOB — verticale positie van de haptic-ring + center-dot
   op de Free Bracelet hero-render.
   - Negatief = ring omhoog (richting bovenkant van de bracelet)
   - Positief = ring omlaag (richting onderkant van de bracelet)
   - 1mm ≈ 4 pixels op standaard density
   Audio PRO landing is hier niet door beïnvloed (blijft 0 = origineel).
   ──────────────────────────────────────────────────────────────── */
const HAPTIC_RING_OFFSET_Y_FREE = 12; // pixels — verander dit getal om te tunen
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

/* Kickstarter-target. Operator-update 2026-06-17: launch verschoven van
   1 augustus → 1 september 2026. Datum/tijd in lokale tijd (geen 'Z'-
   suffix) — countdown-cosmetica, geen kritieke precisie. */
const KICKSTARTER_TARGET = new Date('2026-09-01T00:00:00').getTime();

/* ── Carousel dimensions (How-it-works + Modes) ───────────────────────────
   Apple iPhone-page-style swipe-carousel met peek van de volgende card.
   - SIDE_INSET = padding van scherm-rand tot start van eerste card
   - PEEK       = stukje van de volgende card dat zichtbaar blijft, signal
                  voor de gebruiker "er is meer"
   - CARD_GAP   = horizontale ruimte tussen cards
   - CARD_WIDTH = zichtbare breedte per card
   - CARD_SNAP  = interval waarop ScrollView vastsnapt bij swipe-einde

   Wordt bij module-load berekend op basis van device-width. Single
   source of truth voor zowel het JSX als de styles. */
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDE_INSET = 16;
/* Iter 9dq v81 (2026-06-03): PEEK opgetrokken van 26 → 70 zodat cards
   smaller worden — operator-feedback "cards veel te groot en breed".
   Meer peek van de volgende card = duidelijker affordance dat 'r meer is
   om te swipen. */
const PEEK = 70;
const CARD_GAP = 10;
const CARD_WIDTH = SCREEN_WIDTH - SIDE_INSET * 2 - PEEK;
const CARD_SNAP = CARD_WIDTH + CARD_GAP;

/* Series-badge-kleuren. Origin = neutraal grijs (sober), Signature =
   blauw (accent), Reserve = goud (premium-vibe). Internal IDs blijven
   'pure'/'premium'/'imperial' (geen data-migratie) — alleen het display
   wijzigt via SERIES_DISPLAY_NAMES. */
const SERIES_COLORS = {
  pure: { bg: 'rgba(255,255,255,0.06)', text: '#bdbdbd' },
  premium: { bg: 'rgba(58,143,255,0.18)', text: '#3a8fff' },
  imperial: { bg: 'rgba(212,163,90,0.18)', text: '#d4a35a' },
} as const;

/* Operator-besluit 2026-06-14: terug naar de oorspronkelijke series-namen
   Pure / Premium / Imperial. De Iter 9av wijziging naar Origin/Signature/
   Reserve werd teruggedraaid — de oorspronkelijke namen zijn helderder
   en consistent met de keys onder de motorkap. */
const SERIES_DISPLAY_NAMES = {
  pure: 'Pure',
  premium: 'Premium',
  imperial: 'Imperial',
} as const;

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
      'Calibrated pulses reach your wrist and guide your nervous system toward calm or focus. Notice a shift in 15 to 30 minutes — subtle, but felt.',
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
    body:
      'Hand-assembled, one at a time. Premium 8mm natural gemstones, precision-engineered closure. No two stones alike — each carries its own character.',
    tags: ['Hand-assembled', 'Natural Gemstone', '925 Sterling Silver'],
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

/* ── Data: 5 Haptic Modes ──────────────────────────────────────────────────

   Namen + duren + kleuren UIT CLAUDE.md §5 (operator-besluit 2026-05-25).
   Body-tekst + tags uit de HTML-mockup (operator-goedgekeurde copy).

   BELANGRIJK (CLAUDE.md §1, operator-bevestiging 2026-05-26):
   `wave` (Gamma/Beta/Alpha/Theta/Delta) zijn hersenstaten — die zijn
   medisch en mogen WIJ NIET CLAIMEN. De firmware tunet de PPS
   intern op die frequenties, maar de USER-FACING UI toont alleen
   de state-DIRECTION waar de bracelet je via bottom-up haptiek
   naartoe begeleidt. Daarom: wave blijft in de data (interne
   referentie + later evt. control-screen voor geactiveerde
   bracelet-owners), `direction` is wat de etalage toont. */

type Mode = {
  app: string;
  /** Intern alleen. NIET tonen in user-facing UI. Brain-state-label
   *  voor PPS-tuning (firmware-laag). */
  wave: string;
  duration: string;
  color: string;
  /** User-facing state-direction. Bottom-up taal (focus/kalmte/rust),
   *  geen medische claims. Vervangt de eerdere wave-display. */
  direction: string;
  head: string;
  body: string;
  ideal: string[];
};

/* Iter 9dq v80 (2026-06-03): per-mode foto's voor de carousel-cards op
   bracelet-tab. Spiegelt de MODE_IMAGES-map in bracelet-control.tsx —
   zelfde foto's voor consistentie tussen het marketing-overzicht en de
   sessie-selectie. Wanneer operator een foto vervangt: beide files
   updaten (of refactoren naar één gedeelde constant). */
const MODE_PHOTOS_BY_WAVE: Record<string, string> = {
  Gamma: 'https://vibezcore-audio.b-cdn.net/images/gamma%20pic.jpg',
  Beta: 'https://vibezcore-audio.b-cdn.net/images/welcome%20new.png',
  Alpha: 'https://vibezcore-audio.b-cdn.net/images/Social%20mastery.jpg',
  Theta:
    'https://vibezcore-audio.b-cdn.net/images/confident-man-with-beard-mustache-smiling-generated-by-ai.jpg',
  Delta:
    'https://vibezcore-audio.b-cdn.net/images/Rest%20%26%20Reset%20Delta.jpg',
};

const MODES: Mode[] = [
  {
    app: 'Boost',
    wave: 'Gamma',
    duration: '8–15 min',
    color: '#FFFFFF', // Iter 8c: rood → wit (zie ble-contract.ts comment)
    direction: 'Activation',
    head: 'Sharpens cognitive clarity and accelerates mental processing.',
    body:
      'Supports high-level information integration, rapid problem-solving, and peak alertness for demanding tasks.',
    ideal: [
      'Intense concentration',
      'Complex problem-solving',
      'High-stakes tasks',
      'Speed and precision',
    ],
  },
  {
    app: 'Sharp Focus',
    wave: 'Beta',
    duration: '15–30 min',
    color: '#FF9F0A',
    direction: 'Focus',
    head: 'Instant focus ignition for moments that demand mental intensity.',
    body:
      'Designed to elevate alertness and sustain performance under pressure.',
    ideal: [
      'High-intensity work',
      'Critical precision',
      'Heavy cognitive load',
      'Morning activation',
      'When alertness needs to rise',
    ],
  },
  {
    app: 'Calm Control',
    wave: 'Alpha',
    duration: '15–30 min',
    color: '#0A84FF',
    direction: 'Calm focus',
    head: 'Steady calm for moments that require clear thinking without tension.',
    body:
      'Designed to reduce noise, stabilize your state, and keep you mentally present.',
    ideal: [
      'Focused work',
      'Creative thinking',
      'Social interactions',
      'Midday reset',
      'When calm precision matters',
    ],
  },
  {
    app: 'Clarity',
    wave: 'Theta',
    duration: '15–30 min',
    color: '#BF5AF2',
    direction: 'Reflection',
    head: 'Opens space for deeper understanding and inward focus.',
    body:
      'Supports insight, creativity, and emotional processing beyond surface thought.',
    ideal: [
      'Reflective moments',
      'Creative exploration',
      'Emotional processing',
      'When depth matters',
    ],
  },
  {
    app: 'Rest & Reset',
    wave: 'Delta',
    duration: '25–45 min',
    color: '#4FA46B', // Iter 8c: groen zachter (zie ble-contract.ts comment)
    direction: 'Deep rest',
    head: 'Guides the body toward profound rest and restoration.',
    body:
      'Designed to release accumulated tension and support recovery at the deepest level.',
    ideal: [
      'Physical recovery',
      'Nervous system reset',
      'Pre-sleep wind-down',
      'Releasing tension',
    ],
  },
];

/* ── Data: Technical Specs ─────────────────────────────────────────────── */

const SPECS = [
  { val: '16–21cm', lbl: 'Wrist Size' },
  { val: '8mm', lbl: 'Bead Size' },
  { val: 'BT 5.0', lbl: 'Bluetooth' },
  { val: 'Pogo Pin', lbl: 'Charging' },
  { val: '5', lbl: 'Haptic Modes' },
  { val: 'App', lbl: 'Control via App' },
];

/* ── Data: 15 Gemstone Editions ────────────────────────────────────────────

   Image-pad volgt exact de bestandsnamen die operator op Bunny zette
   (inclusief typo's bronzonite/Shattudkite/Lava vzw/lapiz — bewust niet
   gecorrigeerd, anders breken de URLs). De `desc` heeft een " — " als
   scheiding tussen kop-zin (italic in detail-panel) en lichaam (lichter
   grijs). Series-tag wordt gebruikt voor de filter-tabs + badge-kleur. */

type Series = 'pure' | 'premium' | 'imperial';
type Edition = {
  key: string;
  name: string;
  stone: string;
  origin: string;
  series: Series;
  image: string;
  desc: string;
};

const EDITIONS: Edition[] = [
  /* ── PURE ── */
  {
    key: 'sentinel',
    name: 'SENTINEL',
    stone: 'Lava Stone',
    origin: 'Arizona, USA',
    series: 'pure',
    image: `${CDN}/Lava%20vzw%20(1).jpg`,
    desc:
      'Born from fire, hardened by earth. — Rough black surface with a raw, volcanic structure.',
  },
  {
    key: 'phantom',
    name: 'PHANTOM',
    stone: 'Black Onyx',
    origin: 'India',
    series: 'pure',
    image: `${CDN}/onyx%20vzc%20(1).jpg`,
    desc:
      'Absolute black. No noise, no compromise. — Deep jet black with a flawless, mirror-like finish.',
  },
  {
    key: 'aurum',
    name: 'AURUM',
    stone: 'Silver Sheen Obsidian',
    origin: 'Mexico',
    series: 'pure',
    image: `${CDN}/Silver%20sheen%20vzc%20(1).jpg`,
    desc:
      'Volcanic glass with a metallic soul. — Black glass ignited with a cold silver glow.',
  },
  {
    key: 'vesper',
    name: 'VESPER',
    stone: 'Black Tiger Eye',
    origin: 'Africa',
    series: 'pure',
    image: `${CDN}/black%20tiger%20vzc%20(1).jpg`,
    desc:
      'Shadow and light in motion. — Dark bands shifting with a sharp, metallic sheen.',
  },
  {
    key: 'equilibrium',
    name: 'EQUILIBRIUM',
    stone: 'Jade',
    origin: 'China',
    series: 'pure',
    image: `${CDN}/jade%20vzc%20(1).jpg`,
    desc:
      'Timeless stone of empires. — Dense green with a smooth, almost liquid surface.',
  },
  /* ── PREMIUM ── */
  {
    key: 'solis',
    name: 'SOLIS',
    stone: 'Yellow Tiger Eye',
    origin: 'Africa',
    series: 'premium',
    image: `${CDN}/Yellow%20Tiger%20vzc%20(1).jpg`,
    desc:
      'Liquid gold in stone form. — Radiant gold flowing with a sharp, luminous sheen.',
  },
  {
    key: 'genesis',
    name: 'GENESIS',
    stone: 'Kambaba Jasper',
    origin: 'Africa',
    series: 'premium',
    image: `${CDN}/Kambaba%20Jasper%20vzc%20(1).jpg`,
    desc:
      'Ancient patterns, primal origin. — Deep green marked by ancient, orbital patterns.',
  },
  {
    key: 'aeterna',
    name: 'AETERNA',
    stone: 'Agate',
    origin: 'India',
    series: 'premium',
    image: `${CDN}/Agate%20vzc%20(1).jpg`,
    desc:
      'Layered over time. Precision shaped by nature. — Layer upon layer carved with surgical precision.',
  },
  {
    key: 'vigor',
    name: 'VIGOR',
    stone: 'African Bloodstone',
    origin: 'Africa',
    series: 'premium',
    image: `${CDN}/African%20Bloodstone%20vzc%20(1).jpg`,
    desc:
      'The stone of the ancient warrior. — Dark green cut through with deep blood-red strikes.',
  },
  {
    key: 'goldenaurum',
    name: 'GOLDEN AURUM',
    stone: 'Golden Sheen Obsidian',
    origin: 'Mexico',
    series: 'premium',
    image: `${CDN}/Golden%20sheen%20vzc%20(1).jpg`,
    desc:
      'Black volcanic glass ignited with gold. — Black glass burning with a deep golden reflection.',
  },
  /* ── IMPERIAL ── */
  {
    key: 'eli',
    /* Operator-besluit 2026-05-25: ELI = Blue Tiger Eye. De Bunny-foto
       heet `Star Tiger vzc (1).jpg` (afgeleide marketing-naam van
       operator), maar de UI-stone-tekst blijft "Blue Tiger Eye" zoals
       in de oorspronkelijke product-spec. */
    name: 'ELI',
    stone: 'Blue Tiger Eye',
    origin: 'Africa',
    series: 'imperial',
    image: `${CDN}/Star%20Tiger%20vzc%20(1).jpg`,
    desc:
      'Forged in darkness. Controlled, precise, unshaken. — Midnight blue with a cold, shifting metallic glow.',
  },
  {
    key: 'imperium',
    name: 'IMPERIUM',
    stone: 'Lapis Lazuli',
    origin: 'Afghanistan',
    series: 'imperial',
    image: `${CDN}/lapiz%20vzc%20(1).jpg`,
    desc:
      'The ultimate hallmark of the elite. — Deep royal blue pierced with natural gold.',
  },
  {
    key: 'cuprum',
    name: 'CUPRUM',
    stone: 'Shattuckite',
    origin: 'Arizona, USA',
    series: 'imperial',
    image: `${CDN}/Shattudkite%20vzc%20(1)%20(1).jpg`,
    desc:
      'Rare mineral, raw character. — Electric blue and green colliding in raw formation.',
  },
  {
    key: 'ferrum',
    name: 'FERRUM',
    stone: 'Bronzite',
    origin: 'India',
    series: 'imperial',
    image: `${CDN}/bronzonite%20vzc%20(1).jpg`,
    desc:
      'Forged with the strength of steel. — Dark bronze tones with a forged metallic shimmer.',
  },
  {
    key: 'matrix',
    name: 'MATRIX',
    stone: 'African Turquoise',
    origin: 'Africa',
    series: 'imperial',
    image: `${CDN}/Natural%20African%20Turquoise%20vzc%20(1).jpg`,
    desc:
      'Shaped by time and terrain. — Green-blue surface fractured with raw matrix veins.',
  },
];

/* ── Data: Pricing (placeholders — operator past later aan) ──────────────── */

/* USD-only sinds 2026-05-26 (operator-keuze: EUR-toggle weg, alleen
   USD tonen — eenvoudiger, Kickstarter is USD-first).
   Iter 9dq v143 (operator 2026-06-15 v3) + v175 (operator 2026-06-18):
   pricing-audit. Match'd nu de canonical values uit
   assets/website-content/kickstarter-page.html + shop-bundle-bracelet-
   compact.html:
     Bracelet: was $299, now $169, save $130
     Bundle:   was $399, now $215, save $184
                (math: $299 + $69.99 audio + $32 beads ≈ $399 retail)
     Extra bead set: $32 retail (geen losse KS-discount op website) */
/* Iter v218 (2026-07-04): eur toegevoegd als secundaire hint onder USD.
   Kickstarter is USD-native (KS-pagina zelf toont USD), EUR is contextuele
   conversie voor EU-users. Rate ~0.92 (juli 2026 gemiddeld). */
type PriceRow = { main: string; old: string; save: string; eur?: string };
type PriceSet = {
  bracelet: PriceRow;
  bundle: PriceRow;
  extra: PriceRow;
};
const PRICING: PriceSet = {
  /* Iter v219 (2026-07-04): bundle retail-waarde herrekend inclusief
     Audio Library Yearly (€119.88 = ~$130) — was er niet in de old-price.
     Nieuwe totaal: $299 bracelet + $32 extra + $130 audio = $461.
     Save $246 = 53% korting t.o.v. gecombineerde retail waarde. */
  bracelet: { main: '$169', old: '$299', save: 'Save $130', eur: '≈ €155' },
  bundle: { main: '$215', old: '$461', save: 'Save $246 · 53% off', eur: '≈ €198' },
  extra: { main: '$32', old: '', save: '', eur: '≈ €30' },
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

/* Splits "kopzin — body"-desc op de em-dash. Behoudt origineel als er
   geen em-dash is. */
function splitDesc(desc: string): { head: string; body: string } {
  const idx = desc.indexOf(' — ');
  if (idx < 0) return { head: desc, body: '' };
  return { head: desc.slice(0, idx), body: desc.slice(idx + 3) };
}

/* Countdown-formatter — geeft DD/HH/MM/SS als string-pairs met
   leading-zero. Returnt `null` wanneer target al verstreken is, zodat
   de caller naar "We are live"-state kan overschakelen. */
function countdownParts(target: number, now: number): {
  d: string;
  h: string;
  m: string;
  s: string;
} | null {
  const diff = target - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const sec = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { d: pad(d), h: pad(h), m: pad(m), s: pad(sec) };
}

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
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /* Offset alleen aan de START (setTimeout), niet in de loop —
       anders wordt elke ring's cyclus-lengte verschillend en lopen
       ze uit fase. */
    const startLoop = (val: Animated.Value, delay: number) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: 1,
            duration: 3000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          /* Instant reset — bij val=1 is opacity al 0, dus geen
             zichtbare flicker. */
          Animated.timing(val, {
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
      const loop = Animated.loop(
        Animated.timing(glow, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
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
  const ringStyle = (val: Animated.Value) => ({
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
        <Animated.View
          style={[
            s.sonarRing,
            ringOffsetY ? { marginTop: 5 + ringOffsetY } : null,
            ringStyle(ring1),
          ]}
        />
        <Animated.View
          style={[
            s.sonarRing,
            ringOffsetY ? { marginTop: 5 + ringOffsetY } : null,
            ringStyle(ring2),
          ]}
        />
        <Animated.View
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

/* ── Pricing "what's included"-row helper ─────────────────────────────
   Klein onderdeeltje: gekleurde checkmark + tekst op één regel.
   Geëxtraheerd om de pricing-JSX leesbaar te houden (4 stuks per card). */
function PIncluded({ text }: { text: string }) {
  return (
    <View style={pIncludedStyle.row}>
      <Text style={pIncludedStyle.check}>✓</Text>
      <Text style={pIncludedStyle.text}>{text}</Text>
    </View>
  );
}
const pIncludedStyle = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  check: {
    color: Brand.accent,
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    lineHeight: 20,
    width: 14,
  },
  text: {
    flex: 1,
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
  },
});

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

function DetailPanel({ ed, onClose }: { ed: Edition; onClose: () => void }) {
  const sp = splitDesc(ed.desc);
  const [zoomed, setZoomed] = useState(false);
  return (
    <View style={s.detail}>
      <Pressable
        onPress={() => setZoomed((z) => !z)}
        accessibilityLabel={zoomed ? 'Zoom out' : 'Zoom in (50%)'}
        style={s.detailImgWrap}
      >
        {/* Iter 8c: zoom werkt nu via transform: scale(1.5) op de Image
            zelf — dat vergroot het hele plaatje (bracelet incl. wit-
            ruimte) gecentreerd, ipv alleen de container te vergroten
            (wat alleen de witte rand zou stretchen). Container heeft
            overflow: hidden voor de clip. */}
        {/* Iter 9cm (2026-05-31): default popup blijft cover (= perfect).
            Zoom-factor 1.5 → 1.2 want bij 1.5 werd het beeld 50% groter
            dan de card en kapte de sides duidelijk af. 1.2 = 20% groter
            (10% overflow links/rechts) → genoeg voor "inspect"-gevoel
            zonder dat de bracelet uit het kader valt. */}
        <Image
          source={{ uri: ed.image }}
          style={[
            s.detailImg,
            zoomed && { transform: [{ scale: 1.2 }] },
          ]}
          resizeMode="cover"
          resizeMethod="resize"
          fadeDuration={0}
        />
        {/* Zoom-hint chip — alleen visible in unzoomed-state. Subtle. */}
        {!zoomed && (
          <View style={s.zoomHint} pointerEvents="none">
            <Text style={s.zoomHintText}>Tap to zoom</Text>
          </View>
        )}
      </Pressable>
      {/* Iter 9ax (2026-05-31): floating × close-knop rechtsboven —
          bespaart ~60px verticale ruimte tov de oude bottom-button.
          Hit-area 44×44 voor easy tap. Tegen donkere image-zone subtle
          witte ring + zwarte semi-transparent fill voor contrast. */}
      <Pressable
        style={s.detailCloseX}
        onPress={onClose}
        hitSlop={8}
        accessibilityLabel="Close edition details"
      >
        <Text style={s.detailCloseXText}>✕</Text>
      </Pressable>
      <View style={s.detailBody}>
        {/* Iter 9au (2026-05-31): Series-badge én Series-spec verwijderd. */}
        <Text style={s.detailName}>{ed.name}</Text>
        <Text style={s.detailNat}>
          {ed.stone} · <Text style={s.detailOrigin}>{ed.origin}</Text>
        </Text>
        <View style={s.detailDescWrap}>
          <Text style={s.detailDescHead}>{sp.head}</Text>
          {!!sp.body && <Text style={s.detailDescBody}>{sp.body}</Text>}
        </View>
        <Text style={s.detailNote}>
          Each stone is unique in nature. Colors and markings may vary
          slightly.
        </Text>
        <View style={s.detailSpecs}>
          <View style={s.detailSpec}>
            <Text style={s.detailSpecLbl}>Stone</Text>
            <Text style={s.detailSpecVal}>{ed.stone}</Text>
          </View>
          <View style={s.detailSpec}>
            <Text style={s.detailSpecLbl}>Origin</Text>
            <Text style={s.detailSpecVal}>{ed.origin}</Text>
          </View>
          <View style={s.detailSpec}>
            <Text style={s.detailSpecLbl}>Sizes</Text>
            <Text style={s.detailSpecVal}>16–21 cm</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

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
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
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

  /* Iter 9v: owners zien BraceletControl INLINE in deze tab. Voorheen
     deden we router.replace('/bracelet-control'), maar dat is een
     Stack-route buiten de (tabs) groep → tab-bar verdween. Door
     <BraceletControl /> direct te renderen blijft de tab-bar zichtbaar
     en kan user makkelijk naar Audio of Account switchen. */

  /* Carousel-state (How it works + Modes). Eén active-index per
     carousel; gesynchroniseerd met de scroll-positie via onMomentum-
     ScrollEnd. Dots onder elke carousel reflecteren `active*` en
     kunnen via tap teruggrijpen op `jumpTo*`. */
  const [activePill, setActivePill] = useState(0);
  const [activeMode, setActiveMode] = useState(0);
  const stepScrollRef = useRef<ScrollView>(null);
  const modeScrollRef = useRef<ScrollView>(null);

  /* Carousel-scroll handlers — bij momentum-end snap-positie afleiden
     en de active-index updaten. Math.round zodat een snap exact op 'n
     veelvoud van CARD_SNAP ook bij rounding-errors klopt. */
  const onStepScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_SNAP);
    if (idx !== activePill) setActivePill(idx);
  };
  const onModeScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_SNAP);
    if (idx !== activeMode) setActiveMode(idx);
  };

  /* Dot-tap → programmatische scroll naar de gekozen card. */
  const jumpToStep = (i: number) => {
    setActivePill(i);
    stepScrollRef.current?.scrollTo({ x: i * CARD_SNAP, animated: true });
  };
  const jumpToMode = (i: number) => {
    setActiveMode(i);
    modeScrollRef.current?.scrollTo({ x: i * CARD_SNAP, animated: true });
  };

  /* Series-filter voor de collection. Default `imperial`. */
  const [series, setSeries] = useState<Series>('imperial');

  /* Welke edition is uitgeklapt voor detail-panel. `null` = niets. */
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null);

  /* Free Breathwork chooser modal — opent vanuit de discovery-card
     onderaan de Bracelet tab. Toont de 5 breathwork-protocols zodat
     de gebruiker de juiste state kiest vóór navigatie naar
     bracelet-control (met ?mode=X&breathwork=1). Identiek aan de Audio
     tab versie — één coherente UX. */
  const [breathChooserOpen, setBreathChooserOpen] = useState(false);

  /* Currency-toggle weggehaald 2026-05-26: alleen USD tonen. */

  /* Countdown — re-render elke seconde. setInterval geannuleerd bij
     unmount; geen ref-jank want we wijzigen alleen state. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Android hardware-back terwijl de edition-detail overlay open is →
     sluit de overlay (= UX-conventie, back nooit door een overlay
     heen laten propagaderen anders verlaat user de Bracelet-tab). */
  useEffect(() => {
    if (!selectedEdition) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedEdition(null);
      return true;
    });
    return () => sub.remove();
  }, [selectedEdition]);

  /* Series-filter: lijst editions waar de huidige series bij past. */
  const visibleEditions = EDITIONS.filter((e) => e.series === series);

  /* Active edition voor detail-panel (null wanneer niets geselecteerd). */
  const detailEdition = selectedEdition
    ? EDITIONS.find((e) => e.key === selectedEdition) ?? null
    : null;

  /* Wisselen series sluit een open detail-panel. */
  const switchSeries = (next: Series) => {
    setSeries(next);
    setSelectedEdition(null);
  };

  const cd = countdownParts(KICKSTARTER_TARGET, now);
  const price = PRICING;

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
        {/* Iter 9dq v79: zelfde preview-banner als de main bracelet-tab
            route — Audio PRO landing is ook bracelet-content. */}
        <PreviewBanner />
        <ScrollView
          ref={landingScrollRef}
          contentContainerStyle={s.landingScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Iter 9ct (2026-05-31): Kickstarter-row is nu de eyebrow
              (member-text weg). 6 bullets in een 2×3 grid met de echte
              core features (bottom-up regulation als eerste = HET
              fundament onder de bracelet). */}
          <View style={s.landingKsEyebrowRow}>
            <Text style={s.landingKsDate}>
              KICKSTARTER · SEPT 1, 2026
            </Text>
            <View style={s.landingKsBadge}>
              <Text style={s.landingKsBadgeText}>EARLY BIRD</Text>
            </View>
          </View>
          <Text style={s.landingTitle}>The Smart Bead{'\n'}Bracelet</Text>

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
            android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
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
      {/* Iter v194 (2026-07-04): PreviewBanner alleen voor NIET-owners.
          Echte bracelet-owners (die betaald hebben + code hebben ingevoerd)
          zien deze banner niet — voor hen is de bracelet een echt product,
          niet een preview. Guard voorkomt "PREVIEW · Launching September
          2026" tekst op owner-scherm die suggereert het nep is. */}
      {!isBraceletOwner && <PreviewBanner />}
      <ScrollView
        ref={mainScrollRef}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
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
            android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
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
              ✨  Reserved for VIBEZCORE members — priority access at launch
            </Text>
          </View>
        ) : null}

        {/* ── 1. HERO + 2. BRACELET-RENDER ──
            Iter 9t: verbergen voor owners (operator-feedback "bracelet
            knop mag niet meer naar Kickstarter page voelen voor PRO").
            Owner ziet alleen de owner-banner bovenaan + reference
            content (How it works / Modes / Tech specs). */}
        {!isBraceletOwner && (
          <>
            {/* Iter 9cn (2026-05-31): hero refactor — premium polish.
                - Titel: VIBEZCORE drop, alleen "Smart Bead Bracelet"
                  (brand staat al impliciet overal in de app)
                - KICKSTARTER row krijgt een EARLY BIRD-chip ernaast
                - Subline-onder krijgt micro-CTA "Reserve from $169 →"
                  die naar de Kickstarter pricing-section scrollt */}
            <View style={s.hero}>
              <View style={s.heroEyebrowRow}>
                <Text style={s.heroEyebrow}>
                  KICKSTARTER · SEPT 1, 2026
                </Text>
                <View style={s.heroEarlyBird}>
                  <Text style={s.heroEarlyBirdText}>EARLY BIRD</Text>
                </View>
              </View>
              <Text style={s.heroTitle}>
                Smart Bead{'\n'}Bracelet
              </Text>
              <Text style={s.heroSub}>
                5 haptic modes. One clear outcome.{'\n'}
                You in control of your own state.
              </Text>
              {/* Iter 9co (2026-05-31): micro-CTA weggehaald op
                  operator-verzoek. Reserve-CTA's leven verderop in
                  de Kickstarter-pricing sectie. */}
            </View>
            {/* Iter 9cw (2026-05-31): free hero ook transparent →
                bracelet zweeft op de dark UI, geen witte card meer.
                Iter 9de (2026-05-31): haptic-offset komt nu uit
                HAPTIC_RING_OFFSET_Y_FREE bovenaan dit bestand →
                operator kan zelf tunen zonder JSX te raken. */}
            <SonarRender
              transparent
              ringOffsetY={HAPTIC_RING_OFFSET_Y_FREE}
            />
          </>
        )}

        {/* Owner-eyebrow ipv hero (iter 9t): geeft owners een korte
            "you are here"-context zonder marketing-vibes. */}
        {isBraceletOwner && (
          <Text style={s.ownerEyebrow}>YOUR BRACELET</Text>
        )}

        {/* Iter 9o: PREVIEW-knop verplaatst naar onder "How it works" —
            user heeft eerst context nodig (wat doet de bracelet) voor 'ie
            de preview wil zien. Operator-feedback. */}

        {/* ── 3. HOW IT WORKS — pill-nav + story-card (HTML-mockup style).
            Operator-keuze 2026-05-26: terug naar pills voor déze
            sectie. De carousel was te onrustig; pills + statische
            content-card geeft een rustigere lees-ervaring. Pill-stijl
            uit de HTML: witte fill voor actief (hoog contrast), zeer
            subtiel grijs voor inactief. Story-card heeft een verticale
            blauwe lijn links van de body-tekst (visual anchor) en
            blauw-gefilde tags onderaan. */}
        {/* Iter 9cq → 9db (2026-05-31): marginTop 16 → 4 zodat How it
            works direct tegen de bracelet aanplakt. */}
        <Text style={[s.sectionTitle, { marginTop: 4 }]}>How it works.</Text>
        {/* Iter 9: pill-cloud → horizontale scroll-tabs met underline-
            indicator (Apple iOS-style segmented nav). Wrapping pills
            (2-3 regels) waren de meest dated pattern op het scherm.
            Nu: horizontale scroll met active-state underline + dots. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.storyTabBar}
        >
          {STORY.map((step, i) => {
            const on = i === activePill;
            return (
              <Pressable
                key={step.n}
                onPress={() => setActivePill(i)}
                style={s.storyTab}
                accessibilityLabel={`Show step: ${step.title}`}
              >
                <Text
                  style={[s.storyTabText, on && s.storyTabTextOn]}
                  numberOfLines={1}
                >
                  {step.title}
                </Text>
                {on && <View style={s.storyTabUnderline} />}
              </Pressable>
            );
          })}
        </ScrollView>
        {/* Dot-pagination — kleine indicator voor positie in story-flow.
            Past bij de carousel-dots verderop, geeft consistente UX. */}
        <View style={s.storyDots}>
          {STORY.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => setActivePill(i)}
              style={[s.storyDot, i === activePill && s.storyDotOn]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityLabel={`Go to step ${i + 1}`}
            />
          ))}
        </View>
        <View style={s.storyCard}>
          <Text style={s.storyNum}>{STORY[activePill].n}</Text>
          <Text style={s.storyTitle}>{STORY[activePill].title}</Text>
          <Text style={s.storyBody}>{STORY[activePill].body}</Text>
          {/* Iter 9: tag-pills → dot-separated text (matches modeWave-
              patroon elders in deze file). Veel iOS-natuurlijker. */}
          <Text style={s.storySpecLine}>
            {STORY[activePill].tags.join('  ·  ')}
          </Text>
        </View>

        {/* ── PREVIEW-CTA (iter 9ci 2026-05-31) ────────────────────────
            Was een rustige outlined-knop die visueel verloren ging tussen
            "How it works" en "5 modes". Operator-feedback: moet
            prominenter aanwezig zijn én duidelijker uitleggen wat 't is.
            Nu: card-style CTA met sterke accent-fill, eyebrow + titel +
            subline + arrow. Voelt onmiddellijk als "tik hier, beleef het". */}
        <Pressable
          style={s.previewCta}
          onPress={() => router.push('/bracelet-control')}
          android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
          accessibilityLabel="Preview the bracelet control app"
        >
          <View style={s.previewCtaContent}>
            <Text style={s.previewCtaEyebrow}>TRY IT NOW</Text>
            <Text style={s.previewCtaTitle}>Preview the bracelet app</Text>
            <Text style={s.previewCtaSub}>
              See the control screen, modes, and feel the flow — no bracelet needed.
            </Text>
          </View>
          <View style={s.previewCtaArrow}>
            <Text style={s.previewCtaArrowText}>→</Text>
          </View>
        </Pressable>

        {/* Iter v193 (2026-07-03): compacte Oura-style CTAs direct onder de
            preview-card. Voor bezoekers die AL een bracelet hebben (activate)
            of nog geen (learn more) — kort en helder ipv de oude 2 grote cards
            onderaan de page die te ver van de context stonden en te druk waren. */}
        <Pressable
          style={s.compactActivateBtn}
          onPress={() => router.push('/activate-bracelet')}
          android_ripple={{ color: 'rgba(255,255,255,0.20)' }}
          accessibilityLabel="Activate your Bracelet or Full Bundle"
        >
          <Text style={s.compactActivateBtnText}>Activate Bracelet or Full Bundle</Text>
          <Text style={s.compactActivateBtnArrow}>→</Text>
        </Pressable>
        <Pressable
          style={s.compactLearnMoreLink}
          onPress={() => openExternal('https://www.vibezcore.com/')}
          accessibilityLabel="Don't have a Smart Bead Bracelet yet, learn more at vibezcore.com"
        >
          <Text style={s.compactLearnMoreLinkText}>
            Don't have one yet? Learn more →
          </Text>
        </Pressable>

        {/* ── 4. 5 HAPTIC MODES — pill-tabs (underline) + content card.
            Zelfde principe als How it works. Brain-state labels
            (Gamma/Beta/Alpha/Theta/Delta) tonen we BEWUST niet —
            CLAUDE.md §1 verbiedt medische/wetenschappelijke claims.
            In plaats daarvan tonen we de "direction" — de state-
            richting waar de bracelet je via bottom-up haptiek heen
            begeleidt (Activation / Focus / Calm focus / Reflection /
            Deep rest). De firmware tunet PPS intern op de waves. */}
        <Text style={s.sectionTitle}>
          Different moments require{'\n'}different states.
        </Text>
        <Text style={s.sectionSub}>
          Five haptic modes. Each calibrated to guide you toward a
          specific state through bottom-up regulation.
        </Text>
        <View style={s.carouselWrap}>
          <ScrollView
            ref={modeScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_SNAP}
            decelerationRate="fast"
            onMomentumScrollEnd={onModeScrollEnd}
            contentContainerStyle={{ paddingHorizontal: SIDE_INSET }}
          >
            {MODES.map((m, i) => {
              const photo = MODE_PHOTOS_BY_WAVE[m.wave];
              return (
                <View
                  key={m.app}
                  style={[
                    s.carouselCard,
                    {
                      width: CARD_WIDTH,
                      marginRight: i === MODES.length - 1 ? 0 : CARD_GAP,
                    },
                  ]}
                >
                  {/* Iter 9dq v80 (2026-06-03): foto-header voor visuele
                      ankerpunt per modus. Operator-feedback: cards waren
                      te tekst-zwaar. Photo + dark-gradient-overlay zodat
                      mode-naam + direction leesbaar blijven over de foto. */}
                  {photo && (
                    <View style={s.modePhotoWrap}>
                      <Image
                        source={{ uri: photo }}
                        style={s.modePhoto}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={[
                          'rgba(0,0,0,0.10)',
                          'rgba(0,0,0,0.40)',
                          'rgba(0,0,0,0.88)',
                        ]}
                        locations={[0, 0.55, 1]}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={s.modePhotoOverlayContent}>
                        <View
                          style={[
                            s.modeDot,
                            { backgroundColor: m.color },
                          ]}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              s.uCardTitle,
                              { marginBottom: 0, color: '#ffffff' },
                            ]}
                          >
                            {m.app}
                          </Text>
                          <Text
                            style={[
                              s.modeWave,
                              { color: 'rgba(255,255,255,0.75)' },
                            ]}
                          >
                            {m.direction} · {m.duration}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                  <View style={s.modeCardContent}>
                    {/* Fallback header (geen foto): originele in-content
                        header. */}
                    {!photo && (
                      <View style={s.modeHdr}>
                        <View
                          style={[s.modeDot, { backgroundColor: m.color }]}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.uCardTitle, { marginBottom: 0 }]}>
                            {m.app}
                          </Text>
                          <Text style={s.modeWave}>
                            {m.direction} · {m.duration}
                          </Text>
                        </View>
                      </View>
                    )}
                    {/* Iter 9dq v82 (2026-06-03): operator-keuze om de
                        eerste "head"-zin weg te halen — voelde dubbel
                        naast de body-tekst. Alleen body als één
                        compacte beschrijving onder de foto. */}
                    <Text style={s.uCardBody}>{m.body}</Text>
                    <Text style={s.modeIdealLbl}>Ideal for</Text>
                    {/* Iter 9: pill-row → verticale ✓ checklist (Apple Health-
                        achtige "Use this for"-presentatie). Voelt meer als
                        een functie-bullet dan een marketing-pill. */}
                    <View style={s.idealList}>
                      {m.ideal.map((t) => (
                        <View key={t} style={s.idealItem}>
                          <Text
                            style={[s.idealCheck, { color: m.color }]}
                          >
                            ✓
                          </Text>
                          <Text style={s.idealItemText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
        <View style={s.dotRow}>
          {MODES.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => jumpToMode(i)}
              style={[s.dot, i === activeMode && s.dotOn]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              accessibilityLabel={`Go to ${MODES[i].app}`}
            />
          ))}
        </View>

        {/* ── 5. TECHNICAL SPECS — 2x2 grid van hardware-specs. ──
            Operator-feedback 2026-05-26 iter 3: hero met 5 colored
            dots was te kleurig én redundant — de Modes-carousel
            hierboven covered die info al volledig. Tech specs zijn
            nu strikt hardware-attributes: wrist size, bead size,
            bluetooth, charging. Geen "5 Haptic Modes" of "Control
            via App" hier (beide elders gecoverd). Explicit row-
            pairing met flex:1 zodat de cards exact 50/50 delen. */}
        <Text style={s.sectionTitle}>Technical specs.</Text>
        <View style={s.specsGrid}>
          {[
            [0, 1],
            [2, 3],
          ].map((pair, rowIdx) => (
            <View key={rowIdx} style={s.specRow}>
              {pair.map((idx) => (
                <View key={SPECS[idx].lbl} style={s.specCard}>
                  <Text style={s.specVal}>{SPECS[idx].val}</Text>
                  <Text style={s.specLbl}>{SPECS[idx].lbl}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* ── 6. THE COLLECTION ──
            Iter 9q: alleen tonen aan niet-owners. Voor owners is dit
            een shop-grid en irrelevant (ze hebben al een edition). */}
        {!isBraceletOwner && (
        <>
        <Text style={s.sectionTitle}>
          15 natural premium{'\n'}gemstone editions.
        </Text>
        <Text style={s.sectionSub}>
          Three series. Fifteen natural stones from origins worldwide.
          All bracelets feature 8mm natural gemstone beads.
        </Text>

        {/* Underline-style tabs: pure tekst, accent-underline op
            selectie. Zelfde principe als de How-it-works pills. */}
        <View style={s.tabRow}>
          {(['pure', 'premium', 'imperial'] as Series[]).map((sr) => {
            const on = series === sr;
            const c = SERIES_COLORS[sr];
            return (
              <Pressable
                key={sr}
                onPress={() => switchSeries(sr)}
                style={[
                  s.tabBtn,
                  on && { borderBottomColor: c.text },
                ]}
                accessibilityLabel={`Show ${SERIES_DISPLAY_NAMES[sr]} series`}
              >
                <Text
                  style={[
                    s.tabText,
                    on && { color: c.text, fontFamily: BrandFonts.semibold },
                  ]}
                >
                  {SERIES_DISPLAY_NAMES[sr]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.collGrid}>
          {visibleEditions.map((ed) => {
            const c = SERIES_COLORS[ed.series];
            const active = selectedEdition === ed.key;
            return (
              <Pressable
                key={ed.key}
                onPress={() =>
                  setSelectedEdition((cur) => (cur === ed.key ? null : ed.key))
                }
                style={[s.collCard, active && s.collCardOn]}
                accessibilityLabel={`${ed.name} — ${ed.stone}, ${ed.origin}`}
              >
                <View style={s.collImgWrap}>
                  {/* Iter 9ck → 9cl: terug naar cover (contain maakte
                      de bracelet visueel kleiner binnen de card). */}
                  <Image
                    source={{ uri: ed.image }}
                    style={s.collImg}
                    resizeMode="cover"
                    resizeMethod="resize"
                    fadeDuration={0}
                  />
                </View>
                <View style={s.collInfo}>
                  <Text style={s.collName}>{ed.name}</Text>
                  <Text style={s.collNat}>
                    {ed.stone} · {ed.origin}
                  </Text>
                  <View
                    style={[
                      s.collBadge,
                      { backgroundColor: c.bg },
                    ]}
                  >
                    <Text style={[s.collBadgeText, { color: c.text }]}>
                      {SERIES_DISPLAY_NAMES[ed.series]}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Inline detail-paneel weggehaald 2026-05-26: stond onder de
            grid waardoor user moest scrollen om 't te zien. Vervangen
            door floating overlay buiten de ScrollView, hieronder. */}
        </>
        )}

        {/* ── 7. KICKSTARTER EARLY BIRD — alles binnen één container ──
            Operator-feedback 2026-05-26: 3 losse cards voelden los
            van elkaar. Nu één outer Kickstarter-card waarin titel,
            sub, 3 pricing-opties (Bundle featured genest, andere 2
            als sections gescheiden door hairlines), en footer netjes
            gegroepeerd staan.
            Iter 9q: hele Kickstarter-blok verbergen voor owners
            (geen sense in pre-order CTA's tonen aan iemand die al
            eigenaar is). */}
        {!isBraceletOwner && (
        <>
        <Text style={s.sectionTitle}>Kickstarter early bird.</Text>
        <Text style={s.sectionSub}>
          Secure the lowest Kickstarter price.{'\n'}
          Limited units. First reserved — first served.
        </Text>

        {/* ── COUNTDOWN (iter 9o verplaatst) ──────────────────────────
            Was onderaan; nu vlak onder de Reserve-intro zodat user
            de tijd-urgency ziet vóór 'ie de pricing-keuze maakt. */}
        <View style={s.timerWrap}>
          <Text style={s.timerLabel}>
            KICKSTARTER LAUNCH — 1 SEPTEMBER 2026
          </Text>
          {cd ? (
            <View style={s.timerBlocks}>
              <View style={s.tBlock}>
                <Text style={s.tNum}>{cd.d}</Text>
                <Text style={s.tLbl}>DAYS</Text>
              </View>
              <View style={s.tBlock}>
                <Text style={s.tNum}>{cd.h}</Text>
                <Text style={s.tLbl}>HOURS</Text>
              </View>
              <View style={s.tBlock}>
                <Text style={s.tNum}>{cd.m}</Text>
                <Text style={s.tLbl}>MINUTES</Text>
              </View>
              <View style={s.tBlock}>
                <Text style={s.tNum}>{cd.s}</Text>
                <Text style={s.tLbl}>SECONDS</Text>
              </View>
            </View>
          ) : (
            <Text style={s.timerLive}>We are live on Kickstarter!</Text>
          )}
        </View>

        <View style={s.ksCard}>
          {/* Operator-feedback iter 2 (2026-05-26): Bracelet Only en
              Add-on óók als aparte cards binnen de outer container —
              niet als plain text-sections. Alle 3 pricing-opties zijn
              nu visueel duidelijke eigen blokken met eigen styling. */}

          {/* FEATURED — Bundle, blue-tinted nested card. Iter 9: BEST VALUE
              pill vervangen door eyebrow-text-only (Apple Wallet / Tips-
              style). Geen solid fill meer, alleen text + accent kleur. */}
          <View style={s.ksFeatured}>
            <Text style={s.ksFeatBadgeText}>— BEST VALUE —</Text>
            <Text style={s.ksEyebrow}>FULL BUNDLE</Text>
            <Text style={s.ksName}>
              Bracelet + Extra + Audio Library
            </Text>
            {/* Iter 9: priceSave-pill vervangen door inline text met
                strikethrough op old price. Veel iOS-natuurlijker. */}
            <View style={s.priceRow}>
              <Text style={s.priceMain}>{price.bundle.main}</Text>
              <Text style={s.priceMeta}>
                <Text style={s.priceOld}>{price.bundle.old}</Text>
                <Text style={s.priceSaveInline}> · {price.bundle.save}</Text>
              </Text>
            </View>
            {price.bundle.eur && (
              <Text style={s.priceEur}>{price.bundle.eur}</Text>
            )}
            <View style={s.ksHairline} />
            <Text style={s.ksIncludesLbl}>What's included</Text>
            <View>
              <PIncluded text="VIBEZCORE Smart Bead Bracelet" />
              <PIncluded text="Extra Interchangeable Bracelet (8mm)" />
              <PIncluded text="12-Month Full Audio Library (worth €119.88)" />
              <PIncluded text="VIBEZCORE App access" />
            </View>
            <Pressable
              style={s.ksBtnPrimary}
              onPress={() => openExternal(WAITLIST_BUNDLE_URL)}
              android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
              accessibilityLabel="Reserve full bundle on waitlist"
            >
              <Text style={s.ksBtnPrimaryText}>Reserve Full Bundle</Text>
              <Text style={s.ksBtnPrimaryArrow}>→</Text>
            </Pressable>
          </View>

          {/* BRACELET ONLY — eigen nested card (neutrale tonale fill,
              geen accent — onderscheidt 'm visueel van de featured). */}
          <View style={s.ksOption}>
            <Text style={s.ksEyebrow}>BRACELET ONLY</Text>
            <Text style={s.ksName}>VIBEZCORE Smart Bead Bracelet</Text>
            <View style={s.priceRow}>
              <Text style={s.priceMain}>{price.bracelet.main}</Text>
              <Text style={s.priceMeta}>
                <Text style={s.priceOld}>{price.bracelet.old}</Text>
                <Text style={s.priceSaveInline}> · {price.bracelet.save}</Text>
              </Text>
            </View>
            {price.bracelet.eur && (
              <Text style={s.priceEur}>{price.bracelet.eur}</Text>
            )}
            <View style={s.ksHairline} />
            <Text style={s.ksIncludesLbl}>What's included</Text>
            <View>
              <PIncluded text="Smart Bead Bracelet (choice of stone)" />
              <PIncluded text="VIBEZCORE App access" />
              <PIncluded text="5 haptic modes" />
              <PIncluded text="Pogo pin charging cable" />
            </View>
            <Pressable
              style={s.ksBtnSecondary}
              onPress={() => openExternal(WAITLIST_BRACELET_URL)}
              android_ripple={{ color: 'rgba(58,143,255,0.15)' }}
              accessibilityLabel="Reserve bracelet on waitlist"
            >
              <Text style={s.ksBtnSecondaryText}>Reserve Bracelet</Text>
              <Text style={s.ksBtnSecondaryArrow}>→</Text>
            </Pressable>
          </View>

          {/* EXTRA BRACELET — compact horizontal nested card. Eigen
              tonale fill matched de Bracelet-Only card maar in compactere
              vorm — duidelijk "add-on" gewicht. */}
          <View style={s.ksAddon}>
            <View style={{ flex: 1 }}>
              <Text style={s.ksEyebrow}>ADD-ON</Text>
              <Text style={s.ksAddonName}>Additional Interchangeable Bracelet</Text>
              <Text style={s.ksAddonSub}>8mm beads · choice of stone</Text>
            </View>
            <View style={s.ksAddonPrice}>
              <Text style={s.priceMainSmall}>{price.extra.main}</Text>
              {/* Iter 9dq v175: extra bead set match'd website ($32 retail,
                  geen KS-discount). old + save zijn leeg → niet renderen. */}
              {price.extra.old || price.extra.save ? (
                <Text style={s.ksAddonMeta}>
                  {price.extra.old ? (
                    <Text style={s.priceOld}>{price.extra.old}</Text>
                  ) : null}
                  {price.extra.save ? (
                    <Text style={s.priceSaveInline}>
                      {price.extra.old ? ' · ' : ''}
                      {price.extra.save}
                    </Text>
                  ) : null}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Footer disclaimer — operator-update 2026-05-26 iter 3:
              "No payment until campaign launches" weg, vervangen door
              de duidelijkere zero-commitment-disclaimer die voorheen
              alleen in de standalone Waitlist-sectie stond. Sinds die
              standalone-sectie verwijderd is moet deze info hier
              terechtkomen — direct naast de Reserve-CTA's. */}
          <View style={s.ksFooter}>
            <Text style={s.ksFooterText}>
              No credit card · No financial data · No purchase obligation
            </Text>
            <Text style={s.ksFooterMeta}>
              We only use your email to notify you before launch
            </Text>
          </View>
        </View>

        {/* Iter v193 (2026-07-03): oude Activate + Learn more cards
            verwijderd — zijn verhuisd naar compacte CTAs direct onder de
            TRY IT NOW · Preview-card (Oura-stijl). Operator-feedback:
            stonden hier te laag na de KS pricing, voelden druk en
            gescheiden van de context. Nieuwe positie hoger op de pagina
            geeft KS-backers en nieuwe bezoekers direct 2 duidelijke acties
            zonder eerst door alle pricing-cards te scrollen. */}
        </>
        )}

        {/* Iter 9o: countdown verplaatst naar boven (onder Reserve-
            sub-text, vóór pricing-cards) — operator-feedback: bouwt
            urgency vóór de pricing-keuze, ipv eronder als afterthought. */}

        {/* Standalone Waitlist-sectie weggehaald 2026-05-26 iter 3:
            de per-product Reserve-CTA's in de Kickstarter pricing
            cards (Bundle + Bracelet) vervangen deze functioneel.
            De disclaimer "No credit card · No financial data..." zit
            nu in de Kickstarter-card footer. Sign-in-link blijft —
            verhuisd naar standalone block hieronder. */}

        {/* Free Breathwork CTA — Apple-stijl discovery card, gericht
            naar /bracelet-control (de bestaande breathwork-pagina).
            Identiek aan de Audio tab card — één coherente voice. Bracelet
            wordt nooit "optional" genoemd: bracelet is hoofdproduct. Card
            spreekt alleen over breathwork's 5 states + "Always free". */}
        <Pressable
          style={s.breathDiscoverCard}
          onPress={() => router.push('/breath')}
          accessibilityLabel="Open breathwork tab"
        >
          {/* v4 (2026-06-05): full-bleed hero card. Foto vult hele card
              met cover (geen letterbox), alle content (label, states,
              meta, button) overlaid onderaan met sterke gradient. */}
          <Image
            source={{
              uri: 'https://vibezcore-audio.b-cdn.net/images/Psychological%20Resilience.png',
            }}
            style={s.breathDiscoverImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.75)']}
            locations={[0, 0.50, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.breathDiscoverHeroGradient}
            pointerEvents="none"
          />
          <View style={s.breathDiscoverHeroText}>
            <Text style={s.breathDiscoverLabel}>Free breathwork</Text>
            <Text style={s.breathDiscoverStates}>
              Energy. Focus. Calm. Clarity. Rest.
            </Text>
            <Text style={s.breathDiscoverMeta}>
              Five techniques. Always free.
            </Text>
            <View style={s.breathDiscoverCta}>
              <Text style={s.breathDiscoverCtaText}>Open Breathwork</Text>
              <Text style={s.breathDiscoverCtaArrow}>→</Text>
            </View>
          </View>
        </Pressable>

        {/* Sign-in-link voor wie nog niet ingelogd is. Subtiel, geen
            dominante CTA. Toont alleen wanneer state geladen is én
            user niet ingelogd.
            Iter 9q: ook verbergen voor owners (die zijn al ingelogd
            EN hebben geen sign-in-link nodig). */}
        {/* Iter v190 (2026-07-02): sign-in link verwijderd van Bracelet tab.
            Sign-in intent hoort op Account tab. Bracelet tab = preview/purchase
            context, geen returning-member intent. Bottom nav → Account tab is
            1 tap voor wie wil inloggen. */}
      </ScrollView>

      {/* ── Edition-detail overlay ──────────────────────────────────────
          Floating popup BOVENOP de pagina, centraal gepositioneerd —
          user hoeft niet meer naar onder te scrollen om 't paneel te
          zien. Backdrop tap = sluiten. Android hardware-back = sluiten.

          Geen RN <Modal>-wrapper bewust: die heeft een eigen native
          window die alle touches opvangt, breekt de tab-bar onderaan.
          Zelfde pattern als WelcomeBackPopup / BraceletUpsellModal. */}
      {detailEdition && (
        <View
          style={[
            s.detailOverlay,
            /* Iter 9aw → 9dq v77 (2026-06-03): harmonised CTA-bottom
               formula. Floor 72px → consistent met andere screens,
               clears 3-button nav waar safeInsets soms 0 rapporteert. */
            {
              paddingTop: safeInsets.top + 12,
              paddingBottom: Math.max(safeInsets.bottom + 24, 72),
            },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            style={s.detailBackdrop}
            onPress={() => setSelectedEdition(null)}
          />
          {/* Iter 9au (2026-05-31): ScrollView verwijderd — operator wil
              geen scroll binnen de popup. Content is getrimd (Series
              badge + spec weg) zodat alles past binnen maxHeight 95%
              op standaard phone-schermen. */}
          <View style={s.detailWrap}>
            <DetailPanel
              ed={detailEdition}
              onClose={() => setSelectedEdition(null)}
            />
          </View>
        </View>
      )}

      {/* Free Breathwork chooser — Apple-stijl bottom sheet, identiek
          aan de Audio tab versie. 5 protocols, tap → navigeert naar
          /bracelet-control met de juiste mode + breathwork pre-enabled. */}
      {breathChooserOpen && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setBreathChooserOpen(false)}
          statusBarTranslucent
        >
          <View style={s.breathChooserModalRoot}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setBreathChooserOpen(false)}
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
                onPress={() => setBreathChooserOpen(false)}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <Text style={s.breathChooserCloseText}>✕</Text>
              </Pressable>
              <Text style={s.breathChooserEyebrow}>FREE BREATHWORK</Text>
              <Text style={s.breathChooserTitle}>Choose a state.</Text>
              <Text style={s.breathChooserSub}>
                Five techniques. Always free.
              </Text>
              <View style={s.breathChooserList}>
                {BREATHWORK_CHOOSER.map((opt) => {
                  const modeMeta = getModeMeta(opt.mode);
                  return (
                    <Pressable
                      key={opt.mode}
                      style={s.breathChooserRow}
                      onPress={() => {
                        setBreathChooserOpen(false);
                        router.push(
                          `/bracelet-control?mode=${opt.mode}&breathwork=1&from=bracelet` as never,
                        );
                      }}
                      accessibilityLabel={`Open ${opt.purpose} breathwork — ${opt.technique}`}
                    >
                      <View
                        style={[
                          s.breathChooserDot,
                          { backgroundColor: modeMeta.color },
                        ]}
                      />
                      <View style={s.breathChooserRowText}>
                        <Text style={s.breathChooserRowPurpose}>
                          {opt.purpose}
                        </Text>
                        <Text style={s.breathChooserRowMeta}>
                          {opt.technique} · {opt.minutes} min
                        </Text>
                      </View>
                      <Text style={s.breathChooserRowArrow}>→</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
  },
  scroll: { padding: 16, paddingBottom: 48 },

  /* ── Personalisatie-banners (top van pagina, conditional) ──
     Apple-style: fill-only (geen borders), grotere radius, ruimere
     padding. Pro-banner subtiel, owner-banner prominenter. */
  /* Iter v180 (2026-07-02): pro-banner opgeschoond — gecentreerde tekst,
     ruimere padding, subtiele border voor definitie. Operator-feedback:
     "Reserved for VIBEZCORE members" mag mooier + gecentreerd. */
  proBanner: {
    backgroundColor: 'rgba(58,143,255,0.10)',
    borderColor: 'rgba(58,143,255,0.28)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBannerText: {
    color: Brand.accent,
    fontSize: 13.5,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  /* Owner-eyebrow (iter 9t) — vervangt hero voor owners. Klein,
     "you are here"-style, geen marketing-vibe. */
  ownerEyebrow: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.4,
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
    backgroundColor: Brand.success,
  },
  ownerTitle: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
  },
  ownerSub: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  ownerArrow: {
    color: Brand.success,
    fontSize: 24,
    fontFamily: BrandFonts.medium,
  },
  signInLink: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  signInLinkText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
  },
  signInLinkAccent: {
    color: Brand.accent,
    fontFamily: BrandFonts.semibold,
  },
  /* Iter v190 (2026-07-02): Learn-more upgraded van inline text-link naar
     volwaardige card (parallel aan Activate card boven). Border-tint iets
     lichter dan Activate zodat hiërarchie duidelijk blijft (Activate =
     primair, Learn more = secundair). */
  learnMoreCard: {
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
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
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  learnMoreCardLabel: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.15,
    marginBottom: 4,
    lineHeight: 20,
  },
  learnMoreCardSub: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    lineHeight: 17,
  },
  learnMoreCardArrow: {
    color: 'rgba(255,255,255,0.60)',
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
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderRadius: 18,
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
  breathDiscoverCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: Brand.accent,
    borderRadius: 100,
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
    color: Brand.accent,
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
  landingTitle: {
    color: Brand.text,
    fontSize: 36,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.8,
    lineHeight: 40,
    marginBottom: 10,
    textAlign: 'center',
  },
  landingSub: {
    color: Brand.textDim,
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
  landingBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.accent,
  },
  landingBulletText: {
    color: Brand.text,
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
    color: Brand.accent,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
  },
  landingKsBadge: {
    backgroundColor: 'rgba(255,159,10,0.14)',
    borderColor: 'rgba(255,159,10,0.45)',
    borderWidth: 1,
    borderRadius: 4,
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
    backgroundColor: Brand.accent,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  landingCtaText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  landingCtaArrow: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    lineHeight: 20,
  },
  /* Iter 9dg (2026-05-31): tightere CTA-variant — kleinere marginTop
     zodat 'ie hoger op het scherm landt, dichter tegen de bracelet. */
  landingCtaTight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Brand.accent,
    borderRadius: 14,
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
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },

  /* Iter 9cz → 9db (2026-05-31): paddingBottom 4 → 0 zodat de hero-
     tekst MAX dicht tegen de bracelet komt. */
  hero: { paddingTop: 28, paddingBottom: 0, paddingHorizontal: 4 },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  heroEarlyBird: {
    backgroundColor: 'rgba(255,159,10,0.14)',
    borderColor: 'rgba(255,159,10,0.45)',
    borderWidth: 1,
    borderRadius: 4,
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
    backgroundColor: 'rgba(58,143,255,0.12)',
    borderColor: 'rgba(58,143,255,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 16,
  },
  heroMicroCtaText: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  heroMicroCtaArrow: {
    color: Brand.accent,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    lineHeight: 16,
  },
  heroEyebrow: {
    color: Brand.accent,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: Brand.text,
    fontSize: 38,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.9,
    lineHeight: 42,
    marginBottom: 14,
  },
  heroSub: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 23,
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
    borderColor: 'rgba(255,255,255,0.08)',
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
    borderColor: Brand.accent,
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
    backgroundColor: Brand.accent,
    top: '50%',
    left: '50%',
    /* Iter 9da → 9dc: marginTop 30 → 18 terug, samen met de sonar-ring
       (zelfde reden: 3mm-drop hoorde bij wrap 360, met wrap 280 valt
       'ie buiten de HapticCore positie). */
    marginTop: 18,
    marginLeft: -2,
    shadowColor: Brand.accent,
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
  sectionTitle: {
    color: Brand.text,
    fontSize: 32,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.8,
    lineHeight: 36,
    marginTop: 56,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionSub: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 23,
    marginBottom: 20,
    paddingHorizontal: 4,
  },

  /* ── Universal content-card (story-card + future use) ──
     Eén card-style voor body-content na een pill/tab-selectie. */
  uCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 22,
    padding: 22,
  },
  uCardEyebrow: {
    color: Brand.accent,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  uCardTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  uCardBody: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 23,
    marginBottom: 16,
  },

  /* ── Carousel (How-it-works + Modes) ──
     Apple iPhone-page-style swipe-carousel. carouselWrap brikt uit de
     page-padding (marginHorizontal -16) zodat de ScrollView de hele
     scherm-breedte krijgt. Cards binnenin hebben hun eigen width
     (CARD_WIDTH constant) zodat snapToInterval per card werkt. Dot-
     row eronder als positie-indicator + tappable jump-target.

     Apple Photos / iPhone-pages doen dit zo: peek van de volgende
     card (~26px zichtbaar) is signal voor "er is meer". */
  carouselWrap: {
    marginHorizontal: -SIDE_INSET,
    marginBottom: 18,
  },
  carouselCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 22,
    /* Iter 9dq v80 (2026-06-03): padding verplaatst naar modeCardContent
       zodat de foto-header edge-to-edge kan zonder margin. overflow:hidden
       cliped de foto netjes binnen de afgeronde hoeken. */
    overflow: 'hidden',
  },
  /* Foto-header bovenaan elke mode-card (iter 9dq v80 → v81 → v82).
     Vaste hoogte zodat carousel-cards visueel uitgelijnd blijven
     ongeacht foto-aspect-ratio.
     v82: 110 → 180 nadat operator de head-tekst weghaalde — body alleen
     is veel compacter dan head+body, dus we kunnen de foto laten domineren
     zonder de card hoger te maken dan vorige versie. */
  modePhotoWrap: {
    height: 180,
    width: '100%',
    position: 'relative',
  },
  modePhoto: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  /* Content-overlay op de foto: mode-naam + direction · duration.
     Absolute bottom-left, witte tekst over de dark-gradient. */
  modePhotoOverlayContent: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  /* Inner content (head, body, ideal-list) onder de foto.
     Padding 22 → 18 voor compactere cards (iter 9dq v81). */
  modeCardContent: {
    padding: 18,
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
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  dotOn: {
    backgroundColor: Brand.text,
    width: 22,  /* active dot iets breder = Apple-style indicator */
  },

  /* ── Story pills (How it works, HTML-mockup style) ──
     Capsule-pills met witte fill als actief (hoog contrast, voelt
     "click-y"), subtiele grijs als inactief. Flex-wrap zodat alle 7
     pills passen op 2-3 rijen ipv horizontale scroll. */
  /* Iter 9: pill-cloud weggehaald → horizontale tab-bar met underline-
     indicator (Apple iOS-style segmented nav). Geeft een rustigere
     hierarchy zonder pill-wrapping over 2-3 regels. */
  storyTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20, // matches root padding zodat eerste/laatste tab niet plakt
    paddingBottom: 4,
    gap: 22,
    alignItems: 'flex-end',
  },
  storyTab: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  storyTabText: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  storyTabTextOn: {
    color: Brand.text,
    fontFamily: BrandFonts.bold,
  },
  storyTabUnderline: {
    marginTop: 6,
    height: 2,
    backgroundColor: Brand.text,
    borderRadius: 1,
    alignSelf: 'stretch',
  },
  /* Dot-pagination onder de tab-bar (matches modeCarousel dotRow). */
  storyDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 18,
  },
  storyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  storyDotOn: {
    backgroundColor: Brand.text,
    width: 18,
    borderRadius: 3,
  },

  /* ── Story-card (content panel onder de pills) ──
     Number-eyebrow in accent, grote titel, body met VERTICALE BLAUWE
     LIJN links (visual anchor uit de HTML-mockup), blauwe gefulde
     tags onderaan (geen glass-chips hier — operator wil blue-fill). */
  /* Iter 9ci (2026-05-31): Apple-stijl strakkere story-card.
     Vroeger: subtiele card-fill + blue left-border op body (bloggy).
     Nu: cleane card zonder left-border, body krijgt rustige line-height
     en gedimde tekst-kleur voor leesbaarheid zonder over te nemen. */
  storyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  storyNum: {
    color: Brand.accent,
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.5,
    marginBottom: 10,
  },
  /* Iter 9ci: title 22→26 voor sterker Apple-style "headline" gevoel. */
  storyTitle: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.6,
    lineHeight: 30,
    marginBottom: 14,
  },
  /* Iter 9ci: clean body zonder left-border. Iets gedimde tekst (90%)
     zodat 't de titel niet visueel weg-concurreert. */
  storyBody: {
    color: 'rgba(244,244,244,0.85)',
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 23,
    marginBottom: 18,
  },
  /* Iter 9: pill-tags weggehaald → dot-separated text. Past bij modeWave-
     pattern verderop in deze file (consistente "spec-line"-stijl). */
  storySpecLine: {
    color: Brand.accent,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
    marginTop: 4,
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
    color: Brand.textDim,
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
    backgroundColor: 'rgba(58,143,255,0.14)',
    borderColor: 'rgba(58,143,255,0.40)',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  previewCtaContent: {
    flex: 1,
  },
  previewCtaEyebrow: {
    color: Brand.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.0,
    marginBottom: 6,
  },
  previewCtaTitle: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  previewCtaSub: {
    color: 'rgba(244,244,244,0.65)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    lineHeight: 17,
    letterSpacing: 0.1,
  },
  previewCtaArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCtaArrowText: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: BrandFonts.bold,
    lineHeight: 22,
  },
  /* Iter v193 (2026-07-03): Oura-style compact CTAs direct onder previewCta.
     Grote gevulde primary knop voor Activate, kleine text-link eronder voor
     Learn more. Verrangt de 2 grote cards die vroeger onderaan de bracelet
     preview stonden (na KS pricing) — die stonden te ver van de context en
     voelden druk aan. */
  compactActivateBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.accent,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  compactActivateBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.2,
  },
  compactActivateBtnArrow: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    lineHeight: 20,
    marginTop: -1,
  },
  compactLearnMoreLink: {
    marginTop: 12,
    marginBottom: 4,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  compactLearnMoreLinkText: {
    color: 'rgba(244,244,244,0.65)',
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
  },
  /* Legacy previewBtn (iter 9o) — niet meer in JSX gebruikt, behouden
     voor referentie/rollback. */
  previewBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  previewBtnText: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  previewBtnArrow: {
    color: Brand.accent,
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  tagText: {
    color: Brand.text,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },

  /* ── Mode content-card (binnen uCard) ──
     Header met kleur-dot + naam-stack, body met head + desc + ideal-
     tags. Cards zelf gebruiken uCard. */
  modeHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  modeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modeWave: {
    /* `modeWave` heet historisch zo — toont nu state-direction +
       duration, NIET de brain-state-wave (CLAUDE.md §1). Style blijft
       om refactor-noise te beperken. */
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  modeHead: {
    color: Brand.text,
    fontSize: 16,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
    lineHeight: 22,
    marginBottom: 8,
  },
  modeIdealLbl: {
    color: Brand.accent,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  /* Ideal-tags: identiek aan algemene `tag`-style (glass-chip).
     Operator-keuze 2026-05-26: blauwe fill voelde verouderd + creëerde
     blue-on-blue verzadiging in Calm Control / Boost cards. Tags zijn
     nu neutraal; de accent-kleur blijft alleen op het IDEAL FOR-label
     en de mode-dot — dat geeft hiërarchie zonder blue-soup. */
  /* Iter 9: pill-row "Ideal for" → verticale ✓ checklist (Apple Health-
     achtige presentatie). Voelt meer als feature-bullet dan pill. */
  idealList: {
    marginTop: 4,
    gap: 8,
  },
  idealItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  idealCheck: {
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    marginRight: 10,
    lineHeight: 20,
  },
  idealItemText: {
    flex: 1,
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
    lineHeight: 20,
  },

  /* ── 5. Specs (hero + 2x2 grid) ──
     Operator-feedback 2026-05-26 iter 2: typografische lijst was te
     saai. Nu: hero-card met 5 mode-kleur-dots (visuele callback
     naar Modes-sectie) + 2x2 grid van overige specs. */

  /* Hero spec — featured met blauwe tint, 5 colored dots als visueel
     anker. Maakt connectie met de Modes-sectie eerder (zelfde kleuren). */
  specHero: {
    backgroundColor: 'rgba(58,143,255,0.08)',
    borderRadius: 22,
    padding: 26,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.20)',
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
    color: Brand.text,
    fontSize: 28,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.7,
    marginBottom: 8,
  },
  specHeroLbl: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
  },

  /* Grid 2x2 voor de overige 4 specs (wrist, bead, bt, usb). Werkt
     via explicit row-pairing: specsGrid is verticaal (rows stacken),
     specRow horizontaal (2 cards per row, flex:1 elk → exact 50/50). */
  specsGrid: {
    gap: 10,
  },
  specRow: {
    flexDirection: 'row',
    gap: 10,
  },
  specCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 22,
  },
  specVal: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  specLbl: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  /* ── 6. Collection ──
     Series-tabs als Apple-style segmented control: outer container met
     subtiele fill, selected pill krijgt een eigen fill (geen borders).
     Net iOS' UISegmentedControl. */
  serTabsWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  serTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
    backgroundColor: 'transparent',
  },
  serTabText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  /* Edition-cards: tonale bg, geen border, grotere radius, subtle
     accent-glow op selected ipv harde border. */
  collGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  collCard: {
    /* Card-styling iter 3 (operator-feedback 2026-05-26): image moet
       edge-to-edge naar tekst lopen — geen padding rondom image, geen
       bottom-rounded gap. Card's overflow:hidden + borderRadius clipt
       automatisch de TOP corners van de image om bij de card-shape te
       passen; BOTTOM van image is square en sluit naadloos aan op
       het tekst-blok eronder. Subtiele border (10% wit) omkadert het
       geheel zodat de card als één duidelijke unit voelt. */
    flexBasis: '48%',
    backgroundColor: Brand.panel,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  /* Selected-state op grid-card: subtiel, geen ugly blue tint meer.
     Sinds 2026-05-26 verschijnt de detail-popup als overlay; de
     onderliggende card is dus toch niet zichtbaar tijdens selectie.
     We laten alleen een fijne accent-rand achter zodat user — nadat
     popup gesloten is — herkent welke 'ie tapped had. */
  collCardOn: {
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.6)',
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
       overlay. Brand.bg matched de rest van de app. */
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Brand.bg,
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
  collName: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  collNat: {
    color: Brand.textDim,
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
       Brand.panel #1e1e1e is de standaard card-kleur op dark mode.
       Iter 9ay (2026-05-31): shadow van Brand.accent (blauw) → #000.
       De blauwe glow rondom voelde gimmicky. Nu een neutrale subtiele
       drop-shadow met lichte downward offset = standaard modal-depth
       zonder kleur-afleiding. */
    backgroundColor: Brand.panel,
    borderRadius: 24,
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
    borderRadius: 8,
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
  detailName: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.6,
    marginTop: 12,
  },
  detailNat: {
    color: Brand.textDim,
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
    color: Brand.text,
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
    color: Brand.textDim,
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
    borderRadius: 14,
    padding: 12,
  },
  detailSpecLbl: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  detailSpecVal: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
  },
  detailClose: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailCloseText: {
    color: Brand.text,
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
    backgroundColor: Brand.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    paddingTop: 24,
  },

  /* Featured Bundle — nested card binnen ksCard, blue tint + accent
     border om visueel meest prominent te zijn. */
  ksFeatured: {
    backgroundColor: 'rgba(58,143,255,0.10)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.40)',
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
    backgroundColor: Brand.accent,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  ksFeatBadgeText: {
    color: Brand.accent,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginTop: 14,
  },

  /* EXTRA BRACELET — compact add-on, eigen nested card met horizontale
     layout (tekst links, prijs rechts). Net iets compactere padding
     dan de full options zodat 'ie visueel "tussendoor"-gewicht heeft. */
  ksAddon: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 14,
  },
  ksAddonName: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  ksAddonSub: {
    color: Brand.textDim,
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

  /* Hairline — gebruikt op meerdere plaatsen binnen ksCard. */
  ksHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 16,
  },

  /* Shared eyebrow + name styles voor de option-secties. */
  ksEyebrow: {
    color: Brand.accent,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  ksName: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  ksIncludesLbl: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.8,
    marginBottom: 12,
    textTransform: 'uppercase',
  },

  /* Price row + meta (shared across all 3 options). */
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    flexWrap: 'wrap',
  },
  priceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceMain: {
    color: Brand.text,
    fontSize: 34,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.9,
    lineHeight: 38,
  },
  priceMainSmall: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  priceOld: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    textDecorationLine: 'line-through',
  },
  /* Iter v218 (2026-07-04): EUR-conversie hint onder USD-hoofdprijs.
     Subtiel, gedimd, klein — communiceert "voor EU-context, niet
     de betaalprijs op KS". */
  priceEur: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  /* Iter 9: priceSave-pill weggehaald, vervangen door inline text
     "$399 · save $184" met success-kleur op het save-deel. iOS-style
     inline-pricing-pattern, geen meer pill. */
  priceSaveInline: {
    color: Brand.success,
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
    backgroundColor: Brand.accent,
    borderRadius: 14,
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
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Brand.accent,
  },
  ksBtnSecondaryText: {
    color: Brand.accent,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  ksBtnSecondaryArrow: {
    color: Brand.accent,
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
    borderTopColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  /* Iter 9ba (2026-05-31): textAlign center voor multi-line breaks.
     alignItems center op de parent centreert het Text-element als blok,
     maar lange regels die wrappen vielen alsnog naar links. textAlign
     center zorgt dat elke gewrapte regel zelf óók centered staat. */
  ksFooterText: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    textAlign: 'center',
    marginBottom: 6,
  },
  ksFooterMeta: {
    color: Brand.textDim,
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
  activateBraceletEntry: {
    marginTop: 22,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(58,143,255,0.55)',
    backgroundColor: 'rgba(58,143,255,0.10)',
    shadowColor: '#3a8fff',
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
    color: Brand.accent,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  activateBraceletEntryLabel: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.2,
    marginBottom: 4,
    lineHeight: 22,
  },
  activateBraceletEntryTitle: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  activateBraceletEntryArrow: {
    color: Brand.accent,
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
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
  },
  previewBraceletEntryLink: {
    color: Brand.accent,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
  },

  /* ── 8. Countdown (Apple-style: warmer accent-tint ipv hard navy,
        ruimere blocks, prominentere numerieken) ── */
  timerWrap: {
    marginTop: 16,
    backgroundColor: 'rgba(58,143,255,0.10)',
    borderRadius: 24,
    padding: 20,
  },
  timerLabel: {
    color: Brand.accent,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  timerBlocks: { flexDirection: 'row', gap: 8 },
  tBlock: {
    flex: 1,
    backgroundColor: 'rgba(58,143,255,0.22)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tNum: {
    color: '#ffffff',
    fontSize: 28,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.8,
  },
  tLbl: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.6,
    marginTop: 4,
  },
  timerLive: {
    color: Brand.success,
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
    textAlign: 'center',
    paddingVertical: 10,
  },

  /* ── 9. Waitlist (Apple-card + softere CTA met subtle shadow) ── */
  wlCard: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 24,
  },
  wlTitle: {
    color: Brand.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  wlSub: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    marginBottom: 18,
  },
  wlChecklist: { gap: 10, marginBottom: 20 },
  wlCheck: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
  },
  wlBtn: {
    backgroundColor: Brand.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: Brand.accent,
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
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    lineHeight: 17,
  },

  /* Free Breathwork chooser modal — Apple-stijl bottom sheet. Volledige
     stijl-set hier (geen pillarModal-hergebruik beschikbaar in dit
     bestand). Donker oppervlak, handle bovenaan, close ✕ rechtsboven,
     5 rows. Identiek visueel aan de Audio tab versie. */
  breathChooserModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  breathChooserSheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  breathChooserHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  breathChooserClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathChooserCloseText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    lineHeight: 16,
  },
  breathChooserEyebrow: {
    color: Brand.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  breathChooserTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.6,
    lineHeight: 30,
    marginBottom: 6,
  },
  breathChooserSub: {
    color: 'rgba(255,255,255,0.55)',
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
    borderColor: 'rgba(255,255,255,0.10)',
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
    color: '#ffffff',
    fontSize: 17,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  breathChooserRowMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0,
    lineHeight: 18,
  },
  breathChooserRowArrow: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 18,
    fontFamily: BrandFonts.semibold,
    lineHeight: 20,
    flexShrink: 0,
  },
});
