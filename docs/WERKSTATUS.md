# WERKSTATUS — waar staat het werk NU

> **Levend document.** Claude werkt dit bij na elke afgeronde wijziging,
> in dezelfde commit, en pusht meteen (operator, 9 okt 2026: "nieuwe Claude
> moet onmiddellijk kunnen zien wat wij aan het doen zijn en de build gewoon
> verderzetten zonder vragen"). Een nieuwe sessie leest dit als eerste na
> `CLAUDE.md`, daarna `git log -20`, `docs/TEST_LOG.md` en het geheugen.
>
> Laatst bijgewerkt: 20 oktober 2026 — toestel-onafhankelijk (T324–T328); vorige: 19 oktober 2026 — toestel-audit (T314, T318, T319) + Android-fixes (T315–T317) klaar; één nieuwe iOS- en Android-build met alles; Galaxy Watch-aab in release-android/.

---

## 1. Repository en branches

| Wat | Waarde |
|---|---|
| Repo | https://github.com/ulgarbilican-dotcom/vibezcore-app (remote `origin`) |
| **Werkbranch** | **`rollback-vc76-take2`** — hier wordt ALLES gecommit en gepusht |
| `main` (origin) | Default-branch op GitHub, loopt achter — niet op werken |
| `master` (lokaal) | Oude branch van vóór de rollback — niet gebruiken |
| `claude/*`, `worktree-agent-*`, `backup-stash-recovery`, `fabric-bisect`, `fix/breath-reanimated-warning` | Oude hulpbranches/worktrees — negeren |
| Backend-repo | https://github.com/ulgarbilican-dotcom/vibezcore-backend — NOOIT wijzigen |

Regel: na elke afgeronde wijziging `git commit` + `git push origin rollback-vc76-take2`.
Een Stop-hook (`.claude/settings.local.json` → `scripts/backup-to-onedrive.sh`)
pusht openstaande commits en kopieert geheugen, privé-docs, `.env*` en
`secrets/` naar `OneDrive\Documenten\VIBEZCORE-archief`.

---

## 2. Live versies

| Platform | Status |
|---|---|
| Android | Live op Google Play. Laatste store-build: zie Expo-dashboard (nooit buildnummers uit het geheugen halen). |
| iOS | Ingediend, op 17 juli 2026 afgewezen (7 punten). Fixes in code, nieuwe `eas build -p ios` + herindiening nog te doen — zie geheugen `project-ios-appstore-submission-2026-07-16.md`. |

---

## 3. Huidige bouwronde (sinds de laatste store-build)

Alles hieronder zit in de code op de werkbranch, maar is **nog niet in een store-build**.
Plan: eerst alle fixes bundelen, dan één EAS-build (quotum 15 Android-builds/maand).

**Afgerond in deze ronde (op dev build getest door operator, tenzij anders vermeld):**
- 20 okt 2026 (T324–T328, operator: "alles moet voor ELKE gebruiker correct zijn, niet enkel mijn gsm"): horloge-klokverschil per toestel gemeten (Galaxy + Apple Watch), telefoon start de eerste slag op een gekozen moment (geen vaste A16-opstarttijd), Bluetooth-vertraging gecompenseerd voor geluid/stem, voelbare trilsterkte op telefoons met amplitude-regeling, tekst tot 1,3× lettergrootte, Android-navigatiebalk donker, tabbalk donker vlak, logo terug zwart-wit. Nog te doen uit de toestel-audit: horloge-motor/beeld-vertraging (WearStateSessionService VISUAL/HAPTIC_AFTER_PHONE_MS) en breathwork-marge op het horloge blijven waarden van Watch4+A16 (nu los van de klok); Text-standaardlettertype (defaultProps) werkt niet onder React 19. Builds: iOS 59 / Android 103 / Wear 26101923 bevatten dit NIET — volgende bouwronde.
- 19 okt 2026: **Apple Health / Health Connect UIT bij de lancering** (operator: "VIBEZCORE meet zelf"). `HEALTH_INTEGRATION_ENABLED = false` (src/constants/features.ts): health-sync.ts volledig no-op (geen lezen bij start/AppState), Settings-rij en "Use your watch"-rij weg, Health-rationale in _layout uit, oude Health-waarden tellen niet meer mee. app.json: health-permissies + config-plugins weg (health-permissies nu in blockedPermissions), react-native.config.js sluit HealthKit uit van iOS-autolinking. Privacy Policy + FAQ zonder Health. minSdk 26 blijft (Health Connect-client vereist 26; pakket staat nog in package.json — operator beslist over uninstall). **Nieuwe build nodig.** Code blijft voor later (zie commentaar bij de vlag).
- 19 okt 2026 middag (T306–T312): volledige testronde iPhone + Apple Watch verwerkt; indienbuild = de laatste iOS-build van 19 okt (nummer in TEST_LOG). App Store-indienen: docs/APP_STORE_INDIENEN_19OKT.md (Terms = /terms-and-conditions, Privacy = /privacy-policy). Na indienen: Backup & Sync (goedgekeurd), marketing-screenshots, Android-build versiecode 100, audiobestanden normaliseren indien nog schel.
- 19 okt 2026 (T304–T305): **.easignore-fout** — sinds 4 okt sloten de regels `ios/` en `android/` ook modules/*/ios en modules/*/android uit: GEEN eigen native module (Apple Watch-koppeling, Live Activity, BeatEngine, trildienst, audioroute) zat in een EAS-build (iOS 17–35, Android 99). Gefixt (`a04f330`, regels met leidende /). iOS-build 36 bevat ze (pod-log nagekeken) en staat op TestFlight. **Android-build 99 NIET uploaden** — nieuwe Android-build nodig. **Nieuwe iPhone-geluidsmotor** (modules/session-audio, AVAudioEngine): krijgt het hele State Control-plan en plant elke slag zelf op de geluidsklok (ook vergrendeld), stem-zinnen en tikken via dezelfde motor, houdt de app levend i.p.v. de stille expo-audio-lus; BeatEngine verwijderd. Oorzaak haperen/holle stem: expo-audio zet na elke gestopte speler de geluidssessie van de hele app uit. NIET op toestel getest (Windows) — eerst build 36 testen (vergrendelscherm + Watch), dan build 37 met de motor + Profiel-plan/Manage-blad.
- Free tiers: 10 gratis sessies; proef = 27 sessies + Breathwork + State Control; betaald = alles.
- Mini-player in de tabbalk gedokt; glazen bottom sheets met vast sluitprotocol (geheugen: `feedback-sheet-close-protocol.md`).
- Breathwork-onboarding: één keer, skip-bevestiging per stap, replay via Settings.
- 15 okt 2026: State Control-onboarding (4 stappen) gebouwd; indrukken overal via PressScale, stap 3 groter hart (T205). Camera-toestemming pas bij stap 4.
- 16 okt 2026: dagpas €1,29 (24 u) gebouwd, 7-dagen-trial weg, enkel 10 gratis audiosessies (T207). Stores ingesteld (zie docs/IOS_TESTRONDE_BUILD20.md). Echte aankoop testen = store-build. Daarna: de iOS-lijst uit build 20 afwerken.
- GEPARKEERD (operator, 16 okt): Premium-audio echt beveiligen (Bunny token-zone + /api/audio-url in C:/Users/ulgar/vibezcore-backend). Backend-toestemming gegeven; plan en lekken in het geheugen (project-premium-audio-protection). Hervatten met screenshots van Bunny Pull Zones/Storage + BUNNY_CDN_HOSTNAME.
- 17 okt 2026: Android-productiebuild klaar (EAS 8bdc8eda, versiecode 99) + horloge-app wear-release.aab (ondertekend met de uploadsleutel, SHA1 91:BD:78…, via credentials.json) — beide nog door operator te uploaden in de Play Console (telefoon: Production/Internal track; horloge: Wear OS-track, zie docs/WEAR_RELEASE.md). credentials.json + credentials/ + *.aab staan in .gitignore.
- 17 okt 2026 (T245–T263): iOS-build gestart (EAS f254744e, commit `b1a52b2`) met alles tot T263: voorproef via dienst/Live Activity, horloge wekken + sync, teksten/juridisch nagelezen, leeftijd 13+, bevestigingsscherm, Set your plan-cirkel, iPhone-melding zonder Watch, 49 ademsessies. TestFlight-upload: operator draait `npx eas-cli submit -p ios --id f254744e-1724-4579-8c42-edf0456b7212`. Android: nieuwe build nodig (natief: dienst-voorproef, wekbericht) + nieuwe horloge-app in Play.
- 16 okt 2026 (T240–T244, na iOS-build 21): onboarding-routes (elke hartslagkeuze → State Control), iPhone-tikken sterker, Try 30 met golf per hartslag + Soft/Medium/Strong, State Control Strong steviger (telefoon), dubbele zijwaartse bounce bij vegen, Quick Chill/Boost direct voor Premium. ASC-prijzen VS manueel $1,29/$9,99/$69,99. Open: luidheid audiobestanden (wacht op "ja" operator + Bunny), andere iPhone-fouten van build 21 nog door te geven. Volgende build pas na eigen A16-test van alle gewijzigde flows.
- 16 okt 2026 (T234–T239): State Control-onboarding stap 2 af (water vult vóór de slag, glazen cirkels, tekst gecentreerd); iOS-lijst 17/18/22 in code nagekeken. iOS-build 21 gestart (EAS c682f553, commit `9e62fc6` — glas/T238/T239 zitten er NOG NIET in). TestFlight-upload: operator draait `eas submit -p ios --id c682f553-698c-46c0-ac17-0454cdf54ac4`.
- 16 okt 2026 (T207–T227): iOS-lijst build 20 afgewerkt in code (zie docs/IOS_TESTRONDE_BUILD20.md), navigatie/sluiten volgens Apple, onderbladen wegvegen + stapel, Inter overal, iPhone-tekst ×1,08, knoppen 52, tekst in blok (BalancedText), Audio Library rustig, opstartanimatie V→VIBEZCORE. VOLGENDE: nieuwe iOS- én Android-build, dan alles hertesten op iPhone (TEST_LOG ⏳-regels).
- Soundscapes: Rain en Canopy gratis, rest met kroon.
- Resting Heart Rate-pagina (eerste State Control-scherm) + meetscherm: hart dat zich vult, live bpm, hartlijn (ECG), foutschermen, batterijcontrole via `expo-battery` (**nieuwe native module → vereist nieuwe build**).
- State Control-scherm herontworpen: cirkel 270, tijd kiezen door over de rand te slepen (boog + greep), drie vaste tijden (kort/aanbevolen/lang, zie `threePresets` in `src/app/bracelet-control.tsx`), hartslag-pil bovenaan in de cirkel, Quick Chill/Boost-kaartjes, ronde paginapuntjes.
- "Your Resting Heart Rate"-pagina — **goedgekeurd door operator 9 okt ("heel mooi, professioneel")**: stilstaande groene glascirkel, groot dekkend glazen hart, hartlijn met echte monitorvorm (`src/utils/ecg-shape.ts`, afleiding II) die door een schrijfpuntje rechts wordt getekend en achter het hart doorloopt; hart klopt wanneer de piek erdoor gaat.
- Meetscherm: Touch ID-achtige vinger-animatie zolang de vinger niet ligt; meting exact 30 s. Live bpm-getal staat stil (geen meeklop, bijsturen hooguit 1 bpm per 1,5 s); hart en hartlijn kloppen op een regelmatige maat op dat getal. Eindresultaat via `robustPulse` (schuivende vensters van 8 s, enkel schone stukken, ≥ 12 s dekking, onderling eens) — 9 okt: twee mislukte metingen (verstoring eerste 14 s) gaven hiermee 79 en 76 bpm. Verstoorde stukken (sprong > 5× de gewone uitslag) worden overgeslagen, ook voor het live getal (geen fout 63 meer). Layout zoals de Resting Heart Rate-pagina: hartlijn over de volle breedte achter de ring (196) door, grote pieken. Na de meting: vinkje in de ring (lager geplaatst) + onderaan één knop die de volgende stap noemt (Start / Back to State Control / Let's Go / Back to Profile); de meting wordt pas bij die tik bewaard (geen sprong meer naar de volgende pagina); enkel bij een veel lagere meting eerst het uitlegscherm. **Door operator te hertesten.**
- Resting Heart Rate-pagina: hartslaggeluid (echte lub-dub, per uitgang een eigen versie: speaker = Pixabay 6396 (`assets/heartbeat-speaker.wav`), koptelefoon = Pixabay 21649 (`assets/heartbeat-headphones.wav`); uitgang via nieuwe native module `modules/audio-route` (**nieuwe build nodig**; iOS-Swift niet compileerbaar op Windows → bij iOS-build controleren), `services/heartbeat-sound.ts`) + fijne tik op elke slag, enkel zolang de pagina in beeld is; mengt met muziek, iOS stil bij stille modus; stil als een ademsessie of audiobibliotheek-sessie geladen is. Zet een zachtere audiomodus → audio-player/session-keepalive krijgen `invalidate…` en zetten hun modus opnieuw. Vergrendelscherm-test na deze wijziging ✅ (test 53b, 10 okt). Voorstel open: Feel / Feel & Hear in State Control-sessies (wacht op operator).
- State Control Feel & Hear (10 okt): keuze op de sessiepagina via pil "Audio & Haptics" boven de play-knop → glazen blad met kaarten Haptic / Haptic + Audio (`services/state-sound-pref.ts`). Android: StateHapticsService speelt het hartslaggeluid zelf (SoundPool, `res/raw/heartbeat_*.wav`) op elke tik, ook op slot; elders JS zolang de app open is. **Nieuwe build nodig; door operator te testen.**
- Meetscherm-einde: hart klopt door op gemeten bpm met geluid + tik, succesmoment (lichtgolf, zelftekenend vinkje, "Measurement complete / You can lift your finger").
- Merk: V-merkteken keuze B (15% korter), woordmerk-letterafstand ×1,1 (`assets/vibezcore_wordmark_spaced.png`), welkomstscherm + lockscreen-kaart.
- Dev-tip: in de dev-build is IAP gemockt → zonder dev-override "Full PRO" ziet de operator de gratis/preview-omgeving (Settings → Developer).
- Hartslag-blad in State Control: "Resting heart rate / Heart rate now", Measure Now + Not Now.
- Centrale tikjes-helper `src/utils/haptics.ts` (Android-systeemtikken i.p.v. trilmotor) — **door operator nog te voelen op de A16**.

**Nog te doen in deze ronde:**
1. Operator test de laatste State Control-wijzigingen op het toestel (tikjes, slepen over de rand).
2. EAS production-build Android (+ iOS) zodra operator "build" zegt.
3. Na de build testen (staat in `docs/TEST_LOG.md`, sectie echte build): vergrendelscherm-tekst + V-icoon, haperen op vergrendelscherm, Boost-stemcue, auth-deeplink (51), offline (52), paywall offline (42), batterijmelding, tikjes, echte hartslagmeting.
4. Licentietester-aankooptests 48, 49, 63, 64.

---

- 10 okt 2026: aanbevolen duur één bron (`personalRecommendedMinutes` in utils/breath-level.ts) op alle plekken; techniek-infoblad herbouwd als gegroepeerde kaarten (tests 88–89). Flow-audit Set goal + Set plan gedaan: vrije minuten niet meer afgerond, onboarding/protocol zelfde techniek+niveauregel, setup-labels op persoonlijke aanbeveling, bracelet-set-day elke minuut (tests 90–92). Vervolg (operator akkoord): Ongoing rolt door (utils/plan-roll.ts), herinneringen op datum in de laatste 7 dagen, Remove plan in beide agenda's (components/ConfirmCard.tsx), kalenderknop op State Control, bracelet-aanpassingen gelden voor elke dag vanaf vandaag (tests 93–96).

- 10 okt 2026: duur-greep op beide cirkels vloeiend — greep op de UI-thread, veer bij loslaten (DIAL_SPRING 380 ms, geen overschot); State Control deelt de waarde via DialProgressContext (test 97).

- 10 okt 2026: PulseMeter in drie lagen — ring, hartlijn, hart (donkere onderlaag onder het glazen hart) (test 98).

- 10 okt 2026 avond: volledige flowtest breathwork + State Control op de A16 (test 109). Gefixt: done/partial-regel (utils/plan-status.ts), Engelse datums, intro reset enkel bij tabwissel, opslaan plan → agenda, geminimaliseerde sessie toont eigen modus, 'No more sessions today', Activity State Control eerst. Open voor operator: mini-pill over paginatitel, gekleurde tekst in Your protocol/sessietitel, rusthartslag pas bewaard na witte knop, add-session-ring oude stijl, bracelet-actieblad zonder Missed/Edit duration, weekgrafiek start zondag.

- 10 okt 2026 avond (vervolg, operator akkoord 1–6): pillen gedockt, witte tekst, Save/Measure Again + bewaarvraag, dunne ring Add session, actieblad State Control gelijk aan breathwork, week vanaf maandag, State Control-kop "The Power to Shift. From Your Wrist." (tests 110–116).

- 11 okt 2026: State Control trilsterkte Soft/Medium/Strong (services/haptic-strength-pref.ts) en kortere minima 5/5/5/10/10 na onderzoek (Science §3.7, CLAUDE.md §5). Tests 123–124 open.

- 12 okt 2026: A-tot-Z-audit (docs/AUDIT_2026-10-12.md), ronde 1 punt 1–5 gebouwd (operator "doe 1 tot 5"): privacy/camera-copy in welzijnstaal (legal-content, withPulseCamera → **nieuwe build**), State Control monitor-eerst + bracelet best-effort + iOS-herstel, Breathwork "End current session?" + Instant angst → Physiological Sigh, Audio één toegangsregel (needsPreview), lokale gegevens wissen bij Delete account (services/local-data.ts) + Clear Heart Rate Data. Tests 126–133. Volgende: ronde 2 (P1) uit het auditdocument.

- 12 okt 2026: audit ronde 2 (operator "nu dit aanpakken"): streak-regel overal (utils/streak.ts), End-bevestiging, titel State Control, trial-einddatum in Profile, Breathwork-pil met tijd, Try Again in player, zoeken voor iedereen, "This week"-kaart (components/ThisWeekCard.tsx), "How do you feel now?" (components/FeelCheck.tsx, utils/feel-checkin.ts). Tests 134–142. Open: crash reporting (Sentry-account operator), Apple Health/Health Connect + widgets/Siri (native, nieuwe build).

- 12 okt 2026: crash reporting via Sentry (EU-regio, org ulgar-bilican, project react-native), src/services/crash-reporting.ts. **Nieuwe build nodig.** Source maps uploaden staat uit (SENTRY_DISABLE_AUTO_UPLOAD in eas.json) tot er een SENTRY_AUTH_TOKEN als EAS-secret is. Eén trilsterkte app-breed; soundscapes horizontaal per groep.

- 12 okt 2026: Apple Health / Health Connect (services/health-sync.ts, components/HealthSyncSetting.tsx): sessies ≥ 1 min als mindful minutes, rusthartslag van het horloge lezen (resting-pulse bron 'health'), privacyverklaring + Limited Use-zin, rationale-scherm via state-haptics (launchAction/OnNewIntent). Pakketten react-native-health-connect 4.1.3, @kingstinct/react-native-healthkit 16.1, react-native-nitro-modules. minSdk 26 (Android 8+). **Nieuwe build nodig.** Operator: Google Play-formulier gezondheidsgegevens + Data safety, App Store-privacylabel "Health & Fitness". Tests 147–151.

- 12 okt 2026 (avond): horloge — de golf is nu exact het pad van de telefoon (LiquidWave: vier kubische S-bochten; de oude sinus golfde ~3,5× hoger), en tijdens een sessie staat het sessiescherm boven het vergrendelscherm (setShowWhenLocked/setTurnScreenOn). Wear-APK gebouwd, nog te installeren zodra het horloge bereikbaar is. Volgende: breathwork-figuren op het horloge.

- 13 okt 2026: breathwork op het horloge — ademfiguur van de app (zon/bloem/lotus/kristal/boom) zonder cirkel, halve boog bovenaan als fase-aftelling, "Inhale · Nose", tik op figuur = pauze. Trilling blijft bij donker scherm (MEDIA/ALARM i.p.v. TOUCH). Ritme: telefoon (breath-session.tsx) én horloges plannen elke fase vanaf het geplande einde van de vorige (geen oplopende drift meer); telefoon stuurt sentAtMs mee, horloge trekt de Bluetooth-vertraging af. **Native wijziging wear-breath-module → nieuwe telefoonbuild nodig** (ook voor via). Apple Watch: zelfde ritme-fix + via, nog geen figuren; niet compileerbaar op Windows.

- 13 okt 2026 (middag): horloge zelfstandig, stap 1 — services/watch-catalog.ts zet een catalogus op het horloge (Data Layer, /vibezcore/catalog); horloge: startscherm (Again + Breathe-lijst), BreathSetupActivity (duur via rand/−/+, Start), lokale sessies pauzeren/hervatten op het horloge, in de geschiedenis via /vibezcore/watchlog. Breathwork-sterkte als echte kracht (BREATH_AMP). Mediamelding van State Control/Breath op de telefoon setLocalOnly (geen Samsung-mediabediening op het horloge). Native → telefoonbuild geïnstalleerd op de A16. Volgende: State Control op het horloge zelf (stap 2), Apple Watch.

- 13 okt 2026 (avond): horloge-flow vastgelegd met de operator — 1) startscherm = per toestand één pagina met enkel grote ademende figuur + naam, de pagina gloeit in de toestandskleur, verticaal bladeren klikt per toestand vast; 2) tik = StateActivity (techniek Recommended/Last used, duur, witte Start — de enige start); 3) sessie. "Again" en V-merk van het startscherm gehaald. Tests W35–W37.

