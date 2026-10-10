/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bevestigingskaart (glas, zelfde vorm als State Control's
   "Switch to …?"-kaart in bracelet-control.tsx)

   Audit 10 okt 2026: gedeeld zodat elke bevestiging in de app er hetzelfde
   uitziet — nooit Alert.alert (zie de huisstijl-regel voor pop-ups).
   `destructive` = de knop zegt iets wat je niet terugdraait; de knop blijft
   wit (CTA-regel), enkel de tekst wordt rood.
   ───────────────────────────────────────────────────────────────────────── */

import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import PressScale from '@/components/PressScale';
import VibezGlass from '@/components/VibezGlass';
import { Brand, BrandFonts } from '@/constants/theme';

export default function ConfirmCard({
  visible,
  title,
  body,
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onCancel}>
        <Pressable style={s.card} onPress={() => {}}>
          <VibezGlass radius={22} level="sheet" style={StyleSheet.absoluteFill} />
          <Text style={s.title}>{title}</Text>
          <Text style={s.body}>{body}</Text>
          <PressScale style={s.btn} haptic scaleTo={0.97} onPress={onConfirm} accessibilityLabel={confirmLabel}>
            <Text style={[s.btnTxt, destructive && { color: Brand.error }]}>{confirmLabel}</Text>
          </PressScale>
          <Pressable onPress={onCancel} hitSlop={10} style={s.cancel} accessibilityLabel="Cancel">
            <Text style={s.cancelTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 28 },
  card: {
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
  },
  title: { color: '#ffffff', fontSize: 20, fontFamily: BrandFonts.extrabold, letterSpacing: -0.3, textAlign: 'center' },
  body: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  btn: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: { color: '#1D1D1F', fontSize: 16, fontFamily: BrandFonts.bold, letterSpacing: -0.1 },
  cancel: { alignSelf: 'center', marginTop: 14, paddingVertical: 4 },
  cancelTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontFamily: BrandFonts.semibold },
});
