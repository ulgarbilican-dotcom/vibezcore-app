/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — LotusPacer (PROTOTYPE, operator 9 september 2026)

   Vraag van de operator: kunnen de 5 platte 2D-staat-illustraties
   (src/components/SessionArt.tsx — sun/flower/lotus/crystal/tree) ook als
   ademende, draaiende 3D-objecten bestaan, in dezelfde animatietaal als
   BreathPacer.tsx (schaal-puls op in/vast/uit, trage continue rotatie)?
   Dit bestand is de EERSTE proef, uitsluitend voor de Lotus (Calm Control,
   #B478FF) — nog niet de andere 4 vormen, nog nergens productie-verbonden.

   Operator, 9 september 2026 (2e ronde, na de eerste procedurele proef):
   "het idee is goed maar ziet er niet uit als een lotus" / "ik vind onze
   huidige lotus echt mooi... die lotus dat er nu staat exact in 3d rond
   eigen as en ademen" — een met `THREE.Shape`-blaadjes NAGEBOUWDE lotus zal
   nooit het echte, operator-aangeleverde beeld evenaren. Exact hetzelfde
   punt staat al in SessionArt.tsx (het 2D-bestand hiernaast): "die
   referenties zijn gerenderde illustraties... ik teken met paden en gloed;
   dat haalt dat niveau nooit." Dus: geen procedurele geometrie meer. Deze
   versie gebruikt de ECHTE PNG (`SESSION_ART.lotus`, dezelfde bron als het
   platte scherm) als textuur op twee loodrecht gekruiste vlakken (een
   klassieke "billboard cross" — hetzelfde trucje als bomen/gras in
   3D-games): één plat vlak zou bij 90° zijwaarts helemaal verdwijnen
   (geen dikte), twee gekruiste vlakken tonen vanuit vrijwel elke hoek
   rond de Y-as nog steeds de volle bloem. Geen open/dicht-animatie meer
   (dat vroeg de operator expliciet NIET) — enkel schaal-ademen + trage
   rotatie om de eigen as, exact zoals bij BreathPacer.

   Scaffolding (GLView/Renderer/scene/camera/frame-loop) blijft 1-op-1
   gekopieerd van BreathPacer.tsx — zie de toelichting daar voor waarom
   `expo-three`'s `Renderer` verplicht is i.p.v. `THREE.WebGLRenderer`
   rechtstreeks ("Property 'document' doesn't exist" anders). Textuur laden
   via `expo-three`'s `loadTextureAsync` — dezelfde weg als `Asset.fromURI`
   + `downloadAsync` die de rest van de app al gebruikt voor deze CDN-URL's
   (`services/asset-cache.ts`), dus geen nieuw laadpad nodig.
   `BreathPhase`/`DEFAULT_BOX_PATTERN` komen uit BreathPacer.tsx — bewust
   niet opnieuw gedefinieerd, één bron van waarheid voor het fase-patroon.
   ───────────────────────────────────────────────────────────────────────── */

import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer, loadTextureAsync } from 'expo-three';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import { assetUri } from '@/services/asset-cache';
import { SESSION_ART } from './SessionArt';
import { DEFAULT_BOX_PATTERN, type BreathPhase } from './BreathPacer';

/* Operator, 9 september 2026 (6e ronde): "kunnen we eerst 2 proberen dan
   beslis ik" — twee kant-en-klare richtingen naast elkaar, geen van beide
   vervangt de andere totdat de operator kiest:
   - 'sway'       de foto als vlak (huidige, 5e ronde): altijd naar de
                   camera, ademen + zachte wiegel. Nooit "plat van opzij"
                   omdat hij nooit ver genoeg draait om dat te tonen.
   - 'volumetric' echte 3D-blaadjesgeometrie (de allereerste proef), nu met
                   de echte foto als textuur i.p.v. een effen kleur — wél
                   volle, continue rotatie, want dit heeft écht volume en
                   dus geen frontale-foto-probleem. Elk blaadje toont
                   dezelfde uitsnede van de foto (gedeelde geometrie/UV's,
                   geen per-blaadje crop beschikbaar) — kleur/textuur-getrouw
                   aan het origineel, niet pixel-exact per blaadje. */
type Variant = 'sway' | 'volumetric';

type Props = {
  size?: number;
  accent?: string;
  pattern?: BreathPhase[];
  variant?: Variant;
};

