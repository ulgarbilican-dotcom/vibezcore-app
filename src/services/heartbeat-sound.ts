/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — hartslaggeluid op de Resting Heart Rate-pagina (operator,
   9 okt 2026: "kunnen wij Your Resting Heart Rate een hartslaggeluid
   geven?").

   Eén echte lub-dub, met per uitgang een eigen versie (operator, 9 okt 2026:
   "zonder koptelefoon goed, met niet goed"):
     - speaker (assets/heartbeat-speaker.wav): Pixabay "freesound_community
       heartbeat 6396", tweede slag op 1,04 s, klank onaangeroerd;
     - koptelefoon/oortjes (assets/heartbeat-headphones.wav): Pixabay
       "liecio heartbeat 297400" (operator: "de beste"; 6396, 549797,
       21649, 493995, 493999, 584627 en 5857 ook getest → "niet goed"),
       slag op 1,50 s, lub-dub 0,26 s. Lub verzacht ("te intens, scherp"):
       < 700 Hz, 60% sterkte, rondere inzet; dub onaangeroerd; zachte
       uitsterving + 0,35 s stilte tegen een kraakje op het einde.
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
const VOLUME_HEADPHONES = 0.3; // operator, 9 okt 2026: 100% → 70% → 50% bleef "veel te luid en onzuiver" bij vol telefoonvolume → 30%

let speaker: AudioPlayer | null = null;
let headphones: AudioPlayer | null = null;
/* Stille lus zolang de pagina openstaat: houdt de geluidsweg wakker. Zonder
   valt een Bluetooth-koptelefoon tussen twee slagen in spaarstand en mist
   hij het begin (de "lub") van elke volgende slag (operator, 9 okt 2026:
   drie opnames die op Pixabay goed klonken, klonken in de app allemaal
   "niet goed" met koptelefoon). */
let keepAwake: AudioPlayer | null = null;
/* Operator, 10 okt 2026 ("ik hoor het hartslaggeluid niet meer"): de
   Resting Heart Rate-pagina én de meting (PulseMeter) gebruiken dit geluid.
   Eén gedeelde aan/uit-vlag liet de meting bij het sluiten van haar blad
   het geluid van de pagina mee uitzetten (het blad verdwijnt pas ná de
   animatie, dus nadat de pagina het al weer had aangezet). Nu heeft elke
   gebruiker een eigen sleutel; het geluid stopt pas als niemand het nog
   nodig heeft. */
export type HeartbeatOwner = 'page' | 'measure' | 'state-control';
const owners = new Set<HeartbeatOwner>();

/* Operator, 9 okt 2026 ("de hartslag speelt niet meteen, duurt ~4 s"): de
   spelers worden vooraf aangemaakt (zodra de pagina er is, nog vóór ze in
   beeld komt) en blijven daarna bestaan — enkel pauzeren bij het weggaan.
   Zo klinkt ook de allereerste slag. */
/* Vervolg (operator, 10 okt 2026: "waar is het geluid naartoe?"): een
   speler die faalde (bv. bestand niet bereikbaar op het moment van laden)
   bleef voor altijd stil. Daarom bij elk bezoek verse spelers — behalve
   vlak na het vooraf laden bij het openen van de pagina. */
let createdAt = 0;

function releasePlayers(): void {
  for (const p of [speaker, headphones, keepAwake]) {
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
  keepAwake = null;
}

const log = (msg: string) => {
  if (__DEV__) console.log(`[heartbeat] ${msg}`);
};

/* Operator, 10 okt 2026 ("opnieuw geen geluid"): niet meer bij elk bezoek
   verse spelers (een verse speler is nog aan het laden en slikt de eerste
   slagen). Spelers blijven bestaan; enkel opnieuw aanmaken als spelen echt
   faalt (`broken`). LET OP: `player.isLoaded` blijft op Android `false` voor
   gebundelde bestanden (log A16, 10 okt) — daar nooit op vertrouwen, anders
   wordt de speler elke paar seconden vervangen en vallen slagen weg. */
let broken = false;

function ensurePlayers(_fresh = false): void {
  if (speaker && headphones && !broken) return;
  broken = false;
  log(`creating players (had=${!!speaker})`);
  releasePlayers();
  createdAt = Date.now();
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

export function startHeartbeatSound(owner: HeartbeatOwner): void {
  if (owners.has(owner)) return;
  if (getBreathSession().isRunning || getSnapshot().session !== null) {
    log(`start(${owner}) skipped: breath=${getBreathSession().isRunning} audio=${getSnapshot().session !== null}`);
    return;
  }
  log(`start(${owner}) owners=${[...owners].join(',')}`);
  const wasActive = owners.size > 0;
  owners.add(owner);
  if (wasActive) return;
  invalidateAudioMode();
  invalidateAudioModeSet();
  /* Niet wachten: de modus wordt gezet terwijl de eerste slag al kan klinken. */
  void setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  }).catch(() => {});
  ensurePlayers(true);
  try {
    keepAwake?.play();
  } catch {
    /* geen ramp */
  }
}

/** Eén slag (de "lub"; de "dub" zit in hetzelfde geluid). */
export function heartbeatTick(): void {
  if (owners.size === 0) return;
  if (!speaker || !headphones || broken) ensurePlayers(true);
  const p = isHeadphonesOutput() ? headphones : speaker;
  if (!p) return;
  try {
    /* Eerst echt terug naar het begin, dán spelen: anders staat de speler
       nog aan het einde van de vorige slag en speelt hij niets (gezien op
       de A16: enkel de eerste slag klonk). */
    /* Vervolg (operator: "hij slaat in het begin één slag over"): een
       verse speler staat nog aan het begin en is mogelijk nog aan het laden
       — terugspoelen faalt dan. Gewoon spelen; hij start zodra hij klaar is. */
    if (p.currentTime <= 0.01) {
      p.play();
      return;
    }
    p.pause();
    void p
      .seekTo(0)
      .then(() => p.play())
      .catch(() => p.play());
  } catch (e) {
    log(`tick failed: ${String(e)}`);
    broken = true;
    /* geluid is een extraatje — nooit de pagina laten haperen */
  }
}

export function stopHeartbeatSound(owner: HeartbeatOwner): void {
  if (owners.has(owner)) log(`stop(${owner})`);
  owners.delete(owner);
  if (owners.size > 0) return;
  for (const p of [speaker, headphones, keepAwake]) {
    if (!p) continue;
    try {
      p.pause();
    } catch {
      /* al weg */
    }
  }
}
