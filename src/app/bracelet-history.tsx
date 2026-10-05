/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet session history

   Toont de complete sessie-geschiedenis met top-stats (today / week / total)
   en een chronologische lijst (recent eerst). Bron-van-waarheid:
   `src/utils/bracelet-history.ts`. Geen netwerk — pure lokale storage,
   reactief via useBraceletStats hook.

   UX-conventies:
     - Header: stat-tegels (today sessies/min, week min, total min, streak)
     - Lijst per record: mode-dot + naam, datum, duur, completed/stopped
     - Empty state: nette uitnodiging tot eerste sessie
     - Footer: "Clear history" knop met confirmation (destructive)

   Push-route vanaf bracelet-control idle-screen — registered in
   src/app/_layout.tsx als losse Stack.Screen.
   ─────────────────────────────────────────────────────────────────── */

import { WeekSummaryCard } from '@/components/WeekSummaryCard';
import { PreviewBanner } from '@/components/PreviewBanner';
import { Brand, BrandFonts, AudioAccent, AudioAccentLight } from '@/constants/theme';
import {
  clearHistory,
  getAllSessions,
  useBraceletStats,
  type BraceletStats,
  type SessionRecord,
} from '@/utils/bracelet-history';
import { Stack, router } from 'expo-router';
import {
  ChevronLeft,
  Compass,
  Crown,
  Flame,
  Medal,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showVibezAlert } from '@/components/VibezAlert';
import { BraceletMode, MODES, getModeMeta } from '../services/ble-contract';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

/* Standaardiseerde press-scale (2026-09-23, operator: pas dit toe op elke
   tappable card/CTA/icon-knop app-breed). Zelfde curve als StartCard in
   breath-welcome.tsx: snappy press-in, kritisch-gedempte spring terug. */
const AnimatedPressable = ReanimatedAnimated.createAnimatedComponent(Pressable);
function usePressScale(scaleTo: number) {
  const scale = useSharedValue(1);
  const onPressIn = () => {
    scale.value = withTiming(scaleTo, { duration: 80 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return { onPressIn, onPressOut, pressStyle };
}

/* Force-refresh van de session-list elke keer de hook-stats wijzigen.
   useBraceletStats subscribed via listener-set, dus dit triggert ook
   bij recordSession() vanuit bracelet-control. */
function useSessions(): SessionRecord[] {
  const [sessions, setSessions] = useState<SessionRecord[]>(getAllSessions);
  /* Hergebruik stats-hook om listener-set te re-subscriben — als stats
     vernieuwen weten we dat de cache vernieuwd is, dus list ook. */
  const stats = useBraceletStats();
  useEffect(() => {
    setSessions(getAllSessions());
  }, [stats.totalSessions, stats.totalMinutes]);
  return sessions;
}

/* Mooi datum-label per record. "Today 14:32" / "Yesterday 09:15" /
   "Mon May 25 · 18:00". Geen lib nodig (geen i18n complexity hier). */
function formatRecordTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  if (sameDay) return `Today · ${hh}:${mm}`;
  if (isYesterday) return `Yesterday · ${hh}:${mm}`;
  /* Anders: "Mon · May 25 · 18:00" — short format */
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} · ${date} · ${hh}:${mm}`;
}

/* Compact tijd-only (HH:MM) — voor session-rows binnen een day-group
   waar de datum al uit de group-header blijkt. */
function formatHHMM(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/* Day-key voor groepering (YYYY-MM-DD in lokale tijd). */
function getDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* Day-label voor group-header. "Today" / "Yesterday" / "Mon · May 25". */
function getDayLabel(d: Date, now: Date): string {
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} · ${date}`;
}

/* Groepeer sessies per dag, gesorteerd newest first. Per group totalen
   (sessies + minuten) berekend voor de header. */
type DayGroup = {
  key: string;
  label: string;
  totalSessions: number;
  totalMinutes: number;
  sessions: SessionRecord[];
};

function groupByDay(sessions: SessionRecord[]): DayGroup[] {
  const now = new Date();
  /* Sort newest first */
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
  );
  const map = new Map<string, DayGroup>();
  for (const rec of sorted) {
    const d = new Date(rec.endedAt);
    const key = getDayKey(d);
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: getDayLabel(d, now),
        totalSessions: 0,
        totalMinutes: 0,
        sessions: [],
      });
    }
    const g = map.get(key)!;
    g.totalSessions += 1;
    g.totalMinutes += rec.durationMin;
    g.sessions.push(rec);
  }
  return Array.from(map.values());
}

