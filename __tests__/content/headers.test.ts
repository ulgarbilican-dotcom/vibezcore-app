/* Geheugen (no trailing period on headers): koppen, titels, eyebrows en
   labels krijgen GEEN punt aan het einde; lopende tekst wel. FAQ-vragen en
   subtitels (hele zinnen) vallen erbuiten. Taglines ook GEEN punt (operator,
   20 okt 2026: "punten enkel als het moet"). */
import { LEGAL_DOCS } from '@/data/legal-content';
import { FAQ_CATEGORY_LABELS } from '@/data/faq-content';
import { BREATH_STATES } from '@/data/breath-states';
import { MODES } from '@/services/ble-contract';
import { PILLAR_META, SERIES_ORDER, SESSIONS } from '@/data/audio-library-data';
import { fmt, stringFields } from './source-strings';

/** Eindigt op een punt, maar niet op een beletselteken ("…", "..."). */
const endsWithPeriod = (s: string) => /\.\s*$/.test(s) && !/(\.\.\.|…)\s*$/.test(s);

describe('koppen zonder punt', () => {
  test('juridische documenten: titel, eyebrow, korte naam, h2/h3 en kaart-/kadertitels', () => {
    const bad: string[] = [];
    for (const doc of Object.values(LEGAL_DOCS)) {
      for (const [k, v] of [['title', doc.title], ['eyebrow', doc.eyebrow], ['short', doc.short]] as const) {
        if (endsWithPeriod(v)) bad.push(`${doc.slug}.${k}: ${v}`);
      }
      for (const b of doc.blocks) {
        if ((b.kind === 'h2' || b.kind === 'h3') && endsWithPeriod(b.text)) bad.push(`${doc.slug} ${b.kind}: ${b.text}`);
        if ((b.kind === 'highlight' || b.kind === 'danger') && b.title && endsWithPeriod(b.title))
          bad.push(`${doc.slug} ${b.kind}.title: ${b.title}`);
        if (b.kind === 'cards') for (const c of b.items) if (endsWithPeriod(c.title)) bad.push(`${doc.slug} card: ${c.title}`);
        if (b.kind === 'tags') for (const t of b.items) if (endsWithPeriod(t)) bad.push(`${doc.slug} tag: ${t}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test('FAQ-categorielabels', () => {
    expect(Object.values(FAQ_CATEGORY_LABELS).filter(endsWithPeriod)).toEqual([]);
  });

  test('ademtoestanden: eyebrow, titel, subtitel, techniek- en duurnamen', () => {
    const bad: string[] = [];
    for (const st of Object.values(BREATH_STATES)) {
      for (const v of [st.eyebrow, st.title, st.subtitle]) if (endsWithPeriod(v)) bad.push(`${st.key}: ${v}`);
      for (const t of st.techniques) {
        if (endsWithPeriod(t.name)) bad.push(`${st.key} techniek: ${t.name}`);
        for (const d of t.durations ?? []) if (endsWithPeriod(d.name)) bad.push(`${st.key} duur: ${d.name}`);
      }
      for (const d of st.durations) if (endsWithPeriod(d.name)) bad.push(`${st.key} duur: ${d.name}`);
    }
    expect(bad).toEqual([]);
  });

  test('bracelet-modusnamen en pijlernamen', () => {
    expect(MODES.map((m) => m.name).filter(endsWithPeriod)).toEqual([]);
    expect(Object.values(PILLAR_META).map((p) => p.name).filter(endsWithPeriod)).toEqual([]);
  });

  test('audiobibliotheek: serienamen en sessietitels', () => {
    expect(SERIES_ORDER.filter(endsWithPeriod)).toEqual([]);
    expect(SESSIONS.filter((s) => endsWithPeriod(s.title)).map((s) => `${s.series} — ${s.title}`)).toEqual([]);
  });

  test('overal in de code: velden/attributen title, header, heading, eyebrow, headline, sectionTitle', () => {
    const hits = stringFields(['title', 'header', 'heading', 'headerTitle', 'eyebrow', 'headline', 'sectionTitle']).filter(
      (f) => endsWithPeriod(f.text),
    );
    expect(fmt(hits)).toEqual([]);
  });
});

/* Operator, 20 okt 2026: "punten enkel als het moet" — ook taglines niet. */
describe('taglines zonder punt', () => {
  test('geen enkele tagline in src eindigt op een punt', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const root = path.join(__dirname, '..', '..', 'src');
    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name)) {
          fs.readFileSync(full, 'utf8')
            .split('\n')
            .forEach((line, i) => {
              if (/tagline:\s*(['"`])[^'"`]*\.\1/.test(line)) bad.push(`${path.relative(root, full)}:${i + 1}`);
            });
        }
      }
    };
    walk(root);
    expect(bad).toEqual([]);
  });
});
