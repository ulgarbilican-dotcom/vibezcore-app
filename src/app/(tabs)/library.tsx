/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Audio bibliotheek

   Nagebouwd naar wat de GEBRUIKER ECHT ZIET in de webapp — de output van
   buildLibrary() / renderSessionRow() in index_2_correct.html (regels
   6877 e.v. en 7202 e.v.), NIET de verborgen legacy-HTML.

   Wat de gebruiker ziet, 1:1:
     1. Per serie een CINEMATIC kaart: grote foto-achtergrond, serietitel,
        ondertitel (bv. "Andrew Huberman inspired"), onderaan meta:
          - geen abo : "X free sessions" (groen)  OF  "PRO series"
          - wel abo  : geen meta (alles ontgrendeld)
     2. Tik op kaart → detailpaneel met de sessierijen van die serie.
     3. Sessierij: kleine foto + play-driehoek, tag (FREE/PRO), titel,
        beschrijving. Vergrendelde (premium, geen abo) rijen gedimd.

   Soundscapes is bijzonder (BLAUWDRUK §6): NIET één lijst met dezelfde
   serie-foto. Het heeft 4 subcategorieën (SUBCAT_INFO/SUBCAT_ORDER) met
   elk een EIGEN foto + eyebrow. Sessies → subcat via `session.subseries`.
   Volgorde: Calm Clarity → Rest & Reset → Zen Flow → Harmonic.

   GEEN preview. Gratis speelt volledig (player.tsx); premium zonder abo →
   player.tsx toont upgrade-scherm.

   Data: src/data/audio-library-data.ts.
   ─────────────────────────────────────────────────────────────────────────── */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  SERIES,
  SERIES_PHOTO,
  SERIES_SUB,
  SERIES_SUBTITLE,
  SUBCAT_INFO,
  SUBCAT_ORDER,
  type Session,
} from '../../data/audio-library-data';

const C = {
  bg: '#0a0a0a',
  text: '#ffffff',
  dim: 'rgba(255,255,255,0.5)',
  faint: 'rgba(255,255,255,0.32)',
  accent: '#3a8fff',
  free: '#4ade80',
  border: '#1a1a1a',
  rowBg: '#0d0d0d',
};

function useSubscription(): boolean {
  // [OPERATOR] — echte Gumroad-status hier. Webapp: hasSubscription===true.
  return false;
}

/* Detail-rij-types: een gewone sessie OF een subcat-header (alleen
   Soundscapes). Door alles in één FlatList te gieten blijft scrollen
   soepel en hoeven we geen aparte SectionList in te voeren. */
type DetailRow =
  | { kind: 'session'; session: Session; rowPhoto: string }
  | { kind: 'subhead'; subcat: string; photo: string; eyebrow: string };

function buildDetailRows(seriesName: string, sessions: Session[]): DetailRow[] {
  if (seriesName !== 'Soundscapes') {
    const photo = SERIES_PHOTO[seriesName] ?? '';
    return sessions.map((session) => ({ kind: 'session', session, rowPhoto: photo }));
  }
  // Soundscapes: groepen in SUBCAT_ORDER met eigen foto + eyebrow.
  const rows: DetailRow[] = [];
  for (const subcat of SUBCAT_ORDER) {
    const info = SUBCAT_INFO[subcat];
    if (!info) continue;
    const inSub = sessions.filter((s) => s.subseries === subcat);
    if (inSub.length === 0) continue;
    rows.push({ kind: 'subhead', subcat, photo: info.photo, eyebrow: info.eyebrow });
    for (const session of inSub) {
      rows.push({ kind: 'session', session, rowPhoto: info.photo });
    }
  }
  return rows;
}

