/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Haptisch alfabet voor de ademfasen

   Je moet ZONDER KIJKEN weten wat je moet doen — op de telefoon nu, en
   straks aan de pols. Dat lukte niet: elke fase trilde één keer, alleen met
   een andere duur (60 ms in, 80 uit, 30 vasthouden). Die verschillen liggen
   onder de waarneemdrempel, en één tikje aan het begin zegt bovendien niets
   over de vier seconden die erop volgen.

   Opzet van de operator (3 augustus 2026), en de juiste: ademen is DOEN, dus
   dat voel je onafgebroken. Vasthouden is NIETS doen, dus dat telt alleen.

     INADEMEN    één ononderbroken trilling, de hele fase lang
                 ██████████████████
                 Glad en aanhoudend. Zolang je het voelt, adem je in.

     UITADEMEN   ononderbroken, maar RIMPELEND
                 ▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚
                 Even lang aanwezig, maar met korrel erin — het stroomt weg
                 in plaats van te vullen.

     VASTHOUDEN  één tik per seconde, verder stilte
                 ·    ·    ·    ·
                 Niets loopt door, want jij ook niet. En je voelt meteen
                 hoe ver je bent: vier tikken is vier seconden.

   Waarom niet twee keer glad: zonder amplituderegeling — en die heeft geen
   van beide platformen — is TEXTUUR het enige dat twee even lange, even
   sterke trillingen kan scheiden. Glad tegenover korrelig doet dat, en het
   is dezelfde taal die de bracelet straks kan spreken; daar stuurt de
   DRV2605L de LRA en kan dit één op één over.

   Beperking om te kennen: iOS negeert opgegeven trilduur en maakt van elke
   stap een vaste puls. Daar blijft het onderscheid staan via het AANTAL —
   inademen is één puls, uitademen een dichte reeks, vasthouden een paar
   losse — maar "aanhoudend" is op iPhone niet letterlijk aanhoudend. Dat is
   een platformgrens, geen keuze. Op de bracelet speelt hij niet.

   Beide vormen van vasthouden delen hun signaal: vol of leeg, je doet exact
   hetzelfde, en het scherm zegt in beide gevallen HOLD.

   Deze tabel staat los van de ademtoestanden: hij hoort bij het ADEMEN, niet
   bij één figuur. Gaat de bracelet dezelfde taal spreken, dan leest de
   firmware hiernaar en ontstaat er geen tweede versie die uit de pas loopt.
   ───────────────────────────────────────────────────────────────────────── */

import type { PhaseKey } from '@/data/breath-states';
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BREATH_AMP, MS_FACTOR, WATCH_HAPTIC_LEVEL, getHapticStrength } from './haptic-strength-pref';
import { canPlayNativeWaveform, playNativeWaveform } from '../../modules/state-haptics';
import { playSessionTaps, stopSessionTaps } from '../../modules/session-audio';

/* De trilling vult de fase niet helemaal: de laatste tiende blijft stil.
   Die stilte is functioneel — ze kondigt de wissel aan, en zonder haar loopt
   het einde van de ene fase over het begin van de volgende heen. */
const FILL = 0.9;

/* De korrel van het uitademen. Grover dan het inademen — dat is het hele
   onderscheid — en met langere stiltes, wat het tegelijk zachter maakt.
   Uitademen hoort ook zachter te zijn dan inademen: het is loslaten. */
const RIPPLE_ON = 150;
const RIPPLE_OFF = 120;

/* De tik van het vasthouden. Was 34 ms en daarmee nauwelijks te voelen: een
   trilmotor heeft tijd nodig om op gang te komen, dus onder ongeveer 60 ms
   voel je vooral het aanlopen en niet de tik zelf. Nu lang genoeg om aan te
   komen, kort genoeg om geen zoem te worden. */
const TICK = 85;
const TICK_PERIOD = 1000;

