/* 29 okt 2026: wanneer de app een melding plant rond het einde van de toegang. Pure beslissing, geen echte meldingen. */
jest.mock('expo-notifications', () => ({}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
import { plannedAccessNotifications } from '../src/services/access-notifications';

const H = 60 * 60_000;
const NOW = Date.parse('2026-10-29T12:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

describe('access notifications', () => {
  it('day pass: one notification 1 hour before the end', () => {
    const p = plannedAccessNotifications({ active: true, tier: 'day', validUntil: iso(NOW + 20 * H), willRenew: false }, NOW, null);
    expect(p).toHaveLength(1);
    expect(p[0].id).toBe('vz-access-daypass');
    expect(p[0].at).toBe(NOW + 19 * H);
    expect(p[0].title).toBe('Your Day Pass ends in 1 hour');
  });

  it('day pass with less than an hour left: nothing (the moment has passed)', () => {
    expect(plannedAccessNotifications({ active: true, tier: 'day', validUntil: iso(NOW + 30 * 60_000) }, NOW, null)).toHaveLength(0);
  });

  it('a normal renewing subscription gets NO reminder', () => {
    expect(plannedAccessNotifications({ active: true, tier: 'monthly', validUntil: iso(NOW + 10 * 24 * H), willRenew: true }, NOW, null)).toHaveLength(0);
  });

  it('a cancelled subscription: one notification 2 days before the end', () => {
    const p = plannedAccessNotifications({ active: true, tier: 'yearly', validUntil: iso(NOW + 10 * 24 * H), willRenew: false }, NOW, null);
    expect(p.map((x) => x.id)).toEqual(['vz-access-ending']);
    expect(p[0].at).toBe(NOW + 8 * 24 * H);
  });

  it('billing problem: once per problem, immediately', () => {
    const st = { active: true, tier: 'monthly' as const, validUntil: iso(NOW + 5 * 24 * H), willRenew: true, billingIssueAt: '2026-10-29T10:00:00Z' };
    const first = plannedAccessNotifications(st, NOW, null);
    expect(first.map((x) => x.id)).toEqual(['vz-access-billing']);
    expect(first[0].at).toBeNull();
    expect(first[0].action).toBe('manage');
    expect(plannedAccessNotifications(st, NOW, '2026-10-29T10:00:00Z')).toHaveLength(0);
  });

  it('no access or signed out: nothing', () => {
    expect(plannedAccessNotifications(null, NOW, null)).toHaveLength(0);
    expect(plannedAccessNotifications({ active: false }, NOW, null)).toHaveLength(0);
  });
});