- 13 okt 2026 (laat): State Control met horloge, gemeten en opgelost — (1) Wear OS zet onze wakelock op DISABLED met scherm uit → het horloge geeft nu een compact trilpatroon (opbouw + herhalende slag, eindsignaal apart) aan de trilmotor, geen tik-per-tik meer; (2) synchronisatie: startmoment op de klok vlak voor het plannen, te late start wegknippen, eerste tik op het rooster van de telefoon, telefoon-anker = moment van echte trilling (+160 ms), bijgesteld op gevoel (WATCH_CLOCK_AHEAD_MS 20) — operator: "nu lijkt het goed"; (3) hartslaggeluid speelt de telefoon (module stuurde sound nooit door); (4) timer horloge rondt af zoals de telefoon. **Native wijziging wear-breath → nieuwe telefoonbuild nodig.** Meetlogs: VZSync (horloge), [sync] (telefoon, enkel dev). Tests T155–T162.

- 14 okt 2026: bracelet-opkuis (bracelet = Early 2027): welkom/Profile-activatielinks weg, tandwiel State Control weg, teksten Settings/meldingen/herinnering zonder bracelet, oude pagina's smart-bead-bracelet/bracelet-preview/coming verwijderd, "Welcome back Warrior"-pop-up weg. About/FAQ/Privacy herschreven (voorstel goedgekeurd: "herschrijf en ik zie wel"). Horloge: startscherm State Control/Breathwork met app-symbolen, State Control zelf starten op het horloge, Recent-rij, labels grijs + toestandsnaam in kleur. Bibliotheek: Soundscapes & Affirmations schermbreed bij abonnement.

