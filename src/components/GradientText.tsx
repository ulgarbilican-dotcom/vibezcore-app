/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — GradientText

   Operator 2026-07-31: "het blauw in de tekst moet ook een soort overlay
   zijn en niet de letters zelf, het moet schuin lopen door de tekst" →
   later aangevuld met "heel de rechterkant mag mee gradient blauw" en
   "kan de header ook om de beurt naar voren komen: Breathe 1, Build 2,
   Become 3".

   Dus: de regel is wit met één schuine lichtband die naar rechts volledig
   blauw wordt, en de woorden lichten om de beurt op.

   Waarom Skia en niet MaskedView: een gradient over tekst vraagt normaal
   `@react-native-masked-view/masked-view` — een native module, dus een
   rebuild. Skia zit al in het project en kan een shader rechtstreeks op
   tekst zetten. Zelfde resultaat, geen nieuwe native afhankelijkheid.

   Belangrijk bij de woord-animatie: elk woord krijgt een eigen Group, maar
   ALLE woorden delen dezelfde gradient over de volle canvasbreedte. Zou
   elk woord zijn eigen gradient krijgen, dan begint de band per woord
   opnieuw en valt de doorlopende overgang uit elkaar.

   Twee dingen die Skia-tekst NIET van RN-tekst erft, en hier zijn opgelost:
     - Geen letterafstand. Operator 2026-07-31: "de fontstijl lijkt niet op
       een header". Dat klopte, en het lag niet aan Inter: displaytekst wordt
       STRAK gezet, met negatieve letterafstand, en zonder die mogelijkheid
       staat een kop altijd te los. Skia tekent een hele regel in één keer en
       biedt geen instelling daarvoor.

       Daarom worden letters hier stuk voor stuk geplaatst. De positie van
       letter i is de gemeten breedte van álles ervóór, plus i keer de
       tracking. Door telkens het hele voorstuk te meten blijft de kerning
       van het font behouden — pas op de losse letters meten zou paren als
       "Yo" en "Ta" uit elkaar trekken.
     - Geen automatische centrering. Wordt hier met de gemeten breedte
       gedaan
   ───────────────────────────────────────────────────────────────────────── */

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  RadialGradient,
  Text as SkiaText,
  useFont,
  vec,
  type SkFont,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, type ReactElement } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type Props = {
  text: string;
  /** Fontgrootte in dp. Wordt automatisch verkleind als de regel niet past. */
  size: number;
  /** Beschikbare breedte. De regel wordt hierin gecentreerd. */
  width: number;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold' | 'black';
  /** Kleurstops van de overlay. Standaard: wit links → blauw rechts. */
  colors?: string[];
  positions?: number[];
  /** Hoe schuin de band loopt. Hoger = steiler. */
  slant?: number;
  /** Letterafstand in punten. Negatief zet de regel strakker; POSITIEF geeft
   *  de open, luchtige zetting die kapitalen op licht gewicht nodig hebben —
   *  zonder ruimte plakken hoofdletters aan elkaar. */
  tracking?: number;
  /** Zachte lichtbron áchter de regel. Alleen zinvol op een donkere
   *  achtergrond; het licht hoogt op i.p.v. wit overheen te leggen. */
  glow?: boolean;
  glowColor?: string;
  /** Woorden om de beurt naar voren laten komen.
   *
   *  De dekking staat op de LETTERS, niet op een groep eromheen. Een groep
   *  met eigen dekking dwingt Skia elk frame tot een volledige scherm-buffer,
   *  en met drie woorden zijn dat er drie per frame — dat maakte deze
   *  animatie eerder stroef. De groep houdt alleen de schaalbeweging vast,
   *  en die kost niets. */
  stagger?: boolean;
  /** Laat de lichtband over de regel lopen.
   *
   *  Hier stond eerst een beurt-animatie die per WOORD de dekking en de
   *  schaal aanpaste. Dat blijft duur hoe je het ook bouwt: elk frame moet
   *  elke letter opnieuw met een eigen dekking worden getekend, en de tekst
   *  bestaat uit losse letters omdat we letterafstand nodig hebben.
   *
   *  Deze vorm animeert alleen de GRADIENT: de letters staan stil en er
   *  schuift één lichtband overheen. Eén bewegende waarde in plaats van
   *  twintig, en het past ook beter bij de rest van het scherm — daar reist
   *  het licht ook door de vorm heen. */
  sweep?: boolean;
  /** Duur van één passage van de lichtband. */
  cycleMs?: number;
  style?: StyleProp<ViewStyle>;
};

const FONTS = {
  regular: Inter_400Regular,
  medium: Inter_500Medium,
  semibold: Inter_600SemiBold,
  bold: Inter_700Bold,
  black: Inter_900Black,
} as const;

/* Wit links, oplopend naar vol accentblauw rechts (operator 2026-07-31:
   "heel de rechterkant mag mee gradient blauw"). Omdat de gradient schuin
   loopt, kantelt die overgang mee — het leest als licht dat van rechts
   over de letters strijkt, niet als gekleurde tekst. */
