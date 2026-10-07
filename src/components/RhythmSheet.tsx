/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "Match your rhythm" (operator, 7 okt 2026).

   Glazen bottom-sheet, zelfde chrome als het info-paneel van State Control
   (grip, titel, "Done"). Drie stappen:
     choose  — eerste keer (of via Profile): eigen rusthartslag of gemiddelde
     manual  — draaiwiel 40–100
     result  — "Calm Control starts at 64 and slows to 51"
   Fase 2 voegt "Measure my pulse" (camera) toe als eerste keuze.

   Woordkeuze (CLAUDE.md): pulse / rhythm, nooit stress, HRV, diagnose.
   "Not a medical device" staat bij elk getal. */

import { GlassSheet } from '@/components/GlassSheetHost';
import VibezGlass from '@/components/VibezGlass';
import { BrandFonts } from '@/constants/theme';
import { BraceletMode, getModeMeta } from '@/services/ble-contract';
import { rhythmFor } from '@/services/bracelet-haptics';
import {
  addRestingPulseReading,
  AVERAGE_RESTING_BPM,
  MAX_RESTING_BPM,
  MIN_RESTING_BPM,
  chooseAverageRestingPulse,
  getRestingPulse,
  setManualRestingPulse,
  subscribeRestingPulse,
  type RestingPulse,
} from '@/services/resting-pulse';
import { rootBlurRef } from '@/utils/root-blur';
import * as Haptics from 'expo-haptics';
import { HeartPulse } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* De cameramodule zit pas in de build vanaf fase 2. In een oudere build
   ontbreekt de native kant: dan geen meetknop i.p.v. een crash. */
let PulseMeter: typeof import('./PulseMeter').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PulseMeter = require('./PulseMeter').default;
} catch {
  PulseMeter = null;
}

/** Rusthartslag als React-state (volgt elke wijziging, ook uit Profile). */
export function useRestingPulse(): RestingPulse {
  const [p, setP] = useState(getRestingPulse);
  useEffect(() => subscribeRestingPulse(setP), []);
  return p;
}

type Step = 'choose' | 'measure' | 'manual' | 'result';

type Props = {
  visible: boolean;
  /** Toestand waarvoor het resultaat getoond wordt. */
  mode: BraceletMode;
  /** Klaar (keuze gemaakt). Wie de sheet wegveegt, roept `onClose` aan. */
  onDone: () => void;
  onClose: () => void;
  /** Meteen met het draaiwiel openen (Profile → "Enter manually"). */
  startAt?: Step;
  /** Geopend vanuit Profile — de verwijzing naar Profile vervalt dan. */
  fromProfile?: boolean;
};

export default function RhythmSheet({ visible, mode, onDone, onClose, startAt = 'choose', fromProfile = false }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(startAt);
  const [manualBpm, setManualBpm] = useState(() => {
    const p = getRestingPulse();
    return p.source === 'average' ? AVERAGE_RESTING_BPM : p.bpm;
  });
  useEffect(() => {
    if (visible) setStep(startAt);
  }, [visible, startAt]);

  const meta = getModeMeta(mode);
  const pulse = getRestingPulse();
  const rhythm = rhythmFor(mode, pulse.bpm);
  const verb = rhythm.targetBpm > rhythm.startBpm ? 'quickens to' : 'slows to';

  return (
    <GlassSheet visible={visible} onClose={onClose}>
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 18 }]}>
        <VibezGlass
          radius={24}
          level="sheet"
          blurTarget={rootBlurRef}
          style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
        />
        <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }} accessibilityLabel="Close">
          <View style={s.grip} />
        </Pressable>
        <View style={s.head}>
          <Text style={s.eyebrow}>{step === 'result' ? 'YOUR RHYTHM' : 'MATCH YOUR RHYTHM'}</Text>
          {step !== 'result' ? (
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={s.done}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>

        {step === 'choose' && (
          <>
            <View style={s.iconWrap}>
              <HeartPulse size={30} color="#ffffff" strokeWidth={1.8} />
            </View>
            <Text style={s.title}>Start at your own pace</Text>
            <Text style={s.body}>
              Every session begins at your resting pulse, then eases into the rhythm of your state.
            </Text>
            {PulseMeter ? (
              <>
                <Pressable
                  style={({ pressed }) => [s.cta, pressed && s.pressed]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setStep('measure');
                  }}
                  accessibilityRole="button"
                >
                  <Text style={s.ctaTxt}>Measure my pulse</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.secondary, pressed && s.pressed]}
                  onPress={() => setStep('manual')}
                  accessibilityRole="button"
                >
                  <Text style={s.secondaryTxt}>Enter it myself</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={({ pressed }) => [s.cta, pressed && s.pressed]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setStep('manual');
                }}
                accessibilityRole="button"
              >
                <Text style={s.ctaTxt}>Enter my resting heart rate</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [s.secondary, pressed && s.pressed]}
              onPress={() => {
                chooseAverageRestingPulse();
                onDone();
              }}
              accessibilityRole="button"
            >
              <Text style={s.secondaryTxt}>Use an average ({AVERAGE_RESTING_BPM} bpm)</Text>
            </Pressable>
            {!fromProfile ? <Text style={s.note}>You can change this anytime in Profile.</Text> : null}
          </>
        )}

        {step === 'measure' && PulseMeter ? (
          <>
            <Text style={s.title}>Measure your pulse</Text>
            <Text style={s.body}>
              Best after a few quiet minutes sitting — ideally in the morning. Rest your fingertip lightly over the main camera on the back (usually the top one) and the flash.
            </Text>
            <PulseMeter
              onResult={(bpm) => {
                if (addRestingPulseReading(bpm)) {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setStep('result');
                }
              }}
              onManual={() => setStep('manual')}
            />
          </>
        ) : null}

        {step === 'manual' && (
          <>
            <Text style={s.title}>Your resting heart rate</Text>
            <Text style={s.body}>
              Your watch shows it. Or count your pulse for 30 seconds after waking, and double it.
            </Text>
            <BpmWheel value={manualBpm} onChange={setManualBpm} />
            <Pressable
              style={({ pressed }) => [s.cta, pressed && s.pressed]}
              onPress={() => {
                setManualRestingPulse(manualBpm);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setStep('result');
              }}
              accessibilityRole="button"
            >
              <Text style={s.ctaTxt}>Save</Text>
            </Pressable>
          </>
        )}

        {step === 'result' && (
          <>
            <Text style={s.bigNum}>
              {pulse.bpm}
              <Text style={s.bigUnit}> bpm</Text>
            </Text>
            <Text style={s.resultLbl}>Your resting pulse</Text>
            <View style={s.resultRow}>
              <View style={[s.dot, { backgroundColor: meta.color }]} />
              <Text style={s.resultTxt}>
                {meta.name} starts at {rhythm.startBpm} and {verb} {rhythm.targetBpm}
              </Text>
            </View>
            <Pressable style={({ pressed }) => [s.cta, pressed && s.pressed]} onPress={onDone} accessibilityRole="button">
              <Text style={s.ctaTxt}>Continue</Text>
            </Pressable>
            <Text style={s.note}>
              We use your pulse only to set your rhythm. It stays on this device. Not a medical device.
            </Text>
          </>
        )}
      </View>
    </GlassSheet>
  );
}

