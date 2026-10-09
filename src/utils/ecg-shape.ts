/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — vorm van één hartslag op de hartlijn (ECG-stijl)

   Operator, 9 okt 2026 ("kunnen die pieken echt bewegen, weet je wat ik
   bedoel"): geen zigzag van rechte lijntjes maar de vorm van een echte
   monitor — ronde P-golf, scherpe QRS-piek met diepe S-uitschieter, brede
   ronde T-golf. Eén bron voor de "Your Resting Heart Rate"-pagina en het
   meetscherm. Puur decoratief (geen meting, geen medische betekenis).

   ECG_SHAPE: [ms t.o.v. de R-piek, hoogte −1…1], oplopend in tijd, dicht
   bemonsterd waar de vorm rond is, met exacte hoekpunten in de QRS.
   ───────────────────────────────────────────────────────────────────────── */

function gauss(t: number, mu: number, sigma: number) {
  return Math.exp(-((t - mu) * (t - mu)) / (2 * sigma * sigma));
}

function build(): [number, number][] {
  const pts: [number, number][] = [];
  /* P-golf (rond) */
  for (let t = -240; t <= -70; t += 10) pts.push([t, 0.11 * gauss(t, -165, 22)]);
  /* QRS (scherp): Q-dipje, R-piek, S-uitschieter, terug naar de basislijn */
  /* Vervolg (operator: "is dat de realistische piekvorm? kijk echte
     monitors na"): afleiding II, de standaard op een monitor — klein Q
     (<25% R), S ±10–30% van R (was 62%: te diep), QRS ±90 ms. */
  pts.push([-38, 0], [-26, -0.12], [0, 1], [22, -0.28], [40, 0.02], [52, 0]);
  /* ST-segment + T-golf (breed en rond) */
  /* T ±25–35% van R, breed en rond; QT ±370 ms. */
  for (let t = 80; t <= 330; t += 10) pts.push([t, 0.3 * gauss(t, 215, 42)]);
  return pts;
}

export const ECG_SHAPE: [number, number][] = build();
/** Tijdspanne van één slag op de lijn (ms), van begin P tot einde T. */
export const ECG_SPAN = { from: -240, to: 330 };
