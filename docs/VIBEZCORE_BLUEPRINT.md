# VIBEZCORE — Complete Blueprint

> A-tot-Z technical blueprint van het VIBEZCORE-platform: native app, backend, webapp, infrastructuur, datacontracten en operationele procedures. Geschreven zodat een onbekende developer of operator dit document kan oppakken en het volledige systeem identiek kan herbouwen, exploiteren en debuggen zonder verdere context.
>
> Versie: 2026-05-20 · Status: living document, blijft synchroon lopen met de codebase.

> **Recente iteraties (2026-05, samengevat — details onderaan in Bijlage C):**
> - Audio Library-tab consolidatie: search-bar met Spotify-stijl autocomplete (Series / Sessions / Inspirators), New/Favorites/Free-nav-knoppen, Your Journey-card.
> - Sub-pagina's onder `/library/` (`new`, `favorites`, `free`) — platte sessie-lijsten.
> - Coming-page `/coming` als 13e "card" in de library + fullscreen sub-scherm met 15 Existing Series + 8 New Series (roadmap, pulsende dots, accordion).
> - Aankoopblok refactor: Spotify-stijl hiërarchie op de prijskaarten, dynamisch CTA-label, `WebBrowser`-primair met `Linking`-fallback voor Gumroad-checkout, in-app Privacy/Terms-links + verplichte subscription-info-visibility voor Apple Guideline 3.1.2(c).
> - `useFavorites`-schema v2 (`vzf_v1` → per-user bucketed `vzf_{bucket}_v1`, `Map<url, FavEntry>` met title+series+ts).
> - `isNew`-utility: NEW_DAYS 14 → **30** dagen.
> - Player Back-knop fix via `SafeAreaView` + `closePlayer`-fallback (`router.canGoBack() ? back() : navigate('/')`).
> - Welcome-scherm herzien (Apple-stijl: accent-streep, "Stop Drifting. / Start Directing.").
> - Font-inheritance via `Text.defaultProps` op `Inter` in root `_layout.tsx`.
> - Hero-, BUILT ON- en EXPLORE SERIES-headers herzien naar Apple-stijl typografie.
> - Roadmap-card als 13e card in library-list.
> - FOLLOW-pill op serie-cards verwijderd (Favorites blijft als enige gebruikers-collectie); ❤️-knop op elke sessie-rij.
> - Sessions data: 9 Daily Affirmations sessies teruggezet naar `added:''` (launch-batch is niet "nieuw").

---

## Deel 0 — Executive Summary

VIBEZCORE is een twee-zijdig persoonlijke-ontwikkeling-platform met twee gelijkwaardige productkernen:

1. **Audio Library** — gestructureerde psychologische audio-sessies (≈70 sessies, georganiseerd in 4 pijlers), streaming vanaf Bunny CDN, in-app via React-Native + expo-audio. Monetisatie: in-app purchase via Apple StoreKit / Google Play Billing (audio-only abonnement: maandelijks of jaarlijks).
2. **Smart Bead Bracelet** — fysiek haptisch wearable-product (nRF52832 BLE-microcontroller + DRV2605L haptic driver, 5 modi: Boost / Sharp Focus / Calm Control / Clarity / Rest & Reset). Bedient zich autonoom op hardware-timers, koppelt via BLE met de app voor start/stop en status. Verkoop: Kickstarter-launch Fall 2026, daarna directe verkoop via Stripe of bundle met audio-jaarsub.

Er zijn drie code-artefacten:

- **Native app** (deze repo, `vibezcore-app`) — Expo SDK 55, React Native 0.83, TypeScript, Expo Router. Cross-platform iOS + Android. **Niet Expo Go**: gebruikt dev-build met native modules (`expo-audio`, `react-native-iap`, in toekomst `react-native-ble-plx`).
- **Backend** (`vibezcore-backend` — separate repo) — Netlify Functions, pure Node.js (geen npm-deps per functie), gehost op Netlify. URL: `https://app.vibezcore.com/api/*`.
- **Webapp** (`vibezcore-website` — separate repo, ook bestaand) — statische HTML + JS, Bunny CDN voor assets, Wix domein-DNS. Op pad naar uitfasering, maar wordt nog gebruikt voor publieke marketing en legal-pagina's.

De **scheiding van zorgen** is hard:

| Concern | Wie | Hoe |
|---|---|---|
| User-state (entitlements, sub, history) | Supabase (Postgres + Auth) | App via service-role endpoints |
| Audio-content | Bunny CDN | Signed URLs via `/api/audio-url` |
| Payment (Audio) | Apple / Google IAP | App roept `/api/iap-verify` |
| Payment (Bracelet) | Stripe | Webhook naar backend, koppelt order aan account |
| Email | Zoho Mail (SMTP) | Backend `/api/support` + Supabase Auth templates |
| Domain | Wix DNS → Netlify | `app.vibezcore.com` → Netlify, `vibezcore.com` → Wix/site |

De **gouden regel**: de app praat NOOIT direct met Apple, Google, Stripe, of Bunny CDN voor business-logica. Altijd via de eigen backend. Dit isoleert provider-keuzes en houdt de app provider-agnostisch.

---

## Deel 1 — Tech Stack & External Services

### 1.1 Native app stack

| Laag | Tech | Versie | Reden |
|---|---|---|---|
| Runtime | React Native | 0.83.6 | Cross-platform, mature, mature TypeScript |
| Framework | Expo SDK | 55.0 | OTA-updates, EAS Build, dev-client |
| Routing | expo-router | 55.0 | File-based routing, deep-linking out-of-the-box |
| Taal | TypeScript | 5.9 | Type-safety, strict |
| State | React hooks + AsyncStorage | — | Geen Redux: app is grotendeels session-scoped |
| Auth | Supabase Auth + JWT | — | Single-source-of-truth voor accounts |
| Audio | expo-audio | 55.0.14 | Background playback, lock-screen, foreground-service Android |
| BLE | react-native-ble-plx (geplanned) | — | Wordt geactiveerd na hardware-fase; nu sim via `services/bracelet-sim.ts` |
| IAP | react-native-iap | 15.3 | Apple StoreKit + Google Play Billing unified API |
| Fonts | @expo-google-fonts/inter | 0.4 | Inter 400/500/600/700/800/900 |
| Iconen | lucide-react-native | 1.17 | Tree-shakable SVG icons |
| Animations | react-native-reanimated | 4.2 | Worklets, 60fps |
| Image | expo-image | 55.0 | Prefetch + memory cache |
| Storage | @react-native-async-storage/async-storage | 2.2 | Persisted favorites, last-played, settings |
| Linking | expo-linking | 55.0 | Deep links (`vibezcoreapp://`) |
| Gradient | expo-linear-gradient | 55.0 | Hero-CTA backgrounds |
| Glass | expo-glass-effect | 55.0 | iOS-stijl frosted modals |
| Safe area | react-native-safe-area-context | 5.6 | Notch / nav-bar |
| Screens | react-native-screens | 4.23 | Native navigation primitives |
| Worklets | react-native-worklets | 0.7 | UI-thread animaties |
| Speech (legacy) | expo-speech | 55.0.14 | Niet meer gebruikt — vervangen door pre-recorded audio (expo-audio) |
| Web compat | react-native-web | 0.21 | Niet productioneel — alleen voor `npm run web` debug |

Bundle-identifier (iOS) en package (Android): `com.ubili.vibezcoreapp`. Scheme: `vibezcoreapp://`.

### 1.2 Backend stack

| Laag | Tech | Reden |
|---|---|---|
| Hosting | Netlify Functions | Auto-deploy via Git, free-tier voldoende |
| Runtime | Node 18+ (Netlify default) | — |
| Bundler | esbuild | Geconfigureerd in `netlify.toml` |
| Database | Supabase (Postgres 15) | Auth + Row-Level-Security ingebouwd |
| Email | Zoho Mail (SMTP) | EU-jurisdictie, betaalbaar |
| Storage (audio) | Bunny CDN | $/GB voordelig, EU pop-in |

**Geen npm-deps per Netlify Function**, behalve `nodemailer` voor `support.js`. Alle externe calls gebeuren via de native `fetch` + `crypto` API's, zodat cold-starts snel blijven en de dependency-tree minimaal.

### 1.3 Externe services overzicht

| Service | Doel | Account-houder | Pricing |
|---|---|---|---|
| **Supabase** | Auth + Postgres + RLS | nexuscontacteren@gmail.com | Free tier (paid bij groei) |
| **Netlify** | Backend hosting (Functions + static) | nexuscontacteren@gmail.com | Free tier |
| **Bunny CDN** | Audio + image hosting | (zie OPERATOR_HANDOVER §10) | Pay-per-GB |
| **Apple Developer** | iOS App Store + StoreKit | (in aanvraag, juni 2026) | $99/jaar |
| **Google Play Console** | Android Play Store + Billing | (in aanvraag, juni 2026) | $25 eenmalig |
| **Zoho Mail** | Domain email + SMTP | nexuscontacteren@gmail.com | €1/mailbox/maand |
| **Wix** | DNS + marketing site (legacy) | nexuscontacteren@gmail.com | €/maand |
| **GitHub** | Source repos | ulgarbilican-dotcom | Free |
| **Stripe** | Bracelet betaling (post-KS) | (KBO vereist — BE) | 1.4% + €0.25 EU |
| **Async.com / ElevenLabs** | Breath voice cues (productie) | — | Pay-per-character |
| **Gumroad** | Audio sub (LEGACY — uitgefaseerd 2026-06-12) | nexuscontacteren@gmail.com | Niet meer actief |

**Burn-rate referentie**: zie `docs/OPERATOR_HANDOVER.md` §10-13 voor live cijfers. Niet hier dupliceren omdat het maandelijks shift.

### 1.4 Endpoints (production)

| Endpoint | Bestand | Doel |
|---|---|---|
| `POST /api/iap-verify` | `iap-verify.js` | Apple/Google receipt verificatie + sub upsert |
| `POST /api/iap-webhook` | `iap-webhook.js` | ASN V2 + Play RTDN lifecycle |
| `GET /api/subscription-status` | `subscription-status.js` | App reads current sub state |
| `POST /api/gumroad-webhook` | `gumroad-webhook.js` | LEGACY (no actieve subs meer) |
| `POST /api/cancel-subscription` | `cancel-subscription.js` | App roept aan voor self-service cancel |
| `GET /api/audio-url` | `audio-url.js` | Signed Bunny CDN URL per session |
| `GET /api/auth-proxy` | `auth-proxy.js` | Forwarder voor Supabase Auth endpoints |
| `POST /api/bracelet/sessions/sync` | `bracelet-sessions-sync.js` | Upload van bracelet-sessie historie |
| `POST /api/support` | `support.js` | In-app support form → Zoho SMTP |
| `POST /api/sync-subscriptions` | `sync-subscriptions.js` | Admin/cron sub-state reconciliation |

Alle endpoints zijn gemount onder `/api/*` via redirects in `netlify.toml`. Direct-call via `/.netlify/functions/*` werkt ook maar wordt niet door de app gebruikt.

---

## Deel 2 — Repository Layout

### 2.1 Top-level (vibezcore-app)

