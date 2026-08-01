/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Sessiescherm (CALM · Lotus)

   Namen, teksten en kleur volgens de operator, 1 augustus 2026:

     BOOST    Radiating Sun    Amber / goud
     FOCUS    Flower of Life   Electric blue
     CALM     Lotus            Violet          ← dit scherm
     CLARITY  Crystal Grid     Cyan / ijsblauw
     REST     Soft Orb         Zacht indigo

   "Crystal Grid" verving "Hexagonal Grid" — dat laatste klonk als een
   wiskundeterm en niet als een toestand.

   Vier dingen die deze versie anders doet dan de vorige:

     GEEN VOICE/HAPTICS VOORAF
       Die stonden op de startpagina terwijl er nog niets liep. Ze horen
       bij het luisteren, niet bij het kiezen. Op de startpagina staat nu
       het ademritme zelf — inclusief door welke opening je ademt, want dat
       was nergens af te lezen

     GEEN BRACELET TIJDENS DE SESSIE
       Wie ademt moet niet naar een product kijken. De kaart staat alleen
       vooraf

     DUUR MET UITLEG
       Elke lengte heeft een naam en een reden. Tikken op een keuze
       selecteert hem; tikken op de gekozen keuze opent waarom die lengte
       bestaat. Geen enkele duur is "de juiste" — dat staat er ook

     ADEMRITME ZICHTBAAR
       Vier fasen naast elkaar met hun seconden en hun opening. Tijdens de
       sessie licht de fase op waar je in zit

   Rondes zijn leidend, minuten zijn het label: een cyclus van zestien
   seconden past niet in zestig, dus alleen twintig minuten landt precies.
   Daarom staat de exacte tijd erbij.
   ───────────────────────────────────────────────────────────────────────── */

