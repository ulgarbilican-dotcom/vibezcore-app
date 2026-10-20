/* Audio-toegang (utils/access-tier.ts + data/audio-library-data.ts).
   Operator, 16 okt 2026: enkel 10 gratis audiosessies, de rest Premium
   (maand / jaar / dagpas). Trial vervallen: geen 'account'-tier meer. */
import { SESSIONS } from '@/data/audio-library-data';
import {
  getEffectiveTier,
  needsPreview,
  resolveAccess,
  tierBadgeLabel,
} from '@/utils/access-tier';

const publicSessions = SESSIONS.filter((s) => getEffectiveTier(s) === 'public');
const proSessions = SESSIONS.filter((s) => getEffectiveTier(s) === 'pro');

describe('10 gratis audiosessies, de rest Premium', () => {
  test('precies 10 sessies zijn gratis (public)', () => {
    expect(publicSessions).toHaveLength(10);
  });

  test('geen enkele sessie staat nog op de vervallen trial-tier (account)', () => {
    expect(SESSIONS.filter((s) => getEffectiveTier(s) === 'account')).toEqual([]);
  });

  test('alle andere sessies zijn Premium', () => {
    expect(publicSessions.length + proSessions.length).toBe(SESSIONS.length);
    expect(proSessions.length).toBeGreaterThan(0);
  });

  test('legacy `free`-vlag spreekt de expliciete tier niet tegen', () => {
    for (const s of SESSIONS) {
      if (s.accessTier === 'public') expect(s.free).toBe(true);
      if (s.accessTier === 'pro') expect(s.free).toBe(false);
    }
  });

  test('de 10 gratis sessies zijn de operator-gekozen titels', () => {
    expect(publicSessions.map((s) => s.title).sort()).toEqual(
      [
        'Become a Monster',
        'The Inner Child',
        'Building Inner Strength & Discipline',
        'Identity',
        'Theta Arabic Ritual',
        'Delta Descent',
        'Background Calm',
        'The Father You Tried To Outdo',
        'The Love That Came With Conditions',
        'The Naive Eye That Costs You Everything',
      ].sort(),
    );
  });

  test('sessie-urls zijn uniek (de player zoekt toegang op via url)', () => {
    const urls = SESSIONS.map((s) => s.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('resolveAccess', () => {
  const free = publicSessions[0];
  const pro = proSessions[0];

  test('gast / gratis account: gratis sessie open, Premium-sessie dicht', () => {
    expect(resolveAccess(free, false, false)).toBe('allowed');
    expect(resolveAccess(free, true, false)).toBe('allowed');
    expect(resolveAccess(pro, false, false)).toBe('needs-pro');
    expect(resolveAccess(pro, true, false)).toBe('needs-pro');
  });

  test('Premium (maand/jaar/dagpas = isPro): alles open, ook zonder login', () => {
    for (const s of SESSIONS) {
      expect(resolveAccess(s, true, true)).toBe('allowed');
      expect(resolveAccess(s, false, true)).toBe('allowed');
    }
  });

  test('een gast krijgt precies 10 sessies volledig', () => {
    expect(SESSIONS.filter((s) => resolveAccess(s, false, false) === 'allowed')).toHaveLength(10);
  });
});

describe('needsPreview (player: voorproef of volledig)', () => {
  const free = publicSessions[0];
  const pro = proSessions[0];

  test('gratis sessie speelt altijd volledig', () => {
    expect(needsPreview(free.url, false, false, false, false)).toBe(false);
  });

  test('Premium-sessie: voorproef voor Free, volledig voor Premium', () => {
    expect(needsPreview(pro.url, false, false, false, false)).toBe(true);
    expect(needsPreview(pro.url, false, true, false, false)).toBe(false);
  });

  test('de bibliotheek wint van een (verkeerde) fallbackFree-vlag', () => {
    expect(needsPreview(pro.url, true, false, false, false)).toBe(true);
  });

  test('bracelet+audio-bundel speelt alles volledig', () => {
    expect(needsPreview(pro.url, false, false, false, true)).toBe(false);
  });

  test('onbekende url: volgt fallbackFree / Premium', () => {
    expect(needsPreview('https://x/unknown.mp3', true, false, false, false)).toBe(false);
    expect(needsPreview('https://x/unknown.mp3', false, false, false, false)).toBe(true);
    expect(needsPreview('https://x/unknown.mp3', false, true, false, false)).toBe(false);
  });
});

test('badge: gratis = FREE, al de rest = PRO', () => {
  expect(tierBadgeLabel('public')).toBe('FREE');
  expect(tierBadgeLabel('pro')).toBe('PRO');
  expect(tierBadgeLabel('account')).toBe('PRO');
});
