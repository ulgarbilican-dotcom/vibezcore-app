/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — duurzones per State Control-toestand (operator, 10 okt 2026:
   "bij een range van minuten: wat is de volgende range, mag dat in de
   cirkel op de plaats van Recommended staan").

   Recommended begint bij de aanbevolen duur (ble-contract defaultMinutes,
   onderbouwing in docs/VIBEZCORE_SCIENCE_A_TOT_Z.md) met een kleine marge
   erboven. Short / Extended / Long zijn neutrale namen — geen belofte over
   wat een langere sessie doet (CLAUDE.md: geen claims). Wijzigt een min/max/
   default in ble-contract, dan horen deze grenzen mee te veranderen. */

import { BraceletMode } from '@/services/ble-contract';

export type ZoneKey = 'short' | 'recommended' | 'extended' | 'long';

export const ZONE_NAME: Record<ZoneKey, string> = {
  short: 'Short',
  recommended: 'Recommended',
  extended: 'Extended',
  long: 'Long',
};

/** Eén zin uitleg per zone (het i-blad van de toestand). */
export const ZONE_TEXT: Record<ZoneKey, string> = {
  short: 'A quick session for when time is tight.',
  recommended: 'The length this state is built around.',
  extended: 'More time to settle into the rhythm.',
  long: 'For when you can really take your time.',
};

/** [vanaf, tot en met] in minuten; ontbrekende zone = bestaat niet. */
export const STATE_ZONES: Record<BraceletMode, Partial<Record<ZoneKey, [number, number]>>> = {
  [BraceletMode.Gamma]: { short: [8, 9], recommended: [10, 12], extended: [13, 16], long: [17, 20] },
  [BraceletMode.Beta]: { recommended: [15, 17], extended: [18, 24], long: [25, 30] },
  [BraceletMode.Alpha]: { short: [15, 17], recommended: [18, 20], extended: [21, 25], long: [26, 30] },
  [BraceletMode.Theta]: { short: [20, 24], recommended: [25, 28], extended: [29, 37], long: [38, 45] },
  [BraceletMode.Delta]: { recommended: [30, 33], extended: [34, 42], long: [43, 50] },
};

export const ZONE_ORDER: ZoneKey[] = ['short', 'recommended', 'extended', 'long'];

export function zoneFor(mode: BraceletMode, minutes: number): ZoneKey {
  const z = STATE_ZONES[mode];
  for (const k of ZONE_ORDER) {
    const r = z[k];
    if (r && minutes >= r[0] && minutes <= r[1]) return k;
  }
  return minutes < (z.recommended?.[0] ?? 0) ? 'short' : 'long';
}