import SessionArt, { prefetchSessionArt } from '@/components/SessionArt';
import Starfield from '@/components/Starfield';
import { Brand, BrandFonts } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';
import {
  claimVoiceSource,
  playBreathCue,
  releaseVoiceSource,
  stopVoice,
} from '@/services/breath-voice';
import {
  BlurMask,
  Canvas,
  Circle,
  LinearGradient,
  Path,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { ChevronRight, Settings, Volume2, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

/* Het BEELD is breder dan het scherm. De aangeleverde PNG's hebben een
   royale lege rand — bij de lotus vult de bloem maar zo'n tweederde van de
   breedte en veertig procent van de hoogte. Door het beeld ruim over de
   schermbreedte heen te schalen en het zichtbare vlak eromheen smal te
   houden, vult het ONDERWERP het scherm in plaats van de rand.
   Tijdens de sessie mag hij groter: de titeltekst is dan weg. */
const ART_IDLE = SCREEN_W * 1.0;
const ART_RUN = SCREEN_W * 1.18;

/* Zichtbare hoogte, als deel van de beeldbreedte.
   MOET groter zijn dan wat het onderwerp zelf inneemt — de lotus vult
   ongeveer 42% van de beeldhoogte, en bij 38% werden de onderste blaadjes
   er recht afgesneden. 52% laat er aan beide kanten marge omheen, ook op
   het hoogtepunt van de inademing wanneer de bloem het grootst is. */
const ART_H_RATIO = 0.52;

/* Hoogte van de knop onderaan. De scroll houdt precies dit plus de
   toestel-inzet vrij, zodat de laatste kaart nooit onder de knop verdwijnt
   en er ook geen willekeurig gat overblijft. */
const BTN_H = 50;
const FOOTER_H = BTN_H + 6;
/* Waar de bloem verticaal in haar eigen bestand staat. Niet in het midden. */
const ART_FOCUS_Y = 0.43;

/* ── Kleur van deze toestand ─────────────────────────────────────────────
   Let op: CLAUDE.md §5 geeft de bracelet-modus Calm Control blauw
   (#0A84FF). De ademsessie draait vanaf nu violet, op verzoek van de
   operator. Die twee lopen dus uiteen terwijl ze dezelfde naam dragen —
   bewust, en te herzien als de bracelet mee moet. */
const ACCENT = '#B478FF';
const ACCENT_SOFT = 'rgba(180,120,255,0.15)';
const GLOW = '#7B2FE0';

/* ── Het patroon ─────────────────────────────────────────────────────── */

type Phase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

type PhaseDef = {
  key: Phase;
  label: string;
  secs: number;
  /** Waar de lucht langs gaat. Leeg tijdens vasthouden. */
  via: 'Nose' | 'Mouth' | null;
  /** Trillingsduur, gelijk aan (tabs)/breath.tsx. */
  vib: number;
};

/* Box breathing: vier gelijke fasen, alles door de neus. */
const PHASES: PhaseDef[] = [
  { key: 'inhale', label: 'INHALE', secs: 4, via: 'Nose', vib: 60 },
  { key: 'hold-in', label: 'HOLD', secs: 4, via: null, vib: 30 },
  { key: 'exhale', label: 'EXHALE', secs: 4, via: 'Nose', vib: 80 },
  { key: 'hold-out', label: 'HOLD', secs: 4, via: null, vib: 30 },
];

const CYCLE_S = PHASES.reduce((s, p) => s + p.secs, 0);
const byKey = (k: Phase) => PHASES.find((p) => p.key === k)!;
const nextOf = (k: Phase) =>
  PHASES[(PHASES.findIndex((p) => p.key === k) + 1) % PHASES.length];

/* ── De vier lengtes ─────────────────────────────────────────────────── */

type Duration = {
  minutes: number;
  rounds: number;
  name: string;
  why: string;
  recommended?: boolean;
};

const DURATIONS: Duration[] = [
  {
    minutes: 3,
    rounds: 11,
    name: 'Quick Calm',
    why: 'For when tension needs to come off and there is no time to sit down for it. Eleven rounds is enough to notice the rhythm take over.',
  },
  {
    minutes: 5,
    rounds: 19,
    name: 'Daily Calm',
    why: 'The everyday length. Long enough to settle into, short enough that you keep coming back to it — which matters more than any single session.',
    recommended: true,
  },
  {
    minutes: 10,
    rounds: 38,
    name: 'Deep Calm',
    why: 'For when there is time. Somewhere past the halfway mark the counting stops being something you follow and starts running by itself.',
  },
  {
    minutes: 20,
    rounds: 75,
    name: 'Extended Calm',
    why: 'A full session, and the length most often used in studies of slow paced breathing. There is no evidence that longer is better — this is simply the far end of the range.',
  },
];

const DEFAULT_DURATION = 1;

const BRACELET_IMG =
  'https://vibezcore-audio.b-cdn.net/images/Shattudkite_vzc_fiv%20no%20bg.png';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ── De boog in het ritmeblok ────────────────────────────────────────── */
const ARC_H = 104;

function PhaseArc({
  width,
  progress,
}: {
  width: number;
  progress: SharedValue<number>;
}) {
  const cx = width / 2;
  /* Ruim genoeg zodat het getal ERIN past en niet erover. */
  const r = Math.min(width * 0.46, 96);
  const cy = ARC_H - 6;

  const track = useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2), 180, 180);
    return p;
  }, [cx, cy, r]);

  const dotX = useDerivedValue(() => {
    const a = ((180 + 180 * progress.value) * Math.PI) / 180;
    return cx + Math.cos(a) * r;
  });
  const dotY = useDerivedValue(() => {
    const a = ((180 + 180 * progress.value) * Math.PI) / 180;
    return cy + Math.sin(a) * r;
  });
  const end = useDerivedValue(() => Math.max(0.0001, progress.value));

  return (
    <Canvas style={{ width, height: ARC_H }} pointerEvents="none">
      <Path
        path={track}
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
        color="rgba(255,255,255,0.09)"
      />
      <Path
        path={track}
        style="stroke"
        strokeWidth={2.6}
        strokeCap="round"
        start={0}
        end={end}
      >
        <LinearGradient
          start={vec(cx - r, cy)}
          end={vec(cx + r, cy)}
          colors={['#6B2FBF', ACCENT, '#E2C6FF']}
        />
      </Path>
      <Circle cx={dotX} cy={dotY} r={7} color={ACCENT} opacity={0.5}>
        <BlurMask blur={7} style="normal" />
      </Circle>
      <Circle cx={dotX} cy={dotY} r={3.6} color="#ffffff" />
    </Canvas>
  );
}

/* ── Scherm ──────────────────────────────────────────────────────────── */

