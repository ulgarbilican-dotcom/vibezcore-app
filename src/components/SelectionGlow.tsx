/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — SelectionGlow

   Operator 2026-07-31: "de glow achter de kaart trekt op niets, is zelfs
   geen glow maar gewoon een witte strip. Het moet superrealistisch zijn en
   vanuit de achterkant van de kaart echt glowen, bewegen."

   Volkomen terecht. Hier stonden gestapelde witte vlakken met een lage
   dekking, en zonder VERVAGING blijft een wit rechthoekje precies dat. Een
   gloed bestaat bij gratie van een zachte rand, en die kan React Native op
   Android niet uit zichzelf maken.

   Skia wel.

   Uiteindelijke vorm (operator 2026-07-31): "het moet als een eclips zijn,
   alsof de zon achter de kaart vandaan komt, rondom."

   Dat is een corona, en die heeft een heel specifiek verloop: verblindend
   fel precies op de rand, en vandaar snel afnemend naar buiten. Mijn eerste
   poging was een gevuld vlak met veel vervaging — dat spreidt het licht
   gelijkmatig uit en levert overal grijs. Mijn tweede was één dunne lijn —
   fel op de rand maar zonder iets eromheen, dus geen corona.

   Een corona is allebei tegelijk, en dat bouw je in lagen: vier keer
   dezelfde omtrek, van smal-scherp-fel naar breed-zacht-zwak. Bij elkaar
   opgeteld geeft dat de steile afname die echt licht heeft. Eén laag kan
   dat niet, want een enkele vervaging heeft maar één afnamekromme.

   Alles additief gemengd, zodat het licht ophoogt in plaats van wit
   overheen te leggen. En het ademt: alle vier de lagen zwellen samen aan en
   uit, dekking en vervaging mee.
   ───────────────────────────────────────────────────────────────────────── */

import {
  BlurMask,
  Canvas,
  Group,
  RoundedRect,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { View } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type GlowCell = { x: number; y: number; w: number; h: number };

type Props = {
  /** Posities van de kaarten, in de coördinaten van het raster. */
  cells: GlowCell[];
  /** Welke kaart oplicht; -1 = geen. */
  activeIndex: number;
  /** Hoekstraal van de kaarten. */
  radius?: number;
  /** Ruimte rondom voor de vervaging. Te krap en de rand wordt afgesneden. */
  pad?: number;
  color?: string;
};

export default function SelectionGlow({
  cells,
  activeIndex,
  radius = 22,
  pad = 78,
  color = '#ffffff',
}: Props) {
  const gridW = Math.max(...cells.map((c) => c.x + c.w));
  const gridH = Math.max(...cells.map((c) => c.y + c.h));

  const first = cells[Math.max(0, activeIndex)];
  const x = useSharedValue(first.x);
  const y = useSharedValue(first.y);
  const w = useSharedValue(first.w);
  const h = useSharedValue(first.h);
  const on = useSharedValue(activeIndex >= 0 ? 1 : 0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breathe]);

  useEffect(() => {
    if (activeIndex < 0) {
      on.value = withTiming(0, { duration: 280 });
      return;
    }
    const c = cells[activeIndex];
    /* Stond de gloed uit, dan meteen op zijn plek: anders zie je hem bij de
       eerste keuze vanuit de vorige hoek aan komen glijden terwijl hij daar
       nooit heeft gestaan. */
    const wasOff = on.value < 0.02;
    const move = { duration: 420, easing: Easing.out(Easing.cubic) };
    x.value = wasOff ? c.x : withTiming(c.x, move);
    y.value = wasOff ? c.y : withTiming(c.y, move);
    w.value = wasOff ? c.w : withTiming(c.w, move);
    h.value = wasOff ? c.h : withTiming(c.h, move);
    on.value = withTiming(1, { duration: 320 });
  }, [activeIndex, cells, x, y, w, h, on]);

  /* De corona ligt net BUITEN de kaart en zwelt daar omheen. Alle vier de
     randen even ver, dus het is aanzwellen om het middelpunt. */
  const grow = useDerivedValue(() => 2 + breathe.value * 4);

  const rx = useDerivedValue(() => x.value + pad - grow.value);
  const ry = useDerivedValue(() => y.value + pad - grow.value);
  const rw = useDerivedValue(() => w.value + grow.value * 2);
  const rh = useDerivedValue(() => h.value + grow.value * 2);
  /* Vier lagen van de corona. Breedte en vervaging lopen op, dekking loopt
     af — samen de steile afname van echt licht.

     Wit op halve dekking tegen zwart IS grijs; dat is rekenen, geen
     instelling. Daarom staat de binnenste laag vrijwel op vol en nemen de
     buitenste lagen de zwakke kant voor hun rekening. */
  const b = (base: number, add: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- vaste volgorde
    useDerivedValue(() => base + breathe.value * add);
  const o = (base: number, add: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- vaste volgorde
    useDerivedValue(() => on.value * (base + breathe.value * add));

  const blur0 = b(1.5, 1);
  const blur1 = b(9, 5);
  const blur2 = b(24, 10);
  const blur3 = b(46, 16);
  const stroke0 = b(1.8, 0.8);
  const stroke1 = b(7, 3);
  const stroke2 = b(18, 7);
  const stroke3 = b(40, 14);
  const op0 = o(0.92, 0.08);
  const op1 = o(0.4, 0.16);
  const op2 = o(0.18, 0.08);
  const op3 = o(0.07, 0.04);

  return (
    <View
      style={{
        position: 'absolute',
        left: -pad,
        top: -pad,
        width: gridW + pad * 2,
        height: gridH + pad * 2,
      }}
      pointerEvents="none"
    >
      <Canvas style={{ flex: 1 }}>
        <Group blendMode="plus">
          {/* Van buiten naar binnen: breed en zwak eerst, zodat de felle
              rand er bovenop komt te liggen. */}
          <RoundedRect
            x={rx} y={ry} width={rw} height={rh} r={radius}
            color={color} opacity={op3} style="stroke" strokeWidth={stroke3}
          >
            <BlurMask blur={blur3} style="normal" />
          </RoundedRect>
          <RoundedRect
            x={rx} y={ry} width={rw} height={rh} r={radius}
            color={color} opacity={op2} style="stroke" strokeWidth={stroke2}
          >
            <BlurMask blur={blur2} style="normal" />
          </RoundedRect>
          <RoundedRect
            x={rx} y={ry} width={rw} height={rh} r={radius}
            color={color} opacity={op1} style="stroke" strokeWidth={stroke1}
          >
            <BlurMask blur={blur1} style="normal" />
          </RoundedRect>
          <RoundedRect
            x={rx} y={ry} width={rw} height={rh} r={radius}
            color={color} opacity={op0} style="stroke" strokeWidth={stroke0}
          >
            <BlurMask blur={blur0} style="normal" />
          </RoundedRect>
        </Group>
      </Canvas>
    </View>
  );
}