```
vibezcore-app/
├── CLAUDE.md                       Bindende projectregels (Claude leest dit auto)
├── README.md                       Korte intro
├── app.json                        Expo config (zie 2.2)
├── package.json                    Deps + scripts
├── tsconfig.json                   Strict TS config
├── eas.json                        EAS Build profiles (preview/production)
├── .gitignore                      .env, node_modules, .expo, eas-config-private
├── assets/                         Statische assets (zie 2.3)
├── docs/                           Documentatie + dit blueprint
├── src/
│   ├── app/                        Expo Router file-based routes
│   │   ├── _layout.tsx             Root Stack (auth-check + deep-link)
│   │   ├── welcome.tsx             Eerste scherm voor gasten
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx         Custom tab navigator (4 tabs)
│   │   │   ├── index.tsx           Audio Library
│   │   │   ├── breath.tsx          Breath protocols
│   │   │   ├── bracelet.tsx        Bracelet etalage + pairing entry
│   │   │   └── account.tsx         Profile + entitlements + settings entry
│   │   ├── player.tsx              Full-screen audio player (modal)
│   │   ├── bracelet-control.tsx    Active bracelet session
│   │   ├── bracelet-history.tsx    Sessie-historie
│   │   ├── breath-history.tsx      Your Practice (breath stats)
│   │   ├── subscribe.tsx           IAP-bridge (account+purchase)
│   │   ├── activate-bracelet.tsx   QR/code redemption
│   │   ├── settings.tsx            Playback/Privacy/About
│   │   ├── about.tsx               Brand story
│   │   ├── faq.tsx                 FAQ scroll
│   │   ├── support.tsx             In-app contact form
│   │   ├── auth-callback.tsx       Deep-link landing (Supabase Auth)
│   │   ├── forgot-password.tsx     Reset request
│   │   ├── reset-password.tsx      Reset complete
│   │   ├── change-password.tsx     Logged-in password change
│   │   ├── coming.tsx              Coming-soon stub
│   │   ├── history.tsx             Audio history (gates per tier)
│   │   ├── library/                Sub-pages: favorites, free, new, all-pillars
│   │   └── legal/[doc].tsx         Dynamic legal/safety docs
│   ├── components/                 Shared UI (≈25 components)
│   ├── constants/                  theme.ts (Brand tokens)
│   ├── data/                       Static content (sessions, breath modes, FAQ, legal)
│   ├── hooks/                      useFavorites, useIAP, useSubscription, useTheme
│   ├── services/                   Logic singletons (audio-player, auth, ble, iap, ...)
│   ├── utils/                      Pure helpers (url-eq, openSession, history, ...)
│   └── global.css                  Web tailwind import (alleen voor `expo web`)
└── scripts/                        Build helpers
```

### 2.2 `app.json` (Expo config) — kerngegevens

```json
{
  "expo": {
    "name": "VIBEZCORE",
    "slug": "vibezcore-app",
    "version": "1.0.0",
    "scheme": "vibezcoreapp",
    "newArchEnabled": false,
    "ios": {
      "bundleIdentifier": "com.ubili.vibezcoreapp",
      "supportsTablet": false,
      "infoPlist": { "ITSAppUsesNonExemptEncryption": false },
      "privacyManifests": { /* zie Deel 14 voor volledige tree */ }
    },
    "android": {
      "package": "com.ubili.vibezcoreapp",
      "predictiveBackGestureEnabled": false,
      "adaptiveIcon": { /* … */ }
    },
    "plugins": [
      "expo-router",
      ["expo-splash-screen", { "backgroundColor": "#0a0a0a" }],
      "expo-font",
      ["expo-audio", {
        "microphonePermission": false,
        "recordAudioAndroid": false,
        "enableBackgroundPlayback": true,
        "enableBackgroundRecording": false
      }],
      "react-native-iap"
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": false
    },
    "extra": {
      "eas": { "projectId": "8c47743c-4586-4790-91b5-a1a6508b8e7a" }
    },
    "owner": "ubili"
  }
}
```

Kritieke flags:
- `newArchEnabled: false` — react-native nieuwe architectuur (Fabric/TurboModules) is uit. Sommige libs zoals `react-native-iap` ondersteunen 'm nog niet betrouwbaar in Expo SDK 55.
- `enableBackgroundPlayback: true` — audio blijft spelen onder lock-screen. Vereist op iOS audio-session config + op Android een foreground-service (door expo-audio auto-geregeld).
- `reactCompiler: false` — React Compiler (RN) bleek druk te zijn met tab-button-press detection; uit gezet.
- `scheme: "vibezcoreapp"` — deep-links arriveren op `vibezcoreapp://auth-callback?...`.

### 2.3 Assets

```
assets/
├── vibezcore_wordmark.png          Logo wordmark (zwart bg, schermkoppen)
├── vibezcore_icon.png              App-icoon
├── welcome_bg.png                  Welkomstscherm achtergrond (operator-aangeleverd)
├── images/
│   ├── splash-icon.png             Splash icon (76px)
│   ├── favicon.png                 Web favicon
│   ├── android-icon-foreground.png Adaptive icon layers
│   ├── android-icon-background.png
│   └── android-icon-monochrome.png
└── website-content/                LOSGEKOPPELDE webapp-mirror (HTML, voor sync)
    └── _homepage-NIEUW/            Live webapp HTML
```

Audio en de meeste foto's wonen op Bunny CDN (`https://vibezcore-audio.b-cdn.net/`) en zitten NIET in de app-bundle. Reden: 70 sessies à 50MB = 3.5 GB. Te groot voor App Store.

### 2.4 Backend repo (`vibezcore-backend`)

```
vibezcore-backend/
├── netlify.toml                    Redirects + functions config
├── package.json                    Alleen nodemailer
├── public/                         Static fallback (404 page)
└── netlify/functions/
    ├── audio-url.js
    ├── auth-proxy.js
    ├── bracelet-sessions-sync.js
    ├── cancel-subscription.js
    ├── gumroad-webhook.js          LEGACY
    ├── iap-verify.js
    ├── iap-webhook.js
    ├── subscription-status.js
    ├── support.js
    └── sync-subscriptions.js
```

Geen shared `_lib/` — elk endpoint is self-contained voor cold-start performance. Duplicatie (vooral Google Play Dev API helpers) wordt geaccepteerd; bij groei extracten naar `_lib/google-iap.js` (functies beginnend met `_` worden door Netlify niet als endpoint deployed).

---

## Deel 3 — Environment Variables

### 3.1 App (.env / app.json `extra`)

De app heeft GEEN `.env`. Alle config is hard-coded of komt via `expo-constants` uit `app.json`. Reden: een client-bundle kan geen secrets bevatten — alles wat erin staat is leesbaar voor wie de IPA/APK opent.

Wel hard-coded in de code:

| Variable | Locatie | Waarde |
|---|---|---|
| `SUPABASE_URL` | `src/services/auth.ts` | `https://zotxpyjvcamnlzwdgceh.supabase.co` |
| `SUPABASE_ANON_KEY` | `src/services/auth.ts` | Public key — okay om in bundle |
| `BACKEND_URL` | `src/utils/api.ts` | `https://app.vibezcore.com/api` |
| `BUNNY_CDN_BASE` | `src/utils/audio-url.ts` | `https://vibezcore-audio.b-cdn.net` |
| `IAP_PRODUCT_IDS` | `src/services/iap-contract.ts` | `['vibezcore_audio_monthly', 'vibezcore_audio_yearly']` |
| `BLE_SERVICE_UUID` | `src/services/ble-contract.ts` | (zie BLE-spec v2.3 §8) |
| `USE_SIMULATED_BLE` | `src/services/bracelet.ts` | `true` zolang er geen firmware is |

### 3.2 Backend (Netlify env vars)

Te zetten in Netlify dashboard → Site settings → Environment variables:

| Variable | Verplicht? | Waarde / herkomst |
|---|---|---|
| `SUPABASE_URL` | ja | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ja | Supabase service-role secret (NIET anon) |
| `BUNNY_CDN_PULL_ZONE` | ja | Bunny CDN pull-zone hostname |
| `BUNNY_TOKEN_AUTH_KEY` | ja | Bunny CDN signing key |
| `APPLE_SHARED_SECRET` | ja (na Apple-goedkeuring) | App Store Connect → app → App-Specific Shared Secret |
| `APPLE_BUNDLE_ID` | optional | Default `com.ubili.vibezcoreapp` |
| `GOOGLE_PACKAGE_NAME` | optional | Default `com.ubili.vibezcoreapp` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ja (na Google-goedkeuring) | Volledige JSON van Google Cloud service-account |
| `ZOHO_SMTP_USER` | ja | `info@vibezcore.com` |
| `ZOHO_SMTP_PASS` | ja | Zoho Mail app-password (NIET account-password) |
| `GUMROAD_SELLER_ID` | optional | Voor LEGACY webhook signature-check |
| `STRIPE_SECRET_KEY` | toekomst | Voor bracelet-checkout (post-KS) |
| `STRIPE_WEBHOOK_SECRET` | toekomst | Stripe webhook verificatie |

Zet zowel op `Production` als `Deploy Previews` als je wil dat preview-deploys ook werken.

### 3.3 Supabase (Auth + RLS)

In Supabase dashboard → Authentication → URL Configuration:

| Setting | Waarde |
|---|---|
| Site URL | `https://app.vibezcore.com` |
| Redirect URLs (whitelist) | `vibezcoreapp://auth-callback`, `https://app.vibezcore.com/auth-callback`, `https://vibezcore.com/auth-callback.html` |
| Email templates | Custom-stijl (operator-bewerkt — zie `docs/OPERATOR_HANDOVER.md` voor exacte HTML) |

---

## Deel 4 — Frontend Architecture

### 4.1 Routing tree (Expo Router)

Expo Router is file-based: elke `.tsx` in `src/app/` is automatisch een route. De `_layout.tsx` in een map definieert de navigator voor dat segment.

```
/                       → (tabs)/index.tsx          (Audio Library)
/breath                 → (tabs)/breath.tsx
/bracelet               → (tabs)/bracelet.tsx
/account                → (tabs)/account.tsx
/welcome                → app/welcome.tsx
/player                 → app/player.tsx              (modal presentation)
/bracelet-control       → app/bracelet-control.tsx    (push from /bracelet)
/bracelet-history       → app/bracelet-history.tsx
/breath-history         → app/breath-history.tsx
/subscribe              → app/subscribe.tsx           (push from gated tap)
/activate-bracelet      → app/activate-bracelet.tsx
/settings               → app/settings.tsx
/about                  → app/about.tsx
/faq                    → app/faq.tsx
/support                → app/support.tsx
/auth-callback          → app/auth-callback.tsx       (deep-link target)
/forgot-password        → app/forgot-password.tsx
/reset-password         → app/reset-password.tsx      (deep-link target)
/change-password        → app/change-password.tsx
/coming                 → app/coming.tsx
/history                → app/history.tsx
/library/favorites      → app/library/favorites.tsx
/library/free           → app/library/free.tsx
/library/new            → app/library/new.tsx
/library/all-pillars    → app/library/all-pillars.tsx (or similar)
/legal/[doc]            → app/legal/[doc].tsx         (dynamic: terms, privacy, refund, …)
```

### 4.2 Bootstrap flow (`_layout.tsx`)

Bij cold-start gebeurt het volgende in `src/app/_layout.tsx`:

1. **Splash screen blokkeer** (`SplashScreen.preventAutoHideAsync()`).
2. **Inter font load** via `@expo-google-fonts/inter` (alle 6 gewichten).
3. **Auth check** (`getToken()` uit `services/auth.ts`) — leest AsyncStorage voor `vibezcore:auth-token`.
4. **Deep-link check** — als de app via `vibezcoreapp://auth-callback?...` werd geopend, slaan we de welcome-redirect over.
5. **Dev-override check** — `getDevUserOverride()` leest een AsyncStorage-flag (`'guest' | 'audio' | 'bracelet' | 'pro'`) zodat tester verschillende user-states kan simuleren zonder echte login.
6. **Bracelet-photo prefetch** — 5 Bunny URLs worden via `Image.prefetch()` warm-gekauwd voor smooth navigatie naar de Bracelet-tab.
7. **Welcome redirect** — als user niet ingelogd is EN geen deep-link wacht: `router.replace('/welcome')`.
8. **Splash hide** zodra fonts+auth+dev-override-cache klaar zijn.
9. **Deep-link handler** — `Linking.addEventListener('url', …)` routert auth-callback / reset-password / forgot-password.

Stack screens worden uitgebreid geregistreerd zodat elke route z'n header config heeft. Bovenop de Stack zitten 4 globale modals:

- `<BraceletUpsellModal />` — bracelet-upsell bij sessie-end
- `<AccountWallModal />` — verschijnt bij gated tap op account-tier sessie
- `<WelcomeBackPopup />` — last-played resume bij cold-start
- `<WelcomeBackWarrior />` — motivationele begroeting >12u na laatste open

### 4.3 Tab navigator (`(tabs)/_layout.tsx`)

4 tabs:

| Index | Bestand | Tab-label | Glyph |
|---|---|---|---|
| 0 | `index.tsx` | Audio Library | ♪ |
| 1 | `breath.tsx` | Breath | ○ |
| 2 | `bracelet.tsx` | Bracelet | ◎ |
| 3 | `account.tsx` | Account | ○ |

