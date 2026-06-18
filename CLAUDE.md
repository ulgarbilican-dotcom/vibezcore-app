# CLAUDE.md — VIBEZCORE Native App

> Dit bestand wordt automatisch gelezen door Claude Code bij elke sessie.
> Het bevat de BINDENDE projectregels. De volledige context staat in `docs/`.
> Bij twijfel: lees `docs/VIBEZCORE_APP_VOLLEDIGE_SPEC.md` (de complete specificatie).
>
> WIJZIGING 19 mei 2026 (operator): er KOMT een niet-blokkerend
> welkomstscherm als eerste scherm. Dit vervangt de oude regel "geen
> welkomstscherm / opent direct in Audio-tab". Zie §3 "Gast-first principe".
> Reden: Audio en Bracelet moeten gelijkwaardig aanvoelen; de bezoeker
> mag niet op één van de twee "binnenkomen".

---

## 0. EERST LEZEN — verplichte context

Bij start van werk aan dit project, lees in deze volgorde:
1. Dit bestand (CLAUDE.md) — de harde regels.
2. `docs/VIBEZCORE_APP_VOLLEDIGE_SPEC.md` — volledige app-specificatie (architectuur, elk scherm, huidige staat).
3. `docs/MERK_ANKER.md` — font, kleuren, logo, look-and-feel (bindend voor alles wat uiterlijk is).
4. `docs/STRUCTUUR_en_BLE_contract_v2.md` — structuur + BLE-contract (spec v2.3).
5. `docs/ONTWERP_toegangsmodel.md` — toegangsmodel, entitlements, provider-abstractie.

`Haptic_Bracelet_Spec_v2_3.docx` is het BINDENDE hardware/BLE-contract (zit in de
projectkennis, niet in deze repo). Verzin nooit een eigen BLE-contract — een eerder
verzonnen contract was fout en is volledig vervangen.

---

## 1. HARDE REGELS — nooit overtreden

- **NOOIT `npm audit fix --force` draaien.** Dit breekt het project. 4 moderate
  vulnerabilities zijn normaal voor Expo — negeren, niet "oplossen".
- **VIBEZCORE altijd in HOOFDLETTERS**, ook in lopende tekst, overal.
- **Teksten gemarkeerd met `[OPERATOR]` of `[TEKST]` NOOIT zelf invullen of
  finaliseren.** Dat is een operator-beslissing. Laat de markering staan.
- **Geen wetenschaps-/medische claims.** App gebruikt uitsluitend toestand-taal
  (focus / kalmte / rust). NOOIT "hersengolven", "synchroniseert",
  "klinisch bewezen", "brainwave entrainment". Alleen "geïnspireerd op" waar nuance kan.
- **Provider-agnostisch.** De app praat NOOIT rechtstreeks met Gumroad of Stripe —
  alleen met de eigen backend (`https://app.vibezcore.com/api/...`). Provider-logica
  hoort niet in de app.
- **Backend en webapp NIET wijzigen.** De native app is een nieuwe client op de
  bestaande backend (Supabase + bestaande endpoints). De bestaande webapp (HTML,
  Gumroad, Bunny CDN) blijft ongewijzigd. De native app vervangt die niet en
  wijzigt de backend niet.
- **Geen autonome grote wijzigingen.** Toon wijzigingen en wacht op goedkeuring.
  Werkwijze tot nu toe: operator beoordeelt elke wijziging.

---

## 2. GEVOELIG — index.tsx (spec §8.3)

Er bestaan twee bestanden die op elkaar lijken. Verwar ze NIET:

- `src/app/index.tsx`  — oude Expo-demo, op gelijke hoogte met `explore.tsx`,
  direct in `app/`. **MOET WEG.**
- `src/app/(tabs)/index.tsx` — ingesprongen ONDER `(tabs)`, bevat
  `AudioScreen()`. **MOET BLIJVEN.**
- `src/app/explore.tsx` — oude Expo-demo. **MOET WEG.**

Verificatie welke index.tsx weg moet: het tabblad/pad toont `…\app\index.tsx`
(met `\app`, NIET `\(tabs)`) → dat is degene die weg moet.
Bij twijfel: NIET verwijderen, eerst aan operator vragen.

