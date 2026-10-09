/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Protocol confirmed

   De viering (operator, 13 augustus 2026): na "Confirm my protocol" op
   plan-summary.tsx verdient het bevestigen zelf een moment, niet een
   stille sprong naar de agenda. Niets wordt hier nog opgeslagen — het
   protocol staat al vast; dit scherm bedankt en stuurt door.
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts, CTA } from '@/constants/theme';
import { calculateStreak, useBreathHistory } from '@/utils/breath-history';
import { syncPlanReminders } from '@/services/reminders';
import { useActivePlan } from '@/utils/plan-store';
import { useSetting } from '@/utils/settings';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { hapticPress } from '@/utils/haptics';

/* Huisstijl §5: scale(.97)+opacity(.85) op indrukken + lichte haptic-tik,
   ontbrak hier volledig (was een kale Pressable). */
function PlanSuccessCta({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 1 - (1 - scale.value) * 5,
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 80 });
        hapticPress();
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
      }}
    >
      <Animated.View style={[s.cta, pressStyle]}>
        <Text style={s.ctaTxt}>Open your agenda</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function PlanSuccessScreen() {
  const insets = useSafeAreaInsets();
  const { plan } = useActivePlan();
  /* Operator, 7 september 2026: laatste schakel in de keten die
     `onboarding` doorgeeft tot en met agenda.tsx — zie plan.tsx/
     plan-summary.tsx voor de toelichting. */
  const { onboarding, fromBreathWelcome } = useLocalSearchParams<{
    onboarding?: string;
    fromBreathWelcome?: string;
  }>();
  const history = useBreathHistory();
  const sessionsToday = plan
    ? (plan.days[Object.keys(plan.days)[0]]?.items.length ?? 0)
    : 0;

  /* Markeer de gratis proefkeer als gebruikt (operator, 13 augustus 2026).
     `setSetting` is een no-op als hij al `true` staat, dus dit mag hier
     zonder guard bij elke mount. */
  const [, setHasBuiltProtocol] = useSetting('hasBuiltProtocol');
  useEffect(() => {
    void setHasBuiltProtocol(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Operator, 18 september 2026 ("je hebt de draaiende cirkel niet
     gebouwd — heel kort draaiende cirkel met building agenda, dan over
     naar vinkje your protocol is live"): korte "building"-fase vóór het
     vinkje. Het protocol staat op dit punt al vast (plan-review.tsx se
     `confirm()` sloeg alles al op vóór hierheen te navigeren) — dit is
     dus puur een moment van rust/anticipatie, geen echt wachten op werk.
     Vaste, korte duur (900ms) i.p.v. aan een echte taak gekoppeld, want
     er ís geen taak meer om op te wachten. */
  const [building, setBuilding] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBuilding(false), 900);
    return () => clearTimeout(t);
  }, []);

  /* Operator, 19 september 2026 ("crash — zwart scherm meteen bij tikken
     op Continue"): logcat wees twee dingen aan die allebei GELIJKTIJDIG
     op dit scherm se allereerste mount-tick gebeurden: (1) een Reanimated
     `withRepeat`-animatie die hier stond voor de draaiende cirkel, en
     (2) de notificatie-permissie-dialoog van `syncPlanReminders`
     (verplaatst hierheen in de vorige ronde, maar toen nog wél meteen bij
     mount). Die combinatie — een oneindige worklet-animatie starten
     precies wanneer een NATIVE systeemdialoog ook opent, op een scherm
     dat zelf ook nog aan het invliegen is — gaf een React-scheduler-fout
     ("Should not already be working") en een ReanimatedError. Twee
     aanpassingen: (a) de cirkel is nu een gewone `ActivityIndicator`, geen
     eigen worklet-animatie meer nodig voor iets dat toch maar 900ms
     zichtbaar is; (b) `syncPlanReminders` (met zijn permissie-dialoog)
     vuurt nu pas ná de "building"-fase, als het scherm al volledig
     settled is. */
  useEffect(() => {
    if (building || !plan) return;
    void syncPlanReminders(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building, plan]);

  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  useEffect(() => {
    /* Pas starten zodra het vinkje ECHT gemount wordt (na `building`) —
       anders lopen deze shared values al tijdens de spinner-fase af, en
       toont het vinkje meteen zijn EIND-stand i.p.v. nog in te zoomen. */
    if (building) return;
    scale.value = withSequence(
      withTiming(1.08, { duration: 360, easing: Easing.out(Easing.back(1.6)) }),
      /* Operator, 19 september 2026 ("bol laten pulseren"): de continue
         puls start pas via deze callback, ná de intro-animatie helemaal
         is afgerond — bewust NIET een los, onmiddellijk `withRepeat` bij
         mount, want exact dat patroon (een oneindige worklet-animatie die
         start op hetzelfde moment als dit scherm zelf nog aan het
         invliegen is) veroorzaakte eerder de zwart-scherm-crash op dit
         zelfde scherm (zie toelichting hierboven bij `syncPlanReminders`).
         Door de puls pas te starten NADAT de intro al is uitgespeeld —
         dus ruim ná de mount-overgang — blijft diezelfde valkuil vermeden. */
      withTiming(1, { duration: 140, easing: Easing.inOut(Easing.sin) }, (finished) => {
        if (!finished) return;
        scale.value = withRepeat(
          withSequence(
            withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        );
      }),
    );
    opacity.value = withDelay(60, withTiming(1, { duration: 260 }));
  }, [building, scale, opacity]);
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const streak = calculateStreak(history);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.center}>
        {building ? (
          <>
            <ActivityIndicator size="large" color={Brand.success} style={s.spinner} />
            <Text style={s.buildingTxt}>Building your agenda…</Text>
          </>
        ) : (
          <>
            <Animated.View style={[s.badge, badgeStyle]}>
              {/* Operator, 20 september 2026 ("your protocol is live vinkje
                 moet wit"): was donker (#0a0a0a) voor contrast op het
                 groene vlak — nu wit, standaard success-checkmark-stijl. */}
              <Check size={64} color="#ffffff" strokeWidth={3} />
            </Animated.View>

            <Text style={s.title}>Your protocol is live</Text>
            <Text style={s.body}>
              {sessionsToday > 0
                ? `${sessionsToday} session${sessionsToday > 1 ? 's' : ''} a day, right on schedule. Show up once and you're already moving.`
                : "It's set. Show up once and you're already moving."}
            </Text>

            {streak > 0 && (
              <View style={s.streakPill}>
                <Text style={s.streakTxt}>
                  {streak} day{streak === 1 ? '' : 's'} in a row already
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {!building && (
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 40 }]}>
        {/* Operator ("kijk alle CTA's na"): had helemaal geen tik-
           feedback — geen scale/opacity, geen haptiek. Huisstijl §5. */}
        <PlanSuccessCta
          onPress={() =>
            router.replace(
              onboarding
                ? ({
                    pathname: '/agenda',
                    params: {
                      onboarding: '1',
                      ...(fromBreathWelcome ? { fromBreathWelcome } : {}),
                    },
                  } as never)
                : ('/agenda' as never),
            )
          }
        />
      </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
  },
  /* Korte "building"-fase vóór het vinkje, zie toelichting hierboven. */
  spinner: {
    marginBottom: 22,
  },
  buildingTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    color: 'rgba(244,244,244,0.6)',
  },
  /* Operator, 19 september 2026 ("bol dubbel zo groot... laat bol en
     tekst eronder goed ademen"): 88→176 (dubbel), marginBottom 26→44 voor
     meer lucht t.o.v. de titel eronder. */
  badge: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: Brand.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 44,
  },
  title: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 25,
    color: '#ffffff',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  body: {
    marginTop: 14,
    fontFamily: BrandFonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: 'rgba(244,244,244,0.7)',
    textAlign: 'center',
  },
  streakPill: {
    marginTop: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.4)',
    backgroundColor: 'rgba(74,222,128,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  streakTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    color: Brand.success,
  },

  footer: { paddingHorizontal: 18, paddingTop: 10 },
  /* Operator, 18 september 2026 ("cta's moeten consistent zijn in vorm
     en stijl, ook staan sommige te laag zoals open your agenda"): eigen
     volle-pil-vorm (borderRadius 26, ALL CAPS, geen rand/pijl) vervangen
     door de gedeelde `CTA`-token (constants/theme.ts) — dezelfde chrome
     (borderRadius 14, dunne rand, ArrowRight-pijl, sentence-case tekst)
     als build-choice.tsx/build-your-day.tsx/plan-review.tsx. */
  cta: { ...CTA.container },
  ctaTxt: CTA.label,
});
