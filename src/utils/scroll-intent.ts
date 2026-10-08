/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Scroll Intent signaling

   Cross-screen "scroll to anchor X" coordination zonder URL-params (zou
   typed routes verstoren) en zonder global Context. Wordt o.a. gebruikt
   door de player om de Audio Library-tab naar de pricing-section te laten
   scrollen wanneer de gebruiker op "Full library access" tikt.

   Patroon:
     - requestScrollTo(target): zet pending + notify live listeners.
     - subscribeScrollIntent(cb): consument (library-tab) registreert zich.
       Wanneer requestScrollTo() wordt aangeroepen terwijl de listener
       al subscribed is → callback vuurt direct (live-pad).
     - consumeScrollIntent(): consument leest + wist pending tijdens
       initial mount (cold-start-pad: intent was al gezet vóór de tab
       gemount was).

   We bewaren géén history van requests — een tweede call vóór de eerste
   geconsumeerd is overschrijft de pending-waarde. Voor onze use-case
   (één CTA per gebruiker-tap) is dat correct.
   ─────────────────────────────────────────────────────────────────────── */

let pending: string | null = null;
const listeners = new Set<(target: string) => void>();

export function requestScrollTo(target: string): void {
  pending = target;
  /* Audit 8 okt 2026: een intent is enkel bedoeld voor de navigatie die er
     meteen op volgt. Bleef hij hangen, dan voerde een scherm dat veel later
     monteerde hem alsnog uit (bv. vanzelf /subscribe openen na uitloggen). */
  setTimeout(() => {
    if (pending === target) pending = null;
  }, 3000);
  setTimeout(() => {
    listeners.forEach((l) => {
      try {
        l(target);
      } catch {
        /* één crashende listener mag de rest niet blokkeren */
      }
    });
  }, 0);
}

export function subscribeScrollIntent(
  cb: (target: string) => void
): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Wis + return de pending intent. Bedoeld voor cold-start: consument
 *  controleert dit op mount voor het geval requestScrollTo() al was
 *  aangeroepen toen deze nog niet luisterde. */
export function consumeScrollIntent(): string | null {
  const t = pending;
  pending = null;
  return t;
}
