/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — SessionArt

   De ademende figuur van een sessie, als BEELD in plaats van als tekening.

   Operator 1 augustus 2026: "uw renderingen zijn heel slecht en lijken
   helemaal niet op de foto's." Klopt, en dat is geen kwestie van beter mijn
   best doen. Die referenties zijn gerenderde illustraties — volumetrische
   blaadjes, licht dat door lagen heen schijnt. Ik teken met paden en gloed;
   dat haalt dat niveau nooit, net zoals een blauwdruk nooit een foto wordt.

   Dus: de operator levert het beeld, en dit bestand geeft het adem. Wat er
   beweegt:

     SCHAAL    Van 0.87 naar 1.0 over de inademing. Ademen ís uitzetten,
               dus dit is de hele beweging — de rest is versiering
     LICHT     Het beeld wordt helderder bij het inademen en zakt terug bij
               het uitademen
     GLOED     Een gekleurde lichtbron erachter die verder uitdijt dan het
               beeld zelf. Zonder die gloed plakt een PNG op het zwart in
               plaats van erin te hangen

   Alles hangt aan één ademwaarde die van buiten meekomt, dezelfde die de
   stem en de trilling stuurt. Dat is het verschil tussen een animatie die
   meeloopt en een animatie die stuurt.

   Wat een beeld NIET kan: van vorm veranderen. Blaadjes die één voor één
   openvouwen gaat niet. Voor ademen maakt dat niet uit, want ademen is
   schalen.
   ───────────────────────────────────────────────────────────────────────── */

import {
  Canvas,
  Circle,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

/* De vijf illustraties, aangeleverd door de operator (Bunny CDN). */
export const SESSION_ART = {
  lotus:
    'https://vibezcore-audio.b-cdn.net/images/lotusbloem-removebg-preview.png',
  sun: 'https://vibezcore-audio.b-cdn.net/images/sun-removebg-preview.png',
  orb: 'https://vibezcore-audio.b-cdn.net/images/bol-removebg-preview.png',
} as const;

export type SessionArtKey = keyof typeof SESSION_ART;

/* Warm de cache op zodat het beeld er staat vóór het scherm opent. Een
   ademfiguur die een halve seconde later inpopt verpest de rust die het
   scherm juist moet uitstralen. */
export function prefetchSessionArt() {
  for (const uri of Object.values(SESSION_ART)) {
    Image.prefetch(uri).catch(() => {});
  }
}

type Props = {
  size: number;
  art: SessionArtKey;
  /** 0 = volledig uitgeademd, 1 = volledig ingeademd. */
  breath: SharedValue<number>;
  /** Kleur van de lichtbron erachter. */
  glow: string;
  /** Hoeveel van de hoogte zichtbaar blijft. Een lotus is breder dan hoog;
   *  het vierkant eronder en erboven is leeg en mag weg. */
  heightRatio?: number;
};

export default function SessionArt({
  size,
  art,
  breath,
  glow,
  heightRatio = 1,
}: Props) {
  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.87 + breath.value * 0.13 }],
    opacity: 0.8 + breath.value * 0.2,
  }));

  /* De gloed loopt verder uit dan het beeld en zwelt sterker aan. Daardoor
     lijkt het licht van de figuur af te komen in plaats van erachter te
     hangen. */
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.14 + breath.value * 0.2,
    transform: [{ scale: 0.85 + breath.value * 0.3 }],
  }));

  const c = size / 2;

  return (
    <View
      style={{
        width: size,
        height: size * heightRatio,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pointerEvents="none"
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, glowStyle]}
        pointerEvents="none"
      >
        <Canvas style={{ flex: 1 }}>
          <Circle cx={c} cy={(size * heightRatio) / 2} r={c}>
            <RadialGradient
              c={vec(c, (size * heightRatio) / 2)}
              r={c}
              colors={[glow, glow, '#00000000']}
              positions={[0, 0.18, 1]}
            />
          </Circle>
        </Canvas>
      </Animated.View>

      <Animated.Image
        source={{ uri: SESSION_ART[art] }}
        style={[{ width: size, height: size }, imgStyle]}
        resizeMode="contain"
      />
    </View>
  );
}
