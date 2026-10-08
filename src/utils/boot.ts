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

import { useEffect, useState } from 'react';

let decided = false;
const listeners = new Set<() => void>();

/** Door de root aangeroepen zodra vaststaat waar de app opent. */
export function markBootDecided(): void {
  if (decided) return;
  decided = true;
  /* Eén tik later: de root heeft dan al naar het juiste scherm genavigeerd. */
  setTimeout(() => listeners.forEach((l) => l()), 0);
}

/** Hook-variant: rendert opnieuw zodra de opstartbeslissing gevallen is.
 *  Operator, 8 okt 2026: de Library (route `/`) monteert bij elke koude
 *  start als eerste — en toonde zo even zijn intro (man met koptelefoon)
 *  vóór de sprong naar het laatste tabblad. Met deze hook toont hij niets
 *  tot de beslissing er is. */
export function useBootDecided(): boolean {
  const [d, setD] = useState(decided);
  useEffect(() => {
    if (decided) {
      setD(true);
      return;
    }
    const l = () => setD(true);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return d;
}

/** True zodra de root zijn keuze gemaakt heeft. Daarna mag `/` weer gewoon
 *  doorsturen — bij uitloggen bijvoorbeeld, dat komt ook op `/` uit. */
export function bootDecided(): boolean {
  return decided;
}
