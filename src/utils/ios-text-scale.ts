/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — tekstgrootte op iPhone (operator, 16 okt 2026: "fonts lijken
   kleiner op iPhone … onze app moet topniveau zijn").

   Het ontwerp is afgestemd op Android, waar gewone tekst ±14 sp is. Op de
   iPhone is gewone tekst 17 pt (Apple HIG, standaardinstelling "Large"), dus
   dezelfde getallen lezen daar klein naast elke andere app. Eén centrale
   schaal voor iOS, vóór er ook maar één scherm laadt: elke fontSize en
   lineHeight in StyleSheet.create × IOS_TEXT_SCALE. Android blijft exact
   zoals goedgekeurd. De gebruiker kan daarbovenop nog altijd zijn eigen
   tekstgrootte kiezen (Dynamic Type), zoals Apple vraagt.

   Wordt geïnstalleerd vanuit /index.js, vóór expo-router/entry.
   ───────────────────────────────────────────────────────────────────────── */

import { Platform, StyleSheet } from 'react-native';

/** 15 → 16,2 · 16 → 17,3 · 17 → 18,4 — gewone tekst komt op Apple's 17 pt. */
export const IOS_TEXT_SCALE = 1.08;

type AnyStyle = Record<string, unknown>;

function scaleOne(style: unknown): unknown {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return style;
  const st = style as AnyStyle;
  if (typeof st.fontSize !== 'number' && typeof st.lineHeight !== 'number') return style;
  const out: AnyStyle = { ...st };
  if (typeof st.fontSize === 'number') out.fontSize = Math.round(st.fontSize * IOS_TEXT_SCALE * 10) / 10;
  if (typeof st.lineHeight === 'number') out.lineHeight = Math.round(st.lineHeight * IOS_TEXT_SCALE * 10) / 10;
  return out;
}

let installed = false;

export function installIosTextScale(): void {
  if (installed || Platform.OS !== 'ios') return;
  installed = true;
  const original = StyleSheet.create.bind(StyleSheet);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (StyleSheet as any).create = (styles: Record<string, unknown>) => {
    const scaled: Record<string, unknown> = {};
    for (const key of Object.keys(styles)) scaled[key] = scaleOne(styles[key]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return original(scaled as any);
  };
}

/** Voor stijlen die niet via StyleSheet.create lopen (inline). */
export function iosFont(size: number): number {
  return Platform.OS === 'ios' ? Math.round(size * IOS_TEXT_SCALE * 10) / 10 : size;
}
