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

let voiceEnabled = true;

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

/** Speel de start-cue voor een bracelet-sessie. Idempotent per sessieKey
 *  — een sessieKey is typisch `${mode}-${duration}-${startTime}` zodat
 *  twee opeenvolgende sessies (zelfde mode, ander tijdstip) beide hun
 *  eigen start-cue krijgen. */
export function playBraceletStartCue(
  mode: BraceletMode,
  sessionKey: string,
): void {
  if (!voiceEnabled) return;
  if (startedForSession === sessionKey) return;
  const cue = MODE_CUES[mode]?.start;
  if (!cue) return;
  startedForSession = sessionKey;
  try {
    Speech.speak(cue, {
      rate: 0.95,
      pitch: 1.0,
      language: 'en-US',
    });
  } catch {
    /* swallow — TTS-failure mag de sessie nooit breken */
  }
}

/** Speel de completion-cue. NIET gegate'd op voiceEnabled: completion is
 *  een speciaal "always-play" moment (mirror van breath-voice.ts
 *  playCompletionCue). User heeft z'n sessie afgemaakt en verdient z'n
 *  closing-reward, ook als 'ie mid-sessie de toggle uitzette. */
export function playBraceletCompletionCue(mode: BraceletMode): void {
  const cue = MODE_CUES[mode]?.end;
  if (!cue) return;
  /* Reset sessie-state zodat een volgende sessie weer een start-cue krijgt. */
  startedForSession = null;
  try {
    Speech.speak(cue, {
      rate: 0.9,
      pitch: 1.0,
      language: 'en-US',
    });
  } catch {
    /* swallow */
  }
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
