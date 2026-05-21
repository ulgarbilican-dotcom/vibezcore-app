/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Coming-pagina (verborgen sub-scherm, geen tab)

   Bron: webapp index_2_correct.html (.vz-view#vz-view-coming + secties
   .vz-coming-section-lbl "Existing Series" en "New Series"). Niets
   verzonnen — alleen wat in dit bestand staat is door operator letterlijk
   doorgegeven; ontbrekende series/tags zijn als TODO gemarkeerd.

   Routering: src/app/_layout.tsx registreert <Stack.Screen name="coming" />.
   Bereikbaar via router.push('/coming') vanuit de 13e card op de Audio-tab.
   ─────────────────────────────────────────────────────────────────────────── */

import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  bg: '#0a0a0a',
  text: '#ffffff',
  dim: 'rgba(255,255,255,0.55)',
  faint: 'rgba(255,255,255,0.4)',
  border: 'rgba(255,255,255,0.08)',
  accent: '#3a8fff',  // sectie 1 — bestaande series
  amber: '#f59e0b',   // sectie 2 — nieuwe series ("Coming")
};

const HERO_IMG = 'https://vibezcore-audio.b-cdn.net/images/whats-coming.png';

type RoadmapItem = {
  name: string;
  sub: string;
  tags: string[]; // eerste 3 default zichtbaar; rest achter "Show all"
};

/* ── Sectie 1: "Existing Series" — bron vz-view-coming, 11 series + 4
   Soundscapes-rijen. De Soundscapes-rijen hebben in de bron precies 3
   zichtbare tags zonder vz-stag-hidden + zonder Show-all-knop; doordat
   RoadmapRow alleen een knop rendert als tags.length > 3, valt die
   knop daar automatisch weg. Volgorde exact als bron (regel 30→160). */
