# VIBEZCORE — Complete Blueprint (A tot Z)

> Versie 3 november 2026. Vervangt de blueprint van 24 oktober 2026 en de Word-blueprint van 26 juni 2026.
> Geschreven zodat een nieuwe ontwikkelaar of een nieuwe Claude-sessie de app kan overnemen zonder vragen.
> Alles is nagekeken tegen de code op branch `rollback-vc76-take2` (laatste commits rond `656f54f1`).
> **Deze versie bevat géén wachtwoorden of sleutels** — enkel waar ze staan. De privé-Word-versie in OneDrive heeft een extra bijlage met de waarden.

---

## Deel 0 — Snel overzicht

### 0.1 Wat VIBEZCORE is

Een app voor iPhone, Android, Apple Watch en Galaxy Watch (Wear OS) met drie kernen:

| Kern | Wat | Waar in de app |
|---|---|---|
| **State Control** | Een haptisch ritme (hartslag-"lub-dub") dat van je rusthartslag naar het tempo van een toestand glijdt: Boost, Sharp Focus, Calm Control, Clarity & Relax, Sleep | Tab State Control, telefoon + horloge |
| **Breathwork** | Begeleide ademsessies (15 technieken) met stem, beeld en trilling | Tab Breath, telefoon + horloge |
| **Audio Library** | Persoonlijke-ontwikkelingsaudio in 4 pijlers (Psychological Resilience, Inner Sovereignty, Social Mastery, Strategic Execution & Wealth) | Tab Library |

Plus de **Smart Bead Bracelet** (eigen hardware, "Launching Early 2027") als upgrade; in de app nu nog gesimuleerd.

Verdienmodel: gratis = 10 audiosessies + kennismaking; **Premium** via de stores (RevenueCat): dag €1,29 · maand €9,99 · jaar €69,99.

### 0.2 Waar staat wat (zoekgids)

| Je zoekt… | Plek |
|---|---|
| De code van de app | `C:\Users\ulgar\vibezcore-app` (GitHub: ulgarbilican-dotcom/vibezcore-app, branch `rollback-vc76-take2`) |
| De code van de backend | `C:\Users\ulgar\vibezcore-backend` (NOOIT wijzigen zonder toestemming) |
| Builds om te uploaden (.aab) | `C:\Users\ulgar\vibezcore-app\release-android` |
| Jouw bestanden (beelden, audio, store-materiaal, Word) | `OneDrive › Bureaublad › Vibezcore native app` — opgeruimd op 3 nov 2026 in: `01 Store-materiaal` · `02 Website` · `03 Audio` · `04 Bracelet en hardware` · `05 Sleutels en codes` · `06 Regels` (ook huisstijl) · `07 Beelden en marketing` · `08 Strategie en plannen` · `09 Eli and Bens - Stones and Sterling` · `99 Archief` (verouderd, o.a. oude Expo-app en webapp). Bestandsnamen in Deel E staan nu in die submappen; tekstbestanden (.md/scripts) zijn omgezet naar .docx, originelen in `99 Archief › originele tekstbestanden`. |
| Bracelet: firmware, schema, stuklijst, PCBWay | `Vibezcore native app › 04 Bracelet en hardware › pcb alle documenten` (firmware = `vibezcore-firmware-correct.zip`) |
| Back-up van alles (sleutels, geheugen, broncode-zip) | `OneDrive › Documenten › VIBEZCORE-archief` (automatisch na elke Claude-beurt; broncode in `broncode\`) |
| Waar het werk NU staat | `docs/WERKSTATUS.md` |
| Harde regels | `CLAUDE.md` |
| Alle wetenschap/tempo's | `docs/VIBEZCORE_SCIENCE_A_TOT_Z.md` |
| UI-regels | `docs/UI_EN_BEWEGINGSREGELS.md`, `docs/MERK_ANKER.md` |
| Testlogboek | `docs/TEST_LOG.md` |

### 0.3 Stand op 3 november 2026

| Onderdeel | Stand |
|---|---|
| Android (Google Play) | Productie = versie van 20 juli 2026. Android 113 + Wear 26110314 bij interne testers. Verklaring voorgrondservices ter beoordeling. |
| iOS (App Store) | 1.0 (build 89) + maand, jaar, dagpas ingediend, "Waiting for Review". |
| Betalingen | Google: bank BE …4695, 15 %-programma ingeschreven. Apple: Paid Apps-overeenkomst, bank (Wise) en W-8BEN actief; Small Business Program aangevraagd. |
| Volgende stap | Na goedkeuring Google → 113 + Wear naar productie. Na goedkeuring Apple → iOS 1.0.1 met discrete Apple Watch-dimstand. |

### 0.4 Hoe dit document is opgebouwd

- **Deel A** — App-architectuur, navigatie en schermen
- **Deel B** — Toegang, betalen, accounts en backend
- **Deel C** — Sessie-motoren: Breathwork, State Control, haptiek, audio
- **Deel D** — Horloges, bracelet, builds, releases en beheer
- **Deel E** — Documenten en bestanden buiten de code (OneDrive)
- **Bijlage F** — Open punten en bevindingen uit deze controle

---

## Deel A — App-architectuur, navigatie en schermen

> Stand: 3 november 2026, branch `rollback-vc76-take2`. Alles hieronder is nagekeken tegen de code in de repo
> (`C:\Users\ulgar\vibezcore-app`). Paden zijn relatief aan de repo-root. Geen geheime waarden in dit document:
> enkel *waar* iets staat.
>
> Bindende regels staan in `CLAUDE.md`, `docs/UI_EN_BEWEGINGSREGELS.md`, `docs/MERK_ANKER.md`. Waar de code afwijkt van
> wat `CLAUDE.md` beschrijft, staat dat hieronder expliciet gemarkeerd met **⚠ Afwijking**. De oude
> `docs/VIBEZCORE_BLUEPRINT.md` (24 okt) is verouderd; gebruik dit deel in de plaats.

---

### A.0 In één alinea

VIBEZCORE is één Expo-app (SDK 55, Expo Router, **dev build**, geen Expo Go) voor iOS + Android, met een Wear OS-companion
(`wear-app/`, Kotlin) en een Apple Watch-target (`targets/watch/`, Swift). De app opent (eerste keer) op een algemene
uitleg (`/intro`) → welkomstscherm (`/welcome`) → een tabgroep met **5 tabbladen**: State Control, Breath, Library,
Activity, Profile. Alles is gast-first: niets zit achter een login, behalve volledige Premium-inhoud. Ingelogde gebruikers
(en wie Premium kocht zonder account) slaan intro/welkom over en openen op het laatst gebruikte tabblad. Breathwork-sessies
leven als **laag boven de hele app** (minimaliseerbaar), State Control-sessies leven **in de State Control-tab**, de
audiospeler is een **modale route** met een mini-speler boven de tabbalk. Lokale opslag = AsyncStorage (per-gebruiker
"buckets"), met stille Backup & Sync naar Supabase voor ingelogde gebruikers.

---

### A.1 Tech stack

#### A.1.1 Kern (uit `package.json` / `app.json`)

| Onderdeel | Versie / waarde | Opmerking |
|---|---|---|
| `expo` | `~55.0.24` | SDK 55 |
| `react-native` | `0.83.6` | gepatcht (zie A.1.4) |
| `react` / `react-dom` | `19.2.0` | React 19 → `Text.defaultProps` werkt niet meer (zie patch) |
| `expo-router` | `~55.0.14` | file-based routing, `experiments.typedRoutes: true` |
| `react-native-reanimated` | `4.2.1` | + `react-native-worklets` `0.7.4` (gepatcht) |
| `react-native-screens` / `safe-area-context` / `gesture-handler` | `~4.23.0` / `~5.6.2` / `~2.30.0` | |
| `@react-navigation/bottom-tabs` / `native` / `elements` | `^7.15.5` / `^7.1.33` / `^2.9.10` | tabbalk is custom (zie A.3.4) |
| TypeScript | `~5.9.2`, `strict: true` | alias `@/*` → `src/*`, `@/assets/*` → `assets/*` (`tsconfig.json`) |
| Tests | `jest ~29.7`, preset `jest-expo` | tests in `__tests__/**/*.test.ts(x)`, setup `__tests__/setup.ts` |
| `experiments.reactCompiler` | `false` | bewust uit |
| `runtimeVersion.policy` | `appVersion` | OTA via `expo-updates` (`updates.url` in `app.json`) — **nooit** `eas update` naar channel `production` (geheugenregel) |
| `newArch` | Fabric (default SDK 55) | meerdere code-comments verwijzen naar Fabric-gedrag (bv. `collapsable={false}` in root) |

#### A.1.2 Belangrijkste bibliotheken

| Domein | Pakketten |
|---|---|
| Audio | `expo-audio ~55.0.14` (gepatcht + `buildFromSource`), `expo-speech` |
| Haptiek | `expo-haptics` + eigen native module `modules/state-haptics` (Android) |
| Glas / beeld | `expo-blur` (echte `BlurView`/`BlurTargetView`), `expo-glass-effect`, `expo-linear-gradient`, `expo-image`, `@shopify/react-native-skia 2.4.18`, `react-native-svg 15.15.3`, `expo-gl` + `expo-three` + `three` |
| Iconen | `lucide-react-native` (dunne lijn-iconen), `expo-symbols` |
| Camera (rusthartslag "Match your rhythm") | `react-native-vision-camera 5.2.3` + `-worklets`, `react-native-nitro-image`, `react-native-nitro-modules` |
| Betalen | `react-native-purchases ^10.4.0` (RevenueCat). In `__DEV__` draait een mock (`src/services/iap.ts`: `USE_MOCK_IAP = __DEV__`) |
| Auth | `@react-native-google-signin/google-signin`, `expo-apple-authentication`, eigen Supabase-REST in `src/services/auth.ts` |
| Meldingen | `expo-notifications` (handler in root-layout), `expo-localization` |
| Crash-rapportage | `@sentry/react-native ~7.11.0` (init in `src/services/crash-reporting.ts`, niet in `__DEV__`) |
| Overig | `expo-keep-awake`, `expo-battery`, `expo-device`, `expo-navigation-bar`, `expo-system-ui`, `expo-web-browser`, `@react-native-community/datetimepicker`, `react-native-keyboard-aware-scroll-view` |
| Apple-targets | `@bacons/apple-targets ^5.0.0` (devDependency) → `targets/watch` en `targets/live-activity` |

`overrides`: `expo-asset ~55.0.17`.

#### A.1.3 Eigen native modules (`modules/`)

Elk is een lokale Expo-module (`expo-module.config.json` + `index.ts`); de JS-kant valt stil terug (no-op) als de module op
dat platform niet bestaat.

| Module | Platform | Doel |
|---|---|---|
| `audio-route` | iOS + Android | Gaat het geluid naar koptelefoon/oortjes of speaker? (kiest koptelefoon- vs speakerversie van hartslaggeluid) |
| `breath-background` | iOS + Android | Fase-lus van de ademsessie BUITEN de JS-thread (Android Doze bevriest JS bij vergrendeld scherm). Android: foreground service `BreathSessionService` (mediaPlayback); heeft eigen config-plugin `modules/breath-background/plugin.js` |
| `live-activity` | iOS | Live Activity / Dynamic Island voor een lopende sessie (Swift-target in `targets/live-activity/`) |
| `session-audio` | iOS | Eén geluidsmotor voor sessies (hartslag, stemzinnen, tikken) op de geluidsklok |
| `state-haptics` | Android | Native State Control-hapticspeler (+ Health Connect-rationale-intent, momenteel uitgeschakeld) |
| `watch-breath` | iOS | WatchConnectivity-brug naar de Apple Watch (tweerichting: Pause/Resume/Stop terug) |
| `wear-breath` | Android | Wearable Data Layer-brug naar Wear OS |

#### A.1.4 Patches (`patches/`, toegepast via `postinstall: patch-package`)

| Patch | Wat & waarom |
|---|---|
| `expo-audio+55.0.14.patch` | Wijzigt `AudioControlsService.kt`: zet titel/artiest/album + **artwork-URI op de Media3-mediasessie zelf**. Zonder dit kreeg het vergrendelscherm enkel het kleine notificatie-icoon (~64 px) → pixelige hoes op Samsung. (3 nov 2026, commit `16b5e262`.) |
| `react-native+0.83.6.patch` | `Libraries/Text/Text.js`: **Inter is de standaardfont** van elke `<Text>` zonder eigen `fontFamily` (React 19 negeert `defaultProps`), `fontWeight` zonder family → juist Inter-gewicht, en **systeem-tekstgrootte begrensd tot 1,3×** (eigen `maxFontSizeMultiplier` wint). |
| `react-native-worklets+0.7.4.patch` | `RNWorklets.podspec`: intern C++-hulpbestand niet publiek exporteren (iOS-build-fix, 15 okt 2026). |

**`package.json` → `expo.autolinking.android.buildFromSource: ["expo-audio"]`**: Expo levert modules standaard als
voorgecompileerde Android-AAR; dan zou de Kotlin-patch hierboven genegeerd worden. Deze regel dwingt Gradle expo-audio uit
bron te bouwen zodat de patch meekomt. Weghalen = vergrendelscherm-artwork weer pixelig.

#### A.1.5 Config-plugins (`app.json` → `plugins`)

Volgorde zoals in `app.json`:

| Plugin | Doel |
|---|---|
| `expo-router` | routing |
| `expo-splash-screen` | zwart opstartscherm (`assets/splash_blank.png`, bg `#0a0a0a`) — de V-animatie doet `LaunchReveal` in JS |
| `expo-font` | |
| `expo-audio` | microfoon uit, background playback aan |
| `@react-native-google-signin/google-signin` | iOS URL-scheme (waarde in `app.json`) |
| `expo-apple-authentication` | Sign in with Apple |
| `expo-build-properties` | iOS extraPods (GoogleUtilities, RecaptchaInterop modular headers), Android `minSdkVersion 26` |
| `./plugins/withoutReleaseLint` | slaat `lintVitalRelease` over (kostte ±40 min per build) |
| `./plugins/withPhoneOnlyWindow` | Android: `resizeableActivity=false` + `max_aspect 2.4` → telefoonvenster op tablets/foldables |
| `@react-native-community/datetimepicker` | |
| `./plugins/withQuickShortcuts` | Android-snelkoppelingen onder het app-icoon als gewone deeplinks (zie A.3.6) |
| `./modules/breath-background/plugin.js` | manifest: `BreathSessionService` + permissies |
| `./plugins/withWearApp` | kopieert `wear-app/` → `android/wear` en haakt het in `settings.gradle`/`app/build.gradle` |
| `./plugins/withPulseCamera` | camera-uitleg (iOS) / CAMERA-permissie zonder `required` hardware (Android) |
| `expo-navigation-bar` | transparante Android-navigatiebalk, lichte knoppen |
| `expo-notifications` | icoon `assets/notification_icon.png`, kleur `#00A3A3` |
| `expo-localization` | |
| `@bacons/apple-targets` | bouwt `targets/watch` + `targets/live-activity` tot Xcode-targets bij prebuild |
| `@sentry/react-native` | org/project in `app.json` |

Overige `app.json`-feiten: `scheme: "vibezcoreapp"`, `userInterfaceStyle: "dark"`, `orientation: portrait`,
iOS `bundleIdentifier`/Android `package` = `com.ubili.vibezcoreapp`, `supportsTablet: false`, iOS `UIBackgroundModes:
["audio"]`, HealthKit-entitlement aan (enkel om een Mind & Body-workout op de Watch te starten), privacy-manifest ingevuld.
Android `blockedPermissions` blokkeert o.a. `RECORD_AUDIO`, opslag, `SYSTEM_ALERT_WINDOW` en Health-permissies.
`extra` bevat de EAS projectId, Google client-IDs en de **publieke** RevenueCat SDK-sleutels (per platform) — waarden niet
hier herhalen. Build-profielen: `eas.json` (`development`, `simulator`, `preview` (APK), `production` (AAB, autoIncrement,
`appVersionSource: remote`), `e2e-test`).

#### A.1.6 Lokale build-quirks

- `react-native.config.js` sluit `react-native-iap` en `react-native-nitro-modules` uit van autolinking voor lokale builds
  (oude IAP-reden). **⚠ Aandachtspunt:** `react-native-iap` staat niet meer in `package.json` (vervangen door RevenueCat),
  terwijl `react-native-vision-camera 5` en `react-native-nitro-image` wél op nitro-modules steunen. Bij problemen met de
  camerameting in een lokale build: eerst dit bestand nakijken.
- `metro.config.js` `blockList`: sluit Gradle/CMake-buildmappen uit (Windows EMFILE-crash van Metro).
- `android/` en `ios/` zijn **prebuild-output en staan in `.gitignore`** (`/android`, `/ios`). Handwerk daarin verdwijnt bij
  de volgende prebuild → alle native wijzigingen gaan via config-plugins, `modules/`, `wear-app/` of `targets/`.
  `ios/` bestaat lokaal niet (Windows): iOS wordt enkel via EAS-cloud gebouwd.
- Na het toevoegen van een native module: rebuild (`npx expo run:android`), geen Fast Refresh.

---

### A.2 Repository-indeling

#### A.2.1 Top-level

| Map / bestand | Inhoud |
|---|---|
| `src/app/` | Alle routes (Expo Router). Zie A.4. |
| `src/components/` | ±115 herbruikbare componenten (hosts, glas, sheets, pacers, kiezers, kaarten). |
| `src/services/` | Stateful singletons/side-effects: audio-player, auth, iap, bracelet (BLE-contract + simulator), breath-session-host, reminders, cloud-sync, watch-catalog, health-sync (uit), crash-reporting… |
| `src/utils/` | Pure/lichte helpers + kleine stores (settings, history, plan-store, last-tab, onboarding-gate, state-control-ui, safe-area, tab-bar-inset…). |
| `src/hooks/` | `useSubscription`, `useIAP`, `useFavorites`, `useAppTheme`, `useBackTo`, `useStartStateControl`, `useBreathFreeStart`, `useStateFreeStart`. |
| `src/data/` | Statische inhoud: `breath-states.ts` (bron van waarheid voor de 5 toestanden + kleuren), `breathwork-modes.ts`, `audio-library-data.ts`, `soundscapes.ts`, `faq-content.ts`, `legal-content.ts`, `goals.ts`/`goal-states.ts`, `guidance.ts`, `daypart-photos.ts`, `voice-cue-timing.ts`, `train-the-mind.ts`, `normalized-audio.ts`, `state-usage.ts`, `state-zones.ts`, `plan-horizon-options.ts`. |
| `src/constants/` | `theme.ts` (kleuren/fonts/typeschaal/CTA), `motion.ts` (veren/reveal), `features.ts` (feature-schakelaars), `supabase.ts` (URL + publieke sleutel), `links.ts`, `bundled-images.ts`, `free-session-copy.ts`. |
| `src/global.css` | enkel voor web (template). |
| `modules/` | Eigen native Expo-modules (A.1.3). |
| `plugins/` | Eigen config-plugins (A.1.5). |
| `patches/` | patch-package-patches (A.1.4). |
| `wear-app/` | **Bron** van de Wear OS-app (Kotlin, `build.gradle`, `src/main/...`). |
| `android/wear/` | Kopie van `wear-app/`, gemaakt door `plugins/withWearApp.js`. Staat (uitzonderlijk, force-added) wél in git hoewel `/android` genegeerd wordt. **Altijd in `wear-app/` wijzigen**; prebuild overschrijft `android/wear/src`. |
| `android/app` | prebuild-gegenereerd, niet in git. |
| `targets/watch/` | Apple Watch-app (SwiftUI: `VibezcoreWatchApp.swift`, `HomeView`, `ContentView`, `BreathSessionController`, `StateSessionController`, `RuntimeSessionManager`, `PhoneConnector`, `WatchCatalog`, `Info.plist`, `expo-target.config.js`). |
| `targets/live-activity/` | `VibezLiveActivity.swift` + `_shared/VibezToggleSessionIntent.swift`. |
| `assets/` | iconen (`assets/icon/`), wordmark/icoon-png's, `welcome_bg.png`, hartslag-wav's (koptelefoon/speaker, lub/dub), `confirm-ping.wav`, `silence.wav`, `intro/`, `how/`, `watch-art/`, splash. `assets/bunny-upload/` en `assets/website-content/` zijn lokaal en genegeerd. |
| `__tests__/` | Jest: `access/` (tiers, free-session, onboarding-gate, IAP-producten, nudges), `content/` (**verboden claims, merknaam in hoofdletters, koppen zonder punt, pijlers, modusnamen**), `rhythm/` (ademniveaus, technieken, modustabel, State Control-ritme) + losse tests (cloud-sync, plan-times, favorites…). |
| `docs/` | Projectdocumentatie (WERKSTATUS, TEST_LOG, SPEC, MERK_ANKER, UI_EN_BEWEGINGSREGELS, SCIENCE_A_TOT_Z, BLE-contract, store-teksten…), `docs/backend/` (SQL-migraties + referentie-endpoints, **niet** de backend zelf). `docs/OPERATOR_HANDOVER.md` en `docs/handover-word/*.docx` zijn gitignored (bevatten credentials). |
| `scripts/` | Test-/QA-scripts (`flow-walk.py`, `qa-all.py`, `device-matrix.sh`, `testlab*.sh`, `build-test-apk.sh`), `backup-to-onedrive.sh` (Stop-hook), generators voor website-legal/subscribe. |
| `website/`, `store-screenshots/` | Marketing-/store-materiaal (niet de app). |
| `secrets/`, `credentials/`, `credentials.json`, `*.jks`, `*.p8`, `.env*.local` | **Gitignored**. Nooit committen. |
| Root-ruis | Talloze `*.png`, `*.mp4`, `ui*.xml`, `*.log` in de root zijn testscreenshots/dumps van eerdere sessies (grotendeels gitignored via `/*.png`, `/*.mp4`). Geen onderdeel van de app. |

#### A.2.2 Ongebruikte/legacy bestanden (bewust te weten)

- Expo-template-resten zonder import in de app: `src/components/app-tabs.tsx` (+ `.web.tsx`), `external-link.tsx`,
  `web-badge.tsx`, `animated-icon*.tsx`, `hint-row.tsx`, `ui/collapsible.tsx`, `themed-text.tsx`/`themed-view.tsx`
  (enkel onderling gebruikt). `Colors`/`Fonts`/`Spacing`/`BottomTabInset` in `theme.ts` zijn ook template-erfenis.
- `src/app/breath-quiz.tsx`: geen actieve ingang meer gevonden (enkel nog vermeld in comments).
- `src/app/breath-pacer-preview.tsx`: dev-testscherm zonder ingang.
- `src/app/breath-splat.tsx`: prototype, enkel bereikbaar via de dev-sectie van Settings.
- CLAUDE.md §2 noemt `src/app/index.tsx` en `src/app/explore.tsx` als te verwijderen demo's: **die bestaan niet meer**.
  Enkel `src/app/(tabs)/index.tsx` (Audio Library) bestaat, en moet blijven.
- `plugins/withWatchApp.js` wordt in een comment genoemd maar bestaat niet; de Apple Watch loopt via `@bacons/apple-targets`.
- Comments in `(tabs)/bracelet.tsx` verwijzen naar `src/app/smart-bead-bracelet.tsx`; dat scherm bestaat niet meer. De
  bracelet-etalage is nu de website (`BRACELET_WEBSITE_URL` in `src/services/bracelet-upsell.ts`, geopend via
  `openBraceletWebsite()`).

---

### A.3 Navigatie

#### A.3.1 Routeboom (Expo Router)

```
src/app/
├── _layout.tsx                 ← Root Stack + alle globale hosts/overlays
├── intro.tsx                   ← 1e keer: algemene uitleg (5 schermen)
├── welcome.tsx                 ← welkomstscherm (gasten / uitgelogd)
├── (tabs)/
│   ├── _layout.tsx             ← Tabs (custom tabBar, 5 tabs)
│   ├── bracelet.tsx            ← tab "State Control" (rendert BraceletControl)
│   ├── breath.tsx              ← tab "Breath" (Choose your mode)
│   ├── index.tsx               ← tab "Library" (Audio Library, route "/")
│   ├── activity.tsx            ← tab "Activity"
│   └── account.tsx             ← tab "Profile"
├── library/{free,new,favorites}.tsx, library/pillar/[key].tsx
├── legal/[doc].tsx
└── … ±45 losse stack-schermen (zie A.4)
```

#### A.3.2 Root-layout (`src/app/_layout.tsx`) — opstartvolgorde

1. **Module-niveau** (vóór render): `initCrashReporting()`, `SplashScreen.preventAutoHideAsync()`, `startCloudSync()`,
   `startAccessNotificationTaps()`, `Notifications.setNotificationHandler(...)` (geen banner voor `bracelet-session` /
   `bracelet-done`-meldingen, nooit geluid/badge), Android navigatiebalk-stijl bij foreground.
2. **Fonts**: `useBrandFonts()` laadt Inter 400–900. Op iOS met "Vette tekst" aan schuift elk gewicht één stap zwaarder
   (zelfde naam, ander bestand). Faalt het laden → toch openen met systeemfont.
3. **Parallel ophalen**: `clearSessionIfBuildChanged()` (eerst), dan `getToken()`, `hasPendingAuthDeepLink()`,
   `getLastTabRoute()`, `REFRESH_KEY`, `GUEST_PURCHASE_RC_ID_KEY`, dev-override. Ook `tappedReminderOnLaunch()`.
4. `ready` = fonts + auth + deeplink-check + reminder-check. Tot dan: lege donkere `View` (splash erboven).
5. **Eén keer per mount** (`welcomeRedirectFiredRef`) de opstartbeslissing:

| Situatie | Bestemming |
|---|---|
| App geopend door tik op herinnering | `router.replace(reminderRoute(t))` met `from: 'reminder'` |
| Gast/uitgelogd, geen auth-deeplink, `appIntroSeenAt` leeg | `/intro` |
| Gast/uitgelogd, intro al gezien | `/welcome` |
| Ingelogd (`token` of `REFRESH_KEY`) **of** gast-Premium-koper (`GUEST_PURCHASE_RC_ID_KEY`) | `router.replace(lastTabRoute)` (standaard `/breath`) |
| Openstaande auth-deeplink of snelkoppeling | geen redirect; de deeplink-handler neemt over |
| Dev-override `bracelet`/`pro` zonder sessie (enkel dev) | `/bracelet` |

   Daarna `markBootDecided()` (`src/utils/boot.ts`) en na 350 ms `revealApp()` (`LaunchReveal` — V-logo-animatie die
   uitloopt in het woordmerk, enkel bij koude start).
   Achtergrond: Expo Router monteert technisch altijd eerst `/` (de Library); die rendert niets tot `bootDecided()`
   (hook `useBootDecided`), anders flitst de Library-intro.
6. Na `ready`: IAP-herstel (`iapRecoverOnStartup`), herinneringen opnieuw plannen (`syncReminders`,
   `resyncAllPlanReminders`), RevenueCat `init` + `linkRevenueCatUser` + `addCustomerInfoUpdateListener`
   (→ `refreshSubscription()` via `setTimeout(…,0)`), offline-assets cachen (`cacheAssets(OFFLINE_ASSETS)`),
   stem-instelling doorzetten naar breath-/bracelet-voice.
7. **AppState → active**: plan-herinneringen op nieuwe dag opnieuw zetten, `refreshAfterStoreChange()`
   (RevenueCat-cache leeg + abonnement verversen), `retryPendingRcLink()`.

**Render-boom van de root** (volgorde is functioneel belangrijk):

```
<ErrorBoundary>
  <View bg=#0a0a0a>
    <StatusBar light/> <BottomSystemScrim/> <QaProbe/>
    <BlurTargetView ref={rootBlurRef} collapsable={false}>   ← alles wat glas mag vervagen
      <Stack …screens/>
      <BraceletUpsellModal/> <AccountWallModal/> <WelcomeBackPopup/>
      <BreathSessionHost/> <BreathMiniControl/>               ← ademsessie-laag
    </BlurTargetView>
    <GlassSheetHost/> <SoundTimingHost/> <VibezAlertHost/>    ← BUITEN de target (vervagen de app)
    <ConfirmMomentHost/> <SalesNudgeHost/> <PlanOfferHost/>
    <LaunchReveal/>
  </View>
</ErrorBoundary>
```

`collapsable={false}` op de `BlurTargetView` is verplicht (iOS/Fabric vlakte hem anders weg → sheets openden onzichtbaar
achter de sessielaag).

**Stack-opties** (globaal): Android-animatie `ios_from_right`, iOS `default` met `fullScreenGestureEnabled` (terugvegen
vanaf overal); `animation: 'none'` zolang `instantNav` aan staat (tik op melding). Header donker, Inter Bold — maar bijna
elk scherm zet `headerShown: false` en tekent een eigen `HeaderBackButton`.

Expliciet geregistreerde stack-screens: `intro` (fade, geen gesture), `welcome`, `qa`, `qa-haptics`, `(tabs)`,
`bracelet-control`, `bracelet-history`, `breath-history`, `support`, `player` (**`presentation: 'modal'`**), `subscribe`,
`activate-bracelet`, `settings`, `auth-callback`, `forgot-password`, `reset-password`, `change-password`, `legal/[doc]`,
`faq`, `about`. Alle andere routes worden automatisch door de bestandsstructuur geregistreerd (en zetten hun opties zelf
met `<Stack.Screen options=…/>`).

#### A.3.3 Intro → welkomstscherm (gast-first)

- `src/app/intro.tsx` — **eerste keer ooit** (sinds 25 okt 2026): 5 korte schermen (belofte, State Control, Breathwork,
  Audio Library, start), Skip altijd zichtbaar, laatste knop "Continue" → zet `appIntroSeenAt` en `router.replace('/welcome')`.
  Opnieuw te bekijken via Settings (`/intro?replay=1`).
- `src/app/welcome.tsx` — paginahoge achtergrondfoto, woordmerk + tagline bovenaan, **drie** gelijkwaardige glazen
  productknoppen onderaan, daaronder "**Sign In** or **Create Account**" → `router.replace('/account')` (formulier meteen open
  via `requestScrollTo('account-top')`). Alle knoppen gebruiken `replace` (welkom is een ingang, geen pagina om naar terug te
  keren):

| Knop (product / titel) | Actie |
|---|---|
| Breathe / Reset Yourself | `markTabOpenedByUser('breath')`, `notePlanOfferTabTap('breath')`, `replace('/breath')` |
| Feel / Control Your State | `notePlanOfferTabTap('state')`, `replace('/bracelet')` |
| Listen / Train Your Mind | `replace('/')` |

**⚠ Afwijking t.o.v. CLAUDE.md §3:** CLAUDE.md beschrijft twee knoppen ("Explore Bracelet" / "Explore Audio Library (listen
free sessions)") en "Already have a product? Sign in". De code heeft sinds de herbouw (15 sept / 24 sept / 19 okt 2026,
operator-beslissingen in comments van `welcome.tsx`) drie productknoppen en "Sign In or Create Account". De bracelet-
activatielink is weg (14 okt 2026, bracelet pas Early 2027). Het principe (geen poort, geen keuzevraag "wat bezit je") is
wel intact.

#### A.3.4 Tabgroep (`src/app/(tabs)/_layout.tsx`)

**Vijf tabbladen** (JSX-volgorde = volgorde in de balk):

| # | Bestand | Label in balk | Icoon (lucide) | Route |
|---|---|---|---|---|
| 1 | `(tabs)/bracelet.tsx` | State Control | `Radio` | `/bracelet` |
| 2 | `(tabs)/breath.tsx` | Breath | `Wind` | `/breath` |
| 3 | `(tabs)/index.tsx` | Library | `AudioLines` | `/` (verborgen met `href: null` als `AUDIO_ENABLED=false`) |
| 4 | `(tabs)/activity.tsx` | Activity | `ChartNoAxesColumnIncreasing` | `/activity` |
| 5 | `(tabs)/account.tsx` | Profile | `User` | `/account` |

**⚠ Afwijking t.o.v. CLAUDE.md §3** ("3 tabs: Audio · Bracelet · Account"): het zijn er 5; de header-comment van
`(tabs)/_layout.tsx` zegt ook nog "3 tabs / opens DIRECTLY here" — verouderd.

Belangrijke details:

- `unstable_settings = { initialRouteName: 'breath' }` en `backBehavior="initialRoute"`.
- **Eigen tab-knop** (`TabButton`, op `QaPressable`): de standaard `PlatformPressable` ving geen tikken op deze stack. Doet
  `router.navigate(path)` en extra: tik op Library → `requestLibraryReset()`; tik op Breath → `markTabOpenedByUser('breath')`
  (onboarding-poort); Breath/State Control → `notePlanOfferTabTap(...)`.
- Icoon: wit actief / `rgba(255,255,255,0.45)` inactief, dunne lijn (1.3/1.1), veer-"bounce" bij kiezen (respecteert
  `isReduceMotion()`). Label 11/10 px Inter bold/medium.
- **Zwevende tabbalk** (sinds 19 okt 2026): eigen `tabBar` rendert een absoluut gepositioneerd blok (`styles.barDock`,
  `zIndex/elevation 50`) met: zachte gradient-scrim 48 pt erboven, dekkend `#0a0a0a`-vlak, en gedokt boven de balk
  `BraceletMiniIndicator` (lopende State Control), `BreathMiniControl` (geminimaliseerde ademsessie) en `MiniPlayer`
  (audio). De gemeten hoogte gaat naar `setTabBarOverlayHeight()`; elk tabscherm houdt zijn knoppen erboven met
  `useTabBarInset()` (`src/utils/tab-bar-inset.ts`). Inhoudshoogte balk `TAB_BAR_CONTENT_HEIGHT = 51` + onderinset
  (`max(14, insets.bottom + 6 op Android)`).
- **Balk verborgen** voor de State Control-tab tijdens een actieve sessie of de full-screen onboarding-start
  (`isActiveSessionVisible` / `isStateControlIntroFullScreen` in `src/utils/state-control-ui.ts`).
- Tabwissel = crossfade (`animation: 'fade'`, `sceneStyle` donker).
- `screenListeners.focus` → `saveLastTab(route.name)` (pas na `bootDecided()`).
- `useFocusEffect` → `setTabsOnTop(true/false)` — gebruikt door `goToTab` (zie A.3.5).
- `<PremiumPill>` (vaste Premium-ingang) zweeft boven de tabs; positie per tab via `src/utils/premium-pill-slot.ts`
  (`setPremiumPillLow`, `setPremiumPillSuppressed`).

#### A.3.5 Navigatiehelpers — altijd deze gebruiken

`src/utils/state-control-ui.ts`:

| Functie | Wanneer |
|---|---|
| `goToTab(href)` | **De** manier om vanaf eender waar naar een tabblad te gaan. Liggen de tabs bovenaan → `router.navigate`; ligt er een scherm boven de tabs → `router.dismissTo` (voorkomt een tweede set tabs op de stapel en terugknop-lussen). |
| `goToTabInstant(href)` | Zelfde, maar zonder schuifanimatie (zet `instantNav` 700 ms aan) — voor tikken op meldingen. |
| `openStateControl(params)` | Enige manier om State Control te openen van elders (pill, melding, plan, Library): `goToTab({ pathname: '/bracelet', params: {…, open: Date.now()} })`. |
| `setActiveSessionVisible` / `setChooseScreenVisible` / `setStateControlIntroVisible` / `setStateControlIntroFullScreen` (+ `subscribe…`) | Kleine pub/sub-vlaggen die de tabbalk sturen. |

`src/services/breath-session-host.ts`:

| Functie | Wanneer |
|---|---|
| `openBreathSession(params)` | Start een ademsessie (als laag). Loopt er al een sessie (adem of State Control), dan eerst "End current session?" (`getPendingBreathOpen` / `confirmPendingBreathOpen` / `cancelPendingBreathOpen`). |
| `minimizeBreathSession()` / `restoreBreathSession()` / `closeBreathSession()` | Pill-gedrag. |
| `getBreathHost()` / `subscribeBreathHost()` | Status lezen. |

Andere hulpjes: `src/hooks/useBackTo.ts` (iOS-terugvegen/Android-terug = zelfde pad als de eigen terugpijl),
`src/utils/breath-entry.ts` (eenmalige vlaggen "skip intro bij terugkeer", vrije-sessie-claim),
`src/utils/onboarding-gate.ts` (wanneer onboardings vanzelf verschijnen), `src/utils/openSession.ts`
(`useGatedOpenSession` → audio-sessie openen of `AccountWallModal`).

Regel (geheugen "Bevestigde flows niet breken"): naar een tab altijd via `goToTab`; nooit een kale `router.push('/breath')`
vanaf een scherm boven de tabs.

#### A.3.6 Deeplinks (`scheme: vibezcoreapp`)

Afgehandeld in de root-layout (`linkPath()` leest `path` óf `hostname`, want `vibezcoreapp://breath-session?…` zet het pad in
`hostname`). Onbekende paden worden bewust genegeerd.

