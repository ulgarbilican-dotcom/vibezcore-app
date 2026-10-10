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
/* Operator, 10 okt 2026 ("Heart Rate-pagina: huidig ritme, aanpassingen,
   wanneer hoe laat gemeten"): metingen enkel voor een sessie (bpm-pil)
   worden apart bijgehouden — ze tellen nooit mee voor de rusthartslag. */
const SESSION_LOG_KEY = 'vz_session_pulse_log_v1';
const SESSION_LOG_MAX = 50;
let sessionLog: { bpm: number; at: number }[] = [];

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

/* Operator, 10 okt 2026 ("in Resting Heart Rate moet staan wat ingesteld
   is, niet de laagste gemeten — altijd de laatste meting die de gebruiker
   deed, en die geldt voor alle sessies"): de NIEUWSTE bewaarde waarde wint,
   gemeten of zelf ingevuld. Vervangt de regel "we houden je rustigste
   meting" (8 okt 2026). */
function resolve(s: Stored): RestingPulse {
  if (!s.average) {
    const latestReading = s.readings.reduce<Reading | null>((a, r) => (!a || r.at > a.at ? r : a), null);
    if (s.manual && (!latestReading || s.manual.at >= latestReading.at)) {
      return withLive({ bpm: s.manual.bpm, source: 'manual', at: s.manual.at, decided: s.decided });
    }
    if (latestReading) {
      return withLive({ bpm: latestReading.bpm, source: 'measured', at: latestReading.at, decided: s.decided });
    }
  }
  return withLive({ bpm: AVERAGE_RESTING_BPM, source: 'average', at: null, decided: s.decided });
}

function withLive(p: Omit<RestingPulse, 'liveBpm'>): RestingPulse {
  /* Operator, 10 okt 2026: een meting "for this session" geldt altijd —
     ook als ze lager ligt dan de rusthartslag (bewuste keuze van de
     gebruiker, niet langer stil genegeerd). */
  const live =
    liveStart && Date.now() - liveStart.at <= LIVE_START_VALID_MS ? liveStart.bpm : null;
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
    const rawLog = await AsyncStorage.getItem(SESSION_LOG_KEY);
    if (rawLog) {
      const arr = JSON.parse(rawLog);
      if (Array.isArray(arr)) sessionLog = arr.filter((r) => r && r.bpm > 0 && r.at > 0);
    }
  } catch {
    sessionLog = [];
  }
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

/** Een meting enkel voor de volgende sessie (bpm-pil) — in het logboek,
 *  nooit in de rusthartslag. */
export function recordSessionPulse(bpm: number): void {
  sessionLog = [...sessionLog, { bpm: Math.round(bpm), at: Date.now() }].slice(-SESSION_LOG_MAX);
  notify();
  AsyncStorage.setItem(SESSION_LOG_KEY, JSON.stringify(sessionLog)).catch(() => {});
}

export type PulseHistoryEntry = {
  kind: 'measured' | 'entered' | 'session';
  bpm: number;
  at: number;
  /** Deze waarde is nu je rusthartslag. */
  inUse: boolean;
};

/** Alles wat gemeten of ingevuld werd, nieuwste eerst (Heart Rate-pagina). */
export function getPulseHistory(): PulseHistoryEntry[] {
  const p = resolve(stored);
  const out: PulseHistoryEntry[] = [];
  for (const r of stored.readings) {
    out.push({ kind: 'measured', bpm: r.bpm, at: r.at, inUse: p.source === 'measured' && r.bpm === p.bpm });
  }
  if (stored.manual) {
    out.push({ kind: 'entered', bpm: stored.manual.bpm, at: stored.manual.at, inUse: p.source === 'manual' });
  }
  for (const r of sessionLog) out.push({ kind: 'session', bpm: r.bpm, at: r.at, inUse: false });
  out.sort((a, b) => b.at - a.at);
  /* Enkel de meest recente rij met de gebruikte waarde krijgt het label. */
  let marked = false;
  return out.map((e) => {
    if (!e.inUse) return e;
    if (marked) return { ...e, inUse: false };
    marked = true;
    return e;
  });
}
