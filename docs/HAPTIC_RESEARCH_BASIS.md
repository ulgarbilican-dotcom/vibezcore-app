# VIBEZCORE Haptic System — Definitive Scientific & Technical Specification

**Version:** 1.0
**Status:** Approved design baseline
**Reference implementation:** `src/services/bracelet-haptics.ts` — commit `022edda`
**Geverifieerd:** elke citatie in dit document is apart gecheckt tegen de
originele publicatie (4 oktober 2026) — niet overgenomen op gezag.

---

## 1. Doel

VIBEZCORE gebruikt ritmische vibrotactiele stimulatie via een draagbare
armband op de pols, rond vijf gebruikers-toestanden: Sleep, Clarity &
Relax, Calm Control, Sharp Focus, Boost.

Dit document legt de haptische architectuur, frequentie-mapping,
bewijsniveau per modus en de grenzen van wat je erover mag claimen vast.

**Het systeem is research-informed, niet klinisch gevalideerd als
vijf-staten therapeutische interventie.**

---

## 2. Fundamentele architectuur: twee frequentiedomeinen

### A. Actuator/carrier-frequentie
De fysieke trilling van de LRA zelf. Genoemde actuator: **Vybronics
VG0640001D** (210 Hz resonantie, 1,8 Vrms, 0,90 Grms, max. 15 ms rise /
70 ms fall — specs geverifieerd tegen de fabrikant-datasheet). **Niet
bevestigd dat dit het daadwerkelijke onderdeel in de VIBEZCORE-bracelet
is** — enkel dat een onderdeel met deze naam en specs echt bestaat.

### B. Temporele modulatie/pulsritme
De veel tragere ritmische structuur die op de actuator-output gelegd
wordt (bv. 0,97 Hz = één cyclus per ~1,03 sec). Dit is NIET de LRA zelf
op 0,97 Hz laten draaien — de LRA blijft op zijn eigen resonantie, enkel
het ritme van de pulsen verandert. Dit onderscheid is fundamenteel voor
de architectuur.

---

## 3. Bewijsniveaus

- **Direct bewijs** — onderzoek dat een zeer vergelijkbare interventie test.
- **Analoog bewijs** — onderzoek naar een nauw verwant wearable/haptisch mechanisme.
- **Mechanistisch bewijs** — onderzoek dat een relevant fysiologisch/perceptueel mechanisme ondersteunt.
- **Ontwerphypothese** — een VIBEZCORE-specifieke keuze gebaseerd op bovenstaande, niet rechtstreeks in een VIBEZCORE-trial getest.

Dit onderscheid moet in alle technische én marketing-documentatie
overeind blijven.

---

## 4. Sterkste directe analogie: Doppel

Azevedo et al. (2017), *Scientific Reports* 7, art. 2285 — RCT met een
pols-wearable die een hartslag-achtig ritme geeft, **zonder expliciete
ademhalings-synchronisatie**, getest tijdens anticipatie op een
publieke speech (een gevalideerd sociaal-stress-paradigma).

Stimulatie: ~20% onder rust-hartslag, gemiddeld **58,2 BPM** (range
40–65 BPM). Resultaat: lagere skin-conductance-toename EN lagere
zelfgerapporteerde angst in de actieve groep vs. controle.

Dit is de sterkste directe analogie voor VIBEZCORE's niet-ademhalings-
bracelet-haptiek, precies omdat: tactiel, via de pols, wearable, geen
ademoefening vereist, fysiologische arousal gemeten, subjectieve angst
gemeten, actieve conditie significant beter dan controle.

---

## 5. Finale frequentie-mapping

| Staat | Ritme | Cyclus | Bewijsniveau |
|---|---:|---:|---|
| Sleep | 0,60 Hz | 1667 ms | 🟠 Extrapolatie |
| Clarity & Relax | 0,80 Hz | 1250 ms | 🟠 Interpolatie |
| **Calm Control** | **0,97 Hz** | **1031 ms** | 🟢 Sterke directe analogie (Doppel) |
| Sharp Focus | 1,50 Hz | 667 ms | 🟡 Ontwerphypothese |
| Boost | 2,75 Hz | 364 ms | 🟡 Ontwerphypothese |

Volgorde is bewust strikt monotoon: Sleep → Clarity & Relax → Calm
Control → Sharp Focus → Boost, met oplopende temporele dichtheid.

