# VIBEZCORE — Volledige App-architectuur

> **Doel van dit document:** een nieuwe ontwikkelaar moet na het lezen van A tot Z
> kunnen werken in de codebase. Dit beschrijft hoe alle onderdelen — native app,
> Supabase, Netlify Functions, Bunny CDN, Gumroad — daadwerkelijk samenwerken.
> Alles wat hier staat is gebaseerd op de code in deze repo, niet op aannames.
>
> **Status:** levend document, bijgewerkt 2026-06-03.
> **Aanvullende leesvereisten:** `CLAUDE.md` (harde regels), `MERK_ANKER.md`
> (uiterlijk), `VIBEZCORE_APP_VOLLEDIGE_SPEC.md` (product-spec),
> `STRUCTUUR_en_BLE_contract_v2.md` (BLE-contract v2.3),
> `ONTWERP_toegangsmodel.md` (entitlements-model).

---

## 0. Wat is de app

VIBEZCORE is een cross-platform mobiele app (iOS + Android) met **twee
gelijkwaardige productkernen**:

1. **Audio Library** — psychologische audiosessies (83 stuks, 12 series + 4
   Soundscapes-subcategorieën). Direct verkoopbaar — backend, content en
   payments bestaan al.
2. **Smart Bead Bracelet** — hardware-product (nRF52832 + DRV2605L) dat 5
   haptische modi draait. Kickstarter-launch Fall 2026; native app
   praat via BLE met het apparaat.

De native app is een **nieuwe client op een bestaande backend**. Backend
(Supabase + Netlify Functions) en bestaande webapp blijven ongewijzigd; de
native app vervangt die webapp niet en wijzigt het schema niet.

**Tone-of-voice regels (uit `CLAUDE.md`):**
- VIBEZCORE altijd in HOOFDLETTERS.
- Geen wetenschaps- of medische claims ("hersengolven", "klinisch bewezen",
  enz. zijn verboden). Alleen toestand-taal: focus / kalmte / rust.
- App toont NOOIT technische BLE-parameters (PPS, burst_ms, amplitude, RTP).

---

## 1. Tech stack

| Laag | Technologie | Versie |
|------|-------------|--------|
| Framework | React Native + Expo SDK | 55 |
| Routing | Expo Router (file-based) | ~55.0.14 |
| Audio | expo-audio (vervangt expo-av sinds 2026-05-23) | ~55.0.14 |
| React | React + React Native | 19.2.0 / 0.83.6 |
| Animaties | react-native-reanimated | 4.2.1 |
| Gestures | react-native-gesture-handler | ~2.30.0 |
| Icons | lucide-react-native | ^1.17.0 |
| Local storage | @react-native-async-storage/async-storage | — |
| Auth-backend | Supabase (via Netlify proxy) | — |
| Payments | Gumroad (via WebBrowser, geen SDK) | — |
| CDN | Bunny.net (audio + images) | — |
| Build | Expo Dev Build (geen Expo Go — native modules) | — |

**Belangrijke conventies:**
- Geen Expo Go: native module wijzigingen vereisen `npx expo run:android` /
  `npx expo run:ios`.
- **NOOIT** `npm audit fix --force` — breekt het project. 4 moderate
  vulnerabilities zijn normaal voor Expo.
- `metro.config.js` voegt `.mjs` toe aan `sourceExts` (vereist voor
  `lucide-react-native`).
- Android-package: `com.ubili.vibezcoreapp`.
- Deep-link scheme: `vibezcoreapp://` (voor auth-flow magic links).

---

## 2. Project-structuur

```
src/
├── app/                     # Expo Router file-based routes
│   ├── _layout.tsx          # Root: fonts, cold-start routing, deep-link,
│   │                        # ErrorBoundary, welcome-back popups, Stack-config
│   ├── welcome.tsx          # Niet-blokkerend welkomstscherm (gast-first)
│   ├── (tabs)/              # Tab-groep
│   │   ├── _layout.tsx      # Tabs-config + MiniPlayer mount
│   │   ├── index.tsx        # AUDIO LIBRARY (default landing)
│   │   ├── bracelet.tsx     # Bracelet-etalage + activatie-pad
│   │   └── account.tsx      # Auth, subscription, settings, legal
│   ├── bracelet-control.tsx # Bracelet sessie-control (gepusht vanuit tab)
│   ├── bracelet-history.tsx # Sessie-overzicht (gepusht vanuit control)
│   ├── player.tsx           # Audio-speler (modal)
│   ├── auth-callback.tsx    # Magic-link landing
│   ├── reset-password.tsx   # Password-recovery + setup
│   ├── forgot-password.tsx  # Email-recovery aanvraag
│   ├── change-password.tsx  # In-app password-wijziging
│   ├── support.tsx          # Contact-form
│   ├── settings.tsx         # Playback/privacy/about + dev-override-paneel
│   ├── coming.tsx           # Roadmap-pagina (route bestaat, card tijdelijk verborgen)
│   ├── about.tsx            # Brand-story
│   ├── faq.tsx              # FAQ
│   └── legal/[doc].tsx      # Dynamic route — terms/privacy/cookies/etc.
│
├── services/                # Stateful singletons + backend-praatpalen
│   ├── auth.ts              # Token-beheer, login/signup/refresh
│   ├── audio-player.ts      # Globale audio-state + expo-audio wrapper (~33KB)
│   ├── subscription-actions.ts  # cancelSubscription, gumroadManageUrl
│   ├── ble-contract.ts      # BLE packet-types + 5 MODES metadata
│   ├── bracelet.ts          # USE_SIMULATED_BLE switch + getBracelet()
│   ├── bracelet-sim.ts      # Spec-getrouwe simulator
│   ├── bracelet-upsell.ts   # Modal-singleton (post-session upsell)
│   └── welcome-popup.ts     # Cold-start audio-resume trigger
│
├── hooks/                   # React hooks
│   ├── useSubscription.ts   # PRO-status (cache + refresh + listeners)
│   ├── useFavorites.ts      # Per-user favorieten
│   └── use-theme.ts, use-color-scheme.ts  # Theme-wrappers
│
├── utils/                   # Pure utilities + lichte AsyncStorage-wrappers
│   ├── audio-url.ts         # Bunny CDN signed-URL fetch + cache
│   ├── user-bucket.ts       # Per-user data-bucket resolver (dev/JWT/anon)
│   ├── history.ts           # Audio listen-history (per-user)
│   ├── vzp.ts               # Saved playback-positions (per-user)
│   ├── last-played.ts       # Welkom-terug resume-entry (globaal)
│   ├── bracelet-history.ts  # Bracelet sessie-log (per-user)
│   ├── dev-user-override.ts # Dev-only role-simulatie
│   ├── settings.ts          # Playback-preferences
│   ├── scroll-intent.ts     # Cross-tab scroll-doel signaal
│   ├── api.ts               # apiCall() HTTP-helper met auth
│   └── ...
│
├── components/              # Presentational UI + globale singletons
│   ├── ErrorBoundary.tsx    # Class component, mounted aan root
│   ├── WelcomeBackPopup.tsx # Audio-resume bij cold-start
│   ├── WelcomeBackWarrior.tsx  # 12h+ gap motivationele begroeting
│   ├── BraceletUpsellModal.tsx # Post-session bracelet-prikkel
│   ├── MiniPlayer.tsx       # Drijvend boven tab-bar tijdens playback
│   ├── LibraryListRow.tsx   # Sessie-rij (heart-knop, FREE-badge, etc.)
│   ├── AppLogo.tsx, PlayPauseGlyph.tsx
│   └── HeartButton.tsx
│
├── constants/               # Immutables
│   ├── theme.ts             # Brand-palet + BrandFonts (Inter)
│   ├── supabase.ts          # Supabase URL + anon key
│   └── links.ts             # Externe URLs (shop, support, etc.)
│
└── data/                    # Read-only data-tabellen
    ├── audio-library-data.ts  # SESSIONS[], SERIES_ORDER, SERIES_PHOTO, ...
    ├── legal-content.ts     # 8 legal/safety-docs (Terms, Privacy, Cookies, ...)
    └── faq-content.ts       # FAQ entries
```

