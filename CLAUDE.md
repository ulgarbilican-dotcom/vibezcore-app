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
  **Uitzondering (operator, 10 september 2026): "binaural beats" als audio-
  techniek/feature is toegestaan** — de vier verboden termen hierboven
  blijven verboden voor de MARKETING-/uitleg-taal errond (dus wel "binaural
  beats", nooit "synchroniseert je hersengolven" om uit te leggen waarom).
  Geldt enkel voor deze ene, expliciet goedgekeurde term — geen algemene
  versoepeling van deze regel. Nieuwe features rond biometrie/AI (rPPG,
  stress-inschatting e.d.) blijven onder de volledige regel vallen: enkel
  welzijnstaal ("welzijnsscore", "energie-tracking"), nooit een diagnose-
  of meet-claim ("we meten je hartslag/HRV om stress te diagnosticeren") —
  zie ook Apple's "Inaccurate Health Measurements"-richtlijn.
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
  Kickstarter Fall 2026 (operator-update 2026-07-14: sep-datum gedropt,
  geen concrete datum meer — communicatie: "Launching Fall 2026").

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
- **Reeds ingelogd** → ZIET HET WELKOMSTSCHERM OOK. Gewijzigd 7 augustus
  2026 (operator): "Stop Drifting" is het merkbeeld waarmee de app opent en
  dat hoort iedereen te zien. Vervangt de oude regel "welkomstscherm
  overslaan". Enige uitzondering: een openstaande auth-deeplink — anders
  slokt welcome het verify-scherm op.

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

**GEWIJZIGD 22 september 2026 (operator): Rest & Reset heet voortaan
Sleep** ("SLEEP" in hoofdletter-contexten) — duidelijker voor de
gebruiker. Enkel de naam wijzigt; index (Delta = 4), kleur en
duur/default blijven zoals hieronder.

**GEWIJZIGD 22 september 2026 (operator, vervolg): Clarity heet voortaan
Clarity & Relax** ("CLARITY & RELAX" in hoofdletter-contexten) — zelfde
methodiek als de Sleep-hernoeming hierboven. Enkel de naam wijzigt; index
(Theta = 3), kleur en duur/default blijven zoals hieronder.

| Idx | Intern | App-naam (voorlopig) | Kleur | Duur (min – max) | Default |
|-----|--------|----------------------|-------|-------------------|---------|
| 0 | Gamma | Boost | Amber #F5A524 | 8 – 20 min | 10 min |
| 1 | Beta | Sharp Focus | Blauw #3E9BFF | 15 – 30 min | 15 min |
| 2 | Alpha | Calm Control | Violet #B478FF | 15 – 30 min | 20 min |
| 3 | Theta | Clarity & Relax | Wit #FFFFFF | 20 – 45 min | 25 min |
| 4 | Delta | Sleep | Bio-Teal #00A3A3 | 30 – 50 min | 30 min |

**GEWIJZIGD 16 september 2026 (operator, officiële hardware-spec-tabel
Haptic_Bracelet_Spec_v2_3): duur-ranges + defaults bijgewerkt** — was
"default = min" voor alle modi (8–15/15–30/15–30/15–30/25–45); nu heeft
elke modus een eigen default die niet per se het minimum is.

**GEWIJZIGD 16 september 2026 (vervolg, na online onderzoek naar
effectieve/optimale sessieduur per state): maximum-waardes verder
bijgesteld** — Boost 15→20 (powernap-onderzoek: optimaal venster
20-30 min), Sharp Focus 20→30 (attentie-onderzoek: 20-30 min voor
sustained-attention-effecten), Clarity 30→45 (meditatieve diepte bouwt
geleidelijk op), Rest & Reset 45→50 (NSDR-onderzoek ondersteunt zelfs
tot 60 min, 50 is een batterij-bewustere tussenstap voor overnight-
gebruik — check bij hardware/firmware of de batterij een volle sessie
op het maximum aankan voor dit verder omhoog gaat). Calm Control
ongewijzigd bevestigd (30 min max, weinig extra meerwaarde erboven).
Bron van waarheid: `services/ble-contract.ts`'s
`ModeMeta.defaultMinutes`/`minMinutes`/`maxMinutes`.

**GEWIJZIGD 5 augustus 2026 (operator): de bracelet draagt nu DEZELFDE
kleuren als de vijf ademtoestanden.** Reden: het wordt één product. Wie van
een ademsessie naar een bracelet-sessie gaat ziet dezelfde toestand, en die
hoort niet halverwege van kleur te wisselen.

Vervangt de vorige tabel (wit / oranje / blauw / paars / sage). De bron van
waarheid is `src/data/breath-states.ts`; `services/ble-contract.ts` volgt
die. Wijzigt een kleur daar, dan hoort deze tabel mee te veranderen.

**GEWIJZIGD 11 september 2026 (operator: "groen te neonachtig, wat is een
moderne groen"): Rest & Reset van limoen #96CB56 naar salie/smaragd
#5FA777.** Tweede bijstelling van deze kleur (eerder al van #8FD94A naar
#96CB56 getemperd, 8 augustus) — deze keer een echte overstap naar een
andere, meer gedempte groenfamilie i.p.v. dezelfde lime verder afzwakken.

**GEWIJZIGD 14 september 2026 (operator: "te oudbollig"): Rest & Reset van
salie/smaragd #5FA777 naar jade/smaragd #20B486.** Derde bijstelling — het
salie bleek te gebroken/gedempt (las als khaki), nu een helderder, koeler
jade binnen dezelfde groenfamilie.

**GEWIJZIGD 16 september 2026 (operator: "het groen is echt lelijk, gebruik
het groen van WhatsApp"): Rest & Reset van jade/smaragd #20B486 naar
WhatsApp-groen #25D366.** Vierde bijstelling — herkenbare, gangbare groentint
i.p.v. de zelfgekozen jade-tint.

**GEWIJZIGD 5 oktober 2026 (operator: "maak van dat groen ons groen — het
accentgroen van VIBEZCORE"): Sleep van WhatsApp-groen #25D366 naar Bio-Teal
#00A3A3** (theme.ts `AudioAccent`; gradient loopt uit in #4AF0D4). Geldt voor
ademsessie én bracelet (breath-states.ts → ble-contract.ts).

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

> GEWIJZIGD 26 september 2026 (operator): de kleurregel hieronder beschreef
> `#3a8fff` als algemeen accent — dat was fout en is herhaaldelijk gecorrigeerd
> in de app zelf. Bron van waarheid is voortaan `src/constants/theme.ts`, niet
> deze samenvatting of de webapp-extractie waar hij ooit uit kwam.

- **Font:** Inter (gewichten 400/500/600/700/800/900). Native: `@expo-google-fonts/inter`.
- **Theme:** DARK is de default (sinds 26 september 2026, was licht). App heeft
  ook een lichte variant (`BrandLight`), maar opent standaard in dark.
- **Kleuren (rol-gesplitst, exact — zie theme.ts):** achtergrond `#0a0a0a`
  (dark) / `#F5F5F7` (light) · Signal Blue `#3a8fff` UITSLUITEND voor
  haptic-pulsen/"nu actief" in de player, nooit CTA/tekst/vlakken
  (GEWIJZIGD 6 oktober 2026, operator: de pulsringen rond de cirkel in een
  lopende State Control-sessie in de app krijgen de kleur van de TOESTAND;
  Signal Blue blijft voor de haptics op bracelet-foto's, website en
  marketingbeelden) · Royal
  Indigo `#6E85C4` (op dark) / `#1E2A4A` (op light) voor accent-tekst/labels,
  nooit knoppen · Bio-Teal `#00A3A3`/`#4AF0D4` als accent BINNEN Audio Library
  (player, mini-player, library-schermen) — nog niet app-breed · succes
  `#4ade80`/`#16a34a` · fout `#ef4444`/`#dc2626` · paneel `#1e1e1e`/`#ffffff` ·
  rand `#2a2a2a`/`#e5e5ea` · tekst primair `#f4f4f4`/`#1D1D1F` · tekst gedimd
  `#8a8a8a`/`#8E8E93`. CTA-knop-chrome (v4.4) is een aparte rol: donkere
  achtergrond → witte knop + donkere tekst; lichte achtergrond → zwarte/
  Royal-Indigo knop + witte tekst — CTA-achtergrond is nooit de accentkleur.
- **Logo:** `vibezcore_wordmark.png` (schermkoppen, vervangt platte tekst) en
  `vibezcore_icon.png` (app-icoon). Zitten in de projectkennis.
- **Look & feel:** dark (default), hoog contrast, witte tekst, strak, royale
  spacing, grote vette koppen (Inter 800/900). Tekst wordt niet standaard
  over foto's geplaatst (Content-Card-regel: tekst onder de foto, los op de
  pagina-achtergrond) — een klein zacht label mag nog als subtiele scrim op
  de foto.
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
