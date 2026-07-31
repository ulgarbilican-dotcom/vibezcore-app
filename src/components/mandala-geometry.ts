/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Mandala-geometrie

   De vorm uit het operator-referentiebeeld: een Seed of Life met een
   doorlopende cirkel in het hart waarvan de binnenkant links en rechts is
   weggesneden tot een maanvorm.

   Stond eerst in HapticOrb. Losgetrokken omdat de operator (2026-07-31)
   besloot dat deze figuur de vaste vorm wordt voor álle begeleidingsmodi —
   ze wordt dus door meerdere schermen gedeeld en mag niet twee keer bestaan.

   Alles in LOKALE coördinaten rond de oorsprong. Draaien, schalen en
   verplaatsen gebeurt bij de aanroeper met één transformatie; de geometrie
   zelf verandert nooit, en dat is precies wat het goedkoop maakt.
   ───────────────────────────────────────────────────────────────────────── */

import { FillType, Skia, type SkPath } from '@shopify/react-native-skia';

const TAU = Math.PI * 2;

/** Aantal cirkels in de rozet. Zes is wat de figuur maakt: bij een straal
 *  van R/2 op afstand R/2 raken ze elkaar precies. */
export const SEEDS = 6;

export type Mandala = {
  /** Buitencirkel, straal R. */
  outer: SkPath;
  /** De zes cirkels apart, met hun middelpunt — dat middelpunt is nodig
   *  voor animaties die een baan over zo'n cirkel volgen. */
  seeds: { path: SkPath; cx: number; cy: number }[];
  /** Dezelfde zes in één pad, voor een gedeelde gloed-pas. */
  seedsAll: SkPath;
  /** De cirkel in het hart, als haarlijn te overtrekken. */
  oRing: SkPath;
  /** Dezelfde cirkel min de lens: de maanvorm, om te vullen. */
  oFill: SkPath;
};

export function buildMandala(R: number): Mandala {
  const outer = Skia.Path.Make();
  outer.addCircle(0, 0, R);

  /* Zes cirkels van straal R/2, middelpunt op afstand R/2. De eerste staat
     rechts, niet bovenaan: dat is de stand uit het referentiebeeld, waar de
     vesica's boven en onder in een punt samenkomen en er links en rechts een
     cirkelbuik zit.

     Doordat ze alle zes door de oorsprong gaan ontstaat de zesbladige rozet
     in het midden vanzelf — die hoeft niet apart getekend te worden. En
     doordat straal en afstand allebei R/2 zijn, raakt hun omhullende precies
     de buitencirkel. */
  const seeds: { path: SkPath; cx: number; cy: number }[] = [];
  const seedsAll = Skia.Path.Make();
  for (let i = 0; i < SEEDS; i++) {
    const a = (i / SEEDS) * TAU;
    const px = (Math.cos(a) * R) / 2;
    const py = (Math.sin(a) * R) / 2;
    const one = Skia.Path.Make();
    one.addCircle(px, py, R / 2);
    seeds.push({ path: one, cx: px, cy: py });
    seedsAll.addCircle(px, py, R / 2);
  }

  /* De vorm over het hart: ÉÉN doorlopende cirkel waarvan alleen de
     binnenkant is weggesneden door een lens. Die lens raakt de cirkel boven
     en onder, waardoor de vulling daar tot nul afloopt en opzij aanzwelt —
     een fijne cirkel die links en rechts dikker wordt.

     Twee paden: één om te vullen (cirkel min lens, even-odd), één om als
     haarlijn te overtrekken. Zonder die haarlijn breekt de cirkel boven en
     onder open, want daar is de vulling nul.

     De binnenrand is een ECHTE CIRKELBOOG. Met een kwadratische bézier trekt
     de curve bij deze verhouding — de lens is bijna even breed als de cirkel
     — naar de eindpunten toe recht, en dan krijg je een ruit met scherpe
     hoeken i.p.v. een maan.

     De boog ligt vast zodra je eist dat hij door (0, ±oR) gaat en in het
     midden tot oInner uitwijkt. Uit die drie punten volgt de straal:
       rho = (oInner² + oR²) / (2·oInner)
     met het middelpunt op rho − oInner aan de andere kant van de as. */
  const oR = R * 0.53;
  const oInner = R * 0.485;
  const rho = (oInner * oInner + oR * oR) / (2 * oInner);
  const cOff = rho - oInner;
  /* Hoek waaronder (0, oR) vanuit dat middelpunt wordt gezien. */
  const beta = (Math.atan2(oR, cOff) * 180) / Math.PI;

  const oRing = Skia.Path.Make();
  oRing.addCircle(0, 0, oR);

  const oFill = Skia.Path.Make();
  oFill.addCircle(0, 0, oR);
  /* Linkerboog: van (0,−oR) via (−oInner,0) naar (0,+oR). */
  oFill.addArc(
    Skia.XYWHRect(cOff - rho, -rho, rho * 2, rho * 2),
    -(180 - beta),
    -2 * beta,
  );
  /* Rechterboog: terug van (0,+oR) via (+oInner,0) naar (0,−oR). */
  oFill.arcToOval(
    Skia.XYWHRect(-cOff - rho, -rho, rho * 2, rho * 2),
    beta,
    -2 * beta,
    false,
  );
  oFill.close();
  oFill.setFillType(FillType.EvenOdd);

  return { outer, seeds, seedsAll, oRing, oFill };
}
