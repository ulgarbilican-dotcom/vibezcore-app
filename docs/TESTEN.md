# TESTEN — hoe VIBEZCORE getest wordt

Sinds 20 oktober 2026 (operator: "hoe bouwt een professioneel bedrijf dit,
zodat het 100% professioneel en perfect werkt — wij moeten zo bouwen").

**Regel:** geen store-build ("bouwen") zolang laag 1 en 2 niet groen zijn.
De operator test daarna alleen nog wat een mens moet voelen: trilling, ritme,
geluid, horloge.

---

## Laag 1 — logica-tests (gratis, elke wijziging)

```bash
npx jest
```

- `__tests__/rhythm/` — hartslagcurves, modustabel (CLAUDE.md §5), ademtechnieken, duur per ervaring.
- `__tests__/access/` — gratis/Premium/Day Pass, voorproef, onboarding-regels, verkoopkaarten, product-id's.
- `__tests__/content/` — huisstijlregels over alle weergavetekst: VIBEZCORE in hoofdletters, geen verboden claims, geen "silver", Early 2027, pijlers, modusnamen, geen punt op koppen/taglines.

Vindt een test een fout: eerst de code fixen, de test niet aanpassen. Een
teksten-test die faalt = de operator beslist (copy is een operator-keuze).

## Laag 2 — flowtests op toestelprofielen (gratis, lokaal)

Maestro-klanttrajecten in `.maestro/` (01 welkom+tabs, 02 Breathwork-onboarding,
03 State Control-onboarding, 04 Library, 05 Premium, 06 Profiel/FAQ/juridisch,
07 Instant Sessions).

1. Test-APK bouwen (emulator, x86_64):
   ```bash
   cd android && rm -rf app/build/generated/assets/createReleaseUpdatesResources && SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew.bat :app:assembleRelease -PreactNativeArchitectures=x86_64
   ```
   (De `rm` is nodig: expo-updates maakt zijn lijst met ingebouwde foto's
   anders niet opnieuw aan en nieuwe foto's tonen dan niet — enkel lokaal,
   EAS bouwt altijd van nul.)
2. Emulator starten (Pixel_8, `-gpu swiftshader_indirect`).
3. Alle profielen: `bash scripts/device-matrix.sh`
   - pixel8 (gewoon), small (360×640 dp, 3 knoppen), tall (360×840 dp), bigfont (letters 1,5×), lightmode (systeem licht).
   - Screenshots per profiel en per stap in `test-results/<datum>/<profiel>/`.

**iPhone:** dezelfde flows op een iPhone-simulator in de Expo-cloud. Kost
buildtegoed, dus enkel vóór een iOS-store-build:
```bash
npx eas-cli workflow:run .eas/workflows/e2e-ios.yml
```

## Laag 3 — echte toestellen (Firebase Test Lab)

Robo-test: Google installeert de APK op echte telefoons van verschillende
merken en doorloopt de app zelf; rapport met crashes en screenshots.
Gratis tegoed: 5 echte-toesteltests en 10 virtuele per dag.

**Ingesteld op 20 okt 2026:** Firebase-project vibezcore1 (Spark, gratis),
Test Lab aan, Google Cloud CLI geïnstalleerd en ingelogd als de operator.

Per Android-build (ARM-APK): `bash scripts/testlab.sh` — Galaxy S24, Galaxy A15,
Pixel 8a, moto g14, Galaxy A10 (Android 10). Resultaten: Firebase-console →
Test Lab. Test Lab stopt op 30 september 2027 → dan naar Google's Developer
Device Platform.

## Laag 4 — mensen (gevoel)

Testers met verschillende toestellen via de Play-interne test en
TestFlight: iPhone, Pixel/Galaxy S (amplitude-regeling), Apple Watch,
AirPods/Galaxy Buds. Checklist per build (5 min): trilling = beeld,
ritme horloge = telefoon, geluid via oortjes op tijd, tekst leesbaar.

## Uitrol

Productie in stappen (Play: 5 % → 20 % → 100 %; App Store: gefaseerde
release), crashdashboard (Sentry) in het oog; bij een piek de uitrol stilzetten.
