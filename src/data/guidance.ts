/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Waar de begeleiding vandaan komt

   Drie kanalen, en ze sluiten elkaar uit. De haptiek die er tot nu toe was,
   is er één van: die van de TELEFOON. De operator wees er terecht op dat dat
   iets anders is dan de bracelet (4 augustus 2026).

   ── De bracelet-kanalen bestaan nog NIET in het BLE-contract ──────────
   Let op, want ik had dit eerst fout: spec v2.3 §8 (CLAUDE.md §6) beschrijft
   de EIGEN modi van de bracelet — Boost, Sharp Focus, Calm Control en de rest
   als losstaande haptische sessies. Daar stuurt de app één commando (modus,
   duur, START) en draait de hardware autonoom verder op eigen timers.

   Dat contract gaat NIET over ademhaling. Een ademsessie vanuit de app laten
   begeleiden op de pols is een nieuwe functie, en het commando daarvoor
   bestaat nog niet: het vraagt een uitbreiding van het contract én firmware
   die per fase een puls kan geven. Dat is een operator- en hardwarebeslissing
   (CLAUDE.md §1: nooit zelf een BLE-contract verzinnen), en tot die er is
   staan deze twee kanalen gedimd in beeld.

   Wat de app-kant betreft is alles er wel klaar voor: kanaalkeuze, de terugval
   naar de telefoon, en het zwijgen van telefoon en stem zodra de pols het
   overneemt. Zodra het commando bestaat is het aansluiten ervan klein werk.

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
