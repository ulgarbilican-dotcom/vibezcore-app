/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Audio Library (route /)

   ÉÉN doorlopende scrollpagina, conform BLAUWDRUK §3:
     HERO → 4-FASEN → BUILT ON + 4 PIJLERS → EMERSON → "EXPLORE SERIES"-header
       → DE LIBRARY (serie-kaarten, openklappen ter plekke, sessies, FREE/PRO)
       → SOUNDSCAPES (4 subcat-kaarten, standaard INGEKLAPT, blauwdruk §3.5b)
     [Aankoopblok komt in een latere deelstap — NU NOG NIET op deze pagina.]

   Bron voor het merk-/landing-deel: webapp index_2_correct.html (regels
   2682-2755). Bron voor de library-kaart + sessielijst + Soundscapes-subcat
   structuur: de bestaande library.tsx (overgenomen, niet opnieuw bedacht).
   ─────────────────────────────────────────────────────────────────────────── */

import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SERIES,
  SERIES_PHOTO,
  SERIES_SUB,
  SERIES_SUBTITLE,
  SUBCAT_INFO,
  SUBCAT_ORDER,
  type Session,
} from '../../data/audio-library-data';

/* Merkkleuren — consistent met de rest van de app (Brand.bg #0a0a0a). */
const C = {
  bg: '#0a0a0a',
  text: '#ffffff',
  dim: 'rgba(255,255,255,0.5)',
  faint: 'rgba(255,255,255,0.32)',
  accent: '#3a8fff',
  arrow: 'rgba(58,143,255,0.7)',
  border: '#1a1a1a',
  free: '#4ade80',
  rowBg: '#0d0d0d',
};

/* CDN — exact de host die de webapp gebruikt. */
const CDN = 'https://vibezcore-audio.b-cdn.net/images';

/* Pijlers — exact uit bron regel 2705-2738. Namen NIET wijzigen. */
const PILLARS = [
  { num: '01', name: 'Strategic Wealth',         img: `${CDN}/Strategic%20wealth.jpg` },
  { num: '02', name: 'Psychological Resilience',  img: `${CDN}/Psychological%20Resilience%20correct.jpg` },
  { num: '03', name: 'Social Mastery',            img: `${CDN}/Social%20mastery.jpg` },
  { num: '04', name: 'Stoic Fortitude',           img: `${CDN}/Stoic%20mastery.jpg` },
];

/* Provider-abstractie placeholder — identiek aan library.tsx.
   [OPERATOR] later vervangen door echte Gumroad/Supabase-status. */
function useSubscription(): boolean {
  return false;
}

/* Speel-navigatie naar de player. Param-shape identiek aan library.tsx,
   zodat de player onveranderd blijft. */
function openSession(sess: Session) {
  router.push({
    pathname: '/player',
    params: {
      title: sess.title,
      series: sess.series,
      url: sess.url,
      free: sess.free ? 'true' : 'false',
      desc: sess.desc,
    },
  });
}

/* SessionRow — sessierij in geopende kaart of geopende Soundscapes-subcat.
   Visueel 1:1 overgenomen uit library.tsx (s.row + omringende styles). */
