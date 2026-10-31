/* Draaiwiel in een scrollend blad (31 okt 2026, operator: "bij premium scrollwiel tijd werkt niet" — stap 4 van het
   plan, en op kleine schermen ook het tijd-blad van de agenda's).

   Het wiel (components/GestureWheel.tsx) volgt de vinger met een native Pan-gebaar. Staat het in een gewone
   ScrollView, dan pakt die ScrollView de verticale veeg af zodra de vinger een paar pixels beweegt: het blad scrolt en
   het wiel staat stil. Daarom vertelt het wiel bij aanraking aan de ScrollView rond zich "even niet scrollen"; bij
   loslaten mag het weer. Elke ScrollView waar een wiel in kan staan geeft dit door (SheetScroll, SheetBody). */
import { createContext, useCallback, useState } from 'react';

/** Zet het scrollen van de omliggende ScrollView uit (true) of weer aan (false). */
export const WheelScrollLockContext = createContext<((locked: boolean) => void) | null>(null);

/** Voor een ScrollView die een wiel kan bevatten: geef `lock` door via de context en `scrollEnabled` aan de ScrollView. */
export function useWheelScrollLock() {
  const [locked, setLocked] = useState(false);
  const lock = useCallback((v: boolean) => setLocked(v), []);
  return { scrollEnabled: !locked, lock };
}
