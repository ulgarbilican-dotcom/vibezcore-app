/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "Match your rhythm" (operator, 7 okt 2026).

   Glazen bottom-sheet, zelfde chrome als het info-paneel van State Control
   (grip, titel, "Done"). Drie stappen:
     choose  — eerste keer (of via Profile): eigen rusthartslag of gemiddelde
     manual  — draaiwiel 40–100
     result  — "Calm Control starts at 64 and slows to 51"
   Fase 2 voegt "Measure my heart rate" (camera) toe als eerste keuze.

   Woordkeuze (CLAUDE.md, operator 7 okt 2026): "heart rate" (niet "pulse") / rhythm, nooit stress, HRV, diagnose.
   "Not a medical device" staat bij elk getal. */

import ConfirmCard from '@/components/ConfirmCard';
import PressScale from '@/components/PressScale';
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
  clearLiveStartPulse,
  getRestingPulse,
  setLiveStartPulse,
  recordSessionPulse,
  setManualRestingPulse,
  subscribeRestingPulse,
  type RestingPulse,
} from '@/services/resting-pulse';
import { rootBlurRef } from '@/utils/root-blur';
import * as Haptics from 'expo-haptics';
import { ChevronRight, HeartPulse } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticTap, hapticTick } from '@/utils/haptics';

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
  /** State Control (operator, 9 okt 2026): het blad gaat enkel over je
      hartslag van NU — tijdelijk startpunt voor deze sessie. De
      rusthartslag wijzig je in Profile. */
  now?: boolean;
  /** Knop na een geslaagde meting: zegt wat er nu gebeurt (operator, 9 okt
      2026: "Continue, maar wat gaat de gebruiker juist doen?"). */
  nextLabel?: string;
};