- 14 okt 2026 (namiddag): horloge-sync gemeten i.p.v. gegokt (tijd 20 / tik apart 60 ms, motor ~190 ms), Smartwatch-schakelaar getest (T170/T171), hartslag-cirkel één doorlopende lub-dub-curve, buitenring = drukgolf (Skia), hartslaggeluid gesplitst in lub/dub zodat geluid = beeld bij elk tempo (native → **nieuwe telefoonbuild nodig**), horloge-sessiescherm met PAUSED bovenaan en meer lucht. Tests T172–T177. Volgende: operator-gevoel tik horloge + geluid/beeld bevestigen; horloge-Breathwork met scherm uit nog te testen.

- 14 okt 2026 (17:45): ritme telefoon = horloge — de telefoon rekent cirkel en drukgolf uit vanaf het geplande slagmoment (vaste klok, zoals het horloge); operator: "nu lijkt het goed" (T178). Horloge-ring = vorige versie (drukgolf op het horloge teruggedraaid). Nog: nieuwe telefoonbuild voor de Play Store (gesplitst hartslaggeluid is native).

- 14 okt 2026 (avond): smartwatch A-tot-Z-audit afgewerkt — trilling met scherm uit (T182), telefoon neemt over als het horloge wegvalt, horloge-sessies sturen de telefoon niet, premium/gratis-slot op het horloge, geen dubbele geschiedenis, pauze op de pols, opruimwerk (geluid, ongebruikte bestanden, logs enkel in testversie), iPhone-Smartwatch-regel, FAQ, versienummer + docs/WEAR_RELEASE.md. Tests T183–T189. **Nieuwe telefoonbuild nodig** (native). Operator: Wear OS-form factor + upload in de Play Console.

