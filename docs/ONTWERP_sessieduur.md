# ONTWERP — Sessieduur per ademsessie

> **Status: VOORSTEL. Nog niet doorgevoerd in de app.**
> Aangeleverd door de operator op 31 juli 2026.
> De app draait op dit moment nog één vaste lengte per sessie.
> Zie "Open punten" onderaan — daar staan drie conflicten met de
> bestaande app en met de projectregels die eerst een beslissing vragen.

Doel: de gebruiker kiest zelf hoe lang een sessie duurt, in plaats van
één vaste lengte per state.

---

## 🚀 BOOST

**Purpose**
Increase alertness, energy and mental readiness.

**Breathing Pattern**
2s Inhale · 2s Exhale
A fast-paced breathing rhythm designed for short-term activation.

**Session Lengths**

| Duur | Label | Toelichting |
|------|-------|-------------|
| 3 min | Quick Boost | Provides a rapid activation response. |
| 5 min | Recommended | Balances activation while remaining comfortable for most users. |
| 10 min | Maximum Duration | Longer sessions are generally not recommended with this breathing rhythm due to the increased likelihood of discomfort associated with prolonged rapid breathing. |

**Scientific Basis**
Recommended durations are based on respiratory physiology and research
into activation-focused breathing techniques.

---

## 🎯 FOCUS

**Purpose**
Support sustained attention, concentration and cognitive performance.

**Breathing Pattern**
4s Inhale · 2s Hold · 6s Exhale
A controlled breathing rhythm designed to promote focused attention
while maintaining physiological comfort.

**Session Lengths**

| Duur | Label | Toelichting |
|------|-------|-------------|
| 3 min | Quick Reset | A short session to regain focus. |
| 5 min | Recommended | Suitable for everyday concentration and mental preparation. |
| 10 min | Deep Focus | Supports longer periods of sustained attention. |
| 20 min | Extended Focus | Designed for prolonged focus sessions and deep work. |

**Scientific Basis**
Recommended durations are based on research into paced breathing,
attention regulation and autonomic nervous system function.

---

## 🧘 CALM

**Purpose**
Reduce stress and support emotional regulation.

**Breathing Pattern**
4s Inhale · 4s Hold · 4s Exhale · 4s Hold
Classic Box Breathing.

**Session Lengths**

| Duur | Label | Toelichting |
|------|-------|-------------|
| 3 min | Quick Calm | Helps reduce acute tension. |
| 5 min | Recommended | Suitable for daily stress regulation. |
| 10 min | Deep Calm | Supports longer periods of relaxation. |
| 20 min | Extended Calm | Designed for prolonged relaxation and stress management. |

**Scientific Basis**
Box Breathing has been studied as a paced breathing technique for stress
regulation and autonomic nervous system balance.

---

## 🧠 CLARITY

**Purpose**
Promote mental clarity and physiological coherence.

**Breathing Pattern**
5s Inhale · 5s Exhale
Coherent (Resonant) Breathing.

**Session Lengths**

| Duur | Label | Toelichting |
|------|-------|-------------|
| 3 min | Mental Reset | A brief session to restore clarity. |
| 5 min | Recommended | Suitable for everyday mental reset. |
| 10 min | Deep Clarity | Supports sustained physiological coherence. |
| 20 min | Extended Clarity | Frequently used in research investigating heart rate variability (HRV) and autonomic regulation. |

**Scientific Basis**
Recommended durations are based on research into resonance frequency
breathing and heart rate variability.

---

## 😴 REST

**Purpose**
Prepare body and mind for recovery and sleep.

**Breathing Pattern**
4s Inhale · 6s Exhale
A slow breathing rhythm designed to encourage relaxation.

**Session Lengths**

| Duur | Label | Toelichting |
|------|-------|-------------|
| 5 min | Wind Down | Begin transitioning into a relaxed state. |
| 10 min | Recommended | Suitable for evening relaxation. |
| 20 min | Deep Rest | Provides additional time for gradual physiological relaxation before sleep. |