**Calm Control (0,97 Hz) is het enige punt met een kwantitatief sterke
match tegen een gepubliceerde RCT** (58,2 BPM ≈ 0,97 Hz). Sleep en
Clarity & Relax verlengen het trage-ritme-principe naar nog tragere
ontwerpwaardes. Sharp Focus past bredere literatuur toe over ritmische
haptiek en aandacht (zie §7) zonder te claimen dat 1,50 Hz zelf getest
is. Boost past het bredere snel-vs-traag-arousalprincipe toe zonder te
claimen dat 2,75 Hz klinisch bewezen sympathische activering geeft.

---

## 6. Pulsduur en sparse-pulse vs. pulse-train

| Staat | Pulsduur | Patroon |
|---|---:|---|
| Sleep | 250 ms | sparse-pulse |
| Clarity & Relax | 220 ms | sparse-pulse |
| Calm Control | 200 ms | sparse-pulse |
| Sharp Focus | 200 ms | pulse-train |
| Boost | 120 ms | pulse-train |

Dit zijn **engineering-parameters**, geen zelfstandig wetenschappelijk
gevalideerde therapeutische waardes — er bestaat geen literatuur die een
universele optimale pulsduur voor VIBEZCORE's specifieke actuator,
plaatsing, amplitude en golfvorm vastlegt. De VG0640001D's 15 ms
rise-tijd en 70 ms fall-tijd betekenen bovendien dat de elektrische
AAN/UIT-timing niet 1-op-1 de mechanische golfvorm is die de gebruiker
voelt.

Trage staten (Sleep/Clarity/Calm Control) gebruiken sparse-pulse: een
lage-dichtheid ritmische cue. Actieve staten (Focus/Boost) gebruiken
pulse-train: hogere dichtheid, directer waarneembaar/salient. Dit is een
product-ontwerpkeuze, geen klinisch gevalideerde classificatie.

---

## 7. Aanvullend bewijs per modus

**Sharp Focus:** een peer-reviewed studie (*IEEE Transactions on
Haptics*, DOI 10.1109/toh.2016.2531662) gebruikte 15 Hz sinusoïdale
vibrotactiele stimulatie op de palm en vond een significante SMR-band-
toename plus verbeterde T.O.V.A.-aandachtsscore. Dit ondersteunt het
bredere principe dat ritmische vibrotactiele stimulatie aandacht kan
beïnvloeden — **niet** dat 1,50 Hz specifiek getest is, en **niet** dat
een getal binnen het conventionele EEG-delta-bereik vallen betekent dat
een tactiele puls op die frequentie corticale delta-entrainment
veroorzaakt.

**Boost:** bredere snel-vs-traag-wearable-haptiek-onderzoek (o.a.
BoostMeUp, 72 deelnemers, Apple Watch, langzaam vs. snel hartslag-ritme)
ondersteunt de richting (sneller ritme → hogere ervaren
urgentie/arousal), niet het exacte getal 2,75 Hz.

**Bredere evidentie:** Lee et al. (2026), *Affective Wearable Haptic
Interventions: A Systematic Literature Review*, Proceedings of the ACM
on IMWUT, DOI 10.1145/3790116 — systematische review van 83 studies.
Ondersteunt de brede propositie dat wearable haptiek een affect-
regulatie-interface kan zijn; stelt GEEN universeel optimale frequentie
vast.

---

## 8. Verschil met PIV

PIV (Stanford/CHI 2020, PIV++) is relevant voor de bredere architectuur
(hoogfrequente carrier + laagfrequente envelope), maar gebruikt een
ANDER mechanisme dan VIBEZCORE: PIV's haptiek is ontworpen om
ademhaling te GELEIDEN/synchroniseren. VIBEZCORE's bracelet geeft een
ritmische haptische cue ZONDER ademhalings-synchronisatie te vereisen
(breathwork is een losse, optionele laag). PIV moet dus geciteerd worden
als steun voor het bredere concept "wearable ritmische vibrotactiele
regulatie", niet als directe validatie van VIBEZCORE's niet-ademhalings-
Sleep-frequentie.

---

## 9. Toegestane en niet-toegestane claims

