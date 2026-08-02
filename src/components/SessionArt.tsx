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
  Oval,
  RadialGradient,
  rect,
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
  orb: 'https://vibezcore-audio.b-cdn.net/images/Soft_Orb-removebg-preview.png',
  buddha:
    'https://vibezcore-audio.b-cdn.net/images/buddha-removebg-preview%20(1).png',
  /* REST, operator 2 augustus 2026 — vervangt de buddha. Ook dit is geen
     bol, dus de naam "Soft Orb" past er nog steeds niet bij. */
  tree: 'https://vibezcore-audio.b-cdn.net/images/tree_of_life-removebg-preview%20(1).png',
  clarity:
    'https://vibezcore-audio.b-cdn.net/images/cristal-removebg-preview.png',
  /* FOCUS. Het bestand heet "bol", maar het IS de Flower of Life — niet
     achter de naam aanlopen bij het opruimen. */
  flower: 'https://vibezcore-audio.b-cdn.net/images/bol-removebg-preview.png',
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
  /** Breedte van het BEELD, niet van het zichtbare vlak. De aangeleverde
   *  PNG's hebben een royale lege rand; door hier ruim over de schermbreedte
   *  heen te gaan en het vlak eromheen kleiner te houden, vult het onderwerp
   *  het scherm in plaats van de rand. */
  size: number;
  art: SessionArtKey;
  /** 0 = volledig uitgeademd, 1 = volledig ingeademd. */
  breath: SharedValue<number>;
  /** Kleur van de lichtbron erachter. */
  glow: string;
  /** Zichtbare hoogte in punten. VAST per scherm-toestand, niet afgeleid
   *  van de beeldbreedte: alleen zo staat elk blok eronder op alle vijf de
   *  pagina's op precies dezelfde hoogte. De grootte van de illustratie
   *  regelt de aanroeper apart via `size`. */
  boxHeight: number;
  /** Waar het onderwerp verticaal in het beeld zit (0 = boven, 1 = onder).
   *  Zonder dit snijdt een symmetrische uitsnede de top eraf, want een
   *  bloem staat zelden precies in het midden van zijn eigen bestand. */
  focusY?: number;
  /** Ademringen rond de figuur. */
  rings?: boolean;
};

export default function SessionArt({
  size,
  art,
  breath,
  glow,
  boxHeight,
  focusY = 0.5,
  rings = false,
}: Props) {
  const boxH = boxHeight;
  const c = size / 2;
  const cy = boxH / 2;

  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (0.5 - focusY) * size },
      { scale: 0.87 + breath.value * 0.13 },
    ],
    opacity: 0.8 + breath.value * 0.2,
  }));

  /* De gloed loopt verder uit dan het beeld en zwelt sterker aan. Daardoor
     lijkt het licht van de figuur af te komen in plaats van erachter te
     hangen. */
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.14 + breath.value * 0.2,
    transform: [{ scale: 0.88 + breath.value * 0.17 }],
  }));

  /* De gloed moet UITGEDOOFD zijn vóór de rand van de uitsnede. Stond hij
     op de halve breedte, dan sneed het bijgesneden vlak er dwars doorheen
     en zag je een rechthoek om de figuur staan — precies wat een gloed niet
     mag doen. Vandaar de hoogte als maat, met marge voor het uitzetten. */
  const glowR = boxH * 0.46;

  /* Ringen die met de adem mee uitzetten. Ze staan er niet voor de sier:
     bij het inademen dijen ze uit en worden ze zichtbaarder, bij het
     uitademen trekken ze samen en doven ze. Zo zie je de beweging ook in
     je ooghoek, zonder naar de bloem te hoeven kijken. */
  const ringStyle = useAnimatedStyle(() => ({
    opacity: rings ? 0.1 + breath.value * 0.26 : 0,
    transform: [{ scale: 0.86 + breath.value * 0.2 }],
  }));

  return (
    <View
      style={{
        width: size,
        height: boxH,
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
          <Circle cx={c} cy={cy} r={glowR}>
            <RadialGradient
              c={vec(c, cy)}
              r={glowR}
              colors={[glow, glow, '#00000000']}
              positions={[0, 0.14, 1]}
            />
          </Circle>
        </Canvas>
      </Animated.View>

      {rings && (
        <Animated.View
          style={[StyleSheet.absoluteFill, ringStyle]}
          pointerEvents="none"
        >
          <Canvas style={{ flex: 1 }}>
            {[0.56, 0.74, 0.92].map((f, i) => (
              <Oval
                key={i}
                rect={rect(
                  c - c * f,
                  cy - boxH * 0.5 * f,
                  c * f * 2,
                  boxH * f,
                )}
                style="stroke"
                strokeWidth={1}
                color={glow}
                opacity={1 - i * 0.26}
              />
            ))}
          </Canvas>
        </Animated.View>
      )}

      <Animated.Image
        source={{ uri: SESSION_ART[art] }}
        style={[{ width: size, height: size }, imgStyle]}
        resizeMode="contain"
      />
    </View>
  );
}
