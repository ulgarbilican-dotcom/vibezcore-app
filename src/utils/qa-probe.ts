/* QA-meetpunt (docs/KWALITEITSPROTOCOL.md §3): in een testbuild (utils/qa.ts) meldt de app zelf — via logcat, tag
   ReactNativeJS, prefix "[QA]" — op welk scherm de gebruiker zit, of de tabbalk zichtbaar is en welke uitwegen
   (Back/Close/Cancel/Done/Not now) op dat moment bestaan. Betrouwbaarder dan het scherm uitlezen (uiautomator werkt niet
   met doorlopende animaties). In winkelbuilds doet alles hier niets. */
import { QA_ENABLED } from '@/utils/qa';

const exits = new Map<string, number>();
const pos = new Map<string, [number, number]>();
const flags: Record<string, unknown> = {};

export const QA_EXIT_RE = /^(Back|Close|Cancel|Done|Not now|Minimize)\b/i;

export function qaExit(label: string | undefined, delta: 1 | -1): void {
  if (!QA_ENABLED || !label || !QA_EXIT_RE.test(label)) return;
  const n = (exits.get(label) ?? 0) + delta;
  if (n <= 0) {
    exits.delete(label);
    pos.delete(label);
  } else exits.set(label, n);
}

/** Midden van de uitweg in schermpixels, zodat het testscript hem kan tikken. */
export function qaPos(label: string, x: number, y: number): void {
  if (QA_ENABLED && exits.has(label)) pos.set(label, [Math.round(x), Math.round(y)]);
}

export function qaFlag(key: string, value: unknown): void {
  if (QA_ENABLED) flags[key] = value;
}

export function qaSnapshot(): Record<string, unknown> {
  return { exits: [...exits.keys()].sort(), xy: Object.fromEntries(pos), ...flags };
}
