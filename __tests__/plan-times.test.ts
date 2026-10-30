/* Tijden in het ademplan (30 okt 2026, operator): één indeling van de dagdelen, per 5 minuten, en een sessie mag na het
   opbouwen naar een ander dagdeel — dan kiest de app de toestand die daar hoort. */
import { SLOT_WINDOW, slotForMinutes, slotTimeOptions, snapToSlot, TIME_STEP_MIN } from '../src/utils/day-plan';
import { generateTemplate, moveTemplateItem, removePlanItem, setTemplateItemState } from '../src/utils/protocol';

const hm = (h: number, m = 0) => h * 60 + m;

describe('daypart hours', () => {
  it('Morning 05-12, Midday 12-17, After work 17-20, Evening 20-00', () => {
    expect(SLOT_WINDOW.morning).toEqual({ from: 5, to: 12 });
    expect(SLOT_WINDOW.midday).toEqual({ from: 12, to: 17 });
    expect(SLOT_WINDOW.afterWork).toEqual({ from: 17, to: 20 });
    expect(SLOT_WINDOW.evening).toEqual({ from: 20, to: 24 });
  });
  it('every daypart: 5-minute steps, first = start, last = 5 min before the end', () => {
    for (const slot of ['morning', 'midday', 'afterWork', 'evening']) {
      const opts = slotTimeOptions(slot);
      const w = SLOT_WINDOW[slot];
      expect(opts[0]).toBe(hm(w.from));
      expect(opts[opts.length - 1]).toBe(hm(w.to) - TIME_STEP_MIN);
      expect(opts.every((m, i) => i === 0 || m - opts[i - 1] === 5)).toBe(true);
    }
    expect(slotTimeOptions('evening')).toContain(hm(21, 35));
  });
  it('time of day -> daypart (before 05:00 counts as evening)', () => {
    expect(slotForMinutes(hm(4, 55))).toBe('evening');
    expect(slotForMinutes(hm(5))).toBe('morning');
    expect(slotForMinutes(hm(12))).toBe('midday');
    expect(slotForMinutes(hm(17))).toBe('afterWork');
    expect(slotForMinutes(hm(20))).toBe('evening');
  });
  it('old times snap onto the grid of their daypart', () => {
    expect(snapToSlot('evening', hm(0, 30) + 24 * 60)).toBe(hm(23, 55)); // old "evening until 04:00"
    expect(snapToSlot('morning', hm(4, 15))).toBe(hm(5)); // old "morning from 04:00"
    expect(snapToSlot('midday', hm(13, 15))).toBe(hm(13, 15)); // quarter-hour stays
    expect(snapToSlot('midday', hm(13, 7))).toBe(hm(13, 5));
  });
});

describe('moving a planned session', () => {
  const goals = ['sleep'];
  const items = generateTemplate(goals, 'essential', ['evening'], 'beginner');

  it('same daypart: only the time changes', () => {
    const before = items[0];
    const after = moveTemplateItem(items, 0, before.slot, hm(21, 35), goals, 'beginner')[0];
    expect(after.reminderAt).toBe(hm(21, 35));
    expect(after.state).toBe(before.state);
    expect(after.techniqueKey).toBe(before.techniqueKey);
    expect(after.minutes).toBe(before.minutes);
  });
  it('another daypart: slot + time change, the state is the one the app picks there', () => {
    const after = moveTemplateItem(items, 0, 'morning', hm(7, 10), goals, 'beginner')[0];
    expect(after.slot).toBe('morning');
    expect(after.reminderAt).toBe(hm(7, 10));
    expect(after.state).not.toBe('rest'); // never Sleep in the morning
  });
  it('replacing the state keeps a custom time', () => {
    const timed = moveTemplateItem(items, 0, items[0].slot, hm(22, 5), goals, 'beginner');
    const replaced = setTemplateItemState(timed, 0, 'calm', goals, 'beginner')[0];
    expect(replaced.state).toBe('calm');
    expect(replaced.reminderAt).toBe(hm(22, 5));
  });
  it('other items are untouched', () => {
    const two = generateTemplate(['sleep', 'energy'], 'standard', ['morning', 'evening'], 'beginner');
    const after = moveTemplateItem(two, 1, two[1].slot, two[1].reminderAt + 5, ['sleep', 'energy'], 'beginner');
    expect(after[0]).toEqual(two[0]);
  });
});

describe('removing a session from a running plan', () => {
  const goals = ['stress', 'energy'];
  const template = generateTemplate(goals, 'standard', ['morning', 'evening'], 'beginner');
  const plan = {
    id: 't',
    createdAt: 0,
    goals,
    intensity: 'standard' as const,
    horizon: 'week' as const,
    startDayKey: '2026-10-30',
    days: {
      '2026-10-30': { dayKey: '2026-10-30', items: template },
      '2026-10-31': { dayKey: '2026-10-31', items: template },
    },
  };
  it('removes the same position on every day and the routine follows the new count', () => {
    const next = removePlanItem(plan as never, 0)!;
    expect(next).not.toBeNull();
    expect(next.days['2026-10-30'].items).toEqual([template[1]]);
    expect(next.days['2026-10-31'].items).toEqual([template[1]]);
    expect(next.intensity).toBe('essential');
  });
  it('removing the last session = no plan left', () => {
    const one = removePlanItem(plan as never, 0)!;
    expect(removePlanItem(one, 0)).toBeNull();
  });
  it('moving into a daypart that already has a session never repeats its state', () => {
    const moved = moveTemplateItem(template, 0, template[1].slot, template[1].reminderAt + 30, goals, 'beginner');
    expect(moved[0].slot).toBe(template[1].slot);
    expect(moved[0].state).not.toBe(template[1].state);
  });
});
