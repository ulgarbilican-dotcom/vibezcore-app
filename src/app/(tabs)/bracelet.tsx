/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet tab ("State Control")

   GEWIJZIGD 4 oktober 2026: deze tab toonde voorheen twee dingen, afhankelijk
   van `isBraceletOwner` (@/utils/dev-user-override):
     - owner      → <BraceletControl /> (bracelet-control.tsx)
     - non-owner  → een ~3800-regel marketing/showcase-pagina (hero, "How it
                    works", 5 Haptic Modes, Technical Specs, The Collection,
                    Pricing, Kickstarter launch banner, Join the Waitlist).

   Reden van de wijziging: Session Control (bracelet-control.tsx) is nu een
   zelfstandige feature die werkt zónder de fysieke Smart Bead Bracelet (via
   telefoon/smartwatch-haptiek) — het is geen "preview van een toekomstig
   product" meer, maar een echte, vandaag werkende functie. De hardware zelf
   (Kickstarter Fall 2026) lanceert nog steeds later.

   Deze tab rendert daarom nu ALTIJD <BraceletControl /> — voor iedereen,
   owner of niet. De volledige marketing/showcase-content van hierboven is
   1-op-1 (zelfde JSX/state/stijlen/comments, geen herontwerp) verhuisd naar
   `src/app/smart-bead-bracelet.tsx`, een losse route (`/smart-bead-bracelet`)
   bereikbaar via een link binnen Session Control ("Also works with the
   Smart Bead Bracelet — launching Fall 2026"). Zie CLAUDE.md §3 voor de
   volledige historie van de etalage-content.

   `isBraceletOwner` wordt hier niet meer gebruikt — BraceletControl.tsx
   bepaalt zelf (via dezelfde hook) wat een owner vs. niet-owner ziet
   (bv. PreviewBadge). Tab-bar blijft zichtbaar want dit is nog steeds een
   tab-screen, geen Stack-push.

   HERZIEN 4 oktober 2026 (operator: "dat scherm is zo fout al maar kan, kijk
   naar format van breathwork/audio library welcome"): de eerste poging was
   een apart, GEPUSHED scherm (/state-control-welcome) — dat verloor de
   tab-balk en kreeg per ongeluk een kale native header-balk, compleet
   inconsistent met hoe de rest van de app een eerste-keer-intro toont.
   De ECHTE referentie, bevestigd door het draaiende toestel te bekijken
   ((tabs)/breath.tsx se "Breathe / Build / Become"-intro): een intro-
   overlay die IN de tab zelf leeft — foto vult het scherm, tab-balk blijft
   zichtbaar, geen native header, geen wordmark, gestapelde titel (3
   graduele regels) + tagline + één CTA. Exact dezelfde stijl-tokens
   (`stackWord1/2/3`/`introSub`/`introCtaMatch`/shimmer-animatie) als
   breath.tsx, 1-op-1 gekopieerd — niet opnieuw verzonnen. */

import { getSetting } from '@/utils/settings';
import { qaFlag } from '@/utils/qa-probe';
import { goToTab } from '@/utils/state-control-ui';
import { SPRING_PRESS_IN, SPRING_PRESS_OUT } from '@/constants/motion';
import { TabReveal } from '@/components/Reveal';
import Tap from '@/components/Tap';
import { QaPressable } from '@/components/QaPressable';
import { setPremiumPillLow } from '@/utils/premium-pill-slot';
import { useSubscription } from '@/hooks/useSubscription';
import { openBraceletWebsite } from '@/services/bracelet-upsell';
import { Brand, BrandFonts, CTA_GLASS, CTA_GLOW } from '@/constants/theme';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming, cancelAnimation } from 'react-native-reanimated';
import BraceletControl from '../bracelet-control';
import RestingHeartRatePage from '@/components/RestingHeartRatePage';
import { ensureSettingsLoaded, useSetting } from '@/utils/settings';
import { useRestingPulse } from '@/components/RhythmSheet';
import { loadRestingPulse, getRestingPulse, chooseAverageRestingPulse } from '@/services/resting-pulse';
import { setStateControlIntroFullScreen, setStateControlIntroVisible } from '@/utils/state-control-ui';
import { deferOnboarding, isAnySessionRunning, mayAutoShowOnboarding } from '@/utils/onboarding-gate';
import { setStateIntroSkip, useStateIntroSkip } from '@/utils/state-intro-skip';
import { useSafeAreaInsets } from '@/utils/safe-area';
import { hapticPress } from '@/utils/haptics';
import { useTabBarInset } from '@/utils/tab-bar-inset';
import { imageSource } from '@/utils/image-source';

/* Operator-foto voor het State Control-intro (aangeleverd 5 okt 2026). */
/* Operator, 5 okt 2026: terug naar de eerste foto. */
/* Operator, 8 okt 2026: nieuwe versie met ruimte boven de hoofden, zodat de
   foto tot de bovenrand kan lopen zonder het hoofd onder de statusbalk. */
const BG_IMG = 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20welcome%20state%20control%20app.png';

/* Ken Burns-"ademing" + gefaseerde reveal — exact dezelfde recept als de
   oude bracelet-intro (smart-bead-bracelet.tsx se `introKenBurnsStyle`/
   `introEyebrowStyle`/`introTitleStyle`), 1-op-1 hergebruikt, niet
   opnieuw verzonnen. Geen horizontale/verticale shift hier (die was
   foto-crop-specifiek afgesteld) — enkel de trage, herhalende zoom. */
const INTRO_ZOOM = 1;
/* Operator, 5 okt 2026 ("meer uitgezoomd, de mensen staan er niet
   volledig in, vooral de vrouw niet"): de foto is bijna vierkant
   (1122×1402); schermvullend (cover) sneed de zijkanten weg. Nu over de
   volle breedte bovenaan, onderaan zacht uitlopend in de achtergrond —
   titel en knop staan daaronder op het donker, niet over de foto. */
const BG_ASPECT = 1024 / 1536;

/* Operator, 5 okt 2026 ("de foto moet groter, full screen"): schermvullend
   op volle hoogte. De 2:3-foto is dan breder dan het scherm; de uitsnede
   begint op 19% van de breedte, zodat beide gezichten (man links, vrouw
   rechts) in beeld blijven — wat wegvalt is been en betonrand. */
/* Afgesteld op de eerste foto (breder, hoofden hoog): schermvullend
   vielen hoofd van de man en gezicht van de vrouw weg. De foto vult
   bovenaan 66% van de hoogte (vanaf 5%; operator: "meer uitzoomen"), de uitsnede begint op 12,5%
   van de breedte — beide gezichten volledig in beeld, de onderkant
   loopt uit in het donker achter titel en knop. */
/* Operator, 8 okt 2026 ("foto loopt niet tot boven"): vanaf 5% liet een
   zwarte band achter de statusbalk. Nu vanaf de bovenrand (randloos, zoals
   de Library-intro), iets hoger zodat de onderkant op dezelfde plek blijft. */
const PHOTO_TOP = 0;
const PHOTO_HEIGHT = 0.72;
const PHOTO_FOCUS_LEFT = 0.125;

/* Operator, 8 okt 2026 ("koppen hoger, de pols moet net boven de tekst
   komen"): onderkant van het horloge in de foto (84,6% van de hoogte) ligt
   12 pt boven de eyebrow — gemeten via onLayout, dus op elk toestel juist.
   Nooit een zwarte band bovenaan: valt de foto te laag, dan groter. */
const WATCH_Y = 0.846;
function photoFrame(w: number, h: number, textTop: number | null) {
  /* Altijd minstens schermbreed (geen zwarte zijranden bij de 2:3-foto). */
  let height = Math.max(h * PHOTO_HEIGHT, w / BG_ASPECT);
  let top = h * PHOTO_TOP;
  if (textTop != null) {
    const anchor = textTop - 12;
    top = anchor - WATCH_Y * height;
    if (top > 0) {
      height = anchor / WATCH_Y;
      top = 0;
    }
  }
  const width = height * BG_ASPECT;
  const left = Math.min(0, Math.max(w - width, -width * PHOTO_FOCUS_LEFT));
  return { position: 'absolute' as const, top, left, height, width };
}

/** `onboarding` (20 okt 2026, operator: "scherm 1 moet voor onboarding
 *  eruitzien zoals scherm 2"): dit intro is de start van de onboarding →
 *  zelfde opbouw als stap 1 van de Breathwork-onboarding (breath-welcome):
 *  volle foto zonder tabbalk/Premium-pill, "Not Now" linksboven, en de
 *  doorzichtige matglazen knop met lichtflits. Anders: het gewone
 *  tab-intro zoals goedgekeurd. */
function StateControlIntro({
  onDone,
  onboarding = false,
  onNotNow,
}: {
  onDone: () => void;
  onboarding?: boolean;
  onNotNow?: () => void;
}) {
  const barInset = useTabBarInset();
  const insets = useSafeAreaInsets();
  const tabInset = onboarding ? 0 : barInset;
  useEffect(() => {
    setStateControlIntroFullScreen(onboarding);
    return () => setStateControlIntroFullScreen(false);
  }, [onboarding]);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [textTop, setTextTop] = useState<number | null>(null);
  const ctaScale = useSharedValue(1);
  const ctaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));
  const shimmer = useSharedValue(-1);
  const kenBurns = useSharedValue(1);
  const introFocused = useIsFocused();
  /* Eindeloze animaties enkel zolang dit tabblad zichtbaar is. */
  useEffect(() => {
    if (!introFocused) return;
    shimmer.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(2600, withTiming(1, { duration: 1100 })),
        withDelay(1200, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
    kenBurns.value = withRepeat(
      withTiming(1.04, { duration: 18000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(shimmer);
      cancelAnimation(kenBurns);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introFocused]);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * 220 }, { rotate: '18deg' }],
  }));
  const kenBurnsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: kenBurns.value * INTRO_ZOOM }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a0a' }]}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <Animated.View renderToHardwareTextureAndroid style={[StyleSheet.absoluteFill, kenBurnsStyle]}>
          {box && (
            <Image
              source={imageSource(BG_IMG)}
              /* Kadrering op de hoogte BOVEN de tabbalk (19 okt 2026):
                 sinds de balk doorzichtig over dit scherm zweeft is het
                 vak `tabInset` hoger — zonder aftrek zou de foto merkbaar
                 inzoomen. Zo blijft de uitsnede exact zoals goedgekeurd. */
              style={photoFrame(box.w, box.h - tabInset, textTop)}
              resizeMode="cover"
            />
          )}
        </Animated.View>
        {/* Het donker begint pas ONDER het horloge, zodat de pols zichtbaar
            blijft net boven de tekst. */}
        <LinearGradient
          colors={['rgba(10,10,10,0.35)', 'rgba(10,10,10,0)', 'rgba(10,10,10,0)', 'rgba(10,10,10,0.85)', '#0a0a0a']}
          locations={
            box && textTop != null
              ? [0, 0.1, Math.max(0.2, (textTop - 24) / box.h), Math.min(0.95, (textTop + 16) / box.h), Math.min(1, (textTop + 48) / box.h)]
              : [0, 0.1, 0.5, 0.66, 0.72]
          }
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Zelfde plaatsing als het Audio Library-intro ((tabs)/index.tsx
          `introTextWrap`): 34 boven de tabbalk, géén extra onderste
          veilige zone — die zit al in de tabbalk (operator, 5 okt 2026).
          19 okt 2026 (operator: "kunnen wij onderaan transparant maken en
          de fotos etc full screen?" → "ja"): de balk zweeft nu doorzichtig
          over dit scherm, dat tot de onderrand doorloopt — dus de hoogte
          van de balk (incl. veilige zone) hier zelf bij de 34 optellen,
          zodat titel en knop op exact dezelfde plek blijven. */}
      {onboarding && onNotNow && (
        /* Exact de plaats en stijl van "Not Now" in breath-welcome
           (topbar paddingVertical 10 / paddingHorizontal 18 + backBtn). */
        <Tap
          onPress={onNotNow}
          hitSlop={14}
          style={[s.notNow, { top: insets.top + 10 }]}
          accessibilityRole="button"
          accessibilityLabel="Not now, look around first"
        >
          <ChevronLeft size={18} color={Brand.textDim} strokeWidth={2.2} />
          <Text style={s.notNowTxt}>Not Now</Text>
        </Tap>
      )}
      <View style={[s.introWrap, { paddingBottom: onboarding ? insets.bottom + 24 : 34 + tabInset }]}>
        <View
          style={s.stackTitle}
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            setTextTop((prev) => (prev != null && Math.abs(prev - y) < 1 ? prev : y));
          }}
        >
          <TabReveal i={0}><Text style={s.introEyebrow}>STATE CONTROL</Text></TabReveal>
          {/* Operator, 10 okt 2026: nieuwe titel (was "Guided by touch, on your wrist."). */}
          {/* Operator, 10 okt 2026: nieuwe kop (was "Feel different. Perform differently."). */}
          <TabReveal i={1}><Text style={s.introTitle}>The Power to Shift.{'\n'}From Your Wrist.</Text></TabReveal>
        </View>
        <TabReveal i={2} style={{ marginTop: 28, alignSelf: 'stretch' }}>
        <Animated.View style={ctaPressStyle}>
          <QaPressable
            qaLabel="CTA Explore State Control"
            onPress={() => {
              hapticPress();
              onDone();
            }}
            onPressIn={() => {
              ctaScale.value = withSpring(0.96, SPRING_PRESS_IN);
            }}
            onPressOut={() => {
              ctaScale.value = withSpring(1, SPRING_PRESS_OUT);
            }}
            style={s.introCtaGlassWrap}
            android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
          >
            {/* 22 okt 2026 (operator): altijd het doorschijnende glas met witte lichtbron — ook voor wie de
                onboarding al kent (was een effen witte knop). Geen blur/tint: die tekende grijs of verdween. */}
            <View style={s.introCtaGlass}>
              <Text style={s.introCtaGlassTxt}>Explore State Control</Text>
            </View>
            <View style={[StyleSheet.absoluteFill, { borderRadius: 999, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
<Animated.View style={[s.ctaShimmer, shimmerStyle]} pointerEvents="none">
              <LinearGradient
                colors={['#ffffff00', '#ffffff5c', '#ffffff00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
</View>
          </QaPressable>
        </Animated.View>
        </TabReveal>
        {/* Operator, 7 okt 2026 ("weinig ingangen naar de bracelet"): de
            bracelet hoort bij State Control — één rustige regel onder de
            knop, voor iedereen (er zijn nog geen eigenaars). */}
        <TabReveal i={3}>
        <Tap
          onPress={() => void openBraceletWebsite()}
          hitSlop={10}
          style={({ pressed }) => [s.braceletLink, pressed && { opacity: 0.6 }]}
          accessibilityRole="link"
          accessibilityLabel="Smart Bead Bracelet, launching early 2027"
        >
          <Text style={s.braceletLinkTxt}>
            Early 2027 · <Text style={s.braceletLinkStrong}>Smart Bead Bracelet ›</Text>
          </Text>
        </Tap>
        </TabReveal>
      </View>
    </View>
  );
}

export default function BraceletScreen() {
  /* Operator, 4 okt 2026 ("bij wegklikken tab en terugkomen moet welcome
     bracelet scherm terug zichtbaar worden"): GEEN eenmalige, permanent
     opgeslagen vlag meer (dat was de vorige opzet) — de intro moet bij
     ELK bezoek aan deze tab opnieuw verschijnen, niet enkel de allereerste
     keer. Puur lokale state (geen settings-persistentie) die reset zodra
     de tab de focus verliest, zodat de volgende keer weer vers begint. */
  /* Een directe weg hierheen (pill, melding, plan, bracelet-pagina — allemaal
     via de doorverwijzing in bracelet-control.tsx) draagt een uniek
     `open`-token: dan GEEN intro, meteen naar de sessie/moduskeuze. Elk
     token telt één keer, zodat een gewone tab-tik nadien weer het intro
     toont. */
  const { open } = useLocalSearchParams<{ open?: string }>();
  const consumedOpen = useRef<string | undefined>(open);
  const [showIntroRaw, setShowIntro] = useState(!open);
  /* Na de onboarding meteen geen intro (geen flits van de welkomstfoto). */
  const introSkip = useStateIntroSkip();
  /* 23 okt 2026 (operator): Premium ziet de welkomstkaart van deze tab niet meer. */
  const proSub = useSubscription();
  const showIntro = showIntroRaw && !introSkip && !proSub.isPro;

  useEffect(() => {
    if (open && open !== consumedOpen.current) {
      consumedOpen.current = open;
      setShowIntro(false);
      setStateIntroSkip(false);
    }
  }, [open]);

  /* Test 10 okt 2026: enkel terug naar het intro als je naar een ANDER
     TABBLAD gaat — niet als er een scherm bovenop komt (Set your plan,
     agenda, info). Anders landde je na "Save your plan" of de terugknop op
     het intro i.p.v. op Session Control. */
  const navigation = useNavigation();
  useEffect(() => {
    /* `navigation` van een tabbladscherm = de tab-navigator zelf. */
    const unsub = (navigation as any).addListener('state', (e: any) => {
      const st = e?.data?.state;
      const current = st?.routes?.[st.index]?.name;
      if (current && current !== 'bracelet') {
        setShowIntro(true);
        setStateIntroSkip(false);
      }
    });
    return unsub;
  }, [navigation]);

  /* Pill op het intro tonen als er een sessie loopt (audit 5 okt 2026). */
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setPremiumPillLow(false);
      return () => setFocused(false);
    }, []),
  );
  /* Operator, 9 okt 2026: na de intro, zolang er nog geen keuze is voor de
     rusthartslag, eerst de pagina "Your Resting Heart Rate" (eigen volledig
     scherm). Pas tonen als de opgeslagen keuze geladen is — anders flitst
     hij bij wie al koos. */
  const pulse = useRestingPulse();
  const [pulseLoaded, setPulseLoaded] = useState(false);
  useEffect(() => {
    void loadRestingPulse().then(() => setPulseLoaded(true));
  }, []);
  /* 15 okt 2026: eerst de State Control-onboarding (het principe), daarna
     pas de rusthartslag — één keer, tot ze afgerond is. Als VOLLEDIG scherm
     bovenop de tabs (/state-onboarding, zoals breath-welcome): zonder
     tabbalk en zonder het zwevende Premium-knopje, dat bij een bezoeker
     over "STEP 1 OF 3" lag (operator: "bekijk dat als bezoeker"). */
  const [onboardedAt] = useSetting('stateOnboardingCompletedAt');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  useEffect(() => {
    void ensureSettingsLoaded().then(() => setSettingsLoaded(true));
  }, []);
  /* 19 okt 2026 (operator, punt 24 — vervangt de regel van build 26
     hieronder): de onboarding verschijnt enkel na "Explore State Control",
     dus wanneer de gebruiker de tab ZELF opent. Eén keer; "Not Now"
     (terug/terugvegen op stap 1) = nog één keer bij een volgende app-start,
     daarna nooit meer vanzelf; nooit terwijl er een sessie loopt. Alle
     regels: utils/onboarding-gate.ts — beslist op het moment van de tik
     (uitstel en lopende sessie zijn geen React-state). */
  const needsOnboarding = settingsLoaded && onboardedAt === null;
  /* [VERVANGEN 19 okt 2026, punt 24] Elke ingang die het intro overslaat
     (`open`-token: na een aankoop, een herinnering, een plan) sloeg ook de
     onboarding over (operator, build 26: "waarom is na de onboarding van
     breathwork die van State Control weg?") — toen kreeg wie State Control
     nog nooit zag ze daar altijd eerst. Nu niet meer: zo'n ingang gaat
     meteen naar de bestemming (nooit onderbreken); de onboarding komt de
     volgende keer dat de gebruiker zelf op "Explore State Control" tikt. */
  /* Hartslagkeuze: de eerste keer zonder ingestelde hartslag OOK via een
     melding of plan (operator 19 okt 2026: "de eerste keer wel de hartslag
     vragen, de gebruiker kiest zelf" — gemiddelde is één tik). */
  const showHrPage = !showIntro && pulseLoaded && !pulse.decided;

  useEffect(() => {
    setStateControlIntroVisible(focused && (showIntro || showHrPage));
    return () => setStateControlIntroVisible(false);
  }, [focused, showIntro, showHrPage]);

  /* Stabiele referentie: het sessiescherm koppelt er de terugknop aan in een
     focus-effect — een nieuwe functie per render zou dat steeds opnieuw
     doen (en de tabbalk laten flikkeren). */
  /* Premium ziet het intro niet (23 okt) — dan is "terug" geen intro tonen maar het scherm verlaten. De tabbalk is op de
     State Control-keuze verborgen, dus deze pijl is de enige uitweg (24 okt 2026: Premium zat vast). Naar het
     hoofdtabblad (Library) — hetzelfde als de Android-terugknop (backBehavior="initialRoute"). */
  const isProRef = useRef(false);
  isProRef.current = proSub.isPro;
  const minimize = useCallback(() => {
    if (isProRef.current) goToTab('/');
    else setShowIntro(true);
  }, []);

  const introIsOnboarding = needsOnboarding && mayAutoShowOnboarding('state');
  qaFlag('scGate', { settingsLoaded, onboardedAt: String(onboardedAt), may: mayAutoShowOnboarding('state'), sessionRunning: isAnySessionRunning(), deferred: getSetting('stateOnboardingDeferredCount') });
  if (showIntro) {
    return (
      <StateControlIntro
        onboarding={introIsOnboarding}
        onNotNow={() => {
          /* Zelfde als "Not Now" in de Breathwork-onboarding: uitstel (deze
             run niet meer, volgende start nog één keer) → gewone pagina. */
          deferOnboarding('state');
          /* Overslaan = direct naar State Control, niet naar de hartslagpagina: gemiddelde als start (aanpasbaar in Profile). */
          if (!getRestingPulse().decided) chooseAverageRestingPulse();
          setShowIntro(false);
        }}
        onDone={() => {
          if (needsOnboarding && mayAutoShowOnboarding('state')) {
            /* Het intro blijft eronder staan: Back in de onboarding komt
               hier terug; na afloop opent /state-onboarding deze tab met een
               `open`-token (geen intro meer). */
            router.push({ pathname: '/state-onboarding', params: { first: '1', hr: pulse.decided ? '0' : '1' } } as never);
            return;
          }
          setShowIntro(false);
        }}
      />
    );
  }
  if (showHrPage) {
    /* onDone: de keuze is opgeslagen → `pulse.decided` wordt true en dit
       scherm verdwijnt vanzelf. */
    return <RestingHeartRatePage onDone={() => {}} onBack={() => setShowIntro(true)} />;
  }

  /* Operator, 4 okt 2026 ("looking for your device-scherm overbodig"):
     stil verbinden op de achtergrond i.p.v. het volledige zoek-scherm
     doorlopen — haptiek werkt sowieso zonder enige verbinding, dit is
     enkel voor wanneer er ooit een echte bracelet gekoppeld is. */
  /* Chevron in de actieve sessie → terug naar dit intro (operator, 5 okt
     2026: "minimize moet naar welcome state control gaan"). De sessie zelf
     loopt door — haptiek hangt aan bracelet-session-monitor, niet aan dit
     scherm. */
  return <BraceletControl autoConnect onMinimize={minimize} />;
}

