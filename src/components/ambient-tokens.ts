/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Ambient visual tokens

   Gedeelde taal voor de cinematic-ambient onboarding-visuals
   (AmbientGlow / StateLine / BreathCloud).

   Art direction (operator, 2026-07-30):
     Precision · Calm confidence · Premium technology · Human physiology
     Luxury · Minimalism

   Referentie: Apple Vision Pro, WHOOP, Oura, Nothing.
   NIET: Calm, Headspace, Meditopia — die zijn te "wellness".

   Harde regels die hieruit volgen:
     - Geen felle kleuren. Het merk-blauw #3a8fff is te hard voor deze
       laag; we gebruiken sterk gedempte tinten en laten wit het werk doen.
     - Zeer trage beweging. Cycli van 14-31s, geen 4-8s.
     - Diep zwart als basis. Licht komt eruit, niet ervoor.
     - Additief licht (blendMode "plus") zodat overlappende lagen als
       volume lezen i.p.v. als losse vormen.
   ───────────────────────────────────────────────────────────────────────── */

export const AMBIENT = {
  /** Kern van de gloed — bijna wit, koele ondertoon. */
  core: '#dce8ff',
  /** Volumelaag — zichtbaar blauw maar sterk gedempt. */
  volume: '#7fa8e0',
  /** Buitenste haze — donker, geeft alleen diepte. */
  haze: '#243b5c',
  /** Transparant eindpunt voor radial gradients (8-digit hex, alpha 00). */
  fade: '#00000000',
} as const;

/** Bewegingsperiodes in ms. Onderling niet-deelbaar zodat de lagen nooit
 *  synchroon lopen — dat is wat "levend" van "geanimeerd" onderscheidt. */
export const DRIFT = {
  slow: 31000,
  mid: 23000,
  fast: 17000,
} as const;
