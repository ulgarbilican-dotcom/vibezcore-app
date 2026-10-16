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
| 3 | Onboarding | Geen "Skip"-tekst zichtbaar | ✅ nieuwe onboarding (15 okt) heeft Skip rechtsboven — te zien in nieuwe build |
| 4 | Na de onboarding | Geen gratis volledige sessie, enkel de 30 s-preview | ✅ gebouwd 15 okt (T202/T204), zat niet in build 20 — te zien in nieuwe build |
| 5 | Onboarding | Weggaan alleen met de Back-knop, niet met veeggebaar — correct gedrag? | 🔧 terugvegen per stap (T212) |
| 6 | Hartslagmeting | Camera-flits gaat niet aan op iPhone | ⏳ |
| 7 | Breathwork | Geen Breathwork-onboarding meer na de test van de State Control-onboarding | ⏳ |
| 8 | Settings e.a. | Schuifknoppen (Switch) uitgerekt | ⏳ |
| 9 | Contact support | Opent de website buiten de app — je bent weg uit de app | ✅ in-app browser (T208), iOS nog te zien in nieuwe build |
| 10 | Breathwork actieve sessie | Knop Audio & Haptics reageert niet | 🔍 oorzaak: sessielaag boven de bladen op iOS — fix T209, te testen in nieuwe build |
| 11 | Breathwork actieve sessie | End session werkt niet | 🔍 oorzaak: sessielaag boven de bladen op iOS — fix T209, te testen in nieuwe build |
| 12 | Breathwork actieve sessie | Minimize-knop opent Audio & Haptics | 🔍 oorzaak: sessielaag boven de bladen op iOS — fix T209, te testen in nieuwe build |
| 13 | Breathwork actieve sessie | De boog met de secondenteller moet ~1 cm lager staan dan de ademanimatie | 🔧 iOS 36 dp lager (T209) |
| 14 | Paywall | Geen prijzen in de prijskaarten — OORZAAK GEVONDEN: in RevenueCat offering `default` hebben Monthly en Yearly enkel een Play Store-product, App Store = "No product". Fix = vibezcore_audio_monthly / _yearly (App Store) koppelen in RevenueCat | 🔍 |
| 15 | Audio (iPhone) | Geluid slecht van kwaliteit en maximaal volume heel zacht | ⏳ |
| 16 | Hele app | CTA's lijken dunner (lager/lichter) dan op Android — hoort bij punt 1 | ⏳ |
| 17 | FAQ, Settings, Support | Inhoud nalopen voor State Control, Breathwork, Audio en Smart Bead Bracelet: klopt alles met de app van nu (prijzen, trial weg → dagpas, 20 s meting, namen, Launching Early 2027)? | ⏳ |
| 18 | Legal | Terms, Privacy en andere juridische teksten nalopen (o.a. trial → dagpas, Health/hartslag, camera) | ⏳ |
| 19 | Alle schermen | Elke sluit-, verklein- en terugknop nalopen tegen Apple HIG (plaats, Done/X, veeggebaren, bladen) | ⏳ |
| 21 | App Store Connect — Review Information (per abonnement) | Screenshot = oude Android-paywall met App Store- én Google Play-badge, blauwe knop, €5,83 (risico 2.3.10). Review notes beschrijven oude flows ("Full library access", 60 s-preview, "Continue listening?", 27 Free Picks). Na de nieuwe paywall: iPhone-screenshot + nieuwe notes (10 gratis, 30 s-preview, dagpas, maand, jaar, exacte knopnamen) | ⏳ |
| 22 | Kopen zonder account (Apple 5.1.1(v)) | Nakijken of een gast nog echt kan kopen zonder account: de tekst zegt "continue as a guest below", maar de knop onderaan is "Skip for now" → naar home. Volledige flow testen bij de paywall-ombouw | ⏳ |
| 20 | Opstartanimatie (nieuw) | Zoals WHOOP: de V verschijnt en loopt over in het volledige VIBEZCORE-woordmerk. Voorstel: bestaande V-animatie (LaunchReveal) behouden, daarna schuift de V naar links en vouwen de letters IBEZCORE er één voor één uit, dan opent de app. ±1,8 s, enkel bij koude start | ⏳ |

Vermoedelijk dezelfde oorzaak voor 10–12: op iOS liggen de knoppen in de
sessie anders of zit er een laag over (andere aanraakzones dan op Android).
Nog te bevestigen in de code — geen gok.

Te controleren bij 1/16 (fonts kleiner): op de A16 kan de tekstgrootte
van het systeem groter staan dan 100% (Samsung-instelling), terwijl iOS de
punten 1-op-1 toont; en op iOS kiest een eigen lettertype soms een ander
gewicht als er ook een fontWeight bij staat. Beide nagaan, niet aannemen.