const EXISTING_SERIES: RoadmapItem[] = [
  {
    name: 'Master Mental Clarity',
    sub: 'Advanced focus & brain control',
    tags: [
      'Deep Work Protocol',
      'Dopamine Reset System',
      'Focus Under Pressure',
      'Attention Span Rebuild',
      'Overstimulation Detox',
      'Cognitive Fatigue Reset',
      'Neural Flexibility Training',
      'Habit Loop Rewiring',
      'Visual Focus Training',
      'Mental Recovery Cycles',
    ],
  },
  {
    name: 'Beast Mode',
    sub: 'Unbreakable discipline & identity',
    tags: [
      'Pain as Fuel',
      'Ruthless Consistency',
      'Execute Without Emotion',
      'Discipline Over Motivation',
      'No Comfort Identity',
      'The Edge',
      'Zero Weakness Policy',
      'Relentless Identity',
      'Suffering vs Growth',
      'Mental Endurance',
    ],
  },
  {
    name: 'The Inner Blueprint',
    sub: 'Deep psychological transformation',
    tags: [
      'Shadow Integration',
      'Facing Your Darkness',
      'Inner Conflict Resolution',
      'Identity Fragmentation',
      'Projection & Reality',
      'The False Self',
      'Emotional Triggers',
      'Self-Deception',
      'Archetype Activation',
      'Inner Alignment',
    ],
  },
  {
    name: 'Daily Affirmations Power',
    sub: 'Reprogram your inner voice',
    tags: [
      'Inner Strength & Discipline',
      'Confidence & Identity',
      'Success & Drive',
      'Peace & Presence',
      'Power of Visualisation',
      'Morning Programming',
      'Evening Rewiring',
      'Self-Worth Rebuild',
      'Belief Reprogramming',
      'Identity Anchors',
    ],
  },
  {
    name: 'Meaning Over Comfort',
    sub: 'Structure & responsibility',
    tags: [
      'Order vs Chaos',
      'Responsibility Under Pressure',
      'Discipline as Meaning',
      'Truth vs Comfort',
      'Structure Your Life',
      'Chaos Management',
      'Masculine Responsibility',
      'Purpose Through Action',
      'Stability vs Growth',
      'Identity Through Responsibility',
    ],
  },
  {
    name: 'Journey to Success',
    sub: 'Execution & forward momentum',
    tags: [
      'Momentum Building',
      'Consistency Engine',
      'Delayed Gratification',
      'Long-Term Vision',
      'Execution Over Perfection',
      'Breaking Procrastination',
      'The Cost of Inaction',
      'Focused Action Loops',
      'Resilience in Setbacks',
      'Growth Through Pressure',
    ],
  },
  {
    name: 'Life After Betrayal',
    sub: 'From damage to strength',
    tags: [
      'Trust Recalibration',
      'Emotional Detachment',
      'Letting Go Without Closure',
      'Rebuilding Identity',
      'From Victim to Power',
      'No Attachment Dependency',
      'Closure Without Apology',
      'Rebuilding Self-Worth',
      'Emotional Independence',
      'Trusting Again',
    ],
  },
  {
    name: 'Identity & Wealth',
    sub: 'Internal wealth systems',
    tags: [
      'Wealth Consciousness',
      'Decision Speed',
      'Persistence Mechanics',
      'Desire & Obsession',
      'Breaking Scarcity',
      'Long-Term Thinking',
      'Financial Identity',
      'Opportunity Awareness',
      'Expansion Mindset',
      'Strategic Thinking',
    ],
  },
  {
    name: 'The Freedom Formula',
    sub: 'Clarity, leverage & independence',
    tags: [
      'Specific Knowledge',
      'Leverage Systems',
      'Time Ownership',
      'Wealth vs Money',
      'Long-Term Games',
      'Strategic Simplicity',
      'Solitude & Clarity',
      'Decision Independence',
      'Minimalism for Focus',
      'Freedom Through Structure',
    ],
  },
  {
    name: 'The Stoic Fortress',
    sub: 'Inner control & resilience',
    tags: [
      'Emotional Detachment',
      'Accepting Reality',
      'Control vs Reaction',
      'Discipline of Thought',
      'Inner Peace Under Pressure',
      'Stoic Resilience',
      'Perspective Shifting',
      'Detachment from Outcome',
      'Mental Endurance',
      'Calm in Chaos',
    ],
  },
  {
    name: 'End Fight-Or-Flight',
    sub: 'Full nervous system control',
    tags: [
      'Nervous System Reset',
      'Breath Control Protocol',
      'Stress Tolerance Training',
      'Parasympathetic Activation',
      'Body Awareness',
      'Fight/Flight Override',
      'Recovery Speed',
      'Stress Adaptation',
      'Calm Under Pressure',
      'Internal Safety',
    ],
  },
  /* Soundscapes — 4 rijen, precies 3 tags elk, geen Show-all-knop (bron). */
  {
    name: 'Calm Clarity',
    sub: 'Soundscapes · Theta Waves (4-7 Hz)',
    tags: ['Focus & Flow', 'Creative Concentration', 'Theta State Induction'],
  },
  {
    name: 'Rest & Reset',
    sub: 'Soundscapes · Delta Waves (0.5-4 Hz)',
    tags: ['Deep Sleep', 'Sleep Onset', 'Nervous System Recovery'],
  },
  {
    name: 'Zen Flow',
    sub: 'Soundscapes · Meditation',
    tags: ['Meditation', 'Stillness', 'Inner Awareness'],
  },
  {
    name: 'Harmonic',
    sub: 'Soundscapes · Ambient',
    tags: ['Background Calm', 'Yoga & Practice', 'Nature Ambience'],
  },
];

/* ── Sectie 2: "New Series" — bron vz-view-coming, 8 series. Allemaal
   met "Show all 10 sessions"-knop (3 zichtbaar + 7 verborgen). Amber
   dots via de color-prop op RoadmapRow. ── */
