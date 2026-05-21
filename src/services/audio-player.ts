/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Audio Player Service (singleton)

   WAAROM EEN SERVICE: De player-UI in src/app/player.tsx mag minimaliseren
   zonder dat audio stopt (spec TAAK 3 §"GEDRAG — STANDAARD CONTROLS"). Als
   `Audio.Sound` in het component-state zou wonen, zou unmount → audio
   stoppen. Door 'm op module-niveau te beheren overleeft de sound elke
   navigatie. Komende mini-player taak hoeft alleen deze service te
   consumeren — geen tweede `createAsync`-locatie te bouwen.

   STATE:
     - `state` = enkele snapshot (PlayerState). Listener-pattern (zelfde
       als history.ts / useFavorites.ts / vzp.ts) zorgt voor re-render.
     - `sound` = de actieve `Audio.Sound`. null wanneer niets geladen is.
     - `playingRef` / `trackingActive` = bookkeeping voor history-flushes
       (analoog aan de oude refs in player.tsx).

   PREVIEW-MODE (PRO sessie + guest):
     - Backend signt met `?preview=true` zonder JWT (curl-bevestigd
       2026-05-20). Client enforce't de 30-sec cap zelf via positionMs.
     - Bij cap: pauzeer + zet `previewBlocked = true`. UI toont upsell.

   RESUME (vzp_v1):
     - loadSession() checkt `getSavedPosition`. > 4s → `awaitingResume = true`,
       sound start NIET (shouldPlay: false). UI toont Continue / Start over.
     - continueFromSaved() / startOver() doen seek + play.
     - Bij pause via onStatus: positie wordt vastgelegd. Bij ended of
       Start over: positie wordt gewist.

   CLOSE vs MINIMIZE:
     - close → unload() (slaat positie op + lost Audio.Sound op).
     - minimize → niks; audio blijft spelen, service-state behoudt sessie.
   ─────────────────────────────────────────────────────────────────────── */

import { getSignedAudioUrl, SignedUrlError } from '@/utils/audio-url';
import { endListen, pauseListen, startListen } from '@/utils/history';
import { getNextSession } from '@/utils/next-session';
import { getSetting } from '@/utils/settings';
import {
  clearSavedPosition,
  getSavedPosition,
  setSavedPosition,
} from '@/utils/vzp';
import { Audio } from 'expo-av';
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

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
  /** Serie-naam van de zojuist afgespeelde sessie — gebruikt door UI in
   *  de "Series complete · You've finished X"-tekst. */
  finishedSeries: string;
};

export type PlayerState = {
  /** Sessie die momenteel geladen is — null = niets actief. */
  session: SessionInfo | null;
  loading: boolean;
  playing: boolean;
  positionMs: number;
  durationMs: number;
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

const PREVIEW_CAP_MS = 30 * 1000;
/* Positie wordt pas opgeslagen onder vzp_v1 vanaf 4s en alleen als we niet
   binnen 1s van het einde zitten (= effectief aan de finish). */
const SAVE_MIN_MS = 4 * 1000;
const SAVE_END_MARGIN_MS = 1 * 1000;

const initialState: PlayerState = {
  session: null,
  loading: false,
  playing: false,
  positionMs: 0,
  durationMs: 0,
  rate: 1.0,
  preview: false,
  previewBlocked: false,
  awaitingResume: false,
  savedPositionSec: 0,
  errorMessage: null,
  endedPanel: null,
};

/** [OPERATOR] Tot Supabase-auth + entitlement-detectie in de RN-app
 *  zitten: alle users = guest. PRO sessies krijgen daarom preview:true.
 *  Eén plek om aan te passen wanneer de check er wel is. */
function shouldPreview(session: SessionInfo): boolean {
  return !session.isFree;
}

let state: PlayerState = { ...initialState };
let sound: Audio.Sound | null = null;
let playingRef = false;
let trackingActive = false;
let sleepTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

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
  const pos = state.positionMs;
  if (pos < SAVE_MIN_MS) return;
  const dur = state.durationMs;
  /* Niet opslaan als we effectief aan het einde zitten (anders krijg je
     "Continue 19:59" terwijl track op 0 hoorde te starten). */
  if (dur > 0 && pos >= dur - SAVE_END_MARGIN_MS) return;
  setSavedPosition(url, Math.floor(pos / 1000));
}

/* ── expo-av status callback ────────────────────────────────────────────── */

