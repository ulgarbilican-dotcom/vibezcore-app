/* Tijd van een geplande ademsessie wijzigen — eerst het dagdeel (met zijn uren), dan de tijd binnen dat dagdeel per
   5 minuten, dan de duur. Gedeeld door "Your protocol" (plan-review.tsx) en de agenda (agenda.tsx), zodat beide
   hetzelfde doen (operator, 30 okt 2026: "als user na het opgestelde protocol zelf wil veranderen moet hij ook
   dagdeel kunnen kiezen en dan de tijd binnen dat dagdeel; dagdeel moet meteen duidelijk zijn tussen welke uren").
   Wisselt het dagdeel, dan toont het blad meteen welke toestand de sessie daar wordt (zelfde regels als bij het
   opbouwen) — er verandert niets stil. Het blad zelf (kop + Done) hoort bij het scherm dat dit gebruikt. */
import { StyleSheet, Text, View } from 'react-native';
import Tap from '@/components/Tap';
import TimeWheel from '@/components/TimeWheel';
import { DurationWheel } from '@/components/DurationWheel';
import { BrandFonts } from '@/constants/theme';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { SLOTS } from '@/services/reminders';
import { slotRangeLabel, slotTimeOptions, snapToSlot } from '@/utils/day-plan';
import { stateForMovedItem } from '@/utils/protocol';
import { hapticTap } from '@/utils/haptics';
import type { PlannedItem, PlanSlot } from '@/utils/plan-store';
import type { ExperienceLevel } from '@/utils/settings';

export type SlotDraft = { slot: PlanSlot; time: number; minutes: number };

type DurationChoices = { options: { value: number; label: string }[]; recommended: number | null | undefined };

/** Startwaarde van het blad: de sessie zoals ze nu staat. */
export const draftFor = (it: PlannedItem): SlotDraft => ({
  slot: it.slot,
  time: snapToSlot(it.slot, it.reminderAt),
  minutes: it.minutes,
});

/** De toestand die de sessie krijgt met deze kladversie (een ander dagdeel = de keuze van de app daar). */
export function draftState(
  it: PlannedItem,
  draft: SlotDraft,
  goals: string[],
  level: ExperienceLevel,
  /** De andere sessies van die dag — zelfde keuze als moveTemplateItem (geen dubbele toestand in een dagdeel). */
  others: PlannedItem[] = [],
): { state: BreathStateKey; techniqueKey: string; moved: boolean } {
  if (draft.slot === it.slot) return { state: it.state, techniqueKey: it.techniqueKey, moved: false };
  const m = stateForMovedItem(draft.slot, goals, level, avoidIn(others, draft.slot));
  return { state: m.state, techniqueKey: m.techniqueKey, moved: true };
}

const avoidIn = (others: PlannedItem[], slot: PlanSlot) => others.filter((o) => o.slot === slot).map((o) => o.state);

export default function SlotTimeEditor({
  item,
  draft,
  onChange,
  goals,
  level,
  durationsFor,
  onRemove,
  others = [],
}: {
  item: PlannedItem;
  draft: SlotDraft;
  onChange: (next: SlotDraft) => void;
  goals: string[];
  level: ExperienceLevel;
  /** De duurkeuzes van een toestand/techniek — elk scherm houdt zijn eigen bestaande lijst. */
  durationsFor: (state: BreathStateKey, techniqueKey: string) => DurationChoices;
  /** Een sessie uit een lopend plan halen — onderaan, zoals "Delete Event" in Apple's Agenda. */
  onRemove?: () => void;
  /** De andere sessies van die dag (zonder deze). */
  others?: PlannedItem[];
}) {
  const { state, techniqueKey, moved } = draftState(item, draft, goals, level, others);
  const st = BREATH_STATES[state];
  const durations = durationsFor(state, techniqueKey);
  /* Een persoonlijke duur (bv. 7 min) staat niet altijd in de vaste lijst — dan hoort hij er wel bij, anders toont het
     wiel een andere waarde dan wat er bewaard wordt. */
  const durationOptions = durations.options.some((o) => o.value === draft.minutes)
    ? durations.options
    : [...durations.options, { value: draft.minutes, label: `${draft.minutes} min` }].sort((a, b) => a.value - b.value);
  const slotLabel = SLOTS.find((sl) => sl.slot === draft.slot)?.label ?? '';

  return (
    <View>
      <View style={es.pills}>
        {SLOTS.map((sl) => {
          const on = draft.slot === sl.slot;
          return (
            <Tap
              key={sl.slot}
              style={[es.pill, on && es.pillOn]}
              onPress={() => {
                if (on) return;
                hapticTap();
                const next = sl.slot as PlanSlot;
                /* Terug naar het eigen dagdeel = de eigen tijd en duur; een ander dagdeel = zijn aanbevolen tijd en
                   de aanbevolen duur van de toestand die daar hoort. */
                if (next === item.slot) onChange(draftFor(item));
                else
                  onChange({
                    slot: next,
                    time: sl.hour * 60,
                    minutes: stateForMovedItem(next, goals, level, avoidIn(others, next)).minutes,
                  });
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${sl.label}, ${slotRangeLabel(sl.slot)}`}
            >
              <Text style={[es.pillTxt, on && es.pillTxtOn]} numberOfLines={1}>{sl.label}</Text>
              <Text style={[es.pillRange, on && es.pillTxtOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {slotRangeLabel(sl.slot)}
              </Text>
            </Tap>
          );
        })}
      </View>
      {moved && (
        <Text style={es.movedNote}>
          In the {slotLabel.toLowerCase()} this session becomes {st.eyebrow.toUpperCase()}
        </Text>
      )}
      <Text style={es.label}>Time</Text>
      <TimeWheel
        key={draft.slot}
        options={slotTimeOptions(draft.slot)}
        value={draft.time}
        accent={st.accent}
        trackColor="rgba(255,255,255,0.4)"
        onChange={(mins) => onChange({ ...draft, time: mins })}
      />
      <Text style={[es.label, { marginTop: 12 }]}>Duration</Text>
      <DurationWheel
        key={`d-${state}`}
        options={durationOptions}
        value={draft.minutes}
        accent={st.accent}
        trackColor="rgba(255,255,255,0.4)"
        recommendedValue={durations.recommended ?? undefined}
        onChange={(v) => onChange({ ...draft, minutes: v })}
      />
      {onRemove && (
        <Tap style={es.removeBtn} onPress={onRemove} hitSlop={8} accessibilityRole="button">
          <Text style={es.removeTxt}>Remove session</Text>
        </Tap>
      )}
    </View>
  );
}

const es = StyleSheet.create({
  pills: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  pill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  pillOn: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.16)' },
  pillTxt: { fontFamily: BrandFonts.semibold, fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  pillRange: { fontFamily: BrandFonts.regular, fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  pillTxtOn: { color: '#ffffff' },
  movedNote: {
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginBottom: 6,
  },
  removeBtn: { alignSelf: 'center', marginTop: 14, paddingVertical: 8, paddingHorizontal: 16 },
  removeTxt: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ef4444' },
  label: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 2,
  },
});
