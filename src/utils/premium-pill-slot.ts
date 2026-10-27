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

/* 27 okt 2026 (operator: op de actieve State Control-pagina hoort de Premium-pil bovenaan weg): tijdens een lopende voorproef of
   sessie is de pagina van de sessie; de uitnodiging komt na afloop. Een scherm zet dit aan en bij verlaten weer uit. */
let suppressed = false;
const supSubs = new Set<(v: boolean) => void>();
export function getPremiumPillSuppressed(): boolean {
  return suppressed;
}
export function setPremiumPillSuppressed(v: boolean): void {
  if (v === suppressed) return;
  suppressed = v;
  supSubs.forEach((f) => f(v));
}
export function subscribePremiumPillSuppressed(f: (v: boolean) => void): () => void {
  supSubs.add(f);
  return () => {
    supSubs.delete(f);
  };
}
