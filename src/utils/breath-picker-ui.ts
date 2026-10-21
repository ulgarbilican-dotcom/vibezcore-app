/* VIBEZCORE — staat van het Breath-keuzescherm (21 okt 2026): zodra het
   intro weg is (de vijf toestanden), verbergt de tabbalk zich, zoals bij
   State Control. Zie (tabs)/breath.tsx en (tabs)/_layout.tsx. */
let open = false;
const subs = new Set<(v: boolean) => void>();
export const isBreathPickerOpen = () => open;
export function setBreathPickerOpen(v: boolean) {
  if (open === v) return;
  open = v;
  subs.forEach((f) => f(v));
}
export function subscribeBreathPickerOpen(f: (v: boolean) => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
