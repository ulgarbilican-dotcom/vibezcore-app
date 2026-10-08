/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Audio player (cinematic full-screen)

   Architectuur:
     - Audio leeft in src/services/audio-player.ts (module-singleton). Dit
       scherm is een UI-laag die `usePlayerState()` consumeert. Minimize
       (⌄) doet router.back() en laat audio gewoon doorspelen — komende
       mini-player taak haakt aan dezelfde service zonder extra createAsync.

   Layout (per spec TAAK 3):
     Cinematic backdrop · Top bar · Title block · Progress / Resume panel
     · Skip controls · Extras row (♥ / 1.0× / 🌙) · Full library CTA
     · Preview-upsell modal (alleen wanneer 30s-cap geraakt is).

   Preview-flow: alle users zijn momenteel guest (`useSubscription()`
   placeholder). PRO sessies (free=false) krijgen `preview:true` mee bij
   het signen; backend honoreert dat zonder JWT. Client enforce't 30s cap.

   GUMROAD_URL leeft in src/constants/links.ts.
   ─────────────────────────────────────────────────────────────────────── */

import {
  PILLAR_META,
  SERIES_PHOTO,
  SERIES_PILLAR,
  SERIES_SUBTITLE,
  type Session,
} from '@/data/audio-library-data';
import { useFavorites } from '@/hooks/useFavorites';
import { useSubscription } from '@/hooks/useSubscription';
import { useBraceletOwner } from '@/utils/dev-user-override';
import {
  dismissEndedPanel,
  loadSession,
  playNextFromPanel,
  seekTo,
  setRate,
  skipBy,
  startOver,
  togglePlay,
  unload,
  usePlayerState,
} from '@/services/audio-player';
import { PlayPauseGlyph } from '@/components/PlayPauseGlyph';
import { AudioAccent, AudioAccentLight, BrandFonts } from '@/constants/theme';
import { useHistory } from '@/utils/history';
import { requestScrollTo } from '@/utils/scroll-intent';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { MoreHorizontal } from 'lucide-react-native';
import { showVibezAlert } from '@/components/VibezAlert';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPEEDS = [1.0, 1.25, 1.5, 1.75, 2.0];
/* Operator, 26 september 2026 (Apple-redesign): de oude foto-banner-hoogte
   (BACKDROP_HEIGHT) verviel — de backdrop is nu fullscreen (zie JSX
   hieronder). ARTWORK_SIZE is de nieuwe zwevende squircle-albumhoes, ruim
   binnen de meeste schermbreedtes met een vaste zij-marge. */
const ARTWORK_SIZE = Math.min(164, Dimensions.get('window').width - 180);

/* MERK_ANKER §2 (bindend palet): near-black #0a0a0a i.p.v. zuiver #000,
   tekst #f4f4f4 i.p.v. zuiver #fff, dim/faint als opacity daarop (zelfde
   aanpak als de webapp), rand #2a2a2a i.p.v. losse witte opacity.

   Operator, 26 september 2026 (accentkleur-wissel, EERST toegepast in
   audio): de Audio Library/player-ervaring krijgt een NIEUWE, enkele
   accentkleur — "Bio-Teal" (#00A3A3 / lichte variant #4AF0D4) — i.p.v.
   het eerdere tweeledige Signal-Blue/Royal-Indigo-Light-systeem. Eén
   tint overal in audio: eyebrow-labels, progress-fill, play-icoon,
   "Continue"-kaart-rand. Nog NIET app-breed (bracelet/breath/website
   blijven ongewijzigd tot een aparte, bewuste beslissing) — scope is
   voorlopig uitsluitend dit scherm + de rest van de Audio Library. */
const C = {
  bg: '#0a0a0a',
  text: '#f4f4f4',
  dim: 'rgba(244,244,244,0.55)',
  faint: 'rgba(244,244,244,0.4)',
  border: '#2a2a2a',
  /* De ENE audio-accentkleur — eyebrow-tekst, progress-fill, play-icoon,
     "Continue"-kaart-rand. */
  accent: AudioAccent,
  accentLight: AudioAccentLight,
  /* v4.4 CTA-regel voor een donkere ondergrond: witte knop, donkere tekst.
     Blijft gelden voor de persistente "Full library access"-CTA en de
     modal-CTA's — dat is een aparte rol (algemene actie), geen accent. */
  ctaBg: '#ffffff',
  ctaText: '#0a0a0a',
  heart: '#ec4899',
  modalOverlay: 'rgba(0,0,0,0.85)',
};

/* Formatteer aantal seconden als "M:SS". Hernoemd van fmt(ms) → fmt(sec)
   bij de expo-av → expo-audio migratie 2026-05-23; expo-audio levert
   currentTime/duration in seconden, niet milliseconden. */
