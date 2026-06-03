/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — IAP contract (single source of truth voor de IAP-laag)

   Apple StoreKit + Google Play Billing zijn de enige toegestane payment-
   providers voor digitale audio-subscriptions op iOS / Android (Apple-
   regel sinds altijd, Google sinds Play Store policy 2020+). Gumroad
   blijft uitsluitend voor het FYSIEKE bracelet-product (Oura-pattern,
   exempt van IAP).

   Architectuur (kopie van het BraceletTransport-patroon in
   ble-contract.ts):
     - Eén abstract IAPProvider-interface.
     - MockIAP-implementatie voor dev (geen native code nodig).
     - RealIAP-implementatie voor productie (wrapt react-native-iap).
     - Schakelaar USE_MOCK_IAP in services/iap.ts.

   App-laag praat ALLEEN met de interface. Pricing-cards, post-purchase
   account-prompt, restore-purchases-knop — geen van die schermen weet
   of MockIAP of RealIAP eronder zit.

   ── Product-IDs ──
   We declareren TWEE auto-renewing subscription products:

     com.ubili.vibezcoreapp.audio.monthly   — maandelijks abonnement
     com.ubili.vibezcoreapp.audio.yearly    — jaarlijks abonnement

   Beide moeten 1:1 worden aangemaakt in:
     - App Store Connect → My Apps → VIBEZCORE → Features → Subscriptions
     - Google Play Console → Monetisation → Subscriptions

   Display-naam en beschrijving zijn per-locale (NL/EN/DE/FR/ES). Prijs
   wordt per-regio bepaald door één base-tier — Apple/Google handelen
   alle 175+ valuta's en lokale BTW af.

   App TOONT NOOIT de product-ID aan de user — alleen de localizedPrice +
   localized title die Apple/Google teruggeven.
   ─────────────────────────────────────────────────────────────────────── */

/** De twee tiers die VIBEZCORE Audio aanbiedt. */
export type AudioTier = 'monthly' | 'yearly';

/** Product-IDs. Identiek op iOS én Android voor één codebase. */
export const PRODUCT_IDS: Record<AudioTier, string> = {
  monthly: 'com.ubili.vibezcoreapp.audio.monthly',
  yearly: 'com.ubili.vibezcoreapp.audio.yearly',
};

/** Reverse lookup product-ID → tier-label. Handig voor receipt-parsing. */
export function tierFromProductId(productId: string): AudioTier | null {
  for (const [tier, id] of Object.entries(PRODUCT_IDS) as [
    AudioTier,
    string,
  ][]) {
    if (id === productId) return tier;
  }
  return null;
}

/** Wat de UI nodig heeft om een pricing-card te renderen.
 *  `localizedPrice` is een al-opgemaakte string ("€10,99", "$9.99", "¥1.500")
 *  die we van StoreKit / Google Play Billing krijgen — eindgebruiker ziet
 *  letterlijk wat hier in staat. */
export type IapProduct = {
  productId: string;
  tier: AudioTier;
  title: string; // Apple/Google display-name in lokale taal
  description: string; // Apple/Google description in lokale taal
  localizedPrice: string; // Al-opgemaakte string met valutasymbool
  currency: string; // ISO-code, bv. 'EUR', 'USD' — voor analytics
  /** Numerieke prijs in micro-units (1.000.000 = 1.00 in de valuta). */
  priceAmountMicros?: number;
  /** Per-platform subscription-period: 'P1M' (monthly) of 'P1Y' (yearly).
   *  ISO 8601 duration format, zelfde op iOS en Android. */
  subscriptionPeriod?: string;
};

/** Wat een purchase-event aan de app oplevert. Backend krijgt de
 *  `receiptToken` om bij Apple/Google te valideren. */
export type IapPurchase = {
  productId: string;
  tier: AudioTier;
  transactionId: string;
  /** Apple: base64 receipt. Google: purchase token. Backend verify
   *  endpoint switch op platform. */
  receiptToken: string;
  /** ISO 8601 datum waarop de aankoop is gedaan (door provider gezet). */
  purchaseDate: string;
  /** True wanneer dit een restore is (eerder gekocht, nu opnieuw geladen
   *  via Restore Purchases). False bij verse aankoop. */
  isRestore: boolean;
};

/** Resultaat van een aankoop-poging. */
export type IapPurchaseResult =
  | { ok: true; purchase: IapPurchase }
  | { ok: false; error: IapError };

export type IapError = {
  code:
    | 'user_cancelled'
    | 'network'
    | 'unavailable'
    | 'already_owned'
    | 'verify_failed'
    | 'unknown';
  message: string;
};

/** De interface die elke IAP-implementatie moet leveren. */
export interface IAPProvider {
  /** Connecteer met de native store. Mag meermaals geroepen worden — moet
   *  idempotent zijn. Op iOS opent StoreKit-connection; op Android start
   *  BillingClient. */
  init(): Promise<void>;

  /** Laad product-details (prijs in lokale valuta, titel, beschrijving).
   *  Resultaat is wat de pricing-cards renderen. */
  getProducts(): Promise<IapProduct[]>;

  /** Start checkout voor één tier. Toont de native IAP-popup. Resolves
   *  met success of error (inclusief user_cancelled wanneer user de
   *  popup wegdoet). */
  requestSubscription(tier: AudioTier): Promise<IapPurchaseResult>;

  /** Restore eerdere aankopen voor de huidige Apple/Google account.
   *  Gebruikt voor "Restore Purchases"-knop in Account-tab — verplicht
   *  voor App Store-approval. */
  restorePurchases(): Promise<IapPurchase[]>;

  /** Subscribe op alle purchase-events. Wordt gefired bij:
   *    - verse aankoop (na requestSubscription success)
   *    - restore (na restorePurchases)
   *    - subscription-renewal (silent, achtergrond) [iOS/Android verschilt]
   *  Returnt unsubscribe-functie. */
  onPurchase(callback: (purchase: IapPurchase) => void): () => void;

  /** Sluit de native store-connectie. Roepen op app-unmount of bij
   *  expliciete teardown. Niet kritisch — OS ruimt anders op. */
  teardown(): Promise<void>;
}
