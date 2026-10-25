/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — algemene uitleg (vóór het welkomstscherm, enkel de eerste keer)

   Operator, 25 okt 2026: "een onboarding voor de algemene app zodat gebruikers begrijpen wat de app
   en de onderdelen doen, en daarna naar het welkomstscherm". Vier korte schermen (belofte, State Control,
   Breathwork, Audio Library); het vijfde scherm is het welkomstscherm. Teksten zijn van de operator (letterlijk overgenomen).
   Skip staat altijd boven; De laatste knop opent het welkomstscherm. Geen poort: niets wordt gevraagd.

   Regels: UI_EN_BEWEGINGSREGELS.md — cascade van onderen (`reveal(i)`), geen zijwaartse paginaschuif, ronde
   glazen knop van 52 dp. Eenmaal gezien = `appIntroSeenAt` (settings); de root-layout (_layout.tsx) beslist
   op een koude start: intro (nog niet gezien) of welkomstscherm.
   ───────────────────────────────────────────────────────────────────────── */

import BalancedText from '@/components/BalancedText';
import PressScale from '@/components/PressScale';
import Tap from '@/components/Tap';
import VibezGlass from '@/components/VibezGlass';
import { Brand, BrandFonts, CTA_GLASS, CTA_GLOW, TypeScale } from '@/constants/theme';
import { reveal } from '@/constants/motion';
import { qaFlag } from '@/utils/qa-probe';
import { setSetting } from '@/utils/settings';
import { SafeAreaView } from '@/utils/safe-area';
import { Stack, router } from 'expo-router';
import { AudioLines, ChevronLeft, Radio, Wind } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

type Step = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  note?: string;
  Icon?: typeof Radio;
};

/* [OPERATOR]-teksten, letterlijk (25 okt 2026, tweede versie). Scherm 5 ("Start") is het welkomstscherm zelf. */
const STEPS: Step[] = [
  {
    key: 'promise',
    eyebrow: 'WELCOME',
    title: 'Stop being a passenger in your own life.',
    body:
      'Take an active role in how you feel, think and respond. VIBEZCORE brings together haptic State Control, Guided Breathwork and powerful ideas from history’s greatest minds to help you guide your state each day, find inner balance and grow over time.',
  },
  {
    key: 'state',
    eyebrow: 'STATE CONTROL',
    title: 'Feel the pulse. Feel the shift.',
    body:
      'Choose the state you want to move toward. Research-based, bottom-up haptic pulse patterns deliver vibrations through your phone or smartwatch, guiding your nervous system from stress toward calm or focus, or toward energy or sleep.',
    note: 'Smart bead bracelet support coming soon.',
    Icon: Radio,
  },
  {
    key: 'breath',
    eyebrow: 'GUIDED BREATHWORK',
    title: 'Follow the cues. Let your breathing lead.',
    body:
      'Clear spoken guidance and haptic cues help you follow each breath through your phone or smartwatch. Use established breathing techniques to guide your state toward calm, focus, energy or sleep.',
    note: 'Smart bead bracelet support coming soon.',
    Icon: Wind,
  },
  {
    key: 'audio',
    eyebrow: 'AUDIO LIBRARY',
    title: 'Learn from the minds that changed how we see the world.',
    body:
      'We turn the enduring ideas of history’s greatest minds into clear, structured audio sessions you can understand, apply and return to—so insight can become lasting personal growth.',
    Icon: AudioLines,
  },
];

const enter = (i: number) => reveal(i);

