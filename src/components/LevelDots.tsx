/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — moeilijkheid als drie stipjes

   Operator, 5 okt 2026 ("een symbool dat moeilijkheid weergeeft i.p.v. de
   staafjes"): één gevuld = Beginner, twee = Intermediate, drie = Advanced.
   Vervolg ("zijn die dotjes modern?"): geen stipjes met lege ringetjes meer
   maar een kleine segmentbalk — drie korte afgeronde streepjes, leeg = zacht
   grijs vlak. Strakker, en dezelfde streepjes-taal als de duurliniaal.
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
            { backgroundColor: i < n ? color : 'rgba(255,255,255,0.14)' },
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3, height: 22, alignItems: 'center' },
  dot: { width: 12, height: 4, borderRadius: 2 },
});
