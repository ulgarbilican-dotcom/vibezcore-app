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
  tierBadgeColor,
  tierBadgeLabel,
} from '@/utils/access-tier';
import { useFavorites } from '@/hooks/useFavorites';
import { useIAP } from '@/hooks/useIAP';
import { useSubscription } from '@/hooks/useSubscription';
import { useBraceletOwner } from '@/utils/dev-user-override';
import { getToken } from '@/services/auth';
import {
  getSnapshot,
  onSessionFinish,
  usePlayerState,
} from '@/services/audio-player';
import {
  hideBraceletUpsell,
  showBraceletUpsell,
} from '@/services/bracelet-upsell';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gem, Heart, Sparkles, TrendingUp } from 'lucide-react-native';
import { AppleLogo, GooglePlayLogo } from '@/components/StoreLogos';
import {
  getEntryByUrl,
  getListenedLabelByUrl,
  useHistory,
} from '@/utils/history';
import { isNew } from '@/utils/isNew';
import { BREATHWORK_CHOOSER } from '@/data/breathwork-modes';
import { getModeMeta } from '@/services/ble-contract';
import { useGatedOpenSession } from '@/utils/openSession';
import { urlEq } from '@/utils/url-eq';
import { subscribeLibraryReset } from '@/utils/library-reset-intent';
import {
  consumeScrollIntent,
  requestScrollTo,
  subscribeScrollIntent,
} from '@/utils/scroll-intent';
import { useSetting } from '@/utils/settings';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
/* expo-web-browser was nodig voor de oude Gumroad-WebBrowser-flow.
   Iter 9dq v64: Gumroad-checkout vervangen door /subscribe (IAP). Indien
   ooit terug nodig (bv. een externe info-pagina openen): re-import. */
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
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

