/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — pols uit de vingertop (camera + zaklamp), "Match your rhythm"
   fase 2 (operator, 7 okt 2026).

   Fotoplethysmografie: bij elke hartslag stroomt er even meer bloed door
   de vingertop, waardoor die een fractie minder licht van de zaklamp
   doorlaat. De gemiddelde rood- (en groen-)waarde van het camerabeeld
   golft dus mee met de pols.

   Werkwijze, puur en testbaar (geen React, geen camera):
     1. gelijkmatig herbemonsteren op 30 Hz;
     2. de trage drift eruit (lopend gemiddelde van 1 s), licht gladstrijken;
     3. TWEE onafhankelijke schattingen:
          - autocorrelatie: na hoeveel tijd lijkt het signaal weer op zichzelf;
          - slagen tellen: pieken, dan de mediane tijd tussen twee slagen;
     4. alleen een uitkomst als beide het eens zijn (binnen 10%), het
        signaal duidelijk periodiek is en de slagen regelmatig zijn.
   Rood of groen: het kanaal met het duidelijkste ritme wint (rood raakt bij
   sommige toestellen verzadigd door de zaklamp).

   Geen medische meting — enkel om het begintempo van State Control te
   zetten. Liever "opnieuw proberen" dan een twijfelachtig getal. */

export type PulseSample = { t: number; r: number; g: number };

export type PulseResult = {
  bpm: number;
  /** 0–1: hoe zeker (periodiciteit × regelmaat). */
  confidence: number;
  /** Tijdstippen (ms) van de gevonden slagen. */
  beats: number[];
};

const FS = 30;
const MIN_BPM = 40;
const MAX_BPM = 180;

/** Ligt er een vinger op de lens (met de zaklamp aan)? Dan is het beeld
 *  egaal en sterk rood. */
export function fingerOnLens(s: Pick<PulseSample, 'r' | 'g'>): boolean {
  return s.r > 60 && s.r > s.g * 1.6;
}

/** Tijdstempels van de camera kunnen in s, ms, µs of ns zijn — naar ms. */
export function timestampScaleToMs(rawTimestamps: number[]): number {
  const diffs: number[] = [];
  for (let i = 1; i < rawTimestamps.length; i++) {
    const d = rawTimestamps[i] - rawTimestamps[i - 1];
    if (d > 0) diffs.push(d);
  }
  if (!diffs.length) return 1;
  const d = median(diffs);
  if (d < 1) return 1000; // seconden
  if (d > 1e5) return 1e-6; // nanoseconden
  if (d > 1e3) return 1e-3; // microseconden
  return 1; // milliseconden
}

function median(xs: number[]): number {
  const a = [...xs].sort((p, q) => p - q);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function movingAvg(x: number[], win: number): number[] {
  const half = Math.max(1, Math.floor(win / 2));
  const out = new Array<number>(x.length);
  let sum = 0;
  let lo = 0;
  let hi = -1;
  for (let i = 0; i < x.length; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(x.length - 1, i + half);
    while (hi < b) sum += x[++hi];
    while (lo < a) sum -= x[lo++];
    out[i] = sum / (hi - lo + 1);
  }
  return out;
}

function resample(samples: PulseSample[], pick: (s: PulseSample) => number): number[] {
  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t;
  const n = Math.floor(((t1 - t0) / 1000) * FS);
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + (i * 1000) / FS;
    while (j < samples.length - 2 && samples[j + 1].t < t) j++;
    const a = samples[j];
    const b = samples[j + 1];
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    out.push(pick(a) + (pick(b) - pick(a)) * Math.min(1, Math.max(0, f)));
  }
  return out;
}

type ChannelEstimate = { bpm: number; periodicity: number; regularity: number; beats: number[] };

