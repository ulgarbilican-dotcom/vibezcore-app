/* Robuuste veilige zone (22 okt 2026).

   Reden: op een echt Android 10-toestel (Galaxy A10, Firebase Test Lab) en in een Android 10-emulator
   meldde `react-native-safe-area-context` na een navigatie vanaf het welkomstscherm soms 0 voor
   boven en onder: "Not Now / STEP 1 OF 5 / Skip" kwamen over de statusbalk te staan en de CTA
   verdween achter de navigatieknoppen. Dit bestand legt een ondergrens:
     - boven: minstens de hoogte van de Android-statusbalk;
     - onder (enkel Android ≤ 10 en als het systeem 0 meldt): 48 dp, de gangbare hoogte van de
       3-knopsbalk.
   Elders (iOS, Android 11+) verandert er niets. `SafeAreaView` tikt de ontbrekende marge er
   bovenop bij, en alleen als het systeem zelf te weinig meldde. */
import { Platform, StatusBar, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import {
  SafeAreaView as NativeSafeAreaView,
  useSafeAreaInsets as useNativeInsets,
  type SafeAreaViewProps,
  type EdgeInsets,
} from 'react-native-safe-area-context';

const LEGACY_ANDROID = Platform.OS === 'android' && Number(Platform.Version) <= 29;

function floors(raw: EdgeInsets): EdgeInsets {
  if (Platform.OS !== 'android') return raw;
  const top = Math.max(raw.top, StatusBar.currentHeight ?? 0);
  const bottom = raw.bottom > 0 ? raw.bottom : LEGACY_ANDROID ? 48 : 0;
  return { ...raw, top, bottom };
}

export function useSafeAreaInsets(): EdgeInsets {
  return floors(useNativeInsets());
}

export function SafeAreaView({ edges, style, ...rest }: SafeAreaViewProps) {
  const raw = useNativeInsets();
  const f = floors(raw);
  const edgeList = (edges ?? ['top', 'right', 'bottom', 'left']) as readonly string[];
  const extraTop = edgeList.includes('top') ? Math.max(0, f.top - raw.top) : 0;
  const extraBottom = edgeList.includes('bottom') ? Math.max(0, f.bottom - raw.bottom) : 0;
  const patch: StyleProp<ViewStyle> =
    extraTop || extraBottom ? { paddingTop: extraTop || undefined, paddingBottom: extraBottom || undefined } : undefined;
  return <NativeSafeAreaView edges={edges} style={patch ? [style, patch] : style} {...rest} />;
}

export type { EdgeInsets };
