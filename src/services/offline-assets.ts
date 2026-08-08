/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Wat er offline moet staan

   Eén lijst, samengesteld uit de bronnen zelf en niet met de hand nagetypt.
   Dat is het punt van dit bestand: voegt iemand een zesde illustratie of een
   nieuwe stemopname toe, dan staat die er automatisch bij. Een lijst die
   apart onderhouden moet worden, loopt binnen een maand achter — en dan mist
   uitgerekend het nieuwste bestand wanneer er geen netwerk is.
   ───────────────────────────────────────────────────────────────────────── */

import { SESSION_ART } from '@/components/SessionArt';
import { VOICE_ASSET_URLS } from '@/services/breath-voice';

/** De twee gezichten van het welkomstscherm. Staat hier en niet in het
 *  scherm zelf, zodat de offline-laag er ook bij kan zonder een scherm te
 *  hoeven importeren. */
export const FACES_URL = 'https://vibezcore-audio.b-cdn.net/images/faces.png';

/** De twee portretten waartussen het welkomstscherm morpht. Ze moeten LOKAAL
 *  staan voor het scherm ze nodig heeft: `useImage` levert een leeg beeld
 *  zolang een download loopt, en dan blijft de wolk hangen in de vorm die hij
 *  al had. */
/** De vijf statefoto's van de keuzepagina (operator, 8 augustus 2026):
 *  echte beelden in plaats van de ademende illustraties. */
export const STATE_PHOTOS: Record<string, string> = {
  boost: 'https://vibezcore-audio.b-cdn.net/images/boost%20pic.png',
  focus: 'https://vibezcore-audio.b-cdn.net/images/focus%20pic.png',
  calm: 'https://vibezcore-audio.b-cdn.net/images/calm%20control%20pic.png',
  /* Nieuwe versie (operator, 8 augustus 2026). */
  clarity: 'https://vibezcore-audio.b-cdn.net/images/clarity%20pic%202.png',
  rest: 'https://vibezcore-audio.b-cdn.net/images/rest%20reset%20pic.png',
};

export const WELCOME_MAN =
  'https://vibezcore-audio.b-cdn.net/images/master-mental-clarity.jpg';
export const WELCOME_WOMAN =
  'https://vibezcore-audio.b-cdn.net/images/welcome%20woman%203.png';

/** Alles wat een ademsessie nodig heeft om zonder netwerk te werken:
 *  de illustraties, de gezichten en elke stemopname. */
export const OFFLINE_ASSETS: string[] = [
  ...Object.values(SESSION_ART),
  FACES_URL,
  ...Object.values(STATE_PHOTOS),
  WELCOME_MAN,
  WELCOME_WOMAN,
  ...VOICE_ASSET_URLS,
];