**Custom tabBarButton** (zie file-comment): default `PlatformPressable` ving onPress niet door — vermoedelijk RN 0.83 + react 19 + Reanimated 4 interactie. Vervangen door `Pressable` met directe `router.navigate(path)`.

**Tab-press-side-effect**: tap op `/` triggert `requestLibraryReset()` zodat bracelet-only users die in de free-library waren doorgeklikt, bij terugkeer eerst de korte bracelet-only landing zien.

`<MiniPlayer />` wordt naast de Tabs gemount (sibling) zodat 'ie boven de tab-bar zweeft tijdens een audio-sessie. Rendert null op `/player` en `/welcome`.

### 4.4 Schermen — overzicht

Hieronder een doel-per-scherm tabel. Voor diepere walkthroughs zie `docs/VIBEZCORE_APP_VOLLEDIGE_SPEC.md`.

| Route | Bestand | Doel | Auth-tier |
|---|---|---|---|
| `/welcome` | `welcome.tsx` | Eerste scherm voor gasten — full-screen bg + wordmark + accent-streep + "Stop Drifting. / Start Directing." + 3 knoppen (Audio Library / Bracelet / Sign in) | Gast |
| `/` | `(tabs)/index.tsx` | **Audio Library** (major hub, geconsolideerde ex-Library-tab): hero + fasenregel → BUILT ON + 4 pijlers → Emerson-quote → EXPLORE SERIES-header → **search-bar** + **New/Favorites/Free-nav-knoppen** + **Your Journey**-card → 12 serie-cards (accordion inline) → Coming-card (13e) → aankoopblok → disclaimer | Gast OK (pro-view verbergt hero + aankoopblok) |
| `/breath` | `(tabs)/breath.tsx` | 5 breathing protocols (Boost/Focus/Calm/Clarity/Rest), silhouette + circle UI, voice cues | Gast OK |
| `/bracelet` | `(tabs)/bracelet.tsx` | Etalage met 5 modes + photos, pricing, KS-CTA, preview-CTA | Gast OK |
| `/account` | `(tabs)/account.tsx` | Profile-row, sub-state, Activate-bracelet CTA, Settings entry | Gast OK |
| `/library/new` | `library/new.tsx` | Sub-pagina — platte sessie-lijst van `isNew(sess.added)`-matches, gesorteerd nieuwste-eerst; empty state bij 0 | Gast OK |
| `/library/favorites` | `library/favorites.tsx` | Sub-pagina — favoriete sessies uit `useFavorites()`; ❤️-knop verwijdert; nieuwste-eerst | Gast OK |
| `/library/free` | `library/free.tsx` | Sub-pagina — alle 14 gratis sessies (`session.free === true`) | Gast OK |
| `/coming` | `coming.tsx` | "What's Coming Next"-roadmap — hero + fasenregel + 2 secties met pulserende dots + accordion-rijen (Existing Series 15 items incl. 4 Soundscapes; New Series 8 items met "Show all X sessions"-toggle) | Gast OK |
| `/history` | `history.tsx` | Placeholder "Your Journey" — komt vanuit Your Journey-card op Audio Library | Iedereen |
| `/bracelet-history` | `bracelet-history.tsx` | Sessie-historie voor bracelet-gebruikers | Bracelet-owner |
| `/breath-history` | `breath-history.tsx` | Historie van breath-sessies | Iedereen |
| `/bracelet-preview` | `bracelet-preview.tsx` | Preview van bracelet-UI zonder echte hardware | Iedereen |
| `/player` | `player.tsx` | Full-screen audio player (modal Stack.Screen): back-knop (`SafeAreaView edges=['top']` + `closePlayer`-fallback naar `/`), FREE/PRO-branding, progress + play/pause + 30s-preview-blok voor gasten op PRO | Gast tot 30s preview op PRO, volledig op Free / Abo |
| `/bracelet-control` | `bracelet-control.tsx` | Actieve bracelet-sessie: modusnaam, remaining, battery, STOP | Bracelet-owner |
| `/subscribe` | `subscribe.tsx` | IAP paywall (Guideline 3.1.2c-compliant): titel/duur/prijs zichtbaar, Privacy Policy + Terms/EULA linked in-app; account-registratie is OPTIONEEL vóór aankoop (5.1.1v-compliant, in progress) | Iedereen |
| `/activate-bracelet` | `activate-bracelet.tsx` | QR + code redemption (mock-success in dev) | Logged-in |
| `/settings` | `settings.tsx` | Playback, Privacy, About | Logged-in |
| `/auth-callback` | `auth-callback.tsx` | Verifies `token_hash` from email magic-link → Supabase session | Public |
| `/forgot-password` | `forgot-password.tsx` | Form: email → triggert Supabase recovery email | Public |
| `/reset-password` | `reset-password.tsx` | Deep-link landing voor recovery-email | Public (token-gated) |
| `/change-password` | `change-password.tsx` | Voor ingelogde users; vereist current-password | Logged-in |
| `/support` | `support.tsx` | In-app contact form → POST /api/support → Zoho SMTP | Iedereen |
| `/legal/[doc]` | `legal/[doc].tsx` | Dynamic routes: terms, privacy, refund, cookies, health | Public |
| `/faq` | `faq.tsx` | Statische FAQ, content in `data/faq-content.ts` | Public |
| `/about` | `about.tsx` | Brand-story, 8 secties | Public |

### 4.5 Componenten inventaris (`src/components/`)

| Component | Doel |
|---|---|
| `AccountWallModal.tsx` | Verschijnt wanneer gast op account-tier sessie tikt. Sibling-mount (geen native Modal) om touch-intercept te vermijden. |
| `AppLogo.tsx` | Wordmark-render met sizing-presets (`small`/`medium`/`hero`). |
| `BraceletActivationCta.tsx` | Inline CTA in Account-tab voor users zonder bracelet-entitlement. |
| `BraceletUpsellModal.tsx` | Sliding modal die bij audio-sessie-end pop-upt met bracelet-upsell. |
| `BreathMiniControl.tsx` | Mini-control bar voor actieve breath-sessie (parallel aan MiniPlayer, sibling-mount). |
| `ErrorBoundary.tsx` | React error boundary — toont neutrale fallback, verwijst naar `vibezcore.com/support` (geen mail-app-koppeling meer). |
| `LibraryListRow.tsx` | Standaard rij voor session-lijsten (Library, Favorites, History, Free). |
| `MiniPlayer.tsx` | Vlakke balk boven tab-bar, draggable horizontaal om sessie te wisselen, tap-to-expand. Native-side audio-state via `audio-player.ts` service. |
| `PlayPauseGlyph.tsx` | Animated play/pause icoon. |
| `PreviewBanner.tsx` | "Preview · 30s left" banner in player.tsx voor gasten op PRO-sessies. |
| `StoreLogos.tsx` | Apple+Google badges (voor "Available on" rows). |
| `VibezAlert.tsx` | Merk-styled alert/modal component ter vervanging van `Alert.alert()` — dark Brand.bg, BrandFonts, blauw accent. Gebruikt overal in de app voor confirms/errors. |
| `WelcomeBackPopup.tsx` | Cold-start popup met "Resume your last session" CTA. |
| `WelcomeBackWarrior.tsx` | Motivationele cold-start variant (>12h gap). |
| `animated-icon.tsx` | Reanimated wrapper voor scaling glyphs. |
| `app-tabs.tsx` | Tab-segmented control (in Bracelet-tab). |
| `external-link.tsx` | Wrapper voor `expo-web-browser` openBrowserAsync. |
| `hint-row.tsx` | Settings-row met label+value+chevron. |
| `themed-text.tsx`, `themed-view.tsx` | Theming wrappers (dark/light). |
| `web-badge.tsx` | Web-only "Try in app" badge. |
| `ui/` | Sub-folder met low-level primitives (Button, Pill, Divider, Collapsible). |

### 4.6 Services (`src/services/`)

Services zijn singletons of factories die business-logica isoleren. Importeren via `@/services/<name>`.

| Service | Doel | Notable |
|---|---|---|
| `audio-player.ts` | Centrale audio-state met expo-audio. Methods: `loadSession`, `play`, `pause`, `seek`, `resume`. Singleton met React-context wrapper. | Background-playback ON, lock-screen controls via expo-audio. |
| `auth.ts` | Supabase Auth wrapper. `signIn`, `signUp`, `signOut`, `getToken`, `getUser`. Token persisted in AsyncStorage onder `vibezcore:auth-token`. | Tokens worden niet refreshed (geen refresh-token in flow); 1-week JWT expiry uit Supabase default. |
| `ble-contract.ts` | Constants voor BLE service/characteristic UUIDs (spec v2.3). | Niet provider-coupled; alleen UUIDs + command-bytes. |
| `bracelet-activation.ts` | Local-only mock: leest activation-code, valideert pattern, slaat entitlement op. | Backend endpoint `/api/bracelet/activate` nog te bouwen. |
| `bracelet-sim.ts` | Simuleert hardware BLE-protocol via setTimeout-loops. | Active wanneer `USE_SIMULATED_BLE === true`. |
| `bracelet-upsell.ts` | Pub/sub trigger voor BraceletUpsellModal. | Singleton observable. |
| `bracelet-voice.ts` | Voice cues voor bracelet-sessies (parallel structuur aan `breath-voice.ts`) via expo-audio. | |
| `bracelet.ts` | Façade die kiest tussen `bracelet-sim` en `bracelet-real` (toekomst). | App-code praat uitsluitend hiermee. |
| `breath-session-state.ts` | Runtime-state van een actieve breath-sessie: phase, elapsed, protocol-index. Voedt `BreathMiniControl.tsx`. | Module-state + listener-pattern. |
| `breath-voice.ts` | Voice cues via expo-audio met Bunny CDN-files. Cache per URL, voice-toggle, completion-cue altijd-aan. | Vervangt expo-speech TTS (vereiste rebuild). |
| `iap-contract.ts` | Product ID's en tier-mapping. | `com.ubili.vibezcoreapp.audio.monthly` / `com.ubili.vibezcoreapp.audio.yearly` — zie ook STORE_LAUNCH_CHECKLIST §1.3. |
| `iap-mock.ts` | Mock IAP voor sim-mode (dev-only). | |
| `iap-real.ts` | react-native-iap wrapper: init, fetch products, purchase, listener. | Calls `/api/iap-verify` post-purchase. |
| `iap-recovery.ts` | Hersteltraject wanneer een IAP-verify server-side faalt: retry-queue met exponentiële backoff, geeft user feedback via VibezAlert. | |
| `iap.ts` | Façade die kiest tussen mock en real. | |
| `restore-purchases.ts` | Triggert react-native-iap.getAvailablePurchases + re-verify alle receipts. | UI-knop in /settings + auto-run bij eerste app-load post-install. |
| `social-auth.ts` | Sign in with Apple + Google-signin abstractie. Voor 4-Design-compliance (Apple HIG-conforme knop) — nog te herzien per Apple-rejection (open task). | Gebruikt `@react-native-google-signin/google-signin` en `expo-apple-authentication`. |
| `subscription-actions.ts` | Self-service: cancel-renewal, restore, manage-billing deep-links naar store. | |
| `version-tracker.ts` | Tracked app-version + install-timestamps voor migratie/onboarding-hints. | AsyncStorage-backed. |
| `welcome-popup.ts` | Pub/sub voor WelcomeBackPopup visibility. | |

### 4.7 Hooks (`src/hooks/`)

| Hook | Doel |
|---|---|
| `useFavorites.ts` | Sessie-favorieten (webapp-parity schema `vzf_v1`). Data: `Map<url, FavEntry>` met `{ url, title, series, ts }`. **Per-user bucketing** (iter 9dq v44): opslag onder `vzf_{bucket}_v1` waar `bucket` uit `utils/user-bucket.ts` komt — verse user krijgt lege Map. **Legacy migratie** (v54, audit C4): pre-vzf_v1 `vibezcore:favorites` Set<url> wordt éénmalig per device geïmporteerd naar de huidige bucket (device-flag `vzf_legacy_migrated_v1` voorkomt cross-user leak bij bucket-switch). API: `favorites: Map<url, FavEntry>` · `toggle(session)` (accepteert Session-object om title/series op te slaan) · `has(url)`. Cross-component sync via module-state + listener-set. |
| `useIAP.ts` | Bridge naar `services/iap.ts`. Products, loading, purchase, restore. |
| `useSubscription.ts` | Roept `/api/subscription-status` periodiek + on-focus. Returns `{ active, tier, valid_until, will_renew, platform }`. |
| `useTheme.ts` | Theme tokens (delegates naar `constants/theme.ts`). |
| `use-color-scheme.ts` | OS color-scheme — niet productioneel gebruikt (app is dark-only). |

