/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Real IAP-provider (productie via react-native-iap)

   Iter 9dq v85 (2026-06-03): forward-prep skeleton. Vereist installatie
   van `react-native-iap`:

       npx expo install react-native-iap
       npx expo prebuild        # genereert ios/ en android/ folders
       cd ios && pod install    # iOS-side; alleen op macOS

   Daarna in services/iap.ts:
       export const USE_MOCK_IAP = false;   // was __DEV__
       import { RealIAPProvider } from './iap-real';   // uncomment

   TypeScript-noot: zolang react-native-iap NIET geïnstalleerd is, geeft
   de import op regel ~50 een "Cannot find module"-error. Dat is correct
   gedrag — dit bestand WORDT bewust niet geladen in de huidige bundle
   omdat USE_MOCK_IAP=true. Pas wanneer je de switch flipt en de library
   installeert, valt deze error weg.

   ── Wat dit bestand doet ──
   - Implementeert IAPProvider-interface (zie iap-contract.ts).
   - Mapt react-native-iap's eigen types naar onze IapProduct / IapPurchase.
   - Verbergt platform-verschillen achter de interface (StoreKit vs Play
     Billing).
   - Geeft cancelled / network / unavailable errors door via IapError.

   ── Wat dit NIET doet ──
   - Backend receipt-verify. Dat is een aparte fetch naar
     /api/iap-verify die het subscribe-screen doet nadat onPurchase
     fired (zie subscribe.tsx).
   - Persistente sub-state cache. Die zit in useSubscription.ts.

   ── Apple sandbox-testing ──
   Maak een sandbox-tester aan in App Store Connect → Users and Access →
   Sandbox Testers. Op iOS Settings → App Store → Sandbox Account →
   inloggen. Vanaf dan: `requestSubscription` opent de echte StoreKit
   popup maar rekent geen geld af. Receipts zijn echt en kunnen door je
   backend gevalideerd worden tegen Apple's sandbox-verify endpoint.

   ── Google Play testing ──
   App Console → Setup → License testing → email toevoegen. Daarna kun
   je test-purchases doen met die Google-account zonder geld uit te
   geven.
   ─────────────────────────────────────────────────────────────────────── */

import { Platform } from 'react-native';
/* TODO: uncomment wanneer react-native-iap is geïnstalleerd.
   Zonder package gooit deze import een TS-error wat correct gedrag is —
   dit bestand wordt momenteel niet uit iap.ts geïmporteerd.

import {
  endConnection,
  finishTransaction,
  getSubscriptions,
  initConnection,
  PurchaseError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestSubscription,
  type Subscription as RNIapSubscription,
  type SubscriptionPurchase,
} from 'react-native-iap';
*/

import {
  IAPProvider,
  IapProduct,
  IapPurchase,
  IapPurchaseResult,
  PRODUCT_IDS,
  AudioTier,
  tierFromProductId,
} from './iap-contract';

