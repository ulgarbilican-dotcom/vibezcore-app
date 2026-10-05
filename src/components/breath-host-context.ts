/* Context van de ademsessie-laag (zie services/breath-session-host.ts):
   parameters + minimaliseer-stand, voor breath-session.tsx. Apart bestand
   zodat BreathSessionHost en breath-session.tsx elkaar niet importeren. */

import { createContext, useContext } from 'react';
import type { BreathSessionParams } from '@/services/breath-session-host';

export type BreathHostCtx = { params: BreathSessionParams; minimized: boolean };

export const BreathHostContext = createContext<BreathHostCtx>({ params: {}, minimized: false });

export function useBreathHost(): BreathHostCtx {
  return useContext(BreathHostContext);
}

/** Vervangt useLocalSearchParams in de sessie: zelfde getypeerde vorm. */
export function useBreathParams<T>(): T {
  return useContext(BreathHostContext).params as unknown as T;
}
