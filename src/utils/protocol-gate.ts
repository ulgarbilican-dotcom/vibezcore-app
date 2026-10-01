/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Protocol-gate: weet de gebruiker het VOORAF?

   Operator, 17 september 2026: "weet gebruiker op voorhand dat hij hier
   niets mee is zonder premium?" — terecht niet. Elke ingang naar de
   Protocol-flow (Set your goal → Set your routine → Review your protocol)
   stond tot nu toe als een gewone, ongemarkeerde rij/knop, exact zoals elke
   andere — pas bij een TWEEDE poging zag je de teaser-popup (goal.tsx se
   `buildProtocol()`). Een gratis gebruiker die zijn ene proefronde al
   verbruikt had, kreeg dus nergens vooraf een seintje.

   Dit is de ÉÉN plek die "is dit nu op slot?" beantwoordt, zodat elke
   ingang (activity.tsx, breath.tsx, agenda.tsx, …) hetzelfde zegt.
   Bewust GEEN aparte staat voor een gebruiker die zijn proefronde nog niet
   verbruikt heeft — die mag overal gewoon open/ongemarkeerd binnenkomen,
   zie ProtocolTeaserModal's eigen toelichting ("user moet wel van 1
   volledige versie kunnen proeven"). */

import { useSubscription } from '@/hooks/useSubscription';
import { useSetting } from '@/utils/settings';

/** `true` zodra verder gaan in de Protocol-flow de teaser/paywall zou
 *  tonen — dus wanneer een niet-premium gebruiker zijn ene gratis
 *  proefronde al gebruikt heeft. */
export function useProtocolLocked(): boolean {
  const sub = useSubscription();
  const [hasBuiltProtocol] = useSetting('hasBuiltProtocol');
  const isPremium = sub.isPro || sub.hasBracelet;
  return hasBuiltProtocol && !isPremium;
}

/** IKEA/eigendomseffect (zie memory project-ux-psychology-principles):
 *  verwijst naar wat de gebruiker AL bouwde i.p.v. een generieke "upgrade"-
 *  oproep, en gebruikt dezelfde "je doel verschuift"-framing als
 *  ProtocolTeaserModal — één doorlopende boodschap van rij tot popup,
 *  geen aparte tekst die toevallig hetzelfde bedoelt. */
export const PROTOCOL_LOCKED_SUB = 'Your goals change — your protocol can too';
