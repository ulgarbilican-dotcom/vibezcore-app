/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "Your Resting Heart Rate" (eerste kennismaking State Control)

   Operator, 9 okt 2026: "dat moet één van de eerste zaken zijn die iemand
   ziet … zorg dat die pagina er heel premium uitziet, ik ga dat veel
   gebruiken voor marketing". Eigen volledig scherm direct na de State
   Control-intro, zolang er nog geen keuze is gemaakt (meten / invullen /
   bewust het gemiddelde). Daarna nooit meer vanzelf — wijzigen gaat via
   het label bovenaan State Control of Profile.

   Beeld: een kloppend hart in Bio-Teal met uitdeinende ringen op een
   rustig "lub-dub" (≈60 bpm) — dezelfde hartslag-taal als de sessies zelf.
   Enkel transform/opacity op de UI-thread, geen live vervaging (zie
   memory real-glass-only-in-sheets).

   Teksten: voorstel, operator beslist (welzijnstaal, geen meet-claim).
   ───────────────────────────────────────────────────────────────────────── */

import PressScale from '@/components/PressScale';
import RhythmSheet from '@/components/RhythmSheet';
import { AudioAccent, AudioAccentLight, BrandFonts } from '@/constants/theme';
import { BraceletMode } from '@/services/ble-contract';
import { chooseAverageRestingPulse } from '@/services/resting-pulse';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BEAT_MS = 1000; // ≈60 bpm, rustig

function Ring({ delay, progress, size }: { delay: number; progress: SharedValue<number>; size: number }) {
  const style = useAnimatedStyle(() => {
    const p = (progress.value + delay) % 1;
    return {
      opacity: 0.45 * (1 - p),
      transform: [{ scale: 0.55 + p * 0.75 }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.ring, { width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}

export default function RestingHeartRatePage({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  /* Operator, 9 okt 2026 ("alle tekst op elkaar"): het beeld schaalt mee
     met de schermhoogte i.p.v. vaste 260 pt. */
  const { height } = useWindowDimensions();
  /* Vervolg (operator: "tekst wordt door de knop afgesneden"): het hart
     krijgt enkel de ruimte die echt overblijft (gemeten), max 280. */
  const [area, setArea] = useState(0);
  const stage = Math.round(Math.max(140, Math.min(280, height * 0.32, area > 0 ? area - 24 : 280)));
  const core = Math.round(stage * 0.48);
  const [sheet, setSheet] = useState<null | 'measure' | 'manual'>(null);

  /* Lub-dub op het hart, ringen deinen continu uit. */
  const beat = useSharedValue(1);
  const wave = useSharedValue(0);
  useEffect(() => {
    beat.value = withRepeat(
      withSequence(
        withTiming(1.14, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 150, easing: Easing.in(Easing.quad) }),
        withDelay(60, withTiming(1.08, { duration: 100, easing: Easing.out(Easing.quad) })),
        withTiming(1, { duration: 580, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    wave.value = withRepeat(withTiming(1, { duration: BEAT_MS * 3, easing: Easing.linear }), -1, false);
  }, [beat, wave]);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));

  return (
    <View style={s.root}>
      {/* Zachte Bio-Teal gloed achter het hart — kleur, geen vervaging. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,163,163,0.20)', 'rgba(0,163,163,0.05)', 'rgba(10,10,10,0)']}
        locations={[0, 0.45, 1]}
        style={s.glow}
      />

      <View style={[s.content, { paddingTop: insets.top + 28 }]}>

        {/* Operator, 9 okt 2026: titel bovenaan, hart eronder. */}
        <Text style={s.title}>Your Resting{'\n'}Heart Rate</Text>
        {/* Operator, 9 okt 2026: korter — slogan i.p.v. uitlegzin. */}
        <Text style={s.body}>Your rhythm  •  Your baseline</Text>
        <View style={s.stageArea} onLayout={(e) => setArea(e.nativeEvent.layout.height)}>
        <View style={[s.stage, { width: stage, height: stage }]}>
          <Ring delay={0} progress={wave} size={stage} />
          <Ring delay={1 / 3} progress={wave} size={stage} />
          <Ring delay={2 / 3} progress={wave} size={stage} />
          <View style={[s.core, { width: core, height: core, borderRadius: core / 2 }]}>
            <LinearGradient
              colors={['rgba(74,240,212,0.22)', 'rgba(0,163,163,0.10)']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View style={heartStyle}>
              <Heart size={54} color={AudioAccentLight} fill={AudioAccentLight} strokeWidth={1.4} />
            </Animated.View>
          </View>
        </View>
        </View>


      </View>

      <View style={[s.actions, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <PressScale style={s.cta} haptic scaleTo={0.97} onPress={() => setSheet('measure')} accessibilityRole="button">
          <Text style={s.ctaTxt}>Measure Now</Text>
        </PressScale>
        {/* Operator, 9 okt 2026 ("zweven een beetje"): tweede keuze als
            omlijnde knop, direct onder de hoofdknop — één blok. */}
        <PressScale style={s.secondaryBtn} scaleTo={0.97} onPress={() => setSheet('manual')} accessibilityRole="button">
          <Text style={s.linkTxt}>Enter Manually</Text>
        </PressScale>
        <PressScale
          style={s.link}
          onPress={() => {
            chooseAverageRestingPulse();
            onDone();
          }}
          accessibilityRole="button"
        >
          <Text style={s.linkDim}>Use an Average for Now</Text>
        </PressScale>
        <Text style={s.legal}>For wellness only, not a medical measurement.</Text>
      </View>

      <RhythmSheet
        visible={sheet !== null}
        mode={BraceletMode.Alpha}
        startAt={sheet ?? 'measure'}
        onClose={() => setSheet(null)}
        onDone={() => {
          setSheet(null);
          onDone();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 520 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 28 },
  eyebrow: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.6)',
  },
  stageArea: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 160 },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: AudioAccentLight,
  },
  core: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74,240,212,0.35)',
  },
  title: {
    marginTop: 8,
    fontFamily: BrandFonts.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
    color: '#ffffff',
    textAlign: 'center',
  },
  body: {
    marginTop: 18,
    marginBottom: 14,
    maxWidth: 320,
    fontFamily: BrandFonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
  },
  /* Accent enkel in het beeld (hart/ringen) — tekst wit/grijs, Apple-stijl. */
  facts: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26, marginBottom: 12 },
  fact: { fontFamily: BrandFonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.3)' },
  actions: { paddingHorizontal: 24, paddingTop: 24 },
  cta: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#1D1D1F' },
  /* Vervolg ("omlijning niet mooi"): iOS' grijze knop — zachte vulling,
     geen rand. */
  secondaryBtn: {
    marginTop: 10,
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { height: 46, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  linkTxt: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#ffffff' },
  linkDim: { fontFamily: BrandFonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  /* Voetnoot zoals Apple's kleine lettertjes: ~12–13 pt, grijs, helemaal
     onderaan met wat afstand tot de knoppen. */
  legal: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.42)',
  },
});
