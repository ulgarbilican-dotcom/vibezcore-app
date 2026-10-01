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
import { useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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

/* Volgorde exact zoals opgegeven. Operator, 22 september 2026 ("smartphone
   haptics moet haptics worden"): korter label, past nu op één regel i.p.v.
   het eerdere "mag op 2 rijen"-compromis. */
export const GUIDANCE_MODES: GuidanceConfig[] = [
  { key: 'voice',  label: 'Voice',              color: '#0A84FF', haptic: false, voice: true  },
  { key: 'haptic', label: 'Haptics',             color: '#FF9F0A', haptic: true,  voice: false },
  { key: 'both',   label: 'Voice + Haptics',    color: '#BF5AF2', haptic: true,  voice: true  },
  { key: 'silent', label: 'Silent Mode',        color: '#E8ECF2', haptic: false, voice: false },
];

const SPRING = { damping: 17, stiffness: 220, mass: 0.85 };

/* Standaard press-scale (spec: StartCard in breath-welcome.tsx) — los van
   de bestaande select-animaties hieronder (fill/pop op ModeCard, puls op
   BraceletHighlight). Die vuren bij een STATE-wissel (geselecteerd/niet),
   dit vuurt bij vinger-neer/-op. Om nooit op dezelfde transform te botsen
   staat de press-scale op de buitenste Pressable (cardWrap/braceletWrap);
   de fill-scale blijft op `s.card` en de pop-scale op het icoon eronder. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Operator, 22 september 2026 (eigen 2×2-iconbeeld i.p.v. losse lucide-
   iconen, "kan jij die iconen zelf opsplitsen en in juiste kaart zetten"):
   één PNG (1536×1024, transparant, witte lijntekening) met de vier iconen
   naast/onder elkaar — geen 4 losse bestanden, dus geen sprake van
   afzonderlijk hosten. Elke kaart toont zijn kwadrant door de volledige
   afbeelding op 2× de kwadrant-maat te tekenen en de rest af te snijden
   (`overflow:'hidden'`) — dezelfde truc als een CSS-spritesheet. */
export const MODE_ICON_SPRITE_IMG =
  'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20tap%20see%20hear%20feel.png';
/* Kwadrant linksboven = Voice (golfvorm) · rechtsboven = Haptics
   (radiogolven+stip) · linksonder = Voice + Haptics (golf → radiogolven) ·
   rechtsonder = Silent (luidspreker met streep). */
const SPRITE_CELL: Record<GuidanceMode, { row: 0 | 1; col: 0 | 1 }> = {
  voice: { row: 0, col: 0 },
  haptic: { row: 0, col: 1 },
  both: { row: 1, col: 0 },
  silent: { row: 1, col: 1 },
};
/* Bronkwadrant is 768×512 (de helft van 1536×1024) — breedte:hoogte = 1,5,
   dus de kwadrant-container houdt diezelfde verhouding aan om vervorming
   te voorkomen. */
const SPRITE_CELL_RATIO = 1.5;

/* Symbolen per modus, uit `MODE_ICON_SPRITE_IMG` geknipt. Gebruikt
   `tintColor` (ondersteund op zowel iOS als Android) om de kaart-/actieve-
   kleur toe te passen op de witte bronafbeelding — dezelfde dynamische
   kleur die de losse lucide-iconen hiervoor ook kregen.
   Geëxporteerd (operator, 22 september 2026, breath-welcome.tsx se
   "iconen moeten eigen transparante blur kaarten hebben"): dezelfde 4
   glyphen, nu ook op de onboarding-tegels i.p.v. losse foto's. `scale`
   optioneel — de instellingen-kaart hier blijft compact (default 1), de
   grotere onboarding-tegels geven een hogere waarde mee. */
/* Operator, 22 september 2026 ("bij voice + haptics zie ik boven aan klein
   wit puntje dat niet mag"): bij zoom=1 (exact op de kwadrantgrens knippen)
   lekt er een fractie van de buurcel door — afrondingsverschil bij het
   schalen, geen fout in de brontekening zelf. `SPRITE_ZOOM` > 1 kadert
   iets BINNEN elke cel i.p.v. er precies op, zodat dat randpixeltje er
   nooit meer bij kan. */
const SPRITE_ZOOM = 1.16;

/* Operator, 22 september 2026: de brontekeningen staan niet allemaal exact
   gecentreerd in hun eigen cel. Geen ring-fix maar een icoon-fix per geval
   — het uitsnijvenster schuift een fractie van de celbreedte/-hoogte op,
   zodat de tekening zelf in het midden van de (voor alle 4 identieke)
   ring komt.
   - "cirkel voor voice+haptics raakt rechts het icoon": golf-naar-cirkel-
     tekening laat links meer lucht dan rechts → venster naar rechts.
   - "bovenste 2 iconen staan iets lager dan het center": Voice/Haptics
     laten onder meer lucht dan boven → venster naar beneden.
   De twee onderste iconen (Voice+Haptics al gecorrigeerd, Silent al goed)
   krijgen geen y-nudge.
   Operator, 23 september 2026 ("bovenste 2 cirkels/iconen kloppen niet:
   linkse icoon iets naar links, rechtse icoon iets naar rechts"): zelfde
   principe als hierboven, nu ook horizontaal op de bovenste 2 — Voice
   (linksboven) kreeg een klein zetje richting links, Haptics (rechtsboven)
   richting rechts (negatieve x = venster naar links = icoon zelf naar
   rechts, het spiegelbeeld van de `both`-fix hierboven). */
const SPRITE_NUDGE: Partial<Record<GuidanceMode, { x?: number; y?: number }>> = {
  voice: { x: 0.06, y: 0.11 },
  haptic: { x: -0.06, y: 0.11 },
  both: { x: 0.09 },
};

export function ModeGlyph({
  mode,
  color,
  scale = 1,
}: {
  mode: GuidanceMode;
  color: string;
  scale?: number;
}) {
  const h = 24 * scale;
  const w = h * SPRITE_CELL_RATIO;
  const { row, col } = SPRITE_CELL[mode];
  const fullW = w * 2 * SPRITE_ZOOM;
  const fullH = h * 2 * SPRITE_ZOOM;
  /* Houdt het midden van deze cel gecentreerd in de container, ook nu de
     volledige afbeelding groter dan 2× getekend wordt. */
  const nudge = SPRITE_NUDGE[mode];
  const left = w / 2 - SPRITE_ZOOM * (col * w + w / 2) - (nudge?.x ?? 0) * w;
  const top = h / 2 - SPRITE_ZOOM * (row * h + h / 2) - (nudge?.y ?? 0) * h;
  return (
    <View style={{ width: w, height: h, overflow: 'hidden' }}>
      <Image
        source={{ uri: MODE_ICON_SPRITE_IMG }}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: fullW,
          height: fullH,
          left,
          top,
          tintColor: color,
        }}
      />
    </View>
  );
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

  /* Press-scale — eigen shared value, eigen plek (buitenste Pressable),
     zodat dit nooit met `cardStyle` (fill-scale op `s.card`) of `popStyle`
     (select-pop op het icoon) om dezelfde transform-array concurreert. */
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const fg = active ? '#0a0a0a' : cfg.color;
  const labelColor = active ? '#0a0a0a' : 'rgba(255,255,255,0.78)';

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[s.cardWrap, pressStyle]}
    >
      <Animated.View style={[s.glow, glowStyle]} pointerEvents="none" />
      <Animated.View style={[s.card, cardStyle]}>
        <Animated.View style={popStyle}>
          <ModeGlyph mode={cfg.key} color={fg} />
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
    </AnimatedPressable>
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

  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[s.braceletWrap, pressStyle]}
    >
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
    </AnimatedPressable>
  );
}

export default function GuidanceSelector({
  value,
  onChange,
  onBraceletPress,
  showBracelet = false,
  showEyebrow = true,
}: {
  /** `null` = nog niets gekozen; alle knoppen staan dan neutraal
   *  (informatief). Pas na een tap krijgt één knop zijn eigen kleur. */
  value: GuidanceMode | null;
  onChange: (m: GuidanceMode) => void;
  onBraceletPress?: () => void;
  /** De bracelet heeft sinds 2026-07-30 een EIGEN onboarding-scherm.
   *  Standaard uit; alleen aanzetten waar geen apart scherm bestaat. */
  showBracelet?: boolean;
  /** Het kopje "GUIDANCE" boven het raster. Uitzetten waar de schermtitel
   *  dat woord al bevat. */
  showEyebrow?: boolean;
}) {
  const handlePress = (cfg: GuidanceConfig) => {
    if (cfg.key === value) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange(cfg.key);
  };

  return (
    <View style={s.wrap}>
      {/* Het kopje kan weg zodra de titel erboven al "guidance" zegt —
         anders staat hetzelfde woord twee keer boven elkaar. */}
      {showEyebrow && <Text style={s.sectionEyebrow}>GUIDANCE</Text>}

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
