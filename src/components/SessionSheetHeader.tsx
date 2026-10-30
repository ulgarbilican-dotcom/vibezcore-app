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
      <View style={{ flex: 1 }}>
        <Text style={hs.title} numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
        {subtitle ? (
          <Text style={hs.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Tap onPress={onDone} hitSlop={12} accessibilityRole="button" accessibilityLabel="Done">
        <Text style={hs.done}>Done</Text>
      </Tap>
    </View>
  );
}

const hs = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 4, marginBottom: 14, gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { fontFamily: BrandFonts.extrabold, fontSize: 20, letterSpacing: 0.4, color: '#ffffff' },
  sub: { fontFamily: BrandFonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  done: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#ffffff', paddingVertical: 8, paddingLeft: 12 },
});
