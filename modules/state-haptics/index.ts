/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — JS-kant van de native State Control-hapticspeler.

   Android-only gelinkt (expo-module.config.json). Op iOS/web/Expo Go is
   `native` null en valt bracelet-haptics.ts terug op expo-haptics. */

import { requireNativeModule } from 'expo-modules-core';

type StateHapticsNativeModule = {
  hasAmplitudeControl(): boolean;
  play(timings: number[], amplitudes: number[], repeat: number): void;
  stop(): void;
};

let native: StateHapticsNativeModule | null = null;
try {
  native = requireNativeModule<StateHapticsNativeModule>('StateHaptics');
} catch {
  native = null;
}

/** true enkel als de native module gelinkt is ÉN het toestel echte
 *  amplitude-sturing heeft — anders klopt "subtiel" niet en hoort de
 *  aanroeper terug te vallen. */
export function canPlayNativeWaveform(): boolean {
  try {
    return native?.hasAmplitudeControl() ?? false;
  } catch {
    return false;
  }
}

export function playNativeWaveform(timings: number[], amplitudes: number[], repeat: number): void {
  try {
    native?.play(timings, amplitudes, repeat);
  } catch {
    /* stil */
  }
}

export function stopNativeWaveform(): void {
  try {
    native?.stop();
  } catch {
    /* stil */
  }
}
