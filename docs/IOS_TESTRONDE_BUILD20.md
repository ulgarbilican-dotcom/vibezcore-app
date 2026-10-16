# iOS-testronde — build 1.0.0 (20), TestFlight, 15–16 okt 2026

Operator testte build 20 op een iPhone. Build 20 = code van ~13:00 op 15 okt
(vóór het onboarding-werk van 13:08–16:57). Alles hieronder wordt vóór de
volgende iOS-build opgelost: één build met alles, niets overslaan
(operator: "elke build duurt lang").

Status: ⏳ = open · 🔍 = oorzaak gevonden · ✅ = opgelost én getest.

## Lijst (operator, 16 okt 2026)

| # | Onderdeel | Wat de operator zag | Status |
|---|-----------|---------------------|--------|
| 1 | Hele app | Fonts en CTA's lijken kleiner dan op Android | ⏳ |
| 2 | State Control-onboarding | Hele oude versie ("haptics built on research") — verklaard: build 20 is van vóór het nieuwe werk. Komt mee in de volgende build | 🔍 |
| 3 | Onboarding | Geen "Skip"-tekst zichtbaar | ⏳ (eerst nakijken in nieuwe versie) |
| 4 | Na de onboarding | Geen gratis volledige sessie, enkel de 30 s-preview | ⏳ (gratis sessie is nieuw werk, controleren) |
| 5 | Onboarding | Weggaan alleen met de Back-knop, niet met veeggebaar — correct gedrag? | ⏳ |
| 6 | Hartslagmeting | Camera-flits gaat niet aan op iPhone | ⏳ |
| 7 | Breathwork | Geen Breathwork-onboarding meer na de test van de State Control-onboarding | ⏳ |
| 8 | Settings e.a. | Schuifknoppen (Switch) uitgerekt | ⏳ |
| 9 | Contact support | Opent de website buiten de app — je bent weg uit de app | ⏳ |
| 10 | Breathwork actieve sessie | Knop Audio & Haptics reageert niet | ⏳ |
| 11 | Breathwork actieve sessie | End session werkt niet | ⏳ |
| 12 | Breathwork actieve sessie | Minimize-knop opent Audio & Haptics | ⏳ |
| 13 | Breathwork actieve sessie | De boog met de secondenteller moet ~1 cm lager staan dan de ademanimatie | ⏳ |
| 14 | Paywall | Geen prijzen in de prijskaarten | ⏳ |

Vermoedelijk dezelfde oorzaak voor 10–12: op iOS liggen de knoppen in de
sessie anders of zit er een laag over (andere aanraakzones dan op Android).
Nog te bevestigen in de code — geen gok.

## Beslissing monetisatie (operator, 16 okt 2026)

- **De 7-dagen trial vervalt.**
- **Nieuw: dagpas €1,29** — 24 uur alles ontgrendeld, losse aankoop
  (geen automatisch verlengend abonnement). Vervangt het eerdere idee van
  €0,90 (21 sept).
- **Premium-audio niet downloadbaar** (ook niet met dagpas) → niemand haalt
  voor €1,29 de hele bibliotheek leeg.
- **10 gratis sessies**: wél downloaden én delen (vrienden uitnodigen).
- **Premium: 30 s-preview**, daarna de betaalmuur.
- Ideeën uit de strategietekst van de operator, **nog niet beslist**:
  - rustige, donkere betaalmuur na de preview (geen felle onderbreking);
  - Apple Pay / Google Pay met één aanraking;
  - melding 's morgens voor wie 's avonds een dagpas kocht ("nog 12 uur geldig");
  - deellink per gebruiker; wie een vriend binnenbrengt krijgt 1 gratis premium-dag.

Nodig van de operator in de stores: product "dagpas" aanmaken in App Store
Connect en Play Console (non-renewing / consumable), intro-trial uitzetten.
