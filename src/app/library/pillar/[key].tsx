/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — /library/pillar/[key] — Gefocust pijler-scherm

   Operator, 25 september 2026 ("bij aantikken van een kaart de volledige
   pillar reeks als enige op pagina, hypermodern afspeelbare audio library,
   zo kan bezoeker echt focussen... nu zeggen de pillar kaarten ook niets
   wat is pillar"): een pijler-kaart op de hoofdtab filtert tot nu toe enkel
   inline binnen dezelfde drukke pagina (carrousel, banners, aankoopblok
   blijven allemaal zichtbaar). Dit scherm is het Apple-eigen alternatief —
   zelfde patroon als App Store-categorieën/Music "See All": tik = eigen,
   gefocust scherm, niks anders.

   Operator, 25 september 2026, tweede ronde ("de library ui is heel
   amateuristisch, hoe zou Apple dat modern doen"): eerste versie was een
   edge-to-edge foto-banner met tekst erop + losse ronde play-knopjes per
   rij — leest als een generieke marketing-banner, niet als een Music/
   Podcasts-scherm. Herbouwd naar Apple Music's ECHTE playlist/album-
   patroon: los, ingekaderd kunstwerk (geen banner), titel gewoon ONDER het
   kunstwerk in platte paginategekst (geen wit-op-foto), een prominente
   ▷ Play-knop, en een GENUMMERDE tracklijst i.p.v. losse play-cirkels.

   Altijd DARK — operator-beslissing 25 september 2026, zelfde afspraak als
   goal.tsx/build-choice.tsx/build-your-day.tsx/plan-review.tsx: gefocuste,
   immersieve één-taak-schermen blijven dark ongeacht het app-brede thema.

   Bron van waarheid voor pijler-data: `data/audio-library-data.ts`
   (PILLAR_META, seriesForPillar, SERIES_PILLAR) — dezelfde data die
   (tabs)/index.tsx al gebruikt.
   ─────────────────────────────────────────────────────────────────────── */

import { MiniPlayer, MINI_PLAYER_HEIGHT } from '@/components/MiniPlayer';
import { usePlayerState } from '@/services/audio-player';
import {
  PILLAR_META,
  SERIES_SUBTITLE,
  SESSIONS,
  seriesForPillar,
  type Pillar,
  type Session,
} from '@/data/audio-library-data';
import { AudioAccent, BrandFonts } from '@/constants/theme';
import { getEffectiveTier, resolveAccess, tierBadgeLabel } from '@/utils/access-tier';
import { useSubscription } from '@/hooks/useSubscription';
import { getToken } from '@/services/auth';
import { useGatedOpenSession } from '@/utils/openSession';
import { BlurView } from 'expo-blur';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Lock, Play } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* Altijd dark — zie toelichting bovenaan.
   Operator, 26 september 2026 (Huisstijl v4.4): Signal Blue (#3a8fff) is
   nooit een CTA — donkere ondergrond → witte knop, donkere tekst. */
const C = {
  bg: '#0a0a0a',
  card: '#141414',
  text: '#f4f4f4',
  dim: '#8a8a8a',
  border: '#2a2a2a',
  ctaBg: '#ffffff',
  ctaText: '#0a0a0a',
};
const ART_SIZE = 152;

/* Genummerde tracklijst-rij — Apple Music/Podcasts-patroon: volgnummer
   links (geen los play-icoontje per rij, de hele rij is de tap-target),
   titel + korte omschrijving. Geen thumbnail per rij — het kunstwerk
   bovenaan draagt het beeld voor de hele pijler, exact zoals een Music-
   tracklijst ook geen album-art per track herhaalt.

   Operator, 25 september 2026 ("stop met titels afkappen, drie
   verschillende badge-stijlen is visuele ruis"): twee harde, correcte
   Apple-regels — 1) een titel breekt naar een tweede regel i.p.v. af te
   knippen met "...", 2) gratis content krijgt GEEN badge (dat is de
   standaard — een badge is enkel nodig om een UITZONDERING te melden),
   vergrendelde content krijgt enkel een subtiel, kleurloos slot-icoontje,
   geen gekleurde pil met tekst erbij. */
function TrackRow({
  session,
  index,
  onPress,
  isLast,
  locked,
}: {
  session: Session;
  index: number;
  onPress: () => void;
  isLast: boolean;
  /* Operator, 7 okt 2026: slotje enkel als DEZE gebruiker de sessie niet
     mag openen — voorheen hing het alleen af van het soort sessie, dus
     zag ook een Premium-gebruiker overal "Pro"-slotjes. */
  locked: boolean;
}) {
  const tier = getEffectiveTier(session);
  /* Operator, 26 september 2026 ("is dat duidelijk voor de gebruiker?"):
     een kaal slotje voor ELKE vergrendelde sessie verbergt een écht
     verschil — 'account' vraagt enkel een gratis account, 'pro' vraagt
     een abonnement. Zonder onderscheid lijkt alles betaald, en dat
     ontmoedigt onnodig. Terug een label, maar dan de rustige variant:
     klein, grijs, geen gekleurde pil/rand — zelfde taal als de "PILLAR
     01"-eyebrow elders op dit scherm, niet de vorige luide gekleurde
     badges. */
  /* Operator, 26 september 2026 ("moet dat niet Free with account
     staan?"): geen eigen bewoording verzinnen — hergebruik `tierBadgeLabel`
     (access-tier.ts), dezelfde vaste tekst die de rest van de app al
     gebruikt ("FREE WITH ACCOUNT" / "PRO"), hier enkel met normale
     hoofdletters i.p.v. ALL CAPS omdat dit label te klein is voor
     letter-spaced kapitalen. */
  const lockLabelRaw = tierBadgeLabel(tier);
  const lockLabel = lockLabelRaw
    ? lockLabelRaw.charAt(0) + lockLabelRaw.slice(1).toLowerCase()
    : null;
  return (
    /* Operator, 26 september 2026 ("5de keer zelfde crash-probleem, fix
       dat nu"): entering-animatie + de scroll-gekoppelde header-animatie
       (zie onder) samen op één scherm bleken de trigger voor een
       Reanimated-reëntrantiecrash ("Should not already be working") zodra
       je tijdens/na die animaties een sessie opende. Geen animaties meer
       hier — stabiliteit boven polish. Gewone, statische rij. */
    <Pressable
      onPress={onPress}
      style={s.row}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
    >
      {/* Operator, 26 september 2026 ("de nummering is niet mooi, play
         buttons in de plaats"): terugdraai van de 25-september-keuze
         (genummerde tracklijst, Apple Music-patroon) — nu een klein
         play-icoon per rij i.p.v. "01/02". `pointerEvents="none"`: de
         hele rij is al de Pressable, dit is puur visueel affordance. */}
      <View style={s.rowPlayGlyph} pointerEvents="none">
        <Play size={12} color={C.text} fill={C.text} strokeWidth={0} style={{ marginLeft: 1.5 }} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={2}>
          {session.title}
        </Text>
        {/* Operator, 25 september 2026 ("beschrijvingen breken af met
           '...', gebruiker mist de context"): `numberOfLines={1}` knipte
           bijna elke omschrijving af. Apple geeft leesbaarheid altijd
           voorrang boven een vaste rijhoogte — 2 regels, geen afkap. */}
        <Text style={s.rowDesc} numberOfLines={2}>
          {session.desc}
        </Text>
      </View>
      {locked ? (
        <View style={s.rowLock}>
          <Lock size={14} color={C.dim} strokeWidth={2} />
          <Text style={s.rowLockLabel}>{lockLabel}</Text>
        </View>
      ) : null}
      {!isLast && <View style={s.rowSep} pointerEvents="none" />}
    </Pressable>
  );
}

export default function PillarFocusScreen() {
  const { key, play } = useLocalSearchParams<{ key: string; play?: string }>();
  const pillar = key as Pillar;
  const meta = PILLAR_META[pillar];
  const openGated = useGatedOpenSession();
  /* Zelfde toegangsregel als het openen zelf (resolveAccess). */
  const { isPro, isTrialing } = useSubscription();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void getToken().then((t) => {
      if (!cancelled) setSignedIn(!!t);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const playerState = usePlayerState();

  /* Series binnen deze pijler, elk met z'n sessies — zelfde bron als de
     hoofdbibliotheek (`seriesForPillar` + `SESSIONS`-filter per naam), hier
     plat gegroepeerd i.p.v. losse expand/collapse-kaarten. */
  const groups = useMemo(() => {
    if (!pillar || !PILLAR_META[pillar]) return [];
    return seriesForPillar(pillar)
      .map((seriesName) => ({
        name: seriesName,
        sessions: SESSIONS.filter((sess) => sess.series === seriesName),
      }))
      .filter((g) => g.sessions.length > 0);
  }, [pillar]);

  const totalCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.sessions.length, 0),
    [groups],
  );
  const firstSession = groups[0]?.sessions[0];

  /* Operator ("de sessie moet gelinkt worden naar de audio in de nieuwe
     kaart"): een tap op een sessie elders in de app (bv. Free Picks op de
     Audio-tab) kan hierheen linken via `?play=<url>` — start die ene
     sessie zodra de pijler-data klaar is. `hasTriggered`-ref: enkel bij
     de eerste render van deze param, niet bij elke re-render/herlaad. */
  const hasTriggeredPlay = useRef(false);
  useEffect(() => {
    if (!play || hasTriggeredPlay.current || groups.length === 0) return;
    hasTriggeredPlay.current = true;
    const target = groups
      .flatMap((g) => g.sessions)
      .find((sess) => sess.url === play);
    if (target) openGated(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, groups]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    /* Operator ("bij back moet ik naar de audio library gaan niet naar
       welcome pagina"): expliciet naar de tabs-group i.p.v. het
       dubbelzinnige '/' — zelfde patroon als about.tsx. */
    else router.dismissTo('/' as never);
  };

  /* Onbekende/foute key (bv. een verlopen deeplink) — geen crash op een
     undefined meta-object, gewoon terug. */
  if (!meta) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.topbar}>
          <Pressable onPress={goBack} hitSlop={14} style={s.backBtn}>
            {/* Operator, 1 okt 2026 ("headers overal consistent"): size
               24→20, stroke 2.4→2.8 — de "officiële iOS-chevron.backward"-
               stijl uit build-choice.tsx (18 sept), nu de app-brede
               standaard. */}
            <ChevronLeft size={20} color="#ffffff" strokeWidth={2.8} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.topbar}>
        <Pressable onPress={goBack} hitSlop={14} style={s.backBtn}>
          <ChevronLeft size={20} color="#ffffff" strokeWidth={2.8} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          playerState.session && { paddingBottom: MINI_PLAYER_HEIGHT + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── KUNSTWERK — los, ingekaderd vlak (geen edge-to-edge banner),
           gecentreerd, met schaduw — Apple Music/Podcasts-showpagina, geen
           marketing-hero. */}
        <View style={s.artWrap}>
          {meta.img ? (
            /* Operator ("ik vraag letterlijk om de fotos mooi te laten
               passen in de cards" — de vorige 'contain'-noodgreep liet
               lege letterbox-randen zien): het kader krijgt nu de ECHTE
               beeldverhouding van de foto (`imgAspect`, audio-library-
               data.ts) i.p.v. een vast vierkant, dus `cover` toont de
               hele foto zonder crop of lege rand. Geen `imgAspect` (bv.
               een ontbrekende foto) → terugval op het oude vierkant. */
            <Image
              source={{ uri: meta.img }}
              style={[
                s.art,
                meta.imgAspect
                  ? { width: ART_SIZE, height: ART_SIZE / meta.imgAspect }
                  : null,
              ]}
              resizeMode="cover"
            />
          ) : (
            <View style={[s.art, { backgroundColor: C.card }]} />
          )}
        </View>

        {/* ── TITELBLOK — onder het kunstwerk, platte paginategekst (geen
           wit-op-foto meer). Beantwoordt "wat IS een pillar": naam +
           tagline, uitgesproken, leesbaar tegen de gewone achtergrond. */}
        <View style={s.titleBlock}>
          <Text style={s.eyebrow}>{`PILLAR ${meta.num}`}</Text>
          <Text style={s.title}>{meta.name}</Text>
          <Text style={s.tagline}>{meta.tagline}</Text>
          {/* Operator, 26 september 2026 ("series eerst, en duidelijker
             benoemd"): volgorde omgedraaid (Topics vóór Sessions) en
             "series" (intern jargon) vervangen door "Topics" — duidelijker
             voor de gebruiker, past bij elke pijler. */}
          <Text style={s.meta}>
            {groups.length} {groups.length === 1 ? 'Topic' : 'Topics'} ·{' '}
            {totalCount} {totalCount === 1 ? 'Session' : 'Sessions'}
          </Text>
        </View>

        {/* Operator, 26 september 2026 ("play-knop moet niet actief zijn
           maar decoratief — nu speelt dat enkel eerste audio af"): had
           tot nu toe verwarrend gedrag (leek een "play deze pijler"-actie,
           maar startte gewoon altijd sessie 1). Geen Pressable/onPress
           meer — puur visueel label, de sessie-rijen eronder zijn de
           enige echte play-affordance. */}
        {firstSession ? (
          <View style={s.playBtn}>
            <Play size={15} color={C.ctaText} fill={C.ctaText} strokeWidth={0} />
            <Text style={s.playBtnText}>Play</Text>
          </View>
        ) : null}

        {/* ── TRACKLIJST — per serie gegroepeerd onder een subtiel,
           ALL-CAPS sectielabel (Apple's eigen "Disc 1/Disc 2"-taal),
           genummerde rijen eronder, geen expand/collapse: dit scherm
           bestaat juist om alles in één keer te tonen. */}
        {groups.map((group) => (
          <View key={group.name} style={s.group}>
            {/* Operator ("ik mis inspired by / VIBEZCORE Original Series
               in de library, lijkt mij wel belangrijk"): stond al in de
               player (zie series/subtitle daar) maar ontbrak hier op het
               pillar-scherm — de reeks-herkomst (welke denker 'm
               inspireerde, of "VIBEZCORE Original Series" voor een eigen
               reeks) is nu ook zichtbaar vlak boven de reeksnaam zelf. */}
            {SERIES_SUBTITLE[group.name] ? (
              <Text style={s.groupSubtitle}>{SERIES_SUBTITLE[group.name]}</Text>
            ) : null}
            <Text style={s.groupLabel}>{group.name}</Text>
            <BlurView intensity={40} tint="dark" style={s.listCard}>
              {group.sessions.map((sess, i) => (
                <TrackRow
                  key={sess.url}
                  session={sess}
                  index={i}
                  onPress={() => openGated(sess)}
                  isLast={i === group.sessions.length - 1}
                  locked={resolveAccess(sess, signedIn, isPro, isTrialing) !== 'allowed'}
                />
              ))}
            </BlurView>
          </View>
        ))}
      </ScrollView>
      <MiniPlayer standalone />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 56, paddingTop: 4 },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },

  artWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  art: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  titleBlock: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 20,
  },
  eyebrow: {
    color: C.dim,
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  title: {
    color: '#ffffff',
    fontFamily: BrandFonts.bold,
    fontSize: 26,
    letterSpacing: -0.4,
    lineHeight: 30,
    textAlign: 'center',
  },
  tagline: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    marginTop: 6,
    lineHeight: 20,
    textAlign: 'center',
  },
  meta: {
    color: C.dim,
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    marginTop: 10,
  },

  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: C.ctaBg,
  },
  playBtnText: {
    color: C.ctaText,
    fontFamily: BrandFonts.bold,
    fontSize: 15,
  },

  group: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  /* Subtiel, ALL-CAPS sectielabel i.p.v. de vorige grote bold H2 — Apple's
     eigen "Disc 1"-taal binnen een tracklijst: informatief, geen tweede
     zware kop die met de paginatitel concurreert. */
  /* Herkomst-eyebrow ("CARL JUNG INSPIRED SERIES" / "VIBEZCORE ORIGINAL
     SERIES") — kleiner en gedimder dan groupLabel eronder, zodat de
     hiërarchie duidelijk blijft: dit is de context, de reeksnaam
     eronder is het echte label. Data staat al in hoofdletters
     (SERIES_SUBTITLE), dus geen textTransform nodig. */
  groupSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 1.1,
    marginBottom: 3,
    marginLeft: 4,
  },
  groupLabel: {
    color: C.dim,
    fontFamily: BrandFonts.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  /* Operator, 26 september 2026 ("kunnen de kaarten transparant blur
     effect"): was een opake `#141414`-vlak, nu een echte BlurView
     (expo-blur) — zelfde "glas"-taal als de pricing-kaarten. */
  listCard: {
    borderRadius: 14,
    borderWidth: 1,
    /* Operator, 26 september 2026 ("lijnen rondom mogen duidelijker"):
       0.08 → 0.18. */
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowSep: {
    position: 'absolute',
    left: 16,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },
  /* Slotje + rustig label ("Account"/"Pro") — geen gekleurde pil/rand,
     zelfde ingetogen taal als de "PILLAR 01"-eyebrow bovenaan het scherm. */
  rowLock: {
    alignItems: 'center',
    gap: 2,
  },
  rowLockLabel: {
    color: C.dim,
    fontFamily: BrandFonts.medium,
    fontSize: 9,
    letterSpacing: 0.3,
  },
  /* Operator, 26 september 2026: vervangt `rowIndex` (genummerde
     tracklijst) — klein play-icoon in een subtiel omkaderd cirkeltje,
     zelfde breedte (20+marge) zodat de rij-uitlijning niet verschuift. */
  rowPlayGlyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: {
    color: C.text,
    fontFamily: BrandFonts.medium,
    fontSize: 15,
  },
  rowDesc: {
    color: C.dim,
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    marginTop: 2,
  },
});
