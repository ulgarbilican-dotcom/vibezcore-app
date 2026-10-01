/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Before we build your protocol

   Operator, 21 september 2026 ("kunnen we een intro-pagina maken als step
   3 na set your state?"): korte, rustige overgangspagina tussen "Set your
   state" (goal.tsx) en de tegel-pagina (intensity.tsx, nu step 4) — geeft
   de gebruiker even lucht en het "wij gaan nu bouwen"-moment voor de vier
   vragen (State/Routine/Level/Times/Plan length) beginnen. AI-pad is nu 5
   stappen: Choose path → Set your state → hier → intensity.tsx → Your
   protocol.

   Operator, vervolg ("gekozen doelen moeten terug dynamisch getoond
   worden — personalisatie, gebruiker moet zien dat we net onthouden
   hebben wat die koos"): de eyebrow-tekst (bv. "More energy + Emotional
   balance") was er even helemaal uit ("hoeft niet"), maar komt terug —
   nu specifiek als bevestiging dat de net-gekozen doelen zijn
   meegenomen, niet als losse styling-tekst. */

import { BrandDark, CTA, TypeScale } from '@/constants/theme';
import { StepIndicator } from '@/components/StepIndicator';
import { GOALS } from '@/data/goals';
import { useSetting } from '@/utils/settings';
import { router, Stack } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const C = BrandDark;

/* Operator, 21 september 2026 ("iconen onder elkaar, allemaal dezelfde
   kleur, witte icoon en blur transparante cirkel"): geen per-doel
   accentkleur meer (die verschilde per badge) — één neutrale, matglazen
   cirkel (zelfde `dimezisBlurViewSdk31Plus`-recept als de rest van de
   app), icoon altijd wit. Eén badge per gekozen doel (1 of 2, zelfde
   grens als goal.tsx se MAX_GOALS), nu in kolom i.p.v. naast elkaar.
   Operator, vervolg (heen-en-weer tussen neutraal en kleur, laatste
   keuze "zet terug in kleur achtergrond"): `g.gradient` — dezelfde
   2-kleuren-gradiënt die goal.tsx toont zodra die kaart geselecteerd is,
   ÉÉN bron (`data/goals.ts`), dus blijft overal gelijk. */
function GoalIconBadge({ g }: { g: (typeof GOALS)[number] }) {
  const Icon = g.Icon;
  return (
    <View style={s.iconGlow}>
      <ExpoGradient colors={g.gradient} style={StyleSheet.absoluteFill} />
      {g.image ? (
        <Image
          source={{ uri: g.image }}
          style={{ width: 56, height: 56, tintColor: '#ffffff' }}
          resizeMode="contain"
        />
      ) : (
        <Icon size={56} color="#ffffff" strokeWidth={1.8} />
      )}
    </View>
  );
}

export default function RoutineIntroScreen() {
  const insets = useSafeAreaInsets();
  const [goals] = useSetting('goals');
  const chosenGoals = GOALS.filter((g) => goals.includes(g.key));
  const stateLabel = chosenGoals.map((g) => g.name).join(' + ');

  const backScale = useSharedValue(1);
  const onBackPressIn = () => {
    backScale.value = withTiming(0.92, { duration: 80 });
  };
  const onBackPressOut = () => {
    backScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const backPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  const ctaScale = useSharedValue(1);
  const onCtaPressIn = () => {
    ctaScale.value = withTiming(0.96, { duration: 80 });
  };
  const onCtaPressOut = () => {
    ctaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const ctaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.bar}>
        <AnimatedPressable
          onPress={() => router.back()}
          onPressIn={onBackPressIn}
          onPressOut={onBackPressOut}
          hitSlop={12}
          style={[s.back, backPressStyle]}
        >
          {/* Operator, 1 okt 2026 ("headers overal consistent"): size
             22→20, stroke 2.2→2.8 — de "officiële iOS-chevron.backward"-
             stijl uit build-choice.tsx (18 sept), nu de app-brede
             standaard. */}
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </AnimatedPressable>
        <StepIndicator step={3} total={5} color="#ffffff" />
        <View style={s.back} />
      </View>

      <View style={s.content}>
        {/* Operator, 21 september 2026 ("tekst in een blur transparante
           kaart — is beetje slordig nu"): tekst zwierf los op de
           achtergrond, geen eigen vlak — nu dezelfde matglas-kaart-taal
           als de rest van de flow. */}
        <View style={s.textCard}>
          <BlurView
            intensity={40}
            tint="dark"
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
          {!!stateLabel && <Text style={s.eyebrow}>{stateLabel}</Text>}
          <Text style={s.header}>Before we build your protocol</Text>
          <Text style={s.lead}>
            A few quick questions, then we'll do the rest.
          </Text>
        </View>

        {chosenGoals.length > 0 && (
          <View style={s.iconArea}>
            <View style={s.iconWrap}>
              {chosenGoals.map((g) => (
                <GoalIconBadge key={g.key} g={g} />
              ))}
            </View>
          </View>
        )}
      </View>

      <View
        style={[s.ctaFloat, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}
        pointerEvents="box-none"
      >
        <ExpoGradient
          colors={['transparent', C.bg]}
          locations={[0, 0.4]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <AnimatedPressable
          style={[s.cta, ctaPressStyle]}
          onPress={() => router.push('/intensity' as never)}
          onPressIn={onCtaPressIn}
          onPressOut={onCtaPressOut}
        >
          <Text style={s.ctaTxt}>Continue</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  /* Operator, 21 september 2026 ("zet dat naar boven"): was verticaal
     gecentreerd — nu dichter bij de voortgangsbalk, met ruimte eronder
     voor het doel-icoon i.p.v. lege ruimte boven én onder de tekst. */
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  textCard: {
    alignSelf: 'stretch',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  /* Operator, 21 september 2026 ("beetje meer naar beneden gecentreerd
     in de neutrale ruimte, en wat verder uiteen"): eigen flex-gebied
     i.p.v. een vaste marginTop — centreert de iconen verticaal in wat er
     nog overblijft tussen de tekst-kaart en de CTA, ongeacht schermmaat. */
  /* Operator, 21 september 2026 ("beetje hoger, 1.5cm"): 1cm ≈ 63dp op
     dit toestel (zelfde omrekening als elders in de app) — 95dp extra
     onderaan trekt het verticale midden evenveel omhoog. */
  iconArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 130 },
  iconWrap: { gap: 24 },
  iconGlow: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Operator, 21 september 2026 ("moet die more energy niet gehighlight
     worden? wit"): was gedimd (50%) — dit IS de personalisatie-regel die
     bevestigt dat we net onthouden hebben wat de gebruiker koos, dus
     hoort op te vallen i.p.v. weg te vallen als kale meta-tekst. */
  eyebrow: {
    ...TypeScale.cardEyebrow,
    textAlign: 'center',
    color: '#ffffff',
    marginBottom: 14,
  },
  header: {
    ...TypeScale.pageHeader,
    textAlign: 'center',
    color: C.text,
  },
  lead: {
    marginTop: 10,
    ...TypeScale.pageSubhead,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
  },
  cta: { ...CTA.container },
  ctaTxt: CTA.label,
  ctaFloat: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 26,
  },
});