- 15 okt 2026: iOS-build (TestFlight) — Apple-profielen vernieuwd (interactieve login, sms-code); build 15 en 16 faalden op "Configure Xcode project": Watch-target heette ook "VIBEZCORE" en Live Activity "VIBEZCORE Live" (spatie) → nu VIBEZCOREWatch / VIBEZCORELive (T192), build 17 loopt (`--auto-submit`). Horloge: END = 0,8 s vasthouden (een losse aanraking stopte een sessie, T190), Galaxy + Apple Watch; Wear-debug-APK gebouwd, installeren na de lopende testsessie. Geschiedenis leeg = horloge niet verbonden met de telefoon (T191).
- 18 okt 2026: Audio Library v2 (T269, 39 bestanden luider/zachter enkel via versterking, nieuwe Bunny-map, speler wijst ernaar), oude reeks-foto's volledig weg (T270, ook iPhone-lockscreen), welkomstpillen zonder rand (T271). Volgende: na A16-check de iPhone-build (T264–T271).
- 18 okt 2026 (middag): iOS build 24 (T264–T278) en build 25 (T279–T287, o.a. BeatEngine, achtergrondaudio State Control, stem v4, audio blijft spelen bij een sessie, preview zonder vegen/agenda, geminimaliseerde sessie in de cirkel) gebouwd en op TestFlight gezet. BeatEngine compileerde zonder fouten. Volgende: operator test build 25 (sync tik/klank/cirkel, vergrendelen, stem); daarna Android-build met dezelfde ronde.
- 18 okt 2026 (avond): Sign in with Apple-intrekking (App Review 5.1.1(v)) gebouwd — backend `netlify/lib/apple-siwa.js` + auth-proxy + delete-account (live), app stuurt authorizationCode (vanaf build 29). Apple-sleutel "VIBEZCORE Sign in with Apple": **Key ID 3VS353U3RM**, Team 88AL3UW7L7, client com.ubili.vibezcoreapp. Het .p8-bestand NOOIT in git — enkel als Netlify-variabele `APPLE_SIWA_PRIVATE_KEY`. Nog te doen door operator: .p8 in Netlify + redeploy, SQL `supabase/migrations/20261018000001_apple_tokens.sql` in de SQL Editor, Site URL. Backend-veiligheid: delete-account/cancel-subscription controleren het token nu bij Supabase (live getest).

