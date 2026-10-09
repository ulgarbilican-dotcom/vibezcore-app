# WERKSTATUS — waar staat het werk NU

> **Levend document.** Claude werkt dit bij na elke afgeronde wijziging,
> in dezelfde commit, en pusht meteen (operator, 9 okt 2026: "nieuwe Claude
> moet onmiddellijk kunnen zien wat wij aan het doen zijn en de build gewoon
> verderzetten zonder vragen"). Een nieuwe sessie leest dit als eerste na
> `CLAUDE.md`, daarna `git log -20`, `docs/TEST_LOG.md` en het geheugen.
>
> Laatst bijgewerkt: 9 oktober 2026 (avond).

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
- Free tiers: 10 gratis sessies; proef = 27 sessies + Breathwork + State Control; betaald = alles.
- Mini-player in de tabbalk gedokt; glazen bottom sheets met vast sluitprotocol (geheugen: `feedback-sheet-close-protocol.md`).
- Breathwork-onboarding: één keer, skip-bevestiging per stap, replay via Settings.
- Soundscapes: Rain en Canopy gratis, rest met kroon.
- Resting Heart Rate-pagina (eerste State Control-scherm) + meetscherm: hart dat zich vult, live bpm, hartlijn (ECG), foutschermen, batterijcontrole via `expo-battery` (**nieuwe native module → vereist nieuwe build**).
- State Control-scherm herontworpen: cirkel 270, tijd kiezen door over de rand te slepen (boog + greep), drie vaste tijden (kort/aanbevolen/lang, zie `threePresets` in `src/app/bracelet-control.tsx`), hartslag-pil bovenaan in de cirkel, Quick Chill/Boost-kaartjes, ronde paginapuntjes.
- "Your Resting Heart Rate"-pagina — **goedgekeurd door operator 9 okt ("heel mooi, professioneel")**: stilstaande groene glascirkel, groot dekkend glazen hart, hartlijn met echte monitorvorm (`src/utils/ecg-shape.ts`, afleiding II) die door een schrijfpuntje rechts wordt getekend en achter het hart doorloopt; hart klopt wanneer de piek erdoor gaat.
- Meetscherm: Touch ID-achtige vinger-animatie zolang de vinger niet ligt; meting exact 30 s. Live bpm-getal staat stil (geen meeklop, bijsturen hooguit 1 bpm per 1,5 s); hart en hartlijn kloppen op een regelmatige maat op dat getal. Eindresultaat via `robustPulse` (schuivende vensters van 8 s, enkel schone stukken, ≥ 12 s dekking, onderling eens) — 9 okt: twee mislukte metingen (verstoring eerste 14 s) gaven hiermee 79 en 76 bpm. Verstoorde stukken (sprong > 5× de gewone uitslag) worden overgeslagen, ook voor het live getal (geen fout 63 meer). Layout zoals de Resting Heart Rate-pagina: hartlijn over de volle breedte achter de ring (196) door, grote pieken. Na de meting: vinkje in de ring (lager geplaatst) + onderaan één knop die de volgende stap noemt (Start Session / Back to State Control / Continue to State Control / Back to Profile); enkel bij een veel lagere meting eerst het uitlegscherm. **Door operator te hertesten.**
- Hartslag-blad in State Control: "Resting heart rate / Heart rate now", Measure Now + Not Now.
- Centrale tikjes-helper `src/utils/haptics.ts` (Android-systeemtikken i.p.v. trilmotor) — **door operator nog te voelen op de A16**.

**Nog te doen in deze ronde:**
1. Operator test de laatste State Control-wijzigingen op het toestel (tikjes, slepen over de rand).
2. EAS production-build Android (+ iOS) zodra operator "build" zegt.
3. Na de build testen (staat in `docs/TEST_LOG.md`, sectie echte build): vergrendelscherm-tekst + V-icoon, haperen op vergrendelscherm, Boost-stemcue, auth-deeplink (51), offline (52), paywall offline (42), batterijmelding, tikjes, echte hartslagmeting.
4. Licentietester-aankooptests 48, 49, 63, 64.

---

## 4. Wacht op de operator (niet zelf beslissen)

- Title Case voor alle knoppen (inventaris gemaakt, niet goedgekeurd).
- Welkomstschermen enkel de eerste keer (replay via Settings).
- Bunny pull zone `vibezcore-account` + Wix-CNAME `account` → `vibezcore-account.b-cdn.net` (nodig voor wachtwoord-reset-mails vanuit Gmail/Outlook). Operator-actie.
- Wachtwoordbeheerder + 2FA op telefoon (noodplan).

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
