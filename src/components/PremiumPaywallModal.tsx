/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Premium-popup (gedeeld)

   Losgetrokken uit breath-session.tsx (operator, 13 augustus 2026): één
   component, meerdere schermen die 'm aanroepen. Wie sluit, staat gewoon
   weer op het scherm waar hij al was.

   GEWIJZIGD 7 okt 2026 (operator: "de popup-saleskaarten zijn een helemaal
   andere stijl en info"):
   - donker VIBEZCORE-glas dat van onderen opschuift, zoals de andere sheets
     (was een witte kaart met lichtblauw — van vóór dark-only);
   - de prijzen zijn EXACT de abonnementskaart van /subscribe
     (MembershipPlans) — één prijskaart in de hele app, met Apple 3.1.2
     (het afgeschreven bedrag het grootst, proef + verlenging bij de knop);
   - de bracelet-regel ("price locked … not €Y") is weg: een hardware-
     belofte met 'was'-prijs hoort niet in een abonnement.
   Na de knop slaat /subscribe de plankeuze over (tier zit in de link).
   ───────────────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioAccent, BrandFonts } from '@/constants/theme';
import MembershipPlans from '@/components/MembershipPlans';
import VibezGlass from '@/components/VibezGlass';
import { GlassSheet } from '@/components/GlassSheetHost';
import { rootBlurRef } from '@/utils/root-blur';
import { showVibezAlert } from '@/components/VibezAlert';
import { restorePurchases } from '@/services/restore-purchases';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Waar de popup opengaat — bepaalt de eyebrow, de volgorde van de
   *  voordelen en waar de gebruiker na aankoop terugkomt. Het pakket zelf
   *  is overal hetzelfde (operator, 5 okt 2026). */
  context?: PaywallContext;
};

export type PaywallContext = 'breathwork' | 'state-control' | 'audio';

/** Voordelen in volgorde van relevantie: het eigen product eerst. Operator,
 *  1 okt 2026: 64 = 15 technieken × hun benoemde duur-varianten. */
function benefitLines(context: PaywallContext): string[] {
  const stateControl = [
    'State Control — every haptic state, any duration',
    'Keeps running with your screen locked',
  ];
  const breathwork = [
    'All 64 guided sessions — five states, every rhythm and duration',
    'Voice, haptic and visual guidance',
    'Soundscapes, goals and your daily plan',
  ];
  const audio = [
    'Every Audio Library session across 4 pillars of growth',
    'New sessions added regularly',
  ];
  const stateControlIncluded = 'Full VIBEZCORE State Control included';
  const breathworkIncluded = 'Full VIBEZCORE Breathwork included';
  const audioIncluded = 'Full VIBEZCORE Audio Library included';
  if (context === 'state-control') return [...stateControl, breathworkIncluded, audioIncluded];
  if (context === 'audio') return [...audio, breathworkIncluded, stateControlIncluded];
  return [...breathwork, stateControlIncluded, audioIncluded];
}

export default function PremiumPaywallModal({ visible, onClose, context = 'breathwork' }: Props) {
  const insets = useSafeAreaInsets();
  const [restoring, setRestoring] = useState(false);

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.ok && result.restoredCount > 0) {
      onClose();
      void showVibezAlert({ title: 'Subscription restored', message: 'Everything is unlocked again.' });
    } else if (result.ok && result.accountMismatch) {
      void showVibezAlert({
        title: 'Active on your account, not on this device',
        message:
          `Your VIBEZCORE subscription is active, but the ${Platform.OS === 'ios' ? 'Apple ID' : 'Google Play account'} on this device doesn't show the purchase. Switch to the account you used to subscribe, then tap Restore Purchases again.`,
      });
    } else if (result.ok) {
      void showVibezAlert({
        title: 'Nothing to restore',
        message: 'No active subscriptions were found for this Apple ID or Google account.',
      });
    } else {
      void showVibezAlert({ title: 'Could not restore', message: 'Please check your connection and try again.' });
    }
  };

  return (
    /* In hetzelfde venster als de app (GlassSheetHost), zodat het glas op
       Android echt vervaagt wat erachter ligt — een Modal kan dat niet. */
    <GlassSheet visible={visible} onClose={onClose}>
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <VibezGlass
            radius={24}
            level="sheet"
            blurTarget={rootBlurRef}
            style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
          />
          <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }} accessibilityLabel="Close">
            <View style={s.grip} />
          </Pressable>
          <View style={s.head}>
            <Text style={s.eyebrow}>
              {context === 'state-control'
                ? 'VIBEZCORE STATE CONTROL'
                : context === 'audio'
                  ? 'VIBEZCORE AUDIO LIBRARY'
                  : 'VIBEZCORE BREATHWORK'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={s.done}>Done</Text>
            </Pressable>
          </View>

          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} bounces={false}>
            <Text style={s.title}>Unlock every session</Text>
            <View style={s.list}>
              {benefitLines(context).map((line) => (
                <View key={line} style={s.row}>
                  <View style={s.check}>
                    <Check size={11} color="#ffffff" strokeWidth={3.2} />
                  </View>
                  <Text style={s.rowTxt}>{line}</Text>
                </View>
              ))}
            </View>

            <MembershipPlans
              showHero={false}
              onContinue={(plan) => {
                onClose();
                router.push(`/subscribe?tier=${plan}&returnTo=${context}` as never);
              }}
              onRestore={() => void restore()}
            />
          </ScrollView>
        </View>
    </GlassSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    flexShrink: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  grip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  eyebrow: { fontFamily: BrandFonts.semibold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)' },
  done: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  title: { fontFamily: BrandFonts.bold, fontSize: 26, letterSpacing: -0.4, color: '#ffffff', marginTop: 6 },
  list: { marginTop: 14, marginBottom: 20, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: AudioAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rowTxt: { flex: 1, fontFamily: BrandFonts.medium, fontSize: 14.5, lineHeight: 20, color: 'rgba(255,255,255,0.88)' },
});
