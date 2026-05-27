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
     8. Countdown — naar Kickstarter 1 augustus 2026
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

import { Brand, BrandFonts } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';
import { getToken } from '@/services/auth';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Image,
  LayoutAnimation,
  Linking,
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
import { SafeAreaView } from 'react-native-safe-area-context';

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
const RENDER_URL = `${CDN}/vzc-bracelet.png`;

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

/* Kickstarter-target. CLAUDE.md §3 zegt 1 augustus 2026. Datum/tijd in
   lokale tijd (geen 'Z'-suffix) — countdown-cosmetica, geen kritieke
   precisie. */
const KICKSTARTER_TARGET = new Date('2026-08-01T00:00:00').getTime();

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
const PEEK = 26;
const CARD_GAP = 10;
const CARD_WIDTH = SCREEN_WIDTH - SIDE_INSET * 2 - PEEK;
const CARD_SNAP = CARD_WIDTH + CARD_GAP;

/* Series-badge-kleuren. Pure = neutraal grijs (sober), Premium = blauw
   (accent), Imperial = goud (premium-vibe). Zelfde palet-logica als de
   HTML-mockup, maar met onze Brand-tokens waar mogelijk. */
const SERIES_COLORS = {
  pure: { bg: 'rgba(255,255,255,0.06)', text: '#bdbdbd' },
  premium: { bg: 'rgba(58,143,255,0.18)', text: '#3a8fff' },
  imperial: { bg: 'rgba(212,163,90,0.18)', text: '#d4a35a' },
} as const;

/* ── Data: 7-step story (How it works) ──────────────────────────────────── */

type Step = { n: string; title: string; body: string; tags: string[] };

