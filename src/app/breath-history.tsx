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

import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { clearBreathHistory, type BreathHistoryEntry, useBreathHistory } from '@/utils/breath-history';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { router, Stack } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showVibezAlert } from '@/components/VibezAlert';
import { WeekSummaryCard } from '@/components/WeekSummaryCard';
import VibezGlass from '@/components/VibezGlass';
import StateGlyph from '@/components/StateGlyph';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

/** "Calm Control", "Clarity & Relax" — de modusnaam in gewone schrijfwijze. */
function stateName(key: BreathStateKey): string {
  return BREATH_STATES[key].eyebrow
    .split(' ')
    .map((w) => (w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w))
    .join(' ');
}

/** Het ritme binnen de toestand (bv. "Box breathing"), als dat bewaard is. */
function techniqueName(entry: BreathHistoryEntry): string | null {
  if (!entry.techniqueKey) return null;
  const st = BREATH_STATES[entry.key as BreathStateKey];
  return st?.techniques.find((t) => t.key === entry.techniqueKey)?.name ?? null;
}

/* Toestand-icoon in een getinte glazen badge — hetzelfde teken als op de
   Breath-tab en in de plannen. De enige kleur in de lijsten. */
function StateBadge({ stateKey }: { stateKey: BreathStateKey }) {
  return (
    <View style={styles.badgeSlot}>
      <VibezGlass radius={10} tint={BREATH_STATES[stateKey].accent} level="raised" style={StyleSheet.absoluteFill} />
      <StateGlyph stateKey={stateKey} size={16} color="#ffffff" strokeWidth={1.9} />
    </View>
  );
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

/** Duur in mensentaal. "5:29" leest als een kloktijd en dwingt tot
 *  rekenen (operator, 8 augustus 2026); "5 min" is een feit. Onder de
 *  minuut zeggen we seconden, daarboven ronde minuten — de seconden erbij
 *  zijn schijnprecisie die niemand iets vertelt. */
function humanDur(sec: number): string {
  if (sec < 60) return `${Math.max(1, Math.round(sec))} sec`;
  return `${Math.round(sec / 60)} min`;
}

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

/* Dag-koprij, apart component (i.p.v. inline in de `.map()` hieronder) —
   hooks mogen niet in een loop. */
function DayHeadRow({
  label,
  metaText,
  accessibilityLabel,
  onPress,
  open,
}: {
  label: string;
  metaText: string;
  accessibilityLabel: string;
  onPress: () => void;
  open: boolean;
}) {
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
      style={[styles.dayHead, pressStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {open ? (
        <ChevronDown size={16} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
      ) : (
        <ChevronRight size={16} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
      )}
      <Text style={styles.dayHeadLbl}>{label}</Text>
      <Text style={styles.dayHeadMeta}>{metaText}</Text>
    </AnimatedPressable>
  );
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

  const emptyBtnPressScale = useSharedValue(1);
  const onEmptyBtnPressIn = () => {
    emptyBtnPressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onEmptyBtnPressOut = () => {
    emptyBtnPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const emptyBtnPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emptyBtnPressScale.value }],
  }));

  const clearBtnPressScale = useSharedValue(1);
  const onClearBtnPressIn = () => {
    clearBtnPressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onClearBtnPressOut = () => {
    clearBtnPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const clearBtnPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: clearBtnPressScale.value }],
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Operator, 1 okt 2026 ("kijk alles na op consistentie"): had
         helemaal geen eigen Stack.Screen, leunde volledig op de
         onaangepaste systeem-terugpijl uit _layout.tsx — nu dezelfde
         ChevronLeft-stijl (size 20, strokeWidth 2.8) als overal elders. */}
      <Stack.Screen
        options={{
          title: 'Your Practice',
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
        }}
      />
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
            <AnimatedPressable
              style={[styles.emptyBtn, emptyBtnPressStyle]}
              onPress={() => router.back()}
              onPressIn={onEmptyBtnPressIn}
              onPressOut={onEmptyBtnPressOut}
              android_ripple={{ color: 'rgba(0,0,0,0.10)' }}
            >
              <Text style={styles.emptyBtnTxt}>BACK TO BREATH</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <>
            {/* Operator, 5 okt 2026 ("Your Practice volledig herstructureren
                zoals Apple — te veel kleuren, moet superduidelijk"): ring,
                drie gekleurde tegels en de veelkleurige weekbalken zijn weg.
                Nu dezelfde opbouw als de State Control-geschiedenis: één
                weekkaart (één accentkleur), dan per toestand, dan alle
                sessies. Kleur zit enkel nog in de toestand-icoontjes. */}
            <WeekSummaryCard
              days={week7.map((d) => ({ key: d.dateKey, letter: d.label, minutes: d.sec / 60 }))}
              sessions={weekSessions}
              streak={stats.streakDays}
              allTimeMinutes={stats.totalSec / 60}
            />

            <Text style={styles.sectionLbl}>By state</Text>
            <View style={styles.group}>
              {stats.patternCounts.map((pc, i) => {
                const st = BREATH_STATES[pc.key as BreathStateKey];
                if (!st) return null;
                return (
                  <View
                    key={pc.key}
                    style={styles.groupRow}
                  >
                    {i > 0 && <View style={styles.sep} />}
                    <StateBadge stateKey={st.key} />
                    <View style={styles.groupRowMain}>
                      <Text style={styles.rowTitle}>{stateName(st.key)}</Text>
                      <Text style={styles.rowSub}>
                        {pc.count} session{pc.count === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Text style={styles.rowValue}>{humanDur(pc.totalSec)}</Text>
                  </View>
                );
              })}
            </View>

            {/* ── Alle sessies, per dag ── */}
            <Text style={styles.sectionLbl}>All sessions</Text>
            {dayGroups.map((group) => {
              const open = effectiveOpenDays.has(group.key);
              const totalSec = group.entries.reduce((sum, e) => sum + e.durSec, 0);
              return (
                <View key={group.key} style={styles.dayGroup}>
                  <DayHeadRow
                    open={open}
                    label={group.label}
                    metaText={`${group.entries.length} session${group.entries.length === 1 ? '' : 's'} · ${humanDur(totalSec)}`}
                    accessibilityLabel={`${group.label}, ${group.entries.length} session${group.entries.length === 1 ? '' : 's'}, ${open ? 'expanded' : 'collapsed'}`}
                    onPress={() => toggleDay(group.key)}
                  />

                  {open && (
                    <View style={styles.group}>
                      {group.entries.map((entry, i) => {
                        const st = BREATH_STATES[entry.key as BreathStateKey];
                        const isCompleted = entry.completed !== false;
                        return (
                          <View
                            key={`${entry.ts}-${i}`}
                            style={styles.groupRow}
                          >
                            {i > 0 && <View style={styles.sep} />}
                            {st ? <StateBadge stateKey={st.key} /> : <View style={styles.badgeSlot} />}
                            <View style={styles.groupRowMain}>
                              <Text style={styles.rowTitle} numberOfLines={1}>
                                {st ? stateName(st.key) : entry.name}
                              </Text>
                              <Text style={styles.rowSub} numberOfLines={1}>
                                {formatTime(entry.ts)}
                                {techniqueName(entry) ? ` · ${techniqueName(entry)}` : ''}
                              </Text>
                            </View>
                            <View style={styles.rowValueCol}>
                              <Text style={styles.rowValue}>{humanDur(entry.durSec)}</Text>
                              {!isCompleted && <Text style={styles.rowFlag}>Ended early</Text>}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

            {/* ── Clear history knop — destructive action, met dubbele
                bevestiging via Alert.alert om accidentele clear te
                voorkomen. Subtle styling onder de lijst zodat het geen
                primary action is. ── */}
            <AnimatedPressable
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
              onPressIn={onClearBtnPressIn}
              onPressOut={onClearBtnPressOut}
              style={[styles.clearBtn, clearBtnPressStyle]}
            >
              <Text style={styles.clearBtnTxt}>Clear practice history</Text>
            </AnimatedPressable>

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
  /* Operator, 5 okt 2026: gewone rode tekstknop zoals Apple's
     "Delete All Data" — geen rand of vlak. */
  clearBtn: {
    alignSelf: 'center',
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  clearBtnTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    color: '#ef4444',
  },

  /* Empty state */
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 56, color: AudioAccent, marginBottom: 16,
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
  /* v4.4 CTA-regel: donkere ondergrond -> witte knop, donkere tekst
     (geen Signal Blue, geen Royal Indigo op knoppen). */
  emptyBtn: {
    paddingHorizontal: 28, paddingVertical: 13,
    backgroundColor: '#ffffff', borderRadius: 999,
  },
  emptyBtnTxt: {
    fontFamily: BrandFonts.bold, fontSize: 12,
    letterSpacing: 1.5, color: '#0a0a0a',
  },

  /* Section labels — stil grijs, zoals de kaartkoppen op Activity. */
  sectionLbl: {
    fontFamily: BrandFonts.semibold, fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 26, marginBottom: 8, marginLeft: 4,
  },

  /* Gegroepeerde lijst (Apple inset-grouped): één paneel, rijen met een
     dunne scheidingslijn die bij de tekst begint, niet bij de rand. */
  group: {
    backgroundColor: Brand.panel,
    borderRadius: 14,
    paddingLeft: 14,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingRight: 14,
  },
  /* Scheidingslijn begint bij de tekst, niet bij de rand (zoals iOS). */
  sep: {
    position: 'absolute',
    top: 0,
    left: 44,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  groupRowMain: { flex: 1, minWidth: 0 },
  badgeSlot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontFamily: BrandFonts.semibold, fontSize: 15,
    color: Brand.text,
  },
  rowSub: {
    fontFamily: BrandFonts.regular, fontSize: 13,
    color: Brand.textDim, marginTop: 1,
  },
  rowValue: {
    fontFamily: BrandFonts.medium, fontSize: 15,
    color: Brand.textDim,
    fontVariant: ['tabular-nums'],
  },

  rowValueCol: { alignItems: 'flex-end' },
  rowFlag: {
    fontFamily: BrandFonts.regular, fontSize: 12,
    color: 'rgba(255,255,255,0.4)', marginTop: 1,
  },

  /* Dagkop boven elke dag */
  dayGroup: { marginBottom: 6 },
  dayHead: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingVertical: 10, paddingHorizontal: 4,
  },
  dayHeadLbl: {
    fontFamily: BrandFonts.semibold, fontSize: 14,
    color: Brand.text,
  },
  dayHeadMeta: {
    flex: 1,
    textAlign: 'right',
    fontFamily: BrandFonts.regular, fontSize: 13,
    color: Brand.textDim,
  },
});
