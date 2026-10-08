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
import { getDevUserOverride } from '@/utils/dev-user-override';
import {
  endListen,
  getEntryByUrl,
  pauseListen,
  startListen,
} from '@/utils/history';
import { logPlayEvent } from '@/utils/play-events';
import { getNextSession } from '@/utils/next-session';
import { getSetting } from '@/utils/settings';
import { clearLastPlayed, setLastPlayed } from '@/utils/last-played';
import { urlEq } from '@/utils/url-eq';
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
   niet binnen 30 sec van het einde zitten (= effectief aan de finish).
   Iter 9dq v121 (2026-06-04): marge 1s → 30s. Operator-feedback: Continue-
   prompt verscheen voor sessies die user "essentieel volledig" had
   beluisterd maar net niet de laatste seconde haalden (geen
   didJustFinish). Door 30s marge wordt een sessie als "klaar" gezien
   zodra je in de laatste 30s zit — geen save, geen Continue prompt
   volgende keer. */
const SAVE_MIN_SEC = 4;
const SAVE_END_MARGIN_SEC = 30;
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
  /* Iter v227 (2026-07-07, audit AU1): null-safe check.
     Iter v229 (2026-07-08): bundle-users hebben audio inclusive
     (braceletModel === 'bundle') — backend subscriptions-row komt via
     Netlify commit 31e5d06, maar frontend fallback zorgt dat bundle-
     users nooit preview krijgen. */
  const sub = getCachedSubscription();
  if (sub === null) return state.preview === true;
  if (sub.braceletModel === 'bundle') return false;
  /* Operator, 26 september 2026 (toegangsmodel-gat gedicht): `sub.active`
     is ook `true` tijdens de 7-dagen-trial (RevenueCat telt een trial als
     actieve entitlement) — zonder de trial-check hieronder kreeg een
     trial-user hier `shouldPreview()===false` en dus ongecapte PRO-
     playback. Bedoeld model (project-free-tier-facts, operator-bevestigd):
     trial ontgrendelt enkel 27 sessies + Breathwork, niet de PRO-
     catalogus. */
  return sub.active !== true || sub.isTrialing === true;
}

let state: PlayerState = { ...initialState };
let player: AudioPlayer | null = null;
/** Subscription op de player's playbackStatusUpdate-event. Bewaard zodat
 *  unload() 'm netjes kan afmelden. */
let statusSubscription: { remove: () => void } | null = null;
/** Iter 9dq v57 (2026-06-03, audit-finding C7): generation-teller voor
 *  loadSession. Elke loadSession() bumpt deze waarde en captured z'n
 *  "my generation". Bij elke await-yield-point controleert loadSession
 *  of we nog de actuele generatie zijn; zo niet → discard alle werk en
 *  ruim eventueel reeds-aangemaakte players op. Voorheen kon een snelle
 *  dubbel-tap (Session A, dan Session B vóór A geladen was) twee
 *  parallelle AudioPlayer-instances opleveren: A's createAudioPlayer
 *  draait door, B overschrijft `player`-ref, A's listener blijft state
 *  schrijven terwijl player niet meer naar A wijst, twee tracks
 *  gelijktijdig hoorbaar. */
let loadGeneration = 0;
let playingRef = false;
let trackingActive = false;
/* Iter 9dq v119 (2026-06-04): tracked sessie geladen via auto-play next?
   - true wanneer loadSession met opts.autoStart=true werd aangeroepen
     (i.e. chain via auto-play next aan einde vorige sessie)
   - false bij elke expliciete user-interactie (play/pause/seek) of bij
     handmatig openen van een sessie
   Doel: positie-save + history-tracking skippen voor auto-played
   sessies waar user niet mee bezig is. Operator-feedback: na 9:53
   verschijnt Continue-prompt voor sessie die user nooit explicit
   geopend heeft. */