const STORY: Step[] = [
  {
    n: '01',
    title: 'What is it',
    body:
      'A modular Bead Bracelet built around a single intelligent core — the HapticCore. Swap bead sets to shift your look. One core. Many identities.',
    tags: ['HapticCore', '15 Editions', '8mm Beads'],
  },
  {
    n: '02',
    title: 'How it works',
    body:
      'The HapticCore delivers precisely calibrated pulses designed to guide your nervous system toward calm or focus. Most users notice a shift within 15 to 30 minutes — subtle, but felt.',
    tags: ['Haptic Technology', '15–30 min', 'Bottom-up regulation'],
  },
  {
    n: '03',
    title: 'The intelligence inside',
    body:
      'At the center of every bracelet sits the HapticCore — a precision haptic engine grounded in applied neuroscience. It delivers calibrated pulses to your wrist, influencing your internal state in real time. No screen. No notification. Just direct, physical regulation. As the body stabilizes, the mind follows.',
    tags: ['Bluetooth 5.0', 'USB-C', 'VIBEZCORE App'],
  },
  {
    n: '04',
    title: 'Materials & build',
    body:
      'Every bracelet is assembled by hand, one at a time. Crafted from premium natural 8mm gemstones and finished with a precision-engineered closure. No two stones are ever alike — each carries its own natural character.',
    tags: ['Hand-assembled', 'Natural Gemstone', '925 Sterling Silver'],
  },
  {
    n: '05',
    title: 'Interchangeable',
    body:
      'The bead set clicks in and out with a unique locking system — no tools, no effort. One HapticCore. Fifteen gemstone editions. Switch your stone to match your energy, your style, or your state of mind.',
    tags: ['Click system', '15 Editions', 'No tools needed'],
  },
  {
    n: '06',
    title: 'Made for you',
    body:
      'Yours, in every sense. Individually sized to your wrist — from 16 to 21 cm. You select the gemstone. Not a product off a shelf — a piece built around you, from fit to finish.',
    tags: ['16–21 cm', '6.3"–8.3"', 'Personally configured'],
  },
  {
    n: '07',
    title: 'Guide your state',
    body:
      'The HapticCore delivers precisely calibrated pulses designed to guide your nervous system toward calm or focus. Under pressure it guides you toward calm. In motion it supports deeper focus. Most users notice a shift within 15 to 30 minutes.',
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

const MODES: Mode[] = [
  {
    app: 'Boost',
    wave: 'Gamma',
    duration: '8–15 min',
    color: '#FF453A',
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
    color: '#30D158',
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
  { val: 'USB-C', lbl: 'Charging' },
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
   USD tonen — eenvoudiger, Kickstarter is USD-first). Bundle-prijs
   gewijzigd $209 → $219 (operator-correctie); save-bedrag herberekend
   tov originele $483 sum-of-parts. */
type PriceRow = { main: string; old: string; save: string };
type PriceSet = {
  bracelet: PriceRow;
  bundle: PriceRow;
  extra: PriceRow;
};
const PRICING: PriceSet = {
  bracelet: { main: '$159', old: '$299', save: 'Save $140' },
  bundle: { main: '$219', old: '$483', save: 'Save $264' },
  extra: { main: '$24.90', old: '$42', save: 'Save $17' },
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
  console.log('[VIBEZCORE] bracelet openExternal →', url);
  try {
    const result = await WebBrowser.openBrowserAsync(url);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      console.log('[VIBEZCORE] WebBrowser cancelled — fallback Linking');
      await Linking.openURL(url);
    }
  } catch (e) {
    console.log('[VIBEZCORE] WebBrowser threw — fallback Linking:', e);
    await Linking.openURL(url);
  }
}

/* ── Bracelet-render with sonar rings ───────────────────────────────────── */

/* Drie pulsende ringen, gefaseerd met 1s delay. Elke ring fade-out
   tegelijk met scale-up — geeft de "uitstralende energie"-look uit
   de HTML-mockup zonder GIF. useNativeDriver=true zodat de JS-thread
   vrij blijft tijdens scroll. */
function SonarRender() {
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

  return (
    <View style={s.renderWrap}>
      {/* Z-order via JSX-volgorde: image eerst (achtergrond), rings
          + dot ná (= bovenop). Sinds operator-iter 2 vult de witte
          PNG-bg de hele wrapper, dus rings achter de image waren
          onzichtbaar. */}
      <Image
        source={{ uri: RENDER_URL }}
        style={s.renderImg}
        resizeMode="contain"
        resizeMethod="resize"
        fadeDuration={0}
      />
      <Animated.View style={[s.sonarRing, ringStyle(ring1)]} />
      <Animated.View style={[s.sonarRing, ringStyle(ring2)]} />
      {/* HapticCore-glow — pulserend midden in de rings. Double-beat
          animatie geeft het hart-ritme-gevoel. Transform alleen scale —
          centrering doen marginLeft/marginTop. */}
      <Animated.View
        style={[
          s.coreDot,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
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
function renderDetailPanel(ed: Edition, onClose: () => void) {
  const sp = splitDesc(ed.desc);
  const c = SERIES_COLORS[ed.series];
  return (
    <View style={s.detail}>
      <View style={s.detailImgWrap}>
        <Image
          source={{ uri: ed.image }}
          style={s.detailImg}
          resizeMode="cover"
          resizeMethod="resize"
          fadeDuration={0}
        />
      </View>
      <View style={s.detailBody}>
        <View
          style={[
            s.collBadge,
            {
              alignSelf: 'flex-start',
              backgroundColor: c.bg,
            },
          ]}
        >
          <Text style={[s.collBadgeText, { color: c.text }]}>
            {ed.series.toUpperCase()} SERIES
          </Text>
        </View>
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
            <Text style={s.detailSpecLbl}>Series</Text>
            <Text style={s.detailSpecVal}>
              {ed.series.charAt(0).toUpperCase() + ed.series.slice(1)}
            </Text>
          </View>
          <View style={s.detailSpec}>
            <Text style={s.detailSpecLbl}>Sizes</Text>
            <Text style={s.detailSpecVal}>16–21 cm</Text>
          </View>
        </View>
        <Pressable
          style={s.detailClose}
          onPress={onClose}
          accessibilityLabel="Close edition details"
        >
          <Text style={s.detailCloseText}>✕  Close</Text>
        </Pressable>
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
     owner, dus de owner-banner toont nooit. Veilige default. */
  const isBraceletOwner = false;

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

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <ScrollView
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

        {/* ── 1. HERO-TEKST (operator-besluit 2026-05-25, optie A:
            tekst-blok bovenop, render eronder, geen wrist-foto) ── */}
        <View style={s.hero}>
          <Text style={s.heroEyebrow}>
            KICKSTARTER — 1 AUGUST 2026
          </Text>
          <Text style={s.heroTitle}>
            VibeZCore{'\n'}Smart Bead Bracelet
          </Text>
          <Text style={s.heroSub}>
            5 haptic modes. One clear outcome.{'\n'}
            You in control of your own state.
          </Text>
        </View>

        {/* ── 2. BRACELET-RENDER met sonar-rings ── */}
        <SonarRender />

        {/* ── PREVIEW-KNOP ──────────────────────────────────────────────
            BLAUWDRUK §5: "Preview-knop bediening (besluit eigenaar):
            toont de echte knoppen/UI van het bedienscherm zonder echte
            bracelet." Zichtbaar voor IEDEREEN — gast/free/pro/owner.
            Voor owners is dit de echte bediening; voor anderen een
            preview/demo van wat ze krijgen. Was tussentijds verwijderd
            bij modernisering — teruggezet 2026-05-26. */}
        <Pressable
          style={s.previewBtn}
          onPress={() => router.push('/bracelet-control')}
          android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
          accessibilityLabel="Preview the bracelet control screen"
        >
          <Text style={s.previewBtnText}>Preview the bracelet app</Text>
          <Text style={s.previewBtnArrow}>→</Text>
        </Pressable>

        {/* ── 3. HOW IT WORKS — pill-nav + story-card (HTML-mockup style).
            Operator-keuze 2026-05-26: terug naar pills voor déze
            sectie. De carousel was te onrustig; pills + statische
            content-card geeft een rustigere lees-ervaring. Pill-stijl
            uit de HTML: witte fill voor actief (hoog contrast), zeer
            subtiel grijs voor inactief. Story-card heeft een verticale
            blauwe lijn links van de body-tekst (visual anchor) en
            blauw-gefilde tags onderaan. */}
        <Text style={s.sectionTitle}>How it works.</Text>
        <View style={s.storyPills}>
          {STORY.map((step, i) => {
            const on = i === activePill;
            return (
              <Pressable
                key={step.n}
                onPress={() => setActivePill(i)}
                style={[s.storyPill, on && s.storyPillOn]}
                accessibilityLabel={`Show step: ${step.title}`}
              >
                <Text
                  style={[s.storyPillText, on && s.storyPillTextOn]}
                  numberOfLines={1}
                >
                  {step.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.storyCard}>
          <Text style={s.storyNum}>{STORY[activePill].n}</Text>
          <Text style={s.storyTitle}>{STORY[activePill].title}</Text>
          <Text style={s.storyBody}>{STORY[activePill].body}</Text>
          <View style={s.tagRow}>
            {STORY[activePill].tags.map((t) => (
              <View key={t} style={s.storyTag}>
                <Text style={s.storyTagText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

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
            {MODES.map((m, i) => (
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
                <View style={s.modeHdr}>
                  <View
                    style={[s.modeDot, { backgroundColor: m.color }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.uCardTitle, { marginBottom: 0 }]}>
                      {m.app}
                    </Text>
                    {/* "Direction · Duration" — geen wave-label
                        (CLAUDE.md §1). */}
                    <Text style={s.modeWave}>
                      {m.direction} · {m.duration}
                    </Text>
                  </View>
                </View>
                <Text style={s.modeHead}>{m.head}</Text>
                <Text style={s.uCardBody}>{m.body}</Text>
                <Text style={s.modeIdealLbl}>Ideal for</Text>
                <View style={s.tagRow}>
                  {m.ideal.map((t) => (
                    <View key={t} style={s.idealTag}>
                      <Text style={s.idealTagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
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

        {/* ── 6. THE COLLECTION — 3 series-secties achter elkaar,
            alle 15 editions zichtbaar. Geen tabs meer (Apple/Linear-
            style scroll: één lange leesvolgorde). */}
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
                accessibilityLabel={`Show ${sr} series`}
              >
                <Text
                  style={[
                    s.tabText,
                    on && { color: c.text, fontFamily: BrandFonts.semibold },
                  ]}
                >
                  {sr.charAt(0).toUpperCase() + sr.slice(1)}
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
                      {ed.series.charAt(0).toUpperCase() + ed.series.slice(1)}
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

        {/* ── 7. KICKSTARTER EARLY BIRD — alles binnen één container ──
            Operator-feedback 2026-05-26: 3 losse cards voelden los
            van elkaar. Nu één outer Kickstarter-card waarin titel,
            sub, 3 pricing-opties (Bundle featured genest, andere 2
            als sections gescheiden door hairlines), en footer netjes
            gegroepeerd staan. */}
        <Text style={s.sectionTitle}>Kickstarter early bird.</Text>
        <Text style={s.sectionSub}>
          Reserve your edition before launch. Locked-in pricing,
          no payment until campaign starts.
        </Text>

        <View style={s.ksCard}>
          {/* Operator-feedback iter 2 (2026-05-26): Bracelet Only en
              Add-on óók als aparte cards binnen de outer container —
              niet als plain text-sections. Alle 3 pricing-opties zijn
              nu visueel duidelijke eigen blokken met eigen styling. */}

          {/* FEATURED — Bundle, blue-tinted nested card, BEST VALUE
              badge. Krijgt visuele emphasis door blue accent. */}
          <View style={s.ksFeatured}>
            <View style={s.ksFeatBadge}>
              <Text style={s.ksFeatBadgeText}>BEST VALUE</Text>
            </View>
            <Text style={s.ksEyebrow}>FULL BUNDLE</Text>
            <Text style={s.ksName}>
              Bracelet + Extra + Audio Library
            </Text>
            <View style={s.priceRow}>
              <Text style={s.priceMain}>{price.bundle.main}</Text>
              <View style={s.priceMeta}>
                <Text style={s.priceOld}>{price.bundle.old}</Text>
                <View style={s.priceSave}>
                  <Text style={s.priceSaveText}>{price.bundle.save}</Text>
                </View>
              </View>
            </View>
            <View style={s.ksHairline} />
            <Text style={s.ksIncludesLbl}>What's included</Text>
            <View>
              <PIncluded text="VibeZCore Smart Bead Bracelet" />
              <PIncluded text="Extra Style Bracelet (8mm)" />
              <PIncluded text="12-Month Full Audio Library" />
              <PIncluded text="VibeZCore App access" />
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
            <Text style={s.ksName}>VibeZCore Smart Bead Bracelet</Text>
            <View style={s.priceRow}>
              <Text style={s.priceMain}>{price.bracelet.main}</Text>
              <View style={s.priceMeta}>
                <Text style={s.priceOld}>{price.bracelet.old}</Text>
                <View style={s.priceSave}>
                  <Text style={s.priceSaveText}>{price.bracelet.save}</Text>
                </View>
              </View>
            </View>
            <View style={s.ksHairline} />
            <Text style={s.ksIncludesLbl}>What's included</Text>
            <View>
              <PIncluded text="Smart Bead Bracelet (choice of stone)" />
              <PIncluded text="VibeZCore App access" />
              <PIncluded text="5 haptic modes" />
              <PIncluded text="USB-C charging cable" />
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
              <Text style={s.ksAddonName}>Additional Style Bracelet</Text>
              <Text style={s.ksAddonSub}>8mm beads · choice of stone</Text>
            </View>
            <View style={s.ksAddonPrice}>
              <Text style={s.priceMainSmall}>{price.extra.main}</Text>
              <View style={s.ksAddonMeta}>
                <Text style={s.priceOld}>{price.extra.old}</Text>
                <View style={s.priceSave}>
                  <Text style={s.priceSaveText}>{price.extra.save}</Text>
                </View>
              </View>
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

        {/* ── 8. COUNTDOWN ── */}
        <View style={s.timerWrap}>
          <Text style={s.timerLabel}>
            KICKSTARTER LAUNCH — 1 AUGUST 2026
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

        {/* Standalone Waitlist-sectie weggehaald 2026-05-26 iter 3:
            de per-product Reserve-CTA's in de Kickstarter pricing
            cards (Bundle + Bracelet) vervangen deze functioneel.
            De disclaimer "No credit card · No financial data..." zit
            nu in de Kickstarter-card footer. Sign-in-link blijft —
            verhuisd naar standalone block hieronder. */}

        {/* Sign-in-link voor wie nog niet ingelogd is. Subtiel, geen
            dominante CTA. Toont alleen wanneer state geladen is én
            user niet ingelogd. */}
        {isSignedIn === false && (
          <Pressable
            style={s.signInLink}
            onPress={() => router.navigate('/account')}
            accessibilityLabel="Sign in if you already have an account or activation code"
          >
            <Text style={s.signInLinkText}>
              Have an activation code?{' '}
              <Text style={s.signInLinkAccent}>Sign in →</Text>
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ── Edition-detail overlay ──────────────────────────────────────
          Floating popup BOVENOP de pagina, centraal gepositioneerd —
          user hoeft niet meer naar onder te scrollen om 't paneel te
          zien. Backdrop tap = sluiten. Android hardware-back = sluiten.

          Geen RN <Modal>-wrapper bewust: die heeft een eigen native
          window die alle touches opvangt, breekt de tab-bar onderaan.
          Zelfde pattern als WelcomeBackPopup / BraceletUpsellModal. */}
      {detailEdition && (
        <View style={s.detailOverlay} pointerEvents="box-none">
          <Pressable
            style={s.detailBackdrop}
            onPress={() => setSelectedEdition(null)}
          />
          <View style={s.detailWrap}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {renderDetailPanel(detailEdition, () =>
                setSelectedEdition(null),
              )}
            </ScrollView>
          </View>
        </View>
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
  proBanner: {
    backgroundColor: 'rgba(58,143,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  proBannerText: {
    color: Brand.accent,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
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

  /* ── 1. Hero (Apple-style: tightere headline-letterspacing, ruimere
        sub, eyebrow in semibold ipv bold caps) ── */
  hero: { paddingVertical: 24, paddingHorizontal: 4 },
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
  renderWrap: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  sonarRing: {
    position: 'absolute',
    /* Base 30px → max ~105px na scale 3.5 — matched HTML-referentie
       (8% van container) en blijft binnen wrapper-frame. Border 1.5
       zoals HTML. Position 50%+20 onder wrapper-center (≈58% van
       hoogte, operator-gekozen via eerdere tuning). */
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: Brand.accent,
    top: '50%',
    left: '50%',
    /* center y = 50% + marginTop + halfHeight = 50% + 5 + 15 = 50% + 20 ✓ */
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
    marginTop: 18,
    marginLeft: -2,
    shadowColor: Brand.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
  },
  renderImg: {
    /* Bracelet vult nu de hele wrapper-breedte; de PNG z'n witte
       achtergrond = de card-binnenkant. Geen aparte borderRadius
       nodig op de image — `overflow:hidden` op de wrapper clipt al. */
    width: '100%',
    height: '100%',
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
    padding: 22,
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
  storyPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  storyPill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  storyPillOn: {
    backgroundColor: '#ffffff',
  },
  storyPillText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  storyPillTextOn: {
    color: '#000000',
    fontFamily: BrandFonts.semibold,
  },

  /* ── Story-card (content panel onder de pills) ──
     Number-eyebrow in accent, grote titel, body met VERTICALE BLAUWE
     LIJN links (visual anchor uit de HTML-mockup), blauwe gefulde
     tags onderaan (geen glass-chips hier — operator wil blue-fill). */
  storyCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 22,
    padding: 22,
  },
  storyNum: {
    color: Brand.accent,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  storyTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
    marginBottom: 16,
  },
  storyBody: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 23,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: Brand.accent,
    marginBottom: 18,
  },
  storyTag: {
    backgroundColor: 'rgba(58,143,255,0.18)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  storyTagText: {
    color: Brand.accent,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
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
  idealTag: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  idealTagText: {
    color: Brand.text,
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  detailWrap: {
    width: '88%',
    maxWidth: 420,
    maxHeight: '85%',
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
       Brand.panel #1e1e1e is de standaard card-kleur op dark mode. */
    backgroundColor: Brand.panel,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: Brand.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  detailImgWrap: {
    width: '100%',
    aspectRatio: 1.6,
    backgroundColor: '#0d0d0d',
  },
  detailImg: { width: '100%', height: '100%' },
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
  ksFeatBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: Brand.accent,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  ksFeatBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1,
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
  priceSave: {
    backgroundColor: 'rgba(74,222,128,0.18)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  priceSaveText: {
    color: Brand.success,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  ksFooterText: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    marginBottom: 4,
  },
  ksFooterMeta: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.2,
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
});
