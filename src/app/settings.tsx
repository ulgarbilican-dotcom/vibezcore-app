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
import * as Haptics from 'expo-haptics';
import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import { HeaderBackButton } from '@/components/HeaderBackButton';
/* Operator, 26 september 2026 (Huisstijl & Design Handboek v4.4):
   Brand.accent (#3a8fff, Signal Blue) is enkel voor haptic-pulse/"nu
   actief" — nooit voor toggle-switches/selectie-indicators. Deze
   schermen zijn dark, dus AudioAccent is de vervanging. */
const ACCENT_TEXT_ON_DARK_RGB = '110,133,196';
import { useSubscription } from '@/hooks/useSubscription';
import {
  SLOTS,
  ensurePermission,
  reminderKey,
  resyncAllPlanReminders,
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
import { getSetting, setSetting, useSetting } from '@/utils/settings';
import { clearActivePlan } from '@/utils/plan-store';
import { clearAllSavedPositions } from '@/utils/vzp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { confirmVibezAlert, showVibezAlert } from '@/components/VibezAlert';

/* Operator, 28 september 2026 ("bij lockscreen zie ik geen scherm voor
   breathwork, dit is wel belangrijk... moet gecommuniceerd worden... als
   gebruiker nee zegt moet dat later nog aangepast kunnen worden"):
   `ensurePermission()` (services/reminders.ts) geeft simpelweg `false`
   terug zodra de OS-toestemming ooit geweigerd is (`canAskAgain:false`,
   Android 13+/iOS) — de native prompt verschijnt dan NOOIT meer opnieuw,
   dus was er stilzwijgend geen enkele weg terug: de switch sprong terug
   naar uit, zonder uitleg, en de gebruiker kon nergens ontdekken waarom
   z'n lockscreen-melding (breathwork/bracelet, zie startSessionKeepAlive/
   BreathSessionService.kt) niet verscheen. Deze helper legt dat uit en
   biedt de ENIGE resterende weg terug — de systeem-app-instellingen
   openen via `Linking.openSettings()` — zodat het altijd vindbaar en
   herstelbaar blijft, ook lang na een eerste "nee". */
async function explainNotificationsBlocked() {
  const ok = await confirmVibezAlert({
    title: 'Notifications are off',
    message:
      "VIBEZCORE can't show reminders or the lock-screen progress for breathwork and bracelet sessions without notification permission. You can turn it back on in your phone's settings, any time.",
    confirmText: 'Open Settings',
    cancelText: 'Not now',
  });
  if (ok) void Linking.openSettings();
}

/* Iter (press-feedback rollout): zelfde druk-vering-recept als
   breath-welcome.tsx's `StartCard` (Apple-getunede 80ms press-in /
   220ms-0.73-dampingRatio release). Eén herbruikbare wrapper i.p.v. het
   per-knop kopiëren van dezelfde vijf hooks, voor de rijen/knoppen op dit
   scherm die dat nog niet hadden. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PressFeedback({
  onPress,
  style,
  children,
  ...rest
}: React.ComponentProps<typeof Pressable> & { children?: React.ReactNode }) {
  const pressScale = useSharedValue(1);
  /* Operator, 4 okt 2026 (smoothness-audit: "geen enkele haptic in dit
     bestand"): `onPressIn` i.p.v. `onPress` — vuurt bij AANRAKING, niet
     pas als de vinger loskomt, dus de voelbare "klik" komt zo vroeg
     mogelijk, zelfde moment als de schaal-animatie hieronder al start.
     Centraal hier gezet zodat élke rij die `PressFeedback` gebruikt dit
     in één keer meekrijgt, i.p.v. per rij te patchen. */
  const onPressIn = () => {
    Haptics.selectionAsync();
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, pressStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

export default function SettingsScreen() {
  const [saveProgress, setSaveProgress] = useSetting('saveProgress');
  const [trackHistory, setTrackHistory] = useSetting('trackHistory');
  const [audioQuality, setAudioQuality] = useSetting('audioQuality');
  /* Iter 9pp: auto-play next session verhuisd van Audio Library
     naar Settings (operator-feedback "library is content-focused,
     preferences horen hier"). */
  const [autoPlayNext, setAutoPlayNext] = useSetting('autoPlayNext');
  const [reminders, setReminders] = useSetting('reminders');
  const [planReminders, setPlanReminders] = useSetting('planReminders');
  const [braceletPlanReminders, setBraceletPlanReminders] = useSetting('braceletPlanReminders');
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
              /* Audit 8 okt 2026: wat de dialoog belooft ("account en
                 abonnement blijven") ook doen — de inlogsessie en de
                 koppeling van een gast-aankoop blijven staan. */
              const KEEP = new Set([
                'vz_last_login_email',
                'vz_session_token',
                'vz_refresh_token',
                'vz_token_expires_at',
                'vz_user_email',
                'vz_auth_provider',
                'vz_guest_purchase_rc_id',
                'vz_pending_rc_link',
              ]);
              const toRemove = allKeys.filter((k) => !KEEP.has(k));
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
              /* Herinneringen staan nu allemaal uit in de instellingen —
                 dan ook de geplande meldingen weg (audit 8 okt 2026). */
              try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                await require('expo-notifications').cancelAllScheduledNotificationsAsync();
              } catch {
                /* swallow */
              }
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
      <Stack.Screen
        options={{
          title: 'Settings',
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
        }}
      />
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
              trackColor={{ false: '#3a3a3a', true: AudioAccent }}
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
              trackColor={{ false: '#3a3a3a', true: AudioAccent }}
              thumbColor="#ffffff"
              ios_backgroundColor="#3a3a3a"
            />
          </View>
          {/* "Audio quality" verwijderd (audit 8 okt 2026): de keuze werd nergens
              gelezen — er bestaat geen lagere kwaliteit om naar te schakelen. */}
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
              trackColor={{ false: '#3a3a3a', true: AudioAccent }}
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
                    if (v && !(await ensurePermission())) {
                      void explainNotificationsBlocked();
                      return;
                    }
                    /* Audit 8 okt 2026: na de toestemmingsvraag de ACTUELE lijst lezen
                       (twee snelle tikken overschreven elkaar), en de eigen tijden +
                       doelen meegeven — anders sprong elke herinnering naar zijn
                       standaarduur met de algemene tekst. */
                    const next = {
                      ...getSetting('reminders'),
                      [reminderKey('breath', slot.slot)]: v,
                    };
                    await setReminders(next);
                    void syncReminders(next, getSetting('reminderAt'), getSetting('goals'));
                  }}
                  trackColor={{ false: '#3a3a3a', true: AudioAccent }}
                  thumbColor="#ffffff"
                  ios_backgroundColor="#3a3a3a"
                />
              </View>
            </View>
          ))}
        </View>

        {/* Operator, 5 okt 2026 ("hoe kan de user deze meldingen afzetten?
            moet echt duidelijk zijn"): de herinneringen van het dagplan
            hadden geen eigen schakelaar — de rijen hierboven gelden enkel
            voor de vaste dagmomenten. */}
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>Plan reminders</Text>
              <Text style={s.rowSub}>
                One reminder for each session in your daily plan. Your plan stays as it is.
              </Text>
            </View>
            <Switch
              value={planReminders}
              onValueChange={async (v) => {
                if (v && !(await ensurePermission())) {
                  void explainNotificationsBlocked();
                  return;
                }
                await setPlanReminders(v);
                void resyncAllPlanReminders();
              }}
              trackColor={{ false: '#3a3a3a', true: AudioAccent }}
              thumbColor="#ffffff"
              ios_backgroundColor="#3a3a3a"
            />
          </View>
        </View>

        <Text style={s.subLabel}>General</Text>
        <View style={s.card}>
          <PressFeedback
            style={s.row}
            /* Operator, 4 okt 2026 (smoothness-audit): was `await
               setSetting(...)` vóór de navigatie — de schermovergang
               wachtte op de AsyncStorage-schrijfactie. `void` i.p.v.
               `await`: de write loopt op de achtergrond door, de
               navigatie gebeurt meteen (zelfde patroon als goal.tsx se
               `onTap`). */
            onPress={() => {
              void setSetting('breathOnboardingCompletedAt', null);
              router.push('/breath-welcome?replay=1' as never);
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
          </PressFeedback>
          {/* Operator, 15 september 2026: een zelfde rij voor de Audio
             Library-intro is hier NIET nodig — die toont zich sinds
             "intro mag zich elke keer tonen" gewoon bij elke montage van
             de tab (zie (tabs)/index.tsx), geen eenmalige vlag meer om te
             resetten. */}
        </View>

        {/* ── STATE CONTROL ────────────────────────────────────────────
            Een State Control-dagplan bestaat voor iedereen (telefoon-
            haptiek), niet enkel voor bracelet-bezitters — dus deze
            schakelaar staat buiten het bracelet-blok. */}
        <Text style={s.sectionLabel}>State Control</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>Plan reminders</Text>
              <Text style={s.rowSub}>
                One reminder for each session in your daily State Control plan. Your plan stays as it is.
              </Text>
            </View>
            <Switch
              value={braceletPlanReminders}
              onValueChange={async (v) => {
                if (v && !(await ensurePermission())) {
                  void explainNotificationsBlocked();
                  return;
                }
                await setBraceletPlanReminders(v);
                void resyncAllPlanReminders();
              }}
              trackColor={{ false: '#3a3a3a', true: AudioAccent }}
              thumbColor="#ffffff"
              ios_backgroundColor="#3a3a3a"
            />
          </View>
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
                        if (v && !(await ensurePermission())) {
                          void explainNotificationsBlocked();
                          return;
                        }
                        /* Audit 8 okt 2026: na de toestemmingsvraag de ACTUELE lijst lezen
                           (twee snelle tikken overschreven elkaar), en de eigen tijden +
                           doelen meegeven — anders sprong elke herinnering naar zijn
                           standaarduur met de algemene tekst. */
                        const next = {
                          ...getSetting('reminders'),
                          [reminderKey('bracelet', slot.slot)]: v,
                        };
                        await setReminders(next);
                        void syncReminders(next, getSetting('reminderAt'), getSetting('goals'));
                      }}
                      trackColor={{ false: '#3a3a3a', true: AudioAccent }}
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
                  trackColor={{ false: '#3a3a3a', true: AudioAccent }}
                  thumbColor="#ffffff"
                  ios_backgroundColor="#3a3a3a"
                />
              </View>
            </View>
          </>
        )}

        <PressFeedback
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
        </PressFeedback>

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
              {/* Operator, 4 okt 2026 (smoothness-audit: "geen haptic,
                 geketende awaits vóór navigatie"): deze 3 rijen gebruikten
                 platte `Pressable` (geen tik-animatie, geen haptic) en
                 `await`-ten elke opslag-write vóór de volgende stap. Nu
                 `PressFeedback` (haptic + schaal-animatie, al centraal
                 gefixt hierboven) en `void` i.p.v. `await` op de writes —
                 de schrijfacties lopen op de achtergrond door, de
                 navigatie/feedback wacht er niet meer op. */}
              <PressFeedback
                style={s.row}
                onPress={() => {
                  void setSetting('breathOnboardingCompletedAt', null);
                  router.push('/breath-welcome?replay=1' as never);
                }}
                accessibilityLabel="Replay breath onboarding"
              >
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>Breath onboarding — opnieuw</Text>
                  <Text style={s.rowSub}>
                    Reset de first-run vlag en opent de onboarding meteen.
                  </Text>
                </View>
              </PressFeedback>
              <View style={s.divider} />
              {/* Operator, 30 september 2026 ("reset onboarding bracelet
                 dan"): zelfde patroon als de breath-onboarding-reset
                 hierboven — enkel `braceletOnboardingCompletedAt` terug op
                 null, geen data wissen. De redirect zelf gebeurt pas bij de
                 eerstvolgende bracelet-CONNECTIE (bracelet-control.tsx),
                 dus deze knop opent niet meteen een scherm — anders dan de
                 breath-versie hierboven, die wél direct linkt. */}
              <PressFeedback
                style={s.row}
                onPress={() => {
                  void setSetting('braceletOnboardingCompletedAt', null);
                }}
                accessibilityLabel="Reset bracelet onboarding"
              >
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>Bracelet onboarding — opnieuw</Text>
                  <Text style={s.rowSub}>
                    Reset de first-run vlag — verschijnt bij de volgende
                    bracelet-connectie.
                  </Text>
                </View>
              </PressFeedback>
              <View style={s.divider} />
              {/* Operator, 17 september 2026 ("hoe kan ik nu telkens opnieuw
                 in dev mode set your goal testen?"): "Clear all local data"
                 wist ALLES (favorieten, historiek, voortgang) — veel te
                 grof voor gewoon de Protocol-flow herhaaldelijk te
                 doorlopen. Dit raakt enkel wat die flow zelf gebruikt:
                 doelen, intensiteit, de proefronde-vlag, dagdeel-voorkeur
                 en het actieve protocol zelf — en opent meteen de vork
                 opnieuw. */}
              <PressFeedback
                style={s.row}
                onPress={() => {
                  void setSetting('goals', []);
                  void setSetting('intensity', null);
                  void setSetting('hasBuiltProtocol', false);
                  const profile = getSetting('profile');
                  void setSetting('profile', { ...profile, preferredSlots: undefined });
                  void clearActivePlan();
                  router.push('/build-choice' as never);
                }}
                accessibilityLabel="Reset protocol flow"
              >
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>Protocol flow — opnieuw</Text>
                  <Text style={s.rowSub}>
                    Wist doelen, intensiteit, dagdeel-voorkeur, de
                    proefronde-vlag en het actieve protocol. Opent meteen
                    "How do you want to build it?".
                  </Text>
                </View>
              </PressFeedback>
            </View>
          </>
        )}

        <PressFeedback
          style={s.backLink}
          onPress={() => router.back()}
          accessibilityLabel="Go back to account"
        >
          <Text style={s.backLinkText}>← Back to Account</Text>
        </PressFeedback>
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
    backgroundColor: `rgba(${ACCENT_TEXT_ON_DARK_RGB},0.08)`,
  },
  label: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  labelActive: {
    color: AudioAccent,
  },
  sub: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  tick: {
    color: AudioAccent,
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
