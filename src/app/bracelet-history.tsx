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

import { PreviewBanner } from '@/components/PreviewBanner';
import { Brand, BrandFonts } from '@/constants/theme';
import {
  clearHistory,
  getAllSessions,
  useBraceletStats,
  type BraceletStats,
  type SessionRecord,
} from '@/utils/bracelet-history';
import { Stack, router } from 'expo-router';
import {
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

function StatTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <View style={s.statTile}>
      <Text style={s.statValue}>{value}</Text>
      {unit && <Text style={s.statUnit}>{unit}</Text>}
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
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

/* ── 7-day bar chart ────────────────────────────────────────────────
   Compact mini-chart die per dag de totale minuten toont. Last 7
   days van oudste → nieuwste. Bars schalen op de hoogste waarde in de
   week (relatief, niet absoluut) zodat de variatie altijd zichtbaar is. */
function SevenDayChart({ stats }: { stats: BraceletStats }) {
  const days = stats.last7Days;
  /* Iter 9cb → 9cc (2026-05-31): meer realistische schaal.
     MIN_SCALE 30 → 15 want 30 min/dag is een hoog target voor een
     gewone gebruiker → 2 min op 30-schaal = 7% = nauwelijks zichtbaar.
     15 min als ondergrens-schaal voelt natuurlijker (één goede sessie),
     en de chart schaalt nog steeds mee bij topdagen.
     Plus: MIN_VISIBLE_PCT = 10% → elke non-zero waarde toont minstens
     een dunne maar zichtbare balk zodat "2 min" niet lijkt op "0 min". */
  /* Iter 9cd → 9ch (2026-05-31): MIN_SCALE 15 → 30. Voor een wellness-
     app is 10–15 min/dag het normale doel; 30 min = een echt top-dag.
     Met schaal 15 leek 11 min "bijna max" → user-feedback "balk bijna
     vol". Met schaal 30 voelt 11 min als ~37% = goede dag, niet top —
     veel realistischer mental model.
     MIN_VISIBLE_PCT 15% blijft → 1 min sessies tonen nog duidelijk
     genoeg om te lezen, geen verdwijning. */
  const MIN_SCALE = 30;
  const MIN_VISIBLE_PCT = 15;
  const maxMin = Math.max(MIN_SCALE, ...days.map((d) => d.minutes));
  const weekTotal = days.reduce((sum, d) => sum + d.minutes, 0);
  return (
    <View style={s.chartCard}>
      <View style={s.chartHeader}>
        <View>
          <Text style={s.chartTitle}>Last 7 days</Text>
          <Text style={s.chartSubtitle}>
            min per day · scale {maxMin}m
          </Text>
        </View>
        <Text style={s.chartTotal}>{weekTotal} min</Text>
      </View>
      <View style={s.chartBars}>
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          const rawPct = (d.minutes / maxMin) * 100;
          const heightPct =
            d.minutes > 0 ? Math.max(MIN_VISIBLE_PCT, rawPct) : 0;
          const hasValue = d.minutes > 0;
          const fillColor = hasValue
            ? isToday
              ? Brand.text
              : 'rgba(255,255,255,0.55)'
            : 'rgba(255,255,255,0.06)';
          return (
            <View key={d.dayKey} style={s.chartBarCol}>
              {/* Iter 9ce (2026-05-31): waarde-label BOVEN de bar voor
                  non-zero dagen. Zo zie je direct "3" boven Today's bar
                  → onmiddellijk duidelijk hoeveel min die dag = welke
                  proportie. Today value krijgt full-wit emphasis. */}
              <Text
                style={[
                  s.chartBarValue,
                  isToday && s.chartBarValueActive,
                  !hasValue && s.chartBarValueEmpty,
                ]}
                numberOfLines={1}
              >
                {hasValue ? d.minutes : ' '}
              </Text>
              <View style={s.chartBarTrack}>
                <View
                  style={[
                    s.chartBarFill,
                    {
                      height: `${heightPct}%`,
                      backgroundColor: fillColor,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  s.chartBarLabel,
                  isToday && s.chartBarLabelActive,
                ]}
                numberOfLines={1}
              >
                {d.dayLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
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
const PROTOCOL_NAME_TO_MODE: Record<string, BraceletMode> = {
  Energizing: BraceletMode.Gamma, // Boost → wit
  'Triangle breath': BraceletMode.Beta, // Sharp Focus → oranje
  Coherent: BraceletMode.Alpha, // Calm Control → blauw
  'Nadi Shodhana': BraceletMode.Theta, // Clarity → paars
  'Box breath': BraceletMode.Delta, // Rest & Reset → sage
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
const ACHIEVEMENT_COLORS = {
  flame: '#FF9F0A',  // brand Sharp Focus oranje — warm vuur
  gold: '#fbbf24',   // amber-400 — premium award
  accent: '#3a8fff', // brand accent blauw — start + exploratie
} as const;

/* Iter 9dq v6 (2026-06-02): subtiele blauwe omlijning op alle cards in
   deze page (operator-feedback: standaard grijze border voelt saai).
   Tinted brand-accent op 28% alpha: zichtbaar als blauwe gloed maar
   genoeg ingehouden om geen aandacht weg te trekken van de inhoud.
   Eén constante = makkelijk centraal tweaken als 't te subtiel of te
   pop is. */
const CARD_BORDER = 'rgba(58, 143, 255, 0.28)';

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
  milestone: Milestone & { unlocked: boolean };
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
        borderColor: `${milestone.color}80`, // 50% alpha border
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
  return (
    <View style={s.groupCard}>
      <Pressable
        style={s.groupHeader}
        onPress={onToggle}
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
      </Pressable>
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

export default function BraceletHistory() {
  const stats = useBraceletStats();
  const sessions = useSessions();
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
        'This will permanently delete all bracelet session records on this device. Cannot be undone.',
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
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/bracelet');
              }}
              hitSlop={12}
              accessibilityLabel="Back to bracelet"
              style={{
                paddingHorizontal: 8,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  color: Brand.text,
                  fontSize: 24,
                  fontFamily: BrandFonts.regular,
                  lineHeight: 26,
                }}
              >
                ←
              </Text>
            </Pressable>
          ),
        }}
      />
      {/* Iter v194 (2026-07-04): PreviewBanner weg op sessies-historie.
          Alleen owners bereiken dit scherm (via bracelet-control idle);
          voor hen is bracelet een echt product, geen preview. */}
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Iter 9ca (2026-05-31): top-stats — 4 compacte tiles met de
            meest waardevolle metrics. Streak met 🔥 als 'ie >0. */}
        <View style={s.statsGrid}>
          <StatTile
            label="today"
            value={stats.todaySessions}
            unit={
              stats.todayMinutes > 0
                ? `${stats.todayMinutes} min`
                : undefined
            }
          />
          {/* Iter 9dk (2026-05-31): aparte streak-tile met vlam als
              eigen Text-element. Inter (de Brand-font) heeft geen
              emoji-glyphs → vroegere string-postfix "1🔥" viel weg of
              werd raar gerenderd op sommige Android-builds. Nu: getal
              in Brand-font + vlam in default system font ernaast. */}
          <View style={s.statTile}>
            <View style={s.statStreakRow}>
              <Text style={s.statValue}>{stats.streak}</Text>
              {stats.streak > 0 && (
                <Text style={s.statFlame}>🔥</Text>
              )}
            </View>
            <Text style={s.statLabel}>day streak</Text>
          </View>
          <StatTile
            label="min total"
            value={stats.totalMinutes}
          />
          {/* Iter 9dm (2026-05-31): "breath cycles" → "breath min".
              Minuten zijn universeler en menselijker dan cycles
              (jargon-term). Cycles blijven in de breakdown beschikbaar
              maar niet meer als top-level metric. */}
          <StatTile
            label="breath min"
            value={stats.totalBreathMinutes}
          />
        </View>

        {/* 7-day mini bar chart — momentum-overzicht */}
        <SevenDayChart stats={stats} />

        {/* Mode breakdown — alleen als er sessies zijn */}
        {sessions.length > 0 && <ModeBreakdown stats={stats} />}

        {/* Iter 9dl (2026-05-31): Breath protocols breakdown — alleen
            als er breathwork gedaan is. */}
        <BreathBreakdown stats={stats} />

        {/* Milestones — engagement-laag, altijd zichtbaar */}
        <MilestonesStrip stats={stats} />

        <Text style={s.section}>Recent sessions</Text>

        {sessions.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No sessions yet</Text>
            <Text style={s.emptyBody}>
              Start your first bracelet session and it will appear here.
            </Text>
            <Pressable
              style={s.emptyBtn}
              onPress={() => router.back()}
              accessibilityLabel="Back to bracelet control"
            >
              <Text style={s.emptyBtnText}>Back to bracelet</Text>
            </Pressable>
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
            <Pressable
              style={s.clearBtn}
              onPress={onClear}
              accessibilityLabel="Clear all session history"
            >
              <Text style={s.clearBtnText}>Clear history</Text>
            </Pressable>
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
  rowBreathDot: {
    color: Brand.accent,
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
  milestoneProgressFill: {
    height: '100%',
    backgroundColor: Brand.accent,
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
  emptyBtn: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: Brand.accent,
  },
  emptyBtnText: {
    color: '#ffffff',
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
