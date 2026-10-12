/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "How do you feel now?" na een sessie (audit 12 okt 2026)

   Eén tik na een afgemaakte sessie: Better / Same / Worse. Waarom:
     1. je merkt zelf het effect (stilstaan bij hoe je je voelt);
     2. de app leert wat voor JOU werkt (later: aanbevelingen);
     3. je eigen bewijs in Activity ("8 van 10 sessies: better").
   Welzijnstaal, geen meting. Blijft op dit toestel, net als je hartslag.
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type Feel = 'better' | 'same' | 'worse';
export type FeelCheckin = {
  /** 'state' = State Control, 'breath' = Breathwork. */
  kind: 'state' | 'breath';
  /** Toestand: BraceletMode-index als tekst, of de BreathStateKey. */
  key: string;
  /** Techniek (enkel Breathwork). */
  technique?: string;
  feel: Feel;
  at: number;
};

const KEY = 'vz_feel_checkin_v1';
const MAX = 500;
let cache: FeelCheckin[] | null = null;

async function load(): Promise<FeelCheckin[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(arr) ? arr.filter((c) => c && typeof c.at === 'number') : [];
  } catch {
    cache = [];
  }
  return cache;
}

export async function recordFeel(c: Omit<FeelCheckin, 'at'>): Promise<void> {
  const list = await load();
  cache = [...list, { ...c, at: Date.now() }].slice(-MAX);
  AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => {});
}

export async function getFeelCheckins(): Promise<FeelCheckin[]> {
  return [...(await load())];
}
