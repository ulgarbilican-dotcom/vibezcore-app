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
/* Laatste tabblad BUITEN Profile — waar je na inloggen terechtkomt. Wie
   inlogt staat op Profile, dus "het laatste tabblad" zou daar altijd
   Profile zijn (operator, 8 okt 2026: "gesloten via State Control, toch
   op Breathwork na sign out en in"). */
const CONTENT_KEY = 'vz_last_content_tab_v1';

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
  if (name !== 'account') AsyncStorage.setItem(CONTENT_KEY, name).catch(() => {});
}

/** Route na inloggen: het laatste tabblad buiten Profile; Breath als er
 *  nog niets bewaard is. */
export async function getLastContentTabRoute(): Promise<string> {
  try {
    const [c, l] = await Promise.all([AsyncStorage.getItem(CONTENT_KEY), AsyncStorage.getItem(KEY)]);
    /* Valt terug op het gewone laatste tabblad (van vóór deze sleutel bestond). */
    const v = c || (l !== 'account' ? l : null);
    return (v && v !== 'account' && ROUTE[v]) || '/breath';
  } catch {
    return '/breath';
  }
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