- 25 okt 2026: keuzepagina's State Control + Breath tonen de tabbalk (Premium zonder terugpijl, Free houdt Back naar het intro), Start-knop op dezelfde hoogte als Breathwork, Quick-iconen boven de knop zonder naam; State Control-onboarding volgens de huisstijl (geen zijwaartse paginaschuif, zachte pop, gekozen icoon wit op de toestandsring, rustig einde: effen dek onder "All set!" + fade naar de keuzepagina). Testtooling: deeplinks met `&` moeten gequote (`'…'`), `qa?fresh=1` wist ook de gratis-sessievlaggen. **Besluit operator (ja): GEEN inlogmuur vooraf (gast-first blijft); eerst Backup & Sync bouwen, daarna een zachte account-uitnodiging na de eerste afgeronde gratis sessie (e-mail/Apple/Google, "Later" altijd zichtbaar) en bij koop/herstel; e-mail voor win-back enkel met toestemmingsvink.** Open: Breathwork-onboarding naast de huisstijl leggen, Free/Premium-screenshots van alle gewijzigde pagina's na elke wijziging, schone (niet-QA) build op de telefoon.

- 25 okt 2026 (avond): algemene uitleg vóór het welkomstscherm (src/app/intro.tsx, eenmalig via `appIntroSeenAt`, 5 schermen, operator-teksten in kop/subkop/body, foto's per onderdeel op volle breedte met gemeten verhouding), Restore zonder account biedt het gratis account aan (subscribe.tsx). Operator: is ok. Open: kleine schermen/grote tekst voor intro controleren, zin "nervous system" blijft operator-keuze (projectregel zegt toestand-taal), scherm 4 subkop/body-splitsing, Breathwork-onboarding naast de huisstijl leggen, schone (niet-QA) build op de telefoon, account-uitnodiging na het bouwen van een plan = pas met plannen-sync (eerst akkoord op één nieuwe Supabase-tabel).

## 4. Wacht op de operator (niet zelf beslissen)

- Title Case voor alle knoppen (inventaris gemaakt, niet goedgekeurd).
- Welkomstschermen enkel de eerste keer (replay via Settings).
- Bunny pull zone `vibezcore-account` + Wix-CNAME `account` → `vibezcore-account.b-cdn.net` (nodig voor wachtwoord-reset-mails vanuit Gmail/Outlook). Operator-actie.
- Wachtwoordbeheerder + 2FA op telefoon (noodplan).

---

## 4b. To do (goedgekeurd door de operator, nog te bouwen)

- ✅ GEBOUWD 17 okt (T263) — **iPhone zonder Apple Watch — eenmalige melding bij de eerste sessie** (17 okt 2026, operator: "neem op in to do"). Apple laat geen trilling toe op een vergrendelde iPhone; zonder horloge valt de trilling weg zodra je zelf vergrendelt (scherm blijft wel aan tijdens de sessie; Live Activity + geluid bij Haptic + Audio lopen door). Voorstel: korte melding, enkel iPhone, enkel zonder Apple Watch, enkel de eerste keer: "Keep your screen on to feel the rhythm. Locking it? Choose Haptic + Audio to keep hearing it." met knoppen **Haptic + Audio** en **Got it**. Tekst = [OPERATOR] beslist de definitieve woorden.
- ✅ GEBOUWD 17 okt (T262) — **Set your plan (Activity → State Control): duur via de cirkel i.p.v. het draaiwiel** — half af: `DurationDial` (export uit bracelet-control.tsx, zelfde cirkel als State Control, enkel duur-greep) bestaat maar staat nog niet in bracelet-set-day.tsx. Operator zei "stop even" (17 okt).
- **Free + dagplan → voorproef van 30 s** gebouwd (T256, `965e26a`), nog te testen op de A16.
- **Luidheid audiobestanden** (ademstem + Library −19…−21 LUFS) normaliseren naar −16 LUFS — wacht op "ja" + Bunny-upload.
- **Play Store-stand (nagekeken 17 okt):** laatste Android-productiebuild = 2 okt 2026, versiecode 98, commit `3733f99` (1 okt). Alles van daarna (dagpas, nieuwe onboarding, horloge, …) staat nog NIET in de winkel.

---

## 5. Backlog (niet nu bouwen tenzij operator het vraagt)

Zie geheugen: day-pass (€0,90/24u), trial-end-melding, Adaptive State Engine, Connected Devices-teaser, horloge fase 3, ademduur per ervaring, release-vloeiendheid meten op release-APK.

---

## 6. Snel verder werken (dev)

- Telefoon: Samsung Galaxy A16, draadloze ADB (`adb devices` → `adb-…_adb-tls-connect._tcp`). Pairing-/connect-poort wijzigen elke keer.
- `npx expo start --dev-client --port 8081`; bundel opwarmen met
  `curl -s -o NUL "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false"`.
- Na Reanimated-wijzigingen: `adb shell am force-stop com.ubili.vibezcoreapp` + herstart (Fast Refresh mengt animaties).
- Typecheck: `npx tsc --noEmit -p .` (moet leeg zijn). `npx eslint src --quiet` heeft 37 bestaande fouten — niet nieuw toevoegen.

## Testronde Android 102 — stand 19 okt 2026 (avond)

Gebouwd: Android 102 (interne test) + iOS 58 (TestFlight); Galaxy Watch-bundel 26101917 in Wear OS-interne test (Wear OS-vormfactor toegevoegd).
Getest ✅: Day Pass, upgrade Monthly, account e-mail aanmaken/inloggen/verwijderen, Restore (T320–T322).

In code, nog NIET gebouwd (gepusht): 1 zaklamp, 3/4 proef-haptiek Strong + hele slagen, 5 symbolen gecentreerd, 6 Ujjayi-stem, 9 Not Now → Breathwork, 15 State Control-plan start, Monthly→Yearly Android, 17 Sign In or Create Account, 18 volledig e-mail, 19 invite-tekst, 20/21 geen Health + FAQ, 24 onboarding-regels + kleine schermen, hartslagkeuze ook via melding.
Bezig: 25 bevestigingsmoment (ring + vinkje + ping; denkende ring bij plan maken) — agent.
Goedgekeurd, nog te bouwen: 16 overal vooraf "Start 30-Second Preview" (+10 Instant Sessions), 22 Day Pass-kaart na 1 min rondkijken (max 1×/7 d, 3× totaal), 23 win-back (einddatum + Welcome back-kaart).
Beslist door operator (19 okt avond): 11 voorproef State Control = "Audio & Haptics" net BOVEN de enige knop "End Preview", geen pauze; 12 meer marge onder de juridische links (akkoord); 13 nooit een dubbele saleskaart bij Terug (akkoord); 14 GEWIJZIGD: speelt de audiobibliotheek, dan start een ademsessie/State Control ZONDER stem/hartslaggeluid (haptiek + beeld), de bibliotheek speelt door; andersom (bibliotheek starten tijdens een sessie) mag. 2: gezien in de voorproef (DurationRing-glans) — ook echte sessie nakijken.
Open: 2 buitenste ring Boost (oorzaak: rand in afgeknipte view + Android elevation-gloed; vraag: voorproef of echte sessie?), 7 Galaxy Watch-installatie nagaan, Play-winkelvermelding (teksten docs/PLAY_STORE_TEKSTEN.md, functieafbeelding store-screenshots/play), screenshots-selectie (1 welkom 0699, 3 ademsessie 0736 vast), privacyverklaring website zonder Health.
Regel: pas bouwen als de operator "klaar" zegt; één build per platform.

Update 19 okt (laat): ALLES van de testronde staat in de code en is gepusht — 11–14, ring Boost, 16 (+10), 22 Day Pass-kaart (na 60 s actief rondkijken, max 1×/7 d, 3× totaal), 23 win-back (einddatum op plankaart + eenmalige Welcome Back), 24 onboarding-regels, 25 bevestigingsmoment + ping, Bio-Teal app-icoon overal, transparante tabbalk + schermvullende foto's + app op donker, State Control-onboarding reset bij uitloggen, State Control stap-1 knop matglas + "Not Now".
Volgende stap: op "bouwen" van de operator → één build iOS + Android, en de Galaxy Watch-bundel opnieuw lokaal bouwen (nieuw icoon, nieuwe versiecode) → Wear OS-interne test. Play hi-res icoon store-screenshots/play/icon_512.png uploaden in de Play Console.
Na de build volledig hertesten (zie de testpunten van 22/23/24/25 en de transparante tabbalk: gezichten op de foto's, minispeler, minimaliseerbalk, Android-knoppen licht).

Gebouwd 19 okt 23u (commit 45997b0): iOS 59 → TestFlight ingediend; Android 103 (Downloads/vibezcore-103.aab, operator uploadt in Interne tests — EAS-serviceaccount mist releaserecht); Galaxy Watch 26101923 → Wear OS-interne test gepubliceerd. Volgende: volledige hertest op toestel.

## Flowtest-ronde 20 okt 2026 (avond) — fixes uit de screenshots

Gevonden in de emulator-flowtests (4 profielen) en in code gezet, nog te bevestigen op echte toestellen (Test Lab):
- Pijler 01 ("Psychological Resilience") in de Audio Library was zwart op elk profiel: eigen hoge absolute afbeelding → nu de standaard pijlerbeeldstijl (`(tabs)/index.tsx`).
- Tabbalk: pagina-tekst scheen door de balk (Profile, Activity, Library): `barDock` kreeg `zIndex`/`elevation` 50 (`(tabs)/_layout.tsx`).
- State Control-intro: knop "Explore State Control" onzichtbaar op Android (node wel aanwezig): BlurView uit de knop, doorschijnende laag + rand (`(tabs)/bracelet.tsx`).
- "Your Resting Heart Rate": titel raakte de Premium-pil, +28 pt ruimte.
- Flows: 01/06 tik op tab herhaalt bij geen verandering; 06 doet geen `back` meer na het inlogformulier (dat klapt inline open, `back` verliet de tab).
Volgende: ARM-release bouwen en `scripts/testlab.sh` (5 echte toestellen) draaien; daarna emulator-matrix opnieuw met x86-build.

Test Lab (5 echte toestellen, 20 okt 21:05, build b0b39d8+34a8550): alle 5 geslaagd (0 crashes). Gecontroleerd op ~195 screenshots; bevestigd goed: pijler 01-beeld, State Control-knop, Resting Heart Rate-titel. Nieuw gevonden en gefixt (nog te bevestigen):
- Welkomstfoto op Android ~2x ingezoomd (alleen gezicht van de man): `Animated.Image` → `Image` in `Animated.View` (`welcome.tsx`).
- Tekst van de pagina scheen nog door de tabbalk (6%): vlak naar 0.985 (`(tabs)/_layout.tsx`).
- Sessielaag (CALM CONTROL · Box Breathing) bleef als strook onderaan zichtbaar over andere schermen op Android 10/3-knops navigatie: parkeert nu 240 pt buiten beeld (`BreathSessionHost.tsx`).
Open uit Test Lab-toegankelijkheid (Pixel 8a: 40 meldingen — 18 aanraakdoelen, 13 laag contrast, 1 + 4 + 4 labels): nog niet doorgenomen; o.a. "70 bpm"-pil en "Not now"-link zijn kleiner dan 48 dp, "Not Now" op de foto-intro heeft laag contrast.
Toegankelijkheid (Test Lab Pixel 8a, 40 meldingen) — aangepast, nog te bevestigen: aanraakdoelen 48 dp voor de "70 bpm"-pil (zichtbaar 30), "Done" in Audio & Haptics (bracelet-control + breath-session) en "Not now" in de paywall; laag contrast: 56 gedimde tekstkleuren (alpha ≤0.44) naar 0.55 (o.a. legal, plan, subscribe, feel-now), "Not Now" op de foto-intro 0.85 met schaduw. Nog open: iconen zonder accessibilityLabel (4+4+1 meldingen) en de overige kleine aanraakdoelen (paginabolletjes, chevrons) — niet automatisch te vinden zonder de lijst per scherm.

21 okt 2026 (nacht): tabbalk-vlak `barFill` nu volledig dekkend `#0a0a0a` (was 0.985; in de emulator-screenshot van 20 okt scheen "Settings"/"Invite a friend" nog door). Nog NIET op toestel/emulator bevestigd: de emulator liep vast door een te zwaar belaste computer (1,3 GB vrij RAM, "System UI isn't responding"; alle Maestro-flows faalden op de driver, niet op de app), en Test Lab geeft TEST_QUOTA_EXCEEDED tot middernacht Pacific (~09:00 Belgische tijd). ARM-release (arm64-v8a + armeabi-v7a, 01:37) is gebouwd met deze wijziging.
Volgende: na ~09:00 `bash scripts/testlab.sh` (5 echte toestellen) draaien en de tabbalk op Profile/Activity/Library controleren; daarna emulator-matrix met genoeg vrij RAM (>4 GB).


## 21 okt 2026 — responsive audit (zijsessie)
- Lijst + voortgang per scherm: `docs/RESPONSIVE_AUDIT.md` (vinkje pas na screenshot op 360×640 / 411×914 / 430×932).
- Gedaan: Breath intro + 5 toestanden, instelscherm scrolt op korte schermen, sessiebeeld schaalt met hoogte, boog-gloed niet afgesneden, State Control-dial hoogte-bewust, protocol-bouwer stappen 1/3/5 (iconen, CTA-ruimte, vaste knop op "Choose your path"), tabnaam past op smalle schermen, Library-bracelet-kaart.
- Volgende: Account, Activity, Instellingen, Agenda, betaalschermen, player; daarna Firebase Test Lab (meerdere toestellen) en iOS-controle op echt toestel.
- Emulator = alleen layout; animaties/blur/haptiek enkel op A16/iPhone beoordelen.


## 22 okt 2026, ochtend — stand na de nachtronde (zijsessie)
- Alles gepusht op `rollback-vc76-take2`. Op de A16 staat de nieuwste release-build (arm64, met alle fixes; geen testschakelaar).
- Bevindingen en fixes: `docs/BEVINDINGEN.md`. Procedure: `docs/KWALITEITSPROCEDURE.md`. Jouw testlijst: `docs/CONTROLELIJST_OPERATOR.md`. Per-scherm voortgang: `docs/RESPONSIVE_AUDIT.md`.
- Testgereedschap: `scripts/screen-matrix.sh`, `flow-matrix.sh`, `walk.sh`, `scrollshots.sh`. Testschakelaar toegangsniveau (`/test-tier?tier=free|day|monthly|yearly`) werkt alleen in een build met EXPO_PUBLIC_VZ_TEST=1.
- Lokale build met nieuwe foto's: zie KWALITEITSPROCEDURE §6.
- Nog te doen: A16-test van de protocolbouwer (Level/Routine/Times), animaties, geluid, haptiek; iOS-pass; tabletbeleid is al gezet (telefoonvenster op Android).

- 22 okt 2026 (avond): glazen CTA's overal (doorschijnend wit/toestandskleur, glans bovenin, lichtbron onderin binnen de knop, via CTA_GLOW/CTA_GLASS/stateGlass in theme.ts); aankoopbevestigingen = PurchaseConfirm-kaart; tab-iconen dun + bounce; horloge: 30 s-voorproef in wear-app/. Open: Breath-balk 35 dp marge (balk = CTA-breedte) nog op toestel te zien; horloge opnieuw koppelen (handtekening debug vs Play); Monthly-weergave na dagpas; logo op glas.

- 23 okt 2026: `docs/UI_EN_BEWEGINGSREGELS.md` aangemaakt (bindend; verwezen vanuit CLAUDE.md §0 en de Blueprint). Bewegingstaal live: `constants/motion.ts`, `components/Tap.tsx` (~190 knoppen), `PopupCard.tsx`, springs voor sheets/onboarding, stoppen van lussen buiten beeld, hardware-textures. Open: shared element transitions (experimenteel, niet aan), horloge-verbinding (handtekening), logo-tegel.

- 26 okt 2026: intro stap 2–4 — tekstkaart zonder effen zwart vlak (zacht verloop, lager), stap 2 zonder subkop/pauzeknop (geen scroll), smartwatch groter met bandjes onder de behuizing + Calm Control-scherm (pauze/END), ademteller hoger, foto stap 1 zoomt sneller. Open: horloge rand raakt cirkel van de telefoon; nog te verfijnen.
