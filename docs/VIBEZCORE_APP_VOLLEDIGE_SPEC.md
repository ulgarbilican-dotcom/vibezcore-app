# VIBEZCORE NATIVE APP — VOLLEDIG GEDETAILLEERDE SPECIFICATIE

> Complete beschrijving van de app: architectuur, elk scherm, elke flow, elk
> technisch onderdeel, en de exacte huidige staat. Bedoeld als projectkennis
> zodat geen enkele context verloren gaat tussen chats.
> Datum opgesteld: 18 mei 2026.

---

# DEEL 1 — WAT DE APP IS

## 1.1 Product
VIBEZCORE native app: cross-platform (iOS + Android), gebouwd met React Native
+ Expo (SDK 55, Expo Router, dev build — geen Expo Go). Twee gelijkwaardige
productkernen:
- **Audio-bibliotheek**: gestructureerde psychologische audiosessies.
- **Smart Bead Bracelet**: haptisch hardware-product (nRF52832 + DRV2605L),
  Kickstarter 1 augustus 2026.

De native app is een NIEUWE CLIENT op de bestaande backend (Supabase + de
bestaande API-endpoints). De bestaande webapp (HTML, Gumroad, Bunny CDN) blijft
ongewijzigd draaien. De native app vervangt die niet en wijzigt de backend niet.

## 1.2 "Audio first" — exacte betekenis
Audio is *eerder verkoopbaar* omdat backend én content al bestaan. Het betekent
NIET dat audio belangrijker is dan de bracelet. Beide zijn kern. De bracelet-app
wordt volledig afgewerkt "alsof de hardware al bestaat".

## 1.3 Omgeving
- Windows. Projectpad: `C:\Users\ulgar\vibezcore-app`.
- Editor: VS Code. Metro draait in VS Code-terminal, poort **8082** (8081 bezet).
- Emulator: Pixel 8 (Android 15 / API 35).
- `npm audit fix --force` NOOIT draaien (breekt project). 4 moderate vulns =
  normaal voor Expo, negeren.
- Werkwijze: Claude levert bestanden → operator plakt via VS Code
  (open bestand, Ctrl+A, Delete, paste, Ctrl+S). Tab-indicator: ● = niet
  opgeslagen, × = opgeslagen. Statusbalk linksonder toont foutaantal.
  Native module toevoegen → `npx expo run:android` (rebuild).

---

# DEEL 2 — NAVIGATIE & GAST-FIRST PRINCIPE

## 2.1 App-opening
De app opent DIRECT in de vrije inhoud. GEEN welkomstscherm. GEEN login-poort.
GEEN sign-in gate. Iedereen (zonder account) kan:
- alle audiosessies zien,
- gratis sessies beluisteren,
- de volledige bracelet-sectie bekijken (etalage + preview van de bediening),
- de account-tab openen en optioneel inloggen/registreren.

Een account is UITSLUITEND nodig voor: (a) volledige audio-bibliotheek, of
(b) bracelet-activatie. Inloggen/registreren is een knop BINNEN de app.

## 2.2 Navigatiestructuur (Expo Router)
```
src/app/
├── _layout.tsx              ← root: Stack-navigator, dark theme, status bar
├── (tabs)/                  ← route-groep met de tab-balk
│   ├── _layout.tsx          ← Tabs-navigator: 3 tabs onderaan
│   ├── index.tsx            ← TAB 1: Audio
│   ├── bracelet.tsx         ← TAB 2: Bracelet (etalage)
│   └── account.tsx          ← TAB 3: Account
└── bracelet-control.tsx     ← Stack-scherm (gepusht vanuit Bracelet-tab)
```
- De root `_layout.tsx` registreert twee dingen: de `(tabs)`-groep
  (headerShown:false) en het losse `bracelet-control`-scherm (met header,
  titel "Bracelet", back-knop).
- `(tabs)/_layout.tsx` bouwt de tab-balk: 3 tabs met tekst-glyph iconen
  (♪ Audio, ◎ Bracelet, ○ Account), dark theme, witte actieve tab.
- De `(tabs)`-haakjes zijn Expo Router-syntax: de schermen erin delen één
  tab-balk, maar "(tabs)" verschijnt niet in de route.

---

# DEEL 3 — SCHERM VOOR SCHERM (gedetailleerd)