let loadedWithAutoStart = false;
/* Iter v175 (2026-06-30): Sleep timer volledig verwijderd. Iters v171-v174
   probeerden progressief betere fallback-strategieën (dual-track → unload →
   quad-track met AppState listener) maar geen enkele werkte betrouwbaar in
   Android background/Doze. Root cause: expo-audio module's foreground-service
   negeert player.pause() ÉN unload() wanneer screen locked, plus JS-timers
   worden door Doze bevroren. Fundamenteel fixable via native MediaSession +
   AlarmManager implementation — parked voor v1.1. Beter geen sleep-feature
   dan een gebroken sleep-feature. */
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

/* Operator, 26 september 2026 (dé echte root cause, na WebSearch-bevestiging
   van het exacte React-scheduler-gedrag): "Should not already be working"
   is een React-reconciler re-entrancy-crash — "performWorkOnRoot() or
   commitRootImpl() are called re-entrantly" (React-core, niet Reanimated-
   specifiek). Hier is de trigger `onStatus`, de native playbackStatusUpdate-
   listener die 4×/seconde vuurt: die riep tot nu toe SYNCHROON `notify()`
   → elke gemounte `usePlayerState()`'s `setSnapshot()` aan, rechtstreeks
   vanuit de native-bridge-callback. Valt zo'n tick precies samen met een
   lopende React-commit (bv. een scherm-overgang naar `/player`), dan
   re-entert React z'n eigen work-loop en crasht.
   Eerdere pogingen (animaties weg, navigatie zelf uitstellen) misten dit
   — ELKE setState()-aanroep in deze service loopt via notify(), dus de
   listener-notificatie zelf moet uit de native-callback-call-stack, niet
   de aanroepende code. `setTimeout(...,0)` garandeert dat de listeners
   pas vuren nadat de huidige call-stack (incl. een eventuele lopende
   React-commit) volledig is afgerond — de standaard-fix voor exact dit
   patroon (native event handler → synchrone setState). `state` zelf blijft
   synchroon bijgewerkt (zie setState hieronder); enkel de REACT-notificatie
   schuift één tick op. */
function notify() {
  setTimeout(() => {
    listeners.forEach((l) => l());
  }, 0);
}

function setState(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  notify();
}


