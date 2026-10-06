# VIBEZCORE — protocol telefoon ↔ smartwatch (Wear OS + Apple Watch)

Operator, 6 okt 2026: "ik heb iets nodig dat voor beide smartwatches werkt —
State Control-haptiek en breathwork. De haptiek van State Control is bedoeld
om via de pols te gaan."

## Principes

1. **Het horloge speelt het ritme zelf af.** De telefoon stuurt enkel wat er
   moet gebeuren (start / pauze / stop + parameters). Een Bluetooth-hapering
   of een slapende telefoon mag het ritme op de pols niet onderbreken — zelfde
   autonomie als de bracelet (spec §8).
2. **Pols met het scherm uit.** Het horloge blijft spelen met de pols omlaag:
   Wear OS via een foreground service + wake lock; Apple Watch via een
   `WKExtendedRuntimeSession` (sessietype voor ademsessies, max. 1 uur).
3. **Eén ritme tegelijk.** Zodra het horloge bevestigt dat het State Control
   speelt (`state-ack`), legt de telefoon zijn eigen trilling stil (de sessie,
   de timer en de melding op de telefoon lopen door). Breathwork: telefoon én
   horloge mogen allebei (operator: "voor breathwork wel haptics ook op
   telefoon, de haptics op smartwatches ook").
4. **Knoppen op het horloge** (Pause / Resume / Stop) sturen een `watch-action`
   naar de telefoon; de telefoon is de bron van waarheid en stuurt daarna zelf
   het juiste `state-*`-bericht terug.

## State Control — het ritme (identiek op telefoon, Wear OS en Apple Watch)

Bron van waarheid: `src/services/bracelet-haptics.ts` (`bpmAt`, `beatAt`,
`buildWaveform`). Elke horloge-implementatie MOET deze formule volgen:

```
RESTING_BPM      = 75
LUB_DUB_FRACTION = 0.3
LUB_DUB_MAX_MS   = 350
LUB_MS (amplitude) = 45, DUB_MS (amplitude) = 35

bpmAt(t):   t < holdSec              → 75
            anders progress = min(1, (t - holdSec) / rampSec)   (rampSec 0 → 1)
                     → 75 + (targetBpm - 75) * progress
beatAt(t):  cycleMs = round(60000 / bpmAt(t))
            dubAt   = round(min(cycleMs * 0.3, 350))
één slag:   lub (lubMs) · stilte (dubAt - lubMs) · dub (dubMs) · stilte (cycleMs - dubAt - dubMs)
t schuift per slag op met cycleMs/1000 s.
einde:      600 ms stilte, dan drie oplopende tikken: 70 ms, 120 ms stilte,
            90 ms, 120 ms stilte, 160 ms (sterkte 90 → 130 → 180 van 255).
```

`t` = curve-tijd in seconden. Bij start geeft de telefoon `curveOffsetSec`
mee (na hervatten binnen 2 min loopt de curve door i.p.v. opnieuw bij 75).

### Bericht `state-start` (telefoon → horloge)

```json
{
  "title": "Sharp Focus",          // modusnaam zoals in de app
  "colorHex": "#3E9BFF",           // kleur van de toestand
  "targetBpm": 90,
  "holdSec": 10,
  "rampSec": 10,
  "curveOffsetSec": 0,             // waar in de curve we beginnen
  "remainingSec": 900,             // resterende sessietijd vanaf ontvangst
  "lubAmp": 45, "dubAmp": 32,      // 0–255, Wear OS met amplitude-sturing
  "lubMsNoAmp": 50, "dubMsNoAmp": 40 // tikduur zonder amplitude-sturing
}
```

Ook gebruikt bij hervatten: gewoon een nieuwe `state-start` met de nieuwe
offset en resterende tijd (vervangt een lopende/gepauzeerde sessie).

### Bericht `state-pause` (telefoon → horloge)
Leeg. Horloge stopt de trilling, toont "Paused", houdt de sessie vast.

### Bericht `state-stop` (telefoon → horloge)
Leeg. Horloge stopt alles en ruimt op. Bij een NATUURLIJK einde stuurt de
telefoon geen stop: het horloge speelt zelf het eind-signaal na
`remainingSec` en stopt dan.

### Bericht `state-ack` (horloge → telefoon)
`{ "playing": true }` — zodra het horloge na een `state-start` echt speelt.

### Bericht `watch-action` (horloge → telefoon)
`{ "action": "pause" | "resume" | "stop", "kind": "bracelet" | "breath" }`
(`bracelet` = State Control, naam behouden voor compatibiliteit).

## Transport

| | Wear OS (MessageClient) | Apple Watch (WCSession) |
|---|---|---|
| state-start | path `/vibezcore/state/start`, body = JSON | message `type: "state_start"` + velden |
| state-pause | `/vibezcore/state/pause` | `type: "state_pause"` |
| state-stop | `/vibezcore/state/stop` | `type: "state_stop"` |
| state-ack | `/vibezcore/state/ack` (horloge → telefoon) | `type: "state_ack"` |
| watch-action | `/vibezcore/watch/action` (bestaat al) | `type: "watch_action"` (bestaat al) |

## Breathwork — één sessie, twee bedieningen (6 okt 2026)

Operator: "moet de gebruiker via beide kunnen stoppen en pauzeren?" — ja.
De telefoon is de bron van waarheid, zoals bij State Control.

| | Wear OS | Apple Watch |
|---|---|---|
| start (ook hervatten) | `/vibezcore/breath/start` | `type: "start"` |
| pauze | `/vibezcore/breath/pause` (leeg) | `type: "pause"` |
| stop | `/vibezcore/breath/stop` | `type: "stop"` |

`start` draagt de volledige sessie (fasen, rondes, modeName) plus, bij
hervatten, de plek: `startRound` (1-based), `startPhase` (index),
`phaseRemainingMs` (-1 of weglaten = vooraan, mét trilpatroon; anders
enkel de resterende tijd afwachten, de fase is al getrild).

- De telefoon stuurt `start` pas als de sessie echt loopt (een sessie die
  op Play wacht, gaat bij de eerste hervatting naar het horloge).
- Pauze op de telefoon → `pause`; hervatten → `start` met de plek.
- Horloge-knoppen Pause / Resume / Stop → `watch-action` met
  `kind: "breath"`. Pauze en stop past het horloge meteen ook zelf toe
  (de pols blijft niet tikken als de telefoon even weg is); hervatten kan
  enkel via de telefoon (die kent de plek).

## Telefoon-API (JS, `modules/wear-breath` en `modules/watch-breath`)

```ts
sendStateSession(start: StateSessionStart): void
pauseStateSession(): void
stopStateSession(): void
onStateAck(cb: () => void): () => void     // event 'onStateAck'
onWatchAction(cb)                           // bestaat al
```
