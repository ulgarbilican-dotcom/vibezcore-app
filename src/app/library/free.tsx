/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — /library/free — "Free Sessions"

   Sub-page van de Audio Library. Bereikbaar via de FREE-knop op
   /(tabs)/index. Toont alle sessies waarvoor `getEffectiveTier(sess) ===
   'public'` (10 stuks, geverifieerd 27 september 2026 — zie
   feedback-verify-content-before-proposing memory). Geen empty state —
   er zijn altijd free sessies.

   Operator, 15 september 2026: "kijk nu free sessions na (ook aanpassen
   de 10 free sessions)" — het legacy-veld `sess.free` (27 sessies,
   inclusief de 17 die sinds 1 september 2026 pas via de 7-dagen-trial
   vrijkomen) werd hier ooit gebruikt; de fix naar `getEffectiveTier` is
   inmiddels wél doorgevoerd (zie de filter hieronder) — deze kop-comment
   was alleen nooit bijgewerkt en beweerde dus ten onrechte het
   tegendeel. */

import { LibraryListRow } from '@/components/LibraryListRow';
import { MiniPlayer, MINI_PLAYER_HEIGHT } from '@/components/MiniPlayer';
import { usePlayerState } from '@/services/audio-player';
import { SESSIONS, type Session } from '@/data/audio-library-data';
import { AudioAccent, AudioAccentLight, BrandFonts } from '@/constants/theme';
import { getEffectiveTier } from '@/utils/access-tier';
import { useGatedOpenSession } from '@/utils/openSession';
import { router, Stack } from 'expo-router';
import { Play } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/* Zelfde light/C-token-toggle als elders. */
/* Operator, 26 september 2026: dark is de nieuwe app-brede default (was
   light, 14 september) — zelfde hardcoded-schakelaar-patroon, enkel de
   waarde omgezet. */
const light = false;
/* Operator ("check free sessions ook, daar moet alles correct zijn"):
   `card` stond gelijk aan `bg` (allebei #0a0a0a) — in dark mode was het
   "witte Bento-vlak" uit de comment hieronder dus onzichtbaar, zelfde
   kleur als de pagina-achtergrond, geen enkele scheiding. Zelfde
   C.surface-toon als (tabs)/index.tsx; rand iets feller (0.08→0.14,
   dezelfde hairline-conventie als de rest van de Audio Library). */
const DARK = {
  bg: '#0a0a0a',
  card: '#1C1C1E',
  text: '#ffffff',
  dim: 'rgba(255,255,255,0.55)',
  border: 'rgba(255,255,255,0.14)',
};
const LIGHT = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  text: '#1D1D1F',
  dim: '#8E8E93',
  border: '#E5E5EA',
};
const C = light ? LIGHT : DARK;
const SOFT_SHADOW = light
  ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 14,
      elevation: 2,
    }
  : {};
/* Uitlijning: linkerkant van "Free Sessions" moet exact op de linkerkant
   van de track-thumbnails vallen — listCard's marge (14) + de rij-eigen
   binnenpadding in LibraryListRow (18) = 32. */
const CONTENT_X = 32;

/* Operator, 15 september 2026 (Apple-upgrade): "Ready-to-Play indicator
   — play-icoontjes lichten eenmalig zacht op in Signal Blue, en gaan dan
   over naar het rustige Royal Indigo" — een korte, eenmalige kleur-
   overgang op mount (niet oneindig herhalend, dat zou irritant worden). */
function ReadyPlayButton({
  onPress,
  delay,
}: {
  onPress: () => void;
  delay: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 900 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay]);
  /* Operator, 26 september 2026 (accentkleur-wissel, audio): play-button-fill
     flash was Signal Blue (#3A8FFF) → AudioAccent. Vervolg (missede
     ROYAL_INDIGO-const, "kleine player moet ook nieuwe accentkleur"): de
     flash liep van teal náár navy — nu blijft 'ie binnen de teal-familie
     (licht → vol) i.p.v. naar de afgeschafte kleur te faden. */
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], [AudioAccentLight, AudioAccent]),
  }));
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Animated.View style={[s.playBtn, animatedStyle]}>
        <Play size={13} color="#ffffff" fill="#ffffff" strokeWidth={0} />
      </Animated.View>
    </Pressable>
  );
}

/* Operator, 15 september 2026: vaste weergavevolgorde voor de 10 gratis
   sessies (los van hun volgorde in `SESSIONS`, die de reeks-volgorde in
   de bibliotheek volgt, niet wat hier het beste leest). */
const FREE_ORDER = [
  'Identity',
  'The Inner Child',
  'The Father You Tried To Outdo',
  'The Love That Came With Conditions',
  'The Naive Eye That Costs You Everything',
  'Become a Monster',
  'Building Inner Strength & Discipline',
  'Theta Arabic Ritual',
  'Background Calm',
  'Delta Descent',
];

