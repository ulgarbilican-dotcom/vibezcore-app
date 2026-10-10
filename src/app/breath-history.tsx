/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Your Practice (geschiedenis van de ademsessies)

   Operator, 5 okt 2026 ("volledig herstructureren zoals Apple — te veel
   kleuren, moet superduidelijk" + "breathwork en State Control history
   gebruiken een andere layout en iconen"): opgebouwd uit dezelfde gedeelde
   stukken als de State Control-geschiedenis (components/WeekSummaryCard +
   components/HistoryList): weekkaart, per toestand, alle sessies per dag.
   Kleur zit enkel nog in de toestand-icoontjes.
   ───────────────────────────────────────────────────────────────────────── */

import { daysOfThisWeek } from '@/utils/locale';
import { Brand } from '@/constants/theme';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { clearBreathHistory, type BreathHistoryEntry, useBreathHistory } from '@/utils/breath-history';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import {
  ClearHistoryButton,
  HistoryDayHeader,
  HistoryEmpty,
  HistoryGroup,
  HistoryRow,
  HistorySectionLabel,
  humanDur,
  stateName,
} from '@/components/HistoryList';
import { WeekSummaryCard } from '@/components/WeekSummaryCard';
import { showVibezAlert } from '@/components/VibezAlert';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STATE_ORDER: BreathStateKey[] = [
  'boost',
  'focus',
  'calm',
  'clarity',
  'rest',
];

/** Het ritme binnen de toestand (bv. "Box breathing"), als dat bewaard is. */
function techniqueName(entry: BreathHistoryEntry): string | null {
  if (!entry.techniqueKey) return null;
  const st = BREATH_STATES[entry.key as BreathStateKey];
  return st?.techniques.find((t) => t.key === entry.techniqueKey)?.name ?? null;
}

/* ── De laatste zeven dagen ─────────────────────────────────────────────
   Van oud naar nieuw, met vandaag rechts. Berekend uit dezelfde historiek als
   de rest; niets extra opgeslagen. De hoogste dag bepaalt de schaal, dus de
   vorm klopt ook in een week van drie minuten. */
function buildWeek(history: BreathHistoryEntry[]) {
  const out: {
    dateKey: string;
    label: string;
    min: number;
    sec: number;
    frac: number;
    /** Elke toestand van die dag, met zijn eigen tijd. */
    segments: { key: string; color: string; sec: number }[];
    today: boolean;
  }[] = [];
  /* Maandag → zondag van deze week (operator, 10 okt 2026). */
  const todayKey = new Date().toDateString();
  for (const d of daysOfThisWeek()) {
    const key = d.toDateString();
    const mine = history.filter((e) => new Date(e.ts).toDateString() === key);
    const sec = mine.reduce((a, e) => a + e.durSec, 0);
    const byKey: Record<string, number> = {};
    for (const e of mine) byKey[e.key] = (byKey[e.key] ?? 0) + e.durSec;
    /* ALLE toestanden van die dag, in de vaste volgorde van de vijf. De balk
       kleurde naar de toestand die het langst duurde en liet de rest weg; op
       een dag met twee sessies is dat onwaar (operator, 8 augustus 2026). */
    const segments = STATE_ORDER.map((k) => ({
      key: k,
      color: BREATH_STATES[k].accent,
      sec: byKey[k] ?? 0,
    })).filter((x) => x.sec > 0);
    out.push({
      /* Operator, 9 september 2026: "Encountered two children with the
         same key" — de dagletter ('S', 'T'...) is geen unieke React-key
         over een week (zondag én zaterdag zijn allebei 'S'). `key`
         hierboven is al de echte, per-dag-unieke `toDateString()` —
         gewoon meegeven i.p.v. de letter opnieuw te gebruiken als key. */
      dateKey: key,
      label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      min: Math.round(sec / 60),
      sec,
      frac: 0,
      segments,
      today: key === todayKey,
    });
  }
  /* De schaal begint bij tien minuten en niet bij je hoogste dag.
     Deelde je door de hoogste dag, dan stond één minuut als een VOLLE balk —
     precies zo hoog als een week waarin je een uur ademde (operator,
     7 augustus 2026: "de balken staan weer vol kleur met maar 1 min").
     Zo'n grafiek liegt: hij toont verhouding binnen de week en leest als
     hoeveelheid. Met een vaste ondergrens klopt de hoogte met wat er staat,
     en groeit hij pas mee zodra je er echt overheen gaat. */
  const max = Math.max(10, ...out.map((o) => o.min));
  for (const o of out) o.frac = o.min / max;
  return out;
}

/* ── Formatters ──────────────────────────────────────────────────── */

/** YYYY-MM-DD in lokale tijd — groepeersleutel voor de dag-secties
 *  hieronder. Zelfde vorm als bracelet-history.ts se dayKey, hier lokaal
 *  gehouden om geen cross-domain dependency toe te voegen voor iets
 *  triviaals. */
function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Today" / "Yesterday" / "Thu 15 Aug" — voor een hele DAG, geen tijdstip.
 *  Gedeeld door de sectiekoppen hieronder en (met tijd erbij) door losse
 *  rijen elders. */
function dayLabel(ts: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(ts);
  that.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - that.getTime()) / 864e5);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const d = new Date(ts);
  const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${wk} ${d.getDate()} ${months[d.getMonth()]}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ── Stats berekeningen ──────────────────────────────────────────── */
