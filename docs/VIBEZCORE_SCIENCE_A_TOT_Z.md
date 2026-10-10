# VIBEZCORE — Wetenschap & logica van A tot Z

> Eén document met ALLES wat de app doet en waarom: elke techniek, elk
> tempo, elke duur, elke regel — met per punt of het **onderzoek** is of
> een **eigen ontwerpkeuze**. Bedoeld voor de website, App Store-review,
> partners en voor wie later aan de app werkt.
>
> Opgesteld 7 oktober 2026. Bron van waarheid blijft de code; elk punt
> verwijst naar het bestand. Verandert iets in de code, dan hoort het hier
> mee te veranderen.
>
> Verwante documenten: `docs/HAPTIC_RESEARCH_BASIS.md` (diepere
> haptiek-onderbouwing en geschiedenis), `docs/WATCH_PROTOCOL.md`
> (horloge), wetenschapsbundel voor de website
> (`Downloads/vibezcore-science-sources-v2-2026-10-07.html`).

---

## 0. Hoe dit document te lezen

| Label | Betekenis |
|---|---|
| 🟢 **Onderzoek** | Getest in een studie, met een duidelijk resultaat |
| 🟡 **Richting** | De richting is onderzocht; het exacte getal is onze keuze |
| ⚪ **Keuze** | Eigen ontwerpkeuze of traditie, geen studie erachter |
| 🔴 **Tegen / neutraal** | Studie vond geen effect of het omgekeerde — staat erbij om eerlijk te zijn |

**De gouden regel voor alle communicatie:** zeg wat een studie VOND en
wat ons ontwerp IS — beide zijn feiten. Zeg nooit wat VIBEZCORE met
iemand DOET ("vermindert stress", "verbetert focus"): dat vraagt een
eigen studie (zie §8).

---

## 1. Principes

1. **Bottom-up, niet top-down.** De app werkt via het lichaam (adem,
   een voelbaar ritme op de pols), niet "op de hersenen". Een tik op de
   pols synchroniseert geen hersengolven (🔴 Pomper 2023). Het lichaam
   leest een ritmisch tikje als hartslag: trager dan je eigen hart werkt
   kalmerend, sneller activerend.
2. **Toestandstaal.** Kalm, gefocust, uitgerust, energiek. Geen
   diagnose, geen behandeling, geen medische belofte.
3. **Geen mindfulness/meditatie-positionering.** VIBEZCORE = personal
   development audio + breathwork + state control.
4. **Eerlijk over twijfel.** Waar het bewijs dun of tegenstrijdig is,
   staat dat hier — en dus nooit als claim op de website.
5. **Persoonlijk waar het telt, onzichtbaar voor de gebruiker.** De app
   rekent met je eigen hartslag; de gebruiker hoeft geen tempo's te
   begrijpen (zie §3).

---

## 2. Breathwork

Code: `src/data/breath-states.ts`, `src/app/breath-session.tsx`,
`src/app/breath-setup.tsx`.

### 2.1 De vijf toestanden en vijftien technieken

