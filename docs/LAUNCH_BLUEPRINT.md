# VIBEZCORE — Lanceringsblauwdruk iPhone + Android (A tot Z)

> Levend document (gestart 18 okt 2026). Alles wat nodig is om de app op
> beide platforms 100% werkend in te dienen en **meteen na goedkeuring live**
> te zetten. Per stap: wie (ik = Claude, jij = operator) en de status.
> Geheimen (wachtwoorden, .p8-bestanden, service keys) staan NOOIT hier of in
> git — enkel waar ze bewaard worden.
>
> Status: ✅ klaar · ⏳ bezig/te doen · ⛔ blokkeert indiening

---

## 0. Vaste gegevens (geen geheimen)

| Wat | Waarde |
|---|---|
| App | VIBEZCORE, bundle/package `com.ubili.vibezcoreapp` |
| App Store Connect app-ID | 6791124857 |
| Apple Team ID | 88AL3UW7L7 (Individual, Ulgar Bilican) |
| Sign in with Apple-sleutel | "VIBEZCORE Sign in with Apple", **Key ID 3VS353U3RM** (18 okt 2026). Het .p8-bestand: privé bewaren (OneDrive-sleutelmap), enkel als Netlify-variabele `APPLE_SIWA_PRIVATE_KEY` |
| Backend | `vibezcore-backend` (GitHub) → Netlify, auto-deploy bij push naar `main`, `https://app.vibezcore.com/api/*` |
| Supabase | project `zotxpyjvcamnlzwdgceh` |
| Accountpagina (reset/bevestiging) | `https://account.vibezcore.com/auth.html` |
| Aankopen (beide stores) | maand `€9,99`, jaar `€69,99`, dagpas `€1,29` (24 u, geen abonnement); iOS-jaar-ID `vibezcore_premium_yearly`; RevenueCat-entitlement "VIBEZCORE Pro" |
| Leeftijd | 13+ (onder 18 met toestemming ouder) |

---

## A. iPhone (App Store)

### A1. App klaar en getest
| # | Stap | Wie | Status |
|---|---|---|---|
| A1.1 | Builds 24–28 op TestFlight (haptics, BeatEngine, lockscreen, stem v4, onboarding, accountflow) | ik | ✅ |
| A1.2 | Build 28 testen met het accountscript (zie §D) + onboarding-haptics + State Control + vergrendelen | jij | ⏳ |
| A1.3 | Reden ontbrekende lockscreen-kaart uit crashrapporten (Sentry) halen en definitief oplossen | ik | ⏳ |
| A1.4 | Apple Watch-app: testen op echte watch, of uit versie 1.0 halen | jij beslist | ⏳ |
| A1.5 | Laatste build (29) met alle fixes + Apple-login-code → TestFlight → hertest → kandidaat | ik + jij | ⏳ |

### A2. Sign in with Apple intrekken bij account verwijderen (regel 5.1.1(v))
| # | Stap | Wie | Status |
|---|---|---|---|
| A2.1 | Backend: code inruilen + bewaren (auth-proxy), intrekken bij verwijderen (delete-account), `netlify/lib/apple-siwa.js` | ik | ✅ live (inactief tot A2.4) |
| A2.2 | App stuurt `authorizationCode` mee | ik | ✅ code (in build 29) |
| A2.3 | Apple-sleutel aanmaken (Keys → + → Sign in with Apple → VIBEZCORE) | jij | ✅ Key ID 3VS353U3RM |
| A2.4 | Netlify → Site configuration → Environment variables → `APPLE_SIWA_PRIVATE_KEY` (secret, enkel Production) → Deploys → Trigger deploy | jij | ✅ 18 okt |
| A2.5 | Supabase → SQL Editor → `supabase/migrations/20261018000001_apple_tokens.sql` uitvoeren | jij | ✅ 18 okt |
| A2.6 | Test: Apple-login → account verwijderen → Apple ID-instellingen → "Inloggen met Apple": VIBEZCORE is weg | jij | ⏳ |

