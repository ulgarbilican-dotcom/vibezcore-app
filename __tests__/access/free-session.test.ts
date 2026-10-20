/* De ENE gratis volledige sessie (Breathwork en State Control) en de
   30 s-voorproef. Operator-regels:
   - Free: een gratis volledige Breathwork-sessie en een gratis volledige
     State Control-sessie, daarna altijd een voorproef van 30 s;
   - Premium (maand/jaar/dagpas) of bracelet-eigenaar: altijd volledig;
   - Instant Sessions ("How do you feel?") verbruiken de gratis sessie NIET;
   - de gratis sessie hoort bij het toestel (niet terug bij uitloggen). */
import * as fs from 'fs';
import * as path from 'path';

const sub = { isLoading: false, isPro: false };
const owner = { value: false };
const settingValues: Record<string, unknown> = {};

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => sub,
}));
jest.mock('@/utils/dev-user-override', () => ({
  useBraceletOwner: () => owner.value,
}));
jest.mock('@/utils/settings', () => {
  const actual = jest.requireActual('@/utils/settings');
  return {
    ...actual,
    useSetting: (k: string) => [k in settingValues ? settingValues[k] : actual.getSetting(k), () => {}],
  };
});

import { FREE_COPY } from '@/constants/free-session-copy';
import { useBreathFreeStart } from '@/hooks/useBreathFreeStart';
import { useStateFreeStart } from '@/hooks/useStateFreeStart';
import { claimFreeSessionParam } from '@/utils/breath-entry';
import { ensureSettingsLoaded, getSetting, setSetting } from '@/utils/settings';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '../../src', rel), 'utf8');

beforeEach(async () => {
  await ensureSettingsLoaded();
  await setSetting('breathFreeSessionUsedAt', null);
  await setSetting('stateFreeSessionUsedAt', null);
  for (const k of Object.keys(settingValues)) delete settingValues[k];
  sub.isLoading = false;
  sub.isPro = false;
  owner.value = false;
});

describe('Breathwork: een gratis volledige sessie', () => {
  test('claimFreeSessionParam: eerste keer = gratis volledig, daarna nooit meer', async () => {
    expect(claimFreeSessionParam()).toEqual({ from: 'onboarding' });
    await new Promise((r) => setImmediate(r));
    expect(typeof getSetting('breathFreeSessionUsedAt')).toBe('number');
    expect(claimFreeSessionParam()).toEqual({});
    expect(claimFreeSessionParam()).toEqual({});
  });

  /* VERMOEDELIJKE BUG (utils/breath-entry.ts:79-84 + settings.ts:532-536):
     de comment belooft "check + markering ... synchrone functie-aanroep op
     het moment van de tik", maar setSetting zet de waarde pas na
     `await loadOnce()` (een microtask later). Twee claims in dezelfde tik
     (dubbeltik, of twee startknoppen in een render) krijgen dus allebei de
     gratis volledige sessie. */
  test.failing('claim is meteen (synchroon) verbruikt: tweede claim in dezelfde tik krijgt niets', () => {
    expect(claimFreeSessionParam()).toEqual({ from: 'onboarding' });
    expect(claimFreeSessionParam()).toEqual({});
  });

  test('Free, nog niet gebruikt -> free-full; gebruikt -> preview', () => {
    expect(useBreathFreeStart()).toBe('free-full');
    settingValues.breathFreeSessionUsedAt = Date.now();
    expect(useBreathFreeStart()).toBe('preview');
  });

  test('Premium (ook dagpas = isPro) -> altijd full, verbruikt niets', () => {
    sub.isPro = true;
    settingValues.breathFreeSessionUsedAt = Date.now();
    expect(useBreathFreeStart()).toBe('full');
  });

  test('tijdens het laden van het abonnement geen voorproef-flits', () => {
    sub.isLoading = true;
    settingValues.breathFreeSessionUsedAt = Date.now();
    expect(useBreathFreeStart()).toBe('full');
  });
});