function SessionRow({ rec }: { rec: SessionRecord }) {
  const meta = getModeMeta(rec.mode as BraceletMode);
  /* Iter 9ca (2026-05-31): redesigned row met mode-color verticale
     accent-strip links, plan-completion % en breathwork-tag (indien
     gebruikt). Strakker, premium-er gevoel. */
  const completionPct = rec.plannedMin > 0
    ? Math.min(100, Math.round((rec.durationMin / rec.plannedMin) * 100))
    : 100;
  const isCompleted = rec.status === 'completed';
  return (
    <View style={s.row}>
      {/* Verticale mode-color strip links */}
      <View
        style={[s.rowAccentBar, { backgroundColor: meta.color }]}
      />
      <View style={s.rowMain}>
        <View style={s.rowTopLine}>
          <Text style={s.rowMode} numberOfLines={1}>
            {meta.name}
          </Text>
          <Text style={s.rowDuration}>{rec.durationMin} min</Text>
        </View>
        <View style={s.rowBottomLine}>
          <Text style={s.rowMeta}>
            {formatHHMM(rec.startedAt)}
            {rec.plannedMin > 0 && (
              <Text style={s.rowMetaDim}>
                {' · '}
                {completionPct}%
              </Text>
            )}
          </Text>
          <Text
            style={[
              s.rowStatus,
              isCompleted
                ? { color: Brand.success }
                : { color: Brand.textDim },
            ]}
          >
            {isCompleted ? '✓ Completed' : 'Stopped early'}
          </Text>
        </View>
        {/* Breathwork tag — alleen als deze sessie er een had */}
        {rec.breathwork && rec.breathwork.cyclesCompleted > 0 && (
          <View style={s.rowBreathTag}>
            <Text style={s.rowBreathDot}>·</Text>
            <Text style={s.rowBreathText} numberOfLines={1}>
              {rec.breathwork.name} · {rec.breathwork.cyclesCompleted}
              {rec.breathwork.cyclesTarget > 0 && rec.breathwork.cyclesCompleted < rec.breathwork.cyclesTarget
                ? `/${rec.breathwork.cyclesTarget}`
                : ''}{' '}
              cycles
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ── WeekSummary — één kaart bovenaan (operator, 5 okt 2026) ─────────
   "Ik begrijp de statistieken niet, today helemaal vol wit en 35
   bovenaan, rommelig — hoe pakt Apple dat aan?" Zoals Apple Fitness /
   Mindfulness: één samenvatting (week-minuten groot, sessies en reeks
   klein eronder — elk getal één keer), daaronder een grafiek met een
   VASTE, ronde schaal en hulplijnen, zodat een staaf toont hoeveel je
   echt deed i.p.v. hoe je dag zich verhoudt tot je beste dag (één dag
   met sessies was voorheen altijd 100% vol). Vervangt de losse tegels
   Today / Day streak / Min total en de oude 7-dagengrafiek. */
/* Operator, 5 okt 2026: de kaart zelf is gedeeld met Your Practice
   (components/WeekSummaryCard) zodat beide geschiedenissen één taal
   spreken. */
function WeekSummary({ stats, sessions }: { stats: BraceletStats; sessions: SessionRecord[] }) {
  const days = stats.last7Days;
  const weekKeys = new Set(days.map((d) => d.dayKey));
  const weekSessions = sessions.filter((r) => weekKeys.has(getDayKey(new Date(r.endedAt)))).length;
  return (
    <WeekSummaryCard
      days={days.map((d) => ({ key: d.dayKey, letter: d.dayLabel.slice(0, 1), minutes: d.minutes }))}
      sessions={weekSessions}
      streak={stats.streak}
      allTimeMinutes={stats.totalMinutes}
    />
  );
}

/* ── Mode breakdown ─────────────────────────────────────────────────
   Toont per gebruikte mode hoeveel minuten + % van totaal. Alleen
   modes die ≥1 minuut hebben verschijnen, gesorteerd op meeste-eerst. */
function ModeBreakdown({ stats }: { stats: BraceletStats }) {
  const entries = Object.entries(stats.minutesByMode)
    .map(([modeStr, minutes]) => {
      const mode = Number(modeStr) as BraceletMode;
      return { mode, meta: getModeMeta(mode), minutes };
    })
    .filter((e) => e.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, e) => sum + e.minutes, 0);
  /* Iter 9ce (2026-05-31): percentages alleen tonen als er VERGELIJKING
     mogelijk is (2+ modes). Bij 1 mode = altijd 100% = verwarrend voor
     gebruiker ("100% van wat?"). Toon dan alleen absoluut minuten. */
  const showPct = entries.length > 1;
  return (
    <View style={s.chartCard}>
      <View style={s.chartHeader}>
        <Text style={s.chartTitle}>By mode (all time)</Text>
        <Text style={s.chartTotal}>{entries.length} of 5 used</Text>
      </View>
      <View style={s.breakdownList}>
        {entries.map((e) => {
          const pct = Math.round((e.minutes / total) * 100);
          /* Bar fill: bij 1 mode altijd 100% width (er is niets om
             tegen te vergelijken), bij meerdere modes = relatief. */
          const barWidthPct = showPct ? pct : 100;
          return (
            <View key={e.mode} style={s.breakdownRow}>
              <View style={s.breakdownLeft}>
                <View
                  style={[s.breakdownDot, { backgroundColor: e.meta.color }]}
                />
                <Text style={s.breakdownLabel} numberOfLines={1}>
                  {e.meta.name}
                </Text>
              </View>
              <View style={s.breakdownBarTrack}>
                <View
                  style={[
                    s.breakdownBarFill,
                    {
                      width: `${barWidthPct}%`,
                      backgroundColor: e.meta.color,
                    },
                  ]}
                />
              </View>
              <Text style={s.breakdownValue}>
                {e.minutes}m
                {showPct && (
                  <Text style={s.breakdownValueDim}>  {pct}%</Text>
                )}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* Iter 9dq (2026-06-02): elke breathwork-protocol hoort 1:1 bij een
   bracelet-mode (zie BREATH_PROTOCOLS in bracelet-control.tsx). We
   gebruiken de mode-kleur voor de bar/dot zodat de Breathwork-card
   visueel parallel loopt met de "By mode" sectie — dezelfde sessie
   krijgt overal dezelfde kleur. Verwijdert de eerdere standaard-blauw
   die met Calm Control's kleur conflicteerde. Lookup gaat via protocol-
   naam zodat 'Energizing' en 'Coherent' (beide kind='simple') netjes
   gescheiden blijven. Fallback Brand.accent voor onbekende protocols. */
/* Operator, 28 september 2026 ("alle breathwork moet kloppen" — audit na
   fouten op de website): deze keys stonden op de OUDE protocol-namen —
   `r.breathwork.name` (bracelet-history.ts) slaat de ECHTE, huidige naam
   uit `BREATH_PROTOCOLS` (bracelet-control.tsx) op, dus 4 van de 5 keys
   matchten al niet meer (vielen stil terug op Brand.accent/geen label).
   Erger: de oude 'Box breath'-key MATCHTE toevallig nog wel, maar wees
   naar Delta (Sleep) — terwijl 'Box breath' nu Alpha's (Calm Control's)
   naam is, dus een echte Calm-sessie kreeg Sleep's kleur/label. */
const PROTOCOL_NAME_TO_MODE: Record<string, BraceletMode> = {
  Boost: BraceletMode.Gamma, // Boost → wit
  'Coherent breath': BraceletMode.Beta, // Sharp Focus → oranje
  'Box breath': BraceletMode.Alpha, // Calm Control → blauw
  'Long exhale': BraceletMode.Theta, // Clarity & Relax → paars
  '4-7-8': BraceletMode.Delta, // Sleep → sage
};

function getProtocolColor(protocolName: string): string {
  const mode = PROTOCOL_NAME_TO_MODE[protocolName];
  if (mode !== undefined) return MODES[mode].color;
  return Brand.accent;
}

/* Iter 9dq v7 (2026-06-02): mode-naam ophalen per protocol, voor inline
   context-label in de Breathwork-row. Maakt de relatie protocol→mode
   ("Energizing · for Boost") zichtbaar zonder een extra UI-laag. */
function getProtocolModeName(protocolName: string): string | null {
  const mode = PROTOCOL_NAME_TO_MODE[protocolName];
  if (mode !== undefined) return MODES[mode].name;
  return null;
}

/* ── Breathwork breakdown ──────────────────────────────────────────
   Toont per gebruikt breath-protocol: minuten + # sessies.
   Iter 9dl → 9dm (2026-05-31):
   - "Breath protocols" → "Breathwork" (vriendelijker, geen jargon)
   - Schaal in MINUTEN ipv cycles (cycles is technische term, minuten
     is universeel)
   - MIN_SCALE 15 + MIN_VISIBLE_PCT 15% → 1-min sessie toont niet
     meer als volle bar
   - Cycles staan nog in de subline (kleine info-laag) maar niet meer
     als primaire metric
   Iter 9dq (2026-06-02): bar/dot-kleur per protocol matcht z'n mode
   (Energizing=wit, Triangle=oranje, Coherent=blauw, Nadi=paars, Box=sage)
   ipv één standaard accent-blauw — voorkomt verwarring met Calm Control's
   mode-kleur. */
function BreathBreakdown({ stats }: { stats: BraceletStats }) {
  const entries = Object.entries(stats.breathByProtocol)
    .map(([key, data]) => ({
      key,
      name: data.name,
      cycles: data.cycles,
      durationSec: data.durationSec,
      sessions: data.sessions,
      minutes: Math.max(1, Math.round(data.durationSec / 60)),
    }))
    .filter((e) => e.durationSec > 0)
    .sort((a, b) => b.minutes - a.minutes);
  /* Iter 9dq v7: empty state ipv card verbergen. Maakt feature
     ontdekbaar voor first-time users die nog geen sessie hebben gedaan. */
  const isEmpty = entries.length === 0;
  const MIN_SCALE = 15;
  const MIN_VISIBLE_PCT = 15;
  const maxMinutes = Math.max(
    MIN_SCALE,
    ...entries.map((e) => e.minutes),
  );
  return (
    <View style={s.chartCard}>
      <View style={s.chartHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.chartTitle}>Breathwork</Text>
          {/* Iter 9dq v7: subtitle die uitlegt wat dit is, voorkomt
              "wat is breathwork?"-momentje. */}
          <Text style={s.chartSubtitle}>Per-mode breathing rhythm</Text>
        </View>
        <Text style={s.chartTotal}>
          {stats.totalBreathMinutes} min total
        </Text>
      </View>
      {isEmpty ? (
        <Text style={s.breathEmptyText}>
          Complete your first session to see your breathing pattern
          appear here.
        </Text>
      ) : (
        <View style={s.breakdownList}>
          {entries.map((e) => {
            const rawPct = (e.minutes / maxMinutes) * 100;
            const pct = Math.max(MIN_VISIBLE_PCT, rawPct);
            /* Iter 9dq: per-protocol mode-kleur ipv één standaard accent. */
            const color = getProtocolColor(e.name);
            /* Iter 9dq v7: mode-naam voor inline context-label. */
            const modeName = getProtocolModeName(e.name);
            return (
              <View key={e.key} style={s.breakdownRow}>
                <View style={s.breakdownLeft}>
                  <View
                    style={[
                      s.breakdownDot,
                      { backgroundColor: color },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.breakdownLabel} numberOfLines={1}>
                      {e.name}
                    </Text>
                    {modeName ? (
                      <Text style={s.breakdownLabelSub} numberOfLines={1}>
                        for {modeName}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={s.breakdownBarTrack}>
                  <View
                    style={[
                      s.breakdownBarFill,
                      { width: `${pct}%`, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={s.breakdownValue}>
                  {e.minutes}m
                  <Text style={s.breakdownValueDim}>
                    {' '}
                    · {e.cycles} cycles
                  </Text>
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ── Milestones ─────────────────────────────────────────────────────
   Hardcoded set van achievement-mijlpalen. Toont unlocked vs locked.
   Geeft engagement-laag aan de history-pagina ("dit unlock je nog").
   Iter 9dq (2026-06-02): icon + progress toegevoegd aan elke milestone.
   Iter 9dq v3 (2026-06-02): emoji → Lucide SVG icons. Premium monochroom
   look zoals Linear/Vercel/Apple Activity. Geen cartoon-emoji's meer,
   pure scherpe SVG die de Brand-accent kleur overneemt. */
type Milestone = {
  id: string;
  label: string;
  /** Lucide-icon component — gerendered als SVG met kleur via prop.
   *  Voordeel boven emoji: scherp op elke resolutie, monochroom (matcht
   *  brand), cross-platform identiek (iOS = Android = web). */
  Icon: LucideIcon;
  /** Aantal keer dat het icon naast elkaar wordt gerendered. Default 1.
   *  Iter 9dq v4 (2026-06-02): voor escalating-flame ladder (30m=1, 1h=2,
   *  3-day=3) zodat visuele intensiteit oploopt met de prestatie. */
  iconCount?: number;
  /** Semantische kleur per icon. Iter 9dq v5 (2026-06-02): unlocked
   *  rendert in volle kleur (oranje vlam, gouden trofee, etc.), locked
   *  in dezelfde kleur op 30% opacity — preview van "dit krijg je
   *  straks". Maakt achievements meteen identificeerbaar. */
  color: string;
  unlocked: (stats: BraceletStats) => boolean;
  hint: (stats: BraceletStats) => string;
  /** Voortgang 0..1 — voor de progress-bar onder locked chips. 1 = klaar.
   *  Boolean milestones (zoals 'first session') hebben 0 of 1. */
  progress: (stats: BraceletStats) => number;
};

/* Iter 9dq v5: semantische kleur-tokens voor achievements. Hergebruikt
   brand-palet waar mogelijk (Sharp Focus oranje voor vuur, accent blauw
   voor navigatie) en voegt een premium goud toe voor de trophy-klasse. */
/* Huisstijl v4.4: Signal Blue is voorbehouden voor haptic-pulse/BLE-status,
   niet voor decoratieve achievement-iconen — AudioAccent i.p.v. blauw. */
const ACHIEVEMENT_COLORS = {
  flame: '#FF9F0A',  // brand Sharp Focus oranje — warm vuur
  gold: '#fbbf24',   // amber-400 — premium award
  accent: AudioAccent, // start + exploratie
} as const;

/* Iter 9dq v6 (2026-06-02): subtiele blauwe omlijning op alle cards in
   deze page (operator-feedback: standaard grijze border voelt saai).
   Tinted brand-accent op 28% alpha: zichtbaar als blauwe gloed maar
   genoeg ingehouden om geen aandacht weg te trekken van de inhoud.
   Eén constante = makkelijk centraal tweaken als 't te subtiel of te
   pop is. */
/* Huisstijl v4.4: decoratieve kaart-border, niet haptic/status — AudioAccent. */
const CARD_BORDER = 'rgba(110, 133, 196, 0.28)';

/* Iter 9dq v4 (2026-06-02): twee icon-klassen voor visuele hiërarchie.
   1. Flame-ladder (30m → 1h → 3d): 1× / 2× / 3× Flame — escaleert in
      intensiteit, leesbaar als "consistency heating up".
   2. Trophy-klasse (7-day / 100 cycles / 10h): Crown / Medal / Trophy —
      voelt als "next level" award, andere categorie dan de daily-grind.
   Eerste en exploratie blijven Sparkles + Compass (eigen identiteit). */
const MILESTONES: Milestone[] = [
  {
    id: 'first',
    label: 'First session',
    Icon: Sparkles,
    color: ACHIEVEMENT_COLORS.accent,
    unlocked: (s) => s.totalSessions >= 1,
    hint: () => 'Complete 1 session',
    progress: (s) => Math.min(1, s.totalSessions / 1),
  },
  {
    id: 'min30',
    label: '30 minutes',
    Icon: Flame,
    iconCount: 1,
    color: ACHIEVEMENT_COLORS.flame,
    unlocked: (s) => s.totalMinutes >= 30,
    hint: (s) => `${Math.max(0, 30 - s.totalMinutes)} min to go`,
    progress: (s) => Math.min(1, s.totalMinutes / 30),
  },
  {
    id: 'hour1',
    label: '1 hour total',
    Icon: Flame,
    iconCount: 2,
    color: ACHIEVEMENT_COLORS.flame,
    unlocked: (s) => s.totalMinutes >= 60,
    hint: (s) => `${Math.max(0, 60 - s.totalMinutes)} min to go`,
    progress: (s) => Math.min(1, s.totalMinutes / 60),
  },
  {
    id: 'streak3',
    label: '3-day streak',
    Icon: Flame,
    iconCount: 3,
    color: ACHIEVEMENT_COLORS.flame,
    /* Iter 9dq v6: permanent-unlock op bestStreak ipv huidige streak.
       Eenmaal 3 dagen op rij gehaald = badge blijft voor altijd. Hint
       toont huidig + best zodat user weet waar 'ie nu staat. */
    unlocked: (s) => s.bestStreak >= 3,
    hint: (s) =>
      s.bestStreak >= 3
        ? `Best: ${s.bestStreak} day${s.bestStreak === 1 ? '' : 's'}`
        : `Current: ${s.streak} · Best: ${s.bestStreak}`,
    progress: (s) => Math.min(1, s.bestStreak / 3),
  },
  {
    id: 'streak7',
    label: '7-day streak',
    Icon: Crown,
    color: ACHIEVEMENT_COLORS.gold,
    unlocked: (s) => s.bestStreak >= 7,
    hint: (s) =>
      s.bestStreak >= 7
        ? `Best: ${s.bestStreak} day${s.bestStreak === 1 ? '' : 's'}`
        : `Current: ${s.streak} · Best: ${s.bestStreak}`,
    progress: (s) => Math.min(1, s.bestStreak / 7),
  },
  {
    id: 'allModes',
    label: 'All 5 modes',
    Icon: Compass,
    color: ACHIEVEMENT_COLORS.accent,
    unlocked: (s) =>
      Object.keys(s.minutesByMode).length >= MODES.length,
    hint: (s) =>
      `${Object.keys(s.minutesByMode).length} of ${MODES.length} tried`,
    progress: (s) =>
      Math.min(1, Object.keys(s.minutesByMode).length / MODES.length),
  },
  {
    id: 'cycles100',
    label: '100 breath cycles',
    Icon: Medal,
    color: ACHIEVEMENT_COLORS.gold,
    unlocked: (s) => s.totalBreathCycles >= 100,
    hint: (s) =>
      `${s.totalBreathCycles} / 100 cycles`,
    progress: (s) => Math.min(1, s.totalBreathCycles / 100),
  },
  {
    id: 'hour10',
    label: '10 hours total',
    Icon: Trophy,
    color: ACHIEVEMENT_COLORS.gold,
    unlocked: (s) => s.totalMinutes >= 600,
    hint: (s) => `${Math.max(0, 600 - s.totalMinutes)} min to go`,
    progress: (s) => Math.min(1, s.totalMinutes / 600),
  },
];

/* Iter 9dq (2026-06-02): geanimeerde milestone-chip.
   - Stagger fade+slide-in entry (delay per index, ~80ms tussen chips)
   - Unlocked chips krijgen subtiel breath-pulse op de icon (1.0 → 1.08)
   - Progress-bar onderaan locked chips toont visuele voortgang
   - Glow-border + green tint op unlocked
   Geen reanimated nodig — built-in Animated API is voldoende voor deze
   simpele transities en houdt de bundle minimal. */
function MilestoneChip({
  milestone,
  stats,
  index,
}: {
  /* `unlocked` is op het Milestone-type een FUNCTIE; hierboven is hij al
     uitgerekend tot een boolean. `Omit` maakt dat expliciet — zonder dit
     meldde de typecheck acht keer "condition always true" en verdronken
     echte fouten in die ruis (audit, 8 augustus 2026). */
  milestone: Omit<Milestone, 'unlocked'> & { unlocked: boolean };
  stats: BraceletStats;
  index: number;
}) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(8)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    /* Entry: fade + slide-up, staggered per chip. Geeft een
       "kaart-na-kaart"-binnenkomst zoals Apple Activity / Calm. */
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 360,
        delay: index * 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 360,
        delay: index * 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeIn, slideUp, index]);

  useEffect(() => {
    /* Pulse alleen op unlocked — life-signal voor de "achievement"
       laag. Loop met breath-tempo (~2 sec heen, 2 sec terug). */
    if (!milestone.unlocked) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, milestone.unlocked]);

  const progress = milestone.progress(stats);
  const progressPct = Math.round(progress * 100);
  const Icon = milestone.Icon;
  const iconCount = milestone.iconCount ?? 1;
  /* Iter 9dq v5 (2026-06-02): semantische kleur per milestone. Unlocked
     toont icoon op volle kleur; locked op dezelfde kleur maar 30%
     opacity (preview-effect — user ziet welk "type" achievement het is
     zonder dat het concurreert met unlocked chips). Border + progress-
     bar tint nu ook met milestone-kleur ipv generic green/blue zodat de
     hele chip één gevoel uitstraalt. */
  const iconColor = milestone.unlocked
    ? milestone.color
    : `${milestone.color}4D`; // 4D = 30% alpha hex
  const iconSize = iconCount > 1 ? 22 : 26;
  const iconStrokeWidth = milestone.unlocked ? 2.4 : 1.8;
  /* Achterkant van de chip neemt zachte tint van de icon-kleur als 't
     unlocked is. Locked blijft neutraal donker. */
  const unlockedChipStyle = milestone.unlocked
    ? {
        /* Operator, 5 okt 2026 ("randen veel te hard"): 50% → 20%. */
        borderColor: `${milestone.color}33`, // 20% alpha border
        backgroundColor: `${milestone.color}1A`, // 10% alpha fill
        shadowColor: milestone.color,
      }
    : null;

  return (
    <Animated.View
      style={[
        s.milestoneChip,
        unlockedChipStyle,
        milestone.unlocked && s.milestoneChipUnlockedShadow,
        {
          opacity: fadeIn,
          transform: [{ translateY: slideUp }],
        },
      ]}
    >
      <Animated.View
        style={[
          s.milestoneIconWrap,
          milestone.unlocked && { transform: [{ scale: pulse }] },
        ]}
      >
        <View style={s.milestoneIconRow}>
          {Array.from({ length: iconCount }).map((_, i) => (
            <Icon
              key={i}
              size={iconSize}
              color={iconColor}
              strokeWidth={iconStrokeWidth}
              style={i > 0 ? s.milestoneIconAfterFirst : undefined}
            />
          ))}
        </View>
      </Animated.View>
      <Text
        style={[
          s.milestoneLabel,
          milestone.unlocked && s.milestoneLabelUnlocked,
        ]}
        numberOfLines={1}
      >
        {milestone.label}
      </Text>
      <Text
        style={[
          s.milestoneHint,
          milestone.unlocked && { color: milestone.color },
        ]}
        numberOfLines={1}
      >
        {milestone.unlocked ? '✓ Unlocked' : milestone.hint(stats)}
      </Text>
      {!milestone.unlocked && progress > 0 && (
        <View style={s.milestoneProgressTrack}>
          <View
            style={[
              s.milestoneProgressFill,
              {
                width: `${progressPct}%`,
                backgroundColor: milestone.color,
              },
            ]}
          />
        </View>
      )}
    </Animated.View>
  );
}

function MilestonesStrip({ stats }: { stats: BraceletStats }) {
  const items = useMemo(
    () => MILESTONES.map((m) => ({ ...m, unlocked: m.unlocked(stats) })),
    [stats],
  );
  return (
    <View style={s.milestonesCard}>
      <View style={s.chartHeader}>
        <Text style={s.chartTitle}>Milestones</Text>
        <Text style={s.chartTotal}>
          {items.filter((i) => i.unlocked).length} / {items.length}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.milestonesScroll}
      >
        {items.map((m, i) => (
          <MilestoneChip
            key={m.id}
            milestone={m}
            stats={stats}
            index={i}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/* DayGroupCard — collapsible group voor sessies binnen één dag.
   Header toont label + summary (sessions + total min) + chevron.
   Tap = toggle expand. */
function DayGroupCard({
  group,
  expanded,
  onToggle,
}: {
  group: DayGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { onPressIn, onPressOut, pressStyle } = usePressScale(0.98);
  return (
    <View style={s.groupCard}>
      <AnimatedPressable
        style={[s.groupHeader, pressStyle]}
        onPress={onToggle}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={`${group.label}: ${expanded ? 'collapse' : 'expand'} sessions`}
      >
        <View style={s.groupHeaderLeft}>
          <Text style={s.groupLabel}>{group.label}</Text>
          <Text style={s.groupMeta}>
            {group.totalSessions}{' '}
            {group.totalSessions === 1 ? 'session' : 'sessions'} ·{' '}
            {group.totalMinutes} min
          </Text>
        </View>
        <Text style={s.groupChevron}>{expanded ? '▾' : '▸'}</Text>
      </AnimatedPressable>
      {expanded && (
        <View style={s.groupBody}>
          {group.sessions.map((rec) => (
            <SessionRow key={rec.id} rec={rec} />
          ))}
        </View>
      )}
    </View>
  );
}

/* Icon-only back chevron voor de header — eigen component zodat het de
   press-scale hook kan gebruiken (headerLeft's render-functie is geen
   React-component, kan zelf geen hooks aanroepen). scaleTo 0.92: kleine
   icon-knop, dichter bij 1 dan een kaart/CTA (recipe §"icon buttons"). */
function HistoryBackButton() {
  const { onPressIn, onPressOut, pressStyle } = usePressScale(0.92);
  return (
    <AnimatedPressable
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/bracelet');
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={12}
      accessibilityLabel="Back to bracelet"
      style={[
        {
          paddingHorizontal: 8,
          paddingVertical: 6,
        },
        pressStyle,
      ]}
    >
      {/* Operator, 1 okt 2026 ("headers overal consistent, dit is echt
         een andere pijl"): platte "←"-tekst-glyph vervangen door dezelfde
         ChevronLeft-icoon-stijl (size 20, strokeWidth 2.8 — de "officiële
         iOS-chevron.backward"-stijl uit build-choice.tsx, 18 sept) als
         overal elders in de app — de gecentreerde titel + pijl-only-links
         opzet zelf (Calm/Headspace-stijl, zie toelichting hierboven)
         blijft ongewijzigd, dat was een bewuste keuze. */}
      <ChevronLeft size={20} color={Brand.text} strokeWidth={2.8} />
    </AnimatedPressable>
  );
}

export default function BraceletHistory() {
  const stats = useBraceletStats();
  const sessions = useSessions();
  const emptyBtnScale = usePressScale(0.96);
  const clearBtnScale = usePressScale(0.96);
  /* Iter 9n: groepering per dag + collapsible state. Today expanded
     by default (gebruiker wil meestal recente sessies zien), oudere
     dagen collapsed zodat lijst kort blijft. */
  const groups = useMemo(() => groupByDay(sessions), [sessions]);
  const todayKey = getDayKey(new Date());
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([todayKey]),
  );
  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onClear = () => {
    void showVibezAlert({
      title: 'Clear all history?',
      message:
        'This will permanently delete all State Control session records on this device. Cannot be undone.',
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
      {/* Iter 9bp (2026-05-31): Calm/Headspace-style header — pijl-only
          links + gecentreerde titel. Operator-keuze: vermijdt "← Bracelet"-
          verwarring (user las dat als één blokje "ga naar Bracelet" wat
          klopt maar visueel vloeide het met de titel ineen). Nu: pijl
          = duidelijk "ga terug", titel midden = duidelijk "ik ben hier". */}
      <Stack.Screen
        options={{
          title: 'Session history',
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HistoryBackButton />,
        }}
      />
      {/* Iter v194 (2026-07-04): PreviewBanner weg op sessies-historie.
          Alleen owners bereiken dit scherm (via bracelet-control idle);
          voor hen is bracelet een echt product, geen preview. */}
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Eén weekkaart i.p.v. losse tegels + grafiek (5 okt 2026). */}
        <WeekSummary stats={stats} sessions={sessions} />

        {/* Mode breakdown — alleen als er sessies zijn */}
        {sessions.length > 0 && <ModeBreakdown stats={stats} />}

        {/* Operator, 1 okt 2026 ("ik zie hier nog breathwork staan, dat
           mag niet meer"): deze "Breathwork"-kaart (BreathBreakdown)
           toonde een bracelet-eigen ademhalings-begeleidingsfunctie die
           nog nergens gevoed wordt — `recordSession` (bracelet-control.tsx)
           zet nooit een `breathwork`-veld, dat wacht nog op firmware (zie
           project-bracelet-breathwork-firmware-memo). De kaart was dus
           altijd leeg voor iedereen, en het woord "Breathwork" hier
           botste bovendien met de regel dat bracelet en breathwork
           volledig gescheiden blijven (30 sept 2026). Component blijft
           hieronder bestaan (nuttig zodra de firmware er is), enkel de
           render hier is weg. */}

        {/* Milestones — engagement-laag, altijd zichtbaar */}
        <MilestonesStrip stats={stats} />

        <Text style={s.section}>Recent sessions</Text>

        {sessions.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No sessions yet</Text>
            <Text style={s.emptyBody}>
              Start your first State Control session and it will appear here.
            </Text>
            <AnimatedPressable
              style={[s.emptyBtn, emptyBtnScale.pressStyle]}
              onPress={() => router.back()}
              onPressIn={emptyBtnScale.onPressIn}
              onPressOut={emptyBtnScale.onPressOut}
              accessibilityLabel="Back to State Control"
            >
              <Text style={s.emptyBtnText}>Back to State Control</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <>
            <View style={s.groupsList}>
              {groups.map((g) => (
                <DayGroupCard
                  key={g.key}
                  group={g}
                  expanded={expanded.has(g.key)}
                  onToggle={() => toggleGroup(g.key)}
                />
              ))}
            </View>
            <AnimatedPressable
              style={[s.clearBtn, clearBtnScale.pressStyle]}
              onPress={onClear}
              onPressIn={clearBtnScale.onPressIn}
              onPressOut={clearBtnScale.onPressOut}
              accessibilityLabel="Clear all session history"
            >
              <Text style={s.clearBtnText}>Clear history</Text>
            </AnimatedPressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 20, paddingBottom: 32 },
  /* ── Stats-grid ────────────────────────────────────────────────── */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  statTile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Brand.panel,
    /* Iter 9dq v6: subtiele blauwe omlijning ipv saaie grijze border. */
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  statValue: {
    color: Brand.text,
    fontSize: 28,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.8,
  },
  statUnit: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    marginTop: 1,
  },
  /* Iter 9dk (2026-05-31): streak value-row layout — getal + vlam
     naast elkaar, vlam in iets kleinere size en zonder Inter-font
     zodat de system emoji-font de glyph levert. */
  statStreakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  statFlame: {
    /* GEEN fontFamily zetten → system emoji-font wint. */
    fontSize: 22,
    lineHeight: 26,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  /* ── Section heading ───────────────────────────────────────────── */
  section: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  /* ── List ──────────────────────────────────────────────────────── */
  list: {
    borderRadius: 14,
    backgroundColor: Brand.panel,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  /* ── Day-groups (iter 9n) ──────────────────────────────────────── */
  groupsList: {
    gap: 8,
  },
  groupCard: {
    borderRadius: 14,
    backgroundColor: Brand.panel,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  groupHeaderLeft: {
    flex: 1,
  },
  groupLabel: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  groupMeta: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    marginTop: 2,
  },
  groupChevron: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    paddingHorizontal: 4,
  },
  groupBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  /* Iter 9ca: redesigned session-row met verticale accent-strip links,
     duration rechtsboven, meta+status onderaan, optionele breath-tag. */
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 12,
    paddingRight: 14,
    paddingLeft: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowAccentBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 12,
    alignSelf: 'stretch',
  },
  rowMain: { flex: 1 },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  rowBottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rowMode: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
    flex: 1,
    marginRight: 8,
  },
  rowMeta: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.medium,
  },
  rowMetaDim: {
    color: 'rgba(255,255,255,0.35)',
  },
  rowDuration: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  rowStatus: {
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.4,
  },
  rowBreathTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  /* Huisstijl v4.4: decoratieve bullet-dot, niet haptic/status — AudioAccent. */
  rowBreathDot: {
    color: AudioAccent,
    fontSize: 14,
    marginRight: 6,
    lineHeight: 14,
  },
  rowBreathText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    flex: 1,
  },
  /* ── 7-day bar chart + mode breakdown shared card-styling ──────── */
  chartCard: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: Brand.panel,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartTitle: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  /* Iter 9cc (2026-05-31): subtitle onder chart-titel om de schaal
     transparant te maken ("min per day · scale 15m"). Helpt user
     interpreteren hoe groot een balk is. */
  chartSubtitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  chartTotal: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.2,
  },
  /* Iter 9cd (2026-05-31): chart visueel verstrekt.
     - Track krijgt een lichte achtergrond zodat de "leegte" zichtbaar is
       als een rectangle (i.p.v. transparant niets)
     - Bars iets smaller voor strakkere "thermometer" look
     - Today bar krijgt licht-shadow voor visuele "punch" */
  chartBars: {
    flexDirection: 'row',
    gap: 6,
    height: 130,
    alignItems: 'flex-end',
  },
  chartBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  chartBarTrack: {
    width: '70%',
    height: 88,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 4,
  },
  chartBarLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.5,
    marginTop: 8,
  },
  chartBarLabelActive: {
    color: Brand.text,
  },
  /* Iter 9ce (2026-05-31): waarde-label boven de bar. Onmiddellijk
     leesbaar hoeveel minuten die dag = de proportie. */
  chartBarValue: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
    marginBottom: 4,
    minHeight: 14,
  },
  chartBarValueActive: {
    color: Brand.text,
  },
  chartBarValueEmpty: {
    color: 'transparent',
  },
  /* Mode breakdown rows */
  breakdownList: {
    gap: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 110,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    color: Brand.text,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    flexShrink: 1,
  },
  /* Iter 9dq v7: kleine dim subtekst onder protocol-naam — verbindt
     protocol aan de bracelet-mode waar 't bij hoort ("for Boost"). */
  breakdownLabelSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    marginTop: 1,
  },
  /* Iter 9dq v7: empty state voor users zonder breathwork-sessies.
     Maakt de card discoverable ipv onzichtbaar bij first-time gebruik. */
  breathEmptyText: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  breakdownBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownValue: {
    color: Brand.text,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    minWidth: 60,
    textAlign: 'right',
  },
  breakdownValueDim: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
  },
  /* Milestones strip */
  milestonesCard: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: Brand.panel,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 0,
  },
  milestonesScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 14,
  },
  /* Iter 9dq: grotere, luchtigere chips. Icon krijgt z'n eigen ruimte
     bovenaan, label en hint daaronder. Locked chips hebben progress-bar
     onderaan; unlocked chips krijgen subtiele groene glow via shadow. */
  milestoneChip: {
    minWidth: 132,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'flex-start',
  },
  /* Iter 9dq v5: glow-shadow apart van border/fill. De border en fill
     krijgen per-milestone kleur via inline-style; shadow blijft generic
     zodat we niet voor elke kleur een aparte shadow-spec hoeven. iOS-only
     effectief (Android shadow op container vereist elevation, geeft
     harde drop — we accepteren dat Android iets soberder is). */
  milestoneChipUnlockedShadow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  /* Iter 9dq v3: Lucide-icon wrap. Lucide rendert SVG direct met kleur
     via prop — geen text-color of fontSize nodig. Wrap-View geeft de
     pulse-scale een container om op te animeren zonder de SVG-layout
     te beïnvloeden.
     Iter 9dq v4: row-container voor escalating flames (1, 2, 3 naast
     elkaar). Bij iconCount=1 valt dit terug op een normale layout. */
  milestoneIconWrap: {
    marginBottom: 8,
    /* Geen vaste height — Icon zelf bepaalt z'n hoogte via size prop.
       Wrap groeit/krimpt netjes mee. */
  },
  milestoneIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  milestoneIconAfterFirst: {
    /* Minimale spacing tussen flames zodat ze als kleine groep leesbaar
       zijn, niet als losse icons. 2px geeft "schouder-aan-schouder"-feel. */
    marginLeft: 2,
  },
  milestoneLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  milestoneLabelUnlocked: {
    color: Brand.text,
  },
  milestoneHint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    marginTop: 3,
  },
  milestoneHintUnlocked: {
    color: Brand.success,
    fontFamily: BrandFonts.semibold,
  },
  /* Progress-bar onderaan locked chips. Subtiel maar zichtbaar. Vol =
     bijna unlocked, dat is precies de visuele engagement-hint die de
     user motiveert ("nog 5 min!"). */
  milestoneProgressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 10,
    overflow: 'hidden',
  },
  /* Huisstijl v4.4: decoratieve progress-fill, niet haptic/status — AudioAccent. */
  milestoneProgressFill: {
    height: '100%',
    backgroundColor: AudioAccent,
    borderRadius: 2,
  },
  /* ── Empty state ───────────────────────────────────────────────── */
  empty: {
    paddingVertical: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    marginBottom: 8,
  },
  emptyBody: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  /* Huisstijl v4.4: CTA op donkere achtergrond = wit bg + donkere tekst, geen Signal Blue. */
  emptyBtn: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  emptyBtnText: {
    color: '#0a0a0a',
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  /* ── Clear all ─────────────────────────────────────────────────── */
  clearBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  clearBtnText: {
    color: Brand.error,
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.5,
  },
});
