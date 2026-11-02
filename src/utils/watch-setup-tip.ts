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
import { getAppleWatchStatus, getWorkoutPermission, requestWorkoutPermission } from '../../modules/watch-breath';

const KEY = 'vz_watch_setup_tip_v1';

/** Onder de sterkte-keuze (Audio & Haptics). 1 nov 2026 (operator: "ook op de telefoon duidelijk maken waar die sterktes op de smartwatch
 *  staan, ik wist dat zelf niet te vinden"): Apple Watch heeft een eigen pagina; de Galaxy Watch volgt gewoon de telefoon. */
export const STRENGTH_NOTE =
  Platform.OS === 'ios'
    ? 'Strong is the default. Change it for this session only, or remember it. On your Apple Watch: open VIBEZCORE › Haptics.'
    : 'Strong is the default. Change it for this session only, or remember it. Your watch follows what you remember.';
let busy = false;
let deniedShownThisLaunch = false;

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

/** Bij elke sessiestart met een gekoppelde Apple Watch. */
export async function maybeShowWatchSetupTip(): Promise<void> {
  if (Platform.OS !== 'ios' || busy) return;
  busy = true;
  try {
    if (!getSetting('watchHaptics')) return;
    const st = await getAppleWatchStatus();
    if (st.status !== 'ready') return;
    let perm = await getWorkoutPermission();
    if (perm === 'notDetermined') perm = await requestWorkoutPermission();
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
