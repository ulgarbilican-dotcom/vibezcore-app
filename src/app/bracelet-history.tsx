/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control session history

   Operator, 5 okt 2026 ("breathwork en State Control history gebruiken
   beide een andere layout en iconen?" — "is het belangrijk dat de
   gebruiker verschillende of dezelfde history-pagina's ziet?"): zelfde
   pagina als Your Practice, opgebouwd uit dezelfde gedeelde stukken
   (components/WeekSummaryCard + components/HistoryList): weekkaart, per
   toestand, alle sessies per dag, gewone rode wisknop. Eén product, één
   manier van terugkijken. De vroegere gekleurde streepjes per rij,
   bolletjes/balken per modus en de mijlpalen-strook zijn weg (te veel
   kleur, en Your Practice heeft ze niet).

   Bron-van-waarheid: `src/utils/bracelet-history.ts`. Geen netwerk — pure
   lokale opslag, reactief via useBraceletStats.
   ─────────────────────────────────────────────────────────────────── */

import { HeaderBackButton } from '@/components/HeaderBackButton';
import {
  ClearHistoryButton,
  HistoryDayHeader,
  HistoryEmpty,
  HistoryGroup,
  HistoryRow,
  HistorySectionLabel,
  stateName,
} from '@/components/HistoryList';
import { MODE_STATE_KEY } from '@/components/ModeGlyph';
import { showVibezAlert } from '@/components/VibezAlert';
import { WeekSummaryCard } from '@/components/WeekSummaryCard';
import { Brand } from '@/constants/theme';
import {
  clearHistory,
  getAllSessions,
  useBraceletStats,
  type SessionRecord,
} from '@/utils/bracelet-history';
import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BraceletMode } from '../services/ble-contract';

/* Force-refresh van de sessielijst telkens de stats wijzigen —
   useBraceletStats luistert al, dus dit volgt ook recordSession(). */
function useSessions(): SessionRecord[] {
  const [sessions, setSessions] = useState<SessionRecord[]>(getAllSessions);
  const stats = useBraceletStats();
  useEffect(() => {
    setSessions(getAllSessions());
  }, [stats.totalSessions, stats.totalMinutes]);
  return sessions;
}

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/* YYYY-MM-DD in lokale tijd — groepeersleutel. */
function getDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Today" / "Yesterday" / "Thu 15 Aug" — zelfde vorm als Your Practice. */
function dayLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - that.getTime()) / 864e5);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${wk} ${d.getDate()} ${months[d.getMonth()]}`;
}

type DayGroup = { key: string; label: string; minutes: number; sessions: SessionRecord[] };

function groupByDay(sessions: SessionRecord[]): DayGroup[] {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
  );
  const map = new Map<string, DayGroup>();
  for (const rec of sorted) {
    const d = new Date(rec.endedAt);
    const key = getDayKey(d);
    let g = map.get(key);
    if (!g) {
      g = { key, label: dayLabel(d), minutes: 0, sessions: [] };
      map.set(key, g);
    }
    g.minutes += rec.durationMin;
    g.sessions.push(rec);
  }
  return Array.from(map.values());
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export default function BraceletHistory() {
  const stats = useBraceletStats();
  const sessions = useSessions();
  const groups = useMemo(() => groupByDay(sessions), [sessions]);

  /* Per toestand: minuten + aantal sessies, meeste tijd eerst. */
  const byState = useMemo(() => {
    const map = new Map<number, { minutes: number; count: number }>();
    for (const r of sessions) {
      const prev = map.get(r.mode) ?? { minutes: 0, count: 0 };
      map.set(r.mode, { minutes: prev.minutes + r.durationMin, count: prev.count + 1 });
    }
    return Array.from(map.entries())
      .filter(([mode]) => MODE_STATE_KEY[mode as BraceletMode] !== undefined)
      .map(([mode, v]) => ({ mode: mode as BraceletMode, ...v }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [sessions]);

  const weekDays = stats.last7Days;
  const weekKeys = new Set(weekDays.map((d) => d.dayKey));
  const weekSessions = sessions.filter((r) => weekKeys.has(getDayKey(new Date(r.endedAt)))).length;

  /* Recente dagen open, oudere ingeklapt — zelfde regel als Your Practice. */
  const [openDays, setOpenDays] = useState<Set<string> | null>(null);
  const effectiveOpen = useMemo(
    () => openDays ?? new Set(groups.slice(0, 7).map((g) => g.key)),
    [openDays, groups],
  );
  const toggleDay = (key: string) => {
    const next = new Set(effectiveOpen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenDays(next);
  };

  const onClear = () => {
    void showVibezAlert({
      title: 'Clear history?',
      message: `This will permanently delete all ${plural(sessions.length, 'State Control session')} on this device. This cannot be undone.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
          },
        },
      ],
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Session history',
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <WeekSummaryCard
          days={weekDays.map((d) => ({ key: d.dayKey, letter: d.dayLabel.slice(0, 1), minutes: d.minutes, today: d.dayLabel === 'Today' }))}
          sessions={weekSessions}
          streak={stats.streak}
          allTimeMinutes={stats.totalMinutes}
        />

        {sessions.length === 0 ? (
          <HistoryEmpty
            title="No sessions yet"
            body="Start your first State Control session and it will appear here."
            cta="Back to State Control"
            onPress={() => router.back()}
          />
        ) : (
          <>
            <HistorySectionLabel>By state</HistorySectionLabel>
            <HistoryGroup>
              {byState.map((e, i) => {
                const key = MODE_STATE_KEY[e.mode];
                return (
                  <HistoryRow
                    key={e.mode}
                    first={i === 0}
                    stateKey={key}
                    title={stateName(key)}
                    sub={plural(e.count, 'session')}
                    value={`${e.minutes} min`}
                  />
                );
              })}
            </HistoryGroup>

            <HistorySectionLabel>All sessions</HistorySectionLabel>
            {groups.map((g) => {
              const open = effectiveOpen.has(g.key);
              return (
                <View key={g.key}>
                  <HistoryDayHeader
                    open={open}
                    label={g.label}
                    meta={`${plural(g.sessions.length, 'session')} · ${g.minutes} min`}
                    onPress={() => toggleDay(g.key)}
                  />
                  {open && (
                    <HistoryGroup>
                      {g.sessions.map((rec, i) => {
                        const key = MODE_STATE_KEY[rec.mode as BraceletMode];
                        return (
                          <HistoryRow
                            key={rec.id}
                            first={i === 0}
                            stateKey={key}
                            title={key ? stateName(key) : 'State Control'}
                            sub={formatHHMM(rec.startedAt)}
                            value={`${rec.durationMin} min`}
                            flag={rec.status === 'completed' ? null : 'Ended early'}
                          />
                        );
                      })}
                    </HistoryGroup>
                  )}
                </View>
              );
            })}

            <ClearHistoryButton label="Clear history" onPress={onClear} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
});
