/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Sessiescherm (Calm Control)

   Nagebouwd naar de mockup van de operator (1 augustus 2026), met drie
   bewuste afwijkingen die in die mockup fout stonden:

     FIGUUR   De mockup toont de Flower of Life, maar dat is het figuur van
              Focus. Calm krijgt de Lotus, volgens de eigen indeling in
              session-figures.ts. Anders koppelt de gebruiker vanaf het
              eerste scherm de verkeerde vorm aan de verkeerde toestand, en
              dat is precies het enige wat die zeven figuren moeten doen

     DUUR     De mockup heeft − en + rond de tijd. Dat suggereert vrij
              draaien terwijl de lengtes vastliggen. Het zijn nu vier
              voorkeuzes; één tik, geen tellen

     RITMEBLOK
              In de mockup loopt daar een teller terwijl de sessie nog moet
              beginnen. Hier staat vóór de start het patroon stil (4·4·4·4)
              en ná de start wordt exact hetzelfde blok de levende teller.
              Zelfde plek, zelfde vorm — hij komt tot leven

   Calm Control is box breathing: vier gelijke fasen van vier seconden, dus
   een cyclus van zestien. Zestien past niet in zestig, en daarom landt
   alleen twintig minuten precies op een heel getal. De andere drie worden
   2:56, 5:04 en 10:08 — vandaar dat de exacte tijd onder de keuze staat en
   het label alleen een ronde indicatie is. Een label dat "5 MIN" belooft
   en 5:04 draait is een kleine leugen die je vaker vertelt dan je denkt.
   ───────────────────────────────────────────────────────────────────────── */

