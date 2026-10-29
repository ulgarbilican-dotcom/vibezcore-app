/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — delen (uitnodigen + een gratis audiosessie)

   Eén bron voor elke deeltekst, zodat ze nooit meer uit elkaar lopen
   (29 okt 2026: het delen van een sessie had nog de tekst van juni — enkel
   audio, lange pitch, link dubbel op iOS — terwijl "Invite a friend" al de
   goedgekeurde tekst had). Er wordt nooit audio gedeeld: enkel een bericht
   met een link naar de site. Delen kan enkel bij gratis sessies (player.tsx,
   Library: gratis sessies).
   ───────────────────────────────────────────────────────────────────────── */

import { Share } from 'react-native';

export const APP_LINK_URL = 'https://www.vibezcore.com/';

/* Operator, 19 okt 2026 (akkoord): kort. De kop = de drie knoppen van het
   welkomstscherm; de uitleg staat al in het voorbeeldkaartje van de site. */
export const BRAND_PITCH = 'Reset Yourself. Control Your State. Train Your Mind.';

const TRY_LINE = `Try VIBEZCORE for free: ${APP_LINK_URL}`;

/* Geen apart `url`-veld: iOS toonde de link dan dubbel (hij staat al in de tekst) — 17 okt 2026. */
async function share(message: string): Promise<void> {
  try {
    await Share.share({ title: 'VIBEZCORE', message });
  } catch {
    /* geannuleerd of niet beschikbaar */
  }
}

export function shareInvite(): Promise<void> {
  return share(`${BRAND_PITCH}\n\n${TRY_LINE}`);
}

/** Een gratis audiosessie delen = dezelfde goedgekeurde tekst. Bewust ZONDER sessietitel (operator, 29 okt 2026: titels veranderen
 *  regelmatig — een gedeelde titel die later niet meer bestaat, verwart de ontvanger). */
export function shareFreeSession(): Promise<void> {
  return shareInvite();
}
