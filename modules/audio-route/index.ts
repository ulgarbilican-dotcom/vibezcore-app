/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — gaat het geluid nu naar een koptelefoon/oortjes (bedraad, USB,
   Bluetooth) of naar de telefoonspeaker? Zonder native module (oude build,
   web) → false: dan gewoon de speakerversie. */

import { requireNativeModule } from 'expo-modules-core';

type AudioRouteNativeModule = { isHeadphones(): boolean };

let native: AudioRouteNativeModule | null = null;
try {
  native = requireNativeModule<AudioRouteNativeModule>('AudioRoute');
} catch {
  native = null;
}

export function isHeadphonesOutput(): boolean {
  try {
    return native?.isHeadphones() ?? false;
  } catch {
    return false;
  }
}