| Toestand | Techniek | Ritme (s) | Neus/mond | Aanbevolen | Onderbouwing |
|---|---|---|---|---|---|
| **Boost** | Diaphragmatic | in 4 · uit 2 | neus | 5 min | ⚪ kortere uitademing = activerend (traditie) |
| | Equal | 3 · 3 | neus | 5 min | ⚪ |
| | Faster Equal | 2 · 2 | in neus, uit mond | 2 min | ⚪ traditie (Bhastrika-geïnspireerd); kort houden, stoppen bij licht gevoel in het hoofd |
| **Sharp Focus** | Coherent | 5 · 5 | neus | 5 min | 🟢 resonantie-ademhaling ~6/min (Lehrer & Gevirtz 2014) |
| | Alternate Nostril | 4 L · 4 R · 4 R · 4 L | neusgaten | 5 min | 🟡 Telles 2017 (aandacht); kwaliteit van studies wisselt |
| | Ujjayi | 5 · 5 | neus, keel | 5 min | ⚪ yoga-traditie |
| **Calm Control** | Extended Exhale | 4 · 6 | neus | 5 min | 🟢 traag ademen kalmeert; 🔴 de verhouding in/uit zelf gaf geen extra effect (Birdee 2023) |
| | Triangle | 4 · houd 4 · 4 | neus | 5 min | ⚪ |
| | Box | 4 · 4 · 4 · 4 | neus | 5 min | 🟢 een van de geteste armen in Balban 2023; twee pauzes → niet voor wie vasthouden onaangenaam vindt |
| **Clarity & Relax** | Equal | 4 · 4 | neus | 5 min | ⚪ |
| | Physiological Sigh | in 2 + 1 · uit 6 | in neus, uit mond | **5 min = het Stanford-protocol** | 🟢 Balban 2023: cyclisch zuchten verbeterde de stemming het meest |
| | Deep Extended Exhale | 4 · 8 | in neus, uit mond | 5 min | 🟢 traag ademen; ⚪ verhouding |
| **Sleep** | Slow Extended Exhale | 5 · 7 | neus | 10 min | 🟢 traag ademen |
| | 4-7-8 | 4 · houd 7 · 8 | in neus, uit mond | **4 cycli** | ⚪ Dr. Andrew Weil: start met 4 cycli, pas na ~een maand naar 8 |
| | 1:2 | 5 · 10 | neus | 10 min | 🟢 traag ademen; ⚪ verhouding |

### 2.2 Dosis en duur

- 🟢 **5 minuten per dag** volstond in de Stanford-studie (Balban 2023,
  108 deelnemers, 1 maand) voor betere stemming en een lagere
  ademhalingsfrequentie in rust → daarom is 5 min bijna overal de
  aanbevolen duur.
- 🟢 **5, 10, 15 en 20 minuten** traag ademen werkten tijdens de sessie
  even goed (Laborde 2021) → korte sessies zijn volwaardige sessies;
  langere sessies geven vooral meer nawerking.
- 🟢 **12 weken** regelmatig traag ademen verlaagde angst significant
  (Birdee 2023, 100 volwassenen).
- ⚪ De kortere en langere opties per techniek (1–20 min) zijn eigen
  keuzes rond die ankers, met per optie een concrete reden in de app.

### 2.2b Duur en ritme groeien met ervaring (`src/utils/breath-level.ts`, sinds 6 okt 2026)

Twee aparte assen: het label Beginner / Intermediate / Advanced bij een
techniek = moeilijkheid van de TECHNIEK (vast). Daarnaast de ervaring van de
GEBRUIKER met die techniek: start uit de onboarding (`experienceLevel`),
daarna per techniek één stap per 12 afgewerkte sessies van díe techniek.

- 🟢 Geen dosis-respons boven 5 min (Bentley 2023 review; Laborde 2021) →
  langere sessies voor gevorderden zijn een KEUZE, nooit "beter" of "meer
  effect" — die claim maakt de app niet.
- 🟢 Opbouw zit vooral in het RITME: box-fasen per persoon 3–4 → 5–6 → 8–10 s
  (Balban 2023); beginners vertragen over weken (Ma 2017).
- ⚪ 4-7-8: eerst 4 cycli, pas na een maand 8 (Weil) — de app wacht 28 dagen.
- 🟢 Protocollen met ervaren deelnemers gebruiken 15–20 min.
- ⚪ 12 sessies per stap = eigen keuze, afgeleid van "≥ 6×/week, 2 weken"
  (Bentley 2023), geen onderzoeksgetal.
- ⚪ Een ervaren gebruiker die een techniek nog nooit deed, begint één stap
  lager tot hij er 12 sessies van gedaan heeft (vertrouwdheid telt).
- In de app: gaat de aanbeveling een stap omhoog, dan één keer
  "Recommended · built up" in de cirkel; nooit stil.

