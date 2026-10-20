/* Gedeelde hulp voor de access-tests: een "koude start" nabootsen.
   jest.resetModules() wist ook de AsyncStorage-mock (nieuwe module = lege
   opslag); deze helper neemt de opgeslagen inhoud mee naar het nieuwe
   proces, zoals een echt toestel dat doet. */

type AsMock = { __INTERNAL_MOCK_STORAGE__: Record<string, string> };

function storage(): AsMock {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-async-storage/async-storage') as AsMock;
}

/** Wacht tot lopende beloftes (setSetting → persist) klaar zijn. */
export async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await new Promise((r) => setImmediate(r));
}

/** Nieuwe app-run: module-geheugen weg, opgeslagen data blijft. */
export async function coldStart(): Promise<void> {
  await flush();
  const saved = { ...storage().__INTERNAL_MOCK_STORAGE__ };
  jest.resetModules();
  Object.assign(storage().__INTERNAL_MOCK_STORAGE__, saved);
}
