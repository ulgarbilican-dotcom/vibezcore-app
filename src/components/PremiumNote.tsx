/* De regel onder een start-knop ("30 seconds of this rhythm. Full session with Premium"):
   tikbaar als het om de proef gaat, en opent dan het plannen-blad (22 okt 2026, operator).
   Is het de regel van de gratis volledige sessie, dan blijft het gewone tekst.
   23 okt 2026 (operator): het woord "Premium" staat als de Premium-knop bovenaan — glazen pil met kroon. */
import { Crown } from 'lucide-react-native';
import Tap from '@/components/Tap';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import PremiumPaywallModal from '@/components/PremiumPaywallModal';
import VibezGlass from '@/components/VibezGlass';
import { Brand, BrandFonts } from '@/constants/theme';

export default function PremiumNote({
  style,
  preview,
  context = 'breathwork',
  interactive = true,
  showPill = true,
  children,
}: {
  style: StyleProp<TextStyle>;
  /** true = proefregel (tikbaar, opent de plannen). */
  preview: boolean;
  context?: 'breathwork' | 'state-control' | 'audio';
  /** false = enkel tonen (bv. in een blad dat zelf al een koop-link heeft). */
  interactive?: boolean;
  /** 27 okt 2026 (operator: "bovenaan een Premium-pil en onderaan nog een"): staat de Premium-pil al bovenaan de pagina, dan is dit gewone tikbare tekst
   *  (het woord Premium vet), zonder tweede pil. */
  showPill?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!preview) return <Text style={style}>{children}</Text>;
  const text = typeof children === 'string' ? children : null;
  const m = text ? /^(.*?)\s*Premium$/.exec(text) : null;
  if (!m) {
    return (
      <>
        <Tap onPress={() => setOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="See Premium plans">
          <Text style={style}>{children}</Text>
        </Tap>
        <PremiumPaywallModal visible={open} onClose={() => setOpen(false)} context={context} />
      </>
    );
  }
  /* Marges/uitlijning van de oude tekststijl naar de rij; de rest blijft op de tekst. */
  const flat = StyleSheet.flatten(style) ?? {};
  /* Layout-eigenschappen (marges, minimumhoogte, opvulling) horen bij de RIJ, niet bij de tekst: anders staat de tekst
     bovenin een hoger vak terwijl de pil in het midden staat. */
  const { margin, marginTop, marginBottom, marginVertical, marginHorizontal, alignSelf, minHeight, paddingHorizontal, paddingVertical, padding, lineHeight, ...textStyle } =
    flat as Record<string, unknown>;
  const rowStyle = { margin, marginTop, marginBottom, marginVertical, marginHorizontal, alignSelf, minHeight, paddingHorizontal, paddingVertical, padding } as object;
  void lineHeight;
  if (!showPill) {
    const plain = (
      <Text style={[textStyle as TextStyle, rowStyle as TextStyle, { textAlign: 'center' }]}>
        {m[1]} <Text style={{ fontFamily: BrandFonts.semibold, color: Brand.text }}>Premium</Text>
      </Text>
    );
    if (!interactive) return plain;
    return (
      <>
        <Tap onPress={() => setOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="See Premium plans">
          {plain}
        </Tap>
        <PremiumPaywallModal visible={open} onClose={() => setOpen(false)} context={context} />
      </>
    );
  }
  const row = (
    <View style={[s.row, rowStyle]}>
      <Text style={[textStyle as TextStyle, { flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {m[1]}
      </Text>
      <VibezGlass radius={999} style={s.pill}>
        <Crown size={12} color={Brand.text} strokeWidth={2.2} />
        <Text style={s.pillTxt}>Premium</Text>
      </VibezGlass>
    </View>
  );
  if (!interactive) return row;
  return (
    <>
      <Tap onPress={() => setOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="See Premium plans">
        <View style={[s.row, rowStyle]}>
          <Text style={[textStyle as TextStyle, { flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {m[1]}
          </Text>
          <VibezGlass radius={999} style={s.pill}>
            <Crown size={12} color={Brand.text} strokeWidth={2.2} />
            <Text style={s.pillTxt}>Premium</Text>
          </VibezGlass>
        </View>
      </Tap>
      <PremiumPaywallModal visible={open} onClose={() => setOpen(false)} context={context} />
    </>
  );
}

const s = StyleSheet.create({
  /* Eén lijn: tekst en pil naast elkaar, nooit afgebroken (de tekst krimpt eventueel mee). */
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'nowrap', alignSelf: 'stretch', paddingHorizontal: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4 },
  pillTxt: { color: Brand.text, fontFamily: BrandFonts.semibold, fontSize: 12, letterSpacing: 0.3 },
});
