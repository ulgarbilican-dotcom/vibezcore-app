/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Welcome screen (eerste scherm, NIET-blokkerend)

   CLAUDE.md §3 + SPEC DEEL 0 (operator-beslissing 19 mei 2026):
   - Géén poort, géén keuzescherm — alleen een entree die de bezoeker een
     vertrekpunt geeft. Beide knoppen leiden naar volledig vrije tabs.
   - "Reeds ingelogd" → welkomstscherm overslaan, direct de app in.

   Operator-beslissing 15 september 2026 — volledige herbouw #2 ("dit is
   exact hoe Apple de lay-out en teksten van boven naar beneden zou
   aanpassen"):
   - Eén paginahoge achtergrondfoto (pic homepage app.png) i.p.v. een
     boxed hero (355px) met eigen decoratie. De ademhalings-deeltjes/
     equalizer-staafjes/kloppende-armband-puls uit de vorige versie waren
     op de OUDE foto's exacte neus/oor/pols-posities afgesteld en zijn
     mee weg — ze zouden nergens meer bij aansluiten op deze nieuwe foto.
   - Logo + tagline in wit, helemaal bovenaan (het lichte deel van de
     foto), zodat ze meteen afsteken.
   - De 3 productknoppen verhuisd naar de onderste helft van het scherm
     (over de kleding heen, niet over de gezichten) — Frosted Glass
     (`expo-blur` BlurView, tint dark) i.p.v. een harde witte vlakke
     knop, zodat de foto er zichtbaar doorheen blijft. Geen product-
     categorie-label meer boven de titel (icoon + titel vertellen het
     verhaal al) — dunne witte lucide-iconen i.p.v. de eigen PNG-artwork-
     thumbnails (die paste bij de oude, minder fotografische opzet).
   - "Activate now" / "Sign in" niet langer in een omkaderd wit blok —
     kale witte/lichtgrijze tekstlinks, onderaan boven de home-indicator.
   ─────────────────────────────────────────────────────────────────────────── */

import { BrandFonts } from '@/constants/theme';
import { getToken } from '@/services/auth';
import {
  awaitDevUserOverrideLoaded,
  getDevUserOverride,
} from '@/utils/dev-user-override';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BookAudio, ChevronRight, Wind, type LucideIcon } from 'lucide-react-native';
import BraceletIcon from '@/components/BraceletIcon';
import Svg, { Polygon } from 'react-native-svg';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { getSetting } from '@/utils/settings';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
/* Operator, 19 september 2026 ("gestaffelde intro... logo, dan tekst,
   dan de knoppen één voor één van onderen omhoog met een zachte
   vering"): gewone mount-animatie, geen native dialoog/overgang
   gelijktijdig (dat patroon gaf ooit de zwart-scherm-crash op
   plan-success.tsx) — hier gewoon een scherm dat opent, veilig. */
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ── DE 3 PIJLERS — dun wit icoon + klein categorie-label + grote titel
   + chevron.
   Operator, 15 september 2026 (tweede ronde): het categorie-label kwam
   terug op eigen verzoek — "als sub-label BOVEN de actietekst, klein en
   dun, in Vibezcore-blauw/lichtgrijs, terwijl de titel groot wit
   blijft". Zo blijft de emotie (Reset Yourself) het eerste wat opvalt,
   maar snapt de bezoeker meteen welke tool erachter zit. `product` is
   dus terug in de data, enkel de presentatie is nu een klein eyebrow-
   label i.p.v. de eerdere zware ALL-CAPS-rij die er vóór de eerste
   redesign stond. */
type Pillar = {
  key: string;
  /* Operator, 7 okt 2026: zelfde iconen als de tabbalk onderaan
     (Breath = Wind, State Control = BraceletIcon, Library = BookAudio). */
  Icon: LucideIcon | typeof BraceletIcon;
  product: string;
  title: string;
  onPress: () => void;
};

