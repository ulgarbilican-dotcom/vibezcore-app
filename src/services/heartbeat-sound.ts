/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — hartslaggeluid op de Resting Heart Rate-pagina (operator,
   9 okt 2026: "kunnen wij Your Resting Heart Rate een hartslaggeluid
   geven?").

   Eén echte lub-dub, met per uitgang een eigen versie (operator, 9 okt 2026:
   "zonder koptelefoon goed, met niet goed"):
     - speaker (assets/heartbeat-speaker.wav): Pixabay "freesound_community
       heartbeat 6396", tweede slag op 1,04 s. Luidsprekerversie (operator,
       18 okt 2026: "geluid op max" — piek stond al op −0,4 dB, maar bijna
       alle klank zat < 150 Hz, wat een telefoonluidspreker amper speelt):
       < 140 Hz eruit, de slag als boventonen naar 300–800 Hz + lichte
       middenboost → ±7 dB luider in het luidsprekerbereik, piek −0,5 dB,
       lub/dub-verhouding gelijk. Zelfde bestanden in de Android-dienst
       (modules/state-haptics/.../res/raw/heartbeat_speaker_*.wav);
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
import { Platform } from 'react-native';
import { getSnapshot, invalidateAudioMode } from './audio-player';
import { getBreathSession } from './breath-session-state';
import { invalidateAudioModeSet, isKeepAliveActive } from './session-keepalive';
import { isHeadphonesOutput } from '../../modules/audio-route';

const VOLUME_SPEAKER = 1; // operator, 9 okt 2026: "op de telefoon mag het luider"
const VOLUME_HEADPHONES = 0.3; // operator, 9 okt 2026: 100% → 70% → 50% bleef "veel te luid en onzuiver" bij vol telefoonvolume → 30%
/** Zelfde volumes voor de iPhone-BeatEngine (bracelet-haptics.ts). */
export const HEARTBEAT_VOLUME = { speaker: VOLUME_SPEAKER, headphones: VOLUME_HEADPHONES } as const;

let speaker: AudioPlayer | null = null;
let headphones: AudioPlayer | null = null;
/* Stille lus zolang de pagina openstaat: houdt de geluidsweg wakker. Zonder
   valt een Bluetooth-koptelefoon tussen twee slagen in spaarstand en mist
   hij het begin (de "lub") van elke volgende slag (operator, 9 okt 2026:
   drie opnames die op Pixabay goed klonken, klonken in de app allemaal
   "niet goed" met koptelefoon). */
let keepAwake: AudioPlayer | null = null;
/* 14 okt 2026 (operator: "iemand moet horen wat ze zien"): State Control
   speelt lub en dub als LOSSE geluiden, de dub op exact hetzelfde moment
   als de tweede tik en de tweede klop van de cirkel (30 % van de slag,
   max 350 ms). De volledige opname had de dub op een vaste 0,24 s. De
   hartslagmeter (echte, gemeten slagen) houdt de volledige opname. */
