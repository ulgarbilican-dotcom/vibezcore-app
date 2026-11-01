# iOS testronde — build 68 (TestFlight, 1 nov 2026)

Build 68 = commit `d579f5d3` (iPhone + Apple Watch). Operator test op iPhone + Apple Watch.
Werkwijze (operator 1 nov: "noteer stap per stap, er zijn nog zaken die ik ga doorgeven"): eerst ALLES noteren,
pas daarna analyseren en fixen in één ronde, dan één nieuwe iOS-build.

Status: ⏳ = genoteerd, nog niet onderzocht · 🔍 = oorzaak gevonden · ✅ = gefixt (commit) · ❓ = vraag aan operator

## iPhone

| # | Bevinding (operator) | Status | Notitie |
|---|---|---|---|
| 1 | Geen intro of onboarding bij het openen van de app (Free). | ❓ | Waarschijnlijk zoals bedoeld: de intro komt enkel de allereerste keer (`appIntroSeenAt`), en wie ingelogd is opent in het laatste tabblad (CLAUDE.md §3). Een TestFlight-update bewaart de gegevens. Echte eerste keer testen = app verwijderen en opnieuw installeren. Bevestigen met operator. |
| 2 | Onderaan de tabbalk staan de tabnamen links en rechts dicht tegen de rand van het scherm. | ⏳ | `src/app/(tabs)/_layout.tsx` tabBarStyle/tabBarItemStyle. |

## Apple Watch

| # | Bevinding (operator) | Status | Notitie |
|---|---|---|---|
| 3 | Bij het starten van State Control neemt de smartwatch soms wel en soms niet over. | ⏳ | |
| 4 | Het scherm van de smartwatch springt niet aan vanuit het vergrendelscherm (de app opent niet vanzelf). | ⏳ | startWatchApp (HealthKit, 29 okt). |
| 5 | Ping-geluid op de smartwatch (bij de trillingen) — in Free én Premium. Mag niet: enkel trillen. | ⏳ | WKInterfaceDevice.play speelt soms geluid mee. |
| 6 | Haptiek is ok maar niet heel hard. | ⏳ | |
| 7 | Eerst verschijnt een gedimd scherm ("Sharp Focus · 1 min" in een blauwe ring, foto operator); na bewegen het gewone scherm, kort daarna weer het gedimde scherm. | ⏳ | Always-on / verminderde helderheid (isLuminanceReduced). |
| 8 | Het gedimde scherm blijft altijd op "1 min" staan (telt niet af). | ⏳ | |
| 9 | Het app-icoon op het horloge: de rand is veel te wit en erg lelijk. | ⏳ | targets/watch/icon.png (zelfde V op grafiet als Galaxy Watch). |
| 10 | Breathwork-haptics werken helemaal niet op de smartwatch: enkel een ping bij het starten van een cyclus. | ⏳ | Ernstig. BreathHapticPlayer.swift (metronoom-vertaling van breath-haptics.ts). Mogelijk zelfde oorzaak als #5 (ping = WKInterfaceDevice.play met geluid). |

## iPhone (vervolg)

| # | Bevinding (operator) | Status | Notitie |
|---|---|---|---|
| 11 | De app blokkeert bij het aantikken van een audiosessie (Audio Library) en blijft bevroren. | ⏳ | Ernstig (app hangt). Crashlog/Sentry nakijken; mogelijk speler + horloge/Sound timing-code (nieuw in deze build). |
| 12 | Het geluid van de audio moet beter: klinkt niet heel luid en de kwaliteit lijkt ook niet heel goed (iPhone). | ⏳ | Na te kijken: volume/ducking (audio-sessie iOS, mogelijk nog "ducked" door hartslag-/stem-sessie), bitrate van de MP3's op Bunny, en of iOS de stream in lage kwaliteit afspeelt. Vergelijken met Android op dezelfde sessie. |

| 13 | Knoppen in de Audio Library werken niet correct: Favorites gaat niet open, en daarna bevriest alles. De audio speelt wel door, maar pauzeren, minimaliseren, sluiten of eender wat lukt niet meer. | ⏳ | Ernstig, hangt samen met #11: de JS-thread lijkt vast te zitten (audio = native, speelt door; UI reageert niet). Eerst de oorzaak van de blokkade zoeken (lus/zware render/await op native call die niet terugkomt op iOS). |

| 14 | In Premium neemt de smartwatch niets over tot de operator het horloge ontgrendelt. | ⏳ | Hoort bij #3/#4: zolang het horloge vergrendeld is, start de Watch-app niet (startWatchApp/WKExtendedRuntimeSession). |
| 15 | State Control (Free én Premium): de haptische pulsen van telefoon en horloge lopen niet gelijk; de secondenteller wel. | ⏳ | Pulsrooster horloge vs iPhone (Apple Watch-zelfcorrectie 29 okt, klokverschil). Op Android/Watch4 wel gemeten en synchroon. |

## Nog door te geven door de operator

(volgende bevindingen hieronder toevoegen)
