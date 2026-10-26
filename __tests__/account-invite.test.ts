import { shouldShowInvite } from '../src/utils/account-invite';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const never = { dismissals: 0, lastAt: 0 };

describe('zachte accountuitnodiging', () => {
  it('nooit voor iemand die al is ingelogd', () => {
    expect(shouldShowInvite({ guest: false, didSomething: true, stored: never, now: NOW })).toBe(false);
  });
  it('nooit voordat iemand echt iets deed', () => {
    expect(shouldShowInvite({ guest: true, didSomething: false, stored: never, now: NOW })).toBe(false);
  });
  it('wel voor een gast na een afgeronde sessie, de eerste keer', () => {
    expect(shouldShowInvite({ guest: true, didSomething: true, stored: never, now: NOW })).toBe(true);
  });
  it('na "Not now" minstens 7 dagen weg', () => {
    const once = { dismissals: 1, lastAt: NOW - 3 * DAY };
    expect(shouldShowInvite({ guest: true, didSomething: true, stored: once, now: NOW })).toBe(false);
    expect(shouldShowInvite({ guest: true, didSomething: true, stored: { dismissals: 1, lastAt: NOW - 8 * DAY }, now: NOW })).toBe(true);
  });
  it('hoogstens twee keer, daarna nooit meer vanzelf', () => {
    expect(shouldShowInvite({ guest: true, didSomething: true, stored: { dismissals: 2, lastAt: NOW - 90 * DAY }, now: NOW })).toBe(false);
  });
});
