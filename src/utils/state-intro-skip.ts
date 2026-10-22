/* Na de State Control-onboarding mag het welkomstbeeld van de tab niet meer even oplichten
   (operator, 22 okt 2026: "na de hartslagmeting zie ik heel kort de welkomstfoto"). De onboarding
   zet deze vlag vóór ze sluit; de tab verbergt zijn intro meteen en wist de vlag zodra de
   `open`-parameter binnen is. */
import { useSyncExternalStore } from 'react';

let skip = false;
const listeners = new Set<() => void>();

export function setStateIntroSkip(v: boolean): void {
  if (skip === v) return;
  skip = v;
  listeners.forEach((l) => l());
}

export function useStateIntroSkip(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => skip,
    () => false,
  );
}
