/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "This week" bovenaan Activity (audit 12 okt 2026, operator
   akkoord: "Activity opent niet met een kaart This week")

   Zoals Apple Fitness / Oura: eerst de samenvatting, dan de details. De
   minuten staan per soort apart (State Control en Breathwork blijven
   gescheiden, zie de kop van activity.tsx — geen gemengde grafiek), de
   reeks telt elke dag waarop je iets deed, en "Up next" is je volgende
   geplande sessie van vandaag.
   ───────────────────────────────────────────────────────────────────────── */

import { AudioAccentLight, BrandDark, BrandFonts } from '@/constants/theme';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { getModeMeta, type BraceletMode } from '@/services/ble-contract';
import { dayKey, getAllSessions, useBraceletStats } from '@/utils/bracelet-history';
import { useActiveBraceletPlan } from '@/utils/bracelet-plan-store';
import { useBreathHistory } from '@/utils/breath-history';
import { startOfWeekMonday } from '@/utils/locale';
import { useActivePlan } from '@/utils/plan-store';
import { currentStreak } from '@/utils/streak';
import { router } from 'expo-router';
import { ChevronRight, Flame, Radio, Wind } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const ink = (a: number) => `rgba(255,255,255,${a})`;

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Langste reeks ooit uit een set dagsleutels (YYYY-MM-DD). */
function bestRun(days: Set<string>): number {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of sorted) {
    const [y, m, d] = k.split('-').map(Number);
    const cur = new Date(y, m - 1, d, 12);
    if (prev) {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      run = dayKey(next) === k ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

export default function ThisWeekCard() {
  const breath = useBreathHistory();
  const bStats = useBraceletStats();
  const { plan } = useActivePlan();
  const { plan: bPlan } = useActiveBraceletPlan();

  /* Elke minuut opnieuw: "Up next" schuift door zonder dat je moet verversen. */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const data = useMemo(() => {
    const weekStart = startOfWeekMonday(now).getTime();
    const breathMin = Math.round(
      breath.filter((e) => e.ts >= weekStart).reduce((sum, e) => sum + e.durSec, 0) / 60,
    );
    const scMin = bStats.weekMinutes;

    const days = new Set<string>();
    for (const e of breath) days.add(dayKey(new Date(e.ts)));
    for (const r of getAllSessions()) {
      const t = Date.parse(r.startedAt);
      if (!Number.isNaN(t)) days.add(dayKey(new Date(t)));
    }
    const streak = currentStreak((d) => days.has(dayKey(d)), now);
    const best = Math.max(streak, bestRun(days));

    /* Volgende geplande sessie van vandaag (beide plannen samen). */
    const today = dayKey(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    type Next = { at: number; label: string; path: string };
    const upcoming: Next[] = [];
    for (const it of bPlan?.days[today]?.items ?? []) {
      if (it.reminderAt > nowMin) {
        upcoming.push({ at: it.reminderAt, label: getModeMeta(it.mode as BraceletMode).name, path: '/bracelet-agenda' });
      }
    }
    for (const it of plan?.days[today]?.items ?? []) {
      if (it.reminderAt > nowMin) {
        const st = BREATH_STATES[it.state as BreathStateKey];
        upcoming.push({ at: it.reminderAt, label: `${st ? titleCase(st.eyebrow) : 'Breathwork'} breathing`, path: '/agenda' });
      }
    }
    upcoming.sort((a, b) => a.at - b.at);
    return { breathMin, scMin, total: breathMin + scMin, streak, best, next: upcoming[0] ?? null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breath, bStats, plan, bPlan, now]);

  /* Operator, 12 okt 2026 ("liever als aparte cijfers"): drie gelijke
     kolommen zoals Apple Fitness — State Control, Breathwork, reeks —
     i.p.v. één totaal met een sub-regel. */
  return (
    <View
      style={s.card}
      accessible
      accessibilityLabel={`This week: State Control ${data.scMin} minutes, Breathwork ${data.breathMin} minutes. Streak ${data.streak} ${data.streak === 1 ? 'day' : 'days'}, best ${data.best}.`}
    >
      <Text style={s.eyebrow}>THIS WEEK</Text>
      <View style={s.cols}>
        <View style={s.col}>
          <View style={s.colHead}>
            <Radio size={14} color={ink(0.55)} strokeWidth={2.2} />
            <Text style={s.colLbl}>State Control</Text>
          </View>
          <Text style={s.num}>
            {data.scMin}
            <Text style={s.unit}> min</Text>
          </Text>
        </View>
        <View style={s.divider} />
        <View style={s.col}>
          <View style={s.colHead}>
            <Wind size={14} color={ink(0.55)} strokeWidth={2.2} />
            <Text style={s.colLbl}>Breathwork</Text>
          </View>
          <Text style={s.num}>
            {data.breathMin}
            <Text style={s.unit}> min</Text>
          </Text>
        </View>
        <View style={s.divider} />
        <View style={s.col}>
          <View style={s.colHead}>
            <Flame size={14} color={data.streak > 0 ? AudioAccentLight : ink(0.55)} strokeWidth={2.2} />
            <Text style={s.colLbl}>Streak</Text>
          </View>
          <Text style={s.num}>
            {data.streak}
            <Text style={s.unit}> {data.streak === 1 ? 'day' : 'days'}</Text>
          </Text>
          {data.best > data.streak ? <Text style={s.best}>Best {data.best}</Text> : null}
        </View>
      </View>
      {data.next ? (
        <Pressable
          style={({ pressed }) => [s.next, pressed && { opacity: 0.6 }]}
          onPress={() => router.push(data.next!.path as never)}
          accessibilityRole="button"
          accessibilityLabel={`Up next: ${data.next.label} at ${hhmm(data.next.at)}`}
        >
          <Text style={s.nextLbl}>Up next</Text>
          <Text style={s.nextTxt} numberOfLines={1}>
            {data.next.label} · {hhmm(data.next.at)}
          </Text>
          <ChevronRight size={16} color={ink(0.3)} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ink(0.08),
    backgroundColor: ink(0.035),
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 2,
    marginBottom: 22,
  },
  eyebrow: { fontFamily: BrandFonts.bold, fontSize: 11, letterSpacing: 1.6, color: ink(0.4) },
  cols: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 12, paddingBottom: 14 },
  col: { flex: 1, minWidth: 0 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: ink(0.12), marginHorizontal: 12 },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  colLbl: { fontFamily: BrandFonts.semibold, fontSize: 12, color: ink(0.55), flexShrink: 1 },
  num: { fontFamily: BrandFonts.extrabold, fontSize: 28, letterSpacing: -0.5, color: BrandDark.text, marginTop: 4, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: BrandFonts.semibold, fontSize: 13, letterSpacing: 0, color: ink(0.55) },
  best: { fontFamily: BrandFonts.medium, fontSize: 11.5, color: ink(0.4), marginTop: 2 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ink(0.12),
    paddingVertical: 12,
  },
  nextLbl: { fontFamily: BrandFonts.semibold, fontSize: 13, color: ink(0.5) },
  nextTxt: { flex: 1, fontFamily: BrandFonts.semibold, fontSize: 14, color: BrandDark.text },
});