const s = StyleSheet.create({
  braceletLink: { alignSelf: 'center', minHeight: 42, justifyContent: 'center', marginTop: 12 },
  braceletLinkTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: BrandFonts.medium },
  braceletLinkStrong: { color: '#ffffff', fontFamily: BrandFonts.semibold },
  /* Onboarding-start (20 okt 2026): kopie van breath-welcome `cta` +
     `ctaBlurWrap` + `ctaTintWhite` + `ctaTxt`. */
  introCtaGlassWrap: { alignSelf: 'stretch', marginHorizontal: 0, borderRadius: 999, backgroundColor: CTA_GLASS, ...CTA_GLOW },
  introCtaGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 999,
    height: 52,
    overflow: 'hidden',
  },
  introCtaTint: { backgroundColor: 'rgba(255,255,255,0.20)' },
  introCtaGlassTxt: { color: '#0a0a0a', fontFamily: BrandFonts.semibold, fontSize: 17 },
  notNow: {
    position: 'absolute',
    left: 18,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  notNowTxt: { color: 'rgba(255,255,255,0.85)', fontFamily: BrandFonts.medium, fontSize: 14, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6 },
  introWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 26,
    paddingBottom: 34,
  },
  stackTitle: { alignItems: 'center' },
  /* Eyebrow + titel i.p.v. titel + tagline — operator: "zoals audio
     library tab doen, state control als eyebrow en guided by touch...
     groter". Exact `introEyebrow`/`introTitle` uit (tabs)/index.tsx
     (Library-tab), 1-op-1 hergebruikt, niet opnieuw verzonnen. */
  introEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 8,
  },
  introTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
    lineHeight: 36,
    textAlign: 'center',
  },
  introCtaMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    marginHorizontal: 26,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D2D2D7',
    overflow: 'hidden',
  },
  ctaTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    letterSpacing: 0.1,
  },
  ctaShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
  },
});
