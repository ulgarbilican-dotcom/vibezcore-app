/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — hartslaggeluid op de Resting Heart Rate-pagina (operator,
   9 okt 2026: "kunnen wij Your Resting Heart Rate een hartslaggeluid
   geven?").

   Eén echte lub-dub, met per uitgang een eigen versie (operator, 9 okt 2026:
   "zonder koptelefoon goed, met niet goed"):
     - speaker (assets/heartbeat-speaker.wav): Pixabay "freesound_community
       heartbeat 6396", tweede slag op 1,04 s, klank onaangeroerd;
     - koptelefoon/oortjes (assets/heartbeat-headphones.wav): Pixabay
       "soundreality heartbeat 549797", slag op 3,65 s uit een rustig hart
       van ~70 bpm, natuurlijke volle klank, enkel ruis tussen de tonen eruit.
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

const VOLUME_SPEAKER = 0.7;
const VOLUME_HEADPHONES = 0.7;

let speaker: AudioPlayer | null = null;
let headphones: AudioPlayer | null = null;
let active = false;

export function startHeartbeatSound(): void {
  if (active) return;
  if (getBreathSession().isRunning || getSnapshot().session !== null) return;
  active = true;
  invalidateAudioMode();
  invalidateAudioModeSet();
  void setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  })
    .catch(() => {})
    .then(() => {
      if (!active || speaker) return;
      try {
        const sp = createAudioPlayer(require('../../assets/heartbeat-speaker.wav'));
        sp.volume = VOLUME_SPEAKER;
        const hp = createAudioPlayer(require('../../assets/heartbeat-headphones.wav'));
        hp.volume = VOLUME_HEADPHONES;
        speaker = sp;
        headphones = hp;
      } catch {
        speaker = null;
        headphones = null;
      }
    });
}

/** Eén slag (de "lub"; de "dub" zit in hetzelfde geluid). */
export function heartbeatTick(): void {
  const p = isHeadphonesOutput() ? headphones : speaker;
  if (!p) return;
  try {
    void p.seekTo(0);
    p.play();
  } catch {
    /* geluid is een extraatje — nooit de pagina laten haperen */
  }
}

export function stopHeartbeatSound(): void {
  active = false;
  for (const p of [speaker, headphones]) {
    if (!p) continue;
    try {
      p.pause();
      p.remove();
    } catch {
      /* al weg */
    }
  }
  speaker = null;
  headphones = null;
}
