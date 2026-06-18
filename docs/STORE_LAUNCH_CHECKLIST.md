# VIBEZCORE — Store Launch Checklist

> **Status:** opgesteld 2026-06-04 (iter 9dq v128+)
> **Scope:** end-to-end pad van code → Apple App Store + Google Play Store productie.
> Per-rij status: ✅ klaar · ⏳ in voorbereiding · ❌ TODO (operator) · 🤖 TODO (claude)

---

## 1. Code-status

| # | Item | Status | Locatie |
|---|---|---|---|
| 1.1 | Bundle ID iOS | ✅ `com.ubili.vibezcoreapp` | app.json |
| 1.2 | Package Android | ✅ `com.ubili.vibezcoreapp` | app.json |
| 1.3 | IAP product IDs | ✅ `…audio.monthly` + `…audio.yearly` | src/services/iap-contract.ts |
| 1.4 | App naam | ✅ `VIBEZCORE` | app.json |
| 1.5 | Version | ✅ `1.0.0` | app.json |
| 1.6 | App scheme | ✅ `vibezcoreapp` | app.json |
| 1.7 | Privacy Manifest iOS | ✅ NSPrivacy* incl. email/userID/usage | app.json |
| 1.8 | Encryption flag | ✅ `ITSAppUsesNonExemptEncryption: false` | app.json |
| 1.9 | react-native-iap geïnstalleerd | ✅ v15.3.1 + config plugin | package.json |
| 1.10 | RealIAPProvider geactiveerd | ✅ v15 API wired | src/services/iap-real.ts |
| 1.11 | Restore Purchases | ✅ Apple Review Guideline 3.1.1 | src/services/restore-purchases.ts |
| 1.12 | Manage Subscription deep-links | ✅ iOS itms-apps:// + Play Console | src/services/subscription-actions.ts |
| 1.13 | EAS production-profile | ✅ buildType, channel, resourceClass | eas.json |
| 1.14 | EAS submit-profile templates | ⏳ TODO_-placeholders | eas.json |

## 2. Assets — operator-input nodig

| # | Item | Required size | Huidige size | Status |
|---|---|---|---|---|
| 2.1 | App icoon iOS hi-res | 1024×1024 | **180×180** ❌ | ❌ TODO operator |
| 2.2 | App icoon Android adaptive (fg) | 432×432 (foreground) | 512×512 ✅ | ✅ |
| 2.3 | App icoon Android adaptive (bg) | 432×432 | 512×512 ✅ | ✅ |
| 2.4 | App icoon Android monochrome | 432×432 | 432×432 ✅ | ✅ |
| 2.5 | Splash screen icoon | minimaal 200×200 | 228×213 (Expo placeholder!) | ❌ TODO operator |
| 2.6 | iOS-screenshots 6.7" | 1290×2796 (3+ scrshots) | — | ❌ TODO operator |
| 2.7 | iOS-screenshots 6.5" | 1242×2688 (3+ scrshots) | — | ❌ TODO operator |
| 2.8 | Android-screenshots phone | min 2 (1080×1920+) | — | ❌ TODO operator |
| 2.9 | Android-feature-graphic | 1024×500 | — | ❌ TODO operator |

**Aanmaak-tip voor iOS-screenshots:** Apple's snelste pad = simulator-screenshots via Xcode. Geen Mac → gebruik **EAS Cloud + screenshot-tool** of doe het op telefoon en upscale.

## 3. Store-listing copy — operator-input nodig

Per CLAUDE.md §1 vult Claude geen [OPERATOR]-teksten in. Hieronder template:

```
APPLE APP STORE CONNECT — Information

App Name (max 30 chars):                  [OPERATOR — bv. "VIBEZCORE"]
Subtitle (max 30 chars):                  [OPERATOR — bv. "State control, real audio"]
Promotional Text (max 170 chars):         [OPERATOR]
Description (max 4000 chars):             [OPERATOR — minstens 1 alinea]
Keywords (comma-separated, max 100):      [OPERATOR — bv. focus,calm,resilience,mindset,…]
Support URL:                              https://www.vibezcore.com/support
Marketing URL:                            https://www.vibezcore.com
Privacy Policy URL:                       https://www.vibezcore.com/legal/privacy
Copyright:                                © 2026 VIBEZCORE

Age Rating:                               4+ (geen objectionable content)
Category Primary:                         Health & Fitness  (operator-keuze)
Category Secondary:                       Lifestyle         (operator-keuze)

In-App Purchase Display Names:
  com.ubili.vibezcoreapp.audio.monthly:   [OPERATOR — bv. "Audio PRO Monthly"]
  com.ubili.vibezcoreapp.audio.yearly:    [OPERATOR — bv. "Audio PRO Yearly"]

In-App Purchase Descriptions:
  monthly:                                [OPERATOR — €9,99/maand · alle sessies]
  yearly:                                 [OPERATOR — €69,00/jaar (€5,75/m) · alle sessies]

PRICING — Custom per territory (operator-besluit 2026-06-15 v3):
  Kies bij subscription pricing → "Custom pricing per country/region"
  i.p.v. "Apple's automatic conversion". Reden: max revenue per markt.

  Monthly subscription (com.ubili.vibezcoreapp.audio.monthly):
    🇪🇺 Eurozone (NL/BE/DE/FR/IT/ES/IE/AT/PT/FI/etc.):      €9,99
    🇺🇸 United States:                                       $11.99
    🇬🇧 United Kingdom:                                      £8.99
    Andere markten:                                          Apple PPP-conversie van EUR base

  Yearly subscription (com.ubili.vibezcoreapp.audio.yearly):
    🇪🇺 Eurozone:                                            €69,00  (= €5,75/m · SAVE 42%)
    🇺🇸 United States:                                       $69.99  (= $5.83/m · SAVE 51%)
    🇬🇧 United Kingdom:                                      £59.99  (= £5.00/m · SAVE 44%)
    Andere markten:                                          Apple PPP-conversie van EUR base
```

```
GOOGLE PLAY CONSOLE — Store Listing

App Name (max 30):                        [OPERATOR — bv. "VIBEZCORE"]
Short Description (max 80):               [OPERATOR — 1 zin]
Full Description (max 4000):              [OPERATOR — gestructureerde tekst met bullets]
Category:                                 Health & Fitness  (operator-keuze)
Content Rating questionnaire:             [OPERATOR — invullen na app-aanmaak in Play Console]

In-App Subscription Products:
  com.ubili.vibezcoreapp.audio.monthly
    Name:                                 [OPERATOR]
    Description:                          [OPERATOR]
    Base plan:                            "audio-monthly" — Monthly, auto-renewing
    Pricing — Regional pricing per country (operator-besluit 2026-06-15 v3):
      🇪🇺 Eurozone:                       €9,99 / maand
      🇺🇸 United States:                  $11.99 / month
      🇬🇧 United Kingdom:                 £8.99 / month
      Andere markten:                     Google auto-convert van EUR base

  com.ubili.vibezcoreapp.audio.yearly
    Name:                                 [OPERATOR]
    Description:                          [OPERATOR]
    Base plan:                            "audio-yearly" — Yearly, auto-renewing
    Pricing — Regional pricing per country:
      🇪🇺 Eurozone:                       €69,00 / jaar  (€5,75/m · SAVE 42%)
      🇺🇸 United States:                  $69.99 / year  ($5.83/m · SAVE 51%)
      🇬🇧 United Kingdom:                 £59.99 / year  (£5.00/m · SAVE 44%)
      Andere markten:                     Google auto-convert van EUR base
```