function estimate(x: number[], t0: number, lenient = false): ChannelEstimate | null {
  /* Live (lenient): al vanaf ~2,4 s signaal en 2 slagafstanden. */
  if (x.length < FS * (lenient ? 2.4 : 4)) return null;
  /* Minder licht = meer bloed = slag → omkeren, zodat een slag een piek is. */
  const inv = x.map((v) => -v);
  const trend = movingAvg(inv, FS);
  const z = movingAvg(
    inv.map((v, i) => v - trend[i]),
    5,
  );
  const mean = z.reduce((a, b) => a + b, 0) / z.length;
  const zc = z.map((v) => v - mean);
  const energy = zc.reduce((a, b) => a + b * b, 0);
  if (energy <= 0) return null;

  /* Autocorrelatie over 40–180 bpm. */
  const minLag = Math.floor((60 / MAX_BPM) * FS);
  const maxLag = Math.ceil((60 / MIN_BPM) * FS);
  let bestLag = -1;
  let best = -Infinity;
  const ac: number[] = [];
  for (let lag = minLag; lag <= Math.min(maxLag, zc.length - 1); lag++) {
    let s = 0;
    for (let i = 0; i + lag < zc.length; i++) s += zc[i] * zc[i + lag];
    const r = s / energy;
    ac[lag] = r;
    if (r > best) {
      best = r;
      bestLag = lag;
    }
  }
  if (bestLag < 0) return null;
  /* Operator, 9 okt 2026 ("ik mat 40, dat kan niet"): de klassieke
     octaaffout — bij een zwakke tussenpiek "past" het signaal ook op twee
     slagen tegelijk, en dan wint de dubbele periode (= halve hartslag).
     Toont de halve periode zelf ook duidelijk herhaling, dan is DAT het
     echte ritme. */
  const halfLag = Math.round(bestLag / 2);
  if (halfLag >= minLag && ac[halfLag] !== undefined && ac[halfLag] > 0.5 * best) {
    bestLag = halfLag;
    best = ac[halfLag];
  }
  /* Paraboolfit rond de top voor een nauwkeuriger periode. */
  let lag = bestLag;
  const l = ac[bestLag - 1];
  const r = ac[bestLag + 1];
  if (l !== undefined && r !== undefined) {
    const d = l - 2 * best + r;
    if (d !== 0) lag = bestLag + (0.5 * (l - r)) / d;
  }
  const bpmAc = (60 * FS) / lag;

  /* Slagen tellen: lokale maxima, minstens 70% van de verwachte afstand. */
  const sd = Math.sqrt(energy / zc.length);
  const minGap = Math.floor(lag * 0.7);
  const peaks: number[] = [];
  for (let i = 1; i < zc.length - 1; i++) {
    if (zc[i] < 0.3 * sd || zc[i] < zc[i - 1] || zc[i] < zc[i + 1]) continue;
    const prev = peaks[peaks.length - 1];
    if (prev !== undefined && i - prev < minGap) {
      if (zc[i] > zc[prev]) peaks[peaks.length - 1] = i;
      continue;
    }
    peaks.push(i);
  }
  const ibis: number[] = [];
  for (let i = 1; i < peaks.length; i++) ibis.push(peaks[i] - peaks[i - 1]);
  if (ibis.length < (lenient ? 2 : 3)) return null;
  const medIbi = median(ibis);
  const bpmPeaks = (60 * FS) / medIbi;
  const regular = ibis.filter((d) => Math.abs(d - medIbi) / medIbi <= 0.15).length / ibis.length;
  if (Math.abs(bpmAc - bpmPeaks) / bpmPeaks > 0.1) {
    return { bpm: bpmPeaks, periodicity: 0, regularity: regular, beats: [] };
  }
  return {
    bpm: (bpmAc + bpmPeaks) / 2,
    periodicity: best,
    regularity: regular,
    beats: peaks.map((i) => t0 + (i * 1000) / FS),
  };
}

/** Analyseer een venster samples (ms-tijdstempels). `minBeats`: hoeveel
 *  slagen er minstens moeten zijn voor een eindresultaat. `lenient`: enkel
 *  voor het live getal en de live slagen tijdens het meten (operator, 9 okt
 *  2026: "het bpm-getal moet tijdens de meting verschijnen") — soepelere
 *  drempels; het eindresultaat gebruikt altijd de strenge. */
export function analyzePulse(samples: PulseSample[], minBeats = 8, lenient = false): PulseResult | null {
  if (samples.length < FS * (lenient ? 2.4 : 4)) return null;
  const t0 = samples[0].t;
  const channels = [
    estimate(resample(samples, (s) => s.r), t0, lenient),
    estimate(resample(samples, (s) => s.g), t0, lenient),
  ].filter((c): c is ChannelEstimate => !!c && c.periodicity > 0);
  if (!channels.length) return null;
  const c = channels.reduce((a, b) => (b.periodicity * b.regularity > a.periodicity * a.regularity ? b : a));
  if (c.periodicity < (lenient ? 0.2 : 0.35) || c.regularity < (lenient ? 0.5 : 0.7) || c.beats.length < minBeats) return null;
  if (c.bpm < MIN_BPM || c.bpm > MAX_BPM) return null;
  return { bpm: Math.round(c.bpm), confidence: Math.min(1, c.periodicity * c.regularity), beats: c.beats };
}

/** Laatste slag voor het live-hartje (lichter: korter venster, minder slagen). */
export function latestBeat(samples: PulseSample[]): number | null {
  const res = analyzePulse(samples, 3);
  return res ? res.beats[res.beats.length - 1] : null;
}