/* Zeven stops i.p.v. vijf, en dichter op elkaar. Met weinig stops springt
   de kleur zichtbaar van wit naar blauw; het oog ziet zo'n knik meteen,
   zeker over een lichte kleur. Meer tussenstappen maken van dezelfde
   overgang een verloop (operator 2026-07-31: "de overgang naar blauw is
   nog altijd te hard"). */
const DEFAULT_COLORS = [
  '#FFFFFF',
  '#FAFCFF',
  '#F2F7FF',
  '#EAF1FF',
  '#E1EBFF',
];
const DEFAULT_POSITIONS = [0, 0.25, 0.5, 0.75, 1];

/* Subkoppen krijgen een duidelijker verloop dan koppen: wit links, echt
   blauw rechts (operator 2026-07-31). Op een kop zou dat te veel worden —
   die is groot en trekt al genoeg aandacht — maar op een kleine regel in
   kapitalen geeft het richting zonder te schreeuwen. */
export const SUB_COLORS = [
  '#FFFFFF',
  '#FFFFFF',
  '#E4EFFF',
  '#B8D4FF',
  '#8ABAFF',
  '#5AA0FF',
];
export const SUB_POSITIONS = [0, 0.3, 0.5, 0.7, 0.86, 1];

type Glyph = { ch: string; x: number };
type Word = { glyphs: Glyph[]; x: number; w: number };

/* Eén woord dat om de beurt naar voren komt. Eigen component omdat er hooks
   in zitten en die niet in een .map()-callback mogen. */
function StaggerWord({
  word,
  index,
  count,
  cyc,
  font,
  baseline,
  midY,
  offset,
  gradient,
}: {
  word: Word;
  index: number;
  count: number;
  cyc: SharedValue<number>;
  font: SkFont;
  baseline: number;
  midY: number;
  offset: number;
  gradient: ReactElement;
}) {
  /* Afstand tot de beurt, kortste weg rond. De beurten overlappen een beetje,
     anders krijg je losse knipperingen i.p.v. iets dat door de regel loopt. */
  const opacity = useDerivedValue(() => {
    'worklet';
    let d = (((cyc.value - index) % count) + count) % count;
    if (d > count / 2) d -= count;
    const k = Math.max(0, 1 - Math.abs(d) / 0.85);
    return 0.34 + 0.66 * k;
  });

  const transform = useDerivedValue(() => {
    'worklet';
    let d = (((cyc.value - index) % count) + count) % count;
    if (d > count / 2) d -= count;
    const k = Math.max(0, 1 - Math.abs(d) / 0.85);
    return [{ scale: 0.96 + 0.06 * k }];
  });

  return (
    <Group
      origin={vec(offset + word.x + word.w / 2, midY)}
      transform={transform}
    >
      {word.glyphs.map((g, i) => (
        <SkiaText
          key={i}
          x={offset + g.x}
          y={baseline}
          text={g.ch}
          font={font}
          opacity={opacity}
        >
          {gradient}
        </SkiaText>
      ))}
    </Group>
  );
}

