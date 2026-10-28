# Privacyformulieren na Backup & Sync (26 okt 2026)

Wat verandert er? Ingelogde gebruikers sturen een back-up naar het eigen account (Supabase, tabel `user_data`, beveiligd met RLS):
instellingen en doelen, ervaringsniveau, stem/trilkeuzes, "introductie afgerond"-vlaggen, **rusthartslag (één getal, welzijn)**, ademhistoriek, actief plan, **State Control-sessies, favorieten, beluisterde sessies en hervatposities (Audio Library)** (laatste drie toegevoegd 28 okt 2026).
Gasten sturen niets. Herinneringen worden NIET gesynct. Account verwijderen verwijdert de rijen (ON DELETE CASCADE).

> Dit is een voorstel op basis van de code. Jij (operator) bent verantwoordelijk voor de definitieve antwoorden; controleer ze tegen de actuele vragen in de consoles.

## Google Play: Data safety

Algemeen: "Verzamelt de app gebruikersgegevens?" **Ja** (was al ja: e-mail, aankoopgegevens, anonieme play-events).

| Gegevenstype | Verzameld | Gedeeld met derden | Doel | Optioneel |
|---|---|---|---|---|
| Persoonlijke gegevens → E-mailadres | Ja (al zo) | Nee | Accountbeheer, app-functionaliteit | Nee (alleen bij account) |
| **Gezondheid en fitness → Gezondheidsgegevens** (rusthartslag, een getal dat de gebruiker invult of meet) | **Ja, nieuw** — alleen voor ingelogde gebruikers | Nee | **App-functionaliteit** (instellen van het ritme; meereizen naar een nieuw toestel) | **Ja** (de gebruiker mag het overslaan; gemiddelde 70 bpm) |
| **Gezondheid en fitness → Fitnessgegevens** (afgeronde ademsessies: toestand, duur) | **Ja, nieuw** — alleen voor ingelogde gebruikers | Nee | App-functionaliteit (geschiedenis op elk toestel) | Ja (alleen met account) |
| App-activiteit → App-interacties (doelen, niveau, keuzes) | Ja, nieuw (ingelogd) | Nee | App-functionaliteit | Ja |
| **Gezondheid en fitness → Fitnessgegevens** (ook: afgeronde State Control-sessies: toestand, duur) | **Ja, nieuw** (28 okt 2026) — alleen ingelogd | Nee | App-functionaliteit | Ja |
| **App-activiteit → App-interacties** (favorieten, beluisterde sessies, hervatpositie in audio) | **Ja, nieuw** (28 okt 2026) — alleen ingelogd | Nee | App-functionaliteit (op elk toestel) | Ja |
| Aankopen → Aankoopgeschiedenis | Ja (al zo, via RevenueCat) | Ja, met RevenueCat (betalingsverwerker) | App-functionaliteit | Nee |
| App-informatie en -prestaties → Crashlogs | Ja (al zo, met toestemming, Sentry) | Ja (Sentry) | Analyse | Ja |

Beveiligingssectie:
- **Gegevens versleuteld tijdens verzending:** Ja (HTTPS).
- **Gebruikers kunnen verwijdering aanvragen:** Ja — in de app (Profiel → account verwijderen, backend `/api/delete-account`). De tabel `user_data` verwijst met ON DELETE CASCADE naar de gebruiker, dus de rijen verdwijnen mee. **Bevestigd op 27 okt 2026 met een echte test**: testaccount verwijderd in de app; daarna `select … from public.user_data` gaf 0 rijen en er waren 0 achtergebleven rijen zonder bijbehorende gebruiker.
- Camerabeelden worden niet opgeslagen of verstuurd (blijft zoals het was).

## Apple App Store: App Privacy ("voedingslabel")

"Data Used to Track You": **Nee** (geen tracking).

"Data Linked to You" (gekoppeld aan de gebruiker, alleen voor ingelogde gebruikers):

| Categorie | Gegevenstype | Doel |
|---|---|---|
| Contact Info | E-mailadres | App Functionality |
| **Health & Fitness** | **Health** (rusthartslag, één getal) | **App Functionality** |
| **Health & Fitness** | **Fitness** (ademsessies en State Control-sessies: duur en toestand) | App Functionality |
| Purchases | Purchase History | App Functionality |
| Usage Data | Product Interaction (doelen, niveau, keuzes; favorieten, beluisterde sessies, hervatpositie in audio) | App Functionality |
| Identifiers | User ID | App Functionality |

"Data Not Linked to You": Diagnostics (Crash Data, met toestemming), anonieme play-events (Product Interaction, willekeurige ID — niet aan de gebruiker gekoppeld).

Let op bij Apple:
- De rusthartslag wordt niet uit HealthKit gelezen (HEALTH_INTEGRATION_ENABLED staat uit). De app benoemt het als **welzijn, niet medisch** — zeg dat ook zo in de notities voor review.
- Als je in de beschrijving over rusthartslag praat: geen meet- of diagnoseclaim ("Inaccurate Health Measurements"-richtlijn).

## Privacyverklaring (website)

De in-app tekst (`src/data/legal-content.ts`) is bijgewerkt: nieuwe sectie "Backup & Sync (signed-in users only)", en de zinnen "stays on your device" zijn aangepast. **De webversie op vibezcore.com / app.vibezcore.com staat niet in deze repo** — daar moet dezelfde wijziging worden doorgevoerd (anders spreken app en website elkaar tegen).

## Na akkoord (aangevuld 28 okt 2026: State Control-sessies + Audio Library zitten nu ook in de back-up)

1. Play Console → App-inhoud → Gegevensbeveiliging: bovenstaande invullen en publiceren.
2. App Store Connect → App Privacy: bovenstaande invullen vóór de volgende indiening.
3. Website-privacyverklaring bijwerken met de nieuwe sectie.
