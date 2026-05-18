/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet transport switch

   THE single switch (STRUCTUUR_en_BLE_contract_v2 §5.5). Today it returns the
   spec-faithful simulation. When real firmware exists, implement RealBracelet
   (react-native-ble-plx, same UUIDs/structs from §5.4) and flip the flag.
   The UI and app logic import only `getBracelet()` and never know which is
   behind it.
   ─────────────────────────────────────────────────────────────────────────── */

import { BraceletTransport } from './ble-contract';
import { SimulatedBracelet } from './bracelet-sim';

/* Flip to false once RealBracelet is implemented and firmware is flashed. */
export const USE_SIMULATED_BLE = true;

let instance: BraceletTransport | null = null;

export function getBracelet(): BraceletTransport {
  if (instance) return instance;
  if (USE_SIMULATED_BLE) {
    instance = new SimulatedBracelet();
  } else {
    /* RealBracelet — implemented in the firmware phase. Same interface,
       same contract. Until then this branch is unreachable (flag = true). */
    throw new Error(
      'RealBracelet not implemented yet — keep USE_SIMULATED_BLE = true'
    );
  }
  return instance;
}

/** For demo screens that need the sim-only hooks (charging/fault/battery).
    Returns null when running on real hardware — callers must handle that. */
export function getSimHooks(): SimulatedBracelet | null {
  const b = getBracelet();
  return b instanceof SimulatedBracelet ? b : null;
} 