Voor de assets: `assets/vibezcore_wordmark.png` (header-logo),
`assets/vibezcore_icon.png` (app-icoon), `assets/welcome_bg.png`
(welkomstscherm-achtergrond). De directories `assets/bunny-upload/` en
`assets/website-content/` zijn **lokale operator-bestanden**, niet in git.

---

## 3. Cold-start + navigatie

### 3.1 Welkomstscherm-logica (`src/app/_layout.tsx`)

Bij elke app-start:

1. Fonts laden (Inter 400/500/600/700/800/900 via `@expo-google-fonts/inter`).
2. Parallel: `getToken()` (AsyncStorage `vz_session_token`),
   `hasPendingAuthDeepLink()` (cold-start via magic link?),
   `awaitDevUserOverrideLoaded()` (dev-override cache).
3. Splash-screen blijft tot alles ready is — **geen flash** van de Audio-tab
   vóór de welcome-redirect.
4. Routing-beslissing (regel 146–189, met `useRef`-guard om dubbel firen te
   voorkomen):
   - Auth-deep-link wacht? → niets doen, deep-link-handler neemt over.
   - Override = `guest` of geen token? → `router.replace('/welcome')`.
   - Override = `audio`? → blijf op tabs (default landing = Audio Library).
   - Override = `bracelet` of `pro`? → `router.replace('/bracelet')`
     (bracelet is hun primaire interactievlak).
   - Anders (echte ingelogde audio-user)? → blijf op tabs.

### 3.2 Welkomstscherm (`src/app/welcome.tsx`)

Niet-blokkerend (CLAUDE.md §3, operator-besluit 19 mei 2026). Geen poort,
geen keuze die je dwingt. Toont:
- Full-screen `welcome_bg.png` achtergrond.
- VIBEZCORE-wordmark.
- Intro-tekst (definitief, niet wijzigen):
  *"Stop being a passenger in your own life. Change the game. Unlock your
  full potential."*
- Twee even prominente knoppen: **Explore Bracelet** · **Explore Audio
  Library (listen free sessions)**.
- Subtielere regel: *"Already have a product? Sign in"* → Account-tab.

### 3.3 Tab-navigatie (`src/app/(tabs)/_layout.tsx`)

Drie tabs:
- `index` → Audio Library (icon ♪)
- `bracelet` → Bracelet etalage (icon ◎)
- `account` → Account (icon ○)

Custom `TabButton` (Pressable) i.p.v. de native navigator-button — fix voor
een React 19 + Expo Router 55 press-event miss.

### 3.4 Stack-screens (root)

Naast de tabs registreert `_layout.tsx` losse stack-screens:
`welcome`, `(tabs)`, `bracelet-control`, `bracelet-history`, `player`
(modal), `support`, `settings`, `auth-callback`, `forgot-password`,
`reset-password`, `change-password`, `legal/[doc]`, `faq`, `about`.

De `coming`-route gebruikt z'n **eigen** `<Stack.Screen options>` IN het
bestand zelf (Expo Router 55 zag een dubbele registratie als
"extraneous").

### 3.5 Globale UI-overlays (sibling van de Stack)

Direct in de root gemount, NIET als React-Native `<Modal>` (Android-issue
met touch-intercept):

- **`<ErrorBoundary>`** — class component, vangt render-errors, toont
  fallback + "Try again".
- **`<BraceletUpsellModal />`** — thin info-bar (~90px) als audio-player
  endedPanel verschijnt.
- **`<WelcomeBackPopup />`** — cold-start audio-resume (alleen als
  last-played <7 dagen oud, <95% klaar, ≥4s positie).
- **`<WelcomeBackWarrior />`** — motivationele begroeting na 12h+ afwezigheid
  (alleen ingelogd, subscription-aware copy).

### 3.6 Deep-link handler (`_layout.tsx` regel 191–240)

Scheme `vibezcoreapp://`. Bekende paden:

| Pad | Routing-doel | Wanneer |
|-----|--------------|---------|
| `auth-callback` | `/auth-callback?token_hash=…&type=…` | Magic link na Gumroad-koop, invite |
| `reset-password` | `/reset-password?token_hash=…` | Password-recovery email |
| `forgot-password` | `/forgot-password` | (Direct gebruik, geen email) |

