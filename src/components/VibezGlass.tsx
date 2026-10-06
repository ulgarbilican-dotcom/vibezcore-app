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
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  /** Hoekafronding van de vorm (999 = pil/cirkel). */
  radius: number;
  /** Optionele kleurtoets, bv. de kleur van de lopende toestand. */
  tint?: string;
  /** Apple-principe bij keuzes (operator, 5 okt 2026): de gekozen optie is
   *  lichter glas en "zweeft" boven de rest, niet-gekozen opties zijn
   *  doorzichtiger. 'normal' = gewone secundaire knop. */
  level?: 'subtle' | 'normal' | 'raised' | 'sheet';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Android: verwijzing naar de `BlurTargetView` met wat eronder ligt.
   *  Zonder deze valt expo-blur op Android terug op géén vervaging; mét
   *  deze is het echte vervaagd glas (5 okt 2026). iOS heeft hem niet nodig. */
  blurTarget?: RefObject<View | null>;
};

const LEVEL = {
  subtle: { base: 'rgba(58,58,66,0.16)', sheen: 0.09, blur: 32 },
  normal: { base: 'rgba(58,58,66,0.34)', sheen: 0.17, blur: 32 },
  raised: { base: 'rgba(96,96,106,0.42)', sheen: 0.26, blur: 32 },
  /* Uitschuifpaneel met veel tekst: de foto schemert door, maar donker
     genoeg om lange tekst rustig te lezen (Apple's "thick material"). */
  /* Sterkere vervaging (operator, 5 okt 2026: "verwarrend als de
     achtergrond doorkomt?"): van de foto blijft enkel een zachte
     kleurgloed over, geen herkenbare vormen achter de tekst. */
  sheet: { base: 'rgba(20,20,24,0.74)', sheen: 0.07, blur: 90 },
} as const;

/* Android vervaagt zonder `blurTarget` nog niet echt (expo-blur valt dan
   terug op "none" — zie de waarschuwing in de Metro-log). Een paneel met
   lange tekst wordt daar dus bijna dekkend, anders lees je de pagina erachter
   door de tekst heen (operator, 5 okt 2026, info-popup op de setup).
   Weg te halen zodra de echte vervaging op Android werkt. */
const ANDROID_SHEET_BASE = 'rgb(24,24,28)';

export default function VibezGlass({ radius, tint, level = 'normal', style, children, blurTarget }: Props) {
  const L =
    level === 'sheet' && Platform.OS === 'android' && !blurTarget
      ? { ...LEVEL.sheet, base: ANDROID_SHEET_BASE }
      : level === 'sheet' && blurTarget
        ? /* Echte vervaging (GlassSheetHost, 7 okt 2026): dunnere tint, zodat
             het glas zichtbaar is — de vervaging zelf houdt tekst leesbaar. */
          { ...LEVEL.sheet, base: 'rgba(20,20,24,0.16)', blur: 70 }
        : LEVEL[level];
  /* expo-blur (Android) stelt het glas in bij de EERSTE weergave, nog vóór
     het weet wat zijn blurTarget is; het valt dan terug op een egale grijze
     kleur en zet de vervaging daarna niet meer aan (7 okt 2026: "na
     herladen is het glas weg"). Daarom: eerst zonder vervaging tekenen en
     ze pas inschakelen zodra de target gekoppeld is — de wissel van
     blurMethod laat expo-blur alles opnieuw en goed instellen. */
  const [armed, setArmed] = useState(!blurTarget);
  useEffect(() => {
    if (!blurTarget) return;
    const t = setTimeout(() => setArmed(true), 80);
    return () => clearTimeout(t);
  }, [blurTarget]);
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={L.blur}
        /* Echte vervaging (blurTarget): de dunste donkere tint — op Android
           legt "dark" zelf al ~62% grijs over het glas, samen met onze
           eigen laag werd dat dekkend (operator, 7 okt 2026: "helemaal
           niet transparant"). */
        tint={blurTarget && armed ? 'systemUltraThinMaterialDark' : 'dark'}
        blurMethod={armed ? 'dimezisBlurViewSdk31Plus' : 'none'}
        blurTarget={blurTarget}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        /* Lichter dan zwart: op een donkere ondergrond moet het glas als
           vlak zichtbaar blijven (zoals Apple's glas op dark iets lichter
           oogt dan zijn omgeving); op een lichte foto dempt het nog genoeg
           voor leesbare tekst. */
        style={[StyleSheet.absoluteFill, { backgroundColor: L.base }]}
      />
      {tint ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: `${tint}1F` }]}
        />
      ) : null}
      {level === 'sheet' && blurTarget ? (
        /* Onderaan dieper glas (operator, 7 okt 2026: "onderaan is de tekst
           niet leesbaar door de witte CTA erachter") — kleine lettertjes
           staan onderaan, en daar ligt in de app vaak een witte knop. */
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(12,12,15,0)', 'rgba(12,12,15,0.35)', 'rgba(12,12,15,0.72)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(255,255,255,${L.sheen})`, `rgba(255,255,255,${L.sheen * 0.3})`, 'rgba(255,255,255,0)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
