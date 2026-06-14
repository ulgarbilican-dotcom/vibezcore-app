/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — About screen

   Brand-story page, 1-op-1 met vibezcore.com/about-vibezcore (2026-05-30).
   8 secties die uitleggen wat VIBEZCORE is, waarom 't bestaat, en voor
   wie. Geen legal doc — staat los van de legal/[doc] renderer omdat de
   visuele structuur fundamenteel anders is (pull quotes, system cards,
   4-pillar grid).

   Open vanuit: Account-tab → "About VIBEZCORE". Mogelijk later ook
   vanuit Welcome-screen voor first-time users.

   Visuele stijl volgt MERK_ANKER: dark bg, Inter (regular/semibold/
   extrabold/black), accent #3a8fff, royale spacing, grote koppen.
   ─────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { Stack } from 'expo-router';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* Wordmark als eyebrow ipv platte tekst (operator-besluit 2026-05-30:
   huisstijl = echt logo, niet "VIBEZCORE" in blauwe letters). Local
   require zodat 'ie offline werkt; MERK_ANKER §3. */
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
        <Text style={s.title}>
          Built on Experience.{'\n'}Anchored in Science.
        </Text>
        <Text style={s.heroSub}>
          The life you want requires a version of you that doesn't exist
          yet. VIBEZCORE was built to close that gap — permanently.
        </Text>

        {/* ── 01. Origin & Foundation ── */}
        <SectionHeader num="01" title="Origin & Foundation" />
        <P>
          VIBEZCORE was not built in a boardroom. It was built from
          experience — from the kind of personal reckoning that happens
          when you've spent years watching yourself and others operate
          far below their real capacity, not from lack of intelligence
          or ambition, but from a lack of the right tools.
        </P>
        <P>
          The insight was simple but overlooked: most personal
          development addresses the mind while ignoring the body. It
          tells you what to think while your nervous system keeps
          running the same old patterns. Real change doesn't start in
          the mind. It starts in the body — and the mind follows.
        </P>
        <PullQuote>
          "Stop drifting. Start directing. The life you want requires a
          version of you that doesn't exist yet."
        </PullQuote>
        <P>
          That realisation became the foundation of everything VIBEZCORE
          is built on — a system that works from the body up, not the
          mind down.
        </P>

        {/* ── 02. The Challenge ── */}
        <SectionHeader num="02" title="The Challenge" />
        <P>
          Most people never fully understand themselves. They move
          through life reacting — to situations, to people, to emotions
          they can't name. They adapt to avoid friction. Little by
          little, adapting becomes the default and their own direction
          fades.
        </P>
        <P>
          They've kept themselves easy, agreeable, and small enough to
          avoid conflict. They sense their potential but can't access
          it. They've been let down by systems, by people, by self-help
          content that promises transformation but delivers only
          temporary inspiration.
        </P>
        <PullQuote>
          "You've adapted long enough. No more shrinking. It stops here."
        </PullQuote>
        <P bold="reliable">
          The world is full of motivation. What it lacks is a reliable
          method to change how you actually function — in real time,
          under real pressure, in real life.
        </P>

        {/* ── 03. The VIBEZCORE System ── */}
        <SectionHeader num="03" title="The VIBEZCORE System" />
        <P>
          VIBEZCORE is a two-instrument system. Each instrument
          addresses a different dimension of human performance.
          Together, they form a complete approach to lasting change.
        </P>
        <View style={s.systemsGrid}>
          <SystemCard
            variant="dark"
            tag="Instant State Control"
            title="Smart Bead Bracelet"
            desc="A precision-engineered neuroscience instrument delivering calibrated haptic pulses through the wrist. Body resets. Mind follows. Immediate, repeatable, reliable."
          />
          <SystemCard
            variant="accent"
            tag="Long-Term Growth"
            title="Audio Library"
            desc="A structured psychological transformation program — not motivation, not a podcast. Intellectual guidance through audio that compounds over time."
          />
        </View>
        <P style={{ marginTop: 20 }}>
          One controls the moment. The other changes the game. Neither
          is optional if you want permanent results.
        </P>

        {/* ── 04. The Science ── */}
        <SectionHeader num="04" title="The Science Behind It" />
        <P>
          VIBEZCORE is grounded in the neuroscience of bottom-up
          regulation — the understanding that the nervous system can be
          directly influenced through the body before cognitive
          processes engage.
        </P>
        <P>
          The wrist provides access to nerve pathways that influence
          the autonomic nervous system. Precisely calibrated haptic
          stimulation at this location triggers a physiological
          response — resetting your internal state faster and more
          reliably than any top-down cognitive technique.
        </P>
        <P>
          The Audio Library operates on a complementary principle:
          structured, repeated exposure to reframed concepts — drawn
          from behavioural science, psychology, and philosophy —
          gradually rewires the patterns that drive your decisions,
          reactions, and identity.
        </P>
        <Text style={[s.p, s.pBoldClose]}>
          <Text style={s.bold}>Body first. Mind follows. Then identity
          shifts.</Text>{' '}This is the VIBEZCORE sequence.
        </Text>
        <Text style={s.smallNote}>
          All referenced research and thought leaders in our content
          are independent of VIBEZCORE. No affiliation, endorsement, or
          partnership of any kind exists or is implied.
        </Text>

        {/* ── 05. Four Pillars ── */}
        <SectionHeader num="05" title="Four Pillars of Growth" />
        <P>
          Everything within VIBEZCORE — the audio sessions, the
          community, the content — is built around four core domains of
          human development.
        </P>
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

        {/* ── 06. Collective ── */}
        <SectionHeader num="06" title="The VIBEZCORE Collective" />
        <P>
          VIBEZCORE is not a solo journey. The VIBEZCORE Collective is
          a private community for members who are serious about growth
          — a space where standard is maintained, not lowered to
          accommodate comfort.
        </P>
        <P>
          Inside the Collective, members engage with the four pillars,
          share real experiences, and hold each other to a higher
          standard. This is not a support group. It is a performance
          environment built for people who are done with excuses.
        </P>
        <P>
          Access is strictly personal and non-transferable. The quality
          of the space depends on the quality of the people in it.
        </P>

        {/* ── 07. Who It's For ── */}
        <SectionHeader num="07" title="Who VIBEZCORE Is For" />
        <P>
          VIBEZCORE is not for everyone. It is built for people who are
          done living small — those who are tired of not reaching their
          full potential, of not being understood or respected, of
          moving through life without real direction.
        </P>
        <P>
          It is for the person who has adapted too long, who has kept
          themselves easy and agreeable at the cost of their own
          growth. The person who senses there is more — and is ready to
          do what it takes to access it.
        </P>
        <P>
          Whether you are an entrepreneur, a leader, an athlete, or
          simply someone who refuses to settle — if you want to
          understand yourself at the deepest level and build something
          unshakeable from the inside out, VIBEZCORE was built for you.
        </P>
        <P>The platform is intended for users aged 18 and older.</P>

        {/* ── 08. The Mission ── */}
        <SectionHeader num="08" title="The Mission" />
        <PullQuote>
          Self-understanding. Self-control. Self-respect.{'\n'}
          Growth. Success. Freedom.
        </PullQuote>
        <P>
          That is what VIBEZCORE exists to build. Not as abstract
          ideals. As lived reality — earned through the work, structured
          by the system, compounded over time.
        </P>
        <P>
          The Kickstarter launch is scheduled for Summer 2026. A
          limited first release for the people who understand what this
          is and are ready to move.
        </P>

        {/* Closing footer — kort, brand-statement zonder CTA-druk
           (de echte CTA's komen elders in de app). */}
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

