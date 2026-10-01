/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — useIAP hook

   React-laag bovenop services/iap.ts. Verzorgt:
     - Lazy provider-init bij eerste useIAP() in de boom.
     - Product-lijst-fetch (caches in module-state zodat alle consumers
       dezelfde response delen — geen N parallelle StoreKit-calls).
     - purchase(tier): start IAP-popup, geeft success/error terug.
     - restore(): triggert Apple/Google restore-purchases.

   Patroon volgt useSubscription.ts / useFavorites.ts: module-level state
   + listener-set zodat meerdere consumers (pricing-block, subscribe-
   screen, account-tab) tegelijk re-renderen na een aankoop.
   ─────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from 'react';
import { getIAP } from '@/services/iap';
import type {
  AudioTier,
  IapProduct,
  IapPurchase,
  IapPurchaseResult,
} from '@/services/iap-contract';

/* ── Module-level cache + listeners ───────────────────────────────────── */
let productsCache: IapProduct[] | null = null;
let productsLoading = false;
let productsLoadPromise: Promise<IapProduct[]> | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;
const productsListeners = new Set<() => void>();
const purchaseListeners = new Set<(p: IapPurchase) => void>();

function notifyProducts(): void {
  setTimeout(() => {
    productsListeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        if (__DEV__) console.warn('[useIAP] product-listener threw:', e);
      }
    });
  }, 0);
}

async function ensureInit(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const iap = getIAP();
      await iap.init();
      /* Subscribe op alle purchase-events ÉÉN keer hier op module-niveau.
         Individual hooks subscriben hierop via purchaseListeners. */
      iap.onPurchase((purchase) => {
        setTimeout(() => {
          purchaseListeners.forEach((cb) => {
            try {
              cb(purchase);
            } catch (e) {
              if (__DEV__) console.warn('[useIAP] purchase-listener threw:', e);
            }
          });
        }, 0);
      });
      initialized = true;
    } catch (e) {
      if (__DEV__) console.warn('[useIAP] init failed:', e);
      /* Niet als initialized markeren — volgende mount probeert opnieuw. */
      initPromise = null;
      throw e;
    }
  })();
  return initPromise;
}

async function loadProducts(): Promise<IapProduct[]> {
  if (productsCache) return productsCache;
  if (productsLoadPromise) return productsLoadPromise;
  productsLoading = true;
  notifyProducts();
  productsLoadPromise = (async () => {
    try {
      await ensureInit();
      const iap = getIAP();
      const products = await iap.getProducts();
      productsCache = products;
      return products;
    } finally {
      productsLoading = false;
      productsLoadPromise = null;
      notifyProducts();
    }
  })();
  return productsLoadPromise;
}

/* ── Public hook ──────────────────────────────────────────────────────── */

export function useIAP() {
  const [products, setProducts] = useState<IapProduct[] | null>(productsCache);
  const [loading, setLoading] = useState<boolean>(productsLoading);

  useEffect(() => {
    let cancelled = false;
    const listener = () => {
      if (cancelled) return;
      setProducts(productsCache);
      setLoading(productsLoading);
    };
    productsListeners.add(listener);

    /* Trigger eerste load wanneer nog niet geladen. Subsequent mounts
       hergebruiken de cache zonder nieuwe call. */
    if (!productsCache && !productsLoadPromise) {
      loadProducts().catch(() => {
        /* Silent — listener-set verwerkt de loading=false transition al. */
      });
    } else {
      /* Cache aanwezig, direct doorgeven. */
      listener();
    }

    return () => {
      cancelled = true;
      productsListeners.delete(listener);
    };
  }, []);

  /** Refresh products — bv. wanneer App-state terugkomt van background
   *  en je wilt zeker zijn dat StoreKit nog levert. */
  const refresh = useCallback(async () => {
    productsCache = null;
    productsLoadPromise = null;
    await loadProducts();
  }, []);

  /** Start checkout voor één tier. Returnt het resultaat (ok/error).
   *  De backend-verificatie van de receipt is NIET hier — dat doet de
   *  caller (subscribe-screen) zodat 'ie kan reageren op verify-fail
   *  apart van native cancel. */
  const purchase = useCallback(
    async (tier: AudioTier): Promise<IapPurchaseResult> => {
      try {
        await ensureInit();
        const iap = getIAP();
        return await iap.requestSubscription(tier);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          ok: false,
          error: { code: 'unknown', message: msg },
        };
      }
    },
    [],
  );

  /** Restore eerdere aankopen voor de current Apple/Google account.
   *  Verplicht voor App Store-approval (knop in Account-tab). */
  const restore = useCallback(async (): Promise<IapPurchase[]> => {
    try {
      await ensureInit();
      const iap = getIAP();
      return await iap.restorePurchases();
    } catch (e) {
      if (__DEV__) console.warn('[useIAP] restore failed:', e);
      return [];
    }
  }, []);

  /** Subscribe op purchase-events buiten de purchase()-call (bv. silent
   *  renewals, restore-events). Returnt unsubscribe-functie. */
  const onPurchase = useCallback((cb: (p: IapPurchase) => void): (() => void) => {
    purchaseListeners.add(cb);
    return () => {
      purchaseListeners.delete(cb);
    };
  }, []);

  return {
    products,
    loading,
    refresh,
    purchase,
    restore,
    onPurchase,
    /** Helper voor pricing-cards: vind product per tier. */
    getProduct: (tier: AudioTier): IapProduct | undefined =>
      products?.find((p) => p.tier === tier),
  };
}
