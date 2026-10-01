/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — ProtocolFlowCancel

   Operator, 18 september 2026 ("eindeloos op 'Back' moeten klikken om
   eruit te gaan — Apple lost dit op met een 'Annuleer'-tekstknop
   rechtsboven"): de Protocol-flow (build-choice.tsx → goal.tsx/
   intensity.tsx of build-your-day.tsx → plan-review.tsx) is 3 tot 4
   stappen diep — halverwege stoppen betekende tot nu toe meermaals op de
   `<`-terugknop tikken, telkens terug door elke vorige stap. Deze knop
   laat je in ÉÉN tik de hele flow verlaten, met een bevestiging
   (VIBEZCORE-stijl, geen kale OS-Alert — zie memory
   "vibezcore-styled-popups") zodat een per-ongeluk-tik niet meteen
   voortgang wegveegt.

   Enkel op de drie schermen die deze sessie al donker/consistent gemaakt
   zijn (build-choice.tsx/build-your-day.tsx/plan-review.tsx) — de nog
   niet aangeraakte Pad-A-stappen (goal.tsx/intensity.tsx) kregen 'm
   bewust nog niet, zie sessie-toelichting.

   Operator, 21 september 2026: daypart-picker.tsx (het vroegere
   dagdeel/tijden-scherm) bestaat niet meer als apart scherm — samengevoegd
   in intensity.tsx ("Set your routine" doet nu ook Times). */

import { confirmVibezAlert } from '@/components/VibezAlert';
import { BrandFonts } from '@/constants/theme';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Toont de VIBEZCORE-gestileerde bevestiging en verlaat, bij "Stop", de
 *  HELE protocol-flow in één keer (niet enkel dit ene scherm) — terug
 *  naar de Breath-tab, ongeacht hoe diep je in de flow zat. */
export async function confirmExitProtocolFlow(): Promise<void> {
  const ok = await confirmVibezAlert({
    title: 'Stop building your protocol?',
    message: "Your progress won't be saved.",
    confirmText: 'Stop',
    cancelText: 'Keep building',
    destructive: true,
  });
  if (!ok) return;
  /* `dismissAll()` maakt de hele opgestapelde flow (elke tussenstap)
     leeg i.p.v. enkel dit scherm te vervangen — anders bracht de
     terugknop je alsnog terug in een halfweg-ingevulde stap. */
  try {
    router.dismissAll();
  } catch {
    /* Geen stack om te legen (bv. dit was al het eerste scherm) — geen
       probleem, de `replace` hieronder brengt je hoe dan ook thuis. */
  }
  router.replace('/breath' as never);
}

export function ProtocolFlowCancel() {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.92, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        void confirmExitProtocolFlow();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={12}
      style={[{ paddingHorizontal: 8, paddingVertical: 8 }, pressStyle]}
    >
      <Text
        style={{
          fontFamily: BrandFonts.medium,
          fontSize: 14,
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        Cancel
      </Text>
    </AnimatedPressable>
  );
}
