/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — zachte accountuitnodiging op Activity (zie utils/account-invite.ts).

   Tekst door de operator bepaald (28 okt 2026). Geen belofte buiten wat Backup & Sync echt doet (instellingen, rusthartslag,
   ademhistoriek en plan — NIET de geschiedenis van State Control-sessies), en geen medische of wetenschappelijke claim.
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
      <Text style={s.title}>Save your progress</Text>
      <Text style={s.body}>Create a free account to back up your plan and sessions. Restore them if you reinstall the app or lose your phone.</Text>
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
      <Tap onPress={dismiss} hitSlop={10} style={s.later} accessibilityRole="button" accessibilityLabel="Maybe later">
        <Text style={s.laterTxt}>Maybe later</Text>
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
  title: { fontFamily: BrandFonts.bold, fontSize: 17, lineHeight: 22, color: BrandDark.text },
  body: { fontFamily: BrandFonts.medium, fontSize: 15, lineHeight: 21, color: ink(0.72), marginTop: 6 },
  cta: { marginTop: 14 },
  later: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  laterTxt: { fontFamily: BrandFonts.semibold, fontSize: 14, color: ink(0.55) },
});
