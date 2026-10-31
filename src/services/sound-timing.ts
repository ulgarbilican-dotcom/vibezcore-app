/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Sound timing: correctie per Bluetooth-toestel (31 okt 2026,
   operator: "ja" + "wel belangrijk dat het voor alle toestellen met
   bluetooth connectie werkt").

   Waarom: oortjes melden zelf hoeveel later ze geluid afspelen (Android:
   AudioTrack-latentie, iPhone: outputLatency). Die melding klopt niet altijd
   — gemeten op de A16: het hartslaggeluid kwam NA de trilling, terwijl de
   app exact de gemelde vertraging vooruit startte. Elke automatische meting
   leest diezelfde melding, dus enkel de gebruiker zelf kan het echte verschil
   aangeven: één keer meetikken op de slag. De correctie wordt bewaard per
   toestel (native: SharedPreferences / UserDefaults) en geldt daarna overal
   in de app: State Control-hartslaggeluid, ademstem, rusthartslag-pagina.

   Uitleg van de berekening: docs/VIBEZCORE_SCIENCE_A_TOT_Z.md (Sound timing).
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  clearIosAudioCorrection,
  getIosAudioOutputDevice,
  prepareHeartbeatSounds,
  setIosAudioCorrection,
  setSessionBeatHaptics,
  startSessionBeats,
  stopSessionBeats,
} from '../../modules/session-audio';
import {
  clearNativeAudioCorrection,
  getNativeAudioOutputDevice,
  setNativeAudioCorrection,
  setNativeCalibrationVibrate,
  startNativeCalibrationBeat,
  stopNativeCalibrationBeat,
} from '../../modules/state-haptics';
import { resetAudioOutputExtraCache } from './audio-latency';
import { HEARTBEAT_VOLUME } from './heartbeat-sound';

export type SoundOutput = {
  key: string;
  name: string;
  correctionMs: number;
  calibrated: boolean;
};

/** Grenzen van de correctie (gelijk aan native). */
export const CORRECTION_MIN_MS = -200;
export const CORRECTION_MAX_MS = 400;

/** Proefslag: 70 bpm — rustig genoeg om lub en dub apart te horen. */
export const CALIBRATION_BPM = 70;
export const CALIBRATION_PERIOD_MS = Math.round(60000 / CALIBRATION_BPM);

/** Mensen tikken gemiddeld iets VÓÓR de slag die ze horen ("negative mean
 *  asynchrony": 20–80 ms, niet-muzikanten gemiddeld ~50 ms; Repp 2005,
 *  Aschersleben 2002). Min ~10 ms omdat de app een tik iets ná het aanraken
 *  registreert → vast 40 ms. Operator, 31 okt 2026: één stap, de gebruiker
 *  regelt niets bij; Earlier/Later is enkel optioneel (Audio & Haptics). */
export const TAP_ANTICIPATION_MS = 40;
/** Eerste tikken weglaten: dan zoekt iedereen nog de maat. */
export const DISCARD_FIRST_TAPS = 2;
export const TAPS_NEEDED = 10;

/** De huidige Bluetooth-uitgang, of null (luidspreker / bedrade oortjes:
 *  daar is geen correctie nodig). */
export function getSoundOutput(): SoundOutput | null {
  const d = Platform.OS === 'ios' ? getIosAudioOutputDevice() : Platform.OS === 'android' ? getNativeAudioOutputDevice() : null;
  if (!d || !d.key) return null;
  return {
    key: d.key,
    name: d.name?.trim() || 'Bluetooth headphones',
    correctionMs: Number.isFinite(d.correctionMs) ? d.correctionMs : 0,
    calibrated: !!d.calibrated,
  };
}

export function clampCorrection(ms: number): number {
  return Math.max(CORRECTION_MIN_MS, Math.min(CORRECTION_MAX_MS, Math.round(ms)));
}

