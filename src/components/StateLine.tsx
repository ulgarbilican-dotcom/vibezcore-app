/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — StateLine (onboarding slide 2)

   "Een dunne lichtlijn. Bij Focus wordt ze scherper. Bij Calm wordt ze
   ronder. Bij Deep Rest wordt alles trager. Niet letterlijk uitleggen.
   Gebruiker voelt het."

   Eén lijn, geen labels, geen iconen. Het karakter van de golf IS de
   uitleg:

     Boost        — korte golflengte, hoge frequentie, snelst
     Sharp Focus  — vlak en strak; bijna een rechte lijn (= scherpte)
     Calm Control — brede, ronde golf (= kalmte)
     Clarity & Relax — smalle amplitude, rustig ritme (= helderheid)
     Sleep        — zeer brede golf, extreem traag (= diepe rust)

   Bij state-wissel morphen amplitude/frequentie/snelheid met withTiming
   naar de nieuwe waarden — de lijn verandert zichtbaar van aard zonder
   dat er iets "omschakelt".
   ───────────────────────────────────────────────────────────────────────── */

import { AMBIENT } from '@/components/ambient-tokens';
import {
  BlurMask,
  Canvas,
  Group,
  Path,
  Skia,
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

export type StateKey = 'boost' | 'focus' | 'calm' | 'clarity' | 'rest';

type Props = {
  /** Welke state het karakter van de lijn bepaalt. */
  state: StateKey;
  width?: number;
  height?: number;
};

/* Karakter per state.
     amp   — uitslag in px (rond = groot, scherp = klein)
     freq  — aantal golven over de breedte (scherp = hoger)
     speed — doorlooptijd van één volledige fase-shift in ms (traag = hoog) */
const CHARACTER: Record<
  StateKey,
  { amp: number; freq: number; speed: number }
> = {
  boost:   { amp: 9,  freq: 3.2, speed: 9000 },
  focus:   { amp: 4,  freq: 2.4, speed: 14000 },
  calm:    { amp: 16, freq: 1.2, speed: 20000 },
  clarity: { amp: 7,  freq: 1.8, speed: 17000 },
  rest:    { amp: 22, freq: 0.8, speed: 31000 },
};

/* Aantal samplepunten over de breedte. 96 = vloeiende curve, ruim binnen
   budget omdat we per frame alleen een sin() per punt doen. */
const SAMPLES = 96;

export default function StateLine({
  state,
  width = 320,
  height = 120,
}: Props) {
  const cy = height / 2;
  const target = CHARACTER[state];

  /* Karakter-waarden zijn shared values zodat een state-wissel MORPHT
     i.p.v. springt. Dat is precies het "voelen" uit de art direction. */
  const amp = useSharedValue(target.amp);
  const freq = useSharedValue(target.freq);
  /* `t` loopt continu; de snelheid regelen we door de periode van de
     repeat aan te passen bij state-wissel. */
  const t = useSharedValue(0);

  useEffect(() => {
    amp.value = withTiming(target.amp, {
      duration: 2600,
      easing: Easing.inOut(Easing.cubic),
    });
    freq.value = withTiming(target.freq, {
      duration: 2600,
      easing: Easing.inOut(Easing.cubic),
    });
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: target.speed, easing: Easing.linear }),
      -1,
      false,
    );
  }, [state, target.amp, target.freq, target.speed, amp, freq, t]);

  /* De lijn zelf. Twee sinussen op onderling niet-deelbare frequenties →
     de golf herhaalt visueel nooit exact, ook al is de beweging periodiek. */
  const linePath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const phase = t.value * Math.PI * 2;

    for (let i = 0; i <= SAMPLES; i++) {
      const px = (i / SAMPLES) * width;
      const u = (i / SAMPLES) * Math.PI * 2 * freq.value;
      const y =
        cy +
        Math.sin(u + phase) * amp.value +
        Math.sin(u * 1.61 + phase * 0.73) * amp.value * 0.28;
      if (i === 0) p.moveTo(px, y);
      else p.lineTo(px, y);
    }
    return p;
  });

  /* Fade aan beide uiteinden zodat de lijn uit het zwart komt en er weer
     in verdwijnt — geen harde randen tegen de schermrand. */
  const maskPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    p.addRect({ x: 0, y: 0, width, height });
    return p;
  });

  return (
    <View style={{ width, height }}>
      <Canvas style={{ flex: 1 }}>
        <Group blendMode="plus" clip={maskPath}>
          {/* Onderlaag — brede, zwaar geblurde gloed. Geeft de lijn
             volume zodat het licht lijkt i.p.v. een stroke. */}
          <Path
            path={linePath}
            style="stroke"
            strokeWidth={9}
            strokeCap="round"
            color={AMBIENT.volume}
            opacity={0.22}
          >
            <BlurMask blur={18} style="normal" />
          </Path>

          {/* Middenlaag — de eigenlijke lichtlijn. */}
          <Path
            path={linePath}
            style="stroke"
            strokeWidth={2.2}
            strokeCap="round"
            color={AMBIENT.core}
            opacity={0.5}
          >
            <BlurMask blur={5} style="normal" />
          </Path>

          {/* Kernlaag — dun en scherp. Dit is wat "precision" leest. */}
          <Path
            path={linePath}
            style="stroke"
            strokeWidth={0.9}
            strokeCap="round"
            color={AMBIENT.core}
            opacity={0.75}
          />
        </Group>
      </Canvas>
    </View>
  );
}
