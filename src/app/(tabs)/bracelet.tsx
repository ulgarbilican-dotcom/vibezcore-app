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

import { BrandFonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  withTiming,
} from 'react-native-reanimated';
import BraceletControl from '../bracelet-control';
import { setStateControlIntroVisible } from '@/utils/state-control-ui';

/* Operator-foto voor het State Control-intro (aangeleverd 5 okt 2026). */
const BG_IMG = 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20state%20control%202.png';

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
const BG_ASPECT = 1024 / 1536; // staand 2:3 — past precies in het fotovlak hieronder

/* Operator, 5 okt 2026 ("de foto moet groter, full screen"): schermvullend
   op volle hoogte. De 2:3-foto is dan breder dan het scherm; de uitsnede
   begint op 19% van de breedte, zodat beide gezichten (man links, vrouw
   rechts) in beeld blijven — wat wegvalt is been en betonrand. */
const PHOTO_FOCUS_LEFT = 0.145;
/* Vervolg ("foto meer naar boven, pols moet in beeld"): de polsen (horloge
   en armband) zitten op ~80% van de fotohoogte, achter de tekst. 17%
   hoger: wat bovenaan wegvalt is lucht, de polsen komen boven de titel. */
const PHOTO_SHIFT_UP = 0.17;

function photoFrame(w: number, h: number) {
  const width = h * BG_ASPECT;
  const left = Math.min(0, Math.max(w - width, -width * PHOTO_FOCUS_LEFT));
  return { position: 'absolute' as const, top: -h * PHOTO_SHIFT_UP, left, height: h, width };
}

function StateControlIntro({ onDone }: { onDone: () => void }) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const ctaScale = useSharedValue(1);
  const ctaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));
  const shimmer = useSharedValue(-1);
  const kenBurns = useSharedValue(1);
  const eyebrowReveal = useSharedValue(0);
  const titleReveal = useSharedValue(0);
  useEffect(() => {
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
    eyebrowReveal.value = withDelay(300, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
    titleReveal.value = withDelay(520, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * 220 }, { rotate: '18deg' }],
  }));
  const kenBurnsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: kenBurns.value * INTRO_ZOOM }],
  }));
  const eyebrowStyle = useAnimatedStyle(() => ({
    opacity: eyebrowReveal.value,
    transform: [{ translateY: 10 * (1 - eyebrowReveal.value) }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleReveal.value,
    transform: [{ translateY: 10 * (1 - titleReveal.value) }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a0a' }]}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <Animated.View style={[StyleSheet.absoluteFill, kenBurnsStyle]}>
          {box && (
            <Image
              source={{ uri: BG_IMG }}
              style={photoFrame(box.w, box.h)}
              resizeMode="cover"
            />
          )}
        </Animated.View>
        <LinearGradient
          colors={['rgba(10,10,10,0.35)', 'rgba(10,10,10,0)', 'rgba(10,10,10,0)', 'rgba(10,10,10,0.85)', '#0a0a0a']}
          locations={[0, 0.12, 0.55, 0.74, 0.82]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Zelfde plaatsing als het Audio Library-intro ((tabs)/index.tsx
          `introTextWrap`): 34 boven de tabbalk, géén extra onderste
          veilige zone — die zit al in de tabbalk (operator, 5 okt 2026). */}
      <View style={s.introWrap}>
        <View style={s.stackTitle}>
          <Animated.Text style={[s.introEyebrow, eyebrowStyle]}>STATE CONTROL</Animated.Text>
          <Animated.Text style={[s.introTitle, titleStyle]}>Guided by touch,{'\n'}on your wrist.</Animated.Text>
        </View>
        <Animated.View style={[{ marginTop: 28, alignSelf: 'stretch' }, ctaPressStyle]}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onDone();
            }}
            onPressIn={() => {
              ctaScale.value = withTiming(0.96, { duration: 80 });
            }}
            onPressOut={() => {
              ctaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
            }}
            style={s.introCtaMatch}
            android_ripple={{ color: 'rgba(0,0,0,0.12)' }}
          >
            <Text style={[s.ctaTxt, { color: '#1D1D1F' }]}>Explore State Control</Text>
            <Animated.View style={[s.ctaShimmer, shimmerStyle]} pointerEvents="none">
              <LinearGradient
                colors={['#ffffff00', '#ffffff9a', '#ffffff00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Pressable>
        </Animated.View>
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
  const [showIntro, setShowIntro] = useState(!open);

  useEffect(() => {
    if (open && open !== consumedOpen.current) {
      consumedOpen.current = open;
      setShowIntro(false);
    }
  }, [open]);

  useFocusEffect(
    useCallback(() => {
      return () => setShowIntro(true);
    }, []),
  );

  /* Pill op het intro tonen als er een sessie loopt (audit 5 okt 2026). */
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    setStateControlIntroVisible(focused && showIntro);
    return () => setStateControlIntroVisible(false);
  }, [focused, showIntro]);

  /* Stabiele referentie: het sessiescherm koppelt er de terugknop aan in een
     focus-effect — een nieuwe functie per render zou dat steeds opnieuw
     doen (en de tabbalk laten flikkeren). */
  const minimize = useCallback(() => setShowIntro(true), []);

  if (showIntro) {
    return <StateControlIntro onDone={() => setShowIntro(false)} />;
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
    borderRadius: 14,
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
