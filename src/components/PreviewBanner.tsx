/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — PreviewBanner

   Smal, oranje banner-stripje dat bovenaan een scherm verschijnt om te
   communiceren dat de getoonde ervaring een PREVIEW is en het echte
   product (de Smart Bead Bracelet) nog niet geleverd is — Kickstarter
   launch Fall 2026 (operator 2026-07-14 — geen concrete datum meer).

   Gebruikt op alle bracelet-gerelateerde schermen (Bracelet-tab,
   Bracelet-control, Bracelet-history). NIET op audio-schermen — audio
   is echt en werkend.

   Visueel:
     - Smal (28px) horizontaal banner
     - Oranje achtergrond (Brand.warning equivalent)
     - Centered "PREVIEW" tekst + optionele sub-regel
     - Geen interactie — puur informatief

   Iter v177 (2026-07-02): shipping-subtitle verwijderd op operator-verzoek.
   Alleen "PREVIEW" tonen zodat het duidelijk is dat het een preview is,
   zonder shipping-informatie of andere claim. Props.subtitle blijft
   optioneel behouden voor eventueel toekomstig gebruik. */

import { BrandFonts } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  /** Optionele uitleg-regel. Standaard leeg — enkel "PREVIEW". */
  subtitle?: string;
};

export function PreviewBanner({ subtitle }: Props) {
  return (
    <View style={s.banner}>
      <Text style={s.label}>PREVIEW</Text>
      {subtitle ? (
        <>
          <Text style={s.sep}>·</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(245, 158, 11, 0.40)',
  },
  label: {
    color: '#f59e0b',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
  },
  sep: {
    color: 'rgba(245, 158, 11, 0.50)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
  },
  subtitle: {
    color: 'rgba(245, 158, 11, 0.85)',
    fontSize: 11,
    fontFamily: BrandFonts.medium,
  },
});
