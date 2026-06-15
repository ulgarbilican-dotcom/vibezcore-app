/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Mock IAP-provider (alleen voor dev)

   Doel: de UI kan tegen dit mock object praten zonder dat react-native-iap
   is geïnstalleerd of dat er native App Store / Play Store-koppeling is.
   Identiek patroon als SimulatedBracelet — eerst de UI bouwen tegen een
   spec-getrouwe simulatie, daarna de echte implementatie inschakelen.

   Wat de mock doet:
     - getProducts() retourneert hardcoded prijzen (USD-equivalent) met een
       waarschuwingsnaam "MOCK" in de title zodat een dev nooit per ongeluk
       deze data in productie publiceert.
     - requestSubscription() simuleert na 800ms een succesvolle aankoop;
       genereert een nep-receipt en transactionId.
     - restorePurchases() retourneert een lege array (geen historie in mock).
     - onPurchase() werkt met een listener-set.

   Niet implementeert:
     - Echte renewal-events (in productie firen die elke maand).
     - User-cancelled scenario — voor handmatige test kun je een tweede
       mock-variant toevoegen of een dev-knop voor "Simuleer cancel".

   Veiligheid:
     - Mock retourneert ALTIJD ok:true. In productie zou dat een security
       issue zijn — daarom: de switch in iap.ts mag MockIAP NOOIT gebruiken
       in een release-build. Zie de USE_MOCK_IAP-guard daar.
   ─────────────────────────────────────────────────────────────────────── */

import {
  IAPProvider,
  IapProduct,
  IapPurchase,
  IapPurchaseResult,
  PRODUCT_IDS,
  AudioTier,
} from './iap-contract';

/** Hardcoded mock-prijzen — reflecteren de launch-strategie (operator-
 *  besluit 2026-06-15 v2, matcht website audio-library-page.html):
 *    Monthly €9,99 (REGULAR strike €12,99) — tussen Headspace en Calm.
 *    Yearly  €69,00 = €5,75/maand — SAVE 42% vs monthly.
 *  Title bevat bewust "MOCK" zodat een dev ziet dat hij niet tegen
 *  echte StoreKit-data praat. In productie komt deze data uit Apple/
 *  Google die de prijs en titel per regio/taal serveren. */
const MOCK_PRODUCTS: IapProduct[] = [
  {
    productId: PRODUCT_IDS.monthly,
    tier: 'monthly',
    title: 'MOCK — VIBEZCORE Audio Monthly',
    description: 'Mock subscription — geen echte aankoop.',
    localizedPrice: '€9,99',
    currency: 'EUR',
    priceAmountMicros: 9_990_000,
    subscriptionPeriod: 'P1M',
  },
  {
    productId: PRODUCT_IDS.yearly,
    tier: 'yearly',
    title: 'MOCK — VIBEZCORE Audio Yearly',
    description: 'Mock subscription — geen echte aankoop.',
    localizedPrice: '€69,00',
    currency: 'EUR',
    priceAmountMicros: 69_000_000,
    subscriptionPeriod: 'P1Y',
  },
];

export class MockIAPProvider implements IAPProvider {
  private listeners = new Set<(p: IapPurchase) => void>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    /* Geen native call — direct ready. Kleine delay simuleert echte
       connection-overhead zodat de UI niet onnatuurlijk snel reageert. */
    await new Promise((r) => setTimeout(r, 50));
    this.initialized = true;
    if (__DEV__) console.log('[MockIAP] initialized');
  }

  async getProducts(): Promise<IapProduct[]> {
    /* Spread zodat callers de MOCK_PRODUCTS-constant niet kunnen muteren. */
    return MOCK_PRODUCTS.map((p) => ({ ...p }));
  }

  async requestSubscription(tier: AudioTier): Promise<IapPurchaseResult> {
    if (__DEV__) console.log('[MockIAP] requestSubscription', tier);
    /* Simuleer native popup met 800ms delay. Echte StoreKit-call zit
       typisch tussen 500ms en 2s afhankelijk van Apple-id check. */
    await new Promise((r) => setTimeout(r, 800));

    const productId = PRODUCT_IDS[tier];
    const purchase: IapPurchase = {
      productId,
      tier,
      transactionId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      receiptToken: `mock_receipt_${productId}_${Date.now()}`,
      purchaseDate: new Date().toISOString(),
      isRestore: false,
    };

    /* Notify alle listeners (zelfde gedrag als echte IAP). */
    this.listeners.forEach((cb) => {
      try {
        cb(purchase);
      } catch (e) {
        if (__DEV__) console.warn('[MockIAP] listener threw:', e);
      }
    });

    return { ok: true, purchase };
  }

  async restorePurchases(): Promise<IapPurchase[]> {
    if (__DEV__) console.log('[MockIAP] restorePurchases — empty');
    /* Mock heeft geen persistente storage van eerdere aankopen. Real-
       wereld zou dit Apple/Google's eigen entitlement-list lezen. */
    return [];
  }

  onPurchase(callback: (purchase: IapPurchase) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  async teardown(): Promise<void> {
    this.listeners.clear();
    this.initialized = false;
    if (__DEV__) console.log('[MockIAP] teardown');
  }
}