const PILLARS: Pillar[] = [
  {
    key: 'breathwork',
    Icon: Wind,
    /* Operator, 24 september 2026 ("Breathe - Reset Yourself / Feel -
       Instant State Control / Listen - Train Your Mind"): productlabel
       nu een kort werkwoord per pijler i.p.v. de productnaam — dit
       overschrijft bewust de 18 september-beslissing die hier "Breath"
       zette (gelijk aan het tabblad-label); operator koos nu expliciet
       voor "Breathe" op dit scherm. Titel blijft ongewijzigd. */
    product: 'Breathe',
    title: 'Reset Yourself',
    onPress: () => {
      const seen = getSetting('breathOnboardingCompletedAt') !== null;
      router.navigate((seen ? '/breath' : '/breath-welcome') as never);
    },
  },
  {
    key: 'bracelet',
    Icon: BraceletIcon,
    product: 'Feel',
    title: 'Control Your State', // operator 7 okt 2026: zelfde ritme als Reset Yourself / Train Your Mind
    onPress: () => router.navigate('/bracelet'),
  },
  {
    key: 'audio',
    Icon: BookAudio,
    product: 'Listen',
    title: 'Train Your Mind',
    onPress: () => router.navigate('/'),
  },
];

/* Paginahoge achtergrondfoto — vervangt de eerdere samengestelde,
   opgeknipte hero (HERO_IMG + losse armband-cutout + decoratie).
   Operator, 17 september 2026: nieuwe foto. */
const BG_IMG = 'https://vibezcore-audio.b-cdn.net/images/pic%20welcome%20app%20new.png';

/* Operator, 15 september 2026: iconen + categorie-labels terug naar
   zachtgrijs (was kort indigo, operator draaide terug). */
const PILLAR_ACCENT = 'rgba(255,255,255,0.65)';

type Status = 'checking' | 'show';

/* Operator, 19 september 2026 ("de drie knoppen schuiven één voor één
   heel subtiel van onderen omhoog met een vloeiende, zachte vering"):
   `progress` is ÉÉN gedeelde spring (0→1, zie hierboven) — elke knop
   leest daar zijn EIGEN stukje uit via `interpolate` met een per-index
   verschoven ingangs-bereik, dus knop 0 is al bijna klaar wanneer knop 2
   nog moet beginnen. Eigen component (niet inline in de `.map()`) voor
   de losse touch-down/spring-animatie per knop (Rules of Hooks). */
