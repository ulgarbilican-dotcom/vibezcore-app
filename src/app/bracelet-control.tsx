/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet control screen (modernized 2026-05-27)

   Drives the bracelet via the BLE contract (services/ble-contract.ts).
   Today: SimulatedBracelet — same UI when RealBracelet plugs in.

   Spec-compliance (Haptic_Bracelet_Spec_v2_3):
   - §11.3/§11.5: shows ONLY mode name, bounded duration, remaining time,
     battery, BLE status, stop. NO PPS / burst_ms / amplitude / RTP.
   - §8.3/§11.4: app polls status every 5s while connected.
   - §11.2: duration bounds enforced via clampDuration().

   States this screen renders (mutually exclusive):
   - Not connected → searching screen with Retry-CTA
   - Connected + fault → fault screen (reconnect / contact support)
   - Connected + charging + !sessionActive → charging screen (paused state)
   - Connected + sessionActive → big timer + pulsing circle + Stop CTA
   - Connected + idle → mode selection + duration presets + Start CTA

   Visual language matches the modernized bracelet etalage:
   - Tinted background per mode (mode-color @ 12%) for selected card
   - Mode-color accent on duration presets and Start button
   - Pulsing colored circle for active session (similar to sonar on etalage)
   - Sticky bottom action button
   - Glass-chip status indicators
   ─────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import {
  recordSession,
  useBraceletStats,
} from '@/utils/bracelet-history';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BleCommand,
  BleConnectionState,
  BleStatusPacket,
  BraceletMode,
  MODES,
  ModeMeta,
  clampDuration,
  getModeMeta,
} from '../services/ble-contract';
import { getBracelet, getSimHooks } from '../services/bracelet';

/* MERK_ANKER §2 levert geen "warn"-kleur. Voor de battery-warn drempel
   (5–20%) gebruiken we de Sharp Focus oranje uit CLAUDE.md §5. */
const WARN = '#FF9F0A';

/* App polls status every 5 seconds when connected (spec §8.3/§11.4). */
const POLL_MS = 5000;

/* Per-mode background photo (Bunny CDN). Operator-uploads — 3 van 5 geleverd
   op 2026-05-27, Sharp Focus + Clarity volgen. Modes zonder foto vallen
   visueel terug op een mode-color gradient zodat de grid cohesive blijft.
   Wanneer operator nieuwe foto's uploadt: alleen URL hier toevoegen, geen
   andere wijzigingen nodig. */
const MODE_IMAGES: Partial<Record<BraceletMode, string>> = {
  [BraceletMode.Gamma]:
    'https://vibezcore-audio.b-cdn.net/images/gamma%20pic.jpg',
  [BraceletMode.Beta]:
    'https://vibezcore-audio.b-cdn.net/images/focus_edited_edited_edited_edited_edited.jpg',
  [BraceletMode.Alpha]:
    'https://vibezcore-audio.b-cdn.net/images/Social%20mastery.jpg',
  [BraceletMode.Theta]:
    'https://vibezcore-audio.b-cdn.net/images/confident-man-with-beard-mustache-smiling-generated-by-ai.jpg',
  [BraceletMode.Delta]:
    'https://vibezcore-audio.b-cdn.net/images/Rest%20%26%20Reset%20Delta.jpg',
};

/* Per-mode breathwork-tempo voor PulsingCircle + BreathingHint.
   Operator-feedback 2026-05-27: tekst en pulse moeten matchen met
   het beoogde state-tempo per mode. Geen literal brain-wave Hz
   (Gamma 40Hz = onmogelijk om te ademen op) — wel breathwork-onderzoek-
   gebaseerde rythmes die de target-state ondersteunen:
     - Boost (Gamma):       3s/3s = ~10 BPM, energieke ademing
     - Sharp Focus (Beta):  4s/4s = ~7.5 BPM, focused
     - Calm Control (Alpha): 5s/5s = ~6 BPM, coherent breathing (HRV)
     - Clarity (Theta):     6s/6s = ~5 BPM, diepe relaxatie
     - Rest & Reset (Delta): 7s/7s = ~4.3 BPM, slaap-voorbereiding
   Pulse-animatie cycle = inMs + outMs (totaal 6-14s afh. mode). */
const MODE_BREATH: Record<BraceletMode, { inMs: number; outMs: number }> = {
  [BraceletMode.Gamma]: { inMs: 3000, outMs: 3000 },
  [BraceletMode.Beta]: { inMs: 4000, outMs: 4000 },
  [BraceletMode.Alpha]: { inMs: 5000, outMs: 5000 },
  [BraceletMode.Theta]: { inMs: 6000, outMs: 6000 },
  [BraceletMode.Delta]: { inMs: 7000, outMs: 7000 },
};

/* Per-mode ambient background tint voor de active-session screen.
   Operator-keuze 2026-05-27: full-screen rood (Boost / Gamma) voelt als
   alarm/aggressief. Vervangen door warm amber/goud — behoudt "energie"-
   vibe zonder de stress-respons. Dot, ring, en timer-glow blijven wel
   rood (kleine UI-elementen, accent ipv massa). */
function getActiveBgTint(mode: BraceletMode): string {
  if (mode === BraceletMode.Gamma) return '#FFB840'; // warm amber
  return getModeMeta(mode).color;
}

/* Per-mode "Best for" tags — operator-aangeleverd 2026-05-27. Wordt
   getoond op de idle-screen onder de duration-sectie, voor de
   geselecteerde mode. Geeft de gebruiker context over WANNEER deze
   modus de juiste keuze is, zonder medische claims (CLAUDE.md §1). */
/* Per-mode quotes — rusten op de bodem van de active-session screen,
   roteren elke 22s met soft fade. Stoïsche / brand-aligned korte
   zinnen die de mode-intentie versterken zonder pushy te zijn. */
const MODE_QUOTES: Record<BraceletMode, string[]> = {
  [BraceletMode.Gamma]: [
    'Channel the surge.',
    'Speed serves precision.',
    'Sharpen the edge.',
  ],
  [BraceletMode.Beta]: [
    'One task. Full presence.',
    'Depth over speed.',
    'The work, not the noise.',
  ],
  [BraceletMode.Alpha]: [
    'Calm is the new sharp.',
    'Steady mind, clear path.',
    'Pressure passes through you.',
  ],
  [BraceletMode.Theta]: [
    'Slow the mind, find the answer.',
    'Insight arrives in stillness.',
    'Let the thought come to you.',
  ],
  [BraceletMode.Delta]: [
    'Recovery is part of the work.',
    'Let it all settle.',
    'Sleep is where growth happens.',
  ],
};

const MODE_IDEALS: Record<BraceletMode, string[]> = {
  [BraceletMode.Gamma]: [
    'Energy',
    'Mental sprints',
    'High-stakes tasks',
    'Speed & precision',
  ],
  [BraceletMode.Beta]: [
    'Deep work',
    'Morning activation',
    'High cognitive load',
    'Precision tasks',
  ],
  [BraceletMode.Alpha]: [
    'Focused work',
    'Midday reset',
    'Social interactions',
    'Problem-solving',
  ],
  [BraceletMode.Theta]: [
    'Reflection',
    'Creative work',
    'Emotional processing',
    'Inward focus',
  ],
  [BraceletMode.Delta]: [
    'Physical recovery',
    'Pre-sleep',
    'Nervous system reset',
    'Tension release',
  ],
};

/* Generate duration-presets binnen de mode's min/max-range. Step = 5 voor
   de meeste modes (≥10min range), step = 2 voor Boost (8-15, kortere
   range). Laatste waarde is altijd exact maxMinutes zodat de bovengrens
   altijd tikbaar is. */
