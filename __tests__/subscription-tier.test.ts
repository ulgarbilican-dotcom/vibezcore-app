/* Welk abonnement is een actief recht? Ook een product met een onverwachte naam krijgt het juiste label via de looptijd
   (27 okt 2026: "Premium" zonder periode in Profiel). */
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { subscriptionTierFromEntitlement as tier } from '../src/services/iap-contract';

const d = (iso: string) => iso;

describe('subscriptionTierFromEntitlement', () => {
  it('known product ids (also with a Play base plan suffix)', () => {
    expect(tier('vibezcore_audio_monthly')).toBe('monthly');
    expect(tier('vibezcore_audio_monthly:monthly-base')).toBe('monthly');
    expect(tier('vibezcore_audio_yearly:yearly')).toBe('yearly');
    expect(tier('vibezcore_premium_yearly')).toBe('yearly');
  });
  it('unknown id but a telling name', () => {
    expect(tier('vibezcore_pro_annual')).toBe('yearly');
    expect(tier('something_month_plan')).toBe('monthly');
  });
  it('unknown id: the length of the current period decides', () => {
    expect(tier('rc_promo_x', d('2026-10-01T00:00:00Z'), d('2026-10-31T00:00:00Z'))).toBe('monthly');
    expect(tier('rc_promo_x', d('2026-01-01T00:00:00Z'), d('2027-01-01T00:00:00Z'))).toBe('yearly');
  });
  it('nothing to go on (e.g. a lifetime grant): undefined', () => {
    expect(tier('rc_promo_x')).toBeUndefined();
    expect(tier(undefined, null, null)).toBeUndefined();
    expect(tier('rc_promo_x', d('2026-10-01T00:00:00Z'), d('2026-10-08T00:00:00Z'))).toBeUndefined();
  });
});
