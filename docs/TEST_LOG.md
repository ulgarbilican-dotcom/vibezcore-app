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
| 102 | Hartslaggeluid op Resting Heart Rate-pagina klinkt weer, ook na een meting openen en sluiten (eigen sleutel per gebruiker: pagina / meting / State Control) | A16 | ⏳ (operator 10 okt: "hoor het niet meer") ❌ opnieuw stil (2e melding) → spelers niet meer per bezoek vernieuwd, enkel bij echt kapot; dev-log [heartbeat] |
| 103 | Hartslag-blad: titel "RESTING HEART RATE" gecentreerd in hoofdletters zoals SESSION CONTROL / BREATHWORK (operator 10 okt), Cancel rechts | A16 | ⏳ |
| 104 | Hartslagmeting: getal 72 groot, exact gecentreerd boven de cirkel ("bpm" telt niet mee, staat rechts ernaast op de basislijn) | A16 | ⏳ (1e versie: bpm onzichtbaar → hersteld) |
| 105 | Hartslagmeting: statusregels op twee regels ("Reading your heart rate" / "Breathe normally", ook Got it / Hold still, enz.), geen gedachtestreep; tekst springt niet (2 regels passen in de vaste hoogte) | A16 | ⏳ |
| 106 | Meting boven 100 bpm: getal getoond, "Not a resting heart rate" / "Your session starts here. Measure at rest for your baseline"; witte knop = gewoon verder (sessie start op dat ritme, bpm-pil toont het 15 min), tekstknop Measure Again = optioneel; rusthartslag NIET gewijzigd | A16 | ⏳ |
| 107 | Meting 91–100 bpm: "Measurement complete" + "A little high for rest. Sit still a few minutes and measure again for a truer baseline"; witte knop bewaart, tekstknop Measure Again optioneel | A16 | ⏳ (operator: 97 zonder melding) |
| 108 | Einde State Control-sessie: ring sluit en vult zich met glas in de toestandskleur, vinkje altijd wit; modusnaam grijs-wit (geen gekleurde tekst); bracelet-link op twee nette regels | A16 | ⏳ |
| 109 | Flowtest 10 okt (A16, door Claude): breath-agenda (datum Engels, stip → actieblad → Start session → plan-techniek + minuten, start gepauzeerd = bedoeld; minimaliseren/terug; vroeg stoppen = Partial), Your protocol (zelfde done-regel als agenda, per gepland moment), Breath → setup (info-kaarten, cirkel slepen 9:00 → sessie 9:00), State Control (Average 70, Set your plan → Boost 10 min Today only → opslaan → agenda; No more sessions today; stip → Start → sessie; minimaliseren toont Boost-balk; Remove plan met glaskaart), Activity (tellers +1, State Control eerst) | A16 | ✅ na fixes (e08788e, 8ab20f3) |
| 110 | Sessie-pillen: op tabbladen net boven de tabbalk, elders zwevend boven de knopzone — nooit over een titel of CTA | A16 | ✅ screenshots 10 okt |
| 111 | Witte tekst: sessietitel (bv. CALM CONTROL) en dagdelen/tijden in Your protocol | A16 | ⏳ |
| 112 | Hartslagmeting klaar: Save (bewaart, tik) → "Saved as your resting heart rate" + knop Let's Go → pas dan verder; Measure Again tot je bewaart; sluiten zonder bewaren → "Save this measurement?" (Save sluit meteen / Discard) | A16 | ⏳ |
| 113 | Add session (State Control-plan): dunne ring zoals Session Control, tijd als 10:00 | A16 | ✅ screenshot 10 okt |
| 114 | State Control-agenda actieblad: Done/Partial/Missed + Edit duration (geldt voor elke dag vanaf vandaag) + Remove from plan; geen play-icoon meer | A16 | ⏳ (geen plan op toestel tijdens test) |
| 115 | "This week" = maandag t.e.m. zondag (historiek State Control + Breathwork, Activity-tellers), "Today" op de juiste dag | A16 | ✅ screenshot 10 okt |
| 116 | State Control-intro: "The Power to Shift. From Your Wrist." | A16 | ✅ screenshot 10 okt |
| 117 | bpm-pil (Session Control): kop RESTING HEART RATE, 81 bpm + "Measured 10 Oct", knop "Measure for This Session" (verandert rusthartslag NIET, ook >100 geldig, daarna Let's Go) en "Update Resting Heart Rate ›" → zelfde opbouw met Measure my heart rate / Enter it myself / Use an average; geen uitleg in het blad | A16 | ✅ screenshots 10 okt (meten zelf ⏳) |
| 118 | Activity bovenaan HEART RATE → pagina Heart Rate: Bio-Teal hart, rusthartslag + tijdstip van de GEBRUIKTE meting, "Your calmest recent measurement" bij meerdere, Measure or Update, History (gemeten / ingevuld / voor een sessie, met datum + uur, "In use"); State Control activity met het officiële tab-icoon | A16 | ✅ screenshots 10 okt (sessiemeting in History ⏳) |
| 119 | Rusthartslag = laatst bewaarde waarde (gemeten of ingevuld), geldt voor alle sessies; bpm-pil, Heart Rate-pagina ("In use" bij de nieuwste) en sessies tonen hetzelfde getal | A16 | ✅ bpm-pil 87 (10 okt) |
| 120 | Plafond op sessiedoel: basis boven 80 zet het einde niet hoger (Calm 64, Clarity 56, Sleep 44, Focus 72); 60–80 ongewijzigd; Boost 110 | ✅ A16 log 10 okt |
| 121 | State Control ritme-test (A16, rust 80, log [haptic-test] uit de echte golfvorm): Boost 80→110 (10 s vast, 10 s glijden), Sharp Focus 80→72, Calm Control 80→64 (beide na 20 s), Clarity & Relax 80→56 en Sleep 80→44 (na 130 s); sessielengte = gekozen duur (+1,6 s eindsignaal: 3 sterker wordende tikken); pauze + hervatten gaat verder op de curve (offset 20,3 s); Quick Chill 5 min volledig afgelopen → afsluitscherm glas + wit vinkje. Simulatie met dezelfde code: rust 60/70/87, startmeting 110 → alle doelen bereikt, geen negatieve tijden | A16 + simulatie | ✅ 10 okt |
| 122 | Sessie uit State Control-plan/herinnering start GEPAUZEERD (zelf op play, zoals Start op Session Control); Quick Chill/Boost blijven meteen lopen. Actieblad bracelet-agenda telt enkel sessies sinds het plan (Missed i.p.v. foutief Partial) | A16 | ✅ 10 okt |
| 123 | Audio & Haptics: VIBRATION STRENGTH Soft / Medium / Strong — voelbaar verschil, tik bij kiezen, wijzigt meteen tijdens een lopende sessie (zelfde punt in de curve), onthouden | A16 | ⏳ |
| 124 | Kortere minimumduur: Boost/Sharp Focus/Calm Control vanaf 5 min, Clarity & Relax/Sleep vanaf 10 min (cirkel, Add session, agenda Edit duration); zone "Short" tot de aanbevolen duur | A16 | ⏳ (verbinding weg) |
| 125 | Sessie uit plan/herinnering laten aflopen → terug naar de keuzepagina: GEEN lopende balk meer, sessie start niet opnieuw (startlink werkt één keer, app-breed) | A16 | ⏳ (operator 11 okt: liep opnieuw door) |
| 126 | Audit 12 okt: State Control Start → gepauzeerd op 18:00 (niet 17:59); Play → haptiek start (log [haptic-test]); Pause → tijd staat stil; End → keuzepagina, blijft stil (8 s gewacht). Bracelet-opdrachten nu na de monitor met foutopvang; geen zoek-/verbindscherm meer vóór State Control | A16 | ✅ 12 okt (End bij verse 18:00-sessie niet afgerond: dev-LogBox lag over de knop — operator hertest) |
| 127 | iOS: app afsluiten tijdens State Control → bij openen gepauzeerd, "Session complete"-melding en Live Activity stoppen mee | iPhone | ⏳ |
| 128 | Breathwork: sessie minimaliseren, andere sessie starten → "End current session?" (End & Start New / Cancel); bij End staan de geademde minuten in de geschiedenis en stopt het horloge | A16 | ⏳ |
| 129 | Instant "Anxious / nervous" (en vrije tekst "panic") → Physiological Sigh 5 min (Clarity & Relax), geen holds | A16 | ⏳ |
| 130 | Audio: gratis sessie herspelen vanuit Your Journey → volledig (geen 60 s); trial-sessie via Continue/autoplay zonder trial → 60 s-voorproef; trial-rijen tonen "FREE WITH TRIAL" i.p.v. "PREVIEW · 60S" | A16 | ⏳ |
| 131 | Heart Rate-pagina: "Clear Heart Rate Data" → bevestiging → metingen (ook sessie-metingen) weg, 70 bpm gemiddeld | A16 | ⏳ |
| 132 | Delete account → alle lokale gegevens weg (geschiedenis, hartslag, plannen, favorieten); Settings → Clear all local data werkt zonder herstart | A16 | ⏳ |
| 133 | Privacyverklaring: Camera & flash-kaart + vingertop-meting vermeld; camera-toestemmingstekst "estimate your pulse … not a medical measurement" (nieuwe build) | A16 + iPhone | ⏳ |
| 134 | Streak overal één regel (utils/streak.ts): blijft staan tot vandaag voorbij is (Breathwork, State Control, Audio, agenda) | A16 | ⏳ |
| 135 | End session → "End session?" (End Session / Keep Going) in State Control én Breathwork; voorproef/onboarding-proef ongewijzigd | A16 | ⏳ |
| 136 | Titel "State Control" i.p.v. "Session Control" (scherm, Profile-rij, activatie, bracelet-pagina, meldingskanaal) | A16 | ⏳ |
| 137 | Profile tijdens trial: "Premium · Free Trial" + "Free trial ends on …" | A16 (licentietester) | ⏳ |
| 138 | Breathwork-pil: "Paused · m:ss" / resterende tijd | A16 | ⏳ |
| 139 | Player laadfout: "Try Again" laadt opnieuw, Close eronder | A16 (vliegtuigmodus) | ⏳ |
| 140 | Audio Library: zoekbalk ook voor gast/gratis; resultaat opent de serie met de gewone sloten | A16 | ⏳ |
| 141 | Activity: kaart "This week" bovenaan (minuten per soort, dagreeks + beste, Up next uit plannen van vandaag) | A16 | ✅ 12 okt (4 min, reeks 5) |
| 142 | Afsluitscherm State Control + Breathwork: "How do you feel now?" Better / Same / Worse, één tik, bewaard op toestel (Instant houdt eigen vraag) | A16 | ⏳ |
| 143 | Activity "This week": drie aparte cijfers (State Control min · Breathwork min · reeks + beste) | A16 | ⏳ |
| 144 | Eén trilsterkte app-breed: Breathwork Audio & Haptics → onder Phone haptics SOFT / MEDIUM / STRONG (zelfde instelling als State Control; tikken korter/langer, ritme gelijk) | A16 | ⏳ |
| 145 | Breathwork Audio & Haptics: soundscapes per groep op één rij, horizontaal scrollen als ze niet passen (tot de rand van het blad) | A16 | ⏳ |
| 146 | Sentry (EU, project react-native): na nieuwe build een testfout → verschijnt in Sentry Issues, zonder e-mail/IP; dev build stuurt niets | echte build | ⏳ |
| 147 | Session history (State Control + Breathwork): bij elk bezoek enkel vandaag open, alle vorige dagen ingeklapt | A16 | ⏳ |
| 148 | Settings → Health → Health Connect aan: systeemvenster (schrijven Mindfulness, lezen rusthartslag); geweigerd → uitleg; uit → niets meer | A16 + Galaxy Watch4 (nieuwe build) | ⏳ |
| 149 | Breathwork- en State Control-sessie ≥ 1 min verschijnt in Health Connect / Apple Health (begin, einde, titel); < 1 min niet | A16 / iPhone (nieuwe build) | ⏳ |
| 150 | Rusthartslag van het horloge verschijnt op Heart Rate ("From Health Connect", horloge-icoon) als nieuwste waarde; na Clear Heart Rate Data komt een oudere waarde niet terug | A16 + Watch4 (nieuwe build) | ⏳ |
| 151 | Health Connect → toestemmingsscherm → "privacybeleid" opent VIBEZCORE op de Privacy Policy (koud en terwijl de app draait) | A16 (nieuwe build) | ⏳ |

**Bewust NIET gedaan (wacht op operator / toestel / backend):** audio-signing-bypass (backend-tabel), account-muur-tekst, FAQ/About/Privacy/Terms-teksten (meditation, neuroscience, energy, camera, leeftijd), BLE v2.4 pauze/hervat + sub-minimum duren (contract), dubbele begeleiding op de achtergrond (native, toestel), iOS-ademhaptiek (iOS-build), Signal Blue in Library (huisstijl, visuele review), Library-hertekenen 4×/s (prestaties).

### Ontwikkelomgeving
| # | Wat | Resultaat |
|---|---|---|
| 16 | Lokale dev build met camera (`npx expo run:android`) | ✅ na 20 min; app bleef wit door koude Metro-bundel (85 s) → oplossing genoteerd |

---

## Horloge — volledige testlijst (Wear OS, Galaxy Watch4) — eerst ALLES groen door Claude, dan pas operator
Operator, 12 okt 2026: "voor het horloge is het een absolute must dat alles perfect werkt zonder bug — een unieke, duidelijke ervaring". Opstelling: telefoon + horloge ≥ 80 %, Watch4-plugin en Galaxy Wearable op onbeperkte batterij, horloge "verbonden" in Galaxy Wearable, één horlogeversie (geen wijzigingen tijdens de test).

| # | Test | Verwacht | Status |
|---|---|---|---|
| W1 | State Control starten op telefoon (Haptic, Medium) | ons scherm komt vanzelf naar voren op het horloge, ring vol, trilling op de pols, telefoon stil | ⏳ |
| W2 | Haptic + Audio | hartslag hoorbaar op het horloge (horloge-versie), exact op de tik | ⏳ |
| W3 | Soft / Medium / Strong tijdens de sessie | ~60 / ~80 / 100 %, meteen voelbaar verschil | ⏳ |
| W4 | Ring klopt mee | schijf zwelt op elke slag (lub sterker), tempo vertraagt mee met de curve | ⏳ |
| W5 | Pauze op horloge, hervat op horloge | telefoon volgt, tijd klopt (geen sprong) | ⏳ |
| W6 | Pauze op telefoon, hervat op telefoon | horloge volgt | ⏳ |
| W7 | END op horloge | horloge meteen idle, telefoon stopt, geschiedenis +1 | ⏳ |
| W8 | END op telefoon (End Session) | horloge stopt | ⏳ |
| W9 | Sessie loopt natuurlijk af | eind-signaal op de pols, beide schermen afgesloten | ⏳ |
| W10 | Pols omlaag / omhoog (Always On aan en uit) | ambient = gedimd sessiescherm; omhoog = meteen de ring | ⏳ |
| W11 | Wijzerplaat tijdens sessie | V-icoon (Ongoing Activity), één tik = terug in de sessie | ⏳ |
| W12 | Breathwork vanaf telefoon | figuur/fase op horloge, ademritme op de pols | ⏳ |
| W13 | Telefoon vergrendeld in de zak, 10 min | ritme loopt door op de pols | ⏳ |
| W14 | Verbinding weg tijdens sessie (Bluetooth telefoon uit/aan) | telefoon neemt het ritme over; na herstel geen dubbel ritme | ⏳ |
| W15 | Horloge zonder VIBEZCORE-app | telefoon toont "Install VIBEZCORE on your watch" | ⏳ |
| W16 | Geen horloge verbonden (eerder wel) | telefoon toont "Watch not connected" + uitleg | ⏳ |
| W17 | Eerste keer openen horloge-app | vraagt om meldingen (Wear OS 4) | ⏳ |
| W18 | App-icoon in de app-lijst | glazen V, vindbaar | ✅ 12 okt |
| W19 | Breathwork-figuur op het horloge (geen cirkel), halve boog bovenaan, seconden bovenaan, "Inhale / through your nose", "N min left", naam enkel bij pauze | zoals in de app, ademt mee | ✅ 13 okt (Claude, testsessie + echte Calm Control-sessie) |
| W20 | Tik op de figuur = pauze, play-teken; END stopt meteen | werkt | ✅ 13 okt (Claude) |
| W21 | Trilling breathwork met scherm uit | blijft doorgaan (MEDIA, niet TOUCH) | ✅ 13 okt (Claude: 3× trillen om de 4 s met scherm uit); operator zag 1× een stop bij de eerste keer — open |
| W22 | Ritme telefoon ↔ horloge over 40 s | geen oplopende afwijking; verschil bij start | ✅ 13 okt (Claude: beide exact 4,0 s; verschil na correctie ~0,05 s) |
| W23 | App-icoon even groot als andere apps; opstartscherm = enkel V op zwart | adaptief icoon | ⏳ operator |
| W24 | Horloge zelfstandig: catalogus van de telefoon komt aan (Data Layer), startscherm met 5 Breathe-toestanden + figuur | ok | ✅ 13 okt (Claude) |
| W25 | Kiezen op het horloge (duur −/+, Start), sessie start op het horloge, pauze + hervatten op het horloge zelf, END | ok | ✅ 13 okt (Claude, Sleep) |
| W26 | Horloge-sessie komt in de geschiedenis van de telefoon ("Sleep · 14:05 · Slow Extended Exhale · 32 sec") | ok | ✅ 13 okt (Claude) |
| W27 | State Control vanaf de telefoon: het horloge toont ons scherm, niet Samsungs Media-bediening (melding setLocalOnly) | ons scherm blijft vooraan | ✅ 13 okt (Claude); Samsung zet nog wel een mediamelding in de lijst — operator bevestigt |
| W28 | Draaiende rand op het kies-scherm verandert de duur | per tik één stap | ⏳ operator (niet via adb te testen) |
| W29 | Techniek onthouden per toestand: kies op telefoon of horloge een andere techniek → volgende keer staat die klaar op beide; "For you" blijft het advies van het niveau; horloge toont "Last used" + rand | zoals beschreven | ⏳ (horloge viel weg bij de test) |
| W30 | Ander ervaringsniveau kiezen (onboarding / Set your routine / Too hard) → onthouden technieken terug naar het niveau | ok | ⏳ |
| W31 | Horloge startscherm: per toestand een cirkel (ring in toestandskleur, naam, techniek ⌄, minuten, Start), verticaal bladeren, Wear OS-scrollbalk | ok | ✅ 13 okt (Claude) |
| W32 | Tik op minuten → lijst met duurstappen (Recommended, huidige omrand) → terug met de gekozen duur | 3 → 5 min | ✅ 13 okt (Claude) |
| W33 | Tik op techniek → lijst (For you / Last used) → terug met de gekozen techniek en zijn duur | Equal → Diaphragmatic 3 min | ✅ 13 okt (Claude) |
| W34 | Start vanuit de cirkel = meteen ademen met wat klaarstaat | 1 tik | ⏳ operator |
| W35 | Horloge startscherm (operator 13 okt): per toestand één pagina met enkel grote figuur + naam, pagina gloeit in de toestandskleur; korte veeg = volgende toestand (vastklikken); tik start nooit | Boost → Sharp Focus → Calm Control | ✅ 13 okt (Claude) |
| W36 | Tik op toestand → instellingen: figuur, Recommended/Last used + techniek, Duration, witte Start; terug uit een lijst = Start blijft in beeld | Boost: 3 → 5 min, Equal → Diaphragmatic | ✅ 13 okt (Claude) |
| W37 | Start op het instellingenscherm → sessie | 1 tik | ⏳ operator |
| W38 | Alle vijf figuren even groot op startscherm en instellingenscherm (lege rand per afbeelding gemeten en weggesneden) | zon, bloem, lotus, kristal, boom | ✅ 13 okt (Claude) |
| W39 | Doorklikken = één geheel: instellingen, techniek- en duurlijst krijgen dezelfde gloed als de toestandpagina; geen figuur meer op het instellingenscherm; gloed en accenten in de kleur van de figuur zelf (Sleep-groen = boom) | Calm Control | ✅ 13 okt (Claude) |
| W40 | Duur op het horloge per minuut, zoals de telefoon (duration-options.ts); cyclus-technieken vaste stappen; lijst opent op de huidige keuze | telefoon-app openen om de nieuwe catalogus te sturen | ⏳ |
| W41 | Figuren optisch even groot: Sharp Focus-bol iets kleiner, Boost-zon iets groter | zon, bol | ✅ 13 okt (Claude) |
| W42 | Gloed op de toestandpagina rond en binnen de pagina (geen rechte rand bij scrollen) | Clarity → Sleep | ✅ 13 okt (Claude) |
| W43 | Actieve sessie: alle vijf figuren even groot (bijgesneden figuur, zelfde vak als startscherm) | 5 toestanden (demo) | ✅ 13 okt (Claude) |
| W44 | (vervangen door W45 — volledige kleur was te veel) | | — |
| W45 | Startscherm zwart, elke figuur een ingetogen halo in haar eigen kleur; instellingen en lijsten even ingetogen | 5 toestanden | ✅ 13 okt (Claude) |
| W46 | Instellingen: Technique- en Duration-knop even groot (vaste hoogte, naam op één regel, lange namen iets kleiner) | Boost, Sharp Focus, Sleep | ✅ 13 okt (Claude) |
| W47 | Clarity & Relax: nieuwe figuur (operator, "pic calm relax.png"), zwart omgezet naar doorzichtig — horloge startscherm + sessie | | ✅ 13 okt (Claude) — oog 1.18× optisch groter |
| T154 | Clarity & Relax-figuur in de app = het oog ("pic calm relax 2.png" op Bunny), artScale 0.8 | Breath-tab, Clarity-sessie | ⏳ operator |
| T155 | State Control met horloge: horloge trekt de VOLLE Bluetooth-vertraging af (meting: koude start = 10,5 s aankomst, oude grens 8 s liet 2,5–2,9 s achter) + bevestiging nog eens na 3 s (eerste kwam niet aan → telefoon én horloge trilden apart) | Quick Boost, VZSync/[sync]-logs | ⏳ hermeten na install |
| T156 | State Control "Haptics + Audio" met horloge: hartslaggeluid speelt de telefoon (horloge trilt enkel); telefoon-module stuurde sound/lubMs/dubMs nooit door | | ⏳ operator hoort |
| T157 | State Control END (telefoon) → terug naar keuzescherm; END (horloge) → beide terug | Sleep | ✅ 13 okt (Claude) |
| T158 | Horloge State Control stopt nooit meer bij scherm uit: Wear OS zette onze wakelock op DISABLED (Dozing) → tik-per-tik lag tot 100 s stil; nu speelt de trilmotor het hele patroon in één keer | Quick Boost, scherm uit ≥ 2 min | ⏳ operator voelt |
| T159 | Horloge-tik op het rooster van de telefoon — gemeten 13 okt 21:21: telefoon slag 1,538 trilmotor 21:21:55,904, horloge 21:21:55,896 (telefoonklok) → ~0,01 s; cirkel op de telefoon 0,05 s vóór de eigen trilling (was 0,18) | Quick Boost | ✅ 13 okt (Claude, meting) |
| T160 | Horloge drijft niet af: 124 slagen gemiddeld 545,01 ms (verwacht 545) | Quick Boost | ✅ 13 okt (Claude, meting) |
| T161 | Resterende tijd horloge = telefoon (naar beneden afronden + verversen net na de secondewissel; was ceil + vrij interval = tot 2 s verschil) | screenshots ±1 s | ⏳ operator kijkt |
| T162 | Pols en telefoon voelbaar gelijk na bijstelling −80 ms (WATCH_CLOCK_AHEAD_MS 20) | Quick Boost | ✅ 13 okt (operator: "nu lijkt het goed") |
| T163 | Breathwork op het horloge: zelfde sterkte als State Control (Soft 155 / Medium 205 / Strong 255) | Soft/Medium/Strong voelen | ✅ 13 okt (operator: "lijkt goed") |
| T164 | "Welcome back Warrior"-pop-up (o.a. "Your bracelet's ready") verwijderd — verschijnt niet meer na >12 u | app openen | ⏳ operator |
| T165 | Bibliotheek met abonnement: Soundscapes & Affirmations-kaart schermbreed (Free Picks valt weg); zonder abonnement naast Free Picks | Library | ⏳ operator |
| T166 | Bracelet-opkuis (bracelet bestaat nog niet): welkom "Have a bracelet? Activate now" weg; Profile "Activate your product" weg; plan-herinnering "Tap to start. Your rhythm is ready."; tandwiel "Bracelet settings — disconnect" in State Control weg; Settings versie "Audio, Breathwork, State Control"; melding-uit-tekst + Android-kanaal "State Control"; breath-sample zonder "bracelet guidance"; breath-welcome bracelet-info met "Early 2027" i.p.v. "Bracelet tab" | welkom, Profile, State Control, Settings | ⏳ operator |
| T167 | Ongebruikte pagina's verwijderd: smart-bead-bracelet, bracelet-preview, coming (+ registratie/verwijzingen); bundel bouwt (Metro 200) | | ✅ 14 okt (Claude: tsc + bundel) |
| T168 | Copy About/FAQ/Privacy volgens goedgekeurd voorstel (docs/COPY_VOORSTEL_bracelet_about_2026-10-14.md, A1–A9, F1–F10, P1–P2): State Control-kaart op About, bracelet als Early 2027-upgrade, "Who it's for" voor iedereen, geen neuroscience/zenuwstelsel-claims | About, FAQ, Privacy | ⏳ operator leest na |
| T169 | FAQ volledig bijgewerkt: nieuwe rubrieken State Control (4) en Smartwatch (5: Wear OS 3+/Apple Watch, zonder telefoon op Wear OS, installeren, zelfde abonnement, hartslag via Health); overzicht/breathwork/membership/privacy zonder "35 sessions", "Breathwork Premium", bracelet als kern of edelstenen met "energy" | FAQ | ⏳ operator leest na |
| T170 | Audio & Haptics (Breathwork én State Control): regel "Smartwatch · <naam>" met schakelaar (enkel met horloge; Install als de app ontbreekt). Uit = niets naar het horloge, telefoon trilt zelf; ook midden in een sessie (State Control: telefoon neemt meteen over op dezelfde plek; Breathwork: horloge stopt / volgt bij aan). Sterkte-chips ook zichtbaar als enkel het horloge trilt | Calm Control (breath) + Boost (State Control), schakelaar aan/uit tijdens sessie | ✅ 14 okt (Claude, A16 + Watch4): breath uit → horloge krijgt niets, aan + hervat → horloge volgt vanaf ronde 3; State Control uit → horloge stopt, telefoon neemt over op 33,1 s; aan → horloge start opnieuw op curve 42,7 s (eerste tik 114 ms bijgesneden). Fix: setSetting is async, eerst afwachten vóór het opnieuw doorsturen |
| T171 | Soundscapes compact: groepen Noise/Water/Earth/Tone als tabs, één rij eronder met None vooraan; tab opent op de groep van de gekozen soundscape | Audio & Haptics breathwork | ✅ 14 okt (Claude, A16) |
| T172 | Horloge State Control: tijd en tik los afgesteld (WATCH_CLOCK_AHEAD_MS 20 = tijd, WATCH_HAPTIC_DELAY_MS 60 = enkel trilling); gemeten: motor Watch4 ~190 ms na aanroep, plan horloge = plan telefoon (geen drift), klokverschil ≈ +93 ms (min-RTT) | Sharp Focus/Boost met horloge, HAL-logs + VZSync/[sync] | ✅ tijd gelijk (operator); tik ⏳ operator-gevoel |
| T173 | Hartslag-cirkel telefoon + horloge: één doorlopende lub-dub-curve (op, dip, dub op, uitzakken, rust), geen terugspringen | State Control-sessie, schermopname | ⏳ operator |
| T174 | Buitenring telefoon = drukgolf: één lichtend golffront per slag, vertrekt achter de cirkelrand, ease-out, uitdovend, weg vóór de volgende slag (Skia) | Sharp Focus, schermopname 10–20 fps | ✅ 14 okt (Claude, A16, schermopname) |
| T175 | Hartslaggeluid = beeld: lub en dub als losse geluiden, dub op dubAt (30 % van de slag, max 350 ms) — telefoon (native), horloge en iPhone-pad; gemeten lub-startOutput ~45 ms vóór het ritmemoment (+ ~45 ms uitgang), dub 257 ms erna bij Sharp Focus | Sharp Focus Haptic + Audio, logcat startOutput vs [sync] | ✅ telefoon gemeten; horloge/iPhone ⏳ |
| T176 | Horloge sessiescherm: PAUSED boven de naam, gelijke lucht tussen naam · tijd (0,30 r) · knop (38 dp) · END | Sharp Focus lopend + gepauzeerd | ✅ 14 okt (Claude, screenshot Watch4) |
| T177 | Horloge ringanimatie gelijk aan telefoon (ring 80 ms na de slag, 1,5 slag lang; beeld 90 ms later wegens klokverschil) | State Control met horloge | ⏳ operator |
| T178 | Telefoon: kloppende cirkel + drukgolf op een vaste slagklok (gepland slagmoment atMs, beeld-per-beeld op de UI-thread) i.p.v. starten op het JS-event (liep ±150 ms naast de slag); horloge-ring terug naar de vorige versie | Sharp Focus, telefoon + Watch4 naast elkaar | ✅ 14 okt (operator: "nu lijkt het goed") |
| T179 | Horloge-startscherm zonder Recent-rij: enkel State Control en Breathwork; elk onderdeel opent op de laatst gestarte toestand van dat onderdeel (oude gezamenlijke 'recent' telt mee) | Watch4: State Control → Sharp Focus (laatste), Breathwork → Boost (nog geen) | ✅ 14 okt (Claude, screenshots) |
| T180 | Horloge-startscherm volgens mock-up operator: V-merkteken, groet per uur, 'Choose your session', twee gelijke knoppen (symbool + naam 12,5 sp + pijltje), geen rand; alles op één scherm | Watch4 screenshot 18:0x | ✅ 14 okt (Claude, screenshot; operator: "staat goed nu") |
| T181 | Horloge: geen hartslaggeluid (Sound-schakelaar teruggedraaid) — boventonen-opname klonk als een kikker, natuurlijke opname onhoorbaar op de Watch4-luidspreker; geluid blijft op telefoon/oortjes, de pols = trilling | operator-oordeel 14 okt | ✅ besluit operator ("go") |
| T182 | Horloge: trilling loopt door met scherm uit — Breathwork en State Control (lokaal). Oorzaken gemeten: Wear OS breekt een lopende trilling af bij scherm-uit door knop/polsbeweging (dumpsys vibrator_manager 'cancelled_by_screen_off', ook ALARM), Samsung Freecess bevriest de app ~5 s na scherm uit. Fix: alarm-trilling, opnieuw inzetten op ACTION_SCREEN_OFF op exact dezelfde plek, stil geluid in een lus (KeepAlive) | Watch4: State Control Sleep 68 tikken/30 s na knop-uit; Breathwork Sleep 147/30 s na knop-uit, 67/15 s na scherm weer aan | ✅ 14 okt (Claude, logcat + dumpsys) |
| T183 | Horloge valt weg midden in een telefoon-sessie → telefoon neemt na ≤25 s het ritme terug (horloge bevestigt elke 10 s; enkel Wear OS) | telefoon State Control + horloge, horloge-app stoppen | ⏳ test (telefoon nodig) |
| T184 | Sessie op het horloge stuurt de telefoon niet: END/pauze van een horloge-sessie gaat niet naar de telefoon, geen 'ack' → telefoon blijft trillen | Watch4 lokale State Control: END → telefoon kreeg niets | ✅ 14 okt (Claude) — met lopende telefoon-sessie nog ⏳ |
| T185 | Catalogus pas naar het horloge als het abonnement geladen is; gratis Breathwork: na de ene gratis sessie op het horloge op slot, ook zonder telefoon | gratis account nodig | ⏳ test |
| T186 | Geschiedenis: horloge-records met id, telefoon onthoudt geïmporteerde ids, één import tegelijk — nooit dubbel | horloge-sessie → telefoon openen/terugkomen | ⏳ test |
| T187 | Pauze op het horloge van een telefoon-sessie stopt de pols meteen, ook buiten bereik | telefoon State Control + horloge | ⏳ test |
| T188 | Smartwatch-regel ook op de iPhone (Apple Watch-status via WatchConnectivity; zonder Install-knop) | iPhone + Apple Watch | ⏳ (niet bouwbaar op Windows) |
| T189 | Horloge-app: uniek versienummer (jjMMddUU), releasebestand `:wear:bundleRelease` bouwt; Play-stappen in docs/WEAR_RELEASE.md | gradle | ✅ 14 okt (Claude: 26101423, wear-release.aab) |
| T190 | Sessie op het horloge stopte na 8,7 min zonder bewuste aanraking (logcat 10:10:32: één "touch" 2 s na scherm-aan door polsbeweging, op END) → END nu **0,8 s vasthouden** (vlak loopt vol; korte tik = "HOLD TO END"); pauze blijft één tik. Galaxy Watch (HoldToEnd.kt) + Apple Watch (HoldToEndButton) | horloge: tik END → geen stop; vasthouden → stop | ✅ 15 okt (operator: "lijkt nu wel te werken") |
| T191 | Geen horloge-sessies in de geschiedenis op 15 okt: horloge had geen verbinding met de telefoon (BT-koppeling Watch4 verbroken, enkel wifi; telefoon "onbereikbaar") → records wachten op het horloge. Na herverbinden + app openen moeten 10:01 (8,7 min, stopped) en 10:11 (25 min, completed) binnenkomen | Galaxy Wearable openen → VIBEZCORE openen | ✅ 15 okt (na herverbinden binnen) |
| T193 | Horloge-sessie verschijnt meteen in de geschiedenis, ook als de telefoon-app al open staat: horloge stuurt na het opslaan een bericht (action "logged", kind "history") → telefoon haalt op na 1,5 s en 6 s (JS + horloge, geen telefoonbuild nodig) | sessie op horloge beëindigen terwijl de app open staat | ✅ 15 okt (Calm 11:34 binnen enkele s, app open) |
| T194 | iOS-build 17: Xcode-fout "React/RCTMessageThread.h file not found" bij RNWorklets → VisionCameraWorklets (Swift-module) — Expo 55 gebruikt standaard het voorgebouwde React.xcframework, waarin die header ontbreekt. Oplossing: expo-build-properties `ios.buildReactNativeFromSource: true` (enkel iOS, build iets trager) | EAS iOS build | ❌ build 18: bron-build botst met NitroModules/glog → teruggedraaid; zie T197 |
| T195 | State Control-onboarding — HERZIEN 15 okt (6): grafiek als vloeiende S-lijn met gloed en kleurverloop (tekent zich bij elke toestand), stippellijnen, labels met onderregel ("Starts at / Settles at"); pillen met icoon; stappen met verbindingslijn; onderzoeksregel dekt traag én snel (Science §3.1); ronde witte puntjes; vloeiende carrousel (schaal volgt de vinger), paginaschuif links/rechts, bounce op cirkels en keuzerijen. Eerder (5): "Average · 70 bpm" tot er een eigen waarde is, Apple-glas-pillen (lichte rand + pop), blokken komen in beeld (FadeInDown), meer lucht (stappen lager), witte puntjes, info + kaarten lager met witte cijfers, hartslaggeluid op stap 3, stap 3 ook via Settings (met "Keep my current"), stap 4 = meten in hetzelfde patroon (PulseMeter, Save and Continue / Measure Again). Eerder (4): 1 How it works (chips met de 5 toestanden → grafiek met het echte tempo, Match/Glide/Hold kort), 2 Choose your state (horizontale scroll met cirkels in de eigen kleur, info per toestand eronder: eigen uitleg + Ends near + Recommended, tik = voelen), 3 Your heart rate (zelfde kloppend hart als het rusthartslag-scherm, HeartbeatHero gedeeld) → State Control op de gekozen toestand, ENKEL die één keer gratis (`stateFreeMode`), de andere op de voorproef van 30 s. Tekst over 2 regels in blok. Eerder (3): stap 1 alle vijf toestanden als gekleurde glazen kaarten (gebruiksregel eronder), grafiek op stap 2 volgt de gekozen toestand (stijgt bij Boost), na stap 3 opent State Control op die toestand met "Your first full session is free" (`stateFreeSessionUsedAt`, telt pas als de sessie echt loopt; als bezoeker getest: Boost, 70→110, vlag gezet na play). Eerder (2): als bezoeker getest → volledig scherm /state-onboarding?first=1 (geen tabbalk, geen Premium-knopje over STEP), rusthartslag als stap 3 in hetzelfde patroon (Measure now / Enter it yourself / Use an average, meetblad via RhythmSheet), na afloop de gratis State Control-omgeving (Try 30 seconds free). Eerder: HERZIEN 15 okt (operator: "niet consistent, headers links, kijk breathwork-protocol"): exact het breath-welcome-patroon (Back / STEP X OF N + lijn / Skip, kop links pageHeader + grijze subkop, matglazen kaarten, witte CTA). (2 schermen, daarna rusthartslag als stap 3 indien nog niet gekozen): 1 "Haptics Built on Research" + Calm Control/Boost voelen (voorproef, beeld op dezelfde klok; geen voorproef als er een sessie loopt), 2 "It Meets You Where You Are" (Match → Glide → Hold met eigen getallen). Eén keer na de foto-intro (`stateOnboardingCompletedAt`); Settings → State Control → "Watch the intro again" (`/state-onboarding`) | State Control-tab openen → Explore; Settings-rij | ⏳ test |
| T196 | Draaiwiel (technieken onder de cirkel + alle duurwielen): hard scrollen vlot — schaal i.p.v. lettergrootte per beeldje, decelerationRate normal (loopt uit), fijne tik per regel tijdens het scrollen, geen sprong in kleur/gewicht aan het einde, geen dubbele bijsturing | Breathwork → toestand → hard over het techniekwiel scrollen; agenda/plan duurwiel | ✅ 15 okt (operator: "beter nu") |
| T197 | iOS-build: in plaats van React Native uit de bron (build 18 faalde: glog-module + NitroModules) een patch (patch-package) op RNWorklets.podspec: WorkletsMessageThread.h privé, zodat VisionCameraWorklets (Swift) die header met React/RCTMessageThread.h niet meer laadt. Voorgebouwde React blijft (standaard Expo 55) | EAS iOS build 19 | ⏳ build loopt |
| T198 | Horloge (Galaxy Watch): onder elke toestandsnaam één korte grijze regel wanneer te gebruiken (State Control + Breathwork, bron src/data/state-usage.ts, via de catalogus; concept-teksten: For more energy · For deep work · Under pressure · To unwind · Before bed — kort zodat ze onderaan het ronde scherm passen, desnoods 2 regels, nooit afgeknipt). Apple Watch heeft geen toestandenlijst | horloge → State Control / Breathwork | ⏳ test |
| T199 | iOS build 19 gelukt maar door Apple geweigerd: ITMS-90391/90713 (Watch-app zonder icoon). Nu targets/watch/icon.png (1024, ondoorzichtig, V op grafiet zoals de Galaxy Watch) in expo-target.config.js → build 20 | App Store Connect-mail / TestFlight | ⏳ build loopt |
| T200 | iPhone-icoon scherp: assets/vibezcore_icon_ios_1024.png (1024, ondoorzichtig, zelfde V-merkteken op #0a0a0a, zelfde verhouding als het oude 180-px-icoon) als ios.icon; Android ongewijzigd. Gaat mee in de build na build 20 | App Store / TestFlight-icoon | ⏳ volgende iOS-build |
| T201 | Hartslagmeting 20 s i.p.v. 30 s (gevalideerd venster, Yan e.a. 2017), zelfde controles; "Keep my current" weg uit de onboarding (stond dubbel) | meten via onboarding stap 4, Profile, bpm-pil | ⏳ test (nauwkeurigheid: release-test 10 personen) |
| T202 | Uitloggen: elke opruimstap los (een fout bij RevenueCat ontkoppelen brak de rest af → geen "signed-out"-status, geen welkomstscherm, sessies bleven open tot herstart); gratis State Control-sessie enkel voor de toestand uit de onboarding (geen keuze = geen gratis sessie) | Profile → Sign out → welkomstscherm, State Control op slot (30 s) | ⏳ test |
| T203 | Testversie: uitloggen = nieuwe bezoeker (State- en Breathwork-onboarding, gratis sessies, gekozen toestand, rusthartslag terug op nul) om de volledige onboarding opnieuw te zien. Enkel __DEV__, nooit in de winkelversie | Profile → Sign out → welkomstscherm → Control Your State → onboarding 4 stappen | ⏳ test |
| T204 | Hartslaggeluid: luidspreker-geluid zacht gecomprimeerd (+2,5 dB RMS, piek gelijk), stabiel ritme (terugspoelen 0,8 s NA elke slag i.p.v. vlak ervoor; nooit spelen na stop), geluid stopt bij het afronden van de onboarding; na de onboarding één gratis volledige sessie voor ELKE toestand (stateFreeMode -1), daarna alles op 30 s | onboarding stap 3 luisteren (ritme regelmatig?), meten → Save and Continue → stil; State Control: gratis bij elke toestand tot 1 sessie gelopen | ⏳ test |
| T205 | State Control-onboarding: alle knoppen, pillen, cirkels en rijen via het gedeelde PressScale (krimpen + dimmen 0,85, terugveren — zoals de rest van de app); stap 3: hart 40% groter (stage 150→210), keuzekaarten lager boven de knop. Camera-toestemming pas bij stap 4 (na keuze "Measure now"), geweigerd → uitlegscherm | indrukken knop/pil/cirkel/rij: zichtbaar dimmen+krimpen; stap 3 layout | ✅ knop-indruk + stap 3 op A16 (screenshot) · rest ⏳ test |
| T206 | Onboarding stap 1: pillen + grafiek samen in één glaskaart; stap 3: hart nog 30% groter (stage 210→273), hart en keuzekaarten hoger | stap 1 kaart, stap 3 layout op A16 | ✅ screenshot A16 |
| T207 | Dagpas + trial weg (16 okt): plan-kaart "Day Pass" (€1,29, 24 u, geen abonnement) onder Maand/Jaar; geen trial-tekst meer; 17 vroegere trial-sessies → Premium (enkel 10 gratis); dagpas = aankoop + 24 u uit RevenueCat (losse aankoop, geen entitlement), sluit vanzelf op het einduur; Account toont "Premium · Day Pass · Full access until …" met See plans; met lopende pas kan je nog maand/jaar nemen, geen tweede pas; iOS-jaar-ID vibezcore_premium_yearly; FAQ + Terms/Refund bijgewerkt | dev: paywall-kaarten (mock €1,29), FREE/PRO-labels in Audio Library. ECHTE aankoop enkel in store-build (dev = mock): kopen → alles open → 24 u later dicht; Restore op 2e toestel; gast zonder account | ⏳ test |
| T208 | Contact support opent in een browservenster BINNEN de app (iOS Safari-weergave met Done, Android Custom Tab) i.p.v. de externe browser (iOS-punt 9); breathwork-voorproef stopt op exact 30 s voor elke techniek (was hele cycli: tot 38 s bij 4-7-8, 36 s Triangular) | Account › Contact support → sluiten = terug in app; Premium-ademsessie als gast → paywall op 30 s | ✅ Custom Tab op A16 · 30 s ⏳ test |
| T209 | iOS: ademsessie-laag lag boven de bladen (Fabric vlakte de BlurTargetView weg) → Audio & Haptics, End/einde-blad, paywall openden onzichtbaar; Minimize toonde dan het al open blad. Fix: BlurTargetView collapsable={false}. Boog + seconden op iOS ~1 cm lager (translateY 0 i.p.v. -36; Android ongewijzigd) | iOS (nieuwe build): sessie → pauze → Audio & Haptics opent; End session → bevestiging/einde; Minimize → pill; boog-afstand | ✅ Android start normaal · iOS ⏳ |
| T210 | Welkomstscherm: iconen gelijk aan de huidige tabbalk — Control Your State = Radio (was armband-icoon), Train Your Mind = AudioLines (was BookAudio), Reset Yourself = Wind | welkomstscherm na uitloggen | ⏳ test |
| T211 | Paywall rustiger ("laat ademen"): onder de kaarten één regel ("€69,99 per year · Cancel anytime" / "€1,29 once · 24 hours of full access") i.p.v. twee grijze blokjes; dagpas-rij "24 hours · No subscription" op één regel; meer ruimte tussen kaarten, regel, knop en kleine lettertjes; "Audio streams only" naar de kleine lettertjes van de dagpas | paywall in Breathwork/State Control/Audio + /subscribe, elke kaart aantikken | ⏳ test |
| T212 | iOS: State Control-onboarding — vanaf de linkerrand terugvegen = één stap terug, op stap 1 = Back (de onboarding uit); de systeemveeg van het scherm staat uit zodat je niet in één keer de hele onboarding verlaat. Android ongewijzigd (eigen terug-gebaar) | iOS nieuwe build: veeg op stap 2/3/4 en op stap 1 | ⏳ iOS |
| T213 | Opstartanimatie (iOS-punt 20, zoals WHOOP): V tekent zich + lichtstreep, schuift dan naar links en krimpt tot de eerste letter, I B E Z C O R E vouwen één voor één open, kort vasthouden, vervagen naar de app (±2,1 s, enkel koude start) | app volledig sluiten en openen (A16 + iPhone) | ⏳ test |
| T214 | iOS-flits (punt 6): camera werd ingericht vóór de toestemming → faalde stil, nooit opnieuw → geen zaklamp. Nu wordt hij opnieuw ingericht zodra Allow getikt is; de eenmalige toestemmingsfout telt niet als camerafout | iOS nieuwe build: eerste meting na installatie → flits aan | ⏳ iOS |
| T215 | iOS-audio (punt 15): na een ademsessie op de achtergrond zette de native module de iOS-audiomodus om en vergat de JS-kant hem opnieuw te zetten → nu na elke stop opnieuw; snelheid 1,25×–2× met 'high' toonhoogte-correctie (iOS klonk waterig). HOOFDOORZAAK zacht = de bestanden: −17 tot −24 LUFS (norm −16), oude uploads 96 kbps/32 kHz → operator: normaliseren en opnieuw uploaden | iOS: Library luider na hernormaliseren | ⏳ |
| T216 | Tijdkiezer "Starts at" (plan-dag State Control, iOS-punten 6–8): iOS-draaiwiel stond in de pagina, donker-op-donker, zonder Done en ging nooit dicht → nu onderblad met draaiwiel + Done rechtsboven (TimePickerSheet); Android = systeemvenster zoals voorheen | iOS + Android: plan-dag → Starts at → tijd kiezen → Done; overlap-melding blijft leesbaar | ⏳ |
| T217 | Settings: bovenaan "Notifications — Allow notifications  On/Off" met één tik naar de systeeminstellingen (iOS-punt 9: "duidelijk hoe je meldingen terug afzet"); stand ververst bij terugkeer in de app | Settings → Allow notifications → uitzetten → terug: Off | ⏳ |
| T218 | Sessie-flows (audit): (1) einde voorproef / natuurlijk einde / horloge-Stop terwijl de ademsessie verkleind is → sessie eerst terughalen, zodat het blad bij de sessie hoort en Done niet naar een andere pagina springt; (2) plan kiezen in de soundscape-paywall verkleint eerst de sessie (anders opende /subscribe onzichtbaar eronder); (3) iOS: herinnering tikken terwijl de speler (modaal) open is → speler eerst dicht; (4) iOS Bold Text: Inter laadt een stap zwaarder zodat de app de systeeminstelling volgt | breath: verklein → wacht tot einde voorproef; soundscape-paywall → plan; Bold Text aan/uit + app herstarten | ⏳ |
| T192 | iOS-build: Watch-target heette ook "VIBEZCORE" (zelfde als iPhone-app) en Live Activity "VIBEZCORE Live" (spatie) → EAS vond de targets niet ("Could not find target … in project.pbxproj"). Nu VIBEZCOREWatch / VIBEZCORELive, naam op het toestel blijft VIBEZCORE | EAS iOS build | ⏳ build 17 voorbij Configure; faalde op compileren (zie T194) |
| W39b | Horloge startscherm = keuze State Control / Breathe (symbolen Radio/Wind uit de app); per toestand een pagina met label STATE CONTROL (waterring) of BREATHE (figuur) | | ✅ 13 okt (Claude) |
| W40b | State Control op het horloge zelf starten: duur per minuut (Recommended), Start; pauze/hervat/END op het horloge; sessie in de geschiedenis op de telefoon | Boost 10 min: start, PAUSED boven de tijd (niet meer over de knop), END | ✅ 13 okt (Claude) — geschiedenis nog te checken |
| T152 | Telefoon: Breathwork-sessie na ritme-wijziging (fasen vanaf gepland einde) — stem, trilling, boog, ronde-teller | ongewijzigd voor de gebruiker | ✅ 13 okt (Claude: Box Breathing, stem speelt (currentTime loopt), trilling elke 4,0 s) |
| T153 | Breath-keuzepagina: geen i-knop meer boven de cirkels; tik op de gekozen cirkel = "How it works", tik op een andere = die toestand kiezen | beide werken | ✅ 13 okt (Claude op de A16) |

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
