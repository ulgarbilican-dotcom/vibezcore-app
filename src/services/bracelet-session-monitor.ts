/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet session monitor (mount-onafhankelijke achtergrond-ticker)

   Operator, 17 september 2026 ("teller stopt wij minimize en verder op
   andere paginas en op lockscreen niets te zien... als ik iets zeer
   duidelijk maak, fix jij dat niet onmiddellijk"): de vorige fixes losten
   de REHYDRATIE op (correcte tijd bij terugkeer), maar niets hield de
   klok LEVEND terwijl bracelet-control zelf niet gemount was — de
   publish-effect in bracelet-control.tsx (en dus ook de MiniIndicator-
   pill) stopte simpelweg met updaten zodra dat scherm verdween, en de
   iOS-only audio-anker (session-keepalive.ts) toonde niets op Android en
   had zelf geen zichtbare "X:XX left"-content zonder bracelet-control's
   eigen tick.

   Dit is de bron-van-waarheid ONAFHANKELIJK van welk scherm gemount is:
   module-level state + een eigen setInterval (zoals de `bracelet`-
   transport-singleton in bracelet.ts en de `bracelet-session-state`-
   store al zijn) — overleeft een unmount, draait door zolang de JS-
   engine leeft (dus zolang de app in de voorgrond is, ongeacht welke tab/
   welk scherm zichtbaar is — dat dekt "verder op andere pagina's"
   volledig, zonder enige audio-truc nodig te hebben).

   Voor écht op-slot/achtergrond (waar iOS/Android de JS-engine kunnen
   pauzeren zonder een actieve achtergrond-taak): bracelet-control.tsx
   start/stopt ERNAAST nog steeds session-keepalive.ts (iOS, silent-audio-
   anker) zodat de JS-engine — en dus deze monitor — blijft draaien.
   Android-lockscreen-zichtbaarheid komt hier via een GEWONE
   expo-notifications-melding (géén MediaSession/audio-transport-
   notification zoals v238c/d op master deed — dat gaf daar een
   verwarrende eigen voortgangsbalk op de 1-seconde-stilte-lus i.p.v. de
   echte sessieduur; een platte melding heeft dat probleem niet).

   Levenscyclus wordt expliciet aangestuurd door bracelet-control.tsx's
   eigen onStart/onPause/onResume/onStop — NIET afgeleid uit mount/
   unmount, want dat is precies het onbetrouwbare mechanisme dat dit
   bestand vervangt.
   ─────────────────────────────────────────────────────────────────────── */

import { onWatchAction as onWearWatchAction } from '../../modules/wear-breath';
import { onWatchAction as onAppleWatchAction } from '../../modules/watch-breath';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { AppState, Platform } from 'react-native';
import { getBracelet, USE_SIMULATED_BLE } from './bracelet';
import { BleCommand, BraceletMode, getModeMeta } from './ble-contract';
import { recordSession } from '@/utils/bracelet-history';
import {
  addRemoteControlListener,
  dismissCompletionNotice,
  getNativeSessionStatus,
  hasNativeWaveform,
} from '../../modules/state-haptics';
import {
  isNativeSessionAlive,
  pauseModeSessionHaptic,
  playModeSessionHaptic,
  releaseSessionHapticAtNaturalEnd,
  stopModePreviewHaptic,
} from './bracelet-haptics';
import {
  clearBraceletSession,
  setBraceletSessionSnapshot,
} from './bracelet-session-state';
import { ensurePermission as ensureNotificationPermission } from './reminders';

const NOTIF_ID = 'bracelet-session';
/* ── iPhone (operator, 6 okt 2026: "bouw altijd simultaan iOS en Android") ──
   iOS laat een app NIET trillen op de achtergrond of met het scherm op slot
   (Apple: "no way to run haptics in the background"), en bevriest dan ook
   de JS-timers. Daarom op iPhone:
     · het scherm blijft wakker zolang het ritme speelt (anders vergrendelt
       het na ±30 s en valt het ritme stil zonder dat iemand weet waarom);
     · geen lopende "x left"-melding (die bleef op een oude tijd hangen);
     · de "Session complete"-melding wordt bij start/hervatten VOORAF
       ingepland op het eindmoment, zodat ze ook komt als de app op de
       achtergrond staat. Pauze/stop annuleert ze. */
const IOS_DONE_ID = 'bracelet-session-done';
const KEEP_AWAKE_TAG = 'state-control-session';

async function scheduleIosDone(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(IOS_DONE_ID);
  } catch {}
  if (!state || state.paused) return;
  const end = endTimeMs(state);
  if (end <= Date.now() + 1000) return;
  const meta = getModeMeta(state.mode);
  const minutes = Math.max(1, Math.round(state.totalSec / 60));
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: IOS_DONE_ID,
      content: {
        title: 'Session complete',
        body: `${meta.name} · ${minutes} min`,
        data: { kind: 'bracelet-done' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(end) },
    });
  } catch {
    /* geen toestemming — de app toont de afsluiting bij openen */
  }
}

