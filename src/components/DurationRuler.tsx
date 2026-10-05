/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — duur kiezen met een liniaal

   Operator, 5 okt 2026 ("hoe tijd gekozen wordt is saai en lelijk"): een
   horizontale liniaal zoals de zoomknop van de iPhone-camera. Je sleept;
   elke minuut geeft een zachte tik en de cirkel erboven telt live mee. De
   vaste lijn in het midden is de keuze; een stipje boven een streep toont
   de aanbevolen duur. Grote strepen = kiesbare waarden (met getal om de 5
   minuten), kleine strepen ertussen zijn enkel ritme voor het oog.
   ───────────────────────────────────────────────────────────────────────── */

import { BrandFonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

const STEP = 26; // afstand tussen twee kiesbare waarden
const MINOR = 3; // kleine streepjes tussen twee waarden
const HEIGHT = 64;

export function DurationRuler({
  options,
  value,
  onChange,
  recommendedValue,
  accent,
  edgeColor = '#0a0a0a',
  fadeEdges = true,
}: {
  /** Kiesbare waarden in minuten, oplopend. */
  options: number[];
  value: number;
  onChange: (v: number) => void;
  recommendedValue?: number;
  accent: string;
  /** Achtergrondkleur waar de randen naar uitlopen (6-cijferige hex). */
  edgeColor?: string;
  /** Uit op een foto-achtergrond: een effen uitloop gaf daar een donker blok. */
  fadeEdges?: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const indexOf = (v: number) => Math.max(0, options.indexOf(v));
  /* Laatst gemelde index tijdens het slepen — tik + live meetellen enkel
     als je echt een waarde voorbij gaat. */
  const liveIdx = useRef(indexOf(value));
  const dragging = useRef(false);

  /* Van buitenaf gewijzigd (bv. andere techniek → zijn aanbevolen duur):
     liniaal er zacht naartoe, niet tijdens het slepen zelf. */
  useEffect(() => {
    if (dragging.current || width === 0) return;
    const i = indexOf(value);
    liveIdx.current = i;
    ref.current?.scrollTo({ x: i * STEP, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, width, options.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(options.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / STEP)));
    if (i !== liveIdx.current) {
      liveIdx.current = i;
      if (dragging.current) {
        Haptics.selectionAsync();
        onChange(options[i]);
      }
    }
  };
  const settle = (x: number) => {
    dragging.current = false;
    const i = Math.min(options.length - 1, Math.max(0, Math.round(x / STEP)));
    liveIdx.current = i;
    if (options[i] !== value) onChange(options[i]);
  };

  const pad = width / 2;
  return (
    <View style={s.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={STEP}
          decelerationRate="fast"
          contentOffset={{ x: indexOf(value) * STEP, y: 0 }}
          contentContainerStyle={{ paddingHorizontal: pad }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            dragging.current = true;
          }}
          onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
          onScrollEndDrag={(e) => {
            /* Zonder vaart komt er geen momentum-einde. */
            if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) settle(e.nativeEvent.contentOffset.x);
          }}
        >
          {options.map((m, i) => (
            <View key={m} style={s.slot}>
              {m === recommendedValue && <View style={[s.recDot, { backgroundColor: accent }]} />}
              <View style={s.major} />
              {i < options.length - 1 &&
                Array.from({ length: MINOR }).map((_, k) => (
                  <View key={k} style={[s.minor, { left: ((k + 1) * STEP) / (MINOR + 1) }]} />
                ))}
              {(m % 5 === 0 || options.length <= 6) && <Text style={s.num}>{m}</Text>}
            </View>
          ))}
        </ScrollView>
      )}
      {/* Randen lopen zacht uit naar de achtergrond — geen afgesneden getal. */}
      {fadeEdges && (
      <LinearGradient
        pointerEvents="none"
        colors={[edgeColor, `${edgeColor}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.fade, { left: 0 }]}
      />
      )}
      {fadeEdges && (
      <LinearGradient
        pointerEvents="none"
        colors={[`${edgeColor}00`, edgeColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.fade, { right: 0 }]}
      />
      )}
      {/* De keuze: vaste lijn in het midden. */}
      <View pointerEvents="none" style={[s.center, { left: width / 2 - 1 }]} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { height: HEIGHT, alignSelf: 'stretch' },
  slot: { width: STEP, height: HEIGHT },
  major: {
    position: 'absolute',
    left: 0,
    top: 16,
    width: 2,
    marginLeft: -1,
    height: 22,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  minor: {
    position: 'absolute',
    top: 22,
    width: 1,
    marginLeft: -0.5,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  recDot: {
    position: 'absolute',
    left: -3,
    top: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  num: {
    position: 'absolute',
    top: 42,
    left: -15,
    width: 30,
    textAlign: 'center',
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontVariant: ['tabular-nums'],
  },
  fade: { position: 'absolute', top: 0, bottom: 0, width: 56 },
  center: {
    position: 'absolute',
    top: 10,
    width: 2,
    height: 34,
    borderRadius: 1,
    backgroundColor: '#ffffff',
  },
});
