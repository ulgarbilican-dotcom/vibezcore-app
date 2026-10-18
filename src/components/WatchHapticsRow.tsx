/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Smartwatch in Audio & Haptics (14 okt 2026, operator: "een
   knop om de haptics op het horloge te activeren of deactiveren — zeer
   professioneel en heel overzichtelijk")

   Eén regel, enkel als er een horloge is:
     · ready  → "Smartwatch" · "Galaxy Watch4" + schakelaar (aan = het ritme
                op je pols; uit = de telefoon trilt zelf). Geldt voor
                Breathwork én State Control, wordt onthouden.
     · noApp  → "Smartwatch" · "Install VIBEZCORE on Galaxy Watch4" + Install
                (opent de Play Store OP het horloge).
     · none   → enkel als hier ooit een horloge verbonden was: "Not
                connected". Wie geen horloge heeft, ziet niets.
   Vervangt de losse WatchStatusRow bovenaan de bladen. Android (Wear OS)
   én iPhone (Apple Watch, sinds 14 okt 2026): op de iPhone zonder Install-
   knop — Apple installeert de horloge-app via de Watch-app.
   ───────────────────────────────────────────────────────────────────────── */

import { showVibezAlert } from '@/components/VibezAlert';
import { BrandFonts } from '@/constants/theme';
import { useSetting } from '@/utils/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { getAppleWatchStatus } from '../../modules/watch-breath';
import { getWatchStatus, openStoreOnWatch, type WatchAppStatus } from '../../modules/wear-breath';

const SEEN_KEY = 'vz_watch_seen_v1';

/** Status van het gekoppelde horloge, elke 10 s ververst. */
export function useWatchStatus(): { status: WatchAppStatus; name: string; seen: boolean; diag?: string } | null {
  const [st, setSt] = useState<{ status: WatchAppStatus; name: string; diag?: string } | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    let alive = true;
    void AsyncStorage.getItem(SEEN_KEY)
      .then((v) => alive && setSeen(v === '1'))
      .catch(() => {});
    const check = async () => {
      const r = Platform.OS === 'ios' ? await getAppleWatchStatus() : await getWatchStatus();
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
  if (!st) return null;
  return { ...st, seen };
}

type Props = {
  /** Wordt aangeroepen bij omzetten (bv. het horloge meteen laten volgen of
   *  stoppen tijdens een lopende sessie). */
  onToggle: (on: boolean) => void;
  /** Optionele scheidingslijn boven de regel (binnen een kaart). */
  separatorStyle?: ViewStyle;
  /** Zelfde letter als de andere regels in de kaart. */
  labelStyle?: TextStyle;
};

export default function WatchHapticsRow({ onToggle, separatorStyle, labelStyle }: Props) {
  const w = useWatchStatus();
  const [on] = useSetting('watchHaptics');
  if (!w) return null;
  /* iPhone (18 okt 2026, Apple Watch-diagnose): ook zonder verbinding de
     regel tonen, met wat WatchConnectivity ziet. */
  if (w.status === 'none' && !w.seen && Platform.OS !== 'ios') return null;

  const name = w.name || 'Your watch';
  const sub =
    w.status === 'ready'
      ? name
      : w.status === 'noApp'
        ? Platform.OS === 'ios'
          ? 'Install VIBEZCORE in the Watch app'
          : `Install VIBEZCORE on ${name}`
        : 'Not connected';

  return (
    <>
      {separatorStyle ? <View style={separatorStyle} /> : null}
      <View style={s.row} accessible={w.status !== 'ready'} accessibilityLabel={`Smartwatch. ${sub}`}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, labelStyle]} numberOfLines={1}>
            Smartwatch
          </Text>
          <Text style={s.sub} numberOfLines={1}>
            {sub}
          </Text>
          {Platform.OS === 'ios' && w.status !== 'ready' && w.diag ? (
            <Text style={[s.sub, { fontSize: 10, opacity: 0.6 }]} numberOfLines={2}>
              {w.diag}
            </Text>
          ) : null}
        </View>
        {w.status === 'ready' ? (
          <Switch
            value={on}
            onValueChange={onToggle}
            trackColor={{ false: '#3a3a3a', true: '#00A3A3' }}
            thumbColor="#ffffff"
            ios_backgroundColor="#3a3a3a"
            accessibilityLabel={`Vibrate on ${name}`}
          />
        ) : w.status === 'noApp' && Platform.OS === 'android' ? (
          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}
            onPress={async () => {
              const ok = await openStoreOnWatch();
              void showVibezAlert({
                title: ok ? 'Check your watch' : "Couldn't reach your watch",
                message: ok
                  ? 'The Play Store opened on your watch. Tap Install there.'
                  : 'Open the Play Store on your watch and search for VIBEZCORE.',
                buttons: [{ text: 'OK', style: 'primary' }],
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Install VIBEZCORE on ${name}`}
          >
            <Text style={s.btnTxt}>Install</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  title: { color: '#ffffff', fontFamily: BrandFonts.semibold, fontSize: 16 },
  sub: { color: 'rgba(255,255,255,0.55)', fontFamily: BrandFonts.regular, fontSize: 13, marginTop: 2 },
  btn: { backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  btnTxt: { color: '#0a0a0a', fontFamily: BrandFonts.semibold, fontSize: 13 },
});