**Algemeen, wetenschappelijk verantwoord:**
> VIBEZCORE gebruikt ritmische haptische patronen geïnspireerd op
> onderzoek naar wearable tactiele stimulatie, fysiologische regulatie,
> aandacht en arousal. Elke staat gebruikt een ander temporeel ritme,
> van tragere kalmerende patronen tot snellere activerende patronen. De
> frequentie-mapping is een door VIBEZCORE ontworpen systeem,
> geïnformeerd door gepubliceerd onderzoek — geen set klinisch
> voorgeschreven frequenties.

**Calm Control:**
> Toegestaan: "geïnformeerd door onderzoek naar traag, hartslag-achtig
> tactiel ritme via de pols, dat fysiologische arousal en subjectieve
> angst verminderde tijdens experimenteel opgewekte sociale stress."
> NIET: "0,97 Hz is wetenschappelijk bewezen kalmte te produceren."

**Sharp Focus:**
> Toegestaan: "sneller ritmisch haptisch patroon, geïnformeerd door
> onderzoek dat toont dat ritmische vibrotactiele stimulatie aandacht en
> cognitieve prestatie kan beïnvloeden."
> NIET: "1,50 Hz brengt de hersenen in delta en produceert focus."

**Boost:**
> Toegestaan: "sneller, opvallender ritmisch haptisch patroon, ontworpen
> als activerende sensorische cue."
> NIET: "2,75 Hz activeert direct het sympathisch zenuwstelsel."

**Sleep:**
> Toegestaan: "het traagste ritmische patroon in het VIBEZCORE-systeem,
> ontworpen als laag-tempo sensorische cue."
> NIET: "0,60 Hz induceert slaap."

NOOIT gebruiken voor eender welke van deze vijf frequenties: "klinisch
bewezen", "neurologisch optimaal", "hersengolf-specifiek",
"therapeutische frequentie", "gegarandeerd een specifieke fysiologische
staat opwekken" — zie ook CLAUDE.md §1 (geen wetenschaps-/medische
claims, enkel toestand-taal).

---

## 10. Finale beslissing

**De huidige `022edda`-configuratie is goedgekeurd als V1-baseline.**
Niet verder wijzigen op basis van de tot nu toe doorgenomen literatuur —
meer literatuuronderzoek levert geen tweede Doppel-achtig bewezen punt
voor de overige vier modi op, want dat bestaat niet. Dit is het plafond
van wat wetenschappelijk onderbouwbaar is zonder een eigen prototype te
testen. Volgende stap is **fysieke kalibratie op een echt prototype**,
niet meer onderzoek.

---

## 11. Primaire bronnen

- Azevedo, R. T., Bennett, N., Bilicki, A., Hooper, J., Markopoulou, F.,
  & Tsakiris, M. (2017). *The calming effect of a new wearable device
  during the anticipation of public speech.* Scientific Reports, 7,
  2285. https://www.nature.com/articles/s41598-017-02274-2
- Miri, P. et al. *PIV: Placement, Pattern, and Personalization of an
  Inconspicuous Vibrotactile Breathing Pacer* (ACM TOCHI) / *PIV++*
  (CHI 2020). http://stanford.edu/~parism/PIV++/Miri_PIV++.pdf
- *Rhythmic Haptic Stimuli Improve Short-Term Attention.* IEEE
  Transactions on Haptics. DOI: 10.1109/toh.2016.2531662
- Hallihan, C. & Siegle, G. J. (2022). *Effect of vibroacoustic
  stimulation on athletes recovering from exercise.* European Journal
  of Applied Physiology, 122, 2427–2435.
- Lee et al. (2026). *Affective Wearable Haptic Interventions: A
  Systematic Literature Review.* Proceedings of the ACM on IMWUT.
  DOI: 10.1145/3790116
- Vybronics VG0640001D — fabrikant-datasheet (LRA-specificaties).

---

## Wetenschappelijke disclaimer

Dit document beschrijft een research-informed productontwerp. Het
stelt niet vast dat VIBEZCORE een medische aandoening behandelt,
voorkomt, diagnosticeert of geneest, en stelt niet vast dat een
individuele frequentie bij elke gebruiker een specifieke fysiologische
of psychologische uitkomst zal produceren. De vijf-frequentie-mapping is
een VIBEZCORE-engineering-specificatie, geïnformeerd door gepubliceerd
bewijs, en moet experimenteel gevalideerd worden vóór ze als klinisch of
fysiologisch gevalideerd omschreven mag worden.