### 4.8 Utils (`src/utils/`)

Pure functions, geen state, geen side-effects (m.u.v. AsyncStorage-readers).

| Util | Doel |
|---|---|
| `access-tier.ts` | Compute access level: `'guest' | 'audio' | 'bracelet' | 'pro'`. Combineert auth-state + sub-state + dev-override. |
| `api.ts` | `fetchApi(path, opts)` met JWT-headers + base URL. |
| `audio-url.ts` | Resolve session-URL: roept `/api/audio-url?session=...` voor signed Bunny URL. |
| `bracelet-history-sync.ts` | Reads local bracelet history → POST naar `/api/bracelet/sessions/sync`. |
| `bracelet-history.ts` | AsyncStorage-backed bracelet sessie historie. Bucket-key-pattern zoals useFavorites. |
| `breath-history.ts` | AsyncStorage-backed breath sessie historie. Bucket-key-pattern. |
| `dev-user-override.ts` | Tester-tool: lees AsyncStorage-flag voor user-tier simulatie. |
| `history.ts` | Audio playback history. Bucket-key-pattern. Voedt Your Journey / `/history`-scherm. |
| `isNew.ts` | `isNew(added: string): boolean` — sessie 'nieuw' als: `added` niet leeg + `>= NEW_BASELINE` (2026-05-10) + binnen **NEW_DAYS = 30** dagen van nu. Single source of truth voor "New"-filter + evt. badges. |
| `last-played.ts` | Tracking voor WelcomeBackPopup. |
| `library-reset-intent.ts` | Pub/sub voor "Audio tab reset" effect bij tab-press (bracelet-only users → bracelet-only landing). |
| `next-session.ts` | Bepaal volgende-sessie binnen series voor auto-advance. |
| `openSession.ts` | `useGatedOpenSession` hook: check access-tier, push naar player of /subscribe. |
| `play-events.ts` | Pub/sub voor globale play-events (sessie-start/-end) — voedt bv. BraceletUpsellModal. |
| `scroll-intent.ts` | Pub/sub voor scroll-to-top intent. |
| `settings.ts` | AsyncStorage-backed settings (autoplay, voice-toggle, …). |
| `url-eq.ts` | Encoded ↔ decoded URL-vergelijking (Bunny URLs hebben `%20`). |
| `user-bucket.ts` | **Per-user storage-bucketing**: elke user-type (guest / logged / bracelet-only / audio / pro) krijgt een eigen bucket-suffix. Alle user-scoped data (favorites, history, play-events) wordt onder `{prefix}_{bucket}_v1`-key opgeslagen zodat cross-user data-lekken op één device onmogelijk zijn. Exports: `ensureBucketLoaded()`, `getCurrentBucket()`, `subscribeUserBucket(callback)`. |
| `validate-email.ts` | Simpele email-format-validator voor auth-formulieren. |
| `vzp.ts` | VIBEZCORE-Playback state (last position, sessie-progress) via bucketed storage. Complementair aan `history.ts`. |

### 4.9 Data (`src/data/`)

Statische content; alleen wijzigen via operator-goedkeuring.

| Data file | Inhoud |
|---|---|
| `audio-library-data.ts` | **83 sessies** in **12 series** — schema: `Session = { title, series, subseries, free, desc, num, url, added }`. Extra exports: `SERIES_ORDER` (volgorde 12 series), `SERIES_PHOTO[name]` (Bunny CDN), `SERIES_SUBTITLE[name]` (eyebrow op card, bv. `"Andrew Huberman inspired"`), `SERIES_SUB[name]` (3e-regel tagline, bv. `"Done with excuses"`), `SUBCAT_INFO[subcat]` + `SUBCAT_ORDER` (4 Soundscapes-subcategorieën: Calm Clarity / Rest & Reset / Zen Flow / Harmonic), `SESSIONS` (flat array), `SERIES` (grouped als `Series[]`). Alle 83 sessies hebben nu een gevuld `desc`-veld (audit 2026-05-20; eerder ontbraken die op PRO-sessies). URL wijst naar Bunny CDN met `%20`-encoded paths — vergelijking altijd via `url-eq.ts`. |
| `breathwork-modes.ts` | 5 protocols: `{ key, label, color, inhaleVia, exhaleVia, beats: { inhale, hold, exhale, holdOut }, durations: [min, default, max] }`. |
| `faq-content.ts` | FAQ items als `{ q, a, category }`. Synced van vibezcore.com/faq. |
| `legal-content.ts` | Legal docs: terms, privacy, refund, cookies, health. Markdown-achtige inhoud per `doc`. Exporteert ook `SUPPORT_URL = 'https://www.vibezcore.com/support'` (single source of truth voor het support-pad — ASC Support URL moet **exact** dit zijn, niet `/contact`). |

### 4.10 Brand tokens (`constants/theme.ts`)

Gebaseerd op MERK_ANKER. Wijzigingen alleen via operator.

```typescript
export const Brand = {
  bg: '#0a0a0a',
  panel: '#1e1e1e',
  border: '#2a2a2a',
  accent: '#3a8fff',
  accentHover: '#2a7fee',
  success: '#4ade80',
  error: '#ef4444',
  text: '#f4f4f4',
  textDim: '#8a8a8a',
};

export const BrandFonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
};
```

### 4.11 AsyncStorage keys

