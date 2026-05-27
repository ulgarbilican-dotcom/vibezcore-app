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
import { useFavorites } from '@/hooks/useFavorites';
import { useSubscription } from '@/hooks/useSubscription';
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
import { getEntryByUrl, useHistory } from '@/utils/history';
import { isNew } from '@/utils/isNew';
import { openSession } from '@/utils/openSession';
import {
  consumeScrollIntent,
  subscribeScrollIntent,
} from '@/utils/scroll-intent';
import { useSetting } from '@/utils/settings';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutAnimation,
  Linking,
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
import {
  SERIES,
  SERIES_PHOTO,
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
  free: '#4ade80',
  rowBg: '#0d0d0d',
};

/* CDN — exact de host die de webapp gebruikt. */
const CDN = 'https://vibezcore-audio.b-cdn.net/images';

/* Gumroad-checkout-URLs — exact zoals operator opgegeven.
   App praat niet rechtstreeks met Gumroad voor entitlements (provider-
   agnostisch via eigen backend), maar de checkout ZELF mag uiteraard
   direct naar Gumroad — dat is hoe de webapp het ook doet. */
const GUMROAD_URLS: Record<'monthly' | 'yearly', string> = {
  monthly: 'https://vibezcore.gumroad.com/l/vibezcore-monthly',
  yearly: 'https://vibezcore.gumroad.com/l/vibezcore-yearly',
};

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