type StatsResult = {
  totalSec: number;
  totalSessions: number;
  completionRate: number;       /* 0-100 */
  streakDays: number;
  avgSessionSec: number;
  patternCounts: { key: string; count: number; totalSec: number }[];
};

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function shiftDayKey(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function computeStats(history: BreathHistoryEntry[]): StatsResult {
  if (history.length === 0) {
    return {
      totalSec: 0,
      totalSessions: 0,
      completionRate: 0,
      streakDays: 0,
      avgSessionSec: 0,
      patternCounts: [],
    };
  }

  const totalSec = history.reduce((sum, e) => sum + e.durSec, 0);
  const completedCount = history.filter((e) => e.completed !== false).length;
  const completionRate = Math.round((completedCount / history.length) * 100);
  const avgSessionSec = totalSec / history.length;

  /* Streak: aaneengesloten dagen vanaf vandaag met minstens 1 sessie. */
  const daysWithSession = new Set<string>();
  for (const e of history) daysWithSession.add(dayKey(e.ts));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (daysWithSession.has(shiftDayKey(i))) streak++;
    else break;
  }

  /* Per-pattern aggregate */
  const byKey = new Map<string, { count: number; totalSec: number }>();
  for (const e of history) {
    const prev = byKey.get(e.key) ?? { count: 0, totalSec: 0 };
    byKey.set(e.key, {
      count: prev.count + 1,
      totalSec: prev.totalSec + e.durSec,
    });
  }
  const patternCounts = Array.from(byKey.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.totalSec - a.totalSec); /* meeste tijd eerst */

  return {
    totalSec,
    totalSessions: history.length,
    completionRate,
    streakDays: streak,
    avgSessionSec,
    patternCounts,
  };
}