async function cancelIosDone(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(IOS_DONE_ID);
  } catch {}
}

function syncIosKeepAwake(): void {
  if (Platform.OS !== 'ios') return;
  if (state && !state.paused) void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
  else void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
}
const CHANNEL_ID = 'bracelet-session';
/** Hoe vaak de in-memory snapshot (voor de pill) ververst — goedkoop,
 *  puur een JS-object + subscriber-notify, dus 1s voor een live teller. */
const TICK_MS = 1000;
/** Hoe vaak de ZICHTBARE OS-melding zelf herschreven wordt.
 *  Operator, 17 september 2026 ("moet op lockscreen kunnen volgen"): was
 *  30s — nu de banner niet meer telkens re-pop't (zie de content-aware
 *  notification-handler in _layout.tsx), kan dit korter zonder spam-
 *  gevoel. 10s = merkbaar "live" zonder elke seconde een OS-call te doen. */
const NOTIF_UPDATE_MS = 10_000;
/** Hoe vaak we de ECHTE hardware-status opvragen als veiligheidsnet —
 *  vangt battery-cut/fault/charging (spec §9) die deze monitor zelf niet
 *  kan weten, puur wall-clock-projecterend. */
const RESYNC_MS = 20_000;

type MonitorState = {
  mode: BraceletMode;
  totalSec: number;
  paused: boolean;
  /** Wall-clock start van het HUIDIGE lopende segment (null tijdens pauze). */
  runStartedAt: number | null;
  /** Al verstreken seconden vóór dit segment (opgebouwd over eerdere pauzes). */
  elapsedBeforeRunSec: number;
  /** Echte startmoment van de sessie (voor de geschiedenis). */
  startedAtIso: string;
};

/* ── Natuurlijk einde — ÉÉN bron van waarheid (5 okt 2026) ─────────────
   Audit: het scherm besliste over "afgelopen" op basis van de bracelet-
   (sim)status, de monitor op basis van de echte tijd. Bij hervatten zet de
   bracelet (spec §7.1, ook de echte firmware) de duur op minstens het
   modus-minimum → het scherm bleef tot 10 min op 0:00 hangen zonder
   afsluiting, en een sessie die afliep terwijl State Control niet op het
   scherm stond, werd nooit afgesloten of bewaard. Nu beslist enkel de
   monitor: hij stopt de bracelet op het echte einde, schrijft de
   geschiedenis en zet de afsluiting klaar (ook als niemand kijkt). */
export type SessionCompletion = { mode: BraceletMode; minutes: number };
let pendingCompletion: SessionCompletion | null = null;
const completionListeners = new Set<(c: SessionCompletion) => void>();

export function subscribeSessionCompletion(cb: (c: SessionCompletion) => void): () => void {
  completionListeners.add(cb);
  return () => {
    completionListeners.delete(cb);
  };
}