Onbekende paden worden **bewust genegeerd** zodat rogue links de app niet
naar een verkeerde route kunnen dwingen.

---

## 4. Authenticatie

### 4.1 Architectuur — auth-proxy i.p.v. directe Supabase

De native app praat **niet** rechtstreeks met `auth/v1/token` etc. Alles
gaat via een **Netlify Function** `https://app.vibezcore.com/api/auth-proxy`.
Reden (commentaar in `src/services/auth.ts` regel 2–11): de Android-emulator
heeft DNS-routing-quirks die directe Supabase-calls onbetrouwbaar maken;
de proxy isoleert dat én geeft één uniforme error-shape.

**Uitzonderingen** die wel direct met Supabase praten (omdat de proxy de
verify-flow nog niet implementeert):
- `auth-callback.tsx` → `POST {SUPABASE_URL}/auth/v1/verify`
- `reset-password.tsx` → `POST .../verify` en `PUT .../user`
- `forgot-password.tsx` → `POST .../recover`
- `change-password.tsx` → `POST .../token?grant_type=password` (verify) en
  `PUT .../user`

Supabase-config: `src/constants/supabase.ts`.

### 4.2 Token-beheer (`src/services/auth.ts`)

**AsyncStorage keys:**
| Key | Inhoud |
|-----|--------|
| `vz_session_token` | Supabase access_token (JWT, ~1u TTL) |
| `vz_refresh_token` | Long-lived refresh token |
| `vz_token_expires_at` | Unix-seconds expiry |
| `vz_user_email` | Email van ingelogde user |
| `vz_last_login_email` | Laatst gebruikte login-email (overleeft sign-out) |

**Public API:**
```ts
login(email, password): Promise<AuthResult>
signup(email, password): Promise<AuthResult>
getToken(): Promise<string | null>      // refresh if <60s remaining
clearSession(): Promise<void>
getUserEmail(): Promise<string | null>
getLastLoginEmail(): Promise<string | null>
```

**Refresh-logica** (regel 173–215): race-safe singleton
(`refreshInFlight` Promise). `getToken()` checkt expiry op elke aanroep;
< 60s te gaan → fetch fresh. 401 → `clearSession()`. Transient fail →
sessie behouden voor volgende launch.

### 4.3 Sign-up + sign-in vanuit Account-tab

Het signed-out view in `src/app/(tabs)/account.tsx` (regel 846+) is geen
poort — guests gebruiken de hele app. Het formulier:

- **Sign in** → `POST /api/auth-proxy?action=login`.
  Errors gemapt naar leesbare strings ("Wrong email or password",
  "Confirm your email first", enz.).
- **Sign up** → `POST /api/auth-proxy?action=signup`. Als response geen
  `access_token` bevat → "Account created — please confirm your email".

Bij **succes**: `refreshSubscription()` (verse PRO-status fetch),
`refreshUserBucket()` (audio + bracelet data herladen voor nieuwe user),
50ms timeout dan `router.replace('/')`.

### 4.4 Magic-link flow (`src/app/auth-callback.tsx`)

Triggers:
- Email-link na Gumroad-koop (`type=invite` of `type=signup`).
- Recovery-email (`type=recovery`).
- Account-confirmatie.

Flow:
1. Parse `token_hash` + `type` uit deep-link query.
2. `POST {SUPABASE_URL}/auth/v1/verify` met `apikey` header.
3. Response → `{ access_token, refresh_token, user }`. Sessie persisten
   (zelfde keys als `auth.ts`).
4. Check `user.user_metadata.needs_password_setup`:
   - `true` → push `/reset-password` (user moet password kiezen).
   - `false` → push `/` (Audio Library).

### 4.5 Forgot-password (`src/app/forgot-password.tsx`)

`POST {SUPABASE_URL}/auth/v1/recover` met:
- `email`
- `redirect_to: https://app.vibezcore.com/reset-password.html`

**Belangrijk:** Supabase weigert custom-schemes (`vibezcoreapp://...`) in
email-templates uit security-overweging. Daarom wijst de recovery-email
naar de webapp-pagina; nieuwe users zonder app kunnen daar resetten, users
mét app worden via universal-link/deep-link teruggebracht.

### 4.6 Reset-password (twee modes)

- **Recovery-modus** (token_hash aanwezig): verify token → `PUT /user`
  met nieuw password + `data: { needs_password_setup: false }`.
- **Setup-modus** (geen token, vanaf auth-callback): bestaande sessie,
  alleen `PUT /user`.

In beide gevallen wordt de `needs_password_setup`-flag gewist.

### 4.7 Change-password (`src/app/change-password.tsx`)

Voor ingelogde users die hun bekende password willen veranderen (≠
forgot-flow). Twee stappen:
1. Verificatie: `POST .../token?grant_type=password` met huidig wachtwoord.
2. Wijziging: `PUT .../user` met nieuw wachtwoord.

---

## 5. Aankoopflow — Audio Library subscription

> Het volledige aankoopproces, vanaf de tap op een Subscribe-knop tot een
> ontgrendelde PRO-status in de app.

### 5.1 Triggers (waar zit de "koop"-knop?)

De koop start **altijd** vanuit het pricing-blok in `src/app/(tabs)/index.tsx`
(zoek `buyBlock`, regel ±1758). De Account-tab CTA's
("Upgrade to full library" en "Add Audio Library") leiden NIET direct naar
Gumroad — ze doen `requestScrollTo('pricing')` + `router.navigate('/')`
zodat de user via de Audio-tab kiest tussen Monthly en Yearly.

### 5.2 Gumroad-product-URLs

Hardcoded in `index.tsx` (regel 110–113):

| Plan | URL |
|------|-----|
| Monthly | `https://vibezcore.gumroad.com/l/vibezcore-monthly` |
| Yearly  | `https://vibezcore.gumroad.com/l/vibezcore-yearly`  |

Plan-state default = `yearly` (regel 495); Yearly krijgt visueel ook de
highlight in het pricing-blok.

### 5.3 Checkout openen

