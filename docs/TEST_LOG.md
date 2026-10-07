# VIBEZCORE — Testlogboek

> Elke test die gedaan wordt, komt hier: datum, toestel, wat, hoe,
> resultaat en bewijs. Ook wat NIET getest is staat erbij — zodat de
> volledige hertest (zie onderaan) niets mist.
>
> Legenda: ✅ geslaagd · ❌ gefaald (met fix) · ⚠️ deels / met opmerking ·
> ⏳ nog te testen
>
> Toestellen: **A16** = Samsung Galaxy A16 (Android, testtoestel
> operator, dev build). iPhone / Apple Watch / Wear OS: nog niet
> beschikbaar voor tests.

---

## 7 oktober 2026

### Wetenschap & documentatie
| # | Wat | Hoe | Resultaat |
|---|---|---|---|
| 1 | Externe review wetenschapsbundel | 5 bronnen zelf nagelezen (Birdee 2023, BoostMeUp 2019, Bartlett 2024, Motokawa 2025, Lee 2025-abstract) | ✅ review grotendeels juist; correctie: Motokawa mat ook cortisol. Bundel v2 + A-tot-Z-document (`3541f99`) |

### Betaalflow
| # | Wat | Toestel | Resultaat |
|---|---|---|---|
| 2 | Salescard → meteen Google Play-venster (geen accountformulier) | A16 | ⏳ door operator te doen (testplan in chat 7 okt: 5 scenario's) — gebouwd `ea0a57a` |
| 3 | 7-dagen-trial zichtbaar | A16 | ⚠️ niet zichtbaar voor operator-account: correct gedrag (account niet meer trial-gerechtigd). Te controleren met een nieuw Google-account ⏳ |

### Glas (bottom sheets)
| # | Wat | Toestel | Resultaat |
|---|---|---|---|
| 4 | Paywall-sheet boven ademsessie (Extended Exhale, Box) | A16 | ❌ soms egaal grijs → fix: blur opnieuw opbouwen na inschuiven (`3988d8c`) → ✅ 2× glas zichtbaar (screenshots) |

### Match your rhythm — rusthartslag
| # | Wat | Toestel | Resultaat |
|---|---|---|---|
| 5 | Pulsdetectie-algoritme op nagebootste signalen | PC | ✅ 55/64/72/88/110 bpm binnen ±1; ruis, drift, 24 fps, verzadigd rood ok; enkel ruis → geen uitkomst |
| 6 | Camerameting start | A16 | ❌ "camera couldn't start" → oorzaak: zaklamp vóór camerastart + `getPixelBuffer` vereist minSdk 26 → fix: plane-buffer + zaklamp na start (`2756d12`) → ✅ |
| 7 | Camerameting resultaat | A16 | ✅ 68 bpm, later 66 bpm (verschil 2) — ⏳ **nog niet vergeleken met referentie** (pols tellen / horloge) |
| 8 | Hogere meting (75) → "Your heart right now", rust blijft 66 | A16 | ✅ (screenshot operator); tekst daarna verduidelijkt (`f819a6c`, `d95655c`) |
| 9 | Hartslag van nu als startpunt (69) → "starts at 69 and slows to 59" | A16 | ✅ melding gezien door operator |
| 10 | Pil "♥ 66 bpm ›" in de cirkel, aanklikbaar | A16 | ✅ screenshot (`3ca7d6e`) |
| 11 | Welke camera bedekken (3 lenzen) | A16 | ⚠️ onduidelijk → uitleg + live "Got it" toegevoegd (`2756d12`) |

### State Control — haptiek (uitgelezen uit de trilmotor)
| # | Wat | Toestel | Resultaat |
|---|---|---|---|
| 12 | Voorproef Sharp Focus | A16 | ✅ 10 s op 66,0 bpm → glijden (15,6 s = 62,1, formule 62,1); lub-dub 273 ms (30%); stop na ~32 s. Laatste 14 s niet uitleesbaar (log afgekapt) |
| 13 | Quick Chill, 5 min | A16 | ✅ 10 s op 66 → 2 min glijden → 46,0 bpm (45,8–46,3) tot het einde; eindsignaal op 301 s |
| 14 | Quick Boost, 5 min | A16 | ✅ 10 s op 66 → 10 s naar 110 → 110 (108,5–111) tot het einde; eindsignaal op 300,5 s; tikken 60/46 ms (steviger dan Chill 40/32) |
| 15 | Einde sessie → afsluitscherm | A16 | ❌ 0,3 s keuzescherm (Sharp Focus) zichtbaar → fix (`2f46905`) ⏳ hertest |
| 17 | Keuzescherm te druk (Quick-knoppen met tekst) | A16 | ⚠️ operator: "heel druk" → icoontjes naast elkaar boven de Start-knop, tik = glazen paneel met uitleg + Start/Back; icoon Chill = teken van Clarity & Relax (niet het maantje = Sleep) |
| 18 | Quick Chill-paneel | A16 | ✅ screenshot: titel, "5 min · starts right away", uitleg, Start, Back, glas |
| 19 | Tik-gevoel knoppen | A16 | ⚠️ nieuwe knoppen sprongen abrupt naar half doorzichtig of reageerden niet (Back/Cancel) → gedeelde `PressScale` (curve van de Start-knop: 80 ms krimpen, veer terug; lichte tik bij hoofdknoppen). ⏳ door operator te voelen |
| 20 | Hartslag-pil in de cirkel | A16 | ⚠️ "opgekropt" en blijft staan bij vegen → boven de cirkel geplaatst; Start-knop viel daardoor onder de systeembalk → ruimte boven duurwiel 90→38 → ✅ screenshot: alles past |
| 21 | Hartslag boven de cirkel: pill of niet | A16 | ⚠️ te klein → Apple-stijl zonder capsule (zoals Health/Workout): "♥ 66 bpm ›", tekst 15 semibold, raakvlak ≥ 44 → ✅ screenshot |
| 22 | Centrering keuzescherm (gemeten op pixels, scherm 1080 breed) | A16 | ✅ cirkel, naam, 10:00, Recommended, bolletjes, duurwiel, snelknoppen, Start: allemaal binnen 0,5 px van het midden. Hartslaggroep stond 6 px (2 pt) links → optisch gecorrigeerd → −1,5 px |
| 23 | Gratis: tekst onder "Try 30 seconds free" te druk | A16 | ⚠️ → paneel bij aantikken (Free preview · uitleg · Start preview · Unlock all sessions · Back); onder de knop enkel de 'sped up'-melding tijdens de voorproef. ⏳ hertest met een niet-Premium account |

### Ontwikkelomgeving
| # | Wat | Resultaat |
|---|---|---|
| 16 | Lokale dev build met camera (`npx expo run:android`) | ✅ na 20 min; app bleef wit door koude Metro-bundel (85 s) → oplossing genoteerd |

---

## Nog niet getest (gebouwd)
- ⏳ Quick Chill/Boost-knoppen: paywall-pad zonder abonnement; eerste keer zonder rusthartslag (paneel eerst)
- ⏳ Activity → Your rhythm; Profile → Your rhythm (in- en uitgelogd)
- ⏳ "Use an average" wist eigen waarden
- ⏳ Uitschieter-regel (> 8 bpm lager) in de praktijk
- ⏳ 30-dagen-stipje (enkel te testen door de datum te verzetten)
- ⏳ Live startpunt verloopt na 15 min / na sessiestart
- ⏳ Horloge (Wear OS + Apple Watch) met `startBpm`
- ⏳ **iPhone:** camerameting, glas, betaalflow — iOS-build nodig
- ⏳ Nauwkeurigheid camerameting: 10 personen naast horloge/borstband, 9/10 binnen ±5 bpm
- ⏳ Release-build: vloeiendheid ademsessie-overgangen (zie memory)

---

## Volledige hertest (na afronding bouwronde)
Operator, 7 okt 2026: "nadat alles gebouwd is gaan we alles volledig
opnieuw testen, volledige app". Op te stellen als testplan per scherm/
ingang (welcome, alle tabs, breathwork alle 15 technieken, State Control
alle 5 + Quick, voorproeven, paywall/abonnement/restore, account in/uit,
Activity, Profile, legal, meldingen, minimaliseren, horloge, iPhone) en
hier af te vinken.
