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

import { assetUri } from '@/services/asset-cache';
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
  /* Operator, 8 okt 2026 ("in sleep ... moet ook onze bio teal zijn"): de
     boom was nog limoengroen (van vóór Sleep Bio-Teal werd). Zelfde PNG,
     enkel de tint verschoven naar Bio-Teal (helderheid/detail behouden),
     lokaal meegebundeld — geen netwerk nodig. Origineel:
     https://vibezcore-audio.b-cdn.net/images/tree_of_life-removebg-preview%20(1).png */
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  tree: Image.resolveAssetSource(require('../../assets/images/tree_teal.png')).uri,
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
  /** Operator, 11 september 2026 (18e ronde): "waar is de lichtbron die
   *  bij expand vanachter de animatie komt" — nadat de ringen uit gingen
   *  (`rings=false`) op het actieve sessiescherm, moet de gloed zelf
   *  duidelijker de ademcue dragen. Standaard `false` (ongewijzigd voor
   *  elke andere plek die dit component al gebruikt, zoals de kies-je-
   *  toestand-pagina) — alleen expliciet aangezet vanaf de lopende sessie. */
  glowBoost?: boolean;
};

export default function SessionArt({
  size,
  art,
  breath,
  glow,
  boxHeight,
  focusY = 0.5,
  rings = false,
  glowBoost = false,
}: Props) {
  const boxH = boxHeight;
  const c = size / 2;
  const cy = boxH / 2;

  /* De ondergrens is omhoog (operator, 2 augustus 2026: "de foto's zijn bij
     ons niet zo levendig"). Op tachtig procent stond de illustratie het
     grootste deel van de cyclus dof op het zwart — je zag de ademhaling
     vooral als DOVEN, en een beeld dat halve tijd wegzakt oogt gebleekt.
     Nu ademt hij tussen 90 en 100 procent: de beweging blijft zichtbaar,
     maar het beeld staat altijd op kleur. */
  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (0.5 - focusY) * size },
      /* UITGESPROKEN, niet subtiel (operator, 5 augustus 2026). Dit stond op
         0.87 tot 1.00: dertien procent verschil tussen volledig uitgeademd en
         volledig ingeademd. Dat is minder dan de ademhaling van de figuur
         zelf suggereert en je ziet het simpelweg niet — zeker niet als je
         probeert mee te ademen in plaats van te staren.
         Nu 0.70 tot 1.00, dus ruim veertig procent. De bovengrens blijft op
         één: het beeldvak snijdt bij, en een figuur die tegen zijn eigen rand
         aan groeit oogt afgekapt in plaats van vol. Groeien doen we dus door
         KLEINER te beginnen. */
      { scale: 0.7 + breath.value * 0.3 },
    ],
    opacity: 0.74 + breath.value * 0.26,
  }));

  /* De gloed loopt verder uit dan het beeld en zwelt sterker aan. Daardoor
     lijkt het licht van de figuur af te komen in plaats van erachter te
     hangen. Ook hier meer bodem: zonder gloed ligt een PNG op het zwart in
     plaats van erin te hangen, en dat is precies wat een illustratie levenloos
     maakt. */
  const glowStyle = useAnimatedStyle(() => ({
    /* De gloed zwelt harder mee dan het beeld zelf. Dat is wat een figuur
       laat ademen in plaats van alleen schalen: het licht komt op en zakt
       weg, en dat leest het oog eerder dan een maatverschil.
       `glowBoost`: zichtbaarder basis + amplitude, voor de plekken waar de
       gloed nu de ENIGE ademcue rond de figuur is (geen ringen meer). */
    opacity: (glowBoost ? 0.18 : 0.1) + breath.value * (glowBoost ? 0.5 : 0.38),
    transform: [
      { scale: (glowBoost ? 0.7 : 0.74) + breath.value * (glowBoost ? 0.44 : 0.34) },
    ],
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
    opacity: rings ? 0.06 + breath.value * 0.34 : 0,
    transform: [{ scale: 0.72 + breath.value * 0.36 }],
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
        source={{ uri: assetUri(SESSION_ART[art]) }}
        style={[{ width: size, height: size }, imgStyle]}
        resizeMode="contain"
      />
    </View>
  );
}
