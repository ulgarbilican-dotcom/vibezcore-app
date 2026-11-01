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
| 5 | Ping-geluid op de smartwatch (bij de trillingen). | ⏳ | WKInterfaceDevice.play speelt soms geluid mee. |
| 6 | Haptiek is ok maar niet heel hard. | ⏳ | |
| 7 | Eerst verschijnt een gedimd scherm ("Sharp Focus · 1 min" in een blauwe ring, foto operator); na bewegen het gewone scherm, kort daarna weer het gedimde scherm. | ⏳ | Always-on / verminderde helderheid (isLuminanceReduced). |
| 8 | Het gedimde scherm blijft altijd op "1 min" staan (telt niet af). | ⏳ | |
| 9 | Het app-icoon op het horloge: de rand is veel te wit en erg lelijk. | ⏳ | targets/watch/icon.png (zelfde V op grafiet als Galaxy Watch). |

| 10 | Breathwork-haptics werken helemaal niet op de smartwatch: enkel een ping bij het starten van een cyclus. | ⏳ | Ernstig. BreathHapticPlayer.swift (metronoom-vertaling van breath-haptics.ts). Mogelijk zelfde oorzaak als #5 (ping = WKInterfaceDevice.play met geluid). |

## Nog door te geven door de operator

(volgende bevindingen hieronder toevoegen)
