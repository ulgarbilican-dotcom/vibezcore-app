/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — About screen

   Iter v170 (2026-06-28): volledig herwerkt naar product-first structuur.
   Voorheen: 8 brand-story secties (Origin → Challenge → System → Science →
   Pillars → Collective → Who → Mission), ~2000 woorden, twee producten pas
   diep in sectie 03. Operator-feedback 2026-06-28: "niet heel duidelijk wat
   VIBEZCORE is, beide producten krijgen niet hun eigen platform".

   Nieuw:
     - Hero in 2 zinnen vertelt WAT het is.
     - Twee product-cards direct daaronder met badges (AVAILABLE NOW /
       KICKSTARTER) + CTAs naar de respectievelijke tab.
     - Brand-story ingedikt tot 4 secties (Why · How · Pillars · Who).
     - Mission als closing-statement.

   Open vanuit: Account-tab → "About VIBEZCORE".

   Visuele stijl volgt MERK_ANKER: dark bg, Inter (regular/semibold/
   extrabold/black), royale spacing, grote koppen. Accent-tekst/labels
   gebruiken AudioAccent (Huisstijl v4.4, zie import hieronder) —
   niet Brand.accent, die is voor haptic-pulse/"nu actief".
   ─────────────────────────────────────────────────────────────────── */

import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { openBraceletWebsite } from '@/services/bracelet-upsell';
/* Operator, 26 september 2026 (Huisstijl & Design Handboek v4.4):
   Brand.accent (#3a8fff, Signal Blue) is enkel voor haptic-pulse/"nu
   actief" — nooit voor badges/eyebrows/labels/CTA-links/tints. Dit
   scherm is dark, dus AudioAccent is de vervanging. */
const ACCENT_TEXT_ON_DARK_RGB = '110,133,196';
import { Stack, router } from 'expo-router';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

/* Press-scale recipe (zie breath-welcome.tsx `StartCard`) — de drie
   ProductCards hadden nog geen enkele press-feedback. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Wordmark als hero — huisstijl-anker (MERK_ANKER §3). Local require zodat
   'ie offline werkt. */
const WORDMARK = require('../../assets/vibezcore_wordmark.png');