export function setSoundCorrection(key: string, ms: number): void {
  const v = clampCorrection(ms);
  if (Platform.OS === 'ios') setIosAudioCorrection(key, v);
  else setNativeAudioCorrection(key, v);
  resetAudioOutputExtraCache();
}

export function clearSoundCorrection(key: string): void {
  if (Platform.OS === 'ios') clearIosAudioCorrection(key);
  else clearNativeAudioCorrection(key);
  resetAudioOutputExtraCache();
}

/* ── Proefslag ─────────────────────────────────────────────────────────── */

/** Start de proefslag via dezelfde weg als een sessie; geeft het
 *  wandklok-moment van slag 0 (0 = niet beschikbaar). */
export async function startCalibrationBeat(vibrate: boolean): Promise<number> {
  if (Platform.OS === 'android') return startNativeCalibrationBeat(CALIBRATION_PERIOD_MS, vibrate);
  if (Platform.OS !== 'ios') return 0;
  await prepareHeartbeatSounds();
  const firstBeatAtMs = Date.now() + 1200;
  startSessionBeats({
    firstBeatAtMs,
    firstCurveSec: 0,
    startBpm: CALIBRATION_BPM,
    targetBpm: CALIBRATION_BPM,
    holdSec: 24 * 3600,
    rampSec: 0,
    endAtMs: 0,
    sound: true,
    speakerVolume: HEARTBEAT_VOLUME.speaker,
    headphonesVolume: HEARTBEAT_VOLUME.headphones,
    /* zelfde vaste voorsprong als een sessie (bracelet-haptics.ts) */
    soundLeadMs: 25,
    haptics: vibrate,
    lubIntensity: 1,
    lubSharpness: 0.5,
    dubIntensity: 0.7,
    dubSharpness: 0.4,
  });
  return firstBeatAtMs;
}

export function setCalibrationVibrate(on: boolean): void {
  if (Platform.OS === 'android') setNativeCalibrationVibrate(on);
  else if (Platform.OS === 'ios') setSessionBeatHaptics(on);
}

export function stopCalibrationBeat(): void {
  if (Platform.OS === 'android') stopNativeCalibrationBeat();
  else if (Platform.OS === 'ios') stopSessionBeats();
}

/* ── Berekening ────────────────────────────────────────────────────────── */

/** Uit tiktijden (wandklok) en het rooster van de proefslag: hoeveel ms het
 *  geluid later aankomt dan de app denkt (+ = later). null = te weinig of te
 *  ongelijk getikt. */
export function estimateLateMs(tapsMs: number[], firstBeatMs: number, periodMs = CALIBRATION_PERIOD_MS): number | null {
  const devs = tapsMs.slice(DISCARD_FIRST_TAPS).map((t) => {
    const k = Math.round((t - firstBeatMs) / periodMs);
    return t - (firstBeatMs + k * periodMs);
  });
  if (devs.length < TAPS_NEEDED - DISCARD_FIRST_TAPS) return null;
  const sorted = [...devs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  /* Ongelijk getikt (bv. op de dub, of willekeurig): opnieuw vragen. */
  const near = devs.filter((d) => Math.abs(d - median) <= 120);
  if (near.length < Math.ceil(devs.length * 0.75)) return null;
  const nearSorted = near.sort((a, b) => a - b);
  return nearSorted[Math.floor(nearSorted.length / 2)] + TAP_ANTICIPATION_MS;
}

/* ── Eenmalige tip op het State Control-scherm ─────────────────────────── */

const HINT_KEY = 'vz_sound_timing_hint_v1';

async function dismissedKeys(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HINT_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function isHintDismissed(key: string): Promise<boolean> {
  return (await dismissedKeys()).includes(key);
}

export async function dismissHint(key: string): Promise<void> {
  const keys = await dismissedKeys();
  if (keys.includes(key)) return;
  try {
    await AsyncStorage.setItem(HINT_KEY, JSON.stringify([...keys, key]));
  } catch {
    /* stil */
  }
}