/* ════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════ */
export default function BreathHistoryScreen() {
  const history = useBreathHistory();
  const week7 = useMemo(() => buildWeek(history), [history]);
  const stats = useMemo(() => computeStats(history), [history]);
  const weekSessions = useMemo(() => {
    const keys = new Set(week7.map((d) => d.dateKey));
    return history.filter((e) => keys.has(new Date(e.ts).toDateString())).length;
  }, [history, week7]);

  /* Sorted history (recent eerst) — useBreathHistory geeft vanaf
     nieuwste, maar we sorteren opnieuw om robuust te zijn tegen
     toekomstige schema changes. */
  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => b.ts - a.ts),
    [history],
  );

  /* Per dag gegroepeerd i.p.v. één platte lijst (operator, 13 augustus
     2026: "de rij wordt heel lang... kan dat per dag via een dropdown?").
     Elke rij droeg tot nu toe zijn eigen volledige datum, en dat herhaalde
     zich bij elke sessie van dezelfde dag. Nu draagt de DAGKOP de datum,
     eenmalig, en blijft een rij zelf tot tijd + naam + duur beperkt. */
  const dayGroups = useMemo(() => {
    const groups: { key: string; label: string; entries: BreathHistoryEntry[] }[] = [];
    for (const entry of sortedHistory) {
      const key = localDayKey(entry.ts);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.entries.push(entry);
      } else {
        groups.push({ key, label: dayLabel(entry.ts), entries: [entry] });
      }
    }
    return groups;
  }, [sortedHistory]);

  /* Recente dagen staan open, oudere zijn ingeklapt — zoals een bank-app of
     Strava dat doet: de laatste week is waar je meestal naar kijkt, wat
     daarvoor ligt is een tik verder. Meerdere dagen mogen tegelijk open
     staan (geen single-open-accordion) — dat is een onnodige beperking
     zodra je twee dagen wil vergelijken. */
  const [openDays, setOpenDays] = useState<Set<string> | null>(null);
  const effectiveOpenDays = useMemo(
    () => openDays ?? new Set(dayGroups.slice(0, 7).map((g) => g.key)),
    [openDays, dayGroups],
  );
  const toggleDay = (key: string) => {
    const next = new Set(effectiveOpenDays);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenDays(next);
  };

  const onClear = () => {
    void showVibezAlert({
      title: 'Clear practice history?',
      message: `This will permanently delete all ${history.length} session${history.length === 1 ? '' : 's'} from Your Practice. This cannot be undone.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: () => {
            void clearBreathHistory();
          },
        },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Your Practice',
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <WeekSummaryCard
          days={week7.map((d) => ({ key: d.dateKey, letter: d.label, minutes: d.sec / 60, today: d.today }))}
          sessions={weekSessions}
          streak={stats.streakDays}
          allTimeMinutes={stats.totalSec / 60}
        />

        {history.length === 0 ? (
          <HistoryEmpty
            title="No sessions yet"
            body="Start a breathing session and it will appear here."
            cta="Back to Breath"
            onPress={() => router.back()}
          />
        ) : (
          <>
            <HistorySectionLabel>By state</HistorySectionLabel>
            <HistoryGroup>
              {stats.patternCounts
                .filter((pc) => BREATH_STATES[pc.key as BreathStateKey])
                .map((pc, i) => (
                  <HistoryRow
                    key={pc.key}
                    first={i === 0}
                    stateKey={pc.key as BreathStateKey}
                    title={stateName(pc.key as BreathStateKey)}
                    sub={`${pc.count} session${pc.count === 1 ? '' : 's'}`}
                    value={humanDur(pc.totalSec)}
                  />
                ))}
            </HistoryGroup>

            <HistorySectionLabel>All sessions</HistorySectionLabel>
            {dayGroups.map((group) => {
              const open = effectiveOpenDays.has(group.key);
              const totalSec = group.entries.reduce((sum, e) => sum + e.durSec, 0);
              return (
                <View key={group.key}>
                  <HistoryDayHeader
                    open={open}
                    label={group.label}
                    meta={`${group.entries.length} session${group.entries.length === 1 ? '' : 's'} · ${humanDur(totalSec)}`}
                    onPress={() => toggleDay(group.key)}
                  />
                  {open && (
                    <HistoryGroup>
                      {group.entries.map((entry, i) => {
                        const known = BREATH_STATES[entry.key as BreathStateKey] ? (entry.key as BreathStateKey) : undefined;
                        const tech = techniqueName(entry);
                        return (
                          <HistoryRow
                            key={`${entry.ts}-${i}`}
                            first={i === 0}
                            stateKey={known}
                            title={known ? stateName(known) : entry.name}
                            sub={tech ? `${formatTime(entry.ts)} · ${tech}` : formatTime(entry.ts)}
                            value={humanDur(entry.durSec)}
                            flag={entry.completed === false ? 'Ended early' : null}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
});
