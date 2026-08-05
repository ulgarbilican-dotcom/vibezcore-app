/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Soundscapes

   Dertien achtergrondgeluiden, aangeleverd door de operator (4 augustus
   2026). Ze staan hier en nergens anders: naam, omschrijving, icoon, groep
   en bestand bij elkaar. Een veertiende toevoegen is één blok hieronder.

   ── Waarom alle dertien, en niet een gecureerde selectie ──────────────
   Ik had er vier voorgesteld en negen willen schrappen — donder schrikt,
   golven hebben hun eigen ritme, vogels trekken de aandacht naar buiten.
   De operator besliste anders: de gebruiker bepaalt zelf wat voor hem werkt.
   Dat is ook te verdedigen; wat mij stoort tijdens focus kan voor iemand
   anders precies goed zijn om bij in slaap te vallen.

   Wat blijft, is dat de KEUZE leesbaar moet zijn. Vandaar de vier groepen en
   de omschrijving van drie woorden: niemand hoort dertien namen te moeten
   uitproberen om te weten wat erachter zit.

   ── Iconen ───────────────────────────────────────────────────────────
   Allemaal uit Lucide, dezelfde familie als de rest van de app. Dertien
   iconen uit één set lezen als een systeem; dertien uit verschillende
   bronnen als een verzameling. Daarom ook geen emoji.
   ───────────────────────────────────────────────────────────────────────── */

import {
  Anchor,
  AudioLines,
  AudioWaveform,
  Antenna,
  Bell,
  Bird,
  CloudLightning,
  CloudRain,
  Fan,
  Flame,
  Moon,
  Sunrise,
  WavesHorizontal,
  type LucideIcon,
} from 'lucide-react-native';
import type { BreathStateKey } from '@/data/breath-states';

const CDN = 'https://vibezcore-audio.b-cdn.net/soundscapes%20breathwork';

export type SoundscapeGroup = 'NOISE' | 'WATER' | 'EARTH' | 'TONE';

export type Soundscape = {
  key: string;
  name: string;
  /** Drie woorden, zodat een naam geen raadsel is. */
  hint: string;
  group: SoundscapeGroup;
  Icon: LucideIcon;
  url: string;
  /** Correctie op het volume, gemeten met ffmpeg (5 augustus 2026).
   *
   *  De dertien opnames komen van dertien makers en staan 33 decibel uit
   *  elkaar: Depths meet -10,7 LUFS en Night -43,7. Dat is een factor 45 in
   *  amplitude, dus geen enkele instelling kan voor alle dertien kloppen —
   *  wie Depths op een prettig niveau zet, hoort Night niet meer.
   *
   *  Deze factor brengt ze allemaal op ongeveer -30 LUFS. Gemeten over de
   *  eerste dertig seconden; vervang je een bestand, dan hoort dit getal
   *  opnieuw gemeten te worden. */
  gain: number;
};

