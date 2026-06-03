/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — LibraryListRow

   Gemeenschappelijke sessie-rij voor de Library-sub-pages (New / Favorites /
   Free). Spotify Liked Songs-stijl: foto links, body midden, accessory rechts.
   Per sub-page wordt een verschillend `rightAccessory` doorgegeven
   (NEW-pill / gevuld hartje / FREE-pill).
   ─────────────────────────────────────────────────────────────────────── */

import { SERIES_PHOTO, type Session } from '@/data/audio-library-data';
import { useSubscription } from '@/hooks/useSubscription';
import {
  getEffectiveTier,
  tierBadgeColor,
  tierBadgeLabel,
} from '@/utils/access-tier';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

export function LibraryListRow({
  session,
  onPress,
  rightAccessory,
}: {
  session: Session;
  onPress: () => void;
  rightAccessory?: ReactNode;
}) {
  const photo = SERIES_PHOTO[session.series];
  /* Iter 9dq v20 (2026-06-02): display-aware isPro (override-aware). In PRO
     mode geen FREE/PRO tag — alles is toegankelijk dus onderscheid is
     irrelevant. Free/Guest user zien de tag wel als wegwijzer voor wat ze
     nu kunnen vs wat upgrade vereist.
     Iter 9dq v59 (2026-06-03): drie tiers ipv twee — 'public' (FREE groen),
     'account' (FREE WITH ACCOUNT blauw), 'pro' (PRO dim). Voor PRO-users
     blijven we de badge verbergen want zij ervaren alles als unlocked. */
  const { isPro } = useSubscription();
  const tier = getEffectiveTier(session);
  const badgeLabel = tierBadgeLabel(tier);
  const badgeColor = tierBadgeColor(tier);
  return (
    <Pressable
      onPress={onPress}
      style={s.row}
      android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
    >
      <View style={s.art}>
        {photo ? <Image source={{ uri: photo }} style={s.artImg} /> : null}
      </View>
      <View style={s.body}>
        {!isPro && badgeLabel && (
          <Text style={[s.tag, { color: badgeColor }]}>{badgeLabel}</Text>
        )}
        <Text style={s.title} numberOfLines={2}>
          {session.title}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {session.series}
        </Text>
      </View>
      {rightAccessory ? (
        <View style={s.accessory}>{rightAccessory}</View>
      ) : null}
    </Pressable>
  );
}

export default LibraryListRow;

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  art: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  artImg: { width: '100%', height: '100%' },
  body: { flex: 1 },
  tag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8, // ≈ 0.08em bij 10px
    textTransform: 'uppercase',
  },
  tagFree: { color: '#4ade80' },
  tagPro: { color: 'rgba(255,255,255,0.55)' },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  sub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 3,
  },
  accessory: { marginLeft: 8 },
});