/* Pijlers — exact uit bron regel 2705-2738. Namen NIET wijzigen. */
const PILLARS = [
  { num: '01', name: 'Strategic Wealth',         img: `${CDN}/Strategic%20wealth.jpg` },
  { num: '02', name: 'Psychological Resilience',  img: `${CDN}/Psychological%20Resilience%20correct.jpg` },
  { num: '03', name: 'Social Mastery',            img: `${CDN}/Social%20mastery.jpg` },
  { num: '04', name: 'Stoic Fortitude',           img: `${CDN}/Stoic%20mastery.jpg` },
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
        {!hideTag && (
          <Text
            style={[
              s.libRowTag,
              session.free ? s.libRowTagFree : s.libRowTagPro,
            ]}
          >
            {session.free ? 'FREE' : 'PRO'}
          </Text>
        )}
        <Text style={s.libRowTitle}>{session.title}</Text>
        {session.desc ? <Text style={s.libRowDesc}>{session.desc}</Text> : null}
        {/* FIX 15b: status-regel ook hier in serie-expansion sessie-rijen. */}
        {(() => {
          const e = getEntryByUrl(session.url);
          if (!e) return null;
          const isFull = e.full;
          return (
            <Text
              style={[
                s.statusRowRow,
                { color: isFull ? '#4ade80' : '#3a8fff' },
              ]}
            >
              {isFull ? '✓ Fully listened' : '▶ Partly listened'}
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
  }, []);

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
  /* Plan-keuze in het aankoopblok — Yearly standaard geselecteerd
     (blauwdruk §3.6: "Yearly visueel uitgelicht, aanbevolen"). */
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
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
      if (target === 'pricing') scrollToTarget(pricingYRef.current);
      else if (target === 'library-settings')
        scrollToTarget(settingCardYRef.current);
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
          console.warn(
            '[VIBEZCORE] geen Y-positie voor serie:',
            seriesName,
          );
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
  /* Open de Gumroad-checkout. Primair via WebBrowser (Custom Tab in-app);
     fallback naar Linking.openURL (systeembrowser-intent) wanneer de Custom
     Tab niet gerenderd kan worden — bv. AVD's zonder Chrome/Custom-Tabs-
     capable browser. Diag-logs blijven staan zodat per pad zichtbaar is
     wat er gebeurd is. */
  const openCheckout = async () => {
    console.log('[VIBEZCORE] openCheckout fired, plan =', plan);
    const url = GUMROAD_URLS[plan];
    console.log('[VIBEZCORE] resolved URL =', url);
    if (!url) {
      console.log('[VIBEZCORE] URL is falsy — bailing');
      return;
    }
    try {
      const result = await WebBrowser.openBrowserAsync(url);
      console.log('[VIBEZCORE] WebBrowser result =', result);
      if (result.type === 'cancel' || result.type === 'dismiss') {
        console.log('[VIBEZCORE] Custom Tab niet getoond, fallback naar Linking');
        await Linking.openURL(url);
      }
    } catch (e) {
      console.log('[VIBEZCORE] WebBrowser threw, fallback naar Linking:', e);
      await Linking.openURL(url);
    }
  };
  /* Accordion-toggle: zelfde serie nogmaals tikken → dicht (null).
     Andere serie tikken → die wordt de geopende; eventuele vorige sluit
     automatisch. Geen animatie geïntroduceerd (was er ook niet). */
  const toggle = (name: string) =>
    setExpandedSeries((prev) => (prev === name ? null : name));
  const toggleSub = (name: string) =>
    setSubExpanded((p) => ({ ...p, [name]: !p[name] }));

  /* ── Session-tap-handler ──
     Operator-keuze 2026-05-27: geen blocking Alert meer voor uitgelogde
     users op PRO-sessies. In plaats daarvan opent de sessie meteen in
     60-seconden preview-mode. De audio-player's `shouldPreview()`
     detecteert no-token of non-pro automatisch en signt de URL met
     `?preview=true`. Na 60s kicks `PREVIEW_CAP_SEC` in → pauseert →
     player.tsx toont z'n "Continue listening?"-upsell modal met de
     bestaande "Get Full Access"-flow naar Gumroad of sign-in.

     Beleid (al volledig afgehandeld door audio-player + player.tsx):
       - FREE sessie → full playback (geen preview)
       - PRO sessie + uitgelogd → 60s preview → upsell modal
       - PRO sessie + ingelogd niet-pro → 60s preview → upsell modal
       - PRO sessie + pro → full playback (no preview, no cap) */
  const handleSessionPress = (sess: Session) => {
    openSession(sess);
  };

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── SIGN-IN CTA BANNER ── (operator-keuze 2026-05-26)
            Voor users die uitgelogd zijn maar geen welcome-screen meer
            zien. Subtiel banner bovenaan met directe tap-naar-Account-
            tab. Verbergen bij signed-in OR wanneer auth-state nog laadt
            (null) om flicker te voorkomen. */}
        {isSignedIn === false && (
          <Pressable
            style={s.signInBanner}
            onPress={() => router.navigate('/account')}
            android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
            accessibilityLabel="Sign in to unlock the full library"
          >
            <View style={s.signInBannerIcon}>
              <Text style={s.signInBannerIconText}>♪</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.signInBannerTitle}>Sign in to unlock the full library</Text>
              <Text style={s.signInBannerSub}>
                Or create a free account · No credit card required
              </Text>
            </View>
            <Text style={s.signInBannerArrow}>›</Text>
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

        {/* "Ontdek"-secties — BUILT ON, pijlers, Emerson, EXPLORE SERIES-
           header — verbergen tijdens een actieve zoekquery EN voor PRO-
           users (laatste = operator-besluit 2026-05-23: PRO's library
           start direct bij de search-balk, geen marketing-secties). */}
        {!searchActive && !hasSub && (
          <>
            {/* ── BUILT ON ── bron regel 2701-2704 ── */}
            <View style={s.builtOn}>
              <Text style={s.builtOnLabel}>— BUILT ON —</Text>
              <Text style={s.builtOnText}>
                The intellectual legacy of history's greatest minds.
              </Text>
            </View>

            {/* ── 4 PIJLERS ── bron regel 2705-2738 ── */}
            <View style={s.pillarsGrid}>
              {PILLARS.map((p) => (
                <View key={p.num} style={s.pillar}>
                  <Image source={{ uri: p.img }} style={s.pillarImg} resizeMode="cover" />
                  <View style={s.pillarOverlay} />
                  <View style={s.pillarTextWrap}>
                    <Text style={s.pillarNum}>{p.num}</Text>
                    <Text style={s.pillarName}>{p.name}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ── EMERSON-QUOTE ── bron regel 2742-2755 ── */}
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

            {/* ── EXPLORE SERIES — header-blok ── */}
            <View style={s.exploreHead}>
              <Text style={s.exploreEyebrow}>— EXPLORE SERIES —</Text>
              <Text style={s.exploreH1}>Not just inspiration.</Text>
              <Text style={s.exploreH1}>Real transformation.</Text>
              <Text style={s.exploreMetaText}>
                Updated monthly with fresh sessions
              </Text>
            </View>
          </>
        )}

        {/* ── LIBRARY-CONTROLS — bron vz-view-library (geconsolideerd in
            deze tab). Geplaatst ONDER de "Updated monthly…"-regel zoals
            besluit eigenaar. Zoekbalk + filter-pills (5, single-select,
            horizontaal scrollbaar) + live sessie-teller rechts + Your
            Journey-card. ── */}
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

        {/* Pills-rij + sessie-teller zijn vervangen door 3 navigatie-knoppen
           verderop in de pagina (zie blok onder de EXPLORE SERIES-header,
           vlak boven de eerste serie-card). Eigenaar-besluit:
             - Audio Library is altijd de "homepage" (ongefilterd).
             - New / Favorites / Free zijn eigen sub-pages onder /library/. */}

        {/* Continue-card op de library is VERVANGEN door een welcome-back
            popup op cold-start (zie src/components/WelcomeBackPopup.tsx
            + src/services/welcome-popup.ts). Operator-besluit 2026-05-25:
            popup voelt warmer + duidelijker als "welkom terug" dan een
            statische card die naast alle andere kaarten op de library
            blijft staan. De last-played-tracker (useShowableLastPlayed)
            blijft bestaan en voedt nu de popup ipv de library-card. */}

        {!searchActive && (
          <Pressable
            style={s.journeyCard}
            onPress={() => router.push('/history')}
            android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
          >
            <View style={s.journeyIconBox}>
              <Text style={s.journeyIconGlyph}>🕒</Text>
            </View>
            <View style={s.journeyBody}>
              <Text style={s.journeyTitle}>Your Journey</Text>
              <Text style={s.journeySub}>Streak, history & insights</Text>
            </View>
            <Text style={s.journeyChev}>›</Text>
          </Pressable>
        )}

        {/* Auto-play-next-setting — verhuisd van Account naar hier omdat
           dit een audio-ervaring-instelling is. Account heeft alleen
           een link-card die hierheen scrollt via scroll-intent. */}
        {!searchActive && (
          <View
            style={s.settingCard}
            onLayout={(e) => {
              settingCardYRef.current = e.nativeEvent.layout.y;
            }}
          >
            <View style={s.settingTextWrap}>
              <Text style={s.settingTitle}>Auto-play next session</Text>
              <Text style={s.settingSub}>
                Automatically play the next session in the series when one
                ends.
              </Text>
            </View>
            <Switch
              value={autoPlayNext}
              onValueChange={setAutoPlayNext}
              trackColor={{ false: '#3a3a3a', true: '#3a8fff' }}
              thumbColor={'#ffffff'}
            />
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
                            <Text
                              style={[
                                s.acTag,
                                sess.free ? s.acTagFree : s.acTagPro,
                              ]}
                            >
                              {sess.free ? 'FREE' : 'PRO'}
                            </Text>
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
              {/* 3 navigatie-knoppen — onder "Updated monthly with fresh
                 sessions", boven de eerste serie-card. Geen toggles, geen
                 actieve state — elke knop pusht naar een eigen sub-page. */}
              <View
                style={{
                  flexDirection: 'row',
                  marginHorizontal: 2,
                  marginBottom: 20,
                  gap: 8,
                }}
              >
                <Pressable
                  onPress={() => router.push('/library/new')}
                  style={{
                    flex: 1,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 99,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    alignItems: 'center',
                  }}
                  android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>
                    New
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/library/favorites')}
                  style={{
                    flex: 1,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 99,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    alignItems: 'center',
                  }}
                  android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>
                    Favorites
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/library/free')}
                  style={{
                    flex: 1,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 99,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    alignItems: 'center',
                  }}
                  android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>
                    Free
                  </Text>
                </Pressable>
              </View>
              {/* Series-card-rendering — altijd 12 cards, ongefilterd
                 (Audio Library is in default-modus de homepage). */}
              {SERIES.map((ser) => {
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
                    <Image source={{ uri: photo }} style={s.libCardBg} />
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
                  {/* Pill-cluster rechtsboven — NEW-badge (alleen wanneer
                     hasNew=true) links van VIEW ALL. FOLLOW-pill
                     is per eigenaar-besluit verwijderd; "save voor later"
                     gaat via de Favorites-hartjes op sessie-niveau. De
                     cluster blijft als wrapper voor consistente plaatsing
                     met de Coming-card en als toekomstige uitbreidingsplek. */}
                  <View style={s.pillCluster}>
                    {hasNew && (
                      <View style={s.flatNewPill}>
                        <Text style={s.flatNewPillTxt}>NEW</Text>
                      </View>
                    )}
                    <Pressable
                      style={s.viewAllPill}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        toggle(ser.name);
                      }}
                      hitSlop={6}
                      android_ripple={{
                        color: 'rgba(255,255,255,0.10)',
                        borderless: true,
                      }}
                    >
                      <Text style={s.viewAllText}>VIEW ALL</Text>
                      <Text style={s.viewAllChev}>›</Text>
                    </Pressable>
                  </View>
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
                  const pillText =
                    frees.length === 1 ? '1 FREE SESSION' : 'FREE';
                  /* FIX 9: "active" = url-match, ongeacht play/pause. Hele
                     blokje blijft blauw tijdens pauze, consistent met de
                     card-glow (FIX 5+). De play-knop icon switcht binnen
                     active op basis van playerState.playing (▶ ↔ ⏸). */
                  const isActive =
                    playerState.session?.url === sess.url;
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
                      onPress={() => openSession(sess)}
                      android_ripple={{
                        color: isActive
                          ? 'rgba(58,143,255,0.18)'
                          : 'rgba(74,222,128,0.18)',
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
                        {/* FIX 10: SVG-shape glyph. Kleur groen in rust
                           (matched #4ade80), wit op blauwe gradient in
                           active state. */}
                        <PlayPauseGlyph
                          size={14}
                          color={isActive ? '#ffffff' : '#4ade80'}
                          playing={isPlayingHere}
                        />
                      </View>
                      <View style={s.freeContent}>
                        <View style={s.freeTopRow}>
                          <Text style={s.freeSessionTitle}>{sess.title}</Text>
                          <View
                            style={[
                              s.freePill,
                              isActive && s.freePillActive,
                            ]}
                          >
                            <Text
                              style={[
                                s.freePillText,
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
                        {/* FIX 15b: status-regel ("▶ Partly listened" /
                           "✓ Fully listened") alleen wanneer er history
                           bestaat voor deze sessie-url. */}
                        {(() => {
                          const e = getEntryByUrl(sess.url);
                          if (!e) return null;
                          const isFull = e.full;
                          return (
                            <Text
                              style={[
                                s.statusRow,
                                {
                                  color: isFull ? '#4ade80' : '#3a8fff',
                                },
                              ]}
                            >
                              {isFull ? '✓ Fully listened' : '▶ Partly listened'}
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
                          isActive={playerState.session?.url === sess.url}
                          isPlaying={
                            playerState.session?.url === sess.url &&
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
                            <View style={s.libCardChev}>
                              <Text
                                style={[
                                  s.libCardChevTxt,
                                  subOpen && s.libCardChevTxtOpen,
                                ]}
                              >
                                ›
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
                                  playerState.session?.url === sess.url
                                }
                                isPlaying={
                                  playerState.session?.url === sess.url &&
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

          {/* ── 13e card — VIBEZCORE ROADMAP / "What's Coming Next" ──
              Bron: index_2_correct.html, comment "13TH CARD: What's
              Coming Next". Visueel zit deze in dezelfde reeks als de
              12 series, maar opent een ander scherm (router.push('/coming')).
              Geen FREE-balk eronder, dus ALLE hoeken rond (geen naadloos
              aansluiten op iets). Eigen "Explore →"-pill in plaats van
              VIEW ALL. Sterkere gradient zodat de eyebrow + titel
              prominenter naar voren komen. */}
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
              {/* "Explore →"-pill — zelfde container-stijl als VIEW ALL
                 maar mixed-case tekst. Coming-card heeft geen FOLLOW; één
                 pill in de cluster (pillCluster levert de positie nu
                 viewAllPill zelf geen position-props meer heeft). */}
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
          <Text style={s.buyTitle}>Start your journey today</Text>

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
                <View style={s.strikeRow}>
                  <Text style={s.priceStrike}>$16.90</Text>
                </View>
                <View style={s.priceBig}>
                  <Text style={s.priceBigAmount}>$12.90</Text>
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
                <View style={s.strikeRow}>
                  <Text style={s.priceStrike}>$9.92</Text>
                  <Text style={s.saveTag}>SAVE 42%</Text>
                </View>
                <View style={s.priceBig}>
                  <Text style={s.priceBigAmount}>$7.49</Text>
                  <Text style={s.priceBigPer}>/month</Text>
                </View>
                <Text style={s.priceMeta}>Billed $89.90/year</Text>
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

          {/* OUR MISSION-blok — eigen panel met blauwe ster. */}
          <View style={s.missionCard}>
            <View style={s.missionLabelRow}>
              <Text style={s.missionStar}>★</Text>
              <Text style={s.missionLabel}>OUR MISSION</Text>
            </View>
            <Text style={s.missionTitle}>
              Make personal growth accessible.
            </Text>
            <Text style={s.missionSub}>
              The life you want requires a version of you that doesn't exist
              yet.
            </Text>
          </View>

          {/* CTA — opent Gumroad-checkout van het geselecteerde plan.
             Tekst toont actieve keuze + prijs/maand. */}
          <Pressable
            style={s.ctaBtn}
            onPress={openCheckout}
            android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
          >
            <Text style={s.ctaTxt}>
              {plan === 'yearly'
                ? 'Get Yearly — $7.49/month'
                : 'Get Monthly — $12.90/month'}
            </Text>
          </Pressable>

          <Text style={s.fineline}>
            One plan per checkout · Clear your cart when switching
          </Text>

          <View style={s.checks}>
            <Text style={s.check}>✓ Cancel anytime</Text>
            <Text style={s.check}>✓ Instant access</Text>
            <Text style={s.check}>✓ Monthly new drops</Text>
          </View>

          <Text style={s.fineline}>
            Prices in USD · 14-day money-back
          </Text>
          {/* VAT-disclaimer (operator-keuze 2026-05-27): voorkomt
              verwarring tussen card-prijs en Gumroad checkout-subtotal.
              Gumroad toont eerst pre-VAT subtotal ($10.66) → daarna VAT
              → totaal ($12.90). User die nu de card ziet ($12.90 incl.
              VAT voor NL) ziet op Gumroad eerst $10.66 = lager. Deze
              line maakt duidelijk dat dat geen prijswijziging is, alleen
              de pre-tax breakdown. */}
          <Text style={s.fineline}>
            Excl. local VAT · Final price calculated at checkout
          </Text>
          <Text style={s.secureRow}>
            🔒 SECURE CHECKOUT · ↻ CANCEL ANYTIME
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

            Verbergen tijdens search (consistent met andere blokken). */}
        {!searchActive && hasSub && (
          <Pressable
            style={s.braceletTeaser}
            onPress={() => router.navigate('/bracelet')}
            android_ripple={{ color: 'rgba(58,143,255,0.08)' }}
          >
            <View style={s.braceletTeaserBadge}>
              <Text style={s.braceletTeaserBadgeText}>
                ⚡ KICKSTARTER — 1 AUGUST 2026
              </Text>
            </View>
            <Text style={s.braceletTeaserTitle}>Smart Bead Bracelet</Text>
            <Text style={s.braceletTeaserSub}>
              5 haptic modes. One clear outcome.{'\n'}
              You in control of your own state.
            </Text>
            <Text style={s.braceletTeaserCta}>Explore the bracelet ›</Text>
          </Pressable>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
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
  signInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(58,143,255,0.10)',
    borderColor: 'rgba(58,143,255,0.30)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
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
  signInBannerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
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
  pillarName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
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
  libCardChev: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  libCardChevTxt: {
    color: C.text,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: -2,
  },
  libCardChevTxtOpen: { transform: [{ rotate: '90deg' }] },
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
  /* VIEW ALL-pill — bron .vz-card-viewall. Géén position-props, die zitten
     op pillCluster. */
  viewAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 12,
    paddingRight: 11,
    backgroundColor: 'rgba(58,143,255,0.28)', // dichter dan 0.18 om
                                              // afwezigheid van backdrop-blur
                                              // te compenseren
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.4)',
    borderRadius: 99,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  viewAllText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6, // ≈ 0.06em bij 10px
    textTransform: 'uppercase',
  },
  /* Variant van viewAllText voor de Coming-card: mixed case "Explore",
     géén textTransform. Zelfde container (viewAllPill) wordt hergebruikt. */
  exploreText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  viewAllChev: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 12,
    fontWeight: '800',
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
    backgroundColor: 'rgba(74,222,128,0.06)',
    borderTopWidth: 0,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  /* Ronde play-knop links — 40x40 (FIX 9). PAD A patch: overflow:'hidden'
     verwijderd (Fabric-crash combo met active-state shadow). De
     LinearGradient-child krijgt z'n eigen borderRadius:20 zodat hij
     zichzelf tot een cirkel clipt — geen parent-clip nodig. */
  freePlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.45)',
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
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
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
  buyBlock: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 8,
  },
  buyTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 16,
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
  ctaBtn: {
    backgroundColor: C.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  ctaTxt: {
    /* Mixed-case CTA ("Get Yearly — $X/month") — strakke letter-spacing,
       niet de wijde caps-spacing van eerder. */
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  /* Gedimde regels + vinkjes-rij + secure-rij onder de CTA. */
  fineline: {
    color: C.dim,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 10,
  },
  checks: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  check: {
    color: C.free,
    fontSize: 12,
    fontWeight: '700',
  },
  secureRow: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 8,
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
  acTagFree: { color: '#4ade80' },
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
