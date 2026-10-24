/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — één plek voor de kleine tikjes van de interface

   Operator, 9 okt 2026 ("de tikken voelen stroef en hard, niet als een
   subtiele tik — kijk het overal na"): expo-haptics' selectionAsync /
   impactAsync(Light) laten op Android de trilmotor lopen, en Samsung speelt
   dat stevig af. Android heeft eigen, fijne systeemtikken (zoals het
   toetsenbord) — die gebruiken we hier. iOS houdt Apple's eigen generators.

   - hapticTap()  — knop, keuze, tab: één lichte tik.
   - hapticTick() — slepen over een waarde (cirkel, kiezer): heel fijne tik,
                    gedempt als ze sneller dan ~40 ms na elkaar komen.
   Succes/fout (notificationAsync) en de sessie-haptiek blijven apart.

   Android-systeemtikken volgen de instelling "Trillingen bij aanraking":
   staat die uit, dan geen tik — zoals elke andere app.
   ───────────────────────────────────────────────────────────────────────── */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const ANDROID_API = Platform.OS === 'android' ? Number(Platform.Version) : 0;

/* 24 okt 2026 (operator: "sommige knoppen wel haptiek, andere niet"): elke knop (Tap, PressScale) tikt nu zelf
   op het moment van de tik, op één plek. Knoppen die hapticTap()/hapticPress() nog zelf aanroepen vallen binnen
   dit venster en trillen dus niet dubbel. */
const DEDUPE_MS = 120;
let lastFire = 0;
function dedupe(): boolean {
  const now = Date.now();
  if (now - lastFire < DEDUPE_MS) return true;
  lastFire = now;
  return false;
}

export function hapticTap(): void {
  if (dedupe()) return;
  if (Platform.OS === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap).catch(() => {});
  } else {
    void Haptics.selectionAsync().catch(() => {});
  }
}

/** Lichte "impact" voor hoofdknoppen (Start e.d.) — op Android dezelfde fijne tik. */
export function hapticPress(): void {
  if (dedupe()) return;
  if (Platform.OS === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap).catch(() => {});
  } else {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

let lastTick = 0;
export function hapticTick(): void {
  const now = Date.now();
  if (now - lastTick < 40) return;
  lastTick = now;
  if (Platform.OS === 'android') {
    /* Android 14+: de tik die het systeem zelf voor schuifregelaars gebruikt. */
    const type =
      ANDROID_API >= 34 ? Haptics.AndroidHaptics.Segment_Frequent_Tick : Haptics.AndroidHaptics.Text_Handle_Move;
    void Haptics.performAndroidHapticsAsync(type).catch(() => {});
  } else {
    void Haptics.selectionAsync().catch(() => {});
  }
}
