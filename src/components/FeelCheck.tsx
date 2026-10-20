/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "How do you feel now?" (zie utils/feel-checkin.ts)

   Drie gelijke knoppen, één tik, overslaan mag (gewoon Done). Na de keuze
   blijft je antwoord wit gemarkeerd en verschijnt een korte bevestiging —
   geen extra scherm, geen vraag erachteraan.
   ───────────────────────────────────────────────────────────────────────── */

import { BrandFonts } from '@/constants/theme';
import { recordFeel, type Feel, type FeelCheckin } from '@/utils/feel-checkin';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const OPTIONS: { feel: Feel; label: string }[] = [
  { feel: 'better', label: 'Better' },
  { feel: 'same', label: 'Same' },
  { feel: 'worse', label: 'Worse' },
];

export default function FeelCheck({ session }: { session: Omit<FeelCheckin, 'at' | 'feel'> }) {
  const [picked, setPicked] = useState<Feel | null>(null);
  return (
    <View style={s.wrap}>
      <Text style={s.label}>How do you feel now?</Text>
      <View style={s.row} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => {
          const on = picked === o.feel;
          return (
            <Pressable
              key={o.feel}
              disabled={picked !== null}
              onPress={() => {
                setPicked(o.feel);
                void Haptics.selectionAsync().catch(() => {});
                void recordFeel({ ...session, feel: o.feel });
              }}
              style={({ pressed }) => [s.chip, on && s.chipOn, pressed && { opacity: 0.7 }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: picked !== null && !on }}
              accessibilityLabel={o.label}
            >
              <Text style={[s.chipTxt, on && s.chipTxtOn, picked !== null && !on && s.chipTxtDim]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[s.thanks, picked === null && { opacity: 0 }]}>Noted. This helps tune your sessions.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'stretch' },
  label: { fontFamily: BrandFonts.semibold, fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    minWidth: 88,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipOn: { backgroundColor: '#ffffff' },
  chipTxt: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff' },
  chipTxtOn: { color: '#0a0a0a' },
  chipTxtDim: { color: 'rgba(255,255,255,0.55)' },
  thanks: { fontFamily: BrandFonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.5)', marginTop: 10 },
});