function P({
  children,
  bold,
  style,
}: {
  children: React.ReactNode;
  /** Optionele substring die als bold wordt gerenderd binnen de p */
  bold?: string;
  style?: object;
}) {
  if (bold && typeof children === 'string') {
    /* Eenvoudige bold-injectie: split rond de bold-substring. Bruikbaar
       voor short bold-runs binnen een paragraaf. Voor complexere markup
       gebruik Text-elementen direct. */
    const idx = children.indexOf(bold);
    if (idx >= 0) {
      return (
        <Text style={[s.p, style]}>
          {children.slice(0, idx)}
          <Text style={s.bold}>{bold}</Text>
          {children.slice(idx + bold.length)}
        </Text>
      );
    }
  }
  return <Text style={[s.p, style]}>{children}</Text>;
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.pullQuote}>
      <Text style={s.pullQuoteText}>{children}</Text>
    </View>
  );
}

function SystemCard({
  variant,
  tag,
  title,
  desc,
}: {
  variant: 'dark' | 'accent';
  tag: string;
  title: string;
  desc: string;
}) {
  const isDark = variant === 'dark';
  return (
    <View style={[s.systemCard, isDark ? s.systemDark : s.systemAccent]}>
      <Text style={[s.systemTag, isDark ? s.systemTagDark : s.systemTagAccent]}>
        {tag}
      </Text>
      <Text style={[s.systemTitle, isDark && s.systemTitleLight]}>
        {title}
      </Text>
      <Text style={[s.systemDesc, isDark && s.systemDescLight]}>{desc}</Text>
    </View>
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
  /* Wordmark als eyebrow — afmeting bewust kleiner dan de welcome-
     screen wordmark (180px) zodat 'ie als brand-anchor functioneert,
     niet als hero-element. Het echte hero is de h1-titel eronder. */
  wordmark: {
    width: 130,
    height: 22,
    alignSelf: 'flex-start',
    marginBottom: 18,
    tintColor: undefined, // PNG is wit op transparant — geen tint nodig
  },
  title: {
    color: Brand.text,
    fontSize: 32,
    fontFamily: BrandFonts.black,
    letterSpacing: -0.8,
    lineHeight: 38,
    marginBottom: 14,
  },
  heroSub: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 23,
    marginBottom: 8,
    maxWidth: 520,
  },

  /* Sections */
  sectionHeader: {
    marginTop: 40,
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

  /* Pull quote — accent-blauwe linker rand, panel-bg */
  pullQuote: {
    backgroundColor: 'rgba(58,143,255,0.10)',
    borderLeftColor: Brand.accent,
    borderLeftWidth: 3,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 22,
    marginVertical: 16,
  },
  pullQuoteText: {
    color: Brand.text,
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.3,
    lineHeight: 26,
  },

  /* Systems grid — twee cards (dark + accent) naast elkaar */
  systemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  systemCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 220,
    borderRadius: 16,
    padding: 22,
  },
  systemDark: {
    backgroundColor: '#0f0f0f',
    borderColor: Brand.border,
    borderWidth: 1,
  },
  systemAccent: {
    backgroundColor: 'rgba(58,143,255,0.10)',
    borderColor: 'rgba(58,143,255,0.30)',
    borderWidth: 1,
  },
  systemTag: {
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  systemTagDark: {
    color: 'rgba(244,244,244,0.4)',
  },
  systemTagAccent: {
    color: Brand.accent,
  },
  systemTitle: {
    color: Brand.text,
    fontSize: 16,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  systemTitleLight: {
    color: '#ffffff',
  },
  systemDesc: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
  },
  systemDescLight: {
    color: 'rgba(255,255,255,0.58)',
  },

  /* Pillars — 4 cards in 2x2 grid */
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
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

  /* Footer */
  footer: {
    marginTop: 40,
    paddingTop: 24,
    borderTopColor: Brand.border,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(244,244,244,0.3)',
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.5,
  },
});
