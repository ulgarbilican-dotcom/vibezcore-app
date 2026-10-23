/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Protocol confirmed

   De viering (operator, 13 augustus 2026): na "Confirm my protocol" op
   plan-summary.tsx verdient het bevestigen zelf een moment, niet een
   stille sprong naar de agenda. Niets wordt hier nog opgeslagen — het
   protocol staat al vast; dit scherm bedankt en stuurt door.
   ───────────────────────────────────────────────────────────────────────── */

import { SPRING_PRESS_IN, SPRING_PRESS_OUT } from '@/constants/motion';
import { AudioAccent, Brand, BrandFonts, CTA_GLOW } from '@/constants/theme';
import { calculateStreak, useBreathHistory } from '@/utils/breath-history';
import { syncPlanReminders } from '@/services/reminders';
import { useActivePlan } from '@/utils/plan-store';
import { useSetting } from '@/utils/settings';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import ActivationHero from '@/components/ActivationHero';
import VibezGlass from '@/components/VibezGlass';
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
import { SafeAreaView, useSafeAreaInsets } from '@/utils/safe-area';
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
        scale.value = withSpring(0.97, SPRING_PRESS_IN);
        hapticPress();
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRING_PRESS_OUT);
      }}
    >
      <Animated.View style={[s.cta, pressStyle]}>
        <VibezGlass radius={999} level="raised" tint={AudioAccent} style={StyleSheet.absoluteFill} />
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
  const { onboarding, fromBreathWelcome, confirmed } = useLocalSearchParams<{
    onboarding?: string;
    fromBreathWelcome?: string;
    /** Punt 25 (19 okt 2026): het bevestigingsmoment (ConfirmMoment) heeft
     *  het denken al getoond → geen tweede draaiende fase hier. */
    confirmed?: string;
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
  const [building, setBuilding] = useState(confirmed !== '1');
  useEffect(() => {
    const t = setTimeout(() => setBuilding(false), 900);
    return () => clearTimeout(t);
  }, []);
  /* Punt 25: zonder denkfase toch pas na 900 ms de herinneringen (en hun
     toestemmingsvraag) — zelfde reden als hieronder (19 sept): nooit een
     systeemdialoog in dezelfde tik als het invliegen van dit scherm. */
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 900);
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
    if (building || !settled || !plan) return;
    void syncPlanReminders(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building, settled, plan]);

  const streak = calculateStreak(history);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Audit 16 okt 2026: eindpunt van een bevestigde flow — terugvegen
          bracht je terug in de schermen van die flow. */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      {/* Bio-Teal sfeer: zachte gloed die het scherm "aan" laat voelen (operator, 22 okt 2026). */}
      {!building ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={['rgba(0,163,163,0.30)', 'rgba(0,163,163,0.10)', 'rgba(10,10,10,0)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.glowBig} />
          <View style={s.glowSmall} />
        </View>
      ) : null}

      {building ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={Brand.success} style={s.spinner} />
          <Text style={s.buildingTxt}>Building your agenda…</Text>
        </View>
      ) : (
        <>
          <View style={[s.top, { paddingTop: 36 }]}>
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
          </View>
          <View style={s.middle}>
            <ActivationHero />
          </View>
        </>
      )}

      {!building && (
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 40 }]}>
        {/* Operator ("kijk alle CTA's na"): had helemaal geen tik-
           feedback — geen scale/opacity, geen haptiek. Huisstijl §5. */}
        <PlanSuccessCta
          onPress={() => {
            /* Eerst de afgewerkte flow van de stapel (audit 16 okt 2026):
               anders lagen goal/intensity/plan-review nog onder de agenda en
               bracht terug of terugvegen je daar weer in. */
            if (router.canDismiss()) router.dismissAll();
            router.push(
              onboarding
                ? ({
                    pathname: '/agenda',
                    params: {
                      onboarding: '1',
                      ...(fromBreathWelcome ? { fromBreathWelcome } : {}),
                    },
                  } as never)
                : ('/agenda' as never),
            );
          }}
        />
      </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  top: { alignItems: 'center', paddingHorizontal: 34 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glowBig: { position: 'absolute', alignSelf: 'center', top: '30%', width: 520, height: 520, borderRadius: 260, backgroundColor: 'rgba(0,163,163,0.07)' },
  glowSmall: { position: 'absolute', alignSelf: 'center', top: '38%', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(74,240,212,0.07)' },
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
  /* Echt glas, zonder omlijsting (operator, 22 okt 2026). */
  cta: {
    height: 52,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { fontFamily: BrandFonts.semibold, fontSize: 15, letterSpacing: 0.1, color: '#ffffff' },
});