Via `WebBrowser.openBrowserAsync(url)`:
- Android → Chrome Custom Tab
- iOS → SFSafariViewController

User verlaat de native app dus visueel niet. Bij `cancel`/`dismiss` of een
exception valt 'ie terug op `Linking.openURL(url)` (systeembrowser).

### 5.4 Wat doet de backend tijdens de koop?

De native repo bevat de webhook-code niet (backend is off-limits), maar
uit comments en gedrag valt af te leiden:

1. Gumroad post bij geslaagde betaling een webhook naar de backend.
2. Backend creëert (of update) een Supabase user-row met:
   - subscription `tier`, `valid_until`, `will_renew`, `gumroad_subscriber_id`.
   - Bij **first-time buyer zonder bestaand account**: een nieuwe Supabase
     user met `user_metadata.needs_password_setup = true`.
3. Backend triggert Supabase om een magic-link email te sturen naar het
   Gumroad-emailadres met `vibezcoreapp://auth-callback?token_hash=...&type=invite`.

### 5.5 User komt terug in de app

**Pad A — Already-logged-in user die upgrade't:**
- User sluit de Gumroad-tab → terug in Audio Library.
- **Bekende beperking:** geen AppState-listener triggert nu
  automatisch een `refreshSubscription()`. De app ziet de upgrade pas
  bij volgende natural refresh (login/logout/password-change/cancel)
  of na cache-verloop (24u TTL).
- Workaround: navigeer naar Account-tab → trigger.

**Pad B — First-time buyer zonder account:**
- User leest de email → tap → opent native app via
  `vibezcoreapp://auth-callback?token_hash=...`.
- Deep-link handler in `_layout.tsx` routeert naar `/auth-callback`.
- `auth-callback.tsx` doet de Supabase-verify, persist sessie, ziet
  `needs_password_setup=true` → push `/reset-password`.
- User kiest een password → `PUT /user` → flag gewist → routing naar
  Audio Library.
- `useSubscription` hook fetcht `/api/subscription-status` →
  `active=true, tier='yearly', valid_until='2027-06-03', ...` → app
  ontgrendelt alle PRO-content.

### 5.6 Manage billing & cancel (`src/services/subscription-actions.ts`)

- **`gumroadManageUrl(subscriberId)`** → `https://app.gumroad.com/subscriptions/{id}/manage`.
  Direct extern openen via WebBrowser.
- **`cancelSubscription()`** → `POST /api/cancel-subscription` (auth
  required).
  Backend markeert pending-cancel, retourneert een `manage_url` voor
  definitieve bevestiging op Gumroad. Gumroad-webhook reconcilieert de
  status. App refresht subscription daarna.

---

## 6. Subscription-status (entitlements-laag)

### 6.1 De hook (`src/hooks/useSubscription.ts`)

```ts
type SubscriptionStatus = {
  active: boolean;
  tier?: 'monthly' | 'yearly';
  status?: string;
  validUntil?: string;        // ISO
  willRenew?: boolean;
  gumroadSubscriberId?: string;
};
```

Plus `isPro: boolean` afgeleid + (in `account.tsx`) gecombineerd met
`useBraceletOwner()` voor "Full PRO"-detectie.

**Cache:**
- AsyncStorage key: `vz_sub_v1`
- TTL: 24 uur (regel 30 van `useSubscription.ts`)
- Shape: `{ ...status, cachedAt: number }`

**Backend-endpoint:** `GET /api/subscription-status` met Bearer-token
(auth=true). Response-velden: `active`, `tier`, `status`, `valid_until`,
`will_renew`, `gumroad_subscriber_id`, `email`.

**Module-level subscribers** (Set<callback>): elke `<Hook>` consumer
re-rendert automatisch zodra een refresh nieuwe state heeft.

**Loading op import** (regel 230): `loadCacheOnce()` fires direct bij
module-import zodat een hot-start de cache toont vóór de eerste hook-mount.

### 6.2 Wanneer triggert refresh?

| Event | Locatie | Effect |
|-------|---------|--------|
| Hook-mount zonder cache | `useSubscription.ts` | Fetch |
| Login geslaagd | `account.tsx` onSubmit | `refreshSubscription()` |
| Logout | `account.tsx` onSignOut | `refreshSubscription()` (returns `{active:false}`) |
| Change-password | `change-password.tsx` | `refreshSubscription()` |
| Reset-password setup | `reset-password.tsx` | `refreshSubscription()` |
| Cancel-subscription | `account.tsx` onCancelSubscription | `refreshSubscription()` |
| Auth-deep-link verify | `auth-callback.tsx` | (impliciet via login/setup) |

**Wat NIET triggert:**
- App komt foreground na Gumroad-tab close → **gap**.
- Periodieke timer → bewust niet, cache-TTL handelt het af.

### 6.3 "Full PRO"-detectie

In `account.tsx` SubscriptionCard:
- `isPro && isBraceletOwner` → label `"Full PRO — Audio + Bracelet"` met
  audio-renew-datum als sub-regel.
- `isPro && !isBraceletOwner` → `"Audio PRO — {Yearly|Monthly}"`.
- `!isPro && isBraceletOwner` → `"Bracelet active"` + "Add Audio Library"-CTA.
- `!isPro && !isBraceletOwner` → `"Free account"` + "Upgrade"-CTA.

`useBraceletOwner()` leeft in `src/utils/dev-user-override.ts` — momenteel
**alleen** een dev-toggle (override = `'bracelet'` of `'pro'`). Productie
geeft `false` tot het backend `has_bracelet`-veld er is.

---

## 7. Audio-playback + Bunny CDN

### 7.1 Catalogus (`src/data/audio-library-data.ts`)

- **83 sessies** verspreid over 12 series + 4 Soundscapes-subcategorieën.
- Session-shape:
  ```ts
  {
    title: string;
    series: string;
    subseries?: string;     // alleen Soundscapes
    free: boolean;          // gratis-tier toegankelijk
    desc?: string;
    num?: number;
    url: string;            // Bunny CDN .mp3/.m4a
    added: string;          // ISO datum voor "NEW"-badge
  }
  ```
