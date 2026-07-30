/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Breath onboarding (first-run intro)

   Pushed sub-scherm, geen tab. Wordt automatisch geopend door
   (tabs)/breath.tsx wanneer:
     - user heeft `breathOnboardingCompletedAt === null` in Settings, EN
     - user heeft geen bestaande breath-history (nieuwe user).

   Twee flows:
     - GAST (geen actieve subscription, geen bracelet-activatie):
         4 slides eindigend in "Start 2-min Calm" → /breath-sample.
     - PRO (audio-sub actief OF bracelet-activated):
         2 korte slides, geen sample nodig → back naar Breath-tab.

   Setting-flag wordt gezet bij zowel finish als skip zodat het scherm
   nooit tweemaal opduikt.

   Design-anker: Brand-tokens (Brand.bg / accent / text), BrandFonts. Sluit
   aan bij coming.tsx / breath-history.tsx qua sub-screen-patroon.
   ───────────────────────────────────────────────────────────────────────── */

import AmbientGlow from '@/components/AmbientGlow';
import BreathCloud from '@/components/BreathCloud';
import GuidanceSelector, {
  type GuidanceMode,
} from '@/components/GuidanceSelector';
import StateLine, { type StateKey } from '@/components/StateLine';
import { playBreathCue, setVoiceEnabled } from '@/services/breath-voice';
import { Brand, BrandFonts } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';
import { setSetting } from '@/utils/settings';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* Visuals moeten schermvullend zijn — 300px op een 411dp-toestel oogde
   als een postzegel midden in het zwart. */
const SCREEN_W = Dimensions.get('window').width;
const VISUAL = Math.min(SCREEN_W * 0.98, 460);

/* ── State-pills copy voor slide 3 (gast) — kleuren matchen PATTERNS in
     breath.tsx. Bewust hier gedupliceerd (geen import uit tabs/) om
     coupling minimaal te houden; wijzigingen in beide plekken bijhouden
     bij een style-refactor. ── */
const STATE_PILLS = [
  { key: 'boost',   name: 'Boost',        color: '#FFFFFF' },
  { key: 'focus',   name: 'Sharp Focus',  color: '#FF9F0A' },
  { key: 'calm',    name: 'Calm Control', color: '#0A84FF' },
  { key: 'clarity', name: 'Clarity',      color: '#BF5AF2' },
  { key: 'rest',    name: 'Rest & Reset', color: '#4FA46B' },
] as const;

