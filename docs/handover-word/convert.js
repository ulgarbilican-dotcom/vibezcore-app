/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Markdown → Word (.docx) converter

   Doel: 3 docx-bestanden bouwen uit bestaande markdown handover-docs.
   Geen pandoc beschikbaar op Windows-env → custom converter via
   `marked` (markdown-AST) + `docx` (officiële Word XML builder).

   Layout:
   - A4, 2.5cm marges
   - Calibri 11pt body
   - Headings: blauw #3a8fff
   - Code: Consolas 9pt, lichtgrijze achtergrond
   - Tabellen: header blauw bg + witte tekst
   - Blockquotes: gekleurde linkerrand (rood/oranje/blauw o.b.v. inhoud)
   - Header: doc-titel links, "Vertrouwelijk" rechts (private only)
   - Footer: paginanummers rechts
   - Title page + auto-TOC
   ───────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  LevelFormat,
  ExternalHyperlink,
  TableOfContents,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageNumber,
  PageBreak,
  PageOrientation,
  TabStopType,
  TabStopPosition,
} = require('docx');

/* ─── Brand-tokens ───────────────────────────────────────────────── */
const BRAND = {
  accent: '3a8fff',
  accentDark: '2a7fee',
  text: '1a1a1a',
  textDim: '666666',
  panel: 'f5f5f5',
  border: 'd0d0d0',
  warning: 'f59e0b',
  critical: 'ef4444',
  info: '3a8fff',
  white: 'ffffff',
};

/* ─── Layout-config ───────────────────────────────────────────────── */
/* A4: 11906 x 16838 DXA. 2.5cm marge = ~1417 DXA. */
const PAGE = {
  width: 11906,
  height: 16838,
  margin: 1417,
};
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;

/* ─── Inline-formatting helpers ─────────────────────────────────── */
/**
 * Convert marked inline tokens to TextRun[] / ExternalHyperlink[] children.
 * Supports: text, strong, em, codespan, link, br.
 */
function inlineTokensToRuns(tokens, baseStyle = {}) {
  const runs = [];
  for (const tok of tokens || []) {
    switch (tok.type) {
      case 'text':
        runs.push(new TextRun({ text: tok.text, ...baseStyle }));
        break;
      case 'strong':
        runs.push(
          ...inlineTokensToRuns(tok.tokens, { ...baseStyle, bold: true })
        );
        break;
      case 'em':
        runs.push(
          ...inlineTokensToRuns(tok.tokens, { ...baseStyle, italics: true })
        );
        break;
      case 'codespan':
        runs.push(
          new TextRun({
            text: tok.text,
            font: 'Consolas',
            size: 20,
            shading: { type: ShadingType.CLEAR, fill: BRAND.panel },
            ...baseStyle,
          })
        );
        break;
      case 'link': {
        const linkRuns = inlineTokensToRuns(tok.tokens, {
          ...baseStyle,
          color: BRAND.accent,
          underline: {},
        });
        runs.push(
          new ExternalHyperlink({
            link: tok.href,
            children: linkRuns,
          })
        );
        break;
      }
      case 'br':
        runs.push(new TextRun({ break: 1 }));
        break;
      case 'del':
        runs.push(
          ...inlineTokensToRuns(tok.tokens, { ...baseStyle, strike: true })
        );
        break;
      case 'html':
        /* Strip HTML — markdown comments e.d. — render als plain text. */
        runs.push(new TextRun({ text: stripHtml(tok.text), ...baseStyle }));
        break;
      default:
        if (tok.text) {
          runs.push(new TextRun({ text: tok.text, ...baseStyle }));
        }
    }
  }
  return runs;
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '').trim();
}

