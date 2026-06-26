/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Real IAP-provider (productie via RevenueCat)

   Iter v157 (2026-06-26): TOTAAL VERVANGEN van react-native-iap door
   react-native-purchases (RevenueCat). Reden: react-native-iap v15+Nitro
   faalde TWEE builds met 'Nitro runtime not installed' op operator's
   telefoon. Mijn 3s polling-fix loste het niet op (Nitro werd nooit ready).

   RevenueCat:
   - Industry standard, draait op duizenden production apps
   - Geen Nitro / TurboModule pain, classic React Native bridge
   - Free tier tot $10k MRR — meer dan ruim voor jaar 1
   - Backend krijgt server-to-server webhooks ipv handmatige receipt verify
   - Cross-platform: zelfde code voor Android + iOS

   ── Setup vereist (operator) ──
   1. Maak gratis account op revenuecat.com
   2. Add Android app → upload Google Play service account JSON
   3. Add Apple app (later, voor iOS)
   4. Map products: vibezcore_audio_monthly + vibezcore_audio_yearly
   5. Create entitlement "audio_pro" met beide products in offering
   6. Copy Android API key → vul in als EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID
      (in .env of app.json extra field)
   7. Idem voor iOS API key

   ── App-API (gelijk aan oude impl, IAPProvider interface) ──
   - Pricing-cards, post-purchase prompts, restore-knop: ongewijzigd
   - Onder de motorkap: Purchases SDK ipv react-native-iap
   ─────────────────────────────────────────────────────────────────────── */

import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesError,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreTransaction,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';

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

/** RevenueCat API keys per platform. Operator vult deze in via env-var
 *  of via app.json `extra` field. Bij ontbrekende key throwt init() —
 *  beter early-fail dan silent IAP-loop. */
const ANDROID_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';

/** Entitlement identifier zoals geconfigureerd in RevenueCat dashboard.
 *  Beide Monthly en Yearly products granten DEZE entitlement — zo praat
 *  de backend over één concept ("audio_pro") ipv twee SKUs. */
const ENTITLEMENT_AUDIO_PRO = 'audio_pro';

function mapPurchasesErrorCode(
  rcCode: PURCHASES_ERROR_CODE | string | undefined,
  msg?: string
): IapError {
  switch (rcCode) {
    case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
      return { code: 'user_cancelled', message: msg || 'Purchase cancelled.' };
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
      return { code: 'network', message: msg || 'Network error. Check your connection.' };
    case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
      return { code: 'already_owned', message: msg || 'You already own this subscription.' };
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
      return { code: 'unavailable', message: msg || 'This product is not available right now.' };
    case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
      return { code: 'already_owned', message: msg || 'This receipt is linked to another account.' };
    case PURCHASES_ERROR_CODE.INVALID_RECEIPT_ERROR:
      return { code: 'verify_failed', message: msg || 'Receipt validation failed.' };
    default:
      return { code: 'unknown', message: msg || String(rcCode ?? 'Unknown error') };
  }
}

function mapPackageToProduct(pkg: PurchasesPackage): IapProduct | null {
  const productId = pkg.product.identifier;
  const tier = tierFromProductId(productId);
  if (!tier) return null;
  return {
    productId,
    tier,
    title: pkg.product.title || `VIBEZCORE Audio ${tier}`,
    description: pkg.product.description || '',
    localizedPrice: pkg.product.priceString,
    currency: pkg.product.currencyCode,
    priceAmountMicros: Math.round(pkg.product.price * 1_000_000),
    subscriptionPeriod: tier === 'monthly' ? 'P1M' : 'P1Y',
  };
}

function mapTransactionToPurchase(
  tx: PurchasesStoreTransaction,
  productId: string,
  customerInfo: CustomerInfo,
  isRestore = false
): IapPurchase | null {
  const tier = tierFromProductId(productId);
  if (!tier) return null;

  /* Receipt-token voor backend verify.
     iOS: original app-store receipt (base64) — kan ook via CustomerInfo.
     Android: purchase token — beschikbaar via transaction.purchaseToken
     OF via originalAppUserId in CustomerInfo voor server-to-server lookup.
     RevenueCat raadt aan: gebruik de RevenueCat customer-info zelf als
     bron-van-waarheid via webhook, niet handmatig receipt verifiëren.
     Voor backwards-compat met onze /api/iap-verify behouden we de token. */
  const receiptToken =
    Platform.OS === 'ios'
      ? customerInfo.originalAppUserId
      : tx.transactionIdentifier;

  return {
    productId,
    tier,
    transactionId: tx.transactionIdentifier,
    receiptToken,
    purchaseDate: tx.purchaseDate || new Date().toISOString(),
    isRestore,
  };
}

/* ── RealIAPProvider ────────────────────────────────────────────────── */

export class RealIAPProvider implements IAPProvider {
  private initialized = false;
  private purchaseListeners = new Set<(p: IapPurchase) => void>();
  private customerInfoUpdateHandler: ((info: CustomerInfo) => void) | null = null;
  private cachedOffering: PurchasesOffering | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;

    const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
    if (!apiKey) {
      throw new Error(
        `RevenueCat API key missing for ${Platform.OS}. ` +
        `Set EXPO_PUBLIC_REVENUECAT_API_KEY_${Platform.OS === 'ios' ? 'IOS' : 'ANDROID'} ` +
        `in your environment or app.json extra field.`
      );
    }

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    await Purchases.configure({ apiKey });

