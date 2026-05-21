/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Play / Pause glyph

   Webapp-parity zonder extra SVG-dependency (CLAUDE.md §1: geen nieuwe
   deps zonder rapportage). We bouwen beide shapes met gewone `<View>`s:
     - Pause = twee verticale balkjes met afgeronde uiteinden
     - Play  = rechtwijzende driehoek via de RN border-truc

   Bron (webapp index.html):
     Pause = <rect x="6" y="4"  width="4" height="16" rx="1">
             <rect x="14" y="4" width="4" height="16" rx="1">
     Play  = <polygon points="5 3 19 12 5 21">

   Maatvoering wordt afgeleid van `size` (icon-hoogte) zodat dezelfde
   component werkt op 14/16/28px-knoppen — proporties blijven gelijk.
   ─────────────────────────────────────────────────────────────────────── */

import { Text, View } from 'react-native';

type Props = {
  /** Icon-hoogte in px. Breedte volgt automatisch uit ratio. */
  size: number;
  color?: string;
  /** true → pause-icoon (twee balkjes), false → play-driehoek. */
  playing: boolean;
};

export function PlayPauseGlyph({ size, color = '#ffffff', playing }: Props) {
  if (playing) {
    /* Twee balkjes (4:16 ratio = .25 van height) + gap van .25 ertussen.
       borderRadius .0625 van size = afronding rx=1 op size=16. */
    const bar = size * 0.25;
    const radius = Math.max(1, size * 0.0625);
    return (
      <View
        style={{
          width: bar * 3, // bar + gap + bar
          height: size,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            width: bar,
            height: size,
            backgroundColor: color,
            borderRadius: radius,
          }}
        />
        <View
          style={{
            width: bar,
            height: size,
            backgroundColor: color,
            borderRadius: radius,
          }}
        />
      </View>
    );
  }

  /* Play-driehoek: ▶ (U+25B6 BLACK RIGHT-POINTING TRIANGLE) als pure
     tekst-glyph. We zijn bewust WEGGEGAAN van de RN border-truc
     (width:0 + asymmetrische borders) na een runtime-crash op New
     Arch Fabric — die layout-engine accepteert die "ghost" View niet
     altijd stabiel. ▶ is een geometrisch tekst-karakter (geen emoji,
     geen Android orange-tinting) en levert een schone scherpe driehoek
     op die qua optische verhouding dicht bij webapp's polygon ligt. */
  return (
    <Text
      style={{
        color,
        fontSize: size,
        lineHeight: size,
        /* Lichte rechts-leun-correctie zodat de driehoek optisch
           gecentreerd staat in een ronde knop. ▶'s zwaartepunt zit
           lichtjes links — 1/8 size naar rechts schuiven balanceert. */
        marginLeft: size * 0.08,
        includeFontPadding: false,
      }}
    >
      ▶
    </Text>
  );
}
