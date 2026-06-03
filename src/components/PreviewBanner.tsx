/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — PreviewBanner

   Smal, oranje banner-stripje dat bovenaan een scherm verschijnt om te
   communiceren dat de getoonde ervaring een PREVIEW is en het echte
   product (de Smart Bead Bracelet) nog niet geleverd is — Kickstarter
   launch 1 augustus 2026 per CLAUDE.md §3 + SPEC.

   Gebruikt op alle bracelet-gerelateerde schermen (Bracelet-tab,
   Bracelet-control, Bracelet-history). NIET op audio-schermen — audio
   is echt en werkend.

   Visueel:
     - Smal (28px) horizontaal banner
     - Oranje achtergrond (Brand.warning equivalent)
     - Centered "PREVIEW" tekst + optionele sub-regel
     - Geen interactie — puur informatief

   Iter 9dq v79 (2026-06-03, operator-keuze): vervangt staat-afhankelijke
   "paired and ready"-copy met een eerlijke globale indicator. Eenvoudiger
   te onderhouden + zet correcte verwachtingen voor pre-launch testers
   en vroege bracelet-kopers wier hardware nog niet is verzonden.
   ─────────────────────────────────────────────────────────────────── */

import { BrandFonts } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  /** Optionele uitleg-regel. Default 'Bracelet ships Summer 2026'. */
  subtitle?: string;
};

export function PreviewBanner({
  subtitle = 'Bracelet ships Summer 2026',
}: Props) {
  return (
    <View style={s.banner}>
      <Text style={s.label}>PREVIEW</Text>
      <Text style={s.sep}>·</Text>
      <Text style={s.subtitle}>{subtitle}</Text>
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
