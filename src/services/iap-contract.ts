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

     vibezcore_audio_monthly   — maandelijks abonnement
     vibezcore_audio_yearly    — jaarlijks abonnement

   IDs zijn EXACT zoals in Google Play Console aangemaakt (2026-06-19/20).
   App vraagt deze IDs op via BillingClient.queryProductDetails — als ze
   niet matchen, krijgt user "Product unavailable" error en kan niet kopen.

   Beide moeten 1:1 worden aangemaakt in:
     - App Store Connect → My Apps → VIBEZCORE → Features → Subscriptions
     - Google Play Console → Monetisation → Subscriptions

   Display-naam en beschrijving zijn per-locale (NL/EN/DE/FR/ES). Prijs
   wordt per-regio bepaald door één base-tier — Apple/Google handelen
   alle 175+ valuta's en lokale BTW af.

   App TOONT NOOIT de product-ID aan de user — alleen de localizedPrice +
   localized title die Apple/Google teruggeven.
   ─────────────────────────────────────────────────────────────────────── */

import { Platform } from 'react-native';

/** Wat VIBEZCORE Premium aanbiedt (operator, 16 okt 2026): maand- en
 *  jaarabonnement (automatisch verlengend) en een dagpas — een losse
 *  aankoop die 24 uur alles opent. De 7-dagen-trial is vervallen. */
export type AudioTier = 'monthly' | 'yearly' | 'day';

/** Abonnementen (verlengen automatisch), zonder de dagpas. */
export type SubscriptionTier = 'monthly' | 'yearly';

/** Hoe lang een dagpas alles opent, gerekend vanaf de aankoop. */
export const DAY_PASS_MS = 24 * 60 * 60 * 1000;

/** Product-IDs zoals in de stores aangemaakt. Het iOS-jaarabonnement heeft
 *  een eigen ID: `vibezcore_audio_yearly` werd op 16 okt 2026 in App Store
 *  Connect verwijderd en Apple laat een verwijderde ID nooit opnieuw toe.
 *  Android houdt `vibezcore_audio_yearly`. De dagpas heet op beide stores
 *  `vibezcore_day_pass` (verbruiksartikel, herhaalbaar). */
const IOS_YEARLY_ID = 'vibezcore_premium_yearly';
const ANDROID_YEARLY_ID = 'vibezcore_audio_yearly';
export const DAY_PASS_PRODUCT_ID = 'vibezcore_day_pass';

export const PRODUCT_IDS: Record<AudioTier, string> = {
  monthly: 'vibezcore_audio_monthly',
  yearly: Platform.OS === 'ios' ? IOS_YEARLY_ID : ANDROID_YEARLY_ID,
  day: DAY_PASS_PRODUCT_ID,
};

/** Reverse lookup product-ID → tier-label. Herkent ook de ID van het andere
 *  platform (wie op Android kocht en op iPhone inlogt).
 *
 *  Iter v158 (2026-06-26): RevenueCat formatteert Play Store products als
 *  `<product_id>:<base_plan_id>` (bv. 'vibezcore_audio_yearly:yearly').
 *  We strippen die suffix voordat we matchen, zodat de RevenueCat product
 *  identifier én de raw Play Store SKU beide werken. */
export function tierFromProductId(productId: string): AudioTier | null {
  const baseSku = productId.split(':')[0];
  if (baseSku === PRODUCT_IDS.monthly) return 'monthly';
  if (baseSku === IOS_YEARLY_ID || baseSku === ANDROID_YEARLY_ID) return 'yearly';
  if (baseSku === DAY_PASS_PRODUCT_ID) return 'day';
  return null;
}

/** Welk abonnement is dit recht? (27 okt 2026, operator: "Premium" zonder periode in Profiel.) Eerst de bekende product-ID's,
 *  dan woorden in de naam, en als laatste de looptijd van de lopende periode (aankoop → einde): ~1 maand of ~1 jaar. Zo krijgt ook
 *  een product met een onverwachte naam (andere base plan, later toegevoegd product) toch het juiste label. Anders `undefined`. */
export function subscriptionTierFromEntitlement(
  productId: string | undefined | null,
  periodStartIso?: string | null,
  periodEndIso?: string | null,
): SubscriptionTier | undefined {
  if (productId) {
    const known = tierFromProductId(productId);
    if (known === 'monthly' || known === 'yearly') return known;
    const id = productId.toLowerCase();
    if (/year|annual/.test(id)) return 'yearly';
    if (/month/.test(id)) return 'monthly';
  }
  const start = periodStartIso ? Date.parse(periodStartIso) : NaN;
  const end = periodEndIso ? Date.parse(periodEndIso) : NaN;
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    const days = (end - start) / 86_400_000;
    if (days >= 25 && days <= 40) return 'monthly';
    if (days >= 330 && days <= 400) return 'yearly';
  }
  return undefined;
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
   *  ISO 8601 duration format, zelfde op iOS en Android. Leeg bij de
   *  dagpas (geen abonnement). */
  subscriptionPeriod?: string;
  /** Gratis proefdagen, RECHTSTREEKS uit de store (operator, 8 augustus
   *  2026: 7 dagen trial op het jaarplan, geconfigureerd in Play Console).
   *  Alleen gezet als Google/Apple een gratis eerste fase meldt voor DEZE
   *  klant — wie zijn trial al gebruikt heeft, krijgt hem ook niet te zien.
   *  Undefined = geen trial, en dan toont geen enkel scherm er één. */
  freeTrialDays?: number;
  /** Iter v163 (2026-06-27): regular (non-intro) prijs als strikethrough
   *  display. Komt direct uit Google's pricingPhases (laatste fase na
   *  intro-12m). Werkt in alle valuta's want Google geeft localized
   *  prices terug. Undefined als product geen intro-aanbieding heeft
   *  voor deze klant (License Tester, of intro al verlopen). */
  regularPriceLabel?: string;
  /** Numerieke regular prijs in micro-units, voor berekeningen. */
  regularPriceMicros?: number;
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

  /** Iter v148 (2026-06-25): expliciete acknowledge na backend verify.
   *  Roept native finishTransaction() / acknowledgePurchase() aan zodat
   *  Google Play / Apple weten dat onze backend de aankoop heeft verwerkt.
   *
   *  KRITIEK: deze MOET binnen 3 dagen na de purchase aangeroepen worden,
   *  anders refundt Google Play automatisch. Voorheen werd dit direct in
   *  de purchaseUpdatedListener gedaan, vóór backend verify — daardoor
   *  verloor Google Play z'n retry-mechanisme als verify daarna faalde.
   *
   *  Idempotent: dubbele acknowledge calls op zelfde transactionId zijn
   *  no-ops. Errors worden geswallowed (de aankoop is bij ons al geldig
   *  in de DB; acknowledge-failure is non-fatal voor de user). */
  acknowledge(transactionId: string): Promise<void>;

  /** Sluit de native store-connectie. Roepen op app-unmount of bij
   *  expliciete teardown. Niet kritisch — OS ruimt anders op. */
  teardown(): Promise<void>;
}