## 3.1 TAB 1 — AUDIO (`(tabs)/index.tsx`)
Functie-component: `AudioScreen()`.
HUIDIGE STAAT: placeholder. Toont:
- Titel "VIBEZCORE" (groot, letter-spacing).
- Subtitel "Audio Library".
- Een kaart: "Library coming in the next build" met uitleg dat de volledige
  bibliotheek (gratis sessies speelbaar zonder account, premium met
  unlock-prompt) de volgende code-ronde is.
- Een cursieve note die het gast-first principe herhaalt.
TOEKOMST (volgende ronde): echte sessielijst, audioplayer (achtergrond +
lockscreen), gratis vs betaald onderscheid met slot/upgrade-trigger, koppeling
met `/api/audio-url` (Bunny signed URLs) en `/api/subscription-status`.

## 3.2 TAB 2 — BRACELET (`(tabs)/bracelet.tsx`)
Functie-component: `BraceletScreen()`. Dit is de ETALAGE-modus.
Bevat, van boven naar beneden:
1. **Hero**: Kickstarter-badge "⚡ KICKSTARTER — 1 AUGUST 2026", titel
   "VIBEZCORE Smart Bead Bracelet", subtitel "5 haptic modes. One clear
   outcome. You in control of your own state."
2. **Preview-knop**: "Preview the bracelet app →" → pusht `bracelet-control`
   (de werkende bediening). Bewust zichtbaar voor iedereen om bezoekers te
   triggeren.
3. **7-staps verhaal** (letterlijk uit de webapp index.html, operator-goedgekeurd,
   gemarkeerd [OPERATOR] want operator finaliseert teksten):
   - 01 What is it — HapticCore, 15 Editions, 8mm Beads
   - 02 How it works — Haptic Pulses, 15–30 min, Nervous System
   - 03 The intelligence inside — Bluetooth 5.0, USB-C, VIBEZCORE App
   - 04 Materials & build — 8mm Gemstones, Handcrafted, Natural Stone
   - 05 Interchangeable — Snap System, 15 Editions, No Tools
   - 06 Made for you — 16–21 cm, Custom Fit, Your Choice
   - 07 Guide your state — State Guiding, Calm & Focus, 15–30 min
   Elke stap: nummer, kop, body-tekst met linker-accentrand, 3 tag-chips.
4. **Register-box**: "Register your bracelet" + uitleg dat registratie opent na
   de Kickstarter (1 aug 2026), met een uitgeschakelde knop "Available after
   Kickstarter launch". Geen externe link nu (veilig voor App Store-review).
5. Footnote [OPERATOR] dat marketing-copy nog gefinaliseerd wordt.

## 3.3 BRACELET-BEDIENING (`bracelet-control.tsx`) — pro-kern
Functie-component: `BraceletControl()`. Het echte product, nu volledig werkend
via simulatie. Gedrag:

**Verbindstaat**: bovenaan titel "Bracelet" + status ("Not connected" /
"Searching…" / "Connecting…" / "Connected").

**Niet verbonden**: knop "Connect bracelet" → `bracelet.connect()` doorloopt
scanning → connecting → connected (sim met realistische vertraging).

**Verbonden**:
- **Status-strip** (3 cellen): Battery (%, kleur: groen >20, oranje <20, rood
  <5), Connection ("Live"), State (Idle / Active / Charging / Fault).
- **Geen actieve sessie** → modus + duur kiezen:
  - 5 modus-kaarten (zie Deel 4). Tik selecteert; gekozen modus krijgt gekleurde
    rand + stip.
  - Duur-stepper (− / waarde / +), begrensd per modus (spec §11.2), default =
    minimum van de modus. Hint toont bereik, bv. "Rest & Reset: 25–45 min".
  - Knop "Start session" → stuurt BLE-commando {mode, duration, START}.
- **Actieve sessie** → sessie-scherm:
  - Modusnaam groot, "X min remaining", gekleurde modus-stip.
  - Knop "Stop session" → BLE-commando STOP.
  - Telt autonoom af (interne timer, niet UI-afhankelijk); status elke 5 sec.
- **Demo-controls** (alleen zichtbaar in simulatie, gestippelde box, duidelijk
  gelabeld "Demo controls (simulation only)"): knoppen "Low battery",
  "Charging", "Fault", "Reset demo state". Verdwijnen automatisch op echte
  hardware (getSimHooks() → null). Bedoeld om investeerders het veiligheids-
  gedrag live te tonen.