| Link | Gedrag |
|---|---|
| `vibezcoreapp://auth-callback?token_hash=…&type=…` | magic link / invite → `/auth-callback` (`pushOnce`, voorkomt dubbele token-verificatie) |
| `vibezcoreapp://reset-password?token_hash=…` | → `/reset-password` |
| `vibezcoreapp://forgot-password` | → `/forgot-password` |
| `vibezcoreapp://account` | (vanaf web-reset) slaat welkomstscherm over; Expo Router opent `/account` |
| `vibezcoreapp://breath-session?mode=calm&quick=1` | snelkoppeling "Quick reset" → `router.replace`, params uit de link |
| `vibezcoreapp://breath?from=shortcut` | snelkoppeling "All modes" |
| `vibezcoreapp://bracelet` | snelkoppeling "Bracelet" |
| `vibezcoreapp://qa?tier=free|premium|bundle|clear` | **enkel testbuild** (`EXPO_PUBLIC_QA=1`), zie `src/utils/qa.ts` |
| `/test-tier?tier=free|day|monthly|yearly|off` | **enkel testbuild** (`EXPO_PUBLIC_VZ_TEST=1`) |

Auth-paden en snelkoppelingen overrulen de welkomst-redirect (`AUTH_DEEP_LINK_PATHS`, `SHORTCUT_PATHS`). Meldingtikken
lopen via `onReminderTap` (warm) / `tappedReminderOnLaunch` (koud) uit `src/services/reminders.ts`; een ademsessie-melding
gaat rechtstreeks naar `openBreathSession` (of `restoreBreathSession` als er al een loopt).

#### A.3.7 "Laatst gebruikte tab" en gast-first

- `src/utils/last-tab.ts`: `vz_last_tab_v1` (laatste tab) en `vz_last_content_tab_v1` (laatste tab ≠ Profile, voor na het
  inloggen — `getLastContentTabRoute()`). Default `/breath`.
- Wie "binnen" is (token, refresh-token, of gast-aankoop-marker) ziet geen intro/welkom en opent op de laatste tab.
- Gasten kunnen alles zien en de gratis inhoud gebruiken; account is enkel nodig voor volledige Premium-audio, Backup &
  Sync en (later) bracelet-activatie. Een gast kan Premium kopen **zonder account** (RevenueCat anonieme ID →
  `GUEST_PURCHASE_RC_ID_KEY`).
- Uitloggen in Profile → `router.replace('/welcome')`.

#### A.3.8 Overlays en "Now Playing"-lagen

| Laag | Bestand(en) | Gedrag |
|---|---|---|
| Ademsessie | `components/BreathSessionHost.tsx` (rendert `BreathSession` uit `app/breath-session.tsx`) + `services/breath-session-host.ts` | Laag boven de hele app; minimaliseren laat stem/haptiek/timing doorlopen. Route `/breath-session` is enkel nog een doorgeefluik voor deeplinks/meldingen: geeft params aan de host en gaat meteen terug. |
| Mini-pill ademsessie | `components/BreathMiniControl.tsx` | Gedokt boven de tabbalk (en los in de root). |
| State Control-sessie | in de tab zelf (`bracelet-control.tsx` → `BraceletControl`) + `services/bracelet-session-monitor.ts` | Volledig scherm zonder tabbalk; pill `BraceletMiniIndicator` boven de balk als je weg navigeert. |
| Audio | `app/player.tsx` (modal) + `services/audio-player.ts` (singleton) + `components/MiniPlayer.tsx` | Minimize = `router.back()`, audio speelt door. |
| Eén sessie tegelijk | `breath-session-host.ts` ↔ `bracelet-session-monitor.ts` | Start je het één terwijl het ander loopt → "End current session?". |

---

### A.4 Alle schermen in `src/app`

Regelaantallen tussen haakjes geven een idee van de omvang (grootste: `bracelet-control.tsx` 9 237, `breath-session.tsx`
6 203, `(tabs)/index.tsx` 6 003, `breath-setup.tsx` 5 064, `breath-welcome.tsx` 4 620, `(tabs)/account.tsx` 3 253).

#### A.4.1 Opstart & onboarding

| Route / bestand | Doel | Belangrijke componenten / helpers |
|---|---|---|
| `_layout.tsx` | Root Stack, opstartbeslissing, deeplinks, globale hosts | zie A.3.2 |
| `intro.tsx` | Algemene app-uitleg, 5 schermen, enkel eerste keer (of replay) | `reveal(i)`, glazen pil 52 dp, `setSetting('appIntroSeenAt')` |
| `welcome.tsx` | Welkomstscherm voor gasten/uitgelogd | `BlurView`-glasknoppen, `PremiumNote`, `markTabOpenedByUser`, `notePlanOfferTabTap` |
| `breath-welcome.tsx` | Breathwork-onboarding (meerdere stappen: wat het is, modi, begeleiding, doelen/ervaring) + eerste gratis sessie | `utils/onboarding-gate.ts`, `breath-level.ts`, `useBackTo` |
| `state-onboarding.tsx` | State Control-onboarding als volledig scherm (`?first=1&hr=…`) of replay vanuit Settings | `components/StateControlOnboarding.tsx`, `deferOnboarding`, `setStateIntroSkip` |
| `how-breathwork.tsx` / `how-state-control.tsx` | "How it works"-uitleg (Settings) | `components/HowItWorks.tsx` |
| `breath-quiz.tsx` | Oude vragenlijst → dagplan. **Geen actieve ingang** | — |

Onboarding-regels (`src/utils/onboarding-gate.ts`): verschijnt enkel als de gebruiker de tab **zelf** opent (niet bij
herstel van de laatste tab, deeplink, melding, pill, na aankoop of tijdens een sessie). Afgerond/Skip → nooit meer;
"Not Now" → nog één keer bij een volgende app-start. Premium ziet geen tab-intro's (UI_EN_BEWEGINGSREGELS §3).

#### A.4.2 State Control (haptische toestandssessies, telefoon/horloge, later bracelet)

| Route / bestand | Doel | Componenten / helpers |
|---|---|---|
| `(tabs)/bracelet.tsx` | Tab "State Control": eerste-keer-intro-overlay in de tab (foto, CTA "Explore State Control" → `/state-onboarding?first=1`), daarna altijd `<BraceletControl autoConnect/>` | `TabReveal`, `setPremiumPillLow`, `useSubscription` |
| `bracelet-control.tsx` | Het eigenlijke State Control-scherm: toestand kiezen (draaicirkel), duur, start, lopende sessie (pulsringen, resterende tijd), Audio & Haptics-blad, Switch, einde; ook als losse route `/bracelet-control` (oude ingangen) | `services/ble-contract.ts`, `bracelet.ts` (transport, `USE_SIMULATED_BLE`), `bracelet-haptics.ts`, `bracelet-session-monitor.ts`, `HapticPulseRings`, `DurationRingPicker`/`DurationWheel`, `RhythmRing`/`RhythmSheet`, `GlassSheet`, `stateGlass`/`VibezGlass` |
| `heart-rate.tsx` | Rusthartslag ("Heart Rate"): huidige waarde, historiek, nieuwe meting | `services/resting-pulse.ts`, `RestingHeartRatePage`, `PulseMeter`, `FingerPlacementAnim` (camera via vision-camera) |
| `bracelet-set-day.tsx` | "Set your plan" voor State Control: sessies (toestand + duur + tijd) toevoegen | `TimeWheel`, `DurationWheel`, `utils/bracelet-plan-store.ts` |
| `bracelet-agenda.tsx` | "Your bracelet plan": dagcirkel met sessies op hun uur, kalender | `bracelet-plan-store`, `openStateControl` |
| `bracelet-protocol.tsx` | Overzicht van het eigen State Control-protocol; tik = start | `openStateControl` |
| `bracelet-history.tsx` | State Control-geschiedenis | `WeekSummaryCard`, `HistoryList`, `utils/bracelet-history.ts` |
| `activate-bracelet.tsx` | Activatiecode (XXXX-XXXX-XXXX-XXXX) → `POST /api/bracelet/activate`; bewaard voor de lancering, momenteel niet actief aangeboden | `services/bracelet-activation.ts` |

#### A.4.3 Breathwork

| Route / bestand | Doel | Componenten / helpers |
|---|---|---|
| `(tabs)/breath.tsx` | Tab "Breath" — **kiest, ademt niet**: intro-overlay (eerste bezoek/free), "Choose your mode" (iconenbalk 5 toestanden + CTA), ingang naar "How do you feel?" | `breath-states.ts`, `breath-picker-ui.ts`, `breath-suggestion.ts`, `onboarding-gate`, `useBreathFreeStart` |
| `breath-setup.tsx` | Sessie-instelling (donker): techniek/ritme, duur, timing, stem/haptiek → start | `LotusPacer`/`BreathMandala`, `DurationWheel`, `GuidanceSelector`, `openBreathSession` |
| `breath-session.tsx` | Het sessiescherm (export `BreathSession`, gerenderd door `BreathSessionHost`); default export = doorgeefroute | `breath-voice.ts`, `breath-haptics.ts`, `soundscape.ts`, `modules/breath-background`, `watch-breath`/`wear-breath`, `live-activity`, `PremiumPaywallModal` (30 s voorproef) |
| `feel-now.tsx` | "How do you feel?" — huidige toestand kiezen (12 situaties) → app kiest bestemming en start | `utils/instant-feel.ts`, `openBreathSession` |
| `breath-history.tsx` | "Your Practice" — ademgeschiedenis | `WeekSummaryCard`, `HistoryList`, `utils/breath-history.ts` |
| `breath-splat.tsx` | Prototype puntenveld (dev) | `SplatField` |
| `breath-pacer-preview.tsx` | Dev-preview van `BreathPacer` (geen ingang) | `BreathPacer` |

#### A.4.4 Protocol / plan / agenda (Breathwork)

Flow vanuit Activity ("Set your goal") of Settings:

```
build-choice ──"Let VIBEZCORE build it"──► goal ► routine-intro ► intensity ─► plan-review ─► plan-success ─► agenda
             └─"Build it yourself"──────► build-your-day ──────────────────────┘
plan (Your plan) ─► plan-summary ─► plan-success
```

| Route / bestand | Doel |
|---|---|
| `build-choice.tsx` | Stap 1: vork "laat VIBEZCORE bouwen" vs "zelf bouwen" |
| `goal.tsx` | "Set your state": primair + optioneel secundair doel (8 doelen) |
| `routine-intro.tsx` | Overgangsscherm "Before we build your protocol" met gekozen doelen |
| `intensity.tsx` | "Set your routine": hoeveel sessies, niveau, dagdelen/tijden (cirkel) |
| `build-your-day.tsx` | Pad B: zelf sessies toevoegen (toestand, techniek, duur, tijd op één kaart) |
| `plan-review.tsx` | "Your protocol": resultaat per item vervangen/verwijderen, bevestigen |
| `plan-summary.tsx` | "Confirm your protocol" (vanuit `plan.tsx`) |
| `plan-success.tsx` | Viering "Protocol confirmed" → agenda |
| `agenda.tsx` | "Your agenda": vastgelegd rooster met voltooiing per dag (afgeleid uit ademgeschiedenis) |
| `plan.tsx` | "Your plan": dagplan (twee momenten), start sessie |

Gedeelde stukken: `utils/protocol.ts`, `plan-store.ts`, `day-plan.ts` (`SLOT_WINDOW`, `TIME_STEP_MIN`), `plan-roll.ts`,
`plan-status.ts`, `protocol-gate.ts`, `components/SlotTimeEditor.tsx`, `TimeWheel.tsx`, `DurationWheel.tsx`,
`ConfirmMoment` (bevestigingsanimatie).

#### A.4.5 Audio Library

| Route / bestand | Doel | Componenten / helpers |
|---|---|---|
| `(tabs)/index.tsx` | Tab "Library" (route `/`): hero/intro, balk Your Journey · Last Listened · Favorites, 4 pijlers, series, sessies (FREE/PRO), soundscapes, aankoopblok | `data/audio-library-data.ts`, `utils/access-tier.ts` (`getEffectiveTier`, `resolveAccess`), `useFavorites`, `useSubscription`, `audio-player`, `TabReveal`, `VibezGlass`, `GlassSheet`, `useBootDecided` |
| `player.tsx` | Volledig-scherm speler (modal): voortgang/hervatten, skip, favoriet, snelheid, slaaptimer, voorproef-upsell | `services/audio-player.ts` (`usePlayerState`), `VibezAlertHost` (eigen host in modal) |
| `library/free.tsx` | "Free Sessions" (10 sessies met tier `public`) | `LibraryListRow` |
| `library/new.tsx` | "What's New" (`isNew(sess.added)`) | |
| `library/favorites.tsx` | "Your Favorites" | `useFavorites` |
| `library/pillar/[key].tsx` | Gefocust pijler-scherm (één pijler, afspeelbare lijst) | |
| `history.tsx` | "Your Journey": luistergeschiedenis, streak, stats | `utils/history.ts` (`vzh_`) |

Toegang: `utils/openSession.ts` → gast op een account-sessie = `AccountWallModal`; Premium-sessie zonder abonnement =
voorproef + paywall. Audio-tab kan verborgen worden met `AUDIO_ENABLED` (`src/constants/features.ts`, nu `true`).

#### A.4.6 Activity

| Route / bestand | Doel |
|---|---|
| `(tabs)/activity.tsx` | Hub met kaarten (licht kort op bij terugkeer): Heart Rate → `/heart-rate`; State Control: plan → `/bracelet-agenda`, plan instellen → `/bracelet-set-day`, geschiedenis → `/bracelet-history`; Breathwork: plan → `/agenda`, doel → `/build-choice`, geschiedenis → `/breath-history`. Ademsessies en State Control bewust gescheiden (doen vs krijgen). |

#### A.4.7 Profile / account / auth

| Route / bestand | Doel |
|---|---|
| `(tabs)/account.tsx` | Tab "Profile": inloggen/registreren (e-mail, Google, Apple), lidmaatschapsstatus + CTA's (`/subscribe`), Settings, FAQ, Support, About, legal-links, wachtwoord wijzigen, uitloggen (→ `/welcome`), account verwijderen. Geen poort. |
| `settings.tsx` | Secties: Playback · Privacy (o.a. crash reports, clear local data) · Notifications · Breathwork · State Control · (Smart Bead Bracelet) · About (How it works, intro opnieuw, versie) · dev-sectie (enkel dev) |
| `auth-callback.tsx` | Landing magic link / invite: `token_hash` → Supabase verify → sessie bewaren → door |
| `forgot-password.tsx` | Reset-mail aanvragen (Supabase recover) |
| `reset-password.tsx` | Twee modi: recovery (met `token_hash`) of eerste wachtwoord instellen na invite |
| `change-password.tsx` | Wachtwoord wijzigen voor ingelogde gebruiker (huidig wachtwoord verplicht) |

(Auth-schermen praten rechtstreeks met Supabase Auth — door de operator goedgekeurde uitzondering, zie comments in die
bestanden. Details: Deel over backend/auth.)

#### A.4.8 Paywall / aankoop

| Route / component | Doel |
|---|---|
| `subscribe.tsx` | Aankoopscherm (`?tier=day|monthly|yearly`): plannen, (optioneel) account, RevenueCat-aankoop, verificatie, foutpaden, herstel |
| `components/PremiumPaywallModal.tsx` | Paywall-blad na voorproef (breathwork/State Control) |
| `components/MembershipPlans.tsx`, `PurchaseConfirm.tsx` | Prijskaarten / bevestiging |
| `components/PremiumPill.tsx`, `PremiumNote.tsx` | Vaste Premium-ingang en "Full session with [Premium]"-regel |
| `components/AccountWallModal.tsx` | Gast tikt op account-sessie |
| `components/SalesNudgeHost.tsx`, `PlanOfferHost.tsx`, `WelcomeBackPopup.tsx` | Getimede glasbladen (Day Pass, Welcome Back, "Set your plan") |
| `hooks/useSubscription.ts` | Eén bron voor tier/status (`vz_sub_v3`, `vz_sub_guest_v1`), `refreshSubscription()` |

Prijzen/producten en de backend-kant horen in een ander deel; hier enkel de schermen.

#### A.4.9 Legal / info / support

| Route / bestand | Doel |
|---|---|
| `legal/[doc].tsx` | Eén renderer voor de slugs in `src/data/legal-content.ts`: `terms`, `privacy`, `accessibility`, `shipping`, `refund`, `cookies`, `health`, `audio-sessions` |
| `faq.tsx` | FAQ met zoeken en categorieën (`src/data/faq-content.ts`) |
| `about.tsx` | Merkverhaal (product-first). Bron voor canonieke About-copy (geheugen: lees sectie 02 eerst) |
| `support.tsx` | Opent het webformulier `vibezcore.com/support` in de in-app browser en sluit zichzelf; fallback-knop |

#### A.4.10 QA / test (niet in winkelbuilds)

| Route | Doel |
|---|---|
| `qa.tsx` | `vibezcoreapp://qa?tier=…&fresh&stay` — wisselt gebruikerstype via dev-override; alleen bij `EXPO_PUBLIC_QA=1` |
| `qa-haptics.tsx` | Vuurt 5 haptische varianten af voor latentiemeting (zie `docs/KWALITEITSPROTOCOL.md`) |
| `test-tier.tsx` | Forceert toegangsniveau bij `EXPO_PUBLIC_VZ_TEST=1`, anders redirect naar `/` |

In een store-build doen deze routes niets (redirect).

---

### A.5 Globaal UI-systeem

Bindend: `docs/UI_EN_BEWEGINGSREGELS.md` (23–30 okt 2026). Wijzigt een regel → doc én code (`theme.ts`, `motion.ts`,
`Tap.tsx`, `PopupCard.tsx`, `PremiumNote.tsx`, `VibezGlass.tsx`) samen aanpassen.

#### A.5.1 Kleuren (`src/constants/theme.ts`)

- De app is **in de praktijk dark-only**: `app.json userInterfaceStyle: "dark"`, `themeMode` default `'dark'`
  (`utils/settings.ts`), tabbalk/scrims hardgecodeerd donker. `BrandLight` + `useAppTheme()` bestaan nog (light/dark/system),
  maar het merendeel van de schermen gebruikt de statische alias `Brand` (= `BrandDark`) in `StyleSheet.create`.
  (De header-comment in `theme.ts` "light als default" is achterhaald.)

| Token | Waarde | Rol |
|---|---|---|
| `Brand.bg` | `#0a0a0a` | achtergrond |
| `Brand.panel` / `border` | `#1e1e1e` / `#2a2a2a` | kaarten / randen |
| `Brand.text` / `textDim` | `#f4f4f4` / `#8a8a8a` | tekst |
| `Brand.success` / `error` | `#4ade80` / `#ef4444` | status |
| `Brand.accent` (Signal Blue) | `#3a8fff` | **uitsluitend** haptic-pulsen/"nu actief" — nooit CTA/tekst/vlak. In lopende State Control-sessies krijgen de pulsringen de toestandskleur. |
| `AudioAccent` / `AudioAccentLight` (Bio-Teal) | `#00A3A3` / `#4AF0D4` | de accentkleur van de app (labels, actieve iconen, ConfirmMoment-ring, notificatiekleur) |
| Toestandskleuren | `src/data/breath-states.ts` | bron van waarheid voor de 5 toestanden (Boost amber, Sharp Focus blauw, Calm Control violet, Clarity & Relax wit, Sleep Bio-Teal); `services/ble-contract.ts` volgt die |

Royal Indigo bestaat in de app niet meer als accent (alleen nog `BrandLight.accent`).

#### A.5.2 Typografie

- Font: **Inter** 400/500/600/700/800/900 via `@expo-google-fonts/inter`, één keer geladen in de root. Namen in
  `BrandFonts` (`regular`…`black`). Standaardfont voor elke `<Text>` komt uit de React Native-patch.
- Rollen: `TypeScale` (`pageHeader` 30 bold, `pageSubhead` 16 regular, `pageLead`, `cardEyebrow` 10.5 bold +1.4,
  `cardHeadline` 22 bold, `cardDetail` 14 medium, `sectionLabel`, `tabHeader` 26 bold, `compactCardTitle`, `ctaLabel` 16
  semibold, `microLink`) en `AppTypeScale` (`appHeaderLarge` 34, `appHeaderInline` 20, `cardHeader` 18, `cardSubheader`,
  `cardBody` 15, `chartLabel` 12). Nieuwe schermen: deze tokens gebruiken, geen eigen groottes verzinnen.
- Tab-titels (BREATHWORK / AUDIO LIBRARY / STATE CONTROL): 13 dp Inter bold, letterSpacing 1.2, hoofdletters, gecentreerd op
  `insets.top + 4`.
- Systeemtekstgrootte begrensd tot 1,3× (patch). iOS "Vette tekst" → zwaardere Inter-varianten.
- Copy-regels die door tests bewaakt worden (`__tests__/content/`): VIBEZCORE altijd in hoofdletters, koppen/taglines
  zonder punt, geen verboden claims (hersengolven, synchroniseert, klinisch bewezen, brainwave entrainment…), pijlers en
  modusnamen exact.

#### A.5.3 Knoppen (pillen)

| Soort | Stijl (bron) |
|---|---|
| Elke hoofdknop | 52 dp hoog, `borderRadius: 999`, 26 dp zijmarge (`CTA.container`) |
| Neutraal (de beslissende actie, intro/welkom/popup) | wit glas `CTA_GLASS = rgba(255,255,255,0.94)`, donkere tekst `#0a0a0a` (`CTA.label`, 15 semibold) |
| Toestandsknop (Breath-keuze, Breathwork-instel, State Control-start, Switch, sessiebalk) | `VibezGlass` met toestandskleur als `tint`, witte tekst; `stateGlass(hex)` geeft enkel transparante basis |
| Uitgeschakeld | `CTA.disabled` (`#161618`, ondoorzichtig) + `CTA.labelDisabled` |
| Play-knop in sessies | rond 72 dp, toestandskleur 55 %, glans bovenin, dunne lichte rand |
| Chips | zacht omlijnd, gekozen = lichter glas, rand ≤ 16 % (geheugen) |

Nooit de accentkleur als CTA-achtergrond. `CTA_BOTTOM_LIFT = 24` houdt de hoofdknop van State Control en Breathwork op
dezelfde hoogte. `DIAL_SIZE` = één maat voor de grote keuzecirkel (State Control én Breathwork).

**Elke tikbare knop/kaart/rij gebruikt `components/Tap.tsx`** (of `PressScale`/`CardBounce`): indrukken krimpt
(`SPRING_PRESS_IN`), loslaten veert terug (`SPRING_PRESS_OUT`), `scaleTo` 0.97/0.95/0.9. Geen kale `Pressable` voor
knoppen. **Geen haptiek op knoppen** (`BUTTON_HAPTICS = false` in `src/utils/haptics.ts`; `hapticTap/Press` doen niets);
`hapticTick` (slepen), succes/fout en sessie-haptiek blijven.

#### A.5.4 Glas en BlurView

- Altijd **echt glas**: `expo-blur` `BlurView`; nep-glas met enkel rgba is afgekeurd.
- `components/VibezGlass.tsx` = het enige glasmateriaal (blur + donkere tint + optionele toestandstint + glanslaag
  binnenin, **geen rand**).
- Android-glas werkt enkel op inhoud binnen een `BlurTargetView`: de hele app zit in `rootBlurRef`
  (`src/utils/root-blur.ts`); sheets worden **buiten** die target getekend door `GlassSheetHost`.
- **Gebruik `<GlassSheet visible onClose>…</GlassSheet>`** (uit `components/GlassSheetHost.tsx`) i.p.v. een RN `<Modal>`
  voor bladen. Nooit `blurTarget={rootBlurRef}` binnen een gewoon scherm gebruiken → native crash (SIGSEGV); enkel in
  `GlassSheet`.
- Bladen: actieblad zonder X/Done; kiezer/uitleg met "Done" rechtsboven (`SessionSheetHeader`, `SheetScroll`). Geen
  venster-op-venster (bevriest iOS): extra vragen zoals "Just this time / Remember" worden **in** het blad getoond.

#### A.5.5 Tekst: `BalancedText`

`components/BalancedText.tsx` — drop-in voor `<Text>` met een string als kind: tekent eerst, meet in `onTextLayout`, en
verdeelt bij een "wees" (los woord op de laatste regel) de woorden opnieuw evenwichtig (zoals CSS `text-wrap: balance`).
Regel: **alle meerregelige tekst** via `BalancedText`. Daarnaast: intro/uitleg moet zonder scrollen passen op elk toestel
(beeld krimpt eerst).

#### A.5.6 Animaties (`src/constants/motion.ts`)

| Token | Gebruik |
|---|---|
| `SPRING_PRESS_IN` / `SPRING_PRESS_OUT` | indrukken / loslaten (Tap) |
| `SPRING_POP` | gekozen element popt |
| `SPRING_SETTLE` | paginabolletjes, rustig settelen |
| `SPRING_SHEET` | bladen |
| `POPUP_IN` | popupkaart (`FadeInDown.springify().damping(18).stiffness(170)`) |
| `reveal(i)` | cascade per blok (25 dp van onder, staffel 70 ms, max i = 8) |
| `isReduceMotion()` | respecteer "beweging verminderen" voor RN-`Animated` |

Componenten: `components/Reveal.tsx` (`<Reveal i>` speelt één keer; `<TabReveal i>` speelt opnieuw bij elke tab-focus),
`PopupCard`/`PopupView`, `LaunchReveal` (opstart), `ConfirmMoment` (bevestiging: Bio-Teal-boog, vinkje, ping).
Conventies: veren i.p.v. tijdcurves voor beweging (`withTiming` enkel voor opacity/kleur en ritme-gebonden animaties zoals
de ademfiguur); eindeloze animaties enkel zolang de tab zichtbaar is; grote bewegende foto's op Android met
`renderToHardwareTextureAndroid`; navigatie Android `ios_from_right`, iOS terugvegen overal; tabwissel crossfade.
**Worklet-valkuil:** een `'worklet'`-helper moet vóór de `useAnimatedProps` staan die hem gebruikt (tsc ziet het niet).

#### A.5.7 Popups

- **Nooit `Alert.alert`** (grep: 0 aanroepen). Gebruik `showVibezAlert({ title, message, buttons })` /
  `confirmVibezAlert(...)` uit `components/VibezAlert.tsx`; host `<VibezAlertHost/>` staat in de root én in elk native
  modaal scherm (`player.tsx`). Kaart in `VibezGlass`, `POPUP_IN`, knoppen via `Tap`.
- Andere bevestigingen: `components/ConfirmCard.tsx`, `showConfirmMoment(...)`.
- Native store-popups (Google Play / StoreKit) vallen buiten onze controle.

#### A.5.8 Overige vaste UI-elementen

- `components/HeaderBackButton.tsx` (eigen terugpijl), `utils/safe-area.tsx` (eigen `useSafeAreaInsets`-wrapper),
  `BottomSystemScrim` (donkere strook achter de Android-navigatieknoppen), `StepIndicator` (ronde witte dots),
  `ErrorBoundary`.
- Tijd- en duurkiezers: altijd `TimeWheel` (stap 5 min) en `DurationWheel`; dagdelen enkel uit `SLOT_WINDOW`
  (`utils/day-plan.ts`).
- Responsief via formules (verhoudingen, flex, safe-area), nooit vaste dp voor fotoposities.

---

### A.6 State en persistentie

#### A.6.1 Patronen

1. **Module-store + listener-set** (geen Redux/Zustand/Context): een module houdt de waarde in het geheugen, laadt één
   keer uit AsyncStorage, en biedt een synchrone getter + `subscribe` + een React-hook. Voorbeelden: `utils/settings.ts`,
   `utils/history.ts`, `utils/vzp.ts`, `hooks/useFavorites.ts`, `hooks/useSubscription.ts`, `services/audio-player.ts`,
   `services/breath-session-host.ts`, `utils/state-control-ui.ts`, `utils/premium-pill-slot.ts`. Notificaties naar
   React gaan via `setTimeout(…,0)` waar ze uit native callbacks komen (midden-commit-crashes vermeden).
2. **Per-gebruiker buckets** (`src/utils/user-bucket.ts`): `u-{jwt.sub}` (ingelogd), `anon` (gast), `dev-{override}`
   (dev). Sleutels = `{prefix}{bucket}{suffix}`; stores herladen bij bucket-wissel (in-/uitloggen).
3. **Versie in de sleutel** (`_v1`, `_v2`, `_v3`): een schemawijziging = nieuwe sleutel + eenmalige migratie van de oude
   (bv. `vbh_v1` → `vbh_{bucket}_v2`).
4. **Stil falen**: elke `AsyncStorage`-lees/schrijf in try/catch, terugval op defaults.
5. **Backup & Sync** (`services/cloud-sync.ts` + `cloud-sync-core.ts`): ingelogde gebruikers syncen instellingen
   (`SYNCED_SETTING_KEYS`), rusthartslag, ademhistoriek, actief plan, State Control-sessies, favorieten, beluisterd,
   hervatposities naar Supabase-tabel `user_data` (RLS; SQL in `docs/backend/user-data-migration.sql`). Gast → account
   neemt lokale gastdata over. Meta: `vz_cloud_sync_meta_v1`.
6. **Wissen**: `services/local-data.ts` stopt eerst alle lopende stores/sessies en wist dan de opslag (gebruikt door
   "Clear all local data" en "Delete account"); auth-sleutels en de gast-aankoopkoppeling blijven bij "Clear data".

#### A.6.2 Instellingen (`src/utils/settings.ts`, sleutel `vzs_v1`)

API: `getSetting(key)` (synchroon), `setSetting(key, value)`, `useSetting(key)` → `[value, set]`,
`ensureSettingsLoaded()`, `SETTING_DEFAULTS`. Nieuwe instelling = veld in type `Settings` + default.

| Groep | Velden (default) |
|---|---|
| Audio Library | `autoPlayNext` (true), `saveProgress` (true), `trackHistory` (true), `audioQuality` ('high', nog niet gebruikt) |
| Stem/haptiek | `voiceCues` (true), `voiceCuesChosen`, `voiceGender` ('female'), `hapticsPhone` (true), `watchHaptics` (true), `breathPrefs` (per toestand voice/haptics/voiceGender), `soundscapeByState`, `breathTechByState` |
| Onboarding/intro | `appIntroSeenAt`, `breathOnboardingCompletedAt`, `stateOnboardingCompletedAt`, `braceletOnboardingCompletedAt`, `breathOnboardingDeferredCount`, `stateOnboardingDeferredCount` |
| Gratis sessies | `breathFreeSessionUsedAt`, `stateFreeSessionUsedAt`, `stateFreeMode` |
| Doelen/protocol | `goals` (max 2), `intensity`, `experienceLevel`, `hasBuiltProtocol`, `breathLevelSeen`, `instantDurationBias`, `profile` |
| Herinneringen | `reminders`, `reminderHours`, `reminderAt`, `planReminders` (true), `braceletPlanReminders` (true) |
| Overig | `themeMode` ('dark'), `hasSeenBatteryPrompt`, `testFullSessions` (dev) |

#### A.6.3 AsyncStorage-sleutels (overzicht)

Conventie: nieuwe sleutels `vz_<naam>_v<n>`; oudere varianten (`vibezcore.stateControl.*`, `@vzc:*`, `vzc.*`, `vz.*`)
bestaan nog en worden niet hernoemd zonder migratie.

| Sleutel | Eigenaar | Inhoud |
|---|---|---|
| `vzs_v1` | `utils/settings.ts` | alle instellingen |
| `vz_last_tab_v1`, `vz_last_content_tab_v1` | `utils/last-tab.ts` | laatst gebruikte tab |
| `vz_session_token`, `vz_refresh_token`, `vz_token_expires_at`, `vz_user_email`, `vz_last_login_email`, `vz_auth_provider` | `services/auth.ts` | sessie (geen wachtwoorden) |
| `vz_guest_purchase_rc_id`, `vz_pending_rc_link` | `services/auth.ts` | gast-aankoop / uitgestelde RevenueCat-koppeling |
| `vz_sub_v3`, `vz_sub_guest_v1` | `hooks/useSubscription.ts` | gecachete abonnementsstatus |
| `@vzc:iap:pending-verifies` | `services/iap-recovery.ts` | openstaande aankoopverificaties |
| `vzh_{bucket}_v1` | `utils/history.ts` | luistergeschiedenis (Your Journey) |
| `vzp_{bucket}_v1` (legacy `vzp_v1`) | `utils/vzp.ts` | hervatposities audio |
| `vzf_{bucket}_v1` (legacy `vibezcore:favorites`) | `hooks/useFavorites.ts` | favorieten |
| `vz_last_played_v1` | `utils/last-played.ts` | laatst beluisterd |
| `vbh_{bucket}_v2` (+ totals; legacy `vbh_v1`) | `utils/breath-history.ts` | ademgeschiedenis |
| `vzbc_sessions_{bucket}_v1` | `utils/bracelet-history.ts` | State Control-geschiedenis |
| `vzpc_{bucket}_v1` / `vzbpc_{bucket}_v1` | `utils/plan-store.ts` / `bracelet-plan-store.ts` | actief Breathwork- / State Control-plan |
| `vzc.stateControl.session.v1` | `services/bracelet-session-monitor.ts` | lopende State Control-sessie (herstel) |
| `vibezcore.hapticStrength.v2` | `services/haptic-strength-pref.ts` | bewaarde trilsterkte (default Strong) |
| `vibezcore.stateControl.hear`, `vibezcore.stateControl.phoneHaptics` | `state-sound-pref.ts`, `state-phone-haptics-pref.ts` | Haptic vs Haptic+Audio, telefoontrilling |
| `vz_resting_pulse_v1`, `vz_session_pulse_log_v1` | `services/resting-pulse.ts` | rusthartslag + sessielog |
| `vz_cloud_sync_meta_v1` | `services/cloud-sync.ts` | sync-meta |
| `vz_last_seen_build_version` | `services/version-tracker.ts` | build-wissel → sessie wissen |
| `vz_crash_reports_off_v1` | `services/crash-reporting.ts` | opt-out Sentry |
| `vz_dev_user_override_v1`, `vz_dev_bracelet_activated_v1` | `utils/dev-user-override.ts` | enkel dev/QA |
| overige UI-vlaggen | diverse | `vz_sales_nudges_v1`, `vz_plan_offer_seen_v1`/`_pending_v1`, `vz_confirm_moment_v1`, `vz_account_invite_v1`, `vz_feel_checkin_v1`, `vz_watch_setup_tip_v1`, `vz_watch_seen_v1`, `vz_wear_first_open_tip_v1`, `vz_watch_imported_ids_v1`, `vz_reminders_*`, `vz.reminders.lastHandledTap`, `vz_access_*`, `vz_sound_timing_hint_v1`, `vz_ujjayi_intro_sound_v1`, `vz_private_mode_v1`, `vz_breath_onb_by_email_v1`, `vz.iosLockNoticeSeen`, `vzc_bracelet_upsell_shown`, `@vzc:play-events:anon-token`, `vz_health_sync_v1` (Health uit) |

#### A.6.4 "Just this time / Remember"-patroon

Standaarden (sinds 2 nov 2026): State Control = **Haptic + Audio**, trilsterkte = **Strong**. Wijkt de gebruiker af, dan
vraagt de app **in het blad zelf** (nooit een popup bovenop een blad): "Just this time" of "Yes, remember it".

Implementatie (`src/services/haptic-strength-pref.ts` als referentie):
- twee waarden: `saved` (bewaard in AsyncStorage, standaard Strong) en `strength` (wat nu speelt);
- "Remember" → beide zetten + bewaren; "Just this time" → enkel `strength`;
- bij het **einde van de sessie** (`endHapticStrengthSession`) valt `strength` terug op `saved` — ook bij het einde van een
  voorproef. Eén regel voor State Control, voorproef en Breathwork; geen vlag die naar een volgende sessie lekt.
- Zelfde vraag voor "Phone haptics" en Haptic/Haptic+Audio in het Audio & Haptics-blad van `bracelet-control.tsx`
  (`AudioHapticsSheet`, state `askStrength`/`askPhone`) en in `breath-session.tsx`.

Bij een nieuwe instelbare sessievoorkeur: dit patroon volgen (bewaarde standaard + tijdelijke override die eindigt met de
sessie), niet een nieuwe variant uitvinden.

#### A.6.5 Feature-schakelaars (`src/constants/features.ts`)

| Schakelaar | Waarde | Betekenis |
|---|---|---|
| `AUDIO_ENABLED` | `true` | Library-tab zichtbaar (`false` = `href: null`, scherm blijft bestaan) |
| `HEALTH_INTEGRATION_ENABLED` | `false` | Apple Health / Health Connect uit sinds 19 okt 2026. Terugzetten vraagt ook pakketten, config-plugins, permissies en privacy-teksten terug (zie comment in het bestand, commit `9a20275`) |

Andere schakelaars elders: `USE_MOCK_IAP = __DEV__` (`services/iap.ts`), `USE_SIMULATED_BLE` (`services/bracelet.ts`),
`QA_ENABLED` (`EXPO_PUBLIC_QA`), `EXPO_PUBLIC_VZ_TEST`, `BUTTON_HAPTICS = false` (`utils/haptics.ts`).

---

### A.7 Waar staan de (publieke) sleutels en geheimen — enkel locaties

| Wat | Waar |
|---|---|
| Supabase URL + publishable key | `src/constants/supabase.ts` |
| RevenueCat publieke SDK-sleutels, Google client-IDs, EAS projectId | `app.json` → `expo.extra` |
| Sentry DSN | `src/services/crash-reporting.ts` |
| Store-credentials, keystores, service-accounts, `.env*` | `secrets/`, `credentials/`, `credentials.json`, `*.jks`/`*.p8` — gitignored; back-up via `scripts/backup-to-onedrive.sh` naar OneDrive |
| Volledige diensten- en kostenlijst | `docs/OPERATOR_HANDOVER.md` (gitignored) |

---

