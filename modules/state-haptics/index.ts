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

/** Native module gelinkt (Android-dev/prod-build) — dan kan de hele curve
 *  los van de JS-thread afspelen, ook met het scherm op slot. */
export function hasNativeWaveform(): boolean {
  return native !== null;
}

/** true als het toestel ook echte amplitude-sturing heeft. Zonder (bv.
 *  Galaxy A16: capabilities = []) negeert de hardware elke sterkte en
 *  bepaalt enkel de DUUR van een tik hoe sterk hij voelt. */
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