import SessionVisual from '@/components/SessionVisual';
import { Brand, BrandFonts } from '@/constants/theme';
import {
  claimVoiceSource,
  playBreathCue,
  releaseVoiceSource,
  setVoiceEnabled,
  stopVoice,
} from '@/services/breath-voice';
import {
  Canvas,
  Circle,
  Path,
  Skia,
  vec,
  BlurMask,
  LinearGradient,
} from '@shopify/react-native-skia';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { ChevronRight, Settings, Volume2, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

/* De figuur is vierkant, dus elke pixel breedte kost evenveel hoogte. Op
   0.86 van de schermbreedte duwde hij de bracelet-kaart onder de rand en
   moest je scrollen om START te vinden — op een scherm dat je opent om te
   beginnen is dat de verkeerde volgorde. Alles past nu in één beeld. */
const VISUAL = Math.min(SCREEN_W * 0.66, 272);

/* ── Het patroon ─────────────────────────────────────────────────────── */

const INHALE_S = 4;
const HOLD_IN_S = 4;
const EXHALE_S = 4;
const HOLD_OUT_S = 4;
const CYCLE_S = INHALE_S + HOLD_IN_S + EXHALE_S + HOLD_OUT_S;

type Phase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

const PHASE_SECS: Record<Phase, number> = {
  'inhale': INHALE_S,
  'hold-in': HOLD_IN_S,
  'exhale': EXHALE_S,
  'hold-out': HOLD_OUT_S,
};

const PHASE_LABEL: Record<Phase, string> = {
  'inhale': 'INHALE',
  'hold-in': 'HOLD',
  'exhale': 'EXHALE',
  'hold-out': 'HOLD',
};

const PHASE_ORDER: Phase[] = ['inhale', 'hold-in', 'exhale', 'hold-out'];

const NEXT_PHASE: Record<Phase, Phase> = {
  'inhale': 'hold-in',
  'hold-in': 'exhale',
  'exhale': 'hold-out',
  'hold-out': 'inhale',
};

/* Trillingsduur per fase — gelijk aan (tabs)/breath.tsx. */
const VIB: Record<Phase, number> = {
  'inhale': 60,
  'hold-in': 30,
  'exhale': 80,
  'hold-out': 30,
};

/* ── De vier lengtes ─────────────────────────────────────────────────────
   Rondes zijn leidend, minuten zijn het label. Zie de kop van dit bestand
   voor waarom die twee niet overal samenvallen. */
type Duration = { minutes: number; rounds: number; recommended?: boolean };

const DURATIONS: Duration[] = [
  { minutes: 3, rounds: 11 },
  { minutes: 5, rounds: 19, recommended: true },
  { minutes: 10, rounds: 38 },
  { minutes: 20, rounds: 75 },
];

const DEFAULT_DURATION = 1;

const BRACELET_IMG =
  'https://vibezcore-audio.b-cdn.net/images/Shattudkite_vzc_fiv%20no%20bg.png';

const ACCENT = '#0A84FF';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ── De boog in het ritmeblok ────────────────────────────────────────────
   Een halve cirkel die zich vult over de duur van de huidige fase, met een
   lichtpunt op de kop. De boog vertelt hoe ver je bent zonder dat je hoeft
   te lezen — het getal eronder is voor wie wél leest. */
const ARC_H = 104;

function PhaseArc({
  width,
  progress,
}: {
  width: number;
  progress: SharedValue<number>;
}) {
  const cx = width / 2;
  /* Ruim genoeg zodat het getal ERIN past en niet erover. Op een kleinere
     straal sneed de boog dwars door de cijfers heen. */
  const r = Math.min(width * 0.46, 96);
  const cy = ARC_H - 6;

  const track = useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2), 180, 180);
    return p;
  }, [cx, cy, r]);

  /* Kop van de boog. Loopt van 180° naar 360°, dus linksonder naar
     rechtsonder over de top. */
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
          colors={['#1F5FBF', ACCENT, '#7FC0FF']}
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
  const [durationIdx, setDurationIdx] = useState<number>(DEFAULT_DURATION);
  const [running, setRunning] = useState(false);

  const [voiceOn, setVoiceOn] = useState(true);
  const [hapticsOn, setHapticsOn] = useState(true);

  const [phase, setPhase] = useState<Phase>('inhale');
  const [secsLeft, setSecsLeft] = useState(INHALE_S);
  const [round, setRound] = useState(1);

  const chosen = DURATIONS[durationIdx];
  const totalSec = chosen.rounds * CYCLE_S;

  /* De fase-loop draait buiten React om, dus de actuele instellingen komen
     uit refs. Anders leest een lopende sessie de waarden van de render
     waarin hij begon. */
  const voiceRef = useRef(voiceOn);
  const hapticRef = useRef(hapticsOn);
  const roundsRef = useRef(chosen.rounds);
  useEffect(() => {
    voiceRef.current = voiceOn;
    setVoiceEnabled(voiceOn);
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

  /* Staat bewust vóór runPhase: de laatste ronde roept dit aan, en een
     functie die je aanroept hoort al te bestaan op het moment dat je hem
     opschrijft. */
  const finish = useCallback(() => {
    stopAll();
    setRunning(false);
    setRound(1);
    setPhase('inhale');
    setSecsLeft(INHALE_S);
    idleBreathing();
    releaseVoiceSource('breath');
  }, [idleBreathing, stopAll]);

  /* ── De fase-loop ──────────────────────────────────────────────────── */
  const runPhase = useCallback(
    (p: Phase, r: number) => {
      const secs = PHASE_SECS[p];
      setPhase(p);
      setSecsLeft(secs);

      if (hapticRef.current) {
        try {
          Vibration.vibrate(VIB[p]);
        } catch {}
      }
      if (voiceRef.current) {
        /* Calm Control ademt in en uit door de neus. */
        playBreathCue(p, 'nose', 'calm', 'breath');
      }

      /* Beeld: alleen in- en uitademen bewegen. Tijdens het vasthouden
         blijft de vorm staan waar hij staat — dat is wat vasthouden ís. */
      if (p === 'inhale') {
        breath.value = withTiming(1, {
          duration: secs * 1000,
          easing: Easing.inOut(Easing.sin),
        });
      } else if (p === 'exhale') {
        breath.value = withTiming(0, {
          duration: secs * 1000,
          easing: Easing.inOut(Easing.sin),
        });
      }

      arc.value = 0;
      arc.value = withTiming(1, {
        duration: secs * 1000,
        easing: Easing.linear,
      });

      let left = secs;
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
            if (p === 'hold-out') {
              const next = r + 1;
              if (next > roundsRef.current) {
                finish();
                return;
              }
              setRound(next);
              runPhase('inhale', next);
            } else {
              runPhase(NEXT_PHASE[p], r);
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

  const pickDuration = (i: number) => {
    if (running) return;
    Haptics.selectionAsync();
    setDurationIdx(i);
  };

  /* Verstreken tijd wordt AFGELEID uit de fase-lus, niet apart geteld. Een
     tweede timer naast de eerste loopt onvermijdelijk uit de pas — bij
     vijfenzeventig rondes zie je dat de resterende tijd niet meer klopt met
     de ronde waar je in zit. Nu is er één bron. */
  const phaseOffset = PHASE_ORDER.slice(
    0,
    PHASE_ORDER.indexOf(phase),
  ).reduce((sum, p) => sum + PHASE_SECS[p], 0);
  const elapsed =
    (round - 1) * CYCLE_S + phaseOffset + (PHASE_SECS[phase] - secsLeft);
  const leftSec = Math.max(0, totalSec - elapsed);

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.topbar}>
        <Pressable
          onPress={() => (running ? stop() : router.back())}
          hitSlop={12}
          style={s.iconBtn}
        >
          <X size={18} color="rgba(255,255,255,0.72)" strokeWidth={2.2} />
        </Pressable>
        <Text style={s.eyebrow}>CALM CONTROL</Text>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          style={s.iconBtn}
        >
          <Settings size={17} color="rgba(255,255,255,0.72)" strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>Lotus Mandala</Text>
        {/* Weg zodra de sessie loopt. Wie aan het ademen is, leest niet —
            en het ritmeblok is in die toestand hoger, dus deze regels
            zouden de bracelet-kaart onder de rand duwen. */}
        {!running && (
          <Text style={s.desc}>
            Even on all sides.{'\n'}
            Twenty petals open and close as one, on the{'\n'}
            four equal counts of box breathing.
          </Text>
        )}

        <View style={s.visualWrap}>
          <SessionVisual size={VISUAL} figure="lotus" breath={breath} />
        </View>

        {/* ── Duur: voorkeuzes vóór de start, voortgang tijdens ── */}
        {running ? (
          <View style={s.progressWrap}>
            <Text style={s.sectionEyebrow}>
              ROUND {round} OF {chosen.rounds}
            </Text>
            <Text style={s.progressTime}>{fmt(leftSec)}</Text>
            <Text style={s.progressSub}>left</Text>
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
                    </Text>
                    <Text style={[s.chipUnit, active && s.chipUnitActive]}>
                      MIN
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.exact}>
              {fmt(totalSec)} total · {chosen.rounds} rounds
              {chosen.recommended ? ' · recommended' : ''}
            </Text>
          </View>
        )}

        {/* ── Ritmeblok. Zelfde kader vóór en tijdens; alleen het midden
             wisselt van stil patroon naar levende teller. ── */}
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
            <Text style={[s.channelLabel, !voiceOn && s.channelOff]}>Voice</Text>
            <Text style={[s.channelState, !voiceOn && s.channelOff]}>
              {voiceOn ? 'ON' : 'OFF'}
            </Text>
          </Pressable>

          <View style={s.rhythmCenter}>
            {running ? (
              <>
                <PhaseArc width={SCREEN_W * 0.44} progress={arc} />
                <View style={s.arcOverlay}>
                  <Text style={s.phaseLabel}>{PHASE_LABEL[phase]}</Text>
                  <Text style={s.phaseSecs}>
                    {Math.max(0, secsLeft).toFixed(1)}
                  </Text>
                  <Text style={s.phaseUnit}>SEC</Text>
                </View>
                <Text style={s.nextLine}>
                  Next: {PHASE_LABEL[NEXT_PHASE[phase]].charAt(0)}
                  {PHASE_LABEL[NEXT_PHASE[phase]].slice(1).toLowerCase()} ·{' '}
                  {PHASE_SECS[NEXT_PHASE[phase]]}.0 sec
                </Text>
              </>
            ) : (
              <>
                <Text style={s.patternNums}>4 · 4 · 4 · 4</Text>
                <Text style={s.patternName}>Box breathing</Text>
                <Text style={s.patternHint}>
                  In · hold · out · hold, all through the nose
                </Text>
              </>
            )}
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

        {/* ── Bracelet. Blijft staan tijdens de sessie: dit is het moment
             waarop de gebruiker begrijpt waar hij voor bedoeld is. ── */}
        <Pressable onPress={() => router.push('/bracelet')} style={s.braceletCard}>
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
      </ScrollView>

      <View style={s.footer}>
        {running ? (
          <Pressable onPress={stop} style={s.endBtn}>
            <Text style={s.endTxt}>END SESSION</Text>
          </Pressable>
        ) : (
          <Pressable onPress={start} style={s.startWrap}>
            <ExpoGradient
              colors={['#2A7FEE', '#0A84FF', '#4FA3FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.startBtn}
            >
              <Text style={s.startTxt}>START SESSION</Text>
            </ExpoGradient>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 6,
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
    letterSpacing: 3.4,
    color: ACCENT,
  },

  scroll: { paddingBottom: 20, alignItems: 'center' },

  title: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 30,
    letterSpacing: -0.6,
    color: '#ffffff',
    marginTop: 8,
  },
  desc: {
    fontFamily: BrandFonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    marginTop: 10,
  },

  visualWrap: {
    marginTop: 2,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 2.6,
    color: 'rgba(255,255,255,0.44)',
  },

  /* ── Voorkeuzes ── */
  durationWrap: { alignItems: 'center', gap: 7, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 9 },
  chip: {
    width: 68,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  chipActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(10,132,255,0.16)',
  },
  chipTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 20,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 24,
  },
  chipTxtActive: { color: '#ffffff' },
  chipUnit: {
    fontFamily: BrandFonts.semibold,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.38)',
    marginTop: 1,
  },
  chipUnitActive: { color: ACCENT },
  exact: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.42)',
  },

  /* ── Voortgang tijdens de sessie ── */
  progressWrap: { alignItems: 'center', gap: 3, width: '100%', marginTop: 2 },
  progressTime: {
    fontFamily: BrandFonts.bold,
    fontSize: 30,
    color: '#ffffff',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  progressSub: {
    fontFamily: BrandFonts.medium,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.38)',
    textTransform: 'uppercase',
  },
  bar: {
    width: SCREEN_W * 0.62,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: { height: 3, borderRadius: 2, backgroundColor: ACCENT },

  /* ── Ritmeblok ── */
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
  arcOverlay: {
    position: 'absolute',
    top: 26,
    alignItems: 'center',
  },
  phaseLabel: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 2.4,
    color: ACCENT,
  },
  phaseSecs: {
    fontFamily: BrandFonts.bold,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1,
    color: '#ffffff',
  },
  phaseUnit: {
    fontFamily: BrandFonts.semibold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.44)',
  },
  nextLine: {
    fontFamily: BrandFonts.regular,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },

  patternNums: {
    fontFamily: BrandFonts.bold,
    fontSize: 26,
    letterSpacing: 1,
    color: '#ffffff',
  },
  patternName: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    letterSpacing: 0.4,
    color: ACCENT,
    marginTop: 3,
  },
  patternHint: {
    fontFamily: BrandFonts.regular,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    textAlign: 'center',
  },

  /* ── Bracelet ── */
  braceletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: SCREEN_W - 28,
    marginTop: 10,
    paddingVertical: 9,
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
  footer: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4 },
  startWrap: { borderRadius: 16, overflow: 'hidden' },
  startBtn: { paddingVertical: 18, alignItems: 'center' },
  startTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    letterSpacing: 2.2,
    color: '#ffffff',
  },
  endBtn: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  endTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 14,
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.72)',
  },
});
