/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — het audio-anker van een lopende sessie

   "Als ik het scherm lock moet het ook verder gaan" (operator, 8 augustus
   2026). De sessieklok tikt op JS-intervallen, en Android bevriest die
   zodra de app naar de achtergrond gaat — tenzij er audio speelt. Met de
   soundscape aan is dat vanzelf zo; met stem-alleen of stil valt er tussen
   twee cues niets af te spelen en mag het systeem het proces pauzeren.

   Dit anker is een LUS VAN STILTE: een lokaal wav-bestand van één seconde
   zonder geluid, eindeloos herhaald zolang de sessie loopt. Het is
   onhoorbaar, kost niets, en houdt precies datgene vast wat een sessie
   nodig heeft — audiofocus en een levend proces. Calm en Headspace draaien
   op hetzelfde principe; bij hen is het de begeleidingsaudio zelf.

   Lokaal bestand, geen netwerk: een anker dat eerst moet downloaden is
   geen anker. En de audiomodus (shouldPlayInBackground) staat al goed —
   die zet de bestaande audiolaag bij het opstarten.
   ───────────────────────────────────────────────────────────────────────── */

import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';

let anchor: AudioPlayer | null = null;
let modeSet = false;

/** Enkel de audiomodus zetten, zonder het stilte-anker te starten.
 *
 *  Operator, 24 september 2026 (7de melding, "nog altijd geen stem in
 *  ronde 1"): dit was de resterende oorzaak, los van alles wat al eerder
 *  gefixt is aan caching/preload/preemption. `startSessionKeepAlive()`
 *  (en dus deze `setAudioModeAsync`) werd op Android NOOIT aangeroepen
 *  (zie `start()` in breath-session.tsx: `if (Platform.OS !== 'android')`
 *  — het stilte-anker is daar overbodig omdat de native
 *  BreathSessionService de achtergrond-melding al draagt). Maar
 *  `setAudioModeAsync` doet op Android nog iets anders dan alleen het
 *  anker overleven laten: het zet `interruptionMode: 'doNotMix'`, zonder
 *  welke twee spelers die zowat gelijktijdig starten (de soundscape via
 *  `playScape()` én de allereerste stem-cue via `speak()`, letterlijk twee
 *  regels na elkaar in `start()`) op Android om audiofocus concurreren
 *  onder het STANDAARD interruption-gedrag — de speler die als tweede
 *  komt kan dan stil blijven zonder dat er ergens een JS-fout van komt
 *  (`player.playing` blijft gewoon `true` melden vanuit de player's eigen
 *  oogpunt, audiofocus is een OS-concept los daarvan). Bij ronde 2 speelt
 *  de soundscape al onafgebroken door — geen nieuwe focus-onderhandeling
 *  meer nodig voor de stem-cue — vandaar exact het "werkt vanaf ronde 2"
 *  patroon. Fix: dezelfde modus-zet die hierboven al voor het anker
 *  bestond, nu ook (en het eerst) voor Android, vóór `playScape`/`speak`
 *  in `start()` vuren — zie de aanroep daar. */
let modeSetPromise: Promise<void> | null = null;

/** Geeft een promise terug die resolvet zodra `doNotMix` ECHT actief staat
 *  (of meteen, als dat al zo was). Operator, 24 september 2026 (8ste
 *  melding, na live logcat-onderzoek): puur `void`-aanroepen (fire-and-
 *  forget, zoals hiervoor) loste de race niet op — `setAudioModeAsync` is
 *  een native bridge-call die niet synchroon klaar is, en `start()` in
 *  breath-session.tsx riep deze functie en daarna METEEN `playScape()`/
 *  `speak()` aan in dezelfde tick, dus de modus was nog niet toegepast op
 *  het moment dat de allereerste twee spelers om audiofocus streden. De
 *  aanroeper moet nu expliciet op deze promise wachten vóór hij zelf audio
 *  start. */
/** Zie audio-player `invalidateAudioMode`: het hartslaggeluid zette
 *  tijdelijk een zachtere modus → de volgende sessie zet hem opnieuw. */
export function invalidateAudioModeSet(): void {
  modeSet = false;
  modeSetPromise = null;
}

export function ensureAudioModeSet(): Promise<void> {
  if (modeSet) return Promise.resolve();
  if (modeSetPromise) return modeSetPromise;
  modeSetPromise = setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  })
    .then(() => {
      modeSet = true;
    })
    .catch(() => {
      /* Modus kon niet gezet worden — audio mag daar niet definitief op
         vastlopen, dus geen throw. Een volgende aanroep probeert opnieuw
         (modeSet blijft false). */
    })
    .finally(() => {
      modeSetPromise = null;
    });
  return modeSetPromise;
}

