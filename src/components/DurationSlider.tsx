/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — DurationSlider

   Horizontale snap-to-int slider. Geëxtraheerd uit `bracelet-control.tsx`
   (operator, 10 september 2026: "ik vind de pill custom niet mooi,
   schuifregelaar?" — breath-setup.tsx's Custom-duur kreeg dezelfde
   slider i.p.v. een eigen +/- stepper te bouwen) — dezelfde, al
   uitgebreid geteste PanResponder-logica, nu herbruikbaar met een eigen
   accentkleur per aanroeper i.p.v. de vaste neutrale bracelet-styling.

   Drag of tap om te wijzigen, snap op hele eenheden binnen [min, max].
   Pure JS via PanResponder — geen native dependency.

   pageX-based coordinate fix (uit de originele bracelet-versie, iter
   9bc → 9bd, 2026-05-31): `locationX` uit nativeEvent is op Android
   berucht onbetrouwbaar zodra een parent 'm capture't. `pageX` (absolute
   schermcoördinaat) + gemeten slider-pageX geeft de echte relatieve
   positie, robuust op iOS én Android.
   ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { BrandFonts } from '@/constants/theme';

type Props = {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  accent: string;
  /** Onder de track, links/rechts — bv. "2 min" / "30 min". */
  minLabel?: string;
  maxLabel?: string;
  /** Operator, 11 september 2026: breath-setup.tsx ging naar light theme,
     de track/duim waren op wit onzichtbaar (witte duim, `rgba(255,255,
     255,..)` track — allebei gebouwd voor een donkere achtergrond).
     Standaard `false` zodat bracelet-control.tsx (nog steeds dark)
     ongewijzigd blijft — enkel deze ene caller schakelt 'm aan. */
  light?: boolean;
  /** Operator, 18 september 2026 ("de schuifregelaar moet ook dikker"):
     dikkere track + duim voor de addToDay-Duration-kiezer. Standaard
     `false` — bracelet-control.tsx (en de rest) blijven op de bestaande,
     dunnere iOS-achtige maat. */
  thick?: boolean;
  /** Operator, 19 september 2026 ("thumb en actieve lijn moeten fuchsia/
     paars worden, niet wit"): de duim was in dark mode altijd wit, ook
     al is de gevulde track al in `accent` gekleurd. Opt-in i.p.v. het
     gedrag overal te wijzigen — enkel deze ene aanroeper (breath-
     setup.tsx se Session duration-sectie) vroeg erom. */
  thumbColored?: boolean;
};

export default function DurationSlider({
  min,
  max,
  value,
  onChange,
  accent,
  minLabel,
  maxLabel,
  light = false,
  thick = false,
  thumbColored = false,
}: Props) {
  const widthRef = useRef(0);
  const sliderPageXRef = useRef(0);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  minRef.current = min;
  maxRef.current = max;
  valueRef.current = value;
  onChangeRef.current = onChange;

  const sliderViewRef = useRef<View | null>(null);

  const setFromPageX = useCallback((pageX: number) => {
    const w = widthRef.current;
    const sliderX = sliderPageXRef.current;
    const mn = minRef.current;
    const mx = maxRef.current;
    const range = mx - mn;
    if (w < 8 || range <= 0) return;
    const localX = pageX - sliderX;
    const pct = Math.max(0, Math.min(1, localX / w));
    const snapped = Math.round(mn + pct * range);
    if (snapped !== valueRef.current && snapped >= mn && snapped <= mx) {
      onChangeRef.current(snapped);
    }
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => setFromPageX(e.nativeEvent.pageX),
        onPanResponderMove: (e) => setFromPageX(e.nativeEvent.pageX),
      }),
    [setFromPageX],
  );

  const remeasure = useCallback(() => {
    const v = sliderViewRef.current;
    if (!v) return;
    v.measure((_x, _y, w, _h, pageX) => {
      if (typeof w === 'number' && w > 0) widthRef.current = w;
      if (typeof pageX === 'number') sliderPageXRef.current = pageX;
    });
  }, []);

  const range = max - min;
  const filledPct = range > 0 ? ((value - min) / range) * 100 : 0;

  return (
    <View>
      <View
        ref={sliderViewRef}
        style={s.sliderTouch}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
          remeasure();
        }}
        {...panResponder.panHandlers}
      >
        <View style={[s.sliderTrack, thick && s.sliderTrackThick, light && s.sliderTrackLight]} />
        <View
          style={[
            s.sliderFilled,
            thick && s.sliderFilledThick,
            { width: `${filledPct}%`, backgroundColor: accent },
          ]}
        />
        <View
          style={[
            s.sliderThumb,
            thick && s.sliderThumbThick,
            { left: `${filledPct}%` },
            !light && thumbColored && { backgroundColor: accent },
            light && [s.sliderThumbLight, { borderColor: accent }],
          ]}
        />
      </View>
      {(minLabel || maxLabel) && (
        <View style={s.sliderLabels}>
          <Text style={[s.sliderLabel, light && s.sliderLabelLight]}>{minLabel}</Text>
          <Text style={[s.sliderLabel, light && s.sliderLabelLight]}>{maxLabel}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  /* Horizontale padding zodat de thumb bij min-waarde (x=0) niet in
     Android's back-gesture-zone valt (eerste ~24dp vanaf links). */
  sliderTouch: {
    height: 44,
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  /* Operator, 10 september 2026: "kan je enkel dunne elegante slider? hoe
     zou apple dat doen?" — dunnere track (6 → 3), kleinere, randloze thumb
     (28+rand → 22, geen border) met een zachtere schaduw i.p.v. een dikke
     gekleurde rand. Dichter bij iOS' eigen `UISlider`. */
  /* Operator, 19 september 2026 ("dunne zichtbare donkergrijze lijn,
     #3A3A3C"): was een vage 14%-witte tint — nu Apple's eigen
     systeem-grijs voor een niet-actieve slider-track. */
  sliderTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#3A3A3C',
  },
  sliderTrackLight: {
    backgroundColor: 'rgba(10,10,12,0.14)',
  },
  /* Operator, 18 september 2026 ("de schuifregelaar moet ook dikker"):
     track 3→6, duim 22→28 — enkel voor callers die `thick` meegeven. */
  sliderTrackThick: { height: 6, borderRadius: 3 },
  sliderFilled: {
    height: 3,
    borderRadius: 1.5,
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -1.5,
  },
  sliderFilledThick: { height: 6, borderRadius: 3, marginTop: -3 },
  sliderThumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -11,
    marginLeft: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2.5,
    elevation: 3,
  },
  sliderThumbThick: {
    marginTop: -14,
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  /* Wit-op-wit was onzichtbaar — een dunne rand in de accentkleur geeft
     genoeg contrast tegen de lichte achtergrond, ongeacht welke state-
     kleur er binnenkomt. */
  sliderThumbLight: {
    borderWidth: 2,
    shadowOpacity: 0.12,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 22,
    marginTop: 6,
  },
  sliderLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.3,
  },
  sliderLabelLight: {
    color: '#8E8E93',
  },
});