function onStatus(st: any) {
  if (!st?.isLoaded) {
    if (st?.error) setState({ errorMessage: String(st.error) });
    return;
  }

  const isPlayingNow = !!st.isPlaying;
  const posMs = st.positionMillis ?? 0;
  setState({
    playing: isPlayingNow,
    positionMs: posMs,
    durationMs: st.durationMillis ?? 0,
  });

  /* Preview-cap → pauze + UI-modal. Eenmalig triggeren. */
  if (
    state.preview &&
    !state.previewBlocked &&
    posMs >= PREVIEW_CAP_MS &&
    isPlayingNow
  ) {
    sound?.pauseAsync().catch(() => {});
    setState({ previewBlocked: true });
  }

  /* History-hooks — zelfde transitie-logica als voorheen in player.tsx. */
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
     volgende sessie OF panel-state zetten zodat UI de "Play next?"-prompt
     kan tonen. Preview-mode komt hier nooit aan (cap pauzeert vóór einde). */
  if (st.didJustFinish) {
    if (trackingActive) endListen();
    const finishedSession = state.session;
    if (finishedSession) clearSavedPosition(finishedSession.url);
    trackingActive = false;
    playingRef = false;

    if (!finishedSession) {
      setState({ playing: false });
      return;
    }

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
      /* Fire-and-forget. loadSession reset state. We hoeven hier verder
         niks te doen. */
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
  if (state.session?.url === session.url && sound) {
    return;
  }

  await unload();

  const preview = !!opts.preview;
  const savedSec = getSavedPosition(session.url);
  const shouldShowResume = savedSec > 4;

  setState({
    session,
    loading: true,
    playing: false,
    positionMs: 0,
    durationMs: 0,
    rate: 1.0,
    preview,
    previewBlocked: false,
    awaitingResume: shouldShowResume,
    savedPositionSec: savedSec,
    errorMessage: null,
  });

  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const signedUrl = await getSignedAudioUrl(session.url, { preview });
    const created = await Audio.Sound.createAsync(
      { uri: signedUrl },
      { shouldPlay: !shouldShowResume },
      onStatus
    );
    sound = created.sound;
    setState({ loading: false });
  } catch (e: any) {
    let msg = e?.message ?? String(e);
    if (e instanceof SignedUrlError) {
      msg = `[${e.code}] ${e.message}`;
    }
    console.warn('[audio-player] load failed:', msg);
    setState({ loading: false, errorMessage: msg });
  }
}

export async function pauseAudio(): Promise<void> {
  if (!sound) return;
  try {
    await sound.pauseAsync();
  } catch {}
}

export async function resumeAudio(): Promise<void> {
  if (!sound || state.previewBlocked) return;
  try {
    await sound.playAsync();
  } catch {}
}

export async function togglePlay(): Promise<void> {
  if (!sound) return;
  if (state.playing) return pauseAudio();
  /* Sessie eindigde, gebruiker tikt nu play → start opnieuw vanaf 0.
     "tap = start opnieuw" zoals spec voorschrijft voor Done-state. */
  if (
    state.durationMs > 0 &&
    state.positionMs >= state.durationMs - 100
  ) {
    await seekTo(0);
  }
  return resumeAudio();
}

export async function seekTo(positionSec: number): Promise<void> {
  if (!sound) return;
  const ms = Math.max(0, Math.floor(positionSec * 1000));
  try {
    await sound.setPositionAsync(ms);
  } catch {}
}

/** Skip ±N sec, geclampt op [0, duration]. */
export async function skipBy(deltaSec: number): Promise<void> {
  const max = state.durationMs > 0 ? state.durationMs : Number.MAX_SAFE_INTEGER;
  const targetMs = Math.max(0, Math.min(max, state.positionMs + deltaSec * 1000));
  await seekTo(targetMs / 1000);
}

export async function setRate(rate: number): Promise<void> {
  if (!sound) return;
  try {
    await sound.setRateAsync(rate, true);
    setState({ rate });
  } catch {}
}

/** UI klikt Continue — speel verder vanaf saved position. */
export async function continueFromSaved(): Promise<void> {
  if (!state.session || !state.awaitingResume) return;
  await seekTo(state.savedPositionSec);
  setState({ awaitingResume: false });
  await resumeAudio();
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
 *  sound geladen (full-player toont sessie aan einde, tap play = start
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
 * Audio stoppen + unloadAsync + sluit timers af. Slaat eerst de positie op
 * voor de actieve sessie zodat "Close → later opnieuw openen" Continue
 * laat zien op de juiste plek.
 */
export async function unload(): Promise<void> {
  clearSleepTimer();
  saveCurrentPositionIfWorthwhile();
  if (trackingActive) {
    pauseListen();
    trackingActive = false;
  }
  playingRef = false;
  if (sound) {
    try {
      await sound.unloadAsync();
    } catch {}
    sound = null;
  }
  state = { ...initialState };
  notify();
}

/** Read-only snapshot, voor non-React consumers. */
export function getSnapshot(): PlayerState {
  return state;
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

/* ── AppState cleanup — mitigatie voor expo-av lifecycle-bug ────────────
   Bekend probleem in expo-av 16.x op Android: `AVManager.onHostDestroy`
   wordt door RN op een thread-pool-thread aangeroepen ipv main. Als er
   op dat moment nog een geladen Audio.Sound is, faalt `ExoPlayer.release()`
   met "Player is accessed on the wrong thread", waarna het OS bij de
   volgende app-start nog steeds bezig is met cleanup → app crasht in
   het opstart-pad.

   Onze mitigatie: zodra de app naar background/inactive gaat, lossen wij
   de sound ZELF op via het JS-thread (bridge → native main looper, geen
   ExoPlayer-assertion). Tegen de tijd dat het OS onHostDestroy aanroept,
   is er niets meer om te releasen. Geen race meer mogelijk.

   Bijwerking: audio stopt wanneer de gebruiker de app naar de achtergrond
   stuurt. Acceptabel — CLAUDE.md §SPEC zegt dat background-audio een
   aparte taak is die later komt.

   Geregistreerd op module-load (eenmalig). De listener wordt nooit
   verwijderd — service draait de hele app-lifetime. */
function onAppStateChange(next: AppStateStatus): void {
  if (next === 'background' || next === 'inactive') {
    if (sound) {
      unload().catch(() => {
        /* swallow — wat er ook misgaat, beter dan crash bij host-destroy */
      });
    }
  }
}
AppState.addEventListener('change', onAppStateChange);

