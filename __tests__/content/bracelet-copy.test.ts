/* Bracelet-copy, CLAUDE.md §3 + geheugen:
   - materiaal = stainless steel, NOOIT silver/zilver/sterling;
   - lancering = "Launching Early 2027" (sinds 10 okt 2026), niet meer Fall 2026;
   - edelstenen = natuur/vakmanschap/schoonheid, NOOIT helende, kalmerende
     of energetische krachten. */
import { allSourceStrings, findInDisplayText, fmt, stripTechnical } from './source-strings';

describe('bracelet-materiaal', () => {
  test('nooit silver / zilver / sterling in weergavetekst', () => {
    expect(fmt(findInDisplayText(/\b(silver|zilver\w*|sterling)\b/i))).toEqual([]);
  });
});

describe('lanceringsmoment', () => {
  test('"Fall 2026" (of herfst/autumn/najaar 2026) komt nergens meer voor', () => {
    expect(fmt(findInDisplayText(/\b(fall|autumn|herfst|najaar)\s+(of\s+)?2026\b/i))).toEqual([]);
  });

  test('geen lancering/Kickstarter in 2026 aangekondigd', () => {
    expect(fmt(findInDisplayText(/\b(launch\w*|kickstarter)\b[^.\n]{0,40}\b2026\b/i))).toEqual([]);
  });

  test('"Early 2027" staat effectief in de app (de regel test iets echts)', () => {
    expect(findInDisplayText(/\bearly\s+2027\b/i).length).toBeGreaterThan(0);
  });
});

describe('edelstenen zonder krachten', () => {
  const GEM = /\b(gem|gems|gemstones?|stones?|crystals?|edelste(en|nen)|kristal(len)?)\b/i;
  const POWER =
    /\b(heal\w*|genez\w*|helend\w*|energ\w*|chakras?|auras?|vibration\w*|frequenc\w*|calming|kalmer\w*|soothing|rustgevend\w*|krachten|powers?|metaphysical|spiritual\w*)\b/i;

  test('geen zin noemt een edelsteen samen met een kracht of werking', () => {
    const hits: string[] = [];
    for (const s of allSourceStrings()) {
      const text = stripTechnical(s.text);
      if (!GEM.test(text)) continue;
      for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
        if (GEM.test(sentence) && POWER.test(sentence)) {
          hits.push(`${s.file}:${s.line}  ${JSON.stringify(sentence.trim())}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  test('de controle herkent een verboden edelsteen-claim', () => {
    const bad = 'Each gemstone carries a calming energy.';
    expect(GEM.test(bad) && POWER.test(bad)).toBe(true);
  });
});