### A.8 Gekende afwijkingen en valkuilen (samenvatting voor een nieuwe ontwikkelaar)

1. **CLAUDE.md §3 is op twee punten achterhaald t.o.v. de code**: 5 tabbladen (niet 3) en een welkomstscherm met 3
   productknoppen + "Sign In or Create Account" (niet de 2 knoppen + "Already have a product? Sign in"), plus een
   eenmalige `/intro` vóór het welkomstscherm. Niet "terugzetten" zonder operator.
2. **CLAUDE.md §2** (te verwijderen `src/app/index.tsx`/`explore.tsx`): al gebeurd; `src/app/(tabs)/index.tsx` blijft.
3. `react-native.config.js` sluit nog `react-native-iap` (bestaat niet meer) en `react-native-nitro-modules` uit — let op
   bij camera/nitro-problemen in lokale builds.
4. Wear OS: altijd in `wear-app/` werken; `android/wear/` is een kopie (wel getrackt).
5. Expo Router monteert altijd eerst `/`; schermen die bij mount iets tonen moeten `useBootDecided()` respecteren.
6. Navigatie naar tabs: `goToTab`/`openStateControl`/`openBreathSession` — nooit kale push naar een tab vanuit een scherm
   boven de tabs.
7. Glas: enkel `VibezGlass` + `GlassSheet`; `blurTarget` binnen een gewoon scherm = crash.
8. Popups: `showVibezAlert`, nooit `Alert.alert`; geen popup bovenop een blad.
9. Grote bestanden (`bracelet-control.tsx`, `breath-session.tsx`, `(tabs)/index.tsx`) bevatten veel historische
   operator-beslissingen in comments — lees de dichtstbijzijnde comment vóór je gedrag wijzigt.
10. Dode/legacy code: zie A.2.2.

---

## Deel B — Toegang, betalen, accounts en backend

> Stand: 3 november 2026, branch `rollback-vc76-take2`. Alles hieronder is nagekeken tegen de code in
> `C:\Users\ulgar\vibezcore-app` en de backend-repo `C:\Users\ulgar\vibezcore-backend` (alleen gelezen, NOOIT wijzigen,
> CLAUDE.md §1). Geheime waarden (API-sleutels, wachtwoorden, tokens, private keys) staan hier bewust NIET in; er staat
> alleen waar ze staan en waarvoor ze dienen.
>
> Leesvolgorde voor wie overneemt: B.1 (wie mag wat), dan B.2 (kopen), B.3 (accounts), B.4 (backend), B.5 (stores).
> Wat hier "afgeleid" heet, is uit code afgeleid en niet in een dashboard nagekeken.

---

### B.0 Kort samengevat

| Onderwerp | Wat je moet weten |
|---|---|
| Bron van waarheid voor Premium | **RevenueCat `customerInfo`** op het toestel (entitlement `VIBEZCORE Pro` of een dagpas van < 24 u). De backend (`/api/subscription-status`) is secundair en levert vooral bracelet-bezit. |
| Betalen | Uitsluitend in-app (Apple StoreKit / Google Play Billing) via RevenueCat (`react-native-purchases`). Geen Gumroad of Stripe in de app. |
| Account | Optioneel (gast-first). Kopen kan zonder account (Apple 5.1.1(v)). Account = Backup & Sync + Premium op andere toestellen. |
| Auth | Supabase Auth, maar de app praat via de backend-proxy `/api/auth-proxy` (e-mail, Google, Apple). Uitzonderingen rechtstreeks naar Supabase: e-mailverificatie, wachtwoordherstel/-wijziging, `user_data` (Backup & Sync), `play_events`. |
| Backend | Netlify Functions op `https://app.vibezcore.com/api/...` (repo `vibezcore-backend`) + Supabase (Postgres, EU) + Bunny CDN (audio). |
| Prijzen | Dagpas €1,29 (24 u) · Maand €9,99 · Jaar €69,99. Geen trial meer (vervallen 16 okt 2026). |
| Gratis | 10 gratis audiosessies; Breathwork en State Control: één gratis volledige sessie (na onboarding) en daarna 30 s-voorproef; Premium-audio: 60 s-voorproef. |
| Grootste open risico | Premium-audio wordt alleen in de app bewaakt: audio komt ongetekend rechtstreeks van Bunny (bypass in `src/utils/audio-url.ts`), zie B.4.2. |

---

### B.1 Toegangsmodel

#### B.1.1 Gebruikerstypes (zoals de code ze nu behandelt)

| Type | Hoe herkend | Audio Library | Breathwork | State Control | Horloge |
|---|---|---|---|---|---|
| **Gast** (geen account, niets gekocht) | geen token, geen gast-aankoopmarker | 10 `public`-sessies volledig; overige = 60 s-voorproef | 1 gratis volledige sessie, daarna 30 s-voorproef | 1 gratis volledige sessie (na onboarding), daarna 30 s-voorproef | Beide 30 s-voorproef |
| **Free met account** | token, geen actief recht | identiek aan gast (account ontgrendelt zelf niets, operator 8 okt 2026) | idem | idem | idem |
| **Premium (maand/jaar)** | RevenueCat-entitlement `VIBEZCORE Pro` actief | alles | alles | alles | alles (tot `entitledUntil`) |
| **Dagpas** | losse aankoop `vibezcore_day_pass(_24h)` < 24 u oud in `customerInfo.nonSubscriptionTransactions` | alles, 24 u | alles | alles | alles tot exact einde pas |
| **Gast-koper** (Premium of dagpas gekocht zonder account) | AsyncStorage-marker `vz_guest_purchase_rc_id` = anonieme RevenueCat-ID | alles | alles | alles | alles |
| **Bracelet-eigenaar** | backend `has_bracelet_activated=true` (`/api/subscription-status`) | alleen gratis (tenzij bundel) | Free-regels | **volledig** (`useStateFreeStart`: `ownsBracelet` → `full`) | `ownsBracelet` in catalogus |
| **Bundel** (bracelet + 1 jaar audio) | backend `bracelet_model='bundle'` | alles (`bundleAsPro` in `useSubscription`) | alles | alles | alles |

Bracelet = "Launching Early 2027"; activering en bundel zijn gebouwd maar in de praktijk nog niet in gebruik.

#### B.1.2 Waar de app beslist

| Bestand | Rol |
|---|---|
| `src/hooks/useSubscription.ts` | **De** bron voor `isPro`, `realIsPro`, `tier` (`monthly`/`yearly`/`day`), `validUntil`, `willRenew`, `store` (`APP_STORE`/`PLAY_STORE`), `billingIssueAt`, `hasBracelet`, `braceletModel`, `isLoading`. Module-cache + subscribers; AsyncStorage-cache `vz_sub_v3` (stale-while-revalidate) en aparte gast-cache `vz_sub_guest_v1` (alleen geldig met dezelfde gast-marker). |
| `src/utils/access-tier.ts` | Audio: `getEffectiveTier()` (`public` / `account` / `pro`), `resolveAccess()`, `needsPreview()` (één regel voor player, Continue, autoplay). |
| `src/data/audio-library-data.ts` | Per sessie `accessTier` (expliciet). Telling nu: 10 sessies `public` in de data (Beast Mode opener, Inner Child, Daily Affirmations opener, Identity, 3 soundscapes, Father/Mother Wound-opener, Machiavelli-opener), 1 restant `account` (wordt als PRO-badge getoond), 85 `pro`. |
| `src/hooks/useBreathFreeStart.ts` | Breathwork: `full` / `free-full` (setting `breathFreeSessionUsedAt` leeg) / `preview`. |
| `src/hooks/useStateFreeStart.ts` | State Control: idem met `stateFreeMode` + `stateFreeSessionUsedAt`; bracelet-eigenaar = `full`. |
| `src/constants/free-session-copy.ts` | Vaste teksten "Start 30-Second Preview", "Your one free full session". |
| `src/services/audio-player.ts` | `PREVIEW_CAP_SEC = 60` (audio-voorproef), daarna upsell. |
| `src/services/watch-catalog.ts` | Catalogus naar horloge met `entitledUntil` (`watchEntitledUntil()`: einde recht, +48 u speling bij automatisch verlengen, exact bij dagpas/opgezegd) en `ownsBracelet`. Horloge sluit zelf af zonder telefoon. |
| `src/utils/dev-user-override.ts`, `src/app/test-tier.tsx` | Testniveaus. `setTestTier()` werkt ALLEEN als de build met `EXPO_PUBLIC_VZ_TEST=1` gemaakt is (QA-build); in store-builds no-op. Dev-override alleen `__DEV__`. |

#### B.1.3 Hoe `useSubscription.fetchStatus()` beslist (volgorde)

1. **Geen token (gast):** alleen RevenueCat, en alleen als de gast-marker `vz_guest_purchase_rc_id` gelijk is aan de huidige `originalAppUserId` (`tryRevenueCatStatus(guestId)`). Zonder marker meteen Free, zonder SDK-call. Zo erft een uitgelogde gebruiker nooit Premium van een vorige gebruiker.
2. **Wel token:** parallel `tryRevenueCatStatus()` en `GET /api/subscription-status`.
   - RevenueCat actief → dat is de basis.
   - RevenueCat-call MISLUKT (SDK nog niet klaar, offline) en laatst bekende status was Premium → laatst bekende status behouden (`keepLastKnown`), mits niet verlopen.
   - Anders backend-status, anders cache. Verlopen `validUntil` telt nooit als actief (`withoutExpired`).
   - Bracelet-velden komen altijd van de backend (of uit cache als die faalt).
3. `notifyAll()` plant ook: dagpas-einde-timer (`scheduleDayPassEnd`, ververst exact op het einde) en de toegangsmeldingen (`syncAccessNotifications`).

Hulpfuncties die schermen gebruiken: `setProSubscribedStatus()` (meteen Premium na aankoop), `setSignedOutStatus()` (meteen Free bij uitloggen), `setSigningInStatus()` (laadtoestand bij inloggen, geen Free-flits), `refreshSubscription()`.

De dagpas zit **bewust NIET** op het entitlement: RevenueCat zou een losse aankoop anders levenslang actief tonen. De 24 u wordt in de app berekend vanaf `purchaseDate` (`activeDayPass()` in `src/services/iap-real.ts`, `DAY_PASS_MS` in `iap-contract.ts`).

#### B.1.4 Ontwerp versus realiteit (entitlements-backend)

`docs/ONTWERP_toegangsmodel.md` beschrijft een toekomstige `public.entitlements`- en `activation_codes`-tabel en provider-abstractie (Gumroad → Stripe). **Dat is niet gebouwd.** Wat wel bestaat in de backend: `users.has_bracelet` + `users.bracelet_model` en tabel `bracelet_activations` (zie B.4.4). §7 van dat document bevat 6 open operator-beslissingen: niet zelf invullen (CLAUDE.md §8).

Bekende open punten (WERKSTATUS 2 nov): bundel heeft geen einddatum in de backend (bundel = Premium zolang `bracelet_model='bundle'`); gast koopt en logt daarna in op een BESTAAND account → RevenueCat-overdracht nog op toestel testen.

---

### B.2 In-app aankopen

#### B.2.1 Architectuur

```
Scherm (subscribe.tsx, MembershipPlans, PremiumPaywallModal, Profile)
  → hooks/useIAP.ts (productcache, purchase(), restore())
    → services/iap.ts  getIAP()   — USE_MOCK_IAP = __DEV__
        ├─ services/iap-mock.ts   (dev: altijd ok, GEEN echte aankoop)
        └─ services/iap-real.ts   (release: RevenueCat react-native-purchases)
  Contract/typen: services/iap-contract.ts (IAPProvider, PRODUCT_IDS, tierFromProductId)
```

- `USE_MOCK_IAP = __DEV__`: een dev-build (`expo run:android`, development client) koopt NOOIT echt. Echte aankopen alleen testbaar in een store-/TestFlight-/interne-testbuild.
- `react-native-iap` is in juni 2026 volledig vervangen door RevenueCat (Nitro-crashes). Oude comments die nog naar `react-native-iap` of `/api/iap-verify` verwijzen zijn historisch.
- RevenueCat **Public SDK keys** komen uit `app.json` → `expo.extra.revenuecatApiKeyAndroid` / `revenuecatApiKeyIos` (gelezen via `expo-constants`). Publieke sleutels (prefix `goog_` / `appl_`), mogen in de client. Ontbreekt de sleutel → `init()` gooit een fout. Waarden: zie `app.json` / RevenueCat-dashboard, niet hier.
- `Purchases.configure()` gebeurt in `RealIAPProvider.init()`; `src/app/_layout.tsx` roept `getIAP().init()` vroeg aan en hangt een `addCustomerInfoUpdateListener` die `refreshSubscription()` triggert (renewals, restores, cross-device).

#### B.2.2 Product-ID's (`src/services/iap-contract.ts`)

| Tier | iOS (App Store Connect) | Android (Play Console) | Type |
|---|---|---|---|
| `monthly` | `vibezcore_audio_monthly` | `vibezcore_audio_monthly` (base plan `monthly`) | Auto-renewing abonnement |
| `yearly` | **`vibezcore_premium_yearly`** | `vibezcore_audio_yearly` | Auto-renewing abonnement |
| `day` | **`vibezcore_day_pass_24h`** — Non-Renewing Subscription | `vibezcore_day_pass` — eenmalig product (aankoopoptie `day-pass`), herhaalbaar | Losse aankoop, 24 u |

Waarom de iOS-afwijkingen:
- iOS-jaar: `vibezcore_audio_yearly` werd op 16 okt 2026 per ongeluk verwijderd in App Store Connect; Apple staat een verwijderde ID nooit opnieuw toe → nieuwe ID `vibezcore_premium_yearly`.
- iOS-dagpas: sinds 2 nov 2026 een **Non-Renewing Subscription** (`vibezcore_day_pass_24h`), het Apple-type voor tijdgebonden toegang. De oude iOS-Consumable `vibezcore_day_pass` wordt niet ingediend. `isDayPassProductId()` herkent beide ID's (sandbox-aankopen, cross-platform).
- RevenueCat geeft Play-producten terug als `<product>:<base_plan>` (bv. `vibezcore_audio_yearly:yearly`); `tierFromProductId()` en `requestSubscription()` strippen het deel na `:`.
- `subscriptionTierFromEntitlement()` valt terug op naam (`year`/`annual`/`month`) en looptijd (25–40 d = maand, 330–400 d = jaar) als een product-ID onbekend is.

**Niet verwarren:** nooit de Android-ID op iOS gebruiken of omgekeerd; nooit "Google" tonen op iPhone of "Apple" op Android (App Review 2.3.10, zie B.2.8).

#### B.2.3 RevenueCat-configuratie

| Instelling | Waarde | Bron |
|---|---|---|
| Entitlement identifier | **`VIBEZCORE Pro`** (met spatie, hoofdletters; onveranderbaar; weergavenaam "audio_pro") | `ENTITLEMENT_AUDIO_PRO` in `iap-real.ts` |
| Gekoppeld aan entitlement | maand + jaar, beide stores. **Dagpas NIET.** | `docs/IOS_TESTRONDE_BUILD20.md` |
| Offering | `default` (de app gebruikt `offerings.current`) | idem |
| Packages | `$rc_monthly`, `$rc_annual`, `day_pass` (Custom), elk met een Play- en een App Store-product | idem |
| Transfer-gedrag | "Transferring purchases seen on multiple App User IDs" = **Keep with original App User ID** (door operator gezet 27 okt 2026) | WERKSTATUS |
| Webhook | naar `https://app.vibezcore.com/api/iap-webhook`, Authorization-header = Netlify-variabele `REVENUECAT_WEBHOOK_AUTH` | `netlify/functions/iap-webhook.js` |
| App User ID | anoniem (`$RCAnonymousID:...`) tot inloggen; daarna `Purchases.logIn(<Supabase auth.users.id>)` | `services/auth.ts` |
| App Store Connect API-sleutel in RevenueCat | stond 16 okt nog niet ("Could not check") — optioneel | build20-doc |

#### B.2.4 Prijzen

| Product | Prijs (BE, incl. btw) | Opmerkingen |
|---|---|---|
| Dagpas | €1,29 / 24 u | Play: "bulk bewerken" rekent ingetypte prijs als excl. btw (gaf €1,59) → België handmatig op €1,29 incl. btw. Play VS: dagpas $1,19 gemeld (28 okt). |
| Maand | €9,99 | Geen intro-aanbieding. App Store: niveau 2 in groep. |
| Jaar | €69,99 | Aanbevolen keuze in UI. App Store: niveau 1, Family Sharing aan. VS-prijs: bronnen spreken elkaar tegen ($69,99 manueel volgens WERKSTATUS 16 okt; $59,99 in build20-doc) → in App Store Connect nakijken. |

- De app toont **altijd de store-prijs** (`localizedPrice`, `regularPriceLabel` uit RevenueCat) — nooit een hardgecodeerd bedrag (memory "WYSIWYG pricing"). Zonder store-data een streepje.
- Trial/intro: code kan nog trial-dagen en introprijzen tonen als de store ze meldt en de klant er recht op heeft (`extractFreeTrialDaysFromPackage`, `extractIosIntro`, `checkTrialOrIntroductoryPriceEligibility`). Sinds 16 okt staan er geen trials/intro's in de stores, dus de UI toont niets.
- Prijsbesparing "save X%" wordt live uit de twee store-prijzen berekend (`PlanCard` in `account.tsx`).

#### B.2.5 Aankoopflow (`src/app/subscribe.tsx`)

Ingangen: `/subscribe`, `/subscribe?tier=monthly|yearly|day` (tier in de link = meteen de kassa), `&from=nudge`. Alle verkoopkaarten en popups leiden naar dit ene scherm — er is maar één aankoopflow.

1. Status kort afwachten (max 2 s) zodat een bestaande abonnee niet een store-"al geabonneerd"-fout krijgt; **nooit automatisch afrekenen zolang de status laadt** (audit 2 nov: anders dubbele dagpas mogelijk).
2. Geen account nodig: niet-ingelogd → `setGuestPurchase(true)` → `runIapFlow()`. Account wordt NA de aankoop aangeboden.
3. `getIAP().requestSubscription(tier)` → `Purchases.purchasePackage(pkg, null, productChangeInfo)`.
   - Android maand↔jaar: `productChangeInfo` met `STORE_REPLACEMENT_MODE.WITH_TIME_PRORATION` (Google ziet twee aparte abonnementen). iOS regelt upgrade binnen de abonnementsgroep zelf.
   - Abonnement uit de **andere** winkel (`isOtherStore(store)`): niet in-app wisselen; beheer via `managementURL`.
4. `verifyAndComplete()`: **geen backend-verificatie meer**; RevenueCat heeft de bon al server-side gevalideerd. Bevestiging = entitlement actief, of (bij dagpas) `activeDayPass()`. Tot 3 extra pogingen met `Purchases.syncPurchases()` + wachttijd 0,7/1,4/2,1 s.
5. Bij succes:
   - gast → `markGuestPurchase(originalAppUserId)`;
   - `setProSubscribedStatus()` (meteen Premium in alle schermen) + `refreshSubscription()`;
   - bestaande doelen/intensiteit → plan automatisch opgebouwd (`generateProtocol` + `saveActivePlan`) als er nog geen plan is;
   - `markPlanOfferPending()` → later "Set your plan / Set your goal" op het tabblad (B.2.9);
   - fase `done` = `PurchaseConfirm`-kaart (geen auto-redirect).
6. Niet bevestigd / fout: `queuePendingVerify()` (AsyncStorage `@vzc:iap:pending-verifies`, max 5) + melding "Your purchase went through… tap Restore Purchases in Profile". Bij volgende start doet `recoverOnStartup()` (`src/services/iap-recovery.ts`) `syncPurchases` + `getCustomerInfo` en ruimt de wachtrij op. **Geen stille `restorePurchases` bij elke start** (lek-risico + Apple ID-popup, account-audit 7 okt).
7. Foutteksten via `src/utils/friendly-error.ts` (geen ruwe RevenueCat-tekst zoals "another active subscriber using the same receipt"; geen Google/Apple-woorden op het verkeerde platform).

`verifyWithRetry()` / `/api/iap-verify` bestaan nog in code en backend maar zitten niet meer in het pad: RevenueCat-ID's worden door `/api/iap-verify` met 400 geweigerd.

#### B.2.6 Restore en abonnementsbeheer

| Functie | Bestand | Gedrag |
|---|---|---|
| `restorePurchases()` | `src/services/restore-purchases.ts` | Knop "Restore Purchases" (Profile, MembershipPlans, paywall). Ingelogd → eerst `linkRevenueCatUser`; dan `Purchases.restorePurchases()`; een lopende dagpas komt ook terug. Fouten worden gegooid (niet "Nothing to restore" bij netwerkfout = geen dubbel-betaal-risico). Restore zonder account biedt daarna het gratis account aan. |
| `silentRestoreAfterLogin()` | idem | Na e-mail/Google/Apple-login automatisch (weer aan sinds 27 okt, veilig door "Keep with original App User ID"). Stil, geen popups. |
| `openManageSubscriptions()` | `src/services/subscription-actions.ts` | Andere winkel → `customerInfo.managementURL`. iOS → `Purchases.showManageSubscriptions()` (Apple-blad in de app) + `refreshAfterStoreChange()` (cache invalideren, na 8 s nog eens). Terugval: `itms-apps://apps.apple.com/account/subscriptions` (iOS) of `https://play.google.com/store/account/subscriptions` (Android, bewust generiek — SKU-deeplink gaf "niet gevonden"). |
| `isOtherStore(store)` | idem | `APP_STORE` op Android of `PLAY_STORE` op iOS → plankaart zegt "Bought on an iPhone/Android phone. Change or cancel it in the App Store/Google Play." |

Account verwijderen zegt expliciet dat het het store-abonnement NIET opzegt.

#### B.2.7 Paywall-schermen en -componenten

| Component / scherm | Bestand | Wat |
|---|---|---|
| Aankoopscherm | `src/app/subscribe.tsx` (~2300 regels) | Kassa, account-na-aankoop, upgrade naar jaar (`upgradeToYearly`), restore, foutafhandeling. |
| Abonnementskaart | `src/components/MembershipPlans.tsx` | Eén kaart voor Library-blok, `/subscribe` en popup: twee tegels (maand/jaar), dagpas als brede rij eronder. Apple 3.1.2: afgeschreven bedrag het grootst, verlengtekst vóór de knop (iOS: "…cancel at least 24 hours before the end…App Store account settings"; Android: "…Google Play › Subscriptions"), links Terms of Use (`/legal/terms`), Privacy Policy (`/legal/privacy`) en Restore Purchases. |
| Premium-popup | `src/components/PremiumPaywallModal.tsx` | Donker glasblad met dezelfde MembershipPlans; `context` bepaalt eyebrow/volgorde voordelen; `onBeforeNavigate` verkleint eerst een lopende ademsessie. |
| Bevestiging | `src/components/PurchaseConfirm.tsx` | Glazen kaart na aankoop/activering. |
| Profiel-plankaart | `PlanCard()` in `src/app/(tabs)/account.tsx` | Per situatie: Free → "See plans"; Dagpas → "Keep full access"; Maand → "Switch to Yearly · save X%" + Manage; Opgezegd → einddatum + "Turn renewal back on" (+ "Or switch to Yearly" bij maand); Jaar → Manage; Bundel → inbegrepen; andere winkel → beheer daar. |
| Premium-label | `src/components/PremiumPill.tsx`, `PremiumNote.tsx` | Kleine Premium-aanduidingen. |
| Account-muur (legacy) | `src/components/AccountWallModal.tsx` | Voor `account`-tier; nu praktisch ongebruikt (1 sessie). |

#### B.2.8 Winkelregels (niet onderhandelbaar)

- iPhone noemt nooit Google/Android; Android noemt nooit Apple (App Review 2.3.10). Teksten kiezen per `Platform.OS` (`MembershipPlans`, `legal-content.ts` met `IOS`/`WEB`, delete-dialoog "App Store"/"Google Play").
- Kopen zonder account moet kunnen (5.1.1(v)); in-app account verwijderen moet kunnen (5.1.1(v)) inclusief intrekken van het Apple-token.
- Opzeggen/wijzigen enkel via de winkel (de app annuleert niets zelf).
- Abonnementen + dagpas worden samen met de app-versie ingediend, elk met App Review-screenshot (2.1(b)).
- Terms-link in de App Store-beschrijving én in de app (3.1.2(c)).
- Support-URL `https://www.vibezcore.com/support` moet 200 geven (1.5).

#### B.2.9 Na de aankoop: plan-aanbod

`src/utils/plan-offer.ts` + `src/components/PlanOfferHost.tsx` (gemount in root-layout): na een **échte nieuwe** aankoop (niet bij herstel, behalve in QA-build) krijgt de gebruiker niet op het aankoopscherm maar op het tabblad zelf een glasblad:
- State Control (na hartslagkeuze): "Set your plan" → `/bracelet-set-day`;
- Breathwork (keuzepagina): "Set your goal" → `/build-choice`.
Eén keer per tabblad per toestel, niet als er al een plan is. AsyncStorage: `vz_plan_offer_pending_v1`, `vz_plan_offer_seen_v1`.

#### B.2.10 Verkoopduwtjes en win-back

`src/services/sales-nudges.ts` (boekhouding, sleutel `vz_sales_nudges_v1`, blijft bij uitloggen — hoort bij het toestel) + `src/components/SalesNudgeHost.tsx` (wanneer + blad):

| Kaart | Regel |
|---|---|
| **Day Pass-kaart** | Alleen Free zonder bracelet. Na **60 s actief rondkijken** in één app-opening (voorgrond, geen onboarding/sessie/voorproef, Audio Library speelt niet, geen ander blad). **Eén keer per kalenderdag**, geen totaalmaximum (gewijzigd 2 nov 2026; de header-comment in SalesNudgeHost.tsx noemt nog de oude regel "1× per 7 d, 3× totaal" — `dayPassCapAllows()` is leidend). Niet binnen 2 min na een andere saleskaart, niet binnen 2 u na een aankoop. Knop → `/subscribe?tier=day&from=nudge`. |
| **Welcome Back** | Wie een abonnement had dat verlopen is (RevenueCat-entitlement in `all` maar niet actief; vangnet: bewaarde `wasPro` voor hetzelfde account). Eén keer per verlopen abonnement, bij app-opening, nooit tijdens een sessie. Geen korting, geen push. |

Win-back-strategie (operator 19 okt): (1) opgezegd-maar-actief → verliesframing op plankaart ✔ in app; (2) betaling mislukt → **grace period aanzetten in Play Console en App Store Connect** (instelling, status in consoles nakijken); (3) net verlopen → Welcome Back ✔; (4) korting enkel na ~30 d, één keer, via officiële store-offers (Apple win-back offers / Google developer-determined offers) — nog niet ingesteld volgens beschikbare docs.

Los hiervan: `src/components/WelcomeBackPopup.tsx` + `services/welcome-popup.ts` = "Continue listening"-popup van de Audio Library (alleen bij tik op "Last Listened"), niet de win-back.

#### B.2.11 Meldingen rond het einde van toegang

`src/services/access-notifications.ts` (teksten goedgekeurd 29 okt), herberekend bij elke statuswijziging, vaste ID's, vraagt zelf geen toestemming:

| ID | Moment | Tik opent |
|---|---|---|
| `vz-access-daypass` | 1 u vóór einde dagpas | aankoopscherm |
| `vz-access-ending` | 2 dagen vóór einde opgezegd maand-/jaarabonnement | aankoopscherm |
| `vz-access-billing` | één keer per betaalprobleem (`billingIssueDetectedAt`) | store-beheer |

Geen melding vóór een gewone verlenging (bewuste keuze).

---

### B.3 Auth en accounts

#### B.3.1 Overzicht

| Onderdeel | Bestand | Pad |
|---|---|---|
| Kern | `src/services/auth.ts` | `VZ_BACKEND_URL = 'https://app.vibezcore.com'`; alle login/signup/refresh/google/apple via `POST /api/auth-proxy?action=<actie>` (query-param bewust in de client-URL; Netlify-alias gaf 400). |
| Social | `src/services/social-auth.ts` | Google: `@react-native-google-signin/google-signin` met `extra.googleWebClientId` (+ `googleIosClientId` op iOS, toegevoegd 2 nov 2026). Apple: `expo-apple-authentication`, enkel iOS, stuurt `identityToken` + `authorizationCode`. |
| Account-tab | `src/app/(tabs)/account.tsx` | Inloggen/aanmaken (e-mail, Google, Apple), PlanCard, Restore, Manage, Change password, Sign out, Delete account, bracelet-activatie-link. |
| Wachtwoord | `src/app/forgot-password.tsx`, `reset-password.tsx`, `change-password.tsx` | Rechtstreeks naar Supabase `/auth/v1/recover`, `/verify`, `/user`, `/token?grant_type=password`. |
| Deeplinks | `src/app/auth-callback.tsx`, `src/app/_layout.tsx` | Scheme `vibezcoreapp://` (app.json). |
| Lokale wis | `src/services/local-data.ts` | "Clear all local data" en na delete-account; gast-aankoopkoppeling (`vz_guest_purchase_rc_id`, `vz_pending_rc_link`) blijft altijd staan. |
| Uitnodiging | `src/utils/account-invite.ts`, `src/components/AccountInviteCard.tsx` | Zachte kaart op Activity, enkel gast, enkel na een echte sessie, "Maybe later" = 7 d pauze, max 2×. |

Supabase-config in de app: `src/constants/supabase.ts` (`SUPABASE_URL` = project `zotxpyjvcamnlzwdgceh`, plus publishable key — veilig in client, RLS-beschermd; waarde niet hier overnemen). De **service-role key** staat alleen in Netlify.

#### B.3.2 Sessie en tokens

AsyncStorage-sleutels (`auth.ts`): `vz_session_token` (access JWT ~1 u), `vz_refresh_token`, `vz_token_expires_at`, `vz_user_email`, `vz_last_login_email`, `vz_auth_provider` (`email`/`google`/`apple`), `vz_pending_rc_link`, `vz_guest_purchase_rc_id`.

- `getToken()` ververst automatisch als < `REFRESH_MARGIN_SEC` over is (single-flight `refreshInFlight`). Sessie wordt alleen gewist bij echte intrekking (401, of 400 `invalid_grant`/`refresh_token_not_found`); netwerk-/5xx-fouten houden de sessie.
- Time-outs (`AUTH_ATTEMPTS`): login/refresh 12 s, 2 pogingen (koude Netlify-start ~18 s gemeten); signup/google/apple 25 s, 1 poging (niet herhaalbaar).
- Inloggen wordt nooit vereist om rond te kijken (gast-first, CLAUDE.md §3).

#### B.3.3 RevenueCat-koppeling bij in-/uitloggen

`linkRevenueCatUser(userId)` (awaited na elke login/signup/google/apple, zodat een aankoop direct op het juiste ID komt):
1. `getIAP().init()` eerst.
2. **Lekbescherming (v237c):** is de huidige RevenueCat-klant anoniem, heeft hij een actief entitlement, is het niet dezelfde gebruiker én niet de eigen gast-aankoop van dit toestel → `logIn` overslaan (anders zou een abonnement van iemand anders op hetzelfde Apple/Google-account naar dit VIBEZCORE-account verhuizen). Gebruiker kan dan zelf Restore tikken.
3. `Purchases.logIn(<auth.users.id>)`; daarna marker `vz_pending_rc_link` + gast-marker wissen.
4. Mislukt → `vz_pending_rc_link` bewaren; `retryPendingRcLink()` bij AppState=active (`_layout.tsx`).

`unlinkRevenueCatUser()` bij uitloggen: `Purchases.logOut()` → verse anonieme klant. `relinkAfterSessionChange()` na sessies die buiten login ontstaan (deeplink, wachtwoordreset).

#### B.3.4 Deeplinks en e-mail

| Link | Doel |
|---|---|
| `vibezcoreapp://auth-callback?token_hash=…&type=recovery|invite|…` | `auth-callback.tsx` → Supabase `/auth/v1/verify` → sessie opslaan → `needs_password_setup` → `/reset-password`, anders `/`. |
| `vibezcoreapp://reset-password?token_hash=…` | `reset-password.tsx`. |
| `vibezcoreapp://account` | na "Password updated" op de webpagina. |
| `redirect_to` bij wachtwoordherstel | `https://account.vibezcore.com/auth.html` (`forgot-password.tsx` `REDIRECT_TO`); moet in Supabase › Auth › Redirect URLs staan. |

Deze deeplinks zijn in `_layout.tsx` uitgezonderd van de "gast → welkomstscherm"-omleiding en gaan vóór de "laatst gebruikte tab"-logica.

- **Referrer-valkuil Bunny:** pull zone `vibezcore-audio` laat alleen Referer `vibezcore.com` toe (hotlink-bescherming) → een pagina daarop geeft 403 vanuit Gmail/Outlook. Daarom staat de auth-pagina op een eigen pull zone `vibezcore-account` (zelfde storage, geen referrer-limiet), hostname `account.vibezcore.com` (CNAME → `vibezcore-account.b-cdn.net`). Nieuwe mail-links altijd testen met `curl -H "Referer: https://mail.google.com/"` en `outlook.live.com`. Native app stuurt geen Referer → audio werkt.
- Supabase "Confirm email" staat **UIT** sinds 8 okt 2026 (meteen inloggen na signup). Wachtwoordreset loopt wel via mail.
- Mailtemplates (bron): `docs/email-templates/confirm-signup.html`, `reset-password.html` — te plakken in Supabase › Auth › Email Templates. Mails gaan via custom SMTP (Zoho, `info@vibezcore.com`; config in Supabase-dashboard, niet in code — afgeleid uit handover).
- De oude webapp (HTML op `app.vibezcore.com`) wordt nooit getoond of naar gelinkt (memory "webapp never shown"); alleen `/api` wordt gebruikt.

#### B.3.5 Sign in with Apple (incl. intrekking)

- App: `signInWithApple()` → `loginWithApple(idToken, undefined, authorizationCode)` → `POST /api/auth-proxy?action=apple` met `id_token` en `authorization_code`.
- Backend: `auth-proxy.js` voert Supabase `grant_type=id_token` uit; bij succes ruilt `netlify/lib/apple-siwa.js` de `authorization_code` bij Apple in voor een refresh token en bewaart die in `public.apple_tokens` (alleen service role, RLS aan zonder policies).
- `delete-account.js` roept `appleSiwa.revokeForUser()` aan vóór het verwijderen (App Review 5.1.1(v)).
- Netlify-variabelen: `APPLE_SIWA_KEY_ID` (publieke Key ID, standaard `3VS353U3RM`), `APPLE_SIWA_PRIVATE_KEY` (inhoud .p8 — **geheim, nooit in git**; mag op één regel geplakt), `APPLE_TEAM_ID` (standaard `88AL3UW7L7`), `APPLE_CLIENT_ID` (standaard `com.ubili.vibezcoreapp`). Zonder deze variabelen doet de module stil niets.
- Supabase › Auth › Providers › Apple moet aan staan (stond uit → inlogfout, opgelost als T313). Google: Web-client-ID + iOS-client-ID in Supabase › Google › Client IDs. Android Google-login vraagt ook de **Play App Signing SHA-1** in Google Cloud (stond 28 okt nog als operator-taak).

#### B.3.6 Account verwijderen

`deleteAccount()` (`auth.ts`) → `POST /api/delete-account` met Bearer token. Backend verifieert het token bij Supabase (handtekening + verloop, niet enkel JWT-decode — fix `4c2eb67`), trekt Apple-token in, verwijdert `auth.users` via admin-API; cascade wist `user_data`, `apple_tokens`; `public.users.auth_user_id` → NULL (FK `on delete set null`; afgeleid). App: dubbele bevestiging, stopt afspelen/sessies, `clearSession()`, `clearAllLocalData`, wist `vz_last_login_email`. Website heeft ook `/delete-account` (`docs/website-pages/delete-account.html`).

#### B.3.7 Backup & Sync

| Item | Waarde |
|---|---|
| Code | `src/services/cloud-sync.ts` (I/O, triggers) + `src/services/cloud-sync-core.ts` (beslissingen/merge, unit-tests) |
| Opslag | Supabase-tabel `public.user_data` (één rij per gebruiker per `key`, JSONB `value`, `updated_at` door servertrigger) |
| SQL | `docs/backend/user-data-migration.sql` (idempotent, door operator in Supabase SQL Editor gedraaid; tweede blok breidt de CHECK-lijst uit met `state_history`, `audio`) |
| Keys | `settings`, `resting_pulse`, `breath_history`, `plan` (incl. State Control-plan `statePlan`), `state_history`, `audio` (favorieten, beluisterd, hervatposities) |
| Toegang | Rechtstreeks `SUPABASE_URL/rest/v1/user_data` met publishable key + gebruikers-JWT; RLS: elk alleen eigen rijen; `anon` heeft geen rechten |
| Wanneer | ~kort na start, bij voorgrond (max 1×/20 s), bij verlaten, bij in-/uitloggen, poll elke 15 s maar netwerk alleen bij lokale wijziging of > 10 min sinds laatste controle |
| Gast → account | Eerste sync op een account neemt de lokale gastgegevens over (niets kwijt) |
| Merge | vereniging, nooit verlies; verwijderde favorieten/sessies blijven weg |
| Legacy | Oude `bracelet_sessions` (`/api/bracelet/sessions/sync`, `src/utils/bracelet-history-sync.ts`) wordt één keer geïmporteerd (`importLegacyStateSessions`); daarna is `user_data` de enige bron |
| Bewezen | A16 met echt account 26–29 okt (alle 6 onderdelen terug na wissen + inloggen) |
| Privacy-formulieren | `docs/PRIVACY_FORMULIEREN_BACKUP_SYNC.md` (Play Data safety + App Store-privacylabel) |