/** Eén blaadje: vlakke, getailleerde Shape met afgeronde top (niet-scherpe
 *  punt) en brede buik — getuned in de 2e ronde na "ziet er niet uit als een
 *  lotus, te smal/scherp/vlamvormig". */
function petalShape(length: number, width: number): THREE.Shape {
  const tip = width * 0.08;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width * 0.62, length * 0.1, width * 0.6, length * 0.6, tip, length * 0.96);
  shape.quadraticCurveTo(0, length, -tip, length * 0.96);
  shape.bezierCurveTo(-width * 0.6, length * 0.6, -width * 0.62, length * 0.1, 0, 0);
  return shape;
}

function buildPetalLayer(
  count: number,
  length: number,
  width: number,
  tiltDeg: number,
  yOffset: number,
  depthSegments: number,
): THREE.Mesh[] {
  const geo = new THREE.ExtrudeGeometry(petalShape(length, width), {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 3,
    curveSegments: depthSegments,
  });
  geo.translate(0, 0, -0.01);

  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo);
    const angle = (i / count) * Math.PI * 2;
    const tilt = (tiltDeg * Math.PI) / 180;
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = angle;
    mesh.rotation.x = -tilt;
    mesh.position.y = yOffset;
    meshes.push(mesh);
  }
  return meshes;
}

