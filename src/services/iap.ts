/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — IAP service (singleton-toegang)

   Zelfde patroon als services/bracelet.ts: één switch (USE_MOCK_IAP)
   bepaalt of de MockIAPProvider of de RealIAPProvider (= react-native-iap)
   geladen wordt. De rest van de app praat uitsluitend met de
   IAPProvider-interface — UI/business-logica veranderen NIET wanneer
   we van mock naar real switchen.

   Iter 9dq v58 (2026-06-03): basis-skeleton voor IAP-migratie. Mock-
   implementatie is af; Real wordt geleverd zodra react-native-iap
   geïnstalleerd is (vereist `expo prebuild` + native rebuild). De
   pricing-block in (tabs)/index.tsx kan tegen deze service worden
   geherbouwd zonder dat de echte library aanwezig is.

   ── Roadmap naar real-IAP ──
     1. `npx expo install react-native-iap`
     2. Voeg het als plugin toe in app.json (sectie "plugins").
     3. `npx expo prebuild` om ios/android folders te genereren.
     4. Schrijf RealIAPProvider in services/iap-real.ts.
     5. Zet USE_MOCK_IAP = false hieronder (of laat het op `__DEV__`
        zodat dev-builds mock blijven).
     6. iOS: handmatig Sandbox-test-account aanmaken in App Store
        Connect → Users → Sandbox Testers. Aanmelden in iOS Settings
        → App Store → Sandbox Account. Daarmee kun je echte StoreKit-
        calls testen zonder geld uit te geven.
     7. Android: `internal testing track` op Play Console + tester-emails.

   App Store Connect / Play Console moeten Producten hebben met IDs:
     com.ubili.vibezcoreapp.audio.monthly
     com.ubili.vibezcoreapp.audio.yearly
   (zie iap-contract.ts voor de centrale PRODUCT_IDS const.)
   ─────────────────────────────────────────────────────────────────────── */

import type { IAPProvider } from './iap-contract';
import { MockIAPProvider } from './iap-mock';

/** Switch: in dev (en zolang react-native-iap nog niet geïnstalleerd is)
 *  staat dit op true. Bij productie-release moet 'ie naar false ÉN moet
 *  RealIAPProvider geïmporteerd worden uit iap-real.ts.
 *
 *  Bewust hardcoded op `__DEV__` zodat een release-build per ongeluk
 *  NIET de mock gebruikt — mock retourneert altijd ok:true en zou een
 *  gratis subscription opleveren in productie. */
export const USE_MOCK_IAP = __DEV__;

let instance: IAPProvider | null = null;

/** Lazy-singleton: bouw de provider bij eerste aanvraag, hergebruik daarna. */
export function getIAP(): IAPProvider {
  if (instance) return instance;
  if (USE_MOCK_IAP) {
    instance = new MockIAPProvider();
  } else {
    /* TODO (release-blocker): hier komt RealIAPProvider.
       Voorlopig fallback op mock zodat de app niet crasht wanneer
       USE_MOCK_IAP per ongeluk op false staat tijdens dev.

       Wanneer iap-real.ts bestaat, vervangt dit blok:
         instance = new RealIAPProvider();
    */
    if (__DEV__) {
      console.warn(
        '[IAP] USE_MOCK_IAP=false maar RealIAPProvider nog niet ingebouwd — terugval op mock.'
      );
    }
    instance = new MockIAPProvider();
  }
  return instance;
}

/** Reset-helper voor tests. Niet gebruiken in productie-code. */
export function _resetIAPInstanceForTests(): void {
  if (instance) {
    instance.teardown().catch(() => {});
    instance = null;
  }
}