Ook rechtstreeks naar Supabase: `src/utils/play-events.ts` → `rest/v1/play_events` (anonieme afspeel-telling met device-UUID, geen account; SQL `docs/supabase-play-events-migration.sql`).

> Let op CLAUDE.md §1 "provider-agnostisch / backend niet wijzigen": deze directe Supabase-aanroepen zijn bewuste, door de operator goedgekeurde uitzonderingen (auth-verify 27 mei; `user_data` 26 okt). Een nieuwe tabel = eerst operator-akkoord.

---

### B.4 Backend

#### B.4.1 Hosting en repo

| Item | Waarde |
|---|---|
| Repo | `https://github.com/ulgarbilican-dotcom/vibezcore-backend` (lokaal `C:\Users\ulgar\vibezcore-backend`) — **NOOIT wijzigen** zonder expliciete operator-toestemming |
| Hosting | **Netlify**, site `vibezcore-backend`, custom domain `app.vibezcore.com`; functies in `netlify/functions` (esbuild), statische map `public/` (oude webapp — niet tonen) |
| Deploy | push naar GitHub → Netlify auto-deploy (handover: branch `main`) |
| Routering | `netlify.toml` `[[redirects]]` `/api/...` → `/.netlify/functions/...`; `Cache-Control: private, no-store` op `/api/audio-url` en `/api/auth-proxy` |
| Database | Supabase project `zotxpyjvcamnlzwdgceh` ("vibezcore-audio-library"), regio eu-west-1 (Ierland); free tier |
| Laatste backend-commits | `f19217b` (apple-siwa .p8 op één regel), `f02534b`, `cf73b85` (Apple-intrekking), `4c2eb67` (token-verificatie delete/cancel) |

Dashboards en accounts: zie `docs/OPERATOR_HANDOVER.md` §3–§8 (privé, gitignored; bevat ook wachtwoorden — nooit kopiëren).

#### B.4.2 Endpoints

| Endpoint | Methode | Gebruikt door app? | Wat het doet |
|---|---|---|---|
| `/api/auth-proxy?action=login|signup|refresh|google|apple` | POST | **Ja** (`auth.ts`) | Proxy naar Supabase Auth (password / signup / refresh_token / `grant_type=id_token`). Maakt indien nodig de `public.users`-rij aan (`auth_user_id`, `email`). Apple: bewaart refresh token via `apple-siwa`. |
| `/api/subscription-status` | GET (Bearer) | **Ja** (`useSubscription.fetchBackendStatus`) | `{active, tier, status, email, valid_until, will_renew, platform, has_bracelet_activated, bracelet_model}` uit `subscriptions` + `users`. Secundaire bron; enige bron voor bracelet. |
| `/api/audio-url?path=…|session=…[&preview=true]` | GET (Bearer optioneel) | **In de praktijk niet** — zie de bypass hieronder | Ondertekent Bunny-URL (token = base64(MD5(security_key + path + expires)), TTL **4 u**). Locked sessie zonder `preview` → vereist actief abonnement in `subscriptions` (401/402). `preview=true` → ondertekent zonder auth. Logt in `listen_history` (niet bij preview). |
| `/api/delete-account` | POST (Bearer) | **Ja** | Zie B.3.6. |
| `/api/bracelet/activate` | POST (Bearer) | Ja (`services/bracelet-activation.ts`, `src/app/activate-bracelet.tsx`) | Code (12 tekens, streepjes genegeerd) → `bracelet_activations`; zet `users.has_bracelet`, `bracelet_model`; 400 `invalid_code`/`already_used`. |
| `/api/bracelet/sessions/sync` | POST | Alleen nog legacy-import | Oude State Control-geschiedenis (`bracelet_sessions`). |
| `/api/iap-webhook` | POST | Nee (server-to-server) | RevenueCat-webhook (header-check `REVENUECAT_WEBHOOK_AUTH`, constant-time) + Apple ASN V2 + Google RTDN. Upsert `subscriptions` (platform `ios`/`android`, `product_id`, `transaction_id`, …). Negeert anonieme `$RCAnonymousID`-gebruikers; TRANSFER zet vorige eigenaar uit. |
| `/api/iap-verify` | POST (Bearer) | **Nee meer** | Oude client-receipt-verificatie (Apple verifyReceipt / Google Play API). Weigert RevenueCat-ID's. Legacy. |
| `/api/support` | POST | Nee (app opent `https://www.vibezcore.com/support`; de Wix-supportpagina gebruikt Web3Forms) | Stuurt bericht via Zoho SMTP naar `SUPPORT_INBOX`. |
| `/api/gumroad-webhook`, `/api/sync-subscriptions`, `/api/cancel-subscription` | — | Nee | Gumroad-tijdperk (webapp). App is IAP-only; geen actieve Gumroad-abonnees (memory 12 jun). |

Aandachtspunten (afgeleid, niet in productie geverifieerd):
- `iap-webhook.js` kent bij tier-mapping alleen `vibezcore_audio_yearly` / `_monthly` → iOS-jaar `vibezcore_premium_yearly` krijgt in de backend geen `tier`. Geen impact op toegang (app leest RevenueCat), wel op backend-rapportage.
- **Audio-signing staat uit (belangrijk).** `getSignedAudioUrl()` in `src/utils/audio-url.ts` geeft elke URL op `vibezcore-audio.b-cdn.net` rechtstreeks terug (of de `/app-16lufs/`-kopie) zonder `/api/audio-url` aan te roepen ("DEV bypass", iter v133, juni 2026, nooit teruggedraaid). Gevolg: de Audio Library speelt rechtstreeks van Bunny (native app stuurt geen Referer → referrer-filter laat door) en Premium-audio wordt **alleen in de client** bewaakt (`needsPreview` + `PREVIEW_CAP_SEC = 60`). De signing-code en de 4-uurs URL-cache bestaan nog maar worden enkel bereikt voor URL's buiten die host. Dit is de geparkeerde kwestie **"Premium-audio beveiligen"** (16 okt; backend-toestemming gegeven; plan: Bunny token-zone + `/api/audio-url` dat ook RevenueCat/dagpas/gast-koper begrijpt — memory `project-premium-audio-protection`). Let op: de backend kent de dagpas en de gast-koper niet, dus de bypass simpelweg verwijderen zou betalende dagpas-/gast-kopers blokkeren.
- Dagpas (losse aankoop) komt niet in `subscriptions`; de backend kent de dagpas niet.
- De gast-koper zonder account wordt door de webhook genegeerd (anoniem) — ontworpen zo; toegang komt uit RevenueCat.

#### B.4.3 Netlify-omgevingsvariabelen (alleen NAMEN, uit `process.env` in de code)

| Variabele | Gebruikt in | Doel |
|---|---|---|
| `SUPABASE_URL` | bijna alle functies | Project-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | alle DB-functies | Service role (omzeilt RLS) — **geheim** |
| `SUPABASE_ANON_KEY` | auth-proxy | Auth-aanroepen namens gebruiker |
| `BUNNY_CDN_HOSTNAME` | audio-url | Hostname van de ondertekende pull zone |
| `BUNNY_TOKEN_SECURITY_KEY` | audio-url | Bunny token-authenticatiesleutel — **geheim** |
| `REVENUECAT_WEBHOOK_AUTH` | iap-webhook | Gedeeld geheim voor de RevenueCat Authorization-header |
| `APPLE_SHARED_SECRET`, `APPLE_BUNDLE_ID` | iap-verify / iap-webhook | Oude receipt-verificatie / ASN |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_PACKAGE_NAME` | iap-verify / iap-webhook | Google Play Developer API / RTDN |
| `APPLE_SIWA_KEY_ID`, `APPLE_SIWA_PRIVATE_KEY`, `APPLE_TEAM_ID`, `APPLE_CLIENT_ID` | lib/apple-siwa | Sign in with Apple-intrekking |
| `ZOHO_EMAIL`, `ZOHO_APP_PASSWORD`, `ZOHO_SMTP_HOST` (default `smtp.zoho.eu`), `SUPPORT_INBOX` | support | SMTP-verzending |
| `GUMROAD_ACCESS_TOKEN`, `GUMROAD_SELLER_ID` | gumroad-* | Legacy |

`.env.example` in de backend-repo is onvolledig (alleen Supabase/Gumroad/Bunny). De env-tabel in `OPERATOR_HANDOVER.md` §4.2 gebruikt deels andere (verouderde) namen; bovenstaande lijst komt rechtstreeks uit de code en is leidend.

App-kant (geen Netlify): `app.json` `extra.revenuecatApiKeyAndroid|Ios`, `googleWebClientId`, `googleIosClientId`; build-env `EXPO_PUBLIC_VZ_TEST` (QA-build), `SENTRY_DISABLE_AUTO_UPLOAD` (eas.json). EAS-submit: `eas.json` › `submit.production` (Apple ID, `ascAppId 6791124857`, Team `88AL3UW7L7`; Android service-account-JSON-pad, `track: internal`, `releaseStatus: draft`). Service-account-bestanden/`credentials.json` staan in `.gitignore`.

#### B.4.4 Supabase-schema

Uit `vibezcore-backend/supabase/migrations/` + `vibezcore-app/docs/backend/` + `docs/supabase-play-events-migration.sql`:

| Tabel | Kolommen (kern) | Wie schrijft | RLS / opmerkingen |
|---|---|---|---|
| `auth.users` | Supabase-beheerd | Supabase Auth | — |
| `public.users` | `id` (surrogaat, ≠ auth-id), `auth_user_id` (UNIQUE, FK auth.users ON DELETE SET NULL), `email` UNIQUE, `full_name`, `has_bracelet`, `bracelet_model` (`bracelet`/`bundle`) | auth-proxy, webhooks, bracelet-activate | service role |
| `public.subscriptions` | `user_id` → users.id (cascade), `tier` (`monthly`/`yearly`), `status` (`active`/`cancelled`/`ended`), `valid_until`, `will_renew`, `cancelled_at`, Gumroad-velden; **live DB heeft ook** `platform` (CHECK `ios`/`android`/`gumroad`/`stripe`), `product_id`, `transaction_id`, `original_transaction_id` (afgeleid uit webhook-code; niet in de migraties in de repo) | iap-webhook (RevenueCat), Gumroad | upsert `on_conflict=user_id` → één rij per gebruiker |
| `public.audio_sessions` | `id`, `series_slug`, `title`, `bunny_path`, `is_locked`, `sort_order` | handmatig | gebruikt door `/api/audio-url` voor lock-check |
| `public.listen_history` | `user_id`, `session_id`, `played_at` | audio-url | best-effort |
| `public.bracelet_activations` | `code` UNIQUE, `model`, `batch`, `user_id`, `activated_at` | bracelet-activate | **seed-testcodes (`TEST…`, `BUNDLE…`, batch `closed-testing`) staan in de migratie — vóór bracelet-lancering verwijderen** |
| `public.apple_tokens` | `auth_user_id` PK (cascade), `refresh_token` | auth-proxy | RLS aan, geen policies (alleen service role) |
| `public.user_data` | `user_id` (default `auth.uid()`, cascade), `key`, `value` JSONB, `updated_at` | app (REST, eigen JWT) | RLS select/insert/update/delete own; geen rechten voor `anon` |
| `public.bracelet_sessions` | per sessie, client-UUID | legacy sync | `docs/backend/bracelet-sessions-migration.sql` |
| `public.play_events` | `session_id`, `played_at`, anonieme device-token, `duration_seconds` | app (anoniem) | geen user-ID |

#### B.4.5 Bunny CDN

- Audio: pull zone/storage `vibezcore-audio` (`https://vibezcore-audio.b-cdn.net`), Allowed Referrers = alleen vibezcore.com (lege Referer = 200). De backend-comment zegt dat token-authenticatie op de hele zone aan staat; omdat de app ongetekende URL's afspeelt en dat werkt, staat token-auth in de praktijk **uit** op deze zone (afgeleid — in het Bunny-dashboard nakijken vóór je aan de audio-beveiliging begint).
- Genormaliseerde audio (−16 LUFS) in map `/app-16lufs/`; lijst `src/data/normalized-audio.ts` (140 van 144 sessies). `src/utils/audio-url.ts` mapt naar die paden.
- Auth-webpagina: aparte pull zone `vibezcore-account` → `account.vibezcore.com` (zie B.3.4).
- Afbeeldingen ook op Bunny; Optimizer niet actief. Kosten pay-as-you-go.

#### B.4.6 E-mail (Zoho)

`info@vibezcore.com` op Zoho Mail (EU). Gebruikt voor: Supabase custom SMTP (bevestigings-/resetmails) en `/api/support`. Website-supportformulier gebruikt **Web3Forms** (zie `docs/website-pages/support.html`). DKIM/DMARC-controle stond als aanbeveling in de handover (§18.7).

---

### B.5 Stores en zakelijke setup (stand 3 nov 2026, bron: `docs/WERKSTATUS.md`)

#### B.5.1 Google Play Console

| Item | Stand |
|---|---|
| Ontwikkelaarsaccount | **Particulier** (geen KBO/zelfstandige) — afgemaakte keuze, niet opnieuw ter discussie stellen (memory) |
| Package | `com.ubili.vibezcoreapp` |
| Productie | Laatst gepubliceerd 20 juli 2026. Telefoonbuild 113 + Wear-bundel 26110314 gaan pas naar productie na goedkeuring van de FGS-verklaring |
| Tracks | Interne test (telefoons); **Wear OS-track** (`wear:internal`) voor de Galaxy Watch-bundel (aparte AAB, ondertekend met uploadsleutel; procedure `docs/WEAR_RELEASE.md`) |
| Upload | EAS `submit` → `internal`/draft, maar het service-account (`vibezcore-iap-verify`) heeft **geen release-rechten** → operator sleept de AAB uit `release-android/` zelf in Play Console |
| Voorgrondservices-verklaring | HEALTH + MEDIA_PLAYBACK, **verstuurd ter beoordeling 3 nov 2026** met telefoon- en horlogevideo (`docs/store/PLAY_FGS_VERKLARING_2026-11-02.md`) |
| Servicekosten 15 % | Accountgroep (enkel VIBEZCORE) aangemaakt + voorwaarden aanvaard (3 nov) |
| Uitbetaling | Belgische bankrekening, maandelijks, drempel €1 |
| Abonnementen | "VIBEZCORE Premium — Monthly/Yearly" (namen 28 okt), base plan `monthly`, jaar zonder aanbiedingen; dagpas eenmalig product `vibezcore_day_pass`, optie `day-pass`, 174 landen |
| Nog te doen (laatst gemeld) | Data safety + Health-formulier (`docs/PRIVACY_FORMULIEREN_BACKUP_SYNC.md`), Play App Signing SHA-1 voor Google-login in Google Cloud (28 okt open), grace period, win-back offers |
| Store-teksten | `docs/PLAY_STORE_TEKSTEN.md`, `docs/store/play-listing-en.txt` |

#### B.5.2 App Store Connect

| Item | Stand |
|---|---|
| App | Bundle `com.ubili.vibezcoreapp`, ASC App ID `6791124857`, Team `88AL3UW7L7` |
| Indiening | **iOS 1.0 (build 89) ingediend 2 nov 2026 23:12 — "Waiting for Review"**, 5 onderdelen: app, Monthly, Yearly, groep "VIBEZCORE Premium/Audio", Day Pass 24h (Non-Renewing). Oude afgewezen indiening van juli geannuleerd. Apple Watch-dimstand komt pas in 1.0.1 |
| IAP-items | `vibezcore_audio_monthly` (€9,99, niveau 2), `vibezcore_premium_yearly` (€69,99, niveau 1, Family Sharing), `vibezcore_day_pass_24h` (Non-Renewing, €1,29); elk met review-screenshot + notities; geen intro-aanbiedingen |
| Overeenkomsten | Paid Apps + Free Apps Agreement actief; nieuwe licentieovereenkomst aanvaard 1 nov |
| Bank / belasting | Wise Europe (EUR) actief; W-8BEN actief |
| Small Business Program | **Aangevraagd 3 nov 2026** door operator — wacht op bevestiging Apple (15 % i.p.v. 30 %) |
| Leeftijd | **13+** (override; app-regel: onder 18 met ouder) |
| Privacylabel | Health, Fitness, Product Interaction gekoppeld (App Functionality, geen tracking) |
| Teksten | `docs/APPSTORE_TEKSTEN_2026-11-01.md`, `docs/store/APPSTORE_BESCHRIJVING_2026-11-02.txt`; Terms = `https://www.vibezcore.com/terms-and-conditions`, Privacy = `/privacy-policy`, Support = `/support` |
| Afwijzing juli (7 punten) | punt per punt opgelost (zie WERKSTATUS 2 nov): 2.1(a/b), 2.3.10, 3.1.2(c), 4 (AppleAuthenticationButton), 5.1.1(v), 1.5 |
| Risico | Dagpas-type: als Apple het toch als iets anders wil zien, product-ID-logica (`isDayPassProductId`) vangt beide ID's op |

#### B.5.3 Overige diensten (namen; kosten in `OPERATOR_HANDOVER.md` §10–13)

RevenueCat (gratis tot $10k MRR) · Supabase (free) · Netlify (free) · Bunny (pay-as-you-go) · Zoho Mail · Wix (website `vibezcore.com`, domeinregistrar) · Sentry (crashrapporten, EU, uitschakelbaar in Settings › Privacy) · EAS/Expo (plan Starter, beperkt buildquotum) · Apple Developer ($99/j) · Google Play ($25 eenmalig). Betaalde diensten nooit zonder expliciete "ja" van de operator (memory).

---

### B.6 Juridische inhoud

#### B.6.1 In de app

| Item | Waarde |
|---|---|
| Bron | `src/data/legal-content.ts` (~1700 regels) — één bron voor app én website |
| Documenten (`LegalSlug`) | `terms`, `privacy`, `accessibility`, `shipping`, `refund`, `cookies`, `health`, `audio-sessions`; register `LEGAL_DOCS` |
| Laatst bijgewerkt | Terms + Privacy "November 2026"; overige "October 2026" |
| Renderer | `src/app/legal/[doc].tsx` (blocks: `h2` genummerd, `h3`, `p` met `**vet**` en `[link](url)`, `ul`, `tags`, `cards`, `highlight`, `danger`) |
| Platformtekst | `IOS` / `WEB` constanten: winkel = "the Apple App Store" (iOS), "Google Play" (Android), beide op web; verwerkers-lijst toont per platform Apple/Google, RevenueCat, Supabase (EU), Bunny (EU), Sentry (EU), Google/Apple sign-in |
| Inhoud die mee moet bewegen | Nieuwe dienst, nieuwe gegevens (bv. rusthartslag in cloud), nieuwe meldingen of horloge-gegevens → privacy-tekst bijwerken; wellness-taal, nooit medische claims (CLAUDE.md §1) |
| Links | MembershipPlans → `/legal/terms`, `/legal/privacy`; `SUPPORT_URL = https://www.vibezcore.com/support` |

#### B.6.2 Website

- Generator: `node scripts/gen-website-legal.mjs` laadt `legal-content.ts` met `Platform.OS = 'web'` en schrijft `docs/website-pages/legal/<slug>.html` (accessibility, audio-sessions, cookies, faq, health, privacy, refund, shipping, terms). Operator plakt elk bestand in het HTML-blok van de juiste **Wix**-pagina en publiceert.
- Overige webpagina-bronnen: `docs/website-pages/support.html` (Web3Forms, onderwerpkaarten), `delete-account.html`, `subscribe-*.html`, `privacy.html`.
- Live URL's: `/terms-and-conditions`, `/privacy-policy`, `/refund-policy`, `/faq`, `/support`, `/delete-account`, `/smart-bead-bracelet` op `https://www.vibezcore.com`.
- Regel: na elke wijziging aan `legal-content.ts` de HTML opnieuw genereren en de operator laten plakken; app en website mogen niet uit elkaar lopen (operator 29 okt).

---

### B.7 Valkuilen en checklist voor wie overneemt

1. **Echte aankopen testen kan alleen in een store-build** (dev = MockIAP). Testaccount van de operator heeft al een Play-abonnement → "al geabonneerd" komt van Google; gebruik Restore of een tweede Google-account.
2. Nooit de dagpas aan het entitlement `VIBEZCORE Pro` koppelen in RevenueCat.
3. Nooit stille `restorePurchases` bij app-start toevoegen; nooit de v237c-check in `linkRevenueCatUser` verwijderen.
4. Nieuw product-ID? Toevoegen in `iap-contract.ts` (`PRODUCT_IDS`, `tierFromProductId`/`isDayPassProductId`), RevenueCat (product + entitlement + offering-package) én beide stores. Een in ASC verwijderde ID is voor altijd weg.
5. Prijzen nooit in code; altijd store-prijs tonen.
6. `useSubscription` is de enige plek voor "is Premium"; schermen lezen `isPro`/`isLoading`, nooit RevenueCat rechtstreeks (uitzondering: subscribe-bevestiging, restore, recovery, management).
7. Backend niet aanpassen; nieuwe server-functionaliteit = eerst operator vragen (de geparkeerde audio-beveiliging heeft al akkoord, maar wacht op Bunny-screenshots).
8. Geheimen: Netlify env, Supabase-dashboard, EAS credentials, `.env*`/`secrets/`/`credentials.json` (gitignored, door Stop-hook naar OneDrive gekopieerd). `docs/OPERATOR_HANDOVER.md` is privé en bevat wachtwoorden.
9. Na elke afgeronde wijziging: `docs/WERKSTATUS.md` bijwerken, committen en pushen naar `rollback-vc76-take2`; testen in `docs/TEST_LOG.md`.

---

## Deel C — Sessie-motoren: Breathwork, State Control, haptiek, audio

> Stand: branch `rollback-vc76-take2`, 3 november 2026. Alles hieronder is
> nagekeken tegen de code (paden relatief aan `C:\Users\ulgar\vibezcore-app`).
> Getallen voor tempo's/duren komen uit de code; de onderbouwing per getal
> staat in `docs/VIBEZCORE_SCIENCE_A_TOT_Z.md` (§2 Breathwork, §3 State
> Control). Wijzig je een tempo/duur in code → dat document mee aanpassen
> (CLAUDE.md §0.7).
>
> Leeswijzer: C.1 Breathwork · C.2 State Control · C.3 Audio Library ·
> C.4 Haptiek-architectuur, meldingen, plannen · C.5 Vergrendelscherm &
> achtergrond per platform · C.6 Valkuilen en vaste regels.

---

### C.0 Overzicht in één blik

| Motor | Scherm (UI) | Kern-services | Native (Android) | Native (iOS) |
|---|---|---|---|---|
| Breathwork | `src/app/breath-session.tsx` (component `BreathSession`, leeft in een laag boven de app) | `breath-session-host.ts`, `breath-voice.ts`, `breath-haptics.ts`, `soundscape.ts`, `session-keepalive.ts` | `modules/breath-background` → `BreathSessionService` (FGS `mediaPlayback`) | `modules/session-audio` (AVAudioEngine-motor), `modules/live-activity` + `targets/live-activity` |
| State Control | `src/app/(tabs)/bracelet.tsx` → rendert altijd `src/app/bracelet-control.tsx` (`BraceletControl`) | `bracelet-session-monitor.ts` (bron van waarheid), `bracelet-haptics.ts` (curve), `resting-pulse.ts`, `heartbeat-sound.ts`, prefs | `modules/state-haptics` → `StateHapticsService` (FGS `mediaPlayback`) | `modules/session-audio` (BeatEngine), Live Activity |
| Audio Library | `src/app/(tabs)/index.tsx` (tab "Audio Library"), `src/app/player.tsx`, `src/components/MiniPlayer.tsx`, `src/app/library/*` | `src/services/audio-player.ts` (singleton expo-audio), `src/utils/audio-url.ts` | expo-audio `AudioControlsService` (Media3, gepatcht) | expo-audio Now Playing |
| Horloge | (zie deel over Watch) | `modules/wear-breath`, `modules/watch-breath`, `docs/WATCH_PROTOCOL.md` | Wear OS-app `android/wear/` | `targets/watch/` |

**Eén sessie tegelijk** (operator 19 okt 2026): Breathwork en State Control
sluiten elkaar uit. `openBreathSession()` vraagt "End current session?" als
er een ademsessie óf State Control loopt; `start()` in breath-session stopt
State Control/voorproef/hartslaggeluid. De Audio Library mag wél doorspelen
(zie C.3.6 voorrangsregel).

---

## C.1 Breathwork

### C.1.1 Data: toestanden en technieken — `src/data/breath-states.ts`

Het sessiescherm kent zijn eigen inhoud niet: het krijgt een sleutel en tekent
wat in `BREATH_STATES` staat. Een zesde toestand = één datablok, geen scherm.

**Types** (r. 88–260): `BreathStateKey = 'boost'|'focus'|'calm'|'clarity'|'rest'`;
`PhaseKey = 'inhale'|'inhale-2'|'hold-in'|'exhale'|'exhale-2'|'hold-out'`
(de `-2`-varianten bestaan voor Physiological Sigh en Alternate Nostril;
haptiek en stem behandelen ze als hun eerste helft, de stem heeft wel eigen
opnames voor neusgat/"Extra inhale"); `PhaseDef { key, label, secs, via }`
met `via ∈ Nose|Mouth|Left Nostril|Right Nostril|null`; `TechniqueDef`
(`key, name, level, safetyTier, safetyNote?, explain, effect, moments?,
bestFor, changes, phases, durations?`); `DurationDef { minutes, cycles?,
rounds, name, why, recommended?, researchProtocol? }`; `BreathState` (eyebrow,
title, tagline, subtitle, description, need, accent, accentSoft, glow,
gradient, art, focusY, artScale, phases, techniques, durations).

**De 15 technieken** (3 per toestand, Beginner/Intermediate/Advanced = moeilijkheid
van de TECHNIEK):

| Toestand (`key`, eyebrow, accent) | Technieken (`key`) | Ritme (s) |
|---|---|---|
| `boost` BOOST `#F5A524` | `diaphragmatic` · `equal` · `faster-equal` | 4·2 · 3·3 · 2·2 |
| `focus` SHARP FOCUS `#3E9BFF` | `coherent` · `alternate-nostril` · `ujjayi` | 5·5 · 4L·4R·4R·4L · 5·5 |
| `calm` CALM CONTROL `#B478FF` | `extended-exhale` · `triangle` · `box` | 4·6 · 4·h4·4 · 4·4·4·4 |
| `clarity` CLARITY & RELAX `#FFFFFF` | `equal` · `physiological-sigh` · `deep-extended-exhale` | 4·4 · 2+1·6 · 4·8 |
| `rest` SLEEP `#00A3A3` | `slow-extended-exhale` · `478` · `slow` | 5·7 · 4·h7·8 · 5·10 |

Let op: `equal` bestaat in twee toestanden → overal sleutel `${state}:${tech}`.
Sleep gebruikt in horloge/Live Activity de lichte teal `#4AF0D4` i.p.v. `#00A3A3`.

**Helpers** (r. 900–959): `cycleSeconds`, `patternOf` ("4-7-8", afgeleid uit
fasen — nooit hardcoden), `techLabel`, `rhythmLine`, `phaseAt`, `nextPhase`,
`roundsFor(x, minutes) = max(1, round(min*60/cycle))` ("rondes zijn leidend,
minuten zijn het label"), `BREATH_SESSION_COUNT` (techniek × duurvarianten,
gebruikt in paywall-teksten).

**4-7-8** werkt met `DurationDef.cycles` (4 / 8 cycli, Weil) i.p.v. minuten.

Gerelateerd: `src/data/breathwork-modes.ts` (`BREATHWORK_CHOOSER`, keuzescherm),
`src/utils/instant-feel.ts` ("How do you feel?" → toestand+techniek; "Anxious"/
"panic" → Physiological Sigh 5 min zonder holds), `src/app/feel-now.tsx`.

### C.1.2 Ervaring en aanbevolen duur — `src/utils/breath-level.ts`

Twee assen strikt gescheiden: `TechniqueDef.level` (techniek) vs `UserLevel`
(ervaring gebruiker met déze techniek).

- Start = `settings.experienceLevel` uit de onboarding.
- +1 niveau per `SESSIONS_PER_STEP = 12` afgemaakte sessies van die techniek.
- Advanced die een techniek nooit deed: één stap lager tot 12 sessies.
- 4-7-8 pas naar advanced (8 cycli) na `FOUR_SEVEN_EIGHT_DAYS = 28` dagen.
- `PLANS[state:tech] = { rec:[B,I,A], rhythm?:[…] }` — aanbevolen minuten
  (of cycli) en eventueel ander ritme per niveau (bv. `calm:box`
  4→5→6 s, `rest:slow` 4/8→5/10).
- `personalRecommendedMinutes()` = DE bron voor "Recommended" overal in de app.
- `techniqueForLevel()` geeft dezelfde fasen met de seconden van dat niveau.

### C.1.3 Hoe een ademsessie geopend wordt — de "laag boven de app"

- `src/services/breath-session-host.ts`: module-state `host = {id, params,
  minimized}`. API: `openBreathSession(params)`, `minimizeBreathSession()`,
  `restoreBreathSession()`, `closeBreathSession()`, `endRunningBreathSession()`
  (gebruikt door State Control-start), `getRunningBreathStatus()` (voor de pill),
  `confirm/cancelPendingBreathOpen()` ("End current session?"). Een lopende
  sessie meldt zich aan via `registerRunningBreathSession({isActive,label,end,status})`.
- `src/components/BreathSessionHost.tsx` (in root-layout) monteert
  `<BreathSession/>` en schuift de laag weg bij minimaliseren (offset
  `winHeight + 240`, want Android edge-to-edge is hoger dan "window").
  Geminimaliseerd blijft alles lopen (stem, haptiek, timing, figuur).
- `src/components/BreathMiniControl.tsx` = de pill die terughaalt.
- De route `/breath-session` (`BreathSessionRoute`, onderaan breath-session.tsx)
  bestaat enkel nog voor deeplinks/meldingen: zet params door naar de laag (of
  `restoreBreathSession()` als er al één loopt) en gaat meteen terug.
- Navigeren naar een tab vanuit een sessie: ALTIJD `goToTab()` uit
  `src/utils/state-control-ui.ts` (memory: bevestigde flows niet breken).

**Params** (`useBreathParams`, r. ~760): `state` / `mode` (URL-veilige variant
van `state`), `technique`, `level`, `minutes`, `customDuration`, `autostart`,
`from` (`onboarding` = gratis kennismakingssessie), `quick` (snelkoppeling:
kortste duur), `paywall='1'` (meteen paywall tonen).

### C.1.4 De fase-lus (`runPhase`, breath-session.tsx r. ~1695–1860)

Eén bron stuurt beeld, stem en trilling (regel "haptiek volgt beeld en stem").

1. **Anker op de wandklok**: elke fase rekent vanaf het geplande EINDE van de
   vorige (`nextAnchorRef`), niet vanaf "nu" → geen opgestapelde drift, horloge
   blijft synchroon. `endAt = anchor + secs*1000`.
2. **Haptiek** bij de fasestart: `playPhaseHaptic(k, startLeft)` — tenzij
   `hapticsOn` uit staat of een horloge bevestigt dat hij tikt
   (`watchBreathRef`, zie C.1.8).
3. **Stem loopt vóór**: de cue van de VOLGENDE fase start
   `cueLeadMs() = CUE_LEAD_MS (400) + audioOutputExtraMs()` vóór `endAt`
   (`preRef`-timer). Reden: opnames zetten traag in; het eerste woord moet op
   de overgang vallen. Bluetooth-oortjes voegen hun gemeten latentie toe
   (`src/services/audio-latency.ts`). De eerste fase van een sessie wordt
   gesproken door `resumeSession()` (`firstSpeakPendingRef`), omdat sessies
   op pauze starten.
4. **Beeld**: Reanimated `breath` (0↔1) met `Easing.out(Easing.sin)` enkel op
   in-/uitademen (hold = stilstaan), `arc` lineair over de fase.
5. **Seconde-tikken** op `anchor + n·1000` (geen setInterval-drift).
   `elapsedRef` telt echte geademde seconden.
6. Einde fase → volgende fase; einde laatste fase → ronde+1; ronde > rondes →
   `finish(true)` (of `endPreview()` bij voorproef).

**Pauze/hervat** (`pauseSession`/`resumeSession`): bevriest timers, stem,
trilling en animaties op hun tussenwaarde; `pausedAtWallRef`/`pausedMsRef`
houden de totale pauzetijd bij zodat wandklokberekeningen kloppen. Hervatten =
`runPhase(phase, round, secsLeft)` met `resumeAt`. Pauze propageert naar
soundscape (`pauseScape`), Live Activity, horloges (`pauseBreathSessionOnWear/
OnWatch`) en Android-native lus (zie C.1.7). iOS laat na 800 ms pauze de
geluidsmotor los (`stopSessionKeepAlive`) — "nooit het toestel van de
gebruiker verstoren".

**Sessies starten op pauze** (operator 11 sep 2026): `start(preview,
startPaused=true)` zet alles klaar; de gebruiker drukt zelf op Play.

**Wandklok-inhaalslag** (AppState → `active`, r. ~2063): `stopBackgroundBreathSession()`,
dan `trueElapsed = (now − startWall − pausedMs)/1000`. Is het verschil met
`elapsedRef` ≥ 3 s (of `forceResyncRef` na hervatten op het vergrendelscherm),
dan springt de sessie naar ronde/fase van de wandklok, of eindigt ze als de
tijd om is. `finish()` schrijft de duur ook op de wandklok
(`addBreathSession` in `src/utils/breath-history.ts`).

### C.1.5 Stem — `src/services/breath-voice.ts`

- Vooraf opgenomen MP3's (ElevenLabs) op Bunny:
  `CDN_BASE = https://vibezcore-audio.b-cdn.net/Breathwork%20audio%20v4`
  (v4 = luider ~−14 LUFS, geen ruisfilter; vorige mappen blijven staan voor
  oudere winkelversies).
- Twee stemmen, elk 11 cue-sleutels (`inhaleNose, hold, exhaleNose,
  exhaleMouth, boostInhaleNose, boostExhaleMouth, inhale/exhale Left/Right
  Nostril, extraInhale`): **vrouw** = "Kylie" (UI "Eli", standaard,
  `settings.voiceGender='female'`), **man** = "Marius" (UI "Benjamin").
  Plus Ujjayi-uitleg ("Dart Vader"-bestanden) en "Enjoy your session" per stem.
  Afsluit-monologen (`COMPLETION_URLS`, één per toestand) bestaan enkel in de
  oudere vrouwenstem — bewuste keuze (29 okt).
- Keuze per sessie: `setVoiceGenderOverride()` ("Just this time") vs
  opgeslagen `voiceGender` ("Remember"). Zelfde patroon voor Voice aan/uit
  (`setVoiceEnabled`), per toestand onthouden.
- `src/data/voice-cue-timing.ts` (`VOICE_CUE_SPEECH`): gemeten begin/einde van
  de spraak per bestand (ffmpeg silencedetect). Past een zin niet in een korte
  fase (Boost 2 s), dan slaat de speler vooraan stilte over i.p.v. af te kappen.
  **Nieuwe opname = opnieuw meten.**
- `claimVoiceSource('breath'|'bracelet')` / `releaseVoiceSource`: één stembron.
- Afspelen: iOS via de native motor (`loadVoice`/`playVoiceNow` uit
  `modules/session-audio`) als beschikbaar, anders expo-audio-spelers (één
  per URL, gecachet).
- Offline: `VOICE_ASSET_URLS` (beide stemmen) wordt door
  `src/services/offline-assets.ts` + `asset-cache.ts` (`assetUri()`) één keer
  naar de documentenmap gehaald.

### C.1.6 Soundscapes — `src/data/soundscapes.ts` + `src/services/soundscape.ts`

- 13 geluiden (`deep, soft, static, fan, rain, storm, shore, depths, ember,
  dawn, canopy, night, bowl`) in groepen NOISE/WATER/EARTH/TONE, CDN
  `…/soundscapes%20breathwork`, elk met LUFS-volumecorrectie.
- Standaard UIT. `SUGGESTED_SCAPE` per toestand bepaalt enkel wat bovenaan
  staat. Keuze per toestand onthouden.
- Gratis: `FREE_SOUNDSCAPES = {rain, canopy}`; rest Premium (eigen
  `scapePaywall` die de sessie NIET beëindigt).
- Volume: `SCAPE_LEVELS = {soft .14, medium .25, loud .8}`. Fades bij
  pauze/stop (1,5 s).

### C.1.7 Achtergrond op Android — `modules/breath-background`

Bestanden: `index.ts` (JS-API), `android/.../BreathSessionService.kt` (755 r.),
`BreathHaptics.kt`, `BreathBackgroundModule.kt`, `plugin.js` (config-plugin).

**Waarom**: Android bevriest JS-timers bij scherm op slot. De service draagt
dan de hele cyclus zelf met een **partial wake lock + Handler-timers** (geen
AlarmManager: Boost-fasen van 2 s liepen tegen exact-alarm-throttling).