**Bucket-key-pattern (v44, 2026-06-03):** alle user-scoped data staat onder `{prefix}_{bucket}_v1` waar `bucket` uit `utils/user-bucket.ts` komt (elke user-type — guest / logged / bracelet-only / audio / pro — heeft z'n eigen bucket zodat cross-user data-lekken op één device onmogelijk zijn). Bij bucket-switch (sign-in/out, override change) wist elke consumer z'n in-memory cache en herlaadt uit de nieuwe bucket.

**Legacy migratie (v54, audit C4):** pre-vzf_v1 `vibezcore:*`-keys (bv. `vibezcore:favorites`) worden éénmalig per device geïmporteerd naar de huidige bucket. Device-flag (bv. `vzf_legacy_migrated_v1`) voorkomt dat een tweede user op hetzelfde toestel de data van de eerste user erft.

**Actieve keys, alfabetisch:**

| Key-patroon | Schema | Geset door | Bucketed |
|---|---|---|---|
| `vibezcore:auth-token` | string (JWT) | `services/auth.ts` | nee (global — 1 sessie per device) |
| `vibezcore:bracelet-history` | `Array<{ key, startedAt, durationSec }>` | `utils/bracelet-history.ts` | ja (migreert naar bucket-key) |
| `vibezcore:breath-history` | `Array<{ key, ts, durationSec, completed }>` | `utils/breath-history.ts` | ja |
| `vibezcore:dev-user-override` | `'guest' | 'audio' | 'bracelet' | 'pro' | null` | `utils/dev-user-override.ts` | nee (dev-tool, per-device) |
| `vibezcore:favorites` | LEGACY — `Array<url>` (Set<url> geserialiseerd) | pre-v44 `hooks/useFavorites.ts` | migreert naar `vzf_{bucket}_v1` |
| `vibezcore:history` | `Array<{ url, ts, completedPct }>` | `utils/history.ts` | ja |
| `vibezcore:last-played` | `{ url, ts, position } \| null` | `utils/last-played.ts` | ja |
| `vibezcore:settings` | `{ autoplay, voiceEnabled, restartOnReplay, … }` | `utils/settings.ts` | nee (device-instellingen) |
| `vibezcore:welcome-back-shown-at` | `number` (ms) | `services/welcome-popup.ts` | nee |
| `vzf_v1` | LEGACY (post-migratie) — `FavEntry[]` | `hooks/useFavorites.ts` | nee (transitional) |
| `vzf_{bucket}_v1` | `FavEntry[]` — `[{ url, title, series, ts }, …]` | `hooks/useFavorites.ts` | **ja** (huidige) |
| `vzf_legacy_migrated_v1` | `'1'` (flag) | `hooks/useFavorites.ts` | nee (device-scope, éénmalig) |
| `vzp_{bucket}_v1` | Playback-state (last position per session) | `utils/vzp.ts` | ja |
| `vzh_{bucket}_v1` | History (bucketed variant) | `utils/history.ts` | ja |

---

## Deel 5 — Backend Architecture

### 5.1 Netlify config (`netlify.toml`)

```toml
[build]
  functions = "netlify/functions"
  publish = "public"

[functions]
  node_bundler = "esbuild"

# Endpoint redirects: short URLs → function files
[[redirects]]
  from = "/api/gumroad-webhook"
  to = "/.netlify/functions/gumroad-webhook"
  status = 200

[[redirects]]
  from = "/api/subscription-status"
  to = "/.netlify/functions/subscription-status"
  status = 200

[[redirects]]
  from = "/api/audio-url"
  to = "/.netlify/functions/audio-url"
  status = 200

[[redirects]]
  from = "/api/auth-proxy"
  to = "/.netlify/functions/auth-proxy"
  status = 200

[[redirects]]
  from = "/api/bracelet/sessions/sync"
  to = "/.netlify/functions/bracelet-sessions-sync"
  status = 200

[[redirects]]
  from = "/api/support"
  to = "/.netlify/functions/support"
  status = 200

[[redirects]]
  from = "/api/iap-verify"
  to = "/.netlify/functions/iap-verify"
  status = 200

[[redirects]]
  from = "/api/iap-webhook"
  to = "/.netlify/functions/iap-webhook"
  status = 200

# Cache headers — voorkomen edge-caching van signed URL responses
[[headers]]
  for = "/api/audio-url"
  [headers.values]
    Cache-Control = "private, no-store, no-cache, must-revalidate"
    Vary = "Authorization"

[[headers]]
  for = "/api/auth-proxy"
  [headers.values]
    Cache-Control = "private, no-store, no-cache, must-revalidate"
    Vary = "Authorization"
```

### 5.2 Endpoint specificaties

Hieronder per endpoint: request, response, errors, dependencies.

#### 5.2.1 `POST /api/iap-verify`

Client-driven: roep aan na een succesvolle StoreKit/Play Billing-transactie om receipt te valideren en sub-state in DB op te slaan.

**Request:**
```http
POST /api/iap-verify
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{
  "platform": "apple" | "google",
  "tier": "monthly" | "yearly",
  "productId": "vibezcore_audio_monthly",
  "transactionId": "20000123456789",
  "receipt": "<base64 receipt for Apple; purchase_token for Google>"
}
```

**Response (success):**
```json
{
  "ok": true,
  "active": true,
  "tier": "yearly",
  "valid_until": "2027-06-18T00:00:00.000Z",
  "will_renew": true,
  "platform": "apple"
}
```

**Errors:**
| Status | Body | Oorzaak |
|---|---|---|
| 400 | `{ error: 'Invalid platform' }` | Body veld ontbreekt of incorrect |
| 400 | `{ error: 'invalid_receipt', reason: 'bundle_id_mismatch' }` | Receipt is voor andere app |
| 400 | `{ error: 'invalid_receipt', reason: 'expired' }` | Receipt expired al |
| 401 | `{ error: 'Missing Authorization header' }` | Geen JWT |
| 401 | `{ error: 'Invalid token or no user row' }` | JWT expired of user-row mist |
| 409 | `{ error: 'receipt_already_consumed' }` | TransactionId hangt al aan andere user (anti-replay) |
| 405 | `{ error: 'Method not allowed' }` | Non-POST |
| 500 | `{ error: 'Internal error' }` | Unhandled |
| 500 | `{ error: 'database_error' }` | Supabase REST PATCH failed |
| 502 | `{ error: 'store_unreachable' }` | Apple/Google API unreachable |

**Dependencies:**
- `APPLE_SHARED_SECRET`, `APPLE_BUNDLE_ID`
- `GOOGLE_PACKAGE_NAME`, `GOOGLE_SERVICE_ACCOUNT_JSON`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

#### 5.2.2 `POST /api/iap-webhook`

Store-driven: Apple App Store Server Notifications V2 + Google Play RTDN (via Pub/Sub push). Auto-detecteert provider op body shape (`signedPayload` = Apple, `message.data` = Google).

**Apple flow:**
1. Decode JWS payload (header.payload.signature, base64url-decode middle).
2. Check `data.bundleId === APPLE_BUNDLE_ID`.
3. Decode nested `signedTransactionInfo` + `signedRenewalInfo`.
4. Map `notificationType` (SUBSCRIBED/DID_RENEW/EXPIRED/REVOKE/REFUND/…) naar sub-state update.
5. PATCH `subscriptions` matchend op `original_transaction_id`.

**Google flow:**
1. Decode base64 `message.data` → JSON.
2. Check `packageName === GOOGLE_PACKAGE_NAME`.
3. Re-verify via Google Play Dev API (defensief, ook spoof-proof).
4. Map `notificationType` (1-13) → sub-state update.
5. PATCH `subscriptions` matchend op `transaction_id` (= purchase_token).

**Idempotency:** updates zijn idempotent (status='active' twee keer = no-op). Geen apart log-table; Apple/Google retryen op non-2xx.

**Beveiligingsnoot:** volledige JWS x5c chain verification voor Apple is TODO. Voor MVP voldoende omdat we ook bundle_id checken én matchen op unieke `original_transaction_id` die een attacker niet kan raden. Risk-mitigation tijdens MVP-fase.

#### 5.2.3 `GET /api/subscription-status`

App leest op elke launch + on-focus. Returns huidige sub-state.

**Request:**
```http
GET /api/subscription-status
Authorization: Bearer <supabase-jwt>
```

**Response:**
```json
{
  "active": true,
  "tier": "yearly",
  "status": "active",
  "valid_until": "2027-06-18T00:00:00.000Z",
  "will_renew": true,
  "platform": "apple",
  "product_id": "vibezcore_audio_yearly",
  "transaction_id": "...",
  "original_transaction_id": "...",
  "gumroad_subscriber_id": null,
  "email": "user@example.com"
}
```

Velden `platform`, `product_id`, `transaction_id`, `original_transaction_id` zijn toegevoegd op 2026-06-18 (IAP-update).

**User resolution:** Supabase Auth JWT → `auth.users.id` → opzoeken in `public.users.auth_user_id` → surrogate `public.users.id` → query `subscriptions.user_id`. Als public.users-row ontbreekt wordt 'ie aangemaakt (lazy-create).

**Errors:**
| Status | Body |
|---|---|
| 200 | `{ active: false, reason: 'no_user_row' }` — kan user niet resolven |
| 200 | `{ active: false, reason: 'no_subscription' }` — geen rij in subscriptions |
| 401 | `{ error: 'Missing Authorization header' }` |
| 401 | `{ error: 'Invalid token' }` |
| 405 | `{ error: 'Method not allowed' }` |
| 500 | `{ error: 'Internal error' }` |

#### 5.2.4 `GET /api/audio-url`

Resolve een session-URL naar een Bunny CDN signed URL (10-minuten geldigheid).

**Request:**
```http
GET /api/audio-url?session=<url-encoded-session-path>
Authorization: Bearer <supabase-jwt>
```

**Response:**
```json
{
  "url": "https://vibezcore-audio.b-cdn.net/path/to/file.mp3?token=…&expires=…",
  "expires_at": "2026-06-18T16:35:00.000Z"
}
```

**Auth-gating:**
- Free sessions: signed URL altijd, ongeacht JWT.
- Account-tier sessions: vereist geldige JWT (logged-in).
- Pro/sub-tier sessions: vereist `active=true` in `subscriptions`.

Backend doet de tier-check uit `audio-library-data` (gedeeld via JSON-snapshot in backend repo) of via een 'has-subscription' service-role call.

#### 5.2.5 `GET /api/auth-proxy`

Forwarder voor Supabase Auth endpoints. Wordt ALLEEN gebruikt door de legacy webapp; native app praat rechtstreeks met Supabase via `services/auth.ts`.

#### 5.2.6 `POST /api/cancel-subscription`

Self-service cancel: zet `will_renew = false`. Eigenlijke cancel-bij-Apple/Google moet de user via de App Store / Play Store doen (Apple staat geen server-side cancel toe). We loggen de intentie zodat user-state instant updatet.

#### 5.2.7 `POST /api/bracelet/sessions/sync`

App POST't lokaal verzamelde bracelet sessie-historie. Wordt periodiek (op next launch) gesynced.

**Request:**
```json
{
  "sessions": [
    { "mode_idx": 2, "started_at": "...", "duration_sec": 900, "completed": true }
  ]
}
```

**Response:**
```json
{ "ok": true, "synced": 1 }
```

#### 5.2.8 `POST /api/support`

In-app contact form. Verzendt via Zoho SMTP.

**Request:**
```json
{
  "name": "User Name",
  "email": "user@example.com",
  "subject": "Help with…",
  "message": "Lange tekst…"
}
```

**Response:**
```json
{ "ok": true }
```

**Errors:** 400 op validation, 500 op SMTP failure.

#### 5.2.9 `POST /api/gumroad-webhook` (LEGACY)

Bestaat nog voor backward-compat. Geen actieve subscribers meer per 2026-06-12. Verwijderbaar na een paar maanden zonder traffic.

#### 5.2.10 `POST /api/sync-subscriptions`

Admin/cron-only: reconcile sub state met store-state. Niet door app aangeroepen.

---

## Deel 6 — Supabase Schema

### 6.1 Tabellen

#### `public.users`

Surrogate PK omdat we wilden ontkoppelen van Supabase `auth.users` (waar policies en migraties soms gevoelig zijn). `auth_user_id` is UNIQUE en FK naar `auth.users(id) ON DELETE SET NULL`.

```sql
CREATE TABLE public.users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email           text NOT NULL,
  email_confirmed boolean NOT NULL DEFAULT false,
  display_name    text,
  has_bracelet    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_email_idx ON public.users (email);
```

#### `public.subscriptions`

Eén-actieve-sub-per-user model (geen historie). Updates via upsert op `user_id`.

```sql
CREATE TABLE public.subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Legacy Gumroad-identifiers (NULL voor IAP-subs)
  gumroad_sale_id          text,
  gumroad_subscriber_id    text,
  gumroad_product_id       text,

  -- Lifecycle
  tier                     text NOT NULL,      -- 'monthly' | 'yearly'
  status                   text NOT NULL,      -- 'active' | 'ended' | 'refunded' | 'cancelled'
  valid_until              timestamptz NOT NULL,
  will_renew               boolean NOT NULL,
  last_payment_at          timestamptz,
  cancelled_at             timestamptz,

  -- IAP-velden (toegevoegd 2026-06-18)
  platform                 text,               -- 'ios' | 'android' | 'gumroad' | 'stripe'
  transaction_id           text,
  original_transaction_id  text,
  product_id               text,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT subscriptions_platform_check
    CHECK (platform IS NULL OR platform IN ('ios','android','gumroad','stripe'))
);

CREATE UNIQUE INDEX subscriptions_user_id_unique
  ON public.subscriptions (user_id);

CREATE UNIQUE INDEX subscriptions_transaction_id_unique
  ON public.subscriptions (transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE INDEX subscriptions_user_valid_idx
  ON public.subscriptions (user_id, valid_until DESC);
```

#### `public.bracelet_sessions`

Server-side mirror van bracelet sessie-historie.

```sql
CREATE TABLE public.bracelet_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mode_idx      smallint NOT NULL,    -- 0=Boost, 1=Focus, 2=Calm, 3=Clarity, 4=Rest
  started_at    timestamptz NOT NULL,
  duration_sec  integer NOT NULL,
  completed     boolean NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bracelet_sessions_user_started_idx
  ON public.bracelet_sessions (user_id, started_at DESC);
```

#### `public.activation_codes`

QR/code → entitlement. Wordt bij bracelet shipping uitgegeven.

```sql
CREATE TABLE public.activation_codes (
  code         text PRIMARY KEY,             -- 8-char menselijk-leesbaar
  bundle       text NOT NULL,                -- 'bracelet' | 'bracelet+audio'
  status       text NOT NULL DEFAULT 'unused', -- 'unused' | 'used'
  used_by      uuid REFERENCES public.users(id),
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

### 6.2 RLS-policies

Onze backend gebruikt de service-role key en bypasst RLS, maar voor toekomstige direct-from-app queries (b.v. realtime updates) horen er strikte policies te zijn.

```sql
ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracelet_sessions ENABLE ROW LEVEL SECURITY;

-- Users mogen alleen hun eigen rij lezen
CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (auth_user_id = auth.uid());

-- Subscriptions: read-only voor eigen sub
CREATE POLICY subs_select_own ON public.subscriptions
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );

-- Bracelet sessions: idem
CREATE POLICY brace_select_own ON public.bracelet_sessions
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );
```

INSERT/UPDATE/DELETE doet ALLEEN de service-role; geen client-side writes.

### 6.3 Auth (Supabase)

- Provider: email + password. Magic link disabled (gaf delivery-issues via Zoho SMTP).
- Email templates: aangepast naar VIBEZCORE branding (zie OPERATOR_HANDOVER §7 voor exacte HTML).
- Redirect URLs: zie Deel 3.3.
- JWT expiry: 1 week (Supabase default).
- Refresh tokens: WEL gebruikt, app slaat 'm op naast access-token via `services/auth.ts`.

---

## Deel 7 — Auth Flow

### 7.1 Sign-up

1. User opent `/welcome` → tikt "Already have a product? Sign in" → push naar `/auth-callback` of inline form.
2. Of: gast tikt op gated content → `<AccountWallModal />` → form: email + password.
3. App roept `supabase.auth.signUp({ email, password })`.
4. Supabase verstuurt confirm-email (template door operator gemaakt).
5. User klikt link → `vibezcoreapp://auth-callback?token_hash=…&type=signup`.
6. `_layout.tsx` deep-link handler routert naar `/auth-callback`.
7. `auth-callback.tsx` roept `supabase.auth.verifyOtp({ token_hash, type: 'signup' })`.
8. Bij success: token persisted in AsyncStorage, redirect naar `/`.
9. `/api/subscription-status` triggert lazy-create van `public.users`-row.

### 7.2 Sign-in

1. Form: email + password.
2. `supabase.auth.signInWithPassword({ email, password })`.
3. Token in AsyncStorage.
4. `_layout.tsx` ziet token → geen welcome redirect.

### 7.3 Forgot / reset password

1. User in `/forgot-password` → form: email.
2. `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'vibezcoreapp://reset-password' })`.
3. Supabase verstuurt recovery email (custom template).
4. User klikt link → `vibezcoreapp://reset-password?token_hash=…`.
5. `reset-password.tsx` form: nieuw password 2x.
6. `supabase.auth.updateUser({ password })`.
7. Redirect naar `/`.

### 7.4 Sign-out

1. `signOut()` in `services/auth.ts`: roep `supabase.auth.signOut()`, clear AsyncStorage `vibezcore:auth-token`.
2. `/welcome` redirect via `_layout.tsx` op next mount.

### 7.5 Edge cases

- **Concurrent device login**: Supabase ondersteunt meerdere sessies per user. Geen "force logout other devices" geïmplementeerd.
- **Account verwijderen**: nog niet via app. Operator handmatig in Supabase dashboard.
- **Email change**: niet via app. Operator handmatig.

---

## Deel 8 — Subscription Flow (Audio IAP)

### 8.1 Vanuit gast-perspectief

```
[Gast]
  │
  ▼
opent app → welcome → tabs → Audio Library
  │
  ▼ tikt op locked Pro-sessie
LibraryListRow → useGatedOpenSession → push /subscribe?tier=monthly
  │
  ▼
/subscribe.tsx
  - als niet logged-in: inline account-create form
  - als logged-in: skip form
  │
  ▼ Continue
useIAP.purchase('vibezcore_audio_monthly')
  │
  ▼
react-native-iap → Apple StoreKit / Google Play Billing
  │
  ▼ purchaseUpdatedListener fires
services/iap-real.ts → fetch('/api/iap-verify', { … })
  │
  ▼
backend valideert receipt bij Apple/Google
  │
  ▼
subscriptions row upserted
  │
  ▼ response: ok:true, active:true
useSubscription invalidates cache → app updatet UI
  │
  ▼
push /player met de sessie die ze probeerden te openen
```

