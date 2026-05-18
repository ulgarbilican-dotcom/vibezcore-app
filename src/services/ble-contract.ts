/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — BLE Contract (spec v2.3 §8)

   This is the BINDING contract between app and bracelet. Both the simulation
   (now) and the real nRF52 firmware (later) implement EXACTLY this. Nothing
   here is invented — every field maps 1:1 to Haptic_Bracelet_Spec_v2.3 §8.

   The app NEVER shows technical params (PPS, burst_ms, amplitude, RTP) to the
   user (spec §11.5). Those live only in firmware. This file is the only
   "language" the app speaks to the device.
   ─────────────────────────────────────────────────────────────────────────── */

/* Mode index — spec §8.1: 0=Gamma 1=Beta 2=Alpha 3=Theta 4=Delta */
export enum BraceletMode {
  Gamma = 0, // app name: Boost
  Beta = 1,  // app name: Sharp Focus
  Alpha = 2, // app name: Calm Control
  Theta = 3, // app name: Clarity
  Delta = 4, // app name: Rest & Reset
}

/* Command byte — spec §8.1 */
export enum BleCommand {
  Start = 0x01,
  Stop = 0x02,
  StatusRequest = 0x03,
}

/* App → Bracelet — spec §8.1 ble_command_t (3 bytes) */
export interface BleCommandPacket {
  mode: BraceletMode;
  duration: number; // minutes — firmware clamps automatically (spec §7.1)
  command: BleCommand;
}

/* Bracelet → App — spec §8.2 ble_status_t (6 bytes) */
export interface BleStatusPacket {
  sessionActive: boolean; // spec: session_active 0/1
  currentMode: BraceletMode; // spec: current_mode 0–4
  remainingMinutes: number; // spec: remaining_minutes
  batteryPercent: number; // spec: battery_percent 0–100
  charging: boolean; // spec: charging 0/1
  fault: boolean; // spec: fault 0=OK 1=DRV2605L fault
}

/* Per-mode UI metadata. Names are PROVISIONAL (operator finalises later,
   together with marketing copy). Colours per operator decision: the §11.1
   word-labels are correct, the spec emoji's are the error.
   NO technical parameters here — those stay in firmware (spec §11.5). */
export interface ModeMeta {
  mode: BraceletMode;
  /** PROVISIONAL app name — operator finalises with copy */
  name: string;
  /** Short user-facing description — state language only, no brainwave claims */
  blurb: string;
  /** UI accent colour (tuned for #0a0a0a dark theme; fine-tune later) */
  color: string;
  /** Session duration bounds — spec §11.2 (exact). default = min */
  minMinutes: number;
  maxMinutes: number;
}

export const MODES: ModeMeta[] = [
  {
    mode: BraceletMode.Gamma,
    name: 'Boost',
    blurb: 'Peak alertness and sharp concentration.',
    color: '#FF453A', // red
    minMinutes: 8,
    maxMinutes: 15,
  },
  {
    mode: BraceletMode.Beta,
    name: 'Sharp Focus',
    blurb: 'Clear, active attention — work mode.',
    color: '#FF9F0A', // orange
    minMinutes: 15,
    maxMinutes: 30,
  },
  {
    mode: BraceletMode.Alpha,
    name: 'Calm Control',
    blurb: 'Relaxed but focused — flow.',
    color: '#0A84FF', // blue
    minMinutes: 15,
    maxMinutes: 30,
  },
  {
    mode: BraceletMode.Theta,
    name: 'Clarity',
    blurb: 'Deep relaxation and letting go.',
    color: '#BF5AF2', // purple
    minMinutes: 15,
    maxMinutes: 30,
  },
  {
    mode: BraceletMode.Delta,
    name: 'Rest & Reset',
    blurb: 'Deep rest and the transition to sleep.',
    color: '#30D158', // green
    minMinutes: 25,
    maxMinutes: 45,
  },
];

export function getModeMeta(mode: BraceletMode): ModeMeta {
  return MODES[mode];
}

/* Clamp duration to the mode's bounds — mirrors firmware spec §7.1 / §9 rule 7.
   The app clamps too so the UI never offers an out-of-range value. */
export function clampDuration(mode: BraceletMode, minutes: number): number {
  const m = MODES[mode];
  if (minutes < m.minMinutes) return m.minMinutes;
  if (minutes > m.maxMinutes) return m.maxMinutes;
  return Math.round(minutes);
}

/* Connection state for the UI layer (not part of the wire contract). */
export type BleConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected';

/* The single interface the app talks to. SimulatedBracelet implements this
   now; RealBracelet (react-native-ble-plx) implements the SAME interface
   later. Flipping USE_SIMULATED_BLE changes nothing in the UI. */
export interface BraceletTransport {
  getConnectionState(): BleConnectionState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendCommand(packet: BleCommandPacket): Promise<void>;
  /** App polls this every 5s (spec §8.3/§11.4). Returns latest status. */
  requestStatus(): Promise<BleStatusPacket>;
  /** Subscribe to connection-state changes for the UI. */
  onConnectionChange(cb: (s: BleConnectionState) => void): () => void;
}