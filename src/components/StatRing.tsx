/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — StatRing

   Operator, 11 september 2026: "voorstander van ringen die vullen" — Apple
   Fitness-stijl. Eén gedeelde ring-component i.p.v. losse kopieën per
   scherm (eerst ingebouwd in breath-history.tsx, hier uitgetrokken zodat
   (tabs)/activity.tsx 'm ook kan gebruiken zonder de Skia-tekencode te
   dupliceren). Spoor + gevulde boog, start bovenaan (12 uur), rond
   strokeCap. Wat de ring vult is aan de aanroeper — puur een 0–1-waarde in,
   geen eigen mening over WAT er gemeten wordt.
   ───────────────────────────────────────────────────────────────────────── */

import { Canvas, Path, Skia, vec } from '@shopify/react-native-skia';

type Props = {
  /** 0–1. Waarden buiten dat bereik worden geklemd. */
  progress: number;
  accent: string;
  size?: number;
  strokeWidth?: number;
  /** Kleur van het lege spoor. Default is de oude, voor donkere schermen
     bedoelde tint — een lichte kaart (bv. activity.tsx) geeft hier zelf een
     donkere, zichtbare tint door zodat de ring ook op 0% nog te zien is. */
  trackColor?: string;
};

export function StatRing({
  progress,
  accent,
  size = 148,
  strokeWidth = 12,
  trackColor = 'rgba(255,255,255,0.08)',
}: Props) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const path = Skia.Path.Make();
  path.addCircle(cx, cy, r);
  const end = Math.max(0.0001, Math.min(1, progress));
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path
        path={path}
        style="stroke"
        strokeWidth={strokeWidth}
        color={trackColor}
      />
      <Path
        path={path}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        start={0}
        end={end}
        color={accent}
        transform={[{ rotate: -Math.PI / 2 }]}
        origin={vec(cx, cy)}
      />
    </Canvas>
  );
}
