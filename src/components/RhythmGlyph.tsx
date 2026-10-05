/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — het ritme van een techniek, als beeldje

   Operator, 5 okt 2026: de techniek-iconen waren vier standaard-lucide-
   tekens voor vijftien technieken ("1:2" en "Slow" deelden hetzelfde). Dit
   tekent het ritme zelf, rechtstreeks uit de ademdata: één staafje per fase,
   hoogte = aantal seconden. Ademen (in/uit) is vol, vasthouden is gedimd.
   Zo is elk beeldje uniek per techniek en altijd waar — niets verzonnen.
   ───────────────────────────────────────────────────────────────────────── */

import type { PhaseDef } from '@/data/breath-states';
import { StyleSheet, View } from 'react-native';

export function RhythmGlyph({
  phases,
  color = '#ffffff',
  height = 22,
}: {
  phases: Pick<PhaseDef, 'key' | 'secs'>[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...phases.map((p) => p.secs));
  return (
    <View style={[s.row, { height }]} accessibilityElementsHidden importantForAccessibility="no">
      {phases.map((p, i) => {
        const hold = p.key.startsWith('hold');
        return (
          <View
            key={`${p.key}-${i}`}
            style={[
              s.bar,
              {
                height: Math.max(4, Math.round((p.secs / max) * height)),
                backgroundColor: color,
                opacity: hold ? 0.35 : 1,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 4, borderRadius: 2 },
});