/* ── Hulp: react-native-iap types → onze IapProduct ──
   Subscription-shape verschilt iets per platform. Op iOS heeft 'm
   `localizedPrice` direct, op Android zit dat in subscriptionOfferDetails.
   Helper-functies pakken het juiste veld. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToIapProduct(raw: any): IapProduct | null {
  const productId = raw?.productId;
  if (typeof productId !== 'string') return null;
  const tier = tierFromProductId(productId);
  if (!tier) return null;

  /* iOS: raw.localizedPrice + raw.currency */
  /* Android: raw.subscriptionOfferDetails[0].pricingPhases.pricingPhaseList[0].formattedPrice */
  let localizedPrice = '';
  let currency = '';
  let priceAmountMicros: number | undefined;

  if (Platform.OS === 'ios') {
    localizedPrice = typeof raw.localizedPrice === 'string' ? raw.localizedPrice : '';
    currency = typeof raw.currency === 'string' ? raw.currency : '';
    priceAmountMicros =
      typeof raw.price === 'string'
        ? Math.round(parseFloat(raw.price) * 1_000_000)
        : undefined;
  } else {
    const offer = raw?.subscriptionOfferDetails?.[0];
    const phase = offer?.pricingPhases?.pricingPhaseList?.[0];
    localizedPrice = typeof phase?.formattedPrice === 'string' ? phase.formattedPrice : '';
    currency = typeof phase?.priceCurrencyCode === 'string' ? phase.priceCurrencyCode : '';
    priceAmountMicros =
      typeof phase?.priceAmountMicros === 'string'
        ? parseInt(phase.priceAmountMicros, 10)
        : undefined;
  }

  return {
    productId,
    tier,
    title: typeof raw.title === 'string' ? raw.title : `VIBEZCORE Audio ${tier}`,
    description: typeof raw.description === 'string' ? raw.description : '',
    localizedPrice,
    currency,
    priceAmountMicros,
    subscriptionPeriod: tier === 'monthly' ? 'P1M' : 'P1Y',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToIapPurchase(raw: any, isRestore = false): IapPurchase | null {
  const productId = raw?.productId;
  if (typeof productId !== 'string') return null;
  const tier = tierFromProductId(productId);
  if (!tier) return null;

  /* iOS: raw.transactionReceipt (base64 receipt voor backend)
     Android: raw.purchaseToken (Google Play purchase token) */
  let receiptToken = '';
  if (Platform.OS === 'ios') {
    receiptToken = typeof raw.transactionReceipt === 'string' ? raw.transactionReceipt : '';
  } else {
    receiptToken = typeof raw.purchaseToken === 'string' ? raw.purchaseToken : '';
  }

  return {
    productId,
    tier,
    transactionId:
      typeof raw.transactionId === 'string'
        ? raw.transactionId
        : `${Platform.OS}_${Date.now()}`,
    receiptToken,
    purchaseDate:
      typeof raw.transactionDate === 'number'
        ? new Date(raw.transactionDate).toISOString()
        : new Date().toISOString(),
    isRestore,
  };
}

/* ── RealIAPProvider ────────────────────────────────────────────────── */

export class RealIAPProvider implements IAPProvider {
  private initialized = false;
  private purchaseListeners = new Set<(p: IapPurchase) => void>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private purchaseSub: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private errorSub: any = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    /* TODO uncomment wanneer react-native-iap aanwezig is:
       await initConnection();
       this.purchaseSub = purchaseUpdatedListener((purchase) => {
         const mapped = mapToIapPurchase(purchase, false);
         if (mapped) {
           this.purchaseListeners.forEach((cb) => {
             try { cb(mapped); } catch (e) { if (__DEV__) console.warn('[RealIAP] listener threw:', e); }
           });
         }
         finishTransaction({ purchase, isConsumable: false }).catch(() => {});
       });
       this.errorSub = purchaseErrorListener((err: PurchaseError) => {
         if (__DEV__) console.warn('[RealIAP] purchase error:', err);
       });
    */
    this.initialized = true;
    if (__DEV__) {
      console.warn(
        '[RealIAP] init() called but react-native-iap is not wired in yet — ' +
          'see iap-real.ts top-of-file installation steps.'
      );
    }
  }

  async getProducts(): Promise<IapProduct[]> {
    await this.init();
    /* TODO uncomment:
       const raws: RNIapSubscription[] = await getSubscriptions({
         skus: [PRODUCT_IDS.monthly, PRODUCT_IDS.yearly],
       });
       return raws.map(mapToIapProduct).filter((p): p is IapProduct => p !== null);
    */
    /* Fallback — geeft lege array zodat UI niet crasht maar er staan
       geen subs te koop. Pricing-cards tonen dan placeholder-prijzen. */
    return [];
  }

  async requestSubscription(tier: AudioTier): Promise<IapPurchaseResult> {
    await this.init();
    const sku = PRODUCT_IDS[tier];
    /* TODO uncomment:
       try {
         const result = await requestSubscription({
           sku,
           ...(Platform.OS === 'android' ? { subscriptionOffers: [{ sku, offerToken: '' }] } : {}),
         });
         // requestSubscription returns void of een purchase op iOS; Android
         // fired alleen via de purchaseUpdatedListener. Op iOS leveren we
         // het direct terug.
         if (result && !Array.isArray(result)) {
           const mapped = mapToIapPurchase(result, false);
           if (mapped) return { ok: true, purchase: mapped };
         }
         // Android: wacht op listener. Returnt een "in-progress"-stub —
         // de subscribe-screen subscribed op onPurchase voor het echte
         // event.
         return {
           ok: false,
           error: { code: 'unknown', message: 'Purchase initiated — waiting for confirmation event.' },
         };
       } catch (e: any) {
         const code = e?.code;
         if (code === 'E_USER_CANCELLED') {
           return { ok: false, error: { code: 'user_cancelled', message: 'Cancelled by user.' } };
         }
         if (code === 'E_NETWORK_ERROR') {
           return { ok: false, error: { code: 'network', message: 'Network error.' } };
         }
         if (code === 'E_ALREADY_OWNED') {
           return { ok: false, error: { code: 'already_owned', message: 'You already own this subscription.' } };
         }
         return {
           ok: false,
           error: { code: 'unknown', message: e?.message ?? String(e) },
         };
       }
    */
    return {
      ok: false,
      error: {
        code: 'unavailable',
        message: 'react-native-iap is not installed yet. See services/iap-real.ts for setup steps.',
      },
    };
  }

  async restorePurchases(): Promise<IapPurchase[]> {
    await this.init();
    /* TODO uncomment:
       const purchases: SubscriptionPurchase[] = await getAvailablePurchases();
       return purchases
         .map((p) => mapToIapPurchase(p, true))
         .filter((p): p is IapPurchase => p !== null);
    */
    return [];
  }

  onPurchase(callback: (purchase: IapPurchase) => void): () => void {
    this.purchaseListeners.add(callback);
    return () => {
      this.purchaseListeners.delete(callback);
    };
  }

  async teardown(): Promise<void> {
    /* TODO uncomment:
       try { this.purchaseSub?.remove(); } catch {}
       try { this.errorSub?.remove(); } catch {}
       try { await endConnection(); } catch {}
    */
    this.purchaseListeners.clear();
    this.initialized = false;
  }
}