function saveCurrentPositionIfWorthwhile() {
  if (!state.session) return;
  /* Iter 9dq v119 (2026-06-04): skip position-save voor sessies geladen
     via auto-play next zolang user niet expliciet heeft gepauzeerd /
     speeld / geseekt. Voorkomt Continue-prompt voor sessies die user
     nooit explicit geopend heeft. */
  if (loadedWithAutoStart) return;
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
    if (__DEV__) console.warn('[audio-player] setAudioModeAsync failed:', e);
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
  /* Audit 8 okt 2026: na de voorproef-grens mag niets de audio laten
     doorspelen — ook de knoppen op het vergrendelscherm of een koptelefoon
     roepen de native play() rechtstreeks aan. */
  if (state.previewBlocked && isPlayingNow) {
    try {
      if (player) player.muted = true;
      player?.pause();
    } catch {}
  }
  if (
    isPlayingNow &&
    state.session &&
    /* Voorproef-sessies horen niet in "Last listened" (audit 8 okt 2026):
       anders hervatte "Continue" op 0:50 en kwam de betaalmuur 10 s later. */
    !state.preview &&
    /* Iter 9dq v119 (2026-06-04): skip periodic-save voor auto-played
       sessies tot user interacteert. */
    !loadedWithAutoStart &&
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

  /* Preview-cap → pauze + UI-modal. Eenmalig triggeren.
     Iter 9dq v16 (2026-06-02): in __DEV__ + override 'audio'/'pro' skippen
     we de client-side cap. Reden: backend levert volledige audio-file via
     signed URL (preview=true geeft toegang), de 60s cap is alleen client-
     side enforcement. Voor operator-tests die "PRO-experience" willen
     simuleren zonder real Supabase-account hoeft de cap dus niet te
     hitten. Echte gasten in productie hebben nooit een override → krijgen
     normale cap zoals voorheen. */
  const overridePretendsPro =
    __DEV__ &&
    (getDevUserOverride() === 'audio' || getDevUserOverride() === 'pro');
  if (
    state.preview &&
    !state.previewBlocked &&
    posSec >= PREVIEW_CAP_SEC &&
    isPlayingNow &&
    !overridePretendsPro
  ) {
    player?.pause();
    /* Operator, 8 okt 2026 (test 56): Play op het vergrendelscherm liet nog
       een fractie van een seconde horen vóór de pauze hierboven greep. Nu:
       de bediening op het vergrendelscherm verdwijnt (niets meer om op te
       tikken), en de speler staat stil (muted) zolang de grens geldt — ook
       een koptelefoonknop laat dan niets meer horen. */
    try {
      if (player) {
        player.muted = true;
        player.setActiveForLockScreen(false);
      }
    } catch {}
    setState({ previewBlocked: true });
  }

  /* History-hooks + saved-position — ZELFDE als voorheen, behalve dat
     preview-sessies (60-sec teaser voor non-PRO users die op PRO-tier
     content tikken) géén history-entries of resume-posities mogen
     opleveren.

     Iter 9dq v66 (2026-06-03, operator-feedback): de "Partly listened"-
     badge en de Continue/Start over-resume-prompt suggereerden dat de
     user bij een PRO-sessie verder kon gaan waar 'ie was — maar de cap
     stopt 'm sowieso na 60s. Cosmetisch misleidend + verwarrend bij
     volgende bezoek. Door previews uit te sluiten blijven die UI-states
     reservoir voor echte luister-engagement.

     Iter 9dq v116 (2026-06-04): overridePretendsPro toegevoegd aan de
     guard. Dev-override 'audio'/'pro' simuleert PRO-toegang maar
     realIsPro=false → state.preview=true. Zonder deze extra check
     bleef history-tracking uit voor operator-tests, terwijl ze de
     volledige audio kunnen afspelen (cap-skip hierboven). Dat verklaart
     waarom "Fully listened" niet verscheen in Audio PRO override-mode.
     Productie: __DEV__=false → overridePretendsPro=false → gedrag
     ongewijzigd. Alleen dev-flow krijgt nu correcte history. */
  if (!state.preview || overridePretendsPro) {
    /* Iter 9dq v119 (2026-06-04): voor auto-played sessies skippen we
       startListen tot user expliciet interacteert. Voorkomt phantom
       Partly-listened-entries voor sessies die alleen via auto-play
       zijn gestart maar user nooit echt geluisterd heeft. */
    if (
      isPlayingNow &&
      !playingRef &&
      state.session &&
      !loadedWithAutoStart
    ) {
      startListen(state.session.url, state.session.title, state.session.series);
      /* Anonymous aggregate play-event (popularity tracking, no PII).
         Fire-and-forget — blokkeert nooit playback. Zie play-events.ts +
         docs/supabase-play-events-migration.sql */
      logPlayEvent(state.session.url);
      trackingActive = true;
    }
    if (!isPlayingNow && playingRef && trackingActive) {
      pauseListen();
    }

    /* Saved position — alleen bij echte pauze (niet bij einde).
       saveCurrentPositionIfWorthwhile heeft eigen loadedWithAutoStart-
       guard, dus deze call is voor non-auto-started sessies. */
    if (!isPlayingNow && playingRef && state.session && !st.didJustFinish) {
      saveCurrentPositionIfWorthwhile();
    }
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
    setTimeout(() => {
      finishListeners.forEach((l) => {
        try {
          l(finishedSession);
        } catch {
          /* swallow — een listener mag de audio-flow nooit breken */
        }
      });
    }, 0);

    /* Iter 9nn: voor non-PRO users alleen volgende FREE sessie zoeken,
       niet PRO sessies. Voorkomt valse "Play next"-belofte die in een
       lege preview of upsell zou eindigen.
       Iter 9dq v14 (2026-06-02): freeOnly UIT — operator-feedback. De
       originele reden ("PRO sessies geven hard block voor Free users")
       is achterhaald sinds de backend 60s-preview ondersteunt op PRO
       content. Free + PRO override + echte PRO krijgen nu allemaal de
       volgende sessie in DEZELFDE serie. Bij PRO next:
         - Free → 60s preview → upsell modal (natuurlijke funnel)
         - PRO override → 60s preview (geen real token = geen full access)
         - Echte PRO met token → full playback
       Voorkomt dat de player onverwacht naar een totaal andere serie
       springt na een sessie. */
    if (__DEV__) console.log('[audio-player] finished session url:', finishedSession.url);
    if (__DEV__) console.log('[audio-player] autoPlayNext setting:', getSetting('autoPlayNext'));
    const nextSess = getNextSession(finishedSession.url);
    if (__DEV__) console.log('[audio-player] nextSess result:', nextSess?.title ?? 'NULL → Series complete');
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
      /* Fire-and-forget. loadSession reset state.
         Iter 9dq v18 (2026-06-02): autoStart:true → skip resume-prompt
         + start direct vanaf 0. Voorkomt dat de player blokkeert op een
         Continue/Start over-keuze tussen series-sessies. User die auto-
         play aanzet wil seamless doorspelen, niet per sessie kiezen. */
      loadSession(nextInfo, {
        preview: shouldPreview(nextInfo),
        autoStart: true,
      });
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
  /* Iter 9hhh: terug naar plain URLs — operator-besluit niet Bunny
     Optimizer ($9.5/mo) maar handmatig 1024×1024 source-jpgs uploaden
     in Bunny Storage. Geen runtime transform nodig dan, source is al
     groot genoeg voor lockscreen-widget. */
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
    if (__DEV__) console.warn('[audio-player] setActiveForLockScreen failed:', e);
  }
}

/* Iter 9fff: publieke re-activator voor lock-screen metadata.
   Aanroepbaar wanneer een interruption (call, alarm) onze OS-UI heeft
   weggehaald en we 'm willen herstellen, of na een orientation change
   die de notification-shade reset.
   Geen-op als er geen sessie is. */
export function reactivateLockScreen(): void {
  if (!state.session || !player) return;
  activateLockScreen(state.session);
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Laad + start een nieuwe sessie. Indien er een saved-position > 4s
 * bestaat, laden we op pauze en zetten awaitingResume=true zodat de UI
 * eerst het Continue/Start over-panel toont.
 *
 * Iter 9dq v18 (2026-06-02): opts.autoStart skipt de resume-prompt en
 * start direct vanaf 0. Gebruikt door auto-play-next-flow: na het einde
 * van sessie 1 wil de player seamless doorspelen naar sessie 2, niet
 * blokkeren op een Continue/Start over-keuze. Saved position wordt
 * gewist zodat 'ie ook later niet meer als "Partly listened" leest na
 * een complete auto-play-cyclus.
 */
export async function loadSession(
  session: SessionInfo,
  opts: { preview?: boolean; autoStart?: boolean } = {}
): Promise<void> {
  // Same session already loaded? Skip — minimize+reopen scenario.
  // Iter 9dq v160: urlEq i.p.v. === voor de zekerheid (encoded vs decoded
  // mismatch zou anders een onnodige re-load veroorzaken).
  if (state.session?.url && player && urlEq(state.session.url, session.url)) {
    /* Audit 8 okt 2026: dezelfde sessie, maar de gebruiker is intussen
       Premium (aankoop, inloggen, of de status kwam pas na de start binnen)
       → de voorproef-grens weg, zonder herladen. */
    if (state.preview && !opts.preview) {
      const wasBlocked = state.previewBlocked;
      setState({ preview: false, previewBlocked: false });
      if (wasBlocked) {
        try {
          player.muted = false;
        } catch {}
        activateLockScreen(session);
      }
    }
    return;
  }

  /* Iter 9dq v57 (2026-06-03, audit C7): claim een fresh generation.
     Bij elk await-punt hieronder checken we of we nog actueel zijn.
     Zo niet → discard al ons werk (inclusief een eventueel reeds
     aangemaakte newPlayer cleanen) en niet meer schrijven aan
     `state` of `player`. */
  const myGen = ++loadGeneration;

  await unload();
  if (myGen !== loadGeneration) return;

  /* Periodische-write-counter resetten — anders zou een seek-back op de
     nieuwe sessie geen schrijf-trigger geven als de oude pos hoger lag. */
  lastPeriodicWritePosSec = -Infinity;

  const preview = !!opts.preview;
  /* Iter 9dq v18: bij autoStart de saved position wissen + resume-prompt
     overslaan. Auto-play continueert door een serie; user verwacht geen
     "Continue waar je was?"-keuze per sessie. */
  if (opts.autoStart) {
    clearSavedPosition(session.url);
  }
  /* Iter 9dq v121 (2026-06-04): als deze sessie al volledig is beluisterd
     (history.full=true), wis dan een eventuele stale saved positie.
     Voorkomt Continue-prompts voor sessies die user al heeft afgemaakt
     maar waarvan een oude partial-state in storage staat (bv. data van
     vóór een fix of vóór didJustFinish een vorige keer ontbroken heeft).
     Defensief: schaadt niet voor sessies zonder entry. */
  const historyEntry = getEntryByUrl(session.url);
  if (historyEntry?.full) {
    clearSavedPosition(session.url);
  }
  /* Iter 9dq v119 (2026-06-04): markeer dat deze sessie via auto-play
     is geladen. Position-save en history-tracking blokkeren tot user
     expliciet interacteert (play/pause/seek). */
  loadedWithAutoStart = !!opts.autoStart;
  const savedSec = opts.autoStart ? 0 : getSavedPosition(session.url);
  const shouldShowResume = !opts.autoStart && savedSec > 4;

  setState({
    session,
    loading: true,
    playing: false,
    positionSec: 0,
    durationSec: 0,
    rate: 1.0,
    preview,
    previewBlocked: false,
    /* Operator ("continue-popup verschijnt telkens overal, heel
       storend"): geen blokkerende gate meer — altijd false. Player
       hervat hieronder zelf automatisch; `savedPositionSec` blijft
       bewaard zodat de UI een klein "Resumed from X:XX"-linkje kan
       tonen (zie player.tsx), niet om playback op te houden. */
    awaitingResume: false,
    savedPositionSec: savedSec,
    errorMessage: null,
  });

  try {
    await ensureAudioMode();
    if (myGen !== loadGeneration) return;
    /* Notification-permission fire-and-forget; UI niet blokkeren. Eerste
       loadSession is het moment waarop de user duidelijk "wil luisteren",
       dus dit is het juiste moment om de Android-prompt te tonen. */
    ensureNotifPermission();

    const signedUrl = await getSignedAudioUrl(session.url, { preview });
    if (myGen !== loadGeneration) return;

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

    /* Generation re-check NA createAudioPlayer (synchronous native call,
       maar tussen vorige await en nu kan toch een nieuwere loadSession
       gefired hebben). Zo ja: clean de net-aangemaakte player op zodat
       we geen ghost-instance laten draaien. */
    if (myGen !== loadGeneration) {
      try {
        newPlayer.pause();
      } catch {}
      try {
        newPlayer.remove();
      } catch {}
      return;
    }

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

    if (shouldShowResume) {
      /* Automatisch hervatten vanaf de opgeslagen positie — geen tap op
         "Continue" meer nodig. Fire-and-forget: state is al gezet,
         warmSeekTo() speelt zodra de warm-up/seek-sequence klaar is. */
      void warmSeekTo(savedSec);
    } else {
      newPlayer.play();
    }

    setState({ loading: false });
  } catch (e) {
    if (myGen !== loadGeneration) return; /* gerevoket — niet UI-vervuilen */
    let msg = e instanceof Error ? e.message : String(e);
    if (e instanceof SignedUrlError) {
      msg = `[${e.code}] ${e.message}`;
    }
    if (__DEV__) console.warn('[audio-player] load failed:', msg);
    setState({ loading: false, errorMessage: msg });
  }
}

export async function pauseAudio(): Promise<void> {
  if (!player) return;
  /* Iter 9dq v119 (2026-06-04): expliciete user-pause = engagement-
     signaal → auto-start flag clearen zodat positie + history vanaf
     nu wel getrackt worden. */
  loadedWithAutoStart = false;
  try {
    player.pause();
  } catch {}
}

export async function resumeAudio(): Promise<void> {
  if (!player || state.previewBlocked) return;
  /* Iter 9dq v119 (2026-06-04): expliciete user-resume/play =
     engagement-signaal → auto-start flag clearen. */
  loadedWithAutoStart = false;
  /* Opnieuw afspelen na "Session complete" (bv. vanuit de mini-player):
     het afsluitpaneel hoort dan weg (audit 8 okt 2026). */
  if (state.endedPanel) setState({ endedPanel: null });
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
  /* Iter 9dq v119 (2026-06-04): expliciete seek = engagement → flag clear. */
  loadedWithAutoStart = false;
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

/** Operator ("continue-popup verschijnt telkens overal, heel storend —
 *  hoe kunnen we dat anders doen?"): het blokkerende Continue/Start
 *  over-gate is weg — sessies hervatten nu ALTIJD automatisch vanaf de
 *  opgeslagen positie, zonder eerst een keuze af te dwingen (zelfde
 *  gedrag als Spotify/Apple Podcasts/YouTube). "Start over" blijft
 *  beschikbaar als een klein, niet-blokkerend tekstlinkje in de player
 *  (zie player.tsx) i.p.v. een modaal paneel.
 *
 *  Deze functie bevat de eigenlijke seek-werkwijze (zie BUGFIX-toelichting
 *  hieronder) en wordt nu vanuit `loadSession()` zelf aangeroepen zodra
 *  er een geldige saved position is, in plaats van te wachten op een tap
 *  op een "Continue"-knop die niet meer bestaat.
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
/** Gedeelde seek-werkwijze (zie toelichting hierboven) — start playback en
 *  landt "geruisloos" op `target` seconden, ongeacht of de player nog
 *  nooit heeft gespeeld. Aangeroepen door `loadSession()` zelf zodra er
 *  een geldige saved position is (automatisch hervatten, geen gate meer). */
async function warmSeekTo(target: number): Promise<void> {
  if (!player) return;
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

/**
 * Audio stoppen + AudioPlayer-instance opruimen. Slaat eerst de positie op
 * voor de actieve sessie zodat "Close → later opnieuw openen" Continue laat
 * zien op de juiste plek.
 */
export async function unload(opts: { skipSave?: boolean } = {}): Promise<void> {
  /* Iter 9dq v66 (2026-06-03): preview-sessies sluiten zonder positie
     op te slaan of history-flush. Anders zou close-and-reopen alsnog
     een Continue-prompt geven voor een sessie die toch op 60s gecapped
     is. Identiek aan onStatus-handler.
     Iter 9dq v117 (2026-06-04): overridePretendsPro toegevoegd zoals in
     onStatus (v116). Dev-override 'audio'/'pro' moet ook bij close /
     navigate-away een pauseListen-flush krijgen, anders schrijft de
     guard 'm niet weg → "Partly listened" verschijnt nooit.
     Iter 9dq v124 (2026-06-04): opts.skipSave → totale unload zonder
     vzp/history-writes. Gebruikt door Settings → Clear all local data:
     anders schrijft saveCurrentPositionIfWorthwhile de huidige positie
     TERUG naar vzp ná de clearAllSavedPositions, waardoor Continue-
     prompt blijft verschijnen. */
  const overridePretendsPro =
    __DEV__ &&
    (getDevUserOverride() === 'audio' || getDevUserOverride() === 'pro');
  if (!opts.skipSave && (!state.preview || overridePretendsPro)) {
    saveCurrentPositionIfWorthwhile();
    if (trackingActive) {
      pauseListen();
      trackingActive = false;
    }
  } else {
    /* Wel trackingActive resetten zodat een volgende non-preview-sessie
       schoon begint. */
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
