/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — GuidanceSelector

   Structuur en teksten exact volgens operator (2026-07-30):

     GUIDANCE
       Voice · Smartphone Haptics · Voice + Haptics · Silent Mode
       ── uitgelicht, nog niet beschikbaar ──
       World's first Smart Bead Bracelet with synchronized haptic guidance

   Belangrijk: de bracelet is GEEN vijfde optie in de rij. Hij staat apart
   en uitgelicht, omdat hij nog niet bestaat. Dat maakt hem aspirational
   in plaats van "een uitgeschakelde knop".

   De vier echte modi staan in een 2×2 raster — de labels zijn te lang voor
   één rij, en een raster geeft ze de ruimte om bold en leesbaar te zijn.
   Elke modus heeft een eigen kleuridentiteit; de actieve kaart vult zich
   met die kleur en geeft een gloed af.
   ───────────────────────────────────────────────────────────────────────── */

import { BrandFonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { Sparkles, Vibrate, Volume2, Waves } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export type GuidanceMode = 'voice' | 'haptic' | 'both' | 'silent';

export type GuidanceConfig = {
  key: GuidanceMode;
  label: string;
  /** Signatuurkleur — draagt de identiteit van de modus. */
  color: string;
  haptic: boolean;
  voice: boolean;
};

/* Volgorde exact zoals opgegeven. */
export const GUIDANCE_MODES: GuidanceConfig[] = [
  { key: 'voice',  label: 'Voice',              color: '#0A84FF', haptic: false, voice: true  },
  { key: 'haptic', label: 'Smartphone Haptics', color: '#FF9F0A', haptic: true,  voice: false },
  { key: 'both',   label: 'Voice + Haptics',    color: '#BF5AF2', haptic: true,  voice: true  },
  { key: 'silent', label: 'Silent Mode',        color: '#E8ECF2', haptic: false, voice: false },
];

const SPRING = { damping: 17, stiffness: 220, mass: 0.85 };

function ModeIcon({
  mode,
  color,
  size = 17,
}: {
  mode: GuidanceMode;
  color: string;
  size?: number;
}) {
  const common = { size, color, strokeWidth: 2.4 as const };
  switch (mode) {
    case 'voice':
      return <Volume2 {...common} />;
    case 'haptic':
      return <Vibrate {...common} />;
    case 'both':
      return <Sparkles {...common} />;
    case 'silent':
      return <Waves {...common} />;
  }
}

function ModeCard({
  cfg,
  active,
  onPress,
}: {
  cfg: GuidanceConfig;
  active: boolean;
  onPress: () => void;
}) {
  /* Kaart vult zich met de eigen kleur bij activatie; het icoon veert kort
     op zodat de tap een bevestiging krijgt. */
  const fill = useSharedValue(active ? 1 : 0);
  const pop = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    fill.value = withTiming(active ? 1 : 0, { duration: 260 });
    if (first.current) {
      first.current = false;
      return;
    }
    if (active) {
      pop.value = withSequence(
        withSpring(1.32, { damping: 9, stiffness: 430 }),
        withSpring(1, SPRING),
      );
    }
  }, [active, fill, pop]);

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: active
      ? cfg.color
      : 'rgba(255,255,255,0.045)',
    borderColor: active ? cfg.color : 'rgba(255,255,255,0.10)',
    transform: [{ scale: 0.98 + fill.value * 0.02 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: fill.value * 0.34,
    backgroundColor: cfg.color,
  }));

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  const fg = active ? '#0a0a0a' : cfg.color;
  const labelColor = active ? '#0a0a0a' : 'rgba(255,255,255,0.78)';

  return (
    <Pressable onPress={onPress} style={s.cardWrap}>
      <Animated.View style={[s.glow, glowStyle]} pointerEvents="none" />
      <Animated.View style={[s.card, cardStyle]}>
        <Animated.View style={popStyle}>
          <ModeIcon mode={cfg.key} color={fg} />
        </Animated.View>
        <Text
          style={[
            s.label,
            { color: labelColor },
            active && s.labelActive,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {cfg.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/* ── Uitgelichte bracelet-kaart. Bewust GEEN knop-uiterlijk: dit is een
   aankondiging, niet iets wat je kunt kiezen. Tap toont wel de uitleg via
   onPress zodat nieuwsgierigheid ergens heen kan. ── */
export function BraceletHighlight({ onPress }: { onPress?: () => void }) {
  /* Trage puls op de gloed — de kaart "leeft" zonder aandacht te stelen. */
  const pulse = useSharedValue(0);
  useEffect(() => {
    const loop = () => {
      pulse.value = withSequence(
        withTiming(1, { duration: 2400 }),
        withTiming(0, { duration: 2400 }),
      );
    };
    loop();
    const id = setInterval(loop, 4800);
    return () => clearInterval(id);
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + pulse.value * 0.16,
  }));

  return (
    <Pressable onPress={onPress} style={s.braceletWrap}>
      <Animated.View style={[s.braceletGlow, glowStyle]} pointerEvents="none" />
      <View style={s.braceletCard}>
        <View style={s.braceletTopRow}>
          <Text style={s.braceletEyebrow}>SMART BEAD BRACELET</Text>
          <View style={s.comingPill}>
            <Text style={s.comingTxt}>COMING</Text>
          </View>
        </View>
        <Text style={s.braceletTitle}>
          World&apos;s first Smart Bead Bracelet with synchronized haptic
          guidance
        </Text>
      </View>
    </Pressable>
  );
}

export default function GuidanceSelector({
  value,
  onChange,
  onBraceletPress,
  showBracelet = true,
}: {
  value: GuidanceMode;
  onChange: (m: GuidanceMode) => void;
  onBraceletPress?: () => void;
  /** Uit voor compacte contexten (bv. tijdens een lopende sessie). */
  showBracelet?: boolean;
}) {
  const handlePress = (cfg: GuidanceConfig) => {
    if (cfg.key === value) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange(cfg.key);
  };

  return (
    <View style={s.wrap}>
      <Text style={s.sectionEyebrow}>GUIDANCE</Text>

      <View style={s.grid}>
        {GUIDANCE_MODES.map((m) => (
          <ModeCard
            key={m.key}
            cfg={m}
            active={m.key === value}
            onPress={() => handlePress(m)}
          />
        ))}
      </View>

      {showBracelet && <BraceletHighlight onPress={onBraceletPress} />}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    gap: 10,
  },
  sectionEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'center',
  },

  /* 2×2 raster — labels als "Smartphone Haptics" hebben de ruimte nodig. */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardWrap: {
    width: '48%',
    flexGrow: 1,
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 6,
    bottom: 0,
    borderRadius: 16,
    transform: [{ scale: 1.06 }],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  label: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  labelActive: {
    fontFamily: BrandFonts.bold,
  },

  /* ── Bracelet-highlight ── */
  braceletWrap: {
    marginTop: 4,
    position: 'relative',
  },
  braceletGlow: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 8,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: '#E0B341',
    transform: [{ scale: 1.05 }],
  },
  braceletCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(224,179,65,0.42)',
    backgroundColor: 'rgba(224,179,65,0.07)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  braceletTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  braceletEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: '#E0B341',
  },
  comingPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(224,179,65,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(224,179,65,0.34)',
  },
  comingTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: '#E0B341',
  },
  braceletTitle: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13.5,
    lineHeight: 19,
    letterSpacing: -0.1,
    color: '#ffffff',
  },
});
