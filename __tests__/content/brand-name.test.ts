/* CLAUDE.md §1: VIBEZCORE altijd in HOOFDLETTERS, ook in lopende tekst.
   URL's, e-mailadressen, opslagsleutels, product-id's en het schema
   `vibezcoreapp` zijn techniek en vallen erbuiten. */
import { allSourceStrings, findInDisplayText, fmt, looksLikeProse, stripTechnical } from './source-strings';

describe('merknaam VIBEZCORE', () => {
  test('de bronbestanden leveren tekst op (sanity check van de scanner)', () => {
    const all = allSourceStrings();
    expect(all.length).toBeGreaterThan(1000);
    expect(all.some((s) => s.text.includes('VIBEZCORE'))).toBe(true);
  });

  test('nooit "Vibezcore"/"VibezCore"/"vibezcore" in lopende tekst', () => {
    const hits = allSourceStrings().filter((s) => {
      if (!looksLikeProse(s.text)) return false; // sleutels/id's zonder spatie
      const words = stripTechnical(s.text).match(/\bvibez\s*core\b/gi) ?? [];
      return words.some((w) => w !== 'VIBEZCORE');
    });
    expect(fmt(hits)).toEqual([]);
  });

  test('ook losse labels schrijven de merknaam in hoofdletters', () => {
    // Bv. een knoptekst 'Vibezcore'. Sleutels in kleine letters met
    // scheidingstekens (vibezcore:favorites, vibezcore_day_pass) blijven toegestaan.
    const hits = findInDisplayText(/(^|[^\w:.@/-])(Vibezcore|VibezCore|VIBEZcore|vibezCore)(?![\w:.@/-])/);
    expect(fmt(hits)).toEqual([]);
  });
});
