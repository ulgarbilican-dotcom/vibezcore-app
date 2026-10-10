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
| 7 | Camerameting resultaat | A16 | ✅ 🔒 9 okt: pols 74 (37 × 2), telefoon 76 → binnen ±5 bpm, "zeer accuraat". Meetduur nu vast 30 s |
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
| 15 | Einde sessie → afsluitscherm | A16 | ❌ 0,3 s keuzescherm (Sharp Focus) zichtbaar → fix (`2f46905`). 8 okt: einde preview → keuzescherm ✅; einde volledige sessie (Full PRO gesimuleerd) ✅ operator: "is ok" |
| 17 | Keuzescherm te druk (Quick-knoppen met tekst) | A16 | ⚠️ operator: "heel druk" → icoontjes naast elkaar boven de Start-knop, tik = glazen paneel met uitleg + Start/Back; icoon Chill = teken van Clarity & Relax (niet het maantje = Sleep) |
| 18 | Quick Chill-paneel | A16 | ✅ screenshot: titel, "5 min · starts right away", uitleg, Start, Back, glas |
| 19 | Tik-gevoel knoppen | A16 | ⚠️ nieuwe knoppen sprongen abrupt naar half doorzichtig of reageerden niet (Back/Cancel) → gedeelde `PressScale` (curve van de Start-knop: 80 ms krimpen, veer terug; lichte tik bij hoofdknoppen). ⏳ door operator te voelen |
| 20 | Hartslag-pil in de cirkel | A16 | ⚠️ "opgekropt" en blijft staan bij vegen → boven de cirkel geplaatst; Start-knop viel daardoor onder de systeembalk → ruimte boven duurwiel 90→38 → ✅ screenshot: alles past |
| 21 | Hartslag boven de cirkel: pill of niet | A16 | ⚠️ te klein → Apple-stijl zonder capsule (zoals Health/Workout): "♥ 66 bpm ›", tekst 15 semibold, raakvlak ≥ 44 → ✅ screenshot |
| 22 | Centrering keuzescherm (gemeten op pixels, scherm 1080 breed) | A16 | ✅ cirkel, naam, 10:00, Recommended, bolletjes, duurwiel, snelknoppen, Start: allemaal binnen 0,5 px van het midden. Hartslaggroep stond 6 px (2 pt) links → optisch gecorrigeerd → −1,5 px |
| 23 | Gratis: tekst onder "Try 30 seconds free" te druk | A16 | ⚠️ → paneel bij aantikken (Free preview · uitleg · Start preview · Unlock all sessions · Back); onder de knop enkel de 'sped up'-melding tijdens de voorproef. ⏳ hertest met een niet-Premium account |

### Bracelet-promotie, welkomstschermen, glas (7 okt 2026, avond)
| # | Test | Toestel | Resultaat |
|---|------|---------|-----------|
| 24 | Bracelet-pagina in de app vindbaar | A16 | ⚠️ account telt als eigenaar → Profile-rij ontbrak → rij voor iedereen; kaart onderaan Audio Library + links op afsluitschermen State Control/Breathwork (niet voor eigenaars) |
| 25 | Bracelet-pagina: 1 CTA naar vibezcore.com/smart-bead-bracelet | A16 | ✅ "Discover the bracelet" zichtbaar (screenshot) |
| 26 | Bracelet-welkomstintro: CTA te laag, kopbalk bovenaan | A16 | ⚠️ telefoon draaide oude bundel → app herstart; intro nu schermvullend zonder kopbalk, knop op hoogte zusterintro's. ⏳ operator-bevestiging |
| 27 | Bracelet "A closer look"-kaart | A16 | ✅ operator: "beter zo" (groter, labels, geen nummer, "Wear it. Set it. Feel it.") |
| 28 | Welkomstscherm naar operator-ontwerp | A16 | ✅ operator: glas "ik vind het goed"; "Control Your State"; tab-iconen. ⏳ nieuwe foto (smartwatch) nog aan te leveren |
| 29 | Breath-intro eyebrow GUIDED BREATHWORK | A16 | ✅ 8 okt: zichtbaar op schermafbeelding van het toestel |
| 30 | Paywall na vroegtijdig End session (voorproef) zonder glas | A16 | ❌ eerste fix toonde oud rust-scherm → teruggedraaid; ✅ pauzeren i.p.v. stoppen — operator: "goed" |

