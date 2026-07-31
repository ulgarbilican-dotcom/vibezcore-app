# ONTWERP — Sessieduur per ademsessie

> **Status: VOORSTEL. Nog niet doorgevoerd in de app.**
> Aangeleverd door de operator op 31 juli 2026, herschreven op dezelfde
> dag nadat de oorspronkelijke onderbouwing niet houdbaar bleek.
> De app draait op dit moment nog één vaste lengte per sessie.
> Zie "Open punten" onderaan voor wat nog een beslissing vraagt.

Doel: de gebruiker kiest zelf hoe lang een sessie duurt, in plaats van
één vaste lengte per state.

---

## Wat er in deze versie veranderd is

De eerste opzet zette onder elke sessie een blok **Scientific Basis**
met daarin varianten van "Recommended durations are based on research
into...". Dat is niet vol te houden. Er bestaat onderzoek naar
ademtempo — vijf seconden in, vijf seconden uit, dat soort dingen — maar
geen onderzoek dat vaststelt dát vijf minuten de juiste sessielengte is.
Die zin verwart tempo met duur.

Wat er wél te zeggen valt: studies naar langzame ademhaling gebruiken
doorgaans sessies tussen de vijf en twintig minuten. Dat is een
beschrijving van wat onderzoekers gedaan hebben, niet van wat ze
aanbevelen — en dat verschil is precies wat een claim houdbaar maakt.

Daarom in deze versie:

- De per-sessie **Scientific Basis**-blokken zijn weg. Er staat één
  gedeelde sectie onderaan, en die gaat over tempo en niet over lengte.
- Termen die een fysiologische werking beweren — *parasympathetic
  activation*, *autonomic nervous system balance*, *physiological
  coherence* — zijn eruit. De eerste twee zijn medische taal, de derde
  is geen gangbare fysiologie maar een merkterm.
- De duurteksten beschrijven nu waarvoor een lengte praktisch geschikt
  is, niet wat ze in het lichaam zou doen.
- Bij BOOST staat een echte waarschuwing in plaats van een vage
  aanbeveling. Dat is geen effectclaim maar een veiligheidsmelding, en
  die hoort er wel te staan.

Dit sluit ook aan op de harde regel in `CLAUDE.md` §1: de app gebruikt
toestand-taal en doet geen wetenschappelijke of medische beweringen.

---

## 🚀 BOOST

**Purpose**
Alert and energized — primed for high-output moments.

**Breathing Pattern**
2s Inhale · 2s Exhale
Fifteen breaths per minute — deliberately faster than resting pace.

**Session Lengths**

| Duur | Label | Toelichting |
|------|-------|-------------|
| 3 min | Quick Boost | Short and sharp. Enough to shake off sluggishness before something demanding. |
| 5 min | Recommended | The longest we suggest at this pace. |
| 10 min | Maximum | Breathing this fast for this long often brings on light-headedness or tingling in the hands. Stop early if it does. |

---

## 🎯 FOCUS

**Purpose**
Locked-in attention — holding one task without drifting.

**Breathing Pattern**
4s Inhale · 2s Hold · 6s Exhale
A longer exhale than inhale, with a brief pause between.

**Session Lengths**

| Duur | Label | Toelichting |
|------|-------|-------------|
| 3 min | Quick Reset | Between tasks, or after an interruption. |
| 5 min | Recommended | The everyday length — before a work block or a meeting. |
| 10 min | Deep Focus | For longer stretches of concentration. |
| 20 min | Extended Focus | A full session for deep work. |

---

## 🧘 CALM

**Purpose**
Steady and composed — alert without being wound up.

**Breathing Pattern**
4s Inhale · 4s Hold · 4s Exhale · 4s Hold
Box breathing. Four equal phases, also known as square breathing.

**Session Lengths**

| Duur | Label | Toelichting |
|------|-------|-------------|
| 3 min | Quick Calm | When tension needs to come off quickly. |
| 5 min | Recommended | The everyday length. |
| 10 min | Deep Calm | When there is time to settle properly. |
| 20 min | Extended Calm | A full session. |

---

## 🧠 CLARITY

**Purpose**
A quieter mind — room to think.

**Breathing Pattern**
5s Inhale · 5s Exhale
Six breaths per minute. Known as coherent or resonant breathing, and
the most extensively studied slow-breathing pace.

**Session Lengths**

| Duur | Label | Toelichting |
|------|-------|-------------|
| 3 min | Mental Reset | A brief pause to clear the deck. |
| 5 min | Recommended | The everyday length. |
| 10 min | Deep Clarity | When thinking needs more room. |
| 20 min | Extended Clarity | The length most commonly used in studies of this pace. |

---

## 😴 REST

**Purpose**
Winding down — recovery, and the hour before sleep.

**Breathing Pattern**
4s Inhale · 6s Exhale
Slow, with the exhale longer than the inhale.

**Session Lengths**

| Duur | Label | Toelichting |
|------|-------|-------------|
| 5 min | Wind Down | A short transition out of the day. |
| 10 min | Recommended | The evening length. |
| 20 min | Deep Rest | Unhurried, for when there is no reason to rush. |