**Overdracht JS ↔ native (nooit twee bronnen tegelijk):**
- `start()` bereidt enkel cue-URI's voor (`pendingCueUrisRef`).
- AppState ≠ active → `armBackground()` → `startBackgroundBreathSession({
  phases (met -2 platgeslagen naar inhale/exhale), rounds, inhale/hold/exhale
  CueUri, cueLeadMs, haptics, startPhaseIdx, startRound, startRemainingMs,
  modeName, totalDurationMs, sessionRemainingMs })`. De service start MIDDEN
  in de lopende fase en herhaalt die cue/trilling niet.
- Lege cue-URI = stille cue: zo wanneer Voice uit staat of de Audio Library
  speelt (`isLibraryPlaying()`). `haptics=false` als telefoon-trilling uit staat
  of een horloge tikt.
- AppState → active → `stopBackgroundBreathSession()` + inhaalslag in JS.

**Pauze/hervat op het vergrendelscherm (gebouwd 3 nov 2026):**
- Intent-acties: `ACTION_START`, `ACTION_STOP`, `ACTION_PAUSE` (app pauzeert
  terwijl telefoon op slot ligt, bv. vanaf horloge — kaart blijft, niets
  terugmelden), `ACTION_REMOTE_PAUSE` / `ACTION_REMOTE_RESUME` (tik op de
  kaart: service pauzeert zelf en meldt via `remoteListener` → JS).
- `enterPaused()`: bewaart resterende fasetijd, stopt timers/tikker/trilling,
  laat wake lock los, kaart toont "Paused" + Resume-knop.
  `leavePaused()`: wake lock terug, trilling voor de rest van de fase, stem pas
  bij de volgende fase.
- JS-kant: `addBreathRemoteControlListener` (breath-session.tsx r. ~2389)
  synchroniseert fase/ronde op de wandklok, pauzeert soundscape/Live
  Activity/horloges, en zet `forceResyncRef` zodat bij ontgrendelen altijd de
  inhaalslag loopt. Hier BEWUST geen JS-timers en geen
  `stopBackgroundBreathSession` (anders twee lussen).
- Fix 3 nov: bij overname telde het al verstreken deel van de huidige fase
  dubbel (`elapsedMs` telt enkel voltooide fasen; `liveElapsedMs()` telt de
  lopende) → vergrendelscherm-tijd liep vóór.

