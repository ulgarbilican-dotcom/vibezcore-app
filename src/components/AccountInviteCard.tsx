/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — zachte accountuitnodiging op Activity (zie utils/account-invite.ts).

   [TEKST] concept — de woorden hieronder zijn een voorstel; de operator mag ze herschrijven. Geen belofte buiten wat
   Backup & Sync echt doet (instellingen, doelen, rusthartslag, ademhistoriek en plan), en geen medische of wetenschappelijke claim.
   ───────────────────────────────────────────────────────────────────────────── */

import Tap from '@/components/Tap';
import { BrandDark, BrandFonts, CTA } from '@/constants/theme';
import { useAccountInvite } from '@/utils/account-invite';
import { goToTab } from '@/utils/state-control-ui';
import { StyleSheet, Text, View } from 'react-native';

const ink = (a: number) => `rgba(255,255,255,${a})`;

export default function AccountInviteCard() {
  const { show, dismiss } = useAccountInvite();
  if (!show) return null;
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>KEEP YOUR PROGRESS</Text>
      <Text style={s.body}>Create a free account and your sessions, plan and settings follow you to every device.</Text>
      <Tap
        onPress={() => {
          dismiss(); // telt als gezien; wie een account maakt ziet de kaart daarna sowieso niet meer
          goToTab('/account');
        }}
        scaleTo={0.97}
        style={[CTA.container, s.cta]}
        accessibilityRole="button"
        accessibilityLabel="Create free account"
      >
        <Text style={CTA.label}>Create free account</Text>
      </Tap>
      <Tap onPress={dismiss} hitSlop={10} style={s.later} accessibilityRole="button" accessibilityLabel="Not now">
        <Text style={s.laterTxt}>Not now</Text>
      </Tap>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ink(0.08),
    backgroundColor: ink(0.035),
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 6,
    marginBottom: 22,
  },
  eyebrow: { fontFamily: BrandFonts.bold, fontSize: 11, letterSpacing: 1.6, color: ink(0.4) },
  body: { fontFamily: BrandFonts.medium, fontSize: 15, lineHeight: 21, color: BrandDark.text, marginTop: 8 },
  cta: { marginTop: 14 },
  later: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  laterTxt: { fontFamily: BrandFonts.semibold, fontSize: 14, color: ink(0.55) },
});
