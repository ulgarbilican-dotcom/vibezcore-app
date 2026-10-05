/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — moeilijkheid als drie stipjes

   Operator, 5 okt 2026 ("een symbool dat moeilijkheid weergeeft i.p.v. de
   staafjes"): één gevuld = Beginner, twee = Intermediate, drie = Advanced.
   Leest meteen, zonder woord, en zegt per toestand ook hoe de drie
   technieken zich tot elkaar verhouden (ze lopen altijd op).
   ───────────────────────────────────────────────────────────────────────── */

import type { TechniqueDef } from '@/data/breath-states';
import { StyleSheet, View } from 'react-native';

const FILLED: Record<TechniqueDef['level'], number> = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
};

export function LevelDots({
  level,
  color = '#ffffff',
}: {
  level: TechniqueDef['level'];
  color?: string;
}) {
  const n = FILLED[level] ?? 1;
  return (
    <View style={s.row} accessibilityLabel={level}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            s.dot,
            i < n ? { backgroundColor: color } : { borderWidth: 1.2, borderColor: color, opacity: 0.45 },
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, height: 22, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});
