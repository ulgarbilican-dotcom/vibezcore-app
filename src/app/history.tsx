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
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showVibezAlert } from '@/components/VibezAlert';

const C = {
  bg: '#000',
  text: '#fff',
  dim: 'rgba(255,255,255,0.55)',
  faint: 'rgba(255,255,255,0.4)',
  ghost: 'rgba(255,255,255,0.25)',
  card: 'rgba(255,255,255,0.04)',
  cardStrong: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  searchBg: 'rgba(255,255,255,0.05)',
  accent: '#3a8fff',
  /* Iter 9dq v113 (2026-06-04): amber → blauw (#3a8fff). Operator-feedback:
     "Partly listened" was hier geel terwijl audio library + player 'm blauw
     tonen. Nu één kleur door de hele app voor consistent state-signaling. */
  partial: '#3a8fff',
  full: '#4ade80',
  inputDim: 'rgba(255,255,255,0.4)',
};

const PAGE_DAYS = 30;
const MS_PER_DAY = 86400000;

type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'entry'; key: string; entry: HistoryEntry };

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

  /* Bouw flat list met header-rows tussen dag-groepen. */
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastLabel = '';
    visible.forEach((e, i) => {
      const label = dayLabel(e.ts);
      if (label !== lastLabel) {
        out.push({ kind: 'header', key: `h-${label}-${i}`, label });
        lastLabel = label;
      }
      out.push({ kind: 'entry', key: `e-${e.url}-${e.ts}-${i}`, entry: e });
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

      <View style={s.topbar}>
        <Pressable
          onPress={goBack}
          style={s.backBtn}
          hitSlop={14}
          android_ripple={{
            color: 'rgba(255,255,255,0.08)',
            borderless: true,
          }}
        >
          <Text style={s.backChev}>‹</Text>
          <Text style={s.backText}>Back</Text>
        </Pressable>
        <Text style={s.topbarTitle}>Your Journey</Text>
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
          <Pressable
            onPress={onClearHistory}
            style={s.menuItem}
            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
          >
            <Text style={s.menuItemText}>Clear history</Text>
          </Pressable>
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
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Text style={s.dayLabel}>{item.label.toUpperCase()}</Text>
            ) : (
              <EntryRow entry={item.entry} onPlay={() => playEntry(item.entry)} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function StreakCard({ streak }: { streak: number }) {
  const active = streak > 0;
  const sub = active
    ? 'Keep your momentum going.'
    : 'Play your first session to start a streak.';
  const inner = (
    <View style={s.streakRow}>
      <View style={s.streakIcon}>
        <Text style={s.streakIconGlyph}>{active ? '🔥' : '✨'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.streakNumRow}>
          <Text style={s.streakNum}>{streak}</Text>
          <Text style={s.streakSuffix}>
            {' '}
            {streak === 1 ? 'day streak' : 'day streak'}
          </Text>
        </View>
        <Text style={s.streakSub}>{sub}</Text>
      </View>
    </View>
  );

  if (!active) {
    return <View style={[s.streakCard, s.streakCardFlat]}>{inner}</View>;
  }
  return (
    <LinearGradient
      colors={[
        'rgba(58,143,255,0.10)',
        'rgba(58,143,255,0.04)',
        'rgba(74,222,128,0.06)',
      ]}
      locations={[0, 0.6, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.streakCard}
    >
      {inner}
    </LinearGradient>
  );
}

function StatsRow({
  stats,
}: {
  stats: { uniqueUrls: number; totalMin: number; longestMin: number };
}) {
  return (
    <View style={s.statsRow}>
      <View style={s.statCard}>
        <Text style={[s.statValue, { color: C.accent }]}>
          {stats.uniqueUrls}
        </Text>
        <Text style={s.statLabel}>SESSIONS</Text>
      </View>
      <View style={s.statCard}>
        <Text style={s.statValue}>{stats.totalMin}</Text>
        <Text style={s.statLabel}>MINUTES</Text>
      </View>
      <View style={s.statCard}>
        <View style={s.statValueRow}>
          <Text style={s.statValue}>{stats.longestMin}</Text>
          <Text style={s.statValueSuffix}>m</Text>
        </View>
        <Text style={s.statLabel}>LONGEST</Text>
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
      <Text style={s.searchIcon}>🔍</Text>
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

function EntryRow({
  entry,
  onPlay,
}: {
  entry: HistoryEntry;
  onPlay: () => void;
}) {
  const photo = SERIES_PHOTO[entry.series];
  /* Iter 9dq v115 (2026-06-04): EXACT dezelfde label-logica als de
     audio library free-view en player. Eén bron (formatListenedLabel),
     één icoon-set (▶ partly, ✓ fully), één kleur (blauw partly, groen
     fully). Was ◐ voor partly — operator-mandate "exact dezelfde
     logica van free toepassen". */
  const labelInfo = formatListenedLabel(entry);
  const stateIcon = labelInfo?.isFull ? '✓' : '▶';
  const stateColor = labelInfo?.isFull ? C.full : C.partial;
  const stateLabel =
    labelInfo?.text ?? (entry.full ? 'Fully listened' : 'Partly listened');

  return (
    <View style={s.entryRow}>
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
      <Pressable
        onPress={onPlay}
        style={s.playBtn}
        hitSlop={10}
        android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: true }}
      >
        <Text style={s.playGlyph}>▶</Text>
      </Pressable>
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
  if (olderCount === 0 && !expanded) return null;
  return (
    <View style={s.paginationWrap}>
      {olderCount > 0 ? (
        <Pressable onPress={onExpand} style={s.paginationBtn}>
          <Text style={s.paginationText}>
            ↓ Show older sessions · {olderCount} more
          </Text>
        </Pressable>
      ) : null}
      {expanded ? (
        <Pressable onPress={onCollapse} style={s.paginationBtn}>
          <Text style={s.paginationText}>↑ Collapse to recent</Text>
        </Pressable>
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
  backText: { color: C.text, fontSize: 16, fontWeight: '500' },
  topbarTitle: {
    flex: 1,
    textAlign: 'center',
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
  },
  menuBtn: {
    minWidth: 80,
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 6,
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
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 160,
    zIndex: 10,
  },
  menuItem: { paddingHorizontal: 14, paddingVertical: 10 },
  menuItemText: { color: C.text, fontSize: 14, fontWeight: '600' },

  /* Streak card */
  streakCard: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.22)',
  },
  streakCardFlat: {
    backgroundColor: C.card,
    borderColor: C.border,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  streakIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a8fff',
    shadowColor: '#3a8fff',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  streakIconGlyph: { fontSize: 22 },
  streakNumRow: { flexDirection: 'row', alignItems: 'baseline' },
  streakNum: {
    color: C.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  streakSuffix: {
    color: C.dim,
    fontSize: 13,
    fontWeight: '600',
  },
  streakSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    alignItems: 'center',
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  statValue: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
  },
  statValueSuffix: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 1,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
  },

  /* Search */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.searchBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    padding: 0,
  },
  searchEmpty: { paddingHorizontal: 16, paddingVertical: 24 },
  searchEmptyText: { color: C.dim, fontSize: 13, textAlign: 'center' },

  /* Day label */
  dayLabel: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.32,
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 14,
  },

  /* Entry */
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  thumbWrap: { width: 48, height: 48 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  thumbFallback: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: C.cardStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbGlyph: { color: C.dim, fontSize: 20 },
  entryBody: { flex: 1, marginLeft: 0 },
  entryTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  entrySeries: {
    color: C.dim,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  metaState: { fontSize: 11, fontWeight: '600' },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.ghost,
  },
  metaMuted: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  metaReplay: { color: C.accent, fontSize: 11, fontWeight: '600' },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { color: C.text, fontSize: 14, marginLeft: 2 },

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
