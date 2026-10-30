/* Tijd en duur van een geplande sessie, allebei meteen in beeld (operator, 30 okt 2026: "duration als
   cirkelregelaar en time als draaiwiel, beide gewoon in beeld zonder dropdown"): bovenaan het tijdwiel, eronder
   dezelfde duurcirkel als State Control (met je vinger over de rand slepen). Gedeeld door de breathwork-
   (SlotTimeEditor) en de State Control-agenda; de cirkel zelf geeft het scherm mee (kleur en bereik verschillen). */
import type { ReactNode } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import TimeWheel from '@/components/TimeWheel';
import { BrandFonts } from '@/constants/theme';

/* De duurcirkel in een blad: groeit en krimpt met de schermhoogte (30 okt 2026, operator: "maak de popup groter,
   hoger") — 160 op een klein toestel, tot 250 op een groot (bijna State Control-maat, tekst op ware grootte); het
   blad groeit mee naar boven. Kleiner = de tekst in de ring schaalt mee (ColorDurationDial). */
const H = Dimensions.get('window').height;
export const SHEET_DIAL_SIZE = Math.round(Math.max(160, Math.min(225, H - 690)));
/** Hoogste hoogte voor de inhoud van het blad (onder de kop); wat niet past, scrolt. */
export const SHEET_BODY_MAX_H = Math.round(H - 180);
/** 30 okt 2026 (operator: "maak de kaart zelf hoger, niet het tijdwiel"): de kaart is altijd royaal hoog (±¾ van het
 *  scherm); de onderdelen verdelen zich gelijkmatig over die hoogte. */
export const SHEET_BODY_MIN_H = Math.round(Math.min(SHEET_BODY_MAX_H, H * 0.7));

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
      <View style={rs.section}>
      {/* 30 okt 2026 (operator: "zet de cirkel eerst onder de dagdelen, en de scroll voor time eronder"). */}
      <Text style={rs.label}>Duration</Text>
      {/* Het blad mag de sleepbeweging over de cirkel niet afpakken (zelfde regel als bij de wielen). */}
      <View style={rs.dial} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}>
        {duration}
      </View>
      </View>
      <View style={rs.section}>
      <Text style={rs.label}>Time</Text>
      <TimeWheel
        key={timeKey}
        options={timeOptions}
        value={time}
        accent={accent}
        trackColor="rgba(255,255,255,0.4)"
        onChange={onTime}
        small
      />
      </View>
    </View>
  );
}

const rs = StyleSheet.create({
  /* Vult de hoogte van de kaart; Duration en Time verdelen de ruimte gelijkmatig. */
  wrap: { alignSelf: 'stretch', flexGrow: 1, justifyContent: 'space-evenly' },
  section: { paddingVertical: 8 },
  /* 30 okt 2026 (operator: "time en duration duidelijker in het wit"). */
  label: {
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  labelGap: { marginTop: 32, marginBottom: 10 },
  dial: { alignItems: 'center' },
});
