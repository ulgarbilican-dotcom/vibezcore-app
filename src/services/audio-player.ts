/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Audio Player Service (singleton, expo-audio)

   MIGRATIE 2026-05-23: expo-av → expo-audio (operator-besluit). Reden:
   expo-av is deprecated, wordt verwijderd in SDK 55 en gaf crashes
   ("Player is accessed on the wrong thread" tijdens AVManager.onHostDestroy)
   bij JS-reload en lifecycle-events. expo-audio is z'n eigen
   lifecycle-manager en is bedoeld voor New Architecture.

   WAAROM EEN SERVICE: De player-UI in src/app/player.tsx mag minimaliseren
   zonder dat audio stopt. Als de player in een component-hook zou wonen,
   zou unmount → audio stoppen. Door 'm op module-niveau te beheren via
   `createAudioPlayer()` (de imperative API, niet de hook) overleeft de
   sessie elke navigatie. MiniPlayer + Library re-consumeren dezelfde
   singleton via `usePlayerState()`.

   STATE:
     - `state` = enkele snapshot (PlayerState). Listener-pattern (zelfde
       als history.ts / useFavorites.ts / vzp.ts) zorgt voor re-render.
     - `player` = de actieve `AudioPlayer`. null wanneer niets geladen is.
     - `playingRef` / `trackingActive` = bookkeeping voor history-flushes.

   TIJD-EENHEDEN (breaking change t.o.v. de expo-av-versie):
     - expo-av leverde positionMillis / durationMillis (ms).
     - expo-audio levert currentTime / duration in SECONDEN (float).
     - PlayerState velden hernoemd: positionSec / durationSec.
     - PREVIEW_CAP, SAVE_MIN, SAVE_END_MARGIN allemaal in seconden.

   PREVIEW-MODE (PRO sessie + guest):
     - Backend signt met `?preview=true` zonder JWT. Client enforce't 30s
       cap zelf via positionSec.
     - Bij cap: pauzeer + zet `previewBlocked = true`. UI toont upsell.

   RESUME (vzp_v1):
     - loadSession() checkt `getSavedPosition`. > 4s → `awaitingResume = true`,
       player start NIET. UI toont Continue / Start over.
     - continueFromSaved() / startOver() doen seek + play.
     - Bij pause via onStatus: positie wordt vastgelegd. Bij ended of
       Start over: positie wordt gewist.

   CLOSE vs MINIMIZE:
     - close → unload() (slaat positie op + verwijdert AudioPlayer-instance).
     - minimize → niks; audio blijft spelen, service-state behoudt sessie.

   LOCK SCREEN / NOTIFICATION SHADE:
     - Bij elke loadSession() roepen we `player.setActiveForLockScreen(true,
       metadata)` aan. Metadata komt uit SERIES_PHOTO (artworkUrl) +
       SERIES_SUBTITLE (artist) + session.title. Vereist (door
       expo-audio docs): interruptionMode 'doNotMix' — anders koppelt het
       OS de lock-screen-controls niet aan onze player en stopt audio op
       Android na ~3 min in background.
     - Op Android wordt ook permission voor notifications gevraagd
       (één keer, fire-and-forget bij eerste loadSession).
   ─────────────────────────────────────────────────────────────────────── */