**Scientific Basis**
Recommended durations are based on research into slow breathing,
parasympathetic activation and relaxation before sleep.

---

## Aanvullend voorstel — "Why these durations?"

Op elke sessiepagina een kleine knop **"Why these durations?"**. Bij een
tik verschijnt een compacte uitleg zoals hierboven, met onderaan:

> Based on published research in respiratory physiology, autonomic
> nervous system regulation and heart rate variability (HRV).

Op een aparte **Science-pagina** komen de volledige referenties — onder
meer werk van Paul Lehrer over resonant breathing, Stephen Porges over
autonome regulatie waar relevant, en onderzoek naar paced breathing en
HRV. Zo blijft de sessie-interface leeg en staat de onderbouwing op één
plek.

---

## Open punten — te beslissen vóór dit in code gaat

### 1. FOCUS en CLARITY zijn omgewisseld ten opzichte van de app

De app draait vandaag:

| Sessie | App nu | Voorstel |
|--------|--------|----------|
| Sharp Focus | 5-0-5-0 (coherent breath) | 4-2-6 (long exhale) |
| Clarity | 4-2-6-0 (long exhale) | 5-5 (coherent breathing) |

De twee patronen wisselen dus van naam. Inhoudelijk is daar iets voor te
zeggen — coherent breathing past goed bij "clarity" — maar het is geen
detail: de stemcues, de duurteksten en de sessiebeschrijvingen in
`src/app/(tabs)/breath.tsx` hangen er allemaal aan vast. Bevestigen of
dit bedoeld is, of dat het per ongeluk verwisseld is.

### 2. REST verliest 4-7-8

App nu: 4-7-8 (inhale 4, hold 7, exhale 8). Voorstel: 4-6, zonder hold.
Dat is een rustiger en toegankelijker patroon, maar het schrapt de
techniek die nu in de app én in de sessiebeschrijving staat.

### 3. De "Scientific Basis"-teksten botsen met CLAUDE.md

`CLAUDE.md` §1 stelt als harde regel: *geen wetenschaps-/medische
claims, de app gebruikt uitsluitend toestand-taal.* De voorgestelde
teksten doen het tegenovergestelde — "autonomic nervous system
function", "parasympathetic activation", "heart rate variability",
plus verwijzingen naar Lehrer en Porges.

Twee losse bezwaren:

**Regelconflict.** Ofwel de regel in CLAUDE.md wordt aangepast, ofwel
deze teksten gaan eruit. Beide kan, maar ze kunnen niet naast elkaar
bestaan.

**Houdbaarheid.** "Recommended durations are based on respiratory
physiology and research into activation-focused breathing techniques"
is niet waar te maken. Er bestaat geen onderzoek dat vaststelt dát vijf
minuten de aanbevolen duur is voor 2-2 ademhaling. Het bestaande
onderzoek gaat over ademtempo, niet over sessielengte. Dit is de
formulering die een reviewer of een kritische gebruiker als eerste
aanvalt.

Wat wél houdbaar is: 5-5 komt neer op zes ademhalingen per minuut, en
dát tempo is uitgebreid onderzocht. Dat is de enige van de vijf waarbij
een verwijzing naar onderzoek stand houdt.

Voorstel: laat de duurteksten beschrijven wat ze doen ("suitable for
everyday stress regulation") zonder ze als onderzoeksuitkomst te
presenteren, en bewaar de onderbouwing voor de Science-pagina, waar ze
over het ademtempo gaat en niet over de lengte.

### 4. Praktisch — niet elke duur landt op een hele minuut

De cycluslengte bepaalt wat mogelijk is. 16 seconden (Calm) past niet in
60, dus 5 minuten wordt 5:04. 19 seconden (huidige Rest) past nergens
in. Advies: toon de exacte tijd zoals de app nu al doet ("5:04 total"),
dan klopt het label altijd.
