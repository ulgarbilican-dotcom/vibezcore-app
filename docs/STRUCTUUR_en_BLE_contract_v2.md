# VIBEZCORE — App-structuur & BLE-contract (HERZIEN — op spec v2.3)

> Versie 2 van dit kaderdocument. Vervangt de vorige versie volledig.
> De vorige versie bevatte een door Claude verzonnen BLE-contract — dat was FOUT.
> **Haptic_Bracelet_Spec_v2.3 is nu leidend** voor alles wat de bracelet betreft.
>
> Dit document is NIET bindend (operator-instructie). Het volgt spec v2.3 trouw,
> maar sectie 9 bevat Claude's eerlijke observaties over fouten/verbeteringen in
> de spec zelf. Operator beslist; dit is meedenken, geen voorschrift.
>
> TEKSTEN: marketing-/modusbeschrijvingen worden door operator gefinaliseerd.
> Alles wat operator nog moet herzien is gemarkeerd met [TEKST — OPERATOR].
>
> ── WIJZIGING 19 mei 2026 (operator) ─────────────────────────────────
> Er komt een NIET-BLOKKEREND welkomstscherm als eerste scherm (zie
> sectie 0 hieronder). Dit vervangt de oude regel "gast-first, geen
> poort, opent direct in vrije inhoud" → wordt: "gast-first MET een
> niet-blokkerend welkomstscherm". Waar oude tekst en sectie 0
> verschillen, geldt SECTIE 0.
> ─────────────────────────────────────────────────────────────────────

---

## 0. APP-ENTREE — welkomstscherm (LEIDEND, 19 mei 2026)

Eerste scherm = welkomstscherm. NIET-blokkerend, GEEN poort, GEEN
keuzescherm. Opbouw: full-screen foto (`assets/welcome_bg.png`) +
VIBEZCORE-wordmark + intro-tekst (definitief, operator-goedgekeurd:
"Stop being a passenger in your own life. Change the game. Unlock your
full potential.") + 2 gelijkwaardige knoppen ("Explore Bracelet" →
Bracelet-tab, "Explore Audio Library (listen free sessions)" →
Audio-tab) + ondergeschikte regel "Already have a product? Sign in".

Flows:
- Gast/nieuw → welkomstscherm → knop → app in, ALLE tabs vrij.
- Klant met account (niet ingelogd) → Sign in → backend-entitlements
  ontgrendelen automatisch wat hij bezit.
- Bracelet-koper zonder account → account + activatiecode → ontgrendelt.
- Reeds ingelogd → welkomstscherm overslaan → direct de app in.

Harde regel: de app vraagt NOOIT "wat bezit je". Inloggen of
activatiecode bepaalt het (consistent met entitlements-model).
De 3 tabs (Audio · Bracelet · Account) blijven ongewijzigd en
gelijkwaardig; het welkomstscherm zit ervóór in de root-navigatie.

---

---

## 1. Vastgestelde uitgangspunten (door operator beslist)

1. Gast-first, geen poort. App opent direct in vrije content. Vrij rondkijken zonder account.
2. Audio én bracelet beide kern. "Audio first" = audio is *eerder verkoopbaar*, niet belangrijker.
3. Structuur = optie 3: audio grootste content-deel; bracelet volwaardige eigen sectie. 3 tabs.
4. Bracelet-app volledig af "alsof het bestaat".
5. Simulatielaag achter exact het BLE-contract; één config-flag → echt. Pro-aanpak: simulatie bootst spec v2.3 EXACT na.
6. Firmware bouwen operator + Claude samen, op ditzelfde contract.
7. 3 gebruikerstypes via entitlements + activatiecodes (apart ontwerpdoc; blokkeert audio niet).
8. Provider-agnostisch (app praat alleen met eigen backend).
9. Kickstarter: Fall 2026.
10. Wetenschapscommunicatie: app = toestand-taal, geen hersengolf-claims. Operator finaliseert teksten.

---

## 2. Geverifieerde technische basis

