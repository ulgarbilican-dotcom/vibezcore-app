/* Tijd en duur van een geplande sessie, allebei meteen in beeld (operator, 30 okt 2026: "duration als
   cirkelregelaar en time als draaiwiel, beide gewoon in beeld zonder dropdown"): bovenaan het tijdwiel, eronder
   dezelfde duurcirkel als State Control (met je vinger over de rand slepen). Gedeeld door de breathwork-
   (SlotTimeEditor) en de State Control-agenda; de cirkel zelf geeft het scherm mee (kleur en bereik verschillen). */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import TimeWheel from '@/components/TimeWheel';
import { BrandFonts } from '@/constants/theme';

export default function TimeDurationRows({
  time,
  timeOptions,
  onTime,
  accent,
  timeKey,
  duration,
}: {
  time: number;
  timeOptions: number[];
  onTime: (mins: number) => void;
  accent: string;
  /** Verandert de lijst tijden (ander dagdeel), dan begint het wiel opnieuw op de juiste plek. */
  timeKey?: string;
  /** De duurcirkel. */
  duration: ReactNode;
}) {
  return (
    <View style={rs.wrap}>
      <Text style={rs.label}>Time</Text>
      <TimeWheel key={timeKey} options={timeOptions} value={time} accent={accent} trackColor="rgba(255,255,255,0.4)" onChange={onTime} />
      <Text style={[rs.label, rs.labelGap]}>Duration</Text>
      {/* Het blad mag de sleepbeweging over de cirkel niet afpakken (zelfde regel als bij de wielen). */}
      <View style={rs.dial} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}>
        {duration}
      </View>
    </View>
  );
}

const rs = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  label: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 4,
  },
  labelGap: { marginTop: 18, marginBottom: 10 },
  dial: { alignItems: 'center' },
});
