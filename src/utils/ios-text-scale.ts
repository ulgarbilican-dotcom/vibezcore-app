/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — typografie, centraal vóór de app laadt (16 okt 2026).

   1. Altijd Inter. Teksten zonder eigen lettertype (±127 stijlen, vooral in
      de Library) vielen terug op het systeemlettertype — SF Pro op iPhone,
      Roboto op Android — omdat de oude globale standaard (Text.defaultProps)
      onder React 19 niets meer doet. Elke stijl met een tekstgrootte maar
      zonder fontFamily krijgt hier de Inter-variant die bij zijn gewicht
      hoort; het losse fontWeight valt dan weg (op iOS liet dat een eigen
      lettertype soms vals vet tekenen).

   2. Tekstgrootte op iPhone (operator: "fonts lijken kleiner op iPhone …
      onze app moet topniveau zijn"). Het ontwerp is afgestemd op Android
      (gewone tekst ±14 sp); op de iPhone is gewone tekst 17 pt (Apple HIG,
      standaardinstelling "Large"). Elke fontSize en lineHeight × 1,08 op
      iOS. Android blijft exact zoals goedgekeurd. De gebruiker kan
      daarbovenop nog zijn eigen tekstgrootte kiezen (Dynamic Type).

   Geïnstalleerd vanuit /index.js, vóór expo-router/entry.
   ───────────────────────────────────────────────────────────────────────── */

import { Platform, StyleSheet } from 'react-native';

/** 15 → 16,2 · 16 → 17,3 · 17 → 18,4 — gewone tekst komt op Apple's 17 pt. */
export const IOS_TEXT_SCALE = 1.08;

const INTER_BY_WEIGHT: Record<string, string> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
};

type AnyStyle = Record<string, unknown>;

function fixOne(style: unknown): unknown {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return style;
  const st = style as AnyStyle;
  const hasSize = typeof st.fontSize === 'number';
  const needsFamily = hasSize && st.fontFamily == null;
  const scale = Platform.OS === 'ios';
  if (!needsFamily && !(scale && (hasSize || typeof st.lineHeight === 'number'))) return style;
  const out: AnyStyle = { ...st };
  if (needsFamily) {
    out.fontFamily = INTER_BY_WEIGHT[String(st.fontWeight ?? '400')] ?? 'Inter_400Regular';
    delete out.fontWeight;
  }
  if (scale) {
    if (typeof st.fontSize === 'number') out.fontSize = Math.round(st.fontSize * IOS_TEXT_SCALE * 10) / 10;
    if (typeof st.lineHeight === 'number') out.lineHeight = Math.round(st.lineHeight * IOS_TEXT_SCALE * 10) / 10;
  }
  return out;
}

let installed = false;

export function installIosTextScale(): void {
  if (installed) return;
  installed = true;
  const original = StyleSheet.create.bind(StyleSheet);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (StyleSheet as any).create = (styles: Record<string, unknown>) => {
    const fixed: Record<string, unknown> = {};
    for (const key of Object.keys(styles)) fixed[key] = fixOne(styles[key]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return original(fixed as any);
  };
}

/** Voor stijlen die niet via StyleSheet.create lopen (inline). */
export function iosFont(size: number): number {
  return Platform.OS === 'ios' ? Math.round(size * IOS_TEXT_SCALE * 10) / 10 : size;
}