App toont NOOIT technische parameters (geen PPS, burst_ms, amplitude, RTP) —
spec §11.5. Alleen modusnaam, duur, resterende tijd, batterij, status.

## 3.4 TAB 3 — ACCOUNT (`(tabs)/account.tsx`)
Functie-component: `AccountScreen()`. Optioneel, geen muur.

**Niet ingelogd**: titel "VIBEZCORE", subtitel wisselt per modus
("Welcome back." bij login / "Create your account." bij signup), tekst dat
account optioneel is. Toggle Sign in / Create account. Velden: Email,
Password (met Show/Hide oog-toggle). Knop "Sign in"/"Create account".
Foutmelding inline. [OPERATOR]-markering voor Terms/Privacy-tekst.

**Ingelogd**: "Signed in as <email>". Kaarten: Subscription (status synct van
bestaande account; entitlements verschijnen later), Bracelet (activatie opent
na Kickstarter 1 aug 2026). Knop "Sign out". [OPERATOR]-markering voor
legal/disclaimer-tekst uit de webapp.

Login/signup gebruiken de bestaande `services/auth.ts` (ongewijzigd):
Supabase Auth, token opgeslagen in AsyncStorage als `vz_session_token` +
`vz_user_email`. Functies: `login`, `signup`, `getToken`, `getUserEmail`,
`clearSession`.

---

# DEEL 4 — DE 5 MODI (definitief besluit, namen voorlopig)

Operator-besluit: in spec v2.3 zijn de WOORDLABELS (§11.1) correct, de EMOJI's
in de spec zijn de fout. Kleuren hieronder zijn leidend. Namen zijn VOORLOPIG —
operator finaliseert later samen met alle teksten.

| Idx | Intern (spec) | App-naam (voorlopig) | Kleur  | Duur (min–max, default=min) |
|-----|---------------|----------------------|--------|------------------------------|
| 0   | Gamma         | Boost                | Rood   | 8 – 15 min                   |
| 1   | Beta          | Sharp Focus          | Oranje | 15 – 30 min                  |
| 2   | Alpha         | Calm Control         | Blauw  | 15 – 30 min                  |
| 3   | Theta         | Clarity              | Paars  | 15 – 30 min                  |
| 4   | Delta         | Rest & Reset         | Groen  | 25 – 45 min                  |

Korte user-facing omschrijving per modus (toestand-taal, GEEN hersengolf-claims):
- Boost: "Peak alertness and sharp concentration."
- Sharp Focus: "Clear, active attention — work mode."
- Calm Control: "Relaxed but focused — flow."
- Clarity: "Deep relaxation and letting go."
- Rest & Reset: "Deep rest and the transition to sleep."

Huidige hex-tinten in code (dark-theme, later fijn af te stemmen):
Boost #FF453A, Sharp Focus #FF9F0A, Calm Control #0A84FF, Clarity #BF5AF2,
Rest & Reset #30D158.

---

# DEEL 5 — BLE-CONTRACT & SIMULATIE (technisch)

## 5.1 Bron van waarheid
`Haptic_Bracelet_Spec_v2_3.docx` is het BINDENDE contract. Een eerder door
Claude verzonnen contract was fout en is volledig vervangen.

## 5.2 Command (App → Bracelet), spec §8.1
```c
ble_command_t {
  uint8_t mode;       // 0=Gamma 1=Beta 2=Alpha 3=Theta 4=Delta
  uint8_t duration;   // minuten — firmware clampt automatisch
  uint8_t command;    // 0x01=start 0x02=stop 0x03=status_request
}
```

## 5.3 Status (Bracelet → App), spec §8.2
```c
ble_status_t {
  uint8_t session_active;     // 0/1
  uint8_t current_mode;       // 0–4
  uint8_t remaining_minutes;
  uint8_t battery_percent;    // 0–100
  uint8_t charging;           // 0/1
  uint8_t fault;              // 0=OK 1=DRV2605L fault
}
```

## 5.4 Interactiemodel (spec §8.3 / §11.4)
- App stuurt één commando (mode + duration + START). Bracelet draait daarna
  AUTONOOM op hardware-timers. BLE-verbindingsverlies stopt de sessie NIET.
