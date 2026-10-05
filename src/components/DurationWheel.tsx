/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — DurationWheel

   Operator, 1 okt 2026 ("bij breathwork edit duration na aanklikken bol op
   cirkel krijg ik enkel keuze om vooringestelde minuten te kiezen, dat
   lijkt mij nog oud systeem"): klopte — agenda.tsx's duur-editor gebruikte
   nog de oude discrete chip-grid (`DurationChip`/`DurationSegmentedControl`-
   familie), nooit meegenomen toen breath-setup.tsx op 24 september 2026
   naar deze wheel-picker overstapte ("cijferweergave + losse knoppen +
   slider vervangen door één wheel picker"). Geëxtraheerd uit breath-
   setup.tsx (was daar file-lokaal, `DurationWheelRow`/`DurationWheel`) naar
   hier zodat BEIDE schermen letterlijk dezelfde, al uitvoerig afgestelde
   component gebruiken i.p.v. een tweede kopie die straks weer uit de pas
   loopt — exact dezelfde reden als eerder dit uur bracelet/breathwork se
   headers consistent gemaakt werden. Gedrag/animatie 1-op-1 ongewijzigd
   overgenomen; enkel de plek veranderde. */

import { BrandFonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export const DURATION_WHEEL_ITEM_H = 44;
export const DURATION_WHEEL_VISIBLE = 3;

function DurationWheelRow({
  index,
  label,
  on,
  trackColor,
  scrollY,
  viewportHeight,
}: {
  index: number;
  label: string;
  on: boolean;
  trackColor: string;
  scrollY: SharedValue<number>;
  viewportHeight: number;
}) {
  const rowStyle = useAnimatedStyle(() => {
    const itemOffsetTop = DURATION_WHEEL_ITEM_H + index * DURATION_WHEEL_ITEM_H;
    const viewportCenter = scrollY.value + viewportHeight / 2;
    const distanceToCenter = itemOffsetTop + DURATION_WHEEL_ITEM_H / 2 - viewportCenter;
    const maxDistance = viewportHeight / 2;
    let normalizedDistance = Math.max(-1, Math.min(1, distanceToCenter / maxDistance));
    if (Math.abs(normalizedDistance) < 0.03) normalizedDistance = 0;
    const angleX = normalizedDistance * 38;
    const opacity = Math.max(0.12, 1 - Math.abs(normalizedDistance) * 0.85);
    const fontSize = interpolate(
      Math.abs(normalizedDistance),
      [0, 1],
      [26, 17],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      fontSize,
      transform: [
        { perspective: 800 },
        { rotateX: `${angleX}deg` },
      ],
    };
  });
  return (
    <View style={[s.wheelRow, { height: DURATION_WHEEL_ITEM_H }]}>
      <Animated.Text
        style={[
          s.wheelTxt,
          { color: on ? '#ffffff' : trackColor },
          on && s.wheelTxtOn,
          rowStyle,
        ]}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

export function DurationWheel({
  options,
  value,
  onChange,
  accent,
  trackColor,
  visibleRows = DURATION_WHEEL_VISIBLE,
  recommendedValue,
}: {
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
  accent: string;
  trackColor: string;
  visibleRows?: number;
  recommendedValue?: number;
}) {
  const viewportHeight = DURATION_WHEEL_ITEM_H * visibleRows;
  const listRef = useRef<Animated.ScrollView>(null);
  const settledIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const scrollY = useSharedValue(settledIndex * DURATION_WHEEL_ITEM_H);

  useEffect(() => {
    listRef.current?.scrollTo({ y: settledIndex * DURATION_WHEEL_ITEM_H, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const internalChange = useRef(false);
  const skipFirstValueSync = useRef(true);
  useEffect(() => {
    if (skipFirstValueSync.current) {
      skipFirstValueSync.current = false;
      return;
    }
    if (internalChange.current) {
      internalChange.current = false;
      return;
    }
    listRef.current?.scrollTo({ y: settledIndex * DURATION_WHEEL_ITEM_H, animated: true });
    /* Operator, 5 okt 2026 (gekozen getal bijna onzichtbaar na een
       techniek-wissel): staat de lijst al op die plek, of klemt Android de
       scrollpositie stil bij een kortere lijst, dan komt er geen scroll-
       event en bleef `scrollY` op de oude plek hangen — de vervaging rekende
       dan met de verkeerde afstand. Zelf meezetten. */
    scrollY.value = withTiming(settledIndex * DURATION_WHEEL_ITEM_H, { duration: 250 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  const commit = (offsetY: number) => {
    const idx = Math.min(options.length - 1, Math.max(0, Math.round(offsetY / DURATION_WHEEL_ITEM_H)));
    listRef.current?.scrollTo({ y: idx * DURATION_WHEEL_ITEM_H, animated: true });
    const picked = options[idx];
    if (picked && picked.value !== value) {
      Haptics.selectionAsync();
      internalChange.current = true;
      onChange(picked.value);
    }
  };

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <View style={[s.wheelWrap, { height: viewportHeight }]}>
      <View
        style={[
          s.wheelPill,
          { top: (viewportHeight - DURATION_WHEEL_ITEM_H) / 2, backgroundColor: `${accent}1F` },
        ]}
        pointerEvents="none"
      />
      {recommendedValue !== undefined && value === recommendedValue && (
        <View
          style={[s.wheelRecommendedTag, { top: (viewportHeight - DURATION_WHEEL_ITEM_H) / 2 }]}
          pointerEvents="none"
        >
          <Text style={s.wheelRecommendedTagTxt} numberOfLines={1}>
            Recommended
          </Text>
        </View>
      )}
      <Animated.ScrollView
        ref={listRef}
        style={{ height: viewportHeight }}
        /* Operator, 5 okt 2026 (wiel toonde 9:00 bij een gekozen 5:00): de
           scrollTo bij het monteren kwam op Android soms vóór de layout en
           werd genegeerd. Startpositie meegeven. (Een extra scrollTo in
           onLayout zette het wiel tijdens het draaien steeds terug — weg.) */
        contentOffset={{ x: 0, y: settledIndex * DURATION_WHEEL_ITEM_H }}
        showsVerticalScrollIndicator={false}
        snapToInterval={DURATION_WHEEL_ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: DURATION_WHEEL_ITEM_H }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => commit(e.nativeEvent.contentOffset.y)}
      >
        {options.map((o, i) => (
          <DurationWheelRow
            key={o.value}
            index={i}
            label={o.label}
            on={o.value === value}
            trackColor={trackColor}
            scrollY={scrollY}
            viewportHeight={viewportHeight}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wheelWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  wheelPill: {
    position: 'absolute',
    left: 92,
    right: 92,
    top: DURATION_WHEEL_ITEM_H,
    height: DURATION_WHEEL_ITEM_H + 6,
    marginTop: -3,
    borderRadius: (DURATION_WHEEL_ITEM_H + 6) / 2,
  },
  wheelRecommendedTag: {
    position: 'absolute',
    right: 8,
    height: DURATION_WHEEL_ITEM_H,
    justifyContent: 'center',
  },
  wheelRecommendedTagTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
  },
  wheelRow: { alignItems: 'center', justifyContent: 'center' },
  wheelTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
  },
  wheelTxtOn: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 20,
  },
});
