/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — LibraryListRow

   Gemeenschappelijke sessie-rij voor de Library-sub-pages (New / Favorites /
   Free). Spotify Liked Songs-stijl: foto links, body midden, accessory rechts.
   Per sub-page wordt een verschillend `rightAccessory` doorgegeven
   (NEW-pill / gevuld hartje / FREE-pill).
   ─────────────────────────────────────────────────────────────────────── */

import { PILLAR_META, SERIES_PHOTO, SERIES_PILLAR, type Session } from '@/data/audio-library-data';
import { useSubscription } from '@/hooks/useSubscription';
import {
  getEffectiveTier,
  tierBadgeColor,
  tierBadgeLabel,
} from '@/utils/access-tier';
import { AudioAccent, BrandFonts } from '@/constants/theme';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Operator, 15 september 2026: zelfde light/C-token-toggle als de rest
   van de app — deze rij wordt gedeeld door /library/new, /favorites en
   /free, die allemaal naar light mode gaan. */
/* Operator, 26 september 2026: dark is de nieuwe app-brede default (was
   light, 14 september) — zelfde hardcoded-schakelaar-patroon, enkel de
   waarde omgezet. */
const light = false;
const DARK = {
  text: '#ffffff',
  dim: 'rgba(255,255,255,0.55)',
  border: 'rgba(255,255,255,0.06)',
  art: 'rgba(255,255,255,0.06)',
  ripple: 'rgba(255,255,255,0.04)',
};
const LIGHT = {
  text: '#1D1D1F',
  dim: '#8E8E93',
  border: '#E5E5EA',
  art: '#E5E5EA',
  ripple: 'rgba(10,10,12,0.04)',
};
const C = light ? LIGHT : DARK;

export function LibraryListRow({
  session,
  onPress,
  rightAccessory,
  hideTag = false,
  isLast = false,
}: {
  session: Session;
  onPress: () => void;
  rightAccessory?: ReactNode;
  /** Operator, 15 september 2026 ("label-vervuiling" — Free Sessions
   *  toonde 3x dat een track gratis was): de context zelf (bv. de hele
   *  /library/free-pagina) vertelt dit al één keer, dus de tier-badge
   *  boven de titel hoeft daar niet nogmaals. */
  hideTag?: boolean;
  /** Laatste rij van een Bento-kaart krijgt geen scheidingslijn. */
  isLast?: boolean;
}) {
  /* Operator ("opnieuw kijk alle fotos na bij free sessions, nu zijn die
     verkeerd"): deze rij toonde nog de oude, losse reeks-foto
     (SERIES_PHOTO) — inmiddels vervangen door de pijler-foto's
     (marmeren beelden) overal elders (grid, pillar-scherm, player,
     mini-player). Zelfde bron hier, SERIES_PHOTO blijft fallback. */
  const photo =
    PILLAR_META[SERIES_PILLAR[session.series]]?.img ?? SERIES_PHOTO[session.series];
  /* Iter 9dq v20 (2026-06-02): display-aware isPro (override-aware). In PRO
     mode geen FREE/PRO tag — alles is toegankelijk dus onderscheid is
     irrelevant. Free/Guest user zien de tag wel als wegwijzer voor wat ze
     nu kunnen vs wat upgrade vereist.
     Iter 9dq v59 (2026-06-03): drie tiers ipv twee — 'public' (FREE groen),
     'account' (FREE WITH ACCOUNT blauw), 'pro' (PRO dim). Voor PRO-users
     blijven we de badge verbergen want zij ervaren alles als unlocked.
     Operator, 26 september 2026 (toegangsmodel-gat gedicht, vervolg):
     `isPro` is ook `true` tijdens de 7-dagen-trial — zonder
     `!isTrialing` verdwenen PRO-badges dus voor trial-users, terwijl een
     tik op die sessie na de content-gating-fix terecht wél de preview-
     cap toont. `effectivelyPro` is de "écht volledig ontgrendeld"-status
     die overal in deze badge-beslissing hoort, niet de kale `isPro`. */
  const { isPro, isTrialing } = useSubscription();
  const effectivelyPro = isPro && !isTrialing;
  const tier = getEffectiveTier(session);
  const badgeLabel = tierBadgeLabel(tier);
  /* Operator, 26 september 2026 (accentkleur-wissel, audio): de 'account'
     tier-badge kwam uit access-tier.ts als Royal Indigo Light (#6E85C4,
     AccentTextOnDark) — een informational eyebrow-label, dus exact de
     audio-accentrol. access-tier.ts blijft ongewijzigd (buiten scope);
     override hier lokaal naar AudioAccent i.p.v. daar. 'public'/'pro'
     blijven ongemoeid (groen resp. dim wit — geen accentkleur-rol). */
  const badgeColor =
    tier === 'account' ? AudioAccent : tierBadgeColor(tier);

  /* Press-schaal, zelfde recept als StartCard (breath-welcome.tsx): geen
     bounce bij indrukken, wel bij loslaten. */
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
      style={[s.row, pressStyle]}
      android_ripple={{ color: C.ripple }}
    >
      <View style={s.art}>
        {photo ? <Image source={{ uri: photo }} style={s.artImg} /> : null}
      </View>
      <View style={s.body}>
        {!hideTag && !effectivelyPro && badgeLabel && (
          <Text style={[s.tag, { color: badgeColor }]}>{badgeLabel}</Text>
        )}
        <Text style={s.title} numberOfLines={2}>
          {session.title}
        </Text>
        {/* Operator, 1 okt 2026 ("namen en zinnen van audio niet
           afbreken en 3 puntjes zetten"): serienaam mocht nooit
           afgekapt worden met "…" — `numberOfLines` weggehaald, de rij
           heeft geen vaste hoogte (`row`: alignItems center, flexibel),
           dus wrappen naar 2 regels kost niets. */}
        <Text style={s.sub}>
          {session.series}
        </Text>
      </View>
      {rightAccessory ? (
        <View style={s.accessory}>{rightAccessory}</View>
      ) : null}
      {/* Operator, 15 september 2026 (Apple-upgrade): "de lijn stopt
          netjes vóór de track-afbeelding, exact zoals in iOS
          Instellingen" — geen randlijn meer op de hele rij, maar een
          los, absoluut gepositioneerd lijntje dat pas begint waar de
          tekstkolom begint (art-breedte + gap). */}
      {!isLast && <View style={s.rowSep} pointerEvents="none" />}
    </AnimatedPressable>
  );
}

export default LibraryListRow;

const ART_SIZE = 56;
const ROW_GAP = 14;
const ROW_PAD_X = 18;

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: ROW_PAD_X,
    gap: ROW_GAP,
  },
  /* Begint pas na de foto (ROW_PAD_X + ART_SIZE + ROW_GAP vanaf links),
     zodat de lijn — net als in iOS Instellingen — nooit onder de
     thumbnail zelf doorloopt. */
  rowSep: {
    position: 'absolute',
    left: ROW_PAD_X + ART_SIZE + ROW_GAP,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },
  art: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: C.art,
  },
  artImg: { width: '100%', height: '100%' },
  body: { flex: 1 },
  /* Context Label (Eyebrow)-rol: 11px Bold, +1.5. */
  tag: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  /* Prominent Body-rol: 16px Medium. */
  title: {
    color: C.text,
    fontFamily: BrandFonts.medium,
    fontSize: 16,
    marginTop: 2,
  },
  /* Subheader/muted-rol: 15px Regular. */
  sub: {
    color: C.dim,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    marginTop: 3,
  },
  accessory: { marginLeft: 8 },
});
