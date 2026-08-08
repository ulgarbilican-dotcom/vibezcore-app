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

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

let anchor: AudioPlayer | null = null;

/** Start het anker. Veilig om vaker aan te roepen; er draait er hoogstens
 *  één. */
export function startSessionKeepAlive(): void {
  if (anchor) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = createAudioPlayer(require('../../assets/silence.wav'));
    p.loop = true;
    p.volume = 1; /* het bestand ÍS stilte — volume verlagen is dubbelop */
    p.play();
    anchor = p;
  } catch {
    /* Geen anker is geen ramp: met scherm aan werkt alles gewoon. */
    anchor = null;
  }
}

/** Stop en ruim op. Veilig om vaker aan te roepen dan nodig. */
export function stopSessionKeepAlive(): void {
  const p = anchor;
  anchor = null;
  if (!p) return;
  try {
    p.pause();
    p.remove();
  } catch {}
}