/** Haalt een afsluiting op die klaarstaat (en wist ze) — voor een scherm dat
 *  pas NA het einde gemount wordt. */
export function consumePendingCompletion(): SessionCompletion | null {
  const c = pendingCompletion;
  pendingCompletion = null;
  return c;
}

/** De lopende sessie zoals de monitor ze kent — de modus die ECHT loopt,
 *  los van wat er op de moduskeuze aangetikt staat. */
export function getBraceletMonitorSession(): {
  mode: BraceletMode;
  totalSec: number;
  startedAtIso: string;
  paused: boolean;
} | null {
  return state
    ? { mode: state.mode, totalSec: state.totalSec, startedAtIso: state.startedAtIso, paused: state.paused }
    : null;
}

/** Het moment waarop de sessie op de klok eindigt(e) — niet het moment
 *  waarop de app het merkt (die kan op slot bevroren zijn geweest). */
function endTimeMs(s: MonitorState): number {
  if (s.paused || s.runStartedAt === null) return Date.now();
  return s.runStartedAt + (s.totalSec - s.elapsedBeforeRunSec) * 1000;
}

let completing = false;

async function completeNaturally(): Promise<void> {
  const s = state;
  /* Eén keer: na ontgrendelen vuren de achterstallige tick én resync vlak
     na elkaar (audit 5 okt 2026 — anders twee keer in de geschiedenis). */
  if (!s || completing) return;
  completing = true;
  try {
    await finishCompleted(s);
  } finally {
    completing = false;
  }
}

async function finishCompleted(s: MonitorState): Promise<void> {
  const minutes = Math.max(1, Math.round(s.totalSec / 60));
  void recordSession({
    mode: s.mode,
    startedAt: s.startedAtIso,
    endedAt: new Date(Math.min(Date.now(), endTimeMs(s))).toISOString(),
    durationMin: minutes,
    plannedMin: minutes,
    status: 'completed',
  });
  const completion: SessionCompletion = { mode: s.mode, minutes };
  pendingCompletion = completion;
  /* In de app zelf toont het scherm de afsluiting; de "Session complete"-
     melding van de service is dan dubbel. */
  if (appIsForeground) {
    dismissCompletionNotice();
    void cancelIosDone();
    void Notifications.dismissNotificationAsync(IOS_DONE_ID).catch(() => {});
  }
  await stopBraceletSessionMonitor({ natural: true });
  try {
    await getBracelet().sendCommand({ mode: s.mode, duration: 0, command: BleCommand.Stop });
  } catch {
    /* Geen verbinding — de bracelet stopt zelf op zijn eigen timer. */
  }
  completionListeners.forEach((cb) => {
    try {
      cb(completion);
    } catch {
      /* een kapotte luisteraar mag de afsluiting niet breken */
    }
  });
}

let state: MonitorState | null = null;
let tickHandle: ReturnType<typeof setTimeout> | null = null;
let resyncHandle: ReturnType<typeof setInterval> | null = null;
let channelReady = false;
let lastNotifPushAt = 0;

/* Operator, 17 september 2026 ("nu krijg ik dropdown terwijl ik nog op de
   active pagina zit, dat mag niet — zolang ik in de app op de pagina's
   ben hoeft dropdown niet"): de melding hoort ENKEL te bestaan wanneer de
   gebruiker de app heeft verlaten (andere app, homescreen, lockscreen) —
   niet zolang VIBEZCORE zelf open staat, ongeacht welk tab-scherm. Volgt
   AppState hier (module-level, niet aan een component gebonden) zodat
   deze beslissing correct blijft ongeacht welk scherm net gemount is. */
