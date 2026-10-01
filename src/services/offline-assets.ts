/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Wat er offline moet staan

   Eén lijst, samengesteld uit de bronnen zelf en niet met de hand nagetypt.
   Dat is het punt van dit bestand: voegt iemand een zesde illustratie of een
   nieuwe stemopname toe, dan staat die er automatisch bij. Een lijst die
   apart onderhouden moet worden, loopt binnen een maand achter — en dan mist
   uitgerekend het nieuwste bestand wanneer er geen netwerk is.
   ───────────────────────────────────────────────────────────────────────── */

import { MODE_ICON_SPRITE_IMG } from '@/components/GuidanceSelector';
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
/* Operator, 8 september 2026: dit is nu de ENIGE bron voor deze foto's —
   zowel de miniatuur-cirkels als de volle achtergrond op "Choose your
   session" ((tabs)/breath.tsx) lezen hieruit. Eerder had breath.tsx tijdelijk
   een eigen, losse kaart voor de achtergrond, en die liep uit de pas met
   deze lijst (miniaturen toonden andere foto's dan de achtergrond) —
   vandaar: één plek, geen tweede kopie meer. */
export const STATE_PHOTOS: Record<string, string> = {
  boost: 'https://vibezcore-audio.b-cdn.net/images/pic%20boost%20new%201.png',
  focus: 'https://vibezcore-audio.b-cdn.net/images/pic%20sharp%20focus%20new.png',
  calm: 'https://vibezcore-audio.b-cdn.net/images/pic%20calm%20control%20app%205.png',
  clarity: 'https://vibezcore-audio.b-cdn.net/images/pic%20clarity%20app%204.png',
  rest: 'https://vibezcore-audio.b-cdn.net/images/pic%20rest%20reset%20app%202.png',
};

export const WELCOME_MAN =
  'https://vibezcore-audio.b-cdn.net/images/master-mental-clarity.jpg';
export const WELCOME_WOMAN =
  'https://vibezcore-audio.b-cdn.net/images/welcome%20woman%203.png';

/** Alle beelden van de breathwork-onboarding (breath-welcome.tsx), zes
 *  schermen lang. Stonden hier eerst niet — alleen FACES_URL zat in de
 *  offline-laag — dus elk ander beeld (de bracelet, de vier gidsiconen, de
 *  polsfoto, de bibliotheek-hero) werd bij elke keer openen vers van de CDN
 *  gehaald. Op een trage of wisselvallige verbinding voelt dat als hangen op
 *  scherm 1 (operator, 13 augustus 2026: "onboarding welcome laadt heel
 *  traag"). Hier, niet in het scherm zelf, om dezelfde reden als FACES_URL:
 *  de offline-laag moet ze kennen zonder het scherm te hoeven importeren. */
/* Operator, 22 september 2026 (vervangt de eerdere 4 losse foto's per
   modus door één 2×2-iconbeeld dat `GuidanceSelector`'s `ModeGlyph` per
   kwadrant uitsnijdt — zie de toelichting daar): dit is nu de ENIGE
   afbeelding die de vier gidsiconen levert, zowel voor de instellingen-
   kaart als de onboarding-tegels. */
export const BREATH_ONBOARDING_MODE_ICONS: string[] = [MODE_ICON_SPRITE_IMG];
export const BREATH_ONBOARDING_BRACELET_IMG =
  'https://vibezcore-audio.b-cdn.net/images/Shattudkite_vzc_fiv%20no%20bg.png';
export const BREATH_ONBOARDING_WEAR_IMG =
  'https://vibezcore-audio.b-cdn.net/images/bracelet%20new%20correct.png';
export const BREATH_ONBOARDING_LIBRARY_HERO_IMG =
  'https://vibezcore-audio.b-cdn.net/images/audio-library.png';