export default function AboutScreen() {
  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'About',
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <Image
          source={WORDMARK}
          style={s.wordmark}
          resizeMode="contain"
          accessibilityLabel="VIBEZCORE"
        />
        <Text style={s.heroTitle}>
          Personal development, engineered.
        </Text>
        {/* Zesde herziening (operator, 11 augustus 2026, finale Engelse
            essentie-tekst, letterlijk aangehouden): drie instrumenten —
            Bracelet = Instant State Control, Breathwork = Active State
            Training, Audio Library = Long-Term Growth. Sluit af met de
            operator's exacte tagline "Control Your State. Build Your
            Future." — dit is de finale, goedgekeurde copy. */}
        <Text style={s.heroSub}>
          VIBEZCORE is a platform for state control and personal growth.
          It combines a Smart Bead Bracelet for instant state control,
          guided breathwork for active state training, and a structured
          Audio Library for long-term growth. Not just feeling better —
          performing better, and continuing to develop over time.
        </Text>
        <Text style={s.heroResult}>
          Control Your State. Build Your Future.
        </Text>

        {/* ── Two products (commercieel: wat je NU kunt kopen vs. wat nog
            komt — dit is een aankoop-indeling, geen merk-identiteit; de
            drie instrumenten hieronder blijven wel apart benoemd) ── */}
        <ProductCard
          status="available"
          badge="AVAILABLE NOW"
          tag="Practiced today"
          title="Guided Breathwork"
          desc="All 35 guided sessions across five states — energy, focus, calm, clarity, rest. Voice, visuals and haptics carry every breath, with the full Audio Library included."
          ctaLabel="Start Breathing"
          onPress={() => router.dismissTo('/breath' as never)}
        />
        {/* Derde productkaart toegevoegd (operator, 11 augustus 2026: "je
            hebt onder blok personal development engineered de audio
            library niet staan"). Alle drie instrumenten horen hier
            benoemd, niet alleen Breathwork en Bracelet. */}
        <ProductCard
          status="available"
          badge="AVAILABLE NOW"
          tag="Long-term growth"
          title="The Audio Library"
          desc="A structured library built on neuroscience, psychology and philosophy — training the mind for change that lasts. Included with Breathwork Premium."
          ctaLabel="Explore Library"
          onPress={() => router.dismissTo('/' as never)}
        />
        {/* Vijfde ronde (operator, 11 augustus 2026: "verwijder gewoon die
            blok met bracelet info" — de losse "EXCLUSIVE ADDITION"-sectie
            stond direct ná deze kaart en herhaalde grotendeels dezelfde
            boodschap. Verwijderd; de kernboodschap (HapticCore/gemstones,
            breathwork als eigen selling point) zit nu in de kaart-desc
            hieronder, één keer, niet twee blokken na elkaar. */}
        <ProductCard
          status="upcoming"
          badge="KICKSTARTER · EARLY 2027"
          tag="Standalone bottom-up state regulation"
          title="Smart Bead Bracelet"
          desc="One HapticCore, built into a bracelet of premium natural gemstone beads — jewelry first, technology second. Calm, focus or recovery on demand. And for breathwork, a selling point on its own: a pre-set, structured session carried entirely through haptic pulses on your wrist, no screen needed."
          ctaLabel="Explore Bracelet"
          /* Bracelet-links → de website (operator 7 okt; audit 8 okt 2026). */
          onPress={() => void openBraceletWebsite()}
        />

        {/* ── 01. Why ── */}
        <SectionHeader num="01" title="Why VIBEZCORE exists" />
        <P>
          The life you want requires a version of you that doesn&apos;t
          exist yet. Most personal development gives you motivation but
          leaves both your physiology and your mental frameworks
          untouched — so the old patterns keep running.
        </P>
        <P>
          Real change requires both: a way to shift your state in the
          moment, and a way to rewire how you think over time. VIBEZCORE
          is built around that pairing.
        </P>
        <P>
          Greater control over how you feel, think, and perform. Short
          term: more calm, better focus, higher energy, improved sleep.
          Long term: better habits, greater self-awareness, stronger
          mental resilience, more intentional living.
        </P>

        {/* ── 02. How — drie instrumenten, elk een eigen functie.
            Volgorde en labels (operator, definitieve essentie-tekst):
            Bracelet = Instant/Passive State Control, Breathwork = Active
            State Training, Audio Library = Long-Term Growth. */}
        <SectionHeader num="02" title="How the three instruments work" />

        <Text style={s.subSection}>Instant State Control</Text>
        <Text style={s.tagline}>Smart Bead Bracelet</Text>
        <P>
          Precision haptics at the wrist change your physiological state
          within minutes — calm, focus, energy or sleep, on demand. No
          screen to watch, no effort: pure bottom-up regulation, passive
          by design.
        </P>
        <P>
          The body influences the mind: signals from your nervous
          system shape attention, emotion and decisions before
          cognition engages. The bracelet works with that biology —
          a direct route to inner state, bottom-up by design.
        </P>
        <P>
          And when you do want to breathe, it becomes something more:
          the same haptic guidance can carry a breathwork session
          discreetly onto your wrist — an innovative, screen-free way
          to practice, on top of everything it already does on its own.
        </P>
        <Text style={[s.p, s.pBoldClose]}>
          <Text style={s.bold}>Body first. Mind follows.</Text>
        </Text>

        <Text style={[s.subSection, { marginTop: 32 }]}>
          Active State Training
        </Text>
        <Text style={s.tagline}>Guided Breathwork</Text>
        <P>
          Learn to consciously steer your state through your breath.
          All 35 guided sessions across five states — energy, focus,
          calm, clarity, rest — regulate stress, raise focus, activate
          energy or create relaxation, with voice, visuals and haptics
          carrying every breath in real time. This is active practice:
          something you do, not something you passively receive.
        </P>

        <Text style={[s.subSection, { marginTop: 32 }]}>
          Long-Term Growth
        </Text>
        <Text style={s.tagline}>The Audio Library</Text>
        <P>
          Built on neuroscience, psychology and philosophy. Not
          motivation — understanding. Sessions that develop new mental
          models, habits and behavioural patterns that create real
          shifts over time.
        </P>
        <P>
          Each session expands the frameworks through which you
          understand yourself, sharpens self-awareness, and strengthens
          reflective thinking. Over time the ideas compound — improving
          emotional regulation, sharpening decisions, and giving you
          the clarity to guide your own evolution.
        </P>

        {/* Iter v172 (2026-06-29): Pillars binnen Audio Library sub-sectie.
            Operator-feedback: "de sectie 4 pillaar of growth hoort bij
            blok audio library". De 144 audio-sessies zijn georganiseerd
            over deze 4 pillars — breathwork en bracelet hebben geen
            pillars. Namen zijn bindend (CLAUDE.md §4) — niet hernoemen
            zonder expliciete operator-goedkeuring, ook niet als een
            losse mondelinge opsomming andere woorden gebruikt. */}
        <Text style={s.pillarsHeading}>Four pillars of growth</Text>
        <View style={s.pillarsGrid}>
          <Pillar
            num="01"
            name="Psychological Resilience"
            desc="Build what cannot break."
          />
          <Pillar
            num="02"
            name="Inner Sovereignty"
            desc="Master what is yours."
          />
          <Pillar
            num="03"
            name="Social Mastery"
            desc="Command without force."
          />
          <Pillar
            num="04"
            name="Strategic Execution & Wealth"
            desc="Engineer your autonomy."
          />
        </View>

        {/* Vierde onderscheid naast de drie instrumenten: de interface
            zelf (operator, 11 augustus 2026: "onze interface is ook heel
            uniek en gebouwd om rust en happy gevoel te brengen"). */}
        <Text style={[s.subSection, { marginTop: 32 }]}>
          The Interface
        </Text>
        <Text style={s.tagline}>Built to Feel Calm</Text>
        <P>
          Most apps compete for your attention. VIBEZCORE is built the
          opposite way — every screen, motion and sound is designed to
          settle you, not stimulate you. The interface is part of the
          product, not just the way you reach it.
        </P>

        <Text style={s.smallNote}>
          All referenced research and thought leaders in our content are
          independent of VIBEZCORE. No affiliation or endorsement of any
          kind exists or is implied.
        </Text>

        {/* ── 03. Who — operator, definitieve essentie-tekst: "voor
            mensen die meer controle willen over zichzelf... kort: voor
            mensen die niet willen leven op automatische piloot." */}
        <SectionHeader num="03" title="Who it's for" />
        <P>
          VIBEZCORE is for people who want greater control over
          themselves — entrepreneurs, professionals, leaders, creatives,
          high-performers under pressure, anyone committed to personal
          growth. It&apos;s not for everyone. In short: for people who
          refuse to live on autopilot.
        </P>
        <Text style={s.smallNote}>
          The platform is intended for users aged 18 and older.
        </Text>

        {/* ── Closing — Mission ── */}
        <View style={s.missionBlock}>
          <Text style={s.missionLine}>
            Self-understanding. Self-control. Self-respect.
          </Text>
          <Text style={s.missionLine}>
            Growth. Success. Freedom.
          </Text>
          <Text style={s.missionFooter}>
            That&apos;s what VIBEZCORE exists to build.
          </Text>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>© VIBEZCORE</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Sub-componenten ──────────────────────────────────────────── */

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionNum}>{num}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>;
}