export default function BreathSessionScreen() {
  /* De onderrand komt van het TOESTEL, niet van een gok. SafeAreaView deed
     de onderkant eerder zelf, maar een vastgezette voet valt buiten die
     opvulling — vandaar dat de knop tegen de home-balk aan lag. Nu rekenen
     we de inzet expliciet mee, op de enige plek waar hij telt. */
  const insets = useSafeAreaInsets();

  const [durationIdx, setDurationIdx] = useState<number>(DEFAULT_DURATION);
  const [infoIdx, setInfoIdx] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const sub = useSubscription();
  const isPro = sub.isPro || sub.hasBracelet;

  const [voiceOn, setVoiceOn] = useState(true);
  const [hapticsOn, setHapticsOn] = useState(true);

  const [phase, setPhase] = useState<Phase>('inhale');
  const [secsLeft, setSecsLeft] = useState(PHASES[0].secs);
  const [round, setRound] = useState(1);

  const chosen = DURATIONS[durationIdx];
  const totalSec = chosen.rounds * CYCLE_S;

  /* De fase-loop draait buiten React om, dus de actuele instellingen komen
     uit refs. Anders leest een lopende sessie de waarden van de render
     waarin hij begon. */
  const voiceRef = useRef(voiceOn);
  const hapticRef = useRef(hapticsOn);
  const roundsRef = useRef(chosen.rounds);
  /* Bewust GEEN setVoiceEnabled hier. Dit scherm heeft een eigen knop; die
     hoort de globale voorkeur in Settings niet stilletjes te overschrijven.
     Deed het dat wel, dan bleef de app na één keer uitzetten overal stil —
     ook in de onboarding, zonder dat iemand snapte waarom. */
  useEffect(() => {
    voiceRef.current = voiceOn;
    if (!voiceOn) stopVoice();
  }, [voiceOn]);
  useEffect(() => {
    hapticRef.current = hapticsOn;
  }, [hapticsOn]);
  useEffect(() => {
    roundsRef.current = chosen.rounds;
  }, [chosen.rounds]);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Eén ademwaarde stuurt de hele figuur. Vóór de start loopt hij rustig
     rond zodat het scherm leeft; bij de start neemt het echte patroon het
     over. Dat is dezelfde waarde, dus de overgang is naadloos. */
  const breath = useSharedValue(0);
  const arc = useSharedValue(0);

  const idleBreathing = useCallback(() => {
    cancelAnimation(breath);
    breath.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath]);

  useEffect(() => {
    idleBreathing();
    prefetchSessionArt();
  }, [idleBreathing]);

  const clearTimers = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (nextRef.current) clearTimeout(nextRef.current);
    tickRef.current = null;
    nextRef.current = null;
  }, []);

  const stopAll = useCallback(() => {
    clearTimers();
    Vibration.cancel();
    stopVoice();
    cancelAnimation(arc);
    arc.value = 0;
  }, [arc, clearTimers]);

  /* Staat bewust vóór runPhase: de laatste ronde roept dit aan.
     `completed` onderscheidt uitgelopen van afgebroken — alleen een
     afgemaakte sessie verdient een afsluitscherm. */
  const finish = useCallback((completed = false) => {
    stopAll();
    if (completed) setDone(true);
    setRunning(false);
    setRound(1);
    setPhase('inhale');
    setSecsLeft(PHASES[0].secs);
    idleBreathing();
    releaseVoiceSource('breath');
  }, [idleBreathing, stopAll]);

  /* ── De fase-loop ──────────────────────────────────────────────────── */
  const runPhase = useCallback(
    (k: Phase, r: number) => {
      const def = byKey(k);
      setPhase(k);
      setSecsLeft(def.secs);

      if (hapticRef.current) {
        try {
          Vibration.vibrate(def.vib);
        } catch {}
      }
      if (voiceRef.current) {
        /* `force`, want dit scherm heeft een eigen zichtbare Voice-knop.
           Staat die op ON, dan is dat de keuze van de gebruiker — die hoort
           niet alsnog overruled te worden door een instelling elders. */
        playBreathCue(k, 'nose', 'calm', 'breath', true);
      }

      /* Beeld: alleen in- en uitademen bewegen. Tijdens het vasthouden
         blijft de vorm staan waar hij staat — dat is wat vasthouden ís. */
      if (k === 'inhale' || k === 'exhale') {
        breath.value = withTiming(k === 'inhale' ? 1 : 0, {
          duration: def.secs * 1000,
          easing: Easing.inOut(Easing.sin),
        });
      }

      arc.value = 0;
      arc.value = withTiming(1, {
        duration: def.secs * 1000,
        easing: Easing.linear,
      });

      let left = def.secs;
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        left -= 1;
        setSecsLeft(left);
        if (left <= 0) {
          if (tickRef.current) clearInterval(tickRef.current);
          tickRef.current = null;
          /* Nul laten renderen vóór de fase wisselt, anders blijft "1"
             even hangen op de overgang. */
          nextRef.current = setTimeout(() => {
            if (k === 'hold-out') {
              const n = r + 1;
              if (n > roundsRef.current) {
                finish(true);
                return;
              }
              setRound(n);
              runPhase('inhale', n);
            } else {
              runPhase(nextOf(k).key, r);
            }
          }, 0);
        }
      }, 1000);
    },
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [arc, breath, finish],
  );

  const start = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    claimVoiceSource('breath');
    setRunning(true);
    setRound(1);
    cancelAnimation(breath);
    breath.value = 0;
    runPhase('inhale', 1);
  }, [breath, runPhase]);

  const stop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    finish();
  }, [finish]);

  useEffect(
    () => () => {
      stopAll();
      releaseVoiceSource('breath');
    },
    [stopAll],
  );

  /* Eerste tik kiest, tweede tik legt uit. Zo hoeft er geen extra
     info-knopje naast te staan. */
  const pickDuration = (i: number) => {
    if (running) return;
    Haptics.selectionAsync();
    if (i === durationIdx) setInfoIdx(i);
    else setDurationIdx(i);
  };

  /* Verstreken tijd wordt AFGELEID uit de fase-lus, niet apart geteld. Een
     tweede timer naast de eerste loopt onvermijdelijk uit de pas. */
  const idx = PHASES.findIndex((p) => p.key === phase);
  const elapsed =
    (round - 1) * CYCLE_S +
    PHASES.slice(0, idx).reduce((s, p) => s + p.secs, 0) +
    (byKey(phase).secs - secsLeft);
  const leftSec = Math.max(0, totalSec - elapsed);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Ruimte achter alles. Eén kleur, lage dichtheid, traag fonkelen —
          het geeft diepte zodat de figuur ergens IN hangt in plaats van
          op een zwart vlak te liggen. Ligt onder alle content. */}
      <View style={s.stars} pointerEvents="none">
        <Starfield
          width={SCREEN_W}
          height={SCREEN_H}
          count={70}
          color="#C9A7FF"
        />
      </View>

      <View style={s.topbar}>
        <Pressable
          onPress={() => (running ? stop() : router.back())}
          hitSlop={12}
          style={s.iconBtn}
        >
          <X size={18} color="rgba(255,255,255,0.72)" strokeWidth={2.2} />
        </Pressable>
        <Text style={s.eyebrow}>CALM</Text>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          style={s.iconBtn}
        >
          <Settings size={17} color="rgba(255,255,255,0.72)" strokeWidth={2} />
        </Pressable>
      </View>

      {/* `flex: 1` is hier niet cosmetisch. Zonder dat krimpt een ScrollView
          in React Native niet mee — hij groeit met zijn inhoud en duwt de
          voet onder de schermrand. Dat was precies waarom START SESSION
          soms verdween en er geen manier meer was om opnieuw te beginnen. */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={[
          s.scroll,
          running && s.scrollRunning,
          { paddingBottom: FOOTER_H + insets.bottom + 18 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>Lotus</Text>

        {/* Weg zodra de sessie loopt. Wie ademt leest niet. */}
        {!running && (
          <>
            <Text style={s.tagline}>Stillness in motion.</Text>
            <Text style={s.desc}>
              Soft petals gently unfold with each breath,{'\n'}
              encouraging relaxation, emotional balance{'\n'}
              and a growing sense of calm.
            </Text>
          </>
        )}

        {/* Het beeld is vierkant, maar een lotus is breder dan hoog: de
            bovenste en onderste marge blijven leeg. Die snijden we weg,
            zodat de bloem groot blijft zonder een vijfde van het scherm
            aan niets te besteden. */}
        <View style={s.visualWrap}>
          <SessionArt
            size={running ? ART_RUN : ART_IDLE}
            art="lotus"
            breath={breath}
            glow={GLOW}
            heightRatio={ART_H_RATIO}
            focusY={ART_FOCUS_Y}
            rings={running}
          />
        </View>

        {/* Voortgang: ÉÉN regel in plaats van vier blokken boven elkaar.
            Stond hier eerder als ROUND / tijd / LEFT / balk onder elkaar,
            samen bijna negentig punten hoog — dat drukte tegen de figuur
            aan. Een rondeteller is bijzaak tijdens het ademen; hij hoort
            leesbaar te zijn, niet groot. */}
        {running ? (
          <View style={s.progressWrap}>
            <Text style={s.progressRound}>
              ROUND {round} / {chosen.rounds}
            </Text>
            <Text style={s.progressLeft}>{fmt(leftSec)} left</Text>
            <View style={s.bar}>
              <View
                style={[
                  s.barFill,
                  { width: `${Math.min(100, (elapsed / totalSec) * 100)}%` },
                ]}
              />
            </View>
          </View>
        ) : (
          <View style={s.durationWrap}>
            <Text style={s.sectionEyebrow}>SESSION DURATION</Text>
            <View style={s.chips}>
              {DURATIONS.map((d, i) => {
                const active = i === durationIdx;
                return (
                  <Pressable
                    key={d.minutes}
                    onPress={() => pickDuration(i)}
                    style={[s.chip, active && s.chipActive]}
                  >
                    <Text style={[s.chipTxt, active && s.chipTxtActive]}>
                      {d.minutes}
                      <Text style={s.chipUnit}> MIN</Text>
                    </Text>
                    <Text style={[s.chipName, active && s.chipNameActive]}>
                      {d.name.replace(' Calm', '')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.exact}>
              {fmt(totalSec)} · {chosen.rounds} rounds
              {chosen.recommended ? ' · recommended' : ''}
            </Text>
            <Text style={s.hint}>Double tap for more info</Text>
          </View>
        )}

        {/* ── Ademritme. Vooraf stil en volledig; tijdens de sessie licht
             de fase op waar je in zit. ── */}
        {!running ? (
          <View style={s.patternCard}>
            <Text style={s.cardEyebrow}>BREATHING PATTERN</Text>
            <View style={s.phaseRow}>
              {PHASES.map((p, i) => (
                <View key={i} style={s.phaseCol}>
                  <Text style={s.phaseSecsSmall}>{p.secs}s</Text>
                  <Text style={s.phaseName}>{p.label}</Text>
                  {/* Dit ontbrak: nergens was af te lezen of je door de
                      neus of door de mond ademt. */}
                  <Text style={p.via ? s.phaseVia : s.phaseViaNone}>
                    {p.via ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={s.patternFoot}>Box Breathing · 4-4-4-4</Text>
          </View>
        ) : (
          <View style={s.rhythmCard}>
            <Pressable
              onPress={() => setVoiceOn((v) => !v)}
              style={s.channel}
              hitSlop={8}
            >
              <Volume2
                size={19}
                color={voiceOn ? ACCENT : 'rgba(255,255,255,0.3)'}
                strokeWidth={2.2}
              />
              <Text style={[s.channelLabel, !voiceOn && s.channelOff]}>
                Voice
              </Text>
              <Text style={[s.channelState, !voiceOn && s.channelOff]}>
                {voiceOn ? 'ON' : 'OFF'}
              </Text>
            </Pressable>

            <View style={s.rhythmCenter}>
              <PhaseArc width={SCREEN_W * 0.44} progress={arc} />
              <View style={s.arcOverlay}>
                <Text style={s.phaseLabel}>{byKey(phase).label}</Text>
                <Text style={s.phaseBig}>
                  {Math.max(0, secsLeft).toFixed(1)}
                </Text>
                <Text style={s.phaseUnit}>
                  {byKey(phase).via ? `SEC · ${byKey(phase).via}` : 'SEC'}
                </Text>
              </View>
              <Text style={s.nextLine}>
                Next: {nextOf(phase).label.charAt(0)}
                {nextOf(phase).label.slice(1).toLowerCase()} ·{' '}
                {nextOf(phase).secs}.0 sec
              </Text>
            </View>

            <Pressable
              onPress={() => setHapticsOn((h) => !h)}
              style={s.channel}
              hitSlop={8}
            >
              <Text
                style={[
                  s.hapticGlyph,
                  { color: hapticsOn ? ACCENT : 'rgba(255,255,255,0.3)' },
                ]}
              >
                ◉)))
              </Text>
              <Text style={[s.channelLabel, !hapticsOn && s.channelOff]}>
                Haptics
              </Text>
              <Text style={[s.channelState, !hapticsOn && s.channelOff]}>
                {hapticsOn ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Alleen vooraf. Tijdens het ademen hoort er geen product op het
            scherm te staan. */}
        {!running && (
          <Pressable
            onPress={() => router.push('/bracelet')}
            style={s.braceletCard}
          >
            <Image
              source={{ uri: BRACELET_IMG }}
              style={s.braceletImg}
              resizeMode="contain"
            />
            <View style={s.braceletTxt}>
              <Text style={s.braceletEyebrow}>SMART BEAD BRACELET</Text>
              <Text style={s.braceletBody}>
                Connect your bracelet for real-time haptic guidance.
              </Text>
              <Text style={s.braceletWhen}>Available Fall 2026</Text>
            </View>
            <ChevronRight
              size={18}
              color="rgba(255,255,255,0.34)"
              strokeWidth={2.2}
            />
          </Pressable>
        )}
      </ScrollView>

      {/* Verloop onder de knop. Zonder dit lijkt de laatste kaart door de
          knop doorgesneden; nu vervaagt de inhoud eronder en leest de knop
          als iets dat ervóór zweeft. Dat verschil is het hele verschil
          tussen "afgekapt" en "afgewerkt". */}
      <ExpoGradient
        colors={['rgba(10,10,10,0)', Brand.bg, Brand.bg]}
        locations={[0, 0.55, 1]}
        pointerEvents="none"
        style={[s.footerScrim, { height: FOOTER_H + insets.bottom + 72 }]}
      />

      <View style={[s.footer, { paddingBottom: insets.bottom + 10 }]}>
        {running ? (
          <Pressable onPress={stop} style={s.endBtn}>
            <Text style={s.endTxt}>END SESSION</Text>
          </Pressable>
        ) : (
          <Pressable onPress={start} style={s.startWrap}>
            <ExpoGradient
              colors={['#8B3DF0', ACCENT, '#D0A2FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.startBtn}
            >
              <Text style={s.startTxt}>START SESSION</Text>
            </ExpoGradient>
          </Pressable>
        )}
      </View>

      {/* ── Waarom deze lengte ── */}
      <Modal
        visible={infoIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoIdx(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setInfoIdx(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            {infoIdx !== null && (
              <>
                <Text style={s.modalEyebrow}>
                  {DURATIONS[infoIdx].minutes} MIN ·{' '}
                  {fmt(DURATIONS[infoIdx].rounds * CYCLE_S)} ·{' '}
                  {DURATIONS[infoIdx].rounds} ROUNDS
                </Text>
                <Text style={s.modalTitle}>{DURATIONS[infoIdx].name}</Text>
                <Text style={s.modalBody}>{DURATIONS[infoIdx].why}</Text>
                <Text style={s.modalFoot}>
                  There is no single correct length. Pick what fits the
                  moment — a short session you actually do beats a long one
                  you skip.
                </Text>
                <Pressable
                  style={s.modalBtn}
                  onPress={() => setInfoIdx(null)}
                  android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
                >
                  <Text style={s.modalBtnTxt}>Got it</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Sessie afgerond ──────────────────────────────────────────────
          Overgenomen uit breath-sample, want de onboarding eindigt sinds
          1 augustus 2026 hier. Zonder dit zou de zachte paywall na de
          gratis sessie wegvallen — die hoort bij de flow, niet bij het
          oude scherm. Tekst ONGEWIJZIGD gelaten: het is operator-copy.
          (Wel eerder gemeld: "That was a taste" klopt niet meer nu dit een
          volledige sessie is, en "full-length sessions" als premium-belofte
          evenmin. Nog te beslissen.) */}
      <Modal visible={done} transparent animationType="fade">
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalEyebrow}>SESSION COMPLETE</Text>
            <Text style={s.modalTitle}>{isPro ? 'Nice.' : 'Loved it?'}</Text>
            <Text style={s.modalBody}>
              {isPro
                ? 'That was a taste. All five states, full-length sessions and bracelet guidance are already unlocked in your account.'
                : 'That was a taste. Continue with VIBEZCORE Premium to unlock all five states, full-length sessions and the complete audio library.'}
            </Text>

            {isPro ? (
              <Pressable
                style={s.modalBtn}
                onPress={() => setDone(false)}
                android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
              >
                <Text style={s.modalBtnTxt}>Enter Breath →</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={s.modalBtn}
                  onPress={() => {
                    setDone(false);
                    router.replace('/subscribe');
                  }}
                  android_ripple={{ color: 'rgba(255,255,255,0.10)' }}
                >
                  <Text style={s.modalBtnTxt}>Continue with Premium</Text>
                </Pressable>
                <Pressable
                  style={s.modalSecondary}
                  onPress={() => setDone(false)}
                  hitSlop={8}
                >
                  <Text style={s.modalSecondaryTxt}>Not yet</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  stars: { ...StyleSheet.absoluteFillObject },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 12,
    letterSpacing: 3.6,
    color: ACCENT,
  },

  scrollView: { flex: 1 },
  /* De ruimte onderaan wordt bij het renderen gezet: FOOTER_H plus de
     toestel-inzet. Een vast getal zou op het ene toestel een gat geven en
     op het andere de laatste kaart afsnijden. */
  scroll: { alignItems: 'center' },
  /* Tijdens de sessie vallen de tagline en de beschrijving weg, en dan
     bleef er onderaan een gat van een kwart scherm staan. De vier blokken
     verdelen zich nu over de hoogte in plaats van bovenaan te klitten. */
  scrollRunning: { flexGrow: 1, justifyContent: 'space-evenly' },

  /* Eén ritme voor het hele scherm: 6 binnen een blok, 18 tussen blokken,
     26 rond de figuur. Afstanden die per onderdeel apart gekozen zijn
     lezen als rommel, ook als geen enkele afzonderlijk fout is. */
  title: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 30,
    letterSpacing: -0.7,
    color: '#ffffff',
    marginTop: 6,
  },
  tagline: {
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    color: ACCENT,
    marginTop: 6,
  },
  desc: {
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.58)',
    textAlign: 'center',
    marginTop: 12,
  },

  /* Het beeld is breder dan het scherm; hier wordt het bijgesneden.
     De marges zijn niet optioneel: zonder ademruimte plakte "SESSION
     DURATION" tegen de onderste blaadjes. Een figuur die het moet hebben
     van rust kan geen tekst tegen zich aan hebben staan. */
  visualWrap: {
    width: SCREEN_W,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    marginBottom: 26,
  },

  sectionEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 2.6,
    color: 'rgba(255,255,255,0.44)',
  },

  /* ── Voorkeuzes ── */
  durationWrap: { alignItems: 'center', gap: 7 },
  chips: { flexDirection: 'row', gap: 7 },
  chip: {
    width: (SCREEN_W - 28 - 21) / 4,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  chipActive: { borderColor: ACCENT, backgroundColor: ACCENT_SOFT },
  chipTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 18,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 22,
  },
  chipTxtActive: { color: '#ffffff' },
  chipUnit: {
    fontFamily: BrandFonts.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  chipName: {
    fontFamily: BrandFonts.medium,
    fontSize: 9.5,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.38)',
    marginTop: 1,
  },
  chipNameActive: { color: ACCENT },
  exact: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    letterSpacing: 0.1,
    color: 'rgba(255,255,255,0.9)',
  },
  hint: {
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: ACCENT,
    marginTop: -2,
  },

  /* ── Voortgang tijdens de sessie ── */
  /* Gecentreerd, zoals het hoort onder een symmetrische figuur — maar op
     twee regels in plaats van de oude vier. De hoogte was nooit de
     boosdoener; dat was de uitsnede van het beeld. */
  progressWrap: { width: SCREEN_W - 28, alignItems: 'center' },
  progressRound: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.46)',
  },
  progressLeft: {
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.2,
    color: '#ffffff',
    marginTop: 3,
  },
  bar: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 9,
    overflow: 'hidden',
  },
  barFill: { height: 3, borderRadius: 2, backgroundColor: ACCENT },

  /* ── Ademritme vooraf ── */
  patternCard: {
    width: SCREEN_W - 28,
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    alignItems: 'center',
    gap: 10,
  },
  cardEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: ACCENT,
  },
  phaseRow: { flexDirection: 'row', width: '100%' },
  phaseCol: { flex: 1, alignItems: 'center', gap: 1 },
  phaseSecsSmall: {
    fontFamily: BrandFonts.bold,
    fontSize: 19,
    color: '#ffffff',
    lineHeight: 23,
  },
  phaseName: {
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.3,
    color: '#ffffff',
  },
  /* Door welke opening je ademt. Stond eerst klein en violet en was
     daardoor niet af te lezen — juist dít is de instructie. */
  phaseVia: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: '#ffffff',
    marginTop: 2,
  },
  phaseViaNone: {
    fontFamily: BrandFonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.26)',
    marginTop: 2,
  },
  patternFoot: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.55)',
  },

  /* ── Ritmeblok tijdens de sessie ── */
  rhythmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: SCREEN_W - 28,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  channel: { alignItems: 'center', gap: 3, width: 74 },
  channelLabel: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12,
    color: ACCENT,
    marginTop: 2,
  },
  channelState: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: ACCENT,
  },
  channelOff: { color: 'rgba(255,255,255,0.3)' },
  hapticGlyph: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    letterSpacing: -0.5,
  },

  rhythmCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  arcOverlay: { position: 'absolute', top: 26, alignItems: 'center' },
  phaseLabel: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 2.4,
    color: ACCENT,
  },
  phaseBig: {
    fontFamily: BrandFonts.bold,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1,
    color: '#ffffff',
  },
  phaseUnit: {
    fontFamily: BrandFonts.semibold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.5)',
  },
  nextLine: {
    fontFamily: BrandFonts.regular,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },

  /* ── Bracelet ── */
  braceletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: SCREEN_W - 28,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  braceletImg: { width: 62, height: 50 },
  braceletTxt: { flex: 1, gap: 1 },
  braceletEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: ACCENT,
  },
  braceletBody: {
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.72)',
  },
  braceletWhen: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.42)',
  },

  /* ── Voet ── */
  footerScrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  /* Vast onderaan, NIET als derde blok in de kolom. Als sibling van de
     ScrollView werd de knop bij tijd en wijle onder de schermrand geduwd —
     dan stond er geen enkele manier meer op het scherm om te beginnen of te
     stoppen. Een vastgezette voet kan niet weggedrukt worden, wat de inhoud
     ook doet. */
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
  },
  /* Bewust lager dan eerst. Een knop van bijna zestig punten hoog domineert
     een scherm dat over rust gaat; vijftig is ruim genoeg om te raken.

     De hoogte staat EXPLICIET, niet via de padding van de tekst erin. Dit
     was de oorzaak van de verdwijnende knop: een LinearGradient die zijn
     hoogte alleen uit een kind haalt, meet met tussenpozen nul en verdwijnt
     dan volledig. Dat verklaart ook waarom END SESSION nooit wegviel — dat
     is een gewone View met rand, geen verloop. */
  startWrap: { borderRadius: 15, overflow: 'hidden', height: BTN_H },
  startBtn: {
    height: BTN_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 13.5,
    letterSpacing: 2.2,
    color: '#ffffff',
  },
  endBtn: {
    height: BTN_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  endTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.72)',
  },

  /* ── Uitleg-popup. Eigen vormgeving, geen systeem-alert. ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  modalCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(180,120,255,0.34)',
    backgroundColor: '#141018',
    paddingVertical: 22,
    paddingHorizontal: 22,
    gap: 9,
  },
  modalEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: ACCENT,
  },
  modalTitle: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: '#ffffff',
  },
  modalBody: {
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.78)',
  },
  modalFoot: {
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.44)',
    marginTop: 2,
  },
  modalBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: ACCENT_SOFT,
    borderWidth: 1,
    borderColor: 'rgba(180,120,255,0.4)',
  },
  modalBtnTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 13.5,
    letterSpacing: 1.4,
    color: ACCENT,
  },
  modalSecondary: { paddingVertical: 12, alignItems: 'center' },
  modalSecondaryTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
});