```
WEBSITE — Currency auto-detect (operator-besluit 2026-06-15 v3)

Implementatie: alle pricing-elementen op de website hebben nu
data-eur / data-usd / data-gbp attributen. Een klein script op elke
pagina kiest het juiste attribuut op basis van Intl.DateTimeFormat
timezone (Europe/London → GBP, Europe/* → EUR, America/* → USD, rest → USD).

Manuele EUR/USD toggle (.cur-toggle) wordt verborgen met display:none —
geen "compare-and-feel-cheated" risico voor US users.

Bijgewerkte pages (kopiëren naar Wix):
  - assets/website-content/_homepage-NIEUW/audio-library-page.html
  - assets/website-content/_homepage-NIEUW/home-system-cards.html
  - assets/website-content/_homepage-NIEUW/home-app-strip.html
  - assets/website-content/app-page.html
  - assets/website-content/kickstarter-page.html       ← USD-only voor bracelet (zie KS-sectie)
  - assets/website-content/shop-bundle-bracelet-compact.html
```

```
KICKSTARTER CAMPAGNE — Pricing & Currency (operator-besluit 2026-06-15 v3)

Primary currency:                         USD
Reden:                                    70%+ van hardware-Kickstarter backers
                                          is US-based. Kickstarter ondersteunt
                                          maar één primary currency per
                                          campagne (geen multi-currency display).
                                          EU/UK backers zien USD en betalen
                                          via bank-conversie (~3% fee).

Tier pricing (early bird → standard → retail):
  Bracelet Early Bird:                    $169   (save $130 vs retail)
  Bracelet Standard:                      $199   (save $100 vs retail)
  Bracelet Retail (post-KS reference):    $299
  Bundle Early Bird (Bracelet + 1yr Audio + beads):  $215   (save $184 vs retail)
  Bundle Standard:                        $249
  Bundle Retail (post-KS reference):      $399

Bundle composition (worth-breakdown @ retail):
  Bracelet:                               $299
  1-year Audio Library access:            $69.99 (matcht App Store yearly price)
  Interchangeable bead set:               $32
  Totaal retail waarde:                   $400.99 → $399 afgerond

Iter 9dq v175 (operator-audit 2026-06-18): pricing-mismatch tussen
app (was $415/$200) en website (al $399/$184) opgelost. Site is
single source of truth voor pricing-numbers.

Belastingafdracht (België):
  Kickstarter betaalt uit via Stripe in EUR op je KBO-bankrekening.
  Stripe converteert USD → EUR aan spot rate, fee ~1.5%.
  BTW-afdracht via je boekhouder na campaign-end.

Website-implementatie:
  De kickstarter-page.html toont bracelet/bundle ALTIJD in USD (override
  van de auto-detect script via PR.USD-force in setCur). Audio-pricing op
  diezelfde page gebruikt nog wel auto-detect (EU/UK users zien EUR/GBP
  voor de audio FAQ) want audio gaat via App Store met regio-pricing.

Post-Kickstarter (Stripe-shop fase):
  Na KS-delivery transitioneer je naar je eigen Stripe-shop. Daar zet je
  WEL regional pricing per markt:
    Bracelet retail:   EU €279 · US $299 · UK £239
    Bundle retail:     EU €378 · US $399 · UK £324
  De shop-pages (home-system-cards.html, shop-bundle-bracelet-compact.html)
  blijven auto-detect — geen verandering nodig na KS-end.
```

## 4. Externe acties — operator

| # | Stap | Doorlooptijd | Kosten |
|---|---|---|---|
| 4.1 | Apple Developer Program enrollment | 24-72u, soms 2w | $99/jaar |
| 4.2 | Google Play Console enrollment | 24-48u | $25 eenmalig |
| 4.3 | EAS account aanmaken | onmiddellijk | gratis |
| 4.4 | App Store Connect: nieuwe app aanmaken | direct na Apple-approval | — |
| 4.5 | Google Play Console: nieuwe app aanmaken | direct na Play-approval | — |
| 4.6 | Apple sandbox tester accounts (3-5×) | direct in App Store Connect | gratis |
| 4.7 | Google internal testing track + tester-emails | direct in Play Console | gratis |
| 4.8 | Apple banking + tax (US W-8BEN voor non-US) | 1-3 dagen | — |
| 4.9 | Google merchant + bank | 1-3 dagen | — |