| Techniek | Beginner | Gemiddeld | Gevorderd | Ritme |
|---|---|---|---|---|
| Coherent | 5 | 10 | 20 | — |
| Alternate Nostril | 5 | 10 | 15 | 4 → 4 → 5 s |
| Ujjayi | 5 | 10 | 15 | — |
| Extended Exhale | 5 | 10 | 15 | — |
| Triangle | 5 | 5 | 10 | 3 → 4 → 5 s |
| Box | 5 | 5 | 5 | 4 → 5 → 6 s |
| Equal (Clarity) | 5 | 5 | 10 | — |
| Deep Extended Exhale | 5 | 5 | 10 | 4/6 → 4/8 |
| Physiological Sigh | 5 | 5 | 5 | — |
| Slow (Sleep) | 10 | 15 | 20 | 4/8 → 5/10 |
| Slow Extended Exhale | 10 | 10 | 15 | — |
| 4-7-8 | 4 cycli | 4 cycli | 8 cycli | — |
| Diaphragmatic / Equal (Boost) | 3 | 3 | 5 | — |
| Faster Equal | 2 | 2 | 2 | — |

### 2.3 Veiligheid (in de app)

- Technieken met adem vasthouden (Box, 4-7-8) dragen een waarschuwing;
  4-7-8 begint bewust met 4 cycli.
- Faster Equal: kort, stoppen bij een licht gevoel in het hoofd.
- Health & Safety (`src/data/legal-content.ts`): nooit tijdens rijden,
  fietsen, zwemmen of machines bedienen; stoppen bij duizeligheid.

### 2.4 Begeleiding: beeld, stem en trilling uit één bron

- ⚪ Beeld, stem en trilling starten vanuit dezelfde fase-overgang;
  de stem start 400 ms vóór de fase omdat opnames traag inzetten.
- ⚪ Gratis kennismaking: ongeveer 30 seconden (zoveel rondes als in
  30 s passen, minstens één), daarna de paywall.

---

## 3. State Control — een hartslagritme op de pols

Code: `src/services/bracelet-haptics.ts`, `src/services/resting-pulse.ts`,
`src/utils/pulse-detect.ts`, `src/components/RhythmSheet.tsx`,
`src/components/PulseMeter.tsx`, `src/app/bracelet-control.tsx`.

### 3.1 Het mechanisme

- 🟢 Een **trager** hartslagritme op de pols dan je eigen hart → kalmer:
  Azevedo 2017 (doppel, speech-angst), Costa 2019 (BoostMeUp, Cornell:
  minder angst + betere rekenscores onder druk).
- 🟢 Een **sneller** ritme → activerend, hartslag omhoog (Valente 2024)
  — maar ook meer angst en slechtere scores (Wang 2023, BoostMeUp).
- 🟢 **Geleidelijk** veranderen werkt, een vast tempo meteen niet
  (Motokawa & Kato 2025).
- 🔴 Tegenover een **andere vibratie** (in plaats van geen vibratie) was
  er geen voordeel na 8 weken (Bartlett 2024). We beweren dus nooit dat
  ons exacte ritme het verschil maakt.
- 🔴 Tikken synchroniseren geen hersenritme (Pomper 2023).

### 3.2 De vorm van één slag

- 🟡 **Lub-dub**, de tweede tik zachter — doppel's "double heartbeat-like
  rhythm". Afstand lub → dub = 30% van de cyclus, maximaal 350 ms
  (⚪ fysiologisch S1–S2 als model).
- ⚪ Telefoons zonder sterkteregeling (bv. Galaxy A16) regelen de
  sterkte via de duur van de tik.
- ⚪ Apple Watch: enkel de vaste haptische types; bij Boost alleen de
  lub (twee tikken < 200 ms versmelten).
- ⚪ Einde: 600 ms stilte, dan drie oplopende tikken — voelbaar ook met
  het scherm op slot, zonder geluid.

### 3.3 Het verloop van een sessie

1. **10 seconden** op het **begintempo** (⚪ iso-principe uit de
   muziektherapie: eerst aansluiten, dan leiden — Motokawa hield ook
   10 s vast).
2. **Glijden naar het eindtempo**:
   - Clarity & Relax, Sleep: **2 minuten** (🟢 Motokawa: 2 min glijden
     werkte, meteen springen niet).
   - Calm Control, Sharp Focus, Boost: **10 seconden** (🟡 doppel en
     Valente gingen meteen naar hun tempo; 10 s haalt enkel de schok
     eruit).
3. **Eindtempo aanhouden** tot het einde (🟡 of het effect blijft na het
   glijden is niet gemeten).
4. **Pauze:** hervatten binnen 2 min loopt verder; later begint opnieuw
   (⚪).

