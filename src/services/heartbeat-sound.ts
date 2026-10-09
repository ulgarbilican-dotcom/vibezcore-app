/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — hartslaggeluid op de Resting Heart Rate-pagina (operator,
   9 okt 2026: "kunnen wij Your Resting Heart Rate een hartslaggeluid
   geven?").

   Een zachte, lage lub-dub (assets/heartbeat.wav, zelf gemaakt), op elke
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

const VOLUME = 0.8; // operator, 9 okt 2026: "kan dat luider?" → voller geluid, daarna "iets zachter"

let player: AudioPlayer | null = null;
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
      if (!active || player) return;
      try {
        const p = createAudioPlayer(require('../../assets/heartbeat.wav'));
        p.volume = VOLUME;
        player = p;
      } catch {
        player = null;
      }
    });
}

/** Eén slag (de "lub"; de "dub" zit in hetzelfde geluid). */
export function heartbeatTick(): void {
  const p = player;
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
  const p = player;
  player = null;
  if (p) {
    try {
      p.pause();
      p.remove();
    } catch {
      /* al weg */
    }
  }
}
