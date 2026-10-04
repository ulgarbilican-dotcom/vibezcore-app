# VIBEZCORE Haptic System — Definitive Scientific & Technical Specification

**Version:** 1.0
**Status:** Approved design baseline
**Reference implementation:** `src/services/bracelet-haptics.ts` — ronde 3 (4 okt 2026, zie §5–§6 en §10)
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
wordt (bv. 60 bpm = 1 Hz = één cyclus per seconde). Dit is NIET de LRA zelf
op 1 Hz laten draaien — de LRA blijft op zijn eigen resonantie, enkel
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

## 5. Finale tempo-mapping (HERZIEN 4 okt 2026, ronde 3)

> Vervangt de vaste 0,60 / 0,80 / 0,97 / 1,50 / 2,75 Hz-tabel uit commit
> `022edda`. Reden: (1) Motokawa & Kato 2025 vond dat enkel een
> GELEIDELIJK veranderend tempo significant werkt, een vast tempo niet;
> (2) Sleep (36 bpm) lag onder Doppel's bewuste ondergrens van 40 bpm;
> (3) Boost (165 bpm) lag ver boven het hoogste geteste tempo (110 bpm).

**Bottom-up mechanisme.** Gamma/Beta/Alpha/Theta/Delta zijn top-down
labels voor de doeltoestand. Een pols-puls stuurt geen hersengolven
(Pomper 2023: 10 Hz tactiel ritme → geen entrainment). De bottom-up
route loopt via het autonome zenuwstelsel: een ritmische pols-tik wordt
als hartslag gelezen — trager dan de eigen hartslag kalmeert, sneller
activeert. De 5 modi zijn dus 5 eindtempo's op één arousal-as.

**Tempoverloop (Motokawa & Kato 2025, Study 1, vibratie zonder muziek):**
start op de hartslag, daal geleidelijk (75 → 50 bpm in 120 s). Alle
modi volgen hetzelfde verloop-tempo (25 bpm / 120 s) vanaf een
aangenomen rust-hartslag van 75 bpm (Doppel-baseline 75,8) naar hun
eindtempo, en houden dat aan.

| Staat | Eindtempo | Opbouw vanaf 75 bpm | Bewijsniveau |
|---|---:|---:|---|
| Sleep | 40 bpm (0,67 Hz) | ~168 s dalend | 🟠 Doppel's ondergrens; dalend protocol tot hier niet getest |
| Clarity & Relax | 50 bpm (0,83 Hz) | 120 s dalend | 🟢 Motokawa Study 1 (exact) |
| **Calm Control** | **60 bpm (1,0 Hz)** | ~72 s dalend | 🟢 Doppel (−20% onder rust-HR) + Motokawa-verloop |
| Sharp Focus | 90 bpm (1,5 Hz) | ~72 s stijgend | 🟡 Hypothese binnen getest bereik (75–110) |
| Boost | 110 bpm (1,83 Hz) | ~168 s stijgend | 🟢 Valente 2024 (110 bpm, ook pols: HR↑, HRV↓) |

**Waarschuwing (Wang et al. 2023):** sneller dan de eigen hartslag
verhoogt hartslag én zelf-gerapporteerde angst. Boost/Focus = arousal,
niet "zich goed voelen" — en de kalme familie mag nooit sneller dan de
rust-hartslag worden.

**Sleep-claim (Lee et al. 2025, smartwatch):** meer parasympathische
activiteit en ervaren ontspanning, maar GEEN effect op inslaap-maten.
Sleep = "tot rust komen voor het slapen", nooit "sneller inslapen".

**Beperking:** zonder hartslagsensor is 75 bpm een populatie-aanname.
De gouden standaard is closed-loop op de echte hartslag (Doppel-app,
ambienBeat) — mogelijk zodra de smartwatch-hartslag gekoppeld is.

---

## 6. Pulsvorm en amplitude (HERZIEN 4 okt 2026, ronde 3)

**Vorm:** elke modus = lub-dub (dubbele hartslagtik), zoals Doppel's
"double heartbeat-like rhythm". Tweede tik zachter (S2 < S1). Afstand
lub→dub = 30% van de cyclus, max 350 ms (fysiologisch S1–S2-interval).
Weinig tikken per cyclus is bewust: affective-ratings-literatuur vindt
herhaalde korte pulsen "alarming/unpleasant", lange/rustige "pleasant".

**Amplitude:** lager = minder arousal en aangenamer.

| Staat | lub | dub |
|---|---|---|
| Sleep | Soft | Soft |
| Clarity & Relax | Soft | Soft |
| Calm Control | Light | Soft |
| Sharp Focus | Medium | Light |
| Boost | Heavy | Medium |