/* Hoe fijn het inademen trilt. Geen onafgebroken trilling meer (operator,
   3 augustus 2026: "de haptics voor in- en uitademen zijn heel hard").

   De reden dat het zo hard aanvoelde is bouwkundig: geen van beide platformen
   laat de STERKTE regelen via deze weg, dus stond de motor vijf seconden lang
   voluit aan. Het enige wat wél te regelen valt is hoeveel van de tijd hij
   aanstaat. Met korte onderbrekingen komt de motor telkens net niet op volle
   uitslag, en dat scheelt in wat je voelt zonder dat het onderbroken lijkt.

   90 aan / 55 uit blijft ruim boven de drempel waarop losse pulsen als één
   doorlopende trilling samensmelten, dus het verschil met het KORRELIGE
   uitademen (150/120) blijft staan: fijn tegenover grof. */
const SMOOTH_ON = 90;
const SMOOTH_OFF = 55;

/** Doorlopend en glad — maar met fijne onderbrekingen, zodat de motor niet
 *  de hele fase op volle kracht staat. */
function steady(secs: number): number[] {
  const span = Math.max(400, Math.round(secs * 1000 * FILL));
  const out: number[] = [0];
  let used = 0;
  while (used + SMOOTH_ON <= span) {
    out.push(SMOOTH_ON);
    used += SMOOTH_ON;
    if (used + SMOOTH_OFF >= span) break;
    out.push(SMOOTH_OFF);
    used += SMOOTH_OFF;
  }
  return out;
}

/** Doorlopend, maar met korrel: aan/uit tot de fase vol is. */
function ripple(secs: number): number[] {
  const span = Math.max(400, Math.round(secs * 1000 * FILL));
  const out: number[] = [0];
  let used = 0;
  while (used + RIPPLE_ON <= span) {
    out.push(RIPPLE_ON);
    used += RIPPLE_ON;
    if (used + RIPPLE_OFF >= span) break;
    out.push(RIPPLE_OFF);
    used += RIPPLE_OFF;
  }
  /* Een reeks die met een pauze eindigt is een pauze te veel. */
  if (out.length % 2 === 1) out.push(RIPPLE_ON);
  return out;
}

/** Eén tik per seconde, zo vaak als de fase seconden telt. */
function tickPerSecond(secs: number): number[] {
  const count = Math.max(1, Math.round(secs));
  const out: number[] = [0, TICK];
  for (let i = 1; i < count; i += 1) {
    out.push(TICK_PERIOD - TICK);
    out.push(TICK);
  }
  return out;
}

/** Het patroon voor deze fase, passend bij de lengte ervan.
 *  Apart exporteerbaar zodat de bracelet-firmware straks dezelfde reeksen
 *  kan afleiden in plaats van een eigen versie te verzinnen. */
export function phaseHapticPattern(phase: PhaseKey, secs: number): number[] {
  return withStrength(basePattern(phase, secs));
}

/* Operator, 12 okt 2026: één trilsterkte voor de hele app (Soft / Medium /
   Strong, zelfde instelling als State Control). Deze weg kent geen
   krachtregeling, dus — zoals State Control op toestellen zonder — wordt
   elke tik korter of langer (MS_FACTOR); de pauze erna krimpt of groeit
   mee, zodat het ritme exact gelijk blijft. Medium = ongewijzigd. */
function withStrength(pattern: number[]): number[] {
  const f = MS_FACTOR[getHapticStrength()];
  if (f === 1) return pattern;
  const out = [...pattern];
  /* [wacht, aan, uit, aan, uit, …] — oneven indexen zijn "aan". */
  for (let i = 1; i < out.length; i += 2) {
    const on = out[i];
    const off = i + 1 < out.length ? out[i + 1] : 0;
    const next = Math.max(40, Math.round(on * f));
    const grow = Math.min(next - on, Math.max(0, off - 20));
    out[i] = on + grow;
    if (i + 1 < out.length) out[i + 1] = off - grow;
  }
  return out;
}

function basePattern(phase: PhaseKey, secs: number): number[] {
  /* 'inhale-2'/'exhale-2' — operator, 8 september 2026 (V1-protocolset):
     de tweede inademing van Physiological Sigh en de tweede in/uitademing
     van Alternate Nostril Breathing voelen als hetzelfde soort beweging als
     hun eerste helft, dus zelfde patroon. */
  if (phase === 'inhale' || phase === 'inhale-2') return steady(secs);
  if (phase === 'exhale' || phase === 'exhale-2') return ripple(secs);
  return tickPerSecond(secs);
}