---

## "Why these lengths?"

Op elke sessiepagina een kleine knop **"Why these lengths?"**. Bij een
tik verschijnt één korte tekst — dezelfde voor alle vijf, want het
antwoord is voor alle vijf hetzelfde:

> **Why these lengths**
>
> There is no single correct length for a breathing session. Research
> into slow paced breathing generally uses sessions of five to twenty
> minutes, so that is the range we offer. Shorter sessions fit into a
> day more easily; longer ones give the rhythm more time to settle.
>
> Pick what fits the moment. A short session you actually do beats a
> long one you skip.

Twee dingen die deze tekst bewust wél doet: hij geeft toe dat er geen
juiste lengte is, en hij verwijst naar wat onderzoek gebrúikt in plaats
van wat het aanbeveelt. Dat eerste kost niets aan geloofwaardigheid en
levert er veel op — het is precies het soort eerlijkheid dat een
gebruiker niet verwacht van een app die iets wil verkopen.

---

## Science-pagina

Een aparte pagina, bereikbaar vanuit Settings of vanuit bovenstaande
uitleg. Hier hoort de onderbouwing die er wél is. Regels voor die
pagina:

**Wel:**

- Langzaam ademen rond zes ademhalingen per minuut is het best
  onderzochte tempo. Het werk van Paul Lehrer en Richard Gevirtz over
  resonantiefrequentie is daar het bekendste voorbeeld van.
- Box breathing is een veelgebruikte techniek met vier gelijke fasen.
  Ruim in gebruik, minder uitgebreid onderzocht dan het tempo hierboven
  — en zo mag het er ook staan.
- Snel ademen verlaagt het CO₂-gehalte in het bloed. Dat verklaart de
  tintelingen en de lichte duizeligheid die sommige mensen bij BOOST
  ervaren. Dit is basale fysiologie en geen effectclaim.

**Niet:**

- Geen bewering dat een bepaalde duur aanbevolen of onderzocht is.
- Geen *treatment*, geen aandoeningen, geen "helpt tegen".
- Niets over de hersenen. Dat geldt voor de audio én voor de bracelet.
- Geen namen van onderzoekers als keurmerk. Een verwijzing is een bron,
  geen aanbeveling van die persoon voor VIBEZCORE.

Onderaan de pagina één regel, en die is niet optioneel:

> VIBEZCORE is not a medical device and does not diagnose, treat or
> prevent any condition. If you are pregnant, have a respiratory or
> cardiovascular condition, or are prone to fainting, check with a
> doctor before practising breathing techniques.

---

## Open punten — te beslissen vóór dit in code gaat

### 1. FOCUS en CLARITY zijn omgewisseld ten opzichte van de app

| Sessie | App nu | Voorstel |
|--------|--------|----------|
| Sharp Focus | 5-0-5-0 (coherent breath) | 4-2-6 (long exhale) |
| Clarity | 4-2-6-0 (long exhale) | 5-5 (coherent breathing) |

De twee patronen wisselen van naam. Inhoudelijk valt daar iets voor te
zeggen, maar het is geen detail: de stemcues, de rondes en de
sessiebeschrijvingen in `src/app/(tabs)/breath.tsx` hangen eraan vast.
Bevestigen of dit bedoeld is.

### 2. REST verliest 4-7-8

App nu: 4-7-8 (inhale 4, hold 7, exhale 8). Voorstel: 4-6, zonder hold.
Rustiger en toegankelijker, maar het schrapt de techniek die nu in de
app staat.

Kanttekening bij het schrappen: 4-7-8 met twintig minuten aanbieden zou
sowieso niet verstandig zijn geweest. De bedenker ervan adviseert
beginners bij vier cycli te blijven, en de app doet er nu al twaalf. Als
REST langere sessies krijgt, is 4-6 daar de betere kandidaat voor.

### 3. Niet elke duur landt op een hele minuut

De cycluslengte bepaalt wat mogelijk is:

| Sessie | Cyclus | Landt op hele minuten |
|--------|--------|-----------------------|
| BOOST | 4 s | ja |
| FOCUS | 12 s | ja |
| CALM | 16 s | alleen viervouden (4, 8, 12, 16, 20 min) |
| CLARITY | 10 s | ja |
| REST | 10 s | ja |

Alleen CALM valt buiten de boot: 5 minuten wordt 5:04, 10 minuten wordt
10:08. Twintig minuten klopt wel precies (75 ronden).

Advies: toon de exacte tijd zoals de app nu al doet ("5:04 total"), dan
klopt het label altijd en hoeft er niets te worden afgerond.

### 4. Nog na te lopen buiten dit document

In `src/app/(tabs)/breath.tsx` staat bij Calm Control de zin *"Used by
special forces for stress recovery"*. Dat is hetzelfde soort bewering
als de blokken die hier net geschrapt zijn — een veelherhaald verhaal
zonder bron. Die staat er nog en valt buiten dit ontwerp.
