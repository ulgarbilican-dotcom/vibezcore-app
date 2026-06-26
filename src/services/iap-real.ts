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
import {
  endConnection,
  ErrorCode,
  finishTransaction,
  getAvailablePurchases,
  getSubscriptions,
  initConnection,
  type PurchaseError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestSubscription,
} from 'react-native-iap';

/* Iter v153 (2026-06-25): downgrade van v15.3.1 → v12.16.3. v15 vereiste
   react-native-nitro-modules die in Expo SDK 55 niet correct linked
   waardoor IAP altijd faalde met 'Nitro runtime not installed' op
   gebruiker's telefoon. v12 is de laatste pre-Nitro stable release —
   gebruikt classic React Native bridge, bewezen werkt zonder extra setup.
   API verschilt: requestSubscription dedicated method (niet requestPurchase
   met type:'subs'), getSubscriptions ipv fetchProducts. */

import {
  IAPProvider,
  IapError,
  IapProduct,
  IapPurchase,
  IapPurchaseResult,
  PRODUCT_IDS,
  AudioTier,
  tierFromProductId,
} from './iap-contract';

/** Centrale mapper van react-native-iap ErrorCode → onze IapError shape.
 *  Wordt gebruikt door zowel het sync requestPurchase catch-pad als het
 *  Android purchaseErrorListener-pad zodat het foutgedrag consistent is
 *  ongeacht waar de error binnenkomt. */
