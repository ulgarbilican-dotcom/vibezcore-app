/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Soundscape-speler

   Eén achtergrondgeluid tegelijk, in een lus, onder de sessie. De stemcues
   lopen erover heen; die hebben hun eigen speler in breath-voice.ts en die
   twee horen niets van elkaar te weten.

   ── Waarom hier gedownload wordt en niet bij het opstarten ─────────────
   Dertien bestanden van vijf à acht minuten is ruim honderd megabyte. Dat
   vooraf ophalen zou de app groter maken dan de rest van de app, voor geluid
   waarvan iemand er één gebruikt. Dus: bij het KIEZEN downloaden en daarna
   bewaren. De eerste keer speelt hij van het net, vanaf de tweede keer van
   het toestel — en dan werkt hij offline.

   De stemcues en illustraties gaan wél allemaal vooraf; die heb je in élke
   sessie nodig en ze zijn samen een fractie van deze bestanden.

   ── Waarom er vervaagd wordt ──────────────────────────────────────────
   Een achtergrondgeluid dat op vol volume begint of midden in een golf stopt,
   klinkt als een fout. Bij de start komt hij in twee seconden op, bij het
   einde gaat hij in anderhalve seconde weg. Daarmee doet de LENGTE van het
   bestand niet meer mee: hij mag korter zijn dan de sessie (dan herhaalt hij)
   of langer (dan wordt hij afgebroken), en in beide gevallen hoor je geen
   naad. De operator hoeft zijn bestanden dus niet op onze sessieduren af te
   stemmen.
   ───────────────────────────────────────────────────────────────────────── */

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { soundscapeByKey } from '@/data/soundscapes';

/* Volume waarop een soundscape ONDER de stem hoort te liggen. Hoger en de
   cues verdrinken; lager en je hoort hem niet meer. */
const LEVEL = 0.55;
const FADE_IN_MS = 2000;
const FADE_OUT_MS = 1500;
const STEP_MS = 60;

let player: AudioPlayer | null = null;
let playingKey: string | null = null;
let fade: ReturnType<typeof setInterval> | null = null;

const stopFade = () => {
  if (fade) clearInterval(fade);
  fade = null;
};

/** Geleidelijk naar een doelvolume. Neemt de speler mee als argument zodat
 *  een vervaging die nog loopt niet ineens een NIEUWE speler bijstelt. */
function rampTo(p: AudioPlayer, target: number, ms: number, done?: () => void) {
  stopFade();
  const from = p.volume ?? 0;
  const steps = Math.max(1, Math.round(ms / STEP_MS));
  let i = 0;
  fade = setInterval(() => {
    i += 1;
    const v = from + ((target - from) * i) / steps;
    try {
      p.volume = Math.max(0, Math.min(1, v));
    } catch {
      /* speler kan al opgeruimd zijn */
    }
    if (i >= steps) {
      stopFade();
      done?.();
    }
  }, STEP_MS);
}

/* ── Bewaren op het toestel ─────────────────────────────────────────── */

const dir = () => new Directory(Paths.document, 'soundscapes');

/** Het lokale bestand als het er is, anders de link.
 *
 *  Bewust GEEN await op de download voordat er gespeeld wordt: dan zou de
 *  eerste keer stil blijven tot een bestand van acht megabyte binnen is. Hij
 *  begint van het net en het toestel haalt hem er ondertussen bij, zodat de
 *  tweede keer offline werkt. */
async function localOrRemote(key: string, url: string): Promise<string> {
  try {
    const d = dir();
    if (!d.exists) d.create({ intermediates: true });
    const f = new File(d, `${key}.mp3`);
    if (f.exists) return f.uri;
    /* Op de achtergrond ophalen; het resultaat is voor de vólgende keer. */
    void File.downloadFileAsync(url, f).catch(() => {});
    return url;
  } catch {
    return url;
  }
}

/* ── Publieke API ───────────────────────────────────────────────────── */

/** Start een soundscape, of wissel naar een andere. `null` stopt.
 *
 *  Wisselen tijdens het spelen doet de oude eerst wegvagen; twee
 *  achtergrondgeluiden die elkaar overlappen is nooit de bedoeling. */
export async function playScape(key: string | null): Promise<void> {
  if (key === playingKey) return;
  const scape = soundscapeByKey(key);
  if (!scape) {
    stopScape();
    return;
  }

  const old = player;
  if (old) {
    rampTo(old, 0, 400, () => {
      try {
        old.remove();
      } catch {}
    });
  }

  playingKey = scape.key;
  const src = await localOrRemote(scape.key, scape.url);

  /* Tussen het opvragen en het aankomen kan de gebruiker iets anders hebben
     gekozen. Dan is deze aanroep achterhaald en mag hij niets meer starten. */
  if (playingKey !== scape.key) return;

  try {
    const p = createAudioPlayer({ uri: src });
    p.loop = true;
    p.volume = 0;
    p.play();
    player = p;
    rampTo(p, LEVEL, FADE_IN_MS);
  } catch {
    playingKey = null;
  }
}

/** Wegvagen en opruimen. Veilig om vaker aan te roepen dan nodig. */
export function stopScape(): void {
  playingKey = null;
  const p = player;
  player = null;
  if (!p) {
    stopFade();
    return;
  }
  rampTo(p, 0, FADE_OUT_MS, () => {
    try {
      p.remove();
    } catch {}
  });
}

/** Kort voorbeluisteren bij het kiezen, zodat je hoort wat je pakt voordat
 *  de sessie begint. Zelfde speler, dus je krijgt nooit twee geluiden. */
export const previewScape = playScape;
