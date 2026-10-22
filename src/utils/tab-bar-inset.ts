/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — hoeveel van de onderrand de zwevende tabbalk inneemt.

   Operator, 19 okt 2026 ("kunnen wij onderaan transparant maken en de
   fotos etc full screen?" → "ja"): de tabbalk is weer een doorzichtige,
   ZWEVENDE laag over de schermen (zie (tabs)/_layout.tsx). Hij reserveert
   dus geen ruimte meer in de layout — elk tabscherm houdt zelf zijn
   knoppen/laatste rij erboven met deze waarde.

   De waarde = de GEMETEN hoogte van het hele blok onderaan: gedokte pills
   (State Control, geminimaliseerde ademsessie), mini-speler én de balk zelf
   incl. de onderste veilige zone. Dat is exact wat het scherm vroeger
   korter werd, dus knoppen blijven op hun vertrouwde plek. Verborgen balk
   (lopende State Control-sessie, keuzescherm) = 0.

   Buiten de tabbladen (gestapelde schermen erboven) = altijd 0: daar ligt
   geen tabbalk over het scherm.
   ───────────────────────────────────────────────────────────────────────── */

import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useContext, useEffect, useState } from 'react';
import { useSafeAreaInsets } from '@/utils/safe-area';

/** Inhoudshoogte van de balk zonder veilige zone (zie tabBarStyle). */
export const TAB_BAR_CONTENT_HEIGHT = 51;

type Listener = (h: number | null) => void;

let measured: number | null = null;
const listeners = new Set<Listener>();

/** Gezet door (tabs)/_layout.tsx via onLayout van het zwevende blok. */
export function setTabBarOverlayHeight(h: number): void {
  const rounded = Math.round(h);
  if (measured === rounded) return;
  measured = rounded;
  listeners.forEach((l) => l(rounded));
}

/** Onderste ruimte die een tabscherm moet vrijhouden (0 buiten de tabs). */
export function useTabBarInset(): number {
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const insets = useSafeAreaInsets();
  const [h, setH] = useState<number | null>(measured);
  useEffect(() => {
    listeners.add(setH);
    setH(measured);
    return () => {
      listeners.delete(setH);
    };
  }, []);
  if (!inTabs) return 0;
  /* Vóór de eerste meting: de balk zelf (zonder mini-spelers). */
  return h ?? TAB_BAR_CONTENT_HEIGHT + insets.bottom;
}
