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
import {
  DevUserOverride,
  setDevBraceletActivated,
  setDevUserOverride,
  useDevUserOverride,
} from '@/utils/dev-user-override';
import { unload as unloadAudioPlayer } from '@/services/audio-player';
import { clearHistory } from '@/utils/history';
import { clearLastPlayed } from '@/utils/last-played';
import { useSetting } from '@/utils/settings';
import { clearAllSavedPositions } from '@/utils/vzp';
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
  /* Iter 9pp: auto-play next session verhuisd van Audio Library
     naar Settings (operator-feedback "library is content-focused,
     preferences horen hier"). */
  const [autoPlayNext, setAutoPlayNext] = useSetting('autoPlayNext');
  const [voiceCues, setVoiceCues] = useSetting('voiceCues');

  /* Spinner-state op de Clear-knop zodat de async clear-call duidelijk
     voortgang toont en user 'm niet dubbel tikt. */
  const [clearing, setClearing] = useState(false);

  /* App-version uit expo-constants. `expoConfig.version` komt uit
     app.json's `expo.version`-veld. Fallback "Unknown" bij edge-cases
     (devbuild zonder expoConfig, web, etc.).

     Iter v145 (2026-06-25): nativeBuildVersion erbij. EAS Build
     auto-increment maakt `expoConfig.version` op zich onvoldoende —
     twee builds met dezelfde "1.0.0" hebben elk een eigen versionCode.
     Voor closed testing moet je weten "is dit #10 of nog #9?". */
  const version = Constants.expoConfig?.version ?? 'Unknown';
  const buildVersion = Constants.nativeBuildVersion;
  const versionLabel = buildVersion ? `${version} (${buildVersion})` : version;

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
              /* Iter 9dq v122/v123/v124 (2026-06-04): drie-traps-fix.
                 v122: AsyncStorage.multiRemove wist storage maar niet de
                       in-memory module-state van vzp/history/last-played.
                 v123: audio-player state.session bleef plakken door
                       loadSession's same-session-fast-path.
                 v124: unload() roept saveCurrentPositionIfWorthwhile aan,
                       die de huidige positie schrijft NÁ clearAllSaved-
                       Positions → Continue-prompt bleef bestaan.
                 Volgorde nu STRIKT sequentieel:
                   1. unload met skipSave=true → reset player+state, geen
                      stiekeme save naar vzp
                   2. clearAllSavedPositions → vzp module wist
                   3. clearLastPlayed + clearHistory parallel (onafhankelijk) */
              await unloadAudioPlayer({ skipSave: true });
              await clearAllSavedPositions();
              await Promise.all([
                clearLastPlayed(),
                clearHistory(),
                /* Iter 9dq v125: ook activation-flag wissen (in-memory +
                   storage). Anders kon "Looking for your bracelet" blijven
                   verschijnen voor owners die voorheen geactiveerd waren. */
                setDevBraceletActivated(false),
              ]);
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
          {/* Iter 9pp: auto-play next session (verhuisd van Library) */}
          <View style={s.row}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>Auto-play next session</Text>
              <Text style={s.rowSub}>
                Automatically continue to the next session.
              </Text>
            </View>
            <Switch
              value={autoPlayNext}
              onValueChange={setAutoPlayNext}
              trackColor={{ false: '#3a3a3a', true: Brand.accent }}
              thumbColor="#ffffff"
              ios_backgroundColor="#3a3a3a"
            />
          </View>
          <View style={s.divider} />
          {/* Iter v149 v3 (2026-06-25): voice cues toggle voor breath +
              bracelet sessies. Default OFF — operator-feedback dat
              bracelet-stem te luid was bij onverwacht moment (vergadering). */}
          <View style={s.row}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>Voice cues</Text>
              <Text style={s.rowSub}>
                Spoken guidance during breath and bracelet sessions.
              </Text>
            </View>
            <Switch
              value={voiceCues}
              onValueChange={setVoiceCues}
              trackColor={{ false: '#3a3a3a', true: Brand.accent }}
              thumbColor="#ffffff"
              ios_backgroundColor="#3a3a3a"
            />
          </View>
          <View style={s.divider} />
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
              <Text style={s.rowSub}>VIBEZCORE App · Audio + Bracelet</Text>
            </View>
            <Text style={s.versionText}>{versionLabel}</Text>
          </View>
        </View>

        {/* ── DEV USER-STATE OVERRIDE (iter 9p) ────────────────────────
            Alleen zichtbaar in __DEV__ builds. Laat operator switchen
            tussen guest / audio-only / bracelet / full-pro zonder
            backend te wijzigen. AsyncStorage-persistent.
            Productie-builds skippen deze sectie volledig. */}
        {__DEV__ && <DevUserOverrideSection />}

        {/* ── DEV SCREEN-PREVIEW SHORTCUTS (iter 9dq v69) ──────────────
            Alleen __DEV__: snel een specifiek scherm openen zonder de
            volledige user-flow te doorlopen. Vooral handig voor de
            subscribe-screen review-flow die een signed-in user vereist
            — wat normaal gesproken een echt test-account betekent. */}
        {__DEV__ && (
          <>
            <Text style={s.sectionLabel}>Developer · screen previews</Text>
            <View style={s.card}>
              <Pressable
                style={s.row}
                onPress={() =>
                  router.push(
                    '/subscribe?tier=yearly&devForceSignedIn=1' as never,
                  )
                }
                accessibilityLabel="Preview subscribe screen as signed-in user"
              >
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>Subscribe — signed-in review</Text>
                  <Text style={s.rowSub}>
                    Toont order-summary + "Continue to checkout" zonder
                    echt account.
                  </Text>
                </View>
              </Pressable>
              <View style={s.divider} />
              <Pressable
                style={s.row}
                onPress={() => router.push('/subscribe?tier=monthly' as never)}
                accessibilityLabel="Preview subscribe screen as guest"
              >
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>Subscribe — signed-out form</Text>
                  <Text style={s.rowSub}>
                    Toont email/password form (account-create-pad).
                  </Text>
                </View>
              </Pressable>
            </View>
          </>
        )}

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