export const SOUNDSCAPES: Soundscape[] = [
  /* ── NOISE — maskeren ─────────────────────────────────────────────── */
  {
    key: 'deep',
    name: 'Deep',
    hint: 'Low brown noise',
    group: 'NOISE',
    Icon: AudioWaveform,
    url: `${CDN}/cosmic-scapes-relaxing-layered-brown-noise-304725.mp3`,
    gain: 0.14,
  },
  {
    key: 'soft',
    name: 'Soft',
    hint: 'Even pink noise',
    group: 'NOISE',
    Icon: AudioLines,
    url: `${CDN}/danevaer-low-pink-noise-434732.mp3`,
    gain: 1.41,
  },
  {
    key: 'static',
    name: 'Static',
    hint: 'Bright white noise',
    group: 'NOISE',
    Icon: Antenna,
    url: `${CDN}/themediaguy-soft-soothing-deep-white-noise-378857.mp3`,
    gain: 0.19,
  },
  {
    key: 'fan',
    name: 'Fan',
    hint: 'Steady airflow',
    group: 'NOISE',
    Icon: Fan,
    url: `${CDN}/u_sqbdol9i82-fan-noise-to-fall-asleep-573497.mp3`,
    gain: 0.89,
  },

  /* ── WATER ────────────────────────────────────────────────────────── */
  {
    key: 'rain',
    name: 'Rain',
    hint: 'Gentle rainfall',
    group: 'WATER',
    Icon: CloudRain,
    url: `${CDN}/eryliaa-gentle-rain-for-relaxation-and-sleep-337279.mp3`,
    gain: 2.16,
  },
  {
    key: 'storm',
    name: 'Storm',
    hint: 'Rain and thunder',
    group: 'WATER',
    Icon: CloudLightning,
    url: `${CDN}/lofivision-rain-and-thunder-321270.mp3`,
    gain: 0.49,
  },
  {
    key: 'shore',
    name: 'Shore',
    hint: 'Breaking waves',
    group: 'WATER',
    Icon: WavesHorizontal,
    url: `${CDN}/freesound_community-waves-53479.mp3`,
    gain: 1.00,
  },
  {
    key: 'depths',
    name: 'Depths',
    hint: 'Underwater hum',
    group: 'WATER',
    Icon: Anchor,
    url: `${CDN}/dragon-studio-deep-sea-underwater-ambience-472383.mp3`,
    gain: 0.11,
  },

  /* ── EARTH ────────────────────────────────────────────────────────── */
  {
    key: 'ember',
    name: 'Ember',
    hint: 'Crackling fire',
    group: 'EARTH',
    Icon: Flame,
    url: `${CDN}/soundreality-fire-ambience-528618.mp3`,
    gain: 0.79,
  },
  {
    key: 'dawn',
    name: 'Dawn',
    hint: 'Jungle at sunrise',
    group: 'EARTH',
    Icon: Sunrise,
    url: `${CDN}/freesound_community-amazon-jungle-morning-24939.mp3`,
    gain: 0.33,
  },
  {
    key: 'canopy',
    name: 'Canopy',
    hint: 'Tropical birds',
    group: 'EARTH',
    Icon: Bird,
    url: `${CDN}/placidplace-nature-soundstropicaljunglebirds-108380.mp3`,
    gain: 0.91,
  },
  {
    key: 'night',
    name: 'Night',
    hint: 'Crickets and frogs',
    group: 'EARTH',
    Icon: Moon,
    url: `${CDN}/freesound_community-cricketsandfrogs-19596.mp3`,
    gain: 4.00,
  },

  /* ── TONE ─────────────────────────────────────────────────────────── */
  {
    key: 'bowl',
    name: 'Bowl',
    hint: 'Deep singing bowl',
    group: 'TONE',
    Icon: Bell,
    url: `${CDN}/freesound_community-singing-bowl-deep-sound-27532.mp3`,
    gain: 0.17,
  },
];

export const GROUP_ORDER: SoundscapeGroup[] = [
  'NOISE',
  'WATER',
  'EARTH',
  'TONE',
];

export const soundscapeByKey = (k: string | null) =>
  k ? (SOUNDSCAPES.find((s) => s.key === k) ?? null) : null;

/** Waar elke toestand mee begint. Een STARTPUNT, geen beperking: alle
 *  dertien blijven overal kiesbaar. Wie zelf iets kiest krijgt dat terug,
 *  per toestand onthouden — voor slapen wil iemand iets anders dan voor
 *  focus, en dat hoort de app niet elke keer opnieuw te vragen. */
/* STANDAARD UIT (operator, 4 augustus 2026). Stem en telefoon-trilling staan
   aan omdat die begeleiden; een achtergrondgeluid is smaak, en smaak hoort
   niet ongevraagd te beginnen. Wie er één kiest krijgt hem voortaan terug —
   per toestand, want voor slapen wil iemand iets anders dan voor focus.

   Deze tabel blijft bestaan als SUGGESTIE: hij bepaalt welke regel voorop
   staat zodra iemand het vel opent, niet wat er zonder keuze speelt. */
export const SUGGESTED_SCAPE: Record<BreathStateKey, string> = {
  boost: 'dawn',
  focus: 'rain',
  calm: 'soft',
  clarity: 'depths',
  rest: 'deep',
};
