/* Tijd en duur van een geplande sessie, zoals Apple's Agenda (operator, 30 okt 2026: "de scheiding tussen time en
   duration is heel rommelig", "de popup is niet mooi en overzichtelijk"): twee rijen in één afgeronde groep —
   "Time · 20:20" en "Duration · 5 min" — en een tik op een rij klapt ENKEL dat wiel open. Nooit twee wielen tegelijk.
   Gedeeld door de breathwork- (SlotTimeEditor) en de State Control-agenda. */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Tap from '@/components/Tap';
import TimeWheel from '@/components/TimeWheel';
import { DurationWheel } from '@/components/DurationWheel';
import { BrandFonts } from '@/constants/theme';
import { hapticTap } from '@/utils/haptics';

const fmtTime = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function TimeDurationRows({
  time,
  timeOptions,
  onTime,
  minutes,
  durationOptions,
  recommendedMinutes,
  onMinutes,
  accent,
  timeKey,
}: {
  time: number;
  timeOptions: number[];
  onTime: (mins: number) => void;
  minutes: number;
  durationOptions: { value: number; label: string }[];
  recommendedMinutes?: number;
  onMinutes: (m: number) => void;
  accent: string;
  /** Verandert de lijst tijden (ander dagdeel), dan begint het wiel opnieuw op de juiste plek. */
  timeKey?: string;
}) {
  const [open, setOpen] = useState<'time' | 'duration'>('time');
  const toggle = (which: 'time' | 'duration') => {
    if (open === which) return;
    hapticTap();
    setOpen(which);
  };
  return (
    <View style={rs.group}>
      <Tap style={rs.row} onPress={() => toggle('time')} accessibilityRole="button" accessibilityState={{ expanded: open === 'time' }}>
        <Text style={rs.rowLabel}>Time</Text>
        <Text style={[rs.rowValue, open === 'time' && { color: accent }]}>{fmtTime(time)}</Text>
      </Tap>
      {open === 'time' && (
        <View style={rs.wheelBox}>
          <TimeWheel key={timeKey} options={timeOptions} value={time} accent={accent} trackColor="rgba(255,255,255,0.4)" onChange={onTime} />
        </View>
      )}
      <View style={rs.divider} />
      <Tap
        style={rs.row}
        onPress={() => toggle('duration')}
        accessibilityRole="button"
        accessibilityState={{ expanded: open === 'duration' }}
      >
        <Text style={rs.rowLabel}>Duration</Text>
        <Text style={[rs.rowValue, open === 'duration' && { color: accent }]}>{minutes} min</Text>
      </Tap>
      {open === 'duration' && (
        <View style={rs.wheelBox}>
          <DurationWheel
            options={durationOptions}
            value={minutes}
            accent={accent}
            trackColor="rgba(255,255,255,0.4)"
            recommendedValue={recommendedMinutes}
            onChange={onMinutes}
          />
        </View>
      )}
    </View>
  );
}

const rs = StyleSheet.create({
  group: {
    alignSelf: 'stretch',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 18,
  },
  rowLabel: { fontFamily: BrandFonts.medium, fontSize: 16, color: '#ffffff' },
  rowValue: { fontFamily: BrandFonts.semibold, fontSize: 16, color: 'rgba(255,255,255,0.75)' },
  wheelBox: { paddingBottom: 10 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginLeft: 18 },
});