/* Iter v170: ProductCard — vervangt het oude SystemCard-grid. Per product
   één volle-breedte card met badge (status-indicator), tag, title,
   beschrijving, en een tap-bare CTA naar de respectievelijke tab. */
function ProductCard({
  status,
  badge,
  tag,
  title,
  desc,
  ctaLabel,
  onPress,
}: {
  status: 'available' | 'upcoming';
  badge: string;
  tag: string;
  title: string;
  desc: string;
  ctaLabel: string;
  onPress: () => void;
}) {
  const isAvailable = status === 'available';

  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <AnimatedPressable
      style={[
        s.productCard,
        isAvailable ? s.productCardAvailable : s.productCardUpcoming,
        pressStyle,
      ]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityLabel={ctaLabel}
    >
      <View
        style={[
          s.productBadge,
          isAvailable ? s.productBadgeAvailable : s.productBadgeUpcoming,
        ]}
      >
        <View
          style={[
            s.productBadgeDot,
            { backgroundColor: isAvailable ? Brand.success : AudioAccent },
          ]}
        />
        <Text
          style={[
            s.productBadgeText,
            { color: isAvailable ? Brand.success : AudioAccent },
          ]}
        >
          {badge}
        </Text>
      </View>
      <Text style={s.productTag}>{tag}</Text>
      <Text style={s.productTitle}>{title}</Text>
      <Text style={s.productDesc}>{desc}</Text>
      <View style={s.productCta}>
        <Text style={s.productCtaText}>{ctaLabel}</Text>
        <Text style={s.productCtaArrow}>→</Text>
      </View>
    </AnimatedPressable>
  );
}

