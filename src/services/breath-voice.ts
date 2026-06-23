/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Breath voice cues

   Lichte audio-cue service voor de breath-tab. Speelt korte voice-files
   af op fase-overgangen (Inhale / Hold / Exhale) en bij completion van
   een sessie.

   Architectuur:
     - Eén persistente AudioPlayer-instance per cue-URL, lazy-initialized
       bij eerste play. Cached zodat herhaalde plays niet steeds een
       nieuwe loader triggeren.
     - Geen native TTS — gebruikt expo-audio (al in dev-build, geen
       rebuild vereist). Audio assets liggen op Bunny CDN.
     - Voice-toggle via setVoiceEnabled(); wanneer disabled doen alle
       play-calls niets en wordt eventuele ongoing utterance gestopt.
     - Phase-cue kiest automatisch de juiste exhale-file op basis van
       pattern.exhaleVia ('nose' vs 'mouth').

   Iter 9dq v185 (operator 2026-06-18): Vervangt de expo-speech TTS-stub
   die een native rebuild vereiste. Pre-recorded audio (ElevenLabs) +
   expo-audio = werkt direct in de bestaande dev-build.
   ─────────────────────────────────────────────────────────────────── */

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/* ── Asset URLs op Bunny CDN ───────────────────────────────────────── */

const CDN_BASE = 'https://vibezcore-audio.b-cdn.net/Breathwork%20audio';

/** Vier breath-cue URLs. Inhale is altijd nose (alle 5 protocols hebben
 *  inhaleVia: 'nose'). Exhale wisselt: nose voor focus + calm, mouth
 *  voor boost + clarity + rest. */
const CUE_URLS = {
  inhaleNose:   `${CDN_BASE}/Inhale%20through%20your%20nose..mp3`,
  hold:         `${CDN_BASE}/Hold.mp3`,
  exhaleNose:   `${CDN_BASE}/Exhale%20through%20your%20nose..mp3`,
  exhaleMouth:  `${CDN_BASE}/Exhale%20through%20your%20mouth..mp3`,
} as const;

/** Vijf completion-files, één per protocol-key. Lange motiverende
 *  monoloog die de visuele completion-modal aanvult.
 *  Iter 9dq v186 (operator 2026-06-18): boost + focus finished
 *  vervangen door nieuwe takes (filename heeft trailing space). */
const COMPLETION_URLS: Record<BreathKey, string> = {
  boost:   `${CDN_BASE}/boost%20finished%20.mp3`,
  focus:   `${CDN_BASE}/focus%20finished%20.mp3`,
  calm:    `${CDN_BASE}/calm%20finished.mp3`,
  clarity: `${CDN_BASE}/clarity%20finished.mp3`,
  rest:    `${CDN_BASE}/rest%20finished.mp3`,
};

export type BreathKey = 'boost' | 'focus' | 'calm' | 'clarity' | 'rest';
export type BreathPhase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';
export type ExhaleVia = 'nose' | 'mouth';

/* ── State ─────────────────────────────────────────────────────────── */

let voiceEnabled = true;

/* Cache: één AudioPlayer per unieke URL. Lazy-init bij eerste play.
   AudioPlayer-instances overleven over de tab-levensduur — geen overhead
   na de eerste warmup. */
const playerCache = new Map<string, AudioPlayer>();

/** Track de laatst gestarte player zodat we 'm kunnen pause'en wanneer
 *  een nieuwe cue start (anders stapelen overlappende cues). */
let activePlayer: AudioPlayer | null = null;

/* ── Public API ────────────────────────────────────────────────────── */

/** Voice cues aan/uit zetten. Bij uit-zetten stopt eventuele actieve cue. */
export function setVoiceEnabled(enabled: boolean): void {
  voiceEnabled = enabled;
  if (!enabled) stopVoice();
}

/** Speel de juiste cue voor een phase + protocol. */
export function playBreathCue(
  phase: BreathPhase,
  exhaleVia: ExhaleVia,
): void {
  if (!voiceEnabled) return;
  let url: string;
  if (phase === 'inhale') url = CUE_URLS.inhaleNose;
  else if (phase === 'hold-in' || phase === 'hold-out') url = CUE_URLS.hold;
  else if (phase === 'exhale') {
    url = exhaleVia === 'mouth' ? CUE_URLS.exhaleMouth : CUE_URLS.exhaleNose;
  } else return;
  playUrl(url);
}

/** Speel het completion-bestand voor het juiste protocol.
 *  Iter 9dq v186 (operator-fix 2026-06-18): NIET gegate'd op voiceEnabled.
 *  Completion is een speciaal "always-play" moment — de gebruiker heeft
 *  z'n sessie afgemaakt en verdient z'n motiverende reward, ook als 'ie
 *  de toggle uitgezet had tijdens het ademen (typisch om mid-sessie
 *  verbal guidance uit te schakelen). */
export function playCompletionCue(key: BreathKey): void {
  const url = COMPLETION_URLS[key];
  if (!url) return;
  playUrl(url);
}

/** Stop alle ongoing voice playback. Call bij session-cleanup,
 *  voice-toggle-off, of bij tab-unmount. */
export function stopVoice(): void {
  if (activePlayer) {
    try {
      activePlayer.pause();
      activePlayer.seekTo(0);
    } catch {
      /* swallow — pause op een al-niet-spelende player is harmless */
    }
    activePlayer = null;
  }
}

/* ── Internals ─────────────────────────────────────────────────────── */

function getOrCreatePlayer(url: string): AudioPlayer {
  let player = playerCache.get(url);
  if (!player) {
    player = createAudioPlayer({ uri: url });
    playerCache.set(url, player);
  }
  return player;
}

function playUrl(url: string): void {
  /* Stop een eventueel andere lopende cue zodat ze niet overlappen
     (overlappen = onverstaanbaar bij snel volgende phase-cues). */
  if (activePlayer && activePlayer !== playerCache.get(url)) {
    try {
      activePlayer.pause();
      activePlayer.seekTo(0);
    } catch {}
  }
  try {
    const player = getOrCreatePlayer(url);
    /* Rewind voor 't geval deze cue eerder al gespeeld is — zonder
       seekTo(0) speelt 'ie verder vanaf waar 'ie stopte. */
    player.seekTo(0);
    player.play();
    activePlayer = player;
  } catch {
    /* swallow — audio-failure mag de sessie niet breken */
  }
}