import { getCachedSubscription } from '@/hooks/useSubscription';
import {
  SERIES_PHOTO,
  SERIES_SUBTITLE,
} from '@/data/audio-library-data';
import { getSignedAudioUrl, SignedUrlError } from '@/utils/audio-url';
import { endListen, pauseListen, startListen } from '@/utils/history';
import { getNextSession } from '@/utils/next-session';
import { getSetting } from '@/utils/settings';
import { clearLastPlayed, setLastPlayed } from '@/utils/last-played';
import {
  clearSavedPosition,
  getSavedPosition,
  setSavedPosition,
} from '@/utils/vzp';
import {
  type AudioPlayer,
  type AudioStatus,
  createAudioPlayer,
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { useEffect, useState } from 'react';

export type SessionInfo = {
  url: string;
  title: string;
  series: string;
  isFree: boolean;
  desc: string;
};

/** Eindpaneel-snapshot. `nextSession` is null wanneer dit de laatste was
 *  binnen serie of subserie — UI toont dan "Series complete" en alleen
 *  een Done-knop. */
export type EndedPanel = {
  hasNext: boolean;
  nextSession: SessionInfo | null;
  finishedSeries: string;
};

export type PlayerState = {
  /** Sessie die momenteel geladen is — null = niets actief. */
  session: SessionInfo | null;
  loading: boolean;
  playing: boolean;
  /** Positie in SECONDEN (float). Hernoemd 2026-05-23 van positionMs. */
  positionSec: number;
  /** Duur in SECONDEN (float). Hernoemd 2026-05-23 van durationMs. */
  durationSec: number;
  rate: number;
  /** True wanneer deze sessie als preview gesignt is (PRO + guest). */
  preview: boolean;
  /** True wanneer de 30-sec cap getriggerd is. UI toont upsell-modal. */
  previewBlocked: boolean;
  /** True wanneer er een saved position > 4s bestaat en we nog niet hebben
   *  gestart. UI toont Continue / Start over en verbergt progress-bar. */
  awaitingResume: boolean;
  /** Saved position in seconden — alleen relevant als awaitingResume=true. */
  savedPositionSec: number;
  /** Laatste fout-bericht (sign/load). null wanneer geen fout. */
  errorMessage: string | null;
  /** Niet-null vanaf didJustFinish wanneer autoPlayNext UIT staat. UI
   *  toont "Play next?"-prompt. Wordt gewist door dismissEndedPanel()
   *  of door een nieuwe loadSession. */
  endedPanel: EndedPanel | null;
};

const PREVIEW_CAP_SEC = 60; // operator-keuze 2026-05-27: 30s te kort voor Calm-modes, 60s geeft echte feel
/* Positie wordt pas opgeslagen onder vzp_v1 vanaf 4 sec en alleen als we
   niet binnen 1 sec van het einde zitten (= effectief aan de finish). */
const SAVE_MIN_SEC = 4;
const SAVE_END_MARGIN_SEC = 1;
/* Tolerantie voor "ben ik klaar?"-detectie in togglePlay (0.1 s ≈ 100 ms
   in de oude ms-versie). */
const END_OF_TRACK_TOLERANCE_SEC = 0.1;

const initialState: PlayerState = {
  session: null,
  loading: false,
  playing: false,
  positionSec: 0,
  durationSec: 0,
  rate: 1.0,
  preview: false,
  previewBlocked: false,
  awaitingResume: false,
  savedPositionSec: 0,
  errorMessage: null,
  endedPanel: null,
};

/**
 * Bepaalt of we de signing-call met `?preview=true` moeten doen. PRO-users
 * krijgen nooit een preview-cap, guests wel voor PRO content.
 * Sync — leest huidige cached subscription-status uit useSubscription.
 */
function shouldPreview(session: SessionInfo): boolean {
  if (session.isFree) return false;
  return !getCachedSubscription()?.active;
}

let state: PlayerState = { ...initialState };
let player: AudioPlayer | null = null;
/** Subscription op de player's playbackStatusUpdate-event. Bewaard zodat
 *  unload() 'm netjes kan afmelden. */
let statusSubscription: { remove: () => void } | null = null;
let playingRef = false;
let trackingActive = false;
let sleepTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
/* ── Finish-listeners (apart van state-listeners) ───────────────────────
   State-listeners firen op ELKE state-mutatie (~4x/sec tijdens playback).
   Voor een finish-event willen we precies één callback op het exacte
   moment van didJustFinish (= natural end-of-file). Eigen subscriber-
   set, identiek pattern. Gebruikt door BraceletUpsellModal-trigger in
   (tabs)/index.tsx — losgekoppeld van PlayerState om de service-API
   niet te vervuilen met cross-product upsell-state.

   Payload: de SessionInfo van de zojuist afgespeelde sessie (in het
   geval consumers willen filteren op series/free/etc). */
type FinishListener = (session: SessionInfo) => void;
const finishListeners = new Set<FinishListener>();

/** Audio-mode wordt één keer per app-lifetime gezet. Idempotent in principe,
 *  maar onnodige native-calls vermijden we. */
let audioModeConfigured = false;
/** Laatste position (sec) waarop we last-played hebben weggeschreven tijdens
 *  een actieve playback-loop. Wordt elke ~10s opnieuw gezet zodat de Continue-
 *  card ook na een OS-kill-tijdens-spelen redelijk recent is (vzp_v1 zit
 *  alleen op pauze, kan zo van een track die de user 20min heeft beluisterd
 *  niets weten als 'ie nooit gepauzeerd is). Reset bij elke loadSession. */
let lastPeriodicWritePosSec = -Infinity;
const PERIODIC_WRITE_INTERVAL_SEC = 10;
/** Notification-permission wordt één keer per app-lifetime gevraagd
 *  (Android — voor de media-controls in de notification shade). */
let notifPermissionAsked = false;

function notify() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  notify();
}

