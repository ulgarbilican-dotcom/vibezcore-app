/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — /library/favorites — "Your Favorites"

   Sub-page van de Audio Library. Bereikbaar via de FAVORITES-knop op
   /(tabs)/index. Toont alle sessies in vibezcore:favorites (AsyncStorage),
   nieuwste-toegevoegd bovenaan. Tik op het hartje verwijdert de sessie en
   die verdwijnt direct uit de lijst.
   ─────────────────────────────────────────────────────────────────────── */

import { LibraryListRow } from '@/components/LibraryListRow';
import { SESSIONS, type Session } from '@/data/audio-library-data';
import { useFavorites } from '@/hooks/useFavorites';
import { useGatedOpenSession } from '@/utils/openSession';
import { urlEq } from '@/utils/url-eq';
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LibraryFavoritesScreen() {
  const { favorites, toggle: toggleFavorite } = useFavorites();
  /* Iter 9dq v63 (2026-06-03): gated-open. Tap op een favoriete PRO-sessie
     door een free-user → push naar /subscribe ipv stille fail in player. */
  const openGated = useGatedOpenSession();

  /* Map<url, FavEntry> behoudt insertion-order. We sorteren op `ts` descending
     (= nieuwste-toegevoegd bovenaan) zodat een replay van een oude favoriet
     m niet plotseling naar boven duwt. URL → Session resolution via
     SESSIONS.find. Orphans (sessies wier URL niet meer in de data zit)
     skippen we stil. */
  const sessions = useMemo<Session[]>(() => {
    const entries = [...favorites.values()].sort((a, b) => b.ts - a.ts);
    const out: Session[] = [];
    for (const fav of entries) {
      const sess = SESSIONS.find((s) => urlEq(s.url, fav.url));
      if (sess) out.push(sess);
    }
    return out;
  }, [favorites]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.topbar}>
        <Pressable onPress={goBack} hitSlop={14} style={s.backBtn}>
          <Text style={s.backChev}>‹</Text>
          <Text style={s.backText}>Back</Text>
        </Pressable>
        <Text style={s.topbarTitle}>Your Favorites</Text>
        <View style={s.topbarRight} />
      </View>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Iter 9dq v20 (2026-06-02): eyebrow verwijderd (operator-feedback:
            3x "Your Favorites" + harde rode eyebrow voelt overdone).
            Topbar geeft navigation-context, H1 + subtitle volstaan voor
            page-intro. Zelfde aanpak op /library/new en /library/free. */}
        <View style={s.header}>
          <Text style={s.h1}>Your Favorites</Text>
          <Text style={s.subtitle}>
            Sessions you've saved to come back to
          </Text>
        </View>
        {sessions.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyGlyph}>♡</Text>
            <Text style={s.emptyTitle}>No favorites yet</Text>
            <Text style={s.emptySub}>
              Tap the heart on any session to save it here.
            </Text>
          </View>
        ) : (
          sessions.map((sess) => (
            <LibraryListRow
              key={sess.url}
              session={sess}
              onPress={() => openGated(sess)}
              rightAccessory={
                <Pressable
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    toggleFavorite(sess);
                  }}
                  hitSlop={10}
                  style={s.heart}
                >
                  <Text style={s.heartGlyph}>♥</Text>
                </Pressable>
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { paddingBottom: 56 },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0a0a0a',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 80,
  },
  backChev: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '600',
    marginRight: 4,
    marginTop: -2,
  },
  backText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  topbarTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  topbarRight: { minWidth: 80 },

  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 12,
  },
  h1: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },

  empty: {
    paddingVertical: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyGlyph: {
    fontSize: 40,
    color: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  heart: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartGlyph: {
    color: '#f43f5e',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
});
