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

import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { getBracelet } from './bracelet';
import { BraceletMode, getModeMeta } from './ble-contract';
import {
  clearBraceletSession,
  setBraceletSessionSnapshot,
} from './bracelet-session-state';
import { ensurePermission as ensureNotificationPermission } from './reminders';

const NOTIF_ID = 'bracelet-session';
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
};

let state: MonitorState | null = null;
let tickHandle: ReturnType<typeof setInterval> | null = null;
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
  if (appIsForeground) {
    /* Geen melding zolang de app zelf open staat — zie de AppState-
       listener hierboven. De snapshot (pill/hydratie) is hierboven al
       bijgewerkt; alleen de OS-melding zelf slaan we over. */
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
          ? `VIBEZCORE Bracelet · ${fmtMMSS(remSec)} left · Paused`
          : `VIBEZCORE Bracelet · ${fmtMMSS(remSec)} left`,
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
  if (tickHandle) clearInterval(tickHandle);
  if (resyncHandle) clearInterval(resyncHandle);
  tickHandle = null;
  resyncHandle = null;
}

function tick(): void {
  if (!state) return;
  if (!state.paused && currentRemainingSec() <= 0) {
    /* Natuurlijk afgelopen terwijl niemand keek — stoppen en opruimen.
       bracelet-control.tsx's eigen status-poll ziet dit bij terugkeer
       toch al (sessionActive false), maar dit voorkomt dat de melding/
       pill op 0:00 blijft hangen tot dat moment. */
    void stopBraceletSessionMonitor();
    return;
  }
  void publish(false);
}

async function resync(): Promise<void> {
  if (!state || state.paused) return;
  try {
    const st = await getBracelet().requestStatus();
    if (!st.sessionActive) {
      /* Hardware zegt: voorbij (battery-cut/fault/charging/natural —
         spec §9). Vertrouw de hardware, niet onze eigen projectie. */
      void stopBraceletSessionMonitor();
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
  };
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
  tickHandle = setInterval(tick, TICK_MS);
  resyncHandle = setInterval(() => void resync(), RESYNC_MS);
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
  void publish(true);
}

/** Aanroepen vanuit onResume. Hervat de projectie vanaf het pauze-moment. */
export function resumeBraceletSessionMonitor(): void {
  if (!state) return;
  state = { ...state, paused: false, runStartedAt: Date.now() };
  void publish(true);
}

/** Aanroepen vanuit onStop / finishSession (manual End, natural completion,
 *  fault/charging/battery-cut). Ruimt melding + snapshot op. */
export async function stopBraceletSessionMonitor(): Promise<void> {
  clearTimers();
  state = null;
  clearBraceletSession();
  try {
    await Notifications.dismissNotificationAsync(NOTIF_ID);
  } catch {
    /* Cosmetisch. */
  }
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
