/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — JS-kant van de native State Control-hapticspeler.

   Android-only gelinkt (expo-module.config.json). Op iOS/web/Expo Go is
   `native` null en valt bracelet-haptics.ts terug op expo-haptics. */

import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type StateHapticsNativeModule = {
  setSessionSound?(on: boolean): void;
  setSessionHaptics?(on: boolean): void;
  hasAmplitudeControl(): boolean;
  play(timings: number[], amplitudes: number[], repeat: number, maxMs: number): void;
  stop(): void;
  startSession(
    timings: number[],
    amplitudes: number[],
    title: string,
    sessionTotalSec: number,
    sessionElapsedSec: number,
    preview: boolean,
    startAtWallMs: number,
  ): Promise<void>;
  pauseSession(): Promise<void>;
  stopSession(): Promise<void>;
  hasVibrator(): boolean;
  audioOutputExtraMs?(): number;
  audioOutputDevice?(): AudioOutputDevice | null;
  setAudioCorrection?(key: string, ms: number): void;
  clearAudioCorrection?(key: string): void;
  startCalibrationBeat?(periodMs: number, vibrate: boolean): number;
  setCalibrationVibrate?(on: boolean): void;
  stopCalibrationBeat?(): void;
  sessionStatus(): NativeSessionStatus;
  dismissCompletionNotice(): void;
  addListener(
    event: 'onRemoteControl',
    cb: (e: { action: 'pause' | 'resume' }) => void,
  ): { remove(): void };
  addListener(event: 'onHealthRationale', cb: (e: { action: string }) => void): { remove(): void };
  launchAction?(): string;
};

const HEALTH_RATIONALE_ACTIONS = new Set([
  'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
  'android.intent.action.VIEW_PERMISSION_USAGE',
]);

/** Werd de app geopend vanuit het Health Connect-toestemmingsscherm
 *  ("privacybeleid")? Dan hoort de privacyverklaring meteen te openen. */
export function launchedForHealthRationale(): boolean {
  try {
    return HEALTH_RATIONALE_ACTIONS.has(native?.launchAction?.() ?? '');
  } catch {
    return false;
  }
}

/** Zelfde vraag terwijl de app al draaide. */
export function onHealthRationale(cb: () => void): () => void {
  try {
    const sub = native?.addListener('onHealthRationale', () => cb());
    return () => sub?.remove();
  } catch {
    return () => {};
  }
}

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

/** `maxMs`: een herhalend patroon stopt native uiterlijk na deze tijd, ook
 *  als JavaScript intussen stilvalt (0 = geen grens). */
export function playNativeWaveform(timings: number[], amplitudes: number[], repeat: number, maxMs = 0): void {
  try {
    native?.play(timings, amplitudes, repeat, maxMs);
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
  /** Gratis voorproef: zelfde vergrendelscherm, geen "Session complete". */
  preview = false,
  /** Wandklok-moment van de eerste slag (0 = meteen). */
  startAtWallMs = 0,
): void {
  try {
    void native
      ?.startSession(timings, amplitudes, title, sessionTotalSec, sessionElapsedSec, preview, startAtWallMs)
      .catch(() => {});
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

/** Feel & Hear (10 okt 2026): hartslaggeluid op elke slag van de native
 *  sessie (Android), ook op slot. Geen native → false (JS speelt het dan
 *  zelf af, zolang de app open is). */
export function setNativeSessionSound(on: boolean): boolean {
  if (!native?.setSessionSound) return false;
  try {
    native.setSessionSound(on);
    return true;
  } catch {
    return false;
  }
}

/** De lopende native sessie trilt (niet) mee — geluid en beeld lopen door
 *  (31 okt 2026, het horloge neemt de trilling over). Oudere build zonder
 *  deze functie → false (de app herstart dan stil, zoals vroeger). */
export function setNativeSessionHaptics(on: boolean): boolean {
  if (!native?.setSessionHaptics) return false;
  try {
    native.setSessionHaptics(on);
    return true;
  } catch {
    return false;
  }
}

/** Huidige Bluetooth-uitgang met zijn Sound timing-correctie (31 okt 2026). */
export type AudioOutputDevice = {
  key: string;
  name: string;
  /** Wat het toestel zelf meldt (zonder correctie). */
  reportedMs: number;
  correctionMs: number;
  /** Ooit ingesteld met Sound timing (ook als de correctie 0 is). */
  calibrated: boolean;
};

export function getNativeAudioOutputDevice(): AudioOutputDevice | null {
  try {
    return native?.audioOutputDevice?.() ?? null;
  } catch {
    return null;
  }
}

export function setNativeAudioCorrection(key: string, ms: number): void {
  try {
    native?.setAudioCorrection?.(key, ms);
  } catch {
    /* stil */
  }
}

export function clearNativeAudioCorrection(key: string): void {
  try {
    native?.clearAudioCorrection?.(key);
  } catch {
    /* stil */
  }
}

/** Proefslag; geeft het wandklok-moment van slag 0, of 0 zonder native. */
export function startNativeCalibrationBeat(periodMs: number, vibrate: boolean): number {
  try {
    return native?.startCalibrationBeat?.(periodMs, vibrate) ?? 0;
  } catch {
    return 0;
  }
}

export function setNativeCalibrationVibrate(on: boolean): void {
  try {
    native?.setCalibrationVibrate?.(on);
  } catch {
    /* stil */
  }
}

export function stopNativeCalibrationBeat(): void {
  try {
    native?.stopCalibrationBeat?.();
  } catch {
    /* stil */
  }
}

/** Extra geluidsvertraging van de huidige uitgang (Bluetooth), 0 = luidspreker. */
export function getAudioOutputExtraMs(): number {
  try {
    return native?.audioOutputExtraMs?.() ?? 0;
  } catch {
    return 0;
  }
}
