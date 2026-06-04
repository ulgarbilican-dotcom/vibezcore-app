/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — BraceletActivationCta

   Iter 9dq v92 (2026-06-03): activatie-prompt strip die bovenaan de
   bracelet-control page verschijnt zolang een bracelet-owner zijn
   12-char activation-code nog niet heeft ingevoerd.

   Operator-rationale: "klant moet zelf activeren na sign-up. zolang de
   bracelet niet gelinkt is, ook een knop of link met 'activate your
   bracelet' op de control-page". De CTA is duidelijk maar onderbreekt
   de preview niet — gebruiker kan rondkijken vóór activatie.

   Visueel:
     - Accent-blauwe achtergrond-tint (brand-blue) — actie-affordance
     - "Activate your bracelet" + 1-regel sub-uitleg + chevron
     - Volledige row pressable → /activate-bracelet

   Render alleen wanneer (isBraceletOwner && !isActivated). De parent
   doet die check; deze component is "dom".
   ─────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function BraceletActivationCta() {
  return (
    <Pressable
      style={s.row}
      onPress={() => router.navigate('/activate-bracelet' as never)}
      accessibilityLabel="Activate your bracelet with a code"
      android_ripple={{ color: 'rgba(58,143,255,0.10)' }}
    >
      <View style={s.left}>
        <Text style={s.title}>Activate your bracelet</Text>
        <Text style={s.sub}>
          Enter your 12-character code to link your bracelet
        </Text>
      </View>
      <Text style={s.arrow}>→</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(58, 143, 255, 0.10)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58, 143, 255, 0.40)',
  },
  left: {
    flex: 1,
  },
  title: {
    color: Brand.accent,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  sub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  arrow: {
    color: Brand.accent,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
  },
});
