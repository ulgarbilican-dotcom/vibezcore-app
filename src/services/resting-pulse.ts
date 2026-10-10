/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — rusthartslag voor State Control ("Match your rhythm",
   operator, 7 okt 2026 — plan: Downloads/vibezcore-plan-hartslag-ritme).

   State Control start op de rusthartslag van de gebruiker en vertraagt van
   daaruit (bracelet-haptics.ts). Waar die waarde vandaan komt, in volgorde:
     1. een meting (camera, later ook horloge) — de LAAGSTE van de laatste
        60 dagen: rust is per definitie je laagste waarde, één meting na de
        trap verpest dus niets;
     2. wat de gebruiker zelf invult;
     3. het gemiddelde van een volwassene (70 bpm), duidelijk zo benoemd.

   De waarde blijft op dit toestel (nooit naar de server) — zo staat het
   ook in de privacyverklaring. Geen medische meting: enkel om het ritme
   in te stellen. */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Gemiddelde rusthartslag van een volwassene — voor wie overslaat. */
export const AVERAGE_RESTING_BPM = 70;
/** Grenzen voor wat we als rusthartslag aannemen. */
export const MIN_RESTING_BPM = 40;
export const MAX_RESTING_BPM = 100;
/** Hoe lang een meting meetelt voor "de laagste recente". */
const READING_WINDOW_DAYS = 60;
/** Na zoveel dagen zonder nieuwe meting: zacht voorstellen opnieuw te meten. */
export const REMEASURE_AFTER_DAYS = 30;

const KEY = 'vz_resting_pulse_v1';

export type PulseSource = 'measured' | 'manual' | 'average';

type Reading = { bpm: number; at: number };
type Stored = {
  /** Metingen (camera/horloge). */
  readings: Reading[];
  /** Zelf ingevuld — wint van metingen zolang het de nieuwste keuze is. */
  manual: Reading | null;
  /** Bewust gekozen voor het gemiddelde. */
  average: boolean;
  /** Heeft de gebruiker de keuze al één keer gemaakt (scherm "Match your rhythm")? */
  decided: boolean;
};

export type RestingPulse = {
  bpm: number;
  /** Net gemeten hartslag die de volgende sessie start (null = niet). */
  liveBpm: number | null;
  source: PulseSource;
  /** Moment van de gebruikte meting/invoer (null bij het gemiddelde). */
  at: number | null;
  decided: boolean;
};

/* ── Startpunt van NU (operator, 7 okt 2026) ──────────────────────────
   Wie net meet, wil dat zijn sessie daar begint: eerst aansluiten bij het
   hart van dit moment, dan vertragen (iso-principe, Motokawa). Het
   eindtempo blijft op de rusthartslag gebaseerd. Geldt 15 minuten en
   alleen als de meting op of boven de rusthartslag ligt (lager = nieuwe
   rust of een onbevestigde uitschieter). Niet bewaard: na herstart weg. */
const LIVE_START_VALID_MS = 15 * 60_000;
let liveStart: { bpm: number; at: number } | null = null;

const EMPTY: Stored = { readings: [], manual: null, average: false, decided: false };
let stored: Stored = EMPTY;
let loaded = false;
const listeners = new Set<(p: RestingPulse) => void>();

function clamp(bpm: number): number {
  return Math.min(MAX_RESTING_BPM, Math.max(MIN_RESTING_BPM, Math.round(bpm)));
}

function recentReadings(s: Stored): Reading[] {
  const since = Date.now() - READING_WINDOW_DAYS * 86_400_000;
  return s.readings.filter((r) => r.at >= since);
}

function resolve(s: Stored): RestingPulse {
  const recent = recentReadings(s);
  const latestReading = recent.reduce<Reading | null>((a, r) => (!a || r.at > a.at ? r : a), null);
  /* Zelf ingevuld wint, tenzij er daarna gemeten werd. */
  /* Audit 8 okt 2026: zelf ingevuld wint als het het nieuwste is, ÓF als
     het lager ligt dan elke latere meting — één camerameting na het
     wandelen mag een lagere, zelf ingevulde rusthartslag niet overschrijven
     ("we keep your calmest reading"). */
  const lowestRecent = recent.length ? Math.min(...recent.map((r) => r.bpm)) : Infinity;
  if (
    s.manual &&
    !s.average &&
    (!latestReading || s.manual.at >= latestReading.at || s.manual.bpm <= lowestRecent)
  ) {
    return withLive({ bpm: s.manual.bpm, source: 'manual', at: s.manual.at, decided: s.decided });
  }
  if (recent.length && !s.average) {
    /* De laagste, tenzij die een uitschieter is: meer dan 8 bpm onder de
       op één na laagste → die tweede telt (één foute meting mag het ritme
       niet twee maanden te laag zetten). */
    const sorted = [...recent].sort((a, b) => a.bpm - b.bpm);
    const lowest = sorted.length > 1 && sorted[1].bpm - sorted[0].bpm > 8 ? sorted[1] : sorted[0];
    return withLive({ bpm: lowest.bpm, source: 'measured', at: latestReading?.at ?? lowest.at, decided: s.decided });
  }
  return withLive({ bpm: AVERAGE_RESTING_BPM, source: 'average', at: null, decided: s.decided });
}