- Series-volgorde: `SERIES_ORDER[]`.
- `SERIES_PHOTO[name]` → Bunny image URL voor de cover.
- `SERIES_SUBTITLE`, `SERIES_SUB` → eyebrow + descriptor.
- `SUBCAT_INFO['Calm Clarity' | 'Rest & Reset' | 'Zen Flow' | 'Harmonic']`
  → eigen foto + eyebrow.

Alle assets staan op **`vibezcore-audio.b-cdn.net`** (Bunny CDN).

### 7.2 Signed-URL fetch (`src/utils/audio-url.ts`)

Direct afspelen van Bunny zou onbeschermd zijn. Daarom:

1. Player vraagt URL voor `session.url`.
2. `audio-url.ts` extracts pathname → cache-key `"{pathname}|{preview}"`.
3. Cache-hit binnen TTL? Direct gebruik.
4. Cache-miss? `GET /api/audio-url?path=<pathname>&preview=<bool>` met
   Bearer-token (via `apiCall()` helper in `src/utils/api.ts`).
5. Backend tekent een Bunny-URL met expiry, retourneert
   `{ url, expires_at, title }`.
6. In-memory cache opslaan (4u TTL met 5-minuten safety-margin, regel 43–48).

**Error-mapping** (regel 111–127):
- `401` → `LOGIN_REQUIRED`
- `402` → `SUBSCRIPTION_REQUIRED`
- `404` → `SESSION_NOT_FOUND`
- Anders → `SIGN_FAILED`

`clearSignedUrlCache()` wordt geroepen bij logout/user-switch zodat een
volgende user geen URLs van de vorige krijgt.

### 7.3 `preview=true` flag (gratis-preview voor gasten)

Sommige sessies zijn `free`-true (gratis sample). Voor PRO-sessies die een
gast opent, vraagt de client `preview=true`. De backend skipt dan de
JWT-check en retourneert een signed URL — de **client** dwingt vervolgens
een **60-seconde pauze** + upsell af in `audio-player.ts` (regel 343–363).

Dev-overrides `'audio'` en `'pro'` in `__DEV__` skippen de cap zodat een
tester de hele sessie kan testen.

### 7.4 De audio-player service (`src/services/audio-player.ts`, ~33KB)

**Library:** `expo-audio` (sinds 2026-05-23 — vervangt `expo-av` dat door
SDK 55 niet meer goed werkte). Singleton-pattern: module-state +
listener-set + `usePlayerState()` hook voor re-renders.

**Tijd-eenheid (breaking change):** `positionSec` + `durationSec` zijn nu
floats in **seconden** (was ms in expo-av).

**Belangrijkste API:**
```ts
loadSession(session, opts?: { autoStart?: boolean })
play(); pause(); togglePlay();
seekTo(posSec); skipBy(deltaSec);
continueFromSaved(); startOver();
setRate(rate);
```

**Resume-prompt:** bij `loadSession()` zonder `autoStart:true`:
- als saved position > 4s → toon Continue/Start over panel.
- `autoStart:true` (auto-play next) → skip prompt voor seamless flow.

**Auto-play next** (regel 434–444): als `autoPlayNext` setting aan staat
laad de volgende sessie binnen dezelfde serie met `autoStart:true`.

**Lock-screen + background** (regel 45–51, 459–490):
- `setActiveForLockScreen(true, metadata)` bij load met
  `interruptionMode: 'doNotMix'` — verplicht voor >3min Android background
  playback.
- `updateLockScreenMetadata()` op elke status-tick (4×/sec) om OS
  ID3-tag overrides te overschrijven.
- Metadata: title, artist (uit `SERIES_SUBTITLE`), albumTitle (serie),
  artworkUrl (uit `SERIES_PHOTO`).
- `expo-audio` plugin in `app.json`: `enableBackgroundPlayback: true`.
- Android: notification-permissie wordt 1× per app-lifetime gevraagd
  (regel 258–270).

**60-sec preview-cap** (regel 125, 343–363): client-side enforcement met
toggle voor dev-overrides.

**Listening-data hooks** (regel 63–71):
- `startListen(url, title, series)` bij play.
- `pauseListen()` bij pause/switch.
- `endListen()` bij `didJustFinish` (zet `full=true`).
- Tijdens playback: 10-sec periodieke writes voor `last-played`-snapshot
  (regel 316–341).

---

## 8. Lokale data + per-user bucketing

### 8.1 Het bucket-pattern (`src/utils/user-bucket.ts`)

Reden voor bestaan: een toestel kan meerdere user-types testen of zelfs
meerdere users dragen. Data mag niet lekken tussen user-types.

**Bucket-resolutie** (volgorde):

1. Dev-override actief? → `dev-{override}` (bv. `dev-pro`).
2. Echte JWT-token? → decode `sub` claim → `u-{sub}`.
3. Niets? → `anon`.

**Public API:**
```ts
resolveActiveBucket(): Promise<string>
ensureBucketLoaded(): Promise<string>      // resolves + cachet
getCurrentBucket(): string                 // sync read (default 'anon')
subscribeUserBucket(cb: () => void): () => void
refreshUserBucket(): void                  // forceer re-resolve
```

**Bucket-switch effect:** alle abonnees krijgen een `notify()`. Modules
(`history.ts`, `useFavorites.ts`, `vzp.ts`, `bracelet-history.ts`)
**wissen hun in-memory cache** en herladen uit de nieuwe bucket-key. Dat
betekent: bij sign-in/sign-out/override-change zie je direct de juiste data.

### 8.2 Welke modules zijn bucketed?

| Module | Storage key | Schema |
|--------|-------------|--------|
| `history.ts` | `vzh_{bucket}_v1` | `[{ url, title, series, ts, dur, full, fc }]` |
| `useFavorites.ts` | `vzf_{bucket}_v1` | `Map<url, { url, title, series, ts }>` |
| `vzp.ts` | `vzp_{bucket}_v1` | `Record<url, positionSec>` |
| `bracelet-history.ts` | `vzbc_sessions_{bucket}_v1` | `SessionRecord[]` (max 500) |

**Legacy migratie**: elke module probeert eenmalig de oude globale key
(`vzh_v1` etc.) te migreren naar de actieve bucket-key bij eerste load.

### 8.3 Niet-bucketed modules

