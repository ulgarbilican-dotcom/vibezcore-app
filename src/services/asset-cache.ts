/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Offline-laag voor beeld en stem

   Alles waar een ademsessie op draait — de vijf illustraties, de gezichten,
   negen stemcues en vijf afsluitingen — stond op Bunny en werd bij elke
   sessie opnieuw opgehaald. Zonder netwerk was er dus geen sessie: geen
   figuur, geen stem. Voor een app die belooft altijd beschikbaar te zijn, en
   voor een bracelet die straks hetzelfde belooft, is dat geen detail.

   Deze dienst haalt elk bestand ÉÉN keer binnen en zet het in de
   documentenmap van de app. Daarna leest alles van het toestel.

   ── Waarom een eigen laag en niet de cache van het besturingssysteem ──
   Die bestaat wel, maar mag op elk moment geleegd worden — precies wanneer
   de opslag vol raakt, en dat is het moment waarop iemand offline is. Een
   cache die je niet kunt vertrouwen is voor deze belofte hetzelfde als geen
   cache. De documentenmap wordt niet zomaar opgeruimd.

   ── Waarom het niet mis kan gaan ──────────────────────────────────────
   `assetUri()` geeft het lokale pad zodra het bestand er staat, en anders de
   originele URL. Mislukt het binnenhalen, dan werkt de app precies zoals
   vroeger: streamend. Er is geen toestand waarin dit iets kapotmaakt dat het
   zonder deze laag wél deed.
   ───────────────────────────────────────────────────────────────────────── */

import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

const DIR_NAME = 'vz-assets';

/* BUG (operator, 13 augustus 2026, "al 10 keer eerder doorgegeven" — de
   zwarte onboarding/welkomstschermen): meerdere schermen lazen `assetUri()`
   in een module-level `const`, ÉÉN keer, bij het inladen van het bestand —
   dus ruim voordat `cacheAssets()` (pas gestart via een effect in de root-
   layout NA de eerste render) ooit de kans kreeg iets weg te schrijven. Die
   `const` bleef daardoor voor de hele levensduur van het proces de
   REMOTE url, ook nadat het bestand allang lokaal stond. Skia's `useImage`
   deed daardoor bij ELK bezoek een verse netwerk-fetch, en zolang die niet
   klaar was stond het scherm zwart — structureel, niet toevallig traag.

   Deze listener-laag laat schermen daarentegen REAGEREN zodra een bestand
   binnen is: `useAssetUri()` hertoetst na elke voltooide download en het
   scherm dat 'm gebruikt her-rendert dan met het echte lokale pad. */
const listeners = new Set<() => void>();
function notifyAssetCacheChanged(): void {
  setTimeout(() => {
    listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }, 0);
}

function dir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

/** Een vaste, korte bestandsnaam per URL.
 *
 *  Niet de laatste helft van de URL overnemen: daar zitten spaties, procenten
 *  en accenten in ("buddha%20.png", "boost%20finished%20.mp3"), en die geven
 *  op het ene bestandssysteem wél en op het andere geen problemen. Een getal
 *  uit de hele URL kan dat niet, en blijft over versies heen hetzelfde zolang
 *  de URL hetzelfde is. */
function fileName(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i += 1) {
    h = (Math.imul(h, 31) + url.charCodeAt(i)) | 0;
  }
  const ext = url.split('?')[0].match(/\.\w{2,4}$/)?.[0] ?? '';
  return `${(h >>> 0).toString(36)}${ext}`;
}

/** Het lokale pad als het bestand er staat, anders de originele URL.
 *
 *  Bewust synchroon: dit wordt tijdens het renderen aangeroepen, en een
 *  belofte zou betekenen dat elk beeld eerst leeg verschijnt en daarna
 *  verspringt. `exists` is een gewone eigenschap, geen netwerkvraag. */
export function assetUri(remote: string): string {
  try {
    const f = new File(dir(), fileName(remote));
    return f.exists ? f.uri : remote;
  } catch {
    return remote;
  }
}

/** Haal binnen wat er nog niet staat. Stil bij fouten: offline zijn is geen
 *  uitzondering die gemeld hoeft te worden, het is de normale toestand waar
 *  deze laag juist voor bestaat. */
export async function cacheAssets(urls: string[]): Promise<void> {
  let d: Directory;
  try {
    d = dir();
    if (!d.exists) d.create({ intermediates: true });
  } catch {
    return;
  }
  for (const url of urls) {
    try {
      const f = new File(d, fileName(url));
      if (f.exists) continue;
      await File.downloadFileAsync(url, f);
      /* Meteen na DIT bestand melden, niet pas als de hele lijst klaar is
         — wie op de eerste foto uit de lijst wacht, hoort niet te wachten
         tot ook het laatste stemcue-bestand binnen is. */
      notifyAssetCacheChanged();
    } catch {
      /* dit ene bestand blijft streamen; de volgende krijgt zijn kans */
    }
  }
}

/** Reactieve versie van `assetUri()` — leest hetzelfde lokale-pad-of-URL,
 *  maar her-rendert zodra `cacheAssets()` een nieuw bestand heeft
 *  binnengehaald. Gebruik dit in schermen (bewust NIET in een module-level
 *  `const`, dat is precies de fout hierboven), zodat een beeld dat halverwege
 *  het scherm klaar wordt alsnog het lokale, snelle pad krijgt in plaats van
 *  voor de rest van de app-sessie aan de remote URL vast te zitten. */
export function useAssetUri(remote: string): string {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return assetUri(remote);
}

/** Hoeveel van de meegegeven bestanden al op het toestel staan. Voor een
 *  eerlijke melding in Settings — "klaar voor offline" of "nog bezig". */
export function cachedCount(urls: string[]): number {
  return urls.reduce((n, u) => n + (assetUri(u) === u ? 0 : 1), 0);
}
