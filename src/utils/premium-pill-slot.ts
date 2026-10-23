/* Waar de Premium-pil staat: bovenaan (intro-foto's zonder titel) of onder de titel van het tabblad
   (keuze-/lijstpagina's met titel). Elk tabblad zet dit bij focus; 23 okt 2026 (operator). */
let low = false;
const subs = new Set<(v: boolean) => void>();
export function getPremiumPillLow(): boolean {
  return low;
}
export function setPremiumPillLow(v: boolean): void {
  if (v === low) return;
  low = v;
  subs.forEach((f) => f(v));
}
export function subscribePremiumPillLow(f: (v: boolean) => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
