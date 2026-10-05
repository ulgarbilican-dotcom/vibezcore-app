/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — één icoonset voor de vijf toestanden, overal

   Operator, 5 okt 2026 ("de iconen kloppen niet — op Choose your state
   (breathwork) zijn het andere dan in Set your plan; zelfde iconen zodat
   gebruikers op den duur weten welke toestand wat is"): de Breath-tab
   tekent ze met `StateGlyph` (bliksem, roos, lemniscaat, rimpeling, kom),
   maar State Control en de onboarding gebruikten nog lucide-iconen (Zap,
   Target, Waves, Sparkles, MoonStar). Dit maakt van `StateGlyph` een
   gewone icoon-component met dezelfde props als een lucide-icoon, zodat
   elke plek dezelfde vijf tekens toont.
   ───────────────────────────────────────────────────────────────────────── */

import type { BreathStateKey } from '@/data/breath-states';
import { BraceletMode } from '@/services/ble-contract';
import StateGlyph from './StateGlyph';

type IconProps = { size?: number | string; color?: string; strokeWidth?: number | string };
export type GlyphIcon = (props: IconProps) => React.JSX.Element;

/** Bracelet-modus ↔ ademtoestand — dezelfde vijf toestanden, dezelfde
 *  kleuren (zie CLAUDE.md §5). */
export const MODE_STATE_KEY: Record<BraceletMode, BreathStateKey> = {
  [BraceletMode.Gamma]: 'boost',
  [BraceletMode.Beta]: 'focus',
  [BraceletMode.Alpha]: 'calm',
  [BraceletMode.Theta]: 'clarity',
  [BraceletMode.Delta]: 'rest',
};

function make(stateKey: BreathStateKey): GlyphIcon {
  return function Glyph({ size = 24, color = '#ffffff', strokeWidth = 1.8 }: IconProps) {
    return (
      <StateGlyph
        stateKey={stateKey}
        size={Number(size)}
        color={color}
        strokeWidth={Number(strokeWidth)}
      />
    );
  };
}

export const STATE_GLYPH_ICONS: Record<BreathStateKey, GlyphIcon> = {
  boost: make('boost'),
  focus: make('focus'),
  calm: make('calm'),
  clarity: make('clarity'),
  rest: make('rest'),
};

export const MODE_GLYPH_ICONS: Record<BraceletMode, GlyphIcon> = {
  [BraceletMode.Gamma]: STATE_GLYPH_ICONS.boost,
  [BraceletMode.Beta]: STATE_GLYPH_ICONS.focus,
  [BraceletMode.Alpha]: STATE_GLYPH_ICONS.calm,
  [BraceletMode.Theta]: STATE_GLYPH_ICONS.clarity,
  [BraceletMode.Delta]: STATE_GLYPH_ICONS.rest,
};
