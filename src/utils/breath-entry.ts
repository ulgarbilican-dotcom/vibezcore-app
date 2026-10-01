/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — kom je van buiten, of kom je terug?

   Het welkomstbeeld van de Breath-tab (de gezichten die in de mandala
   overgaan) is een drempel: je komt binnen, je landt even, je kiest. Precies
   daarom hoort hij er NIET te zijn als je terugkomt uit een sessie. Dan heb
   je die drempel al genomen, en word je teruggezet op een scherm waar je al
   voorbij was (operator, 7 augustus 2026: "kom je terug op de welcome van de
   breathwork-pagina — is dat professioneel?").

   Dit vervangt de regel van 5 augustus ("terug naar dit beeld bij ELKE keer
   dat de tab de aandacht krijgt"). Het beeld blijft; alleen het sluiten van
   een sessie slaat het over.

   Waarom een vlag en geen parameter: de Breath-tab blijft gewoon gemonteerd
   onder het sessiescherm. Bij terugkeer draait alleen het focus-effect
   opnieuw — geen nieuwe montage, dus een gewijzigde parameter komt nooit aan.
   Eén vlag die je zet en die de ontvanger opeet, is hier het eerlijke
   gereedschap.
   ───────────────────────────────────────────────────────────────────────── */

let skip = false;

/** Zeggen: de volgende keer dat de Breath-tab aandacht krijgt, geen beeld. */
export function skipBreathIntroOnce(): void {
  skip = true;
}

/** Opvragen én meteen opruimen. Eén keer geldig, daarna weer gewoon. */
export function consumeBreathIntroSkip(): boolean {
  const v = skip;
  skip = false;
  return v;
}

/* ── "Maybe later" → de Breath-tab, zonder terug te stuiteren ──────────────
   Zelfde probleem, zelfde oplossing als hierboven (operator, 11 augustus
   2026: "maybe later gaat nu terug naar welcome breathwork"). De vlag
   `breathOnboardingCompletedAt` wordt wél gezet vóór de navigatie, maar
   `setSetting` is async en de Breath-tab's eigen redirect-check leest zijn
   `useSetting`-waarde via een luisteraar — beide horen op tijd te lopen,
   maar de tab blijft (net als hierboven) vaak al gemonteerd, en een
   race hierin stuurde alsnog terug naar de intro. Dezelfde vlag-truc sluit
   die race helemaal uit: de Breath-tab hoeft dan geen enkele andere staat
   te vertrouwen om te weten dat hij NU niet mag redirecten. */
let skipOnboardingRedirect = false;

/** Zeggen: de volgende keer dat de Breath-tab checkt of hij naar de intro
 *  moet, NIET — ongeacht of `breathOnboardingCompletedAt` al is bijgewerkt. */
export function skipBreathOnboardingRedirectOnce(): void {
  skipOnboardingRedirect = true;
}

/** Opvragen én meteen opruimen. Eén keer geldig, daarna weer gewoon. */
export function consumeBreathOnboardingRedirectSkip(): boolean {
  const v = skipOnboardingRedirect;
  skipOnboardingRedirect = false;
  return v;
}

/* ── De ENE gratis kennismakingssessie: vanaf WELK scherm dan ook ──────────
   Operator, 7 september 2026: "wat als user doorklikt [naar 'Customize your
   full plan'], dan is hij de trial versie kwijt want kan niet terug?" —
   terecht. `breath-welcome.tsx`'s CTA was de ENIGE plek die `from=onboarding`
   ooit meegaf; wie via de planpagina zijn eerste sessie startte kreeg nooit
   die param, dus de nog-ongebruikte vlag werd voor die gebruiker praktisch
   onbereikbaar — niet verbruikt, maar ook nergens meer inwisselbaar.

   Oplossing: elke plek die een sessie START (niet enkel de onboarding-CTA)
   roept dit aan. Wie de vlag nog niet verbruikt had krijgt 'm nu, ongeacht
   via welk scherm. Check + markering blijft een gewone, synchrone
   functie-aanroep op het moment van de tik zelf — dezelfde reden als
   hierboven: component-mount-timing bleek onbetrouwbaar, een tik niet. */
import { getSetting, setSetting } from '@/utils/settings';

/** Claimt (indien nog niet verbruikt) de ene gratis volledige sessie, en
 *  geeft de route-param terug die `breath-session.tsx` al kent. Leeg object
 *  als 'm al verbruikt was — dan blijft de sessie gewoon vergrendeld. */
export function claimFreeSessionParam(): { from?: 'onboarding' } {
  const alreadyUsed = getSetting('breathFreeSessionUsedAt');
  if (alreadyUsed) return {};
  setSetting('breathFreeSessionUsedAt', Date.now());
  return { from: 'onboarding' };
}
