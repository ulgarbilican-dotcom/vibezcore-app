/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — gedeelde onderdelen van de geschiedenispagina's

   Operator, 5 okt 2026 ("breathwork en State Control history gebruiken
   beide een andere layout en iconen?"): Your Practice en de State Control-
   geschiedenis bouwen nu met exact dezelfde stukken — weekkaart
   (WeekSummaryCard), sectielabel, Apple-inset-gegroepeerde lijst met het
   toestand-icoon in een getinte glazen badge, inklapbare dagkop en een
   gewone rode tekstknop om te wissen. Kleur zit enkel in de icoontjes.
   ───────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import StateGlyph from './StateGlyph';
import VibezGlass from './VibezGlass';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function usePress(scaleTo: number) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => {
      scale.value = withTiming(scaleTo, { duration: 80 });
    },
    onPressOut: () => {
      scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
    },
  };
}

/** "Calm Control", "Clarity & Relax" — de modusnaam in gewone schrijfwijze. */
export function stateName(key: BreathStateKey): string {
  return BREATH_STATES[key].eyebrow
    .split(' ')
    .map((w) => (w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w))
    .join(' ');
}

/** "45 sec" onder de minuut, anders ronde minuten. */
export function humanDur(sec: number): string {
  if (sec < 60) return `${Math.max(1, Math.round(sec))} sec`;
  return `${Math.round(sec / 60)} min`;
}

export function HistorySectionLabel({ children }: { children: string }) {
  return <Text style={s.sectionLbl}>{children}</Text>;
}

/** Toestand-icoon in een getinte glazen badge — hetzelfde teken als op de
 *  Breath-tab en in de plannen. */
export function StateBadge({ stateKey }: { stateKey?: BreathStateKey }) {
  return (
    <View style={s.badge}>
      {stateKey ? (
        <>
          <VibezGlass
            radius={10}
            tint={BREATH_STATES[stateKey].accent}
            level="raised"
            style={StyleSheet.absoluteFill}
          />
          <StateGlyph stateKey={stateKey} size={16} color="#ffffff" strokeWidth={1.9} />
        </>
      ) : null}
    </View>
  );
}

/** Eén paneel met rijen (iOS inset-grouped). */
export function HistoryGroup({ children }: { children: ReactNode }) {
  return <View style={s.group}>{children}</View>;
}

export function HistoryRow({
  stateKey,
  title,
  sub,
  value,
  flag,
  first,
}: {
  stateKey?: BreathStateKey;
  title: string;
  sub?: string;
  value: string;
  /** Klein grijs onder de waarde, bv. "Ended early". */
  flag?: string | null;
  /** Eerste rij: geen scheidingslijn erboven. */
  first: boolean;
}) {
  return (
    <View style={s.row}>
      {!first && <View style={s.sep} />}
      <StateBadge stateKey={stateKey} />
      <View style={s.rowMain}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={s.rowSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={s.valueCol}>
        <Text style={s.rowValue}>{value}</Text>
        {flag ? <Text style={s.rowFlag}>{flag}</Text> : null}
      </View>
    </View>
  );
}

export function HistoryDayHeader({
  label,
  meta,
  open,
  onPress,
}: {
  label: string;
  meta: string;
  open: boolean;
  onPress: () => void;
}) {
  const press = usePress(0.97);
  return (
    <AnimatedPressable
      style={[s.dayHead, press.style]}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${meta}, ${open ? 'expanded' : 'collapsed'}`}
    >
      {open ? (
        <ChevronDown size={16} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
      ) : (
        <ChevronRight size={16} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
      )}
      <Text style={s.dayHeadLbl}>{label}</Text>
      <Text style={s.dayHeadMeta}>{meta}</Text>
    </AnimatedPressable>
  );
}

/** Gewone rode tekstknop zoals Apple's "Delete All Data". */
export function ClearHistoryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const press = usePress(0.96);
  return (
    <AnimatedPressable
      style={[s.clearBtn, press.style]}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
    >
      <Text style={s.clearTxt}>{label}</Text>
    </AnimatedPressable>
  );
}

/** Lege staat: kop, één zin, witte VIBEZCORE-CTA (radius 14). */
export function HistoryEmpty({
  title,
  body,
  cta,
  onPress,
}: {
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
}) {
  const press = usePress(0.96);
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
      <AnimatedPressable
        style={[s.emptyBtn, press.style]}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
      >
        <Text style={s.emptyBtnTxt}>{cta}</Text>
      </AnimatedPressable>
    </View>
  );
}

const s = StyleSheet.create({
  sectionLbl: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 26,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    backgroundColor: Brand.panel,
    borderRadius: 14,
    paddingLeft: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingRight: 14,
  },
  /* Scheidingslijn begint bij de tekst, niet bij de rand (zoals iOS). */
  sep: {
    position: 'absolute',
    top: 0,
    left: 44,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    color: Brand.text,
  },
  rowSub: {
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    color: Brand.textDim,
    marginTop: 1,
  },
  valueCol: { alignItems: 'flex-end' },
  rowValue: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    color: Brand.textDim,
    fontVariant: ['tabular-nums'],
  },
  rowFlag: {
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 6,
  },
  dayHeadLbl: {
    fontFamily: BrandFonts.semibold,
    fontSize: 14,
    color: Brand.text,
  },
  dayHeadMeta: {
    flex: 1,
    textAlign: 'right',
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    color: Brand.textDim,
  },
  clearBtn: {
    alignSelf: 'center',
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  clearTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    color: '#ef4444',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 20,
    color: Brand.text,
    marginBottom: 6,
  },
  emptyBody: {
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Brand.textDim,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 20,
  },
  emptyBtn: {
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    color: '#0a0a0a',
  },
});
