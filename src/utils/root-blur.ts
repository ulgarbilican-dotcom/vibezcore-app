/* De hele app staat in één BlurTargetView (root-layout); het glas van een
   sheet die BUITEN die target getekend wordt, vervaagt dit — echt glas op
   Android (7 okt 2026). */
import { createRef } from 'react';
import type { View } from 'react-native';

export const rootBlurRef = createRef<View>();
