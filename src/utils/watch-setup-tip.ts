/* 1 nov 2026 (operator: "met Stille modus + Prominent voel je de haptics veel beter — hoe maken we dat onmiddellijk duidelijk?"): Apple laat
   geen app naar de Instellingen van het horloge springen (enkel verborgen links, die tot afwijzing leiden: richtlijn 2.5.1). Daarom één keer,
   bij de eerste sessie met een Apple Watch, een korte kaart met de drie instellingen. De sessie start gewoon eronder. Met Stille modus valt
   ook de toon bij de sterke tikken weg. Altijd terug te vinden in Profile › Apple Watch: Silent & Haptics.

   Daarnaast (1 nov 2026, operator: "zodra het scherm dimt geen haptics meer, de seconden lopen achter"): met het scherm gedimd tikt de Apple
   Watch ENKEL tijdens een workoutsessie (Apple), en die start enkel met HealthKit-toestemming voor Workouts. Bij elke sessiestart met een
   horloge: nog niet beslist → Apple's vraag tonen; geweigerd → een duidelijke kaart met de weg ernaartoe (één keer per app-start). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { showVibezAlert } from '@/components/VibezAlert';
import { getSetting } from '@/utils/settings';
import { getAppleWatchStatus, getWorkoutPermission, requestWorkoutPermission, type WorkoutPermission } from '../../modules/watch-breath';
import { getWatchStatus } from '../../modules/wear-breath';

const KEY = 'vz_watch_setup_tip_v1';
/** Galaxy/Wear OS: één keer "open de app één keer op je horloge" (2 nov 2026). */
const WEAR_FIRST_KEY = 'vz_wear_first_open_tip_v1';

/** Onder de sterkte-keuze (Audio & Haptics). 1 nov 2026 (operator: "ook op de telefoon duidelijk maken waar die sterktes op de smartwatch
 *  staan, ik wist dat zelf niet te vinden"): Apple Watch heeft een eigen pagina; de Galaxy Watch volgt gewoon de telefoon. */
export const STRENGTH_NOTE =
  Platform.OS === 'ios'
    ? 'Strong is the default. Change it for this session only, or remember it. On your Apple Watch: open VIBEZCORE › Haptics.'
    : 'Strong is the default. Change it for this session only, or remember it. On your watch: open VIBEZCORE › Haptics.';
let busy = false;
let deniedShownThisLaunch = false;
/** "Not now" op de Apple Health-kaart: niet bij elke sessie opnieuw vragen, wel na een nieuwe app-start. */
let healthAskedThisLaunch = false;

/* 10 nov 2026 (App Review 2.5.1, build 89: "does not clearly identify the HealthKit functionality in the app's user interface"): de
   uitleg verscheen enkel met een gekoppelde Apple Watch, dus Apple zag ze nooit. Nu één vaste tekst, op drie plekken: de vaste regel
   "Apple Health" in Profile (altijd zichtbaar op de iPhone), de kaart vóór Apple's eigen toestemmingsvraag, en de uitlegkaart. */
export const APPLE_HEALTH_PURPOSE =
  'VIBEZCORE uses Apple Health (HealthKit) for one thing only: to start a Mind & Body workout session on your Apple Watch while your Breathwork or State Control session runs. That keeps the taps on your wrist going while the watch screen is dimmed.\n\nVIBEZCORE does not read any health data and does not save workouts or any other data to Apple Health.';

/** Uitleg Apple Health + status + de juiste knop (Profile › Apple Health). Geeft de nieuwe status terug na "Allow". */
export async function showAppleHealthInfo(): Promise<WorkoutPermission> {
  const perm = await getWorkoutPermission();
  if (perm === 'unavailable') {
    await showVibezAlert({
      title: 'Apple Health',
      message: APPLE_HEALTH_PURPOSE + '\n\nApple Health is not available on this device.',
      buttons: [{ text: 'OK', style: 'primary' }],
    });
    return perm;
  }
  const status =
    perm === 'granted'
      ? 'Workouts: allowed.'
      : perm === 'denied'
        ? 'Workouts: not allowed. You can change this in iPhone Settings › Privacy & Security › Health › VIBEZCORE.'
        : 'Workouts: not set yet.';
  if (perm === 'notDetermined') {
    const idx = await showVibezAlert({
      title: 'Apple Health',
      message: APPLE_HEALTH_PURPOSE + '\n\n' + status,
      buttons: [
        { text: 'Allow Workouts', style: 'primary' },
        { text: 'Not now', style: 'cancel' },
      ],
    });
    return idx === 0 ? requestWorkoutPermission() : perm;
  }
  await showVibezAlert({
    title: 'Apple Health',
    message: APPLE_HEALTH_PURPOSE + '\n\n' + status,
    buttons: [
      { text: 'Manage in Settings', style: 'primary', onPress: () => void Linking.openSettings().catch(() => {}) },
      { text: 'OK', style: 'cancel' },
    ],
  });
  return perm;
}