function PillarButton({
  p,
  index,
  progress,
}: {
  p: Pillar;
  index: number;
  progress: SharedValue<number>;
}) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const enterStyle = useAnimatedStyle(() => {
    const start = index * 0.18;
    const local = interpolate(progress.value, [start, start + 0.6], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: local,
      transform: [{ translateY: (1 - local) * 22 }],
    };
  });
  return (
    <Animated.View style={enterStyle}>
      <AnimatedPressable
        accessibilityRole="button"
        onPress={p.onPress}
        onPressIn={() => {
          pressScale.value = withTiming(0.96, { duration: 90 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { damping: 12, stiffness: 220 });
        }}
        style={[s.pillarWrap, pressStyle]}
      >
        {/* Operator, 20 september 2026 ("het glaseffect klopt niet, wil
           blur native"): `expo-blur`'s Android-gedrag valt zonder
           `blurMethod` terug op `'none'` — een vlak, semi-transparant vlak,
           GEEN echte blur. `dimezisBlurViewSdk31Plus` geeft de echte native
           blur op Android 12+ (elk toestel dat VIBEZCORE realistisch
           target). Zelfde fix nodig in build-choice.tsx/breath-setup.tsx/
           breath-session.tsx — zie die bestanden. */}
        <BlurView
          intensity={40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={s.pillarBlur}
        >
          {/* Operator, 7 okt 2026 (eigen ontwerp "start welcome zo doen"):
             groter dun icoon, enkel de titel, pijltje rechts. */}
          <View style={s.pillarIconWrap}>
            <p.Icon size={24} color="#ffffff" strokeWidth={1.5} />
          </View>
          {/* Operator, 24 september 2026 ("Breathe - Reset Yourself / Feel
             - Instant State Control / Listen - Train Your Mind"): `product`
             stond al in de data maar werd nooit getekend — enkel `title`.
             Nu een klein label BOVEN de titel, zelfde eyebrow-patroon als
             elders in de app (bv. "VIBEZCORE AUDIO LIBRARY" op de Library-
             tab-intro). */}
          <Text style={s.pillarTitle}>{p.title}</Text>
          <ChevronRight size={22} color="rgba(255,255,255,0.85)" strokeWidth={1.6} />
        </BlurView>
      </AnimatedPressable>
    </Animated.View>
  );
}

/* Het V-teken van VIBEZCORE — exact opgemeten uit het app-logo
   (assets/vibezcore_icon.png, 7 okt 2026, operator: "dezelfde V als het
   logo"): links een schuine balk tot onderaan, rechts een kortere balk
   met een knik aan de binnenkant — fijnere balken (operator: "de v moet
   fijner"), zelfde hoeken en knik. Als vector, zodat het op elk scherm
   scherp en wit blijft. */
function VMark() {
  return (
    <Svg width={36} height={34} viewBox="0 0 66 62">
      <Polygon points="0,0 13,0 33.5,62 21.5,62" fill="#ffffff" />
      <Polygon points="53,0 66,0 47.5,53 44.5,26" fill="#ffffff" />
    </Svg>
  );
}

export default function WelcomeScreen() {
  const [status, setStatus] = useState<Status>('checking');

  /* Reeds ingelogd? → welkomstscherm overslaan, direct de tabs in.
     Tijdens de check tonen we alleen de merk-achtergrondkleur (geen flits).
     Iter 9ar (2026-05-31): respecteert nu OOK de dev user-override
     'guest' — operator kan zo de welcome-flow testen zonder daadwerkelijk
     uit te loggen. We wachten eerst tot de override-cache geladen is om
     een race-conditie te vermijden waarbij de token-check eerder klaar
     is dan de override-load. In prod is awaitDevUserOverrideLoaded()
     een no-op (resolved direct). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await awaitDevUserOverrideLoaded();
      if (cancelled) return;
      const override = getDevUserOverride();
      const token = await getToken();
      if (cancelled) return;
      const treatAsGuest = override === 'guest';
      const treatAsSignedIn =
        override === 'audio' || override === 'bracelet' || override === 'pro';
      /* Iedereen ziet het welkomstscherm, ook wie ingelogd is (operator,
         7 augustus 2026). De gegevens worden nog steeds opgehaald — daar
         hangt af wat het scherm aanbiedt — alleen de omleiding is weg. */
      void treatAsSignedIn;
      void treatAsGuest;
      void token;
      setStatus('show');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Operator, 19 september 2026: eenmalige, gestaffelde intro — logo
     eerst, 150ms later de tagline, dan de knoppen één voor één van
     onderen omhoog met een zachte spring. `bgOpacity` is de "foto fadet
     in vanaf zwart"-stap; `status==='show'` triggert alles pas ná de
     login-check hierboven, dus er is geen risico dat dit start terwijl
     het scherm nog aan het bepalen is of het zichzelf moet overslaan. */
  const bgOpacity = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const pillarProgress = useSharedValue(0);
  useEffect(() => {
    if (status !== 'show') return;
    bgOpacity.value = withTiming(1, { duration: 800 });
    logoOpacity.value = withTiming(1, { duration: 380 });
    taglineOpacity.value = withDelay(150, withTiming(1, { duration: 380 }));
    pillarProgress.value = withDelay(
      300,
      withSpring(1, { damping: 16, stiffness: 120 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  /* Press-scale — zelfde recept als StartCard in breath-welcome.tsx.
     Kleine tekstlinks, dus 0.94 (icoon-/knop-schaal), geen aparte kaart.
     Operator ("kijk alle CTA's na"): ontbrak opacity(.85) + haptic-tik
     (huisstijl §5) — nu op allebei toegevoegd. */
  const activateScale = useSharedValue(1);
  const onActivatePressIn = () => {
    activateScale.value = withTiming(0.94, { duration: 80 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const onActivatePressOut = () => {
    activateScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const activateStyle = useAnimatedStyle(() => ({
    transform: [{ scale: activateScale.value }],
    opacity: 1 - (1 - activateScale.value) * 2.5,
  }));

  const signInScale = useSharedValue(1);
  const onSignInPressIn = () => {
    signInScale.value = withTiming(0.94, { duration: 80 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const onSignInPressOut = () => {
    signInScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const signInStyle = useAnimatedStyle(() => ({
    transform: [{ scale: signInScale.value }],
    opacity: 1 - (1 - signInScale.value) * 2.5,
  }));

  if (status === 'checking') {
    return <View style={s.checking} />;
  }

  return (
    <View style={s.root}>
      <Animated.Image
        source={{ uri: BG_IMG }}
        /* Operator, 7 okt 2026 ("foto stukje omlaag"): het beeldvlak steekt
           140 pt onder het scherm uit (bovenrand blijft op 0, geen zwarte
           strook) — het midden zakt 70 pt, de personen staan lager en het
           logo meer lucht heeft. */
        style={[StyleSheet.absoluteFill, { bottom: -140 }, bgStyle]}
        resizeMode="cover"
      />
      {/* Operator, 19 september 2026 ("gradient bovenaan — VIBEZCORE en
         tagline vallen weg tegen de lichte lucht"): symmetrisch met de
         bestaande onderste verloop hieronder — donker vanaf de bovenrand,
         volledig doorzichtig tegen het midden, zodat het logo altijd
         hoog contrast heeft ongeacht hoe licht de lucht op de foto is. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.15)', 'transparent']}
        locations={[0, 0.16, 0.32]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Operator, 17 september 2026 ("Apple lost dit op met een vloeiend
         zwart verloop — de jassen smelten samen met de zwarte
         ondergrond"): was een lichte "veiligheidsnet"-uitdoving (max
         ~45% zwart, begint pas op 42%) — te subtiel om de letters/knop-
         rand echt los te weken van de drukke kleding. Nu een écht
         verloop vanaf borsthoogte (~38%) dat onderaan volledig
         overgaat in dieprzwart (98%) — de foto blijft 100%
         schermvullend, maar de onderste band wordt een rustig, bijna
         egaal donker vlak waar de matglas-knoppen op kunnen "zweven". */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(0,0,0,0.25)',
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.75)',
        ]}
        locations={[0.45, 0.65, 0.85, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.top}>
          {/* Operator, 7 okt 2026 (eigen ontwerp): het V-teken met daaronder
             VIBEZCORE in ruim gespatieerde letters; geen tagline meer. */}
          <Animated.View style={[{ alignItems: 'center' }, logoStyle]} accessible accessibilityLabel="VIBEZCORE">
            <VMark />
            {/* Het echte woordmerk (met de VIBEZCORE-V), niet getypt
                (operator, 7 okt 2026: "de v in vibezcore moet ook die
                speciale v krijgen"). */}
            <Animated.Image
              source={require('../../assets/vibezcore_wordmark_wide.png')}
              style={[s.topWordmark, taglineStyle]}
              resizeMode="contain"
              tintColor="#ffffff"
            />
          </Animated.View>
        </View>

        {/* Spacer duwt de knoppen + links naar de onderste helft, over de
           foto's kleding heen i.p.v. over de gezichten. */}
        <View style={{ flex: 1 }} />

        <View style={s.pillars}>
          {PILLARS.map((p, i) => (
            <PillarButton key={p.key} p={p} index={i} progress={pillarProgress} />
          ))}
        </View>

        {/* Dun streepje tussen de knoppen en de links (eigen ontwerp). */}
        <View style={s.divider} />

        <View style={s.bottomLinks}>
          <AnimatedPressable
            accessibilityRole="link"
            onPress={() => router.navigate('/activate-bracelet' as never)}
            onPressIn={onActivatePressIn}
            onPressOut={onActivatePressOut}
            hitSlop={10}
            style={[s.bottomLinkRow, activateStyle]}
          >
            <Text style={s.bottomLinkText}>
              Have a bracelet? <Text style={s.bottomLinkAction}>Activate now</Text>
            </Text>
            <ChevronRight size={15} color="#ffffff" strokeWidth={2} />
          </AnimatedPressable>
          <AnimatedPressable
            accessibilityRole="link"
            onPress={() => router.navigate('/account')}
            onPressIn={onSignInPressIn}
            onPressOut={onSignInPressOut}
            hitSlop={10}
            style={[s.bottomLinkRow, signInStyle]}
          >
            <Text style={s.bottomLinkText}>
              Already a member? <Text style={s.bottomLinkAction}>Sign in</Text>
            </Text>
            <ChevronRight size={15} color="#ffffff" strokeWidth={2} />
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  checking: { flex: 1, backgroundColor: '#000000' },
  root: { flex: 1, backgroundColor: '#000000' },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  top: {
    alignItems: 'center',
    /* Operator, 7 okt 2026 ("logo moet lager, boven meer ruimte"). */
    paddingTop: 40,
  },
  topWordmark: {
    marginTop: 12,
    /* vibezcore_wordmark_wide.png: zelfde letters als het woordmerk, iets
       ruimer gespatieerd (operator, 7 okt 2026). 992×83 → zelfde lettergrootte
       als voorheen bij 120 breed. */
    width: 149,
    height: 12.5,
  },
  topTagline: {
    marginTop: 4,
    textAlign: 'center',
    fontFamily: BrandFonts.regular,
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
  },

  /* Operator, 17 september 2026 ("haal de dunne scheidingslijntjes weg,
     losse capsulevorm met witruimte ertussen"): gap 10→16 voor meer
     lucht tussen de drie knoppen — losse pillen i.p.v. een bijna-
     aaneengeplakt blok. */
  pillars: { gap: 14 },
  /* Volledige pil-vorm (borderRadius 999) i.p.v. afgeronde rechthoek —
     "eigen losse capsulevorm". */
  pillarWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    /* Rand op de buitenste vorm, niet op de BlurView: op Android tekende
       die enkel boven- en onderlijn, de ronde zijkanten vielen weg. */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  pillarPressed: { opacity: 0.7 },
  pillarBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    /* Operator, 7 okt 2026 ("knoppen minder hoog"): 68 → 56. */
    height: 56,
    paddingHorizontal: 24,
    /* Operator, 17 september 2026 ("matglas-effect, 40% doorzichtig"):
       0.22 → 0.55 dekking. Bij 0.22 verdween de knop-rand tegen drukke
       kleding — precies de onrust die opgelost moest worden. Op de nu
       veel donkerdere onderkant (zie de LinearGradient hierboven) geeft
       0.55 een duidelijke eigen vorm terwijl de foto er nog vaag
       doorheen schemert. */
    /* Operator, 7 okt 2026 (eigen ontwerp): helder glas — de foto blijft
       zichtbaar, een lichte rand tekent de capsule. */
    backgroundColor: 'rgba(30,30,32,0.28)',
  },
  /* Vaste breedte + gecentreerd: elk icoon (Wind/Zap/Headphones heeft
     een andere natuurlijke glyph-breedte) landt zo altijd op exact
     dezelfde verticale lijn. */
  pillarIconWrap: {
    width: 32,
    alignItems: 'center',
  },
  /* Operator, 17 september 2026 ("letters te dik en groot"): cardHeadline
     (22px Bold) was voor een kaart-context gemaakt, niet voor deze
     compacte pil — semibold + 17px oogt rustiger zonder de leesbaarheid
     op te offeren. */
  pillarTitle: {
    flex: 1,
    fontFamily: BrandFonts.medium,
    fontSize: 19,
    letterSpacing: -0.2,
    color: '#ffffff',
  },
  pillarProduct: {
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: PILLAR_ACCENT,
    marginBottom: 2,
  },

  divider: {
    alignSelf: 'center',
    width: 44,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginTop: 26,
    marginBottom: 22,
  },
  bottomLinks: {
    alignItems: 'center',
    gap: 16,
  },
  bottomLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bottomLinkText: {
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
  },
  bottomLinkAction: {
    color: '#ffffff',
    fontFamily: BrandFonts.semibold,
  },
});