---

## 3. PRODUCT — wat de app is

Cross-platform (iOS + Android), React Native + Expo (SDK 55, Expo Router, dev
build — geen Expo Go). Twee gelijkwaardige productkernen:
- **Audio-bibliotheek** — gestructureerde psychologische audiosessies.
- **Smart Bead Bracelet** — haptisch hardware-product (nRF52832 + DRV2605L),
  Kickstarter 1 september 2026.

"Audio first" = audio is *eerder verkoopbaar* (backend + content bestaan al),
NIET belangrijker. Beide zijn kern.

### Gast-first principe (welkomstscherm, GEEN poort)
[GEWIJZIGD 19 mei 2026 — operator-beslissing. Vervangt de oude regel
"geen welkomstscherm".]

Er IS een welkomstscherm als eerste scherm, MAAR het is GEEN poort en
GEEN keuzescherm — het blokkeert niemand en dwingt geen keuze af.

Welkomstscherm (eerste scherm, vóór de tabs):
- Full-screen achtergrondfoto (`assets/welcome_bg.png`).
- VIBEZCORE-wordmark.
- Intro-tekst (operator-goedgekeurd, definitief, NIET wijzigen):
  "Stop being a passenger in your own life. Change the game.
  Unlock your full potential."
- Twee gelijkwaardige knoppen — bewust even prominent want Audio en
  Bracelet zijn gelijkwaardige productkernen (SPEC §1.1):
  · "Explore Bracelet" → Bracelet-tab
  · "Explore Audio Library (listen free sessions)" → Audio-tab
- Ondergeschikte regel (kleiner, niet even zwaar als de 2 knoppen):
  "Already have a product? Sign in" → Account-tab/login.
- Knop-/regelteksten exact zoals hier; overige copy = [OPERATOR].
- De achtergrondfoto is operator-aangeleverd; tot definitief een nette
  placeholder in MERK_ANKER-stijl.

Flow per gebruiker:
- **Gast / nieuw (niet ingelogd)** → welkomstscherm → via een knop de
  app in → ALLE tabs vrij toegankelijk (gast-first blijft: alles zien,
  gratis sessies luisteren, hele bracelet-sectie + preview bekijken).
- **Klant mét account (niet ingelogd op dit toestel)** → "Already have
  a product? Sign in" → login → backend levert entitlements → app
  ontgrendelt AUTOMATISCH wat hij bezit. De app VRAAGT NOOIT "wat bezit
  je" — inloggen/code bepaalt het (entitlements-model).
- **Bracelet-koper zonder account** → account maken + activatiecode
  (QR + leesbare terugvalcode) → code bepaalt pakket (bracelet of
  bracelet+audio) → ontgrendelt automatisch.
- **Reeds ingelogd** → welkomstscherm OVERSLAAN → direct de app in.

NOOIT een keuzescherm "wat ben jij / wat heb je". Bezit wordt door
inloggen of activatiecode bepaald, niet aan de gebruiker gevraagd.
Account is UITSLUITEND nodig voor volledige audio-bibliotheek of
bracelet-activatie — niet om rond te kijken.

### Navigatie: welkomstscherm + 3 tabs
Root `_layout.tsx` registreert: het welkomstscherm (eerste, headerless,
overgeslagen indien ingelogd), de `(tabs)`-groep, en los
`bracelet-control.tsx` (gepusht vanuit Bracelet-tab).
Tabs: `(tabs)/index.tsx` = Audio · `(tabs)/bracelet.tsx` = Bracelet
(etalage) · `(tabs)/account.tsx` = Account.

---

## 4. DE 4 PIJLERS (audio)

[GEWIJZIGD door operator — vervangt oude pijlers
"Strategic Wealth · Psychological Resilience · Social Mastery · Stoic Fortitude".
Bij verdere wijzigingen ook deze sectie + alle widgets bijwerken.]

1. **Psychological Resilience** — Build what cannot break.
2. **Inner Sovereignty** — Master what is yours.
3. **Social Mastery** — Command without force.
4. **Strategic Execution & Wealth** — Engineer your autonomy.

Volgorde en taglines zijn bindend en consistent over de hele webapp.

