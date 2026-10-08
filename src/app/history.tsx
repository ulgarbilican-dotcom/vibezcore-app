/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Your Journey (history)

   Verborgen sub-scherm, geen tab. Bereikbaar via de "Your Journey"-card op
   de Audio Library-tab (router.push('/history')). Data uit
   AsyncStorage-key `vzh_v1`, geschreven door player.tsx tijdens play.

   Layout 1:1 ontleend aan webapp history.html:
     - Streak-card (gradient als streak > 0)
     - 3 stat-cards: Sessions · Minutes · Longest
     - Search bar (case-insensitive op title|series)
     - Dag-groepen TODAY / YESTERDAY / weekday / weekday+date
     - Entry-row: thumbnail · title · series · meta (◐/✓ · dur · reltime · ↻fc)
     - Pagination: laatste 30 dagen + "Show older"-knop (verborgen tijdens search)
     - Empty state
     - ⋮ menu → Clear history (confirm Alert)

   Thumbnail-keuze: SERIES_PHOTO['<series>'] — Soundscapes-subseries worden
   NIET opgeslagen in vzh_v1 (operator-besluit 2026-05-20: schema-parity met
   webapp behouden, achterwaarts uitbreidbaar).
   ─────────────────────────────────────────────────────────────────────── */

import { SERIES_PHOTO } from '@/data/audio-library-data';
import {
  computeStats,
  computeStreak,
  dayLabel,
  fmtDur,
  formatListenedLabel,
  relTime,
  useHistory,
  type HistoryEntry,
} from '@/utils/history';
import { router, Stack } from 'expo-router';
import { Flame, Play, Search, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showVibezAlert } from '@/components/VibezAlert';
import { AudioAccent, BrandFonts } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Operator, 15 september 2026 (Apple-upgrade — "Your Journey" als rustig
   Bento Grid i.p.v. donkere, rommelige statistiekblokken): zelfde
   light/C-token-toggle als de andere tabs. Veldnamen blijven dezelfde
   als de oorspronkelijke inline `C` (bg/text/dim/faint/...) — alleen de
   WAARDEN veranderen per stand, zodat de rest van dit bestand niet
   herschreven hoeft te worden. */
/* Operator, 26 september 2026: dark is de nieuwe app-brede default (was
   light, 14 september) — zelfde hardcoded-schakelaar-patroon, enkel de
   waarde omgezet. */
const light = false;
/* Operator, 26 september 2026: was '#1E2A4A' (Royal Indigo, afgeschaft) —
   naam blijft staan (scheelt 10 plekken rename in dit bestand), waarde
   wijst nu naar Bio-Teal ("kleine player moet ook nieuwe accentkleur",
   dit scherm miste de eerdere sweep omdat het een lokale const was). */
const ROYAL_INDIGO = AudioAccent;
const DARK = {
  bg: '#000',
  text: '#fff',
  dim: 'rgba(255,255,255,0.55)',
  faint: 'rgba(255,255,255,0.4)',
  ghost: 'rgba(255,255,255,0.25)',
  card: 'rgba(255,255,255,0.04)',
  cardStrong: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  searchBg: 'rgba(255,255,255,0.05)',
  accent: AudioAccent, // 8 okt 2026: was Signal Blue
  partial: AudioAccent,
  full: '#4ade80',
  inputDim: 'rgba(255,255,255,0.4)',
};
/* Operator, 15 september 2026: "Partly listened" verliest hier het felle
   Signal Blue — dit is HISTORISCHE data (geen live-afspeelstatus), dus
   het functionele-signaal-argument voor blauw gaat niet op; gedimd grijs
   zoals de rest van de meta-tekst. */
const LIGHT = {
  bg: '#F5F5F7',
  text: '#1D1D1F',
  dim: '#8E8E93',
  faint: '#8E8E93',
  ghost: 'rgba(10,10,12,0.15)',
  card: '#FFFFFF',
  cardStrong: '#FFFFFF',
  border: '#E5E5EA',
  searchBg: 'rgba(0,0,0,0.05)',
  accent: ROYAL_INDIGO,
  partial: '#8E8E93',
  full: '#16a34a',
  inputDim: '#8E8E93',
};
const C = light ? LIGHT : DARK;

