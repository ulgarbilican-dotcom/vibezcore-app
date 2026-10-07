/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Version tracker (fresh state op build-upgrade)
   Iter v159 (2026-06-26)

   Operator-spec: 'force fresh AsyncStorage bij build-upgrade' tijdens
   deze fase, zodat elke nieuwe build die op de tester-telefoon landt
   een echte fresh-user ervaring geeft (geen cached email, geen
   bewaarde Supabase session). Voorkomt het 'ulgarbilican@gmail.com
   staat ingevuld na update'-effect.

   Werking:
   - Bij app-startup vergelijken we de huidige nativeBuildVersion
     (Expo Constants) met de waarde die we vorige keer hebben
     opgeslagen onder LAST_VERSION_KEY.
   - Als de versie is veranderd (incl. eerste install) → roep
     clearSession() aan zodat alle Supabase auth keys + onze eigen
     email-cache leeg gaan. Dat retoucheert de welkomstscherm-flow
     en de Sign in form heeft niets meer voor-ingevuld.
   - Daarna schrijven we de huidige versie weer op zodat de volgende
     startup binnen dezelfde build geen sign-out triggert.

   Wat we NIET wissen:
   - History, favorites, voorkeuren, voice-toggle, breathwork
     instellingen. Dat zijn user-eigen keuzes die per build vers
     beginnen onlogisch zou voelen.

   Verwijderbaar later:
   - Wanneer de app uit de actieve test-fase is en updates niet meer
     elke versie wijzigingen testen, kan deze logica weg (of de flag
     uit gezet worden) zodat updates de session bewaren zoals normale
     production apps doen.
   ─────────────────────────────────────────────────────────────────────── */

import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSession } from './auth';

const LAST_VERSION_KEY = 'vz_last_seen_build_version';

function getCurrentVersion(): string {
  /* nativeBuildVersion = Android versionCode / iOS build number.
     Verandert bij elke EAS-build, zelfs als marketing-version (1.0.0)
     hetzelfde blijft. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (Constants as any)?.nativeBuildVersion ??
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (Constants as any)?.expoConfig?.version ??
            'unknown';
  return String(v);
}

/** Roept clearSession() aan als de app-build is veranderd sinds vorige
 *  startup. Idempotent — meerdere calls binnen één startup doen niets
 *  meer na de eerste. */
export async function clearSessionIfBuildChanged(): Promise<void> {
  /* Operator, 7 okt 2026 (account-audit): enkel nog in testbuilds. In een
     store-build logde dit iedereen uit bij elke update — en RevenueCat was
     op dat moment nog niet geconfigureerd, dus die bleef op de vorige
     gebruiker staan. Normale apps bewaren de sessie over updates heen. */
  if (!__DEV__) return;
  try {
    const current = getCurrentVersion();
    const last = await AsyncStorage.getItem(LAST_VERSION_KEY);
    if (last === current) return;
    if (__DEV__) {
      console.log(
        `[version-tracker] build change detected: ${last ?? '(none)'} → ${current}. ` +
        `Clearing session for fresh state.`,
      );
    }
    await clearSession();
    await AsyncStorage.setItem(LAST_VERSION_KEY, current);
  } catch (e) {
    if (__DEV__) {
      console.warn('[version-tracker] failed:', e);
    }
    /* swallow — startup mag nooit breken door deze check */
  }
}