- App POLLT status elke 5 seconden.
- Sessie eindigt bij: timer afgelopen · charging · battery <5% · fault · STOP.
- App past tijdens een sessie GEEN realtime parameters aan.

## 5.5 Implementatie in code (`src/services/`)
- `ble-contract.ts`: enums/interfaces uit spec §8, `MODES`-array met UI-metadata,
  `clampDuration()`, `BraceletTransport`-interface (de enige interface die de
  app aanspreekt: connect, disconnect, sendCommand, requestStatus,
  onConnectionChange).
- `bracelet-sim.ts`: `SimulatedBracelet` implementeert `BraceletTransport`
  spec-getrouw: clamping, autonome timer, batterij-drain (sessie sneller dan
  idle, laden omhoog), low-battery <20% (intern amplitude −20%, niet getoond),
  critical <5% → sessie eindigt, charging → sessie stopt direct, fault → eindigt.
  Sim-only demo-hooks: simSetCharging, simTriggerFault, simSetBattery.
- `bracelet.ts`: de SCHAKELAAR. `USE_SIMULATED_BLE = true`. `getBracelet()`
  geeft de sim; `getSimHooks()` geeft de sim-hooks of null. Later:
  `RealBracelet` (react-native-ble-plx, zelfde interface/UUIDs) implementeren
  en de flag omzetten — UI en app-logica veranderen NIET.

## 5.6 GATT-UUID's (nog niet in spec — voorstel, vrij te wijzigen)
Service `6E40FB00-…`, Command (Write) `6E40FB01-…`, Status (Read/Notify)
`6E40FB02-…`. Eén status-characteristic met de hele struct. Sim en firmware
moeten identiek blijven; definitief bevestigen in firmware-fase.

---

# DEEL 6 — TOEGANGSMODEL & PROVIDER-ABSTRACTIE

## 6.1 Drie gebruikerstypes (+ gast)
| Type            | Account | Audio              | Bracelet | Via                |
|-----------------|---------|--------------------|----------|--------------------|
| Gast            | nee     | alleen gratis      | nee      | n.v.t.             |
| Audio-only      | ja      | volledige library  | nee      | betaling           |
| Bracelet-only   | ja      | alleen gratis      | ja       | activatiecode      |
| Bracelet+Audio  | ja      | volledige library, 1 jaar | ja | code + audio-recht |

## 6.2 Entitlements-model
Account en rechten zijn LOSGEKOPPELD. Account is "leeg" bij aanmaak; rechten
worden er daarna aan gehangen (audio-betaling of bracelet-activatiecode).
Voorgestelde backend-tabellen (nog te bouwen, blokkeert audio NIET):
`entitlements` (kind: audio/bracelet, source, valid_until) en
`activation_codes` (code, batch, grants_audio, audio_days, redeemed_by).

## 6.3 Activatiecodes (bracelet)
Twee niveaus van "uniek": (A) hardware-identiteit (nRF52 BLE-adres + serienr,
voor de technische verbinding) en (B) activatiecode (op verpakking /
Kickstarter-fulfilment, koppelt bracelet-recht aan account, los van
betaalprovider — ideaal voor Kickstarter).

## 6.4 Provider-abstractie (Gumroad → eventueel Stripe)
De app praat NOOIT rechtstreeks met Gumroad of Stripe — alleen met de eigen
backend (provider-neutraal antwoord). Alleen de backend weet of een recht van
Gumroad/Stripe/activatiecode komt. Latere Stripe-migratie raakt ALLEEN de
backend, niet de app of webapp-frontend. Welke provider beter is = zakelijke
keuze van operator (buiten dit technisch ontwerp).

---

# DEEL 7 — UITERLIJK / DESIGN-STAAT

Bewust nog basaal — eerst structuur, dan polijsten:
- Font: systeemfont (webapp gebruikt Inter — later toe te voegen, hele app
  ineens, geen herbouw).
- Kleuren: directe hex-waarden, dark theme #0a0a0a achtergrond, accent #3a8fff,
  5 modus-kleuren zoals Deel 4. Later centraal fijn af te stemmen.
- Logo: nu het woord "VIBEZCORE" als tekst. Het echte logo is een base64-PNG
  in de webapp `sign-in.html` — later in te voegen.
- Alle door operator te finaliseren teksten zijn in de code gemarkeerd met
  [OPERATOR] of [TEKST] zodat niets per ongeluk als definitief doorgaat.