function durationPresets(mode: BraceletMode): number[] {
  const m = getModeMeta(mode);
  const range = m.maxMinutes - m.minMinutes;
  const step = range > 10 ? 5 : 2;
  const out: number[] = [];
  for (let v = m.minMinutes; v <= m.maxMinutes; v += step) out.push(v);
  if (out[out.length - 1] !== m.maxMinutes) out.push(m.maxMinutes);
  return out;
}

/* ── Completion messages per mode ──
   Mode-specifieke felicitatie-tekst voor de CompletionModal aan
   het einde van een sessie. Brand-aligned (CLAUDE.md §1 — alleen
   toestand-taal, geen medische claims), kort en bevestigend. */
const COMPLETION_MESSAGES: Record<BraceletMode, string> = {
  [BraceletMode.Gamma]: 'You showed up. The edge is sharper.',
  [BraceletMode.Beta]: 'Focus done. The deep work counts.',
  [BraceletMode.Alpha]: 'Stillness reclaimed. Carry it with you.',
  [BraceletMode.Theta]: 'Insight earned. Trust what came up.',
  [BraceletMode.Delta]: 'Recovery accomplished. Your system thanks you.',
};

/* ── DurationFillCircle — cirkel met water-fill voor idle screen ──
   Vervangt het platte getal-onder-titel. Cirkel-shape vult zich van
   onderen op met mode-color naarmate de slider-waarde dichter bij
   max komt. Op min: cirkel bijna leeg. Op max: cirkel volledig
   gevuld in mode-color. Number stays centraal in wit (rust). */
function DurationFillCircle({
  value,
  min,
  max,
  color,
}: {
  value: number;
  min: number;
  max: number;
  color: string;
}) {
  const fillPct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <View style={s.durFillOuter}>
      <View style={s.durFillTrack}>
        <View
          style={[
            s.durFillBar,
            { height: `${fillPct}%`, backgroundColor: color },
          ]}
        />
      </View>
      <View style={s.durFillContent}>
        <Text style={s.durFillNum}>{value}</Text>
        <Text style={s.durFillUnit}>minutes</Text>
      </View>
    </View>
  );
}

/* ── DrainingCircle — fill die leegloopt tijdens active session ──
   Tegenovergesteld aan ProgressArc: arc vult clockwise als time
   verloopt; deze drain leegt als time verloopt. Geeft user gevoel
   "time leaks out of me". Bij sessie-start: vol mode-color. Bij
   einde: empty. Klein subtiel, zit achter de PulsingCircle's
   breathing-border voor mooie depth-layering. */