let appIsForeground = AppState.currentState === 'active';
AppState.addEventListener('change', (next) => {
  const wasForeground = appIsForeground;
  appIsForeground = next === 'active';
  if (!wasForeground && appIsForeground) {
    /* Terug in de app — de melding heeft geen functie meer zolang je
       hier bent, de pill/het scherm zelf toont de tijd al. */
    void dismissNotificationOnly();
  } else if (wasForeground && !appIsForeground && state) {
    /* Naar de achtergrond — nu pas de melding tonen. */
    void publish(true);
  }
});

async function dismissNotificationOnly(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(NOTIF_ID);
  } catch {
    /* Cosmetisch. */
  }
}

function fmtMMSS(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function currentRemainingSec(): number {
  if (!state) return 0;
  const elapsed =
    state.paused || state.runStartedAt === null
      ? state.elapsedBeforeRunSec
      : state.elapsedBeforeRunSec + (Date.now() - state.runStartedAt) / 1000;
  return Math.max(0, state.totalSec - elapsed);
}

async function ensureChannel(): Promise<void> {
  if (channelReady || Platform.OS !== 'android') {
    channelReady = true;
    return;
  }
  try {
    /* LOW i.p.v. HIGH (vergelijk reminders.ts) — dit is een lopende-
       status-melding, geen "kom nu iets doen"-aanmaning; geen geluid/
       trilling nodig, wel zichtbaar op het vergrendelscherm. */
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Bracelet session',
      description: 'Shows your running bracelet session.',
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      vibrationPattern: [0],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {
    /* Cosmetisch — nooit de sessie zelf breken. */
  }
  channelReady = true;
}

/** Ververst de in-memory snapshot (pill op elke tab) — goedkoop, elke
 *  tick. Ververst de zichtbare OS-melding zelf enkel als er ≥
 *  NOTIF_UPDATE_MS verstreken is sinds de vorige keer, TENZIJ `force`
 *  (state-transitie zoals start/pause/resume/stop — die MOET meteen
 *  zichtbaar zijn, niet pas bij de volgende minuut-tick). */
async function publish(force: boolean): Promise<void> {
  if (!state) return;
  const meta = getModeMeta(state.mode);
  const remSec = currentRemainingSec();
  setBraceletSessionSnapshot({
    active: true,
    mode: state.mode,
    modeName: meta.name,
    modeColor: meta.color,
    remainingSec: remSec,
    totalSec: state.totalSec,
    paused: state.paused,
  });
  /* iPhone: geen lopende tijdmelding — zie IOS_DONE_ID bovenaan. */
  if (Platform.OS === 'ios') return;
  if (appIsForeground) {
    /* Geen melding zolang de app zelf open staat — zie de AppState-
       listener hierboven. De snapshot (pill/hydratie) is hierboven al
       bijgewerkt; alleen de OS-melding zelf slaan we over. */
    return;
  }
  /* Android met de native haptics-service: die toont zelf de vergrendel-
     scherm-melding (modus + aftellende tijd, media-stijl — een gewone
     melding zoals deze verschijnt op OneUI niet op het vergrendelscherm),
     ook gepauzeerd (met hervat-knop). Geen tweede, dubbele melding. Enkel
     als de service (nog) niet draait — bv. gepauzeerd vóór de eerste
     Play — toont deze melding de sessie. */
  if (Platform.OS === 'android' && hasNativeWaveform() && isNativeSessionAlive()) {
    try {
      await Notifications.dismissNotificationAsync(NOTIF_ID);
    } catch {
      /* cosmetisch */
    }
    return;
  }
  const now = Date.now();
  if (!force && now - lastNotifPushAt < NOTIF_UPDATE_MS) return;
  lastNotifPushAt = now;
  await ensureChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID,
      content: {
        title: meta.name,
        body: state.paused
          ? `State Control · ${fmtMMSS(remSec)} left · Paused`
          : `State Control · ${fmtMMSS(remSec)} left`,
        /* kind:'bracelet-session' — EIGEN kind, apart van de dagelijkse
           'bracelet'-reminders: de notification-handler in _layout.tsx
           gebruikt dit om de heads-up-banner te onderdrukken bij elke
           herhaalde tijd-update (anders pop't de banner elke
           NOTIF_UPDATE_MS opnieuw op, wat als spam/"tijd klopt niet"
           overkwam). reminders.ts's reminderRoute/fromResponse herkent
           dit kind ook — tikken navigeert nog steeds naar /bracelet. */
        data: { kind: 'bracelet-session' },
        sticky: Platform.OS === 'android',
        autoDismiss: false,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null, // direct tonen/vervangen, geen scheduling
    });
  } catch {
    /* Cosmetisch — nooit de sessie zelf breken. */
  }
}

