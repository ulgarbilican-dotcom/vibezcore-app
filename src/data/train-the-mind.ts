/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Train the mind: de audiosessie die bij een toestand hoort

   De brug tussen de twee helften van het merk (operator, 9 augustus 2026).
   De About-pagina zegt het al jaren: "Control the Moment · Train the Mind".
   Breathwork ís het eerste — het lichaam reguleren, nu. De audiobibliotheek
   ís het tweede — Jung, de Stoïcijnen, denken op lange termijn. Na een
   ademsessie is iemand kalm en ontvankelijk; dát is het moment voor de
   verdieping, en het enige moment waarop audio zich mag aandienen.

   De regel die dit bestand bewaakt: audio bestaat als BELONING NA het
   ademen en als bonus in het premium-aanbod — nooit als keuze ervóór.
   Geen tab, geen tegel op de keuzepagina. Eén kaart op het afsluitscherm.

   Per toestand één vaste, met de hand gekozen sessie. Bewust allemaal
   GRATIS sessies: ook wie niet betaalt krijgt de verdieping te proeven, en
   de bibliotheek erachter is dan het aanbod. De koppeling loopt op titel +
   serie tegen de echte bibliotheekdata — verdwijnt een sessie daar, dan
   verdwijnt de kaart hier vanzelf in plaats van op een dode link te wijzen.
   ───────────────────────────────────────────────────────────────────────── */

import { SESSIONS, type Session } from '@/data/audio-library-data';
import type { BreathStateKey } from '@/data/breath-states';

/* Waarom déze vijf (inhoudelijke keuze, geen toeval):
   · BOOST    → Beast Mode: dezelfde energie die de ademhaling net opwekte.
   · FOCUS    → Neural State Control: je richt je aandacht — dit legt uit hoe
                je hem vasthoudt.
   · CALM     → De Stoïcijnen over wat in je macht ligt: gelijkmoedigheid,
                de denk-kant van wat box breathing met het lijf doet.
   · CLARITY  → Rich by Clarity: een helder hoofd, en wat je ermee bouwt.
   · REST     → Delta Descent: de soundscape uit de subserie die letterlijk
                Sleep heet — luisteren terwijl je wegzakt. */
const PICK: Record<BreathStateKey, { title: string; series: string }> = {
  boost: { title: 'Become a Monster', series: 'Beast Mode' },
  focus: { title: 'Neural State Control', series: 'Master Mental Clarity' },
  calm: { title: 'What Is In Your Control', series: 'The Stoic Mind' },
  clarity: { title: 'Rich by Clarity', series: 'The Freedom Formula' },
  rest: { title: 'Delta Descent', series: 'Soundscapes' },
};

/** De audiosessie die deze toestand verdiept, of `null` wanneer hij niet
 *  (meer) in de bibliotheek staat. */
export function trainTheMindFor(state: BreathStateKey): Session | null {
  const want = PICK[state];
  if (!want) return null;
  return (
    SESSIONS.find(
      (x) => x.title === want.title && x.series === want.series,
    ) ?? null
  );
}