function fmt(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export default function PlayerScreen() {
  const router = useRouter();
  /* Iter 9kk: safe-area-inset voor bottom CTA-knop (operator-feedback
     "onderste knop staat niet in safe zone"). Home-indicator iOS +
     gesture-bar Android moeten ruimte krijgen. */
  const safeInsets = useSafeAreaInsets();
  const p = useLocalSearchParams<{
    title?: string;
    series?: string;
    url?: string;
    free?: string;
    desc?: string;
  }>();

  /* URL-search-params zijn de "entry-point": ze vertellen welke sessie we
     INITIEEL moeten laden wanneer dit scherm via router.push opent. Daarna
     is `playerState.session` (live van de service) de bron-van-waarheid
     voor de UI — anders blijft de full-player de oude titel/photo/series
     tonen wanneer de service via "Play next" of auto-play-next naar een
     andere sessie switcht. Bug-fix 2026-05-23. */
  const urlSession = useMemo<Session | null>(() => {
    if (!p.url) return null;
    return {
      title: p.title ?? '',
      series: p.series ?? '',
      url: p.url,
      free: p.free === 'true',
      desc: p.desc ?? '',
      subseries: '',
      num: '',
      added: '',
    };
  }, [p.title, p.series, p.url, p.free, p.desc]);

  const playerState = usePlayerState();
  /* useHistory() laadt vzh_v1 in geheugen + zorgt dat state-pill re-rendert
     wanneer de status-callback tijdens deze sessie history schrijft. */
  useHistory();

  /* Live display-session: pak playerState.session zodra die geladen is,
     val anders terug op de URL-params (initial render, vóór de service
     load gerund heeft). */
  const session = useMemo<Session | null>(() => {
    if (playerState.session) {
      return {
        title: playerState.session.title,
        series: playerState.session.series,
        url: playerState.session.url,
        free: playerState.session.isFree,
        desc: playerState.session.desc,
        subseries: '',
        num: '',
        added: '',
      };
    }
    return urlSession;
  }, [playerState.session, urlSession]);

  /* Iter 9dq v13 (2026-06-02): preview-beslissing op realIsPro ipv isPro.
     isPro is override-aware (UI), realIsPro is uitsluitend backend-state
     (auth). Voorheen: dev override 'Audio PRO' zonder echte token → app
     dacht user is PRO → stuurde geen preview=true → backend 401 → "Log
     in to listen" modal. Nu: realIsPro is alleen true bij echte PRO-
     subscription → override gebruikt nog steeds preview-flow → 60s
     playback op PRO sessies (zoals Free), géén login-modal meer.
     Echte ingelogde PRO-users blijven volledige toegang houden.
     Iter 9dq v19 (2026-06-02): nu BEIDE waardes gebruiken — realIsPro
     voor auth (preview-flag), isPro voor display (CTA tonen/verbergen).
     Voorheen toonde de "Full library access" CTA in PRO override omdat
     realIsPro=false; nu verbergt-ie correct want isPro=true. */
  const { isPro: displayIsPro, realIsPro, isTrialing, braceletModel } = useSubscription();
  /* Iter v227 (2026-07-07, audit AU3): bracelet-only owner ziet
     "Add Audio Library" ipv "Get Full Access". Consistent met Account-
     tab (regel 393: upgradeCtaText = isBraceletOwner ? 'Add Audio Library'
     : 'Upgrade to full library').
     Iter v229 (2026-07-08): bundle-users hebben audio inclusive.
     Als backend subscriptions-row nog niet gedeployed is, ziet frontend
     via braceletModel === 'bundle' dat user PRO is — geen paywall copy. */
  const isBraceletOwner = useBraceletOwner();
  const isBundleUser = braceletModel === 'bundle';
  /* Iter v231 (2026-07-09, KRITIEK bundle-paywall bug): bundle-fallback in
     hasSubscription. Voorheen: `hasSubscription = realIsPro` = pure
     backend-active check. Backend subscriptions.platform='bundle' faalt op
     CHECK constraint ('ios','android','gumroad','stripe') → geen row →
     backend returnt `active: false` voor bundle-users → realIsPro=false →
     usePreview=true → loadSession met preview=true → paywall na 60s.
     Fix: `realIsPro || isBundleUser`. Symmetrisch met useSubscription.isPro
     defensive fallback en audio-player.shouldPreview bundle-check.

     Operator, 26 september 2026 (toegangsmodel-gat gedicht): `realIsPro`
     is ook `true` tijdens de 7-dagen-trial (RevenueCat telt een trial als
     actieve entitlement) — zonder de `!isTrialing`-check hieronder kreeg
     een trial-user dus volledige, ongecapte PRO-playback, terwijl het
     bedoelde model (project-free-tier-facts, operator-bevestigd) een
     trial beperkt tot 27 sessies + Breathwork. `isBundleUser` blijft WEL
     onvoorwaardelijk — dat is geen trial-product. */
  const hasSubscription = (realIsPro && !isTrialing) || isBundleUser;
  const usePreview = !!urlSession && !urlSession.free && !hasSubscription;

  /* Laden bij mount — driven door urlSession (= de sessie waar dit scherm
     voor geopend werd). Service skipt zelf wanneer dezelfde URL al loaded
     is. We gebruiken bewust urlSession, NIET session — anders zou de
     useEffect re-firen zodra de service de live session update, met als
     gevolg een useless loadSession-no-op call elke keer. */
  useEffect(() => {
    if (!urlSession) return;
    loadSession(
      {
        url: urlSession.url,
        title: urlSession.title,
        series: urlSession.series,
        isFree: urlSession.free,
        desc: urlSession.desc,
      },
      { preview: usePreview }
    );
  }, [urlSession, usePreview]);

  /* GEEN component-unmount cleanup van unload() meer. Sinds de MiniPlayer
     bestaat (in (tabs)/_layout) is "audio blijft draaien zonder UI" geen
     orphan-bug meer — de mini-player is de ingang. Cleanup zou nu juist
     het Minimize-pad breken. Alleen expliciete onClose / preview "Maybe
     later" stoppen audio. */

  /* Favorites */
  const { has: hasFav, toggle: toggleFav } = useFavorites();
  const isFav = session ? hasFav(session.url) : false;

  /* Progress-bar layout voor tap-to-seek */
  const [progressWidth, setProgressWidth] = useState(0);
  const onProgressLayout = (e: LayoutChangeEvent) =>
    setProgressWidth(e.nativeEvent.layout.width);
  const onProgressTap = (e: any) => {
    if (progressWidth <= 0 || playerState.durationSec <= 0) return;
    const x = e?.nativeEvent?.locationX ?? 0;
    const pct = Math.max(0, Math.min(1, x / progressWidth));
    seekTo(playerState.durationSec * pct);
  };

  /* Operator ("je moet dezelfde fotos ook gebruiken bij afspelen van een
     sessie"): de player toonde tot nu toe een aparte reeks-foto
     (SERIES_PHOTO). Nu dezelfde pijler-foto als de Audio Library-grid en
     het pillar-scherm — via SERIES_PILLAR opzoeken bij welke pijler deze
     sessie hoort, dan PILLAR_META's foto. SERIES_PHOTO blijft de
     fallback voor het (zeldzame) geval dat een reeks niet in
     SERIES_PILLAR voorkomt. */
  const photoUri = session
    ? PILLAR_META[SERIES_PILLAR[session.series]]?.img ?? SERIES_PHOTO[session.series]
    : undefined;
  /* "fotos moeten mooi in de kaders passen" — zelfde `imgAspect`-aanpak
     als de grid-kaarten/pillar-scherm: de albumhoes krijgt de echte
     beeldverhouding zodat `cover` niet hoeft te croppen. */
  const photoAspect = session
    ? PILLAR_META[SERIES_PILLAR[session.series]]?.imgAspect
    : undefined;
  const subtitle = session ? SERIES_SUBTITLE[session.series] ?? '' : '';

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const openUpgrade = () => {
    /* Operator-besluit 2026-05-20: in-app pricing-section ipv Gumroad
       directlink. We signaleren scroll-intent en sluiten de full-player
       UI. Audio blijft draaien — de mini-player (in (tabs)/_layout)
       is nu de zichtbare ingang voor de actieve sessie. Gebruiker
       kan zelf via ✕ op mini-player stoppen.
       Iter v227 (2026-07-07, audit AU3): bracelet-owner routed direct
       naar /subscribe (tier picker) — consistent met "Add Audio Library"
       CTA in account.tsx:379. Copy zei "Add Audio Library" maar knop
       ging vroeger naar homepage-pricing → mismatch. */
    if (isBraceletOwner && !realIsPro && !isBundleUser) {
      router.navigate('/subscribe' as never);
      return;
    }
    requestScrollTo('pricing');
    /* Deze knop wil altijd de Audio Library-pricing tonen, ongeacht
       vanaf welk scherm je in de player kwam — dismissTo blijft hier dus
       terecht, anders dan onMinimize/onClose hieronder. */
    router.dismissTo('/');
  };

  /* Operator ("moet gewoon in dezelfde kaart met sessies blijven — dan
     bij back naar de audio library, niet naar welcome, simpel"): sluiten
     van de sessie hoort één scherm terug te gaan (de pillar-/Free-Picks-
     kaart waar je vandaan kwam), niet meteen door te schieten naar de
     Audio Library-tab. */
  const onMinimize = () => {
    /* Sluit alleen de full-player UI — audio + service-state blijft.
       Mini-player pikt het op. */
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  const onClose = async () => {
    await unload();
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  /* "•••"-menu: acties die de audio niet onderbreken (Apple-logica). */
  const openMore = () => {
    if (!session) return;
    void showVibezAlert({
      title: session.title,
      buttons: [
        {
          text: isFav ? 'Remove from favorites' : 'Add to favorites',
          onPress: () =>
            toggleFav({ url: session.url, title: session.title, series: session.series }),
        },
        ...(session.free ? [{ text: 'Share', onPress: () => void onShare() }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    });
  };

  const onCycleSpeed = async () => {
    const idx = SPEEDS.indexOf(playerState.rate);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    await setRate(next);
  };

  /* Iter v175 (2026-06-30): sleep timer verwijderd — expo-audio module
     kan `player.pause()` niet betrouwbaar uitvoeren wanneer Android's
     foreground-service actief is + screen locked. Quad-track fallback (v174)
     werkte ook niet. Native MediaSession implementation nodig voor sleep
     timer die WERKT in lockscreen/Doze — parked voor v1.1. */

  /* Iter v174 (2026-06-30): personal opener ("I'm listening to…") geeft
     context aan ontvangers die VIBEZCORE niet kennen — sessie-naam alleen
     ("Neural State Control") zegt outsiders niks. Daarna brand-pitch
     (science/philosophy/psychology + bracelet) + Play Store install. */
  const onShare = async () => {
    if (!session) return;
    const url = 'https://www.vibezcore.com/app';
    const pitch =
      "Available now: In-depth audio sessions built on the theories, principles, and insights of history's greatest thinkers—whose work continues to shape our understanding of human nature, psychology, behavior, and personal growth.\n\n" +
      'Launching Fall 2026 — Smart Bead Bracelet for instant state control.';
    try {
      await Share.share({
        title: 'VIBEZCORE',
        message: `I'm listening to "${session.title}" on VIBEZCORE.\n\n${pitch}\n\nInstall the app and listen to free full sessions: ${url}`,
        url,
      });
    } catch {}
  };

  const onUpsellMaybeLater = async () => {
    await unload();
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  /* Operator, 26 september 2026 (Apple-redesign, "liquid glass" player):
     de albumhoes krimpt licht wanneer gepauzeerd, komt terug op volle
     grootte bij afspelen — Apple Music-patroon. Dit reageert op
     `playerState.playing` via een `useEffect`, NIET op een Pressable's
     onPressIn/onPressOut — de knop die deze state omzet (togglePlay/
     onPlay) verdwijnt of unmountet niet, dus geen enkel risico op de
     "press-out-animatie-loopt-nog-tijdens-unmount"-crashklasse die de
     rest van dit scherm eerder trof. */
  const artworkScale = useSharedValue(1);
  useEffect(() => {
    artworkScale.value = withSpring(playerState.playing ? 1 : 0.88, {
      duration: 400,
      dampingRatio: 0.75,
    });
  }, [playerState.playing, artworkScale]);
  const artworkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: artworkScale.value }],
  }));

  /* Operator, 26 september 2026 (Apple-redesign, staggered entrance):
     eyebrow/titel/hoes/knoppen vliegen na elkaar in bij het openen van dit
     scherm — Apple-patroon i.p.v. alles in één keer tonen. Dit draait
     UITSLUITEND op mount (lege dependency-array), volledig losstaand van
     elke Pressable's press-in/out — geen enkele component unmountet
     tijdens deze animatie, dus geen risico op de crashklasse die de
     resume-knoppen eerder troffen. */
  const entranceArt = useSharedValue(0);
  const entranceTitle = useSharedValue(0);
  const entranceControls = useSharedValue(0);
  useEffect(() => {
    entranceArt.value = withTiming(1, { duration: 500 });
    entranceTitle.value = withDelay(120, withTiming(1, { duration: 450 }));
    entranceControls.value = withDelay(240, withTiming(1, { duration: 450 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const entranceArtStyle = useAnimatedStyle(() => ({
    opacity: entranceArt.value,
    transform: [{ translateY: (1 - entranceArt.value) * 14 }],
  }));
  const entranceTitleStyle = useAnimatedStyle(() => ({
    opacity: entranceTitle.value,
    transform: [{ translateY: (1 - entranceTitle.value) * 14 }],
  }));
  const entranceControlsStyle = useAnimatedStyle(() => ({
    opacity: entranceControls.value,
    transform: [{ translateY: (1 - entranceControls.value) * 10 }],
  }));

  /* ── Press-scale animaties (per knop, additief — geen logica-wijziging) ── */
  const pressScaleMinimize = useSharedValue(1);
  const onPressInMinimize = () => { pressScaleMinimize.value = withTiming(0.92, { duration: 80 }); };
  const onPressOutMinimize = () => { pressScaleMinimize.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleMinimize = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleMinimize.value }] }));

  const pressScaleClose = useSharedValue(1);
  const onPressInClose = () => { pressScaleClose.value = withTiming(0.92, { duration: 80 }); };
  const onPressOutClose = () => { pressScaleClose.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleClose = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleClose.value }] }));

  const pressScaleProgress = useSharedValue(1);
  /* Operator (Apple-HIG-brief, "flinterdunne balk, pas tijdens het slepen
     iets dikker/duimpje zichtbaar — reactive design"): losse waarde van
     de press-scale hierboven, want dit stuurt track-hoogte + duim-
     zichtbaarheid aan, niet een schaal-transform. */
  const scrubActive = useSharedValue(0);
  const onPressInProgress = () => {
    pressScaleProgress.value = withTiming(0.97, { duration: 80 });
    scrubActive.value = withTiming(1, { duration: 120 });
  };
  const onPressOutProgress = () => {
    pressScaleProgress.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
    scrubActive.value = withTiming(0, { duration: 180 });
  };
  const pressStyleProgress = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleProgress.value }] }));
  const progressTrackAnimStyle = useAnimatedStyle(() => ({
    height: 2 + scrubActive.value * 2,
  }));
  const progressThumbAnimStyle = useAnimatedStyle(() => ({
    opacity: scrubActive.value,
  }));

  const pressScaleSkipBack = useSharedValue(1);
  const onPressInSkipBack = () => { pressScaleSkipBack.value = withTiming(0.92, { duration: 80 }); };
  const onPressOutSkipBack = () => { pressScaleSkipBack.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleSkipBack = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleSkipBack.value }] }));

  const pressScalePlay = useSharedValue(1);
  const onPressInPlay = () => { pressScalePlay.value = withTiming(0.94, { duration: 80 }); };
  const onPressOutPlay = () => { pressScalePlay.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStylePlay = useAnimatedStyle(() => ({ transform: [{ scale: pressScalePlay.value }] }));

  const pressScaleSkipFwd = useSharedValue(1);
  const onPressInSkipFwd = () => { pressScaleSkipFwd.value = withTiming(0.92, { duration: 80 }); };
  const onPressOutSkipFwd = () => { pressScaleSkipFwd.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleSkipFwd = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleSkipFwd.value }] }));

  const pressScaleCta = useSharedValue(1);
  const onPressInCta = () => { pressScaleCta.value = withTiming(0.96, { duration: 80 }); };
  const onPressOutCta = () => { pressScaleCta.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleCta = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleCta.value }] }));

  const pressScaleLoginPrimary = useSharedValue(1);
  const onPressInLoginPrimary = () => { pressScaleLoginPrimary.value = withTiming(0.95, { duration: 80 }); };
  const onPressOutLoginPrimary = () => { pressScaleLoginPrimary.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleLoginPrimary = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleLoginPrimary.value }] }));

  const pressScaleLoginSecondary = useSharedValue(1);
  const onPressInLoginSecondary = () => { pressScaleLoginSecondary.value = withTiming(0.95, { duration: 80 }); };
  const onPressOutLoginSecondary = () => { pressScaleLoginSecondary.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleLoginSecondary = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleLoginSecondary.value }] }));

  const pressScaleErrorClose = useSharedValue(1);
  const onPressInErrorClose = () => { pressScaleErrorClose.value = withTiming(0.95, { duration: 80 }); };
  const onPressOutErrorClose = () => { pressScaleErrorClose.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleErrorClose = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleErrorClose.value }] }));

  const pressScaleUpsellPrimary = useSharedValue(1);
  const onPressInUpsellPrimary = () => { pressScaleUpsellPrimary.value = withTiming(0.95, { duration: 80 }); };
  const onPressOutUpsellPrimary = () => { pressScaleUpsellPrimary.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleUpsellPrimary = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleUpsellPrimary.value }] }));

  const pressScaleUpsellSecondary = useSharedValue(1);
  const onPressInUpsellSecondary = () => { pressScaleUpsellSecondary.value = withTiming(0.95, { duration: 80 }); };
  const onPressOutUpsellSecondary = () => { pressScaleUpsellSecondary.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleUpsellSecondary = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleUpsellSecondary.value }] }));

  const pressScaleEndedDone1 = useSharedValue(1);
  const onPressInEndedDone1 = () => { pressScaleEndedDone1.value = withTiming(0.95, { duration: 80 }); };
  const onPressOutEndedDone1 = () => { pressScaleEndedDone1.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleEndedDone1 = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleEndedDone1.value }] }));

  const pressScaleEndedPlayNext = useSharedValue(1);
  const onPressInEndedPlayNext = () => { pressScaleEndedPlayNext.value = withTiming(0.95, { duration: 80 }); };
  const onPressOutEndedPlayNext = () => { pressScaleEndedPlayNext.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleEndedPlayNext = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleEndedPlayNext.value }] }));

  const pressScaleEndedDone2 = useSharedValue(1);
  const onPressInEndedDone2 = () => { pressScaleEndedDone2.value = withTiming(0.95, { duration: 80 }); };
  const onPressOutEndedDone2 = () => { pressScaleEndedDone2.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); };
  const pressStyleEndedDone2 = useAnimatedStyle(() => ({ transform: [{ scale: pressScaleEndedDone2.value }] }));

  /* ── Render ───────────────────────────────────────────────────────────── */

  if (!session) {
    /* Defensief — als de player zonder url-param wordt geopend, gewoon
       sluiten. Komt niet voor in normale flow. */
    return <View style={s.root} />;
  }

  const pct =
    playerState.durationSec > 0
      ? Math.min(100, (playerState.positionSec / playerState.durationSec) * 100)
      : 0;

  return (
    <View style={s.root}>
      {/* ── "Liquid glass" achtergrond ───────────────────────────────────
         Operator, 26 september 2026 (Apple-redesign): geen harde foto-
         banner + zwart vlak meer. De serie-foto vult nu het HELE scherm,
         zwaar geblurd (`blurRadius`, native blur — geen rgba-fake-glass)
         en licht uitvergroot (scale 1.15) zodat de geblurde randen nooit
         zichtbaar worden. Een donkere gradient bovenop houdt de tekst/
         knoppen overal leesbaar, ongeacht de foto-kleuren eronder. */}
      <View style={s.backdrop} pointerEvents="none">
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={s.backdropImageFull}
            blurRadius={38}
          />
        ) : (
          <View style={[s.backdropImageFull, s.backdropFallback]} />
        )}
        <LinearGradient
          colors={[
            'rgba(10,10,10,0.55)',
            'rgba(10,10,10,0.72)',
            'rgba(10,10,10,0.93)',
            '#0a0a0a',
          ]}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* ── Top bar (absolute over backdrop) ──────────────────────────── */}
      {/* Operator (Apple-HIG-brief, "Apple gebruikt hier nooit tekst"):
         MINIMIZE/NOW PLAYING/CLOSE-tekstlabels weg — enkel de twee
         iconen (chevron-down / x), niks in het midden. De controls
         eronder maken al duidelijk dat er audio speelt. */}
      <SafeAreaView edges={['top']} style={s.topbar}>
        <AnimatedPressable
          onPress={onMinimize}
          onPressIn={onPressInMinimize}
          onPressOut={onPressOutMinimize}
          hitSlop={14}
          style={[s.topIconBtn, pressStyleMinimize]}
        >
          <Text style={s.topGlyph}>⌄</Text>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={onClose}
          onPressIn={onPressInClose}
          onPressOut={onPressOutClose}
          hitSlop={14}
          style={[s.topIconBtn, pressStyleClose]}
        >
          <Text style={s.topGlyphX}>✕</Text>
        </AnimatedPressable>
      </SafeAreaView>

      {/* ── Content — start ONDER de topbar, geen overlap meer met een
         fotobanner (die bestaat niet meer als apart element — de foto zit
         nu in de fullscreen backdrop hierboven). ──────────────────────── */}
      <View style={s.content}>
        {/* Zwevende vierkante albumhoes (squircle) — Apple Music-patroon.
           Krimpt licht bij pauze via artworkAnimStyle (zie useEffect
           hierboven), niet gekoppeld aan een Pressable dus geen
           unmount-race mogelijk. */}
        <Animated.View
          style={[
            s.artworkWrap,
            photoAspect ? { height: ARTWORK_SIZE / photoAspect } : null,
            artworkAnimStyle,
            entranceArtStyle,
          ]}
        >
          {photoUri ? (
            /* Operator ("ik vraag letterlijk om de fotos mooi te laten
               passen in de cards"): de hoes krijgt nu de echte
               beeldverhouding (photoAspect, zie hierboven) i.p.v. een vast
               vierkant, dus `cover` toont de hele foto zonder crop of
               lege letterbox-rand. */
            <Image source={{ uri: photoUri }} style={s.artworkImage} resizeMode="cover" />
          ) : (
            <View style={[s.artworkImage, s.backdropFallback]} />
          )}
        </Animated.View>

        <Animated.View style={[s.titleBlock, entranceTitleStyle]}>
          {/* Operator (Apple-HIG-brief, "de titel van de sessie hoort
             altijd bovenaan, groot en vet — categorie/auteur eronder in
             een veel kleiner, rustiger grijs font"): hiërarchie omgedraaid
             t.o.v. de vorige versie (toen stond de categorie bovenaan).
             De live-soundwave staat nu naast de titel i.p.v. naast de
             tijd hieronder ("Apple houdt de cijfers puur clean"). */}
          <View style={s.titleRow}>
            <Text style={s.title} numberOfLines={3}>
              {session.title}
            </Text>
            <View style={s.titleWaveSlot}>
              <SoundwaveIndicator playing={playerState.playing} />
            </View>
          </View>
          <Text style={s.series}>{session.series.toUpperCase()}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </Animated.View>

        <Animated.View style={entranceControlsStyle}>
        {/* Operator ("continue-popup verschijnt telkens overal, heel
           storend — hoe kunnen we dat anders doen?"): het blokkerende
           Continue/Start over-paneel is weg. `loadSession()` hervat nu
           zelf automatisch vanaf de opgeslagen positie (zie
           audio-player.ts, warmSeekTo) — geen keuze meer vooraf, precies
           zoals Spotify/Apple Podcasts/YouTube. "Start over" blijft
           mogelijk, maar als klein, niet-blokkerend tekstlinkje i.p.v.
           een apart paneel; enkel zichtbaar als deze sessie daadwerkelijk
           ergens hervat is (savedPositionSec > 4 bij het laden). */}
        {playerState.savedPositionSec > 4 && (
          <Pressable
            onPress={startOver}
            hitSlop={8}
            style={s.resumedLineWrap}
            accessibilityLabel={`Resumed from ${fmt(playerState.savedPositionSec)}. Tap to start over.`}
          >
            <Text style={s.resumedLineText}>
              Resumed from {fmt(playerState.savedPositionSec)} · <Text style={s.resumedLineAction}>Start over</Text>
            </Text>
          </Pressable>
        )}
        {/* ── Progress ─────────────────────────────────────────────────── */}
        <View style={s.progressWrap}>
            <AnimatedPressable
              onLayout={onProgressLayout}
              onPress={onProgressTap}
              onPressIn={onPressInProgress}
              onPressOut={onPressOutProgress}
              hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}
              style={[s.progressHitArea, pressStyleProgress]}
            >
              {/* Operator (Apple-HIG-brief, "de balk flinterdun, pas
                 tijdens het slepen iets dikker — reactive design"): track
                 + duimpje zijn nu Animated.Views die reageren op
                 `scrubActive` (zie onPressIn/onPressOutProgress) i.p.v.
                 altijd dezelfde vaste dikte/zichtbare stip te tonen. */}
              <Animated.View style={[s.progressTrack, progressTrackAnimStyle]}>
                <View style={[s.progressFill, { width: `${pct}%` }]} />
                <Animated.View
                  style={[s.progressThumb, { left: `${pct}%` }, progressThumbAnimStyle]}
                />
              </Animated.View>
            </AnimatedPressable>
            <View style={s.timeRow}>
              <Text style={s.time}>{fmt(playerState.positionSec)}</Text>
              {/* Iter v189 (2026-07-02): "PREVIEW · X sec left" tijdens
                  preview-mode. Communiceert de 60-sec cap visueel zodat user
                  niet verrast wordt door de auto-pause. */}
              {/* playerState.preview: ook juist na "Play next" in een Pro-sessie (audit 8 okt 2026). */}
              {playerState.preview && (
                <Text style={s.previewCountdown}>
                  PREVIEW · {Math.max(0, 60 - Math.floor(playerState.positionSec))}s left
                </Text>
              )}
              {/* Operator ("Apple houdt de cijfers puur clean... toont de
                 REST-tijd, niet de totale duur"): -M:SS i.p.v. de totale
                 duur, zelfde patroon als Apple Music/Podcasts. */}
              <Text style={s.time}>
                -{fmt(Math.max(0, playerState.durationSec - playerState.positionSec))}
              </Text>
            </View>
        </View>

        {/* ── Skip + Play controls ────────────────────────────────────── */}
        {/* Operator, 7 okt 2026 (Apple Podcasts-logica): de snelheid stuurt
            de audio die nu speelt → dicht bij de afspeelknop, links naast
            terugspoelen. Hartje en delen veranderen niets aan de audio →
            weg uit het zicht, in het "•••"-menu rechts. */}
        <View style={s.skipRow}>
          <SpeedBtn rate={playerState.rate} onPress={onCycleSpeed} />
          <AnimatedPressable
            onPress={() => skipBy(-15)}
            onPressIn={onPressInSkipBack}
            onPressOut={onPressOutSkipBack}
            hitSlop={8}
            style={[s.skipBtn, pressStyleSkipBack]}
          >
            {/* FIX 14 (5e poging — react-native-svg ipv text-glyph).
               Achtergrond-arc via Svg/Path, "15"-cijfer absoluut gevuld
               over de hele Pressable met lineHeight=48+textAlign center.
               Backward-variant: arc start linksboven, eindigt rechts. */}
            <Svg
              width={48}
              height={48}
              viewBox="0 0 24 24"
              fill="none"
              style={s.skipSvg}
            >
              <Path
                d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                stroke="#ffffff"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M3 3v5h5"
                stroke="#ffffff"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={s.skipNum} allowFontScaling={false}>
              15
            </Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={togglePlay}
            onPressIn={onPressInPlay}
            onPressOut={onPressOutPlay}
            hitSlop={10}
            style={[
              s.playBtn,
              playerState.loading && s.playBtnDisabled,
              pressStylePlay,
            ]}
            disabled={playerState.loading}
          >
            {playerState.loading ? (
              /* Spinner ipv play/pause-icoon tijdens loading. Voorkomt
                 het "het doet niks"-gevoel bij eerste play na cold-start
                 (signed-URL fetch + native player init kan 1-3s duren).
                 Operator, 26 september 2026: knop-bg is weer solide teal
                 (operator vond het matte wit niet mooi) — spinner/icoon
                 dus weer wit. */
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <PlayPauseGlyph
                size={28}
                color="#ffffff"
                playing={playerState.playing}
              />
            )}
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => skipBy(15)}
            onPressIn={onPressInSkipFwd}
            onPressOut={onPressOutSkipFwd}
            hitSlop={8}
            style={[s.skipBtn, pressStyleSkipFwd]}
          >
            {/* Forward-variant: arc start rechtsboven, eindigt links.
               Paths zijn de mirror van de backward-knop. */}
            <Svg
              width={48}
              height={48}
              viewBox="0 0 24 24"
              fill="none"
              style={s.skipSvg}
            >
              <Path
                d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
                stroke="#ffffff"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M21 3v5h-5"
                stroke="#ffffff"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={s.skipNum} allowFontScaling={false}>
              15
            </Text>
          </AnimatedPressable>
          <Pressable
            onPress={openMore}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More options"
            style={s.moreBtn}
          >
            <MoreHorizontal size={24} color={C.text} strokeWidth={2} />
          </Pressable>
        </View>

        </Animated.View>

        {/* ── Extras row — operator (Apple-HIG-brief, "favorite/share
            verhuizen naar de absolute onderkant, zodat ze de rust rond
            de grote afspeelknoppen niet verstoren"): niet langer direct
            onder skip+play, maar los daarvan naar de bodem geduwd
            (marginTop:'auto' binnen de flex:1 content-kolom) — vlak boven
            de CTA. Iter v175 (2026-06-30): Sleep-knop weg, zie
            audio-player.ts voor rationale (expo-audio limitation). */}
        <View style={{ marginTop: 'auto' }} />

        {/* ── Full library access CTA ───────────────────────────────────
            Alleen voor guests + free-tier zichtbaar. PRO-users zijn al
            abonnee → de CTA is voor hen ruis (operator-besluit 2026-05-23).
            Iter 9dq v19: gebruikt nu displayIsPro (override-aware) zodat
            de CTA ook verbergt in PRO/Full dev-override, niet alleen bij
            echte ingelogde PRO-users. */}
        {/* Iter 9dq v78 (2026-06-03, ronde 5 — definitief):
            Root-cause was niet padding maar OVERFLOW. Resume-panel
            ("Continue / Start over") maakte de content hoger dan het
            scherm in sessies met een opgeslagen positie. marginBottom
            werkt dan niet — CTA valt onder de container-edge, niet
            onder safe-area.

            Fix: CTA wordt position:absolute, gepind aan de bottom van
            de content-View. Werkt onafhankelijk van content-hoogte:
            CTA staat altijd op vaste afstand van scherm-bottom. Content
            erboven krijgt paddingBottom (zie s.content) zodat de
            favorite-row niet onder de CTA verdwijnt. */}
        {!displayIsPro && (
          <AnimatedPressable
            style={[
              s.cta,
              s.ctaAbsolute,
              { bottom: Math.max(safeInsets.bottom + 24, 72) },
              pressStyleCta,
            ]}
            onPress={openUpgrade}
            onPressIn={onPressInCta}
            onPressOut={onPressOutCta}
            hitSlop={10}
          >
            <Text style={s.ctaText}>Full library access</Text>
          </AnimatedPressable>
        )}
        {/* PRO-spacer onnodig in absolute-mode (CTA staat niet in
            flex-flow), maar we behouden 'm voor bottom-padding bij
            scroll-scenarios. */}
        {displayIsPro && (
          <View style={{ height: Math.max(safeInsets.bottom + 16, 48) }} />
        )}
      </View>

      {/* ── Error modal (iter 9dq v67, 2026-06-03) ────────────────────
          Stijl unification met de upsell-modal hieronder. Twee paden:

          - LOGIN_REQUIRED / SUBSCRIPTION_REQUIRED → paid-content
            blokkade. Zelfde body-tekst als de preview-upsell modal
            ("Get full access to the complete VIBEZCORE library."),
            primary CTA leidt naar pricing (zelfde flow als upsell),
            secondary "Sign in" voor users die al account hebben.

          - Andere errors (netwerk, signed-URL fail, etc.) → korte
            retry-modal met één CTA om te sluiten. Geen pricing-link
            zoals voorheen — een netwerk-glitch is geen aankoop-trigger,
            user moet gewoon opnieuw kunnen proberen.

          Voorheen had de paid-error-modal eigen langere tekst
          ("Already have a VIBEZCORE account? Sign in. Otherwise get the
          audio library...") die ondertussen niet meer matchte met de
          rest van de UI. Korte evergreen copy past beter bij app-store
          tone-of-voice. */}
      {playerState.errorMessage && !playerState.previewBlocked ? (
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            {/* Operator, 7 okt 2026 (account-audit): gekocht zonder account
               (Apple 5.1.1v) → Premium is actief, maar de server streamt de
               bibliotheek enkel naar een account. Geen verkooppraat: één
               stap, en de aankoop gaat mee (auth.ts linkRevenueCatUser). */}
            {playerState.errorMessage.includes('LOGIN_REQUIRED') && displayIsPro ? (
              <>
                <Text style={s.modalTitle}>One more step</Text>
                <Text style={s.modalBody}>
                  Create your free account to stream the Audio Library. Your Premium comes with you.
                </Text>
                <View style={s.modalBtns}>
                  <AnimatedPressable
                    style={[s.modalPrimary, pressStyleLoginPrimary]}
                    onPress={() => {
                      requestScrollTo('account-signup');
                      router.back();
                      router.navigate('/account');
                    }}
                    onPressIn={onPressInLoginPrimary}
                    onPressOut={onPressOutLoginPrimary}
                  >
                    <Text style={s.modalPrimaryText}>Create account</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={[s.modalSecondary, pressStyleLoginSecondary]}
                    onPress={() => {
                      requestScrollTo('account-top');
                      router.back();
                      router.navigate('/account');
                    }}
                    onPressIn={onPressInLoginSecondary}
                    onPressOut={onPressOutLoginSecondary}
                  >
                    <Text style={s.modalSecondaryText}>Sign in</Text>
                  </AnimatedPressable>
                </View>
              </>
            ) : playerState.errorMessage.includes('LOGIN_REQUIRED') ||
            playerState.errorMessage.includes('SUBSCRIPTION_REQUIRED') ? (
              <>
                <Text style={s.modalTitle}>Continue listening?</Text>
                <Text style={s.modalBody}>
                  Get full access to the complete VIBEZCORE library.
                </Text>
                <View style={s.modalBtns}>
                  <AnimatedPressable
                    style={[s.modalPrimary, pressStyleLoginPrimary]}
                    onPress={openUpgrade}
                    onPressIn={onPressInLoginPrimary}
                    onPressOut={onPressOutLoginPrimary}
                  >
                    <Text style={s.modalPrimaryText}>Get Full Access</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={[s.modalSecondary, pressStyleLoginSecondary]}
                    onPress={() => {
                      router.back();
                      router.navigate('/account');
                    }}
                    onPressIn={onPressInLoginSecondary}
                    onPressOut={onPressOutLoginSecondary}
                  >
                    <Text style={s.modalSecondaryText}>Sign in</Text>
                  </AnimatedPressable>
                </View>
              </>
            ) : (
              <>
                <Text style={s.modalTitle}>Couldn't load this session</Text>
                <Text style={s.modalBody}>
                  Please check your connection and try again.
                </Text>
                <View style={s.modalBtns}>
                  <AnimatedPressable
                    style={[s.modalPrimary, pressStyleErrorClose]}
                    onPress={() => router.back()}
                    onPressIn={onPressInErrorClose}
                    onPressOut={onPressOutErrorClose}
                  >
                    <Text style={s.modalPrimaryText}>Close</Text>
                  </AnimatedPressable>
                </View>
              </>
            )}
          </View>
        </View>
      ) : null}

      {/* ── Preview-upsell modal ──────────────────────────────────────── */}
      {playerState.previewBlocked ? (
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Continue listening?</Text>
            {/* Iter v168 (2026-06-28): Free Picks expliciet vernoemen in de
                paywall. Operator-feedback: gast die hier landt weet niet dat
                er 27 gratis sessies bestaan en denkt 'alles is betaald' →
                conversie-killer. Door Free Picks te noemen blijft de upsell
                primair (Get Full Access) maar krijgt de gast een eerlijk
                alternatief.
                Iter v227 (2026-07-07, audit AU3): bracelet-owner ziet
                andere copy — "Add Audio Library" ipv "Get Full Access".
                Operator, 26 september 2026 — CORRECTIE: eerdere versie zei
                "unlock all 144 sessions" tijdens de trial. Fout: het
                toegangsmodel is 3 niveaus (project-free-tier-facts) — de
                trial ontgrendelt 27 sessies + Breathwork, NIET de hele
                bibliotheek; volledige toegang komt pas na het BETAALDE
                jaar (na de trial-periode). De code (useSubscription.ts)
                behandelt een actieve RevenueCat-trial nu nog hetzelfde als
                een volledig betaald abonnement (`isPro=true` voor beide) —
                dat is een apart, groter gat dat nog opgelost moet worden;
                deze copy-fix voorkomt in elk geval dat de PAYWALL zelf een
                belofte doet die niet klopt met het bedoelde model. */}
            <Text style={s.modalBody}>
              {/* Audit 8 okt 2026: wie al in de proefperiode zit, krijgt geen
                 "start your trial" — de volledige bibliotheek komt na de trial. */}
              {isTrialing
                ? 'The full Audio Library unlocks when your trial ends and your membership starts.'
                : isBraceletOwner && !realIsPro && !isBundleUser
                  ? 'Add the Audio Library to complete your VIBEZCORE system.'
                  : 'Start your free trial to unlock more sessions.'}
              {'\n\n'}
              Not ready? Browse Free Picks to keep listening for free.
            </Text>
            <View style={s.modalBtns}>
              <Pressable style={s.modalPrimary} onPress={openUpgrade}>
                <Text style={s.modalPrimaryText}>
                  {isBraceletOwner && !realIsPro && !isBundleUser
                    ? 'Add Audio Library'
                    : 'Get Full Access'}
                </Text>
              </Pressable>
              <Pressable
                style={s.modalSecondary}
                onPress={onUpsellMaybeLater}
              >
                <Text style={s.modalSecondaryText}>Maybe later</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* ── "Play next?"-paneel ───────────────────────────────────────── */}
      {playerState.endedPanel ? (
        <View style={s.modalOverlay}>
          <View style={s.endedCard}>
            <Text style={s.endedEyebrow}>SESSION COMPLETE</Text>
            {playerState.endedPanel.nextSession ? (
              <>
                <Text style={s.endedSub}>Up next</Text>
                <Text style={s.endedTitle} numberOfLines={2}>
                  {playerState.endedPanel.nextSession.title}
                </Text>
                {/* Operator, 1 okt 2026 ("namen niet afbreken met …"). */}
                <Text style={s.endedSeries}>
                  {playerState.endedPanel.nextSession.series}
                </Text>
                <View style={s.endedBtns}>
                  <Pressable
                    onPress={dismissEndedPanel}
                    style={s.endedDone}
                  >
                    <Text style={s.endedDoneText}>Done</Text>
                  </Pressable>
                  <Pressable
                    onPress={playNextFromPanel}
                    style={s.endedPlayNext}
                  >
                    <Text style={s.endedPlayNextText}>
                      {/* Iter 9rr: voor guests was de "next" sessie altijd
                          de volgende free sessie (cross-series jump) →
                          expliciete label "free session" voorkwam verwarring.
                          Iter 9dq v14 (2026-06-02): freeOnly UIT, next is
                          altijd volgende sessie in dezelfde serie ongeacht
                          PRO-state. Label is daarom uniform "Play next" —
                          consistent UX voor alle user-types. */}
                      ▶ Play next
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={s.endedTitle}>Series complete</Text>
                <Text style={s.endedSeries}>
                  You've finished {playerState.endedPanel.finishedSeries}
                </Text>
                <View style={[s.endedBtns, { justifyContent: 'center' }]}>
                  <Pressable
                    onPress={dismissEndedPanel}
                    style={s.endedDone}
                  >
                    <Text style={s.endedDoneText}>Done</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function ExtraBtn({
  icon,
  label,
  color,
  onPress,
  align = 'center',
}: {
  icon: string | ReactNode;
  label: string;
  color?: string;
  onPress: () => void;
  align?: 'start' | 'center' | 'end';
}) {
  /* Iter v174 (2026-06-30): icon mag string of ReactNode zijn. Share-button
     gebruikt Share2-glyph van lucide (officieel Android share-symbool); andere
     extras blijven met Unicode-glyph strings werken. */
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        s.extraBtn,
        { alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center' },
      ]}
    >
      {typeof icon === 'string' ? (
        <Text style={[s.extraIcon, color ? { color } : null]}>{icon}</Text>
      ) : (
        <View style={s.extraIconBox}>{icon}</View>
      )}
    </Pressable>
  );
}

function SpeedBtn({
  rate,
  onPress,
}: {
  rate: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Playback speed ${rate}x`}
      style={[s.extraBtn, { alignItems: 'center', width: 52 }]}
    >
      <Text style={s.speedText} allowFontScaling={false}>{`${Number.isInteger(rate) ? rate : rate.toFixed(rate * 10 % 1 === 0 ? 1 : 2)}×`}</Text>
    </Pressable>
  );
}

/* Operator (marktonderzoek Apple-brief, "flinterdunne actieve soundwave-
   animatie... direct naast de afspeeltijd... enige plek voor een
   functioneel symbool dat de sessie live is"): vier dunne staafjes die
   los van elkaar op-en-neer bewegen zolang er wordt afgespeeld, en stil
   staan bij pauze. Geen echte audio-analyse (expo-audio geeft geen
   frequentiedata) — een subtiele, licht willekeurige loop-animatie geeft
   exact hetzelfde "dit leeft"-gevoel zonder die data nodig te hebben. */
/* Operator ("dat moet echte wave zijn, professioneel"): 4 identieke
   staafjes die in lockstep dezelfde 4 waarden doorliepen oogde als een
   simpel knippersignaal, niet als een equalizer. Vijf staafjes, elk met
   een EIGEN min/max-bereik en tempo (zodat ze nooit synchroon bewegen)
   + een `ease-in-out`-curve i.p.v. lineaire `withTiming`-stappen — dat
   organische, ongelijke ritme is precies wat een écht audio-EQ-icoon
   (Apple Music "now playing") herkenbaar maakt. Bars groeien vanaf de
   bodem (zie `soundwave`'s `alignItems:'flex-end'`), niet vanuit het
   midden. */
const BAR_PROFILES = [
  { min: 3, peaks: [8, 5, 11], durations: [280, 260, 300] },
  { min: 3, peaks: [13, 7, 15], durations: [320, 240, 340] },
  { min: 3, peaks: [6, 10, 4], durations: [260, 300, 220] },
  { min: 3, peaks: [11, 4, 9], durations: [300, 220, 280] },
  { min: 3, peaks: [7, 14, 6], durations: [240, 320, 260] },
] as const;

function SoundwaveBar({
  playing,
  profile,
}: {
  playing: boolean;
  profile: (typeof BAR_PROFILES)[number];
}) {
  const h = useSharedValue<number>(profile.min);
  useEffect(() => {
    if (playing) {
      h.value = withRepeat(
        withSequence(
          ...profile.peaks.map((peak, i) =>
            withTiming(peak, {
              duration: profile.durations[i],
              easing: Easing.inOut(Easing.ease),
            }),
          ),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(profile.min, { duration: 200 });
    }
  }, [playing, profile, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[s.soundwaveBar, style]} />;
}

function SoundwaveIndicator({ playing }: { playing: boolean }) {
  return (
    <View style={s.soundwave} accessibilityLabel="Session is live">
      {BAR_PROFILES.map((profile, i) => (
        <SoundwaveBar key={i} playing={playing} profile={profile} />
      ))}
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  /* Backdrop — fullscreen, geblurd (zie toelichting bij de JSX hierboven). */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
  /* scale 1.15 verbergt de rand-artefacten die blurRadius soms aan de
     buitenkant van een Image achterlaat. */
  backdropImageFull: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.15 }],
  },
  backdropFallback: { backgroundColor: '#1a1a1a' },

  /* Zwevende vierkante albumhoes (squircle) — Apple Music-patroon. */
  artworkWrap: {
    alignSelf: 'center',
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#141414',
    marginTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 12,
  },
  artworkImage: { width: '100%', height: '100%' },

  /* Top bar — absolute zodat backdrop volledig erachter zit en content
     niet wordt opgeschoven. SafeAreaView (top edge) zorgt voor status-bar
     inset op zowel iOS als Android. alignItems:'flex-start' op de
     SafeAreaView houdt de drie kolommen netjes vanaf de top — buttons
     stapelen icon + label, middencolumn doet dat met een spacer. */
  topbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
  },
  topIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(244,244,244,0.15)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Glyph in icon-button — fontWeight 400 voor SF-symbol-achtige dunne
     stroke; lineHeight matched fontSize zodat vertically centered klopt. */
  topGlyph: {
    color: C.text,
    fontSize: 18,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
    marginTop: -2, // optische correctie voor chevron-down baseline
  },
  topGlyphX: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 14,
  },

  /* Content — start onder de topbar (geen fotobanner meer om over te
     overlappen, zie backdrop hierboven). safeInsets.top + topbar-hoogte
     (±70) + ademruimte. */
  content: {
    flex: 1,
    marginTop: 116,
    paddingHorizontal: 24,
    /* Iter 9dq v78 (2026-06-03): paddingBottom reserveert ruimte voor
       de absolute-positioned CTA (knop-hoogte ~48px + 72px floor-margin
       + 16px breathing = ~136px). Zonder dit zou de Favorite/Speed/Sleep
       row achter de CTA verdwijnen wanneer content kort is. Wordt ook
       toegepast voor PRO-users zodat layout consistent is. */
    paddingBottom: 136,
  },

  /* Title block — operator, 26 september 2026 ("alles staat heel dicht bij
     elkaar"): marginTop geeft ademruimte tussen de albumhoes en de tekst. */
  titleBlock: { marginTop: 14 },
  /* Operator (Apple-HIG-brief, "titel altijd bovenaan, groot en vet —
     categorie/auteur eronder in een veel kleiner, rustiger grijs font"):
     rollen omgewisseld t.o.v. de vorige versie. `series`/`subtitle` zijn
     nu de gedempte metadata-regels, `title` is de hero. */
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleWaveSlot: { marginTop: 6 },
  title: {
    flex: 1,
    color: C.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 28,
  },
  series: {
    color: C.dim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.1,
    marginTop: 8,
  },
  subtitle: {
    color: 'rgba(244,244,244,0.4)',
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginTop: 3,
  },

  /* Progress — Apple-redesign: zachtere track + duimpje op de huidige
     positie i.p.v. een kale 3px lijn zonder handvat. */
  progressWrap: { marginTop: 24, marginHorizontal: 0 },
  progressHitArea: { paddingVertical: 12 },
  progressTrack: {
    width: '100%',
    backgroundColor: 'rgba(244,244,244,0.18)',
    borderRadius: 2,
    overflow: 'visible',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.accent,
    borderRadius: 2,
  },
  /* Duimpje — absoluut gepositioneerd op de rand van progressFill, dus
     de `left`/`right`-offset volgt automatisch mee met de fill-breedte
     zolang beide binnen dezelfde relative-positioned progressTrack zitten. */
  progressThumb: {
    position: 'absolute',
    top: '50%',
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#ffffff',
    marginTop: -5.5,
    marginLeft: -5.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  time: { color: 'rgba(244,244,244,0.5)', fontSize: 11 },
  soundwave: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    height: 15,
  },
  soundwaveBar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(244,244,244,0.65)',
  },
  /* Iter v189 (2026-07-02): preview countdown pill tussen huidige tijd en
     totale duur. Accentkleur voor zichtbaarheid zonder visueel schreeuwend. */
  previewCountdown: {
    color: C.accent,
    fontSize: 10.5,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: 0.8,
  },

  /* Operator ("continue-popup verschijnt telkens overal, heel storend"):
     vervangt het vorige blokkerende resume-paneel (2 grote knoppen) —
     nu een klein, rustig tekstlinkje, enkel zichtbaar wanneer deze
     sessie automatisch ergens hervat is. */
  resumedLineWrap: { alignSelf: 'center', marginTop: 14, marginBottom: -4 },
  resumedLineText: {
    color: 'rgba(244,244,244,0.45)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
  },
  resumedLineAction: {
    color: 'rgba(244,244,244,0.7)',
    fontFamily: BrandFonts.semibold,
    textDecorationLine: 'underline',
  },

  /* Skip + play */
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 10,
  },
  moreBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  /* FIX 14 (5e poging — react-native-svg). Container 48×48,
     position:'relative' zodat de absoluut-gepositioneerde SVG en Text
     centreren op de container-bounds. */
  skipBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  /* SVG vult de hele skipBtn met de boog-arc + arrow-tip. */
  skipSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  /* "15"-cijfer absoluut gevuld over de hele Pressable. textAlign
     centert horizontaal. lineHeight=48 (= container height) +
     textAlignVertical:'center' geeft Android een eerlijke vertical
     center — anders schuift font-metric het cijfer net van de
     boog-center. includeFontPadding:false verwijdert Inter's extra
     Android-padding. allowFontScaling:false op de Text-instance zelf. */
  skipNum: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    color: '#ffffff',
    lineHeight: 48,
    includeFontPadding: false,
  },
  /* Operator, 26 september 2026: terug naar solide accentkleur-vlak met
     wit icoon — het "Apple Podcasts wit vlak + gekleurd icoon"-patroon
     oogde te mat/dof (operator-feedback).
     Operator (Apple-HIG-brief, "zachtere glow of een perfecte, egale
     cirkel"): shadowOpacity/-Radius iets getemperd — een egale cirkel
     met een zachte gloed i.p.v. een felle spot. */
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  /* Subtle dim wanneer disabled (tijdens loading / awaiting-resume) zodat
     het visueel duidelijk is dat de tap niet werkt. Combineert met de
     spinner-vervanging van de play-glyph hierboven. */
  playBtnDisabled: {
    opacity: 0.65,
  },
  playGlyph: { color: C.text, fontSize: 28, fontFamily: BrandFonts.bold },

  /* Extras row */
  /* Operator, 7 okt 2026 ("te druk, alles zo verspreid"): één groepje
     in het midden i.p.v. tegen de randen van de tijdbalk. */
  extrasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 24,
  },
  extraBtn: { minWidth: 44, height: 44, justifyContent: 'center' },
  extraIcon: {
    color: C.text,
    fontSize: 24,
    lineHeight: 28,
  },
  /* Iter v174 (2026-06-30): box-variant voor lucide-icons in extras-row.
     Matched de visuele footprint van extraIcon-text (28px lineHeight). */
  extraIconBox: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  extraLabel: {
    color: 'rgba(244,244,244,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.4,
    marginTop: 6,
  },
  speedCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: { color: C.text, fontSize: 17, fontFamily: BrandFonts.semibold, fontVariant: ['tabular-nums'] },

  /* CTA — Operator, 26 september 2026 (Apple-redesign): de volle witte
     pil eiste te veel aandacht tijdens actief luisteren ("een verkoopknop
     mag nooit de hoofdrol spelen in een actieve player"). Outlined i.p.v.
     solid — subtiel aanwezig, niet dominant.
     Operator (Apple-HIG-brief, "in een actieve player hoort geen
     storende upgrade-banner te staan... een elegant, klein
     tekstlinkje helemaal onderin"): geen rand/vlak meer, gewoon een
     rustig, klein tekstlinkje. Enkel DEZE persistente CTA verandert;
     de modal-CTA's (upsell/ended-panel) blijven bewust wel solid, dat
     zijn gerichte conversiemomenten, geen permanent zichtbare balk. */
  cta: {
    marginTop: 'auto',
    marginBottom: 24,
    alignItems: 'center',
  },
  /* Absolute-positioned variant van cta (iter 9dq v78). marginTop:auto
     en marginBottom worden in de absolute-mode irrelevant — het bottom-
     attribuut bepaalt de positie, left/right zorgen voor full-width
     binnen de content-horizontal-padding. */
  ctaAbsolute: {
    position: 'absolute',
    left: 24,
    right: 24,
    marginTop: 0,
    marginBottom: 0,
  },
  ctaText: {
    color: 'rgba(244,244,244,0.55)',
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(244,244,244,0.3)',
  },

  /* Preview modal */
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.modalOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(244,244,244,0.1)',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
  },
  modalTitle: {
    color: C.text,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
  },
  modalBody: {
    color: 'rgba(244,244,244,0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
    lineHeight: 20,
  },
  modalBtns: {
    width: '100%',
    gap: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  modalPrimary: {
    backgroundColor: C.ctaBg,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  modalPrimaryText: { color: C.ctaText, fontSize: 15, fontFamily: BrandFonts.bold },
  modalSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(244,244,244,0.2)',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  modalSecondaryText: { color: C.text, fontSize: 15, fontFamily: BrandFonts.semibold },

  /* Ended-paneel ("Play next?") — modal-achtig over de player */
  endedCard: {
    backgroundColor: 'rgba(20,20,25,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(244,244,244,0.1)',
    borderRadius: 20,
    padding: 24,
    maxWidth: 360,
    width: '100%',
  },
  endedEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  endedSub: {
    color: 'rgba(244,244,244,0.5)',
    fontSize: 12,
    marginTop: 6,
  },
  endedTitle: {
    color: C.text,
    fontSize: 20,
    fontFamily: BrandFonts.extrabold,
    marginTop: 8,
    lineHeight: 24,
  },
  endedSeries: {
    color: 'rgba(244,244,244,0.55)',
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    marginTop: 2,
  },
  endedBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  endedDone: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(244,244,244,0.2)',
    alignItems: 'center',
  },
  endedDoneText: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  endedPlayNext: {
    flex: 1,
    backgroundColor: C.ctaBg,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    alignItems: 'center',
  },
  endedPlayNextText: {
    color: C.ctaText,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
  },
});