Niets hiervan vereist herbouw om later aan te passen.

---

# DEEL 8 — EXACTE HUIDIGE STAAT

## 8.1 Werkt
- Dev build draait op Pixel 8 emulator. `Android Bundled (1589 modules)` zonder
  build-fout.
- Alle code geplaatst in het project en TypeScript-gevalideerd (0 echte
  projectfouten). De 3 "Problems" in VS Code betreffen een wegwerp-kopie in de
  Downloads-map (`2__src_app_...`), NIET het project — negeren of die
  Downloads-bestanden wissen.

## 8.2 Geplaatste bestanden (correct in project)
`src/services/`: auth.ts (bestond al), ble-contract.ts, bracelet-sim.ts,
bracelet.ts.
`src/app/`: _layout.tsx, bracelet-control.tsx, (tabs)/_layout.tsx,
(tabs)/index.tsx, (tabs)/bracelet.tsx, (tabs)/account.tsx.

## 8.3 ENIGE resterende blokkade + fix (directe volgende stap)
Er zijn twee oude Expo-demobestanden die de nieuwe structuur overschaduwen en
het oude sign-in scherm tonen:
- `src/app/index.tsx`  ← de NIET-ingesprongen (op gelijke hoogte met
  explore.tsx, direct in `app`). MOET WEG.
  (NIET `src/app/(tabs)/index.tsx` — die is ingesprongen ONDER (tabs),
   bevat AudioScreen(), en MOET BLIJVEN.)
- `src/app/explore.tsx`  ← oude Expo-demo. MOET WEG.

Verificatie welke index.tsx weg moet: één keer aanklikken; tabblad toont
`index.tsx …\app` (met `\app`, niet `\(tabs)`) → die verwijderen.

Na verwijderen: in de terminal `r` (reload) of `npx expo start --clear` → `a`.
Verwacht: app opent gast-first, geen sign-in scherm, 3 tabs onderaan
(Audio/Bracelet/Account).

## 8.4 Bijbehorende documenten (projectkennis)
- `ONTWERP_toegangsmodel.md` — toegangsmodel + activatiecodes + provider-abstractie.
- `STRUCTUUR_en_BLE_contract_v2.md` — structuur + BLE-contract op spec v2.3 +
  Claude's eerlijke observaties over de spec (kleur-inconsistentie; conceptuele
  vs effectieve PPS; batterij% via ADC zonder fuel-gauge; spec noemt TP4056
  maar BOM heeft MCP73832; wetenschapscommunicatie-discipline).
- `OVERDRACHT_nieuwe_chat.md` — beknopte overdracht.
- Dit document — volledige gedetailleerde specificatie.

---

# DEEL 9 — OPENSTAAND (operator; blokkeert het bouwen NIET)

- 6 entitlement/activatie-vragen uit ONTWERP_toegangsmodel.md.
- Definitieve modus-namen + alle marketing-/modusteksten (operator finaliseert).
- Echt logo + font (Inter) + kleur-fijnafstemming invoegen.
- Audio-content + player + gratis/betaald-logica (volgende code-ronde).
- Entitlements- + activation_codes-backend (vóór bracelet-fase).
- DRV2605L effect-sequenties per modus (firmware-fase, samen).
- SWD-flash-pinout op PCB (4-pads groep zichtbaar op PCB-achterkant; firmware-fase).
- GATT-UUID's definitief bevestigen (firmware-fase).
- iOS in-app-purchase vs externe checkout (Fase F / app stores) — Apple verbiedt
  externe checkout voor digitale abonnementen in-app; risico voor reviewproces.
- Webapp legal/disclaimer-tekst in native app plaatsen (Account-tab).

---

# DEEL 10 — WETENSCHAPSCOMMUNICATIE (juridisch/reputatie)

App = uitsluitend toestand-taal (focus/kalmte/rust). GEEN claims over
hersengolven, "synchroniseert", of "klinisch bewezen". Spec kiest §1.2 correct
voor "bottom-up somatosensorische state modulation", expliciet NIET
"brainwave entrainment". Deze discipline geldt voor ALLE communicatie (app,
marketing, Kickstarter, investeerders): wetenschappelijke inspiratie alleen
waar nuance kan, met "geïnspireerd op", nooit als bewezen medisch effect.
Operator finaliseert alle teksten zelf; codeteksten zijn [OPERATOR]-gemarkeerd.
