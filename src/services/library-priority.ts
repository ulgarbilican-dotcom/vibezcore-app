/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Audio-voorrang voor de Audio Library (19 okt 2026).

   Operator: "als de Audio Library speelt, start een Breathwork- of State
   Control-sessie ZONDER stem en ZONDER hartslaggeluid (enkel haptiek en
   beeld); de bibliotheek blijft spelen. Omgekeerd mag ook: start je de
   bibliotheek tijdens een sessie, dan zwijgen stem/hartslag van de sessie
   zolang de bibliotheek speelt." Nooit twee stemmen of klanken over elkaar.

   Eén bron voor "speelt de bibliotheek nu?" (audio-player.ts `playing`).
   De opgeslagen voorkeur van de gebruiker (stem aan, Haptic + Audio) wordt
   NOOIT aangepast — enkel het afspelen zelf wacht. Pauzeert of stopt de
   bibliotheek, dan mag de stem/hartslag weer bij de volgende zin of slag.
   ───────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';
import { getSnapshot, subscribePlayerState } from './audio-player';

/** Een korte hapering (bufferen, verspringen) is geen echte pauze: pas na
 *  zoveel ms "niet spelend" mag de sessie weer klinken. Starten van de
 *  bibliotheek telt meteen. */
const RELEASE_DELAY_MS = 800;

let current = false;
let hooked = false;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(playing: boolean) => void>();

function emit(v: boolean): void {
  if (v === current) return;
  current = v;
  listeners.forEach((l) => {
    try {
      l(v);
    } catch {
      /* een luisteraar mag de andere nooit breken */
    }
  });
}

function ensureHooked(): void {
  if (hooked) return;
  hooked = true;
  current = !!getSnapshot().playing;
  subscribePlayerState(() => {
    const now = !!getSnapshot().playing;
    if (now) {
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      emit(true);
      return;
    }
    if (!current || releaseTimer) return;
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      emit(!!getSnapshot().playing);
    }, RELEASE_DELAY_MS);
  });
}

/** Speelt de Audio Library nu (niet gepauzeerd)? */
export function isLibraryPlaying(): boolean {
  ensureHooked();
  return current || !!getSnapshot().playing;
}

/** Luisteraar op begin/einde van het spelen van de bibliotheek. */
export function subscribeLibraryPlaying(cb: (playing: boolean) => void): () => void {
  ensureHooked();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useLibraryPlaying(): boolean {
  const [v, setV] = useState(() => isLibraryPlaying());
  useEffect(() => {
    setV(isLibraryPlaying());
    return subscribeLibraryPlaying(setV);
  }, []);
  return v;
}