/* ─── Blockquote-detectie: warning/critical/info ──────────────── */
function blockquoteFlavor(rawText) {
  const t = rawText.toUpperCase();
  if (
    t.includes('🚨') ||
    t.includes('KRITIEK') ||
    t.includes('LAUNCH BLOCKER') ||
    t.includes('NIET COMMITTEN') ||
    t.includes('WAARSCHUWING')
  ) {
    return BRAND.critical;
  }
  if (t.includes('⚠') || t.includes('WARNING') || t.includes('BELANGRIJK')) {
    return BRAND.warning;
  }
  return BRAND.info;
}

/* ─── Table-builders ──────────────────────────────────────────── */
function buildTable(token) {
  const colCount = token.header.length;
  const colW = Math.floor(CONTENT_WIDTH / colCount);
  const columnWidths = Array(colCount).fill(colW);
  /* Restant naar laatste kolom zodat sum exact = CONTENT_WIDTH. */
  columnWidths[colCount - 1] += CONTENT_WIDTH - colW * colCount;

  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: BRAND.border,
  };
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };

  const headerCells = token.header.map((cell, i) => {
    return new TableCell({
      width: { size: columnWidths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: BRAND.accent },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          spacing: { before: 0, after: 0 },
          children: inlineTokensToRuns(cell.tokens, {
            bold: true,
            color: BRAND.white,
            size: 20,
          }),
        }),
      ],
    });
  });

  const dataRows = token.rows.map((row) => {
    return new TableRow({
      children: row.map((cell, i) => {
        return new TableCell({
          width: { size: columnWidths[i], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 140, right: 140 },
          verticalAlign: VerticalAlign.TOP,
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: inlineTokensToRuns(cell.tokens, { size: 20 }),
            }),
          ],
        });
      }),
    });
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths,
    borders,
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...dataRows],
  });
}

/* ─── Code block (fenced) ─────────────────────────────────────── */
function buildCodeBlock(token) {
  const lines = token.text.split('\n');
  return lines.map((line, idx) => {
    return new Paragraph({
      spacing: { before: idx === 0 ? 100 : 0, after: 0, line: 240 },
      shading: { type: ShadingType.CLEAR, fill: BRAND.panel },
      border: {
        left: {
          style: BorderStyle.SINGLE,
          size: 12,
          color: BRAND.accent,
          space: 4,
        },
      },
      indent: { left: 200 },
      children: [
        new TextRun({
          text: line || ' ',
          font: 'Consolas',
          size: 18,
        }),
      ],
    });
  });
}

/* ─── Blockquote (with flavor) ─────────────────────────────────── */
function buildBlockquote(token) {
  /* Verzamel ALLE tekst uit nested tokens om flavor te bepalen. */
  const allText = collectText(token);
  const color = blockquoteFlavor(allText);

  const paragraphs = [];
  for (const child of token.tokens) {
    if (child.type === 'paragraph') {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 60, after: 60, line: 300 },
          shading: { type: ShadingType.CLEAR, fill: shadingFromColor(color) },
          border: {
            left: {
              style: BorderStyle.SINGLE,
              size: 24,
              color,
              space: 8,
            },
          },
          indent: { left: 200, right: 100 },
          children: inlineTokensToRuns(child.tokens, { size: 22 }),
        })
      );
    } else if (child.type === 'list') {
      paragraphs.push(...buildList(child, true, color));
    } else if (child.type === 'space') {
      /* skip */
    } else if (child.tokens || child.text) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          border: {
            left: {
              style: BorderStyle.SINGLE,
              size: 24,
              color,
              space: 8,
            },
          },
          indent: { left: 200 },
          children: child.tokens
            ? inlineTokensToRuns(child.tokens, { size: 22 })
            : [new TextRun({ text: child.text || '', size: 22 })],
        })
      );
    }
  }
  return paragraphs;
}

function shadingFromColor(hex) {
  /* Lichte tint van de border-kleur — 10% opacity simuleren via afgevlakte hex. */
  /* Critical=ef4444 → fef2f2, Warning=f59e0b → fffbeb, Info=3a8fff → eff6ff. */
  if (hex === BRAND.critical) return 'fef2f2';
  if (hex === BRAND.warning) return 'fffbeb';
  return 'eff6ff';
}

