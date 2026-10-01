/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Step indicator

   Operator, 11 september 2026: "kan je bovenaan ook step 1 2... zetten?
   consistent zoal bij onboarding" — het protocol-traject (goal.tsx →
   intensity.tsx → plan-review.tsx) kreeg al één gedeelde header/CTA/kaart-
   taal (zie TypeScale/CTA/CardHeights in constants/theme.ts); dit haalt
   ook de STEP-tekst uit breath-welcome.tsx naar hier in plaats van hem
   los na te bouwen.

   Operator, 21 september 2026 ("Apple hanteert voor dit soort onboarding-
   schermen zeer specifieke HIG... een subtiele, doorlopende lineaire
   voortgangsbalk helemaal bovenaan het scherm, direct onder de
   navigatiebalk"): de vorige "STEP X OF Y"-tekst + vijf losse puntjes
   vervangen door één dunne, doorlopende balk die opvult naar rato van
   `step/total`. Elke aanroeper verhuisde 'm uit de knoppenrij naar een
   eigen regel direct daaronder.

   Operator, vervolg ("balk is toch te breed, zet de stapnummers toch
   terug boven de balk"): twee correcties op die eerste versie — de balk
   kreeg zijn zijmarge terug (niet meer edge-to-edge, dat oogde te zwaar/
   breed), en de "STEP X OF Y"-tekst staat weer terug, nu als klein label
   BOVEN de balk i.p.v. de vroegere puntjes-rij.

   Operator, vervolg ("balk is storend zo laag, zet 'm naast de pijl"):
   terug in de knoppenrij naast de terugknop (zoals vóór de HIG-poging),
   maar de balk-look (i.p.v. de oude losse puntjes) blijft — `flex:1` zodat
   'm de resterende breedte tussen terugknop en het element rechts vult. */

import { StyleSheet, Text, View } from 'react-native';
import { BrandFonts } from '@/constants/theme';

/* Operator, 18 september 2026 (build-choice.tsx: "step ... wit i.p.v.
   blauw"): optionele `color`-prop, default het bestaande blauw (#7FB2FF)
   — goal.tsx/intensity.tsx/plan-review.tsx geven hem niet mee en blijven
   dus exact zoals ze waren. Enkel build-choice.tsx zet 'm op wit, want
   dat scherm liet zijn selectie-kleur (rand/vinkje) al bewust wit i.p.v.
   het blauwe accent staan. */
export function StepIndicator({
  step,
  total,
  color = '#7FB2FF',
}: {
  step: number;
  total: number;
  color?: string;
}) {
  const pct = Math.min(1, Math.max(0, step / total));
  return (
    <View style={s.wrap} pointerEvents="none">
      <Text style={[s.eyebrow, { color }]}>{`STEP ${step} OF ${total}`}</Text>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 12 },
  eyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 5,
  },
  track: {
    /* Operator, 24 september 2026 ("dunner, identiek aan onboarding"):
       breath-welcome.tsx se lokale kopie van deze balk kreeg op 23
       september al "moet ook veel dunner" (5→1.5), maar dat werd nooit
       teruggezet in DIT gedeelde component — elke echte aanroeper
       (goal.tsx, intensity.tsx, plan-review.tsx, routine-intro.tsx,
       build-choice.tsx, build-your-day.tsx) stond dus nog op de oudere,
       dikkere maat. Nu gelijkgetrokken. */
    height: 1.5,
    borderRadius: 0.75,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 0.75 },
});
