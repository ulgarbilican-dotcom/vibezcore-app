# Kwaliteitsprocedure (bindend voor elke sessie, 21 okt 2026)

Reden: dezelfde fouten kwamen herhaaldelijk terug omdat opmerkingen per scherm werden opgelost i.p.v. als regel voor de hele app.

## 1. Opmerking = regel
Elke opmerking van de operator wordt hier een regel; daarna een zoekopdracht over ALLE schermen en alles aanpassen.

## 2. Testmatrix vóór "klaar"
- Formaten: 360×640, 411×914, 430×932.
- Navigatie: 3-knops én gesture (`cmd overlay enable/disable com.android.internal.systemui.navbar.threebutton|gestural`).
- Systeemletter 130%.
- Emulator = alleen layout. Animaties, blur, haptiek, geluid, iOS: enkel op toestel; als "niet gezien" melden.

## 3. Melden
Alleen wat met een screenshot gezien is, heet gecontroleerd. De rest: "niet gezien".

## 4. Regels
- Onderste inhoud en knoppen/links: minimaal 64 dp (+ inset) boven de onderrand; scrollinhoud krijgt ruimte gelijk aan de vaste knop.
- Foto's: volle breedte, eigen verhouding, nooit hoger dan scherm min tekstblok; geblurde achtergrond; onderaan zacht naar zwart; posities als verhouding.
- Teksten: nooit afkappen zonder reden; wraap, schaal, of scroll.
- Uitgeschakelde knoppen: ondoorzichtig.
- Terugknop: één stijl in de hele app.
- Quick Chill/Boost: alleen icoon in glazen cirkel, tik = popup.
- State Control overslaan = direct naar het scherm, niet naar de hartslagpagina.
- Eén vinkje per bevestiging.
- Welkom/intro-foto's: beide gezichten in beeld.
- Free-omgeving: welkomstschermen bij elke binnenkomst op een tab, behalve direct na een sessie.

## 5. Ademruimte (toegevoegd 22 okt 2026)
Naast "is iets kapot" (overlap, afkapping) toets elk scherm op "ademt het":
1. Minstens 12 dp lucht tussen onderdelen.
2. Minstens 24 dp vrije ruimte onder de laatste inhoud vóór een knop of rand.
3. Verticaal evenwichtig: niet alles bovenaan met een gat eronder, of omgekeerd.
4. Te veel voor dit formaat? Laat bijzaken weg (voetnoten, extra uitleg) in plaats van alles samen te drukken.
Een scherm is pas goed als beide controles (kapot én ademruimte) geslaagd zijn.

## 6. Lokale builds met nieuwe afbeeldingen (22 okt 2026)
Een incrementele Gradle-build neemt NIEUWE afbeeldingsbestanden niet mee (zwart vlak in de app). Bij nieuwe foto's altijd:
`gradlew -p android :app:createReleaseUpdatesResources --rerun :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease`
Een store-/EAS-build bouwt vers en heeft dit niet.
