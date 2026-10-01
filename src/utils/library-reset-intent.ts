/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Library reset intent

   Iter 9dq v98 (2026-06-04): signaalt aan de Audio Library-tab dat 'ie
   z'n interne "exploredLibrary"-state moet resetten zodat de bracelet-
   only landing weer verschijnt i.p.v. de uitgeklapte free-library view.

   Probleem dat we oplossen:
     - Vorige aanpak (iter 9dq v43, 2026-06-03) gebruikte useFocusEffect
       om bij tab-focus de exploredLibrary state te resetten.
     - Maar: het sluiten van de player-modal triggert ÓÓK een focus-event
       → user die net een free-sessie luisterde werd ongewild uit de
       free-library gegooid. Operator-feedback toen: "bezoeker moet in
       free-omgeving blijven tot hij beslist eruit te gaan".
     - Iter 9dq v43 verwijderde het focus-effect helemaal → ook
       tab-switch reset ging weg. Operator-feedback nu: "als hij terug
       op audio library tab moet eerste korte audio library pagina
       verschijnen".

   Oplossing: niet meer luisteren op generieke focus-events (die firen
   op zowel tab-switch ALS modal-close), maar een expliciet signaal dat
   alleen door de Audio-tab-button wordt afgegeven bij press.

   Patroon: identiek aan scroll-intent.ts (subscribe + request, no history).
   ─────────────────────────────────────────────────────────────────── */

const listeners = new Set<() => void>();

export function requestLibraryReset(): void {
  setTimeout(() => {
    listeners.forEach((l) => {
      try {
        l();
      } catch {
        /* één crashende listener mag de rest niet blokkeren */
      }
    });
  }, 0);
}

export function subscribeLibraryReset(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
