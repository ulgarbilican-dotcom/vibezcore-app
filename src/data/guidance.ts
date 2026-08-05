/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Waar de begeleiding vandaan komt

   Drie kanalen, en ze sluiten elkaar uit. De haptiek die er tot nu toe was,
   is er één van: die van de TELEFOON. De operator wees er terecht op dat dat
   iets anders is dan de bracelet (4 augustus 2026).

   ── Waarom de bracelet geen "telefoon aan je pols" is ─────────────────
   Volgens het BLE-contract (CLAUDE.md §6) draait de bracelet AUTONOOM: de app
   stuurt één commando — modus, duur, START — en de hardware houdt het ritme
   daarna zelf bij op eigen timers. Verbindingsverlies stopt de sessie niet.

   Er gaat dus geen trilling per ademfase over de lijn. Dat is geen beperking
   die we omzeilen maar het ontwerp: een armband die op zichzelf doorloopt is
   betrouwbaarder dan één die aan een telefoonverbinding hangt, en hij werkt
   als je toestel in je tas zit.

   Gevolg voor dit bestand: bij BRACELET stuurt de app het commando en houdt
   ze verder haar mond.

   PRIVATE gaat één stap verder, maar niet de stap die ik er eerst in bouwde.
   Het scherm blijft gewoon meelopen — je hóéft er alleen niet naar te kijken,
   en je hoeft de telefoon niet vast te houden. Wat wegvalt is de STEM: het
   ritme zit aan je pols, dus er hoeft niemand iets te zeggen. Zo kun je
   ademen in een vergadering, in de trein of naast een slapende partner, en
   toch even kijken als je wilt weten hoe ver je bent.
   ───────────────────────────────────────────────────────────────────────── */

import { Smartphone, Watch, EyeOff, type LucideIcon } from 'lucide-react-native';

export type GuidanceChannel = 'phone' | 'bracelet' | 'private';

export type ChannelDef = {
  key: GuidanceChannel;
  name: string;
  hint: string;
  Icon: LucideIcon;
  /** Vraagt een verbonden bracelet. */
  needsBracelet: boolean;
};

export const CHANNELS: ChannelDef[] = [
  {
    key: 'phone',
    name: 'Phone',
    hint: 'Vibration in your hand',
    Icon: Smartphone,
    needsBracelet: false,
  },
  {
    key: 'bracelet',
    name: 'Bracelet',
    hint: 'Guidance on your wrist',
    Icon: Watch,
    needsBracelet: true,
  },
  {
    key: 'private',
    name: 'Private',
    hint: 'Wrist guides you — no voice, no need to look',
    Icon: EyeOff,
    needsBracelet: true,
  },
];

export const channelByKey = (k: GuidanceChannel) =>
  CHANNELS.find((c) => c.key === k) ?? CHANNELS[0];
