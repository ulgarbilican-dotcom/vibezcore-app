/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — JS-kant van de native State Control-hapticspeler.

   Android-only gelinkt (expo-module.config.json). Op iOS/web/Expo Go is
   `native` null en valt bracelet-haptics.ts terug op expo-haptics. */

import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

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

/** Native module gelinkt én Android 8+ (API 26, VibrationEffect.createWaveform)
 *  — dan kan de hele curve los van de JS-thread afspelen, ook met het
 *  scherm op slot. Android 7 valt terug op expo-haptics. */
export function hasNativeWaveform(): boolean {
  return native !== null && Platform.OS === 'android' && Number(Platform.Version) >= 26;
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
