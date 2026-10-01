/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Mini player (vaste balk boven de tab-bar)

   Gemount in (tabs)/_layout zodat het over elke tab heen ligt maar onder
   de full-player modal. Render-conditie:
     - state.session != null         (er staat iets klaar)
     - usePathname() !== '/player'   (anders dubbel met full-player)
     - usePathname() !== '/welcome'  (niet op Welcome / onboarding)

   Tap-zones:
     - hele balk: opent full-player
     - play-knop: togglePlay() — bij previewBlocked opent in plaats daarvan
       de full-player zodat de preview-upsell modal weer vanzelf verschijnt

   Operator, 15 september 2026 (Apple-upgrade — "ruimtelijke logica en
   continuïteit, Apple Music/Podcasts-stijl"): "het meescrollen van de
   geminimaliseerde player is een absolute designfout... moet transformeren
   in een vast anker dat boven de Tab Bar vergrendelt". Dit was een reëel
   architectuurprobleem: de vorige versie was VERSLEEPBAAR (PanResponder +
   AsyncStorage-positie) — een gebruiker die 'm ooit had verplaatst kon
   'm zo laten staan middenin de content, wat precies leest als "de player
   scrollt mee". Volledig herbouwd naar een vaste, niet-versleepbare balk
   direct boven de tab-bar (`bottom: TAB_BAR_HEIGHT + insets.bottom`),
   plus een radicaal slankere Apple Music-achtige laag-profiel opmaak:
   thumbnail · titel+serie · play-knop, geen tijdcodes, geen aparte
   subtitle-regel, geen sluitknop (sluiten kan enkel door de audio te
   stoppen — Apple Music/Spotify-conventie).
   ─────────────────────────────────────────────────────────────────────── */

import { PlayPauseGlyph } from '@/components/PlayPauseGlyph';
import { PILLAR_META, SERIES_PHOTO, SERIES_PILLAR } from '@/data/audio-library-data';
import { AudioAccent } from '@/constants/theme';
import { togglePlay, unload, usePlayerState } from '@/services/audio-player';
import { router, usePathname } from 'expo-router';
import { ChevronUp, X } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Moet matchen met (tabs)/_layout se eigen tab-bar-hoogte. */
export const TAB_BAR_HEIGHT = 64;
/* Exportabel zodat schermen met een ScrollView hun eigen
   `contentContainerStyle.paddingBottom` erop kunnen afstemmen.
   Operator, 15 september 2026: "mag iets hoger, nu slecht zichtbaar" (64
   → 76), direct daarna: "doe dubbel zo hoog" — × 2 op die 76. */
export const MINI_PLAYER_HEIGHT = 152;

/* Operator, 26 september 2026 (accentkleur-wissel, audio): Signal Blue
   (SIGNAL_BLUE) was hier de "nu actief"-voortgangslijn — exact de
   audio-accentrol. Vervangen door AudioAccent (theme.ts), scope beperkt
   tot Audio Library/player (zie player.tsx voor de volledige toelichting). */

const DARK = {
  bg: '#141414',
  border: 'rgba(255,255,255,0.08)',
  text: '#fff',
  dim: 'rgba(255,255,255,0.5)',
  art: 'rgba(255,255,255,0.06)',
  trackBg: 'rgba(255,255,255,0.10)',
};
const LIGHT = {
  bg: '#FFFFFF',
  border: '#E5E5EA',
  text: '#1D1D1F',
  dim: '#8E8E93',
  art: '#E5E5EA',
  trackBg: 'rgba(10,10,12,0.08)',
};

export function MiniPlayer({
  standalone = false,
}: {
  /** Operator, 15 september 2026: "moet de player ook al in Free Sessions
   *  verschijnen?" — /library/free (en de andere /library/*-pagina's)
   *  zijn ROOT-level stack-schermen, geen kind van `(tabs)`, dus de ENE
   *  MiniPlayer-instantie in `(tabs)/_layout.tsx` bestaat daar niet —
   *  exact dezelfde architectuur-valkuil als eerder bij breath-welcome/
   *  audio-welcome (zie de toelichting daar). Zo'n scherm rendert zijn
   *  EIGEN `<MiniPlayer standalone />`: geen tab-bar om boven te
   *  vergrendelen, dus enkel `insets.bottom` i.p.v.
   *  `TAB_BAR_HEIGHT + insets.bottom`. */
  standalone?: boolean;
}) {
  const state = usePlayerState();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  /* Operator, 26 september 2026: teruggedraaid — de witte balk was juist
     goed ("witte player was goed draai dat terug"). Hardcoded LIGHT,
     zelfde patroon als de rest (geen live theme-hook). */
  const C = LIGHT;

  /* Operator, 26 september 2026 ("zwart scherm bij Identity/Machiavelli-
     sessies, na eerdere fixes nog steeds"): de ECHTE oorzaak zat hier de
     hele tijd — de vier hooks hieronder (useSharedValue/useAnimatedStyle)
     stonden NA drie voorwaardelijke `return null`s. Zodra state.session of
     pathname wisselt (= precies het moment waarop een sessie geopend
     wordt en dit component naar '/player' navigeert), verandert het aantal
     hooks tussen twee renders → React's reconciler gooit "Rendered more
     hooks than during the previous render." In productie (geen LogBox)
     zag dat eruit als een stil zwart scherm terwijl de audio bleef spelen.
     Alle eerdere notify()/setTimeout-fixes elders waren reële, maar
     secundaire bugs — dit was de hoofdoorzaak. Hooks moeten ONVOORWAARDELIJK
     vóór elke early return staan. */
  const rowPressScale = useSharedValue(1);
  const playPressScale = useSharedValue(1);
  const rowPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rowPressScale.value }],
  }));
  const playPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playPressScale.value }],
  }));

  if (!state.session) return null;
  /* Verstop op routes waar de mini-player niet thuishoort. usePathname is
     hier veiliger dan useSegments — modals worden door expo-router als
     ÉÉN pathname-segment ('/player') gerapporteerd.
     Operator, 26 september 2026 ("sticky mini-player valt over de CTA op
     welcome-scherm van audio/breath/bracelet"): naast het gedeelde
     `/welcome`-scherm ook de per-product intro-schermen toegevoegd —
     `/breath-welcome` (Breath) en `/bracelet-preview` (Bracelet). Deze
     hebben allemaal een CTA onderaan die anders achter de balk verdwijnt. */
  if (pathname === '/player') return null;
  if (pathname === '/welcome') return null;
  if (pathname === '/breath-welcome') return null;
  if (pathname === '/bracelet-preview') return null;

  const session = state.session;
  const pct =
    state.durationSec > 0
      ? Math.min(100, (state.positionSec / state.durationSec) * 100)
      : 0;
  /* Operator ("minimize player moeten de fotos ook aangepast worden naar
     nieuwe foto"): zelfde bron als de full player — pijler-foto i.p.v.
     de oude losse reeks-foto (SERIES_PHOTO blijft fallback). */
  const photo =
    PILLAR_META[SERIES_PILLAR[session.series]]?.img ?? SERIES_PHOTO[session.series];

  const onExpand = () => {
    router.push({
      pathname: '/player',
      params: {
        title: session.title,
        series: session.series,
        url: session.url,
        free: session.isFree ? 'true' : 'false',
        desc: session.desc,
      },
    });
  };

  const onPlay = () => {
    /* PreviewBlocked: tap doet niet "speel verder" (zou direct opnieuw
       in cap lopen). In plaats daarvan: open full-player → preview-modal
       verschijnt weer + user kan upgrade. Operator-keuze Q1. */
    if (state.previewBlocked) {
      onExpand();
      return;
    }
    togglePlay();
  };

  /* Operator, 15 september 2026: "moet er ook een X komen zodat de
     luisteraar direct kan sluiten?" — terug, na 'm eerder weggehaald te
     hebben (Apple Music/Spotify laten sluiten alleen via de audio zelf
     laten stoppen; dat bleek hier onhandig genoeg om terug te draaien). */
  const onClose = () => {
    unload();
  };

  /* Press-schaal, zelfde recept als StartCard (breath-welcome.tsx): geen
     bounce bij indrukken, wel bij loslaten. Twee losse waarden, want de
     balk (expand) en de play-knop zijn allebei eigen tikbare doelen.
     (De useSharedValue/useAnimatedStyle-hooks zelf staan nu bovenaan,
     vóór de early returns — zie toelichting daar.) */
  const onRowPressIn = () => {
    rowPressScale.value = withTiming(0.98, { duration: 80 });
  };
  const onRowPressOut = () => {
    rowPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };

  const onPlayPressIn = () => {
    playPressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPlayPressOut = () => {
    playPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };

  return (
    <View
      style={[
        s.wrap,
        {
          bottom: standalone ? insets.bottom : TAB_BAR_HEIGHT + insets.bottom,
          backgroundColor: C.bg,
          borderTopColor: C.border,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Flinterdunne voortgangslijn over de bovenrand — Signal Blue, de
         functionele "actieve afspeelstatus"-kleur, ongeacht thema. */}
      <View style={[s.progressTrack, { backgroundColor: C.trackBg }]}>
        <View style={[s.progressFill, { width: `${pct}%` }]} />
      </View>

      {/* Operator, 15 september 2026: "niet duidelijk, moet dat niet zo'n
         schuine lijn zijn?" — het kleine inline icoontje tussen de tekst
         en de knop viel niet op. Groter, vetter en gecentreerd BOVENAAN
         de balk (net onder de voortgangslijn) — de klassieke "sleep/tik
         omhoog"-positie, meteen het eerste wat opvalt. */}
      <View style={s.expandHint} pointerEvents="none">
        <ChevronUp size={20} color={C.dim} strokeWidth={3} />
      </View>

      <AnimatedPressable
        onPress={onExpand}
        onPressIn={onRowPressIn}
        onPressOut={onRowPressOut}
        style={[s.row, rowPressStyle]}
      >
        <View style={[s.art, { backgroundColor: C.art }]}>
          {photo ? <Image source={{ uri: photo }} style={s.artImg} /> : null}
        </View>
        <View style={s.body}>
          <Text style={[s.title, { color: C.text }]} numberOfLines={1}>
            {session.title}
          </Text>
          <Text style={[s.series, { color: C.dim }]} numberOfLines={1}>
            {session.series}
          </Text>
        </View>
        <AnimatedPressable
          onPress={onPlay}
          onPressIn={onPlayPressIn}
          onPressOut={onPlayPressOut}
          hitSlop={10}
          style={[s.playBtn, playPressStyle]}
        >
          <PlayPauseGlyph size={22} color="#ffffff" playing={state.playing} />
        </AnimatedPressable>
        <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
          <X size={18} color={C.dim} strokeWidth={2.2} />
        </Pressable>
      </AnimatedPressable>
    </View>
  );
}

const s = StyleSheet.create({
  /* Vaste balk direct boven de tab-bar — NIET meer versleepbaar, dus geen
     PanResponder/AsyncStorage-positielogica meer nodig. */
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: MINI_PLAYER_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 50,
    elevation: 8,
  },
  progressTrack: {
    height: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: AudioAccent, // accentkleur-wissel (audio): was SIGNAL_BLUE
  },
  expandHint: {
    alignItems: 'center',
    paddingTop: 4,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  /* Operator, 15 september 2026: elementen meegeschaald met de dubbele
     balkhoogte (art/knop groter, tekst groter) i.p.v. een hoge balk met
     dezelfde kleine iconen er verloren in te laten staan. */
  art: {
    width: 76,
    height: 76,
    borderRadius: 10,
    overflow: 'hidden',
  },
  artImg: { width: '100%', height: '100%' },
  body: { flex: 1 },
  /* Prominent Body-rol, opgeschaald. */
  title: {
    fontSize: 19,
    fontWeight: '500',
  },
  series: {
    fontSize: 15,
    fontWeight: '400',
    marginTop: 3,
  },
  /* Operator, 26 september 2026 ("kleine player moet ook nieuwe
     accentkleur"): was nog ROYAL_INDIGO (navy), gemist in de eerdere
     Bio-Teal-sweep omdat dit een lokale const was, geen theme-import. */
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AudioAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