Op telefoon via `expo-haptics` (Android: Soft/Light = 30/255, Medium =
50, Heavy = 70 — geverifieerd in de package-broncode). React Native's
rauwe `Vibration`-API vuurt altijd op volle kracht en is daarom
ongeschikt.

**Bracelet-firmware (ontwerpregel, nog te bouwen):** de DRV2605L kan
continue amplitude sturen. Daar mag bovenop het hartslagritme een
Apollo-achtige gladde amplitude-envelope komen (patent US11260198:
draaggolf × sinus-envelope, afbouwend voor slaap, opbouwend voor
energie). Dit is 🟡: Apollo's enige peer-reviewed bewijs is Hallihan &
Siegle 2022 (n=22, enkel voor de per persoon meest kalmerende vibe).
Telefoon en Apple Watch kunnen dit niet (enkel losse tikken).

Pulsduur/amplitude blijven **engineering-parameters**: er bestaat geen
literatuur die een universeel optimale waarde voor deze actuator,
plaatsing en golfvorm vastlegt.

---

## 7. Aanvullend bewijs per modus

**Sharp Focus:** een peer-reviewed studie (*IEEE Transactions on
Haptics*, DOI 10.1109/toh.2016.2531662) gebruikte 15 Hz sinusoïdale
vibrotactiele stimulatie op de palm en vond een significante SMR-band-
toename plus verbeterde T.O.V.A.-aandachtsscore. Dit ondersteunt het
bredere principe dat ritmische vibrotactiele stimulatie aandacht kan
beïnvloeden — **niet** dat 90 bpm specifiek getest is, en **niet** dat
een getal binnen het conventionele EEG-delta-bereik vallen betekent dat
een tactiele puls op die frequentie corticale delta-entrainment
veroorzaakt.

**Boost:** bredere snel-vs-traag-wearable-haptiek-onderzoek (o.a.
BoostMeUp, 72 deelnemers, Apple Watch, langzaam vs. snel hartslag-ritme)
ondersteunt de richting (sneller ritme → hogere ervaren
urgentie/arousal). Het eindtempo 110 bpm is rechtstreeks getest door
Valente et al. (UIST 2024, o.a. op de pols): 110 bpm verhoogde de
hartslag en verlaagde HRV t.o.v. 50 bpm. Wang et al. (ICMI 2023): een
snelle hartslag-vibratie verhoogt hartslag én zelf-gerapporteerde angst.

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
> NIET: "60 bpm is wetenschappelijk bewezen kalmte te produceren."

**Sharp Focus:**
> Toegestaan: "sneller ritmisch haptisch patroon, geïnformeerd door
> onderzoek dat toont dat ritmische vibrotactiele stimulatie aandacht en
> cognitieve prestatie kan beïnvloeden."
> NIET: "het ritme brengt je hersenen in bèta en produceert focus."

**Boost:**
> Toegestaan: "sneller, opvallender ritmisch haptisch patroon, ontworpen
> als activerende sensorische cue."
> NIET: "110 bpm activeert direct het sympathisch zenuwstelsel."

**Sleep:**
> Toegestaan: "het traagste ritmische patroon in het VIBEZCORE-systeem,
> ontworpen als laag-tempo sensorische cue."
> NIET: "40 bpm induceert slaap" of "je valt sneller in slaap" (Lee et al.
> 2025 vond met smartwatch-haptiek geen effect op inslaap-maten).

NOOIT gebruiken voor eender welke van deze vijf frequenties: "klinisch
bewezen", "neurologisch optimaal", "hersengolf-specifiek",
"therapeutische frequentie", "gegarandeerd een specifieke fysiologische
staat opwekken" — zie ook CLAUDE.md §1 (geen wetenschaps-/medische
claims, enkel toestand-taal).

---

## 10. Beslissingsgeschiedenis