/** Speel het patroon dat bij deze fase hoort.
 *
 *  Faalt stil: een trilmotor die niet meewerkt — emulator, toestel zonder
 *  motor, of systeemhaptiek uitgezet — mag een lopende sessie nooit
 *  onderbreken. */
/** Kracht 0–255 voor breathwork bij de gekozen sterkte (0 = toestel-standaard). */
export function breathAmplitude(): number {
  return BREATH_AMP[getHapticStrength()];
}

/** Kracht voor breathwork op het horloge — dezelfde niveaus als State
 *  Control op het horloge (WATCH_HAPTIC_LEVEL). */
export function watchBreathAmplitude(): number {
  return WATCH_HAPTIC_LEVEL[getHapticStrength()];
}

/* ── iPhone (operator, 17 okt 2026: "bij breathwork voel ik enkel een tik
   bij inhale, exhale of hold doet niets") ───────────────────────────────
   Vibration.vibrate(patroon) speelt op iOS per stap een vaste systeemtril
   van ~0,4 s en laat elke stap vallen die binnen die tijd komt — dus enkel
   de eerste tik van inademen kwam aan, de korrel van uitademen en de tikken
   van vasthouden niet. Hier dezelfde taal met Apple's eigen haptiek
   (UIImpactFeedbackGenerator), op een JS-klok die per fase herstart:
     inademen   dichte, gelijkmatige tikken (110 ms) = "doorlopend"
     uitademen  grovere tikken (270 ms), een trede zachter = "wegstromen"
     vasthouden één stevige tik per seconde
   Sterkte: Soft = Light, Medium = Medium, Strong = Heavy (maximum). */
const iosTimers: ReturnType<typeof setTimeout>[] = [];
function clearIosTimers(): void {
  iosTimers.forEach(clearTimeout);
  iosTimers.length = 0;
}
const S = Haptics.ImpactFeedbackStyle;
function iosStyles(): { flow: Haptics.ImpactFeedbackStyle; ripple: Haptics.ImpactFeedbackStyle; tick: Haptics.ImpactFeedbackStyle } {
  const st = getHapticStrength();
  if (st === 'soft') return { flow: S.Light, ripple: S.Soft, tick: S.Medium };
  if (st === 'strong') return { flow: S.Heavy, ripple: S.Heavy, tick: S.Heavy };
  return { flow: S.Medium, ripple: S.Light, tick: S.Heavy };
}

/* iPhone via Core Haptics (operator, build 26: "bij onboarding voice +
   haptics werkt haptics niet en gewone haptics ook niet"). Sinds de
   BeatEngine (Core Haptics) bestaat, kwamen de losse Apple-tikken
   (UIImpactFeedbackGenerator) niet meer door. Nu speelt de BeatEngine ook
   deze tikken: één patroon per fase/demo, Apple speelt het strak af. Is de
   motor niet klaar (oudere build, toestel zonder Core Haptics), dan de oude
   weg met losse tikken. */
function tapOf(style: Haptics.ImpactFeedbackStyle): { intensity: number; sharpness: number } {
  switch (style) {
    case S.Soft:
      return { intensity: 0.45, sharpness: 0.15 };
    case S.Light:
      return { intensity: 0.6, sharpness: 0.4 };
    case S.Heavy:
      return { intensity: 1, sharpness: 0.45 };
    case S.Rigid:
      return { intensity: 1, sharpness: 0.85 };
    default:
      return { intensity: 0.8, sharpness: 0.5 };
  }
}
/** Speelt tikken (ms vanaf nu, stijl) — via Core Haptics als dat kan. */
function playIosTaps(taps: { at: number; style: Haptics.ImpactFeedbackStyle }[]): void {
  clearIosTimers();
  if (taps.length === 0) return;
  /* Via de iPhone-geluidsmotor (19 okt 2026): één patroon, Core Haptics
     speelt het strak af. Zonder de motor (oudere build) losse tikken. */
  if (playSessionTaps(Date.now() + 15, taps.map((t) => ({ t: t.at, ...tapOf(t.style) })))) return;
  for (const t of taps) {
    if (t.at <= 0) Haptics.impactAsync(t.style).catch(() => {});
    else iosTimers.push(setTimeout(() => Haptics.impactAsync(t.style).catch(() => {}), t.at));
  }
}

