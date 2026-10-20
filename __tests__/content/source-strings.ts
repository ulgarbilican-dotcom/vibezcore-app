/* Hulpmiddel voor de merk-/inhoudstests (20 okt 2026).
   Leest elk bronbestand onder src/ met de TypeScript-parser en geeft alle
   tekst terug die in de app kan verschijnen: string-literals, template-
   stukken en JSX-tekst. Commentaar valt er vanzelf uit (de parser ziet het
   niet als tekst), net als import-paden, require()-argumenten en
   object-sleutels. Geen testbestand: wordt door de *.test.ts gebruikt. */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const SRC_ROOT = path.join(REPO_ROOT, 'src');

export type SourceString = {
  /** Pad relatief aan de repo, met voorwaartse schuine strepen. */
  file: string;
  line: number;
  text: string;
  /** 'jsx' = JSX-tekst tussen tags, 'literal' = string/template-literal. */
  kind: 'jsx' | 'literal';
};

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

function isNonDisplayPosition(node: ts.Node): boolean {
  const p = node.parent;
  if (!p) return false;
  // import x from '…' / export … from '…'
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
  if (ts.isExternalModuleReference(p)) return true;
  // require('…') / import('…') / jest.mock('…')
  if (ts.isCallExpression(p) && p.arguments[0] === node) {
    const callee = p.expression.getText();
    if (callee === 'require' || p.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
  }
  // { 'key': … } — sleutel, geen weergavetekst
  if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p)) && p.name === node) return true;
  // obj['key']
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return true;
  // type T = 'a' | 'b'
  if (ts.isLiteralTypeNode(p)) return true;
  return false;
}

let cache: SourceString[] | null = null;

export function allSourceStrings(): SourceString[] {
  if (cache) return cache;
  const result: SourceString[] = [];
  for (const file of listSourceFiles(SRC_ROOT)) {
    const code = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(
      file,
      code,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    const push = (node: ts.Node, text: string, kind: SourceString['kind']) => {
      if (!text.trim()) return;
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      result.push({ file: rel, line: line + 1, text, kind });
    };
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (!isNonDisplayPosition(node)) push(node, node.text, 'literal');
      } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        push(node, node.text, 'literal');
      } else if (ts.isJsxText(node)) {
        push(node, node.text.replace(/\s+/g, ' ').trim(), 'jsx');
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  cache = result;
  return result;
}

/** Haalt URL's, e-mailadressen en bestandspaden uit een tekst, zodat
    'https://app.vibezcore.com' of 'support@vibezcore.com' geen treffer geven. */
export function stripTechnical(text: string): string {
  return text
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, ' ') // https://…, vibezcoreapp://…
    .replace(/\b[\w.+-]+@[\w-]+(\.[\w-]+)+/g, ' ') // e-mail
    .replace(/\b[\w-]+(\.[\w-]+)*\.(com|app|be|nl|io|net|org)\b\S*/gi, ' ') // kale domeinen
    .replace(/\S*[\/]\S*/g, ' '); // paden
}

/** Ziet de tekst eruit als iets wat een mens leest (heeft een spatie en
    letters), en niet als een sleutel/id/pad? */
export function looksLikeProse(text: string): boolean {
  const t = text.trim();
  if (!/\s/.test(t)) return false;
  if (!/[A-Za-z]{2,}/.test(t)) return false;
  return true;
}

export function fmt(hits: SourceString[]): string[] {
  return hits.map((h) => `${h.file}:${h.line}  ${JSON.stringify(h.text.length > 160 ? h.text.slice(0, 160) + '…' : h.text)}`);
}

export type FieldString = SourceString & { field: string };

/** Alle letterlijke string-waarden van object-velden (`title: '…'`) en
    JSX-attributen (`title="…"`) met een van de opgegeven namen. */
export function stringFields(names: string[]): FieldString[] {
  const wanted = new Set(names);
  const out: FieldString[] = [];
  for (const file of listSourceFiles(SRC_ROOT)) {
    const code = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(
      file,
      code,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    const visit = (node: ts.Node) => {
      let name: string | undefined;
      let init: ts.Node | undefined;
      if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
        name = node.name.text;
        init = node.initializer;
      } else if (ts.isJsxAttribute(node) && node.initializer) {
        name = node.name.getText(sf);
        init = node.initializer;
        if (ts.isJsxExpression(init)) init = init.expression;
      }
      if (name && wanted.has(name) && init && (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init))) {
        const { line } = sf.getLineAndCharacterOfPosition(init.getStart(sf));
        out.push({ file: rel, line: line + 1, text: init.text, kind: 'literal', field: name });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

/** Zoekt in alle weergavetekst (zonder URL's/paden/e-mail) naar een patroon. */
export function findInDisplayText(pattern: RegExp, opts: { proseOnly?: boolean } = {}): SourceString[] {
  const flags = pattern.flags.replace('g', '');
  const re = new RegExp(pattern.source, flags);
  return allSourceStrings().filter((s) => {
    if (opts.proseOnly && !looksLikeProse(s.text)) return false;
    return re.test(stripTechnical(s.text));
  });
}