function clearSleepTimer() {
  if (sleepTimer) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
  }
}

function saveCurrentPositionIfWorthwhile() {
  if (!state.session) return;
  const url = state.session.url;
  const pos = state.positionSec;
  if (pos < SAVE_MIN_SEC) return;
  const dur = state.durationSec;
  /* Niet opslaan als we effectief aan het einde zitten (anders krijg je
     "Continue 19:59" terwijl track op 0 hoorde te starten). */
  if (dur > 0 && pos >= dur - SAVE_END_MARGIN_SEC) return;
  setSavedPosition(url, Math.floor(pos));
  /* Library Continue-card: één-entry tracker, parallel aan vzp_v1. vzp
     is webapp-shared (per-URL Map); last-played is RN-only en houdt
     enkel de meest-recente in-progress sessie + metadata bij zodat de
     card niet hoeft te joinen met history.ts/SERIES_PHOTO bij iedere
     library-mount. */
  setLastPlayed({
    url,
    title: state.session.title,
    series: state.session.series,
    isFree: state.session.isFree,
    positionSec: Math.floor(pos),
    durationSec: Math.floor(dur),
  });
}

/* ── Audio-mode (eenmalig) ─────────────────────────────────────────────── */

async function ensureAudioMode(): Promise<void> {
  if (audioModeConfigured) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      /* doNotMix is VERPLICHT door expo-audio voor setActiveForLockScreen
         (en daarmee voor > 3min background-audio op Android). Operator-
         besluit 2026-05-23: focus-content rechtvaardigt exclusive focus —
         zelfde gedrag als Spotify / Apple Podcasts. */
      interruptionMode: 'doNotMix',
    });
    audioModeConfigured = true;
  } catch (e) {
    /* Niet-fataal — meeste platforms zullen sane defaults gebruiken.
       Log alleen voor diagnostiek. */
    console.warn('[audio-player] setAudioModeAsync failed:', e);
  }
}

async function ensureNotifPermission(): Promise<void> {
  if (notifPermissionAsked) return;
  notifPermissionAsked = true;
  try {
    /* Android 13+ vereist POST_NOTIFICATIONS-runtime-permissie om de
       media-controls in de notification shade te tonen. iOS negeert dit
       (lock-screen controls werken daar via de Now Playing-infrastructuur). */
    await requestNotificationPermissionsAsync();
  } catch {
    /* User declined of platform supported het niet — geen fataal pad,
       audio speelt nog steeds, alleen de notification-shade kan ontbreken. */
  }
}