describe('State Control: een gratis volledige sessie (gekozen toestand uit de onboarding)', () => {
  test('nog geen onboarding-keuze -> preview', () => {
    settingValues.stateFreeMode = null;
    expect(useStateFreeStart()(2)).toBe('preview');
  });

  test('gekozen toestand -> free-full voor die toestand, preview voor de rest', () => {
    settingValues.stateFreeMode = 3;
    const kind = useStateFreeStart();
    expect(kind(3)).toBe('free-full');
    for (const m of [0, 1, 2, 4]) expect(kind(m)).toBe('preview');
  });

  test('-1 = vrije keuze: elke toestand is de gratis sessie', () => {
    settingValues.stateFreeMode = -1;
    const kind = useStateFreeStart();
    for (const m of [0, 1, 2, 3, 4]) expect(kind(m)).toBe('free-full');
  });

  test('na gebruik: overal preview', () => {
    settingValues.stateFreeMode = -1;
    settingValues.stateFreeSessionUsedAt = Date.now();
    const kind = useStateFreeStart();
    for (const m of [0, 1, 2, 3, 4]) expect(kind(m)).toBe('preview');
  });

  test('Premium of bracelet-eigenaar: altijd full', () => {
    settingValues.stateFreeSessionUsedAt = Date.now();
    sub.isPro = true;
    expect(useStateFreeStart()(0)).toBe('full');
    sub.isPro = false;
    owner.value = true;
    expect(useStateFreeStart()(0)).toBe('full');
  });

  test('Breathwork-gratis en State Control-gratis zijn los van elkaar', () => {
    claimFreeSessionParam(); // ademsessie verbruikt
    settingValues.stateFreeMode = -1;
    expect(useStateFreeStart()(1)).toBe('free-full');
  });
});

describe('voorproef = 30 s (bron-check, waarde zit in schermcode)', () => {
  test('Breathwork-voorproef is 30 s', () => {
    expect(read('app/breath-session.tsx')).toMatch(/const BREATH_PREVIEW_SECONDS = 30;/);
  });
});

describe('Instant Sessions verbruiken de gratis sessie niet', () => {
  test('feel-now.tsx roept claimFreeSessionParam niet aan en start met instant=1', () => {
    const src = read('app/feel-now.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/claimFreeSessionParam\s*\(/);
    expect(src).not.toMatch(/breathFreeSessionUsedAt/);
    expect(src).not.toMatch(/stateFreeSessionUsedAt/);
    expect(src).toMatch(/instant:\s*'1'/);
  });
});

describe('gratis sessie hoort bij het toestel', () => {
  test('uitloggen (auth.ts) wist de FreeSessionUsedAt-vlaggen niet', () => {
    const src = read('services/auth.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/setSetting\(\s*'(breath|state)FreeSessionUsedAt'/);
  });
});

describe('FREE_COPY: een bron voor alle Free-teksten', () => {
  test('voorproef-teksten noemen 30 seconden en Premium', () => {
    expect(FREE_COPY.previewCta).toBe('Start 30-Second Preview');
    expect(FREE_COPY.previewLine).toMatch(/Premium/);
    expect(FREE_COPY.feelNowLine).toMatch(/30-second preview/);
    expect(FREE_COPY.feelNowLine).toMatch(/Premium/);
  });

  test('gratis-sessie-teksten spreken van een (one) volledige sessie', () => {
    expect(FREE_COPY.freeCta).toBe('Start Your Free Session');
    expect(FREE_COPY.freeLine).toMatch(/one free full session/i);
  });

  test('geen verboden termen, geen trial, VIBEZCORE nooit in kleine letters, geen punt op het einde', () => {
    for (const v of Object.values(FREE_COPY)) {
      expect(v).not.toMatch(/trial|brainwave|hersengolf|synchroni|clinically|mindfulness|meditation/i);
      expect(v).not.toMatch(/Vibezcore|vibezcore/);
      expect(v.trim()).not.toMatch(/\.$/);
    }
  });
});