function mapErrorCode(code: unknown, message?: string): IapError {
  const msg = typeof message === 'string' && message.length > 0 ? message : '';
  if (code === ErrorCode.E_USER_CANCELLED) {
    return { code: 'user_cancelled', message: msg || 'Cancelled by user.' };
  }
  if (code === ErrorCode.E_NETWORK_ERROR) {
    return { code: 'network', message: msg || 'Network error.' };
  }
  if (code === ErrorCode.E_ALREADY_OWNED) {
    return { code: 'already_owned', message: msg || 'You already own this subscription.' };
  }
  if (code === ErrorCode.E_ITEM_UNAVAILABLE) {
    return { code: 'unavailable', message: msg || 'This product is not available right now.' };
  }
  return { code: 'unknown', message: msg || String(code ?? 'Unknown error') };
}

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
  private errorListeners = new Set<(e: IapError) => void>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private purchaseSub: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private errorSub: any = null;
  /* Iter v148: bewaar raw-purchase-objecten per transactionId zodat
     acknowledge() (na backend verify) kan finishTransaction() aanroepen. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingPurchases = new Map<string, any>();

  async init(): Promise<void> {
    if (this.initialized) return;
    await initConnection();
    this.purchaseSub = purchaseUpdatedListener((purchase) => {
      const mapped = mapToIapPurchase(purchase, false);
      if (mapped) {
        /* Iter v148 (2026-06-25, KRITIEKE FIX): bewaar raw-purchase
           naar mapped so caller kan finishTransaction() expliciet
           aanroepen NA backend verify. Voorheen werd finishTransaction
           direct hier gecalled, wat het Google Play retry-mechanisme
           verbrak: als backend verify daarna faalde, dan was Google
           Play al "acknowledged" en de user kreeg geen refund-retry +
           wij hadden geen subscription. Nu: finish pas na succesvolle
           server-side activation. */
        this.pendingPurchases.set(mapped.transactionId, purchase);
        this.purchaseListeners.forEach((cb) => {
          try {
            cb(mapped);
          } catch (e) {
            if (__DEV__) console.warn('[RealIAP] listener threw:', e);
          }
        });
      }
    });
    this.errorSub = purchaseErrorListener((err: PurchaseError) => {
      if (__DEV__) console.warn('[RealIAP] purchase error:', err);
      const mapped = mapErrorCode(err?.code, err?.message);
      this.errorListeners.forEach((cb) => {
        try {
          cb(mapped);
        } catch (e) {
          if (__DEV__) console.warn('[RealIAP] error-listener threw:', e);
        }
      });
    });
    this.initialized = true;
  }

  async getProducts(): Promise<IapProduct[]> {
    await this.init();
    /* Iter v153 (2026-06-25): v12 API — getSubscriptions voor recurring
       subscriptions (vs getProducts voor one-time). Accepteert {skus}. */
    const raws = await getSubscriptions({
      skus: [PRODUCT_IDS.monthly, PRODUCT_IDS.yearly],
    });
    if (!raws) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (raws as any[])
      .map((r) => mapToIapProduct(r))
      .filter((p): p is IapProduct => p !== null);
  }

  async requestSubscription(tier: AudioTier): Promise<IapPurchaseResult> {
    await this.init();
    const sku = PRODUCT_IDS[tier];

    /* Iter v153 (2026-06-25): v12 API — requestSubscription dedicated
       method (in v15 was dit unified onder requestPurchase met type:'subs').
       Android: typisch null return + event via purchaseUpdatedListener.
       iOS: kan direct Purchase resolved promise. */

    let androidOfferToken = '';
    if (Platform.OS === 'android') {
      const subs = await getSubscriptions({ skus: [sku] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = (subs as any[] | null)?.[0];
      androidOfferToken =
        sub?.subscriptionOfferDetails?.[0]?.offerToken ?? '';
    }

    /* v12 requestSubscription signature: takes {sku} en optioneel
       Android-specifieke subscriptionOffers. Geen type-veld zoals v15. */
    const requestArgs =
      Platform.OS === 'android'
        ? {
            sku,
            subscriptionOffers: [{ sku, offerToken: androidOfferToken }],
          }
        : { sku };

    /* Android: wacht op listener (purchase OF error event). Timeout van 5 min
       voorkomt dat de Promise eeuwig blijft hangen wanneer beide listeners
       om een of andere reden niet vuren. */
    if (Platform.OS === 'android') {
      return new Promise<IapPurchaseResult>((resolve) => {
        let settled = false;
        const settle = (r: IapPurchaseResult) => {
          if (settled) return;
          settled = true;
          unsubPurchase();
          unsubError();
          clearTimeout(timeoutId);
          resolve(r);
        };

        const purchaseCb = (p: IapPurchase) => {
          if (p.tier !== tier) return;
          settle({ ok: true, purchase: p });
        };
        const errorCb = (e: IapError) => {
          settle({ ok: false, error: e });
        };

        this.purchaseListeners.add(purchaseCb);
        this.errorListeners.add(errorCb);
        const unsubPurchase = () => this.purchaseListeners.delete(purchaseCb);
        const unsubError = () => this.errorListeners.delete(errorCb);

        const timeoutId = setTimeout(() => {
          settle({
            ok: false,
            error: { code: 'unknown', message: 'Purchase timed out — please try again.' },
          });
        }, 5 * 60 * 1000);

        /* Fire-and-forget: het echte resultaat komt via de listeners. Sync
           errors (zoals user_cancelled bij sommige Android-versies) catchen we
           hier en routeren naar settle(). */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (requestSubscription as any)(requestArgs).catch((e: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const err = e as any;
          const mapped = mapErrorCode(err?.code, err?.message);
          settle({ ok: false, error: mapped });
        });
      });
    }

    /* iOS-pad: behoudt de oude synchrone-await flow. */
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (requestSubscription as any)(requestArgs);
      if (result && !Array.isArray(result)) {
        const mapped = mapToIapPurchase(result, false);
        if (mapped) return { ok: true, purchase: mapped };
      }
      return {
        ok: false,
        error: {
          code: 'unknown',
          message: 'Purchase initiated — waiting for confirmation event.',
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const mapped = mapErrorCode(e?.code, e?.message ?? String(e));
      return { ok: false, error: mapped };
    }
  }

  /** Iter v148 (2026-06-25): finishTransaction NA backend verify, niet
   *  ervoor. Caller (subscribe.tsx verifyAndComplete) roept dit aan
   *  zodra de receipt server-side gevalideerd + subscription active is.
   *
   *  Bewaarde raw-purchase wordt uit pendingPurchases gehaald en
   *  doorgegeven aan finishTransaction. Bij ontbrekend object (race
   *  condition, app-restart) doen we niets — Google Play retried dan
   *  automatisch tot we het opnieuw zien. */
  async acknowledge(transactionId: string): Promise<void> {
    const raw = this.pendingPurchases.get(transactionId);
    if (!raw) return;
    try {
      await finishTransaction({ purchase: raw, isConsumable: false });
      this.pendingPurchases.delete(transactionId);
    } catch (e) {
      if (__DEV__) console.warn('[RealIAP] acknowledge failed:', e);
      /* Non-fatal: backend heeft de aankoop al, user is PRO. Google
         Play retried 'm gewoon de volgende keer dat onze app
         purchaseUpdatedListener triggert. */
    }
  }

  async restorePurchases(): Promise<IapPurchase[]> {
    await this.init();
    const purchases = await getAvailablePurchases();
    if (!purchases) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (purchases as any[])
      .map((p) => mapToIapPurchase(p, true))
      .filter((p): p is IapPurchase => p !== null);
  }

  onPurchase(callback: (purchase: IapPurchase) => void): () => void {
    this.purchaseListeners.add(callback);
    return () => {
      this.purchaseListeners.delete(callback);
    };
  }

  async teardown(): Promise<void> {
    try {
      this.purchaseSub?.remove();
    } catch {}
    try {
      this.errorSub?.remove();
    } catch {}
    try {
      await endConnection();
    } catch {}
    this.purchaseListeners.clear();
    this.initialized = false;
  }
}