**Ronde 3, 4 oktober 2026 (operator: "baseer ons op de meest logische
en bewezen wetenschap") — HUIDIGE BASELINE.** Twee onderbouwde families
van passieve kalmerende pols-haptiek vergeleken:
- **A. Hartslag-tikken** trager/sneller dan de eigen hartslag (Doppel,
  Zhou, Motokawa, Valente, Wang) — meerdere onafhankelijke studies,
  getest met losse tikken op de pols.
- **B. Gladde ademgolf** rond 0,1 Hz op een draaggolf (Apollo-patent,
  Hallihan & Siegle) — één peer-reviewed studie (n=22). Het sterke
  0,1 Hz-bewijs uit HRV-biofeedback geldt voor ACTIEF meeademen; passief
  voelen meesleept de ademhaling niet betrouwbaar.

Gekozen: **familie A** voor telefoon en smartwatch (meest bewezen én
het enige wat die toestellen kunnen: losse tikken), met het
Motokawa-verloop (geleidelijk naar het eindtempo, want een vast tempo
was niet significant). Familie B = ontwerpregel voor de bracelet-
firmware, als laag bovenop A, 🟡. Zie §5–§6.

Vorige beslissing (ronde 1, `022edda`: "vaste envelopeHz niet verder
wijzigen") is hiermee vervangen — Motokawa & Kato 2025 is nieuw bewijs
dat precies dat vaste tempo onderuit haalt.

**Ronde 2, 4 oktober 2026 (operator: "er is geen enkel
haptic ritme dat rust gaat brengen, sleep voelt te snel/hard"):** het
RITME (§5) klopte, de PULSVORM niet. Twee fouten, beide nu gefixt in
`src/services/bracelet-haptics.ts`:
1. React Native's rauwe `Vibration`-API vuurt altijd op volle (default)
   amplitude — ongeacht hoe kort/zacht een puls getimed was, voelde hij
   hard aan. Opgelost door over te stappen op `expo-haptics`
   (`Haptics.impactAsync`), dat op Android écht lage amplitudes gebruikt
   (Soft/Light ≈ 12%, Medium ≈ 20%, Heavy ≈ 27% van 255 — geverifieerd
   in de package-broncode).
2. De eerdere implementatie gebruikte een zelfverzonnen 7-pulse
   "sinuszwel" zonder basis in de geciteerde bronnen. Vibrotactiele
   affective-ratings-literatuur is expliciet: herhaalde korte pulsen
   voelen "alarming/unpleasant", lange(re) pulsen "pleasant". Doppel
   zelf is bovendien geen zwel — de eigen productbeschrijving noemt het
   een "double heartbeat-like rhythm" (lub-dub, 2 tikken). Sleep/
   Clarity/Calm Control spelen nu 1-2 echte, zachte tikken per cyclus
   i.p.v. veel micro-tikjes.

Aanvullende bron toegevoegd: Zhou, Murata & Watanabe (2020, IEEE
Haptics Symposium, "The Calming Effect of Heartbeat Vibration") — een
tweede, onafhankelijke hartslag-vibratie-studie die fysiologische
ontspanning (HRV) bevestigt, en een ACM-studie (2023) die toont dat een
VERSNELD hartslagritme angst juist verhoogt — bevestigt waarom de
kalme familie nooit sneller dan rust-hartslag gemaakt mag worden.

Volgende stap blijft **fysieke kalibratie op een echt prototype**, niet
meer literatuuronderzoek — de telefoon-preview is en blijft een
benadering (ander motortype dan de bracelet).

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
- Motokawa, T. & Kato, T. (2025). *Exploring combined vibration and
  music interventions for acute stress reduction: insights from two
  experimental studies.* BMC Psychology, 13, 1100.
  https://doi.org/10.1186/s40359-025-03293-9
- Zhou, Y., Murata, A. & Watanabe, J. (2020). *The Calming Effect of
  Heartbeat Vibration.* IEEE Haptics Symposium, 677–683.
- Wang, R., Zhang, H., Macdonald, S. A. & Di Campli San Vito, P. (2023).
  *Increasing Heart Rate and Anxiety Level with Vibrotactile and Audio
  Presentation of Fast Heartbeat.* ICMI 2023. DOI 10.1145/3577190.3614161
- Valente, A., Lee, D., Choi, S., Billinghurst, M. & Esteves, A. (2024).
  *Modulating Heart Activity and Task Performance using Haptic
  Heartbeat Feedback: A Study Across Four Body Placements.* UIST '24.
  DOI 10.1145/3654777.3676435
- Lee, J. et al. (2025). *Closed-Loop Rhythmic Haptic Biofeedback via
  Smartwatch for Relaxation and Sleep Onset.* ISWC 2025.
  https://arxiv.org/abs/2507.02432
- Pomper, U. (2023). *No evidence for tactile entrainment of attention.*
  Frontiers in Psychology. https://pmc.ncbi.nlm.nih.gov/articles/PMC10250593/
- Apollo Neuroscience — patent US11260198 (*Systems and methods of wave
  generation for transcutaneous vibration*).
- Choi, K. Y. & Ishii, H. (2020). *ambienBeat: Wrist-worn Mobile Tactile
  Biofeedback for Heart Rate Rhythmic Regulation.* TEI 2020.

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
