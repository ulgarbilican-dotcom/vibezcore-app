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
  SERIES_PHOTO,
  SERIES_SUBTITLE,
  type Session,
} from '@/data/audio-library-data';
import { useFavorites } from '@/hooks/useFavorites';
import { useSubscription } from '@/hooks/useSubscription';
import { useBraceletOwner } from '@/utils/dev-user-override';
import {
  continueFromSaved,
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
import {
  formatListenedLabel,
  getEntryByUrl,
  useHistory,
} from '@/utils/history';
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
import { Share2 } from 'lucide-react-native';

const SPEEDS = [1.0, 1.25, 1.5, 1.75, 2.0];
const BACKDROP_HEIGHT = Math.round(Dimensions.get('window').height * 0.5);

const C = {
  bg: '#000',
  text: '#fff',
  dim: 'rgba(255,255,255,0.55)',
  faint: 'rgba(255,255,255,0.4)',
  border: 'rgba(255,255,255,0.15)',
  accent: '#3a8fff',
  /* Iter 2026-06-05: kleur-cleanup (operator-feedback).
     - FREE label: wit i.p.v. groen (info, geen completion-signaal)
     - PARTIAL: blauw (active/in-progress) — ongewijzigd
     - FULL: groen (completion) — ongewijzigd
     De drie staten hebben nu één duidelijk semantiek elk. */
  free: 'rgba(255,255,255,0.72)',
  partial: '#3a8fff',
  full: '#4ade80',
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
  const { isPro: displayIsPro, realIsPro, braceletModel } = useSubscription();
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
     defensive fallback en audio-player.shouldPreview bundle-check. */
  const hasSubscription = realIsPro || isBundleUser;
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

  /* Series-foto: hoofdkaart van de serie. Soundscapes-subcategorieën
     krijgen GEEN eigen photo (operator-besluit Q6 TAAK 3). */
  const photoUri = session ? SERIES_PHOTO[session.series] : undefined;
  const subtitle = session ? SERIES_SUBTITLE[session.series] ?? '' : '';

  /* State-pill leest history. ▶ Partly listened (blauw) of ✓ Fully listened
     (groen) of ✓ Fully listened x2/3/... voor herhaalde afspelingen.
     Iter 9dq v111 (2026-06-04): label gecentraliseerd in
     formatListenedLabel — inclusief fc-count. */
  const stateLabel = useMemo(() => {
    if (!session) return null;
    const label = formatListenedLabel(getEntryByUrl(session.url));
    if (!label) return null;
    return {
      text: label.text,
      color: label.isFull ? C.full : C.partial,
      glyph: label.isFull ? '✓' : '▶',
    };
  }, [session, playerState.session]); // re-eval als history schrijft (via useHistory hierboven)

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
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

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
        message: `I'm listening to "${session.title}" on VIBEZCORE.\n\n${pitch}\n\nInstall the app and listen to more than 27 free full sessions: ${url}`,
        url,
      });
    } catch {}
  };

  const onUpsellMaybeLater = async () => {
    await unload();
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

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
      {/* ── Cinematic backdrop ────────────────────────────────────────── */}
      <View style={s.backdrop}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={s.backdropImage} />
        ) : (
          <View style={[s.backdropImage, s.backdropFallback]} />
        )}
        <LinearGradient
          colors={[
            'rgba(0,0,0,0)',
            'rgba(0,0,0,0.4)',
            'rgba(0,0,0,0.85)',
            '#000',
          ]}
          locations={[0, 0.4, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      {/* ── Top bar (absolute over backdrop) ──────────────────────────── */}
      {/* iOS-stijl: elk button is een ronde 32px container met een dun
         glyph en een label eronder. NOW PLAYING-label staat centraal,
         visueel uitgelijnd met de icon-centers (alignItems:'flex-start'
         op de column zorgt dat de NOW PLAYING-text ook bovenaan staat). */}
      <SafeAreaView edges={['top']} style={s.topbar}>
        <Pressable onPress={onMinimize} hitSlop={14} style={s.topColumn}>
          <View style={s.topIconBtn}>
            <Text style={s.topGlyph}>⌄</Text>
          </View>
          <Text style={s.topBtnLabel}>MINIMIZE</Text>
        </Pressable>
        <View style={s.topColumn}>
          <View style={s.topLabelSpacer} />
          <Text style={s.topLabel}>NOW PLAYING</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={14} style={s.topColumn}>
          <View style={s.topIconBtn}>
            <Text style={s.topGlyphX}>✕</Text>
          </View>
          <Text style={s.topBtnLabel}>CLOSE</Text>
        </Pressable>
      </SafeAreaView>

      {/* ── Content (overlapt backdrop met -60px) ─────────────────────── */}
      <View style={s.content}>
        <View style={s.titleBlock}>
          <Text style={s.series}>{session.series.toUpperCase()}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          <Text style={s.title} numberOfLines={3}>
            {session.title}
          </Text>
          {stateLabel ? (
            <Text style={[s.statePill, { color: stateLabel.color }]}>
              {stateLabel.glyph} {stateLabel.text}
            </Text>
          ) : null}
        </View>

        {/* ── Progress OR Resume panel ────────────────────────────────── */}
        {playerState.awaitingResume ? (
          <View style={s.resumePanel}>
            <Pressable
              style={s.resumeBtn}
              onPress={continueFromSaved}
              android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
            >
              <Text style={s.resumeGlyph}>↩</Text>
              <Text style={s.resumeText}>Continue</Text>
              <Text style={s.resumeSub}>
                {fmt(playerState.savedPositionSec)}
              </Text>
            </Pressable>
            <Pressable
              style={[s.resumeBtn, s.resumeBtnAlt]}
              onPress={startOver}
              android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
            >
              <Text style={s.resumeGlyph}>▶</Text>
              <Text style={s.resumeText}>Start over</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.progressWrap}>
            <Pressable
              onLayout={onProgressLayout}
              onPress={onProgressTap}
              hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}
              style={s.progressHitArea}
            >
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${pct}%` }]} />
              </View>
            </Pressable>
            <View style={s.timeRow}>
              <Text style={s.time}>{fmt(playerState.positionSec)}</Text>
              {/* Iter v189 (2026-07-02): "PREVIEW · X sec left" tijdens
                  preview-mode. Communiceert de 60-sec cap visueel zodat user
                  niet verrast wordt door de auto-pause. */}
              {usePreview && (
                <Text style={s.previewCountdown}>
                  PREVIEW · {Math.max(0, 60 - Math.floor(playerState.positionSec))}s left
                </Text>
              )}
              <Text style={s.time}>{fmt(playerState.durationSec)}</Text>
            </View>
          </View>
        )}

        {/* ── Skip + Play controls ────────────────────────────────────── */}
        <View style={s.skipRow}>
          <Pressable
            onPress={() => skipBy(-15)}
            hitSlop={8}
            style={s.skipBtn}
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
          </Pressable>

          <Pressable
            onPress={togglePlay}
            hitSlop={10}
            style={[
              s.playBtn,
              (playerState.loading || playerState.awaitingResume) &&
                s.playBtnDisabled,
            ]}
            disabled={playerState.loading || playerState.awaitingResume}
          >
            {playerState.loading ? (
              /* Spinner ipv play/pause-icoon tijdens loading. Voorkomt
                 het "het doet niks"-gevoel bij eerste play na cold-start
                 (signed-URL fetch + native player init kan 1-3s duren). */
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <PlayPauseGlyph
                size={28}
                color="#ffffff"
                playing={playerState.playing}
              />
            )}
          </Pressable>

          <Pressable
            onPress={() => skipBy(15)}
            hitSlop={8}
            style={s.skipBtn}
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
          </Pressable>
        </View>

        {/* ── Extras row — iter v175 (2026-06-30): Sleep-knop weg. Zie
            audio-player.ts iter v175 voor rationale (expo-audio limitation). */}
        <View style={s.extrasRow}>
          <ExtraBtn
            icon={isFav ? '♥' : '♡'}
            label="Favorite"
            color={isFav ? C.heart : C.text}
            onPress={() =>
              toggleFav({
                url: session.url,
                title: session.title,
                series: session.series,
              })
            }
          />
          <SpeedBtn rate={playerState.rate} onPress={onCycleSpeed} />
          {session.free && (
            <ExtraBtn icon={<Share2 size={24} color={C.text} strokeWidth={2.2} />} label="Share" onPress={onShare} />
          )}
        </View>

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
          <Pressable
            style={[
              s.cta,
              s.ctaAbsolute,
              { bottom: Math.max(safeInsets.bottom + 24, 72) },
            ]}
            onPress={openUpgrade}
            android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
          >
            <Text style={s.ctaText}>→ Full library access</Text>
          </Pressable>
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
            {playerState.errorMessage.includes('LOGIN_REQUIRED') ||
            playerState.errorMessage.includes('SUBSCRIPTION_REQUIRED') ? (
              <>
                <Text style={s.modalTitle}>Continue listening?</Text>
                <Text style={s.modalBody}>
                  Get full access to the complete VIBEZCORE library.
                </Text>
                <View style={s.modalBtns}>
                  <Pressable style={s.modalPrimary} onPress={openUpgrade}>
                    <Text style={s.modalPrimaryText}>Get Full Access</Text>
                  </Pressable>
                  <Pressable
                    style={s.modalSecondary}
                    onPress={() => {
                      router.back();
                      router.navigate('/account');
                    }}
                  >
                    <Text style={s.modalSecondaryText}>Sign in</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={s.modalTitle}>Couldn't load this session</Text>
                <Text style={s.modalBody}>
                  Please check your connection and try again.
                </Text>
                <View style={s.modalBtns}>
                  <Pressable
                    style={s.modalPrimary}
                    onPress={() => router.back()}
                  >
                    <Text style={s.modalPrimaryText}>Close</Text>
                  </Pressable>
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
                andere copy — "Add Audio Library" ipv "Get Full Access". */}
            <Text style={s.modalBody}>
              {isBraceletOwner && !realIsPro && !isBundleUser
                ? 'Add the Audio Library to complete your VIBEZCORE system.'
                : 'Get full access to the complete VIBEZCORE library.'}
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
                <Text style={s.endedSeries} numberOfLines={1}>
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
}: {
  icon: string | ReactNode;
  label: string;
  color?: string;
  onPress: () => void;
}) {
  /* Iter v174 (2026-06-30): icon mag string of ReactNode zijn. Share-button
     gebruikt Share2-glyph van lucide (officieel Android share-symbool); andere
     extras blijven met Unicode-glyph strings werken. */
  return (
    <Pressable onPress={onPress} hitSlop={8} style={s.extraBtn}>
      {typeof icon === 'string' ? (
        <Text style={[s.extraIcon, color ? { color } : null]}>{icon}</Text>
      ) : (
        <View style={s.extraIconBox}>{icon}</View>
      )}
      <Text style={s.extraLabel}>{label}</Text>
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
    <Pressable onPress={onPress} hitSlop={8} style={s.extraBtn}>
      <View style={s.speedCircle}>
        <Text style={s.speedText}>{rate.toFixed(1)}×</Text>
      </View>
      <Text style={s.extraLabel}>Speed</Text>
    </Pressable>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  /* Backdrop */
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BACKDROP_HEIGHT,
    backgroundColor: '#0a0a0a',
  },
  backdropImage: { width: '100%', height: '100%' },
  backdropFallback: { backgroundColor: '#1a1a1a' },

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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
  },
  topColumn: {
    alignItems: 'center',
    minWidth: 64,
  },
  topIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Glyph in icon-button — fontWeight 400 voor SF-symbol-achtige dunne
     stroke; lineHeight matched fontSize zodat vertically centered klopt. */
  topGlyph: {
    color: C.text,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: -2, // optische correctie voor chevron-down baseline
  },
  topGlyphX: {
    color: C.text,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 14,
  },
  /* Label onder icon-button (MINIMIZE / CLOSE). */
  topBtnLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.08, // .12em op 9px
    textTransform: 'uppercase',
    marginTop: 4,
  },
  /* Spacer in midden-column zodat NOW PLAYING op gelijke hoogte komt als
     de icon-button-mid (niet alleen onder een lege ruimte). 32 (icon) +
     4 (gap) = 36 totaal hoogte tot label. Spacer vult tot label-positie. */
  topLabelSpacer: { height: 36 },
  /* "NOW PLAYING" — dimmer dan de actie-labels per spec. */
  topLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.35, // .15em op 9px
    textTransform: 'uppercase',
  },

  /* Content */
  content: {
    flex: 1,
    marginTop: BACKDROP_HEIGHT - 60, // -60 overlap zoals spec voorschrijft
    paddingHorizontal: 24,
    /* Iter 9dq v78 (2026-06-03): paddingBottom reserveert ruimte voor
       de absolute-positioned CTA (knop-hoogte ~48px + 72px floor-margin
       + 16px breathing = ~136px). Zonder dit zou de Favorite/Speed/Sleep
       row achter de CTA verdwijnen wanneer content kort is. Wordt ook
       toegepast voor PRO-users zodat layout consistent is. */
    paddingBottom: 136,
  },

  /* Title block */
  titleBlock: { paddingTop: 0 },
  series: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.54,
  },
  subtitle: {
    color: C.dim,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  title: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
    marginTop: 4,
  },
  /* FIX 15a: status-pill subtieler. fontSize 12→11, weight 600→500,
     opacity 0.65 (dimmer), marginTop 8→6. Voelt als terloopse info
     ipv hoofdmoot onder de titel. Kleur (blauw partial / groen full)
     wordt nog steeds inline op de Text geset. */
  statePill: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.65,
    letterSpacing: 0,
    marginTop: 6,
  },

  /* Progress */
  progressWrap: { marginTop: 24, marginHorizontal: 0 },
  progressHitArea: { paddingVertical: 12 },
  progressTrack: {
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: C.accent },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  time: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  /* Iter v189 (2026-07-02): preview countdown pill tussen huidige tijd en
     totale duur. Blauw accent voor zichtbaarheid zonder visueel schreeuwend. */
  previewCountdown: {
    color: '#3a8fff',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  /* Resume panel */
  resumePanel: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
  },
  resumeBtn: {
    flex: 1,
    backgroundColor: C.accent,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  resumeBtnAlt: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: C.border,
  },
  resumeGlyph: { color: C.text, fontSize: 18, fontWeight: '700' },
  resumeText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  resumeSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },

  /* Skip + play */
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 24,
    gap: 48,
  },
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
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 48,
    includeFontPadding: false,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  /* Subtle dim wanneer disabled (tijdens loading / awaiting-resume) zodat
     het visueel duidelijk is dat de tap niet werkt. Combineert met de
     spinner-vervanging van de play-glyph hierboven. */
  playBtnDisabled: {
    opacity: 0.65,
  },
  playGlyph: { color: C.text, fontSize: 28, fontWeight: '700' },

  /* Extras row */
  extrasRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 48,
    marginBottom: 24,
  },
  extraBtn: { alignItems: 'center', minWidth: 56 },
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
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '600',
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
  speedText: { color: C.text, fontSize: 14, fontWeight: '700' },

  /* CTA */
  cta: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: C.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
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
  ctaText: { color: C.text, fontSize: 15, fontWeight: '700' },

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
    borderColor: 'rgba(255,255,255,0.1)',
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
    fontWeight: '700',
  },
  modalBody: {
    color: 'rgba(255,255,255,0.7)',
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
    backgroundColor: C.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  modalPrimaryText: { color: C.text, fontSize: 15, fontWeight: '700' },
  modalSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  modalSecondaryText: { color: C.text, fontSize: 15, fontWeight: '600' },

  /* Ended-paneel ("Play next?") — modal-achtig over de player */
  endedCard: {
    backgroundColor: 'rgba(20,20,25,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 24,
    maxWidth: 360,
    width: '100%',
  },
  endedEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  endedSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 6,
  },
  endedTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
    lineHeight: 24,
  },
  endedSeries: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
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
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  endedDoneText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  endedPlayNext: {
    flex: 1,
    backgroundColor: C.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    alignItems: 'center',
  },
  endedPlayNextText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
