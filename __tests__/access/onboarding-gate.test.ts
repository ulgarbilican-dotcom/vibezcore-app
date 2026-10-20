/* Onboarding-poort (utils/onboarding-gate.ts) — operator-regels 19 okt 2026:
   1. enkel wanneer de gebruiker de tab ZELF opent (2 s-venster);
   2. afgerond / Skip = nooit meer; Not Now op stap 1 = nog één keer bij de
      volgende koude start, binnen dezelfde run niet;
   3. nooit tijdens een lopende sessie (ademlaag of State Control). */
import { coldStart, flush } from './helpers';

/* Sessiestand van buitenaf, overleeft jest.resetModules (globale variabele). */
const sessions = { breathHost: null as unknown, braceletActive: false };
(globalThis as any).__vzSessions = sessions;

jest.mock('@/services/breath-session-host', () => ({
  getBreathHost: () => (globalThis as any).__vzSessions.breathHost,
}));
jest.mock('@/services/bracelet-session-state', () => ({
  getBraceletSessionSnapshot: () => ({ active: (globalThis as any).__vzSessions.braceletActive }),
}));

type Gate = typeof import('@/utils/onboarding-gate');
type Settings = typeof import('@/utils/settings');

async function load(): Promise<{ gate: Gate; settings: Settings }> {
  const settings = require('@/utils/settings') as Settings;
  await settings.ensureSettingsLoaded();
  const gate = require('@/utils/onboarding-gate') as Gate;
  return { gate, settings };
}

const KINDS = ['breath', 'state'] as const;

beforeEach(() => {
  jest.resetModules();
  (require('@react-native-async-storage/async-storage') as any).__INTERNAL_MOCK_STORAGE__ = {};
  sessions.breathHost = null;
  sessions.braceletActive = false;
  jest.restoreAllMocks();
});

describe.each(KINDS)('onboarding-gate (%s)', (kind) => {
  const doneKey = kind === 'breath' ? 'breathOnboardingCompletedAt' : 'stateOnboardingCompletedAt';

  test('nieuwe gebruiker: mag vanzelf verschijnen', async () => {
    const { gate } = await load();
    expect(gate.mayAutoShowOnboarding(kind)).toBe(true);
  });

  test('afgerond of Skip (CompletedAt gezet) = nooit meer, ook niet na koude start', async () => {
    let { gate, settings } = await load();
    await settings.setSetting(doneKey, Date.now());
    expect(gate.mayAutoShowOnboarding(kind)).toBe(false);
    await coldStart();
    ({ gate } = await load());
    expect(gate.mayAutoShowOnboarding(kind)).toBe(false);
  });

  test('Not Now: niet meer in dezelfde run', async () => {
    const { gate } = await load();
    gate.deferOnboarding(kind);
    expect(gate.mayAutoShowOnboarding(kind)).toBe(false);
  });

  test('Not Now: precies nog ÉÉN keer bij de volgende koude start, daarna nooit meer', async () => {
    let { gate } = await load();
    gate.deferOnboarding(kind);
    await coldStart();
    ({ gate } = await load());
    expect(gate.mayAutoShowOnboarding(kind)).toBe(true); // tweede en laatste keer
    gate.deferOnboarding(kind);
    await coldStart();
    ({ gate } = await load());
    expect(gate.mayAutoShowOnboarding(kind)).toBe(false);
    await coldStart();
    ({ gate } = await load());
    expect(gate.mayAutoShowOnboarding(kind)).toBe(false);
  });

  test('meerdere Not Now in dezelfde run tellen als één', async () => {
    let { gate, settings } = await load();
    gate.deferOnboarding(kind);
    gate.deferOnboarding(kind);
    gate.deferOnboarding(kind);
    await flush();
    const key = kind === 'breath' ? 'breathOnboardingDeferredCount' : 'stateOnboardingDeferredCount';
    expect(settings.getSetting(key)).toBe(1);
    await coldStart();
    ({ gate } = await load());
    expect(gate.mayAutoShowOnboarding(kind)).toBe(true);
  });

  test('nooit tijdens een lopende ademsessie', async () => {
    const { gate } = await load();
    sessions.breathHost = { any: 'host' };
    expect(gate.isAnySessionRunning()).toBe(true);
    expect(gate.mayAutoShowOnboarding(kind)).toBe(false);
  });

  test('nooit tijdens een lopende State Control-sessie', async () => {
    const { gate } = await load();
    sessions.braceletActive = true;
    expect(gate.isAnySessionRunning()).toBe(true);
    expect(gate.mayAutoShowOnboarding(kind)).toBe(false);
  });

  test('een sessie onderdrukt enkel tijdelijk: daarna mag het nog (telt niet als uitstel)', async () => {
    const { gate } = await load();
    sessions.braceletActive = true;
    expect(gate.mayAutoShowOnboarding(kind)).toBe(false);
    sessions.braceletActive = false;
    expect(gate.mayAutoShowOnboarding(kind)).toBe(true);
  });

  test('"zelf geopend": enkel geldig binnen 2 s na de tik, en één keer', async () => {
    const { gate } = await load();
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    gate.markTabOpenedByUser(kind);
    now += 1999;
    expect(gate.consumeTabOpenedByUser(kind)).toBe(true);
    expect(gate.consumeTabOpenedByUser(kind)).toBe(false); // opgegeten

    gate.markTabOpenedByUser(kind);
    now += 2000;
    expect(gate.consumeTabOpenedByUser(kind)).toBe(false); // te laat (deeplink/pill later)
  });

  test('zonder tik (deeplink / melding / pill / app-start) is er geen "zelf geopend"', async () => {
    const { gate } = await load();
    expect(gate.consumeTabOpenedByUser(kind)).toBe(false);
  });

  test('luisteraar hoort de tik (tab al in beeld), en afmelden werkt', async () => {
    const { gate } = await load();
    const l = jest.fn();
    const off = gate.subscribeTabOpenedByUser(kind, l);
    gate.markTabOpenedByUser(kind);
    expect(l).toHaveBeenCalledTimes(1);
    off();
    gate.markTabOpenedByUser(kind);
    expect(l).toHaveBeenCalledTimes(1);
  });
});

test('breath en state zijn onafhankelijk', async () => {
  const { gate, settings } = await load();
  await settings.setSetting('breathOnboardingCompletedAt', Date.now());
  gate.deferOnboarding('breath');
  expect(gate.mayAutoShowOnboarding('breath')).toBe(false);
  expect(gate.mayAutoShowOnboarding('state')).toBe(true);
  gate.markTabOpenedByUser('breath');
  expect(gate.consumeTabOpenedByUser('state')).toBe(false);
  expect(gate.consumeTabOpenedByUser('breath')).toBe(true);
});