function collectText(tok) {
  if (!tok) return '';
  if (typeof tok === 'string') return tok;
  if (tok.text) return tok.text;
  if (tok.raw) return tok.raw;
  if (Array.isArray(tok.tokens)) return tok.tokens.map(collectText).join(' ');
  if (Array.isArray(tok.items)) return tok.items.map(collectText).join(' ');
  return '';
}

/* ─── List builder (ordered / unordered, with nesting) ────────── */
let listCounter = 0;
function buildList(token, insideQuote = false, quoteColor = null, depth = 0) {
  const out = [];
  const ref = token.ordered ? 'numbers' : 'bullets';
  for (const item of token.items) {
    /* Hoofdtekst van het item. */
    const mainTokens = item.tokens.filter(
      (t) => t.type === 'text' || t.type === 'paragraph'
    );
    const subLists = item.tokens.filter((t) => t.type === 'list');

    const runs = [];
    for (const mt of mainTokens) {
      if (mt.tokens) {
        runs.push(...inlineTokensToRuns(mt.tokens, { size: 22 }));
      } else if (mt.text) {
        runs.push(new TextRun({ text: mt.text, size: 22 }));
      }
    }

    const paraProps = {
      numbering: { reference: ref, level: Math.min(depth, 2) },
      spacing: { before: 40, after: 40 },
      children: runs.length ? runs : [new TextRun({ text: '' })],
    };

    if (insideQuote && quoteColor) {
      paraProps.border = {
        left: {
          style: BorderStyle.SINGLE,
          size: 24,
          color: quoteColor,
          space: 8,
        },
      };
      paraProps.indent = { left: 600, right: 100 };
    }

    out.push(new Paragraph(paraProps));

    /* Geneste lijsten. */
    for (const sub of subLists) {
      out.push(...buildList(sub, insideQuote, quoteColor, depth + 1));
    }
  }
  return out;
}

/* ─── Heading-mapper ──────────────────────────────────────────── */
function mapHeading(token) {
  const levelMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };
  return new Paragraph({
    heading: levelMap[token.depth] || HeadingLevel.HEADING_3,
    spacing: { before: 320, after: 160 },
    children: inlineTokensToRuns(token.tokens),
  });
}

/* ─── Main token-walker ──────────────────────────────────────── */
function tokensToChildren(tokens) {
  const out = [];
  for (const tok of tokens) {
    switch (tok.type) {
      case 'heading':
        out.push(mapHeading(tok));
        break;
      case 'paragraph':
        out.push(
          new Paragraph({
            spacing: { before: 80, after: 80, line: 300 },
            children: inlineTokensToRuns(tok.tokens),
          })
        );
        break;
      case 'space':
        /* skip — Word handles spacing via paragraph margins. */
        break;
      case 'hr':
        out.push(
          new Paragraph({
            spacing: { before: 200, after: 200 },
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: BRAND.border,
                space: 1,
              },
            },
            children: [new TextRun({ text: '' })],
          })
        );
        break;
      case 'table':
        out.push(buildTable(tok));
        /* Spacer na tabel. */
        out.push(
          new Paragraph({ spacing: { before: 80, after: 80 }, children: [] })
        );
        break;
      case 'code':
        out.push(...buildCodeBlock(tok));
        out.push(
          new Paragraph({ spacing: { before: 80, after: 80 }, children: [] })
        );
        break;
      case 'blockquote':
        out.push(...buildBlockquote(tok));
        break;
      case 'list':
        out.push(...buildList(tok));
        break;
      case 'html':
        /* Skip raw HTML comments (markdown like <details> not used here). */
        break;
      default:
        if (tok.text) {
          out.push(
            new Paragraph({
              children: [new TextRun({ text: tok.text })],
            })
          );
        }
    }
  }
  return out;
}