| Module | Key | Reden |
|--------|-----|-------|
| `last-played.ts` | `vz_last_played_v1` | "Welkom terug"-popup, 1 entry; bij sign-out wordt 'ie expliciet gewist (`clearLastPlayed()`) |
| `settings.ts` | `vz_settings_v1` | Playback-preferences zijn device-scope, niet user-scope |
| `dev-user-override.ts` | `vz_dev_user_override_v1` | Dev-only |
| `auth.ts` token-keys | zie §4.2 | Token IS de user-identifier |

### 8.4 De 7-veld history-spec

De history-shape is een **bindend immutable contract**:
- `url, title, series, ts` — identificatie.
- `dur` — seconden geluisterd (niet cumulatief).
- `full` — boolean (fully played?).
- `fc` — re-listen count (incremented op elke nieuwe play van een
  completed sessie).

Wijzig dit schema NIET zonder een v2 migratie.

---

## 9. Bracelet (BLE-laag)

### 9.1 De 5 modi (`src/services/ble-contract.ts` regel 63–111)

| Idx | Naam | Kleur | Min–Max duur | Toestand-label |
|-----|------|-------|--------------|----------------|
| 0 | Boost | `#FFFFFF` | 8 – 15 min | Activation |
| 1 | Sharp Focus | `#FF9F0A` | 15 – 30 min | Focus |
| 2 | Calm Control | `#0A84FF` | 15 – 30 min | Calm focus |
| 3 | Clarity | `#BF5AF2` | 15 – 30 min | Reflection |
| 4 | Rest & Reset | `#4FA46B` | 25 – 45 min | Deep rest |

Kleuren waren in een eerdere iteratie #FF453A (Gamma → te agressief) en
#30D158 (Delta → te flashy) — operator-update 27 mei 2026.

**Interne firmware-laag** gebruikt nog Gamma/Beta/Alpha/Theta/Delta voor
PPS-tuning, maar dat veld (`wave`) is **niet zichtbaar voor de user**.

### 9.2 BLE-contract (spec v2.3)

**Command (App → Bracelet)** — `BleCommandPacket`:
```ts
{
  mode: 0-4,
  duration: number,        // minuten
  command: 0x01 | 0x02 | 0x03   // start | stop | status_request
}
```

**Status (Bracelet → App)** — `BleStatusPacket`:
```ts
{
  sessionActive: boolean,
  currentMode: number,
  remainingMinutes: number,
  batteryPercent: number,
  charging: boolean,
  fault: number
}
```

**Interactiemodel:** app stuurt 1 commando (mode+duration+START). Bracelet
draait daarna AUTONOOM op hardware-timers. BLE-verbindingsverlies stopt
de sessie NIET. App POLT status elke 5 sec (`POLL_MS = 5000`).

**Sessie eindigt bij** (spec §9): timer afgelopen · charging · battery
<5% · fault · STOP-commando.

**App past tijdens een sessie GEEN realtime parameters aan.**

### 9.3 Transport-abstractie (`src/services/bracelet.ts`)

```ts
USE_SIMULATED_BLE = true;       // flip naar false als RealBracelet klaar is
function getBracelet(): BraceletTransport;
function getSimHooks(): SimulatedBracelet | null;
```

`BraceletTransport`-interface (`ble-contract.ts` regel 136–145):
- `getConnectionState()` → 'disconnected' | 'scanning' | 'connecting' | 'connected'
- `connect()`, `disconnect()`
- `sendCommand(packet)`
- `requestStatus()` → `Promise<BleStatusPacket>`
- `onConnectionChange(cb)` → unsubscribe

UI/app-logica veranderen NIET bij omschakeling naar de echte
`RealBracelet` (react-native-ble-plx, zelfde interface en BLE-UUIDs).

### 9.4 Simulator (`src/services/bracelet-sim.ts`)

Spec-getrouw:
- 0.8% batterij-drain per actieve minuut.
- 0.02% drain per idle minuut.
- 2% per minuut charging.
- Charging tijdens sessie → onmiddellijk stop.
- Battery <5% → stop.
- Fault → stop.
- Battery <20% → interne amplitude-reductie (NIET zichtbaar voor app).

**Demo-hooks (alleen sim):** `simSetCharging()`, `simTriggerFault()`,
`simSetBattery()`, `simClearFault()`. Gebruikt door dev-screens om edge
cases te testen.

### 9.5 Bracelet-control screen (`src/app/bracelet-control.tsx`)

UI-states:
- **Niet verbonden** → SearchingPulse-radar (regel 754–836).
- **Fault** → reconnect + support CTA.
- **Charging** → paused state.
- **Active** → grote timer + pulsende cirkel + Stop CTA (regel 1306–1389).
- **Idle** → mode-selectie + duration-slider + Start CTA.

App toont **alleen**: modusnaam, duur, resterende tijd, batterij %, BLE-status,
Stop-knop. **GEEN** PPS / burst_ms / amplitude / RTP (spec §11.5,
expliciet geverifieerd in code-comments).

`clampDuration()` borgt min/max per modus (spec §7.1/§9 regel 7).

### 9.6 Breathwork (optioneel, regel 96–267)

5 protocollen per modus (Energizing / Triangle / Coherent / Nadi / Box).
**Opt-in, niet mandatory** — UI zegt expliciet "Optional. The bracelet
works on its own". Operator-geselecteerde durations per modus.

### 9.7 Bracelet-tab — etalage (`src/app/(tabs)/bracelet.tsx`)

Marketing-showcase voor niet-owners:
- 7-step How-it-works carousel.
- 5 Haptic Modes accordion.
- 15 gemstone editions.
- Pricing + Kickstarter launch banner (launch Fall 2026).

Owners (override `bracelet`/`pro`) krijgen direct het bedienings-pad
i.p.v. de etalage; de tab linkt door naar `/bracelet-control`.

### 9.8 Bracelet-history (`src/utils/bracelet-history.ts`)

```ts
type SessionRecord = {
  id: string;
  mode: number;
  startedAt: number;
  endedAt: number;
  durationMin: number;
  plannedMin: number;
  status: 'completed' | 'stopped' | 'fault' | ...;
  breathwork?: { protocol, name, cyclesCompleted, cyclesTarget, durationSec };
  updatedAt: string;          // ISO
  syncedAt: string | null;    // null = nog niet gesynct
};
```

