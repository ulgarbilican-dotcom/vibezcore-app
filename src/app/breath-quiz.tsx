/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — De vragenlijst na de onboarding

   Vier stappen, één vraag per scherm (operator, 8 augustus 2026: "ik zag
   dat er een bepaalde vragenlijst is bij sommige apps, kan dat?").

   Wat elke stap OPLEVERT staat erbij — een vraag zonder gevolg hoort hier
   niet te staan:
     1. Over jou (geslacht, leeftijd)  → aanspreektoon en analytics, later.
        Alles optioneel; "Prefer not to say" is een volwaardig antwoord.
     2. Je doel (hoogstens twee)       → weegt mee in welke toestand de app
        voorstelt — dezelfde `goals` als op de Goal-pagina.
     3. Ervaring                       → bepaalt straks hoeveel uitleg je
        krijgt; een beginner verdient meer woorden dan een leraar.
     4. Beste moment                   → voorkeursmoment voor het dagplan.

   Geen medische vragen en geen claims (CLAUDE.md §1): we vragen wat iemand
   WIL, niet wat iemand heeft.

   Na afloop: premium terug de app in, ieder ander naar de volledige gratis
   kennismakingssessie.
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { GOALS, MAX_GOALS } from '@/data/goals';
import { useSubscription } from '@/hooks/useSubscription';
import { useSetting } from '@/utils/settings';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const STEPS = 4;

const GENDERS = ['Woman', 'Man', 'Other', 'Prefer not to say'];
const AGES = ['Under 25', '25–34', '35–44', '45–54', '55+'];
const EXPERIENCE = [
  { key: 'new', name: 'New to breathwork', hint: 'Never done this before' },
  { key: 'some', name: 'Tried it a few times', hint: 'Know the basics' },
  { key: 'regular', name: 'Regular practice', hint: 'Part of my routine' },
];
const MOMENTS = [
  { key: 'morning', name: 'Morning', hint: 'Before the day takes over' },
  { key: 'midday', name: 'Midday', hint: 'A reset halfway through' },
  { key: 'evening', name: 'Evening', hint: 'Winding down' },
];

export default function BreathQuizScreen() {
  const insets = useSafeAreaInsets();
  const sub = useSubscription();
  const isPro = sub.isPro || sub.hasBracelet;

  const [step, setStep] = useState(0);
  const [profile, setProfile] = useSetting('profile');
  const [goals, setGoals] = useSetting('goals');

  const save = (patch: Partial<typeof profile>) =>
    void setProfile({ ...profile, ...patch });

  const toggleGoal = (key: string) => {
    Haptics.selectionAsync();
    const has = goals.includes(key);
    void setGoals(
      has ? goals.filter((g) => g !== key) : [...goals, key].slice(-MAX_GOALS),
    );
  };

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS - 1) {
      setStep((n) => n + 1);
      return;
    }
    /* Klaar. Premium heeft de sessies al; ieder ander proeft er meteen één —
       de vragenlijst mag nooit het einde van de reis zijn. */
    if (isPro) {
      router.replace('/breath' as never);
    } else {
      router.replace('/breath-session?from=onboarding' as never);
    }
  };

  const back = () => {
    if (step > 0) setStep((n) => n - 1);
    else if (router.canGoBack()) router.back();
  };

  /* Eén bouwsteen voor alle keuzerijen: aangetikt = accentrand + vinkje.
     Zelfde vormtaal als de Goal-pagina, zodat dit als één app leest. */
  const Choice = ({
    label,
    hint,
    on,
    onPress,
  }: {
    label: string;
    hint?: string;
    on: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={[s.choice, on && s.choiceOn]}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.choiceTxt, on && s.choiceTxtOn]}>{label}</Text>
        {hint ? <Text style={s.choiceHint}>{hint}</Text> : null}
      </View>
      {on && (
        <View style={s.tick}>
          <Check size={12} color="#0a0a0a" strokeWidth={3} />
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.bar}>
        <Pressable onPress={back} hitSlop={12} style={s.back}>
          <ChevronLeft
            size={22}
            color="rgba(255,255,255,0.75)"
            strokeWidth={2.2}
          />
        </Pressable>
        {/* Voortgang als stipjes: je ziet dat het kort is. Een vragenlijst
            zonder einde in zicht wordt afgebroken, niet ingevuld. */}
        <View style={s.dots}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotOn]} />
          ))}
        </View>
        <View style={s.back} />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: Math.max(insets.bottom, 12) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <>
            <Text style={s.title}>About you</Text>
            <Text style={s.lead}>
              Optional — it only shapes how the app speaks to you.
            </Text>
            <Text style={s.groupLbl}>You are</Text>
            {GENDERS.map((g) => (
              <Choice
                key={g}
                label={g}
                on={profile.gender === g}
                onPress={() => {
                  Haptics.selectionAsync();
                  save({ gender: profile.gender === g ? undefined : g });
                }}
              />
            ))}
            <Text style={s.groupLbl}>Your age</Text>
            {AGES.map((a) => (
              <Choice
                key={a}
                label={a}
                on={profile.age === a}
                onPress={() => {
                  Haptics.selectionAsync();
                  save({ age: profile.age === a ? undefined : a });
                }}
              />
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <Text style={s.title}>What brings you here?</Text>
            <Text style={s.lead}>
              Pick one or two. This shapes which state gets suggested — all
              five stay open.
            </Text>
            {GOALS.map((g) => (
              <Choice
                key={g.key}
                label={g.name}
                hint={g.hint}
                on={goals.includes(g.key)}
                onPress={() => toggleGoal(g.key)}
              />
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={s.title}>Your experience</Text>
            <Text style={s.lead}>
              So the guidance matches where you are.
            </Text>
            {EXPERIENCE.map((e) => (
              <Choice
                key={e.key}
                label={e.name}
                hint={e.hint}
                on={profile.experience === e.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  save({ experience: e.key });
                }}
              />
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={s.title}>When would you practice?</Text>
            <Text style={s.lead}>
              Your daily plan starts here — you can change it any time.
            </Text>
            {MOMENTS.map((m) => (
              <Choice
                key={m.key}
                label={m.name}
                hint={m.hint}
                on={profile.preferredSlot === m.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  save({ preferredSlot: m.key });
                }}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Altijd door te komen — ook zonder antwoord. Een verplichte vraag
          levert geen eerlijker antwoord op, alleen een verzonnen antwoord. */}
      <View
        style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) + 14 }]}
      >
        <Pressable
          onPress={next}
          style={s.cta}
          android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
        >
          <Text style={s.ctaTxt}>
            {step < STEPS - 1 ? 'CONTINUE' : 'START YOUR FIRST SESSION'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 7 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotOn: { backgroundColor: Brand.accent },

  scroll: { paddingHorizontal: 18 },
  title: {
    marginTop: 10,
    fontFamily: BrandFonts.extrabold,
    fontSize: 26,
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  lead: {
    marginTop: 8,
    marginBottom: 18,
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.6)',
  },
  groupLbl: {
    marginTop: 10,
    marginBottom: 8,
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.4)',
  },

  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 9,
  },
  choiceOn: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(58,143,255,0.1)',
  },
  choiceTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    color: Brand.text,
  },
  choiceTxtOn: { color: '#ffffff' },
  choiceHint: {
    marginTop: 2,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)',
  },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: Brand.bg,
  },
  cta: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: '#0a0a0a',
  },
});
