/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — BraceletIcon

   Operator, 18 september 2026 ("verander bracelet icoon in tablat naar
   minimalistische bracelet icoon" → vervolg: "moderner en eleganter"):
   lucide-react-native heeft geen bracelet-icoon — `Watch` (een horloge)
   stond er tot nu toe als benadering. Eigen minimalistisch lijn-icoon:
   een open band (cuff-bracelet, opening bovenaan) met drie kleine
   kraaltjes onderaan — verwijst naar het "Smart Bead Bracelet"-product
   zonder een letterlijk horloge te tonen.

   De eerste versie gebruikte losse, "getypte" coördinaten voor de opening
   en de kraaltjes, wat scheef/organisch oogde i.p.v. strak. Deze versie is
   wiskundig symmetrisch rond de verticale as (zelfde cirkel, middelpunt
   (12,13), straal 8 — opening exact gecentreerd bovenaan, kraaltjes exact
   gecentreerd onderaan), wat het strakkere "SF Symbols"-gevoel geeft dat
   de rest van de iconenset (`StateGlyph.tsx`) ook heeft.

   Zelfde aanpak als `StateGlyph.tsx`: puur `react-native-svg`, geen los
   asset-bestand, drop-in compatibel met de `LucideIcon`-props
   (`size`/`color`/`strokeWidth`) die `TabGlyph` al doorgeeft. */

import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export default function BraceletIcon({ size = 24, color = '#ffffff', strokeWidth = 1.8 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Open band — cuff-bracelet met een symmetrisch gecentreerde opening
         bovenaan (35° aan weerszijden van de top), geen gesloten cirkel
         (dat zou als ring/horloge lezen). */}
      <Path
        d="M16.59 6.45A8 8 0 1 1 7.41 6.45"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
      {/* Drie kraaltjes, symmetrisch geclusterd onderaan de band — de
         "bead bracelet". */}
      <Circle cx={18.93} cy={17} r={1.15} fill={color} stroke="none" />
      <Circle cx={12} cy={21} r={1.15} fill={color} stroke="none" />
      <Circle cx={5.07} cy={17} r={1.15} fill={color} stroke="none" />
    </Svg>
  );
}
