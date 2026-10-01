/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — techniek-popup helpers

   Operator, 9 september 2026: "info in popup is beetje te belerend en ziet
   er saai en veel uit... users lezen niet graag veel" — zowel de RHYTHMS-
   popup op de Breath-tab (`(tabs)/breath.tsx`) als de techniek-popup en
   "How it works"-knop op het sessie-instelscherm (`breath-setup.tsx`)
   toonden de volle `TechniqueDef.explain`-alinea. Gedeelde helpers zodat
   beide schermen dezelfde, kortere vertaling gebruiken i.p.v. twee losse
   implementaties die uit de pas kunnen lopen.

   Geen nieuwe copy nodig: elke `explain` in `data/breath-states.ts` volgt
   al het patroon "[timing-zin] — [pakkende zin]. [evt. extra zin]" — het
   stuk na de streep IS al de korte, interessante zin. Het cijferpatroon
   komt rechtstreeks uit `phases` (secs), geen tekst-parsing nodig.
   ───────────────────────────────────────────────────────────────────────── */

import { Square, Target, Triangle, Wind } from 'lucide-react-native';

/* Vorm-icoon per techniek — gekozen op RITME-vorm, niet op exacte naam: box/
   triangle krijgen hun eigen geometrische vorm, coherente/gelijkmatige
   technieken een doelwit, de rest (ujjayi, alternate-nostril, sigh,
   extended-exhale-varianten, 4-7-8...) een wind-icoon — het is tenslotte
   allemaal ademhaling. Eén set voor de hele app i.p.v. losse kopieën. */
export const techniqueIcon = (key: string) => {
  if (key.includes('box')) return Square;
  if (key.includes('triangle')) return Triangle;
  if (key.includes('coherent') || key === 'equal' || key.includes('slow')) return Target;
  return Wind;
};

/** Korte, pakkende zin uit `explain` — het stuk na de streep, tot de eerste
 *  punt. Geen nieuwe copy, enkel het al-aanwezige "hook"-deel eruit lichten. */
export const techniqueHook = (explain: string) => {
  const afterDash = explain.split(' — ')[1] ?? explain;
  const firstSentence = afterDash.split('. ')[0].replace(/\.$/, '');
  return firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);
};

/** "4-4" / "4-7-8" — het cijferpatroon rechtstreeks uit de fasen, geen
 *  tekst. */
export const techniquePattern = (phases: { secs: number }[]) =>
  phases.map((p) => p.secs).join('-');

/* Operator, 10 september 2026 (1e ronde): op `breath-setup.tsx` (kies duur +
   techniek) stond dezelfde `techniqueHook`-zin als op het keuzescherm
   ervoor — pure herhaling. Eerste fix: drie herbruikbare niveau-zinnen
   (Beginner/Intermediate/Advanced) i.p.v. die hook.

   Operator, 10 september 2026 (2e ronde): "elke sessie per state bijna
   zelfde uitleg gegeven, is dat professioneel?" — terecht, die drie zinnen
   waren letterlijk identiek over alle vijf toestanden heen. Geprobeerd:
   de `why`-tekst van de AANBEVOLEN duur i.p.v. de niveau-zin — bleek zélf
   ook grotendeels hetzelfde te zijn (operator: "dat staat nu overal in de
   popups?" — klopt, "The everyday length" staat letterlijk in 14 van de
   15 `why`-teksten; logisch, want een aanbevolen/standaardduur betekent
   structureel bijna altijd "de dagelijkse lengte", los van de techniek).

   Operator, 10 september 2026 (3e ronde): terug naar `explain`, maar
   verder dan de hook — de meeste `explain`-zinnen hebben een TWEEDE zin na
   de hook (bv. box: "Popularized as tactical breathing in military
   training..."; triangle: "A quicker cousin of Box Breathing."; coherent:
   "One of the most studied slow-breathing rhythms there is.") die wél
   per techniek verschilt en nergens anders getoond wordt (de RHYTHMS-popup
   op de vorige pagina toont alleen de EERSTE zin, de hook). Enkel de
   ~5 technieken zonder tweede zin vallen terug op de niveau-zin. */
export const techniqueExtra = (explain: string): string | undefined => {
  const afterDash = explain.split(' — ')[1] ?? explain;
  const rest = afterDash
    .split('. ')
    .slice(1)
    .join('. ')
    .trim();
  return rest || undefined;
};

const LEVEL_LINE: Record<'Beginner' | 'Intermediate' | 'Advanced', string> = {
  Beginner: 'Comfortable for every day.',
  Intermediate: 'Once the rhythm feels familiar.',
  Advanced: 'For confident, experienced breathers.',
};

/** Twee regels, nooit meer: `primary` is de tweede zin van `explain` als
 *  die bestaat (technique-specifiek, niet elders getoond), anders de
 *  niveau-zin; `caution` is de `safetyNote` waar die bestaat (amber/red-
 *  tier) — apart, want dat is veiligheidsinfo, geen keuze-tip. */
export const techniqueDecisionLine = (t: {
  explain: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  safetyNote?: string;
}) => ({
  primary: techniqueExtra(t.explain) ?? LEVEL_LINE[t.level],
  caution: t.safetyNote,
});
