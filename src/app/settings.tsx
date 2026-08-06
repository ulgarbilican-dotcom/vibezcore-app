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

import { AUDIO_ENABLED } from '@/constants/features';
import { Brand, BrandFonts } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';
import {
  SLOTS,
  ensurePermission,
  reminderKey,
  syncReminders,
} from '@/services/reminders';
import {
  DevUserOverride,
  setDevBraceletActivated,
  setDevUserOverride,
  useDevUserOverride,
} from '@/utils/dev-user-override';
import { unload as unloadAudioPlayer } from '@/services/audio-player';
import { clearHistory } from '@/utils/history';
import { clearLastPlayed } from '@/utils/last-played';
import { setSetting, useSetting } from '@/utils/settings';
import { clearAllSavedPositions } from '@/utils/vzp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showVibezAlert } from '@/components/VibezAlert';

export default function SettingsScreen() {
  const [saveProgress, setSaveProgress] = useSetting('saveProgress');
  const [trackHistory, setTrackHistory] = useSetting('trackHistory');
  const [audioQuality, setAudioQuality] = useSetting('audioQuality');
  /* Iter 9pp: auto-play next session verhuisd van Audio Library
     naar Settings (operator-feedback "library is content-focused,
     preferences horen hier"). */
  const [autoPlayNext, setAutoPlayNext] = useSetting('autoPlayNext');
  const [reminders, setReminders] = useSetting('reminders');
  const [voiceCues, setVoiceCues] = useSetting('voiceCues');
  const sub = useSubscription();
  const hasBracelet = sub.hasBracelet;
  /* Iter v170: voice cues toggle verplaatst naar in-context (Breath tab +
     Bracelet active). Setting key blijft bestaan in storage; Breath tab
     leest 'm via z'n eigen useSetting('voiceCues'). */

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
    void showVibezAlert({
      title: 'Clear all local data?',
      message:
        'This will remove your listening progress, history, favorites, and other local preferences from this device. Your subscription and account stay intact.',
      buttons: [
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
              void showVibezAlert({
                title: 'Cleared',
                message:
                  'All local data has been removed. Restart the app to see a fresh state.',
              });
            } catch (e) {
              void showVibezAlert({
                title: 'Could not clear',
                message:
                  'Something went wrong. Try again or contact support if the problem persists.',
              });
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    });
  };

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <Stack.Screen options={{ title: 'Settings', headerBackTitle: 'Account' }} />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>Settings</Text>

        {/* ── HERINNERINGEN ─────────────────────────────────────────
            Het grootste gat tegenover de concurrentie: die sturen dagelijks
            iets, wij stuurden niets. Drie vaste momenten in plaats van een
            vrije tijdkiezer — dat scheelt een pakket en een scherm, en het
            sluit aan op de tijdstippen waar de suggestie al mee rekent.
            Standaard alle drie UIT. Een app die ongevraagd begint te porren
            verliest precies de mensen die hij wil houden. */}
        {/* Alleen zolang de audiobibliotheek meedoet. Instellingen voor een
            onderdeel dat niet in beeld is, zijn ruis. */}
        {AUDIO_ENABLED && (
        <>
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
          {/* Iter v170 (2026-06-28): Voice cues toggle uit Settings verwijderd.
              Operator-feedback: "er zijn 2 verschillende paginas waar voice
              voor breathwork is, die apart bediend worden — nu verwarrend".
              Plus copy claimde "breath AND bracelet" terwijl bracelet-voice
              eigen state heeft die NIET met deze setting synchroniseerde.
              Voice toggle blijft in-context (Breath tab active sessie +
              Bracelet active sessie) waar gebruiker mid-sessie de keuze
              wil maken. `voiceCues` setting key blijft bestaan in storage
              omdat de Breath tab toggle 'm gebruikt. */}
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
        </>
        )}

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

        {/* De intro opnieuw kunnen bekijken (operator, 3 augustus 2026). Hij
            liep maar één keer en zat daarna achter een ontwikkelaarsschakelaar
            — onbereikbaar voor wie de app gewoon gebruikt, terwijl juist die
            intro uitlegt wát dit product is. Iemand die hem oversloeg of hem
            aan een ander wil tonen moet erbij kunnen. */}
        {/* ── BREATHWORK ───────────────────────────────────────────────
            Alles wat met ademsessies te maken heeft staat bij elkaar, en niets
            ervan raakt de bracelet. Die scheiding is niet cosmetisch: lang
            niet iedereen heeft een bracelet, en instellingen voor iets dat je
            niet bezit maken een scherm onbegrijpelijk (operator, 5 augustus
            2026). */}
        <Text style={s.sectionLabel}>Breathwork</Text>
        <Text style={s.subLabel}>Daily reminders</Text>
        <View style={s.card}>
          {SLOTS.map((slot, i) => (
            <View key={slot.slot}>
              {i > 0 && <View style={s.divider} />}
              <View style={s.row}>
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>
                    {slot.label} · {slot.when}
                  </Text>
                  <Text style={s.rowSub}>{slot.body}</Text>
                </View>
                <Switch
                  value={reminders[reminderKey('breath', slot.slot)] === true}
                  onValueChange={async (v) => {
                    const next = {
                      ...reminders,
                      [reminderKey('breath', slot.slot)]: v,
                    };
                    if (v && !(await ensurePermission())) return;
                    await setReminders(next);
                    void syncReminders(next);
                  }}
                  trackColor={{ false: '#3a3a3a', true: Brand.accent }}
                  thumbColor="#ffffff"
                  ios_backgroundColor="#3a3a3a"
                />
              </View>
            </View>
          ))}
        </View>

        <Text style={s.subLabel}>General</Text>
        <View style={s.card}>
          <Pressable
            style={s.row}
            onPress={async () => {
              await setSetting('breathOnboardingCompletedAt', null);
              router.push('/breath-welcome' as never);
            }}
            accessibilityLabel="Watch the breathwork intro again"
          >
            <View style={s.rowText}>
              <Text style={s.rowTitle}>Watch the intro again</Text>
              <Text style={s.rowSub}>
                The five-screen walkthrough, from the start.
              </Text>
            </View>
            <Text style={s.versionText}>›</Text>
          </Pressable>
        </View>

        {/* ── SMART BEAD BRACELET ──────────────────────────────────────
            Verschijnt alleen voor wie er een heeft. Een gast ziet de etalage
            op het Bracelet-tabblad, geen instellingen voor hardware die hij
            niet bezit — dat is het verschil tussen een app die meedenkt en
            een lijst met dode knoppen. */}
        {hasBracelet && (
          <>
            <Text style={s.sectionLabel}>Smart Bead Bracelet</Text>
            {/* Eigen herinneringen. Breathwork vraagt vijf minuten en
                aandacht; de bracelet vraagt dat je op één knop drukt. Twee
                verschillende dingen om aan herinnerd te worden, dus twee
                schakelaars — nooit één die beide aanzet. */}
            <Text style={s.subLabel}>Daily reminders</Text>
            <View style={s.card}>
              {SLOTS.map((slot, i) => (
                <View key={slot.slot}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={s.row}>
                    <View style={s.rowText}>
                      <Text style={s.rowTitle}>
                        {slot.label} · {slot.when}
                      </Text>
                      <Text style={s.rowSub}>One press. No screen, no sound.</Text>
                    </View>
                    <Switch
                      value={
                        reminders[reminderKey('bracelet', slot.slot)] === true
                      }
                      onValueChange={async (v) => {
                        const next = {
                          ...reminders,
                          [reminderKey('bracelet', slot.slot)]: v,
                        };
                        if (v && !(await ensurePermission())) return;
                        await setReminders(next);
                        void syncReminders(next);
                      }}
                      trackColor={{ false: '#3a3a3a', true: Brand.accent }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#3a3a3a"
                    />
                  </View>
                </View>
              ))}
            </View>

            <Text style={s.subLabel}>General</Text>
            <View style={s.card}>
              <View style={s.row}>
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>Voice during sessions</Text>
                  <Text style={s.rowSub}>
                    Spoken guidance while a bracelet session runs. The wrist
                    keeps working either way.
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
            </View>
          </>
        )}

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
              {/* Puntenveld-prototype (3 augustus 2026). Stond alleen achter
                  een deeplink, en die moet je met een commando afvuren — dat
                  is geen manier om iets te beoordelen. */}
              <Pressable
                style={s.row}
                onPress={() => router.push('/breath-splat' as never)}
                accessibilityLabel="Open the point-field prototype"
              >
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>Puntenveld — prototype</Text>
                  <Text style={s.rowSub}>
                    Punten trekken samen tot de gezichten bij het inademen en
                    waaieren uiteen bij het uitademen. Kies een modus, druk
                    START.
                  </Text>
                </View>
              </Pressable>
              <View style={s.divider} />
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
              <View style={s.divider} />
              {/* Iter breath-onboarding: zet de completed-vlag terug op null
                 en opent de onboarding direct. Voorkomt dat je de hele
                 app-data moet wissen om de flow opnieuw te doorlopen. */}
              <Pressable
                style={s.row}
                onPress={async () => {
                  await setSetting('breathOnboardingCompletedAt', null);
                  router.push('/breath-welcome' as never);
                }}
                accessibilityLabel="Replay breath onboarding"
              >
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>Breath onboarding — opnieuw</Text>
                  <Text style={s.rowSub}>
                    Reset de first-run vlag en opent de onboarding meteen.
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
  subLabel: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.38)',
    marginTop: 14,
    marginBottom: 6,
    marginLeft: 4,
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
