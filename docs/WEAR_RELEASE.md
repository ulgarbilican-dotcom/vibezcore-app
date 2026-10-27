# Horloge-app (Wear OS) naar de Play Store

Sinds Wear OS 3 installeert een horloge-app **niet** meer automatisch mee met de
telefoon-app. Ze moet apart geüpload worden, in **dezelfde** app in de Play Console
(zelfde pakketnaam `com.ubili.vibezcoreapp`, geen nieuwe app).


## 0. VÓÓR elke horloge-build (bindend, 27 okt 2026)
`android/wear/src` is een **kopie** van `wear-app/src` en wordt enkel door `expo prebuild` bijgewerkt. Een build zonder die stap bevat de laatste
wijzigingen NIET (bundel 26102714 ging zo naar Play zonder de catalogus-fix).
1. `diff -rq wear-app/src android/wear/src` — verschilt er iets: `cp -r wear-app/src/. android/wear/src/`.
2. Bouw, en **controleer de inhoud** van het resultaat vóór je het doorgeeft: dex-strings van de nieuwe code (`catalog/request`, …) en het manifest
   (`aapt2 dump xmltree`, bv. `screenOrientation`).
3. Test de debug-build van dezelfde bron op het horloge (`-PwearVersionCode=1`, telefoon met dezelfde handtekening, anders komen berichten niet aan).
4. Pas daarna het bundel aan de operator geven, met een nieuwe, hogere `-PwearVersionCode`.

## Eenmalig in de Play Console

1. Open de app VIBEZCORE → **Geavanceerde instellingen** → **Form factors** →
   **Form factor toevoegen** → **Wear OS**.
2. Voeg screenshots van het horloge toe (rond, 384×384 of groter). Claude kan ze
   maken van de startpagina, een State Control-sessie en een Breathwork-sessie.

## Elke release van de horloge-app

1. **Upload-sleutel**: dezelfde upload-sleutel als de telefoon-app (staat bij EAS).
   Download ze één keer met `eas credentials` (Android → production → Download
   keystore) en zet ze in `wear-app/` (bv. `wear-app/upload.jks`). Maak
   `wear-app/keystore.properties` aan (staat in `.gitignore`, nooit committen):

   ```properties
   storeFile=wear-app/upload.jks
   storePassword=…
   keyAlias=…
   keyPassword=…
   ```

2. **Bouwen**: in `android/` → `./gradlew :wear:bundleRelease`
   → `android/wear/build/outputs/bundle/release/wear-release.aab`.
   Het versienummer is automatisch uniek en stijgend (jjMMddUU, bv. 26101423);
   vast zetten kan met `-PwearVersionCode=…`.
3. **Uploaden**: Play Console → **Testen → Gesloten testen** → de **Wear OS**-track
   → nieuwe release → `wear-release.aab`.
4. Na de gesloten test: **Wear OS opt-in** bevestigen (Geavanceerde instellingen)
   en de release uitrollen. Google beoordeelt de horloge-app apart op de
   kwaliteitsregels voor Wear OS.

Of er voor een bestaande, al gepubliceerde app opnieuw een testperiode van 14 dagen
geldt, staat niet duidelijk in Googles documentatie — kijk het na bij de stap
"Wear OS opt-in" in de Play Console.

Bronnen: [Form factors op eigen tracks](https://support.google.com/googleplay/android-developer/answer/13295490) ·
[Distribute to Wear OS](https://developer.android.com/distribute/googleplay/wear) ·
[Package Wear OS apps](https://developer.android.com/training/wearables/packaging)