function Pillar({
  num,
  name,
  desc,
}: {
  num: string;
  name: string;
  desc: string;
}) {
  return (
    <View style={s.pillar}>
      <Text style={s.pillarNum}>{num}</Text>
      <Text style={s.pillarName}>{name}</Text>
      <Text style={s.pillarDesc}>{desc}</Text>
    </View>
  );
}

/* ── Styles ───────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 20, paddingBottom: 48 },

  /* Hero */
  wordmark: {
    width: 160,
    height: 26,
    alignSelf: 'flex-start',
    marginBottom: 22,
    tintColor: undefined,
  },
  heroTitle: {
    color: Brand.text,
    fontSize: 30,
    fontFamily: BrandFonts.black,
    letterSpacing: -0.8,
    lineHeight: 36,
    marginBottom: 14,
  },
  heroSub: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 23,
    marginBottom: 12,
    maxWidth: 520,
  },
  heroResult: {
    color: AudioAccent,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    lineHeight: 22,
    marginBottom: 30,
    maxWidth: 520,
  },

  /* Product cards */
  productCard: {
    borderRadius: 16,
    padding: 22,
    marginBottom: 14,
    borderWidth: 1,
  },
  productCardAvailable: {
    backgroundColor: 'rgba(74,222,128,0.06)',
    borderColor: 'rgba(74,222,128,0.28)',
  },
  productCardUpcoming: {
    backgroundColor: `rgba(${ACCENT_TEXT_ON_DARK_RGB},0.06)`,
    borderColor: `rgba(${ACCENT_TEXT_ON_DARK_RGB},0.28)`,
  },
  productBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  productBadgeAvailable: {
    backgroundColor: 'rgba(74,222,128,0.10)',
  },
  productBadgeUpcoming: {
    backgroundColor: `rgba(${ACCENT_TEXT_ON_DARK_RGB},0.12)`,
  },
  productBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  productBadgeText: {
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.4,
  },
  productTag: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  productTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  productDesc: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    marginBottom: 18,
  },
  productCta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productCtaText: {
    color: AudioAccent,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
    marginRight: 6,
  },
  productCtaArrow: {
    color: AudioAccent,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },

  /* Sections */
  sectionHeader: {
    marginTop: 36,
    marginBottom: 14,
    paddingTop: 26,
    borderTopColor: Brand.border,
    borderTopWidth: 1,
  },
  sectionNum: {
    color: AudioAccent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  sectionTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    lineHeight: 28,
  },

  /* Paragraphs */
  p: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 26,
    marginBottom: 12,
  },
  pBoldClose: {
    marginBottom: 6,
    marginTop: 4,
  },
  subSection: {
    color: AudioAccent,
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  tagline: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    lineHeight: 28,
    marginBottom: 12,
  },
  bold: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
  },
  smallNote: {
    color: 'rgba(244,244,244,0.35)',
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 14,
  },

  /* Iter v172 (2026-06-29): Pillars-heading nu BINNEN Audio Library
     sub-sectie, niet als losse section. Iets kleinere visual weight. */
  pillarsHeading: {
    color: Brand.text,
    fontSize: 17,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    marginTop: 22,
    marginBottom: 4,
  },
  /* Pillars — 4 cards in 2x2 grid */
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  pillar: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  pillarNum: {
    color: AudioAccent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  pillarName: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  pillarDesc: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
  },

  /* Mission closing */
  missionBlock: {
    marginTop: 40,
    paddingTop: 30,
    paddingBottom: 20,
    paddingHorizontal: 18,
    borderTopColor: Brand.border,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  missionLine: {
    color: Brand.text,
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.3,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 2,
  },
  missionFooter: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 320,
  },

  /* Footer */
  footer: {
    marginTop: 24,
    paddingTop: 18,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(244,244,244,0.3)',
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.5,
  },
});
