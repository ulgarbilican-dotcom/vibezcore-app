/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — /library/free — "Free Sessions"

   Sub-page van de Audio Library. Bereikbaar via de FREE-knop op
   /(tabs)/index. Toont alle sessies met `free === true` (14 stuks).
   Geen empty state — er zijn altijd free sessies.
   ─────────────────────────────────────────────────────────────────────── */

import { LibraryListRow } from '@/components/LibraryListRow';
import { SESSIONS, type Session } from '@/data/audio-library-data';
import { useGatedOpenSession } from '@/utils/openSession';
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

export default function LibraryFreeScreen() {
  const sessions = useMemo<Session[]>(
    () => SESSIONS.filter((sess) => sess.free),
    [],
  );
  /* Iter 9dq v63 (2026-06-03): gated-open ipv directe openSession. Public-
     tier sessies (alle 'free' in deze sub-page) spelen direct. Mocht een
     account-tier of PRO-tier sessie hier later landen, dan handelt de
     gating-laag de juiste flow af (AccountWallModal / push naar /subscribe). */
  const openGated = useGatedOpenSession();

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
        <Text style={s.topbarTitle}>Free Sessions</Text>
        <View style={s.topbarRight} />
      </View>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Iter 9dq v20 (2026-06-02): eyebrow weg — consistent met
            /library/favorites + /library/new. H1 + subtitle volstaan. */}
        <View style={s.header}>
          <Text style={s.h1}>Free Sessions</Text>
          <Text style={s.subtitle}>
            Listen to these any time — no subscription required
          </Text>
        </View>
        {sessions.map((sess) => (
          <LibraryListRow
            key={sess.url}
            session={sess}
            onPress={() => openGated(sess)}
            rightAccessory={
              <View style={s.freePill}>
                <Text style={s.freePillTxt}>FREE</Text>
              </View>
            }
          />
        ))}
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

  freePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.4)',
  },
  freePillTxt: {
    color: '#4ade80',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.54,
    textTransform: 'uppercase',
  },
});
