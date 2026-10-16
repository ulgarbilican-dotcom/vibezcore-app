/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — tekst in blok (operator, 16 okt 2026: "2 regels moeten mooi
   in blok staan … dat geldt niet alleen voor deze sub maar is een regel").

   Loopt een tekst over meerdere regels en blijft er op de laatste regel
   een los woord (of een veel kortere regel) over, dan verdelen we de woorden
   opnieuw over hetzelfde aantal regels, zo gelijk mogelijk — zoals CSS
   `text-wrap: balance`. Werkt op iOS en Android: eerst gewoon tekenen,
   in onTextLayout zien hoe het viel, en enkel bij een wees opnieuw tekenen
   met harde regeleinden. Enkel voor gewone tekst (string als kind).
   ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useState } from 'react';
import { Text, type NativeSyntheticEvent, type TextLayoutEventData, type TextProps } from 'react-native';

/** Verdeel woorden over `lines` regels met zo gelijk mogelijke lengte. */
function balance(text: string, lines: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (lines < 2 || words.length <= lines) return text;
  const total = words.join(' ').length;
  const target = total / lines;
  const out: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const remainingLines = lines - out.length;
    const next = len === 0 ? w.length : len + 1 + w.length;
    /* Breek als deze regel dichter bij het doel zit zonder dit woord, en er
       nog genoeg woorden overblijven voor de resterende regels. */
    if (
      cur.length > 0 &&
      remainingLines > 1 &&
      Math.abs(next - target) > Math.abs(len - target) &&
      words.length - i >= remainingLines - 1
    ) {
      out.push(cur.join(' '));
      cur = [w];
      len = w.length;
    } else {
      cur.push(w);
      len = next;
    }
  }
  if (cur.length) out.push(cur.join(' '));
  return out.join('\n');
}

export default function BalancedText({ children, onTextLayout, ...rest }: TextProps) {
  const plain = typeof children === 'string' ? children : null;
  const [balanced, setBalanced] = useState<string | null>(null);
  const handle = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      onTextLayout?.(e);
      if (!plain || balanced !== null || plain.includes('\n')) return;
      const ls = e.nativeEvent.lines;
      if (ls.length < 2) return;
      const last = ls[ls.length - 1].text.trim();
      const prev = ls[ls.length - 2].text.trim();
      /* Wees: één woord, of de laatste regel is veel korter dan de vorige. */
      const orphan = !last.includes(' ') || last.length < prev.length * 0.55;
      if (orphan) setBalanced(balance(plain, ls.length));
    },
    [plain, balanced, onTextLayout],
  );
  if (!plain) return <Text {...rest} onTextLayout={onTextLayout}>{children}</Text>;
  return (
    <Text {...rest} onTextLayout={handle}>
      {balanced ?? plain}
    </Text>
  );
}