/* ── Status-callback ────────────────────────────────────────────────────── */

function onStatus(st: AudioStatus): void {
  if (!st.isLoaded) {
    /* expo-audio rapporteert errors niet meer als een veld op AudioStatus.
       Hier alleen "nog niet geladen" — laat loading-flag staan, geen
       state-change nodig. */
    return;
  }

  const isPlayingNow = !!st.playing;
  const posSec = Number.isFinite(st.currentTime) ? st.currentTime : 0;
  const durSec = Number.isFinite(st.duration) ? st.duration : 0;

  setState({
    playing: isPlayingNow,
    positionSec: posSec,
    durationSec: durSec,
  });

  /* Lock-screen-metadata aggressief re-applyen — op ELKE status-update.
     Reden: expo-audio's interne MediaSession leest ID3-tags uit het mp3-
     bestand en SYNCT die naar de OS-lock-screen op meerdere lifecycle-
     momenten (load, prepare, play-state transitie, etc). Eén-keer
     toepassen na isLoaded werd in de praktijk later weer overschreven
     met "Andrew Huberman 1. Neural State Control" (filename-derived) +
     "Vibezcore Podcasts PodcastleAI" (ID3 artist-tag). Door op iedere
     status-tick (4/sec bij updateInterval 250ms) onze waarden door te
     zetten, winnen we elke race tegen native ID3-syncs. Idempotent op
     visueel niveau (zelfde strings), minimale native-call overhead. */
  if (state.session && player) {
    const s = state.session;
    try {
      player.updateLockScreenMetadata({
        title: s.title,
        artist: SERIES_SUBTITLE[s.series] ?? s.series,
        albumTitle: s.series,
        artworkUrl: SERIES_PHOTO[s.series],
      });
    } catch {
      /* swallow — niet kritiek, alleen visueel op de OS-UI */
    }
  }

  /* Periodische last-played write tijdens actieve playback. Schrijft
     elke ~10 sec (4 ticks/sec * 10 = 40 ticks) zodat de Continue-card
     ook overleeft als de OS de app kilt zonder dat de user gepauzeerd
     heeft. Vzp_v1 NIET aanraken hier — die houdt z'n web-app-shared
     "save on pause"-semantiek; alleen last-played is RN-only.

     Threshold check ipv simpele tick-counter: na een seek (skip forward
     5min) willen we ook direct opnieuw schrijven, niet "wachten op 10s
     normale playback". */
  if (
    isPlayingNow &&
    state.session &&
    posSec >= SAVE_MIN_SEC &&
    (durSec === 0 || posSec < durSec - SAVE_END_MARGIN_SEC) &&
    Math.abs(posSec - lastPeriodicWritePosSec) >= PERIODIC_WRITE_INTERVAL_SEC
  ) {
    lastPeriodicWritePosSec = posSec;
    setLastPlayed({
      url: state.session.url,
      title: state.session.title,
      series: state.session.series,
      isFree: state.session.isFree,
      positionSec: Math.floor(posSec),
      durationSec: Math.floor(durSec),
    });
  }

  /* Preview-cap → pauze + UI-modal. Eenmalig triggeren. */
  if (
    state.preview &&
    !state.previewBlocked &&
    posSec >= PREVIEW_CAP_SEC &&
    isPlayingNow
  ) {
    player?.pause();
    setState({ previewBlocked: true });
  }

  /* History-hooks — zelfde transitie-logica als voorheen. */
  if (isPlayingNow && !playingRef && state.session) {
    startListen(state.session.url, state.session.title, state.session.series);
    trackingActive = true;
  }
  if (!isPlayingNow && playingRef && trackingActive) {
    pauseListen();
  }

  /* Saved position — alleen bij echte pauze (niet bij einde). */
  if (!isPlayingNow && playingRef && state.session && !st.didJustFinish) {
    saveCurrentPositionIfWorthwhile();
  }

  playingRef = isPlayingNow;

  /* Ended → full=true via endListen, vzp wissen, dan beslis: auto-play
     volgende sessie OF panel-state zetten. Preview-mode komt hier nooit
     aan (cap pauzeert vóór einde). */
  if (st.didJustFinish) {
    if (trackingActive) endListen();
    const finishedSession = state.session;
    if (finishedSession) clearSavedPosition(finishedSession.url);
    /* Sessie voltooid → Continue-card moet 'm niet meer aanbieden. */
    clearLastPlayed();
    trackingActive = false;
    playingRef = false;

    if (!finishedSession) {
      setState({ playing: false });
      return;
    }

    /* Notify finish-listeners (BraceletUpsellModal etc.) BEFORE we
       evaluate auto-play / endedPanel. Beide paden moeten de event-
       emission triggeren — een PRO-user met autoPlayNext aan moet ook
       de upsell krijgen (cooldown van 24u handelt frequentie af). */
    finishListeners.forEach((l) => {
      try {
        l(finishedSession);
      } catch {
        /* swallow — een listener mag de audio-flow nooit breken */
      }
    });

    const nextSess = getNextSession(finishedSession.url);
    const nextInfo: SessionInfo | null = nextSess
      ? {
          url: nextSess.url,
          title: nextSess.title,
          series: nextSess.series,
          isFree: nextSess.free,
          desc: nextSess.desc,
        }
      : null;

    if (getSetting('autoPlayNext') && nextInfo) {
      /* Fire-and-forget. loadSession reset state. */
      loadSession(nextInfo, { preview: shouldPreview(nextInfo) });
      return;
    }

    setState({
      playing: false,
      endedPanel: {
        hasNext: nextInfo != null,
        nextSession: nextInfo,
        finishedSeries: finishedSession.series,
      },
    });
  }
}