let speakerLub: AudioPlayer | null = null;
let speakerDub: AudioPlayer | null = null;
let headphonesLub: AudioPlayer | null = null;
let headphonesDub: AudioPlayer | null = null;
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
  for (const p of [speaker, headphones, keepAwake, speakerLub, speakerDub, headphonesLub, headphonesDub]) {
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
  speakerLub = speakerDub = headphonesLub = headphonesDub = null;
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
    const spL = createAudioPlayer(require('../../assets/heartbeat-speaker-lub.wav'));
    const spD = createAudioPlayer(require('../../assets/heartbeat-speaker-dub.wav'));
    const hpL = createAudioPlayer(require('../../assets/heartbeat-headphones-lub.wav'));
    const hpD = createAudioPlayer(require('../../assets/heartbeat-headphones-dub.wav'));
    spL.volume = spD.volume = VOLUME_SPEAKER;
    hpL.volume = hpD.volume = VOLUME_HEADPHONES;
    speaker = sp;
    headphones = hp;
    keepAwake = ka;
    speakerLub = spL;
    speakerDub = spD;
    headphonesLub = hpL;
    headphonesDub = hpD;
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

/** Klinkt de hartslag nu voor deze eigenaar? (start() slaat over als er al
 *  een ademsessie of audiobibliotheek speelt — de BeatEngine volgt dat.) */
export function isHeartbeatSoundOn(owner: HeartbeatOwner): boolean {
  return owners.has(owner);
}

/** Mag het hartslaggeluid nu klinken? Niet als er al een ademsessie of de
 *  audiobibliotheek speelt (ook gepauzeerd) — zelfde regel als start()
 *  hieronder; de iPhone-geluidsmotor (bracelet-haptics.ts) volgt ze. */
export function heartbeatSoundAllowed(): boolean {
  return !getBreathSession().isRunning && getSnapshot().session === null;
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
  /* Niet wachten: de modus wordt gezet terwijl de eerste slag al kan klinken.
     iPhone + State Control-sessie (operator, iPhone build 24: "bij lockscreen
     stopt gewoon alles"): de modus is voor de HELE app. "Niet op de
     achtergrond / stil bij stille modus" (ambient) legde een lopende sessie
     stil zodra je vergrendelde — het stille anker mocht niet meer spelen en
     iOS bevroor de app. Voor een sessie dus playback + achtergrond, nog
     altijd mengend met muziek van de gebruiker. Hartslagpagina en meting
     blijven zoals ze waren. */
  /* Ook nooit de achtergrond uitzetten zolang er een sessie loopt (bv. de
     hartslagpagina openen tijdens een geminimaliseerde ademsessie). */
  const sessionOnIos = Platform.OS === 'ios' && (owner === 'state-control' || isKeepAliveActive());
  void setAudioModeAsync({
    playsInSilentMode: sessionOnIos,
    shouldPlayInBackground: sessionOnIos,
    interruptionMode: 'mixWithOthers',
  }).catch(() => {});
  ensurePlayers(true);
  try {
    keepAwake?.play();
  } catch {
    /* geen ramp */
  }
}

/** Eén slag (de "lub"; de "dub" zit in hetzelfde geluid) — hartslagmeter. */
export function heartbeatTick(): void {
  if (owners.size === 0) return;
  if (!speaker || !headphones || broken) ensurePlayers(true);
  playFromStart(isHeadphonesOutput() ? headphones : speaker);
}

/** State Control: de eerste slag. */
export function heartbeatLub(): void {
  if (owners.size === 0) return;
  if (!speakerLub || !headphonesLub || broken) ensurePlayers(true);
  playFromStart(isHeadphonesOutput() ? headphonesLub : speakerLub);
}

/** State Control: de tweede slag, op het moment van de tweede tik. */
export function heartbeatDub(): void {
  if (owners.size === 0) return;
  if (!speakerDub || !headphonesDub || broken) ensurePlayers(true);
  playFromStart(isHeadphonesOutput() ? headphonesDub : speakerDub);
}

/* 15 okt 2026 (operator: "hartslag moet correct stabiel, klopt nu
   onregelmatig"): terugspoelen gebeurde vlak vóór elke slag (pauze → seek →
   play), en die seek duurt telkens anders lang — de slagen vielen dus
   ongelijk. Nu spoelen we ~0,8 s NA elke slag terug (langer dan het langste
   geluid, 0,73 s; korter dan de kortste slag op deze pagina), zodat de
   speler bij de volgende slag al klaarstaat en meteen speelt. */
const REWIND_AFTER_MS = 800;
const rewindTimers = new Map<AudioPlayer, ReturnType<typeof setTimeout>>();
function scheduleRewind(p: AudioPlayer): void {
  const prev = rewindTimers.get(p);
  if (prev) clearTimeout(prev);
  rewindTimers.set(
    p,
    setTimeout(() => {
      rewindTimers.delete(p);
      try {
        p.pause();
        void p.seekTo(0).catch(() => {});
      } catch {
        /* al weg */
      }
    }, REWIND_AFTER_MS),
  );
}

function playFromStart(p: AudioPlayer | null): void {
  if (!p) return;
  try {
    if (p.currentTime <= 0.01) {
      p.play();
      scheduleRewind(p);
      return;
    }
    /* Eerst echt terug naar het begin, dán spelen: anders staat de speler
       nog aan het einde van de vorige slag en speelt hij niets (gezien op
       de A16: enkel de eerste slag klonk). */
    /* Vervolg (operator: "hij slaat in het begin één slag over"): een
       verse speler staat nog aan het begin en is mogelijk nog aan het laden
       — terugspoelen faalt dan. Gewoon spelen; hij start zodra hij klaar is. */
    /* Uitzondering (bv. een slag die vlak na de vorige komt): oude weg, maar
       nooit meer spelen als intussen alles gestopt is. */
    p.pause();
    void p
      .seekTo(0)
      .then(() => {
        if (owners.size > 0) p.play();
      })
      .catch(() => {
        if (owners.size > 0) p.play();
      });
    scheduleRewind(p);
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
  for (const p of [speaker, headphones, keepAwake, speakerLub, speakerDub, headphonesLub, headphonesDub]) {
    if (!p) continue;
    try {
      p.pause();
    } catch {
      /* al weg */
    }
  }
}