Te controleren bij 15 (audio zacht): de app zet de audiomodus op drie
plaatsen (audio-player, session-keepalive, heartbeat-sound). Het
hartslaggeluid zet `playsInSilentMode: false` / `mixWithOthers`; als die
modus blijft staan, speelt audio in een andere iOS-categorie. Ook nagaan:
volume van de speler, de bestanden zelf (bitrate) en of het geluid via de
oorluidspreker i.p.v. de luidspreker gaat.

## Afbakening (operator, 16 okt 2026)

Punten 1–16 en 19 zijn **enkel op iOS** gezien; op Android leek alles in
orde → oorzaak in iOS-specifiek gedrag zoeken, Android niet breken.
**Gedeeld** (Android én iOS aanpassen): FAQ, prijzen, paywall en de gratis
audiosessies (zie hieronder). Punt 20 (opstartanimatie) geldt voor beide.

## Beslissing monetisatie (operator, 16 okt 2026)

- **De 7-dagen trial vervalt** — overal (app, paywall, FAQ, legal, stores).
- **Prijzen:** dag **€1,29** (full unlock 24 u) · maand **€9,99** · jaar
  **€69,99**. Vaste prijzen — geen intro-prijs meer (was €14,99 met intro
  €9,99 / €89,99 met intro €69,99).
- **Gratis audio: enkel de 10 gratis sessies**, al de rest achter de
  betaalmuur (het trial-niveau met 27 sessies + Breathwork vervalt mee).
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
Connect en Play Console (non-renewing / consumable); gratis trial en
intro-aanbiedingen uitzetten; maand- en jaarprijs op €9,99 / €69,99 zetten.

## Stand stores (16 okt 2026)

- **Google Play — klaar:**
  - maand €9,99: basisabonnement `monthly` actief, intro-12m inactief;
  - jaar €69,99: actief, aanbiedingen inactief;
  - dagpas = product met eenmalige betaling `vibezcore_day_pass`, aankoopoptie `day-pass` (Bestellen, werkt met eerdere versies), 174 landen, actief.
  - Let op: "Prijzen in bulk bewerken" rekent de ingetypte prijs als prijs ZONDER btw (1,29 gaf België €1,59). België moet op €1,29 incl. btw staan.
- **RevenueCat:** dagpas geïmporteerd (Consumable) en als pakket `day_pass` (Custom) in offering `default` gezet (Play Store) — 16 okt. NIET aan het Pro-entitlement koppelen. Een eenmalige aankoop geeft daar anders voor altijd toegang; de app rekent de 24 u vanaf de aankoopdatum.
- **App Store Connect (16 okt):** groep-weergavenaam = VIBEZCORE Premium; maand €9,99 zonder intro, uit de conceptindiening gehaald om naam/beschrijving te wijzigen ("VIBEZCORE Premium Monthly", "Full access: Breathwork, State Control & Audio Library"); jaar idem nog te doen; dagpas nog aan te maken. Nog te doen: (dagpas als non-consumable/consumable, intro-aanbiedingen uit, prijzen).
- **16 okt: iOS-jaarabonnement `vibezcore_audio_yearly` per ongeluk verwijderd in App Store Connect.** Een verwijderde ID kan Apple nooit opnieuw gebruiken. Daarom komt er een nieuw abonnement `vibezcore_premium_yearly` (1 jaar, €69,99).
  - **Code:** op iOS is de jaar-ID `vibezcore_premium_yearly`; Android blijft `vibezcore_audio_yearly` (iap-contract.ts `PRODUCT_IDS` per platform).
  - **RevenueCat:** het nieuwe iOS-product toevoegen, koppelen aan het entitlement VIBEZCORE Pro en in offering default bij Yearly (App Store) zetten.
- **Stores klaar (16 okt):**
  - **App Store Connect:**
    - groep "VIBEZCORE Premium";
    - maand `vibezcore_audio_monthly` €9,99, "VIBEZCORE Premium Monthly";
    - jaar `vibezcore_premium_yearly` €69,99 (VS $59,99), "VIBEZCORE Premium Yearly", Family Sharing aan;
    - dagpas `vibezcore_day_pass` (consumable) €1,29, "VIBEZCORE Day Pass";
    - geen intro-aanbiedingen;
    - alles staat op "Prepare for Submission" en gaat mee met de nieuwe app-versie.
  - **RevenueCat:**
    - offering `default` = `day_pass` / `$rc_monthly` / `$rc_annual`, met per pakket een Play- en een App Store-product;
    - Pro = maand en jaar op beide stores (dagpas NIET gekoppeld);
    - het oude App Store-product `vibezcore_audio_yearly` is verwijderd.
  - Status "Could not check" bij de App Store-producten = er staat nog geen App Store Connect API-sleutel in RevenueCat (optioneel, later).
- **Later (operator):**
  - aanmelden voor het App Store Small Business Program (15% i.p.v. 30%);
  - de namen van de Google Play-abonnementen wijzigen naar "VIBEZCORE Premium — Monthly/Yearly" en de dagpas-beschrijving gelijk zetten met Apple ("Breathwork, State Control & Audio Library for 24 hours").

