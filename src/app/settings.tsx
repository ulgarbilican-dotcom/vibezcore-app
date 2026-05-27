/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Settings sub-screen

   Stack-screen gepusht vanuit de Account-tab. Pareert qua structuur de
   webapp Settings-pagina (`#settings`-hash in de webapp): Playback (Save
   progress, Audio quality) · Privacy (Track history, Clear all local
   data) · About (Version).

   Implementatie-notes:
   - Toggles draaien op `utils/settings.ts` (vzs_v1 — module-state + listener
     pattern, sync-getter beschikbaar voor de audio-service).
   - "Audio quality" is een placeholder: backend levert nu één bitrate,
     pas relevant wanneer multi-bitrate URLs beschikbaar zijn.
   - "Clear all local data" wist ALLE keys in AsyncStorage (favorites,
     history, saved positions, last-played, signed-URL cache, settings,
     sub cache). Bewaart `vz_last_login_email` NIET — user re-typt z'n email
     na clear. Sign-out wordt NIET geforceerd; user blijft ingelogd op
     server-side session. Operator-keuze: "local data" = strikt lokale
     caches, niet de auth-session. User die echt uitloggen wil gebruikt
     Sign Out op de Account-tab.
   - Version wordt gelezen uit `Application.nativeApplicationVersion`
     (expo-application). Fallback "Unknown" wanneer 't pakket niet
     beschikbaar is.
   ─────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { useSetting } from '@/utils/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const [saveProgress, setSaveProgress] = useSetting('saveProgress');
  const [trackHistory, setTrackHistory] = useSetting('trackHistory');
  const [audioQuality, setAudioQuality] = useSetting('audioQuality');

  /* Spinner-state op de Clear-knop zodat de async clear-call duidelijk
     voortgang toont en user 'm niet dubbel tikt. */
  const [clearing, setClearing] = useState(false);

  /* App-version uit expo-constants. `expoConfig.version` komt uit
     app.json's `expo.version`-veld. Fallback "Unknown" bij edge-cases
     (devbuild zonder expoConfig, web, etc.). expo-application zou ook
     werken maar is geen bestaande dependency en zou een native rebuild
     vereisen (CLAUDE.md §9). */
  const version = Constants.expoConfig?.version ?? 'Unknown';

  /* Clear all local data — wist alle AsyncStorage-keys. Confirmation
     dialog voorkomt accidentele 1-tap data-loss. */
  const onClearData = () => {
    Alert.alert(
      'Clear all local data?',
      'This will remove your listening progress, history, favorites, and other local preferences from this device. Your subscription and account stay intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear data',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              /* AsyncStorage.clear() wist ALLES — incl. de bewust
                 persistent gehouden `vz_last_login_email` die we juist
                 NIET willen verliezen (pre-fill voor re-login). Dus we
                 doen het stuksgewijs via getAllKeys + multiRemove en
                 exclude die ene key. */
              const allKeys = await AsyncStorage.getAllKeys();
              const toRemove = allKeys.filter(
                (k) => k !== 'vz_last_login_email',
              );
              if (toRemove.length > 0) {
                await AsyncStorage.multiRemove(toRemove);
              }
              Alert.alert(
                'Cleared',
                'All local data has been removed. Restart the app to see a fresh state.',
              );
            } catch (e) {
              Alert.alert(
                'Could not clear',
                'Something went wrong. Try again or contact support if the problem persists.',
              );
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <Stack.Screen options={{ title: 'Settings', headerBackTitle: 'Account' }} />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>Settings</Text>

        {/* ── PLAYBACK ────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Playback</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>Save listening progress</Text>
              <Text style={s.rowSub}>Resume sessions where you left off.</Text>
            </View>
            <Switch
              value={saveProgress}
              onValueChange={setSaveProgress}
              trackColor={{ false: '#3a3a3a', true: Brand.accent }}
              thumbColor="#ffffff"
              ios_backgroundColor="#3a3a3a"
            />
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>Audio quality</Text>
              <Text style={s.rowSub}>
                Higher quality uses more data.
              </Text>
            </View>
            <View style={s.qualityToggle}>
              <Pressable
                style={[
                  s.qualityBtn,
                  audioQuality === 'low' && s.qualityBtnOn,
                ]}
                onPress={() => setAudioQuality('low')}
              >
                <Text
                  style={[
                    s.qualityBtnText,
                    audioQuality === 'low' && s.qualityBtnTextOn,
                  ]}
                >
                  Low
                </Text>
              </Pressable>
              <Pressable
                style={[
                  s.qualityBtn,
                  audioQuality === 'high' && s.qualityBtnOn,
                ]}
                onPress={() => setAudioQuality('high')}
              >
                <Text
                  style={[
                    s.qualityBtnText,
                    audioQuality === 'high' && s.qualityBtnTextOn,
                  ]}
                >
                  High
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── PRIVACY ─────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Privacy</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>Track listening history</Text>
              <Text style={s.rowSub}>
                Stored locally on your device only.
              </Text>
            </View>
            <Switch
              value={trackHistory}
              onValueChange={setTrackHistory}
              trackColor={{ false: '#3a3a3a', true: Brand.accent }}
              thumbColor="#ffffff"
              ios_backgroundColor="#3a3a3a"
            />
          </View>
        </View>

        <Pressable
          style={s.dangerRow}
          onPress={onClearData}
          disabled={clearing}
          accessibilityLabel="Clear all local data"
        >
          <View style={s.rowText}>
            <Text style={s.dangerTitle}>Clear all local data</Text>
            <Text style={s.rowSub}>
              Resets favorites, history, and progress.
            </Text>
          </View>
          <Text style={s.dangerCta}>{clearing ? '…' : 'Clear'}</Text>
        </Pressable>

        {/* ── ABOUT ────────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>About</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>Version</Text>
              <Text style={s.rowSub}>VIBEZCORE Audio Library</Text>
            </View>
            <Text style={s.versionText}>{version}</Text>
          </View>
        </View>

        <Pressable
          style={s.backLink}
          onPress={() => router.back()}
          accessibilityLabel="Go back to account"
        >
          <Text style={s.backLinkText}>← Back to Account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  title: {
    color: Brand.text,
    fontSize: 30,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.6,
    marginTop: 8,
    marginBottom: 20,
  },
  sectionLabel: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  rowSub: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  /* Audio-quality segmented control — kleine pill-pair (Low/High). */
  qualityToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    padding: 3,
  },
  qualityBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  qualityBtnOn: {
    backgroundColor: Brand.text,
  },
  qualityBtnText: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  qualityBtnTextOn: {
    color: Brand.bg,
  },
  /* Clear data row — los van de card omdat 't een destructive action is */
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 12,
  },
  dangerTitle: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  dangerCta: {
    color: Brand.error,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  versionText: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  backLink: {
    marginTop: 28,
    alignItems: 'center',
    paddingVertical: 12,
  },
  backLinkText: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
  },
});