export default function LibraryFreeScreen() {
  const sessions = useMemo<Session[]>(() => {
    const publicSessions = SESSIONS.filter(
      (sess) => getEffectiveTier(sess) === 'public',
    );
    return [...publicSessions].sort(
      (a, b) => FREE_ORDER.indexOf(a.title) - FREE_ORDER.indexOf(b.title),
    );
  }, []);
  /* Iter 9dq v63 (2026-06-03): gated-open ipv directe openSession. Public-
     tier sessies (alle 'free' in deze sub-page) spelen direct. Mocht een
     account-tier of PRO-tier sessie hier later landen, dan handelt de
     gating-laag de juiste flow af (AccountWallModal / push naar /subscribe). */
  const openGated = useGatedOpenSession();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  /* Operator, 15 september 2026: "moet de player ook al in Free Sessions
     verschijnen?" — dit is een root-level stack-scherm, geen kind van
     `(tabs)`, dus de MiniPlayer-instantie in (tabs)/_layout.tsx bestaat
     hier niet vanzelf. Eigen `standalone`-instantie + scroll-padding
     die ervoor reserveert zodra er een sessie actief is. */
  const playerState = usePlayerState();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Operator, 15 september 2026 (Apple-upgrade): titel stond dubbel
         (klein in de topbar, groot in het header-blok eronder) — die
         herhaling is weg. Topbar draagt nu enkel de terugknop, net als
         Apple's "large title"-navigatiepatroon; de échte titel leeft in
         het H1-blok. */}
      <View style={s.topbar}>
        <Pressable onPress={goBack} hitSlop={14} style={s.backBtn}>
          <Text style={s.backChev}>‹</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          /* + insets.bottom: de standalone mini-speler staat BOVEN de Android-
             navigatiebalk (8 okt 2026: laatste kaarten vielen erachter). */
          { paddingBottom: (playerState.session ? MINI_PLAYER_HEIGHT : 0) + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Operator, 15 september 2026 (Apple-upgrade): "drie keer
           herhaald dat het gratis is — kop, groen label, grijze knop.
           Dat schreeuwt om aandacht." Titel nu links uitgelijnd (H1,
           32px Bold, -0.4) i.p.v. gecentreerd, exact boven de
           thumbnails; em-streepje uit de hulptekst gehaald. */}
        <View style={s.header}>
          <Text style={s.h1}>Free Sessions</Text>
          <Text style={s.subtitle}>
            Listen to these any time, no subscription required
          </Text>
        </View>
        {/* Eén doorlopend wit Bento-vlak i.p.v. losse rijen op de kale
           achtergrond — zelfde patroon als de tracklijst op "Your
           Journey". `hideTag`: de FREE-badge boven elke titel is weg,
           de pagina zelf ("Free Sessions") vertelt dat al. Het grijze
           "Free"-knopje rechts is vervangen door de minimalistische
           Indigo play-knop. */}
        <View style={s.listCard}>
          <View style={s.listCardClip}>
            {sessions.map((sess, i) => (
              <LibraryListRow
                key={sess.url}
                session={sess}
                onPress={() => openGated(sess)}
                hideTag
                isLast={i === sessions.length - 1}
                rightAccessory={
                  <ReadyPlayButton
                    onPress={() => openGated(sess)}
                    delay={i * 40}
                  />
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>
      <MiniPlayer standalone />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 56 },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  /* Operator, 26 september 2026: was ROYAL_INDIGO (afgeschafte kleur) —
     een terug-knop is navigatie-chrome, geen accent-element, dus neutraal
     wit i.p.v. Bio-Teal. */
  backChev: {
    color: C.text,
    fontSize: 26,
    lineHeight: 26,
    fontWeight: '600',
  },

  /* Links uitgelijnd, exact boven de thumbnails (zie `CONTENT_X`). */
  header: {
    alignItems: 'flex-start',
    paddingHorizontal: CONTENT_X,
    paddingTop: 20,
    paddingBottom: 20,
  },
  /* Display Title (H1): 32px Bold, -0.4. */
  h1: {
    color: C.text,
    fontFamily: BrandFonts.bold,
    fontSize: 32,
    letterSpacing: -0.4,
    textAlign: 'left',
  },
  /* Subheader/muted: 15px Regular, #8E8E93. */
  subtitle: {
    color: C.dim,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    textAlign: 'left',
    marginTop: 6,
  },

  /* Eén groot wit Bento-vlak — radius 16, vederlichte schaduw om 'm los
     te tillen van de off-white achtergrond. */
  /* Twee lagen: de schaduw kan niet samen met `overflow:'hidden'` op
     hetzelfde vlak staan (dat clipt 'm meteen onzichtbaar) — de buitenste
     laag draagt de schaduw, de binnenste klemt de rijen af tot de
     afgeronde hoeken. */
  listCard: {
    marginHorizontal: 14,
    borderRadius: 16,
    backgroundColor: C.card,
    ...SOFT_SHADOW,
  },
  listCardClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },

  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