/** Kaart onder de 4 gidsmodi op stap 2 ("Tap. See. Hear. Feel") — teaser
 *  voor de bracelet, opent een in-flow infopopup i.p.v. te navigeren.
 *  Operator, 22 september 2026: eerst een Apple-stijl productfoto op een
 *  witte studio-achtergrond, vervangen door deze — effen zwarte
 *  achtergrond (past beter bij de rest van de donkere onboarding), geen
 *  wit vlak onderin meer. */
export const BREATH_ONBOARDING_BRACELET_TEASER_IMG =
  'https://vibezcore-audio.b-cdn.net/images/pic%20hero%20home%202.png';
/** Achtergrond voor de samengevoegde "Smart bead bracelet"-stap (nieuwe
 *  stap 5, operator 7 september 2026) — bracelet-intro en "How it works"
 *  worden hier één lichte pagina. */
export const BREATH_ONBOARDING_BRACELET_BG_IMG =
  'https://vibezcore-audio.b-cdn.net/images/pic%20bracelet%20background.png';
/** Achtergrond voor de laatste stap "Your first session" (operator, 7
 *  september 2026, mockup). */
export const BREATH_ONBOARDING_START_BG_IMG =
  'https://vibezcore-audio.b-cdn.net/images/pic%20your%20first%20session.png';
/** Achtergrond voor de Audio Library-stap (operator, 7 september 2026). */
/* Transparante achtergrond (operator, 7 september 2026) — losse
   uitgeknipte foto, geen cover-crop meer nodig/gewenst. */
export const BREATH_ONBOARDING_LIBRARY_BG_IMG =
  'https://vibezcore-audio.b-cdn.net/images/pic_audio_library_onboarding-removebg-preview.png';

/** Alles wat een ademsessie nodig heeft om zonder netwerk te werken:
 *  de illustraties, de gezichten en elke stemopname.
 *
 *  FACES_URL en WELCOME_MAN/WELCOME_WOMAN staan VOORAAN (operator, 10
 *  augustus 2026: "welcome breathwork pagina 1 van 6 laadt heel traag en de
 *  foto wordt soms overgeslagen"). `cacheAssets` haalt deze lijst
 *  SEQUENTIEEL binnen. Drie beelden — FACES_URL voor de onboarding-intro,
 *  WELCOME_MAN/WELCOME_WOMAN voor het app-welkomstscherm — zijn allebei het
 *  EERSTE wat een nieuwe gebruiker ooit ziet, nog voor de vijf sessie-
 *  illustraties of een enkele stemopname ooit nodig zijn. Stonden ze
 *  achteraan (wat FACES_URL tot nu toe deed), dan was de download-wachtrij
 *  op een verse installatie nog niet bij hen aanbeland tegen de tijd dat
 *  het scherm ze al probeerde te tonen: `useImage` levert dan een leeg
 *  beeld terug en de wolk vormt geen gezicht.

 *  De BREATH_ONBOARDING_*-beelden staan om dezelfde reden vlak erachter,
 *  niet pas na de sessie-illustraties: het zijn de eerste zes schermen die
 *  een nieuwe gebruiker ziet, vaak nog vóór hij een sessie start. */
export const OFFLINE_ASSETS: string[] = [
  FACES_URL,
  WELCOME_MAN,
  WELCOME_WOMAN,
  ...Object.values(BREATH_ONBOARDING_MODE_ICONS),
  BREATH_ONBOARDING_BRACELET_IMG,
  BREATH_ONBOARDING_WEAR_IMG,
  BREATH_ONBOARDING_LIBRARY_HERO_IMG,
  BREATH_ONBOARDING_BRACELET_TEASER_IMG,
  BREATH_ONBOARDING_BRACELET_BG_IMG,
  BREATH_ONBOARDING_START_BG_IMG,
  BREATH_ONBOARDING_LIBRARY_BG_IMG,
  ...Object.values(SESSION_ART),
  ...Object.values(STATE_PHOTOS),
  ...VOICE_ASSET_URLS,
];
