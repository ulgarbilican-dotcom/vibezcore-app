/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Simulated Bracelet (pro-approach, spec v2.3 faithful)

   Implements BraceletTransport behind the EXACT BLE contract. Behaves like
   the real firmware so the bracelet app is fully demonstrable now (investors,
   Kickstarter pre-launch). When real firmware exists, RealBracelet implements
   the same interface and USE_SIMULATED_BLE flips — UI unchanged.

   Spec-faithful behaviour (STRUCTUUR_en_BLE_contract_v2 §7):
     - CMD_START clamps duration to mode bounds (spec §7.1)
     - session runs autonomously on an internal timer (spec §8.3) — keeps
       running regardless of "connection"
     - battery drains gradually during a session
     - <20% low battery: internal amplitude -20% (spec §3B); app shows only
       battery% (no amplitude — spec §11.5)
     - <5% critical: session ends, motor off (spec §9 rule 3)
     - charging detected: session stops immediately (spec §9 rule 2)
     - fault: session ends, fault flag set (spec §9 rule 4)
     - invalid mode >4 ignored / bad duration clamped (spec §9 rule 6/7)
   ─────────────────────────────────────────────────────────────────────────── */

import {
    BleCommand,
    BleCommandPacket,
    BleConnectionState,
    BleStatusPacket,
    BraceletMode,
    BraceletTransport,
    clampDuration,
} from './ble-contract';

/* Sim tuning — purely how the demo "feels". Not part of the contract. */
const SIM = {
  /* Battery drops this many % per real minute while a session runs.
     Tuned so a demo visibly shows drain without being absurd. */
  drainPerMinute: 0.8,
  /* Idle self-discharge — negligible but non-zero, feels alive. */
  idleDrainPerMinute: 0.02,
  /* Start battery for a fresh sim device. */
  startBattery: 87,
};

export class SimulatedBracelet implements BraceletTransport {
  private conn: BleConnectionState = 'disconnected';
  private connCbs: ((s: BleConnectionState) => void)[] = [];

  /* Session state — mirrors what real firmware tracks internally. */
  private sessionActive = false;
  private currentMode: BraceletMode = BraceletMode.Alpha;
  private sessionEndsAt = 0; // epoch ms — autonomous timer (spec §8.3)
  private clampedDuration = 0; // minutes, after spec §7.1 clamp

  private battery = SIM.startBattery;
  private charging = false;
  private fault = false;
  private lastTick = Date.now();

  /* ── Connection ──────────────────────────────────────────────────────── */

  getConnectionState(): BleConnectionState {
    return this.conn;
  }

  private setConn(s: BleConnectionState) {
    this.conn = s;
    this.connCbs.forEach((cb) => cb(s));
  }

  onConnectionChange(cb: (s: BleConnectionState) => void): () => void {
    this.connCbs.push(cb);
    return () => {
      this.connCbs = this.connCbs.filter((c) => c !== cb);
    };
  }

  async connect(): Promise<void> {
    this.setConn('scanning');
    await delay(700);
    this.setConn('connecting');
    await delay(800);
    this.setConn('connected');
  }

  async disconnect(): Promise<void> {
    /* Spec §8.3: losing the connection does NOT stop the session. The sim
       keeps the session running internally — exactly like real firmware. */
    this.setConn('disconnected');
  }

  /* ── Commands ────────────────────────────────────────────────────────── */

  async sendCommand(packet: BleCommandPacket): Promise<void> {
    await delay(120); // realistic write latency

    /* Spec §9 rule 6: invalid mode > 4 → ignore, no crash. */
    if (
      packet.command === BleCommand.Start &&
      (packet.mode < 0 || packet.mode > 4)
    ) {
      return;
    }

    if (packet.command === BleCommand.Start) {
      this.tickBattery();
      if (this.battery < 5) return; // can't start on critical battery
      this.fault = false;
      this.currentMode = packet.mode;
      /* Spec §7.1 / §9 rule 7: always clamp duration to mode bounds. */
      this.clampedDuration = clampDuration(packet.mode, packet.duration);
      this.sessionActive = true;
      this.sessionEndsAt = Date.now() + this.clampedDuration * 60_000;
    } else if (packet.command === BleCommand.Stop) {
      this.endSession();
    }
    /* StatusRequest handled by requestStatus() (the app's 5s poll). */
  }

  /* ── Status poll (app calls every 5s — spec §8.3/§11.4) ──────────────── */

  async requestStatus(): Promise<BleStatusPacket> {
    await delay(60);
    this.tickBattery();
    this.evaluateSafety();

    let remaining = 0;
    if (this.sessionActive) {
      remaining = Math.max(
        0,
        Math.ceil((this.sessionEndsAt - Date.now()) / 60_000)
      );
      if (Date.now() >= this.sessionEndsAt) {
        /* Autonomous timer expired (spec §9 rule 1). */
        this.endSession();
        remaining = 0;
      }
    }

    return {
      sessionActive: this.sessionActive,
      currentMode: this.currentMode,
      remainingMinutes: remaining,
      batteryPercent: Math.round(this.battery),
      charging: this.charging,
      fault: this.fault,
    };
  }

  /* ── Internal: spec-faithful battery + safety ────────────────────────── */

  private tickBattery() {
    const now = Date.now();
    const minutes = (now - this.lastTick) / 60_000;
    this.lastTick = now;
    if (minutes <= 0) return;

    if (this.charging) {
      this.battery = Math.min(100, this.battery + minutes * 2.0);
    } else if (this.sessionActive) {
      this.battery = Math.max(0, this.battery - minutes * SIM.drainPerMinute);
    } else {
      this.battery = Math.max(
        0,
        this.battery - minutes * SIM.idleDrainPerMinute
      );
    }
  }

  private evaluateSafety() {
    /* Spec §9 rule 2: charging → session stops immediately, motor off. */
    if (this.charging && this.sessionActive) {
      this.endSession();
      return;
    }
    /* Spec §9 rule 3: critical battery <5% → end session. */
    if (this.battery < 5 && this.sessionActive) {
      this.endSession();
      return;
    }
    /* Spec §9 rule 4: fault → end session, fault flag stays set. */
    if (this.fault && this.sessionActive) {
      this.endSession();
    }
    /* Spec §9 rule 5: low battery <20% → firmware lowers amplitude -20%.
       The app does NOT display amplitude (spec §11.5), so nothing to show
       here; the behaviour is internal. State stays consistent. */
  }

  private endSession() {
    this.sessionActive = false;
    this.sessionEndsAt = 0;
    /* real firmware: motor_off() first — nothing to do in sim. */
  }

  /* ── Demo/test hooks (not part of the contract, sim-only) ────────────── */

  /** Toggle charging — demonstrates spec §9 rule 2 live. */
  simSetCharging(on: boolean) {
    this.charging = on;
    this.tickBattery();
    this.evaluateSafety();
  }

  /** Force a DRV2605L fault — demonstrates spec §9 rule 4 live. */
  simTriggerFault() {
    this.fault = true;
    this.evaluateSafety();
  }

  /** Set battery for demos (e.g. show low-battery behaviour quickly). */
  simSetBattery(pct: number) {
    this.battery = Math.max(0, Math.min(100, pct));
    this.evaluateSafety();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}  