export default function LibraryScreen() {
  const router = useRouter();
  const hasSub = useSubscription();
  const [detail, setDetail] = useState<string | null>(null);

  /* Deep-link vanaf de Audio-tab: ?series=<naam>&_t=<nonce>.
     `_t` zorgt dat de useEffect ook bij hertik van dezelfde kaart re-fires
     (anders blijven params.series gelijk en mist React de update).
     Geen visuele wijziging; alleen state-trigger naar de bestaande detail. */
  const params = useLocalSearchParams<{ series?: string; _t?: string }>();
  const seriesParam = typeof params.series === 'string' ? params.series : null;
  const tParam = typeof params._t === 'string' ? params._t : null;
  useEffect(() => {
    if (seriesParam && SERIES.some((x) => x.name === seriesParam)) {
      setDetail(seriesParam);
    }
  }, [seriesParam, tParam]);

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

  // ── DETAILPANEEL: sessierijen van één serie ──
  if (detail) {
    const ser = SERIES.find((x) => x.name === detail);
    if (!ser) {
      setDetail(null);
      return null;
    }
    const headerPhoto = SERIES_PHOTO[ser.name];
    const sub = SERIES_SUBTITLE[ser.name];
    const rows = buildDetailRows(ser.name, ser.sessions);

    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <Pressable
          style={s.back}
          onPress={() => setDetail(null)}
          hitSlop={14}
        >
          <Text style={s.backTxt}>‹ Library</Text>
        </Pressable>
        <FlatList
          data={rows}
          keyExtractor={(item) =>
            item.kind === 'subhead' ? `sub:${item.subcat}` : `s:${item.session.url}`
          }
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.detailHead}>
              {headerPhoto ? (
                <Image source={{ uri: headerPhoto }} style={s.detailImg} />
              ) : null}
              <View style={s.detailGrad} />
              <View style={s.detailHeadText}>
                <Text style={s.detailTitle}>{ser.name}</Text>
                {sub ? <Text style={s.detailSub}>{sub}</Text> : null}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === 'subhead') {
              return (
                <View style={s.subHead}>
                  <Image source={{ uri: item.photo }} style={s.subHeadImg} />
                  <View style={s.subHeadGrad} />
                  <View style={s.subHeadTextWrap}>
                    <Text style={s.subHeadEyebrow}>{item.eyebrow}</Text>
                    <Text style={s.subHeadTitle}>{item.subcat}</Text>
                  </View>
                </View>
              );
            }
            const session = item.session;
            const canPlay = session.free || hasSub;
            return (
              <Pressable
                style={[s.row, !canPlay && s.rowLocked]}
                onPress={() => openSession(session)}
              >
                <View style={s.rowArt}>
                  {item.rowPhoto ? (
                    <Image source={{ uri: item.rowPhoto }} style={s.rowArtImg} />
                  ) : null}
                  <View style={s.rowPlay}>
                    <Text style={s.rowPlayGlyph}>
                      {canPlay ? '▶' : '🔒'}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      s.rowTag,
                      session.free ? s.rowTagFree : s.rowTagPro,
                    ]}
                  >
                    {session.free ? 'FREE' : 'PRO'}
                  </Text>
                  <Text style={s.rowTitle}>{session.title}</Text>
                  {session.desc ? (
                    <Text style={s.rowDesc}>{session.desc}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    );
  }

  // ── OVERZICHT: volledige webapp-kaart per serie ──
  // Per serie: grote foto-card met VIEW ALL rechtsboven, eyebrow
  // (SERIES_SUBTITLE), serietitel, subtitel (SERIES_SUB). DAARONDER
  // groene strip per gratis sessie met titel + FREE-tag + desc + status
  // (status conditioneel — geen veld op Session, dus voorlopig nooit).
  return (
    <View style={s.root}>
      <FlatList
        data={SERIES}
        keyExtractor={(i) => i.name}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={s.header}>
            <Text style={s.h1}>Audio Library</Text>
          </View>
        }
        renderItem={({ item }) => {
          const photo = SERIES_PHOTO[item.name];
          const eyebrow = SERIES_SUBTITLE[item.name];
          const subline = SERIES_SUB[item.name];
          const frees = item.sessions.filter((x) => x.free);
          return (
            <View style={s.cardUnit}>
              <Pressable
                style={s.card}
                onPress={() => setDetail(item.name)}
                android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={s.cardBg} />
                ) : null}
                <View style={s.cardGrad} />
                <Pressable
                  style={s.viewAll}
                  onPress={() => setDetail(item.name)}
                  hitSlop={8}
                >
                  <Text style={s.viewAllTxt}>VIEW ALL</Text>
                </Pressable>
                <View style={s.cardBody}>
                  {eyebrow ? (
                    <Text style={s.cardEyebrow}>{eyebrow}</Text>
                  ) : null}
                  <Text style={s.cardTitle}>{item.name}</Text>
                  {subline ? (
                    <Text style={s.cardSubline}>{subline}</Text>
                  ) : null}
                </View>
              </Pressable>

              {/* Groene free-session strip(s) — één per gratis sessie. */}
              {frees.map((sess) => {
                const status = (sess as { status?: string }).status;
                return (
                  <Pressable
                    key={sess.url}
                    style={s.freeRow}
                    onPress={() => openSession(sess)}
                    android_ripple={{ color: 'rgba(74,222,128,0.18)' }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.freeTag}>FREE</Text>
                      <Text style={s.freeTitle}>{sess.title}</Text>
                      {sess.desc ? (
                        <Text style={s.freeDesc}>{sess.desc}</Text>
                      ) : null}
                      {status ? (
                        <Text style={s.freeStatus}>{status}</Text>
                      ) : null}
                    </View>
                    <Text style={s.freePlay}>▶</Text>
                  </Pressable>
                );
              })}
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 56 },
  header: { marginTop: 8, marginBottom: 16 },
  h1: { color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  back: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  backTxt: { color: C.dim, fontSize: 15 },

  /* Eén unit = volledige webapp-kaart + alle free-session strips eronder. */
  cardUnit: { marginBottom: 22 },
  card: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: C.border,
    justifyContent: 'flex-end',
  },
  cardBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  cardGrad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  viewAll: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  viewAllTxt: {
    color: C.text,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  cardEyebrow: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardSubline: {
    color: C.text,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    opacity: 0.85,
  },

  /* Groene free-session strip (per gratis sessie) — direct onder de kaart. */
  freeRow: {
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
  freeTag: {
    color: C.free,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  freeTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  freeDesc: {
    color: C.dim,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  freeStatus: {
    color: C.free,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  freePlay: {
    color: C.free,
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },

  detailHead: {
    height: 170,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    justifyContent: 'flex-end',
    backgroundColor: C.border,
  },
  detailImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  detailGrad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  detailHeadText: { padding: 18 },
  detailTitle: { color: C.text, fontSize: 22, fontWeight: '800' },
  detailSub: { color: C.dim, fontSize: 12, marginTop: 4, fontWeight: '600' },

  /* Soundscapes subcat-header — eigen foto + eyebrow + subcat-naam */
  subHead: {
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 10,
    justifyContent: 'flex-end',
    backgroundColor: C.border,
  },
  subHeadImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  subHeadGrad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  subHeadTextWrap: { padding: 14 },
  subHeadEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  subHeadTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.rowBg,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  rowLocked: { opacity: 0.65 },
  rowArt: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: C.border,
  },
  rowArtImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  rowPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  rowPlayGlyph: { color: '#fff', fontSize: 16 },
  rowTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 3,
  },
  rowTagFree: { color: C.free },
  rowTagPro: { color: C.faint },
  rowTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  rowDesc: { color: C.dim, fontSize: 12, marginTop: 3, lineHeight: 17 },
});