### 3.4 Begintempo en eindtempo — "Match your rhythm"

**R = je rusthartslag.** Begintempo = R (of je hartslag van nu, §3.5).
Eindtempo = een vast deel van R:

| Toestand | Eindtempo | R = 66 | R = 70 (gemiddeld) | Label |
|---|---|---:|---:|---|
| Sharp Focus | 90% van R, min 53 | 59 | 63 | 🟡 richting = BoostMeUp (sneller dan rust schaadde focus); 10% is keuze |
| Calm Control | 80% van R, min 50 | 53 | 56 | 🟢 ~20% onder de hartslag (doppel), 0,8 × hartslag (BoostMeUp) |
| Clarity & Relax | 70% van R, min 45 | 46 | 49 | 🟡 Motokawa daalde tot ~50 bpm |
| Sleep | 55% van R, min 40 | 40 | 40 | ⚪ 40 = doppel's ondergrens |
| Boost | 110 bpm vast | 110 | 110 | 🟢 Valente 2024 |

**Regels (allemaal ⚪ keuze):**
- **Nooit sneller dan rust:** de kalme toestanden eindigen altijd
  minstens 2 bpm onder R. Een veiligheidsgrens, geen werkzame dosis.
  Speelt enkel bij R onder ~55 (sporters); de toestanden liggen daar
  noodzakelijk dicht bij elkaar door de ondergrens van 40.
- **Nooit onder 40 bpm** (doppel: daaronder voelt het onnatuurlijk).
- **Waarde ligt vast per sessie:** een nieuwe meting tijdens een lopende
  sessie verandert het ritme niet halverwege.

**Doelgroep-logica:** drukke, gestreste mensen hebben vaak een hartslag
van 70–90+. Daar heeft de schaal de meeste ruimte en is "trager dan je
hart" het best onderbouwd. De sporter-grens is een randgeval.

### 3.5 Waar R vandaan komt

| Bron | Hoe | Status |
|---|---|---|
| Meting met de camera | vinger op de achtercamera + flits, vast 30 s | ✔ gebouwd (Android getest, iOS nog niet) |
| Zelf invullen | draaiwiel 40–100 | ✔ gebouwd |
| Gemiddelde | 70 bpm (gemiddelde volwassene) | ✔ standaard voor wie overslaat |
| Horloge | Apple Health / Health Connect rusthartslag | ⏳ fase 3 |

**Regels (⚪):**
- **R = de laagste meting van de laatste 60 dagen.** Rust is per
  definitie je laagste waarde; een meting na de trap verpest niets.
- **Uitschieter:** één meting > 8 bpm onder de op één na laagste telt
  pas na een tweede, bevestigende meting.
- **> 100 bpm** = geen rustwaarde: niet bewaard, "Sit still for a
  minute, then try again".
- **Zelf ingevuld** geldt tot er opnieuw gemeten wordt.
- **"Use an average"** wist alle eigen waarden (privacy).
- **Na 30 dagen** een zachte "measure again" (stipje in de cirkel,
  Activity, Profile).
- **Hartslag van nu:** een verse meting **boven** R is 15 minuten lang
  het begintempo van de volgende sessie (iso-principe; Motokawa startte
  op de hartslag van dat moment). Eindtempo blijft op R. In de cirkel:
  "♥ 69 bpm · now". Na de start van een sessie, of na 15 min, weer R.
- **Telefoon zonder horloge:** startpunt = R; vóór elke sessie meten is
  bewust NIET de standaard (te omslachtig, kleine winst, en een meting
  ervoor nodigt uit tot een "meting erna" = een effectclaim).

