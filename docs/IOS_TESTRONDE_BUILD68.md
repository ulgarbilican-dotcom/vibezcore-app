# iOS testronde — build 68 (TestFlight, 1 nov 2026)

Build 68 = commit `d579f5d3` (iPhone + Apple Watch). Operator test op iPhone + Apple Watch.
Werkwijze (operator 1 nov: "noteer stap per stap, er zijn nog zaken die ik ga doorgeven"): eerst ALLES noteren,
pas daarna analyseren en fixen in één ronde, dan één nieuwe iOS-build.

Status: ⏳ = genoteerd, nog niet onderzocht · 🔍 = oorzaak gevonden · ✅ = gefixt (commit) · ❓ = vraag aan operator

## iPhone

| # | Bevinding (operator) | Status | Notitie |
|---|---|---|---|
| 1 | Geen intro of onboarding bij het openen van de app (Free). | ❓ | Waarschijnlijk zoals bedoeld: de intro komt enkel de allereerste keer (`appIntroSeenAt`), en wie ingelogd is opent in het laatste tabblad (CLAUDE.md §3). Een TestFlight-update bewaart de gegevens. Echte eerste keer testen = app verwijderen en opnieuw installeren. Bevestigen met operator. |
| 2 | Onderaan de tabbalk staan de tabnamen links en rechts dicht tegen de rand van het scherm. | ✅ | tabBarStyle `paddingHorizontal: 10` (ook Android). |

## Apple Watch