/** Titel/artiest voor de lockscreen-melding — cosmetisch, maar
 *  `setActiveForLockScreen` hieronder is dat niet. */
export type SessionKeepAliveMeta = { title: string; subtitle?: string };

/** Start het anker. Veilig om vaker aan te roepen; er draait er hoogstens
 *  één.
 *
 *  `setActiveForLockScreen` erbij (operator, 13 augustus 2026: "als
 *  telefoon op slot gaat moet breathwork voice/haptic doorspelen — nu
 *  stopt dat"). Gemeten op het toestel: de stem-cues speelden gewoon door
 *  tot het scherm vergrendelde, en stopten toen — exact het gedrag dat
 *  expo-audio's eigen documentatie beschrijft: zonder
 *  `setActiveForLockScreen` stopt achtergrond-audio na ~3 minuten (een
 *  OS-limiet), en zonder een echte lockscreen-sessie kan Doze het zelfs
 *  eerder al bevriezen. Dit is dezelfde aanpak als de Audio Library al
 *  gebruikt (services/audio-player.ts, `activateLockScreen`) — nu ook
 *  voor het stille anker, zodat de HELE sessie (stem, timer, haptiek —
 *  die draaien allemaal op hetzelfde JS-proces dat dit anker levend
 *  houdt) blijft doorlopen met het scherm op slot. */
export function startSessionKeepAlive(
  meta?: SessionKeepAliveMeta,
  /** Operator, 17 september 2026 (bracelet-sessies): bracelet gebruikt dit
   *  anker ALLEEN nog voor het levend houden van het JS-proces — de
   *  zichtbare "X:XX left"-info komt daar uit een eigen, platte
   *  expo-notifications-melding (bracelet-session-monitor.ts), niet uit
   *  deze audio-MediaSession. Twee gelijktijdige lockscreen-widgets met
   *  dezelfde info is nutteloze ruis; `false` onderdrukt
   *  `setActiveForLockScreen`'s eigen title/artist-weergave zonder de
   *  keepalive-werking zelf te raken. Default `true` = ongewijzigd
   *  gedrag voor bestaande aanroepers (breathwork). */
  showLockScreenInfo: boolean = true,
): void {
  if (anchor) return;
  void (async () => {
    try {
      /* De aanname hierboven ("de audiomodus staat al goed") bleek fout —
         gemeten op het toestel, 9 augustus 2026: 84 seconden slot, 15
         seconden klok. `shouldPlayInBackground` werd alleen gezet door de
         audiobibliotheek-speler, en die is verborgen; het anker speelde dus
         in de standaardmodus en Android zette het stil zodra het scherm op
         slot ging — precies wat het moest voorkomen. Nu zet het anker de
         modus zelf, VÓÓR het afspelen begint. */
      if (!modeSet) {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
        modeSet = true;
      }
      if (anchor) return;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const p = createAudioPlayer(require('../../assets/silence.wav'));
      p.loop = true;
      p.volume = 1; /* het bestand ÍS stilte — volume verlagen is dubbelop */
      p.play();
      if (showLockScreenInfo) {
        try {
          p.setActiveForLockScreen(
            true,
            { title: meta?.title ?? 'VIBEZCORE Breathwork', artist: meta?.subtitle },
            { showSeekForward: false, showSeekBackward: false },
          );
        } catch {
          /* Niet kritiek voor de sessie zelf, alleen voor de OS-UI/het
             in-leven-houden — zie catch hieronder voor de rest. */
        }
      }
      anchor = p;
    } catch {
      /* Geen anker is geen ramp: met scherm aan werkt alles gewoon. */
      anchor = null;
    }
  })();
}

/** Ververs de lockscreen-titel/subtitel van een al-lopend anker (bv. de
 *  "X:XX left"-tekst elke tick) zonder de speler opnieuw te starten —
 *  `startSessionKeepAlive` is een no-op zodra er al een anchor draait,
 *  dus dit is de enige manier om de weergegeven tekst te laten meelopen
 *  met een aftellende sessie. Geen-op als er nog geen anker draait. */
export function updateSessionKeepAliveMeta(meta: SessionKeepAliveMeta): void {
  if (!anchor) return;
  try {
    anchor.setActiveForLockScreen(
      true,
      { title: meta.title, artist: meta.subtitle },
      { showSeekForward: false, showSeekBackward: false },
    );
  } catch {
    /* Cosmetisch — nooit de sessie zelf breken. */
  }
}

/** Stop en ruim op. Veilig om vaker aan te roepen dan nodig. */
export function stopSessionKeepAlive(): void {
  const p = anchor;
  anchor = null;
  if (!p) return;
  try {
    p.setActiveForLockScreen(false);
  } catch {}
  try {
    p.pause();
    p.remove();
  } catch {}
}