## 5. EAS-build pijplijn

**5.1 Eerste login:**
```bash
npx eas-cli login
# of: cd vibezcore-app && eas login
```

**5.2 Project linken:**
```bash
eas init --id 8c47743c-4586-4790-91b5-a1a6508b8e7a
```

**5.3 Credentials genereren:**
```bash
# iOS — EAS regelt cert + provisioning profile in de cloud
eas credentials --platform ios

# Android — EAS regelt keystore in de cloud
eas credentials --platform android
```

**5.4 Eerste productie-build:**
```bash
# iOS — naar TestFlight (interne tester eerst)
eas build --platform ios --profile production

# Android — App Bundle
eas build --platform android --profile production
```

**5.5 Submit:**
```bash
# iOS naar App Store Connect (TestFlight)
eas submit --platform ios --profile production

# Android naar Play Console (internal track)
eas submit --platform android --profile production
```

## 6. Backend-vereisten

| # | Item | Status | Owner |
|---|---|---|---|
| 6.1 | `/api/iap-verify` (Apple receipt-validatie) | ❌ TODO | backend-dev |
| 6.2 | `/api/iap-verify` (Google Play purchase token verify) | ❌ TODO | backend-dev |
| 6.3 | StoreKit Server Notifications endpoint (renew/cancel webhooks) | ❌ TODO | backend-dev |
| 6.4 | Google Play Real-time Developer Notifications | ❌ TODO | backend-dev |
| 6.5 | `/api/subscription-status` returneert `has_bracelet_activated` | ❌ TODO | backend-dev |
| 6.6 | `/api/bracelet/activate` endpoint | ❌ TODO | backend-dev |

Zie ook: `src/services/bracelet-activation.ts` en `src/utils/dev-user-override.ts` voor inline backend-specs.

## 7. Pre-launch testing-checklist

- [ ] Sandbox-purchase iOS: maandelijks abo
- [ ] Sandbox-purchase iOS: yearly abo
- [ ] Sandbox-cancel iOS via Apple ID → terug naar Free
- [ ] Restore Purchases na app-reinstall (Apple Review 3.1.1)
- [ ] Google Internal Test purchase: maandelijks
- [ ] Google Internal Test purchase: yearly
- [ ] Google subscription manage via Play Store
- [ ] Bracelet-activation flow (na backend endpoint live)
- [ ] Cold-start performance < 3s naar interactieve UI
- [ ] Offline gedrag (no-network scherm)
- [ ] Sign-up + sign-in via Supabase auth proxy
- [ ] All accessibility labels intact

## 8. Apple-specific compliance

| # | Guideline | Status |
|---|---|---|
| 3.1.1 | Restore Purchases knop | ✅ Settings → "Restore purchases" |
| 3.1.1 | Manage Subscription deep-link | ✅ Account → "Manage subscription" |
| 3.1.2 | Sub price + duration visible vóór koop | ✅ subscribe.tsx |
| 3.1.2 | Auto-renew + cancel disclosure | ✅ subscribe.tsx legal-section |
| 5.1.1 | Privacy disclosure | ✅ /legal/privacy + onboarding |
| 5.1.5 | App tracking transparency | ✅ niet van toepassing (geen tracking) |
| 4.8 | Sign in with Apple (indien third-party sign-in geboden) | ⚠️ TODO indien Apple-review eist |

---

**Volgende stap voor operator:**
1. Start Apple + Google enrollments (4.1 + 4.2 + 4.3)
2. Leverer 1024×1024 VIBEZCORE icoon (2.1) + VIBEZCORE splash-icon (2.5)
3. Vul store-listing copy (§3) — kan parallel met enrollments

**Volgende stap voor Claude (na operator-input):**
- EAS-login + project-link (5.1, 5.2)
- Credentials genereren (5.3)
- Eerste production-build (5.4)
