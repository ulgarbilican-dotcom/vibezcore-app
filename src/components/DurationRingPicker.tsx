/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Duration ring + wheel (gedeeld)

   Operator, 30 september 2026 ("tijd moet instelbaar zijn met exact
   zelfde principe als bij breathwork de cirkel"): dit is bracelet-
   control.tsx's `ModeColorRing`/`WaveFillCircle`/`DurationRing`/
   `DurationWheel` (zelf al 1-op-1 overgenomen van breath-setup.tsx),
   hier voor het EERST geëxtraheerd naar een gedeeld bestand — dit is nu
   de DERDE gebruiksplek (breath-setup.tsx, bracelet-control.tsx,
   bracelet-set-day.tsx), en een derde letterlijke kopie van deze
   golf-fysica/shine-sweep/cilinder-wiskunde zou de "3 plekken, 3x
   dezelfde bugs oplossen"-valkuil worden die eerdere versies van dit
   scherm al doormaakten. `bracelet-control.tsx` blijft voorlopig zijn
   EIGEN kopie behouden (niet aangeraakt — werkt, geen reden om een
   werkend scherm risico te laten lopen tijdens deze extractie);
   `bracelet-set-day.tsx` gebruikt dit gedeelde bestand.

   Exporteert `DurationRing` (ring + golf-vulling + shine-sweep) en
   `DurationWheel` (verticale cilinder-scroll-picker) apart, zodat een
   scherm ze net als bracelet-control.tsx zelf kan stapelen: ring erboven
   toont het resultaat, wheel eronder bedient de waarde.
   ───────────────────────────────────────────────────────────────────────── */

import LiquidWave, { breathWaveLook } from '@/components/LiquidWave';
import { BrandFonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
  interpolate,
  Extrapolation,
  Easing as ReanimatedEasing,
  type SharedValue,
} from 'react-native-reanimated';
import { hapticTap } from '@/utils/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ModeColorRing({ color, size }: { color: string; size: number }) {
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [color, reveal]);

  const dashOffset = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', top: 0, left: 0, transform: [{ rotate: '-90deg' }] }}
        pointerEvents="none"
      >
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#ffffff" strokeWidth={stroke} fill="none" />
        <AnimatedCircle
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
    </View>
  );
}

function WaveFillCircle({ fraction, color, size }: { fraction: number; color: string; size: number }) {
  /* Operator, 6 okt 2026 ("wave overal hetzelfde, supersmooth"): dezelfde
     golf als de breath-setup (components/LiquidWave, UI-thread) i.p.v. een
     eigen JS-golf die ±15× per seconde opnieuw getekend werd. */
  return (
    <LiquidWave
      size={size}
      level={Math.max(0.08, Math.min(1, fraction))}
      {...breathWaveLook(color)}
    />
  );
}