function DrainingCircle({
  progress,
  color,
  size,
}: {
  /** 0..1 — fractie van de sessie die voorbij is */
  progress: number;
  color: string;
  size: number;
}) {
  const remainingPct = Math.max(0, Math.min(1, 1 - progress)) * 100;
  return (
    <View
      style={[
        s.drainOuter,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <View
        style={[
          s.drainFill,
          { height: `${remainingPct}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

/* ── CompletionModal — felicitatie na natural completion ──
   Floating overlay, dim backdrop, mode-color icon. Operator-keuze
   2026-05-27: geeft user een "afgerond"-gevoel na een sessie.
   Eenvoudige tap-anywhere-to-dismiss. Mode-specifiek bericht uit
   COMPLETION_MESSAGES. */
function CompletionModal({
  mode,
  onDismiss,
}: {
  mode: BraceletMode;
  onDismiss: () => void;
}) {
  const meta = getModeMeta(mode);
  const msg = COMPLETION_MESSAGES[mode];

  /* Subtle fade-in voor het hele paneel */
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View style={[s.completionOverlay, { opacity }]}>
      <Pressable
        style={s.completionBackdrop}
        onPress={onDismiss}
        accessibilityLabel="Dismiss completion"
      />
      <View style={s.completionCard}>
        <View
          style={[
            s.completionIcon,
            {
              backgroundColor: hexToTint(meta.color, 0.18),
              borderColor: hexToTint(meta.color, 0.5),
            },
          ]}
        >
          <Text style={[s.completionIconText, { color: meta.color }]}>
            ✓
          </Text>
        </View>
        <Text style={s.completionTitle}>Session complete</Text>
        <Text style={[s.completionMode, { color: meta.color }]}>
          {meta.name}
        </Text>
        <Text style={s.completionMsg}>{msg}</Text>
        <Pressable
          style={[s.completionBtn, { backgroundColor: meta.color }]}
          onPress={onDismiss}
          accessibilityLabel="Done"
        >
          <Text style={s.completionBtnText}>Done</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/* ── DurationSlider — horizontale snap-to-int slider ──
   Vervangt de oude +/- stepper. Drag of tap om duration te wijzigen.
   Snap op hele minuten binnen de mode's [min, max] range. Track
   neutraal grijs, gevulde portion + thumb-border in mode-color voor
   visuele mode-identiteit. Pure JS via PanResponder — geen native
   dependency. */
function DurationSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const range = max - min;

  const setFromX = (x: number) => {
    if (width <= 0 || range <= 0) return;
    const pct = Math.max(0, Math.min(1, x / width));
    const raw = min + pct * range;
    const snapped = Math.round(raw);
    if (snapped !== value && snapped >= min && snapped <= max) {
      onChange(snapped);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        /* Aggressief de gesture claimen — Android's edge back-swipe
           probeert anders te winnen wanneer user vanaf links sliden.
           onShouldBlockNativeResponder = true → blokkeert native
           back-gesture. Capture-versies winnen van child-handlers. */
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => {
          setFromX(e.nativeEvent.locationX);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, min, max, value],
  );

  const filledPct = range > 0 ? ((value - min) / range) * 100 : 0;

  return (
    <View>
      <View
        style={s.sliderTouch}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={s.sliderTrack} />
        <View style={[s.sliderFilled, { width: `${filledPct}%` }]} />
        <View style={[s.sliderThumb, { left: `${filledPct}%` }]} />
      </View>
      <View style={s.sliderLabels}>
        <Text style={s.sliderLabel}>{min}</Text>
        <Text style={s.sliderLabel}>{max} min</Text>
      </View>
    </View>
  );
}

/* ── ProgressArc — circulaire progress-ring rond de timer ──
   Vult klokwaarts naarmate de sessie vordert (0% → 100%). Mode-color,
   dunne stroke, ronde caps. Geeft user visueel gevoel van "ik kom
   ergens" zonder de pulserende cirkel te verstoren. */
function ProgressArc({
  progress,
  color,
  size,
}: {
  /** 0..1 — fractie van de sessie die voorbij is */
  progress: number;
  color: string;
  size: number;
}) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = circumference * (1 - clamped);

  return (
    <Svg
      width={size}
      height={size}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        /* -90° rotation start = bovenaan, klokwaarts vullen */
        transform: [{ rotate: '-90deg' }],
      }}
      pointerEvents="none"
    >
      {/* Track — heel subtle, geeft cirkel-shape aan bij 0% progress */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
        fill="none"
      />
      {/* Progress — gevulde portion in mode-color */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
      />
    </Svg>
  );
}

/* ── BreathingHint — synced ademhalings-tekst ──
   Toggle elke 3s tussen "Breathe in" en "Breathe out" — matched de
   PulsingCircle's 3s heen + 3s terug cyclus. CLAUDE.md §6 bottom-up
   regulation: lichaam volgt ademhaling, brein volgt lichaam.
   Subtle fade via Animated.Value zodat tekst niet "ploft". */
function BreathingHint({
  inMs = 3000,
  outMs = 3000,
}: {
  inMs?: number;
  outMs?: number;
}) {
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /* Initial fade-in */
    Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    /* Asymmetrische in/out timing wanneer modes anders inMs/outMs
       hebben. Werkt nu met gelijke timings (inMs == outMs) maar
       voorbereid op verschillende fases (bv. 4-7-8 ademing later). */
    let active = true;
    const tick = (nextPhase: 'in' | 'out') => {
      if (!active) return;
      setPhase(nextPhase);
      const duration = nextPhase === 'in' ? inMs : outMs;
      setTimeout(() => tick(nextPhase === 'in' ? 'out' : 'in'), duration);
    };
    /* Eerste tick na inMs: kondigt de eerste "Breathe out…" aan
       (huidige phase = 'in' is al gezet). */
    const handle = setTimeout(() => tick('out'), inMs);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [opacity, inMs, outMs]);

  return (
    <Animated.Text style={[s.breatheHint, { opacity }]}>
      {phase === 'in' ? 'Breathe in…' : 'Breathe out…'}
    </Animated.Text>
  );
}

/* ── RotatingQuote — mode-specifieke quote, roteert elke 22s ──
   Soft cross-fade tussen quotes. Quotes per mode in MODE_QUOTES.
   Rusten aan de bodem van de active-session screen, vlak boven de
   stats-strip. */
function RotatingQuote({ quotes }: { quotes: string[] }) {
  const [idx, setIdx] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /* Initial fade-in */
    Animated.timing(opacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    /* Roteer elke 22s — kort genoeg om variatie, lang genoeg om te
       lezen + niet afleidend te zijn. Fade-out, swap, fade-in. */
    const iv = setInterval(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        setIdx((i) => (i + 1) % quotes.length);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      });
    }, 22_000);
    return () => clearInterval(iv);
  }, [opacity, quotes.length]);

  return (
    <Animated.Text style={[s.rotatingQuote, { opacity }]}>
      "{quotes[idx]}"
    </Animated.Text>
  );
}

/* ── PulsingCircle — visuele puls voor active session ──
   Zelfde principe als de sonar-rings op de etalage: continue scale +
   opacity loop met useNativeDriver, geen JS-thread belasting tijdens
   andere animaties of scroll. */
function PulsingCircle({
  color,
  size = 220,
  inMs = 3000,
  outMs = 3000,
}: {
  color: string;
  size?: number;
  /** Inhale-fase duur in ms. Default 3000 (~10 BPM). */
  inMs?: number;
  /** Exhale-fase duur in ms. Default 3000. */
  outMs?: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    /* Adem-ritme — varieert per mode via MODE_BREATH (operator-keuze
       2026-05-27 iter 3). Energiek (3s/3s) voor Boost, traag (7s/7s)
       voor Rest & Reset. Cyclus = inMs + outMs. */
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: inMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: outMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, inMs, outMs]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.65],
  });

  return (
    <View style={[s.pulseWrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          s.pulseCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          s.pulseCircleInner,
          {
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: (size * 0.7) / 2,
            backgroundColor: color,
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.08, 0.15],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

export default function BraceletControl() {
  const bracelet = getBracelet();
  const sim = getSimHooks(); // null on real hardware

  const [conn, setConn] = useState<BleConnectionState>(
    bracelet.getConnectionState(),
  );
  const [selectedMode, setSelectedMode] = useState<BraceletMode>(
    BraceletMode.Alpha,
  );
  const meta = getModeMeta(selectedMode);
  const [duration, setDuration] = useState<number>(meta.minMinutes);
  const [status, setStatus] = useState<BleStatusPacket | null>(null);
  const [busy, setBusy] = useState(false);

  /* Pause-state — BLE-contract kent geen native Pause (spec §8.1: alleen
     Start/Stop). Pseudo-pause werkt zo:
       - onPause()  : BLE Stop verzonden, `pausedAt` opslaan met
                      `status.remainingMinutes`. UI blijft op active-
                      view via de `isPaused || sessionActive`-check.
       - onResume() : BLE Start verzonden met clamped `pausedAt` als
                      nieuwe duration; pausedAt op null gezet.
       - onEnd()    : BLE Stop + pausedAt op null → idle-screen.
     De gebruiker ervaart 't als pause; fysiek is 't een korte stop +
     restart op de resterende minuten. Operator-keuze 2026-05-27. */
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const isPaused = pausedAt !== null;

  /* Completion-modal — toont mode-specifieke felicitatie zodra een
     sessie natuurlijk afloopt (timer hits 0). Niet bij manual End,
     niet bij Restart. Bewaart welke mode 'voltooid' werd zodat de
     juiste copy + kleur uit COMPLETION_MESSAGES wordt gerendered. */
  const [completedModeForModal, setCompletedModeForModal] =
    useState<BraceletMode | null>(null);

  /* Track wanneer de huidige sessie begon (lokaal in component, niet
     persistent). Wordt gezet bij eerste onStart, gewist bij onStop.
     Bij pause/resume blijft de waarde staan zodat de totale doorlopen
     tijd correct geboekt wordt bij eind. Voor stats. */
  const sessionStartedAtRef = useRef<number | null>(null);

  /* Geplande duration van de huidige sessie — gebruikt voor de
     progress-arc rond de timer en de "of X total"-context-regel.
     Gezet bij onStart/onRestart, niet relevant op idle. */
  const sessionPlannedRef = useRef<number>(0);

  /* Live stats voor de strip — refresht zichzelf via listener-set in
     bracelet-history.ts wanneer een nieuwe sessie wordt vastgelegd. */
  const stats = useBraceletStats();
  /* Mode-gefilterde stats voor de active-screen: tijdens een Boost-
     sessie zie je je Boost-track-record, niet totaal-alle-modes. Hook
     wordt altijd aangeroepen (rules of hooks), gebruikt selectedMode
     als filter — de getoonde waarden zijn alleen relevant op active. */
  const modeStats = useBraceletStats(selectedMode);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /* Stale-status detection — wanneer de poll meer dan STALE_FAIL_TICKS
     opeenvolgende keren faalt (= STALE_FAIL_TICKS × POLL_MS / 1000 sec
     geen status-update), tonen we een indicator dat de getoonde data
     mogelijk niet meer accuraat is. Zonder dit weet user niet of de
     battery/remaining die op het scherm staat nog klopt of bevroren is. */
  const pollFailsRef = useRef(0);
  const [staleStatus, setStaleStatus] = useState(false);

  /* Connection state subscription. */
  useEffect(() => {
    const off = bracelet.onConnectionChange(setConn);
    return off;
  }, [bracelet]);

  /* When mode changes, reset duration to that mode's minimum (spec §11.2:
     default = minimum). Keep it clamped to the new mode's bounds. */
  useEffect(() => {
    setDuration(getModeMeta(selectedMode).minMinutes);
  }, [selectedMode]);

  /* Detecteer natural completion — sessionActive transitie true → false
     ZONDER dat user End/Pause/Restart heeft gedrukt. In die gevallen
     wordt sessionStartedAtRef expliciet door de handler gewist; bij
     natural completion blijft 'ie staan en deze useEffect record 'm. */
  const prevSessionActiveRef = useRef<boolean>(false);
  useEffect(() => {
    if (!status) return;
    const wasActive = prevSessionActiveRef.current;
    prevSessionActiveRef.current = status.sessionActive;

    /* Conditie voor natural-completion recording:
       - sessie was actief, is nu niet meer (transitie)
       - we hebben nog een startedAt-timestamp (= niet expliciet gewist)
       - we zijn niet in paused state (anders is dit een pause-stop) */
    if (
      wasActive &&
      !status.sessionActive &&
      sessionStartedAtRef.current !== null &&
      pausedAt === null
    ) {
      const startedAt = sessionStartedAtRef.current;
      sessionStartedAtRef.current = null;
      const elapsedMin = Math.max(
        1,
        Math.round((Date.now() - startedAt) / 60000),
      );
      const planned = clampDuration(selectedMode, duration);
      recordSession({
        mode: selectedMode,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationMin: elapsedMin,
        plannedMin: planned,
        status: 'completed',
      });
      /* Trigger felicitatie-modal — alleen bij natural completion,
         niet bij manual End of Restart (die clearen
         sessionStartedAtRef expliciet en raken deze branch niet). */
      setCompletedModeForModal(selectedMode);
    }
  }, [status, pausedAt, selectedMode, duration]);

  /* Poll status every 5s while connected (spec §8.3/§11.4).
     Tracking opeenvolgende fouten → na 3× falen (15s) markeren we de
     status als 'stale' zodat de UI dat kan tonen ipv stille rot. */
  const STALE_FAIL_TICKS = 3;
  useEffect(() => {
    if (conn !== 'connected') {
      if (pollRef.current) clearInterval(pollRef.current);
      pollFailsRef.current = 0;
      setStaleStatus(false);
      return;
    }
    let alive = true;
    const tick = async () => {
      try {
        const st = await bracelet.requestStatus();
        if (!alive) return;
        setStatus(st);
        pollFailsRef.current = 0;
        setStaleStatus(false);
      } catch {
        if (!alive) return;
        pollFailsRef.current += 1;
        if (pollFailsRef.current >= STALE_FAIL_TICKS) {
          setStaleStatus(true);
        }
      }
    };
    tick();
    pollRef.current = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [conn, bracelet]);

  /* ── Action handlers ────────────────────────────────────────────── */
  const onConnect = async () => {
    setBusy(true);
    try {
      await bracelet.connect();
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    try {
      await bracelet.disconnect();
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    setBusy(true);
    try {
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: clampDuration(selectedMode, duration),
        command: BleCommand.Start,
      });
      /* Track wanneer de sessie begon — gebruikt voor stats-recording
         bij eind. Wordt over pauses heen behouden zodat de hele
         sessie als 1 entry wordt vastgelegd. */
      sessionStartedAtRef.current = Date.now();
      sessionPlannedRef.current = clampDuration(selectedMode, duration);
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  const onStop = async () => {
    setBusy(true);
    try {
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: 0,
        command: BleCommand.Stop,
      });
      /* Manual end — record als 'stopped' met de werkelijk doorgebrachte
         tijd. Ref MEteen wissen zodat de natural-completion-useEffect
         dit niet ook nog eens opnieuw probeert te recorden. */
      if (sessionStartedAtRef.current !== null) {
        const startedAt = sessionStartedAtRef.current;
        sessionStartedAtRef.current = null;
        const elapsedMin = Math.max(
          1,
          Math.round((Date.now() - startedAt) / 60000),
        );
        recordSession({
          mode: selectedMode,
          startedAt: new Date(startedAt).toISOString(),
          endedAt: new Date().toISOString(),
          durationMin: elapsedMin,
          plannedMin: clampDuration(selectedMode, duration),
          status: 'stopped',
        });
      }
      setPausedAt(null);
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  /* Pause — sla resterende minuten op en zet de bracelet stop. UI
     blijft op active-screen via de isPaused-check. */
  const onPause = async () => {
    if (!status) return;
    const remaining = status.remainingMinutes;
    setBusy(true);
    try {
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: 0,
        command: BleCommand.Stop,
      });
      setPausedAt(remaining);
      /* Refresh status zodat sessionActive=false meekomt in state. UI
         blijft active dankzij isPaused. */
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  /* Resume — start opnieuw met clamped pausedAt als duration. Bracelet
     start een verse haptiek-loop; voor de gebruiker voelt 't als
     "doorgaan waar ik gepauzeerd was". */
  const onResume = async () => {
    if (pausedAt === null) return;
    setBusy(true);
    try {
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: clampDuration(selectedMode, pausedAt),
        command: BleCommand.Start,
      });
      setPausedAt(null);
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  /* Restart — record huidige als 'stopped', start verse sessie met
     min-duration van mode. Tertiaire actie tijdens active/paused. */
  const onRestart = async () => {
    setBusy(true);
    try {
      const fullDuration = getModeMeta(selectedMode).minMinutes;
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: 0,
        command: BleCommand.Stop,
      });
      /* Eerst de huidige sessie afsluiten in history (als er één liep). */
      if (sessionStartedAtRef.current !== null) {
        const startedAt = sessionStartedAtRef.current;
        const elapsedMin = Math.max(
          1,
          Math.round((Date.now() - startedAt) / 60000),
        );
        recordSession({
          mode: selectedMode,
          startedAt: new Date(startedAt).toISOString(),
          endedAt: new Date().toISOString(),
          durationMin: elapsedMin,
          plannedMin: clampDuration(selectedMode, duration),
          status: 'stopped',
        });
      }
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: fullDuration,
        command: BleCommand.Start,
      });
      /* Nieuwe sessie startedAt opslaan + planned duration updaten. */
      sessionStartedAtRef.current = Date.now();
      sessionPlannedRef.current = fullDuration;
      setPausedAt(null);
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  /* ── Derived state ─────────────────────────────────────────────── */
  const sessionActive = status?.sessionActive ?? false;
  const battery = status?.batteryPercent ?? null;
  const charging = status?.charging ?? false;
  const fault = status?.fault ?? false;
  const lowBattery = battery != null && battery >= 5 && battery < 20;
  const criticalBattery = battery != null && battery < 5;
  const batteryColor =
    battery == null
      ? Brand.textDim
      : criticalBattery
        ? Brand.error
        : lowBattery
          ? WARN
          : Brand.success;

  /* Active mode shown in session view — uses status.currentMode (what the
     bracelet is actually running), niet selectedMode (user's last UI pick). */
  const activeMeta = status ? getModeMeta(status.currentMode) : meta;
  const presets = useMemo(() => durationPresets(selectedMode), [selectedMode]);

  /* ── Render branches ────────────────────────────────────────────────
     Determine which "screen" to show based on connection + status. Each
     branch returns its own complete layout; this keeps the JSX flat and
     avoids deep conditional nesting. The sticky bottom-button content
     is computed per branch and rendered below the ScrollView. */

  /* SCREEN 3: Not connected */
  if (conn !== 'connected') {
    return (
      <SafeAreaView style={s.root} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Bracelet' }} />
        <View style={s.searchingWrap}>
          <View style={s.searchingDots}>
            <View style={[s.searchingDot, s.searchingDotActive]} />
            <View style={s.searchingDot} />
            <View style={s.searchingDot} />
          </View>
          <Text style={s.searchingTitle}>
            {conn === 'scanning'
              ? 'Searching'
              : conn === 'connecting'
                ? 'Connecting'
                : 'Looking for your bracelet'}
          </Text>
          <Text style={s.searchingSub}>
            Make sure your bracelet is nearby and powered on.
          </Text>
        </View>
        <View style={s.bottomBar}>
          <Pressable
            style={[s.outlinedBtn, busy && s.btnDisabled]}
            onPress={onConnect}
            disabled={busy}
            accessibilityLabel="Retry searching for bracelet"
          >
            {busy ? (
              <ActivityIndicator color={Brand.text} />
            ) : (
              <Text style={s.outlinedBtnText}>
                {conn === 'disconnected' ? 'Connect' : 'Retry'}
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* SCREEN 6: Fault state (firmware reported error) */
  if (fault) {
    return (
      <SafeAreaView style={s.root} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Bracelet' }} />
        <View style={s.faultWrap}>
          <View style={s.faultIcon}>
            <Text style={s.faultIconText}>!</Text>
          </View>
          <Text style={s.faultTitle}>Something went wrong</Text>
          <Text style={s.faultSub}>
            Your bracelet reported an error. Disconnect and reconnect, or
            contact support if it continues.
          </Text>
        </View>
        <View style={s.bottomBar}>
          <Pressable
            style={[s.primaryBtn, busy && s.btnDisabled]}
            onPress={async () => {
              await onDisconnect();
              await onConnect();
              /* Sim-mode: clear fault zodat user uit deze screen kan
                 navigeren. Op echte hardware blijft fault staan tot
                 Start-command (spec §9 rule 4) — daar is sim==null
                 dus deze line is een no-op. */
              sim?.simClearFault();
              const st = await bracelet.requestStatus();
              setStatus(st);
            }}
            disabled={busy}
            accessibilityLabel="Reconnect bracelet"
          >
            <Text style={s.primaryBtnText}>Reconnect</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* SCREEN 4: Charging — sessions paused (spec §11.5) */
  if (charging && !sessionActive) {
    return (
      <SafeAreaView style={s.root} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Bracelet' }} />
        <View style={s.chargingWrap}>
          <View style={s.chargingIcon}>
            <Text style={s.chargingIconText}>⚡</Text>
          </View>
          <Text style={s.chargingTitle}>Charging</Text>
          <Text style={s.chargingSub}>
            Sessions are paused while the bracelet charges.
          </Text>
          <View style={s.chargingStats}>
            <View style={s.chargingStatRow}>
              <Text style={s.chargingStatLabel}>Battery</Text>
              <Text style={[s.chargingStatVal, { color: batteryColor }]}>
                {battery == null ? '—' : `${battery}%`}
              </Text>
            </View>
          </View>
        </View>
        {sim && <SimDemoBar sim={sim} />}
      </SafeAreaView>
    );
  }

  /* SCREEN 2: Active session — kalm, één focuspunt.
     Operator-feedback 2026-05-27 iter 3:
       - End button moest rustiger (neutraal, geen rode CTA)
       - Pause + Resume + Restart toegevoegd
       - Wanneer paused: timer toont pausedAt, eyebrow "PAUSED",
         Resume-button (mode-color filled) ipv Pause
     UI-stay-condition: sessionActive OF isPaused — anders zou de
     transitie naar idle de pause-state direct breken. */
  if ((sessionActive || isPaused) && status) {
    /* Tijdens pause is sessionActive false maar pausedAt heeft de
       remaining. Tijdens running zit 't in status.remainingMinutes. */
    const displayRemaining = isPaused ? pausedAt! : status.remainingMinutes;
    /* Ambient tint-kleur voor de hele active-session bg. Voor Boost
       (Gamma) wordt rood vervangen door warm amber via getActiveBgTint. */
    const ambientTint = getActiveBgTint(activeMeta.mode);
    /* Progress 0..1 voor de circulaire arc rond de timer. Planned
       komt uit sessionPlannedRef (gezet bij Start/Restart); fallback
       op huidige UI-duration voor edge-cases. */
    const planned =
      sessionPlannedRef.current > 0
        ? sessionPlannedRef.current
        : clampDuration(activeMeta.mode, duration);
    const progress =
      planned > 0
        ? Math.min(1, Math.max(0, (planned - displayRemaining) / planned))
        : 0;
    return (
      <SafeAreaView style={s.root} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Bracelet' }} />
        {/* Ambient tint-overlay — 8% opacity full-screen mood layer.
            pointerEvents="none" zodat touches doorgaan naar onderliggende
            UI. Zit BOVEN Brand.bg maar onder alle content (eerste child). */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: hexToTint(ambientTint, 0.08) },
          ]}
        />
        <ScrollView
          contentContainerStyle={s.activeScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Mode label + (wanneer paused) PAUSED-indicator */}
          <View style={s.activeModeRow}>
            <View
              style={[s.activeDot, { backgroundColor: activeMeta.color }]}
            />
            <Text style={s.activeName}>{activeMeta.name}</Text>
          </View>
          {/* Stale-status banner — verschijnt na 3 mislukte polls (15s)
              zodat user weet dat battery/remaining mogelijk verouderd is.
              Geen rood/alarm — gedimde tekst, informatief. Bracelet
              draait autonoom door (BLE §8 design), dus geen paniek. */}
          {staleStatus && (
            <Text style={s.staleNote}>
              Connection unstable — values may be out of date
            </Text>
          )}
          {isPaused && (
            <Text
              style={[s.pausedLabel, { color: activeMeta.color }]}
            >
              PAUSED
            </Text>
          )}
          {/* BLE-spec §11.2: duration wordt gehandhaafd binnen
              [minMinutes, maxMinutes] van de modus. Als de gebruiker
              pauseert met minder remaining dan minMinutes, zal Resume
              de sessie verlengen tot minMinutes (de bracelet weigert
              kortere sessies). Transparante notice voorkomt "huh, ik
              had nog maar 2 min en nu staat er weer 8" verwarring. */}
          {isPaused &&
            pausedAt !== null &&
            pausedAt < activeMeta.minMinutes && (
              <Text style={s.pausedNote}>
                Resuming will extend the session to {activeMeta.minMinutes}{' '}
                min (bracelet minimum)
              </Text>
            )}

          {/* Adem-cirkel + timer + progress-arc.
              Layering: ProgressArc buitenste laag (300px), PulsingCircle
              (280) in, timer-tekst center. Klokwaarts vullen van -90°
              (top) naar +270° (terug bovenaan). */}
          {/* DrainingCircle = primaire progress-visual (water-metafoor).
              ProgressArc weggehaald 2026-05-27 iter 3: was redundant
              met de drain. Drain alleen is duidelijker en kalmer. */}
          <View style={s.timerWrap}>
            <DrainingCircle
              progress={progress}
              color={activeMeta.color}
              size={220}
            />
            <PulsingCircle
              color={activeMeta.color}
              size={280}
              inMs={MODE_BREATH[activeMeta.mode].inMs}
              outMs={MODE_BREATH[activeMeta.mode].outMs}
            />
            <View style={s.timerCenter} pointerEvents="none">
              <Text style={s.timerNum}>{displayRemaining}</Text>
              <Text style={s.timerUnit}>
                {isPaused ? 'minutes paused' : 'minutes left'}
              </Text>
              {/* "of X total" context — geeft user gevoel hoe ver
                  ze zijn. Dim, klein, onder de unit. */}
              <Text style={s.timerTotal}>of {planned} total</Text>
            </View>
          </View>

          {/* Synced ademhalings-hint — match met PulsingCircle's cyclus
              voor deze mode. Niet tonen tijdens pause: ademhaling-gids
              slaat op de actief-pulserende staat. */}
          {!isPaused && (
            <BreathingHint
              inMs={MODE_BREATH[activeMeta.mode].inMs}
              outMs={MODE_BREATH[activeMeta.mode].outMs}
            />
          )}

          {/* Conditional warnings — only when something needs attention. */}
          {(lowBattery || criticalBattery) && (
            <View style={s.activeWarn}>
              <Text style={[s.activeWarnIcon, { color: batteryColor }]}>
                {criticalBattery ? '⚠' : '🪫'}
              </Text>
              <Text style={s.activeWarnText}>
                {criticalBattery
                  ? `Critical battery (${battery}%) — session may end early`
                  : `Low battery (${battery}%)`}
              </Text>
            </View>
          )}
          {charging && (
            <View style={s.activeWarn}>
              <Text style={[s.activeWarnIcon, { color: Brand.success }]}>
                ⚡
              </Text>
              <Text style={s.activeWarnText}>Charging</Text>
            </View>
          )}

          {/* Restart als kleine tertiaire actie — niet prominent.
              Tap → stopt huidige sessie + start vers met min-duration. */}
          <Pressable
            style={s.restartLink}
            onPress={onRestart}
            disabled={busy}
            accessibilityLabel="Restart session from beginning"
          >
            <Text style={s.restartLinkText}>↻  Restart session</Text>
          </Pressable>

          {/* Rotating quote per mode — fade-cross-over om de 22s.
              Brand-aligned Stoic / direction-georiënteerd. Subtle,
              niet pushy. */}
          <RotatingQuote quotes={MODE_QUOTES[activeMeta.mode]} />

          {/* Stats-strip: mode-specifiek tijdens active session
              (operator-keuze 2026-05-27 iter 3). Toont alleen sessies
              van DEZE mode — "in Boost-session zie je je Boost-
              track-record". Idle screen blijft total-stats. */}
          <View style={s.statsStripWrap}>
            <StatsStrip
              todaySessions={modeStats.todaySessions}
              todayMinutes={modeStats.todayMinutes}
              totalMinutes={modeStats.totalMinutes}
              modeName={activeMeta.name}
            />
          </View>
        </ScrollView>

        {/* Sim demo bar verhuisd naar idle-screen (operator-feedback:
            tijdens een actieve sessie hoort er geen dev-noise te zijn).
            Indien dev nog wil testen tijdens active: zelf wisselen
            naar idle, knoppen daar bedienen, dan terug naar active. */}

        {/* Action bar — Pause+End (running) of Resume+End (paused).
            Beide neutrale outlined buttons; Resume krijgt mode-color
            fill als primary action want user wil door. */}
        <View style={s.bottomBarDual}>
          {isPaused ? (
            <Pressable
              style={[
                s.actionBtnFilled,
                { backgroundColor: activeMeta.color },
                busy && s.btnDisabled,
              ]}
              onPress={onResume}
              disabled={busy}
              accessibilityLabel="Resume session"
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={s.actionBtnFilledText}>Resume</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[s.actionBtnOutlined, busy && s.btnDisabled]}
              onPress={onPause}
              disabled={busy}
              accessibilityLabel="Pause session"
            >
              {busy ? (
                <ActivityIndicator color={Brand.text} />
              ) : (
                <Text style={s.actionBtnOutlinedText}>Pause</Text>
              )}
            </Pressable>
          )}

          <Pressable
            style={[s.actionBtnOutlined, busy && s.btnDisabled]}
            onPress={onStop}
            disabled={busy}
            accessibilityLabel="End current session"
          >
            <Text style={s.actionBtnOutlinedText}>End</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* SCREEN 1: Idle — mode selection + duration + Start CTA */
  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Bracelet' }} />
      <ScrollView
        contentContainerStyle={s.idleScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Status row — minimal, text-only met groene live-dot.
            Operator-keuze 2026-05-27: pill-stijl voelde ouderwets.
            Pure typografie met een kleine dot voor connection-status. */}
        <View style={s.statusRow}>
          <View style={s.statusDotRow}>
            <View style={s.statusDot} />
            <Text style={s.statusInline}>
              CONNECTED  ·{'  '}
              {criticalBattery
                ? 'Critical battery'
                : lowBattery
                  ? 'Low battery'
                  : 'Ready to start'}
            </Text>
          </View>
          <Text style={[s.statusBattery, { color: batteryColor }]}>
            {battery == null ? '—' : `${battery}%`}
          </Text>
        </View>

        {/* Stats-strip — alleen tonen wanneer er al minstens 1 sessie
            in history zit. Vóór de eerste sessie is een lege strip
            demotiverend; "0 sessions" stiekem zien staan voelt niet
            goed bij een nieuwe user. */}
        {stats.totalSessions > 0 && (
          <View style={s.statsStripWrap}>
            <StatsStrip
              todaySessions={stats.todaySessions}
              todayMinutes={stats.todayMinutes}
              totalMinutes={stats.totalMinutes}
            />
          </View>
        )}

        {/* Title */}
        <Text style={s.sectionTitle}>Choose a mode</Text>

        {/* Mode grid — 2 koloms van vierkante cards met fotos.
            Operator-feedback 2026-05-27: Apple Calm / Headspace pattern.
            Cards met foto: image full-bleed + dark gradient onder voor
            tekst-legibility. Cards zonder foto: mode-color gradient als
            fallback zodat de 5 cards visueel consistent voelen.
            Selected: 1.5px mode-color border + glow + helderere bg. */}
        <View style={s.modeGrid}>
          {MODES.map((m: ModeMeta) => {
            const active = m.mode === selectedMode;
            const photo = MODE_IMAGES[m.mode];
            return (
              <Pressable
                key={m.mode}
                style={[
                  s.modeTile,
                  {
                    /* Subtieler selected-state (operator-feedback
                       2026-05-27): geen volle-kleur border + glow meer.
                       Border 1px in mode-kleur @ 40% opacity, geen
                       shadow. Het check-badge top-right is nu de
                       primaire visuele indicator. */
                    borderColor: active
                      ? hexToTint(m.color, 0.4)
                      : 'rgba(255,255,255,0.10)',
                    borderWidth: 1,
                  },
                ]}
                onPress={() => setSelectedMode(m.mode)}
                accessibilityLabel={`Select ${m.name} mode`}
              >
                {/* Background layer — photo OR mode-color gradient.
                    overflow:hidden op de Pressable's borderRadius clipt
                    deze automatisch tot de tile-shape.
                    resizeMethod="resize" voor Android: downsamplet de
                    bitmap AT DECODE TIME. Voorkomt OOM-crashes op
                    emulators bij 5 simultaan-geladen multi-MB images.
                    No-op op iOS (gebeurt daar al automatisch). */}
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    style={s.modeTilePhoto}
                    resizeMode="cover"
                    resizeMethod="resize"
                    fadeDuration={0}
                  />
                ) : (
                  <LinearGradient
                    colors={[hexToTint(m.color, 0.35), 'rgba(20,20,20,0.95)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.modeTilePhoto}
                  />
                )}

                {/* Bottom-to-top gradient voor tekst-legibility — alleen
                    voor foto-cards (gradient-fallback heeft 't al). */}
                {photo && (
                  <LinearGradient
                    colors={[
                      active ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.30)',
                      'rgba(0,0,0,0.85)',
                    ]}
                    style={s.modeTileOverlay}
                  />
                )}

                {/* Content — dot top-left + check top-right + name/dur
                    onderaan. Absolute positioning over de background. */}
                <View style={s.modeTileContent}>
                  <View style={s.modeTileTop}>
                    <View
                      style={[s.modeTileDot, { backgroundColor: m.color }]}
                    />
                    {active && (
                      <View
                        style={[
                          s.modeTileCheckWrap,
                          { backgroundColor: m.color },
                        ]}
                      >
                        <Text style={s.modeTileCheckText}>✓</Text>
                      </View>
                    )}
                  </View>
                  <View>
                    <Text style={s.modeTileName}>{m.name}</Text>
                    <Text style={s.modeTileDur}>
                      {m.minMinutes}–{m.maxMinutes} min
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Duration — water-fill cirkel + neutrale slider (operator-
            keuze 2026-05-27 iter 2). Cirkel vult zich met mode-color
            naarmate slider naar max gaat. Slider zelf is neutraal —
            alle mode-identiteit zit in de cirkel hierboven. */}
        <Text style={s.sectionTitle}>Duration</Text>
        <View style={s.durCircleWrap}>
          <DurationFillCircle
            value={duration}
            min={meta.minMinutes}
            max={meta.maxMinutes}
            color={meta.color}
          />
        </View>
        <DurationSlider
          min={meta.minMinutes}
          max={meta.maxMinutes}
          value={duration}
          onChange={(v) => setDuration(v)}
        />

        {/* Best for — text-only met dot-separators (operator-keuze
            2026-05-27: glass-chips voelden ouderwets). Rustiger,
            minder visuele ruis. */}
        <Text style={s.sectionTitle}>Best for</Text>
        <Text style={s.idealsLine}>
          {MODE_IDEALS[selectedMode].join('  ·  ')}
        </Text>

        {/* Low-battery warning chip (only in idle state) */}
        {lowBattery && (
          <View style={s.warnChip}>
            <Text style={s.warnChipIcon}>⚠</Text>
            <Text style={s.warnChipText}>
              Battery may not last the full session
            </Text>
          </View>
        )}

        {/* Sim demo controls (only in sim mode) */}
        {sim && <SimDemoBar sim={sim} />}
      </ScrollView>

      {/* Sticky bottom Start CTA — in selected mode's color */}
      <View style={s.bottomBar}>
        <Pressable
          style={[
            s.startBtn,
            { backgroundColor: meta.color },
            busy && s.btnDisabled,
          ]}
          onPress={onStart}
          disabled={busy || criticalBattery}
          accessibilityLabel={`Start ${meta.name} session`}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={s.startBtnText}>Start {meta.name}</Text>
              <Text style={s.startBtnArrow}>→</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* CompletionModal — toont na natural completion (timer hits 0).
          Rendert hier omdat na completion de UI vanzelf naar idle gaat. */}
      {completedModeForModal !== null && (
        <CompletionModal
          mode={completedModeForModal}
          onDismiss={() => setCompletedModeForModal(null)}
        />
      )}
    </SafeAreaView>
  );
}

/* ── Stats-strip ─────────────────────────────────────────────────────
   Rustige 3-koloms display: Today (sessies vandaag) · Min today
   (cumulatief vandaag) · Streak (opeenvolgende dagen). Vervangt de
   sessionMetaCard die te dashboard-y voelde. Motivatie zonder data-
   overload. */
function StatsStrip({
  todaySessions,
  todayMinutes,
  totalMinutes,
  modeName,
}: {
  todaySessions: number;
  todayMinutes: number;
  totalMinutes: number;
  /** Wanneer gepasseerd: stats zijn voor specifiek deze mode (active-
   *  session context). Eyebrow boven de cijfers laat 't zien. */
  modeName?: string;
}) {
  return (
    <View>
      {modeName && (
        <Text style={s.statsEyebrow}>{modeName.toUpperCase()} STATS</Text>
      )}
      <View style={s.statsStrip}>
        <View style={s.statsCell}>
          <Text style={s.statsNum}>{todaySessions}</Text>
          <Text style={s.statsLbl}>today</Text>
        </View>
        <View style={s.statsDivider} />
        <View style={s.statsCell}>
          <Text style={s.statsNum}>{todayMinutes}</Text>
          <Text style={s.statsLbl}>min today</Text>
        </View>
        <View style={s.statsDivider} />
        <View style={s.statsCell}>
          <Text style={s.statsNum}>{totalMinutes}</Text>
          <Text style={s.statsLbl}>min total</Text>
        </View>
      </View>
    </View>
  );
}

/* ── Sim demo bar ─────────────────────────────────────────────────────
   Alleen zichtbaar wanneer SimulatedBracelet draait (sim != null). Geeft
   ontwikkelaar / operator een snelle manier om edge-states te triggeren
   zonder echte hardware. Verdwijnt automatisch wanneer USE_SIMULATED_BLE
   = false en RealBracelet actief is. */
function SimDemoBar({ sim }: { sim: NonNullable<ReturnType<typeof getSimHooks>> }) {
  return (
    <View style={s.demoBox}>
      <Text style={s.demoTitle}>SIM · DEV ONLY</Text>
      <View style={s.demoLinkRow}>
        <Pressable
          style={s.demoLink}
          onPress={() => sim.simSetBattery(18)}
          accessibilityLabel="Trigger low battery in simulation"
        >
          <Text style={s.demoLinkText}>Low battery</Text>
        </Pressable>
        <Text style={s.demoSep}>·</Text>
        <Pressable
          style={s.demoLink}
          onPress={() => sim.simSetCharging(true)}
          accessibilityLabel="Trigger charging in simulation"
        >
          <Text style={s.demoLinkText}>Charging</Text>
        </Pressable>
        <Text style={s.demoSep}>·</Text>
        <Pressable
          style={s.demoLink}
          onPress={() => sim.simTriggerFault()}
          accessibilityLabel="Trigger fault in simulation"
        >
          <Text style={s.demoLinkText}>Fault</Text>
        </Pressable>
        <Text style={s.demoSep}>·</Text>
        <Pressable
          style={s.demoLink}
          onPress={() => {
            sim.simSetCharging(false);
            sim.simSetBattery(87);
            sim.simClearFault();
          }}
          accessibilityLabel="Reset simulation to healthy state"
        >
          <Text style={s.demoLinkText}>Reset</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/* Convert a #RRGGBB hex color to a `rgba()` with given alpha. Used voor
   tinted backgrounds in mode-cards en duration-presets. */
function hexToTint(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },

  /* ── Idle screen ─────────────────────────────────────────────────── */
  idleScroll: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  /* Status row — minimal text-only met groene live-dot. Status-pill
     verwijderd 2026-05-27 (operator-feedback "pillen ouderwets"). */
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Brand.success,
  },
  statusInline: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  statusBattery: {
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  sectionTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginTop: 8,
    marginBottom: 12,
  },

  /* Mode grid — 2-col vierkante cards met foto-achtergrond + gradient.
     flexBasis '48%' zonder flexGrow (anders strekt lone card op
     laatste rij zich uit). aspectRatio 1 = perfect vierkant.
     overflow:hidden essentieel zodat de absolute photo/gradient layers
     binnen de afgeronde tile-shape gecliped worden. */
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeTile: {
    flexBasis: '48%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Brand.panel,
  },
  /* Background layer — photo OR mode-color gradient. Vult de hele
     tile via absoluteFillObject; resizeMode cover op de Image schaalt
     'm tot het kleinste passende formaat. */
  modeTilePhoto: {
    ...StyleSheet.absoluteFillObject,
  },
  /* Dark gradient overlay (alleen voor foto-cards) zodat de witte
     mode-naam onderaan altijd leesbaar is, ook bij lichte foto's. */
  modeTileOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  /* Content-layer: padding + spacing-distribution. Bovenop alle
     achtergrond-layers (zIndex impliciet door volgorde in JSX). */
  modeTileContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  modeTileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modeTileDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    /* Subtle white outline rond de dot zodat 'ie zichtbaar blijft tegen
       een foto die toevallig dezelfde kleur heeft (bv. blauwe dot op
       blauwe achtergrond). */
    borderColor: 'rgba(255,255,255,0.40)',
    borderWidth: 1,
  },
  /* Check-badge top-right bij selectie — gevulde kleur cirkel met
     witte ✓, hoog contrast tegen elke foto-achtergrond. */
  modeTileCheckWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTileCheckText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 14,
  },
  modeTileName: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    marginBottom: 4,
    /* Subtle text-shadow voor extra leesbaarheid op foto-achtergrond
       met variabele helderheid. */
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  modeTileDur: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* Duration fill-cirkel (water-fill, mode-color stijgt met slider). */
  durCircleWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  durFillOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Track is een container; bar is de gevulde portion die van onder
     omhoog groeit. position:absolute + bottom:0 zorgt voor de "water-
     fill" effect. */
  durFillTrack: {
    ...StyleSheet.absoluteFillObject,
  },
  durFillBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.45,
  },
  durFillContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  durFillNum: {
    color: Brand.text,
    fontSize: 52,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -2,
    lineHeight: 56,
    /* Text-shadow voor leesbaarheid wanneer de fill achter het getal
       komt (vooral bij hoge slider-waarden). */
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  durFillUnit: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.5,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  /* Slider — touch-area is hoger dan visible track voor betere
     hit-area. Horizontale padding van 20 zodat de thumb bij min-
     waarde (x=0) NIET in Android's back-gesture-zone valt (eerste
     ~24dp vanaf links). Zonder deze padding sleurt elke drag-from-
     left de gebruiker terug naar de vorige pagina. */
  sliderTouch: {
    height: 44,
    justifyContent: 'center',
    marginVertical: 8,
    marginHorizontal: 20,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  sliderFilled: {
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -3,
    /* Neutrale fill (operator-keuze 2026-05-27): mode-color zit nu
       in de fill-cirkel boven de slider, slider zelf blijft grijs. */
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  sliderThumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    /* Neutrale border kleur (was mode-color). */
    borderColor: 'rgba(255,255,255,0.40)',
    /* Subtle shadow voor "tactile" feel — thumb voelt fysiek. */
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    /* Matched de marginHorizontal van sliderTouch zodat labels netjes
       onder de slider-uiteinden uitlijnen. */
    marginHorizontal: 22,
    marginTop: 6,
  },
  sliderLabel: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.3,
  },

  /* Warning chip (low battery in idle) */
  warnChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,159,10,0.10)',
    borderColor: 'rgba(255,159,10,0.30)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  warnChipIcon: {
    color: WARN,
    fontSize: 16,
  },
  warnChipText: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    flex: 1,
  },

  /* ── Active session screen (kalm, één focuspunt) ──────────────────── */
  activeScroll: {
    padding: 16,
    paddingTop: 40,
    paddingBottom: 24,
    alignItems: 'center',
    /* flexGrow zodat de scrollview-content groot genoeg is om de cirkel
       verticaal-centraal te plaatsen op kortere telefoons. */
    flexGrow: 1,
    justifyContent: 'center',
  },
  activeModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 36,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeName: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
  },
  /* Timer-cirkel — 300px om de ProgressArc (300) volledig te
     omvatten. PulsingCircle (280) zit center-positioned binnenin. */
  timerWrap: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pulseWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  pulseCircleInner: {
    position: 'absolute',
  },
  /* DrainingCircle — vol bij start, leegt naarmate session vordert.
     overflow:hidden + borderRadius zorgt voor de cirkel-shape clipping
     van de fill-bar die van onder omhoog groeit. */
  drainOuter: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  drainFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.4,
  },
  /* ── CompletionModal ─────────────────────────────────────────── */
  completionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  completionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  completionCard: {
    width: '85%',
    maxWidth: 380,
    backgroundColor: Brand.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 28,
    alignItems: 'center',
  },
  completionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  completionIconText: {
    fontSize: 30,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 34,
  },
  completionTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  completionMode: {
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  completionMsg: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  completionBtn: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    minWidth: 160,
    alignItems: 'center',
  },
  completionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  timerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerNum: {
    color: Brand.text,
    fontSize: 96,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -4,
    lineHeight: 100,
  },
  timerUnit: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  /* "of X total" — context-regel onder de timer-unit. Heel dim,
     klein. Geeft de gebruiker een gevoel hoe groot de geplande
     sessie was zonder af te leiden van de huidige countdown. */
  timerTotal: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.4,
    marginTop: 6,
  },
  /* BreathingHint — synced met PulsingCircle's 6s cyclus. */
  breatheHint: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.3,
    marginTop: 4,
    marginBottom: 8,
  },
  /* RotatingQuote — onderaan, italic, cross-fade om de 22s. */
  rotatingQuote: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    fontStyle: 'italic',
    letterSpacing: 0.1,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 4,
    paddingHorizontal: 30,
  },
  /* "PAUSED"-indicator boven de timer wanneer de sessie gepauzeerd
     is. Mode-color tekst, ALL CAPS met letter-spacing — duidelijk
     visueel statement zonder schreeuwerig te zijn. */
  pausedLabel: {
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.5,
    marginTop: -24,
    marginBottom: 28,
  },
  /* Stale-poll banner — verschijnt onder mode-row als BLE-status oud
     is. Geen alarm-rood; subtiele waarschuwing. */
  staleNote: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 18,
    paddingHorizontal: 24,
    maxWidth: 320,
  },
  /* Inline notice direct onder PAUSED-label — verschijnt alleen als
     resume de duration zal verhogen (BLE-spec minimum). Kleine, gedimde
     tekst — informatief, niet alarmerend. */
  pausedNote: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 22,
    paddingHorizontal: 24,
    maxWidth: 320,
  },
  /* Restart-link — kleine tertiaire actie tijdens active/paused. Geen
     button-look, gewoon een tappable tekstlink met icoon. */
  restartLink: {
    marginTop: 28,
    paddingVertical: 10,
  },
  restartLinkText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  /* Bottom-bar variant met 2 knoppen naast elkaar (Pause+End of
     Resume+End). flex:1 op de buttons via de actionBtn-styles. */
  bottomBarDual: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: Brand.bg,
  },
  /* Outlined neutrale action button — voor End/Pause. Geen schreeuwerige
     destructive-styling meer (operator-feedback "rustiger, neutrale
     kleur, geen CTA-stijl"). */
  actionBtnOutlined: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnOutlinedText: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  /* Filled action button — voor Resume tijdens paused state. Mode-color
     fill om Resume als de primary "doorgaan"-actie te markeren. */
  actionBtnFilled: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnFilledText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  /* Best-for — text-only met `·` separators (operator-keuze
     2026-05-27, vervangt glass-chip tags). Rustig, geen visuele ruis. */
  idealsLine: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    letterSpacing: 0.1,
    marginBottom: 8,
  },
  /* Warning-chip — alleen tijdens active session, en alleen wanneer
     condition daadwerkelijk geldt (low battery, charging). Subtiel,
     niet schreeuwerig — moet de zen niet breken. */
  activeWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  activeWarnIcon: {
    fontSize: 16,
  },
  activeWarnText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
  },
  /* Sim demo bar tijdens active session — kleinere padding, onderin
     tussen scroll-content en stop-button. Niet langer "in your face". */
  activeDemoBar: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 0,
    opacity: 0.6,
  },

  /* Stats-strip — 3-koloms rustig display met hairline dividers tussen
     cells. Geen card-box; alleen typografie + dividers zoals Apple
     Health-stats. Werkt op zowel idle (boven mode-grid) als active
     (onder de timer). */
  statsStripWrap: {
    marginTop: 24,
    marginBottom: 8,
    /* Op de active-screen heeft de parent ScrollView alignItems:'center'
       waardoor children krimpen tot content-breedte. width:'100%' dwingt
       de strip full-width zodat de labels niet meer wrappen. Werkt ook
       op idle-screen waar er geen alignItems:'center' is. */
    width: '100%',
  },
  /* Eyebrow boven de stats wanneer mode-specifiek — bv. "CALM CONTROL
     STATS". Klein, dim, geeft context dat deze cijfers alleen voor
     deze mode tellen. */
  statsEyebrow: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
  },
  statsCell: {
    flex: 1,
    alignItems: 'center',
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statsNum: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  statsLbl: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.2,
  },

  /* ── Searching / Not connected screen ──────────────────────────────── */
  searchingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  searchingDots: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  searchingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  searchingDotActive: {
    backgroundColor: Brand.accent,
  },
  searchingTitle: {
    color: Brand.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  searchingSub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },

  /* ── Charging screen ───────────────────────────────────────────────── */
  chargingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  chargingIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(74,222,128,0.10)',
    borderColor: 'rgba(74,222,128,0.30)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  chargingIconText: {
    fontSize: 38,
  },
  chargingTitle: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  chargingSub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: 30,
  },
  chargingStats: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  chargingStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  chargingStatLabel: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
  },
  chargingStatVal: {
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },

  /* ── Fault screen ──────────────────────────────────────────────────── */
  faultWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  faultIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.30)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  faultIconText: {
    color: Brand.error,
    fontSize: 40,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 44,
  },
  faultTitle: {
    color: Brand.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  faultSub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },

  /* ── Bottom action bar (sticky) ──────────────────────────────────── */
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: Brand.bg,
  },
  primaryBtn: {
    backgroundColor: Brand.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  outlinedBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  outlinedBtnText: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  startBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  startBtnArrow: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: BrandFonts.bold,
  },
  stopBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.40)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stopBtnText: {
    color: Brand.error,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  btnDisabled: { opacity: 0.5 },

  /* ── Sim demo bar — minimal text-only met dot separators ────────── */
  demoBox: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    opacity: 0.65,
  },
  demoTitle: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  demoLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  demoLink: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  demoLinkText: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
  },
  demoSep: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    marginHorizontal: 4,
  },
});
