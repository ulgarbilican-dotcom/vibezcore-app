import { openStateControl } from '@/utils/state-control-ui';
import VibezGlass from '@/components/VibezGlass';
import { GlassSheet } from '@/components/GlassSheetHost';
import { rootBlurRef } from '@/utils/root-blur';
import { AUDIO_ENABLED } from '@/constants/features';
import { AudioAccent, AudioAccentLight, BrandFonts, TypeScale } from '@/constants/theme';
import { MINI_PLAYER_HEIGHT } from '@/components/MiniPlayer';
import { bootDecided, useBootDecided } from '@/utils/boot';
import { BlurView } from 'expo-blur';
/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Audio Library (route /)

   ÉÉN doorlopende scrollpagina, conform BLAUWDRUK §3:
     HERO → 4-FASEN → BUILT ON + 4 PIJLERS → EMERSON → "EXPLORE SERIES"-header
       → DE LIBRARY (serie-kaarten, openklappen ter plekke, sessies, FREE/PRO)
       → SOUNDSCAPES (4 subcat-kaarten, standaard INGEKLAPT, blauwdruk §3.5b)
       → AANKOOPBLOK (Monthly/Yearly, OUR MISSION, GET FULL ACCESS → Gumroad)
         — bron index_2_correct.html regel 3746+ (blauwdruk §3.6).

   Bron voor het merk-/landing-deel: webapp index_2_correct.html (regels
   2682-2755). Bron voor de library-kaart + sessielijst + Soundscapes-subcat
   structuur: de bestaande library.tsx (overgenomen, niet opnieuw bedacht).
   ─────────────────────────────────────────────────────────────────────────── */

import { PlayPauseGlyph } from '@/components/PlayPauseGlyph';
import {
  getEffectiveTier,
  resolveAccess,
  tierBadgeColor,
  tierBadgeLabel,
} from '@/utils/access-tier';
import { useFavorites } from '@/hooks/useFavorites';
import { useSubscription } from '@/hooks/useSubscription';
import { useBraceletOwner } from '@/utils/dev-user-override';
import { getToken, hasStoredSession } from '@/services/auth';
import {
  getSnapshot,
  onSessionFinish,
  usePlayerState,
} from '@/services/audio-player';
import {
  hideBraceletUpsell,
  showBraceletUpsell,
  openBraceletWebsite,
} from '@/services/bracelet-upsell';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDashed,
  Lock,
  Shield,
} from 'lucide-react-native';
import {
  getEntryByUrl,
  getListenedLabelByUrl,
  useHistory,
} from '@/utils/history';
import { isNew } from '@/utils/isNew';
import { BREATHWORK_CHOOSER } from '@/data/breathwork-modes';
import { getModeMeta } from '@/services/ble-contract';
import { useGatedOpenSession } from '@/utils/openSession';
import { useShowableLastPlayed } from '@/utils/last-played';
import { showWelcomePopup } from '@/services/welcome-popup';
import { urlEq } from '@/utils/url-eq';
import { subscribeLibraryReset } from '@/utils/library-reset-intent';
import {
  consumeScrollIntent,
  requestScrollTo,
  subscribeScrollIntent,
} from '@/utils/scroll-intent';
import { useSetting } from '@/utils/settings';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Share2 } from 'lucide-react-native';
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
/* expo-web-browser was nodig voor de oude Gumroad-WebBrowser-flow.
   Iter 9dq v64: Gumroad-checkout vervangen door /subscribe (IAP). Indien
   ooit terug nodig (bv. een externe info-pagina openen): re-import. */
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
  ViewStyle,
} from 'react-native';

/* LayoutAnimation moet op Android expliciet aangezet worden (no-op op iOS).
   Eenmalige module-level side effect zodat de uitklap-animatie van de
   disclaimer onderaan deze pagina soepel werkt op beide platforms. */
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* Module-level flag voor cold-start redirect (operator 2026-05-30).
   Bracelet-owners landen automatisch op /bracelet bij eerste app-start
   ipv de default Audio Library tab — voor hen is Bracelet de belangrijkste
   tab. Eenmalige redirect per app-sessie: na de redirect kan user
   handmatig naar Audio Library tab (waar landing-page verschijnt). */
let braceletOwnerColdStartRedirected = false;
import {
  PILLAR_META,
  PILLAR_ORDER,
  SERIES,
  SERIES_FOCAL,
  SERIES_PHOTO,
  SERIES_PILLAR,
  SERIES_SUB,
  SERIES_SUBTITLE,
  SESSIONS,
  SUBCAT_INFO,
  SUBCAT_ORDER,
  type Session,
} from '../../data/audio-library-data';
import { hapticPress } from '@/utils/haptics';

/* Operator, 14 september 2026: "we zijn nu alles light mode aan het maken"
   — zelfde `DARK`/`LIGHT`/`light`-patroon als breath-setup.tsx/breath-
   session.tsx, zodat dark hier nooit weggegooid wordt, enkel uitgeschakeld.
   Licht-palet komt uit de vastgelegde app-brede beslissing (5 september
   2026): bg wit, tekst bijna-zwart, accent het warmere `#7FB2E5`
   ("moet warm aanvoelen niet techy") i.p.v. het hardere `#3a8fff` van
   dark. GROEN (voltooid) en de FREE-badge-tint blijven hun eigen rol
   spelen, enkel omgezet naar een op licht leesbare tint. */
const DARK = {
  bg: '#0a0a0a',
  surface: '#1C1C1E',
  text: '#ffffff',
  dim: 'rgba(255,255,255,0.5)',
  faint: 'rgba(255,255,255,0.32)',
  accent: AudioAccent, // 8 okt 2026: was Signal Blue — "bezig" = Bio-Teal
  arrow: 'rgba(58,143,255,0.7)',
  border: '#1a1a1a',
  /* Iter 2026-06-05: kleur-hiërarchie cleanup (operator-feedback).
     - WIT = default state (info, "vrij beschikbaar")
     - BLAUW (#3a8fff) = active state (playing, in progress)
     - GROEN (#4ade80) = completion state (fully listened) — alleen daar
     Vroeger was C.free groen — gaf te veel kleur overal. Nu witte tint
     met subtiele border zodat FREE-label nog informatie geeft zonder
     het accent-systeem te verwateren. */
  free: 'rgba(255,255,255,0.72)',
  rowBg: '#0d0d0d',
};
/* Operator, 14 september 2026: exacte huisstijl-tokens uit de website-
   stylesheet (VIBEZCORE Huisstijl & Design Handboek v4.0) — bg is het
   OFF-WHITE grondvlak (`--vc-bg`), `surface` het pure wit van kaarten die
   los moeten komen van dat grondvlak (`--vc-surface`), niet hetzelfde. */
const LIGHT = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  text: '#1D1D1F',
  dim: '#8E8E93',
  faint: 'rgba(10,10,12,0.32)',
  /* Operator, 26 september 2026: accentkleur-wissel (audio) — Audio
     Library valt onder de Bio-Teal-scope (zie player.tsx); was `#7FB2E5`. */
  accent: AudioAccent,
  arrow: 'rgba(127,178,229,0.85)',
  border: '#e5e5ea',
  free: 'rgba(10,10,12,0.6)',
  rowBg: '#FFFFFF',
};
/* Operator, 26 september 2026: dark is de nieuwe app-brede default (was
   light, 14 september). Zelfde hardcoded-schakelaar-patroon als toen —
   geen live theme-hook hier (zie DARK/LIGHT-comment hierboven), enkel de
   waarde omgezet. */
const light = false;
const C = light ? LIGHT : DARK;

/* Operator, 26 september 2026: Royal Indigo (`#1E2A4A`) bestaat niet meer
   als accentkleur — Bio-Teal is nu DE accentkleur, overal. Naam
   `ROYAL_INDIGO` blijft staan (scheelt een 22-plekken-rename in dit
   bestand), enkel de waarde verandert naar `AudioAccent`. Nieuwe code:
   gebruik gewoon `AudioAccent` direct, deze constante is legacy. */
const ROYAL_INDIGO = AudioAccent;
/* Zelfde reservering — enkel voor functionele signalen ("dit kan ik nu
   direct afspelen"), nooit als algemeen accent. */
/* Operator, 26 september 2026: accentkleur-wissel (audio) — Bio-Teal
   vervangt Signal Blue voor de "nu actief"-rol op dit scherm; was
   `#3A8FFF`. Naam SIGNAL_BLUE blijft staan (scheelt een grote rename),
   enkel de waarde verandert naar AudioAccent. */
const SIGNAL_BLUE = AudioAccent;
/* Operator, 26 september 2026 ("the father wound... andere blauw play
   button andere blauw"): de "nu actief aan het spelen"-gradients
   (play-icon-overlay, progress-fill) hardcodeerden elk hun EIGEN tweede
   gradient-stop (#2c7ae8 / #60a5fa / #5ba4ff — drie niet-matchende tinten
   naast elkaar op dezelfde kaart). Eén consistente hover-tint i.p.v. drie
   losse gokken.
   Operator, 26 september 2026: accentkleur-wissel (audio) — was
   `#2A7FEE` (BrandDark.accentHover), nu AudioAccentLight zodat de
   gradient binnen de nieuwe teal-familie blijft. */
const SIGNAL_BLUE_HOVER = AudioAccentLight;

/* Operator, 15 september 2026: vaste weergavevolgorde voor de 10 gratis
   sessies, dezelfde als op /library/free — deze "Free Picks"-lijst hier
   in de tab gebruikte tot nu toe gewoon de SESSIONS-volgorde (die de
   reeks-volgorde volgt, niet wat hier het beste leest). */
const FREE_ORDER = [
  'Identity',
  'The Inner Child',
  'The Father You Tried To Outdo',
  'The Love That Came With Conditions',
  'The Naive Eye That Costs You Everything',
  'Become a Monster',
  'Building Inner Strength & Discipline',
  'Theta Arabic Ritual',
  'Background Calm',
  'Delta Descent',
];

/* Operator, 14 september 2026: "kijk de kleuren van partly listened en
   free tekstkleur na" — `#4ade80` is een licht/pastel groen, gekozen
   toen dit tegen een bijna-zwarte achtergrond stond (hoog contrast
   daar). Op de nieuwe witte/off-white kaarten is datzelfde groen juist
   LAAG contrast — te licht om goed te lezen. Op light een verzadigder,
   donkerder groen (`BrandLight.success`); op dark blijft het
   oorspronkelijke pastelgroen. */
const GREEN = light ? '#16a34a' : '#4ade80';

/* Operator, 14 september 2026 (Apple-stijl herontwerp): flinterdunne,
   zachte schaduw om witte kaarten los te tillen van het off-white
   grondvlak — enkel toegepast in light (op een echt zwarte achtergrond
   voegt dit niets toe en oogt het vies i.p.v. subtiel). */
const SOFT_SHADOW = light
  ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
    }
  : null;

/* CDN — exact de host die de webapp gebruikt. */
const CDN = 'https://vibezcore-audio.b-cdn.net/images';

/* ── Pillar-grid afmetingen ────────────────────────────────────────────
   Operator, 26 september 2026: terug naar een 2-koloms rooster (was
   tussentijds een horizontale swipe-carrousel — zie git-historie voor
   die versie). De eerdere klacht tegen het grid ("Psychological" brak
   lelijk af over 2 regels) is inmiddels opgelost: de kaart-titel gebruikt
   al `adjustsFontSizeToFit`/`minimumFontScale` (zie de kaart-JSX), dus een
   lange naam krimpt nu netjes i.p.v. af te breken. */
const PILLAR_SIDE_INSET = 16;
/* Operator ("tussen de kaarten staat alles nu samengepropt, hoe zou
   apple dat doen"): 12 → 16 — Apple's gangbare spacing-unit voor een
   grid, geeft de kaarten letterlijk en visueel meer ademruimte. */
const PILLAR_CARD_GAP = 16;
const PILLAR_CARD_WIDTH = Math.round(
  (Dimensions.get('window').width - PILLAR_SIDE_INSET * 2 - PILLAR_CARD_GAP) / 2,
);
const PILLAR_CARD_HEIGHT = Math.round(PILLAR_CARD_WIDTH * 1.25);


/* Iter 9dq v150 (operator 2026-06-17): Gumroad-checkout URLs verwijderd
   uit de app. Checkout loopt via /subscribe → Apple StoreKit / Google
   Play Billing (IAP). Geen externe Gumroad-redirect meer. */

/* ── Bracelet-upsell-modal (post-session) configuratie ──
   AsyncStorage-key voor laatste-getoond-timestamp. Cooldown van 24u
   voorkomt dat de modal bij iedere voltooide sessie pop-upt (een
   power-user die 4 sessies achter elkaar doet ziet 'm dus 1×, niet 4×).
   80%-threshold filtert tracks waar didJustFinish vroeg fired door
   stream-artifacts (in praktijk fired didJustFinish alleen op natural
   end-of-file, dus dit is dubbele bodem).

   Trigger leeft in een useEffect die playerState.endedPanel watcht:
   wanneer het SESSION COMPLETE-paneel verschijnt (auto-play OFF) gaat
   de modal mee open. Bij auto-play ON wordt het paneel nooit gezet →
   geen modal (geen onderbreking van de flow). Modal sluit auto wanneer
   user Done of Play next tikt (endedPanel → null). */
const UPSELL_KEY = 'vzc_bracelet_upsell_shown';
const UPSELL_COOLDOWN_MS = 86_400_000; // 24u in ms
const UPSELL_COMPLETION_THRESHOLD = 0.8;
/* Auto-hide duration. Tunable — verlaag voor sneller verdwijnen,
   verhoog voor meer expose. 5000 (5s) is genoeg om visueel te
   registreren zonder blijvend over de player te hangen tijdens een
   nieuwe (auto-played) sessie. */
const UPSELL_AUTO_HIDE_MS = 5_000;

/* Pijlers — exact uit bron regel 2705-2738. Namen NIET wijzigen.
   Iter 9aaa: descriptions toegevoegd voor tap-to-popup detail. Apple-
   style no-nonsense — één declaratieve regel per pillar, state-taal
   per CLAUDE.md §1 (geen medical/scientific claims). */
/* Operator, 27 september 2026: nieuwe pijler-foto's — zelfde bron als
   PILLAR_META in audio-library-data.ts (single source is daar niet
   gebruikt: deze array is een eigen, losse kopie voor de grid-kaarten
   op deze tab, vandaar hier ook bijgewerkt). */
const PILLARS = [
  {
    num: '01',
    name: 'Psychological Resilience',
    key: 'resilience' as const,
    img: `${CDN}/pic%20psychological%20resillience.png`,
    desc: 'Build what cannot break.',
  },
  {
    num: '02',
    name: 'Inner Sovereignty',
    key: 'sovereignty' as const,
    img: `${CDN}/pic%20inner%20sovereignty%202.png`,
    desc: 'Master what is yours.',
  },
  {
    num: '03',
    name: 'Social Mastery',
    key: 'social' as const,
    img: `${CDN}/pic%20social%20mastery.png`,
    desc: 'Command without force.',
  },
  {
    num: '04',
    name: 'Strategic Execution & Wealth',
    key: 'drive' as const,
    img: `${CDN}/pic%20strategic%20execution.png`,
    desc: 'Engineer your autonomy.',
  },
  /* Iter 9dq v137 (operator 2026-06-15): Tools & Practices als 5e pillar-
     kaart in de UI. Stond al in PILLAR_META + SERIES_PILLAR (data-laag)
     met 2 series (Daily Affirmations Power, Soundscapes) maar werd niet
     gerenderd. Foto-URL op Bunny CDN aangeleverd door operator. */
  {
    num: '05',
    /* Operator, 27 september 2026: "Tools & Practices" → "Soundscapes &
       Affirmations" — duidelijker, beschrijft de 2 series direct i.p.v.
       een vage koepelterm. */
    name: 'Soundscapes & Affirmations',
    key: 'tools' as const,
    img: `${CDN}/pic%20soundscapes.png`,
    /* Iter v228 (2026-07-08): tagline concreet — operator: was te
       abstract, "Soundscapes and daily affirmations" beschrijft precies
       welke content in deze kaart zit. */
    desc: 'Soundscapes and daily affirmations.',
  },
];

/* Filter-pills + flat session-list voor Favorites/New zijn verhuisd naar
   eigen sub-pages onder /library/. Op deze tab staan nu drie navigatie-
   knoppen (New/Favorites/Free) die router.push'en naar die sub-pages.
   PILLS, FilterId, EmptyState zijn verwijderd uit dit bestand. */

/* Inspirator-extractie — wie inspireerde elke serie? Alleen series waarvan
   SERIES_SUBTITLE eindigt op " inspired" hebben een persoonlijke inspirator
   (bv. "Andrew Huberman inspired" → "Andrew Huberman"). Andere series hebben
   een generieke "X Series"-suffix zonder inspirator. Eénmalig op module-
   load berekend — geen ronde per render. */
const INSPIRED_SUFFIX = / inspired$/i;
const SERIES_INSPIRATOR: { name: string; seriesName: string }[] = [];
for (const seriesName of Object.keys(SERIES_SUBTITLE)) {
  const sub = SERIES_SUBTITLE[seriesName];
  if (INSPIRED_SUFFIX.test(sub)) {
    SERIES_INSPIRATOR.push({
      name: sub.replace(INSPIRED_SUFFIX, '').trim(),
      seriesName,
    });
  }
}

/* Kleine helper voor avatar-initialen van een inspirator-naam. */
const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();

/* Operator ("je moet dezelfde principes overal toepassen, wij hebben
   duidelijke afspraken opgeschreven"): huisstijl §5 schrijft voor
   kaart-selectie (expliciet genoemd: "pricing-kaart, actieve pillar")
   een eigen bounce voor — scale(.95) tijdens de tik, spring-overshoot
   terug naar ~1.02 bij loslaten, GEEN harde stop op 1.0. Dat is iets
   anders dan de platte knop-formule (scale .97 + opacity .85, geen
   overshoot) die de rest van de app voor gewone CTA's gebruikt. Eén
   herbruikbare wrapper i.p.v. deze animatie los te herhalen bij elke
   kaart — moet overal hetzelfde aanvoelen. */
function CardBounce({
  children,
  style,
  onPress,
  onLongPress,
  androidRipple,
  accessibilityLabel,
  /* Operator, 4 okt 2026 (smoothness-audit): optionele doorgave — enkele
     van de kleinere elementen die deze wrapper nu ook gebruiken (bv. de
     navigatie-snelkoppelingen) hadden als kale `Pressable` een eigen
     `hitSlop`, die anders verloren zou gaan bij de overstap. */
  hitSlop,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  androidRipple?: { color: string };
  accessibilityLabel?: string;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
}) {
  const scale = useSharedValue(1);
  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      style={style}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={hitSlop}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 90 });
        /* Operator ("kaarten hebben geen haptische trilling, pas het
           protocol overal toe"): §5 "CTA-tik → haptiek" — zelfde lichte
           tik als de primaire CTA's, nu ook op kaart-selectie. */
        hapticPress();
      }}
      onPressOut={() => {
        /* Operator ("die bounce is volgens mij niet apple-proof"):
           dampingRatio 0.6 was te onderdemp — voelde als een zichtbare
           "boing" i.p.v. de subtiele overshoot die het protocol bedoelt.
           0.78 (dichter bij de al goedgekeurde CTA-veer, 0.73) geeft een
           kortere, strakkere terugkeer — nauwelijks meer dan een
           snelle "settle", geen jelly-effect. */
        scale.value = withSpring(1, { duration: 220, dampingRatio: 0.78 });
      }}
      android_ripple={androidRipple}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={bounceStyle}>{children}</Animated.View>
    </Pressable>
  );
}

/* Hartje rechts op een sessierij — outline (♡) vs gevuld (♥), met
   stopPropagation zodat de parent-Pressable (play/paywall) niet vuurt. */
function HeartButton({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={(e) => {
        e?.stopPropagation?.();
        onPress();
      }}
      hitSlop={10}
      style={s.heartBtn}
    >
      <Text style={[s.heartGlyph, active && s.heartGlyphActive]}>
        {active ? '♥' : '♡'}
      </Text>
    </Pressable>
  );
}

/* openSession is verhuisd naar src/utils/openSession.ts — wordt gedeeld
   met de Library-sub-pages. */

/* SessionRow — sessierij in geopende kaart of geopende Soundscapes-subcat.
   Visueel 1:1 overgenomen uit library.tsx + heart-Pressable rechts. Favorite-
   state wordt als prop doorgegeven door AudioScreen (één useFavorites()-call
   bovenaan; geen hook per rij om subscribers te beperken). */
