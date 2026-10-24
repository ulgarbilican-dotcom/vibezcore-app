/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — het zachte "ping"-geluid van het bevestigingsmoment
   (ConfirmMoment, punt 25 — operator, 19 okt 2026: "een moment dat zegt:
   het is gelukt").

   Geluid: assets/confirm-ping.wav, ZELF GEGENEREERD (geen licentie), 24 okt 2026 opnieuw
   (operator: "pinggeluid moet een professionele ping zijn"): twee zuivere, stijgende tonen
   A5 (880 Hz) -> E6 (1318 Hz), aanslag 3 ms, uitsterven tau 170-190 ms, een korte donkere
   plaat-galm (geen echo-herhaling), 1,2 s, piek -10 dBFS, 44,1 kHz mono 16-bit.
   Eerdere versies: E6 met scherpe boventonen (schel), daarna G4/D5 met 190 ms echo.
   Script: scripts/gen-confirm-ping.py.

   Regels (zelfde lijn als heartbeat-sound.ts):
     - mengt met muziek van de gebruiker (interruptionMode 'mixWithOthers'),
       neemt nooit audiofocus en stopt niemands muziek;
     - iOS: stil als de telefoon op stil staat (playsInSilentMode false);
       Android: volgt het mediavolume;
     - NOOIT tijdens een lopende sessie of terwijl de audiobibliotheek iets
       geladen heeft (ook gepauzeerd): dan blijft hun eigen audiomodus
       (achtergrond, vergrendelscherm 🔒) volledig ongemoeid. Daarom mag dit
       geluid de app-brede modus wél tijdelijk naar "zacht" zetten — er is
       op dat moment niemand die een andere modus nodig heeft — en geven we
       audio-player en session-keepalive een seintje (invalidate), zodat zij
       de volgende keer hun eigen modus opnieuw zetten;
     - speler na het spelen meteen vrijgeven. */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { getSnapshot, invalidateAudioMode } from './audio-player';
import { getBraceletSessionSnapshot } from './bracelet-session-state';
import { getBreathSession } from './breath-session-state';
import { isHeartbeatSoundOn } from './heartbeat-sound';
import { invalidateAudioModeSet, isKeepAliveActive } from './session-keepalive';

const PING_VOLUME = 0.6;
/** Ruim langer dan het bestand (1,5 s) + het zetten van de modus. */
const RELEASE_AFTER_MS = 1900;

/** Mag het ping-geluid nu klinken? */
function pingAllowed(): boolean {
  if (getBreathSession().isRunning) return false;
  if (isKeepAliveActive()) return false;
  if (getBraceletSessionSnapshot().active) return false;
  if (isHeartbeatSoundOn('state-control')) return false;
  const audio = getSnapshot();
  if (audio.session !== null || audio.playing) return false;
  return true;
}

export function playConfirmPing(): void {
  if (!pingAllowed()) return;
  let player: AudioPlayer | null = null;
  try {
    invalidateAudioMode();
    invalidateAudioModeSet();
    void setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    })
      .catch(() => {})
      .finally(() => {
        try {
          player?.play();
        } catch {
          /* geluid is een extraatje */
        }
      });
    player = createAudioPlayer(require('../../assets/confirm-ping.wav'));
    player.volume = PING_VOLUME;
    const p = player;
    setTimeout(() => {
      try {
        p.pause();
        p.remove();
      } catch {
        /* al weg */
      }
    }, RELEASE_AFTER_MS);
  } catch {
    /* geluid is een extraatje — nooit het scherm laten haperen */
  }
}
