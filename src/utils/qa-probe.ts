/* QA-meetpunt (docs/KWALITEITSPROTOCOL.md §3): in een testbuild (utils/qa.ts) meldt de app zelf — via logcat, tag
   ReactNativeJS, prefix "[QA]" — op welk scherm de gebruiker zit, of de tabbalk zichtbaar is en welke uitwegen
   (Back/Close/Cancel/Done/Not now) op dat moment bestaan. Betrouwbaarder dan het scherm uitlezen (uiautomator werkt niet
   met doorlopende animaties). In winkelbuilds doet alles hier niets. */
import { PixelRatio, StatusBar, type View } from 'react-native';
import type { RefObject } from 'react';
import { QA_ENABLED } from '@/utils/qa';

const exits = new Map<string, number>();
const refs = new Map<string, RefObject<View | null>>();
const flags: Record<string, unknown> = {};

export const QA_EXIT_RE = /^(Back|Close|Cancel|Done|Not now|Minimize)\b/i;

export function qaExit(label: string | undefined, delta: 1 | -1, ref?: RefObject<View | null>): void {
  if (!QA_ENABLED || !label) return;
  const n = (exits.get(label) ?? 0) + delta;
  if (n <= 0) {
    exits.delete(label);
    refs.delete(label);
  } else {
    exits.set(label, n);
    if (ref && delta === 1) refs.set(label, ref);
  }
}

export function qaFlag(key: string, value: unknown): void {
  if (QA_ENABLED) flags[key] = value;
}

export function qaSnapshot(): Record<string, unknown> {
  return { exits: [...exits.keys()].filter((l) => QA_EXIT_RE.test(l)).sort(), targets: [...exits.keys()].sort(), ...flags };
}

/** Zoals qaSnapshot, plus de positie van elke uitweg in schermpixels — NU gemeten (niet bij de eerste layout, want een
 *  scherm dat nog inschuift geeft verkeerde coördinaten). */
export async function qaSnapshotAsync(): Promise<Record<string, unknown>> {
  const xy: Record<string, [number, number]> = {};
  const r = PixelRatio.get();
  await Promise.all(
    [...refs.entries()].map(
      ([label, ref]) =>
        new Promise<void>((resolve) => {
          const node = ref.current;
          if (!node) return resolve();
          const to = setTimeout(resolve, 250);
          node.measureInWindow((x, y, w, h) => {
            clearTimeout(to);
            if (w > 0 && h > 0) xy[label] = [Math.round((x + w / 2) * r), Math.round((y + h / 2 + (StatusBar.currentHeight ?? 0)) * r)];
            resolve();
          });
        }),
    ),
  );
  return { ...qaSnapshot(), xy };
}