const NEW_SERIES: RoadmapItem[] = [
  {
    name: 'Mental Clarity Protocol',
    sub: 'Silence your mind',
    tags: [
      'Stop Rumination',
      'Decision Speed',
      'Mental Clarity Loops',
      'Silence Your Mind',
      'Cut Mental Noise',
      'Thought Control',
      'Focus Simplification',
      'Reduce Cognitive Load',
      'Clear Thinking Systems',
      'Precision Thinking',
    ],
  },
  {
    name: 'Warrior Mentality',
    sub: 'Discipline over emotion',
    tags: [
      'Warrior Mindset',
      'Choose Your Pain',
      "It's Hard",
      'No More Living in Fear',
      'Be Unbeatable',
      'Mental Toughness',
      'Emotional Control',
      'Stand Your Ground',
      'Strength Under Pressure',
      'Fight Through Resistance',
    ],
  },
  {
    name: 'Break the Cycle',
    sub: 'End generational limitation',
    tags: [
      'Break the Poor Mentality',
      'Raise Your Expectations',
      'Growth vs Stagnation',
      'Identity vs Environment',
      'Expansion Thinking',
      'Escape Limitation',
      'Wealth Mindset Shift',
      'Long-Term Thinking',
      'Ownership Mentality',
      'Build Beyond Your Past',
    ],
  },
  {
    name: 'State Switching',
    sub: 'Enter any state on demand',
    tags: [
      'Enter Calm State',
      'Enter Focus State',
      'Enter Performance State',
      'Switch Instantly',
      'Recover Fast',
      'Emotional Control On Demand',
      'Rapid Reset Protocol',
      'State Awareness',
      'Trigger-Based Switching',
      'Peak State Conditioning',
    ],
  },
  {
    name: 'David vs Goliath',
    sub: 'Build power from nothing',
    tags: [
      'Underdog Advantage',
      'Build From Nothing',
      'Silent Grind',
      'Prove Them Wrong',
      'Resilience Under Pressure',
      'Outsmart the Stronger',
      'Mental Toughness Edge',
      'Long Game Winning',
      'Resourcefulness',
      'Strength Through Adversity',
    ],
  },
  {
    name: 'Life Rebuild System',
    sub: 'Practical transformation',
    tags: [
      'How to Change Your Life',
      'Stop Multitasking',
      'How You Do Anything',
      'You Are Being Built',
      'Become Part of the Movement',
      'Daily Structure',
      'Action Systems',
      'Life Reset Protocol',
      'Discipline Framework',
      'Execution System',
    ],
  },
  {
    name: 'Fitness Motivation',
    sub: 'Train your body, train your mind',
    tags: [
      'Pain Is Inevitable',
      'Discipline Through Movement',
      'Physical Endurance',
      'Body = Mind Connection',
      'Push Beyond Limits',
      'Daily Movement Discipline',
      'Strength Through Pain',
      'Consistency in Training',
      'Energy Through Action',
      'Build Physical Identity',
    ],
  },
  {
    name: 'Jim Rohn Inspired',
    sub: 'Simple principles, powerful results',
    tags: [
      'Success Principles',
      'Discipline & Consistency',
      'Life Direction',
      'Personal Responsibility',
      'Long-Term Thinking',
      'Daily Habits',
      'Self-Development',
      'Value Creation',
      'Growth Philosophy',
      'Consistent Improvement',
    ],
  },
];

/* ── Pulserende dot — bron .vzdot/.vzdotamber keyframes. Opacity 1→0.35→1
   over 2.5s in een oneindige loop. Gebruikt useNativeDriver voor soepele
   60fps op de UI-thread. ── */
function PulseDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 1250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        opacity,
        flexShrink: 0,
      }}
    />
  );
}

/* ── Roadmap-rij (Spotify-card-pattern). Wrapper-card met altijd-zichtbare
   header-rij (dot + naam + subtitel + chevron). Bij uitgeklapt: tags-blok
   onder de header met de eerste 6 tags als pills. Bij >6 tags verschijnt
   in dezelfde wrap een "+ N more"-pill; tik erop = inline alle verborgen
   tags onthullen (knop verdwijnt dan). Bij dichtklappen wordt showAll
   voor deze rij ge-reset in de parent (zie toggleExisting/toggleNew). ── */