function playPhaseHapticIos(phase: PhaseKey, secs: number): void {
  const st = iosStyles();
  const span = Math.max(400, Math.round(secs * 1000 * FILL));
  let step: number;
  let style: Haptics.ImpactFeedbackStyle;
  if (phase === 'inhale' || phase === 'inhale-2') {
    step = 110;
    style = st.flow;
  } else if (phase === 'exhale' || phase === 'exhale-2') {
    step = 270;
    style = st.ripple;
  } else {
    step = 1000;
    style = st.tick;
  }
  const count = phase.startsWith('inhale') || phase.startsWith('exhale') ? Math.max(1, Math.floor(span / step)) : Math.max(1, Math.round(secs));
  const taps: { at: number; style: Haptics.ImpactFeedbackStyle }[] = [];
  for (let i = 0; i < count; i += 1) taps.push({ at: i * step, style });
  stopSessionTaps();
  playIosTaps(taps);
}

/** Vibration.vibrate(...) dat ook op de iPhone werkt (17 okt 2026): op
 *  Android ongewijzigd; op iOS een tik bij de start van elk "aan"-stuk, en
 *  langere stukken als dichte tikken (110 ms) zodat ze aanhouden. */
export function vibrateCompat(pattern: number | number[]): void {
  if (Platform.OS !== 'ios') {
    try {
      if (typeof pattern === 'number') Vibration.vibrate(pattern);
      else Vibration.vibrate(pattern, false);
    } catch {
      /* stil */
    }
    return;
  }
  const st = iosStyles();
  const segs = typeof pattern === 'number' ? [0, pattern] : pattern;
  const taps: { at: number; style: Haptics.ImpactFeedbackStyle }[] = [];
  let t = 0;
  for (let i = 0; i < segs.length; i += 1) {
    const d = segs[i];
    if (i % 2 === 1) {
      for (let x = 0; x < Math.max(1, Math.floor(d / 110)); x += 1) {
        taps.push({ at: t + x * 110, style: d >= 150 ? st.flow : st.tick });
      }
    }
    t += d;
  }
  stopSessionTaps();
  playIosTaps(taps);
}

/** Stopt elke lopende fase-haptiek (pauze, einde, verlaten). */
export function stopPhaseHaptic(): void {
  clearIosTimers();
  if (Platform.OS === 'ios') stopSessionTaps();
  try {
    Vibration.cancel();
  } catch {
    /* stil */
  }
}

export function playPhaseHaptic(phase: PhaseKey, secs: number): void {
  if (Platform.OS === 'ios') {
    playPhaseHapticIos(phase, secs);
    return;
  }
  try {
    /* Eerst STOPPEN, dan starten (operator, 5 augustus 2026: de haptiek moet
       het beeld en de stem exact volgen). Android vervangt een lopend patroon
       meestal vanzelf, maar "meestal" is hier niet genoeg: loopt er nog iets
       van de vorige fase, dan trilt de nieuwe fase op het ritme van de oude
       en klopt niets meer met wat je ziet en hoort. Eén regel die dat
       uitsluit. */
    Vibration.cancel();
    const pattern = phaseHapticPattern(phase, secs);
    /* 13 okt 2026: met amplitude-regeling ook echt ZACHTER/STERKER, niet enkel
       korter (Galaxy A16 heeft geen amplitude-regeling — daar blijft het de
       tikduur). */
    const amp = breathAmplitude();
    if (amp > 0 && canPlayNativeWaveform()) {
      playNativeWaveform(
        pattern,
        pattern.map((_, i) => (i % 2 === 1 ? amp : 0)),
        -1,
      );
      return;
    }
    /* `false` = niet herhalen. Zonder die tweede parameter blijft het
       patroon op sommige Android-versies eeuwig doorlopen. */
    Vibration.vibrate(pattern, false);
  } catch {
    /* stil */
  }
}
