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
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  type PurchaseError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'react-native-iap';

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
  if (code === ErrorCode.UserCancelled) {
    return { code: 'user_cancelled', message: msg || 'Cancelled by user.' };
  }
  if (code === ErrorCode.NetworkError) {
    return { code: 'network', message: msg || 'Network error.' };
  }
  if (code === ErrorCode.AlreadyOwned) {
    return { code: 'already_owned', message: msg || 'You already own this subscription.' };
  }
  if (code === ErrorCode.ItemUnavailable || code === ErrorCode.SkuNotFound) {
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

  async init(): Promise<void> {
    if (this.initialized) return;
    await initConnection();
    this.purchaseSub = purchaseUpdatedListener((purchase) => {
      const mapped = mapToIapPurchase(purchase, false);
      if (mapped) {
        this.purchaseListeners.forEach((cb) => {
          try {
            cb(mapped);
          } catch (e) {
            if (__DEV__) console.warn('[RealIAP] listener threw:', e);
          }
        });
      }
      /* finishTransaction acknowledged het purchase bij de store. Voor
         non-consumables (subscriptions) is dat verplicht binnen 3 dagen
         anders refundt de store automatisch. */
      finishTransaction({ purchase, isConsumable: false }).catch(() => {});
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
    /* v15 API: fetchProducts vervangt getSubscriptions. type:'subs' = abos. */
    const raws = await fetchProducts({
      skus: [PRODUCT_IDS.monthly, PRODUCT_IDS.yearly],
      type: 'subs',
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

    /* v15 API: requestPurchase initieert de native popup.
       - iOS: kan een Purchase-object DIRECT returneren via de awaited promise.
       - Android: returnt typisch null/void — de echte purchase arriveert via
         purchaseUpdatedListener (en errors via purchaseErrorListener).

       Fix v141 (2026-06-23): voor Android wachten we op het listener-event
       voordat we returnen. Anders zag de caller {ok:false} terwijl de gebruiker
       wel degelijk de "Subscribe"-knop in de Google Play dialog tikte → "Something
       went wrong"-melding bovenop een succesvolle aankoop. Operator-gerapporteerd
       2026-06-23. */

    let androidOfferToken = '';
    if (Platform.OS === 'android') {
      const subs = await fetchProducts({ skus: [sku], type: 'subs' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = (subs as any[] | null)?.[0];
      androidOfferToken =
        sub?.subscriptionOfferDetails?.[0]?.offerToken ?? '';
    }

    const requestArgs = {
      request: {
        ...(Platform.OS === 'ios' ? { ios: { sku } } : {}),
        ...(Platform.OS === 'android'
          ? {
              android: {
                skus: [sku],
                subscriptionOffers: [
                  { sku, offerToken: androidOfferToken },
                ],
              },
            }
          : {}),
      },
      type: 'subs' as const,
    };

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
        requestPurchase(requestArgs).catch((e: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const err = e as any;
          const mapped = mapErrorCode(err?.code, err?.message);
          settle({ ok: false, error: mapped });
        });
      });
    }

    /* iOS-pad: behoudt de oude synchrone-await flow. */
    try {
      const result = await requestPurchase(requestArgs);
      if (result && !Array.isArray(result)) {
        const mapped = mapToIapPurchase(result, false);
        if (mapped) return { ok: true, purchase: mapped };
      }
      /* iOS zou hier niet mogen komen — listener fallback voor safety. */
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