function withLive(p: Omit<RestingPulse, 'liveBpm'>): RestingPulse {
  const live =
    liveStart && Date.now() - liveStart.at <= LIVE_START_VALID_MS && liveStart.bpm > p.bpm ? liveStart.bpm : null;
  return { ...p, liveBpm: live };
}

function notify(): void {
  const p = resolve(stored);
  listeners.forEach((l) => {
    try {
      l(p);
    } catch {
      /* een kapotte luisteraar mag niets breken */
    }
  });
}

function commit(next: Stored): void {
  stored = next;
  notify();
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {
    /* opslaan mislukt → de waarde geldt nog deze sessie */
  });
}

/** Dev/test: alles wissen, alsof er nooit een keuze was (8–9 okt 2026,
 *  om de pagina "Your Resting Heart Rate" opnieuw te kunnen zien). */
export function resetRestingPulse(): void {
  commit(EMPTY);
}

/** Eén keer bij het opstarten (en veilig om vaker aan te roepen). */
export async function loadRestingPulse(): Promise<RestingPulse> {
  if (loaded) return resolve(stored);
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Stored>;
      stored = {
        readings: Array.isArray(p.readings) ? p.readings.filter((r) => r && r.bpm > 0 && r.at > 0) : [],
        manual: p.manual && p.manual.bpm > 0 ? p.manual : null,
        average: !!p.average,
        decided: !!p.decided,
      };
    }
  } catch {
    stored = EMPTY;
  }
  loaded = true;
  const p = resolve(stored);
  listeners.forEach((l) => l(p));
  return p;
}

/** De waarde van nu (synchroon — voor de haptics). */
export function getRestingPulse(): RestingPulse {
  return resolve(stored);
}

export function subscribeRestingPulse(listener: (p: RestingPulse) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Zelf ingevuld (draaiwiel 40–100). */
export function setManualRestingPulse(bpm: number): void {
  commit({ ...stored, manual: { bpm: clamp(bpm), at: Date.now() }, average: false, decided: true });
}

/** Een meting (camera of horloge). Boven 100 = geen rustwaarde → false. */
export function addRestingPulseReading(bpm: number): boolean {
  if (!(bpm >= MIN_RESTING_BPM - 5) || bpm > MAX_RESTING_BPM) return false;
  const reading = { bpm: clamp(bpm), at: Date.now() };
  commit({
    ...stored,
    readings: [...recentReadings(stored), reading].slice(-20),
    average: false,
    decided: true,
  });
  return true;
}

/** Bewust het gemiddelde (ook "Skip", en vanuit Profile). Vergeet meteen
 *  alle eigen waarden — wie terug naar het gemiddelde wil, wil ook dat de
 *  app zijn hartslag niet meer bewaart. */
export function chooseAverageRestingPulse(): void {
  liveStart = null;
  if (liveTimer) clearTimeout(liveTimer);
  liveTimer = null;
  commit({ ...EMPTY, decided: true });
}


/** Net gemeten hartslag als startpunt voor de volgende sessie(s). */
let liveTimer: ReturnType<typeof setTimeout> | null = null;
/* Operator, 10 okt 2026 ("elk ritme moet meetbaar zijn, ook boven 100 —
   bewust maken, niet verplichten"): een meting boven het rustbereik mag het
   STARTpunt van de volgende sessie zijn (het ritme glijdt van daar naar de
   toestand), maar wordt nooit je rusthartslag. Bovengrens 140. */
const MAX_LIVE_START_BPM = 140;
export function setLiveStartPulse(bpm: number): void {
  if (!(bpm >= MIN_RESTING_BPM)) return;
  liveStart = { bpm: Math.round(Math.min(bpm, MAX_LIVE_START_BPM)), at: Date.now() };
  if (liveTimer) clearTimeout(liveTimer);
  /* Na 15 min terug naar de rusthartslag — ook zichtbaar in de cirkel. */
  liveTimer = setTimeout(clearLiveStartPulse, LIVE_START_VALID_MS + 500);
  notify();
}

/** Een sessie is gestart met dit startpunt: daarna weer de rusthartslag. */
export function clearLiveStartPulse(): void {
  if (!liveStart) return;
  liveStart = null;
  if (liveTimer) clearTimeout(liveTimer);
  liveTimer = null;
  notify();
}

/** Begintempo van een sessie die NU start. */
export function getSessionStartBpm(): number {
  const p = resolve(stored);
  return p.liveBpm ?? p.bpm;
}

/** Mag de app voorstellen opnieuw te meten? */
export function shouldSuggestRemeasure(p: RestingPulse): boolean {
  return p.source === 'measured' && p.at !== null && Date.now() - p.at > REMEASURE_AFTER_DAYS * 86_400_000;
}

void loadRestingPulse();
