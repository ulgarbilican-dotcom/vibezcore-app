/* CLAUDE.md §4: de vier pijlers — namen, taglines en volgorde zijn
   bindend en overal gelijk. Vervangt de oude set
   "Strategic Wealth · Psychological Resilience · Social Mastery · Stoic Fortitude". */
import { PILLAR_META, PILLAR_ORDER } from '@/data/audio-library-data';
import { allSourceStrings, findInDisplayText, fmt } from './source-strings';

const PILLARS = [
  { name: 'Psychological Resilience', tagline: 'Build what cannot break' },
  { name: 'Inner Sovereignty', tagline: 'Master what is yours' },
  { name: 'Social Mastery', tagline: 'Command without force' },
  { name: 'Strategic Execution & Wealth', tagline: 'Engineer your autonomy' },
];
const NAMES = PILLARS.map((p) => p.name);
const TAGLINES = PILLARS.map((p) => p.tagline);

describe('de vier pijlers', () => {
  test('PILLAR_META/PILLAR_ORDER: eerste vier = de vier pijlers, juiste naam, tagline en nummer', () => {
    const first4 = PILLAR_ORDER.slice(0, 4).map((k) => PILLAR_META[k]);
    expect(first4.map((p) => p.name)).toEqual(NAMES);
    expect(first4.map((p) => p.tagline)).toEqual(TAGLINES);
    expect(first4.map((p) => p.num)).toEqual(['01', '02', '03', '04']);
  });

  test('pijlernamen staan in elk bestand in de juiste volgorde', () => {
    const byFile = new Map<string, string[]>();
    for (const s of allSourceStrings()) {
      if (!NAMES.includes(s.text)) continue;
      byFile.set(s.file, [...(byFile.get(s.file) ?? []), s.text]);
    }
    expect(byFile.size).toBeGreaterThan(0);
    const wrong: string[] = [];
    for (const [file, seen] of byFile) {
      const firstSeen = seen.filter((n, i) => seen.indexOf(n) === i);
      const expected = NAMES.filter((n) => firstSeen.includes(n));
      if (firstSeen.join('|') !== expected.join('|')) wrong.push(`${file}: ${firstSeen.join(' · ')}`);
    }
    expect(wrong).toEqual([]);
  });

  test('een tekst die meerdere pijlers opsomt doet dat in de juiste volgorde', () => {
    const wrong: string[] = [];
    for (const s of allSourceStrings()) {
      const at = NAMES.map((n) => s.text.indexOf(n)).filter((i) => i >= 0);
      if (at.length < 2) continue;
      const sorted = [...at].sort((a, b) => a - b);
      if (at.join(',') !== sorted.join(',')) wrong.push(`${s.file}:${s.line}`);
    }
    expect(wrong).toEqual([]);
  });

  test('pijler-taglines komen enkel in de canonieke vorm voor', () => {
    // Een tagline-literal die bijna-gelijk is (andere hoofdletters, ontbrekend
    // woord) is een afwijking van de bindende tekst.
    const core = TAGLINES.map((t) => t.replace(/\.$/, '').toLowerCase());
    const wrong = allSourceStrings().filter((s) => {
      const t = s.text.trim().replace(/\.$/, '').toLowerCase();
      return core.includes(t) && !TAGLINES.includes(s.text.trim());
    });
    expect(fmt(wrong)).toEqual([]);
  });

  test('oude pijlernamen komen niet meer voor', () => {
    expect(fmt(findInDisplayText(/\bStoic Fortitude\b|\bStrategic Wealth\b/i))).toEqual([]);
  });
});
