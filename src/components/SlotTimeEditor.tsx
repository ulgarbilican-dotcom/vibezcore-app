/* Tijd van een geplande ademsessie wijzigen — eerst het dagdeel (met zijn uren), dan de tijd binnen dat dagdeel per
   5 minuten, dan de duur. Gedeeld door "Your protocol" (plan-review.tsx) en de agenda (agenda.tsx), zodat beide
   hetzelfde doen (operator, 30 okt 2026: "als user na het opgestelde protocol zelf wil veranderen moet hij ook
   dagdeel kunnen kiezen en dan de tijd binnen dat dagdeel; dagdeel moet meteen duidelijk zijn tussen welke uren").
   Wisselt het dagdeel, dan toont het blad meteen welke toestand de sessie daar wordt (zelfde regels als bij het
   opbouwen) — er verandert niets stil. Het blad zelf (kop + Done) hoort bij het scherm dat dit gebruikt. */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Reveal } from '@/components/Reveal';
import { isReduceMotion, SPRING_POP } from '@/constants/motion';

/* De witte pil van de segmentbalk: zelfde strakke veer als de tab-overgangen. */
const SPRING_SEG = { damping: 22, stiffness: 260, mass: 0.7 } as const;
import Tap from '@/components/Tap';
import TimeDurationRows, { SheetBody, SHEET_DIAL_SIZE } from '@/components/TimeDurationRows';
import { ColorDurationDial } from '@/app/bracelet-control';
import { BrandFonts } from '@/constants/theme';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { SLOTS } from '@/services/reminders';
import { slotRangeLabel, slotRangeShort, slotTimeOptions, snapToSlot } from '@/utils/day-plan';
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
  /* 30 okt 2026 (operator): de sessie blijft dezelfde in elk dagdeel — enkel de tijd verhuist. */
  void draft;
  void goals;
  void level;
  void others;
  return { state: it.state, techniqueKey: it.techniqueKey, moved: false };
}