**Waar de gebruiker dit ziet en wijzigt:** het hartje in de cirkel
("♥ 66 bpm ›"), Profile → Your rhythm, Activity → Your rhythm. De eerste
keer State Control vraagt de app het één keer ("Start at your own
pace": meten / zelf invullen / gemiddelde).

### 3.6 De camerameting (fotoplethysmografie)

- 🟢 Principe: bij elke hartslag laat de vingertop iets minder licht
  door; de gemiddelde rood/groen-waarde van het beeld golft mee.
- **Werkwijze** (`src/utils/pulse-detect.ts`):
  1. 30 beelden/s, enkel het gemiddelde van het midden (geen beelden
     bewaard of verstuurd);
  2. drift eruit (lopend gemiddelde 1 s), licht gladstrijken;
  3. twee onafhankelijke schattingen: **autocorrelatie** en **slagen
     tellen** (mediane tijd tussen slagen);
  4. alleen een uitkomst als beide het eens zijn (binnen 10%), het
     signaal duidelijk periodiek is en de slagen regelmatig zijn
     (≥ 70% binnen 15%); rood of groen kanaal, het duidelijkste wint.
- **Verloop:** vinger erop → 0,5 s stil → exact 30 s meten → uitkomst (operator 9 okt 2026: "elke keer exact 30 seconden"; getest: pols 74, telefoon 76). Operator 9 okt 2026: "liever langer, als het maar correct is". Eindcontrole: het volledige venster en de laatste 10 s apart moeten binnen 7% overeenkomen, anders "Measurement failed" (geen verlenging). Het live getal tijdens het meten gebruikt dezelfde strenge analyse, mediaan van de laatste 5 schattingen, max. 3 bpm verandering per slag (eigen keuze, horloge-gedrag).
  of "try again". Geen trillingen tijdens het meten.
- **Getest:** op nagebootste signalen binnen ±1 bpm (55–110 bpm, met
  ruis, drift, haperende beelden, verzadigd rood); geen uitkomst bij
  ruis zonder hartslag. Op een echte vinger: 68 en 66 bij de operator
  (7 okt) — **nog niet vergeleken met een referentie**.
- **Release-eis:** 10 personen naast een horloge/borstband; 9 van de 10
  binnen ±5 bpm (⏳ te doen). Literatuur: vingertop-camera in rust
  doorgaans binnen 3–5 bpm.
- **Geen medisch hulpmiddel.** Enkel om het ritme in te stellen.
  Apple 1.4.1: hartslag is niet verboden (bloeddruk, temperatuur,
  bloedsuiker, zuurstof wel); geen diagnose, geen nauwkeurigheidsclaim.

### 3.7 Aanbevolen sessieduur

| Toestand | Aanbevolen | Bereik | Reden (⚪ keuze binnen 🟡 richting) |
|---|---:|---|---|
| Boost | 10 min | 8–20 | snel ritme werkt snel; lang kan onrustig worden — "keep it short" |
| Sharp Focus | 15 min | 15–30 | één gefocust blok |
| Calm Control | 18 min | 15–30 | trage ritmes werkten binnen minuten; eigen waarde t.o.v. de andere toestanden |
| Clarity & Relax | 25 min | 20–45 | tijd voor 2 min glijden + een lange rustige fase |
| Sleep | 30 min | 30–50 | afbouwen; dekt de gewone inslaaptijd |

### 3.8 Quick Chill en Quick Boost

- Eén tik op het keuzescherm, **5 minuten**, meteen bezig.
- **Quick Chill** = de korte versie van Clarity & Relax: 2 min glijden
  naar 70% van je rusthartslag (bij het gemiddelde: 49). 🟢 Vrijwel
  exact Motokawa Study 1 (eigen hartslag → ~50 bpm in 2 min, effect na
  2–3,5 min).
- **Quick Boost** = Boost, 110 bpm. 🟢 Valente 2024.
- Waarom 5 min: 🟢 de duur waarin de studies hun effect maten.
- Waarom niet één vaste waarde voor iedereen bij Chill: een vaste 48
  werkt voor bijna iedereen, maar tikt bij een sporter (rust 45) net te
  snel. Wie niet meet, krijgt precies die vaste waarde (het gemiddelde);
  wie meet, krijgt automatisch de persoonlijke versie.
- ⚪ Enkel telefoon + horloge: de bracelet-firmware kent nog geen sessie
  korter dan het minimum per modus.

### 3.9 Gratis voorproef

- "Try 30 seconds free": hetzelfde begin als een echte sessie (10 s
  begintempo); Clarity & Relax en Sleep glijden **versneld** (12 s i.p.v.
  2 min) zodat je binnen 30 s het eindritme voelt — de app zegt dat
  ("Sped up for the preview"). De andere toestanden zijn exact de eerste
  30 s van een sessie.

### 3.10 Horloge

- Het horloge speelt zelf exact dezelfde curve (`docs/WATCH_PROTOCOL.md`):
  de telefoon stuurt begintempo, eindtempo, glijtijd en resterende tijd.
  Bevestigt het horloge, dan zwijgt de telefoon — één ritme.

---

## 4. Audio Library

- Personal development-audio rond de vier pijlers (Psychological
  Resilience, Inner Sovereignty, Social Mastery, Strategic Execution &
  Wealth). Geen wetenschappelijke effectclaims.
- **Binaural beats** mag als naam van een audiotechniek; nooit uitgelegd
  met hersengolven of "synchroniseren".

---

## 5. Smart Bead Bracelet

- **Rol (operator, 7 okt 2026):** premium upgrade naast de Premium-app,
  "nature meets tech" — tech (eigen trilmotor, ritme op je hartslag),
  fashion (verwisselbare kralensets in stainless steel, echte edelstenen),
  wellness (State Control, discreet). Edelstenen staan voor natuur en
  vakmanschap, nooit voor een werking.
- **Wetenschap:** de werking zit in het ritme (§3). Dat de bracelet beter
  werkt dan een horloge is NIET getest en wordt niet beweerd.

- Hardware: nRF52832 + DRV2605L + LRA. BLE-contract spec v2.3 (bindend):
  modus + duur + start/stop; de bracelet draait autonoom.
- **Nog niet persoonlijk:** het contract heeft geen veld voor een
  begintempo. "Match your rhythm" en Quick-sessies op de bracelet vragen
  een contract- en firmwarewijziging → operatorbeslissing.

---

## 6. Woordkeuze

| Wel | Nooit |
|---|---|
| Built on research · Bottom-up by design | Backed by science · clinically/scientifically proven |
| Inspired by research on heartbeat-like touch | Brainwaves · syncs · entrainment |
| "In a Stanford/Cornell study, …" + exact wat er gevonden werd | Reduces anxiety / improves focus — als VIBEZCORE-effect |
| Designed to help you feel calmer / more alert / ready to rest | Fall asleep faster |
| Tuned to your own heartbeat · Starts at your resting heart rate | Measures your heart health / stress / HRV |
| **heart rate** / **resting heart rate** (zoals Apple Health) | "pulse" — verwarrend (operator, 7 okt 2026) |
| Edelstenen: natural, genuine, crafted, meaningful to you · "nature meets tech" | Edelstenen met helende, kalmerende of energetische kracht ("rose quartz calms") |
| Binaural beats (techniek) | Mindfulness · meditation · yoga nidra |
| Not a medical device | Diagnose, behandelen, voorkomen |

**Websitezinnen die gewoon waar zijn:**
- "In a Stanford study, five minutes of daily breathwork improved mood
  within a month."
- "Twelve weeks of regular slow breathing significantly reduced anxiety
  in a 100-person trial."
- "In a Cornell study, a slow heartbeat rhythm from a smartwatch helped
  people stay calmer and perform better under pressure."
- "Every session starts at your own resting heart rate — then settles just
  below it, the way research found a slower heartbeat rhythm helps
  people stay calm."
- "Quick Chill: five minutes, one tap — the length researchers used."

---

## 7. Bronnen

| Bron | Wat | Label | Zelf gecontroleerd |
|---|---|---|---|
| Azevedo et al. 2017, *Sci Rep* 7:2285 | traag hartslagritme (doppel) → minder angst vóór een speech; HR veranderde niet; controle = toestel uit; door doppel gefinancierd | 🟡 | ✔ (bundel v1) |
| Costa et al. 2019, *IMWUT* (BoostMeUp, Cornell) | traag ritme → minder angst, hogere HRV, betere scores; snel → omgekeerd | 🟢 | ✔ 7 okt |
| Motokawa & Kato 2025, *BMC Psychology* | geleidelijk dalend ritme verlaagde spanning, vast tempo niet; 2–3,5 min; 42 mannen; ook cortisol; auteurs bij POLA | 🟡 | ✔ 7 okt |
| Valente et al. 2024, *UIST* | 110 bpm verhoogt de hartslag t.o.v. 50 bpm | 🟡 | ✔ (bundel v1) |
| Wang et al. 2023, *ICMI* | snelle hartslagtrilling verhoogt hartslag én angst | 🟢 | ✔ (bundel v1) |
| Lee et al. 2025, *ISWC* | ontspanning kort na stimulatie; geen effect op inslapen | 🟡 | ✔ abstract |
| Bartlett et al. 2024, *PLOS Digital Health* | doppel vs vergelijkingsritme, 8 weken: geen verschil | 🔴 | ✔ 7 okt |
| Pomper 2023, *Front Psychol* | geen tactiele entrainment van aandacht | 🔴 | ✔ |
| Balban et al. 2023, *Cell Rep Med* (Stanford) | 5 min/dag ademwerk → betere stemming; cyclisch zuchten best | 🟢 | ✔ |
| Birdee et al. 2023, *Compl Ther Med* | traag ademen ↓ angst over 12 weken; verhouding in/uit geen extra effect | 🟢 / 🔴 | ✔ 7 okt |
| Lehrer & Gevirtz 2014, *Front Psychol* | resonantie-ademhaling ~6/min | 🟢 | ✔ |
| Laborde et al. 2021 | 5/10/15/20 min traag ademen even goed tijdens de sessie | 🟡 | ✔ |
| Telles et al. 2017 | wisselend-neusgat-ademen en aandacht | 🟡 | gedeeltelijk |
| Weil — 4-7-8 | traditie; start met 4 cycli | ⚪ | ✔ |
| Costa 2016; Patchitt 2025; Kim 2025; Zhou 2020; korte yoga-nidra-studie | genoemd in de externe review | — | ✘ niet gelezen — niet als claim gebruiken |

---

## 8. Open punten

- ⏳ **Nauwkeurigheidstest camerameting** (10 personen, ±5 bpm, 9/10).
- ⏳ **iPhone:** camerameting nog nooit getest (iOS-build nodig).
- ⏳ **Fase 3:** rusthartslag + hartslag van nu van het horloge
  (Apple Health / Health Connect) — dan start elke sessie automatisch op
  je hartslag van dat moment.
- ⏳ **Bracelet:** begintempo en korte sessies vragen een contract- en
  firmwarewijziging.
- ⏳ **Eigen studie** (35–40 personen, echt ritme vs andere vibratie):
  de enige weg naar "in onze eigen test" als claim.
- ⏳ **Website/app-copy** nog te herschrijven: "Backed by science" →
  "Built on research"; teksten die zeggen dat een langere uitademing
  extra kalmeert (`breath-states.ts`, `instant-feel.ts`).

---

## 9. Beslissingslog (State Control-tempo)

| Datum | Beslissing |
|---|---|
| 4 okt 2026 | Ronde 3: hartslagtikken met Motokawa-verloop; vaste eindtempo's 40/50/60/90/110; aangenomen rust 75 |
| 7 okt 2026 | Calm Control aanbevolen 18 min (eigen waarde per toestand) |
| 7 okt 2026 | Externe review: bundel v2 met eerlijke labels en tegenbewijs |
| 7 okt 2026 | Ronde 4 "Match your rhythm": start op eigen rusthartslag; eindtempo = deel van R; Sharp Focus van boven naar onder rust |
| 7 okt 2026 | Camerameting (fase 2), laagste-meting-regel, uitschieterregel, hartslag-van-nu als startpunt (15 min) |
| 7 okt 2026 | Nooit sneller dan rust (min 2 bpm onder R) |
| 7 okt 2026 | Quick Chill / Quick Boost, 5 min |
| 7 okt 2026 | **Geen hartslagmeting in "How do you feel?"**: het gevoel van de gebruiker bepaalt de ademsessie (🟢 ademstudies maten effect op gevoel; geen studie kiest techniek op hartslag); meten zou de snelheid van die functie breken. Hartslag blijft de kern van State Control. Later (fase 3) mag een verse horloge-meting stil de duur bijstellen, zonder extra stap |

---

*VIBEZCORE is geen medisch hulpmiddel en diagnosticeert, behandelt of
voorkomt geen enkele aandoening. De studies hierboven zijn niet met
VIBEZCORE zelf uitgevoerd.*
