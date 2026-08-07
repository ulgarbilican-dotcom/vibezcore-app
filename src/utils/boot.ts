/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — heeft de app zijn eerste scherm al gekozen?

   Waarom dit bestaat (operator, 7 augustus 2026: "welcome scherm moet altijd
   eerst zijn"). Er zijn twee partijen die bij het opstarten iets over de
   eerste route te zeggen hebben, en ze spraken elkaar tegen:

   · de root (`_layout.tsx`) stuurt naar `/welcome` zodra fonts en token
     binnen zijn — dat duurt even, want het wacht op opslag;
   · de route `/` is sinds 5 augustus de verborgen audiobibliotheek en stuurt
     meteen door naar `/breath` — dat gebeurt tijdens het eerste renderen.

   Expo Router opent op `/`, dus de tweede was er altijd eerder en won. Gevolg:
   het welkomstscherm verscheen nooit meer bij een koude start.

   De oplossing is niet nóg een omleiding maar een volgorde: `/` houdt zich
   stil tot de root zijn keuze gemaakt heeft. Zolang dat niet zo is, zit de
   splash er nog overheen — je ziet dus niets van dat wachten.

   Een losse module en geen React-state: `/` moet dit kunnen lezen tijdens het
   renderen, vóór welke hook dan ook draait.
   ───────────────────────────────────────────────────────────────────────── */

let decided = false;

/** Door de root aangeroepen zodra vaststaat waar de app opent. */
export function markBootDecided(): void {
  decided = true;
}

/** True zodra de root zijn keuze gemaakt heeft. Daarna mag `/` weer gewoon
 *  doorsturen — bij uitloggen bijvoorbeeld, dat komt ook op `/` uit. */
export function bootDecided(): boolean {
  return decided;
}
