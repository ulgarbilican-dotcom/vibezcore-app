/* Producten en prijzen (services/iap-contract.ts, iap-mock.ts, iap-real.ts).
   Operator, 16 okt 2026: dag EUR 1,29 / maand EUR 9,99 / jaar EUR 69,99;
   dagpas = losse aankoop (geen abonnement), 24 uur alles open, NIET aan het
   Pro-entitlement gekoppeld. iOS-jaar-ID = vibezcore_premium_yearly. */

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {},
  LOG_LEVEL: {},
  PURCHASES_ERROR_CODE: {},
  STORE_REPLACEMENT_MODE: {},
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

type Contract = typeof import('@/services/iap-contract');

function contractFor(os: 'ios' | 'android'): Contract {
  let mod: Contract | undefined;
  jest.isolateModules(() => {
    const RN = require('react-native');
    Object.defineProperty(RN.Platform, 'OS', { get: () => os, configurable: true });
    mod = require('@/services/iap-contract') as Contract;
  });
  return mod!;
}

const ios = contractFor('ios');
const android = contractFor('android');

describe('product-IDs per platform', () => {
  test('maand en dagpas: zelfde ID op iOS en Android', () => {
    expect(ios.PRODUCT_IDS.monthly).toBe('vibezcore_audio_monthly');
    expect(android.PRODUCT_IDS.monthly).toBe('vibezcore_audio_monthly');
    expect(ios.PRODUCT_IDS.day).toBe('vibezcore_day_pass');
    expect(android.PRODUCT_IDS.day).toBe('vibezcore_day_pass');
    expect(ios.DAY_PASS_PRODUCT_ID).toBe(ios.PRODUCT_IDS.day);
  });

  test('jaar: eigen iOS-ID (verwijderde ASC-ID nooit hergebruiken), Android houdt de oude', () => {
    expect(ios.PRODUCT_IDS.yearly).toBe('vibezcore_premium_yearly');
    expect(android.PRODUCT_IDS.yearly).toBe('vibezcore_audio_yearly');
  });

  test('drie verschillende producten per platform', () => {
    for (const c of [ios, android]) {
      const ids = Object.values(c.PRODUCT_IDS);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
    }
  });
});

describe('tierFromProductId herkent ook het andere platform (kopen op Android, inloggen op iPhone)', () => {
  const cases: [string, string][] = [
    ['vibezcore_audio_monthly', 'monthly'],
    ['vibezcore_audio_yearly', 'yearly'],
    ['vibezcore_premium_yearly', 'yearly'],
    ['vibezcore_day_pass', 'day'],
    /* RevenueCat-formaat voor Play: <product>:<base plan> */
    ['vibezcore_audio_yearly:yearly', 'yearly'],
    ['vibezcore_audio_monthly:monthly', 'monthly'],
  ];
  test.each(cases)('%s -> %s (iOS en Android)', (id, tier) => {
    expect(ios.tierFromProductId(id)).toBe(tier);
    expect(android.tierFromProductId(id)).toBe(tier);
  });

  test('onbekende ID -> null (geen stille toegang)', () => {
    expect(ios.tierFromProductId('vibezcore_audio_lifetime')).toBeNull();
    expect(android.tierFromProductId('')).toBeNull();
  });

  test('elke PRODUCT_IDS-waarde mapt terug op zijn eigen tier', () => {
    for (const c of [ios, android]) {
      for (const [tier, id] of Object.entries(c.PRODUCT_IDS)) {
        expect(c.tierFromProductId(id)).toBe(tier);
      }
    }
  });
});

test('dagpas duurt precies 24 uur', () => {
  expect(ios.DAY_PASS_MS).toBe(24 * 60 * 60 * 1000);
});

describe('prijzen (dev-mock = operator-prijzen)', () => {
  test('dag 1,29 / maand 9,99 / jaar 69,99 EUR; dagpas zonder abonnementsperiode', async () => {
    const { MockIAPProvider } = require('@/services/iap-mock');
    const products = await new MockIAPProvider().getProducts();
    const byTier = Object.fromEntries(products.map((p: any) => [p.tier, p]));
    expect(Object.keys(byTier).sort()).toEqual(['day', 'monthly', 'yearly']);
    expect(byTier.day.priceAmountMicros).toBe(1_290_000);
    expect(byTier.monthly.priceAmountMicros).toBe(9_990_000);
    expect(byTier.yearly.priceAmountMicros).toBe(69_990_000);
    expect(byTier.monthly.subscriptionPeriod).toBe('P1M');
    expect(byTier.yearly.subscriptionPeriod).toBe('P1Y');
    expect(byTier.day.subscriptionPeriod).toBeUndefined();
    /* trial vervallen (16 okt) */
    for (const p of products) expect(p.freeTrialDays).toBeUndefined();
  });

  test('fallback-prijs op de Day Pass-kaart = 1.29', () => {
    const fs = require('fs');
    const path = require('path');
    const src: string = fs.readFileSync(path.join(__dirname, '../../src/components/SalesNudgeHost.tsx'), 'utf8');
    expect(src).toMatch(/DAY_PASS_FALLBACK_PRICE = '€1[.,]29'/);
  });
});

describe('activeDayPass (iap-real): 24 uur vanaf de laatste aankoop', () => {
  const { activeDayPass } = require('@/services/iap-real') as typeof import('@/services/iap-real');
  const H = 60 * 60 * 1000;
  const T = Date.UTC(2026, 9, 20, 10, 0, 0);
  const tx = (id: string, at: number, txId = 't' + at) => ({
    productIdentifier: id,
    purchaseDate: new Date(at).toISOString(),
    transactionIdentifier: txId,
  });
  const info = (txs: any[]) => ({ nonSubscriptionTransactions: txs }) as any;

  test('geen klantinfo / geen aankopen -> geen pas', () => {
    expect(activeDayPass(null, T)).toBeNull();
    expect(activeDayPass(info([]), T)).toBeNull();
  });

  test('geldig tot precies 24 u na aankoop, daarna dicht', () => {
    const ci = info([tx('vibezcore_day_pass', T)]);
    expect(activeDayPass(ci, T + 1)).toEqual({
      purchaseDate: new Date(T).toISOString(),
      validUntil: new Date(T + 24 * H).toISOString(),
      transactionId: 't' + T,
    });
    expect(activeDayPass(ci, T + 24 * H - 1)).not.toBeNull();
    expect(activeDayPass(ci, T + 24 * H)).toBeNull();
  });

  test('de LAATSTE aankoop telt (tweede pas verlengt niet optellend maar vanaf nieuwe aankoop)', () => {
    const ci = info([tx('vibezcore_day_pass', T), tx('vibezcore_day_pass', T + 20 * H)]);
    const r = activeDayPass(ci, T + 30 * H);
    expect(r?.validUntil).toBe(new Date(T + 44 * H).toISOString());
  });

  test('andere losse aankopen tellen niet als dagpas', () => {
    expect(activeDayPass(info([tx('vibezcore_beads_set', T)]), T + H)).toBeNull();
  });

  test('RevenueCat-suffix wordt herkend; kapotte datum genegeerd', () => {
    expect(activeDayPass(info([tx('vibezcore_day_pass:daypass', T)]), T + H)).not.toBeNull();
    expect(
      activeDayPass(info([{ productIdentifier: 'vibezcore_day_pass', purchaseDate: 'x', transactionIdentifier: 'b' }]), T),
    ).toBeNull();
  });
});