/** De uitleg zelf, op elk moment op te roepen (Profile, Audio & Haptics, eerste sessie). 1 nov 2026 (operator: "wie iets wegklikt bij de
 *  eerste sessie, moet de info nadien gemakkelijk en duidelijk kunnen vinden"): ontbreekt de toestemming voor Workouts, dan staat die als
 *  eerste stap bovenaan, met Open Settings. */
export function showWatchSetupInfo(): void {
  void (async () => {
    const perm = Platform.OS === 'ios' ? await getWorkoutPermission() : 'unavailable';
    const needsWorkouts = perm === 'denied' || perm === 'notDetermined';
    const watchSteps =
      'On your Apple Watch, open Settings › Sounds & Haptics:\n1. Silent Mode: on\n2. Haptics: Prominent\n3. System Haptics: on\n\nSilent Mode keeps the taps and drops the sound.\n\nBreathwork on your wrist: inhale = fast taps going up, hold = slow single taps, exhale = steady taps going down.\n\nIn VIBEZCORE on your watch, tap Haptics to choose Strong or Medium and to learn the breath taps. Strong is the default; your choice stays until you change it.';
    const workoutsStep =
      'First, so your watch keeps tapping with the screen dimmed:\niPhone Settings › Privacy & Security › Health › VIBEZCORE › Workouts: on\n(No workout or health data is read or saved.)\n\n';
    void showVibezAlert({
      title: 'Feel every tap on your wrist',
      message: (needsWorkouts ? workoutsStep : '') + watchSteps,
      buttons: needsWorkouts
        ? [
            { text: 'Open Settings', style: 'primary', onPress: () => void Linking.openSettings().catch(() => {}) },
            { text: 'Got it', style: 'cancel' },
          ]
        : [{ text: 'Got it', style: 'primary' }],
    });
  })();
}

function showWorkoutsDenied(): void {
  void showVibezAlert({
    title: 'Allow Workouts for VIBEZCORE',
    message:
      'Your Apple Watch only keeps tapping with the screen dimmed during a workout session. Allow it once:\n\niPhone Settings › Privacy & Security › Health › VIBEZCORE › Workouts: on\n\nNo workout or health data is read or saved.',
    buttons: [
      { text: 'Open Settings', style: 'primary', onPress: () => void Linking.openSettings().catch(() => {}) },
      { text: 'Not now', style: 'cancel' },
    ],
  });
}

/* 2 nov 2026 (operator, Galaxy Watch: "bij de eerste run hoorde ik de haptics maar het horloge bleef op het vergrendelscherm"): een
   horloge-app die nog nooit geopend werd, mag van Android geen scherm vanzelf openen (de tikken lopen wel). Eén keer, bij de eerste sessie
   met een Wear OS-horloge, één zin. De iPhone opent de Watch-app zelf; daar is dit niet nodig. */
async function maybeShowWearFirstOpenTip(): Promise<void> {
  if (!getSetting('watchHaptics')) return;
  if ((await AsyncStorage.getItem(WEAR_FIRST_KEY)) === '1') return;
  const st = await getWatchStatus();
  if (st.status !== 'ready') return;
  await AsyncStorage.setItem(WEAR_FIRST_KEY, '1');
  void showVibezAlert({
    title: 'First time with your watch?',
    message: 'Open VIBEZCORE once on your watch. After that, every session you start here also opens on your wrist.',
    buttons: [{ text: 'Got it', style: 'primary' }],
  });
}

/** Bij elke sessiestart met een gekoppeld horloge. */
export async function maybeShowWatchSetupTip(): Promise<void> {
  if (busy) return;
  if (Platform.OS === 'android') {
    busy = true;
    try {
      await maybeShowWearFirstOpenTip();
    } catch {
      /* een tip mag een sessie nooit tegenhouden */
    } finally {
      busy = false;
    }
    return;
  }
  if (Platform.OS !== 'ios') return;
  busy = true;
  try {
    if (!getSetting('watchHaptics')) return;
    const st = await getAppleWatchStatus();
    if (st.status !== 'ready') return;
    let perm = await getWorkoutPermission();
    if (perm === 'notDetermined') {
      if (healthAskedThisLaunch) return;
      healthAskedThisLaunch = true;
      /* 10 nov 2026 (App Review 2.5.1): eerst in eigen woorden zeggen dat het om Apple Health gaat en waarvoor, dan pas Apple's vraag. */
      const idx = await showVibezAlert({
        title: 'Apple Health',
        message: APPLE_HEALTH_PURPOSE + '\n\nApple will ask you next. You can change this anytime in Profile › Apple Health.',
        buttons: [
          { text: 'Continue', style: 'primary' },
          { text: 'Not now', style: 'cancel' },
        ],
      });
      if (idx !== 0) return;
      perm = await requestWorkoutPermission();
    }
    if (perm === 'denied') {
      if (!deniedShownThisLaunch) {
        deniedShownThisLaunch = true;
        showWorkoutsDenied();
      }
      return;
    }
    if ((await AsyncStorage.getItem(KEY)) === '1') return;
    await AsyncStorage.setItem(KEY, '1');
    showWatchSetupInfo();
  } catch {
    /* een tip mag een sessie nooit tegenhouden */
  } finally {
    busy = false;
  }
}
