/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Small V-icon header logo

   Compact V-mark voor de top-left van elke in-app tab-pagina. Vervangt
   de oude grote VIBEZCORE-wordmark op Account/Bracelet en biedt brand-
   herkenning bovenaan Audio Library zonder dominant te zijn.

   Bron-asset: `assets/vibezcore_icon.png` — zelfde V-icoon dat in
   app.json als app-icon staat. Geen nieuw bestand nodig.

   Het grote wordmark blijft ALLEEN op:
     - welcome.tsx (welkomstscherm)
     - native splash (app.json plugins → expo-splash-screen)
   ─────────────────────────────────────────────────────────────────────── */

import { Image, View } from 'react-native';

type Props = {
  /** Pixel-hoogte van het logo. Default 28 — compact zonder onleesbaar te
   *  worden op kleine schermen. Gebruik grotere waarde alleen wanneer het
   *  logo een centraal element is (bv. welkomstscherm, splash). */
  size?: number;
};

export function AppLogo({ size = 28 }: Props) {
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={require('../../assets/vibezcore_icon.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="VIBEZCORE"
      />
    </View>
  );
}
