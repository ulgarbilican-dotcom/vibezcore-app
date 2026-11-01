/* 1 nov 2026 (operator: "met Stille modus + Prominent voel je de haptics veel beter — hoe maken we dat onmiddellijk duidelijk?"): Apple laat
   geen app naar de Instellingen van het horloge springen (enkel verborgen links, die tot afwijzing leiden: richtlijn 2.5.1). Daarom één keer,
   bij de eerste sessie met een Apple Watch, een korte kaart met de drie instellingen. De sessie start gewoon eronder. Met Stille modus valt
   ook de toon bij de sterke tikken weg. Altijd terug te vinden in Settings › Feel it on your Apple Watch. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { showVibezAlert } from '@/components/VibezAlert';
import { getSetting } from '@/utils/settings';
import { getAppleWatchStatus } from '../../modules/watch-breath';

const KEY = 'vz_watch_setup_tip_v1';
let busy = false;

/** De uitleg zelf, op elk moment op te roepen. */
export function showWatchSetupInfo(): void {
  void showVibezAlert({
    title: 'Feel every tap on your wrist',
    message:
      'On your Apple Watch, open Settings › Sounds & Haptics:\n\n1. Silent Mode: on\n2. Haptics: Prominent\n3. System Haptics: on\n\nSilent Mode keeps the taps and drops the sound.\n\nIn VIBEZCORE on your watch, tap Haptics to choose Strong or Medium and to feel the breath taps. Strong is the default; your choice stays until you change it.',
    buttons: [{ text: 'Got it', style: 'primary' }],
  });
}

/** Eerste sessie met een gekoppelde Apple Watch: de uitleg één keer tonen. */
export async function maybeShowWatchSetupTip(): Promise<void> {
  if (Platform.OS !== 'ios' || busy) return;
  busy = true;
  try {
    if (!getSetting('watchHaptics')) return;
    if ((await AsyncStorage.getItem(KEY)) === '1') return;
    const st = await getAppleWatchStatus();
    if (st.status !== 'ready') return;
    await AsyncStorage.setItem(KEY, '1');
    showWatchSetupInfo();
  } catch {
    /* een tip mag een sessie nooit tegenhouden */
  } finally {
    busy = false;
  }
}