| # | Bevinding (operator) | Status | Notitie |
|---|---|---|---|
| 3 | Bij het starten van State Control neemt de smartwatch soms wel en soms niet over. | ✅ (1 nov, Swift niet gecompileerd op Windows — testen in de volgende build) | OORZAAK: de mindfulness-runtime (WKExtendedRuntimeSession) start enkel met de app vooraan. Zonder runtime geen `state_ack` → de iPhone neemt soms niet over. FIX: Mind & Body-workoutsessie (RuntimeSessionManager), start ook op de achtergrond. |
| 4 | Het scherm van de smartwatch springt niet aan vanuit het vergrendelscherm (de app opent niet vanzelf). | ✅ (1 nov, Swift niet gecompileerd op Windows — testen in de volgende build) | startWatchApp → `handle(workoutConfiguration)` start nu meteen de workoutsessie (`startFromPhoneLaunch`), ook vergrendeld. |
| 5 | Ping-geluid op de smartwatch (bij de trillingen) — in Free én Premium. Mag niet: enkel trillen. | ✅ (1 nov, Swift niet gecompileerd op Windows — testen in de volgende build) | Enkel nog `.click` (stil) op elk niveau; `.start/.directionUp/.directionDown` spelen een toon die een app niet kan dempen. |
| 6 | Haptiek is ok maar niet heel hard. | ✅ (1 nov, Swift niet gecompileerd op Windows — testen in de volgende build) | Sterker zonder toon kan watchOS niet (enkel `.click` is stil). Bewust gekozen: geen toon. Fasen nu herkenbaar aan het ritme; tekst op het horloge aangepast ("Taps without sound"). |
| 7 | Eerst verschijnt een gedimd scherm ("Sharp Focus · 1 min" in een blauwe ring, foto operator); na bewegen het gewone scherm, kort daarna weer het gedimde scherm. | ⏳ | Always-on / verminderde helderheid (isLuminanceReduced). |
| 8 | Het gedimde scherm blijft altijd op "1 min" staan (telt niet af). | ✅ | Eigen minutenteller hing aan de app (slaapt met pols omlaag). Nu `Text(timerInterval:)`: het systeem telt zelf af (State Control + Breathwork). |
| 9 | Het app-icoon op het horloge: de rand is veel te wit en erg lelijk. | ✅ | De ring lag op de rand van het ronde masker. Nu omgekeerd iPhone-icoon: witte cirkel, zwarte V, geen ring (operator 1 nov). Galaxy Watch idem in wear-app (volgende horloge-build). |
| 10 | Breathwork-haptics werken helemaal niet op de smartwatch: enkel een ping bij het starten van een cyclus. Ook in Premium: de animatie klopt, maar enkel een ping bij het begin van de sessie en GEEN haptics tijdens de lopende sessie. Operator: "zonder geluid of kijken weet niemand wat te doen" — de trilling MOET elke fase (in/vast/uit) aangeven. | ✅ (1 nov, Swift niet gecompileerd op Windows — testen in de volgende build) | OORZAAK: app sliep na de eerste tik (geen runtime, zie #3). FIX: workoutsessie + stille tikken met ritme per fase: in = elke 0,5 s, vast = één tik, uit = elke 1,2 s. |

## iPhone (vervolg)

| # | Bevinding (operator) | Status | Notitie |
|---|---|---|---|
| 11 | De app blokkeert bij het aantikken van een audiosessie (Audio Library) en blijft bevroren. | ✅ | Zie #13 (zelfde oorzaak). | Ernstig (app hangt). Crashlog/Sentry nakijken; mogelijk speler + horloge/Sound timing-code (nieuw in deze build). |
| 12 | Het geluid van de audio moet beter: klinkt niet heel luid en de kwaliteit lijkt ook niet heel goed (iPhone). | 🔍 | Na te kijken: volume/ducking (audio-sessie iOS, mogelijk nog "ducked" door hartslag-/stem-sessie), bitrate van de MP3's op Bunny, en of iOS de stream in lage kwaliteit afspeelt. Vergelijken met Android op dezelfde sessie. GEMETEN 1 nov: Carl Jung 01 = -20,5 LUFS (piek -2,3 dBFS), 160 kbps stereo 44,1 kHz. Podcasts ≈ -16, Spotify -14 → 4–6 dB stiller. App-volume staat al op 1 (max), audiomodus wordt bij elke sessie opnieuw gezet. Oplossing = bestanden normaliseren (operator-beslissing, Bunny). |

| 13 | Knoppen in de Audio Library werken niet correct: Favorites gaat niet open, en daarna bevriest alles. De audio speelt wel door, maar pauzeren, minimaliseren, sluiten of eender wat lukt niet meer. Ook in Premium: bevroren terwijl de audio doorspeelt; vermoedelijk vooral na het aantikken van de drie puntjes naast de actieve audio (⋯ om als favoriet op te slaan): er opent GEEN onderblad, en daarna reageert de app niet meer. | ✅ | OORZAAK: de speler is op iOS een native modal; het ⋯-menu (showVibezAlert) opende een RN `<Modal>` vanuit de root → iOS weigert die te tonen boven de speler, maar de app wacht erop en reageert niet meer. FIX: `<VibezAlertHost />` ook in player.tsx; VibezAlert houdt een stapel hosts bij, de bovenste toont. | Ernstig, hangt samen met #11. Eerste spoor: het ⋯-menu op iOS. Klassiek iOS-patroon: een tweede Modal openen terwijl de speler al als Modal open staat → iOS toont het blad niet, maar een onzichtbare laag vangt alle tikken op.  de JS-thread lijkt vast te zitten (audio = native, speelt door; UI reageert niet). Eerst de oorzaak van de blokkade zoeken (lus/zware render/await op native call die niet terugkomt op iOS). |

| 14 | In Premium neemt de smartwatch niets over tot de operator het horloge ontgrendelt. | ✅ (1 nov, Swift niet gecompileerd op Windows — testen in de volgende build) | Zie #3/#4. |
| 15 | State Control (Free én Premium): de haptische pulsen van telefoon en horloge lopen niet gelijk; de secondenteller wel. | ✅ (1 nov, Swift niet gecompileerd op Windows — testen in de volgende build) | Waarschijnlijk dezelfde oorzaak: zonder runtime vallen de timers van het horloge stil/te laat. Na de workoutfix opnieuw meten. |

## Nog door te geven door de operator

(volgende bevindingen hieronder toevoegen)