export function DurationRing({
  min,
  max,
  value,
  color,
  label,
  size = 180,
  dark = true,
}: {
  min: number;
  max: number;
  value: number;
  color: string;
  label: string;
  size?: number;
  dark?: boolean;
}) {
  const fillFraction = max > 0 ? value / max : 0;
  const fg = '#ffffff';
  const numColor = '#ffffff';
  const stroke = 2;
  const innerSize = size - stroke * 2 - 4;

  const shimmer = useSharedValue(-1);
  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(7000, withTiming(1, { duration: 950, easing: ReanimatedEasing.inOut(ReanimatedEasing.quad) })),
        withDelay(600, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(shimmer);
  }, []);
  const shineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [-1, -0.85, 0.55, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: shimmer.value * size * 0.75 }, { rotate: '45deg' }],
  }));
  const shineMaskStyle = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden' as const,
  };
  const shineStripStyle = { position: 'absolute' as const, top: -size, bottom: -size, width: 70 };
  const shinePunchStyle = {
    position: 'absolute' as const,
    top: stroke,
    left: stroke,
    width: size - stroke * 2,
    height: size - stroke * 2,
    borderRadius: (size - stroke * 2) / 2,
    backgroundColor: dark ? '#000000' : 'rgba(10,10,12,0.85)',
  };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Operator, 10 okt 2026 ("overal consistentie, dus dun"): geen volle
          dikke kleurring meer, de shimmer blijft enkel op de dunne rand. */}
      <View style={shineMaskStyle} pointerEvents="none">
        <ReanimatedAnimated.View style={[shineStripStyle, shineStyle]}>
          <LinearGradient
            colors={['#ffffff00', dark ? '#EAF2FF99' : '#E5F0FFCC', '#ffffff00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </ReanimatedAnimated.View>
        <View style={shinePunchStyle} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          overflow: 'hidden',
          backgroundColor: dark ? '#000000' : 'rgba(10,10,12,0.85)',
        }}
      >
        <WaveFillCircle fraction={fillFraction} color={color} size={innerSize} />
      </View>
      {/* Zelfde ring als Session Control: dun, gedimd spoor + boog tot de
          gekozen duur + witte greep met rand in de toestandskleur. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -12, top: -12 }}>
        <Svg width={size + 24} height={size + 24}>
          {(() => {
            const r = size / 2 - 1;
            const c = size / 2 + 12;
            const f = Math.min(0.9999, Math.max(0, fillFraction));
            const ang = f * 2 * Math.PI;
            const ex = c + r * Math.sin(ang);
            const ey = c - r * Math.cos(ang);
            const large = f > 0.5 ? 1 : 0;
            return (
              <>
                <Circle cx={c} cy={c} r={r + 1} stroke="#000000" strokeWidth={4} fill="none" />
                <Circle cx={c} cy={c} r={r} stroke={color} strokeOpacity={0.22} strokeWidth={1.5} fill="none" />
                <Path
                  d={`M ${c} ${c - r} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`}
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="none"
                />
                <Circle cx={ex} cy={ey} r={6} fill="#ffffff" stroke={color} strokeWidth={1.5} />
              </>
            );
          })()}
        </Svg>
      </View>
      <View pointerEvents="none" style={rs.durationRingCenter}>
        <Text style={[rs.durationRingLabel, { color: 'rgba(255,255,255,0.75)' }, rs.textShadow]}>{label}</Text>
        <Text style={[rs.durationRingNum, { color: numColor }, rs.textShadow]}>{`${value}:00`}</Text>
      </View>
    </View>
  );
}

const WHEEL_ITEM_H = 44;
const WHEEL_VISIBLE = 3;

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
    const itemOffsetTop = WHEEL_ITEM_H + index * WHEEL_ITEM_H;
    const viewportCenter = scrollY.value + viewportHeight / 2;
    const distanceToCenter = itemOffsetTop + WHEEL_ITEM_H / 2 - viewportCenter;
    const maxDistance = viewportHeight / 2;
    let normalizedDistance = Math.max(-1, Math.min(1, distanceToCenter / maxDistance));
    if (Math.abs(normalizedDistance) < 0.03) normalizedDistance = 0;
    const angleX = normalizedDistance * 38;
    const opacity = Math.max(0.12, 1 - Math.abs(normalizedDistance) * 0.85);
    const fontSize = interpolate(Math.abs(normalizedDistance), [0, 1], [26, 17], Extrapolation.CLAMP);
    return {
      opacity,
      fontSize,
      transform: [{ perspective: 800 }, { rotateX: `${angleX}deg` }],
    };
  });
  return (
    <View style={[rs.wheelRow, { height: WHEEL_ITEM_H }]}>
      <ReanimatedAnimated.Text
        style={[rs.wheelTxt, { color: on ? '#ffffff' : trackColor }, on && rs.wheelTxtOn, rowStyle]}
      >
        {label}
      </ReanimatedAnimated.Text>
    </View>
  );
}

export function DurationWheel({
  options,
  value,
  onChange,
  accent,
  trackColor,
  visibleRows = WHEEL_VISIBLE,
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
  const viewportHeight = WHEEL_ITEM_H * visibleRows;
  const listRef = useRef<ReanimatedAnimated.ScrollView>(null);
  const settledIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const scrollY = useSharedValue(settledIndex * WHEEL_ITEM_H);

  useEffect(() => {
    listRef.current?.scrollTo({ y: settledIndex * WHEEL_ITEM_H, animated: false });
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
    listRef.current?.scrollTo({ y: settledIndex * WHEEL_ITEM_H, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (offsetY: number) => {
    const idx = Math.min(options.length - 1, Math.max(0, Math.round(offsetY / WHEEL_ITEM_H)));
    listRef.current?.scrollTo({ y: idx * WHEEL_ITEM_H, animated: true });
    const picked = options[idx];
    if (picked && picked.value !== value) {
      hapticTap();
      internalChange.current = true;
      onChange(picked.value);
    }
  };

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <View style={[rs.wheelWrap, { height: viewportHeight }]}>
      <View
        style={[rs.wheelPill, { top: (viewportHeight - WHEEL_ITEM_H) / 2, backgroundColor: `${accent}1F` }]}
        pointerEvents="none"
      />
      {recommendedValue !== undefined && value === recommendedValue && (
        <View style={[rs.wheelRecommendedTag, { top: (viewportHeight - WHEEL_ITEM_H) / 2 }]} pointerEvents="none">
          <Text style={rs.wheelRecommendedTagTxt} numberOfLines={1}>
            Recommended
          </Text>
        </View>
      )}
      <ReanimatedAnimated.ScrollView
        ref={listRef}
        style={{ height: viewportHeight }}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H }}
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
      </ReanimatedAnimated.ScrollView>
    </View>
  );
}

const rs = StyleSheet.create({
  wheelWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  wheelPill: {
    position: 'absolute',
    left: 56,
    right: 56,
    top: WHEEL_ITEM_H,
    height: WHEEL_ITEM_H + 6,
    marginTop: -3,
    borderRadius: (WHEEL_ITEM_H + 6) / 2,
  },
  wheelRecommendedTag: {
    position: 'absolute',
    left: 216,
    height: WHEEL_ITEM_H,
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
  wheelTxt: { fontFamily: BrandFonts.semibold, fontSize: 16 },
  wheelTxtOn: { fontFamily: BrandFonts.extrabold, fontSize: 20 },
  durationRingCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  durationRingLabel: { fontSize: 15, fontFamily: BrandFonts.medium, marginBottom: 4 },
  durationRingNum: { fontSize: 48, fontFamily: BrandFonts.extrabold, letterSpacing: -1.5, lineHeight: 54, fontVariant: ['tabular-nums'] },
  durationRingUnit: { fontSize: 13, fontFamily: BrandFonts.semibold, letterSpacing: 0.3, marginTop: 2 },
  textShadow: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
});