function clearTimers(): void {
  if (tickHandle) clearTimeout(tickHandle);
  if (resyncHandle) clearInterval(resyncHandle);
  tickHandle = null;
  resyncHandle = null;
}

/* ── Bewaren & herstellen (audit 5 okt 2026) ───────────────────────────
   De sessie leeft anders enkel in het geheugen: ruimt Android de app op
   (bv. 's nachts na een Sleep-sessie) of herlaadt ze, dan was ze weg —
   geen geschiedenis, geen afsluiting, terwijl de native service misschien
   nog trilde. Nu staat ze op de telefoon en herstelt de monitor ze. */
const STORE_KEY = 'vzc.stateControl.session.v1';

function persist(): void {
  const s = state;
  void (s ? AsyncStorage.setItem(STORE_KEY, JSON.stringify(s)) : AsyncStorage.removeItem(STORE_KEY)).catch(
    () => {},
  );
}

/* Tick net na de omslag van elke seconde van de resterende tijd, niet op
   een vrij interval — anders slaat de teller (pill, melding) soms een
   seconde over (operator, 5 okt 2026). */
function scheduleTick(): void {
  const rem = state ? currentRemainingSec() : 0;
  const frac = rem - Math.floor(rem);
  const delay = state?.paused ? TICK_MS : Math.max(20, Math.round(frac * 1000) + 20);
  tickHandle = setTimeout(() => {
    tick();
    if (state) scheduleTick();
  }, delay);
}

function startTimers(): void {
  clearTimers();
  scheduleTick();
  resyncHandle = setInterval(() => void resync(), RESYNC_MS);
}

function isMonitorState(v: unknown): v is MonitorState {
  const o = v as MonitorState;
  return (
    !!o &&
    typeof o.mode === 'number' &&
    typeof o.totalSec === 'number' &&
    typeof o.paused === 'boolean' &&
    typeof o.elapsedBeforeRunSec === 'number' &&
    typeof o.startedAtIso === 'string'
  );
}

async function restoreFromStorage(): Promise<void> {
  let saved: MonitorState | null = null;
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    saved = isMonitorState(parsed) ? parsed : null;
  } catch {
    saved = null;
  }
  if (!saved || state) return;
  const native = Platform.OS === 'android' && hasNativeWaveform() ? getNativeSessionStatus() : 'none';
  const elapsedNow =
    saved.paused || saved.runStartedAt === null
      ? saved.elapsedBeforeRunSec
      : saved.elapsedBeforeRunSec + (Date.now() - saved.runStartedAt) / 1000;

  if (native !== 'none' || saved.paused) {
    /* De service draait nog (de app is enkel herladen), of de sessie stond
       op pauze: gewoon verder volgen, de haptiek niet opnieuw starten. */
    state = { ...saved, paused: native === 'paused' || (native === 'none' && saved.paused) };
    if (state.paused && !saved.paused) {
      state = { ...state, elapsedBeforeRunSec: Math.min(saved.totalSec, elapsedNow), runStartedAt: null };
    }
    startTimers();
    void publish(true);
    persist();
    return;
  }
  if (elapsedNow >= saved.totalSec - 5) {
    /* Afgelopen terwijl de app weg was: alsnog bewaren en de afsluiting
       klaarzetten (het scherm toont ze bij de volgende keer openen). */
    state = saved;
    await completeNaturally();
    return;
  }
  /* De app (en dus de service) werd midden in de sessie beëindigd: als
     gepauzeerd terugzetten, zodat de gebruiker kan hervatten of afsluiten. */
  state = { ...saved, paused: true, runStartedAt: null, elapsedBeforeRunSec: elapsedNow };
  startTimers();
  void publish(true);
  persist();
}

