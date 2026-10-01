/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Mijlpalen

   Pure functie, geen state: agenda.tsx roept 'm aan met wat het al heeft
   (streak + totals uit breath-history.ts) en tekent het resultaat. Zelfde
   permanent-unlock-principe als bracelet-history.ts se bestStreak: een
   mijlpaal die ooit bereikt is, blijft bereikt, ook na een gebroken streak
   (operator, 13 augustus 2026, protocol-systeem).
   ───────────────────────────────────────────────────────────────────────── */

import type { BreathTotals } from '@/utils/breath-history';

export type MilestoneKind = 'streak' | 'sessions' | 'minutes';

export type Milestone = {
  key: string;
  kind: MilestoneKind;
  threshold: number;
  label: string;
};

const STREAK_MILESTONES = [3, 7, 30, 100, 365];
const SESSION_MILESTONES = [10, 50, 100, 500, 1000];
const MINUTE_MILESTONES = [60, 300, 1000, 5000];

/** Alle mijlpalen die met dit streak/totals-koppel al bereikt zijn, oplopend
 *  per soort. Streak-mijlpalen kijken naar `bestStreak` (nooit-dalend), niet
 *  naar de actuele streak — anders verliest een gebroken streak zijn badge. */
export function milestonesReached(
  streak: number,
  totals: BreathTotals,
): Milestone[] {
  const best = Math.max(streak, totals.bestStreak);
  const totalMinutes = Math.round(totals.sec / 60);
  const out: Milestone[] = [];

  for (const t of STREAK_MILESTONES) {
    if (best >= t) {
      out.push({ key: `streak-${t}`, kind: 'streak', threshold: t, label: `${t}-Day Streak` });
    }
  }
  for (const t of SESSION_MILESTONES) {
    if (totals.sessions >= t) {
      out.push({ key: `sessions-${t}`, kind: 'sessions', threshold: t, label: `${t} Sessions` });
    }
  }
  for (const t of MINUTE_MILESTONES) {
    if (totalMinutes >= t) {
      out.push({ key: `minutes-${t}`, kind: 'minutes', threshold: t, label: `${t} Minutes` });
    }
  }
  return out;
}

/** De eerstvolgende, nog niet bereikte mijlpaal per soort — voor "3 more
 *  sessions to your next badge"-achtige progress-tekst op de agenda. */
export function nextMilestone(
  streak: number,
  totals: BreathTotals,
): { streak: Milestone | null; sessions: Milestone | null; minutes: Milestone | null } {
  const best = Math.max(streak, totals.bestStreak);
  const totalMinutes = Math.round(totals.sec / 60);
  const nextOf = (
    values: number[],
    current: number,
    kind: MilestoneKind,
    label: (n: number) => string,
  ): Milestone | null => {
    const t = values.find((v) => v > current);
    return t === undefined ? null : { key: `${kind}-${t}`, kind, threshold: t, label: label(t) };
  };
  return {
    streak: nextOf(STREAK_MILESTONES, best, 'streak', (n) => `${n}-Day Streak`),
    sessions: nextOf(SESSION_MILESTONES, totals.sessions, 'sessions', (n) => `${n} Sessions`),
    minutes: nextOf(MINUTE_MILESTONES, totalMinutes, 'minutes', (n) => `${n} Minutes`),
  };
}