/* ─── Title page ──────────────────────────────────────────────── */
function buildTitlePage(title, subtitle, isPrivate) {
  const children = [
    /* Top padding */
    new Paragraph({ spacing: { before: 2400, after: 0 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: 'VIBEZCORE',
          bold: true,
          size: 96,
          color: BRAND.accent,
          font: 'Calibri',
          characterSpacing: 60,
        }),
      ],
    }),
    /* Accent bar */
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 600 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 24,
          color: BRAND.accent,
          space: 4,
        },
      },
      indent: { left: 4000, right: 4000 },
      children: [new TextRun({ text: '' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 44,
          color: BRAND.text,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 1200 },
      children: [
        new TextRun({
          text: subtitle,
          size: 24,
          color: BRAND.textDim,
          italics: true,
        }),
      ],
    }),
  ];

  if (isPrivate) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 12, color: BRAND.critical },
          bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND.critical },
          left: { style: BorderStyle.SINGLE, size: 12, color: BRAND.critical },
          right: { style: BorderStyle.SINGLE, size: 12, color: BRAND.critical },
        },
        shading: { type: ShadingType.CLEAR, fill: 'fef2f2' },
        indent: { left: 2400, right: 2400 },
        children: [
          new TextRun({
            text: 'VERTROUWELIJK',
            bold: true,
            size: 32,
            color: BRAND.critical,
            characterSpacing: 80,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 800 },
        children: [
          new TextRun({
            text: 'Alleen voor geautoriseerde ontvanger — bevat credentials',
            size: 18,
            color: BRAND.critical,
            italics: true,
          }),
        ],
      })
    );
  } else {
    children.push(
      new Paragraph({ spacing: { before: 200, after: 1000 }, children: [] })
    );
  }

  /* Versie + datum onderaan */
  children.push(
    new Paragraph({ spacing: { before: 2400, after: 0 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: 'Versie: 2026-06-03',
          size: 20,
          color: BRAND.textDim,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          text: 'VIBEZCORE Native App',
          size: 18,
          color: BRAND.textDim,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  return children;
}

/* ─── TOC page ────────────────────────────────────────────────── */
function buildTocPage() {
  return [
    new Paragraph({
      spacing: { before: 0, after: 240 },
      children: [
        new TextRun({
          text: 'Inhoudsopgave',
          bold: true,
          size: 36,
          color: BRAND.accent,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 400 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 8,
          color: BRAND.accent,
          space: 4,
        },
      },
      children: [new TextRun({ text: '' })],
    }),
    new TableOfContents('Inhoudsopgave', {
      hyperlink: true,
      headingStyleRange: '1-3',
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

/* ─── Divider page (for combined doc — between public & private) ── */
function buildDividerPage() {
  return [
    new Paragraph({ spacing: { before: 3600, after: 0 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 400 },
      children: [
        new TextRun({
          text: 'DEEL II',
          bold: true,
          size: 24,
          color: BRAND.textDim,
          characterSpacing: 120,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 800 },
      children: [
        new TextRun({
          text: 'Operator Handover',
          bold: true,
          size: 48,
          color: BRAND.text,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 12, color: BRAND.critical },
        bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND.critical },
        left: { style: BorderStyle.SINGLE, size: 12, color: BRAND.critical },
        right: { style: BorderStyle.SINGLE, size: 12, color: BRAND.critical },
      },
      shading: { type: ShadingType.CLEAR, fill: 'fef2f2' },
      indent: { left: 1200, right: 1200 },
      children: [
        new TextRun({
          text: 'VERTROUWELIJK',
          bold: true,
          size: 32,
          color: BRAND.critical,
          characterSpacing: 80,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 200 },
      children: [
        new TextRun({
          text: 'Alleen voor geautoriseerde ontvanger',
          size: 20,
          color: BRAND.critical,
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 0 },
      children: [
        new TextRun({
          text: 'Bevat credentials, accounts en operationele info.',
          size: 18,
          color: BRAND.textDim,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

/* ─── Build a single document ─────────────────────────────────── */
function buildDoc({ title, subtitle, isPrivate, bodyChildren }) {
  const headerLeftText = title;
  const headerRightText = isPrivate ? 'VERTROUWELIJK' : '';

  const header = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 4,
            color: BRAND.border,
            space: 1,
          },
        },
        children: [
          new TextRun({
            text: headerLeftText,
            size: 18,
            color: BRAND.textDim,
          }),
          new TextRun({ text: '\t' }),
          new TextRun({
            text: headerRightText,
            size: 18,
            color: isPrivate ? BRAND.critical : BRAND.textDim,
            bold: !!isPrivate,
          }),
        ],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: 'Pagina ',
            size: 18,
            color: BRAND.textDim,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 18,
            color: BRAND.textDim,
          }),
          new TextRun({
            text: ' van ',
            size: 18,
            color: BRAND.textDim,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 18,
            color: BRAND.textDim,
          }),
        ],
      }),
    ],
  });

  const titlePage = buildTitlePage(title, subtitle, isPrivate);
  const tocPage = buildTocPage();

  /* Title page section (no header/footer on title page itself) */
  const titleSection = {
    properties: {
      page: {
        size: { width: PAGE.width, height: PAGE.height },
        margin: {
          top: PAGE.margin,
          right: PAGE.margin,
          bottom: PAGE.margin,
          left: PAGE.margin,
        },
      },
      titlePage: true,
    },
    children: [...titlePage, ...tocPage, ...bodyChildren],
    headers: { default: header },
    footers: { default: footer },
  };

  return new Document({
    creator: 'VIBEZCORE Operator',
    title,
    description: subtitle,
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 36, bold: true, font: 'Calibri', color: BRAND.accent },
          paragraph: {
            spacing: { before: 480, after: 240 },
            outlineLevel: 0,
          },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 30, bold: true, font: 'Calibri', color: BRAND.accent },
          paragraph: {
            spacing: { before: 320, after: 160 },
            outlineLevel: 1,
          },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 26, bold: true, font: 'Calibri', color: BRAND.text },
          paragraph: {
            spacing: { before: 240, after: 120 },
            outlineLevel: 2,
          },
        },
        {
          id: 'Heading4',
          name: 'Heading 4',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 22, bold: true, font: 'Calibri', color: BRAND.text },
          paragraph: {
            spacing: { before: 200, after: 100 },
            outlineLevel: 3,
          },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: '◦',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
            },
            {
              level: 2,
              format: LevelFormat.BULLET,
              text: '▪',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 2160, hanging: 360 } } },
            },
          ],
        },
        {
          reference: 'numbers',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.LOWER_LETTER,
              text: '%2.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
            },
            {
              level: 2,
              format: LevelFormat.LOWER_ROMAN,
              text: '%3.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 2160, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [titleSection],
  });
}

/* ─── Markdown → docx body children ───────────────────────────── */
function markdownToBodyChildren(md) {
  /* Strip de aller-eerste H1 (titel) — die staat al op de titelpagina. */
  const stripped = md.replace(/^# .+?\n/, '');
  const tokens = marked.lexer(stripped);
  return tokensToChildren(tokens);
}

/* ─── MAIN ────────────────────────────────────────────────────── */
const ROOT = path.resolve(__dirname, '..', '..');
const ARCH_MD = path.join(ROOT, 'docs', 'APP_ARCHITECTUUR_VOLLEDIG.md');
const HANDOVER_MD = path.join(ROOT, 'docs', 'OPERATOR_HANDOVER.md');
const BLUEPRINT_MD = path.join(ROOT, 'docs', 'VIBEZCORE_BLUEPRINT.md');
const OUT_DIR = __dirname;

async function generateAll() {
  console.log('Reading markdown files...');
  const archMd = fs.readFileSync(ARCH_MD, 'utf8');
  const handoverMd = fs.readFileSync(HANDOVER_MD, 'utf8');
  const blueprintMd = fs.readFileSync(BLUEPRINT_MD, 'utf8');

  /* BELANGRIJK: voor elke output-doc OPNIEUW parsen zodat ExternalHyperlink-
     instances geen state delen tussen documenten. Hergebruik veroorzaakt
     "non-existent relationship"-fouten omdat docx-js auto-IDs alleen in het
     eerste document registreert. */

  /* ─── 1. PUBLIC architectuur doc ─── */
  console.log('Building VIBEZCORE_App_Architectuur.docx...');
  const archDoc = buildDoc({
    title: 'App Architectuur',
    subtitle: 'Volledige technische walkthrough voor developers',
    isPrivate: false,
    bodyChildren: markdownToBodyChildren(archMd),
  });
  const archBuf = await Packer.toBuffer(archDoc);
  fs.writeFileSync(path.join(OUT_DIR, 'VIBEZCORE_App_Architectuur.docx'), archBuf);

  /* ─── 2. PRIVATE handover doc ─── */
  console.log('Building VIBEZCORE_Operator_Handover.docx...');
  const handoverDoc = buildDoc({
    title: 'Operator Handover',
    subtitle: 'Credentials, accounts en launch-checklist',
    isPrivate: true,
    bodyChildren: markdownToBodyChildren(handoverMd),
  });
  const handoverBuf = await Packer.toBuffer(handoverDoc);
  fs.writeFileSync(
    path.join(OUT_DIR, 'VIBEZCORE_Operator_Handover.docx'),
    handoverBuf
  );

  /* ─── 3. COMBINED ─── */
  console.log('Building VIBEZCORE_Complete_Handover.docx...');
  const dividerChildren = buildDividerPage();
  const combinedBody = [
    /* Part 1 title */
    new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: 'DEEL I',
          bold: true,
          size: 18,
          color: BRAND.textDim,
          characterSpacing: 120,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 480 },
      children: [
        new TextRun({
          text: 'App Architectuur',
          bold: true,
          size: 36,
          color: BRAND.accent,
        }),
      ],
    }),
    /* Verse parse — niet de archChildren-array hergebruiken. */
    ...markdownToBodyChildren(archMd),
    new Paragraph({ children: [new PageBreak()] }),
    ...dividerChildren,
    /* Idem voor handover. */
    ...markdownToBodyChildren(handoverMd),
  ];
  const combinedDoc = buildDoc({
    title: 'Complete Handover',
    subtitle: 'Architectuur + Operator handover gecombineerd',
    isPrivate: true,
    bodyChildren: combinedBody,
  });
  const combinedBuf = await Packer.toBuffer(combinedDoc);
  fs.writeFileSync(
    path.join(OUT_DIR, 'VIBEZCORE_Complete_Handover.docx'),
    combinedBuf
  );

  /* ─── 4. BLUEPRINT — A-tot-Z technical doc ─── */
  console.log('Building VIBEZCORE_Blueprint.docx...');
  const blueprintDoc = buildDoc({
    title: 'Complete Blueprint',
    subtitle: 'A-tot-Z technical specification voor herbouw + debug',
    isPrivate: false,
    bodyChildren: markdownToBodyChildren(blueprintMd),
  });
  const blueprintBuf = await Packer.toBuffer(blueprintDoc);
  fs.writeFileSync(
    path.join(OUT_DIR, 'VIBEZCORE_Blueprint.docx'),
    blueprintBuf
  );

  console.log('\nDone. Files written:');
  for (const f of [
    'VIBEZCORE_App_Architectuur.docx',
    'VIBEZCORE_Operator_Handover.docx',
    'VIBEZCORE_Complete_Handover.docx',
    'VIBEZCORE_Blueprint.docx',
  ]) {
    const stat = fs.statSync(path.join(OUT_DIR, f));
    console.log(`  ${f}  (${Math.round(stat.size / 1024)} KB)`);
  }
}

generateAll().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