function SessionRow({
  session,
  photo,
  canPlay,
  onPress,
  isFavorite,
  onToggleFav,
  isActive,
  isPlaying,
  hideTag,
  separated,
}: {
  session: Session;
  photo: string;
  canPlay: boolean;
  onPress: () => void;
  isFavorite: boolean;
  onToggleFav: () => void;
  /* FIX 9: dezelfde "now playing"-behandeling als op de free-balk.
     isActive = service.session.url matched deze sessie (loaded, ongeacht
     play/pause). isPlaying = isActive && service.playing — bepaalt ▶/❚❚. */
  isActive: boolean;
  isPlaying: boolean;
  /* true → verberg de FREE/PRO-tag boven de titel. Gebruikt voor PRO-users
     waarvoor het onderscheid niet relevant is. */
  hideTag?: boolean;
  /* Operator, 14 september 2026 (Apple-stijl bento-eiland): true voor elke
     rij behalve de laatste in de lijst — tekent de hairline-scheidingslijn
     die nu de rol overneemt van de oude losse kaart-per-rij. */
  separated?: boolean;
}) {
  /* Iter v189 (2026-07-02): slot glyph en opacity-dimming BEHOUDEN (operator-
     beslissing). Slot alleen was ondoorzichtig — nu combineren met "60s
     preview"-indicator naast de PRO badge zodat user vooraf weet dat er
     preview beschikbaar is. Combineert de "gate"-signaal met de "preview
     escape hatch"-info. */
  return (
    <Pressable
      style={[s.libRow, separated && s.libRowSeparated, !canPlay && s.libRowLocked]}
      onPress={onPress}
    >
      <View style={s.libRowArt}>
        {photo ? <Image source={{ uri: photo }} style={s.libRowArtImg} /> : null}
        <View style={[s.libRowPlay, isActive && s.libRowPlayActive]}>
          {isActive ? (
            <LinearGradient
              colors={[SIGNAL_BLUE, SIGNAL_BLUE_HOVER]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          {!canPlay ? (
            /* Operator, 14 september 2026: 🔒-emoji rendert altijd geel/
               oranje (systeemkleur, niet stuurbaar via `color`) — botste
               met de rest van het palet. Native lucide-icoon, wel echt
               wit, conform de rest van de app. */
            <Lock size={16} color="#ffffff" strokeWidth={2.4} />
          ) : (
          <PlayPauseGlyph
            size={16}
            color="#ffffff"
            playing={isActive && isPlaying}
          />
          )}
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {!hideTag && (() => {
          /* Iter 9dq v60 (2026-06-03): 3-tier badge ipv 2. Tier-resolutie
             via getEffectiveTier (utils/access-tier.ts) — werkt met
             expliciet `accessTier`-veld OF de fallback op `free`. */
          const tier = getEffectiveTier(session);
          const label = tierBadgeLabel(tier);
          if (!label) return null;
          /* Iter v189 (2026-07-02): "PREVIEW · 60s" pilletje naast PRO
             badge wanneer !canPlay (user is geen PRO). Communiceert vooraf
             dat er 60-sec preview beschikbaar is — Spotify/Apple Music
             patroon. */
          /* Operator, 14 september 2026: `tierBadgeColor`'s PRO-kleur is
             wit-gebaseerd (`rgba(255,255,255,0.55)`), gebouwd voor de oude
             donkere rijen. Dit scherm staat nu op `C.surface` (wit) —
             enkel hier lokaal overschrijven, niet in de gedeelde util
             (die blijft correct voor nog-niet-geconverteerde schermen). */
          const badgeColor =
            /* Operator ("het groen in kaarten moet weg"): GREEN is
               gereserveerd voor completion-state ("fully listened"),
               niet voor een tier-label — dat gebruikte hier al 20+
               regels hoger de eigen, daarvoor bedoelde C.free-token. */
            tier === 'pro' ? C.dim : tier === 'public' ? C.free : tierBadgeColor(tier);
          /* Operator, 14 september 2026: "hoe die knoppen PRO/PREVIEW·60s
             aanpakken?" — twee losse gekleurde pilletjes namen onnodig
             veel verticale ruimte in en botsten met de rest van het
             lichte, rustige systeem. Optie 1 (aanbevolen): geen pillen
             meer, één rustige eyebrow-regel — pure typografie doet het
             werk (Clarity over Decoration).
             2e correctie: "PRO" was dubbelop met het witte hangslotje op
             de thumbnail ernaast (zelfde info, twee keer) — bij een
             vergrendelde rij toont de regel nu enkel nog "PREVIEW · 60S",
             het slotje draagt de "PRO"-boodschap al. Bij een speelbare
             rij (geen slotje) blijft het tier-label (FREE) wel staan —
             daar is geen andere visuele cue voor. */
          return (
            <Text style={s.libRowTag}>
              {canPlay ? (
                <Text style={{ color: badgeColor }}>{label}</Text>
              ) : (
                <Text style={{ color: C.dim }}>PREVIEW · 60S</Text>
              )}
            </Text>
          );
        })()}
        <Text style={s.libRowTitle}>{session.title}</Text>
        {session.desc ? <Text style={s.libRowDesc}>{session.desc}</Text> : null}
        {/* FIX 15b: status-regel ook hier in serie-expansion sessie-rijen.
            Iter 9dq v111 (2026-06-04): centralised formatListenedLabel
            zodat fc-count meekomt ("Fully listened x2" etc.). */}
        {(() => {
          const label = getListenedLabelByUrl(session.url);
          if (!label) return null;
          return (
            <Text
              style={[
                s.statusRowRow,
                { color: label.isFull ? GREEN : C.accent },
              ]}
            >
              {label.isFull ? '✓ ' : '▶ '}
              {label.text}
            </Text>
          );
        })()}
      </View>
      <HeartButton active={isFavorite} onPress={onToggleFav} />
    </Pressable>
  );
}

/* Zolang audio verborgen is stuurt dit scherm door naar Breath. De route
   blijft bestaan — bestaande abonnees kunnen er via een deeplink nog in —
   maar wie hier per ongeluk landt, en dat gebeurde met de terugknop, ziet
   niet ineens een pagina die niet meer bij de app hoort. */
/* De audiobibliotheek is verborgen, maar de route `/` bestond nog en er
   wijzen nog een stuk of tien plekken naartoe: uitloggen, "terug naar begin"
   in de bracelet, de over-pagina, het einde van een proefsessie. Elk van die
   plekken afzonderlijk omleiden is tien kansen om er één te vergeten — en dat
   gebeurde ook (operator, 7 augustus 2026). Daarom staat de afsluiting hier,
   op de route zelf: één plek, en niets kan er meer langs.

   Zet `AUDIO_ENABLED` weer aan en alles werkt zoals het was; er is niets
   verwijderd. */
export default function AudioRoute() {
  const params = useLocalSearchParams<{ from?: string }>();
  /* De ECHTE bibliotheek — hero, de vier pijlers, alle series, Soundscapes —
     open vanuit breathwork (operator, 9 augustus 2026: "de library die we
     gebouwd hebben, die pagina's dienen op een manier gebruikt te worden").
     Eerder bouwde ik hiervoor een aparte, kale pagina; dat was dubbel werk
     en precies niet wat er gevraagd was. Dit scherm bestaat al en is af —
     alleen de tab ernaartoe is verborgen, het scherm zelf niet.
     Twee routes komen hier binnen: `breath` (de kaart op het keuzescherm en
     het afsluitscherm van een sessie) en `onboarding` (het bibliotheek-punt
     op het laatste onboarding-scherm) — die laatste krijgt bovendien een
     eigen terugknop, zie AudioScreen. */
  const fromOnboarding = params.from === 'onboarding';
  /* Niets tonen tot de root beslist heeft waar de app opent (8 okt 2026):
     anders flitste de Library-intro voorbij vóór het laatste tabblad. */
  const booted = useBootDecided();
  if (!booted) return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />;
  if (AUDIO_ENABLED || params.from === 'breath' || fromOnboarding) {
    return <AudioScreen fromOnboarding={fromOnboarding} />;
  }
  /* Niets doen zolang de root nog beslist waar de app opent. Deed dit hier
     meteen een omleiding, dan won die van `router.replace('/welcome')` en zag
     niemand het welkomstscherm nog (operator, 7 augustus 2026). De splash
     staat er tijdens dat wachten overheen, dus er is niets van te zien.
     Zie utils/boot.ts. */
  if (!bootDecided()) return null;
  return <Redirect href="/breath" />;
}

function AudioScreen({
  fromOnboarding = false,
}: { fromOnboarding?: boolean } = {}) {
  /* GEEN doorstuur meer naar Breath (7 augustus 2026). Die was bedoeld voor
     de terugknop, maar hij vocht met het welkomstscherm: de app opent op deze
     route, stuurde meteen door naar Breath, en overschreef daarmee de
     doorstuur naar "Stop Drifting" die de root-layout net had gedaan. Vandaar
     dat welcome nooit verscheen.
     De terugknop is al opgelost met `backBehavior="initialRoute"` op de
     tab-groep; twee oplossingen voor hetzelfde probleem is er één te veel. */

  /* Iter v168 (2026-06-28): tijdens isLoading (status === null) behandelen
     we hasSub als TRUE — voorkomt FREE flicker bij cold-start en net-na-
     sign-in. Audio Library renderde anders 'FREE · 27' tile + upsell-cards
     terwijl de PRO-status nog werd opgehaald (RC + backend roundtrip).
     Operator zag dit als 'amateuristisch'. Voor echte gasten resolveert
     useSubscription binnen ms naar {active:false} zonder loading-state
     (geen token → direct notifyAll). Voor PRO users bij refresh: kort
     'unknown' → render als PRO → zodra fetch klaar render exact. */
  const sub = useSubscription();
  /* Operator, 26 september 2026 (toegangsmodel-gat gedicht, vervolg):
     `hasSub` bepaalt door dit hele bestand heen of de "volledig
     ontgrendelde bibliotheek"-weergave getoond wordt (badges verbergen,
     FREE-balken/upsell-hints/aankoopblok tonen of niet, "Free Picks"-
     kaart, etc.). `sub.isPro` alleen is ook `true` tijdens de 7-dagen-
     trial (RevenueCat telt een trial als actieve entitlement) — zonder
     de `!sub.isTrialing`-check hieronder zag een trial-user dus een
     bibliotheek die er visueel volledig ontgrendeld uitziet (geen
     badges, geen upsell), terwijl een tik op PRO-content sinds de
     content-gating-fix (access-tier.ts/player.tsx/audio-player.ts)
     terecht wél de preview-cap toont — een verwarrende mismatch tussen
     wat je ZIET en wat je KRIJGT. Bedoeld model (project-free-tier-
     facts, operator-bevestigd): trial = dezelfde weergave als
     signed-in-maar-niet-betaald, niet de volledig-ontgrendelde weergave. */
  const hasSub = sub.isLoading ? true : sub.isPro && !sub.isTrialing;
  const isBraceletOwner = useBraceletOwner();
  /* Auth-state voor de top sign-in CTA banner (operator-keuze
     2026-05-26: Welcome wordt na 1× dismiss niet meer bereikbaar,
     dus uitgelogde users moeten ÓÓK vanaf de Audio-tab kunnen
     inloggen, niet alleen via Account-tab). `null` = nog aan 't
     checken — banner verbergen om flicker te voorkomen. */
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  /* Audit 8 okt 2026: bij elke focus opnieuw — het tabblad blijft
     gemonteerd, dus in- of uitloggen op Profile kwam hier anders niet aan. */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        /* Offline met een verlopen sleutel blijf je ingelogd (8 okt 2026). */
        const t = (await getToken()) || (await hasStoredSession());
        if (!cancelled) setIsSignedIn(!!t);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  /* ── Bracelet-only PRO landing-flow (operator 2026-05-31, v3) ──
     Voor BRACELET-ONLY PRO users (ingelogd, bracelet maar GEEN audio
     sub). Landing page met "Complete the system / Add Audio Library"
     upsell. Tap reveals de echte library content. Bij terug-navigatie
     reset naar landing.

     Full PRO (audio + bracelet) ziet de NORMALE Audio Library direct,
     zoals voorheen — geen landing, want zij hebben al audio toegang.
     De landing voelt voor hen onnodig (extra tap zonder waarde).

     Reden landing voor bracelet-only: voorkomt dat ze het gevoel
     krijgen dat ze de free audio library als "main" hebben terwijl ze
     géén audio-sub bezitten. */
  /* Iter 9dq v22 (2026-06-02): isSignedIn-check verwijderd. Real
     bracelet-owner heeft in productie altijd een token (isSignedIn=true)
     — daar verandert niets. Maar dev-override 'bracelet' heeft GEEN
     real token → voorheen toonde landing nooit. Conditie nu: bracelet
     owner zonder audio-sub → landing. Dat klopt voor beide scenarios.
     Full PRO (audio+bracelet) blijft bypassen via !hasSub-check. */
  const showBraceletLanding = isBraceletOwner && !hasSub;
  const needsAudioUpsell = true; // landing toont alleen bracelet-only PRO
  const [exploredLibrary, setExploredLibrary] = useState(false);
  /* Iter 9dq v43 (2026-06-03): focus-reset verwijderd. Voorheen werd
     exploredLibrary teruggezet op false bij elke tab-focus zodat user
     bij tab-switch terug op de landing kwam. Maar: het modal-sluiten
     van de player triggert OOK een tab-focus, waardoor user na het
     sluiten van een free sessie ongewenst terug naar de landing
     gestuurd werd. Operator-feedback: "bezoeker moet in de free
     omgeving blijven en alle free sessies kunnen beluisteren tot hij
     beslist om eruit te gaan".

     Iter 9dq v98 (2026-06-04): tab-switch reset KOMT TERUG via een
     expliciet signaal vanuit de tab-button (requestLibraryReset).
     Anders dan useFocusEffect firet dit ALLEEN bij echte tab-button-
     press, niet bij modal-close. Beide flows werken nu:
       - Player modal close            → blijft in library (geen reset)
       - Audio-tab-tap vanuit elders   → terug naar landing (wel reset)
     Operator-spec: "als hij terug op audio library tab moet eerst
     korte audio library pagina verschijnen niet de free". */
  useEffect(() => {
    const unsubscribe = subscribeLibraryReset(() => {
      setExploredLibrary(false);
    });
    return unsubscribe;
  }, []);

  /* Cold-start redirect: bracelet-owners landen op /bracelet bij eerste
     app-start. Eenmalig per sessie via module-level flag. */
  /* VERWIJDERD 8 okt 2026 (audit): de cold-start-sprong naar /bracelet voor
     bracelet-eigenaars. Die vuurde 1–2 s na het openen en maakte "open in je
     laatste tabblad" (app/_layout.tsx) ongedaan. De root beslist waar de app
     opent. */
  /* Audio-service-snapshot voor de "now-playing" highlight op de
     FREE-balk(en) onder elke serie. Re-rendert ~elke 250ms tijdens
     playback (expo-audio playbackStatusUpdate, updateInterval 250 in
     audio-player.ts), wat de 3px progress-strip onderaan het blokje
     vloeiend laat lopen — zelfde tick als de mini-player. */
  const playerState = usePlayerState();
  /* useHistory() laadt vzh_v1 in memory zodat getEntryByUrl(...) per
     sessie-rij een geldige snapshot teruggeeft. Re-rendert wanneer een
     sessie ge-flusht wordt (pause / finish) — status-regel verschijnt
     dan vanzelf. */
  useHistory();

  /* ── Bracelet-upsell-modal trigger ──────────────────────────────────
     Show/hide via singleton-service (bracelet-upsell.ts) zodat de modal-
     UI in de root-layout gemount kan zijn — pas dan kan 'ie als floating
     View boven player.tsx vallen ZONDER native-modal touch-intercept.

     TWEE TRIGGERS samen:
       1. onSessionFinish-event (uit audio-player service) — fired bij
          ELKE natural-EOF, ongeacht auto-play setting. Cooldown van 24u
          via AsyncStorage zorgt dat user 'm max 1× per dag ziet.
       2. endedPanel-watcher — dismist de bar zodra user Done of Play
          next tikt (endedPanel: truthy → null transition). Snellere
          exit dan de 10s timer voor user die actief op het paneel
          reageert.

     AUTO-HIDE (10s):
       Specifiek voor auto-play-pad: endedPanel wordt nooit gezet, dus
       geen user-actie om dismiss te triggeren. Timer zorgt dat de bar
       niet permanent in beeld blijft tijdens de nieuwe sessie. Power-
       user ziet 'm 10s, daarna vrije player-UI weer.

     LISTENER-FATIGUE bescherming:
       - 24u cooldown = max 1 bar-bezoek per dag
       - 10s auto-hide = nooit permanent
       - Tap-bar / hardware-back / Done/Play-next = directe dismiss */
  useEffect(() => {
    let autoHideTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = onSessionFinish(async (_finishedSession) => {
      try {
        /* Iter 9dq v126/v127 (2026-06-04): upsell-modal toont ALLEEN voor
           Audio PRO users (= hebben audio-sub maar geen bracelet).
           Operator-spec:
             - Free / Guest    → geen popup, ze hebben de Bracelet-tab al
             - Audio PRO       → POPUP (echte upsell — geen bracelet)
             - Bracelet PRO    → geen popup, bezit al
             - Full PRO        → geen popup, bezit al + heeft audio
           Skip-condities: geen-PRO (free) of al-owner. */
        if (!hasSub || isBraceletOwner) return;
        /* 80%-threshold (defensief — didJustFinish fired alleen op
           natural EOF dus dit triggert vrijwel nooit). */
        const snap = getSnapshot();
        if (
          snap.durationSec > 0 &&
          snap.positionSec / snap.durationSec < UPSELL_COMPLETION_THRESHOLD
        ) {
          return;
        }
        /* 24u cooldown — in DEV bypassed voor testen. */
        const lastRaw = await AsyncStorage.getItem(UPSELL_KEY);
        const last = lastRaw ? parseInt(lastRaw, 10) : 0;
        if (
          !__DEV__ &&
          Number.isFinite(last) &&
          Date.now() - last < UPSELL_COOLDOWN_MS
        ) {
          return;
        }
        showBraceletUpsell();
        await AsyncStorage.setItem(UPSELL_KEY, String(Date.now()));

        /* Auto-hide timer — alleen relevant voor auto-play-pad. Bij
           paneel-pad zal de endedPanel-watcher hieronder 'm sneller
           dismissen wanneer user Done/Play next tikt. */
        if (autoHideTimer) clearTimeout(autoHideTimer);
        autoHideTimer = setTimeout(() => {
          hideBraceletUpsell();
          autoHideTimer = null;
        }, UPSELL_AUTO_HIDE_MS);
      } catch {
        /* AsyncStorage-fout mag de audio-flow nooit breken. */
      }
    });

    return () => {
      unsubscribe();
      if (autoHideTimer) clearTimeout(autoHideTimer);
    };
    /* hasSub + isBraceletOwner in deps zodat upsell-skip up-to-date is
       bij runtime override-wisselingen (dev-only). Productie verandert
       dit weinig — backend-status is per-session stabiel. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSub, isBraceletOwner]);

  /* Endedpanel-watcher: dismist de bar zodra het SESSION COMPLETE-paneel
     verdwijnt (Done of Play next geklikt). Geeft user een snellere
     dismiss-route dan de 10s timer wanneer 'ie actief op het paneel
     reageert. */
  useEffect(() => {
    if (!playerState.endedPanel) {
      hideBraceletUpsell();
    }
  }, [playerState.endedPanel]);

  /* Auto-play-next setting — gedeelde state met audio-player service.
     Verhuisd van Account-tab naar hier zodat het natuurlijk bij de
     audio-ervaring zit. Account toont alleen nog een link-card naar deze
     positie (via scroll-intent 'library-settings'). */
  const [autoPlayNext, setAutoPlayNext] = useSetting('autoPlayNext');

  /* Operator, 15 september 2026 ("bij breathwork is tabblad onderaan
     zichtbaar en bij audio library niet, dat is een feit"): terecht — een
     los `/audio-welcome`-stack-scherm (buiten de `(tabs)`-navigator) kan
     de tab-bar NOOIT tonen, hoe je 'm ook navigeert. `(tabs)/breath.tsx`s
     eigen "Breathe. Build. Become."-intro toont de tab-bar wél, want dat
     is gewoon conditionele INHOUD van de tab zelf (`const [intro,
     setIntro] = useState(true)`), geen apart scherm.

     Operator, 15 september 2026: "intro mag zich elke keer tonen, zeker
     in free environment" — geen eenmalige `audioOnboardingCompletedAt`-
     vlag meer (die onderdrukte 'm na de eerste keer, exact het
     tegenovergestelde van gevraagd). Nu EXACT hetzelfde patroon als
     breath.tsx: `intro` start gewoon altijd op `true` bij het monteren
     van dit component.

     BUG (dezelfde die later op de Bracelet-tab opdook: "welcome is weg
     nu"): `useState(true)` evalueert maar ÉÉN keer per échte montage —
     en React Navigation's Tabs-navigator monteert een tab maar één
     keer, blijft 'm daarna gewoon vasthouden bij tab-wissels (geen
     remount). Wie de intro één keer wegtikte zag 'm bij terugkeer naar
     deze tab dus nooit meer, ondanks "elke keer". `useFocusEffect` zet
     de vlag terug op `true` bij ELKE focus van deze tab, niet enkel de
     eerste montage. */
  const [intro, setIntro] = useState(true);
  const finishAudioIntro = useCallback(() => {
    setIntro(false);
  }, []);
  /* Operator ("de regel om naar welcome te gaan is enkel als iemand naar
     ander tabblad gaat en terugkomt"): de focus-reset hierboven kon niet
     onderscheiden WAAROM deze tab weer focust — een echte tab-wissel
     (Bracelet → Audio) en "terug van een sessie/pillar-scherm die je
     vanaf deze tab zelf pushte" zien er voor React Navigation identiek
     uit (allebei blur+focus, geen remount). Zonder onderscheid toonde
     élke terugkeer (ook na gewoon een sessie sluiten) de intro opnieuw.
     Deze ref zet de EIGEN uitgaande navigatie hieronder (player, pillar-
     scherm, free/new/favorites/history/legal/subscribe) op "genegeerd
     bij terugkomst" — enkel een écht tab-wissel triggert dan nog de
     reset. */
  const returningFromOwnPushRef = useRef(false);
  const navigateAway = useCallback((fn: () => void) => {
    returningFromOwnPushRef.current = true;
    fn();
  }, []);
  useFocusEffect(
    useCallback(() => {
      /* Operator ("bij back wel altijd terug naar bovenkant van de
         pagina, geldt ook vanuit welcome"): scroll ALTIJD naar boven bij
         elke focus van deze tab — of dat nu een echte tab-wissel is, een
         terugkeer uit een sessie/pillar-scherm, of de eerste keer vanuit
         het welkomstscherm. In tegenstelling tot de intro-kaart hieronder
         maakt de "waarom" hier niet uit. */
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      if (returningFromOwnPushRef.current) {
        returningFromOwnPushRef.current = false;
        /* Free Picks-lijst weer inklappen bij terugkomst (zie
           openSessionFromFreePicks hierboven) — hier en niet vóór het
           wegnavigeren, anders flitst de ingeklapte saleskaart-grid al
           kort op vóór de screen-transitie start. */
        setActivePillarFilter(null);
        return;
      }
      setIntro(true);
    }, []),
  );

  /* Operator, 24 september 2026 ("ik klik gewoon op de tabbladen, is dan
     niet normaal dat ik niet weggestuurd word? moeten we in de tabbladen-
     omgeving blijven?"): de forced-redirect-naar-welcome hieronder
     (operator, 18 september 2026) is hiermee teruggedraaid — gewoon tikken
     op de tab-balk hoort binnen de tabs-navigator te blijven, geen
     gedwongen omweg via het losse `/welcome`-scherm meer. De `intro`-reset
     hierboven (elke terugkeer naar deze tab toont opnieuw "Explore Audio
     Library") blijft wél bestaan — dát is de "welkomstweergave van de tab
     zelf" die de gebruiker wil zien bij terugkeer, niet het app-brede
     welcome.tsx. */

  /* Ken Burns — trage, doorlopende ademende zoom op de intro-foto, zelfde
     bereik/duur als breath.tsx's `kenBurns` (18s, sinus in-out, oneindig
     heen-en-weer) — "niets mag statisch zijn".

     Operator, 15 september 2026: nieuwe foto ("pic welcome audio library
     app.png", verving "pic headphone new.png") — de lange reeks scale/
     shift-fijnafstemming hierboven hoorde bij de VORIGE foto's compositie
     en is hier niet meer relevant. Schone herstart: bescheiden basiszoom,
     gecentreerd, geen schuif. `AUDIO_INTRO_MAX_LIFT`/`AUDIO_INTRO_MAX_
     SHIFT_X` blijven de veilige PLAFONDS (overhang door het opschalen,
     berekend uit zoom + schermformaat) zodat een latere schuif nooit een
     lege rand kan tonen. */
  const AUDIO_INTRO_ZOOM = 1.15;
  const AUDIO_INTRO_MAX_LIFT = Math.max(
    0,
    ((AUDIO_INTRO_ZOOM - 1) * Dimensions.get('window').height) / 2 - 15,
  );
  const AUDIO_INTRO_LIFT = 0;
  const AUDIO_INTRO_MAX_SHIFT_X = Math.max(
    0,
    ((AUDIO_INTRO_ZOOM - 1) * Dimensions.get('window').width) / 2 - 15,
  );
  /* Positief = naar rechts. */
  const AUDIO_INTRO_SHIFT_X = 0;
  const introKenBurns = useSharedValue(1);
  useEffect(() => {
    if (!intro) return;
    introKenBurns.value = withRepeat(
      withTiming(1.06, { duration: 18000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [intro, introKenBurns]);
  const introKenBurnsStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: introKenBurns.value * AUDIO_INTRO_ZOOM },
      { translateX: AUDIO_INTRO_SHIFT_X },
      { translateY: -AUDIO_INTRO_LIFT },
    ],
  }));

  /* Staggered woord-onthulling — zelfde ritme als breath.tsx's
     `wordReveal` (eyebrow eerst, dan de kop, elk 220ms na de vorige,
     opacity+translateY, éénmalig, geen lus). */
  const INTRO_WORD_STAGGER_MS = 220;
  const INTRO_WORD_RISE_MS = 620;
  const introEyebrowReveal = useSharedValue(0);
  const introTitleReveal = useSharedValue(0);
  useEffect(() => {
    if (!intro) return;
    introEyebrowReveal.value = withDelay(
      300,
      withTiming(1, { duration: INTRO_WORD_RISE_MS, easing: Easing.out(Easing.cubic) }),
    );
    introTitleReveal.value = withDelay(
      300 + INTRO_WORD_STAGGER_MS,
      withTiming(1, { duration: INTRO_WORD_RISE_MS, easing: Easing.out(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro]);
  const introEyebrowStyle = useAnimatedStyle(() => ({
    opacity: introEyebrowReveal.value,
    transform: [{ translateY: 10 * (1 - introEyebrowReveal.value) }],
  }));
  const introTitleStyle = useAnimatedStyle(() => ({
    opacity: introTitleReveal.value,
    transform: [{ translateY: 10 * (1 - introTitleReveal.value) }],
  }));

  /* CTA — zelfde spring-press + shimmer-lichtstrook als breath.tsx's
     "Explore modes"-knop (`ctaScale`/`shimmer`). */
  const introCtaScale = useSharedValue(1);
  const introCtaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: introCtaScale.value }],
  }));
  const introShimmer = useSharedValue(-1);
  useEffect(() => {
    if (!intro) return;
    introShimmer.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(2600, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })),
        withDelay(1200, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [intro, introShimmer]);
  const introShimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: introShimmer.value * 170 }, { rotate: '18deg' }],
  }));
  /* Inline expand-/collapse-state per serie. Accordion: er kan slechts
     ÉÉN serie tegelijk uitgeklapt zijn — opent een nieuwe → eventuele
     andere klapt automatisch dicht (Spotify/Apple-stijl). Standaard
     INGEKLAPT (`null`). Soundscapes-subcategorieën hebben hun eigen
     onafhankelijke state — meerdere subcats mogen wél tegelijk open. */
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
  const [subExpanded, setSubExpanded] = useState<Record<string, boolean>>({});
  /* Iter 9aaa: pillar-detail modal state. Tap op pillar-card → open
     bottom-sheet met korte uitleg. Apple-style minimal. */
  /* Iter 9dq v130 (2026-06-14): pillar-filter state. Tap op pillar-card =
     filter library tot die pijler. Tap nogmaals = un-filter. Default = null
     (toon alle pijlers gegroepeerd). */
  const [activePillarFilter, setActivePillarFilter] = useState<
    'resilience' | 'sovereignty' | 'social' | 'drive' | 'tools' | 'free' | null
  >(null);

  const [detailPillar, setDetailPillar] = useState<
    (typeof PILLARS)[number] | null
  >(null);

  /* Operator ("we gaan Free Sessions bovenaan veranderen naar Last
     Listened, en als gebruiker daarop klikt gaat de popup open"): het
     middelste segment van de snelkoppelingen-balk hieronder toont "Last
     Listened" i.p.v. "Free Sessions"/"New" zodra er een geldige,
     tonbare last-played-entry is — tikken opent de Welcome-back-popup
     (WelcomeBackPopup, root-mount) i.p.v. te navigeren. Zonder geldige
     entry blijft het oude gedrag (Free Sessions/New) intact — nooit een
     dode knop. */
  const lastPlayed = useShowableLastPlayed();

  /* Operator ("mooie laten ademen alle kaarten"): zachte, oneindige
     ademhaling op de 6 grid-kaarten — "niets mag statisch zijn", zelfde
     principe als de Ken Burns-zoom elders in de app. Zes losse
     useSharedValue/useAnimatedStyle-paren (niet in een .map — hooks
     mogen niet in een loop), 5 voor de PILLARS-kaarten (index = pillarIdx)
     + 1 voor Free Picks, elk met een eigen faseverschil zodat ze nooit
     synchroon ademen. Amplitude bewust klein (1.5%) — dit is een
     achtergrond-levendigheid, geen aandachttrekker. */
  const breath0 = useSharedValue(0);
  const breath1 = useSharedValue(0);
  const breath2 = useSharedValue(0);
  const breath3 = useSharedValue(0);
  const breath4 = useSharedValue(0);
  const breath5 = useSharedValue(0);
  const breathValues = useMemo(
    () => [breath0, breath1, breath2, breath3, breath4, breath5],
    [breath0, breath1, breath2, breath3, breath4, breath5],
  );
  useEffect(() => {
    breathValues.forEach((v, i) => {
      v.value = withDelay(
        i * 260,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const breathStyle0 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath0.value * 0.015 }] }));
  const breathStyle1 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath1.value * 0.015 }] }));
  const breathStyle2 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath2.value * 0.015 }] }));
  const breathStyle3 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath3.value * 0.015 }] }));
  const breathStyle4 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath4.value * 0.015 }] }));
  const breathStyle5 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath5.value * 0.015 }] }));
  const breathStyles = [
    breathStyle0,
    breathStyle1,
    breathStyle2,
    breathStyle3,
    breathStyle4,
    breathStyle5,
  ];
  /* Free Breathwork chooser modal — opent vanuit de discovery-card
     onderaan de Audio tab. Toont de 5 breathwork-protocols zodat de
     gebruiker de juiste state kiest vóór navigatie naar bracelet-control
     (met ?mode=X&breathwork=1 zodat de juiste breathwork pre-selected is). */
  const [breathChooserOpen, setBreathChooserOpen] = useState(false);
  /* Iter 9dq v156 (operator 2026-06-18): info-popup voor de Auto-play
     toggle. User-initiated — opent door tap op de ⓘ-knop naast het label.
     Custom modal in VIBEZCORE-stijl (zelfde bottom-sheet pattern als
     pillar-detail), niet de generic OS Alert. */
  const [autoPlayInfoOpen, setAutoPlayInfoOpen] = useState(false);
  /* Iter 9bbb: safe-area inset voor pillar-modal bottom (home-indicator
     iOS / gesture-bar Android moeten ruimte krijgen). */
  const safeInsets = useSafeAreaInsets();

  /* (verwijderd: storeName per platform — operator wil beide platforms
     tonen voor vertrouwen ongeacht device). */
  /* Uitklap-state voor de disclaimer onderaan de pagina — default DICHT. */
  const [legalOpen, setLegalOpen] = useState(false);
  const toggleLegal = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLegalOpen((o) => !o);
  };

  /* ── Library-functionaliteit in deze tab geïntegreerd (besluit eigenaar,
     consolidatie van de oude Library-tab). Search + filter zijn session-
     only; favorites komt uit shared hook (cross-component state +
     AsyncStorage onder key 'vibezcore:favorites'). Following is per
     eigenaar-besluit verwijderd — alle "save voor later"-gedrag loopt
     nu via Favorites op sessie-niveau. ── */
  const [searchQuery, setSearchQuery] = useState('');
  const { favorites, toggle: toggleFavorite } = useFavorites();

  /* Reset de zoekquery telkens wanneer deze tab gefocust wordt — gebruiker
     keert dus altijd terug naar een ongefilterde Audio Library. Bij eerste
     mount is searchQuery al '', dus geen re-render-overhead. */
  useFocusEffect(
    useCallback(() => {
      setSearchQuery('');
    }, []),
  );

  /* Zoekquery splitst de matches in 3 categorieën (Spotify-stijl
     autocomplete):
       1) Series — naam OF eyebrow (SERIES_SUBTITLE) OF sub-tagline (SERIES_SUB)
       2) Sessions — sessie-titel OF sessie-desc
       3) Inspirators — match op de gestripte inspirator-naam (zonder " inspired")
     Elke categorie houdt SERIES- / SESSIONS-volgorde aan. */
  const lowerQ = searchQuery.trim().toLowerCase();
  const searchActive = lowerQ.length > 0;

  const seriesMatches = useMemo(() => {
    if (!searchActive) return [];
    const has = (field: string | undefined) =>
      !!field && field.toLowerCase().includes(lowerQ);
    return SERIES.filter(
      (ser) =>
        has(ser.name) ||
        has(SERIES_SUBTITLE[ser.name]) ||
        has(SERIES_SUB[ser.name]),
    );
  }, [searchActive, lowerQ]);

  const sessionMatches = useMemo<Session[]>(() => {
    if (!searchActive) return [];
    const has = (field: string | undefined) =>
      !!field && field.toLowerCase().includes(lowerQ);
    return SESSIONS.filter((sess) => has(sess.title) || has(sess.desc));
  }, [searchActive, lowerQ]);

  const inspiratorMatches = useMemo(() => {
    if (!searchActive) return [];
    const has = (field: string | undefined) =>
      !!field && field.toLowerCase().includes(lowerQ);
    return SERIES_INSPIRATOR.filter((insp) => has(insp.name));
  }, [searchActive, lowerQ]);

  const hasAnyMatches =
    seriesMatches.length + sessionMatches.length + inspiratorMatches.length > 0;

  /* Refs voor scroll-coordinatie:
     - scrollViewRef: voor scrollTo();
     - searchBarYRef: Y van de zoekbalk (via onLayout), gebruikt om de
       bar in beeld te scrollen wanneer de gebruiker begint te typen;
     - seriesPositions: Record per serie-naam met de Y t.o.v. libList
       (via onLayout op libCardUnit);
     - libListYRef: Y van libList t.o.v. de ScrollView (via onLayout op
       libList). Absolute Y = libListY + seriesPositions[name]. We
       gebruiken bewust GEEN measureLayout — die gaf in RN 0.83 een
       "ref.measureLayout must be called with a ref to ..."-runtime-
       error (nodeHandle-typing). */
  const scrollViewRef = useRef<ScrollView>(null);
  const searchBarYRef = useRef<number | null>(null);
  const seriesPositions = useRef<Record<string, number>>({});
  const libListYRef = useRef<number>(0);
  /* Iter 9dq v131 (2026-06-14): Y van de pillar-cards grid t.o.v. de
     ScrollView. Gebruikt door "Back to pillars" knop om terug te scrollen. */
  const pillarsYRef = useRef<number>(0);
  /* Operator, 26 september 2026: terug naar het 2-koloms grid — geen
     scroll-index/snap-ref meer nodig (dat hoorde bij de horizontale
     carrousel-versie, zie git-historie). */

  /* Y-positie van de auto-play-setting card. Doel voor scroll-intent
     'library-settings' vanuit Account → "Library settings". */
  const settingCardYRef = useRef<number | null>(null);

  /* Scroll-intent — twee paden, twee targets:
       'pricing'          → speler-CTA, scroll naar buyBlock onderaan
       'library-settings' → Account-link, scroll naar auto-play-card
     Beide gebruiken hetzelfde patroon: dubbele requestAnimationFrame om
     op onLayout-pass te wachten zodat de target-Y al gemeten is. */
  useEffect(() => {
    const scrollToTarget = (y: number | null) => {
      if (y == null) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, y - 24),
            animated: true,
          });
        });
      });
    };
    const handle = (target: string) => {
      if (target === 'top') scrollToTarget(0);
      else if (target === 'pricing')
        navigateAway(() => router.push('/subscribe?returnTo=audio' as never));
      else if (target === 'library-settings')
        scrollToTarget(settingCardYRef.current);
      else if (target === 'library')
        /* Scroll naar het begin van de serie-lijst (bovenste free card).
           Gebruikt door bracelet-owner landing → "Listen free sessions
           first" CTA (operator v13). */
        scrollToTarget(libListYRef.current);
    };
    const unsub = subscribeScrollIntent(handle);
    const pending = consumeScrollIntent();
    if (pending) handle(pending);
    return unsub;
  }, []);

  /* Bij actieve zoekquery: scroll automatisch naar de zoekbalk zodat hij
     in beeld blijft bovenop de autocomplete-overlay. Eén keer per
     transitie false→true. setTimeout(60) wacht op de re-render waarbij
     de discover-secties verdwijnen + libList van content wisselt. */
  useEffect(() => {
    if (!searchActive) return;
    const id = setTimeout(() => {
      const y = searchBarYRef.current;
      if (y != null) {
        scrollViewRef.current?.scrollTo({ y, animated: true });
      }
    }, 60);
    return () => clearTimeout(id);
  }, [searchActive]);

  /* Tap op een autocomplete-resultaat: query leeg (overlay sluit), evt.
     accordion-expand voor SESSIONS-tap, dan na re-render scrollen naar
     de doel-card. Dubbele requestAnimationFrame: 1e rAF wacht tot React
     commit klaar is; 2e rAF wacht tot native layout pass klaar is. Op
     dat moment heeft onLayout op de hermounting libList + cards de
     nieuwe Y-waarden geschreven en kunnen we ze veilig optellen. */
  const openSerieFromSearch = (seriesName: string, expand: boolean) => {
    if (expand) setExpandedSeries(seriesName);
    setSearchQuery('');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const cardY = seriesPositions.current[seriesName];
        const libY = libListYRef.current;
        if (cardY === undefined) {
          if (__DEV__) {
            console.warn(
              '[VIBEZCORE] no Y-position for series:',
              seriesName,
            );
          }
          return;
        }
        /* Spotlight-offset: 100px adem boven de gekozen card zodat de
           vorige card als peek zichtbaar blijft en de doel-card niet
           vastgeplakt voelt onder de zoekbalk. Fine-tune-bereik 80–120. */
        const targetY = Math.max(0, libY + cardY - 100);
        scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
      });
    });
  };

  /* Operator ("dit gaat naar een pillar-kaart die niet meer bestaat, de
     sessie moet gelinkt worden naar de audio in de nieuwe kaart"): de
     oude aanpak (Iter 9dq v152, hieronder gedocumenteerd voor de
     geschiedenis) klapte de serie inline open in de OUDE accordion-stijl
     op deze pagina zelf — die stijl (ronde FREE/FREE WITH ACCOUNT-pillen,
     "Partly listened") is sinds de 25/26-september-herbouw vervangen door
     het losse, gefocuste `/library/pillar/[key]`-scherm (zie dat bestand).
     Een tap op een Free Picks-sessie moet dus, net als een tap op een
     pillar-kaart zelf (regel ~1880 hierboven), naar DAT scherm navigeren
     — niet naar een inline kaart die in de rest van de app niet meer
     bestaat. `play`-param laat het pillar-scherm de aangetikte sessie
     meteen starten, zodat de tap ook echt "linkt" naar die audio i.p.v.
     enkel naar de juiste pijler te scrollen. */
  const openSessionFromFreePicks = (sess: Session) => {
    const targetPillar = SERIES_PILLAR[sess.series];
    if (!targetPillar) return;
    /* Operator ("ik zie altijd heel even de saleskaart alvorens naar de
       library te gaan"): de reset stond hier VOOR de navigatie — React
       rendert de ingeklapte standaard-grid (met de saleskaart) dan al
       één frame lang terwijl de screen-transitie nog moet starten, dus
       een korte flits. Verplaatst naar de focus-effect hieronder: de
       lijst klapt pas dicht op het moment dat je terugkomt (waar 'ie
       toch al ingeklapt hoort te zijn), niet meteen bij het weggaan. */
    navigateAway(() =>
      router.push(
        `/library/pillar/${targetPillar}?play=${encodeURIComponent(sess.url)}` as never,
      ),
    );
  };
  /* Accordion-toggle: zelfde serie nogmaals tikken → dicht (null).
     Andere serie tikken → die wordt de geopende; eventuele vorige sluit
     automatisch.
     Iter 9xx: bij sluiten/wisselen worden Soundscapes-subcat-expansies
     ook gereset zodat de subcards niet "blijven openstaan" achter de
     gesloten hoofdkaart. Volgende keer Soundscapes opent → alle 4
     subcats start ingeklapt (operator-feedback). */
  const toggle = (name: string) =>
    setExpandedSeries((prev) => {
      const next = prev === name ? null : name;
      setSubExpanded({});
      return next;
    });
  const toggleSub = (name: string) =>
    setSubExpanded((p) => ({ ...p, [name]: !p[name] }));

  /* ── Session-tap-handler ──
     Iter 9dq v63 (2026-06-03): tap loopt nu door useGatedOpenSession.
     Drie paden:
       - public tier (FREE) → openSession() → player → playback
       - account tier → AccountWallModal (huidig: dormant, geen sessies
                        op deze tier — fallback maakt alles public)
       - pro tier + actieve sub → openSession() → player → playback
       - pro tier + geen sub → push naar /subscribe?tier=yearly
     Het oude 60-sec-preview-pad (Gumroad-era) wordt vervangen door de
     IAP-bridge in subscribe.tsx. De audio-player blijft `shouldPreview()`
     intern doen voor edge-cases waar een PRO-sessie tóch in de player
     belandt (bv. via deep-link of auto-play-next), maar de hoofdroute
     voor tap-acties gaat nu door de gating-laag. */
  const openGated = useGatedOpenSession();
  const handleSessionPress = (sess: Session) => {
    navigateAway(() => openGated(sess));
  };

  /* ── BRACELET-OWNER LANDING PAGE (v11 — clean rebuild) ──
     Volledig herbouwd voor robuuste verhoudingen op alle scherm-
     groottes. Geen scroll, geen overflow, geen cut-off.
     Structuur:
       1. Root View met explicit paddingTop voor safe-area
       2. Foto-block (aspectRatio voor proporties) met gradient overlay
       3. Content-block (flex: 1) met space-between voor top/bottom groups
       4. paddingBottom rekening houdend met tab-bar (64) + system inset */
  if (showBraceletLanding && !exploredLibrary) {
    const TAB_BAR_HEIGHT = 64; // matches (tabs)/_layout.tsx
    /* Iter 9dq v23 (2026-06-02): copy upgrade — operator-keuze. Vervangt
       de generic "Not a playlist / Built for long-term growth"-bullets
       met een 4-stappen groei-trajectorie (Understand → Recognize → Gain
       → Build) die de luisteraar door z'n eigen reis loodst. Frame:
       inzicht → zelfreflectie → praktische toepassing → transformatie.
       Past bij premium psychologisch werk + bracelet-owner publiek. */
    const features = [
      'Understand the hidden patterns shaping your life',
      'Recognize what has been holding you back',
      'Gain practical direction for real-world challenges',
      'Build greater clarity, confidence and self-control',
    ];
    return (
      <View
        style={[
          s.bLandingRoot,
          { paddingTop: safeInsets.top },
        ]}
      >
        {/* Iter 9dq v37 (2026-06-03): COMPLETE REBUILD van de photo +
            gradient.
            Vereisten:
            1. Image: square source, top-aligned, geen hoofd-crop
            2. Visible gradient fade vanaf ongeveer 75% naar solid Brand.bg
               aan de bottom — zodat photo "naadloos" overgaat in dark
            3. Hoofd + face blijven 100% clean, alleen baard/jaw-area
               krijgt zachte fade
            4. Implementatie maximaal simpel en zichtbaar — één container,
               één image, één gradient. */}
        <View style={s.bLandingPhoto}>
          <Image
            source={{
              uri: 'https://vibezcore-audio.b-cdn.net/images/headphone%20audio%20library%20V%20vierkant.png',
            }}
            style={s.bLandingPhotoImg}
          />
          <LinearGradient
            colors={[
              'transparent',
              'transparent',
              'rgba(10,10,10,0.55)',
              '#0a0a0a',
            ]}
            /* Iter 9dq v38 (2026-06-03): fade-start 0.75 → 0.85 op
               operator-feedback "2cm lager". Fade-zone nu 15% ipv 25%.
               Meer photo blijft volledig clean.
               Iter 9dq v42 (2026-06-03): operator "nog lager beginnen".
               0.85 → 0.90. Alleen onderste ~10% (~26dp ≈ 7mm) heeft fade. */
            locations={[0, 0.90, 0.96, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>

        {/* CONTENT-BLOCK — flex: 1 met space-between layout.
            paddingBottom = TAB_BAR_HEIGHT + system inset + buffer.
            Garandeert dat de bottom-group altijd boven de tab-bar én
            boven de system gesture-bar zit.
            Iter 9dq v24 (2026-06-02): buffer verhoogd 64 → 96 (operator-
            feedback: CTA voelde te dicht bij de tab-bar op Samsung-
            devices met grote nav-bar).
            Iter 9dq v26 (2026-06-02): teruggezet naar 64 omdat de
            extra subtitle + langere bullets de content uit het visible
            area duwde. Foto-shrink (1.15 → 1.45 aspectRatio) levert
            net genoeg ruimte op. */}
        <View
          style={[
            s.bLandingContent,
            {
              /* Operator, 26 september 2026 ("cta niet bereikbaar, mini-
                 player staat erover op de welcome-pagina's"): deze
                 paddingBottom hield alleen rekening met de tab-bar, niet
                 met de mini-player die daar bovenop staat zodra een
                 sessie loopt — zelfde fix als de hoofd-ScrollView
                 hieronder al had (zie MINI_PLAYER_HEIGHT-gebruik verderop
                 in dit bestand). */
              paddingBottom:
                TAB_BAR_HEIGHT +
                safeInsets.bottom +
                64,
            },
          ]}
        >
          {/* Top groep */}
          <View>
            <Text style={s.bLandingEyebrow}>
              {needsAudioUpsell ? 'COMPLETE THE SYSTEM' : 'YOUR LIBRARY'}
            </Text>
            <Text style={s.bLandingTitle}>Audio Library.</Text>
            {/* Iter 9dq v25 (2026-06-02): authority-subtitle direct onder
                de hoofdtitle. "The intellectual legacy..." voegt
                instant-credibility toe vóór de bullets — leest als
                fundament van het product, niet als marketing-claim. */}
            <Text style={s.bLandingAuthoritySubtitle}>
              The intellectual legacy of history's greatest minds.
            </Text>
            <View style={s.bLandingFeatures}>
              {features.map((line, i) => (
                <View key={i} style={s.bLandingFeatureRow}>
                  <Text style={s.bLandingCheck}>✓</Text>
                  <Text style={s.bLandingFeatureText}>{line}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Iter 9dq v40 (2026-06-03): bottom groep nu twee text-links
              i.p.v. een filled button + small link. Operator-feedback:
              "verwijder de knop, gewoon tekst met link, daaronder klein
              listen free". Primary link: accent-blauw onderstreept;
              Secondary link: subtle dim grijs eronder. Past bij premium
              tone — minder commercieel knop-gevoel.
              Iter 9dq v41 (2026-06-03): marginTop 40 → 24 om beide
              links zichtbaar te houden bij grotere photo. */}
          <View style={{ marginTop: 24 }}>
            <Pressable
              style={s.bLandingPrimaryLink}
              onPress={() => {
                setExploredLibrary(true);
                if (needsAudioUpsell) {
                  setTimeout(() => requestScrollTo('pricing'), 100);
                }
              }}
              hitSlop={10}
              accessibilityLabel={
                needsAudioUpsell ? 'Get the Audio Library' : 'Enter your library'
              }
            >
              <Text style={s.bLandingPrimaryLinkText}>
                {needsAudioUpsell
                  ? 'Get full Audio Library →'
                  : 'Enter the library →'}
              </Text>
            </Pressable>
            {needsAudioUpsell && (
              <Pressable
                style={s.bLandingSecondaryLink}
                onPress={() => {
                  /* Operator-fix 2026-06-18 iter 2: bracelet-owner "Listen
                     free sessions first" gebruikt nu dezelfde inline Free
                     Picks-flow als een gewone gast die op de Free Picks-
                     card tapt — activePillarFilter='free' opent de 28
                     sessie-rijen in de library, tap op een sessie navigeert
                     naar de juiste serie waar 'ie speelt mét overige
                     sessies in die reeks zichtbaar. Voorheen pushte 'ie
                     naar /library/free (losse pagina), wat de flow brak. */
                  setExploredLibrary(true);
                  setActivePillarFilter('free');
                  /* Twee frames wachten zodat de library-sectie eerst
                     gerenderd is, dan scroll'en naar het Free Picks-blok. */
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      scrollViewRef.current?.scrollTo({
                        y: Math.max(0, libListYRef.current - 24),
                        animated: true,
                      });
                    });
                  });
                }}
                hitSlop={10}
                accessibilityLabel="Listen to free sessions first"
              >
                <Text style={s.bLandingSecondaryLinkText}>
                  Listen free sessions first
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.root}>
      {/* Operator, 15 september 2026: eenmalige "Where insight becomes
         identity"-intro, als overlay-laag i.p.v. het scherm te vervangen
         — zelfde eindresultaat als breath.tsx's `{intro ? (...) : (...)}`
         (enkel de intro zichtbaar/aanraakbaar, tab-bar blijft staan omdat
         dit gewoon INHOUD van deze tab is, geen apart stack-scherm), maar
         zonder de rest van deze zeer lange return te hoeven doorknippen.
         `zIndex`/`elevation` garanderen dat de laag boven staat ongeacht
         waar in de boom hij zit. */}
      {intro && (
        <View style={[StyleSheet.absoluteFill, s.introOverlay]}>
          <Animated.View style={[StyleSheet.absoluteFill, introKenBurnsStyle]}>
            <Image
              source={{ uri: `${CDN}/pic%20welcome%20audio%20library%20app.png` }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </Animated.View>
          <View style={s.introTextWrap}>
            <Animated.Text style={[s.introEyebrow, introEyebrowStyle]}>
              VIBEZCORE AUDIO LIBRARY
            </Animated.Text>
            <Animated.Text style={[s.introTitle, introTitleStyle]}>
              Where insight becomes identity
            </Animated.Text>
            <Animated.View
              style={[{ marginTop: 28, alignSelf: 'stretch' }, introCtaPressStyle]}
            >
              <Pressable
                onPress={finishAudioIntro}
                onPressIn={() => {
                  introCtaScale.value = withTiming(0.96, { duration: 80 });
                }}
                onPressOut={() => {
                  introCtaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
                }}
                style={[s.introCta, { overflow: 'hidden' }]}
                android_ripple={{ color: 'rgba(0,0,0,0.12)' }}
                accessibilityLabel="Explore the Audio Library"
              >
                <Text style={s.introCtaTxt}>Explore Audio Library</Text>
                <Animated.View
                  style={[s.introCtaShimmer, introShimmerStyle]}
                  pointerEvents="none"
                >
                  <LinearGradient
                    colors={['#ffffff00', '#ffffff9a', '#ffffff00']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </Pressable>
            </Animated.View>
          </View>
        </View>
      )}

      {/* De weg terug naar de onboarding (operator, 9 augustus 2026: "van
          daaruit misschien ook een zwevende knop die teruggaat naar waar ze
          gebleven waren"). Alleen zichtbaar via die ene ingang — wie hier
          via breathwork zelf binnenkomt heeft de Breath-tab al als weg
          terug, en twee knoppen voor hetzelfde is er één te veel.
          `router.back()` en niet `router.replace`: de onboarding-stap staat
          nog precies te wachten zoals hij was, want push laat hem gemount
          liggen — er hoeft niets onthouden te worden om terug te keren op
          exact dezelfde stap. */}
      {fromOnboarding && (
        <Pressable
          onPress={() => router.back()}
          style={s.backToOnboarding}
          hitSlop={10}
        >
          <ArrowLeft size={16} color="#0a0a0a" strokeWidth={2.4} />
          <Text style={s.backToOnboardingTxt}>Back to onboarding</Text>
        </Pressable>
      )}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          s.scroll,
          /* Iter 9dq v154+v155 (operator-fix 2026-06-18):
             - paddingTop: extra ademruimte boven de search bar zodat
               'ie niet tegen de status-bar plakt. SafeAreaView pakt al
               de basis-inset; deze 12px is puur visuele lucht.
             - paddingBottom: tab bar (64 + insets.bottom) + mini-player
               buffer alleen wanneer er audio actief is (playerState.session).
               Iter v176 (2026-06-30): operator "onderkant heeft te veel
               vrije ruimte" bij guest state zonder mini-player.
             Operator, 15 september 2026: MiniPlayer herbouwd van een
             ~110px versleepbare kaart naar een vaste 64px balk
             (`MINI_PLAYER_HEIGHT`) — de oude 96px-marge (getuned op de
             kaart) liet nu te veel lege ruimte over de balk hangen. */
          {
            paddingTop: 12,
            /* Operator ("onderaan de pagina minder zwarte ruimte"):
               beide cushions (guest 24→10, mini-player-buffer 12→4)
               getemperd — de tab bar/mini-player-hoogte zelf blijft
               volledig gereserveerd, enkel de extra ademruimte erbovenop
               is kleiner. */
            /* Operator, 7 okt 2026 ("te veel ruimte over"): de tabbalk is
               sinds 25 september een gewone balk die zijn eigen plek inneemt
               — hier nog eens 64 + inset reserveren was dubbel. Enkel de
               mini-speler (zweeft boven de balk) krijgt nog ruimte. */
            paddingBottom: 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── SIGN-IN / GET-ACCESS BANNER ──
            Iter 9dq v45 (2026-06-03): VERWIJDERD voor Free/Guest users.
            Operator-feedback: "we kunnen niet direct beginnen te verkopen".
            Een gast moet eerst vrije rondkijk-ruimte krijgen zonder dat
            er meteen een upsell-banner bovenaan staat. Conversie kan via
            de pricing-section verderop op de page (scroll naar pricing
            via "Get full library" link op de bracelet-owner landing of
            via expliciete tap op Account → Subscribe).
            Bracelet-owner banner ("Add Audio Library") blijft wel staan
            omdat dat een ingelogde context is met duidelijke meerwaarde. */}

        {/* ── BRACELET-OWNER UPSELL BANNER ── (operator-feedback 2026-05-30)
            Voor bracelet-only owners die ingelogd zijn. Vervangt de
            generieke sign-in banner met een gerichte "Add Audio Library
            to your bracelet" boodschap. Sub copy benadrukt het complete-
            system narratief (body + mind) ipv "kom de library kopen". */}
        {/* Iter 9dq v21 (2026-06-02): isSignedIn-check verwijderd uit
            conditie. In productie heeft real bracelet owner een token
            (isSignedIn=true), maar dev-override 'bracelet' niet. Beide
            scenarios moeten dezelfde upsell-banner zien. */}
        {/* Operator, 4 okt 2026 (smoothness-audit: "geen tik-animatie/
           haptic, inconsistent met de rest van de app"): was een kale
           `Pressable` — nu `CardBounce` (al bestaande, correcte wrapper
           elders in dit bestand), zelfde patroon als 8 andere plekken
           hieronder. */}
        {!hasSub && isBraceletOwner && (
          <CardBounce
            style={s.braceletUpsellBanner}
            onPress={() => requestScrollTo('pricing')}
            androidRipple={{ color: 'rgba(58,143,255,0.10)' }}
            accessibilityLabel="Add the Audio Library to your bracelet"
          >
            <View style={{ flex: 1 }}>
              <Text style={s.braceletUpsellEyebrow}>
                COMPLETE THE SYSTEM
              </Text>
              <Text style={s.braceletUpsellTitle}>
                Add the Audio Library
              </Text>
              <Text style={s.braceletUpsellSub}>
                You have the bracelet. Add structured psychological
                transformation alongside it.
              </Text>
            </View>
            <Text style={s.braceletUpsellArrow}>→</Text>
          </CardBounce>
        )}

        {/* Operator, 15 september 2026: "hero moet ook weg niet?" — klopt,
           dit was letterlijk dezelfde boodschap ("VIBEZCORE AUDIO
           LIBRARY" / "Where insight becomes identity") als de nieuwe
           full-photo intro die je al zag vóór je hier kwam. Verwijderd,
           zelfde reden als het BUILT ON-blok hierboven. */}

        {/* Operator, 15 september 2026 (tweede ronde, "drie lagen
           navigatie tegelijk is overkill"): de pagina had geen duidelijke
           titel — pills, twee grote witte knoppen en de tab-bar
           vochten allemaal om aandacht zonder dat de gebruiker één
           duidelijk "je bent hier"-anker had. Eén grote, linksgeaande
           paginatitel lost dat op, voor beide tiers (PRO zag hiervoor
           helemaal geen titel op dit scherm — alleen de zoekbalk). */}
        {/* Ruimte voor de Premium-knop bovenaan (PremiumPill, 7 okt 2026):
           zonder deze extra marge zat de knop tegen de titel. */}
        <Text style={[s.libPageTitle, !sub.isLoading && !sub.isPro && { paddingTop: 54 }]}>
          Audio Library
        </Text>

        {/* Operator, 26 september 2026 ("verwijder subheader"): de 4-fasen-
           regel (Understanding · Awareness · Regulation · Integration)
           onder de titel is verwijderd, incl. de `PHASE_LABELS`-constante.
           `libPageSubheader`-style staat nog in de stylesheet voor evt.
           rollback. */}

        {/* Operator, 26 september 2026 ("bundel de knoppen in één
           doorlopende balk, zoals de native iOS Segmented Control in
           Apple Music/Instellingen"): losse pil-chips vervangen door ÉÉN
           doorlopende, omkaderde balk met dunne verticale scheidingslijnen
           tussen de segmenten — geeft maximale rust bovenaan i.p.v. drie
           losse vlakken. Blijven wel losse navigatie-ingangen naar
           verschillende schermen (/history, /library/free of /new,
           /favorites), geen "actieve staat"-toggle. */}
        {/* Operator, 4 okt 2026 (smoothness-audit): deze 4 segmenten
           gebruikten kale `Pressable`s zonder tik-animatie/haptic — nu
           `CardBounce`, zelfde patroon als de rest van dit bestand. */}
        <View style={s.libQuickLinksBar}>
          <CardBounce
            style={s.libQuickLinkSegment}
            onPress={() => navigateAway(() => router.push('/history'))}
            hitSlop={8}
            accessibilityLabel="View your listening journey"
          >
            <Text style={s.libQuickLinkText}>Your Journey</Text>
          </CardBounce>
          <View style={s.libQuickLinkDivider} />
          {lastPlayed ? (
            <CardBounce
              style={s.libQuickLinkSegment}
              onPress={showWelcomePopup}
              hitSlop={8}
              accessibilityLabel="Resume your last listened session"
            >
              <Text style={s.libQuickLinkText}>Last Listened</Text>
            </CardBounce>
          ) : !hasSub ? (
            <CardBounce
              style={s.libQuickLinkSegment}
              onPress={() => navigateAway(() => router.push('/library/free'))}
              hitSlop={8}
              accessibilityLabel="Browse all free sessions"
            >
              <Text style={s.libQuickLinkText}>Free Sessions</Text>
            </CardBounce>
          ) : (
            <CardBounce
              style={s.libQuickLinkSegment}
              onPress={() => navigateAway(() => router.push('/library/new'))}
              hitSlop={8}
              accessibilityLabel="Browse new sessions"
            >
              <Text style={s.libQuickLinkText}>New</Text>
            </CardBounce>
          )}
          <View style={s.libQuickLinkDivider} />
          {/* Operator, 26 september 2026 ("waar is favorites?"): stond
             alleen bij PRO — favoriteren werkt net zo goed op de gratis
             sessies, dus nu voor iedereen zichtbaar. `/library/favorites`
             heeft zelf geen tier-gate. */}
          <CardBounce
            style={s.libQuickLinkSegment}
            onPress={() => navigateAway(() => router.push('/library/favorites'))}
            hitSlop={8}
            accessibilityLabel="Browse favorites"
          >
            <Text style={s.libQuickLinkText}>Favorites</Text>
          </CardBounce>
        </View>

        {/* Operator, 15 september 2026: "BUILT ON + Emerson quote" hier
           verwijderd — sinds de nieuwe full-photo intro (foto + "Where
           insight becomes identity" + CTA) is dat merk-statement al
           gemaakt vóór de gebruiker hier komt. Nóg een marketingtekst-
           plus-quote blok direct daarna las als een website-landingpagina
           (hero → uitleg → quote → dan pas navigatie) i.p.v. een app, die
           opent op content/navigatie. De tab begint nu direct met de
           chips en de pijlers hieronder. */}

        {/* ── SEARCH BAR ── boven pillars (operator-fix 2026-06-18).
            Voorheen stond search ÓNDER de pillar-grid; operator wil 'm
            bovenaan voor sneller toegang. Alleen PRO-users (zien volle
            library; voor guests is search voor 14 free sessies overhead). */}
        {hasSub && (
          <View
            style={s.searchWrap}
            onLayout={(e) => {
              searchBarYRef.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search sessions, series…"
              placeholderTextColor="rgba(255,255,255,0.4)"
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchActive ? (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={12}
                style={s.searchClear}
                android_ripple={{
                  color: 'rgba(255,255,255,0.10)',
                  borderless: true,
                }}
              >
                <Text style={s.searchClearGlyph}>×</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* ── 4 PIJLERS ── altijd zichtbaar (behalve tijdens search)
            Iter 9dq v131 (2026-06-14): tap = filter + auto-scroll naar
            library section (zoals website). Tap dezelfde pillar opnieuw
            = un-filter. Long-press opent detail-popup (legacy). Card-content
            volgt website-pattern: PILLAR 0X label boven, naam + tagline
            onder, VIEW X SESSIONS + pijl onderaan.
            Operator-fix 2026-06-17: pillar cards moeten zichtbaar zijn
            voor élk account (audio PRO, bracelet-only en full PRO ook),
            niet alleen voor gasten/free. Was eerder gegate'd op !hasSub. */}
        {!searchActive && (
          <>
            {/* Subtiele hint boven de pillar cards — signaleert dat reeksen
                onder elke card zitten. Operator-feedback 2026-06-14, gelijk
                aan website .pillar-cards-hint. Alleen tonen voor non-PRO
                (PRO's library is "instructieloos" — ze kennen de structuur). */}
            {/* Operator, 26 september 2026 (Apple-redesign, "Unified Card"):
               instructietekst verwijderd — "een knop moet er zo tastbaar
               uitzien dat je niet hoeft te zeggen dat je erop kan tikken"
               (Apple HIG). De kaarten hieronder communiceren dat nu zelf
               via schaduw/diepte. */}

            <View
              onLayout={(e) => {
                pillarsYRef.current = e.nativeEvent.layout.y;
              }}
            >
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                paddingHorizontal: PILLAR_SIDE_INSET,
              }}
            >
              {PILLARS.map((p, pillarIdx) => {
                const isActiveFilter = activePillarFilter === p.key;
                return (
                  /* Operator, 15 september 2026 (Apple-upgrade): "gestaffelde
                     dashboard-entry, kaarten schuiven van beneden naar boven
                     in via een elastische iOS-veer, 40ms stagger per kaart" —
                     was een platte opacity-fade (`FadeIn`), nu `FadeInUp`
                     met een spring-easing voor het "hoogwaardig, soepel"
                     gevoel dat gevraagd werd. */
                  <Animated.View
                    key={p.num}
                    entering={FadeInUp.delay(150 + pillarIdx * 40)
                      .springify()
                      .damping(16)}
                    style={[
                      { width: PILLAR_CARD_WIDTH, marginBottom: PILLAR_CARD_GAP },
                      breathStyles[pillarIdx],
                    ]}
                  >
                  {/* Operator, 26 september 2026 (Apple-redesign, definitief):
                     de "Unified Card" (tekst op de foto) is teruggedraaid —
                     "een categorie-kaart mag nooit een andere opbouw hebben
                     dan een serie-kaart, dat breekt de visuele eenheid".
                     Terug naar tekst-ONDER-de-foto (zoals de serie-kaarten),
                     maar zonder het aparte witte C.surface-paneel, randlijn
                     en chevron van de vorige versie — tekst zweeft nu los op
                     de pagina-achtergrond (Content-Card-patroon), lichter en
                     rustiger. Operator-vervolg zelfde dag: "PILLAR 0X" hoort
                     WEL terug op de foto (niet onder de titel) — maar zacht:
                     kleine, dun-uitgesneden scrim bovenaan, gedempt wit
                     label, geen zwaar contrast. Titel/sessietal blijven
                     eronder op de pagina-achtergrond. */}
                  <CardBounce
                    style={{ width: '100%' }}
                    onPress={() =>
                      navigateAway(() =>
                        router.push(`/library/pillar/${p.key}` as never),
                      )
                    }
                    onLongPress={() => setDetailPillar(p)}
                    androidRipple={{ color: 'rgba(255,255,255,0.08)' }}
                    accessibilityLabel={`Open ${p.name}`}
                  >
                    <View
                      style={[
                        s.pillar,
                        {
                          width: '100%',
                          /* Operator ("pillar 1 is kleiner, tekst hoort
                             telkens bij de foto"): de imgAspect-hoogte per
                             kaart (vorige iteratie) liet elke kaart een
                             andere hoogte krijgen omdat de 4 foto's niet
                             identiek van verhouding zijn (sovereignty
                             0.667 vs de rest 0.75) — een grid met
                             ongelijke rijhoogtes oogt kapot/onuitgelijnd.
                             Terug naar een vaste, uniforme kaarthoogte
                             voor het GRID (zoals elke echte foto-grid,
                             Apple Music incluis) — de volledige-foto-
                             zonder-crop-eis geldt voor het EEN-foto-
                             tegelijk pillar-/player-scherm, niet voor een
                             grid met 6 tegels naast elkaar.
                             Operator ("maak kaart kleiner dan de
                             andere... minder hoog en transparant blur"):
                             Soundscapes & Affirmations is bewust kleiner
                             dan de 4 echte pijlers — staat als laatste
                             rij naast Free Picks, dus geen volgende rij
                             die erdoor scheeftrekt. */
                          height:
                            p.key === 'tools'
                              ? PILLAR_CARD_HEIGHT * 0.5
                              : PILLAR_CARD_HEIGHT,
                          marginBottom: 0,
                        },
                        /* Operator, 26 september 2026 ("geen accentkleur bij
                           omlijning kaarten, enkel grijze of witte"):
                           selectie-rand is nu wit, geen Bio-Teal. Accent is
                           voor CTA's/links, niet voor kaart-decoratie.
                           Operator ("moet elegant oplichten zoals ons
                           protocol voorschrijft"): huisstijl §2.5 —
                           "Geselecteerde rand: rgba(255,255,255,0.4),
                           géén kleur, enkel opaciteit/dikte draagt de
                           selectie." Solide #ffffff was té fel/hard;
                           dezelfde 1px, enkel de opaciteit gaat van 0.14
                           (rust) naar 0.4 (actief) — dat IS het
                           "oplichten", geen extra dikte of volle wit. */
                        isActiveFilter && {
                          borderColor: 'rgba(255,255,255,0.4)',
                        },
                        /* Operator ("de fotos zelf moeten lichte
                           omlijsting krijgen"): C.border (#1a1a1a) was
                           vrijwel onzichtbaar tegen de #0a0a0a-achtergrond.
                           Zelfde opaciteit-i.p.v.-kleur-conventie als de
                           sessiekaarten elders (rgba(255,255,255,0.14)). */
                        !isActiveFilter && { borderColor: 'rgba(255,255,255,0.14)' },
                      ]}
                    >
                      {/* Operator ("icoon moet echt wit, kaart
                         transparant blur — nu te grijs"): de BlurView
                         stond VOOR op de foto en vervaagde daarmee ook de
                         witte balkjes zelf (grijs). De waveform-PNG heeft
                         een écht transparante achtergrond (geverifieerd
                         via alpha-kanaal) — de blur hoort dus ACHTER de
                         foto (het matglas-kaartvlak), niet erover, zodat
                         de witte balkjes zelf scherp/wit blijven. */}
                      {p.key === 'tools' && (
                        <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
                      )}
                      <Image
                        source={{ uri: p.img }}
                        style={
                          p.key === 'resilience'
                            ? /* Operator ("foto mag zelf beetje zakken zodat
                                 de rots volledig in beeld is, onderkant mag
                                 afgesneden worden"): standaard cover
                                 centreert verticaal en sneed de rots
                                 (bovenaan de foto) af. Top-anchored i.p.v.
                                 gecentreerd — hoogte berekend op de échte
                                 beeldverhouding (1086/1448), dus het is de
                                 ONDERkant die nu wegvalt buiten de kaart. */
                              {
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                /* Hoogte = EXACT de natuurlijke
                                   beeldverhouding (1086/1448) bij deze
                                   breedte: box-aspect === beeld-aspect,
                                   dus 'cover' hoeft nergens te croppen
                                   behalve waar de kaart zelf (korter,
                                   overflow:hidden) 'm afkapt. */
                                height: PILLAR_CARD_WIDTH / (1086 / 1448),
                              }
                            : p.key === 'tools'
                              ? /* Operator ("icoon soundscapes mag beetje
                                   kleiner zodat ze visueel gelijk zijn aan
                                   de ster"): 'contain' (niet 'cover') +
                                   inset, anders schaalt cover gewoon een
                                   ander stuk van het transparante canvas
                                   uit i.p.v. het icoon zelf te verkleinen. */
                                { ...StyleSheet.absoluteFillObject, margin: 20 }
                              : s.pillarImg
                        }
                        resizeMode={p.key === 'tools' ? 'contain' : 'cover'}
                      />
                      {/* Operator ("pilaar 1 2 3 moeten onderaan buiten de
                         foto staan, aantal sessies mag weg — staat al op
                         de volgende pagina"): geen scrim/label meer op de
                         foto zelf — de foto is nu volledig schoon. De
                         "PILLAR 0X"-eyebrow verhuist naar de tekst
                         eronder (zie hieronder), de sessie-telling is
                         weg. */}
                    </View>
                    {/* Content — los op de pagina-achtergrond, geen paneel/
                       rand/chevron, zelfde ritme als de eyebrow/titel/sub
                       van de serie-kaarten verderop. Operator, 26 september
                       2026 ("linkerkant van de foto moet perfect uitlijnen
                       met de tekst eronder"): geen paddingHorizontal meer —
                       gaf een 2px "gezaagde" verspringing t.o.v. de
                       fotorand. */}
                    {/* Operator (Apple-HIG-brief, "titels precies op één
                       horizontale lijn"): vaste minHeight i.p.v. losse,
                       inhoud-afhankelijke hoogte — "Strategic Execution &
                       Wealth" wrapt naar 2 regels, "Social Mastery" niet,
                       en die verspringing duwde de VOLGENDE grid-rij scheef
                       (flexWrap legt een rij op de hoogte van z'n hoogste
                       kaart). Elke tekstblok reserveert nu ruimte voor het
                       langste geval, dus élke rij sluit strak aan. */}
                    <View style={{ paddingTop: 10, minHeight: 68 }}>
                      {p.num !== '05' && (
                        /* Operator ("kickers schreeuwen om aandacht — Apple
                           maakt ze klein, flinterdun, midgrijs"): was
                           10px/Bold — nu kleiner en op het dunste
                           beschikbare gewicht (geen Light geladen), zodat
                           de titel de "held" van de tekst blijft. */
                        <Text
                          style={{
                            color: C.dim,
                            fontFamily: BrandFonts.regular,
                            fontSize: 9,
                            letterSpacing: 1.1,
                            textTransform: 'uppercase',
                            marginBottom: 3,
                          }}
                        >
                          {`Pillar ${p.num}`}
                        </Text>
                      )}
                      <Text
                        style={[
                          s.pillarName,
                          {
                            fontSize: 18,
                            lineHeight: 21,
                            color: C.text,
                            letterSpacing: -0.3,
                          },
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {p.name}
                      </Text>
                    </View>
                  </CardBounce>
                  </Animated.View>
                );
              })}

              {/* ── 6e CARD: FREE PICKS — "Taste the Library" ──
                  Operator-fix 2026-06-17 iter 2: card hoort in de pillar-
                  grid (positie 6, onder pillar 4 in 2-col layout). Tap
                  zet activePillarFilter='free' wat de library-sectie
                  switcht naar de 10 free-sessie-rijen (getEffectiveTier
                  === 'public', geverifieerd 27 september 2026), en gebruiker kan
                  doorklikken naar de juiste serie. "Back to pillars"-knop
                  brengt 'm terug naar de pillar-grid.
                  Iter 9dq v153 (operator-fix 2026-06-17): NIET tonen
                  voor PRO-users (audio PRO + full PRO). Die hebben alles
                  al — een "free picks" entry-point is dan visuele ruis. */}
              {!hasSub && (() => {
                const isFreeActive = activePillarFilter === 'free';
                /* Operator, 14 september 2026 ("we hebben beslist geen 27
                   sessies in free"): `sess.free` is een legacy-veld en
                   telt inmiddels 28 — na het 1-september-besluit (10
                   standaard gratis, 17 pas met de 7-dagen trial) is de
                   ENIGE correcte telling `getEffectiveTier(sess)==='public'`. */
                const freeCount = SESSIONS.filter(
                  (sess) => getEffectiveTier(sess) === 'public',
                ).length;
                return (
                  <Animated.View
                    key="free-picks"
                    style={[
                      { width: PILLAR_CARD_WIDTH, marginBottom: PILLAR_CARD_GAP },
                      breathStyles[5],
                    ]}
                  >
                  {/* Operator, 26 september 2026 (Content-Card-consistentie):
                     deze kaart had als enige nog tekst/badge/chevron bovenop
                     de foto — nu hetzelfde patroon als de pillar-kaarten:
                     schone foto (met een zachte "FREE" scrim, zelfde stijl
                     als "PILLAR 0X"), content los eronder op de
                     pagina-achtergrond. */}
                  {/* Operator ("free picks moet ook aangepast, oude kleuren
                     layout etc"): had nog een losse `<Pressable>` zonder
                     tik-animatie/haptiek (de pillar-kaarten kregen
                     CardBounce, deze werd gemist omdat 'ie buiten de
                     .map() staat), een hardcoded fontFamily-string i.p.v.
                     BrandFonts.extrabold, en geen selectie-gloed bij
                     actief (de pillar-kaarten hebben die wel). Nu 1-op-1
                     hetzelfde patroon als de pillar-kaarten hierboven. */}
                  <CardBounce
                    style={{ width: '100%' }}
                    onPress={() => {
                      if (isFreeActive) {
                        setActivePillarFilter(null);
                      } else {
                        setActivePillarFilter('free');
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            scrollViewRef.current?.scrollTo({
                              y: Math.max(0, libListYRef.current - 24),
                              animated: true,
                            });
                          });
                        });
                      }
                    }}
                    androidRipple={{ color: 'rgba(255,255,255,0.08)' }}
                    accessibilityLabel="Free picks — first session of every series"
                  >
                    <View
                      style={[
                        s.pillar,
                        {
                          width: '100%',
                          /* Operator ("kleiner moet even groot als
                             soundscapes"): zelfde verkleining als de
                             Soundscapes & Affirmations-kaart hiernaast in
                             de laatste rij, zodat die rij weer gelijk
                             oogt. */
                          height: PILLAR_CARD_HEIGHT * 0.5,
                          marginBottom: 0,
                        },
                        isFreeActive
                          /* Operator ("moet elegant oplichten zoals ons
                             protocol voorschrijft"): huisstijl §2.5 —
                             rgba(255,255,255,0.4), geen solide wit. */
                          ? { borderColor: 'rgba(255,255,255,0.4)' }
                          /* Operator ("free 10 moet weg uit de foto en
                             zoals de ander ook omlijnen"): zelfde lichte
                             hairline-rand als de 4 pillar-kaarten en
                             Soundscapes & Affirmations — was hier nog de
                             onzichtbare C.border. */
                          : { borderColor: 'rgba(255,255,255,0.14)' },
                      ]}
                    >
                      {/* Operator ("de ster mag de randen niet raken" →
                         "niet gecentreerd"): eerste poging combineerde
                         s.pillarImg's expliciete width/height:'100%' met
                         een top/left/right/bottom-inset — die twee
                         botsen (Yoga geeft width:100% voorrang boven de
                         links+rechts-afgeleide breedte), dus de foto
                         schoof naar rechts i.p.v. te centreren. Losse
                         stijl zonder width/height: enkel de vier
                         inset-offsets bepalen nu positie ÉN grootte. */}
                      {/* Operator ("ster mag beetje groter, icoon
                         soundscapes beetje kleiner, zodat ze visueel
                         gelijk zijn"): inset 20→12. */}
                      <Image
                        source={{ uri: 'https://vibezcore-audio.b-cdn.net/images/pic%20free%20picks%202.png' }}
                        style={{ position: 'absolute', top: 12, left: 12, right: 12, bottom: 12 }}
                        resizeMode="contain"
                      />
                      {/* Operator ("free 10 moet weg uit de foto"): geen
                         scrim/label meer op de foto zelf — zelfde
                         beslissing als "PILLAR 0X" hierboven. De
                         "Taste the library · X sessions"-tekst onder de
                         foto communiceert het aantal al. */}
                    </View>
                    <View style={{ paddingTop: 10, minHeight: 68 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: `${AudioAccent}26`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            style={{
                              color: AudioAccent,
                              fontFamily: BrandFonts.extrabold,
                              fontSize: 11,
                              marginLeft: 1.5,
                            }}
                          >
                            ▶
                          </Text>
                        </View>
                        <Text
                          style={[
                            s.pillarName,
                            { fontSize: 18, lineHeight: 21, color: C.text, letterSpacing: -0.3 },
                          ]}
                          numberOfLines={1}
                        >
                          Free Picks
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: isFreeActive ? C.text : C.dim,
                          fontFamily: BrandFonts.medium,
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        {isFreeActive ? `Listening · ${freeCount} sessions` : `Taste the library · ${freeCount} sessions`}
                      </Text>
                    </View>
                  </CardBounce>
                  </Animated.View>
                );
              })()}
            </View>
            </View>

          </>
        )}

        {/* Iter 9dq v155 (operator 2026-06-18): EMERSON-QUOTE en EXPLORE
            SERIES verwijderd uit deze positie.
            - Emerson is verhuisd naar BOVEN, direct onder BUILT ON
              (thematisch sterker: intellectual legacy + Emerson-citaat).
            - EXPLORE SERIES header ("Not just inspiration / Real
              transformation") is volledig gedropt — was visuele ruis,
              de pillar-cards dragen de boodschap al via hun taglines en
              elke card toont al de session-count.
            - Default-state ruimte onder pillars is nu schoon (geen lege
              sectie meer voor non-PRO scrolers). */}

        {/* Search bar + Library chips zijn verhuisd naar BOVEN de pillar-
            grid (iter 9dq v154, operator 2026-06-18) — zie blok hierboven
            vlak na de marketing-intro. */}

        {/* Iter 9dq v155 (operator 2026-06-18): autoplay-toggle verhuisd
            naar de "BACK TO PILLARS + Auto-play" control-row die alleen
            verschijnt wanneer een pillar-filter actief is. Voorheen stond
            'ie altijd los onder de pillars wat een lege/random indruk gaf.
            Zie de control-row in de libList onderaan. */}

        {/* Operator, 25 september 2026 (Apple-restyle, punt 1 — "dubbele
           instructie op één scherm"): de hint-card hier ("↑ Tap a pillar
           above...") herhaalde letterlijk dezelfde boodschap als de tekst
           al boven de carrousel ("Tap a card to start or continue your
           journey", zie hierboven bij `!hasSub &&`). Apple vertrouwt erop
           dat herkenbare kaart-UI (foto + paginering) zelf al "tik/swipe
           mij" communiceert — geen tweede, apart omrand tekstblok nodig.
           Verwijderd, de tekst bovenaan de carrousel blijft de enige hint. */}

        {/* ── DE LIBRARY — serie-kaarten als bibliotheek (blauwdruk §3.5) ──
            Eén unit per serie: cinematic kaart (foto + eyebrow + titel + sub)
            met chevron rechtsboven; tap = expand inline, chevron roteert.
            Onder de kaart altijd zichtbaar: groene FREE-strip(s) — één per
            gratis sessie (1:1 uit library.tsx). Inline expansie = sessierijen.
            Soundscapes opent naar 4 subcat-kaarten (blauwdruk §3.5b),
            elk standaard ingeklapt. */}
        <View
          style={s.libList}
          onLayout={(e) => {
            libListYRef.current = e.nativeEvent.layout.y;
          }}
        >
          {searchActive ? (
            /* ── SEARCH-MODUS: Spotify-stijl autocomplete met 3 secties ──
               Volgorde: Series → Sessions → Inspirators. Per categorie
               max 5 zichtbaar; "+ N more" als de lijst langer is. */
            !hasAnyMatches ? (
              <View style={s.emptySearch}>
                <Text style={s.emptySearchGlyph}>🔍</Text>
                <Text style={s.emptySearchTitle}>
                  No results for "{searchQuery.trim()}"
                </Text>
                <Text style={s.emptySearchSub}>
                  Try a different search term.
                </Text>
              </View>
            ) : (
              <>
                {seriesMatches.length > 0 && (
                  <View style={s.acGroup}>
                    <Text style={s.acGroupEyebrow}>— SERIES —</Text>
                    {seriesMatches.slice(0, 5).map((ser) => {
                      const photo = SERIES_PHOTO[ser.name];
                      return (
                        <CardBounce
                          key={'ser:' + ser.name}
                          style={s.acRow}
                          onPress={() => openSerieFromSearch(ser.name, false)}
                          androidRipple={{ color: 'rgba(255,255,255,0.04)' }}
                        >
                          <View style={s.acArt}>
                            {photo ? (
                              <Image
                                source={{ uri: photo }}
                                style={s.acArtImg}
                              />
                            ) : null}
                          </View>
                          <View style={s.acBody}>
                            {/* Operator, 1 okt 2026 ("namen van audio niet
                               afbreken en 3 puntjes zetten"): serienaam
                               mag niet afgekapt worden — `acRow` heeft geen
                               vaste hoogte (alignItems center, flexibel). */}
                            <Text style={s.acTitle}>
                              {ser.name}
                            </Text>
                            <Text style={s.acSub}>
                              {ser.sessions.length}{' '}
                              {ser.sessions.length === 1
                                ? 'session'
                                : 'sessions'}
                            </Text>
                          </View>
                          <Text style={s.acChev}>›</Text>
                        </CardBounce>
                      );
                    })}
                    {seriesMatches.length > 5 && (
                      <Text style={s.acMore}>
                        + {seriesMatches.length - 5} more
                      </Text>
                    )}
                  </View>
                )}

                {sessionMatches.length > 0 && (
                  <View style={s.acGroup}>
                    <Text style={s.acGroupEyebrow}>— SESSIONS —</Text>
                    {sessionMatches.slice(0, 5).map((sess) => {
                      /* Zelfde pijler-foto-bron als overal elders
                         (zie Free Picks-lijst hieronder voor toelichting). */
                      const photo =
                        PILLAR_META[SERIES_PILLAR[sess.series]]?.img ?? SERIES_PHOTO[sess.series];
                      const isFav = favorites.has(sess.url);
                      return (
                        <CardBounce
                          key={'sess:' + sess.url}
                          style={s.acRow}
                          onPress={() =>
                            openSerieFromSearch(sess.series, true)
                          }
                          androidRipple={{
                            color: 'rgba(255,255,255,0.04)',
                          }}
                        >
                          <View style={s.acArt}>
                            {photo ? (
                              <Image
                                source={{ uri: photo }}
                                style={s.acArtImg}
                              />
                            ) : null}
                          </View>
                          <View style={s.acBody}>
                            {(() => {
                              /* Iter 9dq v60 (2026-06-03): 3-tier badge. */
                              const tier = getEffectiveTier(sess);
                              const label = tierBadgeLabel(tier);
                              if (!label) return null;
                              return (
                                <Text
                                  style={[
                                    s.acTag,
                                    { color: tierBadgeColor(tier) },
                                  ]}
                                >
                                  {label}
                                </Text>
                              );
                            })()}
                            <Text style={s.acTitle}>
                              {sess.title}
                            </Text>
                            <Text style={s.acSub}>
                              {sess.series}
                            </Text>
                          </View>
                          <HeartButton
                            active={isFav}
                            onPress={() => toggleFavorite(sess)}
                          />
                        </CardBounce>
                      );
                    })}
                    {sessionMatches.length > 5 && (
                      <Text style={s.acMore}>
                        + {sessionMatches.length - 5} more
                      </Text>
                    )}
                  </View>
                )}

                {inspiratorMatches.length > 0 && (
                  <View style={s.acGroup}>
                    <Text style={s.acGroupEyebrow}>— INSPIRATORS —</Text>
                    {inspiratorMatches.slice(0, 5).map((insp) => {
                      const ser = SERIES.find(
                        (x) => x.name === insp.seriesName,
                      );
                      const count = ser ? ser.sessions.length : 0;
                      return (
                        <CardBounce
                          key={'insp:' + insp.name}
                          style={s.acRow}
                          onPress={() =>
                            openSerieFromSearch(insp.seriesName, false)
                          }
                          androidRipple={{
                            color: 'rgba(255,255,255,0.04)',
                          }}
                        >
                          <View style={s.acAvatar}>
                            <Text style={s.acAvatarTxt}>
                              {initialsOf(insp.name)}
                            </Text>
                          </View>
                          <View style={s.acBody}>
                            <Text style={s.acTitle}>
                              {insp.name}
                            </Text>
                            <Text style={s.acSub}>
                              Inspired {count}{' '}
                              {count === 1 ? 'session' : 'sessions'}
                            </Text>
                          </View>
                          <Text style={s.acChev}>›</Text>
                        </CardBounce>
                      );
                    })}
                    {inspiratorMatches.length > 5 && (
                      <Text style={s.acMore}>
                        + {inspiratorMatches.length - 5} more
                      </Text>
                    )}
                  </View>
                )}
              </>
            )
          ) : (
            <>
              {/* Iter 9pp: navTiles verplaatst naar boven (samen met search-
                  utility zone). Series-cards starten direct na de hero-block. */}
              {/* Iter 9dq v129 (2026-06-14): per-pillar grouping. Outer loop
                  itereert PILLAR_ORDER, inner blijft per-serie rendering. Geen
                  enkele wijziging aan de card-content, player, autoplay,
                  paywall — alleen visuele groepering + section headers. */}
              {/* ── CONTROL ROW: BACK TO PILLARS + Auto-play ──
                  (operator-fix 2026-06-18, iter 9dq v155)
                  Twee functioneel-gerelateerde session-controls naast
                  elkaar in één rij: links de back-knop (terug naar
                  pillar-grid), rechts de auto-play toggle. Voorheen
                  hingen ze los van elkaar wat een random/onorganisch
                  effect gaf. Alleen zichtbaar wanneer een pillar-filter
                  actief is — bij default-state staat de hint-card op
                  hun plek. */}
              {activePillarFilter && (
                <View
                  onLayout={(e) => {
                    settingCardYRef.current = e.nativeEvent.layout.y;
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    /* Operator-fix 2026-06-18 iter 4: marginHorizontal
                       verwijderd zodat de BACK TO PILLARS-knop links
                       uitlijnt met de chapter-header en series-cards
                       eronder (die op libList-paddingHorizontal:16 zitten
                       zonder eigen margin). Voorheen 16+16=32 ingesprongen. */
                    marginTop: 32,
                    marginBottom: 6,
                    gap: 12,
                  }}
                >
                  {/* Operator, 14 september 2026 (Apple-stijl): omlijnde
                     signaalblauwe pil weg — pure, minimalistische
                     tekstlink met een native pijlicoon, in Royal Indigo. */}
                  <Pressable
                    onPress={() => {
                      setActivePillarFilter(null);
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          scrollViewRef.current?.scrollTo({
                            y: Math.max(0, pillarsYRef.current - 24),
                            animated: true,
                          });
                        });
                      });
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingVertical: 10,
                    }}
                    hitSlop={8}
                  >
                    <ChevronRight
                      size={16}
                      color={ROYAL_INDIGO}
                      strokeWidth={2.4}
                      style={{ transform: [{ rotate: '180deg' }] }}
                    />
                    <Text
                      style={{
                        color: ROYAL_INDIGO,
                        fontFamily: BrandFonts.semibold,
                        fontSize: 15,
                      }}
                    >
                      Pillars
                    </Text>
                  </Pressable>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: C.dim,
                        fontFamily: 'Inter_600SemiBold',
                        fontSize: 12,
                        letterSpacing: 0.2,
                      }}
                    >
                      Auto-play
                    </Text>
                    {/* ⓘ info-knop (operator-fix 2026-06-18): tap opent
                        uitleg over wat Auto-play doet. User-initiated zodat
                        we niet onnodig pop-ups gooien naar power-users die
                        de feature al kennen. */}
                    <Pressable
                      onPress={() => setAutoPlayInfoOpen(true)}
                      hitSlop={10}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 1,
                        borderColor: C.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      accessibilityLabel="What does auto-play do?"
                    >
                      <Text
                        style={{
                          color: C.dim,
                          fontFamily: 'Inter_700Bold',
                          fontSize: 10,
                          lineHeight: 12,
                        }}
                      >
                        i
                      </Text>
                    </Pressable>
                    {/* Operator, 14 september 2026: Auto-play is een
                       instelling, geen "nu actief"-afspeelstatus — die
                       laatste is waar Signal Blue voor gereserveerd is.
                       Royal Indigo voor deze toggle. */}
                    <Switch
                      value={autoPlayNext}
                      onValueChange={setAutoPlayNext}
                      trackColor={{ false: C.border, true: ROYAL_INDIGO }}
                      thumbColor={'#ffffff'}
                    />
                  </View>
                </View>
              )}
              {PILLAR_ORDER.map((pillar, idx) => {
                /* Destination flow (operator-besluit 2026-06-14): default state
                   toont ALLEEN pillar cards, geen series. Series verschijnen
                   pas wanneer luisteraar een pillar tapt. Matcht website UX
                   en voorkomt cognitive overload door 25+ cards.
                   Iter 9dq v152 (operator 2026-06-17): 'free' mode toegevoegd.
                   Wanneer activePillarFilter === 'free' rendert deze loop EEN
                   keer (idx === 0) met ALLE series die een free-sessie hebben
                   onder een "Free Picks"-chapter-header. Hierdoor kan gebruiker
                   per serie z'n free-sessie spelen + de overige (PRO-)sessies
                   in die reeks zien. */
                /* Iter 9dq v153 (operator-fix 2026-06-17): free-mode niet
                   beschikbaar voor PRO-users. Veiligheidsguard zodat een
                   PRO-user die via stale state in free-mode zou belanden
                   automatisch alles ziet (filter cleared). */
                const isFreeMode = activePillarFilter === 'free' && !hasSub;
                if (isFreeMode && idx !== 0) return null;
                if (!isFreeMode && activePillarFilter !== pillar) return null;
                const pillarSeries = isFreeMode
                  ? SERIES.filter((s) =>
                      s.sessions.some((x) => x.free),
                    )
                  : SERIES.filter((s) => SERIES_PILLAR[s.name] === pillar);
                if (pillarSeries.length === 0) return null;
                const pillarMeta = isFreeMode ? null : PILLAR_META[pillar];
                return (
                  <View
                    key={isFreeMode ? 'free-section' : `pillar-${pillar}`}
                    style={{
                      marginTop:
                        isFreeMode || pillar === PILLAR_ORDER[0] ? 0 : 24,
                    }}
                  >
                    {/* SECTION header — pillar-pattern of free-pattern.
                        Beide hetzelfde "centered + outlined panel" zodat het
                        visueel duidelijk een chapter-marker is en niet de
                        titel van de serie-card eronder. */}
                    <View
                      style={{
                        marginBottom: 20,
                        marginTop: 8,
                        paddingVertical: 18,
                        paddingHorizontal: 20,
                        borderRadius: 14,
                        borderWidth: 1,
                        /* Operator ("het groen in kaarten moet weg"): stond
                           nog op een groene rgba-tint (de vorige "navy/Bio-
                           Teal → neutraal"-comment hierboven klopte dus niet
                           meer met de code) — nu écht neutraal grijs/wit,
                           zelfde behandeling voor beide modi. */
                        borderColor: isFreeMode
                          ? 'rgba(255,255,255,0.18)'
                          : C.border,
                        backgroundColor: isFreeMode
                          ? 'rgba(255,255,255,0.04)'
                          : C.surface,
                        alignItems: 'center',
                      }}
                    >
                      {/* Operator, 14 september 2026 (Apple-font-framework):
                          Context Label/Eyebrow-rol — 11px Bold, +1.5, gedimd
                          i.p.v. felblauw (was 11px ExtraBold/+2.4/accent). */}
                      <Text
                        style={{
                          color: C.dim,
                          fontFamily: BrandFonts.bold,
                          fontSize: 11,
                          letterSpacing: 1.5,
                          textTransform: 'uppercase',
                          marginBottom: 8,
                          textAlign: 'center',
                        }}
                      >
                        {/* Iter v168 (2026-06-28): toon SESSIONS-count ipv
                            SERIES, zodat het getal matcht met de Free Picks
                            tile op de Library. `freeCount` op regel 1765 zit
                            binnen een aparte IIFE-scope en is hier NIET
                            bereikbaar — inline herberekening.
                            Operator, 14 september 2026: `sess.free` (28) →
                            `getEffectiveTier===='public'` (10) — dit moet de
                            échte, altijd-gratis-zonder-account telling
                            tonen, niet het legacy `free`-veld. */}
                        {isFreeMode
                          ? `FREE PICKS · ${SESSIONS.filter((sess) => getEffectiveTier(sess) === 'public').length} SESSIONS`
                          : `PILLAR ${pillarMeta!.num}`}
                      </Text>
                      {/* Section-naam — Section Header (H2)-rol, 22px Bold,
                          -0.3 (was 26px ExtraBold/-0.5, eigen willekeurige
                          waarde). */}
                      <Text
                        style={{
                          color: C.text,
                          fontFamily: BrandFonts.bold,
                          fontSize: 22,
                          letterSpacing: -0.3,
                          lineHeight: 27,
                          marginBottom: 6,
                          textAlign: 'center',
                        }}
                      >
                        {isFreeMode ? 'Taste the Library' : pillarMeta!.name}
                      </Text>
                      {/* Tagline — Body-rol, 15px Regular. */}
                      <Text
                        style={{
                          color: C.dim,
                          fontFamily: BrandFonts.regular,
                          fontSize: 15,
                          lineHeight: 20,
                          textAlign: 'center',
                        }}
                      >
                        {isFreeMode
                          ? 'First session of every series — yours. Tap a session to play it inside its series.'
                          : pillarMeta!.tagline}
                      </Text>
                    </View>

                    {/* ── Free Picks SESSIE-LIJST (operator-fix 2026-06-17 iter 3) ──
                        In 'free' mode tonen we niet de 28 serie-cards maar 28
                        sessie-rijen — elke rij is de gratis intro-sessie van
                        een serie + subtitle die de serie-naam toont. Tap →
                        switcht naar die serie's pillar, expand de serie, scroll
                        ernaartoe, en start de sessie. Eindstand voor gebruiker:
                        sessie speelt MET de andere sessies in die reeks
                        zichtbaar boven/onder. */}
                    {isFreeMode && (
                      <View style={{ marginBottom: 20 }}>
                        {/* Operator, 14 september 2026: deze lijst toonde
                            alle 28 `free:true`-sessies — inclusief de 18
                            die inmiddels trial-only zijn. "Free Picks"
                            hoort enkel de échte 10 altijd-gratis sessies te
                            tonen. */}
                        {SESSIONS.filter((sess) => getEffectiveTier(sess) === 'public')
                          .sort(
                            (a, b) =>
                              FREE_ORDER.indexOf(a.title) - FREE_ORDER.indexOf(b.title),
                          )
                          .map((sess) => {
                          /* Operator ("vanuit de kaart Taste the library
                             niet, daar nog oude fotos"): dit inline
                             lijstje (Free Picks-kaart → activePillarFilter
                             ==='free') is een aparte renderpad t.o.v.
                             LibraryListRow (/library/free) en had de
                             pijler-foto-fix nog niet — zelfde bron als
                             overal elders. */
                          const photo =
                            PILLAR_META[SERIES_PILLAR[sess.series]]?.img ?? SERIES_PHOTO[sess.series];
                          return (
                            <Pressable
                              key={`free-row-${sess.url}`}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                paddingVertical: 12,
                                paddingHorizontal: 4,
                                borderBottomWidth: 0.5,
                                borderBottomColor: 'rgba(255,255,255,0.06)',
                              }}
                              onPress={() => openSessionFromFreePicks(sess)}
                              android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
                              accessibilityLabel={`Play ${sess.title} from ${sess.series}`}
                            >
                              {/* Thumbnail */}
                              <View
                                style={{
                                  width: 52,
                                  height: 52,
                                  borderRadius: 10,
                                  overflow: 'hidden',
                                  backgroundColor: '#1a1a1a',
                                }}
                              >
                                {photo ? (
                                  <Image
                                    source={{ uri: photo }}
                                    style={{ width: '100%', height: '100%' }}
                                  />
                                ) : null}
                              </View>
                              {/* Title + series */}
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text
                                  style={{
                                    color: C.free,
                                    fontFamily: BrandFonts.extrabold,
                                    fontSize: 9,
                                    letterSpacing: 1.2,
                                    textTransform: 'uppercase',
                                    marginBottom: 3,
                                  }}
                                >
                                  FREE
                                </Text>
                                <Text
                                  style={{
                                    color: C.text,
                                    fontFamily: 'Inter_700Bold',
                                    fontSize: 14.5,
                                    letterSpacing: -0.2,
                                    lineHeight: 18,
                                    marginBottom: 3,
                                  }}
                                  numberOfLines={2}
                                >
                                  {sess.title}
                                </Text>
                                {/* Operator, 1 okt 2026 ("namen niet
                                   afbreken met …"): serienaam mag niet
                                   afgekapt worden. */}
                                <Text
                                  style={{
                                    color: C.dim,
                                    fontFamily: 'Inter_500Medium',
                                    fontSize: 12,
                                    letterSpacing: -0.05,
                                  }}
                                >
                                  {`Series · ${sess.series}`}
                                </Text>
                              </View>
                              {/* Share-knop — iter v174 (2026-06-30): personal
                                  opener ("I'm listening to…") + brand-pitch
                                  (Free Personal Growth Audio Sessions grounded
                                  in Science, Philosophy & Psychology + bracelet
                                  KS) + Play Store install. Operator v173-feedback:
                                  sessie-naam alleen zegt outsiders niks. */}
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  const url = 'https://www.vibezcore.com/app';
                                  const pitch =
                                    "Available now: In-depth audio sessions built on the theories, principles, and insights of history's greatest thinkers—whose work continues to shape our understanding of human nature, psychology, behavior, and personal growth.\n\n" +
                                    'Launching Early 2027 — Smart Bead Bracelet for instant state control.';
                                  Share.share({
                                    title: 'VIBEZCORE',
                                    message: `I'm listening to "${sess.title}" on VIBEZCORE.\n\n${pitch}\n\nInstall the app and listen to free full sessions: ${url}`,
                                    url,
                                  }).catch(() => {});
                                }}
                                hitSlop={8}
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 6,
                                  marginRight: 2,
                                }}
                                accessibilityLabel={`Share ${sess.title}`}
                              >
                                <Share2 size={18} color={C.free} strokeWidth={2.2} />
                              </Pressable>
                              {/* Play-pijl */}
                              <Text
                                style={{
                                  color: C.free,
                                  fontFamily: BrandFonts.extrabold,
                                  fontSize: 18,
                                  marginRight: 6,
                                }}
                              >
                                ▶
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}

                    {!isFreeMode && pillarSeries.map((ser) => {
            const photo = SERIES_PHOTO[ser.name];
            const eyebrow = SERIES_SUBTITLE[ser.name];
            const subline = SERIES_SUB[ser.name];
            const frees = ser.sessions.filter((x) => x.free);
            const isOpen = expandedSeries === ser.name;
            const isSoundscapes = ser.name === 'Soundscapes';
            /* Badge-conditie: toon kleine NEW-pill rechtsboven naast
               VIEW ALL als deze serie minstens één sessie heeft die
               isNew()=true levert. Gebruikt zelfde NEW_BASELINE +
               NEW_DAYS-window als het New-filter. */
            const hasNew = ser.sessions.some((sess) => isNew(sess.added));
            /* FIX 5: "now playing"-glow op de hele serie-card wanneer er
               een sessie van DEZE serie geladen is in de audio-service.
               Werkt ongeacht play/pause-state — gloed BLIJFT tijdens pauze
               omdat de sessie nog actief is (per spec). Progress-strip
               update on the fly via usePlayerState re-render. */
            const isCardActive = playerState.session?.series === ser.name;
            const cardPct =
              isCardActive && playerState.durationSec > 0
                ? Math.min(
                    100,
                    (playerState.positionSec / playerState.durationSec) * 100
                  )
                : 0;
            return (
              <View
                key={ser.name}
                style={[s.libCardUnit, isCardActive && s.libCardUnitActive]}
                onLayout={(e) => {
                  seriesPositions.current[ser.name] = e.nativeEvent.layout.y;
                }}
              >
                {/* Operator, 25 september 2026 (Apple-restyle, punt 3 —
                   "tekst wordt nooit over een gezicht heen geplaatst"): de
                   titel/eyebrow/subline stonden tot nu toe als overlay
                   BOVENOP de foto (bottom-gradient + witte tekst). Apple
                   plaatst tekst nooit op een portret — leesbaarheid + rust
                   gaan voor. Foto blijft nu een schoon, tekstloos beeld
                   (enkel de NEW-badge, een badge/icoon mag wel op een foto
                   — zie het losse fotografie-advies); alle serie-info
                   verhuist naar `libCardBody` hieronder, nu een gewoon
                   vlak (`C.surface`) ONDER de foto i.p.v. een absolute
                   laag erover — exact hetzelfde "kaart + los blok
                   eronder"-patroon dat de FREE-balk hier al gebruikte. */}
                {/* Operator, 4 okt 2026 (smoothness-audit: "geen tik-
                   animatie/haptic — het meest-aangetikte element van dit
                   scherm"): kale `Pressable` → `CardBounce`. */}
                <CardBounce
                  style={s.libCard}
                  onPress={() => toggle(ser.name)}
                  androidRipple={{ color: 'rgba(255,255,255,0.06)' }}
                  accessibilityLabel={
                    isOpen
                      ? 'Hide sessions'
                      : isSoundscapes
                        ? 'Show all categories'
                        : 'Show all sessions'
                  }
                >
                  {photo ? (
                    /* iter 9dq v139 (2026-06-15): aanpak omgegooid.
                       Transform-based focal shift werkte niet zichtbaar
                       op series cards. Nu: voor focal-series rendert de
                       Image expliciet langer dan de card (height = 100% +
                       extra), met top:0 zodat de TOP van de foto in beeld
                       blijft (parent libCard heeft overflow:hidden). Voor
                       overige series: ongewijzigd standaard cover. */
                    SERIES_FOCAL[ser.name] ? (
                      <Image
                        source={{ uri: photo }}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: 0,
                          /* Card is 200px hoog. We maken het Image-element
                             extra hoog zodat cover de foto schaalt op die
                             hoogte → onderkant wordt geclipt, TOP zichtbaar.
                             Per-serie tunable via SERIES_FOCAL.translateY:
                             grotere waarde = meer extra hoogte = grotere
                             "zakken"-effect (meer van de top zichtbaar). */
                          height: 200 + SERIES_FOCAL[ser.name].translateY * 2,
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Image source={{ uri: photo }} style={s.libCardBg} />
                    )
                  ) : null}
                  {/* FIX 6: foto-tint is bewust verwijderd. Foto blijft
                     kraakhelder. Enkel nog een korte top-fade i.p.v. de
                     vroegere wand-tot-wand bottom-gradient — die diende
                     alleen om tekst-over-de-foto leesbaar te houden, en
                     die tekst staat er niet meer. De fade blijft puur om
                     de NEW-badge leesbaar te houden tegen elke foto. */}
                  <LinearGradient
                    colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']}
                    locations={[0, 1]}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      height: 56,
                    }}
                    pointerEvents="none"
                  />
                  {/* Pill-cluster rechtsboven — alleen NEW-badge (wanneer
                     hasNew=true). Een badge op een foto is prima Apple-
                     stijl (App Store/Music doen dit ook); enkel leestekst
                     over een gezicht/portret is het probleem, niet elk
                     grafisch element. */}
                  {hasNew && (
                    <View style={s.pillCluster}>
                      <View style={s.flatNewPill}>
                        <Text style={s.flatNewPillTxt}>NEW</Text>
                      </View>
                    </View>
                  )}
                </CardBounce>
                {/* FIX 5: 3px progress-strip — stond voorheen "net boven
                   libCardBody" binnen dezelfde flex-end-container als de
                   foto; nu een gewone sibling exact op de naad foto/tekst,
                   dus optisch identiek. LinearGradient #3a8fff → #5ba4ff. */}
                {isCardActive ? (
                  <View style={s.libCardProgressTrack}>
                    <LinearGradient
                      colors={[SIGNAL_BLUE, SIGNAL_BLUE_HOVER]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        s.libCardProgressFill,
                        { width: `${cardPct}%` },
                      ]}
                    />
                  </View>
                ) : null}
                <CardBounce
                  style={s.libCardBody}
                  onPress={() => toggle(ser.name)}
                  androidRipple={{ color: 'rgba(10,10,12,0.05)' }}
                  accessibilityLabel={
                    isOpen
                      ? 'Hide sessions'
                      : isSoundscapes
                        ? 'Show all categories'
                        : 'Show all sessions'
                  }
                >
                  <View style={{ flex: 1 }}>
                    {eyebrow ? (
                      <Text style={s.libCardEyebrow}>{eyebrow}</Text>
                    ) : null}
                    {/* Titel + chevron op ÉÉN regel — vervangt de vorige
                       zwevende "All sessions ⌄"-glaspil op de foto (punt 3
                       van het actieplan: "een strakke, subtiele tekstlink
                       of klein chevron-icoontje rechts naast de titel"). */}
                    <View style={s.libCardTitleRow}>
                      <Text
                        style={[s.libCardTitle, { flex: 1 }]}
                        numberOfLines={2}
                      >
                        {ser.name}
                      </Text>
                      <Text style={s.libCardChevInline}>
                        {isOpen ? '⌃' : '⌄'}
                      </Text>
                    </View>
                    {subline ? (
                      <Text style={s.libCardSubline}>{subline}</Text>
                    ) : null}
                  </View>
                </CardBounce>

                {/* FREE-balk(en) onder de kaart — bron .vz-free-under-card.
                   Eén balk per gratis sessie. ALLEEN tonen voor guest/non-PRO
                   users — PRO heeft full access, FREE-promotie is dan
                   misleidend. */}
                {!hasSub && frees.map((sess) => {
                  /* Iter 9dq v61 (2026-06-03): pill is tier-aware ipv
                     series-level aggregate. Public → groene "FREE",
                     account → blauwe "FREE WITH ACCOUNT". Tier-resolutie
                     via getEffectiveTier zodat data zonder explicit
                     accessTier-veld via de fallback in access-tier.ts
                     goed wordt geclassificeerd. */
                  const sessTier = getEffectiveTier(sess);
                  const pillText = tierBadgeLabel(sessTier) ?? 'FREE';
                  const pillTierColor = tierBadgeColor(sessTier);
                  /* FIX 9: "active" = url-match, ongeacht play/pause. Hele
                     blokje blijft blauw tijdens pauze, consistent met de
                     card-glow (FIX 5+). De play-knop icon switcht binnen
                     active op basis van playerState.playing (▶ ↔ ⏸). */
                  const isActive =
                    !!playerState.session?.url && urlEq(playerState.session.url, sess.url);
                  const isPlayingHere = isActive && playerState.playing;
                  const pct =
                    isActive && playerState.durationSec > 0
                      ? Math.min(
                          100,
                          (playerState.positionSec / playerState.durationSec) *
                            100
                        )
                      : 0;
                  return (
                    <CardBounce
                      key={sess.url}
                      style={[
                        s.libFreeRow,
                        isActive && s.libFreeRowActive,
                      ]}
                      onPress={() => navigateAway(() => openGated(sess))}
                      androidRipple={{
                        color: isActive
                          ? 'rgba(58,143,255,0.18)'
                          : 'rgba(255,255,255,0.10)',
                      }}
                    >
                      <View
                        style={[
                          s.freePlayBtn,
                          isActive && s.freePlayBtnActive,
                        ]}
                      >
                        {isActive ? (
                          <LinearGradient
                            colors={[SIGNAL_BLUE, SIGNAL_BLUE_HOVER]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={s.freePlayBtnGradient}
                          />
                        ) : null}
                        {/* Operator, 14 september 2026: was ALTIJD wit,
                           ook in de idle-staat (geen gradient-achtergrond
                           dan, enkel het lichte Royal-Indigo-tint-vlak
                           hierboven) — wit-op-wit maakte het icoon
                           onzichtbaar. Actief = wit op de blauwe
                           gradient; idle = Royal Indigo op het tint-vlak. */}
                        <PlayPauseGlyph
                          size={14}
                          color={isActive ? '#ffffff' : ROYAL_INDIGO}
                          playing={isPlayingHere}
                        />
                      </View>
                      <View style={s.freeContent}>
                        <View style={s.freeTopRow}>
                          <Text style={s.freeSessionTitle}>{sess.title}</Text>
                          <View
                            style={[
                              s.freePill,
                              /* Tier-kleur als bg/border-tint wanneer niet
                                 active. Active overschrijft met accent-blauw
                                 (now-playing-state). */
                              !isActive && {
                                backgroundColor: `${pillTierColor}1a`,
                                borderColor: `${pillTierColor}4d`,
                              },
                              isActive && s.freePillActive,
                            ]}
                          >
                            <Text
                              style={[
                                s.freePillText,
                                !isActive && { color: pillTierColor },
                                isActive && s.freePillTextActive,
                              ]}
                            >
                              {pillText}
                            </Text>
                          </View>
                          <HeartButton
                            active={favorites.has(sess.url)}
                            onPress={() => toggleFavorite(sess)}
                          />
                        </View>
                        {sess.desc ? (
                          <Text style={s.freeSessionDesc}>{sess.desc}</Text>
                        ) : null}
                        {/* Status-regel ("Partly listened" / "Fully
                           listened" / "Fully listened x2") alleen wanneer
                           er history bestaat voor deze sessie-url.
                           Iter 9dq v111 (2026-06-04): label nu via
                           getListenedLabelByUrl met fc-count.
                           Operator, 25 september 2026 (Apple-restyle punt
                           4 — "vervang de tekst-status door iets
                           visueels"): de "▶"/"✓" tekst-glyphs waren
                           emoji-achtige tekens, geen echte vector-iconen.
                           ER IS GEEN opgeslagen afspeel-percentage voor een
                           NIET-actieve sessie (`HistoryEntry` heeft enkel
                           `full`+`fc`, geen laatst-bekende positie) — een
                           letterlijke, proportionele voortgangsbalk zou
                           dus verzonnen data zijn. In plaats daarvan een
                           eerlijk, compact icoon-paar: een gevulde `Check`
                           voor af, een gestippelde cirkel (`CircleDashed`,
                           "in progress", geen specifiek percentage) voor
                           gestart-niet-af — kleiner en rustiger dan de
                           vorige tekstregel, zonder een percentage te
                           verzinnen dat er niet is. */}
                        {(() => {
                          const label = getListenedLabelByUrl(sess.url);
                          if (!label) return null;
                          const color = label.isFull ? GREEN : C.accent;
                          const Icon = label.isFull ? Check : CircleDashed;
                          return (
                            <View style={s.statusRow}>
                              <Icon size={12} color={color} strokeWidth={2.5} />
                              <Text style={[s.statusRowText, { color }]}>
                                {label.text}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                      {isActive ? (
                        <View style={s.freeProgressTrack}>
                          <LinearGradient
                            colors={[SIGNAL_BLUE, SIGNAL_BLUE_HOVER]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[s.freeProgressFill, { width: `${pct}%` }]}
                          />
                        </View>
                      ) : null}
                    </CardBounce>
                  );
                })}

                {/* Inline expansie — non-Soundscapes: sessierijen.
                    Operator-keuze 2026-05-27: voor uitgelogde/free users
                    de free-sessies WEGFILTEREN uit deze list — die staan
                    al als groene promo-balk hierboven (regel ±1207).
                    Anders verschijnt elke free-sessie 2× in de UI. Voor
                    pro users (hasSub=true) toon alles want er is geen
                    promo-balk dan. */}
                {isOpen && !isSoundscapes && (() => {
                  const rows = ser.sessions.filter((sess) => hasSub || !sess.free);
                  return (
                    <View style={s.libExpand}>
                      {rows.map((sess, i) => (
                        <SessionRow
                          key={sess.url}
                          session={sess}
                          photo={photo}
                          canPlay={resolveAccess(sess, !!isSignedIn || sub.isPro, sub.isPro, sub.isTrialing) === 'allowed'}
                          onPress={() => handleSessionPress(sess)}
                          isFavorite={favorites.has(sess.url)}
                          onToggleFav={() => toggleFavorite(sess)}
                          isActive={!!playerState.session?.url && urlEq(playerState.session.url, sess.url)}
                          isPlaying={
                            !!playerState.session?.url && urlEq(playerState.session.url, sess.url) &&
                            playerState.playing
                          }
                          hideTag={hasSub}
                          separated={i < rows.length - 1}
                        />
                      ))}
                    </View>
                  );
                })()}

                {/* Inline expansie — Soundscapes: 4 subcat-kaarten, ingeklapt. */}
                {isOpen && isSoundscapes && (
                  <View style={s.libExpand}>
                    {SUBCAT_ORDER.map((subName) => {
                      const info = SUBCAT_INFO[subName];
                      if (!info) return null;
                      const subSessions = ser.sessions.filter(
                        (x) => x.subseries === subName,
                      );
                      if (subSessions.length === 0) return null;
                      const subOpen = !!subExpanded[subName];
                      return (
                        <View key={subName} style={s.libSubcatUnit}>
                          {/* Operator, 4 okt 2026 (smoothness-audit): kale
                             `Pressable` → `CardBounce`. */}
                          <CardBounce
                            style={s.libSubcatCard}
                            onPress={() => toggleSub(subName)}
                            androidRipple={{ color: 'rgba(255,255,255,0.06)' }}
                          >
                            <Image
                              source={{ uri: info.photo }}
                              style={s.libSubcatBg}
                            />
                            <View style={s.libSubcatGrad} />
                            {/* Iter 9qq (operator-feedback 2026-05-30):
                                chevron verhuisd van top-right → bottom-right
                                + icon-only (⌄ closed, ⌃ open). Match met
                                main series card moreToggleBR. */}
                            <View style={s.libCardChev}>
                              <Text style={s.libCardChevTxt}>
                                {subOpen ? '⌃' : '⌄'}
                              </Text>
                            </View>
                            <View style={s.libSubcatBody}>
                              <Text style={s.libSubcatEyebrow}>
                                {info.eyebrow}
                              </Text>
                              <Text style={s.libSubcatTitle}>{subName}</Text>
                            </View>
                          </CardBounce>
                          {subOpen && (
                            <View style={s.libExpand}>
                              {subSessions.map((sess, i) => (
                                <SessionRow
                                  key={sess.url}
                                  session={sess}
                                  photo={info.photo}
                                  canPlay={resolveAccess(sess, !!isSignedIn || sub.isPro, sub.isPro, sub.isTrialing) === 'allowed'}
                                  onPress={() => handleSessionPress(sess)}
                                  isFavorite={favorites.has(sess.url)}
                                  onToggleFav={() => toggleFavorite(sess)}
                                  isActive={
                                    !!playerState.session?.url && urlEq(playerState.session.url, sess.url)
                                  }
                                  isPlaying={
                                    !!playerState.session?.url && urlEq(playerState.session.url, sess.url) &&
                                    playerState.playing
                                  }
                                  hideTag={hasSub}
                                  separated={i < subSessions.length - 1}
                                />
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
                    {/* Tweede back-to-pillars knop — na de laatste series
                        card in de gefilterde pijler. Voorkomt dat gebruiker
                        helemaal naar boven moet scrollen vanaf de onderste
                        card. Subtiele variant: minder prominent dan de
                        bovenste knop, maar zelfde functie. Iter 9dq v152:
                        ook tonen bij 'free' mode (al-pillars-view). */}
                    {(activePillarFilter === pillar || isFreeMode) && (
                      <Pressable
                        onPress={() => {
                          setActivePillarFilter(null);
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                              scrollViewRef.current?.scrollTo({
                                y: Math.max(0, pillarsYRef.current - 24),
                                animated: true,
                              });
                            });
                          });
                        }}
                        style={{
                          alignSelf: 'center',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          marginTop: 24,
                          marginBottom: 12,
                          borderRadius: 999,
                          backgroundColor: `${ROYAL_INDIGO}0F`,
                        }}
                        android_ripple={{ color: 'rgba(58,143,255,0.12)' }}
                        accessibilityLabel="Back to pillars"
                      >
                        {/* Operator, 15 september 2026 ("back to pillars
                           tekst moet duidelijker"): Royal Indigo i.p.v.
                           weggedimd grijs + een tint-achtergrond, zodat
                           het als een echte, herkenbare knop leest i.p.v.
                           een bijna-onzichtbaar label. */}
                        <Text
                          style={{
                            color: ROYAL_INDIGO,
                            fontFamily: 'Inter_700Bold',
                            fontSize: 13,
                          }}
                        >
                          ↑
                        </Text>
                        <Text
                          style={{
                            color: ROYAL_INDIGO,
                            fontFamily: 'Inter_600SemiBold',
                            fontSize: 13,
                            letterSpacing: 0.4,
                          }}
                        >
                          Back to pillars
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}

          {/* ── 13e card — VIBEZCORE ROADMAP / "What's Coming Next" ──
              Iter 9dq v48 (2026-06-03): operator-besluit — card tijdelijk
              verborgen op alle pagina's. /coming-route blijft intact
              (src/app/coming.tsx + Stack-registratie via screen-eigen
              <Stack.Screen>), alleen de toegangs-card uit de library is
              uit zicht. Styles (libCardStandalone, exploreText,
              comingEyebrow) blijven staan om restore triviaal te houden.
              JSX hieronder bewust uitgecomment ipv verwijderd zodat
              re-enable één blok-uncomment is.

              ── Originele JSX (re-enable: verwijder de wrapping comment) ──
              <View style={s.libCardUnit}>
                <Pressable
                  style={[s.libCard, s.libCardStandalone]}
                  onPress={() => router.push('/coming')}
                  android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
                >
                  <Image
                    source={{
                      uri: 'https://vibezcore-audio.b-cdn.net/images/whats-coming.png',
                    }}
                    style={s.libCardBg}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={[
                      'transparent',
                      'rgba(0,0,0,0.15)',
                      'rgba(0,0,0,0.4)',
                      'rgba(0,0,0,0.92)',
                    ]}
                    locations={[0, 0.4, 0.55, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={s.pillCluster}>
                    <Pressable
                      style={s.viewAllPill}
                      onPress={() => router.push('/coming')}
                      hitSlop={6}
                      android_ripple={{
                        color: 'rgba(255,255,255,0.10)',
                        borderless: true,
                      }}
                    >
                      <Text style={s.exploreText}>Explore</Text>
                      <Text style={s.viewAllChev}>›</Text>
                    </Pressable>
                  </View>
                  <View style={s.libCardBody}>
                    <Text style={s.comingEyebrow}>VIBEZCORE ROADMAP</Text>
                    <Text style={s.libCardTitle}>What's Coming Next</Text>
                    <Text style={s.libCardSubline}>
                      New series, new tools, new layers
                    </Text>
                  </View>
                </Pressable>
              </View>
              ─────────────────────────────────────────────────────────── */}
            </>
          )}
        </View>

        {/* Operator, 7 okt 2026: het kopen-blok onderaan is weg — de
           Premium-knop bovenaan en het abonnementsscherm (/subscribe, zelfde
           kaart) zijn de plek om te kiezen. Wie hier vroeger naartoe
           scrolde ('pricing'), gaat nu rechtstreeks naar /subscribe. */}

        {/* ── DISCLAIMER — Independent Content & Third-Party References ──
            Uitklapbaar, default DICHT. Visueel + tekst exact uit bron
            index_2_correct.html `.legal-toggle` / `.legal-body`. Niets
            verzonnen, geen herformulering. Geen native SVG-dep — schild
            via 🛡-emoji, chevron via "›" met rotatie zoals serie-cards.
            Verbergen tijdens search zodat de autocomplete-overlay focus
            houdt. */}
        {!searchActive && (
        <View style={s.legalBlock}>
          <Pressable
            style={s.legalToggle}
            onPress={toggleLegal}
            android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
          >
            {/* Operator, 15 september 2026 (Apple-upgrade): "rode schild-
                icoon vloekt met de serene rust" — een emoji negeert de
                `color`-stijl (rendert altijd zijn eigen, vaak gekleurde
                glyph), dus `s.legalIcon`'s kleur deed hier al die tijd
                niets. Een lucide `Shield`-component respecteert `color`
                wél. */}
            <Shield size={15} color={C.dim} strokeWidth={2} style={{ marginRight: 10 }} />
            <Text style={s.legalLabel} numberOfLines={2}>
              Independent Content & Third-Party References
            </Text>
            <Text style={[s.legalChev, legalOpen && s.legalChevOpen]}>›</Text>
          </Pressable>
          {legalOpen && (
            <View style={s.legalBody}>
              <Text style={s.legalPara}>
                All audio sessions published on VIBEZCORE are original,
                independently produced works. The content represents our own
                creative interpretation and synthesis of widely available
                knowledge, drawing on general scientific literature,
                publicly accessible research, and interdisciplinary insights
                in fields such as neuroscience, performance psychology, and
                personal development.
              </Text>
              <Text style={s.legalPara}>
                Where reference is made to public figures, researchers,
                authors, or thought leaders, this is done solely for
                contextual, educational, or descriptive purposes. Such
                references do not imply any form of affiliation,
                collaboration, endorsement, sponsorship, or direct
                involvement by those individuals or their organisations.
                VIBEZCORE is not associated with, approved by, or connected
                to any of the persons or entities referenced.
              </Text>
              <Text style={s.legalPara}>
                No proprietary content, copyrighted materials, scripts,
                books, courses, podcasts, or protected works from any third
                party have been reproduced, adapted, or used as a basis for
                our audio productions.
              </Text>
              <Text style={s.legalSubHead}>
                Educational & Informational Use Only
              </Text>
              <Text style={s.legalPara}>
                The content on this platform is intended for personal
                development, motivational, and educational purposes only.
                It does not constitute medical, psychological, therapeutic,
                or clinical advice. If you are experiencing mental health
                challenges, please consult a qualified healthcare
                professional.
              </Text>
              <Text style={s.legalSubHead}>No Liability</Text>
              <Text style={s.legalPara}>
                VIBEZCORE accepts no liability for any decisions made,
                actions taken, or outcomes experienced based on the content
                of these audio sessions.
              </Text>
            </View>
          )}
        </View>
        )}

        {/* ── SMART BEAD BRACELET (operator, 7 okt 2026: "de bracelet moet
            al gepromoot worden, nu bijna nergens vindbaar") ──
            Strategie (CLAUDE.md §3): bracelet = premium upgrade van de app.
            Zelfde kaartvorm als de serie-kaarten erboven (foto + "Explore ›"
            + eyebrow/titel/regel), zodat hij thuishoort in de bibliotheek.
            Voor iedereen (er zijn nog geen eigenaars); niet tijdens zoeken of
            in een gefilterde pijler. Opent de productpagina.
            Vervolg zelfde dag ("weinig ingangen"): van helemaal onderaan naar
            direct onder de vier pijlers, zodat je hem ziet zonder te zoeken.
            Vervolg ("independent moet boven de bracelet"): ná de
            Independent Content-disclaimer, als afsluiter van de pagina. */}
        {!searchActive && !activePillarFilter && (
          /* Zelfde opbouw als de pijler-tegels erboven: foto, daaronder
             label + titel (Content-Card-regel: tekst onder de foto). */
          <Pressable
            style={({ pressed }) => [s.braceletCard, pressed && { opacity: 0.85 }]}
            onPress={() => void openBraceletWebsite()}
            accessibilityRole="button"
            accessibilityLabel="Smart Bead Bracelet, launching early 2027"
          >
            {/* Operator, 7 okt 2026: duidelijk apart blok — label boven de
                foto, links; alles in een eigen kader met afgeronde hoeken. */}
            <Text style={s.braceletCardEyebrow}>LAUNCHING EARLY 2027</Text>
            <Image
              /* Productfoto (bracelet op zwart, zelfde als de bracelet-
                 pagina): staat gecentreerd, dus past in elke uitsnede. */
              source={{ uri: 'https://vibezcore-audio.b-cdn.net/images/pic%20hero%20home%202.png' }}
              style={s.braceletCardImg}
              resizeMode="cover"
            />
            <View style={s.braceletCardRow}>
              <Text style={s.braceletCardTitle}>Smart Bead Bracelet</Text>
              <Text style={s.braceletCardChev}>›</Text>
            </View>
            <Text style={s.braceletCardSub}>Nature meets tech. Your rhythm, on your wrist.</Text>
          </Pressable>
        )}

        {/* ── BRACELET-TEASER (cross-product upsell) ──────────────────
            Verschijnt ONDERAAN, NA de Independent-disclaimer (operator-
            besluit 2026-05-23) en ALLEEN voor PRO-audio-users — classic
            cross-sell: gebruiker heeft product A (audio) al gekocht, nu
            tease product B (bracelet). Guest/free krijgen 'm niet —
            zij worden eerst naar audio-PRO geleid via het aankoopblok
            (premature bracelet-pitch zou de audio-conversie verstoren).

            Tap navigeert naar de Bracelet-tab. Copy (KICKSTARTER-badge
            + "Smart Bead Bracelet" + 5-haptic-modes subtitle) is letter-
            lijk overgenomen uit bracelet.tsx hero zodat de twee plekken
            niet uit elkaar groeien. Wanneer de aparte bracelet-pagina
            in de app later landt kan deze tap-target daarheen worden
            verlegd.

            TODO: animatie nog te ontwerpen (operator stuurt specs).
            Voor nu statische card; framer/reanimated-wrapper komt later.

            Verbergen tijdens search (consistent met andere blokken).
            Iter 9r: ook verbergen voor owners — die hebben de bracelet
            al. Geen upsell-rationale. */}
        {/* Iter 9di (2026-05-31): braceletTeaser-card verwijderd onderaan
            de Audio Library voor PRO-users. De cross-sell naar de
            bracelet leeft nu volledig op de Bracelet-tab zelf (waar
            Audio PRO een eigen landing krijgt). Onderaan de audio-
            library voelde 't dubbele opvulling. Styles blijven in de
            stylesheet voor evt. rollback. */}

        {/* Operator, 26 september 2026 ("we hebben nu tabbladen daarvoor"):
           de Free-Breathwork-discovery-card (foto + "Energy. Focus.
           Calm..." + Open Breathwork-knop) is verwijderd — er is nu een
           losse Breath-tab in de tab-bar, dus deze cross-promo in de
           Audio Library is overbodig geworden. Styles staan nog in de
           stylesheet voor evt. rollback. */}

        {/* Iter 9dq v46 (2026-06-03): subtle "Already a member? Sign in"
            footer-link voor uitgelogde Free/Guest users. Vervangt de
            agressieve banner bovenaan die we eerder verwijderden — geeft
            gasten nog steeds een duidelijke maar niet-pushy weg naar
            login na het volledig doorbladeren van de library. Standaard
            patroon (Spotify-stijl footer). Bracelet owners en PRO users
            zien dit niet (zij hebben al een ander pad). */}
        {!searchActive && isSignedIn === false && !hasSub && !isBraceletOwner && (
          <Pressable
            style={s.signInFooterLink}
            onPress={() => {
              /* Iter 9dq v110 (2026-06-04): scroll-intent 'account-top'
                 zodat user op top van /account belandt (sign-in form
                 zichtbaar) i.p.v. eventuele preserved scroll-positie. */
              requestScrollTo('account-top');
              router.navigate('/account');
            }}
            hitSlop={12}
            accessibilityLabel="Already a member, sign in"
          >
            <Text style={s.signInFooterText}>
              Already a member? <Text style={s.signInFooterTextAccent}>Sign in</Text>
            </Text>
          </Pressable>
        )}

      </ScrollView>

      {/* Iter 9dq v155 (operator-fix 2026-06-18): floating "↑ PILLARS"-
          pill rechtsboven verwijderd. Operator: "rechtsboven zie ik een
          pill met PILLAR, kan dat? zo ja moet weg".
          De BACK TO PILLARS-knop in de control-row (binnen de libList)
          dekt deze functie al af; een tweede sticky-versie was visueel
          ruis. */}

      {/* Free Breathwork chooser — Apple-stijl bottom sheet. Toont de 5
          breathwork-protocols (color-dot + state + techniek + duur). Tap
          op een rij → navigatie naar /bracelet-control met de juiste
          mode + breathwork pre-enabled, zodat de user direct op de juiste
          breathwork-ready screen landt. */}
      {breathChooserOpen && (
        <GlassSheet visible={true} onClose={() => setBreathChooserOpen(false)}>
            <View
              style={[
                s.pillarModalSheet,
                { paddingBottom: Math.max(safeInsets.bottom + 24, 72) }, { backgroundColor: 'transparent', overflow: 'hidden' }]}
            >
              {/* VIBEZCORE-glas, echt vervaagd (7 okt 2026). */}
              <VibezGlass
                radius={24}
                level="sheet"
                blurTarget={rootBlurRef}
                style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
              />
              <View style={s.pillarModalHandle} />
              <Pressable
                style={s.pillarModalClose}
                onPress={() => setBreathChooserOpen(false)}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <Text style={s.pillarModalCloseText}>✕</Text>
              </Pressable>
              <Text style={s.pillarModalEyebrow}>BREATHWORK</Text>
              <Text style={s.breathChooserTitle}>Choose a state.</Text>
              <Text style={s.breathChooserSub}>Five techniques.</Text>
              <View style={s.breathChooserList}>
                {BREATHWORK_CHOOSER.map((opt) => {
                  const modeMeta = getModeMeta(opt.mode);
                  return (
                    <Pressable
                      key={opt.mode}
                      style={s.breathChooserRow}
                      onPress={() => {
                        setBreathChooserOpen(false);
                        navigateAway(() =>
                          openStateControl({ mode: opt.mode, breathwork: 1, from: 'audio' }),
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
        </GlassSheet>
      )}

      {/* Iter 9aaa: Pillar-detail bottom sheet — Apple-style minimal.
          Backdrop tap = close, ✕ rechtsboven, korte declaratieve copy. */}
      {detailPillar && (
        <GlassSheet visible={true} onClose={() => setDetailPillar(null)}>
            <View
              style={[
                s.pillarModalSheet,
                /* Iter 9bbb → 9dq v77 (2026-06-03): harmonised CTA-
                   bottom formula. Floor 72px clears Samsung 3-button
                   nav waar safeInsets.bottom soms onderrapporteert. */
                { paddingBottom: Math.max(safeInsets.bottom + 24, 72) }, { backgroundColor: 'transparent', overflow: 'hidden' }]}
            >
              {/* VIBEZCORE-glas, echt vervaagd (7 okt 2026). */}
              <VibezGlass
                radius={24}
                level="sheet"
                blurTarget={rootBlurRef}
                style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
              />
              <View style={s.pillarModalHandle} />
              <Pressable
                style={s.pillarModalClose}
                onPress={() => setDetailPillar(null)}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <Text style={s.pillarModalCloseText}>✕</Text>
              </Pressable>
              <Text style={s.pillarModalEyebrow}>
                {detailPillar.num} · PILLAR
              </Text>
              <Text style={s.pillarModalTitle}>
                {detailPillar.name}
              </Text>
              <Text style={s.pillarModalDesc}>{detailPillar.desc}</Text>
            </View>
        </GlassSheet>
      )}

      {/* ── AUTO-PLAY INFO MODAL ── (operator-fix 2026-06-18, iter 9dq v156)
          User-initiated uitleg over wat auto-play doet en wanneer het
          nuttig is. Zelfde bottom-sheet styling als de pillar-detail
          modal — VIBEZCORE-stijl ipv generic OS Alert. */}
      {autoPlayInfoOpen && (
        <GlassSheet visible={true} onClose={() => setAutoPlayInfoOpen(false)}>
            <View
              style={[
                s.pillarModalSheet,
                { paddingBottom: Math.max(safeInsets.bottom + 24, 72) }, { backgroundColor: 'transparent', overflow: 'hidden' }]}
            >
              {/* VIBEZCORE-glas, echt vervaagd (7 okt 2026). */}
              <VibezGlass
                radius={24}
                level="sheet"
                blurTarget={rootBlurRef}
                style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
              />
              <View style={s.pillarModalHandle} />
              {/* Operator, 8 okt 2026 ("overal consistent"): uitlegbladen
                  sluiten met Done rechtsboven — was ✕ + "Got it" onderaan. */}
              <Pressable
                style={s.sheetDoneTopRight}
                onPress={() => setAutoPlayInfoOpen(false)}
                hitSlop={10}
                accessibilityLabel="Done"
              >
                <Text style={s.sheetDoneTopRightTxt}>Done</Text>
              </Pressable>
              <Text style={s.pillarModalEyebrow}>AUTO-PLAY</Text>
              <Text style={s.pillarModalTitle}>Continuous flow</Text>
              <Text style={s.pillarModalDesc}>
                When a session ends, the next one in the same series starts
                automatically — listen straight through without tapping
                play between sessions.
              </Text>

              {/* Lijst met gebruikssituaties — visueel met blauwe stip
                  per item zodat het luchtig leest. */}
              <View style={{ marginTop: 22, gap: 12 }}>
                {[
                  { label: 'Driving', desc: 'Eyes on the road, hands on the wheel.' },
                  { label: 'Walking', desc: 'Outdoors or commute. Phone in pocket.' },
                  { label: 'In the gym', desc: 'Between sets without breaking flow.' },
                  { label: 'Falling asleep', desc: 'Drift off as the series unfolds.' },
                  { label: 'Deep focus', desc: 'Background continuity, foreground work.' },
                ].map((item) => (
                  <View
                    key={item.label}
                    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: C.accent,
                        marginTop: 8,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: '#ffffff',
                          fontFamily: 'Inter_700Bold',
                          fontSize: 14.5,
                          letterSpacing: -0.2,
                          marginBottom: 2,
                        }}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.55)',
                          fontFamily: 'Inter_500Medium',
                          fontSize: 13,
                          lineHeight: 18,
                        }}
                      >
                        {item.desc}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text
                style={{
                  color: 'rgba(255,255,255,0.40)',
                  fontFamily: 'Inter_500Medium',
                  fontSize: 12.5,
                  lineHeight: 18,
                  marginTop: 22,
                  marginBottom: 24,
                }}
              >
                Toggle off anytime if you prefer to choose each session
                manually.
              </Text>

            </View>
        </GlassSheet>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  /* Smart Bead Bracelet-kaart onder de pijlers (operator, 7 okt 2026). */
  braceletCard: {
    marginHorizontal: 16,
    marginTop: 48,
    marginBottom: 20,
    padding: 16,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  braceletCardImg: {
    width: '100%',
    aspectRatio: 16 / 9,
    marginTop: 12,
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: '#000000',
  },
  braceletCardEyebrow: {
    color: C.dim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
  },
  braceletCardRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  braceletCardTitle: { flex: 1, color: C.text, fontSize: 20, fontFamily: BrandFonts.bold, letterSpacing: -0.3 },
  braceletCardChev: { color: C.dim, fontSize: 24, fontFamily: BrandFonts.regular, marginLeft: 8 },
  braceletCardSub: { marginTop: 4, color: C.dim, fontSize: 14, fontFamily: BrandFonts.regular },
  introOverlay: {
    zIndex: 50,
    elevation: 50,
    backgroundColor: C.bg,
    overflow: 'hidden',
  },
  /* Operator, 15 september 2026: "tekst centreren zoals bij breathwork"
     — zelfde `introWrap`-behandeling als breath.tsx: `alignItems:
     'center'` op de wrapper + `textAlign:'center'` op elke regel. */
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
  /* Zelfde vorm/kleur/rand als breath.tsx's `s.cta`+`s.ctaSolid`: wit
     vlak, `borderRadius:14`, `height:50` — app-breed één herkenbare
     primaire-knop-chrome op een foto. Operator, 15 september 2026: "cta
     mag iets kleiner" gaf eerst een kleinere HOOGTE (50→44) — teruggedraaid
     op operator-correctie: "niet smaller [lager] maar minder breed, kijk
     naar cta breathwork, moet zelfde hoogte zijn". Hoogte/tekst dus terug
     naar breathwork's maat; `paddingHorizontal` i.p.v. het knop-omhulsel
     te laten stretchen (zie de aanroep: `alignSelf` staat nu op 'center'
     i.p.v. 'stretch') maakt 'm smaller in BREEDTE, niet in hoogte. */
  /* Operator, 24 september 2026 ("ctas moeten langer, Apple gebruikt een
     vaste zijmarge voor een primaire hero-cta"): `paddingHorizontal` →
     `marginHorizontal` — rekt nu uit tot een vaste zijmarge i.p.v. rond de
     tekst te plooien. Zelfde wijziging in breath.tsx/bracelet.tsx. */
  introCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    marginHorizontal: 26,
    borderRadius: 14,
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
  /* Smalle, gedraaide lichtstrook die om de ~3,6s over de knop veegt —
     zelfde `ctaShimmer` als breath.tsx (vaste knop-hoogte, breder dan
     hoog zodat de rotatie 'm niet buiten de randen laat pieken). */
  introCtaShimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 46,
  },
  backToOnboarding: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  backToOnboardingTxt: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12.5,
    color: '#0a0a0a',
  },
  /* Iter 9: nav-tiles voor New / Favorites / Free. Apple-iOS-style
     squircle tiles met glyph + label. 12px radius, hairline border,
     subtle bg-fill. Vervangt de oude full-pill nav-knoppen die te
     "marketing-button"-achtig aanvoelden. */
  navTiles: {
    flexDirection: 'row',
    marginHorizontal: 2,
    marginBottom: 20,
    gap: 10,
  },
  navTile: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  navTileGlyph: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
  },
  navTileLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.1,
  },
  /* Operator, 26 september 2026 ("bundel in één doorlopende balk, zoals de
     native iOS Segmented Control"): losse pil-chips vervangen door één
     omkaderd vlak met interne verticale scheidingslijnen — links
     uitgelijnd met de kaarten erboven (PILLAR_SIDE_INSET). */
  /* Operator, 26 september 2026 ("meer ademruimte bovenaan"): marginTop
     toegevoegd nu de subheader (die de afstand tot de titel vulde) weg
     is — anders plakte de balk direct tegen de titel aan. */
  libQuickLinksBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: PILLAR_SIDE_INSET,
    marginTop: 20,
    /* Operator ("meer ruimte tussen Your Journey en de kaarten
       eronder"): 20 → 32 — duidelijke scheiding tussen de twee blokken
       i.p.v. dat het grid er quasi tegenaan plakt. */
    marginBottom: 32,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  libQuickLinkSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  libQuickLinkDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },
  libQuickLinkText: {
    color: C.text,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
  },
  /* Iter 9pp: Your Journey als compacte list-row (Apple Settings stijl)
     ipv full-width card met grote icoon. */
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 24,
    gap: 12,
  },
  journeyRowGlyph: {
    fontSize: 16,
  },
  journeyRowBody: {
    flex: 1,
  },
  journeyRowTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.1,
  },
  journeyRowSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.1,
    marginTop: 1,
  },
  journeyRowChev: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
  },
  /* Iter 9tt: compact auto-play toggle row — flush in de utility-zone
     onder Your Journey. Geen card-bg meer (zoals de oude settingCard);
     pure tekst + Switch zodat 't visueel ondergeschikt is aan de
     personal entry erboven. */
  autoPlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 18,
  },
  autoPlayLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    letterSpacing: -0.1,
  },
  /* Compacte top-bar boven de ScrollView met alleen het V-logo
     links. Maakt brand-presence zichtbaar zonder dat de wordmark
     elke pagina overheerst. Padding match met hero-content (links 20). */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
  },
  scroll: { paddingBottom: 56 },

  /* ── Sign-in CTA banner ──
     Subtiel banner bovenaan voor uitgelogde users. Blauwe accent-tint
     + accent border zodat 'ie opvalt zonder schreeuwerig te zijn.
     Note-icoon links als visuele anchor (♪ — verwijst naar audio).
     Tap-target full-width voor mobile UX. */
  /* Iter 9ccc: banner = outer frame, twee Pressable-rows binnen.
     flexDirection veranderd naar column zodat de twee tap-zones onder
     elkaar staan; padding 0 hier omdat de rows zelf hun padding hebben. */
  signInBanner: {
    backgroundColor: 'rgba(58,143,255,0.10)',
    borderColor: 'rgba(58,143,255,0.30)',
    borderWidth: 1,
    borderRadius: 14,
    marginHorizontal: 16,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 4,
  },
  /* Iter 9dq v46 (2026-06-03): subtle "Already a member? Sign in"
     footer-link voor uitgelogde Free/Guest users. Onderaan de library
     scroll, na alle content. Dim text + accent-blauw op de "Sign in"
     woord zodat de tap-target visueel duidelijk is zonder pushy. */
  /* Operator, 26 september 2026 ("onder Already a member te veel ruimte"):
     dit is het laatste element vóór het einde van de ScrollView, die zelf
     al bodem-padding heeft voor de tab-bar — paddingVertical/marginTop
     stapelden daarbovenop. Omlaag naar een normale footer-maat. */
  signInFooterLink: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  /* Operator, 14 september 2026: "los sign in dat is niet ok" — wit-
     gebaseerde kleuren waren bijna onzichtbaar op de off-white
     achtergrond, waardoor de link zwevend/kapot oogde i.p.v. een
     bewuste footer-regel. */
  signInFooterText: {
    color: C.dim,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.1,
  },
  signInFooterTextAccent: {
    /* Operator, 26 september 2026: was ROYAL_INDIGO/Bio-Teal, nu wit —
       een tekst-link mag onderscheiden zijn qua gewicht, niet per se
       qua kleur. */
    color: '#ffffff',
    fontFamily: 'Inter_700Bold',
  },
  signInBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(58,143,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInBannerIconText: {
    color: AudioAccent,
    fontSize: 18,
    lineHeight: 22,
  },
  /* Iter 9ddd: gecentreerd, geen icon meer. Title-tekst standalone. */
  signInBannerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  signInBannerSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  signInBannerArrow: {
    color: AudioAccent,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  /* Iter 9ddd → 9eee: tap-rows gecentreerd, "or"-divider tussen.
     Borders op rows weggehaald (divider doet de separatie nu). */
  signInBannerMainRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 13,
    paddingBottom: 8,
    paddingHorizontal: 14,
  },
  signInBannerSubRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 13,
    paddingHorizontal: 14,
  },
  signInBannerSubText: {
    color: C.accent,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  /* ── BRACELET LANDING PAGE (v11 clean rebuild) ──────────────
     Alle styles met `bLanding`-prefix om te voorkomen dat oude
     stale references nog ergens hangen. Root tot button alles in
     één blok hier — niets verspreid in het bestand. */
  bLandingRoot: {
    flex: 1,
    backgroundColor: C.bg,
  },
  /* Foto-block — aspect 1:1.15 (iets minder hoog dan square zodat
     content ruimte krijgt voor tekst + 2 buttons + tab-bar buffer).
     Iter 9dq v26 (2026-06-02): aspectRatio bumped 1.15 → 1.45 zodat
     de foto korter wordt en de content (nu met authority-subtitle +
     langere bullets) volledig zichtbaar blijft met de CTAs in safe
     zone. Image-fill blijft via cover (zie resizeMode op de Image)
     zodat geen letterbox-bars verschijnen.
     Iter 9dq v27 (2026-06-02): aspectRatio verder verhoogd naar 1.6
     en overflow:hidden toegevoegd. Image (zie bLandingPhotoImg)
     is square en top-aligned — hoofd blijft volledig zichtbaar,
     alleen de torso/onderkant wordt gecropt. */
  bLandingPhoto: {
    width: '100%',
    /* Iter 9dq v39 (2026-06-03): aspectRatio 1.6 → 1.25. Photo ~63dp
       langer (~1.7cm). Fade-zone schuift visueel naar beneden — fade
       start (op 0.85 van photo) zit nu in absolute pixels ~54dp lager
       op het scherm dan voorheen. Combined met content-area margin-
       reducties hieronder past het nog steeds.
       Iter 9dq v41 (2026-06-03): 1.25 → 1.4 om de secondary link
       "Listen free sessions first" weer in beeld te krijgen. Photo
       is nu nog steeds ~32dp groter dan origineel 1.6 (= fade
       visueel ~0.8cm lager dan baseline), maar content area heeft
       genoeg ruimte voor beide links. */
    aspectRatio: 1.4,
    overflow: 'hidden',
  },
  /* Iter 9dq v27: image is square (aspectRatio 1.0) en breder dan
     het container-aspect → image overflowt onderaan, container clipt
     'm. Top-aligned (top:0) zodat het hoofd ALTIJD bovenaan staat,
     nooit weggecropt. */
  bLandingPhotoImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    aspectRatio: 1.0,
  },
  /* Content-block — vult de resterende verticale ruimte na de foto.
     space-between zet top-groep en bottom-groep aan respectievelijk
     boven- en onderkant van deze ruimte, met flexibele witruimte
     ertussen die meeschaalt met scherm-grootte. */
  bLandingContent: {
    flex: 1,
    paddingHorizontal: 24,
    /* Iter 9dq v39: paddingTop 16 → 8 om verticale ruimte te besparen
       nu de photo langer is. */
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): was eigen
     letterSpacing (2.4) los van `TypeScale.cardEyebrow` (1.4) en eigen
     gewicht (regular i.p.v. semibold) voor exact dezelfde rol (klein
     label boven een kop). */
  bLandingEyebrow: {
    color: C.accent,
    ...TypeScale.cardEyebrow,
    marginBottom: 12,
  },
  /* Was `regular`/30px/-0.8 — dezelfde pagina-titel-rol als `screenTitle`
     op account.tsx, nu uit dezelfde bron (`TypeScale.tabHeader`). */
  bLandingTitle: {
    color: C.text,
    ...TypeScale.tabHeader,
    lineHeight: 30,
    /* Iter 9dq v25: marginBottom verlaagd van 22 → 8 omdat er nu een
       authority-subtitle tussen title en bullets staat die de eigen
       margin levert.
       Iter 9dq v39: 8 → 4. Photo is langer, content moet compacter. */
    marginBottom: 4,
  },
  /* Iter 9dq v25 (2026-06-02): authority-subtitle onder de title.
     Italic + dim om "fundament/legacy"-toon te bewaren zonder met de
     bullets te concurreren. Subtiele blue-tint matched de eyebrow.
     Iter 9dq v26: marginBottom 22 → 14 om verticale ruimte te besparen
     zonder dat 't claustrofobisch wordt. */
  bLandingAuthoritySubtitle: {
    color: light ? 'rgba(10,10,12,0.62)' : 'rgba(255,255,255,0.62)',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontStyle: 'italic',
    lineHeight: 20,
    letterSpacing: -0.1,
    /* Iter 9dq v39: 14 → 10. Compacter nu photo langer is. */
    marginBottom: 10,
  },
  /* Features = checkmark-bullets. Geen marginBottom op de feature-list,
     want space-between regelt al de afstand tussen tekst-groep en
     buttons-groep.
     Iter 9dq v26: gap 10 → 7 om verticale ruimte te besparen nu de
     bullets langer zijn en mogelijk wrappen. */
  bLandingFeatures: {
    gap: 7,
  },
  bLandingFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bLandingCheck: {
    color: C.accent,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    lineHeight: 22,
    width: 14,
  },
  bLandingFeatureText: {
    flex: 1,
    color: light ? 'rgba(10,10,12,0.86)' : 'rgba(255,255,255,0.86)',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  bLandingPrimaryBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    /* marginBottom 2 ipv 8 — secondary CTA "Listen free sessions
       first" zit dichter tegen de primary CTA (operator v14). */
    marginBottom: 2,
  },
  bLandingPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.4,
  },
  bLandingSecondaryBtn: {
    /* Tightere padding zodat de tekst dichter tegen de primary
       knop staat. */
    paddingTop: 6,
    paddingBottom: 10,
    alignItems: 'center',
  },
  bLandingSecondaryText: {
    color: light ? 'rgba(10,10,12,0.65)' : 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.2,
  },
  /* Iter 9dq v40 (2026-06-03): nieuwe text-link styles (vervangen
     bLandingPrimaryBtn/Text). Primary = grote accent-blauwe tekst
     met arrow, geen achtergrond. Secondary = subtle dim. Past bij
     premium minimalisme — geen commercieel knop-gevoel. */
  bLandingPrimaryLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  bLandingPrimaryLinkText: {
    /* Iter 9dq v41: accent-blauw → wit per operator-feedback (dark). In
       light is wit onleesbaar op de witte achtergrond — daar blijft dit
       de primaire actie, dus de eigen accentkleur i.p.v. de dimme
       secundaire tint. */
    color: light ? C.text : '#ffffff',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
  },
  bLandingSecondaryLink: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 6,
  },
  bLandingSecondaryLinkText: {
    color: light ? 'rgba(10,10,12,0.45)' : 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.1,
  },

  /* Bracelet-owner upsell banner — vervangt de sign-in banner voor
     ingelogde bracelet-only users. Anders ge-style (geen "or"-divider,
     wel een explicite arrow + eyebrow) zodat 't visueel duidelijk een
     "next step" CTA is ipv een sign-in/get banner. Operator 2026-05-30. */
  braceletUpsellBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: light ? 'rgba(127,178,229,0.14)' : 'rgba(58,143,255,0.10)',
    borderColor: light ? 'rgba(127,178,229,0.4)' : 'rgba(58,143,255,0.32)',
    borderWidth: 1,
    borderRadius: 16,
  },
  braceletUpsellEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontFamily: BrandFonts.regular,
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  braceletUpsellTitle: {
    color: C.text,
    fontSize: 16,
    fontFamily: BrandFonts.regular,
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  braceletUpsellSub: {
    color: light ? '#6e6e73' : '#8a8a8a',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  braceletUpsellArrow: {
    color: C.accent,
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginLeft: 4,
  },
  /* Iter 9eee: "or"-divider — hairlines aan beide kanten met de tekst
     centered ertussen. Apple "OR"-conventie uit sign-in screens. */
  signInBannerOrDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 4,
  },
  signInBannerOrLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: light ? 'rgba(127,178,229,0.35)' : 'rgba(58,143,255,0.30)',
  },
  signInBannerOrText: {
    color: light ? 'rgba(10,10,12,0.45)' : 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
    textTransform: 'lowercase',
    paddingHorizontal: 10,
  },

  /* HERO — bron .hero / .hero-img / .hero-grad / .hero-text.
     Operator, 14 september 2026 (Apple-stijl herontwerp): radius 16→24
     ("past het beste bij dit formaat"); een ECHTE scrim-gradient i.p.v.
     de oude platte transparante laag (RN kreeg intussen `expo-linear-
     gradient` elders in dit bestand, dus dit "geen native gradient"-excuus
     vervalt); tekst op de foto blijft ALTIJD wit, ongeacht thema — dat is
     legesbaarheid tegen een foto, geen thema-kleur. */
  /* Operator, 15 september 2026: "full width" — geen zijmarge/ronding meer,
     de foto loopt van rand tot rand net als de activity-hero. */
  hero: {
    overflow: 'hidden',
    height: 340,                 // bron: height 55vh, min 280, max 380
  },
  heroImg: { width: '100%', height: '100%' },
  heroText: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20 },
  /* Operator, 14 september 2026: op de foto blijft dit wit-met-
     transparantie ("voor extra elegantie"), los van het thema. */
  heroEyebrow: {
    ...TypeScale.cardEyebrow,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
  },
  /* Operator, 14 september 2026 (Apple-font-framework): H1-rol, 32px
     Bold, -0.4 tracking — was 42px Regular met eigen tracking, los van
     elke andere kop-rol in de app. Tekst zelf ook omgezet naar gewone
     zinsbouw i.p.v. ALL CAPS (zie JSX): "Apple gebruikt hoofdletters
     uitsluitend voor labels van maximaal twee woorden." */
  heroH1: {
    fontSize: 32,
    color: '#ffffff',
    lineHeight: 36,
    letterSpacing: -0.4,
    textAlign: 'left',
    fontFamily: BrandFonts.bold,
  },

  /* 4-FASEN — statische subheader (Operator, 26 september 2026, vervangt
     de vorige schuivende ticker). Eén rustige regel onder de paginatitel. */
  /* Operator, 26 september 2026 ("meer ademruimte, alles stond op
     elkaar"): marginTop 4 → 10 (los van de titel erboven), marginBottom
     4 → 24 (los van de pillar-grid eronder, conform het huisstijl-ritme
     tussen titel-blok en eerste content-sectie). */
  libPageSubheader: {
    color: C.dim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.2,
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 24,
  },
  /* Grote, linksgeaande paginatitel — geeft de gebruiker een duidelijk
     "je bent hier"-anker, ontbrak hiervoor volledig. */
  /* Operator, 16 september 2026 ("vormt de pagina 1 geheel, klopt de
     fontstijl?"): dit was een letterlijke kopie van de bestaande
     `TypeScale.pageHeader`-rol (30px Bold, -0.5 — "grote kop bovenaan
     een los scherm", al gebruikt in breath-welcome/goal/intensity/
     plan-review) i.p.v. die rol zelf te gebruiken. Nu via de gedeelde
     token, zodat een toekomstige aanpassing aan die rol hier ook
     doorwerkt i.p.v. een 5e losse plek te worden. */
  libPageTitle: {
    ...TypeScale.pageHeader,
    color: C.text,
    paddingHorizontal: 16,
    /* Operator, 26 september 2026 ("Large Title-wet — meer ademruimte
       boven de titel"): 12 → 22. SafeAreaView vangt de status-bar al op;
       dit is puur extra rust erbovenop. */
    paddingTop: 22,
  },

  /* ── BUILT ON — gecentreerd, identieke visuele taal als EXPLORE SERIES.
     Ruime adem-marges boven (tot 4-fasenregel) en onder (tot eerste
     pijler-card). Horizontaal 24px voor smalle phones. ── */
  builtOn: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 44,    // 40–48px adem boven
    paddingBottom: 36, // 32–40px adem onder
  },
  /* Operator, 14 september 2026 (Apple-font-framework): Eyebrow-rol —
     11px Bold, +1.5 tracking, gedimde kleur (#8E8E93 = C.dim in light). */
  builtOnLabel: {
    color: C.dim,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: BrandFonts.bold,
  },
  /* H2-rol — 22px Bold, -0.3 tracking, gewone zinsbouw i.p.v. ALL CAPS
     (zie JSX). Vervangt de eerdere ALL-CAPS/positieve-tracking variant. */
  builtOnText: {
    color: C.text,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    textAlign: 'center',
    fontFamily: BrandFonts.bold,
  },

  /* PIJLERS — bron .vzm-pillars-grid / .vzm-pillar-photo */
  pillar: {
    width: '48%',
    height: 150,
    /* FIX 13: radius 12 → 16 + 1px hairline border, conform de library-
       cards. Geeft consistent ritme door de hele homepage zonder shadow
       of glow — rust only.
       Operator, 14 september 2026 (Apple-stijl S02): 16 → 20 — grote
       fotokaarten krijgen een ruimere radius dan de kleine chips/knoppen
       (12px).
       Operator, 25 september 2026 (Apple-restyle, page-brede herbouw):
       `borderColor` was `rgba(255,255,255,0.08)` — bedoeld voor toen de
       kaart een pure foto-Pressable was; nu is dit de BUITENSTE wrapper
       (foto + tekstvlak eronder) op een lichte pagina-achtergrond, dus
       `C.border` i.p.v. bijna-onzichtbaar wit-op-wit. `...SOFT_SHADOW`
       erbij (dezelfde gedeelde constante als `buyBlock`/`legalBlock`
       verderop) voor het dieptegevoel dat de hele pagina nog miste — dit
       is enkel iOS-shadow-props (geen `elevation`), dus veilig te
       combineren met `overflow:'hidden'` hieronder (bewezen door
       `legalBlock`, die exact dezelfde combinatie al gebruikt). */
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: C.surface,
    ...SOFT_SHADOW,
  },
  pillarImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  /* Iter 9aaa — Pillar detail bottom-sheet modal (Apple-style minimal) */
  pillarModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  /* Iter 9bbb: paddingBottom verhuisd naar inline-style (dynamic +
     safeInsets.bottom). Hier alleen de base layout. */
  pillarModalSheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 22,
  },
  pillarModalHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginBottom: 18,
  },
  sheetDoneTopRight: { position: 'absolute', top: 18, right: 20, zIndex: 2 },
  sheetDoneTopRightTxt: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff' },
  pillarModalClose: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarModalCloseText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16,
  },
  pillarModalEyebrow: {
    color: C.accent,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
    fontFamily: BrandFonts.regular,
  },
  pillarModalTitle: {
    color: '#ffffff',
    fontSize: 26,
    letterSpacing: -0.6,
    lineHeight: 30,
    marginBottom: 14,
    fontFamily: BrandFonts.regular,
  },
  pillarModalDesc: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 24,
  },

  /* Free Breathwork chooser modal — Apple-stijl bottom sheet rows.
     Lijst van 5 protocols, elk met color-dot + state + techniek + duur.
     Hergebruikt pillarModal{Root,Sheet,Eyebrow,Handle,Close} voor de
     algemene sheet-shell — alleen content-specifieke stijlen hier. */
  breathChooserTitle: {
    color: '#ffffff',
    fontSize: 26,
    letterSpacing: -0.6,
    lineHeight: 30,
    marginBottom: 6,
    fontFamily: BrandFonts.regular,
  },
  breathChooserSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
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
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  breathChooserRowMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 18,
  },
  breathChooserRowArrow: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
    flexShrink: 0,
  },
  /* Iter 9mm: 15 → 14 px + iets tightere letterSpacing zodat
     "Strategic Execution & Wealth" (langste pillar-naam, 27 char) op
     één regel past. Andere 3 pillars zien er nog steeds zelfde uit. */
  pillarName: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.35,
    lineHeight: 17,
    paddingRight: 12,
  },

  /* EMERSON — bron .vzm-emerson-block (compact horizontale card).
     Operator, 14 september 2026 (Apple-stijl herontwerp): kaart wordt
     `C.surface` (puur wit) i.p.v. `C.border` — dat laat 'm subtiel los
     komen van het off-white paginavlak (`C.bg`) eronder, i.p.v. te
     versmelten. Ruimere padding, Body-rol (15px Regular) i.p.v. 14px
     SemiBold. */
  quoteBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: C.surface,
    ...SOFT_SHADOW,
  },
  quoteAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
    backgroundColor: '#000',
  },
  quoteContent: { flex: 1 },
  quoteText: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    marginBottom: 6,
  },
  quoteAuthor: { color: C.dim, fontSize: 13, fontFamily: BrandFonts.regular },

  /* ── EXPLORE SERIES — header-blok ──
     Gecentreerd, ruime adem-marges boven (tot Emerson-quote) en onder
     (tot eerste seriekaart). Horizontaal 24px padding voor smalle phones. */
  exploreHead: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 52,    // 48–56px adem boven, tot de quote
    paddingBottom: 44, // 40–48px adem onder, tot de eerste card
  },
  exploreEyebrow: {
    color: C.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.8, // ≈ 0.15em bij 12px
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 16,
  },
  exploreH1: {
    /* Apple-stijl, identiek aan builtOnText — beide gecentreerde display-
       titels onder een blauwe "—EYEBROW—" regel. Zelfde gewicht, grootte,
       line-height en tracking, zodat de twee secties als één visueel
       systeem ogen. */
    color: C.text,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34, // ≈ 1.21 × 28
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  exploreMetaText: {
    /* Stond eerder in een flex-rij met een 📅-icoon; nu losse gecentreerde
       regel. marginTop verhuist van de oude metaRow naar deze Text zodat
       de afstand tot de titel exact zoals voorheen blijft (16px). */
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 16,
  },

  /* ── LIBRARY-kaarten (overgenomen uit library.tsx) ── */
  libList: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  /* Eén "serie-blok" = de card + zijn FREE-balk(en) eronder, samen één
     visueel geheel. marginBottom geeft adem TUSSEN blokken, niet erbinnen
     (card en FREE-balk blijven dicht op elkaar). 22 → 30 voor ruimere
     rust tussen series. Consistent ook op de laatste serie — de
     transitie naar het aankoopblok (eigen paddingTop) blijft natuurlijk. */
  /* FIX 8 + PAD A patch: wrapper heeft ALTIJD een dunne rand om kaart
     + free-balk samen. overflow:'hidden' is VERWIJDERD — RN 0.83 Fabric
     crasht (IllegalViewOperationException via SurfaceMountingManager)
     wanneer een overflow:'hidden'-parent een kind heeft met multi-layer
     shadow. De inner libCard heeft z'n eigen overflow:'hidden' dus de
     foto blijft sowieso binnen z'n bounds; wrapper-clip was redundant. */
  /* Operator, 14 september 2026: "geen duidelijke lijnen en cohesie met
     de cards" — deze rand was wit-gebaseerd (0.08 alpha), onzichtbaar op
     de lichte achtergrond. Dat was precies de rand die kaart + sessie-
     rijen eronder als ÉÉN blok moet laten ogen (zie comment bij
     `libCard` hieronder: "CARD + FREE-BLOCK UNIFIED VISUAL"). */
  /* Operator, 14 september 2026: "smelt de hele lijst samen in één
     doorlopend wit oppervlak" — de highlighted gratis-rij (`libFreeRow`)
     had zijn EIGEN afgeronde onderhoeken, los van de vergrendelde rijen
     erna (`libExpand`), wat een zichtbare naad/kier tussen "twee kaarten"
     gaf. `overflow:'hidden'` hier knipt ALLES — foto, gratis-rij,
     vergrendelde rijen — tot exact deze ene buitenrand, ongeacht hoeveel
     rijen erin zitten of welke eigen radius een kind toevallig had. */
  /* Operator, 25 september 2026 (Apple-restyle, page-brede herbouw):
     `...SOFT_SHADOW` erbij — dezelfde gedeelde constante als `pillar`/
     `buyBlock`/`legalBlock`. Veilig met `overflow:'hidden'` (enkel
     iOS-shadow-props, geen `elevation` — zie `legalBlock` voor precedent
     van exact deze combinatie). */
  libCardUnit: {
    marginBottom: 30,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    overflow: 'hidden',
    ...SOFT_SHADOW,
  },
  libCard: {
    /* bron .card-hero: height 200, overflow hidden. Bovenhoeken afgerond
       (14), onderhoeken plat — sluit naadloos aan op de FREE-balk
       eronder zodat card + balk één visueel blok vormen
       (bron-comment "CARD + FREE-BLOCK UNIFIED VISUAL"). */
    height: 200,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    backgroundColor: C.border,
  },
  libCardBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },

  /* PAD A patch: alleen border-color switch tijdens active. boxShadow +
     elevation zijn verwijderd om de Fabric-crash te vermijden. De border-
     verandering geeft al voldoende visuele aanwijzing dat de kaart actief
     is — shadow kan later via aparte buiten-View-wrapper terug (zonder
     overflow:'hidden' op het pad). */
  libCardUnitActive: {
    borderColor: 'rgba(58,143,255,0.35)',
  },
  /* Progress-strip op de card. 3px hoog. PAD A patch: overflow:'hidden'
     verwijderd (niet nodig — track heeft geen borderRadius en de fill
     heeft ook geen shadow meer). */
  libCardProgressTrack: {
    height: 3,
    width: '100%',
    zIndex: 2,
  },
  /* PAD A patch: boxShadow verwijderd (Fabric-crash). De gradient zelf
     is helder genoeg om als "actief" te lezen. */
  libCardProgressFill: {
    height: '100%',
  },

  /* Standalone-variant van libCard — voor de 13e card (Coming-roadmap).
     Geen FREE-balk eronder, dus ALLE hoeken rond i.p.v. alleen-top. */
  libCardStandalone: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  /* libCardGrad als losse View is vervallen — bron .card-ov wordt nu door
     een <LinearGradient>-component in de JSX getekend (zie serie-card). */
  /* libCardChev / libCardChevTxt / libCardChevTxtOpen blijven hieronder
     bestaan ten behoeve van Soundscapes subcat-cards — de MAIN serie-card
     gebruikt geen chevron meer; daar staat nu de VIEW ALL-pill. */
  /* libCardChev — Soundscapes sub-cards. Iter 9qq: positie verhuisd
     van top-right (top: 14) → bottom-right (bottom: 12) zodat 'ie
     visueel matched met de moreToggleBR op de hoofd-series-cards.
     libCardChevTxtOpen is verwijderd want we wisselen nu het glyph
     zelf (⌄/⌃) ipv 'm te roteren. */
  libCardChev: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  libCardChevTxt: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: -1,
  },
  /* Pill-cluster: container rechtsboven die positie + onderlinge gap regelt
     voor de pill(s) binnen een card-hero. viewAllPill heeft daardoor geen
     eigen position-props meer. (FOLLOW-pill is verwijderd, maar de cluster
     blijft als wrapper voor consistentie + toekomstige uitbreidingen.) */
  pillCluster: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  /* Iter 9ll: minder visueel druk. Glass-style pill met subtiele
     dark-tinted bg + thin border, geen heavy shadow. Past beter bij
     Apple-style disclosure indicator. */
  viewAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingLeft: 10,
    paddingRight: 9,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.20)',
    borderRadius: 999,
  },
  viewAllText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  /* Variant van viewAllText voor de Coming-card: mixed case "Explore",
     matched iter 9ll color/weight voor consistency. */
  exploreText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  /* Iter 9ll: chevron is nu ⌃ / ⌄ (vertical disclosure), past bij
     daadwerkelijk vertikaal openvouwen van de card. */
  viewAllChev: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 12,
    fontWeight: '700',
    marginTop: -1,
  },
  /* Operator, 25 september 2026 (Apple-restyle, punt 3): `moreToggleBR`/
     `moreToggleLabel`/`moreToggleChev` (het zwevende glaspil-toggle bovenop
     de foto) zijn vervallen — vervangen door `libCardChevInline`, een
     gewoon chevron-teken naast de titel in `libCardBody` (zie JSX
     hierboven). Geen zwevende knop meer op de foto. */
  libCardBody: {
    /* bron .card-body: padding 18px 18px 20px (top horizontal bottom). Nu
       een GEWOON vlak ONDER de foto (was een overlay erop) — zelfde
       "kaart + los blok eronder"-patroon als de FREE-balk (`libFreeRow`)
       verderop, vandaar dezelfde `C.surface`-achtergrond. */
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
  },
  /* Operator, 25 september 2026 (Apple-restyle, punt 3): de eyebrow staat
     niet meer op de foto (zie boven) — "kleine grijze hoofdletters direct
     onder de foto" uit het actieplan, dus `C.dim` i.p.v. het vaste wit dat
     nodig was toen dit nog overlay-tekst op een foto was. */
  libCardEyebrow: {
    /* bron .card-label: 10px / 700 / .14em / uppercase. */
    color: C.dim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  /* Titel + chevron op één regel, binnen `libCardBody`. */
  libCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  /* Vervangt de vroegere zwevende glaspil (`moreToggleBR`) op de foto —
     een simpel, subtiel chevron-teken naast de titel, Apple-disclosure-
     stijl. */
  libCardChevInline: {
    color: C.dim,
    fontSize: 20,
    lineHeight: 20,
    fontFamily: BrandFonts.bold,
  },
  /* Eigen eyebrow voor de Coming-card — wit i.p.v. blauw, iets ruimere
     letter-spacing (.16em bij 10px). Bron-comment: "13TH CARD". */
  comingEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6, // ≈ 0.16em bij 10px
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  /* Display Title (H1-variant) — 26px Bold, -0.4. Operator, 25 september
     2026 (Apple-restyle punt 3): stond vast op wit ("altijd op de foto"),
     staat nu op een gewoon vlak (`libCardBody`, `C.surface`) — `C.text`,
     hetzelfde theme-aware zwart/wit als elke andere titel in de app. */
  libCardTitle: {
    color: C.text,
    fontSize: 26,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
    lineHeight: 30,
    marginBottom: 6,
  },
  libCardSubline: {
    /* bron .card-sub: 12px / line-height 1.4. Zelfde reden als libCardTitle
       hierboven — `C.dim` i.p.v. het vaste wit-op-foto. */
    color: C.dim,
    fontSize: 12,
    lineHeight: 17, // ≈ 1.4 × 12
  },

  /* FREE-balk onder de kaart — bron .vz-free-under-card. Eén balk per
     gratis sessie. NB: spec noemt `margin: 8px 16px 18px`. In de webapp
     biedt de parent geen horizontale padding; in onze RN-layout doet
     `libList` dat al (paddingHorizontal:16) — daarom GEEN
     marginHorizontal hier, anders zou de balk dubbel-inspringen en
     smaller worden dan de kaart. Verticale 18px bottom-margin valt onder
     de wrapper-spacing (`libCardUnit.marginBottom:30`). */
  libFreeRow: {
    /* Sluit naadloos aan onder de card: geen marginTop, plat aan de
       bovenkant (radius 0 + borderTopWidth 0), afgerond aan de onderkant.
       Bron-comment "CARD + FREE-BLOCK UNIFIED VISUAL". */
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginTop: 0,
    paddingVertical: 16,
    paddingHorizontal: 18,
    /* Operator, 14 september 2026 (2e correctie): eigen onderhoek-radius
       weg — `libCardUnit`'s `overflow:'hidden'` knipt nu de buitenrand
       van het HELE blok, ongeacht of hierna nog vergrendelde rijen
       volgen. Los geronde hoeken hier gaven precies de zichtbare naad
       die "twee losse kaarten" deed lijken. */
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    /* Operator, 14 september 2026 (kritiek: "geen play button zichtbaar")
       — dit hele blok was nog volledig wit-op-wit, nooit meegenomen in de
       Apple-stijl-conversie (het is een apart, los blok van `SessionRow`
       hierboven, niet dezelfde component). `C.surface`, net als elke
       andere kaart. */
    backgroundColor: C.surface,
    borderTopWidth: 0,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: C.border,
  },
  /* Ronde play-knop links — 40x40 (FIX 9). PAD A patch: overflow:'hidden'
     verwijderd (Fabric-crash combo met active-state shadow). De
     LinearGradient-child krijgt z'n eigen borderRadius:20 zodat hij
     zichzelf tot een cirkel clipt — geen parent-clip nodig. */
  /* Operator, 14 september 2026: zichtbare Royal-Indigo-tint i.p.v. een
     bijna-transparant wit vlak (was onzichtbaar op de lichte kaart —
     "geen play button zichtbaar"). Active state blijft de blauwe
     LinearGradient (zie isActive branch in JSX). */
  freePlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${ROYAL_INDIGO}12`,
    borderWidth: 1,
    borderColor: `${ROYAL_INDIGO}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freePlayGlyph: {
    color: C.free,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 1, // optisch centreren — play-driehoek leunt rechts
  },
  freeContent: {
    flex: 1,
  },
  freeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  freeSessionTitle: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
  },
  /* Pill naast de titel — "1 FREE SESSION" of "FREE" afhankelijk van
     hoeveel free-sessies de serie heeft (zie pillText-logica in JSX). */
  freePill: {
    marginLeft: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
    /* Operator, 14 september 2026: wit-tint was onzichtbaar op licht. */
    backgroundColor: C.border,
    borderWidth: 1,
    borderColor: C.border,
  },
  freePillText: {
    color: C.free,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6, // ≈ 0.06em bij 9px
    textTransform: 'uppercase',
  },
  /* Operator, 14 september 2026: was wit-gebaseerd (0.55 alpha) — zo
     goed als onzichtbaar op de lichte kaart, precies de "spooktekst"
     die er in het screenshot te zien was. */
  freeSessionDesc: {
    color: C.dim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  /* FIX 15b: status-regel onder de beschrijving, alleen wanneer er
     vzh_v1-entry bestaat voor deze sessie. Color wordt inline gezet
     (blauw partial / groen full). 12px / weight 600 / marginTop 6. */
  /* Was een `Text`-stijl (glyph+label als één string); nu een rij met een
     los icoon + label — zie JSX-toelichting bij de aanroep. */
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  statusRowText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* ── FIX 4: "Now playing"-state op de FREE-balk ──
     Wanneer de audio-service deze sessie aan het spelen is, switchen
     bg/border/play-knop/pill naar blauw accent en verschijnt een 3px
     progress-strip onderin. Bij pauze (via mini-player) valt het blokje
     terug naar de standaard groene weergave. */
  libFreeRowActive: {
    /* FIX 8: eigen border verdwijnt (wrapper doet 'm), bg .06 → .05 voor
       net iets zachtere overgang van foto naar balk. Subtiele top-divider
       1px rgba(58,143,255,.15) markeert de foto/balk-grens binnen het
       wrapper-blok. Layout-shift = +1px t.o.v. rest-state; webapp-parity
       wint hier van shift-vermijden. */
    backgroundColor: 'rgba(58,143,255,0.05)',
    borderColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: 'rgba(58,143,255,0.15)',
  },
  /* FIX 9: actieve play-knop wordt volledig blauw via LinearGradient-
     child. PAD A patch: boxShadow + elevation verwijderd (Fabric-
     crash). Witte hairline border + de blauwe gradient zelf zijn al
     genoeg visuele aanwijzing dat-ie actief is. */
  freePlayBtnActive: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  /* Gradient krijgt eigen borderRadius zodat hij zichzelf tot een
     cirkel clipt (parent overflow:'hidden' is weg). */
  freePlayBtnGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  /* Icoon wit op blauwe gradient — vol contrast met de blauwe massa. */
  freePlayGlyphActive: {
    color: '#ffffff',
    /* Pause-glyph (❚❚) heeft geen optische rechts-leun zoals ▶, dus
       de marginLeft:1 uit de basisstijl mag genuld als we exact in
       het midden willen staan. Klein detail; laten staan houdt de
       transitie ▶ ↔ ❚❚ visueel stabiel (geen 1px sprong). */
  },
  freePillActive: {
    backgroundColor: 'rgba(58,143,255,0.1)',
    borderColor: 'rgba(58,143,255,0.3)',
  },
  freePillTextActive: { color: C.accent },
  /* Progress-strip onderaan het blokje — volgt exact de onderhoeken (14)
     van libFreeRow zodat de gradient niet uit het radius-masker steekt. */
  freeProgressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    overflow: 'hidden',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  freeProgressFill: { height: '100%' },

  /* Inline-expansie-container (gewone sessierijen of subcat-kaarten).
     Operator, 14 september 2026 (Apple-stijl, 2e correctie): "geen
     duidelijke lijnen en cohesie met de cards" — de eerste versie gaf dit
     zijn EIGEN volledig afgeronde kaart + schaduw + marginTop, los van
     `libCard`/`libCardUnit` erboven. Dat gaf precies het tegenovergestelde
     van "één blok": twee zwevende kaarten met een gat ertussen. Nu sluit
     dit naadloos aan onder `libCard` (geen marge, geen bovenhoek-radius,
     geen eigen schaduw) — `libCardUnit`'s buitenrand is de enige rand,
     card + sessierijen vormen weer echt één visueel blok. */
  libExpand: {
    backgroundColor: C.surface,
  },

  /* showAllRow/showAllText/showAllChev — iter 9dq v70+v71 standalone
     link onder de FREE-balk. Verwijderd in v72: operator-keuze om de
     count IN de card te zetten (boven de chevron). Zie moreToggleLabel
     hierboven. Styles weggehaald om dead code te vermijden. */

  /* Operator, 14 september 2026 (Apple-stijl): losse witte kaarten per
     rij → één bento-eiland. Achtergrond/radius/marge verhuisd naar
     `libRowsIsland` (de wrapper om de hele lijst); elke rij zelf is nu
     transparant en gescheiden door een flinterdunne hairline
     (`libRowSeparated`, per rij toegepast behalve de laatste). */
  libRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  libRowSeparated: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  libRowLocked: { opacity: 0.65 },
  libRowArt: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: C.border,
  },
  libRowArtImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  libRowPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  /* FIX 9: dezelfde behandeling als de free-balk play-knop. Donkere
     scrim wordt vervangen door een blauwe gradient via een Linear-
     Gradient-child. backgroundColor transparant zodat de child volledig
     zichtbaar is. */
  libRowPlayActive: {
    backgroundColor: 'transparent',
  },
  libRowPlayGlyph: { color: '#fff', fontSize: 16 },
  /* FIX 15b: status-regel binnen SessionRow (serie-expansion). Iets
     kleiner dan in het free-blokje omdat de rij visueel compacter is. */
  statusRowRow: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  /* Operator, 14 september 2026: Eyebrow-rol — 11px Bold, +1.5 (was
     9px/+1, eigen willekeurige waarde). Draagt nu ook de PREVIEW-suffix
     inline, dus geen apart pilletje meer nodig (zie `libRowPreviewTag`,
     `libRowTagWrap` — nu ongebruikt, styles blijven staan als iemand
     ooit de pil-variant terug wil). */
  libRowTag: {
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  libRowTagFree: { color: C.free },
  libRowTagPro: { color: C.faint },
  /* Iter v189 (2026-07-02): row-tag wrap (voor tier badge + PREVIEW pill
     naast elkaar) + PREVIEW pill styling. */
  libRowTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  /* Operator, 14 september 2026: felblauwe omlijnde pil → zachte 8%
     Royal-Indigo-tint, geen rand, conform `recommendedTxt`-token
     (10.5px SemiBold). */
  libRowPreviewTag: {
    color: ROYAL_INDIGO,
    fontSize: 10.5,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0,
    /* Operator, 26 september 2026: was een navy-tint (Royal Indigo), stond
       niet meer bij de teal tekstkleur hierboven — nu meegewisseld. */
    backgroundColor: `${AudioAccent}14`,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  /* Prominent Body-rol — 16px Medium (was 14px Bold, eigen willekeurige
     waarde los van het font-systeem). */
  libRowTitle: { color: C.text, fontSize: 16, fontFamily: BrandFonts.medium },
  /* Caption/Muted-rol — 12.5px Regular. */
  libRowDesc: {
    color: C.dim,
    fontSize: 12.5,
    fontFamily: BrandFonts.regular,
    marginTop: 3,
    lineHeight: 17,
  },

  /* flatRow / flatRowArt / flatRowArtImg / flatRowBody / flatRowTag /
     flatRowTagFree / flatRowTagPro / flatRowTitle / flatRowSub /
     flatRowHeart / flatRowHeartGlyph zijn verhuisd naar
     src/components/LibraryListRow.tsx (gebruikt door de drie sub-pages
     onder /library/). De Audio Library-tab heeft geen flat-list meer. */

  /* "NEW"-pill rechtsboven op een serie-card (in de pillCluster naast
     VIEW ALL) wanneer de serie minstens 1 sessie heeft waarvoor
     isNew() true is. Niet tikbaar; alleen visueel signaal. */
  flatNewPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: C.accent,
  },
  flatNewPillTxt: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.54, // ≈ 0.06em bij 9px
    textTransform: 'uppercase',
  },

  /* Hartje-knop rechts op een sessierij. Outline (♡) vs gevuld (♥);
     kleur wisselt via heartGlyphActive. Container is 20×20 met hitSlop
     in de Pressable zelf voor ruimere tikzone. */
  heartBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  /* Operator, 14 september 2026: was wit-gebaseerd (0.4 alpha) — zo goed
     als onzichtbaar op de lichte rij-achtergrond ("spookhartje"). */
  heartGlyph: {
    fontSize: 18,
    color: C.faint,
    fontWeight: '700',
    lineHeight: 20,
  },
  heartGlyphActive: {
    color: '#f43f5e',
  },

  /* emptyState / emptyGlyph / emptyTitle / emptySub zijn verwijderd —
     EmptyState-component is verhuisd naar de Library-sub-pages, elk met
     hun eigen lokale styles. Op de Audio Library-tab bestaat geen empty-
     state meer omdat de series-lijst altijd 12 items toont (search-modus
     uitgezonderd, en die hoeft geen empty-state te tonen). */

  /* Soundscapes subcat-kaart — eigen foto + eyebrow + naam, ingeklapt. */
  libSubcatUnit: { marginBottom: 12 },
  libSubcatCard: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: C.border,
    justifyContent: 'flex-end',
  },
  libSubcatBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  libSubcatGrad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  libSubcatBody: { paddingHorizontal: 14, paddingBottom: 14, paddingRight: 56 },
  /* Operator, 15 september 2026: "tekst op de cards niet consistent met
     de rest" — bleek een echte contrastbug, geen stijlkeuze: `C.accent`/
     `C.text` zijn in light mode DONKERE kleuren (Royal Indigo/bijna-
     zwart), bedoeld voor tekst op een lichte pagina-achtergrond. Deze
     kaarten tonen tekst OP EEN DONKERE FOTO (met zwarte gradient-
     overlay eronder) — daar hoort tekst-op-foto altijd wit te blijven,
     ongeacht thema, exact zoals de Pillar-kaarten al deden. Eyebrow was
     bovendien een lange beschrijvende zin ("Theta Waves (4-7 Hz) · Best
     with headphones") in ALL CAPS — die regel is alleen voor labels van
     max. twee woorden (Apple-font-framework), dus nu sentence case. */
  libSubcatEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    letterSpacing: 0.2,
    marginBottom: 4,
    fontFamily: BrandFonts.regular,
    lineHeight: 15,
  },
  libSubcatTitle: {
    color: '#ffffff',
    fontSize: 22,
    letterSpacing: -0.3,
    fontFamily: BrandFonts.bold,
  },

  /* ── AANKOOPBLOK — blauwdruk §3.6 / bron regel 3746+ ── */
  /* Iter 9yy: buyBlock wordt nu één cohesief frame. Subtle bg-tint +
     border + ruimere padding = visueel "one purchase experience"-blok
     ipv losse elementen die toevallig dicht bij elkaar staan. */
  /* Operator, 14 september 2026 (Apple-stijl S03): kaart-chrome van een
     dooraderd, donker semi-transparant vlak naar `C.surface` (puur wit)
     — dit blok is zelf een kaart op het off-white grondvlak, net als de
     quote-kaart in S01. */
  /* Operator, 26 september 2026 (huisstijl v5.7 .plan — exacte bron):
     radius 20 → 16, rand toegevoegd (rgba(255,255,255,.1)) — de witte
     gradient-overlay in de JSX levert het "glas"-effect zelf. */
  /* Operator, 26 september 2026: `backgroundColor` weg — dit is nu een
     BlurView (`tint="dark"`, zie JSX), die zelf de transparante
     achtergrond levert. Een aparte opake bg zou de blur erachter
     verbergen. */
  buyBlock: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...SOFT_SHADOW,
  },
  /* fontFamily i.p.v. fontWeight (operator, 10 augustus 2026: "fonts in
     audio library afstemmen op breathwork"). De Inter-gewichten zijn hier
     losse geladen lettertypebestanden, geen variabel font — `fontWeight`
     zonder een bijpassende `fontFamily` heeft op deze bestanden GEEN
     effect en valt terug op het globale default (Inter Regular, zie
     _layout.tsx). Deze koppen oogden daardoor dunner dan bedoeld, en
     dunner dan de overeenkomstige koppen op breath-session.tsx (die wél
     BrandFonts.extrabold/bold gebruiken). */
  /* Operator, 16 september 2026 ("Apple verkoopt geen abonnement, Apple
     verkoopt toegang tot een betere versie van jezelf — titel korter,
     emotioneler, groter, geen kleine sub-kopjes"): vervangt buyTitle/
     buySub/buyMissionRow/buyMissionLabel/buyMissionStatement/buyDivider
     — één groot statement + één kleine, rustige regel eronder. */
  buyHero: {
    color: C.text,
    fontFamily: BrandFonts.bold,
    fontSize: 34,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  buyHeroSub: {
    color: C.dim,
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    marginBottom: 24,
  },

  /* Twee prijskaarten naast elkaar (Monthly links, Yearly rechts). */
  priceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  /* ── Prijskaart-laag 1: outer wrap (Pressable). Geen border, geen bg —
     die zitten op cardClip. Outer mag wél de shadow dragen zodat de glow
     onder de kaart valt zonder door cardClip's overflow-hidden te worden
     afgeknipt. ── */
  /* Operator, 26 september 2026 (huisstijl v5.7): geen los schaduw-effect
     meer op de outer-wrapper — de bron-kaart onderscheidt selectie
     uitsluitend via cardClip's rand/vlak, niet via elevatie. */
  cardOuter: {
    flex: 1,
    position: 'relative',
  },

  /* ── Prijs-tegel (.plan-opt, huisstijl v5.7 — exacte bron) ──
     Onactief: rgba(255,255,255,.04) vlak, 1.5px rgba(255,255,255,.06) rand.
     Actief: rgba(0,0,0,.28) vlak, 1.5px wit (#f4f4f4). Randdikte is ALTIJD
     1.5px voor beide — alleen kleur/opacity wisselt, nooit de dikte. */
  /* Operator, 26 september 2026 ("beide kaarten moeten even groot zijn"):
     `flex: 1` ontbrak — zonder dat bleef deze box op zijn eigen
     content-hoogte staan terwijl de buitenste Pressable al wél meestrekte
     met de langere Yearly-inhoud, dus de zichtbare rand-boxen verschilden
     in hoogte. Nu stretcht cardClip mee. */
  cardClip: {
    flex: 1,
    borderRadius: 14,
    /* Operator, 26 september 2026 ("omlijning bij aanklikken dunner,
       eleganter, niet zo wit"): 1.5 → 1, en de selectie-rand hieronder is
       nu zacht-transparant wit i.p.v. opaak stark wit. */
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardClipSelected: {
    borderColor: 'rgba(244,244,244,0.45)',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  /* .po-name — Operator, 16 september 2026: vervangt de MOST POPULAR/
     BEST VALUE-tags — gewoon de naam van het plan, geen marketing-claim.
     Huisstijl v5.7: blijft grijs (#a1a1a6) ONGEACHT selectie — alleen de
     kaart-rand/vlak verandert, niet dit label. `paddingRight: 28` (exacte
     bronwaarde) hield ik er eerst per ongeluk uit — zonder die ruimte
     liep de tekst onder het vinkje rechtsboven. */
  planLabel: {
    color: '#a1a1a6',
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    paddingRight: 28,
  },
  /* .po-name .save — huisstijl v5.7: Bio-Teal Light (#4AF0D4), NIET groen,
     eigen regel (block) met 4px afstand tot "Yearly" erboven. */
  planSaveBadge: {
    color: AudioAccentLight,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    marginTop: 4,
  },
  /* Operator, 26 september 2026: Monthly se tegenhanger van
     `planSaveBadge` — enkel om de prijs op dezelfde regel te krijgen als
     Yearly. Grijs, geen accentkleur: dit is geen promo. */
  planNeutralBadge: {
    color: '#a1a1a6',
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    marginTop: 4,
  },
  /* .po-trial — zelfde Bio-Teal Light als de save-badge. */
  planTrialText: {
    color: AudioAccentLight,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    marginTop: 6,
  },

  /* .po-check — 22x22, huisstijl v5.7. Onactief: transparant vlak met een
     grijze ring (#5a5a5a). Actief: gevuld Bio-Teal (#00A3A3) + wit vinkje. */
  selCircle: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#5a5a5a',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selCircleOn: {
    borderColor: AudioAccent,
    backgroundColor: AudioAccent,
  },
  selCircleCheck: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
  priceBig: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  /* Operator, 15 september 2026 (Apple-upgrade): "prijzen moeten
     gigantisch en dik gedrukt" — 22px (H2-rol) las als een gewoon
     bedragregel, niet als het belangrijkste getal op de kaart. Groter dan
     zelfs de H1 (32px): het bedrag IS hier de hoofdboodschap. */
  priceBigAmount: {
    color: C.text,
    fontSize: 36,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.6,
  },
  priceBigPer: {
    color: C.dim,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    marginBottom: 4,
  },
  priceMeta: {
    color: C.dim,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },

  /* OUR MISSION-card. */
  missionCard: {
    backgroundColor: C.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
  },
  missionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  missionStar: {
    color: C.accent,
    fontSize: 13,
    marginRight: 6,
  },
  missionLabel: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  missionTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  missionSub: {
    color: C.dim,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },

  /* CTA — grote blauwe knop. */
  /* Iter 9yy: marginTop 18 → 20 voor iets meer ademruimte tussen
     pricing-cards en CTA. Plus subtle shadow voor primaire-actie
     emphasis (Apple-stijl filled-action button). */
  /* Operator, 26 september 2026 (huisstijl v5.7 .plan-cta, exacte bron):
     altijd solide wit, nooit transparant als ruststand — het transparant/
     geactiveerd-bij-tik-experiment gaf een press-flash die niet duidelijk
     zichtbaar was. Border #D2D2D7, tekst #1D1D1F, exact zoals de bron. */
  ctaBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D2D2D7',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  /* CTA-knoptekst-rol — 17px SemiBold, geen letterSpacing. */
  ctaTxt: {
    color: '#1D1D1F',
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
  },
  /* Operator, 16 september 2026 ("in een app verloopt betaling altijd
     veilig via de store, geen sloten/logo's nodig — alleen de wettelijk
     verplichte links, heel klein en zachtgrijs"): vervangt billedByRow/
     billedByLine/billedByDot/billedByMeta/fineline/checks/check/
     secureRow. */
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },
  legalLinkText: {
    color: C.dim,
    fontSize: 11,
    fontFamily: BrandFonts.regular,
  },
  legalLinkSep: {
    color: C.faint,
    fontSize: 11,
  },

  /* ── LIBRARY-CONTROLS — zoekbalk + filter-pills + Your Journey-card.
     Bron: vz-view-library, geconsolideerd in deze tab. ── */
  searchWrap: {
    /* marginTop 0 — exploreHead.paddingBottom (44) levert al ruimte boven
       de zoekbalk (≈ user-spec "~32px boven de zoekbalk"). */
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 0,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 0,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  /* X-knop rechts in de zoekbalk — alleen zichtbaar wanneer query niet
     leeg is. Tap leegt setSearchQuery('') en herstelt default-view. */
  searchClear: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  searchClearGlyph: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 22,
    fontWeight: '500',
    lineHeight: 24,
    marginTop: -2,
  },
  /* ── AUTOCOMPLETE — Spotify-stijl gegroepeerde resultaten ──
     Drie categorieën (Series / Sessions / Inspirators) met eigen sectie-
     header en compact rij-formaat (40×40 foto/avatar). */
  acGroup: {
    marginBottom: 20,
  },
  acGroupEyebrow: {
    color: C.accent,
    fontSize: 11,
    letterSpacing: 1.65, // ≈ 0.15em bij 11px
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 2,
    fontFamily: BrandFonts.regular,
  },
  acRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 12,
  },
  acArt: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  acArtImg: { width: '100%', height: '100%' },
  /* Inspirator-avatar — blauwe ronde container met initialen i.p.v. foto. */
  acAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(127,178,229,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(127,178,229,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acAvatarTxt: {
    color: C.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  acBody: { flex: 1 },
  acTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /* Iter 2026-06-05: FREE label in active player area — wit i.p.v. groen
     (kleur-cleanup, default = wit, groen alleen voor completion). */
  acTagFree: { color: 'rgba(255,255,255,0.72)' },
  acTagPro: { color: 'rgba(255,255,255,0.55)' },
  acTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  acSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 2,
  },
  acChev: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 4,
  },
  acMore: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  /* Empty-state wanneer een zoekquery 0 matches oplevert. Gecentreerd. */
  emptySearch: {
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchGlyph: {
    fontSize: 40,
    color: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  emptySearchTitle: {
    color: '#ffffff',
    fontSize: 16,
        textAlign: 'center',
    fontFamily: BrandFonts.regular,
  },
  emptySearchSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  /* filterRow / filterPillsScroll / filterPillsContent / filterPill* /
     filterCount zijn alle verwijderd — de filter-pills-rij + teller
     wordt nu volledig INLINE gerendered in AudioScreen (zie de "Filter
     pills row"-JSX). Geen StyleSheet, geen ScrollView, geen abstractie. */
  journeyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    /* marginBottom 24 — afstand tot eerste serie-card per spec. */
    marginBottom: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 14,
  },
  /* Auto-play-next setting card — staat tussen Your Journey en de
     eerste serie-card. marginHorizontal aligned met journeyCard (18)
     en libCardUnit (via libList). */
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  settingTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  settingTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  settingSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    lineHeight: 16,
  },
  journeyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(58,143,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyIconGlyph: { fontSize: 22 },
  journeyBody: { flex: 1 },
  journeyTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
  },
  journeySub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 3,
  },
  journeyChev: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 4,
  },

  /* (Continue-card styles verwijderd 2026-05-25 — Continue-card is
     vervangen door WelcomeBackPopup op cold-start. Zie commit log /
     src/components/WelcomeBackPopup.tsx voor de nieuwe styling.) */

  /* ── DISCLAIMER (legal-toggle / legal-body, bron index_2_correct.html) ── */
  /* Operator, 14 september 2026 (Apple-stijl S04): "weg met het harde
     zwart" — puur wit vlak, radius 12, padding 14. */
  legalBlock: {
    /* Operator, 7 okt 2026: de disclaimer hoort duidelijk bij het audio-
       blok erboven — dichter tegen Free Picks, ver van de bracelet. */
    marginTop: -14,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: C.surface,
    overflow: 'hidden',
    ...SOFT_SHADOW,
  },
  legalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  legalIcon: {
    fontSize: 14,
    marginRight: 10,
    color: C.dim,
  },
  /* Body-rol — 15px Regular, #1D1D1F. */
  legalLabel: {
    flex: 1,
    color: C.text,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
  },
  legalChev: {
    color: C.dim,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 8,
  },
  legalChevOpen: {
    transform: [{ rotate: '90deg' }],
  },
  legalBody: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 2,
  },
  legalPara: {
    color: C.dim,
    fontSize: 12,
    lineHeight: 19, // ≈ 1.6 × 12
    marginBottom: 10,
  },
  legalSubHead: {
    color: C.text,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 6,
    fontFamily: BrandFonts.regular,
  },

  /* ── BRACELET-TEASER — cross-product upsell-card aan einde van library.
     Eigen panel met subtiele accent-tint zodat 'ie zich onderscheidt van
     de series-cards (geen audio-content) zonder hard te schreeuwen.
     Visueel consistent met bracelet.tsx hero zodat de tap-doorklik niet
     verwarrend voelt: gebruiker ziet dezelfde KICKSTARTER-badge + titel
     terug op de Bracelet-tab. */
  braceletTeaser: {
    backgroundColor: 'rgba(58,143,255,0.06)',
    borderColor: 'rgba(58,143,255,0.22)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 14,
    alignItems: 'center',
  },
  braceletTeaserBadge: {
    backgroundColor: 'rgba(58,143,255,0.15)',
    borderColor: 'rgba(58,143,255,0.35)',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  braceletTeaserBadgeText: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  braceletTeaserTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  braceletTeaserSub: {
    color: C.dim,
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  braceletTeaserCta: {
    color: C.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 16,
  },
});