Per-user bucketed (zie §8). Max 500 records. Backend-sync is **voorbereid**
(updatedAt voor last-write-wins conflict-resolution) maar de endpoints
(`POST/GET/DELETE /api/bracelet/sessions/sync`) zijn nog niet in
productie.

`useBraceletStats(forMode?)` aggregeert: today/week/total sessions+minutes,
current+best streak, mode-breakdown, last 7 dagen, breathwork-aggregaat.

---

## 10. Backend-endpoints catalogus

Alle native-app calls gaan naar `https://app.vibezcore.com/api/...`
(Netlify Functions) of (uitzonderlijk) direct naar Supabase.

| Endpoint | Method | Auth | Caller | Functie |
|----------|--------|------|--------|---------|
| `/api/auth-proxy?action=login` | POST | nee | `services/auth.ts` | Email+password login |
| `/api/auth-proxy?action=signup` | POST | nee | `services/auth.ts` | Email+password signup |
| `/api/auth-proxy?action=refresh` | POST | nee | `services/auth.ts` | Refresh access-token |
| `/api/subscription-status` | GET | ja | `hooks/useSubscription.ts` | PRO-state fetch |
| `/api/cancel-subscription` | POST | ja | `services/subscription-actions.ts` | Cancel-aanvraag |
| `/api/audio-url?path=&preview=` | GET | ja* | `utils/audio-url.ts` | Bunny signed URL |
| `/api/bracelet/sessions/sync` | POST | ja | `utils/bracelet-history.ts` | (Voorbereid) sessie-sync |
| `/api/support` | POST | nee | `app/support.tsx` | Contact-form |
| `{SUPABASE}/auth/v1/verify` | POST | apikey | `auth-callback`, `reset-password` | Token-verify |
| `{SUPABASE}/auth/v1/recover` | POST | apikey | `forgot-password` | Recovery-email |
| `{SUPABASE}/auth/v1/user` | PUT | Bearer | `reset-password`, `change-password` | Password-wijziging |
| `{SUPABASE}/auth/v1/token?grant_type=password` | POST | apikey | `change-password` | Password-verify |

(* `audio-url` met `preview=true` skipt JWT-check serverside.)

**HTTP-helper:** `src/utils/api.ts` → `apiCall(path, options)` voegt
Bearer-token toe, normaliseert JSON-parsing, unified error-shape.

---

## 11. Dev tooling

### 11.1 User-overrides (`src/utils/dev-user-override.ts`)

In `__DEV__` builds beschikbaar; in productie no-op. Persistent in
AsyncStorage `vz_dev_user_override_v1`.

| Override | Effect |
|----------|--------|
| `null` (default) | Echte user-state |
| `guest` | Forceer welcome + verberg betaalde content |
| `audio` | Audio PRO actief, geen bracelet (cold-start → Audio Library) |
| `bracelet` | Bracelet-owner, geen audio-PRO (cold-start → Bracelet) |
| `pro` | Full PRO (cold-start → Bracelet) |

**API:**
```ts
getDevUserOverride(): DevUserOverride       // sync
setDevUserOverride(value): Promise<void>
useDevUserOverride()                        // hook met re-render
useBraceletOwner(): boolean                 // bracelet | pro → true
awaitDevUserOverrideLoaded(): Promise<void> // cold-start sync-point
subscribeDevUserOverride(cb): () => void    // non-hook listener
```

Het paneel om te switchen zit in `src/app/settings.tsx`. Vanuit de
signed-out Account-view is er ook een **dev-only "Developer settings"**
shortcut zodat je zonder login kan switchen (regel 1151–1162 in
`account.tsx`).

### 11.2 Sim-hooks voor bracelet

`getSimHooks()` retourneert `SimulatedBracelet | null`. Niet-null in
sim-mode → debug-screens (kunnen battery/fault forceren) hebben toegang.

---

## 12. Brand / theme (`src/constants/theme.ts`)

```ts
export const Brand = {
  bg: '#0a0a0a',
  accent: '#3a8fff',
  accentHover: '#2a7fee',
  success: '#4ade80',
  error: '#ef4444',
  panel: '#1e1e1e',
  border: '#2a2a2a',
  text: '#f4f4f4',
  textDim: '#8a8a8a',
} as const;

export const BrandFonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;
```

**Font-loading:** `_layout.tsx` regel 90–97 laadt alle 6 gewichten via
`@expo-google-fonts/inter`. Een **default-props override** (regel 55–62)
zet `BrandFonts.regular` als default voor élke `<Text>` zodat schermen
die niets specificeren toch Inter krijgen — schermen die een ander
gewicht willen overschrijven dat via `style={BrandFonts.bold}` enz.

**Look & feel** (MERK_ANKER.md): dark, hoog contrast, witte tekst, strak,
royale spacing, blauw spaarzaam als accent, grote vette koppen (Inter
800/900).

---

## 13. Globale UI-overlays — diepere uitleg

Vier overlays zitten in root sibling-positie t.o.v. de `<Stack>` (niet
binnen een tab) zodat ze over álles heen kunnen verschijnen.

### 13.1 ErrorBoundary (`src/components/ErrorBoundary.tsx`)

Class-component met `componentDidCatch`. Toont fallback-card met:
- Foutmelding (kort).
- "Try again"-knop (force re-render via state-reset).
- Optioneel: rapport-knop (TODO).

### 13.2 WelcomeBackPopup (`src/components/WelcomeBackPopup.tsx`)

**Trigger-conditie** (via `useShowableLastPlayed()`):
- last-played entry bestaat;
- savedAt < 7 dagen oud;
- `positionSec / durationSec < 0.95`;
- `positionSec ≥ 4`.

Toont serie-cover, sessie-titel, positie, "Continue listening" / "Not
now" knoppen.

### 13.3 WelcomeBackWarrior (`src/components/WelcomeBackWarrior.tsx`)

Motivationele begroeting na 12h+ afwezigheid (alleen ingelogde users).
Subscription-aware copy. Fade-in animatie.

