/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — hoeveel later geluid hoorbaar is dan op de eigen luidspreker
   van de telefoon (20 okt 2026, operator: "alles moet voor ELKE gebruiker
   correct zijn, niet enkel voor mijn gsm").

   Stem, hartslaggeluid en tikken zijn afgestemd op de luidspreker. Via
   Bluetooth-oortjes (AirPods, Galaxy Buds, …) komt elk geluid 150–300 ms
   later aan — per oortje en per telefoon anders. Deze waarde vraagt het
   toestel zelf op (Android: AudioTrack-latentie, iPhone: outputLatency) en
   is 0 op de luidspreker en bedrade oortjes. Wie geluid op een vast moment
   wil laten samenvallen met trilling/beeld, start het zoveel vroeger.
   ───────────────────────────────────────────────────────────────────────── */

import { Platform } from 'react-native';

let cachedAt = 0;
let cached = 0;

export function audioOutputExtraMs(): number {
  const now = Date.now();
  if (now - cachedAt < 2000) return cached;
  let v = 0;
  try {
    if (Platform.OS === 'android') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const m = require('../../modules/state-haptics') as typeof import('../../modules/state-haptics');
      v = m.getAudioOutputExtraMs();
    } else if (Platform.OS === 'ios') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const m = require('../../modules/session-audio') as typeof import('../../modules/session-audio');
      v = m.getAudioOutputExtraMs();
    }
  } catch {
    v = 0;
  }
  cached = Number.isFinite(v) ? Math.max(0, Math.min(450, v)) : 0;
  cachedAt = now;
  return cached;
}
