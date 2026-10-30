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
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { hapticTick } from '@/utils/haptics';

export const DURATION_WHEEL_ITEM_H = 44;
export const DURATION_WHEEL_VISIBLE = 3;

function DurationWheelRow({
  index,
  label,
  on,
  trackColor,
  scrollY,
  viewportHeight,
  dotColor,
  textMode = false,
  padTop = DURATION_WHEEL_ITEM_H,
  small = false,
}: {
  /** Iets kleinere cijfers (tijdwiel in het tijd-blad, 30 okt 2026). */
  small?: boolean;
  /** Ruimte boven de eerste rij: (zichtbare rijen − 1) / 2 rijen, zodat ook de eerste/laatste in het midden kan. */
  padTop?: number;
  /** Tekstlabels i.p.v. korte getallen (technieken, 10 okt 2026). */
  textMode?: boolean;
  index: number;
  label: string;
  on: boolean;
  trackColor: string;
  scrollY: SharedValue<number>;
  viewportHeight: number;
  /** Stipje naast het getal = aanbevolen duur (5 okt 2026). */
  dotColor?: string;
}) {
  const rowStyle = useAnimatedStyle(() => {
    const itemOffsetTop = padTop + index * DURATION_WHEEL_ITEM_H;
    const viewportCenter = scrollY.value + viewportHeight / 2;
    const distanceToCenter = itemOffsetTop + DURATION_WHEEL_ITEM_H / 2 - viewportCenter;
    const maxDistance = viewportHeight / 2;
    let normalizedDistance = Math.max(-1, Math.min(1, distanceToCenter / maxDistance));
    if (Math.abs(normalizedDistance) < 0.03) normalizedDistance = 0;
    const angleX = normalizedDistance * 38;
    const opacity = Math.max(0.12, 1 - Math.abs(normalizedDistance) * 0.85);
    /* 15 okt 2026 (operator: "hard scrollen gaat niet vlot, moet echt smooth,
       Apple-stijl"): schalen i.p.v. de lettergrootte animeren — een andere
       fontSize per beeldje dwong elke frame een nieuwe tekst-opmaak af (dat
       haperde). Enkel transform/opacity, zoals UIPickerView. */
    const scale = interpolate(
      Math.abs(normalizedDistance),
      [0, 1],
      textMode ? [1, 15 / 19] : [1, 17 / 26],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [
        { perspective: 800 },
        { rotateX: `${angleX}deg` },
        { scale },
      ],
    };
  });
  return (
    <View style={[s.wheelRow, { height: DURATION_WHEEL_ITEM_H }]}>
      <View style={s.rowInner}>
        <Animated.Text
          style={[
            s.wheelTxt,
            /* Kleur en gewicht liggen vast: het midden licht op via opacity
               en schaal, zodat er aan het einde niets meer verspringt. */
            { fontSize: textMode ? 19 : small ? 22 : 26, color: '#ffffff' },
            rowStyle,
          ]}
        >
          {label}
        </Animated.Text>
        {dotColor ? (
          /* Zelfde vaste plek rechts van het getal; `opacity` volgt de rij
             niet, zodat je het stipje ook ver van het midden ziet. */
          <View style={[s.rowDot, { backgroundColor: dotColor }]} />
        ) : null}
      </View>
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
  recommendedAsDot = false,
  textMode = false,
  small = false,
}: {
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
  accent: string;
  trackColor: string;
  visibleRows?: number;
  recommendedValue?: number;
  /** Klein stipje naast de aanbevolen waarde i.p.v. het woord (5 okt 2026). */
  recommendedAsDot?: boolean;
  /** Lange tekstlabels: kleinere letters, oplichtend vlak over de breedte. */
  textMode?: boolean;
  /** Iets kleinere cijfers. */
  small?: boolean;
}) {
  const viewportHeight = DURATION_WHEEL_ITEM_H * visibleRows;
  /* 30 okt 2026: 5 zichtbare rijen (tijd-blad) — de ruimte boven/onder groeit mee; bij 3 rijen blijft het één rij. */
  const pad = (DURATION_WHEEL_ITEM_H * (visibleRows - 1)) / 2;
  const listRef = useRef<Animated.ScrollView>(null);
  const settledIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const scrollY = useSharedValue(settledIndex * DURATION_WHEEL_ITEM_H);
  /* Startpositie één keer vastleggen (iPhone-nakijkronde 18 okt 2026): iOS
     past de `contentOffset`-prop bij ELKE wijziging opnieuw toe — na elke
     keuze sprong het wiel dan terug of blokkeerde het tijdens het scrollen.
     Android leest hem enkel bij het monteren; zo werkt het nu overal. */
  const initialOffset = useRef({ x: 0, y: settledIndex * DURATION_WHEEL_ITEM_H }).current;
  /* Traag loslaten zonder vaart: iOS stuurt dan geen momentum-einde, dus de
     keuze werd nooit vastgelegd. Na het loslaten even wachten; komt er geen
     uitloop, dan zelf vastleggen. */
  const dragEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (dragEndTimer.current) clearTimeout(dragEndTimer.current);
  }, []);

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
    /* Enkel bijsturen als de snap er niet exact op landde (anders een
       tweede, zichtbare mini-beweging na het uitlopen). */
    if (Math.abs(offsetY - idx * DURATION_WHEEL_ITEM_H) > 0.5) {
      listRef.current?.scrollTo({ y: idx * DURATION_WHEEL_ITEM_H, animated: true });
    }
    const picked = options[idx];
    if (picked && picked.value !== value) {
      internalChange.current = true;
      onChange(picked.value);
    }
  };

  /* Een fijne tik bij elke regel die door het midden gaat, zolang de
     gebruiker scrolt (zoals Apple's draaiwiel) — niet bij een scroll die de
     app zelf zet. */
  const userScrolling = useSharedValue(false);
  const lastIdx = useSharedValue(settledIndex);
  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => {
      userScrolling.value = true;
    },
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onMomentumEnd: () => {
      userScrolling.value = false;
    },
  });
  useAnimatedReaction(
    () => Math.round(scrollY.value / DURATION_WHEEL_ITEM_H),
    (idx, prev) => {
      if (prev === null || idx === prev) return;
      if (idx < 0 || idx >= options.length) return;
      if (userScrolling.value && idx !== lastIdx.value) scheduleOnRN(hapticTick);
      lastIdx.value = idx;
    },
    [options.length],
  );

  return (
    <View style={[s.wheelWrap, { height: viewportHeight }]}>
      <View
        style={[
          s.wheelPill,
          textMode && { left: 0, right: 0 },
          /* 30 okt 2026 (operator: "kleuren van cirkel en scrollwiel moeten dezelfde zijn"): duidelijker in de
             toestandskleur — tint + dunne rand in de volle kleur, zoals de boog van de duurcirkel. */
          {
            top: (viewportHeight - DURATION_WHEEL_ITEM_H) / 2,
            backgroundColor: `${accent}38`,
            borderWidth: 1.5,
            borderColor: `${accent}B3`,
          },
        ]}
        pointerEvents="none"
      />
      {!recommendedAsDot && recommendedValue !== undefined && value === recommendedValue && (
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
        contentOffset={initialOffset}
        /* 30 okt 2026: ook IN een scrollend blad (plan opbouwen → Times) — op Android krijgt het wiel dan voorrang. */
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={DURATION_WHEEL_ITEM_H}
        /* "normal" (15 okt 2026): met "fast" stopte een harde veeg na een
           paar regels — nu loopt hij natuurlijk uit en snapt dan. */
        decelerationRate="normal"
        contentContainerStyle={{ paddingVertical: pad }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onScrollEndDrag={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          if (dragEndTimer.current) clearTimeout(dragEndTimer.current);
          dragEndTimer.current = setTimeout(() => {
            dragEndTimer.current = null;
            userScrolling.value = false;
            commit(y);
          }, 150);
        }}
        onMomentumScrollBegin={() => {
          if (dragEndTimer.current) clearTimeout(dragEndTimer.current);
          dragEndTimer.current = null;
        }}
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
            dotColor={recommendedAsDot && o.value === recommendedValue ? accent : undefined}
            textMode={textMode}
            padTop={pad}
            small={small}
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
  rowInner: { flexDirection: 'row', alignItems: 'center' },
  /* Absoluut naast het getal, zodat het getal zelf gecentreerd blijft. */
  rowDot: { position: 'absolute', right: -14, width: 6, height: 6, borderRadius: 3 },
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
