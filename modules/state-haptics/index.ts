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
  startSession(
    timings: number[],
    amplitudes: number[],
    title: string,
    sessionTotalSec: number,
    sessionElapsedSec: number,
  ): Promise<void>;
  pauseSession(): Promise<void>;
  stopSession(): Promise<void>;
  hasVibrator(): boolean;
  sessionStatus(): NativeSessionStatus;
  dismissCompletionNotice(): void;
  addListener(
    event: 'onRemoteControl',
    cb: (e: { action: 'pause' | 'resume' }) => void,
  ): { remove(): void };
};

export type NativeSessionStatus = 'none' | 'starting' | 'running' | 'paused';

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

/** Echte sessie via de voorgrondservice — loopt door met het scherm op
 *  slot (Android breekt gewone app-trillingen af bij vergrendelen) en toont
 *  modus + resterende tijd op het vergrendelscherm. */
export function startNativeSession(
  timings: number[],
  amplitudes: number[],
  title: string,
  sessionTotalSec: number,
  sessionElapsedSec: number,
): void {
  try {
    void native?.startSession(timings, amplitudes, title, sessionTotalSec, sessionElapsedSec).catch(() => {});
  } catch {
    /* stil */
  }
}

export function stopNativeSession(): void {
  try {
    void native?.stopSession().catch(() => {});
  } catch {
    /* stil */
  }
}

/** Pauzeert de lopende service-sessie: de melding blijft op het vergrendel-
 *  scherm staan met een hervat-knop. */
export function pauseNativeSession(): void {
  try {
    void native?.pauseSession().catch(() => {});
  } catch {
    /* stil */
  }
}

/** Pauze/hervat-knop op het vergrendelscherm. De service reageert zelf al
 *  meteen; dit laat de app (sessie-monitor, bracelet) meegaan. */
export function addRemoteControlListener(cb: (action: 'pause' | 'resume') => void): () => void {
  try {
    const sub = native?.addListener('onRemoteControl', (e) => cb(e.action));
    return () => sub?.remove();
  } catch {
    return () => {};
  }
}

/** false op een toestel zonder trilmotor (bv. veel tablets): daar voelt de
 *  gebruiker niets, en dat hoort de app te zeggen in plaats van een sessie
 *  te tonen die "loopt". Zonder native module: aanname true. */
export function deviceCanVibrate(): boolean {
  try {
    return native?.hasVibrator() ?? true;
  } catch {
    return true;
  }
}

/** Bestaat er een service-sessie (ook als JS net herladen is)? De service is
 *  de bron van waarheid, niet een vlag in JS. */
export function getNativeSessionStatus(): NativeSessionStatus {
  try {
    return native?.sessionStatus() ?? 'none';
  } catch {
    return 'none';
  }
}

/** Haalt de "Session complete"-melding van de service weg — de app toont de
 *  afsluiting zelf, een tweede melding is dan dubbel. */
export function dismissCompletionNotice(): void {
  try {
    native?.dismissCompletionNotice();
  } catch {
    /* stil */
  }
}