### A3. App Store Connect (afwijzing 17 juli opgevolgd)
| # | Punt | Actie | Status |
|---|---|---|---|
| A3.1 | 1.5 | App Information → Support URL `https://www.vibezcore.com/support` | ⏳ |
| A3.2 | 2.1(b) | Bij de versie: maand, jaar en dagpas aanvinken bij "In-App Purchases and Subscriptions" | ⏳ |
| A3.3 | 2.3.10 | Nieuwe iPhone-screenshots (6,9" en 6,5"), geen Google Play | ⏳ |
| A3.4 | 3.1.2 | Beschrijving met abonnementsinfo + links Terms/Privacy (tekst: ik) | ⏳ |
| A3.5 | 4 / 2.1(a) | Native Apple-knop + werkende Apple-login | ✅ in app |
| A3.6 | 5.1.1(v) | Kopen zonder account | ✅ in app |
| A3.7 | — | Leeftijdsclassificatie 9+ → **13+** | ⏳ |
| A3.8 | — | App-privacy: gezondheid (hartslag, enkel op toestel), crashrapporten, aankopen, e-mail | ⏳ |
| A3.9 | — | App Review-informatie: nieuwe notes + screenshot huidige betaalmuur (tekst: ik) | ⏳ |
| A3.10 | — | Exportcompliance: geen eigen versleuteling | ⏳ |
| A3.11 | — | Versie-release: **"Automatisch vrijgeven na goedkeuring"** | ⏳ |
| A3.12 | — | Build 29 koppelen → Add for Review → Submit | ⏳ |

---

## B. Android (Google Play)

| # | Stap | Wie | Status |
|---|---|---|---|
| B1 | Android-productiebuild (versionCode 100) met alle fixes sinds 99 + Wear OS-bundel | ik | ⏳ |
| B2 | Release-versie volledig testen op de A16 | ik | ⏳ |
| B3 | Play Console: .aab + Wear OS-bundel uploaden | jij | ⏳ |
| B4 | Gezondheidsgegevens-formulier, Gegevensveiligheid, leeftijd 13+ | jij (tekst: ik) | ⏳ |
| B5 | Store-screenshots huidige app | jij + ik | ⏳ |
| B6 | Release naar productie, **100%** uitrol | jij | ⏳ |

---

## C. Backend, Supabase, website

| # | Stap | Wie | Status |
|---|---|---|---|
| C1 | Veiligheid: delete-account + cancel-subscription controleren token bij Supabase (vals token → 401) | ik | ✅ live getest |
| C2 | Supabase → Authentication → URL Configuration → Site URL `https://account.vibezcore.com/auth.html` (+ redirect `https://account.vibezcore.com/**` en vibezcoreapp://-links) | jij | ✅ nagekeken 18 okt |
| C3 | Accountpagina: knoppen "Get the app" naar echte store-links (na lancering) | ik (websitewijziging, jouw OK) | ⏳ |
| C4 | RevenueCat: maand/jaar/dagpas in beide stores aan "VIBEZCORE Pro"/dagpas gekoppeld | ik controleer | ⏳ |
| C5 | Na lancering: website-badges, crashrapporten eerste dagen opvolgen | ik | ⏳ |

---

## D. Testscript account (per platform, met testaccount)

1. Create account (nieuwe e-mail, ≥ 8 tekens) → melding "Account created".
2. Uitloggen → inloggen met fout wachtwoord → "Email or password is incorrect."
3. Inloggen met juist wachtwoord → ingelogd.
4. Uitloggen → Forgot password → e-mail → link → nieuw wachtwoord → inloggen.
5. Premium kopen (sandbox/testkaart) → uit- en inloggen → Premium blijft; Restore Purchases werkt.
6. Kopen zonder account → daarna account maken → Premium blijft.
7. Continue with Apple (iPhone) / Google (Android) → ingelogd.
8. Account verwijderen → twee bevestigingen → welkomstscherm; (Apple) VIBEZCORE verdwijnt uit "Inloggen met Apple".

## E. Sandbox-aankopen (iPhone, TestFlight)

- Aankopen in TestFlight zijn gratis ("[Environment: Sandbox]").
- Versneld: maand verlengt elke 5 min, jaar elk uur (max. 12 keer).
- Opzeggen: Instellingen → App Store → Sandbox-account → Beheer.
- Opnieuw als nieuwe klant: opzeggen + app verwijderen; geschiedenis wissen in App Store Connect → Gebruikers en toegang → Sandbox → Testers → Clear Purchase History.

---

## F. Logboek

- 18 okt 2026: blauwdruk gestart; C1 live; A2.1–A2.5 klaar (sleutel in Netlify, tabel apple_tokens, backend live); C2 nagekeken; builds 24–28 op TestFlight; build 29 gestart.
- Sleutels (privé, OneDrive "VIBEZCORE Apple Sign in sleutel"): `AuthKey_3VS353U3RM.p8` (Sign in with Apple → Netlify) en `Apple SubscriptionKey_YA2FB7JR7D.p8` (In-App Purchase → RevenueCat).