export default function RhythmSheet({
  visible,
  mode,
  onDone,
  onClose,
  startAt = 'choose',
  fromProfile = false,
  now: nowProp = false,
  nextLabel = 'Continue',
}: Props) {
  /* Operator, 10 okt 2026: vanuit de bpm-pil (sessie) kan je doorgaan naar
     "Update Resting Heart Rate" — dan wordt dit blad het rusthartslag-blad. */
  const [now, setNow] = useState(nowProp);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [step, setStep] = useState<Step>(startAt);
  /* Wat er net gemeten werd (kan hoger zijn dan de rusthartslag die blijft). */
  const [justMeasured, setJustMeasured] = useState<number | null>(null);
  /* Foutscherm van de meter: dan geen meetuitleg erboven/eronder. */
  const [meterError, setMeterError] = useState(false);
  const [measuredOk, setMeasuredOk] = useState(false);
  const [elevatedReading, setElevatedReading] = useState(false);
  const [meterKey, setMeterKey] = useState(0);
  const [manualBpm, setManualBpm] = useState(() => {
    const p = getRestingPulse();
    return p.source === 'average' ? AVERAGE_RESTING_BPM : p.bpm;
  });
  useEffect(() => {
    if (visible) {
      setNow(nowProp);
      setStep(startAt);
      setJustMeasured(null);
      setMeterError(false);
      setMeasuredOk(false);
      setElevatedReading(false);
      setSavedBpm(null);
    }
  }, [visible, startAt, nowProp]);

  /* Bewaren van een geslaagde meting (knop Save of de vraag bij sluiten). */
  /* Operator, 10 okt 2026 ("na Save sluiten en dan een CTA Let's Go, pas
     dan naar de volgende pagina"): Save bewaart enkel; daarna staat er één
     knop om verder te gaan. Via de vraag bij het sluiten (`andClose`) wil
     je weg, dus dan meteen dicht. */
  const [savedBpm, setSavedBpm] = useState<number | null>(null);
  const [savedBelow, setSavedBelow] = useState(false);
  const saveMeasured = (andClose = false) => {
    setConfirmUnsaved(false);
    if (justMeasured === null) return;
    /* Via de bpm-pil (`now`): enkel het startpunt van de volgende sessie,
       je rusthartslag blijft ongewijzigd (operator, 10 okt 2026). */
    if (now) {
      setLiveStartPulse(justMeasured);
      recordSessionPulse(justMeasured);
      onDone();
      return;
    }
    const below = justMeasured < getRestingPulse().bpm;
    if (!addRestingPulseReading(justMeasured)) return;
    /* De sessie die nu volgt, begint bij het hart van nu. */
    setLiveStartPulse(justMeasured);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (andClose) {
      onClose();
      return;
    }
    setSavedBelow(below);
    setSavedBpm(justMeasured);
  };
  const continueAfterSave = () => {
    if (savedBelow) setStep('result');
    else onDone();
  };
  /* Sluiten met een meting die nog niet bewaard is: eerst vragen, anders
     ging ze stil verloren (test 10 okt 2026: 97 bpm nooit opgeslagen). */
  const [confirmUnsaved, setConfirmUnsaved] = useState(false);
  const guardedClose = () => {
    if (!now && step === 'measure' && measuredOk && justMeasured !== null && savedBpm === null) setConfirmUnsaved(true);
    else onClose();
  };

  const meta = getModeMeta(mode);
  const pulse = getRestingPulse();
  /* Hoger dan de rusthartslag = "je hart nu": de sessie start daar. */
  const aboveRest = justMeasured !== null && justMeasured > pulse.bpm;
  const belowRest = justMeasured !== null && justMeasured < pulse.bpm;
  const rhythm = rhythmFor(mode, pulse.bpm, aboveRest && justMeasured !== null ? justMeasured : pulse.bpm);
  const verb = rhythm.targetBpm > rhythm.startBpm ? 'quickens to' : 'slows to';

  return (
    <GlassSheet visible={visible} onClose={guardedClose} fullHeight={step === 'measure'}>
      <View
        style={[
          s.sheet,
          { paddingBottom: Math.max(insets.bottom, 12) + 30 },
          /* Operator, 9 okt 2026 ("nog hoger, tot onder Heart Rate"): het
             meetblad vult ~78% van het scherm, de ring staat midden in de
             vrije ruimte. */
          /* Vervolg ("kan die kaart volledig tot boven komen?"): tot net
             onder de statusbalk. */
          /* Vervolg ("echt tegen de bovenkant, tekst iets lager"): volle
             hoogte; de inhoud begint onder de statusbalk. */
          step === 'measure' ? { flex: 1, paddingTop: insets.top + 6 } : null,
        ]}
      >
        <VibezGlass
          radius={24}
          level="sheet"
          blurTarget={rootBlurRef}
          style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
        />
        <Pressable onPress={guardedClose} hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }} accessibilityLabel="Close">
          <View style={s.grip} />
        </Pressable>
        <View style={[s.head, step === 'choose' && { marginBottom: 4 }]}>
          {/* Operator, 10 okt 2026: gecentreerd in hoofdletters, zelfde kop
              als SESSION CONTROL / BREATHWORK (dit blad voelt als een pagina).
              Absoluut gecentreerd, zodat "Cancel" het niet opzij duwt. */}
          <Text style={s.eyebrow} pointerEvents="none">
            {/* Operator, 10 okt 2026: de kop zegt welk getal het is; geen tweede
                titel meer onder het icoon. */}
            {step === 'choose' ? '' : now ? 'Heart Rate' : 'Resting Heart Rate'}
          </Text>
          <View />
          {/* Actieblad (protocol): de keuze in State Control heeft onderaan
              al "Not Now" — geen tweede Cancel bovenaan. */}
          {step !== 'result' && !(now && step === 'choose') ? (
            <PressScale onPress={guardedClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={s.done}>Cancel</Text>
            </PressScale>
          ) : null}
        </View>

        {step === 'choose' && now && (
          <>
            {/* Operator, 10 okt 2026 ("moet echt duidelijk zijn, hoe zou Apple
                dat doen"): eerst wat er NU geldt (getal + waar het vandaan
                komt), dan één hoofdactie (meten voor deze sessie) en de
                zeldzamere actie (je rusthartslag zelf aanpassen) als
                tekstknop. Een meting hier verandert je rusthartslag niet. */}
            <View style={[s.iconWrap, s.iconWrapLg]}>
              <HeartPulse size={40} color="#ffffff" strokeWidth={1.7} />
            </View>
            {/* Operator, 10 okt 2026: hart bovenaan, het label recht boven
                het getal (zoals Apple Gezondheid een waarde toont). */}
            <Text style={s.valueLbl}>{pulse.liveBpm !== null ? 'HEART RATE NOW' : 'RESTING HEART RATE'}</Text>
            <Text style={s.bigNum}>
              {pulse.liveBpm ?? pulse.bpm}
              <Text style={s.bigUnit}> bpm</Text>
            </Text>
            <Text style={[s.resultLbl, { textAlign: 'center' }]}>
              {pulse.liveBpm !== null
                ? `For your next session · Resting ${pulse.bpm} bpm`
                : pulse.source === 'average'
                  ? 'Average — not measured yet'
                  : pulse.source === 'manual'
                    ? `Entered by you${pulse.at ? ` · ${new Date(pulse.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`
                    : `Measured${pulse.at ? ` ${new Date(pulse.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`}
            </Text>
            {/* Operator, 10 okt 2026 ("is die uitleg hier nodig? kan op de
                website"): geen uitleg in dit blad — wie hier komt, kent het
                getal al; de uitleg staat één keer op de eerste
                rusthartslag-pagina en op de website. */}
            <View style={{ height: 18 }} />
            {PulseMeter ? (
              <PressScale
                style={[s.cta]} haptic scaleTo={0.97}
                onPress={() => {
                  hapticTap();
                  setStep('measure');
                }}
                accessibilityRole="button"
              >
                <Text style={s.ctaTxt}>{pulse.liveBpm !== null ? 'Measure Again' : 'Measure for This Session'}</Text>
              </PressScale>
            ) : null}
            {pulse.liveBpm !== null ? (
              <PressScale
                style={[s.secondary]}
                onPress={() => {
                  /* Terug naar de rusthartslag als startpunt. */
                  clearLiveStartPulse();
                  onDone();
                }}
                accessibilityRole="button"
              >
                <Text style={s.secondaryTxt}>Use Resting Heart Rate · {pulse.bpm} bpm</Text>
              </PressScale>
            ) : null}
            <PressScale
              style={[s.secondary, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }]}
              onPress={() => {
                hapticTap();
                setNow(false);
                setStep('choose');
              }}
              accessibilityRole="button"
            >
              <Text style={[s.secondaryTxt, { color: 'rgba(255,255,255,0.7)' }]}>Update Resting Heart Rate</Text>
              <ChevronRight size={16} color="rgba(255,255,255,0.55)" strokeWidth={2.4} />
            </PressScale>
          </>
        )}

        {step === 'choose' && !now && (
          <>
            {/* Operator, 10 okt 2026: zelfde opbouw als het hartslagblad ervoor
                (gecentreerd), en geen uitleg — die staat op de eerste
                rusthartslag-pagina en op de website. */}
            <View style={[s.iconWrap, s.iconWrapLg]}>
              <HeartPulse size={40} color="#ffffff" strokeWidth={1.7} />
            </View>
            <Text style={s.valueLbl}>RESTING HEART RATE</Text>
            <Text style={s.bigNum}>
              {pulse.bpm}
              <Text style={s.bigUnit}> bpm</Text>
            </Text>
            <Text style={[s.resultLbl, { textAlign: 'center', marginBottom: 18 }]}>
              {pulse.source === 'average'
                ? 'Average — not measured yet'
                : pulse.source === 'manual'
                  ? `Entered by you${pulse.at ? ` · ${new Date(pulse.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`
                  : `Measured${pulse.at ? ` ${new Date(pulse.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`}
            </Text>
            {PulseMeter ? (
              <>
                <PressScale
                  style={[s.cta]} haptic scaleTo={0.97}
                  onPress={() => {
                    hapticTap();
                    setStep('measure');
                  }}
                  accessibilityRole="button"
                >
                  <Text style={s.ctaTxt}>Measure my heart rate</Text>
                </PressScale>
                <PressScale
                  style={[s.secondary]}
                  onPress={() => setStep('manual')}
                  accessibilityRole="button"
                >
                  <Text style={s.secondaryTxt}>Enter it myself</Text>
                </PressScale>
              </>
            ) : (
              <PressScale
                style={[s.cta]} haptic scaleTo={0.97}
                onPress={() => {
                  hapticTap();
                  setStep('manual');
                }}
                accessibilityRole="button"
              >
                <Text style={s.ctaTxt}>Enter my resting heart rate</Text>
              </PressScale>
            )}
            <PressScale
              style={[s.secondary]}
              onPress={() => {
                chooseAverageRestingPulse();
                onDone();
              }}
              accessibilityRole="button"
            >
              <Text style={s.secondaryTxt}>Use an average ({AVERAGE_RESTING_BPM} bpm)</Text>
            </PressScale>
            {!fromProfile && !nowProp ? <Text style={s.note}>You can change this anytime in Profile.</Text> : null}
          </>
        )}

        {step === 'measure' && PulseMeter ? (
          <>
            {/* Operator, 9 okt 2026 ("dubbele tekst"): geen instructie meer
                bovenaan — de statusregel onder de lijn is de enige tekst en
                beweegt mee met wat er gebeurt. Ring blijft op dezelfde hoogte. */}
            {/* Vervolg (operator: "laat de cirkel zakken"). */}
            <View style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 40 }}>
            <PulseMeter
              key={meterKey}
              purpose={now ? 'session' : 'baseline'}
              onElevated={(bpm) => {
                setJustMeasured(bpm);
                setElevatedReading(true);
              }}
              onResult={(bpm) => {
                /* Operator, 9 okt 2026: vinkje in de ring + onderaan één
                   duidelijke volgende stap. Vervolg ("na de meting mag het
                   niet direct naar de volgende pagina"): pas bewaren bij een
                   tik op de knop — de eerste keer schakelt het bewaren de
                   State Control-tab meteen door. */
                setJustMeasured(bpm);
                setMeasuredOk(true);
              }}
              onManual={() => setStep('manual')}
              onErrorChange={setMeterError}
            />
            </View>
            {elevatedReading ? (
              /* Operator, 10 okt 2026 ("measure again is geen verplichting"):
                 boven het rustbereik mag je gewoon verder — de sessie start
                 op dit ritme; je rusthartslag blijft ongewijzigd. Opnieuw
                 meten is een keuze, geen verplichting. */
              <View style={{ marginTop: 'auto', alignSelf: 'stretch' }}>
                <PressScale
                  style={[s.cta, { alignSelf: 'stretch' }]}
                  haptic
                  scaleTo={0.97}
                  onPress={() => {
                    if (justMeasured !== null) {
                      setLiveStartPulse(justMeasured);
                      recordSessionPulse(justMeasured);
                    }
                    onDone();
                  }}
                  accessibilityRole="button"
                >
                  <Text style={s.ctaTxt}>{nextLabel}</Text>
                </PressScale>
                <PressScale
                  style={s.secondary}
                  onPress={() => {
                    setElevatedReading(false);
                    setJustMeasured(null);
                    setMeterKey((k) => k + 1);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={s.secondaryTxt}>Measure Again</Text>
                </PressScale>
              </View>
            ) : measuredOk ? (
              /* Enkel bij een veel lagere meting dan je rusthartslag eerst het
                 uitlegscherm (die waarde wordt nog niet overgenomen). */
              <View style={{ marginTop: 'auto', alignSelf: 'stretch' }}>
              <PressScale
                style={[s.cta, { alignSelf: 'stretch' }]}
                haptic
                scaleTo={0.97}
                onPress={() => (savedBpm !== null ? continueAfterSave() : saveMeasured())}
                accessibilityRole="button"
              >
                {/* Operator, 10 okt 2026 ("wat als iemand opnieuw wil meten?
                    op het einde save of opnieuw"): bewaren is een bewuste
                    keuze, opnieuw meten staat er altijd onder. */}
                <Text style={s.ctaTxt}>{now || savedBpm !== null ? "Let's Go" : 'Save'}</Text>
              </PressScale>
              {savedBpm !== null ? (
                <Text style={[s.fact, { textAlign: 'center', marginTop: 14, marginBottom: 6 }]}>
                  Saved as your resting heart rate
                </Text>
              ) : justMeasured !== null ? (
                <PressScale
                  style={s.secondary}
                  onPress={() => {
                    setMeasuredOk(false);
                    setJustMeasured(null);
                    setSavedBpm(null);
                    setMeterKey((k) => k + 1);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={s.secondaryTxt}>Measure Again</Text>
                </PressScale>
              ) : null}
              </View>
            ) : (
              <View style={[s.facts, { marginTop: 'auto', marginBottom: 26, alignSelf: 'center' }, meterError ? { opacity: 0 } : null]}>
                {/* Enkel de privacy-geruststelling, op het moment dat de camera aangaat. */}
                <Text style={s.fact}>No images saved</Text>
              </View>
            )}
          </>
        ) : null}

        {step === 'manual' && (
          <>
            <Text style={s.title}>Your resting heart rate</Text>
            <Text style={s.body}>
              Your watch shows it. Or count your heart rate for 30 seconds after waking, and double it.
            </Text>
            <BpmWheel value={manualBpm} onChange={setManualBpm} />
            <PressScale
              style={[s.cta]} haptic scaleTo={0.97}
              onPress={() => {
                setManualRestingPulse(manualBpm);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setStep('result');
              }}
              accessibilityRole="button"
            >
              <Text style={s.ctaTxt}>Save</Text>
            </PressScale>
          </>
        )}

        {step === 'result' && (
          <>
            <Text style={s.bigNum}>
              {justMeasured ?? pulse.bpm}
              <Text style={s.bigUnit}> bpm</Text>
            </Text>
            <Text style={s.resultLbl}>
              {now || aboveRest ? 'Your heart right now' : belowRest ? 'Right now' : 'Your resting heart rate'}
            </Text>
            {belowRest ? (
              <Text style={s.keepNote}>
                Much lower than before. Measure once more to confirm — until then your rhythm stays at {pulse.bpm}.
              </Text>
            ) : null}
            <View style={s.resultRow}>
              <View style={[s.dot, { backgroundColor: meta.color }]} />
              <Text style={s.resultTxt}>
                {meta.name} starts at {rhythm.startBpm} and {verb} {rhythm.targetBpm}
              </Text>
            </View>
            <PressScale style={[s.cta]} haptic scaleTo={0.97} onPress={onDone} accessibilityRole="button">
              <Text style={s.ctaTxt}>{nextLabel}</Text>
            </PressScale>
            {now && !belowRest ? (
              <Text style={s.restNote}>For this session only. Your resting heart rate stays {pulse.bpm} bpm.</Text>
            ) : aboveRest ? (
              <Text style={s.restNote}>Your resting heart rate stays {pulse.bpm} — we keep your calmest reading.</Text>
            ) : null}
            <Text style={s.note}>
              We use your heart rate only to set your rhythm. It stays on this device. Not a medical device.
            </Text>
          </>
        )}
      </View>
      <ConfirmCard
        visible={confirmUnsaved}
        title="Save this measurement?"
        body={justMeasured !== null ? `${justMeasured} bpm becomes your resting heart rate for your sessions.` : ''}
        confirmLabel="Save"
        cancelLabel="Discard"
        onCancel={() => {
          setConfirmUnsaved(false);
          onClose();
        }}
        onConfirm={() => saveMeasured(true)}
      />
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
      hapticTick();
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
  /* Operator, 9 okt 2026 ("kaart hoger, de ring moet vrij staan"). */
  facts: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 34 },
  fact: { fontFamily: BrandFonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' },
  factDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.3)' },
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24, marginBottom: 30 },
  eyebrow: {
    position: 'absolute',
    left: 0,
    right: 0,
    color: '#ffffff',
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  done: { color: '#ffffff', fontFamily: BrandFonts.semibold, fontSize: 15 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  title: { color: '#ffffff', fontSize: 26, fontFamily: BrandFonts.extrabold, letterSpacing: -0.5, lineHeight: 32, marginBottom: 14 },
  body: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontFamily: BrandFonts.medium,
    lineHeight: 24,
    marginBottom: 40,
  },
  cta: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  iconWrapLg: { width: 76, height: 76, borderRadius: 38, alignSelf: 'center' },
  valueLbl: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.2,
    marginTop: 6,
    marginBottom: 2,
  },
  ctaTxt: { color: '#1D1D1F', fontSize: 17, fontFamily: BrandFonts.bold },
  secondary: { height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
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
  restNote: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    textAlign: 'center',
    marginTop: 12,
  },
  keepNote: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: -12,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
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