/* Merkkleuren — consistent met de rest van de app (Brand.bg #0a0a0a). */
const C = {
  bg: '#0a0a0a',
  text: '#ffffff',
  dim: 'rgba(255,255,255,0.5)',
  faint: 'rgba(255,255,255,0.32)',
  accent: '#3a8fff',
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

/* CDN — exact de host die de webapp gebruikt. */
const CDN = 'https://vibezcore-audio.b-cdn.net/images';

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
const PILLARS = [
  {
    num: '01',
    name: 'Psychological Resilience',
    key: 'resilience' as const,
    img: `${CDN}/psychological%20resilience%202.png`,
    desc: 'Build what cannot break.',
  },
  {
    num: '02',
    name: 'Inner Sovereignty',
    key: 'sovereignty' as const,
    img: `${CDN}/Stoic%20mastery.jpg`,
    desc: 'Master what is yours.',
  },
  {
    num: '03',
    name: 'Social Mastery',
    key: 'social' as const,
    /* iter 9dq v148 (operator 2026-06-15): gewisseld met Master Mental
       Clarity. Pillar 3 krijgt nu de master-mental-clarity foto, en
       Master Mental Clarity series krijgt confident-man-with-beard. */
    img: `${CDN}/master-mental-clarity.jpg`,
    desc: 'Command without force.',
  },
  {
    num: '04',
    name: 'Strategic Execution & Wealth',
    key: 'drive' as const,
    img: `${CDN}/Strategic%20wealth.jpg`,
    desc: 'Engineer your autonomy.',
  },
  /* Iter 9dq v137 (operator 2026-06-15): Tools & Practices als 5e pillar-
     kaart in de UI. Stond al in PILLAR_META + SERIES_PILLAR (data-laag)
     met 2 series (Daily Affirmations Power, Soundscapes) maar werd niet
     gerenderd. Foto-URL op Bunny CDN aangeleverd door operator. */
  {
    num: '05',
    name: 'Tools & Practices',
    key: 'tools' as const,
    img: `${CDN}/Workout%20on%20Beach_edited.jpg`,
    desc: 'Layered over everything.',
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
}) {
  return (
    <Pressable style={[s.libRow, !canPlay && s.libRowLocked]} onPress={onPress}>
      <View style={s.libRowArt}>
        {photo ? <Image source={{ uri: photo }} style={s.libRowArtImg} /> : null}
        <View style={[s.libRowPlay, isActive && s.libRowPlayActive]}>
          {isActive ? (
            <LinearGradient
              colors={['#3a8fff', '#2c7ae8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          {!canPlay ? (
            <Text style={s.libRowPlayGlyph}>🔒</Text>
          ) : (
            /* FIX 10: SVG-shape glyph ipv tekst — strakke proporties. */
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
          return (
            <Text style={[s.libRowTag, { color: tierBadgeColor(tier) }]}>
              {label}
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
                { color: label.isFull ? '#4ade80' : '#3a8fff' },
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

export default function AudioScreen() {
  const { isPro: hasSub } = useSubscription();
  const isBraceletOwner = useBraceletOwner();
  /* Auth-state voor de top sign-in CTA banner (operator-keuze
     2026-05-26: Welcome wordt na 1× dismiss niet meer bereikbaar,
     dus uitgelogde users moeten ÓÓK vanaf de Audio-tab kunnen
     inloggen, niet alleen via Account-tab). `null` = nog aan 't
     checken — banner verbergen om flicker te voorkomen. */
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
  useEffect(() => {
    if (
      !braceletOwnerColdStartRedirected &&
      isSignedIn === true &&
      isBraceletOwner
    ) {
      braceletOwnerColdStartRedirected = true;
      router.replace('/bracelet' as never);
    }
  }, [isSignedIn, isBraceletOwner]);
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
  /* Plan-keuze in het aankoopblok — Yearly standaard geselecteerd
     (blauwdruk §3.6: "Yearly visueel uitgelicht, aanbevolen"). */
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');

  /* Iter 9dq v135 (2026-06-15): pull IAP-products zodat pricing-cards in
     LOKALE valuta van de user tonen ($ voor US, € voor EU, £ voor UK, etc).
     localizedPrice is een al-opgemaakte string van StoreKit / Google Play
     Billing — wij doen GEEN valutaconversie zelf. Fallback naar EUR-defaults
     als products nog niet geladen zijn (eerste paint vóór StoreKit-call). */
  const { getProduct: getIapProduct } = useIAP();
  const monthlyProduct = getIapProduct('monthly');
  const yearlyProduct = getIapProduct('yearly');
  const monthlyPriceLabel = monthlyProduct?.localizedPrice ?? '€9.99';
  const yearlyTotalLabel = yearlyProduct?.localizedPrice ?? '€69.60';

  /* Helper: vervang het numerieke deel in een localizedPrice ("€9.99",
     "$9.99", "9,99 €") door een nieuwe value, behoud valuta-symbool. We
     gebruiken bewust GEEN Intl.NumberFormat (Hermes-compat-risico op
     oudere RN-builds). Werkt voor leading-symbol locales ($/€/£/¥) en
     valt terug op currency-code voor trailing-symbol locales. */
  const reformatWithSymbol = (sample: string, currency: string, newValue: number): string => {
    const formatted = newValue.toFixed(2);
    const leading = sample.match(/^([^\d\s]+)/);
    if (leading) return `${leading[1]}${formatted}`;
    return `${formatted} ${currency}`;
  };

  /* Per-maand-equivalent voor yearly = yearly_total / 12, in dezelfde
     valuta als yearly localizedPrice. Fallback: €5.83 (operator-pricing
     2026-06-20: yearly intro €69.99/year = €5.83/month, save 61% vs
     monthly regular €14.99). */
  const yearlyPerMonthLabel = (() => {
    if (!yearlyProduct?.priceAmountMicros) return '€5.80';
    const monthlyValue = yearlyProduct.priceAmountMicros / 12 / 1_000_000;
    return reformatWithSymbol(yearlyProduct.localizedPrice, yearlyProduct.currency, monthlyValue);
  })();

  /* Iter v163 (2026-06-27): strikethroughs komen DIRECT uit Google's
     pricingPhases (regularPriceLabel). Geen hardcoded waarden per
     valuta meer. Operator-spec: 'prijzen in app en website moeten in
     alle valuta ook kloppen met prijzen in google wat de klant
     betaald'. RevenueCat reads pricingPhases van Google Play Billing
     en geeft ons de regular post-intro prijs in dezelfde lokale
     valuta. Werkt in elke regio (EUR, USD, GBP, CAD, AUD, ...) want
     het is letterlijk wat Google teruggeeft. */

  /* Intro detectie via aanwezigheid van regularPriceLabel — Google
     geeft ALLEEN een regular phase terug als er een intro is. */
  const monthlyHasIntro = !!monthlyProduct?.regularPriceLabel;
  const yearlyHasIntro = !!yearlyProduct?.regularPriceLabel;

  /* Monthly strikethrough: regular price uit Google pricingPhases. */
  const monthlyStrikeLabel = monthlyHasIntro
    ? monthlyProduct?.regularPriceLabel ?? null
    : null;

  /* Yearly strikethrough: monthly intro current price (per website-
     layout — comparison "yearly per-month vs monthly per-month"). */
  const yearlyStrikeLabel = yearlyHasIntro ? monthlyPriceLabel : null;

  /* SAVE %: berekend uit monthly per-month vs yearly per-month, alleen
     wanneer yearly intro actief is. */
  const yearlySavePercentLabel = (() => {
    if (!yearlyHasIntro) return null;
    if (!monthlyProduct?.priceAmountMicros || !yearlyProduct?.priceAmountMicros) return null;
    const monthlyAmount = monthlyProduct.priceAmountMicros;
    const yearlyPerMonthMicros = yearlyProduct.priceAmountMicros / 12;
    const pct = Math.round((1 - yearlyPerMonthMicros / monthlyAmount) * 100);
    return `SAVE ${pct}%`;
  })();
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
  /* Y-positie van de pricing-section (buyBlock). Doel voor scroll-intent
     'pricing' vanuit de player ("Full library access" / "Get Full Access"). */
  const pricingYRef = useRef<number | null>(null);
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
      else if (target === 'pricing') scrollToTarget(pricingYRef.current);
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

  /* Iter 9dq v152 (operator 2026-06-17): tap-handler voor sessie-rij in
     "Free Picks" mode. Switcht naar de bijbehorende pillar, expandt de
     serie, scroll't naar de serie-card, en speelt de sessie. Eindstand
     voor gebruiker: hij ziet de serie-card uitgeklapt MET zijn gekozen
     sessie aan het spelen, zodat de andere sessies in die reeks zichtbaar
     zijn — exact wat operator vraagt. */
  const openSessionFromFreePicks = (sess: Session) => {
    const targetPillar = SERIES_PILLAR[sess.series];
    if (targetPillar) {
      setActivePillarFilter(targetPillar);
    }
    setExpandedSeries(sess.series);
    /* Wacht twee frames zodat de pillar-switch + expand al gerenderd
       zijn, dan scroll naar de serie-card. Iter 9dq v159 (operator-fix
       2026-06-18): GEEN auto-play meer — gebruiker landt op de
       uitgeklapte serie-card, ziet de free-sessie + alle andere
       (PRO-)sessies van die reeks, en beslist zelf wanneer 'ie tikt.
       Voelt minder agressief en geeft context voordat de player start. */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const cardY = seriesPositions.current[sess.series];
        const libY = libListYRef.current;
        if (cardY !== undefined) {
          const targetY = Math.max(0, libY + cardY - 100);
          scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
        }
      });
    });
  };
  /* Open de subscribe-flow voor de geselecteerde plan-tier.
     Iter 9dq v64 (2026-06-03): voorheen opende dit Gumroad direct in een
     WebBrowser (Custom Tab) — werkt prima voor web/sideload maar Apple
     en Google staan dit pad NIET toe voor digital subscriptions in een
     app-store gepubliceerde app. Nu pushen we naar /subscribe?tier=<plan>
     waar de IAP-bridge het overneemt: account-create form indien nodig,
     dan Apple StoreKit / Google Play Billing popup, dan receipt-verify
     naar backend.

     De GUMROAD_URLS-constant blijft in code maar wordt niet meer direct
     gebruikt — handig als referentie voor de webapp / als noodknop. */
  const openCheckout = async () => {
    if (__DEV__) console.log('[VIBEZCORE] openCheckout → /subscribe, plan =', plan);
    router.push(`/subscribe?tier=${plan}` as never);
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
    openGated(sess);
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
              paddingBottom: TAB_BAR_HEIGHT + safeInsets.bottom + 64,
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
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          s.scroll,
          /* Iter 9dq v154+v155 (operator-fix 2026-06-18):
             - paddingTop: extra ademruimte boven de search bar zodat
               'ie niet tegen de status-bar plakt. SafeAreaView pakt al
               de basis-inset; deze 12px is puur visuele lucht.
             - paddingBottom: tab bar (64 + insets.bottom) + mini-player
               + gap zodat onderste content niet wegvalt. */
          {
            paddingTop: 12,
            paddingBottom: 64 + safeInsets.bottom + 96,
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
        {!hasSub && isBraceletOwner && (
          <Pressable
            style={s.braceletUpsellBanner}
            onPress={() => requestScrollTo('pricing')}
            android_ripple={{ color: 'rgba(58,143,255,0.10)' }}
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
          </Pressable>
        )}

        {/* ── HERO ── alleen voor guest/non-PRO. PRO-users hebben geen
            "kom naar de library"-onboarding-header nodig — ze gaan direct
            naar de sessies. */}
        {!hasSub && (
          <View style={s.hero}>
            <Image
              source={{ uri: `${CDN}/audio-library.png` }}
              style={s.heroImg}
              resizeMode="cover"
            />
            <View style={s.heroGrad} />
            <View style={s.heroText}>
              <Text style={s.heroEyebrow}>VIBEZCORE Audio Library</Text>
              <Text
                style={s.heroH1}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                Where Insight{'\n'}Becomes Identity.
              </Text>
            </View>
          </View>
        )}

        {/* ── 4-FASENREGEL ── bron regel 2691-2693.
           PRO-users verbergen — onderdeel van de "library begint bij de
           search-bar"-policy (operator-besluit 2026-05-23). Returning
           power-users willen direct toegang tot content, geen marketing-
           ribbon. Guests/free-tier zien 'm wel — onderdeel van het
           onboarding-narratief. */}
        {!hasSub && (
          <View style={s.phasesWrap}>
            <Text style={s.phases}>
              Understanding
              <Text style={s.phasesArrow}>{'  →  '}</Text>
              Awareness
              <Text style={s.phasesArrow}>{'  →  '}</Text>
              Regulation
              <Text style={s.phasesArrow}>{'  →  '}</Text>
              Integration
            </Text>
          </View>
        )}

        {/* "Ontdek"-secties — BUILT ON, Emerson, EXPLORE SERIES-header —
           verbergen tijdens een actieve zoekquery EN voor PRO-users
           (operator-besluit 2026-05-23: PRO's library start direct bij
           de search-balk, geen marketing-secties).

           Operator-fix 2026-06-17: PIJLER-grid is uit deze wrapper
           gehaald en staat hieronder als eigen block — pillar cards
           moeten zichtbaar zijn voor ÉLK account-type (gast, audio PRO,
           bracelet-only, full PRO). Alleen de marketing-tekst eromheen
           blijft PRO-hidden. */}
        {!searchActive && !hasSub && (
          <>
            {/* ── BUILT ON ── bron regel 2701-2704 ── */}
            <View style={s.builtOn}>
              <Text style={s.builtOnLabel}>— BUILT ON —</Text>
              <Text style={s.builtOnText}>
                The intellectual legacy of history's greatest minds.
              </Text>
            </View>

            {/* ── EMERSON-QUOTE ── verhuisd naar onder BUILT ON
                (operator-fix 2026-06-18). Thematisch sterker: "intellectual
                legacy" → quote van Emerson. Voorheen stond 'ie onder de
                pillars in een "lege sectie" die geen relatie had met de
                pillar-grid. */}
            <View style={s.quoteBlock}>
              <Image
                source={{ uri: `${CDN}/ralph-waldo-emerson.png` }}
                style={s.quoteAvatar}
                resizeMode="cover"
              />
              <View style={s.quoteContent}>
                <Text style={s.quoteText}>
                  "The only person you are destined to become is the person you
                  decide to be."
                </Text>
                <Text style={s.quoteAuthor}>— Ralph Waldo Emerson</Text>
              </View>
            </View>
          </>
        )}

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

        {/* ── YOUR JOURNEY + NEW/FAV/FREE chips ── boven pillars
            (operator-fix 2026-06-18). Sneller toegang dan onderaan. */}
        {!searchActive && (
          <View style={s.libChipsRow}>
            <Pressable
              style={s.libChipCard}
              onPress={() => router.push('/history')}
              android_ripple={{ color: 'rgba(58, 143, 255, 0.10)' }}
              accessibilityLabel="View your listening journey"
            >
              <TrendingUp size={22} color="#3a8fff" strokeWidth={2.2} />
              <Text style={s.libChipCardLabel}>Your Journey</Text>
            </Pressable>

            {!hasSub ? (
              <Pressable
                style={s.libChipCard}
                onPress={() => router.push('/library/free')}
                android_ripple={{ color: 'rgba(58, 143, 255, 0.10)' }}
                accessibilityLabel="Browse all free sessions"
              >
                <Gem size={22} color="#3a8fff" strokeWidth={2.2} />
                <Text style={s.libChipCardLabel}>Free Sessions</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={s.libChipCard}
                  onPress={() => router.push('/library/new')}
                  android_ripple={{ color: 'rgba(58, 143, 255, 0.10)' }}
                  accessibilityLabel="Browse new sessions"
                >
                  <Sparkles size={22} color="#3a8fff" strokeWidth={2.2} />
                  <Text style={s.libChipCardLabel}>New</Text>
                </Pressable>
                <Pressable
                  style={s.libChipCard}
                  onPress={() => router.push('/library/favorites')}
                  android_ripple={{ color: 'rgba(58, 143, 255, 0.10)' }}
                  accessibilityLabel="Browse favorites"
                >
                  <Heart size={22} color="#3a8fff" strokeWidth={2.2} />
                  <Text style={s.libChipCardLabel}>Favorites</Text>
                </Pressable>
              </>
            )}
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
            {!hasSub && (
              <Text
                style={{
                  color: C.dim,
                  fontFamily: 'Inter_500Medium',
                  fontSize: 12,
                  textAlign: 'center',
                  letterSpacing: 0.4,
                  marginTop: 8,
                  marginBottom: 14,
                  paddingHorizontal: 20,
                  opacity: 0.85,
                }}
              >
                Tap a card to start or continue your journey
              </Text>
            )}

            <View
              style={s.pillarsGrid}
              onLayout={(e) => {
                pillarsYRef.current = e.nativeEvent.layout.y;
              }}
            >
              {PILLARS.map((p) => {
                const isActiveFilter = activePillarFilter === p.key;
                /* Aantal sessies in deze pillar — uit SESSIONS gefilterd via
                   SERIES_PILLAR. Toont "VIEW X SESSIONS" zoals web. */
                const sessionCount = SESSIONS.filter(
                  (sess) => SERIES_PILLAR[sess.series] === p.key,
                ).length;
                return (
                  <Pressable
                    key={p.num}
                    style={[
                      s.pillar,
                      { height: 200 },
                      isActiveFilter && {
                        borderWidth: 2,
                        borderColor: C.accent,
                      },
                    ]}
                    onPress={() => {
                      if (isActiveFilter) {
                        /* Toggle off: clear filter, geen scroll (gebruiker
                           is al in deze view en wil mogelijk "alles" zien). */
                        setActivePillarFilter(null);
                      } else {
                        /* Set filter + auto-scroll naar library section. */
                        setActivePillarFilter(p.key);
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
                    onLongPress={() => setDetailPillar(p)}
                    android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                    accessibilityLabel={`Filter library to ${p.name}`}
                  >
                    <Image source={{ uri: p.img }} style={s.pillarImg} resizeMode="cover" />
                    {/* Subtiele dark gradient onderaan voor tekst-leesbaarheid
                        (operator 2026-06-14): geen volledige overlay meer,
                        alleen een soft fade van transparant → donker over de
                        onderste 60% zodat foto's licht blijven maar tekst
                        scherp leesbaar is zonder visueel rommelige shadows. */}
                    <LinearGradient
                      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
                      locations={[0, 1]}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: '65%',
                      }}
                      pointerEvents="none"
                    />
                    {/* Subtiele top fade — geeft de PILLAR 0X label een
                        leesbare context zonder de foto te verzwaren. */}
                    <LinearGradient
                      colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
                      locations={[0, 1]}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        height: 50,
                      }}
                      pointerEvents="none"
                    />
                    {/* PILLAR 0X label — top-left, uppercase tracked tekst */}
                    <Text
                      style={{
                        position: 'absolute',
                        top: 12,
                        left: 14,
                        color: 'rgba(255,255,255,0.85)',
                        fontFamily: 'Inter_800ExtraBold',
                        fontSize: 10,
                        letterSpacing: 2,
                      }}
                    >
                      {`PILLAR ${p.num}`}
                    </Text>
                    {/* Bottom block — vaste hoogte met space-between layout.
                        Top: naam + tagline tight tegen elkaar.
                        Bottom: VIEW X SESSIONS + ↓ pijl.
                        Naam start altijd op exact dezelfde Y over alle 4
                        cards (anchor = top van block, block bottom = 12). */}
                    <View
                      style={{
                        position: 'absolute',
                        left: 14,
                        right: 14,
                        bottom: 12,
                        height: 92,
                        justifyContent: 'space-between',
                      }}
                    >
                      <View>
                        <Text
                          style={[
                            s.pillarName,
                            {
                              fontSize: 14,
                              lineHeight: 17,
                              color: '#fff',
                              letterSpacing: -0.3,
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {p.name}
                        </Text>
                        <Text
                          style={{
                            color: 'rgba(255,255,255,0.75)',
                            fontFamily: 'Inter_500Medium',
                            fontSize: 11,
                            marginTop: 3,
                            letterSpacing: 0.1,
                            lineHeight: 14,
                          }}
                          numberOfLines={1}
                        >
                          {p.desc}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: 8,
                          borderTopWidth: 1,
                          borderTopColor: 'rgba(255,255,255,0.18)',
                        }}
                      >
                        <Text
                          style={{
                            color: 'rgba(255,255,255,0.65)',
                            fontFamily: 'Inter_700Bold',
                            fontSize: 9.5,
                            letterSpacing: 1.4,
                          }}
                        >
                          {`VIEW ${sessionCount} SESSIONS`}
                        </Text>
                        <Text
                          style={{
                            color: isActiveFilter
                              ? C.accent
                              : 'rgba(255,255,255,0.65)',
                            fontFamily: 'Inter_700Bold',
                            fontSize: 14,
                          }}
                        >
                          ↓
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              {/* ── 6e CARD: FREE PICKS — "Taste the Library" ──
                  Operator-fix 2026-06-17 iter 2: card hoort in de pillar-
                  grid (positie 6, onder pillar 4 in 2-col layout). Tap
                  zet activePillarFilter='free' wat de library-sectie
                  switcht naar de 28 free-sessie-rijen, en gebruiker kan
                  doorklikken naar de juiste serie. "Back to pillars"-knop
                  brengt 'm terug naar de pillar-grid.
                  Iter 9dq v153 (operator-fix 2026-06-17): NIET tonen
                  voor PRO-users (audio PRO + full PRO). Die hebben alles
                  al — een "free picks" entry-point is dan visuele ruis. */}
              {!hasSub && (() => {
                const isFreeActive = activePillarFilter === 'free';
                const freeCount = SESSIONS.filter((sess) => sess.free).length;
                return (
                  <Pressable
                    key="free-picks"
                    style={[
                      s.pillar,
                      {
                        height: 200,
                        backgroundColor: 'rgba(74,222,128,0.06)',
                        borderColor: isFreeActive
                          ? '#4ade80'
                          : 'rgba(74,222,128,0.40)',
                        borderWidth: isFreeActive ? 2 : 1,
                      },
                    ]}
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
                    android_ripple={{ color: 'rgba(74,222,128,0.10)' }}
                    accessibilityLabel="Free picks — first session of every series"
                  >
                    {/* Geen achtergrondfoto — groene tint + play-icoon
                        in het midden zodat het visueel onderscheidt van
                        de 5 echte pillar-cards eronder. */}
                    <View
                      style={{
                        position: 'absolute',
                        top: 36,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: 'rgba(74,222,128,0.16)',
                          borderWidth: 1,
                          borderColor: 'rgba(74,222,128,0.45)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: '#4ade80',
                            fontFamily: 'Inter_800ExtraBold',
                            fontSize: 22,
                            marginLeft: 3,
                          }}
                        >
                          ▶
                        </Text>
                      </View>
                    </View>
                    {/* FREE label — top-left, zoals "PILLAR 0X" op de
                        andere cards. */}
                    <Text
                      style={{
                        position: 'absolute',
                        top: 12,
                        left: 14,
                        color: '#4ade80',
                        fontFamily: 'Inter_800ExtraBold',
                        fontSize: 10,
                        letterSpacing: 2,
                      }}
                    >
                      {`FREE · ${freeCount}`}
                    </Text>
                    {/* Bottom block — naam + tagline + actie-regel,
                        gespiegeld aan pillar-card-structuur. */}
                    <View
                      style={{
                        position: 'absolute',
                        left: 14,
                        right: 14,
                        bottom: 12,
                        height: 92,
                        justifyContent: 'space-between',
                      }}
                    >
                      <View>
                        <Text
                          style={[
                            s.pillarName,
                            {
                              fontSize: 14,
                              lineHeight: 17,
                              color: '#fff',
                              letterSpacing: -0.3,
                            },
                          ]}
                          numberOfLines={2}
                        >
                          Free Picks
                        </Text>
                        <Text
                          style={{
                            color: 'rgba(255,255,255,0.75)',
                            fontFamily: 'Inter_500Medium',
                            fontSize: 11,
                            marginTop: 3,
                            letterSpacing: 0.1,
                            lineHeight: 14,
                          }}
                          numberOfLines={1}
                        >
                          Taste the library
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: 8,
                          borderTopWidth: 1,
                          borderTopColor: 'rgba(74,222,128,0.30)',
                        }}
                      >
                        <Text
                          style={{
                            color: '#4ade80',
                            fontFamily: 'Inter_700Bold',
                            fontSize: 9.5,
                            letterSpacing: 1.4,
                          }}
                        >
                          {`LISTEN ${freeCount} SESSIONS`}
                        </Text>
                        <Text
                          style={{
                            color: isFreeActive
                              ? '#4ade80'
                              : 'rgba(74,222,128,0.65)',
                            fontFamily: 'Inter_700Bold',
                            fontSize: 14,
                          }}
                        >
                          ↓
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })()}
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

        {/* ── HINT-CARD voor de lege default-state (operator-fix B+C) ──
            Wanneer er geen pillar-filter actief is en geen search-query,
            tonen we een subtiele "tap een pillar"-hint zodat gebruikers
            begrijpen dat de pillar-grid de actieve ingang is. */}
        {!searchActive && !activePillarFilter && (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 8,
              marginBottom: 24,
              paddingVertical: 18,
              paddingHorizontal: 22,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(58,143,255,0.20)',
              backgroundColor: 'rgba(58,143,255,0.04)',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: C.accent,
                fontFamily: 'Inter_700Bold',
                fontSize: 13,
                marginBottom: 4,
                letterSpacing: 0.3,
              }}
            >
              ↑ Tap a pillar above
            </Text>
            <Text
              style={{
                color: C.dim,
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
                textAlign: 'center',
                lineHeight: 16,
              }}
            >
              Each pillar opens a focused set of series. New sessions added monthly.
            </Text>
          </View>
        )}

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
                        <Pressable
                          key={'ser:' + ser.name}
                          style={s.acRow}
                          onPress={() => openSerieFromSearch(ser.name, false)}
                          android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
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
                            <Text style={s.acTitle} numberOfLines={1}>
                              {ser.name}
                            </Text>
                            <Text style={s.acSub} numberOfLines={1}>
                              {ser.sessions.length}{' '}
                              {ser.sessions.length === 1
                                ? 'session'
                                : 'sessions'}
                            </Text>
                          </View>
                          <Text style={s.acChev}>›</Text>
                        </Pressable>
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
                      const photo = SERIES_PHOTO[sess.series];
                      const isFav = favorites.has(sess.url);
                      return (
                        <Pressable
                          key={'sess:' + sess.url}
                          style={s.acRow}
                          onPress={() =>
                            openSerieFromSearch(sess.series, true)
                          }
                          android_ripple={{
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
                            <Text style={s.acTitle} numberOfLines={1}>
                              {sess.title}
                            </Text>
                            <Text style={s.acSub} numberOfLines={1}>
                              {sess.series}
                            </Text>
                          </View>
                          <HeartButton
                            active={isFav}
                            onPress={() => toggleFavorite(sess)}
                          />
                        </Pressable>
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
                        <Pressable
                          key={'insp:' + insp.name}
                          style={s.acRow}
                          onPress={() =>
                            openSerieFromSearch(insp.seriesName, false)
                          }
                          android_ripple={{
                            color: 'rgba(255,255,255,0.04)',
                          }}
                        >
                          <View style={s.acAvatar}>
                            <Text style={s.acAvatarTxt}>
                              {initialsOf(insp.name)}
                            </Text>
                          </View>
                          <View style={s.acBody}>
                            <Text style={s.acTitle} numberOfLines={1}>
                              {insp.name}
                            </Text>
                            <Text style={s.acSub} numberOfLines={1}>
                              Inspired {count}{' '}
                              {count === 1 ? 'session' : 'sessions'}
                            </Text>
                          </View>
                          <Text style={s.acChev}>›</Text>
                        </Pressable>
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
                      gap: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: 'rgba(58,143,255,0.10)',
                      borderWidth: 1,
                      borderColor: 'rgba(58,143,255,0.32)',
                    }}
                    android_ripple={{ color: 'rgba(58,143,255,0.20)' }}
                  >
                    <Text
                      style={{
                        color: C.accent,
                        fontFamily: 'Inter_700Bold',
                        fontSize: 14,
                      }}
                    >
                      ↑
                    </Text>
                    <Text
                      style={{
                        color: C.accent,
                        fontFamily: 'Inter_700Bold',
                        fontSize: 11.5,
                        letterSpacing: 1.4,
                      }}
                    >
                      BACK TO PILLARS
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
                        borderColor: 'rgba(255,255,255,0.30)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      accessibilityLabel="What does auto-play do?"
                    >
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.65)',
                          fontFamily: 'Inter_700Bold',
                          fontSize: 10,
                          lineHeight: 12,
                        }}
                      >
                        i
                      </Text>
                    </Pressable>
                    <Switch
                      value={autoPlayNext}
                      onValueChange={setAutoPlayNext}
                      trackColor={{ false: '#3a3a3a', true: '#3a8fff' }}
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
                        titel van de serie-card eronder. Verschil: free krijgt
                        groene accent en andere copy. */}
                    <View
                      style={{
                        marginBottom: 20,
                        marginTop: 8,
                        paddingVertical: 18,
                        paddingHorizontal: 20,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: isFreeMode
                          ? 'rgba(74,222,128,0.40)'
                          : 'rgba(58,143,255,0.40)',
                        backgroundColor: isFreeMode
                          ? 'rgba(74,222,128,0.06)'
                          : 'rgba(58,143,255,0.06)',
                        alignItems: 'center',
                      }}
                    >
                      {/* Eyebrow */}
                      <Text
                        style={{
                          color: isFreeMode ? '#4ade80' : C.accent,
                          fontFamily: 'Inter_800ExtraBold',
                          fontSize: 11,
                          letterSpacing: 2.4,
                          textTransform: 'uppercase',
                          marginBottom: 8,
                          textAlign: 'center',
                        }}
                      >
                        {isFreeMode
                          ? `FREE PICKS · ${pillarSeries.length} SERIES`
                          : `PILLAR ${pillarMeta!.num}`}
                      </Text>
                      {/* Section-naam — chapter title, groot en bold,
                          gecentreerd binnen het omkaderde panel. */}
                      <Text
                        style={{
                          color: C.text,
                          fontFamily: 'Inter_800ExtraBold',
                          fontSize: 26,
                          letterSpacing: -0.5,
                          lineHeight: 30,
                          marginBottom: 6,
                          textAlign: 'center',
                        }}
                      >
                        {isFreeMode ? 'Taste the Library' : pillarMeta!.name}
                      </Text>
                      {/* Tagline — gecentreerd, muted kleur. */}
                      <Text
                        style={{
                          color: C.dim,
                          fontFamily: 'Inter_500Medium',
                          fontSize: 13.5,
                          letterSpacing: -0.1,
                          lineHeight: 19,
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
                        {SESSIONS.filter((sess) => sess.free).map((sess) => {
                          const photo = SERIES_PHOTO[sess.series];
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
                              android_ripple={{ color: 'rgba(74,222,128,0.06)' }}
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
                                    color: '#4ade80',
                                    fontFamily: 'Inter_800ExtraBold',
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
                                <Text
                                  style={{
                                    color: C.dim,
                                    fontFamily: 'Inter_500Medium',
                                    fontSize: 12,
                                    letterSpacing: -0.05,
                                  }}
                                  numberOfLines={1}
                                >
                                  {`Series · ${sess.series}`}
                                </Text>
                              </View>
                              {/* Play-pijl */}
                              <Text
                                style={{
                                  color: 'rgba(74,222,128,0.75)',
                                  fontFamily: 'Inter_800ExtraBold',
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
                <Pressable
                  style={s.libCard}
                  onPress={() => toggle(ser.name)}
                  android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
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
                     kraakhelder; rand + glow doen al het "actief"-werk. */}
                  {/* Card-overlay — bron .card-ov: linear-gradient TO TOP,
                     dus zwart onder, transparant boven. RN render't top→bottom,
                     dus colors + locations omkeren: 0% top transparent,
                     35% lichte tint, 100% bottom 0.92 zwart. */}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.92)']}
                    locations={[0, 0.35, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  {/* Pill-cluster rechtsboven — alleen NEW-badge (wanneer
                     hasNew=true). De More/Less toggle is verhuisd naar
                     bottom-right (operator-feedback 2026-05-30: chevron-
                     only, hoort visueel onderaan de card, niet bovenop). */}
                  {hasNew && (
                    <View style={s.pillCluster}>
                      <View style={s.flatNewPill}>
                        <Text style={s.flatNewPillTxt}>NEW</Text>
                      </View>
                    </View>
                  )}
                  {/* More/Less toggle — rechtsONDER. Count-tekst boven
                      de chevron wanneer card collapsed is (operator-
                      feedback iter 9dq v72): geeft de user expliciete
                      "er zit meer onder"-signaal naast de pijl. Open-
                      state toont enkel ⌃ (tekst is dan visueel
                      overbodig — sessies zijn uitgeklapt zichtbaar). */}
                  <Pressable
                    style={s.moreToggleBR}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      toggle(ser.name);
                    }}
                    hitSlop={10}
                    android_ripple={{
                      color: 'rgba(255,255,255,0.12)',
                      borderless: true,
                    }}
                    accessibilityLabel={
                      isOpen
                        ? 'Hide sessions'
                        : isSoundscapes
                          ? 'Show all categories'
                          : 'Show all sessions'
                    }
                  >
                    {!isOpen && (
                      <Text style={s.moreToggleLabel}>
                        {isSoundscapes ? 'All categories' : 'All sessions'}
                      </Text>
                    )}
                    <Text style={s.moreToggleChev}>
                      {isOpen ? '⌃' : '⌄'}
                    </Text>
                  </Pressable>
                  {/* FIX 5: 3px progress-strip net boven libCardBody. Pakt
                     dezelfde flex-end-flow als libCardBody zodat-ie precies
                     bovenaan het content-blok zit (= visuele "foto/body"-
                     grens). LinearGradient #3a8fff → #5ba4ff. */}
                  {isCardActive ? (
                    <View style={s.libCardProgressTrack}>
                      <LinearGradient
                        colors={['#3a8fff', '#60a5fa']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          s.libCardProgressFill,
                          { width: `${cardPct}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                  <View style={s.libCardBody}>
                    {eyebrow ? (
                      <Text style={s.libCardEyebrow}>{eyebrow}</Text>
                    ) : null}
                    <Text style={s.libCardTitle}>{ser.name}</Text>
                    {subline ? (
                      <Text style={s.libCardSubline}>{subline}</Text>
                    ) : null}
                  </View>
                </Pressable>

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
                    <Pressable
                      key={sess.url}
                      style={[
                        s.libFreeRow,
                        isActive && s.libFreeRowActive,
                      ]}
                      onPress={() => openGated(sess)}
                      android_ripple={{
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
                            colors={['#3a8fff', '#2c7ae8']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={s.freePlayBtnGradient}
                          />
                        ) : null}
                        {/* FIX 10: SVG-shape glyph. Iter 2026-06-05:
                           kleur-cleanup — default state is nu wit (was
                           groen). Blauwe accent op active state blijft. */}
                        <PlayPauseGlyph
                          size={14}
                          color={isActive ? '#ffffff' : '#ffffff'}
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
                        {/* Status-regel ("▶ Partly listened" / "✓ Fully
                           listened" / "✓ Fully listened x2") alleen
                           wanneer er history bestaat voor deze sessie-url.
                           Iter 9dq v111 (2026-06-04): label nu via
                           getListenedLabelByUrl met fc-count. */}
                        {(() => {
                          const label = getListenedLabelByUrl(sess.url);
                          if (!label) return null;
                          return (
                            <Text
                              style={[
                                s.statusRow,
                                {
                                  color: label.isFull ? '#4ade80' : '#3a8fff',
                                },
                              ]}
                            >
                              {label.isFull ? '✓ ' : '▶ '}
                              {label.text}
                            </Text>
                          );
                        })()}
                      </View>
                      {isActive ? (
                        <View style={s.freeProgressTrack}>
                          <LinearGradient
                            colors={['#3a8fff', '#5ba4ff']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[s.freeProgressFill, { width: `${pct}%` }]}
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}

                {/* Inline expansie — non-Soundscapes: sessierijen.
                    Operator-keuze 2026-05-27: voor uitgelogde/free users
                    de free-sessies WEGFILTEREN uit deze list — die staan
                    al als groene promo-balk hierboven (regel ±1207).
                    Anders verschijnt elke free-sessie 2× in de UI. Voor
                    pro users (hasSub=true) toon alles want er is geen
                    promo-balk dan. */}
                {isOpen && !isSoundscapes && (
                  <View style={s.libExpand}>
                    {ser.sessions
                      .filter((sess) => hasSub || !sess.free)
                      .map((sess) => (
                        <SessionRow
                          key={sess.url}
                          session={sess}
                          photo={photo}
                          canPlay={sess.free || hasSub}
                          onPress={() => handleSessionPress(sess)}
                          isFavorite={favorites.has(sess.url)}
                          onToggleFav={() => toggleFavorite(sess)}
                          isActive={!!playerState.session?.url && urlEq(playerState.session.url, sess.url)}
                          isPlaying={
                            !!playerState.session?.url && urlEq(playerState.session.url, sess.url) &&
                            playerState.playing
                          }
                          hideTag={hasSub}
                        />
                      ))}
                  </View>
                )}

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
                          <Pressable
                            style={s.libSubcatCard}
                            onPress={() => toggleSub(subName)}
                            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
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
                          </Pressable>
                          {subOpen &&
                            subSessions.map((sess) => (
                              <SessionRow
                                key={sess.url}
                                session={sess}
                                photo={info.photo}
                                canPlay={sess.free || hasSub}
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
                              />
                            ))}
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
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          marginTop: 18,
                          marginBottom: 8,
                          borderRadius: 999,
                        }}
                        android_ripple={{ color: 'rgba(58,143,255,0.12)' }}
                      >
                        <Text
                          style={{
                            color: C.dim,
                            fontFamily: 'Inter_700Bold',
                            fontSize: 12,
                          }}
                        >
                          ↑
                        </Text>
                        <Text
                          style={{
                            color: C.dim,
                            fontFamily: 'Inter_600SemiBold',
                            fontSize: 12,
                            letterSpacing: 0.8,
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

        {/* ── AANKOOPBLOK — bron index_2_correct.html regel 3746+ ──
            Titel + Monthly/Yearly tikbare kaarten + OUR MISSION-blok +
            GET FULL ACCESS-knop → Gumroad-checkout van het geselecteerde
            plan. Yearly is standaard uitgelicht én geselecteerd.
            Verbergen tijdens search zodat de autocomplete-overlay focus
            houdt. PRO-users zien dit blok NIET — zij zijn al abonnee,
            ruis (operator-besluit 2026-05-23). Independent-Content-
            disclaimer eronder (regel 1427+) blijft wel zichtbaar — eigen
            conditional block, juridische tekst geldt voor iedereen. */}
        {!searchActive && !hasSub && (
        <View
          style={s.buyBlock}
          onLayout={(e) => {
            /* Y t.o.v. de ScrollView-content (buyBlock is een directe
               child van de scroll-container, zelfde patroon als
               searchBarYRef). Doel voor scroll-intent 'pricing'. */
            pricingYRef.current = e.nativeEvent.layout.y;
          }}
        >
          {/* Iter 9zz: OUR MISSION terug bovenaan als context-intro,
              geïntegreerd ipv los panel. Zet de "waarom" vóór de "hoe
              veel" — natuurlijke flow van waarde → keuze → actie. */}
          <View style={s.buyMissionRow}>
            <Text style={s.buyMissionStar}>★</Text>
            <Text style={s.buyMissionLabel}>OUR MISSION</Text>
          </View>
          <Text style={s.buyMissionStatement}>
            Make personal growth accessible.
          </Text>

          <View style={s.buyDivider} />

          <Text style={s.buyTitle}>Start your journey today</Text>
          <Text style={s.buySub}>
            Choose your plan · Cancel anytime
          </Text>

          <View style={s.priceRow}>
            {/* ── MONTHLY-kaart — neutraal: lichter-zwart blok, dunne grijze
               rand, geen pill, geen glow, geen gradient. Zelfde interne
               layout als yearly (strike-rij + grote prijs + meta). ── */}
            <Pressable
              style={s.cardOuter}
              onPress={() => setPlan('monthly')}
              android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
            >
              <View style={[s.cardClip, s.cardClipMonthly]}>
                {/* Iter v161 (2026-06-27): strikethrough verschijnt ALLEEN
                    als de klant de intro-prijs ziet — niet voor License
                    Testers of bestaande klanten die de regular betalen. */}
                {monthlyStrikeLabel && (
                  <View style={s.strikeRow}>
                    <Text style={s.priceStrike}>{monthlyStrikeLabel}</Text>
                    <Text style={s.regularTag}>REGULAR</Text>
                  </View>
                )}
                <View style={s.priceBig}>
                  <Text style={s.priceBigAmount}>{monthlyPriceLabel}</Text>
                  <Text style={s.priceBigPer}>/month</Text>
                </View>
                <Text style={s.priceMeta}>Billed monthly</Text>
                {/* Selectie-signaal: alleen een ✓ rechtsboven, wit op monthly. */}
                {plan === 'monthly' && (
                  <Text style={[s.selCheck, s.selCheckMonthly]} pointerEvents="none">
                    ✓
                  </Text>
                )}
              </View>
            </Pressable>

            {/* ── YEARLY-kaart — gradient-blok, 1px blauwe rand, blauwe glow
               eronder, BEST VALUE-sticker half over de bovenrand. Save 42%
               inline naast de doorgestreepte prijs. Geen losse RECOMMENDED-
               eyebrow, geen extra binnenrand bij selectie. ── */}
            <Pressable
              style={[s.cardOuter, s.cardOuterYearly]}
              onPress={() => setPlan('yearly')}
              android_ripple={{ color: 'rgba(58,143,255,0.10)' }}
            >
              <View style={[s.cardClip, s.cardClipYearly]}>
                {/* Gradient is BG; absoluteFill onder de content. */}
                <LinearGradient
                  colors={['#1a2a4f', '#0d1530', '#0a0a0a']}
                  locations={[0, 0.55, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Iter v162 (2026-06-27): layout 1:1 met vibezcore.com/
                    audio-library yearly card. Per-month-equivalent als
                    big price, monthly intro als strikethrough, SAVE %
                    inline. Alles ALLEEN wanneer intro actief is. */}
                {yearlyStrikeLabel && (
                  <View style={s.strikeRow}>
                    <Text style={s.priceStrike}>{yearlyStrikeLabel}</Text>
                    {yearlySavePercentLabel && (
                      <Text style={s.saveTag}>{yearlySavePercentLabel}</Text>
                    )}
                  </View>
                )}
                <View style={s.priceBig}>
                  <Text style={s.priceBigAmount}>{yearlyPerMonthLabel}</Text>
                  <Text style={s.priceBigPer}>/month</Text>
                </View>
                <Text style={s.priceMeta}>Billed {yearlyTotalLabel}/year</Text>
                {plan === 'yearly' && (
                  <Text style={[s.selCheck, s.selCheckYearly]} pointerEvents="none">
                    ✓
                  </Text>
                )}
              </View>
              {/* "BEST VALUE"-sticker — half overlappend met de bovenrand.
                 Staat OP de outer-wrap (niet binnen cardClip met overflow
                 hidden) zodat hij boven de rand kan steken. */}
              <View style={s.pillWrap} pointerEvents="none">
                <View style={s.bestValuePill}>
                  <Text style={s.bestValueTxt} numberOfLines={1}>
                    BEST VALUE
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>

          {/* Iter 9yy: OUR MISSION weggehaald uit pricing-blok. Was
              visueel disruptief tussen cards en CTA. Mission leeft al
              elders op de page (hero + pillars + emerson). */}

          {/* CTA — opent Gumroad-checkout van het geselecteerde plan.
              Direct onder pricing-cards: pricing → tap CTA → checkout
              (geen mission-card meer als interruptie). */}
          <Pressable
            style={s.ctaBtn}
            onPress={openCheckout}
            android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
          >
            <Text style={s.ctaTxt}>
              {plan === 'yearly'
                ? `Get Yearly — ${yearlyPerMonthLabel}/month`
                : `Get Monthly — ${monthlyPriceLabel}/month`}
            </Text>
          </Pressable>

          {/* Iter 9dq v135 (operator 2026-06-15): trust-rij onder CTA met
              ECHTE store-logos (witte Apple-silhouet + Google Play 4-color
              triangle) i.p.v. brand-neutrale Lucide icons. Beide platforms
              altijd zichtbaar — versterkt vertrouwen. */}
          <View style={s.billedByRow}>
            <AppleLogo size={14} />
            <Text style={s.billedByLine}>App Store</Text>
            <Text style={s.billedByDot}>·</Text>
            <GooglePlayLogo size={14} />
            <Text style={s.billedByLine}>Google Play</Text>
          </View>
          <Text style={s.billedByMeta}>
            Billed securely by your store account
          </Text>

          {/* Iter 9yy: checks-row direct onder CTA — voelt als één
              "vertrouwen-bevestiging"-blok bij de aankoop. */}
          <View style={s.checks}>
            <Text style={s.check}>✓ Cancel anytime</Text>
            <Text style={s.check}>✓ Instant access</Text>
            <Text style={s.check}>✓ Monthly new drops</Text>
          </View>

          {/* Iter 9yy: 3 finelines → 1 compact regeltje. Alle relevante
              prijs/payment-info in één scan-line.
              Iter 9dq v136 (operator 2026-06-15): "14-day money-back"
              verwijderd (Apple/Google IAP doen geen 14-day money-back
              guarantee) + "Prices in USD, incl. VAT" vervangen door
              accurate, universeel-correcte tekst. Apple/Google
              localizedPrice = valuta v/d user + tax already included
              voor die regio (BTW in EU, sales tax in US, etc). */}
          <Text style={s.fineline}>
            Prices incl. tax (varies by country)
          </Text>

          <Text style={s.secureRow}>
            🔒 SECURE CHECKOUT
          </Text>
        </View>
        )}

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
            <Text style={s.legalIcon}>🛡</Text>
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

        {/* Free Breathwork CTA — Apple-stijl discovery card, gericht
            naar /bracelet-control (de bestaande breathwork-pagina).
            Zichtbaar voor iedereen (free, signed-in, PRO) — breathwork
            is altijd gratis en losstaand van bracelet/audio. Geen koppeling
            in copy: alleen de 5 states + "Always free".
            Iter 2026-06-05: verbergen voor bracelet owners (operator-
            feedback). Zij hebben breathwork al in handen via de Bracelet-
            tab — onnodig om hier opnieuw te pushen. Alle andere accounts
            (free, signed-in zonder bracelet, audio PRO) zien de card wel. */}
        {!searchActive && !isBraceletOwner && (
          <Pressable
            style={s.breathDiscoverCard}
            onPress={() => router.push('/breath')}
            accessibilityLabel="Open breathwork tab"
          >
            {/* Iter 2026-06-05 v4: full-bleed hero card. Foto vult hele
                card met cover (geen letterbox), alle content (label,
                states, meta, button) overlaid onderaan met sterke
                gradient. Operator-feedback: foto groter + volledig +
                tekst en knop op foto. */}
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
        )}

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
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setBreathChooserOpen(false)}
          statusBarTranslucent
        >
          <View style={s.pillarModalRoot}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setBreathChooserOpen(false)}
              accessibilityLabel="Close"
            />
            <View
              style={[
                s.pillarModalSheet,
                { paddingBottom: Math.max(safeInsets.bottom + 24, 72) },
              ]}
            >
              <View style={s.pillarModalHandle} />
              <Pressable
                style={s.pillarModalClose}
                onPress={() => setBreathChooserOpen(false)}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <Text style={s.pillarModalCloseText}>✕</Text>
              </Pressable>
              <Text style={s.pillarModalEyebrow}>FREE BREATHWORK</Text>
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
                          `/bracelet-control?mode=${opt.mode}&breathwork=1&from=audio` as never,
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

      {/* Iter 9aaa: Pillar-detail bottom sheet — Apple-style minimal.
          Backdrop tap = close, ✕ rechtsboven, korte declaratieve copy. */}
      {detailPillar && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setDetailPillar(null)}
          statusBarTranslucent
        >
          <View style={s.pillarModalRoot}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setDetailPillar(null)}
              accessibilityLabel="Close"
            />
            <View
              style={[
                s.pillarModalSheet,
                /* Iter 9bbb → 9dq v77 (2026-06-03): harmonised CTA-
                   bottom formula. Floor 72px clears Samsung 3-button
                   nav waar safeInsets.bottom soms onderrapporteert. */
                { paddingBottom: Math.max(safeInsets.bottom + 24, 72) },
              ]}
            >
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
          </View>
        </Modal>
      )}

      {/* ── AUTO-PLAY INFO MODAL ── (operator-fix 2026-06-18, iter 9dq v156)
          User-initiated uitleg over wat auto-play doet en wanneer het
          nuttig is. Zelfde bottom-sheet styling als de pillar-detail
          modal — VIBEZCORE-stijl ipv generic OS Alert. */}
      {autoPlayInfoOpen && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setAutoPlayInfoOpen(false)}
          statusBarTranslucent
        >
          <View style={s.pillarModalRoot}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setAutoPlayInfoOpen(false)}
              accessibilityLabel="Close"
            />
            <View
              style={[
                s.pillarModalSheet,
                { paddingBottom: Math.max(safeInsets.bottom + 24, 72) },
              ]}
            >
              <View style={s.pillarModalHandle} />
              <Pressable
                style={s.pillarModalClose}
                onPress={() => setAutoPlayInfoOpen(false)}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <Text style={s.pillarModalCloseText}>✕</Text>
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

              <Pressable
                onPress={() => setAutoPlayInfoOpen(false)}
                style={{
                  height: 50,
                  borderRadius: 14,
                  backgroundColor: C.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
                accessibilityLabel="Close auto-play info"
              >
                <Text
                  style={{
                    color: '#ffffff',
                    fontFamily: 'Inter_700Bold',
                    fontSize: 14.5,
                    letterSpacing: 0.2,
                  }}
                >
                  Got it
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
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
  /* Iter 9dq v15 (2026-06-02): chip-cards naast elkaar in 1 blok.
     Equal-flex layout zodat 2 of 3 chips altijd even breed zijn.
     Iter 9dq v16 (2026-06-02): 1 uniforme kleur (Brand.accent blauw) +
     vaste height zodat alle chips identiek groot zijn ongeacht label-
     length. Onderscheid komt van het icoon, niet van kleur. */
  libChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 14,
    paddingBottom: 18,
    marginBottom: 4,
  },
  libChipCard: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    height: 92,
    backgroundColor: 'rgba(58, 143, 255, 0.08)',
    borderColor: 'rgba(58, 143, 255, 0.22)',
  },
  libChipCardLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.1,
    textAlign: 'center',
    /* Iter 9dq v16: vaste 2-line hoogte voor labels zodat de icon-positie
       gelijk is in alle chips, ongeacht of label 1 of 2 regels lang is.
       "Your Journey" wraps → 2 lines, "New" stays → 1 line, maar beide
       reserveren dezelfde 32px ruimte. Icon centreert daardoor identiek. */
    height: 32,
    lineHeight: 15,
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
  /* Free Breathwork discovery card — v4 (2026-06-05): full-bleed hero
     met foto die hele card vult. Alle content (label, states, meta,
     CTA-button) overlaid onderaan met sterke gradient. Geen letterbox,
     foto is dominant. Operator-feedback: foto groter, alles op foto.
     v4.3 (2026-06-05): meer shift naar rechts (32L/8R) en lichtere
     gradient (zie breathDiscoverHeroGradient) — operator-feedback. */
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
  /* v4.3 (2026-06-05): gradient hoogte 75 → 60% en lichter (zie colors
     in JSX) — operator-feedback "te veel overlay". Tekst-shadows zorgen
     nog steeds voor leesbaarheid. */
  breathDiscoverHeroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  /* Tekst-block onderaan de card, overlaid op image+gradient.
     v4.1 (2026-06-05): paddingBottom verhoogd 24 → 42 zodat tekst+knop
     niet tegen de onderrand kleven (operator-feedback). */
  breathDiscoverHeroText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 42,
  },
  /* v4 2026-06-05: alle hero-tekst krijgt nu blurry zwart-shadow EN
     gebruikt pure wit (geen opacity). Werkt zelfs op lichte image-
     delen waar de gradient ook al doorheen schijnt. */
  breathDiscoverLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
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
    fontFamily: 'Inter_700Bold',
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
    fontFamily: 'Inter_500Medium',
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
    backgroundColor: '#3a8fff',
    borderRadius: 100,
    gap: 8,
  },
  breathDiscoverCtaText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  breathDiscoverCtaArrow: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    lineHeight: 16,
  },

  /* Iter 9dq v46 (2026-06-03): subtle "Already a member? Sign in"
     footer-link voor uitgelogde Free/Guest users. Onderaan de library
     scroll, na alle content. Dim text + accent-blauw op de "Sign in"
     woord zodat de tap-target visueel duidelijk is zonder pushy. */
  signInFooterLink: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  signInFooterText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.1,
  },
  signInFooterTextAccent: {
    color: '#3a8fff',
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
    color: '#3a8fff',
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
    color: '#3a8fff',
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
    color: '#3a8fff',
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
    backgroundColor: '#0a0a0a',
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
  bLandingEyebrow: {
    color: '#3a8fff',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.4,
    marginBottom: 12,
  },
  bLandingTitle: {
    color: '#ffffff',
    fontSize: 30,
    fontFamily: 'Inter_900Black',
    letterSpacing: -0.8,
    lineHeight: 34,
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
    color: 'rgba(255,255,255,0.62)',
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
    color: '#3a8fff',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    lineHeight: 22,
    width: 14,
  },
  bLandingFeatureText: {
    flex: 1,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  bLandingPrimaryBtn: {
    backgroundColor: '#3a8fff',
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
    color: 'rgba(255,255,255,0.65)',
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
    /* Iter 9dq v41: accent-blauw → wit per operator-feedback. */
    color: '#ffffff',
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
    color: 'rgba(255,255,255,0.45)',
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
    backgroundColor: 'rgba(58,143,255,0.10)',
    borderColor: 'rgba(58,143,255,0.32)',
    borderWidth: 1,
    borderRadius: 16,
  },
  braceletUpsellEyebrow: {
    color: '#3a8fff',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  braceletUpsellTitle: {
    color: '#f4f4f4',
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  braceletUpsellSub: {
    color: '#8a8a8a',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  braceletUpsellArrow: {
    color: '#3a8fff',
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
    backgroundColor: 'rgba(58,143,255,0.30)',
  },
  signInBannerOrText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
    textTransform: 'lowercase',
    paddingHorizontal: 10,
  },

  /* HERO — bron .hero / .hero-img / .hero-grad / .hero-text */
  hero: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
    height: 340,                 // bron: height 55vh, min 280, max 380
  },
  heroImg: { width: '100%', height: '100%' },
  heroGrad: {
    ...StyleSheet.absoluteFillObject,
    // bron .hero-grad: linear-gradient to top, #0a0a0a → transparant.
    // RN heeft geen native gradient; donkere onderlaag = zelfde leesbaarheid.
    backgroundColor: 'transparent',
  },
  heroText: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20 },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,            // bron: .2em
    textTransform: 'uppercase',
    color: C.accent,
    marginBottom: 8,
  },
  heroH1: {
    /* Apple-stijl display-titel: groot maar niet zwaar.
       fontWeight 700 (Bold, niet 800 Extra-Bold) + negatieve tracking
       geeft die premium "san-francisco-display"-aanblik. Linked links
       uitgelijnd. numberOfLines={2} + adjustsFontSizeToFit op de <Text>
       beschermt smalle telefoons tegen te krappe regels. */
    fontSize: 42,
    fontWeight: '700',
    color: C.text,
    lineHeight: 46, // ≈ 1.1 × 42
    letterSpacing: -0.8,
    textAlign: 'left',
  },

  /* 4-FASEN — bron .hero-phases */
  phasesWrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  phases: {
    color: C.dim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  phasesArrow: { color: C.arrow, fontWeight: '400' },

  /* ── BUILT ON — gecentreerd, identieke visuele taal als EXPLORE SERIES.
     Ruime adem-marges boven (tot 4-fasenregel) en onder (tot eerste
     pijler-card). Horizontaal 24px voor smalle phones. ── */
  builtOn: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 44,    // 40–48px adem boven
    paddingBottom: 36, // 32–40px adem onder
  },
  builtOnLabel: {
    color: C.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.8, // ≈ 0.15em bij 12px
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 16,
  },
  builtOnText: {
    /* Ondersteunend, niet hero — lichter gewicht (600 Semibold) en één
       à twee stappen kleiner dan de hero-titel, zodat hij visueel niet
       met de hero concurreert. Negatieve tracking blijft (Apple-stijl
       display), kleiner dan op de hero. */
    color: C.text,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34, // ≈ 1.2 × 28
    letterSpacing: -0.5,
    textAlign: 'center',
  },

  /* PIJLERS — bron .vzm-pillars-grid / .vzm-pillar-photo */
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  pillar: {
    width: '48%',
    height: 150,
    /* FIX 13: radius 12 → 16 + 1px hairline border, conform de library-
       cards. Geeft consistent ritme door de hele homepage zonder shadow
       of glow — rust only. */
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: C.border,
  },
  pillarImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  pillarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  pillarTextWrap: { position: 'absolute', left: 14, bottom: 14 },
  pillarNum: {
    color: C.faint,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
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
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  pillarModalTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 30,
    marginBottom: 14,
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
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 30,
    marginBottom: 6,
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

  /* EMERSON — bron .vzm-emerson-block (compact horizontale card). */
  quoteBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: C.border,
  },
  quoteAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
    backgroundColor: '#000',
  },
  quoteContent: { flex: 1 },
  quoteText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 6,
  },
  quoteAuthor: { color: C.dim, fontSize: 12 },

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
  libCardUnit: {
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
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
    justifyContent: 'flex-end',
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
  /* Iter 9qq (operator-feedback 2026-05-30): More/Less toggle
     gemigreerd naar rechtsONDER van de card. Chevron-only,
     vierkant glass-style pill — meer Apple disclosure-indicator.
     Position: absolute zodat 'ie boven libCardBody zweeft maar
     niet binnen de body-flow valt (anders zou-ie tekst pushen). */
  moreToggleBR: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 3,
    minWidth: 32,
    /* Iter 9dq v72 (2026-06-03): geen fixed height meer — laat de
       content zichzelf groeien. Wanneer collapsed staat er "5 sessions"
       boven de chevron (vertical stack); wanneer open staat alleen de
       chevron. Padding zorgt voor consistente touch-target maat. */
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14,
  },
  moreToggleLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  moreToggleChev: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '700',
    /* Visuele centering — chevron-glyph zit standaard iets te hoog
       binnen 't lineHeight-blok, kleine offset om optisch centraal
       te staan in de cirkel. */
    marginTop: -1,
  },
  libCardBody: {
    /* bron .card-body: padding 18px 18px 20px (top horizontal bottom).
       Geen paddingRight-overschot meer; de VIEW ALL-pill zit bovenaan,
       niet over de titel-zone. */
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
  },
  libCardEyebrow: {
    /* bron .card-label: 10px / 700 / .14em / uppercase. */
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4, // ≈ 0.14em bij 10px
    textTransform: 'uppercase',
    marginBottom: 6,
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
  libCardTitle: {
    /* bron .card-title: 17px / 800 / -.02em / line-height 1.2. */
    color: C.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.34, // ≈ -0.02em bij 17px
    lineHeight: 20,       // ≈ 1.2 × 17
    marginBottom: 6,
  },
  libCardSubline: {
    /* bron .card-sub: 12px / rgba(255,255,255,.55) / line-height 1.4. */
    color: 'rgba(255,255,255,0.55)',
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
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    /* Iter 2026-06-05: groen-tint vervangen door neutraal wit. Default
       state = info ("dit kan je beluisteren"), geen completion-signaal. */
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderTopWidth: 0,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  /* Ronde play-knop links — 40x40 (FIX 9). PAD A patch: overflow:'hidden'
     verwijderd (Fabric-crash combo met active-state shadow). De
     LinearGradient-child krijgt z'n eigen borderRadius:20 zodat hij
     zichzelf tot een cirkel clipt — geen parent-clip nodig. */
  freePlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    /* Iter 2026-06-05: groen → wit/neutraal in default state. Active
       state blijft blauwe LinearGradient (zie isActive branch in JSX). */
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
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
    /* Iter 2026-06-05: groen → wit. FREE pill is informationeel, geen
       completion-signaal. Subtiele witte tint + border. */
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  freePillText: {
    color: C.free,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6, // ≈ 0.06em bij 9px
    textTransform: 'uppercase',
  },
  freeSessionDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  /* FIX 15b: status-regel onder de beschrijving, alleen wanneer er
     vzh_v1-entry bestaat voor deze sessie. Color wordt inline gezet
     (blauw partial / groen full). 12px / weight 600 / marginTop 6. */
  statusRow: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
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

  /* Inline-expansie-container (gewone sessierijen of subcat-kaarten). */
  libExpand: { marginTop: 10 },

  /* showAllRow/showAllText/showAllChev — iter 9dq v70+v71 standalone
     link onder de FREE-balk. Verwijderd in v72: operator-keuze om de
     count IN de card te zetten (boven de chevron). Zie moreToggleLabel
     hierboven. Styles weggehaald om dead code te vermijden. */

  /* Sessierij in geopende kaart of geopende subcat. */
  libRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.rowBg,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
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
  libRowTag: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 3 },
  libRowTagFree: { color: C.free },
  libRowTagPro: { color: C.faint },
  libRowTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  libRowDesc: { color: C.dim, fontSize: 12, marginTop: 3, lineHeight: 17 },

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
    backgroundColor: '#3a8fff',
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
  heartGlyph: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.4)',
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
  libSubcatEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  libSubcatTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  /* ── AANKOOPBLOK — blauwdruk §3.6 / bron regel 3746+ ── */
  /* Iter 9yy: buyBlock wordt nu één cohesief frame. Subtle bg-tint +
     border + ruimere padding = visueel "one purchase experience"-blok
     ipv losse elementen die toevallig dicht bij elkaar staan. */
  buyBlock: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  buyTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  /* Sub-tekst onder de title — zet context voor de keuze, voorkomt
     dat title los staat van de cards eronder. */
  buySub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    marginBottom: 18,
  },
  /* Iter 9zz: mission als geïntegreerde context bovenaan ipv los panel.
     Eyebrow + statement zonder eigen bg/border zodat 't één is met
     het buy-frame. */
  buyMissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  buyMissionStar: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  buyMissionLabel: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  buyMissionStatement: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  /* Subtle divider tussen mission-context en pricing-keuze.
     Hairline, niet schreeuwend. */
  buyDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 18,
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
  cardOuter: {
    flex: 1,
    position: 'relative',
  },
  /* Yearly-only: subtiele blauwe glow onder de kaart. Geen ring rondom. */
  cardOuterYearly: {
    shadowColor: '#3a8fff',
    shadowOpacity: 0.25,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },

  /* ── Prijskaart-laag 2: clip-container. Border + radius + overflow:hidden
     zodat de gradient-BG netjes binnen de afgeronde hoeken blijft. ── */
  cardClip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  cardClipMonthly: {
    backgroundColor: '#0d0d0d',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardClipYearly: {
    /* Geen backgroundColor — LinearGradient vult de hele clip. */
    borderColor: 'rgba(58,143,255,0.4)',
  },

  /* "BEST VALUE"-sticker — half over de bovenrand van de yearly-kaart.
     Staat op de OUTER (buiten cardClip's overflow:hidden) zodat hij boven
     de rand mag steken. */
  pillWrap: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  bestValuePill: {
    backgroundColor: C.accent,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  bestValueTxt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.88, // ≈ 0.08em bij 11px
  },

  /* Rij voor de doorgestreepte prijs + (yearly-only) inline SAVE 42%-tag. */
  strikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 16,
    marginBottom: 2,
  },
  saveTag: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginLeft: 8,
  },
  /* Iter 9dq v135: REGULAR-tag op monthly-card. Subtieler (dim) dan
     SAVE 42% op yearly-card, want is informatie ipv conversie-driver. */
  regularTag: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginLeft: 8,
  },

  /* Selectie-signaal — uitsluitend een ✓ rechtsboven binnen de kaart.
     Geen extra rand, geen kleurverschuiving. Kleur verschilt per kaart. */
  selCheck: {
    position: 'absolute',
    top: 10,
    right: 12,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  selCheckYearly: { color: C.accent },
  selCheckMonthly: { color: '#ffffff' },
  priceStrike: {
    color: C.faint,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  priceBig: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  priceBigAmount: {
    color: C.text,
    fontSize: 26,
    fontWeight: '800',
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
  ctaBtn: {
    backgroundColor: C.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: C.accent,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ctaTxt: {
    /* Mixed-case CTA ("Get Yearly — $X/month") — strakke letter-spacing,
       niet de wijde caps-spacing van eerder. */
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  /* Iter 9dq v135: trust-rij direct onder CTA. Twee badges (App Store +
     Google Play) met icoontjes, dim genoeg om niet met de CTA te
     concurreren maar duidelijk leesbaar. */
  billedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  billedByLine: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  billedByDot: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: 2,
  },
  billedByMeta: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.2,
  },

  /* Gedimde regels + vinkjes-rij + secure-rij onder de CTA. */
  /* Iter 9yy: fineline subtieler — kleiner, dim grey, geen letterspacing.
     Footer-info hoort visueel ondergeschikt te zijn. */
  fineline: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 14,
  },
  /* Iter 9yy: checks meer ruimte boven (van CTA) + iets compactere
     interne spacing zodat alles als "trust signals"-rij voelt. */
  checks: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  check: {
    color: C.free,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  secureRow: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textAlign: 'center',
    marginTop: 10,
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
    color: '#3a8fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.65, // ≈ 0.15em bij 11px
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 2,
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
    backgroundColor: 'rgba(58,143,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acAvatarTxt: {
    color: '#3a8fff',
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
    fontWeight: '600',
    textAlign: 'center',
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
  legalBlock: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0d0d0d',
    overflow: 'hidden',
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
    color: 'rgba(255,255,255,0.55)',
  },
  legalLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  legalChev: {
    color: 'rgba(255,255,255,0.45)',
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
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    lineHeight: 19, // ≈ 1.6 × 12
    marginBottom: 10,
  },
  legalSubHead: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 6,
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
