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
import { Platform, StatusBar, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import {
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
  const raw = useNativeInsets();
  const f = floors(raw);
  if (__DEV__ === false && process.env.EXPO_PUBLIC_VZ_TEST === '1') {
    // eslint-disable-next-line no-console
    console.log('[VZINSETS]', JSON.stringify({ raw, f, sb: StatusBar.currentHeight, v: Platform.Version }));
  }
  return f;
}

export function SafeAreaView({ edges, style, children, ...rest }: SafeAreaViewProps) {
  /* Geen native SafeAreaView meer: op een echt Android 10-toestel paste die zijn marge niet toe
     (Test Lab, Galaxy A10). De marges komen nu uit dezelfde hook die elders wel werkt, als gewone
     padding, met de ondergrens van `floors`. */
  const f = useSafeAreaInsets();
  const e = (edges ?? ['top', 'right', 'bottom', 'left']) as readonly string[];
  const own = StyleSheet.flatten(style as StyleProp<ViewStyle>) ?? {};
  const num = (v: unknown, fallback?: unknown): number =>
    typeof v === 'number' ? v : typeof fallback === 'number' ? fallback : 0;
  const base = (k: 'Top' | 'Bottom' | 'Left' | 'Right') =>
    num((own as Record<string, unknown>)['padding' + k], num(own.paddingVertical && (k === 'Top' || k === 'Bottom') ? own.paddingVertical : own.paddingHorizontal && (k === 'Left' || k === 'Right') ? own.paddingHorizontal : own.padding));
  const pad: ViewStyle = {
    paddingTop: base('Top') + (e.includes('top') ? f.top : 0),
    paddingBottom: base('Bottom') + (e.includes('bottom') ? f.bottom : 0),
    paddingLeft: base('Left') + (e.includes('left') ? f.left : 0),
    paddingRight: base('Right') + (e.includes('right') ? f.right : 0),
  };
  return (
    <View {...(rest as ViewProps)} style={[style as StyleProp<ViewStyle>, pad]}>
      {children}
    </View>
  );
}

export type { EdgeInsets };