/* ── Draaiwiel 40–100, zoals de iOS-kiezer ─────────────────────────────── */
const ITEM_H = 46;
const VISIBLE = 5;
const VALUES = Array.from({ length: MAX_RESTING_BPM - MIN_RESTING_BPM + 1 }, (_, i) => MIN_RESTING_BPM + i);

function BpmWheel({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<ScrollView>(null);
  const lastIndex = useRef(VALUES.indexOf(value));
  const [centered, setCentered] = useState(value);
  /* Beginpositie: contentOffset werkt niet op elke Android-versie. */
  const placed = useRef(false);
  const placeAtStart = () => {
    if (placed.current) return;
    placed.current = true;
    ref.current?.scrollTo({ y: Math.max(0, VALUES.indexOf(value)) * ITEM_H, animated: false });
  };

  const indexAt = (y: number) => Math.min(VALUES.length - 1, Math.max(0, Math.round(y / ITEM_H)));
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = indexAt(e.nativeEvent.contentOffset.y);
    if (i !== lastIndex.current) {
      lastIndex.current = i;
      setCentered(VALUES[i]);
      void Haptics.selectionAsync();
    }
  };
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onChange(VALUES[indexAt(e.nativeEvent.contentOffset.y)]);
  };

  return (
    <View style={w.wrap}>
      <View pointerEvents="none" style={w.band} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onLayout={placeAtStart}
        contentContainerStyle={{ paddingVertical: ((VISIBLE - 1) / 2) * ITEM_H }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        accessibilityRole="adjustable"
        accessibilityLabel="Resting heart rate"
        accessibilityValue={{ text: `${centered} beats per minute` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const i = VALUES.indexOf(centered) + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
          if (i < 0 || i >= VALUES.length) return;
          ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
          lastIndex.current = i;
          setCentered(VALUES[i]);
          onChange(VALUES[i]);
        }}
      >
        {VALUES.map((v) => {
          const d = Math.abs(v - centered);
          return (
            <View key={v} style={w.item}>
              <Text style={[w.txt, { opacity: d === 0 ? 1 : d === 1 ? 0.45 : 0.2 }, d === 0 && w.txtOn]}>
                {v}
                {d === 0 ? <Text style={w.unit}> bpm</Text> : null}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingTop: 10,
    paddingHorizontal: 22,
  },
  grip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginBottom: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: BrandFonts.bold, letterSpacing: 1.6 },
  done: { color: '#ffffff', fontFamily: BrandFonts.semibold, fontSize: 15 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: '#ffffff', fontSize: 26, fontFamily: BrandFonts.extrabold, letterSpacing: -0.5, marginBottom: 8 },
  body: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontFamily: BrandFonts.medium,
    lineHeight: 23,
    marginBottom: 22,
  },
  cta: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaTxt: { color: '#1D1D1F', fontSize: 17, fontFamily: BrandFonts.bold },
  secondary: { height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryTxt: { color: '#ffffff', fontSize: 16, fontFamily: BrandFonts.semibold },
  pressed: { opacity: 0.7 },
  note: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12.5,
    fontFamily: BrandFonts.medium,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
  },
  bigNum: { color: '#ffffff', fontSize: 64, fontFamily: BrandFonts.extrabold, letterSpacing: -2, textAlign: 'center' },
  bigUnit: { fontSize: 20, fontFamily: BrandFonts.semibold, letterSpacing: 0, color: 'rgba(255,255,255,0.6)' },
  resultLbl: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 22,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  resultTxt: { color: '#ffffff', fontSize: 15, fontFamily: BrandFonts.semibold, flexShrink: 1 },
});

const w = StyleSheet.create({
  wrap: { height: ITEM_H * VISIBLE, marginBottom: 18, justifyContent: 'center' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_H,
    top: ((VISIBLE - 1) / 2) * ITEM_H,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  txt: { color: '#ffffff', fontSize: 22, fontFamily: BrandFonts.semibold, fontVariant: ['tabular-nums'] },
  txtOn: { fontSize: 26, fontFamily: BrandFonts.bold },
  unit: { fontSize: 15, fontFamily: BrandFonts.medium, color: 'rgba(255,255,255,0.6)' },
});
