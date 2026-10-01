/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — /library/new — "What's New"

   Sub-page van de Audio Library. Bereikbaar via de NEW-knop op
   /(tabs)/index. Toont alle sessies waarvoor isNew(sess.added) === true,
   gesorteerd nieuwste-eerst. Bij geen matches: empty state.
   ─────────────────────────────────────────────────────────────────────── */

import { LibraryListRow } from '@/components/LibraryListRow';
import { AudioAccent } from '@/constants/theme';
import { SESSIONS, type Session } from '@/data/audio-library-data';
import { isNew } from '@/utils/isNew';
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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function LibraryNewScreen() {
  const sessions = useMemo<Session[]>(
    () =>
      SESSIONS.filter((sess) => isNew(sess.added)).sort((a, b) =>
        b.added.localeCompare(a.added),
      ),
    [],
  );
  /* Iter 9dq v63 (2026-06-03): gated-open — PRO-sessies bij free-user
     leiden naar /subscribe ipv stille fail. */
  const openGated = useGatedOpenSession();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  const backPressScale = useSharedValue(1);
  const onBackPressIn = () => {
    backPressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onBackPressOut = () => {
    backPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const backPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backPressScale.value }],
  }));

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.topbar}>
        <AnimatedPressable
          onPress={goBack}
          onPressIn={onBackPressIn}
          onPressOut={onBackPressOut}
          hitSlop={14}
          style={[s.backBtn, backPressStyle]}
        >
          <Text style={s.backChev}>‹</Text>
          <Text style={s.backText}>Back</Text>
        </AnimatedPressable>
        <Text style={s.topbarTitle}>What's New</Text>
        <View style={s.topbarRight} />
      </View>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Iter 9dq v20 (2026-06-02): eyebrow weg — consistent met
            /library/favorites + /library/free. H1 + subtitle volstaan. */}
        <View style={s.header}>
          <Text style={s.h1}>What's New</Text>
          <Text style={s.subtitle}>
            Fresh sessions added in the last 30 days
          </Text>
        </View>
        {sessions.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyGlyph}>✨</Text>
            <Text style={s.emptyTitle}>No new sessions this week</Text>
            <Text style={s.emptySub}>
              Check back soon — fresh sessions drop monthly.
            </Text>
          </View>
        ) : (
          sessions.map((sess) => (
            <LibraryListRow
              key={sess.url}
              session={sess}
              onPress={() => openGated(sess)}
              rightAccessory={
                <View style={s.newPill}>
                  <Text style={s.newPillTxt}>NEW</Text>
                </View>
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

  newPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    /* Operator, 26 september 2026 (accentkleur-wissel, audio): NEW-badge is
       een label-rol → AudioAccent i.p.v. het oude Signal Blue (#3a8fff). */
    backgroundColor: AudioAccent,
  },
  newPillTxt: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.54, // ≈ 0.06em bij 9px
    textTransform: 'uppercase',
  },
});
