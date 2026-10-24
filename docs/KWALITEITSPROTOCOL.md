# KWALITEITSPROTOCOL — wat er moet gebeuren vóór iets "klaar" heet

> Ingesteld 24 oktober 2026 (operator: "je hebt geen systeem; ik wil een duidelijk protocol waardoor zulke
> belachelijke fouten niet kunnen gebeuren"). Bindend voor elke wijziging, door wie dan ook.

## 1. Waarom dit bestaat (de fouten van 24 okt, in drie klassen)
| Fout | Klasse |
|---|---|
| Premium zag het State Control-intro niet meer, maar de terugpijl ging naar dat intro → pijl deed niets, geen uitweg | **Regel veranderd, afhankelijkheden niet nagelopen** |
| Dots onder de cirkel: Reanimated-stijl op een RN-`Animated.View` → nooit animatie, niemand keek | **Gemeld zonder meting** |
| Icoon: `android/res` is gegenereerd en stond oud; knop-kleur via stijlwissel die Android niet terugzet; `quick`-regel verborg het denken | **Aanname i.p.v. de bron/het toestel lezen** |

## 2. De vijf regels

**R1 — Regelwijziging = eerst de afhankelijkheden.** Verandert een regel wat een scherm toont of verbergt (intro overslaan, tabbalk
verbergen, Premium/Free, sessie loopt), dan *vóór* het coderen: `grep` op elke plek die dat scherm als doel/bron gebruikt (terugpijl,
pil, melding, deep link, tab-wissel) en die lijst in de commit zetten. Geen regel zonder die lijst.

**R2 — Elk scherm heeft een uitweg.** Een scherm is pas geldig als het óf de tabbalk toont óf een werkende terug/sluit/klaar-knop
heeft — in **elke** toestand: Free, Premium, sessie loopt, sessie gepauzeerd, sessie geminimaliseerd. Wordt de tabbalk verborgen
(`hideStateControlBar`, `breathPicker`), dan is de pijl daar de enige uitweg en mag hij nooit verdwijnen of niets doen.

**R3 — Gemeten, niet gezien.** Een punt heet pas "gedaan" na een **meting op het toestel**: pixelwaarden/afmetingen uit een screenshot,
`uiautomator`-knooppunten, `dumpsys`/logcat. "Ik heb het bekeken" telt niet. Wat niet meetbaar is (gevoel, geluid, iOS) staat
expliciet als "niet getest" in het bericht.

**R4 — De bron lezen vóór "gelijk aan".** Vergelijken met een bestaande animatie/stijl/component = eerst de bron lezen (bv.
Reanimated's `FadeInDown`), niet uit het hoofd. Bestanden met een alias voor Reanimated (`ReanimatedAnimated`) controleren op
verkeerde `Animated`.

**R5 — Eén ronde = één onderwerp = één build, en de poort.** Pas als de **vloeiwandeling** (§3) op de build in Free én Premium
volledig slaagt, en twee ronden achter elkaar schoon zijn, gaat een build naar de winkel.

**R6 — Altijd vanaf het begin, als nieuwe gebruiker, en alle sporen.** Elke flow start op een schone eerste-gebruik-toestand (`qa?fresh=1`) en loopt vanaf het
eerste scherm door. Heeft een onderdeel meer dan één spoor (bv. het Breathwork-protocol: **"Build it yourself"** én **"Let VIBEZCORE build it"**), dan wordt
**elk spoor volledig** doorlopen en worden beide met elkaar vergeleken (zelfde eindresultaat). Tab voor tab: pas na volledig PASS van Free volgt Premium, en pas na
volledig PASS van een onderdeel volgt het volgende. Per scherm: elke terugknop en elke CTA (tekst, actief/inactief, juiste doel). Lijsten: `docs/FLOWS_*.md`.

**R7 — Elk scherm past zich aan; elke flow draait op een toestelmatrix.** Een flow telt pas als hij slaagt op **alle** maten van de matrix, niet alleen op het toestel van de operator.
Matrix (via `adb shell wm size` / `wm density` / `settings put system font_scale`, na afloop ALTIJD hersteld): klein (720x1280 @ 320 dpi) · standaard (A16, 1080x2340 @ 420) ·
hoog/groot (1080x2520 @ 440) · lettergrootte 1,3× · "weergavegrootte" groot · navigatie met 3 knoppen én met gebaren. Per stap ook gemeten: **elke knop ligt volledig in het zichtbare
scherm** (niet onder de systeembalken of de tabbalk, niet afgekapt) en **tikken landen op de bedoelde knop** (posities komen uit de app zelf, geen vaste pixels). Echte toestellen: Firebase Test Lab (5).
Tikken met vaste coördinaten zijn daarom verboden in flows; alleen via benoemde knoppen of verhoudingen van het scherm.

## 3. De vloeiwandeling (automatisch): `scripts/flow-walk.py`
Loopt op de aangesloten telefoon alle hoofdroutes af en controleert per scherm R2:
- elk tabblad: bereikbaar, en heeft tabbalk of uitweg;
- elk keuzescherm (Explore …): uitweg aanwezig, uitweg tikken brengt je terug op het tabblad (niet vast, niet wit scherm);
- schermhelderheid: geen wit scherm tijdens de wissel.
Uitvoer: een tabel PASS/FAIL per stap. **Eén FAIL = niet klaar.** Draaien in Free (gewone build) én Premium (testbuild met
geforceerd Premium — nooit committen).

Gebruik: `python scripts/flow-walk.py <adb-serial> <free|premium>`

## 4. Wat het protocol niet dekt (en wie dat dan test)
iOS (geen Mac hier), gevoel van haptiek/geluid, echte aankoop (Play-testtrack), horloge via Play-sleutel. Die staan per release
op een aparte lijst voor de operator.
