/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — StateGlyph

   Operator, 18 september 2026 ("de getoonde symbolen... voelen nog te veel
   aan als generieke internet-icoontjes... Apple SF Symbols-benadering"):
   vervangt de foto-thumbnails (`STATE_PHOTOS`) op de Breath-tab se
   "Choose your state"-rij door 5 eigen, abstracte lijn-iconen — geen
   letterlijke illustraties (vlam, diamant, zon, maan) meer, maar
   meetkundige vormen met EXACT dezelfde lijndikte, puur `stroke`-gebaseerd
   (op de gevulde middenstip van Sharp Focus na).
   Operator, 21 september 2026 ("boost icoon moet bliksem zijn"): Boost
   herroept dat bewust — een letterlijke, gevulde bliksemvorm i.p.v. de
   abstracte bogen. Tweede uitzondering op de stroke-only regel, naast
   Sharp Focus se middenstip.

   Bewust GEEN afbeeldingen/SVG-bestanden: vijf simpele `react-native-svg`
   `Path`/`Circle`-tekeningen in een gedeeld 24×24-coördinatenstelsel,
   dezelfde aanpak als de rest van de app (breath-setup.tsx's ring, enz.)
   — geen nieuwe asset-pijplijn nodig, en de kleur/dikte is nu precies zo
   consistent als de operator vroeg. */

import Svg, { Circle, Path } from 'react-native-svg';
import type { BreathStateKey } from '@/data/breath-states';

type Props = {
  stateKey: BreathStateKey;
  size: number;
  color: string;
  strokeWidth?: number;
};

export default function StateGlyph({ stateKey, size, color, strokeWidth = 1.8 }: Props) {
  const common = { stroke: color, strokeWidth, fill: 'none' as const, strokeLinecap: 'round' as const };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {stateKey === 'boost' && (
        /* Operator, 21 september 2026 ("boost icoon moet bliksem zijn"):
           vervangt de drie bogen hierboven (die bewust GEEN vlam waren,
           18 september) — nu wél een letterlijke, herkenbare bliksemvorm.
           Gevuld i.p.v. omlijnd, zelfde uitzondering op de stroke-only
           regel als Sharp Focus se gevulde middenstip. */
        <Path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" fill={color} stroke="none" />
      )}

      {stateKey === 'focus' && (
        /* Bullseye — dunne cirkel + massieve middenstip, geen diamant. */
        <>
          <Circle cx={12} cy={12} r={7.5} {...common} />
          <Circle cx={12} cy={12} r={1.6} fill={color} stroke="none" />
        </>
      )}

      {stateKey === 'calm' && (
        /* Vloeiende, doorlopende lus (lemniscaat/oneindig) — perfecte
           in-/uitademingscyclus, geen platte sinusgolven. */
        <Path
          d="M12 12c0-2 -1.8-3.6-3.6-3.6S4.8 10 4.8 12s1.8 3.6 3.6 3.6S12 14 12 12c0-2 1.8-3.6 3.6-3.6S19.2 10 19.2 12s-1.8 3.6-3.6 3.6S12 14 12 12"
          {...common}
        />
      )}

      {stateKey === 'clarity' && (
        /* Rimpeling van 3 concentrische cirkels, opacity neemt af naar
           buiten — helderheid, geen zon met stralen. */
        <>
          <Circle cx={12} cy={12} r={2.6} {...common} />
          <Circle cx={12} cy={12} r={5.4} {...common} opacity={0.6} />
          <Circle cx={12} cy={12} r={8.2} {...common} opacity={0.32} />
        </>
      )}

      {stateKey === 'rest' && (
        /* Brede, zacht dalende kom-curve — een diepe, kalme uitademing,
           geen halve maan. */
        <Path d="M4.5 9c1.6 5.4 5 8.2 7.5 8.2s5.9-2.8 7.5-8.2" {...common} />
      )}
    </Svg>
  );
}
