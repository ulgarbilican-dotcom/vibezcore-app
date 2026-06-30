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
   extrabold/black), accent #3a8fff, royale spacing, grote koppen.
   ─────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { Stack, router } from 'expo-router';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* Wordmark als hero — huisstijl-anker (MERK_ANKER §3). Local require zodat
   'ie offline werkt. */
const WORDMARK = require('../../assets/vibezcore_wordmark.png');

export default function AboutScreen() {
  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <Stack.Screen
        options={{ title: 'About', headerBackTitle: 'Back' }}
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
        <Text style={s.heroSub}>
          VIBEZCORE combines a haptic bracelet with a structured audio
          library. Two instruments, one purpose: lasting change.
        </Text>

        {/* ── Two products ── */}
        <ProductCard
          status="available"
          badge="AVAILABLE NOW"
          tag="Long-term growth"
          title="Audio Library"
          desc="144 structured psychological sessions across 4 core pillars. Not motivation — guided rewiring through audio that compounds over time."
          ctaLabel="Open Audio Library"
          onPress={() => router.navigate('/(tabs)/' as never)}
        />
        <ProductCard
          status="upcoming"
          badge="KICKSTARTER · 1 SEPT 2026"
          tag="Instant state control"
          title="Smart Bead Bracelet"
          desc="Precision haptic pulses on the wrist. Backed by science, bottom-up by design. Reset your state in minutes."
          ctaLabel="Explore Bracelet"
          onPress={() => router.navigate('/(tabs)/bracelet' as never)}
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

        {/* ── 02. How ── */}
        <SectionHeader num="02" title="How the two instruments work" />

        <Text style={s.subSection}>The Audio Library</Text>
        <Text style={s.tagline}>Train the Mind</Text>
        <P>
          Built on neuroscience, psychology and philosophy. Not
          motivation — understanding. Sessions that create real mental
          shifts over time.
        </P>
        <P>
          Each session expands the frameworks through which you
          understand yourself, sharpens self-awareness, and strengthens
          reflective thinking. Over time the ideas compound — improving
          emotional regulation, sharpening decisions, and giving you
          the clarity to guide your own evolution.
        </P>

        {/* Iter v172 (2026-06-29): Pillars verplaatst van losse sectie 03
            naar BINNEN Audio Library sub-sectie. Operator-feedback: "de
            sectie 4 pillaar of growth hoort bij blok audio library". De
            144 audio-sessies zijn georganiseerd over deze 4 pillars —
            bracelet heeft geen pillars. */}
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

        <Text style={[s.subSection, { marginTop: 32 }]}>
          The Smart Bead Bracelet
        </Text>
        <Text style={s.tagline}>Control the Moment</Text>
        <P>
          Precision haptics at the wrist. Instant state regulation —
          calm, focus or recovery. No screens. No effort. Just results.
        </P>
        <P>
          The body influences the mind: signals from your nervous
          system shape attention, emotion and decisions before
          cognition engages. The bracelet works with that biology —
          a direct route to inner state, bottom-up by design.
        </P>
        <Text style={[s.p, s.pBoldClose]}>
          <Text style={s.bold}>Body first. Mind follows.</Text>
        </Text>

        <Text style={s.smallNote}>
          All referenced research and thought leaders in our content are
          independent of VIBEZCORE. No affiliation or endorsement of any
          kind exists or is implied.
        </Text>

        {/* ── 03. Who (was sectie 04, hernummerd na verplaatsing pillars) ── */}
        <SectionHeader num="03" title="Who it's for" />
        <P>
          VIBEZCORE is not for everyone. It&apos;s built for people who
          are done living small — who sense their full potential but
          can&apos;t access it, who have adapted too long at the cost of
          their own growth, who want to understand themselves at the
          deepest level and build something unshakeable from the inside
          out.
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
  return (
    <Pressable
      style={[
        s.productCard,
        isAvailable ? s.productCardAvailable : s.productCardUpcoming,
      ]}
      onPress={onPress}
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
            { backgroundColor: isAvailable ? Brand.success : Brand.accent },
          ]}
        />
        <Text
          style={[
            s.productBadgeText,
            { color: isAvailable ? Brand.success : Brand.accent },
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
    </Pressable>
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
    backgroundColor: 'rgba(58,143,255,0.06)',
    borderColor: 'rgba(58,143,255,0.28)',
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
    backgroundColor: 'rgba(58,143,255,0.12)',
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
    color: Brand.accent,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
    marginRight: 6,
  },
  productCtaArrow: {
    color: Brand.accent,
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
    color: Brand.accent,
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
    color: Brand.accent,
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
    color: Brand.accent,
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