export default function LotusPacer({
  size = 260,
  accent = '#B478FF',
  pattern = DEFAULT_BOX_PATTERN,
  variant = 'sway',
}: Props) {
  /* Zelfde ref-gebaseerde ademschaal-aanpak als BreathPacer: geen
     Reanimated nodig, de GL-frameloop leest deze refs rechtstreeks. */
  const scaleRef = useRef(0.9);
  const scaleFromRef = useRef(0.9);
  const scaleToRef = useRef(0.9);
  const scaleStartRef = useRef(0);
  const scaleDurRef = useRef(1);
  const accentRef = useRef(accent);
  accentRef.current = accent;

  useEffect(() => {
    let i = 0;
    let left = pattern[0]?.secs ?? 4;
    const animateFor = (p: BreathPhase, atMs: number) => {
      scaleStartRef.current = atMs;
      scaleFromRef.current = scaleRef.current;
      if (p.key === 'inhale' || p.key === 'inhale-2') {
        scaleToRef.current = 1;
        scaleDurRef.current = p.secs * 1000;
      } else if (p.key === 'exhale' || p.key === 'exhale-2') {
        scaleToRef.current = 0.86;
        scaleDurRef.current = p.secs * 1000;
      } else {
        scaleToRef.current = scaleRef.current;
        scaleDurRef.current = 1;
      }
    };
    animateFor(pattern[0], Date.now());
    const id = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        i = (i + 1) % pattern.length;
        left = pattern[i].secs;
        animateFor(pattern[i], Date.now());
      }
    }, 1000);
    return () => clearInterval(id);
  }, [pattern]);

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 20);
    if (variant === 'volumetric') {
      /* Verhoogde 3/4-hoek zodat de echte 3D-blaadjesgeometrie meteen als
         vorm leesbaar is tijdens het draaien — zelfde reden als de
         allereerste procedurele proef. */
      camera.position.set(0, 1.0, 3.6);
    } else {
      camera.position.set(0, 0.25, 3.4);
    }
    camera.lookAt(0, 0, 0);

    const lotus = new THREE.Group();
    scene.add(lotus);

    /* Zachte gloed-halo achter de bloem — additive, grotere bol (BackSide
       zodat je 'm van binnenuit ziet) in de accentkleur. Zelfde techniek
       als de ademcirkel op breath-setup.tsx eerder deze sessie: zonder dit
       plakt de foto plat op het zwart i.p.v. erin te hangen (exact het punt
       dat SessionArt.tsx voor de 2D-versie al maakt). */
    const glowGeo = new THREE.SphereGeometry(1.7, 24, 18);
    const glowMat = new THREE.MeshBasicMaterial({
      color: accentRef.current,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);

    /* De ECHTE illustratie als textuur — zelfde CDN-bron/lokale cache als
       het platte scherm (`assetUri`, services/asset-cache.ts), dus geen
       tweede downloadpad voor hetzelfde bestand. Beide varianten gebruiken
        'm. */
    const texture = await loadTextureAsync({ asset: assetUri(SESSION_ART.lotus) });
    texture.colorSpace = THREE.SRGBColorSpace;

    const photoMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
      depthWrite: true,
    });

    let outer: THREE.Mesh[] = [];
    let inner: THREE.Mesh[] = [];

    if (variant === 'volumetric') {
      /* Echte 3D-geometrie — kan zonder probleem volledig ronddraaien,
         want dit heeft écht volume (geen platte-foto-limiet). Zelfde
         blaadjesvorm/lagen-opzet als de allereerste proef, nu met de echte
         foto als materiaal i.p.v. een effen kleur. */
      outer = buildPetalLayer(8, 1.1, 0.79, 58, -0.06, 16);
      inner = buildPetalLayer(8, 0.72, 0.49, 30, 0.08, 14);
      outer.forEach((m) => {
        m.material = photoMat;
        lotus.add(m);
      });
      inner.forEach((m) => {
        m.rotation.y += Math.PI / 8;
        m.material = photoMat;
        lotus.add(m);
      });
    } else {
      const img = texture.image as { width?: number; height?: number } | undefined;
      const aspect = img?.width && img?.height ? img.width / img.height : 1;
      const planeH = 2.15;
      const planeW = planeH * aspect;
      /* Operator, 9 september 2026 (3e ronde, geldt voor 'sway'): een
         lichte koepel-welving (subtiele z-uitstulping naar het midden toe)
         zodat het vlak zelf ook al een beetje rondt i.p.v. kaarsrecht — een
         opgeblazen kussentje, geen platte kaart. */
      const segs = 24;
      const planeGeo = new THREE.PlaneGeometry(planeW, planeH, segs, segs);
      const domeDepth = 0.16;
      const pos = planeGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) / (planeW / 2);
        const y = pos.getY(i) / (planeH / 2);
        const r = Math.min(1, Math.sqrt(x * x + y * y));
        const bulge = Math.cos((r * Math.PI) / 2); // 1 in het midden, 0 aan de rand
        pos.setZ(i, bulge * domeDepth);
      }
      planeGeo.computeVertexNormals();

      /* Operator, 9 september 2026 (5e ronde): "normaal zou je de vlakke
         kant van de bladeren moeten zien... denk hoe een bloem er in het
         echte leven uitziet als je er rond gaat" — terecht: de foto is EEN
         frontale opname, dus geen volle rotatie meer (zie module-comment
         bovenaan), enkel dit ene vlak dat altijd grotendeels naar de camera
         gericht blijft. */
      const face = new THREE.Mesh(planeGeo, photoMat);
      lotus.add(face);
    }

    let raf = 0;
    const start = Date.now();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = Date.now();
      const t = (now - start) / 1000;

      const elapsed = now - scaleStartRef.current;
      const localT = Math.min(1, Math.max(0, elapsed / scaleDurRef.current));
      const eased = Math.sin((localT * Math.PI) / 2);
      scaleRef.current =
        scaleFromRef.current + (scaleToRef.current - scaleFromRef.current) * eased;

      /* "Ademen" = schaal-puls, geen vorm-verandering — exact wat de
         operator vroeg ("moet niet perse open en dicht gaan"), voor beide
         varianten. */
      lotus.scale.setScalar(scaleRef.current);
      glow.scale.setScalar(0.92 + 0.1 * scaleRef.current);

      if (variant === 'volumetric') {
        /* Trage, continue rotatie rond de eigen Y-as — kan hier gewoon
           volledig, want echte geometrie toont vanuit elke hoek volume. */
        lotus.rotation.y = t * 0.22;
      } else {
        /* Lichte, trage wiegel i.p.v. een volle rotatie — zie module- en
           blok-commentaar hierboven voor waarom. */
        lotus.rotation.y = Math.sin(t * 0.35) * 0.26;
        lotus.rotation.x = Math.sin(t * 0.23 + 1.1) * 0.05;
      }

      if (
        glowMat.color.getHexString() !== accentRef.current.replace('#', '').toLowerCase()
      ) {
        glowMat.color.set(accentRef.current);
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    frame();

    return () => cancelAnimationFrame(raf);
  };

  const glViewRef = useRef<{ cleanup?: () => void }>({});

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <GLView
        style={StyleSheet.absoluteFill}
        onContextCreate={(gl) => {
          onContextCreate(gl).then((cleanup) => {
            glViewRef.current.cleanup = cleanup;
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