export default function BreathWelcomeScreen() {
  const sub = useSubscription();
  /* isPro-tier: audio-sub actief OF bracelet-activated. Beide krijgen de
     korte 2-slide flow, gasten de 4-slide flow met sample-CTA. */
  const isPro = sub.isPro || sub.hasBracelet;

  const totalSlides = isPro ? 2 : 4;
  const [slide, setSlide] = useState(0);
  const isLast = slide === totalSlides - 1;

  /* Setting flag zetten + navigeren op finish. */
  const finish = () => {
    setSetting('breathOnboardingCompletedAt', Date.now());
  };

  const goNext = () => {
    if (!isLast) {
      setSlide((s) => s + 1);
      return;
    }
    finish();
    if (isPro) {
      /* Pro: terug naar Breath-tab (welcome is push'ed, dus back = tab). */
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } else {
      /* Gast: naar de 2-min Calm-sample. replace() zodat back vanaf sample
         niet terug in onboarding valt maar naar de Breath-tab. */
      router.replace('/breath-sample?state=calm');
    }
  };

  const onSkip = () => {
    finish();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  /* Slide 3: welke state het karakter van de lichtlijn bepaalt. Tappen op
     een pill morpht de lijn — dat IS de uitleg, er staat geen tekst bij
     die het benoemt (art direction: "gebruiker voelt het"). */
  const [lineState, setLineState] = useState<StateKey>('calm');

  /* Slide 2: gekozen begeleidingsmodus + of de bracelet-uitleg getoond is. */
  const [demoMode, setDemoMode] = useState<GuidanceMode>('both');
  const [lockNote, setLockNote] = useState(false);

  /* Elke modus demonstreert zichzelf meteen bij het aantikken — dát maakt
     het een ervaring in plaats van een uitleg. */
  const demoModeChange = (m: GuidanceMode) => {
    setDemoMode(m);
    const wantsHaptic = m === 'haptic' || m === 'both';
    const wantsVoice = m === 'voice' || m === 'both';

    if (wantsHaptic) {
      /* Oplopend golfpatroon — simuleert de inhale-crescendo. */
      Vibration.vibrate(
        [0, 60, 90, 90, 90, 130, 90, 180, 90, 230, 90, 180, 90, 130],
        false,
      );
    }
    setVoiceEnabled(wantsVoice);
    if (wantsVoice) {
      playBreathCue('inhale', 'nose', 'calm', 'breath');
    }
  };

  /* CTA-label per slide. */
  const ctaLabel = !isLast
    ? 'Next'
    : isPro
      ? 'Enter Breath  →'
      : 'Start 2-min Calm  →';

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top-bar met alleen Skip rechts. */}
      <View style={s.topbar}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onSkip} hitSlop={14} style={s.skipWrap}>
          <Text style={s.skipTxt}>Skip</Text>
        </Pressable>
      </View>

      {/* Slide-content — één slide zichtbaar per keer, geen horizontal scroll
         zodat we deterministisch weten waar we zitten (voorspelbare state). */}
      <View style={s.slideArea}>
        {isPro ? (
          slide === 0 ? (
            <ProSlide1 />
          ) : (
            <ProSlide2 />
          )
        ) : slide === 0 ? (
          <GuestSlide1 />
        ) : slide === 1 ? (
          <GuestSlide2
            mode={demoMode}
            onPickMode={demoModeChange}
            onLocked={() => setLockNote(true)}
            showLockNote={lockNote}
          />
        ) : slide === 2 ? (
          <GuestSlide3 active={lineState} onPick={setLineState} />
        ) : (
          <GuestSlide4 />
        )}
      </View>

      {/* Footer met dots + CTA. */}
      <View style={s.footer}>
        <View style={s.dots}>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <View
              key={i}
              style={[s.dot, i === slide && s.dotActive]}
            />
          ))}
        </View>
        <Pressable
          style={s.cta}
          onPress={goNext}
          android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
        >
          <Text style={s.ctaTxt}>{ctaLabel}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* ── Slide-components — hier gehouden i.p.v. eigen files (klein + alleen
     hier gebruikt). ── */

function GuestSlide1() {
  return (
    <View style={s.slide}>
      <AmbientGlow size={VISUAL} />
      <Text style={s.eyebrow}>VIBEZCORE BREATH</Text>
      <Text style={s.title}>Feel your breath.</Text>
      <Text style={s.body}>
        The first breathwork app that guides you through touch — not just
        sound. Silent, precise, hands-free.
      </Text>
    </View>
  );
}

/* Slide 2 — GUIDANCE. Vier modi in een 2×2 raster; elke tap demonstreert
   zichzelf onmiddellijk (haptic trilt, voice spreekt). De bracelet staat
   eronder als uitgelichte aankondiging, niet als vijfde keuze — hij
   bestaat nog niet. */
function GuestSlide2({
  mode,
  onPickMode,
  onLocked,
  showLockNote,
}: {
  mode: GuidanceMode;
  onPickMode: (m: GuidanceMode) => void;
  onLocked: () => void;
  showLockNote: boolean;
}) {
  return (
    <View style={s.slide}>
      <Text style={s.title}>Choose how you feel it.</Text>
      <Text style={s.body}>
        Tap any mode to try it right now.
      </Text>

      <View style={s.selectorWrap}>
        <GuidanceSelector
          value={mode}
          onChange={onPickMode}
          onBraceletPress={onLocked}
        />
      </View>

      {showLockNote && (
        <Text style={s.lockNote}>
          Ships with the Smart Bead Bracelet. The rhythm moves to your
          wrist — silent, invisible, hands-free.
        </Text>
      )}
    </View>
  );
}

