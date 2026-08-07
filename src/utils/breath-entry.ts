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