function SessionRow({
  session,
  photo,
  canPlay,
  onPress,
}: {
  session: Session;
  photo: string;
  canPlay: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[s.libRow, !canPlay && s.libRowLocked]} onPress={onPress}>
      <View style={s.libRowArt}>
        {photo ? <Image source={{ uri: photo }} style={s.libRowArtImg} /> : null}
        <View style={s.libRowPlay}>
          <Text style={s.libRowPlayGlyph}>{canPlay ? '▶' : '🔒'}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            s.libRowTag,
            session.free ? s.libRowTagFree : s.libRowTagPro,
          ]}
        >
          {session.free ? 'FREE' : 'PRO'}
        </Text>
        <Text style={s.libRowTitle}>{session.title}</Text>
        {session.desc ? <Text style={s.libRowDesc}>{session.desc}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function AudioScreen() {
  const hasSub = useSubscription();
  /* Inline expand-/collapse-state per serie. Standaard = INGEKLAPT
     (blauwdruk §3.5). Aparte state voor Soundscapes-subcategorieën,
     elk eveneens standaard INGEKLAPT (blauwdruk §3.5b). */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subExpanded, setSubExpanded] = useState<Record<string, boolean>>({});
  const toggle = (name: string) =>
    setExpanded((p) => ({ ...p, [name]: !p[name] }));
  const toggleSub = (name: string) =>
    setSubExpanded((p) => ({ ...p, [name]: !p[name] }));

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── HERO ── bron regel 2682-2690 ── */}
        <View style={s.hero}>
          <Image
            source={{ uri: `${CDN}/audio-library.png` }}
            style={s.heroImg}
            resizeMode="cover"
          />
          {/* .hero-grad: zwart onder → transparant boven, voor leesbaarheid */}
          <View style={s.heroGrad} />
          <View style={s.heroText}>
            <Text style={s.heroEyebrow}>VIBEZCORE Audio Library</Text>
            <Text style={s.heroH1}>Where Insight{'\n'}Becomes Identity.</Text>
          </View>
        </View>

        {/* ── 4-FASENREGEL ── bron regel 2691-2693 ── */}
        <View style={s.phasesWrap}>
          <Text style={s.phases}>
            Understanding
            <Text style={s.phasesArrow}>{'  →  '}</Text>
            Awareness
            <Text style={s.phasesArrow}>{'  →  '}</Text>
            Regulation
            <Text style={s.phasesArrow}>{'  →  '}</Text>
            Integration
          </Text>
        </View>

        {/* ── BUILT ON ── bron regel 2701-2704 ── */}
        <View style={s.builtOn}>
          <Text style={s.builtOnLabel}>BUILT ON</Text>
          <Text style={s.builtOnText}>
            The intellectual legacy of history's greatest minds.
          </Text>
        </View>

        {/* ── 4 PIJLERS ── bron regel 2705-2738 ── */}
        <View style={s.pillarsGrid}>
          {PILLARS.map((p) => (
            <View key={p.num} style={s.pillar}>
              <Image source={{ uri: p.img }} style={s.pillarImg} resizeMode="cover" />
              <View style={s.pillarOverlay} />
              <View style={s.pillarTextWrap}>
                <Text style={s.pillarNum}>{p.num}</Text>
                <Text style={s.pillarName}>{p.name}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── EMERSON-QUOTE ── bron regel 2742-2755 ── */}
        <View style={s.quoteBlock}>
          <Image
            source={{ uri: `${CDN}/ralph-waldo-emerson.png` }}
            style={s.quoteAvatar}
            resizeMode="cover"
          />
          <View style={s.quoteContent}>
            <Text style={s.quoteText}>
              "The only person you are destined to become is the person you
              decide to be."
            </Text>
            <Text style={s.quoteAuthor}>— Ralph Waldo Emerson</Text>
          </View>
        </View>

        {/* ── EXPLORE SERIES — header-blok (bron: webapp "Explore Series") ── */}
        <View style={s.exploreHead}>
          <Text style={s.exploreEyebrow}>— EXPLORE SERIES</Text>
          <Text style={s.exploreH1}>Not just inspiration.</Text>
          <Text style={s.exploreH1}>Real transformation.</Text>
          <View style={s.exploreMetaRow}>
            <Text style={s.exploreMetaIcon}>📅</Text>
            <Text style={s.exploreMetaText}>
              Updated monthly with fresh sessions
            </Text>
          </View>
        </View>

        {/* ── DE LIBRARY — serie-kaarten als bibliotheek (blauwdruk §3.5) ──
            Eén unit per serie: cinematic kaart (foto + eyebrow + titel + sub)
            met chevron rechtsboven; tap = expand inline, chevron roteert.
            Onder de kaart altijd zichtbaar: groene FREE-strip(s) — één per
            gratis sessie (1:1 uit library.tsx). Inline expansie = sessierijen.
            Soundscapes opent naar 4 subcat-kaarten (blauwdruk §3.5b),
            elk standaard ingeklapt. */}
        <View style={s.libList}>
          {SERIES.map((ser) => {
            const photo = SERIES_PHOTO[ser.name];
            const eyebrow = SERIES_SUBTITLE[ser.name];
            const subline = SERIES_SUB[ser.name];
            const frees = ser.sessions.filter((x) => x.free);
            const isOpen = !!expanded[ser.name];
            const isSoundscapes = ser.name === 'Soundscapes';
            return (
              <View key={ser.name} style={s.libCardUnit}>
                <Pressable
                  style={s.libCard}
                  onPress={() => toggle(ser.name)}
                  android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={s.libCardBg} />
                  ) : null}
                  <View style={s.libCardGrad} />
                  <View style={s.libCardChev}>
                    <Text
                      style={[
                        s.libCardChevTxt,
                        isOpen && s.libCardChevTxtOpen,
                      ]}
                    >
                      ›
                    </Text>
                  </View>
                  <View style={s.libCardBody}>
                    {eyebrow ? (
                      <Text style={s.libCardEyebrow}>{eyebrow}</Text>
                    ) : null}
                    <Text style={s.libCardTitle}>{ser.name}</Text>
                    {subline ? (
                      <Text style={s.libCardSubline}>{subline}</Text>
                    ) : null}
                  </View>
                </Pressable>

                {/* Groene FREE-strip(s) onder de kaart — altijd zichtbaar.
                   Eén per gratis sessie, exact zoals library.tsx. */}
                {frees.map((sess) => (
                  <Pressable
                    key={sess.url}
                    style={s.libFreeRow}
                    onPress={() => openSession(sess)}
                    android_ripple={{ color: 'rgba(74,222,128,0.18)' }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.libFreeTag}>FREE</Text>
                      <Text style={s.libFreeTitle}>{sess.title}</Text>
                      {sess.desc ? (
                        <Text style={s.libFreeDesc}>{sess.desc}</Text>
                      ) : null}
                    </View>
                    <Text style={s.libFreePlay}>▶</Text>
                  </Pressable>
                ))}

                {/* Inline expansie — non-Soundscapes: alle sessierijen. */}
                {isOpen && !isSoundscapes && (
                  <View style={s.libExpand}>
                    {ser.sessions.map((sess) => (
                      <SessionRow
                        key={sess.url}
                        session={sess}
                        photo={photo}
                        canPlay={sess.free || hasSub}
                        onPress={() => openSession(sess)}
                      />
                    ))}
                  </View>
                )}

                {/* Inline expansie — Soundscapes: 4 subcat-kaarten, ingeklapt. */}
                {isOpen && isSoundscapes && (
                  <View style={s.libExpand}>
                    {SUBCAT_ORDER.map((subName) => {
                      const info = SUBCAT_INFO[subName];
                      if (!info) return null;
                      const subSessions = ser.sessions.filter(
                        (x) => x.subseries === subName,
                      );
                      if (subSessions.length === 0) return null;
                      const subOpen = !!subExpanded[subName];
                      return (
                        <View key={subName} style={s.libSubcatUnit}>
                          <Pressable
                            style={s.libSubcatCard}
                            onPress={() => toggleSub(subName)}
                            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
                          >
                            <Image
                              source={{ uri: info.photo }}
                              style={s.libSubcatBg}
                            />
                            <View style={s.libSubcatGrad} />
                            <View style={s.libCardChev}>
                              <Text
                                style={[
                                  s.libCardChevTxt,
                                  subOpen && s.libCardChevTxtOpen,
                                ]}
                              >
                                ›
                              </Text>
                            </View>
                            <View style={s.libSubcatBody}>
                              <Text style={s.libSubcatEyebrow}>
                                {info.eyebrow}
                              </Text>
                              <Text style={s.libSubcatTitle}>{subName}</Text>
                            </View>
                          </Pressable>
                          {subOpen &&
                            subSessions.map((sess) => (
                              <SessionRow
                                key={sess.url}
                                session={sess}
                                photo={info.photo}
                                canPlay={sess.free || hasSub}
                                onPress={() => openSession(sess)}
                              />
                            ))}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* [Aankoopblok — blauwdruk §3.6 — komt in een latere deelstap.] */}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 56 },

  /* HERO — bron .hero / .hero-img / .hero-grad / .hero-text */
  hero: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
    height: 340,                 // bron: height 55vh, min 280, max 380
  },
  heroImg: { width: '100%', height: '100%' },
  heroGrad: {
    ...StyleSheet.absoluteFillObject,
    // bron .hero-grad: linear-gradient to top, #0a0a0a → transparant.
    // RN heeft geen native gradient; donkere onderlaag = zelfde leesbaarheid.
    backgroundColor: 'transparent',
  },
  heroText: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20 },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,            // bron: .2em
    textTransform: 'uppercase',
    color: C.accent,
    marginBottom: 8,
  },
  heroH1: {
    fontSize: 28,                // bron: .hero-h1 28px
    fontWeight: '800',
    color: C.text,
    lineHeight: 31,
    letterSpacing: -0.8,
  },

  /* 4-FASEN — bron .hero-phases */
  phasesWrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  phases: {
    color: C.dim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  phasesArrow: { color: C.arrow, fontWeight: '400' },

  /* BUILT ON — bron .vzm-pillars-intro */
  builtOn: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 14 },
  builtOnLabel: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  builtOnText: {
    color: C.text,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    letterSpacing: -0.5,
  },

  /* PIJLERS — bron .vzm-pillars-grid / .vzm-pillar-photo */
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  pillar: {
    width: '48%',
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: C.border,
  },
  pillarImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  pillarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  pillarTextWrap: { position: 'absolute', left: 14, bottom: 14 },
  pillarNum: {
    color: C.faint,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  pillarName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  /* EMERSON — bron .vzm-emerson-block (compact horizontale card). */
  quoteBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: C.border,
  },
  quoteAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
    backgroundColor: '#000',
  },
  quoteContent: { flex: 1 },
  quoteText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 6,
  },
  quoteAuthor: { color: C.dim, fontSize: 12 },

  /* EXPLORE SERIES — header-blok */
  exploreHead: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 6,
  },
  exploreEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  exploreH1: {
    color: C.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 31,
    letterSpacing: -0.6,
  },
  exploreMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  exploreMetaIcon: {
    fontSize: 13,
    marginRight: 8,
  },
  exploreMetaText: {
    color: C.dim,
    fontSize: 12,
    fontWeight: '600',
  },

  /* ── LIBRARY-kaarten (overgenomen uit library.tsx) ── */
  libList: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  libCardUnit: { marginBottom: 22 },
  libCard: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: C.border,
    justifyContent: 'flex-end',
  },
  libCardBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  libCardGrad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  /* Chevron rechtsboven — roteert 90° wanneer kaart open is. */
  libCardChev: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  libCardChevTxt: {
    color: C.text,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: -2,
  },
  libCardChevTxtOpen: { transform: [{ rotate: '90deg' }] },
  libCardBody: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingRight: 56, // ruimte voor chevron, voorkomt overlap met titel
  },
  libCardEyebrow: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  libCardTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  libCardSubline: {
    color: C.text,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    opacity: 0.85,
  },

  /* Groene FREE-strip onder de kaart — één per gratis sessie. */
  libFreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.18)',
  },
  libFreeTag: {
    color: C.free,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  libFreeTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  libFreeDesc: { color: C.dim, fontSize: 12, lineHeight: 17, marginTop: 3 },
  libFreePlay: { color: C.free, fontSize: 20, fontWeight: '700', marginLeft: 12 },

  /* Inline-expansie-container (gewone sessierijen of subcat-kaarten). */
  libExpand: { marginTop: 10 },

  /* Sessierij in geopende kaart of geopende subcat. */
  libRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.rowBg,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  libRowLocked: { opacity: 0.65 },
  libRowArt: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: C.border,
  },
  libRowArtImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  libRowPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  libRowPlayGlyph: { color: '#fff', fontSize: 16 },
  libRowTag: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 3 },
  libRowTagFree: { color: C.free },
  libRowTagPro: { color: C.faint },
  libRowTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  libRowDesc: { color: C.dim, fontSize: 12, marginTop: 3, lineHeight: 17 },

  /* Soundscapes subcat-kaart — eigen foto + eyebrow + naam, ingeklapt. */
  libSubcatUnit: { marginBottom: 12 },
  libSubcatCard: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: C.border,
    justifyContent: 'flex-end',
  },
  libSubcatBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  libSubcatGrad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  libSubcatBody: { paddingHorizontal: 14, paddingBottom: 14, paddingRight: 56 },
  libSubcatEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  libSubcatTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