/* ── Lock-screen metadata ──────────────────────────────────────────────── */

function activateLockScreen(session: SessionInfo): void {
  if (!player) return;
  const artworkUrl = SERIES_PHOTO[session.series];
  const artist = SERIES_SUBTITLE[session.series] ?? session.series;
  try {
    player.setActiveForLockScreen(true, {
      title: session.title,
      artist,
      albumTitle: session.series,
      artworkUrl,
    });
  } catch (e) {
    /* setActiveForLockScreen kan op web of bepaalde devices throwen —
       het is niet kritiek voor playback, alleen voor de OS-UI. */
    console.warn('[audio-player] setActiveForLockScreen failed:', e);
  }
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Laad + start een nieuwe sessie. Indien er een saved-position > 4s
 * bestaat, laden we op pauze en zetten awaitingResume=true zodat de UI
 * eerst het Continue/Start over-panel toont.
 */
export async function loadSession(
  session: SessionInfo,
  opts: { preview?: boolean } = {}
): Promise<void> {
  // Same session already loaded? Skip — minimize+reopen scenario.
  if (state.session?.url === session.url && player) {
    return;
  }

  await unload();

  /* Periodische-write-counter resetten — anders zou een seek-back op de
     nieuwe sessie geen schrijf-trigger geven als de oude pos hoger lag. */
  lastPeriodicWritePosSec = -Infinity;

  const preview = !!opts.preview;
  const savedSec = getSavedPosition(session.url);
  const shouldShowResume = savedSec > 4;

  setState({
    session,
    loading: true,
    playing: false,
    positionSec: 0,
    durationSec: 0,
    rate: 1.0,
    preview,
    previewBlocked: false,
    awaitingResume: shouldShowResume,
    savedPositionSec: savedSec,
    errorMessage: null,
  });

  try {
    await ensureAudioMode();
    /* Notification-permission fire-and-forget; UI niet blokkeren. Eerste
       loadSession is het moment waarop de user duidelijk "wil luisteren",
       dus dit is het juiste moment om de Android-prompt te tonen. */
    ensureNotifPermission();

    const signedUrl = await getSignedAudioUrl(session.url, { preview });

    /* updateInterval 250ms ≈ 4 ticks/sec. Voldoende vloeiend voor de
       progress-bar (mini + full) zonder JS-bridge te overspoelen.
       Default is 500ms.

       AudioSource als OBJECT met `name` ipv kale string-URL: het `name`-
       veld op AudioSource voedt MediaItem.MediaMetadata.title (de bron
       die Android's notification-shade text gebruikt) — wint van ID3-
       tag-extractie door ExoPlayer. Zonder dit toonde de shade
       "Andrew Huberman 1. Neural State Control" (= ID3 TITLE tag van
       PodcastleAI's mp3-encoder) ipv onze sessie-titel.

       NB: AudioSource heeft géén equivalent voor `artist` — voor het
       artist-veld in de shade kunnen we alleen via setActiveForLockScreen/
       updateLockScreenMetadata sturen. Of ID3 wint daar nog steeds is
       een aparte vraag (test). */
    const newPlayer = createAudioPlayer(
      { uri: signedUrl, name: session.title },
      { updateInterval: 250 }
    );

    /* Status-events: identieke transitie-logica als voorheen, maar nu
       via addListener ipv de constructor-callback van expo-av. */
    statusSubscription = newPlayer.addListener(
      'playbackStatusUpdate',
      onStatus
    );

    player = newPlayer;

    /* Lock-screen metadata vóór play() — anders pakt het OS soms de
       eerste tick van Now Playing op zonder titel/artwork. */
    activateLockScreen(session);

    if (!shouldShowResume) {
      newPlayer.play();
    }

    setState({ loading: false });
  } catch (e) {
    let msg = e instanceof Error ? e.message : String(e);
    if (e instanceof SignedUrlError) {
      msg = `[${e.code}] ${e.message}`;
    }
    console.warn('[audio-player] load failed:', msg);
    setState({ loading: false, errorMessage: msg });
  }
}

export async function pauseAudio(): Promise<void> {
  if (!player) return;
  try {
    player.pause();
  } catch {}
}

export async function resumeAudio(): Promise<void> {
  if (!player || state.previewBlocked) return;
  try {
    player.play();
  } catch {}
}

export async function togglePlay(): Promise<void> {
  /* Defensieve fallback: player nog null maar wel een session in state?
     Dat betekent dat een vorige loadSession nog niet voltooid is OF dat
     'ie gefaald is. User tap = expliciete intentie om af te spelen, dus
     trigger een retry-load. Voorkomt het "eerste tap doet niks"-gevoel
     na cold-start (signed-URL fetch + native player init kan 1-3s duren). */
  if (!player && state.session && !state.loading) {
    const s = state.session;
    return loadSession(s, { preview: shouldPreview(s) });
  }
  if (!player) return; // loading of geen sessie → laat lopen
  if (state.playing) return pauseAudio();
  /* Sessie eindigde, gebruiker tikt nu play → start opnieuw vanaf 0.
     "tap = start opnieuw" zoals spec voorschrijft voor Done-state. */
  if (
    state.durationSec > 0 &&
    state.positionSec >= state.durationSec - END_OF_TRACK_TOLERANCE_SEC
  ) {
    await seekTo(0);
  }
  return resumeAudio();
}

export async function seekTo(positionSec: number): Promise<void> {
  if (!player) return;
  const clamped = Math.max(0, positionSec);
  try {
    /* expo-audio.seekTo() is async (returns Promise<void>). We awaiten zodat
       de daaropvolgende play() / state-read consistent is. */
    await player.seekTo(clamped);
  } catch {}
}

/** Skip ±N sec, geclampt op [0, duration]. */
export async function skipBy(deltaSec: number): Promise<void> {
  const max = state.durationSec > 0 ? state.durationSec : Number.MAX_SAFE_INTEGER;
  const target = Math.max(0, Math.min(max, state.positionSec + deltaSec));
  await seekTo(target);
}

export async function setRate(rate: number): Promise<void> {
  if (!player) return;
  try {
    /* expo-audio: setPlaybackRate is een synchroon void-method, optioneel
       pitch-correction quality. We laten default — sounds best voor spraak. */
    player.setPlaybackRate(rate);
    setState({ rate });
  } catch {}
}

/** UI klikt Continue — speel verder vanaf saved position.
 *
 *  BUGFIX 2026-05-25: in expo-audio is `player.seekTo()` op een
 *  freshly-created, nog-niet-spelende player onbetrouwbaar. De seek wordt
 *  silent weggegooid omdat de native audio-source nog geen actieve buffer
 *  heeft, en de daaropvolgende play() start vanaf 0. Empirisch bevestigd:
 *  resume-prompt toonde correct "1:32" maar audio begon vanaf 0.
 *
 *  Workaround: play() eerst om de audio-engine in een actieve buffer-state
 *  te dwingen, korte tick wachten, dán seekTo (werkt nu wel). Om de
 *  audible burst-vanaf-0 tijdens de transitie te onderdrukken, muten we
 *  de player tijdelijk en zetten 'm na de seek weer terug op originele
 *  volume.
 */
export async function continueFromSaved(): Promise<void> {
  if (!state.session || !state.awaitingResume) return;
  setState({ awaitingResume: false });

  if (!player || state.previewBlocked) return;

  const target = state.savedPositionSec;
  let originalVolume = 1;
  try {
    originalVolume = player.volume ?? 1;

    /* WAAROM DEZE SEQUENCE — bug-deep-dive 2026-05-25:
       expo-audio's onderliggende ExoPlayer (Android) verwerkt seekTo
       ALLEEN als de player ooit een play→pause-cycle heeft doorlopen.
       Op een freshly-created player die nog nooit gespeeld heeft is
       seek a-NO-OP, en de daaropvolgende play() begint vanaf 0. Door
       hier expliciet play→pause te doen vóór de seek, "warmen we" de
       audio-engine op naar een state waarin seek wel honoreerd wordt.
       Volume blijft 0 tijdens deze warm-up zodat de user geen
       audible-glitch van een paar honderd ms vanaf 0 hoort.

       Sequence:
         1. Mute (volume = 0)
         2. play()    — engine start audio-source loading + buffering
         3. wait 150ms — geef ExoPlayer tijd om eerste frame te
                         decoderen → "active" state
         4. pause()   — engine staat nu in paused-but-ready
         5. seekTo()  — werkt nu wel, want engine is "primed"
         6. wait 50ms — laat de seek-await daadwerkelijk effect hebben
         7. play()    — start vanaf de geseekte positie
         8. Unmute (volume = originalVolume)
       Totale audible-stilte: ~200ms. Acceptabel — niemand merkt 200ms. */
    player.volume = 0;

    player.play();
    await new Promise<void>((resolve) => setTimeout(resolve, 150));

    player.pause();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    await player.seekTo(target);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    player.play();
    /* Korte tick voor we unmuten zodat de eerste audio-samples al van
       de juiste positie komen — niet vanaf wat-er-toevallig-in-de-
       buffer-zat-pre-seek. */
    await new Promise<void>((resolve) => setTimeout(resolve, 30));

    player.volume = originalVolume;
  } catch {
    /* Defensief: als iets faalt, herstel volume zodat er niet stil
       verder gespeeld wordt. */
    try {
      if (player) player.volume = originalVolume;
    } catch {}
  }
}

/** UI klikt Start over — reset positie + wis vzp. */
export async function startOver(): Promise<void> {
  if (!state.session) return;
  const url = state.session.url;
  await seekTo(0);
  await clearSavedPosition(url);
  setState({ awaitingResume: false, savedPositionSec: 0 });
  await resumeAudio();
}

/** UI klikt Done op het "Play next?"-paneel — verberg paneel maar laat
 *  player geladen (full-player toont sessie aan einde, tap play = start
 *  opnieuw via togglePlay's end-of-track-guard hierboven). */
export function dismissEndedPanel(): void {
  setState({ endedPanel: null });
}

/** UI klikt Play next op het paneel — laad volgende sessie. */
export async function playNextFromPanel(): Promise<void> {
  const panel = state.endedPanel;
  if (!panel?.nextSession) return;
  await loadSession(panel.nextSession, {
    preview: shouldPreview(panel.nextSession),
  });
}

/** Sleep-timer: t-min in de toekomst pauzeren. t=0 → uit. */
export function setSleepTimer(minutes: number): void {
  clearSleepTimer();
  if (minutes <= 0) return;
  sleepTimer = setTimeout(() => {
    sleepTimer = null;
    pauseAudio();
  }, minutes * 60 * 1000);
}

/**
 * Audio stoppen + AudioPlayer-instance opruimen + sluit timers af. Slaat
 * eerst de positie op voor de actieve sessie zodat "Close → later opnieuw
 * openen" Continue laat zien op de juiste plek.
 */
export async function unload(): Promise<void> {
  clearSleepTimer();
  saveCurrentPositionIfWorthwhile();
  if (trackingActive) {
    pauseListen();
    trackingActive = false;
  }
  playingRef = false;

  if (statusSubscription) {
    try {
      statusSubscription.remove();
    } catch {}
    statusSubscription = null;
  }

  if (player) {
    const p = player;
    player = null;
    /* STOP-FIRST: pause() voor remove(). Bug-fix 2026-05-23: zonder deze
       expliciete pause draait de oude sessie nog een paar honderd ms door
       terwijl de NIEUWE createAudioPlayer().play() al getriggerd is —
       twee tracks gelijktijdig hoorbaar. remove() doet native cleanup
       asynchroon op een worker-thread; pause() stopt de audio-output
       direct, ongeacht wanneer remove() klaar is. */
    try {
      p.pause();
    } catch {}
    try {
      p.clearLockScreenControls();
    } catch {}
    try {
      /* remove() is destructief — daarna mag niets meer met deze instance.
         expo-audio's eigen lifecycle-handling vervangt de oude
         AppState-listener uit de expo-av-versie. */
      p.remove();
    } catch {}
  }

  state = { ...initialState };
  notify();
}

/** Read-only snapshot, voor non-React consumers. */
export function getSnapshot(): PlayerState {
  return state;
}

/**
 * Subscribe op session-finish-events (didJustFinish van expo-audio).
 * Callback ontvangt de SessionInfo van de zojuist afgespeelde track.
 * Fired één keer per natuurlijk einde, vóór auto-play-next of endedPanel-
 * state wordt gezet. Niet voor pause / seek / unload — uitsluitend
 * end-of-file.
 *
 * Returnt een unsubscribe-functie (idiomatic voor useEffect-cleanup).
 *
 * Gebruikt door BraceletUpsellModal-trigger in (tabs)/index.tsx; gebouwd
 * als losse subscriber-set (apart van state-listeners) zodat post-session
 * cross-product-upsells geen velden in PlayerState hoeven toe te voegen.
 */
export function onSessionFinish(cb: (session: SessionInfo) => void): () => void {
  finishListeners.add(cb);
  return () => {
    finishListeners.delete(cb);
  };
}

/* ── React hook ─────────────────────────────────────────────────────────── */

export function usePlayerState(): PlayerState {
  const [snapshot, setSnapshot] = useState<PlayerState>(state);
  useEffect(() => {
    const listener = () => setSnapshot({ ...state });
    listeners.add(listener);
    setSnapshot({ ...state });
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return snapshot;
}
