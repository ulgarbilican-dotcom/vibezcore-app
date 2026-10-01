/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — BreathPacer

   Operator, 8 september 2026: eerste bouwsteen van de "Deep Tech"-visie.

   Iteratie 1 (react-native-skia, verworpen): schokkerig op een echt
   toestel — een 2D-pad dat elke frame opnieuw wordt opgebouwd via
   Reanimated `useDerivedValue` geeft nooit de vloeiende rotatie/diepte van
   een echte 3D-render, en de operator zag dat verschil meteen ("schokkende
   bewegingen, geen 3D-rotaties zoals bij u [de webmockup]").

   Iteratie 2 (dit bestand): ECHTE 3D via `expo-gl` + `three` — dezelfde
   techniek als de goedgekeurde webmockup (WebGL, een bol waarvan elke top
   volgens een golfpatroon verplaatst wordt, twee echte lichten), nu
   rechtstreeks op de GPU van het toestel via een `GLView`.

   Operator-fix: eerste versie bouwde `THREE.WebGLRenderer` rechtstreeks op
   (bewust GEEN `expo-three`, "één dependency minder"), en crashte meteen
   met "Property 'document' doesn't exist" — Three.js' renderer-constructor
   raadpleegt intern de browser-DOM tenzij hij via `expo-three`'s eigen
   `Renderer`-wrapper wordt opgezet, die dat specifiek dichtplakt. Dat
   dependency-argument klopte dus niet: `expo-three` lost hier een écht
   compatibiliteitsprobleem op, geen overbodige laag. `three` is teruggezet
   naar 0.166.1 — de versie die `expo-three@8` als peer-dependency vraagt.

   Segment-aantal bewust lager dan de webversie (32×24 i.p.v. 64×48): de
   top-verplaatsing loopt op de JS-thread (geen GPU-shader), en op een
   telefoon-CPU is dat de échte kostenpost, niet het polygonentelling zelf.
   32×24 blijft op dit formaat volledig vloeiend ogen.

   Puur presentatie — geen sessie-state, geen audio/haptiek. Bewust NOG
   NIET verbonden aan breath-session.tsx: dat bestand draagt de volledige,
   uitgebreid geteste sessielogica en wordt hier niet aangeraakt — dit is
   de eerste, losstaande bouwsteen uit een stap-voor-stap traject.
   ───────────────────────────────────────────────────────────────────────── */

import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';

/* 'inhale-2'/'exhale-2' — operator, 8 september 2026 (V1-protocolset):
   zelfde toevoeging als `PhaseKey` in data/breath-states.ts, nodig om
   Physiological Sigh en Alternate Nostril Breathing als `pattern`-prop
   door te kunnen geven. */
export type BreathPhaseKey =
  | 'inhale'
  | 'inhale-2'
  | 'hold-in'
  | 'exhale'
  | 'exhale-2'
  | 'hold-out';

export type BreathPhase = {
  key: BreathPhaseKey;
  /** Weergavetekst — Nederlandstalig hier omdat de operator dit zo vroeg
   *  ("Adem in", "Vast", "Adem uit"); de rest van de app draait Engels, dus
   *  dit blijft een expliciete `label` per fase, geen hardgecodeerde tekst
   *  in het component. */
  label: string;
  secs: number;
};

/** Standaard 4-4-4-4 Box Breathing — vervangbaar via de `pattern`-prop, dus
 *  dit component werkt evengoed voor Coherent (5-5) of Long Exhale (4-6). */
export const DEFAULT_BOX_PATTERN: BreathPhase[] = [
  { key: 'inhale', label: 'Adem in', secs: 4 },
  { key: 'hold-in', label: 'Vast', secs: 4 },
  { key: 'exhale', label: 'Adem uit', secs: 4 },
  { key: 'hold-out', label: 'Vast', secs: 4 },
];

/** Zelfde bolcoördinaten-golftechniek als de artifact-mockup: voor elke
 *  top wordt de hoek (theta/phi) t.o.v. het middelpunt gebruikt om een
 *  organische, nooit-herhalende vervorming te berekenen — geen ruis-
 *  textuur nodig, enkel een paar sinus-harmonischen. */
function wobbleAt(dir: THREE.Vector3, t: number, seed: number, amp: number) {
  const theta = Math.atan2(dir.y, dir.x);
  const phi = Math.acos(Math.min(1, Math.max(-1, dir.z)));
  const n =
    Math.sin(theta * 3 + seed + t * 0.6) * 0.5 +
    Math.sin(phi * 4 - seed * 1.3 + t * 0.4) * 0.35 +
    Math.sin(theta * 5 - phi * 2 + t * 0.8 + seed * 2) * 0.25;
  return 1 + amp * n;
}

type Props = {
  size?: number;
  accent?: string;
  pattern?: BreathPhase[];
};

export default function BreathPacer({
  size = 260,
  accent = '#B478FF',
  pattern = DEFAULT_BOX_PATTERN,
}: Props) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [secsLeft, setSecsLeft] = useState(pattern[0]?.secs ?? 4);

  /* De ademschaal (0.82..1.0) leeft in een ref, niet in Reanimated — de
     render-loop hieronder leest 'm rechtstreeks elke frame op de GL-thread,
     dus een aparte animatiebibliotheek voegt hier enkel overhead toe. */
  const scaleRef = useRef(0.86);
  const scaleFromRef = useRef(0.86);
  const scaleToRef = useRef(0.86);
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
        scaleToRef.current = 0.8;
        scaleDurRef.current = p.secs * 1000;
      } else {
        scaleToRef.current = scaleRef.current;
        scaleDurRef.current = 1;
      }
    };
    setPhaseIdx(0);
    setSecsLeft(left);
    animateFor(pattern[0], Date.now());
    const id = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        i = (i + 1) % pattern.length;
        left = pattern[i].secs;
        setPhaseIdx(i);
        animateFor(pattern[i], Date.now());
      }
      setSecsLeft(left);
    }, 1000);
    return () => clearInterval(id);
  }, [pattern]);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    /* `expo-three`'s Renderer i.p.v. rechtstreeks `THREE.WebGLRenderer` —
       zie de toelichting bovenaan dit bestand: Three.js' eigen constructor
       verwacht een browser-`document`, die er in React Native niet is. */
    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 20);
    camera.position.set(0, 0, 4.6);

    /* Operator, 8 september 2026 (2e poging — "erklopt letterlijk niets"):
       de eerste poging tekende de VOLLE 32×24 mesh als wireframe — dat is
       honderden korte driehoeksrandjes, en leest dus als ruis/kreukels, niet
       als de paar grote, vloeiende linten uit de mockup. Twee aparte
       geometrieën nu: een fijne voor de gladde gloeiende kern (zoals
       eerst), en een VEEL grovere (10×7) enkel voor de linten — minder
       hoekpunten = minder, langere, herkenbare lijnen. Beide delen dezelfde
       `wobbleAt`-vervorming (zelfde seed) zodat ze in dezelfde vorm
       "ademen", ook al zijn het twee losse buffers. */
    const geo = new THREE.SphereGeometry(1, 32, 24);
    const posAttr = geo.attributes.position;
    const baseDirs: THREE.Vector3[] = [];
    for (let i = 0; i < posAttr.count; i++) {
      baseDirs.push(
        new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).normalize(),
      );
    }

    const wireGeo = new THREE.SphereGeometry(1, 10, 7);
    const wirePosAttr = wireGeo.attributes.position;
    const wireBaseDirs: THREE.Vector3[] = [];
    for (let i = 0; i < wirePosAttr.count; i++) {
      wireBaseDirs.push(
        new THREE.Vector3(wirePosAttr.getX(i), wirePosAttr.getY(i), wirePosAttr.getZ(i)).normalize(),
      );
    }

    /* Veel doorschijnender + geen clearcoat/roughness-sheen (dat gaf het
       "plastic bal"-effect) — de kern is nu een zachte gloed, geen
       ondoorzichtig object; de linten hieronder dragen de vorm. */
    const mat = new THREE.MeshPhysicalMaterial({
      color: accentRef.current,
      roughness: 0.2,
      metalness: 0,
      transparent: true,
      opacity: 0.32,
      emissive: new THREE.Color(accentRef.current),
      emissiveIntensity: 0.55,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    /* De linten: helder, additive, geen depthWrite (zodat lagen door
       elkaar heen lichten i.p.v. elkaar wegsnijden) — dit draagt nu het
       grootste deel van de "geweven energie"-look. */
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xd7ecff,
      wireframe: true,
      wireframeLinewidth: 2,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    wireMesh.scale.setScalar(1.03);
    scene.add(wireMesh);

    scene.add(new THREE.AmbientLight(0x2a2a2e, 1.1));
    const key = new THREE.PointLight(0xffffff, 2.6, 12);
    key.position.set(2.4, 2.6, 3.2);
    scene.add(key);
    const rim = new THREE.PointLight(accentRef.current, 3.4, 14);
    rim.position.set(-2.6, -1.4, -2.2);
    scene.add(rim);

    let raf = 0;
    const seed = 1.3;
    const start = Date.now();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = Date.now();
      const t = (now - start) / 1000;

      const elapsed = now - scaleStartRef.current;
      const localT = Math.min(1, Math.max(0, elapsed / scaleDurRef.current));
      /* out(sin): meteen zichtbaar bij de overgang, remt pas af richting
         het uiterste — zelfde curve als breath-session.tsx z'n ademfiguur. */
      const eased = Math.sin((localT * Math.PI) / 2);
      scaleRef.current =
        scaleFromRef.current + (scaleToRef.current - scaleFromRef.current) * eased;

      const breathScale = scaleRef.current;
      /* 0.15 → 0.09: de vorige amplitude liet de bol als een verkreukelde
         bal ogen (zichtbaar in de screenshot die de operator terugstuurde);
         de mockup ademt zacht en rond, geen lucht-die-ontsnapt-vervorming. */
      const amp = 0.09 * (0.7 + (breathScale - 0.82) * 1.4);
      const pos = geo.attributes.position;
      for (let i = 0; i < baseDirs.length; i++) {
        const d = baseDirs[i];
        const w = wobbleAt(d, t, seed, amp);
        const r = breathScale * w;
        pos.setXYZ(i, d.x * r, d.y * r, d.z * r);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();

      /* Zelfde vervorming, eigen (grove) buffer — zie toelichting hierboven
         bij `wireGeo`. */
      const wirePos = wireGeo.attributes.position;
      for (let i = 0; i < wireBaseDirs.length; i++) {
        const d = wireBaseDirs[i];
        const w = wobbleAt(d, t, seed, amp);
        const r = breathScale * w;
        wirePos.setXYZ(i, d.x * r, d.y * r, d.z * r);
      }
      wirePos.needsUpdate = true;

      mesh.rotation.y = t * 0.22;
      mesh.rotation.x = Math.sin(t * 0.15) * 0.15;
      /* Zelfde rotatie als de kern — nu ze allebei op DEZELFDE vervorming
         bewegen (i.p.v. de vorige losse, tragere draai) sluiten de linten
         weer aan bij de vorm eronder i.p.v. erlangs te schuiven. */
      wireMesh.rotation.y = t * 0.22;
      wireMesh.rotation.x = Math.sin(t * 0.15) * 0.15;

      if (mat.color.getHexString() !== accentRef.current.replace('#', '').toLowerCase()) {
        mat.color.set(accentRef.current);
        mat.emissive.set(accentRef.current);
        rim.color.set(accentRef.current);
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    frame();

    return () => cancelAnimationFrame(raf);
  };

  const glViewRef = useRef<{ cleanup?: () => void }>({});

  /* Operator, 8 september 2026: "verwijder de tekst in de bol zelf" — de
     INHALE/EXHALE-label + aftellende seconden zijn weg. `phaseIdx`/
     `secsLeft` blijven bestaan (ze sturen nog steeds de schaal-animatie
     hierboven), enkel de tekstweergave ervan is weg. */
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <GLView
        style={StyleSheet.absoluteFill}
        onContextCreate={(gl) => {
          glViewRef.current.cleanup = onContextCreate(gl);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