export default function GradientText({
  text,
  size,
  width,
  weight = 'bold',
  colors = DEFAULT_COLORS,
  positions = DEFAULT_POSITIONS,
  slant = 1.8,
  tracking = 0,
  glow = false,
  glowColor = '#5aa0ff',
  sweep = false,
  stagger = false,
  cycleMs = 3000,
  style,
}: Props) {
  const font = useFont(FONTS[weight], size);

  const wordCount = useMemo(
    () => text.trim().split(/\s+/).length,
    [text],
  );

  /* Bij `sweep` loopt hij 0 → 1 (positie van de lichtband); bij `stagger`
     0 → aantal woorden (welk woord aan de beurt is). Omdat de afstand
     verderop modulo het aantal woorden gaat, is de overgang van het laatste
     naar het eerste woord naadloos. */
  const cyc = useSharedValue(0);
  useEffect(() => {
    if (!sweep && !stagger) return;
    cyc.value = withRepeat(
      withTiming(stagger ? wordCount : 1, {
        duration: cycleMs,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [cyc, sweep, stagger, wordCount, cycleMs]);

  /* Deze twee moeten BOVEN de vroege return staan die op het font wacht.
     Hooks moeten elke render in dezelfde volgorde en hetzelfde aantal
     draaien; eronder zetten liet het aantal springen zodra het font
     binnenkwam, en React breekt daarop af.

     De schuine stand hangt daarom aan de fontgrootte i.p.v. aan de gemeten
     regelhoogte — dezelfde hoek, maar bekend vóórdat er iets gemeten is. */
  const reach = size * 1.35 * slant;

  /* Bij `sweep` schuift de hele band van links naar rechts voorbij; anders
     staat hij vast. Dit is de ENIGE bewegende waarde in de hele regel — de
     letters zelf worden geen enkel frame opnieuw uitgerekend. */
  const gStart = useDerivedValue(() => {
    'worklet';
    const shift = sweep ? (cyc.value * 2 - 1) * width : 0;
    return vec(shift, reach);
  });
  const gEnd = useDerivedValue(() => {
    'worklet';
    const shift = sweep ? (cyc.value * 2 - 1) * width : 0;
    return vec(shift + width, -reach);
  });

  const layout = useMemo(() => {
    if (!font) return null;

    const line = text.trim();

    /* Positioneren op de VOORTGANG van elke letter, niet op haar omhullende.
       `measureText` geeft de kleinste rechthoek om de zwarte inkt heen; de
       witruimte die een letter links en rechts van zichzelf meebrengt zit
       daar niet in. Optellen van zulke rechthoeken loopt scheef, en dat was
       precies te zien: "BREA THE" met een gat middenin (operator 2026-07-31).

       `getGlyphWidths` geeft wél de voortgang — de afstand tot waar de
       volgende letter begint. Dat is de maat waarop tekst hoort te worden
       gezet. */
    const ids = font.getGlyphIDs(line);
    const advances = font.getGlyphWidths(ids);

    const words: Word[] = [];
    const glyphs: Glyph[] = [];
    let cursor = 0;
    let current: Word | null = null;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const adv = advances[i] ?? 0;

      if (ch === ' ') {
        current = null;
        /* GEEN tracking bij een spatie. Die telt hier dubbel: de spatie heeft
           zelf al een royale voortgang, en er komt links en rechts ook nog
           letterafstand bij. Bij ruime tracking wordt het gat tussen woorden
           daardoor twee keer zo groot als bedoeld (operator 2026-07-31). */
        cursor += adv;
        continue;
      }

      if (!current) {
        current = { glyphs: [], x: cursor, w: 0 };
        words.push(current);
      }
      const g = { ch, x: cursor };
      current.glyphs.push(g);
      glyphs.push(g);
      current.w = cursor + adv - current.x;
      cursor += adv + tracking;
    }

    /* De tracking achter de laatste letter hoort niet bij de regel. */
    const total = Math.max(0, cursor - tracking);

    /* Echte regelhoogte uit de fontmetrics — anders staat de tekst scheef in
       zijn eigen canvas of wordt de staart van een 'y' afgekapt. Extra lucht
       boven en onder omdat een woord dat "naar voren komt" opschaalt en
       anders tegen de canvasrand klemt. */
    const m = font.getMetrics?.();
    const ascent = Math.abs(m?.ascent ?? size * 0.82);
    const descent = Math.abs(m?.descent ?? size * 0.24);
    const pad = stagger ? Math.ceil(size * 0.1) : 1;
    const height = Math.ceil(ascent + descent) + pad * 2;

    /* Past de regel niet, dan schalen we 'm om het midden terug. Beter een
       fractie kleiner dan afgekapt. */
    const scale = total > 0 ? Math.min(1, width / (total + 1)) : 1;

    return {
      words,
      glyphs,
      offset: (width - total) / 2,
      total,
      height,
      scale,
      baseline: ascent + pad,
    };
  }, [font, text, size, width, tracking, stagger]);

  /* Ruimte alvast reserveren terwijl het font laadt, anders springt de
     layout één frame. */
  if (!font || !layout) {
    return <View style={[{ height: Math.round(size * 1.32) }, style]} />;
  }

  const cx = width / 2;
  const cy = layout.height / 2;

  /* De gradient loopt van linksonder naar rechtsboven; de kleurbanden staan
     daar loodrecht op en lopen dus schuin door de regel. Eén keer opgebouwd
     en aan elk woord meegegeven, zodat de overgang doorloopt over de hele
     regel i.p.v. per woord opnieuw te beginnen. */
  const gradient = (
    <LinearGradient
      start={gStart}
      end={gEnd}
      colors={colors}
      positions={positions}
    />
  );

  return (
    <View style={[{ width, height: layout.height }, style]}>
      <Canvas style={{ flex: 1 }}>
        {/* Lichtbron achter de tekst. Additief gemengd zodat hij het beeld
            ophoogt; een wit vlak eroverheen zou de letters juist doven. */}
        {glow && (
          <Group blendMode="plus">
            <Circle cx={cx} cy={cy} r={width * 0.55} opacity={0.16}>
              <RadialGradient
                c={vec(cx, cy)}
                r={width * 0.55}
                colors={[glowColor, glowColor, '#00000000']}
                positions={[0, 0.06, 1]}
              />
            </Circle>
          </Group>
        )}
        <Group origin={vec(cx, cy)} transform={[{ scale: layout.scale }]}>
          {stagger
            ? layout.words.map((word, i) => (
                <StaggerWord
                  key={i}
                  word={word}
                  index={i}
                  count={layout.words.length}
                  cyc={cyc}
                  font={font}
                  baseline={layout.baseline}
                  midY={cy}
                  offset={layout.offset}
                  gradient={gradient}
                />
              ))
            : layout.glyphs.map((g, i) => (
                <SkiaText
                  key={i}
                  x={layout.offset + g.x}
                  y={layout.baseline}
                  text={g.ch}
                  font={font}
                >
                  {gradient}
                </SkiaText>
              ))}
        </Group>
      </Canvas>
    </View>
  );
}