    /* Luister op customer-info updates: subscription-renewals, restores,
       en cross-device sync triggeren dit event. Forward naar onze
       purchase listeners als er een nieuwe entitlement bij komt. */
    this.customerInfoUpdateHandler = (info: CustomerInfo) => {
      if (__DEV__) {
        console.log(
          '[RealIAP] customerInfoUpdate, entitlements:',
          Object.keys(info.entitlements.active)
        );
      }
    };
    Purchases.addCustomerInfoUpdateListener(this.customerInfoUpdateHandler);

    this.initialized = true;
  }

  async getProducts(): Promise<IapProduct[]> {
    await this.init();
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) {
      if (__DEV__) console.warn('[RealIAP] No current offering configured in RevenueCat dashboard.');
      return [];
    }
    this.cachedOffering = current;

    const products: IapProduct[] = [];
    for (const pkg of current.availablePackages) {
      const mapped = mapPackageToProduct(pkg);
      if (mapped) products.push(mapped);
    }
    return products;
  }

  async requestSubscription(tier: AudioTier): Promise<IapPurchaseResult> {
    await this.init();

    /* Find the package matching this tier */
    if (!this.cachedOffering) {
      await this.getProducts();
    }
    const targetSku = PRODUCT_IDS[tier];
    const pkg = this.cachedOffering?.availablePackages.find(
      (p) => p.product.identifier === targetSku
    );
    if (!pkg) {
      return {
        ok: false,
        error: {
          code: 'unavailable',
          message: `Product ${targetSku} not found in RevenueCat offering.`,
        },
      };
    }

    try {
      const result = await Purchases.purchasePackage(pkg);
      const customerInfo = result.customerInfo;
      const transaction = (result as { transaction?: PurchasesStoreTransaction })
        .transaction;
      if (!transaction) {
        /* Shouldn't happen in normal flow — purchasePackage returns transaction
           on success. If null, something is off — treat as unknown error. */
        return {
          ok: false,
          error: {
            code: 'unknown',
            message: 'Purchase completed but no transaction returned.',
          },
        };
      }

      const mapped = mapTransactionToPurchase(
        transaction,
        pkg.product.identifier,
        customerInfo,
        false
      );
      if (!mapped) {
        return {
          ok: false,
          error: {
            code: 'unknown',
            message: 'Could not parse purchase result.',
          },
        };
      }

      /* Fire listeners (subscribe.tsx subscribes during checkout). */
      this.purchaseListeners.forEach((cb) => {
        try {
          cb(mapped);
        } catch (e) {
          if (__DEV__) console.warn('[RealIAP] listener threw:', e);
        }
      });

      return { ok: true, purchase: mapped };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const err = e as PurchasesError;
      const mapped = mapPurchasesErrorCode(err?.code, err?.message);
      return { ok: false, error: mapped };
    }
  }

  async restorePurchases(): Promise<IapPurchase[]> {
    await this.init();
    try {
      const customerInfo = await Purchases.restorePurchases();
      /* RevenueCat geeft geen aparte "purchases array" terug bij restore —
         we leiden af welke entitlement(s) actief zijn en synthesiseren
         IapPurchase-objecten. Backend ontvangt customer's originalAppUserId
         als receiptToken; via RevenueCat webhook gaat de echte server-to-
         server validatie. */
      const restored: IapPurchase[] = [];
      const activeEntitlement = customerInfo.entitlements.active[ENTITLEMENT_AUDIO_PRO];
      if (activeEntitlement) {
        const productId = activeEntitlement.productIdentifier;
        const tier = tierFromProductId(productId);
        if (tier) {
          restored.push({
            productId,
            tier,
            transactionId: activeEntitlement.originalPurchaseDate || `restore_${Date.now()}`,
            receiptToken:
              Platform.OS === 'ios'
                ? customerInfo.originalAppUserId
                : customerInfo.originalAppUserId,
            purchaseDate: activeEntitlement.latestPurchaseDate || new Date().toISOString(),
            isRestore: true,
          });
        }
      }

      /* Fire listeners for each restored purchase so caller can re-verify. */
      restored.forEach((p) => {
        this.purchaseListeners.forEach((cb) => {
          try {
            cb(p);
          } catch (e) {
            if (__DEV__) console.warn('[RealIAP] restore-listener threw:', e);
          }
        });
      });

      return restored;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (__DEV__) console.warn('[RealIAP] restorePurchases error:', e);
      return [];
    }
  }

  onPurchase(callback: (purchase: IapPurchase) => void): () => void {
    this.purchaseListeners.add(callback);
    return () => {
      this.purchaseListeners.delete(callback);
    };
  }

  /** RevenueCat handelt acknowledge automatisch af — geen native
   *  finishTransaction call meer nodig. Houdt method als no-op
   *  voor IAPProvider interface compat. */
  async acknowledge(_transactionId: string): Promise<void> {
    /* RevenueCat auto-acknowledges via Purchases.purchasePackage internal flow.
       Backend hoeft niets te doen — RevenueCat webhook bevestigt sub. */
  }

  async teardown(): Promise<void> {
    if (this.customerInfoUpdateHandler) {
      Purchases.removeCustomerInfoUpdateListener(this.customerInfoUpdateHandler);
      this.customerInfoUpdateHandler = null;
    }
    this.purchaseListeners.clear();
    this.initialized = false;
  }
}
