/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — horloge-status (12 okt 2026, operator: "gebruikers mogen niet
   sukkelen zoals ik nu")

   Eén regel die altijd zegt wat het horloge doet, en wat te doen:
     · ready  → "Galaxy Watch4 · Connected" — sessies lopen mee op je pols;
     · noApp  → "Install VIBEZCORE on your watch" + Install (opent de Play
                Store OP het horloge);
     · none   → enkel als hier ooit een horloge verbonden was: "Watch not
                connected" + waar je hem opnieuw verbindt. Wie geen horloge
                heeft, ziet niets.
   Android (Wear OS). Op de iPhone installeert Apple de horloge-app zelf.
   ───────────────────────────────────────────────────────────────────────── */

import { showVibezAlert } from '@/components/VibezAlert';
import { BrandFonts } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Watch } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { getWatchStatus, openStoreOnWatch, type WatchAppStatus } from '../../modules/wear-breath';

const SEEN_KEY = 'vz_watch_seen_v1';

export default function WatchStatusRow() {
  const [st, setSt] = useState<{ status: WatchAppStatus; name: string } | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let alive = true;
    void AsyncStorage.getItem(SEEN_KEY)
      .then((v) => alive && setSeen(v === '1'))
      .catch(() => {});
    const check = async () => {
      const r = await getWatchStatus();
      if (!alive) return;
      setSt(r);
      if (r.status !== 'none') {
        setSeen(true);
        void AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
      }
    };
    void check();
    const id = setInterval(check, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (Platform.OS !== 'android' || !st) return null;
  if (st.status === 'none' && !seen) return null;

  const name = st.name || 'Your watch';
  const title =
    st.status === 'ready' ? `${name} · Connected` : st.status === 'noApp' ? 'Install VIBEZCORE on your watch' : 'Watch not connected';
  const sub =
    st.status === 'ready'
      ? 'Your sessions run on your wrist'
      : st.status === 'noApp'
        ? 'Feel your sessions on your wrist'
        : "Reconnect it in your watch's app on this phone";

  return (
    <View style={s.row} accessible accessibilityLabel={`${title}. ${sub}`}>
      <Watch size={20} color={st.status === 'ready' ? '#4AF0D4' : 'rgba(255,255,255,0.55)'} strokeWidth={2} />
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {st.status === 'noApp' ? (
        <Pressable
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}
          onPress={async () => {
            const ok = await openStoreOnWatch();
            void showVibezAlert({
              title: ok ? 'Check your watch' : "Couldn't reach your watch",
              message: ok
                ? 'Tap Install on your watch to add VIBEZCORE.'
                : 'Open the Play Store on your watch and search for VIBEZCORE.',
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="Install VIBEZCORE on your watch"
        >
          <Text style={s.btnTxt}>Install</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  title: { fontFamily: BrandFonts.semibold, fontSize: 15, color: '#ffffff' },
  sub: { fontFamily: BrandFonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  btn: { backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 14, height: 32, justifyContent: 'center' },
  btnTxt: { fontFamily: BrandFonts.semibold, fontSize: 14, color: '#0a0a0a' },
});
