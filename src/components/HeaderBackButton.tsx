/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — HeaderBackButton

   Operator, 1 okt 2026 ("kijk alles na op consistentie"): een hele reeks
   Account/Settings/Legal-schermen (about.tsx, activate-bracelet.tsx,
   change-password.tsx, faq.tsx, forgot-password.tsx, reset-password.tsx,
   settings.tsx, support.tsx, subscribe.tsx, legal/[doc].tsx) gebruikten nog
   de ONAANGEPASTE systeem-terugpijl via `headerBackTitle` — exact hetzelfde
   euvel als bracelet-preview.tsx eerder had. Eén gedeelde component i.p.v.
   de press-scale/ChevronLeft-logica 10× te dupliceren (zelfde recept als
   bracelet-history.tsx's `HistoryBackButton`/bracelet-preview.tsx's
   `PreviewBackButton`, nu hier geconsolideerd zodat toekomstige schermen
   deze meteen hergebruiken i.p.v. een eigen variant bouwen).

   Pijl-specificatie (size 20, strokeWidth 2.8): de "officiële iOS-
   chevron.backward"-stijl die operator al op 18 september 2026 koos in
   build-choice.tsx ("officiële iOS-chevron.backward i.p.v. dunne,
   langgerekte Android-pijl") — app-brede standaard, zie ook
   bracelet-control.tsx/bracelet-agenda.tsx/bracelet-set-day.tsx/etc.

   Navigatie: standaard `router.back()` wanneer er iets is om naar terug te
   gaan. Al deze schermen worden altijd gepushed (nooit los geopend), dus
   dat dekt de praktijk. Is er toch geen geschiedenis (zeldzame directe
   deep-link), dan verbergt de knop zichzelf i.p.v. een dode knop te tonen
   — zelfde gedrag als React Navigation's eigen default voor de systeem-
   pijl. `onPress`/`color` zijn overrides voor de uitzonderingsgevallen. */

import { Brand } from '@/constants/theme';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function HeaderBackButton({
  onPress,
  color,
}: {
  onPress?: () => void;
  color?: string;
}) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!onPress && !router.canGoBack()) return null;

  return (
    <AnimatedPressable
      onPress={onPress ?? (() => router.back())}
      onPressIn={() => {
        scale.value = withTiming(0.92, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
      }}
      hitSlop={12}
      accessibilityLabel="Back"
      style={[{ paddingHorizontal: 8, paddingVertical: 6 }, pressStyle]}
    >
      <ChevronLeft size={20} color={color ?? Brand.text} strokeWidth={2.8} />
    </AnimatedPressable>
  );
}
