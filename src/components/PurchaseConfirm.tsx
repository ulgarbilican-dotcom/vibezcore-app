/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — bevestiging na een aankoop of activering (22 okt 2026, operator:
   "alle info mooi in één kaart met een witte lichtbron erachter — geldt voor alle
   bevestigingen van aankopen").

   Eén uiterlijk voor Premium/dagpas (subscribe.tsx) en bracelet-activering
   (activate-bracelet.tsx): één donkere glazen kaart met een zachte witte
   lichtbron erachter, daaronder de glazen pil-CTA (zelfde als de rest van de app).
   ───────────────────────────────────────────────────────────────────────── */

import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import BalancedText from '@/components/BalancedText';
import PressScale from '@/components/PressScale';
import { Brand, BrandFonts, CTA, CTA_GLOW } from '@/constants/theme';
import { SafeAreaView } from '@/utils/safe-area';

type Props = {
  title: string;
  subtitle?: string;
  perksTitle?: string;
  perks?: string[];
  footer?: string;
  ctaLabel: string;
  onCta: () => void;
  /** Extra regel onder de knop (bv. "Create a free account…"). */
  below?: ReactNode;
};

export default function PurchaseConfirm({
  title,
  subtitle,
  perksTitle,
  perks = [],
  footer,
  ctaLabel,
  onCta,
  below,
}: Props) {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.wrap}>
        {/* De lichtbron: wit licht dat achter de kaart vandaan schijnt. */}
        <View style={s.card}>
          <View style={s.check}>
            <Text style={s.checkTxt}>✓</Text>
          </View>
          <BalancedText style={s.title}>{title}</BalancedText>
          {subtitle ? <BalancedText style={s.subtitle}>{subtitle}</BalancedText> : null}

          {perks.length > 0 ? (
            <View style={s.perks}>
              {perksTitle ? <Text style={s.perksTitle}>{perksTitle}</Text> : null}
              {perks.map((line) => (
                <BalancedText key={line} style={s.perkLine}>
                  {`· ${line}`}
                </BalancedText>
              ))}
            </View>
          ) : null}

          {footer ? <BalancedText style={s.footer}>{footer}</BalancedText> : null}
        </View>

        <PressScale haptic scaleTo={0.97} onPress={onCta} style={s.ctaWrap} accessibilityRole="button" accessibilityLabel={ctaLabel}>
          <View style={s.cta}>
            <Text style={CTA.label}>{ctaLabel}</Text>
          </View>
        </PressScale>

        {below}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  card: {
    alignSelf: 'center',
    maxWidth: 420,
    width: '100%',
    alignItems: 'center',
    borderRadius: 28,
    backgroundColor: '#1c1c20',
    paddingVertical: 30,
    paddingHorizontal: 24,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 44,
    elevation: 16,
  },
  check: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderColor: 'rgba(74,222,128,0.4)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTxt: { color: Brand.success, fontSize: 28, fontFamily: BrandFonts.extrabold, lineHeight: 32 },
  title: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    textAlign: 'center',
    marginTop: 6,
  },
  perks: {
    alignSelf: 'stretch',
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  perksTitle: { color: Brand.text, fontSize: 14, fontFamily: BrandFonts.semibold, letterSpacing: 0.1, marginBottom: 10 },
  perkLine: { color: Brand.textDim, fontSize: 13.5, fontFamily: BrandFonts.regular, letterSpacing: 0.05, marginBottom: 4, lineHeight: 20 },
  footer: {
    marginTop: 18,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11.5,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    textAlign: 'center',
    lineHeight: 16,
  },
  ctaWrap: { alignSelf: 'center', maxWidth: 420, width: '100%', marginTop: 28, borderRadius: 999, backgroundColor: '#34343a', ...CTA_GLOW },
  cta: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