/* Zachte iOS-kaartschaduw voor de witte Bento-vlakken. */
const SOFT_SHADOW = light
  ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    }
  : {};

const PAGE_DAYS = 30;
const MS_PER_DAY = 86400000;

type Row =
  | { kind: 'header'; key: string; label: string }
  | {
      kind: 'entry';
      key: string;
      entry: HistoryEntry;
      isFirst: boolean;
      isLast: boolean;
    };

export default function HistoryScreen() {
  const { history, ready, clear } = useHistory();
  const [search, setSearch] = useState('');
  const [pageDays, setPageDays] = useState(PAGE_DAYS);
  const [menuOpen, setMenuOpen] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  /* Sorteer descending op ts; search filtert vóór groepering. Pagination
     telt dagen sinds nu — entries op die dagen blijven onbeperkt. */
  const filtered = useMemo<HistoryEntry[]>(() => {
    const q = search.trim().toLowerCase();
    const arr = [...history].sort((a, b) => b.ts - a.ts);
    if (!q) return arr;
    return arr.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.series.toLowerCase().includes(q)
    );
  }, [history, search]);

  /* Hoeveel oudere entries bestaan buiten het page-window? Voor de knop-tekst. */
  const olderCount = useMemo(() => {
    if (search.trim()) return 0;
    const cutoff = Date.now() - pageDays * MS_PER_DAY;
    return history.filter((e) => e.ts < cutoff).length;
  }, [history, pageDays, search]);

  const visible = useMemo<HistoryEntry[]>(() => {
    if (search.trim()) return filtered;
    const cutoff = Date.now() - pageDays * MS_PER_DAY;
    return filtered.filter((e) => e.ts >= cutoff);
  }, [filtered, pageDays, search]);

  const streak = useMemo(() => computeStreak(history), [history]);
  const stats = useMemo(() => computeStats(history), [history]);

  /* Bouw flat list met header-rows tussen dag-groepen. Elke entry
     onthoudt of hij de EERSTE/LAATSTE van zijn dag-groep is — dat bepaalt
     welke hoeken afgerond zijn en of er een scheidingslijntje boven komt,
     zodat alle rijen van één dag optisch één doorlopend wit Bento-vlak
     vormen (operator, 15 september 2026: "stop de hele lijst met tracks
     van die dag in één doorlopend wit vlak"). */
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastLabel = '';
    visible.forEach((e, i) => {
      const label = dayLabel(e.ts);
      const isFirst = label !== lastLabel;
      if (isFirst) {
        out.push({ kind: 'header', key: `h-${label}-${i}`, label });
        lastLabel = label;
      }
      const next = visible[i + 1];
      const isLast = !next || dayLabel(next.ts) !== label;
      out.push({
        kind: 'entry',
        key: `e-${e.url}-${e.ts}-${i}`,
        entry: e,
        isFirst,
        isLast,
      });
    });
    return out;
  }, [visible]);

  const onClearHistory = () => {
    setMenuOpen(false);
    void showVibezAlert({
      title: 'Clear history',
      message:
        'This will permanently delete your listening history. Continue?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clear();
          },
        },
      ],
    });
  };

  /* Press-schaal voor de "Clear history"-menu-item, zelfde recept als
     StartCard (breath-welcome.tsx): geen bounce bij indrukken, wel bij
     loslaten. */
  const clearPressScale = useSharedValue(1);
  const onClearPressIn = () => {
    clearPressScale.value = withTiming(0.96, { duration: 80 });
  };
  const onClearPressOut = () => {
    clearPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const clearPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: clearPressScale.value }],
  }));

  const playEntry = (e: HistoryEntry) => {
    router.push({
      pathname: '/player',
      params: {
        title: e.title,
        series: e.series,
        url: e.url,
        /* History bewaart geen `free` of `desc` (zit niet in vzh_v1).
           Player-flow honoreert entitlements; voor history-replay laten
           we de player zelf bepalen. Default: behandelen als premium. */
        free: 'false',
        desc: '',
      },
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Operator, 15 september 2026 (Apple-upgrade): "titel groot en dik
         gedrukt aan de linkerkant i.p.v. gecentreerd in kleine letters" —
         back-knop nu enkel het pijltje (compact), titel neemt de vrije
         ruimte in als echte H2-sectiekop. Witte balk + flinterdunne
         scheidingslijn i.p.v. de vorige donkere balk. */}
      <View style={s.topbar}>
        <Pressable
          onPress={goBack}
          style={s.backBtn}
          hitSlop={14}
          android_ripple={{
            color: 'rgba(10,10,12,0.06)',
            borderless: true,
          }}
        >
          <Text style={s.backChev}>‹</Text>
        </Pressable>
        <Text style={s.topbarTitle} numberOfLines={1}>
          Your Journey
        </Text>
        <Pressable
          onPress={() => setMenuOpen((v) => !v)}
          style={s.menuBtn}
          hitSlop={14}
        >
          <Text style={s.menuDots}>⋮</Text>
        </Pressable>
      </View>

      {menuOpen ? (
        <View style={s.menuPopover}>
          <AnimatedPressable
            onPress={onClearHistory}
            onPressIn={onClearPressIn}
            onPressOut={onClearPressOut}
            style={[s.menuItem, clearPressStyle]}
            android_ripple={{ color: 'rgba(10,10,12,0.06)' }}
          >
            <Text style={s.menuItemText}>Clear history</Text>
          </AnimatedPressable>
        </View>
      ) : null}

      {!ready ? (
        <View style={s.center} />
      ) : history.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListHeaderComponent={
            <View>
              <StreakCard streak={streak} />
              <StatsRow stats={stats} />
              <SearchBar value={search} onChange={setSearch} />
              {rows.length === 0 ? (
                <View style={s.searchEmpty}>
                  <Text style={s.searchEmptyText}>
                    No sessions match "{search}".
                  </Text>
                </View>
              ) : null}
            </View>
          }
          ListFooterComponent={
            !search.trim() ? (
              <PaginationFooter
                olderCount={olderCount}
                expanded={pageDays > PAGE_DAYS}
                onExpand={() => setPageDays((d) => d + PAGE_DAYS)}
                onCollapse={() => setPageDays(PAGE_DAYS)}
              />
            ) : null
          }
          /* Operator, 15 september 2026 (Apple-upgrade): "tracklijst
             verschijnt 150ms later via een zachte fade" — de kaarten
             bovenin (streak/stats) hebben hun eigen spring-entrance, de
             lijst daaronder krijgt een aparte, vertraagde opacity-fade
             zodat het oog eerst naar de prestaties bovenin gaat. */
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Animated.Text
                entering={FadeIn.delay(150).duration(280)}
                style={s.dayLabel}
              >
                {item.label.toUpperCase()}
              </Animated.Text>
            ) : (
              <Animated.View entering={FadeIn.delay(150).duration(280)}>
                <EntryRow
                  entry={item.entry}
                  isFirst={item.isFirst}
                  isLast={item.isLast}
                  onPlay={() => playEntry(item.entry)}
                />
              </Animated.View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

/* Operator, 15 september 2026 (Apple-upgrade): "cijfers tellen in 400ms
   op van 0 naar hun actuele waarde" — een `TextInput` (niet-editable)
   waarvan Reanimated de `text`-prop rechtstreeks op de UI-thread update,
   het standaard patroon voor een "count-up" zonder een her-render per
   frame. Hergebruikt voor de streak én de 3 statcijfers. */
const AnimatedCountInput = Animated.createAnimatedComponent(TextInput);
function CountUp({
  value,
  style,
  delay = 0,
}: {
  value: number;
  style: TextStyle;
  delay?: number;
}) {
  const sv = useSharedValue(0);
  useEffect(() => {
    sv.value = 0;
    sv.value = withDelay(
      delay,
      withTiming(value, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);
  const animatedProps = useAnimatedProps(() => ({
    text: `${Math.round(sv.value)}`,
  })) as any;
  return (
    <AnimatedCountInput
      editable={false}
      underlineColorAndroid="transparent"
      defaultValue={`${value}`}
      animatedProps={animatedProps}
      style={[{ padding: 0 }, style]}
    />
  );
}

/* Operator, 15 september 2026 (Apple-upgrade): "puur wit Bento-eiland,
   vuurtje wordt een strak vectorgebaseerd icoon, cijfer in H1 Royal
   Indigo" — de vorige blauw-groene gradient-kaart + 🔥-emoji zijn weg;
   één wit vlak, `Flame`-icoon uit lucide, kaart veert met een zachte
   spring een stukje omhoog bij het laden. */
function StreakCard({ streak }: { streak: number }) {
  const active = streak > 0;
  const sub = active
    ? 'Keep your momentum going.'
    : 'Play your first session to start a streak.';
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(16)}
      style={s.streakCard}
    >
      <View style={s.streakRow}>
        <View style={s.streakIcon}>
          {active ? (
            <Flame size={22} color={ROYAL_INDIGO} strokeWidth={2.2} />
          ) : (
            <Sparkles size={22} color={ROYAL_INDIGO} strokeWidth={2.2} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.streakNumRow}>
            <CountUp value={streak} style={s.streakNum} />
            <Text style={s.streakSuffix}> day streak</Text>
          </View>
          <Text style={s.streakSub}>{sub}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

/* Operator, 15 september 2026 (Apple-upgrade): "smelt de drie losse
   zwarte vakken samen in één horizontaal wit oppervlak" — was drie
   aparte `statCard`s met eigen rand/achtergrond; nu één `statsRow`-vlak
   met interne verticale scheidingslijntjes. Labels in sentence case
   (niet ALL CAPS) op het Context Label-lettertype (11px Bold +1.5). */
function StatsRow({
  stats,
}: {
  stats: { uniqueUrls: number; totalMin: number; longestMin: number };
}) {
  return (
    <View style={s.statsRow}>
      <View style={s.statCard}>
        <CountUp value={stats.uniqueUrls} style={s.statValue} delay={60} />
        <Text style={s.statLabel}>Sessions</Text>
      </View>
      <View style={s.statDivider} />
      <View style={s.statCard}>
        <CountUp value={stats.totalMin} style={s.statValue} delay={120} />
        <Text style={s.statLabel}>Minutes</Text>
      </View>
      <View style={s.statDivider} />
      <View style={s.statCard}>
        <View style={s.statValueRow}>
          <CountUp value={stats.longestMin} style={s.statValue} delay={180} />
          <Text style={s.statValueSuffix}>m</Text>
        </View>
        <Text style={s.statLabel}>Longest</Text>
      </View>
    </View>
  );
}

function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.searchBar}>
      {/* Operator, 15 september 2026 (Apple-upgrade): "emoji's zijn
          verboden, maak hier een native SF Symbol-icoontje van" —
          `Search` uit lucide i.p.v. 🔍. */}
      <Search size={16} color={C.inputDim} strokeWidth={2} style={{ marginRight: 10 }} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search by title or series"
        placeholderTextColor={C.inputDim}
        style={s.searchInput}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

/* Operator, 15 september 2026 (Apple-upgrade): "stop de hele lijst met
   tracks van die dag in één doorlopend wit Bento-vlak, met flinterdunne
   native scheidingslijntjes (0.5px, #E5E5EA) ertussen" — elke rij is nu
   deel van dat vlak i.p.v. een eigen losse rij: alleen de EERSTE rij van
   een dag krijgt afgeronde bovenhoeken, alleen de LAATSTE afgeronde
   onderhoeken, en elke rij BEHALVE de eerste krijgt een haarlijn erboven. */
function EntryRow({
  entry,
  isFirst,
  isLast,
  onPlay,
}: {
  entry: HistoryEntry;
  isFirst: boolean;
  isLast: boolean;
  onPlay: () => void;
}) {
  const photo = SERIES_PHOTO[entry.series];
  /* Iter 9dq v115 (2026-06-04): EXACT dezelfde label-logica als de
     audio library free-view en player. Eén bron (formatListenedLabel),
     één icoon-set (▶ partly, ✓ fully).
     Operator, 15 september 2026: "Partly listened" verliest het felle
     Signal Blue hier — historische data, geen live-afspeelstatus (zie
     de toelichting bij `LIGHT.partial` bovenaan dit bestand). */
  const labelInfo = formatListenedLabel(entry);
  const stateIcon = labelInfo?.isFull ? '✓' : '▶';
  const stateColor = labelInfo?.isFull ? C.full : C.partial;
  const stateLabel =
    labelInfo?.text ?? (entry.full ? 'Fully listened' : 'Partly listened');

  /* Press-schaal voor de play-knop, zelfde recept als StartCard
     (breath-welcome.tsx): geen bounce bij indrukken, wel bij loslaten. */
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.9, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <View
      style={[
        s.entryRow,
        { backgroundColor: C.card },
        isFirst && s.entryRowFirst,
        isLast && s.entryRowLast,
        !isFirst && s.entryRowSep,
      ]}
    >
      <View style={s.thumbWrap}>
        {photo ? (
          <Image source={{ uri: photo }} style={s.thumb} />
        ) : (
          <View style={s.thumbFallback}>
            <Text style={s.thumbGlyph}>♪</Text>
          </View>
        )}
      </View>
      <View style={s.entryBody}>
        <Text style={s.entryTitle} numberOfLines={1}>
          {entry.title}
        </Text>
        <Text style={s.entrySeries} numberOfLines={1}>
          {entry.series}
        </Text>
        <View style={s.metaRow}>
          <Text style={[s.metaState, { color: stateColor }]}>
            {stateIcon} {stateLabel}
          </Text>
          {entry.dur > 0 ? (
            <>
              <View style={s.metaDot} />
              <Text style={s.metaMuted}>{fmtDur(entry.dur)}</Text>
            </>
          ) : null}
          <View style={s.metaDot} />
          <Text style={s.metaMuted}>{relTime(entry.ts)}</Text>
          {entry.fc > 1 ? (
            <>
              <View style={s.metaDot} />
              <Text style={s.metaReplay}>↻ {entry.fc}x</Text>
            </>
          ) : null}
        </View>
      </View>
      {/* Minimalistische, cirkelvormige Royal Indigo-knop met een klein
          wit driehoekje — was een grijze cirkel met wit driehoekje op de
          donkere achtergrond. */}
      <AnimatedPressable
        onPress={onPlay}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[s.playBtn, pressStyle]}
        hitSlop={10}
        android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true }}
      >
        <Play size={13} color="#ffffff" fill="#ffffff" strokeWidth={0} />
      </AnimatedPressable>
    </View>
  );
}

function PaginationFooter({
  olderCount,
  expanded,
  onExpand,
  onCollapse,
}: {
  olderCount: number;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  /* Press-schaal voor beide knoppen, zelfde recept als StartCard
     (breath-welcome.tsx): geen bounce bij indrukken, wel bij loslaten.
     Losse waarden, want "Show older" en "Collapse" kunnen tegelijk
     gerenderd staan. */
  const expandPressScale = useSharedValue(1);
  const onExpandPressIn = () => {
    expandPressScale.value = withTiming(0.96, { duration: 80 });
  };
  const onExpandPressOut = () => {
    expandPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const expandPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: expandPressScale.value }],
  }));

  const collapsePressScale = useSharedValue(1);
  const onCollapsePressIn = () => {
    collapsePressScale.value = withTiming(0.96, { duration: 80 });
  };
  const onCollapsePressOut = () => {
    collapsePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const collapsePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: collapsePressScale.value }],
  }));

  if (olderCount === 0 && !expanded) return null;
  return (
    <View style={s.paginationWrap}>
      {olderCount > 0 ? (
        <AnimatedPressable
          onPress={onExpand}
          onPressIn={onExpandPressIn}
          onPressOut={onExpandPressOut}
          style={[s.paginationBtn, expandPressStyle]}
        >
          <Text style={s.paginationText}>
            ↓ Show older sessions · {olderCount} more
          </Text>
        </AnimatedPressable>
      ) : null}
      {expanded ? (
        <AnimatedPressable
          onPress={onCollapse}
          onPressIn={onCollapsePressIn}
          onPressOut={onCollapsePressOut}
          style={[s.paginationBtn, collapsePressStyle]}
        >
          <Text style={s.paginationText}>↑ Collapse to recent</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyEmoji}>🎧</Text>
      <Text style={s.emptyTitle}>Your journey starts here</Text>
      <Text style={s.emptyP}>
        Play your first session and watch your transformation take shape —
        sessions, streaks, and progress will appear right here.
      </Text>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Topbar */
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  backChev: {
    color: ROYAL_INDIGO,
    fontSize: 26,
    lineHeight: 26,
    fontWeight: '600',
  },
  /* H2-sectiekop-rol: 22px Bold, -0.3 — was 16px/700, gecentreerd. */
  topbarTitle: {
    flex: 1,
    textAlign: 'left',
    marginLeft: 4,
    color: C.text,
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  menuBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDots: {
    color: C.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  menuPopover: {
    position: 'absolute',
    top: 56,
    right: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 160,
    zIndex: 10,
    ...SOFT_SHADOW,
  },
  menuItem: { paddingHorizontal: 14, paddingVertical: 10 },
  menuItemText: { color: C.text, fontSize: 14, fontWeight: '600' },

  /* Streak card — puur wit Bento-eiland (was blauw-groene gradient). */
  streakCard: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: C.card,
    ...SOFT_SHADOW,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  streakIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${ROYAL_INDIGO}12`,
  },
  streakNumRow: { flexDirection: 'row', alignItems: 'baseline' },
  /* H1-rol: 32px Bold, -0.4, Royal Indigo. */
  streakNum: {
    color: ROYAL_INDIGO,
    fontFamily: BrandFonts.bold,
    fontSize: 32,
    letterSpacing: -0.4,
    minWidth: 20,
  },
  streakSuffix: {
    color: ROYAL_INDIGO,
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
  },
  /* Subheader/muted-rol: 15px Regular, #8E8E93. */
  streakSub: {
    color: C.dim,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    marginTop: 2,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginBottom: 14,
    backgroundColor: C.card,
    borderRadius: 14,
    paddingVertical: 14,
    ...SOFT_SHADOW,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginVertical: 4,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  /* H1-variant: 32px Bold, -0.4, #1D1D1F. */
  statValue: {
    color: C.text,
    fontFamily: BrandFonts.bold,
    fontSize: 32,
    letterSpacing: -0.4,
    minWidth: 18,
    textAlign: 'center',
  },
  statValueSuffix: {
    color: C.dim,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    marginLeft: 2,
  },
  /* Context Label (Eyebrow)-rol: 11px Bold, +1.5 — sentence case, geen
     ALL CAPS ("Sessions", niet "SESSIONS"). */
  statLabel: {
    color: C.dim,
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 6,
  },

  /* Search — native-stijl, zachte grijze vlak i.p.v. donker/hard blok. */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.searchBg,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    padding: 0,
  },
  searchEmpty: { paddingHorizontal: 16, paddingVertical: 24 },
  searchEmptyText: { color: C.dim, fontSize: 13, textAlign: 'center' },

  /* Day label */
  /* Context Label (Eyebrow)-rol: 11px Bold, +1.5, #8E8E93. */
  dayLabel: {
    color: C.dim,
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 14,
  },

  /* Entry — deel van één doorlopend wit Bento-vlak per dag (zie
     `isFirst`/`isLast`/`entryRowSep` hieronder), niet langer een losse
     rij zonder achtergrond. */
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    ...SOFT_SHADOW,
  },
  entryRowFirst: { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  entryRowLast: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  /* Flinterdunne native scheidingslijn (0.5px) tussen tracks van dezelfde
     dag — vervangt de losse kaartranden. */
  entryRowSep: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  thumbWrap: { width: 48, height: 48 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  thumbFallback: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: C.searchBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbGlyph: { color: C.dim, fontSize: 20 },
  entryBody: { flex: 1, marginLeft: 0 },
  /* Prominent Body-rol: 16px Medium, #1D1D1F. */
  entryTitle: {
    color: C.text,
    fontFamily: BrandFonts.medium,
    fontSize: 16,
  },
  /* Subheader/muted-rol: 15px Regular, #8E8E93. */
  entrySeries: {
    color: C.dim,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  metaState: { fontSize: 11, fontFamily: BrandFonts.semibold },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.ghost,
  },
  metaMuted: { color: C.dim, fontSize: 11, fontFamily: BrandFonts.regular },
  metaReplay: { color: ROYAL_INDIGO, fontSize: 11, fontFamily: BrandFonts.semibold },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ROYAL_INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Pagination */
  paginationWrap: { marginTop: 18, alignItems: 'center' },
  paginationBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  paginationText: { color: C.dim, fontSize: 12, fontWeight: '600' },

  /* Empty */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 18 },
  emptyTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyP: {
    color: C.dim,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 280,
    textAlign: 'center',
  },
});