**Hardware (uit bom.csv + fysieke PCB-foto's, in productie):**
- U1 nRF52832 (BLE SoC) — firmware + GATT-server
- U2 DRV2605L (haptic driver, I²C 0x5A, LRA+RTP-mode)
- U3 MCP73832 (Li-Po lader, STAT-pin = charging-detectie)
- U5 AP2112K-3.3 LDO · Y1 32MHz · Y2 32.768kHz (RTC, sessie-timers) · D4 RGB-LED
- Geen fuel-gauge: batterij% via nRF52832 SAADC op batterijspanning
- Programmeerinterface: 4-pads groep zichtbaar op PCB-achterkant (vermoedelijk SWD;
  exacte pinout samen vast te stellen in firmware-fase — geen header, soldeer/pogo nodig)

**Backend (projectbestanden, ONGEWIJZIGD):** Supabase Auth + public.users + public.subscriptions; endpoints /api/audio-url, /api/subscription-status; token via /auth/v1/token → vz_session_token.

---

## 3. De 5 modi — DEFINITIEF (operator-besluit)

> Operator heeft bepaald dat de WOORDLABELS uit spec v2.3 §11.1 correct zijn en
> de EMOJI's in spec v2.3 de fout zijn. Kleuren hieronder zijn leidend.
> [TEKST — OPERATOR] namen zijn voorlopig, operator finaliseert later.

| Index | Intern (spec) | App-naam (voorlopig) | Kleur | Doel (spec) |
|-------|---------------|----------------------|-------|-------------|
| 0 | Gamma | **Boost** | Rood | Maximale alertheid / piekfocus |
| 1 | Beta | **Sharp Focus** | Oranje | Langdurige actieve focus |
| 2 | Alpha | **Calm Control** | Blauw | Ontspannen geconcentreerd / flow |
| 3 | Theta | **Clarity** | Paars | Diepe ontspanning / loslaten |
| 4 | Delta | **Rest & Reset** | Groen | Overgang naar slaap / diepe rust |

Kleur-hex: Claude kiest passende tinten binnen het dark theme (#0a0a0a), later fijn af te stemmen.
De app toont GEEN technische parameters (PPS, burst_ms, amplitude, RTP) — spec §11.5.

---

## 4. Schermstructuur (navigatie-skelet)

```
APP (opent direct — geen poort, geen login-muur)
│
├── TAB 1 — AUDIO  (grootste content-sectie)
│     ├── Library: alle sessies zichtbaar voor iedereen
│     │     ├── gratis sessies → direct speelbaar (gast OK)
│     │     └── betaalde sessies → zichtbaar, slot, upgrade-trigger
│     ├── Player (achtergrond/lockscreen later)
│     └── Upgrade-trigger
│
├── TAB 2 — BRACELET  (volwaardige eigen sectie)
│     ├── ETALAGE (gast / niet-geactiveerd):
│     │     ├── 7-stappen marketingverhaal  [TEKST — OPERATOR finaliseert]
│     │     ├── Kickstarter: Fall 2026
│     │     └── "Register your bracelet" → nette "beschikbaar na Kickstarter"-staat
│     └── BEDIENING (geactiveerd):
│           ├── Verbinden / status (Connected · batterij%)
│           ├── Modus kiezen (5 modi §3)
│           ├── Duur kiezen (slider, per modus begrensd §6, default = minimum)
│           ├── Sessie-scherm (resterende tijd · modus · BLE-status · batterij · STOP)
│           └── Draait achter BLE-contract §5 — sim (nu) of echt (later)
│
├── TAB 3 — ACCOUNT
│     ├── Niet ingelogd: Sign in / Create account (optioneel, geen muur)
│     ├── Ingelogd: e-mail, abonnement, entitlements
│     ├── Bracelet activeren (code)
│     └── Legal/info  [disclaimer-tekst uit webapp — operator finaliseert]
```

Gast ziet alles. Na login: zelfde structuur, sloten/triggers passen zich aan op entitlements
(zelfde-indeling-andere-sloten — eenvoudig, bewezen in webapp). Conditionele her-indeling per
type = latere aparte beslissing, NIET nu gebouwd.

---

## 5. HET BLE-CONTRACT (LETTERLIJK uit spec v2.3 §8 — bindend voor sim én firmware)

### 5.1 Command — App → Bracelet (spec §8.1)

```c
typedef struct {
    uint8_t mode;       // 0=Gamma 1=Beta 2=Alpha 3=Theta 4=Delta
    uint8_t duration;   // minuten — firmware clampt automatisch
    uint8_t command;    // 0x01=start  0x02=stop  0x03=status_request
} ble_command_t;
```

### 5.2 Status — Bracelet → App (spec §8.2)

```c
typedef struct {
    uint8_t session_active;     // 0 / 1
    uint8_t current_mode;       // 0–4
    uint8_t remaining_minutes;  // resterende sessieduur
    uint8_t battery_percent;    // 0–100
    uint8_t charging;           // 0=niet  1=laden
    uint8_t fault;              // 0=OK  1=DRV2605L fault
} ble_status_t;
```

### 5.3 Interactiemodel (spec §8.3, §11.4) — cruciaal

- App stuurt één commando (mode + duration + START). Bracelet draait daarna
  **autonoom op hardware-timers**. BLE-verbindingsverlies stopt de sessie NIET.
- App **pollt elke 5 sec** CMD_STATUS → toont remaining/mode/battery/BLE-status.
- Sessie eindigt bij: timer afgelopen · charging · battery <5% · fault · CMD_STOP.
- App past GEEN realtime parameters aan tijdens een sessie.

### 5.4 GATT-laag (NIET in spec — Claude-voorstel, zie §9 obs. 4)

Spec v2.3 definieert de structs maar niet de concrete service/characteristic-UUIDs.
Voorstel (operator/firmware kan wijzigen — niet bindend):
```
Service        6E40FB00-B5A3-F393-E0A9-E50E24DCCA9E
Command  (W)   6E40FB01-…   payload = ble_command_t (3 bytes)
Status   (R/N) 6E40FB02-…   payload = ble_status_t (6 bytes)
```
Eén characteristic voor status (hele struct) i.p.v. losse — simpeler, matcht spec-polling.

### 5.5 Sim ↔ echt

`services/ble.ts` één interface (`connect/sendCommand/onStatus/disconnect`).
Daarachter nu `SimulatedBracelet` (spec-getrouw, zie §7), later `RealBracelet`
(react-native-ble-plx, zelfde UUIDs/structs). Schakelaar: `USE_SIMULATED_BLE`.
UI/app-logica veranderen NIET bij omschakeling.

---

## 6. Sessieduur per modus (spec v2.3 §11.2 — exact)

| Modus | Min (=default) | Max (app) | Firmware safety-max |
|-------|----------------|-----------|---------------------|
| Boost (Gamma)        | 8 min  | 15 min | 15 min |
| Sharp Focus (Beta)   | 15 min | 30 min | 30 min |
| Calm Control (Alpha) | 15 min | 30 min | 30 min |
| Clarity (Theta)      | 15 min | 30 min | 30 min |
| Rest & Reset (Delta) | 25 min | 45 min | 45 min |

Slider begrensd per modus; default = minimum. Firmware clampt sowieso (spec §7.1, §9 regel 7).

---

## 7. Pro-simulatie — wat SimulatedBracelet exact nabootst (spec-getrouw)

Operator koos de pro-aanpak. De simulatie gedraagt zich als de echte firmware:

1. **CMD_START**: duration clampen naar [min,max] van de modus (§6). Sessie start.
2. **Autonoom aflopen**: interne timer telt remaining_minutes af, onafhankelijk van UI.
3. **Status-polling**: elke 5 sec levert sim een volledige ble_status_t.
4. **Batterij**: zakt geleidelijk tijdens sessie (realistisch tempo, demonstreerbaar).
5. **Low battery <20%**: sim zet intern amplitude-indicatie −20% (spec §3B/§9 regel 5);
   app toont alleen batterij% (geen amplitude — §11.5), gedrag blijft consistent.
6. **Critical <5%**: sessie eindigt automatisch, motor-uit-status (spec §9 regel 3).
7. **Charging**: indien "charging" → sessie stopt direct (spec §9 regel 2).
8. **Fault**: simuleerbaar (test) → fault=1, sessie eindigt (spec §9 regel 4).
9. **CMD_STOP**: sessie eindigt netjes, EVT_SESSION_COMPLETE-equivalent.
10. **Ongeldige mode >4 / rare duration**: genegeerd resp. geclamped (spec §9 regel 6/7).

Niet getoond aan gebruiker (spec §11.5): PPS, burst_ms, interval_ms, amplitude%, RTP.
Die leven alleen intern (relevant voor echte firmware, niet voor UI).

---

## 8. Bouwvolgorde (na akkoord op dit document)

1. 3-tab navigatie-skelet (Audio/Bracelet/Account), VIBEZCORE dark theme.
2. Bracelet-etalage volledig (7-staps verhaal [TEKST—OPERATOR], KS Fall 2026).
3. Bracelet-bediening + SimulatedBracelet achter §5-contract, spec-getrouw (§7).
4. Audio-library placeholder + bestaande auth.ts ingehaakt.
Daarna: audio-content, activatie/entitlements-backend. Firmware = parallel, zelfde contract.

---

## 9. CLAUDE'S EERLIJKE OBSERVATIES OVER SPEC v2.3 (operator vroeg om mee te denken)

> Dit zijn observaties/vragen, geen voorschriften. De spec is sterk en professioneel;
> dit is bedoeld om operator te beschermen tegen latere problemen.

**Obs. 1 — Kleur-inconsistentie IN de spec (opgelost door operator).**
§11.1 woordlabels (Gamma=rood…) spreken de emoji's (Gamma=🟣…) tegen. Operator
heeft beslist: woordlabels correct, emoji's fout. Vastgelegd in §3. ✔ opgelost.

**Obs. 2 — Conceptuele vs. effectieve PPS.** Spec noemt Gamma "30–40 PPS" terwijl
effectief ~3.1 Hz. Spec verklaart dit zelf (burst-overlap-perceptie). Legitieme
ontwerpkeuze, geen fout — maar het is een claim die onderbouwd moet kunnen worden
als een technische investeerder/criticus doorvraagt. Bewustzijnspunt, geen blokkade.
Voor de app irrelevant (PPS wordt niet getoond, §11.5).

**Obs. 3 — Batterij% zonder fuel-gauge.** Spec erkent zelf: Li-Po spanning→% is
niet-lineair, percentage is een schatting via ADC. Prima voor sim; voor echte
firmware betekent het dat battery_percent een benadering is. Communiceer richting
gebruikers/investeerders niet als exact. Bewustzijnspunt.

**Obs. 4 — GATT-UUIDs ontbreken in spec.** Spec definieert structs/gedrag maar niet
de concrete BLE service/characteristic-UUIDs. Geen fout (dat is firmware-detail),
maar app en firmware moeten dezelfde kiezen. Voorstel in §5.4 — vrij te wijzigen
zolang sim en firmware identiek blijven.

**Obs. 5 — Wetenschapscommunicatie (juridisch/reputatie).** Spec kiest §1.2 correct
voor "bottom-up state modulation", expliciet NIET "brainwave entrainment". Dit is
juridisch verstandig. Advies: hou die discipline in ALLE communicatie (app,
marketing, Kickstarter, investeerders). App = toestand-taal; wetenschap alleen waar
nuance kan, met "geïnspireerd op", nooit "klinisch bewezen"/"verandert hersengolven".
De productcategorie heeft een beperkte/gemengde evidentiebasis — voorzichtige taal
is niet alleen juridisch slim maar ook eerlijk en op termijn de beste bescherming.
Operator finaliseert teksten zelf; deze lijn staat hier als kader.

**Obs. 6 — Minor: spec noemt bij charger-detectie "TP4056 of gelijkwaardig", maar de
BOM heeft MCP73832 (U3).** Functioneel gelijkwaardig (STAT-pin via GPIO), maar de
firmware moet MCP73832-gedrag volgen, niet TP4056. Klein, maar vastleggen voor de
firmware-fase zodat er geen verkeerde aanname insluipt.

---

## 10. Openstaand (operator — blokkeert deze bouwronde NIET)

- 6 entitlement/activatie-vragen uit toegangsmodel-ontwerpdoc.
- Definitieve modus-namen + marketing-/modusteksten (operator finaliseert).
- Exacte kleur-hex fijnafstemming.
- DRV2605L effect-sequenties per modus (firmware-fase, samen).
- SWD-pinout op PCB (firmware-fase, samen vaststellen).
- GATT-UUID's definitief (§5.4 voorstel, bij firmware-fase bevestigen).
- iOS in-app-purchase vs externe checkout (Fase F / stores).
