/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet preview (uitgelogde users)

   Iter v149 v3 (2026-06-25): minimal preview screen die uitgelogde users
   (Kickstarter-backers, geïnteresseerden) laat verkennen wat de bracelet
   doet zonder eerst een account te hoeven maken. Operator-feedback punt 1:
   'bezoeker die gewoon benieuwd is kan doorklikken naar bracelet preview
   page (echt waar de states in staan en je bracelet kan instellen).'

   Wat dit screen toont:
   - Header met VIBEZCORE branding
   - 5 mode cards (Boost, Sharp Focus, Calm Control, Clarity & Relax, Sleep)
   - Per mode: kleurige header met sonar-puls, mode-naam, blurb, duur-range
   - Footer CTA's: 'Reserve your bracelet' (→ /bracelet) en 'Activate code'
     (→ /activate-bracelet)

   Bewust GEEN start-button per mode — dit is een visuele preview, niet
   een full demo. Een echte demo vereist BLE-pairing (simulator op uit-
   gelogde users zou misleidend zijn over wat 'sessie starten' echt doet).
   Bezoeker krijgt wel de visuele taal + state-info zodat het concept
   tastbaar wordt.

   Route: gepushed vanaf Bracelet-tab 'See how it works' CTA.
   ─────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts, AudioAccent } from '@/constants/theme';
import { MODES } from '@/services/ble-contract';
import { Stack, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

/* Standaardiseerde press-scale (2026-09-23) — zelfde curve als StartCard
   in breath-welcome.tsx. */
const AnimatedPressable = ReanimatedAnimated.createAnimatedComponent(Pressable);
function usePressScale(scaleTo: number) {
  const scale = useSharedValue(1);
  const onPressIn = () => {
    scale.value = withTiming(scaleTo, { duration: 80 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return { onPressIn, onPressOut, pressStyle };
}

/* Operator, 1 okt 2026 ("headers overal consistent, zoals Apple"): dit
   scherm gebruikte nog de onaangepaste systeem-terugpijl (native header,
   geen eigen styling) — nu dezelfde ChevronLeft-stijl (size 20,
   strokeWidth 2.8 — de "officiële iOS-chevron.backward"-stijl uit
   build-choice.tsx, 18 sept) als overal elders, zelfde recept als
   bracelet-history.tsx's `HistoryBackButton`. */
function PreviewBackButton() {
  const { onPressIn, onPressOut, pressStyle } = usePressScale(0.92);
  return (
    <AnimatedPressable
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/bracelet');
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={12}
      accessibilityLabel="Back"
      style={[{ paddingHorizontal: 8, paddingVertical: 6 }, pressStyle]}
    >
      <ChevronLeft size={20} color={Brand.text} strokeWidth={2.8} />
    </AnimatedPressable>
  );
}

export default function BraceletPreviewScreen(): React.ReactElement {
  const primaryScale = usePressScale(0.96);
  const secondaryScale = usePressScale(0.96);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.root}>
      <Stack.Screen
        options={{
          title: 'Preview',
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <PreviewBackButton />,
        }}
      />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.eyebrow}>WHAT IT DOES</Text>
        <Text style={s.title}>The 5 bracelet states</Text>
        <Text style={s.lede}>
          Each state guides your body and mind into a different gear —
          from peak focus to deep rest. Worn on the wrist, the bracelet
          delivers calibrated haptic patterns. No phone needed once a
          session starts.
        </Text>

        {MODES.map((m) => (
          <ModeCard
            key={m.mode}
            name={m.name}
            blurb={m.blurb}
            color={m.color}
            durationMin={m.minMinutes}
            durationMax={m.maxMinutes}
          />
        ))}

        <View style={s.divider} />

        <Text style={s.footerTitle}>Ready to start?</Text>
        <Text style={s.footerSub}>
          Reserve your bracelet for the Kickstarter launch, or enter your
          activation code if you already have one.
        </Text>

        <AnimatedPressable
          style={[s.btn, s.btnPrimary, primaryScale.pressStyle]}
          onPress={() => router.replace('/bracelet')}
          onPressIn={primaryScale.onPressIn}
          onPressOut={primaryScale.onPressOut}
          accessibilityLabel="Reserve your bracelet"
        >
          <Text style={s.btnPrimaryText}>Reserve your bracelet</Text>
        </AnimatedPressable>

        <AnimatedPressable
          style={[s.btn, s.btnSecondary, secondaryScale.pressStyle]}
          onPress={() => router.push('/activate-bracelet')}
          onPressIn={secondaryScale.onPressIn}
          onPressOut={secondaryScale.onPressOut}
          accessibilityLabel="Activate your bracelet"
        >
          <Text style={s.btnSecondaryText}>I have an activation code</Text>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Mode card ──────────────────────────────────────────────────────── */

function ModeCard({
  name,
  blurb,
  color,
  durationMin,
  durationMax,
}: {
  name: string;
  blurb: string;
  color: string;
  durationMin: number;
  durationMax: number;
}): React.ReactElement {
  /* Pulserende sonar-stip — visueel weergave dat dit een 'actieve' state
     is. Subtiel zodat 5 stipjes samen niet druk worden. */
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[card.wrap, { borderColor: color + '55' }]}>
      <View style={card.header}>
        <Animated.View
          style={[card.dot, { backgroundColor: color, opacity: pulse }]}
        />
        <Text style={[card.name, { color }]}>{name}</Text>
      </View>
      <Text style={card.blurb}>{blurb}</Text>
      <View style={card.metaRow}>
        <Text style={card.metaLabel}>DURATION</Text>
        <Text style={card.metaValue}>
          {durationMin}–{durationMax} min
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  /* Huisstijl v4.4: eyebrow op donkere achtergrond = AudioAccent, geen Signal Blue. */
  eyebrow: {
    color: AudioAccent,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: Brand.text,
    fontSize: 28,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  lede: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
    marginBottom: 28,
  },
  divider: {
    height: 1,
    backgroundColor: Brand.border,
    marginTop: 28,
    marginBottom: 28,
  },
  footerTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  footerSub: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    marginBottom: 24,
  },
  btn: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  /* Huisstijl v4.4: primaire CTA op donkere achtergrond = wit bg + donkere tekst. */
  btnPrimary: { backgroundColor: '#ffffff' },
  btnPrimaryText: {
    color: '#0a0a0a',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  /* Huisstijl v4.4: secundaire CTA, niet haptic/status — AudioAccent. */
  btnSecondary: {
    backgroundColor: 'rgba(110,133,196,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(110,133,196,0.45)',
  },
  btnSecondaryText: {
    color: AudioAccent,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: Brand.panel,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  name: {
    fontSize: 19,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
  },
  blurb: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Brand.border,
    paddingTop: 12,
  },
  metaLabel: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.6,
  },
  metaValue: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
  },
});
