/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — het zachte "ping"-geluid van het bevestigingsmoment
   (ConfirmMoment, punt 25 — operator, 19 okt 2026: "een moment dat zegt:
   het is gelukt").

   Geluid: assets/confirm-ping.wav, ZELF GEGENEREERD (geen licentie):
   0,45 s klokje — sinus 1318,5 Hz (E6) + zachtere boventonen 2637 Hz en
   3955,5 Hz, inzet 5 ms, exponentieel uitsterven (grondtoon τ 110 ms,
   boventonen τ 50 ms), 25 ms uitloop tegen een kraakje, piek −6 dBFS,
   44,1 kHz mono 16-bit. Script stond in de sessie-scratch, niet in de repo.

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

const PING_VOLUME = 0.7;
/** Ruim langer dan het bestand (0,45 s) + het zetten van de modus. */
const RELEASE_AFTER_MS = 1300;

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
