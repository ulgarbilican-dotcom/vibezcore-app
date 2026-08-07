/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Breath history page

   Pushed-screen vanuit de Breath-tab ("Your Practice" link). Volgt
   hetzelfde routing-pattern als bracelet-history.

   Toont:
   - Hero stats: totale practice-tijd + sessie-count
   - Stats-strip: streak · completion rate · avg session
   - Per-pattern breakdown: aantal + totale tijd per protocol
   - Volledige chronologische lijst van sessies (incl. PARTIAL tag)
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { clearBreathHistory, type BreathHistoryEntry, useBreathHistory } from '@/utils/breath-history';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showVibezAlert } from '@/components/VibezAlert';

/* Naam en kleur per modus komen uit dezelfde bron als de keuzepagina en het
   sessiescherm. Hier stond een handgeschreven kopie "om geen cross-file dep
   te creëren", en die kopie liep uit de pas: ze droeg nog de kleuren van de
   bracelet (CLAUDE.md §5) en de oude namen, terwijl de ademsessies sinds
   1 augustus 2026 hun eigen palet hebben. Eén afhankelijkheid is goedkoper
   dan vijf regels die stilletjes verouderen. */
/* De vijf toestanden in de volgorde van de keuzepagina, zodat een kleur altijd
   op dezelfde hoogte in de stapel zit. */
const STATE_ORDER: BreathStateKey[] = [
  'boost',
  'focus',
  'calm',
  'clarity',
  'rest',
];

const PATTERN_INFO: Record<string, { name: string; color: string }> =
  Object.fromEntries(
    Object.values(BREATH_STATES).map((st) => [
      st.key,
      { name: st.eyebrow, color: st.accent },
    ]),
  );

/* ── De laatste zeven dagen ─────────────────────────────────────────────
   Van oud naar nieuw, met vandaag rechts. Berekend uit dezelfde historiek als
   de rest; niets extra opgeslagen. De hoogste dag bepaalt de schaal, dus de
   vorm klopt ook in een week van drie minuten. */
