/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — JS-kant van de iPhone-geluidsmotor (19 okt 2026).

   Eén motor voor sessies: hartslag (hele plan in één keer, de motor plant
   elke slag zelf op de geluidsklok), stem-zinnen en tikken. Zie
   ios/SessionAudioModule.swift voor het waarom. Enkel iOS; op Android/web
   en in een build zonder de module is alles hier een stille no-op en geeft
   `isSessionAudioAvailable()` false, zodat de oude weg blijft werken. */

import { requireNativeModule } from 'expo-modules-core';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

export type SessionTap = { t: number; intensity: number; sharpness: number };

export type BeatPlan = {
  firstBeatAtMs: number;
  firstCurveSec: number;
  startBpm: number;
  targetBpm: number;
  holdSec: number;
  rampSec: number;
  /** 0 = tot stopSessionBeats(). */
  endAtMs: number;
  sound: boolean;
  speakerVolume: number;
  headphonesVolume: number;
  soundLeadMs: number;
  haptics: boolean;
  lubIntensity: number;
  lubSharpness: number;
  dubIntensity: number;
  dubSharpness: number;
};

type NativeModule = {
  hapticsSupported(): boolean;
  outputExtraMs?(): number;
  audioOutputDevice?(): IosAudioOutputDevice | null;
  setAudioCorrection?(key: string, ms: number): void;
  clearAudioCorrection?(key: string): void;
  begin(owner: string): void;
  end(owner: string): void;
  releaseSession?(): void;
  hasSound(key: string): boolean;
  loadSound(key: string, uri: string): Promise<boolean>;
  playVoice(key: string, volume: number, offsetSec: number): boolean;
  stopVoice(): void;
  startBeats(plan: BeatPlan): void;
  stopBeats(): void;
  setBeatHaptics?(on: boolean): void;
  playTaps(startAtMs: number, taps: SessionTap[]): void;
  stopTaps(): void;
};

let native: NativeModule | null = null;
if (Platform.OS === 'ios') {
  try {
    native = requireNativeModule<NativeModule>('SessionAudio');
  } catch {
    native = null;
  }
}

/** Zit de motor in deze build (iPhone)? */
export function isSessionAudioAvailable(): boolean {
  return native !== null;
}

/** Houdt de motor (en dus de app) actief tijdens een sessie — ook met
 *  vergrendeld scherm. Per eigenaar; pas na de laatste `end` stopt hij. */
export function beginSessionAudio(owner: string): void {
  try {
    native?.begin(owner);
  } catch {
    /* stil */
  }
}

export function endSessionAudio(owner: string): void {
  try {
    native?.end(owner);
  } catch {
    /* stil */
  }
}

/** Niets in de app speelt nog: geef de geluidssessie terug aan andere apps
 *  (YouTube, muziek) zodra de motor stilvalt. */
export function releaseSessionAudio(): void {
  try {
    native?.releaseSession?.();
  } catch {
    /* stil */
  }
}

/* ── Hartslag ──────────────────────────────────────────────────────────── */

let heartbeatLoad: Promise<boolean> | null = null;
let heartbeatReady = false;

/** Laadt de vier hartslaggeluiden in de motor. Veilig om vaker aan te roepen. */
export function prepareHeartbeatSounds(): Promise<boolean> {
  const n = native;
  if (!n) return Promise.resolve(false);
  if (heartbeatReady) return Promise.resolve(true);
  if (heartbeatLoad) return heartbeatLoad;
  heartbeatLoad = (async () => {
    try {
      const mods = {
        speakerLub: require('../../assets/heartbeat-speaker-lub.wav'),
        speakerDub: require('../../assets/heartbeat-speaker-dub.wav'),
        headphonesLub: require('../../assets/heartbeat-headphones-lub.wav'),
        headphonesDub: require('../../assets/heartbeat-headphones-dub.wav'),
      } as const;
      let ok = true;
      for (const key of Object.keys(mods) as (keyof typeof mods)[]) {
        const a = Asset.fromModule(mods[key]);
        await a.downloadAsync();
        const loaded = await n.loadSound(key, a.localUri ?? a.uri);
        ok = ok && loaded;
      }
      heartbeatReady = ok;
      return ok;
    } catch {
      return false;
    } finally {
      heartbeatLoad = null;
    }
  })();
  return heartbeatLoad;
}

export function startSessionBeats(plan: BeatPlan): void {
  try {
    native?.startBeats(plan);
  } catch {
    /* stil */
  }
}

export function stopSessionBeats(): void {
  try {
    native?.stopBeats();
  } catch {
    /* stil */
  }
}

/** Het lopende plan trilt (niet) mee; het geluid loopt door (31 okt 2026,
 *  het horloge neemt de trilling over). Oudere build → false. */
export function setSessionBeatHaptics(on: boolean): boolean {
  if (!native?.setBeatHaptics) return false;
  try {
    native.setBeatHaptics(on);
    return true;
  } catch {
    return false;
  }
}

/** Sound timing (31 okt 2026): huidige Bluetooth-uitgang met zijn correctie. */
export type IosAudioOutputDevice = {
  key: string;
  name: string;
  reportedMs: number;
  correctionMs: number;
  calibrated: boolean;
};

export function getIosAudioOutputDevice(): IosAudioOutputDevice | null {
  try {
    return native?.audioOutputDevice?.() ?? null;
  } catch {
    return null;
  }
}

export function setIosAudioCorrection(key: string, ms: number): void {
  try {
    native?.setAudioCorrection?.(key, ms);
  } catch {
    /* stil */
  }
}

export function clearIosAudioCorrection(key: string): void {
  try {
    native?.clearAudioCorrection?.(key);
  } catch {
    /* stil */
  }
}

/* ── Stem ──────────────────────────────────────────────────────────────── */

const voiceLoads = new Map<string, Promise<boolean>>();

/** Laadt één stembestand (sleutel = de CDN-URL; `uri` = lokaal bestand als
 *  het offline klaarstaat, anders de URL zelf — de motor downloadt dan). */
export function loadVoice(key: string, uri: string): Promise<boolean> {
  const n = native;
  if (!n) return Promise.resolve(false);
  try {
    if (n.hasSound(key)) return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
  const pending = voiceLoads.get(key);
  if (pending) return pending;
  const p = n
    .loadSound(key, uri)
    .catch(() => false)
    .finally(() => voiceLoads.delete(key));
  voiceLoads.set(key, p);
  return p;
}

/** Speelt meteen (true) of niet (false: nog niet geladen). offsetSec =
 *  zoveel seconden vooraan overslaan (stilte). */
export function playVoiceNow(key: string, volume = 1, offsetSec = 0): boolean {
  try {
    return native?.playVoice(key, volume, offsetSec) ?? false;
  } catch {
    return false;
  }
}

export function stopSessionVoice(): void {
  try {
    native?.stopVoice();
  } catch {
    /* stil */
  }
}

/* ── Tikken ────────────────────────────────────────────────────────────── */

export function playSessionTaps(startAtMs: number, taps: SessionTap[]): boolean {
  if (!native) return false;
  try {
    if (!native.hapticsSupported()) return false;
    native.playTaps(startAtMs, taps);
    return true;
  } catch {
    return false;
  }
}

export function stopSessionTaps(): void {
  try {
    native?.stopTaps();
  } catch {
    /* stil */
  }
}

/** Extra geluidsvertraging van de huidige uitgang (Bluetooth/AirPlay), 0 = ingebouwd. */
export function getAudioOutputExtraMs(): number {
  try {
    return native?.outputExtraMs?.() ?? 0;
  } catch {
    return 0;
  }
}
