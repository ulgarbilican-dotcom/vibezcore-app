/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — JS-kant van de BeatEngine (iPhone, 18 okt 2026).

   State Control op de iPhone: elke slag wordt ~250 ms vooraf gepland met
   zijn geplande wandklok-moment; Core Haptics speelt tik én hartslaggeluid
   als één patroon op exact dat moment (zie ios/BeatEngineModule.swift).
   Enkel apple-gelinkt: op Android/web en in een oudere build zonder de
   module is alles hier een stille no-op en blijft de bestaande JS-weg
   (bracelet-haptics.ts) werken. */

import { requireNativeModule } from 'expo-modules-core';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

export type BeatSound = 'speakerLub' | 'speakerDub' | 'headphonesLub' | 'headphonesDub';

export type BeatEvent = {
  /** Milliseconden na het slagmoment. */
  t: number;
  /** 0 = geen tik; 0…1 = sterkte. */
  intensity: number;
  sharpness: number;
  /** '' = geen geluid. */
  sound: BeatSound | '';
  volume: number;
};

type NativeModule = {
  isSupported(): boolean;
  prepare(sounds: Record<BeatSound, string>): Promise<boolean>;
  schedule(beat: { atMs: number; events: BeatEvent[] }): void;
  stop(): void;
};

let native: NativeModule | null = null;
if (Platform.OS === 'ios') {
  try {
    native = requireNativeModule<NativeModule>('BeatEngine');
  } catch {
    native = null;
  }
}

let ready = false;
let preparing: Promise<boolean> | null = null;

/** Klaar om slagen te spelen (motor gestart, geluiden geladen)? */
export function isBeatEngineReady(): boolean {
  return ready;
}

/** Laadt de geluiden en start de motor. Veilig om vaker aan te roepen. */
export function prepareBeatEngine(): Promise<boolean> {
  if (!native) return Promise.resolve(false);
  if (ready) return Promise.resolve(true);
  if (preparing) return preparing;
  const n = native;
  preparing = (async () => {
    try {
      if (!n.isSupported()) return false;
      const mods = {
        speakerLub: require('../../assets/heartbeat-speaker-lub.wav'),
        speakerDub: require('../../assets/heartbeat-speaker-dub.wav'),
        headphonesLub: require('../../assets/heartbeat-headphones-lub.wav'),
        headphonesDub: require('../../assets/heartbeat-headphones-dub.wav'),
      } as const;
      const uris = {} as Record<BeatSound, string>;
      for (const key of Object.keys(mods) as BeatSound[]) {
        const a = Asset.fromModule(mods[key]);
        await a.downloadAsync();
        uris[key] = a.localUri ?? '';
      }
      ready = await n.prepare(uris);
      return ready;
    } catch {
      ready = false;
      return false;
    } finally {
      preparing = null;
    }
  })();
  return preparing;
}

/** Plant één slag op `atMs` (wandklok, ms) — liefst ~250 ms vooraf. */
export function scheduleBeat(atMs: number, events: BeatEvent[]): void {
  if (!native || !ready) return;
  try {
    native.schedule({ atMs, events });
  } catch {
    ready = false;
  }
}

/** Stopt alle vooraf geplande slagen meteen (stop, pauze, nieuwe sessie). */
export function stopBeatEngine(): void {
  if (!native) return;
  try {
    native.stop();
  } catch {
    /* stil */
  }
}