## 5. DE 5 BRACELET-MODI (namen voorlopig — [OPERATOR] finaliseert)

| Idx | Intern | App-naam (voorlopig) | Kleur | Duur (min=default – max) |
|-----|--------|----------------------|-------|--------------------------|
| 0 | Gamma | Boost | Wit #FFFFFF (was Rood #FF453A — operator 27 mei 2026: rood te agressief) | 8 – 15 min |
| 1 | Beta | Sharp Focus | Oranje #FF9F0A | 15 – 30 min |
| 2 | Alpha | Calm Control | Blauw #0A84FF | 15 – 30 min |
| 3 | Theta | Clarity | Paars #BF5AF2 | 15 – 30 min |
| 4 | Delta | Rest & Reset | Sage #4FA46B (was #30D158 — operator 27 mei 2026: te flashy) | 25 – 45 min |

App toont NOOIT technische parameters (PPS, burst_ms, amplitude, RTP) — spec §11.5.
Alleen modusnaam, duur, resterende tijd, batterij, status.

---

## 6. BLE-CONTRACT (spec v2.3 §8 — bindend voor sim én firmware)

**Command (App → Bracelet):** `{ mode:0-4, duration:min, command:0x01 start /
0x02 stop / 0x03 status_request }`

**Status (Bracelet → App):** `{ session_active, current_mode, remaining_minutes,
battery_percent, charging, fault }`

**Interactiemodel:** App stuurt één commando (mode+duration+START). Bracelet
draait daarna AUTONOOM op hardware-timers — BLE-verbindingsverlies stopt de
sessie NIET. App POLLT status elke 5 sec. Sessie eindigt bij: timer afgelopen ·
charging · battery <5% · fault · STOP. App past tijdens een sessie GEEN realtime
parameters aan.

**Sim ↔ echt:** `services/` bevat één `BraceletTransport`-interface. Nu
`SimulatedBracelet` (spec-getrouw), later `RealBracelet` (react-native-ble-plx,
zelfde interface/UUIDs). Schakelaar `USE_SIMULATED_BLE`. UI/app-logica
veranderen NIET bij omschakeling.

---

## 7. MERK / UITERLIJK (uit MERK_ANKER.md — bindend)

- **Font:** Inter (gewichten 400/500/600/700/800/900). Native: `@expo-google-fonts/inter`.
- **Kleuren (exact):** achtergrond `#0a0a0a` · accent `#3a8fff` · accent
  hover `#2a7fee` · succes `#4ade80` · fout `#ef4444` · paneel `#1e1e1e` ·
  rand `#2a2a2a` · tekst primair `#f4f4f4` · tekst gedimd ~`#8a8a8a`.
- **Logo:** `vibezcore_wordmark.png` (schermkoppen, vervangt platte tekst) en
  `vibezcore_icon.png` (app-icoon). Zitten in de projectkennis.
- **Look & feel:** dark, hoog contrast, witte tekst, strak, royale spacing,
  blauw spaarzaam als accent, grote vette koppen (Inter 800/900).
- Het MERK_ANKER gaat UITSLUITEND over uiterlijk. App-structuur, tab-indeling
  en schermteksten vallen daar buiten (operator-beslissing).

---

## 8. TOEGANGSMODEL (samengevat — detail in docs/ONTWERP_toegangsmodel.md)

Account en rechten zijn LOSGEKOPPELD (entitlements-model). Gast = alleen gratis.
Audio-only = betaling. Bracelet-only = activatiecode. Bracelet+Audio = code +
1 jaar audio. De entitlements/activatiecode-backend blokkeert het audio-spoor
NIET en wordt vóór de bracelet-fase gebouwd. 6 operator-beslissingen staan nog
open (sectie 7 van het ontwerpdoc) — niet zelf invullen.

---

## 9. WERKWIJZE

- Omgeving: Windows, projectpad `C:\Users\ulgar\vibezcore-app`, VS Code.
- Native module toevoegen → rebuild nodig (`npx expo run:android`).
- Git staat op (branch `master`); er is een snapshot-commit als vangnet.
- Bij elke twijfel over scope, teksten, of een onomkeerbare actie: STOP en vraag
  de operator. Liever een vraag te veel dan een verkeerde aanname.
