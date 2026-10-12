/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — schakelaar Apple Health / Health Connect (Settings)
   Zie services/health-sync.ts. Verschijnt enkel als de koppeling in deze
   build zit. Aan = systeemvenster van Apple/Google; uit = niets meer
   schrijven of lezen (toestemming intrekken gebeurt in de gezondheidsapp).
   ───────────────────────────────────────────────────────────────────────── */

import { showVibezAlert } from '@/components/VibezAlert';
import { AudioAccent, BrandFonts } from '@/constants/theme';
import {
  connectHealth,
  disconnectHealth,
  healthAppName,
  isHealthModulePresent,
  openHealthSettings,
  useHealthSync,
} from '@/services/health-sync';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

export default function HealthSyncSetting({
  cardStyle,
  rowStyle,
  rowTextStyle,
  titleStyle,
  subStyle,
  labelStyle,
}: {
  cardStyle: object;
  rowStyle: object;
  rowTextStyle: object;
  titleStyle: object;
  subStyle: object;
  labelStyle: object;
}) {
  const on = useHealthSync();
  const [busy, setBusy] = useState(false);
  if (!isHealthModulePresent()) return null;
  const name = healthAppName();

  const toggle = async (v: boolean) => {
    if (busy) return;
    if (!v) {
      disconnectHealth();
      return;
    }
    setBusy(true);
    const r = await connectHealth();
    setBusy(false);
    if (r === 'denied') {
      void showVibezAlert({
        title: `${name} not connected`,
        message:
          Platform.OS === 'android'
            ? 'You did not allow any access. You can change this anytime in Health Connect.'
            : 'You can change this anytime in the Health app → Sharing → Apps → VIBEZCORE.',
      });
    } else if (r === 'unavailable') {
      void showVibezAlert({
        title: `${name} isn't available`,
        message:
          Platform.OS === 'android'
            ? 'Install or update Health Connect from Google Play, then try again.'
            : 'Health isn’t available on this device.',
      });
    }
  };

  return (
    <>
      <Text style={labelStyle}>Health</Text>
      <View style={cardStyle}>
        <View style={rowStyle}>
          <View style={rowTextStyle}>
            <Text style={titleStyle}>{name}</Text>
            <Text style={subStyle}>
              Save your Breathwork and State Control sessions, and use the resting heart rate from your watch to
              set your rhythm. Stays between your phone and {name}.
            </Text>
          </View>
          <Switch
            value={on}
            disabled={busy}
            onValueChange={(v) => void toggle(v)}
            trackColor={{ false: '#3a3a3a', true: AudioAccent }}
            thumbColor="#ffffff"
            ios_backgroundColor="#3a3a3a"
            accessibilityLabel={`Connect ${name}`}
          />
        </View>
        {on && Platform.OS === 'android' ? (
          <Pressable onPress={openHealthSettings} hitSlop={8} style={s.link} accessibilityRole="button">
            <Text style={s.linkTxt}>Manage access in Health Connect</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  link: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2 },
  linkTxt: { fontFamily: BrandFonts.semibold, fontSize: 14, color: '#4AF0D4' },
});
