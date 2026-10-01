/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — PreviewPill

   Kleine, neutrale badge die communiceert dat de getoonde ervaring een
   PREVIEW is (het echte product, de Smart Bead Bracelet, is nog niet
   geleverd — Kickstarter launch Fall 2026). Vervangt de oudere, volle-
   breedte oranje `PreviewBanner` — operator, 16 september 2026 (op
   bracelet-control) en 17 september 2026 (ook op de Bracelet-tab zelf,
   "bovenaan ook tekst preview zoals in bracelet control, niet in gele
   strip"): geen kleur die om aandacht schreeuwt, gewoon een subtiele,
   gecentreerde badge.
   ─────────────────────────────────────────────────────────────────────── */

import { BrandFonts } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

export function PreviewPill() {
  return (
    <View style={s.wrap}>
      <View style={s.pill}>
        <Text style={s.text}>PREVIEW</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  pill: {
    backgroundColor: 'rgba(10,10,12,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(10,10,12,0.10)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  text: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.6,
  },
});
