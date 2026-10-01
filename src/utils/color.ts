/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — kleur-hulpfuncties

   Geëxtraheerd uit `bracelet-control.tsx` (was daar een lokale, niet-
   geëxporteerde functie) — breath-setup.tsx's segmented controls liepen
   tegen exact hetzelfde probleem aan (operator, 20 september 2026: "bij
   opvulling wit is tekst niet leesbaar" — Clarity's accent is #FFFFFF, dus
   witte tekst op een wit gevuld segment). Eén bron i.p.v. twee kopieën die
   uit elkaar kunnen gaan lopen.
   ───────────────────────────────────────────────────────────────────────── */

/** Bepaalt of een hex-kleur "licht" is — gebruikt voor tekst/icoon-contrast
 *  bovenop een gevuld vlak in die kleur (bv. Clarity's #FFFFFF-accent: witte
 *  tekst erop is onleesbaar, zwart wel). ITU-R BT.601 luminance-formule. */
export function isLightColor(hex: string): boolean {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return luma > 180;
}
