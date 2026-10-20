/* Verkoopkaarten-boekhouding (services/sales-nudges.ts), operator-regels
   19 okt 2026:
   - Day Pass-kaart: eerste keer na 60 s ACTIEF rondkijken;
   - max 1 keer per 7 dagen, max 3 keer in totaal;
   - opnieuw na 2x de plannen wegtikken (bij de volgende app-opening);
   - nooit binnen ~2 min na een andere saleskaart, nooit vlak na een aankoop;
   - Welcome Back: een keer per verlopen abonnement (einddatum).
   Wanneer de kaart effectief verschijnt (geen sessie/preview) beslist
   components/SalesNudgeHost.tsx — zie ook de bron-check onderaan. */
import * as fs from 'fs';
import * as path from 'path';
import { coldStart, flush } from './helpers';

type Nudges = typeof import('@/services/sales-nudges');

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const T0 = Date.UTC(2026, 9, 20, 12, 0, 0);
let now = T0;

async function load(): Promise<Nudges> {
  const n = require('@/services/sales-nudges') as Nudges;
  await n.ensureSalesNudgesLoaded();
  return n;
}

beforeEach(() => {
  jest.resetModules();
  (require('@react-native-async-storage/async-storage') as any).__INTERNAL_MOCK_STORAGE__ = {};
  now = T0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => jest.restoreAllMocks());

/** Wat SalesNudgeHost.tryShow beslist voor de Day Pass-kaart (zonder de
 *  scherm-/sessiechecks), met de functies uit sales-nudges. */
function dayPassWouldShow(n: Nudges, reshowArmed: boolean): boolean {
  if (!n.salesQuietAllows()) return false;
  if (!n.dayPassCapAllows()) return false;
  const first = !n.hasShownDayPass() && n.getActiveSeconds() >= n.DAY_PASS_FIRST_AFTER_SEC;
  const reshow = n.hasShownDayPass() && reshowArmed;
  return first || reshow;
}

describe('Day Pass — eerste keer na 60 s actief rondkijken', () => {
  test('drempel is 60 s', async () => {
    const n = await load();
    expect(n.DAY_PASS_FIRST_AFTER_SEC).toBe(60);
  });

  test('55 s actief = nog niet; 60 s = wel', async () => {
    const n = await load();
    for (let i = 0; i < 11; i++) n.addActiveSeconds(5);
    expect(n.getActiveSeconds()).toBe(55);
    expect(dayPassWouldShow(n, false)).toBe(false);
    n.addActiveSeconds(5);
    expect(n.getActiveSeconds()).toBe(60);
    expect(dayPassWouldShow(n, false)).toBe(true);
  });

  test('actieve seconden stoppen op 60 en blijven bewaard over een koude start', async () => {
    let n = await load();
    n.addActiveSeconds(45);
    n.addActiveSeconds(45);
    expect(n.getActiveSeconds()).toBe(60);
    n.addActiveSeconds(5);
    expect(n.getActiveSeconds()).toBe(60);
    await coldStart();
    n = await load();
    expect(n.getActiveSeconds()).toBe(60);
  });

  test('gedeeltelijk rondkijken telt op over app-runs heen', async () => {
    let n = await load();
    n.addActiveSeconds(30);
    await coldStart();
    n = await load();
    n.addActiveSeconds(30);
    expect(n.getActiveSeconds()).toBe(60);
  });
});

describe('Day Pass — frequentiegrens: 1x per 7 dagen, max 3x totaal', () => {
  test('na een kaart: 7 dagen niets, ook niet bij gewapende herhaling', async () => {
    const n = await load();
    n.addActiveSeconds(60);
    n.markDayPassShown();
    expect(n.hasShownDayPass()).toBe(true);
    now = T0 + 7 * DAY - 1;
    expect(n.dayPassCapAllows()).toBe(false);
    expect(dayPassWouldShow(n, true)).toBe(false);
    now = T0 + 7 * DAY;
    expect(n.dayPassCapAllows()).toBe(true);
  });

  test('de eerste kaart komt geen tweede keer vanzelf (zonder 2x wegtikken)', async () => {
    const n = await load();
    n.addActiveSeconds(60);
    n.markDayPassShown();
    now = T0 + 30 * DAY;
    expect(dayPassWouldShow(n, false)).toBe(false);
  });

  test('max 3 keer in totaal, ook na lange tijd', async () => {
    const n = await load();
    for (let i = 0; i < 3; i++) {
      now = T0 + i * 8 * DAY;
      expect(n.dayPassCapAllows()).toBe(true);
      n.markDayPassShown();
    }
    now = T0 + 365 * DAY;
    expect(n.dayPassCapAllows()).toBe(false);
    expect(dayPassWouldShow(n, true)).toBe(false);
  });

  test('de telling overleeft een koude start', async () => {
    let n = await load();
    n.markDayPassShown();
    now += 8 * DAY;
    n.markDayPassShown();
    now += 8 * DAY;
    n.markDayPassShown();
    await coldStart();
    n = await load();
    now += 100 * DAY;
    expect(n.dayPassCapAllows()).toBe(false);
  });
});

describe('Day Pass — opnieuw na 2x de plannen wegtikken', () => {
  test('1x wegtikken = niet genoeg, 2x = wel', async () => {
    const n = await load();
    expect(n.hasDismissedPlansEnough()).toBe(false);
    n.recordPlansDismissed();
    expect(n.hasDismissedPlansEnough()).toBe(false);
    n.recordPlansDismissed();
    expect(n.hasDismissedPlansEnough()).toBe(true);
  });

  test('een getoonde kaart zet de teller terug op 0', async () => {
    const n = await load();
    n.recordPlansDismissed();
    n.recordPlansDismissed();
    n.markDayPassShown();
    expect(n.hasDismissedPlansEnough()).toBe(false);
  });

  test('volledige doorloop: eerste kaart -> 2x wegtikken -> na 7 dagen herhaling', async () => {
    let n = await load();
    n.addActiveSeconds(60);
    expect(dayPassWouldShow(n, false)).toBe(true);
    n.markDayPassShown();
    n.recordPlansDismissed();
    now += 5 * MIN;
    n.recordPlansDismissed();
    await coldStart(); // volgende app-opening: host wapent de herhaling
    n = await load();
    const armed = n.hasDismissedPlansEnough();
    expect(armed).toBe(true);
    now = T0 + 6 * DAY;
    expect(dayPassWouldShow(n, armed)).toBe(false); // binnen 7 dagen
    now = T0 + 7 * DAY;
    expect(dayPassWouldShow(n, armed)).toBe(true);
  });
});

describe('rust: geen kaart vlak na een andere saleskaart of een aankoop', () => {
  test('binnen 2 min na een paywall/saleskaart: nee', async () => {
    const n = await load();
    n.markSalesCardShown();
    now += 2 * MIN - 1;
    expect(n.salesQuietAllows()).toBe(false);
    now += 1;
    expect(n.salesQuietAllows()).toBe(true);
  });

  test('een Day Pass-kaart telt zelf ook als saleskaart', async () => {
    const n = await load();
    n.markDayPassShown();
    now += MIN;
    expect(n.salesQuietAllows()).toBe(false);
  });

  test('vlak na een aankoop (2 u): nee', async () => {
    const n = await load();
    n.recordPurchase();
    now += 2 * 60 * MIN - 1;
    expect(n.salesQuietAllows()).toBe(false);
    now += 1;
    expect(n.salesQuietAllows()).toBe(true);
  });
});

describe('Welcome Back — een keer per verlopen abonnement', () => {
  const END = '2026-10-01T00:00:00Z';

  test('na tonen onthoudt hij de einddatum (ook over een koude start)', async () => {
    let n = await load();
    expect(n.getWinBackShownFor()).toBeNull();
    n.markWinBackShown(END);
    await coldStart();
    n = await load();
    /* de host toont enkel als key !== getWinBackShownFor() */
    expect(n.getWinBackShownFor()).toBe(END);
  });

  test('een nieuw verlopen abonnement (andere einddatum) mag weer een keer', async () => {
    const n = await load();
    n.markWinBackShown(END);
    expect(n.getWinBackShownFor()).not.toBe('2027-03-01T00:00:00Z');
  });

  test('Welcome Back telt als saleskaart (geen Day Pass er vlak achter)', async () => {
    const n = await load();
    n.markWinBackShown(END);
    expect(n.salesQuietAllows()).toBe(false);
  });

  test('wasPro-vangnet: bewaard per einddatum + e-mail', async () => {
    let n = await load();
    n.setWasPro('2026-11-01T00:00:00Z', 'a@b.c');
    await coldStart();
    n = await load();
    expect(n.getWasPro()).toEqual({ until: '2026-11-01T00:00:00Z', email: 'a@b.c' });
  });
});

describe('voor het laden binnengekomen gebeurtenissen gaan niet verloren', () => {
  /* VERMOEDELIJKE BUG (sales-nudges.ts patch(), ~r. 96-104): een teller die
     voor het laden verhoogd wordt, rekent vanaf de standaard 0 en
     overschrijft na het laden de bewaarde stand (1 + 1 wordt 1). Zelfde pad
     voor markDayPassShown (dayPassShows) en addActiveSeconds. Smal venster
     (enkel tijdens de eerste AsyncStorage-load), maar in strijd met de eigen
     comment "wat voor het laden binnenkwam, mag het laden niet overschrijven". */
  test('wegtikken voor de load wordt opgeteld bij de bewaarde stand', async () => {
    let n = await load();
    n.recordPlansDismissed();
    await coldStart();
    n = require('@/services/sales-nudges') as Nudges; // nog NIET afgewacht
    n.recordPlansDismissed();
    await n.ensureSalesNudgesLoaded();
    await flush();
    expect(n.hasDismissedPlansEnough()).toBe(true);
  });
});

describe('SalesNudgeHost — nooit tijdens sessie/preview (bron-check)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/components/SalesNudgeHost.tsx'), 'utf8');

  test('rustig rondkijken sluit lopende sessies, previews en sessieschermen uit', () => {
    const calm = src.slice(src.indexOf('function isCalmBrowsing'), src.indexOf('function nothingOnTop'));
    expect(calm).toMatch(/isAnySessionRunning\(\)/);
    expect(calm).toMatch(/isBraceletSessionMonitorActive\(\)/);
    expect(calm).toMatch(/isModePreviewRunning\(\)/);
    expect(calm).toMatch(/isLibraryPlaying\(\)/);
    for (const p of ['/breath-session', '/subscribe', '/welcome', '/breath-welcome', '/state-onboarding']) {
      expect(src).toContain(`'${p}'`);
    }
  });

  test('nooit voor Premium of bracelet-eigenaar', () => {
    const tryShow = src.slice(src.indexOf('const tryShow'), src.indexOf('/* De klok'));
    expect(tryShow).toMatch(/s\.isPro\) return/);
    expect(tryShow).toMatch(/braceletRef\.current \|\| !dayPassCapAllows\(\)/);
  });
});
