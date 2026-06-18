/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — URL equivalence helper

   Vergelijkt twee URLs zonder onderscheid tussen %-encoded en decoded vorm.

   Waarom dit nodig is:
     - SESSIONS-data (src/data/audio-library-data.ts) houdt %20-encoded
       (en andere %-encoded) URLs vast — zoals ze op Bunny CDN staan.
     - expo-router useLocalSearchParams DECODEERT URL-search-params voor
       leesgemak; de URL die in de audio-player state belandt is dus
       potentieel spatie-vorm in plaats van %20-vorm.
     - Strikte === vergelijking tussen die twee vormen mist matches die
       semantisch identiek zijn.

   Symptomen die deze helper oplost:
     - Auto-play next session triggert nooit ("Series complete" elke sessie)
     - Welcome-back "Continue listening" doet niets (sess = null)
     - "Now playing"-highlight verschijnt niet op de actieve serie-card
     - Favorites-orphan-cleanup pakt geldige sessies als verloren

   Performance: try/catch + decodeURI is goedkoop genoeg voor de
   frequenties waarmee we dit gebruiken (find, eindigt sessie, etc.).
   Geen memoization nodig.

   Iter 9dq v160 (operator 2026-06-18): gepromoteerd van twee lokale
   kopieën (next-session.ts + WelcomeBackPopup.tsx) naar een shared
   helper zodat elk URL-vergelijkingspunt dezelfde regels volgt.
   ─────────────────────────────────────────────────────────────────── */

/** decodeURI met silent fallback bij ongeldige sequenties. */
export function safeDecode(s: string): string {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}

/** True wanneer beide URLs naar dezelfde resource wijzen, ongeacht
 *  encoding. Voorbeelden die als gelijk gelden:
 *    'foo%20bar' === 'foo bar'
 *    'foo%2520bar' === 'foo%20bar'  (eerste is dubbel-encoded)
 *  Identieke strings zijn natuurlijk ook gelijk. */
export function urlEq(a: string, b: string): boolean {
  if (a === b) return true;
  return safeDecode(a) === safeDecode(b);
}