void restoreFromStorage();

function tick(): void {
  if (!state) return;
  if (!state.paused && currentRemainingSec() <= 0) {
    void completeNaturally();
    return;
  }
  void publish(false);
}

async function resync(): Promise<void> {
  if (!state || state.paused) return;
  /* De gesimuleerde bracelet is geen hardware: zijn eigen timer (afgerond
     op minuten) en nagebootste batterij mogen een sessie op de telefoon
     nooit afbreken (audit 5 okt 2026). De monitor zelf bewaakt het einde. */
  if (USE_SIMULATED_BLE) return;
  try {
    const st = await getBracelet().requestStatus();
    if (!st.sessionActive) {
      /* Hardware zegt: voorbij (battery-cut/fault/charging/natural —
         spec §9). Vertrouw de hardware, niet onze eigen projectie. Vlak bij
         het einde (de bracelet-timer startte een fractie eerder) is dat
         gewoon het natuurlijke einde — dan ook zo afsluiten. */
      if (currentRemainingSec() <= 5) void completeNaturally();
      else void stopBraceletSessionMonitor();
    }
  } catch {
    /* Geen verbinding — de sessie draait autonoom door op de hardware
       (spec §6), er valt hier niets zinnigs aan te passen zonder een
       echte statusupdate. */
  }
}

/** Start (of herstart) de monitor voor een NIEUWE sessie. Aanroepen vanuit
 *  onStart/autoStart — niet vanuit mount/unmount. */
export function startBraceletSessionMonitor(opts: {
  mode: BraceletMode;
  totalSec: number;
  /** Voor het edge-case herstarten met al verstreken tijd (zelden nodig —
      normaal 0 bij een echte nieuwe start). */
  elapsedSec?: number;
}): void {
  clearTimers();
  state = {
    mode: opts.mode,
    totalSec: opts.totalSec,
    paused: false,
    runStartedAt: Date.now(),
    elapsedBeforeRunSec: opts.elapsedSec ?? 0,
    startedAtIso: new Date().toISOString(),
  };
  pendingCompletion = null;
  /* De snapshot/pill-kant werkt sowieso ongeacht toestemming — publish nu
     meteen zodat de pill nooit hoeft te wachten. De lockscreen-melding
     zelf heeft toestemming nodig; de EERSTE keer ooit moet de gebruiker
     een systeem-dialoog beantwoorden (kan seconden duren), dus die ene
     eerste `scheduleNotificationAsync`-poging AWAIT't de toestemming
     eerst — anders vuurt 'm te vroeg af, voor de dialoog beantwoord is,
     en verschijnt er (stil, want gevangen in de try/catch) niets. Reuse
     dezelfde permission-flow als de reminders (settings.tsx/breath-
     session.tsx). */
  void publish(true);
  void (async () => {
    const granted = await ensureNotificationPermission();
    if (granted) void publish(true);
  })();
  startTimers();
  persist();
  /* onStart pauzeert meteen ("sessie start pas na Play", 27 sept) — pas
     na die synchrone pauze beslissen of er haptiek moet spelen. */
  setTimeout(syncHaptics, 0);
}

/* Haptiek hangt aan de SESSIE (deze mount-onafhankelijke monitor), niet
   aan een scherm — operator, 5 okt 2026: minimaliseren en terugkomen
   herstartte de curve. */
function syncHaptics(): void {
  syncIosKeepAwake();
  void scheduleIosDone();
  if (!state) {
    stopModePreviewHaptic();
    return;
  }
  if (state.paused) {
    pauseModeSessionHaptic();
    return;
  }
  const remSec = currentRemainingSec();
  playModeSessionHaptic(state.mode, state.totalSec - remSec, remSec);
}