### 8.2 Tier-detectie in de app

`utils/access-tier.ts`:

```typescript
export function computeAccessTier(
  authState: AuthState,
  sub: SubscriptionStatus | null,
  hasBracelet: boolean,
  devOverride: DevOverride | null
): AccessTier {
  if (devOverride) return devOverrideToTier(devOverride);
  if (!authState) return 'guest';
  if (sub?.active && hasBracelet) return 'pro';
  if (sub?.active) return 'audio';
  if (hasBracelet) return 'bracelet';
  return 'guest';
}
```

Sessie-toegang per tier:

| Tier | Free | Account | Audio Pro | Bracelet Pro | Full Pro |
|---|---|---|---|---|---|
| Guest | ✅ | ❌ | ❌ | ❌ | ❌ |
| Account | ✅ | ✅ | ❌ | ❌ | ❌ |
| Audio | ✅ | ✅ | ✅ | ❌ | ❌ |
| Bracelet | ✅ | ✅ | ❌ | ✅ | ❌ |
| Pro | ✅ | ✅ | ✅ | ✅ | ✅ |

`bracelet`-tier sessions zijn b.v. specifieke "Boost"-protocols die meta-data linken naar de bracelet-Boost mode. `Full Pro` = audio-yearly + bracelet samen.

### 8.3 Renewal / cancel flow

Renewals gaan via store-driven webhook (zie Deel 5.2.2). Geen app-actie nodig — `useSubscription` haalt verse state bij next launch.

Cancel:
1. User in `/settings` → "Cancel subscription".
2. App opent OS settings via `Linking.openURL`:
   - iOS: `https://apps.apple.com/account/subscriptions`
   - Android: `https://play.google.com/store/account/subscriptions?sku=<productId>&package=<package>`
3. User klikt cancel in store.
4. Apple/Google stuurt webhook → `subscriptions.will_renew = false`.

### 8.4 Restore purchases

`/settings` → "Restore purchases":
1. `services/restore-purchases.ts` → `react-native-iap.getAvailablePurchases()`.
2. Voor elke purchase: POST `/api/iap-verify`.
3. Backend update DB als receipt valid.

### 8.5 Anti-abuse

- `transaction_id UNIQUE WHERE transaction_id IS NOT NULL` voorkomt receipt-replay (zelfde receipt op andere account).
- `original_transaction_id` koppelt alle renewals aan dezelfde initial-purchase.

---

## Deel 9 — Bracelet Flow (BLE)

### 9.1 Hardware (uit BLE spec v2.3)

- MCU: nRF52832 (Nordic Semiconductor).
- Haptic driver: DRV2605L (Texas Instruments).
- BLE: 5.0, GATT-server.
- Battery: 100 mAh LiPo, ~5-7 dagen typisch gebruik.
- USB-C voor laden.

### 9.2 BLE-contract

Sectie 8 van Haptic_Bracelet_Spec_v2_3.docx (BINDEND — niet zelf verzinnen).

**Command (App → Bracelet):**
```typescript
{
  mode: 0 | 1 | 2 | 3 | 4,        // 0=Boost, 1=Focus, 2=Calm, 3=Clarity, 4=Rest
  duration: number,                // minuten (binnen mode-specifieke range)
  command: 0x01 | 0x02 | 0x03     // 0x01=START, 0x02=STOP, 0x03=STATUS_REQUEST
}
```

**Status (Bracelet → App):**
```typescript
{
  session_active: boolean,
  current_mode: 0 | 1 | 2 | 3 | 4,
  remaining_minutes: number,
  battery_percent: number,         // 0-100
  charging: boolean,
  fault: number                    // 0=ok, >0=specific fault code
}
```

**Interactiemodel:**
- App stuurt **één commando** (mode+duration+START).
- Bracelet draait daarna **autonoom** op hardware-timers.
- BLE-verbindingsverlies stopt de sessie **NIET**.
- App **POLLT status elke 5 seconden** via STATUS_REQUEST.
- Sessie eindigt bij: timer af · charging start · battery <5% · fault · STOP.
- App past tijdens een sessie **GEEN realtime parameters** aan.

### 9.3 Sim ↔ echte hardware

`src/services/bracelet.ts` is een façade:

```typescript
export interface BraceletTransport {
  connect(): Promise<void>;
  startSession(mode: number, duration: number): Promise<void>;
  stopSession(): Promise<void>;
  pollStatus(): Promise<BraceletStatus>;
  disconnect(): Promise<void>;
}

export const bracelet: BraceletTransport = USE_SIMULATED_BLE
  ? new SimulatedBracelet()
  : new RealBracelet(); // react-native-ble-plx, zelfde interface
```

UI/app-logica veranderen NIET bij omschakeling. `bracelet-sim.ts` simuleert de timer-countdown spec-getrouw (incl. battery drain, charging-detection mock).

### 9.4 5 Bracelet-modi (presentatielaag)

| Idx | Intern (legacy) | App-naam | Kleur | Duur (min=default – max) |
|---|---|---|---|---|
| 0 | Gamma | Boost | Wit #FFFFFF | 8 – 15 min |
| 1 | Beta | Sharp Focus | Oranje #FF9F0A | 15 – 30 min |
| 2 | Alpha | Calm Control | Blauw #0A84FF | 15 – 30 min |
| 3 | Theta | Clarity | Paars #BF5AF2 | 15 – 30 min |
| 4 | Delta | Rest & Reset | Sage #4FA46B | 25 – 45 min |

App toont NOOIT technische parameters (PPS, burst_ms, amplitude, RTP). Alleen modusnaam, duur, resterende tijd, batterij, status.

### 9.5 App-flow

```
/bracelet  (etalage)
  │
  ▼ tikt "Connect bracelet"
bracelet.connect()
  │
  ▼ verbonden — etalage toont "Connected" + 5 modus-cards
tikt op een mode-card
  │
  ▼ push /bracelet-control?mode=2&duration=20
bracelet-control.tsx
  - mounts: roept bracelet.startSession(2, 20)
  - hapPolling: elke 5s bracelet.pollStatus()
  - UI: countdown ring, battery indicator, STOP-knop
  │
  ▼ na duration of STOP
bracelet.stopSession() (no-op als auto-completed)
  - log sessie in bracelet_sessions (lokaal)
  - sync naar /api/bracelet/sessions/sync op next launch
  - push back naar /bracelet
```

---

## Deel 10 — Audio Streaming Flow

### 10.1 Sessie-bestanden

Alle audio leeft op Bunny CDN: `https://vibezcore-audio.b-cdn.net/<pillar>/<series>/<filename>.mp3`. Pad-encoding: spaties als `%20`.

Voorbeeld: `https://vibezcore-audio.b-cdn.net/Psychological%20Resilience/Build%20What%20Cannot%20Break/01%20Foundation.mp3`.

### 10.2 Resolve-URL flow

1. App heeft sessie-metadata uit `data/audio-library-data.ts` (incl. een base-URL).
2. User tikt → `useGatedOpenSession` checkt access-tier.
3. Als toegestaan: push naar `/player?url=<encoded>`.
4. `player.tsx` mount → roept `resolveAudioUrl(sessionUrl)` (uit `utils/audio-url.ts`).
5. `resolveAudioUrl` POST't naar `/api/audio-url?session=<url>`:
   - Backend valideert JWT + tier.
   - Backend genereert Bunny CDN signed URL (10 min expiry).
   - Response: `{ url: '<signed>', expires_at: '<iso>' }`.
6. `services/audio-player.ts` → `createAudioPlayer({ uri: signed })`.
7. expo-audio streamt + maakt lock-screen controls + background-playback.

### 10.3 Token-based signed URLs (Bunny)

Bunny gebruikt HMAC-SHA256 over `path + expires + secret`. Backend implementatie:

```javascript
const crypto = require('crypto');
const expires = Math.floor(Date.now() / 1000) + 600; // 10 min
const path = '/Psychological Resilience/.../01.mp3';
const hashable = process.env.BUNNY_TOKEN_AUTH_KEY + path + expires;
const token = crypto.createHash('sha256')
  .update(hashable)
  .digest('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const url = `https://${process.env.BUNNY_CDN_PULL_ZONE}${encodeURI(path)}?token=${token}&expires=${expires}`;
```

### 10.4 Player UX

- Scrubber, play/pause, ±10s skip.
- Favorite-heart (`useFavorites.toggle`).
- Share button (deep-link copy).
- Preview-banner voor gasten (30s countdown → "Sign in to continue").
- Auto-advance bij sessie-end (next session in series).
- Mini-collapse: swipe down om naar mini-player te gaan (boven tab-bar).

### 10.5 Background playback

iOS: audio-session category = `playback`, mode = `default`. Configured door expo-audio plugin via `enableBackgroundPlayback: true` in `app.json`.

Android: foreground-service met notification. expo-audio start automatisch een MediaSession.

---

## Deel 11 — Breath Flow

### 11.1 Protocols (`data/breathwork-modes.ts`)

5 protocols matchen de bracelet-modi:

| Key | Label | Inhale | Hold | Exhale | Hold-out | Inhale via | Exhale via |
|---|---|---|---|---|---|---|---|
| boost | Boost | 2s | 0s | 2s | 0s | nose | mouth |
| focus | Sharp Focus | 4s | 4s | 4s | 4s | nose | nose |
| calm | Calm Control | 4s | 0s | 8s | 0s | nose | nose |
| clarity | Clarity | 4s | 7s | 8s | 0s | nose | mouth |
| rest | Rest & Reset | 4s | 0s | 6s | 2s | nose | mouth |

(Exacte cijfers per operator-keuze in `data/breathwork-modes.ts`.)

### 11.2 UI (`(tabs)/breath.tsx`)

- Silhouette van figuur in centrum, schaalt met inhale/exhale.
- Concentric ring met phase-progressie.
- Phase-label: "Inhale through your nose" / "Hold" / "Exhale through your mouth".
- Phase-cue audio via `services/breath-voice.ts` (Bunny CDN-files).
- START/STOP knop.
- Duration-selector (3-15 min).
- Voice-toggle.
- Bottom: "Your Practice" link → `/breath-history`.

### 11.3 Audio cues (`services/breath-voice.ts`)

Bunny CDN base: `https://vibezcore-audio.b-cdn.net/Breathwork%20audio/`.

**Phase cues** (4 files):
- `Inhale%20through%20your%20nose..mp3`
- `Hold.mp3`
- `Exhale%20through%20your%20nose..mp3`
- `Exhale%20through%20your%20mouth..mp3`

**Completion cues** (5 files, één per protocol):
- `boost%20finished%20.mp3`
- `focus%20finished%20.mp3`
- `calm%20finished.mp3`
- `clarity%20finished.mp3`
- `rest%20finished.mp3`

Architectuur:
- Eén persistente `AudioPlayer` per unieke URL, lazy-init.
- Cache via `Map<url, AudioPlayer>`.
- Active player tracking om overlappende cues te stoppen.
- Voice-toggle (`setVoiceEnabled`) gate't phase-cues, **NIET** completion (operator-fix: completion is altijd-aan reward).

### 11.4 Session lifecycle

1. User kiest protocol → tikt START.
2. Loop per breath-cycle:
   - `playBreathCue('inhale', pattern.exhaleVia)` → silhouet+ring schaalt.
   - timer waits `inhale` seconden.
   - `playBreathCue('hold-in', …)` → freeze.
   - timer waits `hold` seconden.
   - `playBreathCue('exhale', …)`.
   - …
3. Bij STOP of duration-end: `playCompletionCue(protocolKey)` + push completion-modal.
4. `breath-history.ts` log de sessie.

---

## Deel 12 — Email Flow (Zoho)

### 12.1 Domein-setup

- Domein: `vibezcore.com` op Wix DNS.
- MX-records: Zoho Mail (`mx.zoho.eu`, `mx2.zoho.eu`).
- SPF: `v=spf1 include:zoho.eu ~all`.
- DKIM: Zoho-provided DKIM key.
- DMARC: `v=DMARC1; p=quarantine; rua=mailto:postmaster@vibezcore.com`.

