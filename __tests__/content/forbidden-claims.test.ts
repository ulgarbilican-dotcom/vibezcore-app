/* CLAUDE.md §1 + geheugen: geen wetenschaps-/medische claims, geen
   hersen-taal, geen "Backed by science"/"Neuroscience-based", en VIBEZCORE
   is geen mindfulness/meditatie-app. "binaural beats" is uitdrukkelijk
   toegestaan (operator, 10 september 2026). Enkel weergavetekst: commentaar,
   URL's (bv. bestandsnamen op de CDN) en identifiers tellen niet. */
import { findInDisplayText, fmt } from './source-strings';

const FORBIDDEN: Array<[string, RegExp]> = [
  ['hersengolven', /hersengolf|hersengolv/i],
  ['brainwave(s) / brain waves', /\bbrain\s*-?\s*waves?\b/i],
  ['entrainment', /\bentrain(ment|s|ed|ing)?\b/i],
  ['synchroniseert (NL)', /\bsynchroniseer\w*|\bsynchroniseert\b/i],
  ['synchronizes your brain/mind', /\bsynchroni[sz]\w*\s+(\w+\s+){0,2}(brain|brains|mind|hersen\w*)\b/i],
  ['klinisch bewezen', /\bklinisch\s+(bewezen|getest)\b/i],
  ['clinically proven/tested', /\bclinically\s+(proven|tested|validated|shown)\b/i],
  ['scientifically proven / wetenschappelijk bewezen', /\bscientifically\s+proven\b|\bwetenschappelijk\s+bewezen\b/i],
  ['Backed by science / science-backed', /\bbacked\s+by\s+(science|research)\b|\bscience[-\s]backed\b/i],
  ['Neuroscience-based', /\bneuroscience[-\s]based\b/i],
  ['mindfulness', /\bmindful(ness)?\b/i],
  ['meditation / meditatie', /\bmeditat\w*/i],
];

describe('verboden claims en woorden in weergavetekst', () => {
  test.each(FORBIDDEN)('nooit "%s"', (label, pattern) => {
    /* Operator, 20 okt 2026: de beschrijvingen in de Audio Library (o.a.
       Zen Flow) mogen "meditation" houden — elders in de app niet. */
    const hits = findInDisplayText(pattern).filter(
      (h) => !(label.startsWith('meditation') && h.file.endsWith('src/data/audio-library-data.ts')),
    );
    expect(fmt(hits)).toEqual([]);
  });

  test('de uitzondering "binaural beats" en gewone haptiek-taal geven geen valse treffer', () => {
    const allowed = [
      'Binaural beats work best with headphones',
      'synchronized haptic guidance',
      'MindfulnessSession',
      'HKCategoryTypeIdentifierMindfulSession',
    ];
    for (const sample of allowed) for (const [, re] of FORBIDDEN) expect(re.test(sample)).toBe(false);
  });
});