/** Aanroepen vanuit onPause. Bevriest de projectie op het exacte moment. */
export function pauseBraceletSessionMonitor(): void {
  if (!state) return;
  const remSec = currentRemainingSec();
  state = {
    ...state,
    paused: true,
    elapsedBeforeRunSec: state.totalSec - remSec,
    runStartedAt: null,
  };
  persist();
  syncHaptics();
  void publish(true);
}

/** Aanroepen vanuit onResume. Hervat de projectie vanaf het pauze-moment. */
export function resumeBraceletSessionMonitor(): void {
  if (!state) return;
  state = { ...state, paused: false, runStartedAt: Date.now() };
  persist();
  syncHaptics();
  void publish(true);
}

/** Aanroepen vanuit onStop / finishSession (manual End, natural completion,
 *  fault/charging/battery-cut). Ruimt melding + snapshot op. */
export async function stopBraceletSessionMonitor(opts?: { natural?: boolean }): Promise<void> {
  /* Al gestopt → niets doen. Een tweede stop (bv. het scherm dat het einde
     ook opmerkt) zou anders het eind-signaal van de service afbreken. */
  if (!state) return;
  clearTimers();
  state = null;
  persist();
  if (opts?.natural) {
    releaseSessionHapticAtNaturalEnd();
    syncIosKeepAwake();
  } else {
    syncHaptics();
    void cancelIosDone();
  }
  clearBraceletSession();
  try {
    await Notifications.dismissNotificationAsync(NOTIF_ID);
  } catch {
    /* Cosmetisch. */
  }
}

/* ── Pauze/hervat vanaf het vergrendelscherm (5 okt 2026) ─────────────
   De service reageert zelf al meteen op de knop (ritme stil of verder);
   hier gaan de monitor (bron van waarheid) en de bracelet mee, via
   dezelfde stappen als de knoppen in de app. Eerst de monitor (synchroon),
   dan pas de bracelet: met het scherm op slot kan een bracelet-aanroep
   wachten tot het toestel ontgrendeld wordt, en de tijd mag daar niet op
   wachten. Een geopend sessiescherm luistert mee en werkt zijn eigen
   weergave bij. */
export type RemoteControlChange = { action: 'pause' | 'resume' | 'stop'; remainingSec: number };
const remoteListeners = new Set<(c: RemoteControlChange) => void>();

export function subscribeRemoteControl(cb: (c: RemoteControlChange) => void): () => void {
  remoteListeners.add(cb);
  return () => {
    remoteListeners.delete(cb);
  };
}

function notifyRemote(c: RemoteControlChange): void {
  remoteListeners.forEach((cb) => {
    try {
      cb(c);
    } catch {
      /* een kapotte luisteraar mag de sessie niet breken */
    }
  });
}

async function remotePause(): Promise<void> {
  if (!state || state.paused) return;
  const mode = state.mode;
  pauseBraceletSessionMonitor();
  notifyRemote({ action: 'pause', remainingSec: currentRemainingSec() });
  try {
    await getBracelet().sendCommand({ mode, duration: 0, command: BleCommand.Stop });
  } catch {
    /* Geen verbinding — de bracelet loopt op zijn eigen timer. */
  }
}

async function remoteResume(): Promise<void> {
  if (!state || !state.paused) return;
  const mode = state.mode;
  const remSec = currentRemainingSec();
  resumeBraceletSessionMonitor();
  notifyRemote({ action: 'resume', remainingSec: remSec });
  try {
    await getBracelet().sendCommand({
      mode,
      duration: Math.max(1, Math.ceil(remSec / 60)),
      command: BleCommand.Start,
    });
  } catch {
    /* Geen verbinding — de haptiek op de telefoon loopt al. */
  }
}