### 12.2 Mailboxes

- `info@vibezcore.com` — in-app support form + reply-to.
- `noreply@vibezcore.com` — transactional (Supabase Auth).
- `info@vibezcore.com` — algemeen (publiek op website).

### 12.3 In-app support flow

1. User in `/support` → form (name, email, subject, message).
2. POST `/api/support` met JSON.
3. Backend `support.js` gebruikt `nodemailer` met Zoho SMTP credentials.
4. Email naar `info@vibezcore.com` with reply-to = user's email.
5. Operator beantwoordt vanuit Zoho webmail.

### 12.4 Supabase Auth emails

Templates aangepast in Supabase dashboard → Auth → Email Templates. Branding match (zwarte bg + blauw accent + Inter font).

Verzendt vanaf Supabase's default SMTP (geen custom SMTP geconfigureerd — operator-keuze om Zoho voor transactional af te zien wegens delivery-issues op magic links).

---

## Deel 13 — Payments

### 13.1 Audio (IAP)

Zie Deel 8. Geen Stripe, geen Gumroad. iOS = StoreKit, Android = Play Billing.

**Product IDs** (in App Store Connect / Play Console):
- `vibezcore_audio_monthly` — €9.99/mnd, $11.99/mnd, £8.99/mnd
- `vibezcore_audio_yearly` — €69.60/jr (€5.80/m, save 42%), $69.99/jr, £59.99/jr

WYSIWYG: card-prijs is EXACT wat user betaalt (geen "set by store"-disclaimers). Currency auto-detect via timezone in app.

### 13.2 Bracelet (Stripe)

Post-Kickstarter (Fall 2026). Stripe Checkout-sessie via backend `/api/stripe-checkout` (TBD).

Pricing (per 2026-06-17 op website + app):
- Bracelet: $169 (was $299, save $130)
- Bundle (bracelet + 1 jaar audio): $215 (was $399, save $184)
- Extra: $32

EU/UK varianten via Stripe price localization.

### 13.3 Bundle activation

Bundle-koper krijgt activation-code → app: `/activate-bracelet` → POST `/api/bracelet/activate` (TBD endpoint) → backend zet `users.has_bracelet = true` + creëert `subscriptions`-row met `platform = 'stripe'`, `tier = 'yearly'`, `valid_until = now + 365 days`.

---

## Deel 14 — Build & Deploy

### 14.1 Native app (EAS Build)

Vereist: Expo account `ubili` + EAS CLI (`npm install -g eas-cli`).

```bash
# Initial login
eas login

# Dev build (lokaal testen + Expo Go vervanging)
eas build --profile development --platform android
eas build --profile development --platform ios

# Internal testing build
eas build --profile preview --platform all

# Production
eas build --profile production --platform all

# Submit naar stores
eas submit --platform ios --latest
eas submit --platform android --latest
```

`eas.json` (sneed):
```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "production": {}
  },
  "submit": {
    "production": {
      "ios": { "appleId": "<apple-id>", "ascAppId": "<app-store-connect-app-id>" },
      "android": { "serviceAccountKeyPath": "./.eas-credentials/play-key.json", "track": "internal" }
    }
  }
}
```

### 14.2 Backend (Netlify auto-deploy)

Push naar `main` van vibezcore-backend → Netlify auto-deployt binnen 30-60 sec.

Manual deploy via Netlify CLI:
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

Build logs: Netlify dashboard → Site → Deploys.

### 14.3 Webapp (Wix/Bunny)

Live op vibezcore.com via Wix DNS → Wix-hosted statische pagina's. Custom HTML in `assets/website-content/_homepage-NIEUW/` mirror in app-repo voor sync-doeleinden. Update workflow:
1. Edit HTML in `_homepage-NIEUW/`.
2. Operator paste't in Wix HTML-blocks.
3. Live binnen sec.

Bunny CDN-assets (audio, images): upload via Bunny dashboard. Geen build-pipeline.

### 14.4 Versionering

- App: `package.json` version + `app.json` version moeten synchroon zijn. Bump bij elke store-submit.
- Backend: geen versies; rolling.
- Webapp: geen versies; rolling.

---

## Deel 15 — Brand & MERK_ANKER

Volledig in `docs/MERK_ANKER.md`. Samengevat:

- **Font**: Inter (`@expo-google-fonts/inter`), 400/500/600/700/800/900.
- **Kleuren**: zie Deel 4.10.
- **Logo**: `vibezcore_wordmark.png` (schermkoppen), `vibezcore_icon.png` (app-icoon).
- **Look & feel**: dark, hoog contrast, witte tekst, strakke spacing, blauw spaarzaam als accent, grote vette koppen (Inter 800/900).
- **Naam**: VIBEZCORE altijd in HOOFDLETTERS, overal.

---

## Deel 16 — BLE Contract (referentie)

Zie `docs/STRUCTUUR_en_BLE_contract_v2.md` voor de volledige v2.3 spec. Belangrijkste reminders:

- **App stuurt 1 commando** (mode + duration + START), bracelet draait autonoom.
- **Poll-interval**: 5 sec.
- **Sessie eindigt** bij timer · charging · battery <5% · fault · STOP.
- **App past NIETS aan tijdens een sessie** (no realtime parameter updates).
- BLE-verbindingsverlies stopt sessie NIET.

Codetabel modi: zie Deel 9.4. Service/characteristic UUIDs: zie spec v2.3 §8.

---

## Deel 17 — Debugging Playbook

### 17.1 Auth issues

**Symptoom**: "Invalid token" op alle endpoints.
**Oorzaak**: JWT expired (>1 week). 
**Fix**: app moet refresh-token gebruiken; check `services/auth.ts` voor `supabase.auth.refreshSession()` call op 401.

**Symptoom**: Deep-link `vibezcoreapp://auth-callback?...` opent welcome i.p.v. callback.
**Oorzaak**: Cold-start race: welcome-redirect-effect fires vóór deep-link-handler.
**Fix**: `_layout.tsx` heeft `welcomeRedirectFiredRef` + `hasPendingAuthDeepLink()` check. Verifieer dat beide fires correct.

**Symptoom**: User logged in, maar `/api/subscription-status` returns `no_user_row`.
**Oorzaak**: `public.users`-row ontbreekt. Mogelijk webhook niet gerund of bypassed.
**Fix**: `subscription-status.js` heeft lazy-create. Triggert op eerste call.

### 17.2 IAP issues

**Symptoom**: Purchase werkt in sandbox, faalt in prod met `apple_status_21002`.
**Oorzaak**: Receipt malformed of bundle_id mismatch.
**Fix**: Check `APPLE_BUNDLE_ID` env var = `com.ubili.vibezcoreapp`. Check Apple Console productID match.

**Symptoom**: Purchase success → app blijft loading.
**Oorzaak**: `/api/iap-verify` failed silently.
**Fix**: Check Netlify Function logs. Mogelijk `APPLE_SHARED_SECRET` ontbreekt of expired (regen in App Store Connect → App-Specific Shared Secret).

**Symptoom**: `409 receipt_already_consumed`.
**Oorzaak**: Receipt zit al aan andere user. Anti-replay triggert.
**Fix**: Operator handmatig in DB: clear `transaction_id` op oude rij OF link correct.

**Symptoom**: Google purchase werkt niet, `google_400`.
**Oorzaak**: Service-account heeft geen permissions op de app, of OAuth token expired.
**Fix**: Check service account in Google Cloud Console heeft "Android Publisher" role. Test JWT-signing in `iap-verify.js` (run lokaal met `node -e`).

### 17.3 Audio issues

**Symptoom**: Audio stopt bij lock-screen.
**Oorzaak**: Background playback niet ingeschakeld.
**Fix**: `app.json` → `expo-audio` plugin → `enableBackgroundPlayback: true`. Rebuild required.

**Symptoom**: 403 op `/api/audio-url`.
**Oorzaak**: User-tier geeft geen toegang tot deze sessie.
**Fix**: Check session tier in `audio-library-data.ts` + `subscriptions.status`. Operator kan tijdelijk override via dev-user-override.

**Symptoom**: Bunny CDN signed URL faalt met "Token invalid".
**Oorzaak**: `BUNNY_TOKEN_AUTH_KEY` mismatch tussen Bunny dashboard en Netlify env var.
**Fix**: Regen sign-key in Bunny dashboard → copy naar Netlify → redeploy.

### 17.4 Build issues

**Symptoom**: `Cannot find native module 'ExpoSpeech'`.
**Oorzaak**: expo-speech import zonder native module in build.
**Fix**: Verwijder expo-speech import. Voice cues gaan via expo-audio (`services/breath-voice.ts`).

**Symptoom**: EAS build fails op "Inter font not found".
**Oorzaak**: `@expo-google-fonts/inter` niet in `package.json` of niet geladen in `_layout.tsx`.
**Fix**: `npm install @expo-google-fonts/inter` + import alle 6 gewichten in `_layout.tsx`.

**Symptoom**: Android build error "predictiveBackGestureEnabled".
**Oorzaak**: Android predictive-back was per default true; conflict met expo-router pop.
**Fix**: `app.json` → `android.predictiveBackGestureEnabled: false`.

### 17.5 Netlify deploy issues

**Symptoom**: Function returns 404.
**Oorzaak**: Redirect-rule ontbreekt in `netlify.toml`.
**Fix**: Voeg `[[redirects]]` block toe (zie Deel 5.1).

**Symptoom**: Function compile error op deploy.
**Oorzaak**: Syntax error of missing import.
**Fix**: Test lokaal met `netlify dev`. Check Functions tab in Netlify dashboard voor build log.

**Symptoom**: Function timeout (>10s).
**Oorzaak**: External API hangs (Apple verify, Google verify).
**Fix**: Voeg timeout-fetch helper toe; default fetch timeout = none op Node 18.

### 17.6 Supabase issues

**Symptoom**: SQL error `unterminated dollar-quoted string at or near "$$"`.
**Oorzaak**: Supabase SQL editor parser-issue met dubbele `$`.
**Fix**: Gebruik `$func$` als delimiter i.p.v. `$$`.

**Symptoom**: "Restoration in progress" bij eerste open.
**Oorzaak**: Free-tier project gepauzeerd na 7 dagen inactiviteit.
**Fix**: Wacht 5-30 min. Niets aan te doen behalve project upgraden naar paid.

**Symptoom**: `JWT expired` op service-role calls.
**Oorzaak**: Niet van toepassing — service-role keys expiren niet. Mogelijk anon-key per ongeluk gebruikt.
**Fix**: Check env var `SUPABASE_SERVICE_ROLE_KEY` is gezet en niet anon-key.

### 17.7 Bracelet (sim/firmware)

**Symptoom**: Sim-bracelet status blijft "idle" na startSession.
**Oorzaak**: Sim-loop timer niet gestart of cleared te vroeg.
**Fix**: Check `bracelet-sim.ts` `startSession()` start een setInterval; teardown alleen op `disconnect`.

**Symptoom**: Real BLE connect faalt op Android.
**Oorzaak**: Permission `BLUETOOTH_CONNECT` ontbreekt of denied.
**Fix**: Request runtime permission via `expo-permissions`. Documenteer in `app.json` Android `permissions` array.

---

## Deel 18 — Disaster Recovery

### 18.1 Supabase data verlies

**Backups**: Supabase free-tier heeft DAILY backups, 7 dagen retentie. Paid-tier: 14+ dagen.

**Restore**: Supabase dashboard → Database → Backups → Restore. Triggert "Restoration in progress" — duur: minuten tot uren.

**Wat verlies je**: alles sinds laatste backup. Min daarom: kritieke writes loggen ook ergens else (b.v. Stripe webhook + Apple/Google webhook events worden door provider gepersist, dus replay mogelijk).

### 18.2 Netlify outage

Backend down → app toont network errors. UI moet niet crashen — `ErrorBoundary` is gemount.

**Failover**: geen. Aanbeveling voor toekomst: kopie naar Cloudflare Workers of Fly.io.

### 18.3 Bunny CDN outage

Audio kan niet streamen. App toont error. Geen mirror.

