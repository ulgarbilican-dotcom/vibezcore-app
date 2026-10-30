/* Kop van het blad waarin je een geplande sessie aanpast (operator, 30 okt 2026: "zet op de popup ook de naam van de
   sessie die aangepast wordt"): de toestand in zijn kleur, de techniek eronder, Done rechts (onderblad-protocol).
   Gedeeld door de breathwork-agenda, "Your plan", "Your protocol" en de State Control-agenda. */
import { StyleSheet, Text, View } from 'react-native';
import Tap from '@/components/Tap';
import { BrandFonts } from '@/constants/theme';

export default function SessionSheetHeader({
  title,
  subtitle,
  accent,
  onDone,
}: {
  title: string;
  subtitle?: string;
  accent: string;
  onDone: () => void;
}) {
  return (
    <View style={hs.row}>
      <View style={[hs.dot, { backgroundColor: accent }]} />
      {/* Toestand en techniek op één regel (operator, 30 okt 2026: "de techniek kan naast de statenaam"). */}
      <Text style={[hs.title, { flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {title.toUpperCase()}
        {subtitle ? <Text style={hs.sub}>{'  ·  '}{subtitle}</Text> : null}
      </Text>
      <Tap onPress={onDone} hitSlop={12} accessibilityRole="button" accessibilityLabel="Done">
        <Text style={hs.done}>Done</Text>
      </Tap>
    </View>
  );
}

const hs = StyleSheet.create({
  /* 30 okt 2026 (operator: "het hoeft niet zo dicht op elkaar"): royale ruimte onder de kop. */
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 6, marginBottom: 22, gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { fontFamily: BrandFonts.extrabold, fontSize: 20, letterSpacing: 0.4, color: '#ffffff' },
  sub: { fontFamily: BrandFonts.medium, fontSize: 16, letterSpacing: 0, color: 'rgba(255,255,255,0.6)' },
  done: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#ffffff', paddingVertical: 8, paddingLeft: 12 },
});