### Account-flow, inloggen, Premium (7 okt 2026, nacht — code-audit + fixes)
Gevonden met een volledige code-audit (operator: "kan je de volledige flow
nakijken voor account login, create premium, create account, sign in").
Fixes gebouwd, typecheck ✅ — **nog niet op toestel getest**.
| # | Test | Toestel | Resultaat |
|---|------|---------|-----------|
| 31 | Google Sign-In op testbuild | A16 | ❌ `DEVELOPER_ERROR` rauw in rood. Oorzaak: debug-SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` niet in Google Cloud (operator registreert). Melding nu gewone zin. ⏳ na registratie |
| 32 | Gast koopt Premium → content open | A16 | ⏳ was ❌ (bleef Free); nu RevenueCat-status ook voor gasten |
| 33 | Gast koopt → maakt account → Premium op account (+ 2e toestel) | A16 | ⏳ was ❌ (geblokkeerd door v237c); nu gast-aankoop-marker |
| 34 | Gast-Premium opent Audio Library-sessie | A16 | ⏳ verwacht "One more step — Create account" |
| 35 | App-update logt niet meer uit | A16 | ⏳ (versie-check enkel nog in testbuilds) |
| 36 | Geen stille "restore" bij app-start | A16 | ✅ 8 okt operator: "ok werkt" |
| 37 | Account aanmaken in Profile: < 8 tekens geweigerd; bestaand e-mailadres → naar "Sign in", geen 2e account | A16 | ✅ operator: "klopt allemaal". Android biedt daarna aan de inloggegevens op te slaan (systeem-autofill, zo bedoeld) |
| 38 | Welcome "Already a member? Sign in" opent formulier meteen; na inloggen geen breathwork-intro meer | A16 | ✅ na fix `4d03b65` (intro per e-mailadres onthouden). Operator: "in orde" |
| 38b | "End trial?" bij vroegtijdig stoppen van de gratis volledige sessie: stond in het midden, geen glas | A16 | ❌→✅ `e2f1bbd`: glazen onderblad (GlassSheet) zoals het betaalscherm. Operator: "in orde" |
| 38c | Na inloggen (Free): naar het laatst gebruikte tabblad buiten Profile (State Control), niet altijd Breathwork | A16 | ❌ altijd /breath → fix `412da01` + vangnet `d91a182` (eerste hertest faalde door live-herladen zonder herstart; opslag nagekeken via adb: `vz_last_content_tab_v1 = bracelet`) → ✅ operator: "nu ok" |
| 39 | Google-account: geen "Change password"-rij | A16 | ⏳ |
| 40 | Delete account → welkomstscherm, audio + bracelet gestopt | A16 | ✅ 8 okt: account verwijderd, opnieuw inloggen → "wrong email or password". Onderweg gevonden + gefixt: mini-speler stond vóór Delete account en liet tikken door naar "Sign out" (`8638c56`); mini-speler 152 → 88 en vast op de tabbalk (Apple Music-patroon, `26ae27b`, `f4867ff`); Breath-keuzescherm knop viel weg (`5e83e00`); pijler-pagina's/Free Sessions laatste kaarten achter speler (navigatiebalk niet meegerekend) → fix `58cbbba` → ✅ operator: "ok werkt" |
| 41 | E-mailbevestiging / wachtwoordreset via link → daarna kopen staat op account | A16 | ⏳ |
| 42 | Paywall zonder storeverbinding: geen vaste €-prijzen of "7-day" | A16 | ⏳ niet testbaar op de dev build (laadt code via wifi; prijzen al bij opstart opgehaald) → testen op de volgende echte build, koude start in vliegtuigmodus |
| 43 | iPhone: proefperiode/introprijs + "App Store"-teksten; Google-knop verborgen tot iOS-client er is | iPhone | ⏳ iOS-build nodig |
| 44 | Pijlerscherm (Father/Mother Wound): geen "Pro"-slotjes voor Premium | A16 | ✅ operator: "slotjes zijn weg" (fix `14a440d`) |
| 45 | Premium: ook geen "Free with account"-slot; sessie speelt af | A16 | ✅ operator: "audio speelt nu gewoon af" (fix `4710d0d`) |
| 46 | Ingelogd → opent in laatste tabblad, geen welkomstscherm | A16 | ✅ zie 46/50 hieronder |

### Volledige app-audit (8 okt 2026, 7 parallelle code-audits) — fixes, nog op toestel te testen
Commits `b50e51d` → `9783a78`. Typecheck ✅ na elk blok.
| # | Test | Toestel | Resultaat |
|---|------|---------|-----------|
| 46/50 | Ingelogd → opent in laatste tabblad (Activity), geen welkomstscherm | A16 | ✅ na 3 fixes: Supabase-project was gepauzeerd ("Upstream fetch failed", operator heeft hersteld); Library-intro flitste bij koude start → `7bb4b68` (Library toont niets tot de opstartbeslissing). Operator: "nu kom ik wel direct in activity" |
| 46b | Profile Premium vs Free tegenstrijdig | A16 | ❌→fix `68e192e`: backend zegt `active:true` met `valid_until` 8 juli 2026 (verlopen, webhook nooit verwerkt); app telt een verlopen einddatum nu nooit als actief. Operator-account is in werkelijkheid Free (Play: verlopen) |
| 47 | Settings → "Watch the intro again" → geen gratis volledige sessie meer (enkel als de gratis sessie nog niet gebruikt is) | A16 | ✅ operator: "stopt na 30 sec + saleskaart Unlock" |
| 47b | Na 30 s voorproef → betaalscherm → Done: nooit de oude lotus-in-kaart / "ENJOY YOUR SESSION" | A16 | ✅ na 2 fixes: afdekscherm `f9a5ef9` hielp niet; `a484e8d` haalt het oude startscherm volledig weg en pauzeert de voorproef achter het betaalscherm. Operator: "nu zie ik wel het juiste breathscherm na done" |
| 48 | Gast koopt Premium → app volledig afsluiten → nog steeds Premium | A16 | ⏳ (licentietester) |
| 49 | Gast → Restore purchases → account maken → aankoop op account | A16 | ⏳ |
| 50 | Bracelet-eigenaar: na openen GEEN sprong naar State Control; opent in laatste tabblad | A16 | ✅ 8 okt (Bracelet owner gesimuleerd) operator: "in orde" |
| 51 | E-maillink (bevestigen/reset) opent één scherm, geen "Link expired" | A16 | ⚠️ 8 okt: "Confirm email" stond aan maar mails gingen via de webapp-pagina; Outlook/virusscanners openden de link automatisch en verbruikten hem (logs: `/verify` 30 s na `/signup` + WARNING). Opgelost: eigen pagina `auth.html` op Bunny (nooit de webapp), bevestigt pas na een tik; op de telefoon bevestigt de app zelf (meteen ingelogd); templates in `docs/email-templates/`. Op de dev build vangt het testbuild-startscherm de link als de app dicht is → ⏳ definitief testen op de volgende echte build |
| 52 | Offline openen (> 1 u na gebruik) → ingelogd, laatste tabblad | A16 | ❌ operator zette vliegtuigmodus aan → Profile toonde "uitgelogd" (sleutel van 1 u verlopen, offline niet te vernieuwen; login zelf bleef bewaard) → fix `354212a` `hasStoredSession` (Profile + Library). ✅ login bleef bewaard: na vliegtuigmodus uit + herstart meteen ingelogd (Free) zonder wachtwoord. ⏳ offline koude start zelf: op de volgende echte build (dev build start niet zonder wifi) |
| 53 | Ademsessie: 2 min wachten vóór Play, scherm vergrendelen → sessie loopt correct, historiek juiste duur | A16 | ⚠️ 8 okt: timing ✅. Gevonden: afsluitzin klonk niet (vergrendeld) → `f28c4f1`, nu bij ontgrendelen ✅; vergrendelscherm-tekst haperde elke seconde (Now Bar-lichtkrant) → vaste tekst `76420ff` (native, ⏳ echte build); historiek leeg na herstart: ademhistoriek/plannen volgden de gebruikerswissel niet → `5ccaf68` ✅ hertest ok; haperen sessie op vergrendelscherm ⏳ meten op echte build |
| 54 | Plan met Sleep 4-7-8 (beginner) → 4 cycli | A16 | ✅ 8 okt operator: sessie goed gelopen, terug naar plan, historiek klopt |
| 55 | Ujjayi-popup wegtikken (achtergrond + Android-terug) → sessie start (geen leeg scherm) | A16 | ✅ operator: "klopt" — sessie staat klaar op pauze met Play-knop, zoals bedoeld |
| 56 | Pro-sessie voorproef tot 60 s → Play op vergrendelscherm speelt NIET verder | A16 | ❌ eerst nog een fractie van een seconde geluid → fix `e30310d`: bij de grens verdwijnt de mediaspeler van het vergrendelscherm + speler gedempt → ✅ operator: "na een tijdje staat er geen mediaspeler meer" (Android haalt de melding met een korte vertraging weg; tikken in die tussentijd hoort stil te blijven door het dempen — niet apart getest) |
| 57 | Library: ingelogd (Free) → account-sessie "What Is In Your Control" speelt voorbij 1:00 zonder muur | A16 | ✅ operator: "heel goed, werkt". Label FREE WITH ACCOUNT enkel voor gasten (ingelogd = ontgrendeld getoond) |
| 58 | Alle bracelet-links (Profile-rij, About-kaart, Library-kaart, breath-sessie Voice & Haptics → "Fall 2026" → View Preview) → website | A16 | ✅ operator: "alles ok" (View Preview zit achter het "Fall 2026"-label, niet achter de rijnaam) |
| 59a | Settings: "Track listening history" uit → gratis sessie 15 s afspelen → niet in Your Journey | A16 | ✅ operator: "klopt, niets in Your Journey" |
| 59 | Settings: "Save listening progress" uit → gratis sessie 20 s, X, opnieuw openen → begint op 0:00, geen Continue/Start over | A16 | ✅ operator: "klopt" |
| 60 | Settings → Clear all local data → blijft ingelogd; herinneringen uit; Your Journey leeg | A16 | ✅ operator: "klopt" |
| 61 | Herinnering aan/uit in Settings → eigen tijd blijft | A16 | ✅ 9 okt (Full PRO gesimuleerd) operator: "is ok" |
| 62 | Afmelden tijdens geminimaliseerde ademsessie → alles stil | A16 | ✅ operator: "klopt"; daarna terug ingelogd (Free) |
| 63 | Proefperiode: Pro-sessie voorproef → geen "start your trial"; /subscribe → "You're a VIBEZCORE Premium member" | A16 | ⏳ |
| 64 | "Already owned"-fout → knoppen Restore purchases + Sign in | A16 | ⏳ |
| 65 | Speler op kleine telefoon (≤ 700 dp hoog) → knoppen volledig zichtbaar | A16 | ⏳ |
| 66 | Grote speler: hoes groter (164 → 210), voortgangsbalk + knoppen lager | A16 | ✅ operator: "perfect zo is het ok" (`2449b73`, `899357f`) |
| 67 | Toegang: free account/gast = 10 sessies; de 17 andere eerste sessies tonen FREE WITH TRIAL en openen het trial-blad (27 sessies, Breathwork, State Control; geen "No credit card") | A16 | ✅ operator: "goed" (`c06cc02`, `3d0a914`) |
| 67b | Trial-blad → See plans → plankeuze (niet meteen de kassa) | A16 | ❌ startte jaarkassa (`?tier=yearly` = auto-checkout; in dev nep-kassa → foutmelding) → fix `88c8374` → ✅ |
| 67c | Planscherm: Yearly "During your trial, the Audio Library is limited to 27 sessions."; Monthly "Full access from day one: Breathwork, State Control and all 144 audio sessions."; trial-blad bullets "Full Breathwork and State Control from day one" / "27 audio sessions during your trial, all 144 after" (`4827f14`, `64ffc9d`); kleine lettertjes per store (Android Google Play, iOS Apple-tekst), aanrekenmoment volgt trial | A16 | ✅ operator: "ok" (`dec187c`, `44ace38`); iOS-tekst ⏳ iPhone |
| 68 | Free account openen: geen flits van Breath vóór de onboarding (`1e4d499`); onboarding maar één keer, ook na Skip (`f3196ec`, vervangt regel 31 juli) | A16 | ✅ operator: nieuw account (Confirm email UIT → meteen ingelogd) krijgt onboarding; na wegklikken en terugkomen weg. Uitloggen/inloggen ⏳ |
| 68b | Onboarding: terugvegen = "nu even niet" (komt terug op Breath-tab), Skip = gezien (`94077e2`); Skip leesbaar (`ed73423`); Skip landt op Breath-welkomstbeeld i.p.v. select state (`b0c0ad7`) | A16 | ✅ operator: "skip werkt" — landing-fix ⏳ hertest |
| 68c | Crash "Reload / Go home" na account aanmaken → Breath (addViewAt: child already has a parent) → sprong naar onboarding pas na lopende overgangen (`55d898b`); nieuwe onboarding-teksten stap 1/2/4/5 (`972d123`, `714d57a`); Skip + terugknop stap 1 → glazen blad "Skip your personalized session?" (`d10501d`) | A16 | ✅ operator: "in orde" (+ `b35fbc9` replay-param, `43c48f7`/`e495e11` blad-tekst per stap) |
| 69 | Soundscapes: rij was onzichtbaar in Audio & Haptics (kromp tot 0 in glas-vel) → fix; Rain + Canopy gratis vooraan, rest kroontje → Premium-blad (sessie loopt door); "Cancel anytime" op eigen regel (`552d229`, `be7982a`, `7584f08`) | A16 | ✅ operator: "ok" |
| 70 | UI-ronde 8–9 okt: afsluitblad glas + Buddha met draaiende ring, Play-knop in boogkleur (zonder echte blur — echte blur in scherm = crash, teruggedraaid), kleurregel Bio-Teal, onderblad-protocol (actie: geen X; kiezer/uitleg: Done rechtsboven), duurlijst per techniek gedeeld, geen welcome-flits bij sessie verlaten, onboarding Skip-blad per stap | A16 | ✅ operator stap voor stap bekeken |
| 71 | State Control rusthartslag: premium pagina "Your Resting Heart Rate" na de intro tot er gekozen is; meting: halve-hartslag-fout (40 i.p.v. 80) opgelost, geen getal buiten 45–100/onduidelijk, stil doormeten tot 25 s, hints (te hard drukken, vinger bewogen); labels in gewone woorden (State Control, Profile 'Resting Heart Rate'), Activity-rij weg; Quick/preview-blad zonder Back (`9e49aea`…`f6fa05c`) | A16 | ✅ pagina + layout operator "ok beter"; meting nieuwe versie ⏳ hertest echte meting |
| 72 | "Your Resting Heart Rate"-pagina: glazen hart + hartlijn met schrijfpuntje (piek ontstaat rechts, loopt achter het hart door), cirkel staat stil, links zonder onderlijning met pijltje | A16 | ✅ operator: "heel mooi, professioneel" — ⏳ hertest links (Enter Manually ›, Use an Average for Now ›) |
| 73 | Meetscherm: vinger-animatie (telefoon + vinger), voortgangsring 20 s, hart klopt lub-dub op echte slagen, live bpm na ±4 s (stabiel, geen sprongen), hartlijn met pieken, "Calculating…" aan het einde, eindgetal teal + Done, resultaat | A16 | ⏳ |
| 74 | Meetscherm-fouten: "Flash unavailable" bij batterij < 15% en donker beeld (nieuwe build, expo-battery); "Camera unavailable"; Enter Manually wit met pijltje | A16 | ⏳ |
| 75 | State Control-scherm: slepen over de rand (tik per minuut), 3 vaste tijden (kort · aanbevolen · lang), toestand wisselen, 70 bpm-pil → hartslag-blad (Resting/Heart rate now, Measure Now, Not Now), Quick Chill/Boost-kaartjes, knoppen even breed als Start | A16 | ⏳ |
| 76 | Ademsessie: Audio & Haptics echt glas + knopnaam; soundscape-sterkte Soft/Medium/Loud (zachter); pauze pauzeert ook de soundscape | A16 | ⏳ |
| 77 | Tikjes app-breed (utils/haptics): knoppen fijne systeemtik, slepen schuif-tik — subtiel, niet hard | A16 | ⏳ (vervangt het voelen in 19) |
| 78 | Meetscherm 9 okt: meting exact 30 s; robuuste uitslag (verstoorde stukken overgeslagen, ook live getal); live getal staat stil; hart/hartlijn kloppen regelmatig; hartlijn breed achter ring, grote pieken; vinkje in de ring + knop met volgende stap (Let's Go / Start / Back to …), pas bij die tik bewaard | A16 | ✅ operator: meting "lijkt goed nu", layout/knop bijgestuurd — eindbeeld ⏳ korte hertest |
| 79 | Rusthartslag-pagina: hartslaggeluid op elke slag + fijne tik; speaker = 6396 (100%), koptelefoon = 297400 met zachte lub (30%), uitgang via nieuwe module audio-route; stille lus tegen Bluetooth-afkappen; eerste slag klinkt meteen | A16 | ✅ operator: "dit is beter" (10 okt 2026) |
| 53b | Vergrendelscherm ademsessie NA bezoek aan de rusthartslag-pagina (hartslaggeluid zet tijdelijk een andere audiomodus) — force-stop → pagina → Calm Control starten → slot | A16 | ✅🔒 zelf getest 10 okt: VibezcoreBreathSession PLAYING, melding CALM CONTROL (vis=PUBLIC), op het slotscherm V-icoon + "CALM CONTROL • Guided breathwork" (ook A1: statische tekst + V-icoon op de nieuwe build ✅) |
| 53c | Vergrendelscherm (operator 10 okt: "sessienaam + timer die aftelt, vast" en "V te groot uitvergroot — zoals welkomstscherm"): balkje "CALM CONTROL • 4:45" (past, schuift niet, telt af); uitvergroot = eigen beeld (V-teken + VIBEZCORE-woordmerk op #0a0a0a), titel + aftellende tijd + voortgangsbalk | A16 | ✅🔒 zelf getest na force-stop (screenshots 12:25): balkje vast + aftellend, uitvergroot beeld correct. Operator-oordeel over het beeld ⏳ |
| 80 | State Control Audio & Haptics: pil boven play → glazen blad, kaarten Haptic / Haptic + Audio (vaste iconen), geluid synchroon met de tik, ook op slot (Android); wisselen tijdens sessie | A16 | ⏳ operator — blad zelf gezien (screenshot 10 okt) |
| 81 | State Control-vergrendelscherm: merk-kaart + aftellende M:SS + naam in hoofdletters | A16 | ⏳ |
| 82 | Meteinde: hart klopt door + geluid/tik, lichtgolf, zelftekenend vinkje + "Measurement complete / You can lift your finger"; cirkel ademt niet | A16 | ⏳ |
| 83 | Tabbalk: website-iconen zonder cirkel, gekozen icoon Bio-Teal + groter met bounce | A16 | ✅ screenshot; operator-oordeel bounce ⏳ |
| 84 | Opstart: zwart systeemscherm, V bouwt zich op + lichtstreep + onthulling (enkel zichtbaar in release-build) | A16 | ⏳ release-APK |
| 85 | Kleuren: Sleep-golf echt Bio-Teal (State Control + breath), harten Bio-Teal-overgang, alle pop-ups glas | A16 | ✅ cirkel operator "fout groen" → opgelost (screenshot); pop-ups ⏳ |
| 86 | "Early 2027" i.p.v. Fall 2026 overal in de app | A16 | ⏳ visuele controle |
| 87 | State Control-scherm 10 okt: duurpillen weg, cirkel groter (304) en lager, bpm-pil boven de cirkel, zone (Short/Recommended/Extended/Long) in de cirkel, i-blad met "Session length"; titel welkomstscherm "Feel different. Perform differently." | A16 | ✅🔒 operator: "heel goed gedaan, dit perfect" |
| 88 | Aanbevolen duur overal gelijk (personalRecommendedMinutes): cirkel, i-blad, sessie "· recommended", agenda-/planwielen, onboarding-dagplan, protocol | A16 | ⏳ |
| 89 | Techniek-infoblad in kaarten (iOS-stijl): feiten-kaart (Level/Rhythm/Best for), veiligheid, Use this when, Session length met vinkje + "Recommended · X min" | A16 | ⏳ |
| 90 | Plan/agenda/herinnering met vrije minuten (bv. 15) → sessie loopt exact 15 (niet afgerond naar 10); add-to-day bewerken houdt eigen duur | A16 | ⏳ |
| 91 | Onboarding-dagplan: kaart, gratis eerste sessie en plan gebruiken dezelfde techniek (per ervaring) en dezelfde aanbevolen minuten | A16 | ⏳ |
| 92 | State Control Set your day: duurwiel elke minuut min–max (Boost tot 20), zelfde bereik als de cirkel | A16 | ⏳ |
| 93 | Plan 'Ongoing' (breath + State Control): agenda toont altijd 30 dagen vooruit, ook na dag 30; plan met vaste duur: laatste ≤7 dagen herinneringen per datum, na de laatste dag geen melding meer | A16 | ⏳ |
| 94 | Remove plan onderaan breath-agenda én State Control-agenda: glas-bevestiging, plan + herinneringen weg, geschiedenis blijft | A16 | ⏳ |
| 95 | State Control-scherm: kalender-icoon rechtsboven (naast tandwiel) → agenda als er een plan is, anders Set your day | A16 | ⏳ |
| 96 | State Control-agenda: sessie verslepen/verwijderen geldt voor elke dag vanaf vandaag; Change protocol start van vandaag's planning en houdt voorbije dagen | A16 | ⏳ |
| 97 | Slepen op de rand van de cirkel (Breathwork-setup én State Control): greep volgt de vinger vloeiend (UI-thread), getal + tik per stap, bij loslaten veert hij zacht naar de gekozen tijd (geen schokken, geen naijlen) | A16 | ⏳ |
| 98 | Resting heart rate meten: hartlijn achter de cirkel (door de ring = "te druk", teruggedraaid); voortgangsring dunner (2, zoals State Control) | A16 | ✅ ringdikte operator "goed"; lijn achter de cirkel ⏳ |
| 99 | Hartslag meten bij lage batterij (flits gaat niet aan): na ~6 s of meteen bij een zaklamp-fout van de camera → "Flash unavailable" met batterij-uitleg, los van een vast %; brandt de flits wél → nooit deze melding | A16 | ✅ screenshot 10 okt (13%): "Flash unavailable" verschijnt |
| 99b | Flits-melding opnieuw (operator 10 okt: "Flash unavailable terwijl de flits brandde"): vaste beslisregel — nooit melding zodra flitslicht gezien; enkel bij 2× zaklamp-fout of lage batterij + 8 s pikzwart. Testen: (a) flits aan, vinger naast de flits 10 s → GEEN foutscherm; (b) flits aan, vinger goed → meting; (c) batterij ≤ 15 % en flits uit → melding na ±8 s | A16 | ⏳ |
| 100 | Vinger-animatie (resting heart rate): vingertop landt bovenaan de cameramodule en bedekt flits + lenzen; teal licht komt van de flits ONDER de vinger en lekt langs de randen | A16 | ⏳ |
| 101 | Tabbalk: State Control · Breath · Library · Activity · Profile (operator 10 okt) | A16 | ⏳ (vorige volgorde Breath·State Control·Library ✅) |
| 102 | Hartslaggeluid op Resting Heart Rate-pagina klinkt weer, ook na een meting openen en sluiten (eigen sleutel per gebruiker: pagina / meting / State Control) | A16 | ⏳ (operator 10 okt: "hoor het niet meer") |
| 103 | Hartslag-blad: titel "RESTING HEART RATE" gecentreerd in hoofdletters zoals SESSION CONTROL / BREATHWORK (operator 10 okt), Cancel rechts | A16 | ⏳ |
| 104 | Hartslagmeting: getal 72 groot, exact gecentreerd boven de cirkel ("bpm" telt niet mee, staat rechts ernaast op de basislijn) | A16 | ⏳ (1e versie: bpm onzichtbaar → hersteld) |
| 105 | Hartslagmeting: statusregels op twee regels ("Reading your heart rate" / "Breathe normally", ook Got it / Hold still, enz.), geen gedachtestreep; tekst springt niet (2 regels passen in de vaste hoogte) | A16 | ⏳ |

**Bewust NIET gedaan (wacht op operator / toestel / backend):** audio-signing-bypass (backend-tabel), account-muur-tekst, FAQ/About/Privacy/Terms-teksten (meditation, neuroscience, energy, camera, leeftijd), BLE v2.4 pauze/hervat + sub-minimum duren (contract), dubbele begeleiding op de achtergrond (native, toestel), iOS-ademhaptiek (iOS-build), Signal Blue in Library (huisstijl, visuele review), Library-hertekenen 4×/s (prestaties).

### Ontwikkelomgeving
| # | Wat | Resultaat |
|---|---|---|
| 16 | Lokale dev build met camera (`npx expo run:android`) | ✅ na 20 min; app bleef wit door koude Metro-bundel (85 s) → oplossing genoteerd |

---

## Nog niet getest (gebouwd)
- ⏳ **Echte build, einde ronde 8 okt:** vergrendelscherm-tekst vast (`76420ff`, native); V-logo i.p.v. muzieknoot (`6be14fc`, native); let ook op: 9 okt stonden er 12 open expo-audio-mediasessies (ExpoAudioBasicMediaSession) — mogen de ademsessie niet van het vergrendelscherm verdringen, anders opruimen; haperen sessie op vergrendelscherm; Boost: 1× stemcue overgeslagen (dev, via wifi) — zo nodig cues lokaal voorladen
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
- ⏳ State Control-label "Starts at X bpm · Resting/Average/Now" + blad "Start from your heart right now": meten → label "· Now", resultaat "For this session only…"; "Use Resting Heart Rate" zet terug naar rust; na sessiestart/15 min terug "· Resting" (9 okt 2026, blad + label op A16 gezien)
- ⏳ State Control nieuwe opzet (9 okt 2026): cirkel 270 met enkel tijd, duur-segmenten eronder (gekozen = toestandskleur, rest transparant), kaart "Starting heart rate" onderaan → tik opent blad; alles past boven Start op de A16 + klein toestel (test 65)
- ✅ 🔒 9 okt 2026 (test 53, opnieuw bevestigd, GOEDGEKEURD — niet meer wijzigen): lopende ademsessie vergrendelen → sessie loopt door, stem + achtergronddienst actief, vergrendelscherm toont "CALM CONTROL • Inhale • …". Let op bij testen: na een code-wijziging (herladen tijdens ontwikkelen) eerst de app volledig sluiten en opnieuw openen — anders kan een herlaadbeurt de sessie stoppen en een losse soundscape laten doorspelen (enkel dev, niet in de echte app).
- ✅ 9 okt 2026: ademsessie vergrendeld terwijl GEPAUZEERD → niets op het vergrendelscherm = bedoeld (pauze = er gebeurt niets); weergave enkel bij een lopende sessie (test 53)
- ⏳ Tikjes (9 okt 2026, utils/haptics.ts): knoppen = fijne systeemtik (Android KEYBOARD_TAP), slepen cirkel/draaiwiel = schuif-tik (SEGMENT_FREQUENT_TICK / TEXT_HANDLE_MOVE), gedempt <40 ms; iOS Apple-generators. Op A16 én iPhone voelen: subtiel, niet hard/stroef
- ⏳ Hartslag meten: live bpm groot boven de ring (eerst "--", na de omtrek een afgevlakt getal), na afloop 1,6 s het eindgetal in teal + "Done" + succes-tik, dan pas het resultaat
- ⏳ **Nieuwe build (expo-battery):** hartslag meten onder 15% batterij → melding "Flash unavailable" / "Measurement failed" + korte uitleg i.p.v. vaag "camera couldn't start" (9 okt 2026: A16 op 7–8%, zaklamp bleef uit)

---

## Volledige hertest (na afronding bouwronde)
Operator, 7 okt 2026: "nadat alles gebouwd is gaan we alles volledig
opnieuw testen, volledige app". Op te stellen als testplan per scherm/
ingang (welcome, alle tabs, breathwork alle 15 technieken, State Control
alle 5 + Quick, voorproeven, paywall/abonnement/restore, account in/uit,
Activity, Profile, legal, meldingen, minimaliseren, horloge, iPhone) en
hier af te vinken.