**Failover**: optie voor toekomst: secondary CDN bij Cloudflare R2.

### 18.4 Apple Developer Account issue

Renewal vergeten ($99/jaar) → apps automatic verwijderd uit App Store. Reinstate vereist heraanvraag.

**Procedure**: Apple Developer Program → renew before expiry. Reminder 60 dagen vooraf.

### 18.5 Google Play account issue

Policy violation → app suspended. Appeal via Play Console.

### 18.6 Domain / DNS

Wix-account verloren → domain transfer naar Cloudflare via registrar (Domain.com / GoDaddy etc.).

**Wachtwoord-recovery**: zorg dat `nexuscontacteren@gmail.com` 2FA heeft.

### 18.7 Source code

Repos op GitHub (`ulgarbilican-dotcom`). Backup strategy: GitHub IS de backup. Mirror naar GitLab als extra redundantie zou kunnen.

**Local clone**: operator heeft op `C:\Users\ulgar\vibezcore-app` (frontend) en `C:\Users\ulgar\OneDrive\Documenten\GitHub\vibezcore-backend` (backend). OneDrive sync = extra backup laag.

---

## Deel 19 — Developer Onboarding Checklist

Voor een nieuwe developer:

1. **Tools installeren**:
   - Node.js 20 LTS
   - Git
   - VS Code + Expo extension
   - `npm install -g eas-cli expo-cli`
2. **Clone repos**:
   ```bash
   git clone https://github.com/ulgarbilican-dotcom/vibezcore-app.git
   git clone https://github.com/ulgarbilican-dotcom/vibezcore-backend.git
   ```
3. **App opzetten**:
   ```bash
   cd vibezcore-app
   npm install
   ```
4. **Lees in deze volgorde**:
   - `CLAUDE.md` (de regels)
   - Dit blueprint (deze file)
   - `docs/VIBEZCORE_APP_VOLLEDIGE_SPEC.md`
   - `docs/MERK_ANKER.md`
   - `docs/STRUCTUUR_en_BLE_contract_v2.md`
   - `docs/ONTWERP_toegangsmodel.md`
5. **Eerste run**:
   ```bash
   npx expo run:android   # Android device of emulator vereist
   # of
   npx expo run:ios       # macOS + Xcode vereist
   ```
6. **Account requests** (operator regelt):
   - Expo `ubili` team-invite
   - Supabase project access
   - Netlify team-invite
   - Bunny CDN read-access
7. **Eerste taak**: lees `docs/STORE_LAUNCH_CHECKLIST.md` om te zien wat nog open is.

---

## Bijlage A — Bestand-checksums (kritieke files)

Gebruikt om unauthorized wijzigingen te detecteren tijdens audits. Genereer voor je release:

```bash
sha256sum src/app/_layout.tsx
sha256sum src/services/auth.ts
sha256sum src/services/iap-real.ts
sha256sum app.json
sha256sum package.json
sha256sum CLAUDE.md
```

(Run elke release, stash in een `RELEASE_NOTES.md`.)

---

## Bijlage B — Glossary

| Term | Definitie |
|---|---|
| Audio Pro | Tier: user heeft actieve audio-subscription |
| Bracelet Pro | Tier: user heeft `has_bracelet = true` maar geen audio-sub |
| Full Pro | Tier: bracelet + audio-sub combined |
| Gast | Niet-ingelogd. Alleen free sessies + bracelet etalage. |
| ASN V2 | Apple App Store Server Notifications V2 |
| RTDN | Real-time Developer Notifications (Google Play) |
| BLE | Bluetooth Low Energy |
| PPS | Pulses Per Second (haptic) |
| RTP | Real-Time Playback (haptic library term) |
| EAS | Expo Application Services (build + submit) |
| IAP | In-App Purchase |
| MERK_ANKER | Brand anchor document |

---

## Bijlage C — Operator wijzigingslogboek

Wijzigingen aan deze blueprint:

- 2026-06-18: Eerste versie. IAP-stack (iap-verify + iap-webhook), Supabase IAP-kolommen, subscription-status IAP-aware. Bracelet PPS-claim correctie ("Backed by science · Bottom-up by design"). Breath voice-cues via expo-audio. Kickstarter datum 1 sept 2026 + bundle pricing $215/$399.
- 2026-07-14: Kickstarter datum gedropt — framing verschoven naar "Fall 2026" (geen concrete datum, alle countdowns gestript uit app + website).

- **2026-05-20 (samenvatting recente iteraties, blueprint gesynct met huidige codebase):**
  - **Audio Library-tab** — grote consolidatie: aparte Library-tab weg (`(tabs)/library.tsx` verwijderd, `TabPath` union teruggebracht), Library-functionaliteit geïntegreerd in `(tabs)/index.tsx`. Nieuwe secties in-page: search-bar met Spotify-stijl autocomplete (Series / Sessions / Inspirators, per categorie max 5 + "+ N more"-teller), New/Favorites/Free navigatie-knoppen (route naar sub-pagina's, geen filter-state meer op de hub), Your Journey-card (klok-icoon → `/history`).
  - **Sub-pagina's `/library/{new,favorites,free}`** — 3 nieuwe screens, platte sessie-lijst met foto+FREE/PRO-tag+titel+series-naam, hartje-toggle (favorites), NEW-pill (new). Volgorde: favorites nieuwste-eerst via Set-insertion-order, new gesorteerd op `added` descending.
  - **Coming-page** — nieuw sub-scherm `coming.tsx` bereikbaar via 13e card op library-list én via router.push. Bevat hero + fasenregel + 2 secties (Existing Series: 11 + 4 Soundscapes = 15 rijen; New Series: 8 rijen) met pulserende dots (blauw/amber via `Animated.loop`), per-sectie accordion (één rij tegelijk open per sectie), "+ N more"-tags-toggle (default 6 zichtbaar, rest achter show-all). Data 1-op-1 uit `index_2_correct.html`.
  - **Serie-card visual** — VIEW ALL-pill rechtsboven (linear gradient overlay `[transparent, 0.1, 0.92]`), 200 hoog per bron. FOLLOW-pill verwijderd (operator-besluit: Favorites is enige gebruikers-collectie). ❤️-knop op elke sessie-rij (`useFavorites().toggle(session)`).
  - **Aankoopblok refactor** — Spotify-stijl hiërarchie: Yearly permanent visueel dominant (blauwe 2px rand + BEST VALUE-sticker + gradient bg + glow), Monthly neutraal; selectie-signaal enkel via ✓-glyph (geen dubbele-rand-verwarring meer). Dynamisch CTA-label "Get Yearly — $7.49/month" / "Get Monthly — $12.90/month". Prijzen $12.90/$7.49 (met strike $16.90/$9.92), yearly `$89.90/year`. `WebBrowser.openBrowserAsync`-primair met `Linking.openURL`-fallback op cancel/dismiss/throw voor AVD's zonder Custom-Tabs. Missiezin ingevuld. Footer: "Prices in USD · 14-day money-back" + "SECURE CHECKOUT · CANCEL ANYTIME".
  - **Guideline 3.1.2(c) compliance (subscribe.tsx paywall)** — Privacy Policy + Terms/EULA links toegevoegd in-app onder GET FULL ACCESS. Titel/duur/prijs zichtbaar bij purchase-moment.
  - **Guideline 5.1.1(v)** — nog te fixen: `subscribe.tsx` mag geen verplichte account-registratie vóór IAP-purchase eisen (open task #6).
  - **Guideline 4 Design (SIWA-knop)** — nog te fixen: Sign in with Apple-knop moet HIG-conforme styling gebruiken (open task #7).
  - **Guideline 2.1(a) SIWA-bug** — nog te fixen: error bij inloggen met Apple in review (open task #8).
  - **`useFavorites` v2** — schema `vzf_v1` (was `vibezcore:favorites` Set<url>) → `Map<url, FavEntry>` met `{url, title, series, ts}`. Per-user bucketing v44 (`vzf_{bucket}_v1`). Legacy device-migratie-flag v54 tegen cross-user data-leak (audit C4).
  - **`utils/isNew.ts`** — `NEW_DAYS` 14 → **30** dagen (operator-keuze: "New"-batches blijven maandelijkse cadans zichtbaar).
  - **Sessions data** — 9 Daily Affirmations Power-sessies teruggezet naar `added:''` (launch-batch is niet "nieuw", "New"-lijst is bij launch bewust leeg tot echte drops binnenrollen). Alle 83 sessies hebben nu een gevuld `desc`-veld (audit fix — voorheen ontbraken die op PRO-sessies).
  - **Player Back-knop fix** — `SafeAreaView edges={['top']}` op beide return-takken (paywall + gratis-player) zodat de tap-zone niet onder de Android-statusbar valt. Nieuwe `closePlayer`-helper: `router.canGoBack() ? back() : navigate('/')` zodat gebruiker nooit vastzit.
  - **Welcome-scherm** — woord "Welcome" verwijderd, accent-streep (34×3, `#3a8fff`), hoofdregel "Stop Drifting." / "Start Directing." (Inter Black 42), caps-ondertekst "CHANGE THE GAME · UNLOCK YOUR FULL POTENTIAL". 3 knoppen ongewijzigd. Achtergrondfoto ongemoeid ([OPERATOR]).
  - **Font-inheritance** — `Text.defaultProps` gepatched in root `_layout.tsx` op `Inter_400Regular` (BrandFonts.regular) zodat alle schermen Inter erven zonder per-Text expliciete `fontFamily`.
  - **Hero / BUILT ON / EXPLORE SERIES-headers** — Apple-stijl typografie: hero-titel `42/700/-0.8`, BUILT ON/EXPLORE SERIES ondersteunend `28/600/-0.5`, eyebrows met em-dashes links + rechts ("— BUILT ON —" / "— EXPLORE SERIES —"), gecentreerd + ruime padding.
  - **Disclaimer** — uitklapbaar blok onderaan Audio Library met `LayoutAnimation` (Android expliciet enabled), 5 paragrafen 1-op-1 uit bron incl. 2 sub-headers ("Educational & Informational Use Only", "No Liability"), `VIBEZCORE` 3× in hoofdletters conform harde regel.
  - **ScrollView-refs + measureLayout-fallback** — search-tap navigeert nu correct naar de gekozen serie-card via `libListY + cardY - 100`-offset (spotlight, vorige card blijft als peek zichtbaar). Auto-scroll naar zoekbalk bij activatie via `useEffect[searchActive]`. `keyboardShouldPersistTaps="handled"`.
  - **Bottom bar** — teruggebracht naar **3 tabs**: Audio Library · Bracelet · Account (Breath-tab is 4e in `_layout.tsx` maar was tijdens de Library-consolidatie momentum tijdelijk niet in de UI-flow — verifiëren of Breath actief blijft). Custom `TabButton` (plain Pressable + `router.navigate`) blijft — was fix voor `PlatformPressable`-press-passing bug in RN 0.83 + React 19 + reactCompiler.

Volgende wijzigingen: voeg een entry toe met datum + samenvatting + commit-hash.

---

## Bijlage D — Quick-Reference Card

Voor in je headerless terminal:

```
URLs
─────
App: https://app.vibezcore.com
Web: https://vibezcore.com
CDN: https://vibezcore-audio.b-cdn.net
SBE: https://zotxpyjvcamnlzwdgceh.supabase.co

Repos
─────
App:     github.com/ulgarbilican-dotcom/vibezcore-app
Backend: github.com/ulgarbilican-dotcom/vibezcore-backend

Bundle/Package
─────
iOS:     com.ubili.vibezcoreapp
Android: com.ubili.vibezcoreapp
Scheme:  vibezcoreapp://

IAP Product IDs
─────
vibezcore_audio_monthly  → €9.99 / $11.99 / £8.99
vibezcore_audio_yearly   → €69.60 / $69.99 / £59.99

Bracelet pricing (Stripe, post-KS)
─────
Bracelet:  $169 (was $299)
Bundle:    $215 (was $399, save $184)
Extra:     $32

Kickstarter
─────
Launch: Fall 2026

Brand
─────
Naam:    VIBEZCORE (altijd HOOFDLETTERS)
Font:    Inter 400/500/600/700/800/900
Accent:  #3a8fff
BG:      #0a0a0a
```

— End of Blueprint —