export default function IntroScreen() {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const cur = STEPS[step];
  qaFlag('intro', { step, last: STEPS.length - 1 });

  /* Gezien (ook bij Skip) → nooit meer vanzelf; daarna het welkomstscherm. */
  const finish = () => {
    void setSetting('appIntroSeenAt', Date.now());
    router.replace('/welcome' as never);
  };
  const next = () => (last ? finish() : setStep(step + 1));
  const back = () => setStep(Math.max(0, step - 1));
  const Icon = cur.Icon;

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.topbar}>
          <View style={s.side}>
            {step > 0 ? (
              <Tap onPress={back} hitSlop={14} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
                <ChevronLeft size={18} color={Brand.textDim} strokeWidth={2.2} />
                <Text style={s.backTxt}>Back</Text>
              </Tap>
            ) : null}
          </View>
          <View style={s.center} pointerEvents="none">
            <Text style={s.stepEyebrow}>{`${step + 1} OF ${STEPS.length}`}</Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
            </View>
          </View>
          <View style={[s.side, { alignItems: 'flex-end' }]}>
            <Tap onPress={finish} hitSlop={14} style={s.skipWrap} accessibilityRole="button" accessibilityLabel="Skip introduction">
              <Text style={s.skipTxt}>Skip</Text>
            </Tap>
          </View>
        </View>

        <ScrollView
          key={step}
          style={{ flex: 1 }}
          contentContainerStyle={s.content}
          alwaysBounceVertical={false}
          showsVerticalScrollIndicator={false}
        >
          {Icon ? (
            <Animated.View entering={enter(0)} style={s.iconWrap}>
              <VibezGlass radius={44} level="normal" style={StyleSheet.absoluteFill} />
              <Icon size={34} color="#ffffff" strokeWidth={1.8} />
            </Animated.View>
          ) : null}
          <Animated.View entering={enter(1)}>
            <Text style={s.eyebrow}>{cur.eyebrow}</Text>
            <Text style={[s.title, !Icon && s.titleBig]}>{cur.title}</Text>
          </Animated.View>
          <Animated.View entering={enter(2)}>
            <BalancedText style={s.body}>{cur.body}</BalancedText>
            {cur.note ? <Text style={s.note}>{cur.note}</Text> : null}
          </Animated.View>
        </ScrollView>

        <View style={s.footer}>
          <PressScale onPress={next} scaleTo={0.97} style={s.ctaWrap} accessibilityRole="button" accessibilityLabel={`CTA ${step === 0 ? 'Get started' : 'Next'}`}>
            <View style={s.cta}>
              <Text style={s.ctaTxt}>{step === 0 ? 'Get started' : 'Next'}</Text>
            </View>
          </PressScale>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  safe: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  side: { minWidth: 64 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 4, alignSelf: 'flex-start' },
  backTxt: { color: Brand.textDim, fontFamily: BrandFonts.medium, fontSize: 14 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  stepEyebrow: { marginTop: 2, color: '#ffffff', fontFamily: BrandFonts.bold, fontSize: 9, letterSpacing: 2 },
  track: { width: 120, height: 1.5, borderRadius: 0.75, marginTop: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.15)' },
  fill: { height: '100%', borderRadius: 0.75, backgroundColor: '#ffffff' },
  skipWrap: { paddingVertical: 6, paddingHorizontal: 8 },
  skipTxt: { color: 'rgba(255,255,255,0.92)', fontFamily: BrandFonts.semibold, fontSize: 15 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingBottom: 24, gap: 18 },
  iconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 },
  eyebrow: { fontFamily: BrandFonts.bold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)', marginBottom: 6 },
  title: { ...TypeScale.pageHeader, textAlign: 'left', color: Brand.text },
  titleBig: { fontSize: 32, lineHeight: 38 },
  note: { marginTop: 14, fontFamily: BrandFonts.medium, fontSize: 13, letterSpacing: 0.2, color: 'rgba(255,255,255,0.5)' },
  body: { ...TypeScale.pageSubhead, textAlign: 'left', color: 'rgba(255,255,255,0.7)', lineHeight: 25 },
  footer: { paddingHorizontal: 26, paddingBottom: 32, paddingTop: 12 },
  ctaWrap: { borderRadius: 999, backgroundColor: CTA_GLASS, ...CTA_GLOW },
  cta: { alignItems: 'center', justifyContent: 'center', borderRadius: 999, height: 52 },
  ctaTxt: { color: '#0a0a0a', fontFamily: BrandFonts.semibold, fontSize: 15, letterSpacing: 0.1 },
});