addRemoteControlListener((action) => {
  if (action === 'pause') void remotePause();
  else void remoteResume();
});

/* ── Stop vanaf het horloge (6 okt 2026) ────────────────────────────────
   Staat het State Control-scherm open, dan handelt dát de stop af precies
   zoals de End-knop (opslaan als 'stopped', bracelet stoppen, weergave).
   Staat het niet open, dan doet de monitor het zelf — zo wordt een sessie
   nooit dubbel of helemaal niet bewaard. */
async function remoteStop(): Promise<void> {
  if (!state) return;
  const remSec = currentRemainingSec();
  if (remoteListeners.size > 0) {
    notifyRemote({ action: 'stop', remainingSec: remSec });
    return;
  }
  const s = state;
  const activeSec = Math.max(0, s.totalSec - remSec);
  void recordSession({
    mode: s.mode,
    startedAt: s.startedAtIso,
    endedAt: new Date().toISOString(),
    durationMin: Math.max(1, Math.round(activeSec / 60)),
    plannedMin: Math.max(1, Math.round(s.totalSec / 60)),
    status: 'stopped',
  });
  await stopBraceletSessionMonitor();
  try {
    await getBracelet().sendCommand({ mode: s.mode, duration: 0, command: BleCommand.Stop });
  } catch {
    /* Geen verbinding — de bracelet stopt op zijn eigen timer. */
  }
}

/* Knoppen op het horloge (Wear OS én Apple Watch) — zie
   docs/WATCH_PROTOCOL.md. `bracelet` = State Control. */
const onWatchStateAction = (e: { action: string; kind: string }) => {
  if (e.kind !== 'bracelet') return;
  if (e.action === 'pause') void remotePause();
  else if (e.action === 'resume') void remoteResume();
  else if (e.action === 'stop') void remoteStop();
};
onWearWatchAction(onWatchStateAction);
onAppleWatchAction(onWatchStateAction);

/** Start een State Control-sessie meteen, los van welk scherm open staat
 *  (operator, 5 okt 2026: "Tap to start" vanuit het plan toonde soms de
 *  moduskeuze — het State Control-scherm voerde de start-vraag enkel uit bij
 *  zijn EERSTE opening). De monitor is de bron van waarheid; het scherm
 *  volgt hem en toont daarna vanzelf de lopende sessie. Loopt er al een
 *  sessie, dan gebeurt er niets (false) — de aanroeper opent die dan. */
export async function startStateControlNow(mode: BraceletMode, minutes: number): Promise<boolean> {
  if (state) return false;
  const meta = getModeMeta(mode);
  const dur = Math.max(meta.minMinutes, Math.min(meta.maxMinutes, Math.round(minutes)));
  startBraceletSessionMonitor({ mode, totalSec: dur * 60 });
  try {
    const b = getBracelet();
    if (b.getConnectionState() !== 'connected') await b.connect();
    await b.sendCommand({ mode, duration: dur, command: BleCommand.Start });
  } catch {
    /* Geen bracelet bereikbaar — de haptiek op de telefoon loopt al. */
  }
  return true;
}

export function isBraceletSessionMonitorActive(): boolean {
  return state !== null;
}

/** Live-berekende resterende seconden, EXACT op het moment van aanroepen —
 *  niet de (tot 1s verouderde) laatst-gepubliceerde snapshot. Operator,
 *  17 september 2026 ("2 à 3 seconden minder bij minimize"): bracelet-
 *  control.tsx's rehydratie las voorheen `bracelet-session-state`'s
 *  snapshot, die alleen bij elke monitor-tick (1x/seconde) ververst wordt
 *  — dus tot een volle seconde verouderd, bovenop echte navigatietijd.
 *  Deze functie sluit dat gat volledig: een fresh mount rekent nu vanaf
 *  het exacte huidige moment, niet vanaf de vorige tick. */
export function getBraceletMonitorRemainingSec(): number | null {
  return state ? currentRemainingSec() : null;
}