function RoadmapRow({
  item,
  color,
  expanded,
  onPress,
  showAll,
  onToggleShowAll,
}: {
  item: RoadmapItem;
  color: string; // 6-digit hex (#3a8fff of #f59e0b)
  expanded: boolean;
  onPress: () => void;
  showAll: boolean;
  onToggleShowAll: () => void;
}) {
  const total = item.tags.length;
  const hasMore = total > 6;
  const visibleTags = showAll || !hasMore ? item.tags : item.tags.slice(0, 6);
  return (
    <View style={s.rowCard}>
      <Pressable
        onPress={onPress}
        style={s.rowHeader}
        android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
      >
        <PulseDot color={color} />
        <View style={s.rowBody}>
          <Text style={s.rowName}>{item.name}</Text>
          <Text style={s.rowSub}>{item.sub}</Text>
        </View>
        <Text style={[s.rowChev, expanded && s.rowChevOpen]}>›</Text>
      </Pressable>
      {expanded && (
        <View style={s.tagsWrap}>
          {visibleTags.map((tag) => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>{tag}</Text>
            </View>
          ))}
          {hasMore && !showAll && (
            <Pressable
              onPress={onToggleShowAll}
              hitSlop={6}
              style={s.morePill}
            >
              <Text style={s.moreTxt}>+ {total - 6} more</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export default function ComingScreen() {
  /* Accordion-state — één rij tegelijk per sectie. Beide secties zijn
     onafhankelijk: een open rij in sectie 1 sluit níet een open rij in
     sectie 2. Sleutel = sectie-prefix + serie-naam zodat showAll-Set
     beide secties los kan tracken. */
  const [expandedExisting, setExpandedExisting] = useState<string | null>(null);
  const [expandedNew, setExpandedNew] = useState<string | null>(null);

  /* Show-all-state: Set met rij-keys waarvoor de "+ N more"-tags zijn
     onthuld. Bij sluiten van een rij wordt zijn entry verwijderd — bij
     volgende open begint de rij weer met 6 zichtbare tags. */
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  const clearShowAllFor = (key: string) =>
    setShowAll((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  const toggleShowAll = (key: string) => {
    setShowAll((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* Sectie-toggles. Reset showAll voor de rij die sluit (zowel bij
     dichttikken van de open rij als bij switchen naar een andere rij). */
  const toggleExisting = (key: string) => {
    if (expandedExisting !== null) clearShowAllFor(expandedExisting);
    setExpandedExisting((prev) => (prev === key ? null : key));
  };
  const toggleNew = (key: string) => {
    if (expandedNew !== null) clearShowAllFor(expandedNew);
    setExpandedNew((prev) => (prev === key ? null : key));
  };

  /* Back-helper, identiek patroon als player.tsx — back als er history
     is, anders fallback naar root zodat de gebruiker nooit vastzit. */
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* expo-router 55: header-config voor déze route via inline
         Stack.Screen i.p.v. een tweede registratie in root _layout
         (anders "Too many screens defined. Route 'coming' is extraneous"). */}
      <Stack.Screen options={{ headerShown: false }} />
      {/* ── Sticky topbar — back-knop links, titel midden. ── */}
      <View style={s.topbar}>
        <Pressable
          onPress={goBack}
          style={s.backBtn}
          hitSlop={14}
          android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: true }}
        >
          <Text style={s.backChev}>‹</Text>
          <Text style={s.backText}>Back</Text>
        </Pressable>
        <Text style={s.topbarTitle}>What's Coming</Text>
        <View style={s.topbarRight} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero-blok: foto + sterke gradient + eyebrow + 2-regel titel ── */}
        <View style={s.hero}>
          <Image source={{ uri: HERO_IMG }} style={s.heroImg} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.heroBody}>
            <Text style={s.heroEyebrow}>What's Coming</Text>
            <Text style={s.heroTitle}>
              New Sessions{'\n'}Every Month.
            </Text>
          </View>
        </View>

        {/* ── Fasenregel: EXISTING SERIES → NEW SERIES → NEW SESSIONS ── */}
        <View style={s.phasesWrap}>
          <Text style={s.phases}>
            EXISTING SERIES
            <Text style={s.phasesArrow}>{'  →  '}</Text>
            NEW SERIES
            <Text style={s.phasesArrow}>{'  →  '}</Text>
            NEW SESSIONS
          </Text>
        </View>

        {/* ── Sectie 1 — Existing Series → New Sessions Coming ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionLabel, { color: C.accent }]}>
                Existing Series
              </Text>
              <Text style={s.sectionTitle}>New Sessions Coming</Text>
            </View>
          </View>
          {EXISTING_SERIES.map((item) => {
            const key = 'existing:' + item.name;
            return (
              <RoadmapRow
                key={key}
                item={item}
                color={C.accent}
                expanded={expandedExisting === key}
                onPress={() => toggleExisting(key)}
                showAll={showAll.has(key)}
                onToggleShowAll={() => toggleShowAll(key)}
              />
            );
          })}
        </View>

        {/* ── Divider tussen secties ── */}
        <View style={s.divider} />

        {/* ── Sectie 2 — New Series → Launching Soon ──
            Geen "Coming"-badge meer rechtsboven (spec-wijziging). */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionLabel, { color: C.amber }]}>
                New Series
              </Text>
              <Text style={s.sectionTitle}>Launching Soon</Text>
            </View>
          </View>
          {NEW_SERIES.map((item) => {
            const key = 'new:' + item.name;
            return (
              <RoadmapRow
                key={key}
                item={item}
                color={C.amber}
                expanded={expandedNew === key}
                onPress={() => toggleNew(key)}
                showAll={showAll.has(key)}
                onToggleShowAll={() => toggleShowAll(key)}
              />
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 56 },

  /* Topbar */
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 80,
  },
  backChev: {
    color: C.text,
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '600',
    marginRight: 4,
    marginTop: -2,
  },
  backText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '500',
  },
  topbarTitle: {
    flex: 1,
    textAlign: 'center',
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
  },
  topbarRight: {
    minWidth: 80,
  },

  /* Hero */
  hero: {
    height: 280,
    overflow: 'hidden',
    backgroundColor: '#111',
    justifyContent: 'flex-end',
  },
  heroImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroBody: {
    padding: 24,
    paddingBottom: 28,
  },
  heroEyebrow: {
    color: C.dim,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  heroTitle: {
    color: C.text,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 35, // ≈ 1.1 × 32
    letterSpacing: -0.64, // ≈ -0.02em × 32
  },

  /* Fasenregel — bron .hero-phases-stijl, hergebruikt visueel patroon. */
  phasesWrap: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 6,
  },
  phases: {
    color: C.dim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  phasesArrow: {
    color: C.accent,
    fontWeight: '400',
  },

  /* Secties */
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.32, // ≈ 0.12em bij 11px
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 28, // ≈ 1.15 × 24
    letterSpacing: -0.48, // ≈ -0.02em × 24
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
    marginTop: 24,
  },

  /* ── Roadmap-rij (Spotify-card-pattern) ── */
  rowCard: {
    marginHorizontal: 14,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    // GEEN border per spec
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  rowSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 2,
  },
  rowChev: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
  rowChevOpen: {
    transform: [{ rotate: '90deg' }],
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.06)',
    // GEEN border per spec
  },
  tagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  /* "+ N more"-pill — inline laatste pill als showAll false en total > 6.
     Geen border, transparant, smalle horizontale padding. */
  morePill: {
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  moreTxt: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
});
