/* Verkoopkaarten-boekhouding (services/sales-nudges.ts), operator-regels
   19 okt 2026:
   - Day Pass-kaart: na 60 s ACTIEF rondkijken in een app-opening;
   - één keer per kalenderdag zolang de gebruiker Free blijft (2 nov 2026);
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
 *  scherm-/sessiechecks): 60 s rustig in DEZE opening + niet vandaag al getoond. */
function dayPassWouldShow(n: Nudges, openActiveSec: number): boolean {
  if (!n.salesQuietAllows()) return false;
  if (!n.dayPassCapAllows()) return false;
  return openActiveSec >= n.DAY_PASS_FIRST_AFTER_SEC;
}

describe('Day Pass — na 60 s rustig rondkijken in een opening', () => {
  test('drempel is 60 s', async () => {
    const n = await load();
    expect(n.DAY_PASS_FIRST_AFTER_SEC).toBe(60);
  });

  test('55 s = nog niet; 60 s = wel', async () => {
    const n = await load();
    expect(dayPassWouldShow(n, 55)).toBe(false);
    expect(dayPassWouldShow(n, 60)).toBe(true);
  });
});

describe('Day Pass — één keer per dag zolang de gebruiker Free blijft (operator, 2 nov 2026)', () => {
  test('na een kaart: de rest van die dag niets meer', async () => {
    const n = await load();
    n.markDayPassShown();
    now = T0 + 6 * 60 * MIN; // zelfde dag, 6 u later
    expect(n.dayPassCapAllows()).toBe(false);
    expect(dayPassWouldShow(n, 600)).toBe(false);
  });

  test('de volgende dag opnieuw', async () => {
    const n = await load();
    n.markDayPassShown();
    now = T0 + DAY;
    expect(dayPassWouldShow(n, 60)).toBe(true);
  });

  test('3 dagen per week in de app = 3 keer gezien, geen totaal-maximum', async () => {
    const n = await load();
    let shown = 0;
    for (const d of [0, 2, 4, 7, 9, 11, 30]) {
      now = T0 + d * DAY;
      if (dayPassWouldShow(n, 60)) {
        n.markDayPassShown();
        shown++;
      }
      now += 3 * MIN; // nog eens openen dezelfde dag: niet opnieuw
      if (dayPassWouldShow(n, 60)) shown++;
    }
    expect(shown).toBe(7);
  });

  test('"vandaag al getoond" overleeft een koude start', async () => {
    let n = await load();
    n.markDayPassShown();
    await coldStart();
    n = await load();
    now = T0 + 30 * MIN;
    expect(n.dayPassCapAllows()).toBe(false);
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
