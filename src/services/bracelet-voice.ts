/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet voice cues (TTS via expo-speech)

   Operator-feedback 2026-06-25: bracelet active page mag voice guidance
   krijgen zoals breathwork, MAAR zonder haptische trillingen want die
   zouden clashen met de bracelet's eigen vibraties.

   Aanpak:
     - Light-touch: alleen start- en completion-cue per sessie.
       GEEN phase-cues (anders dan breathwork) want bracelet-sessies van
       15-45 min hebben geen discrete fasen. Mid-session cues zouden de
       trance/focus alleen maar breken.
     - TTS via expo-speech (system voice) ipv pre-recorded audio.
       Reden: geen audio files nodig, werkt direct in productie. ElevenLabs
       upgrade kan later als operator dat wil — service-API verandert dan
       niet, alleen de implementatie.
     - Globaal aan/uit via setVoiceEnabled() — Settings-toggle in dezelfde
       stijl als breath voice-toggle.
     - Idempotent: dubbele calls naar dezelfde phase doen niets.

   Iter v147 (2026-06-25).
   ─────────────────────────────────────────────────────────────────────── */

import * as Speech from 'expo-speech';
import type { BraceletMode } from '@/services/ble-contract';
import { playCompletionCue, type BreathKey } from '@/services/breath-voice';

/* Iter v168 (2026-06-28): bracelet-mode → breath-key mapping zodat we de
   pre-recorded ElevenLabs MP3-cues van breath-voice.ts kunnen hergebruiken
   voor de bracelet completion. Operator-feedback: 'bij bracelet active
   pagina breathwork op einde sessies heb jij zelf een stem en popup
   gegenereerd dat is niet goed. moet exact hetzelfde einde popup tekst en
   stem zijn zoals in breath tabblad'. Mode index volgt CLAUDE.md §5. */
const MODE_TO_BREATH_KEY: Record<BraceletMode, BreathKey> = {
  0: 'boost',    // Gamma → Boost
  1: 'focus',    // Beta → Sharp Focus
  2: 'calm',     // Alpha → Calm Control
  3: 'clarity',  // Theta → Clarity
  4: 'rest',     // Delta → Rest & Reset
};

/* ── Per-mode copy ─────────────────────────────────────────────────────
   Korte, neutrale teksten. Geen wetenschapsclaims (CLAUDE.md §1) — alleen
   toestand-taal (focus, kalmte, rust). Per mode 2 strings: start en end.

   Naming volgt §5 van CLAUDE.md (mode-naam zoals user 'm ziet, niet de
   technische frequency-naam). */
const MODE_CUES: Record<BraceletMode, { start: string; end: string }> = {
  /* Gamma → Boost */
  0: {
    start: 'Boost session beginning. Stay present.',
    end: 'Boost session complete. Carry the energy with you.',
  },
  /* Beta → Sharp Focus */
  1: {
    start: 'Sharp Focus beginning. Settle in.',
    end: 'Focus session complete. Well done.',
  },
  /* Alpha → Calm Control */
  2: {
    start: 'Calm Control beginning. Breathe out.',
    end: 'Calm Control complete. Carry the calm forward.',
  },
  /* Theta → Clarity */
  3: {
    start: 'Clarity session beginning. Let things settle.',
    end: 'Clarity session complete. Notice the space.',
  },
  /* Delta → Rest & Reset */
  4: {
    start: 'Rest and Reset beginning. Soften.',
    end: 'Rest complete. Take your time returning.',
  },
};

/* ── State ─────────────────────────────────────────────────────────── */

/* Iter v149 v3 (2026-06-25): operator-feedback — voice was te luid en
   te AI-achtig. Default uit-zetten (user kan zelf inschakelen via
   Settings) zodat een bracelet-activatie tijdens een vergadering nooit
   onverwacht een stem laat klinken. Plus volume verlaagd via rate 0.85
   en lagere pitch zodat het kalmer aanvoelt. */
let voiceEnabled = false;

/** Track of de start-cue al gespeeld is voor de huidige sessie, zodat
 *  her-renders (poll updates) de cue niet opnieuw triggeren. Reset bij
 *  session-end. */
let startedForSession: string | null = null;

/* ── Public API ────────────────────────────────────────────────────── */

/** Voice cues aan/uit. Bij uit-zetten stopt ook een eventuele lopende
 *  utterance. */
export function setVoiceEnabled(enabled: boolean): void {
  voiceEnabled = enabled;
  if (!enabled) {
    try {
      Speech.stop();
    } catch {
      /* swallow */
    }
  }
}

export function isVoiceEnabled(): boolean {
  return voiceEnabled;
}

/** Iter v159 (2026-06-26): NO-OP. Operator-feedback: 'gewoon geen stem
 *  voor starten bracelet sessies — robotachtige TTS klinkt slecht plus
 *  user wil misschien stilte tijdens vergadering'. Start-cue compleet
 *  verwijderd. Method blijft voor backwards-compat zodat callers niet
 *  hoeven aangepast te worden — doet gewoon niets meer.
 *
 *  Completion-cue blijft wel actief (zie playBraceletCompletionCue) —
 *  dat is een afsluitend reward-moment dat user heeft verdiend. */
export function playBraceletStartCue(
  _mode: BraceletMode,
  _sessionKey: string,
): void {
  /* intentionally empty */
}

/** Speel de completion-cue.
 *
 *  Was "always-play", net als bij breath. Teruggedraaid op 3 augustus 2026
 *  (operator): wie de bracelet stil draagt of het geluid uit heeft staan,
 *  hoort ook geen afsluiting. De poort zit in breath-voice.ts
 *  playCompletionCue; hier wordt niet geforceerd, dus die geldt.
 *
 *  Iter v168 (2026-06-28): NU gebruikt dezelfde ElevenLabs MP3 als de
 *  breath-tab — `boost finished .mp3`, `calm finished.mp3`, etc. Voorheen
 *  TTS via expo-speech met door mij verzonnen tekst — operator wees dat
 *  af ('je hebt zelf een stem gegenereerd dat is niet goed'). MP3 cues
 *  zijn door operator opgenomen via ElevenLabs en zijn de canonical
 *  bracelet-completion audio. */
export function playBraceletCompletionCue(mode: BraceletMode): void {
  /* Reset sessie-state zodat een volgende sessie weer een start-cue krijgt. */
  startedForSession = null;
  const key = MODE_TO_BREATH_KEY[mode];
  if (!key) return;
  playCompletionCue(key);
}

/** Stop alle voice-output direct. Roep aan bij sessie-cancel /
 *  screen-unmount / fault. */
export function stopBraceletVoice(): void {
  startedForSession = null;
  try {
    Speech.stop();
  } catch {
    /* swallow */
  }
}