**Melding / vergrendelscherm**: kanaal `breath_background_session`, id 8421.
`MediaStyle` + eigen `MediaSessionCompat` ("VibezcoreBreathSession", geen
speler eronder — enkel metadata). Titel = modusnaam; artist-regel = vaste
resterende tijd "M:SS" (voedt ook Samsung's Now Bar); tekst = fase + "· M:SS
left"; chronometer countdown + progressbalk op de echte sessieduur; eigen
lockscreen-art (`res/drawable-nodpi/vibezcore_lockscreen_art.png`);
`setLocalOnly(true)` (niet doorsturen naar het horloge); PlaybackState zonder
SEEK. Tik = terug naar de app.

**Batterij**: `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (OneUI blokkeert de
service anders); `isIgnoringBatteryOptimizations()` /
`requestIgnoreBatteryOptimizations()`; banner in breath-session + Settings.

**Manifest**: `plugin.js` injecteert `<service .breathbackground.BreathSessionService
foregroundServiceType="mediaPlayback" exported=false>` + `WAKE_LOCK` +
batterij-permissie. `FOREGROUND_SERVICE(_MEDIA_PLAYBACK)` staan in
`app.json` → `android.permissions`. Let op: `/android` staat in `.gitignore`
(enkel `android/wear/` is getrackt) — manifest-wijzigingen voor de telefoon
horen in een config-plugin, niet in `android/app`.

**Meldingstoestemming**: Android 13+ toont niets zonder POST_NOTIFICATIONS;
`start()` vraagt die via `ensurePermission()` uit `reminders.ts` (blokkeert de
sessie nooit).

### C.1.8 iOS-gedrag

- **Keepalive** (`src/services/session-keepalive.ts`): iOS houdt JS levend
  zolang er audio speelt (`UIBackgroundModes: ["audio"]` in app.json). Sinds
  19 okt 2026 doet `modules/session-audio` (AVAudioEngine, `begin/end(owner)`)
  dat i.p.v. een stille expo-audio-lus. Owners: `'breath' | 'state' | 'preview'`.
  Audiomodus altijd `mixWithOthers` (`ensureAudioModeSet`) — nooit Spotify/
  YouTube van de gebruiker stoppen. Gestart pas bij de eerste Play, losgelaten
  tijdens pauze.
- **Live Activity** (`modules/live-activity`, extensie `targets/live-activity/
  VibezLiveActivity.swift`, intent `targets/live-activity/_shared/
  VibezToggleSessionIntent.swift` in app + extensie): `showLiveSession({kind:
  'breath', title, subtitle: techniek, colorHex, remainingSec, totalSec,
  paused})`, `pause/resume/endLiveSession`, `onLiveToggle('breath', cb)` →
  pauze/hervat-knop op vergrendelscherm en Dynamic Island
  (`authenticationPolicy .alwaysAllowed`, geen ontgrendelcode).
  `updateLivePhase` is bewust uitgeschakeld (iOS paste fase-updates op de
  achtergrond niet betrouwbaar toe). Faalt de Live Activity →
  `onLiveActivityFailed` → terugval op de Now Playing-kaart van het anker +
  `reportError`.
- **Haptiek**: iOS negeert trilduur → `breath-haptics.ts` speelt een eigen
  tikkentaal met Apple-haptiek op een JS-klok per fase (inademen dichte tikken
  110 ms, uitademen grovere 270 ms een trede zachter, hold één stevige tik/s;
  Soft/Medium/Strong → Light/Medium/Heavy). Met scherm op slot laat iOS geen
  enkele app trillen → enkel stem (en een gekoppelde Apple Watch).
- `modules/breath-background/ios/BreathBackgroundModule.swift` = vangnet met
  dezelfde fase-logica; de kop zegt "niet getest op een echt toestel".

### C.1.9 Haptiek-alfabet ademen — `src/services/breath-haptics.ts`

- **Inademen**: ononderbroken (`steady`), **uitademen**: rimpelend (`ripple`),
  **vasthouden**: één tik per seconde (`tickPerSecond`). `FILL = 0.9` (laatste
  10 % stil = aankondiging van de wissel).
- `phaseHapticPattern(phase, secs)` is exporteerbaar zodat horloge (en later
  firmware) exact dezelfde reeksen krijgt.
- Sterkte (`withStrength`): tikduur × `MS_FACTOR`, ritme blijft gelijk. Met
  amplitude-regeling ook echte kracht: `breathAmplitude()` = `BREATH_AMP`
  `{soft 120, medium 0 (=toestel-standaard), strong 255}` via
  `playNativeWaveform` (modules/state-haptics). Horloge:
  `watchBreathAmplitude()` = `WATCH_HAPTIC_LEVEL {155, 205, 255}`.
- `playPhaseHaptic` doet eerst `Vibration.cancel()` (nooit een patroon van de
  vorige fase laten doorlopen); `vibrateCompat()` = Vibration-API die ook op
  iOS werkt.

### C.1.10 Voorproef, paywall en gratis sessie

- **Poort op STARTEN, niet op kijken**: alle toestanden/ritmes zijn zichtbaar.
  `locked = !sub.isLoading && !isPro && !isFreeOnboardingSession` (r. ~2253).
  Premium (abonnement of dagpas) is het enige wat ontgrendelt — de bracelet
  doet dat NIET.
- **Voorproef** "Try 30 seconds free": `BREATH_PREVIEW_SECONDS = 30`,
  `PREVIEW_ROUNDS = ceil(30 / cyclus)`; de tik-lus stopt op exact 30 s, ook
  midden in een fase → `endPreview()` = pauzeren (echte sessiebeeld blijft
  achter het glas) + `PremiumPaywallModal`. Instant-sessies: 1,5 s fade eerst.
- **Gratis kennismakingssessie** (`from=onboarding`): enkel geldig als
  `settings.breathFreeSessionUsedAt` ≤ 15 min oud is (anti-deeplink-misbruik).
  Niet gespeeld / geannuleerd / Premium → `unclaimFreeSession()`
  (`src/utils/breath-entry.ts`). "End free session?" alleen zonder Premium.
- Paywall na "Well done", niet erover. `paywall='1'` opent de modal direct.

### C.1.11 Afsluiting

`finish(true)` → `addBreathSession(...)` (duur op wandklok) → `playCompletionCue`
→ "Well done" + `FeelCheck` (`kind:'breath'`) + eventueel bracelet-nudge
(`useBraceletNudge`, max 1×/dag). "Just this time"-keuzes (sterkte, stem,
telefoon-haptiek) vervallen bij sessie-einde (`endHapticStrengthSession`).

### C.1.12 Breathwork met horloge (kort — details in het Watch-deel)

`relayBreathToWatches()` stuurt ÉÉN bericht met de volledige sessie (fasen +
haptiekpatroon, rondes, naam, kleur, sterkte, `sentAtMs`, `amp`, en bij
hervatten `startRound/startPhase/phaseRemainingMs`) naar Wear
(`modules/wear-breath`) én Apple Watch (`modules/watch-breath`), enkel als
`settings.watchHaptics` aan staat. Het horloge stuurt elke 10 s een
`breath_ack`; zolang die binnenkomt trilt de telefoon niet (één ritme op de
pols); 25 s geen ack → telefoon neemt over. `wakeWear()` bij het openen
ververst de klokmeting (wear-app `ClockSync`). Galaxy Watch stuurt sinds 2 nov
ook een ack.

---

## C.2 State Control

### C.2.1 De 5 modi — `src/services/ble-contract.ts` (`MODES`)

> Pad is `src/services/ble-contract.ts` (CLAUDE.md zegt `services/…`).
> Status-correctie in de kop: het "v2.4"-contract is een **werkontwerp**, niet
> hardware-geverifieerd (memory `feedback-ai-spec-not-verified`).

| Idx | Enum | Naam | Kleur | Min | Default | Max | Eindtempo (R = rusthartslag) | Glijtijd |
|---|---|---|---|---|---|---|---|---|
| 0 | Gamma | Boost | `#F5A524` | 5 | 10 | 20 | 110 bpm vast | 10 s |
| 1 | Beta | Sharp Focus | `#3E9BFF` | 5 | 15 | 30 | 90 % R, min 53 | 10 s |
| 2 | Alpha | Calm Control | `#B478FF` | 5 | 18 | 30 | 80 % R, min 50 | 10 s |
| 3 | Theta | Clarity & Relax | `#FFFFFF` | 10 | 25 | 45 | 70 % R, min 45 | 120 s |
| 4 | Delta | Sleep | `#00A3A3` | 10 | 30 | 50 | 55 % R, min 40 | 120 s |

- `clampDuration(mode, min)` dwingt de grenzen af.
- `QUICK_SESSIONS`: Quick Chill (Theta) en Quick Boost (Gamma), 5 min
  (`QUICK_SESSION_MINUTES`), starten meteen (niet op pauze); mogen onder het
  modus-minimum (monitor clamp min 3 bij `quick`).
- BLE-commando's: `Start 0x01, Stop 0x02, StatusRequest 0x03, Pause 0x04,
  Resume 0x05` (0x04/0x05 = werkontwerp; `bracelet-control.tsx` gebruikt nog
  de oude stop+onthoud-workaround voor pauze). Status: `sessionActive,
  sessionPaused, currentMode, remainingMinutes, batteryPercent, charging, fault`.
- `src/services/bracelet.ts`: `USE_SIMULATED_BLE = true`; `RealBracelet`
  bestaat nog niet (gooit een fout). `bracelet-sim.ts` = spec-getrouwe sim.
- UI toont NOOIT PPS/burst/amplitude/RTP.

### C.2.2 Het hartritme — `src/services/bracelet-haptics.ts` (1496 r.)

Volledige onderbouwing: `docs/HAPTIC_RESEARCH_BASIS.md` + Science §3.

- **Curve**: `SESSION_HOLD_SECONDS = 10` op het begintempo (iso-principe), dan
  lineair glijden (`rampSec` per modus, `SPECS`) naar het eindtempo, dat
  aanhouden tot het einde. `bpmAt()` / `beatAt()`.
- **Begintempo** = `getSessionStartBpm()` (= R, of een verse meting van nu
  boven R, 15 min geldig, max 140); **eindtempo** = `spec.targetFor(R)`, met:
  plafond als R = 80 (`TARGET_BASE_CAP_BPM`: Calm 64, Clarity 56, Sleep 44,
  Focus 72) en kalme modi altijd ≥ 2 bpm onder R, nooit < 40
  (`resolveSpec`). Bij R = 70: 56 / 49 / 40 / 63 / 110. "75 bpm" is dus geen
  vaste startwaarde: start = R (standaard 70 = `AVERAGE_RESTING_BPM`).
- **Slagvorm lub-dub**: dub op 30 % van de cyclus, max 350 ms
  (`LUB_DUB_FRACTION`, `LUB_DUB_MAX_MS`); dub ≈ 70 % kracht van lub; altijd
  ≥ 45 ms gat tussen lub en dub (anders "zoemen").
- **Eind-signaal**: 600 ms stilte + 3 oplopende tikken (geen geluid).
- **Pauze**: hervatten binnen `RESUME_WINDOW_SECONDS = 120` loopt verder op de
  curve; later begint de curve opnieuw. `restingBpm` ligt vast per sessie.
- **Voorproef** (`PREVIEW_MAX_SECONDS = 30`): zelfde begin; Clarity/Sleep
  glijden versneld (`PREVIEW_RAMP_SECONDS = 12`, UI zegt "Sped up for the
  preview" via `previewCondensedRampMinutes`). "Taste" = 5 s
  (`TASTE_SECONDS`).
- **Afspeelwegen** (`play()`):
  1. **Android** met native module (`hasNativeWaveform()`): de HELE curve als
     één golfvorm (`buildWaveform` → timings + amplitudes) naar de trilmotor.
     Sessie (`clock` gezet) → `startNativeSession(...)` = voorgrondservice
     (doorloopt op slot, speelt ook het hartslaggeluid). Voorproef → herhalende
     golfvorm met native stop na `totalSec` (een eindige golfvorm wordt door
     elk systeemtikje vervangen).
     - Met amplitude-regeling: tik 45/35 ms, kracht `PHONE_AMP_LEVEL
       {soft 120, medium 175, strong 255}` × modusschaal (Sleep 0,85 … Boost 1).
     - Zonder (bv. Galaxy A16): kracht 255, sterkte via tikduur
       `lub/dubMsNoAmp × STATE_MS_FACTOR` (Strong = **2,2**).
  2. **iOS** met `modules/session-audio`: `playIos()` stuurt het HELE plan
     (`BeatPlan`: firstBeatAtMs, start/target bpm, hold/ramp, endAt, sound,
     volumes, haptics, lub/dub intensity/sharpness) naar `startSessionBeats` —
     de motor plant elke slag sample-nauwkeurig op de geluidsklok, ook op slot
     (geluid; trillen op slot kan iOS niet).
  3. Terugval (web/zonder module): expo-haptics op JS-timers (`scheduleBeat`).
- **Beeld uit dezelfde bron**: `scheduleVisual()` → `emitPulse()` →
  `subscribeHapticPulse` (gebruikt door `src/components/HapticPulseRings.tsx`).
  Beelden krijgen elke slag `PULSE_AHEAD_MS = 250` vooraf; na een vergrendeling
  springt het beeld stil naar de slag van nu (geen salvo).
- **Startanker**: `anchorWallMs = now + nativeStartLeadMs()` (opstarttijd
  trildienst ~0,15–0,18 s; + Bluetooth-extra als geluid aan staat; andere lead
  als een Wear-horloge gekoppeld is). Horloge krijgt exact dit anker
  (`lastAnchorWallMs`, `lastAnchorCurveSec`).

### C.2.3 Sessie-monitor — `src/services/bracelet-session-monitor.ts`

Bron van waarheid voor een lopende State Control-sessie, los van welk scherm
gemount is (module-state + eigen interval + AsyncStorage-persist).

- API: `startStateControlNow(mode, minutes, {quick})` (vanuit plan, herinnering,
  Quick-knoppen; landt **gepauzeerd** behalve quick), `startBraceletSessionMonitor`,
  `pause/resume/stopBraceletSessionMonitor`, `endStateControlSession()`,
  `getBraceletMonitorSession()`, `isBraceletSessionMonitorActive()`,
  `isBraceletSessionUnplayed()` (nooit op Play gedrukt → terug = weg, geen pill),
  `subscribeSessionCompletion` / `consumePendingCompletion`,
  `subscribeRemoteControl`, `setPreviewRemoteHandler`.
- Bij (her)start: `playModeSessionHaptic(mode, elapsedSec, remainingSec)`.
- Max pauze `MAX_PAUSE_MS = 60 min`, daarna vervalt de sessie.
- Herstel na app-herstart (`restoreFromStorage`): draait de Android-service nog
  → gewoon volgen; voorbij → `completeNaturally()` (alsnog bewaren); midden in
  gekild → als gepauzeerd terugzetten.
- BLE: `resync()` pollt status (spec 5 s) maar slaat over zolang
  `USE_SIMULATED_BLE` (de sim mag een telefoonsessie nooit afbreken).
- Horloge-acties (`onWatchAction` van wear/watch-breath, `kind:'bracelet'`)
  → remotePause/Resume/Stop.
- Historie: `recordSession` (`src/utils/bracelet-history.ts`).
- Vergrendelscherm: zie C.5.

### C.2.4 Rusthartslag / Match Your Rhythm — `src/services/resting-pulse.ts`

- Constanten: `AVERAGE_RESTING_BPM 70`, bereik 40–100, `REMEASURE_AFTER_DAYS 30`.
- Bronnen (`PulseSource`): `measured` (camera), `manual` (draaiwiel 40–100),
  `average`, `health` (UIT: `HEALTH_INTEGRATION_ENABLED = false` in
  `src/constants/features.ts`; code blijft).
- R = **laatst bewaarde** waarde (sinds 10 okt 2026). `setManualRestingPulse`,
  `addRestingPulseReading` (> 100 = niet bewaren), `chooseAverageRestingPulse`,
  `resetRestingPulse` (wist ook historiek), `setLiveStartPulse` /
  `clearLiveStartPulse` / `getSessionStartBpm`, `shouldSuggestRemeasure`,
  `recordSessionPulse`, `getPulseHistory`. Cloud-sync via
  `getRestingSyncSnapshot/applyRestingSync`.
- Camerameting (PPG): `src/utils/pulse-detect.ts` (20 s meten, autocorrelatie +
  slagen tellen, beide binnen 10 %); UI `src/components/PulseMeter.tsx`,
  `src/components/RestingHeartRatePage.tsx`, `src/app/heart-rate.tsx`,
  `src/components/RhythmSheet.tsx` ("♥ 66 bpm ›" in de cirkel). Geen medische
  claims, enkel "om het ritme in te stellen".

### C.2.5 Voorkeuren (Just this time / Remember)

Patroon overal hetzelfde: `saved` (AsyncStorage) vs `current` (nu);
"Just this time" zet enkel `current`, `end…Session()` zet bij sessie-einde terug.

| Pref | Bestand | Sleutel | Standaard | Opmerking |
|---|---|---|---|---|
| Trilsterkte | `src/services/haptic-strength-pref.ts` | `vibezcore.hapticStrength.v2` | **Strong** | UI kent Strong/Medium; `soft` wordt naar `medium` gemapt. Geldt voor State Control, voorproef én Breathwork. Factoren: `AMP_FACTOR`, `MS_FACTOR {.55,1,1.35}`, `STATE_MS_FACTOR` (strong **2.2**), `STATE_AMP_FACTOR` (strong 3), `BREATH_AMP`, `WATCH_HAPTIC_LEVEL {155,205,255}` |
| Telefoon-haptiek State Control | `src/services/state-phone-haptics-pref.ts` | `vibezcore.stateControl.phoneHaptics` | aan | Uit = telefoon trilt niet; geluid en horloge lopen door (`play(..., silent=!getPhoneHapticsNow())`) |
| Haptic + Audio (Feel & Hear) | `src/services/state-sound-pref.ts` | `vibezcore.stateControl.hear` | **aan** (sinds 2 nov) | `getStateHearNow() = hear && !isLibraryPlaying()`; pusht naar native `setNativeSessionSound` |
| Breathwork haptiek/stem/stemgeslacht | breath-session.tsx + `settings.ts` | `voiceGender` e.a. | stem+haptiek aan | zelfde popup "Just this time / Yes, remember it" |
| Horloge | `settings.watchHaptics` | — | aan | uit = niets naar het horloge |

### C.2.6 Hartslaggeluid — `src/services/heartbeat-sound.ts`

- Echte lub-dub-opnames (Pixabay, vrije licentie): luidsprekerversie
  (`assets/heartbeat-speaker.wav`) en oortjesversie
  (`assets/heartbeat-headphones.wav`); dezelfde in
  `modules/state-haptics/android/src/main/res/raw/heartbeat_{speaker,headphones}_{lub,dub}.wav`.
  Uitgang per slag gecontroleerd (`modules/audio-route` `isHeadphonesOutput`).
- Volume: luidspreker 1.0, oortjes 0.9 (zelfde in StateHapticsService,
  CalibrationBeat en iOS SessionAudioModule).
- Owners: `'page' | 'measure' | 'state-control'`. Mengt altijd met muziek.
- Op Android speelt **de service zelf** het geluid (SoundPool) exact op de tik,
  ook op slot. iOS: de BeatEngine. Anders JS (`heartbeatLub/Dub`).
- **Sound timing** (Bluetooth-latentie): `src/services/sound-timing.ts` —
  gebruiker tikt mee op 70 bpm (12 tikken, eerste 4 genegeerd,
  `TAP_ANTICIPATION_MS = 40`), correctie −200…+400 ms per uitgang-adres,
  native bewaard (`setNativeAudioCorrection` / iOS `setIosAudioCorrection`).
  UI: `SoundTimingRow`/`SoundTimingSheet`. `audioOutputExtraMs()` voedt zowel
  de ademstem-lead als het State Control-startanker.

### C.2.7 Native Android-dienst — `modules/state-haptics`

- `StateHapticsService.kt` (925 r.): voorgrondservice (FGS `mediaPlayback`,
  manifest in `modules/state-haptics/android/src/main/AndroidManifest.xml`).
  Reden (gemeten Galaxy A16): Android breekt een app-trilling af bij
  vergrendelen (`cancelled_by_screen_off`); de service herstart de curve meteen
  vanaf de juiste positie. Curve zelf blijft in JS berekend; de service knipt
  het resterende stuk eruit. Wake lock, SoundPool voor het geluid.
- Melding: kanaal `state_control_session` (id 8422), MediaStyle + eigen
  MediaSession (titel in hoofdletters, artist = resterende tijd → Now Bar
  "BOOST · 9:46"), tekst "VIBEZCORE · <label>", lockscreen-art, pauze/hervat
  (`ACTION_REMOTE_PAUSE/RESUME`), `setLocalOnly(true)`, tik = deeplink
  `vibezcoreapp://bracelet?open=…`. Einde: aparte melding "Session complete"
  (kanaal `state_control_done`, id 8423, stil).
- Overige: `CalibrationBeat.kt` (sound timing), `AudioLatency.kt` (uitgang +
  correctie), `StateHapticsModule.kt` (JS-brug: `playNativeWaveform`,
  `startNativeSession`, `pause/stopNativeSession`, `getNativeSessionStatus`,
  `addRemoteControlListener`, `setNativeSessionSound/Haptics`,
  `canPlayNativeWaveform` = amplitude-regeling aanwezig, …).
- Bekend aandachtspunt (WERKSTATUS 2 nov): na stoppen bleven MediaSessions
  bestaan → bij stoppen `release()`.

### C.2.8 State Control met horloge (kort)

Telefoon stuurt `state-start` (startBpm, targetBpm, glijtijd, resterende tijd,
sterkte, anker) — het horloge speelt de curve zelf (`docs/WATCH_PROTOCOL.md`).
Bevestigt het (`state-ack`), dan zwijgt de telefoon-trilmotor
(`watchHasRhythm`); het **geluid blijft op de telefoon**. Zonder ack:
herhalingen na 6/14/25 s (`WATCH_RELAY_RETRY_MS`). Handdruk PREPARE → GO met
`startInMs` op Wear; klokverhouding via wear-app `ClockSync`. Details: Watch-deel.

### C.2.9 Schermen

- `src/app/bracelet-control.tsx` (9237 r., `BraceletControl`): moduskeuze,
  duur (`DurationDial`/`ColorDurationDial`), Start (landt op pauze, gebruiker
  drukt Play), lopende sessie met `HapticPulseRings` + `HeartbeatScale`,
  `RhythmSheet`, `WatchHapticsRow`, `SoundTimingRow`, voorproef "Try 30
  seconds free", afsluiting. `(tabs)/bracelet.tsx` rendert dit voor iedereen
  (tab-titel "State Control"). Openen van elders: `openStateControl()` in
  `src/utils/state-control-ui.ts`.
- Pill: `src/components/BraceletMiniIndicator.tsx`.
- Onboarding/uitleg: `StateControlOnboarding.tsx`, `how-state-control.tsx`,
  `state-onboarding.tsx`.

---

## C.3 Audio Library

### C.3.1 Data — `src/data/audio-library-data.ts`

> De kopcommentaar ("83 sessies, 12 series") is verouderd: in de code staan
> **144 sessies** in **25 series** (`SERIES_ORDER`), waarvan 12 met
> `accessTier:'public'`.

- `Session { title, series, subseries, free, desc, num, url, added, accessTier? }`;
  `AccessTier = 'public' | 'account' | 'pro'`.
- Toegang: `src/utils/access-tier.ts` — `getEffectiveTier()` (expliciete
  `accessTier` wint; fallback op `free` + series), `needsPreview(url, free,
  isPro, isTrialing, isBundle)`, `findLibrarySessionByUrl`. Sinds 16 okt 2026:
  geen trial meer; enkel de publieke sessies gratis, de rest Premium
  (maand/jaar/dagpas).
- **Pijlers** (`PILLAR_ORDER`, `PILLAR_META`): resilience (Psychological
  Resilience · "Build what cannot break"), sovereignty (Inner Sovereignty ·
  "Master what is yours"), social (Social Mastery · "Command without force"),
  drive (Strategic Execution & Wealth · "Engineer your autonomy"), plus
  `tools` = "Soundscapes & Affirmations". `SERIES_PILLAR` koppelt elke serie
  aan een pijler; `SERIES_PHOTO` = pijlerfoto (oude reeksfoto's mogen nooit
  terugkomen). `SUBCAT_INFO/ORDER` voor Soundscapes-subcategorieën.
- `src/data/normalized-audio.ts`: paden waarvoor een −16 LUFS-kopie op Bunny
  staat onder `/app-16lufs/<pad>` (gegenereerd, niet met de hand bewerken).

### C.3.2 Player — `src/services/audio-player.ts` (singleton)

- expo-audio (`createAudioPlayer`, imperatief) op module-niveau, zodat
  minimaliseren/navigeren het afspelen niet stopt. UI via `usePlayerState()`.
- `PlayerState`: session, loading, playing, positionSec, durationSec, rate,
  preview, previewBlocked, awaitingResume, savedPositionSec, errorMessage,
  endedPanel.
- API: `loadSession`, `pauseAudio`, `resumeAudio`, `togglePlay`, `seekTo`,
  `skipBy` (±15 s in player.tsx), `setRate`, `continueFromSaved`, `startOver`,
  `playNextFromPanel`, `dismissEndedPanel`, `unload`, `reactivateLockScreen`,
  `invalidateAudioMode`, `onSessionFinish`.
- **Preview** (Premium-sessie zonder recht): backend signt met
  `?preview=true`; client stopt na `PREVIEW_CAP_SEC = 60` (de kopcommentaar
  noemt nog 30 s — de constante is 60) → `previewBlocked` → upsell.
- **Resume** (`src/utils/vzp.ts`): opgeslagen positie > `SAVE_MIN_SEC 4` →
  `awaitingResume` (Continue / Start over); niet opslaan in de laatste
  `SAVE_END_MARGIN_SEC 30`.
- **Historie**: `src/utils/history.ts` (`startListen/pauseListen/endListen`),
  `src/utils/last-played.ts`, `src/utils/play-events.ts`.
- **Autoplay**: `settings.autoPlayNext` (standaard aan) → volgende sessie via
  `src/utils/next-session.ts`; uit → `endedPanel` "Play next?".
- **Audiomodus**: `interruptionMode: 'doNotMix'` (verplicht door expo-audio
  voor `setActiveForLockScreen`; anders stopt Android na ~3 min). Ademsessies
  zetten daarna opnieuw `mixWithOthers` (`invalidateAudioModeSet`).
- **Vergrendelscherm-metadata**: `setActiveForLockScreen(true, {title,
  artist: SERIES_SUBTITLE, artworkUrl: lockArtwork(series)})` — artwork =
  pijlerfoto.

### C.3.3 Signed URLs — `src/utils/audio-url.ts`

`getSignedAudioUrl(rawUrl, {preview})` → backend `GET /api/audio-url?path=…`
(via `apiCall`, auth) → `{url, expires_at}` (Bunny-token, 4 u TTL).
In-memory cache per `pathname|preview` met 5 min veiligheidsmarge;
`clearSignedUrlCache()` bij logout. Fouten: 401 `LOGIN_REQUIRED`, 402
`SUBSCRIPTION_REQUIRED`, 404 `SESSION_NOT_FOUND`, anders `SIGN_FAILED`.
Provider-agnostisch: de app praat enkel met de eigen backend. (Premium-audio
beter beveiligen is geparkeerd — memory `project-premium-audio-protection`.)

### C.3.4 expo-audio-patch (Android, 3 nov 2026)

`patches/expo-audio+55.0.14.patch` (via `patch-package`, `postinstall`):
`AudioControlsService.kt` krijgt `applySessionMetadata()` — titel/reeks/hoes-URL
gaan naar de Media3-sessie zelf, zodat de lockscreen de volle foto laadt
(voordien enkel een ~64 px meldingsicoon → pixelig op Samsung).
**Vereist** `package.json` → `expo.autolinking.android.buildFromSource:
["expo-audio"]`, anders gebruikt Gradle de voorgecompileerde versie zonder
patch. Bij een expo-audio-upgrade: patch opnieuw maken.

### C.3.5 Mini-player en speler-UI

- `src/components/MiniPlayer.tsx`: vaste balk boven de tabbalk (gemount in
  `(tabs)/_layout.tsx`), niet versleepbaar; verborgen op `/player` en `/welcome`.
  Tik = full player; play-knop = `togglePlay()` (bij `previewBlocked` opent de
  full player met upsell).
- `src/app/player.tsx`: volledige speler (snelheid, ±15 s, preview-modal).
- Bibliotheekschermen: `(tabs)/index.tsx` (AudioScreen), `src/app/library/
  {favorites,free,new}.tsx`, `src/app/library/pillar/…`, `LibraryListRow`.

### C.3.6 Voorrang Library vs sessies — `src/services/library-priority.ts`

Regel (19 okt 2026): nooit twee stemmen/klanken over elkaar.
- Speelt de Library → ademstem en hartslaggeluid zwijgen (haptiek + beeld
  lopen); ook de Android-achtergrondlus krijgt lege cue-URI's.
- Start je de Library tijdens een sessie → idem zolang ze speelt.
- Opgeslagen voorkeuren worden NOOIT aangepast; na pauze/stop van de Library
  (na `RELEASE_DELAY_MS = 800`) klinken stem/hartslag weer bij de volgende
  zin/slag. API: `isLibraryPlaying()`, `subscribeLibraryPlaying()`,
  `useLibraryPlaying()`.

---

## C.4 Haptiek-architectuur, meldingen, plannen

### C.4.1 Haptiek: principes die overal gelden

1. **Eén bron per sessie**: beeld, stem en trilling starten vanuit dezelfde
   fase-overgang (Breathwork, `runPhase`) of hetzelfde slagrooster (State
   Control, `scheduleVisual` + golfvorm/BeatPlan). De stem loopt 400 ms (+ BT-
   latentie) vóór. Memory: `feedback-haptics-follow-visual-voice`.
2. **Wandklok-ankers, geen getelde intervallen**: elk volgend moment = anker +
   n·periode. Dat houdt telefoon en horloge synchroon over lange sessies.
3. **Hele plan in één keer naar native** waar het OS JS bevriest (Android
   golfvorm/service, iOS BeatEngine, horloge krijgt parameters en speelt zelf).
4. **Één trilbron**: horloge-ack (`breath_ack` / `state-ack`) → telefoon zwijgt;
   geen ack → telefoon neemt over.
5. **Per-toestel meten, niet afstellen op de A16**: `canPlayNativeWaveform()`
   (amplitude ja/nee) kiest kracht vs duur; BT-latentie per uitgang.
6. **"BeatBus"/ClockSync** zijn horloge-concepten (`android/wear/.../BeatBus.kt`,
   wear-app `ClockSync`): het horloge rekent het telefoonanker om naar zijn
   eigen klok. Telefoonzijde levert enkel het anker (`sentAtMs`,
   `lastAnchorWallMs`) — zie Watch-deel.

### C.4.2 Herinneringen — `src/services/reminders.ts` (expo-notifications)

- `ReminderKind = 'breath' | 'bracelet' | 'bracelet-plan'`;
  `ReminderSlot = morning (08:00) | midday (13:00) | afterWork (18:00) |
  evening (21:00)` met toegelaten vensters `SLOT_RANGE` (5–12, 12–17, 17–20,
  20–29 u). Vaste id per moment (`vzc-<kind>-<slot>`) zodat opnieuw plannen
  vervangt. Toon: meldt dat iets klaarstaat, geen schuld/streak.
- `ensurePermission()`, `syncReminders()`, `syncPlanReminders(plan)`
  (max `MAX_PLAN_ITEMS = 8`), `syncBraceletPlanReminder()`
  (max 8), `resyncAllPlanReminders()`, `tappedReminderOnLaunch()`,
  `onReminderTap()`, `reminderRoute/Params` (tik opent de juiste sessie,
  schermen erboven verdwijnen zonder animatie — `goToTabInstant`).
- Meldingsdata-kinds die de handler in `_layout.tsx` onderscheidt:
  `bracelet-session` (lopende-tijdmelding, geen heads-up), `bracelet-done`.
- Overige: `src/services/access-notifications.ts`, `sales-nudges.ts`,
  `welcome-popup.ts` (buiten deze scope).

### C.4.3 Plannen en agenda (kort)

- **Breathwork-plan**: `src/utils/plan-store.ts` (per gebruiker gebucket,
  sleutel `vzpc_<bucket>_v1`; `PlanSlot` = 4 momenten; `PlanHorizon today|1w|
  2w|1m|3m|ongoing`; `PlannedItem {slot, state, techniqueKey, minutes}`),
  generatie in `src/utils/protocol.ts` + `src/utils/day-plan.ts` (doel is
  leidend; tijdstip enkel tiebreak), `plan-roll.ts` (dagen doorrollen).
  Schermen: `goal.tsx`, `intensity.tsx`, `plan.tsx`, `plan-review.tsx`,
  `plan-summary.tsx`, `plan-success.tsx`, `agenda.tsx`, `build-your-day.tsx`.
- **State Control-plan**: `src/utils/bracelet-plan-store.ts` (sleutel
  `vzbpc_…`, gebruiker bouwt zelf de dag; geen algoritme). Schermen:
  `bracelet-set-day.tsx`, `bracelet-agenda.tsx`, `bracelet-protocol.tsx`.
- Starten vanuit plan/herinnering: Breathwork via `openBreathSession` met
  `minutes`/`technique`; State Control via `startStateControlNow()` (landt
  gepauzeerd).

---

## C.5 Vergrendelscherm & achtergrond per platform

### C.5.1 Android

| Sessie | Wat draagt de achtergrond | FGS-type | Vergrendelscherm |
|---|---|---|---|
| Breathwork | `BreathSessionService` (wake lock + Handler), enkel bewapend als de app naar de achtergrond gaat | `mediaPlayback` (via `modules/breath-background/plugin.js`) | Mediakaart: modusnaam, "M:SS" (Now Bar), fase + "· M:SS left", aftellende chronometer + voortgangsbalk, Pause/Resume, VIBEZCORE-art. Geen stille-anker-kaart meer. |
| State Control | `StateHapticsService` (golfvorm + SoundPool-hartslag, wake lock) | `mediaPlayback` (`modules/state-haptics` manifest) | Mediakaart: MODUS, resterende tijd, Pause/Resume, art; "Session complete"-melding aan het einde. Als de service nog niet draait (gepauzeerd vóór de eerste Play): platte expo-notifications-melding "State Control · M:SS left" (`bracelet-session-monitor.ts`). In de voorgrond geen melding. |
| Voorproef State Control | zelfde service, label "<Modus> · Free preview" | `mediaPlayback` | idem |
| Audio Library | expo-audio `AudioControlsService` (Media3 `MediaSessionService`) | `mediaPlayback` (expo-audio) | Media3-kaart met titel, reeks, volle pijlerfoto (patch), play/pause/seek |

Permissies (app.json): `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`;
plugin: `WAKE_LOCK`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. Play-Console:
de FGS-verklaring (mediaPlayback) is op 3 nov 2026 ingediend met video's
(`docs/store/PLAY_FGS_VERKLARING_2026-11-02.md`); build 113 + Wear pas naar
productie na goedkeuring. Alle sessie-meldingen zijn `setLocalOnly(true)`
(Samsung zou anders zijn eigen media-UI op het horloge openen).

### C.5.2 iOS

| Sessie | Wat houdt de app levend | Vergrendelscherm / Dynamic Island |
|---|---|---|
| Breathwork | `modules/session-audio` (owner `breath`), `UIBackgroundModes: audio`; vrijgegeven tijdens pauze | **Live Activity** `kind:'breath'` (titel = toestand, subtitel = techniek, kleur, aftellende tijd, pauze/hervat-intent). Geen fase-updates. Terugval: Now Playing-kaart van het anker. |
| State Control | BeatEngine (`startSessionBeats`) — slagen op de geluidsklok; owner `state` | **Live Activity** `kind:'state'` (modusnaam, "State Control", aftelling, pauze/hervat); geplande lokale melding "Session complete" (`IOS_DONE_ID`, `kind:'bracelet-done'`). Op slot: enkel geluid (iOS laat apps niet trillen), Apple Watch trilt wel. |
| Audio Library | expo-audio + `setActiveForLockScreen` | Standaard Now Playing (titel, reeks, pijlerfoto, bediening) |

`app.json` iOS: `NSSupportsLiveActivities: true`, `UIBackgroundModes: ["audio"]`,
Health-teksten (enkel Mind & Body-sessie op het horloge starten, niets lezen
of bewaren). Swift is niet compileerbaar op Windows — elke iOS-wijziging pas
te verifiëren in een EAS-build (memory `feedback-ios-android-simultaneous`).
Apple Watch-dimstand (zoals Galaxy op 3 nov) staat gepland voor iOS 1.0.1.

---

## C.6 Valkuilen en vaste regels (lees vóór je iets aanraakt)

1. **Nooit twee lussen tegelijk** (Breathwork): JS óf native, nooit allebei —
   anders dubbele stem. Native start enkel bij AppState ≠ active of via
   `ACTION_PAUSE`/hervat op slot.
2. **Pauzetijd overal aftrekken** (`pausedMsRef`) bij elke wandklokrekensom.
3. **Sessies starten op pauze** (Breathwork én State Control uit plan/
   herinnering); enkel Quick Chill/Boost starten meteen. Niet-gespeelde sessie
   = terug is weg, geen pill (`docs/UI_EN_BEWEGINGSREGELS.md` §4).
4. **Mengen, nooit focus stelen**: ademsessies `mixWithOthers`; enkel de
   Library gebruikt `doNotMix` (vereist voor lockscreen-controls).
5. **Tempo/duur wijzigen** = `ble-contract.ts` (`MODES`) of `bracelet-haptics.ts`
   (`SPECS`, constants) of `breath-states.ts`/`breath-level.ts`, plus
   `docs/VIBEZCORE_SCIENCE_A_TOT_Z.md`, plus CLAUDE.md §5-tabel, plus horloge
   (het horloge rekent dezelfde curve uit parameters — check
   `watchStateParams` / `docs/WATCH_PROTOCOL.md`). Firmware moet de minima
   aanvaarden.
6. **Kleuren**: bron `src/data/breath-states.ts`; `ble-contract.ts` volgt.
   Sleep in horloge/Live Activity = `#4AF0D4`.
7. **Geen claims**: toestand-taal; nooit "je hart volgt het ritme",
   "hersengolven", "synchroniseert". Edelstenen/ritme: geen helende claims.
8. **Stemopnames vervangen** = `CDN_BASE`-map + `VOICE_CUE_SPEECH` opnieuw
   meten + `VOICE_ASSET_URLS` blijft automatisch kloppen.
9. **`android/` is niet getrackt** (behalve `android/wear/`): telefoon-
   manifest/Gradle via config-plugins of `modules/*/android`.
10. **Worklets**: `'worklet'`-helpers vóór gebruik declareren (tsc ziet het
    niet; crash 9 okt).
11. **Echt glas** (`BlurView` met `blurTarget`) enkel binnen `<GlassSheet>`,
    nooit rechtstreeks in een sessiescherm (native SIGSEGV).
12. **Na elke wijziging**: tsc + jest (523–526 groen op 3 nov), TEST_LOG
    bijwerken, WERKSTATUS in dezelfde commit, push naar
    `rollback-vc76-take2`. Bevestigde flows (🔒 in `docs/TEST_LOG.md`) eerst
    zelf hertesten na force-stop.

### Open punten die deze motoren raken (stand 3 nov 2026)

- Galaxy A16 "Strong voelt zwak" bij State Control → nu `STATE_MS_FACTOR`
  strong 2,2; verder verhogen voor Boost/Sharp Focus zonder Sleep/Calm
  zoemerig te maken staat open.
- Wear OS Ongoing Activity (eerste run na installatie toont sessie niet).
- MediaSession-lek in `StateHapticsService` na stoppen (release()).
- Eerste State Control-sessie na horloge-update ~1 s achter (ClockSync bij
  openen van de horloge-app i.p.v. bij eerste sessie, enkel als het terugkomt).
- `bracelet-control.tsx` gebruikt nog geen echte BLE Pause/Resume-opcodes;
  `RealBracelet` niet gebouwd.
- iOS-achtergrond-ademmodule (`BreathBackgroundModule.swift`) nooit op toestel
  geverifieerd; Apple Watch-dimstand naar 1.0.1.

---

## Deel D — Horloges, bracelet, builds, releases en beheer

> Stand: 3 november 2026, branch `rollback-vc76-take2`. Alles hieronder is nagekeken tegen de code en config in de repo
> (`C:\Users\ulgar\vibezcore-app`). Waar iets enkel uit een document of het geheugen komt, staat dat erbij.
> Geheime waarden staan hier NOOIT in, enkel *waar* ze liggen en *waarvoor* ze dienen.

Inhoud:
- D1. Wear OS-app (Galaxy Watch)
- D2. Apple Watch-app
- D3. Telefoon ↔ horloge: protocol en bruggen
- D4. Smart Bead Bracelet (BLE)
- D5. Build- en release-runbook
- D6. Testen
- D7. Beheer: repo, back-ups, docs, secrets, kosten, noodherstel, eerste dag

---

## D1. Wear OS-app (Galaxy Watch / Wear OS 3+)

### D1.1 Bron vs. kopie — de belangrijkste valkuil

| Map | Rol | In git? |
|---|---|---|
| `wear-app/` | **Bron van waarheid.** Hier bewerk je de horloge-app. | Ja |
| `android/wear/` | **Kopie** die Gradle als module `:wear` bouwt. Wordt door `plugins/withWearApp.js` bij elke `expo prebuild` overschreven (eerst `src/` gewist, dan `wear-app/` gekopieerd) en ingehaakt in `settings.gradle` (`include ':wear'`) + `app/build.gradle` (`wearApp project(':wear')`). | Ja — `android/` staat in `.gitignore`, maar de 45 bestanden van `android/wear/` zijn ooit geforceerd toegevoegd en worden dus wél gevolgd. |

Regels (bindend, `docs/WEAR_RELEASE.md` §0, sinds 27 okt 2026 — bundel 26102714 ging zonder catalogus-fix naar Play):
1. Nooit rechtstreeks in `android/wear/` werken; dat verdwijnt bij de volgende prebuild.
2. Vóór ELKE horloge-build: `diff -rq wear-app/src android/wear/src` — verschil? → `cp -r wear-app/src/. android/wear/src/` (en `build.gradle` idem).
3. Na kopiëren toont `git status` `android/wear/...` als gewijzigd: mee committen in dezelfde commit.
   (Stand 3 nov 2026: `android/wear` heeft 5 niet-gecommitte bestanden die identiek zijn aan de al gecommitte `wear-app/` van `4997fe37` — gewoon committen.)

### D1.2 Gradle-module (`wear-app/build.gradle`)

- `namespace com.ubili.vibezcoreapp.wear`, **`applicationId com.ubili.vibezcoreapp`** (zelfde als de telefoon — vereist voor embedded companion), `minSdk 30`, compile/target SDK van de root-project.
- `versionCode` = `-PwearVersionCode=…` of automatisch **`yyMMddHH`** (bv. `26110314` = 3 nov 2026, 14 u). Moet altijd hoger zijn dan de vorige upload en staat los van de telefoon-versioncode (die zit rond 113).
- `versionName "1.0.0"`, Java/Kotlin 17, `minifyEnabled false`.
- Dependencies: `androidx.core:core-ktx 1.13.1`, `activity-ktx 1.9.3`, `androidx.wear:wear 1.3.0` (ambient), `wear-ongoing 1.0.0` (Ongoing Activity), `play-services-wearable 18.2.0` (MessageClient/DataClient).
- **Signing:**
  - debug: `android/app/debug.keystore` (zelfde als de telefoon-dev-build). Google Play Services levert berichten **enkel tussen apps met dezelfde handtekening** — een horloge-app met een andere sleutel (bv. via kabel geïnstalleerd met de standaard `~/.android`-sleutel) ontvangt niets en zijn `state/ack` komt niet aan (telefoon én horloge trillen dan samen; gezien 2 nov 2026).
  - release: eerst `credentials.json` in de projectroot (van `eas credentials` → Android → production → "Download credentials from EAS to credentials.json"; wijst naar `credentials/android/keystore.jks`), anders `wear-app/keystore.properties` + `wear-app/upload.jks`. Beide NIET in git. Dit is de **upload-sleutel van de telefoon-app** (SHA1 begint met `91:BD:78…`).

### D1.3 Manifest (`wear-app/src/main/AndroidManifest.xml`)

- `uses-feature android.hardware.type.watch`; `com.google.android.wearable.standalone = false` (niet-standalone: de telefoon levert de catalogus; daarna kan het horloge wel zelfstandig sessies starten).
- Permissies: `VIBRATE`, `WAKE_LOCK`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_HEALTH`, `HIGH_SAMPLING_RATE_SENSORS` (install-time, nodig naast FGS_HEALTH op Android 14+, geen sensorgebruik), `POST_NOTIFICATIONS`.
- Alle activities `screenOrientation="nosensor"`, thema `@style/VzWearTheme`; enkel `MainActivity` is exported (launcher).
- `BreathListenerService` (exported, `WearableListenerService`) luistert op `MESSAGE_RECEIVED` met pathPrefix `/vibezcore/breath`, `/vibezcore/state`, `/vibezcore/catalog/reply` en op `DATA_CHANGED` voor `/vibezcore/catalog`.
- `WearBreathSessionService` en `WearStateSessionService`: `foregroundServiceType="health"`.
  Play-verklaring "Gezondheid/Overig" hiervoor is op 3 nov 2026 verstuurd met video (zie `docs/store/PLAY_FGS_VERKLARING_2026-11-02.md`).

### D1.4 Bestanden (`wear-app/src/main/java/com/ubili/vibezcoreapp/wear/`, ±5 500 regels Kotlin)

| Bestand | Wat |
|---|---|
| `MainActivity.kt` | Eén scherm voor startscherm én lopende sessie (State Control + Breathwork): naam met kleurstip, `SessionRingView`, pauzeknop + END. Ambient-callback (Always On). `EXTRA_OPENING`: tot 3 s zwart i.p.v. het beginscherm terwijl een sessie opstart. |
| `ModesActivity.kt` | Na de keuze op het startscherm: de vijf toestanden van één onderdeel, één per scherm (STATE CONTROL = watercirkel, BREATHE = ademende figuur). |
| `StateActivity.kt` | Breathwork stap 2: één toestand — figuur, Technique, duur, Start. |
| `TechniqueActivity.kt` | Kies ademtechniek; de techniek die de telefoon zou kiezen staat als "For you". |
| `DurationActivity.kt` | Duurstappen (2–4) van de techniek, lijst i.p.v. wiel. |
| `StateControlActivity.kt` | State Control op het horloge starten: naam, duur, witte Start. |
| `StateDurationActivity.kt` | Duur per hele minuut binnen het bereik van de toestand, "Recommended". |
| `HapticsActivity.kt` | Strong (standaard) / Medium — één instelling met de telefoon (gaat naar de telefoon, komt terug via catalogus). |
| `WearStateSessionService.kt` | State Control-ritme lokaal: zelfde formule als `src/services/bracelet-haptics.ts` (`bpmAt`/`beatAt`/`buildWaveform`), tik per tik op eigen klok; handdruk ARM→READY→GO (D3.3). |
| `WearBreathSessionService.kt` | Ademsessie lokaal: telefoon stuurt bij start alle fasen + trilpatronen; het HELE ritme gaat in één vibrator-patroon met repeat-index (wakelock wordt op Wear met scherm uit DISABLED). |
| `BreathListenerService.kt` | Logica-loos doorgeefluik van berichten naar de diensten + `bringSessionToFront()`; ontvangt catalogus (`onDataChanged`) en ververst `ClockSync`. |
| `PhoneLink.kt` | Horloge → telefoon (`state/ack`, `breath/ack`, `state/ready`, `watch/action`, `catalog/request` met payload `"hs1"` = kent de handdruk). Faalt altijd stil. |
| `ClockSync.kt` | Klokmeting horloge ↔ telefoon (D1.6). |
| `CatalogStore.kt` | Bewaart de catalogus van de telefoon (SharedPreferences `vz_watch`), laatste keuzes, `techByState`; watchlog-pad `/vibezcore/watchlog`. |
| `OngoingSession.kt` | Melding als Wear **Ongoing Activity** (V-icoon op de wijzerplaat + recente apps, één tik = terug in sessie, categorie WORKOUT). |
| `KeepAlive.kt` | Speelt `res/raw/vz_silence.wav` in een lus tijdens een sessie: Samsung Freecess bevriest anders de app ~5 s na scherm uit (ook met FGS). Geen audiofocus. |
| `SessionRingView.kt` / `WaterCircleView.kt` | De sessiecirkel (golf, ringen per tik, ambient-variant) / watercirkel in de kiezers. |
| `HoldToEnd.kt` | END = vasthouden (15 okt 2026: één spookaanraking stopte een sessie). |
| `BeatBus.kt` | Tik-events naar het scherm (enkel weergave). |
| `BreathSessionState.kt` / `StateSessionState.kt` | In-process singletons dienst → scherm. |
| `VzLog.kt` | `VZSync`-logs enkel in debug-builds. |

Resources: `res/drawable/ic_launcher_bg.xml` + `ic_launcher_fg.xml` (adaptief icoon), `vz_vmark*.xml` (V-merk), `drawable-nodpi/vz_art_*.png` (ademfiguren zon/bloem/lotus/clarity/boom), `raw/vz_silence.wav`, `values-v31/styles.xml` (splash).

### D1.5 Always On / ambient (discreet, 3 nov 2026)

- `AmbientLifecycleObserver` in `MainActivity`: pols omlaag = ons scherm blijft gedimd staan (zoals Apple Workout), pols omhoog = meteen weer de ring.
- Ambient-ontwerp (commits `5415ee7f`, `4997fe37`): dunne **gedempte boog in de toestandskleur (~45 %)** die korter wordt met de resterende tijd, een heel zwakke volle cirkel eronder, "8 min" klein en grijs (~45 %); naam, knoppen en het losse bolletje zijn weg; golf staat stil. Breathwork: totale duur één keer per sessie geschat (resterende tijd + rondes).
- Sessie en trillingen lopen ongewijzigd door in ambient.
- **Apple Watch heeft deze discrete dimstand nog NIET** (operator: eerst Android; komt in iOS-update 1.0.1).

### D1.6 Synchronisatie telefoon ↔ horloge

- **ClockSync** (`ClockSync.kt`, telefoon-kant in `WearBreathModule.kt`): NTP-achtig, horloge stuurt `/vibezcore/clock/ping`, telefoon antwoordt meteen `/vibezcore/clock/pong` met "<horlogeklok>,<telefoonklok>". Sinds 29 okt 2026 op de monotone tellers (`elapsedRealtime`), fout ≤ rtt/2; meting ongeldig na diepe slaap van het horloge (Watch4-teller verspringt tot 870 ms), na >30 min, rtt >1 s of herstart. Bij elke start `measureNow` (max 1,5 s) vóór READY.
- Terugval zonder meting: `LEGACY_AHEAD_MS = 93` (gemeten 14 okt op Watch4 + A16).
- Gemeten 27 okt 2026 (alle vijf toestanden, motor-tijden uit HAL-logs): horloge-lub minus telefoon-lub mediaan tussen −52 en +17 ms.
- Meten: horloge-logcat tag `VZSync` (debug), telefoon `[sync]` in ReactNativeJS (dev), `SecVibrator-HAL`/`VibratorManagerService` voor echte motortijden (`logcat -v epoch`). Zie geheugen `reference-wear-haptic-sync.md`.
- Open (2 nov): één keer ~1 s achter bij de allereerste sessie na een update; enkel aanpakken als het terugkomt (dan ClockSync al bij openen van de horloge-app).

### D1.7 Icoon

- Adaptief: tekenvlak 108 dp, zichtbare cirkel 72 dp; moet die cirkel volledig vullen (gemeten op Watch4: tegel 102 px). Regel: `docs/UI_EN_BEWEGINGSREGELS.md` § "Horloge-icoon".
- Sinds 1 nov 2026 (iOS build 68): witte cirkel met zwarte V, geen ring — Galaxy Watch idem via `ic_launcher_bg/fg` (bron: comment in `targets/watch/expo-target.config.js`). Elke icoonwijziging opnieuw meten naast andere tegels.

### D1.8 Bekende Wear-gedragingen

- Eerste run na nieuwe installatie: app staat in Android "stopped state" → horloge trilt maar kan het scherm niet tonen; Ongoing Activity + eenmalige tip "open VIBEZCORE once on your watch" (telefoon, Android) vangen dit op.
- Scherm blijft aan tot de time-out van het horloge = systeemgedrag (geheugen `feedback-watch-screen-discreet.md`: scherm niet wakker houden).
- Galaxy Watch stuurt sinds `5868f9ea` ook `breath/ack` → telefoon trilt dan niet mee bij Breathwork (tenzij de gebruiker telefoon-haptics aan wil).

---

## D2. Apple Watch-app (`targets/watch/`)

### D2.1 Opbouw

- Gebouwd door **`@bacons/apple-targets`** (devDependency, plugin in `app.json`): bij `expo prebuild` wordt `targets/watch/` een watchOS-Xcode-target. `ios/` staat niet in git en bestaat lokaal niet (Windows) — **Swift is enkel compileerbaar via EAS**.
- `expo-target.config.js`: `type: 'watch'`, interne naam **`VIBEZCOREWatch`** (moet verschillen van de iPhone-target, anders kende EAS het profiel verkeerd toe — 15 okt), `displayName VIBEZCORE`, bundle `com.ubili.vibezcoreapp.watchkitapp`, `deploymentTarget 10.0`, accent `#00A3A3`, icoon `targets/watch/icon.png` (1024 px), ademfiguren uit `assets/watch-art/vz_art_*.png`, entitlement `com.apple.developer.healthkit`. Geen App Group (bewust).
- `Info.plist` (in git; de plugin maakt het enkel aan als het ontbreekt): `WKBackgroundModes = [mindfulness, workout-processing]` + `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` (zelfde tekst als de iPhone in `app.json`). Ontbreken die → App Store-weigering ITMS-90683 (build 67).
- Let op: de comment in `expo-target.config.js` noemt nog `AppDelegate.swift`/`BreathHapticPlayer.swift`; die bestaan niet meer (verouderde verwijzing).

| Bestand | Wat |
|---|---|
| `VibezcoreWatchApp.swift` | `@main`, `WatchAppDelegate.handle(HKWorkoutConfiguration)` — iPhone opent de app via `startWatchApp`; start meteen de workoutsessie. |
| `PhoneConnector.swift` | De ENIGE `WCSessionDelegate`; routeert op `type`: `start/stop/pause` → Breath, `state_start/state_pause/state_stop` → State, `catalog`; `bracelet_status/_stop` genegeerd. Drie inkomende paden: `sendMessage`, `applicationContext`, `userInfo`. |
| `BreathSessionController.swift` | Ademsessie lokaal; watchOS heeft **geen Core Haptics**, enkel `WKInterfaceDevice.play()` met 9 types → metronoom-vertaling (in = snelle tikken omhoog, vast = traag, uit = omlaag). |
| `StateSessionController.swift` | Letterlijke vertaling van `bpmAt/beatAt`; tikken gepland op absolute datum (geen drift), geen amplitudesturing (lub/dub via vaste types; sterkte Strong/Medium kiest het type). |
| `RuntimeSessionManager.swift` | Houdt de app wakker met de pols omlaag: eerst **HKWorkoutSession "Mind & Body"** (haptiek op de achtergrond mag enkel tijdens een workout), terugval `WKExtendedRuntimeSession` (mindfulness, max. 1 uur). Eigenaars `breath`/`state`. `modeCode` W/M/- voor de tijdmeting in Settings. |
| `ContentView.swift` | Sessieschermen: State Control = cirkel vult het scherm; Breathwork = ademende figuur + boog; always-on (`isLuminanceReduced`) = enkel tijd/fase gedimd. |
| `HomeView.swift` | Startscherm + kiezers, 1-op-1 de opbouw van de Galaxy Watch; laatste keuzes in `UserDefaults`. |
| `WatchCatalog.swift` | Catalogus van de iPhone (zelfde inhoud als Wear), bewaard in `UserDefaults`; sessies op het horloge gaan terug als `watch_log`. |

### D2.2 HealthKit — wat wel en niet

- Doel: de iPhone kan de Watch-app openen bij het starten van een sessie (`HKHealthStore.startWatchApp`) en de workout laat haptiek toe met de pols omlaag/vergrendeld.
- **Er wordt NIETS opgeslagen of gelezen**: geen `HKLiveWorkoutBuilder`, geen `HKWorkout`. Dit staat ook zo in de purpose strings, de privacytekst van de website en App Store-privacylabels (Health + Fitness gekoppeld aan App Functionality, geen tracking).
- Toestemming "Workouts" moet AAN staan (Privacy › Health › VIBEZCORE); zonder valt de haptiek weg bij scherm uit. De app controleert dit bij elke horlogesessie (`getWorkoutPermission`/`requestWorkoutPermission` in `modules/watch-breath`) en toont anders een kaart met Open Settings.
- iPhone-zijde: `app.json` → `ios.entitlements.com.apple.developer.healthkit = true`, `ios.infoPlist` met beide `NSHealth…UsageDescription`, `privacyManifests`.

### D2.3 iPhone-brug: `modules/watch-breath` (Expo-module, `ios/WatchBreathModule.swift`)

- Live via `WCSession.sendMessage` als bereikbaar; terugval: Breathwork via `updateApplicationContext` (enkel laatste stand), State Control via `transferUserInfo` (FIFO; verouderde `state_*` worden geannuleerd), catalogus via `transferFile` + `sendMessage` (`type: "catalog"`).
- Ontvangt van de Watch: `clock_ping`, `catalog_request`, `watch_log`, `breath_ack`, `state_ack`, `watch_action`.
- JS-API (`modules/watch-breath/index.ts`): `syncAppleWatchCatalog`, `onAppleWatchLog`, `getAppleWatchStatus` (`none|noApp|ready`), `getWorkoutPermission`, `requestWorkoutPermission`, `isWatchReachable`, `send/pause/stopBreathSessionToWatch`, `send/pause/stopStateSessionOnWatch`, `sendBraceletStatusToWatch`, `stopBraceletRelayOnWatch`, `onWatchAction`, `onBreathAck`, `onStateAck`.
- Live Activity (iPhone-vergrendelscherm/Dynamic Island) is een aparte target `targets/live-activity/` (`VIBEZCORELive`, bundle `…liveactivity`, iOS 16.2) + `modules/live-activity`; `VibezSessionAttributes` moet in beide identiek blijven; `_shared/VibezToggleSessionIntent.swift` zit in app én extensie (pauze vanaf het vergrendelscherm).

---

## D3. Telefoon ↔ horloge: protocol

Bindend document: `docs/WATCH_PROTOCOL.md` (let op: de handdruk PREPARE/READY/GO, de klokmeting en de catalogus-request/reply staan daar nog NIET in — zie hieronder, bron = code).

### D3.1 Principes
1. Het horloge speelt het ritme zelf af; de telefoon stuurt enkel start/pauze/stop + parameters (zelfde autonomie als de bracelet).
2. De telefoon is de bron van waarheid (catalogus, toegang, sterkte, rusthartslag). Horlogeknoppen sturen `watch-action`; pauze/stop past het horloge meteen ook zelf toe, hervatten loopt via de telefoon.
3. Eén ritme tegelijk: na `state-ack` (en sinds 2 nov ook `breath-ack`) zet de telefoon zijn eigen trilling stil; sessie/timer/melding op de telefoon lopen door.
4. Ritme-formule overal identiek aan `src/services/bracelet-haptics.ts` (zie formuleblok in `WATCH_PROTOCOL.md`). Wijzig je die formule → Kotlin (`WearStateSessionService.kt`), Swift (`StateSessionController.swift`), tests (`__tests__/rhythm/state-control-rhythm.test.ts`) en `docs/VIBEZCORE_SCIENCE_A_TOT_Z.md` mee.

### D3.2 Wear OS-paden (MessageClient / DataClient)

| Pad | Richting | Inhoud |
|---|---|---|
| `/vibezcore/breath/start` | tel → horloge | volledige ademsessie (fasen, rondes, trilpatronen, modeName, bij hervatten `startRound/startPhase/phaseRemainingMs`) |
| `/vibezcore/breath/pause`, `/breath/stop` | tel → horloge | leeg |
| `/vibezcore/breath/ack` | horloge → tel | horloge speelt de ademsessie (telefoon trilt niet mee) |
| `/vibezcore/state/start` | tel → horloge | oud startbericht (terugval voor horloges zonder handdruk) |
| `/vibezcore/state/prepare` | tel → horloge | volledige State Control-sessie + `hsId` (handdruk stap 1) |
| `/vibezcore/state/ready` | horloge → tel | `hsId` — dienst draait, klok vers gemeten |
| `/vibezcore/state/go` | tel → horloge | klein bericht: `id`, `startInMs`, `anchorMono`, `phoneBootWall` |
| `/vibezcore/state/pause`, `/state/stop` | tel → horloge | leeg |
| `/vibezcore/state/ack` | horloge → tel | `{ "playing": true }` |
| `/vibezcore/state/wake` | tel → horloge | enkel wekken als State Control opent |
| `/vibezcore/watch/action` | horloge → tel | `{action: pause|resume|stop, kind: bracelet|breath}` (`bracelet` = State Control, naam behouden) |
| `/vibezcore/clock/ping` / `/clock/pong` | heen/terug | klokmeting |
| `/vibezcore/catalog` | tel → horloge (DataItem, bewaard) | catalogus (`src/services/watch-catalog.ts` → `buildWatchCatalog`, incl. `entitledUntil`) |
| `/vibezcore/catalog/request` / `/catalog/reply` | heen/terug | actief opvragen (DataItem komt soms niet aan als de app niet draait); request-payload `"hs1"` |
| `/vibezcore/watchlog/…` | horloge → tel (DataItem) | sessies gedaan op het horloge; telefoon haalt op en wist (`takeWatchSessions`) → geschiedenis/Health |

Capability-naam van de horloge-app: `vibezcore_watch_app` (telefoon zoekt hiermee of de app op het horloge staat).

### D3.3 Handdruk "samen starten" (28 okt 2026)
Telefoon stuurt PREPARE (groot) → horloge start dienst, leest sessie, meet de klok vers → READY → telefoon stuurt GO "begin over X ms" op een warme verbinding en start zelf op hetzelfde moment. `HANDSHAKE_TIMEOUT_MS = 3000` (PREPARE deed er soms 1,27 s over); enkel een horloge dat helemaal zwijgt valt terug op het oude `state/start`. Of een horloge de handdruk kent, onthoudt de telefoon (`vz_wear_handshake`).

### D3.4 Telefoon-brug Android: `modules/wear-breath` (`WearBreathModule.kt`)
JS-API (`modules/wear-breath/index.ts`): `getWatchStatus`, `openStoreOnWatch`, `isWatchReachable`, `send/pause/stopBreathSessionOnWatch`, `sendStateSessionToWatch`, `pauseStateSessionOnWatch`, `stopStateSessionOnWatch`, `wakeWatch`, `onBreathAck`, `onStateAck`, `onWatchAction`, `onWatchSessionLogged`, `syncWatchCatalog`, `takeWatchSessions`, `keepLinkWarm`.
Gebruikers in de app: `src/services/bracelet-haptics.ts`, `bracelet-session-monitor.ts`, `watch-catalog.ts`, `src/app/breath-session.tsx`, `src/app/(tabs)/account.tsx`, `src/components/WatchHapticsRow.tsx`, `src/utils/watch-setup-tip.ts`.

### D3.5 Apple Watch-transport (WCSession)
`type`-waarden: `start|pause|stop` (Breathwork), `state_start|state_pause|state_stop`, `state_ack`, `breath_ack`, `watch_action`, `catalog`, `catalog_request`, `watch_log`, `clock_ping`, `bracelet_status|bracelet_stop` (relay, genegeerd op de Watch).

### D3.6 Toegang op het horloge
Free = Breathwork én State Control als 30 s-voorproef; Premium = alles open (`src/services/watch-catalog.ts`, test `__tests__/watch-catalog-free.test.ts`). Einde van Premium geldt ook op het horloge via `entitledUntil` in de catalogus (27 okt 2026).

---

## D4. Smart Bead Bracelet (BLE)

### D4.1 Status
- Product: premium upgrade/upsell, "Launching Early 2027" (Kickstarter). In de app: geen eigen tab; bereikbaar als upgrade; `src/app/bracelet-control.tsx` (± 6 700 regels) is het bedieningsscherm.
- **Er is GEEN echte BLE-code in de app.** `react-native-ble-plx` staat niet in `package.json`. `src/services/bracelet.ts`: `export const USE_SIMULATED_BLE = true;` — de `false`-tak gooit "RealBracelet not implemented yet".
- **Firmware zit NIET in deze repo.** Volgens het geheugen (`project-firmware-v3-zephyr.md`): v3 (nRF Connect SDK/Zephyr, toolchain in `C:\ncs\v3.4.0\`) stond in `~\Downloads\vibezcore-firmware-v3-ncs\` maar is sinds 9 okt 2026 **verdwenen**; enige overgebleven firmware: `OneDrive\Bureaublad\pcb alle documenten\vibezcore-firmware-correct.zip` (13 juli 2026, nRF5 SDK-versie). PCB is gebouwd (nRF52832 + DRV2605L + LRA + LiPo + POGO-laden).
- Hardware-contract: `Haptic_Bracelet_Spec_v2_3.docx` (projectkennis op claude.ai, niet in repo) is het bindende contract volgens CLAUDE.md. **Let op:** `ble-contract.ts`/`bracelet-sim.ts` volgen een "v2.4"-werkontwerp (Pause 0x04 / Resume 0x05, `session_paused`) dat uit een AI-chat kwam en NIET hardware-gevalideerd is (geheugen `feedback-ai-spec-not-verified.md`). Getallen = ontwerpkeuzes.

### D4.2 Contract (CLAUDE.md §6 + `src/services/ble-contract.ts`)
- Command App → Bracelet: `{ mode: 0-4, duration: minuten, command }` met `0x01 START`, `0x02 STOP`, `0x03 STATUS_REQUEST` (v2.3) + `0x04 PAUSE`, `0x05 RESUME` (werkontwerp v2.4; `bracelet-control.tsx` gebruikt die nog niet — doet pauze nog via STOP + lokale `pausedAt`-boekhouding).
- Status Bracelet → App: `session_active, (session_paused), current_mode, remaining_minutes, battery_percent, charging, fault`.
- Interactiemodel: één commando, daarna draait de bracelet AUTONOOM op hardware-timers; BLE-verlies stopt de sessie niet; app pollt elke 5 s; einde bij timer · laden · batterij <5 % · fault · STOP; geen realtime parameters. De app toont nooit PPS/burst_ms/amplitude/RTP.
- Modi (`MODES` in `ble-contract.ts`, bron kleuren = `src/data/breath-states.ts`): 0 Boost (5–20, 10), 1 Sharp Focus (5–30, 15), 2 Calm Control (5–30, 18), 3 Clarity & Relax (10–45, 25), 4 Sleep (10–50, 30). `clampDuration`, `QUICK_SESSIONS`.
- GATT-UUID's: niet in de spec; voorstel in `docs/STRUCTUUR_en_BLE_contract_v2.md` §5.4, te bevestigen in de firmwarefase.

### D4.3 Architectuur
- `BraceletTransport`-interface (`ble-contract.ts`): `getConnectionState, connect, disconnect, sendCommand, requestStatus, onConnectionChange`.
- `SimulatedBracelet` (`src/services/bracelet-sim.ts`): clamp, autonome timer, batterij-afloop, <20 % −20 % amplitude intern, <5 % stop, laden stopt, fault, pauze >60 min = einde. `getSimHooks()` voor demo-knoppen (laden/fault/batterij).
- `getBracelet()` in `bracelet.ts` = enige ingang. UI weet nooit welk transport erachter zit.
- Toekomst `RealBracelet`: `react-native-ble-plx` toevoegen (= native module → nieuwe dev build), zelfde interface, `USE_SIMULATED_BLE = false`; `bracelet-session-monitor.ts` slaat sommige logica over zolang gesimuleerd.
- Verwante services: `bracelet-haptics.ts` (State Control-ritme op telefoon/horloge, hetzelfde "lub-dub"-ritme dat de bracelet zal spelen), `bracelet-activation.ts` (activatiecode `XXXX-XXXX-XXXX-XXXX` → `POST /api/bracelet/activate` op de eigen backend), `bracelet-session-state.ts`, `bracelet-upsell.ts`, `bracelet-voice.ts`.

---

## D5. Build- en release-runbook

### D5.1 Identiteiten
| | Waarde | Waar |
|---|---|---|
| Expo-project | owner `ubili`, slug `vibezcore-app`, projectId in `app.json` → `extra.eas.projectId` | `app.json` |
| Bundle/pakket | `com.ubili.vibezcoreapp` (iOS + Android + Wear) ; Watch `…watchkitapp` ; Live Activity `…liveactivity` | `app.json`, `targets/*/expo-target.config.js`, `wear-app/build.gradle` |
| Apple | Team `88AL3UW7L7`; Apple ID en ASC-app-id in `eas.json` → `submit.production.ios` | `eas.json` |
| Versie | `expo.version 1.0.0`, `runtimeVersion.policy = appVersion` | `app.json` |
| Architectuur | New Architecture AAN (`newArchEnabled=true` in gegenereerde `android/gradle.properties`; SDK 55 default). `OPERATOR_HANDOVER.md` §9.1 zegt "false" — verouderd. | — |

### D5.2 EAS-profielen (`eas.json`, CLI ≥ 19.0.8)
- `cli.appVersionSource: "remote"` → buildnummers (iOS buildNumber, Android versionCode) leven op de Expo-server; `production.autoIncrement: true` verhoogt ze per build. **Nooit buildnummers uit het geheugen halen** — kijk op expo.dev of in `docs/WERKSTATUS.md`.
- Profielen: `development` (dev-client, internal, kanaal development) · `simulator` (iOS-simulator) · `preview` (internal, Android APK, kanaal preview) · **`production`** (autoIncrement, kanaal production, iOS `m-medium`, Android `app-bundle`, `SENTRY_DISABLE_AUTO_UPLOAD=true`) · `e2e-test` (simulator/APK zonder credentials, voor Maestro in de cloud).
- `submit.production.android`: `serviceAccountKeyPath ./secrets/google-play-service-account.json`, track `internal`, `releaseStatus draft`. **Werkt in de praktijk niet**: het dienstaccount heeft geen release-rechten (sinds build 105) → Android altijd handmatig uploaden.
- `.easignore`: alle mappen met leidende `/` (anders vielen `modules/*/ios|android` weg uit de build — 19 okt 2026). Nooit een `ios/`- of `android/`-regel zonder `/` toevoegen.

### D5.3 Kosten en discipline
- EAS-plan: **Starter** (vermeld in `WERKSTATUS.md`). Een build kost echt geld (iOS ~$2, Android ~$1; ook een geannuleerde). Historiek: 19 okt 2026 al $39 van $45.
- Regels (geheugen `feedback-build-budget-discipline.md`, `feedback-batch-fixes-before-build.md`, `feedback-no-wasted-builds.md`, `feedback-operator-not-tester.md`, `feedback-verify-before-handover.md`):
  1. Eerst ALLES verzamelen (operatorfeedback + audit + iOS/Android-pariteit), fixen, `tsc` + `jest` groen, Kotlin compileren, Swift laten nakijken.
  2. Zelf alle gewijzigde flows × gebruikerstypes op de A16 doorlopen.
  3. Dan één build per platform. Niet annuleren voor iets dat kan wachten. Geen build met bekende open fouten.
  4. Betaalde diensten (ook Firebase Test Lab boven gratis tegoed) enkel na expliciet "ja" van de operator.
- **Geen OTA naar productie**: `expo-updates` staat aan (`updates.url` in `app.json`). `eas update --channel production` raakt meteen elke live gebruiker zonder store-review → NOOIT zonder expliciete operator-goedkeuring. Voor tests enkel `development`/`preview`.

### D5.4 iOS (iPhone + Apple Watch + Live Activity in één build)
```bash
npx eas-cli build -p ios --profile production --auto-submit
```
- Builds gaan automatisch naar **TestFlight** (submit-profiel production). Bij een mislukte submit: `npx eas-cli submit -p ios --id <build-id>` of `--latest`.
- Credentials (certificaten, provisioning voor 3 targets) beheert EAS (`eas credentials --platform ios`).
- Windows: geen Xcode → Swift-fouten zie je pas in de EAS-log. Laat Swift vooraf door een agent nalezen.
- Vóór een store-build optioneel de Maestro-flows op een iPhone-simulator in de cloud (kost tegoed): `npx eas-cli workflow:run .eas/workflows/e2e-ios.yml`.
- Indienen: App Store Connect (teksten `docs/APPSTORE_TEKSTEN_2026-11-01.md`, `docs/store/APPSTORE_BESCHRIJVING_2026-11-02.txt`, afwijzingspunten in `WERKSTATUS.md` §4). Stand 3 nov: iOS 1.0 (build 89) + abonnementen + dagpas "Waiting for Review" sinds 2 nov 23:12.

### D5.5 Android telefoon
```bash
npx eas-cli build -p android --profile production
```
- AAB downloaden (link in de EAS-buildpagina of `eas build:list`) naar **`release-android/vibezcore-<versionCode>.aab`** (map niet in git; staan er nu o.a. 112 en 113).
- Operator uploadt handmatig: Play Console › Testen › Interne tests (Telefoons) › Release bewerken › AAB slepen. Vorige test-AAB vervalt.
- Release notes: **enkel en-US** (andere talen zijn verwijderd uit de Play-vermelding; operator-instructie).
- Productie: Play Productie laatst gepubliceerd 20 juli 2026; 113 + Wear 26110314 gaan pas naar productie na goedkeuring van de FGS-verklaring (3 nov 2026 verstuurd). Uitrol in stappen 5 % → 20 % → 100 % (`docs/TESTEN.md` § Uitrol), Sentry in het oog.

### D5.6 Wear OS-bundel (lokaal, niet via EAS)
1. Bron synchroniseren (D1.1): `diff -rq wear-app/src android/wear/src` → zo nodig `cp -r wear-app/src/. android/wear/src/`.
2. `credentials.json` + `credentials/android/keystore.jks` aanwezig (of `wear-app/keystore.properties` + `wear-app/upload.jks`).
3. Bouwen (in `android/`, Git Bash): `./gradlew :wear:bundleRelease` (optioneel `-PwearVersionCode=26110314`).
   Uitvoer: `android/wear/build/outputs/bundle/release/wear-release.aab` → kopiëren naar `release-android/wear-release-<datum>-<versionCode>.aab`.
4. Controleren vóór overhandigen: handtekening = upload-sleutel (`keytool -printcert -jarfile …` → SHA1 `91:BD:78…`), dex-strings van nieuwe code, manifest via `aapt2 dump xmltree`.
5. Eerst een debug-build van dezelfde bron op het horloge testen (`./gradlew :wear:installDebug -PwearVersionCode=1`, telefoon met dezelfde debug-handtekening).
6. Upload: Play Console › zelfde app › **Wear OS**-track (Form factor Wear OS is eenmalig toegevoegd) › nieuwe release. Google beoordeelt Wear apart.
- Losse oude `wear-release*.aab` en `vibezcore-android-99.aab` in de projectroot zijn restanten; de echte bundels staan in `release-android/`.

### D5.7 Lokale builds en dev-client
- Native module toegevoegd/gewijzigd → nieuwe dev build (`npx expo run:android`, of EAS `development`-profiel). JS-wijzigingen → Metro.
- `react-native.config.js` sluit `react-native-iap` (+ nitro-modules) uit van autolinking voor lokale builds; lokaal draait `MockIAPProvider` (`USE_MOCK_IAP = __DEV__`). Echte aankopen enkel testbaar in een store-build.
- **patch-package** (`postinstall`): `patches/expo-audio+55.0.14.patch` (mediasessie krijgt titel/hoes → scherpe artwork op vergrendelscherm), `patches/react-native+0.83.6.patch` (Inter als standaardfont in `Text`), `patches/react-native-worklets+0.7.4.patch` (iOS: `WorkletsMessageThread.h` privé-header, anders faalt de iOS-build met Expo's voorgebouwde React).
  `package.json` → `expo.autolinking.android.buildFromSource: ["expo-audio"]` — **nodig**, anders gebruikt Gradle de voorgecompileerde expo-audio zonder patch.
- Test-APK naast de echte app (pakket `com.ubili.vibezcoreapp.test`, naam "VZ TEST", testschakelaar `/test-tier?tier=free|day|monthly|yearly|off`): `bash scripts/build-test-apk.sh` → `scratchpad/vz-test.apk` (zet `EXPO_PUBLIC_VZ_TEST=1`; herstelt gradle-bestanden na afloop).
- Metro: `npx expo start --dev-client --port 8081`. Koude Hermes-bundel duurt ~85 s > time-out dev-client → eerst opwarmen:
  `curl -s -o NUL "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false"`. Na `npm install` Metro herstarten. Na Reanimated-wijzigingen: `adb shell am force-stop com.ubili.vibezcoreapp` + herstart. `metro.config.js` blokkeert Gradle-buildmappen (EMFILE op Windows).
- Emulator (indien nodig): Pixel_8 met `-gpu swiftshader_indirect`; maar voorkeur = echt toestel (geheugen `feedback-no-emulator-previews.md`).

### D5.8 Toestellen
- **Galaxy A16** (telefoon, operator): draadloze ADB. Koppelen: `adb pair <ip>:<koppelpoort> <6-cijfercode>` (scherm "koppelen via code"); verbinden: `adb connect <ip>:<connectpoort>` (hoofdscherm Draadloze foutopsporing — andere poort!). IP meestal `192.168.0.223`; poorten/code wijzigen elke keer. adb: `C:/Users/ulgar/AppData/Local/Android/Sdk/platform-tools/adb.exe`. Draadloze ADB valt weg bij scherm uit.
- **Galaxy Watch4** (Wear OS): idem draadloze foutopsporing op het horloge; koppelen gaf op 2 nov herhaaldelijk "protocol fault" — opnieuw proberen / via Wi-Fi-debugging van het horloge.
- Na elke testinstallatie op de A16: `adb shell pm clear com.ubili.vibezcoreapp` + `adb logcat -c` + starten (intro controleren), tenzij de operator gegevens wil houden. Nooit force-stop/reinstall tijdens een lopende sessie van de operator.
- **Schermopname**: `scrcpy` draadloos (gebruikt voor de Play FGS-video, `--record`); voor het horloge filmt de operator met een tweede toestel.
- iPhone/Apple Watch: enkel via TestFlight (geen lokale toolchain).

---

## D6. Testen

| Laag | Commando / plaats | Wanneer |
|---|---|---|
| Typecheck | `npx tsc --noEmit -p .` (moet leeg zijn) | elke wijziging |
| Logica-tests | `npx jest` — `__tests__/` (jest-expo, setup `__tests__/setup.ts`); ±526 tests | elke wijziging |
| Lint | `npx eslint src --quiet` (37 bestaande fouten, geen nieuwe toevoegen) | optioneel |
| CI | `.github/workflows/ci.yml`: Node 22, `npm ci`, maakt `expo-env.d.ts`, `tsc`, `jest --ci` op push naar `rollback-vc76-take2`/`main` en PR's | automatisch; rood = niet bouwen |
| Flowtests | Maestro `.maestro/01…07*.yaml` (+ hulpflows `_start-guest`, `_dismiss-cards`), `bash scripts/device-matrix.sh` op emulator-profielen pixel8/small/tall/bigfont/lightmode → `test-results/<datum>/<profiel>/` | vóór een store-build |
| iPhone-flows | `.eas/workflows/e2e-ios.yml` (kost tegoed) | vóór iOS-store-build |
| Echte toestellen | Firebase Test Lab `bash scripts/testlab.sh` (project vibezcore1, gratis tegoed; betaald enkel met "ja") | per Android-build |
| Mens | A16 + Watch4 (operator), TestFlight | gevoel: trilling = beeld, horloge = telefoon, geluid |

Testmappen: `__tests__/rhythm/` (hartslagcurve, modustabel CLAUDE.md §5, ademtechnieken, duur per ervaring), `__tests__/access/` (free/Premium/dagpas, voorproef, onboarding, product-id's), `__tests__/content/` (VIBEZCORE in hoofdletters, verboden claims, geen "silver", Early 2027, pijlers, modusnamen, geen punt op koppen) + losse tests (cloud-sync, auth-retry, plan-times, sound-timing, subscription-tier, watch-catalog-free…). Faalt een test → code fixen, niet de test; faalt een teksttest → operator beslist.

**TEST_LOG-conventies** (`docs/TEST_LOG.md`): elke test meteen loggen met nummer `T<n>` (nu tot ±T359), wat, toestel, resultaat, bewijs/commit. Legenda ✅ ❌ ⚠️ ⏳; **🔒 = goedgekeurd en vergrendeld** — niet meer wijzigen; raakt een wijziging zo'n flow, eerst zelf hertesten (na force-stop, niet na Fast Refresh). Na elke bouwronde volledige hertest. Meer: `docs/TESTEN.md`, `docs/KWALITEITSPROCEDURE.md`, `docs/KWALITEITSPROTOCOL.md`.

Toesteltest-regels (geheugen): elk scherm als 5 klanttypes doorlopen; responsief via formules, nooit afstemmen op de toestellen van de operator; testmatrix incl. 3-knopsnavigatie; melden pas na screenshot; na een edit volstaat typecheck + kort melden (operator verifieert zelf op toestel).

---

## D7. Beheer

### D7.1 Repo en branches
- GitHub `ulgarbilican-dotcom/vibezcore-app`, remote `origin`. **Werkbranch `rollback-vc76-take2`** — alles hier committen én pushen na elke afgeronde wijziging, `docs/WERKSTATUS.md` in dezelfde commit bijwerken.
- `main` = default op GitHub, loopt achter. Lokaal `master` = oud. `claude/*`, `worktree-agent-*`, `backup-*`, `fabric-bisect`, `fix/*` = oude hulpbranches, negeren.
- Backend: `ulgarbilican-dotcom/vibezcore-backend` — NOOIT wijzigen vanuit dit project (CLAUDE.md §1).
- Commits: Engelse onderwerpregel; attributieregel per sessie-instructie. Nooit `git add -A docs` (untracked operatorbestanden zoals `docs/VIBEZCORE_STRATEGY.html`, `docs/website-content/` zijn al twee keer per ongeluk gepusht). Nooit `npm audit fix --force`.

### D7.2 Automatische back-up (Stop-hook)
- `.claude/settings.local.json` → `hooks.Stop` → `bash "$CLAUDE_PROJECT_DIR/scripts/backup-to-onedrive.sh"` (async, 120 s).
- Het script: (1) pusht lokale commits die nog niet op origin staan (commit zelf nooit); (2) kopieert naar `C:\Users\ulgar\OneDrive\Documenten\VIBEZCORE-archief\`:
  `claude-geheugen/` (Claude-geheugen), `prive-docs/` (`docs/OPERATOR_HANDOVER.md`, `docs/VIBEZCORE_STRATEGY.html`, `docs/handover-word/*.docx`), `env/` (`.env.bunny`, `.env.test`), `env/secrets/` (`secrets/*`).
- Kopieert NIET: `credentials.json`, `credentials/`, `wear-app/upload.jks`/`keystore.properties`. Die (en de Google Cloud-sleutel) staan in **`OneDrive\Documenten\VIBEZCORE-secrets\`** — de operator houdt die map handmatig bij. Controleer bij overdracht dat ze daar compleet zijn.
- Verder in het archief: `broncode/VIBEZCORE-broncode-<datum>.zip`, `project-niet-in-git/website-content`, `uit-Downloads/` (oude huisstijl/science-HTML's).

### D7.3 Claude-geheugen
- `C:\Users\ulgar\.claude\projects\C--Users-ulgar-vibezcore-app\memory\` met index `MEMORY.md` (± 100 regels, één link per feit) + losse `*.md`-bestanden (type user/feedback/project/reference). Back-up in `VIBEZCORE-archief\claude-geheugen\`.
- Volgorde voor een nieuwe sessie: `CLAUDE.md` → `docs/WERKSTATUS.md` → `git log -20` → `docs/TEST_LOG.md` → `MEMORY.md`.

### D7.4 Docs-index (`docs/`)
| Document | Inhoud |
|---|---|
| `WERKSTATUS.md` | Levend: waar staat het werk NU, bouwronde, wacht-op-operator, to do, dev-tips |
| `VIBEZCORE_APP_VOLLEDIGE_SPEC.md` | Volledige app-specificatie |
| `APP_ARCHITECTUUR_VOLLEDIG.md` | Architectuuroverzicht (1 057 r.) |
| `VIBEZCORE_BLUEPRINT.md` | Oude blueprint — enkel nog structuur, inhoud verouderd |
| `MERK_ANKER.md` | Font, kleuren, logo (bindend, uiterlijk) |
| `HUISSTIJL_STYLESHEET_WEB.md` | Huisstijl web + app, dark-only |
| `UI_EN_BEWEGINGSREGELS.md` | Knoppen, koppen, intro's, beweging, horloge-icoon (bindend) |
| `STRUCTUUR_en_BLE_contract_v2.md` | App-structuur + BLE-contract (spec v2.3), GATT-voorstel |
| `WATCH_PROTOCOL.md` | Protocol telefoon ↔ horloges (handdruk/klok nog toe te voegen) |
| `WEAR_RELEASE.md` | Wear-app bouwen, ondertekenen, uploaden |
| `HAPTIC_RESEARCH_BASIS.md` | Haptiek-onderzoek en -specificatie |
| `VIBEZCORE_SCIENCE_A_TOT_Z.md` | Alle wetenschap/logica (tempo's, duur, bronnen) — mee aanpassen bij elke wijziging |
| `ONTWERP_toegangsmodel.md` | Entitlements, activatiecode, provider-abstractie (6 open beslissingen) |
| `ONTWERP_sessieduur.md` | Sessieduur per ademsessie |
| `BACKEND_IAP_SPEC.md` | Backend-spec voor in-app-aankopen |
| `FLOWS_BREATH.md` / `FLOWS_STATECONTROL.md` | Alle flows Free + Premium |
| `USER_FLOWS_FREE_EN_BRACELET_PRO.md` | User flows Free & Bracelet PRO |
| `TESTEN.md` | Testlagen 1–4 + uitrol |
| `TEST_LOG.md` | Testlogboek T-nummers, 🔒-regel |
| `KWALITEITSPROCEDURE.md` / `KWALITEITSPROTOCOL.md` | Wat moet vóór iets "klaar" heet |
| `CONTROLELIJST_OPERATOR.md` | Controlelijst A–Z voor de operator (21 okt) |
| `STORE_LAUNCH_CHECKLIST.md` / `LAUNCH_BLUEPRINT.md` | Lanceringschecklist / -blauwdruk |
| `APP_STORE_INDIENEN_19OKT.md`, `APPSTORE_TEKSTEN_2026-11-01.md`, `store/APPSTORE_BESCHRIJVING_2026-11-02.txt` | App Store-indiening en -teksten |
| `PLAY_STORE_TEKSTEN.md`, `store/play-listing-en.txt` | Play-vermelding |
| `store/PLAY_FGS_VERKLARING_2026-11-02.md` | Play-verklaring voorgrondservices (verstuurd 3 nov) |
| `PRIVACY_FORMULIEREN_BACKUP_SYNC.md` | Privacyformulieren na Backup & Sync |
| `IOS_TESTRONDE_BUILD20/61/68.md` | Bevindingen per iOS-testronde |
| `AUDIT_2026-10-12.md`, `BEVINDINGEN.md`, `RESPONSIVE_AUDIT.md` | Audits |
| `OPERATOR_BESLISSINGEN_2026-05-27.md` | Operator-beslissingen pre-launch |
| `COPY_VOORSTEL_bracelet_about_2026-10-14.md`, `DARK_MODE_COPY.md` | Copyvoorstellen (niet finaal) |
| `backend/` | SQL-migraties (`user-data-migration.sql`, `bracelet-sessions-migration.sql`) + voorbeeld-API's — door operator in Supabase/backend te zetten |
| `email-templates/` | Supabase-mails (bevestigen, wachtwoord-reset) |
| `website-pages/` | HTML/tekst voor de Wix-site (privacy, support, delete-account, subscribe, legal) |
| `OPERATOR_HANDOVER.md` | **PRIVÉ, niet in git** — accounts, services, kosten (§10–13); deels verouderd (mist RevenueCat, Sentry, EAS-plan) |
| `VIBEZCORE_STRATEGY.html`, `handover-word/*.docx` | Privé / gegenereerd, niet committen |

Buiten `docs/`: `CLAUDE.md` (harde regels), `AGENTS.md`, `README.md`, `FONT_AUDIT.md`/`FONT_SPECS.md`.

### D7.5 Secrets-inventaris (enkel naam, plaats, doel)
| Item | Plaats | Doel | In git? |
|---|---|---|---|
| `.env.bunny` | projectroot | Bunny Storage/API-variabelen (`BUNNY_STORAGE_ZONE`, `…_PASSWORD`, `…_HOSTNAME`, `BUNNY_PULL_ZONE_ID`, `BUNNY_API_KEY`) voor audio-uploads | Nee |
| `.env.test` | projectroot | `VZ_TEST_EMAIL`, `VZ_TEST_PASSWORD` — testaccount voor flowtests/`scripts/test-pro-auth.ps1` | Nee |
| `secrets/google-play-service-account.json` | projectroot | Dienstaccount voor `eas submit` Android (heeft geen release-rechten) | Nee |
| `credentials.json` + `credentials/android/keystore.jks` | projectroot | Android upload-sleutel (download van EAS) — voor de Wear-bundel | Nee |
| `wear-app/upload.jks`, `android/wear/upload.jks` (+ evt. `wear-app/keystore.properties`) | wear-app | Zelfde upload-sleutel, alternatieve route | Nee (`*.jks` ignored) |
| EAS-credentials (Android keystore, iOS certificaten/profielen) | Expo-server (`eas credentials`) | Signing van store-builds | n.v.t. |
| `vibezcore1-…json` | `OneDrive\Documenten\VIBEZCORE-secrets\` | Google Cloud-sleutel (project vibezcore1) | Nee |
| `docs/OPERATOR_HANDOVER.md` | docs | Accounts/toegang | Nee |
| Publieke client-sleutels (Supabase publishable key/URL `src/constants/supabase.ts`, RevenueCat SDK-keys `app.json` → `extra`, Google OAuth client-ID's, Sentry DSN `src/services/crash-reporting.ts`) | in code | Bewust publiek (RLS/scoped) | Ja |
| `android/app/debug.keystore` | gegenereerd | Debug-handtekening telefoon + horloge (moet gelijk zijn) | Nee |

Kopieën: `OneDrive\Documenten\VIBEZCORE-archief\env\` (automatisch) en `OneDrive\Documenten\VIBEZCORE-secrets\` (handmatig).

### D7.6 Betaalde diensten
Volledig overzicht en bedragen: `docs/OPERATOR_HANDOVER.md` §10–13 (privé). Aanvullend, daar nog niet vermeld: **Expo EAS Starter** (buildtegoed), **RevenueCat** (aankopen iOS/Android), **Sentry** (crashrapporten, enkel fouten, geen PII), **Apple Developer** ($99/jaar), **Google Play** (eenmalig), Firebase (Spark/gratis, Test Lab). Bunny, Supabase, Netlify, Wix, Zoho, Cloudflare: zie handover. Regel: nooit een betaalde dienst/optie starten zonder expliciet "ja".

### D7.7 Noodherstel — app opnieuw opbouwen vanaf nul (Windows)
1. **Tools**: Git, Node 22 (zoals CI), Android Studio (SDK + JBR 17), `npm i -g eas-cli` (≥ 19.0.8), optioneel scrcpy, Maestro (`%LOCALAPPDATA%\maestro`).
2. `git clone https://github.com/ulgarbilican-dotcom/vibezcore-app.git` → `git checkout rollback-vc76-take2`.
3. `npm ci` (draait `patch-package` automatisch; controleer "Applying patches… expo-audio, react-native, react-native-worklets").
4. Secrets terugzetten uit `OneDrive\Documenten\VIBEZCORE-archief\env\` en `…\VIBEZCORE-secrets\`: `.env.bunny`, `.env.test`, `secrets/google-play-service-account.json`; Android-sleutel via `npx eas-cli credentials` (Android → production → Download credentials → `credentials.json` + `credentials/android/keystore.jks`). Privé-docs uit `prive-docs\`.
5. `npx eas-cli login` (Expo-account eigenaar `ubili`); controleer `eas project:info`.
6. `npx expo prebuild -p android` → maakt `android/`, kopieert `wear-app` → `android/wear` (plugin), past andere plugins toe. `ios/` niet lokaal (Windows) — EAS doet dat.
7. Dev build: `npx expo run:android` (op de A16 via draadloze ADB), daarna `npx expo start --dev-client` + bundel opwarmen.
8. Controle: `npx tsc --noEmit -p .`, `npx jest`.
9. Store-builds via EAS (D5.4–D5.6). Claude-geheugen terugzetten naar `C:\Users\ulgar\.claude\projects\C--Users-ulgar-vibezcore-app\memory\` uit `VIBEZCORE-archief\claude-geheugen\`.
10. Als GitHub weg is: `VIBEZCORE-archief\broncode\VIBEZCORE-broncode-<datum>.zip` (laatst 3 nov 2026).
11. Externe consoles (niet in repo, wel nodig): Expo, App Store Connect, Play Console, RevenueCat, Supabase, Bunny, Sentry, Netlify, Wix, Google Cloud (vibezcore1). Toegang: zie `OPERATOR_HANDOVER.md`.

### D7.8 Eerste dag voor een nieuwe ontwikkelaar
- [ ] Lees `CLAUDE.md` (harde regels: VIBEZCORE in hoofdletters, geen claims, `[OPERATOR]`/`[TEKST]` nooit invullen, backend/webapp niet wijzigen, geen `npm audit fix --force`, niets groots zonder goedkeuring).
- [ ] Lees `docs/WERKSTATUS.md` (§3 bovenste regels, §4 wacht-op-operator), `git log -20`, laatste ±40 regels van `docs/TEST_LOG.md`.
- [ ] Lees `docs/UI_EN_BEWEGINGSREGELS.md`, `docs/MERK_ANKER.md`, `docs/WATCH_PROTOCOL.md`, `docs/VIBEZCORE_SCIENCE_A_TOT_Z.md` (bij ritme/duur-werk).
- [ ] Toegang krijgen: GitHub, Expo (`ubili`), App Store Connect/TestFlight, Play Console, RevenueCat, Supabase, Sentry; OneDrive-secrets via de operator.
- [ ] Omgeving opzetten (D7.7 stap 1–8); `tsc` en `jest` groen.
- [ ] A16 koppelen met draadloze ADB, dev build installeren, `pm clear`, app doorlopen als gast, Free en Premium (QA-/test-tier-schakelaar via VZ TEST-APK).
- [ ] Galaxy Watch4: horloge-app debug installeren met dezelfde debug-handtekening; een State Control- en Breathwork-sessie vanaf telefoon én vanaf het horloge.
- [ ] Begrijp de kopie-valkuil `wear-app` → `android/wear` en de build-budgetregels (geen build zonder volledige ronde, geen OTA naar production).
- [ ] Werkritme: wijziging → `tsc` + `jest` → TEST_LOG-regel → WERKSTATUS bijwerken → commit + push op `rollback-vc76-take2` (Stop-hook pusht ook).
- [ ] Bij twijfel over scope, teksten of iets onomkeerbaars: de operator vragen (Nederlands, één concrete aanbeveling i.p.v. opties).

### D7.9 Bekende open punten in dit domein (3 nov 2026)
- Apple Watch: discrete Always-On-dimstand zoals Galaxy Watch nog te bouwen (iOS 1.0.1).
- `docs/WATCH_PROTOCOL.md` aanvullen met PREPARE/READY/GO, klokmeting, catalogus, breath-ack.
- Bracelet: `RealBracelet` + `react-native-ble-plx`, GATT-UUID's, firmware-bron terugvinden/herbouwen, `bracelet-control.tsx` naar echte PAUSE/RESUME-opcodes (pas na hardware-validatie).
- Play: FGS-verklaring in beoordeling → daarna 113 + Wear 26110314 naar productie.
- `OPERATOR_HANDOVER.md` §9 en §12–13 bijwerken (EAS bestaat, New Architecture aan, RevenueCat/Sentry/EAS-kosten).
- Play-dienstaccount heeft geen release-rechten (handmatig uploaden blijft nodig tot de operator dat aanpast).

---

## Deel E — Documenten en bestanden buiten de code (OneDrive)

> Bron: `C:\Users\ulgar\OneDrive\Bureaublad\Vibezcore native app` (1.048 bestanden, doorgelopen op 3 november 2026).
> Vergeleken met `docs/WERKSTATUS.md` (bijgewerkt 1–3 nov 2026), `CLAUDE.md` en het projectgeheugen.
> Er zijn geen bestanden gewijzigd, verplaatst of verwijderd.
> **Geheimen staan hier niet in.** Wachtwoorden, sleutels, promocodes en e-mailadressen van testers staan enkel in de tabel "Geheimen en gevoelige bestanden" (§E.9), met verwijzing naar het bestand en zonder de waarde.

Gebruikte labels:
- **ACTUEEL**: klopt met de huidige app en werkwijze.
- **DEELS**: de structuur klopt nog, maar sommige cijfers of namen zijn achterhaald.
- **VEROUDERD**: vervangen. Enkel bewaren als archief.
- **BRON**: ruw materiaal (opnames, teksten, beelden). De live kopie staat elders, meestal op Bunny CDN.

---

### E.0 In één oogopslag

| Map / bestand | Wat | Datum | Status |
|---|---|---|---|
| `Vibezcore alle info pc defect of verloren\` | Drie herstel-documenten en een wachtwoordnotitie | 13 mei / 9 okt 2026 | ACTUEEL als procedure, DEELS qua productcijfers |
| `VIBEZCORE Apple Sign in sleutel\` | Apple-sleutels (.p8) in Word | 18 okt 2026 | ACTUEEL, **geheim** |
| `Google-play-service-account.json Belangrijk\` + `vibezcore-gcp-revenuecat-service-account..json` | Google Cloud service-account sleutels | 20/26 jun 2026 | ACTUEEL, **geheim** |
| `.env.bunny`, `.env.test` | Reservekopie van de omgevingsbestanden van het project | 9 okt 2026 | ACTUEEL, **geheim** |
| `App productie services.docx` | Oud overzicht van de diensten en kosten | 2 jun 2026 | VEROUDERD, bevat ook **geheimen** |
| `VIBEZCORE Google OAuth (2026-06-24).docx` | Google OAuth-webclient | 24 jun 2026 | Waarschijnlijk ACTUEEL, **geheim** |
| `VIBEZCORE app_Blueprint.docx` | Technische blauwdruk uit juni (19 delen + bijlagen) | 3–26 jun 2026 | VEROUDERD (enkele delen nog bruikbaar) |
| `app bouwregels.docx` | Kwaliteits- en testaanpak in 5 stappen | 20 okt 2026 | ACTUEEL (richtlijn) |
| `VIBEZCORE Haptic System 04-10-2026.docx` | Wetenschappelijke haptiek-spec v1.0 | 4 okt 2026 | DEELS (claimregels gelden nog, de frequenties zijn vervangen) |
| `VIBEZCORE — Voelbare preview … 04-10-2026.docx` | Code-snapshot van de telefoon-preview van de bracelet | 4 okt 2026 | VEROUDERD |
| `Firmware flash-hardware te bestellen.docx` | Bestellijst voor flash- en soldeergerief | 7 jul 2026 | DEELS (de softwarelijst is achterhaald) |
| `Vibezcore_Firmware_v1.0.zip` | Firmware v1.0 (nRF5 SDK) + Haptic Bracelet Spec v2.3 en v2.4 | 2 jul 2026 | VEROUDERD als firmware. Spec v2.3 §8 blijft het BLE-contract |
| `bracelet new corract.png` | Productfoto van de bracelet aan de pols | — | ACTUEEL (marketingbeeld) |
| `privacy-policy-website-updated.html` / `-MEET-HOOGTE.html` | Privacyverklaring voor de website (Wix-embed) | 28 okt 2026 | DEELS (de Health-zin van 2 nov ontbreekt mogelijk) |
| `promotion_codes MONTHLY.csv` / `YEARLY.csv` | 2 × 52 promotiecodes | 27 jun 2026 | Onzeker, **geheim** |
| `Beta Testers Emails List(updated).csv` | 20 e-mailadressen van testers | 25 jun 2026 | Enkel voor de testtrack, **persoonsgegevens** |
| `Horloge-app 27 okt (voor Play Console)\` | Wear OS `.aab` + mockup van het horloge-icoon | 27 okt 2026 | VEROUDERD (nieuwere Wear-build 26110314) |
| `App store images\`, `Play telefoon-screenshots 30 okt 2026\`, `Vibezcore fotos appstores\`, `Play feature graphic …png` | Store-beelden | 30 okt – 3 nov 2026 | ACTUEEL (laatste set) |
| `VIBEZCORE_REEKSEN_PER_PIJLER .md` | Audioreeksen per pijler, v8 | 13 jun 2026 | DEELS |
| `VIBEZCORE_Audio_Writing_Handbook_v13_1.md` | Schrijfhandboek voor de audiosessies | 1 jul 2026 | ACTUEEL (redactionele bron) |
| `Vibezcore Audio new 4 Pillars\` | Sessieteksten (.md) + 86 nieuwe opnames | mei–jul 2026 | BRON |
| `Vibezcore Podcasts PodcastleAI - onbekend album\` | 59 oudere sessies + 19 theta/delta-tracks | mrt–mei 2026 | BRON (een deel staat nog live in de app) |
| `Vibezcore Audio breathwork\` | Stemopnames voor ademsessies (Kylie, Marius) | — | BRON |
| `Vibezcore Muziek podcasts\` | Achtergrondmuziek | — | BRON |
| `Vibezcore short audio social media\` | Social-media shorts: plan, scripts, audio, video | jul–aug 2026 | DEELS |
| `vibezcore-images\` | Beeldbank van ongeveer 300 beelden | mei–nov 2026 | BRON |
| `VIBEZCORE project (code) - snelkoppeling.lnk` | Snelkoppeling naar de projectmap | 27 okt 2026 | Niet relevant |

---

### E.1 Herstel bij verlies of defect van de pc ("Vibezcore alle info pc defect of verloren")

Drie Word-documenten van **9 oktober 2026**. Volgens het A-tot-Z-document staan ze ook online als artifact op claude.ai/code/artifacts (account van de operator) en in `OneDrive\Documenten\VIBEZCORE-archief\word`.

#### E.1.1 `VIBEZCORE-A-tot-Z.docx wanneer pc niet werkt.docx`: DEELS
**Waar staat wat** (nog geldig):

| Wat | Waar |
|---|---|
| App-code, CLAUDE.md, docs, testlog | GitHub `ulgarbilican-dotcom/vibezcore-app`, branch `rollback-vc76-take2` |
| Backend (Netlify-functies) | GitHub `ulgarbilican-dotcom/vibezcore-backend` |
| Sleutels, Apple .p8, Google Play-sleutel, productie-overzicht, testerslijst | `OneDrive\Bureaublad\Vibezcore native app` (deze map) |
| .env en secrets | `OneDrive\Documenten\VIBEZCORE-archief\env` |
| Privé-docs (OPERATOR_HANDOVER.md, strategie, Word-handovers) | `OneDrive\Documenten\VIBEZCORE-archief\prive-docs` |
| Claude-geheugen | `OneDrive\Documenten\VIBEZCORE-archief\claude-geheugen` |
| Website-widgets en concepten | `OneDrive\Documenten\VIBEZCORE-archief\uit-Downloads …` |
| Bracelet-hardware (PCB, schema, fabricage, firmware-zip) | `OneDrive\Bureaublad\pcb alle documenten` |
| Beelden | OneDrive-mappen `vibezcore-images`, `foto s website`, `bunny-upload` |

**Accounts en identificatoren** (geen geheimen):
- GitHub: gebruiker `ulgarbilican-dotcom`.
- Expo/EAS: eigenaar `ubili`.
- Play Console: `com.ubili.vibezcoreapp`.
- App Store Connect: app 6791124857, team 88AL3UW7L7. Apple Developer is een Individual-account.
- RevenueCat: project `565f1dce`.
- Supabase: project `zotxpyjvcamnlzwdgceh`.
- Netlify: site `vibezcore-backend`.
- Bunny: zone `vibezcore-audio`.
- Verder: Wix (website + domein), Cloudflare (DNS), Zoho Mail, Google Cloud (service-account), Microsoft (OneDrive), **Wise** (uitbetalingen van Apple) en Claude (account van de operator).

**Release-procedure**: dezelfde als in CLAUDE.md en WERKSTATUS. Builds via `eas build`/`eas submit`. De operator promoveert de release zelf in Play Console en App Store Connect. Nooit `eas update` naar het production-kanaal.

**VEROUDERD in dit document:**
- Prijzen "maand €14,99, eerste jaar €9,99/mnd; jaar €89,99, eerste jaar €69,99" en "Proef 7 dagen: 27 sessies + Breathwork + State Control". **Nu geldt**: dagpas €1,29 (24 u), maand €9,99, jaar €69,99, geen proefperiode, 10 gratis audiosessies (16 okt 2026).
- State Control-minima 8/15/15/20/30 min. **Nu geldt**: minimum 5 min (Boost, Sharp Focus, Calm Control) en 10 min (Clarity & Relax, Sleep) sinds 11 okt 2026. Aanbevolen duur en maximum zijn ongewijzigd.
- "Smart Bead Bracelet: Launching Fall 2026". **Nu geldt**: "Launching Early 2027" (10 okt 2026).

#### E.1.2 `VIBEZCORE-Noodplan-pc-kwijt (1).docx`: ACTUEEL (procedure)
- **Eenmalig te doen:**
  - OneDrive-back-up van Bureaublad, Documenten en Afbeeldingen. Staat aan sinds 9 okt.
  - Wachtwoordbeheerder op de telefoon (Bitwarden of 1Password).
  - 2FA via een authenticator-app op de telefoon.
  - Herstelcodes van Google, Apple en GitHub op papier.
  - "Mijn apparaat zoeken" en BitLocker aanzetten.
  - Controleren dat de GitHub-repo **Private** is.
- **Bij diefstal, in deze volgorde:**
  1. De pc vergrendelen of wissen via account.microsoft.com/devices.
  2. Wachtwoorden wijzigen: Google → Apple ID → GitHub → Microsoft → de rest.
  3. Overal afmelden.
  4. Sleutels intrekken en vervangen: GitHub-tokens, Expo-tokens, de Apple In-App Purchase-sleutel (.p8, daarna opnieuw uploaden in RevenueCat) en de Google Play service-account (daarna in RevenueCat en Expo), plus eventueel de Supabase service-sleutel.
  5. In ASC, Play Console en RevenueCat nagaan of er onbekende builds of prijswijzigingen zijn.
- **Nieuwe pc**: Git, Node 24, Android Studio en de Claude-app installeren, OneDrive koppelen, het project ophalen (`npm install`, nooit `audit fix --force`) en de bestanden uit het VIBEZCORE-archief terugzetten.
- **Routine**: elke vrijdag de OneDrive-sync en de laatste GitHub-commit controleren. Elk kwartaal dit document nalopen.
- ⚠️ **Tegenstrijdigheid**: het noodplan zegt dat de Zephyr-firmware (v3, NCS) in `Downloads\vibezcore-firmware-v3-ncs` stond en **"weg" is**. Het geheugen (`project-firmware-v3-zephyr.md`) noemt die map nog als locatie. Controleer dit. De enige zekere kopie is `pcb alle documenten\vibezcore-firmware-correct.zip` (13 jul 2026).

#### E.1.3 `VIBEZCORE-Overdracht-Claude-Code (1).docx`: ACTUEEL
- Een kant-en-klare opdracht om in Claude Code op een nieuwe pc te plakken.
- Ze beschrijft winget-installaties, ANDROID_HOME en JAVA_HOME, de clone van branch `rollback-vc76-take2` en het terugzetten van bestanden:
  - `.env.bunny` en `.env.test` → de projectmap;
  - `google-play-service-account.json` → `secrets\`;
  - OPERATOR_HANDOVER.md en VIBEZCORE_STRATEGY.html → `docs\`;
  - het geheugen → `~\.claude\projects\C--Users-ulgar-vibezcore-app\memory\`.
- Verder: de Stop-hook (`scripts/backup-to-onedrive.sh`) opnieuw instellen, `eas login` (doet de operator zelf), draadloze ADB naar de Galaxy A16 en de Metro-bundel eerst opwarmen.
- **Belangrijk voor een overname**: dit is de snelste route om de werkomgeving te herbouwen. De actuele werkstand staat altijd in `docs/WERKSTATUS.md`.

#### E.1.4 `wachtwoorden setup sites app.docx` (13 mei 2026): VEROUDERD, **geheim**
- Vroege notitie met inloggegevens voor de muziekbron/Bunny en Supabase, plus uitleg over wat Supabase, Netlify en Gumroad doen.
- Inhoudelijk achterhaald: Gumroad is weg.
- Het document bevat wachtwoordfragmenten. Die horen in de wachtwoordbeheerder en daarna moet het bestand weg (operator-beslissing).

---

### E.2 Sleutels en toegangsbestanden (enkel beschrijving)

| Bestand | Wat het is | Gebruikt door | Status |
|---|---|---|---|
| `VIBEZCORE Apple Sign in sleutel\AuthKey_3VS353U3RM.p8.docx` | Private key "VIBEZCORE Sign in with Apple" (aangemaakt 18 okt 2026) | Netlify-omgevingsvariabele `APPLE_SIWA_PRIVATE_KEY` (Production). Doel: de Apple-login intrekken bij het verwijderen van een account (App Review 5.1.1(v)) | ACTUEEL, nodig |
| `VIBEZCORE Apple Sign in sleutel\SubscriptionKey voor RevenueCat.docx` | Private key van de App Store In-App Purchase/Subscription-sleutel | RevenueCat (iOS-aankopen valideren) | ACTUEEL, nodig |
| `Google-play-service-account.json Belangrijk\vibezcore1-ziub6j-73a95f2938d3.json` | Service-account `vibezcore-iap-verify@…` in GCP-project `vibezcore1-ziub6j` | Play-aankopen verifiëren (backend/Expo submit). Volgens het Blueprint waren er in juni drie actieve sleutels | ACTUEEL, nodig |
| `vibezcore-gcp-revenuecat-service-account..json` | Zelfde service-account, **een andere sleutel** (private_key_id verschilt) | RevenueCat (Play-receipts) | ACTUEEL, nodig |
| `.env.bunny` | 5 Bunny-variabelen (storage zone, wachtwoord, hostname, pull zone-id, API-key) | Uploadscripts in het project | ACTUEEL, nodig |
| `.env.test` | Inlog van een testaccount (`VZ_TEST_EMAIL`/`PASSWORD`) | Geautomatiseerde tests | ACTUEEL, nodig voor tests |
| `VIBEZCORE Google OAuth (2026-06-24).docx` | Client-ID + **client secret** van de Google OAuth-webclient | Supabase Google-login | Waarschijnlijk ACTUEEL |

Opmerkingen:
- Private keys in een **Word-bestand op een gesynchroniseerd bureaublad** zijn kwetsbaar. Advies: bewaar ze in de wachtwoordbeheerder en verwijder de Word-kopieën zodra dat gebeurd is. Dat is een operator-beslissing.
- Volgens het noodplan zijn alle sleutels die de pc raakten te vervangen bij diefstal (§E.1.2).

---

### E.3 Oude bedrijfs- en productoverzichten

#### E.3.1 `App productie services.docx` (2 jun 2026): VEROUDERD, bevat **geheimen**
Lijst van de diensten in juni:
- GitHub, Netlify (app.vibezcore.com + functies), Supabase.
- **Gumroad** (betalingen): VEROUDERD, verwijderd na de beslissing van 12 jun 2026.
- Bunny.net (CDN, signed URLs).
- Zoho Mail (`info@vibezcore.com`, SMTP).
- Cloudflare (DNS).
- **ipapi.co** (geo-detectie voor btw-prijzen, gratis 1000 calls/dag). Dit hoorde bij de oude webapp.
- Wix (website + domeinregistrar).
- Kickstarter "**Summer 2026**": VEROUDERD, nu "Launching Early 2027".
- Oud domein **nexusbelgie.be** (auto-renew uit, loopt af in **april 2027**). Een nuttige herinnering: laten aflopen.

Kostenschatting uit juni: GitHub $0, Netlify $0 (→ $19), Supabase $0 (→ $25), Bunny een paar dollar, Gumroad 10 %. De actuele kosten staan in `docs/OPERATOR_HANDOVER.md` §10–13.

Onderaan staan **Expo- en Zoho/Netlify-inloggegevens in platte tekst**. Zie §E.9.

#### E.3.2 `VIBEZCORE app_Blueprint.docx` (versie 3 jun / 18 jun, bijlage E 26 jun 2026): VEROUDERD als geheel
Het is een technische A-tot-Z-blauwdruk in 19 delen (stack, repo, env, schermen, backend, Supabase, auth, IAP, BLE, audio, adem, e-mail, betalingen, build, merk, debugging, rampenplan, onboarding) met bijlagen A–E. Het andere blueprint-team documenteert de huidige code. Wat hier **nog waarde heeft**:
- **E-mail (deel 12)**:
  - Domein vibezcore.com met MX naar Zoho (`mx.zoho.eu`, `mx2.zoho.eu`), SPF `include:zoho.eu`, DKIM van Zoho en DMARC `p=quarantine`.
  - Mailboxen `support@`, `noreply@` en `info@vibezcore.com`.
  - Het in-app supportformulier gaat naar `/api/support` en via Zoho SMTP naar support@.
  - Supabase Auth-mails gingen in juni via de **standaard SMTP van Supabase** (Zoho bewust niet gebruikt wegens leveringsproblemen). Of dat nog zo is, moet het backend-team nagaan.
- **Rampenplan (deel 18)**:
  - Supabase free tier maakt dagelijks een back-up met 7 dagen bewaring.
  - Netlify en Bunny hebben geen failover.
  - **Het Apple Developer-lidmaatschap ($99/jaar) tijdig verlengen**, anders verdwijnt de app (herinnering 60 dagen vooraf).
  - Bij verlies van het Wix-account: domeintransfer.
  - De account van de operator moet 2FA hebben.
- **Bijlage E (RevenueCat, 26 jun)**:
  - Overstap van react-native-iap naar RevenueCat (de Nitro-runtime faalde).
  - Entitlement `audio_pro`.
  - De Play-SKU's `vibezcore_audio_monthly` en `_yearly` bestaan nog in de code. Daarnaast zijn er nu `vibezcore_day_pass` en iOS-jaar `vibezcore_premium_yearly`.
  - Play RTDN via Pub/Sub was toen **nog niet ingesteld**. Nagaan of dat ondertussen gebeurd is.
  - Echte aankoop testen kan met een Google-account dat geen licentietester is.
- **VEROUDERD**:
  - Prijzen €9,99 / €69,60 / $11,99 en Kickstarter **1 september 2026**.
  - Bracelet $169 (was $299), bundel $215 (was $399), extra $32. Dit zijn niet de huidige prijzen; de bracelet-prijzen zijn opnieuw te bepalen voor 2027.
  - Accent `#3a8fff` (nu Bio-Teal).
  - 4 tabs met de Breath-tab, react-native-iap, de webapp als actief product en de modusnaam "Rest & Reset" (nu Sleep).
  - "27 gratis sessies via Free Picks" (nu 10).

#### E.3.3 `app bouwregels.docx` (20 okt 2026): ACTUEEL (richtlijn)
Vijf principes:
1. Geen vaste maten of tijden die op één toestel gemeten zijn.
2. Automatische tests (logica + Maestro-flows op meerdere emulators, ook grote letters en 3-knopsnavigatie).
3. Test op echte toestellen vóór elke release (Firebase Test Lab).
4. Gefaseerde uitrol: intern → bèta 20–50 → productie 5 % → 20 % → 100 %.
5. Crashdashboard na de lancering.

⚠️ Firebase Test Lab kostte op 2 nov €12,69 zonder toestemming. Volgens het geheugen geldt nu: **geen betaalde diensten zonder expliciet ja**.

---

### E.4 Bracelet: haptiek, firmware en hardware

#### E.4.1 `Vibezcore_Firmware_v1.0.zip` (2 jul 2026)
Inhoud:
- `Haptic_Bracelet_Spec_v2.3.docx` + `.pdf` (maart 2026);
- `Haptic_Bracelet_Spec_v2.4.md` (juli 2026);
- C-bronnen voor de nRF5 SDK: `main.c`, `modes.c`, `session.c`, `ble_bracelet_service.c`, `drv2605.c`, `battery.c`, `led.c`, `pin_config.h`, README.

Status:
- **De firmware v1.0 is VEROUDERD**. v2 (nRF5 SDK) is deprecated en v3 is een Zephyr/NCS-port (zie het geheugen). Er bestaat ook een latere zip van 13 jul in `pcb alle documenten`.
- **Spec v2.3 is het document dat CLAUDE.md "BINDEND" noemt** ("zit in de projectkennis, niet in deze repo"). **Hier staat een kopie van.** Nuttig om te bewaren.

Wat uit v2.3 nog bindend of nuttig is:
- **§8 BLE-contract**:
  - Commando: `mode 0–4, duration (min), command 0x01 start / 0x02 stop / 0x03 status`.
  - Status: `session_active, current_mode, remaining_minutes, battery_percent, charging, fault`.
  - Verbindingsverlies stopt de sessie niet. De app pollt elke 5 s.
- **§9 Veiligheidsregels**: de sessie stopt bij max-duur, laden, batterij < 5 % en een DRV2605L-fault. Bij 5–20 % batterij daalt de amplitude met 20 %. Een ongeldige modus wordt genegeerd en een ongeldige duur wordt geclampt.
- **§14 BOM** (PCB `MODULE B.kicad_pcb`):
  - nRF52832 (U1), DRV2605L (U2), MCP73832 Li-Po-lader (U3), AP2112K-3.3 LDO (U5), kristallen 32 MHz + 32,768 kHz;
  - status-LED en bicolor-LED XL-1010SURUBC (enkel rood + blauw, geen groen);
  - 2,45 GHz-antenne, met LCSC-nummers.
- **v2.4 voegt toe**:
  - Pause- en Resume-commando's en het veld `session_paused`.
  - LED enkel bij actie, laden of waarschuwing.
  - Laaddetectie via SAADC, omdat de STAT-pin van de MCP73832 niet naar een GPIO gaat.
  - Batterijmeting via de interne VDD (er is geen spanningsdeler).
  - Vaste 128-bit BLE-UUID's.
  - ⚠️ Volgens het geheugen ("AI-spec-documenten zijn geen hardware-waarheid") is v2.4 een **werkontwerp**, geen bindend document.

**VEROUDERD in v2.3 en v2.4:**
- De PPS-ritmes (Gamma ~30–40 … Delta ~2 PPS).
- Sessieduren 8–15 / 15–30 / 25–45 min. Nu 5–20, 5–30, 5–30, 10–45 en 10–50 min, met aanbevolen 10/15/18/25/30.
- De oude modus-kleuren.
- Taal als "zenuwstelsel continu geactiveerd", "ritme correleert met hersengolfpatronen" en "wetenschappelijk vastgesteld". Die taal **mag nooit naar marketing of de app** (CLAUDE.md §1).

#### E.4.2 `VIBEZCORE Haptic System 04-10-2026.docx`: DEELS
- Een "Definitive Scientific & Technical Specification" v1.0, gekoppeld aan commit `022edda`.
- Inhoud:
  - Twee frequentiedomeinen: de carrier van de LRA (bv. Vybronics VG0640001D, 210 Hz; niet bevestigd dat dit het echte onderdeel is) en het pulsritme.
  - Bewijsniveaus per modus. Calm Control 0,97 Hz is gebaseerd op **Doppel** (Azevedo et al. 2017, Sci Rep 7:2285): 58,2 BPM, ongeveer 20 % onder de rusthartslag.
  - Sleep 0,60 Hz, Clarity 0,80 Hz, Focus 1,50 Hz en Boost 2,75 Hz zijn extrapolaties of ontwerphypotheses.
  - Bronnenlijst: PIV/PIV++, IEEE ToH 10.1109/toh.2016.2531662, Hallihan & Siegle 2022, Lee et al. 2026 (IMWUT 10.1145/3790116).
- **ACTUEEL en waardevol: §9 "Toegestane en niet-toegestane claims"** per modus. Nooit "klinisch bewezen", "therapeutische frequentie", "hersengolf-specifiek" of "induceert slaap". Dit sluit aan bij CLAUDE.md §1.
- **VEROUDERD: de frequentietabel.** Volgens het geheugen (`project-bracelet-haptic-research-2026-10-04.md`, ronde 3, `a1a1387`) is het ritme nu een **lub-dub dat van 75 bpm naar een eindtempo glijdt** (Sleep 40 … Boost 110 bpm) en sindsdien afgestemd op de rusthartslag (Match Your Rhythm). De bron van waarheid is de code plus `docs/VIBEZCORE_SCIENCE_A_TOT_Z.md`.

#### E.4.3 `VIBEZCORE — Voelbare preview van de 5 bracelet-modi, op de telefoon. 04-10-2026.docx`: VEROUDERD
- Een Word-kopie van een TypeScript-bestand (preview van de bracelet-haptiek via de React Native Vibration-API, Doppel-model 2,75/1,50/0,97/0,80/0,60 Hz).
- Bevat ook de verklaring waarom de telefoon geen amplitude en envelope kan nabootsen. Vervangen door de code in de repo.

#### E.4.4 `Firmware flash-hardware te bestellen.docx` (7 jul 2026): DEELS
- **Hardware (Mouser, ~$100)**: nRF52-DK (949-NRF52-DK), Tag-Connect TC2030-IDC-NL + retentieclips, dupont-draden. Allemaal aangevinkt als "Ok", dus waarschijnlijk besteld.
- **Soldeergerief (~$125)**: Aixun T3B of Yihua 936, Kester 44, flux, wick, ESD-pincet, loep, IPA. Totaal ongeveer €210.
- **Software**: nRF Command Line Tools, nRF Connect for Desktop, Segger Embedded Studio, J-Link en de **nRF5 SDK 17.1.0**. Die SDK is VEROUDERD: de firmware is overgezet naar **nRF Connect SDK 3.4.0 (Zephyr)**.

#### E.4.5 `bracelet new corract.png`: ACTUEEL beeld
Foto van de bracelet aan een pols in een donker pak: donkerblauwe kralen, stalen tussenkralen, een zwarte module met de opdruk "V2C" en een blauwe LED. Een marketingfoto (geen technische foto). Volgens CLAUDE.md §3 is het materiaal stainless steel met echte edelstenen, zonder helende claims.

---

### E.5 Store-materiaal (Google Play / App Store)

| Map | Inhoud | Status |
|---|---|---|
| `App store images\App Store iPhone 1242x2688\` | 12 iPhone-screenshots (1242×2688): 00 Intro, 01 Welcome, 02 Breathwork, 03 Breathwork session, 04 State Control, 05 State Control timer, 06 Heart rate, 07 Audio Library, 08 Audio player, 09 Set your state, 10 Choose your path, 11 Activity | ACTUEEL (iOS-indiening 2 nov, met "Heart rate" vóór de timer) |
| `App store images\` (los) | JPEG-varianten van dezelfde schermen, overzichtsbladen "Overzicht iPhone screenshots" en "Overzicht Wear OS formaten", 2 video's (2 en 3 nov) | ACTUEEL |
| `Play telefoon-screenshots 30 okt 2026\` (ook gekopieerd in `Vibezcore fotos appstores\`) | 8 Play-screenshots (1080×1920): welcome, breathwork, smartwatch, state_control, boost_active, activity, audio_library, audio_player | ACTUEEL |
| `Play feature graphic 1024x500 (30 okt 2026).png` + `Play app icon 512` | Play-functieafbeelding en icoon | ACTUEEL |
| `Vibezcore fotos appstores\` | 42 iPhone-screenshots `IMG_0697–0738` (1242×2688), 12 Apple Watch-screenshots `incoming-…` (396×484), voorstel-overzichten `_VOORSTEL_IPHONE_v2/v3`, `_VOORSTEL_WATCH(_v2)`, `_OVERZICHT(_WATCH)` | Werkmateriaal voor de selectie |
| `vibezcore-images\Screenshots Apple\` | 8 iPhone + 5 Apple Watch (Start, State Control kiezen/sessie, Breathwork kiezen/sessie) | ACTUEEL (de Watch-volgorde van 2 nov) |
| `Horloge-app 27 okt\wear-release-27okt-26102716.aab` | Wear OS-build van 27 okt | VEROUDERD (WERKSTATUS 3 nov: Wear 26110314 gaat naar productie na goedkeuring van de FGS-verklaring) |
| `Horloge-app 27 okt\horloge-icoon-mockup.html` | 3 varianten voor het horloge-icoon: zwart met witte rand, zwart met Bio-Teal-rand, grafiet zonder rand | Ontwerpkeuze. Zie geheugen `reference-wear-icon-size.md` |

Wat het overzichtsblad toont: dark UI, witte pil-CTA's, Bio-Teal-accent en 5 tabs (State Control, Breath, Library, Activity, Profile). Het welkomstscherm heeft "Reset Yourself / Control Your State / Train Your Mind" en "Already a member? Sign in". Het State Control-scherm noemt "Early 2027 · Smart Bead Bracelet". Dat is consistent met de huidige app. Store-teksten staan in de repo (`docs/PLAY_STORE_TEKSTEN.md`, `docs/APPSTORE_TEKSTEN_2026-11-01.md`).

---

### E.6 Juridisch: privacyverklaring

- `privacy-policy-website-updated.html` en `privacy-policy-MEET-HOOGTE.html` (28 okt 2026) hebben **dezelfde tekst**.
- De MEET-HOOGTE-versie bevat een extra script dat de embed-hoogte voor Wix toont ("Zet de embed-hoogte op … px"). Dat is enkel een hulpmiddel.
- Inhoud: "Last updated: October 2026", 15 secties:
  - verzamelde gegevens, app-gegevens die lokaal blijven of naar de server gaan (auth-token, receipts, anonieme play counts, crashrapporten als je dat toestaat, Backup & Sync voor wie ingelogd is);
  - rusthartslag (optioneel, ingevoerd of via de camera gemeten);
  - EEA-grondslag, CCPA, kinderen, contact.
  - Zegt dat er geen gezondheidsgegevens worden gelezen van de bracelet, de telefoon of het horloge.
- ⚠️ Volgens WERKSTATUS (2 nov) is de website-privacy aangevuld met de **Health-zin** (Mind & Body-sessie op het horloge, niets opgeslagen of gelezen) en op Wix gepubliceerd. Deze HTML-bestanden zijn van 28 okt en **zijn mogelijk niet de live versie**. De bron van waarheid is de live Wix-pagina en de generator in de repo (`scripts/gen-website-legal.mjs`).

---

### E.7 Audio-content (bronbestanden)

De live audio staat op **Bunny CDN** (`vibezcore-audio.b-cdn.net`). In `src/data/audio-library-data.ts` staan 145 sessies:
- 85 uit `/audio-new/` (de nieuwe 4-pijler-opnames);
- 59 uit de CDN-root (de oudere PodcastleAI-sessies, die nog live zijn);
- plus `/images/`.

Soundscapes komen van `/soundscapes breathwork/` en de stemmen voor ademsessies van `/Breathwork audio v4/`. De OneDrive-mappen zijn de **originelen**.

| Map | Inhoud | Opmerking |
|---|---|---|
| `Vibezcore Audio new 4 Pillars\Pillar 1\` | 86 mp3's (1,4 GB), naam `<reeksnr>. <DENKER> <nr>. <titel>.mp3`, bv. "1. CARL JUNG 01. The Inner Child New.mp3" | De originelen van `/audio-new/`. Ondanks de mapnaam zijn het alle reeksen. Pillar 2–4 zijn leeg |
| `…\Nieuwe tekst sessies\` 1–19 | Scripts (.md of bestanden zonder extensie), 5 per reeks: 1 Jung, 2 Purpose & Mission, 3 Nietzsche, 4 Robert Bly, 5 Alice Miller, 6 Bowlby, 7 Walter Cannon, 8 Stoics, 9 Lao Tzu, 10 Machiavelli, 11 Adler, 12 Jim Rohn, 13 Life After Betrayal, 14 Frankl, 15 Marcus Aurelius, 16 Beast Mode (leeg), 17 Iron Discipline, 18 Soundscapes (leeg), 19 Kant | ACTUEEL. Komt overeen met de reeksen in de app |
| `…\sessies archief\` en `…\seesies archief 2\` | Oudere reeksconcepten: 20 "cards" v5.2 (Identity Shift … Who You Become) + Freud, Socrates, Porges, Aristotle, William James, Neville Goddard, Jim Rohn (Journey), Maslow, Frankl, Nietzsche, Napoleon Hill, Emerson | VEROUDERD (niet in de app: Neville en Maslow komen niet voor in de code) |
| `…\Audio capcut\` | 6 mp4-video's (eerste sessie van reeks 1–5 en 13) | Social/promo |
| `Vibezcore Podcasts PodcastleAI - onbekend album\` | 59 oudere sessies (Huberman 5, Beast Mode 6, Carl Jung 10, Daily Affirmations 7, Morning/Evening affirmations, Jordan Peterson 5, Life After Betrayal 5, Napoleon Hill 5, Naval Ravikant 5, Journey to Success 5, Stoic Mind 5, Walter Cannon 4) | **Nog live in de app** (Bunny-root, bv. de reeksen "Master Mental Clarity", "Meaning Over Comfort", "Identity & Wealth", "The Freedom Formula"). Deze bestanden niet weggooien |
| `…\Theta en Delta podcast\` | 19 tracks (focus-theta 1–7, sleep-delta 8–11, meditation 12–17, ambient 18–19), 2 als .m4a van ~90 MB | Oud. "Theta/Delta" en "meditation" botsen met de taalregels (geen mindfulness/meditation, geen hersengolf-claims). Niet gebruiken in copy |
| `Vibezcore Audio breathwork\Kylie Breathwork\` (20) en `\Mariius Breathwork\` (16) | Losse stemcommando's voor de vrouwen- en mannenstem: inhale/exhale neus/mond/links/rechts, hold, extra inhale, soft throat sound (Ujjayi), "Dart Vader", Boost-specifiek, "Enjoy your session", afsluitingen per toestand (enkel Kylie) | Originelen van `/Breathwork audio v4/`. De afsluitingen bestaan bewust enkel in de vrouwenstem (geheugen 29 okt) |
| `Vibezcore Muziek podcasts\` | 9 bestanden: Pixabay-tracks (namen met id, bv. `emotional-piano-music-430725`, `warrior-382131`, `valourbound-439247`), "Theta waves.mp3", "Piano 30 min.mp4", "Beast mode oud/nieuw.mp4" | Achtergrondmuziek voor sessies en social. Pixabay-licentie: nagaan per track |

**Redactionele bronnen (ACTUEEL):**
- `VIBEZCORE_Audio_Writing_Handbook_v13_1.md` (1 jul 2026, 1.626 regels), de schrijfgids voor alle sessies:
  - Kernprincipe "Nooit verbloemen" en "elke zin moet nieuwe informatie toevoegen".
  - Geen presentatorstem, geen "tonight", geen lege motivatietaal (Manifest, Universe, Alpha, Sigma …), geen denker-biografie.
  - Structuur per sessie: observatie → patroon → analyse → kosten → handvaten → groeihorizon.
  - Verhouding 40 % inzicht / 60 % herkenning.
  - Per reeks een eigen emotionele motor (matrix), met de regel dat verlies en rouw het terrein van Nietzsche en Frankl blijven.
  - **Onmisbaar om nieuwe sessies in dezelfde stijl te schrijven.**
- `VIBEZCORE_REEKSEN_PER_PIJLER .md` (v8, 13 jun 2026): de indeling van de reeksen per pijler met titels en taglines. De pijlernamen zijn de huidige.
  - **VEROUDERD**: "28 free in app (1 per serie)" en "Subscription €5.99–9.99/mo, offline downloads, bracelet sync". **Nu** zijn er 10 gratis sessies, met dagpas, maand en jaar.
  - De 5 gratis sessies op de website: Bly "The Father You Tried To Outdo", Peterson "Responsibility", Machiavelli "The Naive Eye…", Napoleon Hill "Identity" en Beast Mode "Become a Monster". Nagaan of die lijst nog zo is.
  - De taglines staan nog met een punt aan het einde. Sinds 20 okt geldt: geen punt.
- `sessies archief\card_folder_names.txt` (26 mei 2026): naamformaat v5.2 voor 20 card-mappen. VEROUDERD.

---

### E.8 Marketing en social media

| Bestand | Inhoud | Status |
|---|---|---|
| `blueprint+ audio teksten\VIBEZCORE_Social Media shorts Plan.docx` (3 jul 2026) | "Shortform Blueprint v5.0": vier principes (Recognition before psychology …), 5 niveaus (Wounds → Patterns → Beliefs → Discipline → Purpose), scriptmotor in 8 stappen (Hook → … → Mic Drop → CTA), seizoensopbouw S1–S5, formaat 25–35 s / 75–95 woorden | ACTUEEL als contentstrategie |
| `…\VIBEZCORE_Social media Short_Topics.docx` (3 jul) | 100 hooks, 20 per seizoen | ACTUEEL |
| `…\100 uitgeschreven audio sessies.docx` (13 jul) | Uitgeschreven shortscripts (~1.370 regels), met stem-instellingen bovenaan (Async, stem Kylie, speed 7, max stability) | ACTUEEL (bron) |
| `Vibezcore short audio social media\Audio\` (37 mp3), `Audio capcut LINK IN BIO\` (12 mp4), `…LINK IN DESCRIPTION\` (12 mp4), `Auido capcut\` (3 mp4), `foto 2–5.png` | Afgewerkte shorts: audio + CapCut-video's per platform-CTA | BRON |
| `Teksten social media per kanaal.docx` (25 jul) | Beschrijvingen per kanaal (Facebook, Instagram, TikTok, X, Threads, YouTube Shorts/full) met de link `vibezcore.com/audio-library` | **VEROUDERD**: "27 full-length audio sessions free · Unlock 140+ premium". Nu 10 gratis, 145 in totaal |
| `Fonts audio clips social media.docx` (16 aug) | Opmaak: shorts-titel "ZY Elegant 10 Bold", captions "Word Shrink"; full audio "Roboto 9/12". Plus de positionering "What is VibeZCore?" (bracelet + breathwork + audio; doelgroep ondernemers, professionals, high-performers; "Change your vibe change your life") | DEELS. ⚠️ Schrijft "VibeZCore" en noemt "Improved sleep". Volgens CLAUDE.md altijd **VIBEZCORE**. Bracelet nu = upsell, kern = app + smartwatch |

**Beeldbank `vibezcore-images\`** (ongeveer 300 bestanden, mei–nov 2026):
- Sessie- en reekscovers (`beast-mode.jpg`, `father wound.jpg`, `master-mental-clarity.jpg` …).
- Bracelet-productbeelden (blue/jade/orange, "interchangable bracelet", "designed to be worn").
- Ongeveer 130 app-illustraties `pic …` (onboarding, set your state, dayparts, levels, State Control, smartwatch).
- Social-achtergronden, Gumroad-covers (VEROUDERD), `icon-V-ruim-1024.png`.
- Submappen met app-screenshots, plus `screenshots app.zip` (31 Android-screenshots van 20 jun 2026, VEROUDERD).
- `README.md` (7 mei 2026): uploadinstructie naar Bunny voor 16 webbeelden van de oude homepage. VEROUDERD (oude webapp).
- De live app-beelden staan op Bunny `/images/` en `/images/pics app/`.

---

### E.9 Geheimen en gevoelige bestanden

> Waarden zijn **bewust niet** overgenomen. Ze gaan via het privé-archief naar de operator.

| Bestandspad (relatief t.o.v. `OneDrive\Bureaublad\Vibezcore native app\`) | Waarvoor | Dienst | Nog nodig? |
|---|---|---|---|
| `VIBEZCORE Apple Sign in sleutel\AuthKey_3VS353U3RM.p8.docx` | Private key voor Sign in with Apple (token intrekken bij account verwijderen) | Apple Developer → Netlify env `APPLE_SIWA_PRIVATE_KEY` | Ja |
| `VIBEZCORE Apple Sign in sleutel\SubscriptionKey voor RevenueCat.docx` | Private key van de In-App Purchase/Subscription-sleutel | App Store Connect → RevenueCat | Ja |
| `Google-play-service-account.json Belangrijk\vibezcore1-ziub6j-73a95f2938d3.json` | Service-account `vibezcore-iap-verify` (sleutel 1) | Google Cloud / Play Console (backend, EAS submit) | Ja |
| `vibezcore-gcp-revenuecat-service-account..json` | Zelfde service-account, andere sleutel | Google Cloud → RevenueCat | Ja |
| `.env.bunny` | Storage-wachtwoord, API-key, zone-id's | Bunny.net | Ja |
| `.env.test` | E-mail + wachtwoord van het testaccount | Supabase-testaccount (geautomatiseerde tests) | Ja (enkel voor tests) |
| `VIBEZCORE Google OAuth (2026-06-24).docx` | OAuth client-ID + client secret | Google Cloud → Supabase Google-login | Waarschijnlijk ja |
| `App productie services.docx` (onderaan) | Expo-login (gebruiker + wachtwoord) en een Zoho/Netlify-wachtwoord in platte tekst | Expo, Zoho Mail / Netlify | De accounts wel. **Na overzetten naar de wachtwoordbeheerder de wachtwoorden wijzigen** |
| `Vibezcore alle info pc defect of verloren\wachtwoorden setup sites app.docx` | Wachtwoordfragmenten + login-e-mail | Bunny, Supabase | Accounts ja, document nee (vervangen door de wachtwoordbeheerder) |
| `promotion_codes MONTHLY.csv` / `promotion_codes YEARLY.csv` | 52 + 52 promotiecodes (27 jun 2026) | Waarschijnlijk Google Play-promotiecodes voor de maand- en jaar-SKU | Onzeker. Nagaan in Play Console of ze nog geldig of ongebruikt zijn |
| `Beta Testers Emails List(updated).csv` | 20 tester-e-mailadressen (persoonsgegevens, AVG) | Play Console (gesloten testtrack) | Enkel zolang er een testtrack is |
| `Horloge-app 27 okt\wear-release-27okt-26102716.aab` | Ondertekende release-build (geen sleutel, wel een distribueerbaar bestand) | Google Play | Nee (er is een nieuwere build) |

Advies (één aanbeveling): zet alle bovenstaande waarden in de wachtwoordbeheerder, **wijzig de wachtwoorden die in platte tekst in Word stonden**, en verwijder daarna de Word-kopieën. Volgens het noodplan zijn de .p8- en JSON-sleutels sowieso te vervangen als de pc ooit gestolen wordt.

---

### E.10 Tegenstrijdigheden met de huidige app (samenvatting VEROUDERD)

| Waar | Staat er | Nu (bron) |
|---|---|---|
| A-tot-Z (9 okt), Blueprint (jun), REEKSEN v8 | Prijzen €14,99/€9,99 intro, €89,99/€69,99, €69,60, €5,99–9,99, 7-dagen proef | Dagpas €1,29 · maand €9,99 · jaar €69,99, geen proef (16 okt 2026) |
| A-tot-Z, Blueprint, social-teksten, REEKSEN | 27 of 28 gratis sessies, "140+ premium" | 10 gratis audiosessies, 145 sessies in de catalogus |
| A-tot-Z, productie-services, Blueprint | Bracelet "Fall 2026", "Summer 2026", KS "1 sept 2026" | "Launching Early 2027" (10 okt 2026) |
| Productie-services, wachtwoorden-doc, Blueprint, beeldbank | Gumroad als betaalprovider, Gumroad-covers | Gumroad verwijderd (12 jun 2026). Audio = IAP via RevenueCat, bracelet/bundel later Stripe |
| A-tot-Z | State Control-minima 8/15/15/20/30 min | 5/5/5/10/10 min (11 okt 2026) |
| Haptic System (4 okt), Preview-doc, Spec v2.3/2.4 | Hz- en PPS-tabellen | Lub-dub-ritme 75 bpm → eindtempo, op de rusthartslag (geheugen, Science A tot Z) |
| Spec v2.3/v2.4 | Hersengolf-correlatie, "wetenschappelijk vastgesteld", oude modus-kleuren | Enkel welzijnstaal. Kleuren uit `breath-states.ts` (Sleep = Bio-Teal #00A3A3) |
| Blueprint | Accent #3a8fff, modus "Rest & Reset"/"Clarity", 4 tabs | Bio-Teal-accent, Sleep / Clarity & Relax, 5 tabs |
| Firmware-bestellijst | nRF5 SDK 17.1.0 / Segger ES | nRF Connect SDK 3.4.0 (Zephyr) |
| Fonts-doc | "VibeZCore", bracelet als kern | VIBEZCORE in hoofdletters. Kern = app + smartwatch, bracelet = upsell |
| Noodplan vs. geheugen | Zephyr-firmware in Downloads "is weg" | Geheugen noemt die map nog. **Controleren** en de v3-code veiligstellen |
| Privacy-HTML (28 okt) | Zonder de Health-zin van 2 nov | Live Wix-versie (gepubliceerd 2 nov) |
| Wear-aab 27 okt | Build 26102716 | Wear 26110314 (WERKSTATUS 3 nov) |

### E.11 Wat ontbreekt of open staat (uit deze map)
- **Nagaan of de Zephyr-firmware v3 nog bestaat.** Het is de enige moderne firmwareversie.
- Nagaan of **Play RTDN (Pub/Sub)** voor RevenueCat ondertussen is ingesteld. In juni stond het nog open.
- De status van de promotiecodes in Play Console nagaan.
- Domein **nexusbelgie.be** loopt af in april 2027 (bewust niet verlengd).
- De Pixabay-licentie per muziektrack en de rechten op de PodcastleAI-stemmen bevestigen voor commercieel gebruik.
- De bracelet-prijzen ($169 / $215, juni) moeten opnieuw bepaald worden voor de lancering in Early 2027 (operator-beslissing).

---

## Bijlage F — Open punten en bevindingen (controle 3 november 2026)

Gevonden tijdens het schrijven van deze blueprint. Niets hiervan is al aangepast, tenzij vermeld.

### F.1 Belangrijk (geld of veiligheid)

| # | Bevinding | Waar | Advies |
|---|---|---|---|
| 1 | **Premium-audio wordt alleen in de app bewaakt.** `getSignedAudioUrl()` geeft URL's op de audio-zone ongetekend terug (DEV-bypass uit juni 2026); `/api/audio-url` wordt in de praktijk niet gebruikt. Wie de URL kent, kan audio afspelen. | `src/utils/audio-url.ts` | Geparkeerde taak "Premium-audio beveiligen" hervatten. Niet zomaar de bypass weghalen: de backend kent dagpas en gast-kopers niet. |
| 2 | Backend-webhook kent de iOS-jaar-ID `vibezcore_premium_yearly` niet (alleen `vibezcore_audio_*`). Raakt rapportage, niet toegang. | backend `iap-webhook.js` | Bij volgende backend-ronde toevoegen (toestemming nodig). |
| 3 | Bracelet-migratie bevat testcodes (`TEST…`, `BUNDLE…`). | backend migratie | Verwijderen vóór bracelet-lancering. |
| 4 | Twee Word-bestanden in de OneDrive-werkmap bevatten wachtwoorden in platte tekst. | zie Deel E §E.9 | In een wachtwoordbeheerder zetten, daarna wachtwoorden wijzigen. |
| 5 | Ondertekensleutels werden niet automatisch geback-upt. | `scripts/backup-to-onedrive.sh` | **Opgelost 3 nov** (`656f54f1`): credentials.json, credentials/ en de Wear upload-sleutel gaan nu mee naar het archief. |
| 6 | RevenueCat ↔ Google Play-meldingen (Pub/Sub) waren in juni nog niet ingesteld. | RevenueCat-dashboard | Nakijken. |
| 7 | VS-jaarprijs: bronnen zeggen $69,99 en $59,99. | App Store Connect | Nakijken in App Store Connect. |

### F.2 Verouderde documentatie

| Bevinding | Waar |
|---|---|
| CLAUDE.md §3 spreekt van 3 tabs en 2 welkomstknoppen; de app heeft 5 tabs, een `/intro` en een welkomstscherm met Breathe/Feel/Listen + "Sign In or Create Account". | `CLAUDE.md` |
| CLAUDE.md §2 (oude `index.tsx`/`explore.tsx`) is achterhaald: die bestanden bestaan niet meer. | `CLAUDE.md` |
| `docs/WATCH_PROTOCOL.md` mist handdruk, klokmeting, catalogus en `breath/ack`. | docs |
| `OPERATOR_HANDOVER.md`: "New Architecture false" (is true), eas.json "nog in te richten" (bestaat), RevenueCat/Sentry/EAS-plan ontbreken; env-namen deels oud. | `docs/OPERATOR_HANDOVER.md` |
| Science-doc noemt nog trilsterkte "Soft" (bestaat niet meer → Medium). Hartslagcurve start op je rusthartslag (standaard 70), niet op 75. | `docs/VIBEZCORE_SCIENCE_A_TOT_Z.md` |
| Comments achterhaald: `SalesNudgeHost.tsx` (oude dagpas-regel), `audio-library-data.ts` (zegt 83 sessies; zijn er 144 in 25 series), `PREVIEW_CAP_SEC` 60 s vs comment 30 s, `theme.ts` (light als standaard), `targets/watch/expo-target.config.js` (verwijst naar verdwenen bestanden). | code |
| Oude stukken in OneDrive met oude prijzen (€14,99/€89,99, proefperiode), 27 gratis sessies, "Fall 2026", Gumroad, hersengolf-taal. | Deel E §E.10 |

### F.3 Opruimen in de code (geen haast)

- Dode schermen: `breath-quiz.tsx`, `breath-pacer-preview.tsx`; ongebruikte Expo-template-componenten.
- `react-native.config.js` sluit nog `react-native-iap` (niet meer gebruikt) en `react-native-nitro-modules` (wel nodig voor vision-camera) uit — nakijken bij cameraproblemen.
- Gumroad-endpoints en `/api/iap-verify` in de backend zijn verouderd.

---
