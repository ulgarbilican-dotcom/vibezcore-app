/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — laatst gebruikte tabblad

   Operator, 7 oktober 2026 ("ik volg apple niveau"): een ingelogde gebruiker
   ziet het welkomstscherm niet meer bij elke start, maar komt terug waar hij
   was — zoals Apple's eigen apps (Fitness, Music, Health). Dit bewaart welk
   tabblad dat was. Gezet bij elke tab-focus in (tabs)/_layout.tsx, gelezen
   bij het opstarten in app/_layout.tsx.
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vz_last_tab_v1';

/** Tabbladnaam (Expo Router) → route. `index` is de Audio Library. */
const ROUTE: Record<string, string> = {
  breath: '/breath',
  index: '/',
  bracelet: '/bracelet',
  activity: '/activity',
  account: '/account',
};

let last: string | null = null;

export function saveLastTab(name: string): void {
  if (!ROUTE[name] || name === last) return;
  last = name;
  AsyncStorage.setItem(KEY, name).catch(() => {});
}

/** Route om in te openen; Breath als er nog niets bewaard is. */
export async function getLastTabRoute(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return (v && ROUTE[v]) || '/breath';
  } catch {
    return '/breath';
  }
}
