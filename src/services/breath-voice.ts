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

/** Breath-cue URLs. Generieke files zeggen 'through your X' (oudere ElevenLabs
 *  takes); Boost-specifieke files zeggen verkort 'through X' (zonder 'your')
 *  matchend met de UI tekst.
 *
 *  Iter v170 (2026-06-28): Boost-cues toegevoegd. Operator nam 2 nieuwe MP3's
 *  op voor de korte vorm. Andere modes (focus, calm, clarity, rest) blijven
 *  op de oudere "your nose/mouth" cues totdat operator nieuwe opnames
 *  beschikbaar heeft.
 *
 *  Per-protocol selectie via getCueUrl() hieronder. */
const CUE_URLS = {
  inhaleNose:        `${CDN_BASE}/Inhale%20through%20your%20nose..mp3`,
  hold:              `${CDN_BASE}/Hold.mp3`,
  exhaleNose:        `${CDN_BASE}/Exhale%20through%20your%20nose..mp3`,
  exhaleMouth:       `${CDN_BASE}/Exhale%20through%20your%20mouth..mp3`,
  /* Iter v170: Boost-specifieke takes — korte vorm matcht UI 'through nose/mouth' */
  boostInhaleNose:   `${CDN_BASE}/Boost_%20inhale%20through%20nose.mp3`,
  boostExhaleMouth:  `${CDN_BASE}/Boost%20exhale%20through%20mouth.mp3`,
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

/* Iter v170 (2026-06-28): voice-source ownership. Voorkomt dubbele cues
   wanneer breath-tab sessie loopt EN bracelet active sessie breathwork
   tegelijk activeert. Wie als laatste claimVoiceSource() aanroept "wint"
   en alleen die source's playBreathCue() doet daadwerkelijk geluid.
   Andere cues = silent no-op (geen interferentie). releaseVoiceSource()
   bij session-end zodat een latere solo-sessie weer kan claimen. */
export type VoiceSource = 'breath' | 'bracelet';
let activeVoiceSource: VoiceSource | null = null;

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

/** Iter v170 (2026-06-28): claim voice-ownership voor één source. Een
 *  tweede claim (bv. bracelet active start terwijl breath-tab nog speelt)
 *  vervangt de eerste — oude source's cues stoppen direct en latere
 *  playBreathCue() calls van die source worden no-op tot ze opnieuw claimen
 *  of de huidige sessie eindigt. */
export function claimVoiceSource(source: VoiceSource): void {
  if (activeVoiceSource !== null && activeVoiceSource !== source) {
    /* Onderbreking — stop huidige cue zodat oude source niet doorpoept. */
    stopVoice();
  }
  activeVoiceSource = source;
}

/** Iter v170: vrijgeven aan einde van een sessie of bij cleanup. */
export function releaseVoiceSource(source: VoiceSource): void {
  if (activeVoiceSource === source) {
    activeVoiceSource = null;
    stopVoice();
  }
}

/** Speel de juiste cue voor een phase + protocol. Optionele `key` selecteert
 *  protocol-specifieke cues waar beschikbaar (iter v170: Boost heeft eigen
 *  korte takes; andere modes vallen terug op generieke cues). */
export function playBreathCue(
  phase: BreathPhase,
  exhaleVia: ExhaleVia,
  key?: BreathKey,
  source?: VoiceSource,
  /** Negeer de globale voorkeur `voiceCues`.
   *
   *  Nodig voor schermen die een EIGEN zichtbare Voice-schakelaar hebben,
   *  of waar de gebruiker net zelf op "Voice" getikt heeft. Die tik ís de
   *  toestemming; hem dan alsnog tegen een instelling in Settings houden
   *  levert stilte op zonder uitleg.
   *
   *  Dit was de oorzaak van het steeds terugkerende "geen geluid":
   *  `voiceCues` staat standaard UIT, en de root-layout zet die waarde bij
   *  elke start opnieuw door. Die effect-keten is asynchroon, dus tikte je
   *  vlak na het openen op een kaart, dan zette het scherm de vlag aan,
   *  begon de cue, en zette de root hem een tel later weer uit. Vandaar dat
   *  het de ene keer wel werkte en de andere keer niet. */
  force = false,
): void {
  if (!voiceEnabled && !force) return;
  /* Iter v170: silently no-op als er een andere source de voice claimt.
     Voorkomt dat breath-tab cues door bracelet active heen spelen of
     vice versa. Calls zonder source parameter blijven backwards-compat
     en spelen altijd af. */
  if (source && activeVoiceSource !== null && activeVoiceSource !== source) {
    return;
  }
  let url: string;
  if (phase === 'inhale') {
    url = key === 'boost' ? CUE_URLS.boostInhaleNose : CUE_URLS.inhaleNose;
  } else if (phase === 'hold-in' || phase === 'hold-out') {
    url = CUE_URLS.hold;
  } else if (phase === 'exhale') {
    if (key === 'boost') {
      /* Boost-specifieke exhale = mouth (Bhastrika-adapted, nose-in/mouth-out). */
      url = CUE_URLS.boostExhaleMouth;
    } else {
      url = exhaleVia === 'mouth' ? CUE_URLS.exhaleMouth : CUE_URLS.exhaleNose;
    }
  } else return;
  playUrl(url);
}

/** Speel het completion-bestand voor het juiste protocol.
 *
 *  TERUGGEDRAAID op 3 augustus 2026 (operator): dit was een "always-play"
 *  moment dat `voiceEnabled` bewust negeerde — de redenering was dat wie
 *  z'n sessie afmaakt z'n afsluiting verdient, ook met de stem uit. Dat
 *  klopt niet. Wie het geluid uitzet, of alleen via trillingen begeleid
 *  wordt (telefoon of bracelet), heeft dat niet gezegd over de ademcues
 *  maar over de APP. Onaangekondigd een minuut spraak starten aan het eind
 *  van een stille sessie is precies wat zo iemand niet wil — 's avonds,
 *  naast een slapende partner, of met de telefoon in gezelschap.
 *
 *  Stilte is nu de veilige stand. `force` blijft bestaan voor schermen met
 *  een EIGEN zichtbare stemknop, zodat die knop leidend blijft; zie
 *  playBreathCue hierboven voor waarom die uitzondering nodig is. */
export function playCompletionCue(key: BreathKey, force = false): void {
  if (!voiceEnabled && !force) return;
  const url = COMPLETION_URLS[key];
  if (!url) return;
  playUrl(url);
}

/** Maak de spelers alvast aan zonder te spelen.
 *
 *  Nodig op schermen waar één losse cue wordt afgespeeld i.p.v. een reeks.
 *  Een speler voor een REMOTE bestand moet eerst laden; `play()` op een
 *  speler die nog niets heeft ingeladen levert stilte op. In een sessie valt
 *  dat niet op — de tweede cue speelt wél, want dan is het bestand er. Bij
 *  één enkele tik hoor je gewoon niets.
 *
 *  Aanroepen bij het openen van zo'n scherm; daarna is de eerste tik hoorbaar. */
export function preloadBreathCues(): void {
  for (const url of Object.values(CUE_URLS)) {
    try {
      const player = getOrCreatePlayer(url);
      /* Stil één keer aantikken zet het ophalen in gang. Of dat lukt is niet
         zeker — daarom leunt het afspelen zelf er ook niet op, dat probeert
         het gewoon een paar keer opnieuw. Dit scheelt alleen de eerste
         wachttijd wanneer het wél werkt. */
      player.volume = 0;
      player.play();
      setTimeout(() => {
        try {
          player.pause();
          player.seekTo(0);
          player.volume = 1;
        } catch {
          /* swallow */
        }
      }, 500);
    } catch {
      /* swallow — falen mag het scherm niet breken */
    }
  }
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
    } catch {
      /* swallow — pause op een al-niet-spelende player is harmless */
    }
  }

  try {
    const player = getOrCreatePlayer(url);
    activePlayer = player;

    /* METEEN starten, en daarna een paar keer opnieuw proberen.
   
       Hier stond een versie die eerst wachtte tot `isLoaded` waar werd. Dat
       leek logisch maar was fout: bij een bestand op afstand blijft die vlag
       in de praktijk vals staan (we zagen `loaded=false` terwijl de duur al
       bekend was), waardoor het startsein nóóit kwam en er helemaal geen
       geluid meer was. Wachten op een toestand die niet betrouwbaar omslaat
       is erger dan het gewoon proberen.

       Dus: direct spelen. Is het bestand er nog niet, dan doet die eerste
       poging niets — en dan pakken de herhalingen het op zodra het binnen
       is. `play()` op iets dat al speelt is onschadelijk, dus dit kan geen
       dubbel geluid geven. */
    const attempt = () => {
      if (activePlayer !== player) return true;
      try {
        if (player.playing) return true;
        player.seekTo(0);
        player.play();
      } catch {
        /* swallow */
      }
      return false;
    };

    attempt();

    /* Oplopende tussenpozen: snel genoeg om niet als vertraging te voelen,
       ruim genoeg om een trage verbinding op te vangen. */
    for (const ms of [120, 300, 650, 1200, 2000]) {
      setTimeout(() => {
        if (activePlayer !== player) return;
        if (player.playing) return;
        try {
          player.seekTo(0);
          player.play();
        } catch {
          /* swallow */
        }
      }, ms);
    }

    if (__DEV__) {
      console.log(
        '[breath-voice] play',
        url.split('/').pop(),
        'loaded=',
        player.isLoaded,
        'playing=',
        player.playing,
      );
    }
  } catch (e) {
    /* swallow — audio-failure mag de sessie niet breken */
    if (__DEV__) {
      console.warn(
        '[breath-voice] play FAILED:',
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}
