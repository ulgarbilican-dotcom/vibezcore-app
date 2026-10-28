/* iPhone + Apple Watch (28 okt 2026, operator: "ik zie op de smartwatch enkel een schermpje dat aftelt, zonder haptiek"): de iPhone kan de
   Apple Watch-app NIET zelf openen. Staat VIBEZCORE niet open op het horloge, dan speelt het horloge niets — alleen de teller van de Live
   Activity is zichtbaar. Dit zegt het de gebruiker, zolang er een sessie loopt en het horloge gekoppeld is maar de Watch-app niet bereikbaar. */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getAppleWatchStatus, isWatchReachable } from '../../modules/watch-breath';

export function useAppleWatchOpenHint(active: boolean): boolean {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios' || !active) {
      setHint(false);
      return;
    }
    let alive = true;
    const check = async () => {
      try {
        const st = await getAppleWatchStatus();
        if (!alive) return;
        if (st.status !== 'ready') {
          setHint(false);
          return;
        }
        const reachable = await isWatchReachable();
        if (alive) setHint(!reachable);
      } catch {
        if (alive) setHint(false);
      }
    };
    void check();
    const t = setInterval(check, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [active]);
  return hint;
}

export const WATCH_OPEN_HINT = 'Open VIBEZCORE on your watch to feel the rhythm on your wrist';