/** Naam, techniek en kleur van de sessie zoals ze NA Done wordt — voor de kop van het blad. */
export function draftHeader(
  it: PlannedItem,
  draft: SlotDraft,
  goals: string[],
  level: ExperienceLevel,
  others: PlannedItem[] = [],
): { title: string; subtitle: string; accent: string } {
  const { state, techniqueKey } = draftState(it, draft, goals, level, others);
  const st = BREATH_STATES[state];
  const tech = st.techniques.find((t) => t.key === techniqueKey) ?? st.techniques[0];
  return { title: st.eyebrow, subtitle: tech?.name ?? '', accent: st.accent };
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
  const { state, techniqueKey } = draftState(item, draft, goals, level, others);
  const st = BREATH_STATES[state];
  const durations = durationsFor(state, techniqueKey);
  /* Een persoonlijke duur (bv. 7 min) staat niet altijd in de vaste lijst — dan hoort hij er wel bij, anders toont het
     wiel een andere waarde dan wat er bewaard wordt. */
  const durationOptions = durations.options.some((o) => o.value === draft.minutes)
    ? durations.options
    : [...durations.options, { value: draft.minutes, label: `${draft.minutes} min` }].sort((a, b) => a.value - b.value);

  const [trackW, setTrackW] = useState(0);
  const segW = trackW > 0 ? (trackW - 8 - 2) / SLOTS.length : 0;
  const slotIdx = Math.max(0, SLOTS.findIndex((sl) => sl.slot === draft.slot));
  const pillX = useSharedValue(slotIdx * segW);
  useEffect(() => {
    pillX.value = isReduceMotion() ? slotIdx * segW : withSpring(slotIdx * segW, SPRING_SEG);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotIdx, segW]);
  /* Protocol: de pil schuift met een veer naar het gekozen dagdeel en het gekozen element popt (SPRING_POP). */
  const pillPop = useSharedValue(1);
  const firstSlot = useRef(true);
  useEffect(() => {
    if (firstSlot.current) {
      firstSlot.current = false;
      return;
    }
    if (isReduceMotion()) return;
    pillPop.value = 0.92;
    pillPop.value = withSpring(1, SPRING_POP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotIdx]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }, { scale: pillPop.value }] }));

  return (
    /* Volle breedte, ook in bladen die hun inhoud centreren (plan-review, "Your plan"); scrolt enkel op een klein scherm. */
    <SheetBody>
      {/* 30 okt 2026 (operator: "de dagdelen zien er heel sheet-achtig uit", "niet overzichtelijk"): één segmentbalk,
          het gekozen dagdeel als witte pil met donkere tekst (neutrale knop-regel), de uren kort eronder. */}
      {/* Animatieprotocol (30 okt 2026): de onderdelen komen gestaffeld binnen (Reveal), en de witte pil schuift met
          een veer naar het gekozen dagdeel i.p.v. te verspringen. */}
      <Reveal i={0}>
      <View style={es.segTrack} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        {trackW > 0 && <Animated.View pointerEvents="none" style={[es.segPill, { width: segW }, pillStyle]} />}
        {SLOTS.map((sl) => {
          const on = draft.slot === sl.slot;
          return (
            <Tap
              key={sl.slot}
              style={es.seg}
              onPress={() => {
                if (on) return;
                hapticTap();
                const next = sl.slot as PlanSlot;
                /* Terug naar het eigen dagdeel = de eigen tijd; een ander dagdeel = zijn aanbevolen tijd. De sessie en
                   haar duur blijven wat de gebruiker koos (30 okt 2026). */
                if (next === item.slot) onChange({ ...draft, slot: next, time: snapToSlot(next, item.reminderAt) });
                else onChange({ ...draft, slot: next, time: sl.hour * 60 });
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${sl.label}, ${slotRangeLabel(sl.slot)}`}
            >
              <Text style={[es.segTxt, on && es.segTxtOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {sl.label}
              </Text>
              <Text style={[es.segRange, on && es.segRangeOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {slotRangeShort(sl.slot)}
              </Text>
            </Tap>
          );
        })}
      </View>
      </Reveal>
      <View style={es.noteSpacer} />
      <TimeDurationRows
        timeKey={draft.slot}
        time={draft.time}
        timeOptions={slotTimeOptions(draft.slot)}
        onTime={(mins) => onChange({ ...draft, time: mins })}
        accent={st.accent}
        duration={
          <ColorDurationDial
            key={state}
            color={st.accent}
            label={st.eyebrow}
            min={durationOptions[0].value}
            max={durationOptions[durationOptions.length - 1].value}
            value={draft.minutes}
            allowed={durationOptions.map((o) => o.value)}
            recommended={durations.recommended != null && draft.minutes === durations.recommended}
            onChange={(v) => onChange({ ...draft, minutes: v })}
            size={SHEET_DIAL_SIZE}
          />
        }
      />
      {onRemove && (
        <Reveal i={3}>
          <Tap style={es.removeBtn} onPress={onRemove} hitSlop={8} accessibilityRole="button">
            <Text style={es.removeTxt}>Remove from plan</Text>
          </Tap>
        </Reveal>
      )}
    </SheetBody>
  );
}

const es = StyleSheet.create({
  segTrack: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  seg: { flex: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center' },
  /* 31 okt 2026 (operator: "het wit is te fel, check het protocol"): gekozen = lichter glas met een zachte rand
     (≤ 16 %), witte tekst — zoals de keuzepillen elders, geen fel wit vlak. */
  segPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  segTxt: { fontFamily: BrandFonts.semibold, fontSize: 13.5, color: 'rgba(255,255,255,0.55)' },
  segTxtOn: { color: '#ffffff' },
  segRange: { fontFamily: BrandFonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  segRangeOn: { color: 'rgba(255,255,255,0.7)' },
  noteSpacer: { height: 26 },
  removeBtn: { alignSelf: 'center', marginTop: 22, paddingVertical: 10, paddingHorizontal: 16 },
  removeTxt: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ef4444' },
});