### 13.4 BraceletUpsellModal (`src/components/BraceletUpsellModal.tsx`)

Thin info-bar (~90px tall) die verschijnt wanneer `playerState.endedPanel`
true wordt. Visibility singleton in `src/services/bracelet-upsell.ts`.

---

## 14. Build & deploy

### 14.1 Scripts (`package.json`)

```json
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web",
  "lint": "expo lint",
  "reset-project": "node scripts/reset-project.js"
}
```

### 14.2 Expo-plugins (`app.json`)

- `expo-router` — file-based routing.
- `expo-splash-screen` — bg `#0a0a0a`, Android image.
- `expo-font` — Inter loading.
- `expo-audio` — `microphonePermission: false`,
  **`enableBackgroundPlayback: true`**, `recordAudioAndroid: false`.

### 14.3 Native modules toevoegen

Dev build (geen Expo Go). Bij toevoeging van een native module:

```
npx expo install <package>
npx expo run:android       # of run:ios
```

Voor production builds: EAS Build (config niet in deze repo zichtbaar,
operator-keuze later).

### 14.4 Bekende gotchas

- `metro.config.js` voegt `.mjs` toe aan `sourceExts` — niet verwijderen
  (lucide-react-native crash anders).
- `expo-audio` migratie heeft positionMs → positionSec breakage — kijk
  uit met externe code die nog ms verwacht.
- Default font-props injectie kan zorgen dat externe libraries hun
  eigen fonts verliezen — schermen die niet-Inter gebruiken moeten
  `fontFamily` expliciet zetten.

---

## 15. Bekende gaps & TODO's

Een nieuwe developer moet deze openstaande punten kennen:

1. **Geen subscription-refresh na Gumroad-tab close.** Already-logged-in
   users die upgrade'n zien hun nieuwe PRO-status pas na een natural
   trigger of na 24u cache-verloop. Fix: AppState-listener in
   `useSubscription` die op `'active'` één refresh firet wanneer de
   user kort daarvoor `openExternal(gumroadCheckoutUrl)` deed.

2. **`useBraceletOwner()` is dev-only.** Productie geeft `false` tot het
   backend `has_bracelet`-veld toevoegt aan `/api/subscription-status`.
   Tot dan kunnen echte bracelet-kopers hun bracelet-rechten alleen via
   dev-override testen.

3. **Bracelet sessie-sync backend nog niet live.** `bracelet-history.ts`
   is voorbereid op `POST /api/bracelet/sessions/sync` (last-write-wins
   via `updatedAt`), endpoint zelf bestaat nog niet. History is dus
   100% local-only — bij uninstall is alle session-data weg.

4. **Activatiecode-flow (bracelet) niet geïmplementeerd.** Spec
   (ONTWERP_toegangsmodel.md) beschrijft QR + leesbare fallback-code; UI
   en endpoint zijn nog niet ontwikkeld.

5. **Privacy-policy zegt "we use cookies to analyze"** (regel 372 van
   `legal-content.ts`) — botst met de Cookie Policy die zegt dat de
   native app geen non-essential cookies gebruikt. Webapp-erfenis. Door
   operator te laten herschrijven.

6. **6 operator-beslissingen open** in `ONTWERP_toegangsmodel.md` sectie
   7 — niet zelfstandig invullen.

7. **`coming`-card tijdelijk verborgen** in Audio Library
   (`src/app/(tabs)/index.tsx`). JSX zit inline uitgecomment voor
   eenvoudige re-enable. `/coming`-route + page blijven actief.

8. **Real `RealBracelet`-implementatie** ontbreekt. Wanneer firmware
   klaar is: nieuwe `RealBracelet`-class die `BraceletTransport`
   implementeert (react-native-ble-plx), `USE_SIMULATED_BLE = false`,
   klaar. App-laag verandert niet.

---

## 16. Snelle referentie — waar zit wat?

| Vraag | Antwoord |
|-------|----------|
| Welke screens bestaan? | `src/app/**.tsx` + `src/app/(tabs)/*.tsx` |
| Hoe log ik een user in? | `services/auth.ts` → `login(email, pw)` |
| Hoe weet ik of een user PRO is? | `useSubscription().isPro` |
| Hoe speel ik een sessie? | `services/audio-player.ts` → `loadSession(s)` + `play()` |
| Hoe stuur ik de bracelet aan? | `services/bracelet.ts` → `getBracelet().sendCommand({...})` |
| Welke kleuren mag ik gebruiken? | `Brand` uit `constants/theme.ts` |
| Welke fonts? | `BrandFonts` uit `constants/theme.ts` |
| Welk API-endpoint voor X? | Zie §10 endpoint-catalogus |
| Hoe test ik een user-type? | Dev-override in `settings.tsx` (zie §11) |
| Welke AsyncStorage-keys? | Zie §4.2 (auth), §6.1 (sub), §8 (per-user data) |
| Hoe verberg ik een tab voor user-type X? | Conditional render in `(tabs)/_layout.tsx` of binnen het screen zelf via `useBraceletOwner()` / `useSubscription().isPro` |

---

## 17. Glossarium

- **Bucket** — per-user storage-namespace, bv. `dev-pro` of `u-<uuid>`.
- **Entitlement** — recht-op-content (audio-PRO of bracelet-ownership).
- **Free / PRO / Full PRO** — gast / audio-subscriber / audio + bracelet.
- **Magic link** — Supabase-email met one-time token om in te loggen
  zonder password (Gumroad first-time-buyer flow).
- **Preview** — gratis 60-seconde sample van een PRO-sessie voor gasten.
- **Sim / Real** — `SimulatedBracelet` vs (toekomstige) `RealBracelet`.
- **VIBEZCORE** — altijd in HOOFDLETTERS (CLAUDE.md harde regel).

---

*Einde document. Voor product-spec details: `VIBEZCORE_APP_VOLLEDIGE_SPEC.md`.
Voor BLE-contract: `STRUCTUUR_en_BLE_contract_v2.md`. Voor toegangsmodel:
`ONTWERP_toegangsmodel.md`. Voor uiterlijk: `MERK_ANKER.md`. Voor harde
projectregels: `CLAUDE.md`.*