function buildWeek(history: BreathHistoryEntry[]) {
  const out: {
    label: string;
    min: number;
    frac: number;
    /** Elke toestand van die dag, met zijn eigen tijd. */
    segments: { key: string; color: string; sec: number }[];
    today: boolean;
  }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
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
      label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      min: Math.round(sec / 60),
      frac: 0,
      segments,
      today: i === 0,
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
function formatMMSS(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTotalTime(sec: number): { num: string; unit: string } {
  if (sec < 60) return { num: `${Math.round(sec)}`, unit: 'sec' };
  const totalMin = sec / 60;
  if (totalMin < 60) return { num: `${Math.round(totalMin)}`, unit: 'min' };
  const hours = totalMin / 60;
  return { num: hours.toFixed(1), unit: 'hours' };
}

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
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
    .sort((a, b) => b.count - a.count); /* meest gebruikt eerst */

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
  const totalTime = formatTotalTime(stats.totalSec);

  /* Sorted history (recent eerst) — useBreathHistory geeft vanaf
     nieuwste, maar we sorteren opnieuw om robuust te zijn tegen
     toekomstige schema changes. */
  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => b.ts - a.ts),
    [history],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Empty state ── */}
        {history.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>○</Text>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyBody}>
              Start any breathwork pattern. Every session — completed or partial — will appear here with full stats.
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => router.back()}
              android_ripple={{ color: 'rgba(0,0,0,0.10)' }}
            >
              <Text style={styles.emptyBtnTxt}>BACK TO BREATH</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Hero stat: total practice time ── */}
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>TOTAL PRACTICE</Text>
              <View style={styles.heroNumRow}>
                <Text style={styles.heroNum}>{totalTime.num}</Text>
                <Text style={styles.heroUnit}>{totalTime.unit}</Text>
              </View>
              <Text style={styles.heroSub}>
                {stats.totalSessions} session{stats.totalSessions === 1 ? '' : 's'} · {formatMMSS(stats.avgSessionSec)} avg
              </Text>
            </View>

            {/* ── Stats strip: 3 small cards ── */}
            <View style={styles.statsStrip}>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: '#FF9F0A' }]}>
                  {stats.streakDays}
                </Text>
                <Text style={styles.statLbl}>DAY STREAK</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: Brand.success }]}>
                  {stats.completionRate}%
                </Text>
                <Text style={styles.statLbl}>COMPLETED</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: Brand.accent }]}>
                  {formatMMSS(stats.avgSessionSec)}
                </Text>
                <Text style={styles.statLbl}>AVG SESSION</Text>
              </View>
            </View>

            {/* ── DE WEEK ────────────────────────────────────────────
                Zeven balkjes, één per dag, in de kleur van de toestand waar
                die dag het langst aan besteed is. Dit is wat er ontbrak: de
                cijfers erboven zeggen hoeveel je in totaal deed, maar niet
                hoe het verloopt. Een reeks van vier dagen en dan drie lege
                zie je hier in één oogopslag, en dat is precies de informatie
                waar iemand zijn gewoonte op bijstuurt.

                De hoogste dag bepaalt de schaal, dus de vorm klopt altijd —
                ook in een week van drie minuten. Lege dagen krijgen een
                streepje in plaats van niets: een gat hoort zichtbaar te zijn,
                anders lijkt de week korter dan hij was. */}
            {/* De kop noemt de eenheid. "LAST 7 DAYS" met een 1 erboven laat
                open of dat één minuut of één sessie is (operator, 7 augustus
                2026: "het is niet duidelijk wat die cijfers betekenen"). */}
            <Text style={styles.sectionLbl}>MINUTES PER DAY · LAST 7 DAYS</Text>
            <View style={styles.week}>
              {week7.map((d) => (
                <View key={d.label} style={styles.weekCol}>
                  <Text style={styles.weekMin}>{d.min > 0 ? d.min : ''}</Text>
                  {/* Het getal staat BOVEN de balk en het spoor eronder loopt
                      altijd door tot de volle hoogte. Zo zie je waartegen je
                      kijkt: een korte balk in een lang spoor is een korte dag,
                      en dat is af te lezen zonder de andere dagen erbij. */}
                  <View style={styles.weekBarBox}>
                    <View
                      style={[
                        styles.weekBar,
                        { height: d.min > 0 ? Math.max(3, d.frac * 76) : 0 },
                      ]}
                    >
                      {d.segments.map((seg) => (
                        <View
                          key={seg.key}
                          style={{
                            flexGrow: seg.sec,
                            flexBasis: 0,
                            backgroundColor: seg.color,
                          }}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={[styles.weekDay, d.today && styles.weekToday]}>
                    {d.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* ── Per-pattern breakdown ── */}
            <Text style={styles.sectionLbl}>BY PATTERN</Text>
            <View style={styles.patternList}>
              {stats.patternCounts.map((pc) => {
                const meta = PATTERN_INFO[pc.key];
                if (!meta) return null;
                const pctOfTotal = stats.totalSec > 0 ? (pc.totalSec / stats.totalSec) * 100 : 0;
                return (
                  <View key={pc.key} style={styles.patternRow}>
                    <View
                      style={[
                        styles.patternDot,
                        { backgroundColor: meta.color, shadowColor: meta.color },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.patternHead}>
                        <Text style={styles.patternName}>{meta.name}</Text>
                        <Text style={styles.patternCount}>
                          {pc.count} session{pc.count === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <View style={styles.patternBarTrack}>
                        <View
                          style={[
                            styles.patternBarFill,
                            { width: `${pctOfTotal}%`, backgroundColor: meta.color },
                          ]}
                        />
                      </View>
                      <Text style={styles.patternMeta}>
                        {formatMMSS(pc.totalSec)} total
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ── All sessions chronological ── */}
            <Text style={styles.sectionLbl}>ALL SESSIONS</Text>
            <View style={styles.sessionsList}>
              {sortedHistory.map((entry, i) => {
                const meta = PATTERN_INFO[entry.key] ?? { name: entry.name, color: Brand.text };
                const isCompleted = entry.completed !== false;
                return (
                  <View
                    key={`${entry.ts}-${i}`}
                    style={[
                      styles.sessionRow,
                      i === sortedHistory.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View
                      style={[
                        styles.sessionDot,
                        { backgroundColor: meta.color, shadowColor: meta.color },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.sessionHead}>
                        <Text style={styles.sessionName}>{entry.name}</Text>
                        {!isCompleted && (
                          <Text style={styles.sessionPartialTag}>PARTIAL</Text>
                        )}
                      </View>
                      <Text style={styles.sessionMeta}>
                        {formatRelativeTime(entry.ts)} · {entry.rounds} round{entry.rounds === 1 ? '' : 's'} · {formatMMSS(entry.durSec)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ── Clear history knop — destructive action, met dubbele
                bevestiging via Alert.alert om accidentele clear te
                voorkomen. Subtle styling onder de lijst zodat het geen
                primary action is. ── */}
            <Pressable
              onPress={() => {
                void showVibezAlert({
                  title: 'Clear practice history?',
                  message: `This will permanently delete all ${history.length} session${history.length === 1 ? '' : 's'} from Your Practice. This cannot be undone.`,
                  buttons: [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear all',
                      style: 'destructive',
                      onPress: () => { void clearBreathHistory(); },
                    },
                  ],
                });
              }}
              style={styles.clearBtn}
              android_ripple={{ color: 'rgba(239,68,68,0.10)' }}
            >
              <Text style={styles.clearBtnTxt}>CLEAR PRACTICE HISTORY</Text>
            </Pressable>

            <View style={{ height: 24 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },

  /* Clear history knop — subtle destructive action */
  clearBtn: {
    alignSelf: 'center',
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.32)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  clearBtnTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: '#ef4444',
  },

  /* Empty state */
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 56, color: Brand.accent, marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: BrandFonts.bold, fontSize: 22,
    color: Brand.text, marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontFamily: BrandFonts.regular, fontSize: 14,
    color: Brand.textDim, textAlign: 'center',
    lineHeight: 20, maxWidth: 300, marginBottom: 24,
  },
  emptyBtn: {
    paddingHorizontal: 28, paddingVertical: 13,
    backgroundColor: Brand.accent, borderRadius: 999,
  },
  emptyBtnTxt: {
    fontFamily: BrandFonts.bold, fontSize: 12,
    letterSpacing: 1.5, color: '#000',
  },

  /* Hero stat */
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: Brand.panel,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  heroEyebrow: {
    fontFamily: BrandFonts.bold, fontSize: 10,
    letterSpacing: 2, color: Brand.accent,
    marginBottom: 10,
  },
  heroNumRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 8,
    marginBottom: 6,
  },
  heroNum: {
    fontFamily: BrandFonts.black, fontSize: 56,
    color: Brand.text, letterSpacing: -1.5,
    lineHeight: 56,
  },
  heroUnit: {
    fontFamily: BrandFonts.semibold, fontSize: 18,
    color: Brand.textDim, letterSpacing: -0.3,
  },
  heroSub: {
    fontFamily: BrandFonts.medium, fontSize: 12.5,
    color: Brand.textDim, letterSpacing: 0.3,
  },

  /* Stats strip */
  statsStrip: {
    flexDirection: 'row', gap: 10, marginBottom: 24,
  },
  statCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1, borderColor: Brand.border,
    borderRadius: 12, alignItems: 'center',
  },
  statNum: {
    fontFamily: BrandFonts.black, fontSize: 22,
    letterSpacing: -0.5, marginBottom: 4,
    lineHeight: 24,
  },
  statLbl: {
    fontFamily: BrandFonts.bold, fontSize: 8.5,
    letterSpacing: 1.4, color: Brand.textDim,
  },

  /* Section labels */
  sectionLbl: {
    fontFamily: BrandFonts.bold, fontSize: 10,
    letterSpacing: 2, color: Brand.accent,
    marginBottom: 10, marginLeft: 2,
  },

  /* Per-pattern */
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    marginBottom: 22,
  },
  weekCol: { alignItems: 'center', flex: 1, gap: 4 },
  /* Hetzelfde spoor als op Activity: één taal voor dezelfde grafiek, anders
     lijken het twee metingen van twee verschillende dingen. */
  weekBarBox: {
    height: 76,
    width: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekBar: { width: '100%', borderRadius: 6, overflow: 'hidden' },
  weekMin: {
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    color: Brand.textDim,
    height: 12,
  },
  weekDay: {
    fontFamily: BrandFonts.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.34)',
  },
  weekToday: { color: Brand.text },

  patternList: {
    backgroundColor: Brand.panel,
    borderWidth: 1, borderColor: Brand.border,
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 6,
    marginBottom: 24,
  },
  patternRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  patternDot: {
    width: 10, height: 10, borderRadius: 5,
    marginTop: 4,
    shadowOpacity: 0.6, shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6, elevation: 3,
  },
  patternHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  patternName: {
    fontFamily: BrandFonts.semibold, fontSize: 14,
    color: Brand.text,
  },
  patternCount: {
    fontFamily: BrandFonts.bold, fontSize: 11,
    letterSpacing: 0.5, color: Brand.textDim,
  },
  patternBarTrack: {
    height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden', marginBottom: 5,
  },
  patternBarFill: { height: 4, borderRadius: 2 },
  patternMeta: {
    fontFamily: BrandFonts.regular, fontSize: 11,
    color: Brand.textDim, letterSpacing: 0.2,
  },

  /* Sessions list */
  sessionsList: {
    backgroundColor: Brand.panel,
    borderWidth: 1, borderColor: Brand.border,
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  sessionRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  sessionDot: {
    width: 10, height: 10, borderRadius: 5,
    marginTop: 4,
    shadowOpacity: 0.6, shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6, elevation: 3,
  },
  sessionHead: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 2,
  },
  sessionName: {
    fontFamily: BrandFonts.semibold, fontSize: 14,
    color: Brand.text,
  },
  sessionPartialTag: {
    fontFamily: BrandFonts.bold, fontSize: 8.5,
    letterSpacing: 1.2, color: '#FF9F0A',
    backgroundColor: 'rgba(255,159,10,0.12)',
    paddingHorizontal: 6, paddingVertical: 1.5,
    borderRadius: 4,
  },
  sessionMeta: {
    fontFamily: BrandFonts.regular, fontSize: 12,
    color: Brand.textDim, letterSpacing: 0.2,
  },
});
