/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — glas (eigen materiaal)

   Operator, 5 okt 2026: "ons materiaal, maar Apple's Liquid Glass is de
   referentie" — en uitdrukkelijk GEEN rand ("zo'n rand vind ik niet
   mooi"). Niet Apple's systeemmateriaal, maar dezelfde opbouw van het
   gevoel, in drie lagen binnen één afgeronde vorm:
     1. vervaging van wat eronder ligt (echte BlurView, geen nep-glas —
        zie memory feedback-real-blurview-not-fake-glass),
     2. een donkere tint (+ optioneel een vleugje toestandskleur) zodat
        tekst erop leesbaar blijft,
     3. een glanslaag BINNENIN: bovenaan een zachte lichte waas die naar
        onderen uitdooft — licht dat op het glas valt, geen lijn.
   Eén plek, zodat het overal hetzelfde materiaal is.
   ───────────────────────────────────────────────────────────────────────── */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  /** Hoekafronding van de vorm (999 = pil/cirkel). */
  radius: number;
  /** Optionele kleurtoets, bv. de kleur van de lopende toestand. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export default function VibezGlass({ radius, tint, style, children }: Props) {
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={32}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        /* Lichter dan zwart: op een donkere ondergrond moet het glas als
           vlak zichtbaar blijven (zoals Apple's glas op dark iets lichter
           oogt dan zijn omgeving); op een lichte foto dempt het nog genoeg
           voor leesbare tekst. */
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(58,58,66,0.34)' }]}
      />
      {tint ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: `${tint}1F` }]}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.17)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