/* ── DevUserOverrideSection (iter 9p, uitgebreid 9hh) ──────────────
   Dev-only switcher voor het simuleren van alle login/entitlement
   combinaties zonder backend te wijzigen. Productie-builds skippen
   deze sectie volledig.

   5 user-states gedekt:
     - Real      : echte backend-status
     - Free      : ingelogd zonder PRO of bracelet (was 'guest')
     - Audio PRO : audio-subscription actief
     - Bracelet  : bracelet-owner zonder audio sub
     - Full PRO  : audio + bracelet

   "Echte guest" (geen account / niet ingelogd) → daarvoor moet user
   apart uitloggen via Account → Sign Out. Hint onderaan stuurt user
   daar naartoe. */
function DevUserOverrideSection() {
  const current = useDevUserOverride();
  /* Iter 9ii: "Free signed-in" verwijderd — bestaat niet in productie
     model. VIBEZCORE accounts ontstaan alleen via productaankoop.
     Iter 9ap (2026-05-31): "Free / Guest" optie teruggebracht puur voor
     TEST-doel — laat de operator snel testen wat een niet-ingelogde
     bezoeker ziet (free audio library met preview-cap, marketing
     bracelet etc.) zonder daadwerkelijk uit te loggen. Productie-model
     blijft: signed-in = always at least one product (deze override
     bestaat alleen in __DEV__). */
  const options: {
    value: DevUserOverride;
    label: string;
    sub: string;
  }[] = [
    { value: null, label: 'Real', sub: 'Use backend status (default)' },
    {
      value: 'guest',
      label: 'Free / Guest',
      sub: 'No entitlements · sees free env',
    },
    {
      value: 'audio',
      label: 'Audio PRO',
      sub: 'Audio subscription only',
    },
    {
      value: 'bracelet',
      label: 'Bracelet owner',
      sub: 'Owner only · no audio sub',
    },
    {
      value: 'pro',
      label: 'Full PRO',
      sub: 'Audio + Bracelet',
    },
  ];
  return (
    <>
      <Text style={s.sectionLabel}>
        Developer · Simulate user type
      </Text>
      <View style={s.card}>
        {options.map((opt, i) => {
          const active = current === opt.value;
          return (
            <Pressable
              key={String(opt.value)}
              style={[
                devS.row,
                i < options.length - 1 && devS.rowDivider,
                active && devS.rowActive,
              ]}
              onPress={() => setDevUserOverride(opt.value)}
              accessibilityLabel={`Simulate ${opt.label}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={[devS.label, active && devS.labelActive]}>
                  {opt.label}
                </Text>
                <Text style={devS.sub}>{opt.sub}</Text>
              </View>
              {active && <Text style={devS.tick}>✓</Text>}
            </Pressable>
          );
        })}
      </View>
      <Text style={devS.hint}>
        Production has no free signed-in tier — accounts only exist via
        product purchase. "Free / Guest" simulates a non-logged-in visitor
        for testing without actually signing out. Dev-only · resets when
        clearing local data.
      </Text>
    </>
  );
}

const devS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowActive: {
    backgroundColor: 'rgba(58,143,255,0.08)',
  },
  label: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  labelActive: {
    color: Brand.accent,
  },
  sub: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  tick: {
    color: Brand.accent,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    marginLeft: 8,
  },
  hint: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 10,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 8,
  },
});

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
