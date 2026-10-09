/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — hartslaggeluid op de Resting Heart Rate-pagina (operator,
   9 okt 2026: "kunnen wij Your Resting Heart Rate een hartslaggeluid
   geven?").

   Eén echte lub-dub, met per uitgang een eigen versie (operator, 9 okt 2026:
   "zonder koptelefoon goed, met niet goed"):
     - speaker (assets/heartbeat-speaker.wav): Pixabay "freesound_community
       heartbeat 6396", tweede slag op 1,04 s, klank onaangeroerd;
     - koptelefoon/oortjes (assets/heartbeat-headphones.wav): Pixabay
       "liecio heartbeat 297400" (operator: "de beste"), slag op 1,50 s,
       lub-dub 0,26 s, klank onaangeroerd; dub sterft zacht uit en 0,35 s
       stilte erachter (soms een kraakje op het einde: de speler stopte
       vlak na het geluid).
   Pixabay-licentie: vrij in apps, geen naamsvermelding. De uitgang wordt
   bij elke slag bekeken (modules/audio-route), dus oortjes in- of uitdoen
   tijdens het luisteren werkt meteen. Op elke
   slag van het kloppende hart. Regels:
     - mengt met muziek van de gebruiker (nooit iemands muziek stoppen);
     - iOS: stil als de telefoon op stil staat (Android: mediavolume);
     - enkel zolang de pagina zichtbaar is;
     - speelt er al iets van de app (ademsessie, audiobibliotheek — ook
       gepauzeerd), dan geen geluid: hun modus en vergrendelscherm blijven
       ongemoeid.
   Na het zetten van de zachtere modus krijgen audio-player en
   session-keepalive een seintje, zodat zij hun eigen modus de volgende keer
   opnieuw zetten (vergrendelscherm-flow is goedgekeurd 🔒). */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { getSnapshot, invalidateAudioMode } from './audio-player';
import { getBreathSession } from './breath-session-state';
import { invalidateAudioModeSet } from './session-keepalive';
import { isHeadphonesOutput } from '../../modules/audio-route';

const VOLUME_SPEAKER = 1; // operator, 9 okt 2026: "op de telefoon mag het luider"
const VOLUME_HEADPHONES = 0.7; // operator, 9 okt 2026: max was te luid, terug naar 70%

let speaker: AudioPlayer | null = null;
let headphones: AudioPlayer | null = null;
/* Stille lus zolang de pagina openstaat: houdt de geluidsweg wakker. Zonder
   valt een Bluetooth-koptelefoon tussen twee slagen in spaarstand en mist
   hij het begin (de "lub") van elke volgende slag (operator, 9 okt 2026:
   drie opnames die op Pixabay goed klonken, klonken in de app allemaal
   "niet goed" met koptelefoon). */
let keepAwake: AudioPlayer | null = null;
let active = false;

/* Operator, 9 okt 2026 ("de hartslag speelt niet meteen, duurt ~4 s"): de
   spelers worden vooraf aangemaakt (zodra de pagina er is, nog vóór ze in
   beeld komt) en blijven daarna bestaan — enkel pauzeren bij het weggaan.
   Zo klinkt ook de allereerste slag. */
function ensurePlayers(): void {
  if (speaker) return;
  try {
    const sp = createAudioPlayer(require('../../assets/heartbeat-speaker.wav'));
    sp.volume = VOLUME_SPEAKER;
    const hp = createAudioPlayer(require('../../assets/heartbeat-headphones.wav'));
    hp.volume = VOLUME_HEADPHONES;
    const ka = createAudioPlayer(require('../../assets/silence.wav'));
    ka.loop = true;
    speaker = sp;
    headphones = hp;
    keepAwake = ka;
  } catch {
    speaker = null;
    headphones = null;
    keepAwake = null;
  }
}

/** Laden zonder te spelen (de pagina roept dit aan bij het openen). */
export function preloadHeartbeatSound(): void {
  ensurePlayers();
}

export function startHeartbeatSound(): void {
  if (active) return;
  if (getBreathSession().isRunning || getSnapshot().session !== null) return;
  active = true;
  invalidateAudioMode();
  invalidateAudioModeSet();
  /* Niet wachten: de modus wordt gezet terwijl de eerste slag al kan klinken. */
  void setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  }).catch(() => {});
  ensurePlayers();
  try {
    keepAwake?.play();
  } catch {
    /* geen ramp */
  }
}

/** Eén slag (de "lub"; de "dub" zit in hetzelfde geluid). */
export function heartbeatTick(): void {
  if (!active) return;
  const p = isHeadphonesOutput() ? headphones : speaker;
  if (!p) return;
  try {
    /* Eerst echt terug naar het begin, dán spelen: anders staat de speler
       nog aan het einde van de vorige slag en speelt hij niets (gezien op
       de A16: enkel de eerste slag klonk). */
    p.pause();
    void p
      .seekTo(0)
      .then(() => p.play())
      .catch(() => {});
  } catch {
    /* geluid is een extraatje — nooit de pagina laten haperen */
  }
}

export function stopHeartbeatSound(): void {
  active = false;
  for (const p of [speaker, headphones, keepAwake]) {
    if (!p) continue;
    try {
      p.pause();
    } catch {
      /* al weg */
    }
  }
}
