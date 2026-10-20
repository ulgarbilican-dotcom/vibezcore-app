/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — bron voor een foto (20 okt 2026, operator: "alle foto's komen
   van het internet, kan je dat voor alles doen?").

   Zit de foto in de app (src/constants/bundled-images.ts, gegenereerd door
   scripts/bundle-remote-images.py), dan komt hij van het toestel: meteen
   zichtbaar, ook offline en bij de allereerste start. Anders — een nieuwe
   foto die nog niet gebundeld is — gewoon van de CDN, zoals voorheen.
   ───────────────────────────────────────────────────────────────────────── */

import type { ImageSourcePropType } from 'react-native';
import { BUNDLED_IMAGES } from '@/constants/bundled-images';

export function imageSource(uri: string | null | undefined): ImageSourcePropType {
  if (!uri) return { uri: '' };
  const local = BUNDLED_IMAGES[uri];
  return local !== undefined ? local : { uri };
}
