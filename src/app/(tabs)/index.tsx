/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Audio tab

   Uiterlijk volgens MERK_ANKER: Inter-font (centraal geladen in _layout.tsx),
   kleurpalet uit `Brand`, echt VIBEZCORE-wordmark uit `assets/`. Teksten
   ONGEWIJZIGD t.o.v. de placeholder — inhoud blijft operator-beslissing,
   alleen de look is bijgewerkt. Guest-first, grootste content-sectie
   (structuur §4).
   ─────────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AudioScreen() {
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Image
          source={require('../../../assets/vibezcore_wordmark.png')}
          style={s.wordmark}
          resizeMode="contain"
          accessibilityLabel="VIBEZCORE"
        />
        <Text style={s.subtitle}>AUDIO LIBRARY</Text>

        <View style={s.card}>
          <Text style={s.cardH}>Library coming in the next build</Text>
          <Text style={s.cardBody}>
            The full audio library — free sessions playable without an
            account, premium sessions visible with an unlock prompt — is the
            next code round. This tab is in place so the navigation and
            guest-first flow are complete.
          </Text>
        </View>

        <Text style={s.note}>
          Guest-first: anyone can browse and play free sessions here without
          an account. Account / upgrade lives in the Account tab.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 24, paddingBottom: 56 },
  wordmark: {
    width: 200,
    height: 34,
    marginTop: 20,
  },
  subtitle: {
    color: Brand.accent,
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    marginTop: 10,
    marginBottom: 28,
  },
  card: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 22,
  },
  cardH: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.extrabold,
    marginBottom: 12,
  },
  cardBody: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 23,
  },
  note: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    marginTop: 24,
    opacity: 0.7,
  },
});
