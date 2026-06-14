/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Store-logo's (Apple App Store + Google Play)

   Echte brand-logo's voor de "Billed by …"-trust-rij onder de paywall-CTA.
   Operator-keuze 2026-06-15: GEEN brand-neutrale Lucide icons meer, maar de
   herkenbare Apple-silhouet en Google Play 4-color triangle.

   Brand-guidelines:
   - Apple logo wordt monochroom getekend (zwart of wit). Wij gebruiken wit
     op donkere achtergrond — matcht Apple's eigen "Sign in with Apple" en
     "Download on the App Store"-badges op donkere themes.
   - Google Play triangle gebruikt de 4 brand-kleuren (cyan/groen/geel/rood).
     Wij benaderen deze kleuren — exacte hex-codes van Google's officiële
     badge zijn proprietary maar de gebruikte tinten zijn binnen de bekende
     marketing-range en herkenbaar.

   Beide componenten zijn pure SVG (geen text-render, geen network). Schalen
   netjes op alle resoluties. Size-prop is de outer width=height (square).
   ─────────────────────────────────────────────────────────────────────── */

import Svg, { Path } from 'react-native-svg';

type LogoProps = { size?: number };

export function AppleLogo({ size = 14 }: LogoProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

export function GooglePlayLogo({ size = 14 }: LogoProps) {
  /* 4 driehoeken met een gedeeld vouwpunt in (12,12). Layout volgt het
     officiële brand-pattern: cyan top-back, groen top-front, rood bottom-
     back, geel bottom-front. */
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      {/* Cyan — top, achter de vouw */}
      <Path d="M4 2 L12 12 L4 12 Z" fill="#00D7FE" />
      {/* Groen — top, vóór de vouw (de "tip"-helft) */}
      <Path d="M4 2 L22 12 L12 12 Z" fill="#00F076" />
      {/* Rood — bottom, achter de vouw */}
      <Path d="M4 22 L4 12 L12 12 Z" fill="#FF4757" />
      {/* Geel — bottom, vóór de vouw */}
      <Path d="M4 22 L12 12 L22 12 Z" fill="#FFCE00" />
    </Svg>
  );
}