function GuestSlide3({
  active,
  onPick,
}: {
  active: StateKey;
  onPick: (k: StateKey) => void;
}) {
  return (
    <View style={s.slide}>
      {/* De lijn IS de uitleg: bij Sharp Focus wordt ze vlak en strak, bij
         Calm Control breed en rond, bij Rest & Reset traag en wijd. Er
         staat bewust nergens tekst die dat benoemt. */}
      <StateLine state={active} width={VISUAL} height={150} />
      <Text style={s.eyebrowAccent}>STATE-DRIVEN</Text>
      <Text style={s.title}>Choose your target state.</Text>
      <Text style={s.body}>
        Tell us how you want to feel. VIBEZCORE can intelligently recommend
        the most effective breathing protocol — or you can select one
        yourself.
      </Text>
      <View style={s.pillsRow}>
        {STATE_PILLS.map((p) => {
          const on = p.key === active;
          return (
            <Pressable
              key={p.key}
              onPress={() => onPick(p.key as StateKey)}
              style={[
                s.pill,
                {
                  borderColor: on
                    ? 'rgba(255,255,255,0.45)'
                    : 'rgba(255,255,255,0.12)',
                  backgroundColor: on
                    ? 'rgba(255,255,255,0.07)'
                    : 'transparent',
                },
              ]}
            >
              <View
                style={[
                  s.pillDot,
                  { backgroundColor: p.color, opacity: on ? 1 : 0.4 },
                ]}
              />
              <Text style={[s.pillTxt, { opacity: on ? 1 : 0.55 }]}>
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function GuestSlide4() {
  return (
    <View style={s.slide}>
      {/* Geen cirkel — de volumetrische wolk uit de sessie zelf, in idle.
         Zo weet de gebruiker vóór de tap al hoe de sessie eruitziet. */}
      <BreathCloud phase="idle" phaseDurationMs={9000} size={VISUAL} />
      <Text style={s.eyebrowAccent}>FIRST SESSION</Text>
      <Text style={s.title}>Start with 2 minutes of Calm.</Text>
      <Text style={s.body}>
        One short sample. See how the guidance feels. If you love it, you
        can continue with a full practice.
      </Text>
    </View>
  );
}

function ProSlide1() {
  return (
    <View style={s.slide}>
      <AmbientGlow size={VISUAL} />
      <Text style={s.eyebrow}>VIBEZCORE BREATH</Text>
      <Text style={s.title}>Feel your breath.</Text>
      <Text style={s.body}>
        Haptic-guided breathwork. 5 states. Silent Mode. Full bracelet
        integration.
      </Text>
    </View>
  );
}

function ProSlide2() {
  return (
    <View style={s.slide}>
      <Text style={s.eyebrowAccent}>READY</Text>
      <Text style={s.title}>Pick your first state.</Text>
      <Text style={s.body}>
        Tap any state to begin. Your bracelet (if connected) syncs
        automatically.
      </Text>
    </View>
  );
}

/* ── Styles ── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  skipWrap: { paddingVertical: 6, paddingHorizontal: 8 },
  skipTxt: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 15,
  },

  slideArea: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    alignItems: 'center',
    gap: 14,
  },

  eyebrow: {
    color: Brand.textDim,
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  eyebrowAccent: {
    color: Brand.accent,
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    color: Brand.text,
    fontFamily: BrandFonts.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    textAlign: 'center',
    marginBottom: 6,
  },
  body: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },

  /* Selector krijgt volle breedte binnen de slide-padding. Negatieve
     marge compenseert de horizontale padding van slideArea zodat het
     2×2-raster en de bracelet-kaart de volle breedte pakken. */
  selectorWrap: {
    marginTop: 18,
    alignSelf: 'stretch',
    marginHorizontal: -28,
  },
  lockNote: {
    marginTop: 12,
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 300,
  },

  pillsRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    maxWidth: 340,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillTxt: {
    color: Brand.text,
    fontFamily: BrandFonts.medium,
    fontSize: 12,
  },

  footer: {
    paddingHorizontal: 28,
    paddingBottom: 20,
    gap: 18,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotActive: {
    backgroundColor: Brand.accent,
    width: 18,
  },
  cta: {
    backgroundColor: Brand.